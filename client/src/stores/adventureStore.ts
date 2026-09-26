import { create } from 'zustand'
import type { MapData, Pin, PinDestination, PinPassage, Stair, Token } from '../types/map'
import {
  buildingOfStair,
  buildPartnerStair,
  buildStairPin,
  floorSideOf,
  newFloorName,
  stairMouth,
  stairPinOf,
  withBuildingContour,
  type StairTravelProps,
} from '../lib/stairTravel'
import { passageOf } from '../lib/pins'
import { singleSceneWorld, type AppliedItems, type HostScene, type HostWorld } from '../net/hostSession'
import { applyItemChange } from '../lib/items'
import { carrierIdOf, withoutCarrier } from '../lib/carry'
import { leaveVehicle, passengersOf } from '../lib/vehicle'
import { vehicleRiderSpots } from '../lib/gatherParty'
import { tokenSizeInSquares } from '../lib/tokenSize'
import type { Bounds, Camera, Point } from '../pixi/world'
import * as mapFactory from '../lib/mapFactory'
import { moverNaCena, planejarRotina, type CenaDaRotina } from '../lib/rotinaDoNpc'
import { comPiso, mapaDoPiso, pisoDe } from '../lib/pisos'
import {
  ADVENTURE_VERSION,
  baseName,
  cleanSceneName,
  nestScene,
  newSceneId,
  removeSceneKeepingInside,
  sceneChildCount,
  sceneFileFor,
  sceneTrail,
  withPublicSceneName,
  sceneTree,
  shiftSceneAmongSiblings,
  type Adventure,
  type SceneEntry,
} from '../lib/adventure'
import type { AgendaDaCampanha } from '../lib/agendaDaCampanha'
import {
  aplicarEstadoNoMapa,
  comValorAtual,
  contarMudancas,
  novoEstadoDoMundo,
  type AmarraDeEstado,
  type ResumoDaTroca,
} from '../lib/estadoDoMundo'
import { comCabineEm, comChamada, comParada, novaCabine, proximaChamada, semFila, type ChamadaAceita } from '../lib/cabine'
import {
  addExit,
  arrivalPoint,
  arrivalSpot,
  isArrivalOnly,
  leadsToScene,
  linkBack,
  linkWithinScene,
  nearbyArrivalPoint,
  pinFocusPoint,
  renameExit,
  resolvePinTravel,
  SAIDA_PRINCIPAL,
  sameDestination,
  setArrivalOnly,
  setExitDestination,
  travelExitOf,
  travelExitsOf,
  travelLinkChanges,
  travelPinOptions,
  unlinkBack,
  unlinkFromScene,
  unlinkWithinScene,
  type ExitPatch,
  type PinTravel,
  type TravelPinOption,
  type TravelScene,
  type TravelSceneOption,
} from '../lib/pinTravel'
import { cloneSceneMap } from '../lib/entityClone'
import { loadPendingScenes, mapDirFor, saveAdventureToDisk, scenePath, type ArrivedScene, type OpenedMapFile, type SceneLoad } from '../lib/mapFileIO'
import { storedTokensOfScene, withStoredTokens, type StoredToken } from '../lib/storedTokens'
import type { PinDirectoryScene } from '../lib/pinDirectory'
import { dirname } from '@tauri-apps/api/path'
import { removeSelectionItem, selectionHas, type SelectionItem } from '../lib/selectionModel'
import { useInitiativeStore } from './initiativeStore'
import { useMapStore } from './mapStore'
import { useSessionStore } from './sessionStore'

/**
 * AVENTURA COM VÁRIAS CENAS, do lado do editor do mestre.
 *
 * A cena ABERTA mora no `useMapStore`, como qualquer mapa sempre morou — o
 * canvas, o desfazer e a rede continuam lendo de lá sem saber de aventura. As
 * OUTRAS cenas moram aqui, em `cache`, cada uma com o próprio histórico de
 * desfazer: trocar de cena guarda o `{ map, past, future }` da que sai e
 * devolve o da que entra. Por isso mudança numa cena de fundo nunca entra no
 * desfazer da cena aberta (`updateBackgroundScene` não toca no `useMapStore`).
 *
 * `adventure === null` é o mapa solto de sempre: nada aqui interfere nele. A
 * aventura nasce na primeira `createScene`.
 *
 * Gravar é `flush`: escreve a cena aberta, as de fundo com mudança pendente e
 * por último o `adventure.json`. Trocar de cena NÃO grava no disco — só no
 * cache —, então a troca funciona igual sem Tauri e nunca falha no meio.
 */

/**
 * Cena de fundo: o mapa, o desfazer e a câmera dela, ou o motivo de não ter
 * aberto. `camera: null` = cena ainda não vista nesta sessão: ao entrar, ela
 * é enquadrada. A câmera só vive em memória, nunca vai ao disco.
 */
export type SceneSlot =
  | { status: 'ok'; map: MapData; past: MapData[]; future: MapData[]; camera: Camera | null }
  | { status: 'indisponivel'; reason: string }
  | SceneLoadingSlot

/**
 * Cena que ainda está vindo do disco (abrir aventura mostra a cena pedida
 * antes de ler as outras). Não abre nem recebe ligação nova; a mudança que
 * `updateBackgroundScene` pedir nela espera em `pending`, na ordem, e é
 * aplicada quando o mapa chega — a volta de um pino desligado nesse
 * meio-tempo não se perde.
 */
export interface SceneLoadingSlot {
  status: 'carregando'
  pending: ((map: MapData) => MapData)[]
}

/**
 * O que o canvas deve fazer com a câmera depois de uma troca de cena: voltar
 * a `camera`, ou enquadrar o conteúdo quando `null`. Um objeto novo por troca
 * — o canvas reage à identidade, como ao contador do reset de zoom.
 */
/** O que `carryToken` levou: o bastante para o aviso "Zumbi foi para Térreo" e o "Ir lá" dele. */
export interface CarriedToken {
  tokenName: string
  sceneId: string
  sceneName: string
  /** Onde a ficha assentou na cena de destino. */
  x: number
  y: number
  /** PISOS NA MESMA CENA: o piso onde ela chegou (o do pino). Ausente = o térreo. O "Ir lá" vai a ele. */
  piso?: number
}

export interface CameraRequest {
  camera: Camera | null
  /**
   * Chegada por um pino de viagem: o ponto do mundo que fica no centro da
   * tela, com o zoom de `camera` (ou o de agora, na cena nunca vista). Ausente
   * na troca comum pela lista de Cenas.
   */
  focus?: Point
  /**
   * Com `focus`: a caixa (px de mundo) do objeto que o "Ir até lá" da lista
   * Objetos do mapa procura. O canvas só AFASTA se ela não couber na área que
   * os painéis deixam livre (`revealScale`); cabendo, o zoom fica o de agora.
   */
  fit?: Bounds
}

/** Uma linha da lista "Cenas". */
export interface SceneListItem {
  id: string
  name: string
  /** `null` quando a cena não abriu (arquivo sumido): não há mapa para contar. */
  tokenCount: number | null
  available: boolean
  /** A cena ainda está vindo do disco: indisponível só por enquanto. Ausente = não está carregando. */
  loading?: boolean
  active: boolean
  /** Mapa solto não tem nome de cena para trocar: o nome dele é o do arquivo. */
  renamable: boolean
  /** CENAS EM PASTAS: a cena de fora desta. Ausente = primeiro nível (e sempre, no mapa solto). */
  parentId?: string
  /** NOME PARA OS JOGADORES; ausente = a cena não tem (ou é o mapa solto). */
  publicName?: string
  /** `true` = "Planta conhecida por todos" ligada nesta cena. Ausente = desligada (e mapa solto). */
  planKnownByAll?: boolean
}

/** `{ publicName }` só quando a cena tem um: o objeto não carrega `publicName: undefined`. */
function publicNameOf(entry: SceneEntry): { publicName?: string } {
  return entry.publicName === undefined ? {} : { publicName: entry.publicName }
}

interface AdventureState {
  adventure: Adventure | null
  /** Pasta da aventura. `null` enquanto ela ainda não foi gravada nenhuma vez. */
  dir: string | null
  /** Arquivo do mapa solto que virou a primeira cena; resolve `dir` no primeiro `flush`. */
  rootPath: string | null
  /** Id do mapa da primeira cena; resolve `dir` quando o mapa solto nunca foi salvo. */
  rootMapId: string | null
  activeSceneId: string | null
  /** De onde se veio na última troca: é para lá que o Voltar leva. */
  previousSceneId: string | null
  /** Cenas FORA de edição. A aberta está no `useMapStore`. */
  cache: Record<string, SceneSlot>
  /** Cenas cujo conteúdo em memória ainda não foi gravado. */
  dirty: Record<string, true>
  /** A lista de cenas (nome, cena nova) mudou desde a última gravação. */
  structureDirty: boolean
  /** Último pedido de câmera da troca de cena; `null` até a primeira troca. */
  cameraRequest: CameraRequest | null

