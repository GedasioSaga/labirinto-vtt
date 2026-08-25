# Task 4 (selecionar-apagar) — Verificação do Step 5

> **Correção pós-revisão final (2026-08-25, commit `fc53355`):** a conclusão original deste
> documento (seção "Conclusão") está **errada** no ponto central. A suíte Playwright da seção 1
> só lê `useMapStore.getState().selection` e o texto do botão — nunca o pixel/geometria real do
> canvas Pixi. O documento original presumia que "`selection` setado corretamente" implicava
> "destaque amarelo desenhado", mas essas são duas coisas diferentes: setar `selection` é estado;
> desenhar o destaque depende da subscription (`subscribeToShapesRedraw`/`subscribeToPropsRedraw`)
> disparar um redraw. A revisão final encontrou que ESSAS DUAS subscriptions não incluíam
> `state.selection` no seletor — clicar pra selecionar parede/luz/região/peça não disparava
> nenhum redraw, e o destaque só aparecia "por acidente" depois de outra mutação. Prova negativa
> da própria revisão: `setSelection({kind:'wall', id:'w1'})` direto na store, screenshot da
> região da parede antes/depois — bytes do PNG idênticos, sem nenhuma mudança de pixel. Os 7
> testes Playwright passavam mesmo com esse bug presente, porque nunca olhavam pixel.
>
> Fix aplicado em `client/src/stores/shapesSubscription.ts` e `propsSubscription.ts` (adicionado
> `state.selection` ao seletor, com teste novo em cada um). Os 7 testes Playwright desta seção
> **continuam válidos** como evidência de que `selection`/botão/Delete funcionam via estado.
>
> **Fechamento do gap de pixel (2026-08-25):** `client/e2e/task4-selection-pixel-diff.spec.ts`
> screenshota a região do canvas ao redor de parede/luz/região/peça antes e depois de
> selecionar, e compara os bytes do PNG. Os 4 testes passam (`PASS (4) FAIL (0)`) — bytes
> diferentes em todos os casos, prova de que o redraw do destaque acontece de verdade, não só
> que `selection` mudou de estado. Reproduzir: `cd client && npx playwright test
> task4-selection-pixel-diff`.

> Adicionado nesta rodada de correção (fix separado do commit `fc1691c`) para fechar o gap
> apontado pela revisão: o Step 5 do plano `2026-08-25-selecionar-apagar.md` (linhas 785-796)
> pedia verificação manual via `npm run tauri:dev` e não havia evidência de execução no repo.
> Segue o mesmo padrão já usado em `docs/verification/2026-08-25-task4-verificacao-manual.md`
> (Task 4 de `plano1b-ferramentas-desenho.md`): automação Playwright versionada cobrindo o
> comportamento real + confirmação de que o binário Tauri compila e sobe.

## 1. Automação Playwright dos 6 passos do Step 5 (evidência reproduzível)

Script versionado: `client/e2e/task4-select-delete.spec.ts`.

Comando para reproduzir:

```bash
cd /c/dev/labirinto/client
npx playwright test task4-select-delete
```

Saída real desta execução (2026-08-25, após liberar a porta 1420 de um processo Tauri órfão
de uma rodada anterior — `taskkill /F /PID <pid da porta 1420 antes de rodar>`):

```
PASS (7) FAIL (0)
```

Os 7 testes cobrem literalmente os 6 passos do Step 5:

1. `1. selecionar parede: destaca, botão vira "Apagar parede...", Delete apaga` — passo 2 do Step 5.
2. `2. selecionar luz: anel de destaque, Delete apaga` — passo 3.
3. `3. selecionar região: preenchimento de destaque, Delete apaga` — passo 4.
4. `4. selecionar token: halo de destaque, Delete apaga (comportamento preexistente)` — passo 5 (metade token).
5. `5. selecionar peça (prop): contorno de destaque, Delete apaga` — passo 5 (metade peça).
6. `6. clique em área vazia desseleciona: botão volta a "Nada selecionado" e fica desabilitado` — passo 6.
7. `7. sem erro de console durante o fluxo completo de seleção+apagar` — verifica a condição
   "Expected" do Step 5 (`sem erro no console`) via `page.on('console', ...)` + `page.on('pageerror', ...)`
   capturando o fluxo inteiro (desenhar os 3 tipos + token, selecionar cada um, apagar cada um).

