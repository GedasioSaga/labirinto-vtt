/**
 * MURO EM RUÍNA (lote L07 "Selva: ruína e água", 24/11/2026; versão original do `muroBaixoDePedra`, só a ideia do
 * objeto). Um trecho do alicerce de uma casa caída na mata, em L: o braço de cima e o da esquerda (no giro 0), de
 * blocos de cantaria em fiadas desencontradas, mais alto no canto (três fiadas) e baixando para as pontas, com FALHAS
 * onde a parede ruiu até o alicerce. O ALICERCE (a fiada de baixo, um pouco mais larga e mais escura) corre inteiro
 * até a beira da pegada: quatro trechos girados fecham a planta de uma casa sem degrau entre eles. Junto das falhas
 * ficam os BLOCOS que caíram delas, tortos e meio enterrados num anel de terra, e umas lascas; o musgo verde-escuro
 * pega as juntas, o pé dos blocos e o lado da sombra (o alto seco dos blocos só leva uns pontos).
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`), como a coluna quebrada: cada bloco é um prisma em
 * fatias, e a 3/4 mostra a face de cada um com a junta embaixo, a quina de cima acesa e o musgo que sobe do pé, nos
 * quatro giros. Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`. Material: `pedra` (sugestão: arenito).
 *
 * Este arquivo guarda também o APOIO DO LOTE L07 (a pedra das lajes, o musgo, o prisma de pedra em fatias, a sombra
 * dele e o retângulo girado), que a coluna com glifos, a estela, o pedestal, a cabana de lajes, as pontes, a calçada
 * e o tanque importam.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Sombra, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador, rumoDaSombra, type Fatiador } from './pilhaDeFatias'
import { ESCURO_DA_PEDRA, lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'

// ---------- o apoio do lote L07 ----------

/** O musgo do lote: verde-escuro contido (saturação HSL ~0,22), o mesmo nas ruínas, na coluna, na estela e na cabana. */
export const TOM_DO_MUSGO: Rgb = [0x55, 0x5e, 0x3f]
export const MUSGO: MaterialDaPeca = { classe: 'folha', rgb: TOM_DO_MUSGO }

/**
 * Quanto o grão da pedra anda por px de altura: cada fatia lê outra linha da textura. Sem isso a frente da 3/4
 * repetia a mesma linha em todas as fatias e saía riscada de pé; com o passo da coluna quebrada (2,3) os estratos do
 * arenito viravam uma faixa por fatia e o bloco parecia uma pilha de papel. Com 0,9 os estratos ficam largos.
 */
export const GRAO_POR_ALTURA = 0.9
/** O passo das fatias (px do protótipo): a faixa de cada uma na 3/4. */
export const PASSO_DAS_FATIAS = 0.8

export function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** A rampa macia (smoothstep) de `a` a `b`: 0 antes, 1 depois. */
export function suave(a: number, b: number, t: number): number {
  const x = limitar((t - a) / (b - a), 0, 1)
  return x * x * (3 - 2 * x)
}

