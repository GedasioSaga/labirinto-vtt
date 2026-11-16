import { describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import { LUGARES_DE_MATERIAL } from '../texturas/meioTermo/materiais'
import { criarMovel, mobiliaParaJogador } from './mobilia'
import { abrivelParaJogador, lerConteudoDoArquivo, mobiliaDoConteudo, objetoAberto, objetoReposto, propComConteudoDoArquivo } from './conteudoDoObjeto'

const GRADE = 50

/** O barril do mestre: girado, com as duas cores (madeira e aros) e umas moedas dentro. */
function barril(extra: Partial<Prop> = {}): Prop {
  return {
    ...criarMovel('barril', { x: 130, y: 90 }, GRADE, 'b1'),
    rotation: 90,
    mobiliaCor: '#5a3b22',
    mobiliaCorDaLinha: '#8a8f96',
    conteudo: { itens: [], moedas: 12, armadilha: null },
    ...extra,
  }
}

describe('o barril quebrado no minigame (16/11/2026)', () => {
  it('vira o barril quebrado do catálogo no mesmo centro, 1 casa, com giro e cores; o "Fechar e repor" devolve o barril exato', () => {
    const inteiro = barril()
    expect([inteiro.width, inteiro.height]).toEqual([35, 35])
    const quebrado = objetoAberto(inteiro, 'Diego', 1000)
    expect(quebrado).toEqual({
      ...inteiro,
      mobilia: 'barrilQuebrado',
      width: 50,
      height: 50,
      conteudo: { itens: [], moedas: 12, armadilha: null, aberto: { por: 'Diego', em: 1000, quebradoDe: 'barril', pegadaDeAntes: { width: 35, height: 35 } } },
    })
    // Os materiais saem das cores pelos lugares do tipo: os do barril quebrado são os do barril (madeira e aros).
    expect(LUGARES_DE_MATERIAL.barrilQuebrado).toEqual(LUGARES_DE_MATERIAL.barril)
    expect(mobiliaDoConteudo(quebrado)).toBe('barril')
    expect(objetoReposto(quebrado)).toEqual(inteiro)
  })

  it('o barril esticado pelo mestre quebra esticado igual, e o repor devolve o tamanho dele', () => {
    const esticado = barril({ width: 70, height: 35 })
    const quebrado = objetoAberto(esticado, 'Ana', 5)
    expect([quebrado.x, quebrado.y, quebrado.width, quebrado.height]).toEqual([130, 90, 100, 50])
    expect(objetoReposto(quebrado)).toEqual(esticado)
  })

  it('a caixa continua virando os destroços de madeira, do tamanho dela', () => {
    const caixa: Prop = { ...criarMovel('caixa', { x: 40, y: 40 }, GRADE, 'c1'), conteudo: { itens: [], moedas: 0, armadilha: null } }
    const quebrada = objetoAberto(caixa, 'Ana', 5)
    expect([quebrada.mobilia, quebrada.x, quebrada.y, quebrada.width, quebrada.height]).toEqual(['destrocosDeMadeira', 40, 40, 40, 40])
    expect(objetoReposto(quebrada)).toEqual(caixa)
  })

  it('o mapa antigo, com o barril quebrado em destroços de madeira, ainda guarda o conteúdo e repõe o barril', () => {
    const antigo: Prop = {
      ...barril(),
      mobilia: 'destrocosDeMadeira',
      conteudo: { itens: [], moedas: 12, armadilha: null, aberto: { por: 'Ana', em: 5, quebradoDe: 'barril' } },
    }
    const lido = propComConteudoDoArquivo(JSON.parse(JSON.stringify(antigo)) as Prop)
    expect(lido.conteudo).toEqual(antigo.conteudo)
    expect(mobiliaDoConteudo(lido)).toBe('barril')
    expect(objetoReposto(lido)).toEqual(barril())
  })

  it('o disco guarda o tamanho de antes só nos destroços, e só se for um tamanho', () => {
    const aberto = { por: 'Ana', em: 5, quebradoDe: 'barril', pegadaDeAntes: { width: 35, height: 35 } }
    expect(lerConteudoDoArquivo({ aberto }, 'barrilQuebrado')?.aberto).toEqual(aberto)
    expect(lerConteudoDoArquivo({ aberto: { ...aberto, pegadaDeAntes: { width: -1, height: '35' } } }, 'barrilQuebrado')?.aberto).toEqual({ por: 'Ana', em: 5, quebradoDe: 'barril' })
    // O barril de pé não está quebrado: o tipo e o tamanho de antes somem.
    expect(lerConteudoDoArquivo({ aberto }, 'barril')?.aberto).toEqual({ por: 'Ana', em: 5 })
    // O barril quebrado posto pelo mestre (sem "quebradoDe") não guarda nada.
    expect(lerConteudoDoArquivo({ aberto: { por: 'Ana', em: 5 } }, 'barrilQuebrado')).toBeUndefined()
  })

  it('o jogador recebe o barril quebrado, aberto, com as cores', () => {
    const quebrado = objetoAberto(barril(), 'Diego', 1000)
    expect(abrivelParaJogador(quebrado)).toBe('aberto')
    expect(mobiliaParaJogador(quebrado)).toMatchObject({ mobilia: 'barrilQuebrado', mobiliaCor: '#5a3b22', mobiliaCorDaLinha: '#8a8f96' })
  })
})
