/**
 * PEDRA LAPIDADA, OURO VELHO E MONTE NO CHÃO (lote 17 dos objetos novos, 12/11/2026, grupo Tesouro; pedido do
 * mestre: "coloque Ouro, Diamente, Joias, Moedas de ouro como objeto única e em poças"): o que o diamante, o monte
 * de diamantes, a joia e o monte de joias têm em comum. Não é objeto e não entra no catálogo.
 *
 * A PEDRA é a lapidação brilhante num modelo 3D pequeno (`facetasDaCoroa`): a mesa octogonal, as 8 estrelas, as 8
 * pipas e as 16 facetas de cinta. A pedra TOMBA (a mesa inclina para um lado) e só as facetas viradas para cima são
 * pintadas, cada uma num polígono de tom próprio: um desenho fixo de claros e escuros (as setas da mesa alternadas,
 * as estrelas claras, a cinta escura e clara uma sim, uma não, o reflexo escuro da culeta no meio da mesa) mais a luz
 * do motor na faceta e o lampejo da faceta que espelha a luz para o olho. É esse mosaico, com a fresta escura entre
 * uma faceta e a outra, que se lê como pedra lapidada de relance, e não como botão, moeda nem floco de neve. A pedra
 * miúda tem a lapidação simples (a mesa e oito facetas de coroa), que a 1x ainda é uma pedra e não um borrão.
 *
 * O BRILHO é pintado (estrelinhas de quatro pontas e pontos brancos, em emissão: não pegam luz nem sombra), e pouco.
 * Nenhuma peça acende luz.
 *
 * O OURO VELHO é cor fixa (não há ouro na tabela de materiais): o dourado do bloco de inscrições dourado
 * (`blocoDeInscricoesDourado.ts`, [184, 150, 78]) puxado para o marrom, com o brilho do metal no chanfro. A pérola
 * é creme, com o chanfro de esfera e o ponto de luz.
 *
 * O MONTE (`criarMonte`, `chaoDoMonte`) é a poça derramada: a profundidade vai de 1 no meio a 0 na beira de contorno
 * irregular (lóbulos pelo ângulo) e fica negativa fora, onde só caem peças soltas. Na 3/4 ele sobe em NÍVEIS: a
 * beira é uma coluna baixa (a frente fina do monte e a sombra dele no chão) e os de dentro são tampos soltos sem
 * sombra, cada um mais alto, com a caixa esticada até o mesmo sul para a 3/4 pintar o mais alto por cima. Cada
 * coisa do monte vai inteira para o nível do meio dela (`comMeioEm`), então ela sobe sem se partir.
 *
 * Com o objeto girado, a 3/4 pinta o quarto de volta na cena com a luz fixa na tela: o tombo da pedra, os tons das
 * facetas, o ponto de luz e as sombras pintadas são contas NA TELA, levadas para o desenho por `desgirado` (a conta
 * do altar). O que tem chanfro (o ouro, a pérola) pega a luz certa sozinho.
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { capsula, elipse, elipseGirada, menos, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type CriarPeca, type MaterialDaPeca, type Peca, type Projecao, type Textura } from './motor'
import { ESCURO_DO_OURO, MASSA_DO_OURO, OURO } from './tesouroDeOuro'

// ---------- as cores (fixas) ----------

/** As quatro cores de uma pedra, do tom 0 ao tom 1: a faceta escura, a do meio, a clara e o reflexo quase branco. */
export interface Paleta {
  readonly escuro: Rgb
  readonly meio: Rgb
  readonly claro: Rgb
  readonly reflexo: Rgb
}

/**
 * O diamante: branco-azulado frio, da ardósia da faceta escura (a pedra de verdade tem facetas quase pretas) ao
 * branco do reflexo. Nada de azul-piscina (saturação até 0,33, no escuro).
 */
export const DIAMANTE: Paleta = { escuro: [62, 72, 92], meio: [140, 156, 176], claro: [206, 220, 232], reflexo: [247, 249, 252] }
/**
 * O escuro em que o pixel escuro demais da pedra branca é levantado (`cena.corDoPiso`): ardósia de luminância linear
 * 0,051, acima do piso de 0,045. Com o da nogueira a fresta e a borda da pedra saíam marrons.
 */
export const ESCURO_DA_PEDRA: Rgb = [58, 64, 78]
/** O rubi: vinho e vermelho escuro. Saturação HSV até 0,58: a pedra grande da joia é boa parte dela, e o teto é 0,62. */
export const RUBI: Paleta = { escuro: [112, 48, 56], meio: [130, 54, 62], claro: [182, 100, 104], reflexo: [240, 214, 210] }
/** A esmeralda: verde garrafa. */
export const ESMERALDA: Paleta = { escuro: [38, 82, 60], meio: [58, 124, 90], claro: [116, 172, 134], reflexo: [220, 238, 224] }
/** A safira: azul noite. O escuro fica acima do piso de luz do motor (abaixo dele o pixel é levantado para o marrom). */
export const SAFIRA: Paleta = { escuro: [54, 70, 122], meio: [68, 90, 152], claro: [122, 144, 198], reflexo: [218, 226, 244] }

/** Onde o tom passa do escuro para o meio e do meio para o claro. */
const TOM_DO_MEIO = 0.45
const TOM_DO_CLARO = 0.8

