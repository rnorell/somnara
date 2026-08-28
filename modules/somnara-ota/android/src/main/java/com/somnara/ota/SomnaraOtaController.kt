package com.somnara.ota

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import com.jieli.jl_bt_ota.constant.StateCode
import com.jieli.jl_bt_ota.impl.BluetoothOTAManager
import com.jieli.jl_bt_ota.interfaces.IUpgradeCallback
import com.jieli.jl_bt_ota.model.BluetoothOTAConfigure
import com.jieli.jl_bt_ota.model.base.BaseError
import java.util.UUID

private val SERVICE_UUID: UUID = UUID.fromString("0000AE00-0000-1000-8000-00805F9B34FB")
private val WRITE_UUID: UUID = UUID.fromString("0000AE01-0000-1000-8000-00805F9B34FB")
private val NOTIFY_UUID: UUID = UUID.fromString("0000AE02-0000-1000-8000-00805F9B34FB")
private val CLIENT_CONFIG_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805F9B34FB")

data class ScannedOtaDevice(
  val id: String,
  val name: String?,
  val identity: OtaIdentity?,
  val rssi: Int
)

class SomnaraOtaController(
  private val context: Context,
  private val emit: (Map<String, Any?>) -> Unit
) {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val bluetoothManager = context.getSystemService(BluetoothManager::class.java)
  private val adapter get() = bluetoothManager.adapter
  private var gatt: BluetoothGatt? = null
  private var connectedDevice: BluetoothDevice? = null
  private var writeCharacteristic: BluetoothGattCharacteristic? = null
  private var notifyCharacteristic: BluetoothGattCharacteristic? = null
  private var currentMtu = 23
  private var pendingFirmware: FirmwareInspection? = null
  private var pendingHash: String? = null
  private var otaManager: NativeOtaManager? = null
  private var cancelAllowed = false

  @SuppressLint("MissingPermission")
  fun scan(timeoutMs: Long, complete: (List<ScannedOtaDevice>) -> Unit) {
    require(adapter?.isEnabled == true) { "Turn on Bluetooth and try again." }
    val scanner = requireNotNull(adapter.bluetoothLeScanner) { "Bluetooth scanning is unavailable." }
    val devices = linkedMapOf<String, ScannedOtaDevice>()
    val callback = object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        val record = result.scanRecord
        var identity: OtaIdentity? = null
        record?.manufacturerSpecificData?.let { values ->
          for (index in 0 until values.size()) {
            identity = OtaIdentityParser.parse(values.valueAt(index)) ?: identity
          }
        }
        devices[result.device.address] = ScannedOtaDevice(
          id = result.device.address,
          name = result.device.name ?: record?.deviceName,
          identity = identity,
          rssi = result.rssi
        )
      }

      override fun onScanFailed(errorCode: Int) {
        scanner.stopScan(this)
        complete(emptyList())
      }
    }
    val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid(SERVICE_UUID)).build()
    val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
    scanner.startScan(listOf(filter), settings, callback)
    mainHandler.postDelayed({
      scanner.stopScan(callback)
      complete(devices.values.sortedByDescending { it.rssi })
    }, timeoutMs.coerceIn(1_000L, 20_000L))
  }

  fun start(deviceId: String, firmware: FirmwareInspection, expectedSha256: String) {
    check(gatt == null) { "An OTA connection is already active." }
    require(firmware.sha256.equals(expectedSha256, ignoreCase = true)) { "Firmware SHA-256 does not match the approved file." }
    pendingFirmware = firmware
    pendingHash = expectedSha256.uppercase()
    emitEvent("connecting", 0.0, message = "Connecting to Somnara.")
    val device = adapter.getRemoteDevice(deviceId)
    connectedDevice = device
    @SuppressLint("MissingPermission")
    gatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
  }

  fun cancel(): Boolean {
    val manager = otaManager ?: return false
    if (!cancelAllowed) return false
    manager.cancelOTA()
    return true
  }

  @SuppressLint("MissingPermission")
  fun release() {
    otaManager?.release()
    otaManager = null
    gatt?.disconnect()
    gatt?.close()
    gatt = null
    connectedDevice = null
    writeCharacteristic = null
    notifyCharacteristic = null
    cancelAllowed = false
  }

  private val gattCallback = object : BluetoothGattCallback() {
    @SuppressLint("MissingPermission")
    override fun onConnectionStateChange(callbackGatt: BluetoothGatt, status: Int, newState: Int) {
      if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
        gatt = callbackGatt
        connectedDevice = callbackGatt.device
        callbackGatt.requestMtu(247)
        callbackGatt.discoverServices()
      } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        otaManager?.notifyConnection(callbackGatt.device, StateCode.CONNECTION_DISCONNECT)
        if (otaManager?.isOTA == true) {
          emitEvent("restarting", currentProgress(), message = "Somnara disconnected for restart.")
        }
      }
    }

    override fun onMtuChanged(callbackGatt: BluetoothGatt, mtu: Int, status: Int) {
      if (status == BluetoothGatt.GATT_SUCCESS) currentMtu = mtu
      otaManager?.notifyMtu(callbackGatt, mtu, status)
    }

    @SuppressLint("MissingPermission")
    override fun onServicesDiscovered(callbackGatt: BluetoothGatt, status: Int) {
      if (status != BluetoothGatt.GATT_SUCCESS) return fail("SERVICE_DISCOVERY_FAILED", "Somnara OTA service was not found.", true)
      val service: BluetoothGattService = callbackGatt.getService(SERVICE_UUID)
        ?: return fail("SERVICE_MISSING", "Somnara OTA service was not found.", false)
      writeCharacteristic = service.getCharacteristic(WRITE_UUID)
      notifyCharacteristic = service.getCharacteristic(NOTIFY_UUID)
      val notify = notifyCharacteristic ?: return fail("NOTIFY_MISSING", "Somnara OTA notifications are unavailable.", false)
      if (!callbackGatt.setCharacteristicNotification(notify, true)) {
        return fail("NOTIFY_FAILED", "Somnara OTA notifications could not start.", true)
      }
      val descriptor = notify.getDescriptor(CLIENT_CONFIG_UUID)
      if (descriptor == null) {
        beginAuthenticatedOta(callbackGatt)
      } else if (Build.VERSION.SDK_INT >= 33) {
        callbackGatt.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
      } else {
        @Suppress("DEPRECATION")
        descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        @Suppress("DEPRECATION")
        callbackGatt.writeDescriptor(descriptor)
      }
    }

    override fun onDescriptorWrite(callbackGatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
      if (descriptor.uuid == CLIENT_CONFIG_UUID && status == BluetoothGatt.GATT_SUCCESS) {
        beginAuthenticatedOta(callbackGatt)
      } else if (descriptor.uuid == CLIENT_CONFIG_UUID) {
        fail("NOTIFY_FAILED", "Somnara OTA notifications could not start.", true)
      }
    }

    override fun onCharacteristicChanged(callbackGatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
      if (characteristic.uuid == NOTIFY_UUID) otaManager?.notifyData(callbackGatt.device, value)
    }

    @Suppress("DEPRECATION")
    override fun onCharacteristicChanged(callbackGatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
      val value = characteristic.value ?: return
      if (characteristic.uuid == NOTIFY_UUID) otaManager?.notifyData(callbackGatt.device, value)
    }
  }

  private fun beginAuthenticatedOta(callbackGatt: BluetoothGatt) {
    val firmware = pendingFirmware ?: return fail("FIRMWARE_MISSING", "Choose a firmware file.", false)
    val manager = NativeOtaManager(context)
    otaManager = manager
    val configure = BluetoothOTAConfigure.createDefault()
      .setPriority(BluetoothOTAConfigure.PREFER_BLE)
      .setUseAuthDevice(OtaContract.AUTHENTICATION_REQUIRED)
      .setTimeoutMs(3_000)
      .setMtu(currentMtu)
      .setNeedChangeMtu(false)
      .setUseReconnect(false)
    configure.firmwareFilePath = firmware.file.absolutePath
    manager.configure(configure)
    manager.notifyConnection(callbackGatt.device, StateCode.CONNECTION_OK)
    manager.notifyMtu(callbackGatt, currentMtu, BluetoothGatt.GATT_SUCCESS)
    emitEvent("authenticating", 0.0, message = "Authenticating the device.")
    manager.startOTA(upgradeCallback)
  }

  private val upgradeCallback = object : IUpgradeCallback {
    override fun onStartOTA() {
      cancelAllowed = true
      emitEvent("transferring", 0.0, message = "Firmware transfer started.")
    }

    override fun onNeedReconnect(addr: String?, isNewReconnectWay: Boolean) {
      emitEvent("restarting", currentProgress(), message = "Waiting for Somnara to reconnect.")
    }

    override fun onProgress(type: Int, progress: Float) {
      lastProgress = progress.coerceIn(0f, 100f).toDouble()
      val phase = OtaContract.phaseForProgress(lastProgress)
      emitEvent(phase, lastProgress, code = if (type == 0) "LOADER" else "FIRMWARE")
    }

    override fun onStopOTA() {
      cancelAllowed = false
      lastProgress = 100.0
      emitEvent("restarting", 100.0, code = "AWAITING_VERSION_READBACK", message = "Update transferred. Reconnect and read the new version.")
    }

    override fun onCancelOTA() {
      cancelAllowed = false
      emitEvent("cancelled", currentProgress(), code = "CANCELLED", message = "Update cancelled safely.", recoverable = true)
      release()
    }

    override fun onError(error: BaseError?) {
      cancelAllowed = false
      val sanitized = OtaContract.sanitizedSdkError(error?.code, error?.subCode)
      fail(sanitized.first, sanitized.second, true)
    }
  }

  private var lastProgress = 0.0
  private fun currentProgress() = lastProgress

  private fun fail(code: String, message: String, recoverable: Boolean) {
    emitEvent("failed", currentProgress(), code, message, recoverable)
  }

  private fun emitEvent(
    phase: String,
    progress: Double,
    code: String? = null,
    message: String? = null,
    recoverable: Boolean? = null
  ) {
    emit(mapOf(
      "phase" to phase,
      "progress" to progress,
      "code" to code,
      "message" to message,
      "recoverable" to recoverable,
      "timestamp" to java.time.Instant.now().toString()
    ))
  }

  private inner class NativeOtaManager(context: Context) : BluetoothOTAManager(context) {
    override fun getConnectedDevice(): BluetoothDevice? = connectedDevice
    override fun getConnectedBluetoothGatt(): BluetoothGatt? = gatt
    override fun connectBluetoothDevice(device: BluetoothDevice?) = Unit

    @SuppressLint("MissingPermission")
    override fun disconnectBluetoothDevice(device: BluetoothDevice?) {
      gatt?.disconnect()
    }

    override fun sendDataToDevice(device: BluetoothDevice?, data: ByteArray?): Boolean {
      val callbackGatt = gatt ?: return false
      val characteristic = writeCharacteristic ?: return false
      val payload = data ?: return false
      characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
      return if (Build.VERSION.SDK_INT >= 33) {
        callbackGatt.writeCharacteristic(characteristic, payload, BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE) == BluetoothGatt.GATT_SUCCESS
      } else {
        @Suppress("DEPRECATION")
        characteristic.value = payload
        @Suppress("DEPRECATION")
        callbackGatt.writeCharacteristic(characteristic)
      }
    }

    fun notifyConnection(device: BluetoothDevice, status: Int) = onBtDeviceConnection(device, status)
    fun notifyData(device: BluetoothDevice, data: ByteArray) = onReceiveDeviceData(device, data)
    fun notifyMtu(callbackGatt: BluetoothGatt, mtu: Int, status: Int) = onMtuChanged(callbackGatt, mtu, status)
  }
}
