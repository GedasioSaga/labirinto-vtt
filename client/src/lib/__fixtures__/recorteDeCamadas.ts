/**
 * MAPA ANTIGO NO RECORTE DO JOGADOR — os casos congelados em
 * `__fixtures__/recorte-b934f2a1/` (saída de `filterMapForPlayer` no código de
 * b934f2a1, antes da fatia 2 das camadas). O mesmo módulo monta os casos no
 * código de antes (para congelar) e no de agora (para comparar), então mapa,
 * jogador, raio e camadas ocultas não têm como divergir entre os dois.
 */
import type { CamadaPadraoId, LayerId, MapData, Region, Token } from '../../types/map'
import { buildFreehandDrawing, buildLightAt, buildRegionFromPoints, buildTextDrawing, buildWallFromDraft } from '../drawingFactory'
import { buildFloorPiece } from '../floorTool'
import { filterMapForPlayer, planOfWholeMap } from '../fogFilter'
import { buildPin, createEmptyMap } from '../mapFactory'
import { deserializeMap } from '../mapFile'
import { criarMovel } from '../mobilia'
import { buildStairFromDraft } from '../stairs'
import { caminho, carimbo, enfeite, escada, ficha, GRADE, linha, luz, marcador, objeto, parede, peca, pino, porta, rabisco, regiao, texto } from './itensDeCamada'
import antesAndar6 from './roundtrip-924c2bdd/andar6.json'
import antesL1 from './roundtrip-924c2bdd/L1.json'
import antesTorre from './roundtrip-924c2bdd/torre.json'

/** O jogador do recorte e a ficha que é o olho dele. */
export const JOGADOR = 'p1'
const OLHO = 'olho'
/** Raio que cobre os mapas inteiros: o que esconde é parede, teto e camada, não a distância. */
const RAIO = 5000

/** As combinações de `hiddenLayers` congeladas, por nome de arquivo. */
export const OCULTAS_CONGELADAS: Readonly<Record<string, readonly LayerId[]>> = {
  nenhuma: [],
  paredes: ['paredes'],
  portas: ['portas'],
  salas: ['salas'],
  anotacoes: ['anotacoes'],
}

function olhoEm(x: number, y: number): Token {
  return { id: OLHO, characterId: null, name: 'Olho', x, y, size: 1, image: null }
}

function doArquivo(json: unknown, x: number, y: number): MapData {
  const map = deserializeMap(JSON.stringify(json))
  return { ...map, tokens: [...map.tokens, olhoEm(x, y)] }
}

/** Sala com teto de construção, longe do olho: o teto sai fechado. */
const CASA: Region = { ...regiao, id: 'casa', points: [{ x: 400, y: 64 }, { x: 576, y: 64 }, { x: 576, y: 192 }, { x: 400, y: 192 }], room: { shape: 'rect', name: 'Casa', roof: true } }

/** Um item de cada tipo que mora numa camada, chão, linha e marcador inclusive. */
export function mapaDeItens(): MapData {
  return {
    ...createEmptyMap('m-itens', 'Itens', 10, 10, GRADE),
    walls: [parede, porta],
    regions: [regiao, CASA],
    stairs: [escada],
    lights: [luz],
    tokens: [ficha, olhoEm(300, 300)],
    pins: [pino],
    props: [objeto, enfeite],
    floor: [peca],
    lines: [linha],
    markers: [marcador],
    carimbos: [carimbo],
    drawings: [rabisco, texto, caminho],
  }
}

/**
 * Mapa com TUDO o que a camada corta, à vista do olho e dentro do chão: chão
 * (duas peças), linha, marcador, luz, nuvens, relevo, escada, objeto,
 * decoração, outra ficha, pino, desenho, texto e carimbo. Parede e porta
 * ficam embaixo, dentro da sala e atrás de tudo, para não taparem nada.
 */
