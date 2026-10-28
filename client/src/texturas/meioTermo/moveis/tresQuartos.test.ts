import { describe, expect, it } from 'vitest'
import type { Prop, TipoMobilia } from '../../../types/map'
import { criarMovel } from '../../../lib/mobilia'
import { TIPOS_MOBILIA } from '../../../lib/mobilia/tipos'
import { ALTURA_DA_LENHA_EM_TRES_QUARTOS, DESLOCAMENTO_DA_CHAMA_EM_TRES_QUARTOS } from '../../../lib/mobilia/vistaTresQuartos'
import { chaveDoMovel, giroDaImagem, textoDaChave } from '../../../pixi/rasterDosMoveis'
import { MATERIAIS } from '../materiais'
import { G } from './contexto'
import { escalaDoNivel, GRADE_DE_REFERENCIA, pintarMovel, type DesenhoDoMovel } from './index'
import { PISO_DE_LUZ, type LimitesDaImagem } from './motor'
import { ALFA_DE_PECA, ALFA_OPACO, digitalDosPixels, medirImagem } from './medidas.testkit'
import { PERFIS, perfilDoTresQuartos } from './tresQuartos'

/**
 * VISTA 3/4 (MT11): todo tipo do catálogo tem a 3/4, com a semente do APP
 * (`chaveDoMovel`), nas regras de cor das peças de antes; a mesa mostra as
 * pernas da frente; o giro de quarto de volta deixa a frente embaixo na tela;
 * sem a vista, a chave é a de antes.
 */

const CASA = GRADE_DE_REFERENCIA

function movel(tipo: TipoMobilia, extra: Partial<Prop> = {}): Prop {
  return { ...criarMovel(tipo, { x: 0, y: 0 }, CASA, `t-${tipo}`), ...extra }
}

function desenho(prop: Prop, vista?: 'tres-quartos'): DesenhoDoMovel {
  const chave = chaveDoMovel(prop, 1, 1, vista)
  if (chave === null) throw new Error(`${prop.mobilia}: sem desenho com textura`)
  return chave.desenho
}

interface Pintura {
  readonly limites: LimitesDaImagem
  readonly pixels: Uint8ClampedArray
  readonly S: number
}

function pintar(d: DesenhoDoMovel, nivel: number): Pintura {
  const S = escalaDoNivel(nivel)
  return { ...pintarMovel(d, S), S }
}

/** O y (px do protótipo, em volta do centro) da linha mais alta com pixel de peça. */
function topoDasPecas(p: Pintura): number {
  const { W, H, y0 } = p.limites
  for (let j = 0; j < H; j += 1) for (let i = 0; i < W; i += 1) if (p.pixels[(j * W + i) * 4 + 3] >= ALFA_DE_PECA) return y0 + j / p.S
  return Infinity
}

/** Soma do alfa da sombra no chão (pixels que não são de peça). */
function alfaDaSombra(p: Pintura): number {
  let soma = 0
  for (let k = 3; k < p.pixels.length; k += 4) if (p.pixels[k] < ALFA_DE_PECA) soma += p.pixels[k]
  return soma
}

function alfaNoPonto(p: Pintura, x: number, y: number): number {
  const i = Math.floor((x - p.limites.x0) * p.S)
  const j = Math.floor((y - p.limites.y0) * p.S)
  if (i < 0 || j < 0 || i >= p.limites.W || j >= p.limites.H) return 0
  return p.pixels[(j * p.limites.W + i) * 4 + 3]
}

describe('vista 3/4: o catálogo inteiro', () => {
  it('todo tipo do catálogo tem perfil e chave 3/4 (falha se um tipo novo entrar sem ela)', () => {
    for (const tipo of TIPOS_MOBILIA) {
      expect(PERFIS[tipo], tipo).toBeDefined()
      const d = desenho(movel(tipo), 'tres-quartos')
      expect(d.vista, tipo).toBe('tres-quartos')
      // A mesma semente da vista de cima: o veio não muda ao trocar a vista.
      expect(d.semente, tipo).toBe(desenho(movel(tipo)).semente)
    }
  })

  // O FOGO fica fora desta regra: a imagem dele é só o chão queimado, rente ao chão (sem altura nem
  // sombra), e as chamas, que são a parte em pé, já sobem na tela pela camada animada (`pixi/fogosDoMapa.ts`).
  // Na 3/4 a imagem dele não muda (teste logo abaixo).
  for (const tipo of TIPOS_MOBILIA.filter((t) => t !== 'fogo')) {
    it(`${tipo}: a 3/4 muda o desenho, sobe o tampo (ou ganha a sombra de baixo) e segue as regras de cor`, () => {
      const prop = movel(tipo)
      const deCima = desenho(prop)
      const tres = desenho(prop, 'tres-quartos')
      const emPe = perfilDoTresQuartos(tipo, deCima.lado).modo === 'em-pe'
      for (const nivel of [1, 3]) {
        const a = pintar(deCima, nivel)
        const b = pintar(tres, nivel)
        expect(digitalDosPixels(b.pixels), `${tipo} nível ${nivel}`).not.toBe(digitalDosPixels(a.pixels))
        // Mesma entrada, mesma imagem.
        expect(digitalDosPixels(pintar(tres, nivel).pixels)).toBe(digitalDosPixels(b.pixels))
        const m = medirImagem(b.pixels, b.limites.W, b.limites.H, deCima.casasW * deCima.casasH * G * G * b.S * b.S)
        expect(m.saturacaoP95, `${tipo} nível ${nivel} saturação`).toBeLessThanOrEqual(0.62)
        expect(m.luminanciaLinearMinima, `${tipo} nível ${nivel} piso de luz`).toBeGreaterThanOrEqual(PISO_DE_LUZ - 0.002)
        expect(m.contornoMinimo, `${tipo} nível ${nivel} contorno`).toBeGreaterThanOrEqual(0.06)
        if (nivel !== 3) continue
        if (emPe) expect(alfaDaSombra(b), `${tipo}: sombra de baixo`).toBeGreaterThan(alfaDaSombra(a) * 1.02)
        else expect(topoDasPecas(b), `${tipo}: o tampo sobe`).toBeLessThanOrEqual(topoDasPecas(a) - 1)
      }
    })
  }

  it('fogo: o chão queimado é plano, então a 3/4 sai igual à vista de cima', () => {
    const prop = movel('fogo')
    for (const nivel of [1, 3]) {
      expect(digitalDosPixels(pintar(desenho(prop, 'tres-quartos'), nivel).pixels), `nível ${nivel}`).toBe(digitalDosPixels(pintar(desenho(prop), nivel).pixels))
    }
  })

  it('a fogueira sobe a lenha o mesmo que a chama sobe na tela', () => {
    expect(PERFIS.fogueira.alturaSolta).toBe(ALTURA_DA_LENHA_EM_TRES_QUARTOS)
    expect(DESLOCAMENTO_DA_CHAMA_EM_TRES_QUARTOS).toBeCloseTo(-(ALTURA_DA_LENHA_EM_TRES_QUARTOS * GRADE_DE_REFERENCIA) / G, 10)
  })
})

