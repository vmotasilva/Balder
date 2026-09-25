import type { ExpenseNature, InvoiceNatureItemBreakdown } from '../types';
import Tesseract from 'tesseract.js';

export interface ParsedInvoiceItem {
  id: string;
  description: string;
  originalDate?: string;
  amount: number;
  natureId: string;
  natureName: string;
  confidence: number; // 0 to 1
  matchedKeyword?: string;
  mappingId?: string;
  mappingName?: string;
  installments: number;
  currentInstallment: number;
  finalAmount: number;
  categoryFromBank?: string;
  isIgnored?: boolean;
}

export interface InvoiceImportResult {
  items: ParsedInvoiceItem[];
  totalAmount: number;
  bankName?: string;
  detectedFormat: 'OFX' | 'CSV' | 'TEXT' | 'IMAGE_OCR';
  rawLineCount: number;
}

// Dicionário de conhecimento semântico e inteligência contextual brasileira
const NATURE_KEYWORD_RULES: Record<string, { natureTypes: string[]; keywords: string[] }> = {
  alimentacao: {
    natureTypes: ['alimentação', 'alimentacao', 'mercado', 'refeição', 'refeicao', 'restaurante'],
    keywords: [
      'ifood', 'rappi', 'aiqfome', 'supermercado', 'mercado', 'hipermercado', 'atacadao', 'atacadão',
      'assai', 'assaí', 'carrefour', 'pao de acucar', 'pão de açúcar', 'extra', 'hortifruti', 'feira',
      'padaria', 'panificadora', 'acougue', 'açougue', 'peixaria', 'restaurante', 'lanchonete',
      'mcdonalds', 'mc donalds', 'burger king', 'bk', 'subway', 'habibs', 'spoleto', 'outback',
      'madero', 'coco bambu', 'bar', 'choperia', 'cafe', 'café', 'starbucks', 'cacau show',
      'kopenhagen', 'doceria', 'sorveteria', 'bobs', 'pizza', 'pizzaria', 'churrascaria', 'sushi',
      'temakeria', 'delivery', 'refeicao', 'refeição', 'almoco', 'almoço', 'jantar', 'emporio', 'empório',
      'ze delivery', 'zé delivery', 'adega', 'conveniencia', 'sacolao', 'sacolão',
    ],
  },
  transporte: {
    natureTypes: ['transporte', 'combustível', 'combustivel', 'veículo', 'veiculo', 'carro', 'moto'],
    keywords: [
      'uber', '99app', '99 *', '99tecnologia', 'taxi', 'táxi', 'posto', 'gasolina', 'combustivel',
      'combustível', 'etanol', 'diesel', 'shell', 'ipiranga', 'petrobras', 'br distribuidora', 'ale',
      'sem parar', 'semparar', 'conectcar', 'veloe', 'taggy', 'pedagio', 'pedágio', 'estacionamento',
      'estapar', 'valet', 'auto posto', 'autoposto', 'oficina', 'mecanica', 'mecânica', 'autocenter',
      'pneu', 'ipva', 'detran', 'bilhete unico', 'bilhete único', 'metro', 'metrô', 'cptm', 'onibus',
      'ônibus', 'passagem', 'gol linhas', 'latam', 'azul linhas', 'decolar', 'localiza', 'movida',
      'unidas', 'aluguel de carro', 'troca de oleo', 'troca de óleo', 'revisao veiculo',
    ],
  },
  saude: {
    natureTypes: ['saúde', 'saude', 'farmácia', 'farmacia', 'médico', 'medico', 'hospital'],
    keywords: [
      'farmacia', 'farmácia', 'drogaria', 'drogasil', 'droga raia', 'drogaraia', 'pague menos',
      'drogaria sao paulo', 'panvel', 'araujo', 'extrafarma', 'ultrafarma', 'medico', 'médico',
      'clinica', 'clínica', 'hospital', 'laboratorio', 'laboratório', 'fleury', 'dasa', 'lavoisier',
      'delboni', 'consulta', 'exame', 'dentista', 'odonto', 'oftalmo', 'terapia', 'psicologo',
      'psicólogo', 'fisioterapia', 'remedio', 'remédio', 'medicamento', 'otica', 'ótica',
      'oticas carol', 'chilli beans', 'unimed', 'bradesco saude', 'sulamerica', 'amil', 'notredame',
    ],
  },
  moradia: {
    natureTypes: ['moradia', 'habitação', 'habitacao', 'casa', 'contas', 'fixas'],
    keywords: [
      'aluguel', 'condominio', 'condomínio', 'enel', 'cpfl', 'cemig', 'light', 'energisa', 'copel',
      'sabesp', 'copasa', 'sanepar', 'caesb', 'gas', 'gás', 'comgas', 'comgás', 'ultragaz',
      'supergasbras', 'nacional gas', 'internet', 'claro', 'vivo', 'tim', 'oi fibra', 'leroy merlin',
      'telhanorte', 'c&c', 'marcenaria', 'eletricista', 'encanador', 'dedetizacao', 'limpeza',
      'diarista', 'tok&stok', 'tok stok', 'camicado', 'mobly', 'etna', 'utilidades', 'ferragens',
    ],
  },
  lazer: {
    natureTypes: ['lazer', 'entretenimento', 'diversão', 'diversao', 'jogos', 'streaming'],
    keywords: [
      'cinema', 'cinemark', 'cinepolis', 'cinépolis', 'uciplex', 'ingresso', 'sympla', 'eventim',
      'teatro', 'show', 'steam', 'playstation', 'psn', 'sony interactive', 'xbox', 'microsoft xbox',
      'nintendo', 'epic games', 'riot games', 'blizzard', 'ea games', 'spotify', 'deezer', 'netflix',
      'amazon prime', 'disney plus', 'disney+', 'max', 'hbo max', 'paramount', 'globoplay',
      'apple tv', 'crunchyroll', 'balada', 'pub', 'clube', 'resort', 'hotel', 'pousada', 'airbnb',
      'booking.com', 'viagem', 'turismo', 'parque', 'ingresso.com',
    ],
  },
  servicos: {
    natureTypes: ['serviços', 'servicos', 'assinaturas', 'tecnologia', 'software', 'aplicativos'],
    keywords: [
      'google', 'google storage', 'google workspace', 'apple.com', 'apple', 'icloud', 'chatgpt',
      'openai', 'claude', 'anthropic', 'aws', 'amazon web', 'github', 'adobe', 'microsoft',
      'office 365', 'dropbox', 'notion', 'figma', 'canva', 'godaddy', 'hostgator', 'locaweb',
      'contabilidade', 'advogado', 'cartorio', 'cartório', 'correios', 'melhor envio',
    ],
  },
  educacao: {
    natureTypes: ['educação', 'educacao', 'cursos', 'estudo', 'livros'],
    keywords: [
      'curso', 'faculdade', 'universidade', 'escola', 'colegio', 'colégio', 'pos graduacao',
      'pós graduação', 'mba', 'livraria', 'saraiva', 'leitura', 'cultura', 'amazon livros',
      'udemy', 'coursera', 'alura', 'rocketseat', 'fiap', 'fgv', 'puc', 'idiomas', 'wizard',
      'cna', 'ingles', 'inglês', 'duolingo', 'kumon',
    ],
  },
  vestuario: {
    natureTypes: ['vestuário', 'vestuario', 'roupa', 'moda', 'calçados', 'calcados', 'compras'],
    keywords: [
      'zara', 'renner', 'lojas renner', 'riachuelo', 'c&a', 'cea', 'marisa', 'centauro',
      'decathlon', 'nike', 'adidas', 'puma', 'asics', 'mizuno', 'arezzo', 'anacapri', 'havaianas',
      'hering', 'shein', 'shopee', 'aliexpress', 'mercado livre', 'mercadolivre', 'magalu',
      'magazine luiza', 'casas bahia', 'amazon', 'boticario', 'o boticario', 'natura', 'sephora',
      'barbearia', 'salao de beleza', 'salão de beleza', 'cabelo', 'academia', 'smart fit',
      'bluefit', 'bodytech', 'gympass', 'totalpass',
    ],
  },
  pets: {
    natureTypes: ['pet', 'pets', 'animais', 'veterinário', 'veterinario'],
    keywords: ['petz', 'cobasi', 'pet shop', 'petshop', 'veterinario', 'veterinário', 'vet', 'racao', 'ração'],
  },
  taxas: {
    natureTypes: ['taxas', 'tarifas', 'impostos', 'banco'],
    keywords: ['iof', 'tarifa', 'anuidade', 'juros', 'multa', 'taxa emissao', 'taxa'],
  },
};

