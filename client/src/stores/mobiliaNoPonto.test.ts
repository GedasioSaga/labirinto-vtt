import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import { porMovelNoPonto } from './mobiliaNoPonto'
import { useToastStore } from './toastStore'
import type { Region } from '../types/map'

/**
 * MOBÍLIA NA BARRA: o clique da ferramenta Objetos põe o móvel no ponto, no
 * giro da Sala em que caiu, já selecionado, num passo só do desfazer — e
 * respeita a camada Objetos travada ou oculta.
 */

const GRADE = 50

/** Sala 200 x 100 de (100, 100) a (300, 200), já girada 90°. */
function sala(extra: Partial<Region> = {}): Region {
  return {
    id: 'dormitorio',
    points: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 200 },
      { x: 100, y: 200 },
    ],
    tag: '',
    fillColor: '#a8776a',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Dormitório', rotation: 90 },
    ...extra,
  }
}

function prepararMapa(regions: Region[] = [sala()]): void {
  const { map } = useMapStore.getState()
  useMapStore.setState({
    map: { ...map, grid: GRADE, props: [], regions, hiddenLayers: [], lockedLayers: [] },
    selection: [],
    past: [],
    future: [],
    pisoAtivo: 0,
  })
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  prepararMapa()
})

const ID_FIXO = () => 'movel-1'

describe('Objetos: o clique no mapa põe o móvel', () => {
  it('dentro da sala girada, a cama nasce no ponto, no giro da sala, e fica selecionada', () => {
    const resultado = porMovelNoPonto('catre', { x: 200, y: 150 }, ID_FIXO)

    expect(resultado).toEqual({ kind: 'posto', id: 'movel-1' })
    const { map, selection } = useMapStore.getState()
    expect(map.props).toEqual([
      {
        id: 'movel-1',
        src: '',
        x: 200,
        y: 150,
        width: GRADE,
        height: 2 * GRADE,
        linkedMapPath: null,
        mobilia: 'catre',
        rotation: 90,
      },
    ])
    expect(selection).toEqual([{ kind: 'prop', id: 'movel-1' }])
  })

  it('fora de qualquer sala, o móvel nasce sem campo de giro (igual a objeto comum)', () => {
    porMovelNoPonto('mesa', { x: 500, y: 450 }, ID_FIXO)

    const [mesa] = useMapStore.getState().map.props
    expect(mesa).toEqual({
      id: 'movel-1',
      src: '',
      x: 500,
      y: 450,
      width: 2 * GRADE,
      height: GRADE,
      linkedMapPath: null,
      mobilia: 'mesa',
    })
  })

  it('sala que nunca foi girada (sem o campo) também não dá giro', () => {
    prepararMapa([sala({ room: { shape: 'rect', name: 'Dormitório' } })])
    porMovelNoPonto('bau', { x: 200, y: 150 }, ID_FIXO)

    const [bau] = useMapStore.getState().map.props
    expect(bau?.mobilia).toBe('bau')
    expect(bau !== undefined && 'rotation' in bau).toBe(false)
  })

  it('mapa sem sala nenhuma: o móvel nasce e fica selecionado', () => {
    prepararMapa([])
    expect(porMovelNoPonto('barril', { x: 0, y: 0 }, ID_FIXO)).toEqual({ kind: 'posto', id: 'movel-1' })
    expect(useMapStore.getState().map.props).toHaveLength(1)
    expect(useMapStore.getState().selection).toEqual([{ kind: 'prop', id: 'movel-1' }])
  })

  it('um passo só no desfazer: o Ctrl+Z tira o móvel inteiro', () => {
    porMovelNoPonto('mesa', { x: 200, y: 150 }, ID_FIXO)
    expect(useMapStore.getState().map.props).toHaveLength(1)
    expect(useMapStore.getState().past).toHaveLength(1)

    useMapStore.getState().undo()
    expect(useMapStore.getState().map.props).toEqual([])
  })

  it('dois cliques põem dois móveis: a ferramenta segue na mão', () => {
    let proximo = 0
    const ids = () => `movel-${(proximo += 1)}`
    porMovelNoPonto('cadeira', { x: 150, y: 150 }, ids)
    porMovelNoPonto('cadeira', { x: 250, y: 150 }, ids)

    expect(useMapStore.getState().map.props.map((p) => p.id)).toEqual(['movel-1', 'movel-2'])
    expect(useMapStore.getState().selection).toEqual([{ kind: 'prop', id: 'movel-2' }])
  })
})

