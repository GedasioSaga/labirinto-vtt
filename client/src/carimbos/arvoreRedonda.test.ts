import { describe, expect, it } from 'vitest'
import { CARIMBOS_EMBUTIDOS, PALETA_DOS_EMBUTIDOS } from './embutidos'

/**
 * ÁRVORE REDONDA (fatia MT5 do Meio-Termo): um carimbo NOVO, a copa redonda
 * de lóbulos vista de cima, desenho original inspirado no Mother 3. A árvore
 * antiga (`arvore`) NÃO muda: os mapas que já a usam ficam iguais. Sem canvas
 * no jsdom, o "hash de pixels" daqui é a digital dos comandos e cores que o
 * desenho pede a um contexto que só anota (mesmos comandos = mesmos pixels);
 * o golden do app (`e2e/task-camadas-golden.spec.ts`, com carimbos) confere os
 * pixels de verdade.
 */

function digital(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i += 1) h = Math.imul(h ^ texto.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Tudo o que o desenho pede, numa linha: nome do comando com os números, e cada cor. */
function anotarDesenho(id: string, giro: number, semente: number): string {
  const def = CARIMBOS_EMBUTIDOS.find((c) => c.id === id)
  if (def === undefined) throw new Error(`sem o carimbo ${id}`)
  const linhas: string[] = []
  const alvo: Record<string, unknown> = {}
  const g = new Proxy(alvo, {
    get: (t, nome: string) => {
      if (nome in t) return t[nome]
      return (...args: unknown[]) => {
        linhas.push(`${nome}(${args.map((a) => (typeof a === 'number' ? a.toFixed(4) : String(a))).join(',')})`)
        return { addColorStop: (p: number, cor: string) => linhas.push(`stop ${p} ${cor}`) }
      }
    },
    set: (t, nome: string, valor: unknown) => {
      linhas.push(`${nome}=${String(valor)}`)
      t[nome] = valor
      return true
    },
  })
  def.desenhar(g as unknown as CanvasRenderingContext2D, giro, semente)
  return linhas.join('\n')
}

/** A digital da árvore antiga ANTES da MT5, nos giros 0 e 1 rad e sementes 0 e 5 (medida em 23/10/2026, commit 141c33fe). */
const DIGITAL_DA_ARVORE_ANTIGA = '2310565996'

describe('MT5: a árvore antiga não muda', () => {
  it('os comandos e as cores da árvore antiga dão a mesma digital de antes da MT5', () => {
    const texto = [anotarDesenho('arvore', 0, 0), anotarDesenho('arvore', 1, 5)].join('\n--\n')
    expect(String(digital(texto))).toBe(DIGITAL_DA_ARVORE_ANTIGA)
  })
})

describe('MT5: a árvore redonda', () => {
  it('existe na biblioteca, com nome próprio, logo depois da árvore, e sombra de quem está em pé', () => {
    const ids = CARIMBOS_EMBUTIDOS.map((c) => c.id)
    expect(ids.indexOf('arvore-redonda')).toBe(ids.indexOf('arvore') + 1)
    const def = CARIMBOS_EMBUTIDOS.find((c) => c.id === 'arvore-redonda')
    expect(def?.nome).toBe('Árvore redonda')
    expect(def?.sombra).toBe('em-pe')
  })

  it('desenha diferente da árvore antiga e varia com a semente (a mata não fica clonada)', () => {
    expect(anotarDesenho('arvore-redonda', 0, 0)).not.toBe(anotarDesenho('arvore', 0, 0))
    const variacoes = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((s) => anotarDesenho('arvore-redonda', 0, s)))
    expect(variacoes.size).toBeGreaterThanOrEqual(4)
  })

  it('a copa redonda tem lóbulos claros do lado da luz (cima à esquerda) e a cor fica na paleta contida', () => {
    const texto = anotarDesenho('arvore-redonda', 0, 3)
    const cores = [...texto.matchAll(/fillStyle=rgba?\((\d+), (\d+), (\d+)/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])] as const)
    expect(cores.length).toBeGreaterThanOrEqual(4)
    const paleta = new Set(PALETA_DOS_EMBUTIDOS.map((c) => c.join(',')))
    for (const cor of cores) expect(paleta.has(cor.join(',')), cor.join(',')).toBe(true)
  })
})
