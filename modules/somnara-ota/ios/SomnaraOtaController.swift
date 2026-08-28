import CoreBluetooth
import CryptoKit
import Foundation
import JL_HashPair
import JL_OTALib

private let somnaraService = CBUUID(string: "AE00")
private let somnaraWrite = CBUUID(string: "AE01")
private let somnaraNotify = CBUUID(string: "AE02")

struct OtaPeripheralRecord {
  let id: String
  let name: String?
  let flashUuid: String?
  let macAddress: String?
  let rawIdentity: String?
  let rssi: Int
}

final class SomnaraOtaController: NSObject {
  private let emit: ([String: Any?]) -> Void
  private lazy var central = CBCentralManager(delegate: self, queue: .main)
  private var scanCompletion: (([[String: Any?]]) -> Void)?
  private var discovered: [UUID: (CBPeripheral, OtaPeripheralRecord)] = [:]
  private var targetId: UUID?
  private var peripheral: CBPeripheral?
  private var writeCharacteristic: CBCharacteristic?
  private var notifyCharacteristic: CBCharacteristic?
  private var firmwareData: Data?
  private var expectedHash = ""
  private var progress: Double = 0
  private var cancelAllowed = false
  private let otaManager = JL_OTAManager.getOTAManager()
  private let authManager = JLHashHandler()
  private var authenticated = false

  init(emit: @escaping ([String: Any?]) -> Void) {
    self.emit = emit
    super.init()
    otaManager.delegate = self
    authManager.delegate = self
  }

  func sdkInfo() -> [String: Any] {
    [
      "platform": "ios",
      "sdkVersion": "2.5.0",
      "authenticationEnabled": true,
      "supportsBle": true,
      "supportsCancel": true,
      "requiresPhysicalAcceptance": true
    ]
  }

  func scan(timeoutMs: Double, completion: @escaping ([[String: Any?]]) -> Void) {
    guard central.state == .poweredOn else {
      completion([])
      return
    }
    discovered.removeAll()
    scanCompletion = completion
    central.scanForPeripherals(withServices: [somnaraService], options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
    DispatchQueue.main.asyncAfter(deadline: .now() + min(max(timeoutMs / 1000, 1), 20)) { [weak self] in
      self?.finishScan()
    }
  }

  func inspectFirmware(uri: String) throws -> [String: Any?] {
    let fileUrl = try localFileUrl(uri)
    let data = try Data(contentsOf: fileUrl, options: .mappedIfSafe)
    guard fileUrl.pathExtension.lowercased() == "ufw" else { throw OtaLocalError("Choose a UFW firmware file.") }
    guard !data.isEmpty else { throw OtaLocalError("Firmware file is empty.") }
    return [
      "uri": uri,
      "name": fileUrl.lastPathComponent,
      "sizeBytes": data.count,
      "sha256": sha256(data),
      "imageVersion": nil,
      "hardwareId": nil
    ]
  }

  func start(deviceId: String, firmwareUri: String, expectedSha256: String) throws {
    guard let uuid = UUID(uuidString: deviceId) else { throw OtaLocalError("Device ID is invalid.") }
    let fileUrl = try localFileUrl(firmwareUri)
    let data = try Data(contentsOf: fileUrl, options: .mappedIfSafe)
    let actualHash = sha256(data)
    guard actualHash.caseInsensitiveCompare(expectedSha256) == .orderedSame else {
      throw OtaLocalError("Firmware SHA-256 does not match the approved file.")
    }
    targetId = uuid
    firmwareData = data
    expectedHash = expectedSha256.uppercased()
    authenticated = false
    progress = 0
    emitEvent("connecting", message: "Connecting to Somnara.")

    if let found = discovered[uuid]?.0 {
      connect(found)
      return
    }
    central.scanForPeripherals(withServices: [somnaraService], options: nil)
    DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
      guard let self, self.peripheral == nil else { return }
      self.fail("DEVICE_NOT_FOUND", "The selected Somnara was not found.", true)
      self.central.stopScan()
    }
  }

  func cancel() -> Bool {
    guard cancelAllowed else { return false }
    otaManager.cmdOTACancelResult(nil)
    otaManager.resetOTAManager()
    cancelAllowed = false
    emitEvent("cancelled", code: "CANCELLED", message: "Update cancelled safely.", recoverable: true)
    return true
  }

