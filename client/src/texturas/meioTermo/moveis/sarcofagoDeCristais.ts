/**
 * SARCÓFAGO DE CRISTAIS (lote L06 de 24/11/2026, item 51: versão do `tumuloDePedra`, da sala noroeste da cripta do
 * mapa 8; desenho próprio, só a ideia do objeto). O jazigo de pedra (o basamento de lajes, a arca com os painéis
 * rebaixados e a tampa grossa com a moldura, o painel alto, a guirlanda e o epitáfio gasto) TOMADO PELOS CRISTAIS
 * ciano: um ninho grande nasce do pé, no canto da frente à esquerda, outro no canto de trás à direita, lascas soltas
 * dos lados, e um ninho pequeno rebentou a quina de trás da tampa (as trincas saem dele, com a luz vazando). A pedra
 * perto dos ninhos pega a luz fria (pintada); a luz de verdade é a do integrador (`LUZ_DOS_OBJETOS`).
 *
 * A pegada tem uma FOLGA em volta do túmulo (0,25 casa de cada lado: o túmulo de 1 x 2 numa pegada de 1,5 x 2,5),
 * onde os cristais nascem: assim eles ficam dentro da pegada e o jazigo continua do tamanho dos outros.
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): o basamento, a arca e a tampa são caixas em fatias (a
 * 3/4 mostra a frente de verdade: o painel rebaixado com o losango, a aba da tampa e a sombra dela), e cada cristal é
 * um prisma em fatias (`pedestalComCristal.ts`, o apoio do lote). Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`.
 * Material: `pedra`; o ciano e o musgo são fixos. A cabeceira é o lado de cima da pegada.
 */
