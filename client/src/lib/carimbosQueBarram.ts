import type { Carimbo, RegionPoint, Wall } from '../types/map'
import { pisoDe } from './pisos'

/**
 * CARIMBO QUE BARRA E QUE TAPA (Fase 2, 15/11/2026; decisão do mestre: "Carimbo
 * coloque no carimbo tudo que é natural"). As chaves "Barra a passagem"
 * (`Carimbo.barra`) e "Tapa a visão" (`Carimbo.tapaVisao`) valem para QUALQUER
 * carimbo, sem lista por tipo: as peças naturais que hoje barram como Objeto
 * passam para cá numa fase seguinte, e já encontram a chave pronta.
 *
 * A forma é a PEGADA: um quadrado em volta do pé (o tronco e o miolo da copa,
 * não a copa inteira), para a mata deixar trilha entre as árvores. Vira paredes
 * sintéticas, como as do objeto (`lib/obstaculosDeObjeto.ts`): seguram o andar
 * do jogador ou o olhar, nunca entram em `map.walls`. Mapa sem nenhuma chave
 * ligada: as mesmas listas de antes, pela mesma referência.
 *
 * Puro: sem store, sem DOM, sem Pixi.
 */

/** Meia largura da pegada, em frações do `tamanho` do carimbo. */
const MEIA_PEGADA = 0.25
/** Começo do id de toda parede de carimbo: `carimbo:<id>:<lado>`. */
const PREFIXO_DO_ID = 'carimbo:'

/** Um trecho que segura o olhar (o `Segment` de `lib/visibility.ts`, sem importá-lo). */
export interface TrechoDoCarimbo {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

/** Os quatro cantos da pegada, no sentido do relógio. */
export function pegadaDoCarimbo(c: Pick<Carimbo, 'x' | 'y' | 'tamanho'>): RegionPoint[] {
  const m = c.tamanho * MEIA_PEGADA
  return [
    { x: c.x - m, y: c.y - m },
    { x: c.x + m, y: c.y - m },
    { x: c.x + m, y: c.y + m },
    { x: c.x - m, y: c.y + m },
  ]
}

/** O ponto está dentro da pegada (ou na borda)? A ficha que começa ali dentro não fica presa. */
export function pegadaContem(c: Pick<Carimbo, 'x' | 'y' | 'tamanho'>, p: RegionPoint): boolean {
  const m = c.tamanho * MEIA_PEGADA
  return Math.abs(p.x - c.x) <= m && Math.abs(p.y - c.y) <= m
}

function ladosDaPegada(c: Carimbo): Array<[RegionPoint, RegionPoint]> {
  const cantos = pegadaDoCarimbo(c)
  return cantos.map((a, k): [RegionPoint, RegionPoint] => [a, cantos[(k + 1) % cantos.length] ?? a])
}

const SEM_PAREDES: readonly Wall[] = []
const paredesPorLista = new WeakMap<readonly Carimbo[], Map<number, readonly Wall[]>>()

/** As paredes dos carimbos que barram neste piso. A mesma lista e o mesmo piso devolvem o MESMO array. */
export function paredesDosCarimbosQueBarram(lista: readonly Carimbo[] | undefined, piso: number): readonly Wall[] {
  if (lista === undefined || lista.length === 0) return SEM_PAREDES
  let porPiso = paredesPorLista.get(lista)
  if (porPiso === undefined) {
    porPiso = new Map()
    paredesPorLista.set(lista, porPiso)
  }
  const guardadas = porPiso.get(piso)
  if (guardadas !== undefined) return guardadas
  const feitas: Wall[] = []
  for (const c of lista) {
    if (c.barra !== true || pisoDe(c) !== piso) continue
    ladosDaPegada(c).forEach(([a, b], k) => {
      feitas.push({ id: `${PREFIXO_DO_ID}${c.id}:${k}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, blocksLight: false, blocksMove: true, door: null, ...(piso !== 0 ? { piso } : {}) })
    })
  }
  const resposta = feitas.length === 0 ? SEM_PAREDES : feitas
  porPiso.set(piso, resposta)
  return resposta
}

/** O id é de uma parede de carimbo? */
export function ehParedeDeCarimbo(id: string): boolean {
  return id.startsWith(PREFIXO_DO_ID)
}

const juntadas = new WeakMap<Wall[], WeakMap<readonly Wall[], Map<string, Wall[]>>>()

/**
 * `base` mais as paredes dos carimbos que barram neste piso, menos as do
 * carimbo onde a ficha (`de`) já está (NUNCA PRENDER). As mesmas entradas
 * devolvem o MESMO array (as malhas do clique para andar guardam cache pela
 * referência); sem carimbo que barre, a própria `base`.
 */
export function comParedesDosCarimbos(base: Wall[], lista: readonly Carimbo[] | undefined, piso: number, de: RegionPoint | null): Wall[] {
  const todas = paredesDosCarimbosQueBarram(lista, piso)
  if (todas.length === 0 || lista === undefined) return base
  const dentro = de === null ? [] : lista.filter((c) => c.barra === true && pisoDe(c) === piso && pegadaContem(c, de)).map((c) => `${PREFIXO_DO_ID}${c.id}:`)
  let porTodas = juntadas.get(base)
  if (porTodas === undefined) {
    porTodas = new WeakMap()
    juntadas.set(base, porTodas)
  }
  let porChave = porTodas.get(todas)
  if (porChave === undefined) {
    porChave = new Map()
    porTodas.set(todas, porChave)
  }
  const chave = dentro.join('|')
  const guardada = porChave.get(chave)
  if (guardada !== undefined) return guardada
  const valem = dentro.length === 0 ? todas : todas.filter((w) => !dentro.some((prefixo) => w.id.startsWith(prefixo)))
  const juntas = [...base, ...valem]
  porChave.set(chave, juntas)
  return juntas
}

const SEM_TRECHOS: readonly TrechoDoCarimbo[] = []
const trechosPorLista = new WeakMap<readonly Carimbo[], readonly TrechoDoCarimbo[]>()

/**
 * Os trechos que seguram o olhar: os lados das pegadas dos carimbos com "Tapa
 * a visão". Guardado pela lista (a mesma devolve o MESMO array). Não filtra
 * piso: quem chama passa a lista do piso de quem olha (o recorte).
 */
export function trechosDosCarimbosQueTapam(lista: readonly Carimbo[] | undefined): readonly TrechoDoCarimbo[] {
  if (lista === undefined || lista.length === 0) return SEM_TRECHOS
  const guardados = trechosPorLista.get(lista)
  if (guardados !== undefined) return guardados
  const feitos: TrechoDoCarimbo[] = []
  for (const c of lista) {
    if (c.tapaVisao !== true) continue
    for (const [a, b] of ladosDaPegada(c)) feitos.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
  }
  const resposta = feitos.length === 0 ? SEM_TRECHOS : feitos
  trechosPorLista.set(lista, resposta)
  return resposta
}