/** Leva a cor da amostra para `cor` (0 a 1). */
export function misturarCor(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

/** O lado maior da caixa da forma (px). */
export function ladoMaior(forma: Forma): number {
  return Math.max(forma.b[2] - forma.b[0], forma.b[3] - forma.b[1])
}

// ---------- a pedra das lajes ----------

/**
 * O ESTRATO do arenito do motor (`texPedra`, motor.ts: faixas de ±4% de luz a cada 5 px, todas na mesma direção).
 * Repetido aqui só para TIRAR METADE dele nas peças grandes: numa laje lisa de 30 px o estrato inteiro virava veio
 * de tábua a 2,5x-4x (revisão do diretor de arte, 24/11). O motor fica como está para o app inteiro.
 */
const PERIODO_DO_ESTRATO = 5
const LUZ_DO_ESTRATO = 0.04
/** A peça maior que isto (px, o lado maior) perde metade do estrato. */
const PECA_GRANDE = 20
/** O giro do estrato de uma laje para a outra (radianos, de -GIRO a +GIRO): as vizinhas não ficam paralelas. */
const GIRO_DO_ESTRATO = 0.8
/** Os poros de 1 px (a fração dos px e a luz de cada um) e a mancha larga (até ±6% de luz). */
const POROS = 0.03
const LUZ_DO_PORO = -0.12
const MANCHA_LARGA = 0.06

/**
 * A PEDRA DE LAJE do lote: a textura da pedra escolhida com (u, v) girados por um ângulo tirado da `semente` (o
 * estrato de cada laje corre para um lado), metade do estrato do arenito na peça de mais de `PECA_GRANDE` px, os poros
 * de 1 px e uma mancha larga de luz. Todas as lajes e blocos do lote usam esta textura no lugar da do material.
 */
export function pedraDeLaje(pedra: MaterialDaPeca, semente: number, tamanho: number): Textura {
  const daPedra = texturaDaClasse(pedra.classe)
  const angulo = (hash(semente, 5, 7907) - 0.5) * 2 * GIRO_DO_ESTRATO
  const cos = Math.cos(angulo)
  const sen = Math.sin(angulo)
  const meioEstrato = tamanho > PECA_GRANDE && (pedra.pedra ?? 'granito') === 'arenito'
  const mu = hash(semente, 6, 7907) * 97
  const mv = hash(semente, 7, 7907) * 89
  return (u, v, x, y, p, s, escala) => {
    const gu = u * cos - v * sen
    const gv = u * sen + v * cos
    if (daPedra !== null) daPedra(gu, gv, x, y, p, s, escala)
    let luz = ruido(x * 0.05 + mu, y * 0.05 + mv) * 2.4 * MANCHA_LARGA
    if (meioEstrato) {
      const fase = (gv + ruido(gu * 0.06 + p.semente, gv * 0.05) * 2.5) / PERIODO_DO_ESTRATO
      luz -= 0.5 * limitar(Math.sin(fase * Math.PI * 2) * 1.8, -1, 1) * LUZ_DO_ESTRATO
    }
    if (hash(Math.floor(u), Math.floor(v), semente + 7911) < POROS) luz += LUZ_DO_PORO
    s[3] += luz
  }
}

// ---------- o musgo ----------

/**
 * O musgo contido: o corte sobe `CORTE_DO_MUSGO` acima do `limiar` de cada desenho e a beira da mancha passa da pedra
 * ao musgo por uma rampa macia de `RAMPA_DO_MUSGO` (~1,5 a 3 px). Com a rampa reta de 0,2 as manchas saíam de beira
 * dura, todas do mesmo tamanho, e o muro lia como camuflagem; a rampa larga também põe o meio dela mais alto (uns 40%
 * menos musgo).
 */
const CORTE_DO_MUSGO = 0.12
const RAMPA_DO_MUSGO = 0.34
/** O máximo que o musgo cobre a cor da pedra: a pedra ainda aparece por baixo. */
const COBERTURA_DO_MUSGO = 0.7
/** Até onde a junta puxa o musgo para dentro do alto do bloco (px) e até onde o pé puxa na face (px). */
const JUNTA_DO_MUSGO = 3.6
const PE_DO_MUSGO = 5

/** A mancha de musgo no ponto (0 a 1): duas escalas de ruído cortadas no `limiar` (maior = menos musgo). */
export function manchaDeMusgo(x: number, y: number, semente: number, limiar: number): number {
  const n = ruido(x * 0.12 + semente * 7.31, y * 0.12 + semente * 3.17) + 0.45 * ruido(x * 0.32 + 17.3, y * 0.32 + semente * 1.9)
  return suave(0, 1, (n - limiar - CORTE_DO_MUSGO) / RAMPA_DO_MUSGO)
}

/** Põe o musgo na amostra: a cor dele e um grão fofo, um nada mais escuro que a pedra em volta. */
export function musgar(s: Float32Array, t: number, x: number, y: number): void {
  if (t <= 0) return
  misturarCor(s, TOM_DO_MUSGO, COBERTURA_DO_MUSGO * t)
  s[3] += (ruido(x * 0.95 + 5.1, y * 0.95 + 2.7) * 0.12 - 0.03) * t
}

/** O rumo da sombra NA TELA, no objeto, de comprimento 1: o lado da sombra é onde o musgo cresce mais. */
export function rumoUnitario(q: number): readonly [number, number] {
  const [rx, ry] = rumoDaSombra(q)
  const l = Math.hypot(rx, ry) || 1
  return [rx / l, ry / l]
}

/** De 0 (virado para a luz) a 1 (virado para a sombra): `sombra` é a normal escalar o rumo da sombra. */
function ladoDaSombra(sombra: number): number {
  return limitar(0.5 + 0.9 * sombra, 0, 1)
}

/**
 * O musgo no ALTO de uma pedra (`m` é a mancha, 0 a 1): cheio na junta (a `dentro` px da beira), mais na beira do
 * lado da sombra (`sombra`, a normal da beira escalar o rumo da sombra); no alto seco, só uns pontos soltos.
 */
export function musgoDoAlto(m: number, dentro: number, sombra: number, x: number, y: number, semente: number): number {
  if (m <= 0) return 0
  const naJunta = m * (1 - suave(0.6, JUNTA_DO_MUSGO, dentro)) * (0.35 + 0.65 * ladoDaSombra(sombra))
  const ponto = suave(0.25, 0.31, ruido(x * 0.8 + semente * 0.37, y * 0.8 + 3.3))
  return Math.max(naJunta, ponto * Math.min(1, m * 1.6) * 0.8)
}

/** O peso do musgo na FACE: cheio no pé (`acimaDoPe` px), forte do lado da sombra e fraco do lado da luz. */
export function pesoDaFace(acimaDoPe: number, sombra: number): number {
  const pe = 1 - suave(0, PE_DO_MUSGO, acimaDoPe)
  return Math.max(pe, 0.3 + 0.7 * ladoDaSombra(sombra))
}

/** A normal (para fora) da forma no ponto, pela diferença da distância: para o musgo do lado da sombra das lajes. */
export function sombraDaBeira(forma: Forma, x: number, y: number, rumo: readonly [number, number]): number {
  const gx = forma.d(x + 0.5, y) - forma.d(x - 0.5, y)
  const gy = forma.d(x, y + 0.5) - forma.d(x, y - 0.5)
  const l = Math.hypot(gx, gy) || 1
  return (gx * rumo[0] + gy * rumo[1]) / l
}

// ---------- o prisma de pedra ----------

/** Os quatro cantos do retângulo de meios lados (a, b) em volta de (cx, cy), girado `angulo` radianos. */
export function retanguloGirado(cx: number, cy: number, a: number, b: number, angulo: number): Ponto[] {
  const c = Math.cos(angulo)
  const s = Math.sin(angulo)
  const cantos: readonly Ponto[] = [[-a, -b], [a, -b], [a, b], [-a, b]]
  return cantos.map(([u, v]): Ponto => [cx + u * c - v * s, cy + u * s + v * c])
}

/** O polígono com o canto `canto` lascado: o canto vira dois pontos, `tamanho` px para dentro de cada lado. */
export function lascar(pontos: readonly Ponto[], canto: number, tamanho: number): Ponto[] {
  const n = pontos.length
  const saida: Ponto[] = []
  pontos.forEach((p, i) => {
    if (i !== canto) {
      saida.push(p)
      return
    }
    for (const viz of [pontos[(i + n - 1) % n], pontos[(i + 1) % n]]) {
      const l = Math.hypot(viz[0] - p[0], viz[1] - p[1]) || 1
      const t = Math.min(0.42, tamanho / l)
      saida.push([p[0] + (viz[0] - p[0]) * t, p[1] + (viz[1] - p[1]) * t])
    }
  })
  return saida
}

/** A normal (para fora) do lado mais perto, escrita aqui pela função de `normaisDoPoligono`: sem alocar por pixel. */
export const NORMAL = new Float64Array(2)

/** A função que acha o lado do polígono mais perto do ponto e escreve a normal dele em `NORMAL`. */
export function normaisDoPoligono(pontos: readonly Ponto[]): (x: number, y: number) => void {
  const n = pontos.length
  let area = 0
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = pontos[i]
    const [bx, by] = pontos[(i + 1) % n]
    area += ax * by - bx * ay
  }
  const sinal = area >= 0 ? 1 : -1
  const lados = pontos.map(([ax, ay], i) => {
    const [bx, by] = pontos[(i + 1) % n]
    const dx = bx - ax
    const dy = by - ay
    const l = Math.hypot(dx, dy) || 1
    return { ax, ay, dx, dy, l2: l * l, nx: (sinal * dy) / l, ny: (-sinal * dx) / l }
  })
  return (x, y) => {
    let menor = Infinity
    for (const lado of lados) {
      let h = ((x - lado.ax) * lado.dx + (y - lado.ay) * lado.dy) / lado.l2
      h = h < 0 ? 0 : h > 1 ? 1 : h
      const qx = x - lado.ax - lado.dx * h
      const qy = y - lado.ay - lado.dy * h
      const d = qx * qx + qy * qy
      if (d < menor) {
        menor = d
        NORMAL[0] = lado.nx
        NORMAL[1] = lado.ny
      }
    }
  }
}

