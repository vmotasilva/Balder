import Tesseract from 'tesseract.js';
import type { ReceiptItemLine } from '../types';
import { matchItemToLearnedRecord } from './receiptMemoryService';

export interface OCRResult {
  success: boolean;
  rawText: string;
  detectedStore: string;
  detectedCategory: string;
  detectedAmount: number;
  detectedAmountFormatted: string;
  isEstimatedAmount: boolean;
  detectedDate: string;
  detectedItems: string[];
  receiptItemLines: ReceiptItemLine[];
  suggestedPaymentMethod: 'CARTAO' | 'DEBITO' | 'DINHEIRO' | 'PIX';
  cashPaid?: number;
  changeAmount?: number;
  confidenceText: string;
  natureId: string;
  notes?: string;
}

/**
 * Pré-processa a imagem em um Canvas HTML5 para otimizar legibilidade do Tesseract
 */
export async function preprocessImageForOCR(imageUrl: string): Promise<{ processedUrl: string; dominantFeiraHue: boolean }> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!imageUrl.startsWith('data:')) {
      img.crossOrigin = 'Anonymous';
    }

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve({ processedUrl: imageUrl, dominantFeiraHue: false });
          return;
        }

        const targetWidth = Math.min(Math.max(img.width, 1200), 1800);
        const scale = targetWidth / img.width;
        const targetHeight = Math.round(img.height * scale);

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const d = imgData.data;
        let organicTonesCount = 0;
        const sampleStep = 16;

        const contrast = 1.25;
        const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));

        for (let i = 0; i < d.length; i += 4 * sampleStep) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];

          if ((g > r * 1.15 && g > b * 1.2 && g > 60) || (r > 160 && g > 110 && b < 80) || (r > 170 && g < 90 && b < 90)) {
            organicTonesCount++;
          }

          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));

          d[i] = adjusted;
          d[i + 1] = adjusted;
          d[i + 2] = adjusted;
        }

        const dominantFeiraHue = organicTonesCount > (d.length / (4 * sampleStep)) * 0.06;

        ctx.putImageData(imgData, 0, 0);
        resolve({
          processedUrl: canvas.toDataURL('image/jpeg', 0.94),
          dominantFeiraHue,
        });
      } catch (err) {
        console.warn('Pré-processamento de imagem em canvas falhou:', err);
        resolve({ processedUrl: imageUrl, dominantFeiraHue: false });
      }
    };

    img.onerror = () => {
      resolve({ processedUrl: imageUrl, dominantFeiraHue: false });
    };

    img.src = imageUrl;
  });
}

const MONEY_RE = /\d{1,3}(?:\.\d{3})+,\d{2}(?!\d)|\d{1,6}[.,]\d{2}(?!\d)/g;
const QTY_RE = /(\d+[.,]\d{1,3})\s*(un|kg|g|l|ml|pc|cx)\b/i;
const NOT_ITEM_RE =
  /total|pagar|pago|troco|dinheiro|cnpj|cupom|itens|desconto|d[eé]bito|cr[eé]dito|cart[aã]o|pix|tribut|imposto|icms|consumidor|chave|protocolo|nota fiscal|acr[eé]scimo|forma de pag/i;

