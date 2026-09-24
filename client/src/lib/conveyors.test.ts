/**
 * MOVIMENTO IMPOSTO — a regra pura da esteira. A sala com esteira empurra a
 * ficha que está nela, casa por casa, na direção marcada, a cada "Avançar". A
 * parede que barra movimento (e a porta fechada) seguram a ficha; a porta
 * aberta deixa passar; a ficha que sai da sala é largada ali. A zona de perigo
 * não empurra ninguém.
 */
import { describe, expect, it } from 'vitest'
import type { Conveyor, MapData, Token } from '../types/map'
import { ficha, sala, torre, zona } from './__fixtures__/hazardTower'
import { advanceHazard } from './hazards'
import {
  advanceConveyors,
  conveyorOfRoom,
  conveyorsOf,
  DEFAULT_CONVEYOR_STEP,
  readConveyors,
  roomConveyorState,
  setRoomConveyor,
} from './conveyors'
import { deserializeMap, serializeMap } from './mapFile'

function esteira(id: string, roomId: string, direction: Conveyor['direction'], stepCells = 3): Conveyor {
  return { id, roomId, direction, stepCells }
}

function mesa(tokens: Token[], conveyors: Conveyor[], abertaBC = false): MapData {
  return { ...torre({ tokens, abertaBC }), conveyors }
}

function posicao(map: MapData, id: string): { x: number; y: number } | undefined {
  const t = map.tokens.find((token) => token.id === id)
  return t === undefined ? undefined : { x: t.x, y: t.y }
}

describe('advanceConveyors — a esteira empurra a ficha', () => {
  it('a ficha na esteira anda 3 casas por Avançar, na direção marcada', () => {
    const antes = mesa([ficha('ana', 125, 75)], [esteira('e1', 'sala-a', 'leste')])
    const depois = advanceConveyors(antes)
    expect(posicao(depois, 'ana')).toEqual({ x: 275, y: 75 })
    // Mais um Avançar: mais 3 casas.
    expect(posicao(advanceConveyors(depois), 'ana')).toEqual({ x: 425, y: 75 })
  })

  it('as quatro direções andam no eixo certo (norte é para cima na tela)', () => {
    const casos: [Conveyor['direction'], { x: number; y: number }][] = [
      ['norte', { x: 225, y: 75 }],
      ['sul', { x: 225, y: 375 }],
      ['leste', { x: 375, y: 225 }],
      ['oeste', { x: 75, y: 225 }],
    ]
    for (const [direction, esperado] of casos) {
      const depois = advanceConveyors(mesa([ficha('ana', 225, 225)], [esteira('e1', 'sala-a', direction)]))
      expect(posicao(depois, 'ana')).toEqual(esperado)
    }
  })

  it('não atravessa parede: para na última casa antes dela', () => {
    // y = 75 bate na parede cheia da divisória em x = 500 (a porta fica em 150..250).
    const depois = advanceConveyors(mesa([ficha('ana', 375, 75)], [esteira('e1', 'sala-a', 'leste')]))
    expect(posicao(depois, 'ana')).toEqual({ x: 475, y: 75 })
  })

  it('porta fechada segura; porta aberta deixa passar e a ficha é largada fora da sala', () => {
    const fechada = advanceConveyors(mesa([ficha('bia', 925, 200)], [esteira('e1', 'sala-b', 'leste')]))
    expect(posicao(fechada, 'bia')).toEqual({ x: 975, y: 200 })

    const aberta = advanceConveyors(mesa([ficha('ana', 425, 200)], [esteira('e1', 'sala-a', 'leste')]))
    // 475 ainda na sala A; 525 já é a sala B: largada ali, não anda a terceira casa.
    expect(posicao(aberta, 'ana')).toEqual({ x: 525, y: 200 })
  })

  it('não sai do mapa', () => {
    const depois = advanceConveyors(mesa([ficha('ana', 75, 225)], [esteira('e1', 'sala-a', 'oeste')]))
    expect(posicao(depois, 'ana')).toEqual({ x: 25, y: 225 })
  })

  it('só empurra quem está na sala da esteira; nada a mover devolve o MESMO mapa', () => {
    const antes = mesa([ficha('ana', 125, 75), ficha('bia', 750, 200)], [esteira('e1', 'sala-a', 'leste')])
    const depois = advanceConveyors(antes)
    expect(posicao(depois, 'bia')).toEqual({ x: 750, y: 200 })
    expect(posicao(depois, 'ana')).toEqual({ x: 275, y: 75 })

    const semNinguem = mesa([ficha('bia', 750, 200)], [esteira('e1', 'sala-a', 'leste')])
    expect(advanceConveyors(semNinguem)).toBe(semNinguem)
    const semEsteira = torre({ tokens: [ficha('ana', 125, 75)] })
    expect(advanceConveyors(semEsteira)).toBe(semEsteira)
    // Encostada na parede: não anda, e também não gasta histórico.
    const presa = mesa([ficha('ana', 475, 75)], [esteira('e1', 'sala-a', 'leste')])
    expect(advanceConveyors(presa)).toBe(presa)
  })

  it('a esteira de sala apagada não empurra ninguém', () => {
    const map = mesa([ficha('ana', 125, 75)], [esteira('e1', 'sala-que-sumiu', 'leste')])
    expect(advanceConveyors(map)).toBe(map)
  })

  it('a zona de perigo só avisa: avançar o fogo não mexe em ficha nenhuma', () => {
    const antes = { ...torre({ tokens: [ficha('ana', 125, 75)], hazards: [zona('z1', 'fogo', ['sala-a'])] }) }
    const depois = advanceHazard(antes, 'z1')
    expect(depois).not.toBe(antes)
    expect(depois.tokens).toEqual(antes.tokens)
  })
})

