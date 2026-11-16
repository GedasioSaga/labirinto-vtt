import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * MOLDURA ENTALHADA (lote das referências, 15/11/2026: "moldura de pedra entalhada (faixa/borda)"; cartão Pisos de
 * pedra): a borda de pedra lavrada em volta do mosaico do saguão, do altar e do poço do templo. Blocos quadrados de
 * calcário cinza-quente, um por casa, cada um lavrado em relevo: a beira chanfrada, um friso liso em volta e, um
 * degrau abaixo, o painel com o ornato no meio. Os ornatos se alternam como casas de xadrez: a ROSETA (quatro
 * pétalas em cruz e o botão no meio) e o LOSANGO (um losango alto de beira chanfrada com um furo redondo no topo).
 * Assim, pintada numa faixa de uma casa de largura, em pé ou deitada, a moldura é um friso que alterna os dois
 * ornatos; pintada num chão inteiro, é o piso de pedra lavrada do templo.
 *
 * A luz é a do relevo (de cima à esquerda) sobre a altura de verdade do bloco: o chanfro de cima à esquerda pega a
 * luz e o de baixo à direita cai na sombra; no painel, que é fundo, é o contrário (a parede de cima à esquerda do
 * degrau fica na sombra). A sujeira junta onde a pedra é mais funda (o painel e a junta), um canto ou outro está
 * lascado, e o calcário tem as nuvens e o poro dele.
 *
 * O bloco cai na grade do mapa (a junta na linha da grade), para a faixa pintada pelas casas sair com os blocos
 * inteiros.
 */

const CASAS = 8
const SEMENTE = 7000

/** O perfil do bloco (casas, a partir da beira): o chanfro sobe até `chanfro`, o friso vai até `friso`, o degrau desce até `painel`. */
const PERFIL = { chanfro: 0.05, friso: 0.13, painel: 0.17 } as const
/** As alturas (casas): o friso, o painel e os ornatos acima do painel. */
const ALTURA = { friso: 0.03, painel: 0.006, petala: 0.03, botao: 0.04, losango: 0.032, furo: 0.022 } as const
/** A roseta: a distância do centro de cada pétala, o comprimento e a largura (meio eixo, casas) e o raio do botão. */
const ROSETA = { centro: 0.15, comprida: 0.13, larga: 0.078, botao: 0.06 } as const
/** O losango: o raio (|x| + |y|) do topo, o do pé do chanfro e o raio do furo. */
const LOSANGO = { topo: 0.2, pe: 0.262, furo: 0.07, beiraDoFuro: 0.092 } as const
/** O passo da derivada (casas): menos de meio pixel do ladrilho de 1024. */
const PASSO = 0.003
/** O quanto a inclinação clareia ou escurece; a sombra pesa um pouco menos que a luz (sombra macia do Meio-Termo). */
const RELEVO = { luz: 0.6, sombra: 0.36 } as const
/** O canto lascado: a chance por canto do bloco, o raio (casas) e a fundura. */
const LASCA = { chance: 0.12, menor: 0.04, maior: 0.09, fundo: 0.035 } as const
/** A junta escura entre os blocos, em casas a partir da beira. */
const JUNTA = { fio: 0.004, fim: 0.014 } as const
/** A sujeira nos fundos (o quanto puxa para a cor dela no ponto mais fundo) e a pedra: tom, nuvens e poro. */
const SUJEIRA = 0.32
const VARIACAO_DO_BLOCO = 0.035
const NUVEM = 0.03
const PORO = 0.022

const TONS: readonly Rgb[] = [rgb('#a29b8b'), rgb('#a59e8e'), rgb('#9e9787'), rgb('#a39b8a'), rgb('#9f998c')]
const COR_DA_SUJEIRA = rgb('#6e675b')
const COR_DA_JUNTA = rgb('#615c52')

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** A cúpula baixa de uma pétala (elipse com o eixo comprido em `ex`, `ey`). */
function petala(px: number, py: number, ox: number, oy: number, ex: number, ey: number): number {
  const a = (px - ox) / ex
  const b = (py - oy) / ey
  const e = a * a + b * b
  return e >= 1 ? 0 : (1 - e) * ALTURA.petala
}

