/**
 * PALCO DE BARDO de cima com volume (lote 9 dos objetos novos, 11/11/2026): o tablado baixo de praça onde o
 * bardo toca na feira. As TÁBUAS correm ao comprido sobre três CAVALETES (as fileiras de pregos dizem onde
 * eles passam, e as emendas das tábuas caem sobre eles), um DEGRAU na frente, ao meio, e, atrás, a CORTINA de
 * fundo franzida, pendurada numa TRAVE entre dois POSTES roliços, com as BANDEIROLAS de pano amarradas na
 * trave. No canto de trás à esquerda, o BANQUINHO com o ALAÚDE encostado; na frente, no chão ao lado do
 * degrau, o CHAPÉU virado com as moedas (e duas que caíram fora). O MEIO do tablado fica livre: é onde ficam
 * os tokens. Sem luz nem lanterna.
 *
 * É OBJETO DE CHÃO (`ehMovelDoChao`): só o chão fica debaixo de todos os outros objetos nas duas vistas, então
 * a banqueta, o baú ou o token posto em cima dele aparece por cima. Como objeto comum, na 3/4 os objetos são
 * ordenados pela base, e uma banqueta no meio do tablado (base ao norte da beira da frente) sairia por baixo
 * dele.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) o tablado é um tampo solto sobre as pernas dos cavaletes, partido em
 * duas faixas (a de trás com as 3 primeiras tábuas): a base do banquinho fica na divisa, então ele sai depois
 * da faixa de trás e antes da da frente, que tapa o pé dele abaixo do tablado. A cortina fica atrás do tablado,
 * no chão, como um pano de fundo: cada prega é uma coluna com o tom dela (a frente mostra as pregas de pé), e
 * o tablado, que sai depois, tapa a parte de baixo dela bem na beira de trás. Os postes também ficam atrás; a
 * trave é um tampo solto alto, com as bandeirolas. O degrau e o chapéu ficam na frente, no chão.
 *
 * As sombras no tablado (a da cortina, a do banquinho) são pintadas: a sombra do chão fica debaixo das tábuas.
 *
 * Materiais: `madeira` (o tablado, o degrau, os postes, a trave e o banquinho) e `cortina`. O resto é fixo. O
 * tablado acompanha a pegada; o banquinho, o alaúde e o chapéu têm tamanho fixo.
 */
