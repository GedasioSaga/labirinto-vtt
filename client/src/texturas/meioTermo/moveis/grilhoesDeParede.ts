/**
 * GRILHÕES DE PAREDE de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"; a versão de
 * parede da corrente). A PAREDE é a beira de cima da pegada (giro 0), como na tocha de parede: ali ficam as duas
 * CHAPAS retangulares chumbadas, cada uma com dois parafusos e o olhal de onde pende uma ARGOLA; de cada argola desce
 * uma CORRENTE curta até o chão, e na ponta dela fica a ALGEMA aberta: uma BRAÇADEIRA CHATA de ferro (a faixa larga,
 * com a beira de fora clara e a de dentro escura), as duas metades separadas na DOBRADIÇA, a LINGUETA do fecho na
 * metade solta e o encaixe dela na presa. No chão, debaixo da corrente, a mancha de ferrugem de onde ela roça. Os dois
 * conjuntos não são iguais (a corrente da direita é mais curta e a algema abre para o outro lado): um par de verdade,
 * usado. Desenho original: só a ideia do objeto de masmorra.
 *
 * Tudo cerca de 1,5x o primeiro desenho, para o conjunto encher a pegada: no tamanho de mesa sobravam quatro rabiscos
 * finos, a algema de arame em C lia como gancho e a chapa em T, como prego.
 *
 * Não é a corrente de chão (`corrente.ts`: a placa no piso, a corrente longa, o cadeado e a chave): aqui o ferro
 * sai da parede e as correntes são curtas. Os elos são os da corrente (`elosAoLongo`, `texDoElo`): um deitado, o
 * seguinte em pé. Rente ao chão como a corrente: na 3/4 (`alturaSolta` de 0,03 casa) tudo sobe um fio e fica como de
 * cima. Sem material escolhido: o ferro e a ferrugem são fixos.
 *
 * Também exporta a algema aberta (`algemaAberta`, `montarAlgema`) e o giro de uma forma (`girar`), que a bola de ferro
 * com corrente usa na tornozeleira e o catre no cobertor.
 */
import { anel, barra, caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type CriarPeca, type MaterialDaPeca, type Peca } from './motor'
import { G, type MontarMovel } from './contexto'
import { elosAoLongo, texDoElo } from './corrente'
import { ESCURO_DO_FERRO, FERRO_DA_PRISAO, rebite, texFerroGasto } from './cadeiraDeFerro'

/** O furo do pino no fecho da algema. */
const FURO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2a, 0x27] }
/** A mancha de ferrugem no chão debaixo da corrente (apagada, meio transparente). */
const MANCHA_DE_FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x52, 0x40] }
const ALFA_DA_MANCHA = 0.42
/** A beira da faixa da algema: a fração da largura que a de fora (clara) e a de dentro (escura) ocupam. */
const FRACAO_DA_BEIRA = 0.24

// ---------- o giro de uma forma e a algema aberta ----------

/** O ponto (x, y) girado `a` em volta de (px, py). */
function girarPonto([x, y]: Ponto, px: number, py: number, a: number): Ponto {
  const co = Math.cos(a)
  const si = Math.sin(a)
  return [px + (x - px) * co - (y - py) * si, py + (x - px) * si + (y - py) * co]
}

/** A forma girada `a` em volta de (px, py): a caixa nova é a que cobre os quatro cantos da caixa velha girados. */
export function girar(f: Forma, px: number, py: number, a: number): Forma {
  const co = Math.cos(a)
  const si = Math.sin(a)
  const cantos = ([[f.b[0], f.b[1]], [f.b[2], f.b[1]], [f.b[2], f.b[3]], [f.b[0], f.b[3]]] as const).map((p) => girarPonto(p, px, py, a))
  const xs = cantos.map((p) => p[0])
  const ys = cantos.map((p) => p[1])
  return {
    b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    d: (x, y) => f.d(px + (x - px) * co + (y - py) * si, py - (x - px) * si + (y - py) * co),
  }
}

/** O semiplano do lado `lado` (1 ou -1) da reta que passa por (cx, cy) no ângulo `a`, até `alcance` px dela. */
function semiplano(cx: number, cy: number, a: number, lado: number, alcance: number): Forma {
  const [dx, dy] = [Math.cos(a) * alcance, Math.sin(a) * alcance]
  const [nx, ny] = [-Math.sin(a) * alcance * lado, Math.cos(a) * alcance * lado]
  return poligono([[cx - dx, cy - dy], [cx + dx, cy + dy], [cx + dx + nx, cy + dy + ny], [cx - dx + nx, cy - dy + ny]])
}

