import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, mod, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * CALÇADA EM LEQUE (lote L06 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Cidade
 * medieval): o paralelepípedo assentado em ARCOS, a praça e a rua larga da cidade velha. Os cubos de granito correm em
 * arcos concêntricos dentro de cada leque, e os leques se sobrepõem como escamas: cada um aparece entre o seu arco de
 * fora e os arcos dos dois leques da fileira de baixo, que passam por cima dele. A fiada de fora de cada leque é de
 * pedra mais escura, então de longe se lê o desenho das escamas; de perto, cada cubo tem o topo abaulado (o ombro de
 * cima à esquerda pega a luz) e a junta de areia parda, a mesma do Paralelepípedo, para os dois conviverem no mapa.
 *
 * As medidas, em casas: o leque tem 4/3 de casa de largura (seis por ladrilho de 8 casas) e as fileiras descem meio
 * leque, com meia largura de desencontro; o raio do leque é 3/4 da largura, em cinco fiadas, e o cubo tem cerca de um
 * quarto de casa ao longo do arco. A emenda do ladrilho cai entre leques inteiros: o desenho repete sem corte.
 */

const CASAS = 8
const LEQUES_POR_FILEIRA = 6
const LARGURA = CASAS / LEQUES_POR_FILEIRA
const DESCIDA = LARGURA / 2
const FILEIRAS = CASAS / DESCIDA
const RAIO = LARGURA * 0.75
const FIADAS = 5
const FIADA = RAIO / FIADAS
/** O quanto o meio de cada leque desvia da grade, em casas (para cada lado). */
const DESVIO = 0.07
/** O comprimento médio do cubo ao longo do arco, em casas. */
const CUBO = 0.24
/** Meia junta, em casas, e o raio do canto gasto do cubo. */
const MEIA_JUNTA = [0.009, 0.015] as const
const CANTO = [0.02, 0.04] as const
/** O topo abaulado: o ombro de `OMBRO` casas na borda, a inclinação nele e a coroa do meio. */
const OMBRO = 0.045
const INCLINACAO = 0.5
const COROA = 0.12
const TORTO = 0.06
const LUZ_DO_RELEVO = 0.22
/** A passagem da pedra para a junta, em casas a partir da borda: macia, sem fio de 1 px. */
const PASSAGEM = { dentro: -0.011, fora: 0.009 } as const
/** O quanto a borda do cubo serpenteia, em casas, e a escala do ruído que a torce. */
const TORCAO = 0.008
const TORCAO_ESCALA = 40

/** Granito: cinza neutro, um ou outro cubo mais quente (rosado) ou mais frio, nenhum com cor de verdade. */
const TONS: readonly Rgb[] = [rgb('#8b8985'), rgb('#888680'), rgb('#908c86'), rgb('#86878a'), rgb('#8e8781'), rgb('#83827e')]
/**
 * A fiada de fora de cada leque: o basalto, um nada mais escuro e mais frio, que desenha as escamas. Mais escuro que
 * isto, as fileiras de leques somavam faixas de través na média das linhas (a régua de listra do portão).
 */
const BASALTO: readonly Rgb[] = [rgb('#7b7a77'), rgb('#7e7d79'), rgb('#787876')]
/**
 * A junta de areia parda e o grão claro dela (os do Paralelepípedo), a junta um nada mais clara: as fiadas em arco se
 * repetem de fileira em fileira, e a junta escura e larga somava faixas de través (a régua de listra do portão).
 */
const JUNTA = rgb('#786e61')
const AREIA = rgb('#7a705f')

interface Leque {
  readonly i: number
  readonly j: number
  readonly cx: number
  readonly cy: number
}

/** O leque que aparece em (x, y), em casas: entre os que cobrem o ponto (dentro do raio, acima do meio), o mais baixo. */
function lequeEm(x: number, y: number): Leque {
  let melhor: Leque | null = null
  let perto: Leque | null = null
  let menor = Infinity
  const j0 = Math.ceil(y / DESCIDA - 1e-9)
  for (let j = j0 - 1; j <= j0 + 2; j += 1) {
    const desloca = mod(j, 2) === 1 ? LARGURA / 2 : 0
    const i0 = Math.floor((x - desloca) / LARGURA)
    for (let i = i0 - 1; i <= i0 + 2; i += 1) {
      // O meio de cada leque desvia um nada: alinhadas, as fiadas dos leques de uma fileira somavam faixas de través.
      const [hi, hj] = [mod(i, LEQUES_POR_FILEIRA), mod(j, FILEIRAS)]
      const cx = i * LARGURA + desloca + (hash(hi, hj, 1801) - 0.5) * 2 * DESVIO
      const cy = j * DESCIDA + (hash(hi, hj, 1802) - 0.5) * 2 * DESVIO
      const d = Math.hypot(x - cx, y - cy)
      if (d < menor) {
        menor = d
        perto = { i, j, cx, cy }
      }
      if (cy >= y && d < RAIO && (melhor === null || cy > melhor.cy)) melhor = { i, j, cx, cy }
    }
  }
  return melhor ?? (perto as Leque)
}

