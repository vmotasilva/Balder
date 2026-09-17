export interface PriceObservation {
  id: string;
  itemName: string;
  normalizedName: string;
  store: string;
  unitPrice: number;
  totalPaid: number;
  quantity: number;
  date: string;
  routineName?: string;
}

export interface StorePriceComparison {
  itemName: string;
  currentPrice: number;
  currentStore: string;
  cheapest: { store: string; unitPrice: number; date: string } | null;
  mostExpensive: { store: string; unitPrice: number; date: string } | null;
  priceSpreadPercent: number;
  savingsVsCheapest: number;
  recommendation: string;
  observations: PriceObservation[];
}

const STORAGE_KEY = 'balder_item_price_history';

// Dados base realistas de comparação entre mercados e feiras para os itens
const DEFAULT_OBSERVATIONS: PriceObservation[] = [
  // Snacks e Lanches de Luísa
  { id: 'po_1', itemName: 'Snack Equilibri Panetini Tomate', normalizedName: 'equilibri panetini tomate', store: 'Assaí Atacadista', unitPrice: 3.29, totalPaid: 3.29, quantity: 1, date: '02/09/2026', routineName: 'Lanche de Luísa' },
  { id: 'po_2', itemName: 'Snack Equilibri Panetini Tomate', normalizedName: 'equilibri panetini tomate', store: 'Supermercado São Roque', unitPrice: 3.99, totalPaid: 3.99, quantity: 1, date: '14/09/2026', routineName: 'Lanche de Luísa' },
  { id: 'po_3', itemName: 'Snack Equilibri Panetini Tomate', normalizedName: 'equilibri panetini tomate', store: 'Carrefour Bairro', unitPrice: 4.29, totalPaid: 4.29, quantity: 1, date: '28/08/2026', routineName: 'Lanche de Luísa' },

  { id: 'po_4', itemName: 'Biscoito Mucilon Lanchinho', normalizedName: 'mucilon lanchinho', store: 'Assaí Atacadista', unitPrice: 4.99, totalPaid: 9.98, quantity: 2, date: '02/09/2026', routineName: 'Lanche de Luísa' },
  { id: 'po_5', itemName: 'Biscoito Mucilon Lanchinho', normalizedName: 'mucilon lanchinho', store: 'Supermercado São Roque', unitPrice: 5.99, totalPaid: 11.98, quantity: 2, date: '14/09/2026', routineName: 'Lanche de Luísa' },

  { id: 'po_6', itemName: 'Bolinho Bauducco Baunilha', normalizedName: 'bolinho bauducco baunilha', store: 'Atacadão', unitPrice: 1.79, totalPaid: 3.58, quantity: 2, date: '01/09/2026', routineName: 'Lanche de Luísa' },
  { id: 'po_7', itemName: 'Bolinho Bauducco Baunilha', normalizedName: 'bolinho bauducco baunilha', store: 'Supermercado São Roque', unitPrice: 2.19, totalPaid: 4.38, quantity: 2, date: '14/09/2026', routineName: 'Lanche de Luísa' },

  // Bebidas e Laticínios
  { id: 'po_8', itemName: 'Bebida Láctea Nescau Choc 1 Litro', normalizedName: 'nescau choc', store: 'Assaí Atacadista', unitPrice: 13.90, totalPaid: 13.90, quantity: 1, date: '02/09/2026', routineName: 'Supermercado Base' },
  { id: 'po_9', itemName: 'Bebida Láctea Nescau Choc 1 Litro', normalizedName: 'nescau choc', store: 'Supermercado São Roque', unitPrice: 15.59, totalPaid: 15.59, quantity: 1, date: '14/09/2026', routineName: 'Supermercado Base' },

  // Frutas e Hortifrúti (Comparativo Feira Livre vs Supermercado)
  { id: 'po_10', itemName: 'Melancia Inteira / Pedaço', normalizedName: 'melancia', store: 'Feira Livre Municipal', unitPrice: 18.00, totalPaid: 18.00, quantity: 1, date: '06/09/2026', routineName: 'Feira Livre' },
  { id: 'po_11', itemName: 'Melancia Inteira / Pedaço', normalizedName: 'melancia', store: 'Supermercado São Roque', unitPrice: 26.50, totalPaid: 26.50, quantity: 1, date: '14/09/2026', routineName: 'Feira Livre' },

  { id: 'po_12', itemName: 'Tomate Italiano Selecionado (kg)', normalizedName: 'tomate', store: 'Feira Livre Municipal', unitPrice: 5.80, totalPaid: 11.60, quantity: 2, date: '06/09/2026', routineName: 'Feira Livre' },
  { id: 'po_13', itemName: 'Tomate Italiano Selecionado (kg)', normalizedName: 'tomate', store: 'Supermercado São Roque', unitPrice: 8.90, totalPaid: 17.80, quantity: 2, date: '14/09/2026', routineName: 'Feira Livre' },

  { id: 'po_14', itemName: 'Banana Prata da Estação (kg)', normalizedName: 'banana', store: 'Feira Livre Municipal', unitPrice: 5.50, totalPaid: 11.00, quantity: 2, date: '06/09/2026', routineName: 'Feira Livre' },
  { id: 'po_15', itemName: 'Banana Prata da Estação (kg)', normalizedName: 'banana', store: 'Supermercado São Roque', unitPrice: 7.80, totalPaid: 15.60, quantity: 2, date: '14/09/2026', routineName: 'Feira Livre' },

  // Carnes e Proteínas
  { id: 'po_16', itemName: 'Peito de Frango & Filé de Coxa (kg)', normalizedName: 'peito de frango', store: 'Assaí Atacadista', unitPrice: 22.90, totalPaid: 91.60, quantity: 4, date: '30/08/2026', routineName: 'Açougue' },
  { id: 'po_17', itemName: 'Peito de Frango & Filé de Coxa (kg)', normalizedName: 'peito de frango', store: 'Supermercado São Roque', unitPrice: 26.00, totalPaid: 104.00, quantity: 4, date: '14/09/2026', routineName: 'Açougue' },
];