import { hash, limitar01, luz, type Rgb } from '../../ruido'
import { barra, capsula, caixa, dentroDe, elipse, elipseGirada, poligono, uniao, type Caixa, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { materialDaPeca, PREGO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- medidas ----------

/** As alturas, em casas: o tablado, o degrau, a cortina, a trave, os postes, o assento acima do tablado e o chapéu. */
const ALTURA_DO_PALCO = 0.25
const ALTURA_DO_DEGRAU = 0.12
const ALTURA_DA_CORTINA = 1.35
const ALTURA_DA_TRAVE = 1.42
const ALTURA_DOS_POSTES = 1.54
const ALTURA_DO_BANQUINHO = 0.22
const ALTURA_DO_CHAPEU = 0.09
/** A beirada padrão de um tampo solto na 3/4 (`ESPESSURA_DO_TAMPO` de `tresQuartos.ts`): as pernas vão até ela. */
const BEIRADA = 0.06
/** O quanto a sombra anda por px de altura (a mesma luz da sombra do chão, `SOMBRA_X` e `SOMBRA_Y`). */
const SOMBRA_POR_ALTURA = Math.hypot(SOMBRA_X, SOMBRA_Y)

/** O tablado e o degrau, em frações da meia pegada (o x da meia largura, o y da meia altura). */
const PALCO: Caixa = [-0.95, -0.775, 0.95, 0.6]
const DEGRAU: Caixa = [-0.2, 0.6, 0.2, 0.8]
/** As tábuas do tablado, ao comprido; as 3 de trás formam a faixa do banquinho (ver a 3/4 acima). */
const TABUAS = 12
const TABUAS_DE_TRAS = 3
/** A fresta entre as tábuas (px do protótipo). */
const FRESTA = 0.45
/** Os cavaletes debaixo do tablado (frações da meia largura) e as pernas da frente de cada um: a abertura e o lado (px). */
const CAVALETES: readonly number[] = [-0.68, 0, 0.68]
const ABERTURA_DAS_PERNAS = 4.2
const LADO_DA_PERNA = 2.2
/** Sobre qual cavalete cai a emenda de cada tábua, pela ordem (o índice em `CAVALETES`; -1 = tábua inteira). */
const EMENDAS: readonly number[] = [0, 2, -1, 2, 0, -1, 0, 2, -1, 2, 0, -1]

/**
 * A cortina: o vão entre os postes (fração da meia largura), quantas pregas, o meio delas, o quanto as da
 * frente e as de trás se afastam desse meio e a meia fundura de cada prega (frações da meia altura). A prega
 * da frente encosta na beira de trás do tablado.
 */
const VAO_DA_CORTINA = 0.92
const PREGAS = 12
const MEIO_DA_CORTINA = -0.845
const AFASTAMENTO_DAS_PREGAS = 0.02
const FUNDURA_DA_PREGA = 0.05
/**
 * A meia largura de cada prega, em fração do passo: elas se cruzam um pouco (sem fresta na 3/4), mas o meio da
 * cortina, entre duas pregas, fica fora das duas (a faixa franzida de cima é peça solta, ver `montarCortina`).
 */
const LARGURA_DA_PREGA = 0.53
/** A luz das pregas que vêm para a frente e das que vão para trás (a frente delas na 3/4 sai listrada de pé) e a do franzido de cima. */
const LUZ_DA_PREGA_DA_FRENTE = 0.1
const LUZ_DA_PREGA_DE_TRAS = -0.2
const LUZ_DO_FRANZIDO = 0.13
/** A beira da sombra das colunas altas (px), curta: a sombra delas cai quase toda debaixo do tablado. */
const BORDA_DA_SOMBRA_ALTA = 1.2
/** A trave e os postes: a linha deles (fração da meia altura), o lado dos postes (fração da meia largura) e os raios (px). */
const LINHA_DA_TRAVE = -0.95
const LADO_DOS_POSTES = 0.95
const RAIO_DA_TRAVE = 1.9
const RAIO_DO_POSTE = 2.4
const RAIO_DO_PINACULO = 1.5
/**
 * As bandeirolas amarradas na trave: quantas, de onde a onde (fração da meia largura), a largura e o
 * comprimento de cada uma (px). Elas começam um pouco atrás do eixo da trave e caem pela frente dela: o meio
 * de cada uma fica dentro da trave, então sobem com ela na 3/4.
 */
const BANDEIROLAS = 17
const VAO_DAS_BANDEIROLAS = 0.9
const LARGURA_DA_BANDEIROLA = 3.4
const COMPRIMENTO_DA_BANDEIROLA = 3.4
const RECUO_DA_BANDEIROLA = 0.9

/** O banquinho: onde fica (fração da meia largura), o raio do assento, as pernas da frente e as espigas no assento (px). */
const LUGAR_DO_BANQUINHO = -0.7
const RAIO_DO_ASSENTO = 5.4
const FOLGA_DO_ASSENTO = 0.5
const ABERTURA_DO_BANQUINHO = 3.5
const LADO_DA_PERNA_DO_BANQUINHO = 1.8
const ESPIGAS: readonly Ponto[] = [
  [-2.7, 2.9],
  [2.7, 2.9],
  [0, -3.4],
]

/**
 * O alaúde, deitado no tablado à direita do banquinho, com o cravelhal encostado no assento: o meio do bojo a
 * partir do banquinho e da divisa das faixas (px) e o rumo do braço.
 */
const ALAUDE = { dx: 22.3, dy: -6.6, giro: Math.PI + 0.22 } as const
/** O bojo em pera (dois lobos), a roseta, o cavalete, o braço, o espelho, os trastes, as cordas e o cravelhal, ao longo do alaúde (px). */
const LOBO_GRANDE = { u: -0.5, ru: 6.2, rv: 5.4 } as const
const LOBO_PEQUENO = { u: 4.2, ru: 3.4, rv: 3.2 } as const
const ROSETA = { u: 1.6, raio: 1.6, raios: 6 } as const
const CAVALETE_DO_ALAUDE = { u: -3.4, meio: 2.1 } as const
const BRACO = { de: 6.6, ate: 16.5, largura: 2.3 } as const
const ESPELHO = { de: 4.4, largura: 1.6 } as const
const TRASTES: readonly number[] = [8, 9.6, 11.1, 12.4, 13.6, 14.7]
const CORDAS: readonly number[] = [-0.55, -0.18, 0.18, 0.55]
const CRAVELHAL = { ate: 19, largura: 2.6 } as const
const CRAVELHAS: readonly number[] = [17.3, 18.5]
const LADO_DAS_CRAVELHAS = 1.45

/** O chapéu virado (frações da meia pegada), a aba, a copa e as moedas (px). */
const CHAPEU = { x: -0.42, y: 0.83 } as const
const RAIO_DA_ABA = 6.6
const RAIO_DA_COPA = 3.9
const RAIO_DA_MOEDA = 1
/** A pena deitada na aba: o meio (a partir do chapéu), o meio comprimento, a meia largura e o giro (px). */
const PENA_NA_ABA = { dx: -1.2, dy: -3.1, meio: 5.6, meia: 1.15, giro: -0.5 } as const

// ---------- as cores ----------

const NOGUEIRA = materialDaPeca('nogueira')
const CORDA = materialDaPeca('corda')
/** A sombra pintada no tablado (a do chão fica debaixo das tábuas). */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x1e, 0x18, 0x14] }
/** As bandeirolas: panos vivos mas contidos (saturação HSV até 0,6 antes da luz). */
const CORES_DAS_BANDEIROLAS: readonly Rgb[] = [
  [0xa4, 0x4c, 0x44],
  [0xc0, 0x96, 0x50],
  [0x5e, 0x7e, 0x56],
  [0xdc, 0xd0, 0xb2],
  [0x50, 0x68, 0x94],
]
/** O alaúde: o tampo de abeto claro, a roseta e o cavalete escuros, o espelho de ébano, os trastes e as cordas. */
const TAMPO_DO_ALAUDE: MaterialDaPeca = { classe: 'madeira', rgb: [0xd4, 0xb0, 0x76] }
const ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2c, 0x22] }
const EBANO: MaterialDaPeca = { classe: 'liso', rgb: [0x30, 0x26, 0x20] }
const FIO_CLARO: MaterialDaPeca = { classe: 'liso', rgb: [0xe4, 0xdc, 0xc6] }
/** O chapéu: o feltro verde, o fundo da copa, a pena com a ponta tingida e as moedas. */
const FELTRO: MaterialDaPeca = { classe: 'tecido', fio: 'la', rgb: [0x58, 0x6c, 0x54] }
const FUNDO_DA_COPA: MaterialDaPeca = { classe: 'liso', rgb: [0x2a, 0x26, 0x22] }
const PENA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd8, 0xbe] }
const PONTA_DA_PENA: Rgb = [0xa8, 0x48, 0x40]
const OURO: Rgb = [0xd2, 0xae, 0x5c]
const COBRE: Rgb = [0xae, 0x6e, 0x4c]
const PRATA: Rgb = [0xc8, 0xca, 0xc4]
/** As moedas no chapéu e as que caíram fora: [dx, dy] a partir do chapéu (px) e o metal. */
const MOEDAS_NO_CHAPEU: readonly (readonly [number, number, Rgb])[] = [
  [-1.2, 0.6, OURO],
  [1.1, -0.9, COBRE],
  [0.6, 1.6, PRATA],
  [-0.4, -1.8, COBRE],
  [1.9, 0.9, OURO],
]
const MOEDAS_NO_CHAO: readonly (readonly [number, number, Rgb])[] = [
  [9.2, 2.4, COBRE],
  [-8.4, -3.6, PRATA],
]

