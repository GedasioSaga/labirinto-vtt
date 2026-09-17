## Objetivo
"Fazer um programa não medíocre e funcional" (usuário, 14/09/2026): VTT com mapa SIMPLES estilo
minimapa Resident Evil. Fluxo principal: criar masmorra (salas, salas dentro de sala, portas,
caminhos coloridos) e jogar com os jogadores (LAN ou link público). Qualidade e uso real antes de
recurso novo; cortar ou esconder o que não serve.
Plano ativo: `C:\Users\gedasio.filho\.claude\plans\temporal-yawning-quiche.md` (fatia 1 feita; 2 e 3
pendentes).

## Estado atual (15/09/2026 ~15:45, sessão encerrada a pedido do usuário)
- **Git.** Branch `feat/menu-inicial`, último commit `3ef5007`, só local (sem push; o GitHub ainda
  está na tag `v0.1.0`). Árvore limpa, exceto este HANDOFF.
- **Commits do dia.**
  - `05da139`: ponto de salvamento (nitidez, consertos da auditoria, corte de recursos).
  - `2c39cd2`: nitidez de verdade + hachura vetorial. A hachura foi REJEITADA depois.
  - `3ef5007`: visual RE + cópia de Sala com paredes. APROVADO pelo usuário no exe ("Perfeito").
- **Visual atual.**
  - Chão chapado, marrom `#a8776a` por padrão; cor por Sala no painel.
  - Parede como linha fina clara com espessura em px de tela (`client/src/pixi/drawWalls.ts`).
  - Porta como retângulo: laranja fechada, vermelha trancada, contorno aberta
    (`client/src/pixi/drawDoors.ts`).
  - Mapa novo sem grade.
  - Nomes de sala e token com mínimo de 11 px na tela; somem abaixo de 30% de zoom
    (`pixi/screenLabel.ts`).
  - Linhas finas presas ao pixel físico (`pixi/pixelAlign.ts`); Text com resolução exata
    (`pixi/textResolution.ts`).
  - O estilo masmorra (hachura, pergaminho, parede grossa) foi APAGADO.
- **Painel.** Seção Avançado (`components/AdvancedSection.tsx`). Opções, Isometric/World, Link de
  cenário e ferramenta Token estão escondidos por flag em `lib/features.ts`. As 7 ferramentas de
  desenho ficam agrupadas no botão Desenho.
- **Duplicar Sala** (Ctrl+D e Alt+arrastar) copia as paredes e as portas (`lib/entityClone.ts`
  `cloneLinkedWalls`). As salas de dentro ainda NÃO vão junto (fatia 2).
- **Correção crítica do Pixi.** Destruir o app SEMPRE com
  `app.destroy({ removeView: true }, { children: true })`. Nunca `destroy(true)`: isso limpa o
  TexturePool global e quebra Text de outro app ("reading 'push'").
- **Exe.** `desktop/src-tauri/target/release/labirinto.exe` (15/09 15:36) corresponde ao `3ef5007`.
- **Portão do `3ef5007`.** tsc exit 0; vitest 124 arquivos / 1974 testes; playwright 180 passed;
  smoke no exe com erros `[]`.

## Como trabalhar neste projeto (regras do usuário; valem para toda sessão)
- **Estilo visual.** Minimapa Resident Evil: chão chapado numa cor, parede como linha fina clara,
  porta como retângulo pequeno, fundo escuro, sem grade por padrão. NUNCA hachura, pergaminho ou
  parede preta grossa.
- **Decisão visual.** Pergunte com opções e preview; se a resposta vier vaga, pergunte de novo. Não
  siga um plano antigo sem confirmar.
- **Agentes.** Só Opus, nunca Fable (inclusive `programador-frontend` e `designer-fable`). No máximo
  2 agentes ao mesmo tempo; prefira sequencial.
- **Ritual de cada fatia.** Teste verde NÃO é pronto.
  1. Fatia pequena, com plano aprovado.
  2. Portão: tsc, vitest e playwright, com Vite NOVO.
  3. `npm run tauri:build` na raiz.
  4. Smoke no exe com prints conferidos no olho.
  5. Abrir o exe para o usuário, com roteiro curto que ele responde bom/ruim/estranho.
  6. Só então commit e próxima fatia.
- **Antes do build.** Se o Labirinto estiver aberto, ele trava o exe: pedir ao usuário para fechar.
- **Antes do portão.** Um Vite antigo na porta 1420 (ou 1431) com HMR gera dezenas de falhas falsas
  no playwright: pare-o antes (`Get-NetTCPConnection -LocalPort 1420`).
- **Comandos** (dentro de `client`): `rtk proxy npx tsc --noEmit` · `rtk proxy npx vitest run` ·
  `rtk proxy npx playwright test`. Build: `npm run tauri:build` na raiz.
- **Smoke no exe.**
  - Script: `C:\Users\gedasio.filho\AppData\Local\Temp\claude\C--dev-labirinto\01dcb595-0521-47ac-95c4-ca885f731a25\scratchpad\exe-re-fatia1\smoke.mjs`.
    A pasta é temporária; se sumir, recrie.
  - Como funciona: abre o exe com `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`,
    conecta com `chromium.connectOverCDP`, clica Criar Mapas → Criar mapa, faz Sala com `N` +
    arrasto + Enter, e tira prints com Ctrl+roda (roda sozinha faz pan).
- **Vocabulário do usuário.** Linha branca = parede (bloqueia token e visão).

### Frente antiga: recriação de minimapa a partir de imagem (pausada, referência técnica)

**Ferramentas no app (client/src):**
- Chão por peças: `types/map.ts` (`FloorPiece`, formas rect/ellipse/polygon/corridor/poly,
  modificadores rounding/noise/grow), `lib/floorSdf.ts`, `lib/polygonSdf.ts`, `lib/floorContour.ts`,
  `pixi/drawFloor.ts`; UI ferramenta **Chão** (atalho `I`), `components/FloorPieceControls.tsx`.
- Entidades de minimapa: `MapData.lines` (contínua, pontilhada com `dotPeriod`/`dotWidth`/`dotHeight`),
  `MapData.markers` (porta retangular, poço elíptico), `MapData.frame` (moldura com título e
  `titleFont` ajustada), `FloorStyle.renderMode: 'raster'` + `strokeAlpha`/`lineAlpha`.
- Vetorização de imagem: `lib/traceImage.ts` (chão, cobertura subpixel), `lib/traceLines.ts`,
  `lib/traceMarkers.ts`, `lib/traceDetails.ts`, `lib/traceDark.ts` (escada/glifos/poço),
  `lib/traceDotted.ts` (pontilhado por período), `lib/refineLines.ts`, `lib/refineMarkers.ts`,
  orquestrador `lib/traceMinimap.ts`.
- Medir/calibrar na própria imagem: `lib/estimateStroke.ts`, `lib/calibrateMinimap.ts` (largura e
  recuo do contorno por render contra a imagem; escolhe detecção de linha pela nota).
- Pipeline único `lib/minimapFromImage.ts`, usado pelo botão **"Recriar minimapa a partir da imagem
  de fundo"** (`App.tsx` → `applyMinimapTrace`, 1 undo) e toggle **"Render fiel (minimapa)"**
  (`PixiCanvas.tsx` rasteriza com `lib/minimapRaster.ts`).
- Título da moldura: `pixi/frameTitle.ts` (bitmap girado, fonte escolhida por comparação).

**Harness:** `client/recreate/` + `playwright.recreate.config.ts` + `vite.recreate.config.ts` (porta
1422, sem HMR). Variáveis `RECREATE_*` escolhem a variante; `RECREATE_TAG` grava em
`Tentativa/variantes/<tag>/`, sem tag grava a tentativa principal em `Tentativa/`.
Melhor configuração até agora: `RECREATE_DOTTED=1 RECREATE_LINE_DETECT=auto RECREATE_CALIBRATE=1
RECREATE_DARK=1 RECREATE_RASTER=1 RECREATE_COVERAGE=1 RECREATE_SUBPIXEL=1 RECREATE_BORDER_RADIUS=2
RECREATE_STROKE=#858585`.

## Próximos passos
**A FILA OFICIAL AGORA VIVE EM `C:\dev\labirinto\PEDIDOS.md`** (seção "Fila nova"). Fatia 2
commitada em `c8a990b` (aguardando teste do usuário). Em andamento (15/09/2026 noite): conserto
dos 2 defeitos de desenho (operario) e diagnóstico de visão do jogador/luz/porta da casa/escada
(debugador, `scratchpad/diag-usuario/`). O texto abaixo é histórico desta sessão.

FATIA 2 EM ANDAMENTO (15/09/2026, após "Pronto, pode continuar com as melhorias"): 1 `operario`
Opus; prints do fluxo pela UI em `scratchpad/fatia2/` desta sessão; depois portão, build, smoke e
teste do usuário.
- 1ª entrega (sem commit): `Region.parentId`, `lib/roomNesting.ts` (+19 testes),
  `stores/subRoom.test.ts` (11), mapFactory addRoom/removeRegion/moveRegion por subárvore,
  areaSelection sem mover 2x, `cloneRoomDescendants`, `pendingParentRoomId` + botão "Criar sala
  dentro" + "Dentro de:" no painel, aviso de sala fora via toast, `drawRegions.ts` reordena cache
  pela ordem do array, fogFilter por ancestral, `e2e/task-sub-sala.spec.ts`. Agente relatou tsc 0,
  vitest 126 arquivos / 2005, playwright 184 passed.
- OLHAR DE USUÁRIO achou bug grave antigo (print `scratchpad/fatia2/07-casa-movida.png`): parede
  com porta perde o vínculo com a sala (`mapFactory.ts:643` addDoorOnWall zera regionId), então
  mover/apagar/duplicar a Casa deixa portas e paredes para trás. Pedido ao mesmo agente: pedaços
  herdam o vínculo, `roomLink.ts` reposiciona pedaços proporcionalmente, migração de mapa antigo
  (parede contida numa aresta de uma única Sala é revinculada), recalcular mãe ao arrastar
  sub-sala, Ctrl+D de Sala desloca pela largura + 1 célula. Prints em `scratchpad/fatia2b/`.