  func release() {
    central.stopScan()
    if let peripheral { central.cancelPeripheralConnection(peripheral) }
    otaManager.resetOTAManager()
    peripheral = nil
    writeCharacteristic = nil
    notifyCharacteristic = nil
    firmwareData = nil
    authenticated = false
    cancelAllowed = false
  }

  private func finishScan() {
    central.stopScan()
    let values = discovered.values.map { (_, record) -> [String: Any?] in
      [
        "id": record.id,
        "name": record.name,
        "flashUuid": record.flashUuid,
        "macAddress": record.macAddress,
        "rawIdentity": record.rawIdentity,
        "rssi": record.rssi
      ]
    }.sorted { ($0["rssi"] as? Int ?? -127) > ($1["rssi"] as? Int ?? -127) }
    scanCompletion?(values)
    scanCompletion = nil
  }

  private func connect(_ next: CBPeripheral) {
    central.stopScan()
    peripheral = next
    next.delegate = self
    central.connect(next, options: nil)
  }

  private func write(_ data: Data) {
    guard let peripheral, let characteristic = writeCharacteristic else {
      fail("WRITE_NOT_READY", "Somnara OTA is not ready to send data.", true)
      return
    }
    let length = peripheral.maximumWriteValueLength(for: .withoutResponse)
    var offset = 0
    while offset < data.count {
      let end = min(offset + length, data.count)
      peripheral.writeValue(data.subdata(in: offset..<end), for: characteristic, type: .withoutResponse)
      offset = end
    }
  }

  private func beginAuthentication() {
    guard let peripheral else { return }
    otaManager.mBLE_UUID = peripheral.identifier.uuidString
    otaManager.mBLE_NAME = peripheral.name ?? "Somnara"
    otaManager.noteEntityConnected()
    emitEvent("authenticating", message: "Authenticating the device.")
    authManager.hashResetPair()
    authManager.bluetoothPairingKey(nil) { [weak self] success in
      guard let self else { return }
      guard success else {
        self.fail("AUTHENTICATION_FAILED", "JieLi device authentication failed.", true)
        return
      }
      self.authenticated = true
      self.otaManager.cmdTargetFeature()
    }
  }

  private func parseIdentity(_ data: Data?) -> (String, String, String)? {
    guard let data else { return nil }
    let source = [UInt8](data)
    let prefix: [UInt8] = [0xBF, 0xFB, 0xFF, 0xBB, 0xA9]
    guard let start = source.indices.first(where: { index in
      index + 27 <= source.count && Array(source[index..<(index + prefix.count)]) == prefix
    }) else { return nil }
    let bytes = Array(source[start..<(start + 27)])
    let raw = bytes.map { String(format: "%02X", $0) }.joined()
    let mac = bytes[5..<11].map { String(format: "%02X", $0) }.joined(separator: ":")
    let flash = bytes[11..<27].map { String(format: "%02X", $0) }.joined()
    return (flash, mac, raw)
  }

  private func sha256(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02X", $0) }.joined()
  }

  private func localFileUrl(_ value: String) throws -> URL {
    if let url = URL(string: value), url.isFileURL { return url }
    if value.hasPrefix("/") { return URL(fileURLWithPath: value) }
    throw OtaLocalError("Firmware file is not local or readable.")
  }

  private func fail(_ code: String, _ message: String, _ recoverable: Bool) {
    cancelAllowed = false
    emitEvent("failed", code: code, message: message, recoverable: recoverable)
  }

  private func emitEvent(
    _ phase: String,
    code: String? = nil,
    message: String? = nil,
    recoverable: Bool? = nil,
    finalVersion: String? = nil
  ) {
    emit([
      "phase": phase,
      "progress": progress,
      "code": code,
      "message": message,
      "recoverable": recoverable,
      "finalVersion": finalVersion,
      "timestamp": ISO8601DateFormatter().string(from: Date())
    ])
  }
}

