/**
 * SERRA de cima com volume (lote 10 dos objetos novos, 11/11/2026): o cavalete
 * de serrar lenha parado no meio do serviço. Uma TORA comprida deitada no berço
 * de dois CAVALETES EM X, as duas pontas mostrando o corte (a de trás, velha e
 * acinzentada; a da frente, do corte de ontem, clara) e, perto da ponta da
 * frente, o CORTE PELA METADE: a fresta escura com a beira de madeira nova.
 * Parado nele, o TRAÇADOR, o serrote grande de dois cabos: a lâmina de aço
 * meio tombada (a face pega a luz), mais larga no meio, com os DENTES em
 * triângulo à mostra dos dois lados da tora, onde a lâmina sai do corte, e um
 * cabo roliço com a virola de ferro em cada ponta. No chão, debaixo do corte, o
 * MONTE DE SERRAGEM, e, encostadas no flanco da tora, atrás do cavalete de
 * trás, DUAS TÁBUAS já serradas, com a face na sombra (estão de pé).
 *
 * Do alto, cada cavalete é um X: os dois paus cruzam debaixo do meio da tora e,
 * de cada lado dela, saem a perna de um (que desce, mais escura, até o pé,
 * aberto para fora, longe do outro cavalete) e o chifre do outro (que sobe para
 * dentro, com o topo serrado claro). A SOMBRA repete o X no chão, mais aberta
 * na ponta dos chifres, que estão no alto. A lâmina do traçador, de pé no
 * corte, seria um risco visto do alto: ela vai tombada (o lombo para o lado da
 * ponta da tora), e o que fica dentro da tora some atrás da linha por onde ela
 * sai do corte, que desce do alto da tora para os flancos.
 *
 * O perfil da 3/4 é em pé, como o do carrinho de mão e o do canhão: derivada, a
 * tora viraria um bloco varrido até o chão por cima dos cavaletes.
 *
 * A 25% de zoom sobram a tora escura com as pontas claras, o risco de aço
 * atravessado nela com um cabo em cada ponta e o monte claro de serragem
 * embaixo: é o que diz "serra" e não "troncos". Materiais: `madeira` (os
 * cavaletes, as tábuas e os cabos) e `lenha` (a casca da tora; o corte sai
 * dela, como nos troncos); o aço, o ferro e a serragem são fixos. As medidas
 * valem na pegada de partida (2 x 1 casas): o comprimento sai da largura e o de
 * través, da altura; o que é redondo sai do lado que menos esticou.
 */