- 2ª entrega (sem commit): `roomLink.ts` reescrito (aresta com vários pedaços,
  `syncLinkedWallsToPoints`, `linkLooseWallsToRooms` na migração de `mapFile.ts`), `addDoorOnWall`
  mantém vínculo, `smoothRegion` preserva portas, `reparentRoom` + recálculo da mãe no fim do
  arrasto/setas, Ctrl+D de Sala ao lado, `groupWallChains` só encadeia pedaços que encostam.
  Decisão do agente: ao virar sala de topo, arestas sem parede ganham parede (pode recriar parede
  apagada de propósito). Prints conferidos pelo orquestrador (`fatia2b/04-casa-movida.png`,
  `06-ctrl-d-casa.png`, `07b-quarto-selecionado.png`): porta e paredes acompanham, cópia ao lado.
  Portão do orquestrador: tsc exit 0; vitest 127 arquivos / 2021 passed; playwright 188 passed
  (3,1 min, `fatia2b/pw-gate.log`). Varredura curta (1 `revisor` correção) em andamento. App do
  usuário aberto (pid 33100) bloqueia o build: pedir para fechar. Fora do escopo anotado: arrastar
  no centro de sala pequena pega o rótulo do nome; redimensionar a mãe não recalcula filhas; sala
  parcialmente sobre outra fica com a parede da outra por cima.
- Varredura curta da fatia 2 (revisor): 4 médios + 1 baixo, sem repro ainda — reparentRoom early
  return deixa aresta sem parede ao mover filha na mesma mãe (`mapFactory.ts:~380`, também
  resizeRoomDimensions); `wallsForUncoveredEdges` fecha buraco apagado de propósito (`:~406`);
  aresta antiga de comprimento zero colapsa pedaços no arrasto de vértice (`roomLink.ts:~41`);
  `remapForInsert` parte porta ao meio (`:~140`); `remapForRemove` estica pedaço parcial (`:~184`).
  Limpos: ciclo de parentId, undo com 1 entrada, jogador com filhas de secreta, migração com sala
  compartilhada. Enviado ao mesmo operario: teste que reproduz antes de cada fix.
- Os 5 REPRODUZIDOS e corrigidos (`client/src/stores/reviewFatia2.test.ts`, 7 testes que falhavam
  antes): reparentRoom sem early return + chamado com mapa de antes em mover/setas/Ctrl+D/
  redimensionar/fim de arrasto/Alt+arrastar; parede nova só em aresta coberta pela mãe antiga e
  descoberta pela nova; aresta degenerada não esmaga pedaços; porta não é partida (vértice novo vai
  para a ponta da porta); remapForRemove simples só com parede cobrindo a aresta inteira. Pendente:
  arrasto de vértice não recalcula mãe/arestas cobertas. Portão do orquestrador: tsc exit 0; vitest
  128 arquivos / 2029; playwright 188 passed (3,5 min, `fatia2b/pw-gate2.log`). App do usuário
  aberto (pid 33100): build feito com `CARGO_TARGET_DIR=scratchpad/target-f2` para não fechar o app
  dele; smoke da fatia em `scratchpad/exe-fatia2/smoke.mjs <exe>` (CDP 9223).
- DISCO CHEIO (15/09/2026): 1º build em `target-f2` falhou com "Espaço insuficiente no disco (os
  error 112)"; C: com 0,00 GB livres de 476 GB. Com autorização do usuário foram apagados
  `desktop/src-tauri/target/debug` (3,2 GB), cache do npm (`npm cache clean --force`, 2,4 GB) e
  `%LOCALAPPDATA%\Temp\claude\C--Users-gedasio-filho-DesktopVertis` (11,2 GB): livre 13,94 GB.
  Fechar o app pelo botão (CloseMainWindow) não fechou (pid 33100 respondendo; talvez aviso de
  salvar dentro do app) — não foi forçado. Build refeito em `scratchpad/target-f2`
  (`fatia2b/build2.log`). Ao terminar a sessão, a pasta `target-f2` pode ser apagada (~2-3 GB).
- Build `target-f2` exit 0 (exe 15/09 18:17). 1º smoke falhou "CDP nao conectou": com outro
  Labirinto aberto o WebView2 reaproveita o processo dele; resolvido com
  `WEBVIEW2_USER_DATA_FOLDER` próprio no smoke. Smoke da fatia 2 no exe: Sala grande + Sala dentro
  ("Dentro de:" no painel, sem parede dupla), Ctrl+D copia as duas ao lado, zoom 43%, erros `[]`
  (prints `scratchpad/exe-fatia2/`). Olhar de usuário notou (não corrigido): toda sala nova se
  chama "Sala", então "Dentro de: Sala" fica ambíguo; o nome da sala de fora fica no centro da
  caixa e cai sobre o canto da sala de dentro; a cópia do Ctrl+D pode nascer fora da tela. Exe
  aberto para o usuário a partir de `target-f2`. SEM COMMIT: aguardando teste da fatia 2.
- NOVAS REFERÊNCIAS (15/09/2026 18:24): `Objetivo/` foi trocado pelo usuário por 3 mapas do Zelda
  em AVIF (`mapa1png.avif` Kakariko Village, `mapa2.avif` Lake Hylia, `map3.avif` Kokiri Forest;
  pixel art com contorno em escadinha, papel de fundo, etiquetas). PNGs convertidos com ffmpeg em
  `scratchpad/objetivo/`. As tentativas antigas em `Tentativa/` são dos mapas RE anteriores.
  Pedido: "ignore a coloração, foque no formatos e tente desenhar, usando as ferramentas do mapa de
  resident". EXPERIMENTO em andamento (1 `operario` Opus, sem tocar em client/src): analisar
  blocos, desenhar pela UI com Sala Polígono/Chão/Sala/Parede/Região, medir IoU de formato, prints
  lado a lado em `Tentativa/zelda/` e lista de fricções do usuário.
- RESULTADO DO EXPERIMENTO ZELDA (desenhado pela UI, a store foi só lida; grade 48 px/bloco;
  scripts em `scratchpad/zelda/`):
  - IoU de formato renderizado: Lake Hylia 0,986 (Região, 144 pontos; ou Chão por 49 retângulos),
    Kakariko 0,932 (130 pontos, 13/14 salas), Kokiri 0,966 (154 pontos, 26/27).
  - Silhueta e saídas batem. O detalhe interno sai ruidoso: cercas diagonais viram escadas de
    paredes curtas com "cruzinhas", e casas não retangulares viram Região sem parede.
  - Fricções, em ordem de dor:
    1. silhueta em escadinha custa ~130-154 cliques; não há pintar por blocos nem polígono livre
       para Sala ou Chão (Q é polígono regular);
    2. não dá para desfazer o último ponto no rascunho de Região;
    3. o campo de nome da Sala nova "come" o próximo arrasto quando o zoom é baixo;
    4. não existe Sala de forma livre, então sala dentro de sala só funciona com retângulos;
    5. o snap vem desligado e o rótulo dele é enganoso;
    6. o ímã de vértice da parede é fixo em 12 px de mundo e puxa cercas pequenas;
    7. Região nova nasce da mesma cor da de baixo;
    8. F (enquadrar) ignora o painel e a barra.
  - Bugs:
    1. arrastar Sala logo abaixo de uma Sala recém-criada (zoom ~20%) não cria nada
       (`scratchpad/zelda/repro-nome.cjs`);
    2. Ctrl+Z durante o rascunho de Região apaga a última Sala e mantém o rascunho;
    3. Salvar no navegador dá erro cru do Tauri ("reading 'invoke'"), só no navegador;
    4. Importar imagem de fundo no navegador não faz nada nem avisa, só no navegador.
Ordem sugerida ao usuário:
1. **Fatia 2: salas dentro de sala.** Detalhes no plano ativo.
   - `Region.parentId?`.
   - Lib pura `lib/roomNesting.ts`: contenção, sala mais funda, índice depois da subárvore, aresta
     sobre parede da mãe sem parede duplicada.
   - Detecção nos 3 caminhos de sala (`PixiCanvas.tsx` buildRoomFromDraft ~2274 e circular/polígono
     ~2318).
   - Botão "Criar sala dentro" em `RoomControls.tsx`, com `pendingParentRoomId` no store.
   - A filha herda a cor e pode trocar.
   - Mover a mãe move as filhas; apagar a mãe apaga as filhas num único Ctrl+Z; mãe
     secreta/oculta esconde as filhas para o jogador (`lib/fogFilter.ts` ~406).
   - Painel "Dentro de: <mãe>".
   - A cópia de Sala leva as filhas.
2. **Conferir no olho a tela do jogador** com o visual novo: abrir o player, criar sala e tirar
   prints. Até agora só os e2e passaram.
3. **Fatia 3: caminhos coloridos.** `Drawing` kind `'path'` com `widthCells` (0,5/1/2), cor própria
   (`pathColor`, padrão `#d9c7a3`), camada acima do chão/regiões e abaixo da grade/paredes, sem
   bloquear token. Ferramenta "Caminho" ponto a ponto (Enter/duplo clique termina).
4. **Painel.** Remover "Nada selecionado" e montar um bloco por objeto (Nome > Visível para jogadores
   > Aparência > Avançado > Apagar). Plano antigo com as fatias 4a-4d:
   `C:\Users\gedasio.filho\AppData\Local\Temp\claude\C--dev-labirinto\201c847f-22a8-4467-9dd3-2780a9d65396\scratchpad\decisoes\plano.md`.
5. **QR da sala aponta para o IP da VPN** (`desktop/src-tauri/src/commands.rs:264`): o celular pode
   não entrar.
6. **Push e release novos no GitHub:** SÓ com pedido explícito.
- **Pendências menores:**
  - nome do token com pouco contraste sobre chão claro;
  - nomes de zona oculta sem a regra de tamanho mínimo;
  - grade hex/tri sem alinhamento ao pixel;
  - `client/recreate/renderFloorPng.ts:360` ainda usa `app.destroy(true)` (harness isolado);
  - comentário "pergaminho" em `pixi/drawLights.ts:14`;
  - contorno da porta aberta inverte a zoom ≤ 5%.
- **Ideia a oferecer** (o usuário perguntou como manter o olhar de qualidade): criar `CLAUDE.md` no
  repo com a seção "Como trabalhar" acima e mover o smoke do exe para dentro do repo
  (ex. `scripts/exe-smoke.mjs`, com a pasta de saída como argumento). Aguardando a resposta dele.