/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5

function misturarEm(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

// ---------- o tablado ----------

/** O tablado (em px), partido em duas faixas na `yDivisa`: o vão escuro, as tábuas, os pregos e as pernas da frente. */
function montarTablado(c: ContextoDoMovel, cena: Cena, palco: Caixa, yDivisa: number): void {
  const { hw, g, peca: P } = c
  const L = cena.partes
  const mad = c.m.madeira
  const [x0, y0, x1, y1] = palco
  const zPalco = g * ALTURA_DO_PALCO
  cena.sombras.push(contato(caixa(x0, y0, x1, y1, 0.8), 0.36))
  const faixas: readonly Caixa[] = [
    [x0, y0, x1, yDivisa],
    [x0, yDivisa, x1, y1],
  ]
  faixas.forEach(([fx0, fy0, fx1, fy1], k) => {
    cena.sombras.push({ forma: caixa(fx0, fy0, fx1, fy1), z: zPalco, solta: true, forca: 0.3 })
    // O vão debaixo das tábuas, escuro: aparece nas frestas. É a maior peça de cada faixa, e a madeira dela vira a beirada na 3/4.
    L.push(P(caixa(fx0 + 0.3, fy0 + 0.2, fx1 - 0.3, fy1 - 0.2), mad, { tabua: 0, bisel: 0, contorno: 0, tom: 0.32, semente: 9500 + k }))
  })
  // As pernas da frente dos cavaletes, só na 3/4 (as de trás ficam debaixo do tablado).
  for (const fx of CAVALETES) {
    for (const lado of [-1, 1]) {
      const x = fx * hw + lado * ABERTURA_DAS_PERNAS
      cena.sombras.push({ forma: caixa(x - LADO_DA_PERNA / 2, y1 - LADO_DA_PERNA, x + LADO_DA_PERNA / 2, y1), z: zPalco - g * BEIRADA })
    }
  }
  const passo = (y1 - y0) / TABUAS
  for (let k = 0; k < TABUAS; k += 1) {
    const ta = y0 + k * passo + FRESTA / 2
    const tb = y0 + (k + 1) * passo - FRESTA / 2
    const emenda = EMENDAS[k % EMENDAS.length]
    const xEmenda = emenda < 0 ? 0 : CAVALETES[emenda] * hw
    const pedacos: readonly (readonly [number, number])[] = emenda < 0 ? [[x0, x1]] : [[x0, xEmenda - FRESTA / 2], [xEmenda + FRESTA / 2, x1]]
    pedacos.forEach(([a, b], j) => {
      L.push(P(caixa(a, ta, b, tb, 0.35), mad, { eixo: 0, tabua: 0, bisel: 0.7, contorno: 0.2, tom: 0.92 + 0.14 * hash(k, j, 9511), semente: 9510 + k * 2 + j }))
    })
    // Dois pregos por tábua em cada cavalete, desencontrados.
    const yc = (ta + tb) / 2
    for (const fx of CAVALETES) {
      for (const lado of [-1, 1]) L.push(P(elipse(fx * hw + lado * 1.1, yc + lado * passo * 0.24, 0.42, 0.42), PREGO, { bisel: 0.4, contorno: 0, metal: 0.2 }))
    }
  }
}

// ---------- a cortina, a trave e os postes ----------

/** A cortina franzida atrás do tablado e a sombra dela pintada na faixa de trás. */
function montarCortina(c: ContextoDoMovel, cena: Cena, palco: Caixa, yDivisa: number): void {
  const { hw, hh, g, peca: P } = c
  const L = cena.partes
  const cortina = c.m.cortina
  const daFrente: MaterialDaPeca = { ...cortina, rgb: luz(cortina.rgb, LUZ_DA_PREGA_DA_FRENTE) }
  const deTras: MaterialDaPeca = { ...cortina, rgb: luz(cortina.rgb, LUZ_DA_PREGA_DE_TRAS) }
  const zCortina = g * ALTURA_DA_CORTINA
  const xa = -VAO_DA_CORTINA * hw
  const xb = VAO_DA_CORTINA * hw
  const largura = (xb - xa) / PREGAS
  const rx = largura * LARGURA_DA_PREGA
  const ry = FUNDURA_DA_PREGA * hh
  const yMeio = MEIO_DA_CORTINA * hh
  const desvio = AFASTAMENTO_DAS_PREGAS * hh
  // As de trás primeiro: as da frente cobrem a beira delas, de cima e na 3/4. A sombra de cada prega é de beira
  // curta: ela cai quase toda debaixo do tablado, e a borda larga de 14 colunas altas pesava na pintura.
  for (const naFrente of [false, true]) {
    for (let k = naFrente ? 0 : 1; k < PREGAS; k += 2) {
      const prega = elipse(xa + (k + 0.5) * largura, yMeio + (naFrente ? desvio : -desvio), rx, ry)
      cena.sombras.push({ forma: prega, z: zCortina, suave: BORDA_DA_SOMBRA_ALTA })
      L.push(P(prega, naFrente ? daFrente : deTras, { bisel: rx * 0.7, ruga: 0.7, contorno: 0.24, semente: 9600 + k }))
    }
  }
  // De cima, a faixa franzida contínua por cima das pregas (o meio dela fica fora de todas, então na 3/4 ela
  // fica no chão, debaixo das colunas): a beira da frente ondula com as pregas, que pegam luz e sombra.
  const ondas = PREGAS * 4
  const fase = (x: number): number => Math.cos(Math.PI * ((x - xa) / largura - 0.5))
  const frente: Ponto[] = []
  const atras: Ponto[] = []
  for (let i = 0; i <= ondas; i += 1) {
    const x = xa + ((xb - xa) * i) / ondas
    frente.push([x, yMeio + ry * 0.9 + desvio * fase(x)])
    atras.push([x, yMeio - ry * 0.9 + desvio * fase(x)])
  }
  const tecido = texturaDaClasse('tecido')
  L.push(P(poligono([...frente, ...atras.reverse()]), cortina, {
    bisel: 1.2,
    ruga: 0.5,
    contorno: 0.24,
    textura: (u, v, x, y, p, s, escala) => {
      if (tecido !== null) tecido(u, v, x, y, p, s, escala)
      s[3] += LUZ_DO_FRANZIDO * fase(x)
    },
    semente: 9615,
  }))
  // A sombra da cortina no tablado: o pano varrido para baixo e para a direita pela altura acima das tábuas.
  const [x0, y0, x1] = palco
  const alto = zCortina - g * ALTURA_DO_PALCO
  const sx = SOMBRA_X * alto
  const sy = SOMBRA_Y * alto
  const yAtras = yMeio - desvio - ry
  const yFrente = yMeio + desvio + ry
  const casco: Ponto[] = [
    [xa, yAtras],
    [xb, yAtras],
    [xb + sx, yAtras + sy],
    [xb + sx, yFrente + sy],
    [xa + sx, yFrente + sy],
    [xa, yFrente],
  ]
  L.push(P(dentroDe(poligono(casco), caixa(x0, y0, x1, yDivisa)), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.3, suave: 1.8, semente: 9620 }))
}

