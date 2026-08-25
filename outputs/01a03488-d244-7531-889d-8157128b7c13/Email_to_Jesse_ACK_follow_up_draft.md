Subject: Somnara protocol v1.0 — remaining completion items

Hi Jesse,

Thank you for the Hardware → APP ACK / Error protocol workbook.

We received it and accepted it as the Somnara hardware-to-app ACK/Error annex. Our app ACK layer is now ready for this behavior.

We attached one short workbook: **Somnara Protocol v1.0 — Completion Request**. It lists only the information still required before we can integrate and test the complete device protocol.

Please complete the **Manufacturer response / file name** column. For each item, please provide exact byte tables, supported behavior, SDK versions, and file names. If an item is not supported, please write **NOT SUPPORTED**.

The main remaining items are:

- APP → hardware frame and command payload definitions.
- Status, alarm-list, audio-state, and clock notifications.
- Production bonding and factory-reset behavior.
- Stable Sound ID map.
- Device identity reads.
- Tested RCSP mobile SDK, OTA details, a sample UFW file, and recovery behavior.
- Test-device firmware and hardware evidence.

Please keep the ACK/Error workbook unchanged. You do not need to repeat those definitions in the new workbook.

After we receive the completed workbook and files, we will implement the remaining protocol and arrange the hardware integration test.

Thank you,

Ric
