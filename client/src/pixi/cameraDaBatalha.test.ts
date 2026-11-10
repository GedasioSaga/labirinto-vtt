// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ligarCameraDaBatalha, pontoAVista, registrarCameraDaBatalha, trazerFichaDaVez } from './cameraDaBatalha'

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

  it('ficha embaixo da interface (faixa da ordem, menu da vez) vai para o mapa que aparece, perto de onde estava', () => {
    // A faixa cobre o topo; o menu, o meio; o painel, a direita. O mapa aparece à esquerda e embaixo.
    const livre = (x: number, y: number) => !(y < 180 || (x > 300 && x < 700 && y < 480) || x > 850)
    const destino = pontoAVista({ x: 500, y: 300 }, TELA, livre)
    expect(destino).not.toBeNull()
    if (destino === null) return
    expect(livre(destino.x, destino.y)).toBe(true)
    // Longe da beira do que aparece (pelo menos uma casa da amostra de folga).
    expect(livre(destino.x - 60, destino.y) && livre(destino.x + 60, destino.y) && livre(destino.x, destino.y - 60)).toBe(true)
    // Já à vista (sem nada por cima, longe da borda): fica quieta.
    expect(pontoAVista({ x: 150, y: 400 }, TELA, livre)).toBeNull()
  })

  it('não puxa a tela enquanto o mestre arrasta; ao soltar, traz a ficha que esperou', () => {
    const tela = montar({ x: 20, y: 300 })
    soltar = tela.soltar
    ponteiro('pointerdown')
    trazerFichaDaVez('t1')
    expect(tela.irPara).not.toHaveBeenCalled()
    ponteiro('pointerup')
    expect(tela.irPara).toHaveBeenCalledTimes(1)
    expect(tela.irPara).toHaveBeenCalledWith({ x: 480, y: 0, scale: 1 })
  })
})
