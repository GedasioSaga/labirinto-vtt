import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * AZULEJO (lote das referências, 15/11/2026: "azulejo quadrado verde (e branco)"; cartão Pisos de cerâmica): o chão
 * de banheiro, de copa e de enfermaria dos anos 1920. Azulejos quadrados de meia casa (quatro por casa, a junta na
 * linha da grade), vidrados: cada peça um nada fora do tom das vizinhas (fornada feita à mão), o vidrado mais grosso
 * logo dentro da beira e a beirada arredondada (a de cima à esquerda pega a luz, a de baixo à direita cai na sombra).
 * O rejunte é fino e claro, mais encardido numa parte do chão que noutra; um azulejo ou outro tem o canto lascado (o
 * biscoito fosco aparece) ou uma trinca de uma beira à outra.
 *
 * Diferente das vizinhas: as Lajotas são pedra fosca e irregular de uma casa; o Mármore é placa de uma casa com veio.
 * Aqui a peça é miúda e lisa, de cor chapada e brilho de vidro, e a junta é reta, fina e de cor (não de sombra).
 */

const CASAS = 8
/** Azulejos por casa, de cada lado: meia casa cada (75 cm na casa de 1,5 m), para a peça se ler na mesa. */
const POR_CASA = 2
const PECAS = CASAS * POR_CASA
/** O lado da peça, em casas. */
const LADO = 1 / POR_CASA

/** O rejunte, em casas a partir da beira da peça: até o `fio`, a cor dele inteira; no `fim`, o vidrado. */
const JUNTA = { fio: 0.006, fim: 0.02 } as const
/** A beirada arredondada: a faixa (casas) e quanto clareia do lado da luz e escurece do outro. */
const BEIRADA = { largura: 0.05, luz: 0.04 } as const
/** O vidrado mais grosso logo dentro da beirada: uma faixa estreita um nada mais funda. */
const VIDRADO_GROSSO = { de: 0.022, meio: 0.04, ate: 0.07, forca: 0.022 } as const
/** O quanto cada peça foge do tom dela (fornada) e as nuvens largas do vidrado. */
const VARIACAO_DA_PECA = 0.028
const NUVEM = 0.014
/** O grão fino do vidrado: quase nada, só para a peça não ser chapa de plástico de perto. */
const GRAO = 0.012
/** Canto lascado: a chance por canto e o raio (casas); a borda da lasca é roída. */
const LASCA = { chance: 0.05, menor: 0.022, maior: 0.05, roido: 0.3 } as const
/**
 * Trinca: a chance por peça, a meia largura do risco e do halo (casas), quanto escurece e o quanto serpenteia. Ela
 * nasce num ponto perto do meio da peça e corre só para um lado, até a beira: um risco que acaba no meio, não uma
 * barra de lado a lado (que, repetida, vira risco de régua no chão).
 */
const TRINCA = { chance: 0.014, miolo: 0.0035, halo: 0.01, forca: 0.24, onda: 0.01 } as const
/** O encardido: manchas largas do chão onde o rejunte escureceu (e a peça perde um tico de luz). */
const ENCARDIDO = { luzNaPeca: 0.022 } as const

export interface TomDoAzulejo {
  /** Os tons das peças (uma fornada só, vizinhos de poucos por cento). */
  readonly tons: readonly Rgb[]
  /** O rejunte limpo e o encardido. */
  readonly junta: Rgb
  readonly juntaSuja: Rgb
  /** O biscoito que aparece na lasca: fosco, sem o vidrado. */
  readonly biscoito: Rgb
  readonly semente: number
}

/**
 * O verde de azulejo antigo: verde-acinzentado médio, entre o sálvia e o celadon, nada de verde de bandeira (croma
 * ~0,15). Uma peça ou outra um nada mais azulada ou mais amarelada, como fornadas diferentes.
 */
const VERDE: TomDoAzulejo = {
  tons: [rgb('#7ea48b'), rgb('#81a78d'), rgb('#7aa088'), rgb('#84a88e'), rgb('#7ba28c'), rgb('#80a487')],
  junta: rgb('#c3c0b4'),
  juntaSuja: rgb('#a29e91'),
  biscoito: rgb('#bdb3a1'),
  semente: 6100,
}

/**
 * O branco de azulejo: gelo, nunca branco puro (o maior canal fica em ~220, o teto é 245), uma peça um nada mais
 * creme. O rejunte é cinza para a grade se ler no branco.
 */
const BRANCO: TomDoAzulejo = {
  tons: [rgb('#d9d8d1'), rgb('#dbd9d2'), rgb('#d6d5ce'), rgb('#dad7ce'), rgb('#d8d8d2'), rgb('#d7d5cc')],
  junta: rgb('#aeaba1'),
  juntaSuja: rgb('#949086'),
  biscoito: rgb('#c4b8a4'),
  semente: 6200,
}

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/**
 * Quanto a trinca da peça escurece o ponto (lx, ly), em fração da peça: o risco torto que sai de um ponto perto do
 * meio e corre para um lado só, afinando até sumir no ponto de partida.
 */