/** Os postes roliços, a trave entre eles e as bandeirolas amarradas nela. */
function montarTraveEPostes(c: ContextoDoMovel, cena: Cena): void {
  const { hw, hh, g, peca: P } = c
  const L = cena.partes
  const mad = c.m.madeira
  const yTrave = LINHA_DA_TRAVE * hh
  const xPoste = LADO_DOS_POSTES * hw
  for (const lado of [-1, 1]) {
    const poste = elipse(lado * xPoste, yTrave, RAIO_DO_POSTE, RAIO_DO_POSTE)
    cena.sombras.push({ forma: poste, z: g * ALTURA_DOS_POSTES, suave: BORDA_DA_SOMBRA_ALTA }, contato(poste, 0.34))
    L.push(P(poste, mad, { tabua: 0, bisel: RAIO_DO_POSTE * 0.8, tom: 0.9, contorno: 0.26, semente: 9700 + lado }))
    L.push(P(elipse(lado * xPoste - 0.3, yTrave - 0.3, RAIO_DO_PINACULO, RAIO_DO_PINACULO), mad, { tabua: 0, bisel: RAIO_DO_PINACULO, tom: 1.1, contorno: 0.24, semente: 9703 + lado }))
  }
  const trave = capsula(-xPoste, yTrave, xPoste, yTrave, RAIO_DA_TRAVE)
  cena.sombras.push({ forma: trave, z: g * ALTURA_DA_TRAVE, solta: true, forca: 0.28 })
  L.push(P(trave, mad, { eixo: 0, tabua: 0, bisel: RAIO_DA_TRAVE * 0.8, contorno: 0.26, semente: 9710 }))
  // A corda por cima da trave e as bandeirolas caindo pela frente dela.
  const xa = -VAO_DAS_BANDEIROLAS * hw
  const xb = VAO_DAS_BANDEIROLAS * hw
  const yCorda = yTrave - RECUO_DA_BANDEIROLA
  L.push(P(barra(xa, yCorda, xb, yCorda, 0.45), CORDA, { bisel: 0.2, contorno: 0.2, semente: 9711 }))
  for (let i = 0; i < BANDEIROLAS; i += 1) L.push(bandeirola(P, xa + ((xb - xa) * (i + 0.5)) / BANDEIROLAS, yCorda, i))
}

