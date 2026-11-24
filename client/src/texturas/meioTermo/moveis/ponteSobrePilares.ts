/**
 * PONTE SOBRE PILARES (lote L08 de 24/11/2026, item 76: construção, versão larga da ponte de pedra; as pontes que
 * cruzam a cascata do mapa 6; desenho próprio, só a ideia do objeto). O TABULEIRO largo de três ou quatro fiadas de
 * LAJES LONGAS no sentido da travessia, de juntas largas e escuras, gasto e mais claro no meio por onde se pisa, entre
 * duas MURETAS grossas (cada uma perto de um sexto da largura) de capa de pedra clara, com a face escura do lado da
 * sombra, e os quatro pilaretes das pontas. Por baixo, os PILARES: cada um passa do tabuleiro para os dois lados num
 * TALHA-MAR em ponta, de duas águas; a correnteza vem do lado de cima da pegada, faz a ESPUMA no bico de cima e deixa a
 * ESTEIRA EM V atrás do de baixo. A sombra na água fica colada ao tabuleiro (uma faixa curta do sul e do leste), e os
 * pilares a cortam.
 *
 * A ponte corre ao longo do lado MAIOR da pegada (como a ponte e o arco do portão): a de partida, 5 x 2 casas,
 * deitada. Esticada, ganha lajes e pilares (um vão a cada casa e meia, mais ou menos); as medidas de través (a
 * mureta, o bico) ficam na régua da casa.
 *
 * AS DUAS VISTAS SAEM DO MESMO DESENHO (perfil `{ modo: 'derivado', propria: true }`, a vista de `piramideEmDegraus.ts`).
 * Na 3/4, com a ponte atravessada na tela, a face de frente mostra os ARCOS: o vão escuro entre um pilar e outro, com
 * a água aparecendo por ele (o vão é meio transparente embaixo), a aduela clara em volta e o REFLEXO do arco na água,
 * e os talha-mares de frente com as duas águas. Com a ponte de pé na tela, aparecem a ponta do tabuleiro e os bicos
 * de lado. Lê `c.giro` e `c.vista`. Material: `pedra`; o musgo e a espuma são fixos. Escreve `cena.corDoPiso`. Anda-se
 * em cima dela: não barra, não tapa.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, dentroDe, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { ruido, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import {
  acasoDoTemplo,
  caixaNaTela,
  cipo,
  DA_PEDRA,
  entregarNaTela,
  ESCURO_DA_PEDRA_DO_TEMPLO,
  frenteNaTela,
  manchaIrregular,
  LUZ_DA_FRENTE_DO_TEMPLO,
  luzDaFaceNaTela,
  naTelaDoTemplo,
  pedraDoTemplo,
  polNaTela,
  pontoNaTela,
  retNaTela,
  texDaParedeDoTemplo,
  texNoObjeto,
  tufoDeMusgo,
  vistaDoTemplo,
  type Ponto3,
  type VistaDoTemplo,
} from './piramideEmDegraus'

/** A altura do tabuleiro (o piso), a da mureta acima dele e a do pilarete acima dela (casas). */
const ALTURA_DO_TABULEIRO = 0.5
const ALTURA_DA_MURETA = 0.2
const ALTURA_DO_PILARETE = 0.08
/** O talha-mar: o bico para fora do tabuleiro, a meia largura do pilar e a altura dele junto da ponte (casas). */
const BICO = 0.36
const MEIO_PILAR = 0.25
/** Até onde o talha-mar vai reto antes de fechar em ponta (fração do bico): o bico de barco, e não um triângulo. */
const OMBRO_DO_BICO = 0.34
const ALTURA_DO_TALHA_MAR = 0.27
/** O vão entre dois pilares (casas) e a laje do tabuleiro ao comprido (casas). */
const VAO = 1.6
const LAJE = 0.92
/** O arco: onde nasce acima da água e quanto fica abaixo do piso (casas). */
const NASCE_O_ARCO = 0.09
const ACIMA_DO_ARCO = 0.13
/** A espuma branco-gelo, o escuro debaixo da ponte e a sombra colada na água (px para fora e a força). */
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xee, 0xf0] }
const DEBAIXO_DA_PONTE: Rgb = [0x2a, 0x30, 0x34]
const ESCURO: MaterialDaPeca = { classe: 'liso', rgb: DEBAIXO_DA_PONTE }
const SOMBRA_NA_AGUA = { leste: 2.6, sul: 3, borda: 3, forca: 0.38 } as const

