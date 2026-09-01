# Dossiê de investigação — feedback do usuário (31/08/2026)

Cinco investigações read-only sobre o app rodando, disparadas depois que o usuário usou o
programa pela primeira vez. Fonte das decisões da Fase 4.

---

## bug3 mover e redimensionar (mover-redimensionar)

## VEREDITO — Bug 3

**O bug não existe no código-fonte atual.** Mover e redimensionar uma Região/Sala (corpo, vértice e canto retangular) estão implementados e funcionando — validei com os testes e2e já existentes (`task-room-tool.spec.ts`, 8/8 passando) e com um spec descartável que escrevi para cobrir o caso que faltava (região "solta", sem `room`), também passou, e já apaguei o arquivo depois. A causa mais provável do que o usuário viu é **build desatualizado do app desktop**, não um bug de lógica.

### Evidência da causa real (build stale)

- `client/dist/index.html` foi gerado em **2026-08-31 11:47:13**.
- `client/src/pixi/drawRoomHandles.ts`, `client/src/lib/roomOps.ts`, `client/src/components/RoomControls.tsx` — os 3 arquivos que implementam resize-por-canto da Sala retangular — são **untracked no git** (`git status --short`) e foram modificados às **14:57–14:58**, mais de 3h **depois** do build do `dist`.
- `client/src/pixi/PixiCanvas.tsx` (state machine de gesto) foi modificado às **17:14**, também depois do `dist`.
- Existe um executável já compilado em `desktop/src-tauri/target/debug/labirinto.exe`, datado de **2026-08-25 09:18** — 6 dias antes de toda essa feature de Sala existir no disco.
- `desktop/src-tauri/tauri.conf.json:10` → `"frontendDist": "../../client/dist"`. Só `tauri dev` (via `devUrl`/Vite ao vivo, porta 1420) pega o código atual; qualquer `.exe` já compilado ou um `tauri build` antigo carrega o `dist` congelado.

**Se o usuário abriu o `labirinto.exe` existente (ou um dist antigo), a feature de Sala/resize-por-canto simplesmente não existia ainda naquele bundle** — o que bate exatamente com "selecionei e não consigo mudar posição nem tamanho". Recomendo pedir para ele rodar `npm run tauri:dev` (ou refazer `npm run tauri:build`) e testar de novo antes de investigar mais.

### O que eu validei no código-fonte atual (não é isto que está quebrado)

- `client/src/lib/selectionHitTest.ts:78-86` `findRegionAt` — hit-test de região por clique no corpo.
- `client/src/pixi/PixiCanvas.tsx:879-882` + `:1344-1366` — `dragging-region-body`, chama `moveRegion` (`mapStore.ts:367`).
- `client/src/pixi/PixiCanvas.tsx:821-829` — resize por canto de Sala retangular (`resizing-room-corner` → `resizeRoomCornerLive`, `mapStore.ts:447-448`), alças em `client/src/pixi/drawRoomHandles.ts:29-36`.
- `client/src/pixi/PixiCanvas.tsx:830-848` — vértice/ponto-médio livre para região comum e Sala circular/polígono, alças em `client/src/pixi/drawEditHandles.ts:53-60` (`drawRegionHandles`).
- Testes que provam isso rodando: `client/e2e/task-room-tool.spec.ts` testes **2** (resize por canto), **4** (mover corpo), **5** (arrastar parede vinculada move a sala inteira) — rodei `npx playwright test e2e/task-room-tool.spec.ts` → **8 passed**.

### Achado visual secundário (real, mas não é o bug relatado)

Quando o clique inicial acerta a **parede da borda da Sala** (não o corpo, não um canto), a seleção vira `kind: 'wall'`, não `kind: 'region'`. `drawEditHandles.ts:101-109` delega e mostra as alças de canto da região mesmo assim (é assim que "clicar na parede da sala mostra os vértices da sala inteira" funciona por design) — mas `drawRegions.ts:120-122` só pinta o preenchimento com `SELECTION_COLOR` quando `selection.kind === 'region'`. Resultado: a região aparece com alças nos cantos **sem** o preenchimento amarelo de "selecionado" — fica com a cor/hachura normal (azul, se for essa a cor escolhida) + a borda das paredes (`drawWalls.ts:14`, `WALL_COLOR.exterior = 0xe0e0e0`, cinza bem claro/quase branco). Isso bate com "preenchimento hachurado azul e borda branca com alças" da captura do usuário — é a explicação mais provável para o visual que ele viu, mesmo que a funcionalidade por trás continue funcionando (confirmei que mover/redimensionar funciona também partindo desse estado). Vale considerar destacar o preenchimento também quando a seleção é a parede-dona-da-sala, por consistência visual — não é urgente.

---

## Tabela completa — Selecionar / Mover / Redimensionar por entidade

