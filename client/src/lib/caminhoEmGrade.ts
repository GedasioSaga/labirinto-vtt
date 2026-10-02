import type { Point } from '../pixi/world'
import type { MapData, Wall } from '../types/map'
import { isTokenPathClear, wallBlocksToken } from './collision'

/**
 * CAMINHO EM GRADE — por onde a ficha que anda sozinha (a patrulha) vai de um
 * lugar a outro quando a reta não passa. `findTokenPath` só resolve a reta ou
 * a reta por UMA porta; com uma parede sem porta no meio, a ficha ia de uma
 * vez. Aqui é A* sobre os centros das casas do mapa: 8 vizinhos, cada aresta
 * valendo só se o traço reto passa pela mesma regra do arrasto
 * (`isTokenPathClear`: porta aberta passa; fechada, trancada ou secreta barra),
 * e a diagonal só com os dois lados retos livres — não corta quina de parede.
 *
 * O início e o fim são a posição real da ficha e o ponto, ligados à casa
 * vizinha mais à mão que a reta alcança. No fim o caminho é alisado (puxando o
 * fio: de cada canto, vai direto ao canto mais longe que a reta alcança), para
 * a ficha não andar em zigue-zague de centro em centro.
 *
 * Puro: sem store, sem DOM.
 */

/** Teto de casas abertas numa busca: mapa grande sem saída responde `null` em vez de travar o editor. */
export const MAX_CASAS_NA_BUSCA = 20000

/**
 * Distância mínima, em fração da casa, entre o caminho e a PONTA de uma parede.
 * A regra do arrasto deixa raspar a ponta (até 1/4 de casa além dela); quem
 * anda sozinho não precisa: com folga a ficha dobra a quina por fora, em vez de
 * passar com o centro em cima do fim da parede. Menor que meia casa, para a
 * porta de uma casa de largura continuar passando pelo meio.
 */
const FOLGA_DA_QUINA = 0.3

function distanciaAoTraco(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const comprimento2 = dx * dx + dy * dy
  const t = comprimento2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / comprimento2))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

/** O traço passa longe (`folga` px ou mais) de toda ponta de parede que barra. */
function longeDasQuinas(a: Point, b: Point, paredes: readonly Wall[], folga: number): boolean {
  for (const w of paredes) {
    if (distanciaAoTraco({ x: w.x1, y: w.y1 }, a, b) < folga) return false
    if (distanciaAoTraco({ x: w.x2, y: w.y2 }, a, b) < folga) return false
  }
  return true
}

/** Os 8 vizinhos: retos primeiro (custo 1 casa), depois as diagonais (√2). */
const VIZINHOS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

/** Fila de prioridade mínima (heap binário) de nós por custo estimado. */
class FilaPorCusto {
  private readonly custos: number[] = []
  private readonly nos: number[] = []

  get vazia(): boolean {
    return this.nos.length === 0
  }

  pôr(no: number, custo: number): void {
    this.custos.push(custo)
    this.nos.push(no)
    let i = this.nos.length - 1
    while (i > 0) {
      const pai = (i - 1) >> 1
      if ((this.custos[pai] ?? 0) <= custo) break
      this.trocar(i, pai)
      i = pai
    }
  }

  tirar(): number | undefined {
    const topo = this.nos[0]
    const ultimoNo = this.nos.pop()
    const ultimoCusto = this.custos.pop()
    if (this.nos.length > 0 && ultimoNo !== undefined && ultimoCusto !== undefined) {
      this.nos[0] = ultimoNo
      this.custos[0] = ultimoCusto
      let i = 0
      for (;;) {
        const esq = 2 * i + 1
        const dir = esq + 1
        let menor = i
        if (esq < this.nos.length && (this.custos[esq] ?? 0) < (this.custos[menor] ?? 0)) menor = esq
        if (dir < this.nos.length && (this.custos[dir] ?? 0) < (this.custos[menor] ?? 0)) menor = dir
        if (menor === i) break
        this.trocar(i, menor)
        i = menor
      }
    }
    return topo
  }

