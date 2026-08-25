# Task 4 — Verificação manual (Step 4 do plano `plano1b-ferramentas-desenho.md`)

> Correção de 2026-08-25 (commit desta rodada): a versão anterior deste documento (commit
> `33011a3`) reportava automação via Playwright sem nenhum artefato versionado no repositório
> (sem dependência em `package.json`, sem script commitado, sem evidência anexada) e substituía
> silenciosamente o `npm run tauri:dev` exigido pelo Step 4 por `npm run dev --workspace=client`
> (Vite puro), sem autorização do plano para essa troca. Este documento corrige os dois pontos:
> o script Playwright agora existe, está versionado e foi executado de fato (evidência abaixo);
> e o app Tauri real (`npm run tauri:dev`) foi executado nesta rodada — o que ele cobre e o que
> ele não cobre está descrito na seção 2.

## 1. Automação Playwright contra o Vite (evidência reproduzível)

Script versionado: `client/e2e/task4-drawing-tools.spec.ts` (+ `client/playwright.config.ts`).
Dependência real: `@playwright/test` em `client/package.json` (devDependencies), Chromium
instalado via `playwright install chromium`.

Comando para reproduzir:

```bash
cd /c/Dev/labirinto/client
npx playwright test
```

Saída real desta execução (2026-08-25):

```
Running 8 tests using 1 worker

  ok 1 task4-drawing-tools.spec.ts:46:1 › 1. ferramenta Parede: arrasto cria parede permanente
  ok 2 task4-drawing-tools.spec.ts:65:1 › 2. ferramenta Luz: um clique cria luz sem precisar arrastar
  ok 3 task4-drawing-tools.spec.ts:76:1 › 3a. ferramenta Região: 3+ cliques + duplo clique fecha o polígono
  ok 4 task4-drawing-tools.spec.ts:91:1 › 3b. ferramenta Região: Esc cancela o rascunho sem criar região
  ok 5 task4-drawing-tools.spec.ts:106:1 › 4. ferramenta Selecionar: pan de área vazia move a câmera
  ok 6 task4-drawing-tools.spec.ts:130:1 › 4b. ferramenta Selecionar: arrasto de token muda sua posição
  ok 7 task4-drawing-tools.spec.ts:152:1 › 5. colisão: token não atravessa parede recém-criada
  ok 8 task4-drawing-tools.spec.ts:194:1 › 6. evidência visual: parede + luz + região no canvas

  8 passed (8.2s)
```

Screenshot real gerado pelo teste 6 (`page.screenshot`), commitado em
`docs/verification/task4-e2e-evidencia.png`: mostra a parede branca, o círculo de luz laranja
translúcido e a região azul translúcida (triangular, 3 vértices) desenhados no mesmo canvas na
mesma execução — os três resultados permanentes descritos no Step 4 do plano.

**Nota honesta sobre a primeira tentativa desta rodada:** ao escrever o teste, as primeiras
versões dos cenários 1 e 3a falharam (0 paredes/regiões criadas) porque as coordenadas de
clique/arrasto caíam sobre o painel de ferramentas (HTML absoluto no canto superior esquerdo do
canvas), não sobre o canvas em si — o clique era absorvido pelo painel. Isso só apareceu porque
o teste desta vez é reproduzível e falhou de verdade; a versão anterior deste documento não
teria pego esse tipo de erro porque não deixava nenhum script para re-executar. Corrigido
deslocando os pontos de interação para fora da área do painel (`client/e2e/task4-drawing-tools.spec.ts:51-53,81-84,96-100`).

Método de leitura de estado (igual ao da versão anterior, agora dentro do script versionado):
`page.evaluate(() => import('/src/stores/mapStore.ts'))` — importa o módulo real do Vite dev
server e lê `useMapStore.getState()` diretamente, sem depender de leitura de pixel.

## 2. App Tauri real (`npm run tauri:dev`) — o que este documento cobre e o que não cobre

O Step 4 do plano pede literalmente `npm run tauri:dev`. Rodamos o comando de verdade nesta
rodada:

```
$ npm run tauri:dev
> tauri dev
     Running BeforeDevCommand (`npm run dev --workspace=client`)
     VITE v7.3.6  ready in 417 ms
     ➜  Local:   http://localhost:1420/
     Running DevCommand (`cargo run --no-default-features --color always --`)
        Info Watching C:\dev\labirinto\desktop\src-tauri for changes...
warning: labirinto (lib) generated 1 warning (linker message irrelevante, não afeta build)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1m 04s
     Running `target\debug\labirinto.exe`
```

Processo confirmado vivo no SO após o boot (`Get-Process -Name labirinto` retornou o PID real,
iniciado às 02:14, antes de ser encerrado ao final da verificação). Nenhum erro de compilação
Rust, nenhum panic, nenhum erro de runtime no log.

**O que isso comprova:** o binário Rust/Tauri compila e sobe de verdade contra o código atual,
carregando a mesma janela/webview que a Task 4 modificou — não é só "Vite subindo sem erro de
log" como no commit `4de75f8`.

**O que isso NÃO comprova, e por quê:** este agente não tem uma ferramenta de automação de
janela nativa (mouse/teclado dentro do webview do Tauri) disponível nesta sessão — as
ferramentas de browser existentes (Playwright, `claude-in-chrome`) controlam abas de navegador,
não o processo `.exe` do WebView2 aberto pelo Tauri. Os 5 cenários interativos rodando
literalmente dentro do binário Tauri não foram clicados por este agente. A seção 1 cobre o
mesmo código React/Pixi (idêntico, servido pelo mesmo Vite dev server que o Tauri usa via
`devUrl`) com interação real de mouse via Playwright — o que é uma evidência forte de que o
comportamento está correto, mas não é literalmente "os 5 cenários dentro do `tauri:dev`" que o
plano pede.

**Gap residual, declarado em vez de escondido:** clique-a-clique dentro do webview nativo do
Tauri requer verificação humana (ou infraestrutura adicional tipo `tauri-driver` + WebDriver,
não instalada nesta máquina) para fechar 100%. Recomendação: um humano rodar
`npm run tauri:dev` e repetir os 5 passos do Step 4 manualmente antes de considerar este item
plenamente fechado — ou aprovar explicitamente a evidência da seção 1 como suficiente.

## Conclusão

Os 5 comportamentos do Step 4 têm evidência automatizada, reproduzível e versionada (seção 1),
rodando contra o mesmo código-fonte que o Tauri serve. O app Tauri real compila e sobe (seção
2), mas a interação dentro do webview nativo em si não foi automatizada nesta rodada — gap
reconhecido explicitamente, não maquiado como fechado.