/**
 * A algema aberta, uma braçadeira chata: as duas metades da faixa (a presa e a que abriu), a beira de fora e a de
 * dentro de cada uma, o encaixe do fecho na ponta da presa e a lingueta na ponta da solta (com os furos do pino), a
 * dobradiça e o ponto de onde sai a corrente.
 */
export interface AlgemaAberta {
  readonly metades: readonly [Forma, Forma]
  readonly beirasDeFora: readonly [Forma, Forma]
  readonly beirasDeDentro: readonly [Forma, Forma]
  readonly encaixe: Forma
  readonly lingueta: Forma
  readonly furos: readonly [Ponto, Ponto]
  readonly dobradica: Ponto
  /** O rumo da dobradiça a partir do meio da algema (o lado de onde sai a corrente). */
  readonly rumo: number
  readonly saida: Ponto
}

/**
 * A algema de meio `(cx, cy)`, raio de fora `r` e faixa de `faixa` px, com a DOBRADIÇA no rumo `rumo` (de onde sai a
 * corrente) e o fecho do lado oposto: a metade de um lado fica; a outra gira `abertura` radianos em volta da dobradiça.
 */
export function algemaAberta(cx: number, cy: number, r: number, faixa: number, rumo: number, abertura: number): AlgemaAberta {
  const dentro = r - faixa
  const beira = faixa * FRACAO_DA_BEIRA
  const meio = r - faixa / 2
  const [co, si] = [Math.cos(rumo), Math.sin(rumo)]
  const dobradica: Ponto = [cx + co * meio, cy + si * meio]
  const abrir = (f: Forma): Forma => girar(f, dobradica[0], dobradica[1], abertura)
  const metades = (f: Forma): readonly [Forma, Forma] => [
    dentroDe(f, semiplano(cx, cy, rumo, 1, r * 1.5)),
    abrir(dentroDe(f, semiplano(cx, cy, rumo, -1, r * 1.5))),
  ]
  // O fecho fica do lado oposto à dobradiça; (nx, ny) aponta para o lado da metade presa.
  const fecho: Ponto = [cx - co * meio, cy - si * meio]
  const [nx, ny] = [-si, co]
  // O encaixe: o bloco na ponta da presa, um pouco mais largo que a faixa, deitado ao longo do raio.
  const [ex, ey] = [fecho[0] + nx * faixa * 0.42, fecho[1] + ny * faixa * 0.42]
  const encaixe = barra(ex - co * faixa * 0.66, ey - si * faixa * 0.66, ex + co * faixa * 0.66, ey + si * faixa * 0.66, faixa * 0.9)
  // A lingueta: a língua estreita que sai da ponta da metade solta para o lado da presa (onde entraria no encaixe).
  const [lx, ly] = [fecho[0] - nx * faixa * 0.15, fecho[1] - ny * faixa * 0.15]
  const lingueta = abrir(barra(lx, ly, lx + nx * faixa * 1.05, ly + ny * faixa * 1.05, faixa * 0.52))
  const furoDaLingueta = girarPonto([lx + nx * faixa * 0.62, ly + ny * faixa * 0.62], dobradica[0], dobradica[1], abertura)
  return {
    metades: metades(anel(cx, cy, r, r, dentro, dentro)),
    beirasDeFora: metades(anel(cx, cy, r, r, r - beira, r - beira)),
    beirasDeDentro: metades(anel(cx, cy, dentro + beira, dentro + beira, dentro, dentro)),
    encaixe,
    lingueta,
    furos: [[ex, ey], furoDaLingueta],
    dobradica,
    rumo,
    saida: [cx + co * (r + faixa * 0.3), cy + si * (r + faixa * 0.3)],
  }
}

/**
 * Põe a algema na cena: cada metade como faixa chata (pouco chanfro), com a beira de fora pegando a luz e a de dentro
 * na sombra; o encaixe com o furo, a lingueta com o dela e, por cima, a dobradiça (a chapinha e o pino).
 */