function trinca(peca: number, semente: number, lx: number, ly: number, uu: number, vv: number): number {
  let rx = hash(peca, 40, semente) - 0.5
  let ry = hash(peca, 41, semente) - 0.5
  const tamanho = Math.sqrt(rx * rx + ry * ry) || 1
  rx /= tamanho
  ry /= tamanho
  const ox = 0.3 + 0.4 * hash(peca, 42, semente)
  const oy = 0.3 + 0.4 * hash(peca, 43, semente)
  // Ao longo do risco (a partir do ponto de partida) e de través; serpenteia um nada (ruído do ladrilho: segue a volta).
  const aoLongo = (lx - ox) * rx + (ly - oy) * ry
  const onda = (valor(uu * 96, vv * 96, 96, semente + 7) - 0.5) * 2 * TRINCA.onda
  const d = Math.abs(Math.abs((lx - ox) * ry - (ly - oy) * rx) * LADO + onda)
  const corre = passoSuave(0, 0.25, aoLongo)
  return (passoSuave(TRINCA.halo, TRINCA.miolo, d) * 0.35 + passoSuave(TRINCA.miolo * 2, TRINCA.miolo * 0.5, d) * 0.65) * TRINCA.forca * corre
}

function azulejoNoTom(tom: TomDoAzulejo): (u: number, v: number) => number {
  const s = tom.semente
  return (u, v) => {
    const uu = naVolta(u)
    const vv = naVolta(v)
    const x = uu * PECAS
    const y = vv * PECAS
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const peca = (iy % PECAS) * PECAS + (ix % PECAS)
    const lx = x - ix
    const ly = y - iy
    // A distância (casas) às quatro beiras: as de cima e da esquerda pegam a luz.
    const cima = Math.min(lx, ly) * LADO
    const baixo = Math.min(1 - lx, 1 - ly) * LADO
    const borda = Math.min(cima, baixo)

    let c = tom.tons[Math.floor(hash(peca, 0, s) * tom.tons.length) % tom.tons.length]
    // A fornada e as nuvens do vidrado (o ruído de cada peça é o do ladrilho deslocado por ela).
    const ou = hash(peca, 1, s)
    const ov = hash(peca, 2, s)
    let k = (hash(peca, 3, s) - 0.5) * 2 * VARIACAO_DA_PECA
    k += fbm(uu + ou, vv + ov, 8, 3, s + 1) * NUVEM
    k += (valor(uu * 384, vv * 384, 384, s + 2) - 0.5) * GRAO
    // O vidrado grosso logo dentro da beira, e a beirada arredondada.
    k -= passoSuave(VIDRADO_GROSSO.de, VIDRADO_GROSSO.meio, borda) * passoSuave(VIDRADO_GROSSO.ate, VIDRADO_GROSSO.meio, borda) * VIDRADO_GROSSO.forca
    k += (passoSuave(BEIRADA.largura, 0, cima) - passoSuave(BEIRADA.largura, 0, baixo)) * BEIRADA.luz
    // O encardido do chão (largo, segue a volta do ladrilho).
    const encardido = passoSuave(-0.25, 0.65, fbm(uu, vv, 3, 3, s + 3))
    k -= encardido * ENCARDIDO.luzNaPeca
    c = luz(c, k)

    // A lasca num canto: o biscoito fosco, sem a beirada de vidro.
    const canto = (lx < 0.5 ? 0 : 1) + (ly < 0.5 ? 0 : 2)
    if (hash(peca, 10 + canto, s) < LASCA.chance) {
      const dx = (lx < 0.5 ? lx : 1 - lx) * LADO
      const dy = (ly < 0.5 ? ly : 1 - ly) * LADO
      const raio = LASCA.menor + (LASCA.maior - LASCA.menor) * hash(peca, 20 + canto, s)
      const roido = 1 + (valor(uu * 192, vv * 192, 192, s + 4) - 0.5) * 2 * LASCA.roido
      const dentro = passoSuave(raio * roido, raio * roido * 0.82, Math.sqrt(dx * dx + dy * dy))
      c = misturar(c, tom.biscoito, dentro * 0.85)
    }

    // A trinca, rara.
    if (hash(peca, 30, s) < TRINCA.chance) c = luz(c, -trinca(peca, s, lx, ly, uu, vv))

    // O rejunte: limpo ou encardido, conforme a mancha larga do chão.
    const junta = misturar(tom.junta, tom.juntaSuja, encardido)
    return empacotar(misturar(c, junta, passoSuave(JUNTA.fim, JUNTA.fio, borda)))
  }
}

/** Azulejo verde: a primeira forma do cartão Pisos de cerâmica. */
export const texturaAzulejoVerde = azulejoNoTom(VERDE)
/** Azulejo branco. */
export const texturaAzulejoBranco = azulejoNoTom(BRANCO)