export interface OpcoesDoBloco {
  readonly semente: number
  /** O tom do alto; as faces saem um nada mais escuras. */
  readonly tom?: number
  readonly bisel?: number
  readonly contorno?: number
  readonly passo?: number
  /** A junta escura no pé da face, em px (o bloco assentado noutro, ou o pé no chão). Padrão 0,9. */
  readonly junta?: number
  /** Luz a mais nas faces (o entalhe, a porta, as juntas): o ponto, a altura e a normal da face no objeto. */
  readonly face?: (x: number, y: number, z: number, nx: number, ny: number) => number
  /** Luz a mais no alto (as juntas das lajes, o entalhe de cima). */
  readonly topo?: (x: number, y: number) => number
  /** A mancha de musgo (0 a 1) no ponto e na altura; o bloco a puxa para a junta, o pé e o lado da sombra. */
  readonly musgo?: (x: number, y: number, z: number) => number
  /** Mexe na cor da amostra da face depois da luz (o vão escuro da porta da cabana). */
  readonly corDaFace?: (s: Float32Array, x: number, y: number, z: number, nx: number, ny: number) => void
}

/**
 * Um PRISMA DE PEDRA na pilha de fatias, do chão `z0` ao alto `z1` (px), com a planta `pontos`: as fatias de dentro
 * levam a luz da face mais perto (pela tela, `luzDaNormal`), a junta no pé e a quina de cima acesa; a de cima leva o
 * chanfro, o contorno e a textura do alto. Prisma empilhado noutro (`z0` > 0) não repete a fatia de baixo. A pedra é
 * a `pedraDeLaje`; o musgo vai para as juntas do alto, o pé da face e o lado da sombra.
 */