| Entidade | Selecionar | Mover corpo | Redimensionar | Evidência (arquivo:linha) |
|---|---|---|---|---|
| **Token** | SIM | SIM (trava por `locked`) | NÃO | hit: `selectionHitTest.ts:216`; move: `PixiCanvas.tsx:863-868` (`dragging-token`, `canInteract`) |
| **Wall** | SIM | SIM | SIM (vértice, só se solta) | hit: `selectionHitTest.ts:27-35,232`; move: `PixiCanvas.tsx:875-878`; resize: `PixiCanvas.tsx:784-801` (`dragging-wall-point`, só `wall.regionId===undefined`), alças `drawEditHandles.ts:111-113` |
| **Light** | SIM | **NÃO** (não existe modo de arrasto de corpo) | SIM (raio) | hit: `selectionHitTest.ts:54-62,222`; `draggable:false` em `:223`; resize: `PixiCanvas.tsx:774-782` (`dragging-light-radius`), alça `drawEditHandles.ts:42-46,125-128` |
| **Region (comum)** | SIM | SIM | SIM (vértice/meio de aresta) | hit: `selectionHitTest.ts:78-86,245`; move: `PixiCanvas.tsx:879-882,1344-1366`; resize: `PixiCanvas.tsx:830-848`, alças `drawEditHandles.ts:53-60` |
| **Region — Sala retangular** (`room.shape==='rect'`) | SIM | SIM | SIM (4 cantos) | resize: `PixiCanvas.tsx:821-829` (`resizing-room-corner`), alças `drawRoomHandles.ts:29-36` |
| **Region — Sala circular/polígono** (`room.shape==='polygon'`) | SIM | SIM | SIM (vértice/meio de aresta) | mesmo caminho da região comum, `drawEditHandles.ts:73-79` |
| **Prop** | SIM | SIM (trava por `locked`) | NÃO | hit: `selectionHitTest.ts:219`; move: `PixiCanvas.tsx:869-874` (`dragging-prop`, `canInteract`); nenhum branch em `drawEditHandles.ts` |
| **Drawing: freehand** | SIM | NÃO | NÃO | hit: `selectionHitTest.ts:119-120`; `draggable` só é `true` p/ `kind==='line'` (`:230`), mas esse campo nem é lido em `PixiCanvas.tsx` — freehand cai em `mode='idle'` (`:894-896`) |
| **Drawing: line** | SIM | SIM | SIM (2 pontas) | hit: `:121-122`; move: `PixiCanvas.tsx:885-888` (`dragging-line-body`); resize: `:757-770` (`dragging-line-point`), alças `drawEditHandles.ts:120-122` |
| **Drawing: circle** | SIM | NÃO | NÃO | hit: `:123-126`; nenhum modo `dragging-circle-*` existe |
| **Drawing: curve** | SIM | SIM | SIM (mecanismo próprio) | hit: `:119-120` (junto de freehand); move: `PixiCanvas.tsx:889-893` (`dragging-curve-body`); resize: `:740-754` (`dragging-curve-point`, inserir/arrastar controle), fora de `drawEditHandles.ts` de propósito |
| **Drawing: text** | SIM | NÃO | NÃO | hit: `:109-114` (bounding box); nenhum modo de arrasto |
| **Drawing: rect** | **NÃO** | N/A | N/A | `selectionHitTest.ts:128` — comentário explícito "sem hit-test ainda, de propósito (Fase 1)"; renderiza (`drawDrawings.ts`) mas é inalcançável por clique |
| **Drawing: ellipse** | **NÃO** | N/A | N/A | idem, `:128` |
| **Drawing: polygon** | **NÃO** | N/A | N/A | idem, `:128` |
| **Stair** | SIM | **NÃO** | **NÃO** | hit: `:42-52,242`, `draggable:false`; ações `moveStair`/`updateStairPoint` **existem** em `mapStore.ts:199-200,440-442` mas **nenhum modo de gesto as chama** — a lista completa de modos em `PixiCanvas.tsx:358-385` não tem `dragging-stair-*`. Código morto/não plugado, exatamente o padrão "renderiza mas não é alcançável" |

### Achado confirmado de Fase 1 (real, reproduzível, diferente do Bug 3)

`rect`, `ellipse` e `polygon` (kind de `Drawing`, criados pelas ferramentas **Retângulo/Elipse/Polígono** da barra — diferente da ferramenta **Sala**) renderizam normalmente mas **não têm hit-test nenhum** (`selectionHitTest.ts:128`, comentário do próprio time confirma que é proposital/pendente) e **não têm alças** em `drawEditHandles.ts` (só trata `kind==='line'` para drawings). Ou seja: depois de desenhados, esses 3 tipos são **impossíveis de selecionar por clique** — não só de mover/redimensionar. Se o usuário quis dizer "retângulo" se referindo à ferramenta de desenho (não à ferramenta Sala), **este é o bug real e mais grave**: nem seleção existe. Para corrigir, falta: (1) hit-test em `findDrawingAt` para os 3 kinds (bounding box para rect/ellipse, ponto-em-polígono para polygon), e (2) alças de resize/vértice equivalentes em `drawEditHandles.ts`.

**Stair** tem o mesmo padrão em menor escala: as ações de mover/editar já existem na store mas nunca foram ligadas a nenhum gesto do `PixiCanvas.tsx` — falta só o wiring (handlers de pointerdown/pointermove semelhantes aos de Wall), a lógica de dados já está pronta.

---

## bug1 canto que nao fecha (canto-aberto)

## VEREDITO
A borda "branca grossa" que falha no canto não é a borda da Region — é a das 4 Walls que uma Sala gera junto com ela, e `drawWalls` risca cada parede como um `stroke()` independente (sem path compartilhado), então no canto não existe *join* algum entre os dois segmentos e o quadradinho externo do vértice fica sem tinta.

