import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CollapsibleSection } from './CollapsibleSection'

describe('CollapsibleSection', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  const render = (defaultOpen: boolean, id = 'layers') =>
    act(() =>
      root.render(
        <CollapsibleSection id={id} title="Camadas" defaultOpen={defaultOpen}>
          <p>conteúdo</p>
        </CollapsibleSection>,
      ),
    )

  const header = () => {
    const button = container.querySelector<HTMLButtonElement>('button[aria-expanded]')
    if (button === null) throw new Error('sem cabeçalho')
    return button
  }
  const body = () => {
    const el = document.getElementById(header().getAttribute('aria-controls') ?? '')
    if (el === null) throw new Error('aria-controls sem corpo')
    return el
  }

  it('cabeçalho é botão com o título; aria-controls aponta para o corpo', () => {
    render(true)
    expect(header().textContent).toBe('Camadas')
    expect(body().textContent).toBe('conteúdo')
  })

  it('o título é nome de linha, não legenda: sem a caixa alta de .lb-eyebrow (pedido painel-acervo, fatia 3)', () => {
    render(true)
    const titulo = header().querySelector('.lb-collapsible__titulo')
    expect(titulo?.textContent).toBe('Camadas')
    expect(header().querySelector('.lb-eyebrow')).toBeNull()
  })

  it('clique abre e fecha, trocando aria-expanded e hidden do corpo', () => {
    render(true)
    expect(header().getAttribute('aria-expanded')).toBe('true')
    expect(body().hidden).toBe(false)
    act(() => header().click())
    expect(header().getAttribute('aria-expanded')).toBe('false')
    expect(body().hidden).toBe(true)
    act(() => header().click())
    expect(header().getAttribute('aria-expanded')).toBe('true')
    expect(body().hidden).toBe(false)
  })

  it('sem preferência gravada, segue defaultOpen (inclusive quando ele muda)', () => {
    render(false)
    expect(header().getAttribute('aria-expanded')).toBe('false')
    render(true)
    expect(header().getAttribute('aria-expanded')).toBe('true')
  })

  it('lembra o estado em localStorage (lb-section:<id>) e ele vence defaultOpen', () => {
    render(true)
    act(() => header().click())
    expect(window.localStorage.getItem('lb-section:layers')).toBe('0')

    // Remonta do zero: o estado vem do armazenamento, não do defaultOpen.
    act(() => root.unmount())
    root = createRoot(container)
    render(true)
    expect(header().getAttribute('aria-expanded')).toBe('false')

    // defaultOpen mudando depois do clique não reabre.
    render(false)
    act(() => header().click())
    expect(window.localStorage.getItem('lb-section:layers')).toBe('1')
    render(false)
    expect(header().getAttribute('aria-expanded')).toBe('true')
  })

  it('persist=false nasce fechado mesmo com lb-section:<id>=1 gravado, e o clique não grava', () => {
    window.localStorage.setItem('lb-section:advanced', '1')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    act(() =>
      root.render(
        <CollapsibleSection id="advanced" title="Avançado" defaultOpen={false} persist={false}>
          <p>conteúdo</p>
        </CollapsibleSection>,
      ),
    )
    expect(header().getAttribute('aria-expanded')).toBe('false')
    expect(body().hidden).toBe(true)
    act(() => header().click())
    expect(header().getAttribute('aria-expanded')).toBe('true')
    expect(setItem).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('lb-section:advanced')).toBe('1')
  })

  it('headingLevel=3 renderiza h3; o padrão continua h2', () => {
    render(true)
    expect(container.querySelector('h2.lb-collapsible__heading')).not.toBeNull()
    act(() =>
      root.render(
        <CollapsibleSection id="advanced" title="Avançado" defaultOpen={false} headingLevel={3}>
          <p>conteúdo</p>
        </CollapsibleSection>,
      ),
    )
    expect(container.querySelector('h3.lb-collapsible__heading')).not.toBeNull()
    expect(container.querySelector('h2')).toBeNull()
  })

  it('ids diferentes não compartilham estado', () => {
    window.localStorage.setItem('lb-section:floor', '0')
    render(true, 'layers')
    expect(header().getAttribute('aria-expanded')).toBe('true')
  })

  it('lazy: fechada, o conteúdo nem existe no DOM; aberta, monta; fechar de novo desmonta', () => {
    const renderLazy = () =>
      act(() =>
        root.render(
          <CollapsibleSection id="objects" title="Objetos do mapa" defaultOpen={false} lazy>
            <input aria-label="Buscar objeto" />
          </CollapsibleSection>,
        ),
      )
    renderLazy()
    expect(body().hidden).toBe(true)
    expect(body().querySelector('input')).toBeNull()
    act(() => header().click())
    expect(body().querySelector('input')).not.toBeNull()
    act(() => header().click())
    expect(body().querySelector('input')).toBeNull()
    // Sem `lazy`, o corpo fechado continua montado (só escondido), como sempre foi.
    render(false)
    expect(body().textContent).toBe('conteúdo')
  })

  it('openRequest: mudar o valor abre (e grava a preferência); o valor da montagem não abre nada', () => {
    const renderPedido = (openRequest: number) =>
      act(() =>
        root.render(
          <CollapsibleSection id="objects" title="Objetos do mapa" defaultOpen={false} openRequest={openRequest}>
            <p>conteúdo</p>
          </CollapsibleSection>,
        ),
      )
    renderPedido(3)
    expect(header().getAttribute('aria-expanded')).toBe('false')
    renderPedido(4)
    expect(header().getAttribute('aria-expanded')).toBe('true')
    expect(window.localStorage.getItem('lb-section:objects')).toBe('1')
    // Fechar à mão continua valendo até o próximo pedido.
    act(() => header().click())
    renderPedido(4)
    expect(header().getAttribute('aria-expanded')).toBe('false')
    renderPedido(5)
    expect(header().getAttribute('aria-expanded')).toBe('true')
  })

  it('localStorage indisponível (getItem/setItem lançam) não quebra: abre/fecha só em memória', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    render(true)
    expect(header().getAttribute('aria-expanded')).toBe('true')
    act(() => header().click())
    expect(setItem).toHaveBeenCalledWith('lb-section:layers', '0')
    expect(header().getAttribute('aria-expanded')).toBe('false')
    expect(body().hidden).toBe(true)
  })
})

