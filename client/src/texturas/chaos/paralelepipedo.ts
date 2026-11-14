import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * PARALELEPÍPEDO (pedido de 14/11/2026: "texturas novas de madeira, pedra, base militar"; cartão Pisos de pedra):
 * a rua de cidade. Blocos retangulares de granito cinza, três por casa no comprido e quatro fileiras por casa, em
 * fileiras retas com meia peça de deslocamento, cada bloco de um comprimento (lascado à mão). O topo de cada bloco é levemente abaulado (a borda de cima à
 * esquerda pega a luz, a de baixo à direita cai na sombra), os cantos são gastos e a borda serpenteia um nada,
 * como pedra lascada à mão. Entre eles, a junta de areia escura.
 *
 * A junta se lê mais pela COR (areia parda contra granito cinza) que pela luz: com quatro fileiras por casa, uma
 * junta muito escura viraria listra no mapa (a régua mede só a luz de pixel a pixel).
 */

const CASAS = 8
/** Blocos por casa no comprido (a fileira corre na horizontal) e fileiras por casa. */
const BLOCOS_POR_CASA = 3
const FILEIRAS_POR_CASA = 4
const BLOCOS = CASAS * BLOCOS_POR_CASA
const FILEIRAS = CASAS * FILEIRAS_POR_CASA
/** O tamanho da célula de cada bloco, em casas (o bloco é ela menos a junta). */
const COMPRIMENTO = 1 / BLOCOS_POR_CASA
const LARGURA = 1 / FILEIRAS_POR_CASA
/** O quanto cada junta entre dois blocos da fileira foge do lugar, em comprimentos de bloco. */
const DESENCONTRO = 0.15
/** Meia junta de cada bloco, em casas: a junta entre dois é a soma das duas metades (0,03 a 0,05 casa). */
const MEIA_JUNTA = [0.015, 0.025] as const
/** O quanto o bloco foge do meio da célula, em casas: a junta engrossa de um lado e afina do outro. */
const FOLGA_DO_BLOCO = 0.006
/** O raio do canto gasto, em casas. */
const CANTO = [0.018, 0.045] as const
/** O quanto a borda serpenteia, em casas, e a escala do ruído que a torce (células por ladrilho). */
const TORCAO = 0.01
const TORCAO_ESCALA = 32
/** O ombro abaulado: da borda até `OMBRO` casas para dentro a pedra inclina; a inclinação na borda. */
const OMBRO = 0.05
const INCLINACAO = 0.45
/** A coroa: o topo inteiro um nada mais alto no meio que nas pontas. */
const COROA = 0.12
/** Cada bloco assentado um nada torto (a rua não é plana). */
const TORTO = 0.06
/** Quanto a luz do relevo pesa na cor. */
const LUZ_DO_RELEVO = 0.22
/** A passagem da pedra para a junta, em casas a partir da borda (para fora e para dentro): macia, sem fio de 1 px. */
const PASSAGEM = { dentro: -0.012, fora: 0.01 } as const

/** Granito cinza, neutro; um bloco um nada mais quente, outro um nada mais frio, nenhum com cor de verdade. */
const TONS: readonly Rgb[] = [rgb('#8b8985'), rgb('#86857f'), rgb('#8f8c86'), rgb('#858583'), rgb('#898782'), rgb('#807f7b')]
/** A mancha de ferrugem que a água deixa num ou noutro bloco: parda e apagada. */
const FERRUGEM = rgb('#8a7f70')
/** Areia escura e parda da junta: escurece pouco a luz, a cor é que a separa do granito. */
const JUNTA = rgb('#70665a')
/** Grão claro da areia na junta. */
const AREIA = rgb('#7a705f')

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/**
 * O quanto a junta antes do bloco `k` da fileira foge do lugar, em comprimentos de bloco: blocos de 0,7 a 1,3 do
 * comprimento, como a pedra lascada à mão. O índice dá a volta no ladrilho (k pode passar de BLOCOS na emenda).
 */
function desencontro(k: number, fileira: number): number {
  return (hash(k % BLOCOS, fileira, 1708) - 0.5) * 2 * DESENCONTRO
}

/**
 * A cor do paralelepípedo no ponto (u, v) do ladrilho.
 * A emenda do ladrilho cai no meio dos blocos (um quarto e três quartos dele), nunca numa junta.
 */
