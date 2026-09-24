/**
 * ALARME PARA VÁRIAS CENAS (achado da simulação da torre): o mestre soa um
 * aviso urgente para várias cenas de uma vez. Só quem está AGORA numa delas
 * recebe (`sceneFor`: a cena da ficha dele, não a aberta no editor), o aviso
 * fica até o mestre encerrar, e quem está em outra cena não recebe nem o frame
 * — nem o de encerrar.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const TABLE_KEY = 'chave-da-tv'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

function cena(sceneId: string, name: string, tokens: Token[]): HostScene {
  return { sceneId, name, map: mapa(`m-${sceneId}`, name, tokens) }
}

/** Salão (aberto) com Ana, Cripta com Bruno, Porão com Caio. */
function mundoInicial(): HostWorld {
  return {
    open: cena('s-salao', 'Salao Norte', [ficha('lanterna', 100, 100)]),
    background: [cena('s-cripta', 'Cripta Rubra', [ficha('machado', 200, 100)]), cena('s-porao', 'Porao Umido', [ficha('corda', 300, 100)])],
  }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, mundo: HostWorld, resume?: string): { playerId: string; resumeToken: string; result: HostResult } {
  const msg = resume === undefined ? { type: 'join', code: CODE, name } : { type: 'join', code: CODE, name, resume }
  const result = s.handleMessage(clientId, msg, mundo)
  const welcome = result.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return { playerId: welcome.playerId, resumeToken: welcome.resumeToken, result }
}