/** Uma bandeirola de pano com a boca em `y`, apontando para a frente, centrada em `x`. */
function bandeirola(P: CriarPeca, x: number, y: number, i: number): Peca {
  const pano = poligono([
    [x - LARGURA_DA_BANDEIROLA / 2, y],
    [x + LARGURA_DA_BANDEIROLA / 2, y],
    [x, y + COMPRIMENTO_DA_BANDEIROLA],
  ])
  const cor = CORES_DAS_BANDEIROLAS[i % CORES_DAS_BANDEIROLAS.length]
  return P(pano, { classe: 'tecido', fio: 'linho', rgb: cor }, { bisel: 0.5, contorno: 0.26, tom: 0.96 + 0.08 * hash(i, 1, 9721), semente: 9720 + i, projeta: { dist: 1.2, forca: 0.3, suave: 0.6 } })
}

// ---------- o banquinho e o alaúde ----------

/** O banquinho redondo de três pernas, com a base na divisa das faixas (ver o comentário do arquivo). */
function montarBanquinho(c: ContextoDoMovel, cena: Cena, cx: number, yDivisa: number): void {
  const { g, peca: P } = c
  const L = cena.partes
  const mad = c.m.madeira
  const zPalco = g * ALTURA_DO_PALCO
  const zAssento = zPalco + g * ALTURA_DO_BANQUINHO
  // As duas pernas da frente; a de trás fica escondida atrás delas e do assento.
  for (const lado of [-1, 1]) {
    const x = cx + lado * ABERTURA_DO_BANQUINHO
    const perna = caixa(x - LADO_DA_PERNA_DO_BANQUINHO / 2, yDivisa - LADO_DA_PERNA_DO_BANQUINHO, x + LADO_DA_PERNA_DO_BANQUINHO / 2, yDivisa)
    cena.sombras.push({ forma: perna, z: zAssento - g * BEIRADA })
  }
  // A base do assento um nada ao sul da das pernas: ele sai depois delas na 3/4.
  const cy = yDivisa + FOLGA_DO_ASSENTO - RAIO_DO_ASSENTO
  const assento = elipse(cx, cy, RAIO_DO_ASSENTO, RAIO_DO_ASSENTO)
  cena.sombras.push({ forma: assento, z: zAssento, solta: true, forca: 0 })
  L.push(P(assento, mad, { eixo: 0.4, tabua: 0, bisel: 1.5, tom: 1.06, contorno: 0.26, semente: 9800, projeta: { dist: SOMBRA_POR_ALTURA * (zAssento - zPalco), forca: 0.34, suave: 1.2 } }))
  ESPIGAS.forEach(([dx, dy], i) => {
    L.push(P(elipse(cx + dx, cy + dy, 0.75, 0.75), mad, { tabua: 0, bisel: 0.5, tom: 0.72, contorno: 0.2, semente: 9801 + i }))
  })
}

