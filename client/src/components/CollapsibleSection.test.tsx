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

  /*
   * CONTAGEM DISCRETA (pedido painel-acervo, fatia 5): a linha fechada diz
   * quanto tem dentro antes de abrir — "Cenas 3 ›". O número não entra no
   * nome do botão: 21 jornadas procuram `getByRole('button', { name: 'Cenas',
   * exact: true })`. Ele é a DESCRIÇÃO: o leitor de tela ouve "Cenas",
   * recolhido, e depois "3", o mesmo que quem enxerga lê.
   */
  describe('contagem', () => {
    const renderContagem = (contagem: number | undefined) =>
      act(() =>
        root.render(
          <CollapsibleSection id="scenes" title="Cenas" defaultOpen={false} contagem={contagem}>
            <p>conteúdo</p>
          </CollapsibleSection>,
        ),
      )
    const contagem = () => header().querySelector('.lb-collapsible__contagem')

    it('com contagem, o número fica entre o nome e a seta, e o botão continua se chamando só "Cenas"', () => {
      renderContagem(3)
      expect(contagem()?.textContent).toBe('3')
      expect(contagem()?.getAttribute('aria-hidden')).toBe('true')
      expect([...header().children].map((el) => el.className)).toEqual(['lb-collapsible__titulo', 'lb-collapsible__contagem', 'lb-collapsible__chevron'])
      expect(nomeAcessivel(header())).toBe('Cenas')
    })

    it('o número é a descrição do botão: o leitor de tela ouve "Cenas" e depois "3"', () => {
      renderContagem(3)
      const descricao = header().getAttribute('aria-describedby')
      expect(descricao, 'o botão não aponta para o número').toBeTruthy()
      expect(document.getElementById(descricao ?? '')).toBe(contagem())
    })

    it('sem contagem, com 0 ou com valor que não é contagem, a linha fica só com o nome e a seta, sem descrição', () => {
      for (const valor of [undefined, 0, -2, Number.NaN]) {
        renderContagem(valor)
        expect(contagem(), String(valor)).toBeNull()
        expect(header().hasAttribute('aria-describedby'), String(valor)).toBe(false)
        expect(header().textContent, String(valor)).toBe('Cenas')
      }
    })

    it('o número acompanha a lista: muda no render seguinte e some quando ela esvazia', () => {
      renderContagem(3)
      renderContagem(4)
      expect(contagem()?.textContent).toBe('4')
      renderContagem(0)
      expect(contagem()).toBeNull()
      renderContagem(1)
      expect(contagem()?.textContent).toBe('1')
    })

    it('abrir e fechar não mexe no número: aberta, a linha continua dizendo quanto tem', () => {
      renderContagem(3)
      act(() => header().click())
      expect(header().getAttribute('aria-expanded')).toBe('true')
      expect(contagem()?.textContent).toBe('3')
    })
  })
})

/**
 * O nome acessível do botão, como o leitor de tela e o `getByRole` dos specs o
 * calculam aqui: o texto de dentro, sem o que é `aria-hidden`.
 */
function nomeAcessivel(el: Element): string {
  const copia = el.cloneNode(true)
  if (!(copia instanceof Element)) return ''
  for (const oculto of copia.querySelectorAll('[aria-hidden="true"]')) oculto.remove()
  return (copia.textContent ?? '').trim()
}

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

  it('a contagem mora à direita, colada à seta: na fonte e no tamanho do nome, mais leve e mais apagada que ele, com algarismos de largura fixa', async () => {
    const contagem = regra(await lerCss(), '.lb-collapsible__contagem')
    // A margem automática toma o espaço livre antes do `space-between` do botão:
    // sem ela, com três filhos, o número ia parar no meio da linha.
    expect(contagem.get('margin-left')).toBe('auto')
    // 4 px até a caixa da seta (o vão do botão é 8): "12 ›" se lê como uma peça.
    expect(contagem.get('margin-right')).toBe('calc(var(--lb-space-1) - var(--lb-space-2))')
    expect(contagem.get('flex')).toBe('none')
    // O botão não herda a fonte da página (o navegador dá a dele): sem dizer a
    // família, o número sairia noutra fonte, com outra linha de base.
    expect(contagem.get('font-family')).toBe('var(--lb-font-sans)')
    expect(contagem.get('font-weight')).toBe('var(--lb-font-weight-regular)')
    // O TAMANHO do nome, e não um passo menor: com a linha centralizada, número
    // menor fica com a linha de base 1 px acima da do nome (medido; é a lição
    // de Camadas, main.css). Quem o deixa discreto é o peso e a cor.
    expect(contagem.get('font-size')).toBe('var(--lb-font-size-md)')
    expect(contagem.get('font-variant-numeric')).toBe('tabular-nums')
    expect(contagem.get('color')).toBe('var(--lb-color-parchment-faint)')
    // Nem pulo de número nem pulso: a contagem só troca de valor.
    expect(contagem.has('transition')).toBe(false)
    expect(contagem.has('animation')).toBe(false)
  })

  it('sob o ponteiro ou apertada, a contagem sobe um tom com a linha, sem passar o nome', async () => {
    const css = await lerCss()
    for (const seletor of ['.lb-collapsible__toggle:hover > .lb-collapsible__contagem', '.lb-collapsible__toggle:active > .lb-collapsible__contagem']) {
      expect(regra(css, seletor).get('color'), seletor).toBe('var(--lb-color-parchment-dim)')
    }
  })

  it('só tokens do tema: nenhuma cor solta na folha', async () => {
    const semComentarios = (await lerCss()).replace(/\/\*[\s\S]*?\*\//g, '')
    expect(semComentarios).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
  })
})
