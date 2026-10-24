import { afterEach, describe, expect, it } from 'vitest'
import { Container, Texture } from 'pixi.js'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { PALETA_DO_TETO, type ModeloDoTeto } from '../lib/telhado/paletas'
import { pintarTelhado, type ImagemDoTelhado } from '../texturas/telhado'
import { createTelhadosRenderer, escalaDaTexturaDoTelhado, telhadoParaDesenhar, type TelhadoParaDesenhar } from './telhadosRenderer'

/** Os mesmos bytes (sem Buffer: o tsconfig do app não tem os tipos do Node). */
function mesmosBytes(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false
  return true
}

/**
 * CHAMINÉ e CUMEEIRA AMARRADA no renderer (MT10): o renderer é quem lê a
 * chave de obra e pede ao pintor os extras. Chave DESLIGADA: a chaminé chega
 * (`telhadoParaDesenhar`) mas é ignorada, a chave do cache é a de antes e
 * nada repinta ao ligar/desligar a chaminé. Chave LIGADA: a chaminé entra na
 * pintura e na chave do cache; a palha leva a cumeeira amarrada.
 */

afterEach(() => trocarObraNoTeste(false))

const CASA = [
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { x: 200, y: 150 },
  { x: 0, y: 150 },
]

function montar() {
  const tarefas: (() => void)[] = []
  const imagens: ImagemDoTelhado[] = []
  const renderer = createTelhadosRenderer({
    agendar: (tarefa) => tarefas.push(tarefa),
    fatiaMs: Number.POSITIVE_INFINITY,
    subirTextura: (imagem) => {
      imagens.push({ ...imagem, pixels: new Uint8ClampedArray(imagem.pixels) })
      return { texture: new Texture(), origemX: imagem.origemX, origemY: imagem.origemY, escala: imagem.escala }
    },
  })
  const camada = new Container()
  return {
    renderer,
    imagens,
    pintarTudo() {
      while (tarefas.length > 0) tarefas.shift()?.()
    },
    telhado(modelo: ModeloDoTeto, chamine: boolean): TelhadoParaDesenhar {
      return telhadoParaDesenhar(
        { id: 'sala', points: CASA, room: { shape: 'rect', name: 'Casa', roof: true, modeloDoTeto: modelo, ...(chamine ? { chamine: true as const } : {}) } },
        camada,
      )
    },
  }
}

function igual(a: ImagemDoTelhado, b: ImagemDoTelhado): boolean {
  return mesmosBytes(a.pixels, b.pixels)
}

const COR: Record<ModeloDoTeto, string> = { telhas: PALETA_DO_TETO.telhas[0].hex, madeira: PALETA_DO_TETO.madeira[0].hex, palha: PALETA_DO_TETO.palha[0].hex }
const ESCALA = escalaDaTexturaDoTelhado(CASA)

describe('telhadosRenderer: chaminé e cumeeira amarrada', () => {
  for (const modelo of ['telhas', 'madeira', 'palha'] as const) {
    it(`${modelo}, chave DESLIGADA: pinta como antes e ligar a chaminé não repinta`, () => {
      const t = montar()
      t.renderer.desenhar([t.telhado(modelo, true)], 'm')
      t.pintarTudo()
      expect(t.imagens).toHaveLength(1)
      expect(igual(t.imagens[0], pintarTelhado(CASA, modelo, COR[modelo], ESCALA))).toBe(true)
      t.renderer.desenhar([t.telhado(modelo, false)], 'm')
      t.pintarTudo()
      expect(t.renderer.pintadas()).toBe(1)
    })

    it(`${modelo}, chave LIGADA: a chaminé entra na pintura e trocar repinta`, () => {
      trocarObraNoTeste(true)
      const t = montar()
      t.renderer.desenhar([t.telhado(modelo, true)], 'm')
      t.pintarTudo()
      const amarrada = modelo === 'palha'
      expect(igual(t.imagens[0], pintarTelhado(CASA, modelo, COR[modelo], ESCALA, { chamine: true, cumeeiraAmarrada: amarrada }))).toBe(true)
      expect(igual(t.imagens[0], pintarTelhado(CASA, modelo, COR[modelo], ESCALA, { cumeeiraAmarrada: amarrada }))).toBe(false)
      t.renderer.desenhar([t.telhado(modelo, false)], 'm')
      t.pintarTudo()
      expect(t.renderer.pintadas()).toBe(2)
      expect(igual(t.imagens[1], pintarTelhado(CASA, modelo, COR[modelo], ESCALA, { cumeeiraAmarrada: amarrada }))).toBe(true)
    })
  }
})