/** A cor da pedra no tom `t` (0 o escuro, 1 o reflexo). */
export function corDoTom(p: Paleta, t: number): Rgb {
  if (t <= TOM_DO_MEIO) return misturar(p.escuro, p.meio, Math.max(0, t) / TOM_DO_MEIO)
  if (t <= TOM_DO_CLARO) return misturar(p.meio, p.claro, (t - TOM_DO_MEIO) / (TOM_DO_CLARO - TOM_DO_MEIO))
  return misturar(p.claro, p.reflexo, Math.min(1, (t - TOM_DO_CLARO) / (1 - TOM_DO_CLARO)))
}

/**
 * O ouro velho: o MESMO ouro das barras e moedas do tesouro (`tesouroDeOuro.ts`, o `OURO`, saturação HSV 0,54),
 * importado de lá para as joias e o ouro do monte serem um metal só. Classe metal: o motor põe o brilho no chanfro
 * e o grão do metal.
 */
export const OURO_VELHO: MaterialDaPeca = OURO
/** O ouro na sombra (o sulco entalhado, o vão entre as peças): o escuro do ouro do tesouro (`ESCURO_DO_OURO`). */
export const OURO_NA_SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: ESCURO_DO_OURO }
/** A massa de ouro do fundo do monte de joias: a do monte de ouro (`MASSA_DO_OURO`). */
export const MASSA_DE_OURO: Rgb = MASSA_DO_OURO.rgb
/** O brilho do ouro no chanfro (o do latão do motor é 0,42): mais lustroso que o latão gasto. */
export const BRILHO_DO_OURO = 0.5
/** A pérola: creme. */
export const PEROLA: MaterialDaPeca = { classe: 'liso', rgb: [226, 214, 190] }
/** O branco do brilho pintado, um pouco quente. */
const BRANCO: Rgb = [255, 253, 246]
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: BRANCO }

/**
 * O fio de arco-íris (o fogo da pedra): cores apagadas, de saturação até 0,36, misturadas pouco numa faceta só.
 * Também a franja da luz que atravessa a pedra e cai no chão.
 */
export const ARCO_IRIS: readonly Rgb[] = [[228, 152, 160], [232, 206, 142], [160, 210, 170], [152, 180, 228]]
const PESO_DO_ARCO_IRIS = 0.36

/** A cor do arco-íris na fração `t` (0 a 1). */
export function corDoArcoIris(t: number): Rgb {
  const f = Math.min(0.999, Math.max(0, t)) * (ARCO_IRIS.length - 1)
  const i = Math.floor(f)
  return misturar(ARCO_IRIS[i], ARCO_IRIS[i + 1], f - i)
}

// ---------- a luz e o giro ----------

/** A luz do motor (`motor.ts`: de cima à esquerda, 52° acima do chão), NA TELA. */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62

export type Vetor = readonly [number, number, number]

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus): a conta do altar (`altar.ts`). De cima o giro chega 0 e quem gira é a imagem pronta.
 */
export function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** A luz no referencial do desenho: a da tela, desgirada. */
export function luzNoDesenho(giro: number): Vetor {
  const [x, y] = desgirado(LUZ_X, LUZ_Y, giro)
  return [x, y, LUZ_Z]
}

/** Para onde fica a luz no chão, no referencial do desenho (unitário). */
export function rumoDaLuz(luz: Vetor): Ponto {
  const l = Math.hypot(luz[0], luz[1]) || 1
  return [luz[0] / l, luz[1] / l]
}

// ---------- contas de forma ----------

/**
 * A mesma forma com a caixa de pintura centrada em (mx, my) (a conta da bola de cristal): o desenho não muda, mas
 * o meio da caixa, que a 3/4 lê para saber com que estrutura a peça sobe, cai onde se quer.
 */
export function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/** A forma encolhida `folga` px por dentro: a fresta entre duas facetas vizinhas. */
function encolhida(forma: Forma, folga: number): Forma {
  return { b: forma.b, d: (x, y) => forma.d(x, y) + folga }
}

/** Amostras da sombra arrastada à mão (a de altura zero não é arrastada pelo motor). */
const AMOSTRAS_DO_ARRASTO = 4

/**
 * A forma arrastada até (ox, oy): a sombra no chão de uma coisa com altura, sem virar estrutura da 3/4 (a sombra
 * com altura do motor vira coluna e sobe as peças de dentro dela).
 */
export function arrastada(forma: Forma, ox: number, oy: number): Forma {
  const b = forma.b
  return {
    b: [b[0] + Math.min(0, ox), b[1] + Math.min(0, oy), b[2] + Math.max(0, ox), b[3] + Math.max(0, oy)],
    d(x, y) {
      let menor = Infinity
      for (let i = 0; i <= AMOSTRAS_DO_ARRASTO; i += 1) {
        const t = i / AMOSTRAS_DO_ARRASTO
        const d = forma.d(x - ox * t, y - oy * t)
        if (d < menor) menor = d
      }
      return menor
    },
  }
}

/** O casco convexo dos pontos (cadeia monótona), no sentido anti-horário da tela. */
function cascoConvexo(pontos: readonly Ponto[]): Ponto[] {
  const ps = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (ps.length < 3) return ps
  const cruz = (o: Ponto, a: Ponto, b: Ponto): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const baixo: Ponto[] = []
  for (const p of ps) {
    while (baixo.length >= 2 && cruz(baixo[baixo.length - 2], baixo[baixo.length - 1], p) <= 0) baixo.pop()
    baixo.push(p)
  }
  const cima: Ponto[] = []
  for (let i = ps.length - 1; i >= 0; i -= 1) {
    const p = ps[i]
    while (cima.length >= 2 && cruz(cima[cima.length - 2], cima[cima.length - 1], p) <= 0) cima.pop()
    cima.push(p)
  }
  baixo.pop()
  cima.pop()
  return [...baixo, ...cima]
}