import { hash, limitar01, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { barra, cadeia, capsula, dentroDe, elipse, menos, poligono, uniao, caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { G, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

const VOLTA = Math.PI * 2
/** Quanto a sombra de uma peça anda por px de altura (a mesma luz do chão, na régua do `projeta`). */
const SOMBRA_POR_ALTURA = Math.hypot(SOMBRA_X, SOMBRA_Y)

// ---------- as medidas (px do protótipo na pegada de partida; as alturas, em casas) ----------

/** A pegada de partida: 2 x 1 casas, com o meio em (0, 0). A tora corre ao comprido; a ponta que está sendo serrada fica à direita. */
const LARGURA_DE_PARTIDA = 2 * G
const FUNDO_DE_PARTIDA = G

/** A tora: a linha do meio (de través), o raio e as duas pontas (ao comprido, com o bojo do corte). */
const Y_DA_TORA = -5
const RAIO_DA_TORA = 8.8
const PONTA_DE_TRAS = -50
const PONTA_DA_FRENTE = 45
/** Quanto o corte aparece em cada ponta, em raios (o bojo dos troncos), e o corte, um pouco menor que a ponta: sobra a beira de casca. */
const BOJO_DA_PONTA = 0.5
const CORTE_NA_PONTA = 0.84
/** O corte pela metade, ao comprido da tora: a rodela que vai cair tem meia casa. */
const X_DO_CORTE = 25
/** Pontos da linha do corte de um flanco ao outro da tora. */
const LANCES_DO_CORTE = 12

/** Os dois cavaletes em X: onde fica cada um ao comprido e para que lado os pés abrem (para fora, longe do outro cavalete). */
const CAVALETES: readonly { readonly x: number; readonly fora: -1 | 1 }[] = [
  { x: -24, fora: -1 },
  { x: 8, fora: 1 },
]
/**
 * Quanto os pés abrem para fora ao comprido (os chifres, do outro lado do cruzamento, vão para dentro: do alto
 * cada cavalete é um X), até onde vão os pés e os chifres (de través, a partir da linha da tora) e a grossura do pau.
 */
const PES_PARA_FORA = 7.5
const ABERTURA_DOS_PES = 22
const PONTA_DOS_CHIFRES = 16.5
const GROSSURA_DO_PAU = 4.2
/** O topo serrado do chifre: quanto ele ocupa da ponta do pau. */
const TOPO_DO_CHIFRE = 1.4
/** A altura do cruzamento dos paus, o berço onde a tora deita, em casas. */
const ALTURA_DO_BERCO = 0.42

/** O traçador, de través: de onde a onde vai a lâmina, quanto o lombo fica depois da linha do corte, a largura da lâmina no meio (a barriga) e nas pontas, e os dentes. */
const SERROTE_DE = -24
const SERROTE_ATE = 27
const LOMBO_DEPOIS_DO_CORTE = 3.6
const LAMINA_NO_MEIO = 4.6
const LAMINA_NAS_PONTAS = 2.7
const PASSO_DO_DENTE = 2.3
const FUNDO_DO_DENTE = 1.05
/** A lâmina fora da tora fica um pouco acima do meio dela: px acima do meio, para a sombra. */
const LAMINA_ACIMA_DO_MEIO = 2
/** Os cabos: quanto cada um passa do lombo, quanto entra antes da beira dos dentes, o raio e quanto o cabo de baixo tomba para fora. */
const CABO_ALEM_DO_LOMBO = 7.4
const CABO_ANTES_DOS_DENTES = 0.9
const RAIO_DO_CABO = 1.8
const TOMBO_DO_CABO = 0.6
/** A virola de ferro que aperta a lâmina no cabo: de onde a onde vai, a partir do lombo. */
const VIROLA: readonly [number, number] = [0.5, 1.9]
/** O rebite que prende a lâmina, a esta distância da ponta dela. */
const REBITE_DA_PONTA = 3.2

/** A serragem: o monte debaixo do corte, o pó espalhado em volta dele e a ponta do monte que aparece do outro lado da tora. */
interface Mancha {
  readonly x: number
  readonly y: number
  readonly rx: number
  readonly ry: number
}
const MONTE_DE_SERRAGEM: Mancha = { x: 24.5, y: 9.8, rx: 12.5, ry: 7.6 }
const PO_ESPALHADO: Mancha = { x: 26.5, y: 10.8, rx: 17.5, ry: 10.6 }
const MONTE_DO_OUTRO_LADO: Mancha = { x: 24, y: -17.4, rx: 8.6, ry: 3.4 }
/** A altura do monte, em casas (a sombra curta dele), e quanto a beira dele é torta (px do protótipo). */
const ALTURA_DO_MONTE = 0.06
const TORTO_DO_MONTE = 0.9
/** Os torrões de serragem soltos em volta do monte: o meio (px do protótipo) e o raio. */
const TORROES: readonly (readonly [number, number, number])[] = [
  [9.5, 14.5, 1.2],
  [38.6, 5.8, 1],
  [40.5, 15.5, 1.3],
  [13, 4.4, 0.8],
  [31.5, 20.4, 0.9],
  [17.2, -20.6, 0.8],
]
/** Os ciscos de serragem que ficaram no alto da tora, do lado de trás do corte: quantos e até que distância dele. */
const CISCOS_NA_TORA = 9
const CISCOS_ATE = 4.2

/**
 * As duas tábuas encostadas no flanco da tora: o meio do pé (no chão) e o da ponta de cima (no flanco, por cima
 * dele), a largura e o tom. A face está virada para longe da luz: mais escura que a madeira deitada.
 */
interface Tabua {
  readonly pe: Ponto
  readonly topo: Ponto
  readonly largura: number
  readonly tom: number
}
const TABUAS: readonly Tabua[] = [
  { pe: [-48.6, 25.4], topo: [-49.6, -0.2], largura: 8.6, tom: 0.8 },
  { pe: [-39.4, 24.6], topo: [-39.6, -0.8], largura: 8.2, tom: 0.72 },
]
/** O topo serrado de cada tábua: a tira clara da ponta de cima. */
const TOPO_DA_TABUA = 1.3

// ---------- os materiais fixos ----------

/** O aço da lâmina (claro, polido do uso) e o ferro das virolas. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.24)) }
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
/** A serragem: o creme da madeira moída, contido (saturação 0,31). */
const COR_DA_SERRAGEM: Rgb = [0xd6, 0xbf, 0x93]
/** O grão da serragem: a grade (px do protótipo), o raio do grão (ao quadrado, em casas da grade) e o quanto cada grão clareia ou escurece (some pela metade na sombra). */
const GRADE_DO_GRAO = 0.8
const RAIO_DO_GRAO2 = 0.11
const GRAO_CLARO = 0.16
const GRAO_ESCURO = -0.2
/** A madeira de dentro, clara, de um corte novo: o topo do chifre, o da tábua. */
const MADEIRA_DE_DENTRO: Rgb = [0xd2, 0xb8, 0x8a]
const QUANTO_DE_DENTRO = 0.5

/** O cerne do corte de cada madeira, claro e quente, contido: os mesmos dos troncos (`troncos.ts`). */
const CERNE_DO_CARVALHO: Rgb = [0xb0, 0x8a, 0x5e]
const CERNE_DO_PINHO: Rgb = [0xbf, 0x9b, 0x69]
const CERNE_DA_BETULA: Rgb = [0xc6, 0xb2, 0x8b]
/** A casca do pinho (a lenha x 1,1) é a mais clara das duas fendidas: a luz dela separa do carvalho. */
const VERMELHO_DA_CASCA_DO_PINHO = 115
/** Os anéis do corte: quantos por raio e o escuro do anel, em vezes o cerne. */
const ANEIS_POR_RAIO = 3.4
const FATOR_DO_ANEL = 0.76
/** O cinza do tempo no corte velho, em manchas. */
const CINZA_DO_TEMPO: Rgb = [0x9c, 0x94, 0x86]
/** As duas pontas da tora: a de trás é corte velho (pegou cinza), a da frente é o corte de ontem (claro). */
const PONTAS: readonly { readonly tom: number; readonly tempo: number }[] = [
  { tom: 0.92, tempo: 0.42 },
  { tom: 1.06, tempo: 0 },
]
/** O corte pela metade: a fresta, o cerne bem escuro, e a beira, a madeira nova mais clara que o cerne. */
const FATOR_DA_FRESTA = 0.34
const FATOR_DA_MADEIRA_NOVA = 1.12

// ---------- ajudantes ----------

function vezes(c: Rgb, k: number): Rgb {
  return [c[0] * k, c[1] * k, c[2] * k]
}

function misturarEm(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

/** O cerne que combina com a casca escolhida: a bétula pela textura, o pinho pela luz da casca. */
function cerneDa(casca: MaterialDaPeca): Rgb {
  if (casca.casca === 'betula') return CERNE_DA_BETULA
  return casca.rgb[0] >= VERMELHO_DA_CASCA_DO_PINHO ? CERNE_DO_PINHO : CERNE_DO_CARVALHO
}

/** A mesma forma andada (dx, dy): a sombra da tora começa já afastada do pé, pela altura do berço. */
function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** A forma com a beira torta: a distância empurrada pelo ruído, até `amplitude` px para cada lado. */
function torta(f: Forma, amplitude: number, escala: number, semente: number): Forma {
  return {
    b: [f.b[0] - amplitude, f.b[1] - amplitude, f.b[2] + amplitude, f.b[3] + amplitude],
    d: (x, y) => f.d(x, y) + ruido(x * escala + semente, y * escala + semente * 0.37) * 2 * amplitude,
  }
}

/** A sombra no chão de uma vara reta de `a` (na altura `za`) a `b` (na `zb`): cada ponta anda para baixo à direita pela altura dela. */
function sombraDaVara(a: Ponto, za: number, b: Ponto, zb: number, raio: number): Forma {
  return capsula(a[0] + SOMBRA_X * za, a[1] + SOMBRA_Y * za, b[0] + SOMBRA_X * zb, b[1] + SOMBRA_Y * zb, raio)
}

// ---------- texturas ----------

/** O corte da ponta da tora: os anéis em volta do miolo, o alburno claro na beira, o miolo escuro e, no corte velho, o cinza do tempo. */
function texDoCorte(mx: number, my: number, rx: number, ry: number, cerne: Rgb, tempo: number): Textura {
  const anel = vezes(cerne, FATOR_DO_ANEL)
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - mx) / rx
    const dy = (y - my) / ry
    const q = Math.sqrt(dx * dx + dy * dy) + ruido(x * 0.4 + 17, y * 0.4) * 0.07
    const onda = Math.sin(q * ANEIS_POR_RAIO * VOLTA)
    misturarEm(s, anel, onda > 0.35 ? ((onda - 0.35) / 0.65) * 0.72 : 0)
    if (tempo > 0) misturarEm(s, CINZA_DO_TEMPO, limitar01(ruido(x * 0.3 + 5, y * 0.3 + 9) * 2 + 0.5) * tempo)
    s[3] += (q > 0.8 ? 0.05 : 0) - q * 0.05 + ruido(x * 0.9, y * 0.9) * 0.03
    if (q < 0.14) s[3] -= 0.16 * (1 - q / 0.14)
  }
}

/** A serragem: grãos miúdos e redondos, claros e escuros, sorteados numa grade, e manchas largas de luz (o monte não é liso). */
const texDaSerragem: Textura = (_u, _v, x, y, p, s) => {
  const gx = x / GRADE_DO_GRAO
  const gy = y / GRADE_DO_GRAO
  const ix = Math.floor(gx)
  const iy = Math.floor(gy)
  const h = hash(ix, iy, 5190)
  const dx = gx - ix - 0.5
  const dy = gy - iy - 0.5
  if ((h > 0.78 || h < 0.2) && dx * dx + dy * dy < RAIO_DO_GRAO2) s[6] = h > 0.78 ? GRAO_CLARO : GRAO_ESCURO
  s[3] += ruido(x * 0.22 + p.su, y * 0.22 + p.sv) * 0.12
}

/** A face da lâmina: a faixa polida perto do lombo, escurecendo para os dentes, com as manchas largas do uso. */
function texDaLamina(lombo: number, largura: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const q = (lombo - x) / largura
    const polido = (q - 0.3) / 0.2
    s[3] += 0.22 * Math.exp(-polido * polido) - 0.12 * q + ruido(y * 0.22 + p.su, x * 0.9 + p.sv) * 0.08
  }
}

// ---------- a régua, a tora e o corte ----------

/** As medidas do desenho na pegada: `X` ao comprido (da largura), `Y` de través (da altura). */
interface Regua {
  readonly X: (x: number) => number
  readonly Y: (y: number) => number
  /** O que é redondo sai do lado que menos esticou: continua redondo no objeto esticado. */
  readonly k: number
}

/** A tora como os outros pedaços a leem: o contorno, a linha do meio, o raio e a altura de baixo dela. */
interface Tora {
  readonly corpo: Forma
  readonly y: number
  readonly raio: number
  readonly zBerco: number
}

/** O traçador no corte: o lombo, as pontas da lâmina e a linha por onde ela sai da tora em cada y dentro dela. */
interface Corte {
  readonly x: number
  readonly lombo: number
  readonly yDe: number
  readonly yAte: number
  readonly xDentes: number
  saida(y: number): number
}

/** A largura da lâmina (sem os dentes) em `y`: a barriga no meio, mais estreita nas pontas. */
function larguraDaLamina(y: number, corte: Pick<Corte, 'yDe' | 'yAte'>, k: number): number {
  const s = (2 * y - corte.yDe - corte.yAte) / (corte.yAte - corte.yDe)
  return (LAMINA_NAS_PONTAS + (LAMINA_NO_MEIO - LAMINA_NAS_PONTAS) * (1 - s * s)) * k
}

function medirTora({ X, Y, k }: Regua, g: number): Tora {
  const raio = RAIO_DA_TORA * k
  const y = Y(Y_DA_TORA)
  const bojo = raio * BOJO_DA_PONTA
  const x0 = X(PONTA_DE_TRAS) + bojo
  const x1 = X(PONTA_DA_FRENTE) - bojo
  const corpo = uniao(caixa(x0, y - raio, x1, y + raio), uniao(elipse(x0, y, bojo, raio), elipse(x1, y, bojo, raio)))
  return { corpo, y, raio, zBerco: g * ALTURA_DO_BERCO }
}

/**
 * A linha por onde a lâmina sai da tora: no alto (a linha do meio) ela sai no traço do corte; nos flancos, mais
 * baixo, já na beira dos dentes (a tora é redonda e a lâmina vai tombada para a frente).
 */
function medirCorte({ X, Y, k }: Regua, tora: Tora): Corte {
  const x = X(X_DO_CORTE)
  const pontas = { yDe: Y(SERROTE_DE), yAte: Y(SERROTE_ATE) }
  const lombo = x + LOMBO_DEPOIS_DO_CORTE * k
  const xDentes = lombo - larguraDaLamina(tora.y, pontas, k) - FUNDO_DO_DENTE * k - 0.4
  return {
    x,
    lombo,
    ...pontas,
    xDentes,
    saida(y) {
      const q = Math.min(1, Math.abs(y - tora.y) / tora.raio)
      return xDentes + (x - xDentes) * Math.sqrt(1 - q * q)
    },
  }
}

/** A parte da lâmina que está dentro da tora (debaixo da madeira): a oeste da linha de saída. Distância aproximada, boa perto da linha. */
function dentroDaTora(corte: Corte, tora: Tora): Forma {
  return {
    b: [corte.xDentes - 1, tora.y - tora.raio, corte.x + 1, tora.y + tora.raio],
    d: (x, y) => Math.max(x - corte.saida(y), Math.abs(y - tora.y) - tora.raio),
  }
}

/** A lâmina vista do alto, tombada: o lombo reto, a beira dos dentes do lado do corte, em triângulos. As pontas caem num vão, não num dente. */
function formaDaLamina(corte: Corte, k: number): Forma {
  const { lombo, yDe, yAte } = corte
  const n = Math.max(2, 2 * Math.round((yAte - yDe) / (PASSO_DO_DENTE * k)))
  const pontos: Ponto[] = [[lombo, yDe], [lombo, yAte]]
  for (let i = n; i >= 0; i -= 1) {
    const y = yDe + ((yAte - yDe) * i) / n
    const dente = i % 2 === 1 ? FUNDO_DO_DENTE * k : 0
    pontos.push([lombo - larguraDaLamina(y, corte, k) - dente, y])
  }
  return poligono(pontos)
}

// ---------- as partes ----------

function montarSerragem(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua): void {
  const P = c.peca
  const L = cena.partes
  const serragem: MaterialDaPeca = { classe: 'liso', rgb: COR_DA_SERRAGEM }
  const naPegada = (m: Mancha, semente: number): Forma => torta(elipse(X(m.x), Y(m.y), m.rx * k, m.ry * k), TORTO_DO_MONTE * k, 0.32, semente)
  const monte = naPegada(MONTE_DE_SERRAGEM, 11)
  cena.sombras.push(contato(monte, 0.18), { forma: monte, z: c.g * ALTURA_DO_MONTE, forca: 0.16 })
  // O pó ralo em volta (sem beira), os torrões soltos, a ponta do monte do outro lado da tora e o monte, com o alto claro.
  L.push(P(naPegada(PO_ESPALHADO, 23), serragem, { bisel: 0, contorno: 0, alfa: 0.42, suave: 3 * k, textura: texDaSerragem, semente: 5101 }))
  TORROES.forEach(([x, y, r], i) => {
    L.push(P(elipse(X(x), Y(y), r * k, r * k * 0.8), serragem, { bisel: r * k * 0.8, contorno: 0.14, tom: 0.94, textura: texDaSerragem, semente: 5102 + i }))
  })
  L.push(P(naPegada(MONTE_DO_OUTRO_LADO, 37), serragem, { bisel: 2.4 * k, contorno: 0.12, tom: 0.9, textura: texDaSerragem, semente: 5110 }))
  L.push(P(monte, serragem, { bisel: 6 * k, contorno: 0.14, textura: texDaSerragem, semente: 5111 }))
}

/** Os dois cavaletes em X, debaixo da tora: as pernas (mais baixas, mais escuras) e, por cima delas, os chifres com o topo serrado. */
function montarCavaletes(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua, tora: Tora): void {
  const P = c.peca
  const mad = c.m.madeira
  const topo: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, MADEIRA_DE_DENTRO, QUANTO_DE_DENTRO) }
  const abre = Y(ABERTURA_DOS_PES)
  const chifre = Y(PONTA_DOS_CHIFRES)
  // O pau é reto: do pé (no chão) ao berço ele sobe a altura do berço e, até a ponta do chifre, na mesma proporção.
  const zChifre = (tora.zBerco * (ABERTURA_DOS_PES + PONTA_DOS_CHIFRES)) / ABERTURA_DOS_PES
  const larg = GROSSURA_DO_PAU * k
  const pernas: Peca[] = []
  const chifres: Peca[] = []
  CAVALETES.forEach(({ x, fora }, i) => {
    // Os dois paus cruzam debaixo do meio da tora; cada um vai do pé, de um lado, ao chifre, do outro.
    const cruz: Ponto = [X(x), tora.y]
    for (const lado of [-1, 1] as const) {
      const pe: Ponto = [cruz[0] + fora * PES_PARA_FORA * k, tora.y + lado * abre]
      const ponta: Ponto = [cruz[0] - (fora * PES_PARA_FORA * k * chifre) / abre, tora.y - lado * chifre]
      const eixo = Math.atan2(ponta[1] - pe[1], ponta[0] - pe[0])
      const sem = 5120 + i * 10 + (lado + 1) * 2
      cena.sombras.push(
        { forma: sombraDaVara(pe, 0, ponta, zChifre, larg * 0.5), z: 0, suave: 1.8, forca: 0.24 },
        contato(elipse(pe[0], pe[1], larg * 0.75, larg * 0.6), 0.34),
      )
      pernas.push(P(barra(cruz[0], cruz[1], pe[0], pe[1], larg), mad, { eixo, tabua: 0, bisel: 0.9, tom: 0.8, contorno: 0.28, semente: sem }))
      chifres.push(P(barra(cruz[0], cruz[1], ponta[0], ponta[1], larg), mad, { eixo, tabua: 0, bisel: 0.9, tom: 0.98, contorno: 0.28, semente: sem + 1 }))
      // O topo serrado do chifre: o corte do pau, claro, na ponta.
      const comp = Math.hypot(ponta[0] - cruz[0], ponta[1] - cruz[1])
      const f = 1 - (TOPO_DO_CHIFRE * k) / comp
      chifres.push(P(barra(cruz[0] + (ponta[0] - cruz[0]) * f, cruz[1] + (ponta[1] - cruz[1]) * f, ponta[0], ponta[1], larg), topo, { eixo: eixo + QUARTO, tabua: 0, bisel: 0.5, contorno: 0.24, semente: sem + 2 }))
    }
  })
  cena.partes.push(...pernas, ...chifres)
}