/** A roseta do alaúde: o furo escuro com a renda entalhada (um anel e os raios, mais claros). */
function texDaRoseta(cx: number, cy: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    if (escala < ESCALA_DO_DETALHE) return
    const dx = x - cx
    const dy = y - cy
    const q = Math.hypot(dx, dy) / ROSETA.raio
    const noRaio = Math.abs(Math.sin((Math.atan2(dy, dx) * ROSETA.raios) / 2)) < 0.2 && q < 0.85
    if (Math.abs(q - 0.6) < 0.11 || noRaio) misturarEm(s, TAMPO_DO_ALAUDE.rgb, 0.7)
  }
}

/** O alaúde deitado: o meio do bojo em (ox, oy), o braço no rumo `giro`. */
function montarAlaude(P: CriarPeca, L: Peca[], ox: number, oy: number, giro: number): void {
  const co = Math.cos(giro)
  const si = Math.sin(giro)
  const em = (u: number, v: number): Ponto => [ox + u * co - v * si, oy + u * si + v * co]
  const ao = (u0: number, u1: number, v = 0): [number, number, number, number] => {
    const [ax, ay] = em(u0, v)
    const [bx, by] = em(u1, v)
    return [ax, ay, bx, by]
  }
  const sombra = { dist: 0.9, forca: 0.34, suave: 0.6 }
  const [gx, gy] = em(LOBO_GRANDE.u, 0)
  const [px, py] = em(LOBO_PEQUENO.u, 0)
  const bojo = uniao(elipseGirada(gx, gy, LOBO_GRANDE.ru, LOBO_GRANDE.rv, giro), elipseGirada(px, py, LOBO_PEQUENO.ru, LOBO_PEQUENO.rv, giro))
  L.push(P(bojo, TAMPO_DO_ALAUDE, { eixo: giro, tabua: 0, bisel: 2.2, contorno: 0.3, semente: 9850, projeta: sombra }))
  const [rx, ry] = em(ROSETA.u, 0)
  L.push(P(elipse(rx, ry, ROSETA.raio, ROSETA.raio), ESCURO, { bisel: 0, contorno: 0.24, textura: texDaRoseta(rx, ry), semente: 9851 }))
  const [c0x, c0y] = em(CAVALETE_DO_ALAUDE.u, -CAVALETE_DO_ALAUDE.meio)
  const [c1x, c1y] = em(CAVALETE_DO_ALAUDE.u, CAVALETE_DO_ALAUDE.meio)
  L.push(P(barra(c0x, c0y, c1x, c1y, 0.8), ESCURO, { bisel: 0.3, contorno: 0.25, semente: 9852, projeta: { dist: 0.5, forca: 0.3 } }))
  L.push(P(barra(...ao(BRACO.de, BRACO.ate), BRACO.largura), NOGUEIRA, { eixo: giro, tabua: 0, bisel: 0.8, contorno: 0.28, semente: 9853, projeta: sombra }))
  L.push(P(barra(...ao(ESPELHO.de, BRACO.ate), ESPELHO.largura), EBANO, { bisel: 0.3, contorno: 0.2, semente: 9854 }))
  for (const u of TRASTES) {
    const [t0x, t0y] = em(u, -ESPELHO.largura / 2)
    const [t1x, t1y] = em(u, ESPELHO.largura / 2)
    L.push(P(barra(t0x, t0y, t1x, t1y, 0.22), FIO_CLARO, { bisel: 0, contorno: 0, alfa: 0.7 }))
  }
  for (const v of CORDAS) L.push(P(barra(...ao(CAVALETE_DO_ALAUDE.u, BRACO.ate, v), 0.2), FIO_CLARO, { bisel: 0, contorno: 0, alfa: 0.85 }))
  // O cravelhal dobrado para trás: de cima, um toco escuro com as cravelhas para os dois lados.
  L.push(P(barra(...ao(BRACO.ate, CRAVELHAL.ate), CRAVELHAL.largura), NOGUEIRA, { eixo: giro, tabua: 0, bisel: 0.7, tom: 0.84, contorno: 0.3, semente: 9855, projeta: sombra }))
  for (const u of CRAVELHAS) {
    for (const lado of [-1, 1]) {
      const [kx, ky] = em(u, lado * LADO_DAS_CRAVELHAS)
      L.push(P(elipse(kx, ky, 0.55, 0.55), ESCURO, { bisel: 0.3, contorno: 0.2 }))
    }
  }
}

