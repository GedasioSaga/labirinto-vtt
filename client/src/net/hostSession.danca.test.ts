/**
 * MINIGAME DE DANÇA na sessão do mestre. O mestre chama Ana e Bruno (Caio
 * fica de fora); só eles recebem o convite. Cada um marca Pronto, todos
 * começam juntos, os toques de um vão aos outros (nunca de volta), e quando o
 * último termina sai o desfecho: todos passaram = a porta ligada destranca e
 * abre e o prêmio vai a cada um; alguém falhou = porta fechada e a
 * consequência só para quem não passou.
 */
import { describe, expect, it } from 'vitest'
import { buildPin, createEmptyMap } from '../lib/mapFactory'
import { minigamePadrao } from '../lib/pins'
import type { MinigameDoPino } from '../minigames/danca/tipos'
import type { MapData, Pin, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { DancaPlacarFinal } from './protocoloDaDanca'

const CODE = 'AB12CD'

const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: `ficha-${id}`, x, y: 200, size: 1, image: null })
const PORTA: Wall = { id: 'porta-ziza', x1: 900, y1: 0, x2: 900, y2: 1000, blocksLight: true, blocksMove: true, door: { open: false, locked: true, kind: 'normal' } }

function pino(extra: Partial<MinigameDoPino> = {}, portaLigada: string | undefined = PORTA.id): Pin {
  const base: Pin = { ...buildPin('pino-danca', { x: 300, y: 300 }, 'minigame'), minigame: { ...minigamePadrao(), ...extra } }
  return portaLigada === undefined ? base : { ...base, portaLigada }
}

function mundo(pin: Pin = pino()): HostWorld {
  const map: MapData = { ...createEmptyMap('m-salao', 'Salão', 1000, 1000, 50), walls: [PORTA], pins: [pin, buildPin('pino-nota', { x: 100, y: 100 }, 'exclamacao')], tokens: [ficha('t-ana', 100), ficha('t-bruno', 200), ficha('t-caio', 300)] }
  return { open: { sceneId: 's-salao', name: 'Salão', map }, background: [] }
}

const PASSOU: DancaPlacarFinal = { precisao: 0.9, letra: 'A', falhou: false, perfeito: 50, bom: 8, ok: 2, errou: 1, comboMax: 40, segOk: 0, segTotal: 0 }
const FALHOU: DancaPlacarFinal = { ...PASSOU, precisao: 0.4, letra: 'D', falhou: true }

function mesa(pin?: Pin) {
  let n = 0
  const world = mundo(pin)
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  /** O resume de cada um, como o aparelho guarda do `welcome`. */
  const resumes = new Map<string, string>()
  const entra = (clientId: string, name: string, tokenId: string): string => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, world).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
    resumes.set(welcome.playerId, welcome.resumeToken)
    return welcome.playerId
  }
  const ana = entra('c-ana', 'Ana', 't-ana')
  const bruno = entra('c-bruno', 'Bruno', 't-bruno')
  const caio = entra('c-caio', 'Caio', 't-caio')
  s.broadcast(world)
  const de = (clientId: string, msg: Record<string, unknown>): HostResult => s.handleMessage(clientId, msg, world)
  /** A mesma pessoa volta por outra conexão, pelo resume (aba nova, Wi-Fi que voltou). */
  const volta = (clientId: string, playerId: string, name: string): HostResult => {
    const resume = resumes.get(playerId)
    if (resume === undefined) throw new Error('sem resume')
    return s.handleMessage(clientId, { type: 'join', code: CODE, name, resume }, world)
  }
  return { s, world, ana, bruno, caio, de, volta }
}

const para = (r: HostResult, clientId: string) => r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
const tipos = (r: HostResult, clientId: string) => para(r, clientId).map((m) => m.type)

function sessaoDe(r: { convite: { ok: true; sessao: string } | { ok: false } }): string {
  if (!r.convite.ok) throw new Error('o convite devia ter saído')
  return r.convite.sessao
}

/** Ana e Bruno chamados, os dois prontos, e a música começou. */
function dancando(pin?: Pin) {
  const m = mesa(pin)
  const sessao = sessaoDe(m.s.convidarParaDanca('pino-danca', [m.ana, m.bruno], m.world))
  m.de('c-ana', { type: 'danca.pronto', sessao, dificuldade: 'expert' })
  m.de('c-bruno', { type: 'danca.pronto', sessao, dificuldade: 'diversao' })
  expect(m.s.comecarDanca().comecou).toBe(true)
  return { ...m, sessao }
}

