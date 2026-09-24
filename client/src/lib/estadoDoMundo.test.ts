import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { parseAdventure, serializeAdventure } from './adventure'
import { amarradosPorEstado, aplicarEstadoNoMapa, comValorAtual, contarAmarrados, contarMudancas, novoEstadoDoMundo } from './estadoDoMundo'
import type { ConcealZone, DoorState, MapData, Pin, Wall } from '../types/map'

/**
 * ESTADO DO MUNDO — a maré baixa abre a comporta, destranca o alçapão e tira o
 * preto da galeria alagada; a maré alta faz o contrário. A regra mora no
 * elemento (porta, pino, zona) e o valor atual mora na aventura.
 */
const MARE = 'estado_mare'

function parede(id: string, door: DoorState | null): Wall {
  return { id, x1: 0, y1: 0, x2: 50, y2: 0, blocksLight: true, blocksMove: true, door }
}

function comporta(extra: Partial<DoorState> = {}): DoorState {
  return {
    open: false,
    locked: true,
    kind: 'normal',
    porEstado: {
      estadoId: MARE,
      efeitos: [
        { valor: 'alta', efeito: 'trancada' },
        { valor: 'baixa', efeito: 'aberta' },
      ],
    },
    ...extra,
  }
}

function alcapao(): Pin {
  return {
    id: 'alcapao',
    x: 100,
    y: 100,
    kind: 'viagem',
    description: 'Alçapão do cano',
    image: null,
    passagem: 'trancada',
    porEstado: {
      estadoId: MARE,
      efeitos: [
        { valor: 'alta', efeito: 'trancada' },
        { valor: 'baixa', efeito: 'livre' },
      ],
    },
  }
}

function galeria(): ConcealZone {
  return {
    id: 'galeria',
    name: 'Galeria alagada',
    revealed: false,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    porEstado: {
      estadoId: MARE,
      efeitos: [
        { valor: 'alta', efeito: 'oculta' },
        { valor: 'baixa', efeito: 'revelada' },
      ],
    },
  }
}

function andarZero(): MapData {
  return {
    ...createEmptyMap('map_andar0', 'Andar 0', 1000, 1000, 50),
    walls: [parede('comporta', comporta()), parede('porta-comum', { open: false, locked: false, kind: 'normal' }), parede('muro', null)],
    pins: [alcapao(), { id: 'bau', x: 300, y: 300, kind: 'exclamacao', description: 'Baú', image: null }],
    concealZones: [galeria()],
  }
}

