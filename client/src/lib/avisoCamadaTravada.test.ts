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

describe('aviso com o rótulo das 13 camadas (fase 3, fatia 5)', () => {
  it.each([
    ['chao', 'Chão'],
    ['terreno', 'Terreno'],
    ['desenhos', 'Desenhos'],
    ['telhados', 'Telhados'],
    ['decoracao', 'Decoração'],
  ] as const)('%s vira "%s" no aviso de travada e no de oculta', (camada, rotulo) => {
    avisarCamadaTravada(camada)
    avisarCamadaOculta(camada)
    expect(useToastStore.getState().toasts.map((aviso) => aviso.text)).toEqual([
      `A camada ${rotulo} está travada`,
      `A camada ${rotulo} está oculta`,
    ])
  })

  it('camada livre usa o nome do modelo; sem nome não aparece id nem "undefined"', () => {
    const { map } = useMapStore.getState()
    useMapStore.setState({ map: { ...map, modeloCamadas: { ordem: [{ id: 'livre_a1', nome: 'Armadilhas' }, { id: 'livre_b2' }] } } })
    avisarCamadaTravada('livre_a1')
    avisarCamadaTravada('livre_b2')
    expect(useToastStore.getState().toasts.map((aviso) => aviso.text)).toEqual([
      'A camada Armadilhas está travada',
      'A camada sem nome está travada',
    ])
  })

  it('camada que o cadeado de hoje não guarda: o aviso sai SEM "Destravar" (botão que não faria nada)', () => {
    avisarCamadaTravada('terreno')
    expect(useToastStore.getState().toasts.map((aviso) => aviso.text)).toEqual(['A camada Terreno está travada'])
    expect(botaoDestravar()).toBeUndefined()
  })

  it('camada que o olho de hoje não guarda: o aviso sai SEM "Mostrar"', () => {
    avisarCamadaOculta('chao')
    expect(useToastStore.getState().toasts.map((aviso) => aviso.text)).toEqual(['A camada Chão está oculta'])
    expect(botaoMostrar()).toBeUndefined()
  })

  it('camada livre também fica sem botão (o cadeado dela ainda não tem onde morar)', () => {
    avisarCamadaTravada('livre_a1')
    expect(botaoDestravar()).toBeUndefined()
  })

  it('das 9 de hoje, o botão continua lá', () => {
    avisarCamadaTravada('tokens')
    expect(botaoDestravar()).toBeDefined()
    useToastStore.setState({ toasts: [] })
    avisarCamadaOculta('salas')
    expect(botaoMostrar()).toBeDefined()
  })
})

describe('mapa v2: "Destravar" e "Mostrar" em qualquer camada (revisão da fatia 6)', () => {
  const comV2 = (extra: Partial<ReturnType<typeof useMapStore.getState>['map']>) => {
    const { map } = useMapStore.getState()
    useMapStore.setState({ map: { ...map, versaoDasCamadas: 2, ocultasDoJogador: [], ...extra } })
  }

  it.each(['chao', 'terreno', 'telhados', 'livre_a1'] as const)('%s travada: "Destravar" aparece e destrava', (camada) => {
    comV2({ lockedLayers: [camada], modeloCamadas: { ordem: [{ id: 'livre_a1', nome: 'Armadilhas' }] } })
    avisarCamadaTravada(camada)
    const destravar = botaoDestravar()
    expect(destravar).toBeDefined()
    destravar?.run()
    expect(useMapStore.getState().map.lockedLayers).not.toContain(camada)
  })

  it.each(['chao', 'desenhos', 'terreno'] as const)('%s oculta: "Mostrar" aparece e mostra', (camada) => {
    comV2({ hiddenLayers: [camada] })
    avisarCamadaOculta(camada)
    const mostrar = botaoMostrar()
    expect(mostrar).toBeDefined()
    mostrar?.run()
    expect(useMapStore.getState().map.hiddenLayers).not.toContain(camada)
  })
})
