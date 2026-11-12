/**
 * TEIA DE ARANHA (lote 17 dos objetos novos, 12/11/2026; grupo Templo e masmorra; pedido do mestre: "Outro objeto
 * interessante, teia de aranha"): a teia velha de masmorra, vista de cima, SEM aranha. Do MIOLO, fora do meio,
 * saem os RAIOS até o QUADRO (os fios de armação, um polígono torto em volta da teia). A ESPIRAL frouxa liga os
 * raios volta por volta: cada corda faz uma barriguinha para o miolo, umas caíram em barriga funda, umas
 * romperam (as pontas soltas penduradas) e num canto há um RASGO sem espiral. Dos cantos do quadro, os FIOS DE
 * ANCORAGEM vão até as beiras da pegada (um deles rompeu e a ponta caiu solta): é por eles que a teia gruda na
 * parede ou no móvel em que o mestre a encosta. Uns FIAPOS soltos pendurados, dois CASULOS pequenos de poeira
 * presos nos raios e um VÉU de pó cinza, ralo e manchado, entre os raios (mais junto do miolo). A espiral é
 * redonda e não acompanha o quadro: com o quadro, as voltas saíam em polígonos encaixados.
 *
 * Os fios são finos, claros e meio transparentes: o piso aparece através deles. Na pedra clara o fio branco
 * some, então cada fio tem a SOMBRA FINA dele, mais larga e macia que o fio e um tico afastada para baixo à
 * direita (a teia fica um nada acima do que ela cobre), e o véu escurece a pedra entre os raios; no chão escuro
 * quem lê é o fio claro. A teia inteira é UMA peça com textura própria (a distância ao fio mais perto em cada
 * pixel, a conta do círculo mágico; a sombra fina é pintada nela); só os casulos são peças à parte.
 *
 * É RENTE, sem altura (como o círculo mágico e o sangue no chão): nenhuma sombra tem altura, nada sobe e a 3/4
 * sai igual à vista de cima. NÃO é objeto de chão: fica por cima dos móveis em que o mestre a põe. O afastamento
 * das sombras pintadas é desgirado pelo `giro` que a 3/4 pinta, para cair para baixo à direita na tela.
 *
 * Esticada, a teia não estica junto: o miolo e as voltas ficam presos ao menor lado da pegada (no máximo
 * `ALONGAMENTO_MAXIMO` vez mais compridos que largos: as voltas não viram listras) e o que sobra vira fio de
 * ancoragem, mais comprido. Maior (2 x 2), a teia ganha raios e voltas e o fio continua da mesma grossura. Sem
 * material no painel: o fio, o pó e os casulos são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

const VOLTA = Math.PI * 2
const GRAU = Math.PI / 180
/** Distância de quem não está perto de fio nenhum (px). */
const LONGE = 1e3

// ---------- as cores (fixas) ----------

/** O fio: branco acinzentado de seda velha (nunca branco puro). */
const COR_DO_FIO: Rgb = [0xea, 0xe7, 0xdf]
/** O véu de pó entre os raios: cinza médio, que escurece a pedra clara e acinzenta a terra. */
const COR_DO_VEU: Rgb = [0x9a, 0x96, 0x8c]
/** A peça da teia (a cor sai da textura). */
const TEIA: MaterialDaPeca = { classe: 'liso', rgb: COR_DO_FIO }
/** Os casulos: seda enrolada e empoeirada, com as voltas do fio mais escuras. */
const CASULO: MaterialDaPeca = { classe: 'liso', rgb: [0xc4, 0xbd, 0xae] }
const VOLTA_DO_CASULO: Rgb = [0x94, 0x8d, 0x80]

// ---------- as medidas (px do protótipo; "de partida" = medido na teia de 1 x 1 casa) ----------

/** O miolo, fora do meio (frações da meia pegada). */
const MIOLO: Ponto = [-0.13, -0.1]
/** O raio da teia (até o quadro), em fração do menor meio lado, e o quanto ela pode ser mais comprida que larga. */
const RAIO_DA_TEIA = 0.74
const ALONGAMENTO_MAXIMO = 1.45
/** O raio da teia de partida (1 x 1 casa): as medidas miúdas crescem com a raiz do raio a partir dele. */
const RAIO_DE_PARTIDA = RAIO_DA_TEIA * 0.5 * G
/**
 * Os cantos do quadro em volta do miolo: o rumo (graus; 0 à direita, 90 embaixo) e o raio (fração do raio da
 * teia). Torto de propósito: a teia de verdade se arma onde acha apoio.
 */
