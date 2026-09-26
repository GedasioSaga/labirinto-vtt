import { describe, expect, it } from 'vitest'
import { filterMapForPlayer } from '../lib/fogFilter'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { EMPTY_LAST_SEEN, LAST_SEEN_TTL_MS, forgetExpired, lastSeenLabel, liveGhosts, rememberSnapshot, type LastSeenMemory } from './lastSeen'

/**
 * ONDE VI O COLEGA PELA ÚLTIMA VEZ. A ficha alheia que sai do pacote do
 * jogador deixa um fantasma no último ponto em que ele a RECEBEU, com "há N s".
 * Nada novo sai do host: a memória é do cliente e só guarda o que já chegou,
 * então o fantasma nunca conta onde a ficha está agora.
 */

const T0 = 1_000_000

function ficha(id: string, name: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, ...extra }
}

function pacote(id: string, tokens: Token[]): Pick<MapData, 'id' | 'tokens'> {
  return { id, tokens }
}

const ANA = ficha('ana', 'Ana', 200, 200)
const MINHAS = ['ana']

/** Snapshots em sequência, um segundo entre cada. */
function lembra(snapshots: Pick<MapData, 'id' | 'tokens'>[], own: readonly string[] = MINHAS, from = T0): LastSeenMemory {
  return snapshots.reduce((memory, snap, k) => rememberSnapshot(memory, snap, own, from + k * 1000), EMPTY_LAST_SEEN)
}

