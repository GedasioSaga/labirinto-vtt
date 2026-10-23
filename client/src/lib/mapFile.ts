import type { ConcealZone, DoorState, FloorStyle, LayerId, Light, MapData, Pin, Prop, Region, Token } from '../types/map'
import { LAYER_IDS } from '../types/map'
import { parseTransicao } from '../transicoes/catalogo'
import { parseCenario } from '../cenario/catalogo'
import { idDeAnimacaoDePortaValido } from '../portas/animacoesDePorta'
import { readMoedas } from './troca'
import { isEfeitoNaLuz, isEfeitoNaPorta, isEfeitoNaZona, regraDePinoDoArquivo, regraDoArquivo } from './estadoDoMundo'
import { propPlayerImage, propPlayerLabel } from './propPlayerLook'
import { readDoorKey } from './doorKey'
import { closeIfLocked } from './doorLock'
import { lerMarcasDoArquivo } from './marcas'
import { readTokenVehicle, withoutVehicleField } from './vehicle'
import { linkLooseWallsToRooms } from './roomLink'
import {
  cleanPinName,
  isPinBlockReason,
  isPinIcon,
  isPinKind,
  isPinEscala,
  isPinPassage,
  isPinReadDistance,
  minigamePadrao,
  normalizarCorDoPino,
} from './pins'
import {
  DIFICULDADES_DANCA,
  FALA_MAX_LENGTH,
  LETRAS_DANCA,
  MINIGAME_PADRAO,
  NPC_MAX_LENGTH,
  PREMIO_TEXTO_MAX_LENGTH,
  type ConsequenciaDanca,
  type DificuldadeDanca,
  type MinigameDanca,
  type MusicaDaDanca,
  type NotaDaDanca,
  type PremioDanca,
  type TrilhaDanca,
} from '../minigames/danca/tipos'
import {
  DIFICULDADES_PESCA,
  ENTRADAS_PESCA,
  LAGO_MAX_LENGTH,
  LANCES_MAX,
  LANCES_MIN,
  MINIGAME_PESCA_PADRAO,
  PESCA_TEXTO_MAX_LENGTH,
  type DificuldadePesca,
  type MinigamePesca,
} from '../minigames/pesca/tipos'
import type { MinigameDoPino } from '../minigames/tipos'
import { readPinLock } from './pinLock'
import { sanitizeRoomLabelStyle } from './roomLabelStyle'
import { MODELOS_DO_TETO, corDoTetoValida } from './telhado/paletas'
import { normalizarCorDaPorta } from './corDaPorta'
import { readPinColecao } from './colecao'
import { cleanExitLabel, readPinDestination, readPinExits } from './pinTravel'
import { readSceneVisionCells } from './sceneVision'
import { isDaVista } from './espiar'
import { tokenPublicNameFromFile } from './tokenPublicName'
import { readPinAttachment } from './pinAttach'
import { readMovementRules } from './movementRules'
import { readCarriedItems, readPinItem } from './items'
import { readPinPass } from './pinPass'
import { lerPenhascos } from './penhasco'
import { lerTexturas, lerTexturasImportadas } from './texturas'
import { lerCarimbos, lerCarimbosImportados } from './carimbos'
import { lerLojaDoArquivo } from './loja'
import { readHazards } from './hazards'
import { withoutContract, withoutLentMark } from './tokenLoan'
import { fichaComRotinaDoArquivo } from './rotinaDoNpc'
import { confrontoFromFile } from './confronto'
import { perigosFromFile } from './perigo'
import { propMobiliaFromFile } from './mobilia'
import { readPinLeverDoor } from './lever'
import { readAreaTriggers } from './areaTriggers'
import { readArrivalText } from './arrivalText'
import { pontosChaveDoArquivo } from './pontosChave'
import { paredesDoDesenhoDoArquivo, vinculosDeParedeDoArquivo } from './paredesPresas'
import { readSceneFloor } from './buildingFloors'
import { lerAlerta, lerFaccao } from './faccoes'
import { faceRangeCellsOrNull } from './tokenVulto'
import { pisosDoArquivo } from './pisos'
import { ocultasDoJogadorDoArquivo, opacidadesDoArquivo, semCamadaTorta, versaoDasCamadasDoArquivo } from './camadas/arquivo'
import { ehCamadaId } from './camadas/padrao'
import { readConveyors } from './conveyors'
import { pinWithCabin, readCabin } from './cabins'

/** Chão de mapa NOVO: marrom chapado do minimapa do Resident Evil 4 (15/09/2026). */
export const DEFAULT_FLOOR_STYLE: FloorStyle = { fillColor: '#a8776a', strokeColor: null, strokeWidth: 1 }

/**
 * Chão de mapa SALVO antes do campo `floorStyle` existir: o verde do minimapa
 * dos mapas de referência (`Objetivo/*.png`, cor dominante #006B00). Fica
 * separado do default novo para mapa antigo abrir igual a antes.
 */
export const LEGACY_FLOOR_STYLE: FloorStyle = { fillColor: '#006b00', strokeColor: null, strokeWidth: 1 }

export function serializeMap(map: MapData): string {
  // CAMADAS: `modeloCamadas` é cópia em memória do modelo da aventura (para o Ctrl+Z); não vai ao arquivo.
  if (map.modeloCamadas === undefined) return JSON.stringify(map, null, 2)
  const { modeloCamadas: _soEmMemoria, ...semModelo } = map
  return JSON.stringify(semModelo, null, 2)
}

export function deserializeMap(json: string): MapData {
  // PISOS NA MESMA CENA: `piso`/`levaAoPiso` tortos saem aqui (`lib/pisos.ts`); ausentes continuam ausentes.
  const map = pisosDoArquivo(deserializeMapFields(json))
  // PAREDES AO REDOR: parede presa a desenho que não existe (ou sem as paredes
  // ligadas) perde o vínculo e fica como parede comum (`lib/paredesPresas.ts`).
  // Mapa salvo antes de a porta manter o vínculo com a Sala: pedaços de parede
  // soltos sobre a aresta de uma Sala voltam a ser dela (`lib/roomLink.ts`).
  const walls = linkLooseWallsToRooms(map.regions, vinculosDeParedeDoArquivo(map.walls, map.drawings))
  return walls === map.walls ? map : { ...map, walls }
}

/**
 * Número que serve como dimensão de mapa. `map.json` editado à mão, truncado
 * ou de versão futura chega aqui com `grid: -8`, `grid: 0` ou `width: "30"` —
 * o `??` de antes aceitava os três, e a geometria impossível entrava no editor
 * em silêncio (célula negativa, divisão por zero virando `Infinity`, número de
 * texto contaminando todo cálculo de mundo). O valor impossível é DESCARTADO,
 * não recusado: o resto do mapa (salas, portas, escadas) continua abrindo, que
 * é o oposto de "o arquivo sumiu".
 */
function positiveNumberOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * Lista de entidades do mapa: o que não é lista (`regions: "nenhuma"`) vira
 * lista vazia e item que não é objeto (`walls: [null]`) sai fora. Sem isto o
 * `.map()` logo abaixo estoura `TypeError: Cannot read properties of null`
 * cru na tela, que para o usuário é igual a ter perdido o mapa.
 */
/**
 * A "Nota do mestre" do PINO saiu em 09/10/2026 (decisão do usuário: o dado é
 * apagado). Arquivo de antes traz a chave, e o `...p` do pino a copiaria crua
 * de volta para o mapa e para o próximo salvamento. A nota da SALA
 * (`RoomMeta.notaDoMestre`) é outro campo e continua.
 */
function semNotaDoMestre(pin: Pin): Pin {
  if (!Object.prototype.hasOwnProperty.call(pin, 'notaDoMestre')) return pin
  const copia = { ...pin }
  Reflect.deleteProperty(copia, 'notaDoMestre')
  return copia
}

function entityList<T>(value: T[] | undefined): T[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item !== null && typeof item === 'object')
}