const CANTOS_DO_QUADRO: readonly (readonly [number, number])[] = [
  [-104, 1.0],
  [-22, 1.2],
  [38, 1.1],
  [128, 1.24],
  [196, 1.06],
]
/** O quadro não chega à beira da pegada: sobra este tanto (px) para o fio de ancoragem. */
const FOLGA_DO_QUADRO = 2.4
/** Os fios de ancoragem de cada canto do quadro: o desvio (graus) do rumo que sai do miolo; dois desvios = um garfo. */
const ANCORAS: readonly (readonly number[])[] = [[-6, 16], [-8], [10, -18], [6, -16], [-12, 14]]
/** O fio de ancoragem que rompeu: o canto, qual dos fios dele, até onde ele ainda vai (fração) e a ponta caída (px de partida). */
const ANCORA_ROMPIDA = { canto: 3, fio: 1, ate: 0.5, queda: 2.2 }
/** Os raios da teia de partida e quantos ganha a teia do dobro do raio; o quanto cada um sai do rumo (fração do setor). */
const RAIOS_DE_PARTIDA = 12
const RAIOS_A_MAIS = 3
const DESVIO_DO_RAIO = 0.5
/** O rumo (graus) do primeiro raio. */
const RUMO_DO_PRIMEIRO_RAIO = -68
/**
 * A espiral: o raio livre em volta do miolo e o passo entre as voltas (px de partida), até que fração do raio do
 * quadro ela vai e o quanto cada nível sai do lugar (fração do passo): a teia velha não é regular.
 */
const RAIO_LIVRE = 3.2
const PASSO_DA_ESPIRAL = 2.9
const FIM_DA_ESPIRAL = 0.84
const DESVIO_DA_ESPIRAL = 0.3
/**
 * A espiral também não passa desta fração da elipse da teia: ela é redonda e não acompanha o polígono do
 * quadro (com o quadro, as voltas saíam em polígonos encaixados, um sinal de trânsito).
 */
const FIM_NA_ELIPSE = 0.88
/** A barriga de cada corda para o miolo (fração do passo): a de sempre e a da corda caída, e a chance de cair. */
const BARRIGA = 0.24
const BARRIGA_CAIDA = 1.2
const CHANCE_DE_CAIR = 0.13
/** A barriga nunca passa desta fração do raio da corda (as voltas de dentro são curtas). */
const BARRIGA_MAXIMA = 0.45
/** A corda rompida: a chance, o vão (fração do setor) e o quanto as pontas soltas caem (fração do passo). */
const CHANCE_DE_ROMPER = 0.09
const VAO_DO_ROMPIDO = 0.32
const PONTA_SOLTA = 0.5
/** O rasgo: o primeiro setor (contado do primeiro raio), quantos setores e as voltas (frações) em que a espiral sumiu. */
const RASGO = { setor: 3, setores: 2, de: 0.25, ate: 0.62 }
/** Marca da corda que sumiu no rasgo (no lugar de onde ela rompeu). */
const SUMIU = 2
/** Os anéis apertados do miolo (px de partida) e o véu de seda mais claro dentro dele. */
const ANEIS_DO_MIOLO: readonly number[] = [0.9, 1.7, 2.5]
const RAIO_DA_SEDA_DO_MIOLO = 2.9
const SEDA_DO_MIOLO = 0.24
/** Os fiapos soltos: o canto do quadro de onde saem e o caminho (px de partida, a partir do canto). */
const FIAPOS: readonly (readonly [number, readonly Ponto[]])[] = [
  [2, [[0, 0], [1.1, 2.2], [0.4, 4.4], [1.5, 6.4]]],
  [4, [[0, 0], [-1.4, 1.6], [-1.6, 3.9], [-0.7, 5.6]]],
  [0, [[0, 0], [2.0, -0.6], [3.6, 0.5]]],
]
/**
 * Os casulos: o rumo (graus) do raio em que ficam, a altura nele (fração do raio), o comprimento e a grossura (px
 * de partida). O casulo é um fuso de pontas finas, o que o separa de uma pedrinha.
 */
const CASULOS: readonly (readonly [number, number, number, number])[] = [
  [128, 0.55, 4.6, 2.1],
  [-48, 0.86, 3.6, 1.7],
]
/** Quantos pontos tem cada lado do fuso e o quanto a ponta afina (expoente do seno). */
const PONTOS_DO_FUSO = 10
const PONTA_DO_FUSO = 0.7

