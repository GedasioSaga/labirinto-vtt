/**
 * LATRINA DE CELA de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"): o buraco de pedra
 * no chão da cela. Uma LAJE de pedra de beira lascada, assentada rente ao piso com um fio de beirada; nela, o BURACO
 * oval e comprido, de boca irregular (cavado à mão, não torneado), com a BORDA GASTA em volta, mais clara e lisa de
 * anos de uso, e a parede de dentro que pega luz do lado de baixo à direita enquanto o fundo some no escuro. Da frente
 * do buraco sai a CANALETA rasa e estreita que corre até a beira da frente da laje. Dos dois lados, os PISANTES: dois
 * ovais de pedra um pouco mais altos, gastos, com dois sulcos finos cada um, onde se põem os pés. Em volta do buraco e
 * ao longo da canaleta, a pedra ÚMIDA, mais escura; duas RACHADURAS finas na laje. Contida de propósito: nada além da
 * umidade diz o que é. (O buraco em fechadura de antes lia como fechadura.) Desenho original.
 *
 * Mora no chão (`ehMovelDoChao`), como o tapete: só o contato, sem altura; na 3/4 (DERIVADO, sem estrutura que suba)
 * fica como de cima. A frente é o lado de baixo (a canaleta corre para ela). Material: `pedra` (a laje, os pisantes e
 * a borda); a umidade e o fundo do buraco saem do tom dela.
 */
