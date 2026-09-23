/**
 * RECADO POR CENA (G11): o mestre escreve para quem está numa cena, e só essa
 * gente recebe. A cena de cada jogador é a da ficha DELE (`sceneFor`), não a
 * aberta no editor. Quem está em outra cena não recebe nem o frame.
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

const SALAO: HostScene = { sceneId: 's-salao', name: 'Salao Norte', map: mapa('m-salao', 'Salao Norte', [ficha('lanterna', 100, 100)]) }
const CRIPTA: HostScene = { sceneId: 's-cripta', name: 'Cripta Rubra', map: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 200, 100)]) }

/** Salão (aberto no editor) com a ficha de Ana; Cripta (de fundo) com a de Bruno. */
const mundo: HostWorld = { open: SALAO, background: [CRIPTA] }

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string): string {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name }, mundo)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mesa() {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const ana = entra(s, 'c1', 'Ana')
  const bruno = entra(s, 'c2', 'Bruno')
  s.assignToken(ana, 'lanterna')
  s.assignToken(bruno, 'machado')
  return s
}

function para(r: HostResult, clientId: string): string {
  return JSON.stringify(r.outbound.filter((o) => o.clientId === clientId))
}

describe('sceneNote (recado por cena)', () => {
  it('vai só a quem está na cena do recado, e não a quem está em outra', () => {
    const s = mesa()
    const r = s.sceneNote('s-salao', 'A porta range ao longe.', mundo)
    // `at`: a hora do mestre (o relógio da mesa de teste marca 0), para o caderno do jogador.
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'scene.note', id: expect.any(String), text: 'A porta range ao longe.', at: 0 } }])
    expect(para(r, 'c2')).not.toContain('A porta range')

    // Cena de FUNDO (não aberta no editor) também chega, e só a quem está lá.
    const cripta = s.sceneNote('s-cripta', 'Algo se mexe.', mundo)
    expect(cripta.outbound.map((o) => o.clientId)).toEqual(['c2'])
  })

  it('nunca leva id nem nome de cena ao jogador', () => {
    const s = mesa()
    const texto = para(s.sceneNote('s-salao', 'oi', mundo), 'c1')
    expect(texto).toContain('scene.note')
    expect(texto).not.toContain('s-salao')
    expect(texto).not.toContain('Salao Norte')
    expect(texto).not.toContain('sceneId')
  })

  it('corta o texto no teto, sem meia letra no fim', () => {
    const s = mesa()
    const msg = s.sceneNote('s-salao', 'x'.repeat(NOTE_MAX_LENGTH + 50), mundo).outbound[0]?.msg
    expect(msg?.type === 'scene.note' ? msg.text.length : -1).toBe(NOTE_MAX_LENGTH)

    // Um emoji (2 unidades UTF-16) atravessando o teto fica inteiro de fora, não partido.
    const partido = `${'y'.repeat(NOTE_MAX_LENGTH - 1)}\u{1F600}`
    const msg2 = s.sceneNote('s-salao', partido, mundo).outbound[0]?.msg
    expect(msg2?.type === 'scene.note' ? msg2.text : null).toBe('y'.repeat(NOTE_MAX_LENGTH - 1))
  })

  it('ninguém na cena, cena que não existe, texto vazio: não sai nada', () => {
    const s = mesa()
    const comVazia: HostWorld = { open: SALAO, background: [CRIPTA, { sceneId: 's-vazia', name: 'Vazia', map: mapa('m-vazia', 'Vazia', []) }] }
    expect(s.sceneNote('s-vazia', 'oi', comVazia)).toEqual({ outbound: [] })
    expect(s.sceneNote('s-nao-existe', 'oi', mundo)).toEqual({ outbound: [] })
    expect(s.sceneNote('s-salao', '   ', mundo)).toEqual({ outbound: [] })
  })

  it('quem aguarda (sem ficha) e quem caiu não recebem na hora; quem entra sem ficha nem depois', () => {
    const s = mesa()
    entra(s, 'c3', 'Caio')
    s.disconnect('c1')
    expect(s.sceneNote('s-salao', 'antes da volta', mundo)).toEqual({ outbound: [] })
    // Guardado para quem VOLTA à cena (hostSession.caderno.test.ts), mas quem
    // entra sem ficha não está no Salão, e o broadcast não acorda quem caiu.
    const entrada = s.handleMessage('c4', { type: 'join', code: CODE, name: 'Dora' }, mundo)
    expect(JSON.stringify(entrada.outbound)).not.toContain('antes da volta')
    expect(JSON.stringify(s.broadcast(mundo).outbound)).not.toContain('antes da volta')
  })

  it('dois jogadores na mesma cena recebem o MESMO id', () => {
    const s = mesa()
    // Bruno passou para o Salão: a ficha dele saiu da Cripta.
    const junto: HostWorld = {
      open: { ...SALAO, map: { ...SALAO.map, tokens: [ficha('lanterna', 100, 100), ficha('machado', 150, 100)] } },
      background: [{ ...CRIPTA, map: { ...CRIPTA.map, tokens: [] } }],
    }
    const r = s.sceneNote('s-salao', 'juntos', junto)
    expect(r.outbound.map((o) => o.clientId).sort()).toEqual(['c1', 'c2'])
    const ids = new Set(r.outbound.map((o) => (o.msg.type === 'scene.note' ? o.msg.id : '')))
    expect(ids.size).toBe(1)
  })
})
