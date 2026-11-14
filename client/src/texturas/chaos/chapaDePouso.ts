import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * CHAPA DE POUSO (pedido de 14/11/2026: "texturas novas de madeira, pedra, base militar"; cartão Base militar): a
 * pista de campanha feita de chapa de aço perfurada (as placas de pouso). Chapas compridas de 4 x 1 casa,
 * deitadas e encaixadas em fiada (a fileira de baixo meia chapa adiante), com duas fileiras de furos redondos e
 * uma nervura em relevo correndo entre elas. A borda de cada furo é dobrada para baixo: o lado de cima à
 * esquerda da dobra cai na sombra e o de baixo à direita pega a luz. Pelo furo aparece a terra, mais escura na
 * sombra que a chapa joga nela.
 *
 * Aço pintado de verde-acinzentado fosco, contido (teto de saturação 0,10): nem a terra dos furos passa disso.
 * As frestas caem nas linhas da grade; a emenda do ladrilho cai numa fresta, e a chapa que atravessa a borda
 * continua do outro lado. A primeira versão (chapas de 2 x 1/2 casa) parecia parede de tijolo no tamanho de
 * mesa e as frestas deitadas, uma a cada meia casa, faziam listra: a chapa larga e comprida lê melhor.
 */

const CASAS = 8
/** A chapa: comprimento e largura em casas, quantas por fileira, quantas fileiras por ladrilho e o passo da fiada. */
const COMPRIMENTO = 4
const LARGURA = 1
const POR_FILEIRA = CASAS / COMPRIMENTO
const FILEIRAS = CASAS / LARGURA
const FIADA = COMPRIMENTO / 2

/** O verde-acinzentado fosco de pintura militar: o verde passa o vermelho e o azul por uns 10 níveis. */
const TONS: readonly Rgb[] = [rgb('#5e6258'), rgb('#5c6056'), rgb('#60645a'), rgb('#5d6157'), rgb('#5f6359'), rgb('#5b5f55')]
/** O aço nu onde a tinta gastou (arranhado pelo pneu): cinza, um nada mais claro. */
const ACO: Rgb = rgb('#6e706b')
/**
 * A terra pelos furos: parda e apagada, na luz de chão batido. Os furos são uns 14% da chapa, então a cor dela
 * entra no p95 da saturação: o marrom passa o azul por só 20 níveis.
 */
const TERRA: Rgb = rgb('#625a4e')
/** O fundo da fresta entre duas chapas. */
const FRESTA_COR: Rgb = rgb('#2a2c28')

/**
 * Os furos: o raio (casas), a distância de cada fileira à beira de cima da chapa (casas), o passo ao longo dela
 * (três por casa) e quantos por fileira. Os centros ficam a meio passo das pontas, e as fileiras de chapas vizinhas
 * (em fiada de duas casas, múltiplo do passo) alinham os furos em colunas, como na pista de verdade.
 */
const FURO_RAIO = 0.085
const FILEIRAS_DE_FUROS = { a: 0.27, b: 0.73 } as const
const FUROS_POR_CASA = 3
const FURO_PASSO = 1 / FUROS_POR_CASA
const FUROS_POR_FILEIRA = COMPRIMENTO * FUROS_POR_CASA
/** A borda dobrada do furo: a largura da dobra (casas), a inclinação dela e o quanto a luz pesa. */
const DOBRA = { largura: 0.035, inclinacao: 1.1, luz: 0.3 } as const
/**
 * A borda macia do furo (casas), o quanto a sombra da chapa anda para dentro dele e o quanto escurece a terra. A
 * sombra funda e larga é que faz o furo ler como furo, e não como covinha na chapa.
 */
const FURO_MACIO = 0.01
const FURO_SOMBRA = { passo: 0.05, escuro: 0.45 } as const

/** A nervura do meio: onde corre (casas da beira de cima), a meia largura, a inclinação e a luz. */
const NERVURA = { y: 0.5, meia: 0.05, inclinacao: 0.8, luz: 0.2 } as const

/** A fresta entre chapas e o chanfro da beira, em casas (o molde do Chão de metal, um nada mais largo). */
const FRESTA = { fio: 0.01, fim: 0.024, forca: 0.8 } as const
const CHANFRO = { largura: 0.05, fio: 0.018, luz: 0.06, sombra: 0.08 } as const

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** O centro (em casas, ao longo da chapa) do furo mais perto de `lx`. */
function centroDoFuro(lx: number): number {
  const k = Math.min(FUROS_POR_FILEIRA - 1, Math.max(0, Math.floor(lx / FURO_PASSO)))
  return (k + 0.5) * FURO_PASSO
}

