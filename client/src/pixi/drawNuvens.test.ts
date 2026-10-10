import { describe, expect, it } from 'vitest'
import { Container, Sprite, Texture, TextureSource, Ticker } from 'pixi.js'
import type { FloorPiece } from '../types/map'
import { APARICAO_DAS_NUVENS_MS, NUVEM_DE_PERTO, NUVENS, ceuDoMapa, medidaDaNuvem } from '../lib/nuvens'
import { FOLGA_DA_TEXTURA, createNuvensRenderer, type EstadoDasNuvens, type PapelDaNuvem } from './drawNuvens'

/**
 * NUVENS NO PALCO: seis sprites (sombras antes dos corpos), texturas feitas
 * uma vez, e por quadro só posição e opacidade. O relógio só roda com as
 * nuvens andando ou aparecendo; desligadas, paradas (movimento reduzido) ou
 * sem canvas, nada roda por quadro.
 */

/** O mapa real de teste (Tasmaturi Village): 200 × 200 células de 64 px. */
const MAPA = { width: 200, height: 200, grid: 64, floor: [], background: { type: 'color' as const, src: '#00375c' } }
const INICIO = 1_791_600_000_000

function palco(opcoes: { reduzido?: boolean; semCanvas?: boolean } = {}) {
  const ticker = new Ticker()
  let agora = INICIO
  let reduzido = opcoes.reduzido ?? false
  const feitas: { papel: PapelDaNuvem; textura: Texture }[] = []
  const estados: EstadoDasNuvens[] = []
  const nuvens = createNuvensRenderer(
    { ticker, reducedMotion: () => reduzido, agora: () => agora },
    {
      texturaDa: (_nuvem, papel) => {
        if (opcoes.semCanvas === true) return null
        const textura = new Texture({ source: new TextureSource({ width: 64, height: 32 }) })
        feitas.push({ papel, textura })
        return textura
      },
      aoMudar: (estado) => estados.push(estado),
    },
  )
  return {
    nuvens,
    ticker,
    feitas,
    estados,
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
    reduzir(valor: boolean) {
      reduzido = valor
    },
  }
}

function sprites(camada: Container): { sombras: Sprite[]; corpos: Sprite[] } {
  const [sombras, corpos] = camada.children
  return {
    sombras: sombras.children.filter((c): c is Sprite => c instanceof Sprite),
    corpos: corpos.children.filter((c): c is Sprite => c instanceof Sprite),
  }
}

