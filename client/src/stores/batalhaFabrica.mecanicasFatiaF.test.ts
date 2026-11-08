// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F2, fatia F (Harvey Solferino e Siegfried): as
 * mecânicas feitas à mão na store do app (`criarBatalhaStore`) sobre a mesa em
 * memória do treino, com os cartões e os números REAIS
 * (`fichasDaFatiaF.testkit.ts`). Piratas sem Escudo no lado B. Lei:
 * docs/auditoria-fichas/respostas-do-grilling.md. No máximo 2 testes por
 * situação.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao, PedidoDeAlvo } from '../lib/batalha/combate'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import { BALMUNG, CHAMAS, ENTARDECER, FLORESCER, GILGAMESH, GOLPE_BAIXO, GRAM, harveyCom, KIT_MEDICO, LUA, MEDICINA, ORQUIDEA, siegCom, YAMATO } from '../lib/batalha/fichasDaFatiaF.testkit'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const ATRIBUTOS_DO_PIRATA = { forca: 10, agilidade: 10, percepcao: 10, resistencia: 10, intuicao: 10, espirito: 10, carisma: 10, determinacao: 10 }
const pirata = (nome: string): Personagem => ficha(nome, ATRIBUTOS_DO_PIRATA, { hp: 500, sp: 50, escudo: 0 }, {})

function batalha(heroi: Personagem, piratas = 1): { loja: LojaDaBatalha; mesa: MesaEmMemoria; fila: number[] } {
  const fila: number[] = []
  const lado = Array.from({ length: piratas }, (_, indice) => ({ ficha: pirata(`Pirata ${indice + 1}`), lado: 'b' as const }))
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: heroi, lado: 'a' }, ...lado]))
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

/** Passa a vez até chegar a de `nome`; `passarAntes` = passa a de agora primeiro (a próxima vez dele). */
function naVezDe(loja: LojaDaBatalha, nome: string, passarAntes = false): VezEsperada {
  for (let i = 0; i < 8; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.vez === null) throw new Error('sem vez')
    const vez = { cartaId: turnos.vez, rodada: turnos.rodada }
    if (!(passarAntes && i === 0) && turnos.cartas.find((carta) => carta.id === turnos.vez)?.nome === nome) return vez
    expect(loja.getState().passarVez(CENA, MESTRE, vez)).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

function token(loja: LojaDaBatalha, nome: string): string {
  const achada = cena(loja).turnos.cartas.find((carta) => carta.nome === nome)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada.tokenId
}

function recursos(mesa: MesaEmMemoria, nome: string): { hp: number; sp: number } {
  const achada = mesa.personagens().find((candidato) => candidato.nome === nome)
  if (achada === undefined) throw new Error(`sem ${nome}`)
  return { hp: numeroDaFicha(achada.recursos, 'hp'), sp: numeroDaFicha(achada.recursos, 'sp') }
}

function tecnica(cartaoId: string, alvos: PedidoDeAlvo[], surpresa = false): Extract<PedidoDeAcao, { tipo: 'habilidade' }> {
  return { tipo: 'habilidade', cartaoId, armaId: null, alvos, surpresa, perfurante: false, custo: null, acao: null }
}

const textos = (loja: LojaDaBatalha): string[] => cena(loja).registro.map((linha) => linha.texto)
const selosDe = (loja: LojaDaBatalha, tokenId: string): string[] => (cena(loja).turnos.selos ?? []).filter((selo) => selo.tokenId === tokenId).map((selo) => selo.nome)
const danosQueChegam = (loja: LojaDaBatalha): (number | null)[] => (cena(loja).turnos.golpes?.[0]?.alvos ?? []).map((alvo) => alvo.dano)

/** O alvo do golpe esperando não reage (toma inteiro, sem o d20 da reação). */
function tomar(loja: LojaDaBatalha, tokenId: string): void {
  const golpe = cena(loja).turnos.golpes?.[0]
  if (golpe === undefined) return
  expect(loja.getState().reagir(CENA, MESTRE, { tipo: 'naoReagir', golpeId: golpe.id, tokenId })).toBe(true)
}

describe('Medicina do Harvey', () => {
  it('cura 100 nele sem reação e gasta o Kit Médico; sem kit sobrando, a 2ª é recusada', () => {
    const { loja, mesa } = batalha(harveyCom({ hp: 500, sp: 60, escudo: 40 }))
    const vez = naVezDe(loja, 'Harvey Solferino')
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(MEDICINA.id, [{ tokenId: token(loja, 'Harvey Solferino'), dano: null }]))).toBe(true)
    expect(cena(loja).turnos.golpes ?? []).toEqual([])
    expect(recursos(mesa, 'Harvey Solferino').hp).toBe(600)
    expect(textos(loja).some((texto) => texto.includes('curou 100, gastou 1 Kit Médico'))).toBe(true)
    const outra = naVezDe(loja, 'Harvey Solferino', true)
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, outra, tecnica(MEDICINA.id, [{ tokenId: token(loja, 'Harvey Solferino'), dano: null }]))).toBe('Sem Kit Médico na mochila (cada uso gasta 1)')
  })

  it('3 Kits Médicos empilhados numa vaga só: depois do 1º uso a Medicina continua valendo', () => {
    const { loja } = batalha(harveyCom({ hp: 500, sp: 60, escudo: 40 }, [{ ...KIT_MEDICO, quantidade: 3 }]))
    const noHarvey = (): Extract<PedidoDeAcao, { tipo: 'habilidade' }> => tecnica(MEDICINA.id, [{ tokenId: token(loja, 'Harvey Solferino'), dano: null }])
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Harvey Solferino'), noHarvey())).toBe(true)
    const outra = naVezDe(loja, 'Harvey Solferino', true)
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, outra, noHarvey())).toBeNull()
    expect(loja.getState().agir(CENA, MESTRE, outra, noHarvey())).toBe(true)
  })
})

