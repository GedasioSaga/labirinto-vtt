import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NadaSelecionado } from './NadaSelecionado'

/**
 * A faixa do topo sem seleção (pedido painel-acervo, fatia 2): o lugar e a
 * altura da faixa da seleção, com "Nada selecionado" e o "+ Token".
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
  Reflect.deleteProperty(HTMLFormElement.prototype, 'scrollIntoView')
})

function montar(onAddToken = vi.fn<(nome: string) => void>()) {
  act(() => root.render(<NadaSelecionado novoToken={{ defaultTokenName: 'Token 4', onAddToken }} />))
  return onAddToken
}

const maisToken = () => container.querySelector<HTMLButtonElement>('button[aria-label="Adicionar token"]')

describe('NadaSelecionado — a faixa sem seleção', () => {
  it('"Nada selecionado" é um botão desabilitado com o texto exato, e o "+ Token" mora na mesma faixa', () => {
    montar()
    const faixa = container.querySelector('.lb-semsel')
    const estado = faixa?.querySelector<HTMLButtonElement>('.lb-semsel__estado')
    expect(estado?.textContent).toBe('Nada selecionado')
    expect(estado?.disabled).toBe(true)
    expect(faixa?.contains(maisToken())).toBe(true)
    // Ninguém mais na faixa repete o trecho que as jornadas leem com getByText.
    expect(container.textContent?.match(/nada selecionado/gi)).toHaveLength(1)
  })

  it('o campo abre logo abaixo da faixa (não dentro dela), e confirmar entrega o nome', () => {
    const onAddToken = montar()
    act(() => maisToken()?.click())
    const faixa = container.querySelector('.lb-semsel')
    const campo = container.querySelector<HTMLInputElement>('#lb-new-token-name')
    expect(faixa?.contains(campo)).toBe(false)
    expect(faixa?.nextElementSibling?.contains(campo)).toBe(true)
    expect(faixa?.nextElementSibling?.classList.contains('lb-section')).toBe(true)
    act(() => campo?.form?.requestSubmit())
    expect(onAddToken).toHaveBeenCalledWith('Token 4')
    expect(container.querySelector('#lb-new-token-name')).toBeNull()
  })

  it('ao abrir, o formulário inteiro vem para a vista uma vez — não só o campo; digitar não rola de novo', () => {
    const rolar = vi.fn()
    Object.defineProperty(HTMLFormElement.prototype, 'scrollIntoView', { configurable: true, value: rolar })
    montar()
    act(() => maisToken()?.click())
    expect(rolar).toHaveBeenCalledTimes(1)
    expect(rolar).toHaveBeenCalledWith({ block: 'nearest' })
    expect(rolar.mock.contexts[0]).toBe(container.querySelector('form'))

    const campo = container.querySelector<HTMLInputElement>('#lb-new-token-name')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(campo, 'Goblin')
      campo?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(rolar).toHaveBeenCalledTimes(1)
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
  it('a faixa gruda no topo como a da seleção e não encolhe quando o "+ Token" sai para o campo abrir', async () => {
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

  it('o mesmo recuo da faixa da seleção: o "+ Token" termina onde termina o "⋯", à direita do Apagar', async () => {
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