describe('Objetos: pisos', () => {
  it('sala girada de OUTRO piso não doa giro ao móvel posto no térreo', () => {
    prepararMapa([sala({ piso: 1 })])
    porMovelNoPonto('catre', { x: 200, y: 150 }, ID_FIXO)

    const [cama] = useMapStore.getState().map.props
    expect(cama !== undefined && 'rotation' in cama).toBe(false)
    expect(cama !== undefined && 'piso' in cama).toBe(false)
  })

  it('editando o 1º piso, o móvel nasce nele e no giro da sala de lá', () => {
    prepararMapa([sala({ piso: 1 })])
    useMapStore.setState({ pisoAtivo: 1 })
    porMovelNoPonto('catre', { x: 200, y: 150 }, ID_FIXO)

    const [cama] = useMapStore.getState().map.props
    expect(cama?.rotation).toBe(90)
    expect(cama?.piso).toBe(1)
  })
})

describe('Objetos: camada travada ou oculta', () => {
  it('camada Objetos travada: nada nasce, a seleção fica, e o aviso oferece "Destravar"', () => {
    const { map } = useMapStore.getState()
    useMapStore.setState({ map: { ...map, lockedLayers: ['objetos'] } })

    expect(porMovelNoPonto('mesa', { x: 200, y: 150 }, ID_FIXO)).toEqual({ kind: 'camada-travada' })
    expect(useMapStore.getState().map.props).toEqual([])
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(useMapStore.getState().selection).toEqual([])
    const [aviso] = useToastStore.getState().toasts
    expect(aviso?.text).toBe('A camada Objetos está travada')
    expect(aviso?.actions?.map((acao) => acao.label)).toEqual(['Destravar'])
  })

  it('camada Objetos oculta: nada nasce e o aviso oferece "Mostrar"', () => {
    const { map } = useMapStore.getState()
    useMapStore.setState({ map: { ...map, hiddenLayers: ['objetos'] } })

    expect(porMovelNoPonto('mesa', { x: 200, y: 150 }, ID_FIXO)).toEqual({ kind: 'camada-oculta' })
    expect(useMapStore.getState().map.props).toEqual([])
    const [aviso] = useToastStore.getState().toasts
    expect(aviso?.text).toBe('A camada Objetos está oculta')
    expect(aviso?.actions?.map((acao) => acao.label)).toEqual(['Mostrar'])
  })

  it('outra camada oculta (Salas) não impede o móvel', () => {
    const { map } = useMapStore.getState()
    useMapStore.setState({ map: { ...map, hiddenLayers: ['salas'], lockedLayers: ['paredes'] } })

    expect(porMovelNoPonto('mesa', { x: 200, y: 150 }, ID_FIXO)).toEqual({ kind: 'posto', id: 'movel-1' })
    expect(useToastStore.getState().toasts).toEqual([])
  })
})

describe('Objetos: a escolha da setinha', () => {
  afterEach(() => useMapStore.setState({ mobiliaTipo: useMapStore.getInitialState().mobiliaTipo }))

  it('começa na Mesa e é preferência de sessão: trocar não mexe no mapa nem no desfazer', () => {
    expect(useMapStore.getInitialState().mobiliaTipo).toBe('mesa')
    const antes = useMapStore.getState().map
    useMapStore.getState().setMobiliaTipo('barril')
    expect(useMapStore.getState().mobiliaTipo).toBe('barril')
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})
