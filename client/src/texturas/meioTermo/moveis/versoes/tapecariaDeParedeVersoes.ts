/**
 * As VERSÕES da tapeçaria de parede (L03 do plano de arte por tema, 28/11/2026): a 1ª, a de hoje (a flor de lis), é o
 * desenho de `MONTADORES` (`../tapecariaDeParede.ts`). As outras são a MESMA tapeçaria (a vara, as alças, o campo, a
 * barra, a franja, o escudo e a coroa) com outra figura no escudo: o LEÃO rampante, o DRAGÃO, a ÁGUIA de asas abertas
 * e a TORRE ameada. Heráldica genérica, de nenhuma casa de verdade.
 *
 * As figuras moram aqui e servem também ao estandarte de pé (`estandarteDePeVersoes.ts`): cada uma cabe na caixa de
 * meia altura `a` em volta de (cx, cy), virada para a esquerda de quem olha (o lado de honra do escudo). São formas
 * cheias, recortadas em silhueta, porque a 1x a figura tem uns 15 pixels: o que diz o bicho é o contorno.
 *
 * Como a troca acontece: o desenho de hoje é chamado com uma fábrica de peças que, só na peça da flor de lis (a de
 * semente `SEMENTE_DA_FLOR`), entrega a figura no lugar da forma. O material, o tom e o chanfro continuam os dela; o
 * resto da tapeçaria sai byte a byte igual. Lugares de material: os da tapeçaria (`pano`, `metal`, `madeira`).
 */
import { caixa, dentroDe, elipse, menos, poligono, uniao, type Forma, type Ponto } from '../formas'
import type { CriarPeca } from '../motor'
import type { ContextoDoMovel, MontarMovel } from '../contexto'
import { montarTapecariaDeParede } from '../tapecariaDeParede'
import { conico } from '../gargula'
import type { VersoesDesenhadas } from '.'

/** A peça da flor de lis no desenho de hoje (`../tapecariaDeParede.ts`): a que a figura substitui. */
const SEMENTE_DA_FLOR = 141
/** O escudo da tapeçaria (as medidas de `../tapecariaDeParede.ts`): o meio, em fração da altura, e a meia largura. */
const Y_DO_ESCUDO = 0.52
const MEIO_ESCUDO = 0.22
const MEIO_ESCUDO_PELA_ALTURA = 0.138
/** A figura no escudo: quanto abaixo do meio dele fica o centro dela e a meia altura (em meias larguras do escudo). */
const DESCE_A_FIGURA = 0.12
const MEIA_ALTURA_DA_FIGURA = 0.96
/** A beira de dentro do escudo que a figura respeita (px do protótipo). */
export const RECUO_DA_FIGURA = 1.4

export type Figura = 'leao' | 'dragao' | 'aguia' | 'torre'

/** O escudo de beira reta em cima e bico embaixo (o de `../tapecariaDeParede.ts` e o do estandarte), recuado `k` px. */
export function escudoDoBrasao(cy: number, me: number, k: number): Forma {
  const alto = me * 2.3
  return poligono([[-me + k, cy - alto * 0.45 + k], [me - k, cy - alto * 0.45 + k], [me - k, cy + alto * 0.05], [me * 0.55 - k * 0.6, cy + alto * 0.36 - k * 0.4], [0, cy + alto * 0.55 - k * 1.3], [-me * 0.55 + k * 0.6, cy + alto * 0.36 - k * 0.4], [-me + k, cy + alto * 0.05]])
}

/** As peças de desenho de uma figura, na caixa de meia altura `a` em volta de (cx, cy). */
function emEscala(cx: number, cy: number, a: number) {
  return {
    el: (x: number, y: number, rx: number, ry: number): Forma => elipse(cx + x * a, cy + y * a, rx * a, ry * a),
    co: (ax: number, ay: number, ra: number, bx: number, by: number, rb: number): Forma => conico(cx + ax * a, cy + ay * a, ra * a, cx + bx * a, cy + by * a, rb * a),
    pol: (pontos: readonly (readonly [number, number])[]): Forma => poligono(pontos.map(([x, y]): Ponto => [cx + x * a, cy + y * a])),
    cx0: (x0: number, y0: number, x1: number, y1: number, r = 0): Forma => caixa(cx + x0 * a, cy + y0 * a, cx + x1 * a, cy + y1 * a, r * a),
  }
}

