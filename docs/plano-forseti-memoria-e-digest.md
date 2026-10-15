# Plano: Forseti com memória, briefing diário e aprendizado em lote

Inspirado (sem copiar) nos prompts "Jarvis" de um terceiro. Este plano descreve o que fazer **no Balder**, a partir do código atual. Nada aqui foi implementado.

## 1. Ponto de partida (como a Forseti funciona hoje)

| Camada | Onde | Papel |
|---|---|---|
| Regras determinísticas | `src/utils/forsetiAssistant.ts`, `forsetiSpend.ts`, `forsetiIntents.ts` | Entendem a frase, calculam e escrevem a resposta com dados reais |
| IA como plano B | `api/forseti-intent.ts` (Haiku, `tool_use`) | **Só classifica** a frase numa intenção de lista fechada; não recebe nem devolve dados financeiros |
| Fluxo no app | `src/context/financial/useForsetiChat.ts` (`sendMessageToCopilot`) | Regras → IA → pergunta A/B/C → resposta padrão |
| Contexto | `lastTopicRef` (`useForsetiActivity.ts`) | Só o assunto do turno anterior, com prazo (`TOPIC_TTL_MS`) |
| Aprendizado | `api/cron/forseti-learning.ts` + `forseti_learning_reports` | Relatório diário de frases mal atendidas; **ninguém consome pelo app** |
| Itens de comprovante | `src/services/receiptMemoryService.ts` | Dicionário fixo + aprendizado local (`localStorage`) |
| Acesso | `api/_access.ts` (`requireFeature`), `forsetiEnabled` no plano | Login + plano; limite de 30 chamadas/h por pessoa |

**Princípio a preservar:** a IA nunca escreve número nem resposta financeira. Ela interpreta; o Balder calcula.

**Lacunas que o plano ataca**
1. A Forseti não sabe nada *sobre a pessoa* além do planejamento (preferências, prioridades, contexto).
2. A Forseti só fala quando perguntada.
3. O relatório de aprendizado é gerado, mas não vira melhoria com facilidade.
4. Itens de comprovante desconhecidos dependem de dicionário manual.

## 2. Decisões de design (valem para todas as fases)

- **IA não recebe valores.** Qualquer chamada nova leva apenas texto sem números (frases, memórias, descrições de item). Digest e memória respeitam isso.
- **Nada é gravado sem confirmação.** Memória e regras nascem como *proposta*; a pessoa aceita.
- **Local primeiro, IA depois.** Cada recurso tem versão sem IA que funciona sem chave/offline/visitante.
- **Dado do usuário é do usuário.** Memória fica visível, editável e apagável pelo app (diferente de `forseti_conversations`, que é só de escrita).
- **Plano e limites reaproveitados.** Mesmo `forsetiEnabled` e mesma lógica de limite por hora de `forseti-intent`.
- **Sem duplicar o que o app já modela.** Metas financeiras já existem (`goals`); memória guarda o que *não* está no modelo (preferências, restrições, contexto).

## 3. Fase 1 — Briefing "Bom dia" (custo zero de IA)

**Objetivo:** a Forseti resume o dia sem ser perguntada.

**Conteúdo (todo calculado localmente, com dados que o app já tem):**
- Vencimentos de hoje e dos próximos 3 dias (`nextCriticalEvent`, `forecasts`).
- Entradas previstas para hoje/semana.
- Saldo disponível e sobra do mês (`availableBalance`, `monthlyFreeCashflow`).
- Pendências: gastos previstos e não registrados (já existe a intenção `PREVISTO_REAL`).
- Uma linha de atenção (reserva baixa, saldo previsto negativo).

**Implementação**
1. `src/utils/forsetiDigest.ts` — função pura `buildDigest(data: ForsetiData, today: Date): DigestSection[]`, reaproveitando `ForsetiData` e `answerDoubt` onde já houver texto pronto (evitar reescrever cálculos). Testes em `forsetiDigest.test.ts` (padrão dos demais `*.test.ts`).
2. Gatilhos:
   - Frase "bom dia" / "resumo do dia" no `sendMessageToCopilot` (nova intenção local, sem API) → entra na lista de regras de `forsetiAssistant.ts`.
   - Card no `HomeHubPage.tsx` (já responde "como estou?"), uma vez por dia; data do último briefing visto em `localStorage` (a chave do app, mesmo padrão do código existente).
3. Texto no tom já usado pela Forseti (markdown leve, emojis do app).
4. Registro em `logForsetiActivity` com `kind` próprio, para o relatório de aprendizado enxergar o uso.

**Fora desta fase:** voz, notificação push, e-mail. Avaliar depois, com a decisão sobre canal (ver §8).