  /** Mapa novo ou solto: esquece qualquer aventura anterior. */
  reset: () => void
  /**
   * Assume o que `openMapFileFirst` leu e põe a cena pedida no editor NA HORA.
   * As cenas `pendente` entram como "carregando" e são lidas em segundo plano;
   * cada uma passa a abrir assim que chega (em lotes curtos), sem esperar a
   * mais lenta. A promessa resolve quando todas chegaram (ou não abriram) e nunca rejeita.
   * Abrir outro mapa antes disso descarta o que ainda chegar desta.
   */
  open: (opened: OpenedMapFile) => Promise<void>
  /** Cria a cena, já aberta. `loosePath` é o arquivo do mapa solto, quando a aventura nasce agora. */
  createScene: (name: string, loosePath: string | null) => string
  /**
   * "+ Cena nova…" do "Leva a…": cria a cena `name` (na pasta da cena aberta),
   * o pino de chegada no centro dela, e liga a saída `exitId` do pino `pinId`
   * a ele — como `linkPinToNewArrival`, `null` = uma saída nova. NÃO troca a
   * cena aberta. `loosePath` como em `createScene`. `null` quando o pino não é
   * um pino de viagem que leva (sumiu, é de outro tipo, é chegada oculta).
   */
  createSceneForPin: (
    pinId: string,
    name: string,
    loosePath: string | null,
    exitId?: string | null,
  ) => { sceneId: string; arrivalId: string } | null
  renameScene: (sceneId: string, name: string) => void
  /** Nome para os jogadores da cena, limpo (`withPublicSceneName`); vazio apaga. */
  setScenePublicName: (sceneId: string, publicName: string) => void
  /**
   * "Duplicar" do menu da cena: a cópia entra LOGO ABAIXO da original, na
   * mesma pasta (herda o `parentId`, e só ela: as cenas de dentro não são
   * copiadas), com ids novos, sem as fichas cujo id está em `playerTokenIds` e
   * com os pinos de viagem soltos (`cloneSceneMap`). Não troca a cena aberta.
   * Devolve o id da cópia, ou `null` quando não há o que copiar (mapa solto,
   * cena que não abriu).
   */
  duplicateScene: (sceneId: string, playerTokenIds?: ReadonlySet<string>) => string | null
  /**
   * "Apagar cena…": tira a cena da aventura e desliga, em todas as outras (no
   * desfazer delas também), os pinos que levavam para lá. As cenas de dentro
   * dela sobem um nível e ficam no lugar dela (`removeSceneKeepingInside`).
   * Recusa (`false`) a última cena e a cena onde está alguma ficha de
   * `playerTokenIds`. Cena aberta: outra abre antes. O arquivo dela fica no
   * disco; só sai da lista.
   */
  deleteScene: (sceneId: string, playerTokenIds?: ReadonlySet<string>) => boolean
  /**
   * "Subir" (`-1`) e "Descer" (`1`) do menu da cena: ela troca de lugar com a
   * irmã de cima ou de baixo (mesma cena de fora), na ordem que a lista mostra.
   * A pasta anda com o que tem dentro. `false` na ponta. Não confundir com
   * `moveScene`, que muda a PASTA da cena.
   */
  shiftScene: (sceneId: string, delta: -1 | 1) => boolean
  /**
   * CENAS EM PASTAS: põe `sceneId` dentro de `parentId` (`null` = primeiro
   * nível), com o que estava dentro dela. Muda só a lista de cenas — pede
   * Salvar como o renomear, fora do desfazer da cena aberta. `false` quando não
   * dá (dentro dela mesma ou de uma cena que está dentro dela, cena que não
   * existe) ou quando ela já estava lá.
   */
  moveScene: (sceneId: string, parentId: string | null) => boolean
  /** Liga/desliga "Planta conhecida por todos" na cena. Grava com a aventura, como o nome. */
  setScenePlanKnown: (sceneId: string, known: boolean) => void
  /**
   * AGENDA DA CAMPANHA: troca a agenda da aventura inteira (hora da mesa e
   * eventos). Pede Salvar como o renomear, fora do desfazer da cena aberta.
   * `false` no mapa solto: sem aventura não há onde guardar a agenda.
   */
  setAgenda: (agenda: AgendaDaCampanha) => boolean
  /**
   * Troca a cena aberta. `false` quando não há o que trocar (mesma cena, cena
   * indisponível). `focus` centraliza a câmera nesse ponto da cena que entra.
   */
  switchScene: (sceneId: string, focus?: Point) => boolean
  /**
   * "Ir lá": o editor mostra `point` da cena `sceneId` no centro da tela. Se a
   * cena já está aberta (ou é o mapa solto, `null`), só a câmera anda — a
   * troca de cena recusaria "mesma cena" e o clique não faria nada. `fit` (só
   * na cena aberta) é a caixa do objeto procurado: afasta se ela não couber.
   */
  goToPoint: (sceneId: string | null, point: Point, fit?: Bounds) => boolean
  /**
   * LISTA "PINOS": abre a cena `sceneId` (`null` = mapa solto) com a câmera no
   * pino `pinId`, o editor no piso dele e ele selecionado no painel. `false`
   * quando o pino não existe mais ali ou a cena não abre — aí nada muda.
   */
  goToPin: (sceneId: string | null, pinId: string) => boolean
  /**
   * PISOS NA MESMA CENA — "Ir lá" até uma FICHA: o `goToPoint` de sempre e o
   * editor no `piso` dela. Só a câmera deixava o editor no piso de antes (ou
   * no térreo, que `loadMap` põe ao trocar de cena), com a ficha invisível
   * no centro da tela. `false` (e o piso intacto) quando o `goToPoint` não foi.
   */
  goToPointNoPiso: (sceneId: string | null, point: Point, piso: number) => boolean
  /** Muda uma cena de FUNDO sem passar pelo desfazer da cena aberta. */
  updateBackgroundScene: (sceneId: string, updater: (map: MapData) => MapData) => void
  /**
   * Mudança de um JOGADOR numa cena de FUNDO. Além do mapa, `transform` entra
   * em todo passo do desfazer guardado dela: quando o mestre abrir a cena, o
   * Ctrl+Z não pode devolver a ficha (ou a porta) do jogador ao estado de
   * antes. Mesmo contrato de `useMapStore.applyPlayerChange` para `transform`.
   */
  applyPlayerChangeToBackgroundScene: (sceneId: string, transform: (map: MapData) => MapData) => void
  /**
   * Liga o pino de viagem `pinId` (da cena aberta) a um pino de chegada NOVO,
   * que nasce no centro de `sceneId`. A volta é gravada pelo guardião da mão
   * dupla (ver `syncTravelLinks`). Devolve o id da chegada, ou `null` se não
   * deu para ligar.
   */
  /**
   * `exitId` diz QUAL saída liga (ENCRUZILHADA): ausente = a principal, a de
   * sempre; `null` = uma saída NOVA ("+ Outra saída").
   */
  linkPinToNewArrival: (pinId: string, sceneId: string, exitId?: string | null) => string | null
  /**
   * ESCADA QUE LEVA A OUTRO ANDAR: a escada `stairId` (da cena aberta) passa a
   * levar a `sceneId`. Nasce lá a escada PAR (mesmo desenho, sentido
   * contrário), com o pino invisível dela; aqui a escada ganha o seu (ou
   * religa o que já tinha), com o modo `passagem`. A volta é gravada pelo
   * guardião da mão dupla, como no pino de viagem. Devolve o id da escada par,
   * ou `null` se não deu (mesma cena, cena fora do ar, escada que sumiu).
   */
  linkStairToFloor: (stairId: string, sceneId: string, passagem: PinPassage) => string | null
  /**
   * "Criar andar de cima" (escada que sobe) ou "de baixo" (que desce): uma cena
   * nova ao lado da aberta, "<prédio> – andar de cima", com o contorno do
   * prédio da escada (`lib/stairTravel.ts`, `withBuildingContour`) e a escada
   * par no MESMO ponto, já ligada com `passagem`. O mestre fica onde está.
   * Devolve o id da cena nova, ou `null` fora de aventura / escada que sumiu.
   */
  createFloorFromStair: (stairId: string, passagem: PinPassage) => string | null
  /** "Nenhum outro andar": tira o pino da escada; o guardião desliga o par. Entra no desfazer. */
  unlinkStair: (stairId: string) => void
  /** Modo de passagem da escada `stairId` — do pino dela, com desfazer. Escada sem ligação: nada. */
  setStairPassage: (stairId: string, passagem: PinPassage) => void
  /** Liga a saída `exitId` do pino `pinId` ao pino de viagem `partnerId`, que já existe em `sceneId`. */
  linkPinToExisting: (pinId: string, sceneId: string, partnerId: string, exitId?: string | null) => boolean
  /** Desliga a saída `exitId` (ausente = a principal) e, pelo guardião, o par dela. Entra no desfazer da cena aberta. */
  unlinkPin: (pinId: string, exitId?: string) => void
  /** Dá nome à saída `exitId` do pino `pinId`. Entra no desfazer da cena aberta. */
  renamePinExit: (pinId: string, exitId: string, rotulo: string) => void
  /**
   * MÃO ÚNICA da saída `exitId` do pino `pinId` (da cena aberta): marcar põe
   * a marca de chegada oculta no PAR, na cena de fundo; desmarcar tira. Fora
   * do desfazer da cena aberta, como toda mudança de cena de fundo. `false`
   * quando não deu: saída sem par, ou par que é encruzilhada (esconder o par
   * esconderia as outras saídas dele junto).
   */
  setPinOneWay: (pinId: string, exitId: string, on: boolean) => boolean
  /**
   * TRANCAR OS DOIS LADOS do pino `pinId` (da cena aberta): `true` tranca ele
   * e o par de CADA saída ligada (numa encruzilhada, todos), levando o motivo
   * deste lado junto; `false` devolve todos a "Pede ao mestre". Este pino entra
   * no desfazer da cena aberta; os pares, nas cenas de fundo, ficam fora dele,
   * como a mão única. `false` quando não há outro lado (pino sem destino, que
   * não é de viagem, ou que não existe) — aí nada muda.
   */
  setPassageBothSides: (pinId: string, trancar: boolean) => boolean
  /**
   * Leva a visão do mestre pela saída `exitId` (ausente = a principal): abre
   * a cena de destino com o par no centro da tela e aberto no painel. `false`
   * quando a saída não leva a lugar nenhum.
   */
  travelThroughPin: (pinId: string, exitId?: string) => boolean
  /**
   * O jogador atravessou: tira o token `tokenId` da cena `fromSceneId` e o
   * põe em (`x`, `y`) da cena `toSceneId`. FORA DO DESFAZER nas duas pontas —
   * ver `transferToken` abaixo. `false` quando não deu (cena fora do ar,
   * token que já não está lá, mesma cena). PISOS NA MESMA CENA: `piso` é o
   * piso da cena de destino onde ele chega; ausente = o térreo — o piso da
   * cena de partida não vale na outra cena.
   */
  transferToken: (tokenId: string, fromSceneId: string, toSceneId: string, x: number, y: number, piso?: number) => boolean
  /**
   * "Levar para…" da ficha SEM DONO (NPC, monstro): leva o token `tokenId` da
   * cena aberta para `toSceneId`, na ponta do pino de viagem `pinId` (`null` =
   * centro livre da cena). A mesma ficha, com id, nome, cor e foto, pela
   * travessia de `transferToken` — fora do desfazer. `null` quando não deu
   * (mapa solto, cena fora do ar, pino ou ficha que sumiu, mesma cena).
   */
  carryToken: (tokenId: string, toSceneId: string, pinId: string | null) => CarriedToken | null
  /**
   * ESTADO DO MUNDO: cria "Maré" com os valores de `valores` ("alta, baixa"),
   * o primeiro como atual. Devolve o id, ou `null` no mapa solto, sem nome ou
   * sem valor. Muda só a aventura (pede Salvar).
   */
  criarEstadoDoMundo: (nome: string, valores: string) => string | null
  /**
   * ESTADO DO MUNDO: põe `estadoId` em `valor` e grava o efeito em cada porta,
   * pino e zona amarrados, na cena aberta e em todas as de fundo que abriram.
   * Mudança de MESA: fora do Ctrl+Z do mestre nas duas pontas. Devolve quantos
   * elementos mudaram e em quantas cenas; `null` quando o estado não existe ou
   * o valor não é dele (nada muda).
   * ROTINA DO NPC: é também o APITO — cada ficha com posto em `valor` vai para
   * ele, dentro da cena ou para outra (`transferToken`), também fora do Ctrl+Z.
   * `fixas`: fichas que um jogador segura; ficam onde estão.
   */
  trocarEstadoDoMundo: (estadoId: string, valor: string, fixas?: ReadonlySet<string>) => ResumoDaTroca | null
  /**
   * ESTADO DO MUNDO: "Depende do estado" de um elemento da cena ABERTA (o
   * painel de propriedades só mostra ela). Grava a regra e já põe o elemento
   * no efeito do valor atual do estado, pelo `useMapStore.amarrarAoEstado`
   * (com histórico). Estado que não existe na aventura: só grava a regra.
   */
  amarrarAoEstado: (amarra: AmarraDeEstado) => void
  /**
   * CABINE DE TRANSPORTE: cria a cabine `nome` com o pino de viagem `pinId` da
   * cena ABERTA como primeira parada, e a cabine nele. Devolve o id, ou `null`
   * no mapa solto, sem nome ou com pino que não é de viagem. Muda só a
   * aventura (pede Salvar), fora do Ctrl+Z da cena.
   */
  criarCabine: (nome: string, pinId: string) => string | null
  /**
   * CABINE DE TRANSPORTE: o pino `pinId` da cena aberta passa a ser parada de
   * `cabineId` (`null` = de nenhuma). `false` quando nada muda.
   */
  definirParadaDeCabine: (pinId: string, cabineId: string | null) => boolean
  /**
   * CABINE DE TRANSPORTE: a cabine passa a estar em `parada` (uma das dela):
   * "Trazer a cabine para cá" do mestre e a viagem de quem passou (`applyCabine`
   * da ponte). `false` quando não dá ou ela já está lá.
   */
  moverCabine: (cabineId: string, parada: PinDestination) => boolean
  /**
   * CABINE DE TRANSPORTE: a chamada que o host aceitou entra no fim da fila
   * (`chamadaDeCabine` da ponte). `false` quando não entra: a parada já está
   * na fila, a cabine já está lá, a cabine ou a parada não existem.
   */
  chamarCabine: (chamada: ChamadaAceita) => boolean
  /**
   * CABINE DE TRANSPORTE: "Atender a próxima chamada" — a cabine vai à parada
   * da primeira chamada da fila, que sai dela. `false` com a fila vazia.
   */
  atenderChamada: (cabineId: string) => boolean
  /** CABINE DE TRANSPORTE: "Limpar a fila". `false` quando não havia chamada. */
  limparFilaDaCabine: (cabineId: string) => boolean
  /** Há cena de fundo ou lista de cenas esperando gravação? (A cena aberta é o `useSessionStore` que diz.) */
  hasPendingScenes: () => boolean
  /**
   * Grava a aventura inteira e devolve o caminho da cena aberta. `stored`:
   * fichas que o mestre guardou ("Guardar ficha") — fora do mapa do editor,
   * mas o arquivo as leva, cada uma na cena de onde saiu (`storedTokensOfScene`).
   */
  flush: (stored?: readonly StoredToken[]) => Promise<string>
}

const EMPTY = {
  adventure: null,
  dir: null,
  rootPath: null,
  rootMapId: null,
  activeSceneId: null,
  previousSceneId: null,
  cache: {},
  dirty: {},
  structureDirty: false,
  cameraRequest: null,
} satisfies Partial<AdventureState>

