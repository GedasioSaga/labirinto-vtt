/**
 * CHIQUEIRO CERCADO de cima com volume (lote L18 dos objetos e construções de 14/11/2026, construção do grupo
 * Praça, rua e campo): o curral dos porcos. Uma CERCA de três tábuas corridas pregadas por fora dos mourões, com a
 * PORTEIRA de tábuas na frente (dobradiças e tranca de ferro); dentro, o chão pisado, o ABRIGO de meia-água no
 * fundo à esquerda (tábuas descendo para a frente, a palha da cama debaixo), o COCHO de madeira encostado na cerca
 * da direita com a lavagem e os restos, a POÇA DE LAMA e três PORCOS: a porca deitada na lama, um porco com o
 * focinho no cocho e um leitão andando.
 *
 * De cima: o retângulo da cerca (a beira clara das tábuas e os mourões escuros), o telhadinho de tábuas no canto,
 * a lama escura e brilhante e os porcos cor-de-rosa (o focinho, as orelhas caídas, o rabo enrolado). É a lama com
 * os porcos que diz "chiqueiro" e não galinheiro (casinha de pés, galinhas, cerca de duas varas).
 *
 * NA 3/4 (`tresQuartos.ts`; todo tampo tem a beirada `ESPESSURA_DA_TABUA_DO_CHIQUEIRO`, a altura de uma tábua):
 * - cada LADO da cerca são três tampos (as três tábuas), com a fresta entre uma e outra, por onde se vê o que está
 *   atrás; a tábua de baixo um tico mais para fora que a do meio, e esta que a de cima: o pingo de madeira de cada
 *   uma fica nesse tico. Os lados são estruturas separadas: o de trás sai antes do abrigo e dos porcos, o da frente
 *   depois deles;
 * - os MOURÕES são colunas um pouco mais altas que a tábua de cima;
 * - o ABRIGO são três faixas de telhado em degrau, descendo para a frente, nos dois esteios da frente (colunas). As
 *   faixas têm um furo minúsculo no PONTO DE CHÃO do abrigo, e a palha da cama tem o meio da caixa nele: não sobe
 *   com o telhado;
 * - o COCHO e cada PORCO são colunas baixas (o porco inteiro tem o meio no meio do corpo).
 * Não lê `c.giro`: nada é desenhado de frente. As medidas saem da pegada (3 x 2 casas de partida); as alturas são
 * em casas. Material: `madeira` (a cerca, o abrigo e o cocho). O chão, a lama, a palha, a lavagem e os porcos são
 * fixos.
 */
import { hash } from '../../ruido'
import { anel, caixa, capsula, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type OpcoesDaPeca, type Sombra } from './motor'
import { G, materialDaPeca, PREGO, QUARTO, type MontarMovel } from './contexto'

/** A altura de uma tábua da cerca (px do protótipo): a beirada de todo tampo do chiqueiro. */
export const ESPESSURA_DA_TABUA_DO_CHIQUEIRO = 0.1 * G

/** A cerca em fração do meio lado, a grossura da tábua vista de cima (px) e o tico de cada tábua de baixo. */
const CERCA = 0.95
const TABUA = 2.4
const TICO = 0.6
/** O alto de cada tábua (casas) e dos mourões. */
const TABUAS: readonly number[] = [0.18, 0.33, 0.48]
const ALTURA_DO_MOURAO = 0.56
/** Os mourões ao longo de x (fração) e de y; a porteira entre estes dois x (fração), na frente. */
const MOUROES_EM_X: readonly number[] = [-1, -0.42, -0.08, 0.45, 1]
const MOUROES_EM_Y: readonly number[] = [-1, 0, 1]
const PORTEIRA: readonly [number, number] = [-0.42, -0.08]
/** O abrigo (fração da pegada): x0, x1, y0 (o fundo), y1 (a beira da frente) e as alturas do fundo e da frente. */
const ABRIGO = { x0: -0.93, x1: -0.22, y0: -0.93, y1: -0.12 } as const
const ALTURA_DO_FUNDO = 0.8
const ALTURA_DA_BEIRA = 0.62
const FAIXAS_DO_TELHADO = 3
const TABUAS_DO_TELHADO = 7
/** O cocho (fração): ao longo de y, encostado na cerca da direita. */
const COCHO = { x0: 0.7, x1: 0.88, y0: -0.62, y1: 0.12 } as const
const ALTURA_DO_COCHO = 0.2
/** A poça de lama: o meio e os raios (fração). */
const LAMA_EM: readonly [number, number, number, number] = [0.16, 0.36, 0.42, 0.4]

