/**
 * CANTEIRO DE FLORES de cima com volume (lote 7 dos objetos novos, 11/11/2026):
 * um canteiro de jardim NO CHÃO, de forma orgânica (um feijão, sem quina), com
 * a borda de PEDRAS ROLIÇAS deitadas ao longo da beira, a terra escura por
 * dentro e as MOITAS de flor, cada uma de uma cor (rosa, amarelo, branco e
 * violeta, contidos) e com a folhagem dela: a copa redonda em três tons (como a
 * sebe) ou o tufo de folhas compridas com as espigas. Entre as moitas sobra
 * terra, com umas pétalas caídas, e por cima voam duas BORBOLETAS pintadas.
 *
 * Não é a jardineira (`jardineira.ts`, uma caixa de tábuas com uma fileira de
 * flores) nem o vaso (`vaso.ts`): não tem madeira nem barro, não tem quina, e
 * as flores vêm em moitas de cores e folhas diferentes.
 *
 * Na 3/4 (`tresQuartos.ts`; o perfil tem de ser `{ modo: 'derivado',
 * espessura: 0 }`): cada pedra é uma coluna baixa, e cada moita sobe a altura
 * dela, presa a um PINO (um tampo solto minúsculo, sem sombra, escondido
 * debaixo da folhagem). A 3/4 lê o meio da caixa de cada peça para saber com
 * quem ela sobe, então as peças da moita levam a caixa centrada no pino
 * (`comMeioEm`). O LADO da moita é desenhado aqui, e não varrido: o PÉ, uma
 * mancha de folha escura com umas flores, fica no chão, escondido debaixo da
 * copa na vista de cima, e aparece quando ela sobe. Varrida pela 3/4, a
 * frente seria uma parede de um tom só, com a beira escura que na sebe
 * (`sebe.ts`) caía abaixo do piso de luz e virava marrom; aqui o piso de luz
 * fica o da nogueira, que é o certo para a terra e para as pedras. As
 * borboletas sobem mais que a moita em que estão: ficam no ar, com a sombra
 * delas na moita.
 *
 * Lê `c.giro` (o quarto de volta que a 3/4 pinta, e que só chega nela): o lado
 * claro das copas, o pé das moitas e a sombra das borboletas ficam no lugar NA
 * TELA com o canteiro girado.
 *
 * As pedras têm tamanho próprio: o canteiro esticado ganha mais pedras, nunca
 * pedras esticadas. As moitas acompanham a pegada. Material: `pedras`; a
 * terra, as folhas, as flores e as borboletas são fixas.
 */
