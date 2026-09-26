import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { espiadaPeloPino, filterMapForPlayer } from './fogFilter'
import { DA_VISTA_MAX_CASAS, ESPIADA_MAX_FICHAS, espiadaCabe, isDaVista, parseEspiada, type Espiada } from './espiar'
import type { MapData, Pin, Token, Wall } from '../types/map'

/**
 * ESPIAR PELA PASSAGEM — o recorte do outro lado. Tudo o que sai daqui vai
 * pela rede para um jogador que NÃO está naquela cena: o que a névoa, a zona
 * oculta, a parede ou o mestre escondem precisa estar AUSENTE, e o nome da
 * cena também.
 */

const GRID = 50
const PAR = { x: 500, y: 500 }

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function pino(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: '', image: null, ...extra }
}

/** O outro lado: a Cripta Rubra, com o pino par no meio e de tudo um pouco em volta. */
function cripta(): { map: MapData; par: Pin } {
  const par = pino('par', PAR.x, PAR.y, { destino: { sceneId: 'cena-salao', pinId: 'grade' }, description: 'Boca do poço' })
  const map: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta Rubra', 40, 20, GRID),
    tokens: [
      // 1,6 casa acima do par: à vista.
      ficha('npc-perto', 500, 420, { color: '#c0392b' }),
      // 5,6 casas abaixo: fora do raio de 3, dentro do de 6.
      ficha('npc-longe', 500, 780),
      // Atrás da parede de x = 560, dentro do raio.
      ficha('npc-atras', 620, 500),
      // Dentro do raio, mas o mestre esconde.
      ficha('npc-secreto', 500, 600, { secret: true }),
      ficha('npc-oculto', 440, 500, { hidden: true }),
      // Dentro do raio, dentro da zona oculta.
      ficha('npc-zona', 410, 410),
    ],
    walls: [
      parede('muro-perto', 560, 300, 560, 700),
      parede('muro-longe', 900, 300, 900, 700),
      parede('porta-baixo', 420, 580, 480, 580, { door: { open: false, locked: true, kind: 'normal' } }),
    ],
    pins: [par, pino('tesouro', 520, 480, { kind: 'exclamacao', description: 'Tesouro do fundo' })],
    concealZones: [
      {
        id: 'zona-1',
        name: 'Esconderijo do capataz',
        revealed: false,
        points: [
          { x: 350, y: 350 },
          { x: 450, y: 350 },
          { x: 450, y: 450 },
          { x: 350, y: 450 },
        ],
      },
    ],
  }
  return { map, par }
}

