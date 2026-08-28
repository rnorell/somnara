package com.somnara.ota

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OtaContractTest {
  @Test
  fun mapsSdkProgressToStableEvents() {
    assertEquals("transferring", OtaContract.phaseForProgress(42.0))
    assertEquals("verifying", OtaContract.phaseForProgress(99.0))
  }

  @Test
  fun requiresRcspAuthentication() {
    assertTrue(OtaContract.AUTHENTICATION_REQUIRED)
  }

  @Test
  fun hashesFirmwareWithoutChangingTheFile() {
    val file = File.createTempFile("somnara-hash-", ".ufw")
    try {
      file.writeText("Somnara")
      assertEquals("6E45F4E6194E3F13844A10488D2BEEB2C742BD4E2345012430987CB320851868", FirmwareFiles.sha256(file))
      assertEquals("Somnara", file.readText())
    } finally {
      file.delete()
    }
  }

  @Test
  fun removesSdkDetailsFromUserMessage() {
    val sanitized = OtaContract.sanitizedSdkError(4097, 12)
    assertEquals("JL_4097_12", sanitized.first)
    assertEquals("JieLi OTA stopped with an error.", sanitized.second)
    assertFalse(sanitized.second.contains("4097"))
  }
}
