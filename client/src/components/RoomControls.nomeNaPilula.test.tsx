import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap, setNomesDosLugares, setTipoDeMapa } from '../lib/mapFactory'
import { roomLabelStyleOf } from '../lib/roomLabelStyle'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Region } from '../types/map'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/**
 * ESTILO DO TÍTULO x NOMES DOS LUGARES: com a chave ligada (o padrão no
 * Continente), o nome da sala com pílula sai na pílula, que não usa tamanho,
 * cor, fundo nem orientação da plaquinha. Os controles do estilo sumiriam em
 * silêncio no mapa ("o controle parece quebrado"); no lugar deles, o painel
 * diz onde o nome está e por que o estilo não vale ali.
 */

const SALA: Region = {
  id: 'sala',
  points: [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 300 },
    { x: 0, y: 300 },
  ],
  tag: 'region',
  fillColor: '#76c577',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'polygon', name: 'Capital', labelScale: 1.6, labelVertical: true },
}

function mapa(continente: boolean, sala: Region = SALA): MapData {
  const base = createEmptyMap('m-nome-pilula', 'Mundo', 30, 30, 40)
  return { ...(continente ? setTipoDeMapa(base, 'continente') : base), regions: [sala] }
}

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

function render(map: MapData, sala: Region = SALA): void {
  useMapStore.setState({ map, past: [], future: [], pisoAtivo: 0 })
  const props: RoomControlsProps = {
    name: sala.room?.name ?? '',
    onNameChange: vi.fn(),
    shape: 'polygon',
    axisAligned: false,
    width: 400,
    height: 300,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    salaId: sala.id,
    labelStyle: roomLabelStyleOf(sala.room),
    onLabelStyleChange: vi.fn(),
  }
  act(() => root.render(<RoomControls {...props} />))
}

const estilo = () => container.querySelector('[role="group"][aria-label="Título no mapa"]')
const dica = () => container.querySelector('[data-testid="nome-na-pilula"]')

describe('estilo do título com a chave "Nomes dos lugares"', () => {
  it('Continente (chave ligada por padrão): o estilo some e a dica diz que o nome está na pílula', () => {
    render(mapa(true))
    expect(estilo()).toBeNull()
    expect(dica()?.textContent).toMatch(/pílula/)
    expect(dica()?.textContent).toMatch(/Nomes dos lugares/)
  })

  it('chave desligada pelo mestre no Continente: o estilo volta', () => {
    render(setNomesDosLugares(mapa(true), false))
    expect(estilo()).not.toBeNull()
    expect(dica()).toBeNull()
  })

  it('masmorra (chave desligada por padrão): o estilo continua', () => {
    render(mapa(false))
    expect(estilo()).not.toBeNull()
    expect(dica()).toBeNull()
  })

  it('sala sem nome não tem pílula: o estilo continua mesmo com a chave ligada', () => {
    const semNome: Region = { ...SALA, room: { shape: 'polygon', name: '  ' } }
    render(mapa(true, semNome), semNome)
    expect(estilo()).not.toBeNull()
    expect(dica()).toBeNull()
  })
})
