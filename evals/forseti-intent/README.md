# Avaliação da IA que entende a frase (`forseti-intent`)

Mede o quanto a IA acerta a **intenção** e o **conteúdo** (registro, memória, período, gasto) das frases que as regras do
aplicativo não entenderam. É o que decide, com número, se vale trocar o modelo ou mexer no prompt.

## O que roda e o que não roda

| Comando | Gasta? | O que faz |
|---|---|---|
| `npm test` | não | valida os casos e a nota (`tests/forsetiIntentEval.test.ts`) |
| `npm run eval:intent` | não | mostra o plano (quantas chamadas) e sai |
| `ANTHROPIC_API_KEY=... EVAL_RUN=1 npm run eval:intent` | **sim** | chama a IA em cada caso e dá a nota |

Uma rodada de 53 casos custa na ordem de **US$ 0,10 a 0,20** na Haiku 4.5 (cerca de 1.700 tokens de entrada por chamada;
o custo real aparece no fim da rodada).

## Comparar o modelo atual com a Haiku 5.5 (antes de trocar em produção)

```bash
export ANTHROPIC_API_KEY=...
EVAL_MODEL=claude-haiku-4-5-20251001 EVAL_REPS=3 EVAL_RUN=1 npm run eval:intent   # baseline
EVAL_MODEL=claude-haiku-5-5          EVAL_REPS=3 EVAL_RUN=1 npm run eval:intent   # candidata
```

Compare, nesta ordem: **registros falsos** (precisa ficar em 0), "passou" por categoria, precisão do registro e da memória,
respostas cortadas por `max_tokens` (precisa ser 0), latência e custo. Só então troque em produção definindo
`FORSETI_INTENT_MODEL=claude-haiku-5-5` na Vercel (sem novo deploy; para voltar, apague a variável).
O cache de prompt aparece nas linhas "cache:" da rodada: na Haiku 4.5 fica em 0 (o prefixo é menor que o mínimo de 4.096 tokens);
na 5.5 deve aparecer leitura de cache a partir da segunda chamada.

## Variáveis

- `EVAL_MODEL`: modelo testado (padrão: o de produção, `FORSETI_INTENT_MODEL` ou `MODEL` em `api/_forsetiIntentAi.ts`).
- `EVAL_VARIANT`: nome da pasta de resultados (padrão: o modelo).
- `EVAL_REPS`: repetições por caso (padrão 1). Use 3 ou mais para medir ruído antes de concluir qualquer coisa.
- `EVAL_ONLY`: ids separados por vírgula, para rodar só alguns casos (`EVAL_ONLY=reg-01,mem-02`).
- `EVAL_CONCURRENCY`: chamadas em paralelo (padrão 4).

Retomar uma rodada interrompida é só repetir o comando: o que já está em `results/<variante>/results.jsonl` não é refeito.

## Como a nota é dada

Programática, sem juiz de IA (a saída é uma lista fechada mais campos já validados). Por caso:

- **intenção**: a intenção está entre as aceitas (alguns casos aceitam mais de uma, porque a frase é de fato ambígua);
- **conteúdo**: registro, memória, período e gasto batem **e o que não era esperado não veio**. Um registro numa pergunta é o
  erro mais caro (cria um lançamento que a pessoa não pediu) e é contado à parte em "registros falsos";
- **passou**: intenção e conteúdo.

O resumo traz também precisão e revocação de registro e de memória, o resultado por categoria, mediana de latência, tokens e custo.
Falha de execução (rede, timeout, modelo servido diferente do pedido) **não vira nota zero**: vai para `errors.jsonl` e a rodada
termina com erro, porque o resultado está incompleto.

## Os casos (`cases.ts`)

- São frases que `detectDoubt` e os detectores de registro **deixam passar**, porque só essas chegam à IA em produção
  (o teste confere). Frases que as regras já resolvem não entram.
- Foram **sintetizadas** a partir do prompt e dos testes, não de conversas reais. Para ficarem mais fiéis, acrescente frases do
  relatório de aprendizado (painel de gestão) que caíram na IA, com a intenção esperada, e reveja as categorias.
- O "hoje" enviado à IA é fixo (`EVAL_DAY`), para "amanhã" e "últimos 15 dias" terem resposta certa.

## Limites conhecidos

- 53 casos medem diferenças grandes; com 1 repetição, uma diferença de poucos pontos pode ser ruído. Rode com `EVAL_REPS=3` e
  compare as variantes lado a lado antes de decidir.
- Não cobre `api/forseti-items.ts` (itens de comprovante) nem a rotina `forseti-learning`.
- Não guarda a conversa completa por caso (o prompt é o mesmo em todos); guarda a resposta, a nota, o uso e a latência.
