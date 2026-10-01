import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NadaSelecionado } from './NadaSelecionado'

/**
 * A faixa do topo sem seleção (pedido painel-acervo): o lugar e a altura da
 * faixa da seleção, só com "Nada selecionado". O "+ Token" mora no cabeçalho
 * do painel, o mesmo lugar com e sem seleção (PropertiesPanel.selecao.test.tsx).
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('NadaSelecionado — a faixa sem seleção', () => {
  it('"Nada selecionado" é um botão desabilitado com o texto exato, e é tudo o que a faixa diz', () => {
    act(() => root.render(<NadaSelecionado />))
    const faixa = container.querySelector('.lb-semsel')
    const estado = faixa?.querySelector<HTMLButtonElement>('.lb-semsel__estado')
    expect(estado?.textContent).toBe('Nada selecionado')
    expect(estado?.disabled).toBe(true)
    // Estado, não ação: o "+ Token" não mora mais aqui (um lugar só, o cabeçalho).
    expect(faixa?.querySelectorAll('button')).toHaveLength(1)
    expect(container.querySelector('button[aria-label="Adicionar token"]')).toBeNull()
    // Ninguém mais na faixa repete o trecho que as jornadas leem com getByText.
    expect(container.textContent).toBe('Nada selecionado')
  })
})

/** Um CSS como está no disco, relativo a esta pasta (o mesmo jeito de `PropertiesPanel.botoes.test.ts`). */
async function lerCss(relativo: string): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), relativo), 'utf8')
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
  return new Map()
}

describe('NadaSelecionado — CSS', () => {
  it('a faixa gruda no topo como a da seleção e tem a altura dela, mesmo só com o texto: selecionar e largar não pula a coluna', async () => {
    const css = await lerCss('./NadaSelecionado.css')
    const faixa = regra(css, '.lb-semsel')
    expect(faixa.get('position')).toBe('sticky')
    expect(faixa.get('top')).toBe('0')
    // 4 + 44 + 4 px e a linha: a altura da faixa da seleção (SelectionHeader.css).
    expect(faixa.get('min-height')).toBe('calc(44px + 2 * var(--lb-space-1) + 1px)')
    expect(faixa.get('background')).toBe('var(--lb-color-stone-sunken)')
    expect(faixa.get('border-bottom')).toBe('1px solid var(--lb-color-line)')
    // O que o Tab traz para a vista para abaixo da faixa, não atrás dela.
    expect(regra(css, '.lb-inspector__body:has(> .lb-semsel)').get('scroll-padding-top')).toBe(
      'calc(44px + 2 * var(--lb-space-1) + 1px + var(--lb-space-2))',
    )
  })

  it('o mesmo recuo da faixa da seleção: "Nada selecionado" começa onde começa o ícone dela', async () => {
    const faixaVazia = regra(await lerCss('./NadaSelecionado.css'), '.lb-semsel')
    const faixaDaSelecao = regra(await lerCss('./SelectionHeader.css'), '.lb-selhead')
    expect(faixaVazia.get('padding')).toBe(faixaDaSelecao.get('padding'))
    expect(faixaVazia.get('padding')).toBe('var(--lb-space-1) var(--lb-space-3) var(--lb-space-1) var(--lb-space-4)')
  })

  it('"Nada selecionado" é texto de estado: apagado, sem caixa e sem o cursor de proibido', async () => {
    const css = await lerCss('./NadaSelecionado.css')
    const estado = regra(css, '.lb-semsel__estado')
    expect(estado.get('color')).toBe('var(--lb-color-parchment-faint)')
    expect(estado.get('cursor')).toBe('default')
    expect(estado.get('border')).toBe('0')
    expect(estado.get('background')).toBe('none')
  })
})
