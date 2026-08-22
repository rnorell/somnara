Subject: Somnara BLE Protocol v0.11 – final confirmation

Hi Jesse,

Thank you for the clear answers.

We updated the same v0.9 workbook that you reviewed. The new v0.11 file already contains your confirmed answers, so your team does not need to enter them again.

Please use the **Final Confirmations Before Protocol v1.0** sheet. We left the **Manufacturer response** column blank only where we still need information. If your updated manufacturer workbook already contains an answer, you do not need to repeat it.

Two points need a short confirmation:

1. **BLE bonding:** We propose one unique six-digit PIN for each device. The PIN can be printed on a label and in a QR code. Please confirm that the firmware can support this method, store the bond, limit failed attempts, and remove the bond during factory reset. If this method is not supported, please recommend the safest supported method.
2. **Seven buttons:** Please send a labeled photo or a list that shows the position of each button. Please also state whether the firmware supports short press, long press, and button combinations. We will then send the final function map. Please do not assign the functions yet.

Please also include these items in your updated workbook or reply:

- Final MCU-to-app frames and common frame rules.
- The stable 25-file Sound ID map and loop behavior.
- Clock-valid and clock-invalid frames, plus the RTC drift value.
- The tested RCSP mobile SDK package, OTA UUIDs, transfer rules, authentication and signing details, and one sample UFW file.
- Serial number, hardware revision, firmware revision, and unique device identity reads.

For this review, v0.11 replaces v0.9. We will freeze protocol v1.0 only after the remaining fields are confirmed and tested on the hardware.

Thank you,

Ric