## Evidência

- **A Region em si fecha certo.** `client/src/pixi/drawRegions.ts:114-123`: um único `Graphics`, `moveTo` + `lineTo` para todos os pontos + `closePath()` (linha 119), e **um só** `g.stroke(...)` no final (linha 123). Isso é exatamente o padrão que o Pixi 8 precisa para aplicar *line join* entre os segmentos — confirmei em `node_modules/pixi.js/lib/scene/graphics/shared/GraphicsContext.js:833` que o default é `join: "miter"`, `miterLimit: 10` (`:829`), o que é mais que suficiente para um ângulo de 90° (razão de miter para 90° é ~1.41, bem abaixo do limite 10 — não teria bevel nem notch). Ou seja: a região retangular sozinha, sem parede em cima, não teria esse artefato.

- **A cor/espessura que o usuário está vendo é da Wall, não da Region.** O stroke da Region usa a **mesma cor do fill** (`drawRegions.ts:121-123`, `color = new Color(region.fillColor).toNumber()`), largura 2 — praticamente invisível contra o próprio preenchimento. Já a Wall (`client/src/pixi/drawWalls.ts:14`) usa `0xe0e0e0` (quase branco) com largura 4 para `wallKind` padrão (`'exterior'`, linha 13/31) — isso bate com "borda branca grossa". Toda Sala retangular é criada com Region + 4 Walls sobrepostas exatamente nos mesmos pontos (`client/src/lib/drawingFactory.ts:84-111`, `buildRoomFromDraft`), e as Walls são desenhadas **depois** da Region no scene graph — `client/src/pixi/PixiCanvas.tsx:191-192` (`regionsContainer` antes de `wallsGraphics` em `world.addChild(...)`) — então ficam por cima, visíveis.

- **`drawWalls` risca cada parede isolada.** `client/src/pixi/drawWalls.ts:26-36`: o loop faz, para CADA wall, `graphics.moveTo(...).lineTo(...)` seguido imediatamente de `graphics.stroke({ width, color })` (linha 34) — um `stroke()` por parede, não um path único com todas as 4. Confirmei isso instrumentando um teste descartável (`__scratch_drawWalls_corner.test.ts`, já apagado) que inspecionava `g.context.instructions`: duas paredes perpendiculares (topo + direita de uma Sala) geram **2 instruções `stroke` separadas**, nunca 1.

- **Por que isso produz o entalhe.** O Pixi só calcula *join* (miter/round/bevel) dentro de um mesmo path contínuo, antes de um único `stroke()`. Entre duas chamadas de `stroke()` independentes não existe join nenhum — cada segmento vira um retângulo com `cap: 'butt'` (default, `GraphicsContext.js:831`) nas próprias pontas. Provei a geometria no mesmo teste descartável: para uma parede horizontal (0,0)-(100,0) e uma vertical (100,0)-(100,100), largura 4, os dois retângulos de stroke são `x:[0,100] y:[-2,2]` e `x:[98,102] y:[0,100]`. O ponto do canto externo do ângulo reto, ex. (101,-1), **não está dentro de nenhum dos dois** — é exatamente o pixel/área que falta, o "degrau" que o usuário viu ao dar zoom.

- **Hachura não tem relação com o bug.** `computeHatchSegments`/`scanlineIntersections` (`drawRegions.ts:28-70`) recortam os segmentos de hachura pelo próprio polígono via par-ímpar — nascem confinados ao contorno, sem máscara/clip separado que pudesse vazar ou cortar 1px. Não é a causa do entalhe.

## O que precisaria mudar (descrição, não código)

Duas rotas possíveis, sem mexer em `drawRegions.ts` (que já está correto):

1. **Baixo risco, cobre todo canto de parede (não só Salas):** trocar o `cap` do stroke em `drawWalls.ts:34` de `'butt'` (default implícito) para `'round'`. Um cap arredondado desenha um semicírculo de raio = metade da largura em cada ponta; em qualquer vértice compartilhado por duas paredes (canto de Sala, T de corredor, etc.) os dois semicírculos se sobrepõem e cobrem completamente a área do canto, eliminando o notch sem precisar reestruturar o path.

2. **Correto geometricamente mas mais invasivo:** para paredes que pertencem à mesma Sala (mesmo `wall.regionId`, ordenadas por `wall.regionEdgeIndex` — convenção já existente em `buildRoomFromDraft`/`buildRegularPolygonRoomFromDraft`), agrupar e desenhar como um único path fechado (`moveTo` uma vez, `lineTo` em sequência, `closePath()`, um só `stroke()`) — o mesmo padrão que `drawRegions.ts` já usa. Isso dá join de verdade (miter) nos cantos de Sala, mas exige tratar à parte paredes soltas/freeform que não fecham um loop.

A opção 1 é a mudança mínima que resolve o sintoma relatado (e generaliza para qualquer junção de paredes, não só Salas retangulares); a opção 2 é a correção "estrutural" mas com escopo maior.

**Arquivo apagado após uso:** `client/src/pixi/__scratch_drawWalls_corner.test.ts` (removido, confirmado com `ls` — não sobrou nada na pasta).

---

## bug2 linha reta ou curva (linha-curva)

