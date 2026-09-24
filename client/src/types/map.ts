/**
 * Todas as coordenadas e distâncias (x, y, x1/y1/x2/y2, radius) estão em pixels
 * do mundo. `grid` define o tamanho de uma célula em pixels — é a unidade que
 * a UI usa para "1 quadrado", não uma unidade separada.
 */

// ─────────────────────────────────────────────────────────────
// CAMADAS — 9 camadas. 'grid' NÃO entra: MapData.showGrid já é o
// toggle da grade (map.ts:110 no schema anterior) e duplicá-lo criaria duas
// fontes de verdade. Camada é DERIVADA do tipo da entidade; só Prop tem
// override (ver Prop.layer).
// ─────────────────────────────────────────────────────────────
export type LayerId =
  | 'paredes'
  | 'portas'
  | 'salas'
  | 'escadas'
  | 'objetos'
  | 'decoracao'
  | 'iluminacao'
  | 'tokens'
  | 'anotacoes'

export const LAYER_IDS: readonly LayerId[] = [
  'paredes', 'portas', 'salas', 'escadas',
  'objetos', 'decoracao', 'iluminacao', 'tokens', 'anotacoes',
] as const

/**
 * Os 3 degraus nomeados de sempre. Cada um vale uma espessura em px de TELA
 * (`WALL_SCREEN_PX`, `pixi/drawWalls.ts`): traço de planta, que NÃO muda de
 * grossura com o zoom — é o visual de minimapa.
 */
export type WallThicknessPreset = 'thin' | 'medium' | 'thick'

/**
 * Espessura da parede: um dos 3 degraus OU um número CONTÍNUO em px de MUNDO
 * (17/09/2026, pedido literal do usuário: "isso era para ser uma muralha de
 * castelo mas nao consigo engrossar a linha o quanto eu quiser" — os degraus
 * davam no máximo um risco de 3 px de tela).
 *
 * Por que o número é px de MUNDO e não px de tela: muralha é massa construída,
 * tem largura NO MAPA — numa célula de 64 px, 32 px é meia célula em qualquer
 * zoom, como já vale para `Region.strokeWidth` (mesma unidade, mesmo app). Os
 * degraus continuam em px de tela justamente porque são o contrário: fio de
 * planta, espessura de leitura. A faixa do contínuo é
 * `WALL_WIDTH_WORLD_MIN`..`WALL_WIDTH_WORLD_MAX` (`pixi/drawWalls.ts`).
 *
 * Só controla `pixi/drawWalls.ts`, nunca `blocksLight`/`blocksMove`/collision —
 * o eixo inteiro continua sendo desenho, como antes.
 */
export type WallThickness = WallThicknessPreset | number

export interface Wall {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  blocksLight: boolean
  blocksMove: boolean
  door: DoorState | null
  /**
   * Classificação PURAMENTE VISUAL — controla só espessura/cor em
   * drawWalls.ts. Não afeta blocksLight/blocksMove nem collision.ts.
   * `undefined` === 'exterior' (aparência idêntica à de hoje), por isso
   * não precisa de linha de migração — mesmo padrão de regionId (abaixo).
   * Nome `wallKind` e não `kind` de propósito: `kind` já é discriminante
   * de união em Drawing/DoorState e grep ficaria inútil.
   */
  wallKind?: 'interior' | 'exterior'
  /**
   * Vínculo opcional com uma Região (ex.: a ferramenta Sala cria as 4 paredes
   * do contorno já vinculadas). Ambos `undefined` numa parede solta —
   * compatível com mapa salvo antigo, sem migração.
   *
   * Convenção: esta parede traça a aresta de `region.points[regionEdgeIndex]`
   * até `region.points[(regionEdgeIndex + 1) % region.points.length]`.
   *
   * Invariante: para um dado `regionId`, o conjunto de `regionEdgeIndex` em
   * uso é um SUBCONJUNTO de `0..n-1` — nunca presumido completo. Uma parede
   * vinculada continua apagável individualmente, deixando um "buraco" (aresta
   * sem parede) nesse conjunto. Uma aresta pode ter VÁRIAS paredes: pedaços
   * colineares cobrindo trechos dela (a porta parte a parede e os pedaços
   * mantêm o vínculo, `addDoorOnWall`). Mover vértice ou redimensionar
   * reposiciona cada pedaço pela posição relativa na aresta (`lib/roomLink.ts`);
   * então a parede traça um TRECHO da aresta, não necessariamente ela inteira.
   */
  regionId?: string
  regionEdgeIndex?: number
  /**
   * Espessura visual — Fase 6, pedido literal do usuário: "se eu quero
   * poligono finos ou medios ou gordos" (aplicado aqui a Parede pelo mesmo
   * vocabulário P/M/G). EIXO SEPARADO de `wallKind`: `wallKind` é
   * classificação SEMÂNTICA (estrutural/divisória) já persistida em mapa
   * salvo; `thickness` é preferência de ESTILO por cima, ortogonal — dá pra
   * ter "externa fina" (rua/construção artesanal) sem contradição. Só
   * controla `pixi/drawWalls.ts`, nunca `blocksLight`/`blocksMove`/collision.
   * `undefined` === 'medium' (aparência idêntica à de antes desta fase) —
   * sem linha de migração, mesmo padrão de wallKind/locked/hidden (acima).
   *
   * 17/09/2026: passou a aceitar também NÚMERO (px de mundo, ver
   * `WallThickness` no topo do arquivo) para a muralha de castelo. Mapa salvo
   * antes disso guarda string ou nada, e as duas formas continuam valendo —
   * `lib/mapFile.ts` copia a parede inteira sem lista de campos permitidos
   * (`walls: entityList(parsed.walls).map(...)`), então nenhuma linha de
   * migração é necessária nem para o mapa antigo (fica `undefined` === 'medium')
   * nem para o novo. Valor corrompido (NaN, negativo, absurdo) não quebra o
   * render: `pixi/drawWalls.ts` limita à faixa e cai no default.
   */
  thickness?: WallThickness
  /**
   * Ponta/canto reto ou arredondado — Fase 6, pedido literal: "essas paredes
   * tem a ponta redonda, quero a opcao de colocar reta ou redondo". Um único
   * eixo cobre ponta de parede SOLTA (vira `cap` do stroke) e canto de Sala
   * FECHADA (vira `join`) — são a mesma escolha visual em dois contextos, ver
   * `pixi/drawWalls.ts`. `undefined` === 'round' (comportamento hardcoded de
   * antes desta fase) — sem linha de migração, mesmo padrão de wallKind
   * (acima).
   */
  lineStyle?: 'round' | 'straight'
  /** Parede não pode ser movida/editada. `undefined` === false (comportamento
   *  idêntico ao de hoje) — sem linha de migração, mesmo padrão de wallKind
   *  (acima). */
  locked?: boolean
  /** Não renderiza NO EDITOR — organização de cena para o próprio mestre.
   *  NÃO significa "invisível para o jogador": este app não tem segunda
   *  tela/modo jogador, então essa promessa não existe. `undefined` === false
   *  (visível, comportamento idêntico ao de hoje) — sem linha de migração. */
  hidden?: boolean
}

