/**
 * BARRACA DE ESPETINHO de cima com volume (lote L10 dos objetos de 14/11/2026, grupo Taverna e festa; pedido do
 * mestre: "barraca de comida com fogareiro: espetinho e fumaça"). A barraquinha de comida de rua:
 * - atrás, a LONA lisa esticada em quatro esteios (sem listra: as costuras, um remendo, a bainha da frente e as
 *   amarras nos esteios), cobrindo a mesa de preparo, que só aparece na 3/4 (a bacia de carne temperada, a tábua
 *   com a faca, a moringa e a pilha de pratos);
 * - no meio, o FOGAREIRO de espetinho: o cocho comprido de chapa de ferro nas pernas, cheio de BRASA (pintada:
 *   não há chama animada), com oito ESPETOS de bambu atravessados (carne, frango, queijo coalho com a marca da
 *   grelha, coração e linguiça);
 * - a FUMAÇA (pintada) subindo do fogareiro e indo embora para cima à direita, levada pelo vento, mais rala longe;
 * - à direita, a BANCADA da frente com a bandeja dos espetos prontos, a tigela de farofa e a de vinagrete;
 * - à esquerda, no chão, o SACO de carvão de estopa aberto, com o ABANADOR de palha trançada apoiado nele.
 *
 * No meio da lona, o espeto pintado (a vareta e três pedaços): é o letreiro da barraca, e o que diz "comida" do
 * alto, onde a lona esconde a mesa.
 *
 * Não é a churrasqueira (a de tijolo, com grelha) nem a barraca de jogos (o toldo listrado): aqui é o cocho
 * estreito com os espetos de través e a fumaça. A 25% de zoom sobram a faixa de lona atrás, a fileira de espetos
 * marrons sobre o laranja da brasa e o véu cinza da fumaça.
 *
 * Na 3/4 (perfil derivado) a lona é um tampo solto no alto dos esteios; o cocho do fogareiro e os tampos das
 * mesas são tampos soltos nas pernas (o vão de baixo fica à mostra); o saco é uma coluna; e a fumaça sobe toda
 * com o fogareiro, de onde sai. A estrutura da lona tem um vão em cima da mesa de trás, para a mesa e o que vai nela
 * não subirem com a lona (ver `montarLona`). Materiais: `toldo` (a lona; ocre de partida) e
 * `madeira` (os esteios e as mesas). A comida, o ferro, o fogo, a fumaça, a palha e a estopa são fixos. As
 * posições saem de frações da pegada (1,5 x 1 casa de partida); os espetos e a comida têm tamanho fixo.
 */