import { hash, limitar01, misturar, type Rgb } from '../../ruido'
import { caixa, capsula, cadeia, dentroDe, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** A latrina foi medida no tamanho de partida (1 casa, 28 px de meio lado): as medidas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 0.5 * G
/** A laje: quanto recua da pegada, o quanto cada quina foi lascada (de, até) e o quanto a beira entra (px). */
const RECUO_DA_LAJE = 1.4
const LASCA = { de: 1.4, ate: 3.6 } as const
const TORTO = 0.7
/** O buraco oval (o meio e os raios) e quanto a boca dele entra e sai da elipse (px de partida). */
const BURACO = { y: -2.6, rx: 5, ry: 7 } as const
const BOCA_TORTA = 0.6
/** A canaleta: a meia largura (px) e o quanto ela é funda perto da do buraco (o tom do fundo dela). */
const CANALETA = { meia: 0.85, escuro: 0.4, parede: 0.5 } as const
/** A borda gasta em volta do buraco (px) e a parede de dentro que aparece. */
const BORDA = 2.4
const PAREDE = 2.4
/** Os pisantes: o meio de cada um (x a partir do meio, y), os raios, onde ficam os dois sulcos e o alfa deles. */
const PISANTE = { x: 11.6, y: 3.4, rx: 3.4, ry: 7, sulco: 2 } as const
const ALFA_DOS_SULCOS = 0.26
/** O escuro do fundo e o da umidade, para onde o tom da pedra é puxado. */
const ESCURO: Rgb = [0x26, 0x23, 0x20]
const UMIDO: Rgb = [0x3a, 0x38, 0x33]
/** O escuro em que o pixel escuro demais é levantado: o cinza quente da pedra. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

const DA_PEDRA = texturaDaClasse('pedra')

/** A pedra GASTA: o grão da pedra pela metade (a borda alisada pelo uso). */
const texGasta: Textura = (u, v, x, y, p, s, escala) => {
  const antes = s[3]
  if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
  s[3] = antes + (s[3] - antes) * 0.45
}

/**
 * O buraco (ou a canaleta): a parede de dentro pega luz onde a beira olha para baixo à direita (a parede de lá fica de
 * frente para a luz) e fica na sombra do lado da luz; o fundo escurece com a profundidade. `forca` amansa tudo (a
 * canaleta é rasa).
 */
function texDoBuraco(buraco: Forma, parede: number, k: number, forca: number): Textura {
  const e = 0.35
  return (_u, _v, x, y, _p, s) => {
    const t = -buraco.d(x, y)
    const nx = buraco.d(x + e, y) - buraco.d(x - e, y)
    const ny = buraco.d(x, y + e) - buraco.d(x, y - e)
    const virada = (0.79 * nx + 0.61 * ny) / (Math.hypot(nx, ny) || 1)
    const naParede = limitar01(1 - t / parede)
    s[3] += ((Math.max(0, virada) * 0.46 - Math.max(0, -virada) * 0.16) * naParede - limitar01(t / (4.6 * k)) * 0.3) * forca
  }
}

/** A laje de beira lascada: as quinas cortadas em tamanhos sorteados e as beiras entrando um pouco. */
function lajeLascada(hw: number, hh: number, k: number): Forma {
  const [x0, y0, x1, y1] = [-hw + RECUO_DA_LAJE * k, -hh + RECUO_DA_LAJE * k, hw - RECUO_DA_LAJE * k, hh - RECUO_DA_LAJE * k]
  const cantos: readonly Ponto[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const pontos: Ponto[] = []
  cantos.forEach(([ax, ay], i) => {
    const [bx, by] = cantos[(i + 1) % 4]
    const lasca = (LASCA.de + (LASCA.ate - LASCA.de) * hash(i, 1, 2610)) * k
    const comprimento = Math.hypot(bx - ax, by - ay)
    const [tx, ty] = [(bx - ax) / comprimento, (by - ay) / comprimento]
    // A normal para dentro da laje (os cantos andam no sentido do relógio na tela).
    const [nx, ny] = [-ty, tx]
    pontos.push([ax + tx * lasca, ay + ty * lasca])
    for (const f of [0.33, 0.66]) {
      const entra = TORTO * k * hash(i, Math.round(f * 10), 2611)
      pontos.push([ax + (bx - ax) * f + nx * entra, ay + (by - ay) * f + ny * entra])
    }
    pontos.push([bx - tx * lasca * (0.6 + 0.4 * hash(i, 2, 2610)), by - ty * lasca * (0.6 + 0.4 * hash(i, 2, 2610))])
  })
  return poligono(pontos)
}

/**
 * O oval de boca irregular: a elipse com a beira entrando e saindo até `amplitude` px, em três ondas de voltas
 * diferentes em volta dela (a pedra cavada à mão).
 */
function ovalTorto(cx: number, cy: number, rx: number, ry: number, amplitude: number): Forma {
  const base = elipse(cx, cy, rx, ry)
  const [f3, f5, f9] = [0, 1, 2].map((i) => hash(i, 3, 2615) * Math.PI * 2)
  const m = amplitude * 1.2
  return {
    b: [base.b[0] - m, base.b[1] - m, base.b[2] + m, base.b[3] + m],
    d(x, y) {
      const a = Math.atan2((y - cy) / ry, (x - cx) / rx)
      const onda = 0.55 * Math.sin(3 * a + f3) + 0.3 * Math.sin(5 * a + f5) + 0.15 * Math.sin(9 * a + f9)
      return base.d(x, y) - amplitude * onda
    },
  }
}

/** A forma crescida `r` px para fora (a borda em volta do buraco). */
function crescida(f: Forma, r: number): Forma {
  return { b: [f.b[0] - r, f.b[1] - r, f.b[2] + r, f.b[3] + r], d: (x, y) => f.d(x, y) - r }
}

export const montarLatrinaDeCela: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh) / MEIO_LADO_DE_PARTIDA
  const L = cena.partes
  const pedra = c.m.pedra
  cena.corDoPiso = ESCURO_DA_PEDRA
  const laje = lajeLascada(hw, hh, k)
  cena.sombras.push(contato(laje, 0.28))

  // A LAJE: o fio de beirada e a pedra.
  L.push(P(laje, pedra, { dx: 0.3 * k, dy: 0.9 * k, tabua: 0, bisel: 0.5 * k, tom: 0.6, contorno: 0.3, semente: 26101 }))
  L.push(P(laje, pedra, { tabua: 0, bisel: 1.6 * k, tom: 0.95, contorno: 0.28, semente: 26102 }))

  // A UMIDADE em volta do buraco e ao longo da canaleta, mansa, mais funda para a frente (onde escorre).
  const umido: MaterialDaPeca = { classe: 'liso', rgb: misturar(pedra.rgb, UMIDO, 0.6) }
  L.push(P(uniao(elipse(0, BURACO.y * k, 11.5 * k, 12.5 * k), elipse(0, 14 * k, 4.6 * k, 12 * k)), umido, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 4 * k, semente: 26103 }))

  // As RACHADURAS finas: uma da quina de cima à direita, outra da beira da esquerda.
  const vao: MaterialDaPeca = { classe: 'liso', rgb: misturar(pedra.rgb, ESCURO, 0.7) }
  const rachaduras: readonly (readonly Ponto[])[] = [
    [[hw - 3.2 * k, -hh + 4.4 * k], [hw - 8.4 * k, -hh + 8.2 * k], [hw - 10.6 * k, -hh + 13.6 * k], [hw - 15.8 * k, -hh + 15.4 * k]],
    [[-hw + 1.8 * k, 4 * k], [-hw + 5.6 * k, 5.2 * k], [-hw + 8.2 * k, 8.8 * k]],
  ]
  rachaduras.forEach((r, i) => L.push(P(cadeia(r, 0.3 * k), vao, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.55, semente: 26104 + i })))

  // Os PISANTES: dois ovais um pouco mais altos, de pedra gasta, com dois sulcos finos de través.
  for (const lado of [-1, 1]) {
    const [px, py] = [lado * PISANTE.x * k, PISANTE.y * k]
    L.push(P(elipse(px, py, PISANTE.rx * k, PISANTE.ry * k), pedra, { tabua: 0, bisel: 1.5 * k, tom: 1.05, contorno: 0.2, textura: texGasta, semente: 26110 + lado, projeta: { dist: 0.7 * k, forca: 0.26, suave: 0.8 * k } }))
    for (const f of [-1, 1]) {
      const y = py + f * PISANTE.sulco * k
      const meia = PISANTE.rx * k * Math.sqrt(1 - ((f * PISANTE.sulco) / PISANTE.ry) ** 2) * 0.6
      L.push(P(capsula(px - meia, y, px + meia, y, 0.3 * k), vao, { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DOS_SULCOS, semente: 26114 + (lado + 1) + (f + 1) / 2 }))
    }
  }

  // A BORDA GASTA em volta do buraco, a CANALETA da frente do buraco até a beira da laje e o BURACO oval, com a parede
  // de dentro e o fundo escuro (por cima do começo da canaleta).
  const buraco = ovalTorto(0, BURACO.y * k, BURACO.rx * k, BURACO.ry * k, BOCA_TORTA * k)
  L.push(P(menos(crescida(buraco, BORDA * k), buraco), pedra, { tabua: 0, bisel: BORDA * k * 0.9, tom: 1.1, contorno: 0.12, textura: texGasta, semente: 26120 }))
  const canaleta = dentroDe(caixa(-CANALETA.meia * k, (BURACO.y + BURACO.ry - 1.5) * k, CANALETA.meia * k, hh + 2 * k, CANALETA.meia * k), laje)
  const fundoDaCanaleta: MaterialDaPeca = { classe: 'liso', rgb: misturar(pedra.rgb, ESCURO, CANALETA.escuro) }
  L.push(P(canaleta, fundoDaCanaleta, { tabua: 0, bisel: 0, contorno: 0.2, textura: texDoBuraco(canaleta, CANALETA.meia * k, k, CANALETA.parede), semente: 26122 }))
  const fundo: MaterialDaPeca = { classe: 'liso', rgb: misturar(pedra.rgb, ESCURO, 0.58) }
  L.push(P(buraco, fundo, { tabua: 0, bisel: 0, contorno: 0.3, textura: texDoBuraco(buraco, PAREDE * k, k, 1), semente: 26121 }))
}
