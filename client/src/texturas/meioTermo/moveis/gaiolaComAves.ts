/**
 * A gaiola com aves (lote 9 dos objetos novos, 11/11/2026): o engradado de
 * ripas de madeira da feira com três galinhas dentro (uma branca, uma
 * pedrês ruiva, uma preta), palha no fundo e um cocho de milho; em cima, nos
 * fundos à direita, a gaiolinha de arame com dois pombos. Penas soltas no
 * chão, na frente.
 *
 * De cima: a grade do teto, com a sombra das ripas caindo na palha, e as
 * galinhas vistas do alto entre as ripas (o corpo, a crista vermelha, o rabo);
 * os pombos sob a tela de arame. Na 3/4: as ripas de frente, de pé, e as
 * galinhas de perfil entre elas, o teto em grade por cima e a gaiolinha no
 * alto. Tudo pelas âncoras do gancho com carne (cada peça é de uma vista só),
 * com a sombra no chão posta à mão. Girada (só a 3/4 recebe o giro), cada coisa
 * vai para onde o giro a leva e continua de pé, vista de perfil.
 */
import { caixa, capsula, dentroDe, elipseGirada, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, materialDaPeca, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- os materiais fixos ----------

const PALHA = materialDaPeca('palha')
const ARAME = materialDaPeca('arame')
const MILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xcc, 0xa8, 0x4e] }
const CRISTA: MaterialDaPeca = { classe: 'liso', rgb: [0xae, 0x46, 0x3c] }
const BICO: MaterialDaPeca = { classe: 'liso', rgb: [0xc8, 0xa0, 0x52] }
const OLHO: MaterialDaPeca = { classe: 'liso', rgb: [0x2a, 0x22, 0x1e] }
/** As três galinhas: a branca, a ruiva (com o rabo verde-escuro) e a preta. */
const BRANCA: MaterialDaPeca = { classe: 'liso', rgb: [0xe0, 0xd8, 0xc8] }
const RUIVA: MaterialDaPeca = { classe: 'liso', rgb: [0x9a, 0x66, 0x46] }
const RABO_ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x42, 0x3c] }
/** A carijó: cinza com as pintas claras e escuras (`texDaCarijo`). A preta lisa sumia atrás das ripas da frente. */
const CARIJO: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x78, 0x76] }
/** O pombo: cinza-azulado, a asa mais clara com as duas barras escuras e o pescoço furta-cor. */
const POMBO: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0x92, 0x9e] }
const ASA_DO_POMBO: MaterialDaPeca = { classe: 'liso', rgb: [0xa4, 0xa8, 0xb0] }
const BARRA_DO_POMBO: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x4c, 0x56] }
const PESCOCO_DO_POMBO: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x80, 0x76] }
const PE_DO_POMBO: MaterialDaPeca = { classe: 'liso', rgb: [0xb2, 0x7c, 0x70] }
/** As penas soltas no chão. */
const PENA_BRANCA: MaterialDaPeca = { classe: 'liso', rgb: [0xe4, 0xde, 0xd2] }
const PENA_RUIVA: MaterialDaPeca = { classe: 'liso', rgb: [0xa2, 0x7a, 0x5a] }
/** A sombra pintada (a peça de uma vista só não pode projetar). */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x1e, 0x16, 0x12] }

// ---------- as medidas (px do protótipo numa gaiola de 1 casa; o detalhe cresce com `k`) ----------

/** O engradado quase enche a pegada; na frente sobra a faixa das penas soltas. */
const FOLGA_X = 2
const FOLGA_Y = 3.4
const ALTURA = 0.48
/** As ripas: a largura, as do teto (frações do fundo e da largura) e quantas ripas de pé tem a frente. */
const RIPA = 3.2
const RIPA_DE_PE = 2.4
/**
 * O teto: duas ripas ao comprido (frações do meio fundo) e uma travessa no meio
 * (fração da meia largura). As seis casas da grade têm o tamanho de uma
 * galinha vista do alto: cada uma fica inteira num vão, e não cortada por ripa.
 */
const RIPAS_DO_TETO: readonly number[] = [-1 / 3, 1 / 3]
const TRAVESSAS_DO_TETO: readonly number[] = [0]
const RIPAS_DA_FRENTE = 8
const RIPAS_DO_FUNDO = 5
const RIPA_DO_FUNDO = 1.8
/** A gaiolinha de arame, nos fundos à direita do teto: x0, y0, x1, y1 (frações da meia pegada) e a altura. */
const GAIOLINHA: readonly [number, number, number, number] = [0.11, -0.86, 0.82, -0.16]
const ALTURA_DA_GAIOLINHA = 15
const PASSO_DA_TELA = 2.6
/** O cocho de milho, na casa da frente à direita (frações da meia pegada), e a altura dele. */
const COCHO: readonly [number, number, number, number] = [0.2, 0.5, 0.72, 0.67]
const ALTURA_DO_COCHO = 3.5
/** As galinhas: lugar no chão (frações da meia pegada), para que lado olham, a cor do corpo e a do rabo. */
const GALINHAS: readonly { readonly x: number; readonly y: number; readonly lado: number; readonly corpo: MaterialDaPeca; readonly rabo: MaterialDaPeca; readonly pintada: boolean }[] = [
  { x: 0.475, y: -0.02, lado: -1, corpo: RUIVA, rabo: RABO_ESCURO, pintada: false },
  { x: -0.475, y: 0.02, lado: 1, corpo: BRANCA, rabo: BRANCA, pintada: false },
  { x: -0.44, y: 0.62, lado: 1, corpo: CARIJO, rabo: CARIJO, pintada: true },
]
/**
 * As pintas da carijó, no ponto da tela (o mesmo de cima e de perfil): em cada
 * quadradinho de PASSO_DA_PINTA um sorteio fixo põe, ou não, uma pinta redonda
 * clara ou escura. Em xadrez regular ela lia como uma rede, não como pena.
 */
