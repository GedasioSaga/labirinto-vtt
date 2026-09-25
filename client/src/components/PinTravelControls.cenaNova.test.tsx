import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TravelSceneOption } from '../lib/pinTravel'
import { PinTravelControls, type PinTravelControlsProps } from './PinTravelControls'

/**
 * "+ CENA NOVA…" NO "LEVA A…": a casa do ferreiro não existe ainda. O mestre
 * dá o nome ali mesmo, Enter, e o pino passa a levar à cena nova — sem ir a
 * Cenas, criar, voltar e ligar. O painel só pede (`onCreateScene`); quem cria
 * a cena, o pino de chegada e a ligação é a aventura.
 */

const CENAS: TravelSceneOption[] = [
  { id: 'cais', name: 'Cais', available: true },
  { id: 'farol', name: 'Farol', available: true },
]

/** Seis ou mais: a escolha abre com busca (`SCENE_FILTER_MIN`). */
const MUITAS: TravelSceneOption[] = [
  { id: 'cais', name: 'Cais', available: true },
  { id: 'farol', name: 'Farol', available: true },
  { id: 'mercado', name: 'Mercado', available: true },
  { id: 'taverna', name: 'Taverna', available: true },
  { id: 'igreja', name: 'Igreja', available: true },
  { id: 'forte', name: 'Forte', available: true },
]

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

function painel(scenes: TravelSceneOption[], extra: Partial<PinTravelControlsProps> = {}): PinTravelControlsProps {
  const props: PinTravelControlsProps = {
    exits: [{ id: 'principal', rotulo: '', travel: { status: 'sem-destino' } }],
    scenes,
    pinsIn: vi.fn(() => []),
    onLinkNew: vi.fn(),
    onLinkExisting: vi.fn(),
    onUnlink: vi.fn(),
    onRename: vi.fn(),
    onGo: vi.fn(),
    onCreateScene: vi.fn(),
    passage: 'pede',
    onPassageChange: vi.fn(),
    motivo: undefined,
    onMotivoChange: vi.fn(),
    passItem: '',
    onPassItemChange: () => {},
    passTokens: [],
    onPassTokenToggle: () => {},
    onBothSidesChange: vi.fn(),
    onOneWayChange: vi.fn(),
    arrivalOnly: false,
    ...extra,
  }
  act(() => root.render(<PinTravelControls {...props} />))
  return props
}

async function proximoQuadro(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

function botao(texto: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.startsWith(texto))
  if (achado === undefined) throw new Error(`sem o botão "${texto}"`)
  return achado
}

async function clicar(texto: string): Promise<void> {
  const alvo = botao(texto)
  act(() => alvo.click())
  await proximoQuadro()
}

function campoDoNome(): HTMLInputElement {
  const campo = container.querySelector<HTMLInputElement>('#lb-pin-travel-new-scene')
  if (campo === null) throw new Error('sem o campo "Nome da cena nova"')
  return campo
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function tecla(alvo: Element, key: string): KeyboardEvent {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => {
    alvo.dispatchEvent(evento)
  })
  return evento
}