/** 3 tipos estruturais. Cada um muda só render + comprimento do vão. */
export type DoorKind = 'normal' | 'double' | 'gate'

export interface DoorState {
  open: boolean
  locked: boolean
  /** OBRIGATÓRIO. Porta de mapa antigo migra para 'normal' (mesma
   *  aparência de hoje). Ver mapFile.ts. */
  kind: DoorKind
  /**
   * PORTA SECRETA — parece parede até o mestre revelar. Para o jogador ela sai
   * como parede comum, sem porta e sem este campo (`lib/fogFilter.ts`): sem
   * halo, sem toque, e a visão e o movimento não passam nem com ela aberta
   * (`lib/collision.ts`). O mestre a vê tracejada (`pixi/drawDoors.ts`);
   * "Revelar passagem" tira o campo desta porta e o oculto da sala ligada
   * (`mapFactory.revealSecretPassage`). `undefined` === porta comum, sem linha
   * de migração; do disco só `true` volta (`lib/mapFile.ts`).
   */
  secret?: boolean
}

export interface Light {
  id: string
  x: number
  y: number
  radius: number
  color: string
  intensity: number
  /** Luz não pode ser movida/editada. `undefined` === false (comportamento
   *  idêntico ao de hoje) — sem linha de migração. */
  locked?: boolean
  /** Não renderiza NO EDITOR — organização de cena para o próprio mestre.
   *  NÃO significa "invisível para o jogador": este app não tem segunda
   *  tela/modo jogador, então essa promessa não existe. `undefined` === false
   *  (visível, comportamento idêntico ao de hoje) — sem linha de migração. */
  hidden?: boolean
  /** Tocha presa na ficha: id da ficha que carrega esta luz. Prender põe a
   *  luz no centro da ficha; quando a ficha anda (mestre no editor ou jogador
   *  na tela dele), a luz anda o MESMO deslocamento. `undefined` === solta
   *  (comportamento de antes) — sem linha de migração. Para o jogador, só
   *  chega se ele vê a ficha (`lib/fogFilter.ts`). */
  attachedTokenId?: string
}

export interface RegionPoint {
  x: number
  y: number
}

export interface RoomMeta {
  /** 'rect' = 4 vértices ortogonais (ferramenta Sala). 'polygon' = Sala
   *  Circular / Polígono Regular. Resize por canto e largura/altura
   *  numérica só valem para 'rect'. */
  shape: 'rect' | 'polygon'
  /** Rótulo editável. Distinto de `tag`, que é genérico e hoje não tem UI. */
  name: string
  /** Deslocamento do rótulo, em px de mundo, relativo a `roomLabelAnchor`
   *  (`pixi/drawRoomNames.ts`). `undefined` = centro da sala, sem migração.
   *  Vai junto para o jogador: `PlayerView` desenha com o mesmo renderer. */
  labelOffset?: { x: number; y: number }
  /**
   * Quanto a sala já foi girada, em graus, na faixa (−180, 180] — positivo é
   * sentido horário na tela, como `Token.rotation`. É SÓ a leitura: o giro de
   * verdade está gravado nos pontos (`lib/mapFactory.ts` → `rotateRegion`), e
   * parede, névoa e colisão nem olham este número. Serve ao campo "Rotação"
   * do painel e à alça de girar, que usa o ângulo para saber onde é o "em
   * cima" da sala. `undefined` === 0 (sala nunca girada) — sem linha de
   * migração: mapa salvo antes do campo abre igual. `lib/mapFile.ts` descarta
   * valor que não é número finito.
   */
  rotation?: number
  /** A5 — o jogador recebe a Sala com `name = ''` (`lib/fogFilter.ts`).
   *  `undefined` === false (jogadores veem o nome), sem migração. */
  nameHiddenFromPlayers?: boolean
  /** TETO DE CONSTRUÇÃO — "Teto fechado para jogadores". Com o teto ligado o
   *  jogador recebe só o POLÍGONO da Sala (a silhueta do prédio, pintada
   *  chapada por `player/PlayerView.tsx`) e NADA do interior: prop, desenho,
   *  escada, pino, luz, token alheio e o chão de dentro ficam fora do pacote,
   *  com o mesmo rigor da sala secreta (`lib/fogFilter.ts`). O teto ABRE
   *  sozinho para o jogador que tem um token dentro do polígono e fecha
   *  quando ele sai — inclusive apagando o que ele já tinha visto. O mestre vê
   *  tudo, sempre. Distinto de `Region.secret` ("Oculto para jogadores"), que
   *  apaga a Sala inteira do jogador; os dois convivem.
   *
   *  `undefined` === false (sem teto, comportamento idêntico ao de hoje) —
   *  sem linha de migração: a Sala de todo mapa já salvo continua aberta. */
  roof?: boolean
  /**
   * TEXTO DA SALA — "Ao entrar, o jogador lê". Na PRIMEIRA vez que a ficha de
   * um jogador entra na Sala, só ele recebe o cartão (`room.text`,
   * `net/hostSession.ts`); depois, tocar no rótulo reabre. Só atravessa no
   * recorte (`lib/fogFilter.ts`) de quem está ou já esteve dentro — nunca no de
   * quem está fora. Sala secreta, sob teto fechado ou em zona oculta não dispara.
   * `undefined` === sem texto, sem migração.
   */
  textoAoEntrar?: string
  /**
   * "Nota do mestre": lembrete só dele sobre o cômodo. NUNCA sai no recorte do
   * jogador (`lib/fogFilter.ts`). `undefined` === sem nota, sem migração.
   */
  notaDoMestre?: string
}

