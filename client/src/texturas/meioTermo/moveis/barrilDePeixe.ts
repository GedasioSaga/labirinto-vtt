/**
 * BARRIL DE PEIXE de cima com volume (lote 9 dos objetos novos, 11/11/2026): o barril do peixeiro na feira,
 * ABERTO, cheio de peixe na salmoura. De cima: o bojo de aduelas com os dois aros (como o barril do
 * catálogo), a borda das aduelas e, dentro, a salmoura turva com os PEIXES prateados em leque (a roda de
 * baixo, meio afundada, com a cabeça na parede e o rabo no meio, e a de cima, desencontrada), cada um com o
 * lombo escuro, a barriga clara, as escamas, a guelra, o olho e o rabo; o brilho da água entre eles e os
 * cristais de sal por cima. A borda faz sombra no peixe do lado da luz. Ao lado, a TAMPA de tábuas
 * encostada no barril, o PUÇÁ deitado no chão e os respingos de salmoura no chão.
 *
 * Não é o barril (`barril.ts`): lá o que se vê é a tampa fechada de madeira; aqui é o prateado do peixe em
 * roda dentro do aro, e a tampa está fora, encostada. O caixote de peixe do porto (outro lote) é de tábuas
 * e retangular; este é redondo e de aduelas.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) o barril é uma coluna da altura do barril do catálogo e leva o peixe;
 * a tampa encostada é uma coluna mais baixa, na frente dele; o puçá e os respingos ficam no chão.
 *
 * Materiais: `madeira` e `aros` (os do barril). A salmoura, o peixe, o sal e o puçá são fixos. As medidas
 * saem da pegada (1 x 1 casa de partida): o barril esticado vira elipse, como o do catálogo.
 */
import { hash, limitar01, type Rgb } from '../../ruido'
import { anel, capsula, elipse, elipseGirada, menos, poligono, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { materialDaPeca, PREGO, QUARTO, type MontarMovel } from './contexto'

// ---------- medidas ----------

/** A altura do barril (a do barril do catálogo) e a da tampa encostada, em casas. */
const ALTURA_DO_BARRIL = 0.62
const ALTURA_DA_TAMPA = 0.42
/** O meio do barril (frações da meia pegada, um pouco para o fundo à esquerda) e o raio (fração da meia pegada). */
const MEIO_DO_BARRIL = { x: -0.12, y: -0.14 } as const
const RAIO_DO_BARRIL = 0.7
/** Os anéis do barril visto de cima, em fração do raio: os aros, a borda das aduelas e a boca. */
const ARO_DE_FORA: readonly [number, number] = [0.985, 0.93]
const ARO_DE_DENTRO: readonly [number, number] = [0.885, 0.835]
const BORDA: readonly [number, number] = [0.836, 0.72]
const BOCA = 0.725
/** A largura da aduela (px do protótipo), a do barril do catálogo. */
const ADUELA = 5.6
/** A sombra da borda no peixe, do lado da luz: o quanto ela entra (px) e a força. */
const SOMBRA_DA_BORDA = 2.6
const FORCA_DA_SOMBRA_DA_BORDA = 0.4

// ---------- as cores ----------

/** A salmoura turva (verde-acinzentada: sal e escama na água) e o brilho dela. */
const SALMOURA: MaterialDaPeca = { classe: 'liso', rgb: [0x48, 0x58, 0x52] }
const BRILHO: MaterialDaPeca = { classe: 'liso', rgb: [0xee, 0xf2, 0xee] }
/** O peixe: o flanco prateado, o lombo azulado e a barriga clara (os dois pela textura), o rabo e o olho. */
const FLANCO: Rgb = [0xa6, 0xb2, 0xb4]
const LOMBO: Rgb = [0x50, 0x64, 0x72]
const BARRIGA: Rgb = [0xe4, 0xe6, 0xdf]
/** O peixe de baixo, meio afundado na salmoura: o flanco puxado para a cor dela. */
const FLANCO_AFUNDADO: Rgb = [0x88, 0x98, 0x96]
const RABO: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x86, 0x8a] }
const IRIS: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xd8, 0xcc] }
const PUPILA: MaterialDaPeca = { classe: 'liso', rgb: [0x2a, 0x28, 0x26] }
const GUELRA: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x46, 0x4a] }
/** O sal grosso, os respingos (o chão molhado escurece) e o fio da rede do puçá. */
const SAL: MaterialDaPeca = { classe: 'liso', rgb: [0xf2, 0xf0, 0xe8] }
const MOLHADO: MaterialDaPeca = { classe: 'liso', rgb: [0x36, 0x30, 0x2a] }
const FIO_DA_REDE: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xb4, 0x8e] }
const FERRO = materialDaPeca('ferro')
const CABO_DO_PUCA = materialDaPeca('pinho')

