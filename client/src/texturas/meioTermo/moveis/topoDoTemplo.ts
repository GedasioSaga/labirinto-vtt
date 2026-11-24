/**
 * TOPO DO TEMPLO (lote L08 de 24/11/2026, item 72: construção nova, o santuário do alto da pirâmide do mapa 6; desenho
 * próprio, só a ideia do objeto). A LAJE do alto, baixa e de moldura gravada, com a ENTRADA do templo: a escada de
 * PEDRA que começa na frente (o lado de baixo da pegada), no nível da laje, e DESCE para o norte entre dois parapeitos
 * baixos até sumir no VÃO debaixo do muro do fundo. Em cima do muro, a CRISTA do templo: o friso escalonado em três
 * andares, cada um mais estreito e mais claro, e no meio dele a PEDRA DO SOL (o mesmo medalhão do patamar da pirâmide,
 * `pedraDoSol`: o motivo que amarra as duas peças). Dois pilaretes na boca da escada e, nos cantos da frente, dois
 * BRASEIROS de pedra: a base quadrada, a bacia de borda grossa e a cinza clara dentro, com uns carvões (apagados).
 * Tem 2 x 2 casas: o tamanho certo para ir em cima do patamar da pirâmide em degraus (item 71).
 *
 * O VÃO lê fundo: cada pisante mais escuro que o de cima, com a luz só na borda dele; os três últimos afundam num
 * degradê até o marrom quase preto, e as beiras da boca do lado da luz (a do oeste e a do norte NA TELA) deitam uma
 * sombra interna de 6 a 8 px. O marrom quase preto pedido (28, 22, 18) fica abaixo do piso de luz do motor (nenhum
 * pixel de peça passa de escuro demais): ele é levantado até o `PISO_DO_VAO`, o mesmo marrom, o mais escuro que cabe.
 *
 * AS DUAS VISTAS SAEM DO MESMO DESENHO (perfil `{ modo: 'derivado', propria: true }`, a vista de `piramideEmDegraus.ts`):
 * cada bloco é o tampo e, na 3/4, a face de pé virada para quem olha, com os blocos de pedra do templo (a frente
 * varrida do motor saía com as camadas do arenito deitadas, lendo como tábua). O que está em cima da laje é pintado
 * do fundo para a frente NA TELA, em qualquer giro. Sem giro, na 3/4, o muro do fundo mostra a PORTA.
 * Lê `c.giro` e `c.vista`. Material: `pedra`. Escreve `cena.corDoPiso`. Não barra a passagem e não tapa a visão.
 */
import type { Rgb } from '../../ruido'
import { caixa, elipse, elipseGirada, menos, poligono, type Caixa } from './formas'
import type { Cena, MaterialDaPeca, OpcoesDaPeca, Peca, Textura } from './motor'
import type { MontarMovel } from './contexto'
import {
  acasoDoTemplo,
  caixaNaTela,
  cipo,
  DA_PEDRA,
  entregarNaTela,
  ESCURO_DA_PEDRA_DO_TEMPLO,
  frenteNaTela,
  LUZ_DA_FRENTE_DO_TEMPLO,
  pedraDoSol,
  pedraDoTemplo,
  pontoNaTela,
  retNaTela,
  samambaia,
  texDaParedeDoTemplo,
  texDasLajesDoTemplo,
  tingir,
  tufoDeMusgo,
  vistaDoTemplo,
} from './piramideEmDegraus'

/** A altura da laje, a do muro do fundo e a do parapeito acima dela, e a de cada andar da crista (casas). */
const ALTURA_DA_LAJE = 0.14
const ALTURA_DO_MURO = 0.3
const ALTURA_DO_PARAPEITO = 0.17
const ANDAR_DA_CRISTA = 0.115
/** O poço da escada: a meia largura (fração da meia largura), e de onde a onde vai (frações da meia altura). */
const MEIO_POCO = 0.34
const FUNDO_DO_POCO = -0.2
const BOCA_DO_POCO = 0.68
/** O muro do fundo vai até aqui para o norte (fração da meia altura). */
const NORTE_DO_MURO = -0.74
/** O parapeito (casas, nunca mais que esta fração da meia largura), o pisante (casas) e o quanto cada um desce (casas). */
const PARAPEITO = 0.13
const FRACAO_DO_PARAPEITO = 0.14
const PISADA = 0.145
const DESCE = 0.07
/** O escuro do vão: o marrom quase preto pedido e o mais escuro que o piso de luz do motor deixa (luminância linear 0,046). */
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [28, 22, 18] }
const PISO_DO_VAO: Rgb = [0x48, 0x3a, 0x2f]
/** A sombra interna da boca do vão, do lado da luz (px) e a força dela junto da beira. */
const SOMBRA_DA_BOCA = { largura: 7, forca: 0.5 } as const
/** A cinza clara do braseiro e o carvão. */
const CINZA_DO_BRASEIRO: MaterialDaPeca = { classe: 'liso', rgb: [0xa6, 0xa1, 0x96] }
const CARVAO: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x54, 0x4c] }
const FOLHA_SECA: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x80, 0x52] }

