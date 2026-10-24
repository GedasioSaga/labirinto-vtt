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

## Requisitos herdados da revisão da fatia 1 (22/10/2026)

Achados dos revisores que NÃO cabem na fatia 1 e entram como aceite das fatias seguintes:

- **Fatia 2 (segurança no host):**
  - `lib/fogFilter.ts` ~3630: o recorte do jogador copia o mapa por spread; `modeloCamadas`, `ocultasDoJogador`, `opacidadeDasCamadas` e `versaoDasCamadas` não podem chegar ao jogador sem filtro. Tirar `modeloCamadas` (nomes secretos das camadas livres) e `ocultasDoJogador`, aplicar `jogadorVe`, e mandar só o que a tela do jogador precisa para o alfa. Teste de vazamento em `visaoDeTeste.vazamento.test.ts` com um nome de camada livre.
  - Entidades que vão ao jogador (paredes, regiões, escadas, desenhos, linhas, marcadores) passam a ter lista do que pode ir, como props e pinos já têm.
  - `lib/recoveryCopy.ts:41` grava `copy.map` sem `serializeMap`: usar `serializeMap` e guardar o modelo da aventura na cópia.
  - Teste do corte no host (olho Jogadores veem) pelo filtro real, antes da fatia 4.
- **Fatia 3 (render do editor):** `addChild` do `PixiCanvas` e o teste de `ordem.test.ts` passam a ler a MESMA lista de faixas (hoje `EDITOR_HOJE` e `JOGADOR_HOJE` são cópias à mão). Mostrar ao usuário a imagem de 2 casos de camada movida, incluindo Chão acima de Salas e Escadas acima de Salas.
- **Antes da fatia 6:** `hiddenLayers` e `lockedLayers` ainda são `LayerId[]`; definir onde guardar olho do mestre e cadeado de Chão, Desenhos, Terreno, Telhados e das livres (alargar para `CamadaId[]` ou campo novo ao lado de `ocultasDoJogador`).
- **Jornada selada `task-jornada-pincel-balde-caminhos`:** 2 de 4 testes já vermelhos desde 17/10 (linhas 295 e 312, independentes de camada). Enquanto isso, ela não guarda "Camadas do chão"; o portão deve registrar a linha e a mensagem esperadas da falha.
- **Processo:** um agente que muta arquivos por vez. Dois agentes mutando `lib/camadas` e `PixiCanvas.tsx` ao mesmo tempo corromperam rodadas na revisão da fatia 1.

### Lacunas abertas depois das correções da revisão (22/10/2026)

As correções (ordem ancorada entre as vizinhas da lista, leitura que falha fechada, `camada` torta fora de toda entidade, round-trip congelado de 924c2bdd, golden que morde) deixaram estas lacunas, para as fatias indicadas:

- **Fatia 2:** `semCamadaTorta` só vale na leitura do `map.json` (`lib/mapFile.ts`). Colar da área de transferência, importar do acervo, a cópia de recuperação e o pacote que o jogador recebe não conferem `camada`; o host tem de cortar camada torta antes de mandar. Descarte PARCIAL de `ocultasDoJogador` mantém os ids válidos: um id de versão futura que some deixa aquela camada visível aos jogadores (decidir se descarte parcial também falha fechado).
- **Fatia 3:** a âncora usa a FAIXA PRINCIPAL de cada camada (`faixaPrincipal`, tipo próprio da camada); se a fatia 3 criar faixa nova, ela entra na mesma lista e o teste da principal no editor (ordem crescente) tem de continuar verde. Camada entre Objetos e Decoração (ou entre Paredes e Portas nas linhas) cai ACIMA da faixa dividida; decidir se o container dividido se separa quando há camada no meio. A propriedade aleatória só confere o editor.
- **Fatia 4:** no jogador a ordem de hoje NÃO segue a lista padrão (móveis sob escadas e paredes; escadas sob paredes), então ali a âncora volta para a faixa mais alta da camada de baixo. Mostrar ao usuário a imagem de uma camada movida no jogador antes de codar.
- **Golden:** o último avistamento (`lastSeen`) não está em nenhuma foto: o segundo pacote precisa chegar depois da cena montada e o rótulo conta segundos (relógio fixo). Terreno e pincel não têm desenho, então só os mapas da casa mordem na mutação de faixa de desenho. O golden roda com movimento reduzido: chama, fumaça e nuvens animadas não são conferidas. Na foto do jogador a 1440 há um quadrado escuro no canto (outro canvas) cobrindo parte da cena; esconder na fatia 4 se atrapalhar. Rótulo e imagem do móvel só o jogador desenha, e a foto da casa no jogador não foi conferida a olho para eles.

### Fatia 2: decisões e pendências da revisão (22/10/2026)

A revisão da fatia 2 (auditor de segurança, revisor e verificador) foi corrigida em commits próprios: fichas no host pelo olho "Jogadores veem" (`fichasNaCamadaDoJogador`), camada livre escondida dos jogadores que falha fechada sem o modelo (`jogadorVeItem`), relevo e nuvens desligados explícitos com Terreno escondida, `hiddenLayers: []` no recorte de mapa v2, céu das nuvens do mapa antigo igual ao de b934f2a1 (e nenhum céu com Chão escondido no v2), pino de escada com camada torta seguindo a escada, e o mapa completo de teste (`mapaCompleto`, congelado do código de b934f2a1).

- **Decisões de produto aceitas nesta fatia:**
  - Telhados escondidos dos jogadores tiram o TETO: o jogador vê o interior da sala, ele não fica bloqueado. **Pendente de confirmação do usuário.**
  - Com Salas escondida num mapa antigo, o brilho da luz do jogador passa da borda do chão (sem chão não há sombra de borda). Aceito: não vaza nada que o jogador não veria.
