/**
 * PILHA DE CAIXAS de cima com volume (lote 6 dos objetos novos, 11/11/2026):
 * seis caixotes de madeira de tamanhos diferentes, empilhados em dois andares
 * e um pouco tortos. No chão, o CAIXOTE COMPRIDO do fundo (baixo), o GRANDE da
 * frente e o da direita; em cima deles, um pequeno atravessado no comprido, um
 * médio AMARRADO no grande (a corda cruza por cima dele, desce e segue pelo
 * tampo do grande até a beira, com o nó no meio) e outro pequeno no da direita.
 * Num canto da frente, a LONA que escorregou: metade ainda em cima do caixote,
 * metade caída no chão, na sombra dele.
 *
 * O que diz "pilha" e não "uma caixa grande": cada caixote tem o giro, o tom e
 * a tampa dele (moldura com os sarrafos em cruz, moldura com um sarrafo só, ou
 * tampa de tábuas com duas travessas pregadas), os de cima são mais claros e
 * fazem sombra nos de baixo, mais longa quanto maior o degrau, e a sombra no
 * chão sai da altura de cada um. As marcas de estêncil (a seta "este lado para
 * cima", o aro partido, as três barras) ficam nas tampas de tábuas.
 *
 * A 25% de zoom sobram os quadrados claros desencontrados sobre os escuros, o
 * X dos sarrafos e a mancha clara da lona. As posições são frações da pegada
 * (1,5 x 1,5 casas de partida) e os lados, do menor lado: a pilha esticada
 * afasta os caixotes. Materiais: `madeira` e `lona`; a corda e a tinta são fixas.
 */
import { anel, barra, caixa, capsula, dentroDe, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, TOM_DA_CORDA, type Cena, type MaterialDaPeca, type OpcoesDaPeca } from './motor'
import { PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Como o caixote é fechado por cima. */
type Tampa = 'cruz' | 'diagonal' | 'travessas'
/** A marca de estêncil na tampa. */
type Marca = 'seta' | 'aro' | 'barras'

interface Caixote {
  /** O meio, em frações da meia pegada. */
  readonly x: number
  readonly y: number
  /** Os lados, em frações do menor meio lado. */
  readonly larg: number
  readonly alt: number
  readonly ang: number
  /** A altura do tampo, em casas, e o degrau até o que está embaixo dele (0 = está no chão). */
  readonly topo: number
  readonly degrau: number
  readonly tampa: Tampa
  readonly tom: number
  /** A marca: onde o meio dela fica na tampa (frações dos meios lados) e o tamanho (fração do menor meio lado). */
  readonly marca?: { readonly tipo: Marca; readonly x: number; readonly y: number; readonly tam: number }
}

/**
 * Os três do chão: o comprido e baixo do fundo, o grande da frente e o da
 * direita. São os mais escuros: a luz chega de cima e os de cima os tapam.
 */
const DO_FUNDO: Caixote = { x: 0.05, y: -0.585, larg: 1.48, alt: 0.64, ang: 0.05, topo: 0.36, degrau: 0, tampa: 'travessas', tom: 0.8, marca: { tipo: 'aro', x: 0.34, y: 0, tam: 0.74 } }
const GRANDE: Caixote = { x: -0.44, y: 0.335, larg: 0.95, alt: 1.07, ang: -0.07, topo: 0.55, degrau: 0, tampa: 'cruz', tom: 0.86 }
const DA_DIREITA: Caixote = { x: 0.48, y: 0.26, larg: 0.74, alt: 0.74, ang: 0.14, topo: 0.5, degrau: 0, tampa: 'diagonal', tom: 0.9 }
/**
 * Os três de cima, do mais baixo para o mais alto: cada um faz sombra no que
 * está embaixo. Ficam tortos e saem um pouco da beira do de baixo (o amarrado,
 * pela quina da esquerda; o pequeno da direita, pelo fundo).
 */
const PEQUENO_DO_FUNDO: Caixote = { x: -0.31, y: -0.62, larg: 0.45, alt: 0.4, ang: -0.17, topo: 0.66, degrau: 0.3, tampa: 'travessas', tom: 1.04, marca: { tipo: 'barras', x: 0, y: 0, tam: 0.4 } }
const PEQUENO_DA_DIREITA: Caixote = { x: 0.595, y: 0.095, larg: 0.45, alt: 0.43, ang: -0.28, topo: 0.82, degrau: 0.32, tampa: 'cruz', tom: 1.1 }
const AMARRADO: Caixote = { x: -0.548, y: 0.405, larg: 0.67, alt: 0.64, ang: 0.26, topo: 0.95, degrau: 0.4, tampa: 'travessas', tom: 1.08, marca: { tipo: 'seta', x: 0.3, y: -0.5, tam: 0.34 } }

/** A largura da tábua da moldura e do sarrafo, em fração do menor lado do caixote (a da caixa do catálogo). */
const MOLDURA = 0.17
/** O canto do caixote (px do protótipo). */
const CANTO = 0.6
/** O fundo do caixote, por baixo de tudo: só o contorno dele aparece, escuro. */
const TOM_DO_FUNDO = 0.62
/** A tampa de tábuas: quantas tábuas, e onde ficam as travessas (fração da meia largura). */
const TABUAS_DA_TAMPA = 4
const ONDE_FICA_A_TRAVESSA = 0.66
/**
 * Quanto a sombra de um caixote anda no tampo do de baixo, por px de degrau: o
 * passo da sombra no chão (`SOMBRA_X`, `SOMBRA_Y`), um pouco esticado: é essa
 * sombra que diz que um caixote está em cima do outro.
 */
const ALCANCE_DA_SOMBRA = Math.hypot(SOMBRA_X, SOMBRA_Y) * 1.25
const FORCA_DA_SOMBRA_NO_DE_BAIXO = 0.46
/** A sombra no chão dos caixotes de cima, mais firme que a padrão da altura deles (0,22). */
const FORCA_DA_SOMBRA_DOS_DE_CIMA = 0.3

/** A tinta do estêncil: fuligem quente, meio transparente (a madeira aparece por baixo). */
const ESTENCIL: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x2b, 0x26] }
const TINTA: OpcoesDaPeca = { bisel: 0, contorno: 0, alfa: 0.6, suave: 0.3 }
/** A corda da amarra: a palha clara da corda da cerca, com a torção. */
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
const RAIO_DA_CORDA = 0.95
/** A dobra da lona: o escuro quente, meio transparente. */
const DOBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x21, 0x18] }
/** A lona em cima do caixote e a parte caída no chão, na sombra dele. */
const TOM_DA_LONA = 0.95
const TOM_DA_LONA_NO_CHAO = 0.72