### Histórico de próximos passos da frente de recriação (pausada)
- Ler as variantes `gap-title` (grade) e `gap-title-rooks` (n-torres): correção de ligação de
  pontilhado por cima de fundo + fonte do título ajustada. Promover a melhor como principal.
- Maior fonte de erro restante: borda do chão antisserrilhada (55–82% dos pixels errados), depois
  linhas cinzas antisserrilhadas no Mapa3 (41%). Ideia seguinte: ajuste subpixel dos vértices do
  contorno do chão pelo traço cinza (como `refineLines`).
- Buraco 16/17 do mapa1: fresta de 12 px cuja conectividade depende de 1 pixel antisserrilhado.
- Validar o botão "Recriar minimapa" dentro do Tauri com imagem real (fora do Tauri o
  `convertFileSrc` não carrega a imagem).
- Etapa 5 (jogável multiplayer) só depois do critério de pronto. Reconhecimento (14/09/2026): nada
  existe — sem transporte (nenhum WebSocket/servidor, nenhuma dependência de rede no client nem em
  `desktop/src-tauri/Cargo.toml`), sem sala/jogador, `mapStore.ts` 100% local, `OptionsScreen.tsx`
  é maquete desabilitada, `lib.rs` só expõe `grant_fs_access`. Decisões de transporte/autoridade de
  estado/protocolo ainda por tomar (plan mode + grilling antes de codar).
- Variante `analytic` (cobertura exata por semiplano do chão em `lib/minimapRaster.ts`,
  `RECREATE_PATTERN=analytic`) CONFIRMOU a hipótese da quantização: cor 98,50% / 95,54% / 96,00%
  (antes 98,32 / 95,02 / 95,51), IoU 0,9962 / 0,9933 / 0,9961; mas mapa2 buracos 7/8 (a ponte sob a
  porta em x≈312–323, y≈514–557 funde 2 buracos quando a calibração escolhe recuo 0,3).
- NEGATIVO — linhas e portas também com cobertura exata (`analytic2`): 98,49% / 95,58% / 95,81% e
  Mapa3 buracos 8/16 (barra preta fina com cobertura fracionária não escurece o pixel central).
  Ficou opcional (`analyticShapes`), padrão só o chão exato.
- Proteção de topologia (`analytic-topo`: `RECREATE_TOPOLOGY=1 RECREATE_PATTERN=analytic` + melhor
  configuração): calibração devolve candidatos ordenados (`ranked`) e o harness fica com o primeiro
  cujo render tem ilhas/buracos iguais à referência (`lib/maskTopology.ts`). RESULTADO: topologia
  certa nos 3 pela primeira vez — mapa1 cor 98,30% IoU 0,9960 buracos 17/17 ilhas 14/14 · mapa2
  95,47% IoU 0,9931 8/8 1/1 · Mapa3 96,00% IoU 0,9961 16/16 4/4. Critério de silhueta cumprido nos
  3; falta a cor por pixel perto de 100%. Promovida a tentativa principal (rodada sem tag):
  `npx playwright test -c playwright.recreate.config.ts` → **3 passed** (IoU, ilhas e buracos) em
  14/09/2026 00:50. Editor também usa borda exata no Render fiel e proteção de topologia no botão
  "Recriar minimapa" (vitest 85 arquivos / 1462 passed, typecheck exit 0).
- Erros restantes na principal: borda 3720/2523/3805 px, linha cinza 298/1028/3412, título 119 (mapa1).
- NEGATIVO — cobertura exata também nas linhas cinzas/portas (`analytic3`, `RECREATE_ANALYTIC_SHAPES=1`):
  98,29 / 95,51 / 95,96% (igual). Erro de linha cinza não é quantização: é largura/cor da linha.
- NEGATIVO — largura/cor das linhas cinzas calibradas por render (`calib-lines`,
  `RECREATE_CALIB_LINES=1`): 98,30 / 95,48 / 96,00% (igual; larguras escolhidas ≈ medidas). Erro de
  linha cinza restante é detecção/posição local, não estilo global.
- PLATÔ: todas as alavancas globais testadas empatam. Silhueta/ilhas/buracos passam nos 3; cor
  98,3/95,5/96,0%.
- DECISÃO DO USUÁRIO (14/09/2026): recriação ACEITA como replicada nesses números. Multiplayer:
  mestre hospeda na LAN (servidor WebSocket dentro do app Tauri), jogadores entram pelo NAVEGADOR
  (página servida pelo app do mestre), primeira entrega = mapa + tokens (jogador move só o próprio,
  mestre move tudo, colisão) + NÉVOA por visão do token (raycast). Planta do chão vai inteira ao
  jogador; colisão pelo centro do token (confirmado). Plano APROVADO:
  `~/.claude/plans/valiant-enchanting-patterson.md` (E1 transporte axum/WS no Tauri → E2 espelho +
  atribuição → E3 movimento autoritativo → E4 névoa → E5 robustez).
- Em execução (14/09/2026): E1 com `engenheiro-desktop` (desktop/, client/player.html,
  client/src/player/, vite.config.ts) e, em paralelo, lógica pura E3/E4 com `programador-frontend`
  (client/src/lib/{moveValidation,visibility,fogFilter}.ts + testes). Integração
  (mapStore/PixiCanvas/App) fica no main thread.
- Primeira tentativa dos 2 agentes travou (watchdog 600 s sem progresso, nada gravado); relançados.
- E3/E4 lógica pura PRONTA: `validateTokenMove`, `computeVisibility`/`visionSegments`,
  `filterMapForPlayer`/`filterMapForHost`; 23 testes (9+6+8); vitest completo 88 arquivos / 1486
  passed; typecheck exit 0. Benchmark visão 800 segmentos × 8 origens = 13,3 ms (meta E5 < 8 ms).
  `token.x,y` é o centro do token (confirmado: `pixi/tokensRenderer.ts:83`, `anchor.set(0.5)`).
- E2 parte pura PRONTA: `client/src/net/protocol.ts` (`parsePlayerMessage`, tipos, limites) e
  `client/src/net/hostSession.ts` (`createHostSession` → handleMessage/assignToken/kick/broadcast/
  listPlayers; devolve `{outbound, applyMove?}`); 39 testes; vitest 90 arquivos / 1525 passed;
  typecheck exit 0. Falta: ponte Tauri (`hostBridge.ts` com eventos `net:message`/`net:peer` e IPC
  `net_*`), `RoomPanel.tsx`, render do jogador em `client/src/player/`, aplicar `applyMove` no
  `mapStore` e chamar `broadcast` quando o mapa muda.
- E1 transporte PRONTA (relatório do agente): `desktop/src-tauri/src/net/{mod,server,commands}.rs`
  (axum 0.8.9 + WS, porta 7777, Origin==Host e Host IP/localhost, 16 conexões, 30 msg/s, 64 KB,
  join em 10 s), IPC `net_start_room|net_stop_room|net_send|net_kick`, eventos `net:message` e
  `net:peer` (este com `name`), `tests/net_server.rs`; `client/player.html` +
  `client/src/player/main.tsx` (formulário de entrada); Vite com 2 páginas. Portão: clippy exit 0,
  cargo test 5+5, typecheck 0, vite build com player.html. Em dev o `/player` lê `client/dist` se
  existir (rodar `npx vite build` antes de testar no celular). Pendente manual: celular na LAN +
  firewall do Windows.
- Em execução: `hostBridge.ts` + `RoomPanel.tsx` (mestre) e página de jogo do jogador
  (`client/src/player/`). `cargo test` conferido no main thread: 5 unitários + 5 integração ok.
- Ponte do mestre PRONTA (`client/src/net/hostBridge.ts`, `client/src/components/RoomPanel.tsx`,
  12 testes) e INTEGRADA no `App.tsx` (ponte sob demanda, `RoomPanel` só com `isTauri()`,
  `applyMove` → `setTokenPosition`, assinatura do mapa → `notifyMapChanged`): typecheck exit 0,
  vitest 92 arquivos / 1537 passed, playwright normal 113 passed.
- Página de jogo do jogador PRONTA (agente): `client/src/player/{playerConnection.ts (+14 testes),
  PlayerView.tsx, main.tsx}` — raster do chão, névoa por máscara inversa dos polígonos de visão,
  tokens como círculo+nome (imagem local do mestre não abre no navegador), pan/zoom, arrastar token
  com movimento otimista, resume em sessionStorage, reconectar. vitest 93 / 1551 passed, typecheck 0,
  vite build com player.html.
- E2e `client/e2e/task-player-page.spec.ts` (page.routeWebSocket + `createHostSession` real) PASSA:
  join → espera; snapshot sem token alheio (névoa no payload) e 1 polígono de visão; arrasto aceito;
  arrasto cruzando parede → rejected `wall`; sem erro de página. Suíte e2e 114 passed, typecheck 0.
  Bug corrigido: tela branca após mover (Pixi `Text.destroy` a cada redraw) — `PlayerView.tsx` agora
  reaproveita a view do token por id. Pendentes em correção: paredes não desenhadas para o jogador
  (`PlayerView.tsx:36,45-53`), falta de error boundary (`main.tsx:81`), token saindo da visão.
  Screenshots em `client/test-results/player-page/{espera,mapa,depois-mover}.png`.