- **Lista do que pode ir NÃO foi feita** para paredes, regiões, escadas, desenhos, linhas e marcadores (era requisito herdado da fatia 1). A fatia 1 já descarta camada torta na leitura, o host tira camada torta do pacote (`recorteSemCamadaTorta`), e a lista mudaria a igualdade com o mapa antigo (o congelado de b934f2a1). Reavaliar só se um campo novo e secreto entrar nessas entidades.
- **Fatia 4:** `camadasDoJogador` e o alfa do jogador ficam para ela. Hoje as listas de ficha, objeto, pino e luz que vão ao jogador não levam `camada` com o alfa da camada; a fatia 4 precisa disso para desenhar a opacidade e a ordem. Até lá o recorte de mapa v2 manda `hiddenLayers: []` (a tela de hoje lê a lista no sentido antigo) e o host corta tudo.
- **Id de camada livre:** o id atravessa no campo `camada` dos itens; o nome não (fica no modelo, que o recorte tira). Na fatia 7 o id nasce aleatório na criação, nunca derivado do nome, mas o padrão de leitura (`ehCamadaId`, `livre_[A-Za-z0-9_-]{1,64}`) aceita hoje `livre_Segredo_do_Lich`, que entregaria o nome pelo id. **Decisão para a fatia 7, a confirmar com o usuário.** Recomendação: a leitura continua aceitando o formato de hoje (exigir "cara de aleatório" na leitura não prova nada e descartaria camadas de arquivo antigo); a garantia fica na criação (parte aleatória de 10+ caracteres, teste que confere que nenhum pedaço do nome entra no id) e o recorte do jogador pode trocar o id por um apelido por sessão se o usuário quiser fechar também o arquivo editado à mão.
- **Último avistamento do cliente** (`player/lastSeen.ts`, baixa): ficha que some por camada escondida deixa o contorno "visto por último" por 2 min na tela do jogador, como ficha que sai da visão. Não entrega nada que ele já não tenha visto; fica para a fatia 4 decidir se camada escondida apaga o avistamento na hora.

## Confirmado pelo usuário em 22/10/2026 (antes da fatia 3)

- **Camada movida:** a camada fica ENTRE as duas vizinhas onde foi solta. Dois casos mostrados e aceitos: Chão logo acima de Salas (o chão pinta por cima da cor de fundo das salas; paredes, móveis e luzes continuam por cima; os nomes das salas ficam no alto porque fazem parte de Salas) e Escadas logo acima de Salas (as escadas ficam abaixo de paredes, portas e móveis). Sem mexer na ordem o mapa é idêntico ao de hoje.
- **Telhados escondidos dos jogadores:** o jogador não vê o teto e vê o interior da casa (respeitando névoa e visão). É o que a fatia 2 já faz; nada a mudar.

## Fatia 3: o que foi feito e o que ficou (23/10/2026)

- `pixi/pilhaDeCamadas.ts`: o `addChild` do editor sai de `FAIXAS_EDITOR` (a mesma lista do `ordem.test.ts`); o container de hoje serve a primeira entrada nativa da faixa; par que não é o de hoje ganha nó só com itens; os nós entram direto no `world` (sem container de bloco). Opacidade = `alpha` do nó vezes a da faixa (secreto 0,4; Telhados x Transparente).
- **Decisão da lacuna da fatia 1:** camada (padrão, ou livre com itens) ENTRE Paredes e Portas ou entre Objetos e Decoração separa a faixa dividida (a de cima vira bloco). Faixa dividida com opacidades diferentes também se separa (um nó por camada, na ordem da lista), em vez de alpha por sprite.
- Itens divididos por nó: paredes, portas, escadas, linhas e marcadores, desenhos, móveis e luzes. **Ficou para depois** (o item com `camada` escolhida continua no container de hoje; ordem e opacidade da camada funcionam): fichas, pinos, salas (fundo, borda, nome), texto, chão e raster (a segunda instância de `floorRenderer`), carimbos e telhados.

### Fatia 3: revisão e correções (23/10/2026)

- **PENDENTE de confirmação do usuário** (só o escritor decidiu, não está em "Confirmado pelo usuário"): (1) a regra nova de `separarDivididas`: camada padrão, ou livre COM itens, entre Paredes e Portas ou entre Objetos e Decoração separa a faixa dividida (a de cima vira bloco); livre vazia não separa; (2) opacidade em faixa dividida = um nó por camada: com opacidades diferentes, os móveis de Decoração desenham TODOS acima dos de Objetos.
- **Limitação aceita (fixada em teste "LIMITACAO ATUAL", `pixi/pilhaDeCamadas.test.ts`):** com a faixa dos móveis separada, o tapete de Decoração desenha acima das cadeiras de Objetos (quebra "tapete por baixo de todo objeto") e o clique (`findPropAt`) segue a ordem de `map.props`, pegando o móvel escondido por baixo do visível. Conserto (tapetes num chão comum a todos os nós, clique pela ordem dos nós) vai junto da fatia 3b.
- **Fatia 3b (antes da 8), requisito:** itens com camada escolhida em fichas, pinos, salas (fundo, borda, nome e telhado), texto, chão e raster e carimbos desenham no nó da camada deles. Hoje não ganham par (`pixi/paresDoEditor.ts`); o teste "LIMITACAO ATUAL" de `pixi/paresDoEditor.test.ts` fica vermelho quando a 3b mudar isso.
- **Corrigido:** exportar imagem e conta-gotas escondem por NOME de faixa (Telhados mais as fixas depois dele, o mesmo conjunto de antes com a lista padrão), não pela altura de `pinsContainer`; portão das linhas lê `hiddenLayers` inteiro; nó de hoje que muda de camadas sem mudar a ordem das chaves remonta; troca de cena em fatias esconde também os nós criados de desenhos e luzes; nó descartado com imagem carregando não dá mais o aviso falso; repintura por faixa (`assinaturaDa`); `atualizarPilha` sai cedo com o mesmo mapa.
- **Desempenho medido** (`e2e/task-camadas-desempenho.spec.ts`, CPU da thread principal por quadro via `Performance.getMetrics`, mediana de 5 rodadas, mapa denso): padrão antes (98d679e9~1) → depois: pan 9,08 → 9,86 ms, zoom 12,17 → 11,32, repintura 11,66 → 12,03, visibilidade 13,61 → 11,16 (todos dentro de +15%), nenhuma tarefa ≥ 200 ms. Caminho novo (livre com paredes e móveis, Decoração a 70%, Escadas entre Paredes e Portas, 57 nós): 8,75 a 18,58 ms; teto de segurança 30 ms. Microbenchmark (`pixi/paresDoEditor.test.ts`, ~1000 itens divididos): mediana 0,36 ms. **O p95 ≤ 20 ms do quadro em GPU real NÃO é conferível no Chromium sem tela (intervalo em degraus de 16,7 ms): fica para a Fase 4 (`ux-driver medir` no app).**
- **Golden:** `threshold: 0` em 9 fotos. `editor-terreno`, `jogador-1440-terreno` e `jogador-1440-visao-parcial` diferem do PNG gravado em ±1 a 6 níveis por canal, com o render idêntico byte a byte em 924c2bdd, 98d679e9~1 e na HEAD (deriva do ambiente, não de commit): ficam com a tolerância padrão até o orquestrador decidir se regrava.

## Requisitos herdados da revisão da fatia 5 (23/10/2026)

