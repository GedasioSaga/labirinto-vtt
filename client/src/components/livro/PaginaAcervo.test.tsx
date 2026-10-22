import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PaginaAcervo } from './PaginaAcervo'

/**
 * Página Acervo (fatia 18b): o seg "O que mostrar" troca entre o acervo de
 * tokens e o de itens, um de cada vez, sem desmontar o outro.
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

function opcao(nome: string): HTMLButtonElement {
  const achada = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent?.trim() === nome)
  if (!achada) throw new Error(`sem a opção "${nome}"`)
  return achada
}

/** A parte da página que contém o texto: o embrulho que o seg mostra e esconde. */
function parte(texto: string): HTMLElement {
  const achada = [...container.querySelectorAll<HTMLElement>('.lb-acervo-pagina__parte')].find((el) => el.textContent?.includes(texto))
  if (!achada) throw new Error(`sem a parte com "${texto}"`)
  return achada
}

describe('PaginaAcervo', () => {
  it('nasce nos Tokens; o seg troca para Itens e de volta, sem desmontar a parte escondida', () => {
    act(() => root.render(<PaginaAcervo tokens={<input aria-label="pasta nova" defaultValue="" />} itens={<p>grade de itens</p>} />))
    const grupo = container.querySelector('[role="radiogroup"]')
    expect(grupo?.getAttribute('aria-label')).toBe('O que mostrar')
    expect(opcao('Tokens').getAttribute('aria-checked')).toBe('true')
    expect(parte('grade de itens').hidden).toBe(true)

    const campo = container.querySelector<HTMLInputElement>('input[aria-label="pasta nova"]')
    if (campo === null) throw new Error('sem o campo da parte dos tokens')
    campo.value = 'Guardas'

    act(() => opcao('Itens').click())
    expect(opcao('Itens').getAttribute('aria-checked')).toBe('true')
    expect(parte('grade de itens').hidden).toBe(false)
    expect(campo.closest('.lb-acervo-pagina__parte')?.hasAttribute('hidden')).toBe(true)

    act(() => opcao('Tokens').click())
    expect(container.querySelector<HTMLInputElement>('input[aria-label="pasta nova"]')).toBe(campo)
    expect(campo.value).toBe('Guardas')
    expect(parte('grade de itens').hidden).toBe(true)
  })

  it('sem o acervo de itens (navegador), só os tokens e nenhuma escolha', () => {
    act(() => root.render(<PaginaAcervo tokens={<p>estante</p>} />))
    expect(container.querySelector('[role="radiogroup"]')).toBeNull()
    expect(parte('estante').hidden).toBe(false)
  })
})
