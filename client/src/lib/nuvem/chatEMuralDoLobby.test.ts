import { describe, expect, it } from 'vitest'
import { CHAT_TEXT_MAX_LENGTH } from '../chat'
import { ze } from '../treino/fichasDeTreino.testkit'
import type { Personagem } from '../personagem'
import { canalDoPar, lerCanal, lerPedidoDoChat, mencoesDaSala, parDoPrivado, textoDoChat } from './chatDoLobby'
import type { Json } from './json'
import { fichaDaFrase, lerPedidoDoMural, modificacaoDoMural, PEDIDOS_DO_MESTRE, rotulosDoSistema } from './muralDoLobby'
import { projetarOpParaJogador } from './projecao'
import type { MembroProjetado, OpGravada } from './tipos'

/**
 * As regras puras do chat e do mural do Lobby que o DO usa: o canal do
 * privado (só `{dm}`, nunca o texto `dm:a:b`), o par do privado igual dos dois
 * lados, o texto limpo, o que só o mestre pede no mural e a frase das
 * modificações, que nunca leva nota do mestre nem ficha de NPC.
 */

const NAMI = 'conta_nami'
const ZORO = 'conta_zoro'

describe('chat: o canal do privado', () => {
  it('o texto "dm:a:b" (o formato da chave interna) é fora do formato', () => {
    expect(lerCanal(`dm:${NAMI}|${ZORO}`)).toBeNull()
    expect(lerCanal(`dm:${NAMI}:${ZORO}`)).toBeNull()
  })

  it('só "sala" ou {dm: contaId} com essa chave só', () => {
    expect(lerCanal('sala')).toBe('sala')
    expect(lerCanal({ dm: ZORO })).toEqual({ dm: ZORO })
    expect(lerCanal({ dm: ZORO, par: `${NAMI}|${ZORO}` })).toBeNull()
    expect(lerCanal({ dm: '' })).toBeNull()
    expect(lerCanal({ dm: `${NAMI}|${ZORO}` })).toBeNull()
    expect(lerCanal(null)).toBeNull()
    expect(lerCanal(['sala'])).toBeNull()
  })

  it('o par é o mesmo dos dois lados, e cada lado vê o outro como canal', () => {
    const daNami = parDoPrivado(NAMI, ZORO)
    const doZoro = parDoPrivado(ZORO, NAMI)
    expect(daNami).toEqual(doZoro)
    expect(canalDoPar(daNami, NAMI)).toEqual({ dm: ZORO })
    expect(canalDoPar(daNami, ZORO)).toEqual({ dm: NAMI })
  })

  it('o pedido de chat.antes com o canal em texto é recusado como formato (sem cair na sala)', () => {
    expect(lerPedidoDoChat({ t: 'chat.antes', canal: `dm:${NAMI}:${ZORO}`, antesDeId: null, limite: 10 })).toEqual({ ok: false, pedido: 'chat.antes' })
  })

  it('o limite da página é cortado no teto, não recusado', () => {
    const lido = lerPedidoDoChat({ t: 'chat.antes', canal: 'sala', antesDeId: null, limite: 10_000 })
    expect(lido.ok && lido.pedido.t === 'chat.antes' ? lido.pedido.limite : null).toBe(100)
  })
})

