import type { HazardKind, MapData, RegionPoint, Token } from '../types/map'
import { moveTokenCarryingLights } from '../lib/lightAttachment'
import { HAZARD_NOTICE_TTL_MS, isHazardKind, parsePlayerHazards, type PlayerHazard } from '../lib/hazards'
import { parsePlayerAreaTriggers, type PlayerAreaTrigger } from '../lib/areaTriggers'
import { decodeExploration, type Exploration } from '../lib/exploration'
import { cleanFloorLabel } from '../lib/buildingFloors'
import { readPlayerClock, type PlayerClock } from '../lib/campaignClock'
import {
  DOOR_REQUEST_REJECTIONS,
  ITEM_GIVE_REJECTIONS,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  PLAYER_MESSAGE_MAX_BYTES,
  PIN_LEVER_REJECTIONS,
  PIN_TAKE_REJECTIONS,
  REQ_ID_MAX_LENGTH,
  TOKEN_HIDE_REJECTIONS,
  TRAVEL_REQUEST_MIN_INTERVAL_MS,
  TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS,
  isDoorRequestHow,
  type DoorRequestAnswer,
  type DoorRequestHow,
  type DoorRequestRejection,
  type DoorToggleRejection,
  type ItemGiveRejection,
  type JoinMessage,
  type PinLeverRejection,
  type PinTakeRejection,
  type PinTravelRejection,
  type PinTravelRequestMessage,
  type PlayerMessage,
  type SignalAudience,
  type TokenHideRejection,
} from '../net/protocol'
import { carriedItemsOf, cleanItemName, itemOfPin } from '../lib/items'
import { fitsTokenPhotoSend } from '../lib/tokenPhoto'
import { isPlayerSafePinImage, passageOf } from '../lib/pins'
import { MAX_ACTIVE_SIGNALS, SIGNAL_COLOR_PATTERN, SIGNAL_TTL_MS, type DestinationMark, type SignalMark } from '../lib/signals'
import {
  LASER_MAX_POINTS_PER_MESSAGE,
  LASER_SEND_INTERVAL_MS,
  LASER_TRAIL_MS,
  appendLaserPoints,
  applyRemoteLaser,
  pruneLaserTrail,
  pruneRemoteLasers,
  type LaserTrail,
  type RemoteLaser,
  type RemoteLaserUpdate,
} from '../lib/laser'
import {
  CALL_TEXT_MAX_LENGTH,
  NOTEBOOK_MAX_NOTES,
  isCallReason,
  parseCallReply,
  parseClueMessage,
  parseDestinationsMessage,
  parseDiceRolled,
  parseLaserMessage,
  parseLetterMessage,
  parseNotebook,
  parsePartyUpdate,
  parsePointActionReply,
  parseRoomText,
  parseSceneAlarm,
  parseSceneAlarmEnd,
  parseSceneNote,
  parseTravelDenyText,
  type CallRaiseMessage,
  type CallReason,
  type ClueEntry,
  type NoteEntry,
  type PartyMember,
  type PointActionReply,
  isSeatClaimState,
  parseSeatOptions,
  type SeatClaimState,
  type SeatOption,
} from '../net/protocol'
import { DICE_FEED_MAX, parseDiceRequest, type DiceRequest, type DiceRollEntry } from '../lib/dice'
import { CLUEBOOK_MAX_CLUES } from '../lib/clues'
import type { TokenMoveRejection } from '../lib/moveValidation'
import { parsePlayerConfronto, type PlayerConfronto } from '../lib/confronto'
import { hasEnterText } from '../lib/roomText'
import { isPointInsideMap, POINT_NOTICE_TTL_MS, type PointActionKind, type PointNotice } from '../lib/pointActions'
import { LETTER_TEXT_MAX_LENGTH, type LetterVia } from '../lib/correio'
import { SCENE_PUBLIC_NAME_MAX_LENGTH } from '../lib/adventure'
import { TOKEN_GLIDE_MS } from './tokenGlide'
import { parseSnapshotPlaces, type SnapshotPlaces } from '../net/protocol'
import { rememberPlace, type VisitedPlace } from './playerPlaces'
import { parseArrivalText } from '../lib/arrivalText'

/**
 * Cliente WebSocket do jogador, sem React e sem DOM: o socket e o storage são
 * injetáveis para teste. O estado é imutável — cada mudança gera um objeto novo
 * e avisa os ouvintes (encaixa em `useSyncExternalStore`).
 */

/**
 * `closed`: o mestre avisou que encerrou a sala (`room.closed`) — fim de sessão, não falha de rede.
 * `replaced`: a mesma pessoa entrou por outra aba ou aparelho (`session.replaced`) — esta aba para.
 */
export type PlayerStatus = 'connecting' | 'waiting' | 'playing' | 'kicked' | 'closed' | 'error' | 'replaced'

/** MAPA POR ANDARES: um andar onde o jogador não está agora, como ele o lembra (já decodificado). */
export interface PlayerFloorMemory {
  rotulo: string
  map: MapData
  explored: Exploration
  concealed: RegionPoint[][]
}

/** MAPA POR ANDARES: o rótulo do andar onde ele está e os outros andares conhecidos. */
export interface PlayerFloors {
  atual: string
  outros: PlayerFloorMemory[]
}

export interface PlayerState {
  status: PlayerStatus
  map?: MapData
  vision?: RegionPoint[][]
  /** O que o jogador já viu neste mapa (autoridade do mestre). */
  explored?: Exploration
  /** Ids dos tokens do próprio jogador presentes no mapa recebido. */
  ownTokens?: string[]
  /** Ids dos tokens de COLEGAS (outros jogadores) no mapa recebido: o "Dar a…" só oferece estes. */
  partyTokens?: string[]
  /** Polígonos das zonas ocultas ativas: o jogador pinta preto por cima. */
  concealed?: RegionPoint[][]
  /** ZONA DE PERIGO: tipo e polígono de cada sala tomada que o jogador enxerga agora. */
  hazards?: PlayerHazard[]
  /** ZONA DE PERIGO: a ficha dele acabou de entrar num perigo. Some sozinho; `id` novo repete o aviso. */
  hazardNotice?: { id: number; kind: HazardKind }
  /** GATILHO DE ÁREA: tipo e polígono de cada armadilha/alarme que o mestre revelou. */
  gatilhos?: PlayerAreaTrigger[]
  /** MAPA POR ANDARES: o andar dele e os outros que ele já conhece. Ausente = sem abas. */
  andares?: PlayerFloors
  /** RELÓGIO DA CAMPANHA: o período do dia e se a cena dele está escura. Ausente = mestre sem relógio. */
  relogio?: PlayerClock
  /**
   * INICIATIVA: id da ficha da vez, sempre uma ficha de `map.tokens`. Ausente
   * = ninguém que este jogador enxerga está na vez (o mestre só manda o que
   * está no recorte dele).
   */
  turn?: string
  /**
   * CONFRONTO da cena onde ele está: fila, de quem é a vez e o que resta do
   * passo. Cada snapshot substitui; snapshot sem o campo apaga a faixa.
   */
  confronto?: PlayerConfronto
  /** Sinais recebidos ainda vivos (somem sozinhos depois de `SIGNAL_TTL_MS`). */
  signals?: SignalMark[]
  /**
   * Marcas "vamos para cá" que o host deixou este jogador ver (a própria vem
   * com `mine`). Sem prazo: cada `destinations` do host troca a lista inteira.
   */
  destinations?: DestinationMark[]
  /** Rastro do laser do mestre; some sozinho `LASER_TRAIL_MS` depois da última mensagem com o laser desligado. */
  laser?: LaserTrail
  /** Lasers dos OUTROS jogadores da mesma cena, um por jogador, na cor da ficha dele. */
  playerLasers?: RemoteLaser[]
  /**
   * Recusa do mestre ao movimento (parede, fora do chão, ficha alheia, lugar
   * ocupado); a ficha já voltou sozinha. Some sozinha; `id` novo repete o aviso.
   * Mesmo contador de `id` da porta. A vez (`not_your_turn`) vai em `turnNotice`.
   */
  moveNotice?: { id: number; reason: TokenMoveRejection }
  /**
   * INICIATIVA: o mestre recusou o arrasto porque não é a vez desta ficha
   * ("Espere sua vez"); some sozinho. `id` novo repete o aviso. Não diz de quem
   * é a vez: isso só vem em `turn`, e só quando o jogador vê a ficha.
   */
  turnNotice?: { id: number }
  /**
   * Recusa do mestre ao pedido de porta (trancada, longe, não visível). `id`
   * novo repete o aviso. Longe e não visível somem sozinhos; "Trancada" fica
   * até o jogador escolher (Bater, Forçar, Usar chave) ou fechar, e guarda
   * `wallId` para o pedido saber de que porta é.
   */
  doorNotice?: DoorNotice
  /** O pedido da porta trancada: enviado, a resposta do mestre ou a recusa do host. Some sozinho. */
  doorRequest?: { id: number; phase: DoorRequestPhase }
  /**
   * ESCONDER-SE: `waiting` até o mestre decidir; a recusa some sozinha.
   * Aceito não tem aviso: a própria ficha chega com `secret` e a espera acaba.
   */
  hide?: HideNotice
  /** Pedido de passagem: esperando o mestre, ou a resposta dele. */
  travel?: TravelNotice
  /** ITEM PEGÁVEL: "Pegar" ou "Dar a…" — enviado, a resposta do mestre ou a recusa do host. Some sozinho. */
  item?: ItemNotice
  /** ALAVANCA: a resposta ao "Puxar a alavanca". Some sozinha; `id` novo repete o aviso. */
  lever?: { id: number; phase: LeverPhase }
  /**
   * Recado do mestre para a cena do jogador. Fica até ele fechar
   * (`dismissNote`); um recado novo toma o lugar do aberto. É texto puro: a
   * tela o mostra como texto, nunca como HTML. `onlyYou`: o mestre mandou só
   * para este jogador (a tela diz "Só para você").
   */
  note?: OpenNote
  /**
   * PAUSA POR CENA: o mestre pausou a cena deste jogador (está com outro
   * grupo). Enquanto `true`, a tela mostra o aviso fixo; quem manda é o host,
   * que recusa o movimento — o aviso só explica por que a ficha volta.
   */
  paused?: true
  /**
   * Os OUTROS jogadores da mesa e onde estão para ele (aqui, longe, fora).
   * Ausente até o primeiro `party.update`. Sobrevive à espera no lobby: o host
   * só reenvia quando muda, então apagar aqui deixaria a lista vazia na volta.
   */
  party?: PartyMember[]
  /** A mão do jogador (chamar o mestre): acesa esperando, ou a resposta curta do mestre. */
  call?: CallNotice
  /** Ação no ponto: esperando o mestre, a resposta dele ou a recusa do host. */
  pointNotice?: PointNotice
  /**
   * QUEM CHEGA ESCOLHE A FICHA: as fichas livres que o mestre oferece a quem
   * está sem personagem (só id e nome). Ausente = nenhuma lista chegou nesta
   * conexão (o `welcome` a apaga). O host só reenvia quando muda ou quando o
   * jogador volta à espera, então o `lobby.waiting` não a apaga.
   */
  seatOptions?: SeatOption[]
  /** O pedido de ficha: enviado, esperando o mestre, ou a resposta. O mapa com a ficha o encerra. */
  seatClaim?: SeatClaimNotice
  /**
   * Sobe toda vez que o mapa em tela deixa de ser o da cena em que o jogador
   * estava: troca de cena (`scene.changed`) ou saída do jogo (lobby,
   * reconexão, queda, expulsão, sala fechada). O que a tela abriu sobre um
   * ponto do mapa (o menu do toque longo) só vale na época em que abriu: o
   * mesmo x/y noutra cena é outro lugar.
   */
  sceneEpoch: number
  /**
   * TEXTO DA SALA aberto: chega na primeira entrada (`room.text`) ou quando o
   * jogador toca o rótulo (`openRoomText`). `id` é o da Sala; `title`, o nome
   * que ele pode ver ('' quando oculto). Texto puro, como o recado.
   */
  roomText?: { id: string; title: string; text: string }
  /**
   * CADERNO: todo recado que chegou, do mais antigo ao mais novo (até
   * `NOTEBOOK_MAX_NOTES`). Fechar o cartão não tira daqui; o `notes.book` do
   * host, na entrada ou na volta, substitui a lista inteira.
   */
  notebook?: NoteEntry[]
  /** Ids de recados que chegaram e o jogador ainda não viu (nem no cartão fechado, nem no Caderno). */
  unreadNotes?: string[]
  /**
   * MINHAS PISTAS: os cartões lidos e os que colegas mostraram, da mais antiga
   * à mais nova (até `CLUEBOOK_MAX_CLUES`). Só entra o que o HOST confirmou
   * (`clue.added`, `clue.shown`); o `clues.book` da entrada substitui tudo.
   */
  clues?: ClueEntry[]
  /** Pista que um colega acabou de mostrar: o cartão "Gabi mostrou: Bilhete". `id` novo reabre. */
  shownClue?: { id: number; from: string; clue: ClueEntry }
  /** "Mostrar para…": esperando a lista, ou os colegas da mesma cena. */
  cluePeers?: CluePeers
  /** "Mostrar para…": o último envio e a resposta do host. */
  clueShow?: ClueShow
  /**
   * TEXTO DE CHEGADA da cena onde o jogador acabou de chegar: vem uma vez, no
   * `scene.changed`, e fica até ele fechar (`dismissArrival`). Chegar noutra
   * cena (com ou sem texto) tira o da cena de antes. Texto puro, como o recado.
   */
  arrival?: { id: number; text: string }
  /**
   * ALARME do mestre para a cena do jogador (e outras junto). Diferente do
   * recado, o jogador NÃO fecha: some só com `scene.alarm.end` do mesmo id,
   * com a volta à espera ou ao reconectar (o host manda de novo se ainda valer).
   * Texto puro, como o recado.
   */
  alarm?: { id: string; text: string }
  /** CORREIO: esperando a lista de colegas da sala, ou os nomes. */
  letterPeers?: LetterPeers
  /** CORREIO: o último bilhete mandado e a resposta do host (chegou ao mestre ou não). */
  letterSend?: LetterSend
  /**
   * "ONDE ESTOU": o nome para os jogadores da cena onde ele está, do último
   * snapshot. Ausente = a cena não tem nome público, e o selo não aparece.
   */
  sceneName?: string
  /**
   * DADO ROLADO NA SALA: as rolagens da mesa que chegaram (a dele também só
   * aparece quando o host devolve), da mais antiga à mais nova, até
   * `DICE_FEED_MAX`. É do jogador, não da cena: trocar de cena não apaga.
   */
  diceRolls?: DiceRollEntry[]
  /**
   * LUGARES: os lugares por onde o jogador passou, na ordem da primeira visita,
   * cada um com o desenho do último recorte que ele recebeu lá. É do jogador,
   * não da cena: aguardar o mestre ou reconectar não apaga; só o que o host
   * deixou de lembrar (`snapshot.places`) sai.
   */
  places?: VisitedPlace[]
  /** Id do lugar onde ele está agora (`snapshot.place`); ausente fora de cena ou com mestre antigo. */
  place?: string
  rev: number
  playerId?: string
  /** Motivo quando `status === 'error'`: razão do mestre ou 'connection_lost'. */
  error?: string
  /**
   * A conexão caiu depois de entrar na sala e o cliente está tentando voltar
   * sozinho. O `status` e o mapa ficam como estavam (a tela esmaece); some
   * quando o mestre aceita a volta (`welcome`).
   */
  reconnecting?: ReconnectInfo
}

