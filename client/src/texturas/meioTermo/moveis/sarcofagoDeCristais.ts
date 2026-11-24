/**
 * SARCÓFAGO DE CRISTAIS (lote L06 de 24/11/2026, item 51: versão do `tumuloDePedra`, da sala noroeste da cripta do
 * mapa 8; desenho próprio, só a ideia do objeto). O jazigo de pedra (o basamento de lajes, a arca com os painéis
 * rebaixados e a tampa grossa com a moldura, o painel alto, a guirlanda e o epitáfio gasto) TOMADO PELOS CRISTAIS
 * ciano, que NASCEM DA PEDRA em dois ninhos:
 * - o do PÉ, no canto da frente à esquerda: rebentou a quina do basamento e sai dela (o maior prisma tem 0,35 casa);
 * - o da QUINA DE TRÁS, à direita: veio de dentro da arca e rebentou a quina da tampa; os prismas saem da fenda,
 *   curtos e grossos (passam pouco da tampa). As trincas saem dali pela tampa, com um fio de luz por dentro.
 * A pedra em volta de cada ninho pega o banho de luz fria (pintado); a luz de verdade é a do integrador
 * (`LUZ_DOS_OBJETOS`).
 *
 * A pegada tem uma FOLGA em volta do túmulo (0,25 casa de cada lado: o túmulo de 1 x 2 numa pegada de 1,5 x 2,5),
 * onde o ninho do pé se espalha: assim ele fica dentro da pegada e o jazigo continua do tamanho dos outros.
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): o basamento, a arca e a tampa são caixas em fatias (a
 * 3/4 mostra a frente de verdade: o painel rebaixado com o losango, a aba da tampa e a sombra dela), e cada cristal é
 * um prisma em fatias (`pedestalComCristal.ts`, o apoio do lote): de cima, a ponta sextavada com o miolo claro.
 * Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`. Material: `pedra`; o ciano e o musgo são fixos. A cabeceira é
 * o lado de cima da pegada.
 *
 * Revisão do diretor de arte (24/11/2026): saíram as lascas avulsas dos lados (liam como confete), os cristais
 * passaram a nascer das quinas rebentadas, o banho de luz na pedra ficou visível e as pontas do ninho de trás
 * passam pouco da tampa (antes pareciam espinhos).
 */