import { hash, rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { capsula, dentroDe, elipse, elipseGirada, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type Cena, type CriarPeca, type MaterialDaPeca, type Sombra, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'

const VOLTA = Math.PI * 2
/** O ângulo de ouro: pontos espalhados em espiral, sem fileira nem roda. */
const ANGULO_DE_OURO = 2.39996

// ---------- a beira do canteiro ----------

/** O expoente da superelipse: acima de 2 ela enche mais a pegada que a elipse, ainda sem quina. */
const ARREDONDADO = 2.5
/** Até onde a beira vai, em fração do meio lado, e as ondas que fazem dela um feijão: [quantas por volta, tamanho, fase]. */
const BEIRA_MEDIA = 0.885
const ONDAS_DA_BEIRA: readonly (readonly [number, number, number])[] = [
  [2, 0.06, -0.6],
  [3, 0.05, 1.2],
]

/** A beira na direção `a` (o ângulo no quadro em que a pegada é um quadrado), em fração do meio lado. */
function beira(a: number): number {
  let fracao = BEIRA_MEDIA
  for (const [vezes, tamanho, fase] of ONDAS_DA_BEIRA) fracao += tamanho * Math.cos(vezes * a + fase)
  return fracao
}

/** O ponto da beira na direção `a`. */
function pontoDaBeira(hw: number, hh: number, a: number): Ponto {
  const co = Math.cos(a)
  const si = Math.sin(a)
  const t = beira(a) / (Math.abs(co) ** ARREDONDADO + Math.abs(si) ** ARREDONDADO) ** (1 / ARREDONDADO)
  return [hw * t * co, hh * t * si]
}

/**
 * O canteiro, `recuo` px para dentro da beira. A distância é aproximada (o
 * quanto falta para a beira, dividido pela inclinação): certa perto da beira,
 * que é onde a cobertura e o contorno a leem.
 */
function formaDoCanteiro(hw: number, hh: number, recuo: number): Forma {
  const fundo = recuo - Math.min(hw, hh) * BEIRA_MEDIA
  return {
    b: [-hw, -hh, hw, hh],
    d(x, y) {
      const nx = Math.abs(x) / hw
      const ny = Math.abs(y) / hh
      const soma = nx ** ARREDONDADO + ny ** ARREDONDADO
      if (soma < 1e-9) return fundo
      const ro = soma ** (1 / ARREDONDADO)
      const k = ro ** (1 - ARREDONDADO)
      const gx = (k * nx ** (ARREDONDADO - 1)) / hw
      const gy = (k * ny ** (ARREDONDADO - 1)) / hh
      return (ro - beira(Math.atan2(y / hh, x / hw))) / Math.sqrt(gx * gx + gy * gy) + recuo
    },
  }
}

// ---------- formas e caixas ----------

/** Círculo com a distância exata: a copa de uma moita mede vários por pixel, e a conta da elipse custa mais. */
function circulo(cx: number, cy: number, r: number): Forma {
  return {
    b: [cx - r, cy - r, cx + r, cy + r],
    d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r,
  }
}

/** A união de várias formas numa só (um contorno só por fora). */
function varias(formas: readonly Forma[]): Forma {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const f of formas) {
    x0 = Math.min(x0, f.b[0])
    y0 = Math.min(y0, f.b[1])
    x1 = Math.max(x1, f.b[2])
    y1 = Math.max(y1, f.b[3])
  }
  return {
    b: [x0, y0, x1, y1],
    d(x, y) {
      let menor = Infinity
      for (const f of formas) {
        const v = f.d(x, y)
        if (v < menor) menor = v
      }
      return menor
    },
  }
}

/** A mesma forma com outra caixa de pintura (tem de conter a forma inteira). */
function naCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: (x, y) => f.d(x, y) }
}

/**
 * A forma com a caixa crescida até o meio dela cair em (cx, cy). A 3/4 lê o
 * meio da caixa para saber com que estrutura a peça sobe: assim a flor da
 * ponta da moita sobe com o pino do meio dela.
 */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - f.b[0], f.b[2] - cx)
  const my = Math.max(cy - f.b[1], f.b[3] - cy)
  return naCaixa(f, [cx - mx, cy - my, cx + mx, cy + my])
}

/** O raio do pino de cada moita e de cada borboleta (px do protótipo): cabe debaixo da menor folha. */
const RAIO_DO_PINO = 0.5
/** Quanto a caixa da peça que fica no chão cresce para um lado: o meio dela sai de cima do pino. */
const FOLGA_DO_PINO = 3

/** A peça que NÃO sobe com o pino que está no meio dela (o pé da moita): a caixa cresce para a esquerda. */
function foraDoPino(f: Forma): Forma {
  return naCaixa(f, [f.b[0] - FOLGA_DO_PINO, f.b[1], f.b[2], f.b[3]])
}

/** O pino: só diz à 3/4 a altura de quem tem o meio da caixa nele. Sem sombra no chão. */
function pino(x: number, y: number, z: number): Sombra {
  return { forma: circulo(x, y, RAIO_DO_PINO), z, solta: true, forca: 0, suave: 0.1 }
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de
 * volta que a 3/4 pinta (`c.giro`, que só chega nela), como no biombo: o lado
 * claro das copas, o pé das moitas e a sombra das borboletas ficam onde a luz
 * e quem olha os põem, com o canteiro girado ou não.
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** `n` pontos espalhados em espiral em volta de (cx, cy), até a distância `ate`. */
function espalhados(n: number, cx: number, cy: number, ate: number, fase: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i < n; i += 1) {
    const longe = ate * Math.sqrt((i + 0.6) / n)
    const a = fase + i * ANGULO_DE_OURO
    pontos.push([cx + Math.cos(a) * longe, cy + Math.sin(a) * longe])
  }
  return pontos
}

// ---------- a terra e as pedras ----------

