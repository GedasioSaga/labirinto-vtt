import { empacotar, fbm, hash, luz, luzNaInclinacao, LUZ_NO_PLANO, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * PISO DE MASMORRA (lista de 24/11/2026, item 111; a 3ª forma do cartão Lajotas de pedra, depois da Clara e da
 * Escura; junta a "laje de masmorra" do mapa 2): lajes de pedra cinza-parda de TAMANHOS DIFERENTES, de três quartos
 * de casa a uma casa e meia de lado, assentadas sem fiada, num rejunte LARGO e escuro. O chão é velho: cada laje cedeu
 * um nada para um lado, a beira está gasta e redonda (o ombro de cima à esquerda pega a luz), uma ou outra laje é de
 * outra pedra (mais parda ou mais fria), a umidade esverdeia de musgo alguns cantos onde as lajes se encontram (só
 * numa parte do chão, e o rejunte dali fica mais escuro) e uma ou outra laje está rachada.
 *
 * A arrumação: a grade de quartos de casa do ladrilho (32 x 32) é preenchida em ordem, linha a linha; cada laje
 * sorteia a largura e a altura dela (3 a 6 quartos) e encolhe até caber no que está livre. A sobra de uma fileira
 * até o próximo vizinho nunca é menor que a menor laje, e a grade dá a volta: a laje da beira encosta na do outro
 * lado da emenda, e o ladrilho repete sem costura.
 *
 * Diferente das vizinhas: as Lajotas (clara e escura) são retângulos iguais em fiada, de junta fina; a Laje de
 * templo é arenito bege de 2 x 2 casas; o Paralelepípedo é granito em fileira reta.
 */

const CASAS = 8
/** A grade das lajes: quartos de casa. */
const QUARTOS_POR_CASA = 4
const N = CASAS * QUARTOS_POR_CASA
const QUARTO = 1 / QUARTOS_POR_CASA
/**
 * Os lados que a laje sorteia, em quartos de casa (três quartos a uma casa e meia). Sem meia casa: as lasquinhas de
 * meia casa picotavam o desenho (revisão do diretor de arte, 24/11/2026).
 */
const LADOS: readonly number[] = [3, 4, 4, 5, 6]
const LADO_MINIMO = 3
const LADO_MAXIMO = 6
/** Até onde a arrumação olha a sobra livre: o maior lado e mais o menor (a sobra que ainda vira laje). */
const OLHAR = LADO_MAXIMO + LADO_MINIMO
const SEMENTE = 11100

/** Meia junta de cada laje, em casas: o rejunte largo (somando as duas lajes, 5 a 7 cm de pedra de 1,5 m). */
const MEIA_JUNTA = [0.026, 0.036] as const
/** O raio do canto gasto, em casas. */
const CANTO = [0.03, 0.08] as const
/** O quanto a borda serpenteia (gasta e lascada), em casas; sempre menor que a meia junta. */
const TORCAO = { larga: 0.011, miuda: 0.005 } as const
/** O ombro gasto: da borda até `largura` casas para dentro a laje desce; a inclinação na borda (o volume a 32 px). */
const OMBRO = { largura: 0.07, inclinacao: 0.42 } as const
/** Cada laje cedeu um nada para um lado. */
const TORTO = 0.05
/** O quanto o tom de cada laje foge do tom dela (para mais e para menos). */
const VARIACAO_DA_LAJE = 0.09
const LUZ_DO_RELEVO = 0.24
/** A passagem macia da laje para o rejunte, em casas a partir da borda. */
const PASSAGEM = { dentro: -0.014, fora: 0.01 } as const
/** A sujeira na beira da laje: até onde entra, em casas, e quanto escurece. */
const POEIRA = { largura: 0.12, forca: 0.05 } as const
/**
 * A umidade dos cantos: até onde chega do canto (casas), quanto escurece, quanto puxa para o verde-musgo e em quantos
 * cantos da parte molhada ela pega (por canto: as lajes que dividem o canto veem o mesmo sorteio). Em todo canto, a
 * mancha virava um X preto em grade, de fuligem e não de musgo.
 */
const UMIDADE = { alcance: 0.22, escuro: 0.1, tinta: 0.6, chance: 0.4 } as const
const CHANCE_DE_RACHA = 0.24
/** A racha: meia largura do miolo e do halo, em casas, e quanto cada um puxa para a cor da racha. */
const RACHA = { miolo: 0.01, halo: 0.032, forcaMiolo: 0.62, forcaHalo: 0.16 } as const
/** Ruído de valor sem período: para o que é medido dentro da laje e não no ladrilho. */
const SEM_PERIODO = 1 << 20

/** Pedra cinza-parda de masmorra, entre a Lajota clara (#cdc8bc) e a escura (#4a4946): croma abaixo de 0,04. */
const TONS: readonly Rgb[] = [rgb('#5f5c57'), rgb('#625e58'), rgb('#5a5853'), rgb('#64605a'), rgb('#5c5a56'), rgb('#605b55')]
/**
 * Os tons de fora (uma laje de outra pedreira): o pardo-quente e o frio, cada um numa laje em umas catorze. Mais que
 * isso, o chão vira colcha de retalhos.
 */
const DE_FORA: readonly Rgb[] = [rgb('#67604f'), rgb('#575b5c')]
const CHANCE_DE_FORA = 0.07
/** O rejunte: terra escura e encardida, nunca preta. */
const COR_DA_JUNTA = rgb('#2e2b28')
/** O rejunte onde o chão é úmido: mais fundo, um nada esverdeado. */
const JUNTA_UMIDA = rgb('#272a26')
/** O canto úmido: a pedra molhada puxa para um verde-musgo que se vê (e não para o preto). */
const UMIDO = rgb('#4a5244')
const COR_DA_RACHA = rgb('#2f2c29')

interface Laje {
  readonly x: number
  readonly y: number
  readonly largura: number
  readonly altura: number
}

interface Arrumacao {
  /** A laje de cada quarto de casa da grade (índice em `lajes`). */
  readonly dono: Int32Array
  readonly lajes: readonly Laje[]
}

let pronta: Arrumacao | null = null

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function volta(n: number): number {
  const r = n % N
  return r < 0 ? r + N : r
}

function livre(dono: Int32Array, x: number, y: number): boolean {
  return dono[volta(y) * N + volta(x)] < 0
}

function fileiraLivre(dono: Int32Array, x: number, y: number, largura: number): boolean {
  for (let i = 0; i < largura; i += 1) if (!livre(dono, x + i, y)) return false
  return true
}

/**
 * O lado da laje: o que sobra quando cabe numa laje só; senão o sorteado, sem deixar sobra menor que a menor laje
 * (a laje encolhe e a sobra vira uma laje de três quartos).
 */
function ladoSorteado(sorteio: number, livres: number): number {
  if (livres <= LADO_MAXIMO) return livres
  const lado = LADOS[Math.floor(sorteio * LADOS.length) % LADOS.length]
  const sobra = livres - lado
  return sobra > 0 && sobra < LADO_MINIMO ? livres - LADO_MINIMO : lado
}

/** As lajes do ladrilho, arrumadas uma vez (preguiçosa, como as emendas da Madeira velha). */
function arrumacao(): Arrumacao {
  if (pronta !== null) return pronta
  const dono = new Int32Array(N * N).fill(-1)
  const lajes: Laje[] = []
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      if (!livre(dono, x, y)) continue
      let emX = 0
      while (emX < OLHAR && livre(dono, x + emX, y)) emX += 1
      const largura = ladoSorteado(hash(x, y, SEMENTE), emX)
      let emY = 0
      while (emY < OLHAR && fileiraLivre(dono, x, y + emY, largura)) emY += 1
      const altura = ladoSorteado(hash(x, y, SEMENTE + 1), emY)
      const k = lajes.length
      for (let j = 0; j < altura; j += 1) for (let i = 0; i < largura; i += 1) dono[volta(y + j) * N + volta(x + i)] = k
      lajes.push({ x, y, largura, altura })
    }
  }
  pronta = { dono, lajes }
  return pronta
}

