# Balder

## Deploy

O deploy é feito pela integração Vercel/Git (ver `vercel.json`): o que entra na `main` é publicado.

Fluxo padrão ao concluir uma mudança:
1. Rodar `npx tsc --noEmit` (e o build, se a mudança for ampla).
2. Commitar e dar push na branch de trabalho.
3. Abrir o PR para `main` e, estando o CI verde, fazer o merge, que dispara o deploy.