  private trocar(a: number, b: number): void {
    const custo = this.custos[a] ?? 0
    this.custos[a] = this.custos[b] ?? 0
    this.custos[b] = custo
    const no = this.nos[a] ?? 0
    this.nos[a] = this.nos[b] ?? 0
    this.nos[b] = no
  }
}

/**
 * As paredes que barram, separadas por casa (com folga de meia casa em volta):
 * a aresta entre duas casas vizinhas só precisa olhar as paredes das casas que
 * o traço atravessa, não o mapa inteiro.
 */
function paredesPorCasa(barram: readonly Wall[], largura: number, altura: number, grid: number): Map<number, Wall[]> {
  const porCasa = new Map<number, Wall[]>()
  const folga = grid / 2
  for (const wall of barram) {
    const i0 = Math.max(0, Math.floor((Math.min(wall.x1, wall.x2) - folga) / grid))
    const i1 = Math.min(largura - 1, Math.floor((Math.max(wall.x1, wall.x2) + folga) / grid))
    const j0 = Math.max(0, Math.floor((Math.min(wall.y1, wall.y2) - folga) / grid))
    const j1 = Math.min(altura - 1, Math.floor((Math.max(wall.y1, wall.y2) + folga) / grid))
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const no = i + j * largura
        const lista = porCasa.get(no)
        if (lista === undefined) porCasa.set(no, [wall])
        else lista.push(wall)
      }
    }
  }
  return porCasa
}

/** O fio puxado: de cada canto, direto ao canto mais adiante que a reta alcança. */
function alisar(caminho: readonly Point[], passa: (a: Point, b: Point) => boolean): Point[] {
  const primeiro = caminho[0]
  if (primeiro === undefined) return []
  const alisado = [primeiro]
  let i = 0
  while (i < caminho.length - 1) {
    let j = i + 1
    const daqui = caminho[i]
    while (daqui !== undefined && j + 1 < caminho.length) {
      const adiante = caminho[j + 1]
      if (adiante === undefined || !passa(daqui, adiante)) break
      j += 1
    }
    const canto = caminho[j]
    if (canto !== undefined) alisado.push(canto)
    i = j
  }
  return alisado
}

/**
 * O caminho de `de` a `para` — `[de, ...cantos, para]`, cada trecho um traço
 * reto que a colisão deixa passar — ou `null` sem caminho (porta fechada,
 * sala sem saída) ou quando a busca passa de `limite` casas.
 */
