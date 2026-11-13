/**
 * "Tamanho da ficha ao entrar" com o número DIGITADO (pedido do mestre de
 * 12/11/2026: "eu quero dizer o quanto tem que mudar"): a cena aceita 0,5 e
 * 1,5, não só os botões 1, 2 e 3, e a ficha que chega fica centrada na casa,
 * sem pular. A ponta a ponta (passagem, escada, Reunir…) está em
 * `stores/tamanhoDaFichaAoEntrar.test.ts`; aqui só a regra.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { comTamanhoAoEntrar, fichaQueEntra, lerTamanhoAoEntrar, tamanhoAoEntrar } from './tamanhoAoEntrar'

const GRADE = 50

/** A parte da cena que a chegada lê. */
type Destino = Pick<MapData, 'tamanhoDaFichaAoEntrar' | 'grid' | 'gridShape'>

function ficha(size: number, x: number, y: number): Token {
  return { id: 'ana', characterId: null, name: 'Ana', x, y, size, image: null }
}

describe('o padrão da cena aceita o número digitado', () => {
  it('0,5, 1,5 e 4 valem; 10 vira 6 e 0,1 vira 0,25; texto, zero, negativo e NaN são "Não mudar"; gravar o mesmo número não cria passo', () => {
    expect([0.5, 1.5, 4].map(lerTamanhoAoEntrar)).toEqual([0.5, 1.5, 4])
    expect(lerTamanhoAoEntrar(10)).toBe(6)
    expect(lerTamanhoAoEntrar(0.1)).toBe(0.25)
    for (const torto of ['2', 0, -2, Number.NaN, undefined, null]) expect(lerTamanhoAoEntrar(torto), String(torto)).toBeUndefined()

    const vila = createEmptyMap('m1', 'Vila', 10, 10, GRADE)
    const comMeia = comTamanhoAoEntrar(vila, 0.5)
    expect(comMeia.tamanhoDaFichaAoEntrar).toBe(0.5)
    expect(comTamanhoAoEntrar(comMeia, 0.5)).toBe(comMeia)
    expect(tamanhoAoEntrar(comMeia, ficha(3, 0, 0))).toBe(0.5)
    expect('tamanhoDaFichaAoEntrar' in comTamanhoAoEntrar(comMeia, undefined)).toBe(false)
  })

  it('a ficha que entra com 0,5 ou 1,5 fica NO MEIO DA CASA: a de 2 casas (na linha da grade) desce ao centro da casa; a de 1 casa não sai do lugar', () => {
    const cidade: Destino = { tamanhoDaFichaAoEntrar: 0.5, grid: GRADE, gridShape: 'square' }
    // Ficha de 2 casas assentada na linha (100, 100): com meia casa, o centro vai ao meio de uma casa.
    const grande = fichaQueEntra(cidade, ficha(2, 100, 100))
    expect([grande.size, grande.x, grande.y]).toEqual([0.5, 125, 125])

    const vila: Destino = { tamanhoDaFichaAoEntrar: 1.5, grid: GRADE, gridShape: 'square' }
    // Ficha de 1 casa já no meio da casa (125, 175): cresce para 1,5 em volta de onde está, sem pular.
    const media = fichaQueEntra(vila, ficha(1, 125, 175))
    expect([media.size, media.x, media.y]).toEqual([1.5, 125, 175])
    // De novo no mesmo padrão: o MESMO objeto, nada a mexer.
    expect(fichaQueEntra(vila, media)).toBe(media)
  })
})
