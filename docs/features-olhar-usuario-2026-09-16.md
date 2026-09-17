# Features com olhar de usuário — 16/09/2026

Levantamento de features com **dor e endereço**, feito contra o código real (grafo graphify em dia,
`built_at_commit=d456fb99`) e contra o `PEDIDOS.md`/`ROADMAP.md`. Nada foi implementado; nenhum
arquivo do app foi editado.

Fluxo real do usuário que serve de régua para tudo abaixo:
**(1) desenhar rápido um mapa simples estilo Resident Evil/Zelda** e **(2) rodar a sessão com os
amigos entrando pelo celular.**

Produtos de referência usados na comparação: **Foundry VTT, Roll20, Dungeondraft,
Dungeon Alchemist, Owlbear Rodeo, Inkarnate**. Owlbear Rodeo é o alvo de paridade já declarado pelo
próprio projeto (`ROADMAP.md:9`, `ROADMAP.md:96`).

---

## 1. Inventário real — existe e está ACABADO

O `README.md` está **muito desatualizado** (descreve um MVP de parede/luz/região, `README.md:5-62`).
O app real é bem maior que o README admite. O que está acabado:

| Área | Estado | Endereço |
|---|---|---|
| Barra de ferramentas | 22 das 23 `DrawingTool` aparecem; `token` está escondido **de propósito** por decisão de produto | `types/tools.ts:1-24`, `components/labels.ts:126-132`, `lib/features.ts:25` |
| Variantes (setinha) | 10 ferramentas + o cluster "Desenho" (7 formas) | `lib/toolVariants.ts:217-292` |
| Sala | criar, redimensionar por canto e por campo, copiar **com paredes**, sub-sala em cascata | `lib/roomOps.ts:56,76,121`, `lib/entityClone.ts:112,129,142` |
| Chão por peças (SDF) | rect/elipse/polígono/**corredor**/livre, somar/subtrair, arredondar, borda irregular | `lib/floorTool.ts:93`, `lib/floorSdf.ts`, `pixi/drawFloor.ts:52,93` |
| Render fiel (raster) | **já ligado no editor com toggle** — o `ROADMAP.md:296` que diz "fila" está desatualizado | `pixi/PixiCanvas.tsx:827-859`, `components/FloorStyleControls.tsx:117-119` |
| Camadas | 9 camadas, cada uma com ocultar **e** travar | `lib/layers.ts:69,80`, `components/LayersPanel.tsx:34-73` |
| Visão do jogador | **raycast geométrico real** (não amostragem): 1 raio por extremidade + 64 raios de círculo | `lib/visibility.ts:73,194-199` |
| Memória do explorado | bitset por célula de 1/4 de quadrado | `lib/exploration.ts:17,196-227` |
| Raio de visão | slider **por jogador** no painel do mestre, persistido | `components/RoomPanel.tsx:229-238`, `net/hostSession.ts:64-66,147-151` |
| Sessão LAN | código de 6 chars, QR, bind em todos os IPv4 privados | `desktop/src-tauri/src/net/commands.rs:225-266` |
| Painel de jogadores | lista, status, conectado, atribuir/remover token, **expulsar** | `components/RoomPanel.tsx:191-255`, `net/hostSession.ts:345-364` |
| Reconexão | `resumeToken` em `localStorage`; celular que dorme volta sozinho | `player/playerConnection.ts:78,140-160` |
| Laser / sinal | laser mestre→jogador; sinal (ping de mapa) jogador↔mestre | `lib/laser.ts`, `lib/signals.ts`, `net/protocol.ts:63-99` |
| Jogador em jogo | mover token, abrir porta, sinalizar, pan, brilho do explorado, centralizar câmera | `player/PlayerView.tsx:589,820,764`, `player/PlayerPanel.tsx:95,101,149-186` |
| Portal entre mapas | UI completa: novo andar / escolher mapa / entrar / desvincular; broadcast automático | `components/PortalControls.tsx:1-37`, `App.tsx:770-798`, `net/hostBridge.ts:275-284` |
| Undo/redo | por **gesto** (commit ao soltar), cap 50 | `stores/mapStore.ts:670,1168` |
| Biblioteca de mapas | listar, renomear, duplicar, excluir | `screens/LoadMapScreen.tsx:83-121` |
| Medição | 5 modos (chessboard, 5-10-5, euclidiana, manhattan, hex) + escala em unidade real | `lib/measurement.ts:17-23,166-185` |
| Atalhos | letra para cada ferramenta + tooltip mostrando a letra | `lib/keymap.ts:70-98`, `components/Toolbar.tsx:142,159` |
| Colisão de porta | trancada **sempre** bloqueia, mesmo aberta | `lib/collision.ts:31-38` |