/** A terra do canteiro: a lenha do Meio-Termo um pouco baixa, escura mas acima do piso de luz mesmo na sombra das moitas. */
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('lenha', 0.94)) }
/** A terra vai até o meio das pedras (px do protótipo para dentro da beira). */
const RECUO_DA_TERRA = 2.6

/** Terra revolvida: torrões em duas escalas e uns grãos soltos, claros e escuros. */
const texDaTerra: Textura = (_u, _v, x, y, _p, s) => {
  let luz = ruido(x * 0.23 + 11, y * 0.23 + 5) * 0.17 + ruido(x * 0.7 + 3, y * 0.7 + 29) * 0.08
  const grao = hash(Math.floor(x * 0.9), Math.floor(y * 0.9), 53)
  if (grao > 0.94) luz -= 0.09
  else if (grao < 0.05) luz += 0.08
  s[3] += luz
}

/** Uma pedra a cada tanto da beira (px do protótipo), quantas amostras medem a volta e o mínimo de pedras. */
const PASSO_DAS_PEDRAS = 8.2
const AMOSTRAS_DA_BEIRA = 360
const PEDRAS_MINIMAS = 8
/** A pedra: a meia largura (de fora para dentro) e o meio comprimento, em vezes o meio passo (elas se encostam). */
const MEIA_LARGURA_DA_PEDRA = { minima: 2.5, varia: 0.9 } as const
const MEIO_COMPRIMENTO_DA_PEDRA = { minimo: 1, varia: 0.22 } as const
/** A altura da pedra em casas (pedra de rio, de um palmo) e quanto o tom muda de uma para outra. */
const ALTURA_DA_PEDRA = 0.07
const TOM_DA_PEDRA = { minimo: 0.88, varia: 0.28 } as const

interface Pedra {
  readonly x: number
  readonly y: number
  readonly comprida: number
  readonly larga: number
  readonly giro: number
  readonly tom: number
}

/** As pedras deitadas ao longo da beira, repartidas pelo comprimento dela, com a beira de fora de cada uma na beira do canteiro. */
function pedrasDaBorda(hw: number, hh: number): Pedra[] {
  const pontos: Ponto[] = []
  const ate: number[] = [0]
  for (let i = 0; i <= AMOSTRAS_DA_BEIRA; i += 1) {
    pontos.push(pontoDaBeira(hw, hh, (i / AMOSTRAS_DA_BEIRA) * VOLTA))
    if (i > 0) ate.push(ate[i - 1] + Math.hypot(pontos[i][0] - pontos[i - 1][0], pontos[i][1] - pontos[i - 1][1]))
  }
  const volta = ate[AMOSTRAS_DA_BEIRA]
  const n = Math.max(PEDRAS_MINIMAS, Math.round(volta / PASSO_DAS_PEDRAS))
  const passo = volta / n
  const pedras: Pedra[] = []
  let j = 0
  for (let i = 0; i < n; i += 1) {
    const s = (i + 0.5) * passo
    while (j < AMOSTRAS_DA_BEIRA - 1 && ate[j + 1] < s) j += 1
    const [ax, ay] = pontos[j]
    const [bx, by] = pontos[j + 1]
    const trecho = ate[j + 1] - ate[j] || 1
    const t = (s - ate[j]) / trecho
    const px = ax + (bx - ax) * t
    const py = ay + (by - ay) * t
    // Para dentro: a normal da beira que aponta para o meio do canteiro.
    let nx = -(by - ay) / trecho
    let ny = (bx - ax) / trecho
    if (nx * px + ny * py > 0) {
      nx = -nx
      ny = -ny
    }
    const larga = MEIA_LARGURA_DA_PEDRA.minima + MEIA_LARGURA_DA_PEDRA.varia * hash(i, n, 71)
    pedras.push({
      x: px + nx * larga,
      y: py + ny * larga,
      comprida: (passo / 2) * (MEIO_COMPRIMENTO_DA_PEDRA.minimo + MEIO_COMPRIMENTO_DA_PEDRA.varia * hash(i, n, 72)),
      larga,
      giro: Math.atan2(by - ay, bx - ax),
      tom: TOM_DA_PEDRA.minimo + TOM_DA_PEDRA.varia * hash(i, n, 73),
    })
  }
  return pedras
}

