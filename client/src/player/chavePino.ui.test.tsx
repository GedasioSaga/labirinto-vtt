import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinTravelControls, type PinTravelControlsProps } from '../components/PinTravelControls'
import type { Pin, PinPassage, Stair } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * CHAVE ABRE PORTA no pino de viagem trancado, nas duas telas: o cartão do
 * jogador que carrega a chave oferece "Usar <chave>" (e quem não carrega lê
 * "Está trancada", sem botão); o painel do mestre ganha "Abre com" só na
 * passagem "Trancada".
 */

const CHAVE = 'Chave do Escudo'
const portao: Pin = { id: 'portao', x: 400, y: 200, kind: 'viagem', description: 'Portão do cemitério', image: null, passagem: 'trancada' }

describe('telas da chave no pino trancado', () => {
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

  const textos = () => [...container.querySelectorAll('button')].map((b) => b.textContent)
  const botao = (texto: string): HTMLButtonElement => {
    const achado = [...container.querySelectorAll('button')].find((b) => b.textContent === texto)
    if (achado === undefined) throw new Error(`sem botão "${texto}" em: ${textos().join(' | ')}`)
    return achado
  }

  it('cartão de Diego (com a chave): "Usar Chave do Escudo", confirma sem falar em mestre, e só então passa', () => {
    const onRequestTravel = vi.fn()
    act(() => root.render(<PlayerPinCard pin={{ ...portao, chave: CHAVE }} stairs={[]} onClose={vi.fn()} onRequestTravel={onRequestTravel} />))
    expect(container.textContent).not.toContain('Está trancada')
    act(() => botao(`Usar ${CHAVE}`).click())
    expect(onRequestTravel).not.toHaveBeenCalled()
    expect(container.textContent).toContain(`Usar ${CHAVE} e passar por aqui?`)
    expect(container.textContent).not.toContain('mestre')
    act(() => botao('Usar').click())
    expect(onRequestTravel).toHaveBeenCalledTimes(1)
    expect(onRequestTravel).toHaveBeenCalledWith()
  })

  it('cartão de Ana (sem a chave): "Está trancada" e nenhum botão de passar', () => {
    act(() => root.render(<PlayerPinCard pin={portao} stairs={[]} onClose={vi.fn()} onRequestTravel={vi.fn()} />))
    expect(container.textContent).toContain('Está trancada')
    expect(textos()).toEqual(['Fechar'])
  })

  it('encruzilhada trancada com a chave: cada saída pergunta com o nome da chave', () => {
    const onRequestTravel = vi.fn()
    const escolhas = [
      { id: 'principal', rotulo: 'Cripta' },
      { id: 's2', rotulo: 'Torre' },
    ]
    act(() => root.render(<PlayerPinCard pin={{ ...portao, chave: CHAVE, escolhas }} stairs={[]} onClose={vi.fn()} onRequestTravel={onRequestTravel} />))
    act(() => botao('Torre').click())
    expect(container.textContent).toContain(`Usar ${CHAVE} e passar por Torre?`)
    act(() => botao('Usar').click())
    expect(onRequestTravel).toHaveBeenCalledWith('s2')
  })

  describe('escada trancada (a escada que leva a outro andar)', () => {
    const escada: Stair = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 0, y1: 0, x2: 0, y2: -80 }], stepWidth: 40 }
    const pinoDaEscada: Pin = { ...portao, id: 'pino-da-escada', description: '', escadaId: 'escada' }

    it('com a chave: lê "Subir", oferece "Usar Chave do Escudo" e pergunta pelo sentido, sem falar em mestre', () => {
      const onRequestTravel = vi.fn()
      act(() =>
        root.render(<PlayerPinCard pin={{ ...pinoDaEscada, chave: CHAVE }} stairs={[escada]} onClose={vi.fn()} onRequestTravel={onRequestTravel} />),
      )
      expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Subir')
      expect(container.textContent).not.toContain('Está trancada')
      act(() => botao(`Usar ${CHAVE}`).click())
      expect(container.textContent).toContain(`Usar ${CHAVE} e subir?`)
      expect(container.textContent).not.toContain('mestre')
      act(() => botao('Usar').click())
      expect(onRequestTravel).toHaveBeenCalledTimes(1)
      expect(onRequestTravel).toHaveBeenCalledWith()
    })

    it('sem a chave: lê "Descer" e "Está trancada", sem botão de passar nem de pedir', () => {
      act(() =>
        root.render(<PlayerPinCard pin={pinoDaEscada} stairs={[{ ...escada, direction: 'down' }]} onClose={vi.fn()} onRequestTravel={vi.fn()} />),
      )
      expect(container.querySelector('.pp-pincard__text')?.textContent).toBe('Descer')
      expect(container.textContent).toContain('Está trancada')
      expect(textos()).toEqual(['Fechar'])
    })
  })

  function painel(passage: PinPassage, extra: Partial<PinTravelControlsProps> = {}) {
    const props: PinTravelControlsProps = {
      exits: [{ id: 'principal', rotulo: '', travel: { status: 'sem-destino' } }],
      scenes: [],
      pinsIn: () => [],
      onLinkNew: vi.fn(),
      onLinkExisting: vi.fn(),
      onUnlink: vi.fn(),
      onRename: vi.fn(),
      onGo: vi.fn(),
      passage,
      onPassageChange: vi.fn(),
      onOneWayChange: vi.fn(),
      arrivalOnly: false,
      ...extra,
    }
    act(() => root.render(<PinTravelControls {...props} />))
  }

  const campoAbreCom = () => container.querySelector<HTMLInputElement>('input[aria-label="Abre com"]')

  it('painel do mestre: "Abre com" aparece só com a passagem "Trancada", com o nome gravado', () => {
    painel('pede', { keyName: CHAVE, onKeyChange: vi.fn() })
    expect(campoAbreCom()).toBeNull()
    painel('livre', { keyName: CHAVE, onKeyChange: vi.fn() })
    expect(campoAbreCom()).toBeNull()
    painel('trancada', { keyName: CHAVE, onKeyChange: vi.fn() })
    expect(campoAbreCom()?.value).toBe(CHAVE)
  })

  it('painel do mestre: o nome grava ao sair do campo (Enter), não a cada letra', () => {
    const onKeyChange = vi.fn()
    painel('trancada', { onKeyChange })
    const campo = campoAbreCom()
    if (campo === null) throw new Error('sem campo "Abre com"')
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    if (setValue === undefined) throw new Error('sem setter de value')
    act(() => {
      setValue.call(campo, CHAVE)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onKeyChange).not.toHaveBeenCalled()
    act(() => {
      campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onKeyChange).toHaveBeenCalledWith(CHAVE)
  })
})
