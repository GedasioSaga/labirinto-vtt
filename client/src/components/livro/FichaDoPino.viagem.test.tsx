import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin, PinPassage } from '../../types/map'
import type { PinTravelControlsProps, PinTravelExitView } from '../PinTravelControls'
import { FichaDoPino, type FichaDoPinoProps } from './FichaDoPino'

/**
 * A VIAGEM NA FICHA DO PINO (fatia 12): o PinTravelControls se divide em duas
 * partes sem perder nada. No essencial ficam o destino, as saídas e a
 * passagem (com o motivo da trancada); na ficha "Mais da viagem", que nasce
 * fechada, ficam os dois lados, o "Dá vista", a transição e o estado do pino
 * (Depende do estado, Cabine e Fila), cada um num lugar só.
 */

function par(id: string): Pin {
  return { id, x: 0, y: 0, kind: 'viagem', description: '', image: null }
}

function ligada(sceneName: string): PinTravelExitView {
  return { id: 'principal', rotulo: '', travel: { status: 'ligado', sceneId: `cena-${sceneName}`, sceneName, partner: par('p') } }
}

function viagem(passage: PinPassage, exits: readonly PinTravelExitView[]): PinTravelControlsProps & { pinId: string } {
  return {
    pinId: 'pino-viagem',
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
    motivo: undefined,
    onMotivoChange: () => {},
    passItem: '',
    onPassItemChange: () => {},
    passTokens: [],
    onPassTokenToggle: () => {},
    onOneWayChange: () => {},
    onBothSidesChange: () => {},
    arrivalOnly: false,
    daVista: null,
    onDaVistaChange: () => {},
    onTransicaoChange: () => {},
  }
}

function propsDaViagem(passage: PinPassage, exits: readonly PinTravelExitView[]): FichaDoPinoProps {
  return {
    pinId: 'pino-viagem',
    kind: 'viagem',
    onKindChange: vi.fn(),
    description: '',
    onDescriptionChange: vi.fn(),
    nome: 'Subida para a Cidade Alta',
    onNomeChange: vi.fn(),
    locked: false,
    onLockedChange: vi.fn(),
    marco: false,
    onMarcoChange: vi.fn(),
    lerDePerto: null,
    onLerDePertoChange: vi.fn(),
    image: null,
    onChooseImage: vi.fn(),
    onClearImage: vi.fn(),
    iconChoice: null,
    quemVe: null,
    travel: viagem(passage, exits),
    estadoDoPino: <p data-teste="estado-do-pino">Depende do estado</p>,
  }
}

describe('FichaDoPino: a viagem dividida entre o essencial e "Mais da viagem"', () => {
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

  const cabecalho = (titulo: string) =>
    [...container.querySelectorAll<HTMLButtonElement>('.gr-ficha__cab')].find((b) => b.querySelector('.gr-ficha__tit')?.textContent === titulo)
  const corpoDa = (cab: HTMLButtonElement | undefined) => document.getElementById(cab?.getAttribute('aria-controls') ?? '')
  const textosDosBotoes = (no: Element | null | undefined) => [...(no?.querySelectorAll('button') ?? [])].map((b) => b.textContent?.trim() ?? '')

  it('ligada e trancada: destino, passagem e motivo no essencial; o raro e o estado do pino só na ficha fechada', () => {
    act(() => root.render(<FichaDoPino {...propsDaViagem('trancada', [ligada('Cripta')])} />))

    const essencial = container.querySelector('[role="group"][aria-label="Destino da viagem"]')
    expect(essencial, 'o destino da viagem deveria estar na ficha').not.toBeNull()
    expect(essencial?.textContent).toMatch(/Cripta/)
    expect(essencial?.textContent).toMatch(/Passagem/)
    expect(essencial?.textContent).toMatch(/Por que está fechada/)

    const mais = cabecalho('Mais da viagem')
    expect(mais, 'a ficha "Mais da viagem" deveria existir no pino de viagem').toBeDefined()
    expect(mais?.getAttribute('aria-expanded')).toBe('false')
    const corpo = corpoDa(mais)
    expect(corpo?.contains(essencial ?? null)).toBe(false)

    const raro = corpo?.querySelector('.lb-travel--mais')
    expect(textosDosBotoes(raro).some((texto) => /os dois lados/.test(texto)), 'o botão dos dois lados deveria estar em "Mais da viagem"').toBe(true)
    expect(textosDosBotoes(raro).some((texto) => /^Dá vista/.test(texto)), 'o "Dá vista" deveria estar em "Mais da viagem"').toBe(true)
    expect(raro?.textContent).toMatch(/Transição/)
    expect(corpo?.querySelector('[data-teste="estado-do-pino"]'), 'Depende do estado, Cabine e Fila moram em "Mais da viagem"').not.toBeNull()

    // Cada controle num lugar só: nada do raro se repete no essencial.
    expect(essencial?.textContent).not.toMatch(/os dois lados|Dá vista|Transição/)
  })

  it('a forma do protótipo: o essencial sem moldura, Passagem e motivo em seg, e o raro em interruptores', () => {
    act(() => root.render(<FichaDoPino {...propsDaViagem('trancada', [ligada('Cripta')])} />))
    const essencial = container.querySelector('[role="group"][aria-label="Destino da viagem"]')
    expect(essencial?.classList.contains('lb-travel--embutido')).toBe(true)
    const grupo = (nome: string) =>
      [...container.querySelectorAll<HTMLElement>('[role="radiogroup"]')].find((g) => document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent === nome)
    expect(grupo('Passagem')?.classList.contains('gr-seg')).toBe(true)
    expect(grupo('Por que está fechada')?.classList.contains('gr-seg')).toBe(true)
    const raro = corpoDa(cabecalho('Mais da viagem'))?.querySelector('.lb-travel--mais')
    const botoes = [...(raro?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const daVista = botoes.find((b) => b.textContent?.trim() === 'Dá vista')
    const doisLados = botoes.find((b) => /os dois lados/.test(b.textContent ?? ''))
    expect(daVista?.classList.contains('gr-icone-tg')).toBe(true)
    expect(daVista?.getAttribute('aria-pressed')).toBe('false')
    expect(doisLados?.classList.contains('gr-icone-tg')).toBe(true)
  })

  it('sem destino: o essencial oferece "Leva a…" e a ficha "Mais da viagem" não traz o "Dá vista" (só com saída ligada)', () => {
    act(() => root.render(<FichaDoPino {...propsDaViagem('livre', [{ id: 'principal', rotulo: '', travel: { status: 'sem-destino' } }])} />))

    expect(textosDosBotoes(container.querySelector('[role="group"][aria-label="Destino da viagem"]'))).toEqual(expect.arrayContaining(['Leva a…']))
    const raro = corpoDa(cabecalho('Mais da viagem'))?.querySelector('.lb-travel--mais')
    expect(textosDosBotoes(raro)).not.toContain('Dá vista')
  })
})