As correções da revisão moveram o cadeado do pino das ações da store para o gesto (ferramenta Pino, arrasto, Delete e "Excluir" do painel; escada, viagem e "Passar para pede" não passam por cadeado), fizeram a barreira da borracha tirar antes os itens travados ou ocultos um a um, e trocaram `interagiveis`, `hitTestMap`, `pinAt` e `clickSelectDoPiso` do `PixiCanvas` por `contextoDeCamadas`. Ficaram para a **fatia 8 (mover item)**, como requisito, os usos que ainda derivam a camada pelo tipo (`wallLayer`, `regionLayer`, `propLayer`, `canInteractInLayer`, `isLayerLocked` e cia., que ignoram `item.camada` e o mapa v2):

- `lib/abrirVao.ts`, `lib/abrirCorredor.ts`, `lib/endireitar.ts`, `lib/hoverHitTest.ts`;
- `pixi/stairHandleGesture.ts`, `pixi/cercaCurvaGesture.ts`, `pixi/drawFantasmaDeTeste.ts`;
- `stores/mobiliaNoPonto.ts`, `components/paredesAoRedorNoPainel.ts`;
- `stores/mapStore.ts` `layerForSelection` (~248, usado pelo `toggleLayerLock` para tirar da seleção o que fica travado) e `lib/areaSelection.ts` `moveAreaSelection` (~590);
- interface, junto da fatia 6/8: `components/LayersPanel.tsx`, `components/PropLayerControls.tsx`, `components/livro/FichaDoObjeto.tsx`.

Aceite na fatia 8: cada um responde por `contextoDeCamadas(map).camadaDe`/`podeMexer`, com teste de item de camada escolhida travada e de mapa v2 (Desenhos fora de Anotações, Chão fora de Salas), sem mudar o resultado no mapa antigo.

## Fatia 4: revisão e correções (23/10/2026)

- **Corrigido no host:** `camadaDoTelhado` só atravessa com o teto fechado (como `modeloDoTeto`), nos dois caminhos da sala; o disfarce da borda de sala secreta copia a camada da parede vizinha; no mapa-mundi `camadasDoJogador` é recalculada depois da troca pela caravana. **No jogador:** a leitura recusa lista com mais de 64 entradas (13 padrão e 51 livres) ou id com mais de 40 caracteres (`MAX_CAMADAS_DO_JOGADOR`, `MAX_CARACTERES_DO_ID_DE_CAMADA` em `lib/camadas/doJogador.ts`); as nuvens animam a aparição POR CIMA da opacidade de Terreno (`definirOpacidadeDasNuvens`, `pixi/drawNuvens.ts`; o editor já embrulha as nuvens em `nuvensContainer`, sem o conflito). O host não limita a lista: um mestre com mais de 51 livres com itens, ou id de livre com mais de 40 caracteres (arquivo editado à mão), faz o jogador cair na ordem padrão.
- **Caminhos conferidos (leitura e teste):** (a) modo memória: item que o mestre move para camada escondida não volta pela versão lembrada (`recallItems` pergunta a camada da versão ATUAL), `fogFilter.camadasDoJogador.revisao.test.ts`; (b) a tela da mesa (TV) usa a mesma conexão e a mesma leitura; (c) a memória de outro andar (`snapshot.andares`) NÃO passava por `comCamadasDoJogadorLidas` e agora passa (`parseFloorMemory`). Fica de fora: as cenas guardadas no aparelho (`player/meuCaderno.ts`) não foram conferidas.
- **LIMITACAO ATUAL, aceita nesta fatia e pré-requisito da fatia 8** (fixada em `player/pilhaDoJogador.test.ts`; a fatia 3b/4b vira o teste): com camada escolhida ficam no container de hoje, com a ordem e a opacidade da camada nativa: retângulo da porta e halo (`doors`, `doorHints`), `portasNoTelhado`, linhas e marcadores, luzes (`lights`, `farLights`), fichas, pinos, salas (fundo, borda, nome), chão, carimbos e telhados. Só dividem por nó: traço das paredes, móveis (silhueta, chama, imagem, rótulo), escadas e desenhos.
- **Decisão pendente do usuário (último avistamento):** ficha que some porque o mestre escondeu a camada dela vira contorno "visto por último" por 2 min (fixado em `player/lastSeen.camadas.test.ts`). Sugestão: o jogador descarta o contorno quando a camada da ficha some de `camadasDoJogador`.
- **Golden instável (`jogador-1440-objetos-40`):** 2 em 12 rodadas, e 4 em 20 mesmo esperando fontes, a decodificação da imagem do móvel e 10 quadros, sempre os mesmos 23 px a 1 nível no rótulo "Vinho" a 40%; a Casa a 100% passou 16 em 16. Não é captura antes da hora: é um de dois arredondamentos do texto semitransparente, fixo pela vida da página. As fotos da fatia 4 ganham uma segunda página recarregada, ainda com cor exata. A causa no render (qual arredondamento e por quê) não foi achada.
- **Testes novos da revisão:** mapa JÁ aberto no jogador com outra lista, de volta ao padrão e de novo (foto `jogador-1440-chao-acima-de-salas.png`, nós da pilha), e o recorte do host com Objetos a 40% e uma livre com paredes (lista, opacidade, sem nome nem modelo). **PENDENTE:** o recorte de `filterMapForPlayer` mandado pela rota do WebSocket deixou a tela em "Aguardando o mestre atribuir um personagem"; a ponta a ponta host, conexão e tela com o recorte de verdade não foi fechada.
- **MEDIDO pelo revisor de desempenho (não reproduzível no git: o spec dele não foi guardado):** CPU da thread principal por quadro do jogador (CDP `threadTicks`, mediana de 5), mapa denso de 60 salas, 240 móveis, 60 fichas e 30 luzes, antes = `git archive` de 4ce6a756: +6% na média, pior par +18% (dentro da variação do próprio antes); caminho novo com 58 nós contra 48: 9,56 a 11,27 ms; maior tarefa longa 59 ms. O spec reproduzível do jogador (`e2e/task-camadas-desempenho-jogador.spec.ts`) não foi escrito nesta revisão.

## Fatia 6: o painel das 13 camadas (23/10/2026)

