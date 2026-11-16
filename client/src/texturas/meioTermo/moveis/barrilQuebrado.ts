/**
 * BARRIL QUEBRADO (refeito em 16/11/2026, depois do rework do barril de pé de 15/11): o MESMO barril de
 * `barril.ts`, arrebentado. Antes era um barril de outro desenho (a meia-lua de aduelas retas e uma poça de
 * vinho); agora tem as mesmas aduelas, os mesmos aros de ferro, a mesma luz e a mesma tampa com o batoque.
 *
 * O TOCO. O pé do barril ficou de pé: as aduelas quebraram acima do aro do quarto de baixo, cada uma numa altura
 * (as de trás à esquerda, mais altas, ainda espetadas), com o topo lascado em dentes e a madeira de dentro, clara,
 * na quebra. O aro do pé e o do quarto de baixo ficaram no lugar. Dentro, a palha (o recheio, neutro) e a TAMPA
 * caída em dois pedaços, rachada ao longo da junta das tábuas; o batoque fica no pedaço maior.
 *
 * NO CHÃO: os dois aros de cima, que pularam abertos (o da ponta em volta da frente do toco, o do quarto atrás);
 * os pedaços de cima das aduelas, caídos em volta, com a marca escura dos aros (a cara de fora) ou o sulco do
 * fundo (a de dentro); a palha que vazou pela frente, por cima das aduelas mais baixas, e umas lascas.
 *
 * O TAMANHO é o do barril de pé (`TAMANHO_DO_BARRIL`): o quebrado ocupa uma casa, e os cacos se espalham em volta.
 *
 * DE CIMA o toco aparece como o barril sem a tampa: a borda quebrada das aduelas em volta, a parede de dentro e o
 * fundo de palha com a tampa caída; a borda faz sombra dentro, do lado da luz. NA 3/4 aparece o toco inteiro, com
 * a conta do corpo do barril de pé (o bojo, as aduelas que estreitam para os lados, os aros em arco, a luz do
 * cilindro), a borda dentada por cima e, por cima da borda baixa da frente, o que há dentro.
 *
 * A SAÍDA é a do barril de pé (e da pipa deitada): o toco como ele aparece na 3/4 é desenhado à parte, já no lugar
 * da tela (o QUADRO), e guardado em FATIAS debaixo da vista de cima, cada fatia pendurada num PINO com a altura
 * dela. A guarda é o toco visto de cima, com a roda da barriga, como o bojo de cima do barril; na 3/4 ele sobe a
 * altura do toco (a das aduelas mais baixas) e fica inteiro por trás do quadro. Por isso nenhuma aduela quebra
 * abaixo dessa altura. Os meios das caixas dos cacos ficam longe dos pinos (`meiosDosCacos`).
 *
 * GIRO: o toco é montado na tela e devolvido ao objeto (`desgirarCena`), com a altura de cada aduela lida pela
 * volta do objeto: a parte alta vai para onde o giro a leva, com a luz no lugar. Os cacos do chão são montados no
 * objeto e giram com ele; a luz pintada neles (o bojo de través das aduelas) é a do motor, levada ao objeto.
 *
 * A 3/4 deste tipo é `derivado` com `espessura: 0` (`tresQuartos.ts`), como a do barril de pé: com a beirada
 * padrão dos tampos soltos, cada pino ganharia um fio de madeira para baixo. Os aros e a palha do chão não fazem
 * estrutura (ficam no chão e debaixo do toco na 3/4); as aduelas caídas têm a grossura delas.
 *
 * Materiais: `madeira` e `aros`, os do barril. A palha, a madeira de dentro (o cerne) e a ferrugem são fixas.
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { cadeia, capsula, dentroDe, elipse, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { bordaDaSombra, contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import { deslocada, desgirarCena, LUZ_DE_PE, noPino, pendurar, pintarBojo, pregar, quartosDoGiro, type PecaDoQuadro, type Pino, type Pipa } from './pipaDeitada'

// ---------- o barril de pé (as medidas de `barril.ts`: o toco é o mesmo barril) ----------

const ALTURA = 0.62
const PONTA = 0.84
const ADUELAS = 9
const ARO_DA_PONTA = 2.4
const ARO_DO_QUARTO = 2.1
const LUGAR_DO_ARO_DO_QUARTO = 0.22
const TOM_DO_CORPO = 0.8
const ARO_DO_TAMPO = 1
const TOPO_DAS_ADUELAS = 1.6
const TABUA_DO_FUNDO = 0.55
const RAIO_DO_BATOQUE = 1.7
const BATOQUE_X = 0.42
const BATOQUE_Y = 0.3
const TOM_DO_FUNDO = 0.9
const TOM_DO_BATOQUE = 0.66

// ---------- o barril quebrado ----------

/**
 * O toco tem o tamanho do barril de pé: o barril ocupa 0,7 casa (`TAMANHO_EM_CASAS` de `mobilia.ts`) e o quebrado,
 * uma casa inteira, onde os cacos se espalham em volta. A altura é a do barril (a da grade, como lá); os aros, as
 * aduelas e a tampa têm as medidas dele, em px.
 */
const TAMANHO_DO_BARRIL = 0.7
/** O meio do toco, em frações da meia pegada: um pouco para trás à esquerda; os cacos caem para a frente e para a direita. */
const MEIO_DO_TOCO: Ponto = [-0.1, -0.1]
/** Até onde todas as aduelas ficaram (fração da altura do barril): acima do aro do quarto de baixo, que ficou no lugar. */
const ALTURA_DO_TOCO = 0.34
/** A grossura da aduela (px do protótipo): a borda quebrada vista de cima. */
const GROSSURA_DA_ADUELA = 2.3
/** As aduelas na volta inteira. */
const VOLTA = 2 * ADUELAS
/**
 * Quanto cada aduela sobrou acima do toco (fração da altura do barril), pela volta do objeto a partir do oeste (a
 * 0 é a do oeste, a 4 a da frente, a 9 a do leste e a 13 a de trás): baixas na frente, para ver dentro; as de trás
 * à esquerda ficaram espetadas.
 */
const SOBRA_DAS_ADUELAS: readonly number[] = [0.08, 0.03, 0.06, 0.01, 0.04, 0, 0.05, 0.02, 0.09, 0.06, 0.17, 0.1, 0.24, 0.15, 0.3, 0.38, 0.2, 0.11]
/** A quebra é torta: quanto o topo sobe de uma beira da aduela à outra (fração da altura, com o lado). */
const TORTO_DAS_ADUELAS: readonly number[] = [0.05, -0.04, 0.06, 0.03, -0.05, 0.04, -0.06, 0.05, -0.07, 0.06, -0.1, 0.08, -0.12, 0.1, -0.14, 0.08, -0.12, 0.07]
/** Os dentes da quebra (as fibras que ficaram), por aduela, e a altura deles (fração da altura do barril). */
const DENTES_NA_QUEBRA = 4
const DENTE = 0.035
/**
 * A palha dentro do toco: a beira fica abaixo da borda mais baixa (px do protótipo), o meio um
 * pouco abaulado, e os tufos sobem e descem a ruga.
 */
const PALHA_ABAIXO_DA_BORDA = 3
const BOJO_DA_PALHA = 1.2
const RUGA_DA_PALHA = 1.3
/** A palha de dentro fica na sombra do barril: mais escura que a do chão. */
const TOM_DA_PALHA_DE_DENTRO = 0.84
/** A tampa caída fica deitada na palha, um nada acima do alto dela (px do protótipo). */
const TAMPA_ACIMA_DA_PALHA = 1.4

/** A madeira de dentro, na quebra: o cerne claro dos destroços (`destrocos.ts`). */
const CERNE: Rgb = [0xcf, 0xae, 0x7c]
const QUANTO_DE_CERNE = 0.55
/** A palha do recheio: a do feno (`feno.ts`), amarelo contido, com o fio seco e o verde. */
const TOM_DA_PALHA: Rgb = [0xc4, 0xa7, 0x69]
const FIO_SECO: Rgb = [0xd2, 0xbb, 0x84]
const FIO_VERDE: Rgb = [0xa8, 0x9a, 0x5c]
const PALHA: MaterialDaPeca = { classe: 'palha', rgb: TOM_DA_PALHA }
/** A marca que o aro deixa na aduela: ferrugem escura. */
const FERRUGEM: Rgb = [0x5a, 0x48, 0x3a]

