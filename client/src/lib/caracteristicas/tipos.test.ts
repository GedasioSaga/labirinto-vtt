import { describe, expect, it } from 'vitest'
import { personagemDoArquivo } from '../personagem'
import { lerCaracteristicas, temCegueira } from './tipos'

describe('características da ficha no disco', () => {
  it('volta igual pelo leitor da ficha, com o padrão do que falta', () => {
    const ficha = personagemDoArquivo({
      id: 'pers_aira',
      tipo: 'jogador',
      nome: 'Aira',
      caracteristicas: [
        { tipo: 'companion', id: 'c1', nome: 'Lovecats', limite: 3, ligados: [{ personagemId: 'pers_mimi', modo: 'luta', nivel: 3 }, { personagemId: 'pers_bolota' }], ultimaEscolha: ['pers_mimi', 'pers_fora'] },
        { tipo: 'cegueira', id: 'c2' },
      ],
    })
    expect(ficha?.caracteristicas).toEqual([
      { tipo: 'companion', id: 'c1', nome: 'Lovecats', limite: 3, ligados: [{ personagemId: 'pers_mimi', modo: 'luta', nivel: 3 }, { personagemId: 'pers_bolota', modo: 'luta', nivel: 1 }], ultimaEscolha: ['pers_mimi'] },
      { tipo: 'cegueira', id: 'c2' },
    ])
    expect(temCegueira(ficha?.caracteristicas)).toBe(true)
  })

  it('lixo, tipo desconhecido e Cegueira repetida saem; ficha sem nada não ganha a chave', () => {
    expect(lerCaracteristicas([null, { tipo: 'voar', id: 'x' }, { tipo: 'cegueira', id: 'a' }, { tipo: 'cegueira', id: 'b' }, { tipo: 'companion', id: 'a' }])).toEqual([{ tipo: 'cegueira', id: 'a' }])
    expect(lerCaracteristicas('nada')).toBeUndefined()
    const semNada = personagemDoArquivo({ id: 'pers_x', nome: 'X' })
    expect(semNada !== null && 'caracteristicas' in semNada).toBe(false)
    expect(temCegueira(undefined)).toBe(false)
  })
})