// ---------- as moitas ----------

type Folhagem = 'copa' | 'tufo'
type Flor = 'petalas' | 'miudas' | 'espigas' | 'nenhuma'

interface Moita {
  /** O meio, em fração do meio lado da pegada, e o raio, em fração do menor meio lado. */
  readonly x: number
  readonly y: number
  readonly raio: number
  /** Quanto sobe na 3/4, em casas. */
  readonly altura: number
  readonly folhagem: Folhagem
  readonly verde: MaterialDaPeca
  readonly flor: Flor
  readonly cor: MaterialDaPeca
}

/** As folhas: o buxo e o alfeneiro da sebe e o oliva da jardineira. */
const BUXO = materialDaPeca('buxo')
const ALFENEIRO = materialDaPeca('alfeneiro')
const OLIVA: MaterialDaPeca = { classe: 'folha', rgb: [0x5a, 0x74, 0x46] }
/** As flores, nos tons contidos da vila (saturação HSV até 0,48), e o miolo delas. */
const ROSA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#d49ab4') }
const AMARELA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#d8c070') }
const BRANCA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#ece6d6') }
const VIOLETA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#a88cc6') }
const MIOLO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#c9a24f') }

/** As sete moitas, do fundo para a frente (a de baixo na lista fica por cima), deixando terra à mostra no meio. */
const MOITAS: readonly Moita[] = [
  { x: -0.06, y: -0.44, raio: 0.3, altura: 0.12, folhagem: 'tufo', verde: OLIVA, flor: 'espigas', cor: VIOLETA },
  { x: -0.5, y: -0.24, raio: 0.4, altura: 0.2, folhagem: 'copa', verde: BUXO, flor: 'petalas', cor: ROSA },
  { x: 0.37, y: -0.27, raio: 0.38, altura: 0.18, folhagem: 'copa', verde: ALFENEIRO, flor: 'petalas', cor: AMARELA },
  { x: -0.66, y: 0.2, raio: 0.19, altura: 0.07, folhagem: 'tufo', verde: ALFENEIRO, flor: 'nenhuma', cor: BRANCA },
  { x: 0.6, y: 0.2, raio: 0.3, altura: 0.12, folhagem: 'tufo', verde: OLIVA, flor: 'espigas', cor: VIOLETA },
  { x: 0.13, y: 0.3, raio: 0.4, altura: 0.19, folhagem: 'copa', verde: BUXO, flor: 'petalas', cor: BRANCA },
  { x: -0.37, y: 0.4, raio: 0.31, altura: 0.14, folhagem: 'copa', verde: ALFENEIRO, flor: 'miudas', cor: AMARELA },
]

/** A copa: o miolo e os lóbulos em volta dele (fração do raio da moita). */
const LOBULOS = 7
const MIOLO_DA_COPA = 0.68
const LUGAR_DO_LOBULO = { meio: 0.6, varia: 0.05 } as const
const RAIO_DO_LOBULO = { minimo: 0.34, varia: 0.07 } as const
/** Os três tons da copa, como na sebe: a massa, a copa puxada para a luz e o realce em parte delas. */
const TOM_DA_MASSA = 0.84
const CONTORNO_DA_MASSA = 0.18
const COPA = { raio: 0.88, puxaX: 0.15, puxaY: 0.17 } as const
const REALCE = { raio: 0.3, puxaX: 0.36, puxaY: 0.4, tom: 1.16, quantos: 0.6 } as const
/** A sombra da moita na terra e nas moitas de trás. */
const SOMBRA_DA_MOITA = { dist: 2.2, forca: 0.24, suave: 1.5 } as const
/**
 * O pé da moita (o lado dela na 3/4): a própria massa encolhida em volta do
 * meio (cabe inteira debaixo dela na vista de cima) e descida um pouco, num
 * tom entre o da massa e a sombra; e as flores do lado, menores e mais baixas
 * (fração do raio da moita, na tela: ficam do lado de quem olha). Nenhuma cai
 * perto do pino de uma borboleta, em nenhum dos quatro giros: a flor que
 * caísse nele subia com ela.
 */