export function blocoEmFatias(f: Fatiador, camada: number, pontos: readonly Ponto[], z0: number, z1: number, pedra: MaterialDaPeca, o: OpcoesDoBloco): void {
  const forma = poligono(pontos)
  const daPedra = pedraDeLaje(pedra, o.semente, ladoMaior(forma))
  const normal = normaisDoPoligono(pontos)
  const [rx, ry] = rumoUnitario(f.q)
  const tom = o.tom ?? 1
  const junta = o.junta ?? 0.9
  const lista = alturas(z0, z1, o.passo ?? PASSO_DAS_FATIAS)
  if (z0 > 0) lista.shift()
  for (const z of lista) {
    if (z >= z1 - 1e-6) {
      const doAlto: Textura = (u, v, x, y, p, s, escala) => {
        daPedra(u, v, x, y, p, s, escala)
        if (o.topo !== undefined) s[3] += o.topo(x, y)
        if (o.musgo === undefined) return
        const m = o.musgo(x, y, z)
        if (m <= 0) return
        normal(x, y)
        musgar(s, musgoDoAlto(m, -forma.d(x, y), NORMAL[0] * rx + NORMAL[1] * ry, x, y, o.semente), x, y)
      }
      f.fatia(camada, z, forma, pedra, { tabua: 0, bisel: o.bisel ?? 1.2, tom, contorno: o.contorno ?? 0.26, textura: doAlto, semente: o.semente })
      continue
    }
    const daFace: Textura = (u, v, x, y, p, s, escala) => {
      daPedra(u, v + z * GRAO_POR_ALTURA, x, y + z * GRAO_POR_ALTURA, p, s, escala)
      normal(x, y)
      const nx = NORMAL[0]
      const ny = NORMAL[1]
      let luz = luzDaNormal(nx, ny, 0, f.q)
      if (z - z0 < junta) luz -= 0.2
      else if (z1 - z < 1.3) luz += 0.05
      if (o.face !== undefined) luz += o.face(x, y, z, nx, ny)
      s[3] += luz
      if (o.musgo !== undefined) {
        const m = o.musgo(x, y, z)
        if (m > 0) musgar(s, m * pesoDaFace(z - z0, nx * rx + ny * ry), x, y)
      }
      if (o.corDaFace !== undefined) o.corDaFace(s, x, y, z, nx, ny)
    }
    f.fatia(camada, z, forma, pedra, lisa(tom * 0.94, daFace, o.semente + 1))
  }
}

