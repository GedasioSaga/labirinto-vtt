import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * BOLINHAS PRETAS (lote das referências, 15/11/2026: "piso branco com bolinhas pretas"; cartão Pisos de cerâmica):
 * o piso de banheiro e de barbearia dos anos 1920, octógono e bolinha. Ladrilhos brancos em octógono de meia casa
 * (o quadrado com os quatro cantos cortados), rejunte claro, e no vão que os quatro cantos cortados deixam, uma
 * bolinha escura vidrada. A peça branca é vidrada: a beirada pega a luz de cima à esquerda, cada peça um nada fora
 * do tom; o rejunte encarde numa parte do chão, e uma bolinha ou outra está gasta (mais apagada) ou faltando (o vão
 * fica com o cimento do rejunte).
 *
 * A bolinha é escura só até onde a régua deixa: ela cobre ~3% do chão, o 1% mais escuro cai nela, e a faixa de luz
 * tem teto de 0,4; daí o branco gelo e a bolinha de carvão (não de tinta preta). A grade das bolinhas é a do mapa:
 * elas caem nos cantos das meias casas, então toda linha da grade passa por elas.
 */

const CASAS = 8
/** Octógonos por casa, de cada lado (meia casa cada). */
const POR_CASA = 2
const PECAS = CASAS * POR_CASA
const LADO = 1 / POR_CASA
const SEMENTE = 6700

/** O corte do canto (casas, ao longo da beira) e o raio da bolinha (casas): ela quase enche o vão do canto. */
const CORTE = 0.1
const BOLINHA = { raio: 0.06, macia: 0.005 } as const
/** O rejunte, em casas a partir da beira do octógono. */
const JUNTA = { fio: 0.004, fim: 0.018 } as const
/** A beirada vidrada: a faixa (casas) e quanto clareia do lado da luz e escurece do outro. */
const BEIRADA = { largura: 0.04, luz: 0.035 } as const
const VARIACAO_DA_PECA = 0.02
const NUVEM = 0.012
const GRAO = 0.01
/** A bolinha gasta (mais clara e apagada) e a que caiu (o vão fica com o cimento). */
const GASTA = { chance: 0.07, clareia: 0.3 } as const
const CAIU = 0.012

const TONS: readonly Rgb[] = [rgb('#cbc9c2'), rgb('#cdcbc4'), rgb('#c9c7c0'), rgb('#ccc9c1')]
const COR_DA_JUNTA = rgb('#b3afa5')
const JUNTA_SUJA = rgb('#9b968b')
const CIMENTO = rgb('#a19c92')
/** Carvão, nada de preto puro (e o menor que a régua de faixa deixa contra o branco). */
const COR_DA_BOLINHA = rgb('#6f6d6a')

const RAIZ_DE_METADE = Math.SQRT1_2
/** A distância do canto da peça até a linha do corte (casas): o vão da bolinha. */
const LIMITE_DO_CORTE = LADO - CORTE

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function voltaInteira(n: number, m: number): number {
  const r = n % m
  return r < 0 ? r + m : r
}

export function texturaBolinhasPretas(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * PECAS
  const y = vv * PECAS
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const peca = (iy % PECAS) * PECAS + (ix % PECAS)
  // Do centro da peça, em casas.
  const px = (x - ix - 0.5) * LADO
  const py = (y - iy - 0.5) * LADO
  const ax = Math.abs(px)
  const ay = Math.abs(py)
  const meio = LADO / 2
  // A distância (casas) até a beira do octógono, positiva dentro; e a normal da beira mais perto.
  const dx = meio - ax
  const dy = meio - ay
  const dd = (LIMITE_DO_CORTE - ax - ay) * RAIZ_DE_METADE
  const borda = Math.min(dx, dy, dd)
  let nx = 0
  let ny = 0
  if (borda === dd) {
    nx = Math.sign(px) * RAIZ_DE_METADE
    ny = Math.sign(py) * RAIZ_DE_METADE
  } else if (borda === dx) {
    nx = Math.sign(px)
  } else {
    ny = Math.sign(py)
  }
  const olhaALuz = -(nx + ny) * RAIZ_DE_METADE

  let c = TONS[Math.floor(hash(peca, 0, SEMENTE) * TONS.length) % TONS.length]
  let k = (hash(peca, 1, SEMENTE) - 0.5) * 2 * VARIACAO_DA_PECA
  k += fbm(uu + hash(peca, 2, SEMENTE), vv + hash(peca, 3, SEMENTE), 8, 3, SEMENTE + 1) * NUVEM
  k += (valor(uu * 384, vv * 384, 384, SEMENTE + 2) - 0.5) * GRAO
  k += passoSuave(BEIRADA.largura, 0, borda) * olhaALuz * BEIRADA.luz
  c = luz(c, k)

  const sujo = passoSuave(-0.2, 0.7, fbm(uu, vv, 3, 3, SEMENTE + 3))
  c = misturar(c, misturar(COR_DA_JUNTA, JUNTA_SUJA, sujo), passoSuave(JUNTA.fim, JUNTA.fio, borda))

  // A bolinha do canto mais perto: o número dela é o do canto da grade (na volta do ladrilho).
  const cantoX = voltaInteira(ix + (px < 0 ? 0 : 1), PECAS)
  const cantoY = voltaInteira(iy + (py < 0 ? 0 : 1), PECAS)
  const ex = meio - ax
  const ey = meio - ay
  const dc = Math.sqrt(ex * ex + ey * ey)
  const cobre = passoSuave(BOLINHA.raio + BOLINHA.macia, BOLINHA.raio - BOLINHA.macia, dc)
  if (cobre > 0) {
    const sorte = hash(cantoX, cantoY, SEMENTE + 4)
    let bolinha = luz(COR_DA_BOLINHA, (valor(uu * 256, vv * 256, 256, SEMENTE + 5) - 0.5) * 0.06)
    if (sorte < CAIU) bolinha = misturar(CIMENTO, JUNTA_SUJA, sujo)
    else if (sorte < CAIU + GASTA.chance) bolinha = misturar(bolinha, CIMENTO, GASTA.clareia)
    c = misturar(c, bolinha, cobre)
  }
  return empacotar(c)
}
