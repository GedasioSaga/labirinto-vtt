import { describe, expect, it } from 'vitest'
import {
  AGORA,
  docDe,
  enviar,
  F_DO_MESTRE,
  F_NAMI,
  F_NAMI_2,
  F_SEM_DONO,
  F_ZORO,
  ficha,
  mesa,
  MESTRE_NO_APP,
  MESTRE_NO_SITE,
  NAMI,
  NAMI_NO_PC,
  op,
  USOPP_NO_SITE,
  USOPP_REMOVIDO,
  ZORO_NO_SITE,
} from './campanha.fixture'
import { paraJson } from './json'
import { chaveDaCotaDaCampanha, chaveDaCotaDaConta, conferirRitmo, inicioDoDiaSeguinte, LIMITES, type Cota } from './limites'
import { respostasAdiadas } from './lote'

/**
 * PERMISSÃO (plano do Lobby §6.4-6.5; testes liberados pela 12.18, grupo b):
 * jogador só nas próprias fichas (uma conta pode ter várias), nunca em campo
 * do mestre; ficha sem dono só o mestre; `autorDeclarado` só com a
 * identidade do app; base inválida negada; cota e ritmo ADIAM, nunca negam.
 */

const HP = ['recursos', 'hp']

describe('de quem é a ficha', () => {
  it('uma conta com DUAS fichas edita as duas e nenhuma alheia', () => {
    const campanha = mesa()
    const lote = [F_NAMI, F_NAMI_2, F_ZORO].map((fichaId) => op(NAMI_NO_PC, fichaId, HP, 'definir', { valor: 7 }))
    const respostas = enviar(campanha, NAMI_NO_PC, lote).respostas
    expect(respostas.map((resposta) => resposta.t)).toEqual(['ack', 'ack', 'negado'])
    expect(respostas[2]).toMatchObject({ motivo: 'sem-permissao', detalhe: 'Esta ficha não é sua' })
    expect([F_NAMI, F_NAMI_2, F_ZORO].map((fichaId) => docDe(campanha, fichaId).recursos.hp)).toEqual([7, 7, 300])
  })

  it('jogador sem permissão (ficha do colega) = negado, e a ficha não muda', () => {
    const campanha = mesa()
    const resultado = enviar(campanha, ZORO_NO_SITE, [op(ZORO_NO_SITE, F_NAMI, ['moedas'], 'somar', { delta: -100 })])
    expect(resultado.respostas[0]).toMatchObject({ t: 'negado', motivo: 'sem-permissao' })
    expect(resultado.violacoes).toBe(1)
    expect(docDe(campanha, F_NAMI).moedas).toBe(100)
  })

  it('ficha sem dono: só o mestre edita', () => {
    const campanha = mesa()
    expect(enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, F_SEM_DONO, HP, 'definir', { valor: 1 })]).respostas[0]).toMatchObject({
      t: 'negado',
      motivo: 'sem-permissao',
      detalhe: 'Ficha sem dono: só o mestre edita',
    })
    expect(enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_SEM_DONO, HP, 'definir', { valor: 1 })]).respostas[0]).toMatchObject({ t: 'ack' })
  })

  it('jogador nunca em campo do mestre, nunca cria nem apaga ficha, nunca em ficha escondida', () => {
    const campanha = mesa()
    const tentativas = [
      op(NAMI_NO_PC, F_NAMI, ['notaDoMestre'], 'definir', { valor: 'Sou a melhor' }),
      op(NAMI_NO_PC, F_NAMI, ['dono'], 'definir', { valor: 'conta_zoro' }),
      op(NAMI_NO_PC, F_NAMI, ['retrato'], 'definir', { valor: null }),
      op(NAMI_NO_PC, F_NAMI, [], 'apagar'),
      op(NAMI_NO_PC, 'pers_nova', [], 'criar', { valor: paraJson(ficha('pers_nova', { dono: NAMI.contaId })) }),
      op(NAMI_NO_PC, F_DO_MESTRE, HP, 'definir', { valor: 1 }),
    ]
    const respostas = enviar(campanha, NAMI_NO_PC, tentativas).respostas
    expect(respostas.map((resposta) => (resposta.t === 'negado' ? resposta.motivo : resposta.t))).toEqual(Array(tentativas.length).fill('sem-permissao'))
    expect(campanha.todasAsOps()).toEqual([])
  })

  it('membro removido é negado já na mensagem seguinte', () => {
    const campanha = mesa()
    const resposta = enviar(campanha, USOPP_NO_SITE, [op(USOPP_NO_SITE, F_NAMI, HP, 'definir', { valor: 1 })]).respostas[0]
    expect(resposta).toMatchObject({ t: 'negado', motivo: 'sem-permissao' })
  })

  it('trocar o dono no doc tira a permissão na mensagem seguinte', () => {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI_2, ['dono'], 'definir', { valor: 'conta_zoro' })])
    expect(enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, F_NAMI_2, HP, 'definir', { valor: 1, baseRev: 1 })]).respostas[0]).toMatchObject({ t: 'negado', motivo: 'sem-permissao' })
    expect(enviar(campanha, ZORO_NO_SITE, [op(ZORO_NO_SITE, F_NAMI_2, HP, 'definir', { valor: 1, baseRev: 1 })]).respostas[0]).toMatchObject({ t: 'ack' })
  })
})