/** A luz do motor no chão e na tela (`motor.ts`): de cima à esquerda, 38° acima do chão. */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
const CHAO_X = -0.79
const CHAO_Y = -0.61
/** Quanto a sombra anda no chão por px de altura (a tangente da altura da luz). */
const SOMBRA_POR_ALTURA = Math.hypot(LUZ_X, LUZ_Y) / LUZ_Z

// ---------- a forma do barril (as contas de `barril.ts`) ----------

/** O barril NA TELA: os meios-eixos da barriga, a altura e a queda do bojo. */
interface Geometria {
  readonly A: number
  readonly B: number
  readonly H: number
  readonly k: number
}

function limitar(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

/** O raio na altura `t`, em fração do da barriga: o perfil do barril de pé. */
function fator(g: Geometria, t: number): number {
  const u = limitar((2 * t) / g.H - 1, -1, 1)
  return Math.sqrt(1 - g.k * u * u)
}

/** Quanto o fator muda por px de altura. */
function decliveDoFator(g: Geometria, t: number): number {
  const u = limitar((2 * t) / g.H - 1, -1, 1)
  return ((-g.k * u) / fator(g, t)) * (2 / g.H)
}

function distanciaAElipse(px: number, py: number, rx: number, ry: number): number {
  const k0 = Math.sqrt((px * px) / (rx * rx) + (py * py) / (ry * ry))
  const k1 = Math.sqrt((px * px) / (rx * rx * rx * rx) + (py * py) / (ry * ry * ry * ry))
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry)
}

const RAZAO_AUREA = (Math.sqrt(5) - 1) / 2
const PASSOS_DA_BUSCA = 16

/** As voltas do barril de `t0` a `t1` px de altura, cada uma posta em (dx t, dy t): a silhueta da 3/4 e a sombra. */
function voltasArrastadas(g: Geometria, dx: number, dy: number, t0: number, t1: number): Forma {
  const b: Caixa = [Math.min(dx * t0, dx * t1) - g.A, Math.min(dy * t0, dy * t1) - g.B, Math.max(dx * t0, dx * t1) + g.A, Math.max(dy * t0, dy * t1) + g.B]
  const naAltura = (x: number, y: number, t: number): number => {
    const f = fator(g, t)
    return distanciaAElipse(x - dx * t, y - dy * t, g.A * f, g.B * f)
  }
  return {
    b,
    d(x, y) {
      let a = t0
      let c = t1
      let m1 = c - RAZAO_AUREA * (c - a)
      let m2 = a + RAZAO_AUREA * (c - a)
      let d1 = naAltura(x, y, m1)
      let d2 = naAltura(x, y, m2)
      for (let i = 0; i < PASSOS_DA_BUSCA; i += 1) {
        if (d1 <= d2) {
          c = m2
          m2 = m1
          d2 = d1
          m1 = c - RAZAO_AUREA * (c - a)
          d1 = naAltura(x, y, m1)
        } else {
          a = m1
          m1 = m2
          d1 = d2
          m2 = a + RAZAO_AUREA * (c - a)
          d2 = naAltura(x, y, m2)
        }
      }
      return Math.min(d1, d2, naAltura(x, y, t0), naAltura(x, y, t1))
    },
  }
}

// ---------- o toco ----------

/** Um pedaço da tampa caída, no referencial do objeto (relativo ao meio do toco) e a conta dele na tela. */
interface PedacoDaTampa {
  /** Onde ficou o meio da tampa inteira para este pedaço, a direção das tábuas e a altura no meio. */
  readonly x: number
  readonly y: number
  readonly co: number
  readonly si: number
  readonly h: number
  readonly gx: number
  readonly gy: number
  /** O pedaço guarda o lado `lado` da racha, que corre na junta a `corte` px do meio, através das tábuas. */
  readonly corte: number
  readonly lado: number
  /** A altura na tela: h = c0 + a X + b Y, com (X, Y) o chão da tela a partir do meio do toco. */
  readonly c0: number
  readonly a: number
  readonly b: number
  /** A luz da inclinação, já pronta. */
  readonly luz: number
  readonly batoque: boolean
  readonly semente: number
}

/** O toco montado: as medidas na tela e o que há dentro. */
interface Toco extends Geometria {
  /** O meio do toco na tela. */
  readonly cx: number
  readonly cy: number
  readonly R: number
  /** A grossura da aduela, a altura do toco e o fator dela. */
  readonly w: number
  readonly T0: number
  readonly fT0: number
  /** Os quartos de volta do giro: a volta da tela mais `q` x 4,5 aduelas é a do objeto. */
  readonly q: number
  readonly palha: number
  readonly bojoDaPalha: number
  readonly raioDaTampa: number
  readonly tabua: number
  readonly tampas: readonly PedacoDaTampa[]
  readonly pipa: Pipa
  readonly pipaDeDentro: Pipa
  readonly larguraDaAduela: number
  readonly quebra: Rgb
  readonly palhaRgb: Rgb
  readonly tampaRgb: Rgb
  readonly batoqueRgb: Rgb
}

/** A volta da tela (em aduelas, 0 no oeste) de um ponto da frente e de trás com seno `s` do ângulo. */
function voltaDaFrente(s: number): number {
  return (Math.asin(s) / Math.PI + 0.5) * ADUELAS
}

function voltaDeTras(s: number): number {
  return (1.5 - Math.asin(s) / Math.PI) * ADUELAS
}

/** A volta da tela levada ao objeto, entre 0 e a volta inteira. */
function voltaNoObjeto(t: Toco, volta: number): number {
  const v = volta + (t.q * ADUELAS) / 2
  return v - Math.floor(v / VOLTA) * VOLTA
}

/** A altura do topo quebrado na volta `volta` do objeto: a sobra da aduela, a quebra torta e os dentes. */
function alturaNaVolta(t: Toco, volta: number): number {
  const v = volta - Math.floor(volta / VOLTA) * VOLTA
  const j = Math.min(VOLTA - 1, Math.floor(v))
  const fase = v - j
  const quebra = Math.max(0, SOBRA_DAS_ADUELAS[j] + TORTO_DAS_ADUELAS[j] * (fase - 0.5))
  const d = fase * DENTES_NA_QUEBRA
  const k = Math.floor(d)
  const dente = hash(j, k, 5101) * (1 - Math.abs(2 * (d - k) - 1))
  return t.T0 + t.H * (quebra + DENTE * dente)
}

/** O ponto do chão da tela (a partir do meio do toco) no referencial do objeto. */
function noObjeto(t: Toco, X: number, Y: number): [number, number] {
  return t.q === 1 ? [Y, -X] : t.q === 2 ? [-X, -Y] : t.q === 3 ? [-Y, X] : [X, Y]
}

/** A altura da palha no ponto do objeto: abaulada no meio, com os tufos (os meios-eixos do objeto trocam no giro de lado). */
function alturaDaPalha(t: Toco, xo: number, yo: number): number {
  const deLado = t.q % 2 === 1
  const rn = Math.hypot(xo / (deLado ? t.B : t.A), yo / (deLado ? t.A : t.B))
  return t.palha + t.bojoDaPalha * (1 - rn * rn) + ruido(xo * 0.4 + 3.1, yo * 0.4 + 1.7) * RUGA_DA_PALHA
}

/** O pedaço de tampa mais alto que cobre o ponto do objeto, ou -1. */
function tampaEm(t: Toco, xo: number, yo: number): number {
  let qual = -1
  let alto = -Infinity
  for (let i = 0; i < t.tampas.length; i += 1) {
    const pedaco = t.tampas[i]
    if (!naTampa(t, pedaco, xo, yo)) continue
    const h = pedaco.h + pedaco.gx * (xo - pedaco.x) + pedaco.gy * (yo - pedaco.y)
    if (h > alto) {
      alto = h
      qual = i
    }
  }
  return qual
}

/** O ponto do chão da tela, na altura `h`, fica dentro da parede? */
function dentroDaParede(t: Toco, X: number, Y: number, h: number): boolean {
  const f = fator(t, h)
  const rx = t.A * f - t.w
  const ry = t.B * f - t.w
  return (X * X) / (rx * rx) + (Y * Y) / (ry * ry) < 1
}

