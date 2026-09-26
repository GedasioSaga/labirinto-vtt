import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Espiada } from '../lib/espiar'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * ESPIAR PELA PASSAGEM contra os limites da cena de LÁ: quem espia não vê mais
 * longe do que veria estando lá ("Visão nesta cena", noite na cena externa,
 * fator de visão do jogador), e nunca recebe a ficha de OUTRO jogador que está
 * na outra cena — nem posição, nem a cor que diria de quem é.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const GRID = 50
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const VERMELHO = '#c0392b'
const COR_DA_BIA = '#2e86c1'
const HORA_DIA = 12
const HORA_NOITE = 23

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description: `Pino ${id}`, image: null, destino, ...extra }
}

interface Opcoes {
  /** "Dá vista" da grade do Salão. */
  daVista?: number
  /** Campos extras da Cripta ("Visão nesta cena", externa). */
  cripta?: Partial<MapData>
  /** A ficha da Bia na Cripta, a 2 casas ABAIXO da boca do poço. */
  comBia?: boolean
}

/** Boca do poço na Cripta em (1500, 400); o vulto (NPC) a 3 casas à direita. */
function mundo({ daVista = 6, cripta = {}, comBia = false }: Opcoes = {}): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Aventura', 40, 10, GRID),
    tokens: [ficha('heroi', 240, 200)],
    pins: [viagem('grade', 200, 200, { sceneId: CRIPTA, pinId: 'boca' }, { daVista })],
  }
  const tokens = [ficha('vulto', 1650, 400, { color: VERMELHO })]
  if (comBia) tokens.push(ficha('ficha-bia', 1500, 500, { color: COR_DA_BIA }))
  const mapaCripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta Rubra', 80, 20, GRID),
    tokens,
    pins: [viagem('boca', 1500, 400, { sceneId: SALAO, pinId: 'grade' })],
    ...cripta,
  }
  return {
    open: { sceneId: SALAO, name: 'Salão', map: salao },
    background: [{ sceneId: CRIPTA, name: 'Cripta Rubra', map: mapaCripta }],
  }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

function mesa(w: HostWorld, hora: number | null = null) {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => 1_000_000,
    getClock: () => hora,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
  const bia = welcomeOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w).outbound)
  s.assignToken(ana.playerId, 'heroi')
  s.assignToken(bia.playerId, 'ficha-bia')
  s.broadcast(w)
  return { s, ana, espiar: (): HostResult => s.handleMessage('c1', { type: 'pin.peek', pinId: 'grade' }, w) }
}

function vistaDe(r: HostResult): Espiada {
  const msg = r.outbound[0]?.msg
  if (msg?.type !== 'pin.peek.view') throw new Error(`esperava pin.peek.view, veio ${JSON.stringify(msg)}`)
  return msg.view
}

describe('hostSession: a espiada respeita a visão da cena de lá', () => {
  it('controle — sem limite na Cripta, "Dá vista" 6 alcança o vulto a 3 casas', () => {
    const vista = vistaDe(mesa(mundo()).espiar())
    expect(vista.raio).toBe(6 * GRID)
    expect(vista.tokens).toEqual([{ x: 150, y: 0, size: 1, color: VERMELHO }])
  })

  it('SEGURANÇA — "Visão nesta cena" = 1 na Cripta: a espiada vê 1 casa, não as 6 do pino', () => {
    const vista = vistaDe(mesa(mundo({ cripta: { visionCells: 1 } })).espiar())
    expect(vista.raio).toBe(GRID)
    expect(vista.tokens).toEqual([])
    // Nada da visão passa do raio de quem estaria lá.
    const longe = vista.vision.flat().filter((p) => Math.hypot(p.x, p.y) > GRID + 1)
    expect(longe).toEqual([])
  })

  it('SEGURANÇA — noite na Cripta externa: o raio cai à metade, e o vulto a 3 casas some', () => {
    const cripta: Partial<MapData> = { visionCells: 4, externa: true }
    const dia = vistaDe(mesa(mundo({ cripta }), HORA_DIA).espiar())
    expect(dia.raio).toBe(4 * GRID)
    expect(dia.tokens).toEqual([{ x: 150, y: 0, size: 1, color: VERMELHO }])
    const noite = vistaDe(mesa(mundo({ cripta }), HORA_NOITE).espiar())
    expect(noite.raio).toBe(2 * GRID)
    expect(noite.tokens).toEqual([])
  })

  it('SEGURANÇA — fator de visão 0,5 do jogador: a espiada encolhe com ele', () => {
    const t = mesa(mundo({ cripta: { visionCells: 4 } }))
    t.s.setVisionFactor(t.ana.playerId, 0.5)
    const vista = vistaDe(t.espiar())
    expect(vista.raio).toBe(2 * GRID)
    expect(vista.tokens).toEqual([])
  })

  it('"Dá vista" menor que a visão de lá: vale o do pino (o menor dos dois)', () => {
    const vista = vistaDe(mesa(mundo({ daVista: 2, cripta: { visionCells: 5 } })).espiar())
    expect(vista.raio).toBe(2 * GRID)
    expect(vista.tokens).toEqual([])
  })
})

describe('hostSession: a espiada não entrega jogador de outra cena', () => {
  it('SEGURANÇA — a Bia na Cripta, a 2 casas da boca do poço: a Ana não recebe posição nem cor dela', () => {
    const r = mesa(mundo({ comBia: true })).espiar()
    const vista = vistaDe(r)
    // O vulto (sem dono) continua aparecendo; a ficha da Bia, não.
    expect(vista.tokens).toEqual([{ x: 150, y: 0, size: 1, color: VERMELHO }])
    const texto = JSON.stringify(r.outbound)
    expect(texto).toContain('pin.peek.view')
    expect(texto).not.toContain(COR_DA_BIA)
    expect(texto).not.toContain('ficha-bia')
  })
})
