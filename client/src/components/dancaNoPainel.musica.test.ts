import { describe, expect, it, vi } from 'vitest'
import { VISAO_FECHADA, type EstadoDaVisao } from '../net/visaoDeTeste/visaoDeTeste'
import { MUSICA_SEM_PASTA, textoDoConviteRecusado } from './DancaAoVivo'
import { dancaNoPainel, type PonteDaDanca } from './dancaNoPainel'

/**
 * SONS F5d: a música importada sai para a mesa só da pasta da aventura
 * (`/sons/<id>`). Sem pasta, o convite da SALA não sai e o painel diz por quê;
 * o teste (Visão de jogador) lê a música do disco e nunca passa por isso.
 */

function ponteFalsa() {
  return {
    convidarParaDanca: vi.fn<PonteDaDanca['convidarParaDanca']>(() => ({ ok: true, sessao: 'd1', convidados: 1 })),
    comecarDanca: vi.fn<PonteDaDanca['comecarDanca']>(() => true),
    pausarDanca: vi.fn<PonteDaDanca['pausarDanca']>(() => true),
    retomarDanca: vi.fn<PonteDaDanca['retomarDanca']>(() => true),
    encerrarDanca: vi.fn<PonteDaDanca['encerrarDanca']>(() => true),
  }
}

const FICHA = { id: 'tok-ana', nome: 'Ana', retrato: null, cor: '#ffffff', dono: null, npc: false }
const TESTE_ABERTO: EstadoDaVisao = { aberta: true, ficha: FICHA, danca: null, pesca: [], tiro: [], jogadores: [{ playerId: 'p-teste', name: 'Ana' }] }

function sala(ponte: PonteDaDanca, prepararMusica: () => boolean) {
  return { aberta: true, players: [{ playerId: 'p-bia', name: 'Bia' }], danca: null, ponte: () => ponte, prepararMusica }
}

describe('dancaNoPainel: a música da sala precisa da pasta da aventura', () => {
  it('sem pasta: o convite não chega à ponte e o painel avisa', () => {
    const ponte = ponteFalsa()
    const painel = dancaNoPainel('pino-1', { estado: VISAO_FECHADA, ponte: () => null }, sala(ponte, () => false))
    const resultado = painel?.onConvidar(['p-bia']) ?? null
    expect(resultado).toEqual({ ok: false, motivo: 'musica' })
    expect(ponte.convidarParaDanca).not.toHaveBeenCalled()
    expect(textoDoConviteRecusado(resultado)).toBe(MUSICA_SEM_PASTA)
  })

  it('com pasta (ou faixa demo): o convite sai como antes, uma conferência por convite', () => {
    const ponte = ponteFalsa()
    const preparar = vi.fn(() => true)
    const painel = dancaNoPainel('pino-1', { estado: VISAO_FECHADA, ponte: () => null }, sala(ponte, preparar))
    expect(painel?.onConvidar(['p-bia'])).toEqual({ ok: true, sessao: 'd1', convidados: 1 })
    expect(ponte.convidarParaDanca).toHaveBeenCalledWith('pino-1', ['p-bia'])
    expect(preparar).toHaveBeenCalledTimes(1)
  })

  it('a Visão de jogador aberta ganha da sala e não confere pasta nenhuma', () => {
    const doTeste = ponteFalsa()
    const preparar = vi.fn(() => false)
    const painel = dancaNoPainel('pino-1', { estado: TESTE_ABERTO, ponte: () => doTeste }, sala(ponteFalsa(), preparar))
    expect(painel?.onConvidar(['p-teste'])).toEqual({ ok: true, sessao: 'd1', convidados: 1 })
    expect(preparar).not.toHaveBeenCalled()
  })
})