import { hash } from '../../ruido'
import { anel, cadeia, caixa, dentroDe, elipse, elipseGirada, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador, rumoDaSombra, sombraNoAr } from './pilhaDeFatias'
import { ESCURO_DA_PEDRA, lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'
import { banhada, CIANO, CRISTAL, fatiarCristal, graoNaAltura, lascaDeRocha, MUSGO, MUSGO_DA_CRIPTA, musgoPreso, ninhoDeCristais, sombraDoCristal, SOMBRA_PINTADA, texHaloFrio, type Cristal, type FonteFria } from './pedestalComCristal'

/** A folga da pegada em volta do túmulo, onde o ninho do pé se espalha (casas), e o teto dela (fração do meio lado). */
const FOLGA = 0.25
const FOLGA_MAXIMA = 0.36
/** As alturas (casas): o basamento, o alto da tampa e a grossura dela. */
const ALTURA_DO_BASAMENTO = 0.08
const ALTURA = 0.7
const GROSSURA_DA_TAMPA = 0.14
/** O que o basamento sobra em volta da arca, dos lados, atrás e na frente (px). */
const SOBRA = { lados: 5, tras: 5, frente: 7 } as const
/** Quanto a tampa passa da arca e a moldura chanfrada (px). */
const ABA = 1.7
const MOLDURA = 3.4
/** As quinas que os cristais rebentaram (px): a de trás da tampa e a do pé do basamento. */
const QUINA = { tampa: 9.6, pe: 9 } as const
/** O comprimento de uma laje do basamento (casas) e a meia largura das juntas (px). */
const LAJE = 0.5
const JUNTA = 0.4
/** O passo das fatias (px). */
const PASSO = 0.8
/** O painel rebaixado da arca: a sobra até a quina e até o alto e o pé (px). */
const BORDA_DO_PAINEL = 3.4
const ALTO_DO_PAINEL = 4
/**
 * Os NINHOS. O do pé: o raio (px), a altura do maior (casas: 0,35) e quantos. O da quina da tampa: curto e grosso, e
 * o pé dele fica afundado na fenda (px abaixo do alto da tampa), então o maior passa uns 0,18 casa dela.
 */
const NINHO_DO_PE = { raio: 9.6, alto: 0.35, quantos: 6 } as const
const NINHO_DA_TAMPA = { raio: 6.6, alto: 0.23, quantos: 5, afundado: 2.6 } as const
/** O banho de luz fria na pedra: o raio em que ele cai (casas) e a força junto do ninho. */
const BANHO = { raio: 0.42, forca: 0.6 } as const
/**
 * A trinca: a meia largura do escuro e a do fio de luz por dentro (1 px de largura) perto da quina, quanto as duas
 * afinam até a ponta e até onde o fio corre aceso (px).
 */
const TRINCA = { escuro: 0.86, fio: 0.5, afina: 0.5, alcance: 46 } as const
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

  // ---------- os dois ninhos e a luz fria ----------
  // O do PÉ: nasce da quina da frente do basamento, à esquerda, e se espalha pelo chão em volta dela.
  const [pex, pey] = [bx0 + 1.6, by1 - 1.6]
  const doPe = ninhoDeCristais({ cx: pex, cy: pey, raio: NINHO_DO_PE.raio, alto: NINHO_DO_PE.alto * g, quantos: NINHO_DO_PE.quantos, de: Math.PI * 0.12, ate: Math.PI * 1.38, pende: [-0.12, 0.06], semente: SEMENTE + 1 })
  // O de TRÁS: sai da quina rebentada da tampa (vem de dentro da arca).
  const [qx, qy] = [tx1 - QUINA.tampa * 0.36, ty0 + QUINA.tampa * 0.36]
  const daTampa = ninhoDeCristais({ cx: qx, cy: qy, raio: NINHO_DA_TAMPA.raio, alto: NINHO_DA_TAMPA.alto * g, quantos: NINHO_DA_TAMPA.quantos, de: -Math.PI * 0.82, ate: Math.PI * 0.32, pende: [0.08, -0.06], tombo: 0.18, gordura: 0.5, semente: SEMENTE + 6 })
  const raioDoBanho = BANHO.raio * g
  const fontes: FonteFria[] = [
    { x: pex, y: pey, r: raioDoBanho, forca: BANHO.forca },
    { x: qx, y: qy, r: raioDoBanho, forca: BANHO.forca },
  ]

  /** A pedra com a luz desenhada e o banho frio; `z` = a altura da fatia de dentro (o grão anda com ela). */
  const comPedra = (luz: (x: number, y: number) => number, z?: number): Textura => {
    const grao = z === undefined ? daPedra : graoNaAltura(daPedra, z)
    return banhada((u, v, x, y, p, s, escala) => {
      if (grao !== null) grao(u, v, x, y, p, s, escala)
      s[3] += luz(x, y)
    }, fontes)
  }
  const lasca = (cr: Cristal, semente: number, tom: number) => ({ forma: lascaDeRocha(cr, semente), o: { tabua: 0, bisel: 0.7, tom, contorno: 0.24, textura: banhada(daPedra, fontes), semente: semente + 40 } })

  // ---------- no chão: o halo do ninho do pé, as lascas de rocha e a sombra curta dos cristais ----------
  const halo = (x: number, y: number, r: number, alfa: number, semente: number): void => {
    L.push(P(elipse(x, y, r, r), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(x, y, r, r, alfa), semente }))
  }
  halo(pex - 2, pey + 2, NINHO_DO_PE.raio * 2.1, 0.36, SEMENTE + 10)
  doPe.forEach((cr, k) => {
    cena.sombras.push({ forma: sombraDoCristal(cr, q), z: 0, forca: 0.22, suave: 1 })
    const pedaco = lasca(cr, SEMENTE + 20 + k, 0.78 + 0.14 * hash(k, 0, SEMENTE))
    L.push(P(pedaco.forma, pedra, pedaco.o))
  })

  // ---------- o BASAMENTO: as lajes (o piso) e a beira, com a quina do pé rebentada ----------
  const qp = QUINA.pe
  const base = poligono([[bx0, by0], [bx1, by0], [bx1, by1], [bx0 + qp, by1], [bx0 + qp * 0.62, by1 - qp * 0.36], [bx0 + qp * 0.3, by1 - qp * 0.52], [bx0, by1 - qp]])
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
  const qt = QUINA.tampa
  const tampa = poligono([[tx0, ty0], [tx1 - qt, ty0], [tx1 - qt * 0.7, ty0 + qt * 0.2], [tx1 - qt * 0.56, ty0 + qt * 0.52], [tx1 - qt * 0.24, ty0 + qt * 0.62], [tx1, ty0 + qt], [tx1, ty1], [tx0, ty1]])
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
  // O painel também perdeu a quina de trás: a trinca passou por ele.
  const cantoDoPainel = qt * 0.86
  const contornoDoPainel = (dx: number, dy: number): Forma => poligono([[px0 + dx, py0 + dy], [px1 - cantoDoPainel + dx, py0 + dy], [px1 + dx, py0 + cantoDoPainel + dy], [px1 + dx, py1 + dy], [px0 + dx, py1 + dy]])
  const painel = contornoDoPainel(0, 0)
  f.fatia(1, zTopo + 0.05, dentroDe(contornoDoPainel(sx * 3.4, sy * 3.4), tampa), SOMBRA_PINTADA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.22, suave: 0.8, semente: SEMENTE + 140 })
  f.fatia(2, zTopo + 0.1, painel, pedra, { tabua: 0, bisel: 1.6, tom: 1.06, contorno: 0.24, textura: comPedra(() => 0), semente: SEMENTE + 141 })

  // A GUIRLANDA na cabeceira: o anel de folhas e a fita embaixo.
  const gy = py0 + (px1 - px0) * 0.46
  const rG = (px1 - px0) * 0.28
  const gx = -rG * 0.16
  const esculpido = { tabua: 0, bisel: 0.5, contorno: 0.16 }
  f.fatia(3, zTopo + 0.2, anel(gx, gy, rG, rG, rG * 0.62, rG * 0.62), pedra, { ...esculpido, tom: 0.9, recesso: { k: 0.8, forca: 0.22 }, textura: comPedra(() => 0), semente: SEMENTE + 150 })
  const folhas = 14
  for (let k = 0; k < folhas; k += 1) {
    const a = (k / folhas) * 2 * Math.PI
    f.fatia(4, zTopo + 0.3, elipseGirada(gx + Math.cos(a) * rG * 0.81, gy + Math.sin(a) * rG * 0.81, rG * 0.2, rG * 0.09, a + 0.7), pedra, { ...esculpido, tom: 1.1, textura: comPedra(() => 0), semente: SEMENTE + 151 + k })
  }
  f.fatia(3, zTopo + 0.2, poligono([[gx - 1.2, gy + rG * 0.9], [gx - rG * 0.55, gy + rG * 1.45], [gx - rG * 0.3, gy + rG * 1.5], [gx, gy + rG * 1.05], [gx + rG * 0.3, gy + rG * 1.5], [gx + rG * 0.55, gy + rG * 1.45], [gx + 1.2, gy + rG * 0.9]]), pedra, { ...esculpido, tom: 1.02, semente: SEMENTE + 170 })

  // O EPITÁFIO gasto: três linhas rebaixadas, de comprimentos diferentes.
  const yTexto = (py0 + py1) / 2 + (py1 - py0) * 0.08
  ;[0.62, 0.78, 0.46].forEach((fracao, k) => {
    const meia = ((px1 - px0) / 2) * fracao
    f.fatia(3, zTopo + 0.2, caixa(-meia, yTexto + k * 4.2 - 0.55, meia, yTexto + k * 4.2 + 0.55, 0.4), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, recesso: { k: 0.8, forca: 0.3 }, semente: SEMENTE + 171 + k })
  })

  // As TRINCAS que saem da quina rebentada: o escuro da fenda e, por dentro, o FIO DE LUZ fria, que apaga longe dela.
  const trincas: readonly (readonly Ponto[])[] = [
    [[tx1 - qt * 0.5, ty0 + qt * 0.56], [tx1 - 8.8, ty0 + 12.4], [tx1 - 7.2, ty0 + 19], [tx1 - 12.8, ty0 + 26], [tx1 - 11, ty0 + 33], [tx1 - 15.4, ty0 + 39]],
    [[tx1 - qt * 0.68, ty0 + qt * 0.3], [tx1 - 15, ty0 + 5.4], [tx1 - 21.6, ty0 + 3.2], [tx1 - 28, ty0 + 6.4], [tx1 - 33, ty0 + 4.6]],
    [[tx1 - 8.8, ty0 + 12.4], [tx1 - 15, ty0 + 14.8], [tx1 - 18.4, ty0 + 19.6]],
  ]
  const fioAceso: Textura = (_u, _v, x, y, _p, s) => {
    const d = Math.hypot(x - qx, y - qy) / TRINCA.alcance
    s[0] = CIANO.claro[0]
    s[1] = CIANO.claro[1]
    s[2] = CIANO.claro[2]
    s[4] = 1
    s[5] = d >= 1 ? 0 : 0.95 * (1 - d * d)
  }
  trincas.forEach((pontos, k) => {
    // A trinca afina da quina para a ponta: cada trecho é um pouco mais fino que o de antes (o galho já nasce fino).
    for (let i = 1; i < pontos.length; i += 1) {
      const fina = (k === 2 ? 0.66 : 1) * (1 - (1 - TRINCA.afina) * ((i - 1) / Math.max(1, pontos.length - 2)))
      const trecho = [pontos[i - 1], pontos[i]]
      f.fatia(5, zTopo + 0.4, dentroDe(cadeia(trecho, TRINCA.escuro * fina), tampa), pedra, { tabua: 0, bisel: 0, tom: 0.4, contorno: 0, semente: SEMENTE + 180 + k })
      f.fatia(6, zTopo + 0.45, dentroDe(cadeia(trecho, TRINCA.fio * fina), tampa), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: fioAceso, semente: SEMENTE + 184 + k })
    }
  })

  // O MUSGO nas quinas da tampa e no pé do basamento: preso à peça em que cresce.
  f.fatia(5, zTopo + 0.4, musgoPreso(elipseGirada(tx0 + 3.4, ty0 + 4, 3.6, 2.2, 0.6), tampa), MUSGO_DA_CRIPTA, { ...MUSGO, alfa: 0.55, semente: SEMENTE + 190 })
  f.fatia(5, zTopo + 0.4, musgoPreso(elipseGirada(tx1 - 3.2, ty1 - 3.4, 4.2, 2, -0.4), tampa), MUSGO_DA_CRIPTA, { ...MUSGO, alfa: 0.55, semente: SEMENTE + 191 })
  f.fatia(1, zBase + 0.2, musgoPreso(elipse(bx1 - 3.6, by1 - 2.8, 3.2, 1.8), menos(base, arca)), MUSGO_DA_CRIPTA, { ...MUSGO, semente: SEMENTE + 192 })

  // ---------- os CRISTAIS: os do pé (no chão e na quina rebentada do basamento) e os da quina da tampa ----------
  doPe.forEach((cr, k) => fatiarCristal(f, 0, 0.4, cr, SEMENTE + 200 + k))
  daTampa.forEach((cr, k) => {
    const pedaco = lasca(cr, SEMENTE + 250 + k, 0.86)
    f.fatia(6, zTopo + 0.5, pedaco.forma, pedra, { ...pedaco.o, bisel: 0.6, contorno: 0.22 })
    // O pé fica dentro da tampa: o cristal sai da fenda, não está pousado nela.
    fatiarCristal(f, 7, zTopo - NINHO_DA_TAMPA.afundado, cr, SEMENTE + 260 + k)
  })
  f.fechar()

  // ---------- as sombras no chão: a do túmulo (varrida até o alto da tampa), a do basamento e o contato ----------
  cena.sombras.push(sombraVarrida(tx0, ty0, tx1, ty1, zTopo, q, 0.26, 2.2), sombraNoAr(base, zBase, q, 0.2, 1.1), contato(base, 0.3))
}