// ---------- o degrau e o chapéu ----------

/** O degrau: duas tábuas pregadas, na frente do tablado. */
function montarDegrau(c: ContextoDoMovel, cena: Cena, degrau: Caixa): void {
  const { g, peca: P } = c
  const L = cena.partes
  const mad = c.m.madeira
  const [x0, y0, x1, y1] = degrau
  const forma = caixa(x0, y0, x1, y1, 0.5)
  cena.sombras.push({ forma, z: g * ALTURA_DO_DEGRAU }, contato(forma, 0.34))
  const meio = (y0 + y1) / 2
  const tabuas: readonly (readonly [number, number])[] = [
    [y0, meio],
    [meio, y1],
  ]
  tabuas.forEach(([a, b], k) => {
    L.push(P(caixa(x0, a + FRESTA / 2, x1, b - FRESTA / 2, 0.35), mad, { eixo: 0, tabua: 0, bisel: 0.7, contorno: 0.24, tom: 0.98 + 0.1 * k, semente: 9950 + k }))
    for (const x of [x0 + 1.6, x1 - 1.6]) L.push(P(elipse(x, (a + b) / 2, 0.42, 0.42), PREGO, { bisel: 0.4, contorno: 0, metal: 0.2 }))
  })
}

/** A pena: a haste no meio, as barbas de viés e a ponta tingida. */
function texDaPena(cx: number, cy: number, giro: number, meio: number): Textura {
  const co = Math.cos(giro)
  const si = Math.sin(giro)
  return (_u, _v, x, y, _p, s, escala) => {
    const ao = (x - cx) * co + (y - cy) * si
    const atraves = -(x - cx) * si + (y - cy) * co
    misturarEm(s, PONTA_DA_PENA, limitar01((ao / meio - 0.4) * 4))
    if (escala < ESCALA_DO_DETALHE) return
    if (Math.abs(atraves) < 0.15) s[3] -= 0.16
    const f = (ao - Math.abs(atraves) * 1.6) / 0.7
    if (f - Math.floor(f) < 0.25) s[3] -= 0.07
  }
}

