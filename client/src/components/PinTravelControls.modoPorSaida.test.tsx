import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExitPassage, Pin, PinPassage } from '../types/map'
import { PinTravelControls, type PinTravelControlsProps, type PinTravelExitView } from './PinTravelControls'

/**
 * MODO POR SAÍDA no painel do mestre: numa encruzilhada, cada saída EXTRA
 * ganha "Passagem desta saída" — como a principal, pede, livre ou trancada.
 * A principal segue a "Passagem" do pino, logo abaixo.
 */

const PAR: Pin = { id: 'p', x: 0, y: 0, kind: 'viagem', description: '', image: null }

function ligada(id: string, sceneName: string, passagem?: ExitPassage): PinTravelExitView {
  const view: PinTravelExitView = { id, rotulo: sceneName, travel: { status: 'ligado', sceneId: `cena-${sceneName}`, sceneName, partner: PAR } }
  if (passagem !== undefined) view.passagem = passagem
  return view
}

function props(passage: PinPassage, exits: readonly PinTravelExitView[], onExitPassageChange: PinTravelControlsProps['onExitPassageChange']): PinTravelControlsProps {
  return {
    exits,
    scenes: [],
    pinsIn: () => [],
    onLinkNew: () => {},
    onLinkExisting: () => {},
    onUnlink: () => {},
    onRename: () => {},
    onGo: () => {},
    passage,
    onPassageChange: () => {},
    onExitPassageChange,
    motivo: undefined,
    onMotivoChange: () => {},
    passItem: '',
    onPassItemChange: () => {},
    passTokens: [],
    onPassTokenToggle: () => {},
    onOneWayChange: () => {},
    onBothSidesChange: () => {},
    arrivalOnly: false,
  }
}

describe('PinTravelControls: modo por saída', () => {
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

  const seletores = (): HTMLSelectElement[] =>
    Array.from(container.querySelectorAll('label'))
      .filter((l) => l.textContent === 'Passagem desta saída')
      .map((l) => document.getElementById(l.htmlFor))
      .filter((el): el is HTMLSelectElement => el instanceof HTMLSelectElement)

  function escolher(select: HTMLSelectElement, valor: string): void {
    act(() => {
      select.value = valor
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  it('encruzilhada: uma escolha por saída EXTRA, com o modo que ela tem', () => {
    const exits = [ligada('principal', 'Cripta'), ligada('saida_torre', 'Torre', 'livre'), ligada('saida_poco', 'Poço')]
    act(() => root.render(<PinTravelControls {...props('pede', exits, () => {})} />))
    const lista = seletores()
    expect(lista).toHaveLength(2)
    expect(lista.map((s) => s.value)).toEqual(['livre', ''])
    expect(Array.from(lista[0].options).map((o) => o.textContent)).toEqual(['Como a principal (Pede ao mestre)', 'Pede ao mestre', 'Livre', 'Trancada'])
  })

  it('trocar o modo chama o painel com a saída e o modo; "Como a principal" manda undefined', () => {
    const mudar = vi.fn()
    const exits = [ligada('principal', 'Cripta'), ligada('saida_torre', 'Torre', 'livre')]
    act(() => root.render(<PinTravelControls {...props('pede', exits, mudar)} />))
    const [torre] = seletores()
    escolher(torre, 'trancada')
    expect(mudar).toHaveBeenLastCalledWith('saida_torre', 'trancada')
    escolher(torre, '')
    expect(mudar).toHaveBeenLastCalledWith('saida_torre', undefined)
    expect(mudar).toHaveBeenCalledTimes(2)
  })

  it('pino de uma saída só: nenhuma escolha por saída (a "Passagem" do pino basta)', () => {
    act(() => root.render(<PinTravelControls {...props('pede', [ligada('principal', 'Cripta')], () => {})} />))
    expect(seletores()).toHaveLength(0)
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull()
  })

  const alternarTentativas = (): HTMLButtonElement | null =>
    [...container.querySelectorAll('button')].find((b) => b.textContent === 'Aceita tentativas') ?? null

  it('pino que pede com uma extra trancada e a marca muda que sobrou: o painel mostra "Aceita tentativas" desligada e deixa ligar', () => {
    const onAcceptsAttemptsChange = vi.fn()
    const exits = [ligada('principal', 'Cripta'), ligada('saida_poco', 'Poço', 'trancada')]
    const base = props('pede', exits, () => {})
    act(() => root.render(<PinTravelControls {...base} acceptsAttempts={false} onAcceptsAttemptsChange={onAcceptsAttemptsChange} />))
    const botao = alternarTentativas()
    expect(botao?.getAttribute('aria-pressed')).toBe('false')
    const efeito = document.getElementById(botao?.getAttribute('aria-describedby') ?? '')
    expect(efeito?.textContent).toBe('Nas saídas trancadas, ninguém passa, e nenhum pedido chega a você.')
    // O modo do pino continua dito como sempre.
    expect(container.textContent).toContain('O jogador pede e você decide se ele passa.')
    act(() => botao?.click())
    expect(onAcceptsAttemptsChange).toHaveBeenCalledWith(true)
    act(() => root.render(<PinTravelControls {...base} acceptsAttempts onAcceptsAttemptsChange={onAcceptsAttemptsChange} />))
    expect(alternarTentativas()?.getAttribute('aria-pressed')).toBe('true')
    expect(container.textContent).toContain('Nas saídas trancadas, ninguém passa sozinho; o jogador pode pedir e você decide.')
  })

  it('sem extra trancada, com o pino em outro modo: "Aceita tentativas" não aparece', () => {
    const exits = [ligada('principal', 'Cripta'), ligada('saida_torre', 'Torre', 'livre')]
    act(() => root.render(<PinTravelControls {...props('pede', exits, () => {})} acceptsAttempts={false} onAcceptsAttemptsChange={() => {}} />))
    expect(alternarTentativas()).toBeNull()
    expect(seletores()).toHaveLength(1)
  })

  it('pino trancado com extra trancada: um botão só', () => {
    const exits = [ligada('principal', 'Cripta'), ligada('saida_poco', 'Poço', 'trancada')]
    act(() => root.render(<PinTravelControls {...props('trancada', exits, () => {})} onAcceptsAttemptsChange={() => {}} />))
    expect([...container.querySelectorAll('button')].filter((b) => b.textContent === 'Aceita tentativas')).toHaveLength(1)
  })

  it('sem onExitPassageChange: o painel não oferece a escolha', () => {
    const exits = [ligada('principal', 'Cripta'), ligada('saida_torre', 'Torre')]
    act(() => root.render(<PinTravelControls {...props('pede', exits, undefined)} />))
    expect(seletores()).toHaveLength(0)
    expect(container.textContent).toContain('2 saídas')
  })
})