- **Decisão do orquestrador (resolve "Antes da fatia 6"):** `hiddenLayers` e `lockedLayers` foram ALARGADOS de `LayerId[]` para `CamadaId[]` (uma fonte só, sem campo paralelo; `LayerId[]` continua atribuível). A leitura (`lib/mapFile.ts` `camadasDoArquivo`) aceita ids novos (Chão, Desenhos, Terreno, Telhados, livres) só em mapa v2; no mapa antigo ela descarta o que não é uma das 9 de antes, então um mapa antigo lido e salvo sai idêntico.
- **Virada para v2 com MATERIALIZAÇÃO** (`lib/camadas/estado.ts` `paraVersao2`, idempotente): no primeiro uso de um controle que o mapa antigo não sabe guardar (olho dos jogadores, opacidade, ou olho/cadeado de uma camada nova), o mapa vira `versaoDasCamadas: 2` e grava as implicações antigas explícitas: Chão segue Salas e Desenhos segue Anotações (nas três listas), e `ocultasDoJogador` = cópia de `hiddenLayers`. Prova: matriz das 512 combinações (`estado.test.ts`) e foto antes/depois idêntica no editor (`e2e/task-camadas-painel.spec.ts`).
- **Semântica do olho do mestre no mapa antigo:** nas 9 de antes ele continua no sentido de hoje (some para o mestre E para os jogadores; o tooltip avisa "(some também para os jogadores)"); só depois da virada os dois olhos ficam independentes. A opacidade a 100% remove a chave; 1% de passo; um arrasto = um passo de Ctrl+Z (`definirOpacidadeDaCamada(id, valor, gesto)`).
- **Painel** (`components/LayersPanel.tsx`): 13 linhas, de Telhados (em cima) a Chão (embaixo), texto da linha só nome e contagem (`contarItensPorCamada`), opacidade, olho do mestre, olho dos jogadores, cadeado; chave dos ícones acima da lista. O botão "Telhados" saiu: o olho do mestre da camada Telhados o substitui e "Transparente" virou atalho de sessão aninhado na linha Telhados (só aparece com os telhados à vista). "Camadas do chão" saiu da ficha própria e mora aninhada na linha Chão. O resumo da ficha conta pelo modelo ("13 de 13 visíveis").
- **Editor:** o olho do mestre de Chão, Telhados e Terreno (texturas, relevo, carimbos e nuvens, por `renderable`) passou a ler `contextoDeCamadas(map).mestreVe`. A dependência de repintura do chão (`pixi/shapesRedraw.ts`, `floorHidden`) também: ela seguia Salas, e o olho de Chão num mapa v2 com Salas à vista não repintava (achado porque a mutação da materialização só ficou vermelha na conferência do dado, não no pixel; teste novo no spec).
- **Ponta a ponta do jogador fechada** (pendente da fatia 4): o recorte de `filterMapForPlayer` pela rota do WebSocket chega à tela com a ficha da Ana posta no mapa do mestre e atribuída; o spec prova o desenho saindo da tela do jogador e ficando na do mestre, e o alfa de Salas mudando sem nó novo. A causa da espera no teste do golden (mapa com camada livre nas paredes, pacote mandado junto do `welcome`) não foi reproduzida nem investigada mais.
- **Ficou de fora:** o hit-test por lista em `selectionHitTest` e os usos por tipo da seção da fatia 5 continuam para a fatia 8; o diagrama `vinculo-regiao-parede` (fonte `stores/mapStore.ts`) não foi atualizado (o `INDEX.md` fica com o orquestrador); atalho de teclado novo no painel não há (decisão do pedido). ("Destravar"/"Mostrar" só nas 9 de antes foi corrigido na revisão, abaixo.)

### Fatia 6: revisão e correções (23/10/2026)

Quatro revisores (designer, correção e segurança, testes e desempenho, verificador com mutações). Corrigido, um commit por grupo:

- **Desempenho (bloqueava a integração).** Critério: CPU por quadro depois <= antes + 15% e nenhuma tarefa >= 200 ms. Spec reproduzível: `e2e/task-camadas-painel-desempenho.spec.ts` (CDP `Performance.getMetrics`, mediana de 5 rodadas de 40 quadros, mapa denso de 60 salas, 240 móveis, 60 fichas, 30 luzes e 60 peças de chão, página Cena aberta com a ficha Camadas à vista, opacidade de Salas mudando a cada quadro por `setState`). Antes = `git archive` de e2fcd061 com o mesmo spec e o `playwright.config.ts` da HEAD (mesma GPU), alternando A, D, A, D. **Números: ver a tabela logo abaixo.** Conserto: a linha é `memo` com props primitivas e ações estáveis (antes as 13 linhas re-renderizavam a cada quadro), `contain: paint` na linha, o `title` do slider fixo (mudava a cada quadro) e, com o item de design 11, um slider só à vista (o da linha aberta). A lista "Camadas do chão" aninhada (sempre à vista na linha Chão) também ficou `memo` pelos dados, com callbacks procuradores que chamam sempre a versão do último render: era o resto do custo (D1 contra D2).

  | Rodada | Código | opacidade (setState), ms/quadro | opacidade (ação da store) | slider (arrasto) | virada | maior tarefa longa |
  |---|---|---|---|---|---|---|
  | A1 | e2fcd061 | 17,31 | — | — | — | 61 ms |
  | A2 | e2fcd061 | 24,85 | — | — | — | 125 ms |
  | A3 | e2fcd061 | (falhou no portão do spec, sem número) | — | — | — | — |
  | A4 | e2fcd061 | 25,72 | — | — | — | 112 ms |
  | D1 | linha `memo`, lista do chão sem `memo` | 32,37 | 30,85 | 28,93 | 62,55 | 132 ms |
  | D2 | + lista do chão `memo` | 15,70 | 14,54 | 24,17 | 31,93 | 51 ms |
  | D3 | idem | 16,09 | 15,39 | 23,24 | 58,84 | 61 ms |
  | D4 | idem | 15,97 | 14,84 | 26,48 | 36,15 | 84 ms |

  Mediana antes (A1, A2, A4) = 24,85; limite = 28,58. Mediana depois (D2 a D4) = 15,97, ou seja 36% ABAIXO do antes; mesmo contra o menor A (17,31; limite 19,91) passa. Nenhuma tarefa longa >= 200 ms em nenhuma rodada. A base mede só o cenário `opacidade-setState` (as ações e o slider de abrir não existem em e2fcd061). Os procuradores da lista do chão entraram DEPOIS de D4 e não foram medidos: o disco do C: caiu a 2,7 GB e o briefing manda parar as suítes abaixo de 5 GB.
