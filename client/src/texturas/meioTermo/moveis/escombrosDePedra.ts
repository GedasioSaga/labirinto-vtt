/**
 * ESCOMBROS DE PEDRA de cima com volume (11/11/2026, lote 1 dos objetos
 * novos): o que sobrou de uma parede que caiu, o parente de pedra dos
 * destroços de madeira (`destrocos.ts`). Um PANO DE PAREDE ainda inteiro,
 * deitado (duas fiadas de blocos com a argamassa nas juntas e as pontas em
 * dente, por onde ele se soltou), os BLOCOS soltos tombados por cima e em
 * volta, cada um num ângulo, e no chão o PÓ, as lascas e as pedrinhas.
 *
 * Cada bloco mostra o topo e uma FACE do lado para onde tombou: clara se a
 * face olha para a luz (cima à esquerda), escura se olha para o outro lado. É
 * o que dá o volume a 25% de zoom e separa o monte de pedra do de madeira
 * (riscos cruzados) e do de sucata (chapas e rodas). A ponta partida é torta e
 * mais clara (a pedra por dentro), e alguns blocos guardam um resto de
 * argamassa numa beira.
 *
 * Material: `pedra`. As medidas saem do menor lado da pegada (2 x 2 casas de
 * partida) e as posições, de frações dela: o objeto esticado espalha o monte.
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { barra, dentroDe, elipseGirada, poligono, type Forma, type Ponto } from './formas'
import { contato, type Cena, type MaterialDaPeca, type Peca } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** A pedra por dentro, na quebra e nas lascas: a face puxada para um cinza claro e quente (a de fora pegou tempo e sujeira). */
const PEDRA_POR_DENTRO: Rgb = [0xd9, 0xd3, 0xc7]
const QUANTO_DE_DENTRO = 0.34
/** A argamassa das juntas: cal e areia, mais clara e mais quente que a pedra. */
const ARGAMASSA: Rgb = [0xcd, 0xc4, 0xb0]
const QUANTO_DE_ARGAMASSA = 0.6
/** O pó no chão: a cor da argamassa moída, meio transparente (o chão aparece por baixo). */
const PO: MaterialDaPeca = { classe: 'liso', rgb: [0xc6, 0xbe, 0xae] }
/**
 * O escuro em que o pixel escuro demais é levantado (o piso de luz): um cinza quente, de luminância linear
 * 0,056. Com o escuro de sempre (o da nogueira) a beira da pedra cinza, na sombra, saía marrom.
 */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]
/** De onde vem a luz no chão (cima à esquerda), para o tom da face do bloco. */
const LUZ_X = -0.79
const LUZ_Y = -0.61
/** O tom da face de lado: o do meio (a face que não olha nem para a luz nem contra) e quanto a luz o muda. */
const TOM_DA_FACE = 0.74
const LUZ_NA_FACE = 0.24
/** A junta de argamassa em volta de cada bloco do pano de parede (px do protótipo). */
const JUNTA = 1.1

/** Qual ponta do bloco partiu: nenhuma (0), a de trás (-1) ou a da frente (1). */
type Quebra = -1 | 0 | 1

interface Bloco {
  /** O meio, em frações da meia pegada. */
  readonly x: number
  readonly y: number
  /** Comprimento e largura do topo, em frações do menor meio lado. */
  readonly comp: number
  readonly larg: number
  readonly ang: number
  /** Para onde a face de lado aparece e quanto, em frações do menor meio lado: o lado para onde o bloco tombou. */
  readonly face: Ponto
  readonly quebra: Quebra
  /** Fica um resto de argamassa numa beira do topo. */
  readonly argamassa: boolean
  readonly tom: number
  /** Altura do topo em casas: os de cima fazem sombra mais longe. */
  readonly z: number
}

