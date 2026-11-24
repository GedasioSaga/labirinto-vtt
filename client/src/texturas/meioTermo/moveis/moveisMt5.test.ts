import { describe, expect, it } from 'vitest'
import { chaveDoMovel, giroDaImagem, textoDaChave } from '../../../pixi/rasterDosMoveis'
import { filterMapForPlayer } from '../../../lib/fogFilter'
import { deserializeMap } from '../../../lib/mapFile'
import { oklabDoHex } from '../materiais'
import { G } from './contexto'
import { escalaDoNivel, montarCena, pintarMovel, type DesenhoDoMovel } from './index'
import { ALFA_OPACO, digitalDosPixels, distanciaOklab, oklabMedio } from './medidas.testkit'
import { CASA, desenhoDoApp, medir, peca, reprovacoes, TIPOS_MT5 } from './medidasMt5.testkit'
import { FRANJA_EM_CASAS, geometriaDaHaste, MOLDURA_EM_CASAS } from './tapeteComHaste'

/**
 * As 5 PEÇAS NOVAS do lote 2 (MT5) com a SEMENTE DO APP (`chaveDoMovel`), nos
 * níveis 1, 2 e 3, pelos limites que não se afrouxam (cobertura, saturação
 * p95 por peça, brilho, contorno, luz linear, opacidade e miolo translúcido);
 * mais o que cada peça precisa provar: a peça pequena não some no chão padrão,
 * a sebe segue o ARCO (no editor e no jogador, pela mesma chave), e o tapete
 * longo só estica a haste (o centro sai igual em 7 e 14 casas). A varredura das 1000
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

  it('a chave: sem giro igual à de antes (sem sufixo), 90/180/270 com o quarto de volta; o móvel em pé não lê o giro', () => {
    expect(texto(0)).toBe(texto(undefined))
    expect(texto(0)).not.toContain('|q')
    expect(texto(360)).toBe(texto(0))
    expect(texto(-90)).toBe(texto(270))
    expect(texto(80)).toBe(texto(90))
    expect(new Set([texto(0), texto(90), texto(180), texto(270)]).size).toBe(4)
    expect([0, 90, 180, 270, 450, -90].map((r) => giroDaImagem({ mobilia: 'placaDeSeta', rotation: r }))).toEqual([0, 90, 180, 270, 90, 270])
    // Caça 12/11/2026 (V2): o móvel derivado da 3/4 (a sebe) também pinta o quarto de volta de cima, para a sombra
    // não girar junto: a chave leva o giro (outra imagem), mas a semente não (girar não troca o veio).
    const sebe = peca('sebe', 2, 0.5, 'buxo', null)
    expect(texto(90, sebe)).not.toBe(texto(undefined, sebe))
    expect(texto(90, sebe)).toContain('|q90|')
    expect(texto(undefined, sebe)).not.toContain('|q')
    expect(giroDaImagem({ mobilia: 'sebe', rotation: 90 })).toBe(90)
    expect(chaveDoMovel({ ...sebe, rotation: 90 }, 1, 1)?.desenho.semente).toBe(chaveDoMovel(sebe, 1, 1)?.desenho.semente)
    // O móvel em pé (a lápide) gira a imagem inteira, como antes: nem a chave nem o giro pintado leem o giro.
    const lapide = peca('lapide', 0.5, 0.5, 'pinho', null)
    expect(texto(90, lapide)).toBe(texto(undefined, lapide))
    expect(giroDaImagem({ mobilia: 'lapide', rotation: 90 })).toBe(0)
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

/**
 * A SEBE É VERDE ATÉ A BORDA (revisão de design da MT5): com chanfro e contorno
 * em cada copinha, 20 a 26% dos pixels dela saíam marrons (o escuro levantado
 * para o da nogueira). Conta o pixel opaco ESCURO (luminância < 90) puxado para
 * o vermelho (r > g): as flores claras ficam de fora pela luz.
 */