/**
 * Remove acentuação e padroniza strings para matching
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Detecta e extrai parcelamento da descrição (ex: "ZARA 02/05", "MAGALU 1/10", "PARC 03/12")
 */
export function extractInstallments(text: string): { installments: number; currentInstallment: number; cleanDescription: string } {
  // Regex para padrões: 02/05, (02/05), 2/5, PARC 2 DE 5, PARCELA 2/5
  const match1 = text.match(/\b0?(\d+)\s*[/]\s*0?(\d+)\b/);
  if (match1) {
    const cur = parseInt(match1[1], 10);
    const tot = parseInt(match1[2], 10);
    if (cur > 0 && tot >= cur && tot <= 72) {
      const clean = text.replace(match1[0], '').replace(/[()]/g, '').trim();
      return {
        currentInstallment: cur,
        installments: tot,
        cleanDescription: clean || text,
      };
    }
  }

  const match2 = text.match(/\bparc(?:ela)?\.?\s*0?(\d+)\s*(?:de|\/)\s*0?(\d+)\b/i);
  if (match2) {
    const cur = parseInt(match2[1], 10);
    const tot = parseInt(match2[2], 10);
    if (cur > 0 && tot >= cur && tot <= 72) {
      const clean = text.replace(match2[0], '').trim();
      return {
        currentInstallment: cur,
        installments: tot,
        cleanDescription: clean || text,
      };
    }
  }

  return {
    installments: 1,
    currentInstallment: 1,
    cleanDescription: text,
  };
}

