// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F2, fatia D (Vagn Kane e Guilherme): as mecânicas à
 * mão na store do app (`criarBatalhaStore`) sobre a mesa em memória do
 * treino, com os cartões e os números REAIS (`fichasDaFatiaD.testkit.ts`).
 * Guilherme no lado A, o Vagn no B. Lei:
 * docs/auditoria-fichas/respostas-do-grilling.md. No máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao, PedidoDeAlvo, PedidoDePassiva } from '../lib/batalha/combate'
import { ARMADURA, CAMPO, EXPLOSAO, GIRO, guilherme, REVIGORAR, vagnCom } from '../lib/batalha/fichasDaFatiaD.testkit'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

function batalha(): { loja: LojaDaBatalha; mesa: MesaEmMemoria; fila: number[] } {
  const fila: number[] = []
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: guilherme, lado: 'a' }, { ficha: vagnCom(), lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => fila.shift() ?? 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return { loja, mesa, fila }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 4; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.vez === null) throw new Error('sem vez')
    const vez = { cartaId: turnos.vez, rodada: turnos.rodada }
    if (turnos.cartas.find((carta) => carta.id === turnos.vez)?.nome === nome) return vez
    expect(loja.getState().passarVez(CENA, MESTRE, vez)).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

function token(loja: LojaDaBatalha, nome: string): string {
  const achada = cena(loja).turnos.cartas.find((carta) => carta.nome === nome)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada.tokenId
}

function recursos(mesa: MesaEmMemoria, nome: string): { hp: number; sp: number; escudo: number } {
  const achada = mesa.personagens().find((candidato) => candidato.nome === nome)
  if (achada === undefined) throw new Error(`sem ${nome}`)
  return { hp: numeroDaFicha(achada.recursos, 'hp'), sp: numeroDaFicha(achada.recursos, 'sp'), escudo: numeroDaFicha(achada.recursos, 'escudo') }
}

function tecnica(cartaoId: string, alvos: PedidoDeAlvo[]): PedidoDeAcao {
  return { tipo: 'habilidade', cartaoId, armaId: null, alvos, surpresa: false, perfurante: false, custo: null, acao: null }
}

const textos = (loja: LojaDaBatalha): string[] => cena(loja).registro.map((linha) => linha.texto)

describe('Explosão do Guilherme no Vagn (RES 50, mod +1, contra CD 11)', () => {
  it('o Vagn tira 5 (6): falhou, 10% da vida atual (1000 → 100) direto no HP; o Guilherme paga 40 SP', () => {
    const { loja, mesa, fila } = batalha()
    const doVagn = token(loja, 'Vagn Kane')
    fila.push(5)
    // O dano da mira (0) não vale: o host calcula pela vida do alvo.
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Guilherme'), tecnica(EXPLOSAO.id, [{ tokenId: doVagn, dano: 0 }]))).toBe(true)
    expect(recursos(mesa, 'Vagn Kane')).toMatchObject({ hp: 900, escudo: 100 })
    expect(recursos(mesa, 'Guilherme').sp).toBe(25)
    expect(cena(loja).turnos.golpes ?? []).toEqual([])
    expect(textos(loja).some((texto) => texto.includes('contra CD 11') && texto.includes('pegou'))).toBe(true)
  })

  it('o Vagn tira 10 (11): passou, nada acontece e a Explosão não gasta (SP 65, 0 de 2 usos)', () => {
    const { loja, mesa, fila } = batalha()
    const doVagn = token(loja, 'Vagn Kane')
    fila.push(10)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Guilherme'), tecnica(EXPLOSAO.id, [{ tokenId: doVagn, dano: 0 }]))).toBe(true)
    expect(recursos(mesa, 'Vagn Kane')).toMatchObject({ hp: 1000, escudo: 100 })
    expect(recursos(mesa, 'Guilherme').sp).toBe(65)
    expect(cena(loja).turnos.combate?.[guilherme.id]?.usos[EXPLOSAO.id] ?? 0).toBe(0)
    expect(textos(loja).some((texto) => texto.includes('não gastou'))).toBe(true)
  })
})

describe('Armadura Humana do Vagn contra o Atacar do Guilherme (110)', () => {
  it('Atacar: o Vagn toma os 110 (Escudo 100 e HP 10) e devolve 15 (110 ÷ 7) no Guilherme, sem reação', () => {
    const { loja, mesa } = batalha()
    const doVagn = token(loja, 'Vagn Kane')
    const ataque: PedidoDeAcao = { tipo: 'atacar', armaId: null, alvos: [{ tokenId: doVagn, dano: 110 }], surpresa: false, perfurante: false }
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Guilherme'), ataque)).toBe(true)
    const golpeId = cena(loja).turnos.golpes?.[0]?.id ?? ''
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'tecnica', golpeId, tokenId: doVagn, cartaoId: ARMADURA.id, saida: 'contra', custo: null })).toBe(true)
    expect(recursos(mesa, 'Vagn Kane')).toMatchObject({ hp: 990, escudo: 0, sp: 95 })
    expect(recursos(mesa, 'Guilherme').escudo).toBe(65)
    expect(cena(loja).turnos.contras ?? []).toEqual([])
    expect(textos(loja).some((texto) => texto.includes('devolveu 15'))).toBe(true)
  })
})