## VEREDITO

O usuário quer **A) trocar a ponta da linha entre arredondada e reta** (`round` vs `butt`/`square` cap) — isso existe fisicamente no desenho mas está **hardcoded e sem controle na UI**. A leitura B (curvar/dobrar uma `line` reta) **não existe como capacidade no código**: não há função de conversão `line → curve`, nem forma de inserir ponto de controle numa `line`.

---

## A) Ponta arredondada vs reta — CONFIRMADO, é isso que falta

**`client/src/pixi/drawDrawings.ts:35`**
```ts
} else if (drawing.kind === 'line') {
  graphics.moveTo(drawing.x1, drawing.y1).lineTo(drawing.x2, drawing.y2).stroke({ width, color, cap: 'round' })
```
`cap: 'round'` é literal fixo, não vem de nenhum campo do dado.

**`client/src/types/map.ts:193`** — o schema de `line` não tem campo de cap:
```ts
| { id: string; kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
```

**`client/src/components/DrawingStyleControls.tsx:1-156`** — o painel de propriedades (cor, espessura, preenchido, opacidade de preenchimento, tamanho/fonte de texto) **não tem nenhum controle de cap**. Não há prop `cap`/`lineCap` na interface `DrawingStyleControlsProps`.

Isso bate exatamente com o que o usuário descreveu separadamente na mesma mensagem: "a linha tem a ponta circular e quer reta" — é literalmente o `cap: 'round'` fixo, sem toggle para `butt`/`square`.

**O que precisaria mudar (descrição, sem código):**
1. Adicionar campo opcional (ex. `cap?: 'round' | 'butt'`) ao tipo `line` (e provavelmente `freehand`/`curve`, que também estão fixos em `'round'` — `drawDrawings.ts:33` e `:43`) em `types/map.ts`.
2. Ler esse campo em `drawDrawings.ts:35` no lugar do literal.
3. Expor um toggle em `DrawingStyleControls.tsx` (algo como o `Toggle` já usado para "Preenchido") visível só quando a forma selecionada é `line`/`freehand`/`curve`.
4. Migração: `undefined` deveria significar `'round'` (comportamento atual), seguindo o mesmo padrão de retrocompatibilidade já usado para `locked`/`hidden` em `types/map.ts:176-183`.

---

## B) Curvar uma `line` existente — NÃO EXISTE, confirmado por ausência

**Edição de `line`** (`client/src/lib/mapFactory.ts:515-525`, `updateLinePoint`): só move os dois endpoints (`x1,y1`/`x2,y2`). Nenhuma outra operação de edição para `line` existe no arquivo — busquei `kind !== 'line'`/`kind === 'line'` no arquivo inteiro e só aparece essa função e o `case 'line'` do `moveDrawing` (linha 601-602, translação rígida).

**Alças de edição de `line`** (`client/src/pixi/drawEditHandles.ts:116-123`): desenha só os 2 círculos de vértice (`x1,y1` e `x2,y2`). Não há midpoint desenhado, diferente da Curva (`drawDrawings.ts:44-56`, que desenha vértices **e** midpoints vazados para inserir ponto).

**Gesto de inserir ponto** (`client/src/pixi/PixiCanvas.tsx:717-754`): o bloco que calcula midpoints e chama `insertCurvePoint` só entra `if (drawing && drawing.kind === 'curve')` (linha 719). Para `kind === 'line'` esse caminho nunca é alcançado — clicar no meio de uma `line` cai no fluxo genérico de arrastar/mover a forma inteira (`moveDrawing`, `mapFactory.ts:601-602`), não em "vira um ponto de controle".

**`insertCurvePoint`/`updateCurvePoint`** (`mapFactory.ts:532-544` e `mapStore.ts:457-471`) são funções exclusivas de `kind === 'curve'` — guardadas por `if (!drawing || drawing.kind !== 'curve') return map`.

Não existe, em lugar nenhum do código (busquei "converter"/"convert" em todo `client/src`), nenhuma função que transforme um `Drawing` de `kind: 'line'` em `kind: 'curve'`.

**O que precisaria mudar (descrição, sem código) se isso fosse pedido:**
1. Uma função `convertLineToCurve(map, drawingId)` em `mapFactory.ts` que troca o objeto `{kind:'line', x1,y1,x2,y2,...}` por `{kind:'curve', points:[{x1,y1},{x2,y2}], ...}` preservando `id`/`color`/`width`.
2. Um gatilho de UI (ex. botão no painel de propriedades, ou o mesmo gesto "arrastar o meio" que a Curva já tem, mas reaproveitado por `line` fazendo a conversão implícita na primeira inserção de ponto).
3. Atualizar `selectionHitTest.ts` e `drawEditHandles.ts` para tratar a entidade convertida como curva daí em diante.

---

## Qual o usuário quis dizer

**A**, com alta confiança. A pista decisiva é a frase separada citada na tarefa: *"a linha tem a ponta circular e quer reta"* — isso é vocabulário de cap (ponta/extremidade), não de bending. "Dobrar para ficar reta ou arredondada" é provavelmente o mesmo usuário descrevendo a mesma coisa com outra palavra ("dobrar" no sentido de "trocar o formato da ponta"), não um pedido de transformar a linha numa curva — não há no app nenhum conceito de "dobrar uma linha reta" que faria sentido com o resto da frase dele. B é tecnicamente uma leitura válida da palavra "dobrar" isolada, mas a segunda frase do usuário desambiguiza para A.

