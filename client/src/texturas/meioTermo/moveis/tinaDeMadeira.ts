/**
 * TINA DE MADEIRA de cima com volume (lote 5 dos objetos novos, 11/11/2026):
 * a tina de banho rústica, redonda, larga e baixa, de ADUELAS com dois aros de
 * ferro, cheia de água quente. De cima aparecem os dois aros (o de baixo, na
 * beira, com a emenda rebitada; o de cima, logo abaixo da boca), a BORDA das
 * aduelas (a madeira cortada, mais clara), a parede de dentro na sombra, a
 * ÁGUA larga (a sombra da borda do lado da luz, a beira rasa, os reflexos) e,
 * por cima dela, o VAPOR pintado: uma névoa leve e três fios que sobem em S.
 * Na borda, a ESCOVA de banho atravessada (as cerdas para cima, o cabo por
 * cima da água) e o PANO dobrado. Ao lado, encostado nela do lado do canto da
 * frente, o BANQUINHO de dois degraus com as duas laterais, virado para a tina.
 *
 * O que a separa do barril (`barril.ts`): o barril é fechado, com a tampa de
 * tábuas e o batoque; a tina é aberta, mais larga (1,5 casa) e mais baixa
 * (0,45 casa contra 0,62), com o disco de água, o vapor e os apetrechos.
 *
 * Na 3/4 (`tresQuartos.ts`): a tina é uma coluna, com a frente de aduelas em
 * pé. Os dois AROS aparecem na frente dela: cada um é um tampo solto e fino,
 * só a metade da frente do anel, na altura dele, com beirada zero (o perfil
 * usa `espessura: 0`: o que se vê é o próprio anel). O REBITE de cada aro é a
 * peça dele (o meio fica fora da coluna da tina, dentro do anel): é quem dá o
 * ferro ao aro. A metade da frente é a de quem olha: o desenho lê o quarto de
 * volta que a 3/4 pinta (`c.giro`) e põe os aros e os rebites do lado que fica
 * embaixo na tela. Os dois degraus do banquinho são colunas.
 *
 * A 25% de zoom sobram o anel de madeira com o risco escuro dos aros, o disco
 * largo de água com a mancha clara do vapor e o banquinho ao lado. A tina é
 * sempre redonda, do tamanho do menor lado da pegada, encostada no canto do
 * fundo à esquerda; o banquinho fica colado nela, do lado do canto da frente
 * à direita. Materiais: `madeira` e `aros` (os dois que um objeto guarda). O
 * pano de linho, a água, o vapor e a escova são fixos.
 */
import { limitar01, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, barra, cadeia, caixa, capsula, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { G, LENCOL, materialDaPeca, QUARTO, type MontarMovel } from './contexto'

/** O desenho foi medido em 1,5 casa (42 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIA_PEGADA = 0.75 * G
const GRAUS = Math.PI / 180

/** A altura da boca da tina e a dos dois degraus do banquinho, em casas. */
const ALTURA = 0.45
const ALTURA_DO_DEGRAU_DE_BAIXO = 0.13
const ALTURA_DO_DEGRAU_DE_CIMA = 0.27
/** A altura de cada aro na frente da tina, em fração da altura dela. */
const ALTURA_DO_ARO_DE_BAIXO = 0.34
const ALTURA_DO_ARO_DE_CIMA = 0.82

/** O raio da tina (fração do menor meio lado) e a margem dela até o canto do fundo à esquerda (a mesma fração). */
const RAIO_DA_TINA = 0.86
const MARGEM = 0.02
/** Quantas aduelas dão a volta (número inteiro: a última fecha com a primeira). */
const ADUELAS = 26
/** Os raios vistos de cima, em fração do raio da tina: o aro de baixo, o de cima, a borda das aduelas, a parede e a água. */
const ARO_DE_BAIXO: readonly [number, number] = [0.995, 0.95]
const ARO_DE_CIMA: readonly [number, number] = [0.885, 0.845]
const BORDA_POR_DENTRO = 0.745
const PAREDE = 0.75
const RAIO_DA_AGUA = 0.705

/** A água quente da tina: o azul-petróleo do Meio-Termo (o fundo é madeira escura), a beira rasa e o reflexo. */
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('agua', 1.04)) }
const AGUA_RASA: Rgb = [0x7f, 0xa5, 0xa3]
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xd3, 0xdd, 0xd9] }
/** O vapor: um branco morno, sempre meio transparente. */
const VAPOR: MaterialDaPeca = { classe: 'liso', rgb: [0xf4, 0xf2, 0xea] }
/** As cerdas da escova: a palha clara. */
const CERDAS: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xcd, 0xa2] }

