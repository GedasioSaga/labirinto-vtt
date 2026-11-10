// @vitest-environment node
/**
 * FECHAMENTO de 10/11/2026 (o robô e o buff só de rótulo): a ajuda que deixa um
 * selo sem número nem regra (o "Fortalecido" de uma técnica montada: só o nome
 * na ficha) gastava o golpe do robô e o SP da técnica dele, e o lado caía de
 * 96 para 81 vitórias em 100 lutas (semente 7). Com fichas inventadas: ele
 * não usa essa ajuda quando tem golpe para dar, e a série sai igual à da ficha
 * sem ela; a ajuda que soma número (o Buff de "+20 de Força") continua saindo.
 */
import { describe, expect, it } from 'vitest'
import { ficha } from '../batalha/fichasDaFatiaB.testkit'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { rodarSerie, type PedidoDaSerie } from './cemLutas'
import { lutadoresDe, SISTEMA_DO_TESTE } from './fichasDeTreino.testkit'
import { lutaAutomatica } from './lutaAutomatica'

const SEMENTE = 7
/** As 100 lutas rodam 3 vezes aqui: o teto só evita reprovar pela máquina (o tempo é medido no grupo 'desempenho'). */
const TETO_DO_TESTE_MS = 30_000

function cartao(id: string, nome: string, campos: Record<string, string>): CartaoDaFicha {
  return { id, nome, campos, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

/** O buff por peças só de rótulo: 20 SP, Ação Simples, o selo "Fortalecido" por 2 turnos num aliado, sem número nenhum. */
const GRITO: CartaoDaFicha = {
  ...cartao('cart_grito', 'Grito de Guerra', { dano: '', acao: 'Ação Simples', tipo: 'Buff' }),
  mecanica: {
    versao: 1,
    limite: {},
    teste: { tipo: 'reacao' },
    efeitos: [{ tipo: 'selo', nome: 'Fortalecido', duracao: 2, natureza: 'buff' }],
    acao: 'simples',
    custos: [{ recurso: 'sp', quanto: { fixo: 20 }, quando: 'aoUsar' }],
    alvo: { quem: 'aliados', forma: { tipo: 'um' } },
  },
}
/** O buff de texto que soma número: o selo dele dá +20 de Força por 2 turnos. */
const FURIA = cartao('cart_furia', 'Fúria', { dano: '-', acao: 'Ação Simples', tipo: 'Buff', custo: '10 SP', efeito: 'Ganha +20 de Força por 2 turnos' })
const ESTOCADA = cartao('cart_estocada', 'Estocada', { acao: 'Simples', custo: '20 SP', tempo: '2', dano: 'Força + 40' })
const FACA = cartao('arma_faca', 'Faca', { dano: '20' })
const MACHADO = cartao('arma_machado', 'Machado', { dano: '40' })

function curandeira(tecnicas: CartaoDaFicha[]): Personagem {
  return ficha('Curandeira de Teste', { forca: 60, espirito: 50, agilidade: 90 }, { hp: 400, sp: 120, escudo: 0 }, { habilidades: tecnicas, armas: [FACA] })
}

/** A Curandeira e o Escudeiro inteiro contra o Rival. */
function pedido(tecnicas: CartaoDaFicha[]): PedidoDaSerie {
  const lutadores = lutadoresDe([
    { ficha: curandeira(tecnicas), lado: 'a' },
    { ficha: ficha('Escudeiro de Teste', { forca: 40, agilidade: 10 }, { hp: 400, sp: 0, escudo: 0 }, { armas: [FACA] }), lado: 'a' },
    { ficha: ficha('Rival de Teste', { forca: 50, agilidade: 40 }, { hp: 500, sp: 60, escudo: 0 }, { armas: [MACHADO] }), lado: 'b' },
  ])
  return { sistema: SISTEMA_DO_TESTE, lutadores, semente: SEMENTE }
}

function linhasCom(registro: readonly string[], palavra: string): number {
  return registro.filter((linha) => linha.includes(palavra)).length
}

describe('robô do treino: a ajuda só de rótulo', () => {
  it('o selo sem número não toma o golpe: as 100 lutas dão as mesmas vitórias da ficha sem ele, e a mesma semente dá a mesma série', { timeout: TETO_DO_TESTE_MS }, () => {
    const semGrito = rodarSerie(pedido([ESTOCADA]))
    const comGrito = rodarSerie(pedido([GRITO, ESTOCADA]))
    expect({ vitorias: comGrito.vitorias, empates: comGrito.empates }, `sem o Grito: ${JSON.stringify(semGrito.vitorias)}`).toEqual({ vitorias: semGrito.vitorias, empates: semGrito.empates })
    expect(rodarSerie(pedido([GRITO, ESTOCADA]))).toEqual(comGrito)
    const { registro } = lutaAutomatica(pedido([GRITO, ESTOCADA]))
    expect(linhasCom(registro, GRITO.nome), registro.join('\n')).toBe(0)
  })

  it('a ajuda que soma número continua saindo: o Buff de "+20 de Força" abre a luta', () => {
    const { registro } = lutaAutomatica(pedido([FURIA, ESTOCADA]))
    expect(linhasCom(registro, FURIA.nome), registro.join('\n')).toBeGreaterThanOrEqual(1)
  })
})