/** Os blocos soltos do chão, em volta do pano de parede e por baixo dele. */
const BLOCOS_DO_CHAO: readonly Bloco[] = [
  { x: 0.78, y: 0.12, comp: 0.26, larg: 0.19, ang: 1.3, face: [0.03, 0.07], quebra: 1, argamassa: false, tom: 0.9, z: 0.1 },
  { x: -0.8, y: 0.14, comp: 0.24, larg: 0.18, ang: -0.5, face: [-0.05, 0.05], quebra: -1, argamassa: false, tom: 1.02, z: 0.1 },
  { x: 0.5, y: -0.36, comp: 0.5, larg: 0.3, ang: 0.52, face: [0.04, 0.12], quebra: 1, argamassa: true, tom: 0.9, z: 0.2 },
  { x: -0.52, y: -0.44, comp: 0.44, larg: 0.29, ang: -0.9, face: [-0.1, 0.05], quebra: 0, argamassa: false, tom: 1.0, z: 0.2 },
  { x: 0.44, y: 0.52, comp: 0.46, larg: 0.27, ang: -0.25, face: [0.07, 0.1], quebra: -1, argamassa: false, tom: 0.86, z: 0.2 },
  { x: -0.5, y: 0.58, comp: 0.38, larg: 0.26, ang: 0.7, face: [0.02, 0.11], quebra: 1, argamassa: true, tom: 0.95, z: 0.18 },
]

/** Os blocos de cima do monte, tombados sobre o pano de parede: o último é o mais alto. */
const BLOCOS_DE_CIMA: readonly Bloco[] = [
  { x: 0.02, y: -0.4, comp: 0.5, larg: 0.3, ang: -0.12, face: [0.03, 0.12], quebra: 0, argamassa: true, tom: 1.04, z: 0.34 },
  { x: 0.2, y: 0.12, comp: 0.44, larg: 0.3, ang: 1.05, face: [0.1, 0.07], quebra: -1, argamassa: false, tom: 0.97, z: 0.4 },
  { x: -0.24, y: -0.04, comp: 0.36, larg: 0.25, ang: 0.4, face: [-0.07, 0.09], quebra: 1, argamassa: false, tom: 1.08, z: 0.46 },
]

/** O pano de parede caído: o meio (frações da meia pegada), o ângulo, a altura de uma fiada e a face de lado (frações do menor meio lado). */
const PANO = { x: -0.1, y: 0.2, ang: -0.3, fiada: 0.21, face: [0.03, 0.07] as Ponto, z: 0.14 }
/**
 * Os blocos do pano, em duas fiadas desencontradas: de onde até onde ao longo da fiada (frações do menor meio
 * lado), a fiada (0 a de trás, 1 a da frente) e a ponta partida. As pontas do pano ficam em dente.
 */
const BLOCOS_DO_PANO: readonly (readonly [number, number, 0 | 1, Quebra])[] = [
  [-0.62, -0.3, 0, 0],
  [-0.3, 0.06, 0, 0],
  [0.06, 0.4, 0, 1],
  [-0.46, -0.12, 1, -1],
  [-0.12, 0.24, 1, 0],
  [0.24, 0.58, 1, 0],
]

/** As lascas no chão: o meio (frações da meia pegada), o tamanho (fração do menor meio lado) e o ângulo. */
const LASCAS: readonly (readonly [number, number, number, number])[] = [
  [-0.86, -0.56, 0.07, 0.4],
  [0.9, -0.5, 0.055, 2.2],
  [0.86, 0.62, 0.075, -0.9],
  [-0.84, 0.74, 0.06, 1.4],
  [0.1, 0.9, 0.08, 0.2],
  [-0.2, -0.86, 0.06, -1.8],
  [0.64, -0.82, 0.05, 0.9],
  [-0.62, 0.2, 0.05, 2.8],
  [0.3, 0.84, 0.045, 1.9],
]
/** Pedrinhas espalhadas em volta do monte. */
const PEDRINHAS = 24

/** Pontos locais (x ao longo, y através) girados `ang` e postos em (cx, cy). */
function girados(pontos: readonly Ponto[], cx: number, cy: number, ang: number): Ponto[] {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return pontos.map(([x, y]) => [cx + x * co - y * si, cy + x * si + y * co])
}