/** A cor da chapa de pouso no ponto (u, v) do ladrilho. */
export function texturaChapaDePouso(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * CASAS
  const y = vv * CASAS
  const fileira = Math.floor(y / LARGURA)
  const ly = y - fileira * LARGURA
  // Em fiada: a fileira ímpar anda meia chapa.
  const xs = x + (fileira % 2) * FIADA
  const coluna = Math.floor(xs / COMPRIMENTO)
  const lx = xs - coluna * COMPRIMENTO
  const chapa = (fileira % FILEIRAS) * POR_FILEIRA + (coluna % POR_FILEIRA)

  // O aço da chapa: o tom dela, as manchas foscas, o gasto da tinta e a lama que o pneu espalhou.
  let c = TONS[Math.floor(hash(chapa, 0, 2701) * TONS.length) % TONS.length]
  c = luz(c, (hash(chapa, 1, 2701) - 0.5) * 0.03 + fbm(uu, vv, 12, 3, 2702) * 0.035 + (valor(uu * 448, vv * 448, 448, 2703) - 0.5) * 0.025)
  c = misturar(c, ACO, passoSuave(0.62, 0.88, fbm(uu, vv, 20, 3, 2704) * 0.5 + 0.5) * 0.45)
  c = misturar(c, TERRA, passoSuave(0.6, 0.9, fbm(uu, vv, 6, 3, 2705) * 0.5 + 0.5) * 0.35)

  // A nervura do meio, em relevo: o lado de cima pega a luz, o de baixo cai na sombra.
  const naNervura = ly - NERVURA.y
  if (Math.abs(naNervura) < NERVURA.meia) {
    const t = naNervura / NERVURA.meia
    c = luz(c, (luzNaInclinacao(0, -Math.sin(t * Math.PI) * NERVURA.inclinacao) - LUZ_NO_PLANO) * NERVURA.luz)
  }

  // O furo mais perto: o da fileira de cima ou o da de baixo, na mesma coluna.
  const dx = lx - centroDoFuro(lx)
  const dy = ly - (ly < NERVURA.y ? FILEIRAS_DE_FUROS.a : FILEIRAS_DE_FUROS.b)
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d < FURO_RAIO + DOBRA.largura) {
    // A dobra desce para dentro do furo: a inclinação aponta para fora dele.
    const nx = d > 0 ? dx / d : 0
    const ny = d > 0 ? dy / d : 0
    const inclinacao = DOBRA.inclinacao * passoSuave(FURO_RAIO + DOBRA.largura, FURO_RAIO, d)
    c = luz(c, (luzNaInclinacao(nx * inclinacao, ny * inclinacao) - LUZ_NO_PLANO) * DOBRA.luz)
    const furo = passoSuave(FURO_RAIO + FURO_MACIO, FURO_RAIO - FURO_MACIO, d)
    if (furo > 0) {
      // A terra lá embaixo, e a sombra da chapa caindo no lado de cima à esquerda do furo.
      const sx = dx - FURO_SOMBRA.passo
      const sy = dy - FURO_SOMBRA.passo
      const naSombra = passoSuave(FURO_RAIO - FURO_MACIO * 2, FURO_RAIO + FURO_MACIO, Math.sqrt(sx * sx + sy * sy))
      const terra = luz(TERRA, fbm(uu, vv, 32, 2, 2706) * 0.08 - naSombra * FURO_SOMBRA.escuro)
      c = misturar(c, terra, furo)
    }
  }

  // A beira da chapa: chanfro claro em cima e à esquerda, escuro do lado oposto, e a fresta.
  const claro = Math.min(lx, ly)
  const escuro = Math.min(COMPRIMENTO - lx, LARGURA - ly)
  c = luz(c, passoSuave(CHANFRO.largura, CHANFRO.fio, claro) * CHANFRO.luz - passoSuave(CHANFRO.largura, CHANFRO.fio, escuro) * CHANFRO.sombra)
  return empacotar(misturar(c, FRESTA_COR, passoSuave(FRESTA.fim, FRESTA.fio, Math.min(claro, escuro)) * FRESTA.forca))
}