/** O chapéu virado no chão, com as moedas dentro e a pena na aba, e as moedas que caíram fora. */
function montarChapeu(c: ContextoDoMovel, cena: Cena, hx: number, hy: number): void {
  const { g, peca: P } = c
  const L = cena.partes
  MOEDAS_NO_CHAO.forEach(([dx, dy, cor], i) => {
    const moeda = elipse(hx + dx, hy + dy, RAIO_DA_MOEDA, RAIO_DA_MOEDA)
    cena.sombras.push(contato(moeda, 0.3))
    L.push(P(moeda, { classe: 'metal', rgb: cor }, { bisel: 0.5, contorno: 0.3, metal: 0.5, semente: 9910 + i }))
  })
  const aba = elipse(hx, hy, RAIO_DA_ABA, RAIO_DA_ABA)
  cena.sombras.push({ forma: aba, z: g * ALTURA_DO_CHAPEU }, contato(aba, 0.32))
  L.push(P(aba, FELTRO, { bisel: 1.6, contorno: 0.28, semente: 9900 }))
  L.push(P(elipse(hx + 0.2, hy + 0.2, RAIO_DA_COPA, RAIO_DA_COPA), FUNDO_DA_COPA, { bisel: 0, contorno: 0.22, recesso: { k: 2, forca: 0.45 }, semente: 9901 }))
  MOEDAS_NO_CHAPEU.forEach(([dx, dy, cor], i) => {
    L.push(P(elipse(hx + dx, hy + dy, RAIO_DA_MOEDA, RAIO_DA_MOEDA), { classe: 'metal', rgb: cor }, { bisel: 0.5, contorno: 0.3, metal: 0.5, semente: 9902 + i, projeta: { dist: 0.4, forca: 0.3 } }))
  })
  const { dx, dy, meio, meia, giro } = PENA_NA_ABA
  L.push(P(elipseGirada(hx + dx, hy + dy, meio, meia, giro), PENA, { bisel: 0.5, contorno: 0.24, textura: texDaPena(hx + dx, hy + dy, giro, meio), semente: 9908, projeta: { dist: 0.7, forca: 0.32 } }))
}

// ---------- o palco ----------

export const montarPalcoDeBardo: MontarMovel = (c, cena) => {
  const { hw, hh } = c
  const palco: Caixa = [PALCO[0] * hw, PALCO[1] * hh, PALCO[2] * hw, PALCO[3] * hh]
  const yDivisa = palco[1] + ((palco[3] - palco[1]) * TABUAS_DE_TRAS) / TABUAS
  montarTablado(c, cena, palco, yDivisa)
  montarCortina(c, cena, palco, yDivisa)
  const cx = LUGAR_DO_BANQUINHO * hw
  montarBanquinho(c, cena, cx, yDivisa)
  montarAlaude(c.peca, cena.partes, cx + ALAUDE.dx, yDivisa + ALAUDE.dy, ALAUDE.giro)
  montarDegrau(c, cena, [DEGRAU[0] * hw, DEGRAU[1] * hh, DEGRAU[2] * hw, DEGRAU[3] * hh])
  montarChapeu(c, cena, CHAPEU.x * hw, CHAPEU.y * hh)
  montarTraveEPostes(c, cena)
}
