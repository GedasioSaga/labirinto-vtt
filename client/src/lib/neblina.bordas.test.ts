import { describe, expect, it } from 'vitest'
import type { PinceladaDeNeblina } from '../types/map'
import { createEmptyMap } from './mapFactory'
import {
  caixaDaNeblinaPintada,
  comNeblina,
  comNeblinaPintada,
  densidadeDaPincelada,
  densidadeDoMapaInteiro,
  dividirPincelada,
  intensidadeDoMapaInteiro,
  lerNeblina,
  lerNeblinaPintada,
  neblinaParaJogador,
  PINCELADAS_MAX,
  PONTOS_MAX,
  somarPinceladaDeNeblina,
  temNeblina,
} from './neblina'

/** As bordas da neblina que o neblina.test.ts não pisa: o ponto exato do teto, o zero, o arquivo torto e a borracha sozinha. */

function traco(id: string, tipo: PinceladaDeNeblina['tipo'], pontos: number, extra: Partial<PinceladaDeNeblina> = {}): PinceladaDeNeblina {
  return { id, tipo, forca: 0.6, raio: 10, pontos: Array.from({ length: pontos }, (_, i) => ({ x: i, y: 0 })), ...extra }
}

describe('neblina: densidade e intensidade nos extremos', () => {
  it('densidade 0 é zero de verdade (não cai na padrão por ser falsy)', () => {
    expect(densidadeDoMapaInteiro({ neblina: { ligada: true, intensidade: 40, densidade: 0 } })).toBe(0)
    expect(densidadeDaPincelada({ densidade: 0 })).toBe(0)
  })

  it('densidade e intensidade negativas ficam presas em 0; acima de 100 (ou de 1 no pincel), no teto', () => {
    expect(densidadeDoMapaInteiro({ neblina: { ligada: true, intensidade: 40, densidade: -20 } })).toBe(0)
    expect(densidadeDoMapaInteiro({ neblina: { ligada: true, intensidade: 40, densidade: 400 } })).toBe(1)
    expect(intensidadeDoMapaInteiro({ neblina: { ligada: true, intensidade: -5 } })).toBe(0)
    expect(intensidadeDoMapaInteiro({ neblina: { ligada: true, intensidade: 1000 } })).toBe(1)
    expect(densidadeDaPincelada({ densidade: 7 })).toBe(1)
    expect(densidadeDaPincelada({ densidade: -1 })).toBe(0)
  })

  it('chave desligada não cobre nada, mesmo em 100', () => {
    expect(intensidadeDoMapaInteiro({ neblina: { ligada: false, intensidade: 100 } })).toBe(0)
  })

  it('chave ligada em 0 e só borracha pintada: não há neblina para desenhar', () => {
    expect(temNeblina({ neblina: { ligada: true, intensidade: 0 }, neblinaPintada: [traco('b', 'borracha', 3)] })).toBe(false)
  })

  it('comNeblina arredonda e prende antes de gravar (o slider pode mandar 40.6 ou 120)', () => {
    const mapa = createEmptyMap('m', 'M', 10, 10, 50)
    expect(comNeblina(mapa, { ligada: true, intensidade: 40.6, densidade: 120 }).neblina).toEqual({ ligada: true, intensidade: 41, densidade: 100 })
  })

  it('comNeblina sem densidade guarda a que o mapa já tinha, não volta para a padrão', () => {
    const mapa = { ...createEmptyMap('m', 'M', 10, 10, 50), neblina: { ligada: true, intensidade: 40, densidade: 10 } }
    expect(comNeblina(mapa, { ligada: false, intensidade: 40 }).neblina).toEqual({ ligada: false, intensidade: 40, densidade: 10 })
  })
})