describe('aplicarEstadoNoMapa: o valor do estado vira o estado real de cada elemento amarrado', () => {
  it('maré baixa: a comporta abre e destranca, o alçapão passa livre e a galeria deixa de esconder', () => {
    const depois = aplicarEstadoNoMapa(andarZero(), MARE, 'baixa')
    const door = depois.walls.find((w) => w.id === 'comporta')?.door
    expect(door?.open).toBe(true)
    expect(door?.locked).toBe(false)
    expect(depois.pins.find((p) => p.id === 'alcapao')?.passagem).toBe('livre')
    expect(depois.concealZones.find((z) => z.id === 'galeria')?.revealed).toBe(true)
    // A regra continua lá: a próxima troca precisa dela.
    expect(door?.porEstado?.estadoId).toBe(MARE)
  })

  it('maré alta de volta: tudo volta ao efeito da alta (porta trancada e fechada, pino trancado, zona oculta)', () => {
    const baixa = aplicarEstadoNoMapa(andarZero(), MARE, 'baixa')
    const alta = aplicarEstadoNoMapa(baixa, MARE, 'alta')
    const door = alta.walls.find((w) => w.id === 'comporta')?.door
    expect(door?.open).toBe(false)
    expect(door?.locked).toBe(true)
    expect(alta.pins.find((p) => p.id === 'alcapao')?.passagem).toBe('trancada')
    expect(alta.concealZones.find((z) => z.id === 'galeria')?.revealed).toBe(false)
  })

  it('o que não está amarrado não muda, nem de referência', () => {
    const antes = andarZero()
    const depois = aplicarEstadoNoMapa(antes, MARE, 'baixa')
    expect(depois.walls.find((w) => w.id === 'porta-comum')).toBe(antes.walls.find((w) => w.id === 'porta-comum'))
    expect(depois.walls.find((w) => w.id === 'muro')).toBe(antes.walls.find((w) => w.id === 'muro'))
    expect(depois.pins.find((p) => p.id === 'bau')).toBe(antes.pins.find((p) => p.id === 'bau'))
  })

  it('outro estado, valor sem efeito ou nada a mudar: devolve o MESMO mapa (a cena não fica pendente de salvar)', () => {
    const antes = andarZero()
    expect(aplicarEstadoNoMapa(antes, 'estado_giro', '7')).toBe(antes)
    expect(aplicarEstadoNoMapa(antes, MARE, 'meia')).toBe(antes)
    // Já está na alta (porta trancada, pino trancado, zona oculta): nada a fazer.
    expect(aplicarEstadoNoMapa(antes, MARE, 'alta')).toBe(antes)
  })

  it('conta quantos elementos a troca muda e quantos estão amarrados ao estado', () => {
    expect(contarMudancas(andarZero(), MARE, 'baixa')).toBe(3)
    expect(contarMudancas(andarZero(), MARE, 'alta')).toBe(0)
    expect(contarAmarrados(andarZero(), MARE)).toBe(3)
    expect(contarAmarrados(andarZero(), 'estado_giro')).toBe(0)
  })

  it('amarradosPorEstado soma as cenas numa passada, por estado', () => {
    const outraCena: MapData = { ...createEmptyMap('map_andar1', 'Andar 1', 100, 100, 50), pins: [alcapao()] }
    const conta = amarradosPorEstado([andarZero(), outraCena])
    expect(conta.get(MARE)).toBe(4)
    expect(conta.has('estado_giro')).toBe(false)
  })

  it('valor "constructor" ou "__proto__" não lê o protótipo: sem efeito, o mapa não muda', () => {
    const antes = andarZero()
    expect(aplicarEstadoNoMapa(antes, MARE, 'constructor')).toBe(antes)
    expect(aplicarEstadoNoMapa(antes, MARE, '__proto__')).toBe(antes)
  })
})

describe('arquivo da cena: a regra é campo NOVO e OPCIONAL', () => {
  it('mapa salvo antes do estado do mundo abre sem a regra em porta, pino e zona', () => {
    const velho = createEmptyMap('map_velho', 'Velho', 100, 100, 50)
    const json = JSON.stringify({
      ...velho,
      walls: [parede('p', { open: false, locked: false, kind: 'normal' })],
      pins: [{ id: 'x', x: 1, y: 1, kind: 'viagem', description: '', image: null }],
      concealZones: [{ id: 'z', name: 'Z', revealed: false, points: [] }],
    })
    const map = deserializeMap(json)
    expect(map.walls[0].door?.porEstado).toBeUndefined()
    expect(map.walls[0].door !== null && 'porEstado' in map.walls[0].door).toBe(false)
    expect(map.pins[0].porEstado).toBeUndefined()
    expect('porEstado' in map.concealZones[0]).toBe(false)
  })

  it('a regra boa vai e volta do disco igual', () => {
    const map = andarZero()
    const lido = deserializeMap(serializeMap(map))
    expect(lido.walls.find((w) => w.id === 'comporta')?.door?.porEstado).toEqual(comporta().porEstado)
    expect(lido.pins.find((p) => p.id === 'alcapao')?.porEstado).toEqual(alcapao().porEstado)
    expect(lido.concealZones.find((z) => z.id === 'galeria')?.porEstado).toEqual(galeria().porEstado)
  })

  it('regra torta (editada à mão) sai; efeito desconhecido e valor repetido saem da lista, o resto fica', () => {
    const base = andarZero()
    const json = JSON.stringify({
      ...base,
      walls: [
        parede('sem-id', { open: false, locked: false, kind: 'normal', porEstado: { efeitos: [] } as unknown as DoorState['porEstado'] }), // cast: simula arquivo editado à mão, sem estadoId
        parede('efeito-ruim', {
          open: false,
          locked: false,
          kind: 'normal',
          porEstado: {
            estadoId: MARE,
            efeitos: [
              { valor: 'alta', efeito: 'explode' },
              { valor: 'baixa', efeito: 'aberta' },
              { valor: 'baixa', efeito: 'trancada' },
              { valor: 3, efeito: 'aberta' },
            ],
          } as unknown as DoorState['porEstado'], // cast: simula arquivo editado à mão com efeito e valor tortos
        }),
      ],
      pins: [{ ...alcapao(), porEstado: 'maré' }],
    })
    const map = deserializeMap(json)
    expect(map.walls.find((w) => w.id === 'sem-id')?.door?.porEstado).toBeUndefined()
    expect(map.walls.find((w) => w.id === 'efeito-ruim')?.door?.porEstado).toEqual({ estadoId: MARE, efeitos: [{ valor: 'baixa', efeito: 'aberta' }] })
    expect(map.pins[0].porEstado).toBeUndefined()
  })
})