export function acharCaminho(
  de: Point,
  para: Point,
  map: Pick<MapData, 'walls' | 'grid' | 'width' | 'height'>,
  limite: number = MAX_CASAS_NA_BUSCA,
): Point[] | null {
  if (de.x === para.x && de.y === para.y) return [{ x: de.x, y: de.y }]
  const { grid } = map
  const barram = map.walls.filter(wallBlocksToken)
  const passa = (a: Point, b: Point, paredes: readonly Wall[] = barram) => isTokenPathClear(a, b, paredes, grid)
  // Entre casas e no alisado, além de passar, longe das quinas. As pernas da
  // ficha à casa vizinha (e da casa ao ponto) usam só a regra do arrasto: a
  // ficha pode estar encostada na parede, e exigir folga ali a deixaria presa.
  const folga = grid * FOLGA_DA_QUINA
  const passaComFolga = (a: Point, b: Point, paredes: readonly Wall[] = barram) => passa(a, b, paredes) && longeDasQuinas(a, b, paredes, folga)
  if (passaComFolga(de, para)) return [{ x: de.x, y: de.y }, { x: para.x, y: para.y }]

  const largura = Math.max(1, Math.ceil(map.width))
  const altura = Math.max(1, Math.ceil(map.height))
  const fim = largura * altura
  const centro = (no: number): Point => ({ x: ((no % largura) + 0.5) * grid, y: (Math.floor(no / largura) + 0.5) * grid })
  const porCasa = paredesPorCasa(barram, largura, altura, grid)

  /** As casas em volta de `p` (a dele e as 8 vizinhas, presas ao mapa) que a reta de/até `p` alcança, com a distância. */
  const casasEmVolta = (p: Point): Map<number, number> => {
    const ci = Math.min(largura - 1, Math.max(0, Math.floor(p.x / grid)))
    const cj = Math.min(altura - 1, Math.max(0, Math.floor(p.y / grid)))
    const casas = new Map<number, number>()
    for (let dj = -1; dj <= 1; dj += 1) {
      for (let di = -1; di <= 1; di += 1) {
        const i = ci + di
        const j = cj + dj
        if (i < 0 || j < 0 || i >= largura || j >= altura) continue
        const c = centro(i + j * largura)
        if (passa(p, c)) casas.set(i + j * largura, Math.hypot(c.x - p.x, c.y - p.y))
      }
    }
    return casas
  }

  const arestas = new Map<number, boolean>()
  /** O traço entre os centros de `a` e `b`, olhando só as paredes das casas por onde ele passa. */
  const arestaPassa = (a: number, b: number): boolean => {
    const chave = a < b ? a * fim + b : b * fim + a
    const guardada = arestas.get(chave)
    if (guardada !== undefined) return guardada
    const ai = a % largura
    const aj = Math.floor(a / largura)
    const bi = b % largura
    const bj = Math.floor(b / largura)
    const paredes = new Set<Wall>()
    for (const no of [a, b, bi + aj * largura, ai + bj * largura]) for (const w of porCasa.get(no) ?? []) paredes.add(w)
    const resultado = passaComFolga(centro(a), centro(b), [...paredes])
    arestas.set(chave, resultado)
    return resultado
  }

  const inicio = casasEmVolta(de)
  const chegada = casasEmVolta(para)
  if (inicio.size === 0 || chegada.size === 0) return null

  const estimativa = (no: number): number => {
    if (no === fim) return 0
    const c = centro(no)
    return Math.hypot(para.x - c.x, para.y - c.y)
  }
  const custo = new Map<number, number>()
  const veioDe = new Map<number, number>()
  const fechados = new Set<number>()
  const fila = new FilaPorCusto()
  for (const [no, dist] of inicio) {
    custo.set(no, dist)
    fila.pôr(no, dist + estimativa(no))
  }

  let abertas = 0
  while (!fila.vazia) {
    const no = fila.tirar()
    if (no === undefined || fechados.has(no)) continue
    if (no === fim) break
    fechados.add(no)
    abertas += 1
    if (abertas > limite) return null
    const g = custo.get(no) ?? Number.POSITIVE_INFINITY
    // A última perna, da casa ao ponto: um nó a mais, o "fim".
    const perna = chegada.get(no)
    if (perna !== undefined && g + perna < (custo.get(fim) ?? Number.POSITIVE_INFINITY)) {
      custo.set(fim, g + perna)
      veioDe.set(fim, no)
      fila.pôr(fim, g + perna)
    }
    const i = no % largura
    const j = Math.floor(no / largura)
    for (const [di, dj] of VIZINHOS) {
      const ni = i + di
      const nj = j + dj
      if (ni < 0 || nj < 0 || ni >= largura || nj >= altura) continue
      const vizinho = ni + nj * largura
      if (fechados.has(vizinho)) continue
      // Diagonal só com os dois lados retos livres: não corta quina de parede.
      if (di !== 0 && dj !== 0 && (!arestaPassa(no, ni + j * largura) || !arestaPassa(no, i + nj * largura))) continue
      if (!arestaPassa(no, vizinho)) continue
      const novo = g + Math.hypot(di, dj) * grid
      if (novo >= (custo.get(vizinho) ?? Number.POSITIVE_INFINITY)) continue
      custo.set(vizinho, novo)
      veioDe.set(vizinho, no)
      fila.pôr(vizinho, novo + estimativa(vizinho))
    }
  }
  if (!veioDe.has(fim)) return null

  const cantos: Point[] = []
  for (let no = veioDe.get(fim); no !== undefined; no = veioDe.get(no)) cantos.push(centro(no))
  cantos.reverse()
  return alisar([{ x: de.x, y: de.y }, ...cantos, { x: para.x, y: para.y }], (a, b) => passaComFolga(a, b))
}