- **A virada não repinta:** `paraVersao2` devolve a MESMA lista quando a materialização não muda o conteúdo (`estado.referencias.test.ts`); as chaves de `shapesLayerDeps` comparam `hiddenLayers` por referência. Com Salas ou Anotações nas listas o conteúdo muda de verdade (Chão/Desenhos entram) e a repintura única fica (custo medido no cenário `virada`).
- **Aviso da virada sem pedir:** o olho "Você vê" (ou o cadeado) de uma camada NOVA num mapa de antes vira o mapa para v2 e avisa uma vez por mapa na sessão ("Camadas novas ativadas: o olho "Você vê" agora não esconde dos jogadores. Desfazer: Ctrl+Z", `lib/camadas/avisoDaVirada.ts`). A mesma virada pelo olho dos jogadores ou pela opacidade não avisa.
- **Visão enviada (decisão do orquestrador, PENDENTE de confirmação do usuário):** no mapa v2, paredes e peças de chão de camada escondida dos jogadores saem dos segmentos da visão ENVIADA (o polígono `vision` desenhava o contorno delas com o pacote vazio delas); a autoridade do host segue com todas. No mapa de antes nada muda (o recorte é o de b934f2a1 byte a byte; lá a camada oculta some para todos e o contorno continua na visão, como sempre foi).
- **Opacidade 0 (decisão do orquestrador):** no recorte, camada a 0% conta como escondida dos jogadores (itens cortados, fora de `camadasDoJogador` e das duas visões; também em `fichasNaCamadaDoJogador`); o tooltip do slider diz "0% some para todos". No editor do mestre, a 0% a sala continua CLICÁVEL (o hit-test não pergunta a opacidade; fixado no spec): **PENDENTE de decisão do usuário** se a 0% o item deve sair do clique.
- **`lockedLayers: []` no recorte** (o cadeado é do mestre; no v2 a lista levava id de livre). O teste antigo que esperava a lista do mestre no pacote foi ajustado.
- **Desenhos pelo mapa:** relevo, balde (no editor e na store), nomes dos lugares e textos chamam `visibleDrawings(…, map)` (na forma de lista todo desenho caía em Anotações).
- **"Destravar"/"Mostrar"** no aviso em toda camada de mapa v2.
- **Ctrl+Z com o foco no slider** (e em interruptor e rádio) desfaz o mapa (`focoDeixaDesfazerGlobal`, `lib/keymap.ts`); campo de texto, número, busca, TEXTAREA, SELECT e `contenteditable` nunca. O arrasto de slider que espera a inatividade fecha antes do Ctrl+Z.
- **Design:** o NOME abre a linha (`aria-expanded`/`aria-controls`, uma aberta por vez, Esc fecha e devolve o foco, divisa de 12 px); aberta, slider na largura toda e a nota "Para você e para os jogadores"; a porcentagem da camada mexida fica no `::after` ao lado do nome. O nome acessível do botão é "Salas, opacidade" (não "Salas": a jornada `task-jornada-caminho-com-cor-propria` procura o botão "Chão" exato na página inteira). Slider sempre opaco (pergaminho; latão só na camada mexida); linha oculta e o 0 apagados por cor (`--lb-color-parchment-faint`), não por opacidade; "Camadas do chão" aninhada na gramática do subgrupo do Grimório e sem a pipeta na linha; 44 px no toque também na lista do chão aninhada. Abertura: grade 0fr para 1fr como a ficha do Grimório, 160 ms abrindo e 120 ms fechando; movimento reduzido sem altura nem giro.
- **Teste de ponta a ponta do jogador:** o recorte real corta Chão, Terreno (o relevo sai desligado; o carimbo não servia de prova porque só sai no que o jogador conhece) e Telhados (o teto) além de Desenhos; o alfa de Salas é lido no NÓ da pilha do jogador (`data-alfas-da-pilha` em `player/PlayerView.tsx`, ao lado de `data-nos-da-pilha`) antes da foto.

**Registrado, fora deste corretor:**
- O spec selado `task-jornada-salvamento-automatico` tem bug próprio ("Sala" resolve para 2 elementos desde d60594be): precisa de autorização do usuário para mexer.
- A 390 px a barra de ferramentas fica por cima do livro aberto (anterior à fatia 6). Opções: o livro acima da barra no `z-index`, ou esconder a barra e o selo de zoom com o livro aberto abaixo de ~600 px.
- **Risco do app publicado v0.4.36 com mapa v2:** ele lê `hiddenLayers` como vem e NÃO conhece `ocultasDoJogador`: a camada escondida só dos jogadores CHEGA aos jogadores, e ao salvar ele apaga os campos novos (`versaoDasCamadas`, `ocultasDoJogador`, `opacidadeDasCamadas`, `modeloCamadas`). Decisão do usuário antes de publicar: travar a abertura de mapa v2 em versão velha, ou avisar.
- Interruptores de grade depois da lista (opcional): não feito.

**Fechado pelo segundo corretor (23/10/2026, noite):**
- **Toque a 390 px:** o slider aberto MEDE 44 px; o código não precisou de conserto. Os 20 px eram de uma rodada anterior ao CSS final: com o código do commit 265fd1d0 o teste passou abrindo pelo clique (`abrirLinha`, 3 de 3), pelo clique direto (1 de 1) e pelo `.tap()`. O spec agora abre com o dedo (`.tap()`) e confere que o `pointer: coarse` segue ligado depois do toque. A mutação da regra (tirar os 44 px) foi bloqueada pelo classificador de segurança e não rodou; a prova é por exclusão: fora do toque a única altura da faixa é `.gr-faixa { height: 20px }`.
- **Rodadas depois das últimas mudanças, todas verdes:** `tsc --noEmit` do app e do e2e sem erro; vitest das áreas (166 arquivos, 1607 testes; e mais 47 arquivos, 265 testes das telas vizinhas); `task-camadas-painel` 15 de 15; `task-camadas-golden` 19 de 19 sem PNG mudado; jornadas seladas (`task-jornada-camada-travada`, `task-layers-visibility`, `task-jornada-atalho-com-foco-no-painel`) 8 de 8.
- **Desempenho contra 0d17698b** (o merge de antes deste corretor; `git archive` com o spec da HEAD, mesma GPU, alternando A e D; cada número é a mediana de 5 rodadas de 40 quadros, em ms por quadro):

  | Cenário | A1 | A2 | A3 | D1 | D2 | D3 | Mediana A | Mediana D |
  |---|---|---|---|---|---|---|---|---|
  | opacidade (setState) | 29,27 | 22,45 | 29,80 | 15,45 | 14,68 | 14,00 | 29,27 | 14,68 |
  | opacidade (ação da store) | 25,22 | 23,62 | 20,94 | 11,40 | 14,89 | 15,18 | 23,62 | 14,89 |
  | slider (arrasto) | — | — | — | 20,36 | 20,35 | 23,82 | — | 20,36 |
  | virada | 53,48 | 50,97 | 46,78 | 29,41 | 29,35 | 39,86 | 50,97 | 29,41 |
  | maior tarefa longa | 103 | 131 | 140 | 0 | 63 | 64 | | |

  Limite do critério = 29,27 × 1,15 = 33,66; a mediana depois é 14,68 (50% ABAIXO). Contra o menor A (22,45; limite 25,82) o maior D (15,45) passa. Nenhuma tarefa longa >= 200 ms em nenhuma rodada, a virada incluída. Uma rodada anterior de D, sem A intercalado, deu 16,22, 12,96 e 14,16 no mesmo cenário. O slider de abrir pelo nome não existe na base (sem par A).

