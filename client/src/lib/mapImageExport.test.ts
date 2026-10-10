import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Region, Token, Wall } from '../types/map'
import { createEmptyMap } from './mapFactory'
import {
  IMAGE_EXPORT_MAX_SCALE,
  IMAGE_EXPORT_MAX_SIDE_PX,
  dataUrlToBytes,
  imageExportFileName,
  imageExportScale,
  mapForImageExport,
} from './mapImageExport'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, color: '#ff5a00', ...extra }
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
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: id },
    ...extra,
  }
}

function parede(id: string, regionId?: string): Wall {
  return { id, x1: 10, y1: 10, x2: 90, y2: 10, blocksLight: true, blocksMove: true, door: null, ...(regionId ? { regionId } : {}) }
}

function pino(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: '', image: null, ...extra }
}

function cripta(overrides: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m1', 'Cripta do Farol', 20, 16, 50), showGrid: true, ...overrides }
}

const SEM_MESTRE = { grid: true, masterOnly: false }
const COM_MESTRE = { grid: true, masterOnly: true }

describe('imageExportScale', () => {
  it('mapa de 1000 x 800 sai no dobro (teto de escala)', () => {
    expect(imageExportScale(1000, 800)).toBe(IMAGE_EXPORT_MAX_SCALE)
  })

  it('mapa grande encolhe até o maior lado caber no limite', () => {
    const scale = imageExportScale(8000, 3000)
    // Igualdade exata como controle positivo: o maior lado (8000) é quem manda, não o menor.
    expect(scale).toBe(IMAGE_EXPORT_MAX_SIDE_PX / 8000)
    expect(Math.round(8000 * scale)).toBe(IMAGE_EXPORT_MAX_SIDE_PX)
    expect(scale).toBeGreaterThan(0)
    expect(scale).toBeLessThan(1)
  })

  it('mapa sem tamanho não quebra a conta', () => {
    expect(imageExportScale(0, 0)).toBe(1)
    expect(imageExportScale(Number.NaN, 10)).toBe(1)
  })
})

describe('imageExportFileName', () => {
  it('usa o nome do mapa com .png', () => {
    expect(imageExportFileName('Cripta do Farol')).toBe('Cripta do Farol.png')
  })

  it('tira o que o sistema não aceita em nome de arquivo', () => {
    expect(imageExportFileName('Sala 1/2: "A*B"? ')).toBe('Sala 12 AB.png')
  })

  it('nome vazio ou só com proibidos vira "mapa.png"', () => {
    expect(imageExportFileName('')).toBe('mapa.png')
    expect(imageExportFileName('***')).toBe('mapa.png')
  })
})

