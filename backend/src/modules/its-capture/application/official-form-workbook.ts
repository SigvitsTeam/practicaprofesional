import ExcelJS from 'exceljs';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const templateBytes = new Map<string, Promise<Buffer>>();

function officialFormPath(filename: string): string {
  const candidates = [
    join(process.cwd(), 'src', 'assets', 'forms', filename),
    join(process.cwd(), 'backend', 'src', 'assets', 'forms', filename),
    join(process.cwd(), 'dist', 'assets', 'forms', filename),
    join(process.cwd(), 'dist-worker', 'assets', 'forms', filename),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`No se encontró la plantilla oficial ${filename}.`);
  return found;
}

export async function loadOfficialWorkbook(filename: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  let bytes = templateBytes.get(filename);
  if (!bytes) {
    bytes = readFile(officialFormPath(filename));
    templateBytes.set(filename, bytes);
  }
  await workbook.xlsx.load(Uint8Array.from(await bytes).buffer);
  workbook.creator = 'SIGVITS';
  workbook.lastModifiedBy = 'SIGVITS';
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}
