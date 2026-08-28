package com.somnara.ota

object OtaContract {
  const val AUTHENTICATION_REQUIRED = true

  fun phaseForProgress(progress: Double): String = when {
    progress >= 99.0 -> "verifying"
    else -> "transferring"
  }

  fun sanitizedSdkError(code: Int?, subCode: Int?): Pair<String, String> =
    "JL_${code ?: "UNKNOWN"}_${subCode ?: "UNKNOWN"}" to "JieLi OTA stopped with an error."
}
