import { beforeEach, describe, expect, it } from 'vitest'
import { useMapStore } from './mapStore'
import * as mapFactory from '../lib/mapFactory'
import { pinKindChangePatch } from '../lib/pins'
import { MINIGAME_PADRAO } from '../minigames/danca/tipos'
import type { Pin } from '../types/map'

/**
 * MINIGAME no editor: trocar o tipo é um `updatePin` com histórico (o mesmo
 * patch que o painel manda, `pinKindChangePatch`). Entrar grava o desafio
 * padrão, sair o apaga, e o Ctrl+Z devolve tudo junto. Gravar o mesmo
 * desafio de novo não empilha nada.
 */

const PONTO: Pin = mapFactory.buildPin('p', { x: 100, y: 100 }, 'exclamacao')

function pino(): Pin | undefined {
  return useMapStore.getState().map.pins[0]
}

function trocarTipo(kind: Pin['kind']): void {
  const atual = pino()
  if (atual === undefined) throw new Error('o pino sumiu')
  useMapStore.getState().updatePin(atual.id, pinKindChangePatch(atual, kind))
}

describe('troca de tipo para minigame no mapStore', () => {
  beforeEach(() => {
    useMapStore.getState().loadMap({ ...mapFactory.createEmptyMap('map_mini', 'Teste', 20, 20, 50), pins: [PONTO] })
  })

  it('virar minigame grava o desafio padrão num passo do desfazer', () => {
    trocarTipo('minigame')
    expect(pino()?.kind).toBe('minigame')
    expect(pino()?.minigame).toEqual(MINIGAME_PADRAO)
    expect(useMapStore.getState().past).toHaveLength(1)
    useMapStore.getState().undo()
    expect(pino()?.kind).toBe('exclamacao')
    expect(pino()?.minigame).toBeUndefined()
  })

  it('escolher minigame de novo não empilha nada e não apaga o desafio', () => {
    trocarTipo('minigame')
    const id = pino()?.id ?? ''
    useMapStore.getState().updatePin(id, { minigame: { ...MINIGAME_PADRAO, npc: 'Seu Lula' } })
    expect(useMapStore.getState().past).toHaveLength(2)
    trocarTipo('minigame')
    expect(useMapStore.getState().past).toHaveLength(2)
    expect(pino()?.minigame?.npc).toBe('Seu Lula')
  })

  it('gravar o mesmo desafio (objeto novo, mesmo valor) não é mudança', () => {
    trocarTipo('minigame')
    const id = pino()?.id ?? ''
    useMapStore.getState().updatePin(id, { minigame: { ...MINIGAME_PADRAO, premio: { ...MINIGAME_PADRAO.premio } } })
    expect(useMapStore.getState().past).toHaveLength(1)
  })

  it('sair do minigame apaga o desafio e a porta ligada no mesmo passo', () => {
    trocarTipo('minigame')
    const id = pino()?.id ?? ''
    useMapStore.getState().updatePin(id, { portaLigada: 'porta-1' })
    trocarTipo('interrogacao')
    expect(pino()?.kind).toBe('interrogacao')
    expect(pino()?.minigame).toBeUndefined()
    expect(pino()?.portaLigada).toBeUndefined()
    useMapStore.getState().undo()
    expect(pino()?.kind).toBe('minigame')
    expect(pino()?.portaLigada).toBe('porta-1')
    expect(pino()?.minigame).toEqual(MINIGAME_PADRAO)
  })
})