describe('espiadaPeloPino: o recorte do outro lado', () => {
  it('mostra a ficha à vista em volta do par, em coordenadas relativas ao par', () => {
    const { map, par } = cripta()
    const espiada = espiadaPeloPino(map, par, 3)
    expect(espiada.tokens).toEqual([{ x: 0, y: -80, size: 1, color: '#c0392b' }])
    expect(espiada.raio).toBe(3 * GRID)
    expect(espiada.grid).toBe(GRID)
    expect(espiada.vision.length).toBe(1)
  })

  it('SEGURANÇA — ficha fora do raio, atrás da parede, secreta, oculta ou em zona oculta NÃO chega', () => {
    const { map, par } = cripta()
    const texto = JSON.stringify(espiadaPeloPino(map, par, 3))
    for (const id of ['npc-longe', 'npc-atras', 'npc-secreto', 'npc-oculto', 'npc-zona', 'npc-perto']) {
      // Nem o id da ficha viaja: o jogador recebe um ponto colorido, não quem é.
      expect(texto).not.toContain(id)
    }
    // Controle: sem a parede, a ficha de trás aparece — é a parede que a tira.
    const semParede: MapData = { ...map, walls: map.walls.filter((w) => w.id !== 'muro-perto') }
    expect(espiadaPeloPino(semParede, par, 3).tokens).toContainEqual({ x: 120, y: 0, size: 1, color: expect.any(String) })
  })

  it('SEGURANÇA — nem o nome da cena, nem o id do mapa, nem pino, zona ou nome de ficha saem', () => {
    const { map, par } = cripta()
    const texto = JSON.stringify(espiadaPeloPino(map, par, 3))
    for (const segredo of ['Cripta Rubra', 'mapa-cripta', 'Tesouro do fundo', 'Boca do poço', 'Esconderijo do capataz', 'zona-1', 'nome-npc-perto', 'cena-salao']) {
      expect(texto).not.toContain(segredo)
    }
  })

  it('a parede sai cortada no círculo do raio, e a de longe não sai', () => {
    const { map, par } = cripta()
    const espiada = espiadaPeloPino(map, par, 3)
    // Uma parede e uma porta, nada da de x = 900.
    expect(espiada.walls.length).toBe(1)
    const [muro] = espiada.walls
    if (muro === undefined) throw new Error('esperava o muro de perto')
    expect(muro.x1).toBe(60)
    expect(muro.x2).toBe(60)
    // Cortada no círculo: nenhuma ponta passa do raio.
    for (const y of [muro.y1, muro.y2]) {
      expect(Math.hypot(60, y)).toBeLessThanOrEqual(3 * GRID + 1)
      expect(Math.abs(y)).toBeGreaterThan(100)
    }
  })

  it('SEGURANÇA — parede e porta atrás do muro, dentro do raio, NÃO saem; sem o muro, saem', () => {
    // O recorte comum manda a planta inteira da cena: só o corte pelo que o olho
    // vê impede que a planta escondida atrás do muro vá pela rede.
    const { map, par } = cripta()
    // Atrás do muro de x = 560 (relativo: x = 60), inteiras dentro do raio de 150.
    const paredeAtras = parede('parede-atras', 620, 440, 620, 560) // relativo (120, −60)..(120, 60)
    const portaAtras = parede('porta-atras', 590, 420, 610, 420, { door: { open: true, locked: false, kind: 'normal' } }) // relativo (90, −80)..(110, −80)
    const comMuro: MapData = { ...map, walls: [...map.walls, paredeAtras, portaAtras] }

    const espiada = espiadaPeloPino(comMuro, par, 3)
    // Só o muro de perto e a porta de baixo — igual ao cenário sem as peças escondidas.
    expect(espiada.walls.length).toBe(1)
    expect(espiada.walls[0]?.x1).toBe(60)
    expect(espiada.walls.some((w) => w.x1 === 120 || w.x2 === 120)).toBe(false)
    expect(espiada.doors).toEqual([{ x1: -80, y1: 80, x2: -20, y2: 80, open: false }])

    // Controle: sem o muro de perto, as duas aparecem — é o muro que as tira.
    const semMuro: MapData = { ...comMuro, walls: comMuro.walls.filter((w) => w.id !== 'muro-perto') }
    const aberta = espiadaPeloPino(semMuro, par, 3)
    expect(aberta.walls).toContainEqual(expect.objectContaining({ x1: 120, x2: 120 }))
    expect(aberta.doors).toContainEqual({ x1: 90, y1: -80, x2: 110, y2: -80, open: true })
  })

  it('SEGURANÇA — prédio de teto fechado atrás do muro, dentro do raio, NÃO sai; sem o muro, sai o contorno', () => {
    // `view.roofs` do recorte comum traz TODO teto fechado do mapa, sem olhar a
    // névoa (lá ele só serve ao `forgetInside`). Na espiada ele vai pela rede:
    // só pode sair o teto cuja silhueta o olho alcança.
    const { map, par } = cripta()
    const predio: MapData['regions'][number] = {
      id: 'predio',
      tag: '',
      fillColor: '#123',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'nome-predio', roof: true },
      // Atrás do muro de x = 560, inteiro dentro do raio de 150: relativo (100, −40)..(140, 40).
      points: [
        { x: 600, y: 460 },
        { x: 640, y: 460 },
        { x: 640, y: 540 },
        { x: 600, y: 540 },
      ],
    }
    const comMuro: MapData = { ...map, regions: [predio] }
    expect(espiadaPeloPino(comMuro, par, 3).roofs).toEqual([])

    // Controle: sem o muro, o olho alcança o prédio e o contorno sai, relativo ao par.
    const semMuro: MapData = { ...comMuro, walls: comMuro.walls.filter((w) => w.id !== 'muro-perto') }
    const aberta = espiadaPeloPino(semMuro, par, 3)
    expect(aberta.roofs.length).toBe(1)
    const [teto] = aberta.roofs
    if (teto === undefined) throw new Error('esperava o teto do prédio')
    for (const canto of [{ x: 100, y: -40 }, { x: 140, y: -40 }, { x: 140, y: 40 }, { x: 100, y: 40 }]) {
      expect(teto).toContainEqual(canto)
    }
  })

  it('a porta à vista sai com o estado dela; a zona oculta sai só como geometria para pintar de preto', () => {
    const { map, par } = cripta()
    const espiada = espiadaPeloPino(map, par, 3)
    expect(espiada.doors).toEqual([{ x1: -80, y1: 80, x2: -20, y2: 80, open: false }])
    expect(espiada.concealed.length).toBe(1)
    // O canto da zona dentro do raio vai como está; o de fora (−150,−150) fica no corte.
    expect(espiada.concealed[0]).toContainEqual({ x: -50, y: -50 })
    expect(espiada.concealed[0]).not.toContainEqual({ x: -150, y: -150 })
  })

  it('SEGURANÇA — zona oculta sai cortada no círculo: nenhum ponto dela passa do raio', () => {
    const { map, par } = cripta()
    const espiada = espiadaPeloPino(map, par, 3)
    expect(espiada.concealed.length).toBe(1)
    for (const p of espiada.concealed.flat()) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(3 * GRID + 1)
  })

  it('zona com faixa pincelada perto do par: o recorte cabe no que o jogador aceita', () => {
    // Faixa vertical revelada pelo pincel: colunas 53..56 (x 530..570), linhas 40..59 (y 400..600).
    const cells: string[] = []
    for (let row = 40; row < 60; row += 1) for (let col = 53; col < 57; col += 1) cells.push(`${col},${row}`)
    const par = pino('par', PAR.x, PAR.y)
    const map: MapData = {
      ...createEmptyMap('m', 'Cripta', 40, 20, GRID),
      pins: [par],
      concealZones: [
        {
          id: 'z',
          name: 'Z',
          revealed: false,
          points: [
            { x: 300, y: 300 },
            { x: 800, y: 300 },
            { x: 800, y: 700 },
            { x: 300, y: 700 },
          ],
          unveiledCells: cells,
        },
      ],
    }
    const espiada = espiadaPeloPino(map, par, 3)
    expect(espiada.concealed.length).toBeGreaterThan(0)
    expect(espiadaCabe(espiada)).toBe(true)
    expect(parseEspiada(JSON.parse(JSON.stringify(espiada)) as unknown)).toEqual(espiada)
  })

  it('SEGURANÇA — camada de fichas oculta lá: o pincel revelado longe do par não entra no recorte', () => {
    // Zona longe do par (x 1500..1700), com um trecho revelado pelo pincel.
    const cells: string[] = []
    for (let row = 15; row < 20; row += 1) for (let col = 155; col < 160; col += 1) cells.push(`${col},${row}`)
    const par = pino('par', PAR.x, PAR.y)
    const zonaLonge = {
      id: 'z-longe',
      name: 'Longe',
      revealed: false,
      points: [
        { x: 1500, y: 100 },
        { x: 1700, y: 100 },
        { x: 1700, y: 300 },
        { x: 1500, y: 300 },
      ],
      unveiledCells: cells,
    }
    const base: MapData = { ...createEmptyMap('m', 'Cripta', 40, 20, GRID), pins: [par], concealZones: [zonaLonge] }
    // Controle: o recorte do jogador de lá leva esse trecho na visão.
    expect(filterMapForPlayer({ ...base, hiddenLayers: ['tokens'] }, 'p1', {}, 700).vision.length).toBeGreaterThan(0)
    const espiada = espiadaPeloPino({ ...base, hiddenLayers: ['tokens'] }, par, 3)
    expect(espiada.vision).toEqual([])
    expect(espiada.concealed).toEqual([])
  })

  it('raio maior alcança a ficha de 5,6 casas; o teto de casas vale', () => {
    const { map, par } = cripta()
    expect(espiadaPeloPino(map, par, DA_VISTA_MAX_CASAS).tokens).toContainEqual({ x: 0, y: 280, size: 1, color: expect.any(String) })
    // Pedido acima do teto é cortado no teto, nunca vira a cena inteira.
    expect(espiadaPeloPino(map, par, 999).raio).toBe(DA_VISTA_MAX_CASAS * GRID)
  })
})