---

## inventario variantes de ferramenta (variantes)

## VEREDITO

Não há bug relatado nesta tarefa para diagnosticar (o texto de missão é o boilerplate padrão, mas nenhum problema concreto foi descrito) — o que existe é um pedido de inventário para a feature "setinha de variantes por ferramenta", e a resposta a essa investigação é: **metade dos exemplos que o usuário deu já são preferências de ferramenta com schema, store e painel prontos (só faltam aparecer perto do botão), a outra metade não existe em lugar nenhum do código.**

---

## 1. Lista completa das ferramentas de hoje

`client/src/types/tools.ts:1-22` — `DrawingTool` tem **22 valores**. `client/src/components/labels.ts:73-82` (`TOOL_GROUPS`) agrupa **21 deles** em 3 grupos (o 22º, `measure`, está no grupo 3 — na verdade contei certo: são 21 listados + `select` = 22, confere com o union):

- Grupo 1 (1 ferramenta): `select`
- Grupo 2 (9 ferramentas — "entidades de mapa"): `wall, door, light, region, room, roomCircle, roomPolygon, stair, prop`
- Grupo 3 (11 ferramentas — "desenho livre"): `brush, line, circle, ellipse, rect, polygon, curve, text, measure, eraser`

Rótulos em `TOOL_LABELS` (`labels.ts:13-35`) e ícones em `TOOL_ICONS` (`Toolbar.tsx:37-59`) — os dois `Partial<Record<...>>` batem 1:1 com as 21 entradas de `TOOL_GROUPS`; `token` tem entrada em `TOOL_LABELS`/`TOOL_ICONS` mas **não aparece em nenhum grupo de `TOOL_GROUPS`** (`labels.ts:73-82` não lista `'token'`) — ou seja, hoje `token` não tem botão na barra (é colocado por outro fluxo, não pela Toolbar). Vale confirmar com o usuário se isso é intencional antes de desenhar o submenu dela.

## 2. Variantes já existentes no schema/código (confirmadas uma a uma)

| Suspeita do usuário | Existe? | Evidência | Onde aparece hoje na UI |
|---|---|---|---|
| `doorKind` normal/double/gate | **Sim, completo** | Tipo em `types/map.ts:74`; preferência de próxima porta em `mapStore.ts:91,303,334` (`doorKind`/`setDoorKind`); edição de porta já criada em `mapStore.ts:194,434-436`; comprimento por tipo em `DOOR_LENGTH_BY_KIND` (`mapStore.ts:266`); UI pronta em `components/DoorKindControls.tsx` (3 botões com ícone próprio, `normal/double/gate`) | Painel esquerdo (`PropertiesPanel.tsx:140,157`), condicionado a `activeTool === 'door'` — **não** no botão da Toolbar |
| `wallKind` interior/exterior | **Sim, completo** | Tipo em `types/map.ts:46`; preferência em `mapStore.ts:86,302,333`; edição de parede existente em `mapStore.ts:185,430`; UI em `components/WallStyleControls.tsx` (toggle "Parede interna") | Painel esquerdo, condicionado a `activeTool === 'wall'` |
| `polygonSides` | **Sim, completo, mas só para `roomPolygon`** | `mapStore.ts:82,301,332`; UI em `components/PolygonSidesControls.tsx` (slider 3-12 lados) | Painel esquerdo, `PropertiesPanel.tsx:140`: `{activeTool === 'roomPolygon' && <PolygonSidesControls .../>}`. **Atenção**: a ferramenta `polygon` (grupo 3, desenho livre) é um polígono de vértices arbitrários — não usa `polygonSides` e não tem esse controle. São duas ferramentas diferentes com o mesmo nome de conceito. |
| `fillPattern` solid/hatch | **Sim, completo** | `types/map.ts:120`; preferência em `mapStore.ts:141-142,305,385`; edição de região existente em `mapStore.ts:143,386-389`; UI em `components/RegionStyleControls.tsx:45-49` (toggle "Hachurado"); render em `pixi/drawRegions.ts` | Painel esquerdo, para `region/room/roomCircle/roomPolygon` ou região selecionada (`PropertiesPanel.tsx:110-115,139`) |
| `StairShape` reta/L/dupla | **Existe no tipo, NÃO construída** | `types/map.ts:203-205`: comentário explícito "'l' e 'double' existem no schema e no render desde já; a UI desta rodada só produz 'straight'"; `lib/stairs.ts:10-19,24`: `buildStairFromDraft` sempre retorna `shape: 'straight'`, hardcoded — não há branch nem parâmetro para escolher L/dupla. `selectionHitTest.ts` referencia o tipo mas não constrói variantes. **Não existe nenhum componente de UI para escolher shape de escada** (só `StairControls.tsx` para `direction`, up/down) | Nenhuma — este é o único caso dos "suspeitos" do usuário que precisaria de trabalho de verdade (render + hit-test das formas L/dupla, que o comentário diz já existir, mas a ferramenta de criação não) |

**Os 4 exemplos que o próprio usuário deu na tarefa, checados à parte:**