/**
 * A5 — "Oculto para jogadores": o item nunca sai no recorte do jogador
 * (`lib/fogFilter.ts`), mas continua no editor (desenhado esmaecido) e
 * continua valendo para movimento e colisão no mestre. Distinto de `hidden`,
 * que é "Oculto no editor". `undefined` === false, sem migração.
 */
export interface PlayerSecret {
  secret?: boolean
}

/**
 * "!" (aqui tem algo), "?" (investigue aqui) e o pino de VIAGEM: a passagem
 * que leva de uma cena da aventura para outra. O terceiro valor é aditivo —
 * pino gravado antes dele continua sendo "!" ou "?".
 */
export type PinKind = 'exclamacao' | 'interrogacao' | 'viagem'

/**
 * Para onde um pino de viagem leva: a cena de destino e o pino PAR dela, que é
 * o ponto de chegada. A ligação é gravada nos DOIS pinos (mão dupla), então o
 * par sempre leva de volta.
 */
export interface PinDestination {
  sceneId: string
  pinId: string
}

/**
 * Uma saída como o JOGADOR a enxerga: o id que o pedido leva de volta e o
 * rótulo que o mestre escreveu. Nunca o destino — o nome ou o id da cena
 * diria ao jogador que a outra cena existe antes de o mestre deixar passar.
 */
export interface PinExitLabel {
  id: string
  rotulo: string
  /**
   * SÓ NO RECORTE DO JOGADOR: o par desta saída é a chegada oculta (mão
   * única) — o cartão marca "Só ida". Quem monta é o host (`lib/fogFilter.ts`);
   * o mestre nunca grava. Ausente = a saída de sempre, com volta.
   * Ausência documentada, sem linha de migração: `escolhas` inteiro (e o
   * `soIda` de cada saída junto) já volta ausente do disco (`lib/mapFile.ts`).
   */
  soIda?: true
}

/**
 * ENCRUZILHADA (G8): uma saída EXTRA do pino de viagem. A saída principal
 * continua em `Pin.destino` (e o rótulo dela em `Pin.rotulo`), para mapa
 * gravado antes das encruzilhadas abrir igual; as outras moram aqui, cada uma
 * ligada em mão dupla ao próprio pino par.
 */
export interface PinExit extends PinExitLabel {
  destino: PinDestination
}

/**
 * Como o pino de viagem deixa o jogador passar. Numa mesa de 4 a 7 jogadores
 * espalhados por várias cenas, aprovar cada passagem vira gargalo do mestre:
 * - `pede`: o jogador pede e o mestre decide ("Deixar ir"). É o de sempre;
 * - `livre`: o jogador passa sozinho, e o mestre só lê que ele chegou;
 * - `trancada`: ninguém passa, e nenhum pedido chega ao mestre.
 * Cada pino do par tem o seu: a porta pode ser livre para ir e trancada para
 * voltar.
 */
export type PinPassage = 'pede' | 'livre' | 'trancada'

/**
 * POR QUE a passagem trancada não deixa passar. A AUSÊNCIA é "Está trancada"
 * (a chave, o de sempre); os outros dizem ao jogador que não é questão de
 * achar a chave. Lista curta de propósito: texto livre do mestre seria mais
 * um lugar para escapar o que ele não quer contar.
 */
export type PinBlockReason = 'desabou' | 'alagada' | 'em-chamas' | 'sem-energia'

/**
 * Símbolo desenhado DENTRO da cabeça do pino, no lugar do glifo. Os seis que o
 * usuário pediu: o mestre crava "aqui tem um baú" e "aqui tem uma armadilha" e
 * enxerga a diferença no mapa, sem abrir os dois para lembrar qual é qual.
 *
 * O campo é OPCIONAL no `Pin` de propósito: a AUSÊNCIA é o padrão, e ausente
 * desenha exatamente o pino de hoje ("!" ou "?"). Mapa salvo antes deste campo
 * abre com a cara que tinha — mesma regra de `locked` e de `FloorPiece.fillColor`.
 */
export type PinIcon = 'bau' | 'armadilha' | 'chave' | 'perigo' | 'escada' | 'agua'

/**
 * Ponto de interesse cravado pelo mestre. O jogador toca o pino no mapa e lê o
 * cartão: imagem em cima, descrição embaixo.
 *
 * `image` guarda a imagem EM DATA URL (`data:image/...;base64,...`), nunca um
 * caminho do disco — é a única forma de o cartão chegar ao jogador sem abrir o
 * computador do mestre (o recorte de `lib/fogFilter.ts` recusa qualquer valor
 * que não comece em `data:image/`). `null` = cartão sem foto, que o jogador vê
 * como área vazia rotulada.
 */
