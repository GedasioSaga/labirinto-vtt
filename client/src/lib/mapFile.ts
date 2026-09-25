import type { DoorState, FloorStyle, MapData, Prop, Region } from '../types/map'
import { propPlayerImage, propPlayerLabel } from './propPlayerLook'
import { readDoorKey } from './doorKey'
import { lerMarcasDoArquivo } from './marcas'
import { linkLooseWallsToRooms } from './roomLink'
import {
  cleanPinName,
  isPinBlockReason,
  isPinIcon,
  isPinKind,
  isPinPassage,
  isPinReadDistance,
} from './pins'
import { readPinLock } from './pinLock'
import { cleanExitLabel, readPinDestination, readPinExits } from './pinTravel'
import { readSceneVisionCells } from './sceneVision'
import { tokenPublicNameFromFile } from './tokenPublicName'
import { readPinAttachment } from './pinAttach'
import { readMovementRules } from './movementRules'
import { readCarriedItems, readPinItem } from './items'
import { readPinPass } from './pinPass'
import { readHazards } from './hazards'
import { readPinLeverDoor } from './lever'
import { readAreaTriggers } from './areaTriggers'
import { readArrivalText } from './arrivalText'
import { readSceneFloor } from './buildingFloors'
import { lerAlerta, lerFaccao } from './faccoes'

/** Chão de mapa NOVO: marrom chapado do minimapa do Resident Evil 4 (15/09/2026). */
export const DEFAULT_FLOOR_STYLE: FloorStyle = { fillColor: '#a8776a', strokeColor: null, strokeWidth: 1 }

/**
 * Chão de mapa SALVO antes do campo `floorStyle` existir: o verde do minimapa
 * dos mapas de referência (`Objetivo/*.png`, cor dominante #006B00). Fica
 * separado do default novo para mapa antigo abrir igual a antes.
 */
export const LEGACY_FLOOR_STYLE: FloorStyle = { fillColor: '#006b00', strokeColor: null, strokeWidth: 1 }

export function serializeMap(map: MapData): string {
  return JSON.stringify(map, null, 2)
}

