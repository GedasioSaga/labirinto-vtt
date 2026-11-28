import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * TABULEIRO (L03 do plano de arte por tema, 28/11/2026; cartão "Tabuleiro", 5 formas): o chão da sala de xadrez
 * gigante. Uma casa do mapa é uma casa do tabuleiro: o quadrado cai na grade (o filete na linha da grade), e a peça
 * de xadrez gigante (o objeto `pecaDeXadrez`) pousa inteira numa casa. As formas:
 * - MÁRMORE: marfim contra cinza-azulado (o mármore bardiglio), polido, com os veios macios de cada placa;
 * - MADEIRA: a marchetaria de bordo e nogueira, o veio de cada casa de través do veio da vizinha;
 * - JARDIM: lajes de arenito e quadrados de grama aparada, o tabuleiro do jardim do palácio;
 * - VERMELHO: pórfiro vermelho e ardósia negra, o tabuleiro de damas do salão;
 * - DIAGONAL: a lajota de masmorra assentada a 45° (a "lajota em diagonal" do tema Masmorra): o losango do meio da
 *   casa num tom, o do canto no outro, a junta suja, a pedra gasta, rachada e lascada.
 *
 * Contido de propósito (a régua de `embutidas.test.ts`: o desvio da luz vai até 0,09 e, no xadrez, metade do chão é
 * de cada tom): os dois tons de cada forma ficam a 0,11-0,14 de luz um do outro, e o que separa as casas é mais a cor
 * (quente contra fria, pedra contra grama, vermelho contra negro). Por isso nenhum tabuleiro é preto e branco.
 *
 * A emenda do ladrilho cai numa linha da grade, entre duas casas de tom diferente. Nas quatro formas retas o filete
 * cobre sozinho o pixel de cada lado da linha (no ladrilho de 1024 medido na metade, o pixel da beira fica a 1/128 de
 * casa dela), e a emenda não aparece. Na diagonal a linha da grade passa no meio do losango do canto, e o losango é o
 * mesmo dos dois lados.
 */

const CASAS = 8
/** O filete das formas retas, em casas a partir da linha da grade: até o `fio`, só ele; no `fim`, a casa. */
const FILETE = { fio: 0.0105, fim: 0.022 } as const
/** A beirada de cada casa: a faixa (casas) e quanto clareia em cima à esquerda e escurece embaixo à direita. */
const BEIRADA = { largura: 0.045, luz: 0.03 } as const

const SEMENTE_DO_MARMORE = 9101
const SEMENTE_DA_MADEIRA = 9121
const SEMENTE_DO_JARDIM = 9141
const SEMENTE_DO_VERMELHO = 9161
const SEMENTE_DA_DIAGONAL = 9181

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** O tom sorteado de uma casa (ou losango) entre os da lista. */
function tomDa(n: number, tons: readonly Rgb[], semente: number): Rgb {
  return tons[Math.floor(hash(n, 0, semente) * tons.length) % tons.length]
}

interface Casa {
  /** O número da casa no ladrilho (0 a 63): o que sorteia o tom e o desenho dela. */
  readonly n: number
  readonly escura: boolean
  /** O ponto dentro da casa, de 0 a 1. */
  readonly lx: number
  readonly ly: number
  /** O ponto no ladrilho, de 0 a 1. */
  readonly uu: number
  readonly vv: number
}

function casaEm(u: number, v: number): Casa {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const ix = Math.min(CASAS - 1, Math.floor(uu * CASAS))
  const iy = Math.min(CASAS - 1, Math.floor(vv * CASAS))
  return { n: iy * CASAS + ix, escura: (ix + iy) % 2 === 1, lx: uu * CASAS - ix, ly: vv * CASAS - iy, uu, vv }
}

/** A casa pronta `c` com a beirada (clara em cima à esquerda, funda embaixo à direita) e o filete na linha da grade. */
function acabar(c: Rgb, k: Casa, filete: Rgb, beirada: number): number {
  const cima = Math.min(k.lx, k.ly)
  const baixo = Math.min(1 - k.lx, 1 - k.ly)
  const comBeira = luz(c, (passoSuave(BEIRADA.largura, 0, cima) - passoSuave(BEIRADA.largura, 0, baixo)) * BEIRADA.luz * beirada)
  return empacotar(misturar(comBeira, filete, passoSuave(FILETE.fim, FILETE.fio, Math.min(cima, baixo))))
}