/** Passa a vez de agora e espera a de `nome` de novo. */
function proximaVezDe(loja: LojaDaBatalha, nome: string, agora: VezEsperada): VezEsperada {
  expect(loja.getState().passarVez(CENA, MESTRE, agora)).toBe(true)
  return naVezDe(loja, nome)
}

const combateDe = (loja: LojaDaBatalha, personagemId: string) => cena(loja).turnos.combate?.[personagemId]
const idDe = (mesa: MesaEmMemoria, nome: string): string => mesa.personagens().find((candidato) => candidato.nome === nome)?.id ?? ''
const lembrete = (cartaoId: string, aplicar: boolean, tokenId: string): PedidoDePassiva => ({ tipo: 'lembrete', tokenId, cartaoId, aplicar })

describe('Giro da Lança mantido (revisão da fatia D)', () => {
  it('anula com o Giro na reação (d20 9 + 1): fica ligado, sem recarga; na vez dele o lembrete cobra 30 SP para manter', () => {
    const { loja, mesa, fila } = batalha()
    const doGui = token(loja, 'Guilherme')
    const ataque: PedidoDeAcao = { tipo: 'atacar', armaId: null, alvos: [{ tokenId: doGui, dano: 50 }], surpresa: false, perfurante: false }
    const vezDoVagn = naVezDe(loja, 'Vagn Kane')
    expect(loja.getState().agir(CENA, MESTRE, vezDoVagn, ataque)).toBe(true)
    fila.push(9)
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'tecnica', golpeId: cena(loja).turnos.golpes?.[0]?.id ?? '', tokenId: doGui, cartaoId: GIRO.id, saida: 'rolar', custo: null })).toBe(true)
    expect(combateDe(loja, idDe(mesa, 'Guilherme'))).toMatchObject({ mantidas: [GIRO.id] })
    expect(combateDe(loja, idDe(mesa, 'Guilherme'))?.recargas[GIRO.id]).toBeUndefined()
    expect(recursos(mesa, 'Guilherme')).toMatchObject({ hp: 900, escudo: 80, sp: 35 })
    proximaVezDe(loja, 'Guilherme', vezDoVagn)
    expect(combateDe(loja, idDe(mesa, 'Guilherme'))?.lembretes?.some((esperando) => esperando.chave === `${GIRO.id}:custo`)).toBe(true)
    expect(loja.getState().passiva(CENA, MESTRE, lembrete(GIRO.id, true, doGui))).toBe(true)
    expect(recursos(mesa, 'Guilherme').sp).toBe(5)
    expect(combateDe(loja, idDe(mesa, 'Guilherme'))).toMatchObject({ mantidas: [GIRO.id] })
    expect(textos(loja).some((texto) => texto.includes('mantém Giro da Lança (paga 30'))).toBe(true)
  })

  it('Parar no lembrete: o Giro desliga e a recarga 3 começa (a técnica fica travada nesta vez)', () => {
    const { loja, mesa } = batalha()
    const doGui = token(loja, 'Guilherme')
    const vez = naVezDe(loja, 'Guilherme')
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(GIRO.id, [{ tokenId: token(loja, 'Vagn Kane'), dano: 130 }]))).toBe(true)
    expect(combateDe(loja, idDe(mesa, 'Guilherme'))?.recargas[GIRO.id]).toBeUndefined()
    const outra = proximaVezDe(loja, 'Guilherme', vez)
    expect(loja.getState().passiva(CENA, MESTRE, lembrete(GIRO.id, false, doGui))).toBe(true)
    expect(combateDe(loja, idDe(mesa, 'Guilherme'))?.mantidas).toBeUndefined()
    expect(combateDe(loja, idDe(mesa, 'Guilherme'))?.recargas[GIRO.id]).toBe(3)
    expect(textos(loja).some((texto) => texto.includes('parou Giro da Lança (recarga 3)'))).toBe(true)
    expect(loja.getState().agir(CENA, MESTRE, outra, tecnica(GIRO.id, [{ tokenId: token(loja, 'Vagn Kane'), dano: 130 }]))).toBe(false)
  })
})

