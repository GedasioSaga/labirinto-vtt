import { describe, expect, it } from 'vitest'
import { danoPorVezDoSelo, porVezDoSelo } from '../condicoes'
import { ficha, sistema } from '../fichasDaFatiaB.testkit'
import { linhaDasPecas } from './leitura'
import { lerMecanica, type MecanicaV1 } from './modelo'
import { frasesDoSelo, resumoDaMecanica } from './resumo'

/**
 * Construtor de mecânicas, fatia C5 (selos vivos): a peça `selo` com o "tira
 * X por vez" e a duração "até o próximo golpe", lida, traduzida para o selo
 * do golpe e descrita em frases pela regra do nome (`condicoes.ts`). Dados
 * inventados; no máximo 2 testes por situação.
 */

function comSelo(selo: unknown): unknown {
  return {
    versao: 1,
    acao: 'simples',
    custos: [],
    alvo: { quem: 'inimigos', forma: { tipo: 'um' } },
    teste: { tipo: 'naoErra' },
    efeitos: [selo],
  }
}

function pecas(valor: unknown): MecanicaV1 {
  const lida = lerMecanica(valor)
  if (lida.tipo !== 'pecas') throw new Error(`a peça não leu: ${JSON.stringify(lida)}`)
  return lida.mecanica
}

describe('a peça selo da C5', () => {
  it('lê o "tira X por vez" e o "até o próximo golpe", leva ao selo do golpe e recusa o que o Aplicar não faz', () => {
    const veneno = pecas(comSelo({ tipo: 'selo', nome: 'Veneno', duracao: 'proximoGolpe', natureza: 'debuff', porTurno: { recurso: 'hp', quanto: { fixo: 15 }, direto: true } }))
    expect(linhaDasPecas('Mordida Venenosa', veneno).selo).toEqual({ nome: 'Veneno', turnos: null, natureza: 'debuff', porVez: 15, saiNoProximoGolpe: true })
    // Fora da tabela, o selo montado tira pelo dele; o selo sem `porVez` e fora da tabela continua sem tirar.
    // Rework das condições (D3): o Envenenado virou de fábrica (tira 3 por vez); "Veneno" segue fora dela.
    expect(porVezDoSelo({ nome: 'Veneno', porVez: 15 })).toEqual({ nome: 'Veneno', dano: 15 })
    expect(danoPorVezDoSelo({ nome: 'Veneno' })).toBeNull()

    const sangra = pecas(comSelo({ tipo: 'selo', nome: 'Sangrando', duracao: 3 }))
    expect(linhaDasPecas('Corte Fundo', sangra).selo).toEqual({ nome: 'Sangrando', turnos: 3 })

    expect(lerMecanica(comSelo({ tipo: 'selo', nome: 'Veneno', duracao: 2, porTurno: { recurso: 'sp', quanto: { fixo: 5 }, direto: true } })).tipo).toBe('invalida')
    expect(lerMecanica(comSelo({ tipo: 'selo', nome: 'Veneno', duracao: 2, porTurno: { recurso: 'hp', quanto: { formula: 'Força' }, direto: true } })).tipo).toBe('invalida')
    expect(lerMecanica(comSelo({ tipo: 'selo', nome: 'Veneno', duracao: 'fimDaLuta' })).tipo).toBe('invalida')
  })

  it('o resumo diz o que o selo faz pela regra do nome, com a contagem na vez do alvo', () => {
    const lutador = { personagem: ficha('Lutador de Teste', { forca: 10 }, { hp: 100, sp: 10, escudo: 0 }, {}), sistema }
    // Rework das condições (E1): o Aéreo de fábrica dura 1 turno e renova ao acertar de novo (o padrão dos turnos da fábrica).
    expect(frasesDoSelo({ nome: 'Aéreo' })).toEqual(['não pode esquivar nem contra-atacar', 'acertar de novo renova a duração'])
    expect(frasesDoSelo({ nome: 'Cego' }, lutador)[0]).toMatch(/ fica em 0$/)
    expect(frasesDoSelo({ nome: 'Queimando', porTurno: { recurso: 'hp', quanto: { fixo: 20 }, direto: true } })).toEqual([
      'perde 20 de HP no começo de cada vez dele, direto, quando o mestre clica Aplicar',
      'acertar de novo renova a duração',
    ])
    expect(frasesDoSelo({ nome: 'Selo da Lua' })).toEqual([])
    const resumo = resumoDaMecanica(pecas(comSelo({ tipo: 'selo', nome: 'Sangrando', duracao: 3 })))
    expect(resumo).toContain('Se acertar: Sangrando por 3 vezes do alvo (perde 10 de HP no começo de cada vez dele, direto, quando o mestre clica Aplicar).')
  })
})