- **Pincel (caneta/lápis)**: não existe nada — `Drawing` kind `'freehand'` só tem `points/color/width` (`types/map.ts:192`), sem campo de textura/estilo de traço. 100% feature nova.
- **Borracha (parte vs. objeto todo)**: não existe — `eraseAt` em `pixi/PixiCanvas.tsx:499-513` sempre chama `findSelectableAt` e remove a **entidade inteira** via os removers padrão; não há lógica de recorte/apagar-trecho em lugar nenhum do código. 100% feature nova.
- **Linha (reta ou curva)**: `line` e `curve` já existem, mas como **duas ferramentas separadas e completas** (botões distintos no grupo 3, `TOOL_GROUPS` linha 81), não como uma variante de uma ferramenta só. Se a intenção é fundir os dois botões num só com submenu, é reorganização de UI sobre feature já pronta, categoria diferente das outras linhas desta tabela.
- **Escada (pequena/média/grande)**: não existe nenhum preset de tamanho. O único "tamanho" hoje é `stepWidth` (largura do lance), campo numérico livre, default = `map.grid` (`types/map.ts:219`, `lib/stairs.ts:14-15`) — sem UI de preset P/M/G. O que **existe** é `StairShape` (reta/L/dupla, tabela acima), que é um eixo diferente (forma, não tamanho). O exemplo do usuário não corresponde ao que está latente no schema — vale alinhar se ele quer tamanho (novo) ou forma (já rascunhado) antes de decidir o quê implementar.

## 3. Como a Toolbar é construída hoje e o que quebraria com submenu

`components/Toolbar.tsx:135-167`: itera `TOOL_GROUPS`, cada `tool` vira um único `<button>` sem filhos de texto — `aria-label`/`data-tip` vêm de `TOOL_LABELS[tool]` (linha 156/158), e é **esse nome acessível** que os specs e2e usam para clicar (`page.getByRole('button', { name: 'Porta', exact: true }).click()`, confirmado em `e2e/task-door-kinds.spec.ts:53` e outros 7 arquivos).

Contei os specs reais: **105 ocorrências de `test(` em 28 arquivos** de `client/e2e/*.spec.ts` (o comentário em `Toolbar.tsx:89` cita "87 specs" — número desatualizado; o valor que o usuário usou, 105, é o correto hoje).

O que isso implica para o submenu:
- Clique único no botão de ferramenta hoje **seleciona a ferramenta direto** — nenhum spec espera um menu intermediário. Se o clique no corpo do botão passar a abrir um dropdown em vez de selecionar, **todos os specs que clicam num botão de ferramenta quebram**, não só os 8 arquivos que testam `doorKind`/`wallKind`/etc.
- Caminho que não quebra nada: a "setinha" precisa ser um **hit target adicional dentro do mesmo `<button>` ou um elemento irmão pequeno** (ex.: um chevron sobreposto no canto), nunca substituir o `onClick` do botão principal. Clique no corpo = seleciona a ferramenta com a última variante escolhida (comportamento atual, preservado); clique na seta = abre o menu de variantes, sem disparar `onSelectTool`.
- `TOOL_GROUPS`/`TOOL_ICONS`/`TOOL_LABELS` continuam por-`DrawingTool`, então "variante" não pode ser um novo valor de `DrawingTool` (ex. `doorKind` não é uma tool nova, é um atributo da tool `door`) — o submenu edita a **preferência da store** (`doorKind`, `wallKind`, `polygonSides`...), não troca `activeTool`. Isso já é exatamente o modelo que `mapStore.ts` usa hoje (linha 82-91), só falta a superfície de UI perto do botão em vez de só no painel esquerdo.
- A quebra de linha da barra é por **grupo inteiro** (`Toolbar.tsx:79-89`, `.lb-toolbar__group` com `flex-wrap: nowrap`) — um submenu que se abre por cima não deveria alterar a largura do botão nem do grupo (senão desloca a lógica de quebra de linha calculada em `placeHint`/CSS).

## 4. Todo o estado de preferência de ferramenta hoje na store

De `client/src/stores/mapStore.ts`, o conjunto que um painel de variantes por ferramenta teria que exibir/gravar (todos são estado de **sessão**, sem histórico de undo — ver comentário linha 66-70 do arquivo, contraste com as actions `with History`):

| Campo | Linha | Tool(s) associada(s) |
|---|---|---|
| `drawColor` | 72, 295 | brush, line, circle, ellipse, rect, polygon, curve, text |
| `drawWidth` | 73, 296 | idem, exceto formas preenchíveis usam também `drawFilled` |
| `drawFilled` | 74, 297 | circle, rect, ellipse, polygon |
| `drawFillAlpha` | 75-79, 298 | circle, rect, ellipse, polygon |
| `drawFontSize` | 80, 299 | text |
| `drawFontFamily` | 81, 300 | text |
| `polygonSides` | 82, 301 | **roomPolygon** apenas (não `polygon`) |
| `wallKind` | 83-86, 302 | wall |
| `doorKind` | 87-91, 303 | door |
| `regionFillColor` | 138, 304 | region, room, roomCircle, roomPolygon |
| `regionFillPattern` | 141-142, 305 | region, room, roomCircle, roomPolygon |
| `snapTargets` (token/wall/prop) | 71, 294 | global, não por ferramenta — fica de fora do escopo "por ferramenta" |