describe('Golpe Baixo do Harvey', () => {
  it('o Harvey ganha +8 em reação por 2 turnos ao usar; o pirata que toma fica Cego', () => {
    const { loja } = batalha(harveyCom())
    const pirata1 = token(loja, 'Pirata 1')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Harvey Solferino'), { ...tecnica(GOLPE_BAIXO.id, [{ tokenId: pirata1, dano: 0 }]), selo: { nome: 'Cego', turnos: 2 } })).toBe(true)
    const doHarvey = (cena(loja).turnos.selos ?? []).find((selo) => selo.tokenId === token(loja, 'Harvey Solferino'))
    expect(doHarvey).toMatchObject({ nome: 'Golpe Baixo: +8 em reação', turnos: 2 })
    tomar(loja, pirata1)
    expect(selosDe(loja, pirata1)).toContain('Cego')
  })
})

describe('Lua Incandescente do Siegfried', () => {
  it('71 em 3 piratas chega 23 em cada; 4 alvos é recusado', () => {
    const { loja } = batalha(siegCom(), 3)
    const vez = naVezDe(loja, 'Siegfried')
    const piratas = ['Pirata 1', 'Pirata 2', 'Pirata 3'].map((nome) => ({ tokenId: token(loja, nome), dano: 71 }))
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez, tecnica(LUA.id, [...piratas, { tokenId: token(loja, 'Siegfried'), dano: 71 }]))).toBe('Balmung: Lua Incandescente acerta no máximo 3 alvos (o dano é dividido)')
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(LUA.id, piratas))).toBe(true)
    expect(danosQueChegam(loja)).toEqual([23, 23, 23])
  })
})

describe('Orquídea e Florescer do Siegfried', () => {
  it('a Florescer é recusada sem a redoma; a Orquídea não dá dano e põe a redoma', () => {
    const { loja } = batalha(siegCom(), 2)
    const vez = naVezDe(loja, 'Siegfried')
    const pirata1 = token(loja, 'Pirata 1')
    expect(loja.getState().motivoDoAgir(CENA, MESTRE, vez, tecnica(FLORESCER.id, [{ tokenId: pirata1, dano: 302 }], true))).toBe('A Florescer só vale em quem está na redoma da Orquídea')
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(ORQUIDEA.id, [{ tokenId: pirata1, dano: null }]))).toBe(true)
    expect(danosQueChegam(loja)).toEqual([null])
    tomar(loja, pirata1)
    expect(selosDe(loja, pirata1)).toContain('Redoma da Orquídea')
  })

  it('logo depois da Orquídea, a Florescer sai como Livre, sem concentração: 302 × 1,5 da Surpresa = 453, e a redoma sai', () => {
    const { loja, mesa } = batalha(siegCom(), 1)
    const vez = naVezDe(loja, 'Siegfried')
    const pirata1 = token(loja, 'Pirata 1')
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(ORQUIDEA.id, [{ tokenId: pirata1, dano: null }]))).toBe(true)
    tomar(loja, pirata1)
    expect(loja.getState().agir(CENA, MESTRE, vez, tecnica(FLORESCER.id, [{ tokenId: pirata1, dano: 302 }], true))).toBe(true)
    // Surpresa: o pirata não reage, o golpe resolve na hora (500 - 453).
    expect(recursos(mesa, 'Pirata 1').hp).toBe(47)
    expect(selosDe(loja, pirata1)).not.toContain('Redoma da Orquídea')
  })
})

