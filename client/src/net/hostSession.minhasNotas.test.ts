/**
 * MINHAS NOTAS no host: a lista de anotações pessoais de cada jogador, de
 * todos os mapas, fica guardada por jogador e volta SÓ a ele — ao recarregar
 * (resume), na volta de uma queda e na sessão seguinte (pelo nome, como a mesa
 * guardada). Entrada hostil (lista torta, acima do teto, rápida demais) não
 * muda nada; nenhum colega recebe nota alheia.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { MY_NOTES_MAX, MY_NOTES_MIN_INTERVAL_MS, type PersonalNote } from '../lib/minhasNotas'
import type { SavedSeatNotes } from '../lib/savedTable'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'AB12CD'

function ficha(id: string, x: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y: 100, size: 1, image: null }
}

function mapa(id: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, 'Taverna', 20, 10, 50), tokens }
}

const mundo: HostWorld = { open: { sceneId: 's-taverna', name: 'Taverna', map: mapa('m-taverna', [ficha('lirio', 100), ficha('machado', 300)]) }, background: [] }

const BAU: PersonalNote = { id: 'n1', mapId: 'm-taverna', x: 120, y: 140, text: 'baú trancado' }
const RATO: PersonalNote = { id: 'n2', mapId: 'm-porao', x: 10, y: 20, text: 'rato morto' }

function mesa(options: { restoreMyNotes?: readonly SavedSeatNotes[] } = {}) {
  const relogio = { t: 10_000 }
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => relogio.t, randomId: () => `id-${(n += 1)}`, ...options })
  const entra = (clientId: string, name: string, resume?: string) => {
    const r = s.handleMessage(clientId, resume === undefined ? { type: 'join', code: CODE, name } : { type: 'join', code: CODE, name, resume }, mundo)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    return { playerId: welcome.playerId, resumeToken: welcome.resumeToken, result: r }
  }
  const ana = entra('c1', 'Ana')
  const bruno = entra('c2', 'Bruno')
  s.assignToken(ana.playerId, 'lirio')
  s.assignToken(bruno.playerId, 'machado')
  s.broadcast(mundo)
  const anota = (clientId: string, notes: unknown): HostResult => s.handleMessage(clientId, { type: 'mynotes.set', notes }, mundo)
  return { s, relogio, ana, bruno, entra, anota }
}

/** As listas de notas que saíram para `clientId`. */
function livros(r: HostResult, clientId: string): unknown[] {
  return r.outbound.filter((o) => o.clientId === clientId && o.msg.type === 'mynotes.book').map((o) => o.msg)
}

