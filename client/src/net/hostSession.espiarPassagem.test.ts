import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import { ESPIADA_MAX_FICHAS, ESPIAR_INTERVALO_MIN_MS } from '../lib/espiar'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * ESPIAR PELA PASSAGEM no host. A autoridade é aqui: o pino tem de estar no
 * recorte do jogador, ser de viagem, ligado e marcado "Dá vista", e uma ficha
 * dele tem de estar ENCOSTADA. A resposta vai só a quem espiou, sem nome de
 * cena, e nada do outro lado entra na memória dele.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const GRID = 50
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function viagem(id: string, x: number, y: number, description: string, destino: Pin['destino'], extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'viagem', description, image: null, destino, ...extra }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

interface Opcoes {
  /** Onde está a ficha da Ana no Salão. */
  heroi?: { x: number; y: number }
  grade?: Partial<Pin>
}

/**
 * O Salão (aberto) com a grade que dá vista para a Cripta, e a Cripta de fundo
 * com um NPC a 2 casas do par e outro longe. A cripta é grande: a boca do poço
 * fica longe do resto, onde a Ana chega pela escada.
 */
function mundo({ heroi = { x: 240, y: 200 }, grade = {} }: Opcoes = {}): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Aventura', 40, 10, GRID),
    tokens: [ficha('heroi', heroi.x, heroi.y)],
    pins: [
      viagem('grade', 200, 200, 'Grade no chão', { sceneId: CRIPTA, pinId: 'boca' }, { daVista: 3, ...grade }),
      viagem('escada', 600, 200, 'Escada', { sceneId: CRIPTA, pinId: 'fundo' }),
      viagem('sem-vista', 280, 200, 'Porta', { sceneId: CRIPTA, pinId: 'outra' }),
    ],
  }
  const cripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta Rubra', 80, 20, GRID),
    tokens: [ficha('capataz', 1600, 400, { publicName: 'Vulto', color: '#c0392b' }), ficha('longe', 3000, 400)],
    pins: [
      viagem('boca', 1500, 400, 'Boca do poço', { sceneId: SALAO, pinId: 'grade' }),
      viagem('fundo', 200, 400, 'Pé da escada', { sceneId: SALAO, pinId: 'escada' }),
      viagem('outra', 400, 400, 'Porta de trás', { sceneId: SALAO, pinId: 'sem-vista' }),
    ],
  }
  return {
    open: { sceneId: SALAO, name: 'Salão', map: salao },
    background: [{ sceneId: CRIPTA, name: 'Cripta Rubra', map: cripta }],
  }
}

function mesa(w: HostWorld = mundo()) {
  let clock = 1_000_000
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => clock,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound)
  s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w)
  s.assignToken(ana.playerId, 'heroi')
  s.broadcast(w)
  return {
    s,
    w,
    ana,
    advance: (ms: number) => {
      clock += ms
    },
    espiar: (pinId: string, world: HostWorld = w) => s.handleMessage('c1', { type: 'pin.peek', pinId }, world),
  }
}

function recusa(r: HostResult): string | null {
  const msg = r.outbound[0]?.msg
  return msg?.type === 'pin.peek.rejected' ? msg.reason : null
}