describe('advanceConveyors — "Fichas ocupam espaço" vale para a esteira', () => {
  function ocupada(tokens: Token[]): MapData {
    return { ...mesa(tokens, [esteira('e1', 'sala-a', 'leste')]), movement: { tokensOccupy: true } }
  }

  it('com a regra ligada, a esteira não larga a ficha em cima de outra: para na casa antes', () => {
    // Bia encostada na parede x = 500 não anda; Ana passaria por 375 e 425 e cairia em 475, sobre Bia.
    const depois = advanceConveyors(ocupada([ficha('ana', 325, 75), ficha('bia', 475, 75)]))
    expect(posicao(depois, 'ana')).toEqual({ x: 425, y: 75 })
    expect(posicao(depois, 'bia')).toEqual({ x: 475, y: 75 })
  })

  it('sem a regra, a esteira continua livre (a mesa que não liga ocupação não muda)', () => {
    const livre = mesa([ficha('ana', 325, 75), ficha('bia', 475, 75)], [esteira('e1', 'sala-a', 'leste')])
    expect(posicao(advanceConveyors(livre), 'ana')).toEqual({ x: 475, y: 75 })
  })

  it('fila na mesma esteira anda junta: quem vai na frente anda primeiro e abre a casa', () => {
    const depois = advanceConveyors(ocupada([ficha('ana', 125, 75), ficha('bia', 175, 75)]))
    expect(posicao(depois, 'bia')).toEqual({ x: 325, y: 75 })
    expect(posicao(depois, 'ana')).toEqual({ x: 275, y: 75 })
  })

  it('ficha que o mestre esconde do jogador (secreta) não segura a esteira — parar ali diria que existe alguém', () => {
    const depois = advanceConveyors(ocupada([ficha('ana', 325, 75), ficha('espiao', 475, 75, { secret: true })]))
    expect(posicao(depois, 'ana')).toEqual({ x: 475, y: 75 })
  })

  it('ficha que o mestre OCULTOU (hidden) não segura: Ana vai à casa dela, no chão que o jogador vê vazio', () => {
    const depois = advanceConveyors(ocupada([ficha('ana', 325, 75), ficha('npc', 475, 75, { hidden: true })]))
    expect(posicao(depois, 'ana')).toEqual({ x: 475, y: 75 })
    expect(posicao(depois, 'npc')).toEqual({ x: 475, y: 75 })
  })

  it('ficha em zona oculta ativa não segura; com a zona revelada, segura', () => {
    const zonaOculta = (revealed: boolean) => ({
      id: 'zo',
      name: 'Nicho',
      revealed,
      points: [
        { x: 450, y: 50 },
        { x: 500, y: 50 },
        { x: 500, y: 100 },
        { x: 450, y: 100 },
      ],
    })
    const comZona = (revealed: boolean): MapData => ({
      ...ocupada([ficha('ana', 325, 75), ficha('npc', 475, 75)]),
      concealZones: [zonaOculta(revealed)],
    })
    expect(posicao(advanceConveyors(comZona(false)), 'ana')).toEqual({ x: 475, y: 75 })
    expect(posicao(advanceConveyors(comZona(true)), 'ana')).toEqual({ x: 425, y: 75 })
  })

  it('ficha na névoa (o centro dela atrás da parede) não segura, mesmo encostando na casa', () => {
    // O ogro grande (3 casas) está na sala B; a borda dele invade a casa (475, 75) da sala A,
    // mas a parede x = 500 esconde o centro dele de Ana: o jogador não o recebe.
    const depois = advanceConveyors(ocupada([ficha('ana', 325, 75), ficha('ogro', 560, 75, { size: 3 })]))
    expect(posicao(depois, 'ana')).toEqual({ x: 475, y: 75 })
    expect(posicao(depois, 'ogro')).toEqual({ x: 560, y: 75 })
  })

  it('ficha sob teto fechado (galpão onde Ana ainda não entrou) não segura', () => {
    const galpao = sala('galpao', 450, 500, { room: { shape: 'rect', name: 'Galpão', roof: true } })
    const comTeto: MapData = {
      ...ocupada([ficha('ana', 325, 75), ficha('npc', 475, 75)]),
      regions: [sala('sala-a', 0, 500), galpao, sala('sala-b', 500, 1000), sala('sala-c', 1000, 1500)],
    }
    expect(posicao(advanceConveyors(comTeto), 'ana')).toEqual({ x: 475, y: 75 })
  })

  it('com a camada Fichas escondida dos jogadores, nenhuma ficha segura a esteira', () => {
    const escondida: MapData = { ...ocupada([ficha('ana', 325, 75), ficha('bia', 475, 75)]), hiddenLayers: ['tokens'] }
    expect(posicao(advanceConveyors(escondida), 'ana')).toEqual({ x: 475, y: 75 })
  })

  it('ficha visível continua segurando: Bia, na mesma sala e à vista, para Ana na casa antes', () => {
    const depois = advanceConveyors(ocupada([ficha('ana', 325, 75), ficha('bia', 475, 75)]))
    expect(posicao(depois, 'ana')).toEqual({ x: 425, y: 75 })
  })

  it('o dragão além do raio de visão do dono de Ana não segura a esteira; dentro do raio, segura', () => {
    // O dragão (6 casas) está na sala B, com a porta A|B aberta: a borda dele toma a casa (475, 200),
    // mas o centro fica 200 px à frente de Ana. Com o raio mínimo da sala (50 px) o jogador não o recebe.
    const mapa = ocupada([ficha('ana', 375, 200), ficha('dragao', 625, 200, { size: 6 })])
    const raioCurto = advanceConveyors(mapa, new Map([['ana', 50]]))
    expect(posicao(raioCurto, 'ana')).toEqual({ x: 525, y: 200 })
    expect(posicao(raioCurto, 'dragao')).toEqual({ x: 625, y: 200 })
    // Raio que alcança o centro dele: à vista, segura na casa antes, como no movimento manual.
    expect(posicao(advanceConveyors(mapa, new Map([['ana', 900]])), 'ana')).toEqual({ x: 425, y: 200 })
  })

  it('bloqueada logo na primeira casa, a ficha fica e o mapa é o MESMO (sem histórico à toa)', () => {
    const presa = ocupada([ficha('ana', 425, 75), ficha('bia', 475, 75)])
    expect(advanceConveyors(presa)).toBe(presa)
  })
})

