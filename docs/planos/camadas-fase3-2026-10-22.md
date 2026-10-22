# Fase 3: sistema de camadas

## Contexto

Pedido literal de 15/10/2026 (`PEDIDOS.md:1688`): "o sistema de camadas perfeito para ser possível controlar tudo". Hoje existem dois sistemas separados: 9 camadas fixas por tipo (só olho e cadeado, `lib/layers.ts`, `LayersPanel.tsx`) e as "Camadas do chão" por peça (`FloorLayersList.tsx`). Não há opacidade, nem ordem editável, nem "esconder dos jogadores" por camada, nem camada livre. A ordem de desenho é fixa pela ordem de `addChild` (`pixi/PixiCanvas.tsx:1257-1330`, `player/PlayerView.tsx:3055-3138`).

Resultado esperado: lista única na página Cena do livro do mestre, com 13 camadas padrão mais camadas livres, cada uma com dois olhos (Mestre vê, Jogadores veem), cadeado, opacidade, nome e posição; qualquer objeto em qualquer camada; mapa antigo abre idêntico, pixel por pixel.

## Decisões do usuário (22/10 e hoje; não reabrir)

- Dois olhos independentes; cadeado; opacidade UMA só para mestre e jogadores; a lista manda na ordem; atribuição POR ENTIDADE.
- Lista padrão de 13, de baixo para cima na ordem de hoje: Chão, Salas, Desenhos, Terreno, Paredes, Portas, Escadas, Objetos, Decoração, Iluminação, Tokens, Anotações, Telhados. Desenhos = os da ferramenta Desenho (hoje sob as paredes); Anotações = pinos, texto e caminho (hoje acima das fichas).
- Chão: as camadas de pincel ficam ANINHADAS dentro da linha Chão, com os controles de hoje.
- Camadas livres: modelo compartilhado na aventura (nomes e ordem), estado POR CENA; nascem visíveis para todos, 100%, destravadas; apagar com itens devolve os itens à camada padrão do tipo, com aviso "N itens voltaram", e o Ctrl+Z desfaz tudo.
- Fixos fora da lista: névoa, grade, zonas ocultas e ferramentas de edição (seleção, alças, guias, hover, régua, sinais, laser).
- Pinceladas de textura, riscos de penhasco, relevo e nuvens ficam presos em Terreno (sem camada por item), para a borracha continuar igual.
- Mover uma camada na lista a transforma num bloco inteiro na nova altura; sem mexer na ordem o mapa é idêntico ao de hoje.
- Telhados: o olho do mestre da camada substitui o botão "Telhados"; "Transparente" fica como atalho só do mestre, de sessão, não salvo.
- Mover item: seletor "Camada" na ficha + "Mover para camada" no clique direito (vários itens) + arrastar na lista de objetos. Tudo entra no Ctrl+Z.

## Modelo de dados (`types/map.ts`)

- `LayerId` continua com os 9 de hoje (não quebra `Record<LayerId,…>` nem os 64 testes). Novos: `CamadaPadraoId = LayerId | 'chao' | 'terreno' | 'desenhos' | 'telhados'`; `CamadaLivreId = livre_<id aleatório>` (nunca derivado do nome); `CamadaId` = união.
- `CamadaDef { id; nome? }`, `ModeloDeCamadas { ordem: CamadaDef[] }` (de baixo para cima). Na aventura (`lib/adventure.ts`): `camadas?: ModeloDeCamadas`; ausente = as 13 padrão; `ADVENTURE_VERSION` não muda.
- Estado por cena (no `MapData`): `hiddenLayers` passa a ser "Mestre vê" desligado; `lockedLayers` = cadeado; novos opcionais `ocultasDoJogador?` (ausente = igual a `hiddenLayers`, assim "oculta" antiga continua sumindo para todos), `opacidadeDasCamadas?` (ausente = 1), `versaoDasCamadas?: 2` (ausente liga as implicações antigas: Chão segue Salas, Desenhos segue Anotações). `modeloCamadas?` é cópia em memória para o Ctrl+Z; `serializeMap` o tira e o recorte do jogador nunca o leva.
- Por entidade: campo opcional `camada?: CamadaId` junto de `NoPiso` em Wall, Door, Stair, Region, FloorPiece, MapLine, MapMarker, Prop (`camada ?? layer ?? 'objetos'`), Token, Pin, Light, Drawing, carimbo e `RoomMeta.camadaDoTelhado`. Padrão sem o campo: Wall=paredes/portas, Region=salas, FloorPiece=chao, Stair=escadas, Token=tokens, Pin=anotacoes, Light=iluminacao, Drawing text/path=anotacoes e o resto=desenhos, carimbo=terreno, telhado=telhados.
- Leitura (`lib/mapFile.ts` ~858-861): uma linha por campo novo no padrão `...(x === undefined ? {} : {x: ler(x)})`; torto é descartado. Camada livre inexistente cai na camada padrão do tipo (na cena ativa a correção entra no `withHistory`; nas outras, ao ativar a cena).