/** Lista pronta para a tela: a cena aberta conta os tokens do mapa vivo. */
export function sceneList(state: Pick<AdventureState, 'adventure' | 'activeSceneId' | 'cache'>, liveMap: MapData): SceneListItem[] {
  if (state.adventure === null) {
    return [{ id: '', name: liveMap.name, tokenCount: liveMap.tokens.length, available: true, active: true, renamable: false }]
  }
  return state.adventure.scenes.map((entry): SceneListItem => {
    const active = entry.id === state.activeSceneId
    const slot = state.cache[entry.id]
    // `parentId` só na cena de dentro: a do primeiro nível fica como sempre foi.
    const base = { id: entry.id, name: entry.name, active, renamable: true, ...(entry.parentId === undefined ? {} : { parentId: entry.parentId }), ...publicNameOf(entry), ...(entry.planKnownByAll === true ? { planKnownByAll: true } : {}) }
    if (active) return { ...base, tokenCount: liveMap.tokens.length, available: true }
    if (slot !== undefined && slot.status === 'carregando') return { ...base, tokenCount: null, available: false, loading: true }
    if (slot === undefined || slot.status !== 'ok') return { ...base, tokenCount: null, available: false }
    return { ...base, tokenCount: slot.map.tokens.length, available: true }
  })
}

/**
 * VISÃO GERAL DAS CENAS: o mapa de cada miniatura, pelo mesmo id da lista de
 * Cenas (`sceneList`). A aberta é o mapa VIVO — o que o mestre acabou de mexer
 * aparece na miniatura sem salvar —, as de fundo vêm do cache, e a que não
 * abriu fica de fora (não há mapa para desenhar). Mapa solto: ele mesmo, id ''.
 */
export function sceneMaps(state: Pick<AdventureState, 'adventure' | 'activeSceneId' | 'cache'>, liveMap: MapData): Map<string, MapData> {
  const maps = new Map<string, MapData>()
  if (state.adventure === null) {
    maps.set('', liveMap)
    return maps
  }
  for (const entry of state.adventure.scenes) {
    if (entry.id === state.activeSceneId) {
      maps.set(entry.id, liveMap)
      continue
    }
    const slot = state.cache[entry.id]
    if (slot !== undefined && slot.status === 'ok') maps.set(entry.id, slot.map)
  }
  return maps
}

type SceneState = Pick<AdventureState, 'adventure' | 'activeSceneId' | 'cache'>

/** O mapa de uma cena de fundo, ou `null` quando ela não abriu. */
function slotMap(slot: SceneSlot | undefined): MapData | null {
  return slot !== undefined && slot.status === 'ok' ? slot.map : null
}

/** O mapa da cena `sceneId`: a aberta pelo mapa vivo, as de fundo pelo cache. */
function mapOfScene(state: SceneState, liveMap: MapData, sceneId: string): MapData | null {
  return sceneId === state.activeSceneId ? liveMap : slotMap(state.cache[sceneId])
}

/** Quem está à mesa, como a confirmação de apagar precisa: o nome e as fichas dele (`PlayerInfo` serve). */
export interface ScenePlayer {
  name: string
  tokenIds: readonly string[]
}

/** O que a confirmação de "Apagar cena…" diz antes de apagar. */
export interface SceneDeletionInfo {
  /** Pinos de viagem de OUTRAS cenas que levam a esta e ficam sem destino. */
  orphanPins: number
  /** Jogadores com ficha nesta cena: com alguém aqui, apagar fica desligado. */
  blockers: string[]
  /** Cenas direto dentro desta: sobem um nível quando ela é apagada. */
  inside: number
}

/**
 * Antes de apagar `sceneId`: quantos pinos de outras cenas ficam órfãos,
 * quantas cenas de dentro sobem um nível e quem ainda está lá. Cena que não
 * abriu não tem fichas para contar.
 */
export function sceneDeletionInfo(state: SceneState, liveMap: MapData, sceneId: string, players: readonly ScenePlayer[]): SceneDeletionInfo {
  let orphanPins = 0
  for (const entry of state.adventure?.scenes ?? []) {
    if (entry.id === sceneId) continue
    const map = mapOfScene(state, liveMap, entry.id)
    if (map !== null) orphanPins += map.pins.filter((pin) => leadsToScene(pin, sceneId)).length
  }
  const here = new Set((mapOfScene(state, liveMap, sceneId)?.tokens ?? []).map((token) => token.id))
  const blockers = players.filter((player) => player.tokenIds.some((id) => here.has(id))).map((player) => player.name)
  return { orphanPins, blockers, inside: sceneChildCount(state.adventure?.scenes ?? [], sceneId) }
}

/** Sufixo do nome da cena duplicada, o mesmo da cópia de mapa e de sala. */
const SCENE_COPY_SUFFIX = ' (cópia)'

/**
 * Os pinos de cada cena para a lista "Pinos" (`lib/pinDirectory.ts`): a aberta
 * pelo mapa vivo, as de fundo pelo cache, na ordem da aventura. Cena que não
 * abriu fica de fora (não há pino para ir). Sem aventura, o mapa solto sozinho.
 */
export function pinScenesOf(state: SceneState, liveMap: MapData): PinDirectoryScene[] {
  if (state.adventure === null) return [{ sceneId: null, sceneName: liveMap.name, pins: liveMap.pins }]
  return state.adventure.scenes.flatMap((entry): PinDirectoryScene[] => {
    if (entry.id === state.activeSceneId) return [{ sceneId: entry.id, sceneName: entry.name, pins: liveMap.pins }]
    const slot = state.cache[entry.id]
    return slot !== undefined && slot.status === 'ok' ? [{ sceneId: entry.id, sceneName: entry.name, pins: slot.map.pins }] : []
  })
}

/**
 * As cenas da aventura como a ligação dos pinos de viagem as enxerga: a
 * aberta pelo mapa vivo, as de fundo pelo cache. Cena fora da aventura é `null`.
 */
function sceneLookup(state: SceneState, liveMap: MapData): (sceneId: string) => TravelScene | null {
  return (sceneId) => {
    const entry = state.adventure?.scenes.find((scene) => scene.id === sceneId)
    if (entry === undefined) return null
    if (sceneId === state.activeSceneId) return { name: entry.name, map: liveMap }
    const slot = state.cache[sceneId]
    if (slot !== undefined && slot.status === 'carregando') return { name: entry.name, map: null, loading: true }
    return { name: entry.name, map: slot !== undefined && slot.status === 'ok' ? slot.map : null }
  }
}

/** Para onde o pino da cena aberta leva — o que o painel diz e o que o clique faz. */
export function pinTravelOf(state: SceneState, liveMap: MapData, pin: Pin): PinTravel {
  return resolvePinTravel(pin, state.activeSceneId, sceneLookup(state, liveMap))
}

/** Para onde a escada da cena aberta leva — pelo pino invisível dela. Sem pino, "sem destino". */
export function stairTravelOf(state: SceneState, liveMap: MapData, stair: Stair): PinTravel {
  const pin = stairPinOf(liveMap, stair.id)
  return pin === undefined ? { status: 'sem-destino' } : pinTravelOf(state, liveMap, pin)
}

/**
 * O "Leva a…" da escada `stair` da cena aberta, pronto para o painel dela
 * (`components/StairControls.tsx`): as outras cenas, para onde leva hoje e o
 * modo, com as ações ligadas a esta store. `null` fora de uma aventura: no
 * mapa solto não há outro andar, e a seção não aparece.
 */
export function stairTravelPanel(state: SceneState, liveMap: MapData, stair: Stair): StairTravelProps | null {
  if (state.adventure === null) return null
  const travel = stairTravelOf(state, liveMap, stair)
  const pin = stairPinOf(liveMap, stair.id)
  return {
    scenes: travelSceneOptions(state),
    // O pino que o guardião desligou (o par de lá foi desligado ou apagado) é
    // "sem destino": não leva a lugar nenhum, e o painel diz isso.
    linkedSceneId: travel.status === 'sem-destino' ? null : travel.sceneId,
    passage: pin === undefined ? 'pede' : passageOf(pin),
    onLink: (sceneId, passagem) => {
      useAdventureStore.getState().linkStairToFloor(stair.id, sceneId, passagem)
    },
    onUnlink: () => useAdventureStore.getState().unlinkStair(stair.id),
    onPassageChange: (passagem) => useAdventureStore.getState().setStairPassage(stair.id, passagem),
    onCreateFloor: (passagem) => {
      useAdventureStore.getState().createFloorFromStair(stair.id, passagem)
    },
  }
}

/** Uma saída do pino aberto no painel: o id, o nome que o mestre deu e para onde ela leva. */
export interface PinExitTravel {
  id: string
  rotulo: string
  travel: PinTravel
}

/**
 * As saídas do pino da cena aberta, na ordem (a principal primeiro), cada uma
 * resolvida. Pino sem ligação nenhuma tem UMA linha: a principal, "Sem destino"
 * — é dela que sai o "Leva a…" de sempre.
 */
export function pinExitsTravelOf(state: SceneState, liveMap: MapData, pin: Pin): readonly PinExitTravel[] {
  const lookup = sceneLookup(state, liveMap)
  const saidas = travelExitsOf(pin)
  if (saidas.length === 0) return [{ id: SAIDA_PRINCIPAL, rotulo: pin.rotulo ?? '', travel: resolvePinTravel(pin, state.activeSceneId, lookup) }]
  return saidas.map((saida) => ({ id: saida.id, rotulo: saida.rotulo, travel: resolvePinTravel(pin, state.activeSceneId, lookup, saida.id) }))
}

/** Pinos de viagem da cena aberta que não levam a lugar nenhum: o canvas os desenha apagados. */
export function unlinkedTravelPinIds(state: SceneState, liveMap: MapData): Set<string> {
  const ids = new Set<string>()
  const lookup = sceneLookup(state, liveMap)
  for (const pin of liveMap.pins) {
    if (pin.kind !== 'viagem') continue
    // Encruzilhada acesa se QUALQUER saída leva a algum lugar.
    const algumaLiga = travelExitsOf(pin).some((saida) => resolvePinTravel(pin, state.activeSceneId, lookup, saida.id).status === 'ligado')
    if (!algumaLiga) ids.add(pin.id)
  }
  return ids
}

/** O que gravar no pino para ligar a saída `exitId` (`null` = uma saída nova) a `destino`. */
function exitPatchFor(pin: Pin, exitId: string | null, destino: PinDestination): ExitPatch {
  if (exitId === null) return addExit(pin, newExitId(), destino)
  return setExitDestination(pin, exitId, destino)
}

/**
 * As cenas para onde um pino da cena aberta pode levar: todas as outras. A
 * cena de dentro de outra leva o caminho ao lado do nome (`trail`; numa
 * linha só, `travelSceneLabel`: "Porto Cinza › Taverna"): duas "Taverna" em
 * cidades diferentes não se confundem na escolha. É lista do mestre; o nome
 * que o jogador nunca recebe continua sem caminho.
 */
export function travelSceneOptions(state: SceneState): TravelSceneOption[] {
  const adventure = state.adventure
  if (adventure === null) return []
  return adventure.scenes
    .filter((entry) => entry.id !== state.activeSceneId)
    .map((entry) => {
      const slot = state.cache[entry.id]
      const option: TravelSceneOption = { id: entry.id, name: entry.name, trail: sceneTrail(adventure.scenes, entry.id), available: slot !== undefined && slot.status === 'ok' }
      return slot !== undefined && slot.status === 'carregando' ? { ...option, loading: true } : option
    })
}

/**
 * "Esta cena" no "Leva a…": o ATALHO para outro ponto do mapa aberto (a
 * escada de um andar ao outro da mesma torre). Fica à parte de
 * `travelSceneOptions`, que continua sendo a lista das OUTRAS cenas. Sem
 * aventura (mapa solto) não há id de cena para gravar no destino: `null`.
 */
export function hereSceneOption(state: SceneState): TravelSceneOption | null {
  if (state.adventure === null || state.activeSceneId === null) return null
  return { id: state.activeSceneId, name: 'Esta cena', available: true, here: true }
}

/**
 * A lista do passo 1 do "Leva a…", como o painel do pino a mostra: "Esta
 * cena" primeiro (o atalho), depois as outras cenas. Mapa solto: só as
 * outras (que também não há).
 */
export function travelDestinationOptions(state: SceneState): TravelSceneOption[] {
  const aqui = hereSceneOption(state)
  return aqui === null ? travelSceneOptions(state) : [aqui, ...travelSceneOptions(state)]
}

