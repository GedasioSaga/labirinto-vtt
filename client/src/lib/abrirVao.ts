import type { MapData, Wall } from '../types/map'
import { canInteractInLayer, visibleWalls, wallLayer } from './layers'
import { findWallAt } from './selectionHitTest'
import { ancestorsOf, subtreeIds } from './roomNesting'

/**
 * ABRIR VÃO / DESABAR NO MEIO DA SESSÃO — o gesto do mestre sobre a parede.
 *
 * Dois prédios encostados têm DUAS paredes na mesma linha: a aresta de cada
 * Sala é traçada pela própria Sala (`buildRoomFromDraft`), então a divisa
 * entre eles é um par de `Wall` sobrepostas. `addOpeningOnWall`
 * (mapFactory.ts) parte só a parede clicada; a outra continua inteira por
 * baixo e a ficha segue barrada — o vão "abre" na tela e não abre no jogo.
 *
 * Aqui o corte vale DOS DOIS LADOS: toda parede na mesma linha da clicada perde
 * o mesmo trecho, medido no eixo da clicada. O vão é, como em
 * `addOpeningOnWall`, AUSÊNCIA de parede: nenhum campo novo no schema, nenhum
 * dado novo na rede. O jogador recebe só as paredes que já recebia
 * (`fogFilter.filterMapForPlayer`), agora com o trecho faltando.
 */

/** Distância máxima, em px de mundo, das pontas de uma parede até a linha da
 *  clicada para as duas contarem como "a mesma parede vista dos dois lados".
 *  Paredes de Sala nascem na grade: a divisa real bate no décimo de pixel. */
const MESMA_LINHA_TOLERANCIA = 1

/** Sobra menor que isto (px) não vira pedaço de parede: seria um fiapo de
 *  arredondamento, invisível, que ainda assim barraria a ficha na junta. */
const PEDACO_MINIMO = 0.5

interface Eixo {
  origem: { x: number; y: number }
  /** Vetor unitário da parede clicada. */
  ux: number
  uy: number
  comprimento: number
}

function eixoDa(parede: Wall): Eixo | null {
  const dx = parede.x2 - parede.x1
  const dy = parede.y2 - parede.y1
  const comprimento = Math.hypot(dx, dy)
  if (comprimento === 0) return null
  return { origem: { x: parede.x1, y: parede.y1 }, ux: dx / comprimento, uy: dy / comprimento, comprimento }
}

/** Posição de `p` ao longo do eixo (projeção escalar). */
function aoLongo(eixo: Eixo, p: { x: number; y: number }): number {
  return (p.x - eixo.origem.x) * eixo.ux + (p.y - eixo.origem.y) * eixo.uy
}

/** Distância de `p` até a linha infinita do eixo. */
function foraDaLinha(eixo: Eixo, p: { x: number; y: number }): number {
  return Math.abs((p.x - eixo.origem.x) * eixo.uy - (p.y - eixo.origem.y) * eixo.ux)
}

/**
 * Tira de `parede` o trecho `[de, ate]` (medido no `eixo`, não na parede).
 * Devolve os pedaços que sobram — zero, um ou dois —, cada um com tudo da
 * original (vínculo com a Sala, estilo, camada) e `door: null`, a mesma regra
 * de `splitWallAround` em mapFactory.ts: pedaço de porta cortada vira parede.
 * `null` quando o trecho não encosta na parede (ela fica como está).
 */
function cortar(parede: Wall, eixo: Eixo, de: number, ate: number): Wall[] | null {
  const a = aoLongo(eixo, { x: parede.x1, y: parede.y1 })
  const b = aoLongo(eixo, { x: parede.x2, y: parede.y2 })
  const inicio = Math.max(Math.min(a, b), de)
  const fim = Math.min(Math.max(a, b), ate)
  if (fim - inicio < PEDACO_MINIMO) return null

  // Os pedaços seguem o sentido da parede original (x1→x2), para o vínculo
  // `regionEdgeIndex` continuar descrevendo a aresta no mesmo sentido.
  const sentido = b >= a ? 1 : -1
  const pontoEm = (s: number) => ({ x: eixo.origem.x + eixo.ux * s, y: eixo.origem.y + eixo.uy * s })
  const pedaco = (s1: number, s2: number): Wall => {
    const p1 = pontoEm(s1)
    const p2 = pontoEm(s2)
    return { ...parede, id: crypto.randomUUID(), x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, door: null }
  }
  const sobras: Wall[] = []
  if (sentido === 1) {
    if (inicio - a >= PEDACO_MINIMO) sobras.push(pedaco(a, inicio))
    if (b - fim >= PEDACO_MINIMO) sobras.push(pedaco(fim, b))
  } else {
    if (a - fim >= PEDACO_MINIMO) sobras.push(pedaco(a, fim))
    if (inicio - b >= PEDACO_MINIMO) sobras.push(pedaco(inicio, b))
  }
  return sobras
}

/** A parede clicada e todas as que estão na mesma linha dela (o outro lado). */
function mesmaLinha(map: MapData, eixo: Eixo): Wall[] {
  return map.walls.filter(
    (w) =>
      foraDaLinha(eixo, { x: w.x1, y: w.y1 }) <= MESMA_LINHA_TOLERANCIA &&
      foraDaLinha(eixo, { x: w.x2, y: w.y2 }) <= MESMA_LINHA_TOLERANCIA,
  )
}

/**
 * Salas que o jogador NUNCA recebe por decisão do mestre — o mesmo conjunto
 * que `fogFilter.filterMapForPlayer` chama de `secretRoomIds`: a sala secreta
 * com tudo o que há dentro dela, e o que está dentro de sala oculta.
 */