/** Como vai a volta automática depois de uma queda. */
export interface ReconnectInfo {
  /** Quando a conexão caiu (relógio do aparelho, ms). */
  since: number
  /** Tentativas feitas desde a queda. */
  attempt: number
  /** Já passou `MANUAL_RECONNECT_AFTER_MS`: a tela oferece "Reconectar". */
  manual: boolean
}

/** O aviso da recusa do toque na porta; `wallId` é a porta tocada. */
export interface DoorNotice {
  id: number
  reason: DoorToggleRejection
  wallId: string
  /** CHAVE ABRE PORTA: nome do item da mochila que abre esta porta trancada. Só no `locked`, só de quem o carrega. */
  key?: string
}

/** `sent`: saiu para o mestre; `opened`/`denied`: a resposta dele; o resto: o host nem levou ao mestre. */
export type DoorRequestPhase = 'sent' | DoorRequestAnswer | DoorRequestRejection

/** Onde está o pedido de esconder-se. `id` novo repete o aviso; `tokenId` é a ficha pedida — só ela encerra a espera. */
export type HideNotice = { id: number; phase: 'waiting'; tokenId: string } | { id: number; phase: 'rejected'; reason: TokenHideRejection }

/**
 * Onde está o pedido de passagem pelo pino de viagem. `waiting` fica até o
 * mestre responder; os outros três somem sozinhos. `id` novo repete o aviso.
 * Nenhum deles sabe para onde o pino leva: o host nunca conta.
 */
export type TravelNotice =
  /** `direct`: o pino é livre, ninguém decide — só falta a resposta do host. */
  | { id: number; phase: 'waiting'; direct: boolean }
  | { id: number; phase: 'arrived' }
  /** O mestre levou o jogador para outra cena sem ele pedir. */
  | { id: number; phase: 'moved' }
  /** O mestre reuniu o grupo num pino e trouxe o jogador de outra cena. */
  | { id: number; phase: 'gathered' }
  /** `text`: o motivo do "Não, porque…" do mestre. Ausente = o "não deixou" sem motivo. */
  | { id: number; phase: 'denied'; text?: string }
  | { id: number; phase: 'rejected'; reason: PinTravelRejection }

export type CluePeers = { phase: 'loading' } | { phase: 'ready'; names: string[] }

/**
 * Recado aberto no cartão. `from` e `via` só no bilhete de um colega (CORREIO):
 * o cartão diz de quem é. Ausentes = recado do mestre. `onlyYou`: o mestre
 * mandou só para este jogador (a tela diz "Só para você").
 */
export interface OpenNote {
  id: string
  text: string
  from?: string
  via?: LetterVia
  onlyYou?: true
}

/** CORREIO: a quem o jogador pode escrever. Mesma forma da lista de "Mostrar para…". */
export type LetterPeers = CluePeers

export interface LetterSend {
  to: string
  via: LetterVia
  /** `ok` = chegou ao MESTRE (entregar é com ele); `too_soon` e `full`, os motivos que o host conta. */
  phase: 'sending' | 'ok' | 'failed' | 'too_soon' | 'full'
}

export interface ClueShow {
  to: string
  /** `too_soon`: o mestre pediu um instante entre duas pistas mostradas; o colega segue na cena. */
  phase: 'sending' | 'ok' | 'failed' | 'too_soon'
}

/** Põe a pista no fim do caderno; a mesma (mesmo id) sai de onde estava. Passou do teto, sai a mais antiga. */
function withClue(book: readonly ClueEntry[], clue: ClueEntry): ClueEntry[] {
  return [...book.filter((entry) => entry.id !== clue.id), clue].slice(-CLUEBOOK_MAX_CLUES)
}

/**
 * Onde está o "Pegar" (ou o "Dar a…"). `sent` espera o mestre (`direct`: o
 * pino é livre, ninguém decide); `taken` leva o nome do que agora está com o
 * jogador. `id` novo repete o aviso.
 */
export type ItemNotice =
  | { id: number; phase: 'sent'; direct: boolean }
  | { id: number; phase: 'taken'; nome: string }
  | { id: number; phase: 'denied' }
  | { id: number; phase: 'rejected'; reason: PinTakeRejection }
  | { id: number; phase: 'give_rejected'; reason: ItemGiveRejection }

/**
 * Onde está a mão do jogador. `waiting` fica até o mestre responder (ou ele
 * baixar); `seen` ("O mestre viu") e `too_soon` ("espere um instante") somem
 * sozinhos depois de `CALL_NOTICE_TTL_MS`. A resposta escrita do mestre não
 * mora aqui: vira `note`, o mesmo cartão do recado.
 */
export type CallNotice = { id: number; phase: 'waiting'; reason: CallReason } | { id: number; phase: 'seen' } | { id: number; phase: 'too_soon' }

/** A resposta do host ao "Puxar a alavanca": puxou, ou por que nada se moveu. */
export type LeverPhase = 'pulled' | PinLeverRejection
/**
 * Onde está o pedido de ficha: `sent` (saiu, o host ainda não respondeu) ou o
 * estado que o host mandou. `name` é o nome da ficha na hora do pedido: a
 * lista pode mudar (ela sai quando outro a leva) e a tela ainda precisa dizer qual.
 */
export interface SeatClaimNotice {
  id: number
  phase: 'sent' | SeatClaimState
  tokenId: string
  name: string
}