/** Id da saída nova ("+ Outra saída"). */
function newExitId(): string {
  return `saida_${crypto.randomUUID().slice(0, 8)}`
}

/** Os pinos de viagem de `sceneId` que o pino `pinId` da cena aberta pode escolher como par. */
export function pinTravelOptions(state: SceneState, liveMap: MapData, sceneId: string, pinId: string): TravelPinOption[] {
  return travelPinOptions(sceneId, state.activeSceneId, pinId, sceneLookup(state, liveMap))
}

/**
 * O que o host serve (`net/hostSession.ts`): a cena aberta pelo mapa vivo e as
 * de fundo que abriram, cada uma com o nome da lista. Sem aventura, o mapa
 * solto sozinho — e aí todo jogador vê a cena aberta, como sempre.
 */
export function hostWorldOf(state: SceneState, liveMap: MapData): HostWorld {
  if (state.adventure === null || state.activeSceneId === null) return singleSceneWorld(liveMap)
  const background: HostScene[] = []
  let open: HostScene = { sceneId: state.activeSceneId, name: liveMap.name, map: liveMap }
  // A flag só entra quando ligada: cena de sempre continua o mesmo objeto de antes.
  const planOf = (on: boolean): { planKnownByAll?: boolean } => (on ? { planKnownByAll: true } : {})
  for (const entry of state.adventure.scenes) {
    const planKnownByAll = entry.planKnownByAll === true
    if (entry.id === state.activeSceneId) {
      open = { sceneId: entry.id, name: entry.name, ...publicNameOf(entry), map: liveMap, ...planOf(planKnownByAll) }
      continue
    }
    const slot = state.cache[entry.id]
    if (slot !== undefined && slot.status === 'ok') background.push({ sceneId: entry.id, name: entry.name, ...publicNameOf(entry), map: slot.map, ...planOf(planKnownByAll) })
  }
  // CABINE DE TRANSPORTE: aventura sem cabine serve o mundo de sempre, sem a chave.
  const cabines = state.adventure.cabines
  return cabines === undefined ? { open, background } : { open, background, cabines }
}

/** A cena aberta (mapa vivo) e as de fundo que abriram, cada uma com o id dela na aventura. */
function cenasCarregadas(activeSceneId: string, live: MapData, cache: Record<string, SceneSlot>): CenaDaRotina[] {
  const fundo = Object.entries(cache).flatMap(([sceneId, slot]) => (slot.status === 'ok' ? [{ sceneId, map: slot.map }] : []))
  return [{ sceneId: activeSceneId, map: live }, ...fundo]
}

/** As cenas de fundo que `hostWorldOf` serve (só slot 'ok') mudaram de conjunto? */
function servedScenesChanged(before: Record<string, SceneSlot>, after: Record<string, SceneSlot>): boolean {
  const served = (cache: Record<string, SceneSlot>) => Object.keys(cache).filter((id) => cache[id]?.status === 'ok')
  const antes = new Set(served(before))
  const depois = served(after)
  return depois.length !== antes.size || depois.some((id) => !antes.has(id))
}

/**
 * Avisa `onChange` quando entra ou sai cena de fundo do mundo que o host
 * serve — as que chegam do disco depois de abrir a aventura (`open` mostra a
 * cena pedida antes de ler as outras), a criada, a trocada. O broadcast do
 * `open` sai com elas ainda "carregando" (fora do mundo, e o jogador que está
 * nelas vê "Aguardando o mestre"); sem este aviso ninguém reenviaria quando
 * elas chegassem. Mudança DENTRO de uma cena já servida não avisa: essa vai
 * pelo mapa vivo ou pela própria sessão, como antes.
 *
 * Liga-se UMA VEZ, na raiz do app, junto da ponte do host. Devolve o cancelamento.
 */
export function subscribeToServedScenes(onChange: () => void): () => void {
  return useAdventureStore.subscribe((state, previous) => {
    if (state.cache !== previous.cache && servedScenesChanged(previous.cache, state.cache)) onChange()
  })
}

/** Um mapa com o desfazer dele: a cena aberta (no `useMapStore`) ou uma de fundo (no cache). */
interface SceneHistory {
  map: MapData
  past: MapData[]
  future: MapData[]
}

/*
 * A TRAVESSIA NÃO ENTRA NO DESFAZER. Tirar o token só do mapa atual deixaria
 * o `past` inteiro com ele: um Ctrl+Z na cena de origem o traria de volta, e
 * o mesmo token estaria nas DUAS cenas. Por isso o token sai de todo passo do
 * histórico da origem (passado e futuro) e entra em todo passo do histórico
 * do destino: desfazer e refazer andam pelo resto da edição sem nunca
 * duplicar nem perder a ficha de um jogador.
 */
function withoutToken(history: SceneHistory, tokenId: string): SceneHistory {
  const drop = (map: MapData): MapData => (map.tokens.some((t) => t.id === tokenId) ? mapFactory.removeToken(map, tokenId) : map)
  return { map: drop(history.map), past: history.past.map(drop), future: history.future.map(drop) }
}

/**
 * A ficha `fromId` passa a se chamar `toId`, e o que o mapa guarda pelo id
 * dela vai junto: a tocha presa nela, as fichas que ela leva e o lugar dela
 * num veículo.
 */
function renameToken(map: MapData, fromId: string, toId: string): MapData {
  const renamePassenger = (t: Token): Token => {
    const passageiros = t.veiculo?.passageiros
    if (t.veiculo === undefined || passageiros === undefined || !passageiros.includes(fromId)) return t
    return { ...t, veiculo: { ...t.veiculo, passageiros: passageiros.map((id) => (id === fromId ? toId : id)) } }
  }
  return {
    ...map,
    tokens: map.tokens.map((t) => {
      const renamed = renamePassenger(t.id === fromId ? { ...t, id: toId } : t)
      return renamed.levadoPor === fromId ? { ...renamed, levadoPor: toId } : renamed
    }),
    lights: map.lights.map((l) => (l.attachedTokenId === fromId ? { ...l, attachedTokenId: toId } : l)),
  }
}

/*
 * FICHA COM ID REPETIDO. Duas cenas podem ter uma ficha de mesmo id (cena
 * copiada, mapa importado duas vezes). Quem chega não substitui quem já
 * estava: a de DESTINO ganha id novo, em todo passo do histórico dela (senão
 * um Ctrl+Z traria de volta a ficha com o id repetido). A que viaja guarda o
 * id porque é por ele que a sessão sabe de qual jogador ela é, e o que chamou
 * a travessia (`carryToken`, "Deixar ir", "Reunir o grupo") segue apontando
 * para ela. Tudo que é guardado pelo id da de destino vai junto para o id
 * novo: o que mora no mapa (a tocha presa, as fichas que ela leva e o lugar
 * dela num veículo) aqui, em `renameToken`; o que mora FORA dele (a seleção e
 * a iniciativa) em `transferToken`, com `renamedResidents`.
 *
 * VÁRIAS DE UMA VEZ (o veículo e quem está a bordo): TODAS as de destino com
 * id repetido trocam de id ANTES de qualquer uma chegar. Uma por vez, a
 * troca de id da segunda passaria também na lista do veículo que já tinha
 * chegado, e ele levaria a ficha antiga de lá no lugar de quem viajou.
 */
function withTokens(history: SceneHistory, tokens: readonly Token[]): { history: SceneHistory; renamedResidents: Map<string, string> } {
  const steps = [history.map, ...history.past, ...history.future]
  // Quem já estava no destino com o id de quem chegou ganhou id novo: traveler → resident.
  const renamedResidents = new Map<string, string>()
  for (const token of tokens) {
    if (steps.some((map) => map.tokens.some((t) => t.id === token.id))) renamedResidents.set(token.id, crypto.randomUUID())
  }
  const put = (map: MapData): MapData => {
    let next = map
    for (const [travelerId, residentId] of renamedResidents) next = renameToken(next, travelerId, residentId)
    // Id de quem chega que sobrou na lista de um veículo do destino (ficha que
    // já não estava lá) não põe quem chega a bordo dele sem ninguém pedir.
    for (const token of tokens) next = leaveVehicle(next, token.id)
    for (const token of tokens) next = mapFactory.addToken(next, token)
    return next
  }
  return { history: { map: put(history.map), past: history.past.map(put), future: history.future.map(put) }, renamedResidents }
}

/**
 * A ficha que já estava no mapa `mapId` trocou `fromId` por `toId` (ver
 * `withTokens`). A iniciativa é guardada por mapa + id: o valor e a vez dela
 * vão com ela, e a que chegou entra sem nenhum dos dois. Se o mapa é o que
 * está aberto (`inEditor`), a seleção dela também segue a ficha.
 */
function renameResidentOutsideMap(mapId: string, fromId: string, toId: string, inEditor: boolean): void {
  useInitiativeStore.getState().renameToken(mapId, fromId, toId)
  if (!inEditor) return
  const { selection } = useMapStore.getState()
  if (!selectionHas(selection, { kind: 'token', id: fromId })) return
  // `setState`, não `setSelection`: é a MESMA seleção com o id novo, e não
  // pode soltar o pino ou a zona que estão abertos no painel.
  useMapStore.setState({ selection: selection.map((item) => (item.kind === 'token' && item.id === fromId ? { kind: 'token', id: toId } : item)) })
}

/**
 * CENA APAGADA, no histórico inteiro: a ligação para ela sai do mapa e de cada
 * passo do desfazer e do refazer — senão um Ctrl+Z religaria o pino a uma cena
 * que não existe mais. `null` quando nenhum passo levava à cena apagada.
 */
function withoutLinksTo(history: SceneHistory, goneSceneId: string): SceneHistory | null {
  const unlink = (map: MapData) => unlinkFromScene(map, goneSceneId)
  const next = { map: unlink(history.map), past: history.past.map(unlink), future: history.future.map(unlink) }
  const same = (a: readonly MapData[], b: readonly MapData[]) => a.every((map, i) => map === b[i])
  if (next.map === history.map && same(next.past, history.past) && same(next.future, history.future)) return null
  return next
}

/**
 * Para onde o editor vai quando a cena ABERTA é apagada: a de onde se veio,
 * senão a primeira que abre abaixo dela, senão acima — abaixo e acima na
 * lista que o mestre vê (a árvore), não na ordem crua. `null` = nenhuma abre.
 */
function sceneToOpenInstead(state: Pick<AdventureState, 'adventure' | 'cache' | 'previousSceneId'>, goneSceneId: string): string | null {
  const scenes = sceneTree(state.adventure?.scenes ?? []).map((row) => row.entry)
  const opens = (id: string) => id !== goneSceneId && slotMap(state.cache[id]) !== null
  if (state.previousSceneId !== null && opens(state.previousSceneId)) return state.previousSceneId
  const index = scenes.findIndex((entry) => entry.id === goneSceneId)
  const ordered = [...scenes.slice(index + 1), ...scenes.slice(0, Math.max(index, 0)).reverse()]
  return ordered.find((entry) => opens(entry.id))?.id ?? null
}

/**
 * Liga a escada `stairId` da cena aberta a `sceneId`: nasce lá a escada par,
 * com a boca em `mouthIn(mapa de lá)`, e o pino invisível de cada uma. Devolve
 * o id da escada par, ou `null` quando não liga (escada ou cena que não há).
 */
function linkStairAt(
  get: () => AdventureState,
  stairId: string,
  sceneId: string,
  passagem: PinPassage,
  mouthIn: (map: MapData) => Point,
): string | null {
  const { activeSceneId, cache } = get()
  const live = useMapStore.getState().map
  const stair = live.stairs.find((s) => s.id === stairId)
  const slot = cache[sceneId]
  if (stair === undefined || activeSceneId === null || sceneId === activeSceneId) return null
  if (slot === undefined || slot.status !== 'ok') return null
  const partnerStair = buildPartnerStair(crypto.randomUUID(), stair, mouthIn(slot.map))
  const partnerPin = partnerStair === null ? null : buildStairPin(crypto.randomUUID(), partnerStair, passagem)
  const ownPin = buildStairPin(crypto.randomUUID(), stair, passagem)
  if (partnerStair === null || partnerPin === null || ownPin === null) return null
  // O par nasce SEM destino: quem grava a volta é o guardião, quando a ida é
  // gravada logo abaixo — o mesmo caminho de `linkPinToNewArrival`.
  get().updateBackgroundScene(sceneId, (map) => mapFactory.addPin(mapFactory.addStair(map, partnerStair), partnerPin))
  const destino: PinDestination = { sceneId, pinId: partnerPin.id }
  const existing = stairPinOf(live, stairId)
  if (existing === undefined) useMapStore.getState().addPin({ ...ownPin, destino })
  else useMapStore.getState().updatePin(existing.id, { destino, passagem })
  return partnerStair.id
}