/** Abaixo desta escala (pixels da imagem por px do protótipo) o detalhe miúdo cai em menos de 2 pixels e vira chuvisco. */
const ESCALA_DO_DETALHE = 1.5

function misturarEm(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

// ---------- o peixe ----------

/**
 * O contorno do corpo, do pedúnculo do rabo à boca: [ao comprido, meia largura], em frações do comprimento e
 * da largura do peixe (o mais largo um pouco para a cabeça, como a sardinha).
 */
const CORPO_DO_PEIXE: readonly Ponto[] = [
  [-0.36, 0.12],
  [-0.2, 0.32],
  [0, 0.46],
  [0.15, 0.5],
  [0.32, 0.42],
  [0.44, 0.24],
  [0.5, 0.04],
]
/** O rabo em V, do pedúnculo para trás: os três cantos de cada lóbulo, nas mesmas frações. */
const RABO_DO_PEIXE: readonly Ponto[] = [
  [-0.34, 0.08],
  [-0.52, 0.46],
  [-0.47, 0],
  [-0.52, -0.46],
  [-0.34, -0.08],
]
/** Onde ficam o olho e a guelra, ao comprido (fração do comprimento), e o raio do olho (fração da largura). */
const LUGAR_DO_OLHO = 0.36
const LUGAR_DA_GUELRA = 0.27
const RAIO_DO_OLHO = 0.26
/** As escamas: o passo ao comprido (px do protótipo) e quantas fileiras de través. */
const PASSO_DA_ESCAMA = 1.05
const FILEIRAS_DE_ESCAMAS = 3.2

/**
 * O flanco do peixe deitado (o meio em (cx, cy), no giro `ang`, de meia largura `meia`): o lombo escuro do lado
 * `lado` e a barriga clara do outro, a linha do meio e as fileiras de escamas.
 */
function texDoPeixe(cx: number, cy: number, ang: number, meia: number, lado: number): Textura {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return (_u, _v, x, y, _p, s, escala) => {
    const ao = (x - cx) * co + (y - cy) * si
    const atraves = ((-(x - cx) * si + (y - cy) * co) / meia) * lado
    misturarEm(s, LOMBO, limitar01((atraves - 0.12) / 0.62) * 0.88)
    misturarEm(s, BARRIGA, limitar01((-atraves - 0.22) / 0.55) * 0.75)
    if (escala < ESCALA_DO_DETALHE) return
    const linha = Math.abs(atraves - 0.06)
    if (linha < 0.07) s[3] -= 0.1 * (1 - linha / 0.07)
    const fileira = Math.floor((atraves + 1) * FILEIRAS_DE_ESCAMAS)
    const fase = ao / PASSO_DA_ESCAMA + (fileira & 1) * 0.5
    const f = fase - Math.floor(fase)
    if (f < 0.24) s[3] -= 0.09 * (1 - f / 0.24)
  }
}

interface Peixe {
  /** O meio do peixe, o giro (a cabeça para o lado do giro), o comprimento e a largura (px do protótipo). */
  readonly x: number
  readonly y: number
  readonly ang: number
  readonly comprimento: number
  readonly largura: number
  /** O de baixo, meio afundado na salmoura. */
  readonly afundado: boolean
}

/** Um peixe inteiro: o rabo, o corpo de escamas, a guelra e o olho com o ponto de luz. */
function montarPeixe(P: CriarPeca, L: Peca[], f: Peixe, sem: number): void {
  const co = Math.cos(f.ang)
  const si = Math.sin(f.ang)
  // O lombo fica para um lado ou para o outro, sorteado: o peixe ora mostra um flanco, ora o outro.
  const lado = hash(sem, 1, 9311) < 0.5 ? -1 : 1
  const em = ([ao, atraves]: Ponto): Ponto => {
    const a = ao * f.comprimento
    const t = atraves * f.largura * lado
    return [f.x + a * co - t * si, f.y + a * si + t * co]
  }
  const projeta = f.afundado ? { dist: 0.6, forca: 0.24, suave: 0.6 } : { dist: 0.9, forca: 0.32, suave: 0.7 }
  L.push(P(poligono(RABO_DO_PEIXE.map(em)), RABO, { bisel: 0.4, tom: f.afundado ? 0.84 : 1, contorno: 0.28, semente: sem, projeta }))
  const contorno = [...CORPO_DO_PEIXE.map(em), ...[...CORPO_DO_PEIXE].reverse().map(([ao, t]) => em([ao, -t]))]
  L.push(P(poligono(contorno), { classe: 'liso', rgb: f.afundado ? FLANCO_AFUNDADO : FLANCO }, {
    bisel: f.largura * 0.42,
    contorno: 0.3,
    metal: f.afundado ? 0.16 : 0.32,
    tom: f.afundado ? 0.9 : 1,
    textura: texDoPeixe(f.x, f.y, f.ang, f.largura * 0.5, lado),
    semente: sem + 1,
    projeta,
  }))
  const [gx, gy] = em([LUGAR_DA_GUELRA, 0])
  L.push(P(elipseGirada(gx, gy, f.largura * 0.08, f.largura * 0.4, f.ang), GUELRA, { bisel: 0, contorno: 0, alfa: 0.55, semente: sem + 2 }))
  const [ox, oy] = em([LUGAR_DO_OLHO, 0.1])
  const raio = f.largura * RAIO_DO_OLHO
  L.push(P(elipse(ox, oy, raio, raio), IRIS, { bisel: 0.2, contorno: 0.12, semente: sem + 3 }))
  L.push(P(elipse(ox, oy, raio * 0.6, raio * 0.6), PUPILA, { bisel: 0, contorno: 0 }))
  L.push(P(elipse(ox - raio * 0.25, oy - raio * 0.25, raio * 0.22, raio * 0.22), BRILHO, { bisel: 0, contorno: 0 }))
}

/**
 * As duas rodas de peixe, com a cabeça na parede e o rabo para o meio: quantos em cada uma, o meio de cada
 * peixe em fração do raio da boca, o comprimento e a largura (frações do raio da boca) e o quanto cada roda gira
 * (fração do passo). A de baixo aparece entre as cabeças da de cima, que é desencontrada dela.
 */
const RODA_DE_BAIXO = { peixes: 11, meio: 0.64, comprimento: 0.66, largura: 0.2, giro: 0.5 } as const
const RODA_DE_CIMA = { peixes: 11, meio: 0.6, comprimento: 0.66, largura: 0.21, giro: 0 } as const
/**
 * Os peixes soltos por cima, deitados lado a lado no meio (o peixeiro jogou de volta): tapam o encontro dos
 * rabos, que sozinho deixava a roda com cara de flor. Quase no mesmo rumo e fora do centro, para não virarem
 * os ponteiros de um relógio no tamanho de mesa. [x, y] em fração do raio da boca, o giro e o comprimento.
 */
const SOLTOS: readonly (readonly [number, number, number, number])[] = [
  [-0.1, -0.14, 0.28, 0.72],
  [0.08, 0.16, 0.42, 0.66],
]

// ---------- a salmoura, o sal e os respingos ----------

/** A salmoura: turva, com manchas mais claras (a escama e o sal boiando). */
const texDaSalmoura: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.18 + p.su, y * 0.18) * 0.12 + ruido(x * 0.6, y * 0.6 + p.sv) * 0.05
}