export function montarAlgema(P: CriarPeca, L: Peca[], sombra: (f: Forma, forca: number) => void, a: AlgemaAberta, faixa: number, semente: number): void {
  const [presa, aberta] = a.metades
  sombra(uniao(uniao(presa, aberta), uniao(a.encaixe, a.lingueta)), 0.34)
  const metade = (i: 0 | 1, tom: number): void => {
    const f = a.metades[i]
    L.push(P(f, FERRO_DA_PRISAO, { tabua: 0, bisel: faixa * 0.16, tom, metal: 0.4, contorno: 0.3, textura: texFerroGasto(f, 0, 0.3), semente: semente + i }))
    L.push(P(a.beirasDeFora[i], FERRO_DA_PRISAO, { tabua: 0, bisel: 0, tom: tom * 1.3, metal: 0.5, contorno: 0, alfa: 0.7, semente: semente + 2 + i }))
    L.push(P(a.beirasDeDentro[i], FERRO_DA_PRISAO, { tabua: 0, bisel: 0, tom: tom * 0.5, contorno: 0, alfa: 0.8, semente: semente + 4 + i }))
  }
  metade(0, 0.92)
  L.push(P(a.encaixe, FERRO_DA_PRISAO, { tabua: 0, bisel: faixa * 0.22, tom: 1.02, metal: 0.42, contorno: 0.3, textura: texFerroGasto(a.encaixe, 0.8), semente: semente + 6 }))
  L.push(P(elipse(a.furos[0][0], a.furos[0][1], faixa * 0.16, faixa * 0.16), FURO, { tabua: 0, bisel: 0, contorno: 0, semente: semente + 7 }))
  metade(1, 1)
  L.push(P(a.lingueta, FERRO_DA_PRISAO, { tabua: 0, bisel: faixa * 0.14, tom: 1.06, metal: 0.42, contorno: 0.3, semente: semente + 8, projeta: { dist: faixa * 0.25, forca: 0.28 } }))
  L.push(P(elipse(a.furos[1][0], a.furos[1][1], faixa * 0.13, faixa * 0.13), FURO, { tabua: 0, bisel: 0, contorno: 0, semente: semente + 9 }))
  // A DOBRADIÇA: a chapinha atravessada na faixa e o pino, que pega a luz.
  const [hx, hy] = a.dobradica
  const [co, si] = [Math.cos(a.rumo), Math.sin(a.rumo)]
  const chapinha = capsula(hx - co * faixa * 0.55, hy - si * faixa * 0.55, hx + co * faixa * 0.55, hy + si * faixa * 0.55, faixa * 0.38)
  L.push(P(chapinha, FERRO_DA_PRISAO, { tabua: 0, bisel: faixa * 0.3, tom: 1.04, metal: 0.45, contorno: 0.3, semente: semente + 10, projeta: { dist: faixa * 0.22, forca: 0.3 } }))
  L.push(rebite(P, hx, hy, faixa * 0.2, semente + 11, 1.24))
}

// ---------- os grilhões ----------

/** A pegada de partida, em px do protótipo: 1 casa ao longo da parede, meia de fundo. As medidas são desta pegada. */
const MEIA_FRENTE = 0.5 * G
const MEIO_FUNDO = 0.25 * G
/**
 * A chapa retangular (meia largura e fundo) com os dois parafusos (afastamento e raio), o olhal (o meio, a partir da
 * parede, e os raios de fora e de dentro) e a argola (o meio, a partir da parede, e os raios), em px de partida.
 */
const CHAPA = { meia: 5, fundo: 3.8 } as const
const PARAFUSO = { afasta: 3.2, raio: 0.95 } as const
const OLHAL = { y: 4.2, rx: 1.55, ry: 1.15, rxD: 0.75, ryD: 0.5 } as const
const ARGOLA = { y: 7.7, rx: 3.9, ry: 2.7, rxD: 2.4, ryD: 1.45 } as const
/** O passo dos elos, o raio e a faixa da algema (px de partida). */
const PASSO_DOS_ELOS = 4.6
const RAIO_DA_ALGEMA = 5.25
const FAIXA_DA_ALGEMA = 2.2

interface Conjunto {
  /** O meio da chapa ao longo da parede. */
  readonly x: number
  /** O caminho da corrente, da argola até antes da algema (a ponta é a dobradiça dela). */
  readonly caminho: readonly Ponto[]
  readonly algema: { readonly cx: number; readonly cy: number; readonly rumo: number; readonly abertura: number }
}

/** Os dois conjuntos, em px da pegada de partida (o meio da pegada na origem, a parede em y = -14). */
const CONJUNTOS: readonly Conjunto[] = [
  { x: -13.4, caminho: [[-13.9, -2.4], [-15.3, 0.6]], algema: { cx: -20.4, cy: 7.6, rumo: -0.98, abertura: 1.2 } },
  { x: 13, caminho: [[13.5, -2.6], [14.9, -0.2]], algema: { cx: 20.6, cy: 6.4, rumo: -2.3, abertura: -1.15 } },
]

