import { describe, expect, it } from 'vitest'
import type { Carimbo, CarimboImportado, MapData } from '../types/map'
import { createEmptyMap } from './mapFactory'
import {
  carimbosParaJogador,
  comCarimbos,
  criarSpray,
  DENSIDADE_MAX,
  DENSIDADE_MIN,
  fatorDeEspaco,
  idsDebaixoDaBorracha,
  importadosParaJogador,
  lerCarimbos,
  lerCarimbosImportados,
  mesmosCarimbos,
  normalizarGiro,
  semCarimboImportado,
  tamanhoNatural,
  TETO_DE_CARIMBOS,
  varianteDoGiro,
} from './carimbos'

/**
 * CARIMBOS (`lib/carimbos.ts`): a leitura segura do disco, o spray (o sorteio
 * que acontece uma vez, no gesto), a borracha e o corte do jogador.
 */

const IMAGEM = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAYAAAAvAAAAAAA='

const objeto = (id: string, x: number, y: number, tipo = 'pinheiro', tamanho = 20): Carimbo => ({ id, tipo, x, y, tamanho, giro: 0 })

/** Sorteio fixo (o gerador de Park-Miller): o mesmo spray a cada rodada do teste. */
function sorteioFixo(semente = 7): () => number {
  let s = semente
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function ids(): () => string {
  let n = 0
  return () => `s${++n}`
}

describe('leitura do disco', () => {
  it('lê o objeto bom, normaliza o giro e tira o quebrado, o repetido e o de tipo estranho', () => {
    const lidos = lerCarimbos([
      { id: 'a', tipo: 'pinheiro', x: 10, y: 20, tamanho: 30, giro: 370.4 },
      { id: 'b', tipo: 'importado:farol', x: 1, y: 2, tamanho: 3, giro: -45 },
      { id: 'a', tipo: 'arvore', x: 0, y: 0, tamanho: 5, giro: 0 },
      { id: 'c', tipo: 'Pinheiro!', x: 0, y: 0, tamanho: 5, giro: 0 },
      { id: 'd', tipo: 'pedras', x: Number.NaN, y: 0, tamanho: 5, giro: 0 },
      { id: 'e', tipo: 'pedras', x: 0, y: 0, tamanho: 0, giro: 0 },
      { id: 'f', tipo: 'poca', x: 0, y: 0, tamanho: 4 },
      'lixo',
    ])
    expect(lidos).toEqual([
      { id: 'a', tipo: 'pinheiro', x: 10, y: 20, tamanho: 30, giro: 10 },
      { id: 'b', tipo: 'importado:farol', x: 1, y: 2, tamanho: 3, giro: 315 },
      { id: 'f', tipo: 'poca', x: 0, y: 0, tamanho: 4, giro: 0 },
    ])
    expect(lerCarimbos([])).toBeUndefined()
    expect(lerCarimbos('nada')).toBeUndefined()
  })

  it('para no teto da cena (o arquivo editado à mão não cresce sem limite)', () => {
    const muitos = Array.from({ length: TETO_DE_CARIMBOS + 10 }, (_, i) => objeto(`o${i}`, i, i))
    expect(lerCarimbos(muitos)).toHaveLength(TETO_DE_CARIMBOS)
  })

  it('importado só com imagem embutida em base64 e id do prefixo; o nome sai limpo', () => {
    const lidos = lerCarimbosImportados([
      { id: 'importado:farol', nome: '  Farol   da baía ', imagem: IMAGEM },
      { id: 'importado:fora', nome: 'Fora', imagem: 'https://exemplo.com/a.png' },
      { id: 'farol', nome: 'Sem prefixo', imagem: IMAGEM },
      { id: 'importado:farol', nome: 'Repetido', imagem: IMAGEM },
      { id: 'importado:vazio', nome: '   ', imagem: IMAGEM },
    ])
    expect(lidos).toEqual([
      { id: 'importado:farol', nome: 'Farol da baía', imagem: IMAGEM },
      { id: 'importado:vazio', nome: 'Carimbo', imagem: IMAGEM },
    ])
  })

  it('lista vazia tira o campo do mapa (o mapa volta a ser o de antes)', () => {
    const mapa = createEmptyMap('m', 'M', 10, 10, 50)
    const com = comCarimbos(mapa, [objeto('a', 1, 1)])
    expect(com.carimbos).toHaveLength(1)
    expect('carimbos' in comCarimbos(com, [])).toBe(false)
    expect(comCarimbos(mapa, [])).toBe(mapa)
  })
})

describe('tamanho, espaço e giro', () => {
  it('o tamanho natural segue o mapa, nunca abaixo de um tanto da célula, vezes a escolha', () => {
    // Continente: 1242 px do protótipo = 30.000 px de mundo → unidade ~24.
    expect(tamanhoNatural(24, 50, 14, 100)).toBeCloseTo(336)
    expect(tamanhoNatural(24, 50, 14, 200)).toBeCloseTo(672)
    // Masmorra pequena: o objeto não vira grão.
    expect(tamanhoNatural(1, 70, 14, 100)).toBeCloseTo(56)
    // A escolha fica na faixa do controle.
    expect(tamanhoNatural(24, 50, 14, 5000)).toBeCloseTo(336 * 2.5)
  })

  it('mais densidade, objetos mais perto; a faixa nunca inverte', () => {
    expect(fatorDeEspaco(DENSIDADE_MIN)).toBeGreaterThan(fatorDeEspaco(0.5))
    expect(fatorDeEspaco(0.5)).toBeGreaterThan(fatorDeEspaco(DENSIDADE_MAX))
    expect(fatorDeEspaco(DENSIDADE_MAX)).toBeGreaterThan(0.5)
  })

  it('oito desenhos, um a cada 45°; o giro guardado é inteiro de 0 a 359', () => {
    expect([0, 44, 46, 90, 315, 337, 359].map(varianteDoGiro)).toEqual([0, 1, 1, 2, 7, 7, 0])
    expect(normalizarGiro(-1)).toBe(359)
    expect(normalizarGiro(720.4)).toBe(0)
  })
})

describe('spray', () => {
  const opcoes = (extra: Partial<Parameters<typeof criarSpray>[0]> = {}) =>
    ({ tipo: 'arvore', tamanho: 20, raio: 60, densidade: 0.5, existentes: [], sorteio: sorteioFixo(), novoId: ids(), ...extra }) as Parameters<typeof criarSpray>[0]

  it('o clique solta UM, no ponto exato, mesmo encostado em outro objeto', () => {
    const spray = criarSpray(opcoes({ existentes: [objeto('x', 100, 100, 'arvore')] }))
    const primeiro = spray.comecar({ x: 101, y: 100 })
    expect(primeiro).toMatchObject({ tipo: 'arvore', x: 101, y: 100 })
    expect(spray.soltos()).toHaveLength(1)
    expect(spray.espalhou()).toBe(false)
    // O tamanho do clique varia pouco (±6%), e o giro é sorteado.
    expect(primeiro?.tamanho).toBeGreaterThanOrEqual(20 * 0.94)
    expect(primeiro?.tamanho).toBeLessThanOrEqual(20 * 1.06)
  })

  it('arrastar espalha vários pelo caminho, nunca mais perto que o espaço da densidade', () => {
    const spray = criarSpray(opcoes())
    spray.comecar({ x: 0, y: 0 })
    for (let x = 30; x <= 600; x += 30) spray.passar({ x, y: 0 })
    const soltos = spray.soltos()
    expect(soltos.length).toBeGreaterThan(8)
    expect(spray.espalhou()).toBe(true)
    const fator = fatorDeEspaco(0.5)
    // O primeiro (o clique) é a escolha do mestre; entre os do spray vale o espaço.
    for (let i = 1; i < soltos.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = soltos[i]
        const b = soltos[j]
        // A posição guardada é arredondada ao px: um tantinho de folga.
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual((fator * (a.tamanho + b.tamanho)) / 2 - 1.5)
      }
    }
    // Todos dentro do disco do spray em volta do caminho.
    for (const c of soltos) expect(Math.abs(c.y)).toBeLessThanOrEqual(60)
  })

  it('mais densidade solta mais no mesmo caminho', () => {
    const contar = (densidade: number) => {
      const spray = criarSpray(opcoes({ densidade, sorteio: sorteioFixo(3) }))
      spray.comecar({ x: 0, y: 0 })
      for (let volta = 0; volta < 4; volta++) for (let x = 0; x <= 600; x += 20) spray.passar({ x: volta % 2 === 0 ? x : 600 - x, y: 0 })
      return spray.soltos().length
    }
    expect(contar(1)).toBeGreaterThan(contar(0.2))
  })

  it('não cobre o que já está no mapa e respeita onde pode cair (a costa)', () => {
    const existente = objeto('velho', 300, 0, 'arvore', 20)
    const spray = criarSpray(opcoes({ existentes: [existente], aceita: (p) => p.x < 400 }))
    spray.comecar({ x: 0, y: 0 })
    for (let x = 20; x <= 800; x += 20) spray.passar({ x, y: 0 })
    for (const c of spray.soltos()) {
      expect(c.x).toBeLessThan(400)
      expect(Math.hypot(c.x - existente.x, c.y - existente.y)).toBeGreaterThanOrEqual((fatorDeEspaco(0.5) * (c.tamanho + 20)) / 2 - 1.5)
    }
  })

  it('para nas vagas da cena', () => {
    const spray = criarSpray(opcoes({ vagas: 3, densidade: 1 }))
    spray.comecar({ x: 0, y: 0 })
    for (let x = 20; x <= 2000; x += 20) spray.passar({ x, y: 0 })
    expect(spray.soltos()).toHaveLength(3)
    const cheio = criarSpray(opcoes({ vagas: 0 }))
    expect(cheio.comecar({ x: 0, y: 0 })).toBeNull()
    expect(cheio.soltos()).toHaveLength(0)
  })
})