export function texturaParalelepipedo(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const y = vv * FILEIRAS + 0.5
  const fileira = Math.floor(y) % FILEIRAS
  const x = uu * BLOCOS + (fileira % 2 === 1 ? 0.75 : 0.25)
  // As juntas da fileira fora do lugar: o bloco é o pedaço entre a junta antes de x e a depois.
  let k = Math.floor(x)
  let inicio = k + desencontro(k, fileira)
  let fim = k + 1 + desencontro(k + 1, fileira)
  if (x < inicio) {
    fim = inicio
    k -= 1
    inicio = k + desencontro(k, fileira)
  } else if (x >= fim) {
    inicio = fim
    k += 1
    fim = k + 1 + desencontro(k + 1, fileira)
  }
  const coluna = k % BLOCOS
  const bloco = fileira * BLOCOS + coluna
  // O ponto dentro do bloco, em casas a partir do meio dele, com a borda torcida.
  const px = (x - (inicio + fim) / 2) * COMPRIMENTO + fbm(uu, vv, TORCAO_ESCALA, 2, 1701) * TORCAO
  const py = (y - Math.floor(y) - 0.5) * LARGURA + fbm(uu, vv, TORCAO_ESCALA, 2, 1702) * TORCAO
  // O bloco: retângulo de canto arredondado, um nada fora do meio da célula.
  const meiaJunta = MEIA_JUNTA[0] + (MEIA_JUNTA[1] - MEIA_JUNTA[0]) * hash(bloco, 0, 1703)
  const a = ((fim - inicio) * COMPRIMENTO) / 2 - meiaJunta
  const b = LARGURA / 2 - meiaJunta
  const r = CANTO[0] + (CANTO[1] - CANTO[0]) * hash(bloco, 1, 1703)
  const dx = px - (hash(bloco, 2, 1703) - 0.5) * 2 * FOLGA_DO_BLOCO
  const dy = py - (hash(bloco, 3, 1703) - 0.5) * 2 * FOLGA_DO_BLOCO
  const qx = Math.abs(dx) - (a - r)
  const qy = Math.abs(dy) - (b - r)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  const fora = Math.sqrt(ox * ox + oy * oy)
  // Distância assinada à borda do bloco (negativa dentro) e o rumo para fora dela.
  const borda = fora + Math.min(Math.max(qx, qy), 0) - r
  let nx = 0
  let ny = 0
  if (fora > 0) {
    nx = (Math.sign(dx) * ox) / fora
    ny = (Math.sign(dy) * oy) / fora
  } else if (qx > qy) nx = Math.sign(dx)
  else ny = Math.sign(dy)

  // A pedra: o tom do bloco, a ferrugem de um ou outro, as manchas largas e o salpicado do granito.
  let pedra = TONS[Math.floor(hash(bloco, 4, 1703) * TONS.length) % TONS.length]
  const ferrugem = hash(bloco, 5, 1703) < 0.12 ? passoSuave(0.1, 0.6, fbm(uu, vv, 24, 2, 1704) * 0.5 + 0.5) * 0.6 : 0
  pedra = misturar(pedra, FERRUGEM, ferrugem)
  const salpico = valor(uu * 256, vv * 256, 256, 1705)
  const mancha = fbm(uu, vv, 16, 2, 1706) * 0.035 + (hash(bloco, 6, 1703) - 0.5) * 0.08
  pedra = luz(pedra, mancha - passoSuave(0.7, 0.92, salpico) * 0.04 + passoSuave(0.22, 0.06, salpico) * 0.025)
  // O relevo: o ombro inclinado na borda, a coroa do topo e o bloco assentado torto.
  const ombro = INCLINACAO * (1 - passoSuave(0, OMBRO, -borda))
  const dhx = -nx * ombro - COROA * (dx / a) + (hash(bloco, 7, 1703) - 0.5) * 2 * TORTO
  const dhy = -ny * ombro - COROA * (dy / b) + (hash(bloco, 8, 1703) - 0.5) * 2 * TORTO
  pedra = luz(pedra, (luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO) * LUZ_DO_RELEVO)

  // A junta: areia escura com o grão mais claro dela.
  const junta = misturar(JUNTA, AREIA, passoSuave(0.55, 0.85, valor(uu * 320, vv * 320, 320, 1707)) * 0.3)
  return empacotar(misturar(pedra, junta, passoSuave(PASSAGEM.dentro, PASSAGEM.fora, borda)))
}