- Correções PRONTAS: paredes/portas desenhadas para o jogador (`PlayerView.tsx`, cor da parede
  #858585 do minimapa), `client/src/player/ErrorBoundary.tsx` (Recarregar/Reconectar), token que sai
  da visão não é mais destruído (reaproveitado). E2e estendido (3 paredes, token some e volta 2×).
  Portão do agente: e2e página 1 passed, e2e completo 114 passed, vitest 93/1551, typecheck 0.
- Estado do multiplayer: E1–E4 funcionais e testados (Rust 5+5, vitest, e2e com WS simulado e
  sessão real do mestre). E5 parcial: resume/reconexão, ping 15 s, kick e dica de firewall existem;
  benchmark de visão OTIMIZADO: `computeVisibility` 16,9 → 7,0 ms (mediana de 3, mesma carga; meta
  < 8 ms), poda por arco angular + busca binária, resultado idêntico à versão antiga (60 cenários com
  seed + casos-limite, tolerância 1e-6); `fogFilter` 44,4 → 16,1 ms com corte por caixa envolvente.
  vitest 93 / 1554 passed, typecheck 0.
- REVISÃO (correção/segurança) achou bloqueador: `clientId` u64 no Rust chega como número e o TS
  (`hostBridge.ts:103`) descarta → nenhum join funcionaria no Tauri real (testes usavam 'c1'). Também:
  coordenada 1.7e308 trava o mestre (`moveValidation.ts:36`), duplo "Abrir sala" cria 2 salas,
  16 sockets mudos bloqueiam a sala (`server.rs:174`), camadas ocultas e caminhos locais vazam
  (`fogFilter.ts:85`), + baixas. Correções em execução em 2 frentes (Rust em desktop/, TS em client/),
  contrato: clientId STRING dos dois lados.
- Correções Rust PRONTAS (agente): clientId string (`commands.rs:38,79`), pendentes 4/IP e 32
  total com join em 5 s e vaga de jogador só após join (`server.rs:29,87,262,302`), kick sem erro
  duplicado, nome em UTF-16, bind por IP privado + 127.0.0.1 (`server.rs:181`, campo `warning` novo
  ainda não exibido no TS). clippy estrito exit 0, cargo test 7+7 (conferido no main thread).
- Correções TS PRONTAS (agente): clientId string com teste do payload real do Rust
  (`hostBridge.ts:52,58,122,145`), `outside_map` + teto de 10 000 amostras (`moveValidation.ts`),
  start/stop sem corrida (`hostBridge.ts:162-198`), camadas ocultas e caminhos locais fora do payload
  (`fogFilter.ts:141-165`), geometria testada por caixa (`fogFilter.ts:121-139`), `lobby.waiting` ao
  perder token (`hostSession.ts`), kick tratado e `net_send` antes de `net_kick`, join inválido
  expulso. Portão do agente: vitest 93/1579, typecheck 0, e2e página 1 passed, e2e completo 114.
- ESTADO: multiplayer E1–E5 implementado, revisado e corrigido. Verificação ponta a ponta REAL em
  execução: `tauri dev` com `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`,
  Playwright `connectOverCDP` no app real (abre sala, atribui token) + Chromium em
  `http://127.0.0.1:7777/player` (entra, move token, parede bloqueia). RESULTADO (14/09/2026): PASSOU
  — sala `64F7EA` com 4 URLs de IP privado; `/player` HTTP 200 pelo axum; jogador entra → espera →
  jogando após atribuição; `data-tokens-count=1` (Vilão atrás da parede escondido), `walls=1`; arrasto
  válido move Heroi 250→350 no store do mestre; arrasto atravessando parede não muda posição e a
  página desfaz; zero exceção de página; processos encerrados. Script
  `scratchpad/e2e-real.mjs`, screenshots `scratchpad/e2e-real/`. Fica fora só celular/firewall.
- Defeito visual achado no app real (RoomPanel vazando do cartão) CORRIGIDO: `RoomPanel.tsx:43,63,70`
  (classes `lb-panel lb-section lb-room lb-scroll`), `main.css:982-1006` (max-height 45vh, rolagem,
  URLs quebrando, QR 140px). Script real repetido (`scratchpad/e2e-real-2.mjs`): passou (sala ZJ8J3G,
  /player 200, token atribuído, 1 token + 1 parede para o jogador, arrasto 250→350, parede bloqueia,
  zero erro de console). typecheck 0, playwright 114 passed, processos encerrados.
- ESTADO FINAL: recriação aceita; multiplayer LAN funcional e verificado no app Tauri real + navegador
  real na mesma máquina. Único não verificado: celular em outra máquina da LAN / firewall do Windows.
  Nada commitado.
- INSTALADOR PRONTO (14/09/2026): `npm run tauri:build` gera
  `desktop/src-tauri/target/release/bundle/nsis/Labirinto_0.1.0_x64-setup.exe` e
  `bundle/msi/Labirinto_0.1.0_x64_en-US.msi` (sem assinatura digital: SmartScreen avisa). Bundle
  ligado em `tauri.conf.json` (nsis+msi, ícones, WebView2 por bootstrapper); identificador mantido
  `com.labirinto.app` para a versão instalada enxergar os mapas já salvos. O 1º build falhou por
  disco cheio; `cargo clean --profile dev` liberou 10,3 GB (autorizado pelo usuário).
- GitHub, decisões do usuário: repo PÚBLICO `GedasioSaga/labirinto-vtt`; só código (`.gitignore`
  exclui `Objetivo/`, `Tentativa/`, `.genesis/`); commit na `feat/menu-inicial` → merge na branch
  principal → push; instalador como tag `v0.1.0` + GitHub Release com `.exe` e `.msi`. Varredura de
  segredos com rg: sem achados (gitleaks não instalado). Depois da cor da parede #858585: e2e da página 1 passed, vitest
  93/1551 passed (conferido no main thread). FALTA teste real: `npx vite build` → `npm run tauri:dev`
  → "Abrir sala" no painel → abrir `http://IP:7777/player` num celular na mesma rede (liberar o app
  no Firewall do Windows, rede Privada).
- Integração (feita conforme planejado): em `App.tsx` criar o bridge com
  `invoke`/`listen` reais, `getMap = () => useMapStore.getState().map`, `applyMove =
  useMapStore.getState().setTokenPosition` (`stores/mapStore.ts:853`, colisão já validada);
  `useMapStore.subscribe((s) => s.map, () => bridge.notifyMapChanged())`; montar `RoomPanel` junto
  do `PropertiesPanel` (`App.tsx:840`), tokens = `map.tokens`. Depois: `npx vite build` + `tauri
  dev` + celular na LAN (manual).

## Critério de pronto
Vale para cada fatia. Um terceiro consegue verificar, desde que tenha acesso ao usuário para o
item 3.
1. **Portão.** Dentro de `client`, com Vite novo: `rtk proxy npx tsc --noEmit` exit 0;
   `rtk proxy npx vitest run` com 0 falhas; `rtk proxy npx playwright test` com 0 falhas.
2. **Build e smoke.** `npm run tauri:build` exit 0 ("Finished 2 bundles"). Smoke no exe com
   `errors: []` e prints a 100%/38%/300% salvos e conferidos.
3. **Usuário.** Aprova no exe aberto: responde "bom" (ou equivalente, ex. "Perfeito") aos itens do
   roteiro.
- **Fatia 2** (além disso):
  - `lib/roomNesting.test.ts` verde;
  - `e2e/task-sub-sala.spec.ts` verde: desenhar dentro vira filha com a cor da mãe; o clique
    seleciona a filha; o botão arma e cria; mover a mãe move a filha; apagar a mãe apaga as duas
    e Ctrl+Z traz as duas de volta.
- **Fatia 3** (além disso): `e2e/task-caminho.spec.ts` verde: caminho de 3 pontos com cor e largura,
  acima da sala e abaixo da parede por amostra de pixel, token atravessa, jogador recebe.

Critério antigo (frente de recriação, pausada): para os 3 mapas, `cd client && npx playwright test -c playwright.recreate.config.ts` com a melhor
configuração: IoU ≥ 0,97, ilhas e buracos iguais ao objetivo, cor por pixel perto de 100% dos pixels
com tinta e inspeção lado a lado sem diferença visível. Gate normal verde: `npm run typecheck`
exit 0, `npm run test` 0 falhas, `cd client && npx playwright test` 0 falhas.

## Evidência
- Laser só com botão esquerdo (pedido do usuário após testar): L/botão Laser só ARMAM (cursor
  crosshair, nada é enviado); rastro só com botão esquerdo pressionado, sem acionar a ferramenta;
  soltar/blur/desarmar envia um único off. Arquivos: `pixi/laserGesture.ts` (novo),
  `stores/laserStore.ts` (drawing), `pixi/PixiCanvas.tsx`, `App.tsx`, `RoomPanel.tsx`. Testes:
  `laserStore.test.ts` (3), `hostBridge.test.ts` (+3), `e2e/task-master-laser.spec.ts` (3,
  reescrito); mordida provada (emitir armado sem botão -> 2 falhas vitest e 3/3 e2e). tsc 0/0;
  vitest 103 arquivos / 1783; playwright 133 passed.
- Fase A + B (workflow `wf_8528625b-063`, retomado após queda de rede, 11 agentes só Opus):
  portão A aprovado na 2ª rodada (tsc 0; vitest 98 arquivos / 1719; playwright 127 passed);
  portão B aprovado na 1ª (vitest 102 / 1766; playwright 131 passed; mutações m1/m2/m3 em cópia
  isolada pegas pelos testes de segurança). Revisor de segurança: 3 MÉDIOS (sombra da visão revela
  sala secreta/zona; "Revelar planta" e marcadores/linhas/escadas vazam sala secreta; chão sem
  filtro) e 3 BAIXOS (nome da sala na borda da zona, parede/traço só pelo ponto médio, nome repetido
  no sinal) — CORRIGIDOS por 1 agente `operario` (opus): visão enviada sem paredes de sala
  secreta/zona ativa (a visão com todas as paredes ainda decide o que sai), `playerBlockedRings`
  (zonas ativas + salas secretas) em `markRings`/`markAll`, marcadores/linhas/escadas e chão
  filtrados, nome zerado em sala majoritariamente na zona, parede/traço testados nas duas pontas,
  sufixo " (2)" para nome repetido; 10 testes novos que falhavam antes; vitest 1776, playwright
  131/131. Sobra corrigida no main thread: sinal dentro de sala secreta não é repassado
  (`hostSession.ts` handleSignal usa `playerBlockedRings`; teste "sala secreta não é repassado"
  falhou com a regra antiga e passa com a nova); tsc client/e2e 0; vitest 102 arquivos / 1777. Suíte Playwright tem intermitência sob
  carga ("Resulting promise was garbage collected", ERR_NETWORK_CHANGED) sem relação com o código.
- Tela do jogador parte 1 (workflow `wf_f34be423-e3d`, 8 agentes, só Opus, portão aprovado na 3ª
  rodada): tsc client e e2e exit 0; vitest 96 arquivos / 1668 passed; playwright 118 passed (inclui
  `task-player-map.spec.ts`). Screenshots `scratchpad/jogador-parte1/antes-sala-a.png`,
  `depois-sala-b.png`, `painel-ajustado.png`. Exe release (WebView2 isolado,
  `scratchpad/e2e-parte1-release.mjs`): Sala desenhada pela UI com nome "Taverna" aparece no editor;
  jogador recebeu 1 região, 4 paredes e 1317 células exploradas. Cancelar durante "Conectando"
  (`scratchpad/cancel-timeline.mjs`): sem link por 40 s e 0 cloudflared. (1ª tentativa inválida: um
  jogador real "Saga" entrou na janela de teste e o link foi reaberto manualmente.)
- Revisão de segurança (agente `revisor`, opus): CRÍTICO reproduzido — célula de exploração marcada
  pelo centro atravessa parede e vaza sala vizinha (grid 20 e mapa grande); MÉDIO — vértice na linha
  da parede marca/enviar sala vizinha (confirmado no app real: "Taverna" enviada com token do lado de
  fora); MÉDIO — estado da porta ao vivo fora da visão; BAIXO — `scenarioLink`/`ownerId` no spread.
  CORRIGIDOS (agente `operario` opus): célula só marcada se inteira dentro do anel
  (`exploration.ts:71-140`); amostras internas para regiões/formas com área (`fogFilter.ts:69`);
  memória de portas por jogador com último estado visto (`fogFilter.ts:170,218`,
  `hostSession.ts:62,90,114`); `scenarioLink`/`ownerId`/`fog.revealed` neutralizados
  (`fogFilter.ts:232`). Cada um com teste que falhava antes. tsc client/e2e exit 0; vitest 1676
  passed; playwright 118 passed (rodado sozinho; rodar duas suítes Playwright ao mesmo tempo dá
  falsas falhas).
- Exe release depois das correções (WebView2 isolado): token FORA de uma Sala sem porta →
  `regions-count 0` (a sala não vaza); token posto antes de desenhar a Sala ao redor →
  `regions-count 1`, WebSocket trouxe `room.name = "Taverna"`, tela do jogador com a sala azul e o
  nome legível (`scratchpad/e2e-parte1b/4-dentro-jogador.png`), erros de página `[]`; fechar o app
  deixa 0 labirinto.exe e 0 cloudflared. Scripts `scratchpad/e2e-parte1b-release.mjs` e
  `e2e-parte1c-release.mjs`. Nada commitado; instalador publicado continua o v0.1.0.
- Correções da varredura do túnel (agente Rust, 14/09/2026): stop perdido em `net_start_tunnel`
  (geração capturada na entrada, `discard_leftover_tunnel`, `spawn_tunnel`/`wait_ready` com
  cancelamento), chave /64 para IPv6 (`limit_key`), testes de ciclo de vida; clippy 0 avisos, lib
  25/25, `net_server` 11/11. Teste real de liga/desliga no exe mostrou que durante "Conectando" a UI
  não tinha como cancelar (botão desabilitado, sem "Encerrar"): adicionado botão "Cancelar" em
  `RoomPanel.tsx` (+3 testes). E2E real do cancelamento pendente para depois da parte 1 do jogador.
- Commit `b882a8f` (túnel + aba + tela do jogador parte 1) feito a pedido do usuário; app aberto para
  ele testar. Depois do teste: Fase A (paredes em qualquer zoom, nome do token, aba "Jogo", nome da
  Sala fácil + arrastar, visibilidade para jogadores e zona oculta) e Fase B (ping, laser, controles
  por jogador) EM ANDAMENTO no workflow sequencial `wf_8528625b-063` (só Opus). Plano em
  `~/.claude/plans/valiant-enchanting-patterson.md`.
- NOVA DIREÇÃO (usuário, 14/09/2026, após testar o painel): "ta tudo muito medíocre… nem tudo é
  útil e funciona… parece tão borrado". Diagnóstico aceito: (a) canvas sem densidade de pixels
  (Windows 125% estica 1280→1600, borra) e sem antialias no editor; (b) visual de rascunho (salas
  chapadas, paredes de 1–2 px, sem textura/hachura/sombra); (c) recursos construídos aos pedaços e
  validados por testes, não por uso real; (d) acúmulo sem cortar. ORDEM APROVADA: 1) nitidez do
  canvas (resolution=devicePixelRatio + autoDensity + antialias no editor e no jogador, reagir a
  mudança de DPR) — CONCLUÍDO em 2 partes (ver abaixo); 2) auditoria honesta de
  funcionalidades com o app real (tabela funciona?/útil?/proposta manter-consertar-esconder-remover)
  para o usuário decidir; 3) polir o fluxo principal (criar masmorra salas/portas/corredores →
  jogar) com visual de verdade (piso com textura, paredes grossas com hachura, portas, grade
  discreta). Parar de adicionar recursos até isso. Fila antiga (tokens/personagens, cenas) só
  depois. Remodelagem do painel ainda NÃO commitada (último commit `839173c`).