/** O filete com as nuvens dele (o ruído do ladrilho, que segue de casa em casa). */
function fileteCom(base: Rgb, k: Casa, semente: number): Rgb {
  return luz(base, fbm(k.uu, k.vv, 16, 2, semente) * 0.04)
}

/** A distância (casas) do ponto (lx, ly) ao veio mais perto da família que corre no rumo (rx, ry), torcida por `onda`. */
function distanciaAoVeio(lx: number, ly: number, rx: number, ry: number, frequencia: number, fase: number, onda: number): number {
  const campo = (lx * rx + ly * ry) * frequencia + fase + onda
  return Math.abs(campo - Math.round(campo)) / frequencia
}

/** Quanto do veio cobre o ponto a `d` casas do meio dele: miolo forte e fino, halo fraco e largo. */
function veioNaDistancia(d: number, grossura: number): number {
  return passoSuave(0.012 * grossura, 0, d) * 0.3 + passoSuave(0.1 * grossura, 0, d) * 0.12
}

/** O veio macio de uma placa de pedra polida (a conta de `marmore.ts`): 0 fora dele, até ~0,4 no miolo. */
function veioDaPlaca(k: Casa, semente: number, frequencia: number): number {
  const ou = hash(k.n, 1, semente)
  const ov = hash(k.n, 2, semente)
  let rx = hash(k.n, 3, semente) - 0.5
  let ry = hash(k.n, 4, semente) - 0.5
  // Quase reto vira diagonal: o veio atravessa a placa e não corre rente ao filete.
  if (Math.abs(rx) < 0.12) rx = rx < 0 ? -0.3 : 0.3
  if (Math.abs(ry) < 0.12) ry = ry < 0 ? -0.3 : 0.3
  const tamanho = Math.sqrt(rx * rx + ry * ry)
  const onda = fbm(k.uu + ou, k.vv + ov, 3, 2, semente + 1) * 0.9
  const grossura = 0.6 + 0.9 * valor((k.uu + ou) * 24, (k.vv + ov) * 24, 24, semente + 2)
  const presenca = passoSuave(0.1, 0.4, valor((k.uu + ov) * 12, (k.vv + ou) * 12, 12, semente + 3))
  const d = distanciaAoVeio(k.lx, k.ly, rx / tamanho, ry / tamanho, frequencia * (0.8 + 0.5 * hash(k.n, 5, semente)), hash(k.n, 6, semente), onda)
  return veioNaDistancia(d, grossura) * presenca
}

// ---------- mármore ----------

const MARMORE = {
  /** O marfim: branco-acinzentado quente, nunca branco puro. */
  claro: [rgb('#cfcabf'), rgb('#d1ccc1'), rgb('#ccc7bb'), rgb('#cfc8bd')],
  /** O bardiglio: cinza-azulado, frio. */
  escuro: [rgb('#a6aaab'), rgb('#a3a8aa'), rgb('#a8abab'), rgb('#a2a6a8')],
  veioDoClaro: rgb('#938f88'),
  veioDoEscuro: rgb('#7f868b'),
  filete: rgb('#8b8883'),
} as const

export function texturaTabuleiroMarmore(u: number, v: number): number {
  const k = casaEm(u, v)
  const s = SEMENTE_DO_MARMORE
  let c = tomDa(k.n, k.escura ? MARMORE.escuro : MARMORE.claro, s)
  // As nuvens da pedra, largas e fracas; no bardiglio, um nada mais marcadas (a pedra é "nublada").
  c = luz(c, fbm(k.uu + hash(k.n, 7, s), k.vv + hash(k.n, 8, s), 6, 3, s + 10) * (k.escura ? 0.03 : 0.02))
  c = misturar(c, k.escura ? MARMORE.veioDoEscuro : MARMORE.veioDoClaro, veioDaPlaca(k, s + 20, 1.2))
  return acabar(c, k, fileteCom(MARMORE.filete, k, s + 30), 1)
}

// ---------- madeira ----------

