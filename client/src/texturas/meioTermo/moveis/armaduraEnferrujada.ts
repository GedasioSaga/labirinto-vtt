/**
 * ARMADURA ENFERRUJADA de cima com volume (lote 11 dos objetos novos,
 * 11/11/2026): a armadura de um cavaleiro que ficou no chão tantos anos que o
 * capim já cresce por entre as peças. É a mesma armadura do manequim, mas
 * largada, vazia e comida de ferrugem: o PEITORAL deitado de costas, amassado
 * no peito e furado (um rombo de golpe e um furo que a ferrugem abriu), com a
 * quina do meio, as beiras viradas do pescoço e das cavas e as duas lâminas da
 * fralda, a de baixo solta e torta; o ELMO tombado de lado, com a abertura em
 * T e o vão escuro de dentro à mostra (está vazio); uma OMBREIRA de três
 * lâminas e uma MANOPLA soltas; a ESPADA partida em duas, o punho de couro com
 * o toco da lâmina e a ponta mais adiante, as duas bocas da quebra em dentes;
 * as CORREIAS de couro podre, uma ainda presa ao peitoral, outra solta com a
 * fivela. Por baixo, a terra manchada da ferrugem que escorreu; por entre as
 * peças e por cima das beiras, os tufos de CAPIM.
 *
 * O que diz "armadura" e não "sucata" a 25% de zoom é a SILHUETA: o peito que
 * afina na cintura, o elmo redondo com o T escuro e o risco claro da espada
 * com a guarda. A ferrugem (a da sucata) vem em manchas laranja e marrom
 * contidas sobre o cinza, nunca em listras, e o cinza sobra o bastante para
 * ler aço. Sem ossos e sem sangue: não há ninguém dentro.
 *
 * O desenho é feito em 84 x 56 px (1,5 x 1 casas): as posições saem de frações
 * da pegada (o objeto esticado espalha as peças) e o tamanho de cada peça, do
 * menor lado (a peça não entorta). A luz do aço (a cúpula de cada peça, a quina
 * do peito, as covas dos amassados) é pintada na textura, no rumo da luz do
 * motor; como a 3/4 pinta o quarto de volta na cena, o rumo é desgirado por
 * `c.giro`, e as sombras pintadas também (como nos ossos).
 *
 * Na vista 3/4 a armadura é rente ao chão, como os ossos: sobe inteira um
 * pouco (perfil derivado com `alturaSolta` de 0,035 casa) e a sombra fica no
 * chão. Por isso nenhuma sombra daqui tem altura: a de cada peça é pintada
 * afastada pela altura dela (`assentar`). Sem material no painel: o aço, a
 * ferrugem, o couro e o capim são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { cadeia, caixa, capsula, dentroDe, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** O tamanho em que a armadura é desenhada (px do protótipo): 1,5 x 1 casas. */
const LARGURA_DO_DESENHO = 84
const ALTURA_DO_DESENHO = 56

// ---------- os materiais fixos ----------

/** O aço velho, sem o polimento do manequim, e o da espada, um pouco mais claro (a lâmina é fina e foi afiada). */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0x8b, 0x8f, 0x90] }
const ACO_DA_LAMINA: MaterialDaPeca = { classe: 'metal', rgb: [0x9e, 0xa2, 0xa3] }
/** O vão escuro (as aberturas e o oco do elmo, os furos) e o couro podre das correias e do punho. */
const VAO: MaterialDaPeca = { classe: 'liso', rgb: [0x3e, 0x39, 0x35] }
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x52, 0x3c] }
/**
 * A ferrugem, puxada para o marrom alaranjado (a da sucata, #935f47, sobre o aço claro lia como mancha de
 * sangue) e a funda, onde ela já come o ferro.
 */
const FERRUGEM: Rgb = rgb('#9a6a46')
const FERRUGEM_FUNDA: Rgb = rgb('#6a4630')
/** A terra em volta, manchada da ferrugem que a chuva levou. */
const TERRA_ENFERRUJADA: MaterialDaPeca = { classe: 'liso', rgb: [0x7a, 0x58, 0x40] }
/** O capim: o verde do musgo, um verde mais claro e o capim seco (cada tufo sorteia o seu). */
const VERDES_DO_CAPIM: readonly Rgb[] = [[0x78, 0x88, 0x50], [0x8e, 0x9c, 0x60], [0xa6, 0x93, 0x63]]
/** As peças saem um pouco maiores que no desenho de 84 x 56: espalhadas no tamanho real, a armadura sumia no chão. */
const ESCALA_DAS_PECAS = 1.18
/**
 * O escuro em que o pixel escuro demais é levantado: o do ferro (o do canhão e do manequim). Com a nogueira do
 * padrão, o vão do elmo e os furos saíam avermelhados.
 */
const ESCURO_DO_FERRO = rgb('#4a4541')

// ---------- a luz do aço ----------

/** De onde vem a luz (a do motor) e o meio-caminho entre ela e o olho, onde o metal brilha. */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
const MEIO_X = -0.344
const MEIO_Y = -0.267
const MEIO_Z = 0.9
/** Quanto o relevo de cada peça muda a luz, e o ponto de brilho que sobra no aço velho (pequeno e fraco). */
const FORCA_DO_RELEVO = 0.8
const EXPOENTE_DO_REFLEXO = 22
/** A ferrugem: a partir de quanto o ruído vira mancha, o quanto ela cobre no miolo e onde ela vira a funda. */
const FERRUGEM_CHEIA = 0.86
const LIMIAR_DA_FUNDA = 1.6

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** Mistura a cor `cor` em `s` (a saída da textura), na medida `t`. */
function tingir(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus; de cima é sempre 0, quem gira é a imagem pronta), como nos ossos.
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** O rumo da luz e o do brilho no referencial do desenho (desgirados). */
interface Luz {
  readonly x: number
  readonly y: number
  readonly mx: number
  readonly my: number
}

