/**
 * PENHASCO (`lib/penhasco.ts`): o pincel que risca rochedo na costa.
 *
 * Terra de teste: um quadrado de 0 a 1000 px de mundo. A beira de BAIXO
 * (y = 1000) é a costa de onde a parede desce à vista; a de CIMA (y = 0) é a
 * escondida atrás da terra.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, RegionPoint, TracoDePenhasco } from '../types/map'
import { createEmptyMap } from './mapFactory'
import {
  comPenhascos,
  lerPenhascos,
  oQueORiscoCobre,
  passoDoRisco,
  penhascosParaJogador,
  raioDoPincelDePenhasco,
  riscarPenhasco,
  temRiscoDePenhasco,
  tracosSeTocam,
} from './penhasco'

const naTerra = (p: RegionPoint): boolean => p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 1000

function traco(id: string, modo: TracoDePenhasco['modo'], pontos: [number, number][], raio = 40): TracoDePenhasco {
  return { id, modo, raio, pontos: pontos.map(([x, y]) => ({ x, y })) }
}

/** Risco ao longo da costa de baixo, de x = a a x = b. */
function naCostaDeBaixo(id: string, a: number, b: number, modo: TracoDePenhasco['modo'] = 'riscar', raio = 40): TracoDePenhasco {
  const pontos: [number, number][] = []
  for (let x = a; x <= b; x += 10) pontos.push([x, 1000])
  return traco(id, modo, pontos, raio)
}

describe('pincel: tamanho', () => {
  it('o raio cresce com o mapa (px do protótipo vezes a unidade) e o passo é um quarto dele', () => {
    expect(raioDoPincelDePenhasco(1, 'media')).toBe(12)
    expect(raioDoPincelDePenhasco(10, 'fina')).toBe(60)
    expect(raioDoPincelDePenhasco(10, 'larga')).toBe(240)
    expect(passoDoRisco(40)).toBe(10)
  })
})

describe('oQueORiscoCobre: o risco gruda na costa', () => {
  it('na costa de baixo: costa e parede', () => {
    expect(oQueORiscoCobre(naCostaDeBaixo('a', 200, 400), naTerra)).toEqual({ costa: true, parede: true })
  })

  it('na costa de cima: costa, mas a parede ficaria atrás da terra', () => {
    expect(oQueORiscoCobre(traco('a', 'riscar', [[200, 0], [400, 0]]), naTerra)).toEqual({ costa: true, parede: false })
  })

  it('no meio da terra, ou no meio do mar: nenhuma costa', () => {
    expect(oQueORiscoCobre(traco('a', 'riscar', [[500, 500], [600, 500]]), naTerra)).toEqual({ costa: false, parede: false })
    expect(oQueORiscoCobre(traco('a', 'riscar', [[2000, 2000]]), naTerra)).toEqual({ costa: false, parede: false })
  })

  it('um toque só (um ponto) na costa de baixo também vale', () => {
    expect(oQueORiscoCobre(traco('a', 'riscar', [[300, 1005]]), naTerra).parede).toBe(true)
  })

  it('a costa só um pouco dentro do pincel ainda é achada (o risco não precisa ser exato)', () => {
    // Centro 30 px abaixo da costa, raio 40: a beira passa a 10 px da borda do pincel.
    expect(oQueORiscoCobre(traco('a', 'riscar', [[300, 1030], [500, 1030]]), naTerra).parede).toBe(true)
  })
})

