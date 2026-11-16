/**
 * TAPETE DE BANHEIRO felpudo (banheiro moderno, desenhista B, 15/11/2026; o mestre pediu "vários mais utensílios
 * para banheiro" no estilo moderno). O tapete grosso de pelo, de cor lisa, com os cantos bem redondos: o que fica na
 * saída do chuveiro, na frente da pia ou da banheira.
 *
 * DE CIMA é o retângulo de cantos redondos com a felpa: os tufos curtos (o pelo torcido dos tapetes de banho), a
 * luz mexida do pelo e a beira caindo, mais escura, onde o pelo dobra para o chão. Não tem franja, borda bordada
 * nem medalhão: é o que o separa do tapete da sala (`tapete.ts`), que tem os três. A 25% de zoom sobra o retângulo
 * redondo e macio da cor do tecido.
 *
 * NA 3/4 sobe como o tapete da sala: a sombra baixa vira o degrau (a grossura do pelo, na cor do tecido, mais
 * escura) e o tapete sobe essa altura (perfil `{ modo: 'derivado', alturaSolta: SOMBRA_DO_TAPETE.z }`). Material:
 * `tecido` (a cor do pelo; o fio do tecido não aparece, a felpa é desenhada).
 */
import { caixa } from './formas'
import { ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { SOMBRA_DO_TAPETE } from './tapete'

/** O raio dos cantos, em fração do menor meio lado, e quanto o tapete fica da beira da pegada (px). */
const CANTO = 0.55
const FOLGA = 1
/** A largura da beira onde o pelo cai (px) e quanto ela escurece. */
const BEIRA = 2.4
const QUEDA = 0.2
/** O tamanho do tufo (px) e a força dele; abaixo da escala de risco (pixels por px) fica um terço, sem chuvisco. */
const TUFO = 0.85
const FORCA_DO_TUFO = 0.07
const ESCALA_DO_RISCO = 1.5

/** A distância (com sinal, negativa dentro) ao retângulo de cantos redondos de meios lados (a, b) e raio r. */
function distanciaDaCaixa(x: number, y: number, a: number, b: number, r: number): number {
  const qx = Math.abs(x) - (a - r)
  const qy = Math.abs(y) - (b - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

/** A felpa: os tufos torcidos em fileiras mexidas, o pelo miúdo por cima e a beira caindo. */
function texFelpa(a: number, b: number, r: number): Textura {
  return (_u, _v, x, y, p, s, escala) => {
    const miudo = escala < ESCALA_DO_RISCO ? 0.33 : 1
    const torcao = ruido(x * 0.3 + p.semente, y * 0.3) * 3.2
    const tufo = Math.sin((x + torcao) / TUFO) * Math.sin((y - torcao) / TUFO)
    const pelo = ruido(x * 1.3, y * 1.3 + p.semente)
    const mancha = ruido(x * 0.08 + 11, y * 0.08)
    s[3] += (tufo * FORCA_DO_TUFO + pelo * 0.07) * miudo + mancha * 0.03
    const dentro = -distanciaDaCaixa(x, y, a, b, r)
    if (dentro < BEIRA) s[3] -= QUEDA * (1 - dentro / BEIRA) ** 2
  }
}

export const montarTapeteDeBanheiro: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const a = hw - FOLGA
  const b = hh - FOLGA
  const r = Math.min(a, b) * CANTO
  const corpo = caixa(-a, -b, a, b, r)
  // O pelo: a cor do tecido sem o fio (a felpa é desenhada), um nada mais clara que o tapete da sala.
  const pelo: MaterialDaPeca = { classe: 'liso', rgb: c.m.tecido.rgb }
  cena.sombras.push({ forma: corpo, ...SOMBRA_DO_TAPETE })
  cena.partes.push(P(corpo, pelo, { tabua: 0, bisel: 2.2, contorno: 0.12, tom: 1.04, textura: texFelpa(a, b, r), semente: 5401 }))
}