const MADEIRA = {
  /** O bordo: mel claro. */
  claro: [rgb('#c29d71'), rgb('#c4a073'), rgb('#bf9a6e'), rgb('#c09c73')],
  /** A nogueira: castanho médio (a régua não deixa a nogueira escura de verdade). */
  escuro: [rgb('#a07956'), rgb('#9d7654'), rgb('#a27b58'), rgb('#9e7857')],
  filete: rgb('#7a604a'),
} as const
/** Os anéis do veio: quantos por casa, de través, e quanto clareiam e escurecem. */
const ANEIS_POR_CASA = 9
const FORCA_DO_ANEL = 0.07
/** O lenho tardio: a faixa mais funda do anel. */
const LENHO_TARDIO = { de: 0.64, ate: 0.82, forca: 0.05 } as const

export function texturaTabuleiroMadeira(u: number, v: number): number {
  const k = casaEm(u, v)
  const s = SEMENTE_DA_MADEIRA
  let c = tomDa(k.n, k.escura ? MADEIRA.escuro : MADEIRA.claro, s)
  // A marchetaria vira a lâmina de casa em casa: o veio corre de lado nas claras e de cima a baixo nas escuras.
  const ao = k.escura ? k.ly : k.lx
  const de = k.escura ? k.lx : k.ly
  const ou = hash(k.n, 1, s) * 64
  const ov = hash(k.n, 2, s) * 64
  // O anel curva devagar ao longo da lâmina (a árvore não cresce reta).
  const curva = (valor(ao * 1.6 + ou, ov, 4096, s + 1) - 0.5) * 0.4
  const anel = valor(ou + ao * 0.35, (de + curva) * ANEIS_POR_CASA + ov, 4096, s + 2)
  c = luz(c, (anel - 0.5) * FORCA_DO_ANEL - passoSuave(LENHO_TARDIO.de, LENHO_TARDIO.ate, anel) * LENHO_TARDIO.forca)
  // A lâmina não é igual de ponta a ponta, e o verniz gastou mais onde se pisa.
  c = luz(c, (valor(ao * 2 + ov, de * 2 + ou, 4096, s + 3) - 0.5) * 0.04 + fbm(k.uu, k.vv, 4, 2, s + 4) * 0.015)
  return acabar(c, k, fileteCom(MADEIRA.filete, k, s + 5), 0.7)
}

// ---------- jardim ----------

const JARDIM = {
  /** O arenito das lajes: cinza-areia. */
  laje: [rgb('#a9a292'), rgb('#aca493'), rgb('#a6a090'), rgb('#aaa395')],
  /** O líquen na laje: manchas cinza-amareladas, poucas e fracas. */
  liquen: rgb('#9f9c7c'),
  /** A grama aparada: o tom do meio, o da touceira funda e o da ponta ao sol. */
  grama: rgb('#748f4f'),
  gramaFunda: rgb('#66824a'),
  gramaClara: rgb('#819957'),
  /** A terra na fresta entre a laje e a grama. */
  terra: rgb('#6d634f'),
} as const
/** A grama que avança sobre a beira da laje: até onde (casas) e o quanto o ruído torce a beira. */
const GRAMA_NA_BEIRA = { ate: 0.035, torce: 0.03 } as const
/** A sombra da laje na grama (a laje é um nada mais alta): a faixa (casas) e a força, nos lados de cima e da esquerda. */
const SOMBRA_DA_LAJE = { largura: 0.07, forca: 0.07 } as const

function gramaEm(k: Casa, s: number): Rgb {
  const touceira = fbm(k.uu, k.vv, 40, 3, s + 1)
  const sol = fbm(k.uu, k.vv, 12, 2, s + 2)
  let c = misturar(JARDIM.grama, JARDIM.gramaFunda, passoSuave(0.05, 0.6, touceira))
  c = misturar(c, JARDIM.gramaClara, passoSuave(0.1, 0.7, sol) * 0.6)
  return luz(c, (valor(k.uu * 512, k.vv * 512, 512, s + 3) - 0.5) * 0.03)
}