// ---------- a água e o vapor ----------

/** Para o lado da luz, no chão (os mesmos números do motor): a borda desse lado faz sombra na água. */
const PARA_A_LUZ_X = -0.79
const PARA_A_LUZ_Y = -0.61
/** O comprimento da sombra da borda na água e o borrão dela (px da pegada de partida), e quanto ela escurece. */
const SOMBRA_DA_BORDA = 3.4
const BORRAO_DA_SOMBRA = 2
const FORCA_DA_SOMBRA = 0.3
/** Até onde, a partir da parede, a água é rasa (px da pegada de partida), e quanto da cor rasa entra nela. */
const RASO = 5
const COR_DO_RASO = 0.5

/** A água da tina: a sombra da borda do lado da luz, a beira rasa e a marola miúda, sem direção (a tina é redonda). */
function texDaAgua(agua: Forma, k: number, sem: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const naSombra = limitar01(0.5 + agua.d(x + PARA_A_LUZ_X * SOMBRA_DA_BORDA * k, y + PARA_A_LUZ_Y * SOMBRA_DA_BORDA * k) / (BORRAO_DA_SOMBRA * k))
    const rasa = limitar01(1 + agua.d(x, y) / (RASO * k))
    const t = rasa * rasa * COR_DO_RASO
    s[0] += (AGUA_RASA[0] - s[0]) * t
    s[1] += (AGUA_RASA[1] - s[1]) * t
    s[2] += (AGUA_RASA[2] - s[2]) * t
    const xs = x / k
    const ys = y / k
    s[3] += ruido(xs * 0.11 + sem, ys * 0.11) * 0.09 + ruido(xs * 0.34, ys * 0.34 + sem) * 0.03 - FORCA_DA_SOMBRA * naSombra
  }
}

/** O fio de vapor some nas duas pontas: a opacidade cresce do pé até o meio e cai até a ponta. */
function texDoFioDeVapor(x0: number, y0: number, dx: number, dy: number, comprimento: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    s[5] = Math.sin(limitar01(((x - x0) * dx + (y - y0) * dy) / comprimento) * Math.PI)
  }
}

/** Os fios de vapor: o pé [x, y] em fração do raio da água, o ângulo em graus, o comprimento e a largura do S (px) e a fase dele. */
const FIOS_DE_VAPOR: readonly (readonly [x: number, y: number, angulo: number, comprimento: number, largura: number, fase: number])[] = [
  [-0.5, 0.34, -62, 21, 2.6, 0],
  [-0.06, 0.5, -70, 25, 3, 2.1],
  [0.36, 0.3, -58, 19, 2.4, 4],
]
const PASSOS_DO_FIO = 12
const RAIO_DO_FIO = 1.35
const ALFA_DO_FIO = 0.4
const BORRAO_DO_FIO = 1.9
/** A névoa por baixo dos fios: a opacidade no cheio e o borrão (px). */
const ALFA_DA_NEVOA = 0.13
const BORRAO_DA_NEVOA = 7

// ---------- os apetrechos ----------

/**
 * A escova atravessada na borda: o ângulo em que fica (graus, 0 = a direita, negativo = o fundo), o meio
 * comprimento da cabeça entre os dois meios das pontas redondas, a meia largura dela e o cabo (px).
 */
const ANGULO_DA_ESCOVA = -38
const MEIA_ESCOVA = 2.7
const MEIA_LARGURA_DA_ESCOVA = 2.8
const CABO_DA_ESCOVA = 11
/** Os tufos de cerdas, em duas fileiras: onde ficam ao comprido da cabeça, a meia distância entre as fileiras e o raio (px). */
const TUFOS_DA_ESCOVA: readonly number[] = [-3.3, -1.1, 1.1, 3.3]
const MEIA_FILEIRA = 1.15
const RAIO_DO_TUFO = 0.92
/** O pano dobrado na borda: o ângulo do meio dele e o meio ângulo que ocupa, em graus. */
const ANGULO_DO_PANO = 152
const MEIO_PANO = 15
const PASSOS_DO_PANO = 6

/** O banquinho: o vão entre ele e a tina, o meio comprimento, a fundura de cada degrau e a grossura das laterais (px). */
const BANCO_AFASTADO_DA_TINA = 2.9
const MEIO_BANCO = 9
const DEGRAU = 7.4
const LATERAL_DO_BANCO = 1.7

/**
 * Para onde fica a frente NA TELA, no desenho, depois do quarto de volta que a 3/4 pinta (`giro`, em graus; 0
 * fora dela): os aros da frente da tina têm de ficar do lado de quem olha, com o objeto girado ou não.
 */
