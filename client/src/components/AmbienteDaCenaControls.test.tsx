/**
 * AMBIENTE DA CENA (Luz L4c), o painel da página Cena: período fixo com a
 * frase do que a cena mostra, Tarde/Noite com cor, força e visão em casas,
 * os atalhos da noite, e a prévia no mapa com "Ver como jogador" (só no
 * editor, nada vai ao arquivo nem ao jogador).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AmbienteDaCenaControls, resumoDoAmbiente, type AmbienteDaCenaControlsProps } from './AmbienteDaCenaControls'
import { useTintaNoEditor } from '../stores/tintaNoEditor'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useTintaNoEditor.setState({ comoJogador: false, previa: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(props: Partial<AmbienteDaCenaControlsProps> = {}) {
  const handlers = {
    onPeriodoFixoChange: vi.fn(),
    onCorChange: vi.fn(),
    onForcaChange: vi.fn(),
    onVisaoChange: vi.fn(),
    onAtalho: vi.fn(),
    onPadrao: vi.fn(),
  }
  act(() => root.render(<AmbienteDaCenaControls periodoDaSessao="dia" cena={{}} {...handlers} {...props} />))
  return handlers
}

function grupo(nome: string): HTMLElement {
  const achado = container.querySelector<HTMLElement>(`[role="radiogroup"][aria-label="${nome}"]`)
  if (achado === null) throw new Error(`sem o grupo ${nome}`)
  return achado
}

function radiosDe(nome: string): HTMLButtonElement[] {
  return Array.from(grupo(nome).querySelectorAll<HTMLButtonElement>('[role="radio"]'))
}

function botao(texto: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === texto)
  if (achado === undefined) throw new Error(`sem o botão ${texto}`)
  return achado
}

function campoPorRotulo(texto: string): HTMLInputElement {
  const rotulo = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.startsWith(texto))
  const id = rotulo?.getAttribute('for')
  // O interruptor (`Toggle`) é o rótulo em volta do próprio campo, sem `for`.
  const porId = id ? document.getElementById(id) : null
  const campo = id ? (porId instanceof HTMLInputElement ? porId : null) : (rotulo?.querySelector<HTMLInputElement>('input') ?? null)
  if (campo === null) throw new Error(`sem o campo ${texto}`)
  return campo
}

function mudar(campo: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(campo, valor)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('AmbienteDaCenaControls', () => {
  it('período fixo: Nenhum marcado na cena sem campo, e a frase diz o que ela mostra', () => {
    const { onPeriodoFixoChange } = render({ cena: { externa: true }, periodoDaSessao: 'tarde' })
    expect(radiosDe('Período fixo').map((r) => [r.textContent, r.getAttribute('aria-checked')])).toEqual([
      ['Nenhum', 'true'],
      ['Dia', 'false'],
      ['Tarde', 'false'],
      ['Noite', 'false'],
    ])
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Esta cena segue o período: agora está à tarde.')
    act(() => radiosDe('Período fixo')[3].click())
    expect(onPeriodoFixoChange).toHaveBeenCalledWith('noite')
    act(() => radiosDe('Período fixo')[0].click())
    expect(onPeriodoFixoChange).toHaveBeenLastCalledWith(undefined)
  })

  it('abre ajustando o período em que a cena está; senão, a noite', () => {
    render({ cena: { periodoFixo: 'tarde' } })
    expect(radiosDe('Ajustar').find((r) => r.getAttribute('aria-checked') === 'true')?.textContent).toBe('Tarde')
    act(() => root.unmount())
    root = createRoot(container)
    render({ cena: {} })
    expect(radiosDe('Ajustar').find((r) => r.getAttribute('aria-checked') === 'true')?.textContent).toBe('Noite')
  })

  it('a força mostra o valor da cena (ou o padrão) e o deslizante pede a força nova', () => {
    const { onForcaChange } = render({ cena: { ambientePorPeriodo: { noite: { forca: 0.4 } } } })
    const forca = campoPorRotulo('Força')
    expect(forca.type).toBe('range')
    expect(forca.value).toBe('0.4')
    expect(container.textContent).toContain('40%')
    mudar(forca, '0.65')
    expect(onForcaChange).toHaveBeenCalledWith('noite', 0.65)
  })

  it('visão em casas: vazio pede "sem valor", 0 vale, fora da faixa não grava', () => {
    const { onVisaoChange } = render({ cena: { visaoPorPeriodo: { noite: 3 } } })
    const visao = campoPorRotulo('Visão')
    expect(visao.value).toBe('3')
    mudar(visao, '0')
    expect(onVisaoChange).toHaveBeenLastCalledWith('noite', 0)
    mudar(visao, '')
    expect(onVisaoChange).toHaveBeenLastCalledWith('noite', undefined)
    onVisaoChange.mockClear()
    mudar(visao, '201')
    mudar(visao, '2.5')
    expect(onVisaoChange).not.toHaveBeenCalled()
  })

  it('os atalhos da noite aparecem ajustando a noite e o que casa com a cena fica marcado', () => {
    const { onAtalho } = render({ cena: { ambientePorPeriodo: { noite: { cor: '#10131f', forca: 1 } }, visaoPorPeriodo: { noite: 0 } } })
    expect(botao('Escuridão total').getAttribute('aria-pressed')).toBe('true')
    expect(botao('Noite leve').getAttribute('aria-pressed')).toBe('false')
    act(() => botao('Noite fechada').click())
    expect(onAtalho).toHaveBeenCalledWith('noite-fechada')
    act(() => radiosDe('Ajustar')[0].click())
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Noite leve')).toBe(false)
  })

  it('cor e "Voltar ao padrão" falam do período que se ajusta', () => {
    const { onCorChange, onPadrao } = render({ cena: { ambientePorPeriodo: { tarde: { forca: 0.2 } } } })
    act(() => radiosDe('Ajustar')[0].click())
    mudar(campoPorRotulo('Cor'), '#123456')
    expect(onCorChange).toHaveBeenCalledWith('tarde', '#123456')
    act(() => botao('Voltar ao padrão').click())
    expect(onPadrao).toHaveBeenCalledWith('tarde')
  })

  it('"Voltar ao padrão" fica desligado quando o período já está no padrão', () => {
    render({ cena: {} })
    expect(botao('Voltar ao padrão').disabled).toBe(true)
  })

  it('a prévia mostra no mapa o período que se ajusta e some quando o painel sai', () => {
    render({ cena: {} })
    const previa = campoPorRotulo('Prévia no mapa')
    act(() => previa.click())
    expect(useTintaNoEditor.getState().previa).toBe('noite')
    act(() => radiosDe('Ajustar')[0].click())
    expect(useTintaNoEditor.getState().previa).toBe('tarde')
    act(() => root.unmount())
    root = createRoot(container)
    expect(useTintaNoEditor.getState().previa).toBeNull()
  })

  it('"Ver como jogador" é o mesmo do painel Período', () => {
    render({ cena: {} })
    act(() => campoPorRotulo('Ver como jogador').click())
    expect(useTintaNoEditor.getState().comoJogador).toBe(true)
  })
})

describe('resumoDoAmbiente', () => {
  it('diz o atalho que casa, ou a força da noite, e o período fixo', () => {
    expect(resumoDoAmbiente({})).toBe('Noite 85%')
    expect(resumoDoAmbiente({ ambientePorPeriodo: { noite: { cor: '#10131f', forca: 1 } }, visaoPorPeriodo: { noite: 0 }, periodoFixo: 'noite' })).toBe('Escuridão total, sempre à noite')
  })
})