## Ordem e render

- Constantes `FAIXAS_EDITOR` (copia `PixiCanvas.tsx:1257-1314`) e `FAIXAS_JOGADOR` (copia `PlayerView.tsx:3055-3138`). Função pura `ordemDeRender(lista, faixas)` em `lib/camadas/ordem.ts`: camadas padrão que seguem a ordem padrão mantêm suas faixas de hoje; camada movida ou livre vira bloco contínuo acima da faixa mais alta da camada logo abaixo dela. Com a lista padrão o resultado é idêntico a hoje.
- Render: Container por (faixa, camada), criado só quando há itens, montado por `montarPilha(world, ordem)` (só quando muda o modelo ou o conjunto de pares não vazios). Opacidade = `alpha` do nó (props: por sprite). `paint*` trocam `visibleX(map.X, hidden)` por partição por camada, com caminho rápido memorizado (sem `camada` em nenhum item, devolve o mesmo array para os portões `Object.is` de `pixi/shapesRedraw.ts`). Chão fora de `chao` ganha segunda instância de `floorRenderer`.
- Jogador: mesma pilha, com duas zonas fixas por tipo: sob a névoa (planta) e sobre a névoa (luz de longe, telhados, `portasNoTelhado`, pílulas, marcas, pinos, fichas). Reordenar só permuta dentro da zona.

## Interação, jogador e rede

- Um ponto só: `lib/camadas/consulta.ts` com `contextoDeCamadas(map)` (memorizado): `camadaDe`, `mestreVe`, `jogadorVe`, `travada`, `alfa`, `ordem`, `podeMexer`. `lib/layers.ts` vira fachada com os mesmos nomes (2º parâmetro aceita array antigo ou `MapData`), mantendo os ~35 importadores e os testes. `toggleLayerVisibility` mantém o sentido antigo (desliga os dois olhos); funções novas para cada olho.
- Bugs corrigidos via `podeMexer`: borracha apaga o item de baixo de camada travada (`PixiCanvas ~4225`); seleção em área e Ctrl+A ignoram `lockedLayers` (`areaSelection.ts:431-465`); pino, linha, marcador, textura e carimbo recusam camada travada com `avisoCamadaTravada`; "9" fixo no resumo de `PaginaCena` (conta por `Object.keys`).
- Host (`lib/fogFilter.ts`): `layerShown` usa `jogadorVe` em todo tipo, INCLUSIVE chão, linhas e marcadores (hoje vazam pela rede, `:3674-3677`). O recorte tira modelo, opacidades, versão e nomes; manda `camadasDoJogador?: {id, alfa?}[]` na ordem da lista só quando algo difere do padrão. `isMapShape` não muda. Protocolo aditivo, versão não muda. A Visão de teste herda tudo.

## Interface (página Cena do livro do mestre)

`LayersPanel` com 13 linhas e as restrições das jornadas seladas: lista "Camadas do mapa", texto do item só nome+contagem (`/^Paredes\s*1$/`), rótulos `Ocultar X`/`Mostrar X` e `Travar X`/`Destravar X` com `aria-pressed`; novos: `Ocultar X dos jogadores`, slider `Opacidade de X` (valor em `aria-valuetext`), subir/descer, alça de arrastar, renomear por duplo clique, "+ Nova camada". `FloorLayersList` aninhada em Chão. `PropLayerControls` vira `SeletorDeCamada` para todo tipo. `mapStore.moverParaCamada(refs, id)` dentro de `withHistory`. Sem atalho novo dentro do painel (jornada `atalho-com-foco-no-painel`). Seguir as skills do Emil (CLAUDE.md §2l).

