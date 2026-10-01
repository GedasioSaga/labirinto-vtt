import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap, setTokenPosition } from '../lib/mapFactory'
import { consumirMovimentosRemotos } from '../lib/movimentoRemoto'
import { hostPlayerChanges } from '../net/playerChanges'
import type { MapData, Token } from '../types/map'
import { useAdventureStore } from './adventureStore'
import { mapChangeCause, useMapStore } from './mapStore'
import { subscribeToTokensRedraw } from './tokensSubscription'

/**
 * QUEM DEPENDE DE `setTokenPosition` DEVOLVER O MESMO MAPA quando a ficha já
 * está no lugar (o arrasto do mestre dentro da mesma casa, achado da trilha
 * C1). Cada um destes lê "mesma referência" como "nada mudou":
 *  - a store: `moveTokenLive` só faz `set` com mapa novo — sem `set`, nem o
 *    App nem o redraw das fichas (`subscribeToTokensRedraw`) acordam;
 *  - o histórico: `commitDragHistory(before)` não empurra passo quando o mapa
 *    do soltar é o `before` (ou só o jogador mexeu no meio);
 *  - a ponte do host: `mapChangeCause` devolve `null` e nenhum snapshot é
 *    agendado para os jogadores (o App liga a ponte exatamente assim);
 *  - o deslize remoto (`1226d98f`): a marca do passo do jogador ainda chega ao
 *    redraw dele, e o arrasto parado do mestre não acorda redraw vazio;
 *  - a caravana: `setTokenPositionsLive` e `updateBackgroundScene` (cena de
 *    fundo, `App.tsx: applyCaravanMoves`) com o seguidor já no lugar.
 */

const GRADE = 50
const CENA_DE_FUNDO = 'c-fundo'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

/** A Ana (do mestre) leva a tocha e o ferido; a Lia é a ficha de um jogador. */
function mesa(): MapData {
  return {
    ...createEmptyMap('m-arrasto', 'Estrada', 40, 40, GRADE),
    tokens: [ficha('ana', 125, 125), ficha('ferido', 175, 125, { levadoPor: 'ana' }), ficha('lia', 525, 525)],
    lights: [{ id: 'tocha', x: 125, y: 125, radius: 100, color: '#ffcc66', intensity: 1, attachedTokenId: 'ana' }],
  }
}

function posicao(id: string): string {
  const achado = useMapStore.getState().map.tokens.find((t) => t.id === id)
  return achado === undefined ? `${id}:sumiu` : `${id}:${achado.x},${achado.y}`
}

/** Os pointermoves que o canvas manda enquanto o ponteiro não sai da casa da Ana (posição já encaixada). */
function tremeNaCasa(vezes: number, x = 125, y = 125): void {
  for (let i = 0; i < vezes; i += 1) useMapStore.getState().moveTokenLive('ana', x, y)
}

beforeEach(() => {
  useMapStore.getState().loadMap(mesa())
})