describe('aventura: a lista de estados é campo NOVO e OPCIONAL do adventure.json', () => {
  const cenas = [{ id: 's1', name: 'Andar 0', file: 'scenes/s1/map.json' }]

  it('aventura antiga abre sem estados e grava sem a chave', () => {
    const adv = parseAdventure(JSON.stringify({ version: 1, id: 'adv', name: 'Torre', startSceneId: 's1', scenes: cenas }))
    expect(adv.estados).toBeUndefined()
    expect(serializeAdventure(adv)).not.toContain('estados')
  })

  it('estado bom vai e volta; atual fora da lista volta ao primeiro valor; estado torto sai', () => {
    const adv = parseAdventure(
      JSON.stringify({
        version: 1,
        id: 'adv',
        name: 'Torre',
        startSceneId: 's1',
        scenes: cenas,
        estados: [
          { id: MARE, nome: 'Maré', valores: ['alta', 'baixa'], atual: 'baixa' },
          { id: 'estado_giro', nome: 'Giro', valores: ['1', '2', '2', ''], atual: '9' },
          { id: '', nome: 'Sem id', valores: ['a'], atual: 'a' },
          { id: 'sem_valores', nome: 'Vazio', valores: [], atual: '' },
          { id: MARE, nome: 'Maré repetida', valores: ['x'], atual: 'x' },
          'lixo',
        ],
      }),
    )
    expect(adv.estados).toEqual([
      { id: MARE, nome: 'Maré', valores: ['alta', 'baixa'], atual: 'baixa' },
      { id: 'estado_giro', nome: 'Giro', valores: ['1', '2'], atual: '1' },
    ])
    expect(parseAdventure(serializeAdventure(adv)).estados).toEqual(adv.estados)
  })
})

describe('criar e trocar estado', () => {
  it('novoEstadoDoMundo lê "alta, baixa" como dois valores, o primeiro vira o atual', () => {
    const estado = novoEstadoDoMundo('  Maré ', 'alta, baixa, alta,  ')
    expect(estado?.nome).toBe('Maré')
    expect(estado?.valores).toEqual(['alta', 'baixa'])
    expect(estado?.atual).toBe('alta')
    expect(estado?.id.length).toBeGreaterThan(0)
  })

  it('sem nome ou sem valor não cria', () => {
    expect(novoEstadoDoMundo('', 'alta')).toBeNull()
    expect(novoEstadoDoMundo('Maré', ' , ')).toBeNull()
  })

  it('comValorAtual troca só o estado pedido; valor fora da lista ou estado que não existe devolve null', () => {
    const estados = [
      { id: MARE, nome: 'Maré', valores: ['alta', 'baixa'], atual: 'alta' },
      { id: 'g', nome: 'Giro', valores: ['1', '2'], atual: '1' },
    ]
    expect(comValorAtual(estados, MARE, 'baixa')).toEqual([{ ...estados[0], atual: 'baixa' }, estados[1]])
    expect(comValorAtual(estados, MARE, 'meia')).toBeNull()
    expect(comValorAtual(estados, 'nao-existe', 'alta')).toBeNull()
  })
})
