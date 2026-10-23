import { describe, expect, it } from 'vitest'
import { chaveDoMovel, giroDaImagem, textoDaChave } from '../../../pixi/rasterDosMoveis'
import { filterMapForPlayer } from '../../../lib/fogFilter'
import { deserializeMap } from '../../../lib/mapFile'
import { oklabDoHex } from '../materiais'
import { G } from './contexto'
import { escalaDoNivel, montarCena, pintarMovel, type DesenhoDoMovel } from './index'
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

/**
 * O ARCO ESTICADO (revisão de correção da MT5): a escala `comprido / 84`
 * engrossava tudo junto e, a 3 x 0,5, a placa passava ~0,12 casa para fora da
 * pegada (onde o clique e a seleção não chegam). Agora o atravessado nunca
 * passa do lado curto: deitado e em pé, de 2 a 4 casas, toda peça do desenho
 * fica dentro da pegada (com meio px de folga para o contorno), e os
 * esticados passam nos mesmos limites, com a semente do app.
 */
describe('MT5: o arco esticado fica dentro da pegada', () => {
  const ESTICADOS = [
    { nome: 'arco 3 x 0,5 velha+velha', prop: peca('arcoDoPortao', 3, 0.5, 'velha', 'velha') },
    { nome: 'arco 4 x 0,5 nogueira+pinho', prop: peca('arcoDoPortao', 4, 0.5, 'nogueira', 'pinho') },
  ]

  it('2, 3 e 4 casas, deitado e em pé: toda peça (trave, postes, correntes, placa, flor) dentro da pegada', () => {
    const FOLGA = 0.5
    for (const casas of [2, 3, 4]) {
      for (const [w, h] of [[casas, 0.5], [0.5, casas]] as const) {
        const d = desenhoDoApp(peca('arcoDoPortao', w, h, 'velha', 'velha'), 1)
        const cena = montarCena(d)
        const hw = (w * G) / 2
        const hh = (h * G) / 2
        expect(cena.partes.length, `${w} x ${h}`).toBeGreaterThan(0)
        for (const [i, parte] of cena.partes.entries()) {
          const [x0, y0, x1, y1] = parte.forma.b
          expect([x0 >= -hw - FOLGA, y0 >= -hh - FOLGA, x1 <= hw + FOLGA, y1 <= hh + FOLGA], `${w} x ${h}, peça ${i}: ${parte.forma.b.map((v) => v.toFixed(1)).join(', ')}`).toEqual([true, true, true, true])
        }
      }
    }
  })

  for (const { nome, prop } of ESTICADOS) {
    it(`${nome}: passa nos limites nos níveis 1 a 3 e fica a 0,07 do chão padrão`, () => {
      for (const nivel of [1, 2, 3]) {
        const d = desenhoDoApp(prop, nivel)
        expect(reprovacoes(medir(d, nivel)), `nível ${nivel}, semente ${d.semente}`).toEqual([])
      }
      for (const nivel of [1, 3]) {
        const { limites, pixels } = pintarMovel(desenhoDoApp(prop, nivel), escalaDoNivel(nivel))
        expect(distanciaOklab(oklabMedio(pixels, limites.W, limites.H), oklabDoHex(CHAO_PADRAO)), `nível ${nivel}`).toBeGreaterThanOrEqual(0.07)
      }
    })
  }
})

/**
 * A PLACA DE SETA pinta o giro (revisão de design da MT5): a tela girava a
 * imagem pronta inteira e a sombra ia junto (a 90° ela caía para baixo à
 * esquerda, a 180° a luz vinha de baixo). Agora o quarto de volta entra na
 * chave, a seta sai pintada já girada e a tela só gira o resto.
 */
describe('MT5: a placa de seta pinta o giro, com a sombra e a luz fixas', () => {
  const placa = peca('placaDeSeta', 0.5, 0.5, 'pinho', null)
  const texto = (rotation: number | undefined, prop = placa): string => {
    const chave = chaveDoMovel({ ...prop, rotation }, 1, 1)
    if (chave === null) throw new Error('sem chave')
    return textoDaChave(chave)
  }

  it('a chave: sem giro igual à de antes (sem sufixo), 90/180/270 com o quarto de volta; os outros móveis não leem o giro', () => {
    expect(texto(0)).toBe(texto(undefined))
    expect(texto(0)).not.toContain('|q')
    expect(texto(360)).toBe(texto(0))
    expect(texto(-90)).toBe(texto(270))
    expect(texto(80)).toBe(texto(90))
    expect(new Set([texto(0), texto(90), texto(180), texto(270)]).size).toBe(4)
    expect([0, 90, 180, 270, 450, -90].map((r) => giroDaImagem({ mobilia: 'placaDeSeta', rotation: r }))).toEqual([0, 90, 180, 270, 90, 270])
    const sebe = peca('sebe', 2, 0.5, 'buxo', null)
    expect(texto(90, sebe)).toBe(texto(undefined, sebe))
    expect(giroDaImagem({ mobilia: 'sebe', rotation: 90 })).toBe(0)
  })

  it('nos 4 giros, com a semente do app: a sombra cai para baixo à direita da tábua e a cabeça larga fica do lado do giro', () => {
    const nivel = 3
    const S = escalaDoNivel(nivel)
    const hw = (0.5 * G) / 2
    for (const rotation of [0, 90, 180, 270]) {
      const { limites, pixels } = pintarMovel(desenhoDoApp({ ...placa, rotation }, nivel), S)
      const rad = (rotation * Math.PI) / 180
      const [dx, dy] = [Math.round(Math.cos(rad)), Math.round(Math.sin(rad))]
      let tabua = [0, 0, 0]
      let sombra = [0, 0, 0]
      let cabeca = 0
      let cauda = 0
      for (let j = 0; j < limites.H; j += 1) {
        for (let i = 0; i < limites.W; i += 1) {
          const a = pixels[(j * limites.W + i) * 4 + 3]
          const x = limites.x0 + (i + 0.5) / S
          const y = limites.y0 + (j + 0.5) / S
          if (a >= ALFA_OPACO) {
            tabua = [tabua[0] + x, tabua[1] + y, tabua[2] + 1]
            const ao = x * dx + y * dy
            const atravessado = Math.abs(-x * dy + y * dx)
            if (ao > 0.3 * hw) cabeca = Math.max(cabeca, atravessado)
            if (ao < -0.3 * hw) cauda = Math.max(cauda, atravessado)
          } else if (a >= 8 && a < 128) {
            sombra = [sombra[0] + x, sombra[1] + y, sombra[2] + 1]
          }
        }
      }
      const desvio = [sombra[0] / sombra[2] - tabua[0] / tabua[2], sombra[1] / sombra[2] - tabua[1] / tabua[2]]
      expect(desvio[0], `${rotation}°: sombra à direita`).toBeGreaterThan(1)
      expect(desvio[1], `${rotation}°: sombra para baixo`).toBeGreaterThan(1)
      expect(cabeca, `${rotation}°: a cabeça (lado do giro) mais larga que a cauda`).toBeGreaterThan(cauda * 1.6)
    }
  })
})

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