function frenteNaTela(giro: number): readonly [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [1, 0] : quartos === 2 ? [0, -1] : quartos === 3 ? [-1, 0] : [0, 1]
}

/** O setor de anel (o pano por cima da borda): entre os raios `r0` e `r1`, do ângulo `a0` ao `a1` (radianos). */
function setor(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): Forma {
  const pontos: Ponto[] = []
  for (let i = 0; i <= PASSOS_DO_PANO; i += 1) {
    const a = a0 + ((a1 - a0) * i) / PASSOS_DO_PANO
    pontos.push([cx + Math.cos(a) * r1, cy + Math.sin(a) * r1])
  }
  for (let i = PASSOS_DO_PANO; i >= 0; i -= 1) {
    const a = a0 + ((a1 - a0) * i) / PASSOS_DO_PANO
    pontos.push([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0])
  }
  return poligono(pontos)
}

export const montarTinaDeMadeira: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const aro = c.m.aros
  const menor = Math.min(hw, hh)
  const k = menor / MEIA_PEGADA
  const L = cena.partes
  const R = menor * RAIO_DA_TINA
  const cx = -hw + R + menor * MARGEM
  const cy = -hh + R + menor * MARGEM
  const altura = g * ALTURA

  // O BANQUINHO de dois degraus, encostado na tina do lado do canto da frente à direita (onde a pegada tem
  // sobra) e virado para ela: o degrau de baixo por fora, o de cima junto dela. (ux, uy) aponta para a tina.
  const ateOCanto = Math.hypot(hw - cx, hh - cy) || 1
  const ux = (cx - hw) / ateOCanto
  const uy = (cy - hh) / ateOCanto
  const doMeioDaTina = R + (BANCO_AFASTADO_DA_TINA + DEGRAU) * k
  const bx = cx - ux * doMeioDaTina
  const by = cy - uy * doMeioDaTina
  const aoComprido = Math.atan2(ux, -uy)
  const degrau = (afasta: number): Forma => {
    const mx = bx + ux * afasta * DEGRAU * k * 0.5
    const my = by + uy * afasta * DEGRAU * k * 0.5
    return barra(mx + uy * MEIO_BANCO * k, my - ux * MEIO_BANCO * k, mx - uy * MEIO_BANCO * k, my + ux * MEIO_BANCO * k, DEGRAU * k)
  }
  /** A lateral do banquinho no trecho de um degrau: a tábua em pé de cada ponta, vista de topo (o meio dela cai dentro do degrau). */
  const lateral = (afasta: number, ponta: number): Forma => {
    const lx = bx - uy * ponta * (MEIO_BANCO - LATERAL_DO_BANCO * 0.5) * k
    const ly = by + ux * ponta * (MEIO_BANCO - LATERAL_DO_BANCO * 0.5) * k
    const de = afasta < 0 ? -DEGRAU * k : 0
    return barra(lx + ux * de, ly + uy * de, lx + ux * (de + DEGRAU * k), ly + uy * (de + DEGRAU * k), LATERAL_DO_BANCO * k)
  }
  const degrauDeBaixo = degrau(-1)
  const degrauDeCima = degrau(1)
  cena.sombras.push({ forma: degrauDeBaixo, z: g * ALTURA_DO_DEGRAU_DE_BAIXO }, contato(degrauDeBaixo, 0.3), { forma: degrauDeCima, z: g * ALTURA_DO_DEGRAU_DE_CIMA }, contato(degrauDeCima, 0.3))
  // O degrau de baixo com as laterais dele primeiro: a sombra do de cima cai em tudo isso.
  L.push(P(degrauDeBaixo, mad, { eixo: aoComprido, tabua: DEGRAU * k * 0.5, bisel: 0.9 * k, tom: 0.88, contorno: 0.26, semente: 6210 }))
  for (const ponta of [-1, 1]) L.push(P(lateral(-1, ponta), mad, { eixo: aoComprido + QUARTO, tabua: 0, bisel: 0.6 * k, tom: 0.7, contorno: 0.24, semente: 6212 + ponta }))
  L.push(P(degrauDeCima, mad, { eixo: aoComprido, tabua: DEGRAU * k * 0.5, bisel: 0.9 * k, tom: 1.06, contorno: 0.24, semente: 6211, projeta: { dist: 2.6 * k, forca: 0.36 } }))
  for (const ponta of [-1, 1]) L.push(P(lateral(1, ponta), mad, { eixo: aoComprido + QUARTO, tabua: 0, bisel: 0.6 * k, tom: 0.84, contorno: 0.24, semente: 6215 + ponta }))

  // A TINA: as aduelas, os dois aros, a borda cortada e a parede de dentro.
  const corpo = elipse(cx, cy, R, R)
  const coluna = elipse(cx, cy, R - 0.5 * k, R - 0.5 * k)
  cena.sombras.push({ forma: coluna, z: altura }, contato(corpo, 0.3))
  const polar = { cx, cy, r: R }
  const aduela = (2 * Math.PI * R) / ADUELAS
  const disco = (fracao: number): Forma => elipse(cx, cy, R * fracao, R * fracao)
  const aroVistoDeCima = (faixa: readonly [number, number]): Forma => anel(cx, cy, R * faixa[0], R * faixa[0], R * faixa[1], R * faixa[1])
  L.push(P(corpo, mad, { polar, tabua: aduela, bisel: R * 0.08, semente: 6220 }))
  L.push(P(aroVistoDeCima(ARO_DE_BAIXO), aro, { bisel: 0.9 * k, contorno: 0.3, semente: 6221 }))
  L.push(P(aroVistoDeCima(ARO_DE_CIMA), aro, { bisel: 0.8 * k, contorno: 0.3, semente: 6222, projeta: { dist: 0.8 * k, forca: 0.26 } }))
  L.push(P(anel(cx, cy, R * ARO_DE_CIMA[1], R * ARO_DE_CIMA[1], R * BORDA_POR_DENTRO, R * BORDA_POR_DENTRO), mad, { polar, tabua: aduela, bisel: 1.1 * k, luz: 0.08, contorno: 0.2, semente: 6220 }))
  L.push(P(disco(PAREDE), mad, { polar, tabua: aduela, bisel: 0, tom: 0.66, contorno: 0.14, recesso: { k: 3 * k, forca: 0.42 }, semente: 6220 }))

  // A ÁGUA e os reflexos.
  const raioDaAgua = R * RAIO_DA_AGUA
  const agua = disco(RAIO_DA_AGUA)
  L.push(P(agua, AGUA, { bisel: 0, contorno: 0.18, textura: texDaAgua(agua, k, 6230), semente: 6230 }))
  L.push(P(elipse(cx + raioDaAgua * 0.3, cy + raioDaAgua * 0.56, raioDaAgua * 0.3, 0.8 * k), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.26, suave: 1.1 * k, semente: 6231 }))
  L.push(P(elipse(cx + raioDaAgua * 0.56, cy + raioDaAgua * 0.3, raioDaAgua * 0.12, 0.6 * k), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.22, suave: 0.9 * k, semente: 6232 }))

  // O PANO de linho dobrado por cima da borda: a volta de baixo e a dobra de cima, um pouco torta.
  const meioDoPano = ANGULO_DO_PANO * GRAUS
  const meioAngulo = MEIO_PANO * GRAUS
  L.push(P(setor(cx, cy, R * 0.655, R * 0.905, meioDoPano - meioAngulo, meioDoPano + meioAngulo), LENCOL, { eixo: meioDoPano, bisel: 0.8 * k, ruga: 0.5, tom: 0.94, contorno: 0.26, semente: 6240, projeta: { dist: 1 * k, forca: 0.28 } }))
  L.push(P(setor(cx, cy, R * 0.69, R * 0.885, meioDoPano - meioAngulo * 0.6, meioDoPano + meioAngulo * 0.84), LENCOL, { eixo: meioDoPano, bisel: 0.9 * k, ruga: 0.5, tom: 1.04, contorno: 0.22, semente: 6241, projeta: { dist: 0.6 * k, forca: 0.22 } }))

  // A ESCOVA atravessada na borda: a cabeça de madeira com as cerdas para cima, e o cabo por cima da água.
  const pinho = materialDaPeca('pinho')
  const giroDaEscova = ANGULO_DA_ESCOVA * GRAUS
  const ex = Math.cos(giroDaEscova)
  const ey = Math.sin(giroDaEscova)
  const raioDaEscova = R * (ARO_DE_CIMA[1] + BORDA_POR_DENTRO) * 0.5
  const hx = cx + ex * raioDaEscova
  const hy = cy + ey * raioDaEscova
  const sombraDaEscova = { dist: 1.6 * k, forca: 0.3 }
  const naEscova = (aoLongo: number, deTraves: number): Ponto => [hx + (ex * aoLongo - ey * deTraves) * k, hy + (ey * aoLongo + ex * deTraves) * k]
  const [caboX, caboY] = naEscova(-MEIA_ESCOVA - MEIA_LARGURA_DA_ESCOVA * 0.6, 0)
  const [fimX, fimY] = naEscova(-MEIA_ESCOVA - MEIA_LARGURA_DA_ESCOVA - CABO_DA_ESCOVA, 0)
  L.push(P(capsula(caboX, caboY, fimX, fimY, 1 * k), pinho, { eixo: giroDaEscova, tabua: 0, bisel: 0.8 * k, contorno: 0.26, semente: 6250, projeta: sombraDaEscova }))
  const [cabecaX, cabecaY] = naEscova(-MEIA_ESCOVA, 0)
  const [pontaX, pontaY] = naEscova(MEIA_ESCOVA, 0)
  L.push(P(capsula(cabecaX, cabecaY, pontaX, pontaY, MEIA_LARGURA_DA_ESCOVA * k), pinho, { eixo: giroDaEscova, tabua: 0, bisel: 0.9 * k, tom: 0.9, contorno: 0.28, semente: 6251, projeta: sombraDaEscova }))
  TUFOS_DA_ESCOVA.forEach((aoLongo, i) => {
    for (const fileira of [-1, 1]) {
      const [x, y] = naEscova(aoLongo, fileira * MEIA_FILEIRA)
      L.push(P(elipse(x, y, RAIO_DO_TUFO * k, RAIO_DO_TUFO * k), CERDAS, { bisel: 0.6 * k, contorno: 0.3, semente: 6252 + i * 2 + fileira }))
    }
  })

  // O VAPOR, por cima de tudo: a névoa no meio da água e os três fios em S.
  L.push(P(elipse(cx - raioDaAgua * 0.08, cy - raioDaAgua * 0.02, raioDaAgua * 0.62, raioDaAgua * 0.5), VAPOR, { bisel: 0, contorno: 0, alfa: ALFA_DA_NEVOA, suave: BORRAO_DA_NEVOA * k, semente: 6260 }))
  FIOS_DE_VAPOR.forEach(([fx, fy, angulo, comprimento, largura, fase], i) => {
    const x0 = cx + fx * raioDaAgua
    const y0 = cy + fy * raioDaAgua
    const dx = Math.cos(angulo * GRAUS)
    const dy = Math.sin(angulo * GRAUS)
    const fio: Ponto[] = []
    for (let j = 0; j <= PASSOS_DO_FIO; j += 1) {
      const t = j / PASSOS_DO_FIO
      const ao = t * comprimento * k
      const lado = Math.sin(t * Math.PI * 2 + fase) * largura * k
      fio.push([x0 + dx * ao - dy * lado, y0 + dy * ao + dx * lado])
    }
    L.push(P(cadeia(fio, RAIO_DO_FIO * k), VAPOR, { bisel: 0, contorno: 0, alfa: ALFA_DO_FIO, suave: BORRAO_DO_FIO * k, textura: texDoFioDeVapor(x0, y0, dx, dy, comprimento * k), semente: 6261 + i }))
  })

  // NA 3/4, os dois aros na frente da tina: a metade da frente de cada anel (a de quem olha, com o objeto girado
  // ou não), na altura dele, e o rebite que é a peça dele.
  const [frenteX, frenteY] = frenteNaTela(c.giro)
  const sobra = R + 2 * k
  const frente = caixa(cx + (frenteX > 0 ? 0 : -sobra), cy + (frenteY > 0 ? 0 : -sobra), cx + (frenteX < 0 ? 0 : sobra), cy + (frenteY < 0 ? 0 : sobra))
  const aroNaFrente = (alem: number): Forma => dentroDe(anel(cx, cy, R + alem * k, R + alem * k, R - 1.9 * k, R - 1.9 * k), frente)
  cena.sombras.push(
    { forma: aroNaFrente(0.9), z: altura * ALTURA_DO_ARO_DE_BAIXO, solta: true, forca: 0 },
    { forma: aroNaFrente(0.4), z: altura * ALTURA_DO_ARO_DE_CIMA, solta: true, forca: 0 },
  )
  // O meio de cada rebite fica fora da coluna da tina; o do aro de cima cabe nos dois anéis e sobe com o mais alto.
  const meioDaFrente = Math.atan2(frenteY, frenteX)
  for (const [desvio, alem] of [[10, 0.65], [-10, 0.1]] as const) {
    const raioDoRebite = R + alem * k
    const a = meioDaFrente + desvio * GRAUS
    L.push(P(elipse(cx + Math.cos(a) * raioDoRebite, cy + Math.sin(a) * raioDoRebite, 0.8 * k, 0.8 * k), aro, { bisel: 0.6 * k, contorno: 0.26, semente: 6270 + desvio }))
  }
}