/**
 * O topo de um bloco de meio comprimento `m` e meia largura `l`, no referencial dele: um retângulo um pouco
 * torto (pedra talhada à mão) e, na ponta partida, a quebra em três lances de fundo sorteado.
 */
function topoDoBloco(m: number, l: number, quebra: Quebra, sem: number): Ponto[] {
  const torto = (i: number): number => (hash(sem, i, 91) - 0.5) * l * 0.2
  const ponta = (lado: -1 | 1): Ponto[] => {
    if (quebra !== lado) return [[lado * m + torto(lado + 2), -lado * l + torto(lado + 4)], [lado * m + torto(lado + 6), lado * l + torto(lado + 8)]]
    return [
      [lado * m * (0.64 + 0.18 * hash(sem, 1, 92)), -lado * l],
      [lado * m * (0.94 + 0.06 * hash(sem, 2, 92)), -lado * l * (0.26 + 0.3 * hash(sem, 3, 92))],
      [lado * m * (0.7 + 0.12 * hash(sem, 4, 92)), lado * l * (0.12 + 0.3 * hash(sem, 5, 92))],
      [lado * m * (0.86 + 0.1 * hash(sem, 6, 92)), lado * l],
    ]
  }
  return [...ponta(1), ...ponta(-1)]
}

/** O casco convexo dos pontos (a cadeia monótona de Andrew): o contorno do bloco com a face de lado. */
function casco(pontos: readonly Ponto[]): Ponto[] {
  const ordenados = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const vira = (o: Ponto, a: Ponto, b: Ponto): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const metade = (lista: readonly Ponto[]): Ponto[] => {
    const cadeia: Ponto[] = []
    for (const p of lista) {
      while (cadeia.length >= 2 && vira(cadeia[cadeia.length - 2], cadeia[cadeia.length - 1], p) <= 0) cadeia.pop()
      cadeia.push(p)
    }
    cadeia.pop()
    return cadeia
  }
  return [...metade(ordenados), ...metade([...ordenados].reverse())]
}

/** O tom da face de lado que olha para (dx, dy): mais clara virada para a luz, mais escura virada contra. */
function tomDaFace([dx, dy]: Ponto): number {
  const l = Math.hypot(dx, dy) || 1
  return TOM_DA_FACE + LUZ_NA_FACE * ((dx / l) * LUZ_X + (dy / l) * LUZ_Y)
}

/** O corpo do bloco (o topo arrastado para o lado da face): a sombra no chão e a peça da face, por baixo do topo. */
function corpoDoBloco(c: ContextoDoMovel, cena: Cena, L: Peca[], topos: readonly Ponto[], face: Ponto, mat: MaterialDaPeca, tom: number, z: number, sem: number): void {
  const corpo = poligono(casco([...topos, ...topos.map(([x, y]): Ponto => [x + face[0], y + face[1]])]))
  cena.sombras.push({ forma: corpo, z, forca: 0.28 }, contato(corpo, 0.26))
  L.push(c.peca(corpo, mat, { tabua: 0, bisel: 0.9, tom: tom * tomDaFace(face), contorno: 0.34, semente: sem, projeta: { dist: 1 + z * 0.12, forca: 0.34 } }))
}

/** A faixa atravessada no bloco, de `de` a `ate` ao longo dele (px), girada com ele: recorta a quebra e a beira de argamassa. */
function faixa(cx: number, cy: number, ang: number, de: number, ate: number, larg: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return barra(cx + de * co, cy + de * si, cx + ate * co, cy + ate * si, larg)
}

