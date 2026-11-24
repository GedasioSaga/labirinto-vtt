/**
 * ARCOSSÓLIO (lote L06 de 24/11/2026, item 58: construção, dos quatro arcos do norte do grande salão da cripta do
 * mapa 8; desenho próprio, só a ideia do objeto). Um trecho de PAREDE de pedra com o NICHO EM ARCO: as ombreiras com
 * a imposta, a ARQUIVOLTA de aduelas com a chave (um cabochão de cristal engastado nela, com o seu halo) e, dentro, o
 * JAZIGO: a arca de três painéis sobre o degrau, de pedra mais clara que o muro, com a tampa de DUAS ÁGUAS e a
 * cumeeira clara. ATRÁS da arca nasceram dois NINHOS de cristal ciano, irregulares: o maior à esquerda (45% da
 * altura do vão) e um menor à direita; na frente dela, nada. O nicho é FUNDO: a abóbada fica quase preta azulada,
 * com a sombra do intradorso no fundo, e a luz fria só enche o terço de baixo. Barra a passagem e tapa a visão
 * (regra de fábrica da construção).
 *
 * DESENHADO DE FRENTE nas duas vistas (perfil `EM_PE`), como o nicho funerário e o columbário do lote L05: de cima, um
 * arco na parede é só o alto de um muro. A parede é a beira de cima da pegada; a luz de verdade é a do integrador
 * (`LUZ_DOS_OBJETOS`). Material: `pedra`; o cristal e o musgo são fixos.
 *
 * Revisão do diretor de arte (24/11/2026): lia como lareira de fogo azul. Os cristais eram espetos iguais em passo
 * fixo, na frente e atrás da arca (uma cerca), e o vão era um degradê ciano chapado, a maior área saturada da cena.
 */
