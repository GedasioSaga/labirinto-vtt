/**
 * DESTROÇOS DE MADEIRA de cima com volume (10/11/2026, pedido do mestre:
 * "destroços de madeira"): o que sobrou de uma construção que caiu. Duas VIGAS
 * grossas por baixo e as TÁBUAS quebradas atravessadas por cima, cada uma num
 * ângulo, uma partida em V na frente; as pontas quebradas são LASCADAS (em
 * dentes, não cortadas a serra) e mostram a madeira de dentro, mais clara;
 * as pontas inteiras guardam os pregos. Em volta, as lascas que voaram.
 *
 * A 25% de zoom sobra o emaranhado de riscos cruzados com pontas claras: é o
 * que diz "madeira quebrada" e não "pilha de lenha" (os troncos são paralelos
 * e redondos). Material: `madeira` (a das tábuas; a velha de partida). As
 * medidas saem do menor lado da pegada (2 x 2 casas de partida) e as
 * posições, de frações dela: o objeto esticado espalha as tábuas.
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { barra, capsula, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca, type Peca } from './motor'
import { PREGO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** Como a ponta da tábua acabou: inteira (o corte reto, com os pregos) ou lascada (quebrada em dentes). */
type Ponta = 'inteira' | 'lascada'

/** Dentes de uma ponta lascada. */
const DENTES = 4
/**
 * A madeira de dentro, na quebra: a face da tábua puxada para o cerne claro e quente (o `CERNE_DO_PINHO` dos
 * troncos). A face pegou tempo e sujeira; por dentro toda madeira é clara, até a velha, que por fora é cinza.
 */
const CERNE: Rgb = [0xcf, 0xae, 0x7c]
const QUANTO_DE_CERNE = 0.62

interface Tabua {
  /** O meio, em frações da meia pegada. */
  readonly x: number
  readonly y: number
  /** Comprimento e largura, em frações do menor meio lado. */
  readonly comp: number
  readonly larg: number
  readonly ang: number
  readonly pontas: readonly [Ponta, Ponta]
  readonly tom: number
  /** Altura do topo em casas: as de cima fazem sombra mais longe. */
  readonly z: number
}

/**
 * A pilha, de baixo para cima: as duas vigas, as tábuas e, por último, a tábua comprida de cima. As duas
 * metades da tábua partida (o V da frente) encostam as pontas lascadas uma na outra.
 */
const PILHA: readonly Tabua[] = [
  { x: -0.06, y: 0.34, comp: 1.74, larg: 0.27, ang: 0.14, pontas: ['inteira', 'lascada'], tom: 0.78, z: 0.16 },
  { x: 0.2, y: -0.3, comp: 1.36, larg: 0.25, ang: -1.0, pontas: ['lascada', 'inteira'], tom: 0.84, z: 0.16 },
  { x: -0.62, y: -0.56, comp: 0.52, larg: 0.2, ang: -0.5, pontas: ['lascada', 'inteira'], tom: 0.9, z: 0.1 },
  { x: 0.62, y: 0.64, comp: 0.56, larg: 0.19, ang: 0.9, pontas: ['inteira', 'lascada'], tom: 1.0, z: 0.1 },
  { x: -0.36, y: -0.1, comp: 1.24, larg: 0.2, ang: 0.98, pontas: ['inteira', 'lascada'], tom: 1.02, z: 0.22 },
  { x: 0.34, y: 0.2, comp: 1.3, larg: 0.2, ang: -0.36, pontas: ['lascada', 'lascada'], tom: 0.92, z: 0.24 },
  { x: -0.1, y: -0.54, comp: 1.1, larg: 0.19, ang: 0.1, pontas: ['lascada', 'inteira'], tom: 1.08, z: 0.24 },
  { x: -0.46, y: 0.62, comp: 0.66, larg: 0.2, ang: -0.36, pontas: ['inteira', 'lascada'], tom: 0.98, z: 0.12 },
  { x: 0.04, y: 0.66, comp: 0.62, larg: 0.2, ang: 0.42, pontas: ['lascada', 'inteira'], tom: 1.05, z: 0.12 },
  { x: 0.6, y: -0.52, comp: 0.7, larg: 0.19, ang: 1.34, pontas: ['lascada', 'lascada'], tom: 0.9, z: 0.12 },
  { x: 0.02, y: 0.02, comp: 1.56, larg: 0.2, ang: -0.84, pontas: ['inteira', 'lascada'], tom: 1.1, z: 0.32 },
]

/** As lascas soltas em volta: o meio (frações da meia pegada), o comprimento (fração do menor meio lado) e o ângulo. */
const LASCAS: readonly (readonly [number, number, number, number])[] = [
  [-0.8, -0.62, 0.12, 0.6],
  [0.86, 0.1, 0.1, -1.1],
  [-0.84, 0.3, 0.09, 2.2],
  [0.5, 0.82, 0.13, 0.2],
  [-0.3, 0.9, 0.08, -0.5],
  [0.82, -0.82, 0.1, 1.9],
  [-0.5, -0.86, 0.09, -0.2],
]

