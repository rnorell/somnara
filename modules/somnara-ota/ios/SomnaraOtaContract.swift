import Foundation

enum SomnaraOtaContract {
  static let authenticationRequired = true

  static func phase(for progress: Double) -> String {
    progress >= 99 ? "verifying" : "transferring"
  }

  static func sanitizedError(code: Int) -> (code: String, message: String) {
    ("JL_\(code)", "JieLi OTA stopped with an error.")
  }
}