function montarBloco(c: ContextoDoMovel, cena: Cena, L: Peca[], b: Bloco, pedra: MaterialDaPeca, k: number): void {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const cx = b.x * c.hw
  const cy = b.y * c.hh
  const m = (b.comp * R) / 2
  const l = (b.larg * R) / 2
  const pontos = girados(topoDoBloco(m, l, b.quebra, 40 + k), cx, cy, b.ang)
  const topo = poligono(pontos)
  corpoDoBloco(c, cena, L, pontos, [b.face[0] * R, b.face[1] * R], pedra, b.tom, c.g * b.z, 3000 + k * 4)
  L.push(P(topo, pedra, { eixo: b.ang, tabua: 0, bisel: 1.3, tom: b.tom, contorno: 0.22, semente: 3001 + k * 4 }))
  if (b.quebra !== 0) {
    // A ponta partida: a pedra por dentro, mais clara, só perto da quebra.
    const dentro: MaterialDaPeca = { ...pedra, rgb: misturar(pedra.rgb, PEDRA_POR_DENTRO, QUANTO_DE_DENTRO) }
    L.push(P(dentroDe(topo, faixa(cx, cy, b.ang, b.quebra * m * 0.5, b.quebra * (m + 1), l * 2 + 2)), dentro, { eixo: b.ang, tabua: 0, bisel: 0.7, tom: b.tom, contorno: 0.16, semente: 3002 + k * 4 }))
  }
  if (b.argamassa) {
    // O resto de argamassa grudado numa beira comprida: diz que o bloco saiu de uma parede.
    const cal: MaterialDaPeca = { classe: 'liso', rgb: misturar(pedra.rgb, ARGAMASSA, QUANTO_DE_ARGAMASSA) }
    const beira = faixa(cx - Math.sin(b.ang) * l * 0.86, cy + Math.cos(b.ang) * l * 0.86, b.ang, -m * 0.7, m * 0.5, l * 0.34)
    L.push(P(dentroDe(topo, beira), cal, { bisel: 0.5, contorno: 0.12, semente: 3003 + k * 4 }))
  }
}

/** O pano de parede: o corpo com a face de lado, a argamassa em volta de cada bloco e os blocos das duas fiadas. */
function montarPano(c: ContextoDoMovel, cena: Cena, L: Peca[], pedra: MaterialDaPeca): void {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const cx = PANO.x * c.hw
  const cy = PANO.y * c.hh
  const l = (PANO.fiada * R) / 2
  const cal: MaterialDaPeca = { classe: 'liso', rgb: misturar(pedra.rgb, ARGAMASSA, QUANTO_DE_ARGAMASSA) }
  const blocos = BLOCOS_DO_PANO.map(([de, ate, fiada, quebra], k) => {
    const m = ((ate - de) * R) / 2
    // O meio do bloco no referencial do pano (ao longo da fiada, através dela); `noPano` leva os pontos do bloco para o mapa.
    const [u, v] = [((de + ate) * R) / 2, (fiada - 0.5) * 2 * l]
    const topo = topoDoBloco(m - JUNTA / 2, l - JUNTA / 2, quebra, 70 + k)
    const comJunta = topo.map(([x, y]): Ponto => [x + Math.sign(x) * JUNTA, y + Math.sign(y) * JUNTA])
    const noPano = (pontos: readonly Ponto[]): Ponto[] => girados(pontos.map(([x, y]): Ponto => [x + u, y + v]), cx, cy, PANO.ang)
    return { topo: noPano(topo), comJunta: noPano(comJunta), quebra, m, meio: noPano([[0, 0]])[0] }
  })
  corpoDoBloco(c, cena, L, blocos.flatMap((b) => b.comJunta), [PANO.face[0] * R, PANO.face[1] * R], pedra, 0.9, c.g * PANO.z, 3100)
  for (const [k, b] of blocos.entries()) L.push(P(poligono(b.comJunta), cal, { bisel: 0, contorno: 0, semente: 3101 + k }))
  for (const [k, b] of blocos.entries()) {
    const topo = poligono(b.topo)
    const tom = 0.88 + 0.2 * hash(k, 7, 93)
    L.push(P(topo, pedra, { eixo: PANO.ang, tabua: 0, bisel: 1.2, tom, contorno: 0.2, semente: 3110 + k * 2 }))
    if (b.quebra === 0) continue
    const dentro: MaterialDaPeca = { ...pedra, rgb: misturar(pedra.rgb, PEDRA_POR_DENTRO, QUANTO_DE_DENTRO) }
    L.push(P(dentroDe(topo, faixa(b.meio[0], b.meio[1], PANO.ang, b.quebra * b.m * 0.5, b.quebra * (b.m + 1), l * 2 + 2)), dentro, { eixo: PANO.ang, tabua: 0, bisel: 0.7, tom, contorno: 0.16, semente: 3111 + k * 2 }))
  }
}

