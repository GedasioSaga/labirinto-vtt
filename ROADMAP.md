# Labirinto — Programa de ferramentas do Dungeon Map

Estado durável deste programa de trabalho. Sobrevive a `/clear`. Atualizado a cada fase
concluída. **Só termina quando todos os itens abaixo estiverem `[x]` ou explicitamente
marcados como adiados com motivo.**

Fontes de escopo:
- `Ferramentas.txt` (OneDrive `Projeto Labirinto/`) — ferramentas do editor
- `https://docs.owlbear.rodeo/` — paridade de VTT
- `arquitetura_vtt_rpg.txt` seção 19 — fases do próprio plano do usuário

## Regra de ouro deste programa

Nenhuma fase fecha sem os quatro:

```
npm run typecheck        # na RAIZ — roda tsc do src E de tsconfig.e2e.json. Os dois.
npm run test             # vitest
cd client && npx playwright test
```
mais **verificação visual no browser** (ver dívida D5 — o gate não pega feature inalcançável).

> **Erro cometido nas fases 0 a 3:** rodei só `rtk proxy npx tsc --noEmit`, que cobre apenas o
> `tsconfig` do `src`. O gate do projeto tem **dois** `tsc`, e o do `e2e` ficou **vermelho desde a
> Fase 1** sem ninguém ver — `Token.image` virou obrigatório e 6 chamadas de `addToken` em specs
> antigos ficaram sem o campo. Playwright não acusa porque transpila sem checar tipo.
> Corrigido ao fim da F3. **Sempre `npm run typecheck` na raiz, nunca só o `tsc` do src.**

Baseline no início do programa: **vitest 373/0, playwright 87/0**, commit `d5e5ad1`.
Estado ao fim da F3: **typecheck exit 0 (os dois), vitest 604/0, playwright 105/0**.

---

## Trilha B — Ferramentas.txt (editor de Dungeon Map)

### Fundação
- [ ] Sistema de camadas (Grid, Paredes, Salas, Portas, Escadas, Objetos, Decoração, Iluminação, Tokens, Anotações)
- [ ] Campos transversais de item: rotação, travar, ocultar
- [ ] Migração de schema sem quebrar `map.json` existente

### Salas
- [ ] Criar por clique+arraste
- [ ] Redimensionar pelos cantos
- [ ] Dividir sala
- [ ] Unir duas salas
- [ ] Definir largura/altura por campo
- [ ] Copiar/colar sala

### Paredes
- [ ] Horizontal / vertical (restrição de eixo)
- [ ] Diagonal
- [ ] Curva
- [ ] Interna vs externa
- [ ] Parede automática
- [ ] Snap de parede à grade

### Portas
- [ ] Normal / destrancada / trancada
- [ ] Dupla
- [ ] Secreta
- [ ] Portão
- [ ] Entrada/saída (liga a outro mapa)
- [ ] Automática

### Escadas
- [ ] Cima / baixo
- [ ] Dupla / longa / em L
- [ ] Elevador / buraco / alçapão

### Corredores
- [ ] Horizontal / vertical / diagonal
- [ ] Em L / em T / cruzamento

### Formas e pintura
- [ ] Retângulo / quadrado / triângulo / trapézio / elipse
- [ ] Balde (preencher área)
- [ ] Preenchimento: cor, transparência, sombra

### Grid
- [ ] Grid triangular
- [ ] Tamanho de célula ajustável na UI
- [ ] Snap de objeto (além do de token, que já existe)

### Iluminação
- [ ] Tocha / ambiente / colorida / raio
- [ ] Área escura
- [ ] Cone de visão

### Medidas
- [ ] Medir distância
- [ ] Medir área / quantidade de quadrados
- [ ] Distância entre objetos / alcance

---

## Trilha A — Paridade Owlbear Rodeo