export function texturaTabuleiroJardim(u: number, v: number): number {
  const k = casaEm(u, v)
  const s = SEMENTE_DO_JARDIM
  const cima = Math.min(k.lx, k.ly)
  const borda = Math.min(cima, 1 - k.lx, 1 - k.ly)
  if (k.escura) {
    // A grama, na sombra das lajes vizinhas de cima e da esquerda (a luz vem de cima à esquerda).
    const c = luz(gramaEm(k, s), -passoSuave(SOMBRA_DA_LAJE.largura, 0, cima) * SOMBRA_DA_LAJE.forca)
    return acabar(c, k, fileteCom(JARDIM.terra, k, s + 4), 0)
  }
  let c = tomDa(k.n, JARDIM.laje, s)
  // O grão do arenito e as nuvens da pedra; uma mancha de líquen numa laje ou outra.
  c = luz(c, fbm(k.uu + hash(k.n, 5, s), k.vv + hash(k.n, 6, s), 8, 3, s + 7) * 0.035 + (valor(k.uu * 384, k.vv * 384, 384, s + 8) - 0.5) * 0.03)
  const liquen = passoSuave(0.45, 0.75, fbm(k.uu + hash(k.n, 9, s), k.vv, 10, 3, s + 11)) * (hash(k.n, 10, s) < 0.45 ? 0.5 : 0)
  c = misturar(c, JARDIM.liquen, liquen)
  // A grama vizinha avança sobre a beira da laje, torta.
  const avanco = GRAMA_NA_BEIRA.ate + fbm(k.uu, k.vv, 64, 2, s + 12) * GRAMA_NA_BEIRA.torce
  c = misturar(c, gramaEm(k, s), passoSuave(avanco, avanco - 0.012, borda))
  return acabar(c, k, fileteCom(JARDIM.terra, k, s + 4), 1.3)
}

// ---------- vermelho ----------

const VERMELHO = {
  /** O pórfiro: vermelho de tijolo velho, não de tinta. */
  vermelho: [rgb('#9b5343'), rgb('#985142'), rgb('#9e5545'), rgb('#964f41')],
  /** A ardósia: negro-acinzentado. */
  negro: [rgb('#403c3b'), rgb('#3e3b3c'), rgb('#423e3c'), rgb('#3d3a3a')],
  /** O veio claro do pórfiro e a nuvem da ardósia. */
  veio: rgb('#b47c68'),
  nuvem: rgb('#4c4847'),
  filete: rgb('#2f2b2a'),
} as const

export function texturaTabuleiroVermelho(u: number, v: number): number {
  const k = casaEm(u, v)
  const s = SEMENTE_DO_VERMELHO
  let c = tomDa(k.n, k.escura ? VERMELHO.negro : VERMELHO.vermelho, s)
  const nuvens = fbm(k.uu + hash(k.n, 7, s), k.vv + hash(k.n, 8, s), 6, 3, s + 1)
  if (k.escura) {
    // A ardósia polida: só a nuvem larga e mansa.
    c = misturar(c, VERMELHO.nuvem, passoSuave(0.1, 0.8, nuvens) * 0.7)
  } else {
    c = luz(c, nuvens * 0.035)
    c = misturar(c, VERMELHO.veio, veioDaPlaca(k, s + 20, 0.9) * 0.6)
  }
  return acabar(c, k, fileteCom(VERMELHO.filete, k, s + 30), 1.2)
}

// ---------- diagonal ----------

const DIAGONAL = {
  /** O losango do meio da casa: cinza quente de pedra. */
  meio: [rgb('#8c857a'), rgb('#89837a'), rgb('#8f877b'), rgb('#86807a')],
  /** O losango do canto: cinza-esverdeado, mais fundo. */
  canto: [rgb('#6b6c66'), rgb('#696a65'), rgb('#6e6e68'), rgb('#676964')],
  junta: rgb('#5a544c'),
  sujeira: rgb('#514c45'),
  racha: rgb('#47433e'),
} as const
/** A junta, em casas a partir da beira do losango (perpendicular): até o `fio`, só ela; no `fim`, a pedra. */
const JUNTA = { fio: 0.006, fim: 0.02 } as const
/** A sujeira que junta perto da junta e o ombro gasto da pedra (casas, a partir da beira). */
const SUJEIRA = { largura: 0.07, forca: 0.3 } as const
const OMBRO = { largura: 0.05, luz: 0.05 } as const
/** A rachadura: a chance por losango, a meia largura do miolo e do halo (casas). */
const RACHA = { chance: 0.3, miolo: 0.005, halo: 0.02 } as const
/** O canto lascado: a chance por vértice e o raio (casas). */
const LASCA = { chance: 0.18, raio: [0.035, 0.07] as const } as const
/** Meio losango, de vértice a centro (casas): o losango tem uma casa de diagonal. */
const MEIO_LOSANGO = 0.5

