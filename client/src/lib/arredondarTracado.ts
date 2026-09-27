import type { Point } from '../pixi/world'
import { ROOM_CIRCLE_SIDES } from './roomCircle'

/**
 * Maior mudança de direção entre dois trechos retos seguidos de uma curva do
 * "Arredondar": 360° / 64 = 5,625°, a MESMA de uma Sala Circular.
 *
 * POR QUE esse número, e não um passo mais largo que gastasse menos paredes:
 * cortado em trechos que viram Δ cada, o arco afunda `1 - cos(Δ/2)` do raio no
 * meio de cada trecho. É exatamente a conta de lib/roomCircle.ts, onde o
 * projeto já mediu o que o olho vê: com Δ = 15° (24 lados) o achatamento de
 * 0,86% apareceu a olho nu no passeio de 17/09/2026; com 5,625° ele cai para
 * 0,12% — 0,34 px num raio de 280 px, abaixo do antialiasing do traço. Um passo
 * de 10° ainda deixaria 0,38%, mais de 1 px nesse raio: a sala arredondada
 * ficaria visivelmente menos redonda que a Sala Circular ao lado dela.
 *
 * E o preço já é conhecido: um canto de 90° vira 16 trechos, e um quadrado
 * arredondado sai com as mesmas 64 paredes de uma Sala Circular — o custo que o
 * projeto já aceitou por um círculo.
 */
export const PASSO_ANGULAR = (2 * Math.PI) / ROOM_CIRCLE_SIDES

/**
 * Canto que, a menos disto (em radianos), volta pelo mesmo caminho: a curva
 * que caberia ali teria raio zero, então o ponto clicado fica como está. Bem
 * acima do erro de ponto flutuante do `atan2` (~1e-16) e bem abaixo de qualquer
 * ângulo que se consiga traçar de propósito.
 */
const ANGULO_DESPREZIVEL = 1e-6

/**
 * Dois pontos mais perto que isto (px de mundo) são o mesmo ponto: um clique
 * repetido, ou o fim da curva de um canto caindo em cima do começo da curva
 * seguinte (num quadrado, as duas se encontram no meio do lado). Mantidos, eles
 * virariam uma parede de comprimento zero.
 */
const DISTANCIA_DESPREZIVEL = 1e-6

/**
 * Folga do arredondamento para cima na contagem de trechos: um canto de 90°
 * deveria dar 16 trechos exatos, mas a divisão em ponto flutuante pode sair
 * 16,000000000000004, e o `Math.ceil` puro criaria um trecho a mais sem motivo.
 */
const FOLGA_DA_CONTAGEM = 1e-9

function coincidem(a: Point, b: Point): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < DISTANCIA_DESPREZIVEL
}

/**
 * Cópia sem pontos repetidos seguidos; `fechado` também tira o último quando
 * ele repete o primeiro (o fechamento já é implícito). Copia cada ponto para
 * que quem recebe a saída nunca mexa, sem querer, no traçado de quem chamou.
 */
function semRepetidos(points: Point[], fechado: boolean): Point[] {
  const saida: Point[] = []
  for (const ponto of points) {
    const anterior = saida[saida.length - 1]
    if (anterior && coincidem(anterior, ponto)) continue
    saida.push({ x: ponto.x, y: ponto.y })
  }
  const primeiro = saida[0]
  const ultimo = saida[saida.length - 1]
  if (fechado && saida.length > 1 && coincidem(primeiro, ultimo)) saida.pop()
  return saida
}

/**
 * A curva que substitui `canto`, do ponto em que ela sai do lado de chegada
 * até o ponto em que entra no lado de saída, já cortada em trechos retos.
 *
 * A curva tangencia os dois lados a meio caminho do lado vizinho mais curto: é
 * o maior arredondamento que cabe sem que as curvas de dois cantos vizinhos se
 * cruzem no lado entre eles (cada uma usa no máximo metade dele).
 */