- [ ] Token com imagem (hoje é círculo + nome)
- [ ] Manipular item: rotacionar, travar, ocultar do jogador, duplicar, trocar imagem
- [ ] Névoa de guerra: desenhar, cortar, revelar, prévia do jogador
- [ ] Medição estilo VTT: Chessboard, diagonal alternada, euclidiana, Manhattan, hex; escala em ft/m
- [ ] Alinhar grade à imagem de fundo (linhas/colunas, detecção por nome, réguas)
- [ ] Biblioteca de assets reutilizável entre mapas (pastas, coleções, tags, busca)
- [ ] Permissões mestre/jogador
- [ ] Sala, código, convite, sala de espera
- [ ] Sincronização em tempo real (WebSocket)
- [ ] Chat
- [ ] Rolagem de dados (`/roll 2d6+4`)
- [ ] Transmissão (segundo monitor / Chromecast) — **provável adiar**
- [ ] Extensões (manifest + SDK) — **provável adiar**

---

## Plano de fases aprovado

Detalhe completo em **`docs/PLANO-FASES.md`** (schema final, migração, partição de arquivo por
agente, riscos de regressão). Resumo:

| Fase | Conteúdo | Estado |
|---|---|---|
| **F0** | schema final + migração + fixture de mapa legado + registro de ferramentas | **concluída** ✅ |
| **F1** | camadas, token com imagem, formas+alpha, grid/snap, luz editável, parede interna/externa | **concluída** ✅ |
| **F2** | portas com tipo, escada reta, sala com identidade/resize, medição + escala | **concluída** ✅ |
| **F3** | dívida (sala inalcançável, barra estourando, e2e) + rotação/travar/ocultar + alinhar grade + grid triangular | em execução |
| **F4+** | névoa/raycast, corredores, dividir/unir sala, biblioteca de assets, rede/sala/chat/dados | fila |

## Fase 4 — feedback do usuário no app rodando (31/08/2026)

Usuário abriu o app e usou de verdade. O que pediu, textual:

### Features — estado após F4 + F5
| # | Pedido | Estado |
|---|---|---|
| N1 | **Setinha em cada ferramenta** abrindo variantes | ✅ **9 setinhas**: Parede, Porta, Região, Sala, Sala Circular, Polígono Regular, Escada (P/M/G), Pincel (caneta/lápis/marcador), Borracha (objeto inteiro / só uma parte). Verificado no browser: clicar grava a preferência (`drawTexture:"pencil"`, `stairSizePreset:"large"`). Linha ficou **de fora da setinha** de propósito — fundir os botões Linha e Curva exige mexer em `TOOL_GROUPS` e é decisão de produto em aberto; a capacidade está no painel. |
| N2 | **Painel muda conforme a ferramenta** | ✅ Medido: era **2236px sempre**. Agora Parede 229px, Escada 139px, Linha 431px, Medir 523px. "Ponta da linha" (arredondada/reta/quadrada) e "Formato da linha" (reta/curva) existem. |
| N3 | **Ferramenta de seleção de área** | ✅ Entregue na F4 (`lib/areaSelection.ts`, marquee, mover conjunto). |

### Bugs — todos resolvidos
| # | Sintoma | Causa raiz encontrada | Estado |
|---|---|---|---|
| B1 | Canto de região retangular não fecha | **Não era a região** — são as 4 paredes que a Sala gera, e `drawWalls` risca cada uma como `stroke()` independente, sem path compartilhado: não existe *join* no vértice | ✅ |
| B2 | Não consegue dobrar a linha / ponta arredondada | Duas coisas: `lineCap` existia hardcoded sem UI; e converter `line`→`curve` não existia como capacidade | ✅ ambas |
| B3 | Não move nem redimensiona o retângulo | `rect`/`ellipse`/`polygon` **não tinham hit-test nenhum** (`selectionHitTest.ts:128`, comentário "de propósito (Fase 1)"). Escada tinha `moveStair` na store que **nenhum gesto chamava**. Token/Peça sem resize | ✅ |

**Nota sobre B3, para não repetir o erro:** clicar no **miolo** de um retângulo sem preenchimento
continua não selecionando — e isso é correto, não bug. Seleciona pela **borda ou canto**; com
preenchimento, o miolo também. Meu primeiro teste falhou por isso e eu quase reportei errado.

## Refinamento — benchmark contra Figma, Excalidraw, Paint e Owlbear (31/08/2026)

Usuário: *"parece tudo tão travado e estranho"*. Seis análises comparativas + síntese em Opus.
Plano completo: **`docs/PLANO-REFINAMENTO.md`** (24 itens priorizados, 4 ondas, o que não fazer).