/**
 * O PISANTE do vão: pedra em blocos, mais escura a cada degrau (`fundo` de 0 na boca a 1 no último), com a luz só na
 * borda de cima dele (a que dá para o degrau de baixo) e a sombra interna das beiras da boca do lado da luz.
 */
function texDoPisanteDoVao(inteiro: Caixa, boca: Caixa, desce: number, fundo: number, desloca: number): Textura {
  const [x0, y0, x1, y1] = inteiro
  const aoLongoDeX = desce % 2 === 0
  const bloco = (aoLongoDeX ? x1 - x0 : y1 - y0) / 2.5
  // Os três últimos afundam até o escuro do vão.
  const noEscuro = fundo < 0.5 ? 0 : (fundo - 0.5) / 0.5
  return (_u, _v, x, y, p, s, escala) => {
    DA_PEDRA(0, 0, x, y, p, s, escala)
    const daBorda = desce === 0 ? y1 - y : desce === 2 ? y - y0 : desce === 1 ? x - x0 : x1 - x
    const tt = (aoLongoDeX ? x : y) / bloco + desloca
    const junta = Math.abs(tt - Math.round(tt)) * bloco
    if (junta < 0.5) s[3] -= 0.16 * (1 - junta / 0.5)
    s[3] -= 0.16 + 0.5 * fundo
    // A luz só na borda de cima do pisante.
    if (daBorda < 1.15) s[3] += (0.46 - 0.2 * fundo) * (1 - 0.6 * noEscuro)
    // A sombra interna da boca, do lado da luz: a beira do oeste e a do norte.
    const { largura, forca } = SOMBRA_DA_BOCA
    const dO = x - boca[0]
    const dN = y - boca[1]
    if (dO < largura) s[3] -= forca * (1 - dO / largura)
    if (dN < largura) s[3] -= forca * 0.8 * (1 - dN / largura)
    if (noEscuro > 0) tingir(s, VAO.rgb, noEscuro * 0.82)
  }
}

/** Um grupo do que está em cima da laje: as peças dele e a base NA TELA (o que fica mais para o sul é pintado depois). */
interface Grupo {
  readonly base: number
  readonly partes: Peca[]
}