function salasEscondidasIds(map: MapData): Set<string> {
  const ids = new Set<string>()
  for (const r of map.regions) {
    if (r.secret === true && r.room !== undefined) for (const id of subtreeIds(map.regions, r.id)) ids.add(id)
    if (r.parentId !== undefined && ancestorsOf(map.regions, r.id).some((a) => a.secret === true || a.hidden === true)) ids.add(r.id)
  }
  return ids
}

/** O que o corte fez. `salaSecretaPoupada`: a parede da sala secreta ficou de pé (ver `cortarNaLinha`).
 *  `travadaNoCaminho`: o gesto foi RECUSADO inteiro — alguma parede do trecho está travada. */
export interface CorteNaParede {
  map: MapData
  salaSecretaPoupada: boolean
  travadaNoCaminho: boolean
}

const NADA_MUDOU: Omit<CorteNaParede, 'map'> = { salaSecretaPoupada: false, travadaNoCaminho: false }

/**
 * Corta `[de, ate]` das paredes da linha; `map` pela mesma referência se nada mudou.
 *
 * SALA SECRETA DO OUTRO LADO: a parede dela NÃO é cortada quando o lado de cá
 * é cortado. É ela que segura o segredo — o recorte do jogador troca a parede
 * da sala secreta por parede comum (`disguisedSecretBorderWalls`, fogFilter.ts);
 * sem ela, o vão aberto dos dois lados deixaria a visão entrar e entregaria o
 * que há lá dentro antes de o mestre revelar a sala. Só quando TODA parede do
 * trecho é de sala escondida (o mestre mexendo dentro do segredo) ela cai.
 *
 * PAREDE TRAVADA NO TRECHO: o gesto inteiro é recusado (`map` pela mesma
 * referência, `travadaNoCaminho`). Trava — da parede ou da camada — quer dizer
 * "não muda por gesto nenhum", do lado clicado ou do outro. Cortar só o lado
 * destravado também não serve: abriria um vão na tela que a parede travada
 * por baixo continua barrando no jogo.
 */
function cortarNaLinha(map: MapData, eixo: Eixo, de: number, ate: number): CorteNaParede {
  const escondidas = salasEscondidasIds(map)
  const ehEscondida = (w: Wall): boolean => w.regionId !== undefined && escondidas.has(w.regionId)
  const cortes = mesmaLinha(map, eixo).flatMap((parede) => {
    const sobras = cortar(parede, eixo, de, ate)
    return sobras === null ? [] : [{ parede, sobras }]
  })
  const temLadoVisivel = cortes.some((c) => !ehEscondida(c.parede))
  const valem = temLadoVisivel ? cortes.filter((c) => !ehEscondida(c.parede)) : cortes
  if (valem.some((c) => !canInteractInLayer(c.parede, wallLayer(c.parede), map.lockedLayers))) {
    return { map, salaSecretaPoupada: false, travadaNoCaminho: true }
  }
  const salaSecretaPoupada = valem.length < cortes.length
  if (valem.length === 0) return { map, salaSecretaPoupada, travadaNoCaminho: false }
  const trocas = new Map(valem.map((c) => [c.parede.id, c.sobras]))
  return { map: { ...map, walls: map.walls.flatMap((w) => trocas.get(w.id) ?? [w]) }, salaSecretaPoupada, travadaNoCaminho: false }
}

/**
 * "Abrir vão aqui": um vão de `comprimento` px centrado no ponto clicado
 * (projetado na linha da parede), aberto na parede clicada E na do outro lado.
 * Parede inexistente ou de comprimento zero: devolve `map` sem cópia.
 */
export function abrirVaoDosDoisLados(map: MapData, wallId: string, ponto: { x: number; y: number }, comprimento: number): CorteNaParede {
  const parede = map.walls.find((w) => w.id === wallId)
  if (!parede) return { map, ...NADA_MUDOU }
  const eixo = eixoDa(parede)
  if (eixo === null) return { map, ...NADA_MUDOU }
  const centro = Math.max(0, Math.min(eixo.comprimento, aoLongo(eixo, ponto)))
  const metade = comprimento / 2
  // O vão não passa da ponta da parede clicada (mesma regra de `splitWallAround`,
  // mapFactory.ts). Sem isso, clique perto da quina cortaria a parede colinear
  // do prédio vizinho — que é a face externa dele, não o outro lado desta.
  return cortarNaLinha(map, eixo, Math.max(0, centro - metade), Math.min(eixo.comprimento, centro + metade))
}

/**
 * A parede sob o clique direito do mestre, ou `null`. Mesmo filtro do resto
 * do editor: parede de camada escondida não é alvo (não está na tela), e
 * parede travada — ela ou a camada — não muda por gesto nenhum.
 * `tolerancia` em px de MUNDO (quem chama converte a folga de tela pelo zoom).
 */
export function paredeDoGesto(map: MapData, ponto: { x: number; y: number }, tolerancia: number): Wall | null {
  const alcancaveis = visibleWalls(map.walls, map.hiddenLayers).filter((w) => canInteractInLayer(w, wallLayer(w), map.lockedLayers))
  return findWallAt(alcancaveis, ponto, tolerancia)
}

/**
 * "Desabar": a parede clicada cai inteira, e com ela o mesmo trecho da parede
 * do outro lado. O que a outra tem além das pontas da clicada continua de pé.
 * Parede inexistente ou de comprimento zero: devolve `map` sem cópia.
 */
export function desabarParede(map: MapData, wallId: string): CorteNaParede {
  const parede = map.walls.find((w) => w.id === wallId)
  if (!parede) return { map, ...NADA_MUDOU }
  const eixo = eixoDa(parede)
  if (eixo === null) return { map, ...NADA_MUDOU }
  return cortarNaLinha(map, eixo, 0, eixo.comprimento)
}
