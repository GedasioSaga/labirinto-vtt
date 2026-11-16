// @vitest-environment node
/**
 * Arte do barril sem DOM: um contexto 2D falso (Proxy que grava cada chamada)
 * desenha todos os estados sem quebrar; o movimento reduzido não desloca o
 * barril no golpe; o canto da vela fica livre; e, com tela fora da página, o
 * corpo do barril sai do cache em vez de ser repintado a cada quadro.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { H, W } from '../abrir/desenho'
import { DT, SEM_ENTRADA } from '../abrir/tipos'
import { BOCA, alvoEm, desenhar, tremorDoBarril } from './arte'
import { DIF, abertura, criar, passo } from './sim'
import type { Dificuldade, Entrada } from '../abrir/tipos'
import type { Estado } from './sim'

type Chamada = readonly [string, ...unknown[]]

/** Contexto 2D falso: os métodos que a arte usa viram gravações; o gradiente aceita paradas e não faz nada. */
function contextoFalso(): { g: CanvasRenderingContext2D; log: Chamada[] } {
  const log: Chamada[] = []
  const alvo: Record<string | symbol, unknown> = {
    createRadialGradient: () => ({ addColorStop: () => undefined }),
  }
  const proxy = new Proxy(alvo, {
    get: (o, chave) => (chave in o ? o[chave] : (...args: unknown[]) => void log.push([String(chave), ...args])),
    set: (o, chave, valor) => {
      log.push(['=' + String(chave), valor])
      o[chave] = valor
      return true
    },
  })
  // O Proxy só tem o que a arte chama; o resto do CanvasRenderingContext2D nunca é usado aqui.
  return { g: proxy as unknown as CanvasRenderingContext2D, log } // falso de teste: o Proxy grava o que a arte chama (comentário acima)
}

const TOQUE: Readonly<Entrada> = { segurando: false, toque: 0 }

/** Tentativa com toques nos instantes dados, parada em `ate`. */
function jogar(dif: Dificuldade, toques: readonly number[], ate: number, semente = 'arte'): Estado {
  const e = criar(semente, dif)
  const fila = [...toques].sort((a, b) => a - b)
  while (e.t < ate - 1e-9) {
    const toca = fila.length > 0 && e.t + DT >= fila[0] - 1e-9
    if (toca) fila.shift()
    passo(e, toca ? TOQUE : SEM_ENTRADA)
  }
  return e
}

const N = DIF.normal
/** Picos das primeiras batidas do Normal (andamento fixo). */
const pico = (k: number): number => N.primeiroPico + k * N.batida
const todos = (n: number): number[] => Array.from({ length: n }, (_, k) => pico(k))

function estados(): [string, Estado][] {
  const fim = jogar('normal', todos(N.meta), pico(N.meta - 1))
  const tFim = fim.t
  return [
    ['antes da 1ª batida', jogar('normal', [], 0.5)],
    ['brilho subindo', jogar('normal', [], pico(0) - 0.2)],
    ['pico', jogar('normal', [], pico(0))],
    ['golpe certo', jogar('normal', [pico(0)], pico(0) + 0.03)],
    ['escorregão', jogar('normal', [0.6], 0.65)],
    ['escorregão, martelo travado', jogar('normal', [0.6], 0.85)],
    ['aro solto', jogar('normal', todos(5), pico(4) + 0.3)],
    ['dois aros soltos', jogar('normal', todos(10), pico(9) + 0.1)],
    ['abrindo, abertura 0,5', jogar('normal', todos(N.meta), tFim + 0.25)],
    ['aberto, abertura 1', jogar('normal', todos(N.meta), tFim + 0.8)],
    ['tempo esgotado', jogar('normal', [], 20.5)],
    ['Difícil no meio', jogar('dificil', [2, 2.5, 3.3], 6.2, 'arte|dificil')],
  ]
}