/** O contorno convexo dos pontos (a cadeia monótona), na ordem da volta. */
function envoltoria(pontos: readonly Ponto[]): Ponto[] {
  const ordem = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const vira = (o: Ponto, a: Ponto, b: Ponto): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const metade = (lista: readonly Ponto[]): Ponto[] => {
    const h: Ponto[] = []
    for (const p of lista) {
      while (h.length >= 2 && vira(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop()
      h.push(p)
    }
    h.pop()
    return h
  }
  return [...metade(ordem), ...metade([...ordem].reverse())]
}

/** A sombra no chão de um prisma de planta convexa e altura `z`: a planta varrida até onde a sombra do alto cai. */
export function sombraDoPrisma(pontos: readonly Ponto[], z: number, q: number, forca: number, suave: number): Sombra {
  const [rx, ry] = rumoDaSombra(q)
  const todos: Ponto[] = [...pontos, ...pontos.map(([x, y]): Ponto => [x + rx * z, y + ry * z])]
  return { forma: poligono(envoltoria(todos)), z: 0, forca, suave }
}

/** A terra escura do pé de uma pedra meio enterrada: fosca, um nada manchada. */
export const TERRA_DO_PE: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x3f, 0x30] }
const texDaTerra: Textura = (_u, _v, x, y, _p, s) => {
  s[3] += ruido(x * 0.45 + 2.3, y * 0.45 + 7.1) * 0.16
}

/**
 * O ANEL DE TERRA no pé de uma pedra caída (a planta crescida `quanto` vezes em volta do meio), na fatia do chão, por
 * baixo do bloco: a pedra fica meio enterrada e não flutua.
 */
export function anelDeTerra(f: Fatiador, pontos: readonly Ponto[], quanto: number, semente: number): void {
  const mx = pontos.reduce((t, p) => t + p[0], 0) / pontos.length
  const my = pontos.reduce((t, p) => t + p[1], 0) / pontos.length
  const anel = pontos.map(([x, y]): Ponto => [mx + (x - mx) * quanto, my + (y - my) * quanto])
  f.fatia(0, 0, poligono(anel), TERRA_DO_PE, { tabua: 0, bisel: 0, contorno: 0, tom: 1, alfa: 0.78, suave: 1.6, textura: texDaTerra, semente })
}

