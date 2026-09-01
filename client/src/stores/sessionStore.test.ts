import { describe, expect, it, beforeEach } from 'vitest'
import { useMapStore } from './mapStore'
import { useSessionStore, subscribeToDirtyFlag } from './sessionStore'
import * as mapFactory from '../lib/mapFactory'
import type { Wall } from '../types/map'

const wall: Wall = { id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null }

describe('sessionStore (frente D, onda 2 — item 11: não perder trabalho)', () => {
  beforeEach(() => {
    // Baseline limpa antes de cada teste: um mapa novo em `mapStore`, e
    // `markSaved()` reancora `lastSyncedMap` do sessionStore nele — sem
    // isso, `isDirty` herdaria estado do teste anterior (módulo-singleton).
    useMapStore.setState({
      map: mapFactory.createEmptyMap('map_test', 'Teste', 10, 10, 64),
      camera: { x: 0, y: 0, scale: 1 },
      selection: [],
      past: [],
      future: [],
    })
    useSessionStore.getState().markSaved()
  })

  it('começa limpo (isDirty=false) depois do markSaved da baseline', () => {
    expect(useSessionStore.getState().isDirty).toBe(false)
  })

  it('marca sujo quando uma action de conteúdo muda o mapa (addWall)', () => {
    const unsubscribe = subscribeToDirtyFlag()
    useMapStore.getState().addWall(wall)
    expect(useSessionStore.getState().isDirty).toBe(true)
    unsubscribe()
  })

  it('NÃO marca sujo quando só a câmera muda (setCamera não toca state.map)', () => {
    const unsubscribe = subscribeToDirtyFlag()
    useMapStore.getState().setCamera({ x: 100, y: 50, scale: 2 })
    expect(useSessionStore.getState().isDirty).toBe(false)
    unsubscribe()
  })

  it('NÃO marca sujo quando só a seleção ou a ferramenta ativa mudam', () => {
    const unsubscribe = subscribeToDirtyFlag()
    useMapStore.getState().setSelection([{ kind: 'wall', id: 'w1' }])
    useMapStore.getState().setActiveTool('wall')
    expect(useSessionStore.getState().isDirty).toBe(false)
    unsubscribe()
  })

  it('markSaved() zera isDirty depois de uma edição', () => {
    const unsubscribe = subscribeToDirtyFlag()
    useMapStore.getState().addWall(wall)
    expect(useSessionStore.getState().isDirty).toBe(true)

    useSessionStore.getState().markSaved()
    expect(useSessionStore.getState().isDirty).toBe(false)
    unsubscribe()
  })

  it('loadMap (abrir mapa do disco) marca sujo até o integrador chamar markSaved()', () => {
    const unsubscribe = subscribeToDirtyFlag()
    useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_outro', 'Outro', 20, 20, 64))
    // Comportamento documentado no JSDoc de `markSaved`: carregar do disco
    // também deve ser seguido de `markSaved()` pelo integrador (App.tsx),
    // porque o mapa recém-aberto está em sincronia com o arquivo. Sem essa
    // chamada, este teste prova que a flag fica true — é o integrador quem
    // fecha o laço, não este módulo (não posso editar App.tsx).
    expect(useSessionStore.getState().isDirty).toBe(true)
    useSessionStore.getState().markSaved()
    expect(useSessionStore.getState().isDirty).toBe(false)
    unsubscribe()
  })

  it('desfazer (undo) de volta à MESMA referência salva zera isDirty sozinho, sem markSaved explícito', () => {
    const unsubscribe = subscribeToDirtyFlag()
    useMapStore.getState().addWall(wall)
    expect(useSessionStore.getState().isDirty).toBe(true)

    useMapStore.getState().undo()
    // `undo` restaura a referência exata guardada em `past` (mapStore.ts,
    // sem clone) — volta a ser === lastSyncedMap, então isDirty cai sozinho.
    expect(useSessionStore.getState().isDirty).toBe(false)
    unsubscribe()
  })

  it('redo depois do undo acima volta a marcar sujo (referência muda de novo, para a pós-addWall)', () => {
    const unsubscribe = subscribeToDirtyFlag()
    useMapStore.getState().addWall(wall)
    useMapStore.getState().undo()
    expect(useSessionStore.getState().isDirty).toBe(false)

    useMapStore.getState().redo()
    expect(useSessionStore.getState().isDirty).toBe(true)
    unsubscribe()
  })

  it('unsubscribe() para de atualizar isDirty — edição depois do cancelamento não é vista', () => {
    const unsubscribe = subscribeToDirtyFlag()
    unsubscribe()
    useMapStore.getState().addWall(wall)
    expect(useSessionStore.getState().isDirty).toBe(false)
  })

  it('markSaved() é idempotente e não lança quando chamado sem nenhuma assinatura ativa', () => {
    expect(() => useSessionStore.getState().markSaved()).not.toThrow()
    expect(useSessionStore.getState().isDirty).toBe(false)
  })
})