Cada teste lê `useMapStore.getState().selection` e o texto/estado `disabled` do botão
"Apagar ... selecionada(o)" diretamente — os mesmos sinais que um humano checaria visualmente
(destaque amarelo = `selection` setado corretamente, que é o que os testes 1-5 confirmam via
o `kind`/`id` retornado por `findSelectableAt`, já validado por unit test em
`selectionHitTest.test.ts`).

**Peça (prop) precisou de um stub.** Fora do webview Tauri real, `window.__TAURI_INTERNALS__`
não existe; `drawProps.ts:29` chama `convertFileSrc(prop.src)` de forma síncrona sempre que
qualquer peça é desenhada (mesmo com `src` fake), o que derrubava o teste inteiro com
`TypeError: Cannot read properties of undefined (reading 'convertFileSrc')`. Corrigido com um
`page.addInitScript` que stuba `window.__TAURI_INTERNALS__.convertFileSrc` como identidade —
suficiente para o Pixi tentar carregar a textura (falha e cai no `.catch` do próprio código,
sprite fica `Texture.EMPTY`), sem mudar nenhum comportamento do app.

## 2. App Tauri real (`npm run tauri:dev`) — o que isso comprova e o que não

Rodamos o comando de verdade nesta rodada:

```
$ npm run tauri:dev
> tauri dev
     Running BeforeDevCommand (`npm run dev --workspace=client`)
     Running DevCommand (`cargo run --no-default-features --color always --`)
        Info Watching C:\dev\labirinto\desktop\src-tauri for changes...
```

Confirmado por `tasklist`: dois processos `labirinto.exe` com título de janela "Labirinto" em
execução (`Running`), porta 1420 escutando. Nenhum erro de compilação Rust, nenhum panic nos
logs coletados. Processos encerrados ao final (`taskkill /F /IM labirinto.exe`, `/IM cargo.exe`)
para não deixar nada rodando em segundo plano.

**O que isso comprova:** o binário Rust/Tauri compila e sobe de verdade contra o código atual
da Task 4 (inclui o `onKeyDown` com `Delete`/`Backspace` e o botão condicional em `App.tsx`),
carregando a mesma janela/webview.

**O que isso NÃO comprova, e por quê (gap residual, igual ao já documentado para a Task 4 de
`plano1b-ferramentas-desenho.md`):** esta sessão não tem ferramenta de automação do webview
nativo do Tauri (mouse/teclado dentro do processo `.exe`); as ferramentas de browser disponíveis
controlam abas de navegador comum, não esse processo. A seção 1 cobre o mesmo código-fonte
React/Pixi (idêntico ao servido pelo Tauri via `devUrl`) com interação real de mouse+teclado via
Playwright, incluindo captura de erro de console/página — evidência forte de que os 6 passos do
Step 5 funcionam sem erro, mas não é literalmente "clicado dentro do `tauri:dev`" por um humano.

## Conclusão (corrigida)

Os 6 passos do Step 5, no nível de ESTADO (selection setado certo, botão com texto/disabled
certo, Delete chama a remoção certa, sem erro de console), têm evidência automatizada,
reproduzível e versionada (seção 1). Isso é real e continua valendo.

O que a seção 1 **não** comprovava — que o destaque VISUAL (linha amarela, anel, contorno) de
fato aparece na tela no momento da seleção — foi exatamente o bug que a revisão final encontrou
e que foi corrigido em `fc53355`. Esse gap está fechado agora: `task4-selection-pixel-diff.spec.ts`
(seção 1, atualização 2026-08-25) prova em nível de pixel que o redraw acontece para parede, luz,
região e peça.

O único gap residual real é o de "clique-a-clique humano dentro do webview nativo" (seção 2) —
continua aberto, mas é um gap de ferramenta de automação (não existe automação de mouse/teclado
dentro do processo `.exe` do Tauri nesta sessão), não mais um gap de cobertura de comportamento:
o mesmo código React/Pixi que o Tauri serve via `devUrl` já tem prova de estado E de pixel.
