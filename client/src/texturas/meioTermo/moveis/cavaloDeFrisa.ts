/**
 * CAVALO DE FRISA de cima com volume (14/11/2026, o cerco e a defesa): a
 * barreira de estacas pontudas que fecha a brecha e o caminho da cavalaria. A
 * VIGA de madeira lavrada corre ao comprido, deitada no ar, com uma cinta de
 * ferro perto de cada ponta; as ESTACAS de casca passam por ela de través,
 * cada uma com uma ponta no chão e a outra no ar, de lado trocado de estaca
 * para estaca (o X visto de lado). A ponta de cada estaca é afiada a facão: o
 * cone de madeira clara e crua, com uma faceta na luz e a outra na sombra. A
 * ponta que sobe sai de um furo no alto da viga e faz a sombra comprida; a que
 * desce passa por baixo dela e crava no chão. Umas lascas da afiação no chão.
 *
 * A 25% de zoom sobra a barra escura da viga atravessada pelo pente de
 * estacas, com as pontas claras dos dois lados: é o que diz "cavalo de frisa"
 * e não "cerca" (a cerca não tem ponta nem sai dos dois lados) nem "escada".
 * O desenho corre pelo lado MAIOR da pegada (2 x 1 casas de partida) e se
 * reparte por ele, como a cerca reparte os mourões: esticado ganha estacas,
 * nunca estacas mais largas. Material: `madeira` (a viga); a casca das
 * estacas, a madeira crua das pontas e o ferro das cintas são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { barra, caixa, capsula, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca, type OpcoesDaPeca } from './motor'
import { materialDaPeca, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** A casca das estacas (as varas de pinho com a casca) e a madeira crua da ponta afiada, clara e quente. */
const CASCA: MaterialDaPeca = materialDaPeca('lenhaPinho')
const CRUA: MaterialDaPeca = { classe: 'madeira', rgb: [0xc8, 0xa8, 0x7c] }
/** O fundo do furo na viga, por onde a estaca passa. */
const FURO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x2c, 0x22] }
const CINTA: MaterialDaPeca = materialDaPeca('ferro')
/** O escuro quente da casca, em que o pixel escuro demais é levantado (com a nogueira, o pé das estacas saía vermelho). */
const ESCURO_DA_CASCA: Rgb = [0x4a, 0x3a, 0x2e]

/** O passo entre as estacas, em casas: é o que reparte a viga. */
const PASSO = 0.27
/** A meia largura da viga e o raio da estaca, em fração da fundura da pegada; o comprimento da ponta afiada, também. */
const MEIA_VIGA = 0.085
const RAIO_DA_ESTACA = 0.048
const PONTA = 0.2
/**
 * A metade que desce é mais fina e mais escura que a que sobe (mais longe do olho, na sombra da viga): é o
 * que mostra, visto do alto, qual ponta está no ar.
 */
const GROSSURA_DA_QUE_DESCE = 0.82
/** Quanto a viga fica para dentro de cada ponta da pegada (fração do comprimento) e onde ficam as cintas (casas a partir da ponta). */
const SOBRA_DA_VIGA = 0.015
const LUGAR_DA_CINTA = 0.11
/** As alturas, em casas: a viga, a ponta da estaca que sobe. */
const ALTURA_DA_VIGA = 0.36
const ALTURA_DA_PONTA = 0.86
/** Em quantos pedaços a sombra da estaca é cortada para subir aos poucos. */
const PEDACOS_DA_SOMBRA = 3
/** O torto de cada estaca: quanto ela gira (radianos) e quanto ela encurta (fração), no máximo. */
const TORTO = 0.09
const ENCURTA = 0.07
/** As lascas da afiação no chão: quantas e o tamanho (px do protótipo). */
const LASCAS = 5
const TAMANHO_DA_LASCA = 1.6

/** O referencial da barreira: `u` ao comprido, `v` de través, trocados quando a pegada é mais alta que larga. */
interface Regua {
  readonly ao: boolean
  readonly L: number
  readonly D: number
  readonly p: (u: number, v: number) => Ponto
}

function regua(c: ContextoDoMovel): Regua {
  const ao = c.w >= c.h
  return { ao, L: ao ? c.w : c.h, D: ao ? c.h : c.w, p: (u, v) => (ao ? [u, v] : [v, u]) }
}

function caixaUV(R: Regua, u0: number, v0: number, u1: number, v1: number, raio: number): Forma {
  return R.ao ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio)
}

/** O ângulo `a` do referencial da barreira, na pegada (a troca de eixos espelha na diagonal). */
function angulo(R: Regua, a: number): number {
  return R.ao ? a : QUARTO - a
}