function luzDoDesenho(giro: number): Luz {
  const [x, y] = desgirado(LUZ_X, LUZ_Y, giro)
  const [mx, my] = desgirado(MEIO_X, MEIO_Y, giro)
  return { x, y, mx, my }
}

// ---------- o lugar de cada peça ----------

/** Onde a peça foi posta na pegada: o meio, o giro (cosseno e seno) e o tamanho (px da pegada por px do desenho). */
interface Lugar {
  readonly cx: number
  readonly cy: number
  readonly co: number
  readonly si: number
  readonly k: number
}

/** A forma desenhada em volta de (0, 0) levada para o lugar: girada e aumentada `k` (o `levada` dos ossos). */
function noLugar(l: Lugar, f: Forma): Forma {
  const [x0, y0, x1, y1] = f.b
  const cantos: readonly Ponto[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const xs = cantos.map(([x, y]) => l.cx + (x * l.co - y * l.si) * l.k)
  const ys = cantos.map(([x, y]) => l.cy + (x * l.si + y * l.co) * l.k)
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d(x, y) {
      const dx = (x - l.cx) / l.k
      const dy = (y - l.cy) / l.k
      return f.d(dx * l.co + dy * l.si, -dx * l.si + dy * l.co) * l.k
    },
  }
}

/** O ponto do desenho da peça na pegada. */
function pontoNoLugar(l: Lugar, [x, y]: Ponto): Ponto {
  return [l.cx + (x * l.co - y * l.si) * l.k, l.cy + (x * l.si + y * l.co) * l.k]
}

/** O lugar de uma parte que saiu do lugar dentro da peça: levada para `desvio` e girada `ang` no desenho dela. */
function lugarDentro(l: Lugar, ang: number, desvio: Ponto): Lugar {
  const [cx, cy] = pontoNoLugar(l, desvio)
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return { cx, cy, co: l.co * co - l.si * si, si: l.si * co + l.co * si, k: l.k }
}

// ---------- a textura do aço velho ----------

/**
 * O relevo da peça no ponto (lx, ly) do desenho dela: a inclinação da superfície em `saida[0]` e `saida[1]` (de
 * -1 a 1, no rumo em que ela olha) e uma luz a somar em `saida[2]` (a quina, a beira virada).
 */
type Relevo = (lx: number, ly: number, saida: Float64Array) => void
const RELEVO = new Float64Array(3)

/** Um amassado: a cova de meio (x, y) e raio na pegada; `fundo` = quanto a parede dela inclina. */
interface Amassado {
  readonly x: number
  readonly y: number
  readonly raio: number
  readonly fundo: number
}

/**
 * O AÇO VELHO: a luz do relevo da peça (desgirada para o desenho), as covas dos amassados (a parede do lado da
 * luz fica na sombra e a do outro lado pega luz, o contrário de um calombo), a ferrugem em manchas de três
 * escalas (o miolo vira a funda, cheia de pontinhos) e o ponto de brilho, que a ferrugem apaga.
 */
function texDoAco(l: Lugar, relevo: Relevo, luz: Luz, ferrugem: number, reflexo: number, amassados: readonly Amassado[] = []): Textura {
  return (_u, _v, x, y, p, s) => {
    const dx = (x - l.cx) / l.k
    const dy = (y - l.cy) / l.k
    RELEVO[2] = 0
    relevo(dx * l.co + dy * l.si, -dx * l.si + dy * l.co, RELEVO)
    let nx = RELEVO[0] * l.co - RELEVO[1] * l.si
    let ny = RELEVO[0] * l.si + RELEVO[1] * l.co
    for (const a of amassados) {
      const ax = (x - a.x) / a.raio
      const ay = (y - a.y) / a.raio
      const r2 = ax * ax + ay * ay
      if (r2 >= 1) continue
      const parede = 4 * a.fundo * (1 - r2)
      nx -= parede * ax
      ny -= parede * ay
    }
    const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))
    s[3] += FORCA_DO_RELEVO * (nx * luz.x + ny * luz.y + nz * LUZ_Z - LUZ_Z) + RELEVO[2]
    // A ferrugem: a mancha grande, o recorte dela e o grão miúdo, que desfaz a beira (ferrugem não tem contorno).
    const mancha = ruido(x * 0.085 + p.su, y * 0.085 + p.sv) * 1.5 + ruido(x * 0.3 + p.sv, y * 0.3 + p.su) * 0.9 + ruido(x * 1.1 + p.su, y * 1.1) * 0.55
    const q = (mancha + ferrugem - 0.2) / 0.5
    const t = q <= 0 ? 0 : q >= 1 ? FERRUGEM_CHEIA : q * q * (3 - 2 * q) * FERRUGEM_CHEIA
    if (t > 0) {
      tingir(s, FERRUGEM, t)
      if (q > LIMIAR_DA_FUNDA) tingir(s, FERRUGEM_FUNDA, Math.min(1, (q - LIMIAR_DA_FUNDA) / 0.8) * 0.7)
      if (q > 1 && hash(Math.floor(x * 2.3), Math.floor(y * 2.3), p.semente) > 0.9) s[3] -= 0.12
    }
    const brilho = reflexo * (1 - t) * Math.pow(Math.max(0, nx * luz.mx + ny * luz.my + nz * MEIO_Z), EXPOENTE_DO_REFLEXO)
    s[0] += brilho
    s[1] += brilho
    s[2] += brilho * 0.97
    s[3] += ruido(x * 0.16 + p.su, y * 0.16) * 0.08 + ruido(x * 0.75, y * 0.75 + p.sv) * 0.04 - t * 0.05
  }
}