/**
 * Os fios: a meia grossura (px) e a opacidade de cada tipo. O raio e o quadro são fio de armação, mais grosso que
 * o da espiral. Em pixels, a meia grossura nunca fica abaixo de `MEIA_MINIMA_EM_PIXELS`: no tamanho de mesa o
 * fio é um pixel inteiro, meio transparente, e de perto continua fino.
 */
const MEIA_DO_RAIO = 0.22
const MEIA_DO_QUADRO = 0.24
const MEIA_DA_ESPIRAL = 0.17
const MEIA_DO_FIAPO = 0.15
const MEIA_DO_MIOLO = 0.18
const MEIA_MINIMA_EM_PIXELS = 0.42
const ALFA_DO_RAIO = 0.64
const ALFA_DO_QUADRO = 0.64
const ALFA_DA_ESPIRAL = 0.54
const ALFA_DO_FIAPO = 0.46
const ALFA_DO_MIOLO = 0.56
/** O fio velho não é igual de ponta a ponta: a opacidade cai até esta fração em uns trechos. */
const FIO_FALHADO = 0.68
/** O brilho que corre pelo fio (a seda pega a luz em uns trechos). */
const BRILHO_DO_FIO = 0.12

/**
 * O véu de pó: a opacidade mais forte, onde ele começa a sumir e onde acaba (frações do raio do quadro) e o
 * reforço junto do miolo, tudo vezes a mancha (o pó não assenta por igual).
 */
const VEU_MAXIMO = 0.24
const VEU_SOME_DE = 0.4
const VEU_SOME_ATE = 0.97
const VEU_DO_MIOLO = 0.12

/**
 * A sombra fina dos fios, pintada na própria peça (a textura sabe a escala e alisa a linha no tamanho de mesa): a
 * altura em que a teia fica (px; dá o afastamento para baixo à direita), a força (fração da cobertura do fio) e a
 * cor, um escuro quente. A dos casulos é sombra de verdade, no chão, e vai um pouco mais longe.
 */
const ALTURA_DOS_FIOS = 3.4
const FORCA_DA_SOMBRA = 0.42
/** A sombra é medida com esta fração da escala: a linha dela sai mais larga e mais macia que o fio. */
const MACIEZ_DA_SOMBRA = 0.55
const COR_DA_SOMBRA: Rgb = [0x2e, 0x2a, 0x25]
const ALTURA_DO_CASULO = 4.2
/**
 * O escuro em que o pixel escuro demais é levantado (o piso de luz): cinza neutro, de luminância linear 0,066.
 * Com o da nogueira a beira de baixo dos casulos, na sombra, saía marrom.
 */
const ESCURO_DA_TEIA: Rgb = [0x4c, 0x48, 0x42]

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function suave(a: number, b: number, t: number): number {
  const x = limitar((t - a) / (b - a), 0, 1)
  return x * x * (3 - 2 * x)
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus; de cima é sempre 0, quem gira é a imagem pronta), como nos ossos.
 */
function desgirado(dx: number, dy: number, giro: number): Ponto {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

function distanciaAoSegmento(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax
  const ey = by - ay
  const wx = x - ax
  const wy = y - ay
  const h = limitar((wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-12), 0, 1)
  return Math.hypot(wx - ex * h, wy - ey * h)
}

/** Onde o rumo (ux, uy) que sai de (x, y), dentro da pegada, encontra a beira dela (recuada `recuo` px). */
function naBeira(x: number, y: number, ux: number, uy: number, hw: number, hh: number, recuo: number): Ponto {
  const bx = hw - recuo
  const by = hh - recuo
  let t = LONGE
  if (ux > 1e-9) t = Math.min(t, (bx - x) / ux)
  if (ux < -1e-9) t = Math.min(t, (-bx - x) / ux)
  if (uy > 1e-9) t = Math.min(t, (by - y) / uy)
  if (uy < -1e-9) t = Math.min(t, (-by - y) / uy)
  return [x + ux * t, y + uy * t]
}

/** Onde o rumo (ux, uy) que sai do miolo (mx, my) encontra o quadro (px a partir do miolo). */
function ateOQuadro(mx: number, my: number, ux: number, uy: number, quadro: readonly Ponto[]): number {
  let melhor = LONGE
  for (let j = 0; j < quadro.length; j += 1) {
    const [ax, ay] = quadro[j]
    const [bx, by] = quadro[(j + 1) % quadro.length]
    const ex = bx - ax
    const ey = by - ay
    const den = ux * ey - uy * ex
    if (Math.abs(den) < 1e-12) continue
    const wx = ax - mx
    const wy = ay - my
    const t = (wx * ey - wy * ex) / den
    const s = (wx * uy - wy * ux) / den
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9 && t < melhor) melhor = t
  }
  return melhor
}

