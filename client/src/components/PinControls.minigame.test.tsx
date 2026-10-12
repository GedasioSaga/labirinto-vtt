import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinControls, type PinControlsProps } from './PinControls'

/**
 * O seletor "Tipo do pino" com o MINIGAME: a opção aparece por último, com o
 * controle desenhado, e escolhê-la avisa o painel. Aberto como minigame, o
 * painel não oferece item nem loja (o desafio não vai para a mochila nem vende).
 */

describe('PinControls: tipo minigame', () => {
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

  function render(extra: Partial<PinControlsProps>): void {
    const props: PinControlsProps = {
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
      onDelete: () => {},
      iconChoice: null,
      ...extra,
    }
    act(() => root.render(<PinControls {...props} />))
  }

  function opcoes(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radiogroup"][aria-label="Tipo do pino"] [role="radio"]'))
  }

  it('o minigame é a última opção, com o controle desenhado', () => {
    render({})
    const ultima = opcoes().at(-1)
    expect(ultima?.textContent).toBe('Minigame')
    expect(ultima?.querySelector('svg')).not.toBeNull()
  })

  it('escolher a opção avisa o painel com o tipo novo', () => {
    const onKindChange = vi.fn()
    render({ onKindChange })
    act(() => opcoes().at(-1)?.click())
    expect(onKindChange).toHaveBeenCalledWith('minigame')
  })

  it('aberto como minigame: título, opção marcada, sem item e sem loja', () => {
    const comItemELoja: Partial<PinControlsProps> = {
      item: { value: null, onChange: () => {}, onTrocarForma: () => {} },
      loja: { pinId: 'm', loja: null, onChange: () => {} },
    }
    // Controle: no "!", os mesmos props mostram item e loja.
    render({ ...comItemELoja, kind: 'exclamacao' })
    expect(container.textContent).toContain('Item pegável')
    expect(container.textContent).toContain('Loja com preços')

    render({ ...comItemELoja, kind: 'minigame' })
    expect(container.querySelector('h2')?.textContent).toBe('Minigame')
    expect(opcoes().find((b) => b.getAttribute('aria-checked') === 'true')?.textContent).toBe('Minigame')
    expect(container.textContent).not.toContain('Item pegável')
    expect(container.textContent).not.toContain('Loja com preços')
    expect(container.textContent).toContain('Excluir minigame')
  })
})