/**
 * A racha da laje no ponto (px, py) dela, em casas a partir do meio: de 0 (nada) a 1 (o fundo da racha). Uma linha
 * torta que passa perto do meio, num rumo sorteado, e afina até sumir na ponta (a da Laje de templo, na laje menor).
 */
function racha(px: number, py: number, meiaL: number, meiaA: number, laje: number): number {
  if (hash(laje, 10, SEMENTE) >= CHANCE_DE_RACHA) return 0
  const ox = (hash(laje, 11, SEMENTE) - 0.5) * meiaL
  const oy = (hash(laje, 12, SEMENTE) - 0.5) * meiaA
  let rx = hash(laje, 13, SEMENTE) - 0.5
  let ry = hash(laje, 14, SEMENTE) - 0.5
  if (Math.abs(rx) + Math.abs(ry) < 0.2) rx = 0.4
  const tamanho = Math.sqrt(rx * rx + ry * ry)
  rx /= tamanho
  ry /= tamanho
  const ao = (px - ox) * rx + (py - oy) * ry
  const atravessado =
    (px - ox) * -ry + (py - oy) * rx + (valor(ao * 6, laje, SEM_PERIODO, SEMENTE + 20) - 0.5) * 0.07 + (valor(ao * 22, laje, SEM_PERIODO, SEMENTE + 21) - 0.5) * 0.016
  // Meia racha (só de um lado do ponto) ou de lado a lado; afina perto da ponta.
  const comprimento = (0.5 + hash(laje, 15, SEMENTE) * 0.7) * Math.sqrt(meiaL * meiaL + meiaA * meiaA)
  const ponta = hash(laje, 16, SEMENTE) < 0.5 ? Math.abs(ao) : Math.max(ao, -ao * 0.15)
  const grossura = 1 - passoSuave(comprimento * 0.55, comprimento, ponta)
  if (grossura <= 0) return 0
  const d = Math.abs(atravessado)
  return passoSuave(RACHA.miolo * grossura, 0, d) * RACHA.forcaMiolo + passoSuave(RACHA.halo * grossura, 0, d) * RACHA.forcaHalo
}

