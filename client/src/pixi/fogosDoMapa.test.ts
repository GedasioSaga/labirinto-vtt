import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics } from 'pixi.js'
import { createFogosDoMapa, type PropDoFogo } from './fogosDoMapa'
import { numeroDeLinguas } from '../lib/mobilia/fogo'

/**
 * OS FOGOS DO MAPA (objeto Fogo): o tamanho escolhe quantas línguas o fogo tem,
 * e o fogo fora da vista sai do relógio (fogo fora da câmera custa zero por
 * quadro em mapa grande).
 */

const TELA = { cameraScale: 1, grade: 50 }

function fogo(id: string, x: number, y: number, width: number, height: number): PropDoFogo {
  return { id, x, y, width, height, mobilia: 'fogo' }
}

function linguasNaCamada(camada: Container, id: string): number {
  const chamas = camada.children.find((no) => no.label === 'chamas')
  const doFogo = chamas?.children.find((no) => no.label === `fogo:${id}`)
  return (doFogo?.children ?? []).filter((no) => no instanceof Graphics && no.label === 'borda').length
}

describe('fogosDoMapa', () => {
  it('o tamanho escolhe o número de línguas: 3 na Chama, 5 no Fogaréu, 11 no Incêndio', () => {
    const fogos = createFogosDoMapa()
    fogos.sincronizar([fogo('chama', 100, 100, 50, 50), fogo('fogareu', 400, 100, 100, 100), fogo('incendio', 800, 100, 200, 150)], TELA)
    expect(linguasNaCamada(fogos.camada, 'chama')).toBe(3)
    expect(linguasNaCamada(fogos.camada, 'fogareu')).toBe(5)
    expect(linguasNaCamada(fogos.camada, 'incendio')).toBe(11)
    expect([numeroDeLinguas(1, 1), numeroDeLinguas(2, 2), numeroDeLinguas(4, 3)]).toEqual([3, 5, 11])
    // Esticar dá mais línguas, nunca além do teto; objeto que não é fogo não ganha nó.
    fogos.sincronizar([fogo('chama', 100, 100, 50, 50), { ...fogo('mesa', 0, 0, 50, 50), mobilia: 'mesa' }, fogo('vila', 0, 0, 5000, 5000)], TELA)
    expect(fogos.estado().fogos).toBe(2)
    expect(linguasNaCamada(fogos.camada, 'vila')).toBe(24)
    fogos.destruir()
  })

  it('fogo fora da vista sai do relógio e para de desenhar; volta quando a câmera volta', () => {
    const ticker = { add: vi.fn(), remove: vi.fn() }
    const fogos = createFogosDoMapa({ movimento: { ticker, reducedMotion: () => false, agora: () => 1000 } })
    fogos.ajustarAVista({ minX: 0, minY: 0, maxX: 800, maxY: 600 })
    fogos.sincronizar([fogo('perto', 300, 300, 50, 50), fogo('longe', 9000, 9000, 50, 50)], TELA)
    expect(fogos.estado()).toEqual({ fogos: 2, naVista: 1, animando: true })
    expect(ticker.add).toHaveBeenCalledTimes(1)

    // A câmera vai para longe dos dois: ninguém na vista, o relógio desinscreve.
    fogos.ajustarAVista({ minX: 20000, minY: 20000, maxX: 20800, maxY: 20600 })
    expect(fogos.estado()).toEqual({ fogos: 2, naVista: 0, animando: false })
    expect(ticker.remove).toHaveBeenCalledTimes(1)
    const chamas = fogos.camada.children.find((no) => no.label === 'chamas')
    expect(chamas?.children.every((no) => no.renderable === false)).toBe(true)

    // Volta para o perto: só ele desenha e o relógio volta.
    fogos.ajustarAVista({ minX: 0, minY: 0, maxX: 800, maxY: 600 })
    expect(fogos.estado()).toEqual({ fogos: 2, naVista: 1, animando: true })
    expect(ticker.add).toHaveBeenCalledTimes(2)
    expect(chamas?.children.find((no) => no.label === 'fogo:perto')?.renderable).toBe(true)
    expect(chamas?.children.find((no) => no.label === 'fogo:longe')?.renderable).toBe(false)

    // O fogo apagado do mapa sai; sem fogo nenhum, o relógio sai também.
    fogos.sincronizar([], TELA)
    expect(fogos.estado()).toEqual({ fogos: 0, naVista: 0, animando: false })
    fogos.destruir()
  })
})
