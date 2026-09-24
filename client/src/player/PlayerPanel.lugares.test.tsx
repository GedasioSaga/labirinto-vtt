/**
 * Aba LUGARES do painel do jogador. Aceite da simulação de 7 jogadores:
 * "Portas do Templo" centra a câmera; pino na névoa não aparece (ele nem chega
 * no recorte, então a lista só mostra o que veio). Eva vê 4 miniaturas,
 * renomeia "Lugar 2" para "Mercado", abre grande, "Fechar" volta.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, markRings } from '../lib/exploration'
import type { Pin, Region, RegionPoint } from '../types/map'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'
import { rememberPlace, type VisitedPlace } from './playerPlaces'

function explorado() {
  const exp = createExploration({ width: 500, height: 500, grid: 50 })
  markRings(exp, [
    [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
      { x: 0, y: 200 },
    ],
  ])
  return exp
}

function quatroLugares(): VisitedPlace[] {
  return ['l1', 'l2', 'l3', 'l4'].reduce<VisitedPlace[]>((lista, id) => rememberPlace(lista, id, createEmptyMap(`m-${id}`, '', 10, 10, 50), explorado(), [], undefined), [])
}

const TEMPLO: Pin = { id: 'pt', x: 300, y: 150, kind: 'exclamacao', description: 'Portas do Templo\nGrandes, de bronze.', image: null }
const POCO: Pin = { id: 'pp', x: 40, y: 400, kind: 'interrogacao', description: 'Poço seco', image: null }

describe('PlayerPanel: aba Lugares', () => {
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
    vi.unstubAllGlobals()
  })

  interface Extra {
    pins?: readonly Pin[]
    places?: readonly VisitedPlace[]
    placeNames?: Readonly<Record<string, string>>
    onFocusPoint?: (point: { x: number; y: number }) => void
    onRenamePlace?: (placeId: string, name: string) => void
  }

  function render(extra: Extra): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[{ id: 't1', name: 'Eva' }]}
          characterColor="#fff"
          settings={DEFAULT_PLAYER_SETTINGS}
          onSettingsChange={() => {}}
          onFocusToken={() => {}}
          signalArmed={false}
          onToggleSignal={() => {}}
          measureArmed={false}
          onToggleMeasure={() => {}}
          laserArmed={false}
          onToggleLaser={() => {}}
          onRenameToken={() => {}}
          onChangeTokenPhoto={async () => {}}
          notebook={[]}
          notebookUnread={false}
          onReadNotebook={() => {}}
          pins={extra.pins ?? []}
          places={extra.places ?? []}
          currentPlace="l4"
          placeNames={extra.placeNames ?? {}}
          onFocusPoint={extra.onFocusPoint ?? (() => {})}
          onRenamePlace={extra.onRenamePlace ?? (() => {})}
        />,
      ),
    )
  }

  function abaLugares(): void {
    const aba = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => b.textContent === 'Lugares')
    if (!aba) throw new Error('sem a aba Lugares')
    act(() => aba.click())
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === nome,
    )
    if (!achado) throw new Error(`sem o botão "${nome}"`)
    return achado
  }

  function digitar(input: HTMLInputElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, valor)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('lista os pontos do recorte pela primeira linha; tocar em "Portas do Templo" centra a câmera nele', () => {
    const onFocusPoint = vi.fn()
    render({ pins: [TEMPLO, POCO], onFocusPoint })
    abaLugares()
    const nomes = Array.from(container.querySelectorAll('.pp-place-pin__name')).map((b) => b.textContent)
    expect(nomes).toEqual(['Portas do Templo', 'Poço seco'])
    act(() => botao('Centralizar em Portas do Templo').click())
    expect(onFocusPoint).toHaveBeenCalledWith({ x: 300, y: 150 })
  })

  it('sem ponto nenhum no recorte, a aba diz o que vai aparecer ali', () => {
    render({})
    abaLugares()
    expect(container.querySelectorAll('.pp-place-pin')).toHaveLength(0)
    expect(container.textContent).toContain('Nenhum ponto conhecido nesta cena.')
    expect(container.textContent).toContain('Os lugares por onde você passar aparecem aqui.')
  })

  it('Eva vê 4 miniaturas, renomeia "Lugar 2" para "Mercado", abre grande e "Fechar" volta', () => {
    const onRenamePlace = vi.fn()
    const places = quatroLugares()
    render({ places, onRenamePlace })
    abaLugares()
    const miniaturas = container.querySelectorAll('.pp-place svg')
    expect(miniaturas).toHaveLength(4)
    // Cada miniatura recorta pelo explorado e não escreve texto nenhum (nome de sala ou de cena do mestre).
    // `getElementsByTagName` e não seletor CSS: o jsdom não casa `clipPath` (camelCase do SVG) no seletor.
    const recortes = Array.from(miniaturas).map((svg) => svg.getElementsByTagName('clipPath')[0]?.querySelector('path')?.getAttribute('d') ?? '')
    expect(recortes.filter((d) => d.startsWith('M'))).toHaveLength(4)
    expect(container.querySelector('.pp-place svg text')).toBeNull()
    expect(Array.from(container.querySelectorAll<HTMLInputElement>('.pp-place input')).map((i) => i.value)).toEqual(['Lugar 1', 'Lugar 2', 'Lugar 3', 'Lugar 4'])
    // O lugar de agora é marcado, sem nome de cena nenhum.
    expect(container.querySelector('.pp-place--here')?.textContent).toContain('Você está aqui')

    const campo = Array.from(container.querySelectorAll<HTMLInputElement>('.pp-place input'))[1]
    if (!campo) throw new Error('sem o campo do Lugar 2')
    act(() => campo.focus())
    digitar(campo, 'Mercado')
    act(() => campo.blur())
    expect(onRenamePlace).toHaveBeenCalledWith('l2', 'Mercado')

    render({ places, onRenamePlace, placeNames: { l2: 'Mercado' } })
    const abrir = botao('Abrir Mercado em tamanho grande')
    act(() => abrir.click())
    const dialogo = document.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialogo).not.toBeNull()
    expect(dialogo?.getAttribute('aria-modal')).toBe('true')
    expect(dialogo?.textContent).toContain('Mercado')
    expect(dialogo?.querySelector('svg')).not.toBeNull()
    const fechar = botao('Fechar')
    expect(document.activeElement).toBe(fechar)

    act(() => fechar.click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    // O foco volta para a miniatura que abriu.
    expect(document.activeElement).toBe(botao('Abrir Mercado em tamanho grande'))
  })

  it('Escape fecha a vista grande sem fechar a gaveta do celular', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 699px)', media: query, addEventListener: () => {}, removeEventListener: () => {} }))
    render({ places: quatroLugares() })
    const painel = container.querySelector<HTMLButtonElement>('button.pp-toggle')
    act(() => painel?.click())
    abaLugares()
    act(() => botao('Abrir Lugar 1 em tamanho grande').click())
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    act(() => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(container.querySelector('aside')?.hidden).toBe(false)
  })

  it('lugar sem nada explorado (mestre sem memória) mostra o quadro escuro, sem desenho nenhum', () => {
    const [vazio] = rememberPlace([], 'l1', createEmptyMap('m-l1', '', 10, 10, 50), undefined, [], undefined)
    if (vazio === undefined) throw new Error('sem lugar')
    render({ places: [vazio] })
    abaLugares()
    const arte = container.querySelector('.pp-place svg')
    expect(arte?.getAttribute('aria-label')).toBe('Lugar 1: nada explorado ainda')
    expect(arte?.getElementsByTagName('clipPath')).toHaveLength(0)
    expect(arte?.getElementsByTagName('rect')).toHaveLength(1)
  })

  it('zona oculta ligada depois de explorar: a miniatura e a vista grande cobrem a zona de preto por cima da Sala', () => {
    const zona: RegionPoint[] = [
      { x: 100, y: 0 },
      { x: 500, y: 0 },
      { x: 500, y: 500 },
      { x: 100, y: 500 },
    ]
    const base = createEmptyMap('m-l1', '', 10, 10, 50)
    const sala: Region = {
      id: 'r1',
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 200 },
        { x: 0, y: 200 },
      ],
      tag: '',
      fillColor: '#445566',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: '', nameHiddenFromPlayers: false },
    }
    // A Sala cruza a borda da zona: o recorte a entrega inteira, e o explorado (0..200) entra na zona.
    const [lugar] = rememberPlace([], 'l1', { ...base, regions: [sala] }, explorado(), [zona], undefined)
    if (lugar === undefined) throw new Error('sem lugar')
    render({ places: [lugar] })
    abaLugares()

    function cobertura(svg: Element | null | undefined): { pontos: string[]; cor: string[]; depoisDaSala: boolean } {
      if (!svg) throw new Error('sem miniatura')
      const cobre = Array.from(svg.querySelectorAll('.pp-place__concealed'))
      const salaDesenhada = Array.from(svg.getElementsByTagName('polygon')).find((p) => p.getAttribute('fill') === '#445566')
      if (!salaDesenhada) throw new Error('sem a Sala')
      return {
        pontos: cobre.map((c) => c.getAttribute('points') ?? ''),
        cor: cobre.map((c) => c.getAttribute('fill') ?? ''),
        // Pintado DEPOIS da Sala = por cima dela.
        depoisDaSala: cobre.every((c) => (salaDesenhada.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0),
      }
    }

    const esperado = { pontos: ['100,0 500,0 500,500 100,500'], cor: ['#0b0b0d'], depoisDaSala: true }
    expect(cobertura(container.querySelector('.pp-place svg'))).toEqual(esperado)
    act(() => botao('Abrir Lugar 1 em tamanho grande').click())
    expect(cobertura(document.querySelector('[role="dialog"] svg'))).toEqual(esperado)
  })

  it('apagar o nome inteiro devolve "Lugar N" (nome vazio não existe)', () => {
    const onRenamePlace = vi.fn()
    render({ places: quatroLugares(), onRenamePlace, placeNames: { l3: 'Porto' } })
    abaLugares()
    const campo = Array.from(container.querySelectorAll<HTMLInputElement>('.pp-place input'))[2]
    if (!campo) throw new Error('sem o campo do Lugar 3')
    expect(campo.value).toBe('Porto')
    act(() => campo.focus())
    digitar(campo, '   ')
    act(() => campo.blur())
    expect(onRenamePlace).toHaveBeenCalledWith('l3', '')
  })
})
