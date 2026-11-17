/**
 * "MOVER PARA…" E O DESFAZER DO LUGAR (17/11: sub-cenário fácil como no
 * Grimório): a lista de destinos tem todos os lugares, com o caminho, sem o que
 * faria laço; e o Desfazer devolve o lugar de cima como estava, inclusive o que
 * a Lixeira guardava. Tudo inventado (repositório público).
 */
import { describe, expect, it } from 'vitest'
import { verbeteNovo } from './enciclopedia'
import { planoDeMandarParaALixeira } from './lixeira'
import { comPai, comPaiDeAntes, destinosParaMover, organizarLugares, paiDeAntes } from './lugaresEmRegioes'
import type { Verbete } from './tipos'

function lugar(id: string, titulo: string, paiId?: string): Verbete {
  return verbeteNovo('lugar', titulo, { campanhas: ['camp-inventada'], ...(paiId === undefined ? {} : { paiId }) }, () => id)
}

function mapa(...lista: Verbete[]): Map<string, Verbete> {
  return new Map(lista.map((um) => [um.id, um]))
}

/** Reino da Maré > Castelo > Torre do Sino; Vila do Farol e Gruta Funda soltas (nenhuma tem lugar dentro). */
function mundo(): Map<string, Verbete> {
  return mapa(lugar('reino', 'Reino da Maré'), lugar('castelo', 'Castelo', 'reino'), lugar('torre', 'Torre do Sino', 'castelo'), lugar('vila', 'Vila do Farol'), lugar('gruta', 'Gruta Funda'))
}

describe('mover para: os destinos', () => {
  it('lista todos os lugares com o caminho, inclusive os que ainda não têm nada dentro, e marca onde o lugar já está', () => {
    const verbetes = mundo()
    const destinos = destinosParaMover(['torre'], organizarLugares([...verbetes.values()]), verbetes)

    expect(destinos.map((destino) => destino.id).sort()).toEqual(['castelo', 'gruta', 'reino', 'vila'])
    expect(destinos.find((destino) => destino.id === 'castelo')).toEqual({ id: 'castelo', nome: 'Castelo', caminho: 'Reino da Maré', jaEstaAqui: true })
    expect(destinos.find((destino) => destino.id === 'gruta')).toEqual({ id: 'gruta', nome: 'Gruta Funda', caminho: '', jaEstaAqui: false })
  })

  it('não oferece o próprio lugar nem o que está dentro dele (faria laço), e a busca acha por palavras sem acento, no nome ou no caminho', () => {
    const verbetes = mundo()
    const organizados = organizarLugares([...verbetes.values()])

    expect(destinosParaMover(['reino'], organizados, verbetes).map((destino) => destino.id).sort()).toEqual(['gruta', 'vila'])
    expect(destinosParaMover(['vila'], organizados, verbetes, new Map(), 'mare cast').map((destino) => destino.id)).toEqual(['castelo', 'torre'])
    expect(destinosParaMover(['vila'], organizados, verbetes, new Map(), 'nada disso')).toEqual([])
  })
})

describe('desfazer a mudança de lugar', () => {
  it('devolve o lugar de cima de antes, e tira o que a mudança pôs', () => {
    const torre = mundo().get('torre')
    if (torre === undefined) throw new Error('a Torre faz parte do mundo inventado')
    const movida = comPai(torre, 'vila')

    expect(movida.paiId).toBe('vila')
    expect(comPaiDeAntes(movida, paiDeAntes(torre))).toEqual(torre)
    expect(comPaiDeAntes(comPai(torre, null), paiDeAntes(torre))).toEqual(torre)
  })

  it('devolve também o lugar de cima que estava guardado pela Lixeira', () => {
    const antes = mundo()
    const semCastelo = new Map([...antes, ...planoDeMandarParaALixeira(['castelo'], antes, '2026-11-17T18:00:00.000Z').mudancas])
    const torre = semCastelo.get('torre')
    if (torre === undefined) throw new Error('a Torre faz parte do mundo inventado')
    // O Castelo foi para a Lixeira: a Torre subiu para o Reino e lembra do Castelo.
    expect(paiDeAntes(torre)).toEqual({ paiId: 'reino', paiNaLixeira: 'castelo' })

    const movida = comPai(torre, 'vila')
    expect(movida.paiNaLixeira).toBeUndefined()
    expect(comPaiDeAntes(movida, paiDeAntes(torre))).toEqual(torre)
  })
})
