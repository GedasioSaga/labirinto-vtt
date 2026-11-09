// @vitest-environment node
/**
 * Construtor de mecânicas, fatia C5 (selos vivos): o selo da técnica montada
 * conta na vez de quem o tem (a regra do sistema) e, quando tira por vez, pede
 * o Aplicar do mestre no começo de cada vez dele, direto no HP. Dados
 * inventados; no máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import type { VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_do_teste'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }

function cartao(id: string, nome: string, selo: unknown): CartaoDaFicha {
  return {
    id,
    nome,
    campos: {},
    extras: [],
    atributos: [],
    imagem: null,
    modificadores: [],
    subcartoes: [],
    mecanica: { versao: 1, acao: 'simples', custos: [], alvo: { quem: 'inimigos', forma: { tipo: 'um' } }, teste: { tipo: 'naoErra' }, efeitos: [selo] },
  }
}

/** "Sangramento 10×3": o Sangrando da regra tira 10 por vez. */
const CORTE = cartao('cart_corte_fundo', 'Corte Fundo', { tipo: 'selo', nome: 'Sangrando', duracao: 3, natureza: 'debuff' })
/** Veneno de NPC (fora da tabela): 15 por vez, até o próximo golpe. */
const MORDIDA = cartao('cart_mordida_venenosa', 'Mordida Venenosa', { tipo: 'selo', nome: 'Veneno', duracao: 'proximoGolpe', natureza: 'debuff', porTurno: { recurso: 'hp', quanto: { fixo: 15 }, direto: true } })

const aranha: Personagem = { ...ficha('Aranha de Teste', { forca: 30 }, { hp: 500, sp: 100, escudo: 0 }, { habilidades: [CORTE, MORDIDA] }), tipo: 'npc' }
const marujo: Personagem = ficha('Marujo de Teste', { resistencia: 30 }, { hp: 500, sp: 100, escudo: 40 }, {})

function batalha(): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: aranha, lado: 'a' }, { ficha: marujo, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((item) => item.id))), regras: null, desempate: 'd20' })
  return { loja, mesa }
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

function cartaDoMarujo(loja: LojaDaBatalha): { tokenId: string; personagemId: string } {
  const achada = cena(loja).turnos.cartas.find((carta) => carta.nome === 'Marujo de Teste')
  if (achada === undefined || achada.personagemId === null) throw new Error('sem a carta do Marujo')
  return { tokenId: achada.tokenId, personagemId: achada.personagemId }
}

function usar(loja: LojaDaBatalha, pedido: PedidoDeAcao): boolean {
  return loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Aranha de Teste'), pedido)
}

const tecnica = (loja: LojaDaBatalha, cartaoId: string): PedidoDeAcao => ({ tipo: 'habilidade', cartaoId, armaId: null, alvos: [{ tokenId: cartaDoMarujo(loja).tokenId, dano: null }], surpresa: false, perfurante: false, custo: null, acao: null })
const recursoDoMarujo = (mesa: MesaEmMemoria, recurso: 'hp' | 'escudo'): number => numeroDaFicha(mesa.personagens().find((item) => item.nome === 'Marujo de Teste')?.recursos ?? {}, recurso)
const selosNoMarujo = (loja: LojaDaBatalha): string[] => (cena(loja).turnos.selos ?? []).filter((selo) => selo.tokenId === cartaDoMarujo(loja).tokenId).map((selo) => `${selo.nome} ${selo.turnos ?? ''}`.trim())
const ultimaLinha = (loja: LojaDaBatalha): string => cena(loja).registro[cena(loja).registro.length - 1]?.texto ?? ''

/** Na vez do Marujo: o lembrete do selo que tira por vez, ou `null`. */
function lembreteNaVezDoMarujo(loja: LojaDaBatalha): string | null {
  naVezDe(loja, 'Marujo de Teste')
  const { personagemId } = cartaDoMarujo(loja)
  return (cena(loja).turnos.combate?.[personagemId]?.lembretes ?? []).find((lembrete) => lembrete.chave.endsWith(':sangra'))?.cartaoId ?? null
}

function aplicar(loja: LojaDaBatalha, cartaoId: string): void {
  expect(loja.getState().passiva(CENA, MESTRE, { tipo: 'lembrete', tokenId: cartaDoMarujo(loja).tokenId, cartaoId, aplicar: true })).toBe(true)
}

describe('Sangramento 10×3 montado', () => {
  it('pede o Aplicar nas 3 vezes do Marujo, cada uma -10 direto no HP (o Escudo fica), e some no fim da 3ª', () => {
    const { loja, mesa } = batalha()
    expect(usar(loja, tecnica(loja, CORTE.id))).toBe(true)
    expect(selosNoMarujo(loja)).toEqual(['Sangrando 3'])
    for (const [vez, hp] of [[1, 490], [2, 480], [3, 470]] as const) {
      const lembrete = lembreteNaVezDoMarujo(loja)
      if (lembrete === null) throw new Error(`a ${vez}ª vez do Marujo não pediu o Aplicar`)
      aplicar(loja, lembrete)
      expect([recursoDoMarujo(mesa, 'hp'), recursoDoMarujo(mesa, 'escudo')]).toEqual([hp, 40])
      expect(ultimaLinha(loja)).toContain('sangra: -10 HP (direto, sem o Escudo)')
      expect(loja.getState().passarVez(CENA, MESTRE, naVezDe(loja, 'Marujo de Teste'))).toBe(true)
    }
    expect(selosNoMarujo(loja)).toEqual([])
    expect(lembreteNaVezDoMarujo(loja)).toBeNull()
  })
})

describe('veneno de NPC montado, até o próximo golpe', () => {
  it('tira 15 por vez com "sofre com Veneno" e sai quando o próximo golpe chega no Marujo', () => {
    const { loja, mesa } = batalha()
    expect(usar(loja, tecnica(loja, MORDIDA.id))).toBe(true)
    expect(selosNoMarujo(loja)).toEqual(['Veneno'])
    const lembrete = lembreteNaVezDoMarujo(loja)
    if (lembrete === null) throw new Error('o Veneno não pediu o Aplicar')
    aplicar(loja, lembrete)
    expect(recursoDoMarujo(mesa, 'hp')).toBe(485)
    expect(ultimaLinha(loja)).toContain('sofre com Veneno: -15 HP (direto, sem o Escudo)')
    // O selo sem turnos não desce no fim da vez dele; sai com o golpe seguinte (aqui, um Atacar).
    expect(loja.getState().passarVez(CENA, MESTRE, naVezDe(loja, 'Marujo de Teste'))).toBe(true)
    expect(selosNoMarujo(loja)).toEqual(['Veneno'])
    expect(usar(loja, { tipo: 'atacar', armaId: null, alvos: [{ tokenId: cartaDoMarujo(loja).tokenId, dano: 30 }], surpresa: false, perfurante: false })).toBe(true)
    expect(selosNoMarujo(loja)).toEqual([])
  })
})
