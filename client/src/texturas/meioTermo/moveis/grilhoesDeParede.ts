/**
 * GRILHÕES DE PAREDE de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"; a versão de
 * parede da corrente). A PAREDE é a beira de cima da pegada (giro 0), como na tocha de parede: ali ficam as duas
 * CHAPAS chumbadas, cada uma com dois parafusos e o olhal de onde pende uma ARGOLA; de cada argola desce uma
 * CORRENTE curta até o chão, e na ponta dela fica a ALGEMA aberta, as duas metades separadas na dobradiça e o fecho
 * com o furo do pino. No chão, junto da parede, a mancha de ferrugem de onde a corrente roça. Os dois conjuntos não
 * são iguais (a corrente da direita é mais curta e a algema abre para o outro lado): um par de verdade, usado.
 * Desenho original: só a ideia do objeto de masmorra.
 *
 * Não é a corrente de chão (`corrente.ts`: a placa no piso, a corrente longa, o cadeado e a chave): aqui o ferro
 * sai da parede e as correntes são curtas. Os elos são os da corrente (`elosAoLongo`, `texDoElo`): um deitado, o
 * seguinte em pé. Rente ao chão como a corrente: na 3/4 (`alturaSolta` de 0,03 casa) tudo sobe um fio e fica como de
 * cima. Sem material escolhido: o ferro e a ferrugem são fixos.
 *
 * Também exporta a algema aberta (`algemaAberta`, `montarAlgema`) e o giro de uma forma (`girar`), que a bola de ferro
 * com corrente usa na tornozeleira.
 */
import { anel, caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type CriarPeca, type MaterialDaPeca, type Peca } from './motor'
import { G, type MontarMovel } from './contexto'
import { elosAoLongo, texDoElo } from './corrente'
import { ESCURO_DO_FERRO, FERRO_DA_PRISAO, rebite, texFerroGasto } from './cadeiraDeFerro'

/** O furo do pino no fecho da algema. */
const FURO: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x2a, 0x27] }
/** A mancha de ferrugem no chão junto da parede (apagada, meio transparente). */
const MANCHA_DE_FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x52, 0x40] }

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

/** A algema aberta: as duas metades (a presa e a que abriu), os dois lados do fecho, a dobradiça e o ponto da corrente. */
export interface AlgemaAberta {
  readonly metades: readonly [Forma, Forma]
  readonly fechos: readonly [Ponto, Ponto]
  readonly dobradica: Ponto
  readonly saida: Ponto
}

/**
 * A algema de meio `(cx, cy)`, raio `r` e aro de `arame` px, com a DOBRADIÇA no rumo `rumo` (de onde sai a corrente)
 * e o fecho do lado oposto: a metade de um lado fica; a outra gira `abertura` radianos em volta da dobradiça.
 */
export function algemaAberta(cx: number, cy: number, r: number, arame: number, rumo: number, abertura: number): AlgemaAberta {
  const aro = anel(cx, cy, r, r, r - arame, r - arame)
  const meio = r - arame / 2
  const dobradica: Ponto = [cx + Math.cos(rumo) * meio, cy + Math.sin(rumo) * meio]
  const presa = dentroDe(aro, semiplano(cx, cy, rumo, 1, r * 1.5))
  const aberta = girar(dentroDe(aro, semiplano(cx, cy, rumo, -1, r * 1.5)), dobradica[0], dobradica[1], abertura)
  const fecho: Ponto = [cx - Math.cos(rumo) * meio, cy - Math.sin(rumo) * meio]
  return {
    metades: [presa, aberta],
    fechos: [fecho, girarPonto(fecho, dobradica[0], dobradica[1], abertura)],
    dobradica,
    saida: [cx + Math.cos(rumo) * (r + arame * 0.4), cy + Math.sin(rumo) * (r + arame * 0.4)],
  }
}

/** Põe a algema na cena: as duas metades, a orelha de cada lado do fecho com o furo do pino e a junta da dobradiça. */
export function montarAlgema(P: CriarPeca, L: Peca[], sombra: (f: Forma, forca: number) => void, a: AlgemaAberta, arame: number, semente: number): void {
  const [presa, aberta] = a.metades
  const orelhas = a.fechos.map(([x, y]) => elipse(x, y, arame * 0.95, arame * 0.95))
  sombra(uniao(uniao(presa, aberta), uniao(orelhas[0], orelhas[1])), 0.32)
  L.push(P(presa, FERRO_DA_PRISAO, { tabua: 0, bisel: arame * 0.55, tom: 0.96, metal: 0.42, contorno: 0.3, textura: texFerroGasto(presa, 0, 0.34), semente }))
  L.push(P(aberta, FERRO_DA_PRISAO, { tabua: 0, bisel: arame * 0.55, tom: 1.04, metal: 0.42, contorno: 0.3, textura: texFerroGasto(aberta, 0, 0.3), semente: semente + 1 }))
  orelhas.forEach((orelha, i) => {
    L.push(P(orelha, FERRO_DA_PRISAO, { tabua: 0, bisel: arame * 0.6, tom: 1.08, metal: 0.42, contorno: 0.28, semente: semente + 2 + i }))
    const [x, y] = a.fechos[i]
    L.push(P(elipse(x, y, arame * 0.34, arame * 0.34), FURO, { tabua: 0, bisel: 0, contorno: 0, semente: semente + 4 + i }))
  })
  const [hx, hy] = a.dobradica
  L.push(P(elipse(hx, hy, arame * 0.85, arame * 0.85), FERRO_DA_PRISAO, { tabua: 0, bisel: arame * 0.7, tom: 1.2, metal: 0.5, contorno: 0.28, semente: semente + 6 }))
}