- NITIDEZ CONCLUÍDA (não commitada):
  - **Parte 1.** `client/src/pixi/rendererResolution.ts` define a resolução como
    devicePixelRatio (entre 1 e 3). Liga autoDensity e antialias no editor e no jogador e reage a
    troca de DPR.
    - e2e: `task-device-pixel-ratio.spec.ts`.
    - Prints em `scratchpad/nitidez/`.
  - **Parte 2.** Motivo: o monitor principal do usuário é 2560x1080 a 100%, e lá o borrão vinha do
    zoom.
    - `client/src/pixi/textResolution.ts`: a resolução de cada Text dentro de `world` segue o
      degrau de zoom (1, 2 ou 4), limitada a 4096 px e aplicada com debounce de 120 ms.
    - Imagem de fundo com `autoGenerateMipmaps`.
    - e2e: `task-text-zoom-resolution.spec.ts`.
    - Prints em `scratchpad/nitidez2/`: com zoom de 400% o texto antes aparecia em blocos e agora
      sai liso, conferido no olho.
  - **Portão.** tsc 0/0; vitest 109 arquivos, 1838 testes; playwright 149 passaram.
  - **Fora do escopo.** Rótulos de arrasto a 400% no primeiro uso; "Render fiel" sem mipmap;
    nenhum print da tela do jogador.
  - **Inventário para a auditoria (205 itens, 7 suspeitos).** Salvo em
    `scratchpad/auditoria/inventario.md`. Os suspeitos:
    1. Ctrl+O e Ctrl+A mortos.
    2. `stairSize` sem leitor.
    3. Link de cenário não é usado.
    4. Tela Opções desabilitada.
    5. 2 tipos de mapa desabilitados.
    6. 4 controles duplicados entre a barra e o painel.
    7. "Oculto no editor" sem render.
- AUDITORIA NO APP REAL CONCLUÍDA (14/09/2026)
  - **Onde está:** `scratchpad/auditoria/parte-a.md` (ferramentas, atalhos, config), `parte-b.md` (painel) e `parte-c.md` (barra, menus, aba Jogo, exe real). Screenshots em `a/`, `b/` e `c/`.
  - **Bugs graves:**
    1. Início quebra o editor: a limpeza do PixiCanvas explode.
    2. Voltar do andar perde o que foi desenhado no andar.
    3. Nome da sala rouba o teclado: apertar V renomeou a sala para "v".
    4. Ctrl+A e Ctrl+O não funcionam.
    5. Ferramenta Token (K) não faz nada.
    6. Token Travado ou Oculto vira armadilha: não dá mais para selecionar.
    7. A grade não redesenha ao mudar as configurações.
    8. A seleção amarela cobre a cor e a hachura.
    9. Espessura, parede interna e ponta da parede não aparecem no canvas.
    10. Rótulos errados: "Apagar undefined", "selecionada(o)".
    11. Trocar de ferramenta não limpa a seleção.
    12. Desenho existente não tem cor nem espessura editáveis.
    13. Fechar a sala aparece para o jogador como "conexão caiu".
    14. Avisos não aparecem nas telas de menu.
  - **Pendentes, sem conserto em andamento:**
    - O QR aponta para o IP da VPN (`commands.rs:264`).
    - A tela do jogador é uma página branca.
    - A porta é minúscula e os tipos não se distinguem.
    - A luz nasce com raio 8.
    - O chão verde padrão e a régua em pés têm cara de placeholder.
    - Parte vai para o passo 3 (visual).
  - **Consertos em andamento, nesta ordem:**
    - 2 `operario` opus com arquivos disjuntos. O primeiro cobre PixiCanvas, App, keymap, RoomControls, drawRoomNames, tokensRenderer, ItemTransformControls e screens. O segundo cobre gridSubscription, mapStore, draw*, labels, controles do painel, net e player.
    - Os dois caíram por limite de sessão às 22:50 sem editar nada e foram retomados às 23:54.
    - Depois: 1 verificador-realidade roda a suíte inteira, o build sai e o app é aberto para o usuário.
  - **Decisões do usuário (14/09/2026, lote seguinte, depois dos consertos):**
    - ESCONDER a tela Opções, os tipos Isometric/World, o Link de cenário e a ferramenta Token (K).
    - AGRUPAR as 7 ferramentas de desenho livre (Pincel, Linha, Curva, Círculo, Elipse, Retângulo, Polígono) num botão "Desenho", com a setinha escolhendo a forma.
    - Mover para uma seção "Avançado" fechada, com uma frase explicativa: Ponta e canto, Cantos do contorno, Suavizar, Precisão do contorno, Render fiel e Moldura.
    - PAINEL com um bloco por objeto: Nome > Visível para jogadores > Aparência > Avançado > Apagar; remover o "Nada selecionado".
- CONSERTOS 1 e 2 CONCLUÍDOS (15/09/2026 ~00:40, sem commit). Vitest 1873 nos dois. Suíte do playwright ainda NÃO rodada.
- PASSO 3, VISUAL
  - **Plano:** `scratchpad/passo3/plano.md`. BAR "Dyson Logos / one-page dungeon": piso pergaminho, parede preta grossa, hachura externa, portas por tipo.
  - **F0 feita:** fixture de 55 salas, `scratchpad/passo3/f0/dungeonShots.mjs`. Base: loadMap 191 ms, pan 23 fps.
  - **F1 feita:** chão novo #e9e1cf; mapa legado continua verde; 1,5 m; luz com raio 4; dica some. Vitest 1881.
  - **Decisões do usuário:**
    - Grade fora do piso: bem apagada no editor, some para o jogador.
    - Mapa antigo mantém a cor e ganha textura.
    - Jogador vê a porta trancada.
  - **Próximas fatias:** F6 (luz com gradiente), F2 (parede + hachura), F3 (textura do piso), F4 (portas), F5 (grade só no piso), F8 (integração e comparação cega).
