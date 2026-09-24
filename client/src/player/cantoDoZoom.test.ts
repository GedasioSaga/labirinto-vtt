import { describe, expect, it, vi } from 'vitest'

/**
 * Junção de duas features no MESMO canto da tela do jogador: o zoom (+ e −,
 * `zoom-no-celular`) e a mão de CHAMAR O MESTRE (`chamar-o-mestre`) moram
 * embaixo à direita. A mão tem `z-index` maior: no mesmo lugar ela cobria o
 * botão "−" e o toque no zoom ia para a mão. O jsdom não desenha nem faz
 * hit-test, então a prova é a geometria da regra no player.css: a mão começa
 * acima do topo do grupo do zoom.
 */

/**
 * O player.css como está no disco. `import './player.css?raw'` não serve: o
 * Vitest troca todo `.css` importado por string vazia (mesmo motivo do
 * `Toggle.test.tsx`).
 */
async function lerPlayerCss(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'player.css'), 'utf8')
}

/** As declarações da PRIMEIRA regra cujo seletor é exatamente `seletor`: propriedade → valor. */
function regra(css: string, seletor: string): Map<string, string> {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, seletores, corpo] of semComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (seletores.trim() !== seletor) continue
    return new Map(
      corpo
        .split(';')
        .map((declaracao) => declaracao.split(':'))
        .filter((partes) => partes.length >= 2)
        .map(([propriedade, ...valor]) => [propriedade.trim(), valor.join(':').trim()]),
    )
  }
  throw new Error(`o player.css não tem a regra "${seletor}"`)
}

/** A soma dos px de um valor (`12px`, `calc(24px + 91px)`); a borda segura (`env(...)`) vale 0 aqui. */
function px(valor: string | undefined): number {
  if (valor === undefined) throw new Error('declaração ausente')
  const semEnv = valor.replace(/env\([^()]*\)/g, '0px')
  return [...semEnv.matchAll(/(-?\d+(?:\.\d+)?)px/g)].reduce((soma, [, numero]) => soma + Number(numero), 0)
}

describe('canto de baixo à direita da tela do jogador: zoom e "chamar o mestre"', () => {
  it('a mão fica ACIMA do grupo do zoom, sem cobrir o "−"', async () => {
    const css = await lerPlayerCss()
    const zoom = regra(css, '.pp-zoom')
    const botao = regra(css, '.pp-zoom__button')
    const filete = regra(css, '.pp-zoom__button + .pp-zoom__button')
    const mao = regra(css, '.pp-call')
    // A premissa: os dois no mesmo canto, fixos na tela.
    expect(mao.get('position')).toBe('fixed')
    expect(zoom.get('position')).toBe('fixed')
    expect(px(mao.get('right'))).toBe(px(zoom.get('right')))
    // Topo do zoom: a distância do fundo, os dois botões, o filete entre eles e a borda de cima e de baixo.
    const topoDoZoom = px(zoom.get('bottom')) + 2 * px(botao.get('height')) + px(filete.get('border-top')) + 2 * px(zoom.get('border'))
    expect(px(mao.get('bottom'))).toBeGreaterThan(topoDoZoom)
  })
})