describe('Chamas Celestes e Doença das Trevas do Siegfried', () => {
  it('custa 90 de HP; no fim da vez do pirata: pirata -15 SP, Sieg +10 SP e -27 HP (e -27 da Doença no fim da vez em que agiu)', () => {
    const { loja, mesa } = batalha(siegCom({ hp: 900, sp: 100, escudo: 80 }))
    const pirata1 = token(loja, 'Pirata 1')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Siegfried'), tecnica(CHAMAS.id, [{ tokenId: pirata1, dano: null }]))).toBe(true)
    expect(recursos(mesa, 'Siegfried').hp).toBe(810)
    tomar(loja, pirata1)
    expect(selosDe(loja, pirata1)).toContain('Chamas Celestes')
    naVezDe(loja, 'Pirata 1')
    expect(recursos(mesa, 'Siegfried').hp).toBe(783)
    naVezDe(loja, 'Siegfried')
    expect(recursos(mesa, 'Pirata 1').sp).toBe(35)
    expect(recursos(mesa, 'Siegfried').hp).toBe(756)
    expect(textos(loja)).toContain('Fim da vez: Chamas Celestes em Pirata 1: -15 SP; Siegfried +10 SP, -27 HP')
  })

  it('a Doença tira 27 também na vez em que ele só usa a Florescer (ação livre, a Orquídea foi na vez anterior)', () => {
    const { loja, mesa } = batalha(siegCom())
    const pirata1 = token(loja, 'Pirata 1')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Siegfried'), tecnica(ORQUIDEA.id, [{ tokenId: pirata1, dano: null }]))).toBe(true)
    tomar(loja, pirata1)
    naVezDe(loja, 'Pirata 1')
    expect(recursos(mesa, 'Siegfried').hp).toBe(873)
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Siegfried'), tecnica(FLORESCER.id, [{ tokenId: pirata1, dano: 302 }], true))).toBe(true)
    naVezDe(loja, 'Pirata 1')
    expect(recursos(mesa, 'Siegfried').hp).toBe(846)
  })

  it('a Doença não tira nada quando ele só passa a vez', () => {
    const { loja, mesa } = batalha(siegCom())
    naVezDe(loja, 'Siegfried')
    naVezDe(loja, 'Pirata 1')
    expect(recursos(mesa, 'Siegfried').hp).toBe(900)
  })
})

describe('Entardecer do Siegfried (RES contra 12) e as 3 armas', () => {
  it('pirata tira 1 no d20: Atordoado; noutra luta tira 20: sem selo', () => {
    for (const [d20, atordoa] of [[1, true], [20, false]] as const) {
      const { loja, fila } = batalha(siegCom())
      const pirata1 = token(loja, 'Pirata 1')
      expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Siegfried'), tecnica(ENTARDECER.id, [{ tokenId: pirata1, dano: 104 }]))).toBe(true)
      fila.push(d20)
      tomar(loja, pirata1)
      expect(selosDe(loja, pirata1).includes('Atordoado')).toBe(atordoa)
    }
  })

  it('levar 4 armas é recusado; 3 armas valem', () => {
    const { loja, mesa } = batalha(siegCom())
    const sieg = mesa.personagens().find((candidato) => candidato.nome === 'Siegfried')?.id ?? ''
    expect(loja.getState().escolherArmas(CENA, MESTRE, sieg, [BALMUNG.id, GRAM.id, GILGAMESH.id, YAMATO.id])).toBe(false)
    expect(loja.getState().escolherArmas(CENA, MESTRE, sieg, [BALMUNG.id, GRAM.id, GILGAMESH.id])).toBe(true)
  })
})
