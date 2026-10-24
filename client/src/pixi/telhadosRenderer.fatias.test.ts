import { describe, expect, it } from 'vitest'
import { Container, Texture } from 'pixi.js'
import { comecarTelhado, pintarTelhado, type ImagemDoTelhado } from '../texturas/telhado'
import { PALETA_DO_TETO, type ModeloDoTeto } from '../lib/telhado/paletas'
import { createTelhadosRenderer, escalaDaTexturaDoTelhado, type TexturaDoTelhado } from './telhadosRenderer'

/**
 * PALHA EM FATIAS (revisão da MT6): a palha custa mais que a telha por pixel
 * e, na CPU 4x do jogador, a textura de 1 milhão de pixels passava dos 200 ms
 * numa tarefa só. Então a palha é pintada em fatias de `fatiaMs`, uma tarefa
 * por fatia, e o resultado é o MESMO de pintar de uma vez. Telha e madeira
 * continuam numa tarefa só (não mudam de byte nem de caminho).
 */

const SALA = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 400, y: 300 },
  { x: 100, y: 300 },
]

function digital(bytes: Uint8ClampedArray): string {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i += 1) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

function montar() {
  const tarefas: (() => void)[] = []
  const subidas: ImagemDoTelhado[] = []
  let relogio = 0
  const renderer = createTelhadosRenderer({
    agendar: (tarefa) => tarefas.push(tarefa),
    fatiaMs: 8,
    // Cada olhada no relógio anda 1 ms: a fatia vê o tempo passar enquanto pinta.
    agoraDaPintura: () => (relogio += 1),
    subirTextura: (imagem): TexturaDoTelhado => {
      subidas.push(imagem)
      return { texture: new Texture(), origemX: imagem.origemX, origemY: imagem.origemY, escala: imagem.escala }
    },
  })
  return {
    renderer,
    subidas,
    /** Roda as tarefas uma a uma e devolve quantas foram. */
    rodarTudo(): number {
      let n = 0
      while (tarefas.length > 0) {
        tarefas.shift()?.()
        n += 1
      }
      return n
    },
  }
}

function desenharUma(m: ReturnType<typeof montar>, modelo: ModeloDoTeto, cor: string): void {
  m.renderer.desenhar([{ id: 'sala', points: SALA, modelo, cor, camada: new Container() }], 'mapa')
}

describe('palha em fatias', () => {
  it('a palha sai em várias tarefas e a imagem é a mesma de pintar de uma vez', () => {
    const m = montar()
    const cor = PALETA_DO_TETO.palha[0].hex
    desenharUma(m, 'palha', cor)
    const tarefas = m.rodarTudo()
    expect(m.subidas).toHaveLength(1)
    expect(tarefas).toBeGreaterThanOrEqual(3)
    expect(m.renderer.pintadas()).toBe(1)
    const deUmaVez = pintarTelhado(SALA, 'palha', cor, escalaDaTexturaDoTelhado(SALA))
    expect(digital(m.subidas[0].pixels)).toBe(digital(deUmaVez.pixels))
  })

  it('telha e madeira continuam numa tarefa só', () => {
    for (const modelo of ['telhas', 'madeira'] as const) {
      const m = montar()
      desenharUma(m, modelo, PALETA_DO_TETO[modelo][0].hex)
      expect(m.rodarTudo(), modelo).toBe(1)
      expect(m.subidas, modelo).toHaveLength(1)
    }
  })

  it('pintar em pedaços de qualquer tamanho dá os mesmos bytes (palha e telha)', () => {
    for (const modelo of ['palha', 'telhas'] as const) {
      const cor = PALETA_DO_TETO[modelo][2].hex
      const pintura = comecarTelhado(SALA, modelo, cor, 1.5)
      let pedacos = 0
      while (!pintura.pintarLinhas(1 + (pedacos % 7))) pedacos += 1
      expect(pedacos, modelo).toBeGreaterThan(10)
      expect(digital(pintura.imagem.pixels), modelo).toBe(digital(pintarTelhado(SALA, modelo, cor, 1.5).pixels))
    }
  })
})