import { hash } from '../../ruido'
import { barra, capsula, caixa, elipse, elipseGirada, menos, poligono, type Forma, type Ponto } from './formas'
import { bordaDaSombra, contato, ruido, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { CINZA, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { brasas, FOGO_PARADO, texCinza, texHalo } from './fogoDeCasa'

/** As alturas, em casas. */
const ALTURA_DA_LONA = 1.4
const ALTURA_DO_FOGAREIRO = 0.66
const ALTURA_DA_MESA = 0.7
const ALTURA_DO_SACO = 0.36

/** As divisas, em frações da meia pegada. */
const LONA = { x0: -0.98, x1: 0.98, y0: -0.98, y1: -0.2 } as const
const ESTEIO_X = 0.95
const FOGAREIRO = { x0: -0.66, x1: 0.36, y0: 0, y1: 0.46 } as const
const BANCADA = { x0: 0.46, x1: 0.97, y0: -0.06, y1: 0.95 } as const
const MESA_DE_TRAS = { x0: -0.9, x1: 0.9, y0: -0.92, y1: -0.42 } as const
const SACO = { x: -0.82, y: 0.6, r: 0.27 } as const

/** O lado do esteio e a chapa do fogareiro (px do protótipo). */
const LADO_DO_ESTEIO = 3.4
const CHAPA = 1.3
/** A perna das mesas e do fogareiro: o lado e o recuo para dentro do tampo (px do protótipo). */
const LADO_DA_PERNA = 2.2
const RECUO_DA_PERNA = 0.9
/** Os espetos: quantos, quanto passam da chapa de cada lado (px) e o pedaço de comida (px). */
const ESPETOS = 8
const SOBRA_DO_ESPETO = 2.6
const PEDACO = 3.1

// ---------- as cores ----------

const FERRO: MaterialDaPeca = { classe: 'metal', rgb: [0x4c, 0x4a, 0x48] }
const BAMBU: MaterialDaPeca = { classe: 'madeira', rgb: [0xcc, 0xb4, 0x80] }
const CARNE: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x56, 0x40] }
const FRANGO: MaterialDaPeca = { classe: 'liso', rgb: [0xc4, 0x94, 0x5e] }
const QUEIJO: MaterialDaPeca = { classe: 'liso', rgb: [0xe0, 0xcc, 0x94] }
const CORACAO: MaterialDaPeca = { classe: 'liso', rgb: [0x84, 0x48, 0x44] }
const LINGUICA: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x5a, 0x46] }
const CEBOLA: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xcc, 0xb0] }
const PIMENTAO: MaterialDaPeca = { classe: 'liso', rgb: [0x74, 0x8a, 0x56] }
const CARNE_CRUA: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x62, 0x58] }
const FAROFA: MaterialDaPeca = { classe: 'liso', rgb: [0xd2, 0xb8, 0x80] }
const VINAGRETE: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0x7e, 0x5c] }
const PALHA = materialDaPeca('palha')
const BARRO = materialDaPeca('barro')
const ESTOPA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xa4, 0x8e, 0x6a] }
const CARVAO: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x3a, 0x36] }
const PRATO: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xd2, 0xc2] }
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0xaa, 0xac] }
const CORDA = materialDaPeca('corda')
/** A fumaça: um cinza quente, meio transparente (mais claro sumia nas lajotas claras). */
const FUMACA: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xc2, 0xbc] }
/** A tinta do desenho do espeto pintado na lona: um marrom escuro de carne assada. */
const TINTA_DA_LONA: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x40, 0x32] }

/** O que vai em cada espeto, de trás para a frente: os pedaços (o queijo coalho é um pedaço só, comprido). */
const RECEITAS: readonly (readonly MaterialDaPeca[])[] = [
  [CARNE, CEBOLA, CARNE, PIMENTAO],
  [FRANGO, FRANGO, FRANGO, FRANGO],
  [QUEIJO],
  [CORACAO, CORACAO, CORACAO, CORACAO, CORACAO],
  [CARNE, PIMENTAO, CARNE, CEBOLA],
  [LINGUICA, LINGUICA, LINGUICA],
  [FRANGO, CEBOLA, FRANGO, PIMENTAO],
  [CARNE, CARNE, CARNE, CARNE],
]

/** As nuvens da fumaça, do fogareiro para cima à direita: o meio (frações da meia pegada), o raio (fração do menor meio lado) e a força. */
const NUVENS: readonly (readonly [number, number, number, number])[] = [
  [-0.16, 0.14, 0.22, 0.66],
  [0.0, -0.1, 0.29, 0.6],
  [0.2, -0.36, 0.35, 0.5],
  [0.44, -0.6, 0.4, 0.4],
  [0.7, -0.84, 0.42, 0.28],
]

/** A marca da grelha: as faixas escuras de través e a luz miúda da comida. */
function texTostado(passo: number): Textura {
  return (u, v, x, y, p, s) => {
    const f = (u + v * 0.6) / passo
    const t = f - Math.floor(f)
    s[3] += (t < 0.24 ? -0.3 : 0) + ruido(x * 0.6 + p.su, y * 0.6) * 0.05
  }
}

/** A fumaça: o véu esfiapado (o alfa sobe e desce com o ruído), mais ralo na beira da nuvem. */
function texFumaca(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const q = Math.min(1, Math.hypot(x - cx, y - cy) / r)
    const fio = ruido(x * 0.12 + p.su, y * 0.2 + p.sv) * 0.9 + ruido(x * 0.33, y * 0.33 + p.su) * 0.4
    s[5] = Math.max(0, Math.min(1, 0.62 + fio)) * (1 - q * q)
    s[3] += fio * 0.06
  }
}