function naTampa(t: Toco, p: PedacoDaTampa, xo: number, yo: number): boolean {
  const dx = xo - p.x
  const dy = yo - p.y
  const v = -dx * p.si + dy * p.co
  return dx * dx + dy * dy <= t.raioDaTampa * t.raioDaTampa && p.lado * (v - p.corte) >= 0
}

/**
 * A sombra da borda dentro do toco: o ponto do chão da tela (X, Y), na altura `h`, fica na sombra se a parede do
 * lado da luz é alta o bastante. A distância até ela, contra a luz, sai da elipse de dentro na altura do toco.
 */
function sombraDaBorda(t: Toco, X: number, Y: number, h: number): number {
  const ax = t.A * t.fT0 - t.w
  const ay = t.B * t.fT0 - t.w
  const qa = (CHAO_X * CHAO_X) / (ax * ax) + (CHAO_Y * CHAO_Y) / (ay * ay)
  const qb = 2 * ((X * CHAO_X) / (ax * ax) + (Y * CHAO_Y) / (ay * ay))
  const qc = (X * X) / (ax * ax) + (Y * Y) / (ay * ay) - 1
  const delta = qb * qb - 4 * qa * qc
  if (delta <= 0) return 0
  const ate = (-qb + Math.sqrt(delta)) / (2 * qa)
  const wx = X + CHAO_X * ate
  const wy = Y + CHAO_Y * ate
  const parede = alturaNaVolta(t, voltaNoObjeto(t, (Math.atan2(wx / t.A, wy / t.B) / Math.PI + 0.5) * ADUELAS))
  return limitar(((parede - h) * SOMBRA_POR_ALTURA - ate) / 1.2 + 0.5, 0, 1)
}

// ---------- a palha (os fios de `feno.ts`) ----------

const LARGURA_DO_FIO = 1.8
const VAO_DA_PALHA = 0.42
const CRUZA = 0.55
const COS_CRUZA = Math.cos(CRUZA)
const SEN_CRUZA = Math.sin(CRUZA)
const SORTEIO = new Float32Array(2)

function camadaDeFios(a: number, b: number, semente: number, k: number): number {
  const j = Math.floor(b / LARGURA_DO_FIO)
  const fb = b / LARGURA_DO_FIO - j
  const comprimento = 3 + hash(j, semente, 941) * 4
  const ua = a / comprimento + hash(j, semente, 942)
  const i = Math.floor(ua)
  const fa = ua - i
  const h = hash(j, i, semente)
  SORTEIO[k] = h
  if (h < VAO_DA_PALHA) return -0.07
  const corpo = Math.sin(fb * Math.PI) * Math.sqrt(Math.sin(fa * Math.PI))
  return -0.05 + ((h - VAO_DA_PALHA) / (1 - VAO_DA_PALHA)) * 0.26 * corpo
}

/** Os fios da palha no ponto do objeto: duas camadas de pedaços curtos, cruzadas, puxando para o fio seco ou o verde. */
function pintarFios(x: number, y: number, s: Float32Array, escala: number, semente: number): void {
  const tx = x + ruido(y * 0.2 + semente, x * 0.2) * 2.4
  const ty = y + ruido(x * 0.2, y * 0.2 + semente) * 2.4
  const l0 = camadaDeFios(tx * COS_CRUZA + ty * SEN_CRUZA, ty * COS_CRUZA - tx * SEN_CRUZA, semente, 0)
  const l1 = camadaDeFios(tx * COS_CRUZA - ty * SEN_CRUZA + 31, ty * COS_CRUZA + tx * SEN_CRUZA + 17, semente + 3, 1)
  const luz = l0 > l1 ? l0 : l1
  const h = l0 > l1 ? SORTEIO[0] : SORTEIO[1]
  const contraste = escala < 1.5 ? 0.45 : 1
  s[3] += luz * contraste
  const cor = h > 0.9 ? FIO_SECO : h > VAO_DA_PALHA && h < 0.5 ? FIO_VERDE : null
  if (cor === null) return
  const m = 0.4 * contraste
  s[0] += (cor[0] - s[0]) * m
  s[1] += (cor[1] - s[1]) * m
  s[2] += (cor[2] - s[2]) * m
}

// ---------- a pintura do toco (as mesmas contas nas duas vistas) ----------

/** A beira escura onde a cara de fora encontra a quebra (px do protótipo). */
const BEIRA_DA_QUEBRA = 0.55
/** A parede por dentro é mais escura que a de fora: a luz entra pouco no barril. */
const ESCURO_DE_DENTRO = 0.78
/** O lado da tábua da tampa caída, na 3/4: virado para o olho e no escuro. */
const LUZ_DO_LADO_DA_TAMPA = -0.3

function pintarCor(s: Float32Array, c: Rgb): void {
  s[0] = c[0]
  s[1] = c[1]
  s[2] = c[2]
}

/** A borda quebrada: o cerne claro com as fibras, a fresta entre as aduelas e a beira de dentro caindo no escuro. */
function pintarBorda(t: Toco, volta: number, altura: number, fundo: number, p: Peca, s: Float32Array): void {
  pintarCor(s, t.quebra)
  const j = Math.floor(volta)
  let luz = (hash(j, p.semente, 5201) - 0.5) * 0.12 + ((altura - t.T0) / t.H) * 0.22
  luz += ruido(volta * 9.1 + j * 3, altura * 1.3 + fundo * 2) * 0.22
  const naAduela = volta - j
  const ateAFresta = Math.min(naAduela, 1 - naAduela) * t.larguraDaAduela
  if (ateAFresta < 0.6) luz -= 0.32 * (1 - ateAFresta / 0.6)
  if (fundo > 0.68) luz -= 0.3 * ((fundo - 0.68) / 0.32)
  else if (fundo < 0.22) luz += 0.06
  s[3] += luz
}

function pintarPalhaDeDentro(t: Toco, X: number, Y: number, h: number, p: Peca, s: Float32Array, escala: number): void {
  pintarCor(s, t.palhaRgb)
  const [xo, yo] = noObjeto(t, X, Y)
  pintarFios(xo, yo, s, escala, p.semente + 17)
  s[3] -= 0.3 * sombraDaBorda(t, X, Y, h)
  const f = fator(t, h)
  const rn = Math.hypot(X / (t.A * f - t.w), Y / (t.B * f - t.w))
  if (rn > 0.8) s[3] -= 0.2 * Math.min(1, (rn - 0.8) / 0.2)
}

/** O pedaço da tampa: as tábuas do fundo do barril (a junta, o veio), a racha clara, o batoque e a inclinação. */
function pintarTampa(t: Toco, pedaco: PedacoDaTampa, X: number, Y: number, h: number, p: Peca, s: Float32Array): void {
  pintarCor(s, t.tampaRgb)
  const [xo, yo] = noObjeto(t, X, Y)
  const dx = xo - pedaco.x
  const dy = yo - pedaco.y
  const u = dx * pedaco.co + dy * pedaco.si
  const v = -dx * pedaco.si + dy * pedaco.co
  const fv = (v - pedaco.corte) / t.tabua
  const jt = Math.floor(fv)
  const naTabua = (fv - jt) * t.tabua
  const ateAJunta = Math.min(naTabua, t.tabua - naTabua)
  let luz = (hash(jt, p.semente, 5301) - 0.5) * 0.12 + pedaco.luz
  luz += Math.sin((v + ruido(u * 0.04 + jt * 7, jt * 3.1) * 7) * 3.3) * 0.026 + ruido(u * 0.03 + jt * 13, v * 0.3) * 0.1
  if (ateAJunta < 0.65) luz -= 0.28 * (1 - ateAJunta / 0.65)
  // A racha corre na junta: o lado quebrado mostra a madeira de dentro, clara, em lascas.
  const aoCorte = pedaco.lado * (v - pedaco.corte) - (hash(Math.floor(u * 1.4), pedaco.semente, 5302) - 0.5) * 0.7
  if (aoCorte < 0.9) {
    const k = 1 - Math.max(0, aoCorte) / 0.9
    s[0] += (t.quebra[0] - s[0]) * k * 0.75
    s[1] += (t.quebra[1] - s[1]) * k * 0.75
    s[2] += (t.quebra[2] - s[2]) * k * 0.75
    luz += 0.04 * k
  }
  if (pedaco.batoque) {
    const fundo = t.raioDaTampa
    const db = Math.hypot(u - fundo * BATOQUE_X, v - fundo * BATOQUE_Y)
    const rb = RAIO_DO_BATOQUE
    if (db < rb) {
      pintarCor(s, t.batoqueRgb)
      luz += db > rb - 0.5 ? -0.22 : (0.5 - db / rb) * 0.16
    }
  }
  luz -= 0.3 * sombraDaBorda(t, X, Y, h)
  s[3] += luz
}