// ---------- a lapidação brilhante ----------

/** As medidas, em frações do raio da cinta: a mesa, a ponta das estrelas, a altura da coroa e o reflexo da culeta na mesa. */
const MESA = 0.56
const ESTRELA = 0.8
const COROA = 0.17
const CULETA = 0.15
const OITAVO = Math.PI / 4
const MEIO_OITAVO = Math.PI / 8
/** A faceta conta como vista de cima a partir desta inclinação da normal. */
const VISIVEL = 0.05

export type TipoDaFaceta = 'mesa' | 'estrela' | 'pipa' | 'cinta' | 'coroa'
/** A lapidação inteira (setas na mesa, estrelas, pipas e cinta) ou a simples (a mesa e oito facetas de coroa), da pedra miúda. */
export type Detalhe = 'inteira' | 'simples'

export interface Faceta {
  /** Os cantos no lugar, vistos de cima (px do protótipo). */
  readonly pontos: readonly Ponto[]
  readonly normal: Vetor
  /** A altura média (px), para pintar de baixo para cima. */
  readonly altura: number
  readonly tipo: TipoDaFaceta
  readonly k: number
  /** Para onde a faceta fica, em volta do meio da pedra (radianos, no chão). */
  readonly angulo: number
}

/** Onde e como a pedra está: o meio e o raio da cinta (px), o achatado da oval, o giro do eixo comprido, o tombo e o rumo dele. */
export interface PoseDaPedra {
  readonly x: number
  readonly y: number
  readonly raio: number
  readonly achatado?: number
  readonly giro?: number
  /** Quanto a mesa inclina (radianos) e para onde ela fica virada no chão (radianos). */
  readonly tombo: number
  readonly rumo: number
}

interface FacetaNaPedra {
  readonly cantos: readonly Vetor[]
  readonly tipo: TipoDaFaceta
  readonly k: number
}

/** O ponto da coroa no raio `r` e no ângulo `a`: a coroa é um cone baixo da beira da mesa até a cinta. */
function naCoroa(r: number, a: number): Vetor {
  return [r * Math.cos(a), r * Math.sin(a), (COROA * (1 - r)) / (1 - MESA)]
}

/** Gira `v` em volta do eixo unitário `k` (fórmula de Rodrigues). */
function girar3(v: Vetor, k: Vetor, co: number, si: number): Vetor {
  const [x, y, z] = v
  const [kx, ky, kz] = k
  const kv = kx * x + ky * y + kz * z
  const cx = ky * z - kz * y
  const cy = kz * x - kx * z
  const cz = kx * y - ky * x
  return [x * co + cx * si + kx * kv * (1 - co), y * co + cy * si + ky * kv * (1 - co), z * co + cz * si + kz * kv * (1 - co)]
}

/** O ponto da pedra (raio da cinta 1, mesa para cima) no lugar: achatada, girada, tombada para o rumo, na escala. */
function noLugar(v: Vetor, pose: PoseDaPedra): Vetor {
  const ach = pose.achatado ?? 1
  const g = pose.giro ?? 0
  const x0 = v[0]
  const y0 = v[1] * ach
  const x = x0 * Math.cos(g) - y0 * Math.sin(g)
  const y = x0 * Math.sin(g) + y0 * Math.cos(g)
  // O eixo deitado perpendicular ao rumo: girar em volta dele leva a normal da mesa para o rumo.
  const eixo: Vetor = [-Math.sin(pose.rumo), Math.cos(pose.rumo), 0]
  const [tx, ty, tz] = girar3([x, y, v[2]], eixo, Math.cos(pose.tombo), Math.sin(pose.tombo))
  return [pose.x + tx * pose.raio, pose.y + ty * pose.raio, tz * pose.raio]
}

/** A normal da faceta (método de Newell), virada para fora da pedra. */
function normalDe(cantos: readonly Vetor[], centro: Vetor): Vetor {
  let nx = 0
  let ny = 0
  let nz = 0
  let cx = 0
  let cy = 0
  let cz = 0
  const n = cantos.length
  for (let i = 0; i < n; i += 1) {
    const [x0, y0, z0] = cantos[i]
    const [x1, y1, z1] = cantos[(i + 1) % n]
    nx += (y0 - y1) * (z0 + z1)
    ny += (z0 - z1) * (x0 + x1)
    nz += (x0 - x1) * (y0 + y1)
    cx += x0
    cy += y0
    cz += z0
  }
  const l = Math.hypot(nx, ny, nz) || 1
  const fora = (cx / n - centro[0]) * nx + (cy / n - centro[1]) * ny + (cz / n - centro[2]) * nz
  const s = fora < 0 ? -1 / l : 1 / l
  return [nx * s, ny * s, nz * s]
}

