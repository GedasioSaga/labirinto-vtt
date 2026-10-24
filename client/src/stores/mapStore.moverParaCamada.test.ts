import { beforeEach, describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { addToken, createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'

const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null }
const BIA: Token = { id: 'bia', characterId: null, name: 'Bia', x: 200, y: 100, size: 1, image: null }

function mapa(extra: Partial<MapData> = {}): MapData {
  return { ...addToken(addToken(createEmptyMap('m', 'M', 10, 10, 50), ANA), BIA), ...extra }
}

function abrir(map: MapData): void {
  useMapStore.setState({ map, selection: EMPTY_SELECTION, past: [], future: [] })
  useToastStore.setState({ toasts: [] })
}

const camadaDe = (id: string) => useMapStore.getState().map.tokens.find((t) => t.id === id)?.camada
const avisos = () => useToastStore.getState().toasts.map((t) => t.text)

describe('mapStore.moverParaCamada (fatia 8)', () => {
  beforeEach(() => abrir(mapa()))

  it('vários itens = UM passo; Ctrl+Z devolve a camada de antes; Ctrl+Shift+Z refaz', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().moverParaCamada([{ tipo: 'ficha', id: 'ana' }, { tipo: 'ficha', id: 'bia' }], 'objetos')
    expect(useMapStore.getState().past).toHaveLength(1)
    expect([camadaDe('ana'), camadaDe('bia')]).toEqual(['objetos', 'objetos'])
    expect(avisos()).toContain('2 itens movidos para Objetos.')
    useMapStore.getState().undo()
    expect(useMapStore.getState().map).toBe(antes)
    useMapStore.getState().redo()
    expect([camadaDe('ana'), camadaDe('bia')]).toEqual(['objetos', 'objetos'])
  })

  it('o "Desfazer" do aviso desfaz o passo', () => {
    const antes = useMapStore.getState().map
    useMapStore.getState().moverParaCamada([{ tipo: 'ficha', id: 'ana' }], 'iluminacao')
    const aviso = useToastStore.getState().toasts.find((t) => t.text === 'Item movido para Iluminação.')
    aviso?.actions?.find((a) => a.label === 'Desfazer')?.run()
    expect(useMapStore.getState().map).toBe(antes)
  })

  it('camada travada não recebe: nada muda, nada entra no Ctrl+Z, e o aviso diz qual', () => {
    abrir(mapa({ lockedLayers: ['objetos'] }))
    const antes = useMapStore.getState().map
    const r = useMapStore.getState().moverParaCamada([{ tipo: 'ficha', id: 'ana' }], 'objetos')
    expect(r.recusa).toBe('destino-travado')
    expect(useMapStore.getState().map).toBe(antes)
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(avisos()).toContain('A camada Objetos está travada')
  })

  it('camada travada não entrega: o item dela fica, sem passo', () => {
    abrir(mapa({ lockedLayers: ['tokens'] }))
    useMapStore.getState().moverParaCamada([{ tipo: 'ficha', id: 'ana' }], 'objetos')
    expect(camadaDe('ana')).toBeUndefined()
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(avisos()).toContain('A camada Tokens está travada')
  })

  it('para uma camada oculta do mestre: move e avisa onde o item foi parar', () => {
    abrir(mapa({ hiddenLayers: ['objetos'] }))
    useMapStore.getState().moverParaCamada([{ tipo: 'ficha', id: 'ana' }], 'objetos')
    expect(camadaDe('ana')).toBe('objetos')
    expect(avisos()).toContain('A camada Objetos está oculta')
  })

  it('a mesma camada não gasta passo nem avisa', () => {
    useMapStore.getState().moverParaCamada([{ tipo: 'ficha', id: 'ana' }], 'tokens')
    expect(useMapStore.getState().past).toHaveLength(0)
    expect(avisos()).toEqual([])
  })
})