const PE_DA_COPA = { encolhe: 0.82, desce: 0.04, tom: 0.76, contorno: 0.12 } as const
const FLORES_DO_PE: readonly Ponto[] = [[-0.46, 0.14], [-0.14, 0.44], [0.2, 0.38], [0.5, 0.12]]
const FLOR_DO_PE = { raio: 0.125, tom: 0.88 } as const

/** O tufo: as folhas compridas saindo do meio (fração do raio da moita) e os tons delas, uma a uma. */
const FOLHAS_DO_TUFO = 12
const FOLHA_DO_TUFO = { minima: 0.78, varia: 0.24, larga: 0.11 } as const
const TONS_DO_TUFO: readonly number[] = [0.86, 1, 1.12]
const PE_DO_TUFO = { raio: 0.46, tom: 0.72 } as const

/** As flores: quantas por moita, até onde se espalham e o tamanho (fração do raio da moita). */
const PETALAS = { quantas: 6, ate: 0.62, raio: 0.235, miolo: 0.36 } as const
const MIUDAS = { quantas: 17, ate: 0.8, raio: 0.085 } as const
const ESPIGAS = { quantas: 9, de: 0.42, ate: 0.86, comprida: 0.2, larga: 0.085 } as const

interface Lugar {
  readonly cx: number
  readonly cy: number
  readonly r: number
  readonly sem: number
}

/** A flor de 5 pétalas da jardineira: cinco círculos a meio raio do meio, numa forma só. */
function florDeCincoPetalas(x: number, y: number, R: number, giro: number): Forma {
  const petalas: Forma[] = []
  for (let k = 0; k < 5; k += 1) {
    const a = giro + (k * VOLTA) / 5
    petalas.push(circulo(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5, R * (k % 2 ? 0.45 : 0.55)))
  }
  return varias(petalas)
}

/** O miolo da flor: amarelo na rosa e na branca, mel na amarela. */
function mioloDe(cor: MaterialDaPeca): MaterialDaPeca {
  return cor === AMARELA ? MIOLO : AMARELA
}

/** A copa redonda: o pé no chão (com as flores do lado), a massa (um contorno só), as copas puxadas para a luz e os realces. */
function plantarCopa(L: Cena['partes'], P: CriarPeca, m: Moita, { cx, cy, r, sem }: Lugar, giro: number): void {
  const lobulos: { x: number; y: number; r: number }[] = [{ x: cx, y: cy, r: r * MIOLO_DA_COPA }]
  const fase = hash(sem, 1, 31) * VOLTA
  for (let k = 0; k < LOBULOS; k += 1) {
    const a = fase + (k / LOBULOS) * VOLTA
    const longe = r * (LUGAR_DO_LOBULO.meio + LUGAR_DO_LOBULO.varia * (hash(k, sem, 32) - 0.5))
    lobulos.push({ x: cx + Math.cos(a) * longe, y: cy + Math.sin(a) * longe, r: r * (RAIO_DO_LOBULO.minimo + RAIO_DO_LOBULO.varia * hash(k, sem, 33)) })
  }
  // O pé, no chão: de cima fica debaixo da massa.
  const { encolhe, desce } = PE_DA_COPA
  const [peX, peY] = desgirado(0, r * desce, giro)
  const pe = varias(lobulos.map((l) => circulo(cx + (l.x - cx) * encolhe + peX, cy + (l.y - cy) * encolhe + peY, l.r * encolhe)))
  L.push(P(foraDoPino(pe), m.verde, { bisel: 0, contorno: PE_DA_COPA.contorno, tom: PE_DA_COPA.tom, semente: sem }))
  if (m.flor !== 'nenhuma') {
    for (const [i, [fx, fy]] of FLORES_DO_PE.entries()) {
      const [ox, oy] = desgirado(fx * r, fy * r, giro)
      const flor = circulo(cx + ox, cy + oy, r * FLOR_DO_PE.raio)
      L.push(P(flor, m.cor, { bisel: 0.6, contorno: 0.16, tom: FLOR_DO_PE.tom, semente: sem + 90 + i }))
    }
  }
  const massa = varias(lobulos.map((l) => circulo(l.x, l.y, l.r)))
  L.push(P(comMeioEm(massa, cx, cy), m.verde, { bisel: 0, contorno: CONTORNO_DA_MASSA, tom: TOM_DA_MASSA, semente: sem + 1, projeta: SOMBRA_DA_MOITA }))
  // A copa e o realce são puxados para a luz: para cima à esquerda NA TELA.
  const [copaX, copaY] = desgirado(-COPA.puxaX, -COPA.puxaY, giro)
  for (const [i, l] of lobulos.entries()) {
    const copa = dentroDe(circulo(l.x + copaX * l.r, l.y + copaY * l.r, l.r * COPA.raio), massa)
    L.push(P(comMeioEm(copa, cx, cy), m.verde, { bisel: 0, contorno: 0, semente: sem + 2 + i }))
  }
  const [realceX, realceY] = desgirado(-REALCE.puxaX, -REALCE.puxaY, giro)
  for (const [i, l] of lobulos.entries()) {
    if (hash(i, sem, 34) >= REALCE.quantos) continue
    const realce = dentroDe(circulo(l.x + realceX * l.r, l.y + realceY * l.r, l.r * REALCE.raio), massa)
    L.push(P(comMeioEm(realce, cx, cy), m.verde, { bisel: 0, contorno: 0, tom: REALCE.tom, semente: sem + 12 + i }))
  }
}