/**
 * A lona, em frações da meia pegada: um pano de quatro pontas, com as beiras
 * um pouco para dentro (o pano frouxo). A primeira ponta ficou em cima do
 * caixote da direita; as outras três caíram no chão, pela direita e pela
 * frente dele. É a forma de quatro pontas, com os ilhoses, que diz "lona" e
 * não "pedra".
 */
const PONTAS_DA_LONA: readonly Ponto[] = [[0.524, 0.405], [0.976, 0.357], [0.976, 0.964], [0.333, 0.929]]
const BEIRAS_DA_LONA: readonly Ponto[] = [[0.75, 0.42], [0.948, 0.667], [0.643, 0.914], [0.468, 0.679]]
/** O ilhós de cada ponta: o quanto ele fica para dentro (px do protótipo) e os raios do anel. */
const RECUO_DO_ILHOS = 2.1
const RAIO_DO_ILHOS = 0.95
/** As dobras: da quina do caixote para as pontas e as beiras caídas, e uma no tampo (frações da meia pegada). */
const DOBRAS: readonly (readonly [Ponto, Ponto])[] = [
  [[0.81, 0.7], [0.94, 0.92]],
  [[0.77, 0.72], [0.66, 0.89]],
  [[0.74, 0.7], [0.4, 0.9]],
  [[0.84, 0.66], [0.95, 0.4]],
  [[0.57, 0.45], [0.72, 0.6]],
]

/** A forma `f`, desenhada em volta da origem, girada `ang` e levada para (cx, cy). */
function girada(f: Forma, cx: number, cy: number, ang: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const [x0, y0, x1, y1] = f.b
  const xs: number[] = []
  const ys: number[] = []
  for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
    xs.push(cx + x * co - y * si)
    ys.push(cy + x * si + y * co)
  }
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d(x, y) {
      const dx = x - cx
      const dy = y - cy
      return f.d(dx * co + dy * si, -dx * si + dy * co)
    },
  }
}

/** Onde o caixote fica na pegada: o meio, os meios lados (px do protótipo), o giro e o contorno dele. */
interface Lugar {
  readonly x: number
  readonly y: number
  readonly a: number
  readonly b: number
  readonly ang: number
  readonly contorno: Forma
}

