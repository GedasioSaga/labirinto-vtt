import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TravelPinOption, TravelSceneOption } from '../lib/pinTravel'
import { PinTravelControls, type PinTravelControlsProps } from './PinTravelControls'

/**
 * BUSCA NO "LEVA A…" do pino de viagem: com muitas cenas, a escolha abre com
 * o foco num campo de busca; cada cena achada mostra o caminho em cinza; as
 * setas descem do campo para as achadas; Enter vai direto para o passo da
 * chegada da primeira que abre; Esc limpa a busca antes de fechar.
 */

const CENAS: TravelSceneOption[] = [
  { id: 'porto', name: 'Porto Cinza', available: true },
  { id: 'taverna-porto', name: 'Taverna', trail: ['Porto Cinza'], available: true },
  { id: 'vila', name: 'Bairro Vellano', available: true },
  { id: 'taverna-vila', name: 'Taverna', trail: ['Bairro Vellano'], available: true },
  { id: 'sobrado', name: 'Sobrado', trail: ['Bairro Vellano'], available: true },
  { id: 'mercado', name: 'Mercado', trail: ['Porto Cinza'], available: false },
  { id: 'farol', name: 'Farol', available: true },
]

const PINOS: TravelPinOption[] = [{ id: 'porta', label: 'Porta da frente', note: null }]

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
    pinsIn: vi.fn(() => PINOS),
    onLinkNew: vi.fn(),
    onLinkExisting: vi.fn(),
    onUnlink: vi.fn(),
    onRename: vi.fn(),
    onGo: vi.fn(),
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

/** O foco é posto depois do render (`requestAnimationFrame`): espera o quadro. */
async function proximoQuadro(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

async function abrirLevaA(): Promise<void> {
  const gatilho = Array.from(container.querySelectorAll('button')).find((botao) => botao.textContent?.startsWith('Leva a…'))
  if (gatilho === undefined) throw new Error('sem o "Leva a…"')
  act(() => gatilho.click())
  await proximoQuadro()
}

function campoDeBusca(): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>('#lb-pin-travel-picker input[type="search"]')
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function tecla(alvo: Element, key: string): void {
  act(() => {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

/** As cenas oferecidas, pelo nome acessível (o caminho inteiro numa linha). */
function cenasOferecidas(): string[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[data-cena]')).map((botao) => botao.getAttribute('aria-label') ?? botao.textContent ?? '')
}

describe('"Leva a…" com busca', () => {
  it('abre com o foco no campo de busca, e todas as cenas à vista com o caminho em cinza', async () => {
    painel(CENAS)
    await abrirLevaA()
    const campo = campoDeBusca()
    expect(campo).not.toBeNull()
    expect(document.activeElement).toBe(campo)
    expect(cenasOferecidas()).toEqual([
      'Porto Cinza',
      'Porto Cinza › Taverna',
      'Bairro Vellano',
      'Bairro Vellano › Taverna',
      'Bairro Vellano › Sobrado',
      'Porto Cinza › Mercado',
      'Farol',
    ])
    const taverna = container.querySelector('[data-cena="taverna-vila"]')
    expect(taverna?.querySelector('.lb-travel__choice-nome')?.textContent).toBe('Taverna')
    expect(taverna?.querySelector('.lb-travel__caminho')?.textContent).toBe('Bairro Vellano')
  })

  it('"tav" mostra as duas Tavernas, cada uma com o seu caminho', async () => {
    painel(CENAS)
    await abrirLevaA()
    const campo = campoDeBusca()
    if (campo === null) throw new Error('sem campo de busca')
    digitar(campo, 'tav')
    expect(cenasOferecidas()).toEqual(['Porto Cinza › Taverna', 'Bairro Vellano › Taverna'])
    expect(container.querySelector('[data-cena="taverna-porto"]')?.getAttribute('data-enter')).toBe('true')
    expect(container.querySelector('[data-cena="taverna-vila"]')?.getAttribute('data-enter')).toBeNull()
  })

  it('Enter no campo vai para a chegada da primeira achada que abre (a cena que não abriu é pulada)', async () => {
    const props = painel(CENAS)
    await abrirLevaA()
    const campo = campoDeBusca()
    if (campo === null) throw new Error('sem campo de busca')
    digitar(campo, 'porto')
    // "porto" acha o Porto Cinza (no nome) — Taverna e Mercado têm "porto" só no caminho.
    expect(cenasOferecidas()).toEqual(['Porto Cinza'])
    digitar(campo, 'merc')
    tecla(campo, 'Enter')
    expect(container.textContent).not.toContain('Chegada em')
    digitar(campo, 'vell s')
    tecla(campo, 'Enter')
    expect(container.textContent).toContain('Chegada em Bairro Vellano › Sobrado')
    expect(props.pinsIn).toHaveBeenCalledWith('sobrado')
  })

  it('ArrowDown do campo desce para a primeira achada', async () => {
    painel(CENAS)
    await abrirLevaA()
    const campo = campoDeBusca()
    if (campo === null) throw new Error('sem campo de busca')
    digitar(campo, 'tav')
    tecla(campo, 'ArrowDown')
    expect(document.activeElement).toBe(container.querySelector('[data-cena="taverna-porto"]'))
  })

  it('sem nada achado diz "Nenhuma cena com “zzz”"', async () => {
    painel(CENAS)
    await abrirLevaA()
    const campo = campoDeBusca()
    if (campo === null) throw new Error('sem campo de busca')
    digitar(campo, 'zzz')
    expect(cenasOferecidas()).toEqual([])
    expect(container.textContent).toContain('Nenhuma cena com “zzz”')
  })

  it('Esc com texto limpa a busca e a escolha fica aberta; o segundo Esc fecha', async () => {
    painel(CENAS)
    await abrirLevaA()
    const campo = campoDeBusca()
    if (campo === null) throw new Error('sem campo de busca')
    digitar(campo, 'tav')
    tecla(campo, 'Escape')
    expect(campo.value).toBe('')
    expect(campoDeBusca()).not.toBeNull()
    expect(cenasOferecidas()).toHaveLength(CENAS.length)
    tecla(campo, 'Escape')
    expect(campoDeBusca()).toBeNull()
  })

  it('com poucas cenas não há busca: o foco vai para a primeira cena, como sempre', async () => {
    painel(CENAS.slice(0, 3))
    await abrirLevaA()
    expect(campoDeBusca()).toBeNull()
    expect(document.activeElement).toBe(container.querySelector('[data-cena="porto"]'))
  })
})
