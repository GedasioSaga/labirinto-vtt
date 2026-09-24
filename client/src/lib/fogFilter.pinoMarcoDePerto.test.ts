import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Region, Wall } from '../types/map'
import { createExploration, markAll } from './exploration'
import { filterMapForPlayer, type PinAudiences } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * PINO MARCO e PINO SÓ DE PERTO no recorte do jogador.
 *
 * - Marco ("todos veem"): o Templo que a cidade inteira conhece chega a quem
 *   nunca foi lá, atravessando a névoa, SEM levar nada do que está em volta.
 * - Só de perto ("ler a N casas"): a carta aparece como pino, mas o texto e a
 *   imagem só entram no pacote quando uma ficha do jogador está a N casas e
 *   enxerga o pino. Longe, o pino sai marcado `longe` e SEM descrição — nem o
 *   "Revelar planta" do mestre entrega o que está escrito.
 */

const CASA = 50
const RAIO = 300
const POSSE = { ana: ['ficha-ana'] }
const TEXTO_DO_TEMPLO = 'Templo de Pelor, portas de bronze'
const TEXTO_DA_CARTA = 'Encontrem-me no cais ao anoitecer'
const FOTO_DA_CARTA = 'data:image/png;base64,Q0FSVEE='

const TEMPLO: Pin = { id: 'templo', x: 1500, y: 1500, kind: 'exclamacao', description: TEXTO_DO_TEMPLO, image: null, marco: true }
const POCO: Pin = { id: 'poco', x: 1500, y: 1400, kind: 'interrogacao', description: 'Poço seco', image: null }
const CARTA: Pin = { id: 'carta', x: 400, y: 200, kind: 'interrogacao', description: TEXTO_DA_CARTA, image: FOTO_DA_CARTA, lerDePerto: 1 }
/** Placa de ENCRUZILHADA lida a 1 casa: duas saídas com nome. */
const PLACA: Pin = {
  id: 'placa',
  x: 800,
  y: 200,
  kind: 'viagem',
  description: 'Placa de madeira',
  image: null,
  lerDePerto: 1,
  destino: { sceneId: 'cena-cripta', pinId: 'par-cripta' },
  rotulo: 'Cripta do Rei Morto',
  saidas: [{ id: 'porto', rotulo: 'Porto', destino: { sceneId: 'cena-porto', pinId: 'par-porto' } }],
}

/** Muro do pátio do Templo, entre o pino comum e o marco. */
const MURO_DO_TEMPLO: Wall = { id: 'muro-templo', x1: 1400, y1: 1450, x2: 1600, y2: 1450, blocksLight: true, blocksMove: true, door: null }
/** O chão do pátio em volta do Templo: planta que só sai à vista ou explorada. */
const PATIO_DO_TEMPLO: Region = {
  id: 'patio-templo',
  points: [
    { x: 1400, y: 1400 },
    { x: 1600, y: 1400 },
    { x: 1600, y: 1600 },
    { x: 1400, y: 1600 },
  ],
  tag: '',
  fillColor: '#3a3a3a',
  fillPattern: 'solid',
  data: {},
}

function cidade(anaX: number, anaY: number, pins: Pin[], walls: Wall[] = []): MapData {
  return {
    ...createEmptyMap('m', 'Cidade', 2000, 2000, CASA),
    tokens: [{ id: 'ficha-ana', characterId: null, name: 'Ana', x: anaX, y: anaY, size: 1, image: null }],
    pins,
    walls,
  }
}

const recorte = (map: MapData, explored?: ReturnType<typeof createExploration>, audiences?: PinAudiences) =>
  filterMapForPlayer(map, 'ana', POSSE, RAIO, explored, undefined, audiences)

const pinoNoRecorte = (map: MapData, id: string, explored?: ReturnType<typeof createExploration>): Pin | undefined =>
  recorte(map, explored).map.pins.find((p) => p.id === id)

describe('fogFilter: pino marco (todos veem)', () => {
  it('Templo marco chega a quem nunca foi lá, com o texto; o pino comum ao lado não chega', () => {
    const view = recorte(cidade(200, 200, [TEMPLO, POCO], [MURO_DO_TEMPLO]))
    expect(view.map.pins.map((p) => p.id)).toEqual(['templo'])
    expect(view.map.pins[0].description).toBe(TEXTO_DO_TEMPLO)
  })

  it('a área em volta continua preta: a sala do pátio não sai e a visão não chega lá', () => {
    const view = recorte({ ...cidade(200, 200, [TEMPLO], [MURO_DO_TEMPLO]), regions: [PATIO_DO_TEMPLO] })
    expect(view.map.regions).toEqual([])
    expect(JSON.stringify(view)).not.toContain('patio-templo')
    // A visão enviada é só a do raio da Ana, longe do Templo.
    const alcance = view.vision.flatMap((anel) => anel).map((p) => Math.hypot(p.x - 200, p.y - 200))
    expect(alcance.length).toBeGreaterThan(0)
    expect(Math.max(...alcance)).toBeLessThanOrEqual(RAIO + 1)
  })

  it('o campo `marco` não vai ao jogador: o pino chega com a cara de um pino comum', () => {
    const templo = pinoNoRecorte(cidade(200, 200, [TEMPLO]), 'templo')
    expect(templo).toBeDefined()
    expect(templo && 'marco' in templo).toBe(false)
  })

  it('marco não fura o que o mestre esconde: oculto, zona oculta e "Só estes" continuam vencendo', () => {
    expect(recorte(cidade(200, 200, [{ ...TEMPLO, secret: true }])).map.pins).toEqual([])
    const comZona: MapData = {
      ...cidade(200, 200, [TEMPLO]),
      concealZones: [
        {
          id: 'z',
          name: 'Bairro proibido',
          revealed: false,
          points: [
            { x: 1300, y: 1300 },
            { x: 1700, y: 1300 },
            { x: 1700, y: 1700 },
            { x: 1300, y: 1700 },
          ],
        },
      ],
    }
    expect(JSON.stringify(recorte(comZona))).not.toContain(TEXTO_DO_TEMPLO)
    const soOutro: PinAudiences = new Map([['templo', new Set(['bruno'])]])
    expect(JSON.stringify(recorte(cidade(200, 200, [TEMPLO]), undefined, soOutro))).not.toContain(TEXTO_DO_TEMPLO)
  })
})

