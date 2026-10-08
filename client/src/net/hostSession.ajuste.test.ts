/**
 * AJUSTE RÁPIDO NA MESA — a autoridade do host sobre o `personagem.ajustar`:
 * só o dono ajusta a ficha DELE; cada valor passa de novo pelas regras (o
 * número hostil não entra); o histórico ganha a linha em nome do jogador,
 * com o relógio do host; e o teto de pedidos continua valendo.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { novoCartao, novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { Token } from '../types/map'
import { createHostSession, PERSONAGEM_PEDIDOS_POR_JANELA, type HostResult, type HostWorld } from './hostSession'

const CODIGO = 'ABC123'
const FORMA = { ...novoCartao('Transformação'), id: 'forma', nome: 'Forma Híbrida', modificadores: [{ atributo: 'hp', delta: 100 }] }
const BASE = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy')
/** Ficha de antes dos ajustes: HP de um número só. */
const LUFFY: Personagem = { ...BASE, id: 'pers_luffy', recursos: { hp: 600, sp: 60, escudo: 0 }, abas: { ...BASE.abas, transformacoes: [FORMA] } }
const ZORO: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Zoro'), id: 'pers_zoro' }

const token = (id: string, name: string, characterId: string | null): Token => ({ id, characterId, name, x: 100, y: 100, size: 1, image: null })

function mesa(opcoes: { nomeDaAna?: string; sistema?: boolean } = {}) {
  let instante = 1_000
  const tokens: Token[] = [token('tok-ana', 'Ana', LUFFY.id), token('tok-beto', 'Beto', ZORO.id)]
  let personagens: readonly Personagem[] = [LUFFY, ZORO]
  const sistema = opcoes.sistema === false ? null : SISTEMA_ONE_PIECE
  const mundo = (): HostWorld => ({ open: { sceneId: 'cena-1', name: 'Navio', map: { ...createEmptyMap('m1', 'Navio', 40, 40, 50), tokens } }, background: [], rpg: { sistema, personagens } })
  let ids = 0
  const session = createHostSession({ code: CODIGO, visionRadius: 2000, now: () => instante, randomId: () => `id-${++ids}` })
  const entrar = (clientId: string, nome: string): string => {
    const r = session.handleMessage(clientId, { type: 'join', code: CODIGO, name: nome }, mundo())
    const welcome = r.outbound.find((o) => o.msg.type === 'welcome')
    if (welcome === undefined || welcome.msg.type !== 'welcome') throw new Error('join não devolveu welcome')
    return welcome.msg.playerId
  }
  const ana = entrar('c1', opcoes.nomeDaAna ?? 'Ana')
  const beto = entrar('c2', 'Beto')
  session.assignToken(ana, 'tok-ana')
  session.assignToken(beto, 'tok-beto')
  session.broadcast(mundo())
  let reqs = 0
  /** O jogador manda o ajuste; o integrador grava o que voltou aceito. */
  const ajustar = (clientId: string, personagemId: string, ajustes: unknown[]): HostResult => {
    reqs += 1
    const r = session.handleMessage(clientId, { type: 'personagem.ajustar', reqId: `a${reqs}`, personagemId, ajustes }, mundo())
    const aplicado = r.applyPersonagem
    if (aplicado !== undefined) personagens = personagens.map((p) => (p.id === aplicado.personagem.id ? aplicado.personagem : p))
    return r
  }
  return { ajustar, avancar: (ms: number) => (instante += ms), personagem: (id: string) => personagens.find((p) => p.id === id) }
}

function resultado(r: HostResult, clientId: string): boolean | undefined {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'personagem.resultado')?.msg
  return msg !== undefined && msg.type === 'personagem.resultado' ? msg.ok : undefined
}