function roseta(px: number, py: number): number {
  const { centro, comprida, larga, botao } = ROSETA
  let h = Math.max(petala(px, py, centro, 0, comprida, larga), petala(px, py, -centro, 0, comprida, larga))
  h = Math.max(h, petala(px, py, 0, centro, larga, comprida), petala(px, py, 0, -centro, larga, comprida))
  const r2 = (px * px + py * py) / (botao * botao)
  return r2 >= 1 ? h : Math.max(h, (1 - r2) * ALTURA.botao)
}

function losango(px: number, py: number): number {
  const d = Math.abs(px) + Math.abs(py)
  let h = passoSuave(LOSANGO.pe, LOSANGO.topo, d) * ALTURA.losango
  const r = Math.sqrt(px * px + py * py)
  h -= passoSuave(LOSANGO.beiraDoFuro, LOSANGO.furo, r) * ALTURA.furo
  return h
}

/** A altura (casas) do ponto (px, py) do bloco, a partir do centro dele; `lasca` = o raio da lasca do canto (0 = inteiro). */
function altura(px: number, py: number, ornatoRoseta: boolean, lasca: number): number {
  const d = 0.5 - Math.max(Math.abs(px), Math.abs(py))
  let h = passoSuave(0, PERFIL.chanfro, d) * ALTURA.friso
  h -= passoSuave(PERFIL.friso, PERFIL.painel, d) * (ALTURA.friso - ALTURA.painel)
  if (d > PERFIL.painel) h += ornatoRoseta ? roseta(px, py) : losango(px, py)
  if (lasca > 0) {
    const qx = 0.5 - Math.abs(px)
    const qy = 0.5 - Math.abs(py)
    h -= passoSuave(lasca, lasca * 0.45, Math.sqrt(qx * qx + qy * qy)) * LASCA.fundo
  }
  return h
}

export function texturaMolduraEntalhada(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * CASAS
  const y = vv * CASAS
  const i = Math.floor(x)
  const j = Math.floor(y)
  const bloco = (j % CASAS) * CASAS + (i % CASAS)
  const px = x - i - 0.5
  const py = y - j - 0.5
  const ornatoRoseta = ((i + j) & 1) === 0
  // A lasca do canto mais perto (cada canto do bloco sorteia a sua).
  const canto = (px < 0 ? 0 : 1) + (py < 0 ? 0 : 2)
  const lasca = hash(bloco, 10 + canto, SEMENTE) < LASCA.chance ? LASCA.menor + (LASCA.maior - LASCA.menor) * hash(bloco, 20 + canto, SEMENTE) : 0

  const h = altura(px, py, ornatoRoseta, lasca)
  const dhx = (altura(px + PASSO, py, ornatoRoseta, lasca) - altura(px - PASSO, py, ornatoRoseta, lasca)) / (2 * PASSO)
  const dhy = (altura(px, py + PASSO, ornatoRoseta, lasca) - altura(px, py - PASSO, ornatoRoseta, lasca)) / (2 * PASSO)
  const relevo = luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO

  let c = TONS[Math.floor(hash(bloco, 0, SEMENTE) * TONS.length) % TONS.length]
  let k = (hash(bloco, 1, SEMENTE) - 0.5) * 2 * VARIACAO_DO_BLOCO
  k += fbm(uu + hash(bloco, 2, SEMENTE), vv + hash(bloco, 3, SEMENTE), 10, 3, SEMENTE + 1) * NUVEM
  k += (valor(uu * 448, vv * 448, 448, SEMENTE + 2) - 0.5) * PORO
  k += relevo > 0 ? relevo * RELEVO.luz : relevo * RELEVO.sombra
  c = luz(c, k)
  // A sujeira nos fundos: mais funda a pedra, mais suja (e mais suja numa parte do chão que noutra).
  const fundo = passoSuave(ALTURA.friso, 0, h)
  const manchas = 0.6 + 0.4 * passoSuave(-0.4, 0.6, fbm(uu, vv, 3, 3, SEMENTE + 3))
  c = misturar(c, COR_DA_SUJEIRA, fundo * SUJEIRA * manchas)
  const borda = 0.5 - Math.max(Math.abs(px), Math.abs(py))
  return empacotar(misturar(c, COR_DA_JUNTA, passoSuave(JUNTA.fim, JUNTA.fio, borda)))
}
