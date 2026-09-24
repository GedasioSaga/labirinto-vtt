import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toggle } from './Toggle'

/**
 * O INTERRUPTOR da casa: checkbox nativo desenhado como trilho com bolinha.
 * Contrato que a régua `e2e/task-jornada-barra-de-vida.spec.ts` cobra ao
 * clicar no CONTROLE (centro da caixa do checkbox), e que as jornadas que
 * clicam no trilho (`.lb-switch__track`) cobram do outro lado: os dois cliques
 * alternam. Com o input de 1x1 px e `pointer-events: none` sob o texto do
 * rótulo, o clique no controle batia no texto — "<span>Jogadores veem a
 * barra</span> intercepts pointer events". O jsdom não desenha nem faz
 * hit-test, então a prova tem duas metades: a árvore (o checkbox mora dentro
 * do trilho visível) e a regra do main.css (ele cobre o trilho e recebe o
 * ponteiro).
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

const ROTULO = 'Jogadores veem a barra'

function montar() {
  const mudou = vi.fn()
  act(() => root.render(<Toggle label={ROTULO} checked={false} onChange={mudou} />))
  const caixa = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
  const trilho = container.querySelector<HTMLElement>('.lb-switch__track')
  const texto = [...container.querySelectorAll('span')].find((span) => span.textContent === ROTULO)
  if (!caixa || !trilho || !texto) throw new Error('o Toggle deveria ter o checkbox, o trilho e o texto do rótulo')
  return { mudou, caixa, trilho, texto }
}

/**
 * O main.css como está no disco. `import '../main.css?raw'` não serve: o
 * Vitest troca todo `.css` importado por string vazia (opção `css` padrão), e
 * o teste passaria sem ler regra nenhuma. Nem `new URL('../main.css',
 * import.meta.url)`: o Vite reescreve esse padrão como endereço de asset, que
 * no jsdom aponta para o localhost e não para o disco.
 */
async function lerMainCss(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'main.css'), 'utf8')
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
  throw new Error(`o main.css não tem a regra "${seletor}"`)
}

describe('Toggle — o clique no controle cai no checkbox', () => {
  it('o checkbox mora dentro do trilho: o interruptor desenhado é a caixa do próprio controle', () => {
    const { caixa, trilho } = montar()
    expect(trilho.contains(caixa), 'fora do trilho, o centro da caixa do checkbox não é o interruptor que a pessoa vê').toBe(true)
  })

  it('o checkbox segue na árvore de acessibilidade, com o texto do rótulo como nome', () => {
    const { caixa } = montar()
    for (let el: Element | null = caixa; el !== null; el = el.parentElement) {
      expect(el.getAttribute('aria-hidden'), `<${el.tagName.toLowerCase()} class="${el.className}"> esconderia o checkbox do leitor de tela`).not.toBe('true')
    }
    expect(caixa.closest('label')?.textContent).toBe(ROTULO)
  })

  it('no main.css o input cobre o trilho e recebe o ponteiro; a bolinha deixa o clique passar', async () => {
    const css = await lerMainCss()
    const input = regra(css, '.lb-switch__input')
    expect(input.get('pointer-events'), 'com pointer-events: none o clique no controle bate no que estiver embaixo dele').not.toBe('none')
    expect(input.get('position')).toBe('absolute')
    expect(input.get('inset')).toBe('0')
    expect(input.get('width'), 'do tamanho do trilho, não um ponto de 1 px').toBe('100%')
    expect(input.get('height'), 'do tamanho do trilho, não um ponto de 1 px').toBe('100%')
    expect(input.get('opacity'), 'transparente: quem aparece é o trilho').toBe('0')
    expect(regra(css, '.lb-switch__track').get('position'), 'o trilho é o containing block do input').toBe('relative')
    expect(regra(css, '.lb-switch__track::after').get('pointer-events'), 'a bolinha fica por cima do input e engoliria o clique').toBe('none')
  })
})

describe('Toggle — cada gesto alterna uma vez só', () => {
  it('clique no checkbox, no trilho e no texto do rótulo: cada um avisa o novo estado uma vez', () => {
    const { mudou, caixa, trilho, texto } = montar()
    act(() => caixa.click())
    expect(mudou).toHaveBeenCalledTimes(1)
    act(() => trilho.click())
    expect(mudou).toHaveBeenCalledTimes(2)
    act(() => texto.click())
    expect(mudou).toHaveBeenCalledTimes(3)
    // Controlado e sem o pai regravar: todo clique parte de desligado.
    expect(mudou.mock.calls).toEqual([[true], [true], [true]])
  })
})