/** O escuro debaixo do arco: cheio no alto (o intradorso), ralo junto da água (ela aparece pelo vão). */
function texDoVao(topo: number, agua: number): Textura {
  return (_u, _v, _x, y, _p, s) => {
    const t = (y - topo) / Math.max(1, agua - topo)
    s[5] = 0.96 - 0.5 * (t < 0 ? 0 : t > 1 ? 1 : t) * (t < 0 ? 0 : t > 1 ? 1 : t)
  }
}

/** O reflexo do arco na água: some para baixo e é cortado por riscos deitados (a água mexe). */
function texDoReflexo(agua: number, fundo: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = (y - agua) / Math.max(1, fundo)
    const risco = ruido(x * 0.08 + 3, y * 0.9 + 7)
    s[5] = Math.max(0, 0.36 * (1 - t) * (risco > 0.14 ? 0.35 : 1))
  }
}

export const montarPonteSobrePilares: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const deitada = c.w >= c.h
  const C = deitada ? c.hw : c.hh
  const meiaPegada = deitada ? c.hh : c.hw
  if (!(C > 0) || !(meiaPegada > 0)) return
  const v = vistaDoTemplo(c)
  // A régua da ponte: `u` ao longo, `t` de través. Em pé, é a mesma ponte com mais um quarto de volta.
  const r: VistaDoTemplo = { q: (v.q + (deitada ? 0 : 1)) % 4, sobe: v.sobe }
  const atravessada = r.q % 2 === 0
  const pedra = pedraDoTemplo(c.m.pedra)
  const tela: Cena = { partes: [], sombras: [], corDoPiso: ESCURO_DA_PEDRA_DO_TEMPLO }
  const L = tela.partes

  const bico = Math.min(g * BICO, meiaPegada * 0.3)
  /** A meia largura do tabuleiro: a pegada menos o bico dos pilares de cada lado. */
  const A = meiaPegada - bico
  const mureta = Math.min(Math.max(g * 0.2, (2 * A) / 6.2), A * 0.36)
  const pista = A - mureta
  const zTab = g * ALTURA_DO_TABULEIRO
  const zMur = zTab + g * ALTURA_DA_MURETA
  const zBico = g * ALTURA_DO_TALHA_MAR
  const vaos = Math.max(2, Math.round((2 * C) / (g * VAO)))
  const pw = Math.min(g * MEIO_PILAR, C / vaos / 2.4)
  const pilares = Array.from({ length: vaos - 1 }, (_, i) => -C + (2 * C * (i + 1)) / vaos)
  /** O lado de través que fica virado para quem olha (o do sul NA TELA) com a ponte atravessada. */
  const daFrente = r.q === 2 ? -1 : 1

  const pt = (u: number, t: number, z = 0): Ponto => pontoNaTela(r, u, t, z)
  const pol = (pontos: readonly Ponto3[]): Forma => polNaTela(r, pontos)

  // ---------- a SOMBRA NA ÁGUA: colada ao tabuleiro, do sul e do leste (os pilares a tapam onde estão) ----------
  const chao = caixaNaTela(r, -C, -A, C, A)
  const { leste, sul, borda, forca } = SOMBRA_NA_AGUA
  tela.sombras.push({ forma: poligono([[chao[0] + 2, chao[1] + 2], [chao[2], chao[1] + 2], [chao[2] + leste, chao[1] + 2 + sul], [chao[2] + leste, chao[3] + sul], [chao[0] + 2 + leste, chao[3] + sul], [chao[0] + 2, chao[3]]]), z: 0, suave: borda, forca })

  // ---------- a ÁGUA em volta dos bicos: a espuma do lado de onde a correnteza vem e a esteira em V do outro ----------
  for (const [i, u] of pilares.entries()) {
    // De cima da pegada (t negativo) a água bate no bico e espuma em volta dele: manchas de beira roída, em arco.
    for (let j = 0; j < 6; j += 1) {
      const sal = i * 20 + j
      const a = Math.PI * (1.1 + (0.8 * j) / 5) + (acasoDoTemplo(sal, 95) - 0.5) * 0.24
      const d = 0.92 + 0.3 * acasoDoTemplo(sal, 96)
      const [fx, fy] = pt(u + Math.cos(a) * pw * d * 1.25, -A - bico * 0.62 + Math.sin(a) * bico * d * 0.6)
      const rb = 1.8 + 1.8 * acasoDoTemplo(sal, 97)
      L.push(P(manchaIrregular(fx, fy, rb * 1.5, rb, a + Math.PI / 2, sal, 0.7), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.44 + 0.4 * acasoDoTemplo(sal, 98), suave: 0.9, semente: 7000 + sal }))
    }
    // Do outro lado a água fecha atrás do bico e abre a esteira em V: manchas de espuma que diminuem e somem.
    for (const banda of [-1, 1]) {
      for (let j = 0; j < 4; j += 1) {
        const sal = i * 20 + (banda + 1) * 5 + j
        const f = (j + 0.6) / 4
        const [fx, fy] = pt(u + banda * pw * (0.25 + 1.05 * f), A + bico * (0.96 + 0.5 * f))
        const rb = 2.2 * (1 - 0.6 * f)
        L.push(P(manchaIrregular(fx, fy, rb * 1.6, rb * 0.8, Math.atan2(pt(banda * 0.6, 1)[1], pt(banda * 0.6, 1)[0]), sal + 300, 0.6), ESPUMA, { bisel: 0, contorno: 0, alfa: 0.66 * (1 - 0.62 * f), suave: 0.8, semente: 7040 + sal }))
      }
    }
  }

  // ---------- os TALHA-MARES: o bico de duas águas de cada lado de cada pilar ----------
  const talhaMar = (partes: Peca[], u: number, lado: number, semente: number): void => {
    const [raiz, ombro, ponta] = [lado * (A - 1), lado * (A + bico * OMBRO_DO_BICO), lado * (A + bico)]
    const [zOmbro, zPonta] = [zBico * 0.9, zBico * 0.58]
    for (const banda of [-1, 1]) {
      const x = u + banda * pw
      // A normal de fora da água do bico, NA TELA: escolhe a luz e se a face de pé aparece.
      const [nx, ny] = naTelaDoTemplo(banda * bico * (1 - OMBRO_DO_BICO), lado * pw, r.q)
      const [lx, ly] = naTelaDoTemplo(banda, 0, r.q)
      if (v.sobe > 0 && ly > 0.05) partes.push(P(pol([[x, raiz, 0], [x, ombro, 0], [x, ombro, zOmbro], [x, raiz, zBico]]), pedra, { bisel: 0, contorno: 0.16, tom: 0.9, luz: LUZ_DA_FRENTE_DO_TEMPLO, textura: DA_PEDRA, semente: semente + 8 + banda }))
      if (v.sobe > 0 && ny > 0.05) {
        partes.push(P(pol([[x, ombro, 0], [u, ponta, 0], [u, ponta, zPonta], [x, ombro, zOmbro]]), pedra, { bisel: 0, contorno: 0.16, tom: 0.9, luz: luzDaFaceNaTela(nx, ny) * 0.7 + LUZ_DA_FRENTE_DO_TEMPLO * 0.6, textura: DA_PEDRA, semente: semente + banda }))
      }
      // A água de cima do bico: do eixo ao ombro e à ponta, com a luz do lado para onde cai.
      partes.push(P(pol([[u, raiz, zBico], [x, raiz, zBico], [x, ombro, zOmbro], [u, ponta, zPonta]]), pedra, { bisel: 0, contorno: 0.18, tom: 1.02, luz: luzDaFaceNaTela(nx + lx * 0.6, ny + ly * 0.6) * 0.9, textura: DA_PEDRA, semente: semente + 4 + banda }))
    }
    // O musgo na pedra molhada, junto da ponta.
    tufoDeMusgo(partes, P, ...pt(u + (acasoDoTemplo(semente, 3) - 0.5) * pw * 0.6, lado * (A + bico * 0.5), zBico * 0.74), 2.8, semente, 0.6)
  }
  const deTras: Peca[] = []
  const deFrente: Peca[] = []
  pilares.forEach((u, i) => {
    for (const lado of [-1, 1]) talhaMar(atravessada && v.sobe > 0 && lado === daFrente ? deFrente : deTras, u, lado, 7100 + i * 20 + (lado + 1) * 5)
  })
  L.push(...deTras)

  // ---------- o TABULEIRO: as lajes longas em fiadas ao comprido, de junta larga e escura, gastas no meio ----------
  // Três fiadas na pista entre as muretas (quatro quando ela passa de 1,1 casa).
  const fiadas = 2 * pista > g * 1.1 ? 4 : 3
  const largura = (2 * pista) / fiadas
  const laje = g * LAJE
  const doTabuleiro = texNoObjeto(r, zTab, (u, t, p, s, escala) => {
    DA_PEDRA(0, 0, u, t, p, s, escala)
    const ft = (t + pista) / largura
    const fiada = Math.floor(ft)
    const dentro = (ft - fiada) * largura
    const uu = u / laje + fiada * 0.37 + hash(fiada, 3, 951) * 0.4
    const n = Math.floor(uu)
    const ao = (uu - n) * laje
    const junta = Math.min(dentro, largura - dentro, ao, laje - ao)
    s[3] += (hash(n, fiada, 953) - 0.5) * 0.11
    // Gasto no meio, por onde se pisa: mais claro e mais liso.
    const q = t / (pista * 0.62)
    s[3] += 0.09 * Math.exp(-q * q)
    if (junta < 1.3) s[3] -= 0.34 * (1 - junta / 1.3)
  })
  const tabuleiro = retNaTela(r, -C, -A, C, A, zTab, 1)
  L.push(P(tabuleiro, pedra, { bisel: 0, contorno: 0.24, tom: 0.94, textura: doTabuleiro, semente: 7200, projeta: { dist: 2.4, forca: 0.3 } }))

  // ---------- as MURETAS grossas: a face de pé (na 3/4), a capa clara e, do lado da sombra, a face escura ----------
  /** Um bloco em cima do tabuleiro: a frente (na 3/4), o tampo e, onde a face não tem largura na tela, a faixa escura do lado da sombra. */
  const bloco = (u0: number, t0: number, u1: number, t1: number, z0: number, z1: number, tom: number, semente: number, sombra: number): void => {
    const frente = frenteNaTela(r, u0, t0, u1, t1, z0, z1)
    if (frente !== null) L.push(P(caixa(frente.b[0], frente.b[1] - 0.3, frente.b[2], frente.b[3]), pedra, { bisel: 0, contorno: 0.16, tom: tom * 0.9, luz: LUZ_DA_FRENTE_DO_TEMPLO, textura: texDaParedeDoTemplo(frente.b[3], 99, semente * 0.17), semente }))
    const alto = caixaNaTela(r, u0, t0, u1, t1, z1)
    const aoComprido = alto[2] - alto[0] > alto[3] - alto[1]
    L.push(P(caixa(alto[0], alto[1], alto[2], alto[3], 1), pedra, { bisel: 1, contorno: 0.24, tom, textura: texDaCapaDaMureta(aoComprido), semente: semente + 1, projeta: { dist: sombra, forca: 0.4, suave: 1.2 } }))
    // A face escura do lado da sombra: de cima, a do sul ou a do leste; na 3/4 só a do leste (a do sul já é a frente).
    const larga = Math.min(2.4, (aoComprido ? alto[3] - alto[1] : alto[2] - alto[0]) * 0.24)
    if (aoComprido && v.sobe === 0) L.push(P(caixa(alto[0] + 0.4, alto[3] - larga, alto[2] - 0.4, alto[3] - 0.2), pedra, { bisel: 0, contorno: 0, tom: tom * 0.6, textura: DA_PEDRA, semente: semente + 2 }))
    if (!aoComprido) L.push(P(caixa(alto[2] - larga, alto[1] + 0.4, alto[2] - 0.2, alto[3] - 0.4), pedra, { bisel: 0, contorno: 0, tom: tom * 0.6, textura: DA_PEDRA, semente: semente + 2 }))
  }
  const lp = Math.min(mureta * 1.25, C * 0.2)
  const zPilarete = zMur + g * ALTURA_DO_PILARETE
  // A de trás primeiro; a da frente (a do sul NA TELA) por último.
  const lados = atravessada ? [-daFrente, daFrente] : [-1, 1]
  for (const lado of lados) {
    const [t0, t1] = lado < 0 ? [-A, -A + mureta] : [A - mureta, A]
    bloco(-C + lp, t0, C - lp, t1, zTab, zMur, 1.12, 7300 + (lado + 1) * 10, 3.2)
    for (const ponta of [-1, 1]) {
      const [u0, u1] = ponta < 0 ? [-C, -C + lp] : [C - lp, C]
      bloco(u0, t0 - (lado < 0 ? 0.8 : 0), u1, t1 + (lado > 0 ? 0.8 : 0), zTab, zPilarete, 1.18, 7340 + (lado + 1) * 10 + ponta, 3.8)
    }
  }

  // ---------- a FACE DE FRENTE (só na 3/4): os arcos com a ponte atravessada; a ponta do tabuleiro com ela de pé ----------
  if (v.sobe > 0 && atravessada) {
    const face = frenteNaTela(r, -C, -A, C, A, 0, zTab)
    if (face !== null) {
      const [x0, y0, x1, y1] = face.b
      const nasce = y1 - g * NASCE_O_ARCO
      const fecho = y0 + g * ACIMA_DO_ARCO
      // Os apoios NA TELA (as duas pontas e os pilares), em ordem.
      const apoios = [x0 - pw, ...pilares.map((u) => pt(u, 0)[0]).sort((a, b) => a - b), x1 + pw]
      let vazios: Forma | null = null
      const aberturas: { readonly forma: Forma; readonly meio: number; readonly raio: number }[] = []
      for (let i = 0; i + 1 < apoios.length; i += 1) {
        const [xa, xb] = [Math.max(x0 + 1, apoios[i] + pw), Math.min(x1 - 1, apoios[i + 1] - pw)]
        if (xb - xa < 4) continue
        const [meio, raio] = [(xa + xb) / 2, (xb - xa) / 2]
        const forma = uniao(caixa(xa, nasce, xb, y1 + 1), elipse(meio, nasce, raio, nasce - fecho))
        aberturas.push({ forma, meio, raio })
        vazios = vazios === null ? forma : uniao(vazios, forma)
      }
      // O reflexo de cada arco na água, logo abaixo da face.
      const fundo = Math.min(bico * 0.8, g * 0.2)
      for (const [i, a] of aberturas.entries()) {
        L.push(P(dentroDe(elipse(a.meio, y1, a.raio, fundo), caixa(a.meio - a.raio, y1, a.meio + a.raio, y1 + fundo)), ESCURO, { bisel: 0, contorno: 0, textura: texDoReflexo(y1, fundo), semente: 7400 + i }))
      }
      // O escuro debaixo de cada arco (a água aparece por ele), a parede com os vãos e a aduela clara em volta.
      for (const [i, a] of aberturas.entries()) L.push(P(a.forma, ESCURO, { bisel: 0, contorno: 0, textura: texDoVao(fecho, y1), semente: 7410 + i }))
      const parede = caixa(x0, y0 - 0.3, x1, y1)
      L.push(P(vazios === null ? parede : menos(parede, vazios), pedra, { bisel: 0, contorno: 0.2, tom: 0.92, luz: LUZ_DA_FRENTE_DO_TEMPLO, textura: texDaParedeDoTemplo(y1, 7, 0.2), semente: 7420 }))
      // O fuste de cada pilar, saliente na face, do arranque do arco ao piso: o pilar lê inteiro, com o bico no pé.
      pilares.forEach((u, i) => {
        const px = pt(u, 0)[0]
        L.push(P(caixa(px - pw * 0.72, y0 + g * 0.05, px + pw * 0.72, nasce + 1, 0.6), pedra, { bisel: 0.9, contorno: 0.2, tom: 1.02, luz: LUZ_DA_FRENTE_DO_TEMPLO * 0.72, textura: texDaParedeDoTemplo(y1, 7, 0.7), semente: 7440 + i, projeta: { dist: 1.6, forca: 0.3 } }))
      })
      for (const [i, a] of aberturas.entries()) {
        const aduela = dentroDe(menos(elipse(a.meio, nasce, a.raio + 2.6, nasce - fecho + 2.6), elipse(a.meio, nasce, a.raio, nasce - fecho)), caixa(a.meio - a.raio - 3, y0, a.meio + a.raio + 3, nasce))
        L.push(P(aduela, pedra, { bisel: 0.5, contorno: 0.16, tom: 1.08, luz: LUZ_DA_FRENTE_DO_TEMPLO * 0.5, textura: DA_PEDRA, semente: 7430 + i }))
      }
    }
  } else if (v.sobe > 0) {
    // De pé na tela: a ponta do tabuleiro virada para quem olha (o encontro com a margem).
    const ponta = frenteNaTela(r, -C, -A, C, A, 0, zTab)
    if (ponta !== null) L.push(P(caixa(ponta.b[0], ponta.b[1] - 0.3, ponta.b[2], ponta.b[3]), pedra, { bisel: 0, contorno: 0.2, tom: 0.92, luz: LUZ_DA_FRENTE_DO_TEMPLO, textura: texDaParedeDoTemplo(ponta.b[3], 7, 0.2), semente: 7420 }))
  }
  L.push(...deFrente)

  // ---------- o TEMPO: dois cipós pendurados da mureta da frente ----------
  const cai = pt(0, daFrente, 0)
  const [c1x, c1y] = pt(-C * 0.36, daFrente * (A - 0.5), v.sobe > 0 && atravessada ? zTab : zMur)
  cipo(L, P, c1x, c1y, cai[0] + 0.12, cai[1], atravessada && v.sobe > 0 ? zTab * 0.62 : 8, 720)
  const [c2x, c2y] = pt(C * 0.56, daFrente * (A - 0.5), v.sobe > 0 && atravessada ? zTab : zMur)
  cipo(L, P, c2x, c2y, cai[0] - 0.1, cai[1], atravessada && v.sobe > 0 ? zTab * 0.42 : 6, 721)

  entregarNaTela(v, tela, cena)
}

/** A capa da mureta: a pedra clara em blocos compridos, com a junta fina de través. */
function texDaCapaDaMureta(aoComprido: boolean): Textura {
  return (_u, _v, x, y, p, s, escala) => {
    DA_PEDRA(0, 0, x, y, p, s, escala)
    const tt = (aoComprido ? x : y) / 21 + 0.3
    const junta = Math.abs(tt - Math.round(tt)) * 21
    if (junta < 0.55) s[3] -= 0.2 * (1 - junta / 0.55)
    s[3] += (hash(Math.round(tt), aoComprido ? 1 : 2, 957) - 0.5) * 0.07
  }
}