function juntar(formas: readonly Forma[]): Forma {
  return formas.reduce((soma, f) => uniao(soma, f))
}

/** O leão rampante: de pé na pata de trás, as da frente erguidas, a juba, o rabo enrolado para cima com o tufo. */
function leao(cx: number, cy: number, a: number): Forma {
  const { el, co } = emEscala(cx, cy, a)
  return juntar([
    el(-0.18, -0.58, 0.3, 0.3), el(-0.43, -0.52, 0.17, 0.13), el(-0.1, -0.87, 0.08, 0.08),
    co(-0.12, -0.3, 0.22, 0.18, 0.3, 0.16),
    co(-0.2, -0.32, 0.085, -0.62, -0.66, 0.06), el(-0.68, -0.72, 0.085, 0.07),
    co(-0.12, -0.12, 0.085, -0.6, -0.24, 0.06), el(-0.67, -0.27, 0.085, 0.07),
    co(0.2, 0.34, 0.15, 0.04, 0.62, 0.085), co(0.04, 0.62, 0.085, 0.14, 0.88, 0.06), el(0.07, 0.92, 0.13, 0.055),
    co(0.1, 0.36, 0.13, -0.3, 0.5, 0.075), co(-0.3, 0.5, 0.075, -0.5, 0.74, 0.055), el(-0.56, 0.78, 0.08, 0.065),
    co(0.32, 0.28, 0.055, 0.66, 0, 0.04), co(0.66, 0, 0.04, 0.52, -0.4, 0.035), el(0.5, -0.5, 0.09, 0.12),
  ])
}

/** O dragão de pé: a asa de morcego aberta atrás, o pescoço e a cabeça com o chifre, as patas e o rabo de ponta de seta. */
function dragao(cx: number, cy: number, a: number): Forma {
  const { el, co, pol } = emEscala(cx, cy, a)
  return juntar([
    pol([[0.02, -0.28], [0.18, -0.7], [0.42, -0.94], [0.5, -0.78], [0.86, -0.82], [0.72, -0.6], [0.9, -0.46], [0.66, -0.36], [0.74, -0.18], [0.46, -0.14], [0.26, -0.02]]),
    co(0.02, -0.2, 0.13, -0.26, -0.56, 0.08),
    el(-0.4, -0.64, 0.17, 0.12), co(-0.4, -0.64, 0.1, -0.74, -0.57, 0.05), co(-0.3, -0.72, 0.04, -0.16, -0.95, 0.014),
    co(0.02, -0.18, 0.2, 0.14, 0.3, 0.18),
    co(-0.04, -0.06, 0.06, -0.42, -0.1, 0.045), co(-0.42, -0.1, 0.04, -0.54, -0.2, 0.015),
    co(0.12, 0.36, 0.1, -0.16, 0.58, 0.06), co(-0.16, 0.58, 0.06, -0.06, 0.82, 0.045), el(-0.1, 0.86, 0.1, 0.045),
    co(0.2, 0.38, 0.11, 0.5, 0.56, 0.075), co(0.5, 0.56, 0.075, 0.56, 0.84, 0.05), co(0.56, 0.84, 0.05, 0.3, 0.93, 0.03),
    pol([[0.34, 0.86], [0.12, 0.93], [0.34, 1]]),
  ])
}