describe('MT5: a sebe não tem borda marrom', () => {
  for (const { nome, prop } of TIPOS_MT5.sebe) {
    it(`${nome}: menos de 1% dos pixels opacos escuros puxam para o marrom, a 1x e a 3x`, () => {
      for (const nivel of [1, 3]) {
        const { pixels } = pintarMovel(desenhoDoApp(prop, nivel), escalaDoNivel(nivel))
        let opacos = 0
        let marrons = 0
        for (let o = 0; o < pixels.length; o += 4) {
          if (pixels[o + 3] < ALFA_OPACO) continue
          opacos += 1
          const luz = 0.2126 * pixels[o] + 0.7152 * pixels[o + 1] + 0.0722 * pixels[o + 2]
          if (luz < 90 && pixels[o] > pixels[o + 1]) marrons += 1
        }
        expect(marrons / opacos, `nível ${nivel}`).toBeLessThan(0.01)
      }
    })
  }
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
 * O TAPETE GRANDE "Medalhão com haste" (`tapeteComHaste.ts`, 24/11/2026), o
 * mesmo no tapete longo e no retangular: a moldura, a franja, o medalhão e as
 * pontas nascem da largura e só a haste estica, então o centro de uma
 * passadeira é o mesmo em qualquer comprimento; no tapete curto a haste e as
 * pontas somem.
 */
describe('MT5: o tapete grande "Medalhão com haste"', () => {
  it('a haste só aparece com espaço (some no 3 x 3, liga as pontas no 4 x 6 e no 2 x 14); moldura, franja e medalhão não esticam', () => {
    expect(geometriaDaHaste(3, 3).temHaste).toBe(false)
    expect(geometriaDaHaste(6, 4).temHaste).toBe(true)
    const curto = geometriaDaHaste(7, 2)
    const longo = geometriaDaHaste(14, 2)
    expect(longo.temHaste).toBe(true)
    for (const medida of ['B', 'Pv', 'Rc', 'Rcap', 'Lc'] as const) expect(longo[medida], medida).toBeCloseTo(curto[medida], 9)
    expect(longo.B).toBeCloseTo(MOLDURA_EM_CASAS, 9)
    expect(longo.L / 2 - longo.hu).toBeCloseTo(FRANJA_EM_CASAS, 9)
  })

  /**
   * Só o campo, por dentro da moldura (a moldura começa a 1 - 0,36 = 0,64 casa
   * do eixo): o motivo da borda lateral é refeito para caber inteiro entre os
   * cantos (12 voltas no corredor de 7, 26 no de 14), então o passo dele muda
   * por milésimos e a fase escorrega uma fração de pixel longe do meio. Isso é
   * do desenho, não um medalhão esticado; a geometria da moldura já é
   * conferida no teste acima.
   */
  it('nos pixels: o centro do corredor de 7 e de 14 casas sai igual (o medalhão não estica nem se repete)', () => {
    const S = escalaDoNivel(2)
    const centro = (casas: number): number[] => {
      const { limites, pixels } = pintarMovel({ tipo: 'tapeteLongo', lado: 'frente', materiais: ['vinho'], casasW: 2, casasH: casas, semente: 7 }, S)
      const tons: number[] = []
      for (let y = -0.7 * G; y < 0.7 * G; y += 1 / S) {
        for (let x = -0.6 * G; x < 0.6 * G; x += 1 / S) {
          const o = (Math.floor((y - limites.y0) * S) * limites.W + Math.floor((x - limites.x0) * S)) * 4
          tons.push(pixels[o], pixels[o + 1], pixels[o + 2])
        }
      }
      return tons
    }
    const a = centro(7)
    const b = centro(14)
    let maior = 0
    let soma = 0
    for (let i = 0; i < a.length; i += 1) {
      const d = Math.abs(a[i] - b[i])
      maior = Math.max(maior, d)
      soma += d
    }
    // O meio tom sorteado por pixel (`compor`) segue a linha da imagem, e as duas imagens
    // têm alturas diferentes. No Vinho mais profundo (5a02cc3d) parte do fio e do acento
    // fica rente ao piso de luz, onde o levantamento do preto amplia esse meio tom para
    // até 5 tons. Na média a diferença segue abaixo de 1 tom.
    expect(maior).toBeLessThanOrEqual(6)
    expect(soma / a.length).toBeLessThan(1)
  })

  it('LIMITE da grade: numa grade de 70 o tapete longo 1 x 4 (70 x 280 px) é desenhado como 1,4 x 5,6 casas de 50 px', () => {
    const chave = chaveDoMovel({ ...peca('tapeteLongo', 1, 4, 'vinho', null), width: 70, height: 280 }, 1, 1)
    expect(chave?.desenho.casasW).toBeCloseTo(1.4, 9)
    expect(chave?.desenho.casasH).toBeCloseTo(5.6, 9)
    // Na grade de 50 o mesmo tapete é 1 x 4: o desenho é medido em casas da grade de REFERÊNCIA.
    const deReferencia = chaveDoMovel(peca('tapeteLongo', 1, 4, 'vinho', null), 1, 1)
    expect([deReferencia?.desenho.casasW, deReferencia?.desenho.casasH]).toEqual([1, 4])
    expect(CASA).toBe(50)
  })
})