/** A cúpula de meio (cx, cy) e raios (rx, ry) no desenho da peça; `achata` encolhe a curva para o lado de y positivo. */
function cupula(cx: number, cy: number, rx: number, ry: number, forca: number, achata = 1): Relevo {
  return (lx, ly, saida) => {
    let nx = (lx - cx) / rx
    let ny = (ly - cy) / ry
    if (ny > 0) ny *= achata
    const r = Math.hypot(nx, ny)
    if (r > 1) {
      nx /= r
      ny /= r
    }
    saida[0] = nx * forca
    saida[1] = ny * forca
  }
}

/** O cilindro deitado ao longo de x no desenho da peça (a lâmina da fralda, o dedo), de meia largura `meia`. */
function cilindro(cy: number, meia: number, forca: number): Relevo {
  return (_lx, ly, saida) => {
    saida[0] = 0
    saida[1] = limitar((ly - cy) / meia, -1, 1) * forca
  }
}

/** O couro podre: manchas escuras, rachas de través e a beira roída. */
const texDoCouro: Textura = (u, v, x, y, p, s) => {
  s[3] += ruido(x * 0.4 + p.su, y * 0.4 + p.sv) * 0.16 + ruido(x * 1.3, y * 1.3 + p.su) * 0.06
  if (Math.sin(u * 1.7 + ruido(u * 0.2, v * 0.6 + p.sv) * 4) > 0.93) s[3] -= 0.16
}

// ---------- o peitoral ----------

/** O peitoral deitado de costas, só a metade da direita, do meio do pescoço ao bico de baixo (a da esquerda é o espelho, amassada). */
const MEIO_PEITORAL: readonly Ponto[] = [
  [0, -14.4],
  [2.3, -14.9],
  [4.1, -16.1],
  [6.2, -16.6],
  [8.9, -15.6],
  [10.7, -12.7],
  [11.0, -8.9],
  [10.4, -5.0],
  [9.5, -1.5],
  [8.5, 1.4],
  [8.2, 2.8],
  [5.0, 3.5],
  [2.0, 4.5],
  [0, 5.1],
]
/** Os pontos da metade da esquerda que o golpe entortou (o ombro afundado e o flanco batido), pelo índice. */
const AMASSOS_DA_ESQUERDA: Readonly<Partial<Record<number, Ponto>>> ={ 4: [-8.4, -14.6], 7: [-9.6, -5.4], 8: [-9.0, -2.0] }
/** A meia largura do peito em cada altura [y, meia largura]: a luz de través anda por ela. */
const LARGURA_DO_PEITO: readonly (readonly [number, number])[] = [
  [-16.6, 9.0],
  [-12.7, 10.7],
  [-8.9, 11.0],
  [-5.0, 10.4],
  [-1.5, 9.5],
  [1.4, 8.5],
  [10, 9.6],
]
/** O alto do peito (o ponto que fica mais perto de quem olha): para cima ele cai para o pescoço, para baixo para a cintura. */
const ALTO_DO_PEITO = -7
const QUEDA_DO_PEITO = 11
/** A quina do meio: o degrau de luz entre as duas metades e o fio claro dela. */
const DEGRAU_DA_QUINA = 0.1
const FIO_DA_QUINA = 0.1
/** As beiras viradas do pescoço e da cava da direita (a da esquerda é o espelho), e o raio delas. */
const BEIRA_DO_PESCOCO: readonly Ponto[] = [[-5.7, -16.0], [-3.8, -15.3], [-2, -14.6], [0, -14.1], [2, -14.6], [3.8, -15.3], [5.7, -16.0]]
const BEIRA_DA_CAVA: readonly Ponto[] = [[6.7, -16.2], [8.8, -15.1], [10.2, -12.6], [10.5, -9.4]]
const RAIO_DA_BEIRA = 0.72
/** As duas lâminas da fralda, a de baixo primeiro (essa se soltou de um rebite e entortou). */
const FRALDA: readonly (readonly Ponto[])[] = [
  [[-8.9, 3.6], [8.9, 3.6], [9.7, 8.4], [4.8, 9.0], [0, 9.8], [-4.8, 9.0], [-9.7, 8.4]],
  [[-8.4, 1.2], [8.4, 1.2], [9.1, 5.6], [4.6, 6.2], [0, 7.0], [-4.6, 6.2], [-9.1, 5.6]],
]
const GIRO_DA_LAMINA_SOLTA = 0.13
const DESVIO_DA_LAMINA_SOLTA: Ponto = [1.3, 0.9]
/** O rombo do golpe (o furo de bordas em pétala, virado para dentro) e o furo que a ferrugem abriu, no desenho do peitoral. */
const ROMBO = { x: -4.6, y: -8.8, raio: 1.6, rasgos: 3 } as const
const FURO_DE_FERRUGEM = { x: 6.2, y: -1.0, raio: 0.9, rasgos: 0 } as const
/** Os amassados do peito (no desenho do peitoral): o grande do lado direito, o do rombo e o da barriga. */
const AMASSADOS_DO_PEITO: readonly (readonly [number, number, number, number])[] = [
  [4.8, -8.4, 4.4, 0.13],
  [-4.6, -8.8, 3.4, 0.16],
  [-6.2, -1.4, 2.6, 0.12],
]

/** A meia largura do peito na altura `y` (px do desenho). */
function meiaLarguraDoPeito(y: number): number {
  if (y <= LARGURA_DO_PEITO[0][0]) return LARGURA_DO_PEITO[0][1]
  for (let i = 1; i < LARGURA_DO_PEITO.length; i += 1) {
    const [y1, m1] = LARGURA_DO_PEITO[i]
    if (y <= y1) {
      const [y0, m0] = LARGURA_DO_PEITO[i - 1]
      return m0 + ((m1 - m0) * (y - y0)) / (y1 - y0)
    }
  }
  return LARGURA_DO_PEITO[LARGURA_DO_PEITO.length - 1][1]
}

