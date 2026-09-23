import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TravelLogEntry } from '../lib/travelLog'
import { RoomPanel } from './RoomPanel'
import { TRAVEL_LOG_EMPTY, TRAVEL_UNDO_FAILED, TravelLogSection } from './TravelLogSection'

const as2210 = new Date(2026, 8, 23, 22, 10).getTime()
const as2212 = new Date(2026, 8, 23, 22, 12).getTime()
const as2215 = new Date(2026, 8, 23, 22, 15).getTime()

function viagem(id: string, playerId: string, tokenName: string, at: number, de: string, para: string): TravelLogEntry {
  return { id, at, playerId, tokenId: `t-${playerId}`, tokenName, fromSceneId: de, fromSceneName: de, fromX: 0, fromY: 0, toSceneId: para, toSceneName: para }
}

/** A mais nova em cima, como a ponte entrega. */
const DIARIO: TravelLogEntry[] = [
  viagem('v3', 'ana', 'Ana', as2215, 'Cripta', 'Salão'),
  viagem('v2', 'bruno', 'Bruno', as2212, 'Salão', 'Cripta'),
  viagem('v1', 'ana', 'Ana', as2210, 'Salão', 'Cripta'),
]

describe('TravelLogSection (diário de viagens do mestre)', () => {
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

  const render = (entries: TravelLogEntry[], onUndo: (id: string) => boolean = () => true) =>
    act(() => root.render(<TravelLogSection entries={entries} onUndo={onUndo} />))

  const regiao = (): HTMLElement => {
    const heading = [...container.querySelectorAll('h3')].find((h) => h.textContent === 'Diário de viagens')
    if (heading === undefined) throw new Error('sem o título "Diário de viagens"')
    const section = container.querySelector<HTMLElement>(`section[aria-labelledby="${heading.id}"]`)
    if (section === null) throw new Error('o título deveria nomear a seção (região)')
    return section
  }
  const linhas = (): HTMLLIElement[] => [...regiao().querySelectorAll('li')]
  const desfazerDe = (li: HTMLLIElement): HTMLButtonElement | null =>
    [...li.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').startsWith('Desfazer')) ?? null

  it('é uma região com nome "Diário de viagens", uma linha por viagem, a mais nova em cima, "HH:MM Ficha: Origem → Destino"', () => {
    render(DIARIO)
    expect(linhas().map((li) => li.textContent?.replace(/Desfazer.*$/, '').trim())).toEqual([
      '22:15 Ana: Cripta → Salão',
      '22:12 Bruno: Salão → Cripta',
      '22:10 Ana: Salão → Cripta',
    ])
  })

  it('"Desfazer" só na última viagem de cada jogador', () => {
    render(DIARIO)
    const [ultimaAna, ultimaBruno, idaAna] = linhas()
    expect(ultimaAna && desfazerDe(ultimaAna)).not.toBeNull()
    expect(ultimaBruno && desfazerDe(ultimaBruno)).not.toBeNull()
    expect(idaAna && desfazerDe(idaAna)).toBeNull()
  })

  it('o botão é um <button> nativo e o nome acessível começa por "Desfazer" e diz de quem', () => {
    render(DIARIO)
    const primeira = linhas()[0]
    const botao = primeira === undefined ? null : desfazerDe(primeira)
    expect(botao?.tagName).toBe('BUTTON')
    expect(botao?.getAttribute('type')).toBe('button')
    expect(botao?.getAttribute('aria-label')).toBe('Desfazer a viagem de Ana: Cripta → Salão')
  })

  it('clicar chama onUndo com a viagem daquela linha', () => {
    const onUndo = vi.fn(() => true)
    render(DIARIO, onUndo)
    const segunda = linhas()[1]
    const botao = segunda === undefined ? null : desfazerDe(segunda)
    act(() => botao?.click())
    expect(onUndo).toHaveBeenCalledWith('v2')
  })

  it('não deu para desfazer: aviso perto da ação, com o motivo e o que fazer', () => {
    render(DIARIO, () => false)
    const primeira = linhas()[0]
    const botao = primeira === undefined ? null : desfazerDe(primeira)
    act(() => botao?.click())
    const alerta = regiao().querySelector('[role="alert"]')
    expect(alerta?.textContent).toBe(TRAVEL_UNDO_FAILED)
  })

  it('sem viagens: a seção diz que não há nenhuma, sem botão solto', () => {
    render([])
    expect(regiao().textContent).toContain(TRAVEL_LOG_EMPTY)
    expect(regiao().querySelectorAll('button')).toHaveLength(0)
  })
})

describe('RoomPanel com o diário', () => {
  const noop = vi.fn()
  const handlers = { onStart: noop, onStop: noop, onStartTunnel: noop, onStopTunnel: noop, onAssign: noop, onUnassign: noop, onKick: noop, onVisionRadiusChange: noop, onRevealPlan: noop, onHidePlan: noop }
  const ROOM = { code: 'AB12CD', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }

  it('sala aberta com `travelLog`: o diário aparece na aba Jogo', () => {
    const html = renderToStaticMarkup(<RoomPanel room={ROOM} players={[]} tokens={[]} tunnel={{ kind: 'idle' }} {...handlers} travelLog={{ entries: DIARIO, onUndo: () => true }} />)
    expect(html).toContain('Diário de viagens')
    expect(html).toContain('Ana: Salão → Cripta')
  })

  it('sala fechada ou sem `travelLog`: nada de diário', () => {
    const fechada = renderToStaticMarkup(<RoomPanel room={null} players={[]} tokens={[]} tunnel={{ kind: 'idle' }} {...handlers} travelLog={{ entries: DIARIO, onUndo: () => true }} />)
    expect(fechada).not.toContain('Diário')
    const semDiario = renderToStaticMarkup(<RoomPanel room={ROOM} players={[]} tokens={[]} tunnel={{ kind: 'idle' }} {...handlers} />)
    expect(semDiario).not.toContain('Diário')
  })
})
