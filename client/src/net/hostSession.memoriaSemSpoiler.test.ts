import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Drawing, MapData, Pin, Token, Wall } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * MEMÓRIA SEM SPOILER. O explorado mostra o que o jogador VIU, não o presente:
 * o que o mestre muda longe dele (parede nova, desabamento, desenho, pino) não
 * chega pela rede até ele ver o lugar de novo. Só a visão atual mostra o agora.
 *
 * Mapa aberto de 1000 × 1000 px, sem paredes que bloqueiem a visão, raio 300:
 * o herói começa em (200, 200), anda até (800, 800) — o canto de cima vira
 * explorado e fica fora da visão — e é lá que o mestre mexe.
 */

const CODE = 'AB12CD'
const RADIUS = 300
const PERTO = { x: 200, y: 200 }
const LONGE = { x: 800, y: 800 }

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function wall(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function pin(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description: `desc-${id}`, image: null, ...extra }
}

function texto(id: string, x: number, y: number, text: string): Drawing {
  return { id, kind: 'text', x, y, text, color: '#fff', fontSize: 12 }
}

/** A sala de cima como o jogador a viu: uma parede velha, um pino e um bilhete. */
function antes(heroi: { x: number; y: number }): MapData {
  return {
    ...createEmptyMap('mapa-torre', 'Torre', 25, 25, 40),
    tokens: [token('heroi', heroi.x, heroi.y)],
    // Parede curta que não fecha nada: a visão passa pelos lados.
    walls: [wall('parede-velha', 120, 320, 280, 320)],
    pins: [pin('pino-velho', 150, 150)],
    drawings: [texto('bilhete', 250, 150, 'bilhete original')],
  }
}

/** O mestre muda a sala de cima enquanto o herói está longe. */
function depois(heroi: { x: number; y: number }): MapData {
  const base = antes(heroi)
  return {
    ...base,
    // Desabamento: a parede velha some; uma parede nova fecha o corredor.
    walls: [wall('parede-nova', 100, 100, 300, 100)],
    pins: [pin('pino-velho', 150, 150), pin('pino-novo', 220, 220, { description: 'tesouro escondido' })],
    drawings: [texto('bilhete', 250, 150, 'bilhete reescrito'), texto('desenho-novo', 180, 250, 'armadilha nova')],
  }
}

function snapshotOf(messages: { clientId: string; msg: HostMessage }[]): Extract<HostMessage, { type: 'snapshot' }> {
  const found = messages.find((o) => o.clientId === 'c1' && o.msg.type === 'snapshot')?.msg
  if (found === undefined || found.type !== 'snapshot') throw new Error('esperava snapshot para c1')
  return found
}

function mesa() {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const joined = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, antes(PERTO)).outbound[0]?.msg
  if (joined?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(joined.playerId, 'heroi')
  return { s, playerId: joined.playerId }
}

/** Ana viu a sala de cima, andou para longe, e o mestre mexeu na sala. */
function anaLongeDepoisDaMudanca() {
  const t = mesa()
  // Vê a sala de cima (vira explorada) e anda para o canto de baixo.
  t.s.broadcast(antes(PERTO))
  t.s.broadcast(antes(LONGE))
  return { ...t, snap: snapshotOf(t.s.broadcast(depois(LONGE)).outbound) }
}

describe('hostSession: memória do explorado sem spoiler', () => {
  it('o que o mestre criou longe do jogador não chega pela rede', () => {
    const { snap } = anaLongeDepoisDaMudanca()
    const json = JSON.stringify(snap.map)
    expect(json).not.toContain('parede-nova')
    expect(json).not.toContain('pino-novo')
    expect(json).not.toContain('tesouro escondido')
    expect(json).not.toContain('desenho-novo')
    expect(json).not.toContain('armadilha nova')
    // Controle: o pino que ela viu continua na memória.
    expect(snap.map.pins.map((p) => p.id)).toEqual(['pino-velho'])
  })

  it('o jogador lembra a versão que viu: a parede desabada e o bilhete antigo', () => {
    const { snap } = anaLongeDepoisDaMudanca()
    expect(snap.map.walls.map((w) => w.id)).toEqual(['parede-velha'])
    const bilhete = snap.map.drawings.find((d) => d.id === 'bilhete')
    expect(bilhete).toMatchObject({ kind: 'text', text: 'bilhete original' })
    expect(JSON.stringify(snap.map)).not.toContain('bilhete reescrito')
  })

  it('ao voltar a ver o lugar, a visão atual mostra o presente e a memória se atualiza', () => {
    const t = anaLongeDepoisDaMudanca()
    const volta = snapshotOf(t.s.broadcast(depois(PERTO)).outbound)
    expect(volta.map.walls.map((w) => w.id)).toEqual(['parede-nova'])
    expect(volta.map.pins.map((p) => p.id).sort()).toEqual(['pino-novo', 'pino-velho'])
    expect(volta.map.drawings.find((d) => d.id === 'bilhete')).toMatchObject({ text: 'bilhete reescrito' })
    // E ao sair de novo, lembra do presente que acabou de ver — não da versão velha.
    const deNovoLonge = snapshotOf(t.s.broadcast(depois(LONGE)).outbound)
    expect(deNovoLonge.map.walls.map((w) => w.id)).toEqual(['parede-nova'])
    expect(deNovoLonge.map.pins.map((p) => p.id).sort()).toEqual(['pino-novo', 'pino-velho'])
    expect(deNovoLonge.map.drawings.find((d) => d.id === 'bilhete')).toMatchObject({ text: 'bilhete reescrito' })
  })

  it('o que o mestre esconde depois continua não chegando, mesmo já visto', () => {
    const t = mesa()
    t.s.broadcast(antes(PERTO))
    t.s.broadcast(antes(LONGE))
    const escondido = { ...antes(LONGE), pins: [pin('pino-velho', 150, 150, { hidden: true })] }
    const snap = snapshotOf(t.s.broadcast(escondido).outbound)
    expect(snap.map.pins).toEqual([])
    expect(JSON.stringify(snap.map)).not.toContain('pino-velho')
  })

  it('parede nova em área nunca explorada continua saindo (a planta vai inteira fora da memória)', () => {
    const t = mesa()
    t.s.broadcast(antes(PERTO))
    const comParedeLonge = { ...antes(PERTO), walls: [...antes(PERTO).walls, wall('parede-do-escuro', 900, 50, 950, 50)] }
    const snap = snapshotOf(t.s.broadcast(comParedeLonge).outbound)
    expect(snap.map.walls.map((w) => w.id).sort()).toEqual(['parede-do-escuro', 'parede-velha'])
  })

  it('"Revelar planta" do mestre mostra o que existe agora, mesmo onde o jogador nunca andou', () => {
    const t = mesa()
    t.s.broadcast(antes(LONGE))
    t.s.revealPlan(t.playerId, depois(LONGE))
    const snap = snapshotOf(t.s.broadcast(depois(LONGE)).outbound)
    expect(snap.map.pins.map((p) => p.id).sort()).toEqual(['pino-novo', 'pino-velho'])
    expect(snap.map.walls.map((w) => w.id)).toEqual(['parede-nova'])
  })
})
