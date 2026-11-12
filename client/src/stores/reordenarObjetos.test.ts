import { beforeEach, describe, expect, it } from 'vitest'
import { emOrdemDeDesenho } from '../lib/mobilia'
import { findPropAt } from '../pixi/propInteraction'
import type { Prop } from '../types/map'
import { useMapStore } from './mapStore'

/**
 * PÔR POR CIMA / POR BAIXO (pedido de 12/11/2026): o menu do botão direito no
 * objeto mexe na lista do mapa, que é a pilha (o último por cima). Um passo do
 * Ctrl+Z, o clique pega o que ficou por cima, e o chão segue por baixo dos
 * objetos comuns.
 */

function movel(id: string, mobilia: Prop['mobilia'], x: number, tamanho: number): Prop {
  return { id, src: '', x, y: 100, width: tamanho, height: tamanho, linkedMapPath: null, mobilia }
}

const GRANDE = movel('grande', 'caixa', 100, 128)
const PEQUENA = movel('pequena', 'caixa', 150, 48)
/** Dentro das duas caixas: onde a pequena encosta na grande. */
const NA_SOBREPOSICAO = { x: 140, y: 100 }

function prepararMapa(props: Prop[]): void {
  const { map } = useMapStore.getState()
  useMapStore.setState({ map: { ...map, props, hiddenLayers: [], lockedLayers: [] }, selection: [], past: [], future: [] })
}

const ids = () => useMapStore.getState().map.props.map((p) => p.id)

describe('Pôr por cima e por baixo', () => {
  beforeEach(() => prepararMapa([PEQUENA, GRANDE]))

  it('"Pôr por cima" leva a caixa pequena ao topo num passo do Ctrl+Z, o clique passa a pegá-la, e repetir não deixa passo', () => {
    expect(findPropAt(useMapStore.getState().map.props, NA_SOBREPOSICAO)?.id).toBe('grande')

    useMapStore.getState().reordenarObjetos(['pequena'], 'cima')
    expect(ids()).toEqual(['grande', 'pequena'])
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(findPropAt(useMapStore.getState().map.props, NA_SOBREPOSICAO)?.id).toBe('pequena')

    useMapStore.getState().reordenarObjetos(['pequena'], 'cima')
    expect(useMapStore.getState().past).toHaveLength(1)

    useMapStore.getState().undo()
    expect(ids()).toEqual(['pequena', 'grande'])

    useMapStore.getState().reordenarObjetos(['grande'], 'baixo')
    expect(ids()).toEqual(['grande', 'pequena'])
  })

  it('o tapete "por cima" sobe só entre os de chão: a cadeira em cima dele continua por cima e é ela que o clique pega', () => {
    const tapete = movel('tapete', 'tapete', 140, 160)
    const outroTapete = movel('outro-tapete', 'tapete', 160, 160)
    const cadeira = movel('cadeira', 'cadeira', 140, 40)
    prepararMapa([cadeira, tapete, outroTapete])

    useMapStore.getState().reordenarObjetos(['tapete'], 'cima')
    const { props } = useMapStore.getState().map
    expect(props.map((p) => p.id)).toEqual(['cadeira', 'outro-tapete', 'tapete'])
    expect(emOrdemDeDesenho(props).map((p) => p.id)).toEqual(['outro-tapete', 'tapete', 'cadeira'])
    expect(findPropAt(props, NA_SOBREPOSICAO)?.id).toBe('cadeira')
  })
})
