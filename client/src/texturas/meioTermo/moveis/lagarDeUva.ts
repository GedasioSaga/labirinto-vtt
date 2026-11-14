/**
 * LAGAR (prensa de uva) de cima com volume (objetos de 14/11/2026, grupo
 * Cidade e vila): a prensa de cesto da vindima. Embaixo, o TABULEIRO de
 * tábuas com a borda alta, cheio do mosto que escorre, e uns cachos caídos
 * nos cantos; no meio, o CESTO de aduelas com frestas (o roxo do bagaço
 * aparece entre elas) e o aro de ferro de cima; dentro do cesto, os dois
 * meios-discos do PRATO e os CALÇOS cruzados; por cima de tudo, a PORCA de
 * catraca no fuso de ferro e a ALAVANCA comprida atravessada. Na frente, a
 * BICA do tabuleiro despeja o mosto num BALDE de aduelas.
 *
 * O que diz "prensa de uva" a 1x: o roxo do mosto e dos cachos em volta do
 * círculo de aduelas, a alavanca passando por cima do cesto e o fio roxo que
 * cai da bica no balde.
 *
 * NA 3/4 (`tresQuartos.ts`, derivado) o tabuleiro e o balde são colunas
 * baixas, o cesto uma coluna mais alta e a alavanca um tampo solto acima dele,
 * com o fuso de ferro como coluna no meio.
 *
 * Materiais: `madeira` (o tabuleiro, o cesto, o prato, os calços, a alavanca e
 * o balde) e `metal` (o fuso, a porca e os aros). O mosto e a uva são fixos.
 */
import { anel, barra, caixa, elipse, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { QUARTO, type MontarMovel } from './contexto'

/** Alturas, em casas: o tabuleiro, o balde, o cesto e a alavanca (com a porca no fuso). */
const ALTURA_DO_TABULEIRO = 0.3
const ALTURA_DO_BALDE = 0.24
const ALTURA_DO_CESTO = 0.7
const ALTURA_DA_ALAVANCA = 0.86

/** O tabuleiro (frações da pegada): a meia largura, o alto, o fim da frente e a grossura da borda. */
const MEIA_LARGURA = 0.47
const ALTO_DO_TABULEIRO = 0.01
const FRENTE_DO_TABULEIRO = 0.76
const BORDA = 0.075
/** O cesto: o raio (fração do lado do tabuleiro), a grossura das aduelas (fração do raio) e quantas são. */
const RAIO_DO_CESTO = 0.36
const GROSSURA_DAS_ADUELAS = 0.17
const ADUELAS = 16
/** A parte de cada aduela no passo dela (o resto é a fresta). */
const LARGURA_DA_ADUELA = 0.72
/** O vão entre as aduelas e o prato, onde o bagaço aparece (fração do raio), e quantos bagos se veem nele. */
const FOLGA_DO_PRATO = 0.16
const BAGOS_DO_BAGACO = 22
/** Onde o tabuleiro se divide em duas colunas na 3/4: este tanto (px do protótipo) antes do pé do cesto. */
const CORTE_ANTES_DO_CESTO = 0.5
/** A alavanca: o rumo (radianos) e o comprimento (em raios do cesto). */
const RUMO_DA_ALAVANCA = -0.42
const ALAVANCA = 1.32
/** O balde: o raio (fração do menor lado da pegada) e a bica (fração da largura). */
const RAIO_DO_BALDE = 0.11
const MEIA_BICA = 0.045

/** O mosto (roxo escuro, com brilho de líquido), o reflexo dele, o bagaço entre as aduelas, a uva e o talo. */
const MOSTO: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x2a, 0x38] }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0x9a, 0xa6] }
const BAGACO: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x26, 0x30] }
const UVA: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x34, 0x4e] }
const TALO: MaterialDaPeca = { classe: 'liso', rgb: [0x6c, 0x74, 0x48] }