export interface Pin extends PlayerSecret {
  id: string
  x: number
  y: number
  kind: PinKind
  /**
   * Símbolo dentro da cabeça. `undefined` === sem símbolo: o pino desenha o
   * glifo de `kind`, que é a cara de todo pino já gravado. Sem migração.
   */
  icon?: PinIcon
  /** O que o jogador lê no cartão. Vazio = o mestre ainda não escreveu nada. */
  description: string
  /**
   * "Nota do mestre" (só eu leio): o lembrete dele sobre o pino — a
   * combinação do cofre, o que o NPC esconde. NUNCA sai no recorte do jogador
   * (`pinForPlayer` em `lib/fogFilter.ts` é lista do que vai, e ela não está
   * lá), nem na pista que o cartão vira. Ausente = sem nota — mapa gravado
   * antes deste campo abre igual. O disco só aceita texto (`lib/mapFile.ts`).
   */
  notaDoMestre?: string
  image: string | null
  /** Pino não pode ser movido/editado. `undefined` === false — sem migração. */
  locked?: boolean
  /** Não renderiza NO EDITOR (organização de cena do mestre). `undefined` === false. */
  hidden?: boolean
  /**
   * Só do pino de viagem: a cena e o pino par para onde ele leva. Ausente ou
   * `null` = pino ainda não ligado; mapa salvo antes deste campo abre igual (a
   * migração de `lib/mapFile.ts` confere a forma). NUNCA sai no recorte do
   * jogador (`lib/fogFilter.ts`): revelaria que a outra cena existe.
   */
  destino?: PinDestination | null
  /**
   * Só do pino de viagem: se o jogador pede, passa livre ou encontra trancado.
   * `undefined` === 'pede' — todo pino gravado antes deste campo continua
   * pedindo ao mestre, sem migração. Ao contrário de `destino`, SAI no recorte
   * do jogador: o cartão dele precisa saber se oferece "Passar", "Pedir para
   * passar" ou "Está trancada", e o modo não diz nada da outra cena.
   */
  passagem?: PinPassage
  /**
   * Só do pino de viagem trancado: o motivo ("Desabou", "Alagada"...).
   * Ausente = "Está trancada", o de sempre — sem migração. Fica gravado se o
   * mestre reabrir o pino (volta junto quando ele tranca de novo), mas só SAI
   * no recorte do jogador enquanto a passagem é `trancada` (`lib/fogFilter.ts`).
   */
  motivo?: PinBlockReason
  /**
   * Só do pino de viagem com VÁRIAS saídas: como o mestre chama a saída
   * principal (a de `destino`) — "Porta da cripta". Ausente = sem nome; o
   * jogador lê "Saída 1". Não sai no recorte do jogador: vai dentro de `escolhas`.
   */
  rotulo?: string
  /**
   * Só do pino de viagem: as saídas além da principal. Ausente ou vazio = o
   * pino de uma saída de sempre. NUNCA sai no recorte do jogador (leva destino).
   */
  saidas?: PinExit[]
  /**
   * Só do pino de viagem: é a CHEGADA OCULTA de uma ligação de MÃO ÚNICA
   * (alçapão, teleporte, porta que fecha atrás). O mestre marca "Mão única"
   * no pino de ORIGEM e é o par, aqui, que ganha a marca. A ligação continua
   * gravada nos dois lados (a mão dupla segue sabendo quem é o par), mas o
   * jogador nunca recebe este pino (`lib/fogFilter.ts`), o host recusa pedido
   * de viagem por ele (`net/hostSession.ts`) e o painel diz "Só chegada".
   * Ausente = o par de sempre, visível e de mão dupla — sem migração. O disco
   * só aceita `true` (`lib/mapFile.ts`).
   */
  soChegada?: true
  /**
   * SÓ NO RECORTE DO JOGADOR, e só quando o pino tem mais de uma saída: o id e
   * o rótulo de cada uma, na ordem (a principal primeiro). O mestre nunca grava
   * este campo; `lib/fogFilter.ts` o monta a partir de `rotulo` e `saidas`.
   */
  escolhas?: PinExitLabel[]
  /**
   * SÓ NO RECORTE DO JOGADOR, e só no pino de UMA saída: o par dela é a
   * chegada oculta (`soChegada`), então não há volta por aqui. O cartão mostra
   * "Só ida" e a pergunta avisa antes de o jogador cair. É um booleano e nada
   * mais: o destino continua fora do recorte. Quem monta é o host, que enxerga
   * a outra cena (`oneWayExitsOf` em `lib/pinTravel.ts`); o mestre nunca grava.
   * Numa encruzilhada o aviso vai por saída, em `escolhas[].soIda`.
   */
  semVolta?: true
}

/**
 * A5 — área desenhada pelo mestre que o jogador não vê: tudo que tem ponto
 * amostrado dentro dela fica fora do recorte e o jogador pinta preto por cima.
 * Não bloqueia a visão (a zona esconde conteúdo, não é parede).
 */
export interface ConcealZone {
  id: string
  points: RegionPoint[]
  name: string
  /** `true` = revelada: deixa de esconder, mas continua no mapa do mestre. */
  revealed: boolean
  /**
   * PINCEL DE REVELAR — pedaços da zona que o mestre pintou para os jogadores
   * verem, sem revelar a zona inteira. Cada entrada é a célula `"col,row"` de
   * `REVEAL_BRUSH_CELL` px de mundo (`lib/concealBrush.ts`) cujo centro está
   * dentro da zona. Ausente = nada pintado (a zona de sempre) —
   * sem linha de migração: quem lê é `unveiledCellsOf`, que trata ausência e
   * lixo vindo do disco como "nada revelado". Nunca sai para o jogador: o recorte
   * (`lib/fogFilter.ts`) manda só o preto que sobra e o pedaço à vista.
   */
  unveiledCells?: string[]
}

