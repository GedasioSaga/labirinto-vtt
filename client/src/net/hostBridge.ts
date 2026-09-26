import type { InvokeArgs } from '@tauri-apps/api/core'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { useToastStore, type ToastAction, type ToastResposta } from '../stores/toastStore'
import type { MapData, PinPassage, RegionPoint, Token } from '../types/map'
import { NO_OWNER_RADII, type OwnerVisionRadii } from '../lib/imposedOccupancy'
import { LASER_MAX_POINTS_PER_MESSAGE, LASER_SEND_INTERVAL_MS } from '../lib/laser'
import { pointActionMasterText, type PointActionAnswer } from '../lib/pointActions'
import type { StoredToken } from '../lib/storedTokens'
import { addTravel, travelLogEntry, undoableTravelIds, withoutTravel, type TravelLogEntry } from '../lib/travelLog'
import { CHEGADA_TOAST_MS, createArrivalAnnouncer } from './avisoDeChegada'
import {
  preferredRoomCode,
  reclaimText,
  roomCodeChangedText,
  SAVED_EXPLORATION_VERSION,
  SAVED_TABLE_VERSION,
  type SavedExploration,
  type SavedTable,
} from '../lib/savedTable'
import type { ChamadaAceita, MovimentoDeCabine } from '../lib/cabine'
import {
  createHostSession,
  ownTokenIdsOf,
  PEEK_DURATION_MS,
  peekNoticeText,
  singleSceneWorld,
  type AppliedItems,
  type AppliedMove,
  type AppliedDoor,
  type AppliedPiso,
  type AppliedTokenEdit,
  type DoorKeyUse,
  type DoorRequest,
  type HideRequest,
  type ItemRequest,
  type AppliedLock,
  type AppliedMark,
  type LockAttempt,
  type PurchaseRequest,
  type BarDispute,
  type AppliedTransfer,
  type GiveMapOutcome,
  type CaravanStop,
  type HazardEntryNotice,
  type GatherArrival,
  type HeldTokens,
  type ChamadaParaMestre,
  type HostDiceRoll,
  type AreaTriggerEntryNotice,
  type HostPeek,
  type HostResult,
  type HostPlayerLaser,
  type HostSession,
  type HostSignal,
  type HostWorld,
  type MasterCall,
  type LetterRequest,
  type LoanTerms,
  type PinKeyUse,
  type MapChangeCause,
  type Outbound,
  type PinClueState,
  type PlayerInfo,
  type PlayerNoteDelivery,
  type PointActionRequest,
  type ReclaimedSeat,
  type ReturnCandidate,
  type SeatClaim,
  type SecretCheckState,
  type TokenActionRequest,
  type TravelCancelled,
  type TrancaAviso,
  type TravelRequest,
} from './hostSession'
import { distanceLabel, TOKEN_ACTION_LABELS, TOKEN_ACTION_REPLY_MAX_LENGTH } from '../lib/tokenActions'
import { linhaDoPedidoVivo } from '../lib/pedidoVivo'
import {
  CALL_REASON_LABELS,
  clampTravelDenyText,
  NOTE_MAX_LENGTH,
  parsePlayerMessage,
  TRAVEL_DENY_TEXT_MAX_LENGTH,
  type DoorRequestHow,
  type HostErrorReason,
  type LaserMessage,
} from './protocol'
import type { AbaloContagem, AbaloOrigem, AbaloTextos } from '../lib/abalo'
import { letterViaPhrase } from '../lib/correio'
import { createPlayerScreens, type PlayerScreen } from './playerScreens'
import { criarSaidaEmOrdem } from './pacoteComprimido'
import { guardSightingNotices } from './guardNotices'
import type { TurnRef } from '../lib/initiative'
import { hazardEntryLine } from '../lib/hazards'
import type { DiceRequest } from '../lib/dice'
import { areaTriggerEntryLine } from '../lib/areaTriggers'

/**
 * Costura entre a sessão pura (`hostSession`) e o transporte Rust (comandos
 * `net_*` e eventos `net:*`). `invoke`/`listen` entram por injeção para os
 * testes rodarem sem Tauri.
 *
 * Contrato com o Rust: `clientId` é string em `net:message` {clientId, msg},
 * `net:peer` {clientId, event, name?}, `net_send({clientId, msg})` e
 * `net_kick({clientId})`.
 */

/** Quanto o aviso "Ana deixou um bilhete…" fica na tela: dá para ler o texto e decidir "Apagar". */
export const MARK_NOTICE_MS = 12_000

export interface RoomInfo {
  code: string
  urls: string[]
  qrSvg: string
}

/** Estado do link público (Cloudflare Quick Tunnel) visto pelo painel. */
export type TunnelState =
  | { kind: 'idle' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'connecting' }
  | { kind: 'ready'; url: string; qrSvg: string }
  | { kind: 'error'; message: string }

const TUNNEL_IDLE: TunnelState = { kind: 'idle' }

/** Formas mínimas que `invoke`/`listen` reais de `@tauri-apps/api` satisfazem. */
export type InvokeFn = (cmd: string, args?: InvokeArgs) => Promise<unknown>
export type ListenFn = (event: string, handler: (event: { payload: unknown }) => void) => Promise<UnlistenFn>

export interface HostBridgeDeps {
  invoke: InvokeFn
  listen: ListenFn
  getMap: () => MapData
  /**
   * A aventura inteira: cena aberta e cenas de fundo. Ausente = só o mapa de
   * `getMap` (mapa solto), e todo jogador vê a cena aberta, como antes.
   */
  getWorld?: () => HostWorld
  /** `sceneId`: cena de FUNDO onde o token está; ausente = a cena aberta no editor. */
  applyMove: (tokenId: string, x: number, y: number, sceneId?: string) => void
  /**
   * CARAVANA: fichas do grupo que acompanham a caravana, SEM passar pelo
   * desfazer. Elas são consequência da edição que as disparou (o arrasto do
   * mestre, que já tem o seu passo): com histórico, cada Ctrl+Z desfaria um
   * seguidor só, e o seguidor refeito apagaria o refazer. Ausente = `applyMove`.
   */
  applyCaravanMoves?: (moves: readonly AppliedMove[]) => void
  /** Porta que o jogador abriu/fechou, já validada pela sessão (visível, destrancada, token perto). `sceneId` como em `applyMove`. */
  applyDoor: (wallId: string, open: boolean, sceneId?: string) => void
  /**
   * "Destrancar e abrir" do pedido da porta trancada: tirar o cadeado e abrir
   * a porta `wallId` (na cena de fundo `sceneId`, quando vier). Sem este
   * retorno, o pedido nem chega ao mestre — ninguém saberia atender — e o
   * jogador lê "O mestre disse não".
   */
  unlockAndOpenDoor?: (wallId: string, sceneId?: string) => void
  /**
   * ESCONDER-SE: o "Deixar" do mestre liga "Oculto para jogadores" na ficha
   * `tokenId`, na cena `sceneId` (ausente = a aberta). Decisão do mestre: passo
   * do Ctrl+Z dele. Sem este retorno, o pedido é recusado na hora.
   */
  hideToken?: (tokenId: string, sceneId?: string) => void
  /**
   * ITEM PEGÁVEL: gravar a troca de lugar do item (pino que sai, mochilas
   * novas) na cena `change.sceneId` — a aberta quando ausente. Sem este
   * retorno, "Pegar" nem chega ao mestre e o jogador lê "O mestre disse não".
   */
  applyItems?: (change: AppliedItems) => void
  /**
   * Nome/foto novos do token do jogador, já validados pela sessão (o token é
   * dele e a foto é auto-contida). Opcional como `onSignal`: quem monta a
   * ponte sem este retorno simplesmente não oferece a edição ao jogador.
   */
  applyTokenEdit?: (edit: AppliedTokenEdit) => void
  /**
   * FECHADURA COM SEGREDO: o jogador acertou a combinação (a sessão já
   * conferiu). O integrador abre a fechadura e destranca a porta ligada.
   * Opcional como `applyTokenEdit`.
   */
  applyLock?: (lock: AppliedLock) => void
  /**
   * BILHETE NO LUGAR: a marca que o jogador cravou (a sessão já conferiu). O
   * integrador a grava no mapa da cena. Opcional como `applyTokenEdit`: sem
   * ele, a marca não fica e o mestre não é avisado.
   */
  applyMark?: (mark: AppliedMark) => void
  /**
   * "Apagar" do aviso da marca: tira a marca `markId` da cena que a tem NA
   * HORA do clique (o mestre pode ter trocado de cena desde o aviso). `false`
   * quando ela já não estava em cena nenhuma.
   */
  removeMark?: (markId: string) => boolean
  /**
   * PISOS NA MESMA CENA: a ficha do jogador subiu/desceu pela escada, já
   * validada pela sessão. Opcional como `applyTokenEdit`: sem ele, o pedido do
   * jogador simplesmente não muda nada.
   */
  applyPiso?: (change: AppliedPiso) => void
  /**
   * O mestre deixou o jogador passar: mover o token entre as cenas. `false`
   * quando não deu (cena sumiu, token sumiu) — o jogador recebe a recusa em
   * vez de "Você chegou". Sem este retorno, pedido de passagem nem chega ao
   * mestre: ninguém saberia atender.
   */
  applyTransfer?: (transfer: AppliedTransfer) => boolean
  /**
   * CABINE DE TRANSPORTE: quem passou pela parada levou a cabine — gravar a
   * posição nova na aventura. Só é chamado depois de `applyTransfer` mover a
   * ficha. Ausente = a cabine fica onde estava (o mestre a traz pelo painel).
   */
  applyCabine?: (movimento: MovimentoDeCabine) => void
  /**
   * CABINE DE TRANSPORTE: um jogador chamou a cabine — pôr a chamada na fila
   * da aventura. `false` quando não entrou (a parada já estava na fila, a
   * cabine chegou lá): aí o mestre não é avisado de novo. Ausente = a
   * chamada não chega a lugar nenhum (e o mestre não é avisado).
   */
  applyChamadaDeCabine?: (chamada: ChamadaAceita) => boolean
  /**
   * "Passar para pede" do pedido pelo pino trancado: trocar o modo do pino
   * `pinId` (na cena de fundo `sceneId`, quando vier; ausente = a aberta).
   * Sem este retorno a linha do pedido trancado não oferece "Passar para pede".
   */
  setPinPassage?: (pinId: string, passagem: PinPassage, sceneId?: string) => void
  /** "Ir lá" do aviso de chegada: abrir `sceneId` no editor com (`x`, `y`) no centro, no `piso` onde a ficha chegou. */
  onGoToScene?: (sceneId: string, x: number, y: number, piso: number) => void
  visionRadius?: number
  onPlayersChange?: (players: PlayerInfo[]) => void
  /** "Quem vê" de cada pino com lista (`pinId` -> jogadores); pino de "Todos" não aparece. Sala fechada = `{}`. */
  onPinAudiencesChange?: (audiences: Record<string, string[]>) => void
  /**
   * Diário de viagens (G15), a mais nova em cima: muda a cada ficha que troca
   * de cena, a cada "Desfazer" e ao abrir/fechar a sala. Só do mestre.
   */
  onTravelLogChange?: (log: TravelLogEntry[]) => void
  /**
   * PAINEL PISTAS: quem recebeu e quem leu cada pino (`pinId` -> estado). Sai a
   * cada mudança, inclusive na hora em que o jogador abre o cartão. Sala
   * fechada = `{}`.
   */
  onPinCluesChange?: (clues: Record<string, PinClueState>) => void
  /** "Revelar para…" de cada ficha/escada/zona revelada a alguém (`itemId` -> jogadores). Sala fechada = `{}`. */
  onSecretRevealsChange?: (reveals: Record<string, string[]>) => void
  /** TESTES SECRETOS e as respostas, só para o painel do mestre. Sala fechada = `[]`. */
  onSecretChecksChange?: (checks: SecretCheckState[]) => void
  onTunnelChange?: (state: TunnelState) => void
  /** Sinal aceito de um jogador (já validado e dentro do limite por segundo). */
  onSignal?: (signal: HostSignal) => void
  /** Laser de um jogador (lote ou fim do gesto), já validado e dentro do limite. */
  onPlayerLaser?: (laser: HostPlayerLaser) => void
  /** INICIATIVA: de quem é a vez no mestre. O jogador só recebe o recorte (`turnForPlayer`). */
  getTurn?: () => TurnRef | null
  /** RELÓGIO DA CAMPANHA: a hora do dia no mestre. O jogador só recebe o recorte (`clockForPlayer`). */
  getClock?: () => number | null
  /** TELA DA MESA: quantas telas estão conectadas mudou (entrou, caiu, sala fechou). */
  onTableScreensChange?: (screens: number) => void
  /** Chamado NOVO de um jogador: o bipe. A linha na caixa "Chamados" a ponte já põe. */
  onCall?: (call: MasterCall) => void
  /**
   * "Ir lá" do chamado e "Ver" do pedido de passagem: o editor vai à cena de
   * quem chamou ou pediu (`null` = mapa solto, a cena aberta) com a ficha dele
   * no centro. Ausente = sem "Ir lá" nem "Ver".
   */
  onGoToPoint?: (sceneId: string | null, x: number, y: number) => void
  /**
   * "Ir lá" de uma AÇÃO NO PONTO: abrir a cena do pedido centrada no ponto e
   * marcá-lo. Sem este retorno a linha da Caixa vem sem o "Ir lá" (o pedido
   * continua chegando, e "Nada aqui"/"Feito" respondem igual).
   */
  onPointActionGo?: (request: PointActionRequest) => void
  /**
   * "Guardar ficha": tirar a ficha `tokenId` do mapa (da cena de fundo
   * `sceneId`, quando vier; ausente = a cena aberta). Sem este retorno e o
   * `restoreToken`, o mestre não tem "Guardar ficha".
   */
  removeToken?: (tokenId: string, sceneId?: string) => void
  /** A ficha guardada volta ao mapa, igual ao que era, na cena `sceneId` (ausente = a aberta). */
  restoreToken?: (token: Token, sceneId?: string) => void
  /** Retomar a mesa: a mesa guardada desta aventura (`null` = nenhuma). Ausente = a ponte não retoma. */
  loadTable?: () => SavedTable | null
  /** Grava a mesa a cada mudança de dono, raio ou cena. Ausente = nada é gravado. */
  saveTable?: (table: SavedTable) => void
  /** Retomar a mesa: o mapa explorado guardado de cada jogador (`null` = nenhum). Só é lido ao retomar. */
  loadExploration?: () => SavedExploration | null
  /** Grava o mapa explorado pouco depois de mudar e ao fechar a sala. Ausente = nada é gravado. */
  saveExploration?: (exploration: SavedExploration) => void
  /** DADO ROLADO NA SALA: toda rolagem da mesa (a de um jogador e a do mestre, a escondida marcada). */
  onDiceRoll?: (roll: HostDiceRoll) => void
  now?: () => number
}

export interface StartOptions {
  /** `true` = "Retomar a mesa": quem entrar com o nome de um assento guardado reencontra as fichas. */
  resume?: boolean
}

