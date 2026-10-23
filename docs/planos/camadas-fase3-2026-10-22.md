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