/** O tufo: o pé escuro no chão e as folhas compridas saindo do meio, cada uma num tom. */
function plantarTufo(L: Cena['partes'], P: CriarPeca, m: Moita, { cx, cy, r, sem }: Lugar): void {
  L.push(P(foraDoPino(circulo(cx, cy, r * PE_DO_TUFO.raio)), m.verde, { bisel: 0, contorno: 0.12, tom: PE_DO_TUFO.tom, semente: sem }))
  const fase = hash(sem, 2, 35) * VOLTA
  for (let k = 0; k < FOLHAS_DO_TUFO; k += 1) {
    // Uma sim, uma não: as folhas vizinhas não ficam uma em cima da outra na ordem da roda.
    const i = (k * 5) % FOLHAS_DO_TUFO
    const a = fase + (i / FOLHAS_DO_TUFO) * VOLTA + (hash(i, sem, 36) - 0.5) * 0.3
    const meia = (r * (FOLHA_DO_TUFO.minima + FOLHA_DO_TUFO.varia * hash(i, sem, 37))) / 2
    const folha = elipseGirada(cx + Math.cos(a) * meia, cy + Math.sin(a) * meia, meia, r * FOLHA_DO_TUFO.larga, a)
    L.push(P(comMeioEm(folha, cx, cy), m.verde, { bisel: 0.5, contorno: 0.16, tom: TONS_DO_TUFO[k % TONS_DO_TUFO.length], semente: sem + 1 + k, projeta: k === 0 ? SOMBRA_DA_MOITA : undefined }))
  }
}

/** As flores da moita, por cima da folhagem. */
function florir(L: Cena['partes'], P: CriarPeca, m: Moita, { cx, cy, r, sem }: Lugar): void {
  const fase = hash(sem, 3, 38) * VOLTA
  if (m.flor === 'petalas') {
    const R = r * PETALAS.raio
    for (const [i, [x, y]] of espalhados(PETALAS.quantas, cx, cy, r * PETALAS.ate, fase).entries()) {
      L.push(P(comMeioEm(florDeCincoPetalas(x, y, R, i * 0.9 + fase), cx, cy), m.cor, { bisel: R * 0.3, contorno: 0.16, tom: 0.97, semente: sem + 40 + i }))
      L.push(P(comMeioEm(circulo(x, y, R * PETALAS.miolo), cx, cy), mioloDe(m.cor), { bisel: 0, contorno: 0, semente: sem + 50 + i }))
    }
  } else if (m.flor === 'miudas') {
    const raio = r * MIUDAS.raio
    for (const [i, [x, y]] of espalhados(MIUDAS.quantas, cx, cy, r * MIUDAS.ate, fase).entries()) {
      L.push(P(comMeioEm(circulo(x, y, raio), cx, cy), m.cor, { bisel: raio * 0.7, contorno: 0.14, tom: i % 3 === 0 ? 0.9 : 1.02, semente: sem + 40 + i }))
    }
  } else if (m.flor === 'espigas') {
    for (let i = 0; i < ESPIGAS.quantas; i += 1) {
      const a = fase + (i / ESPIGAS.quantas) * VOLTA + (hash(i, sem, 39) - 0.5) * 0.4
      const longe = r * (ESPIGAS.de + (ESPIGAS.ate - ESPIGAS.de) * hash(i, sem, 40))
      const espiga = elipseGirada(cx + Math.cos(a) * longe, cy + Math.sin(a) * longe, r * ESPIGAS.comprida, r * ESPIGAS.larga, a)
      L.push(P(comMeioEm(espiga, cx, cy), m.cor, { bisel: 0.6, contorno: 0.18, tom: i % 2 ? 0.86 : 1.02, semente: sem + 40 + i }))
    }
  }
}

