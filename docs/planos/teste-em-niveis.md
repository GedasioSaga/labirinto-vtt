# Teste em níveis

Antes: toda integração rodava vitest inteiro + tsc + e2e, ~50 min, e a fila de suítes pesadas (uma por vez na máquina) virava gargalo. Agora: `node scripts/teste-rapido.cjs` olha o que mudou contra o merge-base e roda o nível certo. Na dúvida, roda MAIS.

## Os três níveis

| Nível | Quando | O que roda |
|---|---|---|
| **N0** (alvo ≤ 90 s) | laço do agente, a cada bloco de edição | tsc incremental (app + e2e) · `vitest related` dos mudados no projeto `rapido` · e2e só o spec mudado + a lista curta `n0` da área |
| **N1** (alvo ≤ 6 min) | portão de integração de uma linha | N0 + golden + 3 jornadas seladas + fumaça + todos os specs da área (`client/e2e/mapa-de-specs.json`) + round-trip dos mapas salvos (`sempreNoN1`) + teste mudado do `lento`/`desempenho` + cargo clippy/test se `desktop/src-tauri/{src,tests}/*.rs` mudou |
| **N2** (lote) | fim de fase, `/noite`, e sempre que o N1 não vale | `rapido` + `lento` · TODOS os e2e · cargo se desktop/ mudou · `desempenho` por último, sozinho |

```
node scripts/teste-rapido.cjs --nivel 0            # laço
node scripts/teste-rapido.cjs                      # N1 contra main (padrão)
node scripts/teste-rapido.cjs --nivel 2            # lote
node scripts/teste-rapido.cjs --dry                # só mostra o plano
node scripts/teste-rapido.cjs --base X --topo Y    # diff X..Y, testando a árvore atual
```