describe('dataUrlToBytes', () => {
  it('decodifica o PNG do data URL em bytes', () => {
    // "iVBORw0KGgo=" é a assinatura PNG 89 50 4E 47 0D 0A 1A 0A.
    expect(Array.from(dataUrlToBytes('data:image/png;base64,iVBORw0KGgo='))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  })

  it('recusa o que não é data URL em base64', () => {
    expect(() => dataUrlToBytes('iVBORw0KGgo=')).toThrow()
    expect(() => dataUrlToBytes('data:image/png,abc')).toThrow()
  })
})

describe('mapForImageExport', () => {
  it('a grade da imagem segue a opção, não a do editor', () => {
    expect(mapForImageExport(cripta({ showGrid: true }), { grid: false, masterOnly: true }).showGrid).toBe(false)
    expect(mapForImageExport(cripta({ showGrid: false }), { grid: true, masterOnly: true }).showGrid).toBe(true)
  })

  it('ficha "Oculta para jogadores" só sai com a opção do mestre ligada', () => {
    const map = cripta({ tokens: [ficha('lanterna', 875, 275), ficha('espreita', 875, 675, { secret: true })] })
    expect(mapForImageExport(map, SEM_MESTRE).tokens.map((t) => t.id)).toEqual(['lanterna'])
    expect(mapForImageExport(map, COM_MESTRE).tokens.map((t) => t.id)).toEqual(['lanterna', 'espreita'])
  })

  it('item "Oculto no editor" nunca sai, nem com a opção do mestre', () => {
    const map = cripta({ tokens: [ficha('fantasma', 100, 100, { hidden: true }), ficha('vivo', 200, 200)] })
    expect(mapForImageExport(map, COM_MESTRE).tokens.map((t) => t.id)).toEqual(['vivo'])
  })

  it('sala secreta some com as paredes dela, a sub-sala e o que está dentro', () => {
    const map = cripta({
      regions: [sala('cofre', 0, 0, 200, 200, { secret: true }), sala('nicho', 20, 20, 60, 60, { parentId: 'cofre' }), sala('salao', 400, 0, 600, 200)],
      walls: [parede('w-cofre', 'cofre'), parede('w-nicho', 'nicho'), { ...parede('w-salao', 'salao'), x1: 400, x2: 600 }],
      tokens: [ficha('guarda', 100, 100), ficha('heroi', 500, 100)],
      pins: [pino('tesouro', 150, 150), pino('porta', 500, 150)],
    })
    const out = mapForImageExport(map, SEM_MESTRE)
    expect(out.regions.map((r) => r.id)).toEqual(['salao'])
    expect(out.walls.map((w) => w.id)).toEqual(['w-salao'])
    expect(out.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(out.pins.map((p) => p.id)).toEqual(['porta'])

    const tudo = mapForImageExport(map, COM_MESTRE)
    expect(tudo.regions).toHaveLength(3)
    expect(tudo.tokens).toHaveLength(2)
  })

  it('zona oculta ativa: o contorno não sai e o que ela cobre também não', () => {
    const zona = { id: 'z1', name: 'Emboscada', revealed: false, points: sala('z', 0, 0, 100, 100).points }
    const revelada = { id: 'z2', name: 'Já vista', revealed: true, points: sala('z', 300, 0, 400, 100).points }
    const map = cripta({ concealZones: [zona, revelada], tokens: [ficha('bandido', 50, 50), ficha('aberto', 350, 50)] })
    const out = mapForImageExport(map, SEM_MESTRE)
    expect(out.concealZones).toEqual([])
    expect(out.tokens.map((t) => t.id)).toEqual(['aberto'])
    expect(mapForImageExport(map, COM_MESTRE).concealZones).toHaveLength(2)
  })

  it('nome de sala escondido dos jogadores sai vazio; pino de chegada oculta não sai', () => {
    const map = cripta({
      regions: [sala('capela', 0, 0, 100, 100, { room: { shape: 'rect', name: 'Capela profanada', nameHiddenFromPlayers: true } })],
      pins: [pino('chegada', 500, 500, { kind: 'viagem', soChegada: true }), pino('achado', 600, 600, { secret: true }), pino('aviso', 700, 700)],
    })
    const out = mapForImageExport(map, SEM_MESTRE)
    expect(out.regions[0]?.room?.name).toBe('')
    expect(out.pins.map((p) => p.id)).toEqual(['aviso'])
    expect(mapForImageExport(map, COM_MESTRE).regions[0]?.room?.name).toBe('Capela profanada')
  })

  it('TEXTURAS: sem a opção do mestre, o passo que entrega sala secreta ou zona oculta não sai', () => {
    const zona = { id: 'z1', name: 'Covil', revealed: false, points: sala('z', 600, 0, 800, 200).points }
    const map = cripta({
      regions: [sala('cofre', 0, 0, 200, 200, { secret: true }), sala('salao', 400, 0, 500, 200)],
      drawings: [{ id: 'mancha', kind: 'polygon', points: sala('d', 650, 50, 700, 100).points, color: '#335533', width: 1, filled: true, fillAlpha: 1 }],
      concealZones: [zona],
      texturas: [
        // Balde de neve na sala secreta: a silhueta dela sairia cheia de textura.
        { id: 'b-cofre', tipo: 'balde', textura: 'neve', forca: 1, alvo: { tipo: 'regiao', id: 'cofre' } },
        // Balde no desenho dentro da zona oculta.
        { id: 'b-mancha', tipo: 'balde', textura: 'pantano', forca: 1, alvo: { tipo: 'desenho', id: 'mancha' } },
        // Pincelada de lava dentro da zona oculta.
        { id: 'p-lava', tipo: 'pincel', textura: 'importada:lava', forca: 1, raio: 20, pontos: [{ x: 700, y: 100 }] },
        // Pincelada que passa a menos de um raio da borda da sala secreta: encosta nela.
        { id: 'p-borda', tipo: 'pincel', textura: 'terra', forca: 1, raio: 40, pontos: [{ x: 230, y: 100 }] },
        { id: 'b-salao', tipo: 'balde', textura: 'campo', forca: 1, alvo: { tipo: 'regiao', id: 'salao' } },
        { id: 'p-longe', tipo: 'pincel', textura: 'terra', forca: 1, raio: 20, pontos: [{ x: 300, y: 500 }] },
      ],
      texturasImportadas: [{ id: 'importada:lava', nome: 'Lava do covil', imagem: 'data:image/webp;base64,AAAA' }],
    })
    const out = mapForImageExport(map, SEM_MESTRE)
    expect(out.texturas?.map((p) => p.id)).toEqual(['b-salao', 'p-longe'])
    // A importada que só a pincelada escondida usava também fica.
    expect(out.texturasImportadas).toBeUndefined()
    expect(mapForImageExport(map, COM_MESTRE).texturas).toHaveLength(6)
  })

  it('não muda o mapa recebido', () => {
    const map = cripta({ tokens: [ficha('espreita', 875, 675, { secret: true })] })
    const antes = JSON.stringify(map)
    mapForImageExport(map, { grid: false, masterOnly: false })
    expect(JSON.stringify(map)).toBe(antes)
  })
})