export const montarTopoDoTemplo: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  if (!(hw > 0) || !(hh > 0)) return
  const v = vistaDoTemplo(c)
  const pedra = pedraDoTemplo(c.m.pedra)
  const tela: Cena = { partes: [], sombras: [], corDoPiso: pedra.pedra === 'arenito' ? PISO_DO_VAO : ESCURO_DA_PEDRA_DO_TEMPLO }
  const L = tela.partes
  const zL = g * ALTURA_DA_LAJE
  const zMuro = zL + g * ALTURA_DO_MURO
  const zParapeito = zL + g * ALTURA_DO_PARAPEITO
  const wv = hw * MEIO_POCO
  const pt = Math.min(g * PARAPEITO, hw * FRACAO_DO_PARAPEITO)
  const [yN, yS, yM] = [hh * FUNDO_DO_POCO, hh * BOCA_DO_POCO, hh * NORTE_DO_MURO]
  const k = Math.min(hw, hh) / g

  /** Um bloco de pedra: na 3/4 a face de pé virada para quem olha, e o tampo por cima dela. */
  const bloco = (partes: Peca[], x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, tom: number, semente: number, tampo: OpcoesDaPeca = {}): void => {
    const frente = frenteNaTela(v, x0, y0, x1, y1, z0, z1)
    if (frente !== null) partes.push(P(caixa(frente.b[0], frente.b[1] - 0.3, frente.b[2], frente.b[3]), pedra, { bisel: 0, contorno: 0.16, tom, luz: LUZ_DA_FRENTE_DO_TEMPLO, textura: texDaParedeDoTemplo(frente.b[3], 8.4, semente * 0.13), semente }))
    partes.push(P(retNaTela(v, x0, y0, x1, y1, z1, 0.8), pedra, { bisel: 1, contorno: 0.24, tom, textura: DA_PEDRA, semente: semente + 1, ...tampo }))
  }
  const baseDe = (x0: number, y0: number, x1: number, y1: number): number => caixaNaTela(v, x0, y0, x1, y1)[3]

  // ---------- a SOMBRA no chão: a faixa de contato do sul e do leste, forte na base ----------
  const chao = caixaNaTela(v, -hw, -hh, hw, hh)
  tela.sombras.push({ forma: poligono([[chao[0] + 2, chao[1] + 2], [chao[2], chao[1] + 2], [chao[2] + 3.4, chao[1] + 5], [chao[2] + 3.4, chao[3] + 3], [chao[0] + 5.4, chao[3] + 3], [chao[0] + 2, chao[3]]]), z: 0, suave: 3.2, forca: 0.4 })

  // ---------- a LAJE, com a moldura gravada ----------
  bloco(L, -hw, -hh, hw, hh, 0, zL, 0.98, 5600, { bisel: 1.2, contorno: 0.26, textura: texDasLajesDoTemplo(g * 0.5, v, zL) })
  const sulco = caixaNaTela(v, -hw + 4 * k, -hh + 4 * k, hw - 4 * k, hh - 4 * k, zL)
  L.push(P(menos(caixa(sulco[0], sulco[1], sulco[2], sulco[3], 1.2), caixa(sulco[0] + 1.3, sulco[1] + 1.3, sulco[2] - 1.3, sulco[3] - 1.3, 0.8)), pedra, { bisel: 0, contorno: 0, tom: 0.62, alfa: 0.7, semente: 5602 }))

  // ---------- o VÃO: o escuro do fundo e os pisantes que descem para o norte ----------
  // A boca NA TELA, no nível da laje: nada do vão passa dela.
  const boca = caixaNaTela(v, -wv, yN, wv, yS, zL)
  L.push(P(caixa(boca[0], boca[1], boca[2], boca[3]), VAO, { bisel: 0, contorno: 0, semente: 5610 }))
  const [nx, ny] = pontoNaTela(v, 0, -1)
  const desce = ny < -0.5 ? 2 : ny > 0.5 ? 0 : nx < 0 ? 1 : 3
  const n = Math.max(3, Math.round((yS - yN) / (g * PISADA)))
  const passo = (yS - yN) / n
  const pisantes: { readonly perto: number; readonly peca: Peca }[] = []
  for (let j = 0; j < n; j += 1) {
    // j = 0 é o da boca (no sul do objeto); cada um mais fundo.
    const z = zL - (j + 0.4) * g * DESCE
    const inteiro = caixaNaTela(v, -wv, yS - (j + 1) * passo, wv, yS - j * passo, z)
    const [x0, y0, x1, y1] = [Math.max(inteiro[0], boca[0]), Math.max(inteiro[1], boca[1]), Math.min(inteiro[2], boca[2]), Math.min(inteiro[3], boca[3])]
    if (x1 - x0 < 0.4 || y1 - y0 < 0.4) continue
    const fundo = n > 1 ? j / (n - 1) : 0
    pisantes.push({ perto: inteiro[3] + inteiro[1] + 2 * v.sobe * z, peca: P(caixa(x0, y0, x1, y1), pedra, { bisel: 0, contorno: 0, tom: 0.98, textura: texDoPisanteDoVao(inteiro, boca, desce, fundo, acasoDoTemplo(j, 41)), semente: 5620 + j }) })
  }
  // O mais perto de quem olha por último (tapa o de trás).
  pisantes.sort((a, b) => a.perto - b.perto).forEach(({ peca }) => L.push(peca))
  // Umas folhas secas caídas nos primeiros pisantes.
  for (let i = 0; i < 4; i += 1) {
    const [x, y] = pontoNaTela(v, (acasoDoTemplo(i, 42) - 0.5) * 1.5 * wv, yS - (0.06 + 0.3 * acasoDoTemplo(i, 43)) * (yS - yN), zL - 0.6 * g * DESCE)
    L.push(P(elipseGirada(x, y, 1.7 * k, 0.85 * k, acasoDoTemplo(i, 44) * Math.PI), FOLHA_SECA, { bisel: 0.5, contorno: 0.2, alfa: 0.8, tom: 0.84 + 0.3 * acasoDoTemplo(i, 45), semente: 5650 + i }))
  }

  // O musgo em tufos de dois tons, no pé do muro do fundo e num canto da laje (nas juntas, é a textura da laje).
  const tufos: readonly (readonly [number, number, number])[] = [[-0.62, -0.8, 4.4], [0.7, -0.78, 3.4], [-0.84, 0.36, 3], [0.86, -0.1, 2.8]]
  tufos.forEach(([fx, fy, r], i) => tufoDeMusgo(L, P, ...pontoNaTela(v, fx * hw, fy * hh, zL), r * k, 520 + i))

  // ---------- o que está EM CIMA da laje, cada coisa no seu grupo ----------
  const grupos: Grupo[] = []
  const grupo = (x0: number, y0: number, x1: number, y1: number): Peca[] => {
    const partes: Peca[] = []
    grupos.push({ base: baseDe(x0, y0, x1, y1), partes })
    return partes
  }
  const sombraDoMuro = { dist: 5 * k, forca: 0.42, suave: 1.5 }

  // Os dois PARAPEITOS baixos da escada, com o pilarete na boca.
  for (const lado of [-1, 1]) {
    const [x0, x1] = lado < 0 ? [-wv - pt, -wv] : [wv, wv + pt]
    const fim = yS - pt * 1.3
    bloco(grupo(x0, yN, x1, fim), x0, yN, x1, fim, zL, zParapeito, 0.9, 5700 + lado * 4, { projeta: { dist: 3.2 * k, forca: 0.4, suave: 1.3 } })
    const [p0, p1] = [x0 - 1 * k, x1 + 1 * k]
    const pilarete = grupo(p0, fim, p1, yS)
    bloco(pilarete, p0, fim, p1, yS, zL, zParapeito + g * 0.08, 1.02, 5710 + lado * 4, { bisel: 1.6, contorno: 0.28, projeta: sombraDoMuro })
  }

  // O MURO DO FUNDO, por cima do vão, com a porta na face da frente (só sem giro) e a CRISTA escalonada.
  const mx = wv + pt + 2 * k
  const fundoDoTemplo = grupo(-mx, yM, mx, yN)
  bloco(fundoDoTemplo, -mx, yM, mx, yN, zL, zMuro, 0.96, 5720, { bisel: 1.2, contorno: 0.26, projeta: { dist: 6 * k, forca: 0.46, suave: 1.6 } })
  if (v.sobe > 0 && v.q === 0) {
    const frente = frenteNaTela(v, -mx, yM, mx, yN, zL, zMuro)
    if (frente !== null) {
      // A porta: o vão escuro, com a verga em cima e a sombra interna do lado da luz.
      const alto = frente.b[1] + (frente.b[3] - frente.b[1]) * 0.24
      fundoDoTemplo.push(P(caixa(-wv + 1, alto, wv - 1, frente.b[3] + 0.4), VAO, { bisel: 0, contorno: 0, semente: 5724 }))
      fundoDoTemplo.push(P(caixa(-wv - 1.4 * k, alto - 2.6 * k, wv + 1.4 * k, alto, 0.5), pedra, { bisel: 0.8, contorno: 0.22, tom: 1.08, textura: DA_PEDRA, semente: 5725, projeta: { dist: 1.6 * k, forca: 0.3 } }))
    }
  }
  const zAndar = g * ANDAR_DA_CRISTA
  const andares: readonly (readonly [number, number, number])[] = [[1, 2 * k, 1.02], [0.7, 4.4 * k, 1.09], [0.43, 6.4 * k, 1.16]]
  andares.forEach(([largura, recuo, tom], i) => {
    const w = (wv + pt) * largura
    bloco(fundoDoTemplo, -w, yM + recuo, w, yN - recuo, zMuro + i * zAndar, zMuro + (i + 1) * zAndar, tom, 5730 + i * 4, { bisel: 1.2, contorno: 0.26, projeta: { dist: 2.4 * k, forca: 0.4, suave: 1.1 } })
  })
  // A PEDRA DO SOL no andar do meio da crista: o medalhão da pirâmide.
  const zCrista = zMuro + andares.length * zAndar
  const raio = Math.min((wv + pt) * 0.43, (yN - yM) / 2 - 6.4 * k) * 0.86
  if (raio > 3) pedraDoSol(fundoDoTemplo, P, pedra, ...pontoNaTela(v, 0, (yM + yN) / 2, zCrista), raio, 1.16, 5745)

  // Os dois BRASEIROS de pedra nos cantos da frente: a base quadrada, a bacia de borda grossa e a cinza clara.
  for (const lado of [-1, 1]) {
    const [bx, by] = [lado * hw * 0.7, hh * 0.7]
    const r = Math.min(8 * k, hw * 0.17)
    const zBase = zL + g * 0.09
    const zBacia = zBase + g * 0.15
    const braseiro = grupo(bx - r, by - r, bx + r, by + r)
    bloco(braseiro, bx - r, by - r, bx + r, by + r, zL, zBase, 0.88, 5760 + lado * 20, { bisel: 1.2, contorno: 0.28, projeta: { dist: 2.4 * k, forca: 0.36 } })
    const [cx, cy] = pontoNaTela(v, bx, by, zBacia)
    // O bojo da bacia visto de frente (só na 3/4): mais estreito embaixo.
    if (v.sobe > 0) braseiro.push(P(poligono([[cx - r * 0.92, cy], [cx + r * 0.92, cy], [cx + r * 0.56, cy + (zBacia - zBase)], [cx - r * 0.56, cy + (zBacia - zBase)]]), pedra, { bisel: 0.6, contorno: 0.22, tom: 1, luz: LUZ_DA_FRENTE_DO_TEMPLO + 0.07, textura: DA_PEDRA, semente: 5764 + lado * 20 }))
    braseiro.push(P(elipse(cx, cy, r * 0.94, r * (v.sobe > 0 ? 0.8 : 0.94)), pedra, { bisel: r * 0.22, tom: 1.1, contorno: 0.28, textura: DA_PEDRA, semente: 5766 + lado * 20, projeta: { dist: 3 * k, forca: 0.36 } }))
    const [ax, ay] = [r * 0.56, r * (v.sobe > 0 ? 0.47 : 0.56)]
    braseiro.push(P(elipse(cx, cy, ax, ay), CINZA_DO_BRASEIRO, { bisel: 0, contorno: 0.24, recesso: { k: 1.6 * k, forca: 0.4 }, semente: 5768 + lado * 20 }))
    // Uns carvões miúdos, amontoados de um lado (sem ordem: dois olhos e uma boca virariam um rosto).
    for (let i = 0; i < 6; i += 1) {
      const sal = i + (lado + 1) * 6
      const a = (lado > 0 ? 0.4 : 2.3) + (acasoDoTemplo(sal, 48) - 0.5) * 2.6
      const d = 0.16 + 0.5 * acasoDoTemplo(sal, 49)
      const rc = r * (0.07 + 0.07 * acasoDoTemplo(sal, 50))
      braseiro.push(P(elipseGirada(cx + Math.cos(a) * d * ax, cy + Math.sin(a) * d * ay, rc * 1.5, rc, a * 1.7), CARVAO, { bisel: 0.3, contorno: 0.1, alfa: 0.86, tom: 0.9 + 0.4 * acasoDoTemplo(sal, 51), semente: 5770 + sal }))
    }
  }

  // Do fundo para a frente NA TELA: o que está mais para o sul tapa o de trás.
  grupos.sort((a, b) => a.base - b.base).forEach((grp) => L.push(...grp.partes))

  // O cipó que sai do pé do muro do fundo e se arrasta pela laje, e a samambaia do canto.
  const [c1x, c1y] = pontoNaTela(v, -mx - 1.5 * k, yM + 8 * k, zL)
  const [d1x, d1y] = pontoNaTela(v, -0.7, 0.7)
  cipo(L, P, c1x, c1y, d1x, d1y, 11 * k, 500)
  samambaia(L, P, ...pontoNaTela(v, hw * 0.8, -hh * 0.5, zL), 5.6 * k, 510, 6)

  entregarNaTela(v, tela, cena)
}