describe('rememberSnapshot / liveGhosts', () => {
  it('ficha alheia que some do pacote deixa o fantasma no último ponto recebido, com o nome que chegou', () => {
    const memory = lembra([pacote('cena', [ANA, ficha('bruno', 'Bruno', 300, 250)]), pacote('cena', [ANA])])
    expect(liveGhosts(memory, T0 + 1000)).toEqual([{ tokenId: 'bruno', name: 'Bruno', x: 300, y: 250, size: 1, heading: null, lostAt: T0 + 1000 }])
  })

  it('a ficha do próprio jogador nunca vira fantasma', () => {
    const memory = lembra([pacote('cena', [ANA, ficha('bia', 'Bia', 400, 400)]), pacote('cena', [])], ['ana', 'bia'])
    expect(liveGhosts(memory, T0 + 1000)).toEqual([])
  })

  it('a ficha que o mestre passa para o jogador deixa de ser fantasma', () => {
    const sumiu = lembra([pacote('cena', [ANA, ficha('bruno', 'Bruno', 300, 250)]), pacote('cena', [ANA])])
    expect(liveGhosts(sumiu, T0 + 1000)).toHaveLength(1)
    const agoraEMinha = rememberSnapshot(sumiu, pacote('cena', [ANA]), ['ana', 'bruno'], T0 + 2000)
    expect(liveGhosts(agoraEMinha, T0 + 2000)).toEqual([])
  })

  it('o colega que reaparece apaga o fantasma', () => {
    const memory = lembra([
      pacote('cena', [ANA, ficha('bruno', 'Bruno', 300, 250)]),
      pacote('cena', [ANA]),
      pacote('cena', [ANA, ficha('bruno', 'Bruno', 320, 250)]),
    ])
    expect(liveGhosts(memory, T0 + 2000)).toEqual([])
  })

  it('o fantasma some sozinho depois de 2 minutos', () => {
    const memory = lembra([pacote('cena', [ANA, ficha('bruno', 'Bruno', 300, 250)]), pacote('cena', [ANA])])
    const lostAt = T0 + 1000
    expect(liveGhosts(memory, lostAt + LAST_SEEN_TTL_MS - 1)).toHaveLength(1)
    expect(liveGhosts(memory, lostAt + LAST_SEEN_TTL_MS)).toEqual([])
    expect(LAST_SEEN_TTL_MS).toBe(120_000)
  })

  it('o fantasma vencido sai da memória no snapshot seguinte', () => {
    const memory = lembra([pacote('cena', [ANA, ficha('bruno', 'Bruno', 300, 250)]), pacote('cena', [ANA])])
    const depois = rememberSnapshot(memory, pacote('cena', [ANA]), MINHAS, T0 + 1000 + LAST_SEEN_TTL_MS)
    expect(depois.ghosts.size).toBe(0)
  })

  it('forgetExpired tira só os vencidos e, sem vencido, devolve a mesma memória', () => {
    const memory = lembra([pacote('cena', [ANA, ficha('bruno', 'Bruno', 300, 250)]), pacote('cena', [ANA])])
    expect(forgetExpired(memory, T0 + 2000)).toBe(memory)
    const limpa = forgetExpired(memory, T0 + 1000 + LAST_SEEN_TTL_MS)
    expect(limpa.ghosts.size).toBe(0)
    expect(limpa.mapId).toBe('cena')
  })

  it('troca de cena apaga os fantasmas da cena de antes', () => {
    const memory = lembra([pacote('cena-1', [ANA, ficha('bruno', 'Bruno', 300, 250)]), pacote('cena-1', [ANA]), pacote('cena-2', [ANA])])
    expect(liveGhosts(memory, T0 + 2000)).toEqual([])
    expect(memory.mapId).toBe('cena-2')
  })

  it('quem estava à vista na chegada à cena nova e some deixa fantasma nela, não na de antes', () => {
    const memory = lembra([
      pacote('cena-1', [ANA, ficha('bruno', 'Bruno', 300, 250)]),
      pacote('cena-2', [ANA, ficha('caio', 'Caio', 600, 100)]),
      pacote('cena-2', [ANA]),
    ])
    expect(liveGhosts(memory, T0 + 2000).map((g) => g.tokenId)).toEqual(['caio'])
  })

  it('a seta guarda a direção do último passo visto', () => {
    const memory = lembra([
      pacote('cena', [ANA, ficha('bruno', 'Bruno', 300, 250)]),
      pacote('cena', [ANA, ficha('bruno', 'Bruno', 300, 290)]),
      pacote('cena', [ANA]),
    ])
    const [fantasma] = liveGhosts(memory, T0 + 2000)
    expect(fantasma).toBeDefined()
    expect(fantasma?.x).toBe(300)
    expect(fantasma?.y).toBe(290)
    // Para baixo na tela (y cresce para baixo): +90 graus.
    expect(fantasma?.heading).toBeCloseTo(Math.PI / 2, 9)
  })

  it('ficha parada entre dois snapshots mantém a direção do passo de antes', () => {
    const memory = lembra([
      pacote('cena', [ANA, ficha('bruno', 'Bruno', 300, 250)]),
      pacote('cena', [ANA, ficha('bruno', 'Bruno', 340, 250)]),
      pacote('cena', [ANA, ficha('bruno', 'Bruno', 340, 250)]),
      pacote('cena', [ANA]),
    ])
    expect(liveGhosts(memory, T0 + 3000).map((g) => g.heading)).toEqual([0])
  })

  it('o mesmo snapshot repetido (redesenho sem mudança) não cria nem mexe em fantasma', () => {
    const snap = pacote('cena', [ANA, ficha('bruno', 'Bruno', 300, 250)])
    const memory = lembra([snap, snap, snap])
    expect(liveGhosts(memory, T0 + 2000)).toEqual([])
    expect(memory.seen.get('bruno')).toEqual({ name: 'Bruno', x: 300, y: 250, size: 1, heading: null })
  })
})

describe('lastSeenLabel', () => {
  const fantasma = { tokenId: 'bruno', name: 'Bruno', x: 0, y: 0, size: 1, heading: null, lostAt: T0 }

  it('segundos até um minuto, depois minutos', () => {
    expect(lastSeenLabel(fantasma, T0, true)).toBe('Bruno · há 0 s')
    expect(lastSeenLabel(fantasma, T0 + 12_400, true)).toBe('Bruno · há 12 s')
    expect(lastSeenLabel(fantasma, T0 + 59_999, true)).toBe('Bruno · há 59 s')
    expect(lastSeenLabel(fantasma, T0 + 60_000, true)).toBe('Bruno · há 1 min')
    expect(lastSeenLabel(fantasma, T0 + 119_000, true)).toBe('Bruno · há 1 min')
  })

  it('sem nome (o mestre deixou a ficha sem rótulo, ou os nomes estão desligados) fica só o tempo', () => {
    expect(lastSeenLabel({ ...fantasma, name: '' }, T0 + 5000, true)).toBe('há 5 s')
    expect(lastSeenLabel(fantasma, T0 + 5000, false)).toBe('há 5 s')
  })

  it('relógio que volta para trás não mostra tempo negativo', () => {
    expect(lastSeenLabel(fantasma, T0 - 3000, true)).toBe('Bruno · há 0 s')
  })
})