// ---------- a 3/4 do toco (o quadro) ----------

const VOLTAS_DA_CONTA = 4
const VOLTAS_DA_BORDA = 3
const VOLTAS_DA_PALHA = 3

/**
 * A borda quebrada da frente (`daFrente`) ou de trás no pixel (X, Y) da tela: acha a altura da aduela pela volta,
 * e vê se o pixel cai na faixa entre a beira de fora e a de dentro do topo. Devolve se pintou. Atrás, logo acima da
 * beira de fora, a faixa some aos poucos (a beira de cima do toco sem serrilhado).
 */
function pintouABorda(t: Toco, X: number, Y: number, daFrente: boolean, p: Peca, s: Float32Array, escala: number): boolean {
  let altura = t.T0
  let volta = 0
  for (let i = 0; i < VOLTAS_DA_BORDA; i += 1) {
    const seno = X / (t.A * fator(t, altura))
    if (seno <= -1 || seno >= 1) return false
    volta = voltaNoObjeto(t, daFrente ? voltaDaFrente(seno) : voltaDeTras(seno))
    altura = alturaNaVolta(t, volta)
  }
  const f = fator(t, altura)
  const seno = X / (t.A * f)
  if (seno <= -1 || seno >= 1) return false
  const co = Math.sqrt(1 - seno * seno)
  const lado = daFrente ? 1 : -1
  const fora = lado * t.B * f * co - altura
  const rx = t.A * f - t.w
  const dentro = Math.abs(X) < rx ? lado * (t.B * f - t.w) * Math.sqrt(1 - (X * X) / (rx * rx)) - altura : -lado * t.B * f * co - altura
  const de = Math.min(fora, dentro)
  const ate = Math.max(fora, dentro)
  let alfa = 1
  if (Y < de || Y > ate) {
    if (daFrente || Y > ate || de - Y > 1 / escala) return false
    alfa = 1 - (de - Y) * escala
  }
  pintarBorda(t, volta, altura, limitar(Math.abs(Y - fora) / Math.max(0.3, ate - de), 0, 1), p, s)
  s[5] = alfa
  return true
}

/** A cara de fora de uma aduela da frente: a conta do corpo do barril de pé, com os aros que ficaram. */
function pintarFora(t: Toco, seno: number, altura: number, volta: number, margem: number, p: Peca, s: Float32Array): void {
  const a = limitar(altura, 0, t.H)
  const cosseno = Math.sqrt(1 - seno * seno)
  const raio = Math.hypot(t.A * seno, t.B * cosseno)
  pintarBojo(t.pipa, volta, a, seno, raio * decliveDoFator(t, a), cosseno, LUZ_DE_PE, p, s)
  if (margem < BEIRA_DA_QUEBRA) s[3] -= 0.22 * (1 - margem / BEIRA_DA_QUEBRA)
}

/**
 * O que se vê por cima da borda: a palha, os pedaços da tampa e a parede de trás por dentro. Vale o mais perto do
 * olho (o de maior altura no raio que desce da tela para trás). A tampa está deitada na palha: a palha debaixo dela
 * não aparece, e onde o raio passa por baixo da beira da tampa sem acertar o tampo, ele bate no lado da tábua.
 * Devolve se pintou.
 */
function pintouODentro(t: Toco, X: number, Y: number, p: Peca, s: Float32Array, escala: number): boolean {
  let melhor = -Infinity
  let qual = -1
  let naPalha = false
  let debaixoDaTampa = -1
  let hp = t.palha
  for (let i = 0; i < VOLTAS_DA_PALHA; i += 1) {
    const [xo, yo] = noObjeto(t, X, Y + hp)
    hp = alturaDaPalha(t, xo, yo)
  }
  if (dentroDaParede(t, X, Y + hp, hp)) {
    const [xo, yo] = noObjeto(t, X, Y + hp)
    debaixoDaTampa = tampaEm(t, xo, yo)
    if (debaixoDaTampa < 0) {
      melhor = hp
      naPalha = true
    }
  }
  for (let i = 0; i < t.tampas.length; i += 1) {
    const pedaco = t.tampas[i]
    const h = (pedaco.c0 + pedaco.a * X + pedaco.b * Y) / (1 - pedaco.b)
    if (h <= melhor) continue
    const [xo, yo] = noObjeto(t, X, Y + h)
    if (naTampa(t, pedaco, xo, yo) && dentroDaParede(t, X, Y + h, h)) {
      melhor = h
      qual = i
    }
  }
  // A parede de trás por dentro: o ponto dela na altura tb cai no pixel.
  let tb = t.T0
  let si = 0
  let ci = 0
  let naParede = true
  for (let i = 0; i < VOLTAS_DA_CONTA; i += 1) {
    const fb = fator(t, limitar(tb, 0, t.H))
    const rx = t.A * fb - t.w
    si = X / rx
    if (si <= -1 || si >= 1) {
      naParede = false
      break
    }
    ci = Math.sqrt(1 - si * si)
    tb = -(t.B * fb - t.w) * ci - Y
  }
  if (naParede && tb > melhor && tb >= 0) {
    const volta = voltaNoObjeto(t, voltaDeTras(si))
    if (tb <= alturaNaVolta(t, volta)) {
      const fb = fator(t, tb)
      const raio = Math.hypot((t.A * fb - t.w) * si, (t.B * fb - t.w) * ci)
      pintarBojo(t.pipaDeDentro, volta, tb, -si, -raio * decliveDoFator(t, tb), ci, LUZ_DE_PE, p, s)
      s[0] *= ESCURO_DE_DENTRO
      s[1] *= ESCURO_DE_DENTRO
      s[2] *= ESCURO_DE_DENTRO
      s[3] -= 0.06 + 0.18 * (1 - limitar((tb - t.palha) / 5, 0, 1))
      return true
    }
  }
  if (qual >= 0) {
    pintarTampa(t, t.tampas[qual], X, Y + melhor, melhor, p, s)
    return true
  }
  if (naPalha) {
    pintarPalhaDeDentro(t, X, Y + melhor, melhor, p, s, escala)
    return true
  }
  if (debaixoDaTampa >= 0) {
    // O lado da tábua da tampa, de frente para o olho: no escuro.
    pintarCor(s, t.tampaRgb)
    s[3] += LUZ_DO_LADO_DA_TAMPA + (hash(Math.floor(X * 0.7), debaixoDaTampa, 5303) - 0.5) * 0.08
    return true
  }
  return false
}

/**
 * O toco na 3/4, com o pé no chão no meio do toco: o pixel (X, Y) da tela mostra a cara de fora de uma aduela da
 * frente (a mais perto do olho), a borda quebrada da frente, o que há dentro ou a borda de trás, nessa ordem.
 */
function texDoTocoNaTresQuartos(t: Toco): Textura {
  return (_u, _v, x, y, p, s, escala) => {
    const X = x - t.cx
    const Y = y - t.cy
    let f = 1
    let seno = 0
    let altura = 0
    for (let i = 0; i < VOLTAS_DA_CONTA; i += 1) {
      seno = limitar(X / (t.A * f), -1, 1)
      altura = t.B * f * Math.sqrt(1 - seno * seno) - Y
      f = fator(t, limitar(altura, 0, t.H))
    }
    seno = limitar(X / (t.A * f), -1, 1)
    const naRoda = Math.abs(X) <= t.A * f
    const volta = voltaNoObjeto(t, voltaDaFrente(seno))
    const teto = alturaNaVolta(t, volta)
    if (naRoda && altura <= teto) {
      pintarFora(t, seno, altura, volta, teto - altura, p, s)
      return
    }
    if (pintouABorda(t, X, Y, true, p, s, escala)) return
    if (pintouODentro(t, X, Y, p, s, escala)) return
    if (pintouABorda(t, X, Y, false, p, s, escala)) return
    // No lado, logo acima de uma aduela da frente sem nada atrás: a beira some aos poucos.
    if (naRoda && altura - teto < 1 / escala) {
      pintarFora(t, seno, altura, volta, 0, p, s)
      s[5] = 1 - (altura - teto) * escala
      return
    }
    s[5] = 0
  }
}

