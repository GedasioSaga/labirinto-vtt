/**
 * Cena dos testes de segurança do "Fora do Chão: livre" (`MapData.offFloor`).
 *
 * Geometria (px de mundo, mapa 1000 x 1000, grade 40): o Chão é a metade
 * esquerda (x de 0 a 500) e a ficha do jogador fica em (200, 200), dentro
 * dele. O ESCONDERIJO é o quadrado 600..800 x 100..300, todo FORA do Chão e
 * bem na linha do olhar da ficha: com a cena livre a visão dela chega lá, e o
 * que o mestre escondeu ali tem de continuar escondido.
 */
import type { Drawing, FloorPiece, MapData, Pin, Prop, Region, RegionPoint, Token, Wall } from '../../types/map'
import { createEmptyMap } from '../mapFactory'

export const GRADE = 40
export const RAIO = 700
export const POSSE = { p1: ['heroi'] }

export const ESCONDERIJO: RegionPoint[] = [
  { x: 600, y: 100 },
  { x: 800, y: 100 },
  { x: 800, y: 300 },
  { x: 600, y: 300 },
]
/** No meio do esconderijo. */
export const DENTRO: RegionPoint = { x: 700, y: 200 }
/** Fora do Chão e fora do esconderijo, à vista da ficha: só a cena livre mostra. */
export const LA_FORA: RegionPoint = { x: 700, y: 500 }

/** Tudo que o mestre pôs dentro do esconderijo: nenhum destes textos pode chegar ao jogador. */
export const ESCONDIDOS = ['npc-escondido', 'texto-escondido', 'pino-escondido', 'bau-escondido', 'parede-escondida', 'chao-escondido', 'tapete-escondido', 'textura-escondida']

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, regionId?: string): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...(regionId === undefined ? {} : { regionId }) }
}

function chao(id: string, cx: number, cy: number, w: number, h: number): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {} }
}

const TEXTO: Drawing = { id: 'texto-escondido', kind: 'text', x: 680, y: 180, text: 'texto-escondido', color: '#fff', fontSize: 12 }
const TAPETE: Drawing = {
  id: 'tapete-escondido',
  kind: 'polygon',
  points: [
    { x: 640, y: 230 },
    { x: 760, y: 230 },
    { x: 760, y: 280 },
    { x: 640, y: 280 },
  ],
  color: '#38210c',
  width: 0,
  filled: true,
  fillAlpha: 1,
}
const PINO: Pin = { id: 'pino-escondido', kind: 'exclamacao', x: 720, y: 220, description: 'descricao-pino-escondido', image: null }
const BAU: Prop = { id: 'bau-escondido', src: '', x: 700, y: 240, width: 40, height: 40, linkedMapPath: null }

/** As quatro paredes do esconderijo, fechadas, ligadas à Sala `regionId`. */
function muros(regionId: string): Wall[] {
  return ESCONDERIJO.map((a, i) => {
    const b = ESCONDERIJO[(i + 1) % ESCONDERIJO.length] ?? a
    return parede(`muro-${i}`, a.x, a.y, b.x, b.y, regionId)
  })
}

function sala(id: string, extra: Partial<Region>): Region {
  return { id, points: ESCONDERIJO, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: `nome-${id}` }, ...extra }
}

export type Esconderijo = 'zona oculta' | 'sala secreta fechada' | 'teto fechado'
export const ESCONDERIJOS: readonly Esconderijo[] = ['zona oculta', 'sala secreta fechada', 'teto fechado']

function comoEsconde(tipo: Esconderijo): Partial<MapData> {
  if (tipo === 'zona oculta') return { concealZones: [{ id: 'zona', name: 'Tesouro do mestre', revealed: false, points: ESCONDERIJO }] }
  if (tipo === 'sala secreta fechada') return { regions: [sala('sala-secreta', { secret: true })], walls: muros('sala-secreta') }
  return { regions: [sala('casa', { room: { shape: 'rect', name: 'nome-casa', roof: true } })], walls: muros('casa') }
}

/**
 * A cena com Chão, LIVRE, e o esconderijo cheio. `semChao` devolve a MESMA
 * cena sem nenhuma peça de Chão e sem a opção: é a régua do que a livre herda.
 */
export function cenaLivreComEsconderijo(tipo: Esconderijo): MapData {
  const esconde = comoEsconde(tipo)
  return {
    ...createEmptyMap('m', 'Cripta', 25, 25, GRADE),
    offFloor: 'free',
    floor: [chao('chao', 250, 500, 500, 1000), chao('chao-escondido', DENTRO.x, DENTRO.y, 160, 160)],
    tokens: [ficha('heroi', 200, 200), ficha('npc-escondido', DENTRO.x, DENTRO.y), ficha('la-fora', LA_FORA.x, LA_FORA.y)],
    drawings: [TEXTO, TAPETE],
    texturas: [{ id: 'textura-escondida', tipo: 'balde', textura: 'conves', forca: 0.8, alvo: { tipo: 'desenho', id: 'tapete-escondido' } }],
    pins: [PINO],
    props: [BAU],
    ...esconde,
    walls: [...(esconde.walls ?? []), parede('parede-escondida', 650, 150, 750, 150)],
  }
}

export function semChao(map: MapData): MapData {
  const { offFloor: _livre, ...resto } = map
  return { ...resto, floor: [] }
}