/** Os brilhos da água entre os peixes, perto da parede: [ângulo, distância (fração da boca), meio comprimento, meia largura] (px). */
const BRILHOS: readonly (readonly [number, number, number, number])[] = [
  [2.2, 0.86, 1.8, 0.45],
  [3.9, 0.84, 1.4, 0.4],
  [5.6, 0.88, 1.6, 0.42],
]
/** Os cristais de sal: quantos no peixe e na borda, e o lado de cada um (px do protótipo). */
const SAL_NO_PEIXE = 10
const SAL_NA_BORDA = 4
const LADO_DO_SAL = 0.5

/** Os respingos no chão: [x, y] (frações da meia pegada) e o raio (px) de cada mancha; as menores são pingos. */
const RESPINGOS: readonly (readonly [number, number, number])[] = [
  [0.42, 0.84, 3.4],
  [0.68, 0.62, 2.2],
  [-0.3, 0.74, 2.6],
  [0.2, 0.92, 1.1],
  [0.86, 0.36, 1],
  [-0.72, 0.36, 0.9],
  [0.58, 0.96, 0.8],
]

// ---------- o puçá ----------

/** O aro do puçá (meio em frações da meia pegada, raio em px) e o cabo até a ponta (frações da meia pegada). */
const ARO_DO_PUCA = { x: -0.62, y: 0.7, raio: 6.2 } as const
const PONTA_DO_CABO = { x: -0.95, y: -0.2 } as const
/** A malha da rede: o passo e a grossura do fio (px do protótipo). */
const MALHA = 1.55
const FIO = 0.34