/** As facetas da coroa no referencial da pedra (raio da cinta 1, a mesa em cima). */
function facetasDaCoroa(detalhe: Detalhe): FacetaNaPedra[] {
  const a = (k: number): number => MEIO_OITAVO + k * OITAVO
  const T = (k: number): Vetor => naCoroa(MESA, a(k))
  const S = (k: number): Vetor => naCoroa(ESTRELA, a(k) + MEIO_OITAVO)
  const C = (k: number): Vetor => naCoroa(1, a(k))
  const M = (k: number): Vetor => naCoroa(1, a(k) + MEIO_OITAVO)
  const lista: FacetaNaPedra[] = []
  if (detalhe === 'simples') {
    lista.push({ cantos: Array.from({ length: 8 }, (_, k) => T(k)), tipo: 'mesa', k: 0 })
    for (let k = 0; k < 8; k += 1) lista.push({ cantos: [T(k), T(k + 1), C(k + 1), C(k)], tipo: 'coroa', k })
    return lista
  }
  const meioDaMesa: Vetor = [0, 0, COROA]
  for (let k = 0; k < 8; k += 1) {
    lista.push({ cantos: [meioDaMesa, T(k), T(k + 1)], tipo: 'mesa', k })
    lista.push({ cantos: [T(k), S(k), T(k + 1)], tipo: 'estrela', k })
    lista.push({ cantos: [T(k), S(k - 1), C(k), S(k)], tipo: 'pipa', k })
    lista.push({ cantos: [S(k), C(k), M(k)], tipo: 'cinta', k: 2 * k })
    lista.push({ cantos: [S(k), M(k), C(k + 1)], tipo: 'cinta', k: 2 * k + 1 })
  }
  return lista
}

/** As facetas da coroa viradas para cima, no lugar e vistas de cima, de baixo para cima. */
export function facetasVistas(pose: PoseDaPedra, detalhe: Detalhe): Faceta[] {
  const centro = noLugar([0, 0, 0], pose)
  const vistas: Faceta[] = []
  for (const f of facetasDaCoroa(detalhe)) {
    const cantos = f.cantos.map((v) => noLugar(v, pose))
    const normal = normalDe(cantos, centro)
    if (normal[2] <= VISIVEL) continue
    let mx = 0
    let my = 0
    let mz = 0
    for (const [x, y, z] of cantos) {
      mx += x
      my += y
      mz += z
    }
    const n = cantos.length
    vistas.push({
      pontos: cantos.map(([x, y]): Ponto => [x, y]),
      normal,
      altura: mz / n,
      tipo: f.tipo,
      k: f.k,
      angulo: Math.atan2(my / n - centro[1], mx / n - centro[0]),
    })
  }
  return vistas.sort((p, q) => p.altura - q.altura)
}

/** O meio da mesa da pedra, visto de cima. */
export function mesaDaPedra(pose: PoseDaPedra): Ponto {
  const [x, y] = noLugar([0, 0, COROA], pose)
  return [x, y]
}

/** Os 16 pontos da cinta no lugar, vistos de cima, em volta da pedra (o contorno dela). */
export function cintaDaPedra(pose: PoseDaPedra): Ponto[] {
  return Array.from({ length: 16 }, (_, i): Ponto => {
    const [x, y] = noLugar(naCoroa(1, (i + 1) * MEIO_OITAVO), pose)
    return [x, y]
  })
}

/** O tom de partida de cada tipo de faceta (0 o escuro, 1 o reflexo): o desenho fixo que diz "brilhante". */
function tomDoDesenho(tipo: TipoDaFaceta, k: number): number {
  switch (tipo) {
    case 'mesa':
      return k % 2 === 0 ? 0.8 : 0.62
    case 'estrela':
      return 0.5
    case 'pipa':
      return 0.28
    case 'cinta':
      return k % 2 === 0 ? 0.05 : 0.58
    case 'coroa':
      return k % 2 === 0 ? 0.6 : 0.2
  }
}

/** Quanto a luz na faceta, o lado da mesa e o lampejo da faceta que espelha a luz mexem no tom; o sorteio por faceta. */
const PESO_DA_LUZ = 0.55
const LUZ_MEDIA = 0.62
const LADO_DA_MESA = 0.14
const PESO_DO_LAMPEJO = 0.6
const EXPOENTE_DO_LAMPEJO = 10
const SORTE_DO_TOM = 0.16

function tomDaFaceta(f: Faceta, luz: Vetor, luzNoChao: number, sorte: number): number {
  const [nx, ny, nz] = f.normal
  const nl = nx * luz[0] + ny * luz[1] + nz * luz[2]
  // O olho olha de cima: o reflexo dele na faceta (2 (n·v) n - v) apontando para a luz é o lampejo.
  const espelho = 2 * nz * nl - luz[2]
  const lampejo = f.tipo === 'mesa' ? 0 : Math.max(0, espelho) ** EXPOENTE_DO_LAMPEJO
  // A mesa é plana: as setas do lado da luz clareiam pelo lado, não pela normal.
  const lado = f.tipo === 'mesa' ? LADO_DA_MESA * Math.cos(f.angulo - luzNoChao) : 0
  return tomDoDesenho(f.tipo, f.k) + lado + PESO_DA_LUZ * (Math.max(0, nl) - LUZ_MEDIA) + PESO_DO_LAMPEJO * lampejo + (sorte - 0.5) * SORTE_DO_TOM
}

/** O fio de arco-íris na faceta: as cores apagadas de um canto ao outro, misturadas pouco. */
function texDoArcoIris(a: Ponto, b: Ponto): Textura {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy || 1
  return (_u, _v, x, y, _p, s) => {
    const cor = corDoArcoIris(((x - a[0]) * dx + (y - a[1]) * dy) / l2)
    s[0] += (cor[0] - s[0]) * PESO_DO_ARCO_IRIS
    s[1] += (cor[1] - s[1]) * PESO_DO_ARCO_IRIS
    s[2] += (cor[2] - s[2]) * PESO_DO_ARCO_IRIS
  }
}

