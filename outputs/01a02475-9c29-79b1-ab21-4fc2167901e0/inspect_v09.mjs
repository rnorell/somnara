import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const inputPath = 'C:/Users/adver/OneDrive/Documents/somnara/outputs/019ff51a-ef33-7a13-a6f1-06956f304455/Somnara_BLE_Protocol_v0.9_for_review.xlsx';
const previewDir = 'C:/Users/adver/OneDrive/Documents/somnara/outputs/01a02475-9c29-79b1-ab21-4fc2167901e0/v09_previews';
await fs.mkdir(previewDir, { recursive: true });

const blob = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(blob);

const summary = await workbook.inspect({
  kind: 'workbook,sheet,table',
  maxChars: 12000,
  tableMaxRows: 8,
  tableMaxCols: 8,
  tableMaxCellChars: 100,
});
console.log(summary.ndjson);

for (const sheet of workbook.worksheets.items) {
  const preview = await workbook.render({ sheetName: sheet.name, autoCrop: 'all', scale: 1, format: 'png' });
  const safeName = sheet.name.replace(/[^A-Za-z0-9]+/g, '_');
  await fs.writeFile(`${previewDir}/${safeName}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const styles = await workbook.inspect({
  kind: 'computedStyle',
  sheetId: 'Overview',
  range: 'A1:G17',
  maxChars: 6000,
});
console.log(styles.ndjson);