function curvaDoCanto(anterior: Point, canto: Point, seguinte: Point): Point[] {
  const ladoDeChegada = Math.hypot(canto.x - anterior.x, canto.y - anterior.y)
  const ladoDeSaida = Math.hypot(seguinte.x - canto.x, seguinte.y - canto.y)
  // Direções (unitárias) de quem chega ao canto e de quem sai dele.
  const chegadaX = (canto.x - anterior.x) / ladoDeChegada
  const chegadaY = (canto.y - anterior.y) / ladoDeChegada
  const saidaX = (seguinte.x - canto.x) / ladoDeSaida
  const saidaY = (seguinte.y - canto.y) / ladoDeSaida
  // O sinal do produto vetorial diz para que lado o traçado vira; o ângulo de
  // giro fica em [0, π] — 0 é seguir reto, π é voltar pelo mesmo caminho.
  const produtoVetorial = chegadaX * saidaY - chegadaY * saidaX
  const giro = Math.atan2(Math.abs(produtoVetorial), chegadaX * saidaX + chegadaY * saidaY)
  if (Math.PI - giro < ANGULO_DESPREZIVEL) return [{ x: canto.x, y: canto.y }]

  const trechos = Math.ceil(giro / PASSO_ANGULAR - FOLGA_DA_CONTAGEM)
  // Canto que já dobra no máximo um passo — a reta inclusive — já é tão liso
  // quanto a curva ficaria: arredondá-lo só trocaria 1 ponto (1 dobra) por 2.
  if (trechos <= 1) return [{ x: canto.x, y: canto.y }]

  const recuo = Math.min(ladoDeChegada, ladoDeSaida) / 2
  const raio = recuo / Math.tan(giro / 2)
  // Normal do lado de chegada que aponta para o centro da curva.
  const sentido = produtoVetorial > 0 ? 1 : -1
  const normalX = -chegadaY * sentido
  const normalY = chegadaX * sentido
  const inicioX = canto.x - chegadaX * recuo
  const inicioY = canto.y - chegadaY * recuo

  const curva: Point[] = []
  for (let k = 0; k < trechos; k++) {
    const angulo = (giro * k) / trechos
    const avanco = raio * Math.sin(angulo)
    const desvio = raio * (1 - Math.cos(angulo))
    curva.push({ x: inicioX + chegadaX * avanco + normalX * desvio, y: inicioY + chegadaY * avanco + normalY * desvio })
  }
  // O fim sai direto do lado de saída, não da trigonometria: cai exatamente
  // onde começa a curva do canto seguinte quando as duas se encontram.
  curva.push({ x: canto.x + saidaX * recuo, y: canto.y + saidaY * recuo })
  return curva
}

/**
 * Arredonda os cantos de um traçado ponto a ponto (Sala livre e Parede livre
 * com "Arredondar" ligado): cada canto vira uma curva feita de trechos retos
 * curtos. Nenhuma primitiva nova — só mais pontos, que viram mais paredes (ou
 * mais vértices da sala) pelo caminho de sempre. Com a curva de cada canto
 * indo até o meio do lado mais curto, um quadrado vira círculo e um retângulo
 * vira pílula.
 *
 * `fechado`: o traçado dá a volta (o último ponto liga no primeiro) e todo
 * ponto é canto. Aberto, as duas pontas ficam exatamente onde foram clicadas e
 * só os pontos do meio viram curva.
 *
 * Não altera `points`. Menos de 3 pontos distintos não têm canto: voltam como
 * estão, só sem os repetidos.
 */
export function arredondarTracado(points: Point[], fechado: boolean): Point[] {
  const pontos = semRepetidos(points, fechado)
  const total = pontos.length
  if (total < 3) return pontos

  const saida: Point[] = []
  if (!fechado) saida.push(pontos[0])
  const primeiroCanto = fechado ? 0 : 1
  const ultimoCanto = fechado ? total - 1 : total - 2
  for (let i = primeiroCanto; i <= ultimoCanto; i++) {
    saida.push(...curvaDoCanto(pontos[(i - 1 + total) % total], pontos[i], pontos[(i + 1) % total]))
  }
  if (!fechado) saida.push(pontos[total - 1])
  return semRepetidos(saida, fechado)
}