describe('vista 3/4: as mesas', () => {
  const MADEIRAS = ['carvalho', 'nogueira', 'velha'] as const
  const FORMAS: readonly { tipo: TipoMobilia; w: number; h: number }[] = [
    { tipo: 'mesa', w: 2, h: 1 },
    { tipo: 'mesaQuadrada', w: 1, h: 1 },
    { tipo: 'mesaRedonda', w: 1.25, h: 1.25 },
  ]
  for (const forma of FORMAS) {
    for (const madeira of MADEIRAS) {
      it(`${forma.tipo} em ${madeira}: as pernas da frente à mostra, o chão entre elas, cor no limite`, () => {
        const prop = movel(forma.tipo, { width: forma.w * CASA, height: forma.h * CASA, mobiliaCor: MATERIAIS[madeira].hex })
        for (const nivel of [1, 3]) {
          const p = pintar(desenho(prop, 'tres-quartos'), nivel)
          const m = medirImagem(p.pixels, p.limites.W, p.limites.H, forma.w * forma.h * G * G * p.S * p.S)
          expect(m.saturacaoP95).toBeLessThanOrEqual(0.62)
          expect(m.luminanciaLinearMinima).toBeGreaterThanOrEqual(PISO_DE_LUZ - 0.002)
          if (nivel !== 3) continue
          const hw = (forma.w * G) / 2
          const hh = (forma.h * G) / 2
          // Logo acima do chão, na frente: a perna da quina é peça; o meio, entre as pernas, é chão.
          // A redonda tem as pernas nas diagonais da elipse; as outras, nas quinas da pegada.
          const redonda = forma.tipo === 'mesaRedonda'
          const y = redonda ? hh * 0.7 : hh - 0.08 * G
          const xPerna = redonda ? -hw * 0.72 : -hw + 0.05 * G
          expect(alfaNoPonto(p, xPerna, y), 'perna da frente').toBeGreaterThanOrEqual(ALFA_OPACO)
          expect(alfaNoPonto(p, 0, y), 'entre as pernas').toBeLessThan(ALFA_DE_PECA)
        }
      })
    }
  }
})

describe('vista 3/4: o giro e a chave', () => {
  it('sem a vista a chave é a de antes; a 3/4 é outra imagem', () => {
    const prop = movel('barril')
    const antes = chaveDoMovel(prop, 2, 1)
    expect(chaveDoMovel(prop, 2, 1, undefined)).toEqual(antes)
    expect(antes?.desenho.vista).toBeUndefined()
    expect(antes === null ? '' : textoDaChave(antes)).toContain('|de-cima|')
    const tres = chaveDoMovel(prop, 2, 1, 'tres-quartos')
    expect(tres === null ? '' : textoDaChave(tres)).toContain('|tres-quartos|')
  })

  it('a cama girada um quarto de volta: o giro é pintado, a frente fica embaixo na tela', () => {
    const cama = movel('catre', { rotation: 90 })
    expect(giroDaImagem(cama)).toBe(0)
    expect(giroDaImagem(cama, 'tres-quartos')).toBe(90)
    const d = desenho(cama, 'tres-quartos')
    expect(d.giro).toBe(90)
    const p = pintar(d, 3)
    const largura = p.limites.W / p.S
    // A pegada girada fica deitada na tela (a cama de 1 x 2 vira 2 x 1) e o tampo sobe acima dela.
    expect(largura).toBeGreaterThanOrEqual(d.casasH * G * 0.95)
    expect(topoDasPecas(p)).toBeLessThan(-(d.casasW * G) / 2 - 4)
    // Placa de seta e móvel em pé: o giro de sempre.
    expect(giroDaImagem(movel('lapide', { rotation: 90 }), 'tres-quartos')).toBe(0)
    expect(giroDaImagem(movel('placaDeSeta', { rotation: 90 }), 'tres-quartos')).toBe(90)
  })
})
