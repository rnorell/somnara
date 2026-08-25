Subject: Somnara protocol — remaining items after device-uplink review

Hi Jesse,

Thank you. We received **Somnara_Device_to_APP_Protocol_Simple_EN.xlsx**.

We have recorded the `0x13` status report and the fixed `0x18` ten-slot alarm list as supplied for firmware `0.0.2`.

Please confirm these three device-uplink points:

1. Does firmware `0.0.2` support **Skip Next `0x1C`**? It is not included in the ACK list in the new workbook.
2. After Audio Control `0x09`, does the device send only the ACK and then Status `0x13`, or is there a separate Audio State notification?
3. Has the single 104-byte alarm-list notification passed on both Android and iOS with ATT MTU at least 107? Please send the test result and negotiated MTU.

The updated completion workbook now marks device notifications as supplied. The remaining main items are the final APP → device command byte tables, production bonding behavior, the Sound ID file map, unique device identity, RCSP OTA integration files, and hardware test evidence.

Thank you,

Ric