describe('arte do barril', () => {
  it('as aberturas dos estados de abrir são as esperadas', () => {
    const lista = new Map(estados())
    expect(abertura(lista.get('abrindo, abertura 0,5') ?? criar('x', 'normal'))).toBeCloseTo(0.5, 1)
    expect(abertura(lista.get('aberto, abertura 1') ?? criar('x', 'normal'))).toBe(1)
    expect(lista.get('tempo esgotado')?.fim).toBe('tempo')
  })

  for (const [nome, e] of estados()) {
    for (const reduzido of [false, true]) {
      it(`${nome}${reduzido ? ' (reduzido)' : ''}: desenha sem quebrar`, () => {
        const { g, log } = contextoFalso()
        desenhar(g, e, { reduzido })
        expect(log.filter(([n]) => n === 'fillRect').length).toBeGreaterThan(500)
      })
    }
  }

  it('alvo único: a tela toda golpeia', () => {
    const e = criar('alvo', 'normal')
    for (const [x, y] of [[0, 0], [CENTRO_DA_TELA[0], CENTRO_DA_TELA[1]], [W - 1, H - 1]]) expect(alvoEm(x, y, e)).toBe(0)
  })

  it('a boca fica dentro da tela, no meio, acima do chão', () => {
    expect(BOCA[0]).toBe(W / 2)
    expect(BOCA[1]).toBeGreaterThan(0)
    expect(BOCA[1]).toBeLessThan(H / 2)
  })
})

const CENTRO_DA_TELA: readonly [number, number] = [W / 2, H / 2]

/** Retângulos pintados inteiros à esquerda de x = 150 (o barril, longe do martelo e da faísca). */
function ladoEsquerdo(log: readonly Chamada[]): Chamada[] {
  const fora: Chamada[] = []
  let cor: unknown = null
  for (const c of log) {
    if (c[0] === '=fillStyle') cor = c[1]
    if (c[0] === 'fillRect' && typeof c[1] === 'number' && typeof c[3] === 'number' && c[1] + c[3] <= 150) fora.push(['fillRect', cor, ...c.slice(1)])
  }
  return fora
}

describe('movimento reduzido', () => {
  it('o barril não se desloca no golpe; no movimento normal ele treme', () => {
    const e = jogar('normal', [pico(0)], pico(0) + 0.04)
    // Mesmo estado, sem o golpe: o que muda entre os dois é só o efeito do golpe.
    const semGolpe: Estado = { ...e, tGolpe: -1e9 }
    const desenhoDe = (x: Estado, reduzido: boolean): Chamada[] => {
      const { g, log } = contextoFalso()
      desenhar(g, x, { reduzido })
      return ladoEsquerdo(log)
    }
    expect(desenhoDe(e, true)).toEqual(desenhoDe(semGolpe, true))
    expect(desenhoDe(e, false)).not.toEqual(desenhoDe(semGolpe, false))
  })

  it('tremor do barril: zero em todo instante no reduzido; diferente de zero logo depois do golpe no normal', () => {
    const e = jogar('normal', [pico(0)], pico(0))
    let tremeu = 0
    for (let i = 0; i < 40; i++) {
      expect(tremorDoBarril(e, true)).toBe(0)
      if (tremorDoBarril(e, false) !== 0) tremeu++
      passo(e, SEM_ENTRADA)
    }
    expect(tremeu).toBeGreaterThan(0)
  })
})

/** Tela fora da página falsa: o contexto dela também é o Proxy que grava. */
class TelaFalsa {
  constructor(readonly width: number, readonly height: number) {}
  getContext(): CanvasRenderingContext2D {
    return contextoFalso().g
  }
}

// O cache fica no módulo: estes dois blocos rodam por último, com a tela fora da página instalada.
afterAll(() => {
  Reflect.deleteProperty(globalThis, 'OffscreenCanvas')
})