function lugarDo(c: ContextoDoMovel, cx: Caixote): Lugar {
  const R = Math.min(c.hw, c.hh)
  const a = (cx.larg * R) / 2
  const b = (cx.alt * R) / 2
  const x = cx.x * c.hw
  const y = cx.y * c.hh
  return { x, y, a, b, ang: cx.ang, contorno: girada(caixa(-a, -b, a, b, CANTO), x, y, cx.ang) }
}

/** Põe uma peça desenhada no referencial do caixote (em volta do meio dele, sem giro). */
type Por = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaPeca) => void

function porNoLugar(c: ContextoDoMovel, cena: Cena, lugar: Lugar): Por {
  return (forma, mat, o) => {
    cena.partes.push(c.peca(girada(forma, lugar.x, lugar.y, lugar.ang), mat, { ...o, eixo: (o.eixo ?? 0) + lugar.ang }))
  }
}

/** A moldura de 4 tábuas com as tábuas afundadas no meio e os sarrafos por cima: em cruz, ou um só. */
function tampaDeMoldura(por: Por, a: number, b: number, mad: MaterialDaPeca, emCruz: boolean, tom: number, sem: number): void {
  const m = Math.min(a, b) * 2 * MOLDURA
  const dentro = caixa(-a + m, -b + m, a - m, b - m)
  por(dentro, mad, { tabua: (2 * (b - m)) / 3, bisel: 0.5, recesso: { k: 2, forca: 0.34 }, tom: tom * 0.9, semente: sem + 1 })
  const larg = m * 0.9
  const subida = Math.atan2(b - m, a - m)
  por(dentroDe(barra(-a + m, -b + m, a - m, b - m, larg), dentro), mad, { eixo: subida, tabua: 0, bisel: 0.9, tom, semente: sem + 2 })
  if (emCruz) por(dentroDe(barra(a - m, -b + m, -a + m, b - m, larg), dentro), mad, { eixo: Math.PI - subida, tabua: 0, bisel: 0.9, tom, semente: sem + 3, projeta: { dist: 1.1, forca: 0.3, suave: 0.7 } })
  por(caixa(-a, -b, -a + m, b, CANTO), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom, semente: sem + 4 })
  por(caixa(a - m, -b, a, b, CANTO), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom, semente: sem + 5 })
  por(caixa(-a + m, -b, a - m, -b + m, 0.3), mad, { tabua: 0, bisel: 1, tom, semente: sem + 6 })
  por(caixa(-a + m, b - m, a - m, b, 0.3), mad, { tabua: 0, bisel: 1, tom, semente: sem + 7 })
  for (const [px, py] of [[-a + m / 2, -b + m / 2], [a - m / 2, -b + m / 2], [-a + m / 2, b - m / 2], [a - m / 2, b - m / 2]]) {
    por(elipse(px, py, 0.6, 0.6), PREGO, { bisel: 0.6, contorno: 0, metal: 0.2 })
  }
}

/** A tampa de tábuas ao comprido, com duas travessas pregadas por cima, uma perto de cada ponta. */
function tampaDeTravessas(por: Por, a: number, b: number, mad: MaterialDaPeca, tom: number, sem: number): void {
  por(caixa(-a + 0.4, -b + 0.4, a - 0.4, b - 0.4, 0.5), mad, { tabua: (2 * b - 0.8) / TABUAS_DA_TAMPA, bisel: 1, tom, semente: sem + 1 })
  const larg = Math.min(a, b) * 2 * MOLDURA * 0.85
  for (const lado of [-1, 1]) {
    const xt = lado * a * ONDE_FICA_A_TRAVESSA
    por(caixa(xt - larg / 2, -b + 0.2, xt + larg / 2, b - 0.2, 0.4), mad, { eixo: QUARTO, tabua: 0, bisel: 0.9, tom: tom * 1.07, semente: sem + 3 + lado, projeta: { dist: 0.9, forca: 0.28, suave: 0.7 } })
    for (const fy of [-0.7, 0, 0.7]) por(elipse(xt, fy * b, 0.55, 0.55), PREGO, { bisel: 0.5, contorno: 0, metal: 0.2 })
  }
}

/** As três barras do estêncil: a meia largura de cada uma, da de cima para a de baixo (frações do tamanho). */
const BARRAS_DO_ESTENCIL: readonly number[] = [0.6, 0.44, 0.28]