/** Os grãos da farofa e os picadinhos do vinagrete: pontos claros e escuros pela posição. */
function texGraos(claro: number, escuro: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const h = hash(Math.floor(x * 1.4), Math.floor(y * 1.4), 43)
    s[3] += h > 1 - claro ? 0.12 : h < escuro ? -0.16 : 0
  }
}

/** Um espeto de través: o bambu de ponta a ponta e os pedaços enfiados, de `y0` a `y1`, no x dado. */
function espeto(c: ContextoDoMovel, L: Peca[], x: number, y0: number, y1: number, receita: readonly MaterialDaPeca[], tostado: boolean, sem: number): void {
  const P = c.peca
  L.push(P(capsula(x, y0, x, y1, 0.48), BAMBU, { tabua: 0, eixo: QUARTO, bisel: 0.4, contorno: 0.3, semente: sem }))
  const comida = { tabua: 0, eixo: QUARTO, contorno: 0.3, projeta: { dist: 0.8, forca: 0.36 } }
  const textura = tostado ? texTostado(2.4) : undefined
  const meio = (y0 + y1) / 2
  if (receita.length === 1) {
    // O queijo coalho: um bloco comprido com as marcas da grelha.
    const meia = (y1 - y0) * 0.3
    L.push(P(caixa(x - PEDACO * 0.5, meio - meia, x + PEDACO * 0.5, meio + meia, 0.7), receita[0], { ...comida, bisel: 0.9, textura, semente: sem + 1 }))
    return
  }
  const passo = PEDACO * 1.02
  const inicio = meio - (passo * (receita.length - 1)) / 2
  receita.forEach((m, i) => {
    const y = inicio + passo * i
    const r = PEDACO / 2
    const forma = m === CORACAO ? elipse(x, y, r * 0.8, r * 0.95) : m === LINGUICA ? elipse(x, y, r * 0.95, r * 0.95) : caixa(x - r, y - r * 0.92, x + r, y + r * 0.92, r * 0.45)
    L.push(P(forma, m, { ...comida, bisel: r * 0.6, tom: 0.94 + 0.12 * hash(i, sem, 5), textura: m === CEBOLA || m === PIMENTAO ? undefined : textura, semente: sem + 2 + i }))
  })
}

/**
 * A mesma forma com a caixa de pintura centrada em (`tx`, `ty`), ainda contendo a forma: a 3/4 escolhe com que
 * estrutura a peça sobe pelo meio da caixa, e assim ela sobe com a estrutura que tem esse ponto.
 */
function comMeioEm(f: Forma, tx: number, ty: number): Forma {
  const [x0, y0, x1, y1] = f.b
  const rx = Math.max(tx - x0, x1 - tx)
  const ry = Math.max(ty - y0, y1 - ty)
  return { b: [tx - rx, ty - ry, tx + rx, ty + ry], d: (x, y) => f.d(x, y) }
}

/** A forma levada `dx`, `dy` (a sombra da lona no chão, já deslocada como a de um tampo solto naquela altura). */
function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/**
 * As sombras e as pernas de uma peça erguida (as mesas, o fogareiro): o tampo é um tampo solto na altura dada e
 * cada perna, uma coluna; na 3/4 o vão debaixo do tampo fica à mostra, e não um caixote maciço. O tampo e o que
 * vai nele são de quem chama.
 */
function pernasESombras(c: ContextoDoMovel, cena: Cena, x0: number, y0: number, x1: number, y1: number, altura: number, perna: MaterialDaPeca, sem: number): void {
  const z = c.g * altura
  cena.sombras.push(
    { forma: caixa(x0 - 0.8, y0 - 0.8, x1 + 0.8, y1 + 0.8, 1.4), z: 0, suave: 1.8, forca: 0.3 },
    { forma: caixa(x0, y0, x1, y1, 0.9), z, solta: true, suave: 1.6, forca: 0.24 },
  )
  const a = RECUO_DA_PERNA
  const b = RECUO_DA_PERNA + LADO_DA_PERNA
  for (const [px, py] of [[x0 + a, y0 + a], [x1 - b, y0 + a], [x0 + a, y1 - b], [x1 - b, y1 - b]]) {
    const forma = caixa(px, py, px + LADO_DA_PERNA, py + LADO_DA_PERNA, 0.3)
    cena.sombras.push(contato(forma, 0.34), { forma, z, suave: 0.9, forca: 0.28 })
    cena.partes.push(c.peca(forma, perna, { eixo: QUARTO, tabua: 0, bisel: 0.7, contorno: 0.2, tom: 0.64, metal: perna.classe === 'metal' ? 0.3 : 0, semente: sem }))
  }
}