Duas correções de registro que este levantamento encontrou:
- `ROADMAP.md:217` diz que `blocksLight` "não tem consumidor hoje" — **falso**: é consumido em
  `lib/visibility.ts:197`.
- `ROADMAP.md:218` sugere que `mapExport.ts` está quebrado — **falso**: as 4 funções estão completas
  e testadas (`lib/mapExport.ts:9-55`); a nota era sobre a feature futura de biblioteca de assets.

## 2. Inventário real — existe PELA METADE

Estas são as fontes do Bloco A. Todas são o padrão que o próprio `ROADMAP.md:204` (dívida D5)
chama de **"feature pronta e inalcançável"**: o código existe, compila e tem teste — só não entrega
valor ao usuário.

| # | Metade que falta | Endereço |
|---|---|---|
| M1 | Foto do token **nunca chega no jogador**: o caminho é local da máquina do mestre, o jogador vê círculo colorido | `player/PlayerView.tsx:173-176`; rota `/media/{id}` existe e **sempre devolve 404** (`desktop/src-tauri/src/net/server.rs:318,617`) |
| M2 | **Sem pinça de zoom no celular**: zoom só por roda do mouse, e `touchAction:'none'` bloqueia o zoom nativo do navegador | `player/PlayerView.tsx:840-847,917` |
| M3 | Luz é 100% decorativa: gradiente que atravessa parede, não afeta visão, **jogador nunca desenha luz** (`grep light` em `player/` = vazio) | `pixi/drawLights.ts:32-96`; `FogState.mode` só tem `'per-token' \| 'none'` (`types/map.ts:465-468`) |
| M4 | Espessura de parede presa a 3 presets (Fina/Média/Grossa); o campo `thickness` aceita valor livre | `components/WallStyleControls.tsx:69` |
| M5 | `locked`/`hidden` existem em 7 tipos, mas UI só em Token e Prop — `ItemTransformControls` tem só 2 call-sites no app inteiro | `types/map.ts:88-96,117-124,214-221,329-340,388-389`; `App.tsx:1205,1219` |
| M6 | Biblioteca de mapas sem miniatura, embora o app já saiba rasterizar o mapa | `lib/mapFileIO.ts:84-95` (`SavedMapEntry` sem campo de imagem) vs `pixi/PixiCanvas.tsx:827-859` |
| M7 | QR usa `urls.first()` de uma lista só ordenada por número de IP — sem distinguir Wi-Fi de VPN, sem seletor | `desktop/src-tauri/src/net/commands.rs:265,447-460` |
| M8 | Régua/medição do mestre é local: não existe mensagem de medição no protocolo | `lib/measurement.ts:1-23`, ausente de `net/protocol.ts` |
| M9 | Sem prévia "ver como jogador": `filterMapForPlayer` só roda no pipeline de rede | `lib/fogFilter.ts:276`, consumido só em `net/hostSession.ts` |
| M10 | Snap desligado por padrão nos 3 alvos, contra o pedido do usuário | `stores/mapStore.ts:751` vs `PEDIDOS.md:78` |
| M11 | Telas do jogador (entrar, aguardando, erro) sem tema: `style` inline, sem as variáveis `--lb-*` | `player/main.tsx:65-109,174-211`, `player/ErrorBoundary.tsx:13-14` |
| M12 | "Salvar como" implementado e testado, **sem nenhum call-site** | `lib/mapFileIO.ts:79` |
| M13 | `Stair.rotation` no schema sem UI; `Stair.shape` aceita `'l'`/`'double'`, UI só produz `'straight'` | `types/map.ts:313,332`, `components/StairControls.tsx:51` |
| M14 | Tamanho do token só pela alça de canto, sem campo numérico | `lib/objectTransform.ts:47-54` |
| M15 | `MapLine`/`MapMarker` sem nenhuma UI de edição | `types/map.ts:419,441` |
| M16 | "Nada selecionado" ainda no painel | `components/SelectionControls.tsx:50` vs `PEDIDOS.md:96` |