/** A marca de estêncil, com as pontes da chapa (os vãos sem tinta): (mx, my) = o meio dela na tampa, `s` = o tamanho. */
function marcar(por: Por, marca: Marca, mx: number, my: number, s: number): void {
  switch (marca) {
    case 'seta':
      // "Este lado para cima": a ponta e a haste, separadas pela ponte.
      por(poligono([[mx - s * 0.52, my - s * 0.06], [mx, my - s * 0.66], [mx + s * 0.52, my - s * 0.06]]), ESTENCIL, TINTA)
      por(caixa(mx - s * 0.17, my + s * 0.06, mx + s * 0.17, my + s * 0.62), ESTENCIL, TINTA)
      return
    case 'aro':
      // O aro partido em dois pela ponte, com o miolo.
      por(menos(anel(mx, my, s * 0.62, s * 0.62, s * 0.4, s * 0.4), caixa(mx - s * 0.09, my - s, mx + s * 0.09, my + s)), ESTENCIL, TINTA)
      por(elipse(mx, my, s * 0.16, s * 0.16), ESTENCIL, TINTA)
      return
    case 'barras':
      // Três barras, cada uma mais curta que a de cima.
      BARRAS_DO_ESTENCIL.forEach((meia, i) => {
        const y = my + (i - 1) * s * 0.46
        por(caixa(mx - s * meia, y - s * 0.13, mx + s * meia, y + s * 0.13), ESTENCIL, TINTA)
      })
  }
}

/** Um caixote no lugar dele: a sombra no chão, o fundo (que faz a sombra no caixote de baixo), a tampa e a marca. */
function montarCaixote(c: ContextoDoMovel, cena: Cena, cx: Caixote, sem: number): Lugar {
  const mad = c.m.madeira
  const lugar = lugarDo(c, cx)
  const { a, b } = lugar
  const por = porNoLugar(c, cena, lugar)
  const emCima = cx.degrau > 0
  if (emCima) cena.sombras.push({ forma: lugar.contorno, z: c.g * cx.topo, forca: FORCA_DA_SOMBRA_DOS_DE_CIMA })
  else cena.sombras.push({ forma: lugar.contorno, z: c.g * cx.topo }, contato(lugar.contorno, 0.3))
  por(caixa(-a, -b, a, b, CANTO), mad, {
    tabua: 0,
    bisel: 0.8,
    tom: cx.tom * TOM_DO_FUNDO,
    contorno: 0.3,
    semente: sem,
    projeta: emCima ? { dist: c.g * cx.degrau * ALCANCE_DA_SOMBRA, forca: FORCA_DA_SOMBRA_NO_DE_BAIXO, suave: 1.3 } : undefined,
  })
  if (cx.tampa === 'travessas') tampaDeTravessas(por, a, b, mad, cx.tom, sem)
  else tampaDeMoldura(por, a, b, mad, cx.tampa === 'cruz', cx.tom, sem)
  if (cx.marca !== undefined) marcar(por, cx.marca.tipo, cx.marca.x * a, cx.marca.y * b, cx.marca.tam * Math.min(a, b))
  return lugar
}

/**
 * As duas voltas da corda, no esquadro do caixote grande e cruzando no meio do
 * amarrado: no referencial do grande, de beira a beira. `so` = só o pedaço
 * dentro dessa forma (o que passa por cima do amarrado).
 */
function amarrar(c: ContextoDoMovel, cena: Cena, grande: Lugar, amarrado: Lugar, so: Forma | null, sem: number): void {
  const co = Math.cos(grande.ang)
  const si = Math.sin(grande.ang)
  const dx = amarrado.x - grande.x
  const dy = amarrado.y - grande.y
  const nx = dx * co + dy * si
  const ny = -dx * si + dy * co
  const voltas: readonly (readonly [Forma, number])[] = [
    [capsula(-grande.a + 0.4, ny, grande.a - 0.4, ny, RAIO_DA_CORDA), 0],
    [capsula(nx, -grande.b + 0.4, nx, grande.b - 0.4, RAIO_DA_CORDA), QUARTO],
  ]
  voltas.forEach(([volta, eixo], i) => {
    const noLugar = girada(volta, grande.x, grande.y, grande.ang)
    cena.partes.push(c.peca(so === null ? noLugar : dentroDe(noLugar, so), CORDA, { eixo: eixo + grande.ang, bisel: RAIO_DA_CORDA, contorno: 0.3, semente: sem + i, projeta: { dist: 0.9, forca: 0.3, suave: 0.7 } }))
  })
}

