/**
 * RELICÁRIO DE CRISTAL (lote L06 de 24/11/2026, item 52, da sala noroeste da cripta do mapa 8; desenho próprio, só a
 * ideia do objeto). A ARCA BAIXA de pedra sobre o plinto, com um pilarete de ponta de diamante em cada quina e a
 * arcada cega entalhada na frente: ela é o corpo. Em cima, a MOLDURA larga de pedra (22% de cada lado) e, no
 * meio dela, a TAMPA de CRISTAL ciano, uma pedra LAPIDADA: o chanfro em quatro facetas de tons bem diferentes (a de
 * cima e a da esquerda claras, a da direita e a de baixo dois degraus mais escuras) e a mesa pequena. O cristal é
 * pedra, não vidro de tela: tem menos saturação, véu por dentro, duas fraturas finas e o brilho quase branco só no
 * miolo. Contra esse brilho se recorta a RELÍQUIA: um crânio escuro e frio, de dois furos fundos no lugar dos olhos
 * (sem cara), com um osso cruzado embaixo. A luz de verdade é a do integrador (`LUZ_DOS_OBJETOS`).
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): a 3/4 mostra a arcada da frente, os pilaretes e a
 * tampa baixa (18% da altura: é tampa, não aquário). Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`. Material:
 * `pedra`; o cristal e o ferro são fixos. A frente (o fecho) é o lado de baixo da pegada.
 *
 * Revisão do diretor de arte (24/11/2026): de cima lia como tela ou monitor, e o vulto do crânio como um rostinho
 * sorrindo. A moldura engrossou, o cristal foi lapidado, a relíquia virou silhueta e a tampa baixou.
 */