export interface Region extends PlayerSecret {
  id: string
  points: RegionPoint[]
  tag: string
  fillColor: string
  fillPattern: 'solid' | 'hatch'
  data: Record<string, unknown>
  /** Presença marca "isto é uma Sala". Ausente = região comum.
   *  SEM retroatividade: sala desenhada antes desta mudança carrega como
   *  região comum e não ganha nome/resize — comportamento aceito. */
  room?: RoomMeta
  /** Sub-sala: id da Sala de fora (quarto dentro da casa). Mover, apagar e
   *  duplicar a de fora leva as de dentro junto; sala de fora secreta/oculta
   *  esconde as de dentro do jogador (`lib/roomNesting.ts`, `lib/fogFilter.ts`).
   *  `undefined` ou id que não existe mais no mapa = sala de topo, sem migração. */
  parentId?: string
  /** Pedido N2 do usuário ("tirar o fundo" de Região/Sala). Diferente de
   *  `Drawing`, que já tem `filled` por kind, `Region` sempre preenchia sem
   *  guarda nenhuma (`drawRegions.ts` chamava `g.fill(...)` incondicional) —
   *  por isso este campo é novo, ao contrário do de `Drawing`. `undefined`
   *  === true (preenche, aparência idêntica à de hoje) — sem linha de
   *  migração, mesmo padrão de wallKind/locked/hidden. */
  filled?: boolean
  /**
   * Espessura do contorno em px de mundo — Fase 6, pedido literal do usuário:
   * "as propriedades das paredes/sala ... se eu quero poligono finos ou
   * medios ou gordos ... vou usar os poligonos para criar ruas ou
   * construcoes mais artesanais" (ver `pixi/drawRegions.ts`, agente G2).
   * `undefined` === 2 (o que o render já hardcodava antes deste campo
   * existir) — sem linha de migração, mesmo padrão de wallKind/locked/hidden.
   */
  strokeWidth?: number
  /**
   * Junção do vértice do contorno — 'round' arredonda o canto, 'miter'
   * mantém anguloso. `undefined` === 'miter' (default do próprio Pixi
   * quando `join` não é passado no `stroke()`) — sem linha de migração.
   * Não existe `strokeCap`: o contorno de uma Região é sempre um path
   * FECHADO (`g.closePath()`), então `cap` nunca teria efeito visual —
   * confirmado lendo o código-fonte do Pixi instalado (ver
   * `pixi/drawRegions.ts`, agente G2). "Arredondado/reto" num contorno
   * fechado é sempre join, nunca cap.
   */
  strokeJoin?: 'round' | 'miter'
  /** Região não pode ser movida/editada. `undefined` === false (comportamento
   *  idêntico ao de hoje) — sem linha de migração. */
  locked?: boolean
  /** Não renderiza NO EDITOR — organização de cena para o próprio mestre.
   *  NÃO significa "invisível para o jogador": este app não tem segunda
   *  tela/modo jogador, então essa promessa não existe. `undefined` === false
   *  (visível, comportamento idêntico ao de hoje) — sem linha de migração. */
  hidden?: boolean
}

export interface Token extends PlayerSecret {
  id: string
  characterId: string | null
  name: string
  x: number
  y: number
  size: number
  /** Caminho absoluto da imagem importada (mesmo pipeline de Prop.src).
   *  null = círculo genérico, render idêntico ao de drawTokens.ts:10-18.
   *  NÃO viaja para o jogador: é caminho do disco do mestre (lib/fogFilter.ts). */
  image: string | null
  /** Cópia pequena e AUTO-CONTIDA da foto (`data:image/...;base64,...`) — a
   *  única forma que atravessa o recorte do jogador, e por onde a foto que o
   *  JOGADOR escolhe na tela dele chega ao mapa. `undefined` === null (token
   *  sem cópia embutida, aparência idêntica à de antes deste campo) — mesmo
   *  padrão de `rotation`/`locked`/`hidden`. Regra de uso e teto em
   *  `lib/tokenPhoto.ts`. */
  imageData?: string | null
  /** Rotação em graus, sentido horário. `undefined` === 0 (aparência
   *  idêntica à de hoje) — sem linha de migração, mesmo padrão de wallKind
   *  (Wall, acima). EXCEÇÃO na tela do jogador: o campo PRESENTE (0
   *  inclusive, "para cima") é a FRENTE da ficha e desenha o bico; ausente =
   *  ficha sem frente (`player/facingMarker.ts`). Nunca trocar 0 por ausente. */
  rotation?: number
  /** Cor do disco da ficha, em `#rrggbb` — é o que separa aliado de inimigo
   *  no meio da luta. `undefined`/`null` === a cor de fábrica
   *  (`TOKEN_COLOR_DEFAULT`, o mesmo azul de sempre), então mapa salvo antes
   *  deste campo abre idêntico e não há linha de migração — mesmo padrão de
   *  `rotation`/`locked`/`hidden`. Valor fora de `#rrggbb` também cai no
   *  default (`lib/tokenColor.ts`), porque mapa do disco chega cru.
   *  ATRAVESSA para o jogador: não é caminho de disco do mestre, é aparência
   *  da peça, e a mesa inteira precisa enxergar a mesma separação. */
  color?: string | null
  /** "Nome para os jogadores" — o que a mesa lê embaixo da ficha no lugar de
   *  `name`, que é o nome de TRABALHO do mestre ("Capataz traidor").
   *  `undefined` = "O mesmo" (mapa salvo antes deste campo abre idêntico, sem
   *  linha de migração); texto = "Outro" (pode ser `''` enquanto o mestre não
   *  digitou: a ficha sai sem rótulo, nunca com o nome de trabalho); `null` =
   *  "Nenhum" (sem rótulo). O DONO da ficha sempre recebe `name`. NÃO viaja
   *  para jogador nenhum: o recorte troca o nome e apaga este campo
   *  (`lib/tokenPublicName.ts`, `lib/fogFilter.ts`). */
  publicName?: string | null
  /** Token não pode ser movido/editado. `undefined` === false (comportamento
   *  idêntico ao de hoje) — sem linha de migração. */
  locked?: boolean
  /** Não renderiza NO EDITOR — organização de cena para o próprio mestre.
   *  NÃO significa "invisível para o jogador": este app não tem segunda
   *  tela/modo jogador, então essa promessa não existe. `undefined` === false
   *  (visível, comportamento idêntico ao de hoje) — sem linha de migração. */
  hidden?: boolean
  /** Ficha de personagem do mestre (NPC): não vira botão de "Atribuir" de um
   *  clique no card de quem espera personagem (continua na lista). Metadado
   *  do mestre: NÃO atravessa para o jogador (`lib/fogFilter.ts`).
   *  `undefined` === false — sem linha de migração. */
  npc?: boolean
  /** MARCA DE COMPANHEIRO: a ficha é de OUTRO jogador da mesa. Só o recorte do
   *  jogador escreve este campo (`lib/fogFilter.ts`), e só em ficha que ele já
   *  recebe; o mapa do mestre nunca o guarda (o recorte apaga o que vier dele).
   *  Ausente = NPC ou a própria ficha. */
  companion?: TokenCompanion
}