interface Estaca {
  readonly u: number
  /** De que lado fica a ponta que sobe (-1 = em cima na tela, +1 = embaixo). */
  readonly ladoQueSobe: number
  /** O giro (radianos) e o alcance de cada lado, em px a partir do eixo da viga. */
  readonly giro: number
  readonly alcance: number
  readonly k: number
}

function estacas(c: ContextoDoMovel, R: Regua): Estaca[] {
  const vao = R.L * (1 - 2 * SOBRA_DA_VIGA)
  const n = Math.max(3, Math.round(vao / (c.g * PASSO)))
  const lista: Estaca[] = []
  for (let k = 0; k < n; k += 1) {
    const u = -vao / 2 + ((k + 0.5) * vao) / n + (hash(k, 3, 91) - 0.5) * c.g * 0.03
    lista.push({ u, ladoQueSobe: k % 2 === 0 ? -1 : 1, giro: (hash(k, 7, 91) - 0.5) * 2 * TORTO, alcance: (R.D / 2) * (0.97 - hash(k, 11, 91) * ENCURTA), k })
  }
  return lista
}

/** O ponto da estaca a `t` px do eixo da viga, para o lado `lado`. */
function naEstaca(R: Regua, e: Estaca, lado: number, t: number): Ponto {
  return R.p(e.u + Math.sin(e.giro) * t * lado, Math.cos(e.giro) * t * lado)
}

/** A altura (px) de um ponto da estaca, `t` de 0 (o eixo da viga) a 1 (a ponta). */
function alturaNaEstaca(c: ContextoDoMovel, sobe: boolean, t: number): number {
  const viga = c.g * ALTURA_DA_VIGA
  return sobe ? viga + (c.g * ALTURA_DA_PONTA - viga) * t : viga * (1 - t)
}

/** Meia estaca: a vara de casca do eixo da viga até a ponta afiada, e o cone cru com as duas facetas. */
function meiaEstaca(c: ContextoDoMovel, cena: Cena, R: Regua, e: Estaca, sobe: boolean): void {
  const P = c.peca
  const lado = sobe ? e.ladoQueSobe : -e.ladoQueSobe
  const r = R.D * RAIO_DA_ESTACA * (sobe ? 1 : GROSSURA_DA_QUE_DESCE)
  const ponta = R.D * PONTA
  const fimDaVara = e.alcance - ponta
  const [ax, ay] = naEstaca(R, e, lado, 0)
  const [bx, by] = naEstaca(R, e, lado, fimDaVara)
  const [tx, ty] = naEstaca(R, e, lado, e.alcance)
  const ang = Math.atan2(ty - ay, tx - ax)
  const sem = 8600 + e.k * 10 + (sobe ? 0 : 5)

  for (let i = 0; i < PEDACOS_DA_SOMBRA; i += 1) {
    const t0 = i / PEDACOS_DA_SOMBRA
    const t1 = (i + 1) / PEDACOS_DA_SOMBRA
    const [x0, y0] = naEstaca(R, e, lado, e.alcance * t0)
    const [x1, y1] = naEstaca(R, e, lado, e.alcance * t1)
    cena.sombras.push({ forma: capsula(x0, y0, x1, y1, r), z: alturaNaEstaca(c, sobe, (t0 + t1) / 2), solta: true, forca: sobe ? 0.36 : 0.3, suave: sobe ? 0.9 : 1.1 })
  }
  if (!sobe) cena.sombras.push(contato(elipse(tx, ty, r * 1.2, r * 1.2), 0.42))

  const tom = sobe ? 1.1 : 0.74
  const projeta: OpcoesDaPeca['projeta'] = sobe ? { dist: 1.5, forca: 0.34, suave: 0.9 } : undefined
  cena.partes.push(P(capsula(ax, ay, bx, by, r), CASCA, { eixo: ang, tabua: 0, bisel: r, tom, contorno: 0.3, semente: sem, projeta }))
  // A ponta afiada: duas facetas do cone, a do lado da luz (em cima à esquerda) mais clara.
  const nx = -Math.sin(ang)
  const ny = Math.cos(ang)
  const naLuz = nx * -0.6 + ny * -0.8 > 0 ? 1 : -1
  const base = (s: number): Ponto => [bx + nx * r * s, by + ny * r * s]
  const meio: Ponto = [bx + (tx - bx) * 0.05, by + (ty - by) * 0.05]
  const tomDaPonta = sobe ? 1.1 : 0.84
  for (const s of [1, -1]) {
    const clara = s === naLuz
    cena.partes.push(P(poligono([base(s * 1.02), meio, [tx, ty]]), CRUA, { eixo: ang, tabua: 0, bisel: 0.35, tom: tomDaPonta * (clara ? 1.1 : 0.8), contorno: 0.22, semente: sem + (s > 0 ? 1 : 2), projeta }))
  }
  // A beira da casca cortada em volta do cone: um anel escuro curto.
  cena.partes.push(P(capsula(base(1.05)[0], base(1.05)[1], base(-1.05)[0], base(-1.05)[1], 0.45), CASCA, { tabua: 0, bisel: 0.4, tom: tom * 0.7, contorno: 0, semente: sem + 3 }))
}