// ---------- os grilhões ----------

/** A pegada de partida, em px do protótipo: 1 casa ao longo da parede, meia de fundo. As medidas são desta pegada. */
const MEIA_FRENTE = 0.5 * G
const MEIO_FUNDO = 0.25 * G
/** A chapa (meia largura e fundo), o olhal (do pé à ponta) e a argola (raios de fora e de dentro), em px de partida. */
const CHAPA = { meia: 3.6, fundo: 2.8 } as const
const OLHAL = { de: 2.3, ate: 4.7, raio: 0.75 } as const
const ARGOLA = { y: 6.6, rx: 2.9, ry: 2.15, rxD: 1.7, ryD: 1.05 } as const
/** O passo dos elos, o raio e o aro da algema (px de partida). */
const PASSO_DOS_ELOS = 3.1
const RAIO_DA_ALGEMA = 3.5
const ARAME_DA_ALGEMA = 1.25

interface Conjunto {
  /** O meio da chapa ao longo da parede. */
  readonly x: number
  /** O caminho da corrente, da argola até antes da algema (a ponta é a dobradiça dela). */
  readonly caminho: readonly Ponto[]
  readonly algema: { readonly cx: number; readonly cy: number; readonly rumo: number; readonly abertura: number }
}

/** Os dois conjuntos, em px da pegada de partida (o meio da pegada na origem, a parede em y = -14). */
const CONJUNTOS: readonly Conjunto[] = [
  { x: -13, caminho: [[-13.1, -5.6], [-14.7, -1.7], [-17.5, 1.5]], algema: { cx: -21.2, cy: 7.3, rumo: -1.12, abertura: 0.95 } },
  { x: 12.6, caminho: [[12.7, -5.6], [13.8, -2], [16.3, 1]], algema: { cx: 21.5, cy: 5.6, rumo: -2.45, abertura: -0.9 } },
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
    // A mancha de ferrugem no chão, junto da parede, onde a corrente roça.
    L.push(P(elipse(x - 0.8 * k, -hh + 6.2 * k, 4.6 * k, 2.6 * k), MANCHA_DE_FERRUGEM, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.2, suave: 2.2 * k, semente: s }))
    // A CHAPA chumbada na parede, os dois parafusos e o olhal.
    const chapa = caixa(x - CHAPA.meia * k, -hh, x + CHAPA.meia * k, -hh + CHAPA.fundo * k, 0.7 * k)
    sombra(chapa, 0.3)
    L.push(P(chapa, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.8 * k, tom: 0.9, metal: 0.34, contorno: 0.28, textura: texFerroGasto(chapa, 1), semente: s + 1 }))
    for (const lado of [-1, 1]) L.push(rebite(P, x + lado * 2.3 * k, -hh + 1.35 * k, 0.72 * k, s + 2 + lado))
    const olhal = capsula(x, -hh + OLHAL.de * k, x, -hh + OLHAL.ate * k, OLHAL.raio * k)
    sombra(olhal, 0.3)
    L.push(P(olhal, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.6 * k, tom: 1.02, metal: 0.42, contorno: 0.28, semente: s + 5 }))

    // A ARGOLA que pende do olhal (vista de cima e um pouco de frente: achatada).
    const yArgola = -hh + ARGOLA.y * k
    const argola = anel(x, yArgola, ARGOLA.rx * k, ARGOLA.ry * k, ARGOLA.rxD * k, ARGOLA.ryD * k)
    sombra(argola, 0.32)
    L.push(P(argola, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.6 * k, tom: 1.06, metal: 0.45, contorno: 0.3, textura: texFerroGasto(argola, 0, 0.3), semente: s + 6 }))

    // A ALGEMA aberta e a CORRENTE curta da argola até a dobradiça dela: os deitados por baixo, os em pé por cima.
    const [acx, acy] = em([cj.algema.cx, cj.algema.cy])
    const algema = algemaAberta(acx, acy, RAIO_DA_ALGEMA * k, ARAME_DA_ALGEMA * k, cj.algema.rumo, cj.algema.abertura)
    const elos = elosAoLongo([[x, yArgola + ARGOLA.ryD * k], ...cj.caminho.map(em), algema.saida], PASSO_DOS_ELOS * k, false)
    montarAlgema(P, L, sombra, algema, ARAME_DA_ALGEMA * k, s + 10)
    elos.filter((e) => e.deitado).forEach((e, i) => {
      sombra(e.forma, 0.3)
      L.push(P(e.forma, FERRO_DA_PRISAO, { tabua: 0, bisel: e.meio * 0.12, tom: 0.98, metal: 0.45, contorno: 0.3, textura: texDoElo(e, 0.8), semente: s + 30 + i }))
    })
    elos.filter((e) => !e.deitado).forEach((e, i) => {
      sombra(e.forma, 0.34)
      L.push(P(e.forma, FERRO_DA_PRISAO, { tabua: 0, bisel: e.meio * 0.17, tom: 1.08, metal: 0.5, contorno: 0.3, textura: texDoElo(e, 0.65), semente: s + 60 + i }))
    })
  })
}