**Diagnóstico, uma frase:** o canvas **não fecha o laço de feedback com o ponteiro** — nada é
confirmado antes do clique (cursor em `default` para 22 ferramentas, zero hover), nada durante o
gesto (sem número ao vivo em 6 das 8 ferramentas), nada depois (undo desfaz um fiapo do arrasto,
erro some em silêncio). Travado é **ausência de resposta**, não lentidão.

**Três medições que doem:**
- 40 `pointermove` = **40 entradas de undo** — o Ctrl+Z não anda
- Câmera nasce em `{0,0,1}` **sempre** — abrir mapa salvo mostra um recorte arbitrário, sem "enquadrar tudo"
- **Zero handler de fechamento, zero autosave** — perda de dado real, não estética

**Regra de arquitetura que destrava o paralelismo:** `PixiCanvas.tsx` tem a máquina de gesto
inteira (34 modos) numa closure só, não é fatiável. Então **nenhuma frente edita esse arquivo** —
cada uma entrega módulo puro `(estado) → decisão` com teste, e um integrador por onda faz a
chamada de uma linha.

| Onda | Tema | Estado |
|---|---|---|
| 1 | o ponteiro passa a responder (cursor, roda=pan, undo por gesto, atalhos, espaço+pan, enquadrar, HUD) | ✅ |
| 2 | o app fala quando algo acontece (toast, hover, número ao vivo, não perder trabalho, Shift trava proporção) | ✅ |
| 3 | manipular sem medo (duplicar, Shift/Alt no resize, alça de círculo, guias, histórico podado, moldura) | ✅ |
| 4 | fluxo + o refactor estrutural (biblioteca de mapas, camadas com trava, **seleção múltipla unificada**) | ✅ |

**As 4 ondas fecharam.** Contagem de teste ao longo do refinamento: vitest **870 → 1332**,
playwright 111 estável, typecheck (os dois `tsc`) sempre exit 0.

### O refactor estrutural deu certo
`selection: Selection | null` + `areaSelection: AreaSelection | null` viraram **um** `SelectionSet`.
Ganho entregue: **Shift+clique** soma item a item, e mover/apagar/duplicar valem para o conjunto
inteiro numa única entrada de undo. `selectionHitTest.ts` e `areaSelection.ts` não precisaram de
nenhuma mudança de assinatura — o modelo canônico foi desenhado para isso.

### Dois achados que valem memória

**1. Camada travada era o 6º caso de "pronta e inalcançável".** `lib/layers.ts` e a store já
sabiam travar, mas `hitTestMap` em `PixiCanvas.tsx` nunca consultava `lockedLayers` — só filtrava
`hidden` por item. O integrador da Onda 4 achou e fechou.

**2. Baseline medida com processo pendurado mente.** O integrador da Onda 4 mediu playwright com
um `npm run dev` e scripts de debug dele mesmo rodando em paralelo, obteve 6/111 e chegou a
escrever um relatório atribuindo a falha a "ambiente sandboxed sem GPU". Matou os próprios
processos, rodou de novo: **111/111**. Regra: nunca medir baseline com servidor ou browser de
debug pendurado.

## Dívida aberta (decidida, não esquecida)