/** A águia de asas abertas: o corpo de pé, a cabeça virada com o bico, as asas de penas, a cauda em leque e as garras. */
function aguia(cx: number, cy: number, a: number): Forma {
  const { el, co, pol } = emEscala(cx, cy, a)
  const asa = (s: number): Forma =>
    pol(([[0.1, -0.22], [0.28, -0.62], [0.48, -0.84], [0.62, -0.72], [0.9, -0.62], [0.7, -0.5], [0.95, -0.36], [0.72, -0.26], [0.92, -0.1], [0.66, -0.04], [0.8, 0.14], [0.5, 0.08], [0.14, 0.1]] as const).map(([x, y]) => [s * x, y] as const))
  const garras = (s: number): Forma[] => [co(s * 0.08, 0.32, 0.06, s * 0.3, 0.52, 0.04), co(s * 0.3, 0.52, 0.035, s * 0.45, 0.46, 0.014), co(s * 0.3, 0.52, 0.035, s * 0.4, 0.66, 0.014)]
  return juntar([
    asa(-1), asa(1),
    el(0, 0.02, 0.17, 0.36), el(-0.06, -0.48, 0.13, 0.12), pol([[-0.14, -0.53], [-0.36, -0.47], [-0.2, -0.4]]),
    pol([[-0.12, 0.3], [-0.32, 0.86], [-0.14, 0.74], [0, 0.92], [0.14, 0.74], [0.32, 0.86], [0.12, 0.3]]),
    ...garras(-1), ...garras(1),
  ])
}

/** A torre ameada: o corpo um pouco afunilado, a cornija, as três ameias, a base e os vãos da porta e da janela. */
function torre(cx: number, cy: number, a: number): Forma {
  const { el, pol, cx0 } = emEscala(cx, cy, a)
  const cheia = juntar([
    pol([[-0.42, 0.9], [0.42, 0.9], [0.37, -0.3], [-0.37, -0.3]]),
    cx0(-0.5, -0.44, 0.5, -0.28, 0.03),
    cx0(-0.5, -0.74, -0.26, -0.4, 0.02), cx0(-0.12, -0.74, 0.12, -0.4, 0.02), cx0(0.26, -0.74, 0.5, -0.4, 0.02),
    cx0(-0.52, 0.76, 0.52, 0.95, 0.03),
  ])
  const vaos = juntar([uniao(cx0(-0.15, 0.42, 0.15, 0.78), el(0, 0.42, 0.15, 0.15)), cx0(-0.055, -0.14, 0.055, 0.16, 0.05)])
  return menos(cheia, vaos)
}

export const FIGURAS: Readonly<Record<Figura, (cx: number, cy: number, a: number) => Forma>> = { leao, dragao, aguia, torre }

/** O contexto com a fábrica de peças que entrega `nova` no lugar da peça de semente `semente` (o resto igual). */
export function trocandoAPeca(c: ContextoDoMovel, semente: number, nova: Forma): ContextoDoMovel {
  const peca: CriarPeca = (forma, mat, o) => c.peca(o?.semente === semente ? nova : forma, mat, o)
  return { ...c, peca }
}

function tapecariaCom(figura: Figura): MontarMovel {
  return (c, cena) => {
    const me = Math.min(MEIO_ESCUDO * c.w, MEIO_ESCUDO_PELA_ALTURA * c.h)
    const ye = -c.hh + Y_DO_ESCUDO * c.h
    // A figura não passa da beira de dentro do escudo (o pé da torre e a ponta da cauda, na parte que afina).
    const carga = dentroDe(FIGURAS[figura](0, ye + me * DESCE_A_FIGURA, me * MEIA_ALTURA_DA_FIGURA), escudoDoBrasao(ye, me, RECUO_DA_FIGURA))
    montarTapecariaDeParede(trocandoAPeca(c, SEMENTE_DA_FLOR, carga), cena)
  }
}

export const versoesDoTapecariaDeParede: VersoesDesenhadas = {
  leao: tapecariaCom('leao'),
  dragao: tapecariaCom('dragao'),
  aguia: tapecariaCom('aguia'),
  torre: tapecariaCom('torre'),
}