describe('danca: convite', () => {
  it('só os escolhidos recebem o convite, com o desafio e sem a consequência nem a porta', () => {
    const { s, world, ana, bruno, caio } = mesa()
    const r = s.convidarParaDanca('pino-danca', [bruno, ana], world)
    expect(r.convite).toEqual({ ok: true, sessao: expect.any(String), convidados: 2 })
    expect(tipos(r, 'c-ana')).toEqual(['danca.convite'])
    expect(tipos(r, 'c-bruno')).toEqual(['danca.convite'])
    expect(tipos(r, 'c-caio')).toEqual([])
    const convite = para(r, 'c-ana')[0]
    expect(convite).toMatchObject({ type: 'danca.convite', pinId: 'pino-danca', npc: 'Dona Ziza', permitida: 'escolha', notaMin: 'B', premio: { tipo: 'item', texto: 'Chave de latão' }, musica: { tipo: 'demo' } })
    // Na ordem da sala, não na ordem em que o mestre marcou.
    expect(convite?.type === 'danca.convite' ? convite.participantes : []).toEqual([{ playerId: ana, nome: 'Ana' }, { playerId: bruno, nome: 'Bruno' }])
    const texto = JSON.stringify(r.outbound)
    for (const proibido of ['consequencia', 'Agilidade', PORTA.id, caio]) expect(texto).not.toContain(proibido)
    expect(s.danca()).toMatchObject({ fase: 'convite', temPorta: true, participantes: [{ playerId: ana, status: 'convidado', conectado: true }, { playerId: bruno, status: 'convidado' }] })
  })

  it('pino que não é minigame, dança já ativa e ninguém válido: recusado, sem mensagem', () => {
    const { s, world, ana } = mesa()
    expect(s.convidarParaDanca('pino-nota', [ana], world)).toEqual({ outbound: [], convite: { ok: false, motivo: 'pino' } })
    expect(s.convidarParaDanca('nao-existe', [ana], world).convite).toEqual({ ok: false, motivo: 'pino' })
    expect(s.convidarParaDanca('pino-danca', ['inventado'], world)).toEqual({ outbound: [], convite: { ok: false, motivo: 'ninguem' } })
    sessaoDe(s.convidarParaDanca('pino-danca', [ana], world))
    expect(s.convidarParaDanca('pino-danca', [ana], world)).toEqual({ outbound: [], convite: { ok: false, motivo: 'ocupada' } })
  })

  it('música importada: as duas coreografias prontas vão no convite (o jogador nunca recalcula)', () => {
    const coreografias = { diversao: [{ t: 1, lane: 0 as const, len: 0, sub: 4 as const }], expert: [{ t: 1, lane: 3 as const, len: 0.5, sub: 8 as const }] }
    const musica = { tipo: 'arquivo' as const, midia: `midia:${'a'.repeat(64)}.mp3`, nome: 'Mother 3', bpm: 119.75, primeiraBatida: 0.924, fase4: 0, duracaoS: 41.45, coreografias }
    const { s, world, ana } = mesa(pino({ musica }))
    const convite = para(s.convidarParaDanca('pino-danca', [ana], world), 'c-ana')[0]
    expect(convite?.type === 'danca.convite' ? convite.musica : null).toEqual(musica)
  })

  it('o Pronto respeita a dificuldade permitida, e o estado vai a todos os chamados', () => {
    const { s, world, ana, bruno, de } = mesa(pino({ permitida: 'expert' }))
    const sessao = sessaoDe(s.convidarParaDanca('pino-danca', [ana, bruno], world))
    expect(de('c-ana', { type: 'danca.pronto', sessao, dificuldade: 'diversao' }).outbound).toEqual([])
    const r = de('c-ana', { type: 'danca.pronto', sessao, dificuldade: 'expert' })
    const estado = { type: 'danca.estado', sessao, fase: 'convite', participantes: [{ playerId: ana, status: 'pronto' }, { playerId: bruno, status: 'convidado' }] }
    expect(r.outbound).toEqual([{ clientId: 'c-ana', msg: estado }, { clientId: 'c-bruno', msg: estado }])
    expect(s.danca()?.participantes[0]).toMatchObject({ status: 'pronto', dificuldade: 'expert' })
  })

  it('sessão errada, quem não foi chamado e mensagem fora de fase: ignorados', () => {
    const { s, world, ana, de } = mesa()
    const sessao = sessaoDe(s.convidarParaDanca('pino-danca', [ana], world))
    expect(de('c-ana', { type: 'danca.pronto', sessao: 'outra', dificuldade: 'expert' }).outbound).toEqual([])
    expect(de('c-caio', { type: 'danca.pronto', sessao, dificuldade: 'expert' }).outbound).toEqual([])
    // Toque e fim antes do "Começar" não valem.
    expect(de('c-ana', { type: 'danca.fim', sessao, placar: PASSOU }).outbound).toEqual([])
    expect(s.danca()?.participantes[0]?.status).toBe('convidado')
  })

})