/** O CSS como está no disco (ver `PropertiesPanel.moldura.test.ts`: `?raw` e `new URL` não leem o arquivo). */
async function lerCss(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'CollapsibleSection.css'), 'utf8')
}

/** As declarações da PRIMEIRA regra que tem `seletor` na lista de seletores: propriedade → valor. */
function regra(css: string, seletor: string): Map<string, string> {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, seletores, corpo] of semComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!seletores.split(',').some((s) => s.replace(/\s+/g, ' ').trim() === seletor)) continue
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

/*
 * LINHAS CALMAS (pedido painel-acervo, fatia 3): caixa alta só no título de
 * grupo (PAREDE, AVENTURA, ACERVO DE TOKENS); a linha que abre e fecha é item,
 * em minúscula. O jsdom não aplica folha: o teste lê as regras, a tela é a
 * outra metade da prova. O main.css entra DEPOIS desta folha, então o que
 * corrige uma regra de lá precisa de seletor mais específico.
 */
describe('CollapsibleSection.css — a linha que abre e fecha', () => {
  it('o nome da linha usa a fonte da interface, 13 px, peso médio, apagado', async () => {
    const titulo = regra(await lerCss(), '.lb-collapsible__titulo')
    expect(titulo.get('font-family')).toBe('var(--lb-font-sans)')
    expect(titulo.get('font-size')).toBe('var(--lb-font-size-md)')
    expect(titulo.get('font-weight')).toBe('var(--lb-font-weight-medium)')
    expect(titulo.get('color')).toBe('var(--lb-color-parchment-dim)')
    expect(titulo.has('text-transform')).toBe(false)
  })

  it('sob o ponteiro ou apertada, a linha acende; aberta, continua apagada (quem acende é o conteúdo)', async () => {
    const css = await lerCss()
    for (const seletor of ['.lb-collapsible__toggle:hover > .lb-collapsible__titulo', '.lb-collapsible__toggle:active > .lb-collapsible__titulo']) {
      expect(regra(css, seletor).get('color'), seletor).toBe('var(--lb-color-parchment)')
    }
    expect(regra(css, ".lb-collapsible__toggle[aria-expanded='true'] > .lb-collapsible__titulo").size).toBe(0)
  })

  it('o anel de foco fica dentro da linha, com folga para o texto, que continua na vertical dos campos', async () => {
    const css = await lerCss()
    const linha = regra(css, '.lb-collapsible__heading > .lb-collapsible__toggle')
    // O botão avança no respiro da seção o mesmo tanto que ganha de folga: o texto não sai do lugar.
    expect(linha.get('padding-inline')).toBe('var(--lb-space-2)')
    expect(linha.get('margin-inline')).toBe('calc(-1 * var(--lb-space-2))')
    expect(linha.get('width')).toBe('calc(100% + 2 * var(--lb-space-2))')
    const foco = regra(css, '.lb-collapsible__heading > .lb-collapsible__toggle:focus-visible')
    expect(foco.get('box-shadow')).toBe('inset 0 0 0 2px var(--lb-color-brass)')
  })

  it('o Avançado DENTRO de um bloco é a última linha dele: 34 px (a altura do .lb-btn, a da ficha), sem respiro de seção', async () => {
    const css = await lerCss()
    for (const seletor of [
      '.lb-section > .lb-collapsible > h3.lb-collapsible__heading > .lb-collapsible__toggle',
      '.lb-collapsible__body > .lb-collapsible > h3.lb-collapsible__heading > .lb-collapsible__toggle',
    ]) {
      expect(regra(css, seletor).get('min-height'), seletor).toBe('34px')
    }
    expect(regra(css, '.lb-section > .lb-collapsible:has(> h3.lb-collapsible__heading)').get('padding')).toBe('0')
  })

  it('o Avançado solto, irmão das seções (o da Região, depois do Perigo), continua linha de 44 px com o fio: não se cola ao bloco de outro', async () => {
    const css = await lerCss()
    expect(regra(css, 'h3.lb-collapsible__heading > .lb-collapsible__toggle').size).toBe(0)
    expect(regra(css, '.lb-section + .lb-collapsible:has(> h3.lb-collapsible__heading)').size).toBe(0)
  })

  it('o Avançado dentro de uma seção que abre começa na vertical dos campos dela', async () => {
    const dentro = regra(await lerCss(), '.lb-collapsible__body > .lb-collapsible')
    expect(dentro.get('padding-inline')).toBe('0')
  })

  it('só tokens do tema: nenhuma cor solta na folha', async () => {
    const semComentarios = (await lerCss()).replace(/\/\*[\s\S]*?\*\//g, '')
    expect(semComentarios).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
  })
})
