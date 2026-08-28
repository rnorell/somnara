import ExpoModulesCore

public final class SomnaraOtaModule: Module {
  private lazy var controller = SomnaraOtaController { [weak self] event in
    self?.sendEvent("onOtaEvent", event)
  }

  public func definition() -> ModuleDefinition {
    Name("SomnaraOta")
    Events("onOtaEvent")

    AsyncFunction("getSdkInfo") { () -> [String: Any] in
      self.controller.sdkInfo()
    }

    AsyncFunction("scanForOtaDevices") { (timeoutMs: Double, promise: Promise) in
      self.controller.scan(timeoutMs: timeoutMs) { devices in promise.resolve(devices) }
    }.runOnQueue(.main)

    AsyncFunction("inspectFirmware") { (uri: String) throws -> [String: Any?] in
      try self.controller.inspectFirmware(uri: uri)
    }

    AsyncFunction("startUpdate") { (options: [String: String]) throws in
      guard let deviceId = options["deviceId"],
            let firmwareUri = options["firmwareUri"],
            let expectedSha256 = options["expectedSha256"] else {
        throw OtaLocalError("Device, firmware, and approved hash are required.")
      }
      try self.controller.start(deviceId: deviceId, firmwareUri: firmwareUri, expectedSha256: expectedSha256)
    }.runOnQueue(.main)

    AsyncFunction("cancelUpdate") { () -> Bool in self.controller.cancel() }
      .runOnQueue(.main)

    OnDestroy { self.controller.release() }
  }
}
