// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ligarCameraDaBatalha, registrarCameraDaBatalha, trazerFichaDaVez } from './cameraDaBatalha'

/**
 * A CÂMERA DA BATALHA (D7, decisão 6): na troca de vez, só traz a ficha da vez
 * quando ela está na borda ou fora; e (T3, 10/11) nunca no meio de um arrasto
 * do mestre (o mapa ou uma ficha com o ponteiro apertado).
 */
const TELA = { width: 1000, height: 600 }

function montar(ponto: { x: number; y: number }) {
  const irPara = vi.fn()
  const soltar = registrarCameraDaBatalha({ pontoDaFicha: () => ponto, camera: () => ({ x: 0, y: 0, scale: 1 }), tela: () => TELA, irPara })
  return { irPara, soltar }
}

const ponteiro = (tipo: 'pointerdown' | 'pointerup', pointerId = 1) => {
  const evento = new Event(tipo, { bubbles: true })
  Object.defineProperty(evento, 'pointerId', { value: pointerId })
  window.dispatchEvent(evento)
}

describe('câmera da batalha', () => {
  let soltar: (() => void) | null = null
  afterEach(() => {
    soltar?.()
    soltar = null
    ligarCameraDaBatalha(true)
  })

  it('traz a ficha da borda para o meio, sem zoom, e deixa quieta a do miolo', () => {
    const naBorda = montar({ x: 20, y: 300 })
    soltar = naBorda.soltar
    trazerFichaDaVez('t1')
    expect(naBorda.irPara).toHaveBeenCalledWith({ x: 480, y: 0, scale: 1 })
    naBorda.soltar()
    const noMiolo = montar({ x: 500, y: 300 })
    soltar = noMiolo.soltar
    trazerFichaDaVez('t1')
    expect(noMiolo.irPara).not.toHaveBeenCalled()
  })

  it('não puxa a tela enquanto o mestre arrasta; depois de soltar, volta a seguir', () => {
    const tela = montar({ x: 20, y: 300 })
    soltar = tela.soltar
    ponteiro('pointerdown')
    trazerFichaDaVez('t1')
    expect(tela.irPara).not.toHaveBeenCalled()
    ponteiro('pointerup')
    trazerFichaDaVez('t1')
    expect(tela.irPara).toHaveBeenCalledTimes(1)
  })
})
