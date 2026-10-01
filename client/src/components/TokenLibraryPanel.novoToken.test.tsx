import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PastaDoAcervo } from '../lib/tokenLibrary'
import { TokenLibraryPanel, type TokenLibraryPanelProps } from './TokenLibraryPanel'

/**
 * O "+ TOKEN" SAIU DO ACERVO (pedido painel-acervo, correção depois da
 * conferência): com algo selecionado ele morava aqui, no pé da coluna, a uns
 * 1500 px do topo — criar outro token pedia rolar a coluna inteira. Agora ele
 * mora no cabeçalho do painel, o mesmo lugar com e sem seleção
 * (PropertiesPanel.selecao.test.tsx). Na linha do título do Acervo fica só o
 * "+ Pasta", e as jornadas, que clicam `getByRole('button', { name:
 * 'Adicionar token' })` sem `exact`, continuam achando UM botão na página.
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

const PASTAS: PastaDoAcervo[] = [{ id: 'npcs', nome: 'NPCs', recolhida: false }]

function montar(extra: Partial<TokenLibraryPanelProps> = {}) {
  const props: TokenLibraryPanelProps = {
    itens: [],
    pastas: PASTAS,
    aviso: null,
    podeOrganizar: true,
    onPlace: vi.fn(),
    onDropOnMap: vi.fn(() => false),
    onDelete: vi.fn(),
    onCriarPasta: vi.fn(),
    onMover: vi.fn(),
    onRecolherPasta: vi.fn(),
    onApagarPasta: vi.fn(),
    ...extra,
  }
  act(() => root.render(<TokenLibraryPanel {...props} />))
  return props
}

/** O nome que o leitor de tela (e o `getByRole` das jornadas) lê. */
const nomeAcessivel = (el: Element) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''
const textoVisivel = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()

function topo(): HTMLElement {
  const alvo = container.querySelector<HTMLElement>('.lb-acervo__topo')
  if (alvo === null) throw new Error('sem a linha do título do acervo')
  return alvo
}

function botoesNoTopo(nome: string): HTMLButtonElement[] {
  return [...topo().querySelectorAll<HTMLButtonElement>('button')].filter((b) => nomeAcessivel(b) === nome)
}

describe('Acervo — a linha do título só com o "+ Pasta"', () => {
  it('nenhum "Adicionar token" no Acervo: o "+ Token" mora no cabeçalho do painel', () => {
    montar()
    expect([...container.querySelectorAll('button')].filter((b) => /adicionar token/i.test(nomeAcessivel(b)))).toHaveLength(0)
    expect(container.querySelector('#lb-new-token-name')).toBeNull()
  })

  it('o de pasta se chama "Nova pasta" e se lê "+ Pasta", logo depois do título; no navegador (sem disco) a linha fica só com o título', () => {
    montar()
    const [pasta, ...sobra] = botoesNoTopo('Nova pasta')
    expect(sobra).toHaveLength(0)
    expect(textoVisivel(pasta)).toBe('+ Pasta')
    expect(textoVisivel(topo())).toBe('Acervo de tokens+ Pasta')

    montar({ itens: [], pastas: [], podeOrganizar: false })
    expect(botoesNoTopo('Nova pasta')).toHaveLength(0)
    expect(topo().querySelectorAll('button')).toHaveLength(0)
  })

  it('no pé da coluna, o campo de pasta vem inteiro para a vista ao abrir (o Cancelar e o Criar não ficam cortados), uma vez só', () => {
    const rolar = vi.fn()
    Object.defineProperty(HTMLFormElement.prototype, 'scrollIntoView', { configurable: true, value: rolar })
    try {
      montar()
      act(() => botoesNoTopo('Nova pasta')[0]?.click())
      expect(rolar).toHaveBeenCalledTimes(1)
      expect(rolar).toHaveBeenLastCalledWith({ block: 'nearest' })
      expect(rolar.mock.contexts[0]).toBe(container.querySelector('form.lb-acervo__form'))
      // Digitar re-renderiza o acervo, e não pode puxar a coluna de volta a cada tecla.
      const campo = container.querySelector<HTMLInputElement>('input[aria-label="Nome da nova pasta"]')
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      act(() => {
        setter?.call(campo, 'Chefes')
        campo?.dispatchEvent(new Event('input', { bubbles: true }))
      })
      expect(rolar).toHaveBeenCalledTimes(1)
    } finally {
      Reflect.deleteProperty(HTMLFormElement.prototype, 'scrollIntoView')
    }
  })

  it('a raiz do acervo tem a classe que o CSS do componente usa como contexto (o vão do acervo vazio, a lista solta sem pastas)', () => {
    montar()
    expect(container.querySelector('section')?.classList.contains('lb-acervo-painel')).toBe(true)
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

describe('Acervo — CSS da linha do título', () => {
  it('a linha quebra em vez de vazar da coluna de 264 px, e a ação fica à direita', async () => {
    const css = await lerCss('./TokenLibraryPanel.css')
    expect(regra(css, '.lb-acervo__topo').get('flex-wrap')).toBe('wrap')
    const acoes = regra(css, '.lb-acervo__acoes-topo')
    expect(acoes.get('margin-left')).toBe('auto')
    // A pastilha (4 px de cada lado) avança no respiro da seção: o texto termina na vertical dos campos.
    expect(acoes.get('margin-right')).toBe('calc(-1 * var(--lb-space-1))')
    expect(regra(await lerCss('./BotaoMais.css'), '.lb-mais__chip').get('padding')).toBe('0 var(--lb-space-1)')
  })

  it('o "+ Coisa" tem o alvo mínimo do tema, aperta na hora e o anel abraça a pastilha', async () => {
    const css = await lerCss('./BotaoMais.css')
    expect(regra(css, '.lb-mais').get('min-height')).toBe('var(--lb-control-min)')
    expect(regra(css, '.lb-mais__chip').get('min-height')).toBe('var(--lb-control-min)')
    // Aperto que responde na hora, como o resto do app (Emil: scale(0.97) no :active).
    expect(regra(css, '.lb-mais:active .lb-mais__chip').get('transform')).toBe('scale(0.97)')
    // O anel de foco abraça a pastilha, não a área de clique inteira.
    expect(regra(css, '.lb-mais:focus-visible .lb-mais__chip').get('box-shadow')).toBe('var(--lb-shadow-focus)')
  })
})