/** Subconjunto do WebSocket do browser que este cliente usa. */
export interface SocketLike {
  readonly readyState: number
  send(data: string): void
  close(): void
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PlayerConnectionOptions {
  url: string
  code: string
  name: string
  createSocket: (url: string) => SocketLike
  storage: StorageLike | null
  /**
   * `table` = TELA DA MESA (TV, projetor): entra com `role: 'table'`, sem
   * resume, e só olha — o cliente nunca manda nada além do `join` e do `ping`.
   * Ausente = jogador, como sempre.
   */
  role?: 'table'
  /** TELA DA MESA: a chave do link da TV (`?chave=`), que vai no `join` junto com o código. */
  tableKey?: string
  /**
   * A aba está em segundo plano agora? (No navegador, `document.visibilityState
   * === 'hidden'`.) Ausente = sempre à vista.
   */
  isHidden?: () => boolean
}

/** O `join` da tela da mesa: sem chave, a mensagem vai sem o campo e a sala responde `bad_table_key`. */
function tableJoin(code: string, name: string, tableKey: string | undefined): JoinMessage {
  return tableKey === undefined || tableKey.length === 0 ? { type: 'join', code, name, role: 'table' } : { type: 'join', code, name, role: 'table', tableKey }
}

/** Nome que a tela da mesa manda no `join`: o servidor do app exige um nome, e o mestre nunca o lista. */
export const TABLE_SCREEN_NAME = 'Tela da mesa'

export interface PlayerConnection {
  getState(): PlayerState
  subscribe(listener: () => void): () => void
  /**
   * Move otimista: aplica local e envia. `false` se o token não existe ou o
   * socket não está aberto. Para a caminhada do "Andar até aqui", se houver.
   */
  requestMove(tokenId: string, x: number, y: number): boolean
  /**
   * ANDAR ATÉ AQUI: `legs` são os fins de cada trecho reto (o último é o
   * destino). Sai o primeiro trecho; cada seguinte sai depois que o host
   * aceitou o anterior e a ficha deslizou até a esquina
   * (`WALK_LEG_PAUSE_MS`). Recusa do host, arrasto da ficha ou troca de cena
   * param a caminhada. `false` (e nada sai) sem trecho, com ponto inválido,
   * token fora do mapa, fora de jogo ou socket fechado.
   */
  requestWalk(tokenId: string, legs: readonly { x: number; y: number }[]): boolean
  /**
   * Sinal no ponto (px de mundo). `audience: 'master'` só o mestre vê (o do
   * toque longo). `false` se não está jogando ou o socket não está aberto.
   */
  sendSignal(x: number, y: number, audience?: SignalAudience): boolean
  /** Põe (ou move) a marca "vamos para cá" no ponto (px de mundo). `false` se não está jogando ou o socket não está aberto. */
  markDestination(x: number, y: number): boolean
  /** "Tirar marca". `false` se não está jogando ou o socket não está aberto. */
  clearDestination(): boolean
  /** Pede ao mestre para abrir/fechar a porta. `false` se não está jogando ou o socket não está aberto. */
  toggleDoor(wallId: string): boolean
  /**
   * Pede ao mestre para passar pela porta trancada `wallId` — Bater, Forçar ou
   * Usar chave. Troca o "Trancada" por "Pedido enviado". `false` se não está
   * jogando, o pedido é malformado ou o socket não está aberto.
   */
  requestDoor(wallId: string, how: DoorRequestHow): boolean
  /**
   * "Esconder": pede ao mestre para a PRÓPRIA ficha `tokenId` sumir dos outros
   * jogadores. `false` se não está jogando, se a ficha não é dele (ou já está
   * escondida), se já há um pedido esperando ou se o socket não está aberto.
   */
  requestHide(tokenId: string): boolean
  /**
   * CHAVE ABRE PORTA: "Usar <chave>" na porta trancada `wallId`. Manda só a
   * porta (o host acha a chave) e fecha o aviso. `false` se não está jogando
   * ou o socket não está aberto.
   */
  useDoorKey(wallId: string): boolean
  /** Fecha o aviso da porta (o × do "Trancada"). */
  dismissDoorNotice(): void
  /**
   * Nome novo do PRÓPRIO token: aplica na hora e envia. `false` quando o token
   * não é dele, não está no mapa, o nome não cabe ou o socket não está aberto.
   */
  setOwnTokenName(tokenId: string, name: string): boolean
  /**
   * Foto nova do PRÓPRIO token (referência auto-contida). Mesmas recusas de
   * `setOwnTokenName`, mais a forma da foto e o tamanho acima do teto de envio
   * (`TOKEN_PHOTO_SEND_MAX_CHARS`) — foto que derrubaria o jogador nem sai.
   */
  setOwnTokenPhoto(tokenId: string, image: string): boolean
  /**
   * Pede ao mestre para passar pelo pino de viagem `pinId` — ou, no pino
   * livre, passa (o pedido sai depois de `FREE_PASSAGE_BEAT_MS`). `false` se
   * não está jogando, se já há um pedido esperando ou se o socket não está aberto.
   * `exitId` é a saída escolhida numa encruzilhada (um id de `Pin.escolhas`);
   * ausente, o pedido sai sem ele e vale a saída principal, como sempre.
   */
  requestTravel(pinId: string, exitId?: string): boolean
  /**
   * CABINE DE TRANSPORTE: "Chamar a cabine" pela parada `pinId`. Sem resposta:
   * a parada diz "chamada" no próximo recorte. `false` se não está jogando ou
   * o socket não está aberto.
   */
  callCabine(pinId: string): boolean
  /**
   * Ponteiro do LASER do jogador em px de mundo. Sai em lotes: o primeiro
   * ponto na hora, os seguintes juntos a cada `LASER_SEND_INTERVAL_MS`.
   * `false` se não está jogando ou o socket não está aberto.
   */
  laserMove(x: number, y: number): boolean
  /** Soltou o laser: manda o que faltava e o `off`, só se algo saiu desde o último. */
  laserOff(): void
  /**
   * "Pegar" o item do pino `pinId`. `false` se não está jogando, o pino não
   * está no mapa dele ou não é pegável, ou o socket não está aberto.
   */
  takePin(pinId: string): boolean
  /**
   * "Dar a…": o item `itemId` da mochila de uma ficha dele vai à ficha
   * `toTokenId`. `false` se o item não está com ele ou o socket não está aberto.
   */
  giveItem(itemId: string, toTokenId: string): boolean
  /**
   * AÇÃO NO PONTO (px de mundo): pede ao mestre para Procurar/Escutar/
   * Espiar/Revistar ali. `false` se não está jogando, o ponto não é finito,
   * cai fora do mapa ou o socket não está aberto.
   */
  sendPointAction(action: PointActionKind, x: number, y: number): boolean
  /**
   * ALAVANCA: puxa a alavanca `pinId`. `false` se não está jogando, o pino não
   * está no mapa dele ou não é alavanca, ou o socket não está aberto.
   */
  pullLever(pinId: string): boolean
  /** Fecha o recado aberto (botão "Fechar" ou Escape do cartão). Quem fechou leu: aquele recado deixa de ser novo. */
  dismissNote(): void
  /** O jogador abriu o Caderno: nenhum recado é novo mais. */
  markNotebookRead(): void
  /**
   * Reabre o texto da Sala `regionId` (toque no rótulo). Só abre texto que já
   * chegou no mapa do jogador; `false` quando a Sala não tem texto para ele.
   */
  openRoomText(regionId: string): boolean
  /** Fecha o texto da Sala aberto. */
  dismissRoomText(): void
  /**
   * MINHAS PISTAS: o jogador abriu o cartão do pino `pinId` — pede ao host
   * para guardar. `false` (e nada sai) quando não joga, o pino não está no
   * mapa dele ou o cartão não tem texto nem foto.
   */
  readClue(pinId: string): boolean
  /** "Mostrar para…": pede ao host quem está na mesma cena. */
  askCluePeers(): boolean
  /** Mostra a pista `clueId` (do caderno dele) ao colega `to`. `false` se a pista não é dele ou o socket caiu. */
  showClue(clueId: string, to: string): boolean
  /** O cartão da pista fechou: a lista de colegas e o resultado do envio perdem o sentido. */
  resetClueShare(): void
  /** Fecha o cartão da pista que um colega mostrou (a pista continua no caderno). */
  dismissShownClue(): void
  /**
   * Levanta a mão: chama o mestre com o motivo e, opcional, um texto curto
   * (aparado; em branco não viaja). `false` se não está jogando, se a mão já
   * está levantada, se o texto passa de `CALL_TEXT_MAX_LENGTH` ou se o socket
   * não está aberto.
   */
  raiseHand(reason: CallReason, text?: string): boolean
  /** Baixa a mão antes de o mestre ver. `false` se ela não estava levantada ou o socket não está aberto. */
  lowerHand(): boolean
  /** CORREIO: pede ao host a quem escrever. `false` se não está jogando ou o socket caiu. */
  askLetterPeers(): boolean
  /**
   * CORREIO: manda o bilhete (texto aparado) ao colega `to` pelo meio `via`.
   * Vai ao mestre, que entrega ou não. `false` (e nada sai) fora do jogo, com
   * texto vazio ou acima de `LETTER_TEXT_MAX_LENGTH`, ou com o socket caído.
   */
  sendLetter(to: string, via: LetterVia, text: string): boolean
  /**
   * DADO ROLADO NA SALA: pede a rolagem ao host (quem rola é ele; o resultado
   * volta em `diceRolls`, igual para a mesa). `false` (e nada sai) com pedido
   * fora da faixa ou socket fechado.
   */
  rollDice(request: DiceRequest): boolean
  /** Fecha o cartão do texto de chegada. */
  dismissArrival(): void
  /**
   * Sem personagem: pede ao mestre a ficha `tokenId` da lista `seatOptions`.
   * `false` (nada sai) jogando, fora da lista, com um pedido já esperando ou
   * com o socket fechado.
   */
  claimSeat(tokenId: string): boolean
  /** Abre um socket novo (reconectar), reaproveitando o resumeToken guardado. */
  reconnect(): void
  /**
   * A tela acendeu ou a rede voltou: se está reconectando e nenhuma tentativa
   * está no ar, tenta AGORA em vez de esperar a espera crescente.
   */
  wake(): void
  /** "Reconectar" da tela de queda: tenta agora, largando a tentativa no ar se houver. */
  retryNow(): void
  close(): void
}

export const RESUME_STORAGE_KEY = 'labirinto.resume'
/**
 * O `ping` sai a cada 2 s e o host responde `pong`. Era 15 s, só para manter o
 * túnel acordado; agora é também a prova de vida dos dois lados, e precisa
 * caber no aceite "Grupo mostra 'Gina caiu' em 0:10" (ver `HOST_STALE_AFTER_MS`
 * do hostBridge). Numa mesa de 7 são 3,5 mensagens minúsculas por segundo.
 */
export const PING_INTERVAL_MS = 2_000
/**
 * Sem NADA do host há isto (nem pong, nem snapshot), o socket conta como morto
 * mesmo sem `close`: o Wi-Fi que some sem FIN deixa o navegador achando que
 * está tudo aberto por minutos. Dois pings e meio de folga; e abaixo do prazo
 * do host (6 s), para o jogador já estar voltando quando o mestre souber.
 */
export const SILENCE_DEAD_AFTER_MS = 5_000
/**
 * A tela acendeu e o host está mudo há mais que `SILENCE_DEAD_AFTER_MS`: um
 * ping sai na hora e, sem resposta nisto, a volta começa sem esperar a espera
 * crescente. Não derruba direto porque o silêncio pode ser só do timer da aba
 * oculta (Chrome e Edge rodam o ping 1 vez por minuto depois de 5 min em
 * segundo plano) com a conexão viva; na LAN o pong volta em milissegundos.
 */
export const WAKE_PROBE_MS = 800
/** Quanto tempo o aviso da porta ("Chegue mais perto") fica na tela. O "Trancada" fica até o jogador escolher. */
export const DOOR_NOTICE_TTL_MS = 2500
/** Quanto tempo a recusa do movimento ("Parede no caminho") fica na tela: 2-3 s, como a da porta. */
export const MOVE_NOTICE_TTL_MS = 2500
const MOVE_REJECTIONS: readonly TokenMoveRejection[] = ['unknown_token', 'not_owner', 'locked', 'outside_map', 'wall', 'outside_floor', 'occupied', 'too_far']

function isMoveRejection(value: unknown): value is TokenMoveRejection {
  return MOVE_REJECTIONS.some((reason) => reason === value)
}
/** Quanto tempo o aviso do pedido da porta ("Pedido enviado", "O mestre abriu") fica na tela. */
export const DOOR_REQUEST_NOTICE_TTL_MS = 4000
/** Quanto tempo a recusa do pedido de esconder-se fica na tela: o mesmo do pedido da porta. */
export const HIDE_NOTICE_TTL_MS = DOOR_REQUEST_NOTICE_TTL_MS
/** Quanto tempo o aviso do item ("está com você", "O mestre disse não") fica na tela. */
export const ITEM_NOTICE_TTL_MS = 4000
/** Quanto tempo o aviso da alavanca ("Você puxou a alavanca") fica na tela: recado curto, como o da porta. */
export const LEVER_NOTICE_TTL_MS = DOOR_NOTICE_TTL_MS
/** Quanto tempo a recusa do mestre ("não deixou passar agora") fica na tela. Mais que a porta. */
export const TRAVEL_NOTICE_TTL_MS = 4000
/** A recusa com motivo ("O mestre não deixou: o portão fecha à noite") é uma frase para ler: fica mais. */
export const TRAVEL_DENIED_WITH_REASON_TTL_MS = 8000
/** Quanto tempo "O mestre viu" e "Espere um instante" ficam no lugar da mão. */
export const CALL_NOTICE_TTL_MS = 4000
/**
 * "Você chegou" é mudança de lugar: sai quando o jogador mexe a própria ficha
 * (aí já viu onde está, mesma regra da reunião) ou depois deste teto. Era
 * 4 s, igual à recusa, e não bastava com a mesa cheia: no "Deixar todos" da
 * caixa de pedidos vários chegam juntos, e medido na jornada da caixa o aviso
 * de Carla sumia antes de alguém olhar a tela dela — com 8 s e com 20 s
 * também. O teto é o mesmo da reunião: quem sai é o gesto do jogador.
 */
export const ARRIVAL_NOTICE_TTL_MS = 60_000
/**
 * Pausa entre confirmar a passagem LIVRE e o pedido sair: o tempo de o cartão
 * fechar e o "Passando…" aparecer antes de a cena trocar. Curta de propósito —
 * é uma batida, não uma espera.
 */
export const FREE_PASSAGE_BEAT_MS = 450
/** Folga sobre o que falta dos limites do pedido de passagem: o host mede na chegada, não no envio. */
export const TRAVEL_PACE_MARGIN_MS = 250
/**
 * "O mestre levou você para outro lugar": quem foi LEVADO não esperava nada e
 * pode estar olhando a mesa quando o mapa troca. Mesmo teto e mesma saída
 * (mexer a ficha) do "Você chegou" e da reunião.
 */
export const MOVED_NOTICE_TTL_MS = 60_000
/**
 * "O mestre reuniu o grupo" espera o jogador: a reunião costuma vir depois de
 * uma pausa da mesa, com o jogador olhando para longe da tela. Some quando
 * ele mexe a própria ficha (aí já viu onde está) ou depois de um minuto.
 */
export const GATHERED_NOTICE_TTL_MS = 60_000
/**
 * Espera da reconexão automática: dobra a cada tentativa que falha, de 1 s
 * até este teto. Trinta segundos é o mais longo que um celular esperaria sem
 * a pessoa achar que o app desistiu — e a rede que volta (`online`) ou a tela
 * que acende (`visibilitychange`) cortam a espera pelo `wake`.
 */
export const RECONNECT_MAX_DELAY_MS = 30_000
const RECONNECT_FIRST_DELAY_MS = 1_000
/** Depois disto fora, a tela oferece "Reconectar" (as tentativas sozinhas continuam). */
export const MANUAL_RECONNECT_AFTER_MS = 30_000
/**
 * Tentativa que nem abre nem fecha (Wi-Fi trocando de rede, rota que some)
 * é abandonada depois disto: sem o prazo, ela prenderia a reconexão para sempre.
 */
export const RECONNECT_ATTEMPT_TIMEOUT_MS = 8_000
const SOCKET_OPEN = 1
/** Mede o tamanho em bytes do que vai pelo socket (o servidor conta bytes, não caracteres). */
const utf8 = new TextEncoder()
const CONNECTION_LOST = 'connection_lost'

/** Espera antes da tentativa `attempt` (1 = a primeira depois da queda). */
export function reconnectDelayMs(attempt: number): number {
  const exponent = Math.max(0, attempt - 1)
  return Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_FIRST_DELAY_MS * 2 ** exponent)
}

/**
 * Pausa entre um trecho aceito e o próximo do "Andar até aqui": o tempo do
 * deslize da ficha, para a esquina aparecer na tela antes da curva.
 */
export const WALK_LEG_PAUSE_MS = TOKEN_GLIDE_MS

/** Caminhada em curso: os trechos que faltam e o pedido que espera o host. */
interface Walk {
  tokenId: string
  legs: { x: number; y: number }[]
  /** Trecho enviado e ainda sem resposta; `null` entre trechos. */
  reqId: string | null
  timer: ReturnType<typeof setTimeout> | null
  /** Última esquina que o host aceitou; `null` até o primeiro aceite. */
  at: { x: number; y: number } | null
}

interface PendingMove {
  tokenId: string
  x: number
  y: number
  prevX: number
  prevY: number
}

interface StoredResume {
  code: string
  token: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPointList(value: unknown): value is RegionPoint[] {
  return Array.isArray(value) && value.every((p) => isRecord(p) && isFiniteNumber(p.x) && isFiniteNumber(p.y))
}

function isVision(value: unknown): value is RegionPoint[][] {
  return Array.isArray(value) && value.every(isPointList)
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/** Id de ficha como o protocolo aceita (mesmo teto de `tokenId` em `net/protocol.ts`). */
function isBoundedId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= REQ_ID_MAX_LENGTH
}

/** Nome de cena que o selo pode mostrar: texto não vazio, no teto do mestre. */
function isSceneName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= SCENE_PUBLIC_NAME_MAX_LENGTH
}

/**
 * Checagem estrutural rasa do mapa: vem do mestre (fonte confiável), então só
 * garante os campos que o render e o move otimista tocam — não revalida o
 * MapData inteiro.
 */
function isMapShape(value: unknown): value is MapData {
  if (!isRecord(value)) return false
  const { width, height, grid, tokens, floor, lines, markers, floorStyle, hiddenLayers } = value
  return (
    isFiniteNumber(width) &&
    isFiniteNumber(height) &&
    isFiniteNumber(grid) &&
    Array.isArray(tokens) &&
    tokens.every((t) => isRecord(t) && typeof t.id === 'string' && isFiniteNumber(t.x) && isFiniteNumber(t.y)) &&
    Array.isArray(floor) &&
    Array.isArray(lines) &&
    Array.isArray(markers) &&
    isRecord(floorStyle) &&
    Array.isArray(hiddenLayers)
  )
}

/**
 * Quantos outros andares um snapshot pode trazer. O host guarda memória de
 * poucas cenas por jogador (`MAX_SCENE_MEMORIES_PER_PLAYER`); o teto aqui é
 * folga, não regra de jogo.
 */
const MAX_FLOORS = 16

/** Rótulo como o host manda: já limpo (`cleanFloorLabel` devolve ele mesmo). */
function isFloorLabel(value: unknown): value is string {
  return typeof value === 'string' && cleanFloorLabel(value) === value
}

function parseFloorMemory(value: unknown): PlayerFloorMemory | null {
  if (!isRecord(value)) return null
  const { rotulo, map, explored, concealed } = value
  if (!isFloorLabel(rotulo) || !isMapShape(map) || !isVision(concealed)) return null
  const decoded = decodeExploration(explored)
  return decoded === null ? null : { rotulo, map, explored: decoded, concealed }
}

/**
 * MAPA POR ANDARES: `snapshot.andares` validado. `null` = malformado (a
 * mensagem inteira cai, como nos outros campos aditivos): rótulo que não é
 * rótulo de andar, andar repetido ou igual ao atual, mapa ou memória tortos.
 */
function parseFloors(value: unknown): PlayerFloors | null {
  if (!isRecord(value)) return null
  const { atual, outros } = value
  if (!isFloorLabel(atual) || !Array.isArray(outros) || outros.length > MAX_FLOORS) return null
  const parsed: PlayerFloorMemory[] = []
  for (const raw of outros) {
    const floor = parseFloorMemory(raw)
    if (floor === null || floor.rotulo === atual || parsed.some((f) => f.rotulo === floor.rotulo)) return null
    parsed.push(floor)
  }
  return { atual, outros: parsed }
}

function readResume(storage: StorageLike | null, code: string): string | undefined {
  if (!storage) return undefined
  try {
    const raw = storage.getItem(RESUME_STORAGE_KEY)
    if (!raw) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (isRecord(parsed) && parsed.code === code && typeof parsed.token === 'string') return parsed.token
  } catch {
    // Storage bloqueado ou conteúdo corrompido: entra sem resume.
  }
  return undefined
}

function writeResume(storage: StorageLike | null, value: StoredResume | null): void {
  if (!storage) return
  try {
    if (value) storage.setItem(RESUME_STORAGE_KEY, JSON.stringify(value))
    else storage.removeItem(RESUME_STORAGE_KEY)
  } catch {
    // Storage indisponível: resume só não sobrevive ao reload.
  }
}

/**
 * Há recado que o jogador não viu? O que está no cartão aberto não conta: ele
 * está lendo. É o que acende o ponto no Painel e na aba Caderno.
 */
export function hasUnreadNotes(state: PlayerState): boolean {
  return (state.unreadNotes ?? []).some((id) => id !== state.note?.id)
}

/** Mesma regra do mestre: a tocha presa na ficha anda junto (`lib/lightAttachment.ts`). */
function withTokenAt(map: MapData, tokenId: string, x: number, y: number): MapData {
  return moveTokenCarryingLights(map, tokenId, x, y)
}

function withTokenPatch(map: MapData, tokenId: string, patch: Partial<Token>): MapData {
  return { ...map, tokens: map.tokens.map((t) => (t.id === tokenId ? { ...t, ...patch } : t)) }
}

