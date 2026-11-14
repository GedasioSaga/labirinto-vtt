/**
 * ARQUIBANCADA DE TORNEIO de cima com volume (lote L13 dos objetos novos,
 * 14/11/2026, grupo Descanso e brincadeira): a bancada de madeira de onde o
 * povo e os nobres veem a justa. Os DEGRAUS de tábua sobem da frente (embaixo
 * na tela, virada para a liça) para trás; cada degrau é um banco de duas
 * tábuas ao comprido, com a quina da frente clara e as fileiras de pregos
 * onde passam as vigas de baixo, e o degrau de cima faz sombra no de baixo.
 * No meio, o CORREDOR com os meios-degraus para subir. Nas pontas, as
 * LATERAIS da armação. Na frente, o PANO listrado pendurado na beira do
 * primeiro degrau, com os bicos da barra. No degrau de cima, as ALMOFADAS dos
 * nobres. Atrás, o GUARDA-CORPO em postes e, nos dois cantos, os MASTROS com
 * as FLÂMULAS de duas pontas ao vento.
 *
 * O que diz "arquibancada" a 25% de zoom são as faixas claras paralelas com a
 * sombra de degrau entre elas e o corredor no meio; o pano listrado e as
 * flâmulas dizem "torneio".
 *
 * É OBJETO DE CHÃO (como o palco de bardo): anda-se em cima, e só o objeto de
 * chão fica debaixo dos tokens e dos outros objetos nas duas vistas.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) cada degrau é uma coluna da altura
 * dele: pintados do norte para o sul, o de baixo tapa a frente do de cima até
 * a altura dele e sobra o espelho do degrau. No corredor, a metade da frente
 * de cada degrau é um meio-degrau mais baixo, com a coluna própria (o degrau
 * tem o vão recortado); a forma dele passa um nada da beira do degrau, para
 * ser pintado depois dele. O pano tem a caixa com o meio no primeiro degrau
 * (sobe com ele e cobre o espelho dele). Os postes e os mastros são colunas;
 * o guarda-corpo e as flâmulas, tampos soltos.
 *
 * Esticada para baixo ganha mais degraus (um a cada `FUNDO_DO_DEGRAU` casa);
 * para o lado, degraus mais compridos. Materiais: `madeira` e `pano` (o pano
 * da frente, as almofadas e as flâmulas); a listra clara é linho, fixa.
 */