Não há hoje nenhuma preferência de sessão para `stair` (shape/tamanho), `brush` (estilo de traço) ou `eraser` (modo de apagar) — bate com a tabela do item 2: são os três casos que exigiriam schema novo, não só UI.

---

## O que precisaria mudar para a feature (descrição, sem código)

1. **Decidir o modelo de interação da seta** — um segundo hit-target por botão que abre um popover ancorado, sem substituir o clique principal (só assim os 105 specs continuam válidos).
2. **Popover de variantes lê/escreve a mesma preferência que `PropertiesPanel` já usa** (`doorKind`, `wallKind`, `polygonSides`, `regionFillPattern`) — não duplicar estado; os componentes `DoorKindControls`/`WallStyleControls`/`PolygonSidesControls`/`RegionStyleControls` já são o conteúdo do popover, só mudam de contêiner (painel → dropdown ancorado no botão).
3. **Para `stair`**: implementar de fato as formas `l`/`double` em `lib/stairs.ts` (geometria) + render (`pixi/drawStairs.ts`, não lido nesta investigação mas citado no schema) antes de expor no submenu — hoje é comentário de intenção, não código funcional.
4. **Para `brush` e `eraser`**: schema novo do zero — nenhuma base de código para reaproveitar, ao contrário dos outros casos.
5. **`line`/`curve`**: decisão de produto primeiro (fundir os dois botões existentes em um com submenu, ou manter separados) — não é achado de código, é escolha de UX que muda `TOOL_GROUPS`.

**Arquivos relevantes para implementação futura** (todos absolutos):
`C:\dev\labirinto\client\src\types\tools.ts`, `C:\dev\labirinto\client\src\components\labels.ts`, `C:\dev\labirinto\client\src\components\Toolbar.tsx`, `C:\dev\labirinto\client\src\components\PropertiesPanel.tsx`, `C:\dev\labirinto\client\src\components\DoorKindControls.tsx`, `C:\dev\labirinto\client\src\components\WallStyleControls.tsx`, `C:\dev\labirinto\client\src\components\PolygonSidesControls.tsx`, `C:\dev\labirinto\client\src\components\RegionStyleControls.tsx`, `C:\dev\labirinto\client\src\stores\mapStore.ts`, `C:\dev\labirinto\client\src\lib\stairs.ts`, `C:\dev\labirinto\client\src\pixi\PixiCanvas.tsx`.

Nenhum arquivo foi alterado — investigação 100% read-only.

---

## inventario painel contextual (painel-contextual)

Tenho evidência suficiente para diagnosticar o bug real e completar o inventário. Segue o relatório.

## VEREDITO

O painel de propriedades **não tem filtragem por ferramenta** — 6 seções (Grade, Medição, Alinhar grade, Camadas, Cenário, Seleção) renderizam **sempre**, independente da ferramenta ativa ou de haver seleção, e `GridControls`/`GridAlignControls` sozinhas somam ~15 controles antes mesmo de chegar em "Medição" — por isso "GRADE ocupa a tela toda" e "MEDIÇÃO fica cortada embaixo": a ordem de renderização é Grade → Medição → Alinhar grade, e Grade é a mais longa das três.

## Evidência

**1. `client/src/components/PropertiesPanel.tsx` — seções e suas condições exatas (linhas 108-190):**

| Seção | Condição de exibição | Linha |
|---|---|---|
| `DrawingStyleControls` | `activeTool ∈ DRAWING_TOOLS` OU (`activeTool==='text'` e nada de texto selecionado) | 108-109, 138 |
| `RegionStyleControls` | `activeTool ∈ {region, room, roomCircle, roomPolygon}` OU há Região selecionada | 110-115, 139 |
| `PolygonSidesControls` | `activeTool === 'roomPolygon'` | 140 |
| `TextLabelControls` | há rótulo de texto selecionado | 141-149 |
| `GridControls` | **sempre** | 150 |
| `MapScaleControls` | **sempre** | 151 |
| `GridAlignControls` | **sempre** | 152 |
| `LayersPanel` | **sempre** | 153 |
| `ScenarioLinkControls` | **sempre** | 154 |
| `WallStyleControls` | `activeTool === 'wall'` OU há Parede selecionada | 116, 155 |
| `WallDoorControls` | há Parede selecionada | 156 |
| `DoorKindControls` | `activeTool === 'door'` OU (Parede selecionada com porta) | 121, 157 |
| `PortalControls` | há Prop (objeto) selecionado | 158 |
| `ItemTransformControls` (Objeto) | há Prop selecionado | 159-167 |
| `TokenImageControls` | há Token selecionado | 168 |
| `ItemTransformControls` (Token) | há Token selecionado | 169-177 |
| `LightControls` | há Luz selecionada | 178 |
| `StairControls` | há Escada selecionada | 179 |
| `RoomControls` | Região selecionada com `region.room` definido | 180-188 |
| `SelectionControls` | **sempre** | 189 |

