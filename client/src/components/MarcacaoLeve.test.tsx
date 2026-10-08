/**
 * MARCAÇÃO LEVE na tela: o texto do capítulo vem de arquivo de qualquer um,
 * então nada dele vira HTML — script, imagem com onerror, link javascript:,
 * iframe aparecem escritos, como texto, e nenhum elemento deles nasce.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MarcacaoLeve } from './MarcacaoLeve'

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(texto: string, destaque?: string): void {
  act(() => root.render(<MarcacaoLeve texto={texto} destaque={destaque} />))
}

const ATAQUES = [
  '<script>window.__pwned = true</script>',
  '<img src=x onerror="window.__pwned = true">',
  '[clique](javascript:window.__pwned=true)',
  '<iframe src="https://exemplo.invalid"></iframe>',
  '**<b onmouseover="x()">negrito</b>**',
  '# <svg onload="x()"></svg>',
  '- <a href="javascript:x()">item</a>',
  '`<style>body{display:none}</style>`',
].join('\n\n')

describe('marcação leve na tela: segurança', () => {
  it('nenhum elemento vindo do texto: script, img, a, iframe, svg, style e b não existem', () => {
    render(ATAQUES)
    expect(container.querySelector('script, img, a, iframe, svg, style, b')).toBeNull()
    expect(Reflect.get(window, '__pwned')).toBeUndefined()
  })

  it('o HTML aparece escrito, letra por letra', () => {
    render(ATAQUES)
    const texto = container.textContent ?? ''
    expect(texto).toContain('<script>window.__pwned = true</script>')
    expect(texto).toContain('<img src=x onerror="window.__pwned = true">')
    expect(texto).toContain('[clique](javascript:window.__pwned=true)')
  })

  it('nenhum atributo de evento nem href em elemento nenhum', () => {
    render(ATAQUES)
    for (const elemento of Array.from(container.querySelectorAll('*'))) {
      const atributos = Array.from(elemento.attributes).map((atributo) => atributo.name)
      expect(atributos.filter((nome) => nome.startsWith('on') || nome === 'href' || nome === 'src' || nome === 'style')).toEqual([])
    }
  })

  it('a marcação boa vira os elementos esperados', () => {
    render('# Título\n**forte** e *ênfase*\n\n- um\n- dois\n\n> citação')
    expect(container.querySelector('h3')?.textContent).toBe('Título')
    expect(container.querySelector('strong')?.textContent).toBe('forte')
    expect(container.querySelector('em')?.textContent).toBe('ênfase')
    expect(container.querySelectorAll('ul > li')).toHaveLength(2)
    expect(container.querySelector('blockquote')?.textContent).toBe('citação')
  })

  it('o destaque da busca marca os achados sem ligar para acento, e marca só texto', () => {
    render('A **Perícia** de pericia <mark>falsa</mark>', 'pericia')
    const marcados = Array.from(container.querySelectorAll('mark')).map((mark) => mark.textContent)
    expect(marcados).toEqual(['Perícia', 'pericia'])
    expect(container.textContent).toContain('<mark>falsa</mark>')
  })
})