function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getAllPriceObservations(): PriceObservation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_OBSERVATIONS;
    const custom: PriceObservation[] = JSON.parse(raw);
    return Array.isArray(custom) ? [...DEFAULT_OBSERVATIONS, ...custom] : DEFAULT_OBSERVATIONS;
  } catch {
    return DEFAULT_OBSERVATIONS;
  }
}

export function savePriceObservation(obs: Omit<PriceObservation, 'id' | 'normalizedName'>): PriceObservation {
  const normalized = normalize(obs.itemName);
  const newObs: PriceObservation = {
    ...obs,
    id: `po_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    normalizedName: normalized,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const custom: PriceObservation[] = raw ? JSON.parse(raw) : [];
    custom.push(newObs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  } catch (err) {
    console.warn('Falha ao salvar observação de preço:', err);
  }

  return newObs;
}

export function recordReceiptPrices(
  store: string,
  date: string,
  items: Array<{ detectedName: string; price: number; quantity?: number; routineName?: string }>
) {
  if (!items || items.length === 0) return;

  items.forEach((it) => {
    const qty = it.quantity && it.quantity > 0 ? it.quantity : 1;
    const unitPrice = Math.round((it.price / qty) * 100) / 100;

    savePriceObservation({
      itemName: it.detectedName,
      store: store || 'Supermercado',
      unitPrice,
      totalPaid: it.price,
      quantity: qty,
      date: date || new Date().toLocaleDateString('pt-BR'),
      routineName: it.routineName,
    });
  });
}

export function compareItemPrices(
  itemName: string,
  currentPrice?: number,
  currentStore?: string
): StorePriceComparison | null {
  if (!itemName) return null;
  const cleanKey = normalize(itemName);
  const all = getAllPriceObservations();

  // Filtrar observações que contenham a palavra chave ou parte significativa
  const keywords = cleanKey.split(' ').filter((w) => w.length > 3);
  const matched = all.filter((obs) => {
    if (obs.normalizedName.includes(cleanKey) || cleanKey.includes(obs.normalizedName)) return true;
    if (keywords.length > 0) {
      const matchCount = keywords.filter((kw) => obs.normalizedName.includes(kw)).length;
      return matchCount >= Math.min(2, keywords.length);
    }
    return false;
  });

  // Se o preço e loja atual foram informados, adicionar como observação temporária para comparação
  const effectiveObservations = [...matched];
  if (currentPrice !== undefined && currentPrice > 0 && currentStore) {
    const alreadyPresent = effectiveObservations.some(
      (o) => o.store.toLowerCase() === currentStore.toLowerCase() && o.unitPrice === currentPrice
    );
    if (!alreadyPresent) {
      effectiveObservations.push({
        id: 'current_obs',
        itemName,
        normalizedName: cleanKey,
        store: currentStore,
        unitPrice: currentPrice,
        totalPaid: currentPrice,
        quantity: 1,
        date: 'Compra Atual',
      });
    }
  }

  if (effectiveObservations.length === 0) return null;

  // Ordenar por menor preço
  const sorted = [...effectiveObservations].sort((a, b) => a.unitPrice - b.unitPrice);
  const cheapest = sorted[0];
  const mostExpensive = sorted[sorted.length - 1];

  const effectiveCurrentPrice = currentPrice || cheapest.unitPrice;
  const effectiveCurrentStore = currentStore || cheapest.store;

  const priceSpreadPercent =
    cheapest.unitPrice > 0
      ? Math.round(((mostExpensive.unitPrice - cheapest.unitPrice) / cheapest.unitPrice) * 100)
      : 0;

  const savingsVsCheapest = Math.round((effectiveCurrentPrice - cheapest.unitPrice) * 100) / 100;

  let recommendation = '';
  if (cheapest.store.toLowerCase() === effectiveCurrentStore.toLowerCase()) {
    recommendation = `Excelente escolha! ${effectiveCurrentStore} é onde você pagou o menor preço histórico (R$ ${cheapest.unitPrice.toFixed(2)}).`;
  } else if (savingsVsCheapest > 0) {
    recommendation = `Melhor comprar no(a) ${cheapest.store}: custa R$ ${cheapest.unitPrice.toFixed(2)} vs R$ ${effectiveCurrentPrice.toFixed(2)} no(a) ${effectiveCurrentStore} (${Math.round((savingsVsCheapest / cheapest.unitPrice) * 100)}% mais barato).`;
  } else {
    recommendation = `Menor preço registrado: R$ ${cheapest.unitPrice.toFixed(2)} no(a) ${cheapest.store}.`;
  }

  return {
    itemName,
    currentPrice: effectiveCurrentPrice,
    currentStore: effectiveCurrentStore,
    cheapest: { store: cheapest.store, unitPrice: cheapest.unitPrice, date: cheapest.date },
    mostExpensive: { store: mostExpensive.store, unitPrice: mostExpensive.unitPrice, date: mostExpensive.date },
    priceSpreadPercent,
    savingsVsCheapest,
    recommendation,
    observations: effectiveObservations,
  };
}
