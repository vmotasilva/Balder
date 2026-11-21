// Gerador mínimo de PDF (sem dependências): tabela paginada em A4, fonte Helvetica padrão (WinAnsi).

export interface PdfColumn {
  header: string;
  width: number; // pontos; a soma deve caber em 523 (A4 com margem de 36)
  align?: 'left' | 'right';
}

export interface PdfTableOptions {
  title: string;
  subtitle?: string[];
  columns: PdfColumn[];
  rows: string[][];
  /** Linhas finais (totais), em negrito */
  footerRows?: string[][];
}

const W = 595;
const H = 842;
const M = 36;
const FS = 9;
const LINE = 16;

// Larguras da Helvetica (ASCII 32–126), em milésimos de em
const HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const charW = (ch: string, bold: boolean) => {
  const c = ch.charCodeAt(0);
  const w = c >= 32 && c <= 126 ? HW[c - 32] : 556;
  return (bold ? w * 1.06 : w) / 1000;
};
const textW = (s: string, size: number, bold: boolean) => [...s].reduce((a, ch) => a + charW(ch, bold), 0) * size;

function fit(s: string, max: number, size: number, bold: boolean): string {
  if (textW(s, size, bold) <= max) return s;
  let out = s;
  while (out.length > 1 && textW(out + '…', size, bold) > max) out = out.slice(0, -1);
  return out.trimEnd() + '...';
}

// Texto -> literal PDF em Latin1 (WinAnsi cobre os acentos do português)
const lit = (s: string) =>
  '(' +
  [...s]
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (ch === '\\' || ch === '(' || ch === ')') return '\\' + ch;
      if (c === 0x2212) return '-'; // sinal de menos
      if (c === 0x2026) return '...';
      if (c > 255) return '?';
      return String.fromCharCode(c);
    })
    .join('') +
  ')';

const num = (n: number) => (Math.round(n * 100) / 100).toString();

export function buildPdfTable(opt: PdfTableOptions): Blob {
  const totalW = opt.columns.reduce((a, c) => a + c.width, 0);
  const pages: string[][] = [];
  let ops: string[] = [];
  let y = H - M;
  const text = (s: string, x: number, yy: number, bold = false, size = FS, align: 'left' | 'right' = 'left', width = 0) => {
    const t = fit(s, width || totalW, size, bold);
    const px = align === 'right' ? x + width - textW(t, size, bold) : x;
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${num(px)} ${num(yy)} Td ${lit(t)} Tj ET`);
  };
  const row = (cells: string[], bold: boolean) => {
    let x = M;
    opt.columns.forEach((col, i) => {
      text(cells[i] ?? '', x + 3, y - 11, bold, FS, col.align ?? 'left', col.width - 6);
      x += col.width;
    });
    y -= LINE;
  };
  const rule = (yy: number, gray = 0.75) => ops.push(`${gray} G 0.5 w ${M} ${num(yy)} m ${M + totalW} ${num(yy)} l S 0 G`);
  const header = () => {
    ops.push('0.93 g ' + `${M} ${num(y - LINE)} ${totalW} ${LINE} re f 0 g`);
    row(opt.columns.map((c) => c.header), true);
    rule(y);
  };
  const newPage = () => {
    pages.push(ops);
    ops = [];
    y = H - M;
  };

  text(opt.title, M, y - 14, true, 16);
  y -= 24;
  for (const s of opt.subtitle ?? []) {
    text(s, M, y - 10, false, 10);
    y -= 14;
  }
  y -= 8;
  header();
  for (const r of opt.rows) {
    if (y - LINE < M + 20) {
      newPage();
      header();
    }
    row(r, false);
    rule(y, 0.9);
  }
  if (opt.footerRows?.length) {
    if (y - LINE * (opt.footerRows.length + 1) < M + 20) {
      newPage();
      header();
    }
    y -= 4;
    rule(y, 0.4);
    for (const r of opt.footerRows) row(r, true);
  }
  pages.push(ops);

  // Monta objetos: 1 catálogo, 2 páginas, 3 Helvetica, 4 Helvetica-Bold, depois (página, conteúdo) por página
  const objs: string[] = [];
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ');
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  pages.forEach((p, i) => {
    const content = [...p, `BT /F1 8 Tf ${W - M - 60} ${M - 16} Td ${lit(`Página ${i + 1} de ${pages.length}`)} Tj ET`].join('\n');
    objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
    objs[6 + i * 2] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  // Latin1: 1 char = 1 byte
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