/** O peito deitado: redondo de través, com a quina no meio (o degrau e o fio claro), alto no peito e caindo para as pontas. */
const relevoDoPeito: Relevo = (lx, ly, saida) => {
  const q = limitar(lx / meiaLarguraDoPeito(ly), -1, 1)
  saida[0] = 0.7 * q + (lx < 0 ? -DEGRAU_DA_QUINA : DEGRAU_DA_QUINA) * Math.min(1, Math.abs(lx) / 0.8)
  saida[1] = 0.45 * limitar((ly - ALTO_DO_PEITO) / QUEDA_DO_PEITO, -1, 1)
  const naQuina = lx / 0.45
  saida[2] = FIO_DA_QUINA * Math.exp(-naQuina * naQuina) * (ly < 3 ? 1 : 0)
}

/** A lâmina da fralda: a faixa que dá a volta no quadril, alta no meio e caindo para os lados, com a beira de baixo virada para fora. */
const relevoDaLamina: Relevo = (lx, _ly, saida) => {
  saida[0] = 0.6 * limitar(lx / 9.5, -1, 1)
  saida[1] = 0.16
}

/** O contorno do peitoral: a metade da direita e o espelho dela, com os pontos que o golpe entortou. */
function contornoDoPeitoral(): Ponto[] {
  const esquerda = [...MEIO_PEITORAL]
    .map((ponto, i): Ponto => AMASSOS_DA_ESQUERDA[i] ?? [-ponto[0], ponto[1]])
    .reverse()
    .slice(1, -1)
  return [...MEIO_PEITORAL, ...esquerda]
}

/** Os pontos do contorno do furo: tortos, e em alguns poucos sorteados as pontas do metal rasgado. */
const PONTOS_DO_FURO = 11

/**
 * O furo de beira torta em volta de (x, y), com `rasgos` pontas de metal rasgado em lugares sorteados (a volta
 * regular de pontas, a primeira tentativa, lia como uma estrela de xerife).
 */
function furo(x: number, y: number, raio: number, rasgos: number, sem: number): Forma {
  const pontas = new Set<number>()
  for (let i = 0; i < rasgos; i += 1) pontas.add(Math.floor(hash(i, sem, 34) * PONTOS_DO_FURO))
  const pontos: Ponto[] = []
  for (let i = 0; i < PONTOS_DO_FURO; i += 1) {
    const t = (i / PONTOS_DO_FURO) * Math.PI * 2 + (hash(i, sem, 31) - 0.5) * 0.35
    const r = raio * (pontas.has(i) ? 1.3 + 0.3 * hash(i, sem, 32) : 0.66 + 0.3 * hash(i, sem, 33))
    pontos.push([x + Math.cos(t) * r, y + Math.sin(t) * r])
  }
  return poligono(pontos)
}

// ---------- o capim ----------

/**
 * Um tufo de capim com o pé em (x, y): as folhas em zigue-zague, de alturas desiguais e abrindo para os lados,
 * como o da cruz e da lápide (o capim do mapa é desenhado de pé; visto de cima de verdade ele era uma estrela).
 */
function tufo(x: number, y: number, largura: number, alto: number, inclina: number, folhas: number, sem: number): Forma {
  const m = largura / 2
  const passo = (1.8 * m) / (folhas - 1)
  const pontos: Ponto[] = [[x - m, y + 0.5]]
  for (let i = 0; i < folhas; i += 1) {
    const px = x - 0.9 * m + i * passo
    const lado = (i / (folhas - 1)) * 2 - 1
    const h = alto * (0.5 + 0.5 * hash(i, sem, 41))
    pontos.push([px + inclina * (0.6 + 0.4 * Math.abs(lado)) + lado * m * 0.3, y - h])
    if (i < folhas - 1) pontos.push([px + passo / 2, y - alto * (0.12 + 0.14 * hash(i, sem, 42))])
  }
  pontos.push([x + m, y + 0.5])
  return poligono(pontos)
}

/**
 * Os tufos [x, y do pé, largura, altura, inclinação, folhas] (px do desenho): os de baixo nascem por entre as
 * peças e somem debaixo delas; os de cima têm o pé logo abaixo da beira de uma peça e crescem por cima dela.
 */
type Tufo = readonly [number, number, number, number, number, number]
const CAPIM_DE_BAIXO: readonly Tufo[] = [
  [-38.5, 4.5, 5.2, 4.6, -0.5, 5],
  [36.8, -2.5, 5.6, 4.8, 0.6, 5],
  [4.2, -20.5, 5.0, 4.2, 0.3, 4],
  [-19.5, -23.6, 4.6, 4.0, -0.4, 4],
  [9.5, 19.5, 4.4, 4.0, 0.5, 4],
  [39.4, 26.4, 4.0, 3.8, 0.4, 4],
  [-2.5, 26.6, 4.2, 3.6, -0.3, 4],
]
const CAPIM_DE_CIMA: readonly Tufo[] = [
  [-13.5, 15.6, 5.4, 5.0, -0.5, 5],
  [0.8, 13.8, 4.6, 4.4, 0.4, 4],
  [14.8, 0.6, 4.8, 4.6, 0.5, 5],
  [-26.2, -7.4, 4.4, 4.2, -0.4, 4],
  [35.6, 22.4, 4.6, 4.4, 0.5, 4],
  [-15.2, 26.2, 4.2, 3.8, -0.3, 4],
  [17.6, 26.8, 4.0, 3.6, 0.4, 4],
]

// ---------- a montagem ----------

/** As medidas do desenho na pegada. */
interface Regua {
  /** O ponto do desenho (px de 84 x 56) na pegada. */
  readonly em: (x: number, y: number) => Ponto
  /** O tamanho sai do menor lado: a peça continua inteira no objeto esticado. */
  readonly k: number
}

/** A forma afastada (dx, dy): onde cai a sombra dela. */
function afastada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** O que a montagem passa a cada peça. */
interface Obra {
  readonly c: ContextoDoMovel
  readonly cena: Cena
  readonly regua: Regua
  readonly luz: Luz
}