- RETOMADA (15/09/2026 ~10:50, nova sessão). A sessão anterior parou ~09:47 no meio do lote de
  decisões (fatias 1-3) e da F2 (hachura). Checkpoint local `05da139` (sem push) com tudo; portão
  no commit: tsc 0, vitest 124 arquivos / 1961 passed; playwright NÃO rodado. Decisões do usuário:
  critério visual = "sem parecer borrado" (sem estilo de referência); valida o exe a cada fatia.
  Agentes: só Opus, máximo 2 em paralelo. Em curso: diagnóstico medido do borrão (1 debugador,
  prints em `scratchpad/borrado/` desta sessão). A hachura atual (faixa bege com tracinhos
  repetidos) foi julgada fraca no print e será refeita.
- DIAGNÓSTICO DO BORRÃO CONCLUÍDO (medido em pixel): a 100% quase tudo já é nítido; sobram (1) nome de
  sala/token ilegível a 35-50% (fonte fixa em px de mundo), (2) texto mole a 150% (degrau potência de
  2 em `textResolution.ts`), (3) hairline de 1 px vira 2 px cinza (`drawStairs.ts:26`,
  `drawMapBounds.ts:160`, `drawGrid.ts:26`), (4) grade abaixo do chão (`PixiCanvas.tsx:410`), (5)
  rótulo do painel com contraste 3,6:1 (`main.css:69-73`); extra: nome da sala sob a parede.
  Decisões do usuário: nome de sala/token com mínimo ~11 px na tela e some abaixo de 30% de zoom;
  nitidez e hachura na MESMA fatia. EM ANDAMENTO: 2 `operario` Opus em paralelo com arquivos
  disjuntos — nitidez (PixiCanvas, PlayerView, textResolution, drawRoomNames, tokensRenderer,
  drawStairs, drawMapBounds, drawGrid, main.css; porta 1431, `scratchpad/nitidez3/`) e hachura
  vetorial com cachos em grid global e borda irregular (drawHatch, dungeonStyle, dungeonTextures,
  proceduralTiles, floorMask; porta 1432, `scratchpad/hachura/`). Depois: portão completo (tsc,
  vitest, playwright), build do exe e teste do usuário com roteiro.