/** Quem joga com a ficha: nome do jogador e a cor de sinal dele (`#rrggbb`, `lib/signals.ts`). */
export interface TokenCompanion {
  name: string
  color: string
}

export interface Prop extends PlayerSecret {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
  linkedMapPath: string | null
  /** ÚNICO override de camada do schema. 'objetos' vs 'decoracao' é a
   *  única distinção que o tipo da entidade não deriva sozinho.
   *  undefined = 'objetos'. */
  layer?: 'objetos' | 'decoracao'
  /** Rotação em graus, sentido horário. `undefined` === 0 (aparência
   *  idêntica à de hoje) — sem linha de migração, mesmo padrão de wallKind
   *  (Wall, acima). */
  rotation?: number
  /** Prop não pode ser movido/editado. `undefined` === false (comportamento
   *  idêntico ao de hoje) — sem linha de migração. */
  locked?: boolean
  /** Não renderiza NO EDITOR — organização de cena para o próprio mestre.
   *  NÃO significa "invisível para o jogador": este app não tem segunda
   *  tela/modo jogador, então essa promessa não existe. `undefined` === false
   *  (visível, comportamento idêntico ao de hoje) — sem linha de migração. */
  hidden?: boolean
}

export interface DrawingPoint {
  x: number
  y: number
}

/**
 * Ponta do traço (line cap) para os kinds com traço visível (não-preenchível
 * por área). `undefined` === 'round' — é o que `drawDrawings.ts` já hardcoda
 * hoje para freehand/line/curve — então não precisa de linha de migração,
 * mesmo padrão de wallKind/locked/hidden (Wall, acima). Bug B2 do usuário:
 * ele quer poder trocar para ponta reta ('butt') numa `line`.
 */
export type DrawingCap = 'round' | 'butt' | 'square'

/**
 * Textura do traço livre (pincel) — N1 do usuário ("caneta, lápis e afins",
 * ROADMAP.md Fase 4). `undefined` === 'pen' (traço sólido de hoje,
 * `drawDrawings.ts`/`drawDraft.ts` já tratam a ausência assim) — sem linha de
 * migração, mesmo padrão de wallKind/cap/locked/hidden (acima). Geometria de
 * cada textura em `lib/brushTexture.ts`.
 */
export type FreehandTexture = 'pen' | 'pencil' | 'marker'

/**
 * Estilo do traço (contínuo/tracejado/pontilhado) dos kinds com traço
 * visível — o que separa "isto é parede" de "isto é passagem secreta, limite
 * ou caminho sugerido". `undefined` === 'solid', que é exatamente o traço
 * inteiriço que `drawDrawings.ts`/`drawDraft.ts` desenham hoje: mapa salvo
 * antes desta mudança abre igual, sem linha de migração — mesmo padrão de
 * `cap`/`texture`/`wallKind` acima. Os mesmos três valores de
 * `GridSettings['lineStyle']`, de propósito: é o vocabulário que o usuário já
 * lê no painel da Grade ("Sólida | Tracejada | Pontilhada").
 * A geometria de cada estilo vive em `lib/dashPattern.ts`.
 */
export type DrawingDash = 'solid' | 'dashed' | 'dotted'