function parseMoney(token: string): number {
  const n = token.includes(',') ? token.replace(/\./g, '').replace(',', '.') : token;
  const v = parseFloat(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function moneyIn(line: string): number[] {
  return (line.match(MONEY_RE) || []).map(parseMoney);
}

function toTitle(s: string): string {
  return s.toLowerCase().replace(/(^|\s)(\S)/g, (_, sp, ch) => sp + ch.toUpperCase());
}

function detectStore(lines: string[]): string {
  const company = lines.find((l) => /\b(ltda|eireli|epp|s\/?a|me)\b/i.test(l) && /[A-Za-zÀ-ÿ]{3}/.test(l));
  const line = company || lines.find((l) => (l.match(/[A-Za-zÀ-ÿ]/g) || []).length >= 6);
  if (!line) return 'Cupom Fiscal';
  const name = line.replace(/\b(ltda|eireli|epp)\b\.?/gi, '').replace(/[^A-Za-zÀ-ÿ0-9&.\- ]/g, ' ').replace(/\s+/g, ' ').trim();
  return name.length >= 3 ? toTitle(name) : 'Cupom Fiscal';
}

function detectDate(text: string): string {
  const m = text.match(/\b(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\b/);
  if (m) {
    const [, d, mo, y] = m;
    if (+mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31 && +y >= 2000) return `${y}-${mo}-${d}`;
  }
  return new Date().toISOString().split('T')[0];
}

function detectPayment(text: string): OCRResult['suggestedPaymentMethod'] {
  const t = text.toLowerCase();
  if (/d[eé]bito/.test(t)) return 'DEBITO';
  if (/cr[eé]dito/.test(t)) return 'CARTAO';
  if (/\bpix\b/.test(t)) return 'PIX';
  if (/dinheiro/.test(t)) return 'DINHEIRO';
  return 'DEBITO';
}

function detectTotal(lines: string[]): number {
  const rules: [RegExp, number][] = [
    [/a\s*pagar/i, 3],
    [/valor\s*pago/i, 2],
    [/valor\s*total|^total/i, 1],
  ];
  let best = 0;
  let bestScore = 0;
  for (const line of lines) {
    const values = moneyIn(line);
    if (!values.length) continue;
    const value = values[values.length - 1];
    for (const [re, score] of rules) {
      if (re.test(line) && value > 0 && score > bestScore) {
        best = value;
        bestScore = score;
      }
    }
  }
  return best;
}

/**
 * Interpreta o texto bruto do OCR de um cupom fiscal (NFC-e): loja, data, itens, total e forma de pagamento.
 * Só usa o que foi lido da imagem; sem dados de exemplo.
 */
export function parseReceiptText(text: string, _userText?: string): OCRResult {
  const clean = text || '';
  const lines = clean
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const detectedStore = detectStore(lines);
  const detectedDate = detectDate(clean);
  const suggestedPaymentMethod = detectPayment(clean);

  const receiptItemLines: ReceiptItemLine[] = [];
  const stamp = Date.now();
  for (const line of lines) {
    if (NOT_ITEM_RE.test(line)) continue;
    const prices = moneyIn(line);
    if (!prices.length || prices[prices.length - 1] <= 0) continue;

    const qtyMatch = line.match(QTY_RE);
    const head = line
      .replace(/^\d{3,14}\s+/, '')
      .slice(0, qtyMatch ? line.replace(/^\d{3,14}\s+/, '').indexOf(qtyMatch[0]) : undefined)
      .replace(MONEY_RE, ' ')
      .replace(/[^A-Za-zÀ-ÿ0-9\/.\- ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if ((head.match(/[A-Za-zÀ-ÿ]/g) || []).length < 3) continue;

    const rawName = head;
    const learned = matchItemToLearnedRecord(rawName);
    receiptItemLines.push({
      id: `item_rec_${receiptItemLines.length}_${stamp}`,
      rawName,
      detectedName: rawName,
      price: prices[prices.length - 1],
      quantity: qtyMatch ? parseFloat(qtyMatch[1].replace(',', '.')) : undefined,
      unit: qtyMatch ? qtyMatch[2].toLowerCase() : undefined,
      matchedMappingItemId: learned?.mappingItemId,
      targetMappingId: learned?.targetMappingId,
      natureId: learned?.natureId,
      isNewSuggestedItem: !learned?.mappingItemId,
    });
  }

  const itemsSum = Math.round(receiptItemLines.reduce((acc, it) => acc + it.price, 0) * 100) / 100;
  const detectedAmount = detectTotal(lines) || itemsSum;

  // Total lido mas itens não: uma linha única, para o usuário poder conciliar mesmo assim
  if (receiptItemLines.length === 0 && detectedAmount > 0) {
    receiptItemLines.push({
      id: `item_rec_0_${stamp}`,
      rawName: `Compra em ${detectedStore}`,
      detectedName: `Compra em ${detectedStore}`,
      price: detectedAmount,
      isNewSuggestedItem: true,
    });
  }

  const troco = lines.map((l) => (/troco/i.test(l) ? moneyIn(l).pop() : undefined)).find((v) => v);
  const isCash = suggestedPaymentMethod === 'DINHEIRO';

  return {
    success: detectedAmount > 0,
    rawText: clean,
    detectedStore,
    detectedCategory: '',
    detectedAmount,
    detectedAmountFormatted: detectedAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    isEstimatedAmount: !detectTotal(lines),
    detectedDate,
    detectedItems: receiptItemLines.map((it) => it.detectedName),
    receiptItemLines,
    suggestedPaymentMethod,
    cashPaid: isCash && troco ? Math.round((detectedAmount + troco) * 100) / 100 : undefined,
    changeAmount: isCash ? troco : undefined,
    confidenceText: itemsSum && Math.abs(itemsSum - detectedAmount) < 0.01 ? 'Alta (itens batem com o total)' : 'Revise os valores',
    natureId: '',
  };
}

/**
 * Executa o reconhecimento OCR completo na imagem
 */
export async function recognizeImageOCR(imageUrl: string, userText?: string): Promise<OCRResult> {
  let ocrExtractedText = '';

  try {
    const { processedUrl } = await preprocessImageForOCR(imageUrl);

    const ocrPromise = (async () => {
      try {
        const result = await Tesseract.recognize(processedUrl, 'por+eng', {
          logger: () => {},
        });
        return result?.data?.text || '';
      } catch (e) {
        console.warn('Tesseract OCR erro interno:', e);
        return '';
      }
    })();

    const timeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve(''), 60000);
    });

    ocrExtractedText = await Promise.race([ocrPromise, timeoutPromise]);
  } catch (err) {
    console.warn('Erro ao processar imagem:', err);
  }

  return parseReceiptText(ocrExtractedText, userText);
}