const CHAO: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x66, 0x50] }
const LAMA: MaterialDaPeca = { classe: 'liso', rgb: [0x52, 0x42, 0x34] }
const PALHA = materialDaPeca('palha')
const LAVAGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x7d, 0x73, 0x5e] }
const MILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xc9, 0xa9, 0x5a] }
const COUVE: MaterialDaPeca = { classe: 'folha', rgb: [0x6f, 0x86, 0x58] }
/** O porco: a pele rosada contida, o focinho mais escuro, a lama seca no couro. */
const PELE: MaterialDaPeca = { classe: 'liso', rgb: [0xd4, 0xa4, 0x99] }
const FOCINHO: MaterialDaPeca = { classe: 'liso', rgb: [0xbf, 0x86, 0x7d] }
const NARINA: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x3f, 0x3b] }
const LAMA_SECA: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x58, 0x45] }
/** A altura de cada porco (casas): em pé e deitado. */
const ALTURA_DO_PORCO = 0.16
const ALTURA_DA_PORCA_DEITADA = 0.11

function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

export const montarChiqueiroCercado: MontarMovel = (c, cena) => {
  const P = c.peca
  const k = Math.min(c.hw, c.hh) / G
  const madeira = c.m.madeira
  const L = cena.partes
  const S = cena.sombras
  const [ox, oy] = [c.hw * CERCA, c.hh * CERCA]
  const solta = (forma: Forma, z: number): Sombra => ({ forma, z, solta: true, forca: 0 })
  const fx = (f: number): number => f * c.hw
  const fy = (f: number): number => f * c.hh

  // ---------- o abrigo: o ponto de chão (furo nas faixas do telhado) e as medidas ----------
  const [ax0, ax1, ay0, ay1] = [fx(ABRIGO.x0) + TABUA + 0.6, fx(ABRIGO.x1), fy(ABRIGO.y0) + TABUA + 0.6, fy(ABRIGO.y1)]
  const pontoDeChao: Ponto = [(ax0 + ax1) / 2, (ay0 + ay1) / 2]
  // O furo no ponto de chão e no pé de cada esteio: a palha e os esteios não sobem com o telhado.
  const esteios: readonly number[] = [ax0 + 2.2 * k, ax1 - 2.2 * k]
  const furo = esteios.reduce((f, x) => uniao(f, elipse(x, ay1 - 1.8 * k, 0.6, 0.6)), elipse(pontoDeChao[0], pontoDeChao[1], 0.6, 0.6))
  // O ponto de chão do cercado, longe dos porcos e do cocho: as peças do chão têm o meio da caixa nele.
  const chao: Ponto = [fx(0.5), fy(0.75)]
  const doChao = (forma: Forma): Forma => comMeioEm(forma, chao[0], chao[1])

  // ---------- no chão: a terra pisada, as pegadas, a palha, a lama ----------
  L.push(P(doChao(caixa(-ox, -oy, ox, oy, 1.5)), CHAO, { tabua: 0, bisel: 0, contorno: 0.12, tom: 1, ruga: 0.6, semente: 18800 }))
  for (let i = 0; i < 22; i += 1) {
    const [x, y] = [fx((hash(i, 1, 18801) - 0.5) * 1.7), fy((hash(i, 2, 18801) - 0.5) * 1.7)]
    const a = hash(i, 3, 18801) * Math.PI
    for (const l of [-0.9, 0.9]) {
      L.push(P(doChao(elipseGirada(x - Math.sin(a) * l * k, y + Math.cos(a) * l * k, 1.1 * k, 0.6 * k, a)), LAMA, { tabua: 0, bisel: 0, contorno: 0.08, tom: 0.9, alfa: 0.55, semente: 18802 + i }))
    }
  }
  // A cama de palha debaixo do abrigo, na sombra dele (o meio da caixa no ponto de chão: não sobe com o telhado).
  L.push(P(comMeioEm(caixa(ax0, ay0, ax1 + 3 * k, ay1 + 3 * k, 2), pontoDeChao[0], pontoDeChao[1]), PALHA, { tabua: 0, bisel: 0, contorno: 0.14, tom: 0.62, ruga: 0.8, semente: 18830 }))
  for (let i = 0; i < 26; i += 1) {
    const [x, y] = [ax1 + fx(0.18) * hash(i, 1, 18831) - 2, ay0 + (ay1 + 10 * k - ay0) * hash(i, 2, 18831)]
    const a = hash(i, 3, 18831) * Math.PI
    const fio = capsula(x, y, x + Math.cos(a) * 3.2 * k, y + Math.sin(a) * 3.2 * k, 0.4 * k)
    L.push(P(comMeioEm(fio, pontoDeChao[0], pontoDeChao[1]), PALHA, { tabua: 0, bisel: 0, contorno: 0.24, tom: 0.85 + 0.25 * hash(i, 4, 18831), semente: 18832 + i }))
  }
  const [lx, ly, lrx, lry] = [fx(LAMA_EM[0]), fy(LAMA_EM[1]), fx(LAMA_EM[2]), fy(LAMA_EM[3])]
  const borda: Ponto[] = []
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * 2 * Math.PI
    const r = 0.82 + 0.3 * hash(i, 1, 18860)
    borda.push([lx + Math.cos(a) * lrx * r, ly + Math.sin(a) * lry * r])
  }
  L.push(P(doChao(poligono(borda)), LAMA, { tabua: 0, bisel: 1.6 * k, contorno: 0.22, tom: 1, ruga: 0.5, recesso: { k: 2, forca: 0.3 }, semente: 18861 }))
  // O brilho molhado da lama: manchas claras do lado da luz.
  for (let i = 0; i < 5; i += 1) {
    const [x, y] = [lx - lrx * 0.5 + lrx * 0.8 * hash(i, 1, 18862), ly - lry * 0.55 + lry * 0.5 * hash(i, 2, 18862)]
    L.push(P(doChao(elipseGirada(x, y, (2.6 + 2 * hash(i, 3, 18862)) * k, 1 * k, -0.3)), LAMA, { tabua: 0, bisel: 0, contorno: 0, tom: 1.35, alfa: 0.7, suave: 0.8, semente: 18863 + i }))
  }

  // ---------- o cocho, na cerca da direita: o tronco cavado, a lavagem e os restos ----------
  const [cx0, cx1, cy0, cy1] = [fx(COCHO.x0), fx(COCHO.x1), fy(COCHO.y0), fy(COCHO.y1)]
  const cocho = caixa(cx0, cy0, cx1, cy1, 2.5 * k)
  S.push(contato(cocho, 0.32), { forma: cocho, z: ALTURA_DO_COCHO * c.g, forca: 0.26 })
  L.push(P(cocho, madeira, { tabua: 0, eixo: QUARTO, bisel: 1.6 * k, contorno: 0.32, tom: 0.92, semente: 18870 }))
  const dentro = caixa(cx0 + 2 * k, cy0 + 2.4 * k, cx1 - 2 * k, cy1 - 2.4 * k, 1.6 * k)
  L.push(P(dentro, LAVAGEM, { tabua: 0, bisel: 0, contorno: 0.24, tom: 0.95, recesso: { k: 1.6, forca: 0.36 }, semente: 18871 }))
  for (let i = 0; i < 7; i += 1) {
    const [x, y] = [cx0 + 3 * k + (cx1 - cx0 - 6 * k) * hash(i, 1, 18872), cy0 + 4 * k + (cy1 - cy0 - 8 * k) * hash(i, 2, 18872)]
    const resto = i % 3 === 0 ? capsula(x, y - 2.4 * k, x, y + 2.4 * k, 1.1 * k) : elipse(x, y, 1.4 * k, 1.1 * k)
    L.push(P(resto, i % 3 === 0 ? MILHO : COUVE, { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.9, semente: 18873 + i }))
  }

  // ---------- os porcos: corpo, cabeça, orelhas caídas, focinho, rabo enrolado e a lama no couro ----------
  const porco = (x: number, y: number, ang: number, tam: number, deitado: boolean, semente: number): void => {
    const s = tam * k
    const [cs, sn] = [Math.cos(ang), Math.sin(ang)]
    const em = (f: number, l: number): Ponto => [x + (cs * f - sn * l) * s, y + (sn * f + cs * l) * s]
    const corpo = elipseGirada(x, y, 13 * s, (deitado ? 9 : 8) * s, ang)
    const altura = (deitado ? ALTURA_DA_PORCA_DEITADA : ALTURA_DO_PORCO) * c.g * tam
    S.push(contato(corpo, 0.34), { forma: corpo, z: altura, forca: 0.24 })
    const parte = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
      L.push(P(comMeioEm(forma, x, y), mat, { tabua: 0, ...o }))
    }
    if (deitado) {
      // Deitada de lado: as quatro patas para fora, as de cima com o casco escuro.
      for (const f of [-7, 7]) {
        parte(capsula(...em(f, 7.5), ...em(f + 1.2, 12.5), 1.6 * s), PELE, { bisel: 0.8 * s, contorno: 0.3, tom: 0.88, semente: semente + 20 + f })
        parte(elipse(...em(f + 1.3, 13.2), 1.3 * s, 1.3 * s), NARINA, { bisel: 0.4, contorno: 0.2, semente: semente + 30 + f })
      }
    }
    // O rabo enrolado na ponta de trás.
    const [rx, ry] = em(-14, deitado ? 1.5 : 0)
    parte(anel(rx, ry, 2 * s, 2 * s, 1.1 * s, 1.1 * s), FOCINHO, { bisel: 0.4, contorno: 0.32, semente: semente + 1 })
    parte(corpo, PELE, { bisel: 5 * s, contorno: 0.3, tom: 1.02, ruga: 0.3, projeta: { dist: 1, forca: 0.26 }, semente: semente + 2 })
    // A lama no couro: o porco que deita na lama sai dela sujo dos lados.
    for (let i = 0; i < (deitado ? 4 : 2); i += 1) {
      const [mx, my] = em(-6 + 9 * hash(i, 1, semente), (hash(i, 2, semente) - 0.5) * 9)
      parte(elipseGirada(mx, my, (2.4 + 2 * hash(i, 3, semente)) * s, 1.6 * s, ang + hash(i, 4, semente)), LAMA_SECA, { bisel: 0, contorno: 0, alfa: 0.7, suave: 0.6, semente: semente + 3 + i })
    }
    const [hx, hy] = em(11.5, 0)
    parte(elipseGirada(hx, hy, 5.6 * s, 5.4 * s, ang), PELE, { bisel: 2.6 * s, contorno: 0.3, tom: 0.98, projeta: { dist: 0.8, forca: 0.24 }, semente: semente + 8 })
    for (const l of [-1, 1]) {
      // As orelhas caídas para a frente, por cima dos olhos.
      parte(poligono([em(9.5, l * 1.6), em(10.5, l * 5.8), em(15, l * 4.2)]), FOCINHO, { bisel: 0.8 * s, contorno: 0.32, tom: 1.08, projeta: { dist: 0.9, forca: 0.3 }, semente: semente + 9 + l })
    }
    const [nx, ny] = em(16.6, 0)
    parte(elipseGirada(nx, ny, 1.8 * s, 2.6 * s, ang), FOCINHO, { bisel: 0.8 * s, contorno: 0.34, tom: 0.96, semente: semente + 12 })
    for (const l of [-0.9, 0.9]) parte(elipse(...em(17.2, l), 0.45 * s, 0.45 * s), NARINA, { bisel: 0, contorno: 0.1, semente: semente + 13 })
  }
  porco(lx + fx(0.02), ly - fy(0.02), -0.25, 1.15, true, 18900)
  porco(cx0 - fx(0.2), fy(-0.3), 0.08, 1, false, 18940)
  porco(fx(-0.18), fy(0.12), 0.55, 0.72, false, 18980)

  // ---------- o abrigo: os dois esteios da frente e as três faixas do telhado, descendo para a frente ----------
  for (const x of esteios) {
    const esteio = caixa(x - 1.8 * k, ay1 - 3.6 * k, x + 1.8 * k, ay1, 0.6)
    S.push(contato(esteio, 0.3), { forma: esteio, z: ALTURA_DA_BEIRA * c.g - ESPESSURA_DA_TABUA_DO_CHIQUEIRO, forca: 0.24 })
    L.push(P(esteio, madeira, { tabua: 0, bisel: 0.8, contorno: 0.32, tom: 0.84, semente: 19020 }))
  }
  const beiral = 3 * k
  const [tx0, tx1, ty0, ty1] = [ax0 - 1, ax1 + beiral, ay0 - 1, ay1 + beiral]
  for (let i = 0; i < FAIXAS_DO_TELHADO; i += 1) {
    const [y0, y1] = [ty0 + ((ty1 - ty0) * i) / FAIXAS_DO_TELHADO, ty0 + ((ty1 - ty0) * (i + 1)) / FAIXAS_DO_TELHADO]
    const z = (ALTURA_DO_FUNDO + ((ALTURA_DA_BEIRA - ALTURA_DO_FUNDO) * i) / (FAIXAS_DO_TELHADO - 1)) * c.g
    S.push({ ...solta(menos(caixa(tx0, y0, tx1, y1), furo), z), forca: 0.22 })
    // As tábuas correm descendo o telhado (ao longo de y), cada uma no seu tom, cortadas em cada faixa.
    for (let j = 0; j < TABUAS_DO_TELHADO; j += 1) {
      const [x0, x1] = [tx0 + ((tx1 - tx0) * j) / TABUAS_DO_TELHADO, tx0 + ((tx1 - tx0) * (j + 1)) / TABUAS_DO_TELHADO]
      const tabua = caixa(x0 + 0.3, y0 - (i > 0 ? 1.5 : 0), x1 - 0.3, y1, 0.5)
      // A faixa de cima é a mais clara (a luz vem de cima à esquerda e ela está mais perto do sol).
      L.push(P(comMeioEm(tabua, (x0 + x1) / 2, (y0 + y1) / 2), madeira, { tabua: 0, eixo: QUARTO, bisel: 0.8, contorno: 0.3, tom: 1.02 - 0.05 * i + 0.1 * (hash(j, i, 19030) - 0.5), projeta: { dist: 1.4, forca: 0.32 }, semente: 19030 + i * TABUAS_DO_TELHADO + j }))
    }
    // Os pregos da travessa de cada faixa.
    for (let j = 0; j < TABUAS_DO_TELHADO; j += 1) {
      const x = tx0 + ((tx1 - tx0) * (j + 0.5)) / TABUAS_DO_TELHADO
      L.push(P(comMeioEm(elipse(x, y1 - 2 * k, 0.6 * k, 0.6 * k), (tx0 + tx1) / 2 + 0.1 * j, (y0 + y1) / 2), PREGO, { tabua: 0, bisel: 0, contorno: 0.2, metal: 0.4, semente: 19060 + i * TABUAS_DO_TELHADO + j }))
    }
  }

  // ---------- a cerca: quatro lados, três tábuas cada (a de baixo um tico mais para fora), e os mourões ----------
  const t = TABUA
  const lados: readonly (readonly [string, (o: number) => Forma, Ponto])[] = [
    ['fundo', (o) => caixa(-ox - o, -oy - o, ox + o, -oy + t), [fx(0.6), -oy]],
    ['esquerda', (o) => caixa(-ox - o, -oy + t, -ox + t, oy - t), [-ox, fy(0.5)]],
    ['direita', (o) => caixa(ox - t, -oy + t, ox + o, oy - t), [ox, fy(0.5)]],
    ['frente', (o) => caixa(-ox - o, oy - t, ox + o, oy + o), [fx(0.7), oy]],
  ]
  lados.forEach(([, faixa, [px, py]], l) => {
    TABUAS.forEach((altura, i) => {
      const o = TICO * (TABUAS.length - 1 - i)
      S.push(solta(faixa(o), altura * c.g))
      // O pingo, no tico desta tábua: para fora da cerca, na direção do lado.
      const [dx, dy] = [Math.sign(px) * (Math.abs(px) >= ox - 0.01 ? 1 : 0), Math.sign(py) * (Math.abs(py) >= oy - 0.01 ? 1 : 0)]
      L.push(P(elipse(px + dx * (o - 0.3), py + dy * (o - 0.3), 0.2, 0.2), madeira, { tabua: 0, bisel: 0, contorno: 0, semente: 19100 + l * 3 + i }))
    })
  })
  // De cima, a beira da tábua de cima: clara, com o veio correndo ao longo do lado; a porteira mais escura.
  const [p0, p1] = [fx(PORTEIRA[0]), fx(PORTEIRA[1])]
  const beiras: readonly (readonly [Forma, number, number])[] = [
    [caixa(-ox, -oy, ox, -oy + t, 0.5), 0, 1.1],
    [caixa(-ox, -oy + t, -ox + t, oy - t, 0.5), QUARTO, 1.06],
    [caixa(ox - t, -oy + t, ox, oy - t, 0.5), QUARTO, 1.06],
    [caixa(-ox, oy - t, p0 - 1.5, oy, 0.5), 0, 1.1],
    [caixa(p1 + 1.5, oy - t, ox, oy, 0.5), 0, 1.1],
  ]
  beiras.forEach(([forma, eixo, tom], i) => L.push(P(forma, madeira, { tabua: 0, eixo, bisel: 0.7, contorno: 0.32, tom, projeta: { dist: 1.2, forca: 0.3 }, semente: 19120 + i })))
  L.push(P(caixa(p0 + 0.6, oy - t, p1 - 0.6, oy, 0.5), madeira, { tabua: 0, bisel: 0.7, contorno: 0.34, tom: 0.86, projeta: { dist: 1.2, forca: 0.3 }, semente: 19126 }))
  // As dobradiças e a tranca da porteira (ferro), e a ponta de cada tábua da porteira saindo da beira.
  for (const x of [p0 + 2.5 * k, p1 - 1.5 * k]) {
    L.push(P(caixa(x - 1.2 * k, oy - t - 0.8, x + 1.2 * k, oy + 0.8, 0.4), PREGO, { tabua: 0, bisel: 0.4, contorno: 0.32, tom: 0.9, metal: 0.4, semente: 19127 }))
  }
  const mourao = (x: number, y: number, semente: number): void => {
    // O mourão fica por dentro das tábuas (pregadas por fora): o meio dele um tico para dentro da cerca.
    const [mx, my] = [x - Math.sign(x) * 2 * k, y - Math.sign(y) * (Math.abs(y) > oy - t ? 2 * k : 0)]
    const tora = caixa(mx - 2.1 * k, my - 2.1 * k, mx + 2.1 * k, my + 2.1 * k, 0.9 * k)
    S.push({ forma: tora, z: ALTURA_DO_MOURAO * c.g, suave: 1.2, forca: 0.24 })
    L.push(P(tora, madeira, { tabua: 0, bisel: 1 * k, contorno: 0.34, tom: 0.78, projeta: { dist: 1.2, forca: 0.32 }, semente }))
  }
  MOUROES_EM_X.forEach((xf, i) => {
    for (const yf of [-1, 1]) mourao(xf * (ox - t / 2), yf * (oy - t / 2), 19140 + i * 2 + (yf + 1) / 2)
  })
  for (const yf of MOUROES_EM_Y.slice(1, -1)) {
    for (const xf of [-1, 1]) mourao(xf * (ox - t / 2), yf * (oy - t / 2), 19150 + (xf + 1) / 2)
  }
}