function mesa() {
  let n = 0
  const mundo = mundoInicial()
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}`, tableKey: TABLE_KEY })
  const ana = entra(s, 'c1', 'Ana', mundo)
  const bruno = entra(s, 'c2', 'Bruno', mundo)
  const caio = entra(s, 'c3', 'Caio', mundo)
  s.assignToken(ana.playerId, 'lanterna')
  s.assignToken(bruno.playerId, 'machado')
  s.assignToken(caio.playerId, 'corda')
  return { s, mundo, ana }
}

function para(r: HostResult, clientId: string) {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function alarmesEm(r: HostResult) {
  return r.outbound.filter((o) => o.msg.type === 'scene.alarm' || o.msg.type === 'scene.alarm.end')
}

describe('sceneAlarm (alarme para várias cenas)', () => {
  it('vai a quem está em QUALQUER das cenas escolhidas, com o mesmo id, e a mais ninguém', () => {
    const { s, mundo } = mesa()
    const r = s.sceneAlarm(['s-salao', 's-cripta'], 'O sino da torre tocou!', mundo)
    expect(r.outbound.map((o) => o.clientId).sort()).toEqual(['c1', 'c2'])
    const ids = new Set(r.outbound.map((o) => (o.msg.type === 'scene.alarm' ? o.msg.id : '')))
    expect(ids.size).toBe(1)
    expect(para(r, 'c1')).toEqual([{ type: 'scene.alarm', id: expect.any(String), text: 'O sino da torre tocou!' }])
    // Caio, no Porão, não recebe nada: nem o texto, nem que existe um alarme.
    expect(para(r, 'c3')).toEqual([])
    expect(s.activeAlarm()).toEqual({ id: expect.any(String), text: 'O sino da torre tocou!', sceneIds: ['s-salao', 's-cripta'] })
  })

  it('nunca leva id nem nome de cena ao jogador', () => {
    const { s, mundo } = mesa()
    const texto = JSON.stringify(s.sceneAlarm(['s-salao', 's-cripta'], 'Fogo!', mundo).outbound)
    expect(texto).toContain('scene.alarm')
    for (const segredo of ['s-salao', 's-cripta', 's-porao', 'Salao Norte', 'Cripta Rubra', 'Porao Umido', 'sceneIds']) {
      expect(texto).not.toContain(segredo)
    }
  })

  it('fica: o broadcast seguinte não repete nem vaza, e só o encerrar tira — de quem tinha', () => {
    const { s, mundo } = mesa()
    const soou = s.sceneAlarm(['s-salao', 's-cripta'], 'Catástrofe no andar!', mundo)
    const primeira = soou.outbound[0]?.msg
    const id = primeira?.type === 'scene.alarm' ? primeira.id : ''
    expect(id.length).toBeGreaterThan(0)

    const depois = s.broadcast(mundo)
    expect(alarmesEm(depois)).toEqual([])
    expect(JSON.stringify(para(depois, 'c3'))).not.toContain('Catástrofe')

    const fim = s.endAlarm(mundo)
    expect(fim.outbound.map((o) => o.clientId).sort()).toEqual(['c1', 'c2'])
    expect(para(fim, 'c1')).toEqual([{ type: 'scene.alarm.end', id }])
    expect(para(fim, 'c3')).toEqual([])
    expect(s.activeAlarm()).toBeNull()
    // Encerrar de novo não manda nada.
    expect(s.endAlarm(mundo)).toEqual({ outbound: [] })
  })

  it('quem reconecta numa cena com alarme recebe o alarme de novo, depois do mapa', () => {
    const { s, mundo, ana } = mesa()
    s.sceneAlarm(['s-salao'], 'Desabamento!', mundo)
    s.disconnect('c1')
    const volta = entra(s, 'c9', 'Ana', mundo, ana.resumeToken).result
    const tipos = para(volta, 'c9').map((m) => m.type)
    expect(tipos).toEqual(['welcome', 'snapshot', 'scene.alarm'])
    expect(para(volta, 'c9')[2]).toEqual({ type: 'scene.alarm', id: expect.any(String), text: 'Desabamento!' })
  })

  it('quem entra numa cena com alarme passa a ver; quem sai dela recebe o encerrar', () => {
    const { s, mundo } = mesa()
    s.sceneAlarm(['s-salao'], 'Inundação!', mundo)
    // Caio subiu do Porão para o Salão; Ana desceu para o Porão.
    const [cripta, porao] = mundo.background
    if (cripta === undefined || porao === undefined) throw new Error('mundo sem cenas de fundo')
    const trocado: HostWorld = {
      open: { ...mundo.open, map: { ...mundo.open.map, tokens: [ficha('corda', 100, 100)] } },
      background: [cripta, { ...porao, map: { ...porao.map, tokens: [ficha('lanterna', 300, 100)] } }],
    }
    const r = s.broadcast(trocado)
    expect(alarmesEm(r).map((o) => [o.clientId, o.msg.type]).sort()).toEqual([
      ['c1', 'scene.alarm.end'],
      ['c3', 'scene.alarm'],
    ])
    expect(para(r, 'c2').filter((m) => m.type.startsWith('scene.alarm'))).toEqual([])
  })

  it('alarme novo substitui o aberto: quem ficou fora recebe o encerrar do antigo', () => {
    const { s, mundo } = mesa()
    s.sceneAlarm(['s-salao', 's-cripta'], 'Primeiro', mundo)
    const r = s.sceneAlarm(['s-porao'], 'Segundo', mundo)
    expect(alarmesEm(r).map((o) => [o.clientId, o.msg.type]).sort()).toEqual([
      ['c1', 'scene.alarm.end'],
      ['c2', 'scene.alarm.end'],
      ['c3', 'scene.alarm'],
    ])
    expect(JSON.stringify(para(r, 'c1'))).not.toContain('Segundo')
  })

  it('texto vazio, nenhuma cena, cena que não existe: não soa nada e não muda o alarme aberto', () => {
    const { s, mundo } = mesa()
    expect(s.sceneAlarm(['s-salao'], '   ', mundo)).toEqual({ outbound: [] })
    expect(s.sceneAlarm([], 'Fogo!', mundo)).toEqual({ outbound: [] })
    expect(s.sceneAlarm(['s-nao-existe'], 'Fogo!', mundo)).toEqual({ outbound: [] })
    expect(s.activeAlarm()).toBeNull()

    s.sceneAlarm(['s-cripta'], 'Aberto', mundo)
    expect(s.sceneAlarm(['s-nao-existe'], 'Outro', mundo)).toEqual({ outbound: [] })
    expect(s.activeAlarm()?.text).toBe('Aberto')
  })

  it('quem aguarda sem ficha e a tela da mesa não recebem', () => {
    const { s, mundo } = mesa()
    entra(s, 'c4', 'Dora', mundo)
    s.handleMessage('tv1', { type: 'join', code: CODE, name: 'Mesa', role: 'table', tableKey: TABLE_KEY }, mundo)
    const r = s.sceneAlarm(['s-salao', 's-cripta', 's-porao'], 'Todos!', mundo)
    expect(r.outbound.map((o) => o.clientId).sort()).toEqual(['c1', 'c2', 'c3'])
    expect(JSON.stringify(s.broadcast(mundo).outbound.filter((o) => o.clientId === 'c4' || o.clientId === 'tv1'))).not.toContain('Todos!')
  })
})