import { limitar01, misturar, type Rgb } from '../../ruido'
import { cadeia, caixa, capsula, dentroDe, elipse, elipseGirada, uniao, type Forma } from './formas'
import { contato, ruido, texturaDaClasse, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'
import { alturas, naTela, novoFatiador, sombraNoAr } from './pilhaDeFatias'
import { ESCURO_DA_PEDRA, lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'
import { banhada, CIANO, corAcesa, CRISTAL, graoNaAltura, texHaloFrio, tomDaLapidacao, type FonteFria } from './pedestalComCristal'

/** As alturas (casas): o plinto, o corpo da arca, os pilaretes e o alto da mesa de cristal (a tampa tem 18% do total). */
const Z = { plinto: 0.05, corpo: 0.37, pilarete: 0.445, mesa: 0.45 } as const
/** O corpo recua do plinto (px), a moldura de pedra em volta do cristal (fração de cada lado da tampa) e o lado do pilarete (px). */
const RECUO = 2.4
const MOLDURA = 0.22
const PILARETE = 5.4
/** O chanfro do cristal, visto de cima (px): a mesa fica com uns 45% da largura da tampa. */
const CHANFRO = 2.8
const PASSO = 0.8
/** A arcada cega da frente: os vãos por casa de largura, a meia largura do vão e a sobra em cima e embaixo (px). */
const VAOS_POR_CASA = 5
const MEIO_VAO = 0.3
const SOBRA_DA_ARCADA = 3
/** Quanto o ciano da tampa perde de saturação: pedra lapidada, não tela acesa. */
const DESSATURA = 0.3
/**
 * O tom de cada faceta do chanfro pelo lado para onde ela olha NA TELA: a da esquerda e a de cima claras, a da
 * direita e a de baixo dois degraus da rampa mais escuras.
 */
const TOM_DA_FACETA = { esquerda: 0.96, cima: 0.8, direita: 0.3, baixo: 0.14 } as const
/** A mesa: o tom dela e o MIOLO aceso (o raio, em fração da meia mesa, e a força no meio). */
const TOM_DA_MESA = 0.5
const VEU_DA_MESA = 0.15
const MIOLO = { raio: 0.5, forca: 0.9 } as const
/** A relíquia: a altura do crânio em fração da altura da mesa, o frio escuro do vulto e o dos furos dos olhos. */
const CRANIO = 0.35
const VULTO: Rgb = [0x2b, 0x47, 0x54]
const FURO: Rgb = [0x14, 0x23, 0x2c]
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
  const [molduraX, molduraY] = [(bx1 - bx0) * MOLDURA, (by1 - by0) * MOLDURA]
  const [cx0, cy0, cx1, cy1] = [bx0 + molduraX, by0 + molduraY, bx1 - molduraX, by1 - molduraY]
  const [mx0, my0, mx1, my1] = [cx0 + CHANFRO, cy0 + CHANFRO, cx1 - CHANFRO, cy1 - CHANFRO]
  const [meiaMesaX, meiaMesaY] = [(mx1 - mx0) / 2, (my1 - my0) / 2]

  // A luz que sai do cristal para a moldura: duas fontes ao comprido dele.
  const fontes: FonteFria[] = [-0.3, 0.3].map((k) => ({ x: k * (cx1 - cx0), y: 0, r: (cy1 - cy0) * 0.72, forca: 0.26 }))
  const comPedra = (luz: (x: number, y: number) => number, z?: number): Textura => {
    const grao = z === undefined ? daPedra : graoNaAltura(daPedra, z)
    return banhada((u, v, x, y, p, s, escala) => {
      if (grao !== null) grao(u, v, x, y, p, s, escala)
      s[3] += luz(x, y)
    }, fontes)
  }

  // No chão: o halo frio em volta da arca.
  const [rhx, rhy] = [hw * 1.16, hh * 1.2]
  L.push(P(elipse(0, 0, rhx, rhy), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, 0, rhx, rhy, 0.24), semente: SEMENTE }))

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
  // A MOLDURA larga de pedra em volta do cristal: o filete gravado junto da beira, o rebaixo junto do cristal (a
  // pedra desce um degrau até ele) e a junta do meio de cada lado.
  const moldura = comPedra((x, y) => {
    const daBeira = Math.min(x - bx0, bx1 - x, y - by0, by1 - y)
    const doCristal = Math.max(cx0 - x, x - cx1, cy0 - y, y - cy1)
    let luz = Math.abs(daBeira - 1.7) < 0.38 ? -0.2 : 0
    if (doCristal > 0 && doCristal < 1.5) luz -= 0.16 * (1 - doCristal / 1.5)
    if (doCristal > 0 && (Math.abs(x) < 0.36 || Math.abs(y) < 0.36)) luz -= 0.18
    return luz + 0.05 * ruido(x * 0.3 + 5, y * 0.3)
  })
  for (const z of alturas(zPlinto, zCorpo, PASSO)) {
    const topo = z >= zCorpo - 1e-6
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
    f.fatia(2, zCorpo + 0.4, caixa(hx - 2.6, by0 + 1.2, hx + 2.6, cy0 + 1.2, 0.5), FERRO, { ...ferragem, semente: SEMENTE + 40 })
    f.fatia(3, zCorpo + 0.9, capsula(hx - 2.2, by0 + 2.8, hx + 2.2, by0 + 2.8, 0.85), FERRO, { ...ferragem, bisel: 0.8, tom: 1.1, metal: 0.45, semente: SEMENTE + 41 })
  }
  f.fatia(2, zCorpo + 0.4, caixa(-3, cy1 - 1.2, 3, by1 - 1, 0.5), FERRO, { ...ferragem, semente: SEMENTE + 42 })
  f.fatia(3, zCorpo + 0.9, elipse(0, by1 - 3.2, 1.25, 1.25), FERRO, { ...ferragem, bisel: 1, tom: 1.16, metal: 0.5, semente: SEMENTE + 43 })

  // ---------- a TAMPA DE CRISTAL: o chanfro lapidado em quatro facetas e a mesa ----------
  // A relíquia vista através do cristal: o crânio (com a maxila) e, embaixo dele, um osso cruzado.
  const altoDoCranio = (my1 - my0) * CRANIO
  const [rx, ry] = [0, -altoDoCranio * 0.3]
  const calota = altoDoCranio * 0.4
  const cranio = uniao(elipse(rx, ry, calota * 1.04, calota), caixa(rx - calota * 0.56, ry + calota * 0.4, rx + calota * 0.56, ry + altoDoCranio - calota, calota * 0.3))
  const olho = calota * 0.27
  const furos = uniao(elipse(rx - calota * 0.42, ry + calota * 0.16, olho, olho * 1.1), elipse(rx + calota * 0.42, ry + calota * 0.16, olho, olho * 1.1))
  const yDoOsso = ry + altoDoCranio * 0.98
  const [o1x, o1y, o2x, o2y] = [-altoDoCranio * 1.15, yDoOsso + altoDoCranio * 0.3, altoDoCranio * 1.15, yDoOsso - altoDoCranio * 0.16]
  const condilo = altoDoCranio * 0.17
  const osso: Forma = uniao(
    capsula(o1x, o1y, o2x, o2y, altoDoCranio * 0.11),
    uniao(uniao(elipseGirada(o1x - 0.2, o1y - condilo * 0.8, condilo, condilo * 0.8, 0.5), elipseGirada(o1x - 0.2, o1y + condilo * 0.8, condilo, condilo * 0.8, -0.5)), uniao(elipseGirada(o2x + 0.2, o2y - condilo * 0.8, condilo, condilo * 0.8, -0.5), elipseGirada(o2x + 0.2, o2y + condilo * 0.8, condilo, condilo * 0.8, 0.5))),
  )
  const reliquia = uniao(cranio, osso)
  // As fraturas finas de dentro da pedra: uma comprida, quebrada em três trechos, que nasce na beira, e um galho
  // curto do outro lado. Tortas e desiguais: duas riscas retas em diagonal liam como reflexo de vidro de janela.
  const fraturas: readonly Forma[] = [
    cadeia([[mx0 + 0.6, my0 + meiaMesaY * 0.5], [mx0 + meiaMesaX * 0.34, my0 + meiaMesaY * 0.86], [mx0 + meiaMesaX * 0.4, my0 + meiaMesaY * 1.3], [mx0 + meiaMesaX * 0.72, my1 - 0.8]], 0.08),
    cadeia([[mx1 - 0.6, my0 + meiaMesaY * 1.24], [mx1 - meiaMesaX * 0.3, my0 + meiaMesaY * 1.04], [mx1 - meiaMesaX * 0.36, my0 + meiaMesaY * 0.6]], 0.08),
  ]
  const [raioX, raioY] = [meiaMesaX * MIOLO.raio, meiaMesaY * MIOLO.raio * 1.5]
  const mesa: Textura = (_u, _v, x, y, _p, s) => {
    // O véu de dentro (a pedra não é lisa) e o MIOLO aceso, só no meio: é contra ele que a relíquia se recorta.
    const veu = VEU_DA_MESA * (ruido(x * 0.2 + 11, y * 0.2 + 3) * 1.5 + ruido(x * 0.6 + 2, y * 0.6 + 9) * 0.6)
    const d2 = (x / raioX) * (x / raioX) + ((y - ry * 0.4) / raioY) * ((y - ry * 0.4) / raioY)
    const aceso = MIOLO.forca * Math.exp(-d2 * 1.5)
    let cor: Rgb = misturar(tomDaLapidacao(TOM_DA_MESA + veu + 0.3 * aceso, DESSATURA), CIANO.reflexo, aceso * 0.8)
    let fratura = 0
    for (const v of fraturas) fratura = Math.max(fratura, limitar01(1 - v.d(x, y) / 0.42))
    cor = misturar(cor, CIANO.reflexo, 0.3 * fratura)
    const vulto = 0.86 * limitar01(0.5 - reliquia.d(x, y) / 0.9)
    cor = misturar(cor, VULTO, vulto)
    const furo = limitar01(0.5 - furos.d(x, y) / 0.6)
    cor = misturar(cor, FURO, furo)
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 0.5 + 0.3 * aceso
  }
  const chanfro = (t: number): Textura => (_u, _v, x, y, _p, s) => {
    ladoDaCaixa(x, y, cx0, cy0, cx1, cy1, LADO)
    // Cada faceta com o tom do lado para onde olha NA TELA; a quina entre duas leva o fio de reflexo.
    const [sx, sy] = naTela(LADO[0], LADO[1], q)
    const tom = sx < -0.5 ? TOM_DA_FACETA.esquerda : sy < -0.5 ? TOM_DA_FACETA.cima : sx > 0.5 ? TOM_DA_FACETA.direita : TOM_DA_FACETA.baixo
    const veu = 0.07 * ruido(x * 0.3 + 4, y * 0.3 + 8)
    const cor = tomDaLapidacao(tom + veu + 0.1 * t, DESSATURA)
    const naQuina = Math.abs(Math.min(x - cx0, cx1 - x) - Math.min(y - cy0, cy1 - y))
    const fio = naQuina < 0.45 ? 0.5 * (1 - naQuina / 0.45) * limitar01(0.3 + tom) : 0
    s[0] = cor[0] + (CIANO.reflexo[0] - cor[0]) * fio
    s[1] = cor[1] + (CIANO.reflexo[1] - cor[1]) * fio
    s[2] = cor[2] + (CIANO.reflexo[2] - cor[2]) * fio
    s[4] = 0.4
  }
  for (const z of alturas(zCorpo + 0.3, zMesa, 0.3)) {
    const t = (z - zCorpo) / (zMesa - zCorpo)
    const e = CHANFRO * t
    const topo = z >= zMesa - 1e-6
    f.fatia(4, z, caixa(cx0 + e, cy0 + e, cx1 - e, cy1 - e, 0.5), CRISTAL, topo ? { tabua: 0, bisel: 0.4, contorno: 0.1, textura: mesa, semente: SEMENTE + 50 } : lisa(1, chanfro(t), SEMENTE + 51))
  }
  // O fio de reflexo na aresta da mesa, só do lado da luz (em cima e à esquerda NA TELA).
  const aresta = caixa(mx0, my0, mx1, my1, 0.5)
  const fioDaMesa: Forma = { b: aresta.b, d: (x, y) => Math.max(aresta.d(x, y), -aresta.d(x, y) - 0.5) }
  f.fatia(5, zMesa + 0.1, dentroDe(fioDaMesa, { b: aresta.b, d: (x, y) => {
    const [sx, sy] = naTela(x, y, q)
    return Math.min(sx / meiaMesaX, sy / meiaMesaY) + 0.5
  } }), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.6, textura: corAcesa(CIANO.reflexo, 1), semente: SEMENTE + 60 })
  f.fechar()

  // As sombras no chão: a da arca (varrida até o alto), a do plinto e o contato.
  cena.sombras.push(sombraVarrida(bx0, by0, bx1, by1, zCorpo, q, 0.24, 1.8), sombraNoAr(plinto, zPlinto, q, 0.2, 1), contato(plinto, 0.3))
}