export function createPlayerConnection(options: PlayerConnectionOptions): PlayerConnection {
  const { url, code, name, createSocket } = options
  const isTable = options.role === 'table'
  // A tela da mesa não tem sessão de jogador para retomar: sem storage, ela
  // nunca lê o resume de quem jogava nesta aba nem grava um por cima dele.
  const storage = isTable ? null : options.storage
  const listeners = new Set<() => void>()
  const pending = new Map<string, PendingMove>()
  let walk: Walk | null = null
  let state: PlayerState = { status: 'connecting', rev: -1, sceneEpoch: 0 }
  let socket: SocketLike | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  const isHidden = options.isHidden ?? (() => false)
  /** Quando chegou a última mensagem do host no socket atual (relógio do aparelho). */
  let lastHeardAt = 0
  /**
   * Desde quando a aba está de novo à vista e o silêncio volta a contar. O que
   * se passou com a aba oculta não prova nada: o timer do ping estava preso.
   */
  let watchingSince = 0
  /** Confirmação de vida depois de a tela acender (`WAKE_PROBE_MS`). */
  let wakeProbeTimer: ReturnType<typeof setTimeout> | null = null
  let nextReqId = 1
  const signalTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let nextSignalId = 1

  function clearSignalTimers(): void {
    for (const timer of signalTimers.values()) clearTimeout(timer)
    signalTimers.clear()
  }

  function addSignal(x: number, y: number, from: string, color: string): void {
    const id = `s${nextSignalId++}`
    const current = state.signals ?? []
    // Acima do teto sai o mais antigo; o timer dele vira no-op ao não achar o id.
    const kept = current.length >= MAX_ACTIVE_SIGNALS ? current.slice(current.length - MAX_ACTIVE_SIGNALS + 1) : current
    setState({ signals: [...kept, { id, x, y, name: from, color, createdAt: Date.now() }] })
    signalTimers.set(
      id,
      setTimeout(() => {
        signalTimers.delete(id)
        setState({ signals: (state.signals ?? []).filter((s) => s.id !== id) })
      }, SIGNAL_TTL_MS),
    )
  }

  let doorNoticeTimer: ReturnType<typeof setTimeout> | null = null
  let nextNoticeId = 1

  function clearDoorNotice(): void {
    if (doorNoticeTimer !== null) clearTimeout(doorNoticeTimer)
    doorNoticeTimer = null
  }

  /** Recusa do toque. Um aviso de porta por vez (o do pedido sai): os dois ocupam o mesmo lugar da tela. */
  function showDoorNotice(reason: DoorToggleRejection, wallId: string, key?: string): void {
    clearDoorNotice()
    const notice: DoorNotice = { id: nextNoticeId++, reason, wallId }
    if (key !== undefined) notice.key = key
    setState({ doorNotice: notice, doorRequest: undefined })
    // "Trancada" não some sozinho: dele saem os botões do pedido, e o jogador precisa de tempo para escolher.
    if (reason === 'locked') return
    doorNoticeTimer = setTimeout(() => {
      doorNoticeTimer = null
      setState({ doorNotice: undefined })
    }, DOOR_NOTICE_TTL_MS)
  }

  let moveNoticeTimer: ReturnType<typeof setTimeout> | null = null

  function clearMoveNotice(): void {
    if (moveNoticeTimer !== null) clearTimeout(moveNoticeTimer)
    moveNoticeTimer = null
  }

  function showMoveNotice(reason: TokenMoveRejection): void {
    clearMoveNotice()
    setState({ moveNotice: { id: nextNoticeId++, reason } })
    moveNoticeTimer = setTimeout(() => {
      moveNoticeTimer = null
      setState({ moveNotice: undefined })
    }, MOVE_NOTICE_TTL_MS)
  }

  let hazardNoticeTimer: ReturnType<typeof setTimeout> | null = null

  function clearHazardNotice(): void {
    if (hazardNoticeTimer !== null) clearTimeout(hazardNoticeTimer)
    hazardNoticeTimer = null
  }

  /** ZONA DE PERIGO: "Você entrou no fogo!" — some sozinho; outro perigo toma o lugar. */
  function showHazardNotice(kind: HazardKind): void {
    clearHazardNotice()
    setState({ hazardNotice: { id: nextNoticeId++, kind } })
    hazardNoticeTimer = setTimeout(() => {
      hazardNoticeTimer = null
      setState({ hazardNotice: undefined })
    }, HAZARD_NOTICE_TTL_MS)
  }

  let turnNoticeTimer: ReturnType<typeof setTimeout> | null = null

  function clearTurnNotice(): void {
    if (turnNoticeTimer !== null) clearTimeout(turnNoticeTimer)
    turnNoticeTimer = null
  }

  /** "Espere sua vez": mesmo tempo de tela do aviso da porta. */
  function showTurnNotice(): void {
    clearTurnNotice()
    setState({ turnNotice: { id: nextNoticeId++ } })
    turnNoticeTimer = setTimeout(() => {
      turnNoticeTimer = null
      setState({ turnNotice: undefined })
    }, DOOR_NOTICE_TTL_MS)
  }

  let hideTimer: ReturnType<typeof setTimeout> | null = null

  function clearHideTimer(): void {
    if (hideTimer !== null) clearTimeout(hideTimer)
    hideTimer = null
  }

  /** Recusa do pedido de esconder-se: aparece e some sozinha. */
  function showHideRejection(reason: TokenHideRejection): void {
    clearHideTimer()
    setState({ hide: { id: nextNoticeId++, phase: 'rejected', reason } })
    hideTimer = setTimeout(() => {
      hideTimer = null
      setState({ hide: undefined })
    }, HIDE_NOTICE_TTL_MS)
  }

  /** O host esqueceu o pedido (caiu, virou outro jogador, sala fechou): "Aguardando o mestre…" mentiria. */
  function forgetHideWaiting(): Partial<PlayerState> {
    if (state.hide?.phase !== 'waiting') return {}
    clearHideTimer()
    return { hide: undefined }
  }

  function showDoorRequest(phase: DoorRequestPhase): void {
    clearDoorNotice()
    setState({ doorRequest: { id: nextNoticeId++, phase }, doorNotice: undefined })
    doorNoticeTimer = setTimeout(() => {
      doorNoticeTimer = null
      setState({ doorRequest: undefined })
    }, DOOR_REQUEST_NOTICE_TTL_MS)
  }

  let travelTimer: ReturnType<typeof setTimeout> | null = null
  /** Quando saiu o último pedido de passagem (qualquer pino) e o de cada pino: o espelho dos limites do host. */
  let lastTravelSentAt: number | null = null
  const lastTravelSentAtByPin = new Map<string, number>()

  function clearTravelTimer(): void {
    if (travelTimer !== null) clearTimeout(travelTimer)
    travelTimer = null
  }

  /**
   * Quanto falta para o host aceitar um pedido por `pinId` (0 = já aceita).
   * O host mede na chegada; a folga cobre o primeiro pedido ter chegado mais
   * atrasado que o próximo.
   */
  function travelPaceDelay(pinId: string): number {
    const now = Date.now()
    const byPlayer = lastTravelSentAt === null ? 0 : lastTravelSentAt + TRAVEL_REQUEST_PLAYER_MIN_INTERVAL_MS - now
    const pinAt = lastTravelSentAtByPin.get(pinId)
    const byPin = pinAt === undefined ? 0 : pinAt + TRAVEL_REQUEST_MIN_INTERVAL_MS - now
    const remaining = Math.max(byPlayer, byPin)
    return remaining > 0 ? remaining + TRAVEL_PACE_MARGIN_MS : 0
  }

  /** Envia o pedido de passagem e anota a hora (o que já passou do intervalo sai da conta). */
  function sendTravel(pedido: PinTravelRequestMessage): boolean {
    if (!send(pedido)) return false
    const now = Date.now()
    for (const [id, at] of lastTravelSentAtByPin) if (now - at >= TRAVEL_REQUEST_MIN_INTERVAL_MS) lastTravelSentAtByPin.delete(id)
    lastTravelSentAt = now
    lastTravelSentAtByPin.set(pedido.pinId, now)
    return true
  }

  /** Resposta do mestre (ou do host): aparece e some sozinha. */
  function showTravelAnswer(notice: TravelNotice): void {
    clearTravelTimer()
    setState({ travel: notice })
    travelTimer = setTimeout(
      () => {
        travelTimer = null
        setState({ travel: undefined })
      },
      travelNoticeTtl(notice),
    )
  }

  function travelNoticeTtl(notice: TravelNotice): number {
    if (notice.phase === 'gathered') return GATHERED_NOTICE_TTL_MS
    if (notice.phase === 'moved') return MOVED_NOTICE_TTL_MS
    if (notice.phase === 'denied' && notice.text !== undefined) return TRAVEL_DENIED_WITH_REASON_TTL_MS
    return notice.phase === 'arrived' ? ARRIVAL_NOTICE_TTL_MS : TRAVEL_NOTICE_TTL_MS
  }

  let itemTimer: ReturnType<typeof setTimeout> | null = null

  function clearItemTimer(): void {
    if (itemTimer !== null) clearTimeout(itemTimer)
    itemTimer = null
  }

  /** Aviso do item. "Enviado" espera a resposta; o resto some sozinho. */
  function showItemNotice(notice: ItemNotice): void {
    clearItemTimer()
    setState({ item: notice })
    if (notice.phase === 'sent') return
    itemTimer = setTimeout(() => {
      itemTimer = null
      setState({ item: undefined })
    }, ITEM_NOTICE_TTL_MS)
  }

  let callTimer: ReturnType<typeof setTimeout> | null = null

  function clearCallTimer(): void {
    if (callTimer !== null) clearTimeout(callTimer)
    callTimer = null
  }

  /** "O mestre viu" / "Espere um instante": ficam no lugar da mão e somem sozinhos. */
  function showCallAnswer(phase: 'seen' | 'too_soon'): void {
    clearCallTimer()
    setState({ call: { id: nextNoticeId++, phase } })
    callTimer = setTimeout(() => {
      callTimer = null
      setState({ call: undefined })
    }, CALL_NOTICE_TTL_MS)
  }

  /** `call.state` do mestre. Fora do jogo não há mão na tela. */
  function handleCallState(data: Record<string, unknown>): void {
    if (state.status !== 'playing') return
    if (data.state === 'waiting' && isCallReason(data.reason)) {
      // O "waiting" só confirma a mão acesa aqui; mesmo `id`, nada reanima na tela.
      // Mão já baixada: é a confirmação atrasada de um chamado que o mestre
      // apagou no `call.lower` — reacender deixaria "Esperando o mestre" para
      // sempre, sem linha nenhuma na fila do mestre.
      if (state.call?.phase !== 'waiting') return
      clearCallTimer()
      setState({ call: { id: state.call.id, phase: 'waiting', reason: data.reason } })
      return
    }
    if (data.state === 'seen' || data.state === 'too_soon') showCallAnswer(data.state)
  }

  let pointNoticeTimer: ReturnType<typeof setTimeout> | null = null
  /**
   * Ações enviadas que o host ainda não respondeu nem recusou, da mais antiga
   * à mais nova. O host deixa várias esperando o mestre ao mesmo tempo
   * (`MAX_PENDING_POINT_ACTIONS_PER_PLAYER`): sem esta lista, a resposta de
   * uma apagaria a espera das outras.
   */
  let waitingPointActions: PointActionKind[] = []

  function clearPointNoticeTimer(): void {
    if (pointNoticeTimer !== null) clearTimeout(pointNoticeTimer)
    pointNoticeTimer = null
  }

  /** Esquece os pedidos junto com o aviso (lobby, sala fechada, reconexão). */
  function forgetPointActions(): void {
    clearPointNoticeTimer()
    waitingPointActions = []
  }

  /**
   * Tira da tela a espera de todo pedido ainda sem resposta (passagem, porta,
   * ação no ponto, mão). Respostas já na tela ficam: elas somem sozinhas.
   */
  function forgetWaitingRequests(): void {
    const travelWaiting = state.travel?.phase === 'waiting'
    if (travelWaiting) clearTravelTimer()
    const doorSent = state.doorRequest?.phase === 'sent'
    if (doorSent) clearDoorNotice()
    const callWaiting = state.call?.phase === 'waiting'
    if (callWaiting) clearCallTimer()
    const pointWaiting = state.pointNotice?.phase === 'waiting'
    waitingPointActions = []
    setState({
      ...forgetHideWaiting(),
      ...(travelWaiting ? { travel: undefined } : {}),
      ...(doorSent ? { doorRequest: undefined } : {}),
      ...(callWaiting ? { call: undefined } : {}),
      ...(pointWaiting ? { pointNotice: undefined } : {}),
    })
  }

  /** A espera de tudo o que sobrou, ou nada quando não sobrou pedido. */
  function waitingPointNotice(): PointNotice | undefined {
    const [first, ...rest] = waitingPointActions
    return first === undefined ? undefined : { id: nextNoticeId++, phase: 'waiting', actions: [first, ...rest] }
  }

  /** A espera fica até a resposta; resposta e recusa somem sozinhas e devolvem a espera do que sobrou. */
  function showPointNotice(notice: PointNotice | undefined): void {
    clearPointNoticeTimer()
    setState({ pointNotice: notice })
    if (notice === undefined || notice.phase === 'waiting') return
    pointNoticeTimer = setTimeout(() => {
      pointNoticeTimer = null
      setState({ pointNotice: waitingPointNotice() })
    }, POINT_NOTICE_TTL_MS)
  }

  /**
   * Tira da espera o pedido que a mensagem do host fechou. A resposta diz a
   * ação: sai a mais antiga dela (duas iguais não se distinguem na tela). A
   * recusa não diz, mas o host recusa na hora e na ordem em que recebe — é o
   * pedido mais novo ainda sem destino.
   */
  function settlePointAction(reply: PointActionReply): void {
    if (reply.type === 'point.action.rejected') {
      waitingPointActions = waitingPointActions.slice(0, -1)
      return
    }
    const index = waitingPointActions.indexOf(reply.action)
    if (index !== -1) waitingPointActions = waitingPointActions.filter((_, i) => i !== index)
  }

  let leverTimer: ReturnType<typeof setTimeout> | null = null

  function clearLeverTimer(): void {
    if (leverTimer !== null) clearTimeout(leverTimer)
    leverTimer = null
  }

  /** Aviso da alavanca: aparece e some sozinho. */
  function showLeverNotice(phase: LeverPhase): void {
    clearLeverTimer()
    setState({ lever: { id: nextNoticeId++, phase } })
    leverTimer = setTimeout(() => {
      leverTimer = null
      setState({ lever: undefined })
    }, LEVER_NOTICE_TTL_MS)
  }

  let laserTimer: ReturnType<typeof setTimeout> | null = null

  function clearLaserTimer(): void {
    if (laserTimer !== null) clearTimeout(laserTimer)
    laserTimer = null
  }

  /**
   * Atualiza o rastro e agenda a limpeza. Ligado, a limpeza guarda só a ponta
   * (o mestre pode estar parado apontando); desligado, some tudo.
   */
  function updateLaser(next: LaserTrail): void {
    setState({ laser: next })
    clearLaserTimer()
    laserTimer = setTimeout(() => {
      laserTimer = null
      const current = state.laser
      if (current === undefined) return
      const last = current.points.at(-1)
      setState({ laser: current.on && last !== undefined ? { points: [last], on: true } : undefined })
    }, LASER_TRAIL_MS)
  }

  let playerLasersTimer: ReturnType<typeof setTimeout> | null = null

  function clearPlayerLasers(): void {
    if (playerLasersTimer !== null) clearTimeout(playerLasersTimer)
    playerLasersTimer = null
  }

  /**
   * Lasers dos outros jogadores: guarda e agenda a faxina. A cada
   * `LASER_TRAIL_MS` tira quem já sumiu (soltou, ou calou por
   * `REMOTE_LASER_IDLE_MS`), até não sobrar ninguém.
   */
  function updatePlayerLasers(next: RemoteLaser[]): void {
    setState({ playerLasers: next.length === 0 ? undefined : next })
    if (playerLasersTimer !== null || next.length === 0) return
    const sweep = () => {
      playerLasersTimer = null
      const current = state.playerLasers
      if (current === undefined) return
      const kept = pruneRemoteLasers(current, Date.now())
      if (kept.length !== current.length) setState({ playerLasers: kept.length === 0 ? undefined : kept })
      if (kept.length > 0) playerLasersTimer = setTimeout(sweep, LASER_TRAIL_MS)
    }
    playerLasersTimer = setTimeout(sweep, LASER_TRAIL_MS)
  }

  /** Pontos do PRÓPRIO laser à espera da janela de envio (mesmo throttle do laser do mestre, `hostBridge`). */
  let ownLaserBuffer: RegionPoint[] = []
  let ownLaserTimer: ReturnType<typeof setTimeout> | null = null
  /** Saiu algum ponto desde o último `off`: sem isso cada toque solto viraria um `off` à toa. */
  let ownLaserSent = false

  function armOwnLaserTimer(): void {
    ownLaserTimer = setTimeout(() => {
      ownLaserTimer = null
      if (ownLaserBuffer.length === 0) return
      const points = ownLaserBuffer
      ownLaserBuffer = []
      send({ type: 'laser', points })
      armOwnLaserTimer()
    }, LASER_SEND_INTERVAL_MS)
  }

  function resetOwnLaser(): void {
    if (ownLaserTimer !== null) clearTimeout(ownLaserTimer)
    ownLaserTimer = null
    ownLaserBuffer = []
    ownLaserSent = false
  }

  function setState(patch: Partial<PlayerState>): void {
    // Sair do jogo por qualquer caminho encerra a época da cena (ver `sceneEpoch`).
    const leftGame = state.status === 'playing' && patch.status !== undefined && patch.status !== 'playing'
    state = { ...state, ...patch }
    if (leftGame) state = { ...state, sceneEpoch: state.sceneEpoch + 1 }
    for (const listener of listeners) listener()
  }

  /** Próxima tentativa agendada, virada do "Reconectar" e prazo da tentativa no ar. */
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let manualTimer: ReturnType<typeof setTimeout> | null = null
  let attemptTimer: ReturnType<typeof setTimeout> | null = null

  function clearAttemptTimer(): void {
    if (attemptTimer !== null) clearTimeout(attemptTimer)
    attemptTimer = null
  }

  function clearReconnectTimers(): void {
    if (retryTimer !== null) clearTimeout(retryTimer)
    if (manualTimer !== null) clearTimeout(manualTimer)
    retryTimer = null
    manualTimer = null
    clearAttemptTimer()
  }

  /**
   * Caiu depois de entrar: o mapa fica, a tela esmaece, e o cliente tenta
   * voltar sozinho. `rev` volta a -1 porque o host responde a volta com o
   * snapshot do rev ATUAL dele — igual ao último que chegou, se ninguém mexeu
   * em nada — e esse snapshot precisa valer.
   */
  function beginReconnect(): void {
    pending.clear()
    // O host esquece o pedido de passagem de quem cai: "Aguardando o mestre…" mentiria.
    const travelWaiting = state.travel?.phase === 'waiting'
    if (travelWaiting) clearTravelTimer()
    // Mesmo para o esconder-se: o disconnect apaga o pedido no host.
    setState({ rev: -1, reconnecting: { since: Date.now(), attempt: 0, manual: false }, ...(travelWaiting ? { travel: undefined } : {}), ...forgetHideWaiting() })
    manualTimer = setTimeout(() => {
      manualTimer = null
      const info = state.reconnecting
      if (info !== undefined) setState({ reconnecting: { ...info, manual: true } })
    }, MANUAL_RECONNECT_AFTER_MS)
    scheduleAttempt()
  }

  function scheduleAttempt(): void {
    const info = state.reconnecting
    if (info === undefined) return
    if (retryTimer !== null) clearTimeout(retryTimer)
    retryTimer = setTimeout(() => {
      retryTimer = null
      attemptNow()
    }, reconnectDelayMs(info.attempt + 1))
  }

  function attemptNow(): void {
    const info = state.reconnecting
    if (info === undefined) return
    if (retryTimer !== null) clearTimeout(retryTimer)
    retryTimer = null
    setState({ reconnecting: { ...info, attempt: info.attempt + 1 } })
    open()
    const current = socket
    clearAttemptTimer()
    // O prazo vale até o `welcome`: socket que abre e ninguém responde também prende.
    attemptTimer = setTimeout(() => {
      attemptTimer = null
      if (socket !== current) return
      abandonAttempt()
      scheduleAttempt()
    }, RECONNECT_ATTEMPT_TIMEOUT_MS)
  }

  /** Larga a tentativa no ar sem que o `close` dela conte como queda nova. */
  function abandonAttempt(): void {
    clearAttemptTimer()
    stopPing()
    const current = socket
    socket = null
    current?.close()
  }

  function send(message: PlayerMessage): boolean {
    // Tela da mesa só olha: nenhum pedido sai dela, nem se o mestre errar e der uma ficha a ela.
    if (isTable && message.type !== 'join' && message.type !== 'ping') return false
    if (!socket || socket.readyState !== SOCKET_OPEN) return false
    const texto = JSON.stringify(message)
    // O servidor fecha o socket de quem manda acima do teto: melhor a mensagem
    // não sair (quem chamou recebe `false`) do que o jogador cair da mesa.
    // `length * 3` é teto de bytes em UTF-8; só as grandes pagam o encode.
    if (texto.length * 3 > PLAYER_MESSAGE_MAX_BYTES && utf8.encode(texto).length > PLAYER_MESSAGE_MAX_BYTES) return false
    socket.send(texto)
    return true
  }

  function clearWakeProbe(): void {
    if (wakeProbeTimer !== null) clearTimeout(wakeProbeTimer)
    wakeProbeTimer = null
  }

  function stopPing(): void {
    if (pingTimer !== null) clearInterval(pingTimer)
    pingTimer = null
    clearWakeProbe()
  }

  /** O ping diz ao host se a aba está em segundo plano, para ele esperar mais. */
  function sendPing(): void {
    send(isHidden() ? { type: 'ping', away: true } : { type: 'ping' })
  }

  /**
   * O host sumiu sem fechar? Só conta depois de entrar na sala: antes do
   * `welcome` quem decide quanto esperar é a tela (o prazo do aperto de mão).
   */
  function hostSilent(): boolean {
    const since = Math.max(lastHeardAt, watchingSince)
    return socket !== null && state.playerId !== undefined && Date.now() - since >= SILENCE_DEAD_AFTER_MS
  }

  function pingOrGiveUp(): void {
    // Aba oculta: o timer pode estar rodando de minuto em minuto, e o silêncio
    // medido assim é do timer, não do host. Quem decide é o `wake`, à vista.
    if (!isHidden() && hostSilent()) {
      dropSocket()
      return
    }
    sendPing()
  }

  /** A tela acendeu com o host mudo: ping agora e, sem resposta em `WAKE_PROBE_MS`, volta já. */
  function probeAfterWake(): void {
    watchingSince = Date.now()
    sendPing()
    clearWakeProbe()
    const probed = socket
    wakeProbeTimer = setTimeout(() => {
      wakeProbeTimer = null
      if (socket !== probed || lastHeardAt >= watchingSince) return
      dropSocket()
      attemptNow()
    }, WAKE_PROBE_MS)
  }

  /** Depois de kicked/closed/error a queda é esperada: o mestre derrubou de propósito. */
  function sessionOver(): boolean {
    return state.status === 'kicked' || state.status === 'closed' || state.status === 'error' || state.status === 'replaced'
  }

  /** O socket atual morreu (com ou sem `close`): volta sozinho, ou explica na tela. */
  function handleSocketLost(): void {
    if (sessionOver()) return
    if (state.reconnecting !== undefined) {
      // A tentativa falhou (a rede ainda não voltou): a próxima espera mais.
      clearAttemptTimer()
      scheduleAttempt()
      return
    }
    // Já estava na sala: Wi-Fi que pisca ou tela bloqueada. Volta sozinho.
    if (state.playerId !== undefined) {
      beginReconnect()
      return
    }
    // Nunca entrou (endereço errado, sala que não existe): a tela explica.
    setState({ status: 'error', error: CONNECTION_LOST })
  }

  /**
   * Larga o socket que o navegador ainda acha aberto (Wi-Fi que sumiu sem FIN,
   * host que já nos deu como caídos) e segue como se o `close` tivesse chegado.
   * O `close` real, se vier, acha outro socket no lugar e é ignorado.
   */
  function dropSocket(): void {
    const current = socket
    socket = null
    stopPing()
    current?.close()
    handleSocketLost()
  }

  /**
   * Move otimista: aplica local e envia. Devolve o `reqId` do pedido, ou
   * `null` se o token não existe ou o socket não está aberto.
   */
  function sendMove(tokenId: string, x: number, y: number): string | null {
    const map = state.map
    const token = map?.tokens.find((t) => t.id === tokenId)
    if (!map || !token) return null
    const reqId = `m${nextReqId++}`
    if (!send({ type: 'token.move', reqId, tokenId, x, y })) return null
    pending.set(reqId, { tokenId, x, y, prevX: token.x, prevY: token.y })
    // Mexeu a ficha depois de mudar de lugar (chegou, foi levado ou
    // reunido): já viu onde está, o aviso sai.
    const phase = state.travel?.phase
    if (phase === 'gathered' || phase === 'arrived' || phase === 'moved') {
      clearTravelTimer()
      setState({ map: withTokenAt(map, tokenId, x, y), travel: undefined })
      return reqId
    }
    setState({ map: withTokenAt(map, tokenId, x, y) })
    return reqId
  }

  function stopWalk(): void {
    if (walk !== null && walk.timer !== null) clearTimeout(walk.timer)
    walk = null
  }

  /** Manda o próximo trecho da caminhada; sem trecho, ou sem jogo, ela acaba. */
  function stepWalk(): void {
    const current = walk
    if (current === null) return
    const next = current.legs.shift()
    if (next === undefined || state.status !== 'playing') {
      walk = null
      return
    }
    const reqId = sendMove(current.tokenId, next.x, next.y)
    if (reqId === null) {
      walk = null
      return
    }
    current.reqId = reqId
  }

  /** O host aceitou o trecho: o próximo sai depois de a ficha deslizar até a esquina. */
  function continueWalk(reqId: string, x: number, y: number): void {
    const current = walk
    if (current === null || current.reqId !== reqId) return
    current.reqId = null
    current.at = { x, y }
    current.timer = setTimeout(() => {
      current.timer = null
      if (walk === current) stepWalk()
    }, WALK_LEG_PAUSE_MS)
  }

  /**
   * Entre trechos, a ficha que anda saiu da última esquina aceita (ou sumiu do
   * mapa)? Foi o mestre: seguir puxaria a ficha de volta e desfaria a ação dele.
   * Com trecho em voo não dá para saber (o snapshot pode ser de antes do trecho).
   */
  function walkMovedByOthers(map: MapData): boolean {
    if (walk === null || walk.reqId !== null || walk.at === null) return false
    const { tokenId, at } = walk
    const token = map.tokens.find((t) => t.id === tokenId)
    return token === undefined || token.x !== at.x || token.y !== at.y
  }

  function hasNewerPending(reqId: string, tokenId: string): PendingMove | null {
    let seen = false
    for (const [id, move] of pending) {
      if (id === reqId) seen = true
      else if (seen && move.tokenId === tokenId) return move
    }
    return null
  }

  function applySnapshot(
    rev: number,
    map: MapData,
    vision: RegionPoint[][],
    explored: Exploration | undefined,
    ownTokens: string[],
    concealed: RegionPoint[][],
    turn: string | undefined,
    partyTokens: string[],
    hazards: PlayerHazard[],
    confronto: PlayerConfronto | undefined,
    sceneName: string | undefined,
    where: SnapshotPlaces,
    gatilhos: PlayerAreaTrigger[],
    andares: PlayerFloors | undefined,
    relogio: PlayerClock | undefined,
  ): void {
    if (rev <= state.rev) return
    // Outra cena: o resto do caminho era do mapa de antes.
    if (state.map !== undefined && state.map.id !== map.id) stopWalk()
    else if (walkMovedByOthers(map)) stopWalk()
    let next = map
    // Reaplica, em ordem, só os movimentos ainda não confirmados pelo mestre.
    for (const [reqId, move] of pending) {
      const token = next.tokens.find((t) => t.id === move.tokenId)
      if (!token) {
        pending.delete(reqId)
        continue
      }
      move.prevX = token.x
      move.prevY = token.y
      next = withTokenAt(next, move.tokenId, move.x, move.y)
    }
    // Vez de ficha que não veio no mapa não tem o que destacar: vale como ninguém.
    const turnOnMap = turn !== undefined && next.tokens.some((t) => t.id === turn) ? turn : undefined
    // LUGARES: o desenho sai do recorte do MESTRE (`map`), não do `next` com os
    // movimentos otimistas — e nem leva ficha nenhuma (`placeSketch`).
    const { place, places: remembered } = where
    const places = place === undefined ? state.places : rememberPlace(state.places ?? [], place, map, explored, concealed, remembered)
    // `sceneName` entra SEMPRE, inclusive `undefined`: snapshot sem nome apaga o selo da cena anterior.
    // ESCONDER-SE: o mestre deixou — a ficha PEDIDA chega oculta para jogadores, e a espera acaba.
    // Só ela conta: outra ficha própria que o mestre já ocultou chega com `secret` em todo snapshot.
    const hide = state.hide
    const hideDone =
      hide?.phase === 'waiting' && ownTokens.includes(hide.tokenId) && next.tokens.some((t) => t.id === hide.tokenId && t.secret === true)
    if (hideDone) clearHideTimer()
    // O mapa chegou: quem pedia ficha já tem uma, e o pedido termina aqui.
    setState({
      status: 'playing',
      rev,
      map: next,
      vision,
      explored,
      ownTokens,
      partyTokens,
      concealed,
      hazards,
      gatilhos,
      andares,
      relogio,
      turn: turnOnMap,
      confronto,
      sceneName,
      place,
      places,
      error: undefined,
      seatClaim: undefined,
      ...(hideDone ? { hide: undefined } : {}),
    })
  }

  /** Desfaz o movimento recusado. `false` = pedido desconhecido (já resolvido, ou de antes de trocar de cena). */
  function handleRejected(reqId: string, reason: unknown): boolean {
    const move = pending.get(reqId)
    if (!move) return false
    // Trecho recusado: a caminhada para na última esquina aceita.
    if (walk?.reqId === reqId) stopWalk()
    const newer = hasNewerPending(reqId, move.tokenId)
    pending.delete(reqId)
    // Motivo que esta versão não conhece: desfaz igual, só não inventa frase.
    if (isMoveRejection(reason)) showMoveNotice(reason)
    if (newer) {
      // Um movimento mais novo do mesmo token parte desta posição: herda o "anterior".
      newer.prevX = move.prevX
      newer.prevY = move.prevY
      return true
    }
    if (state.map) setState({ map: withTokenAt(state.map, move.tokenId, move.prevX, move.prevY) })
    return true
  }

  function handleAccepted(reqId: string, x: number, y: number): void {
    const move = pending.get(reqId)
    if (!move) return
    const newer = hasNewerPending(reqId, move.tokenId)
    pending.delete(reqId)
    continueWalk(reqId, x, y)
    if (newer) {
      newer.prevX = x
      newer.prevY = y
      return
    }
    if (state.map) setState({ map: withTokenAt(state.map, move.tokenId, x, y) })
  }

  /**
   * Edita o próprio token: valida a posse aqui, envia e aplica LOCAL na hora.
   *
   * Otimista igual ao movimento (`requestMove`), e pelo mesmo motivo: a tela
   * precisa responder ao gesto sem esperar a volta do mestre. O snapshot
   * seguinte é a autoridade e sobrescreve — se o mestre recusar, a tela volta
   * sozinha no próximo `rev`.
   */
  function editOwnToken(tokenId: string, message: PlayerMessage, patch: Partial<Token>): boolean {
    const map = state.map
    if (state.status !== 'playing' || !map) return false
    if (!(state.ownTokens ?? []).includes(tokenId)) return false
    // Ficha emprestada (ajudante contratado, com `contrato`) é do mestre: o host recusa, e a tela nem tenta.
    if (!map.tokens.some((t) => t.id === tokenId && t.contrato === undefined)) return false
    if (!send(message)) return false
    setState({ map: withTokenPatch(map, tokenId, patch) })
    return true
  }

  /**
   * MINHAS PISTAS. O caderno vale também aguardando (é do jogador, não da
   * cena); cartão de colega, lista e resultado só com o mapa na tela.
   */
  function handleClueMessage(data: unknown): void {
    const msg = parseClueMessage(data)
    if (msg === null) return
    switch (msg.type) {
      case 'clues.book':
        setState({ clues: msg.clues })
        return
      case 'clue.added':
        setState({ clues: withClue(state.clues ?? [], msg.clue) })
        return
      case 'clue.shown': {
        // A pista fica no caderno de qualquer jeito; o cartão só abre com o mapa na tela.
        const clues = withClue(state.clues ?? [], msg.clue)
        setState(state.status === 'playing' ? { clues, shownClue: { id: nextNoticeId++, from: msg.from, clue: msg.clue } } : { clues })
        return
      }
      case 'clue.peers':
        // Só quem pediu espera a lista: resposta atrasada de um cartão já fechado não reabre nada.
        if (state.cluePeers?.phase !== 'loading') return
        setState({ cluePeers: { phase: 'ready', names: msg.names } })
        return
      case 'clue.show.result':
        if (state.clueShow?.phase !== 'sending' || state.clueShow.to !== msg.to) return
        setState({ clueShow: { to: msg.to, phase: msg.ok ? 'ok' : msg.reason === 'too_soon' ? 'too_soon' : 'failed' } })
        return
    }
  }

  /** CORREIO: só quem pediu espera a resposta; a atrasada de um pedido que já acabou não muda nada. */
  function handleLetterMessage(data: unknown): void {
    const msg = parseLetterMessage(data)
    if (msg === null) return
    if (msg.type === 'letter.peers') {
      if (state.letterPeers?.phase === 'loading') setState({ letterPeers: { phase: 'ready', names: msg.names } })
      return
    }
    const sending = state.letterSend
    if (sending?.phase !== 'sending' || sending.to !== msg.to) return
    setState({ letterSend: { ...sending, phase: msg.ok ? 'ok' : (msg.reason ?? 'failed') } })
  }

  function handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      return
    }
    if (!isRecord(data)) return
    switch (data.type) {
      case 'welcome':
        // Só mestre antigo (que não conhece a tela da mesa) manda `welcome` a
        // ela: a tela não vira jogador por isso, e a espera vem logo atrás.
        if (isTable) return
        if (typeof data.playerId !== 'string' || typeof data.resumeToken !== 'string') return
        writeResume(storage, { code, token: data.resumeToken })
        // O mestre aceitou (de novo): fim da volta automática, se havia uma.
        clearReconnectTimers()
        // Outro playerId: o mestre disse "É ela" e a "Ana (2)" virou a Ana. O
        // host esqueceu os pedidos da "Ana (2)"; a espera deles mentiria para sempre.
        if (state.playerId !== undefined && state.playerId !== data.playerId) forgetWaitingRequests()
        // O pedido de ficha morre no host com a queda: a espera dele mentiria para sempre.
        // A lista de fichas livres também: o host conta o que mandou POR CONEXÃO,
        // e a desta começa vazia; a velha mostraria como livre a ficha de outro.
        setState({ playerId: data.playerId, status: state.status === 'playing' ? 'playing' : 'waiting', reconnecting: undefined, seatClaim: undefined, seatOptions: undefined })
        return
      case 'lobby.waiting':
        clearSignalTimers()
        clearLaserTimer()
        clearPlayerLasers()
        resetOwnLaser()
        clearDoorNotice()
        clearMoveNotice()
        clearTurnNotice()
        clearTravelTimer()
        clearItemTimer()
        clearLeverTimer()
        clearHazardNotice()
        clearCallTimer()
        clearHideTimer()
        forgetPointActions()
        setState({
          item: undefined,
          lever: undefined,
          // Sem ficha, não há o que esconder: a espera e a recusa saem.
          hide: undefined,
          // Sem cena, nenhum alarme de cena vale; o host manda de novo se ele voltar a uma.
          alarm: undefined,
          // Idem o texto de chegada: é da cena que ele deixou.
          arrival: undefined,
          status: 'waiting',
          map: undefined,
          vision: undefined,
          explored: undefined,
          ownTokens: undefined,
          partyTokens: undefined,
          concealed: undefined,
          // Os lugares ficam (são do jogador); só "onde estou agora" sai.
          sceneName: undefined,
          place: undefined,
          destinations: undefined,
          hazards: undefined,
          hazardNotice: undefined,
          gatilhos: undefined,
          andares: undefined,
          relogio: undefined,
          turn: undefined,
          signals: undefined,
          laser: undefined,
          doorNotice: undefined,
          doorRequest: undefined,
          moveNotice: undefined,
          turnNotice: undefined,
          travel: undefined,
          playerLasers: undefined,
          shownClue: undefined,
          cluePeers: undefined,
          clueShow: undefined,
          call: undefined,
          pointNotice: undefined,
          confronto: undefined,
          letterPeers: undefined,
          letterSend: undefined,
        })
        return
      case 'scene.changed':
        // O mestre deixou passar. Tudo o que era da cena de antes perde o
        // sentido: movimento ainda sem resposta (o `x`/`y` dele é do outro
        // mapa e seria reaplicado em cima do novo), sinais e laser. O mapa
        // novo vem no snapshot logo atrás.
        if (state.status !== 'playing') return
        pending.clear()
        stopWalk()
        clearSignalTimers()
        clearLaserTimer()
        clearPlayerLasers()
        resetOwnLaser()
        clearDoorNotice()
        clearMoveNotice()
        clearTurnNotice()
        clearHazardNotice()
        // A porta tocada ficou na cena de antes: o "Trancada" e os botões dele perdem o sentido.
        // A lista de "Mostrar para…" era de quem estava na cena de antes.
        // O ponto do toque longo era da cena de antes: a época vira.
        setState({ signals: undefined, laser: undefined, playerLasers: undefined, doorNotice: undefined, doorRequest: undefined, moveNotice: undefined, turnNotice: undefined, hazardNotice: undefined, cluePeers: undefined, clueShow: undefined, sceneEpoch: state.sceneEpoch + 1 })
        {
          // TEXTO DE CHEGADA: o da cena nova, ou nenhum — o cartão da cena de
          // antes não fica aberto por cima de outro lugar.
          const chegada = parseArrivalText(data.chegada)
          setState({ arrival: chegada === null ? undefined : { id: nextNoticeId++, text: chegada } })
        }
        // Levado pelo mestre, "Você chegou" mentiria: ele não pediu para ir.
        // Reunido pelo mestre: outro aviso, porque ele não foi levado sozinho.
        showTravelAnswer({ id: nextNoticeId++, phase: data.by === 'gather' ? 'gathered' : data.by === 'master' ? 'moved' : 'arrived' })
        return
      case 'pin.travel.denied': {
        if (state.status !== 'playing') return
        // Motivo estragado não segura a recusa: ele não passou, e lê o "não deixou" de sempre.
        const text = parseTravelDenyText(data.text)
        showTravelAnswer(text === undefined ? { id: nextNoticeId++, phase: 'denied' } : { id: nextNoticeId++, phase: 'denied', text })
        return
      }
      case 'pin.travel.rejected': {
        if (state.status !== 'playing') return
        const { reason } = data
        if (reason !== 'unavailable' && reason !== 'pending' && reason !== 'too_soon') return
        showTravelAnswer({ id: nextNoticeId++, phase: 'rejected', reason })
        return
      }
      case 'scene.note': {
        // O host só manda a quem joga; fora do jogo não há tela de cartão.
        if (state.status !== 'playing') return
        const note = parseSceneNote(data)
        if (note === null) return
        const book = state.notebook ?? []
        // CORREIO: o bilhete de um colega leva quem escreveu e por onde; recado do mestre, só id e texto.
        const sender = note.from !== undefined && note.via !== undefined ? { from: note.from, via: note.via } : {}
        // Recado só para ele leva a marca: a tela diz "Só para você".
        const onlyYou = note.onlyYou === true ? { onlyYou: true as const } : {}
        const open: OpenNote = { id: note.id, text: note.text, ...sender, ...onlyYou }
        // Já guardado (o host reenvia o último recado da cena na volta): reabre o cartão, sem repetir nem virar "novo".
        if (book.some((entry) => entry.id === note.id)) {
          setState({ note: open })
          return
        }
        // Mestre antigo não manda a hora: vale a da chegada.
        const entry: NoteEntry = { id: note.id, text: note.text, at: note.at ?? Date.now(), ...sender }
        setState({
          note: open,
          notebook: [...book, entry].slice(-NOTEBOOK_MAX_NOTES),
          unreadNotes: [...(state.unreadNotes ?? []), note.id].slice(-NOTEBOOK_MAX_NOTES),
        })
        return
      }
      case 'notes.book': {
        // Vale também aguardando: o caderno é do jogador, não da cena.
        const book = parseNotebook(data)
        if (book === null) return
        // Recado que o host já tinha é história, não novidade: só o que ainda estava por ler e continua na lista segue novo.
        const kept = new Set(book.notes.map((entry) => entry.id))
        const stillUnread = (state.unreadNotes ?? []).filter((id) => kept.has(id))
        // CORREIO: o bilhete que chegou com o jogador fora do ar (ou aguardando) vem marcado, e acende o ponto.
        const arrivedUnseen = (book.unread ?? []).filter((id) => !stillUnread.includes(id))
        setState({ notebook: book.notes, unreadNotes: [...stillUnread, ...arrivedUnseen].slice(-NOTEBOOK_MAX_NOTES) })
        return
      }
      case 'clue.added':
      case 'clues.book':
      case 'clue.shown':
      case 'clue.peers':
      case 'clue.show.result':
        handleClueMessage(data)
        return
      case 'letter.peers':
      case 'letter.send.result':
        handleLetterMessage(data)
        return
      case 'dice.rolled': {
        // Vale também aguardando, como o caderno: a rolagem é da mesa, não da cena.
        const rolled = parseDiceRolled(data)
        if (rolled === null) return
        setState({ diceRolls: [...(state.diceRolls ?? []), rolled.roll].slice(-DICE_FEED_MAX) })
        return
      }
      case 'room.text': {
        // Mesma regra do recado: só quem joga tem tela de cartão.
        if (state.status !== 'playing') return
        const roomText = parseRoomText(data)
        if (roomText === null) return
        setState({ roomText: { id: roomText.id, title: roomText.title, text: roomText.text } })
        return
      }
      case 'scene.alarm': {
        // Mesma regra do recado: fora do jogo não há tela onde o alarme fique.
        if (state.status !== 'playing') return
        const alarm = parseSceneAlarm(data)
        if (alarm === null) return
        setState({ alarm: { id: alarm.id, text: alarm.text } })
        return
      }
      case 'scene.alarm.end': {
        const end = parseSceneAlarmEnd(data)
        // Fim de OUTRO alarme (atrasado, já substituído): o aberto fica.
        if (end === null || state.alarm?.id !== end.id) return
        setState({ alarm: undefined })
        return
      }
      case 'scene.paused':
        // Aceito em qualquer estado, e o `lobby.waiting` não apaga: o host só
        // manda quando MUDA, então guardar o último é o que mantém os dois
        // lados de acordo (voltar à cena pausada não reenvia `true`).
        if (typeof data.paused !== 'boolean') return
        setState({ paused: data.paused ? true : undefined })
        return
      case 'party.update': {
        // Vale também na espera: é a lista que ele vê assim que ganhar ficha.
        const party = parsePartyUpdate(data)
        if (party === null) return
        setState({ party: party.members })
        return
      }
      case 'seat.options': {
        // Vale na espera; jogando, fica guardada: o host compara a volta à espera com ela e reenvia se mudou (vazia também).
        const options = parseSeatOptions(data)
        if (options === null) return
        setState({ seatOptions: options.tokens })
        return
      }
      case 'seat.claim.state': {
        // Só responde a um pedido que esta tela fez: sem pedido, nada a mostrar.
        const claim = state.seatClaim
        if (claim === undefined || state.status !== 'waiting' || !isSeatClaimState(data.state)) return
        setState({ seatClaim: { ...claim, phase: data.state } })
        return
      }
      case 'call.state':
        handleCallState(data)
        return
      case 'call.reply': {
        // A resposta do mestre ao chamado: o mesmo cartão do recado, e a mão apaga.
        if (state.status !== 'playing') return
        const reply = parseCallReply(data)
        if (reply === null) return
        clearCallTimer()
        setState({ note: { id: reply.id, text: reply.text }, call: undefined })
        return
      }
      case 'laser': {
        // Laser sem mapa na tela não tem onde aparecer.
        if (state.status !== 'playing') return
        const laser = parseLaserMessage(data)
        if (laser === null) return
        const now = Date.now()
        if ('from' in laser) {
          // Laser de OUTRO jogador: rastro próprio, na cor da ficha dele — nunca se mistura ao do mestre.
          const origin = { key: laser.from, label: laser.from, color: laser.color }
          const update: RemoteLaserUpdate = 'off' in laser ? { off: true } : { points: laser.points }
          updatePlayerLasers(applyRemoteLaser(pruneRemoteLasers(state.playerLasers ?? [], now), origin, update, now))
          return
        }
        const points = state.laser?.points ?? []
        if ('off' in laser) {
          // Não apaga na hora: o rastro que já estava na tela termina de sumir.
          if (state.laser !== undefined) updateLaser({ points: pruneLaserTrail(points, now), on: false })
          return
        }
        updateLaser({ points: appendLaserPoints(points, laser.points, now, LASER_SEND_INTERVAL_MS), on: true })
        return
      }
      case 'signal': {
        // Sinal sem mapa na tela não tem onde aparecer.
        if (state.status !== 'playing') return
        const { x, y, from, color } = data
        if (!isFiniteNumber(x) || !isFiniteNumber(y)) return
        if (typeof from !== 'string' || from.length > NAME_MAX_LENGTH) return
        if (typeof color !== 'string' || !SIGNAL_COLOR_PATTERN.test(color)) return
        addSignal(x, y, from, color)
        return
      }
      case 'point.action.answer':
      case 'point.action.rejected': {
        if (state.status !== 'playing') return
        const reply = parsePointActionReply(data)
        if (reply === null) return
        settlePointAction(reply)
        showPointNotice(
          reply.type === 'point.action.answer'
            ? { id: nextNoticeId++, phase: 'answered', action: reply.action, answer: reply.answer }
            : { id: nextNoticeId++, phase: 'rejected', reason: reply.reason },
        )
        return
      }
      case 'destinations': {
        // Marca sem mapa na tela não tem onde aparecer; torta não entra (a cor vai direto ao desenho).
        if (state.status !== 'playing') return
        const parsed = parseDestinationsMessage(data)
        if (parsed === null) return
        setState({ destinations: parsed.marks })
        return
      }
      case 'door.toggle.rejected': {
        // Aviso sem mapa na tela não tem onde aparecer.
        if (state.status !== 'playing') return
        const { reason } = data
        if (reason !== 'locked' && reason !== 'far' && reason !== 'not_visible') return
        if (typeof data.wallId !== 'string' || data.wallId.length === 0) return
        // A chave só vale no "Trancada" e só como texto curto: é o nome de um item da mochila.
        const key = reason === 'locked' ? cleanItemName(typeof data.key === 'string' ? data.key : '') : ''
        showDoorNotice(reason, data.wallId, key === '' ? undefined : key)
        return
      }
      case 'door.request.rejected': {
        if (state.status !== 'playing') return
        const { reason } = data
        const known = DOOR_REQUEST_REJECTIONS.find((r) => r === reason)
        if (known === undefined) return
        showDoorRequest(known)
        return
      }
      case 'token.hide.rejected': {
        if (state.status !== 'playing') return
        const { reason } = data
        const known = TOKEN_HIDE_REJECTIONS.find((r) => r === reason)
        if (known === undefined) return
        showHideRejection(known)
        return
      }
      case 'door.request.answer': {
        if (state.status !== 'playing') return
        const { answer } = data
        if (answer !== 'opened' && answer !== 'denied') return
        showDoorRequest(answer)
        return
      }
      case 'pin.take.answer': {
        if (state.status !== 'playing') return
        if (data.answer === 'denied') {
          showItemNotice({ id: nextNoticeId++, phase: 'denied' })
          return
        }
        // O nome vai para a tela: só texto, aparado e no teto.
        if (data.answer !== 'taken' || typeof data.nome !== 'string') return
        const nome = cleanItemName(data.nome)
        if (nome === '') return
        showItemNotice({ id: nextNoticeId++, phase: 'taken', nome })
        return
      }
      case 'pin.take.rejected': {
        if (state.status !== 'playing') return
        const reason = PIN_TAKE_REJECTIONS.find((r) => r === data.reason)
        if (reason === undefined) return
        showItemNotice({ id: nextNoticeId++, phase: 'rejected', reason })
        return
      }
      case 'item.give.rejected': {
        if (state.status !== 'playing') return
        const reason = ITEM_GIVE_REJECTIONS.find((r) => r === data.reason)
        if (reason === undefined) return
        showItemNotice({ id: nextNoticeId++, phase: 'give_rejected', reason })
        return
      }
      case 'pin.lever.answer': {
        if (state.status !== 'playing' || data.answer !== 'pulled') return
        showLeverNotice('pulled')
        return
      }
      case 'pin.lever.rejected': {
        if (state.status !== 'playing') return
        const reason = PIN_LEVER_REJECTIONS.find((r) => r === data.reason)
        if (reason === undefined) return
        showLeverNotice(reason)
        return
      }
      case 'snapshot':
      case 'delta': {
        if (!isFiniteNumber(data.rev) || !isMapShape(data.map) || !isVision(data.vision)) return
        // Campos aditivos: ausentes são tolerados (sem memória, sem "meus
        // personagens"); presentes e malformados descartam a mensagem inteira.
        let explored: Exploration | undefined
        if (data.explored !== undefined) {
          const decoded = decodeExploration(data.explored)
          if (decoded === null) return
          explored = decoded
        }
        if (data.ownTokens !== undefined && !isStringList(data.ownTokens)) return
        if (data.concealed !== undefined && !isVision(data.concealed)) return
        if (data.turn !== undefined && !isBoundedId(data.turn)) return
        if (data.partyTokens !== undefined && !isStringList(data.partyTokens)) return
        // ZONA DE PERIGO: ausente = nenhum perigo à vista; malformado derruba a mensagem.
        const hazards = data.hazards === undefined ? [] : parsePlayerHazards(data.hazards)
        if (hazards === null) return
        // CONFRONTO: ausente = sem confronto nesta cena; malformado derruba a mensagem.
        let confronto: PlayerConfronto | undefined
        if (data.confronto !== undefined) {
          const parsed = parsePlayerConfronto(data.confronto)
          if (parsed === null) return
          confronto = parsed
        }
        // O host nunca manda nome vazio (sem nome público o campo nem vem): vazio é forma errada.
        if (data.sceneName !== undefined && !isSceneName(data.sceneName)) return
        const where = parseSnapshotPlaces(data)
        if (where === null) return
        // GATILHO DE ÁREA: ausente = nada revelado; malformado derruba a mensagem.
        const gatilhos = data.gatilhos === undefined ? [] : parsePlayerAreaTriggers(data.gatilhos)
        if (gatilhos === null) return
        // MAPA POR ANDARES: ausente = sem abas; malformado derruba a mensagem.
        const andares = data.andares === undefined ? undefined : parseFloors(data.andares)
        if (andares === null) return
        // RELÓGIO DA CAMPANHA: ausente = sem relógio; malformado derruba a mensagem.
        const relogio = data.relogio === undefined ? undefined : readPlayerClock(data.relogio)
        if (relogio === null) return
        applySnapshot(data.rev, data.map, data.vision, explored, data.ownTokens ?? [], data.concealed ?? [], data.turn, data.partyTokens ?? [], hazards, confronto, data.sceneName, where, gatilhos, andares, relogio)
        return
      }
      case 'hazard.entered': {
        // Aviso sem mapa na tela não tem onde aparecer.
        if (state.status !== 'playing') return
        if (!isHazardKind(data.kind)) return
        showHazardNotice(data.kind)
        return
      }
      case 'token.move.accepted':
        if (typeof data.reqId !== 'string' || !isFiniteNumber(data.x) || !isFiniteNumber(data.y)) return
        handleAccepted(data.reqId, data.x, data.y)
        return
      case 'token.move.rejected':
        if (typeof data.reqId !== 'string') return
        // A ficha já voltou; o aviso do motivo sai em `handleRejected`. 'not_your_turn'
        // vira "Espere sua vez" (não diz de quem é a vez). Motivo desconhecido ou
        // ausente ainda desfaz o movimento; só não vira aviso.
        const undone = handleRejected(data.reqId, data.reason)
        if (undone && data.reason === 'not_your_turn') showTurnNotice()
        return
      case 'kicked':
        writeResume(storage, null)
        clearReconnectTimers()
        setState({ status: 'kicked', reconnecting: undefined })
        return
      case 'room.closed':
        // Sala encerrada: o resume não serve para mais nada, e sinal/laser não têm onde aparecer.
        writeResume(storage, null)
        clearSignalTimers()
        clearLaserTimer()
        clearPlayerLasers()
        resetOwnLaser()
        clearDoorNotice()
        clearMoveNotice()
        clearTurnNotice()
        clearTravelTimer()
        clearItemTimer()
        clearLeverTimer()
        clearHazardNotice()
        clearCallTimer()
        clearReconnectTimers()
        clearHideTimer()
        forgetPointActions()
        setState({ status: 'closed', hide: undefined, playerLasers: undefined, doorNotice: undefined, doorRequest: undefined, moveNotice: undefined, turnNotice: undefined, travel: undefined, item: undefined, lever: undefined, hazardNotice: undefined, call: undefined, reconnecting: undefined, pointNotice: undefined })
        return
      case 'session.replaced':
        // A sessão foi para outra aba (ou aparelho). O resume FICA: é o mesmo
        // da aba nova, e apagar aqui tiraria a volta das duas. Sem reconexão
        // automática — voltar sozinha tomaria a sessão de volta, e a outra aba
        // faria o mesmo. Só o "Usar aqui" (`reconnect`) traz de volta.
        pending.clear()
        clearSignalTimers()
        clearLaserTimer()
        clearDoorNotice()
        clearTravelTimer()
        clearCallTimer()
        clearHideTimer()
        clearReconnectTimers()
        stopPing()
        setState({ status: 'replaced', hide: undefined, doorNotice: undefined, doorRequest: undefined, travel: undefined, call: undefined, reconnecting: undefined })
        return
      case 'error': {
        const reason = typeof data.reason === 'string' ? data.reason : 'unknown'
        // O transporte pode avisar a expulsão como erro: mesmo efeito de `kicked`.
        if (reason === 'kicked') {
          writeResume(storage, null)
          clearReconnectTimers()
          setState({ status: 'kicked', reconnecting: undefined })
          return
        }
        // Mensagem inválida durante o jogo não derruba a sessão.
        if (reason === 'invalid_message' && state.status === 'playing') return
        // Já estava na sala e o host não a conhece mais: ele a deu como caída
        // (a varredura de conexão muda) e este socket é um zumbi. Volta pelo
        // resume, como numa queda — não é caso de tela de erro.
        if (reason === 'not_joined' && state.playerId !== undefined) {
          dropSocket()
          return
        }
        if (reason === 'bad_code') writeResume(storage, null)
        // Erro do mestre na volta (a sala acabou): não há para onde tentar de novo.
        clearReconnectTimers()
        setState({ status: 'error', error: reason, reconnecting: undefined })
        return
      }
      default:
        return
    }
  }

  function open(): void {
    pending.clear()
    const current = createSocket(url)
    socket = current
    current.onopen = () => {
      if (socket !== current) return
      const resume = readResume(storage, code)
      const join: JoinMessage = isTable ? tableJoin(code, name, options.tableKey) : resume ? { type: 'join', code, name, resume } : { type: 'join', code, name }
      // O prazo do silêncio conta a partir de agora, não da conexão anterior.
      lastHeardAt = Date.now()
      send(join)
      stopPing()
      pingTimer = setInterval(pingOrGiveUp, PING_INTERVAL_MS)
    }
    current.onmessage = (event) => {
      if (socket !== current) return
      // Qualquer mensagem do host é prova de vida, não só o pong.
      lastHeardAt = Date.now()
      clearWakeProbe()
      handleMessage(event.data)
    }
    current.onerror = () => {
      // O browser sempre dispara `close` depois; o tratamento fica lá.
    }
    current.onclose = () => {
      if (socket !== current) return
      socket = null
      stopPing()
      handleSocketLost()
    }
  }

  function detach(): void {
    clearReconnectTimers()
    stopWalk()
    stopPing()
    clearSignalTimers()
    clearLaserTimer()
    clearPlayerLasers()
    resetOwnLaser()
    clearDoorNotice()
    clearMoveNotice()
    clearTurnNotice()
    clearTravelTimer()
    clearItemTimer()
    clearLeverTimer()
    clearHazardNotice()
    clearCallTimer()
    clearHideTimer()
    forgetPointActions()
    const current = socket
    socket = null
    current?.close()
  }

  open()

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    requestMove(tokenId, x, y) {
      // O dedo manda mais que o "Andar até aqui": arrastar a ficha para a caminhada.
      stopWalk()
      return sendMove(tokenId, x, y) !== null
    },
    requestWalk(tokenId, legs) {
      stopWalk()
      if (state.status !== 'playing' || legs.length === 0) return false
      if (!legs.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return false
      if (!state.map?.tokens.some((t) => t.id === tokenId)) return false
      walk = { tokenId, legs: legs.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })), reqId: null, timer: null, at: null }
      stepWalk()
      return walk !== null
    },
    sendSignal(x, y, audience) {
      if (state.status !== 'playing' || !Number.isFinite(x) || !Number.isFinite(y)) return false
      const point = { x: Math.round(x), y: Math.round(y) }
      return send(audience === undefined ? { type: 'signal', ...point } : { type: 'signal', ...point, audience })
    },
    markDestination(x, y) {
      if (state.status !== 'playing' || !Number.isFinite(x) || !Number.isFinite(y)) return false
      return send({ type: 'destination', x: Math.round(x), y: Math.round(y) })
    },
    clearDestination() {
      if (state.status !== 'playing') return false
      return send({ type: 'destination', clear: true })
    },
    toggleDoor(wallId) {
      if (state.status !== 'playing' || wallId.length === 0) return false
      return send({ type: 'door.toggle', wallId })
    },
    sendPointAction(action, x, y) {
      if (state.status !== 'playing' || state.map === undefined || !Number.isFinite(x) || !Number.isFinite(y)) return false
      const point = { x: Math.round(x), y: Math.round(y) }
      // Fora do mapa o host recusa: nem sai, para não mostrar "esperando o mestre".
      if (!isPointInsideMap(state.map, point.x, point.y)) return false
      if (!send({ type: 'point.action', action, x: point.x, y: point.y })) return false
      waitingPointActions = [...waitingPointActions, action]
      showPointNotice(waitingPointNotice())
      return true
    },

    requestDoor(wallId, how) {
      if (state.status !== 'playing' || wallId.length === 0 || !isDoorRequestHow(how)) return false
      if (!send({ type: 'door.request', wallId, how })) return false
      showDoorRequest('sent')
      return true
    },

    requestHide(tokenId) {
      if (state.status !== 'playing' || state.hide?.phase === 'waiting') return false
      if (!(state.ownTokens ?? []).includes(tokenId)) return false
      const token = state.map?.tokens.find((t) => t.id === tokenId)
      // Já escondida: não há o que pedir (só o mestre revela).
      if (token === undefined || token.secret === true) return false
      if (!send({ type: 'token.hide.request', tokenId })) return false
      clearHideTimer()
      setState({ hide: { id: nextNoticeId++, phase: 'waiting', tokenId } })
      return true
    },

    useDoorKey(wallId) {
      if (state.status !== 'playing' || wallId.length === 0) return false
      if (!send({ type: 'door.useKey', wallId })) return false
      // A porta aberta chega no snapshot; se não valer, a recusa do host reabre o aviso.
      clearDoorNotice()
      setState({ doorNotice: undefined })
      return true
    },

    dismissDoorNotice() {
      if (state.doorNotice === undefined) return
      clearDoorNotice()
      setState({ doorNotice: undefined })
    },

    callCabine(pinId) {
      if (state.status !== 'playing' || pinId.length === 0) return false
      return send({ type: 'cabine.call', pinId })
    },

    requestTravel(pinId, exitId) {
      // O pino livre agenda o envio (e o aviso "Passando…") antes de chamar `send`: a tela da mesa sai aqui.
      if (isTable || state.status !== 'playing' || pinId.length === 0 || state.travel?.phase === 'waiting') return false
      const pin = state.map?.pins.find((p) => p.id === pinId)
      // Livre, ou trancado que a chave da mochila abre (CHAVE ABRE PORTA): ninguém decide, a passagem é direta.
      const direct = pin !== undefined && (passageOf(pin) === 'livre' || (passageOf(pin) === 'trancada' && typeof pin.chave === 'string' && pin.chave !== ''))
      // Sem saída escolhida, a mensagem sai idêntica à de antes: o mestre
      // antigo, que não conhece `exitId`, continua entendendo o pedido.
      const pedido: PinTravelRequestMessage = exitId === undefined ? { type: 'pin.travel.request', pinId } : { type: 'pin.travel.request', pinId, exitId }
      // Pino livre não espera ninguém: o aviso diz "Passando…", não "Aguardando
      // o mestre". E o pedido sai depois de um instante, não no mesmo toque: a
      // resposta do host é quase imediata, e sem a pausa a tela trocava de cena
      // no mesmo quadro em que o cartão fechava — o jogador não via a passagem
      // acontecer, só um salto. Pedir de novo logo depois do "Não" também
      // espera: o que falta dos limites do host, em vez de voltar "too_soon".
      const wait = Math.max(direct ? FREE_PASSAGE_BEAT_MS : 0, travelPaceDelay(pinId))
      if (wait === 0) {
        if (!sendTravel(pedido)) return false
        clearTravelTimer()
        setState({ travel: { id: nextNoticeId++, phase: 'waiting', direct: false } })
        return true
      }
      if (socket === null || socket.readyState !== SOCKET_OPEN) return false
      clearTravelTimer()
      setState({ travel: { id: nextNoticeId++, phase: 'waiting', direct } })
      travelTimer = setTimeout(() => {
        travelTimer = null
        if (state.status !== 'playing') return
        // O socket caiu na pausa: sem pedido no ar, o aviso não pode ficar.
        if (!sendTravel(pedido)) setState({ travel: undefined })
      }, wait)
      return true
    },

    laserMove(x, y) {
      if (state.status !== 'playing' || !Number.isFinite(x) || !Number.isFinite(y)) return false
      if (socket === null || socket.readyState !== SOCKET_OPEN) return false
      // Inteiro basta para o rastro e encurta o payload que sai 20 vezes por segundo.
      const point = { x: Math.round(x), y: Math.round(y) }
      if (ownLaserTimer === null) {
        ownLaserSent = send({ type: 'laser', points: [point] }) || ownLaserSent
        armOwnLaserTimer()
        return true
      }
      // Acima do teto sai o ponto mais antigo: o host descartaria o lote inteiro.
      if (ownLaserBuffer.length >= LASER_MAX_POINTS_PER_MESSAGE) ownLaserBuffer.shift()
      ownLaserBuffer.push(point)
      ownLaserSent = true
      return true
    },

    laserOff() {
      if (!ownLaserSent) return
      // O que ainda esperava a janela sai antes do `off`: é a ponta onde o dedo parou.
      const rest = ownLaserBuffer
      resetOwnLaser()
      if (rest.length > 0) send({ type: 'laser', points: rest })
      send({ type: 'laser', off: true })
    },

    takePin(pinId) {
      if (state.status !== 'playing' || pinId.length === 0) return false
      const pin = state.map?.pins.find((p) => p.id === pinId)
      const item = pin === undefined ? null : itemOfPin(pin)
      if (item === null) return false
      if (!send({ type: 'pin.take', pinId })) return false
      showItemNotice({ id: nextNoticeId++, phase: 'sent', direct: item.livre === true })
      return true
    },

    giveItem(itemId, toTokenId) {
      if (state.status !== 'playing' || toTokenId.length === 0) return false
      const own = state.ownTokens ?? []
      const carrying = (state.map?.tokens ?? []).some((t) => own.includes(t.id) && carriedItemsOf(t).some((item) => item.id === itemId))
      if (!carrying) return false
      return send({ type: 'item.give', itemId, toTokenId })
    },

    pullLever(pinId) {
      if (state.status !== 'playing' || pinId.length === 0) return false
      const pin = state.map?.pins.find((p) => p.id === pinId)
      if (pin?.kind !== 'alavanca') return false
      return send({ type: 'pin.lever', pinId })
    },

    dismissNote() {
      const open = state.note
      if (open === undefined) return
      setState({ note: undefined, unreadNotes: (state.unreadNotes ?? []).filter((id) => id !== open.id) })
    },

    markNotebookRead() {
      if ((state.unreadNotes ?? []).length > 0) setState({ unreadNotes: undefined })
    },

    openRoomText(regionId) {
      // Só o que JÁ chegou no mapa: o host manda o texto a quem entrou na Sala.
      const room = state.map?.regions.find((r) => r.id === regionId)?.room
      const text = room?.textoAoEntrar
      if (room === undefined || text === undefined || !hasEnterText(room)) return false
      setState({ roomText: { id: regionId, title: room.name, text } })
      return true
    },

    dismissRoomText() {
      if (state.roomText !== undefined) setState({ roomText: undefined })
    },

    readClue(pinId) {
      if (state.status !== 'playing') return false
      const pin = state.map?.pins.find((p) => p.id === pinId)
      // Cartão vazio ("O mestre ainda não escreveu nada") não é pista: nem pede.
      if (pin === undefined || (pin.description.trim() === '' && !isPlayerSafePinImage(pin.image))) return false
      return send({ type: 'clue.read', pinId })
    },

    askCluePeers() {
      if (state.status !== 'playing' || !send({ type: 'clue.peers' })) return false
      setState({ cluePeers: { phase: 'loading' }, clueShow: undefined })
      return true
    },

    showClue(clueId, to) {
      if (state.status !== 'playing' || !(state.clues ?? []).some((entry) => entry.id === clueId)) return false
      if (!send({ type: 'clue.show', clueId, to })) return false
      setState({ clueShow: { to, phase: 'sending' } })
      return true
    },

    resetClueShare() {
      if (state.cluePeers !== undefined || state.clueShow !== undefined) setState({ cluePeers: undefined, clueShow: undefined })
    },

    dismissShownClue() {
      if (state.shownClue !== undefined) setState({ shownClue: undefined })
    },

    raiseHand(reason, text) {
      // Mão já acesa: o toque repetido não vira outro chamado.
      if (state.status !== 'playing' || state.call?.phase === 'waiting') return false
      const limpo = text?.trim() ?? '' // sem texto = só o motivo
      if (limpo.length > CALL_TEXT_MAX_LENGTH) return false
      const message: CallRaiseMessage = limpo === '' ? { type: 'call.raise', reason } : { type: 'call.raise', reason, text: limpo }
      if (!send(message)) return false
      clearCallTimer()
      setState({ call: { id: nextNoticeId++, phase: 'waiting', reason } })
      return true
    },

    lowerHand() {
      if (state.call?.phase !== 'waiting') return false
      if (!send({ type: 'call.lower' })) return false
      setState({ call: undefined })
      return true
    },

    askLetterPeers() {
      if (state.status !== 'playing' || !send({ type: 'letter.peers' })) return false
      setState({ letterPeers: { phase: 'loading' } })
      return true
    },

    sendLetter(to, via, text) {
      const limpo = text.trim()
      if (state.status !== 'playing' || to.length === 0 || limpo.length === 0 || limpo.length > LETTER_TEXT_MAX_LENGTH) return false
      if (!send({ type: 'letter.send', to, via, text: limpo })) return false
      setState({ letterSend: { to, via, phase: 'sending' } })
      return true
    },

    rollDice(request) {
      // O mesmo filtro do host: pedido fora da faixa nem sai (ele recusaria a mensagem inteira).
      const valid = parseDiceRequest(request)
      if (valid === null) return false
      return send({ type: 'dice.roll', ...valid })
    },

    dismissArrival() {
      if (state.arrival !== undefined) setState({ arrival: undefined })
    },

    claimSeat(tokenId) {
      if (state.status !== 'waiting') return false
      // Um pedido por vez: o mestre ainda não respondeu o anterior.
      const phase = state.seatClaim?.phase
      if (phase === 'sent' || phase === 'pending') return false
      const option = (state.seatOptions ?? []).find((candidate) => candidate.tokenId === tokenId)
      if (option === undefined || !send({ type: 'seat.claim', tokenId })) return false
      setState({ seatClaim: { id: nextNoticeId++, phase: 'sent', tokenId, name: option.name } })
      return true
    },

    setOwnTokenName(tokenId, name) {
      const limpo = name.trim()
      if (limpo.length < NAME_MIN_LENGTH || limpo.length > NAME_MAX_LENGTH) return false
      return editOwnToken(tokenId, { type: 'token.edit', tokenId, name: limpo }, { name: limpo })
    },

    setOwnTokenPhoto(tokenId, image) {
      // Forma certa E tamanho que o servidor aceita: acima do teto de envio a
      // foto nem sai — o jogador fica na mesa com a foto de antes.
      if (!fitsTokenPhotoSend(image)) return false
      // `image: null` junto: o caminho do disco do mestre (quando havia um)
      // deixa de valer para este token — a foto agora é a que o jogador
      // escolheu, e é a embutida que viaja. Mesma forma que o host vai gravar.
      return editOwnToken(tokenId, { type: 'token.edit', tokenId, image }, { image: null, imageData: image })
    },
    reconnect() {
      detach()
      // `places` fica: o host não reenvia o desenho dos lugares de antes, e o
      // primeiro snapshot da volta solta o que ele não lembrar mais.
      setState({ status: 'connecting', hide: undefined, error: undefined, rev: -1, map: undefined, vision: undefined, explored: undefined, ownTokens: undefined, partyTokens: undefined, concealed: undefined, sceneName: undefined, place: undefined, destinations: undefined, hazards: undefined, hazardNotice: undefined, gatilhos: undefined, andares: undefined, relogio: undefined, turn: undefined, signals: undefined, laser: undefined, playerLasers: undefined, doorNotice: undefined, doorRequest: undefined, moveNotice: undefined, turnNotice: undefined, travel: undefined, note: undefined, arrival: undefined, alarm: undefined, item: undefined, lever: undefined, roomText: undefined, notebook: undefined, unreadNotes: undefined, clues: undefined, shownClue: undefined, cluePeers: undefined, clueShow: undefined, paused: undefined, call: undefined, reconnecting: undefined, pointNotice: undefined, letterPeers: undefined, letterSend: undefined })
      open()
    },
    wake() {
      if (state.reconnecting !== undefined) {
        // Tentativa no ar tem o prazo dela; duas de uma vez só brigariam pelo socket.
        if (socket === null) attemptNow()
        return
      }
      if (sessionOver() || socket === null) return
      // A tela ficou apagada e os timers nem rodaram (ou rodaram de minuto em
      // minuto): o socket pode estar morto sem saber, ou vivo. Mudo há mais que
      // o prazo = confirma com um ping curto, e sem resposta a volta tenta já —
      // a pessoa está olhando. Senão, um ping agora confirma mais cedo.
      if (hostSilent()) {
        probeAfterWake()
        return
      }
      sendPing()
    },
    retryNow() {
      if (state.reconnecting === undefined) return
      abandonAttempt()
      attemptNow()
    },
    close: detach,
  }
}
