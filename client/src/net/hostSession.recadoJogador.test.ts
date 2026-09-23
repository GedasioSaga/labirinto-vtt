/**
 * RECADO PARA UM JOGADOR SÓ (linha dele no Grupo): o recado por cena vai a
 * todos da sala e a pista de um vaza. Aqui o mestre escolhe UM jogador: só a
 * conexão dele recebe, marcado "só para você"; quem está na mesma sala não
 * recebe nem o frame. Quem está fora (caiu, ou sem ficha) recebe ao voltar.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { NOTE_MAX_LENGTH } from './protocol'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

/** Gabi e Elisa lado a lado na Biblioteca (aberta); Hugo sozinho no Porão (de fundo). */
const BIBLIOTECA: HostScene = { sceneId: 's-biblioteca', name: 'Biblioteca Velha', map: mapa('m-bib', 'Biblioteca Velha', [ficha('gabi', 100, 100), ficha('elisa', 150, 100)]) }
const PORAO: HostScene = { sceneId: 's-porao', name: 'Porão Úmido', map: mapa('m-porao', 'Porão Úmido', [ficha('hugo', 200, 100)]) }
const mundo: HostWorld = { open: BIBLIOTECA, background: [PORAO] }

const PISTA = 'A carta no bolso do mordomo tem o seu nome.'

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, resume?: string): { playerId: string; resumeToken: string; r: HostResult } {
  const r = s.handleMessage(clientId, resume === undefined ? { type: 'join', code: CODE, name } : { type: 'join', code: CODE, name, resume }, mundo)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return { playerId: welcome.playerId, resumeToken: welcome.resumeToken, r }
}

function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const gabi = entra(s, 'c-gabi', 'Gabi')
  const elisa = entra(s, 'c-elisa', 'Elisa')
  const hugo = entra(s, 'c-hugo', 'Hugo')
  s.assignToken(gabi.playerId, 'gabi')
  s.assignToken(elisa.playerId, 'elisa')
  s.assignToken(hugo.playerId, 'hugo')
  return { s, gabi, elisa, hugo }
}

function para(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

describe('playerNote (recado para um jogador só)', () => {
  it('vai só para a conexão da Gabi, marcado "só para você"; Elisa, na MESMA sala, não recebe o texto', () => {
    const { s, gabi } = mesa()
    const r = s.playerNote(gabi.playerId, PISTA, mundo)
    expect(r.delivery).toBe('sent')
    expect(r.outbound).toEqual([{ clientId: 'c-gabi', msg: { type: 'scene.note', id: expect.any(String), text: PISTA, onlyYou: true } }])
    expect(para(r, 'c-elisa')).not.toContain('mordomo')
    expect(para(r, 'c-hugo')).not.toContain('mordomo')
    // O snapshot seguinte da Elisa também não carrega o texto.
    expect(para(s.broadcast(mundo), 'c-elisa')).not.toContain('mordomo')
  })

  it('não leva id nem nome de cena, nem o id do jogador', () => {
    const { s, gabi } = mesa()
    const texto = para(s.playerNote(gabi.playerId, PISTA, mundo), 'c-gabi')
    expect(texto).not.toContain('s-biblioteca')
    expect(texto).not.toContain('Biblioteca Velha')
    expect(texto).not.toContain(gabi.playerId)
  })

  it('corta no teto sem meia letra; vazio, só espaço ou jogador desconhecido: nada sai', () => {
    const { s, gabi } = mesa()
    const longo = s.playerNote(gabi.playerId, `${'y'.repeat(NOTE_MAX_LENGTH - 1)}\u{1F600}`, mundo).outbound[0]?.msg
    expect(longo?.type === 'scene.note' ? longo.text : null).toBe('y'.repeat(NOTE_MAX_LENGTH - 1))
    expect(s.playerNote(gabi.playerId, '   ', mundo)).toEqual({ outbound: [], delivery: null })
    expect(s.playerNote('ninguem', PISTA, mundo)).toEqual({ outbound: [], delivery: null })
  })

  it('Gabi caiu: fica guardado e ela recebe ao voltar, depois do mapa; ninguém mais recebe, e não repete', () => {
    const { s, gabi } = mesa()
    s.disconnect('c-gabi')
    const r = s.playerNote(gabi.playerId, PISTA, mundo)
    expect(r).toEqual({ outbound: [], delivery: 'queued' })
    // Enquanto ela está fora, o broadcast da sala não leva o recado a ninguém.
    expect(JSON.stringify(s.broadcast(mundo).outbound)).not.toContain('mordomo')
    // Outro jogador que entra agora não recebe.
    expect(JSON.stringify(entra(s, 'c-ivo', 'Ivo').r.outbound)).not.toContain('mordomo')

    const volta = entra(s, 'c-gabi-2', 'Gabi', gabi.resumeToken).r
    expect(volta.outbound.map((o) => [o.clientId, o.msg.type])).toEqual([
      ['c-gabi-2', 'welcome'],
      ['c-gabi-2', 'snapshot'],
      ['c-gabi-2', 'scene.note'],
    ])
    expect(volta.outbound[2]?.msg).toEqual({ type: 'scene.note', id: expect.any(String), text: PISTA, onlyYou: true })
    // Entregue uma vez só: o broadcast seguinte não repete.
    expect(JSON.stringify(s.broadcast(mundo).outbound)).not.toContain('mordomo')
  })

  it('dois recados com ela fora: ao voltar, recebe o último', () => {
    const { s, gabi } = mesa()
    s.disconnect('c-gabi')
    s.playerNote(gabi.playerId, 'primeiro', mundo)
    s.playerNote(gabi.playerId, 'segundo', mundo)
    const volta = entra(s, 'c-gabi-2', 'Gabi', gabi.resumeToken).r
    const recados = volta.outbound.filter((o) => o.msg.type === 'scene.note')
    expect(recados.map((o) => (o.msg.type === 'scene.note' ? o.msg.text : ''))).toEqual(['segundo'])
  })

  it('sem ficha (aguardando): fica guardado e chega quando ela ganha ficha e o mapa aparece', () => {
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const gabi = entra(s, 'c-gabi', 'Gabi')
    const r = s.playerNote(gabi.playerId, PISTA, mundo)
    expect(r).toEqual({ outbound: [], delivery: 'queued' })
    s.assignToken(gabi.playerId, 'gabi')
    const depois = s.broadcast(mundo)
    expect(depois.outbound.map((o) => o.msg.type)).toEqual(['snapshot', 'scene.note'])
    expect(JSON.stringify(s.broadcast(mundo).outbound)).not.toContain('mordomo')
  })

  it('jogador expulso: recado guardado e recado novo não têm mais destino', () => {
    let n = 0
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
    const gabi = entra(s, 'c-gabi', 'Gabi')
    s.playerNote(gabi.playerId, PISTA, mundo)
    s.kick('c-gabi')
    // O id morreu com o kick: recado novo para ele não tem destino.
    expect(s.playerNote(gabi.playerId, PISTA, mundo).delivery).toBeNull()
  })
})
