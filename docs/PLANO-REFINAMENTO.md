# PLANO DE EXECUÇÃO — refino de sensação do editor Labirinto

Raiz: `C:\dev\labirinto\`. Caminhos da tabela são relativos a `C:\dev\labirinto\client\src\` salvo quando prefixados.
Verificações feitas nesta consolidação: `PixiCanvas.tsx` = 2098 linhas com **toda** a máquina de gesto (34 modos, `let mode` em `PixiCanvas.tsx:384`) dentro de **um único `useEffect`** de closure; `mapStore.ts` = 761 linhas **com 76KB de teste** (`stores/mapStore.test.ts` — não é área destestada); `world.ts` = 70 linhas, puro, com teste; **nenhum e2e usa `wheel`** (`grep -rn "wheel|deltaY" client/e2e` → só um comentário em `task-middle-button-pan.spec.ts`); **7 specs e2e usam screenshot/pixel-diff**.

---

## 1. DIAGNÓSTICO — UMA FRASE

**O canvas não fecha o laço de feedback com o ponteiro: nada é confirmado antes do clique (cursor preso em `default` para 22 ferramentas em `pixi/PixiCanvas.tsx:645-647`, zero hover), nada é confirmado durante o gesto (sem número ao vivo em 6 das 8 ferramentas de forma), e nada é confirmado depois (undo desfaz um fiapo do arrasto, erro some em silêncio) — "travado" é ausência de resposta, não lentidão.**

Por que não escolhi "a roda faz zoom em vez de pan", que foi o mais citado (D1, D6): é o item nº 1 da lista de execução porque custa ~8 linhas, mas é um gesto que o usuário reaprende em 30 segundos e depois compensa. O cursor morto e o hover ausente **nunca** são aprendidos — cada clique continua sendo um salto de fé até o último dia de uso. A causa dominante é o canal de feedback, não o mapeamento de um gesto.

---

## 2. LISTA ÚNICA PRIORIZADA (impacto / esforço)

Duplicatas já fundidas: "cursor" (D2+D3+D5+D6 → #1), "roda=zoom" (D1+D6 → #2), "undo granular" (D4 canvas + D6 sliders → #3 e #4), "duplicar" (D2+D4+D5+D6 → #13), "enquadrar/fit/câmera inicial" (D1 três achados + D6 → #9), "nudge" (D2+D4+D5+D6 → #7), "pan universal" (D1+D4+D6 → #8), "toast/erro silencioso" (D5+D6 → #12).

| # | melhoria | dimensão | impacto | esforço | arquivos | por que muda a sensação |
|---|---|---|---|---|---|---|
| 1 | Cursor vivo: `crosshair` em ferramenta de desenho, `grab`/`grabbing` no pan, `move` em drag, `nwse/nesw-resize` sobre alça, `pointer` sobre selecionável | feedback | Alto | P | **novo** `pixi/cursorPolicy.ts` + teste; integra em `pixi/PixiCanvas.tsx:645` e nas transições de `mode` | É o único sinal que existe a 60fps sem clique nenhum. Cursor congelado é a definição visual de "travado" |
| 2 | Roda = pan (`deltaX`/`deltaY`); `ctrlKey` = zoom (cobre pinça de trackpad) | navegação | Alto | P | **novo** `pixi/wheelGesture.ts` + teste; `pixi/PixiCanvas.tsx:2059-2068` | O gesto mais repetido do app hoje faz o oposto do reflexo do usuário. Zero e2e depende disso |
| 3 | Undo por gesto no mover-corpo: `moveToken/Prop/Wall/Region/Stair/Drawing` viram `*Live` + `commitDragHistory` no pointerup | teclado | Alto | P | `stores/mapStore.ts` (padrão já existe, `:351`), `pixi/PixiCanvas.tsx:1518-1702`; teste **novo** `stores/dragHistory.test.ts` | Medido: 40 pointermove = 40 entradas de undo. Ctrl+Z que "não anda" é o comportamento mais claramente quebrado da lista |
| 4 | Undo por gesto nos sliders de propriedade (intensidade, opacidade, espessura) | vtt | Alto | P | `components/LightControls.tsx:45`, `components/DrawingStyleControls.tsx:150`, `stores/mapStore.ts` (variantes `*Live`) | Mesmo defeito do #3 pelo painel: ~40 entradas por arrasto de slider |
| 5 | Atalho de ferramenta por letra (V/W/R/O/L/P/E/T…) via tabela pura, ignorando foco em INPUT/TEXTAREA/SELECT | teclado | Alto | P/M | **novo** `lib/keymap.ts` + teste; `App.tsx`, `pixi/PixiCanvas.tsx:2034` | Trocar de ferramenta hoje é sempre olho→barra→clique→olho. Dezenas de quebras de ritmo por sessão |
| 6 | Atalho visível: letra no `data-tip` de cada ferramenta e ação | teclado | Alto | P | `components/labels.ts`, `components/Toolbar.tsx`, `components/ActionBar.tsx` | Atalho invisível ≡ atalho inexistente. Torna #5, #7, #13 descobríveis sem doc |
| 7 | Nudge por seta: 1 célula com snap ligado (Alt = 1px), Shift+seta = 10× | seleção | Alto | P | `lib/keymap.ts`, `pixi/PixiCanvas.tsx` (reusa `move*Live` do #3) | Sem ajuste fino, posicionar é arrastar de novo do zero. É a correção que falta depois de todo drag |
| 8 | Pan universal por Espaço+arrastar, em qualquer ferramenta | navegação | Alto | P | `pixi/PixiCanvas.tsx:656-1116` (novo flag `spaceHeld` → `mode='panning'`) | Hoje panar exige botão do meio (trackpad não tem) ou trocar para Selecionar |
| 9 | `contentBounds` + `fitCamera`: enquadrar tudo (`F`), reset 100% (`Ctrl+0`), e **fit automático ao abrir mapa** | navegação | Alto | M | `pixi/world.ts` + `pixi/world.test.ts`, `stores/mapStore.ts:446`, `pixi/PixiCanvas.tsx` | Câmera nasce `{0,0,1}` sempre: o usuário abre um mapa salvo olhando para um recorte arbitrário, e não existe nenhuma saída de emergência quando se perde |
| 10 | HUD de zoom % (canto), clicável para reset | navegação | Médio-Alto | P | **novo** `components/ZoomHud.tsx` + `ZoomHud.css` (não tocar `main.css`), `App.tsx` | Torna o estado da câmera legível e dá feedback quando a roda "morre" nos limites 10%/400% |
| 11 | Flag "sujo" + `Ctrl+S` + aviso/autosave no fechamento da janela | vtt | Alto | M | **novo** `stores/sessionStore.ts`, `App.tsx:334`, `desktop/src-tauri/` (`onCloseRequested`) | Não é sensação: é **perda de dado real** hoje (zero handler de fechamento, zero autosave). Barato o bastante para não esperar |
| 12 | Toast + `try/catch` em todos os `handle*` + aviso de textura que não carrega | feedback | Alto | M | **novo** `components/Toast.tsx`/`.css`, **novo** `stores/toastStore.ts`, `App.tsx:316-392`, `pixi/tokensRenderer.ts:145`, `pixi/drawProps.ts:57` | Falha silenciosa (token some, JSON inválido vira promise rejection) é o que produz desconfiança de "programa estranho" |
| 13 | Duplicar: `Ctrl+D` e `Alt+arrastar` | seleção | Alto | M | **novo** `lib/entityClone.ts` + teste, `stores/mapStore.ts`, `pixi/PixiCanvas.tsx` (pointerdown com `altKey`) | Masmorra é repetição (porta, tocha, móvel). Hoje só existe recriar do zero e reconfigurar estilo toda vez |
| 14 | Shift trava proporção em círculo/retângulo/elipse/polígono regular | desenho | Médio-Alto | P/M | **novo** `lib/shapeConstraint.ts` + teste, `pixi/PixiCanvas.tsx:1862-1918` | Círculo e quadrado perfeitos hoje só saem "no olho". É o caso mais banal em que o editor dá trabalho |
| 15 | Hover state (contorno fraco no objeto sob o ponteiro) | feedback | Alto | M | **novo** `pixi/drawHover.ts` + teste (reusa `lib/selectionHitTest.ts`), `pixi/PixiCanvas.tsx` (pointermove idle) | Antecipa o resultado do clique antes de gastar o clique — sem isso o canvas parece imagem estática |
| 16 | Número ao vivo durante criação/resize (W×H, raio, lados) | feedback | Médio | M | **novo** `pixi/drawDimensionLabel.ts` + **novo** `lib/dimensionText.ts` + teste, `pixi/PixiCanvas.tsx:1825-1919` | Hoje só Parede/Linha (ângulo) e Medir têm número; Sala e Retângulo se desenham no escuro |
| 17 | Shift (proporção) e Alt (a partir do centro) no resize por canto | seleção | Médio | P/M | `lib/objectTransform.ts` + `lib/objectTransform.test.ts`, `pixi/PixiCanvas.tsx:1731-1755` | Redimensionar hoje sempre deforma; recuperar a proporção é impossível sem refazer |
| 18 | Alça de raio no Drawing `circle` (hoje `drawingBoundingBox` devolve `null`) | desenho | Médio | P | `lib/objectTransform.ts:156`, `pixi/drawEditHandles.ts` | Reaproveita `drawLightRadiusHandle`, que já existe. Círculo é o único desenho sem nenhuma alça — parece bug |
| 19 | Guias de alinhamento em `dragging-line-body` e `dragging-stair-body` | seleção | Médio | P | `lib/alignmentGuides.ts`, `pixi/PixiCanvas.tsx:1670-1714` | Cobertura inconsistente: gruda ao mover parede, não gruda ao mover escada. Inconsistência lê-se como falha |
| 20 | `Ctrl+A` + botões visíveis de desfazer/refazer (desabilitados quando `past/future` vazio) + poda do histórico | teclado | Médio | P | `components/ActionBar.tsx`, `components/icons.tsx`, `stores/mapStore.ts:433` | Torna o histórico um objeto visível e impede o `past` crescer sem limite |
| 21 | Moldura do mapa desenhada a partir de `map.width/height` | vtt | Baixo-Médio | P | **novo** `pixi/drawMapBounds.ts` + teste, `pixi/PixiCanvas.tsx` | Hoje o número no painel "Cenário" é decorativo (zero uso no render). Uma borda dá âncora espacial num canvas infinito |
| 22 | Bug: parede-dona-de-Sala selecionada não pinta a região com `SELECTION_COLOR` | feedback | Baixo | P | `pixi/drawRegions.ts:120-122` | Bug conhecido (dossiê F4 bug3); seleção que não confirma o que foi selecionado |
| 23 | Tela Carregar Mapa: ordenar por recência, renomear, duplicar, excluir | vtt | Médio | M | `lib/mapFileIO.ts`, `screens/LoadMapScreen.tsx` + testes | Único atrito grande fora do canvas; hoje a lista é `readDir` cru sem nenhuma operação |
| 24 | Multi-seleção item-a-item (Shift+clique) — unificar `selection` e `areaSelection` num modelo de conjunto | seleção | Alto | G | **novo** `lib/selectionModel.ts` + teste, `lib/selectionHitTest.ts`, `lib/areaSelection.ts`, `stores/mapStore.ts`, `pixi/PixiCanvas.tsx:1034-1114` | Alto valor, **último de propósito**: é o único refactor estrutural da lista e o de maior risco de regressão (ver §5) |

### Contradições entre as análises — decisões tomadas

- **C1 — Ferramenta volta para "Selecionar" após criar?** D3 diz sim (Excalidraw). **Decisão: NÃO.** A ferramenta continua grudenta; a saída é `V`/`Esc` (#5) e auto-selecionar a entidade recém-criada. Motivo: desenhar 30 paredes seguidas é o fluxo dominante de um editor de masmorra — auto-revert cobra um clique extra por parede.
- **C2 — Arrastar em área vazia: pan ou marquee?** D1 quer marquee (Figma). **Decisão: continua pan**, mais Espaço+arrastar universal (#8), mais Shift+arrastar = marquee (como hoje). Motivo: em VTT panar é ordens de grandeza mais frequente que marquee, e a inversão quebra e2e cuja intenção está documentada em comentário no próprio código.
- **C3 — Shift ou Ctrl para travar?** D3 hesita. **Decisão: Shift trava proporção (formas), Ctrl continua travando ângulo (parede/linha/escada).** São restrições diferentes; Ctrl=ângulo já tem e2e (`task-ctrl-reto.spec.ts`) e Shift=proporção é convenção de Figma/Paint/Excalidraw.
- **C4 — Nudge de 1px ou 1 célula?** **Decisão: 1 célula com snap ligado, 1px com Alt, 10× com Shift.** O app é grid-first; `Alt` já significa "inverter snap" no código, então o significado é reaproveitado, não inventado.

---

## 3. ONDAS DE TRABALHO

**Regra de arquitetura que destrava o paralelismo:** `PixiCanvas.tsx` tem a máquina de gesto inteira dentro de **uma closure de `useEffect`** — não é fatiável em paralelo. Então **nenhuma frente edita `PixiCanvas.tsx`**. Cada frente entrega um **módulo puro, novo, com teste próprio**, cuja assinatura é `(estado) → decisão`; o integrador da onda faz uma chamada de uma linha dentro da closure. Arquivos de alto risco (`stores/mapStore.ts`, `lib/mapFactory.ts`, `pixi/PixiCanvas.tsx`, `App.tsx`, `components/PropertiesPanel.tsx`, `components/labels.ts`, `main.css`, `types/map.ts`) só pelo integrador, um por onda.

### Onda 1 — "o ponteiro passa a responder" (itens 1,2,3,5,6,7,8,9,10)

| frente | arquivos que toca (exclusivos) |
|---|---|
| A — política de cursor | **novo** `pixi/cursorPolicy.ts`, **novo** `pixi/cursorPolicy.test.ts` — exporta `resolveCursor({ mode, activeTool, hoverKind }): string`, tabela exaustiva |
| B — gesto de roda | **novo** `pixi/wheelGesture.ts`, **novo** `pixi/wheelGesture.test.ts` — `resolveWheel({deltaX,deltaY,deltaMode,ctrlKey}) → {kind:'pan',dx,dy} \| {kind:'zoom',deltaY}` |
| C — mapa de teclado | **novo** `lib/keymap.ts`, **novo** `lib/keymap.test.ts` — `resolveShortcut(evt) → Action \| null`, cobrindo letras de ferramenta, setas, `Ctrl+D/S/O/0/A`, `F`, `Esc`. **Puro, sem wiring** |
| D — enquadramento | `pixi/world.ts`, `pixi/world.test.ts` (arquivo pequeno, puro, fora da lista de risco) — `contentBounds(map)`, `fitCamera(bounds, viewport)` |
| E — HUD de zoom | **novo** `components/ZoomHud.tsx`, **novo** `components/ZoomHud.css` (proibido tocar `main.css`) |
| F — rede de segurança do undo | **novo** `stores/dragHistory.test.ts` — escreve o teste **vermelho** que prova "N pointermove = 1 entrada em `past`" para as 6 ações de mover-corpo e para os 3 sliders. Não edita produção |

**Integrador 1** (sozinho, ao fim): `pixi/PixiCanvas.tsx` (pluga A em `updateCursor` e em cada transição de `mode`; troca `onWheel` por B; liga C no `onKeyDown` de `:2034`; flag `spaceHeld`; chama D), `stores/mapStore.ts` (variantes `*Live` de mover-corpo + camera inicial), `App.tsx` (atalhos globais + monta E), `components/labels.ts` (letra no tooltip). Fecha com o teste da frente F verde.

### Onda 2 — "o app fala quando algo acontece" (itens 11,12,14,15,16)

| frente | arquivos que toca |
|---|---|
| A — notificação | **novo** `components/Toast.tsx`, **novo** `components/Toast.css`, **novo** `stores/toastStore.ts` + teste, `pixi/tokensRenderer.ts:145`, `pixi/drawProps.ts:57` |
| B — hover | **novo** `pixi/drawHover.ts` + teste, **novo** `lib/hoverHitTest.ts` + teste (envelopa `selectionHitTest.ts` sem editá-lo) |
| C — número ao vivo | **novo** `lib/dimensionText.ts` + teste, **novo** `pixi/drawDimensionLabel.ts` + teste |
| D — não perder trabalho | **novo** `stores/sessionStore.ts` + teste (flag suja via `subscribe` no mapStore, sem editá-lo), `desktop/src-tauri/` (`onCloseRequested`) |
| E — trava de proporção | **novo** `lib/shapeConstraint.ts` + teste |

**Integrador 2**: `pixi/PixiCanvas.tsx` (hover no pointermove idle; rótulo de dimensão nos blocos `drawing-*`; Shift em `drawing-circle/rect/ellipse/polygon-room`), `App.tsx` (monta Toast, `try/catch` nos `handle*`, `Ctrl+S`, aviso de fechamento).

### Onda 3 — "manipular sem medo" (itens 13,17,18,19,20,21)

| frente | arquivos que toca |
|---|---|
| A — clonagem | **novo** `lib/entityClone.ts` + teste (clone profundo por `kind`, id novo, offset) |
| B — geometria de transformação | `lib/objectTransform.ts` + `lib/objectTransform.test.ts`, `pixi/drawEditHandles.ts` — **dona única** desses arquivos (itens 17 e 18 juntos, porque colidiriam) |
| C — guias | `lib/alignmentGuides.ts` + teste |
| D — histórico visível | `components/ActionBar.tsx`, `components/icons.tsx`, **novo** `stores/historyCap.test.ts` |
| E — moldura do mapa | **novo** `pixi/drawMapBounds.ts` + teste |

**Integrador 3**: `stores/mapStore.ts` (`duplicateSelected`, poda do `past`), `pixi/PixiCanvas.tsx` (`Alt+arrastar`, alça de círculo, guias em corpo de linha/escada, moldura), `components/labels.ts`.

### Onda 4 — "fluxo e o único refactor estrutural" (itens 22,23,24 + camadas)

| frente | arquivos que toca |
|---|---|
| A — biblioteca de mapas | `lib/mapFileIO.ts` + teste, `screens/LoadMapScreen.tsx` |
| B — bug de seleção de sala | `pixi/drawRegions.ts` + `pixi/drawRegions.test.ts` |
| C — modelo de seleção | **novo** `lib/selectionModel.ts` + teste (conjunto canônico `{kind,id}[]`, união/toggle/remoção), **sem** ligar em nada ainda |
| D — camadas | `lib/layers.ts` + teste, `components/LayersPanel.tsx` (lock de camada + expor `setPropLayer`, hoje capacidade morta) |

**Integrador 4**: migra `selection`/`areaSelection` para `lib/selectionModel.ts` em `stores/mapStore.ts`, `lib/selectionHitTest.ts`, `lib/areaSelection.ts`, `pixi/PixiCanvas.tsx:1034-1114`, `components/PropertiesPanel.tsx`. **Esta é a única migração de contrato do plano — faça-a sozinha, depois de tudo verde.**

---

## 4. O QUE NÃO FAZER (com o motivo escrito)

- **Balde de tinta** (D3, G) — exige detecção de área fechada sobre uma cena de paredes/regiões/desenhos que não é um bitmap. Semanas de trabalho para uma tarefa que Região + Sala já resolvem. **Já foi cortado uma vez; continue cortado.**
- **Rotação por alça no canvas** (D2, G) — cria um novo `mode`, novo hit-test, nova matemática por `kind`, e invalida bounding-box/resize existentes. `ItemTransformControls.tsx` já rotaciona por campo numérico, e em mesa se gira token em passos de 90°, não em ângulo livre. Se algo, adicione botões ±90°, não uma alça.
- **Minimapa** (D1, G) — exige um segundo pipeline de render simplificado. O item #9 (enquadrar tudo) resolve 90% do "estou perdido" por 5% do custo.
- **Biblioteca de assets reutilizável entre mapas** (D6, G) e **múltiplos mapas/andares na mesma cena** (D6, G) — são **features de produto**, não refino de sensação; a segunda muda `types/map.ts`, ou seja, o schema persistido. Fora deste plano por definição de escopo.
- **Transições/animações no canvas** (D5, G) — o app não tem biblioteca de tween, todo redesenho é `Graphics.clear()` síncrono, e **7 specs e2e comparam pixels**: animar o canvas transforma testes determinísticos em testes com corrida. Animação no canvas é o pior retorno da lista inteira. (Micro-transição em DOM já existe em `main.css` e basta.)
- **Auto-pan ao arrastar até a borda** (D1, M) — exigiria mexer em **todos** os ~15 modos `dragging-*`/`resizing-*` de uma vez, dentro do arquivo mais disputado do projeto, para um caso resolvido por Espaço+arrastar (#8) e zoom-out.
- **Ferramenta voltar automaticamente para "Selecionar"** (D3) — ver C1. Custa um clique a mais por objeto num editor cujo fluxo é repetição.
- **Reordenar camadas** (D6, G) — muda ordem de render de tudo; ganho pequeno num app com camadas fixas semânticas. Lock (barato) fica; reorder sai.
- **Conta-gotas e edição de vértice individual em polígono/freehand** (D3) — corretos, baratos, e **não têm relação com "travado"**. Vão para o ROADMAP, não para este plano.
- **Painel dedicado de atalhos (`Ctrl+Shift+?`)** (D4) — o item #6 (letra no tooltip) entrega a descoberta por ~1/10 do custo. Reavalie só depois que o conjunto de atalhos estabilizar.
- **Ampliar a faixa de zoom para além de 10%–400%** (D1) — só amplia o espaço em que o usuário pode se perder enquanto o item #9 não existir. Reavalie depois da Onda 1, com dado.
- **Estado vazio / onboarding** (D5) — o problema não é não saber por onde começar; é o canvas não responder. Refazer isso agora seria maquiar o sintoma errado.

---

## 5. RISCO DE REGRESSÃO (830 unit / 109 e2e)

Ordenado do mais perigoso para o menos. Escreva o teste **antes** da mudança, em todos os casos.

1. **#24 modelo de seleção (Onda 4) — de longe o maior risco.** Atinge `lib/selectionHitTest.test.ts` (18KB), `lib/areaSelection.test.ts` (13KB), `stores/mapStore.test.ts` (76KB), e os e2e `task4-select-delete.spec.ts`, `task4-selection-pixel-diff.spec.ts`, `task-room-tool.spec.ts`.
 **Antes:** teste de caracterização em `stores/mapStore.test.ts` provando o contrato atual para os 7 `kind` (`setSelection` **substitui**; `removeSelected` apaga o certo; `areaSelection` continua independente). Depois migre com o contrato antigo preservado por adaptador.
2. **#3/#4 granularidade do undo — risco alto e não óbvio.** `stores/mapStore.test.ts` tem 76KB e quase certamente afirma efeito de `moveToken`/`moveWall` **e** contagem de histórico. Trocar por `*Live` muda semântica de todas essas chamadas.
 **Antes:** `stores/dragHistory.test.ts` (frente F da Onda 1) — vermelho primeiro: N chamadas `*Live` + 1 `commitDragHistory` = `past.length + 1`; e um teste garantindo que `commitDragHistory` sem `*Live` anterior **não** empurra snapshot vazio.
3. **#15 hover — quebra pixel-diff.** `task4-selection-pixel-diff.spec.ts` e os outros 6 specs com screenshot comparam frames; se o ponteiro parar sobre um objeto, o anel de hover contamina o diff de forma intermitente (flake, não falha limpa — pior).
 **Antes:** ajuste `client/e2e/helpers/enterEditor.ts` para mover o ponteiro para fora do canvas antes de cada screenshot, **ou** exponha um flag de teste que desliga o hover. Rode os 7 specs 3× seguidas para provar estabilidade.
4. **#5 atalhos por letra — risco de corromper entrada de texto.** Digitar o nome de um token/rótulo com a letra `v`/`r`/`e` trocaria a ferramenta. Já existe precedente no código: o guard de `Delete` em `PixiCanvas.tsx:2052` checa `INPUT/TEXTAREA/SELECT`.
 **Antes:** em `lib/keymap.test.ts`, um caso por atalho provando `resolveShortcut` → `null` quando `targetIsEditable`; e um e2e curto em `task-text-label.spec.ts` digitando "wave" dentro do campo de texto e afirmando que `activeTool` não mudou.
5. **#13 duplicar — aliasing de estrutura.** Clonar por spread raso compartilha os arrays de pontos de `region`/`curve`/`polygon`/`freehand`: mover a cópia moveria o original.
 **Antes:** em `lib/entityClone.test.ts`, para cada `kind` com pontos: clonar, mutar o clone, afirmar que o original não mudou; e afirmar `clone.id !== original.id`.
6. **#9 fit de câmera — matemática degenerada.** Mapa vazio (bounds nulo), mapa de um único ponto (largura 0 → divisão por zero → `NaN` na câmera → canvas branco irrecuperável).
 **Antes:** em `pixi/world.test.ts`, casos: mapa vazio devolve `{0,0,1}`; bounds degenerado não produz `NaN`; escala resultante respeita `clampScale`. Este é o único item do plano que pode deixar o app **inusável** se falhar.
7. **#2 roda = pan — risco baixo, confirmado.** `grep -rn "wheel|deltaY" client/e2e` não retorna nenhum uso: nenhum e2e depende de zoom por roda. `zoomAt` em si não muda, então `pixi/world.test.ts:26-44` continua válido. Só garanta em `pixi/wheelGesture.test.ts` que `deltaMode` 1/2 (linha/página) é normalizado — senão o pan fica 15× rápido demais em alguns mouses.
8. **#8 Espaço+arrastar** — `task-middle-button-pan.spec.ts` afirma que o botão do meio pana; o novo caminho não pode roubar essa precedência (`event.button === 1` continua sendo o primeiro `if`, em `PixiCanvas.tsx:656`). Adicione um caso irmão no mesmo spec para Espaço.
9. **#11 autosave** — nunca escreva em disco durante a suíte: o autosave precisa nascer desligado por padrão sob teste, senão os e2e passam a gerar arquivos em `maps/`. Verifique com um teste que afirma zero chamada de gravação sem ação explícita.

**Portão fixo de fim de onda** (todo integrador, sem exceção): `cd C:\dev\labirinto\client && rtk proxy npx tsc --noEmit` e a suíte unitária inteira, depois os 7 specs de pixel-diff rodados 3× para pegar flake.