// ---------- a teia tecida (as medidas prontas, uma vez por imagem) ----------

interface Teia {
  readonly mx: number
  readonly my: number
  /** Px por px de partida: as medidas miúdas crescem com a raiz do raio da teia. */
  readonly k: number
  readonly raios: number
  readonly voltas: number
  /** O rumo de cada raio, crescente a partir do primeiro; o último valor é o primeiro mais uma volta. */
  readonly rumos: Float64Array
  /** Onde cada raio encontra o quadro (px a partir do miolo). */
  readonly fimDoRaio: Float64Array
  /** O raio de cada nível da espiral: volta v no raio i, de 0 a `raios` (o último é o raio 0 na volta seguinte). */
  readonly nivel: Float64Array
  /** A barriga de cada corda (px, para o miolo) e onde ela rompeu (fração do setor; negativo = inteira; `SUMIU` = rasgo). */
  readonly barriga: Float64Array
  readonly corte: Float64Array
  readonly queda: number
  /** Até onde vai a teia (px a partir do miolo): fora dela só os fios retos. */
  readonly alcance: number
  /** Os fios retos (o quadro, a ancoragem e os fiapos): ax, ay, bx, by, meia grossura e opacidade de cada um. */
  readonly retos: Float64Array
}

function porReto(lista: number[], a: Ponto, b: Ponto, meia: number, alfa: number): void {
  lista.push(a[0], a[1], b[0], b[1], meia, alfa)
}

/** O ponto preso dentro da pegada (recuado `recuo` px da beira). */
function dentroDaPegada([x, y]: Ponto, hw: number, hh: number, recuo: number): Ponto {
  return [limitar(x, -hw + recuo, hw - recuo), limitar(y, -hh + recuo, hh - recuo)]
}