describe('borracha', () => {
  it('pega o objeto a menos de um raio do caminho, com folga de um terço do tamanho dele', () => {
    const lista = [objeto('perto', 100, 30, 'arvore', 30), objeto('copa', 100, 48, 'arvore', 30), objeto('longe', 100, 200, 'arvore', 30)]
    const sai = idsDebaixoDaBorracha(lista, [{ x: 0, y: 0 }, { x: 300, y: 0 }], 40)
    expect([...sai].sort()).toEqual(['copa', 'perto'])
    expect(idsDebaixoDaBorracha(lista, [{ x: 100, y: 200 }], 5)).toEqual(new Set(['longe']))
    expect(idsDebaixoDaBorracha(undefined, [{ x: 0, y: 0 }], 5).size).toBe(0)
  })
})

describe('jogador', () => {
  it('só os de base no que ele conhece; dos importados, só os usados, sem o nome do mestre', () => {
    const lista = [objeto('a', 10, 10, 'importado:farol'), objeto('b', 900, 10, 'importado:covil'), objeto('c', 20, 20)]
    const importados: CarimboImportado[] = [
      { id: 'importado:farol', nome: 'Farol do mestre', imagem: IMAGEM },
      { id: 'importado:covil', nome: 'Covil do dragão', imagem: IMAGEM },
    ]
    const vao = carimbosParaJogador(lista, (p) => p.x < 100)
    expect(vao?.map((c) => c.id)).toEqual(['a', 'c'])
    expect(importadosParaJogador(importados, vao)).toEqual([{ id: 'importado:farol', nome: 'Carimbo', imagem: IMAGEM }])
    expect(carimbosParaJogador(lista, () => false)).toBeUndefined()
    expect(importadosParaJogador(importados, undefined)).toBeUndefined()
  })

  it('tirar um importado leva os objetos dele junto; os outros ficam', () => {
    const mapa: MapData = {
      ...createEmptyMap('m', 'M', 10, 10, 50),
      carimbos: [objeto('a', 1, 1, 'importado:farol'), objeto('b', 2, 2)],
      carimbosImportados: [{ id: 'importado:farol', nome: 'Farol', imagem: IMAGEM }],
    }
    const sem = semCarimboImportado(mapa, 'importado:farol')
    expect(sem.carimbos?.map((c) => c.id)).toEqual(['b'])
    expect(sem.carimbosImportados).toBeUndefined()
    expect(semCarimboImportado(mapa, 'importado:outro')).toBe(mapa)
  })

  it('mesmos objetos em referências novas contam como iguais (o mapa do jogador chega novo a cada mensagem)', () => {
    const a = [objeto('a', 1, 1)]
    expect(mesmosCarimbos(a, [{ ...a[0] }])).toBe(true)
    expect(mesmosCarimbos(a, [{ ...a[0], giro: 90 }])).toBe(false)
    expect(mesmosCarimbos(a, undefined)).toBe(false)
  })
})