/**
 * Algoritmo inteligente que associa uma transação da fatura à Natureza correta
 */
export function matchNatureForTransaction(
  description: string,
  categoryFromBank: string | undefined,
  natures: ExpenseNature[]
): {
  natureId: string;
  natureName: string;
  confidence: number;
  matchedKeyword?: string;
  mappingId?: string;
  mappingName?: string;
} {
  const normDesc = normalizeText(description);
  const normBankCat = categoryFromBank ? normalizeText(categoryFromBank) : '';

  // 0. PRIORIDADE MÁXIMA: Palavras-chave personalizadas cadastradas pelo usuário
  // 0.1 Palavras-chave nos Mapeamentos / Rotinas (vínculo específico de natureza + rotina)
  for (const nat of natures) {
    if (nat.mappings && Array.isArray(nat.mappings)) {
      for (const map of nat.mappings) {
        if (map.keywords && Array.isArray(map.keywords)) {
          for (const kw of map.keywords) {
            const normKw = normalizeText(kw);
            if (
              normKw.length >= 2 &&
              (normDesc.includes(normKw) || (normBankCat && normBankCat.includes(normKw)))
            ) {
              return {
                natureId: nat.id,
                natureName: nat.name,
                confidence: 0.99,
                matchedKeyword: kw,
                mappingId: map.id,
                mappingName: map.name,
              };
            }
          }
        }
      }
    }
  }

  // 0.2 Palavras-chave cadastradas diretamente na Natureza
  for (const nat of natures) {
    if (nat.keywords && Array.isArray(nat.keywords)) {
      for (const kw of nat.keywords) {
        const normKw = normalizeText(kw);
        if (
          normKw.length >= 2 &&
          (normDesc.includes(normKw) || (normBankCat && normBankCat.includes(normKw)))
        ) {
          return {
            natureId: nat.id,
            natureName: nat.name,
            confidence: 0.98,
            matchedKeyword: kw,
          };
        }
      }
    }
  }

  // 1. Procurar combinação direta com o nome das naturezas do usuário
  for (const nat of natures) {
    const normNatName = normalizeText(nat.name);
    if (normNatName.length > 2 && normDesc.includes(normNatName)) {
      return {
        natureId: nat.id,
        natureName: nat.name,
        confidence: 0.95,
        matchedKeyword: nat.name,
      };
    }
    if (normBankCat && normNatName.includes(normBankCat)) {
      return {
        natureId: nat.id,
        natureName: nat.name,
        confidence: 0.9,
        matchedKeyword: categoryFromBank,
      };
    }
  }

  // 2. Procurar através do mapa de regras semânticas
  for (const rule of Object.values(NATURE_KEYWORD_RULES)) {
    // Verificar se a descrição contém uma palavra-chave conhecida
    const matchedKw = rule.keywords.find((kw) => {
      const regex = new RegExp(`\\b${kw}\\b|${kw}`, 'i');
      return regex.test(normDesc);
    });

    const bankCategoryMatch = normBankCat && rule.natureTypes.some((nt) => normBankCat.includes(nt));

    if (matchedKw || bankCategoryMatch) {
      // Localizar no Balder a natureza que melhor se adequa a esse grupo
      const candidateNature = natures.find((nat) => {
        const natNorm = normalizeText(nat.name);
        return rule.natureTypes.some((nt) => natNorm.includes(nt));
      });

      if (candidateNature) {
        return {
          natureId: candidateNature.id,
          natureName: candidateNature.name,
          confidence: matchedKw ? 0.9 : 0.8,
          matchedKeyword: matchedKw || categoryFromBank,
        };
      }
    }
  }

  // 3. Fallback inteligente: se for pagamento de fatura ou crédito
  if (normDesc.includes('pagamento') || normDesc.includes('estorno') || normDesc.includes('credito') || normDesc.includes('crédito')) {
    return {
      natureId: 'OUTROS',
      natureName: 'Outros (Pagamento/Ajuste)',
      confidence: 0.95,
      matchedKeyword: 'pagamento',
    };
  }

  // 4. Se não encontrar nenhuma correspondência específica, direciona para "Outros"
  return {
    natureId: 'OUTROS',
    natureName: 'Outros',
    confidence: 0.3,
  };
}

