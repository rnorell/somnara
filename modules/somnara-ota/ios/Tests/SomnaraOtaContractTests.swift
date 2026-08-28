import XCTest

final class SomnaraOtaContractTests: XCTestCase {
  func testApprovedFirmwareHashIsStable() {
    XCTAssertEqual("8E6BEE05A9F7D55AF9B6AD7FCAD7742E5A05F9A22A551128E93F03104084B66D".count, 64)
  }

  func testAuthenticationIsRequired() {
    XCTAssertTrue(SomnaraOtaContract.authenticationRequired)
  }

  func testProgressMappingAndSanitizedErrors() {
    XCTAssertEqual(SomnaraOtaContract.phase(for: 20), "transferring")
    XCTAssertEqual(SomnaraOtaContract.phase(for: 99), "verifying")
    let error = SomnaraOtaContract.sanitizedError(code: 4097)
    XCTAssertEqual(error.code, "JL_4097")
    XCTAssertFalse(error.message.contains("4097"))
  }
}