describe('setRoomConveyor — o mestre marca a sala', () => {
  it('liga, troca direção e passo, e desliga tirando o campo', () => {
    const base = torre()
    const ligada = setRoomConveyor(base, 'sala-a', { direction: 'leste', stepCells: DEFAULT_CONVEYOR_STEP }, () => 'e-nova')
    expect(conveyorOfRoom(ligada, 'sala-a')).toEqual({ id: 'e-nova', roomId: 'sala-a', direction: 'leste', stepCells: 3 })

    const trocada = setRoomConveyor(ligada, 'sala-a', { direction: 'sul', stepCells: 5 }, () => 'outra')
    expect(conveyorsOf(trocada)).toEqual([{ id: 'e-nova', roomId: 'sala-a', direction: 'sul', stepCells: 5 }])

    const desligada = setRoomConveyor(trocada, 'sala-a', null, () => 'x')
    expect('conveyors' in desligada).toBe(false)
  })

  it('mesma coisa, sala que não existe ou passo inválido devolvem o MESMO mapa', () => {
    const ligada = setRoomConveyor(torre(), 'sala-a', { direction: 'leste', stepCells: 3 }, () => 'e1')
    expect(setRoomConveyor(ligada, 'sala-a', { direction: 'leste', stepCells: 3 }, () => 'e2')).toBe(ligada)
    expect(setRoomConveyor(ligada, 'nao-existe', { direction: 'leste', stepCells: 3 }, () => 'e2')).toBe(ligada)
    expect(setRoomConveyor(ligada, 'sala-a', { direction: 'leste', stepCells: 0 }, () => 'e2')).toBe(ligada)
    expect(setRoomConveyor(ligada, 'sala-a', { direction: 'leste', stepCells: 2.5 }, () => 'e2')).toBe(ligada)
  })

  it('o painel sabe se o Avançar muda alguma coisa', () => {
    const vazia = setRoomConveyor(torre(), 'sala-a', { direction: 'leste', stepCells: 3 }, () => 'e1')
    expect(roomConveyorState(vazia, 'sala-a')).toEqual({ direction: 'leste', stepCells: 3, canAdvance: false })
    const comFicha = { ...vazia, tokens: [ficha('ana', 125, 75)] }
    expect(roomConveyorState(comFicha, 'sala-a')).toEqual({ direction: 'leste', stepCells: 3, canAdvance: true })
    expect(roomConveyorState(comFicha, 'sala-b')).toEqual({ direction: null, stepCells: DEFAULT_CONVEYOR_STEP, canAdvance: true })
  })
})

