import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import { avisarCamadaOculta, avisarCamadaTravada } from './avisoCamadaTravada'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  const { map } = useMapStore.getState()
  useMapStore.setState({ map: { ...map, lockedLayers: ['paredes'], hiddenLayers: ['objetos'] } })
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

function botaoMostrar() {
  const [aviso] = useToastStore.getState().toasts
  return aviso?.actions?.find((acao) => acao.label === 'Mostrar')
}

describe('aviso de camada oculta (ferramenta Objetos, 28/09/2026)', () => {
  it('diz qual camada está oculta e oferece "Mostrar" no próprio aviso', () => {
    avisarCamadaOculta('objetos')
    expect(useToastStore.getState().toasts).toMatchObject([{ kind: 'info', text: 'A camada Objetos está oculta' }])
    expect(botaoMostrar()).toBeDefined()
  })

  it('clicar várias vezes na camada oculta deixa UM aviso só', () => {
    avisarCamadaOculta('objetos')
    avisarCamadaOculta('objetos')
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('"Mostrar" volta a camada para a vista', () => {
    avisarCamadaOculta('objetos')
    botaoMostrar()?.run()
    expect(useMapStore.getState().map.hiddenLayers).not.toContain('objetos')
  })

  it('"Mostrar" numa camada que já voltou por outro caminho não a oculta de novo', () => {
    avisarCamadaOculta('objetos')
    const { map } = useMapStore.getState()
    useMapStore.setState({ map: { ...map, hiddenLayers: [] } })
    botaoMostrar()?.run()
    expect(useMapStore.getState().map.hiddenLayers).not.toContain('objetos')
  })
})