describe('danca: começar, toques e pausa', () => {
  it('começar: só os prontos dançam; quem não marcou recebe "fora"', () => {
    const { s, world, ana, bruno, caio, de } = mesa()
    const sessao = sessaoDe(s.convidarParaDanca('pino-danca', [ana, bruno, caio], world))
    expect(s.comecarDanca()).toEqual({ outbound: [], comecou: false })
    de('c-ana', { type: 'danca.pronto', sessao, dificuldade: 'expert' })
    const r = s.comecarDanca()
    expect(r.comecou).toBe(true)
    expect(para(r, 'c-ana')[0]).toEqual({ type: 'danca.comecar', sessao, emMs: 3000, participantes: [{ playerId: ana, nome: 'Ana', dificuldade: 'expert' }] })
    expect(para(r, 'c-bruno')).toEqual([{ type: 'danca.encerra', sessao, motivo: 'fora' }])
    expect(para(r, 'c-caio')).toEqual([{ type: 'danca.encerra', sessao, motivo: 'fora' }])
    expect(s.danca()?.participantes.map((p) => p.status)).toEqual(['dancando', 'fora', 'fora'])
    // O de fora não volta à dança: o Pronto atrasado morre.
    expect(de('c-bruno', { type: 'danca.pronto', sessao, dificuldade: 'expert' }).outbound).toEqual([])
  })

  it('os toques vão aos OUTROS que dançam, nunca ao remetente; o placar fica no painel', () => {
    const { s, ana, sessao, de } = dancando()
    const placar = { precisao: 0.95, combo: 12, vida: 70, julgadas: 13 }
    const eventos = [{ lane: 2, j: 'perfeito', t: 4.25 }]
    const r = de('c-ana', { type: 'danca.toques', sessao, eventos, placar })
    expect(r.outbound).toEqual([{ clientId: 'c-bruno', msg: { type: 'danca.colegas', sessao, playerId: ana, eventos, placar } }])
    expect(s.danca()?.participantes[0]?.placar).toEqual(placar)
    // Quem não dança não manda toque.
    expect(de('c-caio', { type: 'danca.toques', sessao, eventos, placar }).outbound).toEqual([])
  })

  it('pausar e retomar vão a quem dança; fora de fase não fazem nada', () => {
    const { s, sessao } = dancando()
    expect(s.retomarDanca().ok).toBe(false)
    const pausa = s.pausarDanca()
    expect(pausa.outbound.map((o) => [o.clientId, o.msg])).toEqual([['c-ana', { type: 'danca.pausa', sessao }], ['c-bruno', { type: 'danca.pausa', sessao }]])
    expect(s.danca()?.fase).toBe('pausa')
    expect(s.pausarDanca().ok).toBe(false)
    expect(s.retomarDanca().outbound.map((o) => o.msg.type)).toEqual(['danca.retoma', 'danca.retoma'])
  })
})