export interface OpcoesDaPedra {
  readonly paleta: Paleta
  readonly detalhe: Detalhe
  /** A luz no referencial do desenho (`luzNoDesenho`). */
  readonly luz: Vetor
  readonly semente: number
  /** Quanto o tom de todas as facetas sobe ou desce (a pedra na encosta do monte que foge da luz). */
  readonly tom?: number
  /** O fio de arco-íris numa pipa do lado da sombra (só a pedra grande). */
  readonly arcoIris?: boolean
  /** A fresta entre as facetas (px); zero = sem fresta, com a borda escura em cada faceta. */
  readonly fresta?: number
  /** Onde a 3/4 lê o meio de cada peça da pedra (`comMeioEm`): por padrão o meio da pedra. */
  readonly meio?: Ponto
  /** A sombra que a pedra faz no que está debaixo dela (a pedra de cima no monte). */
  readonly projeta?: Projecao
  /**
   * O reflexo da culeta no meio da mesa. Por padrão, na lapidação inteira e na simples grande; no monte, só a pedra
   * grande de cima o leva (em todas, o meio escuro repetido virava um monte de arruelas).
   */
  readonly culeta?: boolean
  /**
   * A borda escura da pedra (padrão `CONTORNO_DA_PEDRA`). A pedra de cor escura caída no chão a leva mais leve: o
   * pixel meio transparente da beira dela, que o motor não levanta, passava do piso de luz.
   */
  readonly contorno?: number
}

/** O contorno da pedra: o escuro dela, um pouco mais fechado, e a borda dele mais escura (a pedra não some no chão claro). */
const ESCURO_DO_CONTORNO = 0.94
const CONTORNO_DA_PEDRA = 0.34
/** A borda escura de cada faceta quando não há fresta (a pedra miúda). */
const CONTORNO_DA_FACETA = 0.14
/** O tom do reflexo escuro da culeta no meio da mesa, e o raio (px) a partir do qual a lapidação simples o leva. */
const TOM_DA_CULETA = 0.2
/** A beira escura que fica em volta da pedra (px) e o tom da fresta entre as facetas, por dentro dela. */
const BEIRA_ESCURA = 0.7
const TOM_DA_FRESTA = 0.42
const RAIO_DA_CULETA_SIMPLES = 2.6

/** Desenha a pedra lapidada vista de cima: o contorno escuro, as facetas e o reflexo da culeta. */
export function pedraLapidada(L: Peca[], P: CriarPeca, pose: PoseDaPedra, o: OpcoesDaPedra): void {
  const facetas = facetasVistas(pose, o.detalhe)
  const [mx, my] = o.meio ?? [pose.x, pose.y]
  const noMeio = (f: Forma): Forma => comMeioEm(f, mx, my)
  const fresta = o.fresta ?? 0
  const escuro: Rgb = [o.paleta.escuro[0] * ESCURO_DO_CONTORNO, o.paleta.escuro[1] * ESCURO_DO_CONTORNO, o.paleta.escuro[2] * ESCURO_DO_CONTORNO]
  const casco = poligono(cascoConvexo(facetas.flatMap((f) => f.pontos)))
  L.push(P(noMeio(casco), { classe: 'liso', rgb: escuro }, { bisel: 0, contorno: o.contorno ?? CONTORNO_DA_PEDRA, semente: o.semente, ...(o.projeta === undefined ? {} : { projeta: o.projeta }) }))
  // Por dentro do contorno, a fresta entre as facetas mostra o meio-tom da pedra: a aresta, não um risco preto.
  if (fresta > 0) L.push(P(noMeio(encolhida(casco, BEIRA_ESCURA)), { classe: 'liso', rgb: corDoTom(o.paleta, TOM_DA_FRESTA) }, { bisel: 0, contorno: 0, semente: o.semente + 90 }))
  const luzNoChao = Math.atan2(o.luz[1], o.luz[0])
  // O fogo da pedra aparece do lado que foge da luz: a pipa (ou a faceta de coroa) mais virada para lá.
  let doArco = -1
  if (o.arcoIris === true) {
    let melhor = -Infinity
    facetas.forEach((f, i) => {
      if (f.tipo !== 'pipa' && f.tipo !== 'coroa') return
      const longe = -Math.cos(f.angulo - luzNoChao)
      if (longe > melhor) {
        melhor = longe
        doArco = i
      }
    })
  }
  facetas.forEach((f, i) => {
    const t = tomDaFaceta(f, o.luz, luzNoChao, hash(i, o.semente, 17)) + (o.tom ?? 0)
    const forma = fresta > 0 ? encolhida(poligono(f.pontos), fresta) : poligono(f.pontos)
    const arco = i === doArco ? { textura: texDoArcoIris(f.pontos[0], f.pontos[2]) } : {}
    L.push(P(noMeio(forma), { classe: 'liso', rgb: corDoTom(o.paleta, t) }, { bisel: 0, contorno: fresta > 0 ? 0 : CONTORNO_DA_FACETA, semente: o.semente + 1 + i, ...arco }))
  })
  if (o.culeta ?? (o.detalhe === 'inteira' || pose.raio >= RAIO_DA_CULETA_SIMPLES)) {
    const culeta = Array.from({ length: 8 }, (_, k): Ponto => {
      const a = MEIO_OITAVO + k * OITAVO
      const [x, y] = noLugar([CULETA * Math.cos(a), CULETA * Math.sin(a), COROA], pose)
      return [x, y]
    })
    L.push(P(noMeio(poligono(culeta)), { classe: 'liso', rgb: corDoTom(o.paleta, TOM_DA_CULETA + (o.tom ?? 0) * 0.5) }, { bisel: 0, contorno: 0, semente: o.semente + 60 }))
  }
}

