# Task 4 (selecionar-apagar) — Verificação do Step 5

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

## Conclusão

Os 6 passos do Step 5 e a condição "sem erro no console" têm evidência automatizada,
reproduzível e versionada (seção 1), rodando contra o mesmo código-fonte que o Tauri serve. O
app Tauri real compila e sobe (seção 2). O clique-a-clique humano dentro do webview nativo
continua como gap residual declarado — não maquiado como fechado — igual ao critério já aceito
para a Task 4 anterior neste mesmo repositório.