/** A ponta da tábua no referencial dela (x ao longo): reta, ou em dentes de fundo sorteado. `lado` = -1 a de trás, 1 a da frente. */
function ponta(tipo: Ponta, lado: -1 | 1, meioComp: number, meiaLarg: number, sem: number): Ponto[] {
  const x = lado * meioComp
  if (tipo === 'inteira') return [[x, -lado * meiaLarg], [x, lado * meiaLarg]]
  const fundo = meiaLarg * 2 * 0.9
  const pontos: Ponto[] = []
  // De uma beira à outra: os dentes saem (a fibra que ficou) e entram (a que foi embora).
  for (let k = 0; k <= DENTES * 2; k += 1) {
    const y = -lado * meiaLarg + (lado * meiaLarg * 2 * k) / (DENTES * 2)
    const entra = k % 2 === 1 ? 0.4 + 0.6 * hash(k, sem, 71) : 0.12 * hash(k, sem, 72)
    pontos.push([x - lado * fundo * entra, y])
  }
  return pontos
}

/**
 * A faixa da ponta lascada, por onde a madeira de dentro aparece: só meia largura de fundo, menos que os
 * vãos entre os dentes, então o que clareia são os dentes (as fibras), e não uma tarja na ponta da tábua.
 */
function faixaDaQuebra(lado: -1 | 1, meioComp: number, meiaLarg: number, cx: number, cy: number, ang: number): Forma {
  const fundo = meiaLarg * 1.1
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const de = lado * (meioComp - fundo)
  const ate = lado * (meioComp + 1)
  return barra(cx + de * co, cy + de * si, cx + ate * co, cy + ate * si, meiaLarg * 2 + 2)
}

function montarTabua(c: ContextoDoMovel, cena: Cena, L: Peca[], t: Tabua, mad: MaterialDaPeca, k: number): void {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const cx = t.x * c.hw
  const cy = t.y * c.hh
  const meioComp = (t.comp * R) / 2
  const meiaLarg = (t.larg * R) / 2
  const co = Math.cos(t.ang)
  const si = Math.sin(t.ang)
  const noMapa = ([x, y]: Ponto): Ponto => [cx + x * co - y * si, cy + x * si + y * co]
  const forma = poligono([...ponta(t.pontas[1], 1, meioComp, meiaLarg, 300 + k), ...ponta(t.pontas[0], -1, meioComp, meiaLarg, 400 + k)].map(noMapa))
  cena.sombras.push({ forma, z: c.g * t.z, forca: 0.26 }, contato(forma, 0.24))
  L.push(P(forma, mad, { eixo: t.ang, tabua: 0, bisel: 1.2, tom: t.tom, contorno: 0.28, semente: 2500 + k, projeta: { dist: 0.8 + c.g * t.z * 0.1, forca: 0.32 } }))
  const quebra: MaterialDaPeca = { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, QUANTO_DE_CERNE) }
  for (const [i, lado] of ([-1, 1] as const).entries()) {
    if (t.pontas[i] === 'lascada') {
      L.push(P(dentroDe(forma, faixaDaQuebra(lado, meioComp, meiaLarg, cx, cy, t.ang)), quebra, { eixo: t.ang, tabua: 0, bisel: 0.5, contorno: 0.16, semente: 2520 + k * 2 + i }))
      continue
    }
    // A ponta inteira guarda os dois pregos de quando a tábua estava pregada.
    for (const v of [-0.45, 0.45]) {
      const [px, py] = noMapa([lado * (meioComp - meiaLarg * 0.9), v * meiaLarg])
      L.push(P(elipse(px, py, 0.65, 0.65), PREGO, { bisel: 0.6, contorno: 0, metal: 0.2 }))
    }
  }
}

export const montarDestrocosDeMadeira: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const mad = c.m.madeira
  const L = cena.partes
  // As lascas primeiro: ficam no chão, por baixo de tudo.
  LASCAS.forEach(([fx, fy, comp, ang], k) => {
    const meio = (comp * R) / 2
    const lasca = capsula(fx * hw - Math.cos(ang) * meio, fy * hh - Math.sin(ang) * meio, fx * hw + Math.cos(ang) * meio, fy * hh + Math.sin(ang) * meio, 0.8)
    cena.sombras.push(contato(lasca, 0.2))
    L.push(P(lasca, { classe: 'madeira', rgb: misturar(mad.rgb, CERNE, QUANTO_DE_CERNE) }, { eixo: ang, tabua: 0, bisel: 0.6, contorno: 0.24, semente: 2580 + k }))
  })
  PILHA.forEach((tabua, k) => montarTabua(c, cena, L, tabua, mad, k))
}
