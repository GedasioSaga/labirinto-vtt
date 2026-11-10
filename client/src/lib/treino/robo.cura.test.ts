// @vitest-environment node
/**
 * FASE FINAL da unificação do combate (10/11/2026), risco 1: o robô do treino
 * passou a curar (R2). Aqui, com fichas inventadas: ele USA a cura por peças
 * no colega ferido, dentro do limite de usos, e a luta continua acabando com
 * vencedor e igual na mesma semente; e a cura que não devolve vida que pague
 * o golpe (grátis, sem limite, +1 de HP) não toma o lugar do ataque: antes do
 * conserto o lado dele caía de 73 para 6 vitórias em 100 lutas.
 */
import { describe, expect, it } from 'vitest'
import { ficha } from '../batalha/fichasDaFatiaB.testkit'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from './fichasDeTreino.testkit'
import { lutaAutomatica, type ResumoDaLuta } from './lutaAutomatica'

const SEMENTE = 7
const USOS_DO_SOPRO = 3

function cartao(id: string, nome: string, campos: Record<string, string>): CartaoDaFicha {
  return { id, nome, campos, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

/** A cura por peças: Espírito (50) de HP num aliado, 30 SP, 3 usos por batalha, na Ação Simples. */
const SOPRO: CartaoDaFicha = {
  ...cartao('cart_sopro', 'Sopro Morno', { dano: '', acao: 'Ação Simples', tipo: 'Buff' }),
  mecanica: {
    versao: 1,
    limite: { usosPorBatalha: USOS_DO_SOPRO },
    teste: { tipo: 'reacao' },
    efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { formula: 'Espírito' }, emQuem: 'alvo' }],
    acao: 'simples',
    custos: [{ recurso: 'sp', quanto: { fixo: 30 }, quando: 'aoUsar' }],
    alvo: { quem: 'aliados', forma: { tipo: 'um' } },
  },
}
/** A cura que nunca resolve: de graça, sem limite, 1 de HP, e custa o golpe da vez. */
const GOTA: CartaoDaFicha = {
  ...cartao('cart_gota', 'Gota', { dano: '', acao: 'Ação Simples', tipo: 'Buff' }),
  mecanica: {
    versao: 1,
    limite: {},
    teste: { tipo: 'reacao' },
    efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { fixo: 1 }, emQuem: 'alvo' }],
    acao: 'simples',
    custos: [],
    alvo: { quem: 'aliados', forma: { tipo: 'um' } },
  },
}
const ESTOCADA = cartao('cart_estocada', 'Estocada', { acao: 'Simples', custo: '20 SP', tempo: '2', dano: 'Força + 40' })
const FACA = cartao('arma_faca', 'Faca', { dano: '20' })
const MACHADO = cartao('arma_machado', 'Machado', { dano: '40' })

function curandeira(tecnicas: CartaoDaFicha[]): Personagem {
  return ficha('Curandeira de Teste', { forca: 60, espirito: 50, agilidade: 90 }, { hp: 400, sp: 120, escudo: 0 }, { habilidades: tecnicas, armas: [FACA] })
}

/** O colega que já chega ferido: `hp` de `maximo`. */
function escudeiro(hp: number, maximo: number): Personagem {
  const inteiro = ficha('Escudeiro de Teste', { forca: 40, agilidade: 10 }, { hp: maximo, sp: 0, escudo: 0 }, { armas: [FACA] })
  return { ...inteiro, recursos: { ...inteiro.recursos, hp } }
}

function rival(): Personagem {
  return ficha('Rival de Teste', { forca: 50, agilidade: 40 }, { hp: 500, sp: 60, escudo: 0 }, { armas: [MACHADO] })
}

function luta(tecnicas: CartaoDaFicha[], colega: Personagem): ResumoDaLuta {
  const lutadores = lutadoresDe([
    { ficha: curandeira(tecnicas), lado: 'a' },
    { ficha: colega, lado: 'a' },
    { ficha: rival(), lado: 'b' },
  ])
  return lutaAutomatica({ sistema: SISTEMA_DO_TESTE, lutadores, semente: SEMENTE })
}

function linhasCom(resumo: ResumoDaLuta, palavra: string): number {
  return resumo.registro.filter((linha) => linha.includes(palavra)).length
}

describe('robô do treino: a cura', () => {
  it('com a cura por peças e o colega em 120 de 400, usa a cura (no limite de usos), a luta tem vencedor e a mesma semente dá a mesma luta', () => {
    const resumo = luta([SOPRO, ESTOCADA], escudeiro(120, 400))
    const usos = linhasCom(resumo, 'Sopro Morno')
    expect(usos, resumo.registro.join('\n')).toBeGreaterThanOrEqual(1)
    expect(usos).toBeLessThanOrEqual(USOS_DO_SOPRO)
    expect(linhasCom(resumo, 'curou')).toBe(usos)
    expect(resumo.fim.tipo, `acabou em ${JSON.stringify(resumo.fim)} na rodada ${resumo.rodada}`).toBe('vitoria')
    expect(luta([SOPRO, ESTOCADA], escudeiro(120, 400))).toEqual(resumo)
  })

  it('a cura de 1 de HP, grátis e sem limite, não toma o golpe: o colega em 100 de 5000 fica sem ela e a luta sai igual à da ficha sem a cura', () => {
    const comGota = luta([GOTA, ESTOCADA], escudeiro(100, 5000))
    expect(linhasCom(comGota, 'Gota'), comGota.registro.join('\n')).toBe(0)
    expect(comGota.fim.tipo).toBe('vitoria')
    const semGota = luta([ESTOCADA], escudeiro(100, 5000))
    expect({ fim: comGota.fim, rodada: comGota.rodada, passos: comGota.passos, d20: comGota.d20 }).toEqual({ fim: semGota.fim, rodada: semGota.rodada, passos: semGota.passos, d20: semGota.d20 })
  })
})
