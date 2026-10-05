import { type FixedExpenseMapping } from '../../types';

// Função Geradora de Mapeamentos Sugeridos para uma Natureza (Alimentação, Moradia, Transporte, etc)
export const buildSuggestedMappingsForNature = (
  natureId: string,
  natureName: string,
  icon?: string
): FixedExpenseMapping[] => {
  const natName = (natureName || '').toLowerCase();
  const isAlimentacao =
    natName.includes('aliment') ||
    natName.includes('mercado') ||
    natName.includes('padaria') ||
    natName.includes('feira') ||
    natName.includes('refeiç');

  const isMoradia =
    natName.includes('moradia') ||
    natName.includes('casa') ||
    natName.includes('habit') ||
    natName.includes('imóvel') ||
    natName.includes('imovel');

  const isTransporte =
    natName.includes('transporte') ||
    natName.includes('veículo') ||
    natName.includes('veiculo') ||
    natName.includes('carro') ||
    natName.includes('moto');

  const timestamp = Date.now();

  if (isAlimentacao) {
    return [
      {
        id: `map_${timestamp}_mercado`,
        name: 'Supermercado Base Mensal (Estoque Seco & Limpeza)',
        natureId,
        icon: '🛒',
        applicableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        frequency: 'MENSAL',
        dayOfMonth: 7,
        keywords: ['mercado', 'supermercado', 'carrefour', 'assai', 'atacadao', 'pao de acucar'],
        items: [
          { id: `item_${timestamp}_1`, description: 'Arroz Nobre Tipo 1 (5kg)', quantity: 2, price: 34.0, multiplierWeeks: 1, totalValue: 68.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_2`, description: 'Feijão Carioca (1kg)', quantity: 4, price: 8.5, multiplierWeeks: 1, totalValue: 34.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_3`, description: 'Azeite de Oliva Extra Virgem 500ml', quantity: 2, price: 46.0, multiplierWeeks: 1, totalValue: 92.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_4`, description: 'Café Especial Torrado em Grãos (500g)', quantity: 3, price: 28.0, multiplierWeeks: 1, totalValue: 84.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_5`, description: 'Laticínios, Queijos & Manteiga', quantity: 1, price: 160.0, multiplierWeeks: 1, totalValue: 160.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_6`, description: 'Produtos de Limpeza & Higiene Pessoal', quantity: 1, price: 210.0, multiplierWeeks: 1, totalValue: 210.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
        ],
      },
      {
        id: `map_${timestamp}_feira`,
        name: 'Feira Livre & Hortifrúti (Rotina Semanal)',
        natureId,
        icon: '🥦',
        applicableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        frequency: 'SEMANAL',
        dayOfWeek: 'Sábado',
        keywords: ['feira', 'hortifruti', 'legumes', 'frutas', 'verduras', 'pastel'],
        items: [
          { id: `item_${timestamp}_7`, description: 'Frutas da Estação (Maçã, Banana, Uva, Mamão)', quantity: 1, price: 65.0, multiplierWeeks: 4, totalValue: 260.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'PIX' },
          { id: `item_${timestamp}_8`, description: 'Verduras & Legumes Orgânicos da Semana', quantity: 1, price: 45.0, multiplierWeeks: 4, totalValue: 180.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'PIX' },
          { id: `item_${timestamp}_9`, description: 'Ovos Caipiras Orgânicos (Cartela 30 un)', quantity: 1, price: 28.0, multiplierWeeks: 2, totalValue: 56.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'PIX' },
        ],
      },
      {
        id: `map_${timestamp}_proteinas`,
        name: 'Açougue & Proteínas Nobres',
        natureId,
        icon: '🥩',
        applicableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        frequency: 'QUINZENAL',
        dayOfWeek: 'Sábado',
        keywords: ['acougue', 'carnes', 'bife', 'frango', 'swift', 'peixe'],
        items: [
          { id: `item_${timestamp}_10`, description: 'Peito de Frango & Filé de Coxa (kg)', quantity: 4, price: 26.0, multiplierWeeks: 4, totalValue: 416.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_11`, description: 'Carnes Vermelhas de Primeira (Alcatra/Patinho)', quantity: 3, price: 54.0, multiplierWeeks: 2, totalValue: 324.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_12`, description: 'Peixes & Frutos do Mar', quantity: 2, price: 65.0, multiplierWeeks: 1, totalValue: 130.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
        ],
      },
    ];
  }

  if (isMoradia) {
    return [
      {
        id: `map_${timestamp}_moradia`,
        name: 'Contas Fixas & Concessionárias',
        natureId,
        icon: '💡',
        applicableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        frequency: 'MENSAL',
        dayOfMonth: 10,
        keywords: ['luz', 'energia', 'agua', 'sabesp', 'coelba', 'enel', 'internet', 'fibra'],
        items: [
          { id: `item_${timestamp}_1`, description: 'Energia Elétrica (Coelba / Enel)', quantity: 1, price: 250.0, multiplierWeeks: 1, totalValue: 250.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'BOLETO' },
          { id: `item_${timestamp}_2`, description: 'Água & Saneamento Básico', quantity: 1, price: 90.0, multiplierWeeks: 1, totalValue: 90.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'BOLETO' },
          { id: `item_${timestamp}_3`, description: 'Internet Residencial Fibra Óptica', quantity: 1, price: 120.0, multiplierWeeks: 1, totalValue: 120.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'BOLETO' },
        ],
      },
    ];
  }

  if (isTransporte) {
    return [
      {
        id: `map_${timestamp}_transporte`,
        name: 'Combustível & Manutenção',
        natureId,
        icon: '⛽',
        applicableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        frequency: 'MENSAL',
        dayOfMonth: 15,
        keywords: ['posto', 'gasolina', 'etanol', 'combustivel', 'ipiranga', 'shell', 'manutencao'],
        items: [
          { id: `item_${timestamp}_1`, description: 'Combustível Mensal (Gasolina/Etanol)', quantity: 4, price: 120.0, multiplierWeeks: 1, totalValue: 480.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CARTAO' },
          { id: `item_${timestamp}_2`, description: 'Reserva para Manutenção & Troca de Óleo', quantity: 1, price: 150.0, multiplierWeeks: 1, totalValue: 150.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'CONTA' },
        ],
      },
    ];
  }

  return [
    {
      id: `map_${timestamp}_base`,
      name: `Despesas Previstas de ${natureName}`,
      natureId,
      icon: icon || '📋',
      applicableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      frequency: 'MENSAL',
      dayOfMonth: 10,
      keywords: [],
      items: [
        { id: `item_${timestamp}_1`, description: `Item Base de ${natureName}`, quantity: 1, price: 100.0, multiplierWeeks: 1, totalValue: 100.0, realizedValue: 0, isFulfilled: false, paymentMethod: 'PIX' },
      ],
    },
  ];
};
