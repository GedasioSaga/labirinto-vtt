import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ALARM_SPACE_VAR, ALARM_VIBRATION, PlayerAlarmBanner, vibrarAlarme } from './PlayerAlarmBanner'

describe('vibrarAlarme', () => {
  it('vibra quando o navegador deixa, com o padrão do alarme', () => {
    const vibrate = vi.fn(() => true)
    expect(vibrarAlarme({ vibrate })).toBe(true)
    expect(vibrate).toHaveBeenCalledWith(ALARM_VIBRATION)
    expect(ALARM_VIBRATION.length).toBeGreaterThan(0)
  })

  it('sem vibração (iPhone, computador) ou com o navegador recusando: segue sem erro', () => {
    expect(vibrarAlarme(undefined)).toBe(false)
    expect(vibrarAlarme({})).toBe(false)
    expect(vibrarAlarme({ vibrate: () => false })).toBe(false)
    expect(
      vibrarAlarme({
        vibrate: () => {
          throw new Error('bloqueado')
        },
      }),
    ).toBe(false)
  })
})

describe('PlayerAlarmBanner (alarme do mestre)', () => {
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

  it('anuncia como alerta, mostra HTML do mestre como TEXTO e não tem botão de fechar', () => {
    act(() => root.render(<PlayerAlarmBanner text={'<b>Fogo</b><img src=x onerror="alert(1)">'} vibrationTarget={undefined} />))
    const alerta = container.querySelector('[role="alert"]')
    expect(alerta).not.toBeNull()
    expect(alerta?.textContent).toContain('<b>Fogo</b><img src=x onerror="alert(1)">')
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })

  it('vibra uma vez ao aparecer, e não de novo a cada render do mesmo alarme', () => {
    const vibrate = vi.fn(() => true)
    act(() => root.render(<PlayerAlarmBanner text="Sino!" vibrationTarget={{ vibrate }} />))
    act(() => root.render(<PlayerAlarmBanner text="Sino!" vibrationTarget={{ vibrate }} />))
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('reserva o alto da tela enquanto soa e devolve ao sair', () => {
    act(() => root.render(<PlayerAlarmBanner text="Sino!" vibrationTarget={undefined} />))
    expect(document.documentElement.style.getPropertyValue(ALARM_SPACE_VAR)).toMatch(/^\d+px$/)
    act(() => root.render(<></>))
    expect(document.documentElement.style.getPropertyValue(ALARM_SPACE_VAR)).toBe('')
  })

  it('não rouba o foco ao aparecer', () => {
    const campo = document.createElement('input')
    document.body.appendChild(campo)
    campo.focus()
    act(() => root.render(<PlayerAlarmBanner text="Sino!" vibrationTarget={undefined} />))
    expect(document.activeElement).toBe(campo)
    campo.remove()
  })
})