// `& PlayerSecret` distribui sobre a união: cada variante ganha `secret?`.
export type Drawing = PlayerSecret & (
  | { id: string; kind: 'freehand'; points: DrawingPoint[]; color: string; width: number; cap?: DrawingCap; texture?: FreehandTexture; dash?: DrawingDash }
  | { id: string; kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number; cap?: DrawingCap; dash?: DrawingDash }
  | { id: string; kind: 'circle'; cx: number; cy: number; radius: number; color: string; width: number; filled: boolean; fillAlpha: number }
  | { id: string; kind: 'curve'; points: DrawingPoint[]; color: string; width: number; cap?: DrawingCap; dash?: DrawingDash }
  | { id: string; kind: 'text'; x: number; y: number; text: string; color: string; fontSize: number; fontFamily?: string }
  // NOVOS. `width` continua = espessura de traço; `w`/`h` = geometria.
  | { id: string; kind: 'rect'; x: number; y: number; w: number; h: number; color: string; width: number; filled: boolean; fillAlpha: number }
  | { id: string; kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; color: string; width: number; filled: boolean; fillAlpha: number }
  | { id: string; kind: 'polygon'; points: DrawingPoint[]; color: string; width: number; filled: boolean; fillAlpha: number }
  /**
   * CAMINHO (ferramenta "Caminho", `types/tools.ts`): trilha traçada ponto a
   * ponto, com a cor DAQUELE caminho. Traço aberto como `freehand`/`curve` —
   * `points` em ordem, `width` em px de MUNDO (a largura em células que o
   * painel mostra é convertida com `map.grid` na hora de criar, para o caminho
   * não mudar de grossura quando a grade do mapa muda) e `color` próprio, que
   * é o que faz um caminho de terra e um de pedra conviverem sem um repintar o
   * outro.
   *
   * Kind NOVO, nunca escrito por versão anterior: mapa salvo antes desta
   * feature abre igual e não precisa de linha de migração em `lib/mapFile.ts`
   * — mesma regra dos campos opcionais `cap`/`dash`/`texture` acima.
   */
  | { id: string; kind: 'path'; points: DrawingPoint[]; color: string; width: number }
)

export type StairDirection = 'up' | 'down'
/** 'l' e 'double' existem no schema e no render desde já; a UI desta
 *  rodada só produz 'straight'. */
export type StairShape = 'straight' | 'l' | 'double'

export interface StairSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Stair extends PlayerSecret {
  id: string
  shape: StairShape
  direction: StairDirection
  segments: StairSegment[]
  /** Largura do lance em px de mundo. Default na criação = map.grid. */
  stepWidth: number
  /** Rotação em graus, sentido horário. `undefined` === 0 (aparência
   *  idêntica à de hoje) — sem linha de migração, mesmo padrão de wallKind
   *  (Wall, acima). */
  rotation?: number
  /** Escada não pode ser movida/editada. `undefined` === false
   *  (comportamento idêntico ao de hoje) — sem linha de migração. */
  locked?: boolean
  /** Não renderiza NO EDITOR — organização de cena para o próprio mestre.
   *  NÃO significa "invisível para o jogador": este app não tem segunda
   *  tela/modo jogador, então essa promessa não existe. `undefined` === false
   *  (visível, comportamento idêntico ao de hoje) — sem linha de migração. */
  hidden?: boolean
}

/**
 * Chão construído por peças geométricas (etapa 1 do plano "chão por peças").
 * Todas as coordenadas em px de mundo. `rect`/`ellipse`/`polygon` giram em
 * torno do próprio centro; `corridor` é um caminho em que cada ponto tem a
 * sua largura, interpolada ao longo do segmento.
 */
export type FloorShape =
  | { kind: 'rect'; cx: number; cy: number; w: number; h: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'polygon'; cx: number; cy: number; radius: number; sides: number }
  | { kind: 'corridor'; points: { x: number; y: number; width: number }[] }
  /**
   * Blocos presos à grade (pincel de blocos e balde). Cada célula é um quadrado
   * de `cell` px alinhado à origem do mundo, e o que fica guardado é COLUNA e
   * LINHA, não px: assim a peça não sai da grade por arredondamento, nem quando
   * é movida. A borda externa da união das células é o contorno do chão — é ela
   * que vira parede (`lib/visibility.ts`) e limite de movimento
   * (`lib/moveValidation.ts`), sem nenhuma costura entre células vizinhas.
   */
  | { kind: 'blocos'; cell: number; cells: { col: number; row: number }[] }
  /** Polígono livre: vértices em px de mundo, gira em torno do centro do retângulo que o envolve. */
  | { kind: 'poly'; points: { x: number; y: number }[] }

/** Borda irregular determinística: mesma `seed` reabre idêntica. */
export interface FloorNoise {
  /** Desvio máximo da borda, em px de mundo. */
  amplitude: number
  /** Comprimento de onda do "dente", em px de mundo. */
  scale: number
  seed: number
}

export interface FloorModifiers {
  /** Raio de arredondamento dos cantos, em px de mundo. */
  rounding?: number
  noise?: FloorNoise
  /**
   * Engordar (positivo) ou emagrecer (negativo) a peça inteira, em px de
   * mundo — desloca a borda na direção da normal. `undefined` === 0.
   */
  grow?: number
}

/**
 * Uma peça do chão. A ordem em `MapData.floor` importa: cada peça se aplica
 * sobre o resultado das anteriores — 'add' soma chão, 'subtract' abre buraco.
 */
export interface FloorPiece {
  id: string
  shape: FloorShape
  op: 'add' | 'subtract'
  /** Graus, sentido horário, em torno do centro. `undefined` === 0. */
  rotation?: number
  /**
   * Cor só desta peça — é o que faz um caminho ter cor diferente do chão em
   * volta. `undefined` === usa `MapData.floorStyle.fillColor`, a cor do chão do
   * mapa inteiro, que é como todo mapa salvo antes deste campo abre.
   */
  fillColor?: string
  modifiers: FloorModifiers
  locked?: boolean
  hidden?: boolean
}

export interface FloorStyle {
  fillColor: string
  /** `null` = sem contorno. */
  strokeColor: string | null
  strokeWidth: number
  /**
   * Precisão do contorno: distância entre amostras do campo, em px de mundo.
   * `undefined` === 2. Menor = detalhe de 1 px sobrevive, cálculo mais lento.
   */
  sampleStep?: number
  /**
   * 'raster' = render fiel de minimapa: chão, contorno, linhas e portas
   * rasterizados por software com antisserrilhado por cobertura
   * (lib/minimapRaster.ts). `undefined` === 'vector' (renderers do Pixi).
   */
  renderMode?: 'vector' | 'raster'
  /** Opacidade do contorno no render fiel. `undefined` === 1. */
  strokeAlpha?: number
  /** Opacidade das linhas no render fiel. `undefined` === 1. */
  lineAlpha?: number
}