describe('hostSession: Minhas notas', () => {
  it('Ana manda a lista: o host guarda, nada sai a ninguém, e o integrador sabe que tem o que gravar', () => {
    const m = mesa()
    const r = m.anota('c1', [BAU, RATO])
    expect(r.outbound).toEqual([])
    expect(r.myNotesChanged).toBe(true)
    expect(m.s.savedMyNotes()).toEqual([{ name: 'Ana', notes: [BAU, RATO] }])
  })

  it('a volta (resume, recarregar a página) traz a lista inteira, de todos os mapas, só para ela', () => {
    const m = mesa()
    m.anota('c1', [BAU, RATO])
    m.s.disconnect('c1')
    const volta = m.entra('c7', 'Ana', m.ana.resumeToken)
    expect(livros(volta.result, 'c7')).toEqual([{ type: 'mynotes.book', notes: [BAU, RATO] }])
    // Nenhuma outra conexão recebe a lista dela.
    expect(volta.result.outbound.filter((o) => o.clientId !== 'c7' && JSON.stringify(o.msg).includes('baú trancado'))).toEqual([])
  })

  it('quem nunca anotou não recebe lista nenhuma na entrada (como o caderno de pistas)', () => {
    const m = mesa()
    const carla = m.entra('c3', 'Carla')
    expect(livros(carla.result, 'c3')).toEqual([])
  })

  it('uma lista por intervalo: a de dentro dele volta "too_soon" e não muda nada', () => {
    const m = mesa()
    m.anota('c1', [BAU])
    m.relogio.t += MY_NOTES_MIN_INTERVAL_MS - 1
    const cedo = m.anota('c1', [BAU, RATO])
    expect(cedo.outbound).toEqual([{ clientId: 'c1', msg: { type: 'mynotes.rejected', reason: 'too_soon' } }])
    expect(cedo.myNotesChanged).toBeUndefined()
    expect(m.s.savedMyNotes()).toEqual([{ name: 'Ana', notes: [BAU] }])
    m.relogio.t += 1
    expect(m.anota('c1', [BAU, RATO]).myNotesChanged).toBe(true)
  })

  it('lista hostil: não-lista, nota torta, id repetido, texto longo, ponto infinito ou acima do teto — mensagem inválida, nada guardado', () => {
    const m = mesa()
    const tortas: unknown[] = [
      'nada',
      [{ ...BAU, x: 'dez' }],
      [BAU, { ...BAU, text: 'repetida' }],
      [{ ...BAU, text: 'z'.repeat(41) }],
      [{ ...BAU, y: Number.POSITIVE_INFINITY }],
      [{ ...BAU, mapId: '' }],
      Array.from({ length: MY_NOTES_MAX + 1 }, (_, i) => ({ ...BAU, id: `n${i}` })),
    ]
    for (const notes of tortas) {
      m.relogio.t += MY_NOTES_MIN_INTERVAL_MS
      const r = m.anota('c1', notes)
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'error', reason: 'invalid_message' } }])
      expect(r.myNotesChanged).toBeUndefined()
    }
    expect(m.s.savedMyNotes()).toEqual([])
  })

  it('quem não entrou não guarda nada', () => {
    const m = mesa()
    const r = m.anota('c-estranho', [BAU])
    expect(r.outbound).toEqual([{ clientId: 'c-estranho', msg: { type: 'error', reason: 'not_joined' } }])
    expect(m.s.savedMyNotes()).toEqual([])
  })

  it('sessão nova: quem entra com o nome guardado recebe as notas de volta (com ou sem assento); nome novo, nada', () => {
    const m = mesa({ restoreMyNotes: [{ name: 'Carla', notes: [BAU, RATO] }] })
    const carla = m.entra('c3', 'carla')
    expect(livros(carla.result, 'c3')).toEqual([{ type: 'mynotes.book', notes: [BAU, RATO] }])
    const diego = m.entra('c4', 'Diego')
    expect(livros(diego.result, 'c4')).toEqual([])
  })

  it('o arquivo da mesa leva as notas de quem está na sala e as guardadas de quem ainda não voltou', () => {
    const m = mesa({ restoreMyNotes: [{ name: 'Eva', notes: [RATO] }] })
    m.anota('c1', [BAU])
    expect(m.s.savedMyNotes()).toEqual([
      { name: 'Ana', notes: [BAU] },
      { name: 'Eva', notes: [RATO] },
    ])
  })

  it('dispensada (saiu da lista), as notas ficam guardadas pelo nome: voltando com ele, ela as reencontra; o Bruno nunca', () => {
    const m = mesa()
    m.anota('c1', [BAU])
    m.s.disconnect('c1')
    expect(m.s.dismissPlayer(m.ana.playerId)).toBe(true)
    expect(m.s.savedMyNotes()).toEqual([{ name: 'Ana', notes: [BAU] }])
    const volta = m.entra('c8', 'Ana')
    expect(livros(volta.result, 'c8')).toEqual([{ type: 'mynotes.book', notes: [BAU] }])
    expect(JSON.stringify(volta.result.outbound.filter((o) => o.clientId === 'c2'))).not.toContain('baú trancado')
  })

  it('"É ela": a Ana fica com as notas dela e as que escreveu como "ana (2)", e o aparelho recebe a lista junta', () => {
    const m = mesa()
    m.anota('c1', [BAU])
    m.s.disconnect('c1')
    const nova = m.entra('c9', 'ana')
    m.anota('c9', [RATO])
    const r = m.s.confirmReturn(nova.playerId, m.ana.playerId, mundo)
    expect(livros(r, 'c9')).toEqual([{ type: 'mynotes.book', notes: [BAU, RATO] }])
    expect(m.s.savedMyNotes()).toEqual([{ name: 'Ana', notes: [BAU, RATO] }])
  })
})
