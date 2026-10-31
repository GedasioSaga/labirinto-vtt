// @vitest-environment node
/**
 * BATALHA — o aliado vê a ficha de AGORA depois da ação do jogador (defeito
 * do passeio de 31/10/2026: o Bruno ativa a forma, ele e o mestre veem
 * 1.500/1.800, a Lia continua vendo 900/1.200).
 *
 * No app, a ação do jogador muda a store do mestre, e a store pede um
 * broadcast NA HORA (`notifyBatalhaChanged` → `broadcastNow`), ainda dentro do
 * `handleMessage`, com o mundo de agora: ele já leva os aliados com a ficha
 * nova. A ponte falsa daqui faz o mesmo. O que a Lia recebe, na ordem do fio,
 * é o broadcast e depois a resposta do pedido.
 */
import { describe, expect, it } from 'vitest'
import type { BatalhaEmTurnos, PonteDaBatalha } from '../lib/batalha/ponte'
import type { LinhaDoRegistro } from '../lib/batalha/registro'
import { turnosVazios, type TurnosDaCena } from '../lib/batalha/turnos'
import { createEmptyMap } from '../lib/mapFactory'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { novoCartao, novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { Token } from '../types/map'
import { createHostSession, type HostSession, type HostWorld, type Outbound } from './hostSession'

const CODIGO = 'BAT001'
const CENA = 'cena-1'
const BASE_DO_BRUNO = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Bruno')
const PUNHO_NEGRO = { ...novoCartao('Punho Negro'), id: 'f-punho' }
const BRUNO: Personagem = {
  ...BASE_DO_BRUNO,
  id: 'p-bruno',
  recursos: { hp: 900, sp: 50, escudo: 0 },
  maximos: { hp: 1200, sp: 300 },
  abas: { ...BASE_DO_BRUNO.abas, transformacoes: [PUNHO_NEGRO] },
}
const LIA: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Lia'), id: 'p-lia' }
/** A ficha do Bruno depois de ativar a forma (o que a store grava na aventura). */
const BRUNO_NA_FORMA: Personagem = { ...BRUNO, recursos: { ...BRUNO.recursos, hp: 1500 }, cartoesAtivos: ['f-punho'] }

/** A linha que a ação deixa no registro (a Lia a vê: fala de uma ficha da tela dela). */
const LINHA_DA_FORMA: LinhaDoRegistro = {
  id: 'l1',
  seq: 1,
  quando: 1_000,
  rodada: 1,
  autor: { tipo: 'jogador', playerId: 'qualquer', nome: 'Bruno' },
  tipo: 'transformacao',
  texto: 'Bruno ativa Punho Negro (Ação Simples)',
  envolve: { tokenIds: ['t-bruno'], personagemIds: [] },
  reversao: { tipo: 'composta', partes: [] },
}

const token = (id: string, name: string, characterId: string, x: number): Token => ({ id, characterId, name, x, y: 125, size: 1, image: null })

/** `broadcastNaAcao` false = a ponte não pede broadcast (outro integrador): o recorte tem de sair da própria resposta. */
function mesa(broadcastNaAcao = true) {
  let personagens: readonly Personagem[] = [BRUNO, LIA]
  const tokens: Token[] = [token('t-bruno', 'Bruno', BRUNO.id, 125), token('t-lia', 'Lia', LIA.id, 175)]
  const mundo = (): HostWorld => ({
    open: { sceneId: CENA, name: 'Navio', map: { ...createEmptyMap('m1', 'Navio', 20, 20, 50), tokens } },
    background: [],
    rpg: { sistema: SISTEMA_ONE_PIECE, personagens },
  })
  const cartas = [
    { id: 'c-bruno', tokenId: 't-bruno', personagemId: BRUNO.id },
    { id: 'c-lia', tokenId: 't-lia', personagemId: LIA.id },
  ]
  let turnos: TurnosDaCena = { ...turnosVazios('d20'), cartas, vez: 'c-bruno' }
  let registro: readonly LinhaDoRegistro[] = []
  const cena = (): BatalhaEmTurnos => ({ turnos, registro, regras: null })
  /** O que o integrador manda pelo fio, na ordem: o broadcast de dentro da ação entra antes da resposta. */
  const fio: Outbound[] = []
  let sessao: HostSession | null = null
  const nada = (): boolean => false
  const ponte: PonteDaBatalha = {
    cena: (sceneKey) => (sceneKey === CENA ? cena() : null),
    passarVez: nada,
    desfazer: nada,
    registrarAjuste: () => undefined,
    // Como `mudarForma` da store: grava a ficha na aventura, muda a cena, e a store pede o broadcast na hora.
    agir: () => {
      personagens = [BRUNO_NA_FORMA, LIA]
      turnos = { ...turnos, formas: { [BRUNO.id]: { cartaoId: 'f-punho', imagem: null } } }
      registro = [LINHA_DA_FORMA]
      if (broadcastNaAcao && sessao !== null) fio.push(...sessao.broadcast(mundo()).outbound)
      return true
    },
    reagir: nada,
    darDano: nada,
    escolherArmas: nada,
    zerarCarga: nada,
  }
  let ids = 0
  const s = createHostSession({ code: CODIGO, visionRadius: 2000, now: () => 1_000, randomId: () => `id-${++ids}`, getBatalha: () => true, ponteDaBatalha: ponte })
  sessao = s
  const entrar = (clientId: string, nome: string): string => {
    const r = s.handleMessage(clientId, { type: 'join', code: CODIGO, name: nome }, mundo())
    const welcome = r.outbound.find((o) => o.msg.type === 'welcome')
    if (welcome === undefined || welcome.msg.type !== 'welcome') throw new Error('join não devolveu welcome')
    return welcome.msg.playerId
  }
  const bruno = entrar('c-bruno', 'Bruno')
  const lia = entrar('c-lia', 'Lia')
  s.assignToken(bruno, 't-bruno')
  s.assignToken(lia, 't-lia')
  // Dois broadcasts: o primeiro manda a cena (a tela de cada um passa a ter as fichas), o segundo já acha os dois na batalha.
  fio.push(...s.broadcast(mundo()).outbound, ...s.broadcast(mundo()).outbound)
  /** O Bruno ativa a forma: o mundo do pedido é o de ANTES da ação (o integrador o leu ao receber a mensagem). */
  const ativarForma = (): Outbound[] => {
    const pedido: PedidoDeAcao = { tipo: 'transformar', cartaoId: PUNHO_NEGRO.id, acao: 'simples', trocarImagem: false }
    const resposta = s.handleMessage('c-bruno', { type: 'batalha.agir', reqId: 'r1', vez: { cartaId: 'c-bruno', rodada: 1 }, pedido }, mundo()).outbound
    fio.push(...resposta)
    return resposta
  }
  return { fio, ativarForma }
}

/** Os aliados da última `batalha.aliados` que chegou à conexão. */
function ultimosAliados(fio: readonly Outbound[], clientId: string): readonly Personagem[] | undefined {
  const aliados = fio.filter((o) => o.clientId === clientId).flatMap((o) => (o.msg.type === 'batalha.aliados' ? [o.msg.personagens] : []))
  return aliados.at(-1)
}

describe('batalha: o aliado recebe a ficha de agora depois da ação do jogador', () => {
  it('pré-condição: antes da ação a Lia tem o Bruno de 900 como aliado', () => {
    const { fio } = mesa()
    expect(ultimosAliados(fio, 'c-lia')?.map((p) => [p.id, p.recursos.hp])).toEqual([['p-bruno', 900]])
  })

  it('o Bruno ativa a forma: a última ficha dele que chega à Lia é a de 1.500, com a forma ligada', () => {
    const { fio, ativarForma } = mesa()
    ativarForma()
    const bruno = ultimosAliados(fio, 'c-lia')?.find((p) => p.id === BRUNO.id)
    expect([bruno?.recursos.hp, bruno?.cartoesAtivos]).toEqual([1500, ['f-punho']])
  })

  it('a resposta do pedido não reenvia à Lia a faixa de antes (sem a forma) por cima da de agora', () => {
    const { fio, ativarForma } = mesa()
    ativarForma()
    const estados = fio.filter((o) => o.clientId === 'c-lia' && o.msg.type === 'batalha.estado')
    const ultimo = estados.at(-1)
    expect(JSON.stringify(ultimo?.msg)).toContain('Punho Negro')
  })

  it('sem broadcast de dentro da ação, a própria resposta leva a faixa nova à Lia, antes do resultado do Bruno', () => {
    const { ativarForma } = mesa(false)
    const tipos = ativarForma().map((o) => `${o.clientId} ${o.msg.type}`)
    expect(tipos).toContain('c-lia batalha.estado')
    expect(tipos.indexOf('c-lia batalha.estado')).toBeLessThan(tipos.indexOf('c-bruno batalha.resultado'))
  })
})
