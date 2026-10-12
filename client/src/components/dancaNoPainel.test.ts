import { describe, expect, it, vi } from 'vitest'
import { minigamePadrao } from '../lib/pins'
import type { DancaAoVivo } from '../net/dancaNoHost'
import { VISAO_FECHADA, type EstadoDaVisao } from '../net/visaoDeTeste/visaoDeTeste'
import { dancaNoPainel, type PonteDaDanca } from './dancaNoPainel'

/**
 * Por onde o painel do pino de minigame chama a dança: a sala de verdade ou,
 * com a Visão de jogador aberta, o teste (que ganha mesmo com a sala aberta).
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

function danca(sessao: string, fase: DancaAoVivo['fase']): DancaAoVivo {
  const { premio, consequencia } = minigamePadrao()
  return { sessao, pinId: 'pino-1', npc: 'Dona Ziza', fase, notaMin: 'C', temPorta: false, premio, consequencia, participantes: [] }
}

const DANCA_DO_TESTE = danca('teste', 'convite')
const DANCA_DA_SALA = danca('sala', 'musica')

const FICHA = { id: 'tok-ana', nome: 'Ana', retrato: null, cor: '#ffffff', dono: null, npc: false }
const TESTE_ABERTO: EstadoDaVisao = { aberta: true, ficha: FICHA, danca: DANCA_DO_TESTE, jogadores: [{ playerId: 'p-teste', name: 'Ana' }] }

function sala(aberta: boolean, ponte: PonteDaDanca | null) {
  return { aberta, players: [{ playerId: 'p-bia', name: 'Bia' }], danca: DANCA_DA_SALA, ponte: () => ponte }
}

describe('dancaNoPainel', () => {
  it('com o teste aberto, o teste ganha da sala: só o jogador de teste, marcado, e tudo vai à ponte de TESTE', () => {
    const doTeste = ponteFalsa()
    const daSala = ponteFalsa()
    const painel = dancaNoPainel('pino-1', { estado: TESTE_ABERTO, ponte: () => doTeste }, sala(true, daSala))

    expect(painel?.players).toEqual([{ playerId: 'p-teste', name: 'Teste · Ana' }])
    expect(painel?.danca).toBe(DANCA_DO_TESTE)
    expect(painel?.onConvidar(['p-teste'])).toEqual({ ok: true, sessao: 'd1', convidados: 1 })
    expect(painel?.onComecar()).toBe(true)
    painel?.onPausar()
    painel?.onRetomar()
    painel?.onEncerrar()

    expect(doTeste.convidarParaDanca).toHaveBeenCalledWith('pino-1', ['p-teste'])
    for (const comando of [doTeste.comecarDanca, doTeste.pausarDanca, doTeste.retomarDanca, doTeste.encerrarDanca]) expect(comando).toHaveBeenCalledTimes(1)
    for (const comando of Object.values(daSala)) expect(comando).not.toHaveBeenCalled()
  })

  it('a ponte de teste é lida na hora de cada comando: entre gerações (sem ponte), o convite volta `null`', () => {
    let ponte: PonteDaDanca | null = null
    const painel = dancaNoPainel('pino-1', { estado: TESTE_ABERTO, ponte: () => ponte }, sala(false, null))
    expect(painel?.onConvidar(['p-teste'])).toBeNull()
    expect(painel?.onComecar()).toBe(false)

    const nova = ponteFalsa()
    ponte = nova
    painel?.onConvidar(['p-teste'])
    expect(nova.convidarParaDanca).toHaveBeenCalledWith('pino-1', ['p-teste'])
  })

  it('teste fechado: a sala de sempre, com os jogadores dela como vieram', () => {
    const daSala = ponteFalsa()
    const painel = dancaNoPainel('pino-1', { estado: VISAO_FECHADA, ponte: () => null }, sala(true, daSala))

    expect(painel?.players).toEqual([{ playerId: 'p-bia', name: 'Bia' }])
    expect(painel?.danca).toBe(DANCA_DA_SALA)
    painel?.onConvidar(['p-bia'])
    expect(daSala.convidarParaDanca).toHaveBeenCalledWith('pino-1', ['p-bia'])
  })

  it('sem teste e sem sala: nada ao vivo (o painel pede para abrir a sala)', () => {
    expect(dancaNoPainel('pino-1', { estado: VISAO_FECHADA, ponte: () => null }, sala(false, null))).toBeNull()
  })
})