const PREMIOS_DANCA: readonly PremioDanca[] = ['item', 'pista', 'bonus', 'nada']
const CONSEQUENCIAS_DANCA: readonly ConsequenciaDanca[] = ['teste', 'barulho', 'espera', 'nada']
const PERMITIDAS_DANCA: readonly ('escolha' | DificuldadeDanca)[] = ['escolha', ...DIFICULDADES_DANCA]
const PERMITIDAS_PESCA: readonly ('escolha' | DificuldadePesca)[] = ['escolha', ...DIFICULDADES_PESCA]
const TRILHAS_DANCA: readonly TrilhaDanca[] = [0, 1, 2, 3]
const SUBDIVISOES_DANCA: readonly NotaDaDanca['sub'][] = [4, 8, 16]
/** A batida que abre o compasso: uma das quatro. */
const FASES_DO_COMPASSO: readonly number[] = [0, 1, 2, 3]
/**
 * Teto do nome da música importada. `tipos.ts` não tem um e o nome é do
 * arquivo do mestre: o corte só impede que um nome gigante estoure o painel.
 * A consequência usa o teto do prêmio, que é o texto irmão dela no painel.
 */
const NOME_DA_MUSICA_MAX_LENGTH = 80
/**
 * A música importada mora na mídia da mesa: `midia:<64 hex minúsculos>.<ext>`
 * de áudio. Mesma forma de `lib/midia.ts` (que hoje só conhece imagem): nada
 * de caminho, URL ou texto solto chega ao jogador como endereço de música.
 */
const FORMA_DA_MUSICA_NA_MIDIA = /^midia:[0-9a-f]{64}\.(mp3|ogg|wav|m4a)$/