describe('autor declarado (mesa LAN)', () => {
  it('sem a identidade do app = negado (nem o mestre no site declara)', () => {
    const campanha = mesa()
    for (const quem of [NAMI_NO_PC, MESTRE_NO_SITE]) {
      const declarada = op(quem, F_NAMI, HP, 'definir', { valor: 1, autorDeclarado: NAMI.contaId })
      expect(enviar(campanha, quem, [declarada]).respostas[0]).toMatchObject({ t: 'negado', motivo: 'sem-permissao' })
    }
    expect(campanha.todasAsOps()).toEqual([])
  })

  it('com o app: grava como do jogador, atestado pelo app, origem mesa', () => {
    const campanha = mesa()
    const daSala = op(MESTRE_NO_APP, F_NAMI, HP, 'definir', { valor: 280, autorDeclarado: NAMI.contaId })
    expect(enviar(campanha, MESTRE_NO_APP, [daSala]).respostas[0]).toMatchObject({ t: 'ack' })
    expect(campanha.todasAsOps()[0]).toMatchObject({ autorContaId: NAMI.contaId, autorNome: 'Nami', atestadoPeloApp: true, origem: 'mesa', autorDeclarado: NAMI.contaId })
  })

  it('declarar quem não está (ou saiu) da campanha = negado', () => {
    const campanha = mesa()
    for (const declarado of ['conta_inventada', USOPP_REMOVIDO.contaId]) {
      const declarada = op(MESTRE_NO_APP, F_NAMI, HP, 'definir', { valor: 1, autorDeclarado: declarado })
      expect(enviar(campanha, MESTRE_NO_APP, [declarada]).respostas[0]).toMatchObject({ t: 'negado', motivo: 'sem-permissao' })
    }
  })
})

describe('base e envelope', () => {
  it('baseRev acima da rev atual ou negativa = negado (base-invalida)', () => {
    const campanha = mesa()
    enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 1 })])
    for (const baseRev of [2, -1]) {
      expect(enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 2, baseRev })]).respostas[0]).toMatchObject({ t: 'negado', motivo: 'base-invalida' })
    }
    expect(enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 2, baseRev: 1 })]).respostas[0]).toMatchObject({ t: 'ack' })
  })

  it('op comum com "desfaz" é negada: só o pedido de desfazer monta a volta', () => {
    const campanha = mesa()
    const forjada = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 1, desfaz: 'op_qualquer' })
    expect(enviar(campanha, NAMI_NO_PC, [forjada]).respostas[0]).toMatchObject({ t: 'negado', motivo: 'fora-do-esquema' })
  })

  it('op negada vira só contador na cota de quem mandou', () => {
    const campanha = mesa()
    enviar(campanha, ZORO_NO_SITE, [op(ZORO_NO_SITE, F_NAMI, HP, 'definir', { valor: 1 }), op(ZORO_NO_SITE, F_NAMI, HP, 'definir', { valor: 2 })])
    expect(campanha.cota(chaveDaCotaDaConta('conta_zoro', AGORA))).toEqual({ ops: 0, bytes: 0, negadas: 2 })
  })
})