describe('riscarPenhasco', () => {
  it('risco na costa de baixo entra na lista', () => {
    const novo = naCostaDeBaixo('a', 200, 400)
    const { lista, resultado } = riscarPenhasco([], novo, naTerra)
    expect(resultado).toBe('riscou')
    expect(lista).toEqual([novo])
  })

  it('risco longe da costa ou só na beira escondida devolve a MESMA lista (sem passo vazio no desfazer)', () => {
    const antes = [naCostaDeBaixo('a', 200, 400)]
    const longe = riscarPenhasco(antes, traco('b', 'riscar', [[500, 500]]), naTerra)
    expect(longe.resultado).toBe('longe-da-costa')
    expect(longe.lista).toBe(antes)
    const escondida = riscarPenhasco(antes, traco('c', 'riscar', [[200, 0], [400, 0]]), naTerra)
    expect(escondida.resultado).toBe('costa-escondida')
    expect(escondida.lista).toBe(antes)
  })

  it('borracha no vazio não pesa no arquivo', () => {
    const antes = [naCostaDeBaixo('a', 200, 400)]
    const { lista, resultado } = riscarPenhasco(antes, traco('b', 'apagar', [[800, 1000]]), naTerra)
    expect(resultado).toBe('nada-a-apagar')
    expect(lista).toBe(antes)
  })

  it('borracha num trecho entra depois do risco (o rasterizador tira só o que veio antes)', () => {
    const risco = naCostaDeBaixo('a', 200, 400)
    const borracha = traco('b', 'apagar', [[300, 1000]], 40)
    const { lista, resultado } = riscarPenhasco([risco], borracha, naTerra)
    expect(resultado).toBe('apagou')
    expect(lista).toEqual([risco, borracha])
  })

  it('borracha que cobre o risco inteiro tira o risco de vez, e a lista fica vazia', () => {
    const risco = naCostaDeBaixo('a', 200, 260, 'riscar', 20)
    const borracha = naCostaDeBaixo('b', 150, 310, 'apagar', 80)
    const { lista, resultado } = riscarPenhasco([risco], borracha, naTerra)
    expect(resultado).toBe('apagou')
    expect(lista).toEqual([])
  })

  it('borracha que cobre um risco inteiro e encosta noutro: sai o coberto, ela fica pelo outro', () => {
    const coberto = naCostaDeBaixo('a', 200, 260, 'riscar', 20)
    const vizinho = naCostaDeBaixo('b', 330, 600)
    const borracha = naCostaDeBaixo('c', 150, 310, 'apagar', 80)
    const { lista } = riscarPenhasco([coberto, vizinho], borracha, naTerra)
    expect(lista.map((t) => t.id)).toEqual(['b', 'c'])
  })
})

describe('tracosSeTocam', () => {
  it('encostam pela soma dos raios, cruzam no meio, ou ficam longe', () => {
    expect(tracosSeTocam(traco('a', 'riscar', [[0, 0], [100, 0]], 10), traco('b', 'riscar', [[0, 25], [100, 25]], 10))).toBe(false)
    expect(tracosSeTocam(traco('a', 'riscar', [[0, 0], [100, 0]], 10), traco('b', 'riscar', [[0, 19], [100, 19]], 10))).toBe(true)
    // Dois lados longos que se cruzam: as pontas estão longe, o meio não.
    expect(tracosSeTocam(traco('a', 'riscar', [[0, 0], [1000, 1000]], 1), traco('b', 'riscar', [[0, 1000], [1000, 0]], 1))).toBe(true)
  })
})

describe('lerPenhascos: o arquivo não é confiável', () => {
  it('lê os riscos bons, na ordem, e tira os tortos', () => {
    const bom = naCostaDeBaixo('a', 0, 20)
    const lido = lerPenhascos([
      bom,
      { id: 'sem-modo', raio: 4, pontos: [{ x: 1, y: 1 }] },
      { id: 'modo-torto', modo: 'pintar', raio: 4, pontos: [{ x: 1, y: 1 }] },
      { id: 'raio-zero', modo: 'riscar', raio: 0, pontos: [{ x: 1, y: 1 }] },
      { id: 'ponto-torto', modo: 'riscar', raio: 4, pontos: [{ x: 1, y: 'a' }] },
      { id: 'sem-ponto', modo: 'apagar', raio: 4, pontos: [] },
      null,
      'lixo',
    ])
    expect(lido).toEqual([bom])
  })

  it('sem o campo, lista vazia ou nada aproveitável: sem o campo', () => {
    expect(lerPenhascos(undefined)).toBeUndefined()
    expect(lerPenhascos([])).toBeUndefined()
    expect(lerPenhascos({ id: 'a' })).toBeUndefined()
    expect(lerPenhascos([{ id: 'x' }])).toBeUndefined()
  })
})

describe('comPenhascos', () => {
  it('lista vazia tira o campo; o mapa sem o campo volta o MESMO', () => {
    const mapa: MapData = createEmptyMap('m', 'M', 10, 10, 50)
    expect(comPenhascos(mapa, [])).toBe(mapa)
    const com = comPenhascos(mapa, [naCostaDeBaixo('a', 0, 20)])
    expect(com.penhascos).toHaveLength(1)
    const sem = comPenhascos(com, [])
    expect('penhascos' in sem).toBe(false)
  })
})

