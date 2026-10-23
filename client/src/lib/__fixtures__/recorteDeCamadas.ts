/**
 * MAPA ANTIGO NO RECORTE DO JOGADOR — os casos congelados em
 * `__fixtures__/recorte-b934f2a1/` (saída de `filterMapForPlayer` no código de
 * b934f2a1, antes da fatia 2 das camadas). O mesmo módulo monta os casos no
 * código de antes (para congelar) e no de agora (para comparar), então mapa,
 * jogador, raio e camadas ocultas não têm como divergir entre os dois.
 */
import type { LayerId, MapData, Region, Token } from '../../types/map'
import { filterMapForPlayer, planOfWholeMap } from '../fogFilter'
import { createEmptyMap } from '../mapFactory'
import { deserializeMap } from '../mapFile'
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
