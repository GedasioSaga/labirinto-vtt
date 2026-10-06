import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CenarioSection } from './CenarioSection'
import { CENARIO_PADRAO, type CenarioDoPino } from './catalogo'

let container: HTMLDivElement
let root: Root
const IMAGEM = 'data:image/png;base64,AAAA'

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

const botao = (texto: string) => {
  const achado = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === texto || (b.textContent ?? '').trim() === texto)
  if (!achado) throw new Error(`sem o botão "${texto}"`)
  return achado
}

function render(cenario: CenarioDoPino | undefined, imagem: string | null = IMAGEM, onChange = vi.fn()) {
  act(() => root.render(<CenarioSection cenario={cenario} imagem={imagem} onChange={onChange} />))
  return onChange
}

describe('CenarioSection', () => {
  it('pino sem imagem: só o aviso, sem opções', () => {
    render(undefined, null)
    expect(container.textContent).toContain('Coloque uma imagem no pino')
    expect(container.querySelector('[role="radio"]')).toBeNull()
  })

  it('"Só da primeira vez" liga com o padrão; "Não, só o cartão" desliga', () => {
    const onChange = render(undefined)
    expect(botao('Não, só o cartão').getAttribute('aria-checked')).toBe('true')
    act(() => botao('Só da primeira vez').click())
    expect(onChange).toHaveBeenLastCalledWith(CENARIO_PADRAO)
    render(CENARIO_PADRAO, IMAGEM, onChange)
    act(() => botao('Sempre').click())
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, quando: 'sempre' })
    act(() => botao('Não, só o cartão').click())
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('escolher movimento e desligar um efeito gravam no pino', () => {
    const onChange = render(CENARIO_PADRAO)
    act(() => botao('De cima para baixo').click())
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, movimento: 'desce' })
    const nevoa = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.startsWith('Névoa'))?.querySelector('input') as HTMLInputElement
    act(() => nevoa.click())
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, nevoa: false })
  })

  it('o botão de assistir abre a janela da animação', () => {
    render(CENARIO_PADRAO)
    act(() => botao('Assistir Aproximar').click())
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Aproximar')
    act(() => botao('Fechar').click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
