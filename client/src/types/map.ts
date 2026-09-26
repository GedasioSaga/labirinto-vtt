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

export interface Wall extends NoPiso {
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
  /**
   * JANELA — deixa a VISÃO passar e continua barrando o PASSO (`blocksMove`
   * vale como sempre). Desenhada como traço duplo fino (`pixi/drawWalls.ts`).
   * Só vale em parede SEM porta: porta tem as regras dela. Numa construção com
   * teto, quem está junto da janela recebe só o interior que o olhar alcança
   * (`lib/fogFilter.ts`). `undefined` === parede comum, sem linha de migração
   * (`lib/mapFile.ts` copia a parede inteira).
   */
  janela?: boolean
}

/**
 * 3 tipos estruturais. Cada um muda render + comprimento do vão; a GRADE
 * ('gate') também deixa a visão passar fechada ou trancada — são barras, não
 * tábuas (`lib/visibility.ts`). O passo ela barra como qualquer porta fechada.
 */
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
  /**
   * ESTADO DO MUNDO — a porta obedece a um estado da aventura ("Maré"). Trocar
   * o valor grava o efeito em `open`/`locked` (`lib/estadoDoMundo.ts`); o resto
   * do app lê só esses dois. NUNCA sai no recorte do jogador (`lib/fogFilter.ts`).
   * Ausente = porta de sempre, sem migração.
   */
  porEstado?: RegraDeEstado<EfeitoNaPorta>
  /** CHAVE ABRE PORTA: nome do item da mochila que destranca e abre esta
   *  porta sem pedir ao mestre (`lib/doorKey.ts`). Só do mestre: o jogador
   *  nunca o recebe (`lib/fogFilter.ts`). `undefined` = só o mestre abre. */
  abreCom?: string
  /**
   * PORTA DE UM LADO — só o jogador com a ficha DESTE lado da parede abre a
   * porta; do outro lado o host recusa com `wrong_side` ("Não abre deste
   * lado"). Fechar vale dos dois lados: a regra é para abrir. O lado é
   * relativo ao sentido da parede, `lib/doorReach.ts:sideOfWall`. Regra do
   * mestre: nunca chega ao jogador (`lib/fogFilter.ts`), e o editor mostra uma
   * seta no lado que abre (`pixi/drawDoors.ts`). `undefined` === abre dos dois
   * lados (mapa salvo antes), sem linha de migração; do disco só
   * 'left'/'right' voltam (`lib/mapFile.ts`).
   */
  opensFrom?: DoorSide
}

/**
 * Lado de uma parede para quem anda de (x1,y1) até (x2,y2) na tela (y cresce
 * para baixo): 'right' é a mão direita de quem anda, 'left' a esquerda.
 */
export type DoorSide = 'left' | 'right'

/**
 * ESTADO DO MUNDO — "depende de": o efeito deste elemento para cada valor de um
 * estado da aventura (`Adventure.estados`). Valor sem entrada = o elemento não
 * muda. Lista, e não objeto: o valor é texto do mestre, e `efeitos["constructor"]`
 * num objeto leria o protótipo.
 */
export interface RegraDeEstado<E extends string> {
  estadoId: string
  efeitos: EfeitoDeEstado<E>[]
}

export interface EfeitoDeEstado<E extends string> {
  valor: string
  efeito: E
}

export type EfeitoNaPorta = 'aberta' | 'fechada' | 'trancada'
export type EfeitoNaZona = 'oculta' | 'revelada'
export type EfeitoNaLuz = 'acesa' | 'apagada'