/** Os quatro esteios da lona. */
function montarEsteios(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  for (const [fx, fy] of [[-ESTEIO_X, LONA.y0 + 0.05], [ESTEIO_X, LONA.y0 + 0.05], [-ESTEIO_X, LONA.y1 + 0.02], [ESTEIO_X, LONA.y1 + 0.02]]) {
    const ex = fx * hw
    const ey = fy * hh
    const esteio = caixa(ex - LADO_DO_ESTEIO / 2, ey - LADO_DO_ESTEIO / 2, ex + LADO_DO_ESTEIO / 2, ey + LADO_DO_ESTEIO / 2, 0.5)
    cena.sombras.push({ forma: esteio, z: c.g * ALTURA_DA_LONA, forca: 0.24 }, contato(esteio, 0.3))
    cena.partes.push(P(esteio, c.m.madeira, { tabua: 0, eixo: QUARTO, bisel: 0.9, contorno: 0.3, tom: 0.9, semente: 5400 }))
  }
}

/** A mesa de preparo, debaixo da lona: de cima fica escondida; na 3/4 a lona sobe e ela aparece. */
function montarMesaDeTras(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  const x0 = MESA_DE_TRAS.x0 * hw
  const x1 = MESA_DE_TRAS.x1 * hw
  const y0 = MESA_DE_TRAS.y0 * hh
  const y1 = MESA_DE_TRAS.y1 * hh
  pernasESombras(c, cena, x0, y0, x1, y1, ALTURA_DA_MESA, c.m.madeira, 5499)
  L.push(P(caixa(x0, y0, x1, y1, 0.9), c.m.madeira, { tabua: (y1 - y0) / 3, bisel: 1, contorno: 0.3, tom: 0.96, semente: 5500 }))
  const cy = (y0 + y1) / 2
  const fundo = y1 - y0
  // A bacia de barro com a carne temperada.
  const bx = x0 + (x1 - x0) * 0.2
  const rb = fundo * 0.42
  L.push(P(elipse(bx, cy, rb, rb), BARRO, { tabua: 0, bisel: rb * 0.4, contorno: 0.3, semente: 5501, projeta: { dist: 0.9, forca: 0.32 } }))
  for (let i = 0; i < 6; i += 1) {
    const a = i * 2.4
    const d = rb * 0.42 * Math.sqrt((i + 0.5) / 6)
    L.push(P(caixa(bx + Math.cos(a) * d - 1.5, cy + Math.sin(a) * d - 1.3, bx + Math.cos(a) * d + 1.5, cy + Math.sin(a) * d + 1.3, 0.7), CARNE_CRUA, { tabua: 0, bisel: 0.8, contorno: 0.28, metal: 0.15, semente: 5502 + i }))
  }
  // A tábua com a faca, a moringa e a pilha de pratos.
  const tx = x0 + (x1 - x0) * 0.48
  L.push(P(caixa(tx - fundo * 0.55, cy - fundo * 0.3, tx + fundo * 0.55, cy + fundo * 0.3, 1.2), BAMBU, { tabua: 0, bisel: 0.8, contorno: 0.3, semente: 5510, projeta: { dist: 0.7, forca: 0.3 } }))
  L.push(P(barra(tx - fundo * 0.4, cy + 0.6, tx + fundo * 0.1, cy - 0.4, 1.3), ACO, { tabua: 0, bisel: 0.4, contorno: 0.3, metal: 0.6, semente: 5511 }))
  L.push(P(barra(tx + fundo * 0.1, cy - 0.4, tx + fundo * 0.42, cy - 1.1, 1.4), CARVAO, { tabua: 0, bisel: 0.5, contorno: 0.3, semente: 5512 }))
  const mx = x0 + (x1 - x0) * 0.7
  L.push(P(elipse(mx, cy, fundo * 0.26, fundo * 0.26), BARRO, { tabua: 0, bisel: fundo * 0.2, contorno: 0.3, tom: 0.92, semente: 5513, projeta: { dist: 1, forca: 0.34 } }))
  L.push(P(elipse(mx - 0.3, cy - 0.3, fundo * 0.09, fundo * 0.09), CARVAO, { tabua: 0, bisel: 0, contorno: 0.2, semente: 5514 }))
  const px = x0 + (x1 - x0) * 0.88
  for (let i = 0; i < 3; i += 1) L.push(P(elipse(px + i * 0.5, cy - i * 0.5, fundo * 0.3, fundo * 0.3), PRATO, { tabua: 0, bisel: 1, contorno: 0.3, tom: 0.94 + i * 0.04, semente: 5515 + i, projeta: { dist: 0.5, forca: 0.3 } }))
}

