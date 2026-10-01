import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PastaDoAcervo } from '../lib/tokenLibrary'
import type { NovoTokenProps } from './NovoTokenForm'
import { TokenLibraryPanel, type TokenLibraryPanelProps } from './TokenLibraryPanel'

/**
 * "+ TOKEN" NO ACERVO (pedido painel-acervo, fatia 2): o "Adicionar token" da
 * antiga seção "Seleção" mora agora na linha do título do Acervo, ao lado do
 * "+ Pasta" — criar e guardar token no mesmo lugar, como o diretório de Atores
 * do Foundry. O Acervo só o mostra quando ALGO está selecionado: sem seleção,
 * o mesmo botão está na faixa do topo (`NadaSelecionado`), e as jornadas
 * clicam `getByRole('button', { name: 'Adicionar token' })` sem `exact` — dois
 * botões com esse trecho no nome quebrariam o modo estrito.
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

function novoToken(onAddToken = vi.fn<(nome: string) => void>()): NovoTokenProps {
  return { defaultTokenName: 'Token 1', onAddToken }
}

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

function campoNovoToken(): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>('input#lb-new-token-name')
}

function esc(alvo: Element) {
  act(() => {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  })
}

describe('Acervo — "+ Token" e "+ Pasta" na linha do título', () => {
  it('com algo selecionado: UM "Adicionar token" na linha do título, que se lê "+ Token"', () => {
    montar({ novoToken: novoToken() })
    const [token, ...sobra] = botoesNoTopo('Adicionar token')
    expect(sobra).toHaveLength(0)
    expect(textoVisivel(token)).toBe('+ Token')
    // As jornadas procuram o trecho sem `exact`: nenhum outro botão da seção pode contê-lo.
    expect([...container.querySelectorAll('button')].filter((b) => /adicionar token/i.test(nomeAcessivel(b)))).toHaveLength(1)
  })

  it('clicar abre "Nome do novo token" com o nome sugerido no lugar do botão; Enter cria e fecha', () => {
    const onAddToken = vi.fn<(nome: string) => void>()
    montar({ novoToken: novoToken(onAddToken) })
    act(() => botoesNoTopo('Adicionar token')[0]?.click())

    expect(campoNovoToken()?.value).toBe('Token 1')
    expect(document.activeElement).toBe(campoNovoToken())
    expect(botoesNoTopo('Adicionar token')).toHaveLength(0)

    act(() => campoNovoToken()?.form?.requestSubmit())
    expect(onAddToken).toHaveBeenCalledWith('Token 1')
    expect(campoNovoToken()).toBeNull()
    expect(botoesNoTopo('Adicionar token')).toHaveLength(1)
  })

  it('Esc fecha sem criar e devolve o foco ao "+ Token" que abriu o campo', () => {
    const onAddToken = vi.fn<(nome: string) => void>()
    montar({ novoToken: novoToken(onAddToken) })
    act(() => botoesNoTopo('Adicionar token')[0]?.click())
    esc(document.activeElement ?? container)

    expect(campoNovoToken()).toBeNull()
    expect(onAddToken).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(botoesNoTopo('Adicionar token')[0])
  })

  it('o de pasta se chama "Nova pasta" e se lê "+ Pasta"; no navegador (sem disco) só ele some', () => {
    montar({ novoToken: novoToken() })
    const [pasta] = botoesNoTopo('Nova pasta')
    expect(textoVisivel(pasta)).toBe('+ Pasta')
    // Na ordem da leitura: primeiro o token, depois a pasta.
    expect(textoVisivel(topo())).toBe('Acervo de tokens+ Token+ Pasta')

    montar({ novoToken: novoToken(), itens: [], pastas: [], podeOrganizar: false })
    expect(botoesNoTopo('Nova pasta')).toHaveLength(0)
    expect(botoesNoTopo('Adicionar token')).toHaveLength(1)
  })

  it('sem nada selecionado (sem `novoToken`) o Acervo não tem "Adicionar token": ele está na faixa do topo', () => {
    montar()
    expect([...container.querySelectorAll('button')].filter((b) => /adicionar token/i.test(nomeAcessivel(b)))).toHaveLength(0)
    expect(botoesNoTopo('Nova pasta')).toHaveLength(1)
  })

  it('a seleção acaba com o campo aberto: o campo fecha junto, e não fica um segundo "Nome do novo token" na página', () => {
    const props = montar({ novoToken: novoToken() })
    act(() => botoesNoTopo('Adicionar token')[0]?.click())
    expect(campoNovoToken()).not.toBeNull()
    montar({ ...props, novoToken: undefined })
    expect(campoNovoToken()).toBeNull()
    // A seleção volta: o campo não reaparece sozinho (com `autoFocus` ele roubaria o foco).
    montar({ ...props, novoToken: novoToken() })
    expect(campoNovoToken()).toBeNull()
  })

  it('um campo de cada vez na linha do título: abrir o de token fecha o de pasta, e vice-versa', () => {
    montar({ novoToken: novoToken() })
    act(() => botoesNoTopo('Nova pasta')[0]?.click())
    expect(container.querySelector('input[aria-label="Nome da nova pasta"]')).not.toBeNull()
    act(() => botoesNoTopo('Adicionar token')[0]?.click())
    expect(container.querySelector('input[aria-label="Nome da nova pasta"]')).toBeNull()
    expect(campoNovoToken()).not.toBeNull()
    act(() => botoesNoTopo('Nova pasta')[0]?.click())
    expect(campoNovoToken()).toBeNull()
    expect(container.querySelector('input[aria-label="Nome da nova pasta"]')).not.toBeNull()
  })

  it('no pé da coluna, cada campo vem inteiro para a vista ao abrir (o Cancelar e o Criar não ficam cortados), uma vez só', () => {
    const rolar = vi.fn()
    Object.defineProperty(HTMLFormElement.prototype, 'scrollIntoView', { configurable: true, value: rolar })
    try {
      montar({ novoToken: novoToken() })
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

      act(() => botoesNoTopo('Adicionar token')[0]?.click())
      expect(rolar).toHaveBeenCalledTimes(2)
      expect(rolar.mock.contexts[1]).toBe(container.querySelector('form.lb-novotoken'))
    } finally {
      Reflect.deleteProperty(HTMLFormElement.prototype, 'scrollIntoView')
    }
  })

  it('a raiz do acervo tem a classe que o CSS do componente usa para vencer o main.css', () => {
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
  it('a linha quebra em vez de vazar da coluna de 264 px, e as duas ações ficam à direita, a um vão do tema', async () => {
    const css = await lerCss('./TokenLibraryPanel.css')
    expect(regra(css, '.lb-acervo-painel .lb-acervo__topo').get('flex-wrap')).toBe('wrap')
    const acoes = regra(css, '.lb-acervo-painel .lb-acervo__acoes-topo')
    expect(acoes.get('gap')).toBe('var(--lb-control-gap)')
    expect(acoes.get('margin-left')).toBe('auto')
    // A pastilha (4 px de cada lado) avança no respiro da seção: o texto termina na vertical dos campos.
    expect(acoes.get('margin-right')).toBe('calc(-1 * var(--lb-space-1))')
    expect(regra(await lerCss('./BotaoMais.css'), '.lb-mais__chip').get('padding')).toBe('0 var(--lb-space-1)')
  })

  it('o "+ Coisa" tem o alvo mínimo do tema, e na faixa do topo o alvo é a altura da faixa', async () => {
    const css = await lerCss('./BotaoMais.css')
    expect(regra(css, '.lb-mais').get('min-height')).toBe('var(--lb-control-min)')
    expect(regra(css, '.lb-mais__chip').get('min-height')).toBe('var(--lb-control-min)')
    expect(regra(css, '.lb-mais--alto').get('min-height')).toBe('44px')
    // Aperto que responde na hora, como o resto do app (Emil: scale(0.97) no :active).
    expect(regra(css, '.lb-mais:active .lb-mais__chip').get('transform')).toBe('scale(0.97)')
    // O anel de foco abraça a pastilha, não a área de clique inteira.
    expect(regra(css, '.lb-mais:focus-visible .lb-mais__chip').get('box-shadow')).toBe('var(--lb-shadow-focus)')
  })
})