/**
 * A sombra de uma peça de altura `z` (px do desenho) no chão: o contato no pé e a forma afastada como o motor
 * afasta a sombra dessa altura, mas com altura ZERO (sombra com altura vira coluna na 3/4 e a peça subiria
 * sozinha, com uma frente lisa embaixo). O afastamento é desgirado pelo `giro`: cai para baixo à direita na tela.
 */
function assentar(o: Obra, forma: Forma, z: number, forca = 0.26): void {
  const h = z * o.regua.k
  const [dx, dy] = desgirado(SOMBRA_X * h, SOMBRA_Y * h, o.c.giro)
  o.cena.sombras.push({ forma: afastada(forma, dx, dy), z: 0, suave: 0.9 + 0.12 * h, forca }, contato(forma, 0.3))
}

/** O lugar de uma peça no ponto (x, y) do desenho, girada `ang`. */
function lugarDe(r: Regua, x: number, y: number, ang: number): Lugar {
  const [cx, cy] = r.em(x, y)
  return { cx, cy, co: Math.cos(ang), si: Math.sin(ang), k: r.k }
}

/** Põe uma peça desenhada no referencial do lugar. */
function por(o: Obra, l: Lugar, f: Forma, mat: MaterialDaPeca, op: OpcoesDaPeca): void {
  o.cena.partes.push(o.c.peca(noLugar(l, f), mat, op))
}

/** O amassado no desenho da peça levado para a pegada. */
function amassadoNoLugar(l: Lugar, [x, y, raio, fundo]: readonly [number, number, number, number]): Amassado {
  const [px, py] = pontoNoLugar(l, [x, y])
  return { x: px, y: py, raio: raio * l.k, fundo }
}

function montarChao(o: Obra): void {
  const { regua, c } = o
  // A terra manchada: uma mancha larga e rala debaixo de tudo, de beira desfeita, e duas mais fortes onde escorreu mais.
  const manchas: readonly (readonly [number, number, number, number, number])[] = [
    [-4, 1, 40, 25, 0.26],
    [-11, 2, 17, 15, 0.22],
    [19, -9, 10, 9, 0.2],
  ]
  manchas.forEach(([x, y, rx, ry, alfa], i) => {
    const [cx, cy] = regua.em(x, y)
    const pontos: Ponto[] = []
    for (let j = 0; j < 16; j += 1) {
      const t = (j / 16) * Math.PI * 2
      const f = 0.8 + 0.3 * hash(j, i, 51)
      pontos.push([cx + Math.cos(t) * rx * f * (c.w / LARGURA_DO_DESENHO), cy + Math.sin(t) * ry * f * (c.h / ALTURA_DO_DESENHO)])
    }
    const pintura: Textura = (_u, _v, x, y, p, s) => {
      s[3] += ruido(x * 0.5 + p.su, y * 0.5) * 0.1
      s[5] *= 0.7 + ruido(x * 0.14 + p.sv, y * 0.14 + p.su) * 0.6
    }
    o.cena.partes.push(c.peca(poligono(pontos), TERRA_ENFERRUJADA, { bisel: 0, contorno: 0, alfa, suave: 4 * regua.k, textura: pintura, semente: 5100 + i }))
  })
  // Os rebites e as escamas de ferrugem que se soltaram.
  const miudos: readonly (readonly [number, number, number])[] = [[-33.5, 11.5, 0.7], [26.5, 25, 0.65], [-14.5, -23.5, 0.6]]
  miudos.forEach(([x, y, r], i) => {
    const [cx, cy] = regua.em(x, y)
    const forma = elipse(cx, cy, r * regua.k, r * regua.k)
    o.cena.sombras.push(contato(forma, 0.28))
    o.cena.partes.push(c.peca(forma, ACO, { bisel: r * regua.k, contorno: 0.3, metal: 0.2, textura: texDoAco(lugarDe(regua, x, y, 0), cupula(0, 0, r, r, 0.6), o.luz, 0.5, 0), semente: 5110 + i }))
  })
}

function montarCapim(o: Obra, tufos: readonly Tufo[], semente: number): void {
  const { regua, c } = o
  tufos.forEach(([x, y, largura, alto, inclina, folhas], i) => {
    const [cx, cy] = regua.em(x, y)
    const k = regua.k
    const forma = tufo(cx, cy, largura * k, alto * k, inclina * k, folhas, semente + i)
    const cor = VERDES_DO_CAPIM[Math.floor(hash(i, semente, 44) * VERDES_DO_CAPIM.length)]
    o.cena.sombras.push(contato(elipse(cx, cy, largura * 0.55 * k, 1.2 * k), 0.26))
    o.cena.partes.push(c.peca(forma, { classe: 'liso', rgb: cor }, { bisel: 0.7 * k, contorno: 0.24, tom: 0.9 + 0.16 * hash(i, semente, 45), semente: semente + i }))
  })
}