describe('penhascosParaJogador: só o pedaço junto do que ele conhece', () => {
  // O jogador conhece só a faixa x <= 300; sem lugar escondido.
  const nadaEscondido = (): boolean => false
  const conhece = (p: RegionPoint): boolean => p.x <= 300

  it('o risco que entra na névoa sai cortado, com um ponto de folga na ponta', () => {
    const risco = naCostaDeBaixo('a', 0, 1000)
    const saida = penhascosParaJogador([risco], conhece, nadaEscondido)
    expect(saida).toHaveLength(1)
    const xs = saida?.[0].pontos.map((p) => p.x) ?? []
    // O disco do pincel (raio 40) encosta no conhecido até x = 340; mais um ponto de folga.
    expect(Math.max(...xs)).toBe(350)
    expect(Math.min(...xs)).toBe(0)
  })

  it('risco todo na névoa não sai; borracha sem risco antes dela também não', () => {
    expect(penhascosParaJogador([naCostaDeBaixo('a', 600, 900)], conhece, nadaEscondido)).toBeUndefined()
    const borracha = naCostaDeBaixo('b', 0, 100, 'apagar')
    expect(penhascosParaJogador([naCostaDeBaixo('a', 600, 900), borracha], conhece, nadaEscondido)).toBeUndefined()
  })

  it('risco que sai e volta ao conhecido vira dois pedaços, na ordem, com a borracha depois', () => {
    const conheceDuasPontas = (p: RegionPoint): boolean => p.x <= 200 || p.x >= 800
    const risco = naCostaDeBaixo('a', 0, 1000)
    const borracha = traco('b', 'apagar', [[100, 1000]])
    const saida = penhascosParaJogador([risco, borracha], conheceDuasPontas, nadaEscondido) ?? []
    expect(saida.map((t) => [t.id, t.modo])).toEqual([
      ['a~0', 'riscar'],
      ['a~1', 'riscar'],
      ['b~0', 'apagar'],
    ])
  })

  it('sem riscos: sem o campo', () => {
    expect(penhascosParaJogador(undefined, conhece, nadaEscondido)).toBeUndefined()
    expect(penhascosParaJogador([], conhece, nadaEscondido)).toBeUndefined()
  })

  // Enseada que é Lugar escondido (ou zona oculta): x de 100 a 200. O jogador
  // conhece a terra dos dois lados, mas nada dentro dela.
  const naEnseada = (p: RegionPoint): boolean => p.x >= 100 && p.x <= 200
  const conheceForaDaEnseada = (p: RegionPoint): boolean => p.x <= 300 && !naEnseada(p)

  it('ponto dentro de lugar escondido não sai, nem quando a borda do pincel encosta no conhecido', () => {
    const saida = penhascosParaJogador([naCostaDeBaixo('a', 0, 300)], conheceForaDaEnseada, naEnseada) ?? []
    const pontos = saida.flatMap((t) => t.pontos)
    expect(pontos.length).toBeGreaterThan(0)
    expect(pontos.filter(naEnseada)).toEqual([])
    // Os dois lados da enseada continuam indo, em dois pedaços.
    expect(saida.map((t) => t.id)).toEqual(['a~0', 'a~1'])
  })

  it('o ponto de folga da ponta também não cai em lugar escondido', () => {
    // O pedaço da direita começa logo depois da enseada: a folga antiga era o ponto x = 200.
    const saida = penhascosParaJogador([naCostaDeBaixo('a', 150, 300)], conheceForaDaEnseada, naEnseada) ?? []
    const xs = saida.flatMap((t) => t.pontos.map((p) => p.x))
    expect(xs.length).toBeGreaterThan(0)
    expect(Math.min(...xs)).toBeGreaterThan(200)
  })

  it('pontos muito espaçados (arrasto rápido de longe): a folga não leva a ponta funda na névoa', () => {
    const espacado = traco('a', 'riscar', [[0, 1000], [3000, 1000]])
    const saida = penhascosParaJogador([espacado], conhece, nadaEscondido) ?? []
    const xs = saida.flatMap((t) => t.pontos.map((p) => p.x))
    expect(xs.length).toBeGreaterThan(0)
    // Conhece até x = 300; o pincel (raio 40) encosta até 340, e a folga é de no máximo um raio.
    expect(Math.max(...xs)).toBeLessThanOrEqual(300 + 40 + 40)
  })

  it('lado longo que atravessa um lugar escondido: os dois lados vão, o meio não', () => {
    const conheceTudoForaDaEnseada = (p: RegionPoint): boolean => !naEnseada(p)
    const longo = traco('a', 'riscar', [[0, 1000], [300, 1000]])
    const saida = penhascosParaJogador([longo], conheceTudoForaDaEnseada, naEnseada) ?? []
    const pontos = saida.flatMap((t) => t.pontos)
    expect(pontos.filter(naEnseada)).toEqual([])
    expect(saida).toHaveLength(2)
  })
})

describe('temRiscoDePenhasco', () => {
  it('só borracha não desenha nada', () => {
    expect(temRiscoDePenhasco(undefined)).toBe(false)
    expect(temRiscoDePenhasco([traco('b', 'apagar', [[0, 0]])])).toBe(false)
    expect(temRiscoDePenhasco([traco('a', 'riscar', [[0, 0]])])).toBe(true)
  })
})