// ---------- o brilho, a pérola, o ouro e a corrente ----------

/** A emissão branca do brilho: a cor fixa, sem a luz do chanfro nem a sombra das peças de cima. */
const emissaoBranca: Textura = (_u, _v, _x, _y, _p, s) => {
  s[0] = BRANCO[0]
  s[1] = BRANCO[1]
  s[2] = BRANCO[2]
  s[4] = 1
}

/** As pontas da estrelinha de brilho: a curta (diagonal), a cintura e o miolo redondo, em frações do braço comprido. */
const PONTA_CURTA = 0.42
const CINTURA = 0.13
const MIOLO_DO_BRILHO = 0.24
/** A borda macia do brilho (px). */
const BORDA_DO_BRILHO = 0.25

/** A estrelinha de brilho de quatro pontas (as diagonais curtas) com o miolo redondo, pintada em emissão. */
export function estrelinha(L: Peca[], P: CriarPeca, x: number, y: number, braco: number, semente: number, meio?: Ponto): void {
  const pontos: Ponto[] = []
  for (let i = 0; i < 16; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 8
    const r = i % 4 === 0 ? braco : i % 4 === 2 ? braco * PONTA_CURTA : braco * CINTURA
    pontos.push([x + Math.cos(a) * r, y + Math.sin(a) * r])
  }
  const [mx, my] = meio ?? [x, y]
  const miolo = braco * MIOLO_DO_BRILHO
  L.push(P(comMeioEm(poligono(pontos), mx, my), BRILHO, { bisel: 0, contorno: 0, suave: BORDA_DO_BRILHO, textura: emissaoBranca, semente }))
  L.push(P(comMeioEm(elipse(x, y, miolo, miolo), mx, my), BRILHO, { bisel: 0, contorno: 0, suave: BORDA_DO_BRILHO, textura: emissaoBranca, semente: semente + 1 }))
}

/** O ponto de luz da pérola: o raio e o quanto ele anda do meio para o lado da luz, em frações do raio. */
const PONTO_DA_PEROLA = 0.3
const DESVIO_DO_PONTO = 0.46
/** A sombra que a pérola faz no que está debaixo dela (fração do raio). */
const SOMBRA_DA_PEROLA = 0.5

/** A pérola: a esfera creme (o chanfro inteiro) e o ponto de luz do lado da luz. */
export function perola(L: Peca[], P: CriarPeca, x: number, y: number, r: number, luz: Vetor, semente: number, meio?: Ponto): void {
  const [mx, my] = meio ?? [x, y]
  L.push(P(comMeioEm(elipse(x, y, r, r), mx, my), PEROLA, { bisel: r, contorno: 0.24, semente, projeta: { dist: r * SOMBRA_DA_PEROLA, forca: 0.3, suave: r * 0.5 } }))
  const [lx, ly] = rumoDaLuz(luz)
  const rp = r * PONTO_DA_PEROLA
  L.push(P(comMeioEm(elipse(x + lx * DESVIO_DO_PONTO * r, y + ly * DESVIO_DO_PONTO * r, rp, rp), mx, my), BRILHO, { bisel: 0, contorno: 0, suave: rp * 0.7, textura: emissaoBranca, semente: semente + 1 }))
}

/** O ouro com chanfro: o material, a borda e o brilho de sempre. */
export function noOuro(bisel: number, semente: number, tom = 1): { bisel: number; contorno: number; metal: number; tom: number; semente: number } {
  return { bisel, contorno: 0.3, metal: BRILHO_DO_OURO, tom, semente }
}

/** Divisões de cada trecho da curva suave antes de andar por ela. */
const DIVISOES_DA_CURVA = 12

function catmullRom(p0: Ponto, p1: Ponto, p2: Ponto, p3: Ponto, t: number): Ponto {
  const t2 = t * t
  const t3 = t2 * t
  const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3)
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]
}

/** Pontos a cada `passo` px pela curva suave (Catmull-Rom) que passa pelos pontos, com o rumo da curva em cada um. */
export function aoLongo(pontos: readonly Ponto[], passo: number): [number, number, number][] {
  const n = pontos.length
  if (n < 2) return []
  const densa: Ponto[] = []
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = pontos[Math.max(0, i - 1)]
    const p3 = pontos[Math.min(n - 1, i + 2)]
    for (let s = 0; s < DIVISOES_DA_CURVA; s += 1) densa.push(catmullRom(p0, pontos[i], pontos[i + 1], p3, s / DIVISOES_DA_CURVA))
  }
  densa.push(pontos[n - 1])
  const saida: [number, number, number][] = []
  let t = 0
  for (let i = 1; i < densa.length; i += 1) {
    const [ax, ay] = densa[i - 1]
    const [bx, by] = densa[i]
    const trecho = Math.hypot(bx - ax, by - ay)
    if (trecho <= 1e-9) continue
    const rumo = Math.atan2(by - ay, bx - ax)
    while (t <= trecho) {
      saida.push([ax + ((bx - ax) * t) / trecho, ay + ((by - ay) * t) / trecho, rumo])
      t += passo
    }
    t -= trecho
  }
  return saida
}