describe('nuvens no palco', () => {
  it('ligadas: três sombras por baixo e três corpos por cima, aparecendo de leve, com o relógio rodando', () => {
    const { nuvens, ticker, estados, quadro } = palco()
    nuvens.atualizar({ cena: 'c1', mapa: MAPA })
    const { sombras, corpos } = sprites(nuvens.camada)
    expect(sombras).toHaveLength(3)
    expect(corpos).toHaveLength(3)
    expect(nuvens.camada.children[0].children).toEqual(sombras)
    expect(nuvens.camada.visible).toBe(true)
    expect(nuvens.camada.alpha).toBe(0)
    expect(ticker.count).toBe(1)
    expect(estados.at(-1)).toEqual({ nuvens: 3, movendo: true })
    quadro(APARICAO_DAS_NUVENS_MS / 2)
    expect(nuvens.camada.alpha).toBeGreaterThan(0.5)
    expect(nuvens.camada.alpha).toBeLessThan(1)
    quadro(APARICAO_DAS_NUVENS_MS)
    expect(nuvens.camada.alpha).toBe(1)
    // A aparição acabou, mas as nuvens seguem andando: o relógio fica.
    expect(ticker.count).toBe(1)
  })

  it('por quadro mudam só posição e opacidade: a nuvem anda a velocidade dela, a sombra vai junto, nada é refeito', () => {
    const { nuvens, feitas, quadro } = palco()
    nuvens.atualizar({ cena: 'c1', mapa: MAPA })
    quadro(16)
    const { sombras, corpos } = sprites(nuvens.camada)
    const ceu = ceuDoMapa(MAPA)
    if (ceu === null) throw new Error('sem céu')
    const medida = medidaDaNuvem(NUVENS[0], ceu)
    if (medida === null) throw new Error('não coube')
    const antes = { x: corpos[0].x, largura: corpos[0].width, textura: corpos[0].texture }
    quadro(1000)
    // Longe da ponta (fase 0,36), a nuvem só anda.
    expect(corpos[0].x - antes.x).toBeCloseTo(NUVENS[0].velocidade * ceu.unidade, 3)
    expect(corpos[0].width).toBe(antes.largura)
    expect(corpos[0].texture).toBe(antes.textura)
    expect(sombras[0].x - corpos[0].x).toBeCloseTo(medida.sombraDx, 6)
    expect(sombras[0].y - corpos[0].y).toBeCloseTo(medida.sombraDy, 6)
    expect(corpos[0].width).toBeCloseTo(medida.largura * (1 + 2 * FOLGA_DA_TEXTURA.x), 6)
    // Seis texturas, feitas uma vez só.
    expect(feitas).toHaveLength(6)
    expect(feitas.filter((f) => f.papel === 'sombra')).toHaveLength(3)
  })

  it('a mesma entrada de novo (snapshot do jogador, zoom) não refaz nada nem reaparece', () => {
    const { nuvens, feitas, ticker, quadro } = palco()
    nuvens.atualizar({ cena: 'c1', mapa: MAPA })
    quadro(APARICAO_DAS_NUVENS_MS + 10)
    nuvens.atualizar({ cena: 'c1', mapa: { ...MAPA } })
    expect(nuvens.camada.alpha).toBe(1)
    expect(feitas).toHaveLength(6)
    expect(ticker.count).toBe(1)
  })

  it('o céu mudou na mesma cena (uma pincelada alargou o chão): cada nuvem segue de onde estava, sem pular nem reaparecer', () => {
    const CELULA = 64
    const mar = (x0: number): FloorPiece => ({
      id: 'mar',
      shape: { kind: 'rect', cx: (x0 + 12400) / 2, cy: 7500, w: 12400 - x0, h: 9000 },
      op: 'add',
      modifiers: {},
      fillColor: '#00375c',
    })
    const { nuvens, quadro } = palco()
    nuvens.atualizar({ cena: 'c1', mapa: { ...MAPA, floor: [mar(400)] } })
    // Vários instantes: a fase sorteada de novo acertaria um deles por sorte, nunca todos.
    for (const passo of [APARICAO_DAS_NUVENS_MS + 10, 31_500, 47_250]) {
      quadro(passo)
      const antes = sprites(nuvens.camada).corpos.map((c) => ({ x: c.x, y: c.y, alpha: c.alpha }))
      nuvens.atualizar({ cena: 'c1', mapa: { ...MAPA, floor: [mar(400 - CELULA)] } })
      const depois = sprites(nuvens.camada).corpos.map((c) => ({ x: c.x, y: c.y, alpha: c.alpha }))
      expect(nuvens.camada.alpha).toBe(1)
      for (const [i, a] of antes.entries()) {
        expect(Math.abs(depois[i].x - a.x)).toBeLessThanOrEqual(CELULA + 1e-6)
        expect(depois[i].y).toBeCloseTo(a.y, 6)
        expect(depois[i].alpha).toBeCloseTo(a.alpha, 9)
      }
      // Volta ao chão de antes para o próximo instante.
      nuvens.atualizar({ cena: 'c1', mapa: { ...MAPA, floor: [mar(400)] } })
    }
  })

  it('o mapa mudou de tamanho: as nuvens são medidas de novo sem reaparecer; cena nova reaparece', () => {
    const { nuvens, quadro } = palco()
    nuvens.atualizar({ cena: 'c1', mapa: MAPA })
    quadro(APARICAO_DAS_NUVENS_MS + 10)
    nuvens.atualizar({ cena: 'c1', mapa: { ...MAPA, width: 300 } })
    expect(nuvens.camada.alpha).toBe(1)
    nuvens.atualizar({ cena: 'c2', mapa: MAPA })
    expect(nuvens.camada.alpha).toBe(0)
  })

  it('movimento reduzido: paradas e inteiras; depois da aparição o relógio sai', () => {
    const { nuvens, ticker, estados, quadro } = palco({ reduzido: true })
    nuvens.atualizar({ cena: 'c1', mapa: MAPA })
    expect(estados.at(-1)).toEqual({ nuvens: 3, movendo: false })
    const { corpos } = sprites(nuvens.camada)
    const parada = corpos.map((c) => [c.x, c.y, c.alpha])
    quadro(APARICAO_DAS_NUVENS_MS + 10)
    expect(ticker.count).toBe(0)
    expect(nuvens.camada.alpha).toBe(1)
    quadro(5000)
    expect(corpos.map((c) => [c.x, c.y, c.alpha])).toEqual(parada)
  })

  it('a pessoa passa a pedir menos movimento com o mapa aberto: em até um segundo as nuvens param onde estão, sem pular', () => {
    const { nuvens, ticker, estados, quadro, reduzir } = palco()
    nuvens.atualizar({ cena: 'c1', mapa: MAPA })
    quadro(APARICAO_DAS_NUVENS_MS + 10)
    const antes = sprites(nuvens.camada).corpos[0].x
    reduzir(true)
    quadro(1000)
    expect(ticker.count).toBe(0)
    expect(estados.at(-1)).toEqual({ nuvens: 3, movendo: false })
    const x = sprites(nuvens.camada).corpos[0].x
    // Parou no lugar do último quadro: andou só o segundo que passou, nada de ir para a fase.
    const ceu = ceuDoMapa(MAPA)
    if (ceu === null) throw new Error('sem céu')
    expect(x - antes).toBeCloseTo(NUVENS[0].velocidade * ceu.unidade, 3)
    quadro(1000)
    expect(sprites(nuvens.camada).corpos[0].x).toBe(x)
    // O zoom com elas paradas só muda a opacidade, não a posição.
    nuvens.setTela(1, 390)
    expect(sprites(nuvens.camada).corpos[0].x).toBe(x)
    // Voltou a aceitar movimento: o próximo redesenho do mapa solta as nuvens de novo.
    reduzir(false)
    nuvens.atualizar({ cena: 'c1', mapa: MAPA })
    expect(ticker.count).toBe(1)
    expect(estados.at(-1)).toEqual({ nuvens: 3, movendo: true })
  })

  it('desligadas (chave, "Efeitos do mapa", modo leve): somem e o relógio sai; religar é o mapa abrindo', () => {
    const { nuvens, ticker, estados, quadro } = palco()
    nuvens.atualizar({ cena: 'c1', mapa: MAPA })
    quadro(APARICAO_DAS_NUVENS_MS + 10)
    nuvens.atualizar(null)
    expect(nuvens.camada.visible).toBe(false)
    expect(ticker.count).toBe(0)
    expect(estados.at(-1)).toEqual({ nuvens: 0, movendo: false })
    nuvens.atualizar({ cena: 'c1', mapa: MAPA })
    expect(nuvens.camada.visible).toBe(true)
    expect(nuvens.camada.alpha).toBe(0)
    expect(ticker.count).toBe(1)
  })

  it('sem canvas 2d (ou mapa baixo demais para a nuvem e a sombra): nada no palco e nada por quadro', () => {
    const semCanvas = palco({ semCanvas: true })
    semCanvas.nuvens.atualizar({ cena: 'c1', mapa: MAPA })
    expect(semCanvas.nuvens.camada.visible).toBe(false)
    expect(semCanvas.ticker.count).toBe(0)
    expect(semCanvas.estados.at(-1)).toEqual({ nuvens: 0, movendo: false })

    const pequeno = palco()
    pequeno.nuvens.atualizar({ cena: 'c1', mapa: { ...MAPA, width: 40, height: 1, grid: 50 } })
    expect(pequeno.nuvens.camada.visible).toBe(false)
    expect(pequeno.ticker.count).toBe(0)
  })

  it('de perto o corpo esmaece e a sombra fica inteira; parada (movimento reduzido), a opacidade muda na hora', () => {
    const { nuvens, quadro } = palco({ reduzido: true })
    nuvens.setTela(0.1, 1600)
    nuvens.atualizar({ cena: 'c1', mapa: MAPA })
    quadro(APARICAO_DAS_NUVENS_MS + 10)
    const { sombras, corpos } = sprites(nuvens.camada)
    const longe = { corpo: corpos[0].alpha, sombra: sombras[0].alpha }
    expect(longe.corpo).toBeCloseTo(0.6, 6)
    // Zoom 1 numa tela de 390 px: a nuvem tem milhares de px, muito mais que a tela.
    nuvens.setTela(1, 390)
    expect(corpos[0].alpha).toBeCloseTo(longe.corpo * NUVEM_DE_PERTO.minimo, 6)
    expect(sombras[0].alpha).toBe(longe.sombra)
    nuvens.setTela(0.1, 1600)
    expect(corpos[0].alpha).toBeCloseTo(longe.corpo, 6)
  })

  it('desmonte: sai do relógio e solta as texturas', () => {
    const { nuvens, ticker, feitas } = palco()
    nuvens.atualizar({ cena: 'c1', mapa: MAPA })
    nuvens.destruir()
    expect(ticker.count).toBe(0)
    expect(feitas.every((f) => f.textura.destroyed)).toBe(true)
  })
})