## 3. Não existe (confirmado por grep vazio)

Chat, rolagem de dados, iniciativa/ordem de turno, HP/condição no token, balde de flood fill,
pincel de blocos em grade, dividir/unir sala, parede curva, biblioteca de assets/estêncil,
templates de mapa, geração aleatória, exportar PNG, autosave periódico.

---

## BLOCO A — acabamento do que já existe pela metade

Ordenado por ajuda ÷ tamanho. Estes são os melhores negócios do levantamento: a metade que falta é
pequena porque a outra metade já está construída e testada.

| # | Nome curto | Dor (com endereço) | O que o usuário passa a conseguir | Referência | Tamanho + arquivos | Risco de colisão | Fila? |
|---|---|---|---|---|---|---|---|
| **A1** | **Foto do token chega no celular** | `PEDIDOS.md:140` P8b literal: *"No token não dá para trocar a foto da parte azul não?"*. O mestre **já** importa a foto (`components/TokenImageControls.tsx:20-41`), mas `player/PlayerView.tsx:173` diz textualmente: *"Imagem do token é caminho local da máquina do mestre: o jogador vê o círculo"*. A feature está construída e o usuário nunca a vê onde importa. | Cada amigo vê o rosto do próprio personagem no celular, em vez de bolinha azul/vermelha | Owlbear Rodeo (token image), Roll20 ("token avatar"), Foundry VTT ("Prototype Token / Token Image") | **P/M** — `desktop/src-tauri/src/net/server.rs:617` (stub `/media/{id}` já roteado), `net/commands.rs:251-256` (`AssetSource` já serve bytes+mime), `net/protocol.ts` (campo de id em vez de path), `player/PlayerView.tsx:172-177` | **Médio** — `lib/fogFilter.ts:276` monta o snapshot do jogador: o path local **não pode vazar** no `map`; trocar por id opaco é parte do trabalho, não um extra | **Parcial** — fila item 4 tem "P8b foto do token", mas só do lado do mestre; *chegar no jogador* não está escrito em lugar nenhum |
| **A2** | **Pinça de zoom no celular** | Premissa do produto é o jogador entrar pelo navegador do celular, e o zoom existe **só por roda do mouse** (`player/PlayerView.tsx:840-847`), enquanto `touchAction:'none'` (`:917`) desliga o zoom nativo do navegador. No celular, hoje, **não dá para dar zoom** — nem o do app, nem o do browser. | Aproximar o mapa com dois dedos, que é o gesto que todo mundo tenta primeiro num celular | Owlbear Rodeo (mobile é caso de uso central), Roll20 (app móvel) | **P** — `player/PlayerView.tsx` (handlers de pointer: 552, 776, 793, 837-847) | **Médio** — divide os mesmos eventos de `startTokenDrag` (`:589`) e pan (`:783,804`); precisa distinguir 1 dedo de 2 | **NOVA** |
| **A3** | **Espessura livre de parede** | `PEDIDOS.md:129-130` P3 literal: *"isso era para ser uma muralha de castelo mas não consigo engrossar as linhas o quanto eu quiser"*. O campo `thickness` já existe e é livre; a UI oferece só 3 presets (`components/WallStyleControls.tsx:69`). | Muralha de castelo grossa de verdade, na espessura que ele quiser | Dungeondraft (wall thickness), Inkarnate, Foundry (wall width) | **P** — `components/WallStyleControls.tsx:69` (slider ao lado dos presets), `pixi/drawWalls.ts` | **Baixo** — o presets já escrevem no mesmo campo | **SIM** — fila item 3 (`PEDIDOS.md:53`) |
| **A4** | **Travar e ocultar parede, luz, sala, escada, chão** | `ROADMAP.md:204` (dívida D5) nomeia o padrão; os campos existem em 7 tipos (`types/map.ts:88-96,117-124,214-221,329-340,388-389`) mas `ItemTransformControls` tem só **2 call-sites no app inteiro** (`App.tsx:1205,1219`), Token e Prop. Dor concreta do fluxo dele: com salas dentro de salas (`PEDIDOS.md:114`), mover a sala-mãe sem querer é fácil e não há como travá-la. | Travar a planta pronta e desenhar em cima sem estragar; esconder objeto do jogador item a item | Dungeondraft (lock de objeto), Foundry VTT (lock/hide), Inkarnate | **P** — `App.tsx` (ligar o componente que já existe aos outros tipos), `components/PropertiesPanel.tsx` | **Baixo** — `lib/layers.ts:80,93` já trava por camada e é caminho independente; travar por item não conflita | **NOVA** |
| **A5** | **Luz que o jogador vê e que a parede barra** | `PEDIDOS.md:139` P8 literal: *"A iluminação é meio estranha e não funciona"*. Diagnóstico já no `PEDIDOS.md:26-28`: halo decorativo que atravessa parede (`pixi/drawLights.ts:32-96`) e **o jogador nunca desenha luz** (`grep light` em `player/` = vazio). | A tocha que ele coloca aparece no celular do amigo e para na parede | Foundry VTT ("Lighting layer", luz barrada por wall), Owlbear Rodeo (luz por token) | **M** — `pixi/drawLights.ts`, `lib/fogFilter.ts:395` (já envia luz, ninguém usa), `player/PlayerView.tsx` (novo render), `net/protocol.ts` | **Baixo/Médio** — `lib/visibility.ts:194-199` já produz os segmentos que bloqueiam; reusar em vez de recalcular. **Não** transformar em escuridão: o pedido separa "mapa escuro com tocha" para depois (`PEDIDOS.md:49`) | **SIM** — fila item 2c (`PEDIDOS.md:48-49`) |
| **A6** | **QR aponta para o Wi-Fi certo** | `PEDIDOS.md:97` literal: *"QR da sala aponta para o IP da VPN"*. Hoje a UI lista todas as URLs (`components/RoomPanel.tsx:180-189`) mas o QR usa só `urls.first()` (`net/commands.rs:265`) de uma lista ordenada **por valor numérico do IP** (`:447-460`), sem distinguir interface. É a primeira coisa que acontece na sessão: o amigo escaneia e não entra. | Escanear o QR e entrar de primeira, sem o mestre ditar IP no grupo | Foundry VTT (mostra as URLs de convite e deixa escolher), Owlbear Rodeo (link de sala) | **P** — `desktop/src-tauri/src/net/commands.rs:265,447-460`, `components/RoomPanel.tsx:180-189` (escolher qual URL vira QR) | **Baixo** — `bind_all` já escuta em todos os IPs; só muda qual URL é destacada | **SIM** — fila antiga item 8 (`PEDIDOS.md:97`) |