/** A tora: a casca, os dois cortes das pontas, o corte pela metade e os ciscos de serragem em cima dela. */
function montarTora(c: ContextoDoMovel, cena: Cena, k: number, tora: Tora, corte: Corte): void {
  const P = c.peca
  const L = cena.partes
  const casca = c.m.lenha
  const cerne = cerneDa(casca)
  const R = tora.raio
  const bojo = R * BOJO_DA_PONTA
  // A sombra no chão: a tora no ar, do berço até o alto dela.
  cena.sombras.push({ forma: deslocada(tora.corpo, SOMBRA_X * tora.zBerco, SOMBRA_Y * tora.zBerco), z: 2 * R, forca: 0.3 })
  // A tora faz sombra no que está debaixo dela (a serragem, as pernas dos cavaletes), da altura do meio dela.
  const sombraNoChao = { dist: (tora.zBerco + R) * SOMBRA_POR_ALTURA, forca: 0.34, suave: 2.4 }
  L.push(P(tora.corpo, casca, { eixo: 0, bisel: R * 0.92, tom: 0.98, contorno: 0.24, semente: 5140, projeta: sombraNoChao }))
  const [x0, , x1] = tora.corpo.b
  for (const [i, xp] of [x0 + bojo, x1 - bojo].entries()) {
    const { tom, tempo } = PONTAS[i]
    const rx = bojo * CORTE_NA_PONTA
    const ry = R * CORTE_NA_PONTA
    // O miolo um pouco fora do meio (a árvore cresceu torta).
    const mx = xp + (i === 0 ? -1 : 1) * rx * 0.08
    const my = tora.y + ry * (0.08 + 0.1 * hash(i, 3, 5141))
    L.push(P(elipse(xp, tora.y, rx, ry), { classe: 'liso', rgb: vezes(cerne, tom) }, { bisel: 0.7, contorno: 0.2, textura: texDoCorte(mx, my, rx, ry, cerne, tempo), semente: 5142 + i }))
  }
  // O corte pela metade: a beira de madeira nova e a fresta escura, pela linha por onde a lâmina sai.
  const pontos: Ponto[] = []
  for (let i = 0; i <= LANCES_DO_CORTE; i += 1) {
    const y = tora.y - R * 0.97 + (2 * R * 0.97 * i) / LANCES_DO_CORTE
    pontos.push([corte.saida(y) - 0.25 * k, y])
  }
  L.push(P(dentroDe(cadeia(pontos, 1.2 * k), tora.corpo), { classe: 'liso', rgb: vezes(cerne, FATOR_DA_MADEIRA_NOVA) }, { bisel: 0, contorno: 0, semente: 5150 }))
  L.push(P(dentroDe(cadeia(pontos, 0.55 * k), tora.corpo), { classe: 'liso', rgb: vezes(cerne, FATOR_DA_FRESTA) }, { bisel: 0, contorno: 0, semente: 5151 }))
  // Os ciscos de serragem que a lâmina puxou para cima, do lado de trás do corte.
  const serragem: MaterialDaPeca = { classe: 'liso', rgb: COR_DA_SERRAGEM }
  for (let i = 0; i < CISCOS_NA_TORA; i += 1) {
    const y = tora.y + (hash(i, 1, 5152) * 1.7 - 0.85) * R
    const x = corte.saida(y) - (0.8 + hash(i, 2, 5152) * CISCOS_ATE) * k
    const r = (0.4 + 0.4 * hash(i, 3, 5152)) * k
    L.push(P(elipse(x, y, r, r * 0.8), serragem, { bisel: r * 0.6, contorno: 0.1, tom: 0.92 + 0.12 * hash(i, 4, 5152), semente: 5153 + i }))
  }
}