export function deserializeMap(json: string): MapData {
  const map = deserializeMapFields(json)
  // Mapa salvo antes de a porta manter o vínculo com a Sala: pedaços de parede
  // soltos sobre a aresta de uma Sala voltam a ser dela (`lib/roomLink.ts`).
  const walls = linkLooseWallsToRooms(map.regions, map.walls)
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
function entityList<T>(value: T[] | undefined): T[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item !== null && typeof item === 'object')
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

/** Lista de valores simples (ids de camada): só a forma de lista é garantida. */
function plainList<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : []
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
 * Porta lida do disco. `kind` virou obrigatório (porta antiga migra para
 * 'normal'). `secret` (porta secreta) é campo NOVO: só `true` volta; qualquer
 * outro valor sai do objeto, e a porta abre como porta comum — como sempre foi.
 * `opensFrom` (porta de um lado) é campo NOVO pelo mesmo critério: só
 * 'left'/'right' voltam; qualquer outro valor sai, e a porta abre dos dois lados.
 */
function doorFromFile(door: DoorState): DoorState {
  const { secret, opensFrom, ...rest } = doorKeyFromFile(door)
  // `door` vem de JSON.parse: o tipo declarado não garante o valor, por isso a checagem de runtime.
  const side: unknown = opensFrom
  const withKind: DoorState = { ...rest, kind: rest.kind ?? 'normal' }
  const withSecret: DoorState = secret === true ? { ...withKind, secret: true } : withKind
  return side === 'left' || side === 'right' ? { ...withSecret, opensFrom: side } : withSecret
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

  return {
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
    walls: entityList(parsed.walls).map((w) => ({
      ...w,
      door: w.door ? doorFromFile(w.door) : null,
    })),
    lights: entityList(parsed.lights),
    // inalterado — `room` ausente fica undefined (região comum); o ângulo do
    // giro da sala passa como veio, desde que seja número (`roomRotationFromFile`)
    regions: entityList(parsed.regions).map((r) =>
      roomFaccaoFromFile(roomDarkFromFile(roomTextsFromFile(roomRotationFromFile({ ...r, fillColor: r.fillColor ?? '#3a7ad0', fillPattern: r.fillPattern ?? 'solid' })))),
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
    tokens: entityList(parsed.tokens).map((t) => {
      const lido = tokenPublicNameFromFile({ ...t, image: t.image ?? null })
      if (!('mochila' in t)) return lido
      const mochila = readCarriedItems(t.mochila)
      if (mochila !== undefined) return { ...lido, mochila }
      const { mochila: _descartada, ...semMochila } = lido
      return semMochila
    }),
    // inalterado fora o que já existia — Prop.layer ausente fica undefined.
    // OBJETO COM RÓTULO OU IMAGEM: os dois campos são novos e opcionais —
    // ausente continua ausente. Presente, só na forma de `propPlayerLook.ts`
    // (rótulo curto, imagem em data URL); o resto sai em vez de ir parar na
    // tela do jogador.
    props: entityList(parsed.props).map((p) => readPropPlayerLook({ ...p, linkedMapPath: p.linkedMapPath ?? null })),
    stairs: entityList(parsed.stairs),
    // MUDA de cru para .map(): PONTO DE MAIOR RISCO DE TODA A MIGRAÇÃO.
    // 0.5/0 é o alpha que drawDrawings.ts:50 já aplicava (filled ? 0.5 : 0);
    // sem esta linha, alpha: undefined vira 1 no Pixi e TODO círculo
    // preenchido de mapa salvo muda de aparência ao abrir.
    drawings: entityList(parsed.drawings).map((d) =>
      d.kind === 'circle' && d.fillAlpha === undefined ? { ...d, fillAlpha: d.filled ? 0.5 : 0 } : d,
    ),
    // MUDA de cru para .map(): `FloorPiece.fillColor` (cor própria do caminho)
    // é campo NOVO. O default dele é a AUSÊNCIA — peça sem cor própria usa
    // `floorStyle.fillColor`, que é exatamente como todo mapa salvo antes deste
    // campo se desenhava. Valor que não é string (arquivo editado à mão, versão
    // futura) é descartado em vez de recusado: `new Color(...)` com lixo dentro
    // estouraria no render e levaria o mapa inteiro junto.
    floor: entityList(parsed.floor).map((f) => (typeof f.fillColor === 'string' ? f : { ...f, fillColor: undefined })),
    floorStyle: parsed.floorStyle ?? { ...LEGACY_FLOOR_STYLE },
    lines: entityList(parsed.lines),
    markers: entityList(parsed.markers),
    concealZones: entityList(parsed.concealZones),
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
    pins: entityList(parsed.pins).map((p) => ({
      ...p,
      kind: isPinKind(p.kind) ? p.kind : 'exclamacao',
      icon: isPinIcon(p.icon) ? p.icon : undefined,
      description: typeof p.description === 'string' ? p.description : '',
      // NOME SÓ DO MESTRE: campo NOVO e OPCIONAL. Texto aparado e no teto;
      // em branco ou torto (número, arquivo editado à mão) volta AUSENTE.
      nome: cleanPinName(p.nome) || undefined,
      // NOTA DO MESTRE: campo NOVO e OPCIONAL. Só texto volta; o resto
      // (número, objeto, arquivo editado à mão) volta AUSENTE, sem inventar
      // chave em mapa antigo. O `...p` acima copiaria o valor cru.
      notaDoMestre: typeof p.notaDoMestre === 'string' ? p.notaDoMestre : undefined,
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
      // `longe` e `soMarco` são só do recorte do jogador, como `escolhas`.
      longe: undefined,
      soMarco: undefined,
      escolhas: undefined,
      // ITEM PEGÁVEL: campo NOVO e OPCIONAL. Forma errada volta ausente (o
      // pino só deixa de ser pegável); `livre` só vale `true` (`readPinItem`).
      item: readPinItem(p.item),
      // CHAVE ABRE PORTA no pino trancado: campo NOVO e OPCIONAL, com a mesma
      // leitura do "Abre com" da porta. `chave` é só do recorte do jogador:
      // arquivo que o traga não o põe no mapa do mestre.
      abreCom: p.abreCom === undefined ? undefined : readDoorKey(p.abreCom),
      chave: undefined,
      // ALAVANCA: campo NOVO e OPCIONAL. Só texto não vazio vale; o resto
      // volta AUSENTE (alavanca solta, que não move nada) — ver `readPinLeverDoor`.
      portaLigada: readPinLeverDoor(p.portaLigada),
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
    })),
    // BILHETE NO LUGAR: campo NOVO e OPCIONAL. Ausente continua ausente (sem a
    // chave, nem `undefined`): o round-trip de mapa antigo sai idêntico. Marca
    // torta cai sozinha e as boas ficam (`lerMarcasDoArquivo`).
    ...marcasDoArquivo(parsed.marcas),
    frame: parsed.frame ?? null,
    fog: parsed.fog ?? { mode: 'none', revealed: [] },
    hiddenLayers: plainList(parsed.hiddenLayers),
    // NOVO (Onda 4, Frente D) — mesmo padrão de hiddenLayers acima: mapa
    // salvo antes deste campo existir abre com nada travado.
    lockedLayers: plainList(parsed.lockedLayers),
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
    // TEXTO DE CHEGADA: campo NOVO e OPCIONAL. Texto vazio ou o que não é
    // texto (editado à mão) abre sem o campo — ver `readArrivalText`.
    ...arrivalTextField(parsed.textoChegada),
    // RELÓGIO DA CAMPANHA: campo NOVO e OPCIONAL, mesmo padrão de `worldMap`.
    ...(parsed.externa === true ? { externa: true } : {}),
    // MAPA POR ANDARES: campo NOVO e OPCIONAL. Forma torta abre como cena comum — ver `readSceneFloor`.
    ...sceneFloorField(parsed.andar),
    // NÍVEL DE ALERTA: campo NOVO e OPCIONAL, mesmo padrão de `movement`.
    ...alertaField(parsed.alerta),
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
