import type { ExpenseNature } from '../types';

export type SetupTopic = 'INICIO' | 'ENTRADAS' | 'CARTOES' | 'CONTAS' | 'NATUREZAS' | 'MAPEAMENTOS' | 'ACOMPANHAMENTO';

/** Etapas antigas do Get Started (1 = ponto de partida, 2/3 = faturas, 4 = naturezas, 5 = mapeamentos) → assunto da conversa. */
export const topicFromStepIndex = (step?: number): SetupTopic | undefined =>
  step === 1 ? 'INICIO' : step === 2 || step === 3 ? 'CARTOES' : step === 4 ? 'NATUREZAS' : step === 5 ? 'MAPEAMENTOS' : undefined;

export const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const brDate = (iso: string) => iso.split('-').reverse().join('/');
export const clampDay = (n: number, max = 31) => Math.min(max, Math.max(1, Math.round(n) || 1));

/** A fatura costuma fechar uma semana antes do vencimento. */
export const defaultClosingDay = (dueDay: number) => (dueDay - 7 >= 1 ? dueDay - 7 : dueDay - 7 + 30);

/** Próxima data com o dia informado a partir de hoje (este mês, se ainda não passou). */
export function nextDateForDay(day: number, today: Date, monthOffset = 0): string {
  const base = today.getDate() > day ? 1 : 0;
  const month = today.getMonth() + base + monthOffset;
  const lastDay = new Date(today.getFullYear(), month + 1, 0).getDate();
  return isoOf(new Date(today.getFullYear(), month, Math.min(day, lastDay)));
}

/** Grupos (naturezas) em que as contas do mês entram. */
export const BILL_GROUPS = {
  CASA: { name: 'Moradia & Contas da Casa', icon: '🏠', color: '#06b6d4', type: 'FIXA' as const, keywords: ['aluguel', 'condominio', 'luz', 'energia', 'agua', 'gas', 'internet', 'celular'] },
  SAUDE: { name: 'Saúde & Cuidados', icon: '💊', color: '#8b5cf6', type: 'ESSENCIAL' as const, keywords: ['farmacia', 'drogaria', 'consulta', 'exame', 'plano de saude'] },
  EDUCACAO: { name: 'Educação', icon: '🎓', color: '#3b82f6', type: 'FIXA' as const, keywords: ['escola', 'faculdade', 'curso', 'mensalidade', 'livro'] },
  LAZER: { name: 'Lazer & Assinaturas', icon: '🎬', color: '#ec4899', type: 'VARIAVEL' as const, keywords: ['netflix', 'spotify', 'streaming', 'academia', 'cinema', 'restaurante', 'bar'] },
  TRANSPORTE: { name: 'Transporte', icon: '🚗', color: '#f59e0b', type: 'VARIAVEL' as const, keywords: ['posto', 'gasolina', 'combustivel', 'uber', '99', 'onibus', 'metro', 'pedagio'] },
  OUTRAS: { name: 'Outras Contas', icon: '📄', color: '#64748b', type: 'FIXA' as const, keywords: [] as string[] },
};

export type BillGroupKey = keyof typeof BILL_GROUPS;

/** Contas comuns do mês e a natureza em que cada uma entra. */
export const COMMON_BILLS: { key: string; name: string; group: BillGroupKey }[] = [
  { key: 'aluguel', name: 'Aluguel', group: 'CASA' },
  { key: 'condominio', name: 'Condomínio', group: 'CASA' },
  { key: 'luz', name: 'Luz', group: 'CASA' },
  { key: 'agua', name: 'Água', group: 'CASA' },
  { key: 'gas', name: 'Gás', group: 'CASA' },
  { key: 'internet', name: 'Internet', group: 'CASA' },
  { key: 'celular', name: 'Celular', group: 'CASA' },
  { key: 'plano_saude', name: 'Plano de saúde', group: 'SAUDE' },
  { key: 'escola', name: 'Escola ou faculdade', group: 'EDUCACAO' },
  { key: 'streaming', name: 'Streaming', group: 'LAZER' },
  { key: 'academia', name: 'Academia', group: 'LAZER' },
  { key: 'transporte', name: 'Transporte ou combustível', group: 'TRANSPORTE' },
];

