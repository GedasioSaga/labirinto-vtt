import { describe, expect, it } from 'vitest'
import { chaveDoMovel } from '../../../pixi/rasterDosMoveis'
import { filterMapForPlayer } from '../../../lib/fogFilter'
import { deserializeMap } from '../../../lib/mapFile'
import { oklabDoHex } from '../materiais'
import { G } from './contexto'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel } from './index'
import { ALFA_OPACO, digitalDosPixels, distanciaOklab, oklabMedio } from './medidas.testkit'
import { CASA, desenhoDoApp, medir, peca, reprovacoes, TIPOS_MT5 } from './medidasMt5.testkit'

/**
 * As 5 PEÇAS NOVAS do lote 2 (MT5) com a SEMENTE DO APP (`chaveDoMovel`), nos
 * níveis 1, 2 e 3, pelos limites que não se afrouxam (cobertura, saturação
 * p95 por peça, brilho, contorno, luz linear, opacidade e miolo translúcido);
 * mais o que cada peça precisa provar: a peça pequena não some no chão padrão,
 * a sebe segue o ARCO (no editor e no jogador, pela mesma chave), e a borda do
 * tapete longo é igual POR CASA em 3 comprimentos. A varredura das 1000
 * sementes está em `pixi/rasterDosMoveis.sementesMt5.test.ts`.
 */

describe('MT5 com a semente do app: cada candidato passa em todos os limites', () => {
  for (const candidatos of Object.values(TIPOS_MT5)) {
    for (const { nome, prop } of candidatos) {
      for (const nivel of [1, 2, 3]) {
        it(`${nome} no nível ${nivel}`, () => {
          const d = desenhoDoApp(prop, nivel)
          expect(reprovacoes(medir(d, nivel)), `semente ${d.semente}`).toEqual([])
        })
      }
    }
  }

  it('mesma entrada, mesma imagem (o hash dos pixels não muda entre duas pinturas)', () => {
    for (const candidatos of Object.values(TIPOS_MT5)) {
      const d = desenhoDoApp(candidatos[0].prop, 1)
      const S = escalaDoNivel(1)
      expect(digitalDosPixels(pintarMovel(d, S).pixels), d.tipo).toBe(digitalDosPixels(pintarMovel(d, S).pixels))
    }
  })
})

/** O chão padrão do app (`DEFAULT_FLOOR_STYLE`): a peça pequena a 1x não pode virar mancha dele. */
const CHAO_PADRAO = '#a8776a'

describe('MT5: a peça pequena tem cor própria contra o chão padrão, a 1x e a 3x', () => {
  for (const tipo of ['placaDeSeta', 'jardineira', 'sebe', 'arcoDoPortao'] as const) {
    for (const { nome, prop } of TIPOS_MT5[tipo]) {
      it(`${nome}: a cor média fica a pelo menos 0,07 do chão em OKLab`, () => {
        for (const nivel of [1, 3]) {
          const { limites, pixels } = pintarMovel(desenhoDoApp(prop, nivel), escalaDoNivel(nivel))
          expect(distanciaOklab(oklabMedio(pixels, limites.W, limites.H), oklabDoHex(CHAO_PADRAO)), `nível ${nivel}`).toBeGreaterThanOrEqual(0.07)
        }
      })
    }
  }
})

function opacoEm(d: DesenhoDoMovel, nivel: number, x: number, y: number): boolean {
  const S = escalaDoNivel(nivel)
  const { limites, pixels } = pintarMovel(d, S)
  const i = Math.floor((x - limites.x0) * S)
  const j = Math.floor((y - limites.y0) * S)
  if (i < 0 || j < 0 || i >= limites.W || j >= limites.H) return false
  return pixels[(j * limites.W + i) * 4 + 3] >= ALFA_OPACO
}

describe('MT5: a sebe segue o arco, no editor e no jogador', () => {
  // Sebe de 4 casas deitada com 90°: a corda passa pelo centro da caixa e o arco fica a uma flecha dela, para baixo.
  const curva = peca('sebe', 4, 0.5, 'buxo', null, { id: 'sebe-1', x: 300, y: 300, mobiliaCurva: 90 })

  it('a imagem cobre o meio do ARCO e deixa vazio o meio da corda (a sebe reta faz o contrário)', () => {
    const d = desenhoDoApp(curva, 2)
    expect(d.curva).toBe(90)
    // Flecha da volta de 90° na corda de mourão a mourão (comprimento menos 2 raios de 0,45 x espessura).
    const corda = 4 * G - 2 * 0.45 * 0.5 * G
    const flecha = (corda / 2) * Math.tan(Math.PI / 8)
    expect(opacoEm(d, 2, 0, flecha)).toBe(true)
    expect(opacoEm(d, 2, 0, 0)).toBe(false)
    const reta = desenhoDoApp({ ...curva, mobiliaCurva: undefined }, 2)
    expect(opacoEm(reta, 2, 0, 0)).toBe(true)
    expect(opacoEm(reta, 2, 0, flecha)).toBe(false)
  })

  it('o objeto que o jogador recebe dá a MESMA chave de imagem (a mesma curva) que o do editor', () => {
    const arquivo = JSON.stringify({ id: 'm', name: 'Vila', width: 20, height: 20, grid: 50, props: [curva] })
    const mapa = deserializeMap(arquivo)
    const comFicha = { ...mapa, tokens: [{ id: 'ficha-ana', characterId: null, name: 'Ana', x: 300, y: 320, size: 1, image: null }] }
    const doJogador = filterMapForPlayer(comFicha, 'ana', { ana: ['ficha-ana'] }, 900).map.props[0]
    const noEditor = chaveDoMovel(mapa.props[0], 1, 1)
    const noJogador = chaveDoMovel(doJogador, 1, 1)
    expect(noEditor?.curva).toBe(90)
    expect(noJogador?.chaveDaCurva).toBe(noEditor?.chaveDaCurva)
    expect(noJogador?.desenho).toEqual(noEditor?.desenho)
  })
})