function ehObjetoDoArquivo(valor: unknown): valor is object {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function campoDoArquivo(objeto: object, chave: string): unknown {
  return Reflect.get(objeto, chave)
}

function ehNumeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

/** O valor, se for um da lista; `undefined` para o resto. */
function umDaLista<T>(lista: readonly T[], valor: unknown): T | undefined {
  return lista.find((item) => item === valor)
}

/** Texto aparado e no teto; o que não é texto volta o padrão. Em branco vale: o mestre pode apagar. */
function textoDoArquivo(valor: unknown, teto: number, padrao: string): string {
  return typeof valor === 'string' ? valor.trim().slice(0, teto) : padrao
}

/** Uma seta da coreografia; qualquer campo torto descarta a seta inteira. */
function lerNotaDaDanca(valor: unknown): NotaDaDanca | undefined {
  if (!ehObjetoDoArquivo(valor)) return undefined
  const t = campoDoArquivo(valor, 't')
  const len = campoDoArquivo(valor, 'len')
  const lane = umDaLista(TRILHAS_DANCA, campoDoArquivo(valor, 'lane'))
  const sub = umDaLista(SUBDIVISOES_DANCA, campoDoArquivo(valor, 'sub'))
  if (!ehNumeroFinito(t) || t < 0 || !ehNumeroFinito(len) || len < 0 || lane === undefined || sub === undefined) return undefined
  return { t, lane, len, sub }
}

/** A coreografia: lista obrigatória; a seta torta cai e as boas ficam. */
function lerCoreografia(valor: unknown): NotaDaDanca[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const notas: unknown[] = valor
  return notas.flatMap((nota) => {
    const lida = lerNotaDaDanca(nota)
    return lida === undefined ? [] : [lida]
  })
}

/**
 * A música do desafio. Qualquer peça torta da importada (mídia fora da forma,
 * ritmo que não é número, coreografia que não é lista) devolve a DEMO: na
 * dúvida o desafio continua jogável, com a faixa que todo aparelho sintetiza.
 */
function lerMusicaDaDanca(valor: unknown): MusicaDaDanca {
  const demo: MusicaDaDanca = { tipo: 'demo' }
  if (!ehObjetoDoArquivo(valor) || campoDoArquivo(valor, 'tipo') !== 'arquivo') return demo
  const midia = campoDoArquivo(valor, 'midia')
  const bpm = campoDoArquivo(valor, 'bpm')
  const primeiraBatida = campoDoArquivo(valor, 'primeiraBatida')
  const duracaoS = campoDoArquivo(valor, 'duracaoS')
  const fase4 = umDaLista(FASES_DO_COMPASSO, campoDoArquivo(valor, 'fase4'))
  const coreografias = campoDoArquivo(valor, 'coreografias')
  if (typeof midia !== 'string' || !FORMA_DA_MUSICA_NA_MIDIA.test(midia)) return demo
  if (!ehNumeroFinito(bpm) || bpm <= 0 || !ehNumeroFinito(primeiraBatida) || primeiraBatida < 0) return demo
  if (!ehNumeroFinito(duracaoS) || duracaoS <= 0 || fase4 === undefined || !ehObjetoDoArquivo(coreografias)) return demo
  const diversao = lerCoreografia(campoDoArquivo(coreografias, 'diversao'))
  const expert = lerCoreografia(campoDoArquivo(coreografias, 'expert'))
  if (diversao === undefined || expert === undefined) return demo
  return {
    tipo: 'arquivo',
    midia,
    nome: textoDoArquivo(campoDoArquivo(valor, 'nome'), NOME_DA_MUSICA_MAX_LENGTH, ''),
    bpm,
    primeiraBatida,
    fase4,
    duracaoS,
    coreografias: { diversao, expert },
  }
}

/**
 * MINIGAME do pino, como vem do disco. Campo a campo, como `readPinLock`: o
 * torto cai no valor padrão do jogo (`MINIGAME_PADRAO` na dança,
 * `MINIGAME_PESCA_PADRAO` na pesca) e o resto do desafio fica. Só volta
 * `undefined` (e o pino ganha o padrão inteiro) quando não há desafio nenhum
 * — não é objeto, ou o jogo não é um que este app conheça (versão futura).
 * Campo desconhecido não entra: o desafio é montado aqui, nunca copiado.
 */
export function lerMinigameDoArquivo(valor: unknown): MinigameDoPino | undefined {
  if (!ehObjetoDoArquivo(valor)) return undefined
  const jogo = campoDoArquivo(valor, 'jogo')
  if (jogo === 'danca') return lerDancaDoArquivo(valor)
  if (jogo === 'pesca') return lerPescaDoArquivo(valor)
  return undefined
}

/**
 * A PESCA do disco. Textos aparados e cortados nos tetos de `pesca/tipos.ts`;
 * `lances` fora de 1..5 vem para a ponta mais perto (e o quebrado, para o
 * inteiro mais perto) — o mestre que gravou 9 queria muitos, não o padrão;
 * o que não é número volta o padrão. `entrada` e `permitida` fora da lista
 * voltam o padrão. Prêmio e consequência são só texto: um `tipo` que viesse
 * no arquivo não entra.
 */
function lerPescaDoArquivo(valor: object): MinigamePesca {
  const padrao = MINIGAME_PESCA_PADRAO
  return {
    jogo: 'pesca',
    npc: textoDoArquivo(campoDoArquivo(valor, 'npc'), NPC_MAX_LENGTH, padrao.npc),
    fala: textoDoArquivo(campoDoArquivo(valor, 'fala'), FALA_MAX_LENGTH, padrao.fala),
    lago: textoDoArquivo(campoDoArquivo(valor, 'lago'), LAGO_MAX_LENGTH, padrao.lago),
    entrada: umDaLista(ENTRADAS_PESCA, campoDoArquivo(valor, 'entrada')) ?? padrao.entrada,
    lances: lancesDoArquivo(campoDoArquivo(valor, 'lances'), padrao.lances),
    permitida: umDaLista(PERMITIDAS_PESCA, campoDoArquivo(valor, 'permitida')) ?? padrao.permitida,
    premio: { texto: textoDeObjetoDoArquivo(campoDoArquivo(valor, 'premio'), padrao.premio.texto) },
    consequencia: { texto: textoDeObjetoDoArquivo(campoDoArquivo(valor, 'consequencia'), padrao.consequencia.texto) },
  }
}

/** Lances da pesca: número finito, arredondado e preso em `LANCES_MIN`..`LANCES_MAX`; o resto, o padrão. */
function lancesDoArquivo(valor: unknown, padrao: number): number {
  if (!ehNumeroFinito(valor)) return padrao
  return Math.min(LANCES_MAX, Math.max(LANCES_MIN, Math.round(valor)))
}

/** O `{ texto }` do prêmio e da consequência da pesca: objeto que não é objeto, ou texto que não é texto, volta o padrão. */
function textoDeObjetoDoArquivo(valor: unknown, padrao: string): string {
  if (!ehObjetoDoArquivo(valor)) return padrao
  return textoDoArquivo(campoDoArquivo(valor, 'texto'), PESCA_TEXTO_MAX_LENGTH, padrao)
}

/** A DANÇA do disco, como sempre foi lida (mapa antigo abre igual). */
function lerDancaDoArquivo(valor: object): MinigameDanca {
  const padrao = MINIGAME_PADRAO
  const premio = campoDoArquivo(valor, 'premio')
  const consequencia = campoDoArquivo(valor, 'consequencia')
  return {
    jogo: 'danca',
    npc: textoDoArquivo(campoDoArquivo(valor, 'npc'), NPC_MAX_LENGTH, padrao.npc),
    fala: textoDoArquivo(campoDoArquivo(valor, 'fala'), FALA_MAX_LENGTH, padrao.fala),
    musica: lerMusicaDaDanca(campoDoArquivo(valor, 'musica')),
    permitida: umDaLista(PERMITIDAS_DANCA, campoDoArquivo(valor, 'permitida')) ?? padrao.permitida,
    notaMin: umDaLista(LETRAS_DANCA, campoDoArquivo(valor, 'notaMin')) ?? padrao.notaMin,
    premio: ehObjetoDoArquivo(premio)
      ? {
          tipo: umDaLista(PREMIOS_DANCA, campoDoArquivo(premio, 'tipo')) ?? padrao.premio.tipo,
          texto: textoDoArquivo(campoDoArquivo(premio, 'texto'), PREMIO_TEXTO_MAX_LENGTH, padrao.premio.texto),
        }
      : { ...padrao.premio },
    consequencia: ehObjetoDoArquivo(consequencia)
      ? {
          tipo: umDaLista(CONSEQUENCIAS_DANCA, campoDoArquivo(consequencia, 'tipo')) ?? padrao.consequencia.tipo,
          texto: textoDoArquivo(campoDoArquivo(consequencia, 'texto'), PREMIO_TEXTO_MAX_LENGTH, padrao.consequencia.texto),
        }
      : { ...padrao.consequencia },
  }
}

/**
 * OBJETO COM RÓTULO OU IMAGEM: rótulo e imagem do jogador só ficam na forma de
 * `propPlayerLook.ts`. Sem nenhum dos dois campos o objeto volta idêntico (o
 * round-trip do mapa antigo não ganha campo).
 */
function readPropPlayerLook(prop: Prop): Prop {
  if (!('playerLabel' in prop) && !('playerImage' in prop)) return prop
  const { playerLabel, playerImage, ...rest } = prop
  const lido: Prop = rest
  const label = propPlayerLabel(playerLabel)
  if (label !== undefined) lido.playerLabel = label
  const image = propPlayerImage(playerImage)
  if (image !== undefined) lido.playerImage = image
  return lido
}

/**
 * ITEM NO CHÃO (entrega 5): campo NOVO e OPCIONAL. Sem ele o objeto volta
 * idêntico; com ele, só na forma de `readPinItem` (nome, `livre` só `true`,
 * imagem só referência de mídia). Forma errada sai: o objeto fica, só deixa
 * de ser pegável — o `...p` não leva o valor cru até a tela do jogador.
 */
function readPropItem(doArquivo: Prop): Prop {
  // CAMADA DO OBJETO: torta sai e o objeto volta à camada padrão (`Prop.layer ?? 'objetos'`).
  const prop = semCamadaTorta(doArquivo)
  if (!('item' in prop)) return prop
  const { item, ...rest } = prop
  const lido = readPinItem(item)
  return lido === undefined ? rest : { ...rest, item: lido }
}

/**
 * CAMADA DO TELHADO (`lib/camadas`): campo NOVO e OPCIONAL da sala, com a
 * mesma regra da `camada` das entidades. Torto sai e o telhado volta a Telhados.
 */
function roomRoofLayerFromFile(region: Region): Region {
  const room = region.room
  if (!room || typeof room !== 'object' || !('camadaDoTelhado' in room) || ehCamadaId(room.camadaDoTelhado)) return region
  const { camadaDoTelhado: _torta, ...semCamada } = room
  return { ...region, room: semCamada }
}

/**
 * CHAVE ABRE PORTA: o "Abre com" é campo NOVO e OPCIONAL. Ausente continua
 * ausente (o round-trip do mapa antigo não ganha campo); o que não é texto sai
 * — a porta continua trancada, só deixa de abrir com item.
 */
function doorKeyFromFile(door: DoorState): DoorState {
  if (!('abreCom' in door)) return door
  const abreCom = readDoorKey(door.abreCom)
  const { abreCom: _cru, ...semChave } = door
  return abreCom === undefined ? semChave : { ...semChave, abreCom }
}

/** VEÍCULO do disco: forma certa fica limpa; torta some e a ficha volta a ser comum. */
function tokenVehicleFromFile(token: Token): Token {
  if (!('veiculo' in token)) return token
  const veiculo = readTokenVehicle(token.veiculo)
  return veiculo === undefined ? withoutVehicleField(token) : { ...token, veiculo }
}

/**
 * Cadeado e olho (`lockedLayers`, `hiddenLayers`): só as 9 camadas de hoje
 * (`LAYER_IDS`). Outro valor ('terreno', 'chao', camada livre, lixo) sai:
 * sem linha no painel para soltar, seria trava sem saída e o "Destravar" do
 * aviso não teria o que soltar. A fatia 6 decide onde moram os das 13; até
 * lá, os valores válidos ficam como estão, na mesma ordem (round-trip do
 * mapa antigo idêntico).
 */
function camadasDoArquivo(value: unknown): LayerId[] {
  return Array.isArray(value) ? value.filter(ehLayerId) : []
}

function ehLayerId(value: unknown): value is LayerId {
  return LAYER_IDS.some((id) => id === value)
}

/**
 * Alinhamento da grade à imagem de fundo (`types/map.ts:516`). Era o campo
 * ESQUECIDO desta função: `serializeMap` gravava, a leitura descartava, e todo
 * o trabalho de encaixar a grade nas casas da imagem morria ao reabrir. Só
 * `{ x, y }` finito conta — offset `NaN`/`Infinity` empurraria a grade para
 * fora de qualquer viewport, e "sem alinhamento" é o estado recuperável.
 */
function gridOffsetOrNone(value: MapData['gridOffset']): MapData['gridOffset'] {
  if (value === null || typeof value !== 'object') return undefined
  const { x, y } = value
  if (typeof x !== 'number' || !Number.isFinite(x)) return undefined
  if (typeof y !== 'number' || !Number.isFinite(y)) return undefined
  return { x, y }
}

/**
 * `RoomMeta.rotation` (girar sala) é campo NOVO. Ausente continua ausente —
 * é "nunca girada", e escrever `0` em toda sala de mapa antigo inventaria
 * campo que o arquivo não tinha. Número finito passa como veio. O resto
 * (texto, `null`, `NaN` de arquivo editado à mão) SAI em vez de virar ângulo:
 * o campo "Rotação" e a alça de girar fazem conta com ele, e um `NaN` levaria
 * a alça para fora da tela. A sala em si abre igual — o giro está nos pontos.
 */
function roomRotationFromFile(region: Region): Region {
  const room = region.room
  if (!room || typeof room !== 'object' || !('rotation' in room)) return region
  if (typeof room.rotation === 'number' && Number.isFinite(room.rotation)) return region
  const { rotation: _descartada, ...semAngulo } = room
  return { ...region, room: semAngulo }
}

/**
 * TEXTO DA SALA (`textoAoEntrar`, `notaDoMestre`) é campo NOVO e OPCIONAL.
 * Ausente continua ausente. Valor que não é texto (arquivo editado à mão,
 * versão futura) SAI: o texto de entrada vai para a tela do jogador, e um
 * objeto ali viraria "[object Object]" — ou coisa pior no recorte.
 */
function roomTextsFromFile(region: Region): Region {
  const room = region.room
  if (!room || typeof room !== 'object') return region
  const textoRuim = 'textoAoEntrar' in room && typeof room.textoAoEntrar !== 'string'
  const notaRuim = 'notaDoMestre' in room && typeof room.notaDoMestre !== 'string'
  if (!textoRuim && !notaRuim) return region
  const { textoAoEntrar, notaDoMestre, ...semTextos } = room
  // Só volta o campo que era texto: o ausente continua ausente, sem chave `undefined`.
  return {
    ...region,
    room: {
      ...semTextos,
      ...(typeof textoAoEntrar === 'string' ? { textoAoEntrar } : {}),
      ...(typeof notaDoMestre === 'string' ? { notaDoMestre } : {}),
    },
  }
}

/**
 * SALA ESCURA (`RoomMeta.dark`) é campo NOVO. Ausente continua ausente (sala
 * clara, como sempre); só `true` volta. O resto (texto, número, arquivo editado
 * à mão) SAI: a sala abre clara em vez de carregar um valor que o tipo não tem.
 */
function roomDarkFromFile(region: Region): Region {
  const room = region.room
  if (!room || typeof room !== 'object' || !('dark' in room) || room.dark === true) return region
  const { dark: _descartado, ...semEscuro } = room
  return { ...region, room: semEscuro }
}

/**
 * VER ATRAVÉS DAS PAREDES (`RoomMeta.dentroVeFora` / `foraVeDentro`) são
 * campos NOVOS, no mesmo critério da sala escura: só `true` volta. Qualquer
 * outro valor SAI, e a parede segura a visão como sempre segurou.
 */
function roomSeeThroughFromFile(region: Region): Region {
  const room = region.room
  if (!room || typeof room !== 'object') return region
  const tortoDentro = 'dentroVeFora' in room && room.dentroVeFora !== true
  const tortoFora = 'foraVeDentro' in room && room.foraVeDentro !== true
  if (!tortoDentro && !tortoFora) return region
  const { dentroVeFora, foraVeDentro, ...semVerAtraves } = room
  return {
    ...region,
    room: {
      ...semVerAtraves,
      ...(dentroVeFora === true ? { dentroVeFora } : {}),
      ...(foraVeDentro === true ? { foraVeDentro } : {}),
    },
  }
}

/** BILHETE NO LUGAR: `{ marcas }` só quando o arquivo trouxe o campo. */
function marcasDoArquivo(value: unknown): Pick<MapData, 'marcas'> {
  const marcas = lerMarcasDoArquivo(value)
  return marcas === undefined ? {} : { marcas }
}

/**
 * FACÇÃO da Sala (`RoomMeta.faccao`): campo NOVO e OPCIONAL. Ausente continua
 * ausente; texto volta no teto; o resto (número, objeto, texto em branco) SAI —
 * a legenda do filtro escreveria "[object Object]".
 */
function roomFaccaoFromFile(region: Region): Region {
  const room = region.room
  if (!room || typeof room !== 'object' || !('faccao' in room)) return region
  const faccao = lerFaccao(room.faccao)
  if (faccao === room.faccao) return region
  const { faccao: _descartada, ...semFaccao } = room
  return { ...region, room: faccao === undefined ? semFaccao : { ...semFaccao, faccao } }
}

/** `alerta` só entra no mapa quando o arquivo traz um dos três níveis: mapa de antes não ganha campo. */
function alertaField(raw: unknown): Pick<MapData, 'alerta'> {
  const alerta = lerAlerta(raw)
  return alerta === undefined ? {} : { alerta }
}

/**
 * "Raio de visão aqui" (`RoomMeta.raioDeVisao`) é campo NOVO e OPCIONAL.
 * Ausente continua ausente (vale o raio do jogador). Número finito e positivo
 * passa como veio; o resto (texto, `null`, zero, negativo) SAI em vez de virar
 * o raio de visão que o recorte do jogador usa (`lib/fogFilter.ts`).
 */
/** ESTILO DO TÍTULO — campo de plaquinha/tamanho/cor/orientação sem forma
 *  válida sai; o título volta ao visual de sempre naquele eixo. */
function roomLabelStyleFromFile(region: Region): Region {
  const room = region.room
  if (!room || typeof room !== 'object') return region
  return { ...region, room: sanitizeRoomLabelStyle(room) }
}

/** MODELO E COR DO TELHADO — campos NOVOS e OPCIONAIS: ausentes continuam
 *  ausentes (telha barro). Modelo que não é 'telhas'/'madeira' e cor que não é
 *  `#rrggbb` SAEM, em vez de chegar ao desenho do jogador. */
function roomRoofStyleFromFile(region: Region): Region {
  const room = region.room
  if (!room || typeof room !== 'object' || !('modeloDoTeto' in room || 'corDoTeto' in room)) return region
  const modeloOk = !('modeloDoTeto' in room) || MODELOS_DO_TETO.some((m) => m === room.modeloDoTeto)
  const corOk = !('corDoTeto' in room) || corDoTetoValida(room.corDoTeto)
  if (modeloOk && corOk) return region
  const { modeloDoTeto, corDoTeto, ...semEstilo } = room
  return { ...region, room: { ...semEstilo, ...(modeloOk ? { modeloDoTeto } : {}), ...(corOk ? { corDoTeto } : {}) } }
}

function roomVisionRadiusFromFile(region: Region): Region {
  const room = region.room
  if (!room || typeof room !== 'object' || !('raioDeVisao' in room)) return region
  const raio = room.raioDeVisao
  if (typeof raio === 'number' && Number.isFinite(raio) && raio > 0) return region
  const { raioDeVisao: _descartado, ...semRaio } = room
  return { ...region, room: semRaio }
}

/**
 * Porta lida do disco. `kind` virou obrigatório (porta antiga migra para
 * 'normal'). `secret` (porta secreta) é campo NOVO: só `true` volta; qualquer
 * outro valor sai do objeto, e a porta abre como porta comum — como sempre foi.
 * `opensFrom` (porta de um lado) é campo NOVO pelo mesmo critério: só
 * 'left'/'right' voltam; qualquer outro valor sai, e a porta abre dos dois lados.
 * `semEspiar` (porta que o jogador não espia) segue o `secret`: só `true`
 * volta; o resto sai, e a porta deixa espiar — como sempre foi.
 * Aberta E trancada (mapa salvo antes da regra) volta fechada (`closeIfLocked`):
 * o host já a tratava assim, e o jogador não pode vê-la aberta sem passar.
 * `animacao` (PORTA ANIMADA) é campo NOVO: só id na forma
 * `ID_DE_ANIMACAO_DE_PORTA` volta; o resto sai, e a porta troca de estado sem
 * animação. Id bem formado de animação que este app não tem fica (pode ser de
 * um pacote ainda não baixado) e desenha sem animação.
 * `cor` (COR DA PORTA) é campo NOVO: só `#rrggbb` volta, em minúscula; o resto
 * sai, e a porta abre no laranja de sempre.
 */
function doorFromFile(door: DoorState): DoorState {
  const { secret, opensFrom, porEstado, semEspiar, animacao, cor, ...rest } = doorKeyFromFile(door)
  const corValida = normalizarCorDaPorta(cor)
  // `door` vem de JSON.parse: o tipo declarado não garante o valor, por isso a checagem de runtime.
  const side: unknown = opensFrom
  const idDaAnimacao: unknown = animacao
  const withKind: DoorState = closeIfLocked({ ...rest, kind: rest.kind ?? 'normal' })
  // ESTADO DO MUNDO: regra torta some e a porta volta a ser a de sempre; ausente continua ausente.
  const regra = regraDoArquivo(porEstado, isEfeitoNaPorta)
  const withRule: DoorState = regra === undefined ? withKind : { ...withKind, porEstado: regra }
  const withSecret: DoorState = secret === true ? { ...withRule, secret: true } : withRule
  const withPeek: DoorState = semEspiar === true ? { ...withSecret, semEspiar: true } : withSecret
  const withAnimation: DoorState = idDeAnimacaoDePortaValido(idDaAnimacao) ? { ...withPeek, animacao: idDaAnimacao } : withPeek
  const withColor: DoorState = corValida === undefined ? withAnimation : { ...withAnimation, cor: corValida }
  return side === 'left' || side === 'right' ? { ...withColor, opensFrom: side } : withColor
}

/** Zona oculta lida do disco: só a regra do ESTADO DO MUNDO passa por conferência; ausente continua ausente. */
function concealZoneFromFile(zone: ConcealZone): ConcealZone {
  if (!('porEstado' in zone)) return zone
  const { porEstado, ...rest } = zone
  const regra = regraDoArquivo(porEstado, isEfeitoNaZona)
  return regra === undefined ? rest : { ...rest, porEstado: regra }
}

/**
 * Luz lida do disco: os dois campos do ESTADO DO MUNDO passam por conferência.
 * `apagada` só volta `true`; regra torta some. Ausentes continuam ausentes.
 */
function lightFromFile(light: Light): Light {
  if (!('porEstado' in light) && !('apagada' in light)) return light
  const { porEstado, apagada, ...rest } = light
  const regra = regraDoArquivo(porEstado, isEfeitoNaLuz)
  const withRule: Light = regra === undefined ? rest : { ...rest, porEstado: regra }
  return apagada === true ? { ...withRule, apagada: true } : withRule
}

/** BOLSA do arquivo: ausente fica ausente; valor torto some (bolsa vazia) em vez de ir parar na tela. */
function bolsaDoArquivo(token: Token): Token {
  if (!('moedas' in token)) return token
  const moedas = readMoedas(token.moedas)
  if (moedas !== undefined) return { ...token, moedas }
  const { moedas: _torta, ...semBolsa } = token
  return semBolsa
}

/** `movement` só entra no mapa quando o arquivo traz regra válida: mapa de antes não ganha campo. */
function movementField(raw: unknown): Pick<MapData, 'movement'> {
  const movement = readMovementRules(raw)
  return movement === undefined ? {} : { movement }
}

function deserializeMapFields(json: string): MapData {
  let parsed: Partial<MapData>
  try {
    parsed = JSON.parse(json) as Partial<MapData>
  } catch (error) {
    throw new Error(`map.json inválido: JSON malformado (${(error as Error).message})`)
  }

  if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') {
    throw new Error('map.json inválido: campo "id" ausente ou não é string')
  }

  // CONFRONTO é campo NOVO e OPCIONAL: ausente continua ausente (mapa velho
  // abre sem confronto e sem ganhar chave), torto some (`confrontoFromFile`).
  const confronto = confrontoFromFile(parsed.confronto)
  // PERIGO QUE SE ALASTRA: mesma regra — ausente continua ausente, torto some (`perigosFromFile`).
  const perigos = perigosFromFile(parsed.perigos)

  return {
    ...(confronto === undefined ? {} : { confronto }),
    ...(perigos === undefined ? {} : { perigos }),
    id: parsed.id,
    name: typeof parsed.name === 'string' ? parsed.name : 'Mapa sem título',
    width: positiveNumberOr(parsed.width, 30),
    height: positiveNumberOr(parsed.height, 20),
    grid: positiveNumberOr(parsed.grid, 64),
    // NOVO — o alinhamento da grade à imagem volta do disco em vez de morrer
    // calado a cada "Salvar + Abrir" (ver `gridOffsetOrNone` acima).
    gridOffset: gridOffsetOrNone(parsed.gridOffset),
    gridShape: parsed.gridShape ?? 'square',
    showGrid: parsed.showGrid ?? true,
    // NOVO — valores = cópia literal dos hardcodes de drawGrid.ts:4 / drawHexGrid.ts:4
    gridSettings: parsed.gridSettings ?? {
      color: '#4a4a4a', opacity: 1, lineWidth: 1, lineStyle: 'solid',
    },
    background: parsed.background ?? { type: 'color', src: '#2b2b2b' },
    // MUDA de cru para .map(): DoorState ganhou campo obrigatório.
    // wallKind ausente fica undefined de propósito (=== 'exterior').
    // CAMADA (`lib/camadas`): em TODA entidade abaixo, `camada` torta perde a
    // chave (`semCamadaTorta`); ausente continua ausente.
    walls: entityList(parsed.walls).map((w) => semCamadaTorta({
      ...w,
      door: w.door ? doorFromFile(w.door) : null,
    })),
    lights: entityList(parsed.lights).map(lightFromFile).map(semCamadaTorta),
    // inalterado — `room` ausente fica undefined (região comum); o ângulo do
    // giro da sala passa como veio, desde que seja número (`roomRotationFromFile`)
    regions: entityList(parsed.regions).map((r) =>
      semCamadaTorta(roomRoofLayerFromFile(roomRoofStyleFromFile(roomLabelStyleFromFile(roomVisionRadiusFromFile(roomFaccaoFromFile(roomSeeThroughFromFile(roomDarkFromFile(roomTextsFromFile(roomRotationFromFile({ ...r, fillColor: r.fillColor ?? '#3a7ad0', fillPattern: r.fillPattern ?? 'solid' })))))))))),
    ),
    // MUDA de cru para .map(): Token.image é obrigatório.
    // `imageData` (a cópia embutida que viaja até o jogador) NÃO ganha linha
    // aqui, de propósito: é campo opcional com `undefined === null` documentado
    // em types/map.ts, mesmo padrão de rotation/locked/hidden/wallKind. Mapa
    // salvo antes do campo existir abre igual, e escrever `?? null` quebraria a
    // promessa que mapFile.test.ts cobra — round-trip que preserva o mapa
    // EXATAMENTE, sem inventar campo que o arquivo não tinha.
    // MOCHILA (item pegável) é campo NOVO e OPCIONAL: ausente continua
    // ausente (mochila vazia). Item fora da forma sai; lista que sobra vazia
    // some — o `...t` copiaria o valor cru, por isso a linha.
    // `publicName` ("Nome para os jogadores"): mesma mão única de `soChegada`
    // — texto e null ficam, valor torto some e a ficha volta a "O mesmo".
    // `contrato` (ajudante contratado) é campo de FIO: o acordo mora na sessão
    // do host. Arquivo que o traga (editado à mão) perde o campo na leitura.
    // `emprestada` (NPC emprestado) também é marca de FIO: mesma limpeza.
    // `rotina` (ROTINA DO NPC): rotina torta some e a ficha volta a ser a de sempre; ausente continua ausente.
    // VEÍCULO (`veiculo`): mesmo tratamento da mochila — ausente continua
    // ausente, forma torta some e a ficha volta a ser comum (`readTokenVehicle`).
    // BOLSA (moedas e troca) segue a mesma mão única: ausente continua
    // ausente; só inteiro positivo até o teto fica (`readMoedas`).
    tokens: entityList(parsed.tokens).map((fichaDoArquivo) => {
      // FALA da patrulha só existe enquanto a ficha espera no ponto; salva no
      // meio de uma fala, o mapa reaberto (patrulha parada) não a mostra.
      // `aBordo` e `embarcavel` (VEÍCULO na tela do jogador) são marcas de FIO: arquivo que as traga as perde.
      // `pino` (cor do pino no MAPA DE CONTINENTE, na tela do jogador) idem.
      const { fala: _falaDaRonda, aBordo: _aBordo, embarcavel: _embarcavel, pino: _pino, ...t } = semCamadaTorta(fichaDoArquivo)
      const lido = tokenVehicleFromFile(fichaComRotinaDoArquivo(withoutLentMark(withoutContract(tokenPublicNameFromFile({ ...t, image: t.image ?? null })))))
      const comBolsa = bolsaDoArquivo(lido)
      if (!('mochila' in t)) return comBolsa
      const mochila = readCarriedItems(t.mochila)
      if (mochila !== undefined) return { ...comBolsa, mochila }
      const { mochila: _descartada, ...semMochila } = comBolsa
      return semMochila
    }),
    // Prop.layer ausente fica undefined. MOBÍLIA: `mobilia` ausente continua
    // ausente; tipo fora do catálogo some e o objeto fica (`propMobiliaFromFile`).
    // A aparência do móvel (`mobiliaPreenchido`, `mobiliaCor`, `mobiliaCorDaLinha`)
    // é nova e opcional: ausente abre como sempre; cor que não seja `#rrggbb`/`#rgb`
    // some, e objeto sem tipo de móvel perde os três campos. A VISTA (`mobiliaVista`)
    // idem: só `'lado'` num tipo com vista (cadeira, baú) fica; o resto some e o
    // móvel abre de frente.
    // OBJETO COM RÓTULO OU IMAGEM: os dois campos são novos e opcionais —
    // ausente continua ausente. Presente, só na forma de `propPlayerLook.ts`
    // (rótulo curto, imagem em data URL); o resto sai em vez de ir parar na
    // tela do jogador.
    props: entityList(parsed.props).map((p) =>
      propMobiliaFromFile(readPropItem(readPropPlayerLook({ ...p, linkedMapPath: p.linkedMapPath ?? null }))),
    ),
    // TRANSIÇÃO ESPECIAL da escada: mesma regra do pino de viagem.
    stairs: entityList(parsed.stairs).map((s) => semCamadaTorta({ ...s, transicao: parseTransicao(s.transicao) })),
    // MUDA de cru para .map(): PONTO DE MAIOR RISCO DE TODA A MIGRAÇÃO.
    // 0.5/0 é o alpha que drawDrawings.ts:50 já aplicava (filled ? 0.5 : 0);
    // sem esta linha, alpha: undefined vira 1 no Pixi e TODO círculo
    // preenchido de mapa salvo muda de aparência ao abrir.
    // PONTOS-CHAVE (alças do traço e do polígono, `lib/pontosChave.ts`): campo
    // novo e opcional; o que não é lista de inteiros sai na leitura.
    // PAREDES AO REDOR (`Drawing.paredes`, `lib/paredesPresas.ts`): campo novo
    // e opcional; torto sai, e texto e caminho o perdem.
    drawings: entityList(parsed.drawings).map((d) =>
      semCamadaTorta(paredesDoDesenhoDoArquivo(pontosChaveDoArquivo(d.kind === 'circle' && d.fillAlpha === undefined ? { ...d, fillAlpha: d.filled ? 0.5 : 0 } : d))),
    ),
    // MUDA de cru para .map(): `FloorPiece.fillColor` (cor própria do caminho)
    // é campo NOVO. O default dele é a AUSÊNCIA — peça sem cor própria usa
    // `floorStyle.fillColor`, que é exatamente como todo mapa salvo antes deste
    // campo se desenhava. Valor que não é string (arquivo editado à mão, versão
    // futura) é descartado em vez de recusado: `new Color(...)` com lixo dentro
    // estouraria no render e levaria o mapa inteiro junto.
    // `FloorPiece.nome` (camadas do pincel, 03/10/2026): mesma regra. Ausente
    // = nome automático ("Camada 1"); nome que não é texto sai do arquivo.
    floor: entityList(parsed.floor).map(semCamadaTorta).map((f) => {
      const comCor = typeof f.fillColor === 'string' ? f : { ...f, fillColor: undefined }
      if (comCor.nome === undefined || typeof comCor.nome === 'string') return comCor
      const semNome = { ...comCor }
      delete semNome.nome
      return semNome
    }),
    floorStyle: parsed.floorStyle ?? { ...LEGACY_FLOOR_STYLE },
    lines: entityList(parsed.lines).map(semCamadaTorta),
    markers: entityList(parsed.markers).map(semCamadaTorta),
    concealZones: entityList(parsed.concealZones).map(concealZoneFromFile),
    // NOVO — pinos de ponto de interesse. Mapa salvo antes deste campo existir
    // abre sem nenhum pino; pino gravado por uma versão futura sem `kind` ou
    // sem `description` volta como "!" mudo em vez de derrubar o desenho.
    // `icon` é campo NOVO e OPCIONAL: o default é a AUSÊNCIA, que desenha o
    // pino de hoje. Símbolo desconhecido (arquivo editado à mão, versão
    // futura) volta como ausente em vez de derrubar `PIN_SYMBOLS[icon]` no
    // render e levar o mapa inteiro junto — mesma regra de `FloorPiece.fillColor`.
    //
    // `destino` é campo NOVO do pino de viagem. Ausente continua ausente, que
    // já é "sem destino" — escrever `null` em todo pino de mapa antigo
    // inventaria campo que o arquivo não tinha. Presente, só a forma certa
    // (`{ sceneId, pinId }` com os dois textos) vira destino; o resto volta
    // `null` em vez de levar o clique do mestre para uma cena que não existe.
    // `kind: 'viagem'` é o terceiro tipo: sem ele na lista, todo pino de
    // viagem voltaria do disco como "!".
    // CABINE CONTÍNUA: campo NOVO e OPCIONAL. `pinWithCabin` tira a chave
    // quando o valor cru não é um id (o `...p` copiaria o lixo), então mapa de
    // antes abre sem o campo e cabine quebrada vira "pino sem cabine".
    pins: entityList(parsed.pins).map(semNotaDoMestre).map(semCamadaTorta).map((p) => pinWithCabin({
      ...p,
      kind: isPinKind(p.kind) ? p.kind : 'exclamacao',
      icon: isPinIcon(p.icon) ? p.icon : undefined,
      description: typeof p.description === 'string' ? p.description : '',
      // NOME DO LOCAL: campo OPCIONAL. Texto aparado e no teto; em branco
      // ou torto (número, arquivo editado à mão) volta AUSENTE.
      nome: cleanPinName(p.nome) || undefined,
      image: typeof p.image === 'string' ? p.image : null,
      destino: p.destino === undefined ? undefined : readPinDestination(p.destino),
      // `passagem` é campo NOVO e OPCIONAL do pino de viagem: ausente é "pede
      // ao mestre", o de sempre. Valor desconhecido (arquivo editado à mão,
      // versão futura) volta AUSENTE, e não como "livre": na dúvida, a porta
      // pergunta ao mestre em vez de deixar o grupo passar sem ninguém ver.
      passagem: isPinPassage(p.passagem) ? p.passagem : undefined,
      // PINO TRANCADO VIRA PEDIDO: `mudo` é campo NOVO e OPCIONAL. Só `true`
      // vale; o resto volta AUSENTE — o trancado que aceita "Pedir ao mestre".
      mudo: p.mudo === true ? true : undefined,
      // MOTIVO DO BLOQUEIO: campo NOVO e OPCIONAL. Só um valor da lista
      // volta; o resto (texto livre, número, arquivo editado à mão) volta
      // AUSENTE — "Está trancada", o de sempre. O `...p` copiaria o valor cru.
      motivo: isPinBlockReason(p.motivo) ? p.motivo : undefined,
      // PASSE: campo NOVO e OPCIONAL. Forma errada volta ausente — ninguém
      // tem passe e o pedido vai ao mestre, nunca uma catraca aberta a todos.
      // `item` e `fichas` (as marcas do mestre) são conferidos em `readPinPass`.
      passe: readPinPass(p.passe),
      // ENCRUZILHADA: `rotulo` e `saidas` são campos NOVOS e OPCIONAIS. Mapa
      // de antes não tem nenhum dos dois e abre como sempre, com a saída de
      // `destino`. Saída extra fora da forma é descartada sozinha (ver
      // `readPinExits`), e as boas ficam. `escolhas` é só do recorte do
      // jogador: arquivo que o traga (editado à mão) não o põe no mapa do mestre.
      rotulo: p.rotulo === undefined ? undefined : cleanExitLabel(p.rotulo) || undefined,
      saidas: readPinExits(p.saidas),
      // MÃO ÚNICA: `soChegada` é campo NOVO e OPCIONAL. Só `true` vale; o resto
      // (`false`, texto, número, arquivo editado à mão) volta AUSENTE — o par de
      // sempre, visível. O `...p` acima copiaria o valor cru, por isso a linha.
      soChegada: p.soChegada === true ? true : undefined,
      // ESCADA QUE LEVA A OUTRO ANDAR: `escadaId` é campo NOVO e OPCIONAL. Só
      // texto não vazio vale; o resto volta AUSENTE — o pino de sempre, que se
      // desenha. O `...p` acima copiaria o valor cru.
      escadaId: typeof p.escadaId === 'string' && p.escadaId !== '' ? p.escadaId : undefined,
      // PRESO À FICHA: campo NOVO e OPCIONAL. Só texto não vazio vale; o resto
      // volta AUSENTE (pino parado, o de sempre) — ver `readPinAttachment`.
      presoA: readPinAttachment(p.presoA),
      // MARCO e LER SÓ DE PERTO: campos NOVOS e OPCIONAIS. Na dúvida, o pino
      // de sempre: `marco` só com `true` (um valor torto não pode furar a
      // névoa) e `lerDePerto` só com inteiro de casas na faixa do painel.
      marco: p.marco === true ? true : undefined,
      lerDePerto: isPinReadDistance(p.lerDePerto) ? p.lerDePerto : undefined,
      // SÓ O CÍRCULO, SEM HASTE: campo NOVO e OPCIONAL. Só `true` vale; o resto
      // volta AUSENTE — o pino de sempre, com haste. O `...p` acima copiaria o
      // valor cru.
      semHaste: p.semHaste === true ? true : undefined,
      // COR E TAMANHO (fatia 14): campos NOVOS e OPCIONAIS. Cor só `#rrggbb`
      // (gravada minúscula); tamanho só número na faixa e diferente de 1. O
      // resto volta AUSENTE — o latão e o tamanho de sempre.
      cor: normalizarCorDoPino(p.cor),
      escala: isPinEscala(p.escala) && p.escala !== 1 ? p.escala : undefined,
      // `longe` e `soMarco` são só do recorte do jogador, como `escolhas`.
      longe: undefined,
      soMarco: undefined,
      // ESPIAR: "Dá vista" é campo NOVO e OPCIONAL. Só inteiro dentro da faixa
      // vale; o resto volta AUSENTE — na dúvida, o pino não deixa espiar.
      daVista: isDaVista(p.daVista) ? p.daVista : undefined,
      // TRANSIÇÃO ESPECIAL: campo NOVO e OPCIONAL. Id fora do catálogo volta
      // ausente; duração fora do teto cai e fica a natural (`parseTransicao`).
      transicao: parseTransicao(p.transicao),
      // ANIMAÇÃO DO CENÁRIO: campo NOVO e OPCIONAL; forma errada volta ausente (`parseCenario`).
      cenario: parseCenario(p.cenario),
      escolhas: undefined,
      // ITEM PEGÁVEL: campo NOVO e OPCIONAL. Forma errada volta ausente (o
      // pino só deixa de ser pegável); `livre` só vale `true` (`readPinItem`).
      item: readPinItem(p.item),
      // CABINE DE TRANSPORTE: `cabine` é só do recorte do jogador (a cabine mora
      // na aventura). Arquivo editado à mão que o traga não o põe no mapa do mestre.
      cabine: undefined,
      // ESTADO DO MUNDO: regra torta volta AUSENTE (o pino de sempre); o `...p` copiaria o valor cru.
      porEstado: regraDePinoDoArquivo(p.porEstado),
      // CHAVE ABRE PORTA no pino trancado: campo NOVO e OPCIONAL, com a mesma
      // leitura do "Abre com" da porta. `chave` é só do recorte do jogador:
      // arquivo que o traga não o põe no mapa do mestre.
      abreCom: p.abreCom === undefined ? undefined : readDoorKey(p.abreCom),
      chave: undefined,
      // ALAVANCA: campo NOVO e OPCIONAL. Só texto não vazio vale; o resto
      // volta AUSENTE (alavanca solta, que não move nada) — ver `readPinLeverDoor`.
      portaLigada: readPinLeverDoor(p.portaLigada),
      // MINIGAME: campo NOVO e OPCIONAL, só do pino de minigame — conferido
      // campo a campo por `lerMinigameDoArquivo`. Pino de minigame sem desafio
      // que preste ganha o padrão (sem ele não haveria o que propor); em outro
      // tipo de pino o campo é sobra e não entra (o `...p` copiaria o cru).
      minigame: p.kind === 'minigame' ?(lerMinigameDoArquivo(p.minigame) ?? minigamePadrao()) : undefined,
      // `minigameVisivel` é só do recorte do jogador: arquivo que o traga não o põe no mapa do mestre.
      minigameVisivel: undefined,
      // FECHADURA COM SEGREDO: campo NOVO e OPCIONAL, conferido campo a campo
      // por `readPinLock` — `resposta` em texto (sem ela, sem fechadura),
      // `forma` desconhecida volta 'teclado', `aberta` só `true` e `abrePorta`
      // só texto; ausentes continuam ausentes. `fechadura` é só do recorte do
      // jogador, como `escolhas`: arquivo que a traga não a põe no mapa do mestre.
      segredo: readPinLock(p.segredo),
      fechadura: undefined,
      // SÓ IDA: `semVolta` é só do recorte do jogador, como `escolhas` (que
      // leva o `soIda` de cada saída e já sai inteiro na linha de cima).
      semVolta: undefined,
      // COLEÇÃO DE PISTAS: campo NOVO e OPCIONAL, conferido por `readPinColecao`
      // — forma errada volta ausente (pino avulso) em vez de derrubar o mapa.
      colecao: readPinColecao(p.colecao),
      // LOJA COM PREÇOS: campo NOVO e OPCIONAL, conferido item a item por
      // `lerLojaDoArquivo` — o torto cai, o bom fica, campo desconhecido não
      // entra. Nada que preste volta ausente (o `...p` acima copiaria o cru).
      loja: lerLojaDoArquivo(p.loja),
    }, readCabin(p.cabineContinua))),
    // BILHETE NO LUGAR: campo NOVO e OPCIONAL. Ausente continua ausente (sem a
    // chave, nem `undefined`): o round-trip de mapa antigo sai idêntico. Marca
    // torta cai sozinha e as boas ficam (`lerMarcasDoArquivo`).
    ...marcasDoArquivo(parsed.marcas),
    frame: parsed.frame ?? null,
    fog: parsed.fog ?? { mode: 'none', revealed: [] },
    hiddenLayers: camadasDoArquivo(parsed.hiddenLayers),
    // NOVO (Onda 4, Frente D) — mesmo padrão de hiddenLayers acima: mapa
    // salvo antes deste campo existir abre com nada travado.
    lockedLayers: camadasDoArquivo(parsed.lockedLayers),
    // CAMADAS (fase 3): campos NOVOS e OPCIONAIS. Ausente continua ausente; torto sai (`lib/camadas/arquivo.ts`).
    ...ocultasDoJogadorDoArquivo(parsed.ocultasDoJogador),
    ...opacidadesDoArquivo(parsed.opacidadeDasCamadas),
    ...versaoDasCamadasDoArquivo(parsed.versaoDasCamadas),
    scale: parsed.scale ?? { unitsPerCell: 5, unit: 'ft', precision: 0 },
    // depende do gridShape JÁ RESOLVIDO, não do literal cru — senão mapa hex
    // antigo sem gridShape salvo cairia em 'chessboard' por engano
    measurementMode:
      parsed.measurementMode ?? ((parsed.gridShape ?? 'square') === 'hex' ? 'hex' : 'chessboard'),
    // NOVO — "Visão nesta cena". Ausente continua ausente (o raio de sempre);
    // valor torto volta ausente em vez de virar raio zero (`lib/sceneVision.ts`).
    visionCells: readSceneVisionCells(parsed.visionCells),
    // NOVO — "Cena escura". Só `true` escurece; ausente ou torto volta ausente (cena clara).
    dark: parsed.dark === true ? true : undefined,
    // "Rostos só de perto": campo NOVO e OPCIONAL. Só inteiro de 1 a 99 volta;
    // o resto (texto, fração, arquivo editado à mão) volta AUSENTE — a cena de
    // sempre, com o rosto de todo mundo à vista.
    faceRangeCells: faceRangeCellsOrNull(parsed.faceRangeCells) ?? undefined,
    ownerId: parsed.ownerId ?? null,
    scenarioLink: parsed.scenarioLink ?? null,
    // MOVIMENTO CONTADO: campo NOVO e OPCIONAL. Mapa de antes (ou com lixo
    // editado à mão) abre livre e sem o campo — ver `readMovementRules`.
    ...movementField(parsed.movement),
    // ZONA DE PERIGO: campo NOVO e OPCIONAL, mesmo padrão de `movement`. Mapa
    // de antes (ou lixo editado à mão) abre sem o campo — ver `readHazards`.
    ...hazardsField(parsed.hazards),
    // GATILHO DE ÁREA: campo NOVO e OPCIONAL, mesmo padrão de `hazards` — ver `readAreaTriggers`.
    ...areaTriggersField(parsed.gatilhos),
    // MAPA-MUNDI: campo NOVO e OPCIONAL. Só `true` vale; o resto (arquivo
    // editado à mão) abre como cena comum, sem o campo.
    ...(parsed.worldMap === true ? { worldMap: true } : {}),
    // TIPO DE MAPA "Continente": campo NOVO e OPCIONAL, mesmo padrão de
    // `worldMap`. A caravana virou chave DENTRO do Continente, então o mapa
    // salvo como mapa-mundi (antes do Continente existir) abre Continente com
    // a caravana ligada.
    ...(parsed.continente === true || parsed.worldMap === true ? { continente: true } : {}),
    // RELEVO: campo NOVO e OPCIONAL. Só booleano vale; ausente (ou torto) abre
    // sem o campo e segue o padrão do tipo de mapa (`lib/relevo.ts`).
    ...(typeof parsed.relevo === 'boolean' ? { relevo: parsed.relevo } : {}),
    // NOMES DOS LUGARES: o mesmo molde do relevo (`lib/nomesDosLugares.ts`).
    ...(typeof parsed.nomesDosLugares === 'boolean' ? { nomesDosLugares: parsed.nomesDosLugares } : {}),
    // NUVENS: o mesmo molde do relevo (`lib/nuvens.ts`).
    ...(typeof parsed.nuvens === 'boolean' ? { nuvens: parsed.nuvens } : {}),
    // PENHASCO: campo NOVO e OPCIONAL. Risco torto sai, lista vazia abre sem o campo (`lerPenhascos`).
    ...penhascosDoArquivo(parsed.penhascos),
    // TEXTURAS: campos NOVOS e OPCIONAIS. Passo torto sai; lista vazia abre sem o campo (`lerTexturas`).
    ...texturasDoArquivo(parsed.texturas, parsed.texturasImportadas),
    // CARIMBOS: campos NOVOS e OPCIONAIS. Objeto torto sai; lista vazia abre sem o campo (`lerCarimbos`).
    ...carimbosDoArquivo(parsed.carimbos, parsed.carimbosImportados),
    // TEXTO DE CHEGADA: campo NOVO e OPCIONAL. Texto vazio ou o que não é
    // texto (editado à mão) abre sem o campo — ver `readArrivalText`.
    ...arrivalTextField(parsed.textoChegada),
    // RELÓGIO DA CAMPANHA: campo NOVO e OPCIONAL, mesmo padrão de `worldMap`.
    ...(parsed.externa === true ? { externa: true } : {}),
    // MAPA POR ANDARES: campo NOVO e OPCIONAL. Forma torta abre como cena comum — ver `readSceneFloor`.
    ...sceneFloorField(parsed.andar),
    // NÍVEL DE ALERTA: campo NOVO e OPCIONAL, mesmo padrão de `movement`.
    ...alertaField(parsed.alerta),
    // ESTEIRA: campo NOVO e OPCIONAL, mesmo padrão de `hazards` — ver `readConveyors`.
    ...conveyorsField(parsed.conveyors),
  }
}