/** Um cacho de uva com a ponta para `rumo`: bagos em fileiras que afinam, e o talo na base. */
function cacho(x: number, y: number, rumo: number, bago: number): Array<[Forma, MaterialDaPeca, number]> {
  const fileiras = [3, 3, 2, 1]
  const ux = Math.cos(rumo)
  const uy = Math.sin(rumo)
  const pecas: Array<[Forma, MaterialDaPeca, number]> = []
  pecas.push([barra(x - ux * bago * 1.6, y - uy * bago * 1.6, x - ux * bago * 0.2, y - uy * bago * 0.2, 0.9), TALO, 0])
  for (const [f, n] of fileiras.entries()) {
    for (let i = 0; i < n; i += 1) {
      const lateral = (i - (n - 1) / 2) * bago * 1.7
      const frente = f * bago * 1.45
      const bx = x + ux * frente - uy * lateral
      const by = y + uy * frente + ux * lateral
      pecas.push([elipse(bx, by, bago, bago), UVA, f * 3 + i])
    }
  }
  return pecas
}

/**
 * A forma com a caixa de pintura centrada em (x, y), a ÂNCORA, como a `presa`
 * da pedra de amolar: o desenho não muda, e o meio da caixa, que é o que a 3/4
 * lê para saber com que estrutura a peça sobe, cai na âncora. Aqui tudo é
 * concêntrico: sem a âncora, o mosto e o prato (com o meio debaixo da
 * alavanca) subiriam até ela.
 */
function ancorada(forma: Forma, x: number, y: number): Forma {
  const ax = Math.max(Math.abs(forma.b[0] - x), Math.abs(forma.b[2] - x))
  const ay = Math.max(Math.abs(forma.b[1] - y), Math.abs(forma.b[3] - y))
  return { b: [x - ax, y - ay, x + ax, y + ay], d: forma.d }
}

/**
 * A estrutura com a caixa esticada até `caixaToda` (a pegada inteira e mais um
 * pouco): a 3/4 pinta as estruturas pela base da caixa, e a alavanca, que é
 * mais alta que o cesto mas acaba antes do pé dele, tem de ser pintada depois
 * dele em qualquer giro. O desenho não muda.
 */
function pintadaDepois(forma: Forma, caixaToda: Caixa): Forma {
  const b = forma.b
  return { b: [Math.min(b[0], caixaToda[0]), Math.min(b[1], caixaToda[1]), Math.max(b[2], caixaToda[2]), Math.max(b[3], caixaToda[3])], d: forma.d }
}

/**
 * O sul da tela no referencial do lagar, por quarto de volta: a 3/4 pinta o
 * giro na cena antes de subir as peças (`girarCena`), então a parte "da
 * frente" do tabuleiro é a que fica embaixo na tela depois do giro.
 */
const SUL_NA_TELA: readonly Ponto[] = [[0, 1], [1, 0], [0, -1], [-1, 0]]

/**
 * O retângulo (x0, y0)-(x1, y1) cortado a `corte` px do meio do cesto (0, cy)
 * na direção do sul da tela (sx, sy): a parte de trás e a da frente.
 */
function cortarNoSul(x0: number, y0: number, x1: number, y1: number, cy: number, corte: number, [sx, sy]: Ponto): [Forma, Forma] {
  if (sy > 0) return [caixa(x0, y0, x1, cy + corte), caixa(x0, cy + corte, x1, y1)]
  if (sy < 0) return [caixa(x0, cy - corte, x1, y1), caixa(x0, y0, x1, cy - corte)]
  if (sx > 0) return [caixa(x0, y0, corte, y1), caixa(corte, y0, x1, y1)]
  return [caixa(-corte, y0, x1, y1), caixa(x0, y0, -corte, y1)]
}