describe('isDaVista e o disco', () => {
  it('só inteiro dentro da faixa vale', () => {
    expect(isDaVista(3)).toBe(true)
    expect(isDaVista(1)).toBe(true)
    expect(isDaVista(DA_VISTA_MAX_CASAS)).toBe(true)
    for (const ruim of [0, -1, DA_VISTA_MAX_CASAS + 1, 2.5, Number.NaN, '3', null, undefined]) expect(isDaVista(ruim)).toBe(false)
  })

  it('o arquivo guarda e relê "Dá vista"; valor torto volta ausente', () => {
    const { map } = cripta()
    const comVista: MapData = { ...map, pins: map.pins.map((p) => (p.id === 'par' ? { ...p, daVista: 4 } : p)) }
    expect(deserializeMap(serializeMap(comVista)).pins.find((p) => p.id === 'par')?.daVista).toBe(4)
    const torto = JSON.parse(serializeMap(comVista)) as { pins: Record<string, unknown>[] } // o JSON cru do disco: a forma é a que acabamos de gravar
    for (const p of torto.pins) p.daVista = 'muito'
    expect(deserializeMap(JSON.stringify(torto)).pins.find((p) => p.id === 'par')?.daVista).toBeUndefined()
  })

  it('o recorte do jogador leva "Dá vista" do pino de viagem, mas nunca o destino', () => {
    const { map } = cripta()
    const comVista: MapData = {
      ...map,
      tokens: [ficha('heroi', 480, 480)],
      pins: map.pins.map((p) => (p.id === 'par' ? { ...p, daVista: 2 } : { ...p, daVista: 2 })),
    }
    const view = filterMapForPlayer(comVista, 'p1', { p1: ['heroi'] }, 700)
    const par = view.map.pins.find((p) => p.id === 'par')
    expect(par?.daVista).toBe(2)
    expect(par?.destino).toBeUndefined()
    // Pino que não é de viagem não espia: o campo não sai.
    expect(view.map.pins.find((p) => p.id === 'tesouro')?.daVista).toBeUndefined()
  })
})