export interface NatureTemplate {
  name: string;
  icon: string;
  color: string;
  type: ExpenseNature['type'];
  description: string;
  keywords: string[];
}

/** Naturezas que a Forseti sugere quando a pessoa monta as suas. */
export const SUGGESTED_NATURES: NatureTemplate[] = [
  { name: 'Alimentação & Mercado', icon: '🛒', color: '#10b981', type: 'ESSENCIAL', description: 'Supermercado, feira, açougue e padaria', keywords: ['mercado', 'supermercado', 'feira', 'padaria', 'acougue', 'hortifruti'] },
  { name: 'Moradia & Contas da Casa', icon: '🏠', color: '#06b6d4', type: 'FIXA', description: 'Aluguel, condomínio, luz, água e internet', keywords: BILL_GROUPS.CASA.keywords },
  { name: 'Transporte', icon: '🚗', color: '#f59e0b', type: 'VARIAVEL', description: 'Combustível, aplicativos, ônibus e manutenção', keywords: BILL_GROUPS.TRANSPORTE.keywords },
  { name: 'Saúde & Cuidados', icon: '💊', color: '#8b5cf6', type: 'ESSENCIAL', description: 'Farmácia, consultas, exames e plano de saúde', keywords: BILL_GROUPS.SAUDE.keywords },
  { name: 'Comer Fora & Delivery', icon: '🍽️', color: '#f97316', type: 'VARIAVEL', description: 'Restaurantes, lanches e aplicativos de entrega', keywords: ['restaurante', 'ifood', 'lanchonete', 'pizzaria', 'delivery', 'rappi', 'bar'] },
  { name: 'Lazer & Assinaturas', icon: '🎬', color: '#ec4899', type: 'VARIAVEL', description: 'Streaming, academia, passeios e viagens', keywords: BILL_GROUPS.LAZER.keywords },
  { name: 'Educação', icon: '🎓', color: '#3b82f6', type: 'FIXA', description: 'Escola, faculdade, cursos e livros', keywords: BILL_GROUPS.EDUCACAO.keywords },
  { name: 'Pets', icon: '🐾', color: '#a3e635', type: 'VARIAVEL', description: 'Ração, veterinário e banho e tosa', keywords: ['racao', 'petshop', 'veterinario', 'pet'] },
  { name: 'Cuidados Pessoais', icon: '💇', color: '#f472b6', type: 'VARIAVEL', description: 'Cabelo, beleza, roupas e higiene', keywords: ['salao', 'barbearia', 'cabelo', 'roupa', 'cosmetico'] },
];

/** Rotinas de gasto que a Forseti sugere conforme o nome da natureza. */
export function suggestedRoutinesFor(natureName: string): string[] {
  const n = natureName.toLowerCase();
  if (/aliment|mercado|feira|padaria/.test(n)) return ['Supermercado', 'Feira', 'Açougue', 'Padaria'];
  if (/comer fora|delivery|restaurante/.test(n)) return ['Delivery', 'Restaurante', 'Lanche no trabalho'];
  if (/moradia|casa|contas/.test(n)) return ['Aluguel', 'Condomínio', 'Luz', 'Água', 'Internet', 'Gás'];
  if (/transporte|carro|veícul|veicul|moto/.test(n)) return ['Combustível', 'Uber/99', 'Transporte público', 'Estacionamento', 'Manutenção'];
  if (/saúde|saude|cuidado/.test(n)) return ['Farmácia', 'Plano de saúde', 'Consultas'];
  if (/lazer|assinatura/.test(n)) return ['Streaming', 'Academia', 'Cinema', 'Passeios'];
  if (/educa/.test(n)) return ['Mensalidade', 'Material', 'Curso'];
  if (/pet|animai/.test(n)) return ['Ração', 'Veterinário', 'Banho e tosa'];
  return [];
}