describe('chat: o texto', () => {
  it('vazio, só espaço e só caracteres invisíveis não vão', () => {
    expect(textoDoChat('')).toBeNull()
    expect(textoDoChat('   \n\t ')).toBeNull()
    expect(textoDoChat('​‎')).toBeNull()
  })

  it('no teto vai; um acima não vai', () => {
    expect(textoDoChat('a'.repeat(CHAT_TEXT_MAX_LENGTH))).toHaveLength(CHAT_TEXT_MAX_LENGTH)
    expect(textoDoChat('a'.repeat(CHAT_TEXT_MAX_LENGTH + 1))).toBeNull()
  })

  it('HTML fica literal (o servidor não escapa nem apaga: quem mostra é que nunca interpreta)', () => {
    expect(textoDoChat('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>')
  })

  it('acento, emoji e CRLF do Windows: o texto passa, e \\r\\n vira \\n', () => {
    // Emoji simples (fora do BMP). O composto com ZWJ (🏴‍☠️) perde a cola de propósito (UNSAFE_CHARS, lib/chat.ts).
    expect(textoDoChat('ação 😀 “aspas”\r\nlinha')).toBe('ação 😀 “aspas”\nlinha')
  })

  it('@mestre menciona o mestre; dois membros com o mesmo nome são mencionados juntos', () => {
    const membros = [
      { contaId: NAMI, nome: 'Nami', papel: 'jogador' },
      { contaId: 'conta_nami_2', nome: 'Nami', papel: 'jogador' },
    ] as MembroProjetado[]
    expect(mencoesDaSala('@mestre e @Nami', membros)).toEqual(['mestre', NAMI, 'conta_nami_2'])
  })
})

describe('mural: o que só o mestre pede', () => {
  it('postar, editar, apagar e fixar são do mestre; reagir, lido, antes e modificações são de todo membro', () => {
    expect([...PEDIDOS_DO_MESTRE].sort()).toEqual(['mural.apagar', 'mural.editar', 'mural.fixar', 'mural.postar'])
    for (const t of ['mural.reagir', 'mural.lido', 'mural.antes', 'mural.modificacoes'] as const) expect(PEDIDOS_DO_MESTRE.has(t)).toBe(false)
  })

  it('reação fora da lista fixa é formato', () => {
    expect(lerPedidoDoMural({ t: 'mural.reagir', id: 1, reacao: '💩' }).ok).toBe(false)
    expect(lerPedidoDoMural({ t: 'mural.reagir', id: 1, reacao: null }).ok).toBe(true)
  })
})

describe('mural: as modificações pela projeção do jogador', () => {
  const rotulos = rotulosDoSistema(null)
  const NOTA = 'o mestre sabe que a Nami é espiã'

  function gravada(fichaId: string, caminho: string[], extra: Partial<OpGravada> = {}): OpGravada {
    return {
      opId: `op_${caminho.join('_')}`,
      loteId: 'lote',
      baseRev: 1,
      clienteId: 'cli',
      quandoCliente: 1,
      fichaId,
      caminho,
      acao: 'definir',
      rev: 2,
      autorContaId: 'mestre',
      autorNome: 'Mestre',
      origem: 'app',
      atestadoPeloApp: true,
      quando: 1_800_000_000_000,
      ...extra,
    } as OpGravada
  }

  function fraseParaJogador(op: OpGravada, visivel: 'mesa' | 'mestre' | 'treino', doc: Personagem): string | null {
    const projetada = projetarOpParaJogador(op, visivel)
    return projetada === null ? null : modificacaoDoMural(projetada, fichaDaFrase(doc), rotulos).frase
  }

  it('a nota do mestre não chega ao jogador nem como frase', () => {
    const op = gravada('pers_ze', ['notaDoMestre'], { valor: NOTA })
    expect(fraseParaJogador(op, 'mesa', ze(60))).toBeNull()
  })

  it('qualquer op numa ficha de NPC (só o mestre vê) não chega ao jogador', () => {
    const op = gravada('pers_npc', ['recursos', 'hp'], { valor: 10, antes: 600 })
    expect(fraseParaJogador(op, 'mestre', ze(60))).toBeNull()
  })

  it('a ficha trocada inteira chega sem a nota do mestre no valor nem no antes', () => {
    const doc = { ...ze(60), notaDoMestre: NOTA } as unknown as Json
    const op = gravada('pers_ze', [], { acao: 'definir', valor: doc, antes: doc })
    const projetada = projetarOpParaJogador(op, 'mesa')
    expect(JSON.stringify(projetada)).not.toContain(NOTA)
    expect(JSON.stringify(projetada)).not.toContain('notaDoMestre')
  })

  it('o nome do cartão com HTML entra na frase como texto entre aspas, cortado no teto', () => {
    const doc = ze(60)
    const cartao = doc.abas.habilidades?.[0]
    if (cartao === undefined) throw new Error('o Zé não tem habilidade')
    const comHtml: Personagem = { ...doc, abas: { ...doc.abas, habilidades: [{ ...cartao, nome: '<img src=x onerror=alert(1)> e um nome bem comprido demais' }] } }
    const frase = fraseParaJogador(gravada('pers_ze', ['abas', 'habilidades', cartao.id, 'campos', 'dano'], { valor: 'Força + 70', antes: 'Força + 60' }), 'mesa', comHtml)
    expect(frase).toMatch(/^Mestre mudou “<img src=x onerror=alert\(1\)> e um nome …” em habilidades$/)
    const citado = /“(.*)”/.exec(frase ?? '')?.[1] ?? ''
    expect(citado.length).toBeLessThanOrEqual(40)
  })

  it('a frase da moeda: 1 é singular, o resto plural, negativo é gasto', () => {
    const doc = ze(60)
    expect(fraseParaJogador(gravada('pers_ze', ['moedas'], { acao: 'somar', delta: 1 }), 'mesa', doc)).toBe('Mestre ganhou 1 moeda')
    expect(fraseParaJogador(gravada('pers_ze', ['moedas'], { acao: 'somar', delta: -1500 }), 'mesa', doc)).toBe('Mestre gastou 1.500 moedas')
    expect(fraseParaJogador(gravada('pers_ze', ['moedas'], { acao: 'somar', delta: 0 }), 'mesa', doc)).toBe('Mestre ganhou 0 moedas')
  })
})
