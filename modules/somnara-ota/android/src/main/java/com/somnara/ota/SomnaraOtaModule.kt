package com.somnara.ota

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SomnaraOtaModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is unavailable." }

  private val controller by lazy {
    SomnaraOtaController(context) { event -> sendEvent("onOtaEvent", event) }
  }

  override fun definition() = ModuleDefinition {
    Name("SomnaraOta")
    Events("onOtaEvent")

    AsyncFunction("getSdkInfo") {
      mapOf(
        "platform" to "android",
        "sdkVersion" to "1.11.0",
        "authenticationEnabled" to true,
        "supportsBle" to true,
        "supportsCancel" to true,
        "requiresPhysicalAcceptance" to true
      )
    }

    AsyncFunction("scanForOtaDevices") { timeoutMs: Double, promise: Promise ->
      requireBluetoothPermissions()
      controller.scan(timeoutMs.toLong()) { devices, errorCode ->
        if (errorCode != null) {
          promise.reject("ANDROID_SCAN_$errorCode", "Bluetooth scan failed (Android code $errorCode). Please try again.", null)
          return@scan
        }
        promise.resolve(devices.map { device ->
          mapOf(
            "id" to device.id,
            "name" to device.name,
            "flashUuid" to device.identity?.flashUuid,
            "macAddress" to device.identity?.macAddress,
            "rawIdentity" to device.identity?.rawIdentity,
            "rssi" to device.rssi
          )
        })
      }
    }

    AsyncFunction("scanForOtaDiagnostics") { timeoutMs: Double, promise: Promise ->
      val permissions = bluetoothPermissions()
      val permissionStatus = if (permissions.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }) "granted" else "denied"
      val manager = context.getSystemService(android.bluetooth.BluetoothManager::class.java)
      val bluetoothState = when {
        permissionStatus != "granted" -> "unauthorized"
        manager.adapter == null -> "unavailable"
        manager.adapter.isEnabled -> "powered_on"
        else -> "powered_off"
      }
      if (permissionStatus != "granted" || bluetoothState != "powered_on") {
        val code = if (permissionStatus != "granted") "PERMISSION_DENIED" else "BLUETOOTH_OFF"
        promise.resolve(diagnosticResult(bluetoothState, permissionStatus, code, emptyList()))
      } else {
        controller.scanDiagnostics(timeoutMs.toLong()) { devices, errorCode ->
          promise.resolve(diagnosticResult(bluetoothState, permissionStatus, errorCode?.let { "ANDROID_SCAN_$it" }, devices))
        }
      }
    }

    AsyncFunction("inspectFirmware") { uri: String ->
      val result = FirmwareFiles.inspect(context, uri)
      mapOf(
        "uri" to uri,
        "name" to result.name,
        "sizeBytes" to result.sizeBytes,
        "sha256" to result.sha256,
        "imageVersion" to null,
        "hardwareId" to null
      )
    }

    AsyncFunction("startUpdate") { options: Map<String, String> ->
      requireBluetoothPermissions()
      val deviceId = requireNotNull(options["deviceId"]) { "Device ID is required." }
      val firmwareUri = requireNotNull(options["firmwareUri"]) { "Firmware URI is required." }
      val expectedSha256 = requireNotNull(options["expectedSha256"]) { "Approved firmware hash is required." }
      controller.start(deviceId, FirmwareFiles.inspect(context, firmwareUri), expectedSha256)
    }

    AsyncFunction("cancelUpdate") { controller.cancel() }

    OnDestroy { controller.release() }
  }

  private fun requireBluetoothPermissions() {
    val permissions = bluetoothPermissions()
    check(permissions.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }) {
      "Bluetooth permission is required."
    }
  }

  private fun bluetoothPermissions() = if (Build.VERSION.SDK_INT >= 31) {
      listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
    } else {
      listOf(Manifest.permission.ACCESS_FINE_LOCATION)
    }

  private fun diagnosticResult(bluetoothState: String, permissionStatus: String, errorCode: String?, devices: List<ScannedOtaDevice>): Map<String, Any?> {
    val mapped = devices.map { device ->
      val matchesOta = device.advertisedServiceUuids.any { it.equals("0000AE00-0000-1000-8000-00805F9B34FB", ignoreCase = true) }
      val matchesControl = device.advertisedServiceUuids.any { it.equals("0000AE30-0000-1000-8000-00805F9B34FB", ignoreCase = true) }
      mapOf(
        "id" to device.id, "name" to device.name, "flashUuid" to device.identity?.flashUuid,
        "macAddress" to device.identity?.macAddress, "rawIdentity" to device.identity?.rawIdentity,
        "rssi" to device.rssi, "advertisedServiceUuids" to device.advertisedServiceUuids,
        "matchesOtaFilter" to matchesOta, "matchesControlFilter" to matchesControl
      )
    }
    return mapOf(
      "timestamp" to java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
        timeZone = java.util.TimeZone.getTimeZone("UTC")
      }.format(java.util.Date()), "bluetoothState" to bluetoothState,
      "permissionStatus" to permissionStatus, "nativeErrorCode" to errorCode,
      "nativeErrorMessage" to if (errorCode == null) null else "Bluetooth scan failed.",
      "filteredCount" to mapped.count { it["matchesOtaFilter"] == true },
      "controlFilteredCount" to mapped.count { it["matchesControlFilter"] == true },
      "unfilteredCount" to mapped.size, "devices" to mapped
    )
  }
}