| # | Dívida | Decisão |
|---|---|---|
| D1 | `buildRoomFromDraft` nunca seta `region.room` → toda sala nasce como região comum e `RoomControls` nunca aparece. Feature do B3 está pronta e testada, mas **inalcançável pela barra**. | Ferramenta Sala (retângulo) passa a criar `room.shape='rect'` com resize por canto. Sala Circular e Polígono Regular ficam `shape='polygon'`, mantendo vértice livre. Os 2 specs de `task-room-tool.spec.ts` que testam vértice livre em sala retangular **serão atualizados** — descrevem o comportamento pré-entidade-Sala. |
| D2 | Barra de ferramentas: 20 botões ≈ 848px numa área central de 688px. Já estourava na F1 (~40px), agora ~80px por lado. | Corrigir na F3 (agrupamento/scroll/wrap). |
| D3 | Playwright parado em **87 há quatro fases**. Testes unitários foram 373 → 604, mas nenhuma ferramenta nova tem cobertura de ponta a ponta. | Agente da F3 morreu por erro de conexão sem entregar. **Reprocessado** após a F3. |
| D5 | **Padrão recorrente: feature pronta e inalcançável.** Já aconteceu 3×: Sala (fábrica não marcava `room`), grid triangular (renderizava mas não estava no seletor), e o próprio `RoomControls`. O gate verde (`tsc`+`vitest`+`playwright`) **não detecta** isso — o código existe, compila e tem teste unitário; só não há caminho de UI até ele. | Toda fase daqui pra frente termina com **verificação visual no browser**, não só gate. Foi assim que os 3 casos apareceram. |
| D4 | `roomOps.ts:125` — `i as RoomCorner` dentro de `findRoomCornerAt`. Seguro hoje (`for` com `4` hardcoded), mas se `points.length` virar dinâmico o compilador não acusa e o canto oposto é lido errado em silêncio. | Anotado. Trocar por guarda explícita quando alguém tocar no arquivo. |

**Formato de cada fase:** fan-out de N agentes em arquivos disjuntos → fan-in de 2 integradores
sequenciais. Os 5 arquivos de alto risco (`stores/mapStore.ts`, `lib/mapFactory.ts`,
`pixi/PixiCanvas.tsx`, `App.tsx`, `main.css`) **só** são tocados por integrador, nunca por agente
de feature — é o que impede colisão de escrita.

**Gate ao fim de cada fase:** `rtk proxy npx tsc --noEmit` + `npx vitest run` + `npx playwright test`,
os três verdes, mais a fixture de mapa legado passando.

## Adiado nesta rodada (com motivo, não esquecimento)

Névoa com raycast (único item genuinamente grande; `blocksLight` não tem consumidor hoje),
biblioteca de assets (exige consertar `mapExport.ts` antes, senão vira regressão de peça
quebrada), corredores como entidade, dividir/unir/copiar sala, parede curva, grid triangular e
isométrico, régua permanente, rotação/lock/hidden, portas secreta e automática, balde e sombra,
escada em L e dupla.

Elevador, alçapão e buraco **já funcionam** via `Prop` + `linkedMapPath` — zero linha de código.

## Fases executadas

### Design — concluído
Workflow `labirinto-design-fase1`: 12 especificações de área em paralelo (Sonnet@high) +
síntese em Opus@high. 13 agentes, 0 erro, 1.4M tokens de subagente. Saída: `docs/PLANO-FASES.md`.

### F0 — Fundação — concluída
Workflow `labirinto-f0-fundacao` (2× Sonnet@high) + 1 agente de fechamento.

**Entregue:**
- `types/map.ts` (233 linhas): `LayerId` (9 camadas), `Wall.wallKind?`, `DoorState.kind`,
  `Region.room?: RoomMeta`, `Token.image`, `Prop.layer?`, kinds `rect`/`ellipse`/`polygon` com
  `fillAlpha`, entidade `Stair`, `GridSettings`, `MapScale`, `MeasurementMode`
- `lib/mapFile.ts`: migração por default de campo, sem versionamento
- **`lib/__fixtures__/legacy-map.json`** — cópia byte-a-byte de `maps/L1.json` (mapa real)
- **`lib/mapFile.legacy.test.ts`** — 13 testes, incluindo idempotência de
  `serializeMap(deserializeMap(x))`
- 6 ferramentas registradas (`stair`, `token`, `ellipse`, `rect`, `polygon`, `measure`) com ícone
  e rótulo, **ausentes de `TOOL_GROUPS` de propósito** — invisíveis na barra até o integrador ligar

**Evidência:** teste da fixture escrito ANTES do schema, rodado, **8 de 13 falhando**; depois do
schema, 13/13. Gate final verificado no main thread: `tsc` exit 0, vitest **389/0** (era 373),
playwright **87/0**.

**Lição registrada:** tornar campo obrigatório teve raio de 20 erros em 12 arquivos; o plano
previa 7. Não foi erro de arquitetura — foi o compilador varrendo consumidores, que é o efeito
desejado. Mas a próxima fase que tornar campo obrigatório deve orçar uma etapa de integração
explícita para isso, em vez de descobrir com o gate vermelho.