describe('fogFilter: pino que só se lê de perto', () => {
  it('Ana na porta (4 casas, enxergando a carta): o pino chega, marcado longe, SEM texto e SEM imagem', () => {
    const view = recorte(cidade(200, 200, [CARTA]))
    const carta = view.map.pins.find((p) => p.id === 'carta')
    expect(carta).toMatchObject({ id: 'carta', description: '', image: null, longe: true })
    expect(JSON.stringify(view)).not.toContain(TEXTO_DA_CARTA)
    expect(JSON.stringify(view)).not.toContain(FOTO_DA_CARTA)
  })

  it('a 2 casas ainda é longe para "ler a 1 casa"', () => {
    const carta = pinoNoRecorte(cidade(300, 200, [CARTA]), 'carta')
    expect(carta?.description).toBe('')
    expect(carta?.longe).toBe(true)
  })

  it('ao lado da mesa (1 casa, reto ou na diagonal) lê o texto e vê a imagem, sem a marca de longe', () => {
    for (const [x, y] of [
      [350, 200],
      [350, 250],
      [400, 150],
    ]) {
      const carta = pinoNoRecorte(cidade(x, y, [CARTA]), 'carta')
      expect(carta?.description, `Ana em ${x},${y}`).toBe(TEXTO_DA_CARTA)
      expect(carta?.image, `Ana em ${x},${y}`).toBe(FOTO_DA_CARTA)
      expect(carta && 'longe' in carta, `Ana em ${x},${y}`).toBe(false)
    }
  })

  it('"ler a 3 casas" deixa ler de 3 casas e não de 4', () => {
    const tresCasas: Pin = { ...CARTA, lerDePerto: 3 }
    expect(pinoNoRecorte(cidade(250, 200, [tresCasas]), 'carta')?.description).toBe(TEXTO_DA_CARTA)
    expect(pinoNoRecorte(cidade(200, 200, [tresCasas]), 'carta')?.description).toBe('')
  })

  it('"Revelar planta" (mapa inteiro explorado) com a Ana longe: o pino aparece, o texto não', () => {
    const map = cidade(200, 200, [{ ...CARTA, x: 1500, y: 1500 }])
    const explorado = createExploration(map)
    markAll(explorado)
    const view = recorte(map, explorado)
    expect(view.map.pins.map((p) => p.id)).toEqual(['carta'])
    expect(view.map.pins[0]).toMatchObject({ description: '', image: null, longe: true })
    expect(JSON.stringify(view)).not.toContain(TEXTO_DA_CARTA)
  })

  it('perto mas com parede no meio: não lê através da parede', () => {
    const parede: Wall = { id: 'parede', x1: 375, y1: 100, x2: 375, y2: 300, blocksLight: true, blocksMove: true, door: null }
    const map = cidade(350, 200, [CARTA], [parede])
    const explorado = createExploration(map)
    markAll(explorado)
    const view = recorte(map, explorado)
    expect(view.map.pins.find((p) => p.id === 'carta')?.longe).toBe(true)
    expect(JSON.stringify(view)).not.toContain(TEXTO_DA_CARTA)
  })

  it('pino marco e só de perto: o Templo aparece de longe, a inscrição só de perto', () => {
    const inscricao: Pin = { ...TEMPLO, lerDePerto: 1 }
    const templo = pinoNoRecorte(cidade(200, 200, [inscricao]), 'templo')
    expect(templo).toMatchObject({ id: 'templo', description: '', longe: true })
  })

  it('placa de encruzilhada só de perto, Ana longe: as saídas chegam pelo id, sem o nome de nenhuma', () => {
    const map = cidade(200, 200, [PLACA])
    const explorado = createExploration(map)
    markAll(explorado)
    const view = recorte(map, explorado)
    const placa = view.map.pins.find((p) => p.id === 'placa')
    expect(placa?.longe).toBe(true)
    // Os ids continuam: é com eles que o pedido de passagem volta ao host.
    expect(placa?.escolhas).toEqual([
      { id: 'principal', rotulo: 'Saída 1' },
      { id: 'porto', rotulo: 'Saída 2' },
    ])
    expect(JSON.stringify(view)).not.toContain('Cripta do Rei Morto')
    expect(JSON.stringify(view)).not.toContain('Porto')
  })

  it('placa de encruzilhada só de perto, Ana ao lado: lê o nome de cada saída', () => {
    const placa = pinoNoRecorte(cidade(PLACA.x - CASA, PLACA.y, [PLACA]), 'placa')
    expect(placa && 'longe' in placa).toBe(false)
    expect(placa?.escolhas).toEqual([
      { id: 'principal', rotulo: 'Cripta do Rei Morto' },
      { id: 'porto', rotulo: 'Porto' },
    ])
  })

  it('controle: pino sem "só de perto" continua saindo com o texto como sempre', () => {
    const comum: Pin = { ...CARTA, lerDePerto: undefined }
    expect(pinoNoRecorte(cidade(200, 200, [comum]), 'carta')?.description).toBe(TEXTO_DA_CARTA)
  })
})