function tecer(w: number, h: number): Teia {
  const hw = w / 2
  const hh = h / 2
  const menor = Math.min(hw, hh)
  // A teia fica presa ao menor lado: esticada, ela alonga no máximo `ALONGAMENTO_MAXIMO` e o resto é ancoragem.
  const ex = Math.min(hw, menor * ALONGAMENTO_MAXIMO) * RAIO_DA_TEIA
  const ey = Math.min(hh, menor * ALONGAMENTO_MAXIMO) * RAIO_DA_TEIA
  const raioMedio = Math.sqrt(ex * ey)
  const k = Math.sqrt(raioMedio / RAIO_DE_PARTIDA)
  const mx = MIOLO[0] * hw
  const my = MIOLO[1] * hh

  // O quadro: cada canto no rumo dele, encolhido para o miolo se passar da folga da beira.
  const quadro: Ponto[] = CANTOS_DO_QUADRO.map(([graus, f]) => {
    const vx = Math.cos(graus * GRAU) * ex * f
    const vy = Math.sin(graus * GRAU) * ey * f
    let s = 1
    const bx = hw - FOLGA_DO_QUADRO
    const by = hh - FOLGA_DO_QUADRO
    if (mx + vx > bx) s = Math.min(s, (bx - mx) / vx)
    if (mx + vx < -bx) s = Math.min(s, (-bx - mx) / vx)
    if (my + vy > by) s = Math.min(s, (by - my) / vy)
    if (my + vy < -by) s = Math.min(s, (-by - my) / vy)
    return [mx + vx * s, my + vy * s]
  })

  const retos: number[] = []
  quadro.forEach((canto, j) => porReto(retos, canto, quadro[(j + 1) % quadro.length], MEIA_DO_QUADRO, ALFA_DO_QUADRO))
  // A ancoragem: de cada canto para fora, no rumo que sai do miolo, até a beira da pegada.
  quadro.forEach(([cx, cy], j) => {
    const rumo = Math.atan2(cy - my, cx - mx)
    ANCORAS[j].forEach((desvio, n) => {
      const ux = Math.cos(rumo + desvio * GRAU)
      const uy = Math.sin(rumo + desvio * GRAU)
      const [bx, by] = naBeira(cx, cy, ux, uy, hw, hh, 0.2)
      if (j !== ANCORA_ROMPIDA.canto || n !== ANCORA_ROMPIDA.fio) {
        porReto(retos, [cx, cy], [bx, by], MEIA_DO_QUADRO, ALFA_DO_QUADRO)
        return
      }
      // A que rompeu vai até o meio do caminho e a ponta, frouxa, cai de lado e volta um pouco para o canto.
      const fim: Ponto = [cx + (bx - cx) * ANCORA_ROMPIDA.ate, cy + (by - cy) * ANCORA_ROMPIDA.ate]
      const v = ANCORA_ROMPIDA.queda * k
      const dobra: Ponto = dentroDaPegada([fim[0] - uy * v * 0.7 - ux * v * 0.2, fim[1] + ux * v * 0.7 - uy * v * 0.2], hw, hh, 0.5)
      const ponta: Ponto = dentroDaPegada([dobra[0] - uy * v * 0.5 - ux * v * 0.8, dobra[1] + ux * v * 0.5 - uy * v * 0.8], hw, hh, 0.5)
      porReto(retos, [cx, cy], fim, MEIA_DO_QUADRO, ALFA_DO_QUADRO)
      porReto(retos, fim, dobra, MEIA_DO_FIAPO, ALFA_DO_FIAPO)
      porReto(retos, dobra, ponta, MEIA_DO_FIAPO, ALFA_DO_FIAPO)
    })
  })
  // Os fiapos pendurados nos cantos.
  for (const [canto, caminho] of FIAPOS) {
    const [cx, cy] = quadro[canto]
    const pontos = caminho.map(([px, py]): Ponto => dentroDaPegada([cx + px * k, cy + py * k], hw, hh, 0.5))
    for (let i = 1; i < pontos.length; i += 1) porReto(retos, pontos[i - 1], pontos[i], MEIA_DO_FIAPO, ALFA_DO_FIAPO)
  }

  // Os raios, do miolo até o quadro.
  const raios = Math.round(RAIOS_DE_PARTIDA + RAIOS_A_MAIS * Math.max(0, raioMedio / RAIO_DE_PARTIDA - 1))
  const setor = VOLTA / raios
  const rumos = new Float64Array(raios + 1)
  const fimDoRaio = new Float64Array(raios)
  for (let i = 0; i < raios; i += 1) {
    rumos[i] = RUMO_DO_PRIMEIRO_RAIO * GRAU + (i + (hash(i, 1, 1717) - 0.5) * DESVIO_DO_RAIO) * setor
    fimDoRaio[i] = ateOQuadro(mx, my, Math.cos(rumos[i]), Math.sin(rumos[i]), quadro)
  }
  rumos[raios] = rumos[0] + VOLTA

  // A espiral: o nível da volta v no raio i sobe da volta livre até perto do quadro (sem passar da elipse da
  // teia: as voltas ficam redondas), um tanto fora do lugar.
  const livre = RAIO_LIVRE * k
  const fimDaEspiral = new Float64Array(raios)
  let somaDoFim = 0
  for (let i = 0; i < raios; i += 1) {
    const naElipse = 1 / Math.hypot(Math.cos(rumos[i]) / ex, Math.sin(rumos[i]) / ey)
    fimDaEspiral[i] = Math.min(fimDoRaio[i] * FIM_DA_ESPIRAL, naElipse * FIM_NA_ELIPSE)
    somaDoFim += fimDaEspiral[i]
  }
  const voltas = Math.max(3, Math.round((somaDoFim / raios - livre) / (PASSO_DA_ESPIRAL * k)))
  const passo = (somaDoFim / raios - livre) / voltas
  const nivel = new Float64Array(voltas * (raios + 1))
  for (let v = 0; v < voltas; v += 1) {
    for (let i = 0; i <= raios; i += 1) {
      const fim = fimDaEspiral[i % raios]
      const subida = (v + i / raios) / voltas
      // O nível (v, raios) é o mesmo ponto que (v + 1, 0): o sorteio usa o índice corrido da espiral.
      const desvio = (hash(v * raios + i, 3, 1717) - 0.5) * 2 * DESVIO_DA_ESPIRAL * passo
      nivel[v * (raios + 1) + i] = Math.max(livre * 0.85, livre + (fim - livre) * subida + desvio)
    }
  }
  const barriga = new Float64Array(voltas * raios)
  const corte = new Float64Array(voltas * raios)
  const rasgoDe = Math.round(RASGO.de * voltas)
  const rasgoAte = Math.round(RASGO.ate * voltas)
  for (let v = 0; v < voltas; v += 1) {
    for (let i = 0; i < raios; i += 1) {
      const q = v * raios + i
      const a = nivel[v * (raios + 1) + i]
      const b = nivel[v * (raios + 1) + i + 1]
      const caida = hash(q, 5, 1717) < CHANCE_DE_CAIR
      const funda = caida ? BARRIGA_CAIDA : BARRIGA * (0.5 + hash(q, 6, 1717))
      barriga[q] = Math.min(funda * passo, BARRIGA_MAXIMA * Math.min(a, b))
      const noRasgo = (i - RASGO.setor + raios) % raios < RASGO.setores && v >= rasgoDe && v <= rasgoAte
      corte[q] = noRasgo ? SUMIU : hash(q, 7, 1717) < CHANCE_DE_ROMPER ? 0.3 + 0.4 * hash(q, 8, 1717) : -1
    }
  }
  let alcance = 0
  for (let i = 0; i < raios; i += 1) alcance = Math.max(alcance, fimDoRaio[i])
  return {
    mx,
    my,
    k,
    raios,
    voltas,
    rumos,
    fimDoRaio,
    nivel,
    barriga,
    corte,
    queda: PONTA_SOLTA * passo,
    alcance: alcance + 1,
    retos: Float64Array.from(retos),
  }
}

