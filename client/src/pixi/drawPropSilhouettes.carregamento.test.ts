import { afterEach, describe, expect, it, vi } from 'vitest'
import { Graphics } from 'pixi.js'
import type { Prop } from '../types/map'
import { drawPropSilhouettes, trocarCarregadorDoRasterNoTeste } from './drawPropSilhouettes'
import { RasterDosMoveis, trocarRasterNoTeste } from './rasterDosMoveis'

/**
 * O chunk do Meio-Termo dos móveis (o import dinâmico de `rasterDosMoveis.ts`)
 * pode falhar ao carregar: rede caindo, versão nova publicada no meio da
 * sessão. A peça nova (MT4) pede esse chunk em todo mapa, com a chave de obra
 * desligada. Falhou: o móvel fica no desenho de linhas, sem rejeição não
 * tratada, e a próxima pintura tenta de novo, até um teto de tentativas.
 */

type ModuloDoRaster = typeof import('./rasterDosMoveis')

function vaso(extra: Partial<Prop> = {}): Prop {
  return { id: 'v', src: '', x: 100, y: 100, width: 25, height: 25, linkedMapPath: null, mobilia: 'vaso', mobiliaCor: '#8a5a46', ...extra }
}

function acoes(g: Graphics): string[] {
  return g.context.instructions.map((i) => i.action)
}

function rasterComFila(): () => void {
  const fatias: (() => void)[] = []
  trocarRasterNoTeste(new RasterDosMoveis({ agendar: (fatia) => fatias.push(fatia) }))
  return () => {
    while (fatias.length > 0) fatias.shift()?.()
  }
}

/** Deixa a promessa do carregador assentar (e os seus `then`/`catch`) antes de seguir. */
async function assentar(): Promise<void> {
  await new Promise((pronto) => setTimeout(pronto, 0))
}

const falhaDoChunk = (): Promise<ModuloDoRaster> => Promise.reject(new Error('Failed to fetch dynamically imported module'))

afterEach(() => {
  trocarCarregadorDoRasterNoTeste(null)
  trocarRasterNoTeste(null)
  vi.restoreAllMocks()
})

describe('drawPropSilhouettes quando o chunk do raster falha', () => {
  it('falhou uma vez: fica o desenho de linhas; a próxima pintura tenta de novo e, chegando, a peça nova vira imagem', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const rodar = rasterComFila()
    const carregar = vi.fn<() => Promise<ModuloDoRaster>>().mockImplementationOnce(falhaDoChunk).mockImplementation(() => import('./rasterDosMoveis'))
    trocarCarregadorDoRasterNoTeste(carregar)
    const g = new Graphics()

    expect(drawPropSilhouettes(g, [vaso()], 1, 1)).toBe(1)
    await assentar()
    expect(carregar).toHaveBeenCalledTimes(1)
    // A reserva: o desenho de linhas da peça nova, nenhuma imagem.
    expect(acoes(g)).toContain('stroke')
    expect(acoes(g)).not.toContain('texture')

    // A próxima pintura (a câmera andou, o mestre mexeu num objeto) pede o chunk de novo.
    drawPropSilhouettes(g, [vaso()], 1, 1)
    await assentar()
    expect(carregar).toHaveBeenCalledTimes(2)
    rodar()
    expect(acoes(g)).toEqual(['texture'])
  })

  it('falha sempre: tenta no máximo 3 vezes, segue no desenho de linhas e não martela a rede', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    rasterComFila()
    const carregar = vi.fn<() => Promise<ModuloDoRaster>>(falhaDoChunk)
    trocarCarregadorDoRasterNoTeste(carregar)
    const g = new Graphics()
    for (let pintura = 0; pintura < 6; pintura += 1) {
      expect(drawPropSilhouettes(g, [vaso(), vaso({ id: 'w', x: 200 })], 1, 1)).toBe(2)
      await assentar()
      expect(acoes(g)).toContain('stroke')
      expect(acoes(g)).not.toContain('texture')
    }
    expect(carregar).toHaveBeenCalledTimes(3)
  })

  it('a falha não segura o Graphics: quem se pintou antes dela não é repintado quando outra tentativa dá certo', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    rasterComFila()
    const carregar = vi.fn<() => Promise<ModuloDoRaster>>().mockImplementationOnce(falhaDoChunk).mockImplementation(() => import('./rasterDosMoveis'))
    trocarCarregadorDoRasterNoTeste(carregar)
    const antes = new Graphics()
    drawPropSilhouettes(antes, [vaso()], 1, 1)
    await assentar()
    const repintar = vi.spyOn(antes, 'clear')
    drawPropSilhouettes(new Graphics(), [vaso({ id: 'w' })], 1, 1)
    await assentar()
    expect(carregar).toHaveBeenCalledTimes(2)
    expect(repintar).not.toHaveBeenCalled()
  })
})