## Fatia 7: camadas livres (23/10/2026)

O que mudou na estrutura: `lib/camadas/modelo.ts` (novo: criar, renomear, mover e apagar, funções puras sobre o mapa aberto); a store embrulha cada uma no `withHistory` (um passo por gesto); `stores/adventureStore.ts` copia o modelo do mapa aberto para `adventure.camadas` (assinatura do `useMapStore`) e põe o modelo da aventura no mapa, no passado e no futuro ao trocar de cena; `stores/virarAventura.ts` liga o painel à store (criar e ordenar num mapa solto perguntam antes de virar aventura); `components/LayersPanel.tsx` ganhou a alça, Subir/Descer, Renomear, Apagar e "+ Nova camada".

**Decisões (do escritor, a confirmar pelo orquestrador):**
- **Id:** `livre_` + 8 hexa de `crypto.randomUUID`, nunca do nome; `ID_LIVRE` só aceita hexa (`livre_Segredo_do_Lich` é recusado no jogador e no arquivo). Um id no formato de ANTES lido do arquivo vira `livre_` + 16 hexa estáveis (FNV-1a com duas sementes, `idDeCamadaDoArquivo`): os itens ficam na camada deles, a camada escondida continua escondida e o texto nunca vai ao jogador. Um palpite do nome antigo só se confere pelo hash.
- **Só as livres renomeiam e se apagam;** as 13 padrão só reordenam (o nome delas é o de sempre: avisos, seletor e jornadas falam por ele).
- **Nome:** sem controle, sem marca de direção, sem invisíveis, espaços juntados; teto de 40 caracteres visíveis (grafemas) e de 10 pontos de código por caractere (zalgo não estoura). Campo com `dir=auto`, contador "n/40".
- **Camada nova** nasce acima da linha aberta (ou no topo), com o nome "Nova camada" (ou "Nova camada N") selecionado para escrever. Teto: 51 livres (13 + 51 = 64, o teto do jogador); no teto o botão se desliga e diz por quê.
- **Apagar** mexe só na cena ativa, num passo só de Ctrl+Z, e avisa "Camada "X" apagada: N itens voltaram às camadas padrão." (com "(estavam escondidos dos jogadores)" quando era o caso) e o botão Desfazer. Nas outras cenas, o item com o id que sumiu cai na padrão pela leitura e, se a camada estava escondida dos jogadores, continua escondido (falha FECHADA em `jogadorVeItem` para todo id `livre_` escondido, também fora do formato). Lista igual à padrão tira o modelo do arquivo.
- **Mapa solto:** a lista mora no `adventure.json` (o `map.json` não a leva); criar e ordenar perguntam antes de virar aventura; no "não" nada muda.
- **Ordenar:** teclado (Subir/Descer na linha aberta; o foco fica no botão que andou; anúncio `aria-live` da posição) e ponteiro (alça de 6 pontos; as vizinhas abrem espaço em 180 ms; Esc ou cancelar devolvem; limiar de 4 px). A ordem do painel é a ordem de desenho no editor e no jogador. Os controles da linha (Subir, Descer, Renomear, Apagar) só aparecem com a linha aberta: fechada, o texto da linha continua "Paredes 1".
- **Fatias 3b/4b não feitas:** o item que escolhe camada só ganha nó próprio no editor e no jogador nas 3b/4b; os testes "LIMITACAO ATUAL" de `pixi/paresDoEditor.test.ts` e `player/pilhaDoJogador.test.ts` seguem verdes e valem para camada livre.

**Limites registrados:**
- **Cliente antigo (v0.4.36):** ignora `camada` e `adventure.camadas`; os itens aparecem na padrão do tipo e, ao salvar, a lista e os nomes se perdem (os itens não). O risco de `ocultasDoJogador` é o da fatia 6.
- **Prints do painel com toque:** com `LAB_PRINTS_DO_PAINEL` ligado, o teste "toque (390 px)" de `task-camadas-painel` falha em "o toque deixou de ser coarse" também na base 34ac6103 (o print de elemento desliga a emulação de toque). Sem prints, passa. Não é da fatia 7.
- **CPU do arrasto** contra 34ac6103 (`git archive` + duas junções de `node_modules`, mesmo spec fora do repo, mapa denso de 60 salas, 40 passos de ponteiro com um quadro cada, mediana de 5 rodadas; 3 rodadas alternadas A, D): só o arrasto 2,16 / 2,15 / 2,08 contra 2,54 / 2,45 / 2,37 ms por quadro (mediana +14%); o gesto inteiro, com a soltura que reordena a pilha (a base não reordena), 2,03 contra 2,44 (+20%). Parado, igual (0,94 contra 0,99). Nenhuma tarefa longa em nenhuma rodada. `task-camadas-painel-desempenho`: igual à base (opacidade 14,17 contra 13,40; virada 29,04 contra 30,99).

### Revisão da fatia 7 (correções, 23/10/2026)

Três revisões (correção, segurança, design) deram 23 itens; um corretor só, na `feat/camadas`.