export function mapaCompleto(): MapData {
  return {
    ...createEmptyMap('m-completo', 'Completo', 20, 20, GRADE),
    walls: [
      buildWallFromDraft('cw1', { x: 352, y: 928 }, { x: 448, y: 928 }),
      { ...buildWallFromDraft('cw2', { x: 480, y: 928 }, { x: 576, y: 928 }), door: { kind: 'normal', open: false, locked: false } },
    ],
    regions: [buildRegionFromPoints('cr1', [{ x: 320, y: 320 }, { x: 960, y: 320 }, { x: 960, y: 960 }, { x: 320, y: 960 }])],
    floor: [
      buildFloorPiece('cf1', { kind: 'rect', cx: 640, cy: 640, w: 640, h: 640 }, 'add'),
      buildFloorPiece('cf2', { kind: 'rect', cx: 1024, cy: 448, w: 128, h: 128 }, 'add'),
    ],
    lines: [{ id: 'cml1', points: [{ x: 400, y: 800 }, { x: 560, y: 800 }], closed: false, dotted: false, color: '#000000', width: 2 }],
    markers: [{ id: 'cmk1', cx: 720, cy: 800, w: 10, h: 10, rotation: 0, color: '#000000' }],
    lights: [buildLightAt('cl1', { x: 800, y: 500 }, GRADE)],
    stairs: [buildStairFromDraft('cs1', { x: 480, y: 400 }, { x: 544, y: 528 }, 16)],
    props: [criarMovel('barril', { x: 704, y: 704 }, GRADE, 'co1'), { ...criarMovel('caixa', { x: 768, y: 704 }, GRADE, 'co2'), layer: 'decoracao' }],
    tokens: [{ id: 'ct1', characterId: null, name: 'Bia', x: 576, y: 576, size: 1, image: null }, olhoEm(640, 640)],
    pins: [buildPin('cp1', { x: 704, y: 576 }, 'exclamacao')],
    drawings: [buildFreehandDrawing('cd1', [{ x: 400, y: 400 }, { x: 420, y: 420 }], '#000000', 2), buildTextDrawing('cd2', { x: 512, y: 704 }, '#000000', 12)],
    carimbos: [{ id: 'cc1', tipo: 'pinheiro', x: 896, y: 832, tamanho: 30, giro: 45 }],
    nuvens: true,
    relevo: true,
  }
}

/** A camada padrão de cada item de `mapaCompleto` (nenhum escolheu outra). */
export const CAMADA_NO_COMPLETO: Readonly<Record<string, CamadaPadraoId>> = {
  cw1: 'paredes',
  cw2: 'portas',
  cr1: 'salas',
  cf1: 'chao',
  cf2: 'chao',
  cml1: 'paredes',
  cmk1: 'portas',
  cl1: 'iluminacao',
  cs1: 'escadas',
  co1: 'objetos',
  co2: 'decoracao',
  ct1: 'tokens',
  cp1: 'anotacoes',
  cd1: 'desenhos',
  cd2: 'anotacoes',
  cc1: 'terreno',
}

/** As combinações de `hiddenLayers` congeladas para `mapaCompleto`: cada uma das 9 e misturas de duas. */
export const OCULTAS_DO_COMPLETO: Readonly<Record<string, readonly LayerId[]>> = {
  nenhuma: [],
  paredes: ['paredes'],
  portas: ['portas'],
  salas: ['salas'],
  escadas: ['escadas'],
  objetos: ['objetos'],
  decoracao: ['decoracao'],
  iluminacao: ['iluminacao'],
  tokens: ['tokens'],
  anotacoes: ['anotacoes'],
  'tokens+iluminacao': ['tokens', 'iluminacao'],
  'objetos+decoracao': ['objetos', 'decoracao'],
  'salas+escadas': ['salas', 'escadas'],
  'paredes+portas': ['paredes', 'portas'],
  'anotacoes+tokens': ['anotacoes', 'tokens'],
}

export const MAPAS_COMPLETOS: readonly MapaCongelado[] = [
  { nome: 'completo', mapa: mapaCompleto, memoria: false },
  { nome: 'completo-memoria', mapa: mapaCompleto, memoria: true },
]

export interface MapaCongelado {
  /** Nome do arquivo em `recorte-b934f2a1/`. */
  nome: string
  mapa: () => MapData
  /** Recorte com a memória da planta inteira (`planOfWholeMap`). */
  memoria: boolean
}

export const MAPAS_CONGELADOS: readonly MapaCongelado[] = [
  { nome: 'L1', mapa: () => doArquivo(antesL1, 400, 300), memoria: false },
  { nome: 'andar6', mapa: () => doArquivo(antesAndar6, 200, 200), memoria: false },
  { nome: 'torre', mapa: () => doArquivo(antesTorre, 200, 200), memoria: false },
  { nome: 'itens', mapa: mapaDeItens, memoria: false },
  { nome: 'itens-memoria', mapa: mapaDeItens, memoria: true },
]

/** `Map` e `Set` viram listas no JSON (sem isto sairiam `{}` e a comparação não veria nada neles). */
function comColecoes(_chave: string, valor: unknown): unknown {
  if (valor instanceof Map) return { mapa: [...valor] }
  if (valor instanceof Set) return { conjunto: [...valor] }
  return valor
}

/** O recorte como ele atravessa a rede: JSON (campo `undefined` some). */
export function recorteEmJson(caso: MapaCongelado, ocultas: readonly LayerId[]): unknown {
  const map = caso.mapa()
  const view = filterMapForPlayer(
    { ...map, hiddenLayers: [...ocultas] },
    JOGADOR,
    { [JOGADOR]: [OLHO] },
    RAIO,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    caso.memoria ? planOfWholeMap(map) : undefined,
  )
  const json: unknown = JSON.parse(JSON.stringify(view, comColecoes))
  return json
}