- NITIDEZ (agente 1) CONCLUÍDA, sem commit. Novos `pixi/screenLabel.ts` (mínimo 11 px, some <30%)
  e `pixi/pixelAlign.ts` (world e hairlines presos ao pixel físico); textResolution com escala exata
  em passos de 0,25 + roundPixels; grade acima das salas em 2 Graphics (dentro do piso cor do
  usuário, fora #d8d8d8 a 8%, máscara via buildFloorMask); nomes acima das paredes; theme.ts
  parchmentFaint #858480 e eyebrow 11,5 px. Medido: escada 2 px→1 px, grade sobre pergaminho
  35 níveis, texto a 150% sem rampa, eyebrow 3,48→4,89:1, nome a 25% ausente; a 35% caixa-alta
  7 px (Arial 11 px). tsc 0; vitest 1985 ok, 8 falhas só em drawHatch.test.ts (hachura em
  andamento). NÃO verificado: tela do jogador no browser; specs task-player-map e
  task-render-selection-labels podem mudar. Pendências anotadas: nome de token sem contorno some
  sobre pergaminho; nomes de zona oculta sem regra de tamanho; grade hex/tri sem alinhamento.
  Prints: `scratchpad/nitidez3/crops/` (antes/depois) desta sessão.
- HACHURA VETORIAL (agente 2) CONCLUÍDA, sem commit. Novo `pixi/hatchGeometry.ts` (cachos em grid
  global de 0,3 célula com hash inteiro, alcance 0,5 ± 0,15 célula, distância por bucket de
  segmentos, papel por ladrilhos com borda irregular, 1 fill + 1 stroke) e `hatchGeometry.test.ts`
  (14 testes); `drawHatch.ts` mantém a API (getPattern ignorado); `dungeonStyle.ts` com
  `hatchStrokeWidth` em degraus abaixo de 1 px. Medido: 0 px escuro dentro do piso nas 7 cenas,
  densidade 0,29–0,36, borda irregular 0,11–0,15 célula, AA a 400% 0,8 (textura antiga 0,12),
  salas encostadas sem dobra (−1%). Custo: construção 8,8→68 ms na fixture de 55 salas, pan −6%.
  Prints: `scratchpad/hachura/final/`. Ajuste do orquestrador: `PlayerView.tsx` repinta a hachura
  também ao cruzar degrau da largura do traço no zoom. Sobra: `createDungeonTextures` sem uso em
  PixiCanvas/PlayerView (remover depois).
- PORTÃO DA FATIA (15/09/2026 ~12:15): tsc exit 0; vitest 127 arquivos / 2007 passed. Playwright
  1ª rodada 178/180: (a) `task-render-selection-labels` media parede CLARA sobre fundo escuro —
  spec atualizada para a maior sequência de pixels escuros (parede preta sobre papel); (b)
  `task-avancado` 3: Precisão/Render fiel/Moldura ainda soltos — movidos para `AdvancedSection` em
  `FloorStyleControls.tsx` (fatia 3 do lote de decisões que tinha ficado pela metade). 2ª rodada
  179/180: `task-player-map` com pageerror intermitente "Cannot read properties of undefined
  (reading 'push')" em `TexturePool.returnTexture`. CAUSA RAIZ (lida no Pixi 8.20):
  `app.destroy(true, …)` → `renderer.destroy(true)` → `GlobalResourceRegistry.release()` →
  `TexturePool.clear()` zera o pool GLOBAL; sob StrictMode a 1ª montagem destruída depois da 2ª já
  ter Text quebra o próximo re-raster (mais frequente agora que a resolução do Text muda). FIX:
  `app.destroy({ removeView: true }, { children: true })` em `PlayerView.tsx:581/847` e
  `PixiCanvas.tsx:347/3601`. Prova: stress 4 specs do jogador x6 com 8 workers antes 4 pageerrors,
  depois 0 (as falhas restantes a 8 workers são canvas >5 s sob carga, sem pageerror, já existiam);
  com 4 workers 30/30. `recreate/renderFloorPng.ts:360` ainda usa `app.destroy(true)` (harness
  isolado, não mexido). Rodada final: tsc exit 0; vitest 127 arquivos / 2007 passed; playwright
  180 passed (3,4 min), exit 0 (log `scratchpad/playwright-fatia1c.log`). Build release exit 0,
  "Finished 2 bundles" 15/09 12:53 (`Labirinto_0.1.0_x64-setup.exe` 1.911.024 bytes). Smoke no exe
  via CDP (`scratchpad/exe-fatia1/smoke.mjs`): mapa novo + 2 salas pela UI (N + arrasto + Enter),
  Ctrl+roda 100% → 38% → 332%, Avançado do chão fechado/aberto, erros de página e console `[]`.
  Prints `scratchpad/exe-fatia1/`. Defeitos vistos no print, NÃO corrigidos: (1) fresta escura
  vertical no papel da hachura entre 2 salas a ~1 célula (x≈945 em `1-editor-100.png`); (2) o print
  a 332% ficou fora das salas (ponteiro do script, não do app); (3) "Nada selecionado" ainda no
  painel e bloco por objeto (fatia 4 do lote de decisões) pendentes. Varredura curta (§2j) não
  rodada: limite de 2 agentes. Commit `2c39cd2` (local, sem push) a pedido do usuário; exe release
  aberto para ele às 13:44 (pid 28852). Aguardando o teste do roteiro (bom/ruim/estranho por item).
- ESTILO REJEITADO (15/09/2026 ~13:50). Ao ver o exe: "Mas que diabos é isso? eu não quero esse
  tipo de mapa, tem que ser aqueles mapas simples igual resident evil". Referências: minimapa RE
  clássico (chão verde chapado, contorno fino, portas laranja pequenas, fundo preto), planta azul e
  RE4 remake. Decisões: paredes = linha fina clara (RE clássico), sem grade por padrão, cor do chão
  escolhível; salas dentro de sala pelos dois jeitos (desenhar dentro vira sub-sala + botão "Criar
  sala dentro" no painel); sub-sala herda a cor e pode trocar; hachura, parede preta grossa e
  pergaminho REMOVIDOS DE VEZ (código apagado). Mapeamento em curso (2 batedor-fundo: superfície
  do estilo masmorra; modelo de sala e aninhamento). Depois: plano + aprovação antes de codar.
- PLANO APROVADO (15/09/2026): `~/.claude/plans/temporal-yawning-quiche.md`. Decisões extras: sala
  nova marrom `#a8776a`; porta = retângulo chapado (laranja fechada, vermelha trancada, contorno
  aberta); apagar sala de fora apaga as de dentro; "caminho" = faixa colorida larga por cima do
  chão, sem parede (Drawing kind 'path'). 3 fatias sequenciais, cada uma testada pelo usuário no
  exe: (1) visual RE removendo o estilo masmorra; (2) sub-salas com `Region.parentId`; (3)
  caminhos. FATIA 1 EM ANDAMENTO (1 `operario` Opus; prints em `scratchpad/re-fatia1/`).
- FATIA 1 IMPLEMENTADA (sem commit): apagados drawHatch/hatchGeometry/dungeonTextures/
  proceduralTiles/dungeonStyle (+testes); `drawWalls.ts` com largura em px de tela (1/2/3), cor
  0xd8d2c4, interna alpha 0.6, 5º parâmetro virou `rendererResolution`; `drawDoors.ts` retângulo
  60% do vão × 5 px (laranja/vermelho/contorno), cadeado removido; padrões marrom `#a8776a`,
  `showGrid: false`, grade `#000000` 0.25, jogador sem grade. Portão do orquestrador com Vite
  novo (os antigos 1420/1431 foram parados; o da 1420 tinha 2 cópias do mapStore por HMR e gerou 85
  falhas falsas para o agente): tsc exit 0; vitest 124 arquivos / 1968; playwright 180 passed
  (2,9 min, `scratchpad/re-fatia1/pw-gate.log`). Build release em andamento
  (`scratchpad/re-fatia1/build.log`); smoke do exe em `scratchpad/exe-re-fatia1/`.
  Varredura curta (1 `revisor` correção): 1 achado BAIXO confirmado no código — `drawWalls.ts:199`
  contornava o vão inteiro de parede com porta selecionada (pontas amarelas fora do retângulo de
  60%). Corrigido (`wall.door === null` no find) + teste em `drawWalls.test.ts`. Depois: tsc 0,
  vitest 1969 passed, 4 specs de porta/seleção 25 passed. Rebuild `re-fatia1/build2.log` exit 0
  (exe 15/09 14:55). Smoke no exe (`scratchpad/exe-re-fatia1/smoke.mjs`): 2 salas pela UI, zoom
  100% → 38% → 332%, Avançado, erros `[]`; prints conferidos (chão marrom chapado, linha fina
  clara, sem grade, sem hachura). App aberto para o usuário às 14:55 (pid 13164). SEM COMMIT:
  aguardando teste do usuário na fatia 1 antes de commit e da fatia 2 (sub-salas).
- BUG DO USUÁRIO NO TESTE (15/09 ~15:05): "Porque a cópia não tem as linhas brancas?". Causa:
  `lib/entityClone.ts` clonava só a Região; `duplicateSelected` e o Alt+arrastar
  (`insertClonedEntityLive`) nunca clonavam as paredes vinculadas. Fix: `cloneLinkedWalls`
  (entityClone.ts) usado em `mapStore.duplicateSelected` (pula parede de Sala também selecionada)
  e `insertClonedEntityLive(cloned, sourceRegionId)` chamado de `PixiCanvas.tsx` cloneForAltDrag;
  Sala sem nome não ganha mais "(cópia)". Testes novos em `mapStore.test.ts` e
  `entityClone.test.ts`. tsc 0; vitest 124 arquivos / 1974 passed. Sub-salas dentro da cópia ficam
  para a fatia 2. Linha branca = parede (confirmado ao usuário). Playwright 180 passed
  (`re-fatia1/pw-gate2.log`). Rebuild `re-fatia1/build3.log` para o usuário testar.
- FATIA 1 APROVADA pelo usuário no exe ("Perfeito") e commitada: `3ef5007` (local, sem push).
  Próximo: fatia 2 (sub-salas, incluindo cópia de sala levar as salas de dentro), depois fatia 3
  (caminhos coloridos). Pendências fora do plano: painel com "Nada selecionado" e bloco por
  objeto; tela do jogador sem conferência visual; QR aponta IP da VPN (`commands.rs:264`);
  instalador do GitHub ainda é o 0.1.0 antigo.
- INTEGRAÇÃO CONCLUÍDA (15/09/2026, ~09:40, sem commit).
  - **Portão:**
    - tsc 0/0;
    - vitest 116 arquivos, 1892 testes;
    - playwright 168 passed, rodado 2 vezes seguidas com Vite novo (3,1 e 3,2 min).
  - **Prints:** `scratchpad/integracao/` (sala pergaminho, retângulo com cor editada, porta trancada e escada selecionadas, prop fantasma).
  - **Ficou de fora:** prop e token ocultos são selecionáveis, mas não arrastáveis (`hitTestMap` filtra `isHidden`).
  - **Notado no print:** a sala nova não mostra parede visível e a grade some sobre o fundo escuro. Vai para F2 e F5.
  - **Plano das decisões:** `scratchpad/decisoes/plano.md`, 7 fatias. A primeira, "esconder via `lib/features.ts`", já pode começar.
  - **Build do release:** em andamento.
- (histórico) INTEGRAÇÃO (1 operario opus). Pendências entre arquivos:
  - fiação do estilo de desenho selecionado no `App.tsx`;
  - `closeRoom` no `stop()` do `hostBridge`;
  - `camera.scale` nos contornos;
  - `roomFillColor` pergaminho;
  - escada e porta selecionadas com contorno;
  - prop oculto como fantasma;
  - specs com rótulos novos;
  - PORTÃO COMPLETO com a suíte rodada 2 vezes.
- DEPOIS
  1. Build e abrir o app para o usuário.
  2. Lote de decisões: esconder, agrupar Desenho, Avançado, bloco por objeto.
  3. Fatias F2 a F8.
- Remodelagem do painel CONCLUÍDA (workflow `wf_3dac649a-765`, 7 agentes só Opus, portão aprovado
  na 2ª rodada): tsc 0/0; vitest 107 arquivos / 1812; playwright 145 passed. Entregue: seção
  recolhível (bug de display:flex vencendo hidden achado e corrigido na revisão visual), Camadas
  compacta com olho/cadeado + atalhos de grade, "Chão do mapa" recolhível, janela "Configurações do
  mapa" (engrenagem) com Grade/Alinhar/Medição em select/Link de cenário, menu "Imagem de fundo e
  conversão" na barra de baixo. Pendências listadas pela revisão: rótulo "Apagar token
  selecionada(o)", botão "Nada selecionado" parece campo, títulos duplicados por objeto (SALA +
  REGIÃO + JOGADORES; TOKEN + IMAGEM DO TOKEN + TOKEN), "Precisão do contorno" sem explicação
  visível. Não commitado; build release em andamento para o usuário testar.
- Checkpoint commit `839173c` (Fase A/B + laser + correções de segurança). Remodelagem do painel no
  workflow sequencial `wf_3dac649a-765` (operario opus P1-P4 + verificador), plano em
  `~/.claude/plans/valiant-enchanting-patterson.md`; screenshots em `scratchpad/painel-remodelado/`.
- (histórico) remodelar o painel de propriedades (decisões do usuário
  14/09/2026): Camadas vira lista compacta (nome + contagem + olho + cadeado, seção recolhível);
  botões "Chão / Linhas e portas / Recriar minimapa a partir da imagem de fundo" saem do painel e
  viram menu "Converter imagem em mapa" no botão de imagem de fundo da barra de baixo (só com imagem);
  Modo de medição, escala, grade e link de cenário vão para janela "Configurações do mapa"
  (engrenagem no topo do painel), medição como lista suspensa sem texto cortado; painel mostra
  primeiro o item selecionado/ferramenta ativa, resto em seções recolhíveis que lembram o estado,
  revisão de espaços, textos cortados e controles que não funcionam. Precisa de plan mode antes.
- Fila de pedidos do usuário (histórico): (1) tela do jogador parte 1 — FEITO (workflow sequencial só
  Opus, run `wf_f34be423-e3d`); (2) parte 2: laser só do mestre + controles do mestre por jogador
  (revelar só a planta) + PING do jogador (botão "Sinalizar" + toque; mestre vê sempre com nome,
  ondas ~3 s, som e seta na borda; outros jogadores só se o lugar já foi explorado por eles); (3) tokens: renomear, imagem que persiste, biblioteca de imagens, jogador vê
  e muda imagem/nome do próprio token, personagem salvo reutilizável; (4) cenas com vários mapas
  (vila → casa, andares). Restrição: sem Fable, só Opus, máx 3 agentes simultâneos, sequencial.
- Sala pública via Cloudflare Quick Tunnel (14/09/2026, plano
  `~/.claude/plans/valiant-enchanting-patterson.md`): Rust `cargo clippy ... -D warnings` exit 0;
  `cargo test` 16 unit + 9 integração passed (log `scratchpad/cargo-test-tunnel.log`); TS typecheck 0,
  vitest 1604 passed, playwright 116 passed (inclui `e2e/task-canvas-resize.spec.ts`). E2E REAL pela
  internet no exe release (`scratchpad/e2e-tunnel.mjs`, WebView2 isolado): download do cloudflared
  2026.9.1 com progresso, link `https://creatures-phones-deer-hollywood.trycloudflare.com/player`,
  GET público 200, jogador entrou com código `33FA7K`, token atribuído, `data-tokens-count=1`,
  erros `[]`; após "Encerrar link público" o link responde 502. Fechar o app pelo WM_CLOSE (botão X)
  encerra o app e o cloudflared (antes 1, depois 0) — `scratchpad/close-test-app.ps1`.
- Varredura curta + segurança (run `wf_ccfed6ee-be8`, 14 agentes, erro vazio, relatório
  `docs/varredura-2026-09-14.md`, banca de 1 refutador): 7 CONFIRMADOS, 0 descartados. Alto:
  stop perdido em `net_start_tunnel` (`commands.rs:243`, túnel fica público com a UI "parada").
  Médio: limites por IP com IPv6 sem /64 (`server.rs:345`); ciclo de vida do túnel sem teste
  (`commands.rs:58`). Baixos: testes de pendentes via túnel, queda do link no hostBridge, resize do
  PlayerView. EM CORREÇÃO por 2 agentes (Rust e TS), com teste que reproduz antes do fix.
- Bug antigo corrigido: o botão X não fechava o app (`onCloseRequested` em `App.tsx:387` chama
  `destroy()`, recusado: "Command plugin:window|destroy not allowed by ACL"). Fix:
  `core:window:allow-destroy` em `desktop/src-tauri/capabilities/default.json`.
- Faixa preta à direita do editor: canvas Pixi preso no tamanho inicial + grade/sombra sem redraw no
  resize. Fix com `ResizeObserver` + `renderer.on('resize')` em `pixi/PixiCanvas.tsx` (e observer em
  `player/PlayerView.tsx`). Verificado no WebView2 real (exe release, `scratchpad/canvas-size.mjs`):
  inicial 1280x800 → maximizada 1536x794 com canvas 1536x794 e grade até a borda
  (`scratchpad/canvas-size-maximized.png`) → normal 1280x800.
- Instalador (14/09/2026): build release exit 0, "Finished 2 bundles" (setup.exe 1,7 MB, msi 2,3 MB).
  E2E no exe RELEASE (sem Vite) via CDP 9222, script `scratchpad/e2e-release.mjs`: mapa criado pela
  UI + "Adicionar token", sala `MUTSN7` com 4 URLs de LAN, `GET /player` 200 do asset embutido,
  jogador em "Aguardando o mestre", token atribuído, jogador com `data-tokens-count=1`, erros de
  página app `[]` e jogador `[]`, exit 0.
- GitHub (14/09/2026): `gh repo create` criou https://github.com/GedasioSaga/labirinto-vtt (PUBLIC,
  branch padrão `main`). Commit `8d635af` (125 arquivos) na `feat/menu-inicial`; `master` local
  renomeada para `main` e avançada por fast-forward; push de `main`, `feat/menu-inicial` e da tag
  anotada `v0.1.0`. Release https://github.com/GedasioSaga/labirinto-vtt/releases/tag/v0.1.0 com
  `Labirinto_0.1.0_x64-setup.exe` (1.739.131 bytes) e `Labirinto_0.1.0_x64_en-US.msi`
  (2.383.872 bytes), ambos `uploaded`. Árvore remota sem `Objetivo/`, `Tentativa/`, `.genesis/`.