**Decisões do corretor (a confirmar):**
- **Ctrl+Z depois de trocar de cena:** o passado e o futuro da cena que entra guardam as livres que os passos dela usam (`modeloParaOPasso`). Desfazer "apagar" numa cena traz a camada de volta (nome e lugar) mesmo se ela foi apagada em outra cena depois.
- **Camada apagada em outra cena, ou salva por cliente antigo:** em vez de apagar em todas as cenas, o painel mostra uma linha "Camada apagada" para cada id `livre_` escondido dos jogadores que nenhuma lista nomeia (`camadasApagadasEscondidas`). Os itens continuam escondidos (falha FECHADA) até o mestre clicar no olho; o cadeado de um id órfão não tem efeito (o item cai na padrão), então só o olho aparece.
- **Teto das listas do arquivo: 1024 ids, não 64.** Cortar a lista de escondidas em 64 mostraria o 65º id órfão escondido (a segurança piora). Ids repetidos saem (`Set`); o modelo para em 51 livres. 100 mil ids abrem em menos de 500 ms.
- **Nome:** invisíveis novos (sem largura, word joiner, operadores invisíveis, preenchedores hangul, braille vazio, tags); ZWJ e tags ficam dentro do emoji. Teto de 10 pontos de código por caractere mantido: a família de 11 pontos com tom de pele sai inteira (nunca cortada no meio). Nome sem nada que se veja é recusado e a linha diz por quê. O campo aceita até 80 grafemas (o contador "n/40" fica cor de latão acima de 40) e corta no 40º ao gravar.
- **Hash do id antigo (FNV-1a, 16 hexa):** não é segredo. O id chega ao jogador; um nome antigo curto se adivinha por dicionário a partir do hash. Só vale para arquivo de ANTES (id novo é aleatório); nenhum nome chega.
- **Movimento:** soltar assenta a linha em 150 ms (FLIP, só `transform`, `cubic-bezier(0.23, 1, 0.32, 1)`), levantada até pousar; Esc e cancelar devolvem em 200 ms e seguram `data-arrastando` 180 ms para as vizinhas voltarem pela transição delas. Além da primeira ou da última vaga a linha anda 30% do ponteiro. A 32 px da borda do livro, o livro rola (até 12 px por quadro) e o arrasto compensa a rolagem em vez de medir de novo. Com movimento reduzido, tudo salta.
- **Ctrl+Z no meio do arrasto:** se a lista mudou, soltar não move nada (o índice era velho).
- **Ordem real nos testes de ponta a ponta:** `pilha.ordemDasCamadas()` vira `data-ordem-da-pilha` no canvas do editor. Uma camada desenha em várias faixas (o rótulo da sala fica alto), então a pilha não é uma ordem total: o teste confere por par (o primeiro nó de cada camada) e confere o pacote REAL do jogador (`camadasDoJogador`) contra o painel. A tela do jogador se confere pela caixa dos pixels que mudaram (quadrada, com o meio igual), não por "o print mudou".

**CPU do arrasto depois da revisão** (mesmo spec e mapa da medida acima, mediana de 5 rodadas por corrida, ms de CPU por quadro):
- Contra 34ac6103, 3 corridas alternadas A, D: gesto inteiro 2,31 / 2,35 / 2,45 contra 3,17 / 3,00 / 2,99 (mediana +28%); só o arrasto 2,41 / 2,51 / 2,60 contra 3,22 / 3,01 / 3,03 (+20%); soltura 1,20 contra 2,80 (a base não reordena a pilha); parado igual (1,11 contra 1,10). Nenhuma tarefa longa.
- O que a revisão acrescentou não pesa: o painel de c9727f24 (antes da revisão) contra o de agora, alternados, o resto igual, com a máquina carregada por outra linha: 3,51 / 3,87 contra 3,70 / 3,70 (gesto inteiro), 3,54 / 3,93 contra 3,77 / 3,80 (só o arrasto). Sem a rolagem na borda e sem a FLIP: 2,85, dentro do ruído das corridas de D. A diferença contra a base é a da fatia (registrada acima como +20%) com o ruído do dia; a FLIP roda no compositor (WAAPI, só `transform`).

**Fora desta revisão:** em 390 px, o selo "100%" e a barra de ferramentas cobrem as últimas linhas do livro (já registrado pela revisão de design; é do layout do livro, não do painel).

## Fatias 3b e 4b: itens com camada escolhida no nó da camada (plano, 23/10/2026)

Por tipo: container de hoje, nó destino (`faixa|camada`, criado pela pilha só com itens) e risco. Sem camada escolhida, nenhum par novo: um nó por faixa, a mesma lista, golden idêntico.

- **Fichas:** editor `tokensContainer` (um renderer só, com cache por id; o embrulho da ficha muda de nó, em vez de um renderer por nó, para `setCameraScale`, `levantar` e o pulso da vez seguirem únicos); jogador `tokens` (as views por id mudam de nó; o nó de fichas herda o `eventMode` do de hoje, senão o arrasto morre). Risco: nó descartado destruiria embrulho vivo; o descarte devolve os filhos ao container de hoje antes de destruir. Editor passa a esconder pelo mapa (`visibleTokens(…, map)`): livre escondida do mestre some.
- **Último avistamento (`lastSeen`, decisão do usuário):** camada da ficha que sai da lista do jogador apaga o contorno. Os contornos ficam no container de hoje (ordem e opacidade de Tokens).
- **Pinos:** editor `pinsContainer`, jogador `pins`; um renderer por nó (`criarPorNo`), como móveis e luzes. Risco: as marcas (bilhetes) ficam só no de hoje.
- **Luzes (jogador):** `lights` (renderer por nó, gradientes próprios) e `farLights` (função pura por nó). O editor já dividia.
- **Linhas e marcadores (jogador):** `mapLines`, como o editor (`paintMapLines`). Risco: a chave do chão ganha a assinatura da faixa.
- **Portas (jogador):** `doors` e `portasNoTelhado` (animador por nó), `doorHints` (traço por nó). O editor já dividia.
- **Telhados (editor):** o renderer já recebe a camada por sala (`camada`); a sala com `camadaDoTelhado` vai ao nó dela. Jogador: máscaras do espiar (`roofCut`, `peekMask`) presas ao container de hoje; risco alto, fica para depois se não couber.
- **Texto, carimbos, salas (fundo, borda, nome) e chão (segunda instância do `floorRenderer`, contorno dividido):** só se couber; o que sobrar fica fixado como "LIMITACAO ATUAL" em `paresDoEditor.test.ts` e `pilhaDoJogador.test.ts`.

### Resultado (24/10/2026)

- **Feito:** editor com fichas, pinos e telhados; jogador com fichas, pinos, luzes (perto e longe), portas (retângulo, halo, cópia sobre o telhado), linhas e marcadores do chão; `lastSeen` apaga o contorno quando a camada sai do pacote. A pilha expõe `data-ordem-dos-nos` (faixa e camadas de cada nó, de baixo para cima), lido pelo e2e `task-camadas-itens-no-no.spec.ts`.
- **Ficou (LIMITACAO ATUAL fixada nos testes):** editor com salas (fundo, borda, nome), texto, chão, raster e carimbos; jogador com esses mesmos itens e os telhados (máscaras do espiar).
- **lastSeen:** num mapa v2 com uma camada padrão escondida dos jogadores e o resto padrão a 100%, o host não manda a lista (`fogFilter.camadasDoJogador.test.ts` fixa isso). O jogador não sabe da camada, e o contorno fica. Livre que esvazia também sai da lista: a última ficha dela, ao sair da visão, perde o contorno.
- **CPU (editor, mapa denso padrão, mediana de 5, A=ad439f97 e D alternados, ms por quadro):** pan 9,93→10,29 (+3,6%), zoom 13,78→15,17 (+10,1%), repintura 13,13→13,38 (+1,9%), visibilidade 14,50→14,54 (+0,3%). Tarefa longa máxima 50 ms.
- **Não verificado:** CPU no jogador; caminho novo com fichas em livre contra a base. **Não verificado em celular** (ordem do usuário, 24/10: foco só no PC).