O plano inteiro ocupa UMA vaga da fila global (`~/.claude/scripts/suite-lock.cjs`); não embrulhe o script em outro suite-lock. `--sem-fila` só para quem já está dentro de uma vaga. Saída: uma linha por etapa (PASSOU/FALHOU, tempo, contagem) e o resumo; exit ≠ 0 se algo falhou. Logs em `%TEMP%\teste-rapido\<árvore>-<ms>\`. O navegador `chromium-1243` da máquina entra como `LAB_NAVEGADOR` sozinho; e2e usa 4 workers dentro da vaga (`PW_WORKERS` muda).

## O N1 é lista BRANCA (conselho de 24/10/2026)

O N1 só vale quando a diff é SÓ `.ts/.tsx` de `client/src` dentro de uma área do mapa, seus testes, specs e2e e `.rs` de `desktop/src-tauri/{src,tests}`. Força N2: `.css`, `.json`, `.png`, fixture (`__fixtures__/`, `*.fixture.ts`), config, arquivo **quente** (`types/map.ts`, `hostSession.ts`, `fogFilter.ts`, `mapStore.ts`, `lib/layers.ts`, `PixiCanvas.tsx`, `PlayerView.tsx`, `App.tsx`, `LivroDaMesa.tsx`, `keymap.ts`), visual do Meio-Termo (`texturas/**`, `rasterDosMoveis*`, `drawProp*`), arquivo removido e `.ts` fora de toda área. Gatilhos que forçam N2 em QUALQUER nível: `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `playwright.config.ts`, `porta.js`, `vitest.projetos.json`, `projetosDoVitest.*`, `client/e2e/helpers/**`, `client/e2e/fixtures/**`, `Cargo.lock`. Para forçar N2 na mão: `--nivel 2`.

**O N1 do lote roda sobre o RESULTADO UNIDO**: o orquestrador faz o merge do lote e roda `node scripts/teste-rapido.cjs --base <main de antes do lote>` no checkout do merge, não linha por linha contra o próprio merge-base. O script testa o checkout onde é chamado.

## O que o N1 NÃO cobre

O `vitest related` segue só o grafo de importação: CSS, PNG, JSON lido por caminho e `public/` ficam fora (por isso viram N2). Dependente não mudado nos projetos `lento`/`desempenho` só roda no N2. E2e fora da área do mapa só roda no N2 (o golden e as seladas rodam sempre). Mudança em `scripts/` (fora do app) cai no N2 pela lista branca.

## Projetos do vitest (`client/vitest.projetos.json`)

`rapido` é tudo que não está na lista: teste novo cai nele sozinho. **Teste lento** (> ~20 s): acrescente o glob em `lento` com o porquê. **Teste de tempo** (mede ms, mente sob carga): em `desempenho`; roda sozinho, em série (`maxWorkers: 1`), por último (`groupOrder: 1`), e uma falha roda de novo isolada 1 vez antes de reprovar. Arquivo que ainda vem de outra branch: `"pendente": "<branch>"`. A guarda `client/vitest.projetos.test.mjs` reprova glob sem arquivo, `pendente` que já chegou, arquivo em dois projetos e spec do mapa que não existe. Scripts: `npm run test:rapido | test:lento | test:desempenho | test:tudo` (em `client/`).

## Números (24/10/2026, 20 núcleos lógicos, fila com 8 agentes)

| Medida | Antes | Depois |
|---|---|---|
| vitest | completo 16min18s, 1738 arquivos / 17214 testes, 1 falha de tempo sob carga (`paredesDoDesenho`) | `related` no N0/N1: 1min53s a 2min15s (230 a 254 arquivos) · rapido+lento 12min33s · desempenho sozinho 34s, 0 falha |
| tsc app / e2e | 28s / 11s frio | 5s / 3s incremental quente (a 1ª incremental grava: 29s / 9s) |
| e2e | inteiro 34min36s (769 testes, 2 workers); vite dev sobe em 1,1 s | N1 Camadas 16 specs; N1 Sons 33 specs 9min38s (4 workers) |
| N0 / N1 / N2 | — | N0 (2 arquivos) 3min52s · N1 (Sons, 8 arquivos) 11min39s · N2 47min52s |

Paridade por NOME: 18952 linhas (arquivo + nome completo de cada teste) antes e depois, diff vazio; a única diferença é a guarda nova. O que pesa: `rasterDosMoveis.sementes*` soma 1362 s de 1770 s (77%) e o Mt4 sozinho (692 s, um teste de 225 s) é o caminho crítico do `lento`. No resto, o custo é ambiente e import, não teste: o relatório soma `environment 10645s, import 1537s, tests 1805s`. A atacar, nessa ordem: (1) `// @vitest-environment node` nos testes de lógica pura (o jsdom sobe por arquivo); (2) dividir as varreduras de sementes por peça em arquivos (paralelizam entre workers); (3) o `related` gasta ~2 min montando o grafo dos 1738 arquivos, e é isso que deixa o N0 acima de 90 s.

## e2e vermelhos pré-existentes

O e2e inteiro já falha na main: **154 testes** em 65 specs no N2 de 24/10/2026 (o orquestrador confirmou na main, porta 1420, cache quente). Estão em `client/e2e/vermelhas-conhecidas.json` (nomes `arquivo › describe › título`, como o reporter list imprime). **Decisão (orquestrador, 24/10/2026): a lista é um baseline, não uma anistia.** O conserto de causa é da triagem `a96045d4321beb493`; esta ferramenta só impede que o vermelho velho esconda um novo.

- **N0/N1** rodam com `playwright.conhecidas.config.ts`: o `grepInvert` pula cada conhecido por título EXATO (regex escapada; o Playwright casa "arquivo describe título" separados por espaço). Nada espera o timeout de teste já vermelho, e todo o resto tem de passar: falha ali é nova.
- **N2** roda TUDO com o config de sempre: PASSA se falhas ⊆ conhecidas, REPROVA listando as NOVAS, AVISA quando uma conhecida passou a passar (tire-a da lista).
- **Guarda:** golden, as 3 seladas e a fumaça nunca entram na lista; teste de spec de área pode entrar (o N1 o pula, o N2 o vigia). Teste conhecido de spec que não existe também reprova. Mudar a lista ou o config força o N2.

## N2 reprova uma main já integrada

1. Ache o culpado por bisseção entre as tags `pre-integra-N` (a última verde e a primeira vermelha): `git bisect start <vermelha> <verde>` + `git bisect run node scripts/teste-rapido.cjs --nivel 2 --so <tipo que falhou> --sem-fila` dentro de uma vaga da fila.
2. Desfaça com `git revert <commit culpado>` (ou `git revert -m 1 <merge>`), commit novo na main. **Nunca `reset --hard`**: a main é compartilhada pelos worktrees.
3. A linha culpada volta a rodar N2 antes de reintegrar.