// ---------- as borboletas ----------

interface Borboleta {
  /**
   * A moita em que ela está (o lugar em `MOITAS`) e onde, em fração do raio da
   * moita, NA TELA. Sempre à frente do meio da moita (y positivo): a 3/4 pinta
   * do norte para o sul, e a borboleta atrás do pino da moita sumia debaixo da
   * copa dela.
   */
  readonly moita: number
  readonly x: number
  readonly y: number
  /** Quanto ela voa acima da moita, em casas: a que voa alto aparece acima da copa, na 3/4. */
  readonly voo: number
  /** Para onde a cabeça aponta (radianos). */
  readonly giro: number
  readonly asa: MaterialDaPeca
  readonly pinta: MaterialDaPeca
}

/** As duas borboletas: a branca-da-couve, creme com a pinta escura, e a azulada com a pinta clara. */
const BORBOLETAS: readonly Borboleta[] = [
  { moita: 1, x: 0.28, y: 0.14, voo: 0.3, giro: -0.6, asa: { classe: 'liso', rgb: rgb('#f0e8cc') }, pinta: { classe: 'liso', rgb: rgb('#6a5a48') } },
  { moita: 5, x: 0.32, y: 0.1, voo: 0.16, giro: 0.95, asa: { classe: 'liso', rgb: rgb('#93abc9') }, pinta: { classe: 'liso', rgb: rgb('#e6e0cf') } },
]
/** O corpo e as antenas. */
const CORPO_DA_BORBOLETA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#5a4838') }
/** As asas (px do protótipo): a de trás e a da frente, cada uma com a abertura (radianos a partir da cabeça), a distância do meio e os dois raios. */
const ASA_DE_TRAS = { abre: 2.15, longe: 1.45, comprida: 1.75, larga: 1.3 } as const
const ASA_DA_FRENTE = { abre: 1.1, longe: 1.85, comprida: 2.4, larga: 1.55 } as const
const PINTA_DA_ASA = { longe: 3.1, raio: 0.62 } as const
const MEIO_CORPO = 1.6
const RAIO_DO_CORPO = 0.42
/**
 * A sombra da borboleta na moita: o tamanho e a força. Cai para onde a sombra
 * do motor cairia (`SOMBRA_X`, `SOMBRA_Y` por px de voo), na tela. Redonda: o
 * canteiro gira, e a sombra não.
 */
const SOMBRA_DA_BORBOLETA = { raio: 2.5, alfa: 0.2, suave: 1.3 } as const
const COR_DA_SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [14, 11, 8] }

function soltarBorboleta(L: Cena['partes'], P: CriarPeca, b: Borboleta, x: number, y: number, sem: number): void {
  const asa = (forma: { abre: number; longe: number; comprida: number; larga: number }, lado: number, tom: number, k: number): void => {
    const a = b.giro + lado * forma.abre
    const f = elipseGirada(x + Math.cos(a) * forma.longe, y + Math.sin(a) * forma.longe, forma.comprida, forma.larga, a)
    L.push(P(comMeioEm(f, x, y), b.asa, { bisel: 0.5, contorno: 0.26, tom, semente: sem + k }))
  }
  for (const lado of [-1, 1]) asa(ASA_DE_TRAS, lado, 0.94, lado + 1)
  for (const lado of [-1, 1]) {
    asa(ASA_DA_FRENTE, lado, 1, lado + 4)
    const a = b.giro + lado * ASA_DA_FRENTE.abre
    const pinta = circulo(x + Math.cos(a) * PINTA_DA_ASA.longe, y + Math.sin(a) * PINTA_DA_ASA.longe, PINTA_DA_ASA.raio)
    L.push(P(comMeioEm(pinta, x, y), b.pinta, { bisel: 0, contorno: 0, semente: sem + 7 + lado }))
  }
  const co = Math.cos(b.giro)
  const si = Math.sin(b.giro)
  const corpo = capsula(x - co * MEIO_CORPO, y - si * MEIO_CORPO, x + co * MEIO_CORPO, y + si * MEIO_CORPO, RAIO_DO_CORPO)
  L.push(P(comMeioEm(corpo, x, y), CORPO_DA_BORBOLETA, { bisel: 0.3, contorno: 0.1, semente: sem + 9 }))
}