**Aceite:** sem login/IA o briefing aparece; em planejamento compartilhado respeita o papel (usa `viewing`); testes cobrem dia sem vencimentos, com atrasados e saldo negativo.

## 4. Fase 2 — Memória do usuário (com confirmação)

**Objetivo:** a Forseti lembra do que a pessoa disse sobre si e usa isso nas respostas.

### 4.1 Modelo de dados — `supabase/forseti_memories.sql`
Seguindo o padrão dos demais arquivos (rodar uma vez no SQL Editor):
```
forseti_memories(
  id uuid pk, user_id uuid -> auth.users on delete cascade,
  kind text check in ('PREFERENCIA','RESTRICAO','CONTEXTO','PRIORIDADE'),
  title text (<=60), body text (<=200),
  status text check in ('PROPOSTA','ATIVA') default 'PROPOSTA',
  source_activity_id uuid null,   -- frase que originou
  created_at, updated_at, last_used_at
)
```
- RLS: **dono lê, insere, atualiza e apaga** (`auth.uid() = user_id`).
- Limite de 30 memórias ativas por pessoa (checado no app e por *constraint*/trigger).
- Exemplos: "Evita parcelar compras" (PREFERENCIA), "Divide o aluguel com a esposa" (CONTEXTO), "Quer quitar o empréstimo antes de investir" (PRIORIDADE).

### 4.2 Captação
- Nova intenção `MEMORIA` em `FORSETI_INTENTS` + campo opcional `memory` no `tool_use` de `api/forseti-intent.ts` (`{kind,title,body}`), com `parseMemory()` em `forsetiIntents.ts` no mesmo estilo de `parseRegistration` (validação rígida; nunca confiar na resposta da IA).
- Regras locais também podem disparar: "lembra que…", "não gosto de parcelar", "prefiro…".
- **Filtro de sensibilidade** em `parseMemory`: rejeita corpo com valores em R$, sequências longas de dígitos (CPF, conta, cartão), e-mails/links. Mesmo princípio de `normalizePhrase`.
- Fluxo de confirmação no chat, reaproveitando o mecanismo de `pendingConfirmation`: "Posso lembrar disso? *Evita parcelar compras*" → [Sim] [Editar] [Não]. Só então grava com `status='ATIVA'`.

### 4.3 Uso (o ponto crítico)
Como a IA não escreve respostas, a memória precisa de **consumidores** concretos, senão não serve a nada:
1. **Briefing (Fase 1):** linha de foco escolhida entre prioridades/restrições ativas.
2. **Intenções `COMPRA` e `QUITAR`:** complementam a resposta calculada com a memória relevante ("você prefere não parcelar; à vista cabe assim…").
3. **Perguntas A/B/C:** ordenar as opções com base na memória.
4. **(Opcional, depois)** chamada de IA para "tom/foco" que recebe **apenas memórias** (sem números) e devolve uma frase curta; sempre com fallback local.

### 4.4 Tela de gerenciamento
- Seção no `ProfilePage.tsx` (ou modal ao lado de `ForsetiActivityModal`): listar, editar, apagar, "esquecer tudo". Mostrar também propostas pendentes.
- Texto de privacidade claro: o que fica guardado, que **não** vai valores para a IA, como apagar.
- Planejamento compartilhado: a memória é da pessoa, **não** do planejamento (não aparece para quem visualiza a conta dela).

### 4.5 Aceite
Validação de `parseMemory` testada (valores, CPF, tamanho, kinds inválidos); RLS verificada com outro usuário; apagar remove de fato; Forseti funciona normalmente sem nenhuma memória e sem conexão.

## 5. Fase 3 — Classificação em lote de itens de comprovante

**Objetivo:** reduzir os itens "sem natureza" sem manter um dicionário gigante à mão.

1. Hoje: `matchItemToLearnedRecord` → `DEFAULT_DICTIONARY` + aprendizado em `localStorage`.
2. Novo endpoint `api/forseti-items.ts` (mesmo esqueleto de `forseti-intent`: login, plano, limite, `tool_use`): recebe **uma lista de descrições de item sem número/valor** (já normalizadas) + a lista de mapeamentos/naturezas do usuário (ids e nomes) e devolve `{descricao, mappingItemId, natureId, confianca}[]` — **uma chamada por comprovante**, não por item.
3. Cache por descrição normalizada: acrescentar ao `learnReceiptItemAssociation` existente; item já visto nunca vai à IA de novo.
4. Sugestões entram como "confirme a associação" na tela do comprovante (a pessoa aceita/corrige; correção também vira aprendizado).
5. Sem login/IA: comportamento atual inalterado.