/**
 * LEVAR FICHA JUNTO: a ficha levada que chega a uma cena SEM quem a leva chega
 * solta. Quem leva atravessa ANTES das levadas (`hostBridge`), então achá-la
 * no destino é o "foi junto". Sem ela lá, a levada mudou de cena sozinha (pino
 * dela, "Mandar para…" só nela, reunião sem quem leva): gravar o vínculo
 * deixava um fantasma que o painel mostrava solto e que voltava a puxar a
 * ficha quando quem leva chegasse depois, sem o mestre ter prendido de novo.
 */
function arrivingLink(token: Token, destination: MapData): Token {
  const carrierId = carrierIdOf(token)
  if (carrierId === null || destination.tokens.some((t) => t.id === carrierId)) return token
  return withoutCarrier(token)
}

/**
 * `true` enquanto uma cena ENTRA no editor. `loadMap` troca o mapa inteiro, e
 * isso não é edição: sem esta trava o guardião da mão dupla leria os pinos da
 * cena que saiu como "apagados" e desligaria todos os pares deles.
 */
let sceneLoading = false

/** Põe um mapa no editor com o desfazer que ele já tinha, e marca esse ponto como "igual ao cache". */
function showInEditor(map: MapData, past: MapData[], future: MapData[]): void {
  sceneLoading = true
  try {
    useMapStore.getState().loadMap(map)
    useMapStore.setState({ past, future })
  } finally {
    sceneLoading = false
  }
  useSessionStore.getState().markSaved()
}

/**
 * Uma cena VAZIA a mais na aventura (do tamanho e da grade de `live`), sem
 * abri-la. No mapa solto a aventura nasce aqui, com ele como primeira cena.
 * `besideOpen`: a cena nova entra na pasta da cena aberta; senão, no primeiro
 * nível. Devolve o id e o que gravar no estado.
 */
function withEmptyScene(
  state: AdventureState,
  live: MapData,
  name: string,
  loosePath: string | null,
  besideOpen: boolean,
): { id: string; patch: Partial<AdventureState> } {
  let adventure = state.adventure
  let activeSceneId = state.activeSceneId
  const born = adventure === null || activeSceneId === null
  if (adventure === null || activeSceneId === null) {
    const root: SceneEntry = { id: newSceneId(), name: live.name, file: loosePath ? baseName(loosePath) : 'map.json' }
    adventure = { version: ADVENTURE_VERSION, id: `adv_${crypto.randomUUID()}`, name: live.name, startSceneId: root.id, scenes: [root] }
    activeSceneId = root.id
  }
  const id = newSceneId()
  const sceneName = cleanSceneName(name)
  const map = mapFactory.createEmptyMap(`map_${crypto.randomUUID()}`, sceneName, live.width, live.height, live.grid)
  const openId = activeSceneId
  const parentId = besideOpen ? adventure.scenes.find((entry) => entry.id === openId)?.parentId : undefined
  const entry: SceneEntry = { id, name: sceneName, file: sceneFileFor(id), ...(parentId === undefined ? {} : { parentId }) }
  return {
    id,
    patch: {
      adventure: { ...adventure, scenes: [...adventure.scenes, entry] },
      activeSceneId,
      ...(born ? { rootPath: loosePath, rootMapId: live.id, dir: null } : {}),
      cache: { ...state.cache, [id]: { status: 'ok', map, past: [], future: [], camera: null } },
      dirty: { ...state.dirty, [id]: true },
      structureDirty: true,
    },
  }
}

/**
 * Conta as aberturas (`open`, `reset`). Cenas que chegam do disco depois de
 * outro mapa ter sido aberto são de uma aventura que já saiu do editor: a
 * chegada confere o número e, se mudou, descarta.
 */
let openGeneration = 0

/**
 * Janela que junta as cenas de fundo que chegam quase juntas numa troca de
 * estado só. Curta para o mestre não perceber a espera; longa o bastante para
 * as leituras em paralelo (`SCENE_READ_CONCURRENCY`) caírem no mesmo lote.
 */
const SCENE_ARRIVAL_BATCH_MS = 100

/** O slot de cache de uma cena de fundo recém-aberta. */
function slotFor(load: SceneLoad): SceneSlot {
  if (load.status === 'ok') return { status: 'ok', map: load.map, past: [], future: [], camera: null }
  if (load.status === 'indisponivel') return { status: 'indisponivel', reason: load.reason }
  return { status: 'carregando', pending: [] }
}

/** Toda cena ainda "carregando" vira indisponível, com `reason`. */
function failLoadingSlots(cache: Record<string, SceneSlot>, reason: string): Record<string, SceneSlot> {
  const next: Record<string, SceneSlot> = { ...cache }
  for (const [id, slot] of Object.entries(cache)) {
    if (slot.status === 'carregando') next[id] = { status: 'indisponivel', reason }
  }
  return next
}

/**
 * Uma cena "carregando" recebe o mapa lido, com as mudanças que esperavam por
 * ele, na ordem. Slot que já não está "carregando" não é tocado — a cena
 * aberta e as que já estavam no cache são as do editor, não as do disco.
 * `converted`: a conversão do portal antigo mudou o mapa, que já não é o do disco.
 */
function receiveScene(cache: Record<string, SceneSlot>, dirty: Record<string, true>, load: SceneLoad, converted: boolean): void {
  const id = load.entry.id
  const slot = cache[id]
  if (slot === undefined || slot.status !== 'carregando') return
  if (load.status !== 'ok') {
    cache[id] = slotFor(load)
    return
  }
  const map = slot.pending.reduce((current, updater) => updater(current), load.map)
  cache[id] = { status: 'ok', map, past: [], future: [], camera: null }
  if (map !== load.map || converted) dirty[id] = true
}

/** Cenas que chegaram antes das outras (`onArrive` de `loadPendingScenes`): já abrem. */
function earlyScenes(state: AdventureState, loads: readonly ArrivedScene[]): Partial<AdventureState> {
  const cache: Record<string, SceneSlot> = { ...state.cache }
  const dirty: Record<string, true> = { ...state.dirty }
  for (const load of loads) receiveScene(cache, dirty, load, false)
  return { cache, dirty }
}

/**
 * As cenas de fundo chegaram (`loadPendingScenes`): cada slot ainda
 * "carregando" recebe o mapa (`receiveScene`). Cena nova da conversão do
 * portal antigo entra no fim da lista, pendente de gravação.
 */
function arrivedScenes(state: AdventureState, full: OpenedMapFile): Partial<AdventureState> {
  if (state.adventure === null) return {}
  const cache: Record<string, SceneSlot> = { ...state.cache }
  const dirty: Record<string, true> = { ...state.dirty }
  const converted = new Set(full.changedSceneIds)
  const known = new Set(state.adventure.scenes.map((entry) => entry.id))
  const added: SceneEntry[] = []
  for (const load of full.scenes) {
    const id = load.entry.id
    if (!known.has(id)) {
      if (load.status !== 'ok') continue
      added.push(load.entry)
      cache[id] = slotFor(load)
      dirty[id] = true
      continue
    }
    receiveScene(cache, dirty, load, converted.has(id))
  }
  const settled = failLoadingSlots(cache, 'a cena não chegou do disco')
  if (added.length === 0) return { cache: settled, dirty }
  return { cache: settled, dirty, adventure: { ...state.adventure, scenes: [...state.adventure.scenes, ...added] }, structureDirty: true }
}