export const montarLagarDeUva: MontarMovel = (c, cena) => {
  const { w, h, hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const metal = c.m.metal
  const L = cena.partes
  const xT = MEIA_LARGURA * w
  const yT0 = -hh + ALTO_DO_TABULEIRO * h
  const yT1 = -hh + FRENTE_DO_TABULEIRO * h
  const yC = (yT0 + yT1) / 2
  const borda = BORDA * Math.min(w, h)
  const R = RAIO_DO_CESTO * Math.min(2 * xT, yT1 - yT0)
  const aduela = GROSSURA_DAS_ADUELAS * R
  const rBalde = RAIO_DO_BALDE * Math.min(w, h)
  const yBalde = hh - rBalde - 0.01 * h
  const tabuleiro = caixa(-xT, yT0, xT, yT1, 1.6)

  // As alturas: o tabuleiro, o balde e o cesto são colunas; a alavanca (com a porca e a ponta do fuso) e a bica,
  // tampos no ar. A alavanca passa pelo meio do cesto, então o que é do cesto ou do tabuleiro vai ANCORADO.
  const rumo: Ponto = [Math.cos(RUMO_DA_ALAVANCA), Math.sin(RUMO_DA_ALAVANCA)]
  const meiaAlavanca = R * ALAVANCA
  const alavanca = barra(-rumo[0] * meiaAlavanca, yC - rumo[1] * meiaAlavanca, rumo[0] * meiaAlavanca, yC + rumo[1] * meiaAlavanca, 0.085 * R * 2)
  const bica = MEIA_BICA * w
  const yBica1 = yBalde - rBalde * 0.45
  const calha = caixa(-bica, yT1 - borda * 0.6, bica, yBica1, 0.8)
  // O tabuleiro são DUAS colunas, cortadas logo antes do pé do cesto: a 3/4 pinta do norte para o sul pela base de
  // cada estrutura, então a parte de trás (o mosto, as tábuas do lado) vai antes do cesto e a de frente (a tábua da
  // frente e a faixa de mosto na frente do cesto) depois, tapando o pé dele como a borda tapa de verdade. O corte
  // segue o giro: a frente é sempre a parte que fica embaixo na tela.
  const sul = SUL_NA_TELA[((Math.round(c.giro / 90) % 4) + 4) % 4]
  const corte = R - CORTE_ANTES_DO_CESTO
  const [tras, frente] = cortarNoSul(-xT, yT0, xT, yT1, yC, corte, sul)
  const margem = CORTE_ANTES_DO_CESTO
  cena.sombras.push(
    contato(tabuleiro, 0.32),
    { forma: tras, z: g * ALTURA_DO_TABULEIRO },
    { forma: frente, z: g * ALTURA_DO_TABULEIRO },
    { forma: elipse(0, yC, R, R), z: g * ALTURA_DO_CESTO },
    { forma: pintadaDepois(alavanca, [-hw - margem, -hh - margem, hw + margem, hh + margem]), z: g * ALTURA_DA_ALAVANCA, solta: true, forca: 0.32 },
    { forma: calha, z: g * ALTURA_DO_TABULEIRO, solta: true, forca: 0.22 },
    contato(elipse(0, yBalde, rBalde, rBalde * 0.96), 0.32),
    { forma: elipse(0, yBalde, rBalde, rBalde * 0.96), z: g * ALTURA_DO_BALDE },
  )
  // A âncora do tabuleiro (num canto da parte de trás, longe do cesto e da alavanca) e a do cesto (na frente dele).
  const xAncora = (sul[0] !== 0 ? -sul[0] : -1) * (xT - borda * 1.5)
  const yAncora = yC + (sul[1] !== 0 ? -sul[1] : -1) * ((yT1 - yT0) / 2 - borda * 1.5)
  const noTabuleiro = (f: Forma): Forma => ancorada(f, xAncora, yAncora)
  const noCesto = (f: Forma): Forma => ancorada(f, 0, yC + R * 0.62)

  // O FUNDO de tábuas do tabuleiro, todo coberto: é a maior peça dele e dá a madeira da frente na 3/4.
  L.push(P(noTabuleiro(caixa(-xT, yT0, xT, yT1, 1.6)), mad, { tabua: 0, bisel: 0, tom: 0.8, semente: 9 }))
  // O MOSTO no fundo do tabuleiro, com dois reflexos compridos, e os cachos caídos nos cantos.
  L.push(P(noTabuleiro(caixa(-xT + borda - 1, yT0 + borda - 1, xT - borda + 1, yT1 - borda + 1, 1)), MOSTO, { tabua: 0, bisel: 0, contorno: 0.2, metal: 0.4, semente: 10 }))
  // A faixa de mosto na frente do cesto, da parte de frente do tabuleiro (na vista de cima é o mesmo mosto).
  L.push(P(cortarNoSul(-xT + borda - 1, yT0 + borda - 1, xT - borda + 1, yT1 - borda + 1, yC, corte, sul)[1], MOSTO, { tabua: 0, bisel: 0, contorno: 0, metal: 0.4, semente: 10 }))
  for (const [i, [x0, y0, x1, y1]] of ([[-0.3, 0.18, -0.12, 0.13], [0.18, 0.86, 0.32, 0.82]] as const).entries()) {
    const yDe = (t: number): number => yT0 + t * (yT1 - yT0)
    L.push(P(barra(x0 * w, yDe(y0), x1 * w, yDe(y1), 0.9), REFLEXO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.4, semente: 11 + i }))
  }
  const bago = 0.024 * Math.min(w, h)
  const cantos: Array<[number, number, number]> = [
    [-xT + borda + bago * 2.2, yT0 + borda + bago * 2, 0.75],
    [xT - borda - bago * 2.4, yT1 - borda - bago * 2.4, -2.4],
    [-xT + borda + bago * 2.4, yT1 - borda - bago * 3, -0.6],
  ]
  for (const [k, [x, y, r]] of cantos.entries()) {
    for (const [forma, mat, s] of cacho(x, y, r, bago)) {
      L.push(P(forma, mat, { tabua: 0, bisel: bago * 0.7, contorno: 0.3, metal: mat === UVA ? 0.35 : 0, tom: mat === UVA ? 0.92 + (s % 3) * 0.06 : 1, semente: 20 + k * 20 + s }))
    }
  }

  // A BORDA do tabuleiro: as duas tábuas do comprido e as duas das pontas, com o pé da bica na da frente.
  L.push(P(caixa(-xT, yT0, -xT + borda, yT1, 1.4), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, tom: 0.94, semente: 80 }))
  L.push(P(caixa(xT - borda, yT0, xT, yT1, 1.4), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, tom: 0.94, semente: 81 }))
  L.push(P(caixa(-xT + borda - 0.5, yT0, xT - borda + 0.5, yT0 + borda, 1), mad, { tabua: 0, bisel: 1.3, tom: 1.02, semente: 82 }))
  L.push(P(caixa(-xT + borda - 0.5, yT1 - borda, xT - borda + 0.5, yT1, 1), mad, { tabua: 0, bisel: 1.3, tom: 1.02, semente: 83 }))

  // A BICA: a calha de madeira que sai da frente, o fio de mosto e o BALDE de aduelas com o aro de ferro.
  L.push(P(calha, mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 1.06, semente: 84, projeta: { dist: 1, forca: 0.3 } }))
  L.push(P(caixa(-bica * 0.45, yT1 - borda * 0.6, bica * 0.45, yBica1 - 0.6, 0.6), MOSTO, { tabua: 0, bisel: 0, contorno: 0.2, metal: 0.4, semente: 85 }))
  // O aro do balde fica por dentro da beira das aduelas: a madeira é a maior peça e dá a frente do balde na 3/4.
  L.push(P(elipse(0, yBalde, rBalde, rBalde * 0.96), mad, { tabua: 2.6, bisel: 1.2, tom: 0.9, polar: { cx: 0, cy: yBalde, r: rBalde }, semente: 86 }))
  L.push(P(anel(0, yBalde, rBalde * 0.97, rBalde * 0.93, rBalde * 0.86, rBalde * 0.82), metal, { bisel: 0.4, contorno: 0.26, metal: 0.5, semente: 88 }))
  L.push(P(elipse(0, yBalde, rBalde * 0.74, rBalde * 0.7), MOSTO, { tabua: 0, bisel: 0, contorno: 0.24, metal: 0.45, recesso: { k: 1, forca: 0.3 }, semente: 87 }))
  L.push(P(elipse(0, yBica1 + 1.4, bica * 0.4, 1.6), MOSTO, { tabua: 0, bisel: 0.4, contorno: 0.2, metal: 0.5, semente: 89 }))

  // O CESTO: o corpo de aduelas (a maior peça dele: a frente na 3/4 sai de aduelas em pé), o bagaço escuro que
  // aparece entre as aduelas e dentro delas, as aduelas e o aro de ferro de cima.
  L.push(P(noCesto(elipse(0, yC, R, R)), mad, { polar: { cx: 0, cy: yC, r: R }, tabua: (Math.PI * 2 * R) / ADUELAS, bisel: 1, tom: 0.86, semente: 89 }))
  L.push(P(noCesto(elipse(0, yC, R - 0.6, R - 0.6)), BAGACO, { tabua: 0, bisel: 0, contorno: 0.2, semente: 90 }))
  const passo = (Math.PI * 2) / ADUELAS
  for (let i = 0; i < ADUELAS; i += 1) {
    const a0 = i * passo
    const a1 = a0 + passo * LARGURA_DA_ADUELA
    const pts: Ponto[] = []
    for (const [r, as] of [[R - aduela, [a0, a1]], [R, [a1, a0]]] as const) {
      for (const a of as) pts.push([Math.cos(a) * r, yC + Math.sin(a) * r])
    }
    L.push(P(poligono(pts), mad, { eixo: a0 + passo / 2 + QUARTO, tabua: 0, bisel: 0.6, tom: 0.9 + ((i * 7) % 5) * 0.035, contorno: 0.26, semente: 100 + i }))
  }
  L.push(P(noCesto(anel(0, yC, R - 0.2, R - 0.2, R - 1.8, R - 1.8)), metal, { bisel: 0.4, contorno: 0.26, metal: 0.5, semente: 120 }))

  // O BAGAÇO de uva esmagada à mostra entre as aduelas e o prato: bagos partidos, mais claros que o fundo.
  const rPrato = R * (1 - GROSSURA_DAS_ADUELAS - FOLGA_DO_PRATO)
  for (let i = 0; i < BAGOS_DO_BAGACO; i += 1) {
    const a = (i / BAGOS_DO_BAGACO) * Math.PI * 2 + (i % 2) * 0.17
    const r = (rPrato + R - aduela) / 2 + ((i % 3) - 1) * 0.6
    L.push(P(noCesto(elipse(Math.cos(a) * r, yC + Math.sin(a) * r, 1.1, 1)), UVA, { tabua: 0, bisel: 0.6, contorno: 0.3, metal: 0.3, tom: 0.86 + (i % 4) * 0.07, semente: 140 + i }))
  }

  // O PRATO: dois meios-discos de tábua, com a fresta entre eles, afundado no cesto (a borda de cima faz sombra).
  L.push(P(noCesto(elipse(0, yC, rPrato, rPrato)), mad, { tabua: 0, bisel: 1, tom: 0.98, semente: 121, recesso: { k: 2, forca: 0.3 }, projeta: { dist: 1.2, forca: 0.3 } }))
  L.push(P(noCesto(caixa(-rPrato + 0.6, yC - 0.35, rPrato - 0.6, yC + 0.35)), BAGACO, { tabua: 0, bisel: 0, contorno: 0, semente: 126 }))

  // Os CALÇOS cruzados: dois de comprido embaixo, dois de través por cima.
  const calco = 0.2 * R
  const comp = 0.56 * R
  for (const [i, s] of [-1, 1].entries()) {
    L.push(P(noCesto(caixa(-comp, yC + s * calco * 0.6 - calco / 2, comp, yC + s * calco * 0.6 + calco / 2, 0.8)), mad, { tabua: 0, bisel: 1, tom: 0.92, semente: 122 + i, projeta: { dist: 1.2, forca: 0.32, suave: 0.6 } }))
  }
  for (const [i, s] of [-1, 1].entries()) {
    L.push(P(noCesto(caixa(s * calco * 0.6 - calco / 2, yC - comp * 0.8, s * calco * 0.6 + calco / 2, yC + comp * 0.8, 0.8)), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: 1.08, semente: 124 + i, projeta: { dist: 1.3, forca: 0.34, suave: 0.6 } }))
  }

  // A ALAVANCA atravessada e a PORCA de catraca no fuso, com a ponta do fuso no meio.
  L.push(P(alavanca, mad, { eixo: RUMO_DA_ALAVANCA, tabua: 0, bisel: 1.4, tom: 1.06, contorno: 0.26, semente: 130, projeta: { dist: 2.2, forca: 0.36, suave: 1 } }))
  const dentes: Ponto[] = []
  const rPorca = 0.26 * R
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2
    const r = i % 2 === 0 ? rPorca : rPorca * 0.82
    dentes.push([Math.cos(a) * r, yC + Math.sin(a) * r])
  }
  L.push(P(poligono(dentes), metal, { bisel: 1, contorno: 0.3, metal: 0.55, semente: 131, projeta: { dist: 1.2, forca: 0.34 } }))
  L.push(P(elipse(0, yC, rPorca * 0.46, rPorca * 0.46), metal, { bisel: rPorca * 0.3, contorno: 0.3, metal: 0.6, tom: 1.1, semente: 132 }))
}