// ---------- a vista de cima do toco ----------

/** A altura da parede por dentro no raio `rn` (fração da barriga), abaixo da barriga; -Infinity no fundo. */
function alturaDaParede(t: Toco, rn: number): number {
  const f = rn + t.w / t.R
  if (f <= PONTA) return -Infinity
  const u = -Math.sqrt(Math.max(0, (1 - f * f) / t.k))
  return (t.H * (u + 1)) / 2
}

/**
 * O toco de cima: a borda quebrada em volta e, dentro, o mais alto entre a parede e o fundo (a tampa caída, deitada
 * na palha, ou a palha). A roda vai até a barriga, como o bojo de cima do barril (é a guarda das fatias): além da
 * borda sobra um fio da cara de fora das aduelas, no contorno.
 */
function texDoTocoDeCima(t: Toco): Textura {
  return (_u, _v, x, y, p, s, escala) => {
    const X = x - t.cx
    const Y = y - t.cy
    const rn = Math.hypot(X / t.A, Y / t.B)
    const volta = voltaNoObjeto(t, (Math.atan2(X / t.A, Y / t.B) / Math.PI + 0.5) * ADUELAS)
    const altura = alturaNaVolta(t, volta)
    const fora = fator(t, Math.min(altura, t.H / 2))
    if (rn > fora) {
      pintarCor(s, t.tampaRgb)
      const r = Math.max(1e-6, Math.hypot(X, Y))
      s[3] += ((X * LUZ_X + Y * LUZ_Y) / r) * 0.3 - 0.12
      return
    }
    const bordaDeDentro = fora - t.w / t.R
    if (rn >= bordaDeDentro) {
      pintarBorda(t, volta, altura, limitar((fora - rn) / Math.max(0.01, fora - bordaDeDentro), 0, 1), p, s)
      return
    }
    const [xo, yo] = noObjeto(t, X, Y)
    const qual = tampaEm(t, xo, yo)
    const pedaco = qual >= 0 ? t.tampas[qual] : null
    const melhor = pedaco !== null ? pedaco.h + pedaco.gx * (xo - pedaco.x) + pedaco.gy * (yo - pedaco.y) : alturaDaPalha(t, xo, yo)
    const hParede = alturaDaParede(t, rn)
    if (hParede > melhor) {
      // A parede por dentro vista de cima: a que olha para a luz (a de baixo à direita) clareia.
      const j = Math.floor(volta)
      pintarCor(s, t.tampaRgb)
      s[0] *= ESCURO_DE_DENTRO
      s[1] *= ESCURO_DE_DENTRO
      s[2] *= ESCURO_DE_DENTRO
      const r = Math.max(1e-6, Math.hypot(X, Y))
      let luz = ((-X * LUZ_X - Y * LUZ_Y) / r) * 0.3 - 0.1 + (hash(j, p.semente, 811) - 0.5) * 0.1
      const naAduela = volta - j
      if (Math.min(naAduela, 1 - naAduela) * t.larguraDaAduela < 0.5) luz -= 0.25
      s[3] += luz
      return
    }
    if (pedaco !== null) {
      pintarTampa(t, pedaco, X, Y, melhor, p, s)
      return
    }
    pintarPalhaDeDentro(t, X, Y, melhor, p, s, escala)
  }
}

// ---------- as fatias guardadas e os pinos (como no barril de pé) ----------

const PASSO_DAS_LINHAS = 0.25
const PASSO_DA_ALTURA = 0.5
const MARGEM_DA_GUARDA = 0.8
const TOLERANCIA_DA_GUARDA = 0.03
const DESCIDA_MINIMA = 0.02

interface Fatia {
  readonly faixa: readonly [number, number]
  readonly z: number
  readonly guardada: number
}

/** A meia largura do quadro na linha `Y` (a partir do meio do toco): a da volta mais larga que passa por ela. */
function meiaLargura(g: Geometria, Y: number, ate: number): number {
  let w = 0
  for (let t = 0; ; t = Math.min(ate, t + PASSO_DA_ALTURA)) {
    const f = fator(g, t)
    const q = (Y + t) / (g.B * f)
    if (q * q < 1) w = Math.max(w, g.A * f * Math.sqrt(1 - q * q))
    if (t >= ate) return w
  }
}

/**
 * As fatias do quadro, de cima para baixo, guardadas debaixo da elipse de meios-eixos `ga` e `gb` (o toco de
 * cima): cada linha só fica onde a corda da guarda ainda a cobre, com a margem.
 */
function fatiar(g: Geometria, ate: number, yTopo: number, yBase: number, ga: number, gb: number): Fatia[] {
  const folga = (Y: number): number => {
    const precisa = Math.min(meiaLargura(g, Y, ate) + MARGEM_DA_GUARDA, ga - TOLERANCIA_DA_GUARDA) / ga
    return precisa >= 1 ? 0 : gb * Math.sqrt(1 - precisa * precisa)
  }
  const fatias: Fatia[] = []
  const linhas = Math.ceil((yBase - yTopo) / PASSO_DAS_LINHAS)
  let primeira = 0
  let lo = -Infinity
  let hi = Infinity
  const fechar = (ultima: number, fim: boolean): void => {
    const de = yTopo + primeira * PASSO_DAS_LINHAS
    const ate1 = yTopo + ultima * PASSO_DAS_LINHAS
    const meio = (de + ate1) / 2
    const z = lo <= hi ? Math.min(hi, Math.max(lo, -meio)) : Math.max(DESCIDA_MINIMA, -meio)
    fatias.push({ faixa: [primeira === 0 ? -Infinity : de - PASSO_DAS_LINHAS / 2, fim ? Infinity : ate1 + PASSO_DAS_LINHAS / 2], z, guardada: meio + z })
  }
  for (let i = 0; i <= linhas; i += 1) {
    const Y = yTopo + i * PASSO_DAS_LINHAS
    const s = folga(Y)
    const lo1 = Math.max(lo, -Y - s, DESCIDA_MINIMA)
    const hi1 = Math.min(hi, -Y + s)
    if (lo1 <= hi1 || i === primeira) {
      lo = lo1
      hi = hi1
      continue
    }
    fechar(i - 1, false)
    primeira = i
    lo = Math.max(-Y - s, DESCIDA_MINIMA)
    hi = -Y + s
  }
  fechar(linhas, true)
  return fatias
}

const ESPACO_DOS_PINOS = 0.4
const COLUNAS_DOS_PINOS = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 2.5, -2.5]
const DISTANCIA_DA_FILA = 3
/** O pino do toco de cima, um nada abaixo do meio. */
const PINO_DE_CIMA = 0.6

/**
 * O pino de uma fatia (a partir do meio do toco). Na fila da 3/4 as fatias entram na linha do meio do toco: depois
 * dos cacos de trás (que o toco cobre) e antes dos da frente (que ficam por cima dele).
 */
function pinoDaFatia(fatia: Fatia, k: number, yTopo: number, yBase: number, usados: Pino[]): Pino {
  let y = fatia.guardada
  let x = 0
  for (let tentativa = 0; ; tentativa += 1) {
    const livre = COLUNAS_DOS_PINOS.find((cx) => usados.every((u) => Math.hypot(u.x - cx, u.y - y) >= ESPACO_DOS_PINOS))
    if (livre !== undefined) {
      x = livre
      break
    }
    y += ESPACO_DOS_PINOS * (tentativa % 2 === 0 ? 1 : -1) * (tentativa + 1)
  }
  let ordem = Math.min(yBase + fatia.z - 0.5, Math.max(yTopo + fatia.z + 0.5, 0.01 * k))
  if (Math.abs(ordem - y) < DISTANCIA_DA_FILA) ordem = y + DISTANCIA_DA_FILA
  const pino: Pino = { x, y, z: fatia.z, ordem }
  usados.push(pino)
  return pino
}

