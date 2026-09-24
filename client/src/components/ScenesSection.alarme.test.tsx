import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALARM_MAX_LENGTH } from '../net/protocol'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection, type ScenesSectionProps } from './ScenesSection'
import { alarmFeedbackText } from './SceneAlarmControls'

const CENAS: SceneListItem[] = [
  { id: 's-salao', name: 'Salao Norte', active: true, available: true, renamable: true, tokenCount: 1 },
  { id: 's-cripta', name: 'Cripta Rubra', active: false, available: true, renamable: false, tokenCount: 1 },
  { id: 's-porao', name: 'Porao Umido', active: false, available: true, renamable: false, tokenCount: 1 },
  { id: 's-perdida', name: 'Sala Perdida', active: false, available: false, renamable: false, tokenCount: null },
]

describe('ScenesSection: "Alarme" para várias cenas', () => {
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
  })

  function render(extra: Partial<ScenesSectionProps> = {}): void {
    act(() => root.render(<ScenesSection scenes={CENAS} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} {...extra} />))
  }

  function botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
  }

  function caixa(nome: string): HTMLInputElement | undefined {
    return Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find((c) => c.labels?.[0]?.textContent === nome)
  }

  function campo(): HTMLTextAreaElement | null {
    return container.querySelector('.lb-alarme textarea')
  }

  function digita(texto: string): void {
    const alvo = campo()
    if (alvo === null) throw new Error('campo do alarme não abriu')
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    act(() => {
      setter?.call(alvo, texto)
      alvo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function tecla(key: string, ctrlKey = false): void {
    const alvo = campo()
    if (alvo === null) throw new Error('campo do alarme não abriu')
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey, bubbles: true }))
    })
  }

  it('sem sala (sem onAlarm) não há "Alarme"', () => {
    render()
    expect(botao('Alarme…')).toBeUndefined()
  })

  it('mapa solto (sem aventura) com a sala aberta: não há "Alarme" sem cena para escolher', () => {
    // sceneList() devolve a entrada única de id '' quando não há aventura.
    const solto: SceneListItem[] = [{ id: '', name: 'Mapa solto', active: true, available: true, renamable: false, tokenCount: 2 }]
    act(() =>
      root.render(<ScenesSection scenes={solto} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} onAlarm={() => 1} onEndAlarm={() => {}} />),
    )
    expect(botao('Alarme…')).toBeUndefined()
    expect(container.querySelector('.lb-alarme')).toBeNull()
    // A seção continua lá: o resto dela não some junto.
    expect(botao('+ Nova cena')?.textContent).toBe('+ Nova cena')
  })

  it('aventura sem nenhuma cena com arquivo: não há "Alarme", mas um alarme soando ainda se encerra', () => {
    const semArquivo: SceneListItem[] = [{ id: 's-perdida', name: 'Sala Perdida', active: false, available: false, renamable: false, tokenCount: null }]
    const onEndAlarm = vi.fn()
    act(() =>
      root.render(
        <ScenesSection
          scenes={semArquivo}
          onSelect={() => {}}
          onCreate={() => {}}
          onRename={() => {}}
          onAlarm={() => 1}
          onEndAlarm={onEndAlarm}
          alarm={{ text: 'Desabamento!', sceneIds: ['s-perdida'] }}
        />,
      ),
    )
    expect(botao('Alarme…')).toBeUndefined()
    act(() => botao('Encerrar alarme')?.click())
    expect(onEndAlarm).toHaveBeenCalledTimes(1)
  })

  it('escolhe duas cenas, escreve e "Soar alarme" manda as duas de uma vez', () => {
    const onAlarm = vi.fn(() => 2)
    render({ onAlarm, onEndAlarm: () => {} })
    act(() => botao('Alarme…')?.click())
    expect(campo()?.maxLength).toBe(ALARM_MAX_LENGTH)
    // Cena sem arquivo não tem quem avisar: a caixa dela fica desligada.
    expect(caixa('Sala Perdida')?.disabled).toBe(true)
    act(() => caixa('Porao Umido')?.click())
    act(() => caixa('Salao Norte')?.click())
    digita('O sino da torre tocou!')
    act(() => botao('Soar alarme')?.click())
    // Na ordem da lista, não na ordem dos cliques.
    expect(onAlarm).toHaveBeenCalledWith(['s-salao', 's-porao'], 'O sino da torre tocou!')
    expect(campo()).toBeNull()
    expect(container.querySelector('.lb-alarme [role="status"]')?.textContent).toBe('Alarme soou para 2 jogadores')
  })

  it('"Todas as cenas" marca o andar inteiro, e desmarcar tira todas', () => {
    const onAlarm = vi.fn(() => 3)
    render({ onAlarm, onEndAlarm: () => {} })
    act(() => botao('Alarme…')?.click())
    act(() => caixa('Todas as cenas')?.click())
    expect([caixa('Salao Norte')?.checked, caixa('Cripta Rubra')?.checked, caixa('Porao Umido')?.checked]).toEqual([true, true, true])
    act(() => caixa('Todas as cenas')?.click())
    expect([caixa('Salao Norte')?.checked, caixa('Cripta Rubra')?.checked, caixa('Porao Umido')?.checked]).toEqual([false, false, false])
    act(() => caixa('Todas as cenas')?.click())
    digita('Catástrofe!')
    tecla('Enter', true)
    expect(onAlarm).toHaveBeenCalledWith(['s-salao', 's-cripta', 's-porao'], 'Catástrofe!')
  })

  it('sem cena ou sem texto não soa; Esc cancela sem soar', () => {
    const onAlarm = vi.fn(() => 1)
    render({ onAlarm, onEndAlarm: () => {} })
    act(() => botao('Alarme…')?.click())
    digita('Fogo!')
    expect(botao('Soar alarme')?.disabled).toBe(true)
    act(() => caixa('Cripta Rubra')?.click())
    digita('   ')
    expect(botao('Soar alarme')?.disabled).toBe(true)
    tecla('Enter', true)
    digita('Fogo!')
    tecla('Escape')
    expect(campo()).toBeNull()
    expect(onAlarm).not.toHaveBeenCalled()
  })

  it('alarme ativo: mostra o texto e as cenas, e "Encerrar alarme" encerra', () => {
    const onEndAlarm = vi.fn()
    render({ onAlarm: () => 1, onEndAlarm, alarm: { text: 'Desabamento!', sceneIds: ['s-salao', 's-porao'] } })
    const ativo = container.querySelector('.lb-alarme__ativo')
    expect(ativo?.textContent).toContain('Desabamento!')
    expect(ativo?.textContent).toContain('Salao Norte, Porao Umido')
    act(() => botao('Encerrar alarme')?.click())
    expect(onEndAlarm).toHaveBeenCalledTimes(1)
  })

  it('aviso: plural, singular, ninguém ainda e sala fechada', () => {
    expect(alarmFeedbackText(3)).toBe('Alarme soou para 3 jogadores')
    expect(alarmFeedbackText(1)).toBe('Alarme soou para 1 jogador')
    expect(alarmFeedbackText(0)).toBe('Ninguém está nessas cenas agora: quem chegar verá o alarme')
    expect(alarmFeedbackText(null)).toMatch(/sala/)
  })
})