export const useAdventureStore = create<AdventureState>()((set, get) => ({
  ...EMPTY,

  reset: () => {
    // O que ainda chegar da aventura anterior não é deste mapa.
    openGeneration += 1
    set({ ...EMPTY })
  },

  open: (opened) => {
    openGeneration += 1
    const generation = openGeneration
    if (opened.adventure === null || opened.activeSceneId === null) {
      set({ ...EMPTY })
      showInEditor(opened.map, [], [])
      return Promise.resolve()
    }
    const cache: Record<string, SceneSlot> = {}
    for (const load of opened.scenes) {
      if (load.entry.id === opened.activeSceneId) continue
      cache[load.entry.id] = slotFor(load)
    }
    const dirty: Record<string, true> = {}
    for (const id of opened.changedSceneIds) dirty[id] = true
    set({
      ...EMPTY,
      adventure: opened.adventure,
      dir: opened.adventureDir,
      activeSceneId: opened.activeSceneId,
      cache,
      dirty,
      structureDirty: opened.adventureChanged,
    })
    showInEditor(opened.map, [], [])
    if (!opened.scenes.some((load) => load.status === 'pendente')) return Promise.resolve()

    // Cena que chega antes das outras já abre, em lotes: uma troca de estado
    // por cena seria um reenvio do mundo aos jogadores por cena (99 numa aventura grande).
    const early: ArrivedScene[] = []
    let batchTimer: ReturnType<typeof setTimeout> | null = null
    const applyEarly = (): void => {
      if (batchTimer !== null) clearTimeout(batchTimer)
      batchTimer = null
      const batch = early.splice(0)
      if (generation === openGeneration && batch.length > 0) set(earlyScenes(get(), batch))
    }
    const onArrive = (load: ArrivedScene): void => {
      early.push(load)
      if (batchTimer === null) batchTimer = setTimeout(applyEarly, SCENE_ARRIVAL_BATCH_MS)
    }
    return loadPendingScenes(opened, onArrive).then(
      (full) => {
        applyEarly()
        if (generation === openGeneration) set(arrivedScenes(get(), full))
      },
      (error: unknown) => {
        applyEarly()
        if (generation === openGeneration) set({ cache: failLoadingSlots(get().cache, error instanceof Error ? error.message : String(error)) })
      },
    )
  },

  createScene: (name, loosePath) => {
    const { id, patch } = withEmptyScene(get(), useMapStore.getState().map, name, loosePath, false)
    set(patch)
    get().switchScene(id)
    return id
  },

  createSceneForPin: (pinId, name, loosePath, exitId = SAIDA_PRINCIPAL) => {
    const pin = useMapStore.getState().map.pins.find((p) => p.id === pinId)
    // A chegada oculta não leva a lugar nenhum: não ganha destino, nem cena.
    if (pin === undefined || pin.kind !== 'viagem' || isArrivalOnly(pin)) return null
    const { id, patch } = withEmptyScene(get(), useMapStore.getState().map, name, loosePath, true)
    set(patch)
    // Sem `switchScene`: o mestre continua onde estava, com o pino no painel.
    const arrivalId = get().linkPinToNewArrival(pinId, id, exitId)
    return arrivalId === null ? null : { sceneId: id, arrivalId }
  },

  renameScene: (sceneId, name) => {
    const { adventure } = get()
    if (adventure === null) return
    const sceneName = cleanSceneName(name)
    set({
      adventure: { ...adventure, scenes: adventure.scenes.map((entry) => (entry.id === sceneId ? { ...entry, name: sceneName } : entry)) },
      structureDirty: true,
    })
  },

  duplicateScene: (sceneId, playerTokenIds = new Set()) => {
    const state = get()
    const { adventure, cache, dirty } = state
    if (adventure === null || state.activeSceneId === null) return null
    const index = adventure.scenes.findIndex((entry) => entry.id === sceneId)
    const entry = adventure.scenes[index]
    const source = mapOfScene(state, useMapStore.getState().map, sceneId)
    if (entry === undefined || source === null) return null
    const id = newSceneId()
    const name = cleanSceneName(`${entry.name}${SCENE_COPY_SUFFIX}`)
    const map = cloneSceneMap(source, `map_${crypto.randomUUID()}`, name, playerTokenIds)
    const scenes = [...adventure.scenes]
    // Mesma pasta da original, e logo depois dela na lista: entre as irmãs, a
    // árvore segue a lista, então a cópia aparece logo abaixo da original (e
    // do que ela tem dentro). Só a cena é copiada, não as de dentro dela.
    scenes.splice(index + 1, 0, { id, name, file: sceneFileFor(id), ...(entry.parentId === undefined ? {} : { parentId: entry.parentId }) })
    set({
      adventure: { ...adventure, scenes },
      cache: { ...cache, [id]: { status: 'ok', map, past: [], future: [], camera: null } },
      dirty: { ...dirty, [id]: true },
      structureDirty: true,
    })
    return id
  },

  deleteScene: (sceneId, playerTokenIds = new Set()) => {
    const before = get()
    if (before.adventure === null || before.activeSceneId === null) return false
    if (before.adventure.scenes.length <= 1 || !before.adventure.scenes.some((entry) => entry.id === sceneId)) return false
    const goneMap = mapOfScene(before, useMapStore.getState().map, sceneId)
    // Ficha de jogador não some junto com a cena: ele teria que ser mandado a outra antes.
    if (goneMap !== null && goneMap.tokens.some((token) => playerTokenIds.has(token.id))) return false
    if (sceneId === before.activeSceneId) {
      const next = sceneToOpenInstead(before, sceneId)
      if (next === null || !get().switchScene(next)) return false
    }

    const { adventure, cache, dirty, previousSceneId } = get()
    if (adventure === null) return false
    const nextCache: Record<string, SceneSlot> = {}
    const nextDirty: Record<string, true> = { ...dirty }
    delete nextDirty[sceneId]
    for (const [id, slot] of Object.entries(cache)) {
      if (id === sceneId) continue
      const unlinked = slot.status === 'ok' ? withoutLinksTo(slot, sceneId) : null
      if (slot.status !== 'ok' || unlinked === null) {
        nextCache[id] = slot
        continue
      }
      nextCache[id] = { ...slot, ...unlinked }
      if (unlinked.map !== slot.map) nextDirty[id] = true
    }
    const scenes = removeSceneKeepingInside(adventure.scenes, sceneId)
    set({
      adventure: { ...adventure, scenes, startSceneId: adventure.startSceneId === sceneId ? scenes[0].id : adventure.startSceneId },
      cache: nextCache,
      dirty: nextDirty,
      previousSceneId: previousSceneId === sceneId ? null : previousSceneId,
      structureDirty: true,
    })
    // A cena aberta perde a ligação no mapa e no desfazer juntos, sem
    // `withHistory`: apagar a cena não é um passo para o Ctrl+Z desta.
    const { map, past, future } = useMapStore.getState()
    const openUnlinked = withoutLinksTo({ map, past, future }, sceneId)
    if (openUnlinked !== null) useMapStore.setState(openUnlinked)
    return true
  },

  shiftScene: (sceneId, delta) => {
    const { adventure } = get()
    if (adventure === null) return false
    const scenes = shiftSceneAmongSiblings(adventure.scenes, sceneId, delta)
    if (scenes === null) return false
    set({ adventure: { ...adventure, scenes }, structureDirty: true })
    return true
  },

  moveScene: (sceneId, parentId) => {
    const { adventure } = get()
    if (adventure === null) return false
    const scenes = nestScene(adventure.scenes, sceneId, parentId)
    if (scenes === null) return false
    set({ adventure: { ...adventure, scenes }, structureDirty: true })
    return true
  },

  setScenePublicName: (sceneId, publicName) => {
    const { adventure } = get()
    if (adventure === null) return
    const current = adventure.scenes.find((entry) => entry.id === sceneId)
    if (current === undefined) return
    const next = withPublicSceneName(current, publicName)
    // Mesmo nome de antes: nada a gravar (o "Renomear" manda os dois nomes sempre).
    if (next.publicName === current.publicName) return
    set({
      adventure: { ...adventure, scenes: adventure.scenes.map((entry) => (entry.id === sceneId ? next : entry)) },
      structureDirty: true,
    })
  },

  setScenePlanKnown: (sceneId, known) => {
    const { adventure } = get()
    if (adventure === null || !adventure.scenes.some((entry) => entry.id === sceneId)) return
    set({
      adventure: {
        ...adventure,
        scenes: adventure.scenes.map((entry): SceneEntry => {
          if (entry.id !== sceneId) return entry
          // Desligada, a entrada volta sem o campo: o arquivo fica igual ao de antes.
          const plain = { id: entry.id, name: entry.name, file: entry.file }
          return known ? { ...plain, planKnownByAll: true } : plain
        }),
      },
      structureDirty: true,
    })
  },

  setAgenda: (agenda) => {
    const { adventure } = get()
    if (adventure === null) return false
    set({ adventure: { ...adventure, agenda }, structureDirty: true })
    return true
  },

  switchScene: (sceneId, focus) => {
    const { activeSceneId, cache, dirty } = get()
    if (activeSceneId === null || sceneId === activeSceneId) return false
    const target = cache[sceneId]
    if (target === undefined || target.status !== 'ok') return false

    // A câmera da cena que sai fica com ela: voltar a essa cena devolve a vista de onde se saiu.
    const { map, past, future, camera } = useMapStore.getState()
    const leavingDirty = useSessionStore.getState().isDirty || dirty[activeSceneId] === true
    const nextCache: Record<string, SceneSlot> = { ...cache, [activeSceneId]: { status: 'ok', map, past, future, camera } }
    delete nextCache[sceneId]
    const nextDirty: Record<string, true> = { ...dirty }
    if (leavingDirty) nextDirty[activeSceneId] = true

    set({
      cache: nextCache,
      dirty: nextDirty,
      activeSceneId: sceneId,
      previousSceneId: activeSceneId,
      // Cena nunca vista nesta sessão (camera null) é enquadrada pelo canvas.
      // Chegada por pino: a câmera centraliza o pino par, no zoom da cena.
      cameraRequest: focus === undefined ? { camera: target.camera } : { camera: target.camera, focus },
    })
    showInEditor(target.map, target.past, target.future)
    return true
  },

  goToPoint: (sceneId, point, fit) => {
    if (sceneId === null || sceneId === get().activeSceneId) {
      // `camera: null` com `focus`: o canvas centra no ponto com o zoom de agora
      // (menor só se `fit` não couber).
      set({ cameraRequest: fit === undefined ? { camera: null, focus: point } : { camera: null, focus: point, fit } })
      return true
    }
    return get().switchScene(sceneId, point)
  },

  goToPin: (sceneId, pinId) => {
    const scene = pinScenesOf(get(), useMapStore.getState().map).find((s) => s.sceneId === sceneId)
    const pin = scene?.pins.find((p) => p.id === pinId)
    if (pin === undefined) return false
    // PISOS NA MESMA CENA: pino de outro piso estaria selecionado e invisível.
    if (!get().goToPointNoPiso(sceneId, pinFocusPoint(pin), pisoDe(pin))) return false
    // Depois da troca de cena e de piso: as duas limpam a seleção.
    useMapStore.getState().setSelectedPin(pinId)
    return true
  },

  goToPointNoPiso: (sceneId, point, piso) => {
    if (!get().goToPoint(sceneId, point)) return false
    // Depois da troca de cena: `loadMap` acabou de pôr o térreo.
    useMapStore.getState().setPisoAtivo(piso)
    return true
  },

  updateBackgroundScene: (sceneId, updater) => {
    const { cache, dirty } = get()
    const slot = cache[sceneId]
    if (slot !== undefined && slot.status === 'carregando') {
      // Ainda vindo do disco: a mudança espera o mapa chegar (`arrivedScenes`).
      set({ cache: { ...cache, [sceneId]: { status: 'carregando', pending: [...slot.pending, updater] } } })
      return
    }
    if (slot === undefined || slot.status !== 'ok') return
    const map = updater(slot.map)
    if (map === slot.map) return
    set({ cache: { ...cache, [sceneId]: { ...slot, map } }, dirty: { ...dirty, [sceneId]: true } })
  },

  applyPlayerChangeToBackgroundScene: (sceneId, transform) => {
    const { cache, dirty } = get()
    const slot = cache[sceneId]
    if (slot === undefined || slot.status !== 'ok') return
    const map = transform(slot.map)
    if (map === slot.map) return
    const past = slot.past.map(transform)
    const future = slot.future.map(transform)
    set({ cache: { ...cache, [sceneId]: { ...slot, map, past, future } }, dirty: { ...dirty, [sceneId]: true } })
  },

  criarEstadoDoMundo: (nome, valores) => {
    const { adventure } = get()
    if (adventure === null) return null
    const estado = novoEstadoDoMundo(nome, valores)
    if (estado === null) return null
    set({ adventure: { ...adventure, estados: [...(adventure.estados ?? []), estado] }, structureDirty: true })
    return estado.id
  },

  trocarEstadoDoMundo: (estadoId, valor, fixas) => {
    const { adventure, activeSceneId, cache } = get()
    // Aventura aberta sempre tem cena aberta (`open`, `createScene`): sem ela não há onde tocar.
    if (adventure === null || activeSceneId === null) return null
    const estados = comValorAtual(adventure.estados ?? [], estadoId, valor)
    if (estados === null) return null
    // Conta e planeja ANTES de aplicar: depois, cada elemento já está no efeito e a conta daria zero.
    const cenas = cenasCarregadas(activeSceneId, useMapStore.getState().map, cache)
    const movimentos = planejarRotina(cenas, estadoId, valor, fixas)
    const mexidas = new Set(movimentos.flatMap((m) => [m.de, m.para]))
    const porCena = cenas.map((cena) => contarMudancas(cena.map, estadoId, valor))
    const cenasMudadas = cenas.filter((cena, i) => porCena[i] > 0 || mexidas.has(cena.sceneId)).length
    const resumo: ResumoDaTroca = {
      elementos: porCena.reduce((soma, n) => soma + n, 0),
      cenas: cenasMudadas,
      ...(movimentos.length === 0 ? {} : { fichas: movimentos.length }),
    }
    // Id de ficha é único na aventura: o mesmo `transform` serve a toda cena.
    const transform = (map: MapData) => moverNaCena(aplicarEstadoNoMapa(map, estadoId, valor), movimentos)
    useMapStore.getState().applyPlayerChange(transform)
    for (const sceneId of Object.keys(cache)) get().applyPlayerChangeToBackgroundScene(sceneId, transform)
    for (const m of movimentos) {
      if (m.de === m.para || !get().transferToken(m.tokenId, m.de, m.para, m.x, m.y) || m.de !== activeSceneId) continue
      // Saiu da cena aberta: a seleção não pode apontar para ela (o mesmo cuidado de `carryToken`).
      const item: SelectionItem = { kind: 'token', id: m.tokenId }
      const { selection, setSelection } = useMapStore.getState()
      if (selectionHas(selection, item)) setSelection(removeSelectionItem(selection, item))
    }
    set({ adventure: { ...adventure, estados }, structureDirty: true })
    return resumo
  },

  amarrarAoEstado: (amarra) => {
    const estadoId = amarra.regra?.estadoId
    const estado = estadoId === undefined ? undefined : get().adventure?.estados?.find((e) => e.id === estadoId)
    useMapStore.getState().amarrarAoEstado(amarra, estado === undefined ? null : estado.atual)
  },

  criarCabine: (nome, pinId) => {
    const { adventure, activeSceneId } = get()
    if (adventure === null || activeSceneId === null) return null
    const pin = useMapStore.getState().map.pins.find((p) => p.id === pinId)
    if (pin === undefined || pin.kind !== 'viagem') return null
    const parada = { sceneId: activeSceneId, pinId }
    const cabine = novaCabine(nome, parada)
    if (cabine === null) return null
    // O pino que já era parada de outra cabine sai dela: uma parada, uma cabine.
    const antes = adventure.cabines ?? []
    const semEla = comParada(antes, parada, null) ?? antes
    set({ adventure: { ...adventure, cabines: [...semEla, cabine] }, structureDirty: true })
    return cabine.id
  },

  definirParadaDeCabine: (pinId, cabineId) => {
    const { adventure, activeSceneId } = get()
    if (adventure === null || activeSceneId === null) return false
    const cabines = comParada(adventure.cabines ?? [], { sceneId: activeSceneId, pinId }, cabineId)
    if (cabines === null) return false
    set({ adventure: { ...adventure, cabines }, structureDirty: true })
    return true
  },

  moverCabine: (cabineId, parada) => {
    const { adventure } = get()
    if (adventure === null) return false
    const cabines = comCabineEm(adventure.cabines ?? [], cabineId, parada)
    if (cabines === null) return false
    set({ adventure: { ...adventure, cabines }, structureDirty: true })
    return true
  },

  chamarCabine: ({ cabineId, chamada }) => {
    const { adventure } = get()
    if (adventure === null) return false
    const cabines = comChamada(adventure.cabines ?? [], cabineId, chamada)
    if (cabines === null) return false
    set({ adventure: { ...adventure, cabines }, structureDirty: true })
    return true
  },

  atenderChamada: (cabineId) => {
    const { adventure } = get()
    if (adventure === null) return false
    const proxima = proximaChamada(adventure.cabines ?? [], cabineId)
    return proxima === null ? false : get().moverCabine(cabineId, proxima.parada)
  },

  limparFilaDaCabine: (cabineId) => {
    const { adventure } = get()
    if (adventure === null) return false
    const cabines = semFila(adventure.cabines ?? [], cabineId)
    if (cabines === null) return false
    set({ adventure: { ...adventure, cabines }, structureDirty: true })
    return true
  },

  linkPinToNewArrival: (pinId, sceneId, exitId = SAIDA_PRINCIPAL) => {
    const { activeSceneId, cache } = get()
    const live = useMapStore.getState().map
    const pin = live.pins.find((p) => p.id === pinId)
    if (pin === undefined || pin.kind !== 'viagem' || activeSceneId === null) return null
    if (sceneId === activeSceneId) {
      // ATALHO NA MESMA CENA: a chegada nasce ao lado do pino, e a chegada e
      // as duas pontas da ligação entram num passo só do desfazer.
      const chegada = mapFactory.buildPin(crypto.randomUUID(), nearbyArrivalPoint(live, pin), 'viagem')
      const comChegada = mapFactory.addPin(live, chegada)
      const ligado = linkWithinScene(comChegada, activeSceneId, pinId, exitId, chegada.id, newExitId())
      if (ligado === comChegada) return null
      useMapStore.getState().replacePins(ligado.pins)
      return chegada.id
    }
    const slot = cache[sceneId]
    if (slot === undefined || slot.status !== 'ok') return null
    // A chegada nasce SEM destino: quem grava a volta é o guardião, quando a
    // ida é gravada logo abaixo — o mesmo caminho do desfazer e do refazer.
    const arrival = mapFactory.buildPin(crypto.randomUUID(), arrivalPoint(slot.map), 'viagem')
    get().updateBackgroundScene(sceneId, (map) => mapFactory.addPin(map, arrival))
    useMapStore.getState().updatePin(pinId, exitPatchFor(pin, exitId, { sceneId, pinId: arrival.id }))
    return arrival.id
  },

  // A escada par nasce com a boca no centro livre do outro andar, para o
  // mestre achar e arrastar — o mesmo lugar da chegada de um pino novo.
  linkStairToFloor: (stairId, sceneId, passagem) => linkStairAt(get, stairId, sceneId, passagem, arrivalPoint),

  createFloorFromStair: (stairId, passagem) => {
    const state = get()
    const live = useMapStore.getState().map
    const stair = live.stairs.find((s) => s.id === stairId)
    const mouth = stair === undefined ? null : stairMouth(stair)
    // Só dentro de uma aventura: é ela que tem "outro andar" (a seção nem aparece no mapa solto).
    if (stair === undefined || mouth === null || state.adventure === null || state.activeSceneId === null) return null
    const building = buildingOfStair(live, stair)
    const openName = state.adventure.scenes.find((entry) => entry.id === state.activeSceneId)?.name ?? live.name
    const base = building?.room !== undefined && building.room.name.trim().length > 0 ? building.room.name : openName
    const { id, patch } = withEmptyScene(state, live, newFloorName(base, floorSideOf(stair.direction)), null, true)
    set(patch)
    if (building !== null) get().updateBackgroundScene(id, (map) => withBuildingContour(map, live, building, () => crypto.randomUUID()))
    // A escada par no MESMO ponto: o contorno é o mesmo, então quem sobe chega onde estava.
    // Sem `switchScene`: o mestre continua no andar dele, com a escada no painel.
    return linkStairAt(get, stairId, id, passagem, () => mouth) === null ? null : id
  },

  unlinkStair: (stairId) => {
    const pin = stairPinOf(useMapStore.getState().map, stairId)
    if (pin !== undefined) useMapStore.getState().removePin(pin.id)
  },

  setStairPassage: (stairId, passagem) => {
    const pin = stairPinOf(useMapStore.getState().map, stairId)
    if (pin !== undefined) useMapStore.getState().updatePin(pin.id, { passagem })
  },

  linkPinToExisting: (pinId, sceneId, partnerId, exitId = SAIDA_PRINCIPAL) => {
    const { activeSceneId, cache } = get()
    const live = useMapStore.getState().map
    const pin = live.pins.find((p) => p.id === pinId)
    if (pin === undefined || pin.kind !== 'viagem' || activeSceneId === null) return false
    if (sceneId === activeSceneId) {
      // ATALHO NA MESMA CENA: as duas pontas no mapa aberto, num passo só.
      const ligado = linkWithinScene(live, activeSceneId, pinId, exitId, partnerId, newExitId())
      if (ligado === live) return false
      useMapStore.getState().replacePins(ligado.pins)
      return true
    }
    const slot = cache[sceneId]
    if (slot === undefined || slot.status !== 'ok') return false
    const partner = slot.map.pins.find((p) => p.id === partnerId)
    if (partner === undefined || partner.kind !== 'viagem') return false
    const destino: PinDestination = { sceneId, pinId: partnerId }
    // Um par, uma volta: outro pino DESTA cena (ou outra saída deste mesmo)
    // que chegava no mesmo par perde a ligação antes — senão dois caminhos
    // daqui levariam ao lugar que só traz um de volta.
    for (const other of live.pins) {
      for (const saida of travelExitsOf(other)) {
        if (!sameDestination(saida.destino, destino)) continue
        if (other.id === pinId && saida.id === exitId) continue
        const atual = useMapStore.getState().map.pins.find((p) => p.id === other.id)
        if (atual !== undefined) useMapStore.getState().updatePin(other.id, setExitDestination(atual, saida.id, null))
      }
    }
    const atual = useMapStore.getState().map.pins.find((p) => p.id === pinId)
    if (atual === undefined) return false
    // A saída desta ligação pode ter mudado de id acima (a principal
    // desligada e uma extra subindo no lugar): quem ainda não existe vira nova.
    const alvo = exitId !== null && exitId !== SAIDA_PRINCIPAL && !(atual.saidas ?? []).some((s) => s.id === exitId) ? null : exitId
    useMapStore.getState().updatePin(pinId, exitPatchFor(atual, alvo, destino))
    return true
  },

  unlinkPin: (pinId, exitId = SAIDA_PRINCIPAL) => {
    const live = useMapStore.getState().map
    const pin = live.pins.find((p) => p.id === pinId)
    if (pin === undefined) return
    const activeSceneId = get().activeSceneId
    if (activeSceneId !== null && travelExitOf(pin, exitId)?.destino.sceneId === activeSceneId) {
      // ATALHO NA MESMA CENA: o par mora aqui, e perde a volta no mesmo passo.
      useMapStore.getState().replacePins(unlinkWithinScene(live, activeSceneId, pinId, exitId).pins)
      return
    }
    useMapStore.getState().updatePin(pinId, setExitDestination(pin, exitId, null))
  },

  renamePinExit: (pinId, exitId, rotulo) => {
    const pin = useMapStore.getState().map.pins.find((p) => p.id === pinId)
    if (pin === undefined) return
    useMapStore.getState().updatePin(pinId, renameExit(pin, exitId, rotulo))
  },

  setPinOneWay: (pinId, exitId, on) => {
    const live = useMapStore.getState().map
    const pin = live.pins.find((p) => p.id === pinId)
    if (pin === undefined) return false
    const travel = resolvePinTravel(pin, get().activeSceneId, sceneLookup(get(), live), exitId)
    if (travel.status !== 'ligado') return false
    if (on && travelExitsOf(travel.partner).length > 1) return false
    const partnerId = travel.partner.id
    if (travel.sameScene === true) {
      // O par mora no mapa aberto: a marca entra no desfazer desta cena.
      useMapStore.getState().replacePins(setArrivalOnly(live, partnerId, on).pins)
      return true
    }
    get().updateBackgroundScene(travel.sceneId, (map) => setArrivalOnly(map, partnerId, on))
    return true
  },

  setPassageBothSides: (pinId, trancar) => {
    const live = useMapStore.getState().map
    const pin = live.pins.find((p) => p.id === pinId)
    if (pin === undefined) return false
    const lookup = sceneLookup(get(), live)
    const pares = travelExitsOf(pin).flatMap((saida) => {
      const travel = resolvePinTravel(pin, get().activeSceneId, lookup, saida.id)
      return travel.status === 'ligado' ? [{ sceneId: travel.sceneId, pinId: travel.partner.id }] : []
    })
    if (pares.length === 0) return false
    const passagem: PinPassage = trancar ? 'trancada' : 'pede'
    // Trancar leva o motivo deste lado ("Desabou") ao outro: o que fechou a
    // passagem fechou as duas pontas. Destrancar não mexe no motivo, que fica
    // guardado para a próxima vez, como no painel.
    const patchDoPar = trancar ? { passagem, motivo: pin.motivo } : { passagem }
    for (const par of pares) get().updateBackgroundScene(par.sceneId, (map) => mapFactory.updatePin(map, par.pinId, patchDoPar))
    useMapStore.getState().updatePin(pinId, { passagem })
    return true
  },

  travelThroughPin: (pinId, exitId = SAIDA_PRINCIPAL) => {
    const live = useMapStore.getState().map
    const pin = live.pins.find((p) => p.id === pinId)
    if (pin === undefined) return false
    // Chegada oculta não leva de volta, nem para o mestre: o clique nela só
    // a seleciona, como o de um marcador.
    if (isArrivalOnly(pin)) return false
    const travel = resolvePinTravel(pin, get().activeSceneId, sceneLookup(get(), live), exitId)
    if (travel.status !== 'ligado') return false
    // Atalho na mesma cena: sem troca de cena, a câmera vai até o par.
    if (travel.sameScene === true) get().goToPoint(null, pinFocusPoint(travel.partner))
    else if (!get().switchScene(travel.sceneId, pinFocusPoint(travel.partner))) return false
    // O par aberto no painel: é ele que diz "leva de volta a …" e é nele que
    // o próximo clique atravessa de volta.
    useMapStore.getState().setSelectedPin(travel.partner.id)
    return true
  },

  transferToken: (tokenId, fromSceneId, toSceneId, x, y, piso) => {
    const { activeSceneId, cache, dirty } = get()
    if (activeSceneId === null || fromSceneId === toSceneId) return false
    const read = (sceneId: string): SceneHistory | null => {
      if (sceneId === activeSceneId) {
        const { map, past, future } = useMapStore.getState()
        return { map, past, future }
      }
      const slot = cache[sceneId]
      return slot !== undefined && slot.status === 'ok' ? { map: slot.map, past: slot.past, future: slot.future } : null
    }
    const from = read(fromSceneId)
    const to = read(toSceneId)
    const token = from?.map.tokens.find((t) => t.id === tokenId)
    if (from === null || to === null || token === undefined) return false

    // VEÍCULO: quem está a bordo atravessa junto e chega ainda a bordo (os
    // ids de quem viaja não mudam). Cada um no afastamento que tinha em volta
    // dele, quando a casa serve; senão, na casa livre mais perto do veículo —
    // nunca fora do mapa nem do outro lado de uma parede. PISOS: todos chegam
    // no piso do veículo, e só a planta desse piso barra (`mapaDoPiso`).
    const riders = passengersOf(from.map, tokenId)
    const seats = vehicleRiderSpots(
      mapaDoPiso(to.map, piso ?? 0),
      { x, y, size: tokenSizeInSquares(token) },
      riders.map((p) => ({ dx: p.x - token.x, dy: p.y - token.y, size: tokenSizeInSquares(p) })),
    )
    const arrive = (t: Token, at: Point): Token => comPiso({ ...arrivingLink(t, to.map), x: at.x, y: at.y }, piso)
    const travelers: Token[] = [arrive(token, { x, y }), ...riders.map((p, index) => arrive(p, seats[index]))]
    const leaving = travelers.reduce((history, traveler) => withoutToken(history, traveler.id), from)
    const { history: arriving, renamedResidents } = withTokens(to, travelers)
    const nextCache: Record<string, SceneSlot> = { ...cache }
    const nextDirty: Record<string, true> = { ...dirty }
    let openScene: SceneHistory | null = null
    for (const [sceneId, history] of [
      [fromSceneId, leaving],
      [toSceneId, arriving],
    ] as const) {
      if (sceneId === activeSceneId) {
        openScene = history
        continue
      }
      const slot = cache[sceneId]
      if (slot === undefined || slot.status !== 'ok') return false
      nextCache[sceneId] = { ...slot, ...history }
      nextDirty[sceneId] = true
    }
    set({ cache: nextCache, dirty: nextDirty })
    // A cena aberta troca mapa E histórico juntos, sem `withHistory`: a
    // travessia não é um passo do mestre para o Ctrl+Z desfazer.
    if (openScene !== null) useMapStore.setState({ map: openScene.map, past: openScene.past, future: openScene.future })
    for (const [travelerId, residentId] of renamedResidents) renameResidentOutsideMap(to.map.id, travelerId, residentId, toSceneId === activeSceneId)
    return true
  },

  carryToken: (tokenId, toSceneId, pinId) => {
    const { adventure, activeSceneId, cache } = get()
    if (adventure === null || activeSceneId === null) return null
    const entry = adventure.scenes.find((scene) => scene.id === toSceneId)
    const slot = cache[toSceneId]
    if (entry === undefined || slot === undefined || slot.status !== 'ok') return null
    const token = useMapStore.getState().map.tokens.find((t) => t.id === tokenId)
    if (token === undefined) return null
    const pin = pinId === null ? null : slot.map.pins.find((p) => p.id === pinId && p.kind === 'viagem')
    // Pino que sumiu entre abrir o painel e confirmar: não chega em outro lugar calado.
    if (pin === undefined) return null
    // O mesmo assento de quem atravessa pelo "Mandar para…" (`hostSession.sendPlayer`).
    const spot = pin === null ? arrivalPoint(slot.map) : arrivalSpot(slot.map, pin, token.size)
    if (!get().transferToken(tokenId, activeSceneId, toSceneId, spot.x, spot.y, pin?.piso)) return null
    // A ficha já não está no mapa aberto: a seleção não pode apontar para ela.
    const item: SelectionItem = { kind: 'token', id: tokenId }
    const { selection, setSelection } = useMapStore.getState()
    if (selectionHas(selection, item)) setSelection(removeSelectionItem(selection, item))
    return { tokenName: token.name, sceneId: toSceneId, sceneName: entry.name, x: spot.x, y: spot.y, ...(pin === null || pisoDe(pin) === 0 ? {} : { piso: pisoDe(pin) }) }
  },

  hasPendingScenes: () => {
    const { adventure, cache, dirty, structureDirty } = get()
    // Mudança esperando uma cena que ainda está vindo do disco também é trabalho não salvo.
    const waiting = Object.values(cache).some((slot) => slot.status === 'carregando' && slot.pending.length > 0)
    return adventure !== null && (structureDirty || waiting || Object.keys(dirty).length > 0)
  },

  flush: async (stored = []) => {
    const state = get()
    const { adventure, activeSceneId } = state
    if (adventure === null || activeSceneId === null) throw new Error('Não há aventura aberta para gravar.')

    let dir = state.dir
    if (dir === null) {
      if (state.rootPath !== null) dir = await dirname(state.rootPath)
      else if (state.rootMapId !== null) dir = await mapDirFor(state.rootMapId)
      else throw new Error('A aventura não tem pasta para gravar.')
    }

    const live = useMapStore.getState().map
    const writes: { file: string; map: MapData }[] = []
    /** Cena → mapa exato que foi para o disco. */
    const written = new Map<string, MapData>()
    const scenes = { ids: new Set(adventure.scenes.map((entry) => entry.id)), activeId: activeSceneId }
    // A ficha guardada saiu do mapa do editor, mas não do arquivo.
    const forDisk = (sceneId: string, map: MapData) => withStoredTokens(map, storedTokensOfScene(stored, sceneId, scenes))
    let activeFile: string | null = null
    for (const entry of adventure.scenes) {
      if (entry.id === activeSceneId) {
        activeFile = entry.file
        writes.push({ file: entry.file, map: forDisk(entry.id, live) })
        written.set(entry.id, live)
        continue
      }
      const slot = state.cache[entry.id]
      if (slot !== undefined && slot.status === 'ok' && state.dirty[entry.id] === true) {
        writes.push({ file: entry.file, map: forDisk(entry.id, slot.map) })
        written.set(entry.id, slot.map)
      }
    }
    if (activeFile === null) throw new Error('A cena aberta não está na lista da aventura.')

    await saveAdventureToDisk(dir, adventure, writes)

    // O editor não trava enquanto o disco grava: só sai de "pendente" o que
    // continua IGUAL (mesma referência) ao que foi escrito. Mudança feita no
    // meio — cena de fundo, cena aberta, nome ou cena nova — fica pendente.
    // Isso inclui a cena de fundo que chegou do disco durante a gravação com
    // mudança esperando por ela, e a cena nova do portal antigo que veio junto.
    const after = get()
    // Outra aventura (ou mapa solto) entrou no meio: o estado já não é desta gravação.
    if (after.adventure === null || after.adventure.id !== adventure.id) return scenePath(dir, activeFile)
    const nowOf = (sceneId: string): MapData | undefined => {
      if (sceneId === after.activeSceneId) return useMapStore.getState().map
      const slot = after.cache[sceneId]
      return slot !== undefined && slot.status === 'ok' ? slot.map : undefined
    }
    const dirty: Record<string, true> = {}
    for (const sceneId of Object.keys(after.dirty)) {
      const sent = written.get(sceneId)
      // Pendente antes e não escrito = não tinha o que escrever (cena fora do ar): sai, como sempre saiu.
      // Cena "carregando" nunca está em `dirty` (a mudança dela espera em `pending`); a que chega
      // durante a gravação entra em `dirty` só agora, e por isso continua pendente.
      if (sent === undefined ? state.dirty[sceneId] !== true : nowOf(sceneId) !== sent) dirty[sceneId] = true
    }
    // A lista gravada é a de antes do `await`: se ela mudou, a nova ainda não foi.
    set({ dir, rootPath: null, rootMapId: null, dirty, structureDirty: after.structureDirty && after.adventure !== adventure })
    const activeSent = after.activeSceneId === null ? undefined : written.get(after.activeSceneId)
    if (activeSent !== undefined) useSessionStore.getState().markSaved(activeSent)
    return scenePath(dir, activeFile)
  },
}))

