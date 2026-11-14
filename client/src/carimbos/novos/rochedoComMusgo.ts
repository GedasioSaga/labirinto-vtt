import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'
import { caminhoDaRocha, facesDaRocha, meioDaFace, paletaDaRocha, pintarRocha, type FaceDaRocha, type FormaDaRocha, type TonsDaRocha } from './_rochaFacetada'

/**
 * Rochedo grande com musgo (item 147 dos carimbos de 14/11/2026): um matacão
 * só, bem maior que as pedras da serra, de granito cinza-esverdeado (frio, ao
 * lado do bege quente das pedras), redondo de bojo largo (três andares de
 * facetas, no desenho de `_rochaFacetada.ts`), com uma capa de musgo no alto
 * que escorre por um lado, às vezes uma pedra menor encostada e tufos de
 * capim no pé. O giro gira as facetas, o lado do musgo que escorre e o da
 * pedra menor; a luz não gira.
 */

const ROCHA: TonsDaRocha = { escura: [94, 98, 94], meia: [136, 138, 128], clara: [182, 180, 166] }
/** O matacão tem lado em pé: a luz das faces sobe um tanto para o ombro da esquerda chegar ao claro. */
const CLAREIA = 0.24
const MUSGO_ESCURO: Rgb = [62, 96, 56]
const MUSGO: Rgb = [92, 128, 66]
const MUSGO_CLARO: Rgb = [136, 162, 92]
const CAPIM_CLARO: Rgb = [110, 150, 86]
const CAPIM_ESCURO: Rgb = [62, 104, 66]

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

type Elipse = readonly [number, number, number, number]

function elipses(g: CanvasRenderingContext2D, lista: readonly Elipse[], cor: Rgb): void {
  g.fillStyle = css(cor)
  g.beginPath()
  for (const [x, y, rx, ry] of lista) {
    g.moveTo(x + rx, y)
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  }
  g.fill()
}

/** A capa de musgo: manchas achatadas como o topo, em volta do meio dele, e um rastro que escorre por um lado. */
function manchasDoMusgo(faces: readonly FaceDaRocha[], raio: number, giro: number, semente: number): Elipse[] {
  const topo = faces.find((f) => f.tipo === 'topo')
  const [tx, ty] = topo === undefined ? meioDaFace(faces[faces.length - 1]) : meioDaFace(topo)
  const r = raio * 0.5
  const lista: Elipse[] = [[tx, ty + r * 0.08, r * 1.3, r * 0.82]]
  for (let k = 0; k < 5; k++) {
    const a = giro + (k * Math.PI * 2) / 5 + (sorteio(semente, 100 + k) - 0.5) * 0.8
    const d = r * (1.05 + 0.25 * sorteio(semente, 110 + k))
    const rm = r * (0.42 + 0.22 * sorteio(semente, 120 + k))
    lista.push([tx + Math.cos(a) * d, ty + Math.sin(a) * d * 0.62, rm, rm * 0.66])
  }
  // O rastro que escorre: pelo lado da esquerda ou pelo de trás à direita, descendo a encosta.
  const lado = Math.cos(giro * 0.5 + sorteio(semente, 130) * 3) >= 0 ? -1 : 1
  for (let k = 1; k <= 3; k++) {
    const rm = r * (0.62 - k * 0.12)
    lista.push([tx + lado * r * (0.9 + k * 0.42), ty + r * (0.2 + k * 0.55), rm, rm * 0.8])
  }
  return lista
}

function encolher(lista: readonly Elipse[], f: number, dx: number, dy: number): Elipse[] {
  return lista.map(([x, y, rx, ry]) => [x + dx, y + dy, rx * f, ry * f] as const)
}

function pintarMusgo(g: CanvasRenderingContext2D, faces: readonly FaceDaRocha[], raio: number, giro: number, semente: number, quanto: number): void {
  const manchas = manchasDoMusgo(faces, raio, giro, semente).map(([x, y, rx, ry]): Elipse => [x, y, rx * quanto, ry * quanto])
  g.save()
  caminhoDaRocha(g, faces)
  g.clip()
  elipses(g, manchas, MUSGO_ESCURO)
  elipses(g, encolher(manchas, 0.78, -raio * 0.035, -raio * 0.045), MUSGO)
  // O claro do musgo: manchinhas soltas nas manchas de cima à esquerda (as que pegam a luz); uma grande só virava tampa.
  const [mx, my] = manchas[0]
  const claras = manchas.slice(1).filter(([x, y]) => x - mx + (y - my) * 1.2 < 0.02)
  elipses(g, [...encolher(claras, 0.42, -raio * 0.06, -raio * 0.06), [mx - raio * 0.16, my - raio * 0.1, raio * 0.2, raio * 0.12]], MUSGO_CLARO)
  g.restore()
}