describe('parseEspiada: o que o jogador aceita', () => {
  it('aceita o recorte do host e devolve só os campos conhecidos', () => {
    const { map, par } = cripta()
    const espiada = espiadaPeloPino(map, par, 3)
    const cru = JSON.parse(JSON.stringify({ ...espiada, nome: 'Cripta Rubra' })) as unknown
    const lido = parseEspiada(cru)
    expect(lido).toEqual(espiada)
    expect(JSON.stringify(lido)).not.toContain('Cripta Rubra')
  })

  it('recusa forma errada, número não finito, cor fora de #rrggbb e lista acima do teto', () => {
    const base: Espiada = { raio: 150, grid: 50, vision: [], walls: [], doors: [], tokens: [], concealed: [], roofs: [] }
    expect(parseEspiada(base)).toEqual(base)
    expect(parseEspiada({ ...base, raio: Number.NaN })).toBeNull()
    expect(parseEspiada({ ...base, walls: [{ x1: 0, y1: 0, x2: 'a', y2: 1 }] })).toBeNull()
    expect(parseEspiada({ ...base, tokens: [{ x: 0, y: 0, size: 1, color: 'url(javascript:x)' }] })).toBeNull()
    const muitas = Array.from({ length: ESPIADA_MAX_FICHAS + 1 }, () => ({ x: 0, y: 0, size: 1, color: '#ffffff' }))
    expect(parseEspiada({ ...base, tokens: muitas })).toBeNull()
    expect(parseEspiada(null)).toBeNull()
    expect(parseEspiada([])).toBeNull()
  })
})