/** `textoChegada` só entra no mapa quando o arquivo traz texto: mapa de antes não ganha campo. */
function arrivalTextField(raw: unknown): Pick<MapData, 'textoChegada'> {
  const textoChegada = readArrivalText(raw)
  return textoChegada === undefined ? {} : { textoChegada }
}

/** `andar` só entra no mapa quando o arquivo traz prédio e rótulo válidos: mapa de antes não ganha campo. */
function sceneFloorField(raw: unknown): Pick<MapData, 'andar'> {
  const andar = readSceneFloor(raw)
  return andar === undefined ? {} : { andar }
}

/** `conveyors` só entra no mapa quando o arquivo traz esteira válida: mapa de antes não ganha campo. */
function conveyorsField(raw: unknown): Pick<MapData, 'conveyors'> {
  const conveyors = readConveyors(raw)
  return conveyors === undefined ? {} : { conveyors }
}

/** `hazards` só entra no mapa quando o arquivo traz zona válida: mapa de antes não ganha campo. */
function hazardsField(raw: unknown): Pick<MapData, 'hazards'> {
  const hazards = readHazards(raw)
  return hazards === undefined ? {} : { hazards }
}

/** `gatilhos` só entra no mapa quando o arquivo traz gatilho válido: mapa de antes não ganha campo. */
function areaTriggersField(raw: unknown): Pick<MapData, 'gatilhos'> {
  const gatilhos = readAreaTriggers(raw)
  return gatilhos === undefined ? {} : { gatilhos }
}

/** TEXTURAS: cada campo só entra com algum item lido (`lib/texturas.ts`). */
function texturasDoArquivo(passos: unknown, importadas: unknown): Pick<MapData, 'texturas' | 'texturasImportadas'> {
  const texturas = lerTexturas(passos)
  const texturasImportadas = lerTexturasImportadas(importadas)
  return { ...(texturas === undefined ? {} : { texturas }), ...(texturasImportadas === undefined ? {} : { texturasImportadas }) }
}

/** CARIMBOS: cada campo só entra com algum item lido (`lib/carimbos.ts`). */
function carimbosDoArquivo(objetos: unknown, importados: unknown): Pick<MapData, 'carimbos' | 'carimbosImportados'> {
  const carimbos = lerCarimbos(objetos)
  const carimbosImportados = lerCarimbosImportados(importados)
  return { ...(carimbos === undefined ? {} : { carimbos }), ...(carimbosImportados === undefined ? {} : { carimbosImportados }) }
}

/** PENHASCO: o campo só entra com algum risco lido (`lib/penhasco.ts`). */
function penhascosDoArquivo(valor: unknown): Pick<MapData, 'penhascos'> {
  const penhascos = lerPenhascos(valor)
  return penhascos === undefined ? {} : { penhascos }
}
