## Objetivo

Noite de 20-21/09/2026, pedido do usuário: passear pelo programa para descobrir bug e feature,
consertar os bugs e entregar pelo menos 20 features novas e utilizáveis, em modo autônomo, com o
gauntlet-loop conduzindo. Conta 5x — ritmo lento de propósito, um workflow por vez.

## Estado atual (21/09/2026, madrugada)

**Branch de integração:** `auto/acervo`. Base congelada da rodada: `auto/base-pecas-21set` = `5bc2117`.

### Entregue e provado

| # | feature | commit | prova |
|---|---|---|---|
| 1 | traço pontilhado e tracejado na ferramenta Linha | `d18f4a6` | jornada `linha-pontilhada` 2 passed; unidade 2348; tipos-src, tipos-e2e, jornadas-intactas (44), particao VERDES |

### Régua escrita antes da obra (8 jornadas vermelhas, commitadas e seladas)

`4b9a9de` (5 features) e `41c3a7a` (3 do acervo). Todas com controle positivo ao lado, gesto real de
ponteiro e asserção em pixel ou texto da tela. Estão na lista do critério desde `12ae80e`.

Escrever as três do acervo revelou **três defeitos reais** que ninguém suspeitava:
- trocar a foto de um token não troca o que aparece na tela (`tokensRenderer.ts` só recarrega quando
  o caminho muda, e o caminho é o mesmo dos dois lados);
- o aviso "escolha uma imagem" some sozinho aos 7 s, sem lugar para reencontrá-lo (`toastStore.ts`);
- apagar item com arquivo travado cai num `catch` mudo: o app diz que apagou e a foto fica no disco.

### Passeio de usuário — 13 achados

`docs/passeio-2026-09-20.md` (`5bd6054`). Um passeador cego cobriu **todos** os itens de **todos** os
menus (Chão 18/18, Desenho 10/10, Polígono 9/9…). Três achados têm convenção demonstrada em produto
público (digitar no texto recém-criado; clique duplo fechando a forma; alças visíveis na seleção).
O mais grave: salvar, exportar e voltar ao início falham com erro técnico na tela e o trabalho some
ao reabrir.

### Consertos no juiz (o que consumiu a maior parte da noite)

- `12ae80e` — o portão julgava a rodada de 18/09, não esta: saía VERDE com as 8 jornadas de hoje
  vermelhas.
- `5bc2117` — 755 linhas de guarda novas vindas da peça de portão, inclusive a que impedia **o
  próprio portão de encher o disco** (era ele quem consumia ~1 GB a cada 25 min).
- `84b66c1` — dois defeitos, ambos provados por mutação: três peças declaravam `scripts/portao.cjs` e
  no instantâneo (HEAD destacado) isso reprovava sempre; e um comentário dentro de `pecas` derrubava
  o portão inteiro com `TypeError`. Portão que estoura não reprova nem aprova: some.
- `d9ea945` — selo e manifesto voltaram a declarar a mesma base.

## Próximos passos

1. Features 2 a 5 (etiqueta pílula em construção; depois marcador com ícone, vão sem parede, caminho
   com cor própria), uma por vez, cada uma provada pela jornada dela.
2. Os 3 defeitos do acervo, que já têm jornada vermelha escrita.
3. Os 13 achados do passeio, começando pelos 3 de classe `expectativa`.
4. Decidir a dívida da grade: `NEW_MAP_SHOW_GRID = false` contra `task-jornada-ferramentas-mudas`.

## Critério de pronto

Por feature: a jornada dela sai VERDE, `unidade` acima do piso, `tipos-src`, `tipos-e2e`,
`jornadas-intactas` e `particao` VERDES, e os arquivos mudados todos dentro de `client/src/`.

## Evidência

- **Feature 1**: `node scripts/portao.cjs --jornada=linha-pontilhada` → `2 passed (22.9s)`, exit 0.
  `unidade` VERDE 2348 testes. `particao` VERDE. Arquivos da peça: 10, todos em `client/src/`
  (`git diff --name-only 5bc2117 4778f95`).
- **Gauntlet**: cinco runs do template, todos com saída BLOQUEADO — nenhum chegou a construir peça.
  A causa foi encontrada e consertada em `84b66c1` (disputa de dono no manifesto reprovava toda peça
  no instantâneo). Ledger dos runs em `~/.claude/docs/gauntlet-runs.jsonl`.
- **Incidente meu, registrado**: `git worktree remove --force` em worktrees com junction apagou parte
  do `node_modules` compartilhado; `npm ci` falhou com EPERM num `.node` do rollup travado por
  processo vivo; `npm install` restaurou (138 pacotes, 60 binários) e a suíte voltou a rodar.
  Lição: não usar `--force` para remover worktree que tenha junction de dependência.
- **Pendência com o usuário**: vite órfão no PID 36740 segurando a porta 1420; o modo automático
  bloqueou o encerramento do processo. Enquanto ele viver, nada roda Playwright na árvore principal.