/** O saco de carvão de estopa, aberto, no chão à esquerda. */
function montarSaco(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  const cx = SACO.x * hw
  const cy = SACO.y * hh
  const r = SACO.r * Math.min(hw, hh)
  const saco = elipse(cx, cy, r, r * 1.08)
  cena.sombras.push({ forma: saco, z: c.g * ALTURA_DO_SACO }, contato(saco, 0.32))
  L.push(P(saco, ESTOPA, { tabua: 0, bisel: r * 0.7, contorno: 0.3, ruga: 1.4, semente: 5600 }))
  // A boca aberta, dobrada para fora, e os pedaços de carvão.
  L.push(P(elipse(cx - r * 0.06, cy - r * 0.1, r * 0.66, r * 0.6), ESTOPA, { tabua: 0, bisel: 1, contorno: 0.3, tom: 1.08, ruga: 1.4, semente: 5601 }))
  L.push(P(elipse(cx - r * 0.06, cy - r * 0.1, r * 0.48, r * 0.42), CARVAO, { tabua: 0, bisel: 0.3, contorno: 0.1, recesso: { k: 1.2, forca: 0.3 }, semente: 5602 }))
  for (let i = 0; i < 7; i += 1) {
    const a = i * 2.39996
    const d = r * 0.36 * Math.sqrt((i + 0.5) / 7)
    const lx = cx - r * 0.06 + Math.cos(a) * d
    const ly = cy - r * 0.1 + Math.sin(a) * d * 0.85
    L.push(P(elipseGirada(lx, ly, 1.3, 0.95, a), CARVAO, { tabua: 0, bisel: 0.8, contorno: 0.25, tom: 1.2 + 0.3 * hash(i, 1, 59), semente: 5603 + i }))
  }
  // O abanador de palha trançada apoiado no saco: a pá redonda e o cabo de bambu. As duas peças têm o meio dentro
  // do saco, e na 3/4 sobem com ele.
  const ax = cx + r * 0.3
  const ay = cy + r * 0.32
  const [hx, hy]: Ponto = [cx + r * 0.95, cy + r * 0.95]
  L.push(P(barra(ax, ay, hx, hy, 1.3), BAMBU, { tabua: 0, eixo: QUARTO / 2, bisel: 0.5, contorno: 0.3, semente: 5610, projeta: { dist: 0.7, forca: 0.3 } }))
  L.push(P(elipseGirada(ax, ay, 4.6, 3.8, -0.76), PALHA, { eixo: -0.76, bisel: 1, contorno: 0.3, semente: 5611, projeta: { dist: 0.9, forca: 0.34 } }))
}