export interface Light extends NoPiso {
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
  /** "Vista de longe" (lampião, janela acesa, farol): com linha de visão livre
   *  até ela, o jogador recebe a luz mesmo FORA do raio — só como ponto aceso,
   *  com raio 0 e sem a ficha que a carrega (`lib/fogFilter.ts`), nunca o que
   *  ela ilumina. `undefined` === false (comportamento de antes), sem migração. */
  vistaDeLonge?: boolean
  /**
   * ESTADO DO MUNDO — luz apagada ("energia desligada", apagão): o mestre vê
   * só o marcador vazado, sem halo, e o jogador não recebe a luz. `undefined`
   * === acesa (comportamento de antes) — sem linha de migração.
   */
  apagada?: boolean
  /**
   * ESTADO DO MUNDO — `apagada` obedece a um estado da aventura. Trocar o
   * valor grava o efeito em `apagada`. NUNCA sai no recorte do jogador
   * (`lib/fogFilter.ts`, lista do que vai). Ausente = luz de sempre.
   */
  porEstado?: RegraDeEstado<EfeitoNaLuz>
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
   * CÔMODO LEMBRADO — "Cômodo: aparece só depois de visto". O jogador NÃO
   * recebe a Sala (nem silhueta, nem nome, nem pino, desenho ou escada de
   * dentro) até vê-la: com a ficha estritamente dentro, ou olhando para dentro
   * dela (pela porta aberta). A partir daí ela é LEMBRADA por ele — a Sala
   * inteira, não só o pedaço que a linha de visão alcançou: a névoa levanta no
   * cômodo todo (desenhado mais apagado, como todo explorado) e os pinos de lá
   * continuam tocáveis depois que ele sai. Ficha, luz e objeto continuam
   * exigindo visão ATUAL: lembrar do quarto não é espiar quem está nele agora.
   * Quem decide e lembra é `lib/fogFilter.ts` + `net/hostSession.ts`.
   *
   * O teto de prédio (`roof`) VENCE: Sala com os dois se comporta como teto
   * (`lib/roomOps.ts` → `roomIsComodo`), e o painel nunca deixa os dois
   * ligados (`lib/mapFactory.ts`). O prédio de teto por fora e os cômodos
   * lembrados por dentro convivem.
   *
   * `undefined` === false (a Sala de hoje) — sem linha de migração: mapa
   * salvo antes do campo abre igual.
   */
  comodo?: boolean
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
  /** SALA ESCURA — dentro do polígono o jogador só vê a casa em volta da
   *  ficha e o que uma Luz ilumina (`lib/darkness.ts`, aplicado em
   *  `lib/fogFilter.ts`). Regra do mestre: não sai no recorte do jogador.
   *  `undefined` === false (sala clara, como sempre) — sem linha de migração;
   *  só `true` escurece, valor torto vindo do disco não. */
  dark?: boolean
  /**
   * FACÇÃO — quem manda nesta sala ou distrito (`lib/faccoes.ts`). Sala sem
   * facção dentro de outra (`Region.parentId`) herda a da sala de fora. Pinta
   * o filtro "Quem manda aqui" do editor. NUNCA sai no recorte do jogador
   * (`lib/fogFilter.ts`). `undefined` === ninguém manda, sem migração.
   */
  faccao?: string
  /**
   * "Raio de visão aqui", em px de mundo: enquanto a ficha de um jogador está
   * dentro desta Sala, ele vence o raio do jogador — maior num mirante, menor
   * num caracol. Vale a Sala mais de dentro que tiver o campo; Sala secreta ou
   * oculta não conta. O número não sai para o jogador (`lib/fogFilter.ts`).
   * `undefined` (ou valor que não é número positivo) === raio do jogador.
   */
  raioDeVisao?: number
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
 * PISOS NA MESMA CENA — o piso em que a entidade está (inteiro). `undefined`
 * === 0, o térreo: mapa salvo antes deste campo abre com um piso só, idêntico,
 * sem linha de migração. O jogador recebe só o piso da ficha dele
 * (`lib/pisos.ts`, `lib/fogFilter.ts`); valor torto do arquivo sai na leitura
 * (`pisosDoArquivo`). Plano em `docs/planos/pisos-na-mesma-cena.md`.
 */
export interface NoPiso {
  piso?: number
}

/**
 * "!" (aqui tem algo), "?" (investigue aqui), o pino de VIAGEM (a passagem
 * que leva de uma cena da aventura para outra) e a ALAVANCA (abre ou fecha a
 * porta ligada em `Pin.portaLigada`). Os dois últimos são aditivos — pino
 * gravado antes deles continua sendo "!" ou "?".
 */
export type PinKind = 'exclamacao' | 'interrogacao' | 'viagem' | 'alavanca'

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
 * - `trancada`: ninguém passa sozinho; o jogador pode pedir ao mestre, que
 *   libera ou não (a menos que o pino seja `mudo`: aí nada chega);
 * - `passe`: crachá, catraca — a ficha com o passe (`Pin.passe`) passa
 *   sozinha, e a sem passe gera o pedido "sem passe" ao mestre. Deixar uma
 *   passar não muda o modo: a catraca continua fechada para as outras.
 * Cada pino do par tem o seu: a porta pode ser livre para ir e trancada para
 * voltar.
 */
export type PinPassage = 'pede' | 'livre' | 'trancada' | 'passe'

/**
 * O que abre um pino no modo `passe`: um ITEM na mochila da ficha (pelo nome,
 * sem ligar para maiúscula e acento — "Crachá") e/ou a MARCA do mestre, as
 * fichas que ele deixou passar por id. Os dois ausentes = ninguém tem passe.
 * NUNCA sai no recorte do jogador (`lib/fogFilter.ts`): diria o que abre a
 * catraca e quem já pode passar.
 */
export interface PinPass {
  /** Nome do item que abre. `undefined` === o passe não pede item. */
  item?: string
  /** Ids das fichas marcadas. `undefined` === nenhuma marcada — sem linha de
   *  migração: quem lê do disco é `readPinPass` (`lib/pinPass.ts`), que
   *  confere `item` e `fichas` juntos. */
  fichas?: string[]
}

/**
 * POR QUE a passagem trancada não deixa passar. A AUSÊNCIA é "Está trancada"
 * (a chave, o de sempre); os outros dizem ao jogador que não é questão de
 * achar a chave. Lista curta de propósito: texto livre do mestre seria mais
 * um lugar para escapar o que ele não quer contar.
 */
export type PinBlockReason = 'desabou' | 'alagada' | 'em-chamas' | 'sem-energia'

/**
 * CABINE DE TRANSPORTE, como a PARADA a diz ao jogador: a cabine está `aqui`;
 * está aqui mas `ocupada` (alguém embarcou e espera o mestre); não está e
 * esta parada já a `chamada`; ou está `longe` — nunca qual cabine é, em que
 * parada ela está nem quem está dentro. A cabine mora na aventura (`lib/cabine.ts`).
 */
export type CabineNaParada = 'aqui' | 'ocupada' | 'longe' | 'chamada'

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
 * ITEM PEGÁVEL: o pino é uma coisa que o jogador pode pegar ("Chave do
 * Escudo"). `nome` é o que vai para a mochila; `livre` pega sem pedir ao
 * mestre. Ausente (e `livre` ausente) é o de sempre — pino que só se lê, e
 * "pede ao mestre" —, sem migração: mapa salvo antes do campo abre igual.
 */
export interface PinItem {
  nome: string
  livre?: true
}

/**
 * Um item na mochila da ficha. `id` é o id do pino de onde ele saiu — único
 * no mapa, e a ficha que viaja entre cenas leva a mochila junto.
 */
export interface CarriedItem {
  id: string
  nome: string
}

/**
 * FECHADURA COM SEGREDO — como o jogador entra com a combinação no cartão:
 * `teclado` (digita, aceita letras) ou `volantes` (gira uma rodinha de 0 a 9
 * por casa).
 */
export type PinLockForm = 'teclado' | 'volantes'

/**
 * A fechadura como o MESTRE a grava. Mora só no mapa do mestre: o recorte do
 * jogador (`lib/fogFilter.ts`) nunca a copia, e quem confere a tentativa é o
 * host (`net/hostSession.ts`). Ver `lib/pinLock.ts`.
 */
export interface PinLock {
  /** A combinação. Conferida sem espaço, traço, ponto, barra nem caixa (`normalizeLockAnswer`). */
  resposta: string
  forma: PinLockForm
  /** Um jogador acertou. Ausente = fechada, sem linha de migração; do disco só `true` volta (`readPinLock`). */
  aberta?: true
  /** Id da parede-porta DESTA cena que acertar destranca junto (não abre: só destranca). Ausente = nenhuma, sem linha de migração. */
  abrePorta?: string
}

/**
 * O que o JOGADOR sabe da fechadura fechada: a forma e, SÓ nos volantes,
 * quantas casas ela tem — o que qualquer um vê olhando um cadeado de volantes.
 * O teclado não mostra o tamanho da senha, então ele nem viaja. Nunca a
 * resposta nem a porta ligada. Montado por `lib/fogFilter.ts`; o mestre nunca grava.
 */
export type PinLockPublic = { forma: 'teclado' } | { forma: 'volantes'; casas: number }

/**
 * COLEÇÃO DE PISTAS — o pino é a peça `parte` de `total` da coleção `nome`
 * ("Letreiro", peça 5 de 12). Mora só no mapa do mestre: o recorte do jogador
 * (`lib/fogFilter.ts`) nunca a copia. Quem lê o cartão ganha a peça, e o host
 * (`net/hostSession.ts`) manda ao jogador só o nome, o total e as peças que
 * ELE tem; `inteira` só vai com todas juntas. Ver `lib/colecao.ts`.
 */
export interface PinColecao {
  nome: string
  /** Número desta peça, de 1 a `total`. */
  parte: number
  total: number
  /**
   * A frase ou o item inteiro, lido por quem juntar todas. Ausente = só a
   * contagem, sem linha de migração: quem confere a forma do disco é
   * `readPinColecao` (`lib/colecao.ts`), chamada por `lib/mapFile.ts`.
   */
  inteira?: string
}

/**
 * Ponto de interesse cravado pelo mestre. O jogador toca o pino no mapa e lê o
 * cartão: imagem em cima, descrição embaixo.
 *
 * `image` guarda a imagem EM DATA URL (`data:image/...;base64,...`), nunca um
 * caminho do disco — é a única forma de o cartão chegar ao jogador sem abrir o
 * computador do mestre (o recorte de `lib/fogFilter.ts` recusa qualquer valor
 * que não comece em `data:image/`). `null` = cartão sem foto: o jogador vê o
 * cartão compacto, só com a cabeça do pino, o texto e os botões
 * (`player/PlayerPinCard.tsx`).
 */
export interface Pin extends PlayerSecret, NoPiso {
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
   * NOME SÓ DO MESTRE ("Faca"): o que distingue sete "?" iguais no editor —
   * desenhado ao lado do pino e na lista "Pinos". NUNCA sai no recorte do
   * jogador (`lib/fogFilter.ts` monta o pino dele por lista do que vai), que lê
   * só a descrição. Ausente = sem nome, o pino de sempre — sem migração. O
   * disco só aceita texto não vazio, aparado e com até `PIN_NOME_MAX_LENGTH`
   * letras (`lib/mapFile.ts`).
   */
  nome?: string
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
   * Só do pino de viagem TRANCADO: o mestre desligou "Aceita tentativas". Mudo,
   * o jogador lê "Está trancada" sem botão e nenhum pedido chega ao mestre.
   * Ausente = aceita: o jogador pode "Pedir ao mestre" e o mestre responde
   * "Liberar uma vez", "Passar para pede" ou "Não". Sai no recorte do jogador
   * só no pino trancado (o cartão precisa saber se oferece o botão). O disco
   * só aceita `true` (`lib/mapFile.ts`).
   */
  mudo?: true
  /**
   * Só do pino de viagem trancado: o motivo ("Desabou", "Alagada"...).
   * Ausente = "Está trancada", o de sempre — sem migração. Fica gravado se o
   * mestre reabrir o pino (volta junto quando ele tranca de novo), mas só SAI
   * no recorte do jogador enquanto a passagem é `trancada` (`lib/fogFilter.ts`).
   */
  motivo?: PinBlockReason
  /**
   * Só do pino de viagem no modo `passe`: o item e as fichas que passam sem
   * pedir. Ausente = ninguém tem passe (todo pedido vai ao mestre como "sem
   * passe"). Sem migração: mapa salvo antes do campo abre igual. Ao contrário
   * de `passagem`, NUNCA sai no recorte do jogador.
   */
  passe?: PinPass
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
   * Só do pino de viagem: o pino é a PASSAGEM de uma escada — o "Leva a…" da
   * escada `escadaId` desta cena (`lib/stairTravel.ts`). Não se desenha nem
   * entra em lista: o mestre vê a escada, o jogador toca a escada. Mora na
   * boca dela e anda junto quando a escada é arrastada. Ao jogador SÓ vai
   * junto com a escada (`lib/fogFilter.ts`): escada escondida, pino escondido.
   * Ausente = o pino de sempre, sem migração.
   */
  escadaId?: string
  /**
   * PINO PRESO A UMA FICHA (navio, carroça, elevador): o id da ficha DESTA
   * cena que o pino acompanha. Quando a ficha anda, o pino anda o mesmo tanto
   * (`lib/pinAttach.ts`, chamado de `setTokenPosition` e `moveAreaSelection`),
   * e a viagem por ele segue valendo, do lugar novo. Ausente = pino parado, o
   * de sempre — sem migração. Ficha que saiu da cena deixa o pino onde está.
   *
   * NUNCA sai no recorte do jogador (`lib/fogFilter.ts`), e o pino preso só
   * sai quando a ficha dele também sai: preso, o pino conta onde a ficha está,
   * então segue a visão da ficha, não a memória do explorado.
   */
  presoA?: string
  /**
   * MARCO ("todos veem"): o pino chega ao jogador mesmo na névoa, sem ele ter
   * visto ou explorado o lugar — o Templo que a cidade inteira conhece. Só o
   * pino atravessa: o que está em volta continua preto. Não fura nada que o
   * mestre esconde (oculto, zona oculta, sala secreta, teto, "Só estes").
   * Ausente = o pino de sempre, que só aparece à vista ou explorado. O disco
   * só aceita `true` (`lib/mapFile.ts`); o campo não vai ao jogador.
   */
  marco?: true
  /**
   * LER SÓ DE PERTO: a quantas casas uma ficha do jogador precisa estar (e
   * enxergando o pino) para o texto e a imagem entrarem no pacote. Longe, o
   * jogador recebe o pino com `longe` e sem descrição — nem o "Revelar planta"
   * entrega o que está escrito (`lib/fogFilter.ts`). Inteiro de
   * `PIN_LER_DE_PERTO_MIN` a `PIN_LER_DE_PERTO_MAX`; ausente = lê de onde vir o
   * pino, como sempre. O campo não vai ao jogador.
   */
  lerDePerto?: number
  /**
   * SÓ NO RECORTE DO JOGADOR: o pino é "só de perto" e a ficha dele está
   * longe, então a descrição e a imagem ficaram no host. O cartão diz "Chegue
   * mais perto para ler". O mestre nunca grava este campo.
   */
  longe?: true
  /**
   * SÓ NO RECORTE DO JOGADOR: o pino chegou SÓ por ser marco — não está à
   * vista nem explorado. Ver o Templo de longe não é estar lá: a passagem não
   * vale daqui (o host recusa em `validTravel`) e o cartão não oferece o
   * botão. O mestre nunca grava este campo.
   */
  soMarco?: true
  /**
   * SÓ NO RECORTE DO JOGADOR, e só quando o pino tem mais de uma saída: o id e
   * o rótulo de cada uma, na ordem (a principal primeiro). O mestre nunca grava
   * este campo; `lib/fogFilter.ts` o monta a partir de `rotulo` e `saidas`.
   */
  escolhas?: PinExitLabel[]
  /**
   * ITEM PEGÁVEL (pino "!"/"?", nunca o de viagem): o que o jogador pega com
   * "Pegar". Pego, o pino sai do mapa e o item vai à mochila da ficha dele.
   * Ausente = pino que só se lê. Sai no recorte do jogador (o cartão precisa
   * do nome e de saber se pede ao mestre), sempre numa cópia limpa.
   */
  item?: PinItem
  /**
   * SÓ NO RECORTE DO JOGADOR, e só no pino de viagem que é parada de uma
   * cabine (elevador, cesto): se a cabine está nele. O mestre nunca grava este
   * campo (a cabine mora na aventura); o host o monta a cada envio
   * (`comCabineParaJogador`, `lib/fogFilter.ts`) e `lib/mapFile.ts` o apaga
   * de um arquivo que o traga.
   */
  cabine?: CabineNaParada
  /**
   * ESTADO DO MUNDO — a `passagem` do pino obedece a um estado da aventura.
   * Trocar o valor grava o efeito em `passagem`. NUNCA sai no recorte do
   * jogador (`pinForPlayer` é lista do que vai). Ausente = pino de sempre.
   */
  porEstado?: RegraDeEstado<PinPassage>
  /**
   * CHAVE ABRE PORTA, no pino de viagem TRANCADO: o nome do item da mochila
   * que deixa quem o carrega passar sem pedir ao mestre (`lib/doorKey.ts`).
   * Só do mestre: NUNCA sai no recorte do jogador (`lib/fogFilter.ts`).
   * Ausente = trancado para todos, como sempre. Só vale com `passagem: 'trancada'`.
   */
  abreCom?: string
  /**
   * SÓ NO RECORTE DO JOGADOR: o nome da chave que ELE carrega numa ficha
   * encostada neste pino trancado — o cartão oferece "Usar <chave>". O mestre
   * nunca grava este campo; `lib/fogFilter.ts` o monta, e só para quem tem.
   */
  chave?: string
  /**
   * Só da ALAVANCA: o id da parede-porta DESTE mapa que ela abre ou fecha —
   * pode ser de outra sala (`lib/lever.ts`). Ausente = alavanca solta, que não
   * move nada; porta apagada depois vale o mesmo. NUNCA sai no recorte do
   * jogador (`lib/fogFilter.ts`): a porta pode estar atrás da névoa, e o id
   * dela diria que ela existe. Sem migração: mapa antigo não tem alavanca.
   */
  portaLigada?: string
  /**
   * FECHADURA COM SEGREDO, de qualquer tipo de pino. Fechada, o cartão do
   * jogador pede a combinação e o pino de viagem não deixa passar. NUNCA sai no
   * recorte do jogador. Ausente = sem fechadura, sem migração.
   */
  segredo?: PinLock
  /**
   * SÓ NO RECORTE DO JOGADOR, e só com a fechadura fechada: forma e, nos volantes, casas.
   * `lib/fogFilter.ts` o monta a partir de `segredo`; o mestre nunca o grava.
   */
  fechadura?: PinLockPublic
  /**
   * SÓ NO RECORTE DO JOGADOR, e só no pino de UMA saída: o par dela é a
   * chegada oculta (`soChegada`), então não há volta por aqui. O cartão mostra
   * "Só ida" e a pergunta avisa antes de o jogador cair. É um booleano e nada
   * mais: o destino continua fora do recorte. Quem monta é o host, que enxerga
   * a outra cena (`oneWayExitsOf` em `lib/pinTravel.ts`); o mestre nunca grava.
   * Numa encruzilhada o aviso vai por saída, em `escolhas[].soIda`.
   */
  semVolta?: true
  /**
   * COLEÇÃO DE PISTAS, de qualquer tipo de pino: esta é uma peça. NUNCA sai no
   * recorte do jogador. Ausente = pino avulso, sem migração.
   */
  colecao?: PinColecao
  /**
   * LOJA COM PREÇOS (pino "!"/"?", nunca o de viagem nem a alavanca): as
   * mercadorias da banca, na ordem do mestre. O jogador vê a lista no cartão e
   * toca "Quero", que vira pedido ao mestre (`net/hostSession.ts`). Sai no
   * recorte só como `lib/loja.ts` a monta (lista do que vai). Ausente = sem
   * loja, sem migração.
   */
  loja?: LojaItem[]
}

/**
 * Uma mercadoria da banca. `preco` é texto livre, com a moeda da aventura
 * ("1 moeda", "uma vela"). `estoque`: quantas restam; ausente = sem conta
 * (não acaba), 0 = acabou. "Vender" tira um (`lib/loja.ts`).
 */
export interface LojaItem {
  id: string
  nome: string
  preco: string
  /**
   * Ausente = sem conta, sem linha de migração: a loja inteira é lida item a
   * item por `lerLojaDoArquivo` (`lib/loja.ts`), que deixa o estoque torto ausente.
   */
  estoque?: number
}

/**
 * A5 — área desenhada pelo mestre que o jogador não vê: tudo que tem ponto
 * amostrado dentro dela fica fora do recorte e o jogador pinta preto por cima.
 * Não bloqueia a visão (a zona esconde conteúdo, não é parede).
 */
export interface ConcealZone extends NoPiso {
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
  /**
   * ESTADO DO MUNDO — `revealed` obedece a um estado da aventura ("a galeria
   * alagada só esconde na maré alta"). A zona inteira não sai para o jogador;
   * ele recebe só o preto que sobra. Ausente = zona de sempre.
   */
  porEstado?: RegraDeEstado<EfeitoNaZona>
}

/**
 * ZONA DE PERIGO — o que toma a sala numa catástrofe. Lista curta e fechada:
 * é o que o mestre marca no meio da cena, não campo livre. Rótulos, cores e a
 * regra de cada um moram em `lib/hazards.ts`.
 */
export type HazardKind = 'fogo' | 'fumaca' | 'vapor' | 'agua'

/**
 * Zona de perigo pintada pelo mestre: um conjunto de SALAS (`Region` com
 * `room`) tomadas pelo mesmo perigo. Avança um passo pelas portas ABERTAS
 * (`lib/hazards.ts` → `advanceHazard`): cada sala do outro lado de uma porta
 * aberta entra na zona.
 *
 * O jogador NUNCA recebe este objeto: o recorte (`lib/fogFilter.ts`) manda só
 * o tipo e o polígono de cada sala tomada que ele enxerga agora
 * (`PlayerMapView.hazards`), e nunca o id da zona nem o das salas.
 */
export interface Hazard {
  id: string
  kind: HazardKind
  /** Ids das salas tomadas, sem repetição, na ordem em que entraram. */
  roomIds: string[]
}

/**
 * GATILHO DE ÁREA — o que a área marcada faz quando a ficha de um jogador
 * entra nela. Lista curta e fechada; rótulos e cores em `lib/areaTriggers.ts`.
 */
export type AreaTriggerKind = 'armadilha' | 'alarme'

/**
 * Área (Região ou Sala) marcada pelo mestre como gatilho. Quando a ficha de um
 * jogador ENTRA no polígono da região, o mestre recebe o aviso com o nome do
 * jogador e o da área.
 *
 * O jogador NUNCA recebe este objeto: o recorte (`lib/fogFilter.ts`) manda só
 * o tipo e o polígono do gatilho que o mestre REVELOU e cuja área o jogador já
 * conhece (`PlayerMapView.gatilhos`) — nunca o id do gatilho nem o da região.
 */
export interface AreaTrigger {
  id: string
  kind: AreaTriggerKind
  /** A região (Sala ou Área) cujo polígono é o gatilho. Uma região tem no máximo um. */
  regionId: string
  /** `true` = o mestre mostrou aos jogadores. Nasce `false`. */
  revealed: boolean
}

export interface Region extends PlayerSecret, NoPiso {
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

/**
 * Vida da ficha — é o que desenha a barra fina SOB ela no mapa ("ninguém sabe
 * quanto falta para o monstro cair sem o mestre narrar"). Regras de leitura,
 * de gravação e do recorte do jogador em `lib/tokenHealth.ts`.
 */
export interface TokenHealth {
  /** Pontos de vida agora, de 0 a `max`. */
  current: number
  /** Pontos de vida cheios, 1 ou mais. */
  max: number
  /**
   * Os JOGADORES veem a barra desta ficha. `false` (o padrão) = só o mestre:
   * a vida inteira fica fora do recorte do jogador (`lib/fogFilter.ts`). Com
   * `true` o jogador recebe a PROPORÇÃO, nunca os pontos (`healthForPlayer`).
   */
  shownToPlayers: boolean
}

/**
 * Condição de mesa marcada NA FICHA pelo mestre. Lista curta e fechada de
 * propósito — é o que se marca no meio da luta com um clique, não um campo
 * livre. Rótulos, pastilhas e a ordem moram em `lib/tokenConditions.ts`.
 */
export type TokenCondition = 'envenenado' | 'caido' | 'dormindo' | 'atordoado' | 'invisivel'

/**
 * OLHOS DO GUARDA — o campo de visão de uma ficha de NPC. É do MESTRE: nunca
 * atravessa para o jogador (`lib/fogFilter.ts`). Regras de leitura, do cone e
 * da marca de alerta em `lib/npcWatch.ts`.
 */
export interface TokenWatch {
  /** Para onde o guarda olha, em graus no sentido horário da tela, 0 = leste (mesma convenção de `rotation`). */
  direcao: number
  /** Abertura do olhar em graus, de 15 a 360 (360 = vê em volta). */
  abertura: number
  /** Até onde ele enxerga, em quadrados da grade. */
  alcance: number
}

/**
 * VEÍCULO COM LUGARES (cesto, bote, vagonete): a ficha leva até `lugares`
 * outras fichas da mesma cena. Quem está a bordo anda junto com ela e
 * atravessa o pino junto (`lib/vehicle.ts`).
 */
export interface TokenVehicle {
  /** Quantas fichas cabem, de 1 a `VEHICLE_SEATS_MAX`. */
  lugares: number
  /** Ids das fichas a bordo, na ordem em que embarcaram. Ausente = vazio,
   *  sem linha de migração: quem lê do disco é `readTokenVehicle`. */
  passageiros?: string[]
}

/**
 * Marca de alerta do guarda que o JOGADOR recebe: "?" desconfia (viu alguém
 * na borda do olhar), "!" viu. Montada pelo recorte, nunca gravada no mapa.
 */
export type WatchAlert = '?' | '!'

/**
 * ROTA DE PATRULHA — os pontos por onde um NPC ronda. É do MESTRE: nunca
 * atravessa para o jogador (`lib/fogFilter.ts`), que só vê a ficha andar
 * quando ela está na visão dele. Regras em `lib/npcPatrol.ts`.
 */
export interface TokenPatrol {
  /** Os pontos da rota, em px do mapa, na ordem em que o NPC anda. Do último volta ao primeiro. */
  pontos: RegionPoint[]
  /** Índice do ponto onde o NPC está (o último alcançado). "Avançar patrulha" vai ao seguinte. */
  atual: number
}

/**
 * Ficha no mapa. Sai para o jogador por LISTA BRANCA (`tokenForPlayer` em
 * `lib/fogFilter.ts`): campo novo aqui fica com o mestre até entrar lá.
 */
export interface Token extends PlayerSecret, NoPiso {
  id: string
  characterId: string | null
  name: string
  x: number
  y: number
  size: number
  /** `undefined`/`null` === ficha sem barra de vida (aparência idêntica à de
   *  antes deste campo) — sem linha de migração, mesmo padrão de
   *  `rotation`/`color`. Mapa do disco chega cru: quem lê passa por
   *  `readTokenHealth` (`lib/tokenHealth.ts`). */
  health?: TokenHealth | null
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
  /**
   * Condições marcadas pelo mestre (envenenado, caído...), desenhadas como
   * pastilhas em cima da ficha no editor e na tela de quem joga.
   * Ausente é nenhuma condição — sem linha de migração, mesmo padrão de
   * `color`/`rotation`: mapa salvo antes deste campo abre idêntico, e
   * desmarcar a última apaga o campo em vez de gravar `[]`.
   *
   * O mapa do disco chega CRU (`lib/mapFile.ts`), então quem lê passa por
   * `tokenConditionsOf`, que joga fora o que não é da lista. ATRAVESSA para o
   * jogador junto com a ficha — e só quando a ficha atravessa
   * (`lib/fogFilter.ts`), com os ids da lista e nada mais.
   */
  conditions?: TokenCondition[]
  /**
   * OLHOS DO GUARDA: a ficha é um NPC que vigia (`lib/npcWatch.ts`). Ausente
   * ou `null` = ficha comum, sem linha de migração. O mapa do disco chega
   * CRU: quem lê passa por `readTokenWatch`. NÃO atravessa para o jogador.
   */
  vigia?: TokenWatch | null
  /**
   * Só no RECORTE do jogador: a marca do guarda que ele enxerga
   * (`tokenForPlayer` em `lib/fogFilter.ts`). O que estiver gravado aqui no mapa do mestre é
   * jogado fora pelo recorte.
   */
  alerta?: WatchAlert
  /**
   * ROTA DE PATRULHA do NPC (`lib/npcPatrol.ts`). Ausente = ficha sem rota,
   * sem linha de migração. O mapa do disco chega CRU: quem lê passa por
   * `readTokenPatrol`. NÃO atravessa para o jogador.
   */
  patrulha?: TokenPatrol
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
  /** MOCHILA: itens que a ficha carrega (ITEM PEGÁVEL). Gravada com a cena,
   *  viaja com a ficha. `undefined` === vazia, sem migração. O jogador só
   *  recebe a mochila da PRÓPRIA ficha (`lib/fogFilter.ts`). */
  mochila?: CarriedItem[]
  /** AJUDANTE CONTRATADO — o acordo como o jogador que SEGURA a ficha
   *  emprestada o lê. Campo de FIO, nunca do arquivo: o acordo mora na sessão
   *  do host junto da posse (`net/hostSession.ts`), o recorte põe este campo só
   *  na ficha emprestada que vai a quem a segura (`lib/fogFilter.ts`) e
   *  `deserializeMap` o descarta se um arquivo trouxer. */
  contrato?: TokenContract
  /** NPC EMPRESTADO — a ficha de NPC do mestre (`npc`) que o jogador segura
   *  sem acordo (dada pelo "Atribuir"): anda e dá visão, mas nome e foto são
   *  do mestre. Campo de FIO, nunca do arquivo: o recorte põe `true` só na
   *  ficha que vai a quem a segura (`lib/fogFilter.ts`), apaga o que vier do
   *  mapa do mestre, e `deserializeMap` o descarta se um arquivo trouxer. */
  emprestada?: boolean
  /** ROTINA DO NPC: onde a ficha fica em cada valor de um ESTADO DO MUNDO
   *  ("Apito: Aurora, Meio, Brasa"). Trocar o estado leva a ficha ao posto,
   *  inclusive para outra cena (`lib/rotinaDoNpc.ts`). Do mestre: NÃO atravessa
   *  para jogador nenhum, nem para quem segura a ficha (`lib/fogFilter.ts`).
   *  `undefined` = sem rotina — mapa salvo antes deste campo abre igual. */
  rotina?: RotinaDoNpc
  /**
   * LEVAR FICHA JUNTO: id da ficha que LEVA esta (o ferido carregado, o NPC
   * escoltado). Ela anda junto no arrasto e atravessa o pino de viagem junto.
   * Ausente/`null` = ficha solta, sem linha de migração. Quem leva não pode
   * ser levado (sem cadeia). O mapa do disco chega CRU: quem lê passa por
   * `lib/carry.ts`. NÃO atravessa para o jogador (`lib/fogFilter.ts`).
   */
  levadoPor?: string | null
  /** "Ficha de jogador": quem entra na sala sem personagem pode pedir esta
   *  ficha enquanto ela não tiver dono. `undefined` === false (ficha de NPC,
   *  fora da lista) — sem linha de migração. Marca opt-in de propósito: a
   *  lista vai a quem ainda não tem visão nenhuma, então só o que o mestre
   *  oferece entra nela (`claimableTokensForPlayer`, `lib/fogFilter.ts`).
   *  NÃO viaja no mapa do jogador: é metadado do mestre. */
  playerCharacter?: boolean
  /** MARCA DE COMPANHEIRO: a ficha é de OUTRO jogador da mesa. Só o recorte do
   *  jogador escreve este campo (`lib/fogFilter.ts`), e só em ficha que ele já
   *  recebe; o mapa do mestre nunca o guarda (o recorte apaga o que vier dele).
   *  Ausente = NPC ou a própria ficha. */
  companion?: TokenCompanion
  /**
   * VEÍCULO: a ficha é um cesto/bote/vagonete com lugares. Ausente = ficha
   * comum, sem linha de migração. O mapa do disco passa por `readTokenVehicle`
   * (`lib/mapFile.ts`). NÃO atravessa para o jogador: a lista de passageiros
   * entregaria ficha que a névoa ou o mestre escondem (`lib/fogFilter.ts`).
   */
  veiculo?: TokenVehicle
}

/** Quem joga com a ficha: nome do jogador e a cor de sinal dele (`#rrggbb`, `lib/signals.ts`). */
export interface TokenCompanion {
  name: string
  color: string
}

/** A rotina de uma ficha (`Token.rotina`): um posto por valor do estado, no máximo. */
export interface RotinaDoNpc {
  /** O estado do mundo que manda nesta rotina (`Adventure.estados`). */
  estadoId: string
  /** Valor sem posto = a ficha fica onde está quando o estado vira para ele. */
  postos: PostoDaRotina[]
}

/** Onde a ficha vai quando o estado vira para `valor`: cena da aventura e ponto em px de mundo. */
export interface PostoDaRotina {
  valor: string
  sceneId: string
  x: number
  y: number
}

/** O acordo do ajudante contratado (`Token.contrato`). */
export interface TokenContract {
  /** O que o ajudante faz, como o mestre escreveu ("levar o recado"). `''` = sem tarefa escrita. */
  tarefa: string
  /** Fim do acordo, em ms desde 1970 no relógio do MESTRE. `null` = até o mestre retomar. */
  ate: number | null
  /** `true` = o jogador vê pelos olhos do ajudante; `false` = a ficha anda, mas não enxerga por ele. */
  visao: boolean
}

export interface Prop extends PlayerSecret, NoPiso {
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
  /** MOBÍLIA DESENHADA: o objeto é um móvel do catálogo (`lib/mobilia.ts`),
   *  sem imagem (`src: ''`), desenhado como silhueta chapada com o glifo do
   *  tipo por cima, no editor e na tela do jogador. `undefined` = objeto
   *  comum de imagem (comportamento de sempre) — sem linha de migração; tipo
   *  fora do catálogo vindo do disco some na leitura (`deserializeMap`).
   *  Vai ao jogador junto do móvel que ele enxerga: o tipo É o desenho. */
  mobilia?: TipoMobilia
  /** "Rótulo para jogadores": nome curto escrito na silhueta que o jogador vê
   *  ("Guarda-roupa"). Ausente = só a silhueta, como antes deste campo — sem
   *  linha de migração. ATRAVESSA para o jogador só junto com o objeto, aparado
   *  e no teto de `lib/propPlayerLook.ts`. */
  playerLabel?: string
  /** "Mostrar imagem ao jogador": cópia pequena e AUTO-CONTIDA da imagem do
   *  objeto (`data:image/...;base64,...`), a mesma regra e o mesmo teto da foto
   *  da ficha (`lib/tokenPhoto.ts`). `src` é caminho do disco do mestre e nunca
   *  sai; esta cópia é a única imagem do objeto que atravessa o recorte.
   *  Ausente = interruptor desligado (só a silhueta). */
  playerImage?: string
}

/** Móveis do catálogo da mobília desenhada (`lib/mobilia.ts`). */
export type TipoMobilia = 'catre' | 'mesa' | 'bau'

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
export type Drawing = PlayerSecret & NoPiso & (
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
 *  rodada só produz 'straight'. 'spiral' (escada em espiral) usa o PRIMEIRO
 *  lance como diâmetro de um círculo — a boca continua em `x1, y1`, agora na
 *  borda — e se desenha como círculo com raios finos (`lib/stairs.ts`,
 *  `computeSpiralPlan`). Valor novo, nunca escrito por versão anterior: mapa
 *  salvo antes abre igual, sem migração. */
export type StairShape = 'straight' | 'l' | 'double' | 'spiral'

export interface StairSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Stair extends PlayerSecret, NoPiso {
  id: string
  shape: StairShape
  direction: StairDirection
  segments: StairSegment[]
  /** Largura do lance em px de mundo. Default na criação = map.grid. */
  stepWidth: number
  /**
   * PISOS NA MESMA CENA — o outro piso a que esta escada leva. Ela liga
   * `piso` (o dela) a este, aparece nos dois e é por ela que a ficha troca de
   * piso no mesmo ponto (`lib/pisos.ts`). `undefined` = escada de enfeite,
   * como sempre foi.
   */
  levaAoPiso?: number
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
export interface FloorPiece extends NoPiso {
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
export interface MapLine extends NoPiso {
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
export interface MapMarker extends NoPiso {
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

/** Para onde a seta de giz aponta: 8 rumos (`l` = leste, `o` = oeste). */
export type MarcaRumo = 'n' | 'ne' | 'l' | 'se' | 's' | 'so' | 'o' | 'no'

/**
 * BILHETE NO LUGAR — marca que um JOGADOR deixou num ponto da cena: um
 * bilhete curto ou uma seta de giz. Fica no mapa (vai no map.json) e aparece
 * para quem já viu aquele ponto (`lib/fogFilter.ts`, mesma regra do
 * marcador). `autor` e `em` são só do mestre: o recorte do jogador leva a
 * marca sem eles (`marcaParaJogador` em `lib/marcas.ts`).
 */
export interface MarcaNoLugar {
  id: string
  tipo: 'bilhete' | 'seta'
  /** Ponto em px de mundo. */
  x: number
  y: number
  /*
   * Os quatro abaixo não têm default no arquivo: `lerMarcasDoArquivo`
   * (`lib/marcas.ts`) confere a marca campo a campo, sem linha de migração em
   * `mapFile.ts` — o campo que não é da forma certa volta ausente.
   */
  /** Só no bilhete: o recado, já limpo e dentro do teto (`MARCA_TEXTO_MAX`). `undefined` === seta. */
  texto?: string
  /** Só na seta. `undefined` === bilhete. */
  rumo?: MarcaRumo
  /** Nome, na sala, de quem deixou. Nunca vai ao jogador. `undefined` === autor desconhecido (marca gravada à mão). */
  autor?: string
  /** Quando foi deixada (ms, relógio do mestre). Nunca vai ao jogador. `undefined` === hora desconhecida. */
  em?: number
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

/**
 * Regras de movimento da CENA para as fichas dos jogadores (o mestre anda sem
 * limite). Tudo opcional: mapa salvo antes deste campo abre com movimento
 * livre, igual a sempre. Leitura segura (arquivo cru, snapshot) em
 * `lib/movementRules.ts`. Atravessa para o jogador: é regra da mesa, não
 * segredo — a tela dele precisa dela para parar a ficha no alcance.
 */
export interface MovementRules {
  /** Passo máximo por movimento, em QUADRADOS da régua da cena. `undefined` === livre,
   *  sem linha de migração: `readMovementRules` lê o objeto `movement` inteiro. */
  maxStepCells?: number
  /** `true`: uma ficha não pode parar em cima de outra ('Lugar ocupado').
   *  `undefined` === desligado, sem linha de migração (mesma leitura acima). */
  tokensOccupy?: boolean
}

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
  /**
   * BILHETE NO LUGAR — marcas deixadas pelos jogadores. `undefined` === `[]`
   * (mapa de antes do campo), sem linha de migração: mesma regra de `gridOffset`.
   */
  marcas?: MarcaNoLugar[]
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
  /** "Visão nesta cena", em quadrados: o jogador enxerga isto vezes o fator
   *  dele (lib/sceneVision.ts). `undefined` = sem valor, o raio em px de cada
   *  jogador de sempre — sem linha de migração, mesmo padrão de gridOffset. É
   *  do mestre: não sai no recorte do jogador (lib/fogFilter.ts). */
  visionCells?: number
  /** CENA ESCURA — o jogador só vê a casa em volta da ficha e o que uma Luz
   *  ilumina na linha de visão dele, mesmo além do raio (`lib/darkness.ts`).
   *  É do mestre: não sai no recorte do jogador (`lib/fogFilter.ts`).
   *  `undefined` === false (cena clara, como sempre) — sem linha de migração. */
  dark?: boolean
  /** "Rostos só de perto: N casas" — opção da CENA. Ficha que não é do
   *  jogador, além de N casas (no modo de medição do mapa) de todas as fichas
   *  dele, sai do recorte como "Vulto": sem nome, foto, cor nem marca
   *  (`lib/tokenVulto.ts`, `lib/fogFilter.ts`). Inteiro de 1 a 99;
   *  `undefined` = desligada (a cena de sempre) — sem linha de migração. */
  faceRangeCells?: number
  ownerId: string | null
  scenarioLink: string | null
  /** Passo máximo e ocupação das fichas dos jogadores. `undefined` = livre. */
  movement?: MovementRules
  /**
   * ZONAS DE PERIGO (fogo, fumaça, vapor, água). `undefined` === nenhuma —
   * sem linha de migração: mapa salvo antes do campo abre igual, e a última
   * zona apagada tira o campo em vez de gravar `[]`. Leitura segura do disco
   * em `lib/hazards.ts` → `readHazards`. NUNCA sai no recorte do jogador.
   */
  hazards?: Hazard[]
  /**
   * CONFRONTO desta cena (`lib/confronto.ts`): fila de vez e passo por vez.
   * `undefined` = sem confronto — mapa salvo antes deste campo abre igual, sem
   * linha de migração. Cada cena guarda o seu: a vez de uma nunca mexe na de
   * outra. NÃO viaja para o jogador: o recorte tira o campo, e o host manda só
   * a faixa (`PlayerConfronto`) montada com as fichas que ele pode ver.
   */
  confronto?: Confronto
  /**
   * PERIGO QUE SE ALASTRA (`lib/perigo.ts`): fogo ou água presos a Salas, que o
   * mestre faz avançar pelas portas abertas. `undefined` = sem perigo — mapa
   * salvo antes deste campo abre igual. O jogador recebe só as salas tomadas
   * que ele vê agora, um item por tipo, sem o id do mestre (`lib/fogFilter.ts`).
   */
  perigos?: Perigo[]
  /**
   * GATILHOS DE ÁREA (armadilha, alarme). `undefined` === nenhum — sem linha
   * de migração, mesmo padrão de `hazards`: o último gatilho apagado tira o
   * campo. Leitura segura do disco em `lib/areaTriggers.ts` →
   * `readAreaTriggers`. NUNCA sai no recorte do jogador.
   */
  gatilhos?: AreaTrigger[]
  /**
   * MAPA-MUNDI: nesta cena o grupo anda como UMA ficha só, a caravana, que o
   * mestre move (`lib/caravan.ts`). Só `true` vale; ausente = cena comum, sem
   * linha de migração (mesmo padrão de `movement`/`hazards`).
   */
  worldMap?: true
  /**
   * TEXTO DE CHEGADA DA CENA: o que quem chega lê uma vez, num cartão
   * (`lib/arrivalText.ts`). Ausente = sem texto, sem linha de migração (mesmo
   * padrão de `worldMap`). NUNCA sai no recorte do jogador: viaja só no
   * `scene.changed` de quem chega.
   */
  textoChegada?: string
  /**
   * RELÓGIO DA CAMPANHA: cena ao ar livre, que escurece à noite (a visão dos
   * jogadores cai — `lib/campaignClock.ts`). Só `true` vale; ausente = cena
   * interna, sem linha de migração. NUNCA sai dentro do mapa do jogador: ele
   * recebe só se está escuro, à parte (`clockForPlayer`).
   */
  externa?: true
  /**
   * MAPA POR ANDARES: esta cena é um andar de um prédio. Cenas com o mesmo
   * `predio` são andares do mesmo prédio, e o jogador ganha uma aba por andar
   * onde já esteve (`lib/buildingFloors.ts`). Ausente = cena comum, sem linha
   * de migração. NUNCA sai dentro do mapa do jogador: o rótulo viaja à parte.
   */
  andar?: SceneFloor
  /**
   * NÍVEL DE ALERTA da cena, que o mestre sobe conforme o grupo faz barulho
   * (`lib/faccoes.ts`). `undefined` === 'calmo' — sem linha de migração, e
   * voltar a calmo tira o campo. NUNCA sai no recorte do jogador.
   */
  alerta?: NivelAlerta
}

export type TipoDePerigo = 'fogo' | 'agua'

/**
 * Um perigo que se alastra sala a sala. `salas`: ids das Salas (`Region`)
 * tomadas agora. `cinzas`: só no fogo, as Salas que já queimaram — não queimam
 * de novo. O id é do mestre e nunca sai para o jogador.
 */
export interface Perigo {
  id: string
  tipo: TipoDePerigo
  salas: string[]
  /** `undefined` === nenhuma sala em cinza (água, ou fogo que ainda não avançou): sem linha de migração — quem confere o campo é `perigosFromFile`. */
  cinzas?: string[]
}

/**
 * Confronto numa cena. `fila`: ids das fichas na ordem da vez (jogadores e
 * NPCs). `vez`: índice em `fila` de quem joga agora. `passo`: casas por vez,
 * inteiro >= 1, medido na régua do mapa (`measurementMode`). `turno`: conta as
 * vezes passadas desde o começo — muda a cada "Próxima vez", e é o que zera o
 * gasto da vez no host, mesmo quando a vez volta à mesma ficha.
 */
export interface Confronto {
  fila: string[]
  vez: number
  passo: number
  turno: number
}

/** MAPA POR ANDARES: de que prédio a cena é andar, e o rótulo curto que o jogador lê na aba. */
export interface SceneFloor {
  /** Nome do prédio, do mestre: junta as cenas. Nunca vai ao jogador. */
  predio: string
  /** Rótulo da aba (1F, 2F, B1): até 4 letras e dígitos maiúsculos (`cleanFloorLabel`). */
  rotulo: string
}

/** Calmo → atento → caçada: o quanto a cena já sabe que o grupo está lá. */
export type NivelAlerta = 'calmo' | 'atento' | 'cacada'