/** As medidas do elo deitado (a argola vista de cima) e do elo de pé (visto de lado), em frações do elo. */
const ELO_COMPRIDO = 0.75
const ELO_LARGO = 0.5
const FURO_COMPRIDO = 0.4
const FURO_LARGO = 0.17
const ELO_DE_PE = 0.6
const GROSSURA_DO_ELO_DE_PE = 0.2
const CONTORNO_DO_ELO = 0.16

/**
 * A corrente de ouro pelos pontos (`aoLongo`): um elo deitado, um de pé, alternados; cada elo é uma peça, e a 3/4
 * sobe cada um pelo nível do meio dele. `meioDoElo` põe o meio dos primeiros elos noutro lugar (os que sobem com a
 * joia em que a corrente está presa).
 */
export function corrente(L: Peca[], P: CriarPeca, caminho: readonly [number, number, number][], elo: number, semente: number, meioDoElo?: (i: number) => Ponto | null): void {
  caminho.forEach(([x, y, rumo], i) => {
    const co = Math.cos(rumo)
    const si = Math.sin(rumo)
    const forma =
      i % 2 === 0
        ? menos(elipseGirada(x, y, elo * ELO_COMPRIDO, elo * ELO_LARGO, rumo), elipseGirada(x, y, elo * FURO_COMPRIDO, elo * FURO_LARGO, rumo))
        : capsula(x - co * elo * ELO_DE_PE, y - si * elo * ELO_DE_PE, x + co * elo * ELO_DE_PE, y + si * elo * ELO_DE_PE, elo * GROSSURA_DO_ELO_DE_PE)
    const meio = meioDoElo?.(i) ?? null
    // A borda do elo mais leve que a do ouro grande: o elo é quase só borda, e no chão a borda escura em meio-tom
    // (o pixel meio transparente, que o motor não levanta) passava do piso de luz.
    L.push(P(meio === null ? forma : comMeioEm(forma, meio[0], meio[1]), OURO_VELHO, { ...noOuro(elo * 0.28, semente + i, 0.94 + 0.12 * hash(i, semente, 31)), contorno: CONTORNO_DO_ELO }))
  })
}

// ---------- o monte derramado no chão ----------

export interface Monte {
  /** A profundidade no ponto: 1 no meio, 0 na beira irregular, negativa fora. */
  readonly q: (x: number, y: number) => number
  /** Px por unidade de profundidade perto da beira (a forma de cada nível mede distância em px). */
  readonly escala: number
}

/** O monte enche esta fração da meia pegada (o resto é das peças soltas); a força dos lóbulos da beira. */
const CHEIO = 0.84
const LOBULO_DE_3 = 0.09
const LOBULO_DE_5 = 0.06
const LOBULO_SOLTO = 0.24
const ESCALA_DO_LOBULO_SOLTO = 1.7

/**
 * A poça: a elipse da pegada com a beira em lóbulos (dois senos e um ruído pelo ângulo). Esticada, a beira estica
 * com a pegada, como a poça do sangue no chão; as peças em cima têm tamanho fixo e só ficam mais numerosas.
 */
export function criarMonte(hw: number, hh: number, semente: number): Monte {
  const ax = hw * CHEIO
  const ay = hh * CHEIO
  const f3 = hash(semente, 1, 41) * 2 * Math.PI
  const f5 = hash(semente, 2, 41) * 2 * Math.PI
  const sx = hash(semente, 3, 41) * 50
  const sy = hash(semente, 4, 41) * 50
  return {
    escala: Math.min(ax, ay),
    q(x, y) {
      const u = x / ax
      const v = y / ay
      const rho = Math.sqrt(u * u + v * v)
      if (rho < 1e-9) return 1
      const th = Math.atan2(v, u)
      const borda =
        1 + LOBULO_DE_3 * Math.sin(3 * th + f3) + LOBULO_DE_5 * Math.sin(5 * th + f5) + LOBULO_SOLTO * ruido((u / rho) * ESCALA_DO_LOBULO_SOLTO + sx, (v / rho) * ESCALA_DO_LOBULO_SOLTO + sy)
      return 1 - rho / borda
    },
  }
}

/** Um nível da 3/4: a profundidade a partir da qual a coisa está nele e a altura dele (px). */
export interface NivelDoMonte {
  readonly de: number
  readonly z: number
}

/** O monte de profundidade `de` para dentro, como forma (distância em px perto da beira). */
export function formaDoMonte(monte: Monte, de: number, caixa: Caixa): Forma {
  return { b: caixa, d: (x, y) => (de - monte.q(x, y)) * monte.escala }
}

/** O nível da coisa de profundidade `q` (-1 = fora do monte, no chão). */
export function nivelDe(niveis: readonly NivelDoMonte[], q: number): number {
  let k = -1
  niveis.forEach((n, i) => {
    if (q >= n.de) k = i
  })
  return k
}

/** A altura de uma coisa do monte na profundidade `q`: a encosta de cúpula, de 0 na beira até `alto` no meio. */
export function alturaNoMonte(q: number, alto: number): number {
  const t = Math.min(1, Math.max(0, q))
  return alto * (1 - (1 - t) * (1 - t))
}