/** A cor da calçada em leque no ponto (u, v) do ladrilho. */
export function texturaCalcadaEmLeque(u: number, v: number): number {
  const uu = u - Math.floor(u)
  const vv = v - Math.floor(v)
  const x = uu * CASAS
  const y = vv * CASAS
  const leque = lequeEm(x, y)
  const semente = mod(leque.i, LEQUES_POR_FILEIRA) * 31 + mod(leque.j, FILEIRAS)
  // As coordenadas do arco: o raio e o ângulo a partir do alto (0 = para cima, cresce para a direita).
  const dx = x - leque.cx
  const dy = y - leque.cy
  const r = Math.hypot(dx, dy)
  const teta = Math.atan2(dx, -dy)
  const fiada = Math.min(FIADAS - 1, Math.floor(r / FIADA))
  const meioDaFiada = (fiada + 0.5) * FIADA
  const cubos = Math.max(3, Math.round((Math.PI * meioDaFiada) / CUBO))
  const passo = Math.PI / cubos
  const desencontro = (fiada % 2) * 0.5 + (hash(fiada, semente, 1811) - 0.5) * 0.3
  const k = Math.floor((teta + Math.PI / 2) / passo + desencontro)
  const cubo = semente * 64 + fiada * 16 + mod(k, 16)
  // O ponto dentro do cubo, em casas: ao longo do arco e através dele, com a borda torcida.
  const ao = ((teta + Math.PI / 2) / passo + desencontro - k - 0.5) * passo * meioDaFiada + fbm(uu, vv, TORCAO_ESCALA, 2, 1812) * TORCAO
  const at = r - meioDaFiada + fbm(uu, vv, TORCAO_ESCALA, 2, 1813) * TORCAO
  const meiaJunta = MEIA_JUNTA[0] + (MEIA_JUNTA[1] - MEIA_JUNTA[0]) * hash(cubo, 0, 1814)
  const a = (passo * meioDaFiada) / 2 - meiaJunta
  const b = FIADA / 2 - meiaJunta
  const raioDoCanto = CANTO[0] + (CANTO[1] - CANTO[0]) * hash(cubo, 1, 1814)
  const qx = Math.abs(ao) - (a - raioDoCanto)
  const qy = Math.abs(at) - (b - raioDoCanto)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  const fora = Math.sqrt(ox * ox + oy * oy)
  const borda = fora + Math.min(Math.max(qx, qy), 0) - raioDoCanto
  // O rumo para fora da borda, ao longo do arco (na) e através dele (nt).
  let na = 0
  let nt = 0
  if (fora > 0) {
    na = (Math.sign(ao) * ox) / fora
    nt = (Math.sign(at) * oy) / fora
  } else if (qx > qy) na = Math.sign(ao)
  else nt = Math.sign(at)

  // A pedra: o tom do cubo (o basalto na fiada de fora), as manchas largas e o salpicado do granito.
  const deFora = fiada === FIADAS - 1
  const tons = deFora ? BASALTO : TONS
  let pedra = tons[Math.floor(hash(cubo, 2, 1814) * tons.length) % tons.length]
  const salpico = valor(uu * 256, vv * 256, 256, 1815)
  const mancha = fbm(uu, vv, 16, 2, 1816) * 0.035 + (hash(cubo, 3, 1814) - 0.5) * 0.08
  pedra = luz(pedra, mancha - passoSuave(0.7, 0.92, salpico) * 0.04 + passoSuave(0.22, 0.06, salpico) * 0.025)
  // O relevo no referencial do arco (ao longo, através), levado para x e y: o ombro, a coroa e o cubo torto.
  const ombro = INCLINACAO * (1 - passoSuave(0, OMBRO, -borda))
  const ga = -na * ombro - COROA * (ao / a) + (hash(cubo, 4, 1814) - 0.5) * 2 * TORTO
  const gt = -nt * ombro - COROA * (at / b) + (hash(cubo, 5, 1814) - 0.5) * 2 * TORTO
  const [ex, ey] = r > 1e-6 ? [dx / r, dy / r] : [0, -1]
  const dhx = ga * -ey + gt * ex
  const dhy = ga * ex + gt * ey
  pedra = luz(pedra, (luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO) * LUZ_DO_RELEVO)

  const junta = misturar(JUNTA, AREIA, passoSuave(0.55, 0.85, valor(uu * 320, vv * 320, 320, 1817)) * 0.3)
  return empacotar(misturar(pedra, junta, passoSuave(PASSAGEM.dentro, PASSAGEM.fora, borda)))
}
