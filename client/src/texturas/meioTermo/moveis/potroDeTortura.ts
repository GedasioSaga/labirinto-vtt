/**
 * POTRO DE TORTURA de cima com volume (lote 14 dos objetos novos, 11/11/2026,
 * grupo Sala de tortura; o mestre pediu "uns equipamentos de tortura"): a
 * mesa de estiramento da masmorra, VAZIA. Um QUADRO de vigas grossas sobre
 * quatro pés robustos, o ESTRADO de pranchas no meio e um ROLO de madeira em
 * cada ponta. Das voltas de corda enroladas nos rolos saem as CORDAS grossas,
 * esticadas pelo estrado até as ARGOLAS de ferro e as ALGEMAS de couro,
 * abertas. Cintas e cantoneiras de ferro abraçam as vigas. No rolo da
 * direita, do lado da frente, a CATRACA: a roda dentada, a lingueta e as
 * ALAVANCAS EM CRUZ.
 *
 * Quem conta a história é a madeira: as pranchas são GASTAS E LUSTROSAS no
 * meio (mais claras e com o veio alisado, onde o corpo ficaria) e as cordas
 * estão esticadas. Nada de gente, de sangue ou de mancha escura.
 *
 * NA 3/4 o estrado sobe com tudo o que está em cima dele, e a beirada (a face
 * da viga da frente, na espessura que o perfil do tipo traz) desce até os
 * pés, que são colunas. Na face da viga entram as cintas, as cantoneiras, a
 * travessa baixa entre os pés da frente, a ponta do eixo do rolo da esquerda
 * e a catraca DE FRENTE: a roda dentada, a lingueta presa na viga e a cruz
 * das alavancas. Essas peças são desenhadas na tela da 3/4 e presas a
 * ÂNCORAS, a regra do cutelo da mesa de corte: cada peça nasce descida a
 * altura da âncora dela e só pinta no lugar (`soNoLugar`), então some na
 * vista de cima e aparece quando a 3/4 a sobe de volta. Do alto, a roda e a
 * cruz são vistas de cutelo (a barra dentada e a barra das alavancas, na
 * frente da viga); cada uma tem um PINO (um ponto sem tamanho nem tinta) que a
 * sobe na 3/4, onde ela some. Girado (`c.giro`), o desenho não põe as peças
 * da tela: a 3/4 varre a face lisa da viga, e a roda e a cruz vistas do alto
 * sobem até a altura do eixo.
 *
 * A 25% de zoom sobram o retângulo comprido de madeira, os dois rolos claros
 * nas pontas e as quatro cordas claras correndo para o meio: é o que diz
 * "potro", e não mesa, cama ou bancada. Materiais: `madeira` e `ferragens`.
 * A corda e o couro são fixos. As medidas miúdas saem do menor lado da
 * pegada (2 x 1 casas de partida) e os lugares, de frações dela: o potro
 * esticado ganha estrado, não rolos maiores.
 */