/** A ESPADA partida: o punho de couro com o pomo, a guarda e o toco da lâmina; mais adiante, a ponta. */
function montarEspada(o: Obra): void {
  const { regua } = o
  const lamina = cilindro(0, 1.4, 0.34)
  // O punho: o pomo, o couro do cabo (com as voltas da tira), a guarda e o toco da lâmina, quebrado em dentes.
  const punho = lugarDe(regua, -25, 21.4, -0.1)
  const toco = poligono([[-4.0, -1.45], [3.8, -1.4], [4.7, -0.7], [3.9, -0.2], [5.4, 0.5], [4.3, 1.0], [3.7, 1.42], [-4.0, 1.45]])
  const cabo = capsula(-11, 0, -5.2, 0, 0.95)
  const guarda = capsula(-4.6, -4.9, -4.6, 4.9, 0.85)
  const pomo = elipse(-12.6, 0, 1.75, 1.75)
  assentar(o, noLugar(punho, uniao(uniao(toco, cabo), uniao(guarda, pomo))), 2.2)
  por(o, punho, toco, ACO_DA_LAMINA, { tabua: 0, bisel: 0.6 * regua.k, contorno: 0.3, metal: 0.4, textura: texDoAco(punho, lamina, o.luz, 0.26, 40), semente: 5201 })
  por(o, punho, capsula(-3.4, 0, 3.4, 0, 0.32), VAO, { bisel: 0, contorno: 0, alfa: 0.55, semente: 5202 })
  por(o, punho, cabo, COURO, { eixo: 0.9, bisel: 0.8 * regua.k, contorno: 0.3, textura: texDoCouro, semente: 5203 })
  por(o, punho, guarda, ACO, { bisel: 0.8 * regua.k, contorno: 0.3, metal: 0.3, textura: texDoAco(punho, cilindro(0, 1, 0), o.luz, 0.34, 20), semente: 5204, projeta: { dist: 0.7 * regua.k, forca: 0.3 } })
  por(o, punho, pomo, ACO, { bisel: 1.2 * regua.k, contorno: 0.3, metal: 0.3, textura: texDoAco(punho, cupula(-12.6, 0, 1.75, 1.75, 0.8), o.luz, 0.3, 30), semente: 5205 })
  // A ponta, mais adiante e um pouco torta: a boca da quebra em dentes e o sulco do meio.
  const ponta = lugarDe(regua, -9.5, 23.6, 0.06)
  const resto = poligono([[0.5, -1.38], [15.6, -1.22], [19.6, 0], [15.6, 1.22], [0.3, 1.38], [1.0, 0.8], [-0.2, 0.3], [0.9, -0.45]])
  assentar(o, noLugar(ponta, resto), 2)
  por(o, ponta, resto, ACO_DA_LAMINA, { tabua: 0, bisel: 0.6 * regua.k, contorno: 0.3, metal: 0.4, textura: texDoAco(ponta, lamina, o.luz, 0.3, 40), semente: 5206 })
  por(o, ponta, capsula(1.6, 0, 13.2, 0, 0.32), VAO, { bisel: 0, contorno: 0, alfa: 0.55, semente: 5207 })
}

/** As correias: a presa ao flanco e a caída da cintura (no desenho do peitoral) e a solta no chão (no desenho). */
const CORREIA_PRESA: readonly Ponto[] = [[9.4, -3.6], [13.6, -2.9], [17.6, -3.6], [20.6, -2.8]]
const CORREIA_CAIDA: readonly Ponto[] = [[-8.8, 6.0], [-11.4, 9.0], [-15.2, 9.8]]
const CORREIA_SOLTA: readonly Ponto[] = [[9.5, 2.0], [14.0, 3.8], [18.4, 3.6], [22.0, 5.2]]
const RAIO_DA_CORREIA = 1.25

/** As CORREIAS de couro podre: uma ainda presa ao flanco do peitoral, uma solta no chão com a fivela. */
function montarCorreias(o: Obra, peito: Lugar): void {
  const { regua, c } = o
  const presa = CORREIA_PRESA.map((p) => pontoNoLugar(peito, p))
  const caida = CORREIA_CAIDA.map((p) => pontoNoLugar(peito, p))
  const solta = CORREIA_SOLTA.map(([x, y]) => regua.em(x, y))
  for (const [i, pontos] of [presa, caida, solta].entries()) {
    const forma = cadeia(pontos, RAIO_DA_CORREIA * regua.k)
    o.cena.sombras.push(contato(forma, 0.26))
    o.cena.partes.push(c.peca(forma, COURO, { eixo: Math.atan2(pontos[1][1] - pontos[0][1], pontos[1][0] - pontos[0][0]), bisel: 0.45 * regua.k, contorno: 0.28, textura: texDoCouro, semente: 5300 + i }))
  }
  // A fivela de ferro da correia solta: o aro e o fuzilhão, comidos de ferrugem.
  const [fx, fy] = regua.em(11.4, 2.9)
  const fivela = menos(caixa(fx - 1.7 * regua.k, fy - 1.5 * regua.k, fx + 1.7 * regua.k, fy + 1.5 * regua.k, 0.5 * regua.k), caixa(fx - 0.9 * regua.k, fy - 0.75 * regua.k, fx + 0.9 * regua.k, fy + 0.75 * regua.k, 0.2 * regua.k))
  o.cena.partes.push(c.peca(fivela, ACO, { bisel: 0.5 * regua.k, contorno: 0.3, metal: 0.2, textura: texDoAco(lugarDe(regua, 11.4, 2.9, 0), cupula(0, 0, 1.7, 1.5, 0.4), o.luz, 0.55, 0), semente: 5310, projeta: { dist: 0.6 * regua.k, forca: 0.3 } }))
}

/**
 * A OMBREIRA solta, de concha para cima: a cúpula larga e baixa (mais larga que funda, para não ler como um
 * elmo), as duas lâminas que descem do braço aparecendo em crescente debaixo dela, a beira enrolada no alto e
 * os rebites.
 */
