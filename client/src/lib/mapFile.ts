import type { DoorState, FloorStyle, MapData, Region } from '../types/map'
import { readDoorKey } from './doorKey'
import { linkLooseWallsToRooms } from './roomLink'
import { isPinIcon, isPinKind, isPinPassage } from './pins'
import { cleanExitLabel, readPinDestination, readPinExits } from './pinTravel'
import { readMovementRules } from './movementRules'
import { readCarriedItems, readPinItem } from './items'

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
 * CHAVE ABRE PORTA: o "Abre com" é campo NOVO e OPCIONAL. Ausente continua
 * ausente (o round-trip do mapa antigo não ganha campo); o que não é texto sai
 * — a porta continua trancada, só deixa de abrir com item.
 */
function doorFromFile(door: DoorState): DoorState {
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
      door: w.door ? doorFromFile({ ...w.door, kind: w.door.kind ?? 'normal' }) : null,
    })),
    lights: entityList(parsed.lights),
    // inalterado — `room` ausente fica undefined (região comum); o ângulo do
    // giro da sala passa como veio, desde que seja número (`roomRotationFromFile`)
    regions: entityList(parsed.regions).map((r) =>
      roomRotationFromFile({ ...r, fillColor: r.fillColor ?? '#3a7ad0', fillPattern: r.fillPattern ?? 'solid' }),
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
    tokens: entityList(parsed.tokens).map((t) => {
      const lido = { ...t, image: t.image ?? null }
      if (!('mochila' in t)) return lido
      const mochila = readCarriedItems(t.mochila)
      if (mochila !== undefined) return { ...lido, mochila }
      const { mochila: _descartada, ...semMochila } = lido
      return semMochila
    }),
    // inalterado fora o que já existia — Prop.layer ausente fica undefined
    props: entityList(parsed.props).map((p) => ({ ...p, linkedMapPath: p.linkedMapPath ?? null })),
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
      image: typeof p.image === 'string' ? p.image : null,
      destino: p.destino === undefined ? undefined : readPinDestination(p.destino),
      // `passagem` é campo NOVO e OPCIONAL do pino de viagem: ausente é "pede
      // ao mestre", o de sempre. Valor desconhecido (arquivo editado à mão,
      // versão futura) volta AUSENTE, e não como "livre": na dúvida, a porta
      // pergunta ao mestre em vez de deixar o grupo passar sem ninguém ver.
      passagem: isPinPassage(p.passagem) ? p.passagem : undefined,
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
      escolhas: undefined,
      // ITEM PEGÁVEL: campo NOVO e OPCIONAL. Forma errada volta ausente (o
      // pino só deixa de ser pegável); `livre` só vale `true` (`readPinItem`).
      item: readPinItem(p.item),
    })),
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
    ownerId: parsed.ownerId ?? null,
    scenarioLink: parsed.scenarioLink ?? null,
    // MOVIMENTO CONTADO: campo NOVO e OPCIONAL. Mapa de antes (ou com lixo
    // editado à mão) abre livre e sem o campo — ver `readMovementRules`.
    ...movementField(parsed.movement),
  }
}