export interface HostBridge {
  start(options?: StartOptions): Promise<RoomInfo>
  stop(): Promise<void>
  /**
   * O mapa da cena aberta mudou. `'history'` = foi desfazer/refazer: a
   * caravana não lê isso como arrasto (`HostSession.followCaravans`).
   */
  notifyMapChanged(cause?: MapChangeCause): void
  assignToken(playerId: string, tokenId: string): void
  unassignToken(playerId: string, tokenId: string): void
  /** AJUDANTE CONTRATADO: empresta e arma o despertador do prazo (a ficha volta sozinha). */
  lendToken(playerId: string, tokenId: string, terms: LoanTerms): void
  kick(clientId: string): Promise<void>
  players(): PlayerInfo[]
  /**
   * MOVIMENTO IMPOSTO: o raio que o host aplica a cada ficha com dono, neste
   * `map` (`HostSession.tokenVisionRadii`). Sala fechada = nenhum raio.
   */
  tokenVisionRadii(map: MapData): OwnerVisionRadii
  /** Jogadores com conexão viva agora (0 com a sala fechada): quem cai se o mestre fechar o app. */
  connectedPlayerCount(): number
  room(): RoomInfo | null
  /** Nunca rejeita: falha vira estado `error` + toast. */
  startTunnel(): Promise<void>
  stopTunnel(): Promise<void>
  tunnel(): TunnelState
  /** Ponteiro do laser em px de mundo; sai em lotes de no máximo 1 envio a cada `LASER_SEND_INTERVAL_MS`. */
  laserMove(x: number, y: number): void
  /** Soltou o laser: `laser {off}` para todos, só se algo foi enviado desde o último off. */
  laserOff(): void
  /** Raio de visão só deste jogador (`null` = global). Vem de um slider: o snapshot sai pelo throttle do mapa. */
  setVisionRadius(playerId: string, radius: number | null): void
  /** "Fator de visão" deste jogador (`null` = x1,0). Vem de um slider: mesmo throttle do raio. */
  setVisionFactor(playerId: string, factor: number | null): void
  /**
   * "Quem vê" do pino: só `playerIds` o recebem; `null` = Todos. Snapshot na
   * hora — o jogador marcado vê o pino sem recarregar, e o desmarcado o perde.
   */
  setPinAudience(pinId: string, playerIds: readonly string[] | null): void
  /**
   * "Mostrar agora a…": o cartão do pino abre sozinho na tela deste jogador.
   * `true` = saiu; `false` = não deu (ele saiu da cena, caiu, o pino sumiu ou
   * ficou oculto); `null` = sala fechada. Com "Só estes", ele entra na lista:
   * snapshot na hora e o painel recebe a lista nova.
   */
  showPin(playerId: string, pinId: string): boolean | null
  /**
   * "Revelar para…" da ficha secreta, escada secreta ou zona oculta: só
   * `playerIds` a recebem; `null` ou `[]` = segredo de todos. Snapshot na hora —
   * quem descobriu vê sem recarregar, e o desmarcado perde no mesmo pacote.
   */
  setSecretReveal(itemId: string, playerIds: readonly string[] | null): void
  /** "Revelar planta": snapshot imediato com a planta inteira explorada (fora de zona oculta ativa). */
  revealPlan(playerId: string): void
  /** "Esconder de novo": snapshot imediato com exploração e portas lembradas zeradas. */
  hidePlan(playerId: string): void
  /**
   * "Revelar planta para…" da lista Cenas: a planta de `sceneId` para estes
   * jogadores, mesmo fora dela (aparece quando chegarem). Devolve quantos
   * ganharam, ou `null` com a sala fechada. Snapshot na hora.
   */
  revealPlanFor(sceneId: string, playerIds: readonly string[]): number | null
  /**
   * "Dar o que o grupo viu": o jogador ganha o que os colegas viram na cena
   * onde ele está. Devolve quantos colegas tinham visto algo lá (0 = nada a
   * dar), ou `null` com a sala fechada. Snapshot na hora.
   */
  giveGroupView(playerId: string): number | null
  /**
   * "Passar o mapa de Ana a…": o que `fromPlayerId` explorou na cena onde está
   * vai à memória de `toPlayerId`; o aviso sai a ele e o snapshot na hora.
   * `false` quando nada passou (sala fechada, doador sem mapa da cena).
   */
  shareMap(fromPlayerId: string, toPlayerId: string): boolean
  /**
   * MAPA DE PAPEL — "Dar um mapa a…": grava as Salas `roomIds` da cena
   * `sceneId` (`null` = mapa solto) na memória de `playerId`; o aviso sai a ele
   * e o snapshot na hora. Devolve quantas Salas entraram (0 = nada: sala
   * fechada, cena sumiu ou só Salas que o jogador não pode ver agora) ou
   * `memoria-cheia` (cena nova com a memória dele no teto: nada foi gravado).
   */
  giveRoomsMap(playerId: string, sceneId: string | null, roomIds: readonly string[]): GiveMapOutcome
  /**
   * "Mandar para…" do painel Grupo: leva a ficha do jogador para `toSceneId`,
   * no pino `pinId` ou no centro (`null`), sem pedido. `false` quando não deu
   * (sala fechada, destino ou ficha sumiram): o painel avisa e fica aberto.
   * `gatherAt`: "Reunir o grupo aqui" — chega nessa casa, com o aviso de
   * reunião; a montaria e o familiar, nas casas que o plano deu a eles.
   * `tokenId`: a cabine contínua ao par leva ESTA ficha dele (`hostSession.sendPlayer`).
   */
  sendPlayer(playerId: string, toSceneId: string, pinId: string | null, gatherAt?: GatherArrival, tokenId?: string): boolean
  /**
   * "Trazer" do painel Grupo: a ficha `tokenId` do jogador, que ficou em
   * outra cena, vem para o lado dele. Não é viagem: sem "Você chegou" e fora
   * do diário. `false` quando não deu (sala fechada, ficha já na cena dele).
   */
  bringToken(playerId: string, tokenId: string): boolean
  /**
   * CARAVANA: "Desembarcar" a caravana do mapa-mundi `sceneId` na cidade sob
   * ela (o mesmo botão do aviso "A caravana chegou a…"). `false` quando
   * ninguém chegou (sala fechada, caravana fora da cidade, cena sumiu).
   */
  disembarkCaravan(sceneId: string): boolean
  /**
   * Recado do mestre a quem está na cena `sceneId`. Devolve quantos jogadores
   * receberam (0 = ninguém lá), ou `null` com a sala fechada. `playerIds`:
   * só esses, entre os que estão na cena; ausente = a cena inteira.
   */
  sceneNote(sceneId: string, text: string, playerIds?: readonly string[]): number | null
  /**
   * "Pausar" da lista Cenas: pausa ou solta a cena `sceneId` e avisa quem
   * está lá. `false` com a sala fechada (não há pausa sem sala).
   */
  setScenePaused(sceneId: string, paused: boolean): boolean
  /**
   * "Recado" da linha do jogador no Grupo: só ele recebe. `sent` = saiu agora;
   * `queued` = ele está fora e recebe ao voltar; `null` = sala fechada, texto
   * vazio ou jogador que já não existe.
   */
  playerNote(playerId: string, text: string): PlayerNoteDelivery
  /**
   * "Desfazer" do diário: devolve a ficha da viagem `entryId` à cena e à casa
   * de onde saiu, e tira a linha do diário. Só vale para a ÚLTIMA viagem do
   * jogador; `false` quando não deu (sala fechada, viagem velha, a ficha já
   * saiu da cena de destino, a cena de volta sumiu) — nada muda.
   */
  undoTravel(entryId: string): boolean
  /**
   * "Guardar ficha" do card de quem foi embora: as fichas dele saem do mapa
   * (param de ocupar o corredor) e voltam sozinhas, no mesmo lugar e de novo
   * dele, quando ele voltar. Dispensar ou fechar a sala também as devolve ao
   * mapa, sem dono; e Salvar as grava no arquivo (ver `storedTokens`): guardar
   * nunca apaga ficha. `false` com a sala fechada, jogador conectado ou
   * desconhecido, ou nada a guardar.
   */
  storeTokens(playerId: string): boolean
  /**
   * "Emprestar ficha a" do card de quem foi embora: as fichas dele passam a ser
   * jogadas por `borrowerId` até ele voltar (`HostSession.lendTokens`). `false`
   * (com aviso ao mestre) quando nada foi emprestado: sala fechada, dono
   * conectado, quem recebe fora, ou ficha de outra cena.
   */
  lendTokens(ownerId: string, borrowerId: string): boolean
  /** "Tomar de volta" da ficha emprestada. `false` com a sala fechada ou nada emprestado. */
  endLoans(ownerId: string): boolean
  /**
   * Cópia das fichas guardadas agora, com a cena de onde cada uma saiu. Quem
   * grava o mapa as põe de volta no arquivo (`withStoredTokens`): senão
   * Guardar + Salvar + fechar a janela apagava a ficha, que só existia aqui.
   */
  storedTokens(): StoredToken[]
  /**
   * RUÍDO NO MAPA em (`x`, `y`) da cena aberta, com alcance em casas. Sai só a
   * direção, só para quem está perto. Devolve quantos ouviram (0 = ninguém
   * perto), ou `null` com a sala fechada.
   */
  noise(x: number, y: number, rangeCells: number): number | null
  /**
   * TESTE SECRETO: pede o teste `label` a estes jogadores. Devolve quantos
   * foram pedidos (0 = nenhum escolhido joga agora), ou `null` com a sala
   * fechada. As respostas chegam por `onSecretChecksChange` e num aviso.
   */
  secretCheck(label: string, playerIds: readonly string[]): number | null
  /** "Encerrar" o teste: quem não respondeu tem o cartão fechado. */
  closeSecretCheck(checkId: string): void
  /**
   * ABALO POR DISTÂNCIA: a cada jogador em cena, o texto da faixa dele
   * (`hostSession.abalo`). Devolve quantos ouviram em cada faixa, ou `null` com
   * a sala fechada.
   */
  abalo(origem: AbaloOrigem, textos: AbaloTextos, vizinhas: readonly string[]): AbaloContagem | null
  /**
   * "Ver tela" do painel Grupo: o último recorte que SAIU pelo fio para este
   * jogador (a cena dele, com a névoa e a zona oculta já aplicadas), a espera
   * (`waiting`) ou `null` quando ele não tem tela (caiu, saiu, sala fechada).
   * Mesma referência enquanto nada novo sai: serve de `getSnapshot`.
   */
  playerScreen(playerId: string): PlayerScreen | null
  /** Chama `listener` a cada tela de jogador que muda. Devolve o desligar. */
  watchPlayerScreens(listener: () => void): () => void
  /**
   * ALARME PARA VÁRIAS CENAS: soa `text` para quem está em qualquer das
   * `sceneIds` (substitui o alarme que estiver soando). Devolve quantos
   * jogadores receberam agora (0 = ninguém lá ainda; o alarme fica para quem
   * chegar), ou `null` com a sala fechada ou texto/cenas inválidos.
   */
  sceneAlarm(sceneIds: readonly string[], text: string): number | null
  /** Encerra o alarme: some da tela de quem o mostrava. Sala fechada: nada. */
  endAlarm(): void
  /** O alarme soando, para o painel; `null` sem alarme ou com a sala fechada. */
  activeAlarm(): { id: string; text: string; sceneIds: string[] } | null
  /** A vez mudou (começar, próxima, encerrar): snapshot na hora, para o "sua vez" não esperar outra edição. */
  notifyTurnChanged(): void
  /** O relógio da campanha andou: snapshot na hora, com o período (e a visão da noite) novos. */
  notifyClockChanged(): void
  /**
   * TELA DA MESA: a cena que a TV mostra (`tableSceneKey`), ou `null` para ela
   * esperar. Snapshot imediato. Sala fechada: nada.
   */
  setTableScene(key: string | null): void
  /** TELA DA MESA: a chave do link da TV desta sala; `null` com a sala fechada. */
  tableKey(): string | null
  /**
   * "Dispensar" do card de quem foi embora: o card sai. `false` com a sala
   * fechada, jogador conectado (esse é o Expulsar) ou desconhecido.
   */
  dismissPlayer(playerId: string): boolean
  /**
   * "Passar fichas e mapa a…" do card de quem foi embora: o card sai, como no
   * Dispensar, e as fichas dele (a guardada inclusive, de volta ao mapa) e o
   * que ele explorou passam a `heirId` (`HostSession.handOverPlayer`). Aviso
   * ao mestre com o que passou. `false` com a sala fechada, jogador conectado
   * (esse é o Expulsar), desconhecido, ou `heirId` inválido.
   */
  handOverPlayer(playerId: string, heirId: string): boolean
  /**
   * DADO ROLADO NA SALA pelo mestre: o host rola; aberta, a mesa inteira
   * recebe; `hidden`, só a tela do mestre (`onDiceRoll`). `null` com a sala fechada.
   */
  rollDice(request: DiceRequest, hidden: boolean): HostDiceRoll | null
  /**
   * "Visto por" do painel da ficha: nomes dos jogadores conectados cuja tela
   * (o último recorte que SAIU, `playerScreen`) tem a ficha `tokenId` do mapa
   * aberto no editor, na ordem de entrada na sala. É a mesma regra do recorte
   * por construção — névoa, parede, zona oculta, teto, cena de cada um.
   * `null` = não se aplica: sala fechada ou ficha com dono (o dono sempre a vê).
   * Muda junto com as telas: observe com `watchPlayerScreens`.
   */
  tokenSeenBy(tokenId: string): string[] | null
}

export const BROADCAST_THROTTLE_MS = 50

/**
 * Erros no `join` que derrubam a conexão depois de responder. O Rust só solta
 * a vaga de jogador (`MAX_PLAYERS`) quando o socket fecha: a TV recusada por
 * `table_full` ou sem a chave certa seguraria a vaga enquanto a página ficasse
 * aberta, mandando ping. `bad_code` também: o código errado de verdade o Rust
 * já barra antes; esta recusa é a defesa da sessão, e a vaga volta.
 */
const KICK_ON_JOIN_ERROR: ReadonlySet<HostErrorReason> = new Set<HostErrorReason>(['invalid_message', 'bad_code', 'table_full', 'bad_table_key'])

/**
 * O mapa explorado muda a cada passo de cada jogador, e gravá-lo é codificar
 * todas as memórias da mesa: grava uma vez, este tempo depois da primeira
 * mudança, e não a cada snapshot. Fechar a sala grava o que estiver pendente.
 */
export const EXPLORATION_SAVE_DELAY_MS = 1500

/** Folga do timer que fecha o cone do "Espiar": o prazo da sessão já venceu quando ele dispara. */
const PEEK_CLOSE_SLACK_MS = 50
/**
 * O aviso de jogador novo fica mais tempo que um info comum (4 s): o mestre
 * costuma estar desenhando no mapa, de olho no canvas e não no rail, e perder
 * este aviso é o jogador esperando sozinho numa tela parada.
 */
export const PLAYER_JOINED_TOAST_MS = 10_000
/**
 * "Guarda viu Ana" fica o dobro de um info comum: é o gancho da cena
 * furtiva, e o mestre precisa de tempo para largar o que desenha e narrar.
 */
export const GUARD_SIGHTING_TOAST_MS = 8_000
/** A linha do pedido da porta na caixa do mestre: o que o jogador tenta, depois do nome dele. */
const DOOR_REQUEST_VERB: Record<DoorRequestHow, string> = {
  knock: 'bate na porta',
  force: 'tenta forçar a porta',
  key: 'tenta usar uma chave na porta',
}

/**
 * LOJA: "Ana quer Xarope (1 moeda) em Botica", mais ", Mercado" quando a banca
 * está numa cena de fundo. Sem preço escrito, sem parênteses.
 */
export function purchaseRequestLine(request: PurchaseRequest): string {
  const preco = request.preco.trim() === '' ? '' : ` (${request.preco.trim()})`
  const where = request.sceneName === undefined ? '' : `, ${request.sceneName}`
  return `${request.playerName} quer ${request.itemName}${preco} em ${request.pinLabel}${where}`
}

/** "Diego quer pegar Chave do Escudo", mais " em Mansão" quando o item está numa cena de fundo. */
export function itemRequestLine(request: ItemRequest): string {
  const where = request.sceneName === undefined ? '' : ` em ${request.sceneName}`
  return `${request.playerName} quer pegar ${request.itemName}${where}`
}

/**
 * "Duda quer se esconder", mais " em Porto" quando a ficha está numa cena de
 * fundo. Ficha com outro nome (a segunda dela, o cavalo) diz qual: "Duda quer
 * esconder Cavalo".
 */
export function hideRequestLine(request: HideRequest): string {
  const where = request.sceneName === undefined ? '' : ` em ${request.sceneName}`
  const what = request.tokenName === '' || request.tokenName === request.playerName ? 'se esconder' : `esconder ${request.tokenName}`
  return `${request.playerName} quer ${what}${where}`
}

/** "Ana tenta forçar a porta", mais " em Mansão" quando a porta está numa cena de fundo. */
export function doorRequestLine(request: DoorRequest): string {
  const where = request.sceneName === undefined ? '' : ` em ${request.sceneName}`
  return `${request.playerName} ${DOOR_REQUEST_VERB[request.how]}${where}`
}

/**
 * "Gina caiu" espera isto antes de sair. Wi-Fi que pisca volta antes (o
 * celular reconecta sozinho em ~1 s) e não vira aviso nenhum; quedas dentro
 * da mesma janela — o roteador que reinicia leva a mesa inteira — viram UM
 * aviso só.
 */
export const DROP_ANNOUNCE_DELAY_MS = 3_000
/**
 * Conexão sem NENHUMA mensagem há isto conta como caída. O Wi-Fi do celular
 * que some sem FIN deixa o socket "aberto" para o Rust por minutos; o cliente
 * manda `ping` a cada 2 s (`PING_INTERVAL_MS` do jogador), então seis segundos
 * são três pings perdidos — Wi-Fi ruim não vira queda falsa. Somado à
 * varredura e a `DROP_ANNOUNCE_DELAY_MS`, "Gina caiu" sai em até 10 s.
 */
export const HOST_STALE_AFTER_MS = 6_000
/**
 * O mesmo prazo para a conexão cuja aba avisou que está em segundo plano
 * (`ping` com `away: true`). Com a aba oculta há mais de 5 min o Chrome e o
 * Edge alinham os timers a 1 minuto: o ping de 2 s vira um por minuto, e com
 * 6 s de prazo o jogador que foi ler a ficha num PDF cairia e voltaria em
 * ciclo. Dois minutos e meio cobrem um despertar de minuto perdido; a aba
 * congelada de vez (economia de energia) ainda é dada como caída, uma vez só.
 */
export const HOST_AWAY_STALE_AFTER_MS = 150_000
/** De quanto em quanto tempo o host confere quem ficou mudo. */
export const LIVENESS_SWEEP_MS = 1_000
/** "Diego abriu uma porta com Chave do Escudo", mais " em Mansão" quando a porta está numa cena de fundo. */
export function doorKeyLine(used: DoorKeyUse): string {
  const where = used.sceneName === undefined ? '' : ` em ${used.sceneName}`
  return `${used.playerName} abriu uma porta com ${used.itemName}${where}`
}

/** "Diego abriu Portão do cemitério com Chave do Escudo", mais " em Mansão" quando o pino está numa cena de fundo. */
export function pinKeyLine(used: PinKeyUse): string {
  const where = used.sceneName === undefined ? '' : ` em ${used.sceneName}`
  return `${used.playerName} abriu ${used.pinLabel} com ${used.itemName}${where}`
}

const DEFAULT_VISION_RADIUS = 700
/** Quantos motivos do "Não, porque…" voltam prontos no próximo pedido. */
export const TRAVEL_DENY_RECENTS_MAX = 3
/** Id de conexão do Rust (hoje um contador decimal); o padrão aceita folga sem abrir para lixo. */
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseClientId(value: unknown): string | null {
  return typeof value === 'string' && CLIENT_ID_PATTERN.test(value) ? value : null
}

function parseRoomInfo(value: unknown): RoomInfo | null {
  if (!isRecord(value)) return null
  const { code, urls, qrSvg } = value
  if (typeof code !== 'string' || typeof qrSvg !== 'string') return null
  if (!Array.isArray(urls) || !urls.every((u): u is string => typeof u === 'string')) return null
  return { code, urls, qrSvg }
}

/** Só `https://`: o link vai para a tela e para o QR; qualquer outra coisa é lixo. */
function parseTunnelLink(value: unknown): { url: string; qrSvg: string } | null {
  if (!isRecord(value)) return null
  const { url, qrSvg } = value
  if (typeof url !== 'string' || !url.startsWith('https://') || typeof qrSvg !== 'string') return null
  return { url, qrSvg }
}

type TunnelEvent =
  | { state: 'downloading'; progress: number }
  | { state: 'connecting' }
  | { state: 'ready'; url: string; qrSvg: string }
  | { state: 'closed'; reason: 'stopped' | 'exited' }
  | { state: 'error'; message: string }

function parseTunnelEvent(value: unknown): TunnelEvent | null {
  if (!isRecord(value)) return null
  switch (value.state) {
    case 'downloading': {
      const { progress } = value
      if (typeof progress !== 'number' || !Number.isFinite(progress)) return null
      return { state: 'downloading', progress: Math.min(1, Math.max(0, progress)) }
    }
    case 'connecting':
      return { state: 'connecting' }
    case 'ready': {
      const link = parseTunnelLink(value)
      return link === null ? null : { state: 'ready', ...link }
    }
    case 'closed':
      return value.reason === 'stopped' || value.reason === 'exited' ? { state: 'closed', reason: value.reason } : null
    case 'error':
      return typeof value.message === 'string' ? { state: 'error', message: value.message } : null
    default:
      return null
  }
}

/** "Gina caiu" / "Gina e Bruno caíram" / "Gina, Bruno e Ana caíram". */
function dropText(names: string[]): string {
  const last = names.at(-1)
  if (last === undefined) return ''
  if (names.length === 1) return `${last} caiu`
  return `${names.slice(0, -1).join(', ')} e ${last} caíram`
}

/** O aviso do mestre quando alguém responde ao teste secreto: quem, qual teste e o resultado. */
export function secretCheckAnswerText(playerName: string, label: string, result: number): string {
  return `${playerName} — ${label}: ${result}`
}

/**
 * ESCOLHER FICHAS NO PINO: " com Rufo" / " com Enzo e Rufo" quando o jogador
 * escolheu quais fichas passam — o mestre lê quem vai. Sem escolha, nada: a
 * linha do pedido fica a de sempre.
 */
