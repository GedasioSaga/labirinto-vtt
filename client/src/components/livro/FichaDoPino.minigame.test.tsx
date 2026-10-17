import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FichaDoPino, type FichaDoPinoProps } from './FichaDoPino'

/**
 * O "Tipo do pino" com o MINIGAME: a opção aparece por último, com o controle
 * desenhado (o Tipo é só de ícone; o nome vai no balão e no leitor de tela), e
 * escolhê-la avisa o painel. Aberto como minigame, a ficha não oferece item nem
 * loja no "+ Adicionar ao pino" (o desafio não vai para a mochila nem vende).
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
  window.localStorage.clear()
})

function render(extra: Partial<FichaDoPinoProps>): void {
  const props: FichaDoPinoProps = {
    pinId: 'm',
    kind: 'exclamacao',
    onKindChange: () => {},
    description: '',
    onDescriptionChange: () => {},
    locked: false,
    onLockedChange: () => {},
    marco: false,
    onMarcoChange: () => {},
    lerDePerto: null,
    onLerDePertoChange: () => {},
    image: null,
    onChooseImage: () => {},
    onClearImage: () => {},
    iconChoice: null,
    quemVe: null,
    ...extra,
  }
  // Cada tipo remonta a ficha, como o painel faz ao trocar de pino: o menu começa fechado.
  act(() => root.render(<FichaDoPino key={props.kind} {...props} />))
}

function opcoes(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radiogroup"][aria-label="Tipo do pino"] [role="radio"]'))
}

/** Os recursos que o "+ Adicionar ao pino" oferece; sem o botão, nenhum. */
function oferecidos(): string[] {
  const mais = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Adicionar ao pino')
  if (mais === undefined) return []
  act(() => mais.click())
  return Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent ?? '')
}

describe('FichaDoPino: tipo minigame', () => {
  it('o minigame é a última opção, com o controle desenhado', () => {
    render({})
    const ultima = opcoes().at(-1)
    expect(ultima?.getAttribute('aria-label')).toBe('Minigame')
    expect(ultima?.querySelector('svg')).not.toBeNull()
  })

  it('escolher a opção avisa o painel com o tipo novo', () => {
    const onKindChange = vi.fn()
    render({ onKindChange })
    const ultima = opcoes().at(-1)
    if (ultima === undefined) throw new Error('sem opções no Tipo do pino')
    act(() => ultima.click())
    expect(onKindChange).toHaveBeenCalledWith('minigame')
  })

  it('aberto como minigame: título, opção marcada, sem item e sem loja', () => {
    const comItemELoja: Partial<FichaDoPinoProps> = {
      item: { value: null, onChange: () => {}, onTrocarForma: () => {} },
      loja: { pinId: 'm', loja: null, onChange: () => {} },
    }
    // Controle: no "!", os mesmos props oferecem item e loja.
    render({ ...comItemELoja, kind: 'exclamacao' })
    const noExclamacao = oferecidos()
    expect(noExclamacao.some((item) => item.includes('Item pegável'))).toBe(true)
    expect(noExclamacao.some((item) => item.includes('Loja com preços'))).toBe(true)

    render({ ...comItemELoja, kind: 'minigame' })
    expect(container.querySelector('h2')?.textContent).toBe('Minigame')
    expect(opcoes().find((b) => b.getAttribute('aria-checked') === 'true')?.getAttribute('aria-label')).toBe('Minigame')
    const noMinigame = oferecidos()
    expect(noMinigame.some((item) => item.includes('Item pegável'))).toBe(false)
    expect(noMinigame.some((item) => item.includes('Loja com preços'))).toBe(false)
    expect(container.textContent).not.toContain('Item pegável')
  })
})