/** As duas tábuas encostadas no flanco da tora: a face (a tábua tombada para trás) e o topo serrado, claro. */
function montarTabuas(c: ContextoDoMovel, cena: Cena, { X, Y, k }: Regua, tora: Tora): void {
  const P = c.peca
  const mad = c.m.madeira
  const corteDaTabua: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, MADEIRA_DE_DENTRO, QUANTO_DE_DENTRO) }
  // A ponta de cima encosta no flanco da tora, na altura do meio dela: a sombra dessa ponta cai mais longe.
  const zTopo = tora.zBerco + tora.raio
  const [ax, ay] = [SOMBRA_X * zTopo, SOMBRA_Y * zTopo]
  TABUAS.forEach((t, i) => {
    const pe: Ponto = [X(t.pe[0]), Y(t.pe[1])]
    const topo: Ponto = [X(t.topo[0]), Y(t.topo[1])]
    const comp = Math.hypot(topo[0] - pe[0], topo[1] - pe[1])
    const ux = (topo[0] - pe[0]) / comp
    const uy = (topo[1] - pe[1]) / comp
    const nx = (-uy * t.largura * k) / 2
    const ny = (ux * t.largura * k) / 2
    const forma = poligono([[pe[0] + nx, pe[1] + ny], [topo[0] + nx, topo[1] + ny], [topo[0] - nx, topo[1] - ny], [pe[0] - nx, pe[1] - ny]])
    cena.sombras.push(
      { forma: poligono([[pe[0] + nx, pe[1] + ny], [topo[0] + nx + ax, topo[1] + ny + ay], [topo[0] - nx + ax, topo[1] - ny + ay], [pe[0] - nx, pe[1] - ny]]), z: 0, suave: 1.6, forca: 0.28 },
      contato(barra(pe[0] + nx, pe[1] + ny, pe[0] - nx, pe[1] - ny, 1.4 * k), 0.34),
    )
    const eixo = Math.atan2(uy, ux)
    cena.partes.push(P(forma, mad, { eixo, tabua: 0, bisel: 0.9, tom: t.tom, contorno: 0.26, semente: 5170 + i * 3, projeta: { dist: 1.2, forca: 0.3 } }))
    const fim = TOPO_DA_TABUA * k
    cena.partes.push(P(poligono([[topo[0] + nx, topo[1] + ny], [topo[0] - nx, topo[1] - ny], [topo[0] - nx - ux * fim, topo[1] - ny - uy * fim], [topo[0] + nx - ux * fim, topo[1] + ny - uy * fim]]), corteDaTabua, { eixo: eixo + QUARTO, tabua: 0, bisel: 0.4, contorno: 0.2, semente: 5171 + i * 3 }))
  })
}