/** O pino `p` (a partir do meio do toco) posto no meio do toco na tela. */
function noMeio(p: Pino, cx: number, cy: number): Pino {
  return { x: p.x + cx, y: p.y + cy, z: p.z, ordem: p.ordem + cy }
}

// ---------- a sombra do toco ----------

const LANCES_DA_SOMBRA = 3
const FORCA_DO_CONTATO = 0.34

function sombrasDoToco(t: Toco, tela: Cena): void {
  const altura = t.T0 + 0.1 * t.H
  const forca = Math.max(0.16, 0.34 - 0.0022 * altura)
  for (let i = 0; i < LANCES_DA_SOMBRA; i += 1) {
    const t0 = (altura * i) / LANCES_DA_SOMBRA
    const t1 = (altura * (i + 1)) / LANCES_DA_SOMBRA
    tela.sombras.push({ forma: deslocada(voltasArrastadas(t, SOMBRA_X, SOMBRA_Y, t0, t1), t.cx, t.cy), z: 0, suave: bordaDaSombra({ z: (t0 + t1) / 2 }), forca })
  }
  tela.sombras.push(contato(elipse(t.cx, t.cy, t.A * PONTA, t.B * PONTA), FORCA_DO_CONTATO))
}

// ---------- a tampa caída ----------

/** Os dois pedaços da tampa no objeto (frações do raio da tampa, a partir do meio do toco), racha e inclinação. */
const PEDACOS_DA_TAMPA: readonly { readonly x: number; readonly y: number; readonly ang: number; readonly acima: number; readonly gx: number; readonly gy: number; readonly lado: number; readonly batoque: boolean }[] = [
  // O maior, com o batoque, apoiado na parede de trás à esquerda (sobe para lá).
  { x: -0.07, y: -0.06, ang: 0.35, acima: 0.5, gx: -0.08, gy: -0.06, lado: 1, batoque: true },
  // O menor, a tábua de baixo, afastado da racha e caído para a frente: entre os dois aparece a palha.
  { x: 0.16, y: 0.2, ang: 0.7, acima: 0.12, gx: 0.06, gy: 0.1, lado: -1, batoque: false },
]
/** A racha corre na junta a esta fração do raio, através das tábuas: o pedaço maior fica com dois terços. */
const CORTE_DA_TAMPA = -0.32

function pedacosDaTampa(q: number, raio: number, palha: number, acima: number): PedacoDaTampa[] {
  // A matriz do chão da tela para o objeto (`noObjeto`): xo = m00 X + m01 Y, yo = m10 X + m11 Y.
  const [m00, m01, m10, m11] = q === 1 ? [0, 1, -1, 0] : q === 2 ? [-1, 0, 0, -1] : q === 3 ? [0, -1, 1, 0] : [1, 0, 0, 1]
  return PEDACOS_DA_TAMPA.map((d, i) => {
    const x = d.x * raio
    const y = d.y * raio
    const h = palha + acima * d.acima
    const a = d.gx * m00 + d.gy * m10
    const b = d.gx * m01 + d.gy * m11
    const n = Math.hypot(a, b, 1)
    const luz = 0.9 * ((-a * LUZ_X - b * LUZ_Y + LUZ_Z) / n - LUZ_Z)
    return { x, y, co: Math.cos(d.ang), si: Math.sin(d.ang), h, gx: d.gx, gy: d.gy, corte: CORTE_DA_TAMPA * raio, lado: d.lado, c0: h - d.gx * x - d.gy * y, a, b, luz, batoque: d.batoque, semente: 5400 + i }
  })
}

// ---------- os cacos no chão (no referencial do objeto) ----------

/** Uma aduela caída: o pedaço de cima de uma aduela, do pé quebrado até a ponta de cima. */
interface AduelaCaida {
  /** O meio, em frações da meia pegada; a direção do pé quebrado para a ponta. */
  readonly x: number
  readonly y: number
  readonly ang: number
  /** O comprimento, em fração da altura do barril; a largura, em fração da largura da aduela (as rachadas ao comprido são finas). */
  readonly comp: number
  readonly larg: number
  readonly flecha: number
  /** Caiu de costas: a cara de dentro, côncava, com o sulco do fundo, para cima. */
  readonly avesso: boolean
  readonly tom: number
}

const ADUELAS_CAIDAS: readonly AduelaCaida[] = [
  { x: 0.6, y: 0.64, ang: -0.62, comp: 0.62, larg: 1, flecha: 0.05, avesso: false, tom: 1 },
  { x: -0.6, y: 0.84, ang: 0.18, comp: 0.5, larg: 1, flecha: -0.06, avesso: true, tom: 0.94 },
  { x: 0.9, y: 0, ang: 1.75, comp: 0.46, larg: 0.55, flecha: 0.04, avesso: false, tom: 1.04 },
  { x: 0.66, y: -0.74, ang: 0.87, comp: 0.4, larg: 1, flecha: -0.05, avesso: false, tom: 0.96 },
  { x: 0.08, y: 0.95, ang: -0.1, comp: 0.36, larg: 0.5, flecha: 0.03, avesso: true, tom: 0.92 },
  { x: -1.0, y: 0.18, ang: 1.45, comp: 0.38, larg: 0.6, flecha: -0.04, avesso: false, tom: 0.98 },
]
/** Os dentes do pé quebrado e o fundo deles (em meias larguras). */
const DENTES_DO_PE = 3
const FUNDO_DOS_DENTES = 2
/** A grossura da aduela caída na 3/4 (px do protótipo). */
const GROSSURA_NO_CHAO = 1.8
/** A luz de través da aduela caída: a cara de fora é bojuda, a de dentro côncava. */
const FORCA_DO_BOJO = 0.34
const BEIRA_DO_BOJO = 0.16
/** A largura da marca do aro na aduela (px do protótipo) e o sulco do fundo, perto da ponta, na cara de dentro. */
const MARCA_DO_ARO = 1.1
const SULCO_DO_FUNDO = 2.6

/** Um aro que pulou aberto: o meio da volta (frações da meia pegada), o raio no começo e no fim (fração de R), de um ângulo a outro e um amassado. */
interface AroCaido {
  readonly x: number
  readonly y: number
  readonly r0: number
  readonly r1: number
  readonly de: number
  readonly ate: number
  readonly amassado: number
  readonly largura: number
}

const AROS_CAIDOS: readonly AroCaido[] = [
  // O aro da ponta, aberto em espiral em volta da frente do toco, do sudoeste ao leste.
  { x: -0.06, y: -0.06, r0: 0.9, r1: 1.04, de: -0.62, ate: 2.05, amassado: 0.9, largura: ARO_DA_PONTA },
  // O aro do quarto de cima, um pedaço da volta atrás do toco.
  { x: -0.1, y: -0.1, r0: 0.95, r1: 0.92, de: 2.35, ate: 3.55, amassado: 2.9, largura: ARO_DO_QUARTO },
]

/** As lascas soltas: o meio (frações da meia pegada), o comprimento (px do protótipo) e o ângulo. */
const LASCAS: readonly (readonly [number, number, number, number])[] = [
  [0.32, -0.95, 4, 0.3],
  [0.98, 0.5, 3.6, 1.2],
  [-0.5, 1.0, 3.2, -0.4],
  [0.44, 0.98, 3, 2],
  [-0.92, 0.66, 3.4, 0.9],
  [0.98, -0.42, 3, -0.8],
  [-0.86, -0.72, 2.8, 2.4],
]

/**
 * A palha que vazou pela frente, por cima das aduelas mais baixas: os lóbulos (frações da meia pegada), metade
 * debaixo do toco, e os tufos espalhados (o raio em px do protótipo).
 */
const LOBULOS_DA_PALHA: readonly (readonly [number, number, number, number])[] = [
  [0.06, 0.78, 0.46, 0.24],
  [0.56, 0.58, 0.3, 0.28],
  [-0.46, 0.7, 0.26, 0.2],
  [0.24, 0.96, 0.24, 0.1],
]
const TUFOS: readonly (readonly [number, number, number])[] = [
  [0.78, 0.86, 2.4],
  [-0.66, 0.92, 2],
  [0.95, 0.3, 2.2],
  [-0.94, -0.3, 1.8],
  [0.42, -0.96, 1.6],
]
/** A beira da palha no chão é rala (px do protótipo): o chão aparece entre os fiapos. */
const FRANJA = 1.5