function montarOmbreira(o: Obra): void {
  const { regua } = o
  const l = lugarDe(regua, -32, -16.6, -0.28)
  const laminas: readonly (readonly [number, number, number, number, number])[] = [
    [0.8, 4.8, 6.6, 2.6, 0.84],
    [0.3, 2.8, 7.4, 3.0, 0.92],
  ]
  const concha = elipse(-0.2, -0.6, 8.0, 4.2)
  assentar(o, noLugar(l, uniao(elipse(0.8, 4.8, 6.6, 2.6), concha)), 4.5)
  laminas.forEach(([x, y, rx, ry, tom], i) => {
    por(o, l, elipse(x, y, rx, ry), ACO, { tabua: 0, bisel: 1.1 * regua.k, tom, contorno: 0.3, metal: 0.25, textura: texDoAco(l, relevoDaLamina, o.luz, 0.48, 18), semente: 5402 + i, projeta: { dist: 0.8 * regua.k, forca: 0.3 } })
  })
  por(o, l, concha, ACO, { tabua: 0, bisel: 1.4 * regua.k, contorno: 0.3, metal: 0.25, textura: texDoAco(l, cupula(-0.2, -0.6, 8.0, 4.2, 0.8), o.luz, 0.44, 24), semente: 5404, projeta: { dist: 0.9 * regua.k, forca: 0.3 } })
  // A beira enrolada do alto da concha, clara, de ponta a ponta.
  const beira: Ponto[] = []
  for (let i = 0; i <= 8; i += 1) {
    const t = Math.PI * (1.1 + (0.8 * i) / 8)
    beira.push([-0.2 + Math.cos(t) * 7.3, -0.6 + Math.sin(t) * 3.6])
  }
  por(o, l, cadeia(beira, 0.62), ACO, { bisel: 0.55 * regua.k, tom: 1.12, contorno: 0.22, metal: 0.3, textura: texDoAco(l, cilindro(-3.6, 1.6, 0.3), o.luz, 0.36, 24), semente: 5405 })
  for (const [x, y] of [[-6.0, 0.4], [5.6, 0.4], [-5.0, 4.0], [5.8, 4.4]] as const) {
    por(o, l, elipse(x, y, 0.55, 0.55), ACO, { bisel: 0.55 * regua.k, tom: 1.15, contorno: 0.2, metal: 0.4, textura: texDoAco(l, cupula(x, y, 0.55, 0.55, 0.7), o.luz, 0.45, 30), semente: 5410 })
  }
}

/** A MANOPLA solta, deitada: o punho em sino, as lâminas do dorso, os dedos articulados e o polegar. */
function montarManopla(o: Obra): void {
  const { regua } = o
  const l = lugarDe(regua, 29.6, 13.6, 2.3)
  const sino = poligono([[-3.4, -6.2], [3.4, -6.2], [2.5, -1.8], [-2.5, -1.8]])
  const dorso = caixa(-2.6, -2.2, 2.6, 2.8, 1.2)
  const dedos = [-1.8, -0.6, 0.6, 1.8].map((x, i) => capsula(x, 2.4, x + (i - 1.5) * 0.25, 7.2 - Math.abs(i - 1.5) * 0.7, 0.62))
  const polegar = capsula(-2.5, 0.2, -4.6, 3.0, 0.85)
  assentar(o, noLugar(l, uniao(uniao(sino, dorso), uniao(polegar, caixa(-2.4, 2.4, 2.4, 7.4, 0.6)))), 4)
  for (const [i, dedo] of dedos.entries()) {
    por(o, l, dedo, ACO, { bisel: 0.55 * regua.k, contorno: 0.3, metal: 0.25, tom: 0.92, textura: texDoAco(l, cupula(0, 4.6, 3.2, 4.6, 0.5), o.luz, 0.44, 18), semente: 5501 + i })
  }
  for (const y of [4.0, 5.6]) por(o, l, capsula(-2.4, y, 2.4, y, 0.2), VAO, { bisel: 0, contorno: 0, alfa: 0.6, semente: 5506 })
  por(o, l, polegar, ACO, { bisel: 0.7 * regua.k, contorno: 0.3, metal: 0.25, textura: texDoAco(l, cupula(-3.4, 1.5, 2, 2.2, 0.6), o.luz, 0.3, 18), semente: 5507 })
  por(o, l, dorso, ACO, { tabua: 0, bisel: 0.9 * regua.k, contorno: 0.3, metal: 0.25, textura: texDoAco(l, cupula(0, 0.3, 2.8, 2.8, 0.7), o.luz, 0.44, 26), semente: 5508, projeta: { dist: 0.7 * regua.k, forca: 0.3 } })
  por(o, l, sino, ACO, { tabua: 0, bisel: 0.9 * regua.k, contorno: 0.3, metal: 0.25, textura: texDoAco(l, cupula(0, -4, 3.4, 3.2, 0.7), o.luz, 0.5, 26), semente: 5509, projeta: { dist: 0.8 * regua.k, forca: 0.3 } })
  por(o, l, capsula(-3.2, -6.1, 3.2, -6.1, 0.55), ACO, { bisel: 0.5 * regua.k, tom: 1.12, contorno: 0.24, metal: 0.3, textura: texDoAco(l, cilindro(-6.1, 0.55, 0.6), o.luz, 0.3, 20), semente: 5510 })
}