## BLOCO B — feature nova de alto valor

| # | Nome curto | Dor (com endereço) | O que o usuário passa a conseguir | Referência | Tamanho + arquivos | Risco de colisão | Fila? |
|---|---|---|---|---|---|---|---|
| **B1** | **Ver como jogador** | `PEDIDOS.md:131` P4 literal: *"o jogador consegue ver o bloco da esquerda mas não o da direita"*. Ele só descobriu esse bug **indo olhar no celular** — não existe prévia: `filterMapForPlayer` (`lib/fogFilter.ts:276`) é consumido só em `net/hostSession.ts`, nenhuma UI. Cada dúvida sobre névoa hoje custa um teste com amigo de verdade. | Um botão que mostra na própria tela o que cada jogador vê; conferir névoa e segredo antes da sessão, sozinho | Foundry VTT (vision preview / ver como um ator), Owlbear Rodeo (prévia da névoa) | **M** — `App.tsx` (modo de render alternativo), `lib/fogFilter.ts` (reuso puro, sem mudança de assinatura), novo componente de painel | **Médio** — é um segundo consumidor de `fogFilter`; ganho extra é que qualquer bug de névoa passa a ser reproduzível sem rede. **Não** tocar `pixi/PixiCanvas.tsx` além de uma chamada (`ROADMAP.md:166`) | **NOVA** |
| **B2** | **Jogador renomeia o próprio token** | `PEDIDOS.md:141-142` P9 literal: *"Por que como jogador não consigo mudar o nome do meu próprio token?"*. Confirmado: `grep rename` em `player/` = vazio; o protocolo não tem a mensagem (`net/protocol.ts:40-76`). | O amigo escreve o nome do personagem dele no celular, sem ditar para o mestre digitar | Roll20 (jogador edita o próprio token), Owlbear Rodeo | **P** — `net/protocol.ts` (mensagem aditiva, **mesmo padrão já documentado** para `door.toggle` em `:19-34`), `net/hostSession.ts` (validar dono via `ownTokens`), `player/PlayerPanel.tsx` | **Baixo** — `hostSession.ts:345-357` já define dono único por token; a validação é "é seu?" | **SIM** — fila item 4 (`PEDIDOS.md:55-56`) |
| **B3** | **Peça de água/terreno com cor própria** | `PEDIDOS.md:127-128` P2 literal: *"queria a capacidade de fazer uma piscina mas não tem balde de tinta, pense em algo útil"* — ele **pediu explicitamente para pensar em algo útil**, não pelo balde. E `PEDIDOS.md:137-138` P7: *"Se eu quisesse fazer um caminho de terra e outro de pedra ambos com cor diferente..."*. O sistema de chão já tem forma, somar/subtrair e corredor (`lib/floorTool.ts:93`), mas a cor é **uma só para o mapa inteiro** (`components/FloorStyleControls.tsx:35`). | Piscina, caminho de terra e caminho de pedra, cada um com a sua cor, usando as formas que ele já sabe usar | Dungeondraft (terrain/water brush), Inkarnate (paint de terreno), Dungeon Alchemist | **M** — `types/map.ts` (cor por `FloorPiece`), `components/FloorPieceControls.tsx:144`, `pixi/drawFloor.ts:52,93`, `lib/floorSdf.ts` | **Médio** — mexe no schema persistido; migração por default de campo, padrão já usado em `lib/mapFile.ts`. **Colide conceitualmente** com o balde da fila item 5: esta proposta entrega a mesma dor sem o flood fill que já foi cortado 2× (`docs/PLANO-REFINAMENTO.md:112`) | **Reformulada** — a dor está na fila (item 5, P2+P7); **a abordagem é NOVA** |
| **B4** | **Miniatura do mapa na biblioteca** | Ele já tem vários mapas (`maps/`, `Tentativa/` com aa0/aa1/zelda/variantes) e a biblioteca mostra **só texto**: `SavedMapEntry` não tem campo de imagem (`lib/mapFileIO.ts:84-95`), a tela lista nome/dimensão/data (`screens/LoadMapScreen.tsx:83-121`). O app **já sabe** rasterizar o mapa inteiro (`pixi/PixiCanvas.tsx:827-859`). | Reconhecer o castelo pelo desenho em vez de adivinhar por "mapa2" | Dungeon Alchemist e Inkarnate (galeria com thumbnail), Foundry VTT (scene thumbnails) | **M** — `lib/mapFileIO.ts:84-95,106` (campo + geração), `screens/LoadMapScreen.tsx`, reuso de `lib/minimapRaster` | **Baixo** — o rasterizador já existe e está ligado; é um segundo consumidor. Cuidado: gerar miniatura ao salvar, não ao listar, senão a tela fica lenta com N mapas | **NOVA** |
| **B5** | **Régua compartilhada na sessão** | A medição tem 5 modos e escala real (`lib/measurement.ts:17-23,166-185`) mas é **local do mestre**: não há mensagem de medição no protocolo (ausente de `net/protocol.ts`), e `grep measure` em `player/` = vazio. Na mesa, "quantos quadrados até a porta?" é pergunta de jogador, não de mestre. | Mostrar alcance/distância e todos os celulares verem a mesma régua | Foundry VTT (ruler visível para todos), Roll20 (measurement compartilhada) | **M** — `net/protocol.ts` (mensagem aditiva, padrão do `laser`), `net/hostSession.ts`, `player/PlayerView.tsx` | **Baixo** — o `laser` (`lib/laser.ts`) já provou o caminho mestre→jogador com lote de pontos; copiar a forma | **NOVA** |