/** O traçador: a lâmina (só o que está fora da tora), o fio de luz no lombo e, em cada ponta, o cabo com a virola e o rebite. */
function montarTracador(c: ContextoDoMovel, cena: Cena, k: number, tora: Tora, corte: Corte): void {
  const P = c.peca
  const L = cena.partes
  const lamina = formaDaLamina(corte, k)
  const zLamina = tora.zBerco + tora.raio + LAMINA_ACIMA_DO_MEIO
  cena.sombras.push({ forma: lamina, z: zLamina, solta: true, forca: 0.22 })
  L.push(P(menos(lamina, dentroDaTora(corte, tora)), ACO, { eixo: QUARTO, tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.55, textura: texDaLamina(corte.lombo, LAMINA_NO_MEIO * k), semente: 5180, projeta: { dist: 1.6, forca: 0.32, suave: 0.7 } }))
  // O lombo pega a luz de cima: um fio claro de ponta a ponta.
  L.push(P(caixa(corte.lombo - 0.75 * k, corte.yDe + 0.4, corte.lombo - 0.2 * k, corte.yAte - 0.4), ACO, { tabua: 0, bisel: 0, contorno: 0, tom: 1.2, alfa: 0.7, metal: 0.6, semente: 5181 }))
  const cabo: MaterialDaPeca = c.m.madeira
  for (const [y, lado] of [[corte.yDe, -1], [corte.yAte, 1]] as const) {
    const xa = corte.lombo - (LAMINA_NAS_PONTAS + FUNDO_DO_DENTE + CABO_ANTES_DOS_DENTES) * k
    const xb = corte.lombo + CABO_ALEM_DO_LOMBO * k
    const yb = y + lado * TOMBO_DO_CABO * k
    const r = RAIO_DO_CABO * k
    const forma = capsula(xa, y, xb, yb, r)
    const sem = 5182 + (lado + 1) * 3
    cena.sombras.push({ forma, z: zLamina + r * 2, solta: true, forca: 0.24 })
    // O rebite que prende a lâmina, perto da ponta dela; o cabo por cima, com a virola e o topo claro.
    const yRebite = y - lado * REBITE_DA_PONTA * k
    L.push(P(elipse(corte.lombo - 1.3 * k, yRebite, 0.6 * k, 0.6 * k), PREGO, { bisel: 0.5, contorno: 0.2, metal: 0.4, semente: sem }))
    L.push(P(forma, cabo, { eixo: Math.atan2(yb - y, xb - xa), tabua: 0, bisel: r, tom: 0.84, contorno: 0.3, semente: sem + 1, projeta: { dist: 1.4, forca: 0.3 } }))
    L.push(P(caixa(corte.lombo + VIROLA[0] * k, Math.min(y, yb) - r * 1.06, corte.lombo + VIROLA[1] * k, Math.max(y, yb) + r * 1.06, 0.4), FERRO, { tabua: 0, bisel: 0.6, contorno: 0.26, metal: 0.4, semente: sem + 2 }))
    L.push(P(elipse(xb - 0.5 * k, yb, 0.9 * k, r * 0.86), { classe: 'madeira', rgb: misturar(cabo.rgb, MADEIRA_DE_DENTRO, QUANTO_DE_DENTRO) }, { tabua: 0, bisel: 0.4, contorno: 0.2, semente: sem + 3 }))
  }
}

export const montarSerra: MontarMovel = (c, cena) => {
  const sx = c.w / LARGURA_DE_PARTIDA
  const sy = c.h / FUNDO_DE_PARTIDA
  const regua: Regua = { X: (x) => x * sx, Y: (y) => y * sy, k: Math.min(sx, sy) }
  const tora = medirTora(regua, c.g)
  const corte = medirCorte(regua, tora)
  montarSerragem(c, cena, regua)
  montarCavaletes(c, cena, regua, tora)
  montarTora(c, cena, regua.k, tora, corte)
  montarTabuas(c, cena, regua, tora)
  montarTracador(c, cena, regua.k, tora, corte)
}