/** A rachadura do losango `n` no ponto local (a, b): 0 fora dela, até 1 no miolo. */
function rachaEm(n: number, a: number, b: number, uu: number, vv: number, s: number): number {
  if (hash(n, 20, s) >= RACHA.chance) return 0
  const angulo = hash(n, 21, s) * Math.PI
  const nx = -Math.sin(angulo)
  const ny = Math.cos(angulo)
  const torta = fbm(uu, vv, 24, 2, s + 22) * 0.03
  const d = Math.abs((a - (hash(n, 23, s) - 0.5) * 0.25) * nx + (b - (hash(n, 24, s) - 0.5) * 0.25) * ny + torta)
  // A rachadura não corre a pedra toda: some antes de uma das pontas.
  const ao = a * ny - b * nx
  const ate = passoSuave(0.32, 0.1, ao * (hash(n, 25, s) < 0.5 ? 1 : -1))
  return (passoSuave(RACHA.miolo, 0, d) * 0.8 + passoSuave(RACHA.halo, 0, d) * 0.2) * ate
}

export function texturaTabuleiroDiagonal(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * CASAS
  const y = vv * CASAS
  const s = SEMENTE_DA_DIAGONAL
  // O losango do meio da casa ou, fora dele, o do canto da grade mais perto (o número segue a volta do ladrilho).
  let cx = Math.floor(x) + 0.5
  let cy = Math.floor(y) + 0.5
  let doMeio = Math.abs(x - cx) + Math.abs(y - cy) <= MEIO_LOSANGO
  if (!doMeio) {
    cx = Math.round(x)
    cy = Math.round(y)
  }
  const dx = x - cx
  const dy = y - cy
  const m = Math.abs(dx) + Math.abs(dy)
  const ix = ((Math.floor(cx) % CASAS) + CASAS) % CASAS
  const iy = ((Math.floor(cy) % CASAS) + CASAS) % CASAS
  const n = (iy * CASAS + ix) * 2 + (doMeio ? 0 : 1)
  // A distância à beira do losango, de través (a beira corre a 45°).
  const beira = (MEIO_LOSANGO - Math.min(m, MEIO_LOSANGO)) * Math.SQRT1_2
  // O ponto no losango deitado de volta: a e b correm ao longo dos lados.
  const a = (dx + dy) * Math.SQRT1_2
  const b = (dy - dx) * Math.SQRT1_2

  let c = tomDa(n, doMeio ? DIAGONAL.meio : DIAGONAL.canto, s)
  c = luz(c, fbm(uu, vv, 12, 3, s + 1) * 0.045 + (hash(n, 2, s) - 0.5) * 0.04 + (valor(uu * 320, vv * 320, 320, s + 3) - 0.5) * 0.035)
  // O ombro gasto: a beira de cima à esquerda pega a luz, a de baixo à direita cai na sombra.
  const lado = m > 0 ? -(dx + dy) / m : 0
  c = luz(c, passoSuave(OMBRO.largura, 0, beira) * OMBRO.luz * lado)
  c = misturar(c, DIAGONAL.sujeira, passoSuave(SUJEIRA.largura, 0, beira) * SUJEIRA.forca * (0.6 + 0.4 * fbm(uu, vv, 20, 2, s + 4)))
  c = misturar(c, DIAGONAL.racha, rachaEm(n, a, b, uu, vv, s))
  // O canto lascado: a junta toma o vértice.
  let junta = passoSuave(JUNTA.fim, JUNTA.fio, beira)
  const vertices: readonly (readonly [number, number])[] = [[-MEIO_LOSANGO, 0], [MEIO_LOSANGO, 0], [0, -MEIO_LOSANGO], [0, MEIO_LOSANGO]]
  vertices.forEach(([vx, vy], i) => {
    if (hash(n, 30 + i, s) >= LASCA.chance) return
    const raio = LASCA.raio[0] + (LASCA.raio[1] - LASCA.raio[0]) * hash(n, 40 + i, s)
    const d = Math.hypot(dx - vx, dy - vy)
    junta = Math.max(junta, passoSuave(raio, raio - 0.012, d))
  })
  return empacotar(misturar(c, luz(DIAGONAL.junta, fbm(uu, vv, 16, 2, s + 5) * 0.05), junta))
}