/**
 * Traço de mapa estilo minimapa (contorno de prédio, divisória), contínuo ou
 * pontilhado. Só visual — não bloqueia movimento nem luz (isso é `Wall`).
 * Vértices em px de mundo; vértice em (x + 0.5, y + 0.5) cai no centro do pixel.
 */
export interface MapLine {
  id: string
  points: { x: number; y: number }[]
  closed: boolean
  dotted: boolean
  color: string
  /** Espessura em px de mundo. */
  width: number
  /** Pontilhado: distância entre centros de pontos, em px ao longo do caminho. `undefined` === 2. */
  dotPeriod?: number
  /** Pontilhado: comprimento de cada ponto, em px. `undefined` === 1. */
  dotLength?: number
  /**
   * Pontilhado com ponto em caixa ALINHADA À TELA (largura × altura), igual em
   * linha horizontal e vertical — é o que os mapas de referência fazem (Mapa3:
   * ~1,85 × 1,42 px). Com os dois definidos, `dotLength` e `width` são ignorados.
   */
  dotWidth?: number
  dotHeight?: number
}

/** Marcador sólido girado (porta de minimapa). Só visual. */
export interface MapMarker {
  id: string
  cx: number
  cy: number
  w: number
  h: number
  /** Graus, sentido horário. */
  rotation: number
  color: string
  /** 'ellipse' = poço/decoração redonda com eixos `w` × `h`. `undefined` === 'rect'. */
  shape?: 'rect' | 'ellipse'
}

/** Moldura com título lateral em volta do retângulo `x, y, w, h` do mundo (ver lib/mapFrame.ts). */
export interface MapFrame {
  title: string
  /** Fonte do título ajustada à referência (pixi/frameTitle.ts). `undefined` = fonte padrão escalada. */
  titleFont?: { family: string; size: number; weight: 'normal' | 'bold' }
  x: number
  y: number
  w: number
  h: number
}

export interface FogState {
  mode: 'per-token' | 'none'
  revealed: string[]
}

export interface MapBackground {
  type: 'image' | 'color'
  src: string
}

/** 'triangle' (F3, dívida "grid-triangular"): matemática em pixi/triGrid.ts.
 *  Render/snap/medição ainda não ligados no PixiCanvas — ver contrato do
 *  agente C6. Nenhum consumidor existente faz switch exaustivo sobre este
 *  tipo (confirmado por rg antes de acrescentar 'triangle'), então a adição
 *  não quebra nenhum arquivo fora desta fase. */
export type GridShape = 'square' | 'hex' | 'triangle'

/** Valores default = cópia literal do que drawGrid.ts:4 / drawHexGrid.ts:4
 *  hardcodam hoje, para que mapa antigo abra visualmente idêntico. */
export interface GridSettings {
  color: string
  opacity: number
  lineWidth: number
  lineStyle: 'solid' | 'dashed' | 'dotted'
}

export interface MapScale {
  unitsPerCell: number // 5 (ft) ou 1.5 (m)
  unit: string // texto livre, sem enum
  precision: number // casas decimais no rótulo
}

/** 'hex' só é válido com gridShape 'hex'; os outros 4, com 'square'.
 *  'euclidean' vale nos dois. setGridShape reseta o modo. */
export type MeasurementMode =
  | 'chessboard' // D&D 5e: max(dx,dy)
  | 'alternating' // 3.5e 5-10-5
  | 'euclidean'
  | 'manhattan'
  | 'hex'

export interface MapData {
  id: string
  name: string
  width: number
  height: number
  grid: number
  /** Deslocamento da linha "0,0" da grade em relação à origem da imagem de
   *  fundo, em px de mundo (F3, "alinhar grade à imagem" — lib/gridAlign.ts).
   *  `undefined` === {x:0, y:0} (aparência idêntica à de hoje) — sem linha de
   *  migração, mesmo padrão de wallKind/locked/hidden acima. */
  gridOffset?: { x: number; y: number }
  gridShape: GridShape
  showGrid: boolean
  gridSettings: GridSettings
  background: MapBackground
  walls: Wall[]
  lights: Light[]
  regions: Region[]
  tokens: Token[]
  props: Prop[]
  stairs: Stair[]
  drawings: Drawing[]
  /** Chão por peças. Vazio em mapa antigo — migração em `lib/mapFile.ts`. */
  floor: FloorPiece[]
  floorStyle: FloorStyle
  lines: MapLine[]
  markers: MapMarker[]
  /** A5 — zonas ocultas do mestre. Vazio em mapa antigo — migração em `lib/mapFile.ts`. */
  concealZones: ConcealZone[]
  /** Pontos de interesse ("!" e "?"). Vazio em mapa antigo — migração em `lib/mapFile.ts`. */
  pins: Pin[]
  frame: MapFrame | null
  fog: FogState
  hiddenLayers: LayerId[] // vazio = tudo visível
  /** Onda 4, Frente D (camadas) — "travar camada inteira": item na camada
   *  listada aqui continua VISÍVEL (independente de hiddenLayers) mas não
   *  pode ser selecionado nem movido. Mesma forma de hiddenLayers, por
   *  pedido explícito do CONTRATO da frente — ver lib/layers.ts
   *  (isLayerLocked/canInteractInLayer). Vazio = nada travado. */
  lockedLayers: LayerId[]
  scale: MapScale
  measurementMode: MeasurementMode
  ownerId: string | null
  scenarioLink: string | null
}