describe('danca: desfecho', () => {
  it('todos passam: a porta ligada destranca e abre, e o item vai para CADA um', () => {
    const { s, ana, bruno, sessao, de } = dancando()
    const primeiro = de('c-ana', { type: 'danca.fim', sessao, placar: PASSOU })
    expect(primeiro.dancaDesfecho).toBeUndefined()
    const r = de('c-bruno', { type: 'danca.fim', sessao, placar: { ...PASSOU, letra: 'B' } })
    expect(r.dancaDesfecho).toMatchObject({ todosPassaram: true, porta: { wallId: PORTA.id }, premio: { tipo: 'item', texto: 'Chave de latão' } })
    expect(r.dancaDesfecho?.itens.map((item) => [item.playerId, item.texto])).toEqual([[ana, 'Chave de latão'], [bruno, 'Chave de latão']])
    const desfecho = para(r, 'c-ana').find((m) => m.type === 'danca.desfecho')
    expect(desfecho).toEqual({
      type: 'danca.desfecho',
      sessao,
      todosPassaram: true,
      portaAberta: true,
      mesa: [{ playerId: ana, nome: 'Ana', letra: 'A', precisao: 0.9 }, { playerId: bruno, nome: 'Bruno', letra: 'B', precisao: 0.9 }],
      seu: { passou: true, premio: { tipo: 'item', texto: 'Chave de latão' } },
    })
    expect(tipos(r, 'c-caio')).toEqual([])
    expect(s.danca()).toMatchObject({ fase: 'fim', desfecho: { todosPassaram: true, portaAberta: true } })
    // Depois do desfecho, nada mais vale para esta sessão.
    expect(de('c-ana', { type: 'danca.fim', sessao, placar: PASSOU }).dancaDesfecho).toBeUndefined()
  })

  it('um falha: a porta fica fechada e a consequência ("no próximo teste") vai só para ele', () => {
    const { bruno, sessao, de } = dancando()
    de('c-ana', { type: 'danca.fim', sessao, placar: PASSOU })
    const r = de('c-bruno', { type: 'danca.fim', sessao, placar: FALHOU })
    expect(r.dancaDesfecho).toMatchObject({ todosPassaram: false, itens: [] })
    expect(r.dancaDesfecho?.porta).toBeUndefined()
    const seuDe = (clientId: string) => para(r, clientId).flatMap((m) => (m.type === 'danca.desfecho' ? [m.seu] : []))
    expect(seuDe('c-ana')).toEqual([{ passou: true }])
    expect(seuDe('c-bruno')).toEqual([{ passou: false, consequencia: { tipo: 'teste', texto: '−2 no próximo teste de Agilidade' } }])
    const mesaDoBruno = para(r, 'c-bruno').find((m) => m.type === 'danca.desfecho')
    expect(mesaDoBruno?.type === 'danca.desfecho' ? mesaDoBruno.mesa.find((l) => l.playerId === bruno)?.letra : null).toBe('Falhou')
    // O recado da consequência entra no caderno dele, e só dele.
    const caderno = para(r, 'c-bruno').find((m) => m.type === 'notes.book')
    expect(caderno?.type === 'notes.book' ? caderno.notes.at(-1)?.text : null).toBe('Consequência: −2 no próximo teste de Agilidade')
    expect(tipos(r, 'c-ana')).not.toContain('notes.book')
  })

  it('o mestre edita o pino no meio da dança: o painel lê o prêmio e a consequência congelados no convite', () => {
    const { s, world, sessao, de } = dancando()
    // A edição chega como chega da store: um mapa novo, com o pino trocado.
    const outro = pino({ premio: { tipo: 'item', texto: 'Moeda de ouro' }, consequencia: { tipo: 'espera', texto: '' } })
    world.open.map = { ...world.open.map, pins: world.open.map.pins.map((p) => (p.id === outro.id ? outro : p)) }
    const congelados = { premio: { tipo: 'item', texto: 'Chave de latão' }, consequencia: { tipo: 'teste', texto: '−2 no próximo teste de Agilidade' } }
    expect(s.danca()).toMatchObject(congelados)
    de('c-ana', { type: 'danca.fim', sessao, placar: PASSOU })
    const r = de('c-bruno', { type: 'danca.fim', sessao, placar: FALHOU })
    // O painel diz o mesmo que o aviso do desfecho (a ponte) e o que foi ao jogador.
    expect(r.dancaDesfecho).toMatchObject(congelados)
    expect(s.danca()).toMatchObject({ fase: 'fim', ...congelados })
  })

  it('nota abaixo da mínima também não passa, mesmo sem a vida zerar', () => {
    const { sessao, de } = dancando(pino({ notaMin: 'A' }))
    de('c-ana', { type: 'danca.fim', sessao, placar: PASSOU })
    expect(de('c-bruno', { type: 'danca.fim', sessao, placar: { ...PASSOU, letra: 'B' } }).dancaDesfecho?.todosPassaram).toBe(false)
  })

  it('prêmio pista: a pista entra no caderno de cada um', () => {
    const { sessao, de } = dancando(pino({ premio: { tipo: 'pista', texto: 'A chave está sob o altar' } }))
    de('c-ana', { type: 'danca.fim', sessao, placar: PASSOU })
    const r = de('c-bruno', { type: 'danca.fim', sessao, placar: PASSOU })
    for (const clientId of ['c-ana', 'c-bruno']) {
      const pista = para(r, clientId).find((m) => m.type === 'clue.added')
      expect(pista?.type === 'clue.added' ? [pista.clue.title, pista.clue.text] : null).toEqual(['Dona Ziza', 'A chave está sob o altar'])
    }
    expect(r.dancaDesfecho?.itens).toEqual([])
  })

  it('pino de minigame sem desafio gravado e sem porta ligada: joga o padrão, e o desfecho não abre nada', () => {
    const solto: Pin = { ...buildPin('pino-danca', { x: 300, y: 300 }, 'minigame'), minigame: undefined }
    const { sessao, de } = dancando(solto)
    de('c-ana', { type: 'danca.fim', sessao, placar: PASSOU })
    const r = de('c-bruno', { type: 'danca.fim', sessao, placar: PASSOU })
    expect(r.dancaDesfecho).toMatchObject({ todosPassaram: true, npc: 'Dona Ziza' })
    expect(r.dancaDesfecho?.porta).toBeUndefined()
    expect(para(r, 'c-ana').find((m) => m.type === 'danca.desfecho')).toMatchObject({ portaAberta: false })
  })

  it('encerrar: todos recebem "mestre" e não há desfecho, nem com o fim chegando depois', () => {
    const { s, sessao, de } = dancando()
    const r = s.encerrarDanca()
    expect(r.outbound.map((o) => [o.clientId, o.msg])).toEqual([['c-ana', { type: 'danca.encerra', sessao, motivo: 'mestre' }], ['c-bruno', { type: 'danca.encerra', sessao, motivo: 'mestre' }]])
    expect(de('c-ana', { type: 'danca.fim', sessao, placar: PASSOU }).dancaDesfecho).toBeUndefined()
    expect(s.danca()?.fase).toBe('encerrada')
    expect(s.encerrarDanca().ok).toBe(false)
  })

  it('quem cai no meio da música sai e não passa; se era o último, o desfecho sai na queda', () => {
    const { s, bruno, sessao, de } = dancando()
    de('c-ana', { type: 'danca.fim', sessao, placar: PASSOU })
    const r = s.disconnect('c-bruno')
    expect(r.dancaDesfecho).toMatchObject({ todosPassaram: false, mesa: [{ letra: 'A', passou: true }, { playerId: bruno, letra: 'Saiu', passou: false }] })
    expect(tipos(r, 'c-ana')).toContain('danca.desfecho')
    expect(s.danca()?.participantes[1]).toMatchObject({ status: 'saiu', conectado: false, passou: false })
  })

  it('quem volta no meio da música (aba nova pelo resume) sai e fica sabendo; se era o último, sai o desfecho', () => {
    const { ana, sessao, de, volta } = dancando()
    de('c-bruno', { type: 'danca.fim', sessao, placar: PASSOU })
    const r = volta('c-ana-2', ana, 'Ana')
    expect(para(r, 'c-ana-2')).toContainEqual({ type: 'danca.encerra', sessao, motivo: 'saiu' })
    expect(r.dancaDesfecho).toMatchObject({ todosPassaram: false, mesa: [{ playerId: ana, letra: 'Saiu' }, { letra: 'A' }] })
  })
})

