/**
 * O BRILHO QUE MEXE dos carimbos (lote C6 de 14/11/2026: a brasa da rocha
 * vulcânica, `brilhoDosCarimbos.ts`), pelo palco dos carimbos com a arte falsa
 * (o jsdom não tem canvas). Prova: o carimbo com `brilho` ganha um sprite
 * somado por cima do corpo, no mesmo lugar, e o perde junto com ele; o sem
 * brilho não ganha nada. O pulso anda no relógio entre o mínimo e o máximo e,
 * com "menos movimento", o brilho para no meio e sai do relógio.
 */
import { describe, expect, it } from 'vitest'
import { Container, Sprite, Texture, Ticker } from 'pixi.js'
import type { Carimbo } from '../types/map'
import { QUADRO_DA_BIBLIOTECA } from '../carimbos/arte'
import { ALFA_DO_BRILHO_MAX, ALFA_DO_BRILHO_MIN, ALFA_DO_BRILHO_PARADO, FASES_DO_BRILHO, PASSO_DO_BRILHO_MS, faseDoBrilho } from './brilhoDosCarimbos'
import { createCarimbosRenderer, type ArteNoPalco, type EntradaDosCarimbos } from './drawCarimbos'

const MAPA = { width: 54, height: 54, grid: 23 }
const objeto = (id: string, x: number, y: number, tipo: string): Carimbo => ({ id, tipo, x, y, tamanho: 20, giro: 0 })

function entrada(carimbos: Carimbo[]): EntradaDosCarimbos {
  return { cena: 'c1', mapa: MAPA, carimbos, importados: undefined }
}

/** A arte falsa: só a rocha vulcânica tem a parte que acende. Sem silhueta, nada de sombra a pintar. */
function palco() {
  const brilhos = new Map<number, Texture>()
  const assar = (tipo: string, variante: number): ArteNoPalco => {
    const arte: ArteNoPalco = { corpo: new Texture(), quadro: QUADRO_DA_BIBLIOTECA, sombra: null, chao: false }
    if (tipo !== 'rocha-vulcanica') return arte
    const brilho = new Texture()
    brilhos.set(variante, brilho)
    return { ...arte, brilho }
  }
  const ticker = new Ticker()
  let agora = 1_000_000
  let reduzido = false
  const r = createCarimbosRenderer({ assar, pintarPedaco: () => new Texture(), movimento: { ticker, reducedMotion: () => reduzido, agora: () => agora } })
  return {
    r,
    ticker,
    brilhos,
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
    reduzir() {
      reduzido = true
    },
  }
}

function camadaDe(camada: Container, rotulo: string): Container {
  const alvo = camada.getChildByLabel(rotulo)
  if (alvo === null) throw new Error(`sem ${rotulo}`)
  return alvo
}

/** Os sprites do brilho, de todas as fases. */
function spritesDoBrilho(camada: Container): Sprite[] {
  return camadaDe(camada, 'carimbos-brilho').children.flatMap((fase) => fase.children.filter((c): c is Sprite => c instanceof Sprite))
}

describe('o brilho que mexe dos carimbos', () => {
  it('a rocha ganha um sprite somado por cima do corpo, no mesmo lugar, e o perde com ela; o pinheiro não ganha nada', () => {
    const p = palco()
    p.r.atualizar(entrada([objeto('rocha', 100, 200, 'rocha-vulcanica'), objeto('arvore', 300, 100, 'pinheiro')]))
    const ordem = p.r.camada.children.map((c) => c.label)
    expect(ordem.indexOf('carimbos-brilho')).toBe(ordem.indexOf('carimbos-corpos') + 1)
    const corpos = camadaDe(p.r.camada, 'carimbos-corpos').children.filter((c): c is Sprite => c instanceof Sprite)
    expect(corpos).toHaveLength(2)
    const [brilho] = spritesDoBrilho(p.r.camada)
    expect(spritesDoBrilho(p.r.camada)).toHaveLength(1)
    expect(brilho.blendMode).toBe('add')
    expect(brilho.texture).toBe(p.brilhos.get(0))
    // No quadro do corpo da rocha: mesma posição, âncora e escala.
    const corpoDaRocha = corpos.find((s) => s.x === 100 && s.y === 200)
    if (corpoDaRocha === undefined) throw new Error('o corpo da rocha devia estar no palco')
    expect([brilho.x, brilho.y]).toEqual([100, 200])
    expect([brilho.anchor.x, brilho.anchor.y]).toEqual([corpoDaRocha.anchor.x, corpoDaRocha.anchor.y])
    expect([brilho.scale.x, brilho.scale.y]).toEqual([corpoDaRocha.scale.x, corpoDaRocha.scale.y])
    // Na fase do id dele.
    expect(camadaDe(p.r.camada, 'carimbos-brilho').children[faseDoBrilho('rocha')].children).toContain(brilho)

    p.r.atualizar(entrada([objeto('arvore', 300, 100, 'pinheiro')]))
    expect(spritesDoBrilho(p.r.camada)).toHaveLength(0)
    expect(brilho.destroyed).toBe(true)
    p.r.destruir()
  })

  it('pulsa no relógio entre o mínimo e o máximo; sem brilho na cena ou com menos movimento, fica parado no meio e sai do relógio', () => {
    const p = palco()
    expect(p.ticker.count).toBe(0)
    p.r.atualizar(entrada([objeto('rocha', 100, 200, 'rocha-vulcanica')]))
    expect(p.ticker.count).toBe(1)
    const fases = camadaDe(p.r.camada, 'carimbos-brilho').children
    expect(fases).toHaveLength(FASES_DO_BRILHO)
    const fase = fases[faseDoBrilho('rocha')]
    const alfas: number[] = []
    for (let i = 0; i < 24; i += 1) {
      p.quadro(PASSO_DO_BRILHO_MS)
      alfas.push(fase.alpha)
    }
    expect(new Set(alfas.map((v) => v.toFixed(3))).size).toBeGreaterThan(5)
    expect(Math.min(...alfas)).toBeGreaterThanOrEqual(ALFA_DO_BRILHO_MIN - 1e-9)
    expect(Math.max(...alfas)).toBeLessThanOrEqual(ALFA_DO_BRILHO_MAX + 1e-9)

    // Menos movimento: conferido uma vez por segundo, o brilho para no meio e o relógio solta.
    p.reduzir()
    p.quadro(1000)
    expect(p.ticker.count).toBe(0)
    for (const f of fases) expect(f.alpha).toBe(ALFA_DO_BRILHO_PARADO)

    // Sem brilho na cena, também nada no relógio.
    const outro = palco()
    outro.r.atualizar(entrada([objeto('rocha', 100, 200, 'rocha-vulcanica')]))
    outro.r.atualizar(entrada([]))
    expect(outro.ticker.count).toBe(0)
    for (const f of camadaDe(outro.r.camada, 'carimbos-brilho').children) expect(f.alpha).toBe(ALFA_DO_BRILHO_PARADO)
    p.r.destruir()
    outro.r.destruir()
  })
})