/** Grupos de gastos parecidos: o que a pessoa digita puxa os demais do grupo como sugestão. */
const RELATED_GROUPS: { trigger: RegExp; items: string[] }[] = [
  { trigger: /raç|raca|pet|animal|cachorro|gato|veterin|tosa/, items: ['Ração', 'Banho e tosa', 'Veterinário', 'Vacinas', 'Petiscos', 'Areia higiênica', 'Remédios do pet'] },
  { trigger: /mercado|feira|açougue|acougue|padaria|hortifruti|aliment|compras/, items: ['Supermercado', 'Feira', 'Açougue', 'Padaria', 'Hortifruti', 'Atacado', 'Bebidas'] },
  { trigger: /delivery|ifood|restaurante|lanche|pizza|almoço|almoco|jantar|café|cafe/, items: ['Delivery', 'Restaurante', 'Lanche', 'Pizzaria', 'Café', 'Almoço no trabalho', 'Bar'] },
  { trigger: /luz|água|agua|energia|internet|gás|gas|condom|aluguel|iptu|telefone|celular/, items: ['Aluguel', 'Condomínio', 'Luz', 'Água', 'Internet', 'Gás', 'IPTU', 'Telefone'] },
  { trigger: /combust|gasolina|etanol|uber|ônibus|onibus|carro|moto|estacion|pedágio|pedagio|ipva|seguro/, items: ['Combustível', 'Uber/99', 'Transporte público', 'Estacionamento', 'Pedágio', 'Manutenção', 'IPVA', 'Seguro do carro'] },
  { trigger: /farm|remédio|remedio|consulta|exame|plano de sa|dentista|psic|terapia|saúde|saude/, items: ['Farmácia', 'Plano de saúde', 'Consultas', 'Exames', 'Dentista', 'Terapia', 'Suplementos'] },
  { trigger: /stream|netflix|spotify|cinema|academia|passeio|viagem|jogo|show|lazer/, items: ['Streaming', 'Música', 'Academia', 'Cinema', 'Passeios', 'Jogos', 'Viagens'] },
  { trigger: /escola|faculdade|curso|mensalidade|livro|material|idioma|inglês|ingles/, items: ['Mensalidade', 'Material escolar', 'Curso', 'Livros', 'Idiomas', 'Transporte escolar'] },
  { trigger: /cabelo|salão|salao|barbear|unha|beleza|roupa|cosm|perfum|higiene/, items: ['Cabelo', 'Barbearia', 'Manicure', 'Cosméticos', 'Roupas', 'Higiene pessoal', 'Perfumaria'] },
  { trigger: /filho|criança|crianca|bebê|bebe|fralda|creche|brinqued/, items: ['Fraldas', 'Creche', 'Brinquedos', 'Roupas infantis', 'Pediatra', 'Lanche escolar'] },
  { trigger: /presente|aniversár|aniversar|festa|natal|casamento/, items: ['Presentes', 'Festas', 'Cerimônias', 'Datas comemorativas', 'Decoração'] },
  { trigger: /limpeza|faxina|diarista|lavanderia|reforma|manuten/, items: ['Produtos de limpeza', 'Diarista', 'Lavanderia', 'Reparos', 'Utensílios'] },
];

const plainText = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Gastos relacionados ao que a pessoa escreveu (sem repetir o próprio texto). */
export function relatedRoutinesFor(text: string): string[] {
  const t = text.trim().toLowerCase();
  if (t.length < 3) return [];
  const own = plainText(t);
  const out: string[] = [];
  RELATED_GROUPS.forEach((g) => {
    const hit = g.trigger.test(t) || g.items.some((i) => plainText(i).includes(own) || own.includes(plainText(i)));
    if (hit) g.items.forEach((i) => { if (plainText(i) !== own && !out.includes(i)) out.push(i); });
  });
  return out;
}