export const montarGrilhoesDeParede: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const sx = hw / MEIA_FRENTE
  const sy = hh / MEIO_FUNDO
  const k = Math.min(sx, sy)
  const em = ([x, y]: Ponto): Ponto => [x * sx, y * sy]
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const sombra = (f: Forma, forca: number): void => {
    cena.sombras.push(contato(f, forca))
  }

  CONJUNTOS.forEach((cj, n) => {
    const s = 24500 + n * 100
    const x = cj.x * sx
    const yArgola = -hh + ARGOLA.y * k
    const [acx, acy] = em([cj.algema.cx, cj.algema.cy])
    const algema = algemaAberta(acx, acy, RAIO_DA_ALGEMA * k, FAIXA_DA_ALGEMA * k, cj.algema.rumo, cj.algema.abertura)
    const caminho: Ponto[] = [[x, yArgola + ARGOLA.ryD * k], ...cj.caminho.map(em), algema.saida]

    // A mancha de ferrugem no chão, debaixo da corrente, onde ela roça.
    const [mx, my] = caminho[Math.floor(caminho.length / 2)]
    L.push(P(elipse(mx - 0.6 * k, my + 0.8 * k, 5.6 * k, 3.6 * k), MANCHA_DE_FERRUGEM, { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DA_MANCHA, suave: 1.8 * k, semente: s }))

    // A CHAPA retangular chumbada na parede, com os dois parafusos, e o olhal na beira dela.
    const chapa = caixa(x - CHAPA.meia * k, -hh, x + CHAPA.meia * k, -hh + CHAPA.fundo * k, 0.8 * k)
    sombra(chapa, 0.32)
    L.push(P(chapa, FERRO_DA_PRISAO, { dx: 0.3 * k, dy: 0.8 * k, tabua: 0, bisel: 0.5 * k, tom: 0.56, contorno: 0.3, semente: s + 1 }))
    L.push(P(chapa, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.9 * k, tom: 0.92, metal: 0.34, contorno: 0.28, textura: texFerroGasto(chapa, 1), semente: s + 2 }))
    for (const lado of [-1, 1]) L.push(rebite(P, x + lado * PARAFUSO.afasta * k, -hh + CHAPA.fundo * k * 0.46, PARAFUSO.raio * k, s + 3 + lado, 1.14))
    const olhal = anel(x, -hh + OLHAL.y * k, OLHAL.rx * k, OLHAL.ry * k, OLHAL.rxD * k, OLHAL.ryD * k)
    sombra(olhal, 0.3)
    L.push(P(olhal, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.5 * k, tom: 1.06, metal: 0.42, contorno: 0.3, semente: s + 5 }))

    // A ARGOLA que pende do olhal (vista de cima e um pouco de frente: achatada).
    const argola = anel(x, yArgola, ARGOLA.rx * k, ARGOLA.ry * k, ARGOLA.rxD * k, ARGOLA.ryD * k)
    sombra(argola, 0.34)
    L.push(P(argola, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.7 * k, tom: 1.04, metal: 0.45, contorno: 0.3, textura: texFerroGasto(argola, 0, 0.3), semente: s + 6, projeta: { dist: 0.8 * k, forca: 0.28 } }))

    // A ALGEMA aberta e a CORRENTE curta da argola até a dobradiça dela: os deitados por baixo, os em pé por cima.
    const elos = elosAoLongo(caminho, PASSO_DOS_ELOS * k, false)
    montarAlgema(P, L, sombra, algema, FAIXA_DA_ALGEMA * k, s + 10)
    elos.filter((e) => e.deitado).forEach((e, i) => {
      sombra(e.forma, 0.32)
      L.push(P(e.forma, FERRO_DA_PRISAO, { tabua: 0, bisel: e.meio * 0.12, tom: 0.98, metal: 0.45, contorno: 0.3, textura: texDoElo(e, 0.8), semente: s + 30 + i }))
    })
    elos.filter((e) => !e.deitado).forEach((e, i) => {
      sombra(e.forma, 0.36)
      L.push(P(e.forma, FERRO_DA_PRISAO, { tabua: 0, bisel: e.meio * 0.17, tom: 1.08, metal: 0.5, contorno: 0.3, textura: texDoElo(e, 0.65), semente: s + 60 + i }))
    })
  })
}