/** Pontos locais (x ao longo, y através) girados `ang` e postos em (cx, cy). */
function girados(pontos: readonly Ponto[], cx: number, cy: number, ang: number): Ponto[] {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return pontos.map(([x, y]) => [cx + x * co - y * si, cy + x * si + y * co])
}

/** O contorno da aduela caída (x do pé quebrado à ponta, y através): estreita para a ponta, com o pé em dentes. */
function contornoDaAduela(comp: number, meia: number, flecha: number, sem: number): Ponto[] {
  const n = 10
  const umLado: Ponto[] = []
  const outro: Ponto[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    const m = meia * (1 - (1 - PONTA) * t) * (i === n ? 0.9 : 1)
    const meio = flecha * 4 * t * (1 - t)
    umLado.push([t * comp, meio - m])
    outro.push([t * comp, meio + m])
  }
  outro.reverse()
  const dentes: Ponto[] = []
  for (let k = 1; k < DENTES_DO_PE * 2; k += 1) {
    const entra = k % 2 === 1 ? 0.4 + 0.6 * hash(k, sem, 31) : 0.12 * hash(k, sem, 32)
    dentes.push([meia * FUNDO_DOS_DENTES * entra, meia - (2 * meia * k) / (DENTES_DO_PE * 2)])
  }
  return [...umLado, ...outro, ...dentes]
}

/**
 * A aduela caída: o veio ao comprido, a luz de través (a cara de fora bojuda clareia do lado da luz; a de dentro,
 * côncava, do outro), as marcas dos aros (cara de fora) ou o sulco do fundo (cara de dentro) perto da ponta.
 */
function texDaAduela(pe: Ponto, ang: number, comp: number, meia: number, flecha: number, avesso: boolean, luz: Ponto, marcas: readonly number[]): Textura {
  const madeira = texturaDaClasse('madeira')
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const paraALuz = (avesso ? -1 : 1) * FORCA_DO_BOJO * (-si * luz[0] + co * luz[1])
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const lx = (x - pe[0]) * co + (y - pe[1]) * si
    const ly = -(x - pe[0]) * si + (y - pe[1]) * co
    const t = limitar(lx / comp, 0, 1)
    const m = meia * (1 - (1 - PONTA) * t)
    const q = limitar((ly - flecha * 4 * t * (1 - t)) / m, -1, 1)
    s[3] += paraALuz * q - BEIRA_DO_BOJO * q * q * q * q
    for (const marca of marcas) {
      const d = Math.abs(lx - marca)
      if (avesso) {
        if (d < 0.45) s[3] -= 0.32 * (1 - d / 0.45)
        continue
      }
      if (d >= MARCA_DO_ARO) continue
      const k = 1 - d / MARCA_DO_ARO
      s[0] += (FERRUGEM[0] - s[0]) * 0.4 * k
      s[1] += (FERRUGEM[1] - s[1]) * 0.4 * k
      s[2] += (FERRUGEM[2] - s[2]) * 0.4 * k
      s[3] -= 0.1 * k
    }
  }
}

/** O raio da barriga do barril de pé na pegada do quebrado. */
function raioDoBarril(c: ContextoDoMovel): number {
  return Math.min(c.hw, c.hh) * TAMANHO_DO_BARRIL
}

function montarAduelaCaida(c: ContextoDoMovel, cena: Cena, a: AduelaCaida, luz: Ponto, k: number): void {
  const P = c.peca
  const R = raioDoBarril(c)
  const H = c.g * ALTURA
  const comp = a.comp * H
  const meia = ((Math.PI * R) / ADUELAS / 2) * a.larg
  const flecha = a.flecha * R
  const cx = a.x * c.hw
  const cy = a.y * c.hh
  const pe: Ponto = [cx - (Math.cos(a.ang) * comp) / 2, cy - (Math.sin(a.ang) * comp) / 2]
  const forma = poligono(girados(contornoDaAduela(comp, meia, flecha, 60 + k), pe[0], pe[1], a.ang))
  cena.sombras.push({ forma, z: GROSSURA_NO_CHAO, forca: 0.24 }, contato(forma, 0.24))
  // As marcas dos aros, medidas da ponta de cima: o da ponta rente a ela e o do quarto de cima.
  const marcas = a.avesso ? [comp - SULCO_DO_FUNDO] : [comp - ARO_DA_PONTA / 2, comp - LUGAR_DO_ARO_DO_QUARTO * H].filter((m) => m > 1.5)
  const mad = c.m.madeira
  const face: MaterialDaPeca = a.avesso ? { ...mad, rgb: [mad.rgb[0] * 0.86, mad.rgb[1] * 0.86, mad.rgb[2] * 0.86] } : mad
  cena.partes.push(P(forma, face, { eixo: a.ang, tabua: 0, bisel: 1.1, tom: a.tom, contorno: 0.26, textura: texDaAduela(pe, a.ang, comp, meia, flecha, a.avesso, luz, marcas), semente: 4100 + k * 3, projeta: { dist: 0.7, forca: 0.26 } }))
  // O pé quebrado mostra a madeira de dentro, clara, nos dentes.
  const quebra: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, QUANTO_DE_CERNE) }
  const fundo = meia * FUNDO_DOS_DENTES * 1.1
  const faixa = girados([[-1, 0], [fundo, 0]], pe[0], pe[1], a.ang)
  cena.partes.push(P(dentroDe(forma, capsula(faixa[0][0], faixa[0][1], faixa[1][0], faixa[1][1], meia + 1)), quebra, { eixo: a.ang, tabua: 0, bisel: 0.5, contorno: 0.16, semente: 4101 + k * 3 }))
}

/** O aro caído: a cinta de ferro em espiral, com um amassado (o raio entra perto do ângulo `amassado`). */
function montarAroCaido(c: ContextoDoMovel, cena: Cena, aro: AroCaido, k: number): void {
  const R = raioDoBarril(c)
  const cx = aro.x * c.hw
  const cy = aro.y * c.hh
  const pontos: Ponto[] = []
  const n = 40
  for (let i = 0; i <= n; i += 1) {
    const f = i / n
    const a = aro.de + (aro.ate - aro.de) * f
    let d = a - aro.amassado
    d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI
    const r = R * (aro.r0 + (aro.r1 - aro.r0) * f) * (1 - 0.07 * Math.exp(-(d * d) / 0.05))
    pontos.push([cx + Math.sin(a) * r, cy + Math.cos(a) * r])
  }
  const cinta = cadeia(pontos, aro.largura / 2)
  cena.sombras.push(contato(cinta, 0.26))
  cena.partes.push(c.peca(cinta, c.m.aros, { bisel: 0.7, contorno: 0.3, metal: 0.32, semente: 4020 + k }))
}

/** A palha do chão: os fios do feno e, na franja da beira, o chão aparecendo entre os fiapos. */
function texDaPalhaNoChao(forma: Forma, semente: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    pintarFios(x, y, s, escala, semente)
    s[3] += ruido(x * 0.09 + 7, y * 0.09) * 0.1
    const d = forma.d(x, y)
    if (d > -FRANJA) {
      const fora = (d + FRANJA) / FRANJA
      const fiapo = hash(Math.floor((x + y) / LARGURA_DO_FIO), Math.floor((x - y) / 2.2), semente + 7)
      if (fiapo < fora * 0.95) s[5] = 0
    }
  }
}