// ---------- o fio mais perto de cada pixel ----------

/** O que `avaliar` acha no ponto: [opacidade dos fios, opacidade do véu]. */
const AVAL = new Float64Array(2)

/**
 * Anota um fio a `d` px do ponto: fica a cobertura mais forte (os fios que se cruzam não somam). `escala` =
 * pixels por px; a meia grossura em pixels não cai abaixo de `MEIA_MINIMA_EM_PIXELS`.
 */
function marcar(d: number, meia: number, alfa: number, escala: number): void {
  const cobre = limitar(0.5 + Math.max(meia * escala, MEIA_MINIMA_EM_PIXELS) - d * escala, 0, 1) * alfa
  if (cobre > AVAL[0]) AVAL[0] = cobre
}

/** A distância ao raio que sai do miolo no rumo `beta` (radianos a partir do ponto) e vai até `fim`. */
function distanciaAoRaio(r: number, beta: number, fim: number): number {
  const ao = r * Math.cos(beta)
  const atraves = r * Math.abs(Math.sin(beta))
  if (ao < 0) return r
  return ao > fim ? Math.hypot(ao - fim, atraves) : atraves
}

/**
 * Mede o ponto (x, y): os fios retos, os anéis do miolo, os dois raios do setor em que ele cai e as cordas da
 * espiral nesse setor. Cada corda vai do nível dela num raio ao nível no raio seguinte (a reta, em coordenada
 * polar), menos a barriga; a distância é a diferença de raio corrigida pela inclinação da corda. `escala` = pixels
 * por px; sem `comVeu` (a sombra), só os fios.
 */