import { hash } from '../../ruido'
import { anel, cadeia, caixa, dentroDe, elipse, elipseGirada, poligono, type Ponto } from './formas'
import { contato, texturaDaClasse, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador, rumoDaSombra, sombraNoAr } from './pilhaDeFatias'
import { ESCURO_DA_PEDRA, lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'
import { banhada, CRISTAL, fatiarCristal, graoNaAltura, lascaDeRocha, MUSGO_DA_CRIPTA, ninhoDeCristais, sombraDoCristal, SOMBRA_PINTADA, texHaloFrio, type Cristal, type FonteFria, type Ninho } from './pedestalComCristal'

/** A folga da pegada em volta do túmulo, onde os cristais nascem (casas), e o teto dela (fração do meio lado). */
const FOLGA = 0.25
const FOLGA_MAXIMA = 0.36
/** As alturas (casas): o basamento, o alto da tampa e a grossura dela. */
const ALTURA_DO_BASAMENTO = 0.08
const ALTURA = 0.7
const GROSSURA_DA_TAMPA = 0.14
/** O que o basamento sobra em volta da arca, dos lados, atrás e na frente (px). */
const SOBRA = { lados: 5, tras: 5, frente: 7 } as const
/** Quanto a tampa passa da arca, a moldura chanfrada e a quina de trás que os cristais rebentaram (px). */
const ABA = 1.7
const MOLDURA = 3.4
const QUINA = 6.4
/** O comprimento de uma laje do basamento (casas) e a meia largura das juntas (px). */
const LAJE = 0.5
const JUNTA = 0.4
/** O passo das fatias (px). */
const PASSO = 0.8
/** O painel rebaixado da arca: a sobra até a quina e até o alto e o pé (px). */
const BORDA_DO_PAINEL = 3.4
const ALTO_DO_PAINEL = 4
const SEMENTE = 5100

/** O lado da caixa (x0, y0)-(x1, y1) mais perto do ponto: a normal dele, a posição ao longo e o meio comprimento. */
function ladoDaCaixa(x: number, y: number, x0: number, y0: number, x1: number, y1: number, saida: Float64Array): void {
  const dO = x - x0
  const dL = x1 - x
  const dN = y - y0
  const dS = y1 - y
  const menor = Math.min(dO, dL, dN, dS)
  if (menor === dS || menor === dN) {
    saida[0] = 0
    saida[1] = menor === dS ? 1 : -1
    saida[2] = x - (x0 + x1) / 2
    saida[3] = (x1 - x0) / 2
  } else {
    saida[0] = menor === dL ? 1 : -1
    saida[1] = 0
    saida[2] = y - (y0 + y1) / 2
    saida[3] = (y1 - y0) / 2
  }
}

const LADO = new Float64Array(4)

export const montarSarcofagoDeCristais: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const daPedra = texturaDaClasse(pedra.classe)
  cena.corDoPiso = ESCURO_DA_PEDRA
  const zBase = g * ALTURA_DO_BASAMENTO
  const zTopo = g * ALTURA
  const zArca = zTopo - g * GROSSURA_DA_TAMPA
  const [sx, sy] = rumoDaSombra(q)

  // O túmulo dentro da pegada: o basamento, a arca e a tampa, de cima.
  const folga = Math.min(FOLGA * g, hw * FOLGA_MAXIMA, hh * FOLGA_MAXIMA)
  const [bx0, by0, bx1, by1] = [-hw + folga, -hh + folga, hw - folga, hh - folga]
  const [ax0, ay0, ax1, ay1] = [bx0 + SOBRA.lados, by0 + SOBRA.tras, bx1 - SOBRA.lados, by1 - SOBRA.frente]
  const [tx0, ty0, tx1, ty1] = [ax0 - ABA, ay0 - ABA, ax1 + ABA, ay1 + ABA]

  // ---------- os ninhos e a luz fria ----------
  const noChao: readonly Ninho[] = [
    // O grande, no canto da frente à esquerda: abre do sul ao oeste.
    { cx: bx0 + 0.5, cy: by1 + 0.5, raio: 12.4, alto: 0.7 * g, quantos: 7, de: Math.PI * 0.3, ate: Math.PI * 1.2, tombo: 0.46, semente: SEMENTE + 1 },
    // O do canto de trás à direita: abre do norte ao leste.
    { cx: bx1 - 0.5, cy: by0 - 0.5, raio: 9.6, alto: 0.5 * g, quantos: 6, de: Math.PI * 1.3, ate: Math.PI * 2.2, tombo: 0.5, semente: SEMENTE + 2 },
    // As lascas soltas: no lado direito, no lado esquerdo e na frente.
    { cx: bx1 + 4.2, cy: hh * 0.26, raio: 4, alto: 0.23 * g, quantos: 3, de: -Math.PI * 0.4, ate: Math.PI * 0.4, tombo: 0.6, semente: SEMENTE + 3 },
    { cx: bx0 - 4, cy: -hh * 0.3, raio: 3.4, alto: 0.19 * g, quantos: 2, de: Math.PI * 0.7, ate: Math.PI * 1.3, tombo: 0.6, semente: SEMENTE + 4 },
    { cx: bx1 - 13, cy: by1 + 4.2, raio: 3.6, alto: 0.2 * g, quantos: 3, de: Math.PI * 0.15, ate: Math.PI * 0.85, tombo: 0.6, semente: SEMENTE + 5 },
  ]
  // O da tampa: nasce da quina rebentada e abre para fora dela.
  const daTampa: Ninho = { cx: tx1 - 3.2, cy: ty0 + 3.2, raio: 4.2, alto: 0.27 * g, quantos: 4, de: -Math.PI * 0.62, ate: Math.PI * 0.12, tombo: 0.6, semente: SEMENTE + 6 }
  const fontes: FonteFria[] = [
    ...noChao.map((n, i) => ({ x: n.cx, y: n.cy, r: n.raio * (i < 2 ? 2.5 : 2.3), forca: i < 2 ? 0.5 : 0.3 })),
    { x: daTampa.cx, y: daTampa.cy, r: 10, forca: 0.42 },
  ]

  /** A pedra com a luz desenhada e o banho frio; `z` = a altura da fatia de dentro (o grão anda com ela). */
  const comPedra = (luz: (x: number, y: number) => number, z?: number): Textura => {
    const grao = z === undefined ? daPedra : graoNaAltura(daPedra, z)
    return banhada((u, v, x, y, p, s, escala) => {
      if (grao !== null) grao(u, v, x, y, p, s, escala)
      s[3] += luz(x, y)
    }, fontes)
  }

  // ---------- no chão: o halo de cada ninho, as lascas de rocha e a sombra dos cristais ----------
  const cristaisDoChao: Cristal[][] = noChao.map((n) => ninhoDeCristais(n))
  noChao.forEach((n, i) => {
    const r = n.raio * (i < 2 ? 2.1 : 2.3)
    L.push(P(elipse(n.cx, n.cy, r, r), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(n.cx, n.cy, r, r, i < 2 ? 0.34 : 0.24), semente: SEMENTE + 10 + i }))
  })
  cristaisDoChao.forEach((ninho, i) => {
    ninho.forEach((cr, k) => {
      cena.sombras.push({ forma: sombraDoCristal(cr, q), z: 0, forca: 0.2, suave: 1.1 })
      L.push(P(lascaDeRocha(cr, SEMENTE + 20 + i * 8 + k), pedra, { tabua: 0, bisel: 0.7, tom: 0.78 + 0.14 * hash(k, i, SEMENTE), contorno: 0.24, textura: banhada(daPedra, fontes), semente: SEMENTE + 60 + i * 8 + k }))
    })
  })

  // ---------- o BASAMENTO: as lajes (o piso) e a beira ----------
  const base = caixa(bx0, by0, bx1, by1, 1)
  const laje = LAJE * g
  const pisoDoBasamento = comPedra((x, y) => {
    // A fileira de trás e a da frente têm as juntas de pé; os dois braços, deitadas.
    const naFileira = y < ty0 || y > ty1
    const ao = naFileira ? (x - bx0) / laje : (y - ty0) / laje
    const k = Math.floor(ao)
    const dentro = (ao - k) * laje
    let luz = 0.1 * (hash(k, naFileira ? (y < ty0 ? 1 : 2) : x < 0 ? 3 : 4, SEMENTE + 100) - 0.5)
    if (Math.min(dentro, laje - dentro) < JUNTA) luz -= 0.26
    if (!naFileira && (y - ty0 < JUNTA * 2 || ty1 - y < JUNTA * 2)) luz -= 0.26
    return luz
  })
  const beiraDoBasamento = (z: number): Textura =>
    comPedra((x, y) => {
      ladoDaCaixa(x, y, bx0, by0, bx1, by1, LADO)
      return luzDaNormal(LADO[0], LADO[1], 0, q) - 0.05
    }, z)
  for (const z of alturas(0, zBase, PASSO)) {
    const topo = z >= zBase - 1e-6
    f.fatia(0, z, base, pedra, topo ? { tabua: 0, bisel: 0.9, tom: 0.82, contorno: 0.24, textura: pisoDoBasamento, semente: SEMENTE + 110 } : lisa(0.66, beiraDoBasamento(z), SEMENTE + 111))
  }

  // ---------- a ARCA: os painéis rebaixados com o losango, a sombra da aba no alto ----------
  const arca = caixa(ax0, ay0, ax1, ay1, 0.8)
  const zMeio = (zBase + zArca) / 2
  const meioAlto = (zArca - zBase) / 2 - ALTO_DO_PAINEL
  const faceDaArca = (z: number): Textura =>
    comPedra((x, y) => {
      ladoDaCaixa(x, y, ax0, ay0, ax1, ay1, LADO)
      const u = LADO[2]
      const meia = LADO[3]
      let luz = luzDaNormal(LADO[0], LADO[1], 0, q) - 0.04
      if (z > zArca - 2.4) luz -= 0.15
      if (z < zBase + 1.2) luz -= 0.08
      // Um painel na ponta, três no lado comprido.
      const paineis = meia > 30 ? 3 : 1
      const largura = (2 * meia - 2 * BORDA_DO_PAINEL) / paineis
      const ao = (u + meia - BORDA_DO_PAINEL) / largura
      const k = Math.floor(ao)
      if (ao < 0 || k >= paineis) return luz
      const du = (ao - k - 0.5) * largura
      const dz = z - zMeio
      const meiaLargura = largura / 2 - 1.5
      const fora = Math.max(Math.abs(du) - meiaLargura, Math.abs(dz) - meioAlto)
      if (fora >= 0) return luz
      luz -= 0.06
      // A aresta do rebaixo: a de cima faz sombra, a de baixo pega a luz.
      if (fora > -0.95) luz += Math.abs(dz) - meioAlto === fora ? (dz > 0 ? -0.16 : 0.06) : -0.09
      // O losango em relevo no meio do painel.
      const losango = Math.abs(du) / (meioAlto * 0.6) + Math.abs(dz) / (meioAlto * 0.8)
      if (losango < 1) luz += losango > 0.74 ? 0.17 : 0.07
      return luz
    }, z)
  for (const z of alturas(zBase, zArca, PASSO)) f.fatia(0, z, arca, pedra, lisa(0.84, faceDaArca(z), SEMENTE + 120))

  // ---------- a TAMPA: a laje com a quina de trás rebentada, a gola e o filete ----------
  const tampa = poligono([[tx0, ty0], [tx1 - QUINA, ty0], [tx1 - QUINA * 0.62, ty0 + QUINA * 0.34], [tx1 - QUINA * 0.3, ty0 + QUINA * 0.5], [tx1, ty0 + QUINA], [tx1, ty1], [tx0, ty1]])
  const faceDaTampa = (z: number): Textura => {
    const t = (z - zArca) / (zTopo - zArca)
    return comPedra((x, y) => {
      ladoDaCaixa(x, y, tx0, ty0, tx1, ty1, LADO)
      return luzDaNormal(LADO[0], LADO[1], 0, q) + (t > 0.7 ? 0.07 : t < 0.3 ? -0.12 : 0)
    }, z)
  }
  for (const z of alturas(zArca, zTopo, PASSO)) {
    const topo = z >= zTopo - 1e-6
    f.fatia(0, z, tampa, pedra, topo ? { tabua: 0, bisel: 2.4, tom: 0.96, contorno: 0.3, textura: comPedra(() => 0), semente: SEMENTE + 130 } : lisa(0.9, faceDaTampa(z), SEMENTE + 131))
  }

  // Em cima da tampa: a sombra pintada do painel (a fatia não projeta), o PAINEL alto e o que vai nele.
  const [px0, py0, px1, py1] = [tx0 + MOLDURA, ty0 + MOLDURA + 0.6, tx1 - MOLDURA, ty1 - MOLDURA]
  const painel = caixa(px0, py0, px1, py1, 1)
  f.fatia(1, zTopo + 0.05, dentroDe(caixa(px0 + sx * 3.4, py0 + sy * 3.4, px1 + sx * 3.4, py1 + sy * 3.4, 1), tampa), SOMBRA_PINTADA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.22, suave: 0.8, semente: SEMENTE + 140 })
  f.fatia(2, zTopo + 0.1, painel, pedra, { tabua: 0, bisel: 1.6, tom: 1.06, contorno: 0.24, textura: comPedra(() => 0), semente: SEMENTE + 141 })

  // A GUIRLANDA na cabeceira: o anel de folhas e a fita embaixo.
  const gy = py0 + (px1 - px0) * 0.42
  const rG = (px1 - px0) * 0.3
  const esculpido = { tabua: 0, bisel: 0.5, contorno: 0.16 }
  f.fatia(3, zTopo + 0.2, anel(0, gy, rG, rG, rG * 0.62, rG * 0.62), pedra, { ...esculpido, tom: 0.9, recesso: { k: 0.8, forca: 0.22 }, semente: SEMENTE + 150 })
  const folhas = 14
  for (let k = 0; k < folhas; k += 1) {
    const a = (k / folhas) * 2 * Math.PI
    f.fatia(4, zTopo + 0.3, elipseGirada(Math.cos(a) * rG * 0.81, gy + Math.sin(a) * rG * 0.81, rG * 0.2, rG * 0.09, a + 0.7), pedra, { ...esculpido, tom: 1.1, semente: SEMENTE + 151 + k })
  }
  f.fatia(3, zTopo + 0.2, poligono([[-1.2, gy + rG * 0.9], [-rG * 0.55, gy + rG * 1.45], [-rG * 0.3, gy + rG * 1.5], [0, gy + rG * 1.05], [rG * 0.3, gy + rG * 1.5], [rG * 0.55, gy + rG * 1.45], [1.2, gy + rG * 0.9]]), pedra, { ...esculpido, tom: 1.02, semente: SEMENTE + 170 })

  // O EPITÁFIO gasto: três linhas rebaixadas, de comprimentos diferentes.
  const yTexto = (py0 + py1) / 2 + (py1 - py0) * 0.08
  ;[0.62, 0.78, 0.46].forEach((fracao, k) => {
    const meia = ((px1 - px0) / 2) * fracao
    f.fatia(3, zTopo + 0.2, caixa(-meia, yTexto + k * 4.2 - 0.55, meia, yTexto + k * 4.2 + 0.55, 0.4), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, recesso: { k: 0.8, forca: 0.3 }, semente: SEMENTE + 171 + k })
  })

  // As TRINCAS que saem da quina rebentada, com a luz fria vazando perto dela.
  const trincas: readonly (readonly Ponto[])[] = [
    [[tx1 - 4.6, ty0 + 5], [tx1 - 8.6, ty0 + 10.4], [tx1 - 7.4, ty0 + 16.6], [tx1 - 12.6, ty0 + 23], [tx1 - 11.2, ty0 + 29]],
    [[tx1 - 6.4, ty0 + 3.6], [tx1 - 13, ty0 + 5.6], [tx1 - 19.6, ty0 + 3.4], [tx1 - 25, ty0 + 6.2]],
    [[tx1 - 8.6, ty0 + 10.4], [tx1 - 14.4, ty0 + 12.6]],
  ]
  trincas.forEach((pontos, k) => {
    const trinca = dentroDe(cadeia(pontos, 0.42), tampa)
    f.fatia(5, zTopo + 0.4, trinca, pedra, { tabua: 0, bisel: 0, tom: 0.42, contorno: 0, semente: SEMENTE + 180 + k })
    f.fatia(6, zTopo + 0.45, dentroDe(cadeia(pontos, 0.2), tampa), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(daTampa.cx, daTampa.cy, 21, 21, 0.95), semente: SEMENTE + 184 + k })
  })

  // O MUSGO nas quinas da tampa e no pé do basamento.
  const musgo = { tabua: 0, bisel: 0.4, contorno: 0.1, alfa: 0.55, suave: 0.9 }
  f.fatia(5, zTopo + 0.4, elipseGirada(tx0 + 2.6, ty0 + 3.4, 3.6, 2.2, 0.6), MUSGO_DA_CRIPTA, { ...musgo, semente: SEMENTE + 190 })
  f.fatia(5, zTopo + 0.4, elipseGirada(tx1 - 2.4, ty1 - 2.8, 4.2, 2, -0.4), MUSGO_DA_CRIPTA, { ...musgo, semente: SEMENTE + 191 })
  f.fatia(1, zBase + 0.2, elipse(bx1 - 3, by1 - 2.6, 3.2, 1.8), MUSGO_DA_CRIPTA, { ...musgo, alfa: 0.5, semente: SEMENTE + 192 })

  // ---------- os CRISTAIS: os do chão (a profundidade os põe atrás ou na frente do túmulo) e os da tampa ----------
  cristaisDoChao.forEach((ninho, i) => ninho.forEach((cr, k) => fatiarCristal(f, 0, 0.4, cr, SEMENTE + 200 + i * 8 + k)))
  const cristaisDaTampa = ninhoDeCristais(daTampa)
  cristaisDaTampa.forEach((cr, k) => {
    f.fatia(6, zTopo + 0.5, lascaDeRocha(cr, SEMENTE + 250 + k), pedra, { tabua: 0, bisel: 0.6, tom: 0.86, contorno: 0.22, textura: banhada(daPedra, fontes), semente: SEMENTE + 254 + k })
    fatiarCristal(f, 7, zTopo - 1.2, cr, SEMENTE + 260 + k)
  })
  f.fechar()

  // ---------- as sombras no chão: a do túmulo (varrida até o alto da tampa), a do basamento e o contato ----------
  cena.sombras.push(sombraVarrida(tx0, ty0, tx1, ty1, zTopo, q, 0.26, 2.2), sombraNoAr(base, zBase, q, 0.2, 1.1), contato(base, 0.3))
}
