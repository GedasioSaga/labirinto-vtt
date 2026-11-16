/**
 * A FICHA MÍNIMA EM QUALQUER SISTEMA (pedido de 16/11/2026, E3 "Virar NPC"):
 * antes ela só enchia a vida com o recurso `hp` e o golpe na aba
 * `habilidades`, e no Dragon Ball saía vazia. Agora acha o recurso de vida e
 * o lugar das técnicas de cada sistema.
 */
import { describe, expect, it } from 'vitest'
import { SISTEMA_DRAGON_BALL } from '../dbt/sistemaDragonBall'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { fichaMinima, FICHA_MINIMA_HP, NOME_DO_GOLPE_MINIMO } from './combate'

describe('fichaMinima', () => {
  it('no Dragon Ball tem PV 300/300 fixado no bloco de NPC e o Golpe de 80 na ficha estruturada', () => {
    const ficha = fichaMinima(SISTEMA_DRAGON_BALL, 'Kuro')
    expect(ficha.tipo).toBe('npc')
    expect(ficha.recursos.pv).toBe(FICHA_MINIMA_HP)
    expect(ficha.maximos.pv).toBe(FICHA_MINIMA_HP)
    expect(ficha.dbt?.ajustes.pvMax).toBe(FICHA_MINIMA_HP)
    expect(ficha.dbt?.npc).toMatchObject({ nd: null, categoria: 'comum' })
    expect(ficha.dbt?.tecnicas).toHaveLength(1)
    expect(ficha.dbt?.tecnicas[0]).toMatchObject({ nome: NOME_DO_GOLPE_MINIMO, ativa: true, efeitoDaFaixa: 'dano', danoManual: { completo: 80 } })
  })

  it('num sistema do mestre acha a vida pelo tom e a aba do golpe pelo rótulo "Dano"', () => {
    const sistema: SistemaDeRpg = {
      formato: 1,
      id: 'meu',
      nome: 'Meu sistema',
      versao: '1',
      descricao: '',
      cor: '#336699',
      atributos: [],
      escolhas: [],
      recursos: [
        { id: 'escudo', nome: 'Escudo', tom: 'neutro' },
        { id: 'vigor', nome: 'Vigor', tom: 'vida', atualEMaximo: true },
      ],
      abas: [
        { id: 'notas', nome: 'Notas', item: 'Nota', vazio: '', campos: [{ id: 'texto', rotulo: 'Texto', forma: 'paragrafo' }] },
        { id: 'poderes', nome: 'Poderes', item: 'Poder', vazio: '', campos: [{ id: 'p_dano', rotulo: 'Dano', forma: 'linha' }] },
      ],
    }
    const ficha = fichaMinima(sistema, 'Kuro')
    expect(ficha.recursos.vigor).toBe(FICHA_MINIMA_HP)
    expect(ficha.maximos).toEqual({ vigor: FICHA_MINIMA_HP })
    expect(ficha.abas.poderes).toHaveLength(1)
    expect(ficha.abas.poderes?.[0]).toMatchObject({ nome: NOME_DO_GOLPE_MINIMO, campos: { p_dano: '80' } })
    expect(ficha.abas.notas).toEqual([])
  })
})