/** A rede do puçá: os fios em losango e os vãos vazados (mostram o chão); de longe, um véu meio transparente. */
function texDaRede(cx: number, cy: number, raio: number): Textura {
  return (_u, _v, x, y, _p, s, escala) => {
    const fundo = Math.hypot(x - cx, y - cy) / raio
    s[3] -= 0.16 * (1 - fundo)
    if (escala < ESCALA_DO_DETALHE) {
      s[5] = 0.55
      return
    }
    const a = (x + y) / MALHA
    const b = (x - y) / MALHA
    const fa = Math.abs(a - Math.round(a)) * MALHA
    const fb = Math.abs(b - Math.round(b)) * MALHA
    const noFio = Math.min(fa, fb)
    s[5] = limitar01(1 - (noFio - FIO) / 0.25)
  }
}

// ---------- o barril ----------

export const montarBarrilDePeixe: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const L = cena.partes
  const mad = c.m.madeira
  const aro = c.m.aros
  const bx = MEIO_DO_BARRIL.x * hw
  const by = MEIO_DO_BARRIL.y * hh
  const rx = RAIO_DO_BARRIL * hw
  const ry = RAIO_DO_BARRIL * hh
  const R = Math.min(rx, ry)
  const polar = { cx: bx, cy: by, r: R }
  const madeira = texturaDaClasse('madeira')

  // Os respingos, primeiro: o chão molhado fica por baixo de tudo.
  RESPINGOS.forEach(([fx, fy, raio], k) => {
    const x = fx * hw
    const y = fy * hh
    const mancha = elipseGirada(x, y, raio * (1 + 0.4 * hash(k, 1, 9341)), raio * (0.7 + 0.3 * hash(k, 2, 9341)), hash(k, 3, 9341) * Math.PI)
    L.push(P(mancha, MOLHADO, { bisel: 0, contorno: 0, alfa: 0.34, suave: 0.9, semente: 9340 + k }))
    if (raio > 1.5) L.push(P(elipse(x - raio * 0.3, y - raio * 0.25, raio * 0.18, raio * 0.12), BRILHO, { bisel: 0, contorno: 0, alfa: 0.4, suave: 0.4 }))
  })

  // O puçá deitado no chão: o cabo, o aro de ferro e a rede vazada.
  const ax = ARO_DO_PUCA.x * hw
  const ay = ARO_DO_PUCA.y * hh
  const ra = ARO_DO_PUCA.raio
  const angDoCabo = Math.atan2(PONTA_DO_CABO.y * hh - ay, PONTA_DO_CABO.x * hw - ax)
  const [cbx, cby] = [ax + Math.cos(angDoCabo) * ra, ay + Math.sin(angDoCabo) * ra]
  const cabo = capsula(cbx, cby, PONTA_DO_CABO.x * hw, PONTA_DO_CABO.y * hh, 0.85)
  cena.sombras.push(contato(cabo, 0.3), contato(elipse(ax, ay, ra, ra), 0.18))
  L.push(P(elipse(ax, ay, ra * 0.93, ra * 0.93), FIO_DA_REDE, { bisel: 0, contorno: 0, textura: texDaRede(ax, ay, ra), semente: 9350 }))
  L.push(P(cabo, CABO_DO_PUCA, { eixo: angDoCabo, tabua: 0, bisel: 0.7, contorno: 0.3, semente: 9351, projeta: { dist: 0.8, forca: 0.3 } }))
  L.push(P(capsula(cbx, cby, cbx + Math.cos(angDoCabo) * 1.6, cby + Math.sin(angDoCabo) * 1.6, 1.05), FERRO, { bisel: 0.5, contorno: 0.3, metal: 0.35, semente: 9352 }))
  L.push(P(anel(ax, ay, ra, ra, ra - 0.9, ra - 0.9), FERRO, { bisel: 0.45, contorno: 0.3, metal: 0.35, semente: 9353, projeta: { dist: 0.7, forca: 0.28 } }))

  // O barril: o bojo de aduelas, os dois aros e a borda das aduelas (como o barril do catálogo, sem a tampa).
  const H = g * ALTURA_DO_BARRIL
  const bojo = elipse(bx, by, rx, ry)
  cena.sombras.push({ forma: bojo, z: H }, contato(bojo))
  L.push(P(bojo, mad, { polar, tabua: ADUELA, bisel: R * 0.3, semente: 9300 }))
  L.push(P(anel(bx, by, rx * ARO_DE_FORA[0], ry * ARO_DE_FORA[0], rx * ARO_DE_FORA[1], ry * ARO_DE_FORA[1]), aro, { bisel: 0.9, contorno: 0.3, semente: 9301 }))
  L.push(P(anel(bx, by, rx * ARO_DE_DENTRO[0], ry * ARO_DE_DENTRO[0], rx * ARO_DE_DENTRO[1], ry * ARO_DE_DENTRO[1]), aro, { bisel: 0.8, contorno: 0.3, semente: 9302 }))
  L.push(P(anel(bx, by, rx * BORDA[0], ry * BORDA[0], rx * BORDA[1], ry * BORDA[1]), mad, { polar, tabua: ADUELA, bisel: 1, luz: 0.07, semente: 9303 }))

  // A boca: a salmoura turva, funda (a borda faz sombra nela do lado da luz), e os brilhos perto da parede.
  const bxr = rx * BOCA
  const byr = ry * BOCA
  const ri = Math.min(bxr, byr)
  L.push(P(elipse(bx, by, bxr, byr), SALMOURA, { bisel: 0, contorno: 0.2, textura: texDaSalmoura, recesso: { k: 2.6, forca: 0.4 }, semente: 9304 }))
  BRILHOS.forEach(([a, d, meio, meia], k) => {
    L.push(P(elipseGirada(bx + Math.cos(a) * d * bxr, by + Math.sin(a) * d * byr, meio, meia, a + QUARTO), BRILHO, { bisel: 0, contorno: 0, alfa: 0.36, suave: 0.6, semente: 9305 + k }))
  })

  // O peixe em leque: a roda de baixo (meio afundada) e a de cima, desencontrada.
  for (const [roda, afundado, sem] of [[RODA_DE_BAIXO, true, 9400], [RODA_DE_CIMA, false, 9600]] as const) {
    const passo = (Math.PI * 2) / roda.peixes
    for (let i = 0; i < roda.peixes; i += 1) {
      const k = sem + i * 8
      const ang = (i + roda.giro) * passo + 0.35 + (hash(k, 4, 9311) - 0.5) * passo * 0.3
      const d = roda.meio * (0.94 + 0.12 * hash(k, 5, 9311))
      montarPeixe(P, L, {
        x: bx + Math.cos(ang) * d * bxr,
        y: by + Math.sin(ang) * d * byr,
        ang,
        comprimento: roda.comprimento * ri * (0.92 + 0.14 * hash(k, 6, 9311)),
        largura: roda.largura * ri,
        afundado,
      }, k)
    }
  }
  SOLTOS.forEach(([fx, fy, ang, comprimento], i) => {
    montarPeixe(P, L, { x: bx + fx * bxr, y: by + fy * byr, ang, comprimento: comprimento * ri, largura: RODA_DE_CIMA.largura * ri * 1.08, afundado: false }, 9800 + i * 8)
  })

  // O sal grosso: cristais no peixe e na borda das aduelas.
  for (let i = 0; i < SAL_NO_PEIXE + SAL_NA_BORDA; i += 1) {
    const naBorda = i >= SAL_NO_PEIXE
    const a = hash(i, 1, 9371) * Math.PI * 2
    const d = naBorda ? (BORDA[0] + BORDA[1]) / 2 : Math.sqrt(hash(i, 2, 9371)) * 0.86
    const x = bx + Math.cos(a) * d * (naBorda ? rx : bxr)
    const y = by + Math.sin(a) * d * (naBorda ? ry : byr)
    const l = LADO_DO_SAL * (0.7 + 0.6 * hash(i, 3, 9371))
    const giro = hash(i, 4, 9371) * Math.PI
    const cristal: Ponto[] = [0, 1, 2, 3].map((q): Ponto => [x + Math.cos(giro + q * QUARTO) * l, y + Math.sin(giro + q * QUARTO) * l])
    L.push(P(poligono(cristal), SAL, { bisel: 0.3, contorno: 0.24, semente: 9372 + i }))
  }

  // A sombra da borda no peixe, do lado da luz (em cima à esquerda): o que a boca deslocada para longe da luz não cobre.
  const sombra = menos(elipse(bx, by, bxr, byr), elipse(bx + SOMBRA_DA_BORDA * 0.79, by + SOMBRA_DA_BORDA * 0.61, bxr, byr))
  L.push(P(sombra, MOLHADO, { bisel: 0, contorno: 0, alfa: FORCA_DA_SOMBRA_DA_BORDA, suave: 1, semente: 9380 }))

  // A tampa de tábuas encostada no barril, embaixo à direita: de cima, o disco inclinado vira uma elipse estreita.
  const angDaTampa = Math.PI / 4
  const rTampa = R * BOCA * 1.06
  const meiaTampa = rTampa * 0.36
  const longe = R + meiaTampa * 0.42
  const tx = bx + Math.cos(angDaTampa) * longe * (rx / R)
  const ty = by + Math.sin(angDaTampa) * longe * (ry / R)
  const giroDaTampa = angDaTampa - QUARTO
  const tampa = elipseGirada(tx, ty, rTampa, meiaTampa, giroDaTampa)
  cena.sombras.push({ forma: tampa, z: g * ALTURA_DA_TAMPA, forca: 0.26 }, contato(tampa, 0.28))
  L.push(P(tampa, mad, {
    eixo: giroDaTampa,
    tabua: meiaTampa * 0.7,
    bisel: 1.2,
    tom: 1.04,
    contorno: 0.26,
    textura: (u, v, x, y, p, s, escala) => {
      if (madeira !== null) madeira(u, v, x, y, p, s, escala)
      // A borda de cima da tampa, a que encosta no barril, pega menos luz: a tampa inclina para lá.
      s[3] -= 0.12 * limitar01(((x - tx) * -Math.cos(angDaTampa) + (y - ty) * -Math.sin(angDaTampa)) / meiaTampa)
    },
    semente: 9390,
    projeta: { dist: 1.2, forca: 0.3 },
  }))
  // A travessa do meio (a pega) e os pregos dela.
  const co = Math.cos(giroDaTampa)
  const si = Math.sin(giroDaTampa)
  const travessa = elipseGirada(tx, ty, rTampa * 0.62, meiaTampa * 0.24, giroDaTampa)
  L.push(P(travessa, mad, { eixo: giroDaTampa, tabua: 0, bisel: 0.7, tom: 0.86, contorno: 0.3, semente: 9391, projeta: { dist: 0.8, forca: 0.32 } }))
  for (const lado of [-1, 1]) L.push(P(elipse(tx + co * lado * rTampa * 0.5, ty + si * lado * rTampa * 0.5, 0.45, 0.45), PREGO, { bisel: 0.4, contorno: 0, metal: 0.2 }))
}