/** O PEITORAL deitado de costas: as correias por baixo, a fralda, a placa com as beiras viradas, o rombo, o furo e os rebites. */
function montarPeitoral(o: Obra): void {
  const { regua } = o
  const l = lugarDe(regua, -9, -2.4, -0.38)
  montarCorreias(o, l)
  const placa = poligono(contornoDoPeitoral())
  assentar(o, noLugar(l, uniao(placa, poligono(FRALDA[0]))), 7)
  const amassados = AMASSADOS_DO_PEITO.map((a) => amassadoNoLugar(l, a))
  // A FRALDA: a lâmina de baixo, solta e torta, e a de cima no lugar, cada uma com os rebites das pontas.
  FRALDA.forEach((lamina, i) => {
    const lugar = i === 0 ? lugarDentro(l, GIRO_DA_LAMINA_SOLTA, DESVIO_DA_LAMINA_SOLTA) : l
    por(o, lugar, poligono(lamina), ACO, { tabua: 0, bisel: 1.1 * regua.k, tom: 0.86 + i * 0.06, contorno: 0.3, metal: 0.25, textura: texDoAco(lugar, relevoDaLamina, o.luz, 0.52 - i * 0.06, 20), semente: 5601 + i, projeta: { dist: 0.8 * regua.k, forca: 0.3 } })
    for (const lado of [-1, 1]) {
      const [x, y] = pontoNoLugar(lugar, [lado * 7.8, i === 0 ? 4.7 : 2.3])
      o.cena.partes.push(o.c.peca(elipse(x, y, 0.6 * regua.k, 0.6 * regua.k), ACO, { bisel: 0.6 * regua.k, tom: 1.12, contorno: 0.2, metal: 0.4, semente: 5605 }))
    }
  })
  // A PLACA do peito, com a luz da quina, a cova dos amassados e a ferrugem.
  por(o, l, placa, ACO, { tabua: 0, bisel: 1.5 * regua.k, contorno: 0.32, metal: 0.25, textura: texDoAco(l, relevoDoPeito, o.luz, 0.42, 28, amassados), semente: 5610, projeta: { dist: 1.1 * regua.k, forca: 0.3 } })
  // As beiras viradas do pescoço e das duas cavas (a da esquerda acompanha o ombro afundado).
  const cavaDaEsquerda = BEIRA_DA_CAVA.map(([x, y], i): Ponto => (i === 1 ? [-8.4, -14.2] : [-x, y]))
  for (const [i, beira] of [BEIRA_DO_PESCOCO, BEIRA_DA_CAVA, cavaDaEsquerda].entries()) {
    por(o, l, cadeia(beira, RAIO_DA_BEIRA), ACO, { bisel: 0.55 * regua.k, tom: 1.1, contorno: 0.24, metal: 0.3, textura: texDoAco(l, relevoDoPeito, o.luz, 0.4, 30), semente: 5620 + i })
  }
  // O ROMBO do golpe e o FURO da ferrugem: a beira de pétalas, clara, e o vão escuro de dentro.
  for (const [i, f] of [ROMBO, FURO_DE_FERRUGEM].entries()) {
    por(o, l, furo(f.x, f.y, f.raio * 1.4, f.rasgos, 5630 + i), ACO, { bisel: 0.4 * regua.k, tom: 1.08, contorno: 0.2, metal: 0.2, textura: texDoAco(l, cupula(f.x, f.y, f.raio * 1.5, f.raio * 1.5, -0.6), o.luz, i === 0 ? 0.36 : 0.8, 0), semente: 5632 + i })
    por(o, l, furo(f.x, f.y, f.raio, f.rasgos, 5630 + i), VAO, { bisel: 0, contorno: 0.14, recesso: { k: 0.7 * regua.k, forca: 0.3 }, semente: 5642 + i })
  }
  // Os rebites do pescoço.
  for (const lado of [-1, 1]) {
    const [x, y] = pontoNoLugar(l, [lado * 3.4, -12.8])
    o.cena.partes.push(o.c.peca(elipse(x, y, 0.62 * regua.k, 0.62 * regua.k), ACO, { bisel: 0.6 * regua.k, tom: 1.14, contorno: 0.2, metal: 0.4, semente: 5650 }))
  }
}

/** O ELMO tombado de lado: a cúpula com as faces, a crista, a abertura em T e, embaixo, a boca aberta com o oco escuro. */
function montarElmo(o: Obra): void {
  const { regua } = o
  const l = lugarDe(regua, 21.6, -11, 0.92)
  const casco = uniao(elipse(0, -2, 7.6, 8.0), caixa(-6.8, -2, 6.8, 7.2, 2.6))
  assentar(o, noLugar(l, casco), 11, 0.3)
  const amassados = [amassadoNoLugar(l, [-3.2, -5.4, 2.8, 0.14])]
  por(o, l, casco, ACO, { tabua: 0, bisel: 1.8 * regua.k, contorno: 0.32, metal: 0.25, textura: texDoAco(l, cupula(0, -1, 7.6, 8.4, 0.85, 0.45), o.luz, 0.4, 34, amassados), semente: 5701, projeta: { dist: 1.1 * regua.k, forca: 0.3 } })
  // A beira de baixo, virada para fora: o fim do elmo, longe do T (encostada nele, a fresta e a beira liam como um H).
  por(o, l, cadeia([[-6.4, 6.4], [-3.2, 6.0], [0, 5.9], [3.2, 6.0], [6.4, 6.4]], 0.62), ACO, { bisel: 0.5 * regua.k, tom: 1.08, contorno: 0.22, metal: 0.3, textura: texDoAco(l, cilindro(6.1, 0.62, 0.5), o.luz, 0.44, 20), semente: 5703 })
  // A abertura em T: a fresta dos olhos e a da boca.
  const abertura = dentroDe(uniao(caixa(-5.0, 0.2, 5.0, 1.9, 0.7), caixa(-1.1, 1.0, 1.1, 3.8, 0.5)), casco)
  por(o, l, abertura, VAO, { bisel: 0, contorno: 0.12, recesso: { k: 0.8 * regua.k, forca: 0.3 }, semente: 5704 })
  // Os rebites das faces.
  for (const [x, y] of [[5.3, -3.6], [5.9, 2.6]] as const) {
    for (const lado of [-1, 1]) por(o, l, elipse(lado * x, y, 0.55, 0.55), ACO, { bisel: 0.55 * regua.k, tom: 1.16, contorno: 0.2, metal: 0.4, semente: 5706 })
  }
}

export const montarArmaduraEnferrujada: MontarMovel = (c, cena) => {
  const sx = c.w / LARGURA_DO_DESENHO
  const sy = c.h / ALTURA_DO_DESENHO
  const regua: Regua = { em: (x, y) => [x * sx, y * sy], k: Math.min(sx, sy) * ESCALA_DAS_PECAS }
  const o: Obra = { c, cena, regua, luz: luzDoDesenho(c.giro) }
  cena.corDoPiso = ESCURO_DO_FERRO
  montarChao(o)
  montarCapim(o, CAPIM_DE_BAIXO, 5800)
  montarEspada(o)
  montarOmbreira(o)
  montarManopla(o)
  montarPeitoral(o)
  montarElmo(o)
  montarCapim(o, CAPIM_DE_CIMA, 5900)
}