/** A luz que a encosta do monte recebe no ponto, menos a do chão plano: positiva do lado da luz, negativa do de lá. */
export function luzDaEncosta(monte: Monte, alto: number, luz: Vetor, x: number, y: number): number {
  const altura = (px: number, py: number): number => alturaNoMonte(monte.q(px, py), alto)
  const hx = (altura(x + 1, y) - altura(x - 1, y)) / 2
  const hy = (altura(x, y + 1) - altura(x, y - 1)) / 2
  return (-hx * luz[0] - hy * luz[1] + luz[2]) / Math.hypot(hx, hy, 1) - luz[2]
}

/** As direções em que se procura o degrau mais alto que a peça toca, e até onde (fração do raio). */
const OITO: readonly Ponto[] = Array.from({ length: 8 }, (_, i): Ponto => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)])
const ALCANCE_DO_DEGRAU = 0.65

/**
 * O degrau de uma peça do monte de raio `r`: o mais alto que o disco dela toca, e um ponto dela nesse degrau (o meio
 * que a 3/4 lê, `comMeioEm`). Pelo meio, a peça na divisa de dois degraus era cortada pela beira do de cima na 3/4
 * (o tampo de cada degrau cobre o de baixo) e o monte virava uma pilha de travesseiros; subindo com o de cima, ela
 * passa por cima da divisa, como a pedra que rola em cima das outras.
 */
export function degrauDaPeca(monte: Monte, niveis: readonly NivelDoMonte[], x: number, y: number, r: number): { k: number; meio: Ponto } {
  let k = nivelDe(niveis, monte.q(x, y))
  let meio: Ponto = [x, y]
  for (const [ux, uy] of OITO) {
    const px = x + ux * r * ALCANCE_DO_DEGRAU
    const py = y + uy * r * ALCANCE_DO_DEGRAU
    const kk = nivelDe(niveis, monte.q(px, py))
    if (kk > k) {
      k = kk
      meio = [px, py]
    }
  }
  return { k, meio }
}

/** Quanto a caixa das estruturas passa da pegada para o sul (todas até o mesmo sul: a 3/4 pinta a mais alta por cima). */
const ALEM_DO_SUL = 6
/** A força da sombra da beira do monte no chão e a do contato. */
const FORCA_DA_SOMBRA_DO_MONTE = 0.24
const FORCA_DO_CONTATO_DO_MONTE = 0.26
/** O passo (px) da busca de um ponto dentro de cada faixa de nível. */
const PASSO_DA_BUSCA = 0.5

/** O fundo do monte: a massa que aparece entre as peças. */
export interface FundoDoMonte {
  readonly material: MaterialDaPeca
  readonly textura: Textura
  readonly contorno: number
}

/** Um ponto na faixa do nível `k` (o de dentro: o meio), para a 3/4 subir o fundo desse nível com ele. */
function pontoDoNivel(monte: Monte, niveis: readonly NivelDoMonte[], k: number, hw: number): Ponto {
  const ate = k + 1 < niveis.length ? niveis[k + 1].de : Infinity
  for (let x = 0; x <= hw; x += PASSO_DA_BUSCA) {
    const q = monte.q(x, 0)
    if (q >= niveis[k].de && q < ate) return [x, 0]
  }
  return [0, 0]
}

/**
 * O chão do monte: as estruturas da 3/4 (a beira, coluna baixa com a sombra no chão; as de dentro, tampos soltos
 * sem sombra, todas com a caixa até o mesmo sul) e o FUNDO de cada nível, a massa que aparece entre as peças. Os
 * fundos têm a mesma cor e a mesma textura (lida no ponto), então de cima são uma peça só; na 3/4 cada um sobe com
 * o nível dele e o degrau mostra o fundo do nível de baixo. Tem de vir antes de tudo na cena (fica por baixo).
 * `sombraAte` é para onde vai a sombra do miolo (já desgirada).
 */
export function chaoDoMonte(cena: Cena, P: CriarPeca, hw: number, hh: number, monte: Monte, niveis: readonly NivelDoMonte[], fundo: FundoDoMonte, sombraAte: Ponto, semente: number): void {
  const caixa: Caixa = [-hw - 1, -hh - 1, hw + 1, hh + ALEM_DO_SUL]
  niveis.forEach((n, k) => {
    const forma = formaDoMonte(monte, n.de, caixa)
    cena.sombras.push(k === 0 ? { forma, z: n.z, forca: FORCA_DA_SOMBRA_DO_MONTE } : { forma, z: n.z, solta: true, forca: 0 })
  })
  const beira = formaDoMonte(monte, niveis[0].de, caixa)
  // A sombra do miolo, mais alto, arrastada à mão (sem altura: não vira estrutura).
  const miolo = formaDoMonte(monte, niveis[Math.min(1, niveis.length - 1)].de, caixa)
  cena.sombras.push(contato(beira, FORCA_DO_CONTATO_DO_MONTE), { forma: arrastada(miolo, sombraAte[0], sombraAte[1]), z: 0, suave: 2.2, forca: FORCA_DA_SOMBRA_DO_MONTE })
  niveis.forEach((n, k) => {
    const [mx, my] = pontoDoNivel(monte, niveis, k, hw)
    const forma = comMeioEm(formaDoMonte(monte, n.de, [-hw - 1, -hh - 1, hw + 1, hh + 1]), mx, my)
    cena.partes.push(P(forma, fundo.material, { bisel: 0, contorno: k === 0 ? fundo.contorno : 0, textura: fundo.textura, semente: semente + k }))
  })
}