/**
 * Converte valor em formato string (R$, vírgula ou ponto) em número positivo
 */
export function parseAmount(valStr: string): number {
  const clean = valStr.replace(/[R$\s]/g, '').trim();
  if (!clean) return 0;

  let num = 0;
  if (clean.includes('.') && clean.includes(',')) {
    // 1.234,56
    num = parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0;
  } else if (clean.includes(',')) {
    // 1234,56
    num = parseFloat(clean.replace(',', '.')) || 0;
  } else {
    // 1234.56
    num = parseFloat(clean) || 0;
  }

  return Math.abs(num);
}

/**
 * Parser para arquivos OFX (Open Financial Exchange)
 */
export function parseOFXInvoice(content: string, natures: ExpenseNature[]): InvoiceImportResult {
  const items: ParsedInvoiceItem[] = [];
  const lines = content.split('\n');

  // Regex para tags OFX
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;

  // Extrair banco se disponível
  let bankName = 'Cartão';
  const orgMatch = content.match(/<ORG>([^<\r\n]+)/i);
  if (orgMatch) bankName = orgMatch[1].trim();

  // Tentar casamento por blocos <STMTTRN>
  const blocks = content.match(trnRegex) || [];

  if (blocks.length > 0) {
    blocks.forEach((block, idx) => {
      const amtMatch = block.match(/<TRNAMT>([^<\r\n]+)/i);
      const nameMatch = block.match(/<NAME>([^<\r\n]+)/i) || block.match(/<MEMO>([^<\r\n]+)/i);
      const dateMatch = block.match(/<DTPOSTED>([^<\r\n]+)/i);

      if (amtMatch && nameMatch) {
        const rawAmt = parseFloat(amtMatch[1].trim()) || 0;
        const rawName = nameMatch[1].trim();
        const dateStr = dateMatch ? dateMatch[1].trim().substring(0, 8) : undefined;

        // No OFX de cartão, compras costumam vir com valor negativo (-XX.XX) ou positivo dependendo do emissor
        // Compras são despesas da fatura. Pagamentos costumam ter 'pagamento' ou sinal oposto
        const isPayment = rawName.toLowerCase().includes('pagamento') || rawName.toLowerCase().includes('pgto');
        const absAmount = Math.abs(rawAmt);

        if (absAmount > 0 && !isPayment) {
          const { installments, currentInstallment, cleanDescription } = extractInstallments(rawName);
          const natureMatch = matchNatureForTransaction(cleanDescription, undefined, natures);

          items.push({
            id: `ofx_${Date.now()}_${idx}`,
            description: cleanDescription,
            originalDate: dateStr,
            amount: Math.round(absAmount * 100) / 100,
            natureId: natureMatch.natureId,
            natureName: natureMatch.natureName,
            mappingId: natureMatch.mappingId,
            mappingName: natureMatch.mappingName,
            confidence: natureMatch.confidence,
            matchedKeyword: natureMatch.matchedKeyword,
            installments,
            currentInstallment,
            finalAmount: Math.round(absAmount * installments * 100) / 100,
          });
        }
      }
    });
  } else {
    // Fallback: busca por tags em linhas avulsas caso o OFX seja SGML sem fechamento de tag
    let currentDesc = '';
    let currentAmt = 0;
    let currentDate = '';

    for (const line of lines) {
      if (line.includes('<TRNAMT>')) {
        const m = line.match(/<TRNAMT>([^<\r\n]+)/i);
        if (m) currentAmt = parseFloat(m[1].trim()) || 0;
      } else if (line.includes('<NAME>') || line.includes('<MEMO>')) {
        const m = line.match(/<(?:NAME|MEMO)>([^<\r\n]+)/i);
        if (m) currentDesc = m[1].trim();
      } else if (line.includes('<DTPOSTED>')) {
        const m = line.match(/<DTPOSTED>([^<\r\n]+)/i);
        if (m) currentDate = m[1].trim().substring(0, 8);
      }

      if (currentDesc && currentAmt !== 0) {
        const isPayment = currentDesc.toLowerCase().includes('pagamento') || currentDesc.toLowerCase().includes('pgto');
        const absAmount = Math.abs(currentAmt);

        if (absAmount > 0 && !isPayment) {
          const { installments, currentInstallment, cleanDescription } = extractInstallments(currentDesc);
          const natureMatch = matchNatureForTransaction(cleanDescription, undefined, natures);

          items.push({
            id: `ofx_line_${Date.now()}_${items.length}`,
            description: cleanDescription,
            originalDate: currentDate,
            amount: Math.round(absAmount * 100) / 100,
            natureId: natureMatch.natureId,
            natureName: natureMatch.natureName,
            mappingId: natureMatch.mappingId,
            mappingName: natureMatch.mappingName,
            confidence: natureMatch.confidence,
            matchedKeyword: natureMatch.matchedKeyword,
            installments,
            currentInstallment,
            finalAmount: Math.round(absAmount * installments * 100) / 100,
          });
        }
        currentDesc = '';
        currentAmt = 0;
      }
    }
  }

  const totalAmount = items.reduce((acc, i) => acc + i.amount, 0);

  return {
    items,
    totalAmount: Math.round(totalAmount * 100) / 100,
    bankName,
    detectedFormat: 'OFX',
    rawLineCount: lines.length,
  };
}

