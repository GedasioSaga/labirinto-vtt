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
  const chamas = camada.getChildByLabel('chamas', true)
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
    const chamas = fogos.camada.getChildByLabel('chamas', true)
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

  it('caça 12/11 (P33): na tela do jogador as línguas e as fagulhas passam pelo recorte da visão e da zona oculta; no mestre, não', () => {
    /** As máscaras acima do nó, até a camada (a do que ele vê e a da zona oculta, invertida). */
    const mascarasAcima = (no: Container | null): unknown[] => {
      const out: unknown[] = []
      // Sem máscara o Pixi devolve `undefined` ou `null`, conforme o nó já teve uma.
      for (let n = no; n !== null && n !== undefined; n = n.parent) if (n.mask !== null && n.mask !== undefined) out.push(n.mask)
      return out
    }
    const fogos = createFogosDoMapa()
    fogos.sincronizar([fogo('lareira', 100, 100, 50, 50)], TELA)
    const chamas = fogos.camada.getChildByLabel('chamas', true)
    const brilhos = fogos.camada.getChildByLabel('brilhos', true)
    expect(mascarasAcima(chamas)).toEqual([])
    const anel = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }]
    fogos.recortar({ ver: [anel], esconder: [anel] })
    // As mesmas duas máscaras do brilho: o que ele vê e, invertida, a zona oculta.
    expect(mascarasAcima(chamas)).toHaveLength(2)
    expect(mascarasAcima(chamas)).toEqual(mascarasAcima(brilhos))
    // A ordem fica: brilho embaixo, línguas por cima dele.
    expect(chamas?.parent?.children.indexOf(chamas)).toBeGreaterThan(brilhos?.parent?.children.indexOf(brilhos) ?? Infinity)
    fogos.recortar(null)
    expect(mascarasAcima(chamas)).toEqual([])
    fogos.destruir()
  })
})