/** O fogareiro: o cocho de chapa, a brasa, os espetos de través, as alças e o abanador. */
function montarFogareiro(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  const x0 = FOGAREIRO.x0 * hw
  const x1 = FOGAREIRO.x1 * hw
  const y0 = FOGAREIRO.y0 * hh
  const y1 = FOGAREIRO.y1 * hh
  pernasESombras(c, cena, x0, y0, x1, y1, ALTURA_DO_FOGAREIRO, FERRO, 5699)
  L.push(P(caixa(x0, y0, x1, y1, 0.8), FERRO, { tabua: 0, bisel: 0.7, contorno: 0.32, metal: 0.3, tom: 0.92, semente: 5700 }))
  const ix0 = x0 + CHAPA
  const ix1 = x1 - CHAPA
  const iy0 = y0 + CHAPA
  const iy1 = y1 - CHAPA
  const cx = (ix0 + ix1) / 2
  const cy = (iy0 + iy1) / 2
  L.push(P(caixa(ix0, iy0, ix1, iy1, 0.4), CINZA, { tabua: 0, bisel: 0, contorno: 0, textura: texCinza(cx, cy, (ix1 - ix0) / 2), recesso: { k: 1.6, forca: 0.34 }, tom: 0.84, semente: 5701 }))
  brasas(c, L, cx, cy, (ix1 - ix0) / 2 * 0.92, (iy1 - iy0) / 2 * 0.7, 30, 1.25, true, 5710)
  L.push(P(caixa(ix0, iy0, ix1, iy1, 0.4), FOGO_PARADO, { textura: texHalo(cx, cy, (ix1 - ix0) / 2, (iy1 - iy0) * 0.9, 0.3), bisel: 0, contorno: 0, semente: 5750 }))
  // As alças de ferro nas duas pontas.
  for (const lado of [-1, 1]) {
    const ax = lado < 0 ? x0 : x1
    // A alça fica fora do cocho: um tampo solto dela, na mesma altura, para subir junto na 3/4.
    cena.sombras.push({ forma: caixa(ax - (lado < 0 ? 2.6 : 0), cy - 2.4, ax + (lado < 0 ? 0 : 2.6), cy + 2.4), z: c.g * ALTURA_DO_FOGAREIRO, solta: true, forca: 0.2 })
    L.push(P(menos(caixa(ax - (lado < 0 ? 2.6 : 0), cy - 2.4, ax + (lado < 0 ? 0 : 2.6), cy + 2.4, 1.2), caixa(ax - (lado < 0 ? 1.7 : 0), cy - 1.3, ax + (lado < 0 ? 0 : 1.7), cy + 1.3, 0.5)), FERRO, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.4, semente: 5751 }))
  }
  // Os espetos de través, apoiados nas duas beiras da chapa.
  const passo = (ix1 - ix0) / ESPETOS
  RECEITAS.forEach((receita, i) => {
    const x = ix0 + passo * (i + 0.5) + (hash(i, 2, 61) - 0.5) * 0.8
    espeto(c, L, x, y0 - SOBRA_DO_ESPETO, y1 + SOBRA_DO_ESPETO, receita, true, 5760 + i * 10)
  })
}