describe('"+ Cena nova…" no "Leva a…"', () => {
  it('"Casa do ferreiro" + Enter pede a cena nova para a saída principal e fecha a escolha, com o foco na frase do destino', async () => {
    const props = painel(CENAS)
    await clicar('Leva a…')
    await clicar('+ Cena nova…')

    const campo = campoDoNome()
    expect(document.activeElement).toBe(campo)
    expect(container.querySelector('label[for="lb-pin-travel-new-scene"]')?.textContent).toBe('Nome da cena nova')

    digitar(campo, '  Casa do ferreiro ')
    tecla(campo, 'Enter')
    await proximoQuadro()

    expect(props.onCreateScene).toHaveBeenCalledTimes(1)
    expect(props.onCreateScene).toHaveBeenCalledWith('Casa do ferreiro', 'principal')
    expect(props.onLinkNew).not.toHaveBeenCalled()
    expect(container.querySelector('#lb-pin-travel-picker')).toBeNull()
    expect(document.activeElement?.id).toBe('lb-pin-travel-status')
  })

  it('o botão "Criar e ligar" faz o mesmo que o Enter', async () => {
    const props = painel(CENAS)
    await clicar('Leva a…')
    await clicar('+ Cena nova…')
    digitar(campoDoNome(), 'Casa do ferreiro')
    await clicar('Criar e ligar')

    expect(props.onCreateScene).toHaveBeenCalledWith('Casa do ferreiro', 'principal')
  })

  it('nome vazio não cria: diz o que falta junto ao campo e o foco fica nele', async () => {
    const props = painel(CENAS)
    await clicar('Leva a…')
    await clicar('+ Cena nova…')
    const campo = campoDoNome()
    digitar(campo, '   ')
    tecla(campo, 'Enter')
    await proximoQuadro()

    expect(props.onCreateScene).not.toHaveBeenCalled()
    expect(container.querySelector('#lb-pin-travel-picker')).not.toBeNull()
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    const erro = document.getElementById(campo.getAttribute('aria-describedby') ?? '')
    expect(erro?.textContent).toBe('Dê um nome à cena.')
    expect(document.activeElement).toBe(campo)

    // O erro some assim que o nome fica válido.
    digitar(campo, 'C')
    expect(campo.getAttribute('aria-invalid')).toBeNull()
  })

  it('"+ Outra saída" com cena nova pede uma saída NOVA (null)', async () => {
    const props = painel(CENAS, {
      exits: [
        {
          id: 'principal',
          rotulo: '',
          travel: {
            status: 'ligado',
            sceneId: 'cais',
            sceneName: 'Cais',
            partner: { id: 'p', x: 0, y: 0, kind: 'viagem', description: '', image: null },
          },
        },
      ],
    })
    await clicar('+ Outra saída')
    await clicar('+ Cena nova…')
    digitar(campoDoNome(), 'Casa do ferreiro')
    tecla(campoDoNome(), 'Enter')

    expect(props.onCreateScene).toHaveBeenCalledWith('Casa do ferreiro', null)
  })

  it('sem nenhuma outra cena o "Leva a…" já abre, para criar a primeira ali mesmo', async () => {
    const props = painel([])
    expect(botao('Leva a…').disabled).toBe(false)
    expect(container.textContent).toContain('crie uma nova em “Leva a…”')
    await clicar('Leva a…')
    await clicar('+ Cena nova…')
    digitar(campoDoNome(), 'Casa do ferreiro')
    tecla(campoDoNome(), 'Enter')
    expect(props.onCreateScene).toHaveBeenCalledWith('Casa do ferreiro', 'principal')
  })

  it('sem quem crie (sem onCreateScene) nada muda: sem outra cena o "Leva a…" fica desligado e não há "+ Cena nova…"', async () => {
    painel([], { onCreateScene: undefined })
    expect(botao('Leva a…').disabled).toBe(true)
    expect(container.textContent).toContain('Crie outra cena em Cenas para ter para onde levar.')

    act(() => root.render(<PinTravelControls {...painel(CENAS, { onCreateScene: undefined })} />))
    await clicar('Leva a…')
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent?.startsWith('+ Cena nova'))).toBe(false)
  })

  it('com busca digitada, o nome da cena nova já vem com o que se buscou', async () => {
    painel(MUITAS)
    await clicar('Leva a…')
    const busca = container.querySelector<HTMLInputElement>('#lb-pin-travel-picker input[type="search"]')
    if (busca === null) throw new Error('sem busca')
    digitar(busca, 'Ferreiro')
    await clicar('+ Cena nova…')
    expect(campoDoNome().value).toBe('Ferreiro')
  })

  it('Esc no nome fecha a escolha sem criar, e não chega ao mapa', async () => {
    const props = painel(CENAS)
    await clicar('Leva a…')
    await clicar('+ Cena nova…')
    digitar(campoDoNome(), 'Casa do ferreiro')
    const noMapa = vi.fn()
    window.addEventListener('keydown', noMapa)
    try {
      const evento = tecla(campoDoNome(), 'Escape')
      await proximoQuadro()
      expect(evento.defaultPrevented).toBe(true)
      expect(noMapa).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', noMapa)
    }
    expect(props.onCreateScene).not.toHaveBeenCalled()
    expect(container.querySelector('#lb-pin-travel-picker')).toBeNull()
    expect(document.activeElement?.textContent?.startsWith('Leva a…')).toBe(true)
  })

  it('"Voltar" do nome devolve à lista de cenas', async () => {
    painel(CENAS)
    await clicar('Leva a…')
    await clicar('+ Cena nova…')
    await clicar('Voltar')
    expect(container.querySelector('#lb-pin-travel-new-scene')).toBeNull()
    expect(container.querySelectorAll('[data-cena]').length).toBe(2)
    expect(document.activeElement?.textContent?.startsWith('+ Cena nova…')).toBe(true)
  })
})
