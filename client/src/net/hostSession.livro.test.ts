/**
 * LIVRO DE REGRAS NA MESA — o host. O sistema vai a cada conexão SEM o livro
 * (com o resumo); o livro sai só a quem pede, em partes que juntam no livro
 * do sistema da aventura, e só a quem está na mesa, numa aventura com ESSE
 * sistema, dentro do limite de pedidos.
 */
import { describe, expect, it } from 'vitest'
import { resumoDoLivro, sistemaSemLivro } from '../lib/livroDeRegras'
import { createEmptyMap } from '../lib/mapFactory'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { createHostSession, LIVRO_JANELA_MS, LIVRO_PEDIDOS_POR_JANELA, type HostResult, type HostWorld, type Outbound } from './hostSession'
import { lerPacoteDoLivro, partesDoLivro } from './protocoloDoLivro'

const CODIGO = 'ABC123'

/** `rpg: null` = mapa solto (o mundo sem `rpg`). */
function mesa(rpg: HostWorld['rpg'] | null = { sistema: SISTEMA_ONE_PIECE, personagens: [] }) {
  let instante = 0
  let ids = 0
  const mundo = (): HostWorld => ({ open: { sceneId: 'cena-1', name: 'Navio', map: { ...createEmptyMap('m1', 'Navio', 40, 40, 50), tokens: [] } }, background: [], ...(rpg === null ? {} : { rpg }) })
  const session = createHostSession({ code: CODIGO, visionRadius: 2000, now: () => instante, randomId: () => `id-${++ids}` })
  const entrar = (clientId: string, nome: string): HostResult => session.handleMessage(clientId, { type: 'join', code: CODIGO, name: nome }, mundo())
  const pedir = (clientId: string, sistemaId = SISTEMA_ONE_PIECE.id, reqId = 'l1'): HostResult => session.handleMessage(clientId, { type: 'livro.pedir', reqId, sistemaId }, mundo())
  return { entrar, pedir, avancar: (ms: number) => (instante += ms) }
}

const doTipo = (outbound: readonly Outbound[], type: string) => outbound.filter((o) => o.msg.type === type)

/** As partes que a resposta trouxe, juntas e lidas como o jogador lê. */
function livroDaResposta(r: HostResult, sistema: SistemaDeRpg) {
  const partes = r.outbound.flatMap((o) => (o.msg.type === 'livro.parte' ? [o.msg] : []))
  const texto = [...partes].sort((a, b) => a.indice - b.indice).map((p) => p.texto).join('')
  return { partes, lido: lerPacoteDoLivro(texto, sistema) }
}

const recusado = (r: HostResult, reqId = 'l1'): boolean => r.outbound.some((o) => o.msg.type === 'livro.recusa' && o.msg.reqId === reqId) && doTipo(r.outbound, 'livro.parte').length === 0

describe('host: o sistema vai sem o livro', () => {
  it('na entrada, rpg.sistema leva o sistema sem livro nem catálogos, e o resumo do livro', () => {
    const { entrar } = mesa()
    const [sistema] = doTipo(entrar('c1', 'Ana').outbound, 'rpg.sistema')
    expect(sistema?.msg).toEqual({ type: 'rpg.sistema', sistema: sistemaSemLivro(SISTEMA_ONE_PIECE), livro: resumoDoLivro(SISTEMA_ONE_PIECE) })
    // O sistema sem livro tem uma fração do tamanho: é o que cada conexão leva sempre.
    expect(JSON.stringify(sistema?.msg).length).toBeLessThan(10_000)
  })

  it('sistema sem livro: rpg.sistema sem resumo', () => {
    const { entrar } = mesa({ sistema: sistemaSemLivro(SISTEMA_ONE_PIECE), personagens: [] })
    expect(doTipo(entrar('c1', 'Ana').outbound, 'rpg.sistema')[0]?.msg).toEqual({ type: 'rpg.sistema', sistema: sistemaSemLivro(SISTEMA_ONE_PIECE) })
  })
})

describe('host: o pedido do livro', () => {
  it('quem está na mesa pede e recebe as partes, só ele, que juntam no livro do sistema', () => {
    const { entrar, pedir } = mesa()
    entrar('c1', 'Ana')
    entrar('c2', 'Beto')
    const r = pedir('c1')
    const { partes, lido } = livroDaResposta(r, SISTEMA_ONE_PIECE)
    expect(partes.length).toBe(partesDoLivro(SISTEMA_ONE_PIECE)?.length)
    expect(partes.every((p) => p.reqId === 'l1' && p.total === partes.length)).toBe(true)
    expect(r.outbound.every((o) => o.clientId === 'c1')).toBe(true)
    expect(lido?.livro).toEqual(SISTEMA_ONE_PIECE.livro)
    expect(lido?.catalogos).toEqual(SISTEMA_ONE_PIECE.catalogos)
  })

  it('pedido de outro sistema (o mestre trocou no meio) é recusado', () => {
    const { entrar, pedir } = mesa()
    entrar('c1', 'Ana')
    expect(recusado(pedir('c1', 'dnd-5e'))).toBe(true)
  })

  it('quem não entrou na mesa não recebe nada além do erro de sempre', () => {
    const { pedir } = mesa()
    const r = pedir('intruso')
    expect(r.outbound.map((o) => o.msg)).toEqual([{ type: 'error', reason: 'not_joined' }])
  })

  it('mapa solto (sem aventura), aventura sem sistema e sistema sem livro: recusa', () => {
    for (const rpg of [null, { sistema: null, personagens: [] }, { sistema: sistemaSemLivro(SISTEMA_ONE_PIECE), personagens: [] }]) {
      const { entrar, pedir } = mesa(rpg)
      entrar('c1', 'Ana')
      expect(recusado(pedir('c1'))).toBe(true)
    }
  })

  it(`no máximo ${LIVRO_PEDIDOS_POR_JANELA} pedidos por jogador na janela; passada a janela, volta`, () => {
    const { entrar, pedir, avancar } = mesa()
    entrar('c1', 'Ana')
    entrar('c2', 'Beto')
    for (let n = 0; n < LIVRO_PEDIDOS_POR_JANELA; n += 1) expect(recusado(pedir('c1', SISTEMA_ONE_PIECE.id, `l${n}`), `l${n}`)).toBe(false)
    expect(recusado(pedir('c1', SISTEMA_ONE_PIECE.id, 'demais'), 'demais')).toBe(true)
    // O limite é de cada um: o Beto ainda pede.
    expect(recusado(pedir('c2'))).toBe(false)
    avancar(LIVRO_JANELA_MS)
    expect(recusado(pedir('c1', SISTEMA_ONE_PIECE.id, 'depois'), 'depois')).toBe(false)
  })
})