/** A bancada da frente: a bandeja de espetos prontos, a tigela de farofa e a de vinagrete. */
function montarBancada(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  const x0 = BANCADA.x0 * hw
  const x1 = BANCADA.x1 * hw
  const y0 = BANCADA.y0 * hh
  const y1 = BANCADA.y1 * hh
  pernasESombras(c, cena, x0, y0, x1, y1, ALTURA_DA_MESA, c.m.madeira, 5899)
  L.push(P(caixa(x0, y0, x1, y1, 0.9), c.m.madeira, { tabua: (x1 - x0) / 3, eixo: QUARTO, bisel: 1, contorno: 0.32, tom: 1.04, semente: 5900 }))
  const w = x1 - x0
  const h = y1 - y0
  // A bandeja de chapa com os espetos prontos.
  const bx0 = x0 + w * 0.1
  const bx1 = x1 - w * 0.1
  const by0 = y0 + h * 0.06
  const by1 = y0 + h * 0.5
  L.push(P(caixa(bx0, by0, bx1, by1, 1), ACO, { tabua: 0, bisel: 0.6, contorno: 0.3, metal: 0.35, tom: 0.9, semente: 5901, projeta: { dist: 0.7, forca: 0.3 } }))
  L.push(P(caixa(bx0 + 0.9, by0 + 0.9, bx1 - 0.9, by1 - 0.9, 0.6), ACO, { tabua: 0, bisel: 0, contorno: 0, metal: 0.2, tom: 0.84, recesso: { k: 1, forca: 0.3 }, semente: 5902 }))
  const prontos = [RECEITAS[0], RECEITAS[3], RECEITAS[1]]
  prontos.forEach((receita, i) => {
    const x = bx0 + ((bx1 - bx0) * (i + 0.5)) / prontos.length
    espeto(c, L, x, by0 + 1.2, by1 - 1.2, receita.slice(0, 3), true, 5910 + i * 10)
  })
  // As duas tigelas de barro: farofa e vinagrete.
  const r = Math.min(w, h) * 0.2
  for (const [fx, fy, recheio, textura, sem] of [
    [0.3, 0.74, FAROFA, texGraos(0.3, 0.12), 5950],
    [0.72, 0.8, VINAGRETE, texGraos(0.25, 0.3), 5955],
  ] as const) {
    const tx = x0 + w * fx
    const ty = y0 + h * fy
    L.push(P(elipse(tx, ty, r, r), BARRO, { tabua: 0, bisel: r * 0.45, contorno: 0.3, semente: sem, projeta: { dist: 0.9, forca: 0.32 } }))
    L.push(P(elipse(tx, ty, r * 0.74, r * 0.74), recheio, { tabua: 0, bisel: r * 0.3, contorno: 0.1, textura, recesso: { k: 0.9, forca: 0.24 }, semente: sem + 1 }))
  }
  // A colher de pau na farofa.
  const fx = x0 + w * 0.3
  const fy = y0 + h * 0.74
  L.push(P(barra(fx, fy, fx + r * 1.8, fy - r * 1.4, 1), BAMBU, { tabua: 0, bisel: 0.4, contorno: 0.3, semente: 5960, projeta: { dist: 0.6, forca: 0.3 } }))
}