extension SomnaraOtaController: CBCentralManagerDelegate {
  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    if central.state != .poweredOn, scanCompletion != nil { finishScan() }
  }

  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
    let manufacturerData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data
    let identity = parseIdentity(manufacturerData)
    let record = OtaPeripheralRecord(
      id: peripheral.identifier.uuidString,
      name: peripheral.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String,
      flashUuid: identity?.0,
      macAddress: identity?.1,
      rawIdentity: identity?.2,
      rssi: RSSI.intValue
    )
    discovered[peripheral.identifier] = (peripheral, record)
    if peripheral.identifier == targetId { connect(peripheral) }
  }

  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    self.peripheral = peripheral
    peripheral.delegate = self
    peripheral.discoverServices([somnaraService])
  }

  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    fail("CONNECTION_FAILED", "Somnara could not connect.", true)
  }

  func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    otaManager.noteEntityDisconnected()
    authenticated = false
    if otaManager.otaStatus != .normal {
      emitEvent("restarting", code: "AWAITING_VERSION_READBACK", message: "Somnara disconnected for restart.")
    }
  }
}

extension SomnaraOtaController: CBPeripheralDelegate {
  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    guard error == nil, let service = peripheral.services?.first(where: { $0.uuid == somnaraService }) else {
      fail("SERVICE_MISSING", "Somnara OTA service was not found.", false)
      return
    }
    peripheral.discoverCharacteristics([somnaraWrite, somnaraNotify], for: service)
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    guard error == nil else {
      fail("CHARACTERISTIC_DISCOVERY_FAILED", "Somnara OTA characteristics were not found.", true)
      return
    }
    writeCharacteristic = service.characteristics?.first(where: { $0.uuid == somnaraWrite })
    notifyCharacteristic = service.characteristics?.first(where: { $0.uuid == somnaraNotify })
    guard let notifyCharacteristic, writeCharacteristic != nil else {
      fail("CHARACTERISTICS_MISSING", "Somnara OTA transport is incomplete.", false)
      return
    }
    peripheral.setNotifyValue(true, for: notifyCharacteristic)
  }

  func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
    guard error == nil, characteristic.isNotifying else {
      fail("NOTIFY_FAILED", "Somnara OTA notifications could not start.", true)
      return
    }
    beginAuthentication()
  }

  func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    guard error == nil, let data = characteristic.value else { return }
    if !authenticated {
      authManager.inputPairData(data)
    } else {
      otaManager.cmdOtaDataReceive(data)
    }
  }
}

extension SomnaraOtaController: JLHashHandlerDelegate {
  func hash(onPairOutputData data: Data) { write(data) }
}

extension SomnaraOtaController: JL_OTAManagerDelegate {
  func otaDataSend(_ data: Data) { write(data) }

  func otaCancel() {
    cancelAllowed = false
    emitEvent("cancelled", code: "CANCELLED", message: "Update cancelled safely.", recoverable: true)
  }

  func otaFeatureResult(_ manager: JL_OTAManager) {
    guard let firmwareData else {
      fail("FIRMWARE_MISSING", "Choose a firmware file.", false)
      return
    }
    cancelAllowed = true
    emitEvent("transferring", message: "Firmware transfer started.")
    manager.cmdOTAData(firmwareData, result: nil)
  }

  func otaUpgradeResult(_ result: JL_OTAResult, progress nextProgress: Float) {
    progress = Double(max(0, min(nextProgress, 100)))
    switch result {
    case .success:
      cancelAllowed = false
      progress = 100
      emitEvent("restarting", code: "AWAITING_VERSION_READBACK", message: "Update transferred. Reconnect and read the new version.")
    case .upgrading, .prepared, .preparing, .statusIsUpdating:
      cancelAllowed = true
      emitEvent(progress >= 99 ? "verifying" : "transferring")
    case .reconnect, .reconnectWithMacAddr, .reconnectUpdateSource, .reboot, .disconnect:
      emitEvent("restarting", message: "Waiting for Somnara to reconnect.")
    case .cancel:
      cancelAllowed = false
      emitEvent("cancelled", code: "CANCELLED", message: "Update cancelled safely.", recoverable: true)
    default:
      cancelAllowed = false
      fail("JL_\(result.rawValue)", "JieLi OTA stopped with an error.", true)
    }
  }
}

struct OtaLocalError: LocalizedError {
  let message: String
  init(_ message: String) { self.message = message }
  var errorDescription: String? { message }
}
