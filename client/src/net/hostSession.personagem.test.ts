/**
 * FICHA DE PERSONAGEM NA MESA — a autoridade do host. Só o dono mexe na ficha
 * de personagem ligada à ficha (token) DELE; criar liga o personagem novo à
 * ficha dele, nunca à de outro; a ficha emprestada e o NPC do mestre ficam de
 * fora; cada jogador recebe só os personagens dele, e só quando mudam.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { MapData, Token } from '../types/map'
import { createHostSession, PERSONAGEM_PEDIDOS_POR_JANELA, type HostResult, type HostWorld, type Outbound } from './hostSession'

const CODIGO = 'ABC123'

function token(id: string, name: string, characterId: string | null = null, extra: Partial<Token> = {}): Token {
  return { id, characterId, name, x: 100, y: 100, size: 1, image: null, ...extra }
}

const LUFFY: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'pers_luffy' }
const ZORO: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Zoro'), id: 'pers_zoro' }

function mapa(tokens: Token[]): MapData {
  return { ...createEmptyMap('m1', 'Navio', 40, 40, 50), tokens }
}

/** Ana tem tok-ana (Luffy), Beto tem tok-beto (Zoro), tok-nova é da Ana e ainda sem personagem; tok-npc é NPC atribuído à Ana. */
function mesa(opcoes: { personagens?: Personagem[]; sistema?: boolean } = {}) {
  let instante = 0
  let tokens: Token[] = [token('tok-ana', 'Ana', LUFFY.id), token('tok-beto', 'Beto', ZORO.id), token('tok-nova', 'Nami'), token('tok-npc', 'Guarda', null, { npc: true })]
  let personagens: readonly Personagem[] = opcoes.personagens ?? [LUFFY, ZORO]
  const sistema = opcoes.sistema === false ? null : SISTEMA_ONE_PIECE
  const mundo = (): HostWorld => ({ open: { sceneId: 'cena-1', name: 'Navio', map: mapa(tokens) }, background: [], rpg: { sistema, personagens } })
  const session = createHostSession({
    code: CODIGO,
    visionRadius: 2000,
    now: () => instante,
    randomId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
  const entrar = (clientId: string, nome: string): string => {
    const r = session.handleMessage(clientId, { type: 'join', code: CODIGO, name: nome }, mundo())
    const welcome = r.outbound.find((o) => o.msg.type === 'welcome')
    if (welcome === undefined || welcome.msg.type !== 'welcome') throw new Error('join não devolveu welcome')
    return welcome.msg.playerId
  }
  const ana = entrar('c1', 'Ana')
  const beto = entrar('c2', 'Beto')
  session.assignToken(ana, 'tok-ana')
  session.assignToken(ana, 'tok-nova')
  session.assignToken(ana, 'tok-npc')
  session.assignToken(beto, 'tok-beto')
  // O primeiro broadcast põe cada um em jogo, com o que ele já tem.
  session.broadcast(mundo())
  /** O que o integrador faz com o pedido aceito: grava na "aventura" e liga a ficha. */
  const aplicar = (r: HostResult): void => {
    const aplicado = r.applyPersonagem
    if (aplicado === undefined) return
    const existe = personagens.some((p) => p.id === aplicado.personagem.id)
    personagens = existe ? personagens.map((p) => (p.id === aplicado.personagem.id ? aplicado.personagem : p)) : [...personagens, aplicado.personagem]
    const ligar = aplicado.ligarTokenId
    if (ligar !== undefined) tokens = tokens.map((t) => (t.id === ligar ? { ...t, characterId: aplicado.personagem.id } : t))
  }
  const pedir = (clientId: string, msg: Record<string, unknown>): HostResult => {
    const r = session.handleMessage(clientId, msg, mundo())
    aplicar(r)
    return r
  }
  return {
    session,
    ana,
    beto,
    mundo,
    pedir,
    avancar: (ms: number) => (instante += ms),
    personagens: () => personagens,
    tokens: () => tokens,
    /** O mestre grava pela janela dele. */
    mestreGrava: (personagem: Personagem) => {
      personagens = personagens.map((p) => (p.id === personagem.id ? personagem : p))
    },
  }
}

const doTipo = (outbound: readonly Outbound[], clientId: string, type: string) => outbound.filter((o) => o.clientId === clientId && o.msg.type === type).map((o) => o.msg)

function resultado(r: HostResult, clientId: string): { ok: boolean; personagemId?: string } | undefined {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'personagem.resultado')?.msg
  return msg !== undefined && msg.type === 'personagem.resultado' ? { ok: msg.ok, ...(msg.personagemId === undefined ? {} : { personagemId: msg.personagemId }) } : undefined
}

describe('host: quem recebe qual ficha', () => {
  it('na entrada, cada um recebe o sistema e SÓ os personagens das fichas dele', () => {
    const { session, mundo } = mesa()
    const r = session.handleMessage('c3', { type: 'join', code: CODIGO, name: 'Caio' }, mundo())
    // Caio acabou de chegar, sem ficha: sistema e lista vazia.
    expect(doTipo(r.outbound, 'c3', 'rpg.sistema')).toEqual([{ type: 'rpg.sistema', sistema: SISTEMA_ONE_PIECE }])
    expect(doTipo(r.outbound, 'c3', 'personagens')).toEqual([{ type: 'personagens', personagens: [], tokens: [] }])
  })

  it('no broadcast, mudança do mestre na ficha da Ana vai só à Ana, uma vez', () => {
    const t = mesa()
    t.mestreGrava({ ...LUFFY, descricao: 'Capitão.' })
    const primeiro = t.session.broadcast(t.mundo())
    expect(doTipo(primeiro.outbound, 'c1', 'personagens')).toHaveLength(1)
    const [msg] = doTipo(primeiro.outbound, 'c1', 'personagens')
    expect(msg?.type === 'personagens' ? msg.personagens.map((p) => [p.id, p.descricao]) : null).toEqual([[LUFFY.id, 'Capitão.']])
    expect(msg?.type === 'personagens' ? msg.tokens : null).toEqual([
      { tokenId: 'tok-ana', nome: 'Ana', personagemId: LUFFY.id },
      { tokenId: 'tok-nova', nome: 'Nami', personagemId: null },
    ])
    // O Beto não recebe nada: nem a ficha da Ana, nem a dele de novo.
    expect(primeiro.outbound.filter((o) => o.clientId === 'c2' && (o.msg.type === 'personagens' || o.msg.type === 'rpg.sistema'))).toEqual([])
    // Nada mudou: o segundo broadcast não reenvia (o retrato não viaja a cada recorte).
    const segundo = t.session.broadcast(t.mundo())
    expect(doTipo(segundo.outbound, 'c1', 'personagens')).toEqual([])
  })

  it('nenhuma mensagem de ficha leva o personagem de outro jogador', () => {
    const t = mesa()
    t.mestreGrava({ ...ZORO, descricao: 'Espadachim.' })
    t.mestreGrava({ ...LUFFY, descricao: 'Capitão.' })
    const r = t.session.broadcast(t.mundo())
    for (const { clientId, msg } of r.outbound) {
      if (msg.type !== 'personagens') continue
      const ids = msg.personagens.map((p) => p.id)
      if (clientId === 'c1') expect(ids).toEqual([LUFFY.id])
      if (clientId === 'c2') expect(ids).toEqual([ZORO.id])
    }
  })

  it('mundo sem `rpg` (mapa solto): nada de ficha sai para ninguém', () => {
    const session = createHostSession({ code: CODIGO, visionRadius: 2000 })
    const r = session.handleMessage('c1', { type: 'join', code: CODIGO, name: 'Ana' }, mapa([token('tok-ana', 'Ana')]))
    expect(r.outbound.some((o) => o.msg.type === 'personagens' || o.msg.type === 'rpg.sistema')).toBe(false)
  })
})

describe('host: criar a ficha', () => {
  it('a Ana cria a ficha da Nami: personagem do sistema, ligado à Nami, e a resposta já com ele', () => {
    const t = mesa()
    const r = t.pedir('c1', { type: 'personagem.criar', reqId: 'p1', tokenId: 'tok-nova' })
    expect(r.applyPersonagem?.ligarTokenId).toBe('tok-nova')
    expect(r.applyPersonagem?.criadoPor).toBe('Ana')
    const criado = r.applyPersonagem?.personagem
    expect(criado).toMatchObject({ tipo: 'jogador', nome: 'Nami' })
    expect(Object.keys(criado?.atributos ?? {})).toEqual(SISTEMA_ONE_PIECE.atributos.map((a) => a.id))
    expect(resultado(r, 'c1')).toEqual({ ok: true, personagemId: criado?.id })
    // A ficha nova vai antes da resposta, só à Ana.
    const tipos = r.outbound.map((o) => `${o.clientId}:${o.msg.type}`)
    expect(tipos).toEqual(['c1:personagens', 'c1:personagem.resultado'])
    // Gravado pelo integrador, o broadcast seguinte não repete nada.
    expect(doTipo(t.session.broadcast(t.mundo()).outbound, 'c1', 'personagens')).toEqual([])
    expect(t.tokens().find((tk) => tk.id === 'tok-nova')?.characterId).toBe(criado?.id)
  })

  it('não cria para a ficha de OUTRO jogador, nem para o NPC atribuído, nem para ficha inventada', () => {
    const t = mesa()
    for (const tokenId of ['tok-beto', 'tok-npc', 'tok-fantasma']) {
      const r = t.pedir('c1', { type: 'personagem.criar', reqId: `p-${tokenId}`, tokenId })
      expect(r.applyPersonagem, tokenId).toBeUndefined()
      expect(resultado(r, 'c1'), tokenId).toEqual({ ok: false })
    }
    expect(t.personagens()).toEqual([LUFFY, ZORO])
  })

  it('a ficha que já tem personagem não ganha outro; sem sistema não há o que criar', () => {
    expect(resultado(mesa().pedir('c1', { type: 'personagem.criar', reqId: 'p1', tokenId: 'tok-ana' }), 'c1')).toEqual({ ok: false })
    expect(resultado(mesa({ sistema: false }).pedir('c1', { type: 'personagem.criar', reqId: 'p1', tokenId: 'tok-nova' }), 'c1')).toEqual({ ok: false })
  })

  it('ligada a personagem que o mestre apagou, a ficha conta como sem personagem e pode criar', () => {
    const t = mesa({ personagens: [ZORO] })
    const r = t.pedir('c1', { type: 'personagem.criar', reqId: 'p1', tokenId: 'tok-ana' })
    expect(resultado(r, 'c1')?.ok).toBe(true)
  })
})

describe('host: editar a ficha', () => {
  it('a Ana edita o Luffy: só a parte dela muda; a resposta já leva a ficha nova', () => {
    const t = mesa()
    t.mestreGrava({ ...LUFFY, atributos: { ...LUFFY.atributos, agilidade: 70 } })
    const r = t.pedir('c1', { type: 'personagem.editar', reqId: 'p1', personagemId: LUFFY.id, partes: { atributos: { forca: 45 } } })
    expect(resultado(r, 'c1')).toEqual({ ok: true })
    const salvo = t.personagens().find((p) => p.id === LUFFY.id)
    expect(salvo?.atributos).toMatchObject({ forca: 45, agilidade: 70 })
    expect(r.outbound.filter((o) => o.clientId !== 'c1')).toEqual([])
  })

  it('a Ana NÃO edita o Zoro do Beto (nem a imagem dele): recusa igual para todo caso', () => {
    const t = mesa()
    const editar = t.pedir('c1', { type: 'personagem.editar', reqId: 'p1', personagemId: ZORO.id, partes: { nome: 'Palhaço' } })
    const imagem = t.pedir('c1', { type: 'personagem.imagem', reqId: 'p2', personagemId: ZORO.id, imagem: null })
    const inventado = t.pedir('c1', { type: 'personagem.editar', reqId: 'p3', personagemId: 'pers_inventado', partes: { nome: 'X' } })
    for (const r of [editar, imagem, inventado]) {
      expect(r.applyPersonagem).toBeUndefined()
      expect(resultado(r, 'c1')).toEqual({ ok: false })
    }
    expect(t.personagens()).toEqual([LUFFY, ZORO])
  })

  it('ficha emprestada a quem joga no lugar do dono: quem recebeu não edita a ficha de personagem do dono', () => {
    const t = mesa()
    t.session.disconnect('c2')
    const { lent } = t.session.lendTokens(t.beto, t.ana, t.mundo())
    expect(lent).toEqual(['tok-beto'])
    const r = t.pedir('c1', { type: 'personagem.editar', reqId: 'p1', personagemId: ZORO.id, partes: { nome: 'Palhaço' } })
    expect(resultado(r, 'c1')).toEqual({ ok: false })
  })

  it('imagem de cartão que não existe mais: recusa', () => {
    const t = mesa()
    const r = t.pedir('c1', { type: 'personagem.imagem', reqId: 'p1', personagemId: LUFFY.id, cartaoId: 'cart_sumiu', imagem: null })
    expect(resultado(r, 'c1')).toEqual({ ok: false })
  })

  it('quem nem entrou recebe not_joined; mensagem torta, invalid_message', () => {
    const t = mesa()
    expect(t.pedir('c9', { type: 'personagem.editar', reqId: 'p1', personagemId: LUFFY.id, partes: { nome: 'X' } }).outbound).toEqual([{ clientId: 'c9', msg: { type: 'error', reason: 'not_joined' } }])
    expect(t.pedir('c1', { type: 'personagem.editar', reqId: 'p1', personagemId: LUFFY.id, partes: { atributos: { forca: 'muito' } } }).outbound).toEqual([
      { clientId: 'c1', msg: { type: 'error', reason: 'invalid_message' } },
    ])
  })

  it(`mais de ${PERSONAGEM_PEDIDOS_POR_JANELA} pedidos na janela: o resto é recusado até a janela passar`, () => {
    const t = mesa()
    const pedir = (n: number) => t.pedir('c1', { type: 'personagem.editar', reqId: `p${n}`, personagemId: LUFFY.id, partes: { descricao: `v${n}` } })
    for (let n = 0; n < PERSONAGEM_PEDIDOS_POR_JANELA; n += 1) expect(resultado(pedir(n), 'c1')?.ok).toBe(true)
    expect(resultado(pedir(99), 'c1')?.ok).toBe(false)
    t.avancar(10_000)
    expect(resultado(pedir(100), 'c1')?.ok).toBe(true)
  })
})