describe('esteira no arquivo', () => {
  it('volta igual do arquivo', () => {
    const map = mesa([], [esteira('e1', 'sala-a', 'oeste', 4)])
    expect(deserializeMap(serializeMap(map)).conveyors).toEqual([{ id: 'e1', roomId: 'sala-a', direction: 'oeste', stepCells: 4 }])
  })

  it('mapa antigo, sem o campo, abre sem inventar o campo', () => {
    const restored = deserializeMap(serializeMap(torre()))
    expect('conveyors' in restored).toBe(false)
  })

  it('lixo editado à mão sai sozinho; lista que sobra vazia é ausência', () => {
    expect(readConveyors('esteira')).toBeUndefined()
    expect(readConveyors([{ id: 'e1', roomId: 'sala-a', direction: 'cima', stepCells: 3 }])).toBeUndefined()
    expect(readConveyors([{ id: 'e1', roomId: 'sala-a', direction: 'leste', stepCells: -2 }])).toBeUndefined()
    expect(readConveyors([{ id: 'e1', roomId: 'sala-a', direction: 'leste', stepCells: 999 }])).toBeUndefined()
    expect(
      readConveyors([
        { id: 'e1', roomId: 'sala-a', direction: 'leste', stepCells: 2 },
        { id: 'e2', roomId: 'sala-a', direction: 'sul', stepCells: 2 },
        { id: '', roomId: 'sala-b', direction: 'sul', stepCells: 2 },
      ]),
    ).toEqual([{ id: 'e1', roomId: 'sala-a', direction: 'leste', stepCells: 2 }])
    expect(deserializeMap('{"id": "x", "conveyors": [{"id": 1}]}').conveyors).toBeUndefined()
  })
})
