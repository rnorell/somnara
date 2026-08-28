package com.somnara.ota

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class OtaIdentityParserTest {
  @Test
  fun parsesSupplierAdvertisingIdentity() {
    val bytes = hex("BFFBFFBBA928C34AFF7EC9A34150345A3932340F005CDB5207107878")
    val result = requireNotNull(OtaIdentityParser.parse(bytes))
    assertEquals("28:C3:4A:FF:7E:C9", result.macAddress)
    assertEquals("A34150345A3932340F005CDB52071078", result.flashUuid)
  }

  @Test
  fun rejectsIncompleteIdentity() {
    assertNull(OtaIdentityParser.parse(ByteArray(26)))
  }

  private fun hex(value: String): ByteArray = value.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
}