- Gate em 14/09/2026: typecheck exit 0; vitest `83 arquivos, 1451 passed`; playwright normal
  `113 passed` (rodado depois de ligar botão e render fiel no editor).
- Tentativa principal atual (`Tentativa/mapaN.json`): mapa1 cor 98,17% IoU 0,9949 buracos 16/17
  ilhas 14/14 · mapa2 cor 95,02% IoU 0,9928 buracos 8/8 ilhas 1/1 · Mapa3 cor 95,51% IoU 0,9957
  buracos 16/16 ilhas 4/4.
- Variante n-torres: Mapa3 95,78%, mas mapa2 voltou a 6/8 buracos — não promovida.
- Título da moldura ajustado (`gap-title`, fonte escolhida: negrito 15 px Segoe UI): mapa1 98,17% → 98,32%.
- NEGATIVO — contorno do chão ajustado ao centro do traço (`lib/refineFloor.ts`, variantes
  `refine-grid`/`refine-rooks`): 97,3% / 93,0% / 93,9% e Mapa3 com ilhas 1/4. A simplificação de
  0,8 px necessária para segmentos ajustáveis perde detalhe do contorno orgânico. Opção fica
  desligada (`RECREATE_REFINE_FLOOR`).
- Afinamento Zhang-Suen das linhas (`RECREATE_THIN=1`): com detecção por peso o Mapa3 passa a ter
  ilhas 4/4 (graças também à correção da ligação por cima de fundo), mas cor 94,99% contra 95,51% da
  detecção por cinza; no automático a calibração continua escolhendo cinza. Sem ganho.
- Viés medido na borda errada (melhor variante `gap-title`): mapa1/mapa2 tentativa mais escura
  (média R −16), Mapa3 mais clara (R +31). Implementado: calibração por erro absoluto médio
  (`RECREATE_CALIB_METRIC=error`) e opacidade do traço calibrada (`RECREATE_CALIB_ALPHA=1`) —
  variantes `err` e `err-alpha` rodadas: sem ganho (98,31/95,02/95,37% e 98,31/95,02/95,41%, contra
  98,32/95,02/95,51% da `gap-title`). O viés da borda é local (geometria do contorno), não global
  (largura/opacidade). Platô desta abordagem: próximo salto exige geometria do contorno por trecho.
- Melhor configuração (`gap-title`, grade) PROMOVIDA a tentativa principal em `Tentativa/`:
  mapa1 98,32% IoU 0,9959 buracos 16/17 ilhas 14/14 · mapa2 95,02% IoU 0,9928 buracos 8/8 ilhas 1/1
  · Mapa3 95,51% IoU 0,9957 buracos 16/16 ilhas 4/4.
- Composição dos erros restantes (principal): borda do chão 3643/2835/4608 px, linha cinza
  298/1028/3393 px, título da moldura 474 px (mapa1).
- Ganho por etapa medido: pixel duro 96,9/91,7/92,2% → largura medida por mapa 98,2/95,0/94,1% →
  calibração por render + detalhes escuros + pontilhado 98,2/95,0/95,5%.

---

# Sessão de 17/09/2026 — quatro gauntlets em paralelo, um por árvore

## Objetivo
Atacar a lista de 11 itens que o usuário mandou com prints (registrada literal em `PEDIDOS.md`),
com paralelismo máximo e sem cortar escopo: "vá resolvendo os problemas, criando as features e tudo
mais, o que eu quero é paralelismo". O item 6 foi esclarecido depois: é a **tela de entrada do
jogador**, que abre branca.

## Estado atual
Quatro `git worktree`, cada um com um gauntlet rodando, porta de vite própria e `node_modules` por
junction. Nenhuma peça de uma árvore toca arquivo de outra; o merge de volta é manual, branch por
branch.

| Árvore | Branch | Porta | Bar | Peças |
|---|---|---|---|---|
| `C:\dev\labirinto` | `feat/menu-inicial` | 1420 | app.dungeonscrawl.com | parede grossa · seleção por arrasto · escada legível · portão |
| `C:\dev\labirinto-jogador` | `feat/tela-jogador` | 1440 | jackbox.tv | tela de entrada do jogador |
| `C:\dev\labirinto-fog` | `feat/visao-e-porta` | 1450 | demo.foundryvtt.com/join | visão lembrada inteira · entrar na casa |
| `C:\dev\labirinto-consertos` | `fix/achados-passeio` | 1437 | app.dungeonscrawl.com | 6 achados dos passeios cegos |

11 jornadas vermelhas novas, escritas por `testador` ANTES do build, todas com controle positivo que
morde e asserção em pixel de tela (nunca em store). Bars conferidas abrindo no driver antes de usar;
**Owlbear Rodeo foi descartada** por cair em verificação da Cloudflare no navegador automatizado.

## Próximos passos
1. Esperar o veredito de cada frente (dois `critico-cego` por rodada, ordens invertidas).
2. Merge branch por branch, revisando diff. Atenção ao conflito conhecido: `task4-drawing-tools.spec.ts:175`
   ("ferramenta Selecionar: pan de área vazia move a câmera") passa hoje e **vai quebrar** quando a peça
   `selecao-arrasto` entrar — é mudança de comportamento pedida pelo usuário, não regressão.
3. Fila sem construtor ainda: balde/piscina e caminhos coloridos (itens 2 e 7); luz barrada por parede
   e desenhada no jogador (item 8); foto e nome do token pelo jogador (itens 8b e 9); mapas conectados
   (item 11).
4. Dívida nova, achada por medição e sem dono: os 3 testes que já estavam vermelhos no HEAD (abaixo).

## Critério de pronto
Por peça: os dois `critico-cego` frescos escolhem o nosso lado às cegas, cada um com a ordem A/B
invertida do outro, **e** os quatro gate_cmds da árvore saem verdes, **e** a jornada da peça passa.
Peça que só tem teste verde não está pronta. Nenhuma frente fecha por contagem de rodadas.

## Evidência
- Portão de cada árvore, medido pelo orquestrador ANTES de disparar o run (não por relato de agente):
  - `labirinto-consertos`: `tsc -p client/tsconfig.json` exit 0; `tsc -p client/tsconfig.e2e.json` exit 0;
    `npm run test --workspace=client` → `Test Files 132 passed (132) | Tests 2096 passed (2096)`;
    bateria de regressão e2e → `196 passed (4.5m)`.
  - `labirinto-jogador`: gates 1 e 2 exit 0; vitest 132/2096; bateria Playwright do jogador
    (`task-player-page`, `task-player-map`, `task-player-door`, `task-player-signal`,
    `task-jornada-entrada-jogador`) → `10 passed (1.1m)`; jornada da peça → `4 failed / 0 passed`.
- **3 testes já vermelhos no HEAD `25de80c`, sem relação com esta sessão** (medidos rodando o e2e
  inteiro; excluídos do portão de consertos e declarados nas invariantes, não escondidos):
  `task-fluxo-consertos.spec.ts:84` (Voltar do andar salva o que foi desenhado),
  `task-fluxo-consertos.spec.ts:109` (Ctrl+A e Ctrl+O),
  `task-alignment-door-curve-portal.spec.ts:144` (link de cenário).
  Mais a vermelha de propósito já documentada em `25de80c`: `task-jornada-ferramentas-mudas.spec.ts:240`.
- Duas Fases 0 me bloquearam, com razão, e as duas eram erro do orquestrador:
  1. `tsc -p client/tsconfig.e2e.json` vermelho por `TS2352` dentro da própria jornada, num arquivo que
     a invariante proíbe o builder de tocar — portão impossível de fechar.
  2. A jornada media `http://localhost:1420` (outro checkout) com endereço escrito na mão. Provado por
     conteúdo servido: `curl localhost:1420/src/lib/stairs.ts` e `localhost:1440/...` devolvem arquivos
     diferentes, e os checkouts estão em branches diferentes. Daria falso-vermelho eterno e falso-verde
     no sentido oposto. Corrigido: endereço sai do `baseURL` do `playwright.config` de cada checkout.
- Terceira armadilha, achada pela Fase 0 do run do jogador e que mudaria o trabalho do builder: em
  `npm run dev` o Vite serve `client/src/player/player.css` com `Content-Type: text/javascript` e o
  `client/player.html` não tem `<link>` nem `<style>`. Com JavaScript desligado **nenhuma** regra
  daquele arquivo chega ao navegador, então editar `player.css` jamais tiraria a página do branco. A
  instrução foi reescrita: o fundo escuro tem de nascer de `<style>` no `player.html` ou de CSS
  estático em `client/public/`.
- Incidente de porta: 1430 estava ocupada pelo vite de `C:/dev/learno` **no IPv6** (`[::1]:1430` →
  `<title>Tauri + React + Typescript`) enquanto o IPv4 era o worktree. O Chromium resolve `localhost`
  para IPv6 primeiro, então o teste ia para o app errado e o `curl` do terminal dizia que estava tudo
  bem. Consertos movido para 1437. **Porta respondendo 200 não prova que é o seu app** — conferir por
  identidade, nas duas pilhas.
- Disco: `desktop/src-tauri/target/debug` (5,1 GB) apagado com autorização explícita do usuário; o exe
  release de 15/09 foi preservado. De 778 MB para 32 GB livres.