/**
 * O RECORTE continua mandando: o fantasma nasce SÓ do que `filterMapForPlayer`
 * já entregou. Aqui o pacote é o de verdade, montado pelo recorte do mestre.
 */
describe('o fantasma não conta nada que o recorte escondeu', () => {
  function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
    return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
  }

  /** Duas salas separadas por uma parede em x=500; o jogador p1 tem o herói na sala da esquerda. */
  function mapa(tokens: Token[]): MapData {
    return { ...createEmptyMap('m', 'Nome de trabalho da cena', 1000, 1000, 40), walls: [parede('divisoria', 500, 0, 500, 1000)], tokens }
  }
  const POSSE = { p1: ['heroi'], p2: ['ladino'] }
  const RAIO = 700
  const heroi = ficha('heroi', 'Herói', 200, 200)

  function recorte(tokens: Token[]): Pick<MapData, 'id' | 'tokens'> {
    return filterMapForPlayer(mapa(tokens), 'p1', POSSE, RAIO).map
  }

  it('o colega que atravessa a parede fica no último ponto VISTO, nunca no ponto onde está agora', () => {
    const antes = recorte([heroi, ficha('ladino', 'Ladino', 300, 250)])
    const depois = recorte([heroi, ficha('ladino', 'Ladino', 777, 333)])
    // O pacote já não traz o ladino: a única fonte do fantasma é o que chegou antes.
    expect(depois.tokens.map((t) => t.id)).toEqual(['heroi'])
    const memory = lembra([antes, depois], ['heroi'])
    expect(liveGhosts(memory, T0 + 1000)).toEqual([{ tokenId: 'ladino', name: 'Ladino', x: 300, y: 250, size: 1, heading: null, lostAt: T0 + 1000 }])
    const json = JSON.stringify([...memory.seen, ...memory.ghosts])
    expect(json).not.toContain('777')
    expect(json).not.toContain('333')
  })

  it('o fantasma leva o nome PÚBLICO que chegou, nunca o nome de trabalho do mestre', () => {
    const antes = recorte([heroi, ficha('capanga', 'Capataz traidor', 300, 250, { publicName: 'Vulto' })])
    const depois = recorte([heroi, ficha('capanga', 'Capataz traidor', 800, 250, { publicName: 'Vulto' })])
    const memory = lembra([antes, depois], ['heroi'])
    expect(liveGhosts(memory, T0 + 1000).map((g) => g.name)).toEqual(['Vulto'])
    expect(JSON.stringify([...memory.seen, ...memory.ghosts])).not.toContain('Capataz')
  })

  it('ficha que nunca entrou na visão não deixa fantasma nem rastro na memória', () => {
    const memory = lembra(
      [recorte([heroi, ficha('espiao', 'Espião', 800, 200)]), recorte([heroi, ficha('espiao', 'Espião', 900, 900)]), recorte([heroi])],
      ['heroi'],
    )
    expect(liveGhosts(memory, T0 + 2000)).toEqual([])
    expect(JSON.stringify([...memory.seen, ...memory.ghosts])).not.toContain('espiao')
  })

  it('ficha secreta do mestre, que o recorte nunca entregou, não deixa fantasma', () => {
    const memory = lembra(
      [recorte([heroi, ficha('sombra', 'Sombra', 300, 250, { secret: true })]), recorte([heroi])],
      ['heroi'],
    )
    expect(liveGhosts(memory, T0 + 1000)).toEqual([])
    expect(memory.seen.has('sombra')).toBe(false)
  })

  it('o fantasma não guarda foto nem cor: é só o contorno', () => {
    const foto = 'data:image/png;base64,iVBORw0KGgo='
    const antes = recorte([heroi, ficha('ladino', 'Ladino', 300, 250, { imageData: foto, color: '#ff0000' })])
    const memory = lembra([antes, recorte([heroi])], ['heroi'])
    const [fantasma] = liveGhosts(memory, T0 + 1000)
    expect(fantasma).toBeDefined()
    expect(Object.keys(fantasma ?? {}).sort()).toEqual(['heading', 'lostAt', 'name', 'size', 'tokenId', 'x', 'y'])
  })
})