### F1 — Camadas e valor visual — concluída
Workflow `labirinto-f1-camadas-e-valor-visual` (8× Sonnet@high): 6 features em paralelo +
I1 (store) + I2 (canvas/UI).

**Entregue e ligado na UI:**
- Sistema de 9 camadas com painel de visibilidade (`lib/layers.ts`, `components/LayersPanel.tsx`);
  camada derivada do tipo, override só em `Prop`
- **Token com imagem** (`pixi/tokensRenderer.ts`, `components/TokenImageControls.tsx`)
- Formas `rect`/`ellipse`/`polygon` + opacidade de preenchimento — barra foi de 15 para 18 botões
- Grid com cor/opacidade/espessura/estilo de linha; **snap por alvo** (token no centro da célula,
  parede e objeto em vértice); **Alt inverte o snap** no gesto
- Luz editável: cor, intensidade, raio arrastável por alça
- Parede interior/exterior (visual apenas, não afeta `blocksLight`/`blocksMove`)

**Gate verificado no main thread:** `tsc` exit 0, vitest **457/0** (era 389), playwright **87/0**.

**Achados que o plano não previu:**
- `applySnap` tinha **33 call sites**, não 6. A mitigação do plano (parâmetros obrigatórios, sem
  default) funcionou: o `tsc` listou os 33 sozinho.
- 4 bugs reais corrigidos, **2 deles invisíveis ao `tsc`** e achados só rodando e2e: entidade
  criada por `page.evaluate` chega sem os campos novos (`undefined`), e `undefined !== null` é
  `true` — derrubava a página. Regra que ficou: checar veracidade, não comparar com `null`, quando
  o dado pode vir de fora do type-checker.
- `.lb-switch` sem `position: relative` — bug latente desde sempre, só apareceu quando os painéis
  novos empurraram o primeiro toggle abaixo da dobra.

**Mudança de comportamento a comunicar:** snap de token agora gruda no **centro** da célula, não
no canto. Token já posicionado em mapa salvo pula meio quadrado no primeiro arrasto. Não corrompe
arquivo.

## Programa "Objetivo → Tentativa" (13/09/2026)

Pedido do usuário: recriar "frame por frame", **com as ferramentas do editor**, os 3 mapas de
`Objetivo/` em `Tentativa/`; depois deixar jogável multiplayer. Plano:
`~/.claude/plans/valiant-enchanting-patterson.md`. Estado vivo e evidência: `HANDOFF.md`.

| Etapa | Conteúdo | Estado |
|---|---|---|
| 1 | Chão por peças (SDF: rect/elipse/polígono/corredor/poly, somar/subtrair, arredondar, irregular, engordar) + UI + "Chão a partir da imagem" | ✅ silhueta IoU ≥ 0,99 nos 3 |
| 2 | Linhas cinzas/pontilhadas, portas, moldura com título (`MapData.lines/markers/frame`) | ✅ entidades + render; fidelidade em curso |
| 2b | Fidelidade de pixel: rasterizador com cobertura, contorno subpixel, largura medida/calibrada por mapa, detalhes escuros (escada, glifos, poço) | em curso — cor por pixel 98,2% / 95,0% / 94,1% |
| 3 | Laço livre como peça | fila |
| 4 | Render fiel (`minimapRaster`) ligado no editor | fila |
| 5 | Jogável multiplayer | fila |

**Achados que valem memória:**
- Borda de pixel dura tem teto: 86–89% dos erros de cor eram pixels antisserrilhados do objetivo.
- A largura do traço **muda por mapa** (0,70 px no mapa2, ~1,4–1,7 px no Mapa3): parâmetro fixo
  não serve; a ferramenta mede ou calibra na própria imagem de entrada.
- Tolerância 0,75 na simplificação entortava lado reto (chanfro do marching squares); padrão 0,3.
- Harness em servidor Vite próprio (porta 1422, sem HMR): com HMR, edição durante a medição
  recarregava a página ("Execution context was destroyed").

## Já entregue antes deste programa
- Menu inicial hierárquico, Carregar Mapa, Opções (commit `d5e5ad1`, branch `feat/menu-inicial`)