describe('cota e ritmo adiam, nunca negam', () => {
  function comCota(chave: string, cota: Cota) {
    const campanha = mesa()
    campanha.gravar({ ops: [], fichas: [], recusadas: [], cotas: [{ chave, cota }] })
    return campanha
  }

  it('cota do dia estourada = adiado até o dia seguinte; não é violação; no dia seguinte entra', () => {
    const campanha = comCota(chaveDaCotaDaConta(NAMI.contaId, AGORA), { ops: LIMITES.opsPorDiaDaConta, bytes: 0, negadas: 0 })
    const mudar = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 1 })
    const hoje = enviar(campanha, NAMI_NO_PC, [mudar])
    expect(hoje.respostas).toEqual([{ t: 'adiado', opId: mudar.opId, motivo: 'cota', tentarDepoisDe: inicioDoDiaSeguinte(AGORA) }])
    expect(hoje.violacoes).toBe(0)
    expect(campanha.todasAsOps()).toEqual([])
    // Reenviada com o MESMO opId quando a cota volta.
    expect(enviar(campanha, NAMI_NO_PC, [mudar], inicioDoDiaSeguinte(AGORA)).respostas).toEqual([{ t: 'ack', opId: mudar.opId, rev: 1 }])
  })

  it('bytes do dia estourados também adiam', () => {
    const campanha = comCota(chaveDaCotaDaConta(NAMI.contaId, AGORA), { ops: 0, bytes: LIMITES.bytesPorDiaDaConta, negadas: 0 })
    expect(enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 1 })]).respostas[0]).toMatchObject({ t: 'adiado', motivo: 'cota' })
  })

  it('o mestre não tem teto por conta, só o da campanha', () => {
    const contaCheia = comCota(chaveDaCotaDaConta('mestre', AGORA), { ops: LIMITES.opsPorDiaDaConta * 10, bytes: LIMITES.bytesPorDiaDaConta * 10, negadas: 0 })
    expect(enviar(contaCheia, MESTRE_NO_APP, [op(MESTRE_NO_APP, F_NAMI, HP, 'definir', { valor: 1 })]).respostas[0]).toMatchObject({ t: 'ack' })
    const campanhaCheia = comCota(chaveDaCotaDaCampanha(AGORA), { ops: LIMITES.opsPorDiaDaCampanha, bytes: 0, negadas: 0 })
    expect(enviar(campanhaCheia, MESTRE_NO_APP, [op(MESTRE_NO_APP, F_NAMI, HP, 'definir', { valor: 1 })]).respostas[0]).toMatchObject({ t: 'adiado', motivo: 'cota' })
  })

  it('cada op aceita conta na cota da conta e da campanha', () => {
    const campanha = mesa()
    enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 1 }), op(NAMI_NO_PC, F_NAMI, ['descricao'], 'definir', { valor: 'x' })])
    expect(campanha.cota(chaveDaCotaDaConta(NAMI.contaId, AGORA))).toMatchObject({ ops: 2, negadas: 0 })
    expect(campanha.cota(chaveDaCotaDaCampanha(AGORA))).toMatchObject({ ops: 2 })
  })

  it('ritmo: a rajada passa, o excesso adia cada op do frame com a hora de tentar de novo', () => {
    let paceAt: number | undefined
    for (let vez = 0; vez < 5; vez++) {
      const conferido = conferirRitmo(paceAt, AGORA)
      if (!conferido.ok) throw new Error(`a rajada de 5 devia passar (parou na ${vez + 1}ª)`)
      paceAt = conferido.paceAt
    }
    const sexto = conferirRitmo(paceAt, AGORA)
    expect(sexto).toMatchObject({ ok: false, motivo: 'ritmo' })
    if (sexto.ok) return
    expect(conferirRitmo(paceAt, sexto.tentarDepoisDe).ok).toBe(true)
    const mudar = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 1 })
    expect(respostasAdiadas([mudar, { semId: true }], 'ritmo', sexto.tentarDepoisDe)).toEqual([{ t: 'adiado', opId: mudar.opId, motivo: 'ritmo', tentarDepoisDe: sexto.tentarDepoisDe }])
  })
})
