/**
 * RELICÁRIO DE CRISTAL (lote L06 de 24/11/2026, item 52, da sala noroeste da cripta do mapa 8; desenho próprio, só a
 * ideia do objeto). A ARCA BAIXA de pedra sobre o plinto, com um pilarete de ponta de diamante em cada quina e a
 * arcada cega entalhada na frente; a TAMPA é uma laje de CRISTAL ciano lapidada em mesa (o chanfro em volta e a mesa
 * chata em cima), presa por duas dobradiças e um fecho de ferro. O cristal BRILHA POR DENTRO: o miolo da mesa é quase
 * branco, a moldura de pedra em volta pega a luz fria e, através dele, se adivinha a reliquia (o vulto de um crânio
 * e de um osso comprido). A luz de verdade é a do integrador (`LUZ_DOS_OBJETOS`).
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): a 3/4 mostra a arcada da frente, o chanfro do cristal
 * de frente e os pilaretes. Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`. Material: `pedra`; o cristal e o
 * ferro são fixos. A frente (o fecho) é o lado de baixo da pegada.
 */
import { limitar01 } from '../../ruido'
import { caixa, capsula, dentroDe, elipse, elipseGirada, uniao, type Forma } from './formas'
import { contato, texturaDaClasse, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'
import { alturas, novoFatiador, sombraNoAr } from './pilhaDeFatias'
import { ESCURO_DA_PEDRA, lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'
import { banhada, CIANO, CRISTAL, graoNaAltura, texHaloFrio, tomDoCristal, type FonteFria } from './pedestalComCristal'

/** As alturas (casas): o plinto, o corpo da arca, os pilaretes e o alto da mesa de cristal. */
const Z = { plinto: 0.05, corpo: 0.35, pilarete: 0.43, mesa: 0.45 } as const
/** O corpo recua do plinto, a moldura de pedra em volta do cristal e o lado do pilarete (px). */
const RECUO = 2.4
const MOLDURA = 4.2
const PILARETE = 5.4
/** Quanto o chanfro do cristal entra por px de altura. */
const TALUDE = 0.95
const PASSO = 0.8
/** A arcada cega da frente: os vãos por casa de largura, a meia largura do vão e a sobra em cima e embaixo (px). */
const VAOS_POR_CASA = 5
const MEIO_VAO = 0.3
const SOBRA_DA_ARCADA = 3
const SEMENTE = 5200

const FERRO = materialDaPeca('ferro')

/** O lado da caixa mais perto do ponto: a normal dele e a posição ao longo, em `saida` (nx, ny, u, meia). */
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

export const montarRelicarioDeCristal: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const daPedra = texturaDaClasse(pedra.classe)
  cena.corDoPiso = ESCURO_DA_PEDRA
  const [zPlinto, zCorpo, zPilarete, zMesa] = [g * Z.plinto, g * Z.corpo, g * Z.pilarete, g * Z.mesa]

  // As caixas, de cima: o plinto, o corpo, a base do cristal e a mesa dele.
  const [ex0, ey0, ex1, ey1] = [-hw + 0.5, -hh + 0.5, hw - 0.5, hh - 0.5]
  const [bx0, by0, bx1, by1] = [ex0 + RECUO, ey0 + RECUO, ex1 - RECUO, ey1 - RECUO]
  const [cx0, cy0, cx1, cy1] = [bx0 + MOLDURA, by0 + MOLDURA, bx1 - MOLDURA, by1 - MOLDURA]
  const entra = (zMesa - zCorpo) * TALUDE
  const [mx0, my0, mx1, my1] = [cx0 + entra, cy0 + entra, cx1 - entra, cy1 - entra]
  const [meiaMesaX, meiaMesaY] = [(mx1 - mx0) / 2, (my1 - my0) / 2]

  // A luz que sai do cristal: duas fontes ao comprido dele.
  const fontes: FonteFria[] = [-0.42, 0.42].map((k) => ({ x: k * (cx1 - cx0), y: 0, r: (cy1 - cy0) * 0.78, forca: 0.34 }))
  const comPedra = (luz: (x: number, y: number) => number, z?: number): Textura => {
    const grao = z === undefined ? daPedra : graoNaAltura(daPedra, z)
    return banhada((u, v, x, y, p, s, escala) => {
      if (grao !== null) grao(u, v, x, y, p, s, escala)
      s[3] += luz(x, y)
    }, fontes)
  }

  // No chão: o halo frio em volta da arca.
  const [rhx, rhy] = [hw * 1.2, hh * 1.26]
  L.push(P(elipse(0, 0, rhx, rhy), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, 0, rhx, rhy, 0.3), semente: SEMENTE }))

  // ---------- o PLINTO ----------
  const plinto = caixa(ex0, ey0, ex1, ey1, 0.8)
  const beira = (x0: number, y0: number, x1: number, y1: number, z: number, mais = 0): Textura =>
    comPedra((x, y) => {
      ladoDaCaixa(x, y, x0, y0, x1, y1, LADO)
      return luzDaNormal(LADO[0], LADO[1], 0, q) - 0.04 + mais
    }, z)
  for (const z of alturas(0, zPlinto, PASSO)) {
    const topo = z >= zPlinto - 1e-6
    f.fatia(0, z, plinto, pedra, topo ? { tabua: 0, bisel: 0.8, tom: 0.8, contorno: 0.26, textura: comPedra(() => 0), semente: SEMENTE + 1 } : lisa(0.68, beira(ex0, ey0, ex1, ey1, z), SEMENTE + 2))
  }

  // ---------- o CORPO da arca: a arcada cega na frente e nos lados, a cornija em cima ----------
  const corpo = caixa(bx0, by0, bx1, by1, 0.6)
  const zPe = zPlinto + SOBRA_DA_ARCADA
  const zArco = zCorpo - SOBRA_DA_ARCADA - 1.2
  const faceDoCorpo = (z: number): Textura =>
    comPedra((x, y) => {
      ladoDaCaixa(x, y, bx0, by0, bx1, by1, LADO)
      const u = LADO[2]
      const meia = LADO[3]
      let luz = luzDaNormal(LADO[0], LADO[1], 0, q) - 0.04
      // A cornija: o filete claro no alto e a gola na sombra logo abaixo.
      if (z > zCorpo - 1.4) return luz + 0.07
      if (z > zCorpo - 2.6) return luz - 0.13
      if (z < zPlinto + 1.1) return luz - 0.07
      // A arcada: vãos de arco pleno, rebaixados e escuros, entre as quinas (os pilaretes).
      const util = meia - PILARETE
      if (Math.abs(u) > util) return luz
      const vaos = Math.max(1, Math.round(((2 * util) / g) * VAOS_POR_CASA))
      const largura = (2 * util) / vaos
      const du = ((((u + util) / largura) % 1) + 1) % 1 - 0.5
      const meioVao = largura * MEIO_VAO
      const dx = Math.abs(du) * largura
      // O alto do vão: reto até a imposta, depois o arco.
      const imposta = zArco - meioVao
      const fora = z < imposta ? dx - meioVao : Math.hypot(dx, z - imposta) - meioVao
      if (z < zPe || fora > 0.5) return luz
      if (fora > -0.5) return luz - 0.1
      // Dentro do vão: fundo na sombra, mais escuro em cima (o arco faz sombra) e do lado da luz.
      return luz - 0.2 - 0.1 * limitar01((z - imposta + meioVao) / (2 * meioVao)) + 0.05 * du
    }, z)
  for (const z of alturas(zPlinto, zCorpo, PASSO)) {
    const topo = z >= zCorpo - 1e-6
    // A moldura de pedra em volta do cristal: o filete gravado e a junta do meio de cada lado.
    const moldura = comPedra((x, y) => {
      const dentro = Math.min(x - bx0, bx1 - x, y - by0, by1 - y)
      let luz = Math.abs(dentro - 1.5) < 0.38 ? -0.2 : 0
      if (dentro < MOLDURA && (Math.abs(x) < 0.36 || Math.abs(y) < 0.36)) luz -= 0.2
      return luz
    })
    f.fatia(0, z, corpo, pedra, topo ? { tabua: 0, bisel: 1, tom: 0.98, contorno: 0.28, textura: moldura, semente: SEMENTE + 10 } : lisa(0.82, faceDoCorpo(z), SEMENTE + 11))
  }

  // ---------- os PILARETES das quinas, com a ponta de diamante ----------
  const quinas: readonly (readonly [number, number])[] = [[bx0 - 0.7, by0 - 0.7], [bx1 + 0.7 - PILARETE, by0 - 0.7], [bx0 - 0.7, by1 + 0.7 - PILARETE], [bx1 + 0.7 - PILARETE, by1 + 0.7 - PILARETE]]
  quinas.forEach(([x0, y0], i) => {
    const [x1, y1] = [x0 + PILARETE, y0 + PILARETE]
    const [px, py] = [(x0 + x1) / 2, (y0 + y1) / 2]
    for (const z of alturas(zPlinto, zCorpo + 0.6, PASSO)) f.fatia(1, z, caixa(x0, y0, x1, y1, 0.5), pedra, lisa(0.86, beira(x0, y0, x1, y1, z, z > zCorpo - 1 ? 0.06 : 0), SEMENTE + 20 + i))
    // A ponta de diamante: a pirâmide de quatro faces, cada uma com a luz dela.
    for (const z of alturas(zCorpo + 0.6, zPilarete, 0.5)) {
      const t = (z - zCorpo - 0.6) / (zPilarete - zCorpo - 0.6)
      const m = (PILARETE / 2 - 0.3) * (1 - t * 0.86)
      const faces = comPedra((x, y) => {
        const [dx, dy] = [x - px, y - py]
        return (Math.abs(dx) > Math.abs(dy) ? luzDaNormal(Math.sign(dx), 0, 0.6, q) : luzDaNormal(0, Math.sign(dy), 0.6, q)) * 1.7 + 0.04
      }, z)
      f.fatia(1, z, caixa(px - m, py - m, px + m, py + m, 0.2), pedra, lisa(1, faces, SEMENTE + 30 + i))
    }
  })

  // ---------- as ferragens: as duas dobradiças atrás e o fecho na frente (assentam na moldura) ----------
  const ferragem = { tabua: 0, bisel: 0.6, tom: 0.92, metal: 0.3, contorno: 0.3 }
  for (const lado of [-1, 1]) {
    const hx = lado * (cx1 - cx0) * 0.27
    f.fatia(2, zCorpo + 0.4, caixa(hx - 3.2, by0 + 0.6, hx + 3.2, cy0 + 1.6, 0.5), FERRO, { ...ferragem, semente: SEMENTE + 40 })
    f.fatia(3, zCorpo + 0.9, capsula(hx - 2.6, by0 + 2.2, hx + 2.6, by0 + 2.2, 0.85), FERRO, { ...ferragem, bisel: 0.8, tom: 1.1, metal: 0.45, semente: SEMENTE + 41 })
  }
  f.fatia(2, zCorpo + 0.4, caixa(-3.4, cy1 - 1.8, 3.4, by1 - 0.5, 0.5), FERRO, { ...ferragem, semente: SEMENTE + 42 })
  f.fatia(3, zCorpo + 0.9, elipse(0, by1 - 2.4, 1.25, 1.25), FERRO, { ...ferragem, bisel: 1, tom: 1.16, metal: 0.5, semente: SEMENTE + 43 })

  // ---------- a TAMPA DE CRISTAL: o chanfro em fatias e a mesa ----------
  // A reliquia vista através do cristal: o crânio (com a mandíbula) e o osso comprido ao lado.
  const [rx, ry] = [-meiaMesaX * 0.3, 0]
  const cranio = uniao(elipse(rx, ry - 0.6, 4, 4.3), caixa(rx - 2.3, ry + 1.6, rx + 2.3, ry + 5, 1.2))
  const orbitas = uniao(elipse(rx - 1.55, ry - 0.2, 1.05, 1.2), elipse(rx + 1.55, ry - 0.2, 1.05, 1.2))
  const [o1x, o1y, o2x, o2y] = [meiaMesaX * 0.12, meiaMesaY * 0.58, meiaMesaX * 0.82, -meiaMesaY * 0.5]
  const osso: Forma = uniao(capsula(o1x, o1y, o2x, o2y, 0.85), uniao(uniao(elipseGirada(o1x - 0.2, o1y + 0.9, 1.5, 1.15, 0.4), elipseGirada(o1x - 0.9, o1y - 0.5, 1.4, 1.1, -0.6)), uniao(elipseGirada(o2x + 0.2, o2y - 0.9, 1.5, 1.15, 0.4), elipseGirada(o2x + 0.9, o2y + 0.5, 1.4, 1.1, -0.6))))
  const reliquia = uniao(cranio, osso)
  const veios: readonly Forma[] = [capsula(mx0 + 2, my1 - 1.5, mx0 + meiaMesaX * 0.9, my0 + 1, 0.1), capsula(mx1 - 3, my1 - 1, mx1 - meiaMesaX * 0.5, my0 + 2.4, 0.1), capsula(mx0 + meiaMesaX * 0.9, my0 + 1, mx1 - 4, my0 + 5, 0.1)]
  const mesa: Textura = (_u, _v, x, y, _p, s) => {
    const d2 = (x / meiaMesaX) * (x / meiaMesaX) * 0.62 + (y / meiaMesaY) * (y / meiaMesaY) * 0.62
    // A luz de dentro: mais forte no miolo, com o brilho quase branco no meio.
    const cor = tomDoCristal(0.62 + 0.38 * (1 - limitar01(d2)))
    let [r, gr, b] = cor
    const miolo = 0.6 * Math.exp(-d2 * 4.2)
    r += (CIANO.reflexo[0] - r) * miolo
    gr += (CIANO.reflexo[1] - gr) * miolo
    b += (CIANO.reflexo[2] - b) * miolo
    // O vulto da reliquia lá dentro (as órbitas deixam a luz passar) e os veios do cristal.
    const vulto = 0.3 * limitar01(0.5 - reliquia.d(x, y) / 2.6) * (1 - limitar01(0.5 - orbitas.d(x, y) / 1.2))
    r += (CIANO.fundo[0] - r) * vulto
    gr += (CIANO.fundo[1] - gr) * vulto
    b += (CIANO.fundo[2] - b) * vulto
    let veio = 0
    for (const v of veios) veio = Math.max(veio, limitar01(1 - v.d(x, y) / 0.5))
    const fio = 0.4 * veio
    s[0] = r + (CIANO.reflexo[0] - r) * fio
    s[1] = gr + (CIANO.reflexo[1] - gr) * fio
    s[2] = b + (CIANO.reflexo[2] - b) * fio
    s[4] = 0.75
  }
  const chanfro = (t: number): Textura => (_u, _v, x, y, _p, s) => {
    ladoDaCaixa(x, y, cx0, cy0, cx1, cy1, LADO)
    // Cada face do chanfro com a luz dela; a quina entre duas faces leva o fio de reflexo.
    const cor = tomDoCristal(0.5 + luzDaNormal(LADO[0], LADO[1], 0.7, q) * 4.6 + 0.12 * t)
    const naQuina = Math.abs(Math.min(x - cx0, cx1 - x) - Math.min(y - cy0, cy1 - y))
    const fio = naQuina < 0.5 ? 0.5 * (1 - naQuina / 0.5) : 0
    s[0] = cor[0] + (CIANO.reflexo[0] - cor[0]) * fio
    s[1] = cor[1] + (CIANO.reflexo[1] - cor[1]) * fio
    s[2] = cor[2] + (CIANO.reflexo[2] - cor[2]) * fio
    s[4] = 0.55
  }
  for (const z of alturas(zCorpo + 0.3, zMesa, 0.3)) {
    const t = (z - zCorpo) / (zMesa - zCorpo)
    const e = entra * t
    const topo = z >= zMesa - 1e-6
    f.fatia(4, z, caixa(cx0 + e, cy0 + e, cx1 - e, cy1 - e, 0.7), CRISTAL, topo ? { tabua: 0, bisel: 0.5, contorno: 0.12, textura: mesa, semente: SEMENTE + 50 } : lisa(1, chanfro(t), SEMENTE + 51))
  }
  // O reflexo da janela na mesa: duas riscas claras em diagonal, do lado da luz.
  for (const [k, largura] of [[0, 1.5], [1, 0.7]] as const) {
    const [ax, ay] = [mx0 + 2.4 + k * 4, my0 + meiaMesaY * 0.95]
    f.fatia(5, zMesa + 0.1 + k * 0.02, dentroDe(capsula(ax, ay, ax + meiaMesaY * 0.8, my0 + 1.4, largura / 2), caixa(mx0 + 0.8, my0 + 0.8, mx1 - 0.8, my1 - 0.8)), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.38 - k * 0.1, suave: 0.4, textura: (_u, _v, _x, _y, _p, s) => {
      s[0] = CIANO.reflexo[0]
      s[1] = CIANO.reflexo[1]
      s[2] = CIANO.reflexo[2]
      s[4] = 1
    }, semente: SEMENTE + 60 + k })
  }
  f.fechar()

  // As sombras no chão: a da arca (varrida até o alto), a do plinto e o contato.
  cena.sombras.push(sombraVarrida(bx0, by0, bx1, by1, zCorpo, q, 0.24, 1.8), sombraNoAr(plinto, zPlinto, q, 0.2, 1), contato(plinto, 0.3))
}