// ---------- o muro ----------

/** A espessura do muro, a altura de uma fiada e a do alicerce (casas). */
const ESPESSURA = 0.3
const FIADA = 0.125
const ALICERCE = 0.06
/** Quanto o alicerce passa do muro de cada lado, a margem da pegada e a meia folga entre dois blocos (px). */
const SOBRA_DO_ALICERCE = 1.8
const MARGEM = 2.2
const FOLGA = 0.5
/** O comprimento de um bloco (casas): de partida e quanto varia; o de uma laje do alicerce. */
const BLOCO = 0.3
const BLOCO_QUE_VARIA = 0.2
const LAJE_DO_ALICERCE = 0.55
const FIADAS = 3
/** O tom do alicerce: mais escuro que as fiadas (0,92 a 1,06), para ler como a fiada de base. */
const TOM_DO_ALICERCE = 0.78

/** As fiadas que sobraram ao longo de um braço, do canto para a ponta: [até onde (0 a 1), quantas]. */
type Perfil = readonly (readonly [number, number])[]
const PERFIL_DE_CIMA: Perfil = [[0.3, 3], [0.5, 2], [0.64, 0], [0.84, 1], [1, 0]]
const PERFIL_DA_ESQUERDA: Perfil = [[0.2, 3], [0.4, 2], [0.58, 1], [0.76, 0], [1, 1]]

function fiadasEm(perfil: Perfil, t: number): number {
  for (const [ate, n] of perfil) if (t <= ate) return n
  return 0
}

/** Um braço do L: ao longo, do canto (`de`) para a ponta (`ate`); de través, a faixa do muro (`v0` a `v1`). */
interface Braco {
  readonly de: number
  readonly ate: number
  /** Onde começa o alicerce deste braço (o de cima cobre o canto). */
  readonly alicerceDe: number
  readonly v0: number
  readonly v1: number
  readonly deitado: boolean
  readonly perfil: Perfil
  readonly sal: number
}

function noBraco(b: Braco, u: number, v: number): Ponto {
  return b.deitado ? [u, v] : [v, u]
}

function retanguloDoBraco(b: Braco, u0: number, v0: number, u1: number, v1: number): Ponto[] {
  const [ax, ay] = noBraco(b, u0, v0)
  const [bx, by] = noBraco(b, u1, v1)
  return [[ax, ay], [bx, ay], [bx, by], [ax, by]]
}

type Musgo = (x: number, y: number, z: number) => number

/** As fiadas de blocos de um braço: desencontradas, cada uma até onde o perfil deixa, o alto torto e lascado. */
function montarFiadas(f: Fatiador, b: Braco, pedra: MaterialDaPeca, g: number, musgo: Musgo): void {
  const zA = g * ALICERCE
  const hc = g * FIADA
  for (let k = 0; k < FIADAS; k += 1) {
    let u = b.de - (k % 2 === 1 ? g * BLOCO * 0.55 : 0)
    for (let i = 0; u < b.ate - 1e-6; i += 1) {
      const sorte = (j: number): number => hash(i * 7 + k, j, b.sal)
      const comprimento = g * (BLOCO + BLOCO_QUE_VARIA * sorte(1))
      const u0 = Math.max(b.de, u)
      const u1 = Math.min(b.ate, u + comprimento)
      u += comprimento
      if (u1 - u0 < 4) continue
      const n = fiadasEm(b.perfil, ((u0 + u1) / 2 - b.de) / (b.ate - b.de))
      if (n <= k) continue
      // Um ou outro bloco do alto já caiu: a falha não fica só onde o perfil manda.
      if (k > 0 && k === n - 1 && sorte(2) < 0.18) continue
      const doAlto = k === n - 1
      const [cx, cy] = noBraco(b, (u0 + u1) / 2, (b.v0 + b.v1) / 2 + (sorte(3) - 0.5) * 1.1 * k)
      const hu = (u1 - u0) / 2 - FOLGA
      const hv = (b.v1 - b.v0) / 2 - (doAlto ? 0.4 : 0)
      let pontos = retanguloGirado(cx, cy, b.deitado ? hu : hv, b.deitado ? hv : hu, (sorte(4) - 0.5) * 0.05 * k)
      if (doAlto && sorte(5) < 0.45) pontos = lascar(pontos, Math.floor(sorte(6) * 4), 2.2 + 1.6 * sorte(7))
      const z0 = zA + k * hc
      blocoEmFatias(f, 0, pontos, z0, z0 + hc, pedra, { semente: b.sal + k * 100 + i * 2, tom: 0.92 + 0.14 * sorte(8), musgo })
    }
  }
}

