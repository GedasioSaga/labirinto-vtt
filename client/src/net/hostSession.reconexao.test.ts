/**
 * RECONEXÃO AUTOMÁTICA, lado do host: a sessão guarda QUANDO cada jogador
 * caiu (para o "fora há 0:10" do Grupo) e esquece ao ele voltar pelo resume.
 * Esse relógio é do MESTRE: nada dele vai pela rede, e quem volta recebe só
 * a própria cena, como sempre — nem nome nem posição de quem está em outra
 * cena, nem quem caiu.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

const SALAO: HostScene = { sceneId: 's-salao', name: 'Salao Norte', map: mapa('m-salao', 'Salao Norte', [ficha('lanterna', 100, 100)]) }
const CRIPTA: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 777, 333)]) }
const mundo: HostWorld = { open: SALAO, background: [CRIPTA] }

function mesa() {
  let relogio = 1_000
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => relogio, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, name: string, resume?: string) => {
    const r = s.handleMessage(clientId, resume === undefined ? { type: 'join', code: CODE, name } : { type: 'join', code: CODE, name, resume }, mundo)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return { playerId: welcome.playerId, resumeToken: welcome.resumeToken, result: r }
  }
  const gina = entra('c1', 'Gina')
  const bruno = entra('c2', 'Bruno')
  s.assignToken(gina.playerId, 'lanterna')
  s.assignToken(bruno.playerId, 'machado')
  return {
    s,
    gina,
    bruno,
    entra,
    avanca: (ms: number) => {
      relogio += ms
    },
    agora: () => relogio,
  }
}

describe('hostSession: quando cada jogador caiu', () => {
  it('disconnect marca o momento da queda; quem está conectado não tem marca', () => {
    const m = mesa()
    m.avanca(5_000)
    m.s.disconnect('c1')
    const [gina, bruno] = m.s.listPlayers(mundo)
    expect(gina).toMatchObject({ name: 'Gina', connected: false, disconnectedAt: m.agora() })
    expect(bruno?.connected).toBe(true)
    expect(bruno?.disconnectedAt).toBeUndefined()
  })

  it('voltar pelo resume apaga a marca', () => {
    const m = mesa()
    m.s.disconnect('c1')
    m.avanca(10_000)
    m.entra('c9', 'Gina', m.gina.resumeToken)
    const gina = m.s.listPlayers(mundo).find((p) => p.playerId === m.gina.playerId)
    expect(gina).toMatchObject({ connected: true, clientId: 'c9' })
    expect(gina?.disconnectedAt).toBeUndefined()
  })

  it('quem volta recebe a PRÓPRIA cena e nada de quem caiu nem de quem está em outra cena', () => {
    const m = mesa()
    // Bruno (na Cripta) cai; Gina (no Salão) também, e volta.
    m.s.disconnect('c2')
    m.s.disconnect('c1')
    m.avanca(10_000)
    const volta = m.entra('c9', 'Gina', m.gina.resumeToken)
    const texto = JSON.stringify(volta.result.outbound)
    expect(volta.result.outbound.every((o) => o.clientId === 'c9')).toBe(true)
    expect(texto).toContain('lanterna')
    // Nada da Cripta: nem o nome da cena, nem a ficha do Bruno, nem a posição dela.
    expect(texto).not.toContain('Cripta')
    expect(texto).not.toContain('machado')
    const snapshot = volta.result.outbound.find((o) => o.msg.type === 'snapshot')?.msg
    if (snapshot?.type !== 'snapshot') throw new Error('quem volta jogando recebe o snapshot')
    expect(snapshot.map.tokens.map((t) => t.id)).toEqual(['lanterna'])
    expect(snapshot.map.tokens.some((t) => t.x === 777 && t.y === 333)).toBe(false)
    // O relógio de queda é só do mestre.
    expect(texto).not.toContain('disconnectedAt')
    expect(texto).not.toContain('Bruno')
  })

  it('o broadcast depois da queda não conta a ninguém quem caiu', () => {
    const m = mesa()
    m.s.disconnect('c2')
    const texto = JSON.stringify(m.s.broadcast(mundo).outbound)
    expect(texto).not.toContain('disconnectedAt')
    expect(texto).not.toContain('Bruno')
  })
})