function avaliar(t: Teia, x: number, y: number, escala: number, comVeu: boolean): void {
  AVAL[0] = 0
  AVAL[1] = 0
  const R = t.retos
  for (let j = 0; j < R.length; j += 6) marcar(distanciaAoSegmento(x, y, R[j], R[j + 1], R[j + 2], R[j + 3]), R[j + 4], R[j + 5], escala)
  const dx = x - t.mx
  const dy = y - t.my
  const r = Math.hypot(dx, dy)
  if (r > t.alcance) return
  // O miolo: os anéis apertados, tortos pelo ruído (lido pelo rumo, sem emenda em volta).
  const ux = r > 1e-6 ? dx / r : 1
  const uy = r > 1e-6 ? dy / r : 0
  for (const anel of ANEIS_DO_MIOLO) {
    const raio = anel * t.k * (1 + 0.16 * ruido(ux * 1.8 + anel * 3.1, uy * 1.8 + anel))
    marcar(Math.abs(r - raio), MEIA_DO_MIOLO, ALFA_DO_MIOLO, escala)
  }
  // O setor do ponto: entre o raio i e o seguinte.
  const n = t.raios
  const rumos = t.rumos
  let th = Math.atan2(dy, dx) - rumos[0]
  th -= Math.floor(th / VOLTA) * VOLTA
  let i = 0
  while (i < n - 1 && th >= rumos[i + 1] - rumos[0]) i += 1
  const delta = rumos[i + 1] - rumos[i]
  const al = th - (rumos[i] - rumos[0])
  const seguinte = (i + 1) % n
  marcar(distanciaAoRaio(r, al, t.fimDoRaio[i]), MEIA_DO_RAIO, ALFA_DO_RAIO, escala)
  marcar(distanciaAoRaio(r, delta - al, t.fimDoRaio[seguinte]), MEIA_DO_RAIO, ALFA_DO_RAIO, escala)
  // As cordas da espiral no setor.
  const sa = Math.sin(al)
  const ca = Math.cos(al)
  const sd = Math.sin(delta - al)
  const cd = Math.cos(delta - al)
  const sD = Math.sin(delta)
  const fi = al / delta
  const curva = 4 * fi * (1 - fi)
  const dCurva = (4 * (1 - 2 * fi)) / delta
  const meioVao = VAO_DO_ROMPIDO / 2
  for (let v = 0; v < t.voltas; v += 1) {
    const q = v * n + i
    const corte = t.corte[q]
    if (corte >= SUMIU) continue
    let solta = 0
    let dSolta = 0
    if (corte >= 0) {
      if (Math.abs(fi - corte) < meioVao) continue
      // A ponta solta cai mais quanto mais perto do corte.
      if (fi < corte) {
        const ate = corte - meioVao
        const u = fi / ate
        solta = t.queda * u * u
        dSolta = (2 * t.queda * u) / (ate * delta)
      } else {
        const ate = 1 - corte - meioVao
        const u = (1 - fi) / ate
        solta = t.queda * u * u
        dSolta = (-2 * t.queda * u) / (ate * delta)
      }
    }
    const a = t.nivel[v * (n + 1) + i]
    const b = t.nivel[v * (n + 1) + i + 1]
    const D = b * sd + a * sa
    if (D <= 1e-9) continue
    const C = a * b * sD
    const reta = C / D
    const dReta = (-C * (a * ca - b * cd)) / (D * D)
    const barriga = t.barriga[q]
    const rho = reta - barriga * curva - solta
    const dRho = dReta - barriga * dCurva - dSolta
    if (rho <= 0) continue
    marcar((Math.abs(r - rho) * rho) / Math.sqrt(rho * rho + dRho * dRho), MEIA_DA_ESPIRAL, ALFA_DA_ESPIRAL, escala)
  }
  // A seda mais cheia do miolo e o véu de pó entre os raios, pela fração do caminho até o quadro.
  const seda = (1 - suave(0, RAIO_DA_SEDA_DO_MIOLO * t.k, r)) * SEDA_DO_MIOLO
  if (seda > AVAL[0]) AVAL[0] = seda
  if (!comVeu) return
  const fimAqui = t.fimDoRaio[i] + (t.fimDoRaio[seguinte] - t.fimDoRaio[i]) * fi
  const ate = r / fimAqui
  const mancha = limitar(0.5 + ruido(x * 0.11 + 3.1, y * 0.11 - 1.7) * 1.8 + ruido(x * 0.37, y * 0.37 + 5.3) * 0.6, 0, 1)
  AVAL[1] = ((1 - suave(VEU_SOME_DE, VEU_SOME_ATE, ate)) * VEU_MAXIMO + (1 - suave(0, 0.3, ate)) * VEU_DO_MIOLO) * mancha
}

// ---------- as peças ----------

/**
 * A teia: só a sombra fina, o véu e o fio são pintados (o resto da pegada fica transparente), de baixo para cima,
 * como o motor junta as peças. A sombra é a cobertura do fio no ponto de onde ela veio, afastada (ox, oy).
 */
function texDaTeia(t: Teia, ox: number, oy: number): Textura {
  return (_u, _v, x, y, p, s, escala) => {
    avaliar(t, x - ox, y - oy, escala * MACIEZ_DA_SOMBRA, false)
    const sombra = AVAL[0] * FORCA_DA_SOMBRA
    avaliar(t, x, y, escala, true)
    const falha = FIO_FALHADO + (1 - FIO_FALHADO) * limitar(0.5 + ruido(x * 0.3 + p.su, y * 0.3 + p.sv) * 1.6, 0, 1)
    const fio = AVAL[0] * falha
    const veu = AVAL[1]
    // Cor já multiplicada pela opacidade: a sombra, por cima dela o véu e por cima de tudo o fio.
    let a = sombra
    let r = COR_DA_SOMBRA[0] * sombra
    let g = COR_DA_SOMBRA[1] * sombra
    let b = COR_DA_SOMBRA[2] * sombra
    r = COR_DO_VEU[0] * veu + r * (1 - veu)
    g = COR_DO_VEU[1] * veu + g * (1 - veu)
    b = COR_DO_VEU[2] * veu + b * (1 - veu)
    a = veu + a * (1 - veu)
    r = COR_DO_FIO[0] * fio + r * (1 - fio)
    g = COR_DO_FIO[1] * fio + g * (1 - fio)
    b = COR_DO_FIO[2] * fio + b * (1 - fio)
    a = fio + a * (1 - fio)
    s[5] = a
    if (a <= 0) return
    s[0] = r / a
    s[1] = g / a
    s[2] = b / a
    s[3] += ruido(x * 0.21 + p.su, y * 0.21 + p.sv) * BRILHO_DO_FIO * (fio / a)
  }
}