/** O alicerce de um braço: lajes compridas, mais largas que o muro e mais escuras, até a beira da pegada. */
function montarAlicerce(f: Fatiador, b: Braco, pedra: MaterialDaPeca, g: number, musgo: Musgo): void {
  const zA = g * ALICERCE
  const n = Math.max(1, Math.round((b.ate - b.alicerceDe) / (g * LAJE_DO_ALICERCE)))
  const passo = (b.ate - b.alicerceDe) / n
  for (let j = 0; j < n; j += 1) {
    const u0 = b.alicerceDe + j * passo + (j > 0 ? FOLGA : 0)
    const u1 = b.alicerceDe + (j + 1) * passo - (j < n - 1 ? FOLGA : 0)
    const pontos = retanguloDoBraco(b, u0, b.v0 - SOBRA_DO_ALICERCE, u1, b.v1 + SOBRA_DO_ALICERCE)
    blocoEmFatias(f, 0, pontos, 0, zA, pedra, { semente: b.sal + 900 + j * 2, tom: TOM_DO_ALICERCE + 0.04 * hash(j, 1, b.sal + 1), bisel: 0.9, musgo })
  }
}

/**
 * Os blocos caídos, juntos das FALHAS de onde caíram (a de cima vai de 0,5 a 0,64 e de 0,84 ao fim; a da esquerda de
 * 0,58 a 0,76): [braço (0 = de cima), onde ao longo (0 a 1), afastado da face de dentro, meio comprido e meio largo,
 * giro, altura (casas)]. Quatro ou cinco só: com oito espalhados pelo L eles liam como caixas de papelão no chão.
 */
const CAIDOS: readonly (readonly [number, number, number, number, number, number, number])[] = [
  [0, 0.56, 0.13, 0.15, 0.11, 0.42, 0.11],
  [0, 0.63, 0.4, 0.11, 0.085, -0.6, 0.085],
  [0, 0.9, 0.15, 0.12, 0.09, 0.95, 0.09],
  [1, 0.66, 0.14, 0.14, 0.1, 1.05, 0.1],
  [1, 0.73, 0.4, 0.1, 0.08, -0.3, 0.08],
]
/** As lascas soltas, poucas e de 2 a 3 px de raio (as de 1 px viravam ruído): [braço, onde ao longo, afastado, raio (casas)]. */
const LASCAS: readonly (readonly [number, number, number, number])[] = [
  [0, 0.6, 0.06, 0.05],
  [1, 0.6, 0.07, 0.045],
  [0, 0.95, 0.32, 0.048],
]
/** O anel de terra dos caídos (a planta crescida) e a força do contato deles. */
const TERRA_DOS_CAIDOS = 1.22
const CONTATO_DOS_CAIDOS = 0.35