**2. Medição com ferramenta Seleção ativa e nada selecionado** (`activeTool==='select'`, que **não** está em `DRAWING_TOOLS` — `client/src/components/labels.ts:90`): todos os `selected*` são `null`, então **6 seções sempre-visíveis** renderizam: `GridControls`, `MapScaleControls`, `GridAlignControls`, `LayersPanel`, `ScenarioLinkControls`, `SelectionControls`. Contagem de campos/controles internos:
- `GridControls` (`GridControls.tsx:53-141`): 8 controles (toggle mostrar grade, 3 toggles de snap, seletor de formato, cor, opacidade, espessura, estilo de linha) — a maior seção do painel.
- `GridAlignControls` (`GridAlignControls.tsx:109-223`): 8 elementos, **renderizados mesmo sem imagem de fundo** (o aviso "Importe uma imagem..." de `:113-117` não substitui o resto — colunas, linhas, botão Aplicar, toggle prévia, offset X/Y, botão zerar, "tamanho atual" continuam todos visíveis).
- `MapScaleControls` (`MapScaleControls.tsx:34-98`): 4 campos.
- `LayersPanel`/`ScenarioLinkControls`/`SelectionControls`: 34+20+36 linhas, menores.

Isso bate exatamente com a queixa do usuário: a ordem no JSX é Grade (a mais pesada) → Medição → Alinhar grade (também pesada), então com o painel sem scroll rolado, Grade domina a viewport e Medição fica abaixo da dobra.

## Inventário (feature nova: painel por ferramenta)

**3. "Tirar o fundo" — hoje funciona só para `Drawing`, não para `Region`:**
- `Drawing` (rect/ellipse/circle/polygon) **já suporta** contorno-sem-fundo: `filled: boolean` existe no schema (`types/map.ts:194-200`) e o renderer respeita — `if (drawing.filled) graphics.fill(...)` (`client/src/pixi/drawDrawings.ts:59,63,67,72`); com `filled=false` só o `stroke` desenha. `DrawingStyleControls.tsx:132` já tem o toggle "Preenchido". **Nada a construir aqui** — só precisa ficar visível quando a ferramenta de desenho de forma está ativa (já fica, via `showFilled`).
- `Region` **NÃO suporta**: a interface `Region` (`types/map.ts:115-134`) não tem campo `filled` — só `fillColor`/`fillPattern`. O renderer `drawRegions.ts:120-123` faz `g.fill(...)` **incondicionalmente**, sem guarda. `RegionStyleControls.tsx` só tem toggle Hachurado/Sólido, nenhum toggle de preenchimento. **Falta**: campo `Region.filled?: boolean` (default `true`, sem migração — mesmo padrão de `wallKind`), guarda `if (region.filled !== false)` antes do `g.fill()` em `drawRegions.ts:122`, e um `Toggle` em `RegionStyleControls.tsx`.

**4. "Ponta da linha" (lineCap/lineJoin) — não existe:**
- `rg "lineCap|lineJoin"` em `client/src` retorna **zero ocorrências**. O tipo `Drawing` kind `'line'` (`types/map.ts:193`) não tem esse campo. O render (`drawDrawings.ts:35`) hardcoda `cap: 'round'` sempre — nunca `'square'`/`'butt'`. **Falta**: campo `Drawing['line'].lineCap?: 'round'|'square'` no schema, uso em `drawDrawings.ts:35`, e um controle (provavelmente segmented control, mesmo padrão de `LINE_STYLES` em `GridControls.tsx:6-10`) em `DrawingStyleControls.tsx`, visível só quando `activeTool==='line'`.

**5. "Escada pequena/média/grande" — schema tem o campo, UI não tem controle:**
- `Stair.stepWidth: number` (`types/map.ts:220`) já controla a "largura do lance" — é exatamente o eixo de tamanho que o usuário quer. `computeStairSteps` (`lib/stairs.ts:53`) já usa esse valor para desenhar os degraus.
- `StairControls.tsx:10-13` documenta **explicitamente** que não expõe `stepWidth` "de propósito" (fora do contrato de uma fase anterior) — só tem o toggle de direção (`up`/`down`).
- **Falta**: um controle de `stepWidth` em `StairControls.tsx` (ex.: 3 presets P/M/G mapeados a múltiplos de `map.grid`, ou um range) + a ação de store equivalente a `setStairDirection` só que para `stepWidth`.

**2. Controles reaproveitáveis sem código novo, só reorganização por ferramenta:**
Todos os componentes citados no pedido do usuário já existem e já são "só compõe" (comentário em `PropertiesPanel.tsx:64-67`): `DrawingStyleControls`, `GridControls`, `RegionStyleControls`, `WallDoorControls`, `TextLabelControls`, `PolygonSidesControls`, `LightControls`, `StairControls`, `RoomControls`, `MapScaleControls`, `WallStyleControls`, `ItemTransformControls`, `TokenImageControls`, `GridAlignControls`. Uma reorganização por ferramenta é puramente sobre **as condições booleanas em `PropertiesPanel.tsx:108-121`** (que hoje já são por-ferramenta em parte — `showDrawingStyle`, `showRegionStyle`, `showWallStyle`, `showDoorKind`) somada a esconder as 6 seções "sempre visíveis" atrás de um contexto de ferramenta próprio (ex.: uma aba "Mapa" separada de uma aba "Ferramenta"), o que resolveria a queixa do item 5 sem remover nenhuma funcionalidade.

## Fora do escopo
Nenhuma alteração de código foi feita — investigação 100% read-only, nenhum arquivo temporário/spec criado.