## Fatia 8: mover item de camada (24/10/2026)

O que mudou na estrutura: `lib/camadas/mover.ts` (novo, puro: `moverParaCamada(map, refs, destino)`, `camadaDosItens`, `motivoParaNaoMover`, `refsDaSelecao`, `avisoDoMover`); `lib/camadas/arrastoDeItem.ts` (novo: o pacote do arrasto nativo, lido com desconfiança); `mapStore.moverParaCamada(refs, destino)` embrulha no `withHistory` (um gesto = um passo, também com vários itens) e avisa; `components/SeletorDeCamada.tsx` (novo, na ficha logo abaixo da cabeça, para todo tipo, vários itens e o pino aberto) substitui `PropLayerControls.tsx` (apagado; `onSetPropLayer` saiu de `App`, `PropertiesPanel` e `FichaDoObjeto`); `components/MenuDaSelecao.tsx` (novo, aberto pelo `PixiCanvas` no clique direito em cima da seleção); `MapObjectsSection` (linha arrastável) e `LayersPanel` (linha da camada recebe).

**Decisões (do escritor, a confirmar):**
- **Tipos que mudam de camada:** os que já desenham no nó da camada escolhida no editor e no jogador (fatias 3, 3b, 4, 4b): parede, porta, escada, objeto, ficha, pino, luz, desenho (menos texto), linha e marcador, e o telhado (só a ordem e a opacidade no jogador ficam as de Telhados: a ficha diz isso numa frase). Sala/região, peça de chão, carimbo e texto ficam na padrão: o seletor se desliga com "Desenha na camada padrão por enquanto."; na seleção mista eles ficam e o aviso diz "N ficaram onde estavam".
- **Sala com teto:** dois campos, "Camada" (a sala, desligado) e "Camada do telhado" (o teto, `room.camadaDoTelhado`).
- **Voltar à padrão do tipo tira o campo** (`camada` ou `camadaDoTelhado`): o arquivo volta byte a byte ao de antes. No objeto, Objetos e Decoração gravam no `layer` de sempre (o cliente antigo entende); as livres e as outras padrão no `camada`. O e2e `task-panel-sections` 5 mudou por isso: Objetos deixa o campo vazio em vez de `layer: 'objetos'`.
- **Travada:** destino travado recusa tudo (aviso "A camada X está travada" com "Destravar"; no menu e no seletor a opção aparece desligada no lugar dela; no arrasto a linha acende como recusa, "travada: não recebe", e soltar só avisa). Origem travada (ou item com cadeado) fica onde está; o resto da seleção vai.
- **Camada que o mestre não vê:** mover para ela vale (é um jeito de esconder), e o aviso "A camada X está oculta" com "Mostrar" diz para onde o item foi.
- **Aviso do que moveu:** "Item movido para X." / "N itens movidos para X." com "Desfazer" (o do "apagar camada": desfaz só se nada mudou depois).
- **Menu:** abre com o clique direito em cima de um item da SELEÇÃO (o mesmo alvo do clique de selecionar) ou do pino aberto, com qualquer ferramenta. A ficha de jogador (menu dele com jogadores na sala) e a porta (menu dela) continuam ganhando: nelas o "Mover para camada" é pela ficha ou pelo arrasto. Parede selecionada: o menu da seleção ganha do "Abrir vão / Desabar" (que segue no clique direito da parede NÃO selecionada).
- **Arrasto:** arrastar nativo do navegador (só a linha desta cena; "Outras cenas" não). Item arrastado que está na seleção leva a seleção inteira. Teclado: o caminho sem arrasto é o seletor e o menu.
- **Ctrl+Z com o foco no `<select>`** é do navegador (regra do `keymap.isEditableTarget`); o "Desfazer" do aviso cobre.

**Limites registrados:**
- Os usos da seção "Requisitos herdados da revisão da fatia 5" (`abrirVao`, `abrirCorredor`, `endireitar`, `hoverHitTest`, `stairHandleGesture`, `cercaCurvaGesture`, `drawFantasmaDeTeste`, `mobiliaNoPonto`, `paredesAoRedorNoPainel`, `moveAreaSelection`) NÃO foram trocados nesta fatia: com o mover, uma parede posta numa camada travada ainda abre vão por esses caminhos. `layerForSelection` já respondia por `contextoDeCamadas` (`camadaDaSelecao`).
- Cliente antigo (v0.4.36) ignora `camada` e `camadaDoTelhado`: o item aparece na padrão do tipo (e, se a camada estava escondida dos jogadores, o host novo ainda o esconde; o host antigo não).
- O menu da ficha de jogador (`TokenContextMenu`, com jogadores na sala) e o da porta não ganharam "Mover para camada" (os testes deles contam os itens): nelas, a ficha e o arrasto.

**Evidência (24/10/2026, na fila `suite-lock`, commit 5988cb2b):** `tsc --noEmit` do app e do `tsconfig.e2e.json` limpos; vitest de 10 arquivos relacionados 110/110 (mover, store, FichasDosItens, FichaDoObjeto, LayersPanel x2, menu da parede, wallGesture, PropertiesPanel mobília e seleção) e `arrastoDeItem.test.ts` 3/3; e2e `task-camadas-mover-item` 3/3, `task-camadas-golden` estrito (19 fotos, sem regravar), as 3 jornadas seladas (`camada-travada`, `layers-visibility`, `atalho-com-foco-no-painel`) e `task-panel-sections` verdes (34/35 na 1ª corrida; o vermelho era o próprio teste do arrasto, que rolava o livro entre apertar e mover; corrigido no teste, 3/3). Mutações vermelhas: mover sem `withHistory` (3 testes da store), destino travado aceito (unidade e store), host perguntando a camada do TIPO e não a do item em `fogFilter` ("expected ['ana','bruno'] to not include 'bruno'"). CPU (`task-camadas-desempenho`, só D, sem A/B: os caminhos medidos não passam pelo código novo): pan 11,33, zoom 14,36, repintura 13,44, visibilidade 14,74 ms por quadro; tarefa longa máxima 0 (50 na troca de camadas do caminho novo).