**Aceite:** um comprovante com N itens desconhecidos gera 1 chamada; reabrir o mesmo gera 0; teste unitário de parse/validação como em `forsetiIntentApi.test.ts`.

## 6. Fase 4 — Fechar o ciclo de aprendizado

**Problema:** `forseti_learning_reports` só é lida no painel do Supabase.

1. Aba "Aprendizado da Forseti" no `SystemAdminPanel.tsx` (acesso de administrador, mesmo controle de `user_roles`): lista os relatórios, os grupos de frases e as sugestões (intenção, palavras-chave, nota).
2. Ação "copiar como caso de teste" (gera o trecho para `forsetiAssistant.test.ts`) e "marcar como tratada" (campo novo `handled` por sugestão, no JSON do relatório).
3. Etapa seguinte, só se valer o esforço: tabela `forseti_keyword_overrides(intent, keywords[], approved_by)` lida no início do app e mesclada às palavras-chave de `detectDoubt`. **Recomendação:** adiar; começar pelo item 2, que mantém as regras versionadas em código.

## 7. Fase 5 — Pequenos ganhos

- Estados do avatar (`forseti-avatar-box`, `forseti-pulse-dot`): ocioso / pensando (durante `classifyIntent`) / respondendo.
- Mostrar quando a resposta veio da IA (já existe o rótulo `'IA'` em `answerIntent`) e quanto do limite horário resta (o 429 hoje só aparece como falha).
- Entrevista de configuração (`ForsetiTopicSetup`): aceitar "pular" usando o padrão e fechar com resumo antes de gravar.

## 8. Transversal

**Segurança e privacidade**
- Tudo que sai para a Anthropic passa por filtro sem números; revisar `api/*` novos contra isso.
- Memória: RLS de dono, apagamento real, texto de consentimento; avaliar LGPD (base legal, exclusão ao apagar conta já coberta por `on delete cascade`).
- Chave da Anthropic continua só no servidor (`ANTHROPIC_API_KEY`).

**Custos**
- Fase 1: R$ 0. Fase 2: chamadas só quando a frase parece memória; cache e limite por hora. Fase 3: 1 chamada por comprovante. Todos com modelo Haiku, como hoje.

**Qualidade**
- `vitest` para toda função pura nova; `npx tsc --noEmit` e `npm run lint` antes de cada entrega; build se a mudança for ampla.
- Migrações SQL são manuais (SQL Editor); o app deve ignorar a tabela inexistente, como já faz com `forseti_conversations`.

**Mobile**
- `mobile/src/screens/CopilotScreen.tsx` é um chat próprio e simples. Decidir se o briefing e a memória entram no mobile na mesma entrega ou numa seguinte (recomendo seguinte).

**Entrega**
- Uma PR por fase, para `main`, conforme o fluxo do projeto (`CLAUDE.md`).

## 9. Ordem e estimativa relativa

| # | Fase | Esforço | Valor | Depende de |
|---|---|---|---|---|
| 1 | Briefing "Bom dia" | Baixo | Alto, visível | — |
| 2 | Memória do usuário | Alto | Muito alto | Fase 1 (consumidor do foco) |
| 3 | Itens de comprovante em lote | Médio | Médio | — |
| 4 | Ciclo de aprendizado | Baixo–médio | Médio (interno) | — |
| 5 | Ganhos pequenos | Baixo | Baixo–médio | — |

Fases 1, 3 e 4 são independentes e podem andar em paralelo; a 2 é a maior.

## 10. Riscos

- **Memória sem consumidor** vira só um cadastro: por isso §4.3 define onde ela aparece antes de construir.
- **Memória errada vira "verdade":** confirmação obrigatória, tela de edição e `last_used_at` para limpar o que nunca é usado.
- **Vazamento de dado sensível no texto livre:** filtro no servidor *e* no app; nunca confiar só na IA.
- **Briefing repetitivo:** se não houver nada a dizer, mostrar uma linha curta ou nada.
- **Crescimento de `forsetiAssistant.ts` (1.647 linhas):** colocar o novo em módulos próprios (`forsetiDigest.ts`, `forsetiMemory.ts`), não no arquivo existente.

## 11. Decisões que dependem de você

1. Briefing: só dentro do app, ou também notificação (push/e-mail)?
2. Memória: disponível em todos os planos com Forseti ou só nos superiores?
3. Mobile entra junto ou depois?
4. Fase 4: ficamos no relatório no painel admin, ou vale o passo de regras dinâmicas?
5. Por onde começar? Recomendo Fase 1 e, em seguida, a 2.
