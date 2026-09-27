import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import { avisarCamadaTravada } from './avisoCamadaTravada'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  const { map } = useMapStore.getState()
  useMapStore.setState({ map: { ...map, lockedLayers: ['paredes'] } })
})

function botaoDestravar() {
  const [aviso] = useToastStore.getState().toasts
  return aviso?.actions?.find((acao) => acao.label === 'Destravar')
}

describe('aviso de camada travada (27/09/2026)', () => {
  it('diz qual camada está travada e oferece "Destravar" no próprio aviso', () => {
    avisarCamadaTravada('paredes')
    expect(useToastStore.getState().toasts).toMatchObject([{ kind: 'info', text: 'A camada Paredes está travada' }])
    expect(botaoDestravar()).toBeDefined()
  })

  it('clicar várias vezes na parede travada deixa UM aviso só', () => {
    avisarCamadaTravada('paredes')
    avisarCamadaTravada('paredes')
    avisarCamadaTravada('paredes')
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('"Destravar" libera a camada', () => {
    avisarCamadaTravada('paredes')
    botaoDestravar()?.run()
    expect(useMapStore.getState().map.lockedLayers).not.toContain('paredes')
  })

  it('"Destravar" numa camada já destravada por outro caminho não trava de novo', () => {
    avisarCamadaTravada('paredes')
    const { map } = useMapStore.getState()
    useMapStore.setState({ map: { ...map, lockedLayers: [] } })
    botaoDestravar()?.run()
    expect(useMapStore.getState().map.lockedLayers).not.toContain('paredes')
  })
})