/** O casulo: um fuso de pontas finas (`comprimento` e `grossura` em px) ao longo de `angulo`. */
function fuso(cx: number, cy: number, comprimento: number, grossura: number, angulo: number): Forma {
  const co = Math.cos(angulo)
  const si = Math.sin(angulo)
  const ponto = (t: number, lado: number): Ponto => {
    const ao = (t - 0.5) * comprimento
    const meia = lado * Math.pow(Math.sin(Math.PI * t), PONTA_DO_FUSO) * (grossura / 2)
    return [cx + ao * co - meia * si, cy + ao * si + meia * co]
  }
  const pontos: Ponto[] = []
  for (let i = 0; i <= PONTOS_DO_FUSO; i += 1) pontos.push(ponto(i / PONTOS_DO_FUSO, 1))
  for (let i = PONTOS_DO_FUSO - 1; i >= 1; i -= 1) pontos.push(ponto(i / PONTOS_DO_FUSO, -1))
  return poligono(pontos)
}

/** O casulo: as voltas do fio enrolado, de través, e o pó. */
function texDoCasulo(cx: number, cy: number, angulo: number): Textura {
  const co = Math.cos(angulo)
  const si = Math.sin(angulo)
  return (_u, _v, x, y, p, s) => {
    const ao = (x - cx) * co + (y - cy) * si
    const atraves = -(x - cx) * si + (y - cy) * co
    const voltas = Math.sin(ao * 3.4 + atraves * 1.3 + ruido(x * 0.8 + p.su, y * 0.8) * 2.2)
    const t = limitar((voltas - 0.35) / 0.5, 0, 1) * 0.5
    s[0] += (VOLTA_DO_CASULO[0] - s[0]) * t
    s[1] += (VOLTA_DO_CASULO[1] - s[1]) * t
    s[2] += (VOLTA_DO_CASULO[2] - s[2]) * t
    s[3] += ruido(x * 1.1 + p.sv, y * 1.1) * 0.06
  }
}

/** A forma afastada (dx, dy): onde cai a sombra dela. */
function afastada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** O quanto o rumo `a` está longe do rumo `b` (radianos, de 0 a meia volta). */
function longeDoRumo(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

export const montarTeiaDeAranha: MontarMovel = (c, cena) => {
  const { hw, hh } = c
  const t = tecer(c.w, c.h)
  cena.corDoPiso = ESCURO_DA_TEIA
  // A sombra fina vai na própria peça, com altura zero (a teia é rente): o afastamento é desgirado.
  const [ox, oy] = desgirado(SOMBRA_X * ALTURA_DOS_FIOS, SOMBRA_Y * ALTURA_DOS_FIOS, c.giro)
  cena.partes.push(c.peca(caixa(-hw, -hh, hw, hh), TEIA, { bisel: 0, contorno: 0, tabua: 0, textura: texDaTeia(t, ox, oy), semente: 1701 }))
  // Os casulos, enrolados no raio mais perto do rumo pedido, deitados ao longo dele.
  const [sx, sy] = desgirado(SOMBRA_X * ALTURA_DO_CASULO, SOMBRA_Y * ALTURA_DO_CASULO, c.giro)
  CASULOS.forEach(([graus, altura, comprimento, grossura], n) => {
    let melhor = 0
    for (let i = 1; i < t.raios; i += 1) if (longeDoRumo(t.rumos[i], graus * GRAU) < longeDoRumo(t.rumos[melhor], graus * GRAU)) melhor = i
    const rumo = t.rumos[melhor]
    const longe = t.fimDoRaio[melhor] * altura
    const px = t.mx + Math.cos(rumo) * longe
    const py = t.my + Math.sin(rumo) * longe
    const forma = fuso(px, py, comprimento * t.k, grossura * t.k, rumo)
    cena.sombras.push(contato(forma, 0.28), { forma: afastada(forma, sx, sy), z: 0, suave: 0.7, forca: 0.22 })
    cena.partes.push(
      c.peca(forma, CASULO, {
        bisel: (grossura * t.k) / 2,
        contorno: 0.18,
        semente: 1710 + n,
        textura: texDoCasulo(px, py, rumo),
        projeta: { dist: 0.7, forca: 0.22, suave: 0.6 },
      }),
    )
  })
}