function travelWithText(request: TravelRequest): string {
  const names = request.tokenNames ?? []
  const last = names.at(-1)
  if (last === undefined) return ''
  if (names.length === 1) return ` com ${last}`
  return ` com ${names.slice(0, -1).join(', ')} e ${last}`
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function reportError(context: string, error: unknown): void {
  useToastStore.getState().push('error', `${context}: ${errorText(error)}`)
}

export function createHostBridge(deps: HostBridgeDeps): HostBridge {
  const now = deps.now ?? Date.now
  let session: HostSession | null = null
  let currentRoom: RoomInfo | null = null
  let unlisteners: UnlistenFn[] = []
  let pendingBroadcast: ReturnType<typeof setTimeout> | null = null
  let pendingExplorationSave: ReturnType<typeof setTimeout> | null = null
  /** Despertador do prazo do ajudante contratado mais próximo (`armLoanTimer`). */
  let loanTimer: ReturnType<typeof setTimeout> | null = null
  let pendingStart: Promise<RoomInfo> | null = null
  let lastPlayersKey = '[]'
  let lastPinAudiencesKey = '{}'
  let lastTableScreens = 0
  let lastPinCluesKey = '{}'
  let lastSecretRevealsKey = '{}'
  let lastSecretChecksKey = '[]'
  let tunnelState: TunnelState = TUNNEL_IDLE
  let lastTunnelKey = JSON.stringify(TUNNEL_IDLE)
  let pendingTunnel: Promise<void> | null = null
  let tunnelAttemptSeq = 0
  /** Tentativa de `startTunnel` em curso; `null` depois de encerrar, fechar a sala ou terminar. */
  let activeTunnelAttempt: number | null = null
  /** Pontos do laser à espera da janela de envio. */
  let laserBuffer: RegionPoint[] = []
  let laserTimer: ReturnType<typeof setTimeout> | null = null
  /** Houve envio desde o último `off`: sem isso cada tecla solta viraria um `off` à toa. */
  let laserSent = false
  /** Aviso do mestre de cada pedido de passagem ainda na tela: `requestId` -> id do toast. */
  const travelToasts = new Map<string, string>()
  /**
   * Os últimos motivos do "Não, porque…", o mais novo primeiro, sem repetir.
   * Vivem só na ponte (fechar o app esquece): é atalho de digitação do mestre.
   */
  let travelDenyRecents: string[] = []
  /** Linha de cada pedido de porta trancada ainda na tela: `requestId` -> id do toast. */
  const doorRequestToasts = new Map<string, string>()
  /** Linha de cada pedido de esconder-se ainda na tela: `requestId` -> id do toast. */
  const hideToasts = new Map<string, string>()
  /** Linha de cada pedido de item ainda na tela: `requestId` -> id do toast. */
  const itemToasts = new Map<string, string>()
  /** LOJA: linha de cada "Quero" ainda na tela: `requestId` -> id do toast. */
  const purchaseToasts = new Map<string, string>()
  /** CORREIO: aviso do mestre de cada bilhete que ainda espera: `letterId` -> id do toast. */
  const letterToasts = new Map<string, string>()
  /**
   * CABINE DE TRANSPORTE: pedidos de quem embarcou numa cabine. Quando o
   * pedido morre (Não, revalidação recusada, jogador saiu), a parada deixa de
   * estar "ocupada": quem está nela precisa de um recorte novo.
   */
  const travelsComCabine = new Set<string>()
  /** Libera a cabine do pedido `requestId`, se era de embarque: novo recorte para quem está na parada. */
  const releaseCabine = (requestId: string) => {
    if (travelsComCabine.delete(requestId)) scheduleBroadcast()
  }
  /** "Fulano entrou em X": um cartão por cena de destino (`net/avisoDeChegada.ts`). */
  const announceArrival = createArrivalAnnouncer(deps.onGoToScene)
  /** Prazo de cada "Espiar" aceito: no fim, o snapshot que fecha o cone. Fechar a sala cancela. */
  const peekTimers = new Set<ReturnType<typeof setTimeout>>()
  /** Aviso de cada pedido de ação sobre ficha ainda na Caixa: `requestId` -> id do toast. */
  const actionToasts = new Map<string, string>()
  /**
   * VOLTO JÁ: aviso "o Deixar ir espera a volta" de cada pedido segurado,
   * `requestId` -> id do toast. Sai quando a pergunta volta ou o pedido morre.
   */
  const heldToasts = new Map<string, string>()
  /** Aviso de cada disputa na porta (ferrolho) ainda na Caixa: `requestId` -> id do toast. */
  const disputeToasts = new Map<string, string>()
  /** O que cada conexão está vendo, anotado do que sai em `dispatch` (espelho do "Ver tela"). */
  const screens = createPlayerScreens()
  const screenWatchers = new Set<() => void>()
  const notifyScreens = () => {
    for (const watcher of screenWatchers) watcher()
  }
  /** CARAVANA: oferta "Desembarcar" na tela, por cena de mapa-mundi: o pino onde ela parou e o id do toast. */
  const caravanToasts = new Map<string, { pinId: string; toastId: string }>()
  /** OLHOS DO GUARDA: pares (cena, guarda, ficha) no olhar no último snapshot — aviso só na entrada. */
  let guardSeen: ReadonlySet<string> = new Set()
  /** Linha de cada chamado aberto na caixa "Chamados": `callId` -> id do toast. */
  const callToasts = new Map<string, string>()
  /** Linha da Caixa de cada ação no ponto ainda sem resposta: `requestId` -> id do toast. */
  const pointActionToasts = new Map<string, string>()
  /** Linha da Caixa de cada pedido de ficha de quem chegou: `requestId` -> id do toast. */
  const seatClaimToasts = new Map<string, string>()
  /** Diário de viagens desta sala, a mais nova em cima. Nunca sai pelo `net_send`. */
  let travelLog: TravelLogEntry[] = []
  let travelSeq = 0
  /** Quedas ainda não avisadas, na ordem em que aconteceram: `playerId` -> nome. */
  const pendingDrops = new Map<string, string>()
  let dropTimer: ReturnType<typeof setTimeout> | null = null
  /** Aviso "caiu" na tela de cada jogador já avisado: `playerId` -> id do toast. */
  const dropToasts = new Map<string, string>()
  /** Hora (relógio do mestre) da última mensagem de cada conexão: `clientId` -> ms. Nunca sai pela rede. */
  const lastHeard = new Map<string, number>()
  /** Conexões cuja aba está em segundo plano (último ping com `away: true`). Nunca sai pela rede. */
  const awayClients = new Set<string>()
  /** PACOTE COMPRIMIDO: conexões que declararam `accept: ['gzip']` no `join`. Nunca sai pela rede. */
  const gzipClients = new Set<string>()
  let livenessTimer: ReturnType<typeof setInterval> | null = null
  /** Pergunta "Ana voltou?" de quem entrou agora: `playerId` dele -> id do toast. */
  const returnToasts = new Map<string, string>()
  /**
   * Fichas guardadas ("Guardar ficha") de quem foi embora, cópia inteira e a
   * cena de onde saíram (`null` = mapa solto): `playerId` -> fichas. Só do
   * mestre; nunca sai pelo `net_send`.
   */
  const storedTokens = new Map<string, StoredToken[]>()

  /** Os ids das fichas guardadas, por dono: na mesa gravada continuam dele. */
  const heldTokenIds = (): HeldTokens => new Map([...storedTokens].map(([playerId, stored]) => [playerId, stored.map(({ token }) => token.id)]))
  /** Último aviso de porta de cada jogador: `playerId` -> id do toast. */
  const doorToasts = new Map<string, string>()

  /** O mundo que a sessão serve agora: a aventura, ou só o mapa aberto. */
  const world = (): HostWorld => deps.getWorld?.() ?? singleSceneWorld(deps.getMap())
  /** O mesmo relógio da sessão (que ganha `deps.now` também): a idade do pedido é a diferença entre os dois. */
  const clock = deps.now ?? Date.now

  const setTravelLog = (next: TravelLogEntry[]) => {
    if (next === travelLog || (next.length === 0 && travelLog.length === 0)) return
    travelLog = next
    deps.onTravelLogChange?.(travelLog)
  }

  /**
   * Move a ficha pela store e, se moveu, anota a viagem. A linha é lida do
   * mundo ANTES de mover: depois, a casa de partida já não está lá.
   */
  const moveAndLog = (transfer: AppliedTransfer): boolean => {
    travelSeq += 1
    const entry = travelLogEntry(transfer, world(), now(), `viagem-${travelSeq}`)
    const moved = applyTransferAlong(transfer)
    if (moved && entry !== null) setTravelLog(addTravel(travelLog, entry))
    return moved
  }

  const sendLaser = (message: LaserMessage) => {
    if (session === null) return
    // Só quem está na cena aberta: o mestre aponta no mapa que ele está vendo.
    void dispatch(session.laser(message, world()))
  }

  /** Throttle com borda de entrada: o primeiro ponto sai na hora, os seguintes esperam a janela e vão juntos. */
  const armLaserTimer = () => {
    laserTimer = setTimeout(() => {
      laserTimer = null
      if (laserBuffer.length === 0) return
      const points = laserBuffer
      laserBuffer = []
      sendLaser({ type: 'laser', points })
      armLaserTimer()
    }, LASER_SEND_INTERVAL_MS)
  }

  const resetLaser = () => {
    if (laserTimer !== null) clearTimeout(laserTimer)
    laserTimer = null
    laserBuffer = []
    laserSent = false
  }

  const setTunnel = (next: TunnelState) => {
    tunnelState = next
    const key = JSON.stringify(next)
    if (key === lastTunnelKey) return
    lastTunnelKey = key
    deps.onTunnelChange?.(next)
  }

  const onTunnel = (event: { payload: unknown }) => {
    if (session === null) return
    const parsed = parseTunnelEvent(event.payload)
    if (parsed === null) return
    const starting = activeTunnelAttempt !== null
    const wasReady = tunnelState.kind === 'ready'
    switch (parsed.state) {
      case 'downloading':
        // Progresso atrasado depois de "Encerrar" não pode ressuscitar o estado.
        if (starting) setTunnel({ kind: 'downloading', progress: parsed.progress })
        return
      case 'connecting':
        if (starting) setTunnel({ kind: 'connecting' })
        return
      case 'ready':
        if (starting || wasReady) setTunnel({ kind: 'ready', url: parsed.url, qrSvg: parsed.qrSvg })
        return
      case 'error':
        if (!starting && !wasReady) return
        setTunnel({ kind: 'error', message: parsed.message })
        // Durante o start o toast sai da rejeição do invoke; aqui só o túnel que caiu depois de pronto.
        if (!starting) reportError('O link público caiu', parsed.message)
        return
      case 'closed':
        setTunnel(TUNNEL_IDLE)
        if (parsed.reason === 'exited' && wasReady) useToastStore.getState().push('error', 'O link público caiu: o cloudflared encerrou')
        return
    }
  }

  const runTunnel = async (attempt: number): Promise<void> => {
    try {
      const link = parseTunnelLink(await deps.invoke('net_start_tunnel'))
      if (attempt !== activeTunnelAttempt) return
      if (link === null) throw new Error('resposta inválida de net_start_tunnel')
      setTunnel({ kind: 'ready', ...link })
    } catch (error) {
      // Rejeição de tentativa já encerrada (ou sala fechada) é esperada, não é falha.
      if (attempt !== activeTunnelAttempt) return
      setTunnel({ kind: 'error', message: errorText(error) })
      reportError('Não foi possível tornar a sala pública', error)
    } finally {
      if (attempt === activeTunnelAttempt) activeTunnelAttempt = null
    }
  }

  const resetTunnel = () => {
    activeTunnelAttempt = null
    pendingTunnel = null
    setTunnel(TUNNEL_IDLE)
  }

  /**
   * Companheiros na tela de cada jogador. Chamado a cada evento que pode mudar
   * quem está onde (entrar, cair, viajar, ser levado, ganhar ficha, mapa novo):
   * a sessão só devolve quem teve a lista mudada, então chamar a mais não
   * inunda o socket.
   */
  const sendPartyIfChanged = () => {
    if (session === null) return
    void dispatch(session.partyUpdates(world()))
    // Os mesmos eventos mudam as fichas livres de quem está sem personagem
    // (alguém ganhou ficha, o mestre marcou "Ficha de jogador"): mesma regra do "só se mudou".
    void dispatch(session.seatOptionsUpdates(world()))
  }

  /** A lista da sessão com o que só a ponte sabe: as fichas guardadas de cada um. */
  const playerList = (): PlayerInfo[] => {
    if (session === null) return []
    return session.listPlayers(world()).map((player) => {
      const stored = storedTokens.get(player.playerId)
      return stored === undefined ? player : { ...player, storedTokenNames: stored.map(({ token }) => token.name) }
    })
  }

  const notifyPlayersIfChanged = () => {
    const screens = session?.tableScreens() ?? 0
    if (screens !== lastTableScreens) {
      lastTableScreens = screens
      deps.onTableScreensChange?.(screens)
    }
    sendPartyIfChanged()
    const list = playerList()
    const key = JSON.stringify(list)
    if (key === lastPlayersKey) return
    lastPlayersKey = key
    deps.onPlayersChange?.(list)
    saveTableNow()
    // Ganhar ou perder assento muda quem vai no explorado gravado.
    scheduleExplorationSave()
  }

  const saveExplorationNow = () => {
    if (session === null || currentRoom === null || deps.saveExploration === undefined) return
    // Mesa sem assento nenhum (sala recém-aberta, "Mesa nova" antes de alguém
    // ganhar ficha): não há de quem gravar, e gravar vazio apagaria o explorado
    // que a mesa guardada ainda pode retomar.
    const held = heldTokenIds()
    if (session.savedSeats(held).length === 0) return
    deps.saveExploration({ version: SAVED_EXPLORATION_VERSION, seats: session.savedExploration(held) })
  }

  /** Grava o explorado uma vez, `EXPLORATION_SAVE_DELAY_MS` depois da primeira mudança pendente. */
  const scheduleExplorationSave = () => {
    if (session === null || deps.saveExploration === undefined || pendingExplorationSave !== null) return
    pendingExplorationSave = setTimeout(() => {
      pendingExplorationSave = null
      saveExplorationNow()
    }, EXPLORATION_SAVE_DELAY_MS)
  }

  /** Fechar a sala: o último passo de cada um não pode se perder no timer. */
  const flushExplorationSave = () => {
    if (pendingExplorationSave === null) return
    clearTimeout(pendingExplorationSave)
    pendingExplorationSave = null
    saveExplorationNow()
  }

  /**
   * O arquivo da mesa acompanha cada mudança de dono, raio ou cena (as mesmas
   * que mudam a lista de jogadores). Com a sala fechada não grava: fechar não
   * pode apagar a mesa que o mestre quer retomar.
   */
  const saveTableNow = () => {
    if (session === null || currentRoom === null || deps.saveTable === undefined) return
    deps.saveTable({ version: SAVED_TABLE_VERSION, code: currentRoom.code, seats: session.savedSeats(heldTokenIds()) })
  }

  const notifyPinAudiencesIfChanged = () => {
    const audiences = session?.pinAudiences() ?? {}
    const key = JSON.stringify(audiences)
    if (key === lastPinAudiencesKey) return
    lastPinAudiencesKey = key
    deps.onPinAudiencesChange?.(audiences)
  }

  const notifyPinCluesIfChanged = () => {
    const clues = session?.pinClues() ?? {}
    const key = JSON.stringify(clues)
    if (key === lastPinCluesKey) return
    lastPinCluesKey = key
    deps.onPinCluesChange?.(clues)
  }

  const notifySecretRevealsIfChanged = () => {
    const reveals = session?.secretReveals() ?? {}
    const key = JSON.stringify(reveals)
    if (key === lastSecretRevealsKey) return
    lastSecretRevealsKey = key
    deps.onSecretRevealsChange?.(reveals)
  }

  const notifySecretChecksIfChanged = () => {
    const checks = session?.secretChecks() ?? []
    const key = JSON.stringify(checks)
    if (key === lastSecretChecksKey) return
    lastSecretChecksKey = key
    deps.onSecretChecksChange?.(checks)
  }

  /**
   * Um `net_send` por mensagem, na ordem. Para quem aceita gzip, a mensagem
   * grande vai comprimida (`pacoteComprimido.ts`) e as de trás esperam por
   * ela. Nunca rejeita: falha vira toast.
   */
  const sendToClient = criarSaidaEmOrdem((clientId, carga) => {
    // A sessão de AGORA: a falha chega depois, talvez com a sala já fechada ou reaberta.
    const owner = session
    return deps.invoke('net_send', { clientId, msg: carga }).then(
      () => undefined,
      (error: unknown) => {
        // Tela que não chegou: o próximo broadcast manda a inteira, e não um
        // `patch` em cima de uma tela que o jogador não tem. O envelope gzip só
        // leva mensagem grande (a tela, na prática): perdido, vale o mesmo.
        const type: unknown = Reflect.get(carga, 'type')
        if (type === 'snapshot' || type === 'patch' || Reflect.has(carga, 'gz')) session?.forgetView(clientId)
        // A conexão segue aberta mas a mensagem se perdeu: sem isto o host
        // contaria o recorte como entregue e a tela do jogador ficaria velha
        // até a cena DELE mudar.
        if (owner !== null && owner === session) owner.sendFailed(clientId)
        reportError('Falha ao enviar para jogador', error)
      },
    )
  })

  /** Envia tudo; a promise nunca rejeita — falha vira toast, nunca silêncio. */
  const dispatch = (result: HostResult): Promise<void> => {
    // O espelho anota o que SAI, na ordem em que sai: é o que o jogador recebe.
    let screensChanged = false
    for (const { clientId, msg } of result.outbound) {
      if (screens.record(clientId, msg)) screensChanged = true
    }
    if (screensChanged) notifyScreens()
    // Todo recorte e toda leitura passam por aqui: o painel Pistas acompanha
    // o que SAI (recebeu) e o que o jogador abriu (leu), sem esperar nada.
    notifyPinCluesIfChanged()
    return Promise.all(result.outbound.map(({ clientId, msg }) => sendToClient(clientId, msg, gzipClients.has(clientId)))).then(() => undefined)
  }

  /** A conexão acabou (caiu ou foi expulsa): a tela dela sai do espelho. */
  const forgetScreen = (clientId: string) => {
    if (screens.forget(clientId)) notifyScreens()
  }

  /** Espera o envio (ex.: `kicked`, `error`) sair antes de derrubar a conexão. */
  const sendThenKick = async (result: HostResult, clientId: string): Promise<void> => {
    await dispatch(result)
    try {
      await deps.invoke('net_kick', { clientId })
    } catch (error) {
      reportError('Não foi possível expulsar o jogador', error)
    }
  }

  /**
   * OLHOS DO GUARDA: a ficha de um jogador ENTROU no olhar de um guarda desde
   * o último snapshot — "Guarda viu Ana". Só o mestre lê; o jogador recebe a
   * marca (?, !) pelo recorte (`lib/fogFilter.ts`). Grupo próprio: vários
   * guardas de uma vez viram uma caixa, sem soterrar os pedidos.
   */
  const announceGuardSightings = (current: HostWorld) => {
    if (session === null) return
    const notices = guardSightingNotices(current, session.listPlayers(current), guardSeen)
    guardSeen = notices.seen
    for (const line of notices.lines) useToastStore.getState().push('info', line, GUARD_SIGHTING_TOAST_MS, { grupo: 'Vigias' })
  }

  /**
   * CARAVANA NO MAPA-MUNDI: antes de cada snapshot, as fichas do grupo seguem a
   * que o mestre arrastou (pela store, como o movimento do jogador), e a
   * caravana parada numa cidade vira a oferta "Desembarcar". Mover pela store
   * agenda outro broadcast, que já não acha nada a mover.
   */
  const followCaravans = (cause: MapChangeCause = 'edit') => {
    if (session === null) return
    const follow = session.followCaravans(world(), cause)
    if (follow.moves.length > 0) applyCaravanMoves(follow.moves)
    syncCaravanToasts(follow.stops)
  }

  const applyCaravanMoves = (moves: readonly AppliedMove[]) => {
    if (deps.applyCaravanMoves !== undefined) {
      deps.applyCaravanMoves(moves)
      return
    }
    for (const { tokenId, x, y, sceneId } of moves) {
      if (sceneId === undefined) deps.applyMove(tokenId, x, y)
      else deps.applyMove(tokenId, x, y, sceneId)
    }
  }

  /** Uma oferta por mapa-mundi: some quando a caravana sai da cidade, troca quando para em outra. */
  const syncCaravanToasts = (stops: readonly CaravanStop[]) => {
    const toasts = useToastStore.getState()
    for (const [sceneId, shown] of [...caravanToasts]) {
      if (stops.some((stop) => stop.sceneId === sceneId && stop.pinId === shown.pinId)) continue
      toasts.dismiss(shown.toastId)
      caravanToasts.delete(sceneId)
    }
    for (const stop of stops) {
      if (caravanToasts.has(stop.sceneId)) continue
      const toastId = toasts.push('instrucao', `A caravana chegou a ${stop.toSceneName}`, null, {
        actions: [{ label: 'Desembarcar', run: () => disembark(stop.sceneId) }],
      })
      caravanToasts.set(stop.sceneId, { pinId: stop.pinId, toastId })
    }
  }

  /** "Desembarcar": cada ficha vai para a cidade pela store, e só quem chegou recebe o `scene.changed`. */
  const disembark = (sceneId: string): boolean => {
    if (session === null) return false
    const arrivals = session.disembarkCaravan(sceneId, world())
    const shown = caravanToasts.get(sceneId)
    if (shown !== undefined) useToastStore.getState().dismiss(shown.toastId)
    caravanToasts.delete(sceneId)
    const arrived = new Set<string>()
    for (const arrival of arrivals) {
      // Pela mesma porta da travessia: quem ela leva (`transfer.junto`) desce junto.
      if (!applyTransferAlong(arrival.transfer)) continue
      arrived.add(arrival.transfer.playerId)
      announceArrival(arrival.transfer)
    }
    // Primeiro `scene.changed`, depois o snapshot da cidade (mesma ordem do "Deixar ir").
    void dispatch({ outbound: arrivals.filter((a) => arrived.has(a.transfer.playerId)).flatMap((a) => a.outbound) })
    broadcastNow()
    notifyPlayersIfChanged()
    return arrived.size > 0
  }

  const cancelPendingBroadcast = () => {
    if (pendingBroadcast === null) return
    clearTimeout(pendingBroadcast)
    pendingBroadcast = null
  }

  /**
   * O envio imediato leva o mundo de AGORA, que já contém toda mudança que
   * agendou o broadcast pendente: o agendado seria a mesma cena de novo. Sem
   * cancelar, cada passo de jogador (applyMove → assinatura do mapa →
   * `notifyMapChanged`) saía duas vezes — com 7 na mesa, 14 recortes da névoa
   * e 14 envios por passo na thread do mestre.
   */
  const broadcastNow = () => {
    if (session === null) return
    followCaravans()
    cancelPendingBroadcast()
    const current = world()
    const result = session.broadcast(current)
    void dispatch(result)
    announceHazardEntries(result.hazardEntries ?? [])
    announceTriggerEntries(result.triggerEntries ?? [])
    announceGuardSightings(current)
    // O mestre pode ter apagado ou trocado uma ficha de cena pelo editor: é
    // mudança de mapa, que só passa por aqui.
    sendPartyIfChanged()
    // Cada snapshot marca o que cada jogador viu: o explorado da mesa muda.
    scheduleExplorationSave()
    // ENCONTRO MARCADO: uma espera acabou no meio deste broadcast (o colega
    // chegou): quem recebeu antes ainda vê a marca, então vai mais um.
    if (result.waitsChanged === true) onWaitsChanged()
  }

  /**
   * GATILHO DE ÁREA: "Armadilha: Ana entrou em Corredor". Grupo próprio, como
   * o do guarda: várias entradas de uma vez viram uma caixa, sem soterrar os
   * pedidos. Fica o tempo do aviso do guarda — é gancho de narração.
   */
  const announceTriggerEntries = (entries: readonly AreaTriggerEntryNotice[]) => {
    for (const entry of entries) {
      useToastStore
        .getState()
        .push('info', areaTriggerEntryLine(entry.playerName, entry.kind, entry.areaName, entry.sceneName), GUARD_SIGHTING_TOAST_MS, { grupo: 'Gatilhos' })
    }
  }

  /**
   * ZONA DE PERIGO: "Ana entrou no fogo". O mestre está olhando o canvas e
   * não a ficha dela — sem o aviso, o fogo avança e ninguém narra. Some
   * sozinho: é informação, não pergunta.
   */
  const announceHazardEntries = (entries: readonly HazardEntryNotice[]) => {
    for (const entry of entries) {
      useToastStore.getState().push('info', hazardEntryLine(entry.playerName, entry.kind, entry.sceneName), PLAYER_JOINED_TOAST_MS)
    }
  }

  /** ENCONTRO MARCADO: o relógio do próximo prazo. `null` = ninguém espera. */
  let waitTimer: ReturnType<typeof setTimeout> | null = null

  const clearWaitTimer = () => {
    if (waitTimer !== null) clearTimeout(waitTimer)
    waitTimer = null
  }

  /**
   * Acorda na hora do prazo mais próximo. É daqui que sai o "o prazo acabou":
   * a mesa pode estar parada, sem movimento nem broadcast para descobrir.
   */
  const armWaitTimer = () => {
    clearWaitTimer()
    const deadline = session === null ? null : session.nextWaitDeadline()
    if (deadline === null) return
    waitTimer = setTimeout(expireWaitsNow, Math.max(0, deadline - clock()))
  }

  function expireWaitsNow() {
    waitTimer = null
    if (session === null) return
    const result = session.expireWaits()
    void dispatch(result)
    if (result.waitsChanged === true) {
      // A marca sai da ficha agora, e não no próximo movimento de alguém.
      broadcastNow()
      notifyPlayersIfChanged()
    }
    armWaitTimer()
  }

  /** Uma espera começou ou acabou: os colegas veem a marca mudar, o painel Grupo relê, o relógio se refaz. */
  function onWaitsChanged() {
    scheduleBroadcast()
    notifyPlayersIfChanged()
    armWaitTimer()
  }

  const scheduleBroadcast = () => {
    if (session === null || pendingBroadcast !== null) return
    pendingBroadcast = setTimeout(() => {
      pendingBroadcast = null
      broadcastNow()
      // O mundo mudou: a lista do mestre recalcula o que depende dele — o
      // "Visão nesta cena" (quantos quadrados cada um enxerga ali) e o ocupante
      // da cabine que saiu da parada. Sem mudança, a lista não sai (chave JSON).
      notifyPlayersIfChanged()
    }, BROADCAST_THROTTLE_MS)
  }

  /** A TV entrou: sem cena escolhida ela fica esperando, e o aviso diz onde escolher. */
  const announceTable = () => {
    const text =
      session?.tableScene() === null
        ? 'A tela da mesa conectou. Escolha a cena dela na aba Jogo.'
        : 'A tela da mesa conectou.'
    useToastStore.getState().push('info', text, PLAYER_JOINED_TOAST_MS)
  }

  const clearLoanTimer = () => {
    if (loanTimer === null) return
    clearTimeout(loanTimer)
    loanTimer = null
  }

  /**
   * AJUDANTE CONTRATADO: despertador no fim de acordo mais próximo. O
   * broadcast devolve ao mestre o que venceu (`expireDue` da sessão) e manda
   * o recado; sem isto a ficha só voltaria quando alguém mexesse na mesa.
   */
  const armLoanTimer = () => {
    clearLoanTimer()
    const next = session?.nextLoanDeadline() ?? null
    if (next === null) return
    const clock = deps.now ?? Date.now
    loanTimer = setTimeout(() => {
      loanTimer = null
      broadcastNow()
      notifyPlayersIfChanged()
      armLoanTimer()
    }, Math.max(0, next - clock()))
  }

  /**
   * Alguém chegou: o mestre precisa saber SEM ir conferir o painel Jogo, que
   * costuma estar na aba inativa enquanto ele desenha. Só para conexão que
   * acabou de entrar — join recusado não cria jogador e não acha registro aqui.
   *
   * Não há aviso de código errado: o servidor Rust confere o código e recusa o
   * errado antes de repassar qualquer coisa ao TS (server.rs, `await_join`),
   * então um aviso disparado daqui nunca apareceria no app real. Avisar o
   * mestre exige o Rust emitir um evento próprio nessa recusa.
   */
  const announceJoin = (clientId: string, offlineBefore: ReadonlySet<string>) => {
    const player = session?.listPlayers().find((p) => p.clientId === clientId)
    if (player === undefined) return
    if (offlineBefore.has(player.playerId)) {
      announceReturn(player.playerId, player.name)
      return
    }
    const text =
      player.status === 'waiting'
        ? `${player.name} entrou e está sem personagem. Abra a aba Jogo para atribuir um.`
        : `${player.name} voltou para a sala.`
    useToastStore.getState().push('info', text, PLAYER_JOINED_TOAST_MS)
  }

  /**
   * Retomar a mesa: "Ana voltou: Lírio devolvida", com "Desfazer" — quem
   * digitou o nome de outro não leva a ficha sem o mestre ver. Os avisos de
   * uma mesa inteira voltando se juntam numa caixa só.
   */
  const announceReclaim = (reclaimed: ReclaimedSeat) => {
    const w = world()
    const names = reclaimed.tokenIds.map((tokenId) => [w.open, ...w.background].flatMap((scene) => scene.map.tokens).find((t) => t.id === tokenId)?.name ?? tokenId)
    useToastStore.getState().push('info', reclaimText(reclaimed.name, names), PLAYER_JOINED_TOAST_MS, {
      grupo: 'Mesa retomada',
      actions: [{ label: 'Desfazer', run: () => undoReclaim(reclaimed.playerId) }],
    })
  }

  const undoReclaim = (playerId: string) => {
    if (session === null) return
    void dispatch(session.undoReclaim(playerId))
    broadcastNow()
    notifyPlayersIfChanged()
  }

  const cancelDropTimer = () => {
    if (dropTimer !== null) clearTimeout(dropTimer)
    dropTimer = null
  }

  /**
   * A conexão de alguém caiu: o mestre fica sabendo sem ir conferir o Grupo,
   * mas só depois de `DROP_ANNOUNCE_DELAY_MS` — o Wi-Fi que pisca volta antes
   * e não vira aviso, e quem cai junto sai num aviso só.
   */
  const scheduleDropAnnounce = (playerId: string, name: string) => {
    pendingDrops.set(playerId, name)
    if (dropTimer === null) dropTimer = setTimeout(flushDrops, DROP_ANNOUNCE_DELAY_MS)
  }

  const flushDrops = () => {
    dropTimer = null
    const dropped = [...pendingDrops]
    pendingDrops.clear()
    if (session === null || dropped.length === 0) return
    const toastId = useToastStore.getState().push('info', dropText(dropped.map(([, name]) => name)), PLAYER_JOINED_TOAST_MS)
    for (const [playerId] of dropped) dropToasts.set(playerId, toastId)
  }

  /**
   * Voltou pelo resume. Antes do aviso de queda: silêncio, o mestre nem soube.
   * Depois: "Gina voltou", e o "Gina caiu" dela sai da tela (o de um grupo
   * fica enquanto alguém dele ainda está fora).
   */
  const announceReturn = (playerId: string, name: string) => {
    if (pendingDrops.delete(playerId)) {
      if (pendingDrops.size === 0) cancelDropTimer()
      return
    }
    const dropToast = dropToasts.get(playerId)
    if (dropToast !== undefined) {
      dropToasts.delete(playerId)
      if (![...dropToasts.values()].includes(dropToast)) useToastStore.getState().dismiss(dropToast)
    }
    useToastStore.getState().push('info', `${name} voltou`, PLAYER_JOINED_TOAST_MS)
  }

  const resetDrops = () => {
    cancelDropTimer()
    pendingDrops.clear()
    dropToasts.clear()
  }

  /**
   * Tira da tela o aviso de todo pedido que já não espera o mestre: o
   * jogador saiu, foi expulso, a sala fechou. O aviso que sobrasse seria um
   * "Deixar ir" que não leva ninguém a lugar nenhum.
   */
  const pruneTravelToasts = () => {
    for (const toasts of [travelToasts, heldToasts]) {
      for (const [requestId, toastId] of toasts) {
        if (session !== null && session.isTravelPending(requestId)) continue
        toasts.delete(requestId)
        useToastStore.getState().dismiss(toastId)
        // O pedido morreu: a cabine do embarque (se era) volta a ficar livre.
        releaseCabine(requestId)
      }
    }
    // CORREIO: mesma regra para o bilhete cujo destinatário foi expulso, ou com a sala fechada.
    for (const [letterId, toastId] of letterToasts) {
      if (session !== null && session.isLetterPending(letterId)) continue
      letterToasts.delete(letterId)
      useToastStore.getState().dismiss(toastId)
    }
    // Mesma regra para a porta: "Destrancar e abrir" de quem saiu não abre nada.
    for (const [requestId, toastId] of doorRequestToasts) {
      if (session !== null && session.isDoorRequestPending(requestId)) continue
      doorRequestToasts.delete(requestId)
      useToastStore.getState().dismiss(toastId)
    }
    // E para o esconder-se: "Deixar" de quem saiu não esconde nada.
    for (const [requestId, toastId] of hideToasts) {
      if (session !== null && session.isHidePending(requestId)) continue
      hideToasts.delete(requestId)
      useToastStore.getState().dismiss(toastId)
    }
    // E para o item: "Deixar" de quem saiu não entrega nada.
    for (const [requestId, toastId] of itemToasts) {
      if (session !== null && session.isItemRequestPending(requestId)) continue
      itemToasts.delete(requestId)
      useToastStore.getState().dismiss(toastId)
    }
    // E para a loja: "Vender" de quem saiu não vende nada.
    for (const [requestId, toastId] of purchaseToasts) {
      if (session !== null && session.isPurchasePending(requestId)) continue
      purchaseToasts.delete(requestId)
      useToastStore.getState().dismiss(toastId)
    }
    // Mesma regra para a ação no ponto: jogador expulso ou sala fechada não
    // deixa um "Nada aqui" que não chega a ninguém.
    for (const [requestId, toastId] of pointActionToasts) {
      if (session !== null && session.isPointActionPending(requestId)) continue
      pointActionToasts.delete(requestId)
      useToastStore.getState().dismiss(toastId)
    }
    // Mesma regra para o pedido de ficha: quem pediu caiu, ganhou ficha pelo
    // painel, ou a ficha foi para outro — o "Aceitar" não daria nada a ninguém.
    for (const [requestId, toastId] of seatClaimToasts) {
      if (session !== null && session.isSeatClaimPending(requestId)) continue
      seatClaimToasts.delete(requestId)
      useToastStore.getState().dismiss(toastId)
    }
  }

  /**
   * "Aceitar" ou "Não" do pedido de ficha. Aceitar revalida na sessão e dá a
   * ficha; o mapa sai na hora para quem pediu, e quem pedia a mesma ficha lê
   * que ela não está mais livre (a linha dele sai da caixa junto).
   */
  const answerSeatClaim = (requestId: string, allow: boolean) => {
    const toastId = seatClaimToasts.get(requestId)
    seatClaimToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    if (!allow) {
      void dispatch(session.denySeatClaim(requestId))
      return
    }
    void dispatch(session.approveSeatClaim(requestId, world()))
    broadcastNow()
    notifyPlayersIfChanged()
    pruneTravelToasts()
  }

  /**
   * Quem chegou sem personagem pediu uma ficha: "Hugo quer jogar com Kael" na
   * caixa "Pedidos", sozinho já em caixa (o mestre pode estar noutra cena, e
   * o jogador está parado esperando). O × vale "Não": a pergunta nunca some
   * sem resposta.
   */
  const askSeatClaim = (claim: SeatClaim) => {
    const toastId = useToastStore.getState().push('instrucao', `${claim.playerName} quer jogar com ${claim.tokenName}`, null, {
      actions: [
        { label: 'Aceitar', run: () => answerSeatClaim(claim.requestId, true) },
        { label: 'Não', run: () => answerSeatClaim(claim.requestId, false) },
      ],
      onDismiss: () => answerSeatClaim(claim.requestId, false),
      grupo: 'Pedidos',
      sempreEmCaixa: true,
    })
    seatClaimToasts.set(claim.requestId, toastId)
  }

  /**
   * Item que troca de lugar: grava pela store (a cena de fundo quando é lá)
   * ANTES de mandar o "está com você", e o snapshot sai na hora — o pino
   * some para todos que o viam. Sem quem grave, a resposta vira "disse não":
   * "está com você" com a mochila vazia seria mentira.
   */
  const completeItems = (result: HostResult, change: AppliedItems) => {
    if (deps.applyItems === undefined) {
      void dispatch({ outbound: result.outbound.map(({ clientId }) => ({ clientId, msg: { type: 'pin.take.answer', answer: 'denied' } })) })
      return
    }
    deps.applyItems(change)
    void dispatch(result)
    broadcastNow()
  }

  /** Resposta ao pedido de item: "Deixar" revalida na sessão e grava; "Não" avisa o jogador. */
  const answerItem = (requestId: string, allow: boolean) => {
    const toastId = itemToasts.get(requestId)
    itemToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    if (!allow) {
      void dispatch(session.denyItemRequest(requestId))
      return
    }
    const result = session.approveItemRequest(requestId, world())
    if (result.applyItems === undefined) void dispatch(result)
    else completeItems(result, result.applyItems)
  }

  /**
   * "Pegar": uma linha no grupo "Pedidos", a mesma caixa da porta e da
   * passagem. Espera o mestre (o × vale "Não"); "Deixar todos" responde
   * "Deixar" (`emLote`). Sozinho já abre a caixa, como o pedido da porta.
   */
  const askItem = (request: ItemRequest) => {
    const toastId = useToastStore.getState().push('instrucao', itemRequestLine(request), null, {
      actions: [
        { label: 'Deixar', run: () => answerItem(request.requestId, true), emLote: true },
        { label: 'Não', run: () => answerItem(request.requestId, false) },
      ],
      onDismiss: () => answerItem(request.requestId, false),
      grupo: 'Pedidos',
      sempreEmCaixa: true,
    })
    itemToasts.set(request.requestId, toastId)
  }

  /**
   * LOJA — resposta ao "Quero": "Vender" revalida na sessão e grava pela
   * store (o estoque cai e a mercadoria vai à mochila, na cena da banca) ANTES
   * de mandar o "está com você", e o snapshot sai na hora: quem vê a banca lê
   * o estoque novo. "Não" só avisa o jogador.
   */
  const answerPurchase = (requestId: string, vender: boolean) => {
    const toastId = purchaseToasts.get(requestId)
    purchaseToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    if (!vender || deps.applyItems === undefined) {
      void dispatch(session.denyPurchase(requestId))
      return
    }
    const result = session.approvePurchase(requestId, world())
    if (result.applyItems === undefined) {
      void dispatch(result)
      return
    }
    deps.applyItems(result.applyItems)
    void dispatch(result)
    broadcastNow()
  }

  /**
   * LOJA: o "Quero" vira uma linha no grupo "Pedidos", a mesma caixa do
   * "Pegar" e da passagem. Espera o mestre (o × vale "Não"). Sem `emLote`:
   * vender é decisão de uma mercadoria por vez, e "Deixar todos" não vende.
   */
  const askPurchase = (request: PurchaseRequest) => {
    const toastId = useToastStore.getState().push('instrucao', purchaseRequestLine(request), null, {
      actions: [
        { label: 'Vender', run: () => answerPurchase(request.requestId, true) },
        { label: 'Não', run: () => answerPurchase(request.requestId, false) },
      ],
      onDismiss: () => answerPurchase(request.requestId, false),
      grupo: 'Pedidos',
      sempreEmCaixa: true,
    })
    purchaseToasts.set(request.requestId, toastId)
  }

  /**
   * Resposta ao pedido da porta trancada. "Destrancar e abrir" tira o cadeado
   * e abre pela store (a cena de fundo quando a porta está lá), manda "O
   * mestre abriu" e o snapshot na hora: a porta abre para quem a vê.
   */
  const answerDoor = (requestId: string, allow: boolean) => {
    const toastId = doorRequestToasts.get(requestId)
    doorRequestToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    if (!allow) {
      void dispatch(session.denyDoorRequest(requestId))
      return
    }
    const result = session.approveDoorRequest(requestId, world())
    if (result.applyDoor !== undefined) deps.unlockAndOpenDoor?.(result.applyDoor.wallId, result.applyDoor.sceneId)
    void dispatch(result)
    broadcastNow()
  }

  /**
   * Pedido da porta trancada: uma linha no grupo "Pedidos", a mesma caixa dos
   * pedidos de passagem. Espera o mestre como eles (o × vale "Não"), e o
   * "Deixar todos" da caixa responde "Destrancar e abrir" (`emLote`).
   */
  const askDoor = (request: DoorRequest) => {
    const toastId = useToastStore.getState().push('instrucao', doorRequestLine(request), null, {
      actions: [
        { label: 'Destrancar e abrir', run: () => answerDoor(request.requestId, true), emLote: true },
        { label: 'Não', run: () => answerDoor(request.requestId, false) },
      ],
      onDismiss: () => answerDoor(request.requestId, false),
      grupo: 'Pedidos',
      // Sozinho já abre a caixa "Pedidos (1)": o mestre, noutra cena, lê que
      // alguém espera — o pedido de passagem sozinho segue o aviso de hoje.
      sempreEmCaixa: true,
    })
    doorRequestToasts.set(request.requestId, toastId)
  }

  /**
   * Resposta ao pedido de esconder-se. "Deixar" liga "Oculto para jogadores"
   * na ficha (passo do Ctrl+Z do mestre) e manda o snapshot na hora: os
   * outros deixam de receber a ficha, e o dono a recebe marcada (a tela dele
   * esmaece). "Não" só avisa quem pediu.
   */
  const answerHide = (requestId: string, allow: boolean) => {
    const toastId = hideToasts.get(requestId)
    hideToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    if (!allow) {
      void dispatch(session.denyHide(requestId))
      return
    }
    const result = session.approveHide(requestId, world())
    if (result.applyHide !== undefined) deps.hideToken?.(result.applyHide.tokenId, result.applyHide.sceneId)
    void dispatch(result)
    if (result.applyHide !== undefined) broadcastNow()
  }

  /**
   * Pedido de esconder-se: uma linha no grupo "Pedidos", a mesma caixa da
   * porta e da passagem. Espera o mestre como eles (o × vale "Não"; o jogador
   * está vendo "Aguardando o mestre…").
   */
  const askHide = (request: HideRequest) => {
    const toastId = useToastStore.getState().push('instrucao', hideRequestLine(request), null, {
      actions: [
        { label: 'Deixar', run: () => answerHide(request.requestId, true), emLote: true },
        { label: 'Não', run: () => answerHide(request.requestId, false) },
      ],
      onDismiss: () => answerHide(request.requestId, false),
      grupo: 'Pedidos',
      sempreEmCaixa: true,
    })
    hideToasts.set(request.requestId, toastId)
  }

  /** Mesma faxina de `pruneTravelToasts`, para os chamados: baixou a mão, caiu, foi expulso, a sala fechou. */
  const pruneCallToasts = () => {
    for (const [callId, toastId] of callToasts) {
      if (session !== null && session.isCallOpen(callId)) continue
      callToasts.delete(callId)
      useToastStore.getState().dismiss(toastId)
    }
  }

  /** Mesma faxina de `pruneTravelToasts`, para os pedidos de ação sobre ficha e as disputas na porta. */
  const pruneActionToasts = () => {
    for (const [requestId, toastId] of actionToasts) {
      if (session !== null && session.isTokenActionPending(requestId)) continue
      actionToasts.delete(requestId)
      useToastStore.getState().dismiss(toastId)
    }
    for (const [requestId, toastId] of disputeToasts) {
      if (session !== null && session.isBarDisputePending(requestId)) continue
      disputeToasts.delete(requestId)
      useToastStore.getState().dismiss(toastId)
    }
  }

  const answerBarDispute = (requestId: string, force: boolean) => {
    const toastId = disputeToasts.get(requestId)
    disputeToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    const result = session.answerBarDispute(requestId, force, world())
    void dispatch(result)
    if (result.applyDoor !== undefined) applyDoorAndBroadcast(result.applyDoor)
  }

  /**
   * DISPUTA NA PORTA: alguém força, do outro lado, a porta que um jogador
   * trancou com o ferrolho. Espera o mestre na Caixa de Pedidos, como o pedido
   * de ação: "Arrombar" abre a porta (o ferrolho sai), "Aguenta" deixa como
   * está. O × vale "Aguenta": a porta nunca abre sem o mestre dizer.
   */
  const askBarDispute = (dispute: BarDispute) => {
    const where = dispute.sceneName === undefined ? '' : ` em ${dispute.sceneName}`
    const toastId = useToastStore.getState().push('instrucao', `${dispute.playerName} tenta abrir a porta que ${dispute.barrerName} trancou com o ferrolho${where}`, null, {
      actions: [
        { label: 'Arrombar', run: () => answerBarDispute(dispute.requestId, true) },
        { label: 'Aguenta', run: () => answerBarDispute(dispute.requestId, false) },
      ],
      onDismiss: () => answerBarDispute(dispute.requestId, false),
      grupo: 'Pedidos',
    })
    disputeToasts.set(dispute.requestId, toastId)
  }

  /** "Ana passou o ferrolho numa porta", "Ana barrou Fundo do poço em Cripta": só informa, some sozinho. */
  const announceTranca = (aviso: TrancaAviso) => {
    const where = aviso.sceneName === undefined ? '' : ` em ${aviso.sceneName}`
    const oQue =
      aviso.alvo === 'porta'
        ? aviso.acao === 'trancou'
          ? 'passou o ferrolho numa porta'
          : 'tirou o ferrolho de uma porta'
        : `${aviso.acao === 'trancou' ? 'barrou' : 'tirou a barra de'} ${aviso.rotulo ?? 'uma passagem'}`
    useToastStore.getState().push('info', `${aviso.playerName} ${oQue}${where}`)
  }

  /** Porta que a sessão mandou abrir ou fechar: o mestre vê pela store, os jogadores pelo snapshot imediato. */
  const applyDoorAndBroadcast = (door: AppliedDoor) => {
    // CHAVE ABRE PORTA: a chave da mochila tira o cadeado antes de abrir,
    // pelo mesmo caminho do "Destrancar e abrir" do mestre.
    if (door.unlock === true) deps.unlockAndOpenDoor?.(door.wallId, door.sceneId)
    else if (door.sceneId === undefined) deps.applyDoor(door.wallId, door.open)
    else deps.applyDoor(door.wallId, door.open, door.sceneId)
    broadcastNow()
  }

  /** "Visto" ou "Responder": a linha sai e a resposta vai só a quem chamou. */
  const answerCall = (callId: string, answer: (s: HostSession) => HostResult) => {
    const toastId = callToasts.get(callId)
    callToasts.delete(callId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session !== null) void dispatch(answer(session))
  }

  /**
   * Chamado novo: uma linha no grupo "Chamados", em ordem de chegada (o
   * Urgente sobe ao topo da caixa). Espera o mestre, como o pedido de
   * passagem: o × vale "Visto" — a mão do jogador não pode ficar acesa para
   * sempre por um aviso fechado sem resposta.
   */
  const announceCall = (call: MasterCall) => {
    const label = CALL_REASON_LABELS[call.reason]
    const text = call.text === undefined ? `${call.playerName}: ${label}` : `${call.playerName}: ${label} — ${call.text}`
    const goTo = deps.onGoToPoint
    const irLa =
      goTo === undefined
        ? []
        : [
            {
              label: 'Ir lá',
              mantem: true,
              run: () => {
                const target = session?.callTarget(call.callId, world()) ?? null // null = sala fechada ou ficha fora de cena
                if (target !== null) goTo(target.sceneId, target.x, target.y)
              },
            },
          ]
    const see = () => answerCall(call.callId, (s) => s.seeCall(call.callId))
    const toastId = useToastStore.getState().push('instrucao', text, null, {
      actions: [...irLa, { label: 'Visto', run: see }],
      onDismiss: see,
      grupo: 'Chamados',
      urgente: call.reason === 'urgente',
      resposta: {
        rotulo: 'Responder',
        maxLength: NOTE_MAX_LENGTH,
        enviar: (texto) => answerCall(call.callId, (s) => s.replyCall(call.callId, texto)),
      },
    })
    callToasts.set(call.callId, toastId)
    deps.onCall?.(call)
  }

  /** "Nada aqui" ou "Feito": a linha sai e a resposta vai só a quem pediu. */
  const answerPointAction = (requestId: string, answer: PointActionAnswer) => {
    const toastId = pointActionToasts.get(requestId)
    pointActionToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    void dispatch(session.answerPointAction(requestId, answer))
  }

  /**
   * "ENTREGAR PISTA…" do Revistar: o cartão do pino oculto abre só em quem
   * revistou (o mesmo `showPin` do "Mostrar agora a…"), e o pedido dele fica
   * respondido ("Feito"). O mestre lê no aviso se saiu — ou por que não: a
   * linha pode ter esperado enquanto o jogador saía da cena ou caía.
   */
  const deliverClue = (request: PointActionRequest, pinId: string) => {
    if (session === null) return
    const shown = session.showPin(request.playerId, pinId, world())
    answerPointAction(request.requestId, 'seen')
    if (shown.outbound.length === 0) {
      useToastStore.getState().push('error', `Não deu para entregar a pista a ${request.playerName}: saiu desta cena ou perdeu a conexão.`)
      return
    }
    broadcastNow()
    void dispatch(shown)
    notifyPinAudiencesIfChanged()
    useToastStore.getState().push('info', `Cartão aberto na tela de ${request.playerName}.`)
  }

  /**
   * AÇÃO NO PONTO: "Fabi quer Procurar — Ferreiro" na Caixa (grupo
   * "Pedidos"), esperando o mestre. "Ir lá" leva ao ponto e deixa a linha;
   * "Nada aqui" e "Feito" respondem só a quem pediu. O × vale "Feito": a
   * pergunta nunca some sem resposta. Sem `emLote`: o "Deixar todos" é dos
   * pedidos de passagem e passa por esta linha sem tocar nela.
   */
  const askPointAction = (request: PointActionRequest) => {
    const goTo = deps.onPointActionGo
    const irLa = goTo === undefined ? [] : [{ label: 'Ir lá', mantem: true, run: () => goTo(request) }]
    // REVISTAR: um "Entregar: Carta" por pista oculta da sala (`hiddenCluesAt`).
    const entregar = (request.pistas ?? []).map((pista) => ({
      label: `Entregar: ${pista.label}`,
      run: () => deliverClue(request, pista.pinId),
    }))
    const toastId = useToastStore.getState().push('instrucao', pointActionMasterText(request), null, {
      actions: [
        ...irLa,
        ...entregar,
        { label: 'Nada aqui', run: () => answerPointAction(request.requestId, 'nothing') },
        { label: 'Feito', run: () => answerPointAction(request.requestId, 'seen') },
      ],
      onDismiss: () => answerPointAction(request.requestId, 'seen'),
      grupo: 'Pedidos',
    })
    pointActionToasts.set(request.requestId, toastId)
  }

  /** Guarda o motivo no topo dos recentes: repetido sobe, e só os `TRAVEL_DENY_RECENTS_MAX` mais novos ficam. */
  const rememberDenyReason = (motivo: string) => {
    travelDenyRecents = [motivo, ...travelDenyRecents.filter((texto) => texto !== motivo)].slice(0, TRAVEL_DENY_RECENTS_MAX)
  }

  const answerAction = (requestId: string, accepted: boolean, reply = '') => {
    const toastId = actionToasts.get(requestId)
    actionToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    void dispatch(session.answerTokenAction(requestId, accepted, reply))
  }

  /**
   * AGIR SOBRE UMA FICHA: o pedido entra na Caixa de Pedidos ("Pedidos"), e
   * espera o mestre como o pedido de passagem — o jogador olha "Aguardando…".
   * O × vale "Recusar". Sem "emLote": o "Deixar todos" da caixa é da passagem,
   * e aceitar de uma vez "Empurrar", "Agarrar" e "Oferecer" não é uma decisão só.
   * O campo "Resposta só para Ana" leva junto o que o NPC responde: o texto
   * vai só a quem pediu, e não à cena (o recado de cena chega a todos).
   */
  const askAction = (request: TokenActionRequest) => {
    const where = request.sceneName === undefined ? '' : ` em ${request.sceneName}`
    const said = request.text === undefined ? '' : ` — "${request.text}"`
    const text = `${request.playerName} → ${request.targetName}${where}: ${TOKEN_ACTION_LABELS[request.action]} (${distanceLabel(request.distanceCells)})${said}`
    const toastId = useToastStore.getState().push('instrucao', text, null, {
      actions: [
        { label: 'Aceitar', run: (resposta) => answerAction(request.requestId, true, resposta) },
        { label: 'Recusar', run: (resposta) => answerAction(request.requestId, false, resposta) },
      ],
      onDismiss: () => answerAction(request.requestId, false),
      grupo: 'Pedidos',
      resposta: { rotulo: `Resposta só para ${request.playerName} (opcional)`, maxLength: TOKEN_ACTION_REPLY_MAX_LENGTH },
    })
    actionToasts.set(request.requestId, toastId)
  }

  /**
   * "há 3 min · agora a 20 casas do pino", lido do mundo de AGORA a cada
   * chamada (a tela relê sozinha). `''` quando o pedido já não espera: a
   * linha não inventa idade para pergunta respondida. Não envia nada.
   */
  const travelDetail = (requestId: string): string => {
    const status = session === null ? null : session.travelRequestStatus(requestId, world())
    if (status === null) return ''
    return linhaDoPedidoVivo(clock() - status.requestedAt, status.distanceCells)
  }

  /** Tira o aviso de espera do Volto já: a pergunta voltou ou o pedido morreu. */
  const dismissHeld = (requestId: string) => {
    const toastId = heldToasts.get(requestId)
    if (toastId === undefined) return
    heldToasts.delete(requestId)
    useToastStore.getState().dismiss(toastId)
  }

  /**
   * VOLTO JÁ: o "Deixar ir" não levou ninguém porque o jogador está fora da
   * mesa. O mestre precisa LER isso — sem o aviso, ele acha que liberou, e a
   * pergunta que volta na volta do jogador parece repetida à toa. Fica até a
   * pergunta voltar (ou o pedido morrer): é o estado do pedido, não um fato
   * que passa.
   */
  const announceHeld = (request: TravelRequest) => {
    dismissHeld(request.requestId)
    const toastId = useToastStore
      .getState()
      .push('info', `${request.playerName} está no Volto já: o "Deixar ir" para ${request.toSceneName} espera a volta, e a pergunta volta aqui.`, null)
    heldToasts.set(request.requestId, toastId)
  }

  /** CORREIO: "Entregar" leva o bilhete a quem ia receber; "Interceptar" (e o ×) some com ele. */
  const answerLetter = (letterId: string, deliver: boolean) => {
    const toastId = letterToasts.get(letterId)
    letterToasts.delete(letterId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    void dispatch(deliver ? session.deliverLetter(letterId) : session.interceptLetter(letterId))
  }

  /**
   * CORREIO: o bilhete vira um aviso que ESPERA o mestre, com o texto inteiro
   * (ler é só olhar). Atrasar é não responder ainda: o aviso fica. O × vale
   * "Interceptar", como o "Não" do pedido de passagem: o aviso nunca some
   * deixando o bilhete preso no correio. Grupo próprio, fora de "Pedidos": o
   * "Deixar todos" de lá não pode entregar bilhete. O da caixa "Bilhetes (N)"
   * entrega todos: "Entregar" é a resposta em lote (sem ela o botão não fazia nada).
   */
  const askLetter = (letter: LetterRequest) => {
    const text = `${letter.fromName} → ${letter.toName}, ${letterViaPhrase(letter.via)}: "${letter.text}"`
    const toastId = useToastStore.getState().push('instrucao', text, null, {
      actions: [
        { label: 'Entregar', run: () => answerLetter(letter.letterId, true), emLote: true },
        { label: 'Interceptar', run: () => answerLetter(letter.letterId, false) },
      ],
      onDismiss: () => answerLetter(letter.letterId, false),
      grupo: 'Bilhetes',
    })
    letterToasts.set(letter.letterId, toastId)
  }

  /**
   * Resposta ao pedido de passagem. `allow`: "Deixar ir" (ou "Liberar uma
   * vez", no pino trancado); `'pede'`: "Passar para pede" — o jogador passa e
   * o pino trancado vira "pede" na cena dele. `motivo`: o texto do "Não,
   * porque…" (só com `allow` falso).
   */
  const answerTravel = (requestId: string, allow: boolean | 'pede', motivo?: string) => {
    const toastId = travelToasts.get(requestId)
    travelToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    // Qualquer resposta tira o ocupante da cabine: "Não" e recusa a deixam na
    // parada, livre; "Deixar ir" a leva (e o broadcast da chegada já sai).
    releaseCabine(requestId)
    if (session === null) return
    if (allow === false) {
      const pendente = session.isTravelPending(requestId)
      void dispatch(session.denyTravel(requestId, motivo))
      // Só o motivo que chegou a ser dito entra nos recentes: pedido que já tinha morrido não conta.
      if (pendente && motivo !== undefined && motivo.trim().length > 0) rememberDenyReason(clampTravelDenyText(motivo.trim()))
      // O pedido saiu da sessão: o selo "pedido" da lista Cenas sai junto.
      notifyPlayersIfChanged()
      return
    }
    const result = allow === 'pede' ? session.approveLockedTravelAsAsk(requestId, world()) : session.approveTravel(requestId, world())
    if (result.travelHeld !== undefined) {
      announceHeld(result.travelHeld)
      notifyPlayersIfChanged()
      return
    }
    if (result.applyPinPassage !== undefined) {
      const { pinId, passagem, sceneId } = result.applyPinPassage
      deps.setPinPassage?.(pinId, passagem, sceneId)
    }
    if (result.applyTransfer === undefined) {
      // Recusa da revalidação (o token andou, o pino sumiu, a porta foi
      // trancada) ou pedido que já morreu.
      void dispatch(result)
      // Barrada do outro lado depois do aviso: o pedido volta como disputa,
      // e o mestre decide lendo quem barrou.
      if (result.travelRequest !== undefined) askTravel(result.travelRequest)
      notifyPlayersIfChanged()
      return
    }
    completeTransfer(result, result.applyTransfer)
  }

  /**
   * "Deixar ir com quem está perto": a sessão revalida tudo no clique (quem
   * pediu e quem ainda está perto) e devolve quem pediu primeiro. Cada um
   * passa pela mesma conclusão do "Deixar ir" — a ficha muda de cena pela
   * store (`transferToken`, fora do desfazer), depois o "Você chegou".
   */
  const answerTravelTogether = (requestId: string) => {
    const toastId = travelToasts.get(requestId)
    travelToasts.delete(requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    const [lead, ...companions] = session.approveTravelTogether(requestId, world())
    if (lead === undefined || lead.applyTransfer === undefined) {
      // Pedido que já morreu, ou recusa da revalidação: ninguém foi.
      if (lead !== undefined) void dispatch(lead)
      notifyPlayersIfChanged()
      return
    }
    completeTransfer(lead, lead.applyTransfer)
    for (const companion of companions) {
      if (companion.applyTransfer !== undefined) completeTransfer(companion, companion.applyTransfer)
    }
    // Quem foi junto e também tinha pedido: o aviso dele não pergunta mais nada.
    pruneTravelToasts()
  }

  /**
   * Move a ficha de quem viaja e, SÓ se ela passou, cada ficha que atravessa
   * junto pela mesma travessia da store:
   *
   * AJUDANTE CONTRATADO: as fichas emprestadas a este jogador que estavam na
   * mesma cena de partida (`transfer.companions`). O ajudante que não der para
   * mover (sumiu da cena) fica onde estava: a viagem do dono não desanda por
   * causa dele.
   *
   * LEVAR FICHA JUNTO: as fichas que `tokenId` leva (`transfer.junto`). Ficha
   * levada que não passou (sumiu entre a validação e aqui) não desfaz a de
   * quem leva: ela chegou, e é isso que o aviso diz.
   *
   * MONTARIA E FAMILIAR: o séquito (`transfer.entourage`), cada um na casa que
   * a sessão escolheu. O diário e o "Você chegou" são da ficha principal: o
   * pônei não é viagem à parte.
   *
   * Devolve se a ficha PRINCIPAL mudou de cena.
   */
  const applyTransferAlong = (transfer: AppliedTransfer): boolean => {
    // ATALHO NA MESMA CENA (`fromSceneId === toSceneId`): cada ficha só anda
    // (`moveWithinScene`); a troca de cena da store recusaria origem e destino iguais.
    const apply = transfer.fromSceneId === transfer.toSceneId ? moveWithinScene : deps.applyTransfer
    if (apply === undefined) return false
    const { companions = [], junto, entourage, ...alone } = transfer
    if (!apply(alone)) return false
    // Ausente é o caso comum (ninguém acompanha), não falha.
    for (const companion of companions) apply({ ...alone, tokenId: companion.tokenId, x: companion.x, y: companion.y })
    for (const carried of junto ?? []) apply({ ...alone, tokenId: carried.tokenId, x: carried.x, y: carried.y })
    for (const seat of entourage ?? []) apply({ ...alone, tokenId: seat.tokenId, x: seat.x, y: seat.y })
    return true
  }

  /**
   * ATALHO NA MESMA CENA: a ficha só anda dentro do mapa, pelo mesmo caminho
   * do movimento do jogador (fora do desfazer do mestre). A troca de cena da
   * store recusa origem e destino iguais, e está certa: não há o que trocar.
   * A cena aberta vai sem `sceneId`, como o movimento de sempre.
   */
  const moveWithinScene = (transfer: AppliedTransfer): boolean => {
    const { tokenId, x, y, toSceneId } = transfer
    if (world().open.sceneId === toSceneId) deps.applyMove(tokenId, x, y)
    else deps.applyMove(tokenId, x, y, toSceneId)
    return true
  }

  /**
   * ATALHO NA MESMA CENA: "Ana atravessou para outro ponto de Torre". Não
   * entra no cartão "entrou em" da cena (`announceArrival`): ela não chegou,
   * só andou dentro dela. Some sozinho como o cartão de chegada.
   */
  const announceShortcut = (transfer: AppliedTransfer) => {
    const goTo = deps.onGoToScene
    useToastStore
      .getState()
      .push(
        'info',
        `${transfer.playerName} atravessou para outro ponto de ${transfer.toSceneName}`,
        CHEGADA_TOAST_MS,
        goTo === undefined ? {} : { actions: [{ label: 'Ir lá', run: () => goTo(transfer.toSceneId, transfer.x, transfer.y, transfer.piso ?? 0) }] },
      )
  }

  /**
   * A ficha troca de cena: "Deixar ir" do mestre ou pino livre. Move pela
   * store ANTES de mandar o `scene.changed`, e só avisa a chegada se moveu.
   * No atalho na mesma cena ela só anda (`moveWithinScene`).
   */
  const completeTransfer = (result: HostResult, transfer: AppliedTransfer) => {
    // `moveAndLog` passa por `applyTransferAlong`: quem ela leva vai junto, e
    // no atalho na mesma cena ela só anda (`moveWithinScene`).
    const moved = moveAndLog(transfer)
    // LEVAR FICHA JUNTO: o pedido de passagem de quem foi levado morreu na
    // sessão (`carriedAlong`); o aviso "Fulano quer passar por…" sai junto,
    // senão o "Deixar ir" dele ficaria na tela sem fazer nada.
    pruneTravelToasts()
    if (!moved) {
      // O "Você chegou" não pode sair: a ficha não saiu do lugar.
      // Só a quem PEDIU: o dono de uma ficha levada junto (`by: 'master'`) não pediu nada.
      const askers = result.outbound.filter(({ msg }) => !(msg.type === 'scene.changed' && msg.by !== undefined))
      // Quem foi levado e perdeu o pedido que esperava o mestre lê a recusa dele (`lostTravels`).
      void dispatch({
        outbound: [...askers.map(({ clientId }) => ({ clientId, msg: { type: 'pin.travel.rejected', reason: 'unavailable' } }) satisfies Outbound), ...(result.lostTravels ?? [])],
      })
      // O pedido já saiu da sessão ao ser aprovado: o selo da lista Cenas não pode ficar.
      notifyPlayersIfChanged()
      return
    }
    // A cabine anda ANTES do broadcast: quem ficou na parada de partida já
    // recebe "longe" no mesmo envio em que o viajante chega.
    if (result.applyCabine !== undefined) deps.applyCabine?.(result.applyCabine)
    // Primeiro `scene.changed`, depois o snapshot da cena nova: a ordem dos
    // `net_send` é a ordem em que o jogador recebe.
    void dispatch(result)
    broadcastNow()
    notifyPlayersIfChanged()
    if (transfer.fromSceneId === transfer.toSceneId) announceShortcut(transfer)
    else announceArrival(transfer)
    // CHAVE ABRE PORTA no pino trancado: só depois de a ficha mudar de cena —
    // se não moveu, ninguém abriu nada.
    if (result.pinKeyUsed !== undefined) useToastStore.getState().push('info', pinKeyLine(result.pinKeyUsed))
  }

  /**
   * "Ana abriu a porta" / "Ana fechou a porta" (com "em Cripta" quando é numa
   * cena de fundo). Aviso comum, some sozinho; o novo do mesmo jogador
   * substitui o anterior dele para o abre-e-fecha não empilhar.
   */
  const announceDoor = (door: AppliedDoor) => {
    const previous = doorToasts.get(door.playerId)
    if (previous !== undefined) useToastStore.getState().dismiss(previous)
    const where = door.sceneName === undefined ? '' : ` em ${door.sceneName}`
    const text = `${door.playerName} ${door.open ? 'abriu' : 'fechou'} a porta${where}`
    doorToasts.set(door.playerId, useToastStore.getState().push('info', text))
  }

  /**
   * Pedido de passagem válido: vira um aviso que ESPERA o mestre (não some
   * sozinho — o jogador está parado olhando "Aguardando o mestre…"). O × vale
   * "Não": a pergunta nunca some sem resposta. Grupo "Pedidos": com dois ou
   * mais esperando, viram uma caixa só, e o "Deixar todos" dela roda o
   * "Deixar ir" (`emLote`) de cada um — a mesma revalidação, pedido a pedido.
   *
   * Embaixo da frase, a linha viva "há 3 min · agora a 20 casas do pino"
   * (`travelDetail`): o mestre vê quem espera há mais tempo e se a ficha
   * ainda está no pino antes de deixar ir.
   */
  const askTravel = (request: TravelRequest) => {
    dismissHeld(request.requestId)
    if (request.trancada === true) {
      askLockedTravel(request)
      return
    }
    // BARRADA do outro lado: é uma disputa, e o botão diz o que ele faz com a
    // barra. Fora do "Deixar todos" e do "com quem está perto": quebrar a barra
    // de um colega não vai em lote.
    const barrada = request.barradaPor
    // Quem está perto AGORA, só para oferecer o botão e dizer quantos; o
    // clique conta de novo (`answerTravelTogether`), porque o grupo anda.
    const nearby = session === null || barrada !== undefined ? 0 : session.travelCompanions(request.requestId, world()).length
    const together = nearby === 0 ? [] : [{ label: `Deixar ir com quem está perto (${nearby})`, run: () => answerTravelTogether(request.requestId) }]
    // Pino com passe: o mestre lê que o pedido veio porque a ficha não tem o passe.
    const semPasse = request.motivo === 'sem-passe' ? ' (sem passe)' : ''
    // CABINE DE TRANSPORTE: quem pede com a cabine ali embarcou — o aviso diz
    // em qual cabine ele está, e a parada passa a dizer "ocupada" aos outros.
    const naCabine = request.cabine === undefined ? '' : ` (na cabine ${request.cabine})`
    if (request.cabine !== undefined) {
      travelsComCabine.add(request.requestId)
      scheduleBroadcast()
    }
    const destino = `${travelWithText(request)} por ${request.pinLabel} → ${request.toSceneName}${semPasse}${naCabine}`
    // Na volta do Volto já é a MESMA pergunta: o texto diz por que ela reaparece.
    const pergunta =
      request.heldWhileAway === true
        ? `${request.playerName} voltou do Volto já e ainda quer passar${destino}. O "Deixar ir" esperou a volta.`
        : `${request.playerName} quer passar${destino}`
    const text = barrada === undefined ? pergunta : `${pergunta} (barrada do outro lado por ${barrada})`
    const toastId = useToastStore.getState().push('instrucao', text, null, {
      actions:
        barrada === undefined
          ? [
              { label: 'Deixar ir', run: () => answerTravel(request.requestId, true), emLote: true },
              ...together,
              ...travelVerAction(request.requestId),
              { label: 'Não', run: () => answerTravel(request.requestId, false) },
            ]
          : [
              { label: 'Passa (quebra a barra)', run: () => answerTravel(request.requestId, true) },
              ...travelVerAction(request.requestId),
              { label: 'A barra aguenta', run: () => answerTravel(request.requestId, false) },
            ],
      onDismiss: () => answerTravel(request.requestId, false),
      grupo: 'Pedidos',
      resposta: travelDenyResposta(request.requestId),
      detalhe: () => travelDetail(request.requestId),
    })
    travelToasts.set(request.requestId, toastId)
  }

  /**
   * "Ver" de uma linha de pedido de passagem (comum ou pelo pino trancado): o
   * editor vai à ficha de quem pediu, e a linha fica (`mantem`) — olhar não
   * responde. A ficha é lida no clique: ela pode ter andado. Sem quem leve o
   * editor, nenhum "Ver".
   */
  const travelVerAction = (requestId: string): ToastAction[] => {
    const goTo = deps.onGoToPoint
    if (goTo === undefined) return []
    return [
      {
        label: 'Ver',
        mantem: true,
        run: () => {
          const target = session?.travelTarget(requestId, world()) ?? null // null = sala fechada, pedido decidido ou ficha fora de cena
          if (target !== null) goTo(target.sceneId, target.x, target.y)
        },
      },
    ]
  }

  /** "Não, porque…" de uma linha de pedido de passagem: o motivo curto chega só a quem pediu. */
  const travelDenyResposta = (requestId: string): ToastResposta => ({
    rotulo: 'Não, porque…',
    maxLength: TRAVEL_DENY_TEXT_MAX_LENGTH,
    enviar: (texto) => answerTravel(requestId, false, texto),
    recentes: () => travelDenyRecents,
  })

  /**
   * Pedido pelo pino TRANCADO que aceita tentativas: a mesma linha em
   * "Pedidos", com as respostas do cadeado. "Liberar uma vez" leva o jogador e
   * deixa o pino trancado (é ela que o "Deixar todos" roda, `emLote`); "Passar
   * para pede" leva e troca o modo, para a próxima passagem perguntar; "Não"
   * (e o ×) recusa, e "Não, porque…" recusa com o motivo, como na linha comum.
   * "Ver" leva o editor à ficha de quem pediu sem responder. Sem quem troque o
   * modo, a linha fica sem "Passar para pede".
   */
  const askLockedTravel = (request: TravelRequest) => {
    const paraPede = deps.setPinPassage === undefined ? [] : [{ label: 'Passar para pede', run: () => answerTravel(request.requestId, 'pede') }]
    const toastId = useToastStore.getState().push('instrucao', `${request.playerName} quer passar${travelWithText(request)} por ${request.pinLabel} (trancada) → ${request.toSceneName}`, null, {
      actions: [
        { label: 'Liberar uma vez', run: () => answerTravel(request.requestId, true), emLote: true },
        ...paraPede,
        ...travelVerAction(request.requestId),
        { label: 'Não', run: () => answerTravel(request.requestId, false) },
      ],
      onDismiss: () => answerTravel(request.requestId, false),
      grupo: 'Pedidos',
      resposta: travelDenyResposta(request.requestId),
    })
    travelToasts.set(request.requestId, toastId)
  }

  /** A pergunta "voltou?" que já não espera o mestre (a Ana voltou pelo resume, quem entrou caiu, a sala fechou) sai da Caixa. */
  const pruneReturnToasts = () => {
    for (const [playerId, toastId] of returnToasts) {
      if (session !== null && session.isReturnPending(playerId)) continue
      returnToasts.delete(playerId)
      useToastStore.getState().dismiss(toastId)
    }
  }

  /**
   * Devolve ao mapa as fichas que o mestre guardou de `playerId`, cada uma na
   * cena de onde saiu (sumida a cena, na aberta). `newOwner`: de quem ficam —
   * dele de novo (ele voltou) ou de quem recebeu as fichas dele ("Passar
   * fichas e mapa a…"); `null`, sem dono (Dispensar, sala fechando). Devolve
   * os nomes, para o aviso.
   */
  const restoreStoredOf = (playerId: string, newOwner: string | null): string[] => {
    const stored = storedTokens.get(playerId)
    if (stored === undefined) return []
    storedTokens.delete(playerId)
    const current = world()
    const backgroundIds = new Set(current.background.map((scene) => scene.sceneId))
    for (const { token, sceneId } of stored) {
      // Ausente = a cena aberta: a de onde saiu, se é ela agora, ou a cena que sumiu.
      const where = sceneId !== null && sceneId !== current.open.sceneId && backgroundIds.has(sceneId) ? sceneId : undefined
      deps.restoreToken?.(token, where)
      if (newOwner !== null && session !== null) void dispatch(session.assignToken(newOwner, token.id))
    }
    return stored.map(({ token }) => token.name)
  }

  /** "É ela" ou "Outra pessoa". Só o "É ela" muda algo: a conexão nova vira a Ana, e a ficha guardada dela volta. */
  const answerReturn = (candidate: ReturnCandidate, same: boolean) => {
    const toastId = returnToasts.get(candidate.playerId)
    returnToasts.delete(candidate.playerId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    if (session === null) return
    if (!same) {
      session.denyReturn(candidate.playerId)
      return
    }
    const result = session.confirmReturn(candidate.playerId, candidate.previousId, world())
    if (result.outbound.length === 0) {
      // A pergunta já não valia: nada mudou.
      notifyPlayersIfChanged()
      return
    }
    void dispatch(result)
    restoreStoredOf(candidate.previousId, candidate.previousId)
    // Voltou: o "Ana caiu" dela sai da tela, como na volta pelo resume.
    announceReturn(candidate.previousId, candidate.name)
    // Uma segunda "ana" que esperava a mesma pergunta: a Ana já voltou, e a pergunta dela sai.
    pruneReturnToasts()
    // A "Ana (2)" deixou de existir, e a sessão esqueceu os pedidos dela (pino,
    // porta, ação no ponto, mão): o "Deixar ir" ou o "Visto" que sobrasse na
    // Caixa não chegaria a ninguém.
    pruneTravelToasts()
    pruneCallToasts()
    broadcastNow()
    notifyPlayersIfChanged()
  }

  /**
   * Alguém entrou com o nome de quem está fora: "Ana voltou?" na Caixa. O ×
   * vale "Outra pessoa" — juntar duas pessoas é o que não pode acontecer sem
   * o mestre dizer. Fica até a resposta: quem entrou está esperando personagem.
   */
  const askReturn = (candidate: ReturnCandidate) => {
    const toastId = useToastStore.getState().push('instrucao', `${candidate.name} voltou?`, null, {
      actions: [
        { label: 'É ela', run: () => answerReturn(candidate, true) },
        { label: 'Outra pessoa', run: () => answerReturn(candidate, false) },
      ],
      onDismiss: () => answerReturn(candidate, false),
      grupo: 'Pedidos',
      sempreEmCaixa: true,
    })
    returnToasts.set(candidate.playerId, toastId)
  }

  /** A aba velha de quem voltou por outra aba já leu `session.replaced`: derruba a conexão dela. */
  const dropReplaced = (clientId: string) => {
    lastHeard.delete(clientId)
    awayClients.delete(clientId)
    gzipClients.delete(clientId)
    deps.invoke('net_kick', { clientId }).catch(() => {
      // Já fechada no Rust (a aba foi fechada antes): era o que se queria.
    })
  }

  /**
   * "Espiar" aceito: o mestre lê quem espiou, quem espiou recebe o cone agora,
   * e no fim do prazo sai o snapshot que o fecha — a sessão já não conta a
   * porta espiada depois de `PEEK_DURATION_MS` (a folga cobre o relógio do timer).
   */
  const announcePeek = (peek: HostPeek) => {
    useToastStore.getState().push('info', peekNoticeText(peek), PLAYER_JOINED_TOAST_MS)
    broadcastNow()
    const timer = setTimeout(() => {
      peekTimers.delete(timer)
      broadcastNow()
    }, PEEK_DURATION_MS + PEEK_CLOSE_SLACK_MS)
    peekTimers.add(timer)
  }

  /**
   * DESISTIR DO PEDIDO: o pedido saiu da espera sem o mestre responder. A
   * linha dele some da Caixa de Pedidos (um "Deixar ir" ali não levaria
   * ninguém), e no lugar fica um aviso curto que some sozinho — não pede
   * resposta, só explica por que a linha sumiu.
   */
  const dropTravelToast = (cancelled: TravelCancelled) => {
    const toastId = travelToasts.get(cancelled.requestId)
    travelToasts.delete(cancelled.requestId)
    if (toastId !== undefined) useToastStore.getState().dismiss(toastId)
    const text = cancelled.reason === 'far' ? `${cancelled.playerName} se afastou da passagem` : `${cancelled.playerName} desistiu de passar`
    useToastStore.getState().push('info', text)
  }

  /**
   * FECHADURA COM SEGREDO: o mestre lê cada tentativa conferida (quem, onde, o
   * que tentou), sem que ela vire pedido — a combinação já respondeu sozinha.
   */
  const tellLockAttempt = (attempt: LockAttempt) => {
    const text = attempt.ok
      ? `${attempt.playerName} abriu a fechadura de ${attempt.pinLabel} com “${attempt.tentativa}”`
      : `${attempt.playerName} tentou “${attempt.tentativa}” em ${attempt.pinLabel}: não abriu`
    useToastStore.getState().push('info', text)
  }

  /**
   * BILHETE NO LUGAR: o mestre lê na hora quem deixou o quê e em que cena, com
   * "Apagar" (o bilhete que não cabe na mesa). O aviso fica mais que um "info"
   * comum — é uma oferta de ação —, mas some sozinho: marca não é pedido, e
   * ninguém fica esperando resposta do outro lado.
   */
  const tellMarkPlaced = (mark: AppliedMark) => {
    const { marca, playerName, sceneName } = mark
    const text =
      marca.tipo === 'bilhete'
        ? `${playerName} deixou um bilhete em ${sceneName}: “${marca.texto ?? ''}”`
        : `${playerName} riscou uma seta de giz em ${sceneName}`
    const removeMark = deps.removeMark
    const actions =
      removeMark === undefined
        ? []
        : [
            {
              label: 'Apagar',
              // A cena é a que tem a marca no clique, não a de quando ela chegou.
              run: () => {
                if (removeMark(marca.id)) broadcastNow()
                else useToastStore.getState().push('info', marca.tipo === 'bilhete' ? 'Esse bilhete já não está no mapa' : 'Essa seta de giz já não está no mapa')
              },
            },
          ]
    useToastStore.getState().push('info', text, MARK_NOTICE_MS, { actions })
  }

  /**
   * CABINE DE TRANSPORTE: "Chamar a cabine" que valeu. A chamada entra na fila
   * pelo integrador; só se entrou, o mestre lê o aviso, que fica até ele
   * dispensar (alguém está parado esperando), com "Mandar a cabine", que a
   * leva até a parada — o mesmo caminho do "Trazer a cabine para cá" do
   * painel, que atende a chamada. O recorte do "aqui" depois de mandar sai
   * pela aventura que mudou (`notifyMapChanged` do App).
   */
  const announceCabineCall = (chamada: ChamadaParaMestre) => {
    const { cabineId, chamada: pedido } = chamada
    if (deps.applyChamadaDeCabine === undefined || !deps.applyChamadaDeCabine({ cabineId, chamada: pedido })) return
    // Quem chamou lê "chamada" logo, mesmo com um integrador que não avisa a mudança.
    scheduleBroadcast()
    const mandar = deps.applyCabine
    useToastStore
      .getState()
      .push(
        'instrucao',
        `${chamada.jogador} chamou a cabine ${chamada.cabine} em ${chamada.cena}`,
        null,
        mandar === undefined ? {} : { actions: [{ label: 'Mandar a cabine', run: () => mandar({ cabineId, parada: pedido.parada }) }] },
      )
  }

  const onMessage = (event: { payload: unknown }) => {
    if (session === null || !isRecord(event.payload)) return
    const clientId = parseClientId(event.payload.clientId)
    if (clientId === null) return
    // Qualquer mensagem é prova de vida, não só o ping.
    lastHeard.set(clientId, now())
    // Só o ping diz em que plano está a aba; qualquer outra mensagem vem de quem está olhando.
    const parsed = parsePlayerMessage(event.payload.msg)
    if (parsed?.type === 'ping' && parsed.away === true) awayClients.add(clientId)
    else awayClients.delete(clientId)
    // Antes de a sessão responder: o `welcome` e o mapa que saem deste join já vão comprimidos.
    if (parsed?.type === 'join') {
      if (parsed.accept?.includes('gzip') === true) gzipClients.add(clientId)
      else gzipClients.delete(clientId)
    }
    const before = session.listPlayers()
    // Tela da mesa conta como "já entrou": o lixo que ela mandasse depois não a derruba como join recusado.
    const wasTable = session.isTable(clientId)
    const wasJoined = wasTable || before.some((p) => p.clientId === clientId)
    const result = session.handleMessage(clientId, event.payload.msg, world())
    const rejectedJoin = !wasJoined && result.outbound.some((o) => o.msg.type === 'error' && KICK_ON_JOIN_ERROR.has(o.msg.reason))
    if (rejectedJoin) {
      // Conexão que nem entrou manda lixo, código que a sessão recusa ou é TV recusada: responde
      // e libera a vaga no Rust. O código errado de verdade o Rust já barra antes
      // de chegar aqui; esta recusa é a defesa da sessão, não o caminho comum.
      void sendThenKick(result, clientId)
      return
    }
    // Pino livre: a passagem já vem decidida. O `scene.changed` do resultado
    // só pode sair DEPOIS de a ficha mudar de cena, então quem despacha é a
    // mesma conclusão do "Deixar ir".
    if (result.applyTransfer !== undefined) completeTransfer(result, result.applyTransfer)
    // Item livre ou "Dar a…": grava antes de responder, pelo mesmo motivo.
    else if (result.applyItems !== undefined) completeItems(result, result.applyItems)
    else {
      const sent = dispatch(result)
      // Aba nova da mesma pessoa: a velha lê "session.replaced" e só depois cai.
      const replaced = result.replacedClientId
      if (replaced !== undefined) void sent.then(() => dropReplaced(replaced))
    }
    if (result.returnCandidate !== undefined) askReturn(result.returnCandidate)
    if (!wasJoined) {
      // Voltou (resume) quem teve a ficha guardada: ela volta ao mapa, de novo dele.
      const joined = session.listPlayers().find((p) => p.clientId === clientId)
      const restored = joined !== undefined && restoreStoredOf(joined.playerId, joined.playerId).length > 0
      // Voltou quem teve a ficha emprestada: quem a jogava precisa do mapa sem ela.
      if (restored || result.loansReturned !== undefined) broadcastNow()
    }
    // A Ana voltou pelo resume: a pergunta "Ana voltou?" que outro aparelho provocou já não vale.
    pruneReturnToasts()
    if (result.signal !== undefined) deps.onSignal?.(result.signal)
    if (result.playerLaser !== undefined) deps.onPlayerLaser?.(result.playerLaser)
    if (result.call !== undefined) announceCall(result.call)
    // Mão baixada: a linha do chamado sai da caixa.
    pruneCallToasts()
    if (result.pointAction !== undefined) askPointAction(result.pointAction)
    if (result.diceRoll !== undefined) deps.onDiceRoll?.(result.diceRoll)
    if (result.seatClaim !== undefined) askSeatClaim(result.seatClaim)
    if (result.applyMove !== undefined) {
      const { tokenId, x, y, sceneId } = result.applyMove
      // Cena aberta: a mesma chamada de sempre, sem o quarto argumento.
      if (sceneId === undefined) deps.applyMove(tokenId, x, y)
      else deps.applyMove(tokenId, x, y, sceneId)
      broadcastNow()
    }
    if (result.applyDoor !== undefined) {
      // Todos veem a porta nova: o mestre pela store, os jogadores pelo snapshot imediato.
      applyDoorAndBroadcast(result.applyDoor)
      // Com a chave, o aviso é o `doorKeyLine` logo abaixo (e sem quem destranque a porta nem abriu).
      // Com o ferrolho, é o da tranca: "passou o ferrolho" já diz que fechou.
      if (result.applyDoor.unlock !== true && result.trancaAviso === undefined) announceDoor(result.applyDoor)
    }
    if (result.trancaAviso !== undefined) {
      announceTranca(result.trancaAviso)
      // Ferrolho sem porta a mexer, ou barra de pino: só a sessão mudou, e a
      // marca de quem está do lado da tranca sai no recorte novo.
      if (result.applyDoor === undefined) broadcastNow()
    }
    // Sem quem destranque, a porta não abriu: o aviso não pode dizer que abriu.
    if (result.doorKeyUsed !== undefined && deps.unlockAndOpenDoor !== undefined) useToastStore.getState().push('info', doorKeyLine(result.doorKeyUsed))
    if (result.peek !== undefined) announcePeek(result.peek)
    if (result.barDispute !== undefined) askBarDispute(result.barDispute)
    if (result.travelRequest !== undefined) {
      if (deps.applyTransfer === undefined) {
        // Integrador sem transferência: ninguém do lado do mestre saberia atender.
        void dispatch(session.denyTravel(result.travelRequest.requestId))
      } else askTravel(result.travelRequest)
    }
    if (result.travelCancelled !== undefined) dropTravelToast(result.travelCancelled)
    if (result.doorRequest !== undefined) {
      // Integrador sem quem destranque: a pergunta não teria resposta que abrisse a porta.
      if (deps.unlockAndOpenDoor === undefined) void dispatch(session.denyDoorRequest(result.doorRequest.requestId))
      else askDoor(result.doorRequest)
    }
    if (result.hideRequest !== undefined) {
      // Integrador sem quem esconda a ficha: "Deixar" não teria o que fazer.
      if (deps.hideToken === undefined) void dispatch(session.denyHide(result.hideRequest.requestId))
      else askHide(result.hideRequest)
    }
    if (result.itemRequest !== undefined) {
      // Integrador sem quem grave a mochila: "Deixar" não teria como entregar.
      if (deps.applyItems === undefined) void dispatch(session.denyItemRequest(result.itemRequest.requestId))
      else askItem(result.itemRequest)
    }
    // "Mostrar meu mapa a…" aceito: o colega recebe o trecho no snapshot de agora.
    if (result.mapShared !== undefined) broadcastNow()
    if (result.actionRequest !== undefined) askAction(result.actionRequest)
    if (result.purchaseRequest !== undefined) {
      // Integrador sem quem grave a mochila: "Vender" não teria como entregar.
      if (deps.applyItems === undefined) void dispatch(session.denyPurchase(result.purchaseRequest.requestId))
      else askPurchase(result.purchaseRequest)
    }
    if (result.chamadaDeCabine !== undefined) announceCabineCall(result.chamadaDeCabine)
    if (result.letter !== undefined) askLetter(result.letter)
    if (result.applyTokenEdit !== undefined && deps.applyTokenEdit !== undefined) {
      // Mesma regra da porta: o mestre vê pela store, os outros jogadores pelo snapshot imediato.
      deps.applyTokenEdit(result.applyTokenEdit)
      broadcastNow()
    }
    if (result.applyLock !== undefined && deps.applyLock !== undefined) {
      // Mesma regra da porta: o cartão do jogador perde a fechadura no snapshot de agora.
      deps.applyLock(result.applyLock)
      broadcastNow()
    }
    if (result.lockAttempt !== undefined) tellLockAttempt(result.lockAttempt)
    if (result.applyMark !== undefined && deps.applyMark !== undefined) {
      // Mesma regra da porta: o mestre vê pela store, quem conhece o ponto pelo snapshot de agora.
      deps.applyMark(result.applyMark)
      broadcastNow()
      tellMarkPlaced(result.applyMark)
    }
    if (result.secretCheckAnswer !== undefined) {
      // Só na tela do mestre: o painel e o aviso. Não há `net_send` com o resultado.
      const answer = result.secretCheckAnswer
      useToastStore.getState().push('info', secretCheckAnswerText(answer.playerName, answer.label, answer.result), PLAYER_JOINED_TOAST_MS)
      notifySecretChecksIfChanged()
    }
    if (result.waitsChanged === true) onWaitsChanged()
    if (result.applyPiso !== undefined && deps.applyPiso !== undefined) {
      // O jogador que subiu recebe o piso novo, e quem ficou deixa de vê-lo, no snapshot imediato.
      deps.applyPiso(result.applyPiso)
      broadcastNow()
    }
    notifyPlayersIfChanged()
    if (wasJoined) return
    if (session.isTable(clientId)) announceTable()
    else if (result.reclaimed !== undefined) announceReclaim(result.reclaimed)
    // Troca de aba da mesma pessoa não é chegada; e quem provocou "Ana voltou?" já tem o aviso dele na Caixa.
    else if (result.replacedClientId === undefined && result.returnCandidate === undefined) {
      announceJoin(clientId, new Set(before.filter((p) => !p.connected).map((p) => p.playerId)))
    }
  }

  /**
   * A conexão `clientId` caiu — pelo `close` do Rust ou pela varredura de quem
   * ficou mudo. `at`: quando se ouviu dela por último (ausente = agora).
   */
  const dropClient = (clientId: string, at?: number) => {
    if (session === null) return
    lastHeard.delete(clientId)
    awayClients.delete(clientId)
    gzipClients.delete(clientId)
    // Conexão que nunca entrou (código errado) — ou que a varredura já deu
    // como caída — não acha jogador: não há quem avisar de novo.
    const dropped = session.listPlayers().find((p) => p.clientId === clientId)
    session.disconnect(clientId, at)
    forgetScreen(clientId)
    if (dropped !== undefined) scheduleDropAnnounce(dropped.playerId, dropped.name)
    pruneTravelToasts()
    pruneCallToasts()
    pruneReturnToasts()
    pruneActionToasts()
    notifyPlayersIfChanged()
  }

  const onPeer = (event: { payload: unknown }) => {
    if (session === null || !isRecord(event.payload)) return
    const clientId = parseClientId(event.payload.clientId)
    if (clientId === null || event.payload.event !== 'disconnected') return
    dropClient(clientId)
  }

  /**
   * Quem está na sala e passou de `HOST_STALE_AFTER_MS` sem mandar nada caiu,
   * mesmo sem o `close` chegar (Wi-Fi que some sem FIN); a aba em segundo
   * plano tem `HOST_AWAY_STALE_AFTER_MS`. O socket zumbi é
   * derrubado no Rust: se ele ressuscitar, o cliente vê o `close` e volta pelo
   * resume, em vez de falar com uma sala que já não o conhece.
   */
  const sweepSilent = () => {
    if (session === null) return
    const at = now()
    for (const player of session.listPlayers()) {
      const clientId = player.clientId
      if (clientId === null) continue
      const heard = lastHeard.get(clientId)
      if (heard === undefined) {
        // Entrou por um caminho que não passou por `onMessage`: o prazo começa agora.
        lastHeard.set(clientId, at)
        continue
      }
      const deadline = awayClients.has(clientId) ? HOST_AWAY_STALE_AFTER_MS : HOST_STALE_AFTER_MS
      if (at - heard < deadline) continue
      dropClient(clientId, heard)
      deps.invoke('net_kick', { clientId }).catch(() => {
        // Já fechada no Rust (o `close` chegou junto): era o que se queria.
      })
    }
  }

  const stopLivenessSweep = () => {
    if (livenessTimer !== null) clearInterval(livenessTimer)
    livenessTimer = null
    lastHeard.clear()
    awayClients.clear()
  }

  const removeListeners = () => {
    for (const unlisten of unlisteners) unlisten()
    unlisteners = []
  }

  const openRoom = async (options: StartOptions): Promise<RoomInfo> => {
    try {
      // Lida antes de abrir: a sala nova regrava o arquivo assim que alguém muda de dono.
      const saved = options.resume === true ? (deps.loadTable?.() ?? null) : null
      const restoreSeats = saved?.seats ?? []
      // O explorado só vale com a mesa: sem assento, não há de quem ele seja.
      const restoreExploration = saved === null ? [] : (deps.loadExploration?.()?.seats ?? [])
      // Retomar pede o MESMO código: o link e a reconexão automática dos jogadores continuam valendo.
      // O Rust decide se dá (a porta pode ter mudado de dono); o que vale é o código que ele devolver.
      const preferredCode = preferredRoomCode(saved)
      const startReply = preferredCode === null ? await deps.invoke('net_start_room') : await deps.invoke('net_start_room', { preferredCode })
      const room = parseRoomInfo(startReply)
      if (room === null) throw new Error('resposta inválida de net_start_room')
      if (saved !== null && room.code !== saved.code) {
        // Sem prazo: o mestre precisa do texto na tela enquanto repassa o código novo à mesa.
        useToastStore.getState().push('instrucao', roomCodeChangedText(saved.code, room.code))
      }
      session = createHostSession({
        code: room.code,
        visionRadius: deps.visionRadius ?? DEFAULT_VISION_RADIUS,
        now: deps.now,
        getTurn: deps.getTurn,
        getClock: deps.getClock,
        restoreSeats,
        restoreExploration,
      })
      // O diário é desta sala: os jogadores da anterior já não estão aqui para desfazer.
      setTravelLog([])
      unlisteners = [
        await deps.listen('net:message', onMessage),
        await deps.listen('net:peer', onPeer),
        await deps.listen('net:tunnel', onTunnel),
      ]
      stopLivenessSweep()
      livenessTimer = setInterval(sweepSilent, LIVENESS_SWEEP_MS)
      currentRoom = room
      notifyPlayersIfChanged()
      return room
    } catch (error) {
      removeListeners()
      stopLivenessSweep()
      session = null
      reportError('Não foi possível abrir a sala', error)
      throw error
    }
  }

  return {
    start(options = {}) {
      if (currentRoom !== null) return Promise.resolve(currentRoom)
      // Duplo clique: o segundo start recebe a mesma promise, sem segunda sala.
      if (pendingStart !== null) return pendingStart
      const started = openRoom(options)
      pendingStart = started
      const clear = () => {
        if (pendingStart === started) pendingStart = null
      }
      started.then(clear, clear)
      return started
    },

    async stop() {
      if (pendingStart !== null) {
        try {
          await pendingStart
        } catch {
          // A falha do start já virou toast lá; aqui só importa que ele terminou.
        }
      }
      // Snapshot pendente sai antes: não pode chegar ao jogador depois do aviso.
      cancelPendingBroadcast()
      // Com a sessão ainda viva: depois dela não há de onde ler o explorado.
      flushExplorationSave()
      for (const timer of peekTimers) clearTimeout(timer)
      peekTimers.clear()
      // Sala fechada leva os empréstimos junto (a sessão morre): nada de despertador órfão.
      clearLoanTimer()
      resetLaser()
      // A sala fecha com as esperas dentro: nenhum prazo acorda depois.
      clearWaitTimer()
      // Avisa antes de derrubar: sem `room.closed` o jogador veria queda de rede,
      // não "O mestre encerrou a sala".
      if (session) await dispatch(session.closeRoom())
      removeListeners()
      stopLivenessSweep()
      // Guardar nunca apaga ficha: fechar a sala devolve ao mapa, sem dono, o que estava guardado.
      for (const playerId of [...storedTokens.keys()]) restoreStoredOf(playerId, null)
      session = null
      // Quem aguardava sem tela não recebe `room.closed` com mapa: some junto.
      if (screens.clear()) notifyScreens()
      // Sala nova começa sem ninguém no olhar: quem já estava lá avisa de novo.
      guardSeen = new Set()
      pruneTravelToasts()
      pruneCallToasts()
      pruneReturnToasts()
      setTravelLog([])
      // Sala fechada: quem "caiu" agora é o fim da sala, não uma queda.
      resetDrops()
      // Sem sala, "Desembarcar" não teria a quem mandar.
      syncCaravanToasts([])
      pruneActionToasts()
      currentRoom = null
      // O Rust derruba o túnel junto com a sala.
      resetTunnel()
      notifyPlayersIfChanged()
      notifyPinAudiencesIfChanged()
      notifyPinCluesIfChanged()
      notifySecretRevealsIfChanged()
      notifySecretChecksIfChanged()
      try {
        await deps.invoke('net_stop_room')
      } catch (error) {
        reportError('Não foi possível fechar a sala', error)
      }
    },

    notifyMapChanged(cause = 'edit') {
      // Desfazer/refazer: a caravana se reconhece no retrato AGORA, antes que
      // uma edição seguinte (no mesmo intervalo do broadcast) seja comparada
      // com a memória de antes do Ctrl+Z.
      if (cause === 'history') followCaravans('history')
      scheduleBroadcast()
    },

    notifyTurnChanged() {
      // Um snapshot que já estava na fila sai agora, com a vez nova dentro.
      cancelPendingBroadcast()
      broadcastNow()
    },

    notifyClockChanged() {
      // Mesmo caminho da vez: o período e o raio da noite saem no snapshot de agora.
      cancelPendingBroadcast()
      broadcastNow()
    },

    setVisionRadius(playerId, radius) {
      if (session === null) return
      session.setVisionRadius(playerId, radius)
      // Arrastar o slider dispara dezenas de onChange: um snapshot por janela basta.
      scheduleBroadcast()
      notifyPlayersIfChanged()
    },

    setVisionFactor(playerId, factor) {
      if (session === null) return
      session.setVisionFactor(playerId, factor)
      scheduleBroadcast()
      notifyPlayersIfChanged()
    },

    setPinAudience(pinId, playerIds) {
      if (session === null) return
      session.setPinAudience(pinId, playerIds)
      broadcastNow()
      notifyPinAudiencesIfChanged()
    },

    showPin(playerId, pinId) {
      if (session === null) return null
      const result = session.showPin(playerId, pinId, world())
      if (result.outbound.length === 0) return false
      // O mapa com a lista nova sai antes do cartão: o pino (se à vista) já
      // está no mapa dela quando o cartão abre.
      broadcastNow()
      void dispatch(result)
      notifyPinAudiencesIfChanged()
      return true
    },

    setSecretReveal(itemId, playerIds) {
      if (session === null) return
      session.setSecretReveal(itemId, playerIds)
      broadcastNow()
      notifySecretRevealsIfChanged()
    },

    revealPlan(playerId) {
      if (session === null) return
      session.revealPlan(playerId, world())
      broadcastNow()
    },

    hidePlan(playerId) {
      if (session === null) return
      session.hidePlan(playerId, world())
      broadcastNow()
    },

    revealPlanFor(sceneId, playerIds) {
      if (session === null) return null
      const granted = session.revealPlanFor(sceneId, playerIds, world())
      if (granted > 0) broadcastNow()
      return granted
    },

    giveGroupView(playerId) {
      if (session === null) return null
      const colleagues = session.giveGroupView(playerId, world())
      if (colleagues > 0) broadcastNow()
      return colleagues
    },

    shareMap(fromPlayerId, toPlayerId) {
      if (session === null) return false
      const result = session.shareMap(fromPlayerId, toPlayerId, world())
      if (result.mapShared === undefined) return false
      // O aviso primeiro, o trecho novo no snapshot logo atrás.
      void dispatch(result)
      broadcastNow()
      return true
    },

    giveRoomsMap(playerId, sceneId, roomIds) {
      if (session === null) return 0
      const result = session.giveRoomsMap(playerId, sceneId, roomIds, world())
      if (result.mapRefused !== undefined) return result.mapRefused.reason
      if (result.mapGiven === undefined) return 0
      // O aviso primeiro, as Salas novas no snapshot logo atrás.
      void dispatch(result)
      broadcastNow()
      return result.mapGiven.roomIds.length
    },

    sendPlayer(playerId, toSceneId, pinId, gatherAt, tokenId) {
      if (session === null) return false
      const result = session.sendPlayer(playerId, toSceneId, pinId, world(), gatherAt, tokenId)
      const transfer = result.applyTransfer
      // Mesmo caminho do "Deixar ir" (`answerTravel`): a ficha muda de cena
      // antes do `scene.changed` sair, e o snapshot da cena nova vem atrás.
      const moved = transfer !== undefined && moveAndLog(transfer)
      // O pedido de passagem que ele tinha morreu na sessão: o aviso do mestre sai junto.
      pruneTravelToasts()
      if (!moved) {
        // Quem seria levado junto e perdeu o pedido que esperava o mestre lê a recusa dele.
        if (result.lostTravels !== undefined) void dispatch({ outbound: result.lostTravels })
        // Mesmo sem mover, o pedido que ele tinha pode ter morrido: o selo acompanha.
        notifyPlayersIfChanged()
        return false
      }
      void dispatch(result)
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    bringToken(playerId, tokenId) {
      if (session === null) return false
      const transfer = session.bringToken(playerId, tokenId, world()).applyTransfer
      // Não é viagem: nem diário nem "Você chegou". A ficha muda de cena pela
      // store, e o próximo snapshot a mostra ao dono.
      const moved = transfer !== undefined && (deps.applyTransfer?.(transfer) ?? false)
      if (!moved) return false
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    undoTravel(entryId) {
      if (session === null) return false
      const entry = travelLog.find((e) => e.id === entryId)
      if (entry === undefined || !undoableTravelIds(travelLog).has(entryId)) return false
      const back = { sceneId: entry.fromSceneId, x: entry.fromX, y: entry.fromY }
      const result = session.returnPlayer(entry.playerId, entry.tokenId, back, world())
      const transfer = result.applyTransfer
      // A volta é a correção de um engano, não viagem nova: não entra no diário.
      const moved = transfer !== undefined && applyTransferAlong(transfer)
      // O pedido de passagem que ele tinha morreu na sessão: o aviso do mestre sai junto.
      pruneTravelToasts()
      if (!moved) {
        notifyPlayersIfChanged()
        return false
      }
      setTravelLog(withoutTravel(travelLog, entryId))
      // Mesma ordem do "Mandar para…": ficha movida, `scene.changed`, e o snapshot da cena de volta.
      void dispatch(result)
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    disembarkCaravan(sceneId) {
      return disembark(sceneId)
    },

    sceneNote(sceneId, text, playerIds) {
      if (session === null) return null
      const result = session.sceneNote(sceneId, text, world(), playerIds)
      void dispatch(result)
      return result.outbound.length
    },

    sceneAlarm(sceneIds, text) {
      if (session === null) return null
      const before = session.activeAlarm()?.id
      const result = session.sceneAlarm(sceneIds, text, world())
      // Recusado (texto vazio, nenhuma cena que exista): o alarme não mudou.
      if (session.activeAlarm()?.id === before) return null
      void dispatch(result)
      // O resultado também leva o fim do alarme antigo a quem ficou fora: conta só quem recebeu o novo.
      return result.outbound.filter((out) => out.msg.type === 'scene.alarm').length
    },

    endAlarm() {
      if (session === null) return
      void dispatch(session.endAlarm(world()))
    },

    activeAlarm() {
      return session?.activeAlarm() ?? null
    },

    setTableScene(key) {
      if (session === null) return
      session.setTableScene(key)
      broadcastNow()
    },

    tableKey() {
      return session?.tableKey() ?? null
    },

    setScenePaused(sceneId, paused) {
      if (session === null) return false
      void dispatch(session.setScenePaused(sceneId, paused, world()))
      return true
    },

    playerNote(playerId, text) {
      if (session === null) return null
      const result = session.playerNote(playerId, text, world())
      void dispatch(result)
      return result.delivery
    },

    rollDice(request, hidden) {
      if (session === null) return null
      const result = session.masterRoll(request, hidden)
      void dispatch(result)
      // A tela do mestre mostra pelo mesmo caminho da rolagem de um jogador.
      if (result.diceRoll !== undefined) deps.onDiceRoll?.(result.diceRoll)
      return result.diceRoll ?? null
    },

    noise(x, y, rangeCells) {
      if (session === null) return null
      const result = session.noise(x, y, rangeCells, world())
      void dispatch(result)
      return result.outbound.length
    },

    secretCheck(label, playerIds) {
      if (session === null) return null
      const result = session.secretCheck(label, playerIds)
      void dispatch(result)
      notifySecretChecksIfChanged()
      const id = result.secretCheckId
      // Pedidos, não envios: quem caiu entra na conta e recebe ao voltar.
      return id === undefined ? 0 : (session.secretChecks().find((check) => check.id === id)?.asked.length ?? 0)
    },

    closeSecretCheck(checkId) {
      if (session === null) return
      void dispatch(session.closeSecretCheck(checkId))
      notifySecretChecksIfChanged()
    },

    abalo(origem, textos, vizinhas) {
      if (session === null) return null
      const result = session.abalo(origem, textos, vizinhas, world())
      void dispatch(result)
      return result.porFaixa
    },

    assignToken(playerId, tokenId) {
      if (session === null) return
      void dispatch(session.assignToken(playerId, tokenId))
      broadcastNow()
      notifyPlayersIfChanged()
      // Atribuir por cima de um empréstimo desfaz o acordo: o despertador muda junto.
      armLoanTimer()
      // Ficha dada pelo painel: o pedido de ficha de quem a ganhou (ou de quem pedia esta) sai da caixa.
      pruneTravelToasts()
    },

    unassignToken(playerId, tokenId) {
      if (session === null) return
      void dispatch(session.unassignToken(playerId, tokenId))
      broadcastNow()
      notifyPlayersIfChanged()
      armLoanTimer()
    },

    lendToken(playerId, tokenId, terms) {
      if (session === null) return
      void dispatch(session.lendToken(playerId, tokenId, terms))
      broadcastNow()
      notifyPlayersIfChanged()
      armLoanTimer()
    },

    async kick(clientId) {
      if (session === null) return
      const result = session.kick(clientId)
      // O expulso devolve o ajudante: o prazo dele não acorda mais ninguém.
      armLoanTimer()
      pruneTravelToasts()
      pruneCallToasts()
      pruneReturnToasts()
      pruneActionToasts()
      notifyPlayersIfChanged()
      notifyPinAudiencesIfChanged()
      notifyPinCluesIfChanged()
      notifySecretRevealsIfChanged()
      notifySecretChecksIfChanged()
      await sendThenKick(result, clientId)
      // O `kicked` já apagou a tela; sem ele (jogador já fora da sessão) apaga aqui.
      forgetScreen(clientId)
    },

    storeTokens(playerId) {
      if (session === null || deps.removeToken === undefined || deps.restoreToken === undefined) return false
      const player = session.listPlayers().find((p) => p.playerId === playerId)
      // Emprestada, a ficha está em jogo com outro: guardar a tiraria do mapa debaixo dele.
      if (player === undefined || player.connected || player.lentTo !== undefined) return false
      // A emprestada fica: é do dono, e guardá-la no nome de quem a joga a tiraria do dono para sempre.
      const own = ownTokenIdsOf(player)
      if (own.length === 0) return false
      const current = world()
      const stored = [...(storedTokens.get(playerId) ?? [])]
      for (const scene of [current.open, ...current.background]) {
        // Ausente = a cena aberta (convenção de `applyMove`); cena de fundo sempre tem id.
        const where = scene === current.open ? undefined : scene.sceneId
        if (where === null) continue
        for (const token of scene.map.tokens) {
          if (!own.includes(token.id)) continue
          stored.push({ token, sceneId: scene.sceneId })
          // Sem dono enquanto guardada: a ficha não está em mapa nenhum. Ele está fora: não há a quem avisar.
          session.unassignToken(playerId, token.id)
          deps.removeToken(token.id, where)
        }
      }
      if (stored.length === 0) return false
      storedTokens.set(playerId, stored)
      const names = stored.map(({ token }) => token.name).join(', ')
      useToastStore.getState().push('info', `Ficha guardada: ${names}. Volta ao mapa quando ${player.name} voltar.`)
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    lendTokens(ownerId, borrowerId) {
      if (session === null) return false
      const result = session.lendTokens(ownerId, borrowerId, world())
      if (result.lent.length === 0) {
        useToastStore.getState().push('error', 'Não deu para emprestar: só a ficha de quem está fora, para quem está conectado e na mesma cena dela.')
        return false
      }
      void dispatch(result)
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    endLoans(ownerId) {
      if (session === null) return false
      const result = session.endLoans(ownerId)
      if (result.loansReturned === undefined) return false
      void dispatch(result)
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    storedTokens() {
      return [...storedTokens.values()].flatMap((stored) => stored.map((entry) => ({ ...entry })))
    },

    dismissPlayer(playerId) {
      if (session === null) return false
      const player = session.listPlayers().find((p) => p.playerId === playerId)
      if (player === undefined || player.connected) return false
      // Guardar nunca apaga ficha: quem é dispensado deixa a ficha no mapa, sem dono.
      const restored = restoreStoredOf(playerId, null)
      session.dismissPlayer(playerId)
      if (restored.length > 0) useToastStore.getState().push('info', `De volta ao mapa, sem dono: ${restored.join(', ')}.`)
      // A sessão esqueceu tudo dele, pedidos incluídos (a ação no ponto sobrevive à
      // queda): a linha que sobrasse na Caixa seria um "Nada aqui" que não chega a ninguém.
      pruneTravelToasts()
      pruneCallToasts()
      pruneReturnToasts()
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    handOverPlayer(playerId, heirId) {
      if (session === null) return false
      const list = session.listPlayers()
      const player = list.find((p) => p.playerId === playerId)
      const heir = list.find((p) => p.playerId === heirId)
      if (player === undefined || heir === undefined || player.connected) return false
      const result = session.handOverPlayer(playerId, heirId)
      if (result === null) return false
      void dispatch(result)
      // A ficha guardada volta ao mapa já de quem recebeu: guardar nunca apaga ficha.
      const restored = restoreStoredOf(playerId, heirId)
      const current = world()
      const tokensById = new Map([current.open, ...current.background].flatMap((scene) => scene.map.tokens).map((token) => [token.id, token.name]))
      const names = [...result.handedTokens.flatMap((tokenId) => tokensById.get(tokenId) ?? []), ...restored]
      const text = names.length > 0 ? `Fichas e mapa de ${player.name} passaram a ${heir.name}: ${names.join(', ')}.` : `O mapa de ${player.name} passou a ${heir.name}.`
      useToastStore.getState().push('info', text)
      // Como no Dispensar: o que sobrasse dele na Caixa não chegaria a ninguém.
      pruneTravelToasts()
      pruneCallToasts()
      pruneReturnToasts()
      broadcastNow()
      notifyPlayersIfChanged()
      return true
    },

    players() {
      return playerList()
    },

    tokenVisionRadii(map) {
      return session === null ? NO_OWNER_RADII : session.tokenVisionRadii(map)
    },

    connectedPlayerCount() {
      if (session === null) return 0
      return session.listPlayers(world()).filter((player) => player.connected).length
    },

    playerScreen(playerId) {
      if (session === null) return null
      // Sem mundo: só o `clientId` interessa, e isto roda a cada render do espelho.
      const clientId = session.listPlayers().find((player) => player.playerId === playerId)?.clientId ?? null
      return clientId === null ? null : screens.get(clientId)
    },

    watchPlayerScreens(listener) {
      screenWatchers.add(listener)
      return () => {
        screenWatchers.delete(listener)
      }
    },

    tokenSeenBy(tokenId) {
      if (session === null) return null
      // Sem mundo, como `playerScreen`: roda a cada recorte novo enquanto o painel está aberto.
      const players = session.listPlayers()
      if (players.some((player) => player.tokenIds.includes(tokenId))) return null
      // A tela precisa ser do MAPA ABERTO: tela de outra cena não diz nada sobre esta ficha.
      const openMapId = deps.getMap().id
      return players.flatMap((player) => {
        const screen = player.clientId === null ? null : screens.get(player.clientId)
        if (screen === null || screen.kind !== 'map' || screen.map.id !== openMapId) return []
        return screen.map.tokens.some((token) => token.id === tokenId) ? [player.name] : []
      })
    },

    room() {
      return currentRoom
    },

    startTunnel() {
      // Duplo clique: mesma promise, um túnel só.
      if (pendingTunnel !== null) return pendingTunnel
      if (currentRoom === null) {
        // Pede uma ação (abrir a sala) antes do gesto poder acontecer: aviso que
        // ensina, fica até o mestre dispensar (fronteira em `lib/erroQueEnsina.ts`).
        useToastStore.getState().push('instrucao', 'Abra a sala antes de torná-la pública')
        return Promise.resolve()
      }
      if (tunnelState.kind === 'ready') return Promise.resolve()
      tunnelAttemptSeq += 1
      const attempt = tunnelAttemptSeq
      activeTunnelAttempt = attempt
      // Retorno imediato ao clique; o Rust troca para "downloading" se precisar baixar.
      setTunnel({ kind: 'connecting' })
      const running = runTunnel(attempt)
      pendingTunnel = running
      void running.then(() => {
        if (pendingTunnel === running) pendingTunnel = null
      })
      return running
    },

    async stopTunnel() {
      resetTunnel()
      try {
        await deps.invoke('net_stop_tunnel')
      } catch (error) {
        reportError('Não foi possível encerrar o link público', error)
      }
    },

    tunnel() {
      return tunnelState
    },

    laserMove(x, y) {
      if (session === null || !Number.isFinite(x) || !Number.isFinite(y)) return
      // Inteiro basta para o rastro e encurta o payload que sai 20 vezes por segundo.
      const point = { x: Math.round(x), y: Math.round(y) }
      if (laserTimer === null) {
        laserSent = true
        sendLaser({ type: 'laser', points: [point] })
        armLaserTimer()
        return
      }
      // Acima do teto sai o ponto mais antigo: o jogador descartaria o lote inteiro.
      if (laserBuffer.length >= LASER_MAX_POINTS_PER_MESSAGE) laserBuffer.shift()
      laserBuffer.push(point)
      laserSent = true
    },

    laserOff() {
      if (session === null || !laserSent) return
      // O que ainda esperava a janela fica para trás: são menos de 50 ms de rastro que sumiria em 1 s.
      resetLaser()
      sendLaser({ type: 'laser', off: true })
    },
  }
}