/** Tufos de capim no pé: folhas curtas em leque, as da esquerda claras, as da direita escuras. */
function pintarCapim(g: CanvasRenderingContext2D, pes: ReadonlyArray<readonly [number, number]>, semente: number): void {
  g.lineCap = 'round'
  g.lineWidth = 0.028
  for (const [cor, de, ate] of [
    [CAPIM_ESCURO, 2, 5],
    [CAPIM_CLARO, 0, 3],
  ] as const) {
    g.strokeStyle = css(cor)
    g.beginPath()
    pes.forEach(([x, y], t) => {
      for (let k = de; k < ate; k++) {
        const abre = (k - 2) * 0.05 + (sorteio(semente, 150 + t * 7 + k) - 0.5) * 0.03
        const alto = 0.07 + 0.05 * sorteio(semente, 160 + t * 7 + k)
        g.moveTo(x + (k - 2) * 0.012, y)
        g.quadraticCurveTo(x + abre * 0.4, y - alto * 0.7, x + abre, y - alto)
      }
    })
    g.stroke()
  }
}

function desenharRochedo(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const comPedra = sorteio(semente, 1) >= 0.25
  // A pedra menor fica sempre de lado (na frente do rochedo ela o escondia); o rochedo chega para o outro.
  const lado = Math.cos(giro + 0.6) >= 0 ? 1 : -1
  const fundoDaPedra = Math.sin(giro * 1.3 + 0.4) * 0.07
  const rochedo: FormaDaRocha = {
    cx: comPedra ? -lado * 0.07 : 0,
    cy: -0.07,
    raio: 0.36 * (0.95 + 0.1 * sorteio(semente, 2)),
    altura: 0.42 * (0.92 + 0.16 * sorteio(semente, 3)),
    lados: 8,
    // Cinco anéis em domo: o bojo baixo e a encosta de cima deitada (com três, o meio era um barril de lado reto).
    aneis: [
      [0, 0.86],
      [0.26, 1],
      [0.6, 0.92],
      [0.86, 0.64],
      [1, 0.3],
    ],
    recuo: 0.08,
    aspereza: 0.24,
    picos: 0.2,
    giro,
    semente,
  }
  const pedra: FormaDaRocha = {
    cx: lado * (0.44 + 0.05 * sorteio(semente, 4)),
    cy: -0.03 + fundoDaPedra,
    raio: 0.15,
    altura: 0.15 + 0.04 * sorteio(semente, 5),
    lados: 6,
    aneis: [
      [0, 0.9],
      [0.5, 1],
      [1, 0.55],
    ],
    recuo: 0.1,
    aspereza: 0.3,
    picos: 0.3,
    giro: giro * 1.7 + 1,
    semente: semente + 9,
  }
  const facesDoRochedo = facesDaRocha(rochedo)
  const facesDaPedra = comPedra ? facesDaRocha(pedra) : []
  const pedraAtras = comPedra && pedra.cy < rochedo.cy
  if (pedraAtras) {
    pintarRocha(g, facesDaPedra, ROCHA, CLAREIA)
    pintarMusgo(g, facesDaPedra, pedra.raio, giro + 2, semente + 5, 0.75)
  }
  pintarRocha(g, facesDoRochedo, ROCHA, CLAREIA)
  pintarMusgo(g, facesDoRochedo, rochedo.raio, giro, semente, 1)
  if (comPedra && !pedraAtras) {
    pintarRocha(g, facesDaPedra, ROCHA, CLAREIA)
    pintarMusgo(g, facesDaPedra, pedra.raio, giro + 2, semente + 5, 0.75)
  }
  // Os tufos no pé da frente: um em cada canto do rochedo, do lado oposto ao da pedra menor e na frente.
  const pe = rochedo.raio * 0.86
  pintarCapim(
    g,
    [
      [rochedo.cx - lado * pe * 0.85, rochedo.cy + pe * 0.3],
      [rochedo.cx + lado * pe * 0.2, rochedo.cy + pe * 0.55],
    ],
    semente,
  )
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'rochedo-com-musgo',
  nome: 'Rochedo com musgo',
  tamanho: 14,
  sombra: 'baixa',
  desenhar: desenharRochedo,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [...paletaDaRocha(ROCHA), MUSGO_ESCURO, MUSGO, MUSGO_CLARO, CAPIM_CLARO, CAPIM_ESCURO]