import { rgb, type Rgb } from '../../ruido'
import { anel, caixa, capsula, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { G, QUARTO, materialDaPeca, type ContextoDoMovel, type MontarMovel } from './contexto'

/** A pegada de partida, em casas: as medidas miúdas (px do protótipo) valem nela. */
const COMPRIMENTO_DE_PARTIDA = 2
const FUNDO_DE_PARTIDA = 1
/** A altura do alto das vigas, em casas: uma mesa de cintura. */
const ALTURA_DO_QUADRO = 0.55
/**
 * A grossura das vigas na 3/4 (px do protótipo): a beirada que o perfil do
 * tipo tem de trazer (`{ modo: 'derivado', espessura: ESPESSURA_DA_VIGA_DO_POTRO }`).
 * Com a padrão (0,06 casa) o quadro sai fino como o tampo de uma mesa de jantar.
 */
export const ESPESSURA_DA_VIGA_DO_POTRO = 0.16 * G

// ---------- o quadro, de cima (px do protótipo na pegada de partida) ----------

/** O quadro recua isto da pegada; na frente sobra o lugar da roda dentada e da cruz das alavancas. */
const MARGEM = 1
const SOBRA_DA_CATRACA = 7.5
/** A largura das vigas compridas e a das travessas das pontas. */
const VIGA = 7.2
const TRAVESSA = 6.4
/** O rolo: o raio e a folga entre ele, a travessa e o estrado. */
const RAIO_DO_ROLO = 4.8
const FOLGA_DO_ROLO = 0.8
/** Os pés: o lado e o recuo da beira do quadro (a frente deles fica atrás da face da viga, na 3/4). */
const LADO_DO_PE = 8.5
const RECUO_DO_PE = 1.2
/** As tábuas do estrado (quantas, no fundo dele). */
const TABUAS_DO_ESTRADO = 4

/** A madeira: o quadro por baixo (o escuro das frestas), as vigas, o estrado e os rolos, mais claros de tanto girar. */
const TOM_DO_QUADRO = 0.72
const TOM_DA_VIGA = 0.94
const TOM_DA_TRAVESSA = 0.88
const TOM_DO_ESTRADO = 1.04
const TOM_DO_ROLO = 1.16
/**
 * O meio do estrado, GASTO E LUSTROSO: a luz somada no miolo, o quanto o veio
 * alisa ali (fração) e o tamanho da mancha de uso, em frações do estrado.
 */
const LUZ_DO_GASTO = 0.15
const ALISADO = 0.6
const GASTO_AO_COMPRIDO = 0.66
const GASTO_DE_TRAVES = 0.82

// ---------- as cordas, as argolas e as algemas ----------

const CORDA = materialDaPeca('corda')
/** O couro das algemas: marrom escuro de couro curtido, sem puxar para o vermelho. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x43, 0x31] }
/** As duas cordas de cada rolo correm a esta fração do meio fundo do estrado, de cada lado do meio. */
const AFASTAMENTO_DAS_CORDAS = 0.44
/** Onde ficam as argolas, em casas a partir do rolo: a cabeceira (os pulsos, à esquerda) e os pés (à direita). */
const CORDA_DA_CABECEIRA = 0.3
const CORDA_DOS_PES = 0.42
const RAIO_DA_CORDA = 1.15
/** As voltas de corda no rolo: quantas e o passo entre elas. */
const VOLTAS_NO_ROLO = 4
const PASSO_DAS_VOLTAS = 1.9
const ARGOLA = { fora: 2.4, dentro: 1.35 } as const
/** A algema aberta: os raios do C de couro e a abertura (radianos), virada para longe da argola. */
const ALGEMA = { fora: 3.9, dentro: 2.4, abertura: 1.25 } as const

// ---------- o ferro ----------

/** As ferragens são o metal escolhido um pouco mais escuro, com ferrugem discreta e pouco brilho. */
const TOM_DO_FERRO = 0.9
const BRILHO_DO_FERRO = 0.28
const FERRUGEM: Rgb = rgb('#8c5b45')
const FERRUGEM_CHEIA = 0.66
const FERRUGEM_DAS_CINTAS = -0.12
/** O ferro e a madeira vistos de frente, na 3/4, pegam menos luz que de cima. */
const TOM_DE_FRENTE = 0.84
/** As cintas: a meia largura e onde ficam, em frações do estrado (a da catraca fica livre). */
const MEIA_CINTA = 1.6
const CINTAS = [0.18, 0.5, 0.82] as const
const LADO_DA_CANTONEIRA = 5.6
const RAIO_DO_REBITE = 0.75
const TOM_DO_REBITE = 1.3

// ---------- a catraca e as alavancas ----------

const RAIO_DA_RODA = 7.4
const FUNDO_DOS_DENTES = 5.7
const DENTES = 12
/** Uma sobra de ângulo entre a ponta e o pé de cada dente: a face reta, que a lingueta segura. */
const FACE_DO_DENTE = 0.06
const BRACO_DA_ALAVANCA = 13.5
const GROSSURA_DA_ALAVANCA = 1.5
const RAIO_DO_PUNHO = 2
/** De cima, a roda dentada e a cruz ficam este tanto na frente da viga (px): é o eixo saindo dela. */
const FRENTE_DA_RODA = 1.7
const FRENTE_DA_CRUZ = 4.8
/** A travessa baixa entre os pés da frente, na 3/4: do chão até onde (px). */
const TRAVESSA_BAIXA = { de: 4.5, ate: 9.5 } as const

// ---------- a vista de cima e a 3/4 (as âncoras do cutelo da mesa de corte) ----------

/** A âncora e o pino só contêm o próprio ponto, com esta folga de conta; fora dele estão longe de tudo. */
const RAIO_DO_PONTO = 1e-6
const LONGE = 1e3
const BORDA_DO_PONTO = 0.05
/** Cada peça da tela fica isto mais ao sul que a anterior: a 3/4 pinta as âncoras na ordem da base. */
const PASSO_DA_ORDEM = 1e-3
/** As âncoras ficam este tanto ao sul da pegada: fora de toda estrutura, pintadas depois de tudo. */
const ALEM_DA_PEGADA = 0.5

function ponto(x: number, y: number): Forma {
  return { b: [x, y, x, y], d: (px, py) => (Math.abs(px - x) < RAIO_DO_PONTO && Math.abs(py - y) < RAIO_DO_PONTO ? -1 : LONGE) }
}

function meioDa(f: Forma): Ponto {
  return [(f.b[0] + f.b[2]) / 2, (f.b[1] + f.b[3]) / 2]
}

/**
 * A peça só é pintada NO LUGAR em que foi desenhada (`dy` zero): a 3/4 sobe
 * cada peça mexendo no `dy` dela, então a peça da vista de cima some quando
 * sobe, e a da tela (que nasce descida) aparece quando a 3/4 a traz de volta.
 */
function soNoLugar(textura: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** A peça da tela não tem deslocamento nem sombra própria (a sombra cairia na vista de cima). */
type OpcoesDaTela = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'curvaY'>
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaTela) => void

/**
 * A TELA da 3/4, sem giro: cada peça é escrita como a 3/4 a mostra e ganha a
 * âncora dela, um tampo solto de um ponto só, sem sombra, no meio de baixo da
 * peça e ao sul da pegada. A 3/4 sobe a peça a altura da âncora (de volta ao
 * lugar desenhado) e a pinta depois de tudo, na ordem em que foi posta.
 */
function telaDaTresQuartos(c: ContextoDoMovel, cena: Cena): Por {
  const chao = c.hh + ALEM_DA_PEGADA
  let postas = 0
  return (forma, mat, o = {}) => {
    const [mx, my] = meioDa(forma)
    const base = chao + postas * PASSO_DA_ORDEM
    postas += 1
    const z = base - my
    cena.sombras.push({ forma: ponto(mx, base), z, solta: true, forca: 0, suave: BORDA_DO_PONTO })
    cena.partes.push(c.peca(forma, mat, { ...o, dy: z, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
  }
}

/**
 * Põe uma peça vista DO ALTO que fica fora do quadro (a roda e a cruz de
 * cutelo): um pino no meio dela a sobe `z` na 3/4. Sem giro ela só pinta no
 * lugar e some lá (a 3/4 a mostra de frente); girada, aparece subida.
 */
function foraDoQuadro(c: ContextoDoMovel, cena: Cena, girado: boolean, z: number): Por {
  return (forma, mat, o = {}) => {
    const [mx, my] = meioDa(forma)
    cena.sombras.push({ forma: ponto(mx, my), z, solta: true, forca: 0, suave: BORDA_DO_PONTO })
    const textura = o.textura ?? texturaDaClasse(mat.classe)
    cena.partes.push(c.peca(forma, mat, girado ? o : { ...o, textura: soNoLugar(textura) }))
  }
}

// ---------- texturas ----------

/** O ferro velho das ferragens: manchas de ferrugem (`quanto` de -0,3, quase limpo, a 0,3) e o grão do metal. */
function texFerroVelho(quanto: number): Textura {
  return (_u, _v, x, y, p, s) => {
    // Duas escalas: a mancha e o recorte dela, que desfaz a beira (ferrugem não tem contorno).
    const mancha = ruido(x * 0.2 + p.su, y * 0.2 + p.sv) * 1.4 + ruido(x * 0.8 + p.sv, y * 0.8 + p.su) * 0.7
    const q = (mancha + quanto - 0.3) / 0.4
    const t = q <= 0 ? 0 : q >= 1 ? FERRUGEM_CHEIA : q * q * (3 - 2 * q) * FERRUGEM_CHEIA
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
    s[3] += ruido(x * 0.16 + p.su, y * 0.16) * 0.1 + ruido(x * 0.7, y * 0.7 + p.sv) * 0.04 - t * 0.05
  }
}

/** O estrado: o veio das pranchas, alisado e clareado na mancha de uso em volta de (cx, cy), de raios (rx, ry). */
function texDoEstrado(cx: number, cy: number, rx: number, ry: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    const antes = s[3]
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const d2 = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    const gasto = d2 >= 1 ? 0 : (1 - d2) * (1 - d2)
    s[3] = antes + (s[3] - antes) * (1 - ALISADO * gasto) + gasto * (LUZ_DO_GASTO + ruido(x * 0.05 + p.su, y * 0.14) * 0.03)
  }
}

/** A roda dentada vista de cutelo, do alto: as pontas dos dentes em riscas claras e escuras ao longo dela. */
const texDosDentes: Textura = (_u, _v, x, _y, _p, s) => {
  const f = x / 2.3 - Math.floor(x / 2.3)
  s[3] += f < 0.45 ? 0.14 : -0.12
}

/** O couro: grão miúdo e manchas largas de uso. */
const texDoCouro: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.7 + p.su, y * 0.7 + p.sv) * 0.06 + ruido(x * 0.2, y * 0.2 + p.su) * 0.05
}

// ---------- o desenho ----------

interface Potro {
  readonly c: ContextoDoMovel
  /** A escala das medidas miúdas: 1 na pegada de partida. */
  readonly k: number
  /** As beiras de fora do quadro, de cima. */
  readonly x0: number
  readonly x1: number
  readonly y0: number
  readonly y1: number
  /** O estrado: entre as vigas (y) e entre os rolos (x). */
  readonly e0: number
  readonly e1: number
  readonly ex0: number
  readonly ex1: number
  /** O meio de cada rolo. */
  readonly roloE: number
  readonly roloD: number
  /** A altura do alto das vigas e a do eixo dos rolos (px do protótipo). */
  readonly z: number
  readonly zEixo: number
  readonly mad: MaterialDaPeca
  readonly ferro: MaterialDaPeca
}

function medir(c: ContextoDoMovel): Potro {
  const k = Math.min(c.w / (COMPRIMENTO_DE_PARTIDA * G), c.h / (FUNDO_DE_PARTIDA * G))
  const x0 = -c.hw + MARGEM
  const x1 = c.hw - MARGEM
  const y0 = -c.hh + MARGEM
  const y1 = c.hh - SOBRA_DA_CATRACA * k
  const raio = RAIO_DO_ROLO * k
  const roloE = x0 + TRAVESSA * k + FOLGA_DO_ROLO + raio
  const roloD = x1 - TRAVESSA * k - FOLGA_DO_ROLO - raio
  const z = c.g * ALTURA_DO_QUADRO
  const base = c.m.ferragens
  return {
    c,
    k,
    x0,
    x1,
    y0,
    y1,
    e0: y0 + VIGA * k,
    e1: y1 - VIGA * k,
    ex0: roloE + raio + FOLGA_DO_ROLO,
    ex1: roloD - raio - FOLGA_DO_ROLO,
    roloE,
    roloD,
    z,
    zEixo: z - ESPESSURA_DA_VIGA_DO_POTRO / 2,
    mad: c.m.madeira,
    ferro: { ...base, rgb: [base.rgb[0] * TOM_DO_FERRO, base.rgb[1] * TOM_DO_FERRO, base.rgb[2] * TOM_DO_FERRO] },
  }
}

/** As opções do ferro velho, com a ferrugem de cada peça sorteada pela semente. */
function doFerro(semente: number, tom = 1): OpcoesDaTela {
  return { tabua: 0, metal: BRILHO_DO_FERRO, tom, textura: texFerroVelho(FERRUGEM_DAS_CINTAS + 0.08 * Math.sin(semente * 1.7)), semente }
}

/** Os pés de cima: os quatro quadrados debaixo das quinas do quadro. */
function pes(p: Potro): Forma[] {
  const lado = LADO_DO_PE * p.k
  const recuo = RECUO_DO_PE * p.k
  return [p.x0 + recuo, p.x1 - recuo - lado].flatMap((x) => [p.y0 + recuo, p.y1 - recuo - lado].map((y) => caixa(x, y, x + lado, y + lado, 0.8)))
}

function montarSombras(p: Potro, cena: Cena): void {
  const alem = 1.6 * p.k
  cena.sombras.push(
    // Debaixo do quadro, a sombra pesada; o quadro é um tampo no ar (a estrutura que a 3/4 sobe), com a beirada da viga.
    { forma: caixa(p.x0 - alem, p.y0 - alem, p.x1 + alem, p.y1 + alem, 2 * alem), z: 0, suave: alem, forca: 0.36 },
    { forma: caixa(p.x0, p.y0, p.x1, p.y1, 1.2), z: p.z, solta: true, suave: 1.8, forca: 0.24 },
  )
  for (const pe of pes(p)) cena.sombras.push({ forma: pe, z: p.z - ESPESSURA_DA_VIGA_DO_POTRO, suave: 0.9, forca: 0.3 }, contato(pe, 0.34))
}

/** Os rebites de cabeça clara nos pontos dados. */
function rebites(p: Potro, L: Peca[], pontos: readonly Ponto[], semente: number): void {
  pontos.forEach(([x, y], i) => {
    L.push(p.c.peca(elipse(x, y, RAIO_DO_REBITE * p.k, RAIO_DO_REBITE * p.k), p.ferro, { bisel: 0.6, contorno: 0.2, metal: 0.4, tom: TOM_DO_REBITE, semente: semente + i }))
  })
}

/** O quadro de cima: o escuro de baixo, os rolos com as voltas de corda, o estrado, as vigas, as travessas e o ferro. */
function montarQuadro(p: Potro, L: Peca[], ys: readonly number[]): void {
  const { c, k, mad } = p
  const P = c.peca
  const raio = RAIO_DO_ROLO * k
  L.push(P(caixa(p.x0, p.y0, p.x1, p.y1, 1.2), mad, { tabua: 0, bisel: 1.4, tom: TOM_DO_QUADRO, contorno: 0.3, semente: 10 }))
  // Os rolos passam por baixo das vigas; as voltas de corda ficam onde cada corda sai.
  for (const [i, xr] of [p.roloE, p.roloD].entries()) {
    L.push(P(caixa(xr - raio, p.e0 - VIGA * k * 0.5, xr + raio, p.e1 + VIGA * k * 0.5, raio * 0.9), mad, { eixo: QUARTO, tabua: 0, bisel: raio * 0.95, tom: TOM_DO_ROLO, contorno: 0.26, semente: 20 + i }))
    ys.forEach((yc, j) => {
      for (let v = 0; v < VOLTAS_NO_ROLO; v += 1) {
        const yv = yc + (v - (VOLTAS_NO_ROLO - 1) / 2) * PASSO_DAS_VOLTAS * k
        const volta = capsula(xr - raio - 0.3, yv - 0.5 * k, xr + raio + 0.3, yv + 0.5 * k, RAIO_DA_CORDA * k)
        L.push(P(volta, CORDA, { eixo: 0.2, tabua: 0, bisel: RAIO_DA_CORDA * k, contorno: 0.24, semente: 30 + i * 10 + j * 4 + v }))
      }
    })
  }
  const fundo = p.e1 - p.e0
  const textura = texDoEstrado((p.ex0 + p.ex1) / 2, (p.e0 + p.e1) / 2, ((p.ex1 - p.ex0) / 2) * GASTO_AO_COMPRIDO, (fundo / 2) * GASTO_DE_TRAVES)
  L.push(P(caixa(p.ex0, p.e0, p.ex1, p.e1, 0.6), mad, { tabua: fundo / TABUAS_DO_ESTRADO, bisel: 0.6, tom: TOM_DO_ESTRADO, contorno: 0.2, textura, semente: 40 }))
  // As travessas das pontas, entre as vigas, e as vigas compridas por cima, de ponta a ponta.
  L.push(P(caixa(p.x0, p.e0 - 0.5, p.x0 + TRAVESSA * k, p.e1 + 0.5, 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, tom: TOM_DA_TRAVESSA, semente: 41 }))
  L.push(P(caixa(p.x1 - TRAVESSA * k, p.e0 - 0.5, p.x1, p.e1 + 0.5, 0.8), mad, { eixo: QUARTO, tabua: 0, bisel: 1.3, tom: TOM_DA_TRAVESSA, semente: 42 }))
  L.push(P(caixa(p.x0, p.y0, p.x1, p.e0, 1), mad, { tabua: 0, bisel: 1.6, tom: TOM_DA_VIGA, contorno: 0.26, semente: 43, projeta: { dist: 0.9, forca: 0.3 } }))
  L.push(P(caixa(p.x0, p.e1, p.x1, p.y1, 1), mad, { tabua: 0, bisel: 1.6, tom: TOM_DA_VIGA, contorno: 0.26, semente: 44, projeta: { dist: 0.9, forca: 0.3 } }))
  montarFerroDeCima(p, L)
}

/** As cintas que abraçam as vigas e as cantoneiras das quinas, com os rebites. */
function montarFerroDeCima(p: Potro, L: Peca[]): void {
  const { c, k } = p
  const P = c.peca
  const meia = MEIA_CINTA * k
  CINTAS.forEach((f, i) => {
    const x = p.ex0 + (p.ex1 - p.ex0) * f
    for (const [a, b] of [[p.y0, p.e0], [p.e1, p.y1]] as const) {
      L.push(P(caixa(x - meia, a - 0.5, x + meia, b + 0.5, 0.4), p.ferro, { bisel: 0.6, contorno: 0.3, ...doFerro(60 + i * 2 + (a === p.y0 ? 0 : 1)) }))
      rebites(p, L, [[x, a + (b - a) * 0.3], [x, a + (b - a) * 0.7]], 70 + i * 4)
    }
  })
  const lado = LADO_DA_CANTONEIRA * k
  for (const [i, [xq, dir]] of ([[p.x0, 1], [p.x1, -1]] as const).entries()) {
    for (const [a, b] of [[p.y0, p.e0], [p.e1, p.y1]] as const) {
      const xa = dir > 0 ? xq - 0.4 : xq - lado
      const xb = dir > 0 ? xq + lado : xq + 0.4
      L.push(P(caixa(xa, a - 0.4, xb, b + 0.4, 0.8), p.ferro, { bisel: 0.7, contorno: 0.3, ...doFerro(80 + i * 2 + (a === p.y0 ? 0 : 1), 1.04) }))
      rebites(p, L, [[xq + dir * lado * 0.5, (a + b) / 2]], 90 + i * 2)
    }
  }
}

/** As cordas esticadas do rolo às argolas e as algemas abertas. `lado` = -1 a cabeceira (rolo da esquerda), 1 os pés. */
function montarCordas(p: Potro, L: Peca[], ys: readonly number[]): void {
  const { c, k } = p
  const P = c.peca
  const raio = RAIO_DO_ROLO * k
  for (const lado of [-1, 1] as const) {
    const xr = lado < 0 ? p.roloE : p.roloD
    const para = -lado
    const xArgola = xr + para * (raio + c.g * (lado < 0 ? CORDA_DA_CABECEIRA : CORDA_DOS_PES))
    ys.forEach((y, j) => {
      const sem = 100 + (lado < 0 ? 0 : 20) + j * 8
      const corda = capsula(xr + para * raio * 0.4, y, xArgola - para * ARGOLA.fora * k * 0.6, y, RAIO_DA_CORDA * k)
      L.push(P(corda, CORDA, { tabua: 0, bisel: RAIO_DA_CORDA * k, contorno: 0.26, semente: sem, projeta: { dist: 0.8, forca: 0.3 } }))
      // A algema: o C de couro aberto para o meio do estrado, a fivela numa ponta e a argola que a prende à corda.
      const xa = xArgola + para * (ARGOLA.fora + ALGEMA.fora - 0.9) * k
      const r = ALGEMA.fora * k
      const meiaAbertura = ALGEMA.abertura / 2
      const cunha = poligono([[xa, y], [xa + para * r * 2, y - r * 2 * Math.tan(meiaAbertura)], [xa + para * r * 2, y + r * 2 * Math.tan(meiaAbertura)]])
      L.push(P(menos(anel(xa, y, r, r, ALGEMA.dentro * k, ALGEMA.dentro * k), cunha), COURO, { tabua: 0, bisel: 1.1 * k, contorno: 0.32, textura: texDoCouro, semente: sem + 1, projeta: { dist: 0.7, forca: 0.3 } }))
      const xf = xa + para * Math.cos(meiaAbertura) * (r + ALGEMA.dentro * k) * 0.5
      const yf = y - Math.sin(meiaAbertura) * (r + ALGEMA.dentro * k) * 0.5
      L.push(P(caixa(xf - 1.1 * k, yf - 0.9 * k, xf + 1.1 * k, yf + 0.9 * k, 0.3), p.ferro, { bisel: 0.5, contorno: 0.3, ...doFerro(sem + 2, 1.15) }))
      L.push(P(anel(xArgola, y, ARGOLA.fora * k, ARGOLA.fora * k, ARGOLA.dentro * k, ARGOLA.dentro * k), p.ferro, { bisel: 0.9 * k, contorno: 0.3, ...doFerro(sem + 3, 1.18), projeta: { dist: 0.7, forca: 0.32 } }))
    })
  }
}

/**
 * A roda dentada e a cruz das alavancas VISTAS DO ALTO, de cutelo, na frente
 * da viga: a ponta do eixo, a barra dentada, a barra das alavancas (os dois
 * braços de cima, um para cada lado) com os punhos e o cubo. E as sombras
 * delas no chão: a roda achatada e a cruz inclinada, na direção da luz.
 */
function montarCatracaDeCima(p: Potro, cena: Cena, girado: boolean): void {
  const { k, roloD: x } = p
  const por = foraDoQuadro(p.c, cena, girado, p.zEixo)
  const yRoda = p.y1 + FRENTE_DA_RODA * k
  const yCruz = p.y1 + FRENTE_DA_CRUZ * k
  const R = RAIO_DA_RODA * k
  const braco = BRACO_DA_ALAVANCA * k * Math.SQRT1_2
  const zE = p.zEixo
  // As sombras: a roda é um disco em pé (achatado na direção da luz) e a cruz, um X em pé.
  const disco = Array.from({ length: 16 }, (_, i): Ponto => {
    const t = (i / 16) * Math.PI * 2
    return [x + R * Math.cos(t) + SOMBRA_X * (zE + R * Math.sin(t)), yRoda + SOMBRA_Y * (zE + R * Math.sin(t))]
  })
  cena.sombras.push({ forma: poligono(disco), z: 0, suave: 1.3, forca: 0.24 })
  const noChao = (dx: number, dz: number): Ponto => [x + dx + SOMBRA_X * (zE + dz), yCruz + SOMBRA_Y * (zE + dz)]
  for (const s of [-1, 1]) {
    const [ax, ay] = noChao(-braco, -s * braco)
    const [bx, by] = noChao(braco, s * braco)
    cena.sombras.push({ forma: capsula(ax, ay, bx, by, GROSSURA_DA_ALAVANCA * k), z: 0, suave: 1.2, forca: 0.24 })
  }
  por(caixa(x - 1.4 * k, p.y1 - 0.4, x + 1.4 * k, yCruz + 1.2 * k, 0.5), p.ferro, { bisel: 0.7, contorno: 0.3, ...doFerro(200, 0.82) })
  por(caixa(x - R, yRoda - 1.1 * k, x + R, yRoda + 1.1 * k, 0.6), p.ferro, { bisel: 0.6, contorno: 0.34, tabua: 0, metal: BRILHO_DO_FERRO, textura: texDosDentes, semente: 201 })
  por(capsula(x - braco, yCruz, x + braco, yCruz, GROSSURA_DA_ALAVANCA * k), p.mad, { tabua: 0, bisel: GROSSURA_DA_ALAVANCA * k, tom: 1.06, contorno: 0.3, semente: 202 })
  for (const s of [-1, 1]) por(elipse(x + s * braco, yCruz, RAIO_DO_PUNHO * k, RAIO_DO_PUNHO * k * 0.9), p.mad, { tabua: 0, bisel: RAIO_DO_PUNHO * k, tom: 1.18, contorno: 0.3, semente: 203 + s })
  por(elipse(x, yCruz, 2.4 * k, 2.4 * k), p.ferro, { bisel: 1, contorno: 0.3, ...doFerro(206, 1.05) })
}

/** Uma roda dentada de catraca: cada dente sobe em rampa até a ponta e cai reto até o pé do seguinte. */
function rodaDentada(cx: number, cy: number, raio: number, fundo: number): Forma {
  const pontos: Ponto[] = []
  for (let i = 0; i < DENTES; i += 1) {
    const a = (i / DENTES) * Math.PI * 2
    const b = a + ((Math.PI * 2) / DENTES) * FACE_DO_DENTE
    pontos.push([cx + Math.cos(a) * raio, cy + Math.sin(a) * raio], [cx + Math.cos(b) * fundo, cy + Math.sin(b) * fundo])
  }
  return poligono(pontos)
}

/**
 * A FRENTE NA 3/4 (sem giro), na tela: as cintas e as cantoneiras descendo
 * pela face da viga, a travessa baixa entre os pés, a ponta do eixo do rolo
 * da esquerda e, no da direita, a roda dentada de frente, a lingueta e a cruz
 * das alavancas com os punhos gastos.
 */
function montarFrente(p: Potro, cena: Cena): void {
  const { c, k, mad } = p
  const por = telaDaTresQuartos(c, cena)
  const topo = p.y1 - p.z
  const pe = topo + ESPESSURA_DA_VIGA_DO_POTRO
  const eixo = (topo + pe) / 2
  const meia = MEIA_CINTA * k
  const frente = (s: number, tom = 1): OpcoesDaTela => ({ bisel: 0.6, contorno: 0.3, ...doFerro(s, tom * TOM_DE_FRENTE) })

  // A travessa baixa entre os pés da frente, recuada atrás da face deles.
  const lado = LADO_DO_PE * k
  const recuo = RECUO_DO_PE * k
  const yPe = p.y1 - recuo - lado * 0.4
  por(caixa(p.x0 + recuo + lado, yPe - TRAVESSA_BAIXA.ate, p.x1 - recuo - lado, yPe - TRAVESSA_BAIXA.de, 0.5), mad, { tabua: 0, bisel: 0.9, tom: 0.62, contorno: 0.26, semente: 300 })

  CINTAS.forEach((f, i) => {
    const x = p.ex0 + (p.ex1 - p.ex0) * f
    por(caixa(x - meia, topo - 0.3, x + meia, pe + 0.5, 0.4), p.ferro, frente(310 + i))
    for (const y of [topo + 2.2 * k, pe - 2.2 * k]) por(elipse(x, y, RAIO_DO_REBITE * k, RAIO_DO_REBITE * k), p.ferro, { bisel: 0.6, contorno: 0.2, metal: 0.4, tom: TOM_DO_REBITE * TOM_DE_FRENTE, semente: 320 + i })
  })
  const ladoC = LADO_DA_CANTONEIRA * k
  for (const [xa, xb] of [[p.x0 - 0.4, p.x0 + ladoC], [p.x1 - ladoC, p.x1 + 0.4]] as const) {
    por(caixa(xa, topo - 0.3, xb, pe + 0.5, 0.8), p.ferro, frente(330, 1.04))
    for (const y of [topo + 2.2 * k, pe - 2.2 * k]) por(elipse((xa + xb) / 2, y, RAIO_DO_REBITE * k, RAIO_DO_REBITE * k), p.ferro, { bisel: 0.6, contorno: 0.2, metal: 0.4, tom: TOM_DO_REBITE * TOM_DE_FRENTE, semente: 332 })
  }

  // A ponta do eixo do rolo da esquerda, saindo da viga.
  por(elipse(p.roloE, eixo, 2.8 * k, 2.8 * k), p.ferro, frente(340))
  por(elipse(p.roloE, eixo, 1.2 * k, 1.2 * k), p.ferro, { bisel: 0.5, contorno: 0.2, ...doFerro(341, 0.66) })

  // A catraca do rolo da direita: o espelho na viga, a roda dentada um pouco à frente e a lingueta segurando um dente.
  const x = p.roloD
  const R = RAIO_DA_RODA * k
  const yRoda = eixo + FRENTE_DA_RODA * k
  por(elipse(x, eixo, 3.6 * k, 3.6 * k), p.ferro, frente(350, 0.9))
  por(rodaDentada(x, yRoda, R, FUNDO_DOS_DENTES * k), p.ferro, { bisel: 1, contorno: 0.34, ...doFerro(351, 1.04) })
  por(anel(x, yRoda, R * 0.66, R * 0.66, R * 0.46, R * 0.46), p.ferro, { bisel: 0.5, contorno: 0.16, recesso: { k: 1, forca: 0.3 }, ...doFerro(352, 0.8) })
  const pivo: Ponto = [x - R - 3.2 * k, topo + 1.9 * k]
  const dente: Ponto = [x - R * 0.74, yRoda - R * 0.7]
  por(capsula(pivo[0], pivo[1], dente[0], dente[1], 1.05 * k), p.ferro, { bisel: 0.7, contorno: 0.32, ...doFerro(353, 1.1) })
  por(elipse(pivo[0], pivo[1], 1.4 * k, 1.4 * k), p.ferro, { bisel: 0.7, contorno: 0.26, metal: 0.4, tom: TOM_DO_REBITE, semente: 354 })

  // A cruz das alavancas, na frente da roda: dois varões de madeira cruzados no cubo, os punhos gastos e mais claros.
  const yCruz = eixo + FRENTE_DA_CRUZ * k
  const braco = BRACO_DA_ALAVANCA * k * Math.SQRT1_2
  for (const s of [-1, 1]) {
    por(capsula(x - braco, yCruz - s * braco, x + braco, yCruz + s * braco, GROSSURA_DA_ALAVANCA * k), mad, { eixo: s * Math.PI / 4, tabua: 0, bisel: GROSSURA_DA_ALAVANCA * k, tom: 0.98, contorno: 0.32, semente: 360 + s })
  }
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    por(elipse(x + sx * braco, yCruz + sy * braco, RAIO_DO_PUNHO * k, RAIO_DO_PUNHO * k), mad, { tabua: 0, bisel: RAIO_DO_PUNHO * k, tom: 1.14, contorno: 0.3, semente: 364 + sx + sy * 2 })
  }
  por(elipse(x, yCruz, 3 * k, 3 * k), p.ferro, { bisel: 1, contorno: 0.32, ...doFerro(370, 1) })
  por(caixa(x - 1.2 * k, yCruz - 1.2 * k, x + 1.2 * k, yCruz + 1.2 * k, 0.3), p.ferro, { bisel: 0.6, contorno: 0.26, ...doFerro(371, 0.72) })
}

export const montarPotroDeTortura: MontarMovel = (c, cena) => {
  const p = medir(c)
  const girado = ((Math.round(c.giro / 90) % 4) + 4) % 4 !== 0
  const meio = (p.e0 + p.e1) / 2
  const afasta = ((p.e1 - p.e0) / 2) * AFASTAMENTO_DAS_CORDAS
  const ys = [meio - afasta, meio + afasta] as const
  montarSombras(p, cena)
  montarQuadro(p, cena.partes, ys)
  montarCordas(p, cena.partes, ys)
  montarCatracaDeCima(p, cena, girado)
  if (!girado) montarFrente(p, cena)
}
