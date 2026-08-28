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
      controller.scan(timeoutMs.toLong()) { devices ->
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
    val permissions = if (Build.VERSION.SDK_INT >= 31) {
      listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
    } else {
      listOf(Manifest.permission.ACCESS_FINE_LOCATION)
    }
    check(permissions.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }) {
      "Bluetooth permission is required."
    }
  }
}