// ---------- o canteiro ----------

/** As pétalas caídas na terra: onde (fração do meio lado), de que cor e o raio (px do protótipo). */
const PETALAS_CAIDAS: readonly (readonly [number, number, MaterialDaPeca])[] = [
  [-0.16, -0.06, ROSA],
  [-0.04, 0.02, BRANCA],
  [0.1, -0.12, AMARELA],
  [-0.22, 0.1, ROSA],
  [0.36, 0.08, AMARELA],
  [-0.52, 0.34, BRANCA],
]
const RAIO_DA_PETALA_CAIDA = 0.6

export const montarCanteiroDeFlores: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const L = cena.partes
  const menor = Math.min(hw, hh)

  // A terra, até o meio das pedras, com as pétalas caídas.
  L.push(P(formaDoCanteiro(hw, hh, RECUO_DA_TERRA), TERRA, { bisel: 0, contorno: 0.14, textura: texDaTerra, semente: 7301 }))
  for (const [i, [x, y, cor]] of PETALAS_CAIDAS.entries()) {
    L.push(P(elipse(x * hw, y * hh, RAIO_DA_PETALA_CAIDA * 1.3, RAIO_DA_PETALA_CAIDA), cor, { bisel: 0, contorno: 0.1, tom: 0.94, semente: 7310 + i }))
  }

  // As pedras da borda: cada uma é uma coluna baixa, com a sombra dela na terra.
  for (const [i, p] of pedrasDaBorda(hw, hh).entries()) {
    const pedra = elipseGirada(p.x, p.y, p.comprida, p.larga, p.giro)
    cena.sombras.push({ forma: pedra, z: g * ALTURA_DA_PEDRA, forca: 0.24 }, contato(pedra, 0.26))
    L.push(P(pedra, c.m.pedras, { bisel: p.larga * 0.85, contorno: 0.28, tom: p.tom, semente: 7320 + i, projeta: { dist: 0.9, forca: 0.24, suave: 0.7 } }))
  }

  // As moitas, do fundo para a frente: o pé no chão, a folhagem e as flores presas ao pino.
  const lugares: Lugar[] = MOITAS.map((m, i) => ({ cx: m.x * hw, cy: m.y * hh, r: m.raio * menor, sem: 7400 + i * 100 }))
  for (const [i, m] of MOITAS.entries()) {
    const lugar = lugares[i]
    cena.sombras.push(pino(lugar.cx, lugar.cy, g * m.altura))
    if (m.folhagem === 'copa') plantarCopa(L, P, m, lugar, c.giro)
    else plantarTufo(L, P, m, lugar)
    florir(L, P, m, lugar)
  }

  // As borboletas: a sombra de cada uma sobe com a moita; ela, mais alto.
  for (const [i, b] of BORBOLETAS.entries()) {
    const { cx, cy, r } = lugares[b.moita]
    const [bx, by] = desgirado(b.x * r, b.y * r, c.giro)
    const x = cx + bx
    const y = cy + by
    const s = SOMBRA_DA_BORBOLETA
    const voo = g * b.voo
    const [sx, sy] = desgirado(SOMBRA_X * voo, SOMBRA_Y * voo, c.giro)
    L.push(P(comMeioEm(circulo(x + sx, y + sy, s.raio), cx, cy), COR_DA_SOMBRA, { bisel: 0, contorno: 0, alfa: s.alfa, suave: s.suave, semente: 7390 + i }))
    cena.sombras.push(pino(x, y, g * MOITAS[b.moita].altura + voo))
    soltarBorboleta(L, P, b, x, y, 7380 + i * 10)
  }
}
