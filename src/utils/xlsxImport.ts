// Leitor mínimo de .xlsx (sem dependências): devolve as linhas da 1ª planilha como texto/número.
import type { XlsxCell } from './xlsxExport';

interface ZipEntry {
  method: number;
  compSize: number;
  offset: number;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readZipDirectory(buf: Uint8Array): Map<string, ZipEntry> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Arquivo não é um .xlsx válido.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const map = new Map<string, ZipEntry>();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    map.set(dec.decode(buf.subarray(p + 46, p + 46 + nameLen)), { method, compSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return map;
}

async function readEntry(buf: Uint8Array, e: ZipEntry): Promise<string> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
  const raw = buf.subarray(start, start + e.compSize);
  const data = e.method === 0 ? raw : await inflateRaw(raw);
  return new TextDecoder().decode(data);
}

const colIndex = (ref: string) => {
  const letters = ref.replace(/[^A-Z]/gi, '').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const textOf = (el: Element) =>
  Array.from(el.getElementsByTagName('t'))
    .filter((t) => t.parentElement?.tagName !== 'rPh')
    .map((t) => t.textContent ?? '')
    .join('');

export async function readXlsxRows(file: File): Promise<XlsxCell[][]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dir = readZipDirectory(buf);
  const sheetName = [...dir.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  if (!sheetName) throw new Error('Nenhuma planilha encontrada no arquivo.');
  const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

  let shared: string[] = [];
  const ss = dir.get('xl/sharedStrings.xml');
  if (ss) shared = Array.from(parse(await readEntry(buf, ss)).getElementsByTagName('si')).map(textOf);

  const doc = parse(await readEntry(buf, dir.get(sheetName)!));
  const rows: XlsxCell[][] = [];
  for (const rowEl of Array.from(doc.getElementsByTagName('row'))) {
    const rIdx = Number(rowEl.getAttribute('r') || rows.length + 1) - 1;
    const cells: XlsxCell[] = [];
    for (const c of Array.from(rowEl.getElementsByTagName('c'))) {
      const idx = colIndex(c.getAttribute('r') || '');
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      let val: XlsxCell = null;
      if (t === 's') val = shared[Number(v)] ?? '';
      else if (t === 'inlineStr') val = textOf(c);
      else if (t === 'str' || t === 'b' || t === 'e') val = v;
      else if (v !== '') val = Number(v);
      if (idx >= 0) cells[idx] = val;
    }
    while (rows.length < rIdx) rows.push([]);
    rows[rIdx] = cells;
  }
  return rows;
}

/** Número de série do Excel (dias desde 1899-12-30) -> YYYY-MM-DD */
export const excelSerialToIso = (n: number) => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10);