describe('arrasto da ficha do mestre dentro da mesma casa', () => {
  it('os pointermoves na casa de origem não acordam a store: nem aviso, nem redraw das fichas', () => {
    const inicial = useMapStore.getState().map
    let avisos = 0
    let redraws = 0
    const pararAvisos = useMapStore.subscribe(() => {
      avisos += 1
    })
    const pararRedraw = subscribeToTokensRedraw(() => {
      redraws += 1
    })
    tremeNaCasa(30)
    pararAvisos()
    pararRedraw()
    expect(useMapStore.getState().map).toBe(inicial)
    expect({ avisos, redraws }).toEqual({ avisos: 0, redraws: 0 })
  })

  it('soltar sem ter saído da casa não vira passo do Ctrl+Z', () => {
    const before = useMapStore.getState().map
    tremeNaCasa(10)
    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past).toHaveLength(0)
  })

  it('arrastar para outra casa e soltar continua UM passo, e o Ctrl+Z devolve a Ana, a tocha e o ferido', () => {
    const before = useMapStore.getState().map
    tremeNaCasa(3)
    tremeNaCasa(3, 125, 175)
    tremeNaCasa(3, 125, 225)
    useMapStore.getState().commitDragHistory(before)
    expect(useMapStore.getState().past).toHaveLength(1)
    expect([posicao('ana'), posicao('ferido')]).toEqual(['ana:125,225', 'ferido:175,225'])

    useMapStore.getState().undo()
    expect([posicao('ana'), posicao('ferido')]).toEqual(['ana:125,125', 'ferido:175,125'])
    expect(useMapStore.getState().map.lights.find((l) => l.id === 'tocha')).toMatchObject({ x: 125, y: 125 })
  })

  it('a ponte do host só ouve "edit" quando a ficha troca de casa', () => {
    const causas: string[] = []
    // Como o App liga a ponte (`App.tsx`): só causa não nula vira `notifyMapChanged`.
    const parar = useMapStore.subscribe((state, previous) => {
      const causa = mapChangeCause(state, previous)
      if (causa !== null) causas.push(causa)
    })
    tremeNaCasa(5)
    tremeNaCasa(5, 125, 175)
    parar()
    expect(causas).toEqual(['edit'])
  })
})

describe('o jogador anda enquanto o mestre segura a ficha parada na casa', () => {
  it('o passo do jogador chega ao redraw marcado (desliza) e o soltar do mestre não cria passo vazio', () => {
    const redraws: string[][] = []
    // O redraw das fichas do editor consome a marca a cada vez que roda (`PixiCanvas.tsx: redrawTokens`).
    const parar = subscribeToTokensRedraw(() => {
      redraws.push([...consumirMovimentosRemotos()])
    })
    const before = useMapStore.getState().map
    tremeNaCasa(3)
    hostPlayerChanges.applyMove('lia', 575, 525)
    tremeNaCasa(3)
    useMapStore.getState().commitDragHistory(before)
    parar()

    expect(redraws).toEqual([['lia']])
    expect(posicao('lia')).toBe('lia:575,525')
    expect(useMapStore.getState().past).toHaveLength(0)
  })
})

describe('caravana com o seguidor já no lugar', () => {
  it('na cena aberta (setTokenPositionsLive): nenhuma mudança chega à ponte', () => {
    const inicial = useMapStore.getState().map
    const causas: string[] = []
    const parar = useMapStore.subscribe((state, previous) => {
      const causa = mapChangeCause(state, previous)
      if (causa !== null) causas.push(causa)
    })
    useMapStore.getState().setTokenPositionsLive([{ id: 'ana', x: 125, y: 125 }])
    parar()
    expect(causas).toEqual([])
    expect(useMapStore.getState().map).toBe(inicial)
  })

  it('numa cena de fundo (updateBackgroundScene): a cena não é marcada para salvar; um passo de verdade é', () => {
    const fundo = mesa()
    useAdventureStore.setState({ cache: { [CENA_DE_FUNDO]: { status: 'ok', map: fundo, past: [], future: [], camera: null } }, dirty: {} })
    // O mesmo passo de `applyCaravanMoves` (App.tsx) para quem está numa cena de fundo.
    useAdventureStore.getState().updateBackgroundScene(CENA_DE_FUNDO, (m) => setTokenPosition(m, 'ana', 125, 125))
    const slot = useAdventureStore.getState().cache[CENA_DE_FUNDO]
    expect(slot.status === 'ok' ? slot.map : null).toBe(fundo)
    expect(useAdventureStore.getState().dirty[CENA_DE_FUNDO]).toBeUndefined()

    useAdventureStore.getState().updateBackgroundScene(CENA_DE_FUNDO, (m) => setTokenPosition(m, 'ana', 125, 175))
    expect(useAdventureStore.getState().dirty[CENA_DE_FUNDO]).toBe(true)
  })
})
