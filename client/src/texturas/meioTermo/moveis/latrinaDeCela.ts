/**
 * LATRINA DE CELA de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"): o buraco de pedra
 * no chão da cela. Uma LAJE de pedra de beira lascada, assentada rente ao piso com um fio de beirada; nela, o BURACO em
 * fechadura (a boca redonda atrás e a fenda que corre para a frente), com a BORDA GASTA em volta, mais clara e lisa de
 * anos de uso, e a parede de dentro que pega luz do lado de baixo à direita enquanto o fundo some no escuro. Dos dois
 * lados da fenda, os PISANTES lavrados em sulcos, onde se põem os pés. Em volta do buraco, a pedra ÚMIDA, mais escura;
 * duas RACHADURAS finas na laje. Contida de propósito: nada além da umidade diz o que é. Desenho original.
 *
 * Mora no chão (`ehMovelDoChao`), como o tapete: só o contato, sem altura; na 3/4 (DERIVADO, sem estrutura que suba)
 * fica como de cima. A frente é o lado de baixo (a fenda corre para ela). Material: `pedra` (a laje, os pisantes e a
 * borda); a umidade e o fundo do buraco saem do tom dela.
 */
import { hash, limitar01, misturar, type Rgb } from '../../ruido'
import { caixa, capsula, cadeia, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** A latrina foi medida no tamanho de partida (1 casa, 28 px de meio lado): as medidas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 0.5 * G
/** A laje: quanto recua da pegada, o quanto cada quina foi lascada (de, até) e o quanto a beira entra (px). */
const RECUO_DA_LAJE = 1.4
const LASCA = { de: 1.4, ate: 3.6 } as const
const TORTO = 0.7
/** O buraco: a boca redonda (meio e raios) e a fenda para a frente (meia largura e onde acaba), px de partida. */
const BOCA = { y: -4.2, rx: 6.3, ry: 5.7 } as const
const FENDA = { meia: 2.2, ate: 8.6 } as const
/** A borda gasta em volta do buraco (px) e a parede de dentro que aparece. */
const BORDA = 2.6
const PAREDE = 2.6
/** Os pisantes: de onde a onde vão em x (a partir do meio) e em y, e quantos sulcos. */
const PISANTE = { de: 5.2, ate: 11.2, topo: 3.2, pe: 13.6, sulcos: 4 } as const
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
 * O buraco: a parede de dentro pega luz onde a beira olha para baixo à direita (a parede de lá fica de frente para a
 * luz) e fica na sombra do lado da luz; o fundo escurece com a profundidade.
 */
function texDoBuraco(buraco: Forma, k: number): Textura {
  const parede = PAREDE * k
  const e = 0.35
  return (_u, _v, x, y, _p, s) => {
    const t = -buraco.d(x, y)
    const nx = buraco.d(x + e, y) - buraco.d(x - e, y)
    const ny = buraco.d(x, y + e) - buraco.d(x, y - e)
    const virada = (0.79 * nx + 0.61 * ny) / (Math.hypot(nx, ny) || 1)
    const naParede = limitar01(1 - t / parede)
    s[3] += (Math.max(0, virada) * 0.46 - Math.max(0, -virada) * 0.16) * naParede - limitar01(t / (4.6 * k)) * 0.3
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

  // A UMIDADE em volta do buraco, mansa, mais funda para a frente (onde escorre).
  const umido: MaterialDaPeca = { classe: 'liso', rgb: misturar(pedra.rgb, UMIDO, 0.6) }
  L.push(P(uniao(elipse(0, BOCA.y * k, 12.5 * k, 11 * k), elipse(0, 6 * k, 8 * k, 9 * k)), umido, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 4 * k, semente: 26103 }))

  // As RACHADURAS finas: uma da quina de cima à direita, outra da beira da esquerda.
  const vao: MaterialDaPeca = { classe: 'liso', rgb: misturar(pedra.rgb, ESCURO, 0.7) }
  const rachaduras: readonly (readonly Ponto[])[] = [
    [[hw - 3.2 * k, -hh + 4.4 * k], [hw - 8.4 * k, -hh + 8.2 * k], [hw - 10.6 * k, -hh + 13.6 * k], [hw - 15.8 * k, -hh + 15.4 * k]],
    [[-hw + 1.8 * k, 4 * k], [-hw + 5.6 * k, 5.2 * k], [-hw + 8.2 * k, 8.8 * k]],
  ]
  rachaduras.forEach((r, i) => L.push(P(cadeia(r, 0.3 * k), vao, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.55, semente: 26104 + i })))

  // Os PISANTES lavrados: a pedra um pouco mais alta, de quina gasta, com os sulcos de través.
  for (const lado of [-1, 1]) {
    const [xa, xb] = [lado * PISANTE.de * k, lado * PISANTE.ate * k]
    const pisante = caixa(Math.min(xa, xb), PISANTE.topo * k, Math.max(xa, xb), PISANTE.pe * k, 1.2 * k)
    L.push(P(pisante, pedra, { tabua: 0, bisel: 1.1 * k, tom: 1.04, contorno: 0.24, textura: texGasta, semente: 26110 + lado, projeta: { dist: 0.8 * k, forca: 0.3, suave: 0.8 * k } }))
    for (let j = 0; j < PISANTE.sulcos; j += 1) {
      const y = (PISANTE.topo + 2.1 + ((PISANTE.pe - PISANTE.topo - 4.2) * j) / (PISANTE.sulcos - 1)) * k
      L.push(P(capsula(Math.min(xa, xb) + 1.3 * k, y, Math.max(xa, xb) - 1.3 * k, y, 0.38 * k), vao, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.42, semente: 26113 + j }))
    }
  }

  // A BORDA GASTA em volta do buraco e o BURACO em fechadura, com a parede de dentro e o fundo escuro.
  const buraco = uniao(elipse(0, BOCA.y * k, BOCA.rx * k, BOCA.ry * k), caixa(-FENDA.meia * k, BOCA.y * k, FENDA.meia * k, FENDA.ate * k, FENDA.meia * k))
  L.push(P(menos(crescida(buraco, BORDA * k), buraco), pedra, { tabua: 0, bisel: BORDA * k * 0.9, tom: 1.1, contorno: 0.12, textura: texGasta, semente: 26120 }))
  const fundo: MaterialDaPeca = { classe: 'liso', rgb: misturar(pedra.rgb, ESCURO, 0.58) }
  L.push(P(buraco, fundo, { tabua: 0, bisel: 0, contorno: 0.3, textura: texDoBuraco(buraco, k), semente: 26121 }))
}