## Fatias (main, sem worktree, 1 escritor por vez, 1 commit por fatia)

Escritor: `programador-frontend` (opus@xhigh) nas fatias 1 a 5 e 7; `designer-opus` (opus@xhigh) com a lógica de dados do `programador-frontend` nas fatias 6 e 8. Revisão de desempenho depois de cada fatia. Cada fatia roda as 4 jornadas seladas (camada-travada, layers-visibility, atalho-com-foco-no-painel, pincel-balde-caminhos); nenhuma jornada selada é editada.

| # | Fatia | Teste que nasce vermelho (aceite escrito antes) |
|---|---|---|
| 1 | Núcleo puro, nada visível; grava o golden de pixels (4 mapas de fixture, editor e jogador) ANTES de mexer; diagrama `docs/diagrams/pilha-de-camadas.html` + linha no `INDEX.md` | `ordemDeRender(padrão)` = faixas de hoje; contexto ≡ `visible*` antigos numa matriz; round-trip de mapa antigo idêntico; `salas` antiga oculta ⇒ chão oculto |
| 2 | Segurança no host | camada oculta só para jogadores nunca chega (13 padrão e 1 livre); chão, linha e marcador cortados; `isMapShape` aceita mapa sem os campos |
| 3 | Render do editor por faixas | golden idêntico; reordenar muda a pilha; quadro p95 ≤ 20 ms (`ux-driver medir`, antes e depois) |
| 4 | Render do jogador com zonas | golden do jogador idêntico; ordem segue a lista dentro da zona |
| 5 | Trava por um ponto só (pode vir antes da 3) | borracha, seleção em área, Ctrl+A, pino, linha, marcador, textura e carimbo respeitam o cadeado |
| 6 | Painel das 13 camadas | jornadas seladas verdes; e2e novo dos dois olhos e da opacidade |
| 7 | Camadas livres e modelo | criar, renomear, ordenar, apagar ("N itens voltaram"); Ctrl+Z desfaz tudo |
| 8 | Mover item | ficha, menu e arrastar funcionam e desfazem |

Antes da fatia 3: mostrar ao usuário uma imagem de 2 casos de camada movida (bloco inteiro) para ele conferir.

## Verificação (fim da fase)

- `rtk proxy npx tsc --noEmit` (app e `-p tsconfig.e2e.json`), vitest das áreas e vitest completo 1 vez, e2e das áreas tocadas e das 4 jornadas seladas, `ui-onde-foi-parar` 4/4. Suíte e2e inteira só na Fase 4.
- Golden de pixels igual ao de antes da fatia 1 (editor e jogador); p95 ≤ 20 ms medido; mapa antigo e `adventure.json` antigo abrem idênticos (teste de round-trip).
- Segurança: teste de rede com camada "só mestre" provando que nada dela (inclusive chão, linhas, marcadores e nomes) chega ao jogador.
- Registro: uma linha por fatia em `docs/design/consolidado/PROGRESSO.md` e atualização do `docs/diagrams/INDEX.md`. Sem push e sem instalador. Disco do C: conferido antes de cada suíte (parar abaixo de 5 GB).

## Riscos

- Pixel do mapa antigo: golden da fatia 1. Entrelaçamento de camada movida parecer estranho: imagem antes da fatia 3. Partição quebrar os portões de redesenho: mesma referência de array no mapa antigo + p95. Contorno do chão dividido: só com peça fora de `chao`, teste dedicado. Cliente antigo do jogador: vê a ordem padrão; nada vaza porque o corte é no host.
- Custo estimado (incerto): 8 fatias de 25 a 45 M tokens cada, de 200 a 350 M no total, de 3 a 6% da semana pela régua de 39 a 70 M por 1%.

## Não verificado

Detalhes de `layerShown` em `fogFilter.ts` vieram de batedor e de arquiteto, sem leitura direta; a fatia 2 começa relendo. O selo `scripts/portao-selo.json` tem 69 de 100 jornadas divergentes de antes (decisão separada do usuário, não faz parte desta fase).
