/**
 * PASTA DENTRO DE PASTA (pedido de 17/11): a árvore em quantos níveis houver,
 * a conta com as de dentro e o mover que recusa o laço. Nomes inventados.
 */
import { describe, expect, it } from 'vitest'
import { arvoreDasPastas, contasComAsDeDentro, pastaEDeDentro, pastaMovida, pastasAcimaDe } from './pastasDeVerbetes'
import type { PastaDeVerbetes } from './tipos'

const pasta = (id: string, nome: string, paiId?: string): PastaDeVerbetes => (paiId === undefined ? { id, nome, tipo: 'personagem' } : { id, nome, tipo: 'personagem', paiId })

/** Frota > 2.Capitães > Navio > Cozinha (4 níveis), Bichos em cima e Pesca, uma pasta de itens. */
const PASTAS: readonly PastaDeVerbetes[] = [
  pasta('cozinha', 'Cozinha', 'navio'),
  pasta('frota', 'Frota'),
  pasta('navio', 'Navio', 'capitaes'),
  pasta('bichos', 'Bichos'),
  pasta('capitaes', '2.Capitães', 'frota'),
  pasta('almirantes', '1.Almirantes', 'frota'),
  { id: 'pesca', nome: 'Pesca', tipo: 'item' },
]

const linhas = (pastas: readonly PastaDeVerbetes[]) => arvoreDasPastas(pastas).map(({ pasta: uma, nivel }) => `${nivel}:${uma.nome}`)

describe('a árvore em quantos níveis houver', () => {
  it('desce até o 4º nível, cada nível por nome, e a pasta de pai apagado sobe', () => {
    const comOrfa = [...PASTAS.filter((uma) => uma.tipo === 'personagem'), pasta('orfa', 'Avulsa', 'apagada')]
    expect(linhas(comOrfa)).toEqual(['0:Avulsa', '0:Bichos', '0:Frota', '1:1.Almirantes', '1:2.Capitães', '2:Navio', '3:Cozinha'])
  })

  it('um laço gravado por fora não some: entra em cima pela primeira por nome', () => {
    expect(linhas([pasta('b', 'Beta', 'a'), pasta('a', 'Alfa', 'b')])).toEqual(['0:Alfa', '1:Beta'])
  })
})

describe('a conta e o filtro incluem as de dentro', () => {
  it('conta Cozinha em Navio, 2.Capitães e Frota; o filtro de Frota pega os 4 níveis', () => {
    const contas = contasComAsDeDentro(PASTAS, ['cozinha', 'cozinha', 'almirantes', 'bichos'])
    expect(Object.fromEntries(contas)).toEqual({ cozinha: 2, navio: 2, capitaes: 2, frota: 3, almirantes: 1, bichos: 1 })
    expect([...pastaEDeDentro(PASTAS, 'frota')].sort()).toEqual(['almirantes', 'capitaes', 'cozinha', 'frota', 'navio'])
    expect(pastasAcimaDe(PASTAS, 'cozinha').map((uma) => uma.nome)).toEqual(['Frota', '2.Capitães', 'Navio'])
  })
})

describe('mover a pasta', () => {
  it('põe dentro de outra (as de dentro vão junto) e tira para cima; guarda onde estava', () => {
    const dentro = pastaMovida(PASTAS, 'navio', 'bichos')
    expect(dentro.t === 'movida' && dentro.paiAntes).toBe('capitaes')
    if (dentro.t !== 'movida') return
    expect(linhas(dentro.pastas.filter((uma) => uma.tipo === 'personagem'))).toEqual(['0:Bichos', '1:Navio', '2:Cozinha', '0:Frota', '1:1.Almirantes', '1:2.Capitães'])
    const emCima = pastaMovida(dentro.pastas, 'navio', null)
    expect(emCima.t === 'movida' && emCima.pastas.find((uma) => uma.id === 'navio')).toEqual({ id: 'navio', nome: 'Navio', tipo: 'personagem' })
  })

  it('recusa o laço, outro tipo, o mesmo lugar e pasta que não existe', () => {
    const recusa = (id: string, paiId: string | null) => {
      const feito = pastaMovida(PASTAS, id, paiId)
      return feito.t === 'recusada' ? feito.recusa : 'movida'
    }
    expect(recusa('frota', 'frota')).toBe('ela-mesma')
    expect(recusa('frota', 'cozinha')).toBe('dentro-dela')
    expect(recusa('capitaes', 'pesca')).toBe('outro-tipo')
    expect(recusa('navio', 'capitaes')).toBe('ja-esta')
    expect(recusa('bichos', null)).toBe('ja-esta')
    expect(recusa('fantasma', null)).toBe('nao-existe')
    expect(recusa('cozinha', 'frota')).toBe('movida')
  })
})