/**
 * Perfil de luz da borda comprida do tapete longo em pé, POR CASA: a média da
 * luminância na faixa da borda da esquerda, em `BINS` fatias de cada casa (a
 * casa contada da ponta de cima), menos a média da casa. As casas das pontas
 * ficam de fora (a borda dobra e a franja entra).
 */
const BINS = 20

function perfisPorCasa(casas: number, nivel: number): number[][] {
  const prop = peca('tapeteLongo', 1, casas, 'vinho', null)
  const d = desenhoDoApp(prop, nivel)
  const S = escalaDoNivel(nivel)
  const { limites, pixels } = pintarMovel(d, S)
  const hw = G / 2
  const topo = -(casas * G) / 2
  // A faixa da borda da esquerda: de 0,05 a 0,11 casa da beira (a borda tem 0,14 casa).
  const x0 = -hw + 0.05 * G
  const x1 = -hw + 0.11 * G
  const perfis: number[][] = []
  for (let k = 1; k < casas - 1; k += 1) {
    const soma = new Array<number>(BINS).fill(0)
    const n = new Array<number>(BINS).fill(0)
    for (let j = 0; j < limites.H; j += 1) {
      const y = limites.y0 + (j + 0.5) / S
      const f = (y - topo) / G - k
      if (f < 0 || f >= 1) continue
      const b = Math.floor(f * BINS)
      for (let i = 0; i < limites.W; i += 1) {
        const x = limites.x0 + (i + 0.5) / S
        if (x < x0 || x > x1) continue
        const o = (j * limites.W + i) * 4
        soma[b] += 0.2126 * pixels[o] + 0.7152 * pixels[o + 1] + 0.0722 * pixels[o + 2]
        n[b] += 1
      }
    }
    const perfil = soma.map((s, b) => s / n[b])
    const media = perfil.reduce((a, v) => a + v, 0) / BINS
    perfis.push(perfil.map((v) => v - media))
  }
  return perfis
}

describe('MT5: a borda do tapete longo é igual por casa, em 3 comprimentos', () => {
  it('3, 4 e 7 casas: o perfil de cada casa do meio é o mesmo (diferença ≤ 14 de 255) e tem desenho (amplitude ≥ 40)', () => {
    for (const nivel of [1, 3]) {
      const todos = [3, 4, 7].flatMap((casas) => perfisPorCasa(casas, nivel))
      expect(todos.length, `nível ${nivel}`).toBe(1 + 2 + 5)
      const ref = todos[0]
      const amplitude = Math.max(...ref) - Math.min(...ref)
      expect(amplitude, `nível ${nivel}: a borda tem motivo`).toBeGreaterThanOrEqual(40)
      for (const perfil of todos) {
        const diferenca = Math.max(...perfil.map((v, b) => Math.abs(v - ref[b])))
        expect(diferenca, `nível ${nivel}`).toBeLessThanOrEqual(14)
      }
    }
  })

  it('LIMITE da grade: numa grade de 70 o tapete longo 1 x 4 (70 x 280 px) é desenhado como 1,4 x 5,6 casas de 50 px', () => {
    const chave = chaveDoMovel({ ...peca('tapeteLongo', 1, 4, 'vinho', null), width: 70, height: 280 }, 1, 1)
    expect(chave?.desenho.casasW).toBeCloseTo(1.4, 9)
    expect(chave?.desenho.casasH).toBeCloseTo(5.6, 9)
    // Na grade de 50 o mesmo tapete é 1 x 4: a borda se repete por casa da grade de REFERÊNCIA.
    const deReferencia = chaveDoMovel(peca('tapeteLongo', 1, 4, 'vinho', null), 1, 1)
    expect([deReferencia?.desenho.casasW, deReferencia?.desenho.casasH]).toEqual([1, 4])
    expect(CASA).toBe(50)
  })
})
