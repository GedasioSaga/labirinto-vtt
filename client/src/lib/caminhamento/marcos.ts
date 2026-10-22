import { avancarParedes, criarMalha, DIRECOES, type DijkstraDoMarco, type Malha, type MapaDoCaminho, malhaPronta, paredesProntas } from './malha'

/**
 * MARCOS — em rede grande, a busca estima o que falta pela desigualdade do
 * triângulo (ALT): com a distância de cada marco a todos os pontos, o caminho
 * de n até o fim é pelo menos |d(marco, fim) − d(marco, n)|. Num labirinto, a
 * reta até o destino engana (a sala sem saída "parece perto"); o marco não.
 * A estimativa nunca passa do real: o peso da busca (`PESO_DA_ESTIMATIVA`)
 * continua sendo o único afastamento do mais curto.
 *
 * As distâncias são da rede mais folgada que a busca usa (porta trancada
 * passa, sem custo de porta, nos dois sentidos): valem como piso para as três
 * rodadas. Ponto que nenhum marco alcança está em outra parte do mapa: a busca
 * já sabe, sem andar, que não chega.
 *
 * Os marcos saem um a um, cada um o ponto mais longe dos anteriores, e por
 * fatias (`avancarMarcos`).
 */

export const QUANTOS_MARCOS = 8
const RAIZ_DE_2 = Math.SQRT2

/** A aresta passa na rede folgada: sem parede (porta e tranca passam); diagonal com os dois retos sem parede. */
function passaFolgado(m: Malha, no: number, dir: number): boolean {
  const parede = m.parede[no] ?? 0xff
  if ((parede & (1 << dir)) !== 0) return false
  if (dir < 4) return true
  const passo = DIRECOES[dir] ?? [0, 0]
  const retos = (1 << (passo[0] > 0 ? 0 : 1)) | (1 << (passo[1] > 0 ? 2 : 3))
  return (parede & retos) === 0
}

function novoDijkstra(m: Malha, origem: number): DijkstraDoMarco {
  const total = m.nx * m.ny
  const dist = new Float32Array(total).fill(Number.POSITIVE_INFINITY)
  dist[origem] = 0
  return { origem, dist, fechado: new Uint8Array(total), heapNo: [origem], heapD: [0] }
}

function pôr(d: DijkstraDoMarco, no: number, custo: number): void {
  d.heapNo.push(no)
  d.heapD.push(custo)
  let i = d.heapNo.length - 1
  while (i > 0) {
    const pai = (i - 1) >> 1
    if ((d.heapD[pai] ?? 0) <= custo) break
    d.heapNo[i] = d.heapNo[pai] ?? 0
    d.heapD[i] = d.heapD[pai] ?? 0
    i = pai
  }
  d.heapNo[i] = no
  d.heapD[i] = custo
}

function tirar(d: DijkstraDoMarco): number {
  const topo = d.heapNo[0] ?? -1
  const ultimoNo = d.heapNo.pop()
  const ultimoD = d.heapD.pop()
  const n = d.heapNo.length
  if (n === 0 || ultimoNo === undefined || ultimoD === undefined) return topo
  let i = 0
  for (;;) {
    const esq = 2 * i + 1
    if (esq >= n) break
    const dir = esq + 1
    const menor = dir < n && (d.heapD[dir] ?? 0) < (d.heapD[esq] ?? 0) ? dir : esq
    if ((d.heapD[menor] ?? 0) >= ultimoD) break
    d.heapNo[i] = d.heapNo[menor] ?? 0
    d.heapD[i] = d.heapD[menor] ?? 0
    i = menor
  }
  d.heapNo[i] = ultimoNo
  d.heapD[i] = ultimoD
  return topo
}