/** O contorno irregular de uma mancha de pó: `n` pontos em volta de (cx, cy). */
function mancha(cx: number, cy: number, rx: number, ry: number, n: number, sem: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i < n; i += 1) {
    const t = (i / n) * 2 * Math.PI
    const k = 0.8 + 0.24 * hash(i, sem, 94)
    pontos.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k])
  }
  return pontos
}

export const montarEscombrosDePedra: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const pedra = c.m.pedra
  const L = cena.partes

  cena.corDoPiso = ESCURO_DA_PEDRA
  // O pó primeiro, no chão: a mancha larga e fraca e a do meio, mais cheia, as duas de borda desfeita.
  L.push(P(poligono(mancha(0.02 * hw, 0.06 * hh, hw * 1.02, hh, 16, 1)), PO, { bisel: 0, contorno: 0, alfa: 0.3, suave: R * 0.12, semente: 3200 }))
  L.push(P(poligono(mancha(-0.06 * hw, 0.14 * hh, hw * 0.74, hh * 0.7, 14, 2)), PO, { bisel: 0, contorno: 0, alfa: 0.36, suave: R * 0.08, semente: 3201 }))

  // As lascas e as pedrinhas, soltas no pó.
  const dentro: MaterialDaPeca = { ...pedra, rgb: misturar(pedra.rgb, PEDRA_POR_DENTRO, QUANTO_DE_DENTRO) }
  LASCAS.forEach(([fx, fy, tamanho, ang], k) => {
    const r = tamanho * R
    const lasca = poligono(girados([[-r, -r * 0.6], [r * 0.5, -r * 0.7], [r, r * 0.1], [r * 0.2, r * 0.7], [-r * 0.8, r * 0.4]], fx * hw, fy * hh, ang))
    cena.sombras.push(contato(lasca, 0.24))
    L.push(P(lasca, k % 3 === 0 ? dentro : pedra, { eixo: ang, tabua: 0, bisel: 1.1, tom: 0.86 + 0.16 * hash(k, 3, 95), contorno: 0.3, semente: 3210 + k }))
  })
  for (let k = 0; k < PEDRINHAS; k += 1) {
    const t = ((k + hash(k, 1, 96) * 0.7) / PEDRINHAS) * 2 * Math.PI
    const longe = 0.52 + 0.46 * hash(k, 2, 96)
    const r = R * (0.016 + 0.022 * hash(k, 3, 96))
    const pedrinha = elipseGirada(Math.cos(t) * longe * hw, Math.sin(t) * longe * hh, r, r * 0.72, hash(k, 4, 96) * Math.PI)
    cena.sombras.push(contato(pedrinha, 0.22))
    L.push(P(pedrinha, k % 3 === 0 ? dentro : pedra, { tabua: 0, bisel: r * 0.7, tom: 0.84 + 0.24 * hash(k, 5, 96), contorno: 0.3, semente: 3230 + k }))
  }

  // O monte: os blocos do chão, o pano de parede e os blocos de cima.
  BLOCOS_DO_CHAO.forEach((bloco, k) => montarBloco(c, cena, L, bloco, pedra, k))
  montarPano(c, cena, L, pedra)
  BLOCOS_DE_CIMA.forEach((bloco, k) => montarBloco(c, cena, L, bloco, pedra, BLOCOS_DO_CHAO.length + k))
}