const PASSO_DA_PINTA = 1.5
const RAIO_DA_PINTA = 0.38
const texDaCarijo: Textura = (_u, _v, x, y, _p, s) => {
  const ix = Math.floor(x / PASSO_DA_PINTA)
  const iy = Math.floor(y / PASSO_DA_PINTA)
  const fx = x / PASSO_DA_PINTA - ix - 0.5
  const fy = y / PASSO_DA_PINTA - iy - 0.5
  if (fx * fx + fy * fy > RAIO_DA_PINTA * RAIO_DA_PINTA) return
  const sorteio = Math.abs(Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453) % 1
  const f = sorteio > 0.55 ? 1.34 : sorteio < 0.25 ? 0.76 : 1
  s[0] *= f
  s[1] *= f
  s[2] *= f
}
/** A galinha um pouco menor que a escala do detalhe, para caber num vão do teto. */
const ESCALA_DA_GALINHA = 0.92
/** Os pombos: lugar no teto (frações da meia pegada) e para que lado olham. */
const POMBOS: readonly { readonly x: number; readonly y: number; readonly lado: number }[] = [
  { x: 0.37, y: -0.56, lado: 1 },
  { x: 0.57, y: -0.31, lado: -1 },
]
const ESCALA_DO_POMBO = 0.7
/** As penas soltas: lugar (frações da meia pegada), ângulo e cor; as de fora no chão, duas na palha. */
const PENAS: readonly (readonly [number, number, number, MaterialDaPeca])[] = [
  [-0.7, 0.94, 0.3, PENA_BRANCA],
  [-0.14, 0.95, -0.4, PENA_RUIVA],
  [0.36, 0.93, 0.2, PENA_BRANCA],
  [0.86, 0.92, -0.9, PENA_RUIVA],
]
const PENAS_NA_PALHA: readonly (readonly [number, number, number, MaterialDaPeca])[] = [
  [-0.5, -0.62, 0.8, PENA_BRANCA],
  [0.8, 0.7, -0.2, PENA_RUIVA],
]
/** Força da sombra pintada e o tom do que fica dentro do engradado (o teto faz sombra). */
const FORCA_DA_SOMBRA = 0.3
const TOM_DE_DENTRO = 0.84
const TOM_DE_PE = 0.72

// ---------- o giro e as âncoras (as do gancho com carne) ----------