describe('danca: reconexão no convite', () => {
  it('quem volta durante o convite recebe o convite e o estado de novo, com o Pronto guardado', () => {
    const { s, world, ana, bruno, de, volta } = mesa()
    const sessao = sessaoDe(s.convidarParaDanca('pino-danca', [ana, bruno], world))
    de('c-ana', { type: 'danca.pronto', sessao, dificuldade: 'expert' })
    s.disconnect('c-ana')
    expect(s.danca()?.participantes[0]).toMatchObject({ status: 'pronto', conectado: false })
    const r = volta('c-ana-2', ana, 'Ana')
    const daDanca = para(r, 'c-ana-2').filter((m) => m.type.startsWith('danca.'))
    expect(daDanca.map((m) => m.type)).toEqual(['danca.convite', 'danca.estado'])
    expect(daDanca[1]).toMatchObject({ fase: 'convite', participantes: [{ playerId: ana, status: 'pronto' }, { playerId: bruno, status: 'convidado' }] })
  })

  it('quem caiu no convite e não voltou fica de fora no "Começar"', () => {
    const { s, world, ana, bruno, de } = mesa()
    const sessao = sessaoDe(s.convidarParaDanca('pino-danca', [ana, bruno], world))
    de('c-ana', { type: 'danca.pronto', sessao, dificuldade: 'expert' })
    de('c-bruno', { type: 'danca.pronto', sessao, dificuldade: 'expert' })
    s.disconnect('c-bruno')
    expect(s.comecarDanca().comecou).toBe(true)
    expect(s.danca()?.participantes.map((p) => p.status)).toEqual(['dancando', 'fora'])
  })
})