/** Leitura síncrona para quem pergunta "há trabalho não salvo?" (fechar janela, trocar de mapa). */
export function hasUnsavedWork(): boolean {
  return useSessionStore.getState().isDirty || useAdventureStore.getState().hasPendingScenes()
}

/**
 * GUARDIÃO DA MÃO DUPLA do pino de viagem.
 *
 * O mestre só edita a cena ABERTA; o par de um pino de viagem mora sempre em
 * OUTRA cena. Então toda mudança de ligação vista aqui — ligar, desligar,
 * religar, apagar o pino, deixar de ser viagem, e também o Ctrl+Z e o Ctrl+Y
 * de qualquer uma delas — é espelhada no par, na cena de fundo, por
 * `updateBackgroundScene`: fora do desfazer da cena aberta, como toda mudança
 * de cena de fundo. Um lugar só, em vez de um remendo em cada botão, atalho e
 * borracha que tira pino do mapa.
 *
 * ATALHO NA MESMA CENA: aí o par mora no mapa aberto. Ligar e desligar pelo
 * painel já gravam os dois lados (`linkWithinScene`, `unlinkWithinScene`);
 * o que sobra — apagar a origem, ela deixar de ser de viagem, religá-la a
 * outra cena — o guardião desliga no par, no MESMO passo de desfazer.
 *
 * Só olha EDIÇÃO: troca de cena (`sceneLoading`) e mapa de outro id (abrir,
 * criar) não são mudança de pino, são outro mapa entrando.
 *
 * Liga-se UMA VEZ, na raiz do app, como `subscribeToDirtyFlag`:
 * `useEffect(() => subscribeToTravelLinks(), [])`. Devolve o cancelamento.
 */