/** A lona lisa: o pano, as duas costuras, o remendo, a bainha da frente e as amarras nos esteios da frente. */
function montarLona(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  const lona = c.m.toldo
  const x0 = LONA.x0 * hw
  const x1 = LONA.x1 * hw
  const y0 = LONA.y0 * hh
  const y1 = LONA.y1 * hh
  const pano = caixa(x0, y0, x1, y1, 1.4)
  // A estrutura da lona tem um VÃO em cima da mesa de trás: sem ele a mesa e o que vai nela (o meio de tudo fica
  // debaixo da lona) subiam com a lona e sumiam debaixo dela, e a mesa vazia virava um bloco da cor da lona. A
  // estrutura não pinta sombra (força 0); a sombra no chão é a do pano inteiro, deslocada como a de um tampo solto.
  // As peças da lona têm a caixa esticada até a faixa da frente, fora do vão (`naFaixa`).
  const z = c.g * ALTURA_DA_LONA
  const margem = 0.6
  const vao = caixa(MESA_DE_TRAS.x0 * hw - margem, MESA_DE_TRAS.y0 * hh - margem, MESA_DE_TRAS.x1 * hw + margem, MESA_DE_TRAS.y1 * hh + margem)
  cena.sombras.push(
    { forma: menos(pano, vao), z, solta: true, forca: 0 },
    { forma: deslocada(pano, SOMBRA_X * z, SOMBRA_Y * z), z: 0, suave: bordaDaSombra({ z }), forca: 0.3 },
  )
  const yDaFaixa = (MESA_DE_TRAS.y1 * hh + margem + y1) / 2
  const naFaixa = (f: Forma): Forma => comMeioEm(f, (f.b[0] + f.b[2]) / 2, yDaFaixa)
  L.push(P(naFaixa(pano), lona, { tabua: 0, bisel: 2, ruga: 1.3, contorno: 0.26, tom: 0.94, semente: 6000 }))
  const costura = { tabua: 0, bisel: 0, contorno: 0, alfa: 0.4, semente: 6001 }
  for (const f of [0.34, 0.67]) {
    const x = x0 + (x1 - x0) * f
    L.push(P(naFaixa(caixa(x - 0.35, y0 + 0.6, x + 0.35, y1 - 0.6)), CARVAO, costura))
  }
  // O remendo: um retalho da mesma lona, mais novo e por isso mais escuro (o pano de fora desbotou no sol).
  const rx = x0 + (x1 - x0) * 0.84
  const ry = y0 + (y1 - y0) * 0.4
  L.push(P(naFaixa(poligono([[rx - 4.6, ry - 3.2], [rx + 4.2, ry - 3.6], [rx + 4.8, ry + 3.4], [rx - 4.2, ry + 3.8]])), lona, { tabua: 0, bisel: 0.6, ruga: 1.3, contorno: 0.24, tom: 0.8, semente: 6002 }))
  // O espeto pintado no meio da lona: a vareta inclinada e três pedaços. É o letreiro da barraca, visto do alto.
  const ex = (x0 + x1) / 2 - (x1 - x0) * 0.08
  const ey = (y0 + y1) / 2
  const meio = (y1 - y0) * 0.5
  const tinta = { tabua: 0, bisel: 0, contorno: 0, ruga: 1.3, alfa: 0.78 }
  const ux = Math.cos(-0.32)
  const uy = Math.sin(-0.32)
  L.push(P(naFaixa(barra(ex - ux * meio, ey - uy * meio, ex + ux * meio, ey + uy * meio, 1.2)), TINTA_DA_LONA, { ...tinta, semente: 6005 }))
  const lado = (y1 - y0) * 0.2
  for (const t of [-0.32, 0.04, 0.4]) {
    const px = ex + ux * meio * t
    const py = ey + uy * meio * t
    L.push(P(naFaixa(barra(px - ux * lado * 0.5, py - uy * lado * 0.5, px + ux * lado * 0.5, py + uy * lado * 0.5, lado)), TINTA_DA_LONA, { ...tinta, semente: 6006 }))
  }
  // A bainha da frente, dobrada, e as amarras de corda nos esteios da frente.
  L.push(P(caixa(x0, y1 - 1.8, x1, y1, 0.6), lona, { tabua: 0, bisel: 0.6, ruga: 1.3, contorno: 0.3, tom: 0.84, semente: 6003 }))
  for (const lado of [-1, 1]) {
    const ex = lado * ESTEIO_X * hw
    const ey = (LONA.y1 + 0.02) * hh
    L.push(P(capsula(ex - lado * 2.2, ey - 2.6, ex + lado * 0.6, ey + 0.4, 0.55), CORDA, { tabua: 0, bisel: 0.4, contorno: 0.3, semente: 6004 }))
  }
}

/** A fumaça por cima de tudo: as nuvens do fogareiro para cima à direita, cada uma maior e mais rala. */
function montarFumaca(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  // Na 3/4 a fumaça toda sobe com o fogareiro: a caixa de cada nuvem é esticada até ter o meio dentro dele. Sem isso
  // a nuvem que sai da lona ficava no chão, e as de cima da mesa subiam com a mesa, cada uma numa altura.
  const fx0 = FOGAREIRO.x0 * hw + 1
  const fx1 = FOGAREIRO.x1 * hw - 1
  const fy0 = FOGAREIRO.y0 * hh + 1
  const fy1 = FOGAREIRO.y1 * hh - 1
  NUVENS.forEach(([fx, fy, fr, forca], i) => {
    const cx = fx * hw
    const cy = fy * hh
    const r = fr * R
    const nuvem = comMeioEm(elipseGirada(cx, cy, r * 1.25, r * 0.85, -0.6), Math.min(fx1, Math.max(fx0, cx)), Math.min(fy1, Math.max(fy0, cy)))
    cena.partes.push(P(nuvem, FUMACA, { tabua: 0, bisel: 0, contorno: 0, suave: 1.6, alfa: forca, textura: texFumaca(cx, cy, r * 1.25), semente: 6100 + i }))
  })
}

export const montarBarracaDeEspetinho: MontarMovel = (c, cena) => {
  montarMesaDeTras(c, cena)
  montarSaco(c, cena)
  montarFogareiro(c, cena)
  montarBancada(c, cena)
  montarEsteios(c, cena)
  montarLona(c, cena)
  montarFumaca(c, cena)
}