/** Os quartos de volta do giro do objeto (0 a 3). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto girado `q` quartos de volta no sentido da tela, como o `girarPonto` de `tresQuartos.ts`. */
function girarPonto(x: number, y: number, q: number): Ponto {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** A forma girada `q` quartos de volta, como o `girarForma` de `tresQuartos.ts`. */
function girarForma(f: Forma, q: number): Forma {
  if (q === 0) return f
  const b = f.b
  const girada: Caixa = q === 1 ? [-b[3], b[0], -b[1], b[2]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : [b[1], -b[2], b[3], -b[0]]
  const volta = 4 - q
  return {
    b: girada,
    d: (x, y) => {
      const [mx, my] = girarPonto(x, y, volta)
      return f.d(mx, my)
    },
  }
}

/** A peça só é pintada no lugar em que foi desenhada (`dy` zero): a de cima some quando a 3/4 a sobe, a de frente só aparece quando a 3/4 a traz de volta. */
function soNoLugar(textura: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** A mesma forma com a caixa de pintura centrada em (cx, cy): é o meio da caixa que a 3/4 lê para saber em que âncora a peça está. */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

const RAIO_DA_ANCORA = 1e-6
const FORA_DA_ANCORA = 1e3
const BORDA_DA_ANCORA = 0.05
/** Cada grupo aberto fica isto mais ao sul que o anterior: na mesma base, a 3/4 os pinta na ordem em que foram abertos. */
const PASSO_DA_ORDEM = 1e-3
/** O que só aparece de cima sobe quase nada na 3/4: o bastante para sair do lugar e sumir. */
const QUASE_NADA = 0.02

/** A âncora de um grupo: um tampo solto de um ponto só, sem sombra, no chão da pegada já girada. */
function ancorar(cena: Cena, q: number, x: number, y: number, z: number): void {
  const ponto: Forma = {
    b: [x, y, x, y],
    d: (px, py) => (Math.abs(px - x) < RAIO_DA_ANCORA && Math.abs(py - y) < RAIO_DA_ANCORA ? -1 : FORA_DA_ANCORA),
  }
  cena.sombras.push({ forma: girarForma(ponto, (4 - q) % 4), z, solta: true, forca: 0, suave: BORDA_DA_ANCORA })
}

/** A peça de uma vista só não tem deslocamento nem sombra própria (a sombra dela cairia na outra vista). */
type OpcoesDaVista = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'curvaY'>

/** Uma peça ainda sem grupo: o grupo é aberto com a caixa de todas, para a janela de pintura ficar justa. */
interface Desenho {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaVista
}

function caixaDe(lista: readonly Desenho[]): Caixa {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const { forma } of lista) {
    x0 = Math.min(x0, forma.b[0])
    y0 = Math.min(y0, forma.b[1])
    x1 = Math.max(x1, forma.b[2])
    y1 = Math.max(y1, forma.b[3])
  }
  return [x0, y0, x1, y1]
}

/** Põe as peças só na vista de cima, num grupo em volta do meio delas. */
function porDeCima(P: CriarPeca, cena: Cena, lista: readonly Desenho[]): void {
  if (lista.length === 0) return
  const b = caixaDe(lista)
  const x = (b[0] + b[2]) / 2
  const y = (b[1] + b[3]) / 2
  ancorar(cena, 0, x, y, QUASE_NADA)
  for (const { forma, mat, o } of lista) cena.partes.push(P(presa(forma, x, y), mat, { ...o, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
}

/** A tela da 3/4: quem desenha nela escreve em coordenadas da tela, com a pegada já girada. */
interface Tela {
  /** Põe as peças só na 3/4, num grupo que sobe junto; os grupos são pintados na ordem em que são postos. */
  por(lista: readonly Desenho[]): void
}

/** `base` = o y da tela, ao sul de tudo, onde ficam as âncoras (a ordem vem da sequência). */
function novaTela(P: CriarPeca, cena: Cena, q: number, base: number): Tela {
  const volta = (4 - q) % 4
  let abertos = 0
  return {
    por(lista) {
      if (lista.length === 0) return
      const b = caixaDe(lista)
      const x = (b[0] + b[2]) / 2
      const meio = (b[1] + b[3]) / 2
      const chao = base + abertos * PASSO_DA_ORDEM
      abertos += 1
      const z = chao - meio
      ancorar(cena, q, x, chao, z)
      const [dx, dy] = girarPonto(0, z, volta)
      for (const { forma, mat, o } of lista) {
        const noMeio = presa(forma, x, meio)
        if (q === 0) {
          cena.partes.push(P(noMeio, mat, { ...o, dy: z, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
          continue
        }
        // Girada, a cena só serve à 3/4: a peça sai desgirada (a forma, o veio e o ponto que a textura lê) e a volta da 3/4 a põe como foi desenhada.
        const textura = o.textura
        cena.partes.push(
          P(girarForma(noMeio, volta), mat, {
            ...o,
            dx,
            dy,
            eixo: (o.eixo ?? 0) - q * QUARTO,
            textura:
              textura === undefined
                ? undefined
                : (u, v, tx, ty, p, s, escala) => {
                    const [sx, sy] = girarPonto(tx, ty, q)
                    textura(u, v, sx, sy, p, s, escala)
                  },
          }),
        )
      }
    },
  }
}

// ---------- a gaiola na tela ----------

interface Gaiola {
  readonly q: number
  readonly k: number
  /** Meia pegada do engradado, no objeto. */
  readonly gx: number
  readonly gy: number
  readonly H: number
  readonly hw: number
  readonly hh: number
}

/** O ponto (x, y) do objeto, a `h` do chão, na tela da 3/4. */
function naTela(g: Gaiola, x: number, y: number, h: number): Ponto {
  const [sx, sy] = girarPonto(x, y, g.q)
  return [sx, sy - h]
}

/** O retângulo (x0, y0)-(x1, y1) do objeto, deitado a `h` do chão, na tela da 3/4. */
function retanguloNaTela(g: Gaiola, x0: number, y0: number, x1: number, y1: number, h: number, raio = 0): Forma {
  const [ax, ay] = naTela(g, x0, y0, h)
  const [bx, by] = naTela(g, x1, y1, h)
  return caixa(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), raio)
}

/** Para onde cai, no chão da tela, o ponto (x, y) a `h` do chão. */
function sombraNaTela(g: Gaiola, x: number, y: number, h: number): Ponto {
  const [sx, sy] = girarPonto(x, y, g.q)
  return [sx + SOMBRA_X * h, sy + SOMBRA_Y * h]
}

const DA_RIPA: OpcoesDaVista = { tabua: 0, bisel: 0.9, contorno: 0.28 }
const DA_SOMBRA: OpcoesDaVista = { tabua: 0, bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA }
const DA_AVE: OpcoesDaVista = { tabua: 0, bisel: 1.1, contorno: 0.3 }
const DO_DETALHE: OpcoesDaVista = { tabua: 0, bisel: 0.5, contorno: 0.24 }

/** As ripas do teto, no objeto: os quatro lados do quadro, as ripas ao comprido e as travessas (x0, y0, x1, y1, ao comprido?). */
function ripasDoTeto(g: Gaiola): (readonly [number, number, number, number, boolean])[] {
  const { gx, gy, k } = g
  const r = RIPA * k
  return [
    [-gx, -gy, gx, -gy + r, true],
    [-gx, gy - r, gx, gy, true],
    ...RIPAS_DO_TETO.map((f): readonly [number, number, number, number, boolean] => [-gx, f * gy - r / 2, gx, f * gy + r / 2, true]),
    [-gx, -gy, -gx + r, gy, false],
    [gx - r, -gy, gx, gy, false],
    ...TRAVESSAS_DO_TETO.map((f): readonly [number, number, number, number, boolean] => [f * gx - r / 2, -gy, f * gx + r / 2, gy, false]),
  ]
}

/** A gaiolinha no objeto: x0, y0, x1, y1. */
function gaiolinha(g: Gaiola): readonly [number, number, number, number] {
  return [GAIOLINHA[0] * g.hw, GAIOLINHA[1] * g.hh, GAIOLINHA[2] * g.hw, GAIOLINHA[3] * g.hh]
}

// ---------- as aves ----------

/** Onde a ave está e para que lado olha: o desenho é feito em coordenadas da ave (x para a frente, y para baixo a partir do pé). */
interface Ave {
  readonly x: number
  readonly y: number
  readonly lado: number
  readonly s: number
}

function pt(a: Ave, lx: number, ly: number): Ponto {
  return [a.x + a.lado * lx * a.s, a.y + ly * a.s]
}

function oval(a: Ave, lx: number, ly: number, rx: number, ry: number, giro = 0): Forma {
  const [cx, cy] = pt(a, lx, ly)
  return elipseGirada(cx, cy, rx * a.s, ry * a.s, giro * a.lado)
}

function linhaDaAve(a: Ave, l0: Ponto, l1: Ponto, raio: number): Forma {
  const [ax, ay] = pt(a, l0[0], l0[1])
  const [bx, by] = pt(a, l1[0], l1[1])
  return capsula(ax, ay, bx, by, raio * a.s)
}

function contorno(a: Ave, pontos: readonly Ponto[]): Forma {
  return poligono(pontos.map(([x, y]) => pt(a, x, y)))
}

/** A galinha de perfil, em pé: o rabo em leque, o corpo, a asa, o pescoço, a cabeça com a crista e a barbela, o bico, o olho e as pernas. */
function galinhaDePerfil(a: Ave, corpo: MaterialDaPeca, rabo: MaterialDaPeca, tom: number, pintada: boolean): Desenho[] {
  const pele: OpcoesDaVista = pintada ? { ...DA_AVE, textura: texDaCarijo } : DA_AVE
  return [
    { forma: linhaDaAve(a, [-0.6, -2.8], [-1, 0], 0.5), mat: BICO, o: { ...DO_DETALHE, tom: tom * 0.9 } },
    { forma: linhaDaAve(a, [1.6, -2.8], [2, 0], 0.5), mat: BICO, o: { ...DO_DETALHE, tom } },
    { forma: contorno(a, [[-4.6, -8.2], [-8.4, -16.4], [-11.4, -15.2], [-11.6, -11.4], [-8, -6.4]]), mat: rabo, o: { ...pele, tom: tom * 0.9 } },
    { forma: oval(a, 0, -7.6, 7.8, 5.6, -0.12), mat: corpo, o: { ...pele, tom } },
    { forma: oval(a, -1.2, -8, 5, 3, -0.22), mat: corpo, o: { ...pele, bisel: 0.8, tom: tom * 0.86 } },
    { forma: linhaDaAve(a, [-4.2, -6.6], [1.8, -6], 0.32), mat: corpo, o: { ...DO_DETALHE, contorno: 0, tom: tom * 0.7 } },
    { forma: linhaDaAve(a, [3.2, -9.4], [5.2, -12.6], 2.7), mat: corpo, o: { ...pele, tom: tom * 1.02 } },
    { forma: oval(a, 5.8, -13.2, 2.7, 2.6), mat: corpo, o: { ...pele, tom: tom * 1.04 } },
    { forma: uniao(uniao(oval(a, 4.6, -15.9, 1.15, 1.15), oval(a, 5.8, -16.5, 1.25, 1.25)), oval(a, 7, -15.8, 1.05, 1.05)), mat: CRISTA, o: { ...DO_DETALHE, tom } },
    { forma: oval(a, 7.3, -11.3, 0.95, 1.5), mat: CRISTA, o: { ...DO_DETALHE, tom: tom * 0.92 } },
    { forma: contorno(a, [[8.1, -13.9], [10.2, -13], [8.1, -12.2]]), mat: BICO, o: { ...DO_DETALHE, tom } },
    { forma: oval(a, 6.6, -13.7, 0.55, 0.55), mat: OLHO, o: { tabua: 0, bisel: 0, contorno: 0 } },
  ]
}

/** A galinha vista do alto: o rabo atrás, o corpo, as duas asas, a cabeça com a crista por cima e o bico. */
function galinhaDeCima(a: Ave, corpo: MaterialDaPeca, rabo: MaterialDaPeca, tom: number, pintada: boolean): Desenho[] {
  const pele: OpcoesDaVista = pintada ? { ...DA_AVE, textura: texDaCarijo } : DA_AVE
  return [
    { forma: oval(a, -8, 0, 3.8, 1.6), mat: rabo, o: { ...pele, tom: tom * 0.88 } },
    { forma: oval(a, 0, 0, 7.6, 5), mat: corpo, o: { ...pele, tom } },
    { forma: oval(a, -1.2, -2.5, 5, 2.2, 0.08), mat: corpo, o: { ...pele, bisel: 0.7, tom: tom * 0.9 } },
    { forma: oval(a, -1.2, 2.5, 5, 2.2, -0.08), mat: corpo, o: { ...pele, bisel: 0.7, tom: tom * 0.86 } },
    { forma: oval(a, 6.4, 0, 2.6, 2.4), mat: corpo, o: { ...pele, tom: tom * 1.04 } },
    { forma: oval(a, 6.2, 0, 2.2, 0.8), mat: CRISTA, o: { ...DO_DETALHE, tom } },
    { forma: contorno(a, [[8.5, -0.8], [10.4, 0], [8.5, 0.8]]), mat: BICO, o: { ...DO_DETALHE, tom } },
  ]
}

/** O pombo de perfil: o rabo, o corpo, a asa com as duas barras, o pescoço furta-cor, a cabeça, o bico, o olho e os pés. */
function pomboDePerfil(a: Ave, tom: number): Desenho[] {
  return [
    { forma: linhaDaAve(a, [-0.2, -1.8], [-0.4, 0], 0.45), mat: PE_DO_POMBO, o: { ...DO_DETALHE, tom } },
    { forma: linhaDaAve(a, [1.2, -1.8], [1.4, 0], 0.45), mat: PE_DO_POMBO, o: { ...DO_DETALHE, tom } },
    { forma: contorno(a, [[-4.6, -4.8], [-9.6, -6], [-9.8, -3.8], [-4.6, -3]]), mat: BARRA_DO_POMBO, o: { ...DA_AVE, tom } },
    { forma: oval(a, 0, -5, 5.6, 3.6, -0.18), mat: POMBO, o: { ...DA_AVE, tom } },
    { forma: oval(a, -1.2, -5.3, 4.2, 2.3, -0.12), mat: ASA_DO_POMBO, o: { ...DA_AVE, bisel: 0.8, tom } },
    { forma: linhaDaAve(a, [-2.6, -6.6], [-1.8, -4.2], 0.42), mat: BARRA_DO_POMBO, o: { ...DO_DETALHE, contorno: 0, tom } },
    { forma: linhaDaAve(a, [-4.2, -6.2], [-3.4, -4], 0.42), mat: BARRA_DO_POMBO, o: { ...DO_DETALHE, contorno: 0, tom } },
    { forma: linhaDaAve(a, [2.6, -6.6], [3.8, -8.6], 2), mat: PESCOCO_DO_POMBO, o: { ...DA_AVE, tom } },
    { forma: oval(a, 4.4, -9.4, 1.9, 1.8), mat: POMBO, o: { ...DA_AVE, tom: tom * 1.05 } },
    { forma: contorno(a, [[6, -9.8], [7.6, -9.3], [6, -8.9]]), mat: BARRA_DO_POMBO, o: { ...DO_DETALHE, tom } },
    { forma: oval(a, 4.9, -9.8, 0.45, 0.45), mat: CRISTA, o: { tabua: 0, bisel: 0, contorno: 0 } },
  ]
}

/** O pombo do alto: o rabo, o corpo, as asas com as barras, o pescoço e a cabeça. */
function pomboDeCima(a: Ave, tom: number): Desenho[] {
  return [
    { forma: oval(a, -6.6, 0, 3.2, 1.4), mat: BARRA_DO_POMBO, o: { ...DA_AVE, tom } },
    { forma: oval(a, 0, 0, 5.6, 3.8), mat: POMBO, o: { ...DA_AVE, tom } },
    { forma: oval(a, -0.8, -1.8, 4.4, 1.9), mat: ASA_DO_POMBO, o: { ...DA_AVE, bisel: 0.7, tom } },
    { forma: oval(a, -0.8, 1.8, 4.4, 1.9), mat: ASA_DO_POMBO, o: { ...DA_AVE, bisel: 0.7, tom: tom * 0.9 } },
    { forma: linhaDaAve(a, [-2.2, -3.2], [-2.2, 3.2], 0.42), mat: BARRA_DO_POMBO, o: { ...DO_DETALHE, contorno: 0, tom } },
    { forma: linhaDaAve(a, [-3.8, -2.8], [-3.8, 2.8], 0.42), mat: BARRA_DO_POMBO, o: { ...DO_DETALHE, contorno: 0, tom } },
    { forma: oval(a, 2.9, 0, 2, 2), mat: PESCOCO_DO_POMBO, o: { ...DA_AVE, tom } },
    { forma: oval(a, 4.4, 0, 1.7, 1.6), mat: POMBO, o: { ...DA_AVE, tom: tom * 1.05 } },
  ]
}

/** A pena solta: a pluma e o canhão. */
function pena(x: number, y: number, angulo: number, mat: MaterialDaPeca, k: number, tom: number): Desenho[] {
  const c = Math.cos(angulo) * 2.5 * k
  const s = Math.sin(angulo) * 2.5 * k
  return [
    { forma: elipseGirada(x, y, 2.6 * k, 0.9 * k, angulo), mat, o: { tabua: 0, bisel: 0.5, contorno: 0.2, tom } },
    { forma: capsula(x - c * 1.2, y - s * 1.2, x + c * 0.9, y + s * 0.9, 0.22 * k), mat, o: { tabua: 0, bisel: 0, contorno: 0, tom: tom * 0.72 } },
  ]
}

// ---------- de cima ----------

function deCima(c: ContextoDoMovel, cena: Cena, g: Gaiola): void {
  const P = c.peca
  const { gx, gy, k, H } = g
  const mad = c.m.madeira
  const piso = caixa(-gx, -gy, gx, gy)

  // As penas de fora, no chão.
  for (const [fx, fy, a, mat] of PENAS) porDeCima(P, cena, pena(fx * g.hw, fy * g.hh, a, mat, k, 1))

  // O fundo de palha, as penas nele, o cocho de milho e as galinhas vistas do alto.
  porDeCima(P, cena, [{ forma: piso, mat: PALHA, o: { tabua: 0, bisel: 0.6, contorno: 0.2, tom: TOM_DE_DENTRO, eixo: 0.3 } }])
  for (const [fx, fy, a, mat] of PENAS_NA_PALHA) porDeCima(P, cena, pena(fx * gx, fy * gy, a, mat, k, TOM_DE_DENTRO))
  const [cx0, cy0, cx1, cy1] = COCHO
  porDeCima(P, cena, [
    { forma: caixa(cx0 * gx, cy0 * gy, cx1 * gx, cy1 * gy, 0.6), mat: mad, o: { ...DA_RIPA, tom: 0.9, semente: 140 } },
    { forma: caixa(cx0 * gx + 1.1 * k, cy0 * gy + 1.1 * k, cx1 * gx - 1.1 * k, cy1 * gy - 1.1 * k), mat: MILHO, o: { tabua: 0, bisel: 0.8, contorno: 0.2, ruga: 1, recesso: { k: 0.8, forca: 0.3 } } },
  ])
  for (const galinha of GALINHAS) {
    porDeCima(P, cena, galinhaDeCima({ x: galinha.x * gx, y: galinha.y * gy, lado: galinha.lado, s: ESCALA_DA_GALINHA * k }, galinha.corpo, galinha.rabo, 1, galinha.pintada))
  }

  // A sombra das ripas do teto na palha e nas galinhas (o teto está a `H` do chão), e o teto por cima.
  const ripas = ripasDoTeto(g)
  porDeCima(
    P,
    cena,
    ripas.map(([x0, y0, x1, y1]): Desenho => ({ forma: dentroDe(caixa(x0 + SOMBRA_X * H, y0 + SOMBRA_Y * H, x1 + SOMBRA_X * H, y1 + SOMBRA_Y * H), piso), mat: SOMBRA, o: DA_SOMBRA })),
  )
  porDeCima(
    P,
    cena,
    ripas.map(([x0, y0, x1, y1, comprida], i): Desenho => ({ forma: caixa(x0, y0, x1, y1, 0.5), mat: mad, o: { ...DA_RIPA, eixo: comprida ? 0 : QUARTO, tom: comprida ? 1 : 0.94, semente: 100 + i } })),
  )

  // A gaiolinha: o estrado, os pombos, a tela de arame por cima, o quadro e a alça.
  const [x0, y0, x1, y1] = gaiolinha(g)
  const tela: Desenho[] = [{ forma: caixa(x0, y0, x1, y1, 0.6), mat: mad, o: { ...DA_RIPA, tom: 0.8, semente: 150 } }]
  for (const pombo of POMBOS) tela.push(...pomboDeCima({ x: pombo.x * g.hw, y: pombo.y * g.hh, lado: pombo.lado, s: ESCALA_DO_POMBO * k }, 1))
  for (let x = x0 + PASSO_DA_TELA * k; x < x1 - 0.5; x += PASSO_DA_TELA * k) tela.push({ forma: capsula(x, y0, x, y1, 0.3 * k), mat: ARAME, o: { tabua: 0, bisel: 0.3, contorno: 0.2, tom: 0.92 } })
  for (let y = y0 + PASSO_DA_TELA * k; y < y1 - 0.5; y += PASSO_DA_TELA * k) tela.push({ forma: capsula(x0, y, x1, y, 0.3 * k), mat: ARAME, o: { tabua: 0, bisel: 0.3, contorno: 0.2, tom: 0.92 } })
  const borda = 1.6 * k
  for (const [a0, b0, a1, b1] of [
    [x0, y0, x1, y0 + borda],
    [x0, y1 - borda, x1, y1],
    [x0, y0, x0 + borda, y1],
    [x1 - borda, y0, x1, y1],
  ] as const) {
    tela.push({ forma: caixa(a0, b0, a1, b1, 0.3), mat: mad, o: { ...DA_RIPA, bisel: 0.6, tom: 0.96, semente: 160 } })
  }
  const meioX = (x0 + x1) / 2
  const meioY = (y0 + y1) / 2
  tela.push({ forma: capsula(meioX - 3 * k, meioY, meioX + 3 * k, meioY, 0.55 * k), mat: ARAME, o: { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.5 } })
  porDeCima(P, cena, tela)
}

// ---------- na 3/4 ----------

/**
 * As ripas de pé de uma face (a do fundo ou a da frente da tela), de `xa` a
 * `xb`, no y `y` da tela, do chão a `h`: `quantas` ripas de `largura` px.
 */
function faceDeRipas(xa: number, xb: number, y: number, h: number, k: number, mad: MaterialDaPeca, tom: number, semente: number, quantas: number, largura: number): Desenho[] {
  const lista: Desenho[] = []
  const r = largura * k
  const vao = (xb - xa - 2 * RIPA * k) / quantas
  for (let i = 0; i < quantas; i += 1) {
    const x = xa + RIPA * k + (i + 0.5) * vao
    lista.push({ forma: caixa(x - r / 2, y - h, x + r / 2, y, 0.3), mat: mad, o: { ...DA_RIPA, eixo: QUARTO, tom, semente: semente + i } })
  }
  // As travessas de baixo e de cima e os dois postes dos cantos.
  lista.push({ forma: caixa(xa, y - 3.2 * k, xb, y, 0.4), mat: mad, o: { ...DA_RIPA, eixo: 0, tom: tom * 0.96, semente: semente + 20 } })
  lista.push({ forma: caixa(xa, y - h, xb, y - h + 3 * k, 0.4), mat: mad, o: { ...DA_RIPA, eixo: 0, tom: tom * 1.04, semente: semente + 21 } })
  for (const x of [xa, xb - RIPA * k]) lista.push({ forma: caixa(x, y - h, x + RIPA * k, y, 0.4), mat: mad, o: { ...DA_RIPA, eixo: QUARTO, tom: tom * 0.94, semente: semente + 22 } })
  return lista
}

function deFrente(c: ContextoDoMovel, tela: Tela, g: Gaiola): void {
  const { k, H, q } = g
  const mad = c.m.madeira
  const deLado = q % 2 === 1
  const sx = deLado ? g.gy : g.gx
  const sy = deLado ? g.gx : g.gy

  // O fundo: as ripas da face de trás, vistas pelos vãos do teto (poucas e finas: cheia, ela virava um muro de grade).
  tela.por(faceDeRipas(-sx, sx, -sy, H, k, mad, 0.74, 300, RIPAS_DO_FUNDO, RIPA_DO_FUNDO))

  // O chão de dentro: a palha, a sombra do teto nela e as penas.
  const piso = caixa(-sx, -sy, sx, sy)
  tela.por([{ forma: piso, mat: PALHA, o: { tabua: 0, bisel: 0.6, contorno: 0.2, tom: TOM_DE_DENTRO * 0.92, eixo: 0.3 } }])
  tela.por(
    ripasDoTeto(g).map(([x0, y0, x1, y1]): Desenho => {
      const [ax, ay] = sombraNaTela(g, x0, y0, H)
      const [bx, by] = sombraNaTela(g, x1, y1, H)
      return { forma: dentroDe(caixa(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)), piso), mat: SOMBRA, o: DA_SOMBRA }
    }),
  )
  for (const [fx, fy, a, mat] of PENAS_NA_PALHA) {
    const [px, py] = naTela(g, fx * g.gx, fy * g.gy, 0)
    tela.por(pena(px, py, a, mat, k, TOM_DE_DENTRO))
  }

  // O que fica no chão de dentro, do fundo para a frente: as galinhas de perfil e o cocho.
  const [cx0, cy0, cx1, cy1] = COCHO
  const dentro: { readonly fundo: number; readonly desenho: () => Desenho[] }[] = GALINHAS.map((galinha) => {
    const [px, py] = naTela(g, galinha.x * g.gx, galinha.y * g.gy, 0)
    return { fundo: py, desenho: () => galinhaDePerfil({ x: px, y: py, lado: galinha.lado, s: ESCALA_DA_GALINHA * k }, galinha.corpo, galinha.rabo, TOM_DE_DENTRO, galinha.pintada) }
  })
  const fundoDoCocho = naTela(g, ((cx0 + cx1) / 2) * g.gx, ((cy0 + cy1) / 2) * g.gy, 0)[1]
  dentro.push({
    fundo: fundoDoCocho,
    desenho: () => {
      const topo = retanguloNaTela(g, cx0 * g.gx, cy0 * g.gy, cx1 * g.gx, cy1 * g.gy, ALTURA_DO_COCHO * k, 0.6)
      const pe = retanguloNaTela(g, cx0 * g.gx, cy0 * g.gy, cx1 * g.gx, cy1 * g.gy, 0, 0.6)
      const b = topo.b
      return [
        { forma: uniao(pe, caixa(b[0], b[1], b[2], pe.b[3], 0.6)), mat: mad, o: { ...DA_RIPA, tom: TOM_DE_PE * TOM_DE_DENTRO, semente: 141 } },
        { forma: topo, mat: mad, o: { ...DA_RIPA, tom: 0.9 * TOM_DE_DENTRO, semente: 140 } },
        { forma: caixa(b[0] + 1.1 * k, b[1] + 1.1 * k, b[2] - 1.1 * k, b[3] - 1.1 * k), mat: MILHO, o: { tabua: 0, bisel: 0.8, contorno: 0.2, ruga: 1, tom: TOM_DE_DENTRO } },
      ]
    },
  })
  for (const d of dentro.sort((a, b) => a.fundo - b.fundo)) tela.por(d.desenho())

  // As faces dos lados (de perfil, viram uma faixa de ripas) e o teto em grade, a `H` do chão.
  tela.por([
    { forma: caixa(-sx, -sy - H, -sx + RIPA * k, sy, 0.4), mat: mad, o: { ...DA_RIPA, eixo: QUARTO, tom: 0.9, semente: 330 } },
    { forma: caixa(sx - RIPA * k, -sy - H, sx, sy, 0.4), mat: mad, o: { ...DA_RIPA, eixo: QUARTO, tom: 0.66, semente: 331 } },
  ])
  tela.por(
    ripasDoTeto(g).map(([x0, y0, x1, y1, comprida], i): Desenho => {
      const forma = retanguloNaTela(g, x0, y0, x1, y1, H, 0.5)
      const deitada = forma.b[2] - forma.b[0] > forma.b[3] - forma.b[1]
      return { forma, mat: mad, o: { ...DA_RIPA, eixo: deitada ? 0 : QUARTO, tom: comprida ? 1 : 0.94, semente: 100 + i } }
    }),
  )

  // A gaiolinha no teto: o estrado, as ripinhas do fundo, os pombos, a tela da frente, o quadro e a tela de cima.
  const [x0, y0, x1, y1] = gaiolinha(g)
  const hp = ALTURA_DA_GAIOLINHA * k
  const chao = retanguloNaTela(g, x0, y0, x1, y1, H)
  const [ax, ay, bx, by] = chao.b
  const estrado = 1.6 * k
  const fio = (xa: number, ya: number, xb: number, yb: number): Desenho => ({ forma: capsula(xa, ya, xb, yb, 0.3 * k), mat: ARAME, o: { tabua: 0, bisel: 0.3, contorno: 0.2, tom: 0.88 } })
  const fundoDaGaiolinha: Desenho[] = []
  for (let x = ax + PASSO_DA_TELA * k; x < bx - 0.5; x += PASSO_DA_TELA * k) fundoDaGaiolinha.push(fio(x, ay - estrado, x, ay - hp))
  fundoDaGaiolinha.push({ forma: uniao(chao, caixa(ax, by - estrado, bx, by)), mat: mad, o: { ...DA_RIPA, tom: 0.84, semente: 150 } })
  tela.por(fundoDaGaiolinha)
  const pombos = POMBOS.map((pombo) => naTela(g, pombo.x * g.hw, pombo.y * g.hh, H)).map((p, i) => ({ p, lado: POMBOS[i].lado })).sort((a, b) => a.p[1] - b.p[1])
  for (const { p, lado } of pombos) tela.por(pomboDePerfil({ x: p[0], y: p[1] - estrado, lado, s: ESCALA_DO_POMBO * k }, 1))
  const frente: Desenho[] = []
  for (let x = ax + PASSO_DA_TELA * k; x < bx - 0.5; x += PASSO_DA_TELA * k) frente.push(fio(x, by - estrado, x, by - hp))
  const topo = caixa(ax, ay - hp, bx, by - hp)
  for (let x = ax + PASSO_DA_TELA * k; x < bx - 0.5; x += PASSO_DA_TELA * k) frente.push(fio(x, ay - hp, x, by - hp))
  for (let y = ay - hp + PASSO_DA_TELA * k; y < by - hp - 0.5; y += PASSO_DA_TELA * k) frente.push(fio(ax, y, bx, y))
  const borda = 1.6 * k
  frente.push({ forma: caixa(ax, by - hp - borda / 2, bx, by - hp + borda / 2, 0.3), mat: mad, o: { ...DA_RIPA, bisel: 0.6, tom: 0.96, semente: 161 } })
  frente.push({ forma: caixa(ax, ay - hp - borda / 2, bx, ay - hp + borda / 2, 0.3), mat: mad, o: { ...DA_RIPA, bisel: 0.6, tom: 0.9, semente: 162 } })
  for (const x of [ax, bx - borda]) frente.push({ forma: caixa(x, ay - hp, x + borda, by - estrado, 0.3), mat: mad, o: { ...DA_RIPA, bisel: 0.6, eixo: QUARTO, tom: x === ax ? 0.96 : 0.78, semente: 163 } })
  const meioX = (ax + bx) / 2
  const meioY = (topo.b[1] + topo.b[3]) / 2
  frente.push({ forma: capsula(meioX - 3 * k, meioY - 2.6 * k, meioX + 3 * k, meioY - 2.6 * k, 0.55 * k), mat: ARAME, o: { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.5 } })
  for (const lado of [-1, 1]) frente.push(fio(meioX + lado * 3 * k, meioY - 2.6 * k, meioX + lado * 3.6 * k, meioY))
  tela.por(frente)

  // A frente do engradado, por cima das galinhas, e as penas de fora no chão.
  tela.por(faceDeRipas(-sx, sx, sy, H, k, mad, 0.86, 200, RIPAS_DA_FRENTE, RIPA_DE_PE))
  for (const [fx, fy, a, mat] of PENAS) {
    const [px, py] = naTela(g, fx * g.hw, fy * g.hh, 0)
    tela.por(pena(px, py, a, mat, k, 1))
  }
}

// ---------- a sombra no chão ----------

/** O casco convexo dos pontos (cadeia monótona). */
function casco(pontos: readonly Ponto[]): Ponto[] {
  const p = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cruz = (o: Ponto, a: Ponto, b: Ponto): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const metade = (lista: readonly Ponto[]): Ponto[] => {
    const h: Ponto[] = []
    for (const q of lista) {
      while (h.length >= 2 && cruz(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop()
      h.push(q)
    }
    return h
  }
  const baixo = metade(p)
  const cima = metade([...p].reverse())
  return [...baixo.slice(0, -1), ...cima.slice(0, -1)]
}

/** A sombra do engradado e da gaiolinha no chão da tela (caída para baixo à direita), e o contato. Girada, entra desgirada. */
function sombrasNoChao(cena: Cena, g: Gaiola): void {
  const volta = (4 - g.q) % 4
  const { gx, gy, H, k } = g
  const [x0, y0, x1, y1] = gaiolinha(g)
  const cantos: Ponto[] = []
  for (const [x, y] of [[-gx, -gy], [gx, -gy], [-gx, gy], [gx, gy]] as const) {
    cantos.push(sombraNaTela(g, x, y, 0), sombraNaTela(g, x, y, H))
  }
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const) cantos.push(sombraNaTela(g, x, y, H + ALTURA_DA_GAIOLINHA * k))
  cena.sombras.push({ forma: girarForma(poligono(casco(cantos)), volta), z: 0, forca: FORCA_DA_SOMBRA, suave: 1.8 })
  const pe = girarPonto(gx, gy, g.q)
  cena.sombras.push(contato(girarForma(caixa(-Math.abs(pe[0]), -Math.abs(pe[1]), Math.abs(pe[0]), Math.abs(pe[1]), 1), volta), 0.34))
}

/** O escalão do detalhe: 1 na gaiola de 1 casa, preso para as aves não sumirem nem estourarem se o mestre esticar. */
const ESCALA_MINIMA = 0.8
const ESCALA_MAXIMA = 1.5

export const montarGaiolaComAves: MontarMovel = (c, cena) => {
  const q = quartosDoGiro(c.giro)
  const k = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, Math.min(c.w, c.h) / G))
  const g: Gaiola = { q, k, gx: c.hw - FOLGA_X, gy: c.hh - FOLGA_Y, H: ALTURA * G * k, hw: c.hw, hh: c.hh }
  sombrasNoChao(cena, g)
  // Girada, a cena só serve à 3/4: as peças de cima não entram.
  if (q === 0) deCima(c, cena, g)
  const deLado = q % 2 === 1
  deFrente(c, novaTela(c.peca, cena, q, (deLado ? c.hw : c.hh) + 2), g)
}