import { hash } from '../../ruido'
import { caixa, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type Peca } from './motor'
import { LENCOL, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- as medidas ----------

/** As faixas da planta, em fração da meia altura: o guarda-corpo atrás, os degraus, o pano na frente. */
const LINHA_DO_GUARDA_CORPO = -0.93
const FUNDO_DOS_DEGRAUS = -0.86
const FRENTE_DOS_DEGRAUS = 0.76
const BARRA_DO_PANO = 0.9
const BICOS_DO_PANO = 0.97
/** O fundo de um degrau, em casas (o banco tem ~60 cm), e a altura de cada um. */
const FUNDO_DO_DEGRAU = 0.41
const ALTURA_DO_DEGRAU = 0.22
/** As laterais da armação e o corredor, em fração da meia largura. */
const LATERAL = 0.94
const BEIRA_DE_FORA = 0.99
const MEIO_CORREDOR = 0.075
/** As vigas debaixo dos degraus, onde vão as fileiras de pregos (fração da meia largura). */
const VIGAS: readonly number[] = [-0.56, 0.36]
/** O guarda-corpo: os postes (fração da meia largura), o lado deles e da trave (casas) e a altura acima do último degrau. */
const POSTES: readonly number[] = [-0.97, -0.33, 0.33, 0.97]
const LADO_DO_POSTE = 0.11
const MEIA_TRAVE = 0.04
const ALTURA_DO_GUARDA_CORPO = 0.5
/** Os mastros das flâmulas, nos cantos de trás: quanto sobem acima do guarda-corpo, o raio e a flâmula (casas). */
const ALTURA_DO_MASTRO = 0.9
const RAIO_DO_MASTRO = 0.045
const COMPRIMENTO_DA_FLAMULA = 0.56
const LARGURA_DA_FLAMULA = 0.22
/**
 * O rumo do vento das flâmulas (radianos, quase ao longo do guarda-corpo) e o fundo do corte das duas pontas
 * (fração do comprimento). Mais inclinadas, elas passavam por cima das almofadas de fora, e a 3/4 subia as
 * almofadas até a altura delas.
 */
const RUMO_DO_VENTO = 0.12
const CORTE_DAS_PONTAS = 0.3
/** As listras do pano da frente, em casas, e os bicos da barra por listra. */
const LARGURA_DA_LISTRA = 0.3
const BICOS_POR_LISTRA = 2
/** As almofadas do degrau de cima: os meios (fração da meia largura) e o tamanho (casas). */
const ALMOFADAS: readonly number[] = [-0.46, -0.21, 0.21, 0.46]
const LARGURA_DA_ALMOFADA = 0.26
const FUNDO_DA_ALMOFADA = 0.22
/** Os tons: a quina da frente de cada degrau pega mais luz; a lateral, de topo, é mais escura. */
const TOM_DA_TABUA_DE_TRAS = 0.92
const TOM_DA_TABUA_DA_FRENTE = 1.02
const TOM_DA_QUINA = 1.16
const TOM_DA_LATERAL = 0.78
/** A sombra que um degrau faz no de baixo, por px de altura a mais (a regra do banco de praça). */
const SOMBRA_POR_ALTURA = 0.36
/** O quanto a forma do meio-degrau passa da beira do degrau (px): a base dele fica mais ao sul e ele sai depois. */
const PASSA_DA_BEIRA = 0.4

/** A mesma forma numa caixa com o meio em (mx, my): a 3/4 sobe a peça com a estrutura que contém esse ponto. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

/**
 * As duas tábuas, a quina e os pregos de um pedaço de degrau entre x0 e x1, de y0 (trás) a y1 (frente). As tábuas
 * fazem sombra (`projeta`) no degrau de baixo, que entrou antes na pilha.
 */
function tabuasDoDegrau(c: ContextoDoMovel, L: Peca[], x0: number, x1: number, y0: number, y1: number, z: number, semente: number): void {
  const { peca: P } = c
  const mad = c.m.madeira
  const meio = (y0 + y1) / 2
  const projeta = { dist: z * SOMBRA_POR_ALTURA * 0.6 + 1.2, forca: 0.42, suave: 1.4 }
  L.push(
    P(caixa(x0, y0, x1, meio + 0.25, 0.6), mad, { tabua: 0, bisel: 1, tom: TOM_DA_TABUA_DE_TRAS, contorno: 0.24, semente, projeta }),
    P(caixa(x0, meio - 0.25, x1, y1, 0.8), mad, { tabua: 0, bisel: 1.2, tom: TOM_DA_TABUA_DA_FRENTE, contorno: 0.24, semente: semente + 1, projeta }),
    P(caixa(x0, y1 - 1.6, x1, y1, 0.8), mad, { tabua: 0, bisel: 0.8, tom: TOM_DA_QUINA, contorno: 0.1, semente: semente + 2 }),
  )
  for (const v of VIGAS) {
    const x = v * c.hw
    if (x < x0 + 1 || x > x1 - 1) continue
    for (const y of [y0 + (meio - y0) * 0.5, meio + (y1 - meio) * 0.45]) L.push(P(elipse(x, y, 0.6, 0.6), PREGO, { bisel: 0.5, contorno: 0, metal: 0.2, semente: semente + 5 }))
  }
}

/** A flâmula de duas pontas ao vento, presa no mastro em (px, py). */
function flamula(px: number, py: number, comp: number, larg: number): Forma {
  const co = Math.cos(RUMO_DO_VENTO)
  const si = Math.sin(RUMO_DO_VENTO)
  const em = (u: number, v: number): Ponto => [px + u * comp * co - v * larg * si, py + u * comp * si + v * larg * co]
  return poligono([em(0, -0.5), em(0.55, -0.42), em(1, -0.36), em(1 - CORTE_DAS_PONTAS, 0), em(1, 0.36), em(0.55, 0.42), em(0, 0.5)])
}

export const montarArquibancadaDeTorneio: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const pano = c.m.pano
  const L = cena.partes
  const S = cena.sombras
  const yFundo = FUNDO_DOS_DEGRAUS * hh
  const yFrente = FRENTE_DOS_DEGRAUS * hh
  const n = Math.max(2, Math.round((yFrente - yFundo) / (FUNDO_DO_DEGRAU * g)))
  const fundo = (yFrente - yFundo) / n
  const xl = LATERAL * hw
  const xf = BEIRA_DE_FORA * hw
  const xc = MEIO_CORREDOR * hw
  const zDe = (k: number): number => (k + 1) * ALTURA_DO_DEGRAU * g
  const zTopo = zDe(n - 1)

  // ---------- o guarda-corpo de trás e os mastros (primeiro: ficam atrás de tudo) ----------
  const yg = LINHA_DO_GUARDA_CORPO * hh
  const lp = (LADO_DO_POSTE * g) / 2
  const zGuarda = zTopo + ALTURA_DO_GUARDA_CORPO * g
  const xPostes = POSTES.map((f) => Math.sign(f) * Math.min(Math.abs(f) * hw, hw - lp - 0.5))
  xPostes.forEach((x, i) => {
    const poste = caixa(x - lp, yg - lp, x + lp, yg + lp, 0.6)
    const canto = i === 0 || i === xPostes.length - 1
    S.push({ forma: poste, z: canto ? zGuarda + ALTURA_DO_MASTRO * g : zGuarda, forca: 0.3 }, contato(poste, 0.3))
    L.push(P(poste, mad, { tabua: 0, bisel: 1.2, tom: 1.04, contorno: 0.3, semente: 7700 + i }))
  })
  const trave = caixa(xPostes[0], yg - MEIA_TRAVE * g, xPostes[xPostes.length - 1], yg + MEIA_TRAVE * g, 0.8)
  S.push({ forma: trave, z: zGuarda, solta: true, forca: 0.26 })
  L.push(P(comMeioEm(trave, (xPostes[1] + xPostes[2]) / 2, yg), mad, { tabua: 0, bisel: 1, tom: 1.08, contorno: 0.28, semente: 7710, projeta: { dist: 1.4, forca: 0.35 } }))

  // ---------- os degraus, da frente (o mais baixo) para trás, com o corredor no meio ----------
  // O de baixo entra primeiro na pilha: a sombra (`projeta`) do degrau de cima cai nele.
  for (let k = 0; k < n; k += 1) {
    const y1 = yFrente - k * fundo
    const y0 = y1 - fundo
    const meio = (y0 + y1) / 2
    const z = zDe(k)
    const zMeio = z - (ALTURA_DO_DEGRAU * g) / 2
    // O meio-degrau do corredor, na metade da frente: mais baixo, com a coluna própria.
    const meioDegrau = caixa(-xc, meio, xc, y1 + PASSA_DA_BEIRA, 0.4)
    S.push({ forma: meioDegrau, z: zMeio })
    L.push(P(caixa(-xc, meio, xc, y1, 0.6), mad, { eixo: 0, tabua: 0, bisel: 1, tom: TOM_DA_TABUA_DA_FRENTE * 0.96, contorno: 0.24, semente: 7720 + k }))
    L.push(P(caixa(-xc, y1 - 1.6, xc, y1, 0.6), mad, { tabua: 0, bisel: 0.8, tom: TOM_DA_QUINA, contorno: 0.1, semente: 7730 + k }))
    // O degrau, com o vão do meio-degrau recortado, e as laterais nas pontas.
    const degrau = menos(caixa(-xf, y0, xf, y1, 0.8), caixa(-xc, meio, xc, y1 + 1))
    S.push({ forma: degrau, z, forca: 0.3 })
    for (const lado of [-1, 1]) {
      const de = lado < 0 ? -xl : xc
      const ate = lado < 0 ? -xc : xl
      tabuasDoDegrau(c, L, de, ate, y0, y1, z, 7740 + k * 10 + (lado + 1) * 2)
      const xa = lado < 0 ? -xf : xl
      const xb = lado < 0 ? -xl : xf
      L.push(P(caixa(xa, y0, xb, y1, 0.6), mad, { eixo: QUARTO, tabua: 0, bisel: 1, tom: TOM_DA_LATERAL, contorno: 0.28, semente: 7790 + k * 2 + lado, projeta: { dist: 1, forca: 0.3 } }))
    }
    // A metade de trás do corredor fica na altura do degrau.
    L.push(P(caixa(-xc, y0, xc, meio + 0.3, 0.6), mad, { tabua: 0, bisel: 1, tom: TOM_DA_TABUA_DE_TRAS, contorno: 0.24, semente: 7800 + k, projeta: { dist: (z - zMeio) * SOMBRA_POR_ALTURA + 0.8, forca: 0.42, suave: 1.2 } }))
    L.push(P(caixa(-xc, meio - 1.2, xc, meio + 0.3, 0.4), mad, { tabua: 0, bisel: 0.6, tom: TOM_DA_QUINA, contorno: 0.1, semente: 7810 + k }))
  }
  S.push(contato(caixa(-xf, yFundo, xf, yFrente, 1), 0.3))

  // ---------- as almofadas dos nobres no degrau de cima ----------
  const yAlmofada = yFundo + fundo * 0.5
  ALMOFADAS.forEach((f, i) => {
    const x = f * hw
    const a = (LARGURA_DA_ALMOFADA * g) / 2
    const b = (FUNDO_DA_ALMOFADA * g) / 2
    L.push(P(caixa(x - a, yAlmofada - b, x + a, yAlmofada + b, b * 0.7), pano, { bisel: b * 0.8, contorno: 0.24, ruga: 0.35, tom: 0.98 + hash(i, 1, 7820) * 0.08, semente: 7821 + i, projeta: { dist: 1.3, forca: 0.36 } }))
    // As quatro borlas nos cantos, de linho.
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      L.push(P(elipse(x + sx * a * 0.92, yAlmofada + sy * b * 0.88, 0.95, 0.95), LENCOL, { bisel: 0.8, contorno: 0.2, semente: 7830 + i }))
    }
  })

  // ---------- o pano listrado na frente, pendurado na beira do primeiro degrau, com os bicos da barra ----------
  const yBarra = BARRA_DO_PANO * hh
  const yBicos = BICOS_DO_PANO * hh
  const yAlto = yFrente - 1.4
  const meioDoPrimeiro = yFrente - fundo * 0.3
  for (const lado of [-1, 1]) {
    const de = lado < 0 ? -xf : xc
    const ate = lado < 0 ? -xc : xf
    const listras = Math.max(1, Math.round((ate - de) / (LARGURA_DA_LISTRA * g)))
    const passo = (ate - de) / listras
    for (let i = 0; i < listras; i += 1) {
      const xa = de + i * passo
      const xb = xa + passo
      const pontos: Ponto[] = [[xa, yAlto], [xb, yAlto]]
      for (let j = BICOS_POR_LISTRA * 2; j >= 0; j -= 1) {
        const x = xa + (passo * j) / (BICOS_POR_LISTRA * 2)
        pontos.push([x, j % 2 === 1 ? yBicos : yBarra])
      }
      const clara = (i + (lado < 0 ? 0 : 1)) % 2 === 0
      const mat: MaterialDaPeca = clara ? LENCOL : pano
      L.push(P(comMeioEm(poligono(pontos), (xa + xb) / 2, meioDoPrimeiro), mat, { eixo: QUARTO, bisel: 1.1, contorno: 0.22, ruga: 0.25, tom: clara ? 0.96 : 1, semente: 7840 + i + (lado + 1) * 20 }))
    }
    // A dobra de cima do pano, sobre a quina do degrau.
    L.push(P(comMeioEm(caixa(de, yAlto - 0.6, ate, yAlto + 1.6, 0.6), (de + ate) / 2, meioDoPrimeiro), pano, { bisel: 0.9, contorno: 0.2, tom: 0.9, semente: 7890 + lado }))
  }

  // ---------- as flâmulas nos mastros dos cantos ----------
  const comp = COMPRIMENTO_DA_FLAMULA * g
  const larg = LARGURA_DA_FLAMULA * g
  const zMastro = zGuarda + ALTURA_DO_MASTRO * g
  ;[xPostes[0], xPostes[xPostes.length - 1]].forEach((x, i) => {
    // A flâmula da ponta da direita sopra para dentro: ao vento, para baixo e para a esquerda, sem sair da pegada.
    const forma = i === 0 ? flamula(x, yg, comp, larg) : flamulaEspelhada(x, yg, comp, larg)
    S.push({ forma, z: zMastro, solta: true, forca: 0.22 })
    L.push(P(forma, i === 0 ? pano : LENCOL, { eixo: RUMO_DO_VENTO, bisel: 1, contorno: 0.26, ruga: 0.5, tom: 1.02, semente: 7900 + i, projeta: { dist: 1.2, forca: 0.3 } }))
    L.push(P(elipse(x, yg, RAIO_DO_MASTRO * g, RAIO_DO_MASTRO * g), mad, { bisel: 1, tom: 1.14, contorno: 0.3, semente: 7910 + i }))
  })
}

/** A flâmula da ponta da direita, espelhada de leste a oeste. */
function flamulaEspelhada(px: number, py: number, comp: number, larg: number): Forma {
  const f = flamula(-px, py, comp, larg)
  return { b: [-f.b[2], f.b[1], -f.b[0], f.b[3]], d: (x, y) => f.d(-x, y) }
}