export function subscribeToTravelLinks(): () => void {
  return useMapStore.subscribe((state) => state.map, syncTravelLinks)
}

function syncTravelLinks(after: MapData, before: MapData): void {
  if (sceneLoading || after.pins === before.pins || after.id !== before.id) return
  const { adventure, activeSceneId } = useAdventureStore.getState()
  if (adventure === null || activeSceneId === null) return
  // ATALHO NA MESMA CENA: o par antigo mora neste mesmo mapa. Os acertos daqui
  // se juntam e entram no passo de desfazer que os provocou (`settlePins`).
  let mesmaCena = after
  for (const change of travelLinkChanges(before.pins, after.pins)) {
    const daqui: PinDestination = { sceneId: activeSceneId, pinId: change.pinId }
    // O par antigo, se ainda voltava para cá, fica sem destino — e, se era a
    // chegada oculta de uma mão única, volta a ser um pino comum.
    if (change.before !== null && change.before.sceneId === activeSceneId) {
      mesmaCena = unlinkBack(mesmaCena, change.before.pinId, daqui)
    } else if (change.before !== null) {
      const antigo = change.before
      useAdventureStore.getState().updateBackgroundScene(antigo.sceneId, (map) => unlinkBack(map, antigo.pinId, daqui))
    }
    // O par novo passa a voltar para cá — e quem ele trazia antes perde a volta.
    if (change.after !== null && change.after.sceneId !== activeSceneId) {
      const novo = change.after
      const slot = useAdventureStore.getState().cache[novo.sceneId]
      if (slot !== undefined && slot.status === 'carregando') {
        // O par ainda vem do disco: a volta é gravada quando ele chega. Quem
        // ele trazia antes só se sabe então — o desligamento desse vai numa
        // microtarefa, depois que a chegada (`arrivedScenes`) entrar no store.
        useAdventureStore.getState().updateBackgroundScene(novo.sceneId, (chegou) => {
          const ligado = linkBack(chegou, novo.pinId, daqui)
          const antigo = ligado.displaced
          if (antigo !== null && antigo.sceneId !== activeSceneId) {
            queueMicrotask(() => useAdventureStore.getState().updateBackgroundScene(antigo.sceneId, (outro) => unlinkBack(outro, antigo.pinId, novo)))
          }
          return ligado.map
        })
        continue
      }
      if (slot === undefined || slot.status !== 'ok') continue
      const { map, displaced } = linkBack(slot.map, novo.pinId, daqui)
      useAdventureStore.getState().updateBackgroundScene(novo.sceneId, () => map)
      if (displaced !== null && displaced.sceneId !== activeSceneId) {
        useAdventureStore.getState().updateBackgroundScene(displaced.sceneId, (outro) => unlinkBack(outro, displaced.pinId, novo))
      }
    }
  }
  // Nada a acertar devolve o MESMO mapa (`unlinkBack` não mexe em quem já foi
  // desligado): o desfazer, o refazer e o `linkWithinScene`, que já gravam os
  // dois lados, passam por aqui sem mudança.
  if (mesmaCena !== after) useMapStore.getState().settlePins(mesmaCena.pins)
}

/**
 * ITEM PEGÁVEL: grava a troca de lugar de um item (pino que sai ou volta,
 * mochilas novas) na cena `change.sceneId` — a aberta no editor quando
 * ausente ou quando é a própria cena aberta (o mestre pode ter trocado de
 * cena entre a decisão e aqui).
 *
 * Vale para TODO passo do desfazer da cena, aberta OU de fundo, como a
 * travessia do `transferToken`: gravar só o mapa atual deixaria o `past` com a
 * chave no chão, e um Ctrl+Z do mestre depois a devolveria ao mapa ainda na
 * mochila de alguém (duplica) ou a tiraria da mochila (some). Também não é um
 * passo do desfazer: não foi uma edição do mapa. `false` quando a cena não
 * está disponível.
 */
export function applyItemsInScene(change: AppliedItems): boolean {
  const aplicar = (map: MapData): MapData => applyItemChange(map, change)
  const { activeSceneId, cache, dirty } = useAdventureStore.getState()
  if (change.sceneId === undefined || change.sceneId === activeSceneId) {
    const { map, past, future } = useMapStore.getState()
    useMapStore.setState({ map: aplicar(map), past: past.map(aplicar), future: future.map(aplicar) })
    return true
  }
  const slot = cache[change.sceneId]
  if (slot === undefined || slot.status !== 'ok') return false
  useAdventureStore.setState({
    cache: { ...cache, [change.sceneId]: { ...slot, map: aplicar(slot.map), past: slot.past.map(aplicar), future: slot.future.map(aplicar) } },
    dirty: { ...dirty, [change.sceneId]: true },
  })
  return true
}