## BLOCO C — não vale a pena agora

| Ideia | Por que não |
|---|---|
| Ferramenta Token na barra | Escondida **de propósito** por decisão de produto de 15/09/2026 (`lib/features.ts:25`); token se cria pelo painel (`App.tsx:1173`). Não é dívida, é escolha. |
| Chat de texto | LAN na mesma sala: todos se falam em voz alta. Zero pedido no `PEDIDOS.md`. |
| Rolagem de dados | Mesmo motivo; e dado físico na mesa é o padrão de quem joga presencial. |
| Iniciativa / ordem de turno / HP / condição no token | Nenhum pedido, e exigiria um modelo de combate que o app não tem. É virar Foundry, não é o produto dele. |
| Balde de flood fill de verdade | Cortado 2× com motivo escrito (`docs/PLANO-REFINAMENTO.md:112`: a cena não é bitmap). B3 entrega a dor do P2 por uma fração do custo. |
| Exportar PNG do mapa | O jogador vê o mapa ao vivo no celular; export serve a quem usa outro VTT ou imprime — não é o fluxo dele. |
| Autosave periódico | `App.tsx:428-449` já confirma antes de fechar com trabalho não salvo; a perda real de dado está coberta. |
| Biblioteca de assets reutilizável | Já adiada com motivo (`ROADMAP.md:218`) e sem nenhum pedido do usuário. |
| Geração aleatória de mapa | O valor dos mapas dele é serem autorais (Zelda, castelo); gerador resolve o problema de outra pessoa. |
| Escada em L / dupla | O schema aceita (`types/map.ts:313`), mas o pedido real do P5 é *"leva ao andar"*, já resolvido por `Prop` + portal (`components/PortalControls.tsx`). |
| "Salvar como" (`lib/mapFileIO.ts:79`) | A biblioteca já renomeia e duplica; o fluxo `persistMap` cobre o caso real. Código morto, não feature faltando. |
| UI para `MapLine`/`MapMarker` | São entidades do programa Objetivo→Tentativa (fidelidade de pixel), não do fluxo de mesa. |
| Reordenar camadas, rotação por alça, minimapa, auto-pan | Todos cortados com motivo escrito em `docs/PLANO-REFINAMENTO.md:110-126`. Não reabrir sem dado novo. |