/** A viga lavrada, com o chanfro grande, e as duas cintas de ferro pregadas. */
function montarViga(c: ContextoDoMovel, cena: Cena, R: Regua): void {
  const P = c.peca
  const meia = R.D * MEIA_VIGA
  const fim = (R.L / 2) * (1 - 2 * SOBRA_DA_VIGA)
  const viga = caixaUV(R, -fim, -meia, fim, meia, 1.2)
  cena.sombras.push({ forma: viga, z: c.g * ALTURA_DA_VIGA, solta: true, forca: 0.34, suave: 1.2 })
  cena.partes.push(P(viga, c.m.madeira, { eixo: angulo(R, 0), tabua: 0, bisel: meia * 0.55, tom: 0.94, contorno: 0.34, semente: 8580, projeta: { dist: 1.8, forca: 0.34, suave: 1 } }))
  const larg = c.g * 0.045
  for (const lado of [-1, 1]) {
    const u = lado * (fim - c.g * LUGAR_DA_CINTA)
    cena.partes.push(P(caixaUV(R, u - larg, -meia - 0.4, u + larg, meia + 0.4, 0.4), CINTA, { eixo: angulo(R, QUARTO), tabua: 0, bisel: 0.6, tom: 0.92, contorno: 0.3, metal: 0.22, semente: 8590 + lado, projeta: { dist: 0.6, forca: 0.26 } }))
    for (const v of [-0.5, 0.5]) {
      const [x, y] = R.p(u, v * meia)
      cena.partes.push(P(elipse(x, y, 0.6, 0.6), PREGO, { bisel: 0.6, tom: 1.15, contorno: 0, metal: 0.3 }))
    }
  }
}

/** O furo no alto da viga de onde a estaca que sobe sai: o escuro em volta do pé dela. */
function montarFuro(c: ContextoDoMovel, cena: Cena, R: Regua, e: Estaca): void {
  const r = R.D * RAIO_DA_ESTACA
  const [x, y] = naEstaca(R, e, e.ladoQueSobe, r * 0.3)
  cena.partes.push(c.peca(elipse(x, y, r * 1.45, r * 1.45), FURO, { tabua: 0, bisel: 0.6, contorno: 0.1, alfa: 0.85, semente: 8595 + e.k }))
}

/** As lascas da afiação, no chão, perto das pontas que descem. */
function montarLascas(c: ContextoDoMovel, cena: Cena, R: Regua, lista: readonly Estaca[]): void {
  for (let i = 0; i < LASCAS; i += 1) {
    const e = lista[Math.floor(hash(i, 1, 93) * lista.length)]
    const lado = -e.ladoQueSobe
    const t = e.alcance * (0.55 + hash(i, 2, 93) * 0.4)
    const [x, y] = naEstaca(R, e, lado, t)
    const ox = (hash(i, 3, 93) - 0.5) * c.g * 0.16
    const oy = (hash(i, 4, 93) - 0.5) * c.g * 0.08
    const a = hash(i, 5, 93) * Math.PI
    const l = TAMANHO_DA_LASCA * (0.7 + hash(i, 6, 93) * 0.6)
    const cx = Math.max(-c.hw + l, Math.min(c.hw - l, x + ox))
    const cy = Math.max(-c.hh + l, Math.min(c.hh - l, y + oy))
    const lasca = barra(cx - Math.cos(a) * l, cy - Math.sin(a) * l, cx + Math.cos(a) * l, cy + Math.sin(a) * l, l * 0.55)
    cena.sombras.push(contato(lasca, 0.22))
    cena.partes.push(c.peca(lasca, CRUA, { eixo: a, tabua: 0, bisel: 0.3, tom: 0.98, contorno: 0.2, semente: 8640 + i }))
  }
}

export const montarCavaloDeFrisa: MontarMovel = (c, cena) => {
  const R = regua(c)
  const lista = estacas(c, R)
  cena.corDoPiso = ESCURO_DA_CASCA
  montarLascas(c, cena, R, lista)
  // De baixo para cima: as metades que descem (passam por baixo da viga), a viga, e as que sobem saindo do furo.
  for (const e of lista) meiaEstaca(c, cena, R, e, false)
  montarViga(c, cena, R)
  for (const e of lista) {
    montarFuro(c, cena, R, e)
    meiaEstaca(c, cena, R, e, true)
  }
}