describe('hostSession: espiar pela passagem', () => {
  it('ficha encostada no pino que dá vista: o recorte do outro lado vai SÓ para quem espiou, e o mestre fica sabendo', () => {
    const t = mesa()
    const r = t.espiar('grade')
    expect(r.outbound.length).toBe(1)
    const [saida] = r.outbound
    expect(saida?.clientId).toBe('c1')
    const msg = saida?.msg
    if (msg?.type !== 'pin.peek.view') throw new Error('esperava pin.peek.view')
    expect(msg.pinId).toBe('grade')
    expect(msg.durationMs).toBeGreaterThan(0)
    // O capataz, a 2 casas do par, aparece como ponto na cor dele.
    expect(msg.view.tokens).toEqual([{ x: 100, y: 0, size: 1, color: '#c0392b' }])
    expect(r.pinPeek).toEqual({ playerId: t.ana.playerId, playerName: 'Ana', pinLabel: 'Grade no chão', toSceneId: CRIPTA, toSceneName: 'Cripta Rubra' })
  })

  it('SEGURANÇA — o que vai ao jogador não leva nome nem id da cena, do mapa, do pino par ou das fichas de lá', () => {
    const t = mesa()
    const texto = JSON.stringify(t.espiar('grade').outbound)
    expect(texto).toContain('pin.peek.view')
    for (const segredo of ['Cripta Rubra', CRIPTA, 'mapa-cripta', 'boca', 'Boca do poço', 'capataz', 'Vulto', 'longe']) {
      expect(texto).not.toContain(segredo)
    }
  })

  it('SEGURANÇA — nada do outro lado vira memória: chegando lá depois, a boca do poço continua inexplorada', () => {
    const t = mesa()
    expect(t.espiar('grade').outbound[0]?.msg.type).toBe('pin.peek.view')
    // A Ana vai para a Cripta pela escada, longe da boca do poço.
    const r = t.s.sendPlayer(t.ana.playerId, CRIPTA, 'fundo', t.w)
    const transfer = r.applyTransfer
    if (transfer === undefined) throw new Error('esperava a transferência')
    const salao = t.w.open.map
    const [cripta] = t.w.background
    if (cripta === undefined) throw new Error('mundo sem cripta')
    const depois: HostWorld = {
      open: { ...t.w.open, map: { ...salao, tokens: [] } },
      background: [{ ...cripta, map: { ...cripta.map, tokens: [...cripta.map.tokens, ficha('heroi', transfer.x, transfer.y)] } }],
    }
    const snap = t.s.broadcast(depois).outbound.find((o) => o.clientId === 'c1')?.msg
    if (snap?.type !== 'snapshot') throw new Error('esperava snapshot')
    const explorado = decodeExploration(snap.explored)
    if (explorado === null) throw new Error('explorado ilegível')
    // Onde ela está agora foi visto; a boca do poço, que ela só espiou, não.
    expect(isPointExplored(explorado, { x: transfer.x, y: transfer.y })).toBe(true)
    expect(isPointExplored(explorado, { x: 1500, y: 400 })).toBe(false)
    expect(snap.map.tokens.some((tk) => tk.id === 'capataz')).toBe(false)
  })

  it('ficha longe do pino: recusa genérica, sem recorte e sem aviso ao mestre', () => {
    const t = mesa(mundo({ heroi: { x: 400, y: 200 } }))
    const r = t.espiar('grade')
    expect(recusa(r)).toBe('unavailable')
    expect(r.pinPeek).toBeUndefined()
    expect(JSON.stringify(r.outbound)).not.toContain('view')
  })

  it('pino sem "Dá vista", inventado ou só de chegada: a mesma recusa genérica', () => {
    const t = mesa(mundo({ heroi: { x: 240, y: 200 } }))
    expect(recusa(t.espiar('sem-vista'))).toBe('unavailable')
    t.advance(ESPIAR_INTERVALO_MIN_MS)
    expect(recusa(t.espiar('nao-existe'))).toBe('unavailable')
    t.advance(ESPIAR_INTERVALO_MIN_MS)
    const soChegada = mesa(mundo({ grade: { soChegada: true } }))
    expect(recusa(soChegada.espiar('grade'))).toBe('unavailable')
  })

  it('pino fora do recorte do jogador (secreto) não deixa espiar', () => {
    const t = mesa(mundo({ grade: { secret: true } }))
    const r = t.espiar('grade')
    expect(recusa(r)).toBe('unavailable')
    expect(r.pinPeek).toBeUndefined()
  })

  it('pino sem par ligado não deixa espiar', () => {
    const t = mesa(mundo({ grade: { destino: null } }))
    expect(recusa(t.espiar('grade'))).toBe('unavailable')
  })

  it('porta trancada ainda deixa espiar pela grade (espiar não é passar)', () => {
    const t = mesa(mundo({ grade: { passagem: 'trancada' } }))
    expect(t.espiar('grade').outbound[0]?.msg.type).toBe('pin.peek.view')
  })

  it('espiar de novo antes do intervalo: too_soon; depois dele, vale', () => {
    const t = mesa()
    expect(t.espiar('grade').outbound[0]?.msg.type).toBe('pin.peek.view')
    const r = t.espiar('grade')
    expect(recusa(r)).toBe('too_soon')
    expect(r.pinPeek).toBeUndefined()
    t.advance(ESPIAR_INTERVALO_MIN_MS)
    expect(t.espiar('grade').outbound[0]?.msg.type).toBe('pin.peek.view')
  })

  it('recorte acima do que o jogador aceita: recusa genérica, sem recorte e sem aviso ao mestre', () => {
    const w = mundo()
    const [cripta] = w.background
    if (cripta === undefined) throw new Error('mundo sem cripta')
    // Uma multidão à vista em volta da boca do poço: mais fichas do que o jogador aceita.
    const multidao = Array.from({ length: ESPIADA_MAX_FICHAS + 6 }, (_, i) => ficha(`m${i}`, 1460 + (i % 10) * 10, 360 + Math.floor(i / 10) * 10))
    const cheio: HostWorld = { ...w, background: [{ ...cripta, map: { ...cripta.map, tokens: [...cripta.map.tokens, ...multidao] } }] }
    const t = mesa(cheio)
    const r = t.espiar('grade')
    expect(recusa(r)).toBe('unavailable')
    expect(r.pinPeek).toBeUndefined()
    expect(JSON.stringify(r.outbound)).not.toContain('view')
  })

  /**
   * A Ana longe da grade (500 px: vê o pino, mas não encosta) e um ajudante
   * emprestado a ela encostado na grade, com o acordo de visão dado.
   */
  function comAjudante(visao: boolean) {
    const w = mundo({ heroi: { x: 700, y: 200 } })
    const salao = w.open.map
    const comNpc: HostWorld = { ...w, open: { ...w.open, map: { ...salao, tokens: [...salao.tokens, ficha('npc', 240, 200)] } } }
    const t = mesa(comNpc)
    t.s.lendToken(t.ana.playerId, 'npc', { tarefa: 'olhar pela grade', minutos: 30, visao })
    return t
  }

  it('SEGURANÇA — ajudante emprestado SEM visão encostado no pino não espia: anda, mas não enxerga', () => {
    const t = comAjudante(false)
    const r = t.espiar('grade')
    expect(recusa(r)).toBe('unavailable')
    expect(r.pinPeek).toBeUndefined()
    expect(JSON.stringify(r.outbound)).not.toContain('view')
  })

  it('ajudante emprestado COM visão encostado no pino espia pela Ana', () => {
    const t = comAjudante(true)
    const r = t.espiar('grade')
    expect(r.outbound[0]?.msg.type).toBe('pin.peek.view')
    expect(r.pinPeek?.playerId).toBe(t.ana.playerId)
  })

  it('quem não tem ficha não espia; conexão que nem entrou recebe not_joined', () => {
    const t = mesa()
    expect(recusa(t.s.handleMessage('c2', { type: 'pin.peek', pinId: 'grade' }, t.w))).toBe('unavailable')
    expect(t.s.handleMessage('c9', { type: 'pin.peek', pinId: 'grade' }, t.w).outbound[0]?.msg).toEqual({ type: 'error', reason: 'not_joined' })
  })
})