/** Anda o Dijkstra até `orcamento` pontos; `true` quando terminou. */
function andarDijkstra(m: Malha, d: DijkstraDoMarco, orcamento: number): boolean {
  let feitos = 0
  while (d.heapNo.length > 0) {
    if (feitos >= orcamento) return false
    const no = tirar(d)
    if (no < 0 || d.fechado[no] === 1) continue
    d.fechado[no] = 1
    feitos += 1
    const g = d.dist[no] ?? 0
    const i = no % m.nx
    const j = (no - i) / m.nx
    for (let dir = 0; dir < 8; dir += 1) {
      const passo = DIRECOES[dir] ?? [0, 0]
      const ni = i + passo[0]
      const nj = j + passo[1]
      if (ni < 0 || nj < 0 || ni >= m.nx || nj >= m.ny) continue
      const outro = ni + nj * m.nx
      if (d.fechado[outro] === 1 || !passaFolgado(m, no, dir)) continue
      const novo = g + (dir < 4 ? m.grid : m.grid * RAIZ_DE_2)
      if (novo < (d.dist[outro] ?? Number.POSITIVE_INFINITY)) {
        d.dist[outro] = novo
        pôr(d, outro, novo)
      }
    }
  }
  return true
}

/** O primeiro ponto com alguma aresta: de onde sai o primeiro marco. */
function primeiraOrigem(m: Malha): number {
  for (let no = 0; no < m.nx * m.ny; no += 1) if ((m.parede[no] ?? 0xff) !== 0xff) return no
  return -1
}

/** O ponto mais longe de todos os marcos já feitos (só os que eles alcançam), ou -1. */
function maisLonge(menor: Float32Array): number {
  let melhor = -1
  let maior = 0
  for (let no = 0; no < menor.length; no += 1) {
    const d = menor[no] ?? Number.POSITIVE_INFINITY
    if (d !== Number.POSITIVE_INFINITY && d > maior) {
      maior = d
      melhor = no
    }
  }
  return melhor
}

/** Leva os marcos adiante por até `orcamento` pontos; `true` quando prontos (ou quando a rede não precisa). */
export function avancarMarcos(m: Malha, orcamento: number): boolean {
  const c = m.construcaoDosMarcos
  if (c === null) return true
  if (!paredesProntas(m)) return false
  if (c.atual === null) {
    const origem = c.feitos.length === 0 ? primeiraOrigem(m) : maisLonge(c.menor)
    if (origem < 0 || c.feitos.length >= QUANTOS_MARCOS) return juntarMarcos(m, c.feitos)
    c.atual = novoDijkstra(m, origem)
  }
  if (!andarDijkstra(m, c.atual, orcamento)) return false
  const { dist } = c.atual
  c.feitos.push(dist)
  for (let no = 0; no < dist.length; no += 1) c.menor[no] = Math.min(c.menor[no] ?? Number.POSITIVE_INFINITY, dist[no] ?? Number.POSITIVE_INFINITY)
  c.atual = null
  return c.feitos.length >= QUANTOS_MARCOS ? juntarMarcos(m, c.feitos) : false
}

/** As distâncias dos marcos, juntas por ponto, na malha; a montagem acaba. */
function juntarMarcos(m: Malha, feitos: readonly Float32Array[]): true {
  const total = m.nx * m.ny
  const k = feitos.length
  const juntos = new Float32Array(total * k)
  feitos.forEach((dist, marco) => {
    for (let no = 0; no < total; no += 1) juntos[no * k + marco] = dist[no] ?? Number.POSITIVE_INFINITY
  })
  m.marcos = juntos
  m.quantosMarcos = k
  m.construcaoDosMarcos = null
  return true
}

/** Pontos de Dijkstra que valem o custo de uma parede na montagem por fatias. */
const PONTOS_POR_PAREDE = 48

/**
 * Monta mais um pedaço da malha: `paredes` paredes ou, com elas todas
 * dentro, o mesmo trabalho em pontos dos marcos. `true` quando pronta.
 */
export function avancarMalha(m: Malha, paredes: number): boolean {
  if (!paredesProntas(m)) {
    avancarParedes(m, paredes)
    return malhaPronta(m)
  }
  return avancarMarcos(m, paredes * PONTOS_POR_PAREDE)
}

/** A malha inteira de uma vez (teste, mapa pequeno). */
export function montarMalha(mapa: MapaDoCaminho, raio: number): Malha {
  const m = criarMalha(mapa, raio)
  while (!avancarMalha(m, Number.POSITIVE_INFINITY));
  return m
}
