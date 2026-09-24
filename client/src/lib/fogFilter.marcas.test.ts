import { describe, expect, it } from 'vitest'
import type { ConcealZone, MapData, MarcaNoLugar, Region, Token } from '../types/map'
import { createExploration, markRings } from './exploration'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * BILHETE NO LUGAR no recorte do jogador. A marca que um jogador deixou é
 * planta anotada: sai para quem já VIU aquele ponto (na visão agora ou no
 * explorado), pela mesma regra do marcador. Nunca sai o que o recorte esconde
 * — névoa, zona oculta ativa, sala secreta — e nunca sai quem deixou nem
 * quando: só o mestre lê o autor.
 */

const RAIO = 300
const POSSE = { ana: ['ficha-ana'], bruno: ['ficha-bruno'] }
const TEXTO = 'Cuidado: o piso cede'
const AUTORA = 'Ana-que-deixou'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function bilhete(id: string, x: number, y: number, extra: Partial<MarcaNoLugar> = {}): MarcaNoLugar {
  return { id, tipo: 'bilhete', x, y, texto: TEXTO, autor: AUTORA, em: 1_700_000_000_000, ...extra }
}

/** Ana em (200, 200); Bruno longe, em (2000, 2000). Sem paredes: a visão é o círculo do raio. */
function corredor(marcas: MarcaNoLugar[], extra: Partial<MapData> = {}): MapData {
  return {
    ...createEmptyMap('m-corredor', 'Corredor Longo', 60, 60, 40),
    tokens: [ficha('ficha-ana', 200, 200), ficha('ficha-bruno', 2000, 2000)],
    marcas,
    ...extra,
  }
}

function sala(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: '#2b2b2b',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Quarto Secreto' },
    ...extra,
  }
}

const idsDasMarcas = (map: MapData, playerId: string): string[] =>
  (filterMapForPlayer(map, playerId, POSSE, RAIO).map.marcas ?? []).map((m) => m.id)

describe('fogFilter: bilhete no lugar', () => {
  it('marca dentro da visão sai; a que a névoa esconde NÃO sai, nem o id nem o texto', () => {
    const map = corredor([bilhete('perto', 260, 200), bilhete('longe', 1500, 200, { texto: 'segredo do fundo' })])
    const view = filterMapForPlayer(map, 'ana', POSSE, RAIO)
    expect((view.map.marcas ?? []).map((m) => m.id)).toEqual(['perto'])
    const rede = JSON.stringify(view)
    expect(rede).toContain(TEXTO)
    expect(rede).not.toContain('longe')
    expect(rede).not.toContain('segredo do fundo')
  })

  it('quem passar depois vê: longe dela não recebe; já explorado, recebe', () => {
    const map = corredor([bilhete('b1', 260, 200)])
    // Bruno está longe e nunca passou ali.
    expect(idsDasMarcas(map, 'bruno')).toEqual([])
    // Bruno já passou pelo corredor (explorado), mesmo sem ver agora: é planta que ele conhece.
    const explorado = createExploration({ width: 60 * 40, height: 60 * 40, grid: 40 })
    markRings(explorado, [[{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 300 }, { x: 100, y: 300 }]], [])
    const view = filterMapForPlayer(map, 'bruno', POSSE, RAIO, explorado)
    expect((view.map.marcas ?? []).map((m) => m.id)).toEqual(['b1'])
  })

  it('nunca leva quem deixou nem a hora: só o mestre lê o autor', () => {
    const view = filterMapForPlayer(corredor([bilhete('b1', 260, 200)]), 'ana', POSSE, RAIO)
    const [marca] = view.map.marcas ?? []
    expect(marca).toEqual({ id: 'b1', tipo: 'bilhete', x: 260, y: 200, texto: TEXTO })
    expect(JSON.stringify(view)).not.toContain(AUTORA)
    expect(JSON.stringify(view)).not.toContain('1700000000000')
  })

  it('seta de giz sai com o rumo e sem texto', () => {
    const seta: MarcaNoLugar = { id: 's1', tipo: 'seta', x: 240, y: 240, rumo: 'ne', autor: AUTORA, em: 5 }
    const [marca] = filterMapForPlayer(corredor([seta]), 'ana', POSSE, RAIO).map.marcas ?? []
    expect(marca).toEqual({ id: 's1', tipo: 'seta', x: 240, y: 240, rumo: 'ne' })
  })

  it('campo desconhecido gravado na marca não atravessa (lista do que vai, não do que sai)', () => {
    const torta = { ...bilhete('b1', 260, 200), notaDoMestre: 'foi o Guarda que escreveu' }
    const view = filterMapForPlayer(corredor([torta]), 'ana', POSSE, RAIO)
    expect((view.map.marcas ?? []).map((m) => m.id)).toEqual(['b1'])
    expect(JSON.stringify(view)).not.toContain('foi o Guarda')
  })

  it('zona oculta ativa esconde a marca, mesmo dentro da visão', () => {
    const zona: ConcealZone = {
      id: 'z1',
      name: 'Alçapão',
      revealed: false,
      points: [
        { x: 240, y: 180 },
        { x: 300, y: 180 },
        { x: 300, y: 240 },
        { x: 240, y: 240 },
      ],
    }
    const map = corredor([bilhete('b1', 260, 200)], { concealZones: [zona] })
    const view = filterMapForPlayer(map, 'ana', POSSE, RAIO)
    expect(view.map.marcas ?? []).toEqual([])
    expect(JSON.stringify(view)).not.toContain(TEXTO)
    // Controle: zona revelada, a marca volta.
    expect(idsDasMarcas(corredor([bilhete('b1', 260, 200)], { concealZones: [{ ...zona, revealed: true }] }), 'ana')).toEqual(['b1'])
  })

  it('sala secreta esconde a marca que ficou lá dentro', () => {
    const map = corredor([bilhete('b1', 260, 200)], { regions: [sala('r-sec', 230, 170, 330, 260, { secret: true })] })
    const view = filterMapForPlayer(map, 'ana', POSSE, RAIO)
    expect(view.map.marcas ?? []).toEqual([])
    expect(JSON.stringify(view)).not.toContain(TEXTO)
  })

  it('mapa sem o campo (antigo) continua sem o campo no recorte', () => {
    const view = filterMapForPlayer(corredor([], { marcas: undefined }), 'ana', POSSE, RAIO)
    expect(view.map.marcas).toBeUndefined()
    expect('marcas' in view.map && view.map.marcas !== undefined).toBe(false)
  })
})