import { hash, limitar01, misturar, type Rgb } from '../../ruido'
import { cadeia, caixa, dentroDe, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { ESCURO_DA_PEDRA } from './apoioDasReferencias'
import { banhada, CIANO, corAcesa, CRISTAL, LUZ_FRIA, MUSGO, MUSGO_DA_CRIPTA, musgoPreso, prismaDeitado, texHaloFrio, tomDoCristal, type FonteFria } from './pedestalComCristal'

/** A altura do muro em casas (a sombra comprida) e quanto ele sobe acima da pegada (o teto do plano é 0,2). */
const ALTURA = 1.2
const SUBIDA = 0.18
/** A faixa do alto que pega a luz, a cornija, o pé e a soleira (px). */
const TOPO = 3.6
const CORNIJA = 3
const PE = 2
const SOLEIRA = 6
/** O vão do arco: a meia largura (fração da meia largura do muro), a flecha e a nascente (px acima da soleira). */
const MEIO_VAO = 0.62
const FLECHA = 23
const NASCENTE = 17
/** A arquivolta (a grossura das aduelas, px) e quantas aduelas dão o arco (ímpar: a do meio é a chave). */
const ARQUIVOLTA = 6.4
const ADUELAS = 9
/**
 * O fundo do nicho, pintado cru (sem a luz do motor: ele levantaria o escuro para o cinza quente da pedra): a
 * ABÓBADA quase preta azulada, no escuro mais fundo que o piso de luz do motor deixa, e a parede do fundo, um tom
 * acima. Entre as duas, a sombra do intradorso. A luz fria só sobe até um terço do vão.
 */
const ABOBADA: Rgb = [0x36, 0x3e, 0x48]
const PAREDE_DO_FUNDO: Rgb = [0x4b, 0x56, 0x61]
const LUZ_ATE = 0.4
const LUZ_NO_PE = 0.66
/** A sombra do intradorso no fundo do nicho: quanto ela desce do arco e entra da ombreira (px) e a beira macia dela. */
const SOMBRA_DO_INTRADORSO = { desce: 9.5, entra: 4, beira: 3.4 } as const
/** O clarão atrás de cada ninho, no fundo do nicho: o raio (fração da altura do ninho) e o alfa. */
const CLARAO_DO_NINHO = { raio: 0.95, alfa: 0.5 } as const
/** A arca: quanto ela recua das ombreiras (px, para os ninhos caberem atrás dela), o degrau, o corpo e a tampa (px). */
const ARCA = { recuo: 12.5, degrau: 3.2, corpo: 8.4, tampa: 5.6 } as const
/**
 * Os dois NINHOS de trás. De cada prisma: o x a partir do meio do ninho (px), a altura (fração da altura do vão), a
 * meia largura (px) e quanto pende (graus; negativo = para a esquerda). O maior, à esquerda, tem 45% do vão.
 */
type Prisma = readonly [number, number, number, number]
const NINHO_DA_ESQUERDA: readonly Prisma[] = [
  [-4.6, 0.25, 1.8, -27],
  [5.2, 0.31, 2, 17],
  [8.4, 0.17, 1.4, 38],
  [0, 0.45, 2.7, -5],
  [-1.8, 0.15, 1.3, 24],
]
const NINHO_DA_DIREITA: readonly Prisma[] = [
  [-3.8, 0.19, 1.5, -24],
  [3.2, 0.14, 1.3, 31],
  [0.2, 0.28, 2.1, 8],
]
/** O cabochão da chave (as meias medidas do losango, px: 30% maior que o de antes) e o halo dele. */
const CABOCHAO = { larga: 2.2, alta: 3 } as const
const HALO_DO_CABOCHAO = { raio: 6.8, alfa: 0.44 } as const
const GRAUS = Math.PI / 180
const SEMENTE = 5800

/** A forma encolhida `d` px para dentro. */
function encolhida(f: Forma, d: number): Forma {
  return { b: f.b, d: (x, y) => f.d(x, y) + d }
}

/** A forma andada (dx, dy). */
function andada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

export const montarArcossolio: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  const daPedra = texturaDaClasse(pedra.classe)
  cena.corDoPiso = ESCURO_DA_PEDRA
  const x = hw - 2
  const yPe = hh - PE
  const ySoleira = yPe - SOLEIRA
  const yAlto = -hh - SUBIDA * g
  const yFace = yAlto + TOPO
  // O vão: reto até a nascente, em arco abatido dali para cima.
  const a = x * MEIO_VAO
  const yNascente = ySoleira - NASCENTE
  const b = Math.min(FLECHA, yNascente - yFace - CORNIJA - ARQUIVOLTA - 1.6)
  const altoDoVao = NASCENTE + b
  const meiaElipse = (rx: number, ry: number): Forma => dentroDe(elipse(0, yNascente, rx, ry), caixa(-rx - 1, yNascente - ry - 1, rx + 1, yNascente + 0.4))
  const vao = uniao(caixa(-a, yNascente, a, ySoleira), meiaElipse(a, b))
  /** O ponto do arco no ângulo `t` (0 = a nascente da direita, pi = a da esquerda), `fora` px para fora do intradorso. */
  const noArco = (t: number, fora: number): Ponto => [Math.cos(t) * (a + fora), yNascente - Math.sin(t) * (b + fora)]

  // Os dois ninhos, atrás da arca, e a luz deles na pedra de dentro do nicho.
  const [xEsquerda, xDireita] = [-a + 8.4, a - 6.4]
  const yDosNinhos = ySoleira - 1.6
  const fontes: FonteFria[] = [
    { x: xEsquerda, y: ySoleira - 7, r: 13, forca: 0.44 },
    { x: xDireita, y: ySoleira - 5, r: 10, forca: 0.36 },
  ]
  const naPedra = banhada(daPedra, fontes)
  const juntaDaPedra = { tabua: 0, bisel: 0, contorno: 0, tom: 0.6, alfa: 0.7 }

  // A sombra do muro e o contato no pé.
  cena.sombras.push({ forma: caixa(-x, yPe - 1.6, x, yPe, 0.6), z: g * ALTURA, forca: 0.3 }, contato(caixa(-x - 1.5, yPe - 1.2, x + 1.5, yPe + 1.2, 1), 0.34))

  // O MURO: o alto que pega a luz (atrás) e a face, com as juntas das fiadas dos lados e dos cantos de cima.
  L.push(P(caixa(-x, yAlto, x, yPe - TOPO, 0.6), pedra, { tabua: 0, bisel: 1, tom: 1.1, semente: SEMENTE }))
  L.push(P(caixa(-x, yFace, x, yPe, 0.6), pedra, { tabua: 0, bisel: 1.1, tom: 0.8, contorno: 0.3, semente: SEMENTE + 1 }))
  const xLado = a + ARQUIVOLTA + 1
  for (const lado of [-1, 1]) {
    ;[0.2, 0.52, 0.82].forEach((fy, k) => {
      const y = yFace + CORNIJA + (ySoleira - yFace - CORNIJA) * fy
      // Em cima da nascente a fiada vai só até a arquivolta.
      const ate = y < yNascente ? Math.max(xLado, Math.sqrt(Math.max(0, 1 - ((yNascente - y) / (b + ARQUIVOLTA)) ** 2)) * (a + ARQUIVOLTA) + 1) : xLado
      const [x0, x1] = lado < 0 ? [-x + 0.6, -ate] : [ate, x - 0.6]
      if (x1 - x0 > 2) L.push(P(caixa(x0, y - 0.3, x1, y + 0.3, 0.2), pedra, { ...juntaDaPedra, semente: SEMENTE + 2 + k }))
    })
    L.push(P(caixa(lado * (x - 7) - 0.3, yFace + CORNIJA + 0.6, lado * (x - 7) + 0.3, yFace + CORNIJA + (ySoleira - yFace - CORNIJA) * 0.2 - 0.6, 0.2), pedra, { ...juntaDaPedra, semente: SEMENTE + 5 }))
  }

  // ---------- dentro do nicho: o fundo escuro, a sombra do intradorso, a luz só no terço de baixo e o JAZIGO ----------
  // A parede do fundo com a SOMBRA DO INTRADORSO: o arco (e a ombreira do lado da luz) joga no fundo uma sombra que
  // desce e entra; nela o nicho vai ao escuro da abóbada. Para baixo a parede também clareia um nada.
  const naLuz = andada(vao, SOMBRA_DO_INTRADORSO.entra, SOMBRA_DO_INTRADORSO.desce)
  const fundoDoNicho: Textura = (_u, _v, px, py, _p, s) => {
    const clara = limitar01(0.5 - naLuz.d(px, py) / (2 * SOMBRA_DO_INTRADORSO.beira))
    const desce = limitar01((py - (yNascente - b)) / altoDoVao)
    const cor = misturar(ABOBADA, PAREDE_DO_FUNDO, clara * clara * (3 - 2 * clara) * (0.55 + 0.45 * desce))
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 1
  }
  L.push(P(vao, CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: fundoDoNicho, semente: SEMENTE + 10 }))
  // A luz fria dos cristais no fundo: forte no pé, apaga antes de um terço do vão, e é mais forte atrás de cada ninho.
  const luzNoFundo: Textura = (_u, _v, px, py, _p, s) => {
    const sobe = (ySoleira - py) / (altoDoVao * LUZ_ATE)
    const perto = 0.55 + 0.45 * Math.max(Math.exp(-(((px - xEsquerda) / 15) ** 2)), 0.8 * Math.exp(-(((px - xDireita) / 12) ** 2)))
    s[0] = LUZ_FRIA[0]
    s[1] = LUZ_FRIA[1]
    s[2] = LUZ_FRIA[2]
    s[4] = 1
    s[5] = sobe >= 1 ? 0 : LUZ_NO_PE * perto * (1 - sobe) * (1 - sobe)
  }
  L.push(P(dentroDe(caixa(-a, ySoleira - altoDoVao * LUZ_ATE, a, ySoleira), vao), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: luzNoFundo, semente: SEMENTE + 11 }))
  // O clarão atrás de cada ninho: redondo, preso ao vão e ao terço de baixo dele.
  for (const [cx, alto, k] of [[xEsquerda, NINHO_DA_ESQUERDA[3][1], 0], [xDireita, NINHO_DA_DIREITA[2][1], 1]] as const) {
    const r = alto * altoDoVao * CLARAO_DO_NINHO.raio
    const cy = yDosNinhos - r * 0.34
    L.push(P(dentroDe(elipse(cx, cy, r, r), vao), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(cx, cy, r, r, CLARAO_DO_NINHO.alfa), semente: SEMENTE + 13 + k }))
  }

  // Os dois NINHOS, atrás da arca: os prismas de trás primeiro, o grande por último.
  const ninho = (prismas: readonly Prisma[], cx: number, semente: number): void => {
    prismas.forEach(([dx, altura, meia, pende], i) => {
      for (const face of prismaDeitado({ x: cx + dx, y: yDosNinhos, rumo: -Math.PI / 2 + pende * GRAUS, comprido: altura * altoDoVao, meia }, 0, semente + i * 4)) L.push(P(face.forma, CRISTAL, face.o))
    })
  }
  ninho(NINHO_DA_ESQUERDA, xEsquerda, SEMENTE + 20)
  ninho(NINHO_DA_DIREITA, xDireita, SEMENTE + 44)

  // A arca, de pedra um tom mais clara que o muro: o degrau, o corpo com os três painéis rebaixados e a tampa de
  // duas águas, com a cumeeira clara no alto.
  const [dx0, dx1] = [-a + ARCA.recuo, a - ARCA.recuo]
  const [cx0, cx1] = [dx0 + 2.4, dx1 - 2.4]
  const yDegrau = ySoleira - ARCA.degrau
  const yCorpo = yDegrau - ARCA.corpo
  const yCumeeira = yCorpo - ARCA.tampa
  // A arca fica de costas para os cristais: só as pontas dela pegam a luz deles.
  const naArca = banhada(daPedra, fontes.map((fonte) => ({ ...fonte, r: fonte.r * 0.7, forca: fonte.forca * 0.8 })))
  L.push(P(caixa(dx0, yDegrau, dx1, ySoleira, 0.4), pedra, { tabua: 0, bisel: 0.7, tom: 0.98, contorno: 0.28, textura: naArca, semente: SEMENTE + 30 }))
  L.push(P(caixa(cx0, yCorpo, cx1, yDegrau, 0.4), pedra, { tabua: 0, bisel: 0.9, tom: 1.12, contorno: 0.28, textura: naArca, semente: SEMENTE + 31 }))
  const painel = (cx1 - cx0 - 4) / 3
  for (let k = 0; k < 3; k += 1) {
    const px = cx0 + 2 + painel * (k + 0.5)
    const py = (yCorpo + yDegrau) / 2 + 0.2
    L.push(P(caixa(px - painel / 2 + 1, yCorpo + 1.9, px + painel / 2 - 1, yDegrau - 1.5, 0.4), pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.86, recesso: { k: 0.8, forca: 0.3 }, textura: naArca, semente: SEMENTE + 32 + k }))
    L.push(P(poligono([[px, py - 2.1], [px + 2.4, py], [px, py + 2.1], [px - 2.4, py]]), pedra, { tabua: 0, bisel: 0.5, tom: 1.18, contorno: 0.2, textura: naArca, semente: SEMENTE + 35 + k }))
  }
  // A água da frente: do beiral (que passa do corpo e faz sombra nele) até a cumeeira, mais curta nas duas pontas.
  const beiral = yCorpo + 0.8
  const agua = poligono([[cx0 - 1.8, beiral], [cx0 - 1.2, beiral - 1.4], [cx0 + 3.2, yCumeeira + 1.1], [cx1 - 3.2, yCumeeira + 1.1], [cx1 + 1.2, beiral - 1.4], [cx1 + 1.8, beiral]])
  L.push(P(agua, pedra, { tabua: 0, bisel: 0.8, tom: 1.2, contorno: 0.28, textura: naArca, projeta: { dist: 1, forca: 0.32 }, semente: SEMENTE + 40 }))
  // As juntas das lajes da água e a CUMEEIRA: o filete claro que fecha o alto, bem acima dos cristais.
  for (const fx of [0.32, 0.66]) L.push(P(cadeia([[cx0 + (cx1 - cx0) * fx, beiral - 1.2], [cx0 + (cx1 - cx0) * (0.5 + (fx - 0.5) * 0.86), yCumeeira + 1.6]], 0.26), pedra, { ...juntaDaPedra, alfa: 0.5, semente: SEMENTE + 41 }))
  L.push(P(caixa(cx0 + 2.6, yCumeeira, cx1 - 2.6, yCumeeira + 1.7, 0.7), pedra, { tabua: 0, bisel: 0.5, tom: 1.42, contorno: 0.2, projeta: { dist: 0.6, forca: 0.22 }, semente: SEMENTE + 42 }))

  // O fio de luz no pé das OMBREIRAS (a beira de dentro do vão): só no terço de baixo, onde a luz chega.
  L.push(P(dentroDe(menos(vao, encolhida(vao, 1.2)), caixa(-a - 1, ySoleira - altoDoVao * LUZ_ATE, a + 1, ySoleira - 0.4)), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, ySoleira, a * 1.5, altoDoVao * LUZ_ATE, 0.6), semente: SEMENTE + 60 }))

  // ---------- a moldura do nicho: as ombreiras, a imposta, a ARQUIVOLTA e a chave ----------
  for (const lado of [-1, 1]) {
    const [x0, x1] = lado < 0 ? [-a - ARQUIVOLTA, -a] : [a, a + ARQUIVOLTA]
    L.push(P(caixa(x0, yNascente, x1, ySoleira, 0.4), pedra, { tabua: 0, bisel: 1, tom: 0.96, contorno: 0.28, textura: naPedra, projeta: { dist: 1.2, forca: 0.3 }, semente: SEMENTE + 70 }))
    L.push(P(caixa(x0 - 0.3, yNascente + NASCENTE * 0.52, x1 + 0.3, yNascente + NASCENTE * 0.52 + 0.6, 0.2), pedra, { ...juntaDaPedra, semente: SEMENTE + 71 }))
  }
  const arquivolta = menos(meiaElipse(a + ARQUIVOLTA, b + ARQUIVOLTA), elipse(0, yNascente, a, b))
  L.push(P(arquivolta, pedra, { tabua: 0, bisel: 1.1, tom: 1, contorno: 0.28, projeta: { dist: 1.4, forca: 0.32 }, semente: SEMENTE + 72 }))
  for (let k = 1; k < ADUELAS; k += 1) {
    // As juntas das aduelas, menos as duas da chave (ela é uma peça por cima).
    if (k === (ADUELAS - 1) / 2 || k === (ADUELAS + 1) / 2) continue
    const t = (k / ADUELAS) * Math.PI
    L.push(P(cadeia([noArco(t, 0.5), noArco(t, ARQUIVOLTA - 0.5)], 0.3), pedra, { ...juntaDaPedra, tom: 0.56 + 0.06 * hash(k, 1, SEMENTE), semente: SEMENTE + 73 }))
  }
  for (const lado of [-1, 1]) {
    const xi = lado * (a + ARQUIVOLTA / 2)
    L.push(P(caixa(xi - ARQUIVOLTA / 2 - 1, yNascente - 1.5, xi + ARQUIVOLTA / 2 + 1, yNascente + 1.7, 0.4), pedra, { tabua: 0, bisel: 0.8, tom: 1.1, contorno: 0.26, projeta: { dist: 0.8, forca: 0.26 }, semente: SEMENTE + 80 }))
  }
  const [t0, t1] = [((ADUELAS + 1) / 2 / ADUELAS) * Math.PI, ((ADUELAS - 1) / 2 / ADUELAS) * Math.PI]
  const chave = poligono([noArco(t0, -0.6), noArco(t0 + 0.02, ARQUIVOLTA + 1.9), noArco(t1 - 0.02, ARQUIVOLTA + 1.9), noArco(t1, -0.6)])
  // O halo do cabochão na pedra em volta dele: pintado por baixo da chave, clareia a arquivolta e a cornija ali.
  const yChave = yNascente - b - ARQUIVOLTA * 0.5 - 0.3
  const naChave = banhada(daPedra, [{ x: 0, y: yChave, r: HALO_DO_CABOCHAO.raio, forca: HALO_DO_CABOCHAO.alfa }])
  L.push(P(chave, pedra, { tabua: 0, bisel: 0.9, tom: 1.12, contorno: 0.28, textura: naChave, projeta: { dist: 0.9, forca: 0.28 }, semente: SEMENTE + 81 }))
  // O CABOCHÃO de cristal engastado na chave: o losango de duas facetas, com o reflexo, e o halo por cima da pedra.
  const [cl, ca] = [CABOCHAO.larga, CABOCHAO.alta]
  const rHalo = HALO_DO_CABOCHAO.raio
  L.push(P(elipse(0, yChave, rHalo, rHalo), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, yChave, rHalo, rHalo, HALO_DO_CABOCHAO.alfa), semente: SEMENTE + 84 }))
  L.push(P(poligono([[0, yChave - ca], [cl, yChave], [0, yChave + ca], [-cl, yChave]]), CRISTAL, { tabua: 0, bisel: 0.6, contorno: 0.24, textura: corAcesa(tomDoCristal(0.3), 0.5), semente: SEMENTE + 82 }))
  L.push(P(poligono([[0, yChave - ca + 0.5], [0.2, yChave], [0, yChave + ca - 0.5], [-cl + 0.5, yChave]]), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: corAcesa(tomDoCristal(0.9), 0.7), semente: SEMENTE + 85 }))
  L.push(P(poligono([[-0.2, yChave - ca * 0.56], [-0.2, yChave - 0.3], [-cl * 0.5, yChave - 0.4]]), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.85, textura: corAcesa(CIANO.reflexo, 1), semente: SEMENTE + 83 }))

  // A CORNIJA no alto e a SOLEIRA no pé, com o claro frio que sai da boca do arco.
  L.push(P(caixa(-x - 1.4, yFace, x + 1.4, yFace + CORNIJA, 0.4), pedra, { tabua: 0, bisel: 0.8, tom: 0.96, contorno: 0.28, textura: naChave, projeta: { dist: 1.1, forca: 0.3 }, semente: SEMENTE + 90 }))
  for (const xj of [-0.58, 0.08, 0.6]) L.push(P(caixa(xj * x - 0.3, yFace + 0.5, xj * x + 0.3, yFace + CORNIJA - 0.5, 0.2), pedra, { ...juntaDaPedra, semente: SEMENTE + 91 }))
  const naSoleira = banhada(daPedra, [{ x: xEsquerda * 0.5, y: ySoleira, r: a * 0.7, forca: 0.36 }])
  L.push(P(caixa(-x - 1.4, ySoleira, x + 1.4, ySoleira + 1.6, 0.4), pedra, { tabua: 0, bisel: 0.5, tom: 1.12, contorno: 0.24, textura: naSoleira, semente: SEMENTE + 92 }))
  L.push(P(caixa(-x - 1.4, ySoleira + 1.6, x + 1.4, yPe, 0.5), pedra, { tabua: 0, bisel: 0.8, tom: 0.72, contorno: 0.3, textura: naSoleira, semente: SEMENTE + 93 }))
  for (const xj of [-0.7, -0.24, 0.2, 0.66]) L.push(P(caixa(xj * x - 0.3, ySoleira + 2.2, xj * x + 0.3, yPe - 0.5, 0.2), pedra, { ...juntaDaPedra, semente: SEMENTE + 94 }))

  // As marcas do tempo: a trinca do canto de cima e o MUSGO no pé, preso à soleira e à ombreira.
  const trinca: Ponto[] = [[-x + 1, yFace + CORNIJA + 3], [-x + 6, yFace + CORNIJA + 6.6], [-x + 7.4, yFace + CORNIJA + 11], [-x + 12, yFace + CORNIJA + 13.4]]
  L.push(P(cadeia(trinca, 0.3), pedra, { tabua: 0, bisel: 0, tom: 0.44, contorno: 0, semente: SEMENTE + 95 }))
  L.push(P(musgoPreso(elipse(x - 9, yPe - 1.4, 8, 1.6), caixa(-x - 1.4, ySoleira, x + 1.4, yPe, 0.5)), MUSGO_DA_CRIPTA, { ...MUSGO, semente: SEMENTE + 96 }))
  L.push(P(musgoPreso(elipse(-x + 3.4, ySoleira - 2, 2.4, 3.4), caixa(-x, yFace, x, ySoleira, 0.6)), MUSGO_DA_CRIPTA, { ...MUSGO, alfa: 0.45, semente: SEMENTE + 97 }))
}
