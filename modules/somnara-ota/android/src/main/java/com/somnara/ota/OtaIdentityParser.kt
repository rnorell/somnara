package com.somnara.ota

data class OtaIdentity(
  val flashUuid: String,
  val macAddress: String,
  val rawIdentity: String
)

object OtaIdentityParser {
  private const val IDENTITY_LENGTH = 27
  private val FIXED_PREFIX = byteArrayOf(0xBF.toByte(), 0xFB.toByte(), 0xFF.toByte(), 0xBB.toByte(), 0xA9.toByte())

  fun parse(data: ByteArray?): OtaIdentity? {
    if (data == null || data.size < IDENTITY_LENGTH) return null
    val prefixIndex = (0..data.size - FIXED_PREFIX.size).firstOrNull { index ->
      FIXED_PREFIX.indices.all { offset -> data[index + offset] == FIXED_PREFIX[offset] }
    } ?: return null
    if (prefixIndex + IDENTITY_LENGTH > data.size) return null
    val identity = data.copyOfRange(prefixIndex, prefixIndex + IDENTITY_LENGTH)
    val mac = identity.copyOfRange(5, 11).joinToString(":") { "%02X".format(it.toInt() and 0xFF) }
    val flashUuid = identity.copyOfRange(11, 27).joinToString("") { "%02X".format(it.toInt() and 0xFF) }
    return OtaIdentity(
      flashUuid = flashUuid,
      macAddress = mac,
      rawIdentity = identity.joinToString("") { "%02X".format(it.toInt() and 0xFF) }
    )
  }
}