describe('neblina: o teto exato de pontos e de pinceladas', () => {
  it('PONTOS_MAX pontos é um pedaço só; um a mais vira dois que dividem o ponto da emenda', () => {
    expect(dividirPincelada(traco('a', 'pincel', PONTOS_MAX))).toHaveLength(1)
    const pedacos = dividirPincelada(traco('b', 'pincel', PONTOS_MAX + 1))
    expect(pedacos.map((p) => p.pontos.length)).toEqual([PONTOS_MAX, 2])
    expect(pedacos[1]?.pontos[0]).toEqual(pedacos[0]?.pontos.at(-1))
    // Ids diferentes por pedaço: o desfazer e o fio não confundem um com o outro.
    expect(new Set(pedacos.map((p) => p.id)).size).toBe(2)
  })

  it('o último lugar livre do mapa aceita a pincelada; o seguinte já é cheio', () => {
    const doPiso = [traco('a', 'pincel', 2)]
    expect(somarPinceladaDeNeblina(doPiso, traco('b', 'pincel', 2), PINCELADAS_MAX - 1).resultado).toBe('ok')
    expect(somarPinceladaDeNeblina(doPiso, traco('c', 'pincel', 2), PINCELADAS_MAX).resultado).toBe('cheio')
  })

  it('pincelada sem ponto não entra (vazio), nem no mapa cheio vira "cheio"', () => {
    const r = somarPinceladaDeNeblina([], traco('v', 'pincel', 0), PINCELADAS_MAX)
    expect(r.resultado).toBe('vazio')
    expect(r.lista).toEqual([])
  })

  it('borracha no piso só com borracha é sem-neblina, e a lista fica a mesma', () => {
    const doPiso = [traco('b1', 'borracha', 2)]
    const r = somarPinceladaDeNeblina(doPiso, traco('b2', 'borracha', 2))
    expect(r).toEqual({ lista: doPiso, resultado: 'sem-neblina' })
  })

  it('lista vazia tira o campo do mapa; o mapa sem o campo volta o mesmo objeto', () => {
    const mapa = createEmptyMap('m', 'M', 10, 10, 50)
    expect(comNeblinaPintada(mapa, [])).toBe(mapa)
    const comLista = comNeblinaPintada(mapa, [traco('a', 'pincel', 2)])
    expect('neblinaPintada' in comNeblinaPintada(comLista, [])).toBe(false)
  })
})

describe('neblina: arquivo torto', () => {
  it('lerNeblina recusa null, array, ligada em texto e intensidade não finita', () => {
    expect(lerNeblina(null)).toBeUndefined()
    expect(lerNeblina([])).toBeUndefined()
    expect(lerNeblina({ ligada: 'true', intensidade: 40 })).toBeUndefined()
    expect(lerNeblina({ ligada: true, intensidade: Number.NaN })).toBeUndefined()
    expect(lerNeblina({ ligada: true, intensidade: Number.POSITIVE_INFINITY })).toBeUndefined()
  })

  it('pincelada com raio 0 ou negativo, id vazio, sem ponto ou com um ponto torto sai; as boas ficam na ordem', () => {
    const boa1 = traco('ok1', 'pincel', 2)
    const boa2 = traco('ok2', 'borracha', 2)
    const lidas = lerNeblinaPintada([
      boa1,
      traco('raio0', 'pincel', 2, { raio: 0 }),
      traco('raioNeg', 'pincel', 2, { raio: -3 }),
      { ...traco('', 'pincel', 2) },
      traco('semPonto', 'pincel', 0),
      { ...traco('torto', 'pincel', 2), pontos: [{ x: 0, y: 0 }, { x: 'a', y: 0 }] },
      { ...traco('tipo', 'pincel', 2), tipo: 'spray' },
      boa2,
    ])
    expect(lidas?.map((p) => p.id)).toEqual(['ok1', 'ok2'])
  })

  it('força fora da faixa é presa, não descartada', () => {
    const lidas = lerNeblinaPintada([traco('f0', 'pincel', 2, { forca: 0 }), traco('f9', 'pincel', 2, { forca: 9 })])
    expect(lidas?.map((p) => p.forca)).toEqual([0.1, 1])
  })

  it('arquivo com tudo torto ou lista vazia dá undefined (o mapa abre sem o campo)', () => {
    expect(lerNeblinaPintada([])).toBeUndefined()
    expect(lerNeblinaPintada([{}, null, 3])).toBeUndefined()
    expect(lerNeblinaPintada('[]')).toBeUndefined()
  })
})

describe('neblina: o que o jogador recebe e a caixa', () => {
  it('jogador que não conhece nada não recebe neblina pintada (a forma desenharia o lugar)', () => {
    expect(neblinaParaJogador([traco('a', 'pincel', 5)], () => false, () => false)).toBeUndefined()
  })

  it('lista ausente ou vazia não vira lista vazia no fio', () => {
    expect(neblinaParaJogador(undefined, () => true, () => false)).toBeUndefined()
    expect(neblinaParaJogador([], () => true, () => false)).toBeUndefined()
  })

  it('a caixa ignora a borracha e soma o raio; só borracha = null', () => {
    expect(caixaDaNeblinaPintada([traco('b', 'borracha', 3)])).toBeNull()
    expect(caixaDaNeblinaPintada([traco('p', 'pincel', 3, { raio: 5 }), traco('b', 'borracha', 50)])).toEqual({ x: -5, y: -5, largura: 12, altura: 10 })
  })
})