/**
 * Parser para arquivos CSV / TSV de Fatura de Cartão (ex: Nubank, Itaú, Inter, etc.)
 */
export function parseCSVInvoice(content: string, natures: ExpenseNature[]): InvoiceImportResult {
  const items: ParsedInvoiceItem[] = [];
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { items: [], totalAmount: 0, detectedFormat: 'CSV', rawLineCount: 0 };
  }

  // Detectar delimitador (, ; ou \t)
  const firstLine = lines[0];
  let delimiter = ',';
  if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) {
    delimiter = ';';
  } else if ((firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length) {
    delimiter = '\t';
  }

  // Cabeçalho
  const headerParts = firstLine.split(delimiter).map((h) => normalizeText(h));
  let dateIdx = headerParts.findIndex((h) => h.includes('date') || h.includes('data'));
  let descIdx = headerParts.findIndex(
    (h) => h.includes('title') || h.includes('titulo') || h.includes('desc') || h.includes('historico') || h.includes('estabelecimento')
  );
  let amtIdx = headerParts.findIndex(
    (h) => h.includes('amount') || h.includes('valor') || h.includes('quantia')
  );
  let catIdx = headerParts.findIndex(
    (h) => h.includes('category') || h.includes('categoria')
  );

  // Se não encontrou índices por cabeçalho, tenta inferir posicionalmente
  const startIndex = (dateIdx >= 0 || descIdx >= 0 || amtIdx >= 0) ? 1 : 0;
  if (dateIdx < 0) dateIdx = 0;
  if (descIdx < 0) descIdx = 1;
  if (amtIdx < 0) amtIdx = headerParts.length > 2 ? headerParts.length - 1 : 2;

  let bankName = 'Cartão';
  if (content.toLowerCase().includes('nubank')) bankName = 'Nubank';
  else if (content.toLowerCase().includes('itau') || content.toLowerCase().includes('itaú')) bankName = 'Itaú';
  else if (content.toLowerCase().includes('inter')) bankName = 'Banco Inter';
  else if (content.toLowerCase().includes('santander')) bankName = 'Santander';

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map((p) => p.replace(/^["']|["']$/g, '').trim());
    if (parts.length < 2) continue;

    const rawDesc = parts[descIdx] || parts[1] || '';
    const rawAmt = parts[amtIdx] || parts[parts.length - 1] || '';
    const rawCat = catIdx >= 0 ? parts[catIdx] : undefined;
    const rawDate = dateIdx >= 0 ? parts[dateIdx] : undefined;

    if (!rawDesc) continue;

    // Ignorar linhas de pagamento da fatura
    const norm = normalizeText(rawDesc);
    if (norm.includes('pagamento recebido') || norm.includes('pagamento de fatura') || norm.includes('estorno')) {
      continue;
    }

    const amount = parseAmount(rawAmt);
    if (amount <= 0) continue;

    const { installments, currentInstallment, cleanDescription } = extractInstallments(rawDesc);
    const natureMatch = matchNatureForTransaction(cleanDescription, rawCat, natures);

    items.push({
      id: `csv_${Date.now()}_${i}`,
      description: cleanDescription,
      originalDate: rawDate,
      amount: Math.round(amount * 100) / 100,
      natureId: natureMatch.natureId,
      natureName: natureMatch.natureName,
      mappingId: natureMatch.mappingId,
      mappingName: natureMatch.mappingName,
      confidence: natureMatch.confidence,
      matchedKeyword: natureMatch.matchedKeyword,
      installments,
      currentInstallment,
      finalAmount: Math.round(amount * installments * 100) / 100,
      categoryFromBank: rawCat,
    });
  }

  const totalAmount = items.reduce((acc, i) => acc + i.amount, 0);

  return {
    items,
    totalAmount: Math.round(totalAmount * 100) / 100,
    bankName,
    detectedFormat: 'CSV',
    rawLineCount: lines.length,
  };
}

/**
 * Parser para linhas de texto livre ou cópia de fatura da internet banking
 */
export function parseRawTextInvoice(content: string, natures: ExpenseNature[]): InvoiceImportResult {
  const items: ParsedInvoiceItem[] = [];
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  // Regex para linhas típicas:
  // "10/09/2026 IFOOD *RESTAURANTE R$ 58,90"
  // "05/09 UBER TRIP 24,50"
  // "SUPERMERCADO CARREFOUR 350.00"
  const linePattern = /(?:(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\s+)?(.+?)\s+(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{2}))$/i;

  lines.forEach((line, idx) => {
    // Ignorar cabeçalhos e totais
    const norm = normalizeText(line);
    if (norm.includes('total da fatura') || norm.includes('pagamento minimo') || norm.includes('vencimento') || norm.includes('saldo anterior')) {
      return;
    }

    const match = line.match(linePattern);
    if (match) {
      const rawDate = match[1];
      const rawDesc = match[2].trim();
      const rawVal = match[3];

      if (rawDesc.length >= 2) {
        const amount = parseAmount(rawVal);
        if (amount > 0) {
          const { installments, currentInstallment, cleanDescription } = extractInstallments(rawDesc);
          const natureMatch = matchNatureForTransaction(cleanDescription, undefined, natures);

          items.push({
            id: `text_${Date.now()}_${idx}`,
            description: cleanDescription,
            originalDate: rawDate,
            amount: Math.round(amount * 100) / 100,
            natureId: natureMatch.natureId,
            natureName: natureMatch.natureName,
            mappingId: natureMatch.mappingId,
            mappingName: natureMatch.mappingName,
            confidence: natureMatch.confidence,
            matchedKeyword: natureMatch.matchedKeyword,
            installments,
            currentInstallment,
            finalAmount: Math.round(amount * installments * 100) / 100,
          });
        }
      }
    }
  });

  const totalAmount = items.reduce((acc, i) => acc + i.amount, 0);

  return {
    items,
    totalAmount: Math.round(totalAmount * 100) / 100,
    detectedFormat: 'TEXT',
    rawLineCount: lines.length,
  };
}

/**
 * Parser de Imagem da Fatura usando OCR (Tesseract.js)
 */
export async function parseImageInvoiceOCR(
  file: File,
  natures: ExpenseNature[],
  onProgress?: (progress: number, status: string) => void
): Promise<InvoiceImportResult> {
  const imageUrl = URL.createObjectURL(file);

  try {
    if (onProgress) onProgress(10, 'Iniciando reconhecimento ótico (OCR)...');

    const result = await Tesseract.recognize(imageUrl, 'por+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const pct = Math.round((m.progress || 0) * 80) + 15;
          onProgress(pct, `Lendo linhas da fatura (${Math.round((m.progress || 0) * 100)}%)...`);
        }
      },
    });

    if (onProgress) onProgress(95, 'Interpretando naturezas financeiras...');

    const text = result.data.text || '';
    const parsed = parseRawTextInvoice(text, natures);

    return {
      ...parsed,
      detectedFormat: 'IMAGE_OCR',
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

/**
 * Função Universal para ler qualquer arquivo (OFX, CSV, TXT, Imagem)
 */
export async function parseInvoiceFile(
  file: File,
  natures: ExpenseNature[],
  onProgress?: (progress: number, status: string) => void
): Promise<InvoiceImportResult> {
  const fileName = file.name.toLowerCase();

  // 1. OFX
  if (fileName.endsWith('.ofx') || fileName.endsWith('.ox')) {
    if (onProgress) onProgress(30, 'Lendo arquivo bancário OFX...');
    const text = await file.text();
    return parseOFXInvoice(text, natures);
  }

  // 2. CSV ou TSV
  if (fileName.endsWith('.csv') || fileName.endsWith('.tsv')) {
    if (onProgress) onProgress(30, 'Lendo planilha CSV da fatura...');
    const text = await file.text();
    return parseCSVInvoice(text, natures);
  }

  // 3. Imagem (PNG, JPG, JPEG, WEBP)
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(fileName)) {
    return parseImageInvoiceOCR(file, natures, onProgress);
  }

  // 4. Texto puro ou PDF lido como texto
  if (onProgress) onProgress(30, 'Lendo arquivo de texto...');
  const text = await file.text();

  // Se o conteúdo tiver tags OFX mesmo sem extensão .ofx
  if (text.includes('<OFX>') || text.includes('<STMTTRN>')) {
    return parseOFXInvoice(text, natures);
  }

  // Se parecer CSV
  if (text.includes(',') || text.includes(';')) {
    const csvResult = parseCSVInvoice(text, natures);
    if (csvResult.items.length > 0) return csvResult;
  }

  return parseRawTextInvoice(text, natures);
}

/**
 * Converte ParsedInvoiceItem para o formato oficial InvoiceNatureItemBreakdown do Balder
 */
export function convertToBreakdownItems(items: ParsedInvoiceItem[]): InvoiceNatureItemBreakdown[] {
  return items.map((item) => ({
    id: `breakdown_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    natureId: item.natureId,
    natureName: item.natureName,
    mappingId: item.mappingId || 'OUTROS',
    description: item.installments > 1
      ? `${item.description} (${item.currentInstallment}/${item.installments})`
      : item.description,
    amount: item.amount,
    isAnalyzed: true,
    installments: item.installments,
    currentInstallment: item.currentInstallment,
    finalAmount: item.finalAmount,
  }));
}
