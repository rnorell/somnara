package com.somnara.ota

import android.content.Context
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

data class FirmwareInspection(
  val file: File,
  val name: String,
  val sizeBytes: Long,
  val sha256: String
)

object FirmwareFiles {
  fun inspect(context: Context, source: String): FirmwareInspection {
    val uri = Uri.parse(source)
    val file = when (uri.scheme?.lowercase()) {
      "content" -> copyContentUri(context, uri)
      "file" -> File(requireNotNull(uri.path) { "Firmware file path is missing." })
      null -> File(source)
      else -> throw IllegalArgumentException("Unsupported firmware file location.")
    }
    require(file.exists() && file.isFile) { "Firmware file is not readable." }
    require(file.extension.equals("ufw", ignoreCase = true)) { "Choose a UFW firmware file." }
    require(file.length() > 0L) { "Firmware file is empty." }
    return FirmwareInspection(file, file.name, file.length(), sha256(file))
  }

  private fun copyContentUri(context: Context, uri: Uri): File {
    val target = File.createTempFile("somnara-ota-", ".ufw", context.cacheDir)
    context.contentResolver.openInputStream(uri).use { input ->
      requireNotNull(input) { "Firmware file could not be opened." }
      FileOutputStream(target).use { output -> input.copyTo(output) }
    }
    return target
  }

  internal fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        if (count > 0) digest.update(buffer, 0, count)
      }
    }
    return digest.digest().joinToString("") { "%02X".format(it.toInt() and 0xFF) }
  }
}