---

## Resumo fila vs novo

| Já na fila do `PEDIDOS.md` | Novas |
|---|---|
| A3 (item 3, P3 — `PEDIDOS.md:53`) | A2 pinça de zoom no celular |
| A5 (item 2c — `PEDIDOS.md:48-49`) | A4 travar/ocultar nos outros tipos |
| A6 (fila antiga item 8 — `PEDIDOS.md:97`) | B1 ver como jogador |
| B2 (item 4, P9 — `PEDIDOS.md:55-56`) | B4 miniatura na biblioteca |
| A1 **parcial** (item 4, P8b — só o lado do mestre) | B5 régua compartilhada |
| B3 **dor na fila** (item 5, P2+P7), abordagem nova | |

**O item em andamento (`PEDIDOS.md:9-11`, memória do jogador / item 2b) não foi proposto de novo**:
é o próximo da fila e está em execução.

## Nota de método

Inventário levantado por 8 batedores em paralelo sobre o grafo em dia, um por ângulo (barra,
jogador, névoa/luz, persistência, painel/camadas, sessão LAN, desenho rápido, token/porta/escada).
Toda dor citada tem endereço: citação literal do `PEDIDOS.md` com número de linha, ou `arquivo:linha`.
Nada foi verificado rodando o app — este é um levantamento de código e de pedido, não um teste de
comportamento. As duas correções de registro na seção 1 (`blocksLight` e `mapExport.ts`) merecem
atualização no `ROADMAP.md`, e o `README.md:5-62` descreve um app que não existe mais.