function montarCacos(c: ContextoDoMovel, cena: Cena, quartos: number): void {
  const { hw, hh, peca: P } = c
  const L = cena.partes
  // A palha que vazou (por baixo de tudo): os lóbulos que saem pela frente do toco.
  const palha = LOBULOS_DA_PALHA.map(([fx, fy, rx, ry]): Forma => elipse(fx * hw, fy * hh, rx * hw, ry * hh)).reduce(uniao)
  cena.sombras.push(contato(palha, 0.12))
  L.push(P(palha, PALHA, { bisel: 0.6, tom: 0.88, contorno: 0, textura: texDaPalhaNoChao(palha, 4000), semente: 4000 }))
  TUFOS.forEach(([fx, fy, raio], i) => {
    const tufo = elipse(fx * hw, fy * hh, raio * 1.3, raio)
    L.push(P(tufo, PALHA, { bisel: 0.5, tom: 0.84, contorno: 0, textura: texDaPalhaNoChao(tufo, 4005 + i), semente: 4005 + i }))
  })
  // As lascas.
  const quebra: MaterialDaPeca = { classe: 'madeira', rgb: misturar(c.m.madeira.rgb, CERNE, QUANTO_DE_CERNE) }
  LASCAS.forEach(([fx, fy, comp, ang], k) => {
    const meio = comp / 2
    const lasca = capsula(fx * hw - Math.cos(ang) * meio, fy * hh - Math.sin(ang) * meio, fx * hw + Math.cos(ang) * meio, fy * hh + Math.sin(ang) * meio, 0.7)
    cena.sombras.push(contato(lasca, 0.2))
    L.push(P(lasca, quebra, { eixo: ang, tabua: 0, bisel: 0.5, contorno: 0.24, semente: 4030 + k }))
  })
  // Os aros caídos, por baixo das aduelas (a 3/4 pinta o que fica no chão antes do resto).
  AROS_CAIDOS.forEach((aro, k) => montarAroCaido(c, cena, aro, k))
  // A luz do motor no referencial do objeto: o quarto de volta da 3/4 é pintado na cena depois.
  const luz: Ponto = quartos === 1 ? [LUZ_Y, -LUZ_X] : quartos === 2 ? [-LUZ_X, -LUZ_Y] : quartos === 3 ? [-LUZ_Y, LUZ_X] : [LUZ_X, LUZ_Y]
  ADUELAS_CAIDAS.forEach((a, k) => montarAduelaCaida(c, cena, a, luz, k))
}

/**
 * Os meios das caixas dos cacos, na tela a partir do meio do toco: a 3/4 sobe cada peça com a estrutura mais alta
 * que tem o meio da caixa dela, e o ponto de um pino é uma estrutura. Guardados como pinos já usados, nenhum pino
 * de fatia cai neles (a palha, com o meio perto do toco, subiria com a fatia).
 */
function meiosDosCacos(chao: Cena, quartos: number, cx: number, cy: number): Pino[] {
  return chao.partes.map((p) => {
    const [x, y] = naTela((p.forma.b[0] + p.forma.b[2]) / 2 + p.dx, (p.forma.b[1] + p.forma.b[3]) / 2 + p.dy, quartos)
    return { x: x - cx, y: y - cy, z: 0, ordem: 0 }
  })
}

// ---------- o barril quebrado ----------

/** O ponto do objeto girado `q` quartos de volta para a tela (o `girarCena` da 3/4). */
function naTela(x: number, y: number, q: number): [number, number] {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** Leva a cena montada na tela para o objeto. */
function levar(tela: Cena, quartos: number, cena: Cena): void {
  if (quartos === 0) {
    cena.partes.push(...tela.partes)
    cena.sombras.push(...tela.sombras)
    return
  }
  desgirarCena(tela, quartos, cena)
}

function noTom(m: MaterialDaPeca, tom: number): MaterialDaPeca {
  return { ...m, rgb: [m.rgb[0] * tom, m.rgb[1] * tom, m.rgb[2] * tom] }
}

export const montarBarrilQuebrado: MontarMovel = (c, cena) => {
  const quartos = quartosDoGiro(c.giro)
  const deLado = quartos % 2 === 1
  const [cx, cy] = naTela(MEIO_DO_TOCO[0] * c.hw, MEIO_DO_TOCO[1] * c.hh, quartos)
  const A = (deLado ? c.hh : c.hw) * TAMANHO_DO_BARRIL
  const B = (deLado ? c.hw : c.hh) * TAMANHO_DO_BARRIL
  const H = c.g * ALTURA
  const R = raioDoBarril(c)
  const k = 1 - PONTA * PONTA
  const T0 = H * ALTURA_DO_TOCO
  const g: Geometria = { A, B, H, k }
  const w = GROSSURA_DA_ADUELA
  const palha = T0 - PALHA_ABAIXO_DA_BORDA
  const raioDaTampa = R * PONTA - (ARO_DO_TAMPO + TOPO_DAS_ADUELAS)
  const mad = c.m.madeira
  // Os dois aros de baixo do barril, que ficaram no toco.
  const aros = [
    { em: ARO_DA_PONTA / 2 / H, largura: ARO_DA_PONTA },
    { em: LUGAR_DO_ARO_DO_QUARTO, largura: ARO_DO_QUARTO },
  ]
  const pipa: Pipa = { comprimento: H, raio: R, raioDaPonta: R * PONTA, eixo: 0, aduelas: ADUELAS, aros, madeira: mad, ferro: noTom(c.m.aros, TOM_DO_CORPO), semente: 0 }
  const toco: Toco = {
    ...g,
    cx,
    cy,
    R,
    w,
    T0,
    fT0: fator(g, T0),
    q: quartos,
    palha,
    bojoDaPalha: BOJO_DA_PALHA,
    raioDaTampa,
    tabua: raioDaTampa * TABUA_DO_FUNDO,
    tampas: pedacosDaTampa(quartos, raioDaTampa, palha + BOJO_DA_PALHA + RUGA_DA_PALHA / 2, TAMPA_ACIMA_DA_PALHA),
    pipa,
    pipaDeDentro: { ...pipa, aros: [] },
    larguraDaAduela: (Math.PI * R) / ADUELAS,
    quebra: misturar(mad.rgb, CERNE, QUANTO_DE_CERNE),
    palhaRgb: [TOM_DA_PALHA[0] * TOM_DA_PALHA_DE_DENTRO, TOM_DA_PALHA[1] * TOM_DA_PALHA_DE_DENTRO, TOM_DA_PALHA[2] * TOM_DA_PALHA_DE_DENTRO],
    tampaRgb: [mad.rgb[0] * TOM_DO_FUNDO, mad.rgb[1] * TOM_DO_FUNDO, mad.rgb[2] * TOM_DO_FUNDO],
    batoqueRgb: [mad.rgb[0] * TOM_DO_BATOQUE, mad.rgb[1] * TOM_DO_BATOQUE, mad.rgb[2] * TOM_DO_BATOQUE],
  }

  // Os cacos no chão, no objeto: a palha, as lascas, os aros e as aduelas caídas. Entram na cena depois das fatias
  // e antes do toco de cima, que os cobre onde passa por cima deles.
  const chao: Cena = { partes: [], sombras: [] }
  montarCacos(c, chao, quartos)

  // O que é montado na tela: a sombra, o toco da 3/4 em fatias e os pinos delas.
  const tela: Cena = { partes: [], sombras: [] }
  sombrasDoToco(toco, tela)
  let ate = 0
  for (let v = 0; v < VOLTA; v += 0.05) ate = Math.max(ate, alturaNaVolta(toco, v))
  const local = voltasArrastadas(g, 0, -1, 0, ate)
  const quadro: PecaDoQuadro = {
    forma: deslocada(local, cx, cy),
    mat: mad,
    o: { bisel: 0.9, contorno: 0.26, tom: TOM_DO_CORPO, textura: texDoTocoNaTresQuartos(toco), semente: 9 },
  }
  const yTopo = local.b[1]
  const yBase = local.b[3]
  const pinoDeCima: Pino = { x: 0, y: PINO_DE_CIMA, z: T0, ordem: -2 * B }
  const usados: Pino[] = [pinoDeCima, ...meiosDosCacos(chao, quartos, cx, cy)]
  fatiar(g, ate, yTopo, yBase, A, B).forEach((fatia, i) => {
    const pino = noMeio(pinoDaFatia(fatia, i, yTopo, yBase, usados), cx, cy)
    pregar(tela, pino)
    pendurar(c.peca, tela.partes, quadro, pino, [fatia.faixa[0] + cy, fatia.faixa[1] + cy])
  })
  levar(tela, quartos, cena)
  cena.partes.push(...chao.partes)
  cena.sombras.push(...chao.sombras)

  // Por cima de tudo, o toco visto de cima; na 3/4 ele sobe a altura do toco e fica atrás do quadro.
  const deCima: Cena = { partes: [], sombras: [] }
  const pino = noMeio(pinoDeCima, cx, cy)
  pregar(deCima, pino)
  deCima.partes.push(c.peca(noPino(elipse(cx, cy, A, B), pino), mad, { bisel: 0.5, contorno: 0.3, textura: texDoTocoDeCima(toco), semente: 11 }))
  levar(deCima, quartos, cena)
}