describe('host: o ajuste rápido do jogador', () => {
  it('a Ana tira 10 do HP do Luffy: aceito, gravado com o máximo, a linha no histórico é dela, com o relógio do host', () => {
    const t = mesa()
    const r = t.ajustar('c1', LUFFY.id, [{ parte: 'recurso', chave: 'hp', valor: 590 }])
    expect(resultado(r, 'c1')).toBe(true)
    expect(r.applyPersonagem?.ajustadoPor).toBe('Ana')
    const luffy = t.personagem(LUFFY.id)
    expect([luffy?.recursos.hp, luffy?.maximos.hp]).toEqual([590, 600])
    expect(luffy?.historico).toEqual([{ quem: 'Ana', parte: 'recurso', chave: 'hp', rotulo: 'HP', de: 600, para: 590, quando: 1_000 }])
    // A ficha nova vai já à Ana (antes do ok), e ao Beto nada.
    expect(r.outbound.filter((o) => o.msg.type === 'personagens').map((o) => o.clientId)).toEqual(['c1'])
  })

  it('número hostil passa pelas regras: HP acima do máximo para no máximo, base negativa para no 0', () => {
    const t = mesa()
    t.ajustar('c1', LUFFY.id, [
      { parte: 'recurso', chave: 'hp', valor: 999_999 },
      { parte: 'atributo', chave: 'forca', valor: -500 },
    ])
    const luffy = t.personagem(LUFFY.id)
    expect([luffy?.recursos.hp, luffy?.atributos.forca]).toEqual([600, 0])
  })

  it('ligar a transformação pela mesa: o máximo sobe, e o histórico diz quem ligou', () => {
    const t = mesa()
    t.ajustar('c1', LUFFY.id, [{ parte: 'cartao', chave: 'forma', valor: 1 }])
    const luffy = t.personagem(LUFFY.id)
    expect(luffy?.cartoesAtivos).toEqual(['forma'])
    expect(luffy?.historico.map((r) => [r.quem, r.rotulo, r.para])).toEqual([['Ana', 'Forma Híbrida', 1]])
  })

  it('a ficha de outro jogador: recusa, nada gravado', () => {
    const t = mesa()
    const r = t.ajustar('c1', ZORO.id, [{ parte: 'recurso', chave: 'hp', valor: 1 }])
    expect(resultado(r, 'c1')).toBe(false)
    expect(r.applyPersonagem).toBeUndefined()
    expect(t.personagem(ZORO.id)).toBe(ZORO)
  })

  it('nada a mudar (chave que o sistema não tem): ok, sem regravar a aventura', () => {
    const t = mesa()
    const r = t.ajustar('c1', LUFFY.id, [{ parte: 'atributo', chave: 'sorte', valor: 9 }])
    expect(resultado(r, 'c1')).toBe(true)
    expect(r.applyPersonagem).toBeUndefined()
  })

  it('aventura sem sistema: recusa (sem regra, sem ajuste)', () => {
    const t = mesa({ sistema: false })
    expect(resultado(t.ajustar('c1', LUFFY.id, [{ parte: 'recurso', chave: 'hp', valor: 1 }]), 'c1')).toBe(false)
  })

  it('jogador chamado "Mestre" não assina como o mestre no histórico', () => {
    const t = mesa({ nomeDaAna: 'mestre' })
    t.ajustar('c1', LUFFY.id, [{ parte: 'recurso', chave: 'hp', valor: 599 }])
    expect(t.personagem(LUFFY.id)?.historico.at(0)?.quem).toBe('mestre (jogador)')
  })

  it(`o teto de ${PERSONAGEM_PEDIDOS_POR_JANELA} pedidos por janela vale para o ajuste também`, () => {
    const t = mesa()
    for (let n = 0; n < PERSONAGEM_PEDIDOS_POR_JANELA; n += 1) expect(resultado(t.ajustar('c1', LUFFY.id, [{ parte: 'recurso', chave: 'hp', valor: 599 - n }]), 'c1')).toBe(true)
    expect(resultado(t.ajustar('c1', LUFFY.id, [{ parte: 'recurso', chave: 'hp', valor: 1 }]), 'c1')).toBe(false)
    expect(t.personagem(LUFFY.id)?.recursos.hp).toBe(600 - PERSONAGEM_PEDIDOS_POR_JANELA)
  })
})
