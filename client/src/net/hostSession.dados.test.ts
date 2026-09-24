/**
 * DADO ROLADO NA SALA no host. Quem rola é o HOST (o jogador só pede), e o
 * resultado vai a todo jogador conectado — a mesa inteira vê, de qualquer
 * cena, porque a rolagem não diz nada de onde ninguém está. A rolagem
 * ESCONDIDA do mestre não sai para ninguém: nem na hora, nem depois.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, DICE_ROLL_MIN_INTERVAL_MS, type HostResult, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

/** Salão (aberto): Ana; Cripta (de fundo): Bruno. Caio entra sem ficha (aguardando). */
function mundo(): HostWorld {
  return {
    open: { sceneId: 's-salao', name: 'Salao Norte', map: mapa('m-salao', 'Salao Norte', [ficha('lanterna', 100, 100)]) },
    background: [{ sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 200, 100)]) }],
  }
}

function mesa(faces: number[] = []) {
  let clock = 10_000
  let n = 0
  const fila = [...faces]
  const s = createHostSession({
    code: CODE,
    visionRadius: 5000,
    now: () => clock,
    randomId: () => `id-${(n += 1)}`,
    rollDie: (sides) => fila.shift() ?? sides,
  })
  const w = mundo()
  const entra = (clientId: string, name: string): string => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, w).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return welcome.playerId
  }
  const ana = entra('c1', 'Ana')
  const bruno = entra('c2', 'Bruno')
  entra('c3', 'Caio')
  s.assignToken(ana, 'lanterna')
  s.assignToken(bruno, 'machado')
  s.broadcast(w)
  return { s, w, advance: (ms: number) => (clock += ms), now: () => clock }
}

const clientes = (r: HostResult) => r.outbound.map((o) => o.clientId).sort()

describe('hostSession: dado rolado na sala', () => {
  it('Ana pede 2d6+3: o host rola e a mesa inteira recebe o mesmo resultado, com o nome dela', () => {
    const t = mesa([5, 4])
    const r = t.s.handleMessage('c1', { type: 'dice.roll', count: 2, sides: 6, modifier: 3 }, t.w)
    const roll = { id: 'id-7', from: 'Ana', count: 2, sides: 6, modifier: 3, results: [5, 4], total: 12, at: t.now() }
    // Ana (a própria tela), Bruno (outra cena) e Caio (sem ficha ainda): todos da mesa.
    expect(clientes(r)).toEqual(['c1', 'c2', 'c3'])
    for (const o of r.outbound) expect(o.msg).toEqual({ type: 'dice.rolled', roll })
    // O mestre vê a mesma rolagem na tela dele.
    expect(r.diceRoll).toEqual(roll)
  })

  it('resultado e total inventados pelo jogador não valem: quem rola é o host', () => {
    const t = mesa([1])
    const r = t.s.handleMessage('c1', { type: 'dice.roll', count: 1, sides: 20, modifier: 0, results: [20], total: 20 }, t.w)
    expect(r.diceRoll?.results).toEqual([1])
    expect(r.diceRoll?.total).toBe(1)
  })

  it('a rolagem não leva cena, posição nem id de jogador', () => {
    const t = mesa([3])
    const r = t.s.handleMessage('c2', { type: 'dice.roll', count: 1, sides: 8, modifier: 1 }, t.w)
    expect(r.outbound).toHaveLength(3)
    const fio = JSON.stringify(r.outbound)
    expect(fio).not.toContain('Cripta')
    expect(fio).not.toContain('s-cripta')
    expect(fio).not.toContain('machado')
  })

  it('o mestre rola aberto: todo jogador recebe, como "Mestre" e marcado como do mestre', () => {
    const t = mesa([14])
    const r = t.s.masterRoll({ count: 1, sides: 20, modifier: 0 }, false)
    expect(clientes(r)).toEqual(['c1', 'c2', 'c3'])
    const roll = { id: 'id-7', from: 'Mestre', master: true, count: 1, sides: 20, modifier: 0, results: [14], total: 14, at: t.now() }
    for (const o of r.outbound) expect(o.msg).toEqual({ type: 'dice.rolled', roll })
    expect(r.diceRoll).toEqual(roll)
  })

  it('segurança: a rolagem ESCONDIDA do mestre não sai para ninguém, nem depois', () => {
    const t = mesa([19, 2])
    const escondida = t.s.masterRoll({ count: 1, sides: 20, modifier: 0 }, true)
    expect(escondida.outbound).toEqual([])
    // Só a tela do mestre a mostra, marcada como escondida.
    expect(escondida.diceRoll).toEqual({ id: 'id-7', from: 'Mestre', master: true, hidden: true, count: 1, sides: 20, modifier: 0, results: [19], total: 19, at: t.now() })

    // Nada do que sai depois (a rolagem aberta seguinte, quem entra, o snapshot) carrega a escondida.
    const aberta = t.s.masterRoll({ count: 1, sides: 4, modifier: 0 }, false)
    const entrou = t.s.handleMessage('c4', { type: 'join', code: CODE, name: 'Dani' }, t.w)
    const snapshot = t.s.broadcast(t.w)
    const tudo = JSON.stringify([aberta.outbound, entrou.outbound, snapshot.outbound])
    expect(tudo).not.toContain('id-7')
    expect(tudo).not.toContain('"sides":20')
    expect(aberta.outbound).toHaveLength(3)
  })

  it('quem não entrou na sala não rola', () => {
    const t = mesa([6])
    const r = t.s.handleMessage('c9', { type: 'dice.roll', count: 1, sides: 6, modifier: 0 }, t.w)
    expect(r.outbound).toEqual([{ clientId: 'c9', msg: { type: 'error', reason: 'not_joined' } }])
    expect(r.diceRoll).toBeUndefined()
  })

  it('quem caiu da sala não recebe; quem volta recebe as próximas', () => {
    const t = mesa([2, 3])
    t.s.disconnect('c2')
    const r = t.s.handleMessage('c1', { type: 'dice.roll', count: 1, sides: 6, modifier: 0 }, t.w)
    expect(clientes(r)).toEqual(['c1', 'c3'])
  })

  it('dado em laço: a segunda rolagem dentro do intervalo morre em silêncio; depois dele, vale', () => {
    const t = mesa([1, 2, 3])
    const primeira = t.s.handleMessage('c1', { type: 'dice.roll', count: 1, sides: 6, modifier: 0 }, t.w)
    expect(primeira.outbound).toHaveLength(3)
    t.advance(DICE_ROLL_MIN_INTERVAL_MS - 1)
    const cedo = t.s.handleMessage('c1', { type: 'dice.roll', count: 1, sides: 6, modifier: 0 }, t.w)
    expect(cedo).toEqual({ outbound: [] })
    // O limite é por jogador: Bruno rola na mesma janela.
    expect(t.s.handleMessage('c2', { type: 'dice.roll', count: 1, sides: 6, modifier: 0 }, t.w).outbound).toHaveLength(3)
    t.advance(1)
    const depois = t.s.handleMessage('c1', { type: 'dice.roll', count: 1, sides: 6, modifier: 0 }, t.w)
    expect(depois.diceRoll?.results).toEqual([3])
  })
})