export const montarMuroEmRuina: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  cena.corDoPiso = ESCURO_DA_PEDRA
  const T = g * ESPESSURA
  const S = SOBRA_DO_ALICERCE
  const bracos: readonly Braco[] = [
    { de: -hw + MARGEM, ate: hw, alicerceDe: -hw + MARGEM - S, v0: -hh + MARGEM, v1: -hh + MARGEM + T, deitado: true, perfil: PERFIL_DE_CIMA, sal: 6100 },
    { de: -hh + MARGEM + T, ate: hh, alicerceDe: -hh + MARGEM + T + S, v0: -hw + MARGEM, v1: -hw + MARGEM + T, deitado: false, perfil: PERFIL_DA_ESQUERDA, sal: 6400 },
  ]
  // O musgo: sobe do pé (até ~4 px) e mancha as fiadas baixas; o bloco o leva para as juntas e o lado da sombra.
  const musgo: Musgo = (x, y, z) => {
    const pe = z < 4.5 ? (1 - z / 4.5) * manchaDeMusgo(x * 1.3, y * 1.3 + z, 11, -0.12) : 0
    const mancha = manchaDeMusgo(x + z * 0.7, y + z * 1.9, 3, 0.04 + z * 0.007)
    return pe > mancha ? pe : mancha
  }
  for (const b of bracos) {
    montarAlicerce(f, b, pedra, g, musgo)
    montarFiadas(f, b, pedra, g, musgo)
  }

  // Os blocos caídos junto das falhas, tortos e meio enterrados num anel de terra, e as lascas.
  const naFrente = (braco: number, t: number, afastado: number): Ponto => {
    const b = bracos[braco]
    return noBraco(b, b.de + t * (b.ate - b.de), b.v1 + S + afastado * g)
  }
  CAIDOS.forEach(([braco, t, afastado, a, bb, giro, alto], i) => {
    const [cx, cy] = naFrente(braco, t, afastado)
    const pontos = lascar(retanguloGirado(cx, cy, a * g, bb * g, giro), (i * 3 + 1) % 4, 2.4 + 0.8 * (i % 2))
    anelDeTerra(f, pontos, TERRA_DOS_CAIDOS, 6690 + i)
    blocoEmFatias(f, 0, pontos, 0, alto * g, pedra, { semente: 6700 + i * 2, tom: 0.9 + 0.12 * hash(i, 2, 6701), musgo: (x, y, z) => Math.max(musgo(x, y, z), manchaDeMusgo(x, y, 13, -0.02)) })
    cena.sombras.push(sombraDoPrisma(pontos, alto * g, q, 0.26, 1.3), contato(poligono(pontos), CONTATO_DOS_CAIDOS))
  })
  LASCAS.forEach(([braco, t, afastado, r], i) => {
    const [cx, cy] = naFrente(braco, t, afastado)
    const pontos: Ponto[] = []
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * 2 * Math.PI + i * 0.7
      const rr = r * g * (0.75 + 0.4 * hash(i, k, 6800))
      pontos.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85])
    }
    blocoEmFatias(f, 0, pontos, 0, g * 0.04, pedra, { semente: 6810 + i * 2, tom: 0.98, bisel: 0.7, contorno: 0.24, junta: 0 })
    cena.sombras.push(contato(poligono(pontos), 0.32))
  })
  f.fechar()

  // As sombras no chão: cada pedaço do braço na altura que sobrou dele, o alicerce inteiro e o contato.
  const zA = g * ALICERCE
  for (const b of bracos) {
    let antes = 0
    for (const [ate, n] of b.perfil) {
      if (n > 0) {
        const [x0, y0] = noBraco(b, b.de + antes * (b.ate - b.de), b.v0)
        const [x1, y1] = noBraco(b, b.de + ate * (b.ate - b.de), b.v1)
        cena.sombras.push(sombraVarrida(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), zA + n * g * FIADA, q, 0.26, 1.6))
      }
      antes = ate
    }
    const [ax, ay] = noBraco(b, b.alicerceDe, b.v0 - S)
    const [bx, by] = noBraco(b, b.ate, b.v1 + S)
    const [x0, y0, x1, y1] = [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]
    cena.sombras.push(sombraVarrida(x0, y0, x1, y1, zA, q, 0.22, 1.2), contato(caixa(x0, y0, x1, y1, 1), 0.3))
  }
}