/** O nó no cruzamento da corda e as duas pontas soltas. */
function darONo(c: ContextoDoMovel, cena: Cena, x: number, y: number, sem: number): void {
  const P = c.peca
  for (const [px, py] of [[3.6, 2.4], [-1.6, 4]]) {
    cena.partes.push(P(capsula(x, y, x + px, y + py, RAIO_DA_CORDA * 0.8), CORDA, { eixo: Math.atan2(py, px), bisel: RAIO_DA_CORDA * 0.8, contorno: 0.3, semente: sem, projeta: { dist: 0.7, forca: 0.26, suave: 0.6 } }))
  }
  cena.partes.push(P(elipse(x, y, RAIO_DA_CORDA * 2.1, RAIO_DA_CORDA * 1.8), CORDA, { bisel: RAIO_DA_CORDA * 1.6, contorno: 0.32, tom: 0.94, semente: sem + 1, projeta: { dist: 0.9, forca: 0.3, suave: 0.7 } }))
}

/**
 * A lona que escorregou: o pano inteiro no tom da sombra (a parte caída no
 * chão) e, por cima, o pedaço que ainda está no tampo do caixote, claro: o
 * degrau de tom na beira do caixote é a dobra do pano que desce. Depois as
 * dobras e o ilhós de cada ponta.
 */
function estenderLona(c: ContextoDoMovel, cena: Cena, caixote: Lugar, sem: number): void {
  const { hw, hh, peca: P } = c
  const lona = c.m.lona
  const naPegada = ([x, y]: Ponto): Ponto => [x * hw, y * hh]
  const pontas = PONTAS_DA_LONA.map(naPegada)
  const pano = poligono(pontas.flatMap((ponta, i): Ponto[] => [ponta, naPegada(BEIRAS_DA_LONA[i])]))
  cena.sombras.push({ forma: pano, z: c.g * 0.05, forca: 0.24 }, contato(pano, 0.26))
  const L = cena.partes
  L.push(P(pano, lona, { bisel: 1, ruga: 1.5, contorno: 0.3, tom: TOM_DA_LONA_NO_CHAO, semente: sem }))
  L.push(P(dentroDe(pano, caixote.contorno), lona, { bisel: 0.9, ruga: 1.5, contorno: 0.12, tom: TOM_DA_LONA, semente: sem + 1, projeta: { dist: 1, forca: 0.26, suave: 0.9 } }))
  DOBRAS.forEach(([de, ate], i) => {
    const [ax, ay] = naPegada(de)
    const [bx, by] = naPegada(ate)
    L.push(P(capsula(ax, ay, bx, by, 0.5), DOBRA, { bisel: 0, contorno: 0, alfa: 0.24, suave: 0.7, semente: sem + 2 + i }))
  })
  const meioX = pontas.reduce((soma, [x]) => soma + x, 0) / pontas.length
  const meioY = pontas.reduce((soma, [, y]) => soma + y, 0) / pontas.length
  for (const [x, y] of pontas) {
    const ate = Math.hypot(meioX - x, meioY - y) || 1
    const ix = x + ((meioX - x) / ate) * RECUO_DO_ILHOS
    const iy = y + ((meioY - y) / ate) * RECUO_DO_ILHOS
    L.push(P(anel(ix, iy, RAIO_DO_ILHOS, RAIO_DO_ILHOS, RAIO_DO_ILHOS * 0.45, RAIO_DO_ILHOS * 0.45), PREGO, { bisel: 0.5, contorno: 0.2, metal: 0.25 }))
  }
}

export const montarPilhaDeCaixas: MontarMovel = (c, cena) => {
  // De baixo para cima: os do chão; a corda no tampo do grande e a lona no da direita; os de cima, o mais alto por último.
  montarCaixote(c, cena, DO_FUNDO, 4100)
  const grande = montarCaixote(c, cena, GRANDE, 4120)
  const daDireita = montarCaixote(c, cena, DA_DIREITA, 4140)
  const amarrado = lugarDo(c, AMARRADO)
  amarrar(c, cena, grande, amarrado, null, 4160)
  estenderLona(c, cena, daDireita, 4170)
  montarCaixote(c, cena, PEQUENO_DO_FUNDO, 4180)
  montarCaixote(c, cena, PEQUENO_DA_DIREITA, 4200)
  montarCaixote(c, cena, AMARRADO, 4220)
  amarrar(c, cena, grande, amarrado, amarrado.contorno, 4240)
  darONo(c, cena, amarrado.x, amarrado.y, 4250)
}