describe('Campo de Contenção mantido (revisão da fatia D)', () => {
  it('usar com Concentração 1 não gasta a carga e prende o marcado; Manter cobra 15 SP e sobe a Concentração para 2', () => {
    const { loja, mesa } = batalha()
    const doVagn = token(loja, 'Vagn Kane')
    const primeira = naVezDe(loja, 'Vagn Kane')
    expect(loja.getState().agir(CENA, MESTRE, primeira, { tipo: 'concentrar' })).toBe(true)
    const segunda = proximaVezDe(loja, 'Vagn Kane', primeira)
    expect(loja.getState().agir(CENA, MESTRE, segunda, tecnica(CAMPO.id, [{ tokenId: token(loja, 'Guilherme'), dano: null }]))).toBe(true)
    expect(combateDe(loja, idDe(mesa, 'Vagn Kane'))).toMatchObject({ carga: 1, mantidas: [CAMPO.id] })
    expect(cena(loja).turnos.selos?.find((selo) => selo.tokenId === token(loja, 'Guilherme'))?.nome).toBe('Preso no Campo de Contenção')
    proximaVezDe(loja, 'Vagn Kane', segunda)
    const antes = recursos(mesa, 'Vagn Kane').sp
    expect(loja.getState().passiva(CENA, MESTRE, lembrete(CAMPO.id, true, doVagn))).toBe(true)
    expect(recursos(mesa, 'Vagn Kane').sp).toBe(antes - 15)
    expect(combateDe(loja, idDe(mesa, 'Vagn Kane'))).toMatchObject({ carga: 2, mantidas: [CAMPO.id] })
  })

  it('o Guilherme preso reage com desvantagem sozinho (15 e 4: fica 4, toma cheio); Parar solta ele e começa a recarga 2', () => {
    const { loja, mesa, fila } = batalha()
    const doGui = token(loja, 'Guilherme')
    const doVagn = token(loja, 'Vagn Kane')
    const vez = naVezDe(loja, 'Vagn Kane')
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(CAMPO.id, [{ tokenId: doGui, dano: null }]))).toBe(true)
    const outra = proximaVezDe(loja, 'Vagn Kane', vez)
    const ataque: PedidoDeAcao = { tipo: 'atacar', armaId: null, alvos: [{ tokenId: doGui, dano: 50 }], surpresa: false, perfurante: false }
    expect(loja.getState().agir(CENA, MESTRE, outra, ataque)).toBe(true)
    fila.push(15, 4)
    const golpeId = cena(loja).turnos.golpes?.find((golpe) => golpe.alvos.some((alvo) => alvo.tokenId === doGui && alvo.danoFinal === undefined))?.id ?? ''
    expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'rolar', golpeId, tokenId: doGui, modificador: 0 })).toBe(true)
    const rolagem = cena(loja).turnos.golpes?.find((golpe) => golpe.id === golpeId)?.alvos[0]?.rolagem
    expect(rolagem).toMatchObject({ d20: 4, vantagem: { modo: 'desvantagem', outro: 15 } })
    expect(loja.getState().passiva(CENA, MESTRE, lembrete(CAMPO.id, false, doVagn))).toBe(true)
    expect(cena(loja).turnos.selos?.some((selo) => selo.tokenId === doGui) ?? false).toBe(false)
    expect(combateDe(loja, idDe(mesa, 'Vagn Kane'))?.recargas[CAMPO.id]).toBe(2)
  })
})

describe('Revigorar do Guilherme', () => {
  it('com Concentração 3 (o extra da ficha: Espírito × 3): cura 300 (900 → 1100) e gasta as 3 cargas', () => {
    const { loja, mesa } = batalha()
    let vez = naVezDe(loja, 'Guilherme')
    for (let carga = 1; carga <= 3; carga += 1) {
      expect(loja.getState().agir(CENA, MESTRE, vez, { tipo: 'concentrar' })).toBe(true)
      if (carga < 3) vez = proximaVezDe(loja, 'Guilherme', vez)
    }
    expect(combateDe(loja, idDe(mesa, 'Guilherme'))?.carga).toBe(3)
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(REVIGORAR.id, [{ tokenId: token(loja, 'Guilherme'), dano: null }]))).toBe(true)
    expect(recursos(mesa, 'Guilherme').hp).toBe(1100)
    expect(combateDe(loja, idDe(mesa, 'Guilherme'))?.carga).toBe(0)
    expect(textos(loja).some((texto) => texto.includes('curou 300'))).toBe(true)
  })

  it('nele: cura o Espírito (900 → 1000, máximo 1100); no Vagn (inimigo) é recusado', () => {
    const { loja, mesa } = batalha()
    const vez = naVezDe(loja, 'Guilherme')
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(REVIGORAR.id, [{ tokenId: token(loja, 'Vagn Kane'), dano: null }]))).toBe(false)
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(REVIGORAR.id, [{ tokenId: token(loja, 'Guilherme'), dano: null }]))).toBe(true)
    expect(recursos(mesa, 'Guilherme')).toMatchObject({ hp: 1000, sp: 15 })
    expect(textos(loja).some((texto) => texto.includes('tirou 0 debuffs, curou 100'))).toBe(true)
  })
})