describe('cache do corpo', () => {
  it('com tela fora da página, o corpo fechado e o aberto saem do cache: bem menos pintura por quadro', () => {
    const fechado = jogar('normal', [pico(0)], pico(1))
    const aberto = jogar('normal', todos(N.meta), pico(N.meta - 1) + 1)
    const pinturas = (e: Estado): { fill: number; img: number } => {
      const { g, log } = contextoFalso()
      desenhar(g, e, { reduzido: false })
      return { fill: log.filter(([n]) => n === 'fillRect').length, img: log.filter(([n]) => n === 'drawImage').length }
    }
    const diretoFechado = pinturas(fechado)
    const diretoAberto = pinturas(aberto)
    expect(diretoFechado.img).toBe(0)
    Object.defineProperty(globalThis, 'OffscreenCanvas', { value: TelaFalsa, configurable: true, writable: true })
    pinturas(fechado)
    pinturas(aberto)
    const comCacheFechado = pinturas(fechado)
    const comCacheAberto = pinturas(aberto)
    // Fundo e corpo do barril vêm de drawImage; sobra pintar aros, rachaduras, martelo e vela.
    expect(comCacheFechado.img).toBe(2)
    expect(comCacheAberto.img).toBe(2)
    expect(comCacheFechado.fill).toBeLessThan(diretoFechado.fill / 5)
    expect(comCacheAberto.fill).toBeLessThan(diretoAberto.fill / 5)
    expect(comCacheFechado.fill).toBeLessThan(400)
  })
})

/** Retângulo (x, y, largura) pintado por uma chamada, ou null se a chamada não pinta. */
function retangulo(c: Chamada): [number, number, number] | null {
  if (c[0] === 'fillRect') return [Number(c[1]), Number(c[2]), Number(c[3])]
  if (c[0] === 'drawImage' && c[1] instanceof TelaFalsa) return [Number(c[2]), Number(c[3]), c[1].width]
  return null
}

describe('layout', () => {
  it('o canto da vela (x > 205, y < 45) fica livre: nada da cena do barril é pintado ali', () => {
    // Golpes certos e escorregões nos três aros, quadro a quadro (25 ms), e depois a abertura inteira.
    const toques = [0.6, pico(0), pico(1) + 0.2, pico(3), pico(4), pico(5) - 0.25, pico(6), pico(7)]
    const partidas = [{ toques, ate: pico(8) }, { toques: todos(N.meta), ate: pico(N.meta - 1) + 1 }]
    const invasoes: string[] = []
    let quadros = 0
    for (const { toques: ts, ate } of partidas) {
      const e = criar('layout', 'normal')
      const fila = [...ts]
      while (e.t < ate) {
        const toca = fila.length > 0 && e.t + DT >= fila[0] - 1e-9
        if (toca) fila.shift()
        passo(e, toca ? TOQUE : SEM_ENTRADA)
        if (e.passos % 3 !== 0) continue
        quadros++
        for (const reduzido of [false, true]) {
          const { g, log } = contextoFalso()
          desenhar(g, e, { reduzido })
          // A cena do barril vai da última pintura da luz (tela inteira) até o castiçal da vela.
          let inicio = -1
          log.forEach((c, k) => {
            if (c[0] === 'fillRect' && c[1] === 0 && c[2] === 0 && c[3] === W && c[4] === H) inicio = k
          })
          const fimDaCena = log.findIndex((c, k) => k > inicio && c[0] === 'fillRect' && c[1] === 216 && c[2] === 36 && c[3] === 13 && c[4] === 3)
          if (inicio < 0 || fimDaCena < 0) invasoes.push(`t = ${e.t.toFixed(3)}: não achei a luz ou a vela`)
          for (const c of log.slice(inicio + 1, fimDaCena)) {
            const r = retangulo(c)
            if (r !== null && r[0] + r[2] > 205 && r[1] < 45) invasoes.push(`${c[0]} em ${r[0]},${r[1]} (largura ${r[2]}), t = ${e.t.toFixed(3)}`)
          }
        }
      }
    }
    expect(quadros).toBeGreaterThan(200)
    expect(invasoes).toEqual([])
  })
})