/** A cor do piso de masmorra no ponto (u, v) do ladrilho de 8 casas. */
export function texturaPisoDeMasmorra(u: number, v: number): number {
  const { dono, lajes } = arrumacao()
  const uu = naVolta(u)
  const vv = naVolta(v)
  const qx = uu * N
  const qy = vv * N
  const k = dono[Math.min(N - 1, Math.floor(qy)) * N + Math.min(N - 1, Math.floor(qx))]
  const laje = lajes[k]
  // O ponto na laje, em casas a partir do meio dela (a laje da beira dá a volta no ladrilho).
  const lx = qx - laje.x < 0 ? qx - laje.x + N : qx - laje.x
  const ly = qy - laje.y < 0 ? qy - laje.y + N : qy - laje.y
  const meiaL = (laje.largura * QUARTO) / 2
  const meiaA = (laje.altura * QUARTO) / 2
  const px = lx * QUARTO - meiaL
  const py = ly * QUARTO - meiaA
  const torceX = fbm(uu, vv, 16, 2, SEMENTE + 2) * TORCAO.larga + fbm(uu, vv, 64, 1, SEMENTE + 3) * TORCAO.miuda
  const torceY = fbm(uu, vv, 16, 2, SEMENTE + 4) * TORCAO.larga + fbm(uu, vv, 64, 1, SEMENTE + 5) * TORCAO.miuda
  const meiaJunta = MEIA_JUNTA[0] + (MEIA_JUNTA[1] - MEIA_JUNTA[0]) * hash(k, 0, SEMENTE)
  const ax = meiaL - meiaJunta
  const ay = meiaA - meiaJunta
  const r = Math.min(CANTO[0] + (CANTO[1] - CANTO[0]) * hash(k, 1, SEMENTE), ax, ay)
  const dx = px + torceX
  const dy = py + torceY
  const sx = Math.abs(dx) - (ax - r)
  const sy = Math.abs(dy) - (ay - r)
  const ox = Math.max(sx, 0)
  const oy = Math.max(sy, 0)
  const fora = Math.sqrt(ox * ox + oy * oy)
  // Distância assinada à borda (negativa dentro) e o rumo para fora dela.
  const borda = fora + Math.min(Math.max(sx, sy), 0) - r
  let nx = 0
  let ny = 0
  if (fora > 0) {
    nx = (Math.sign(dx) * ox) / fora
    ny = (Math.sign(dy) * oy) / fora
  } else if (sx > sy) nx = Math.sign(dx)
  else ny = Math.sign(dy)

  const sorteDoTom = hash(k, 2, SEMENTE)
  const deFora = Math.floor(sorteDoTom / CHANCE_DE_FORA)
  let c =
    deFora < DE_FORA.length
      ? DE_FORA[deFora]
      : TONS[Math.floor(((sorteDoTom - DE_FORA.length * CHANCE_DE_FORA) / (1 - DE_FORA.length * CHANCE_DE_FORA)) * TONS.length) % TONS.length]
  // Manchas largas, o tom de cada laje, o grão e, no fundo do grão, os poros.
  const grao = valor(uu * 256, vv * 256, 256, SEMENTE + 6)
  const poro = passoSuave(0.2, 0.06, grao)
  c = luz(c, fbm(uu, vv, 8, 3, SEMENTE + 7) * 0.035 + (hash(k, 3, SEMENTE) - 0.5) * 2 * VARIACAO_DA_LAJE + (grao - 0.5) * 0.035 - poro * 0.06)
  c = luz(c, -passoSuave(POEIRA.largura, 0, -borda) * POEIRA.forca)
  // A umidade: a parte molhada do chão (por posição) esverdeia só alguns cantos. O sorteio é do canto da grade (o
  // mesmo ponto para as lajes que dividem o canto), para a mancha não sair em todo encontro, como uma grade.
  const molhado = passoSuave(-0.1, 0.3, fbm(uu, vv, 4, 3, SEMENTE + 8))
  const cantoX = volta(laje.x + (px > 0 ? laje.largura : 0))
  const cantoY = volta(laje.y + (py > 0 ? laje.altura : 0))
  const pega = hash(cantoX, cantoY, SEMENTE + 30) < UMIDADE.chance ? 0.75 + 0.25 * hash(cantoX, cantoY, SEMENTE + 31) : 0
  const dCanto = Math.sqrt((Math.abs(dx) - ax) ** 2 + (Math.abs(dy) - ay) ** 2) + fbm(uu, vv, 32, 2, SEMENTE + 9) * 0.04
  const umido = molhado * pega * passoSuave(UMIDADE.alcance, 0, dCanto)
  c = luz(misturar(c, UMIDO, umido * UMIDADE.tinta), -umido * UMIDADE.escuro)
  // O ombro gasto pega a luz de cima à esquerda; a laje inteira cedida um nada.
  const ombro = OMBRO.inclinacao * (1 - passoSuave(0, OMBRO.largura, -borda))
  const dhx = -nx * ombro + (hash(k, 5, SEMENTE) - 0.5) * 2 * TORTO
  const dhy = -ny * ombro + (hash(k, 6, SEMENTE) - 0.5) * 2 * TORTO
  c = luz(c, (luzNaInclinacao(dhx, dhy) - LUZ_NO_PLANO) * LUZ_DO_RELEVO)
  c = misturar(c, COR_DA_RACHA, racha(px, py, meiaL, meiaA, k))
  const naJunta = passoSuave(PASSAGEM.dentro, PASSAGEM.fora, borda)
  if (naJunta <= 0) return empacotar(c)
  // O rejunte, com o grão dele e mais escuro onde o chão é úmido.
  const junta = luz(misturar(COR_DA_JUNTA, JUNTA_UMIDA, molhado * 0.8), (grao - 0.5) * 0.1 + fbm(uu, vv, 24, 2, SEMENTE + 10) * 0.05)
  return empacotar(misturar(c, junta, naJunta))
}
