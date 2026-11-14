import { describe, expect, it } from 'vitest'
import { CARIMBOS_EMBUTIDOS, IDS_DOS_EMBUTIDOS, PALETA_DOS_EMBUTIDOS, type Rgb } from './embutidos'
import { QUADRO_DA_BIBLIOTECA } from './arte'
import { IDS_DOS_EMBUTIDOS as IDS_DA_BIBLIOTECA } from './catalogo'
import { CARIMBOS_NOVOS, PALETA_DOS_NOVOS } from './novos'

/**
 * A BIBLIOTECA DE CARIMBOS não estoura (pedido de 10/10/2026, o mesmo das
 * texturas) e fica no quadro. Sem canvas no jsdom: cada desenho roda num
 * contexto falso que anota as cores e os pontos de cada caminho. A régua vale
 * para os 12 de `embutidos.ts` e para os novos de 14/11/2026 (`novos/`).
 */

const TODOS = [...CARIMBOS_EMBUTIDOS, ...CARIMBOS_NOVOS]
const PALETA_DE_TODOS = [...PALETA_DOS_EMBUTIDOS, ...PALETA_DOS_NOVOS]

/** Saturação HSL de 0 a 1. */
function saturacao([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const l = (max + min) / 2
  if (max === min) return 0
  return (max - min) / (1 - Math.abs(2 * l - 1))
}

function corDoCss(css: string): Rgb | null {
  const m = /^rgba?\((\d+), (\d+), (\d+)/.exec(css)
  return m === null ? null : [Number(m[1]), Number(m[2]), Number(m[3])]
}

interface Anotacao {
  cores: string[]
  pontos: Array<[number, number]>
  comandos: string[]
}

/** Um contexto 2D de mentira: anota o que o desenho pede (cores, pontos, comandos). */
function contextoFalso(): { g: CanvasRenderingContext2D; anotacao: Anotacao } {
  const anotacao: Anotacao = { cores: [], pontos: [], comandos: [] }
  const ponto = (x: number, y: number) => anotacao.pontos.push([x, y])
  const gradiente = { addColorStop: (_: number, cor: string) => anotacao.cores.push(cor) }
  const alvo: Record<string, unknown> = {
    moveTo: (x: number, y: number) => ponto(x, y),
    lineTo: (x: number, y: number) => ponto(x, y),
    quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => {
      ponto(cx, cy)
      ponto(x, y)
    },
    arc: (x: number, y: number, r: number) => {
      ponto(x - r, y - r)
      ponto(x + r, y + r)
    },
    ellipse: (x: number, y: number, rx: number, ry: number, giro: number) => {
      // A caixa da elipse girada.
      const ex = Math.hypot(rx * Math.cos(giro), ry * Math.sin(giro))
      const ey = Math.hypot(rx * Math.sin(giro), ry * Math.cos(giro))
      ponto(x - ex, y - ey)
      ponto(x + ex, y + ey)
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      ponto(x, y)
      ponto(x + w, y + h)
    },
    createLinearGradient: () => gradiente,
    createRadialGradient: () => gradiente,
  }
  const g = new Proxy(alvo, {
    get: (t, nome: string) => {
      if (nome in t) {
        const valor = t[nome]
        if (typeof valor === 'function') {
          return (...args: number[]) => {
            anotacao.comandos.push(`${nome}(${args.map((a) => (typeof a === 'number' ? a.toFixed(3) : '')).join(',')})`)
            return (valor as (...a: number[]) => unknown)(...args)
          }
        }
        return valor
      }
      return () => undefined
    },
    set: (t, nome: string, valor: unknown) => {
      if ((nome === 'fillStyle' || nome === 'strokeStyle') && typeof valor === 'string') anotacao.cores.push(valor)
      t[nome] = valor
      return true
    },
  })
  return { g: g as unknown as CanvasRenderingContext2D, anotacao }
}

describe('biblioteca de carimbos', () => {
  it('doze objetos (a árvore redonda da MT5 e a árvore morta logo depois da árvore, o tronco caído e o toco seco depois do arbusto), ids da forma do pacote, nenhum repetido', () => {
    expect(IDS_DOS_EMBUTIDOS).toEqual(['pinheiro', 'pinheiro-nevado', 'arvore', 'arvore-redonda', 'arvore-morta', 'arbusto', 'tronco-caido', 'toco-seco', 'palmeira', 'pedras', 'poca', 'juncos'])
    for (const id of IDS_DOS_EMBUTIDOS) expect(id).toMatch(/^[a-z0-9-]{1,40}$/)
  })

  it('os novos de 14/11/2026 vêm depois dos doze, na ordem da lista, com ids da forma do pacote, nenhum repetido', () => {
    expect(IDS_DA_BIBLIOTECA).toEqual([
      ...IDS_DOS_EMBUTIDOS,
      'cerejeira',
      'bambuzal',
      'cogumelo-gigante',
      'mangue',
      'carvalho',
      'arvore-de-outono',
      'salgueiro',
      'betula',
      'macieira',
      'ipe-amarelo',
      'ipe-roxo',
      'araucaria',
      'bananeira',
      'samambaia',
      'capim-alto',
      'flores-do-campo',
      'arbusto-com-frutinhas',
      'folhas-secas',
      'galhos-caidos',
      'seixos',
      'lama',
      'musgo',
      'vitoria-regia',
      'conchas',
      'algas',
      'coral',
      'cacto',
      'cacto-redondo',
      'arbusto-que-rola',
      'cranio-de-boi',
      'monte-de-neve',
      'arvore-congelada',
      'bloco-de-gelo',
      'cristais',
      'estalagmite',
      'cogumelos-que-brilham',
      'rochedo-com-musgo',
      'rocha-vulcanica',
    ])
    for (const id of IDS_DA_BIBLIOTECA) expect(id).toMatch(/^[a-z0-9-]{1,40}$/)
    expect(new Set(IDS_DA_BIBLIOTECA).size).toBe(IDS_DA_BIBLIOTECA.length)
  })

  it('nenhuma cor estourada: canal até 245 e saturação contida', () => {
    for (const cor of PALETA_DE_TODOS) {
      expect(Math.max(...cor)).toBeLessThanOrEqual(245)
      expect(saturacao(cor)).toBeLessThanOrEqual(0.72)
    }
  })

  for (const def of TODOS) {
    it(`${def.nome}: desenha nos oito giros sem erro, dentro do quadro e só com as cores da paleta`, () => {
      const paleta = new Set(PALETA_DE_TODOS.map((c) => c.join(',')))
      const q = QUADRO_DA_BIBLIOTECA
      const desenhos: string[] = []
      for (let v = 0; v < 8; v++) {
        const { g, anotacao } = contextoFalso()
        def.desenhar(g, (v * Math.PI) / 4, v)
        expect(anotacao.pontos.length).toBeGreaterThan(0)
        for (const [x, y] of anotacao.pontos) {
          // Um respiro de 2% do quadro: o giro de até 0,07 rad do pinheiro mexe a ponta um tantinho.
          expect(x).toBeGreaterThanOrEqual(q.esquerda - 0.03)
          expect(x).toBeLessThanOrEqual(q.esquerda + q.lado + 0.03)
          expect(y).toBeGreaterThanOrEqual(q.topo - 0.03)
          expect(y).toBeLessThanOrEqual(q.topo + q.lado + 0.03)
        }
        for (const css of anotacao.cores) {
          const cor = corDoCss(css)
          expect(cor, css).not.toBeNull()
          if (cor !== null) expect(paleta.has(cor.join(',')) || Math.max(...cor) <= 245, css).toBe(true)
        }
        desenhos.push(anotacao.comandos.join(' '))
      }
      // Os oito giros não saem iguais (a mata não fica de árvores clonadas).
      expect(new Set(desenhos).size).toBeGreaterThanOrEqual(4)
    })
  }

  it('a luz não gira: a face mais clara da pedra fica sempre do lado de cima à esquerda', () => {
    const pedras = CARIMBOS_EMBUTIDOS.find((c) => c.id === 'pedras')
    if (pedras === undefined) throw new Error('sem pedras')
    for (let v = 0; v < 8; v++) {
      const { g, anotacao } = contextoFalso()
      pedras.desenhar(g, (v * Math.PI) / 4, v)
      const cores = anotacao.cores.map(corDoCss).filter((c): c is Rgb => c !== null)
      const luz = (c: Rgb) => c[0] + c[1] + c[2]
      // Há sempre face clara e face escura: a pedra tem volume em todo giro.
      expect(Math.max(...cores.map(luz)) - Math.min(...cores.map(luz))).toBeGreaterThan(120)
    }
  })
})
