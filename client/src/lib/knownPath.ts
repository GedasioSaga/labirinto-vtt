import type { FloorPiece, MapData, RegionPoint, Wall } from '../types/map'
import type { Point } from '../pixi/world'
import { PAREDES_POR_FATIA } from './caminhamento/agenda'
import { acharCaminhoNaMalha, type ResultadoDoCaminho } from './caminhamento/busca'
import { criarMalha, type Malha, malhaPronta, type MapaDoCaminho, mesmaEstrutura, paredesAoLongo } from './caminhamento/malha'
import { avancarMalha } from './caminhamento/marcos'
import { isTokenPathClear } from './collision'
import { isPointExplored, type Exploration } from './exploration'
import { compileFloor, type CompiledFloor } from './floorSdf'
import { pointInRing } from './floorContour'

/**
 * ANDAR ATÉ AQUI: o caminho da ficha do jogador até um ponto, dobrando as
 * esquinas, usando SÓ o que a tela dele já tem — a memória explorada e a
 * visão de agora, tirando as zonas ocultas do mestre. Nada vem do host para
 * isto: o que a névoa esconde não entra no cálculo, então nunca vira atalho
 * (se a única rua passa pelo escuro, não há caminho).
 *
 * A busca é a do motor de caminhamento dos NPCs (`caminhamento/busca.ts`, A*
 * com marcos), com MÁSCARA (chão conhecido) e sem fichas como obstáculo: quem
 * decide sobre ficha no caminho é o host. Porta fechada barra (o host não abre
 * porta no passo do jogador); sem caminho, o motivo diz se é porta trancada,
 * porta fechada ou falta de caminho conhecido.
 *
 * O host continua sendo a autoridade: cada trecho devolvido aqui sai como um
 * `token.move` comum, validado sozinho (`validateTokenMove`). Por isso cada
 * trecho é conferido de novo, já arredondado, pela regra do arrasto e pelo
 * chão conhecido amostrado no mesmo passo do host.
 */

export interface KnownArea {
  /** Memória do que o jogador já viu; ausente = só a visão de agora. */
  explored: Exploration | undefined
  /** Anéis da visão de agora. */
  vision: readonly RegionPoint[][]
  /** Zonas ocultas ativas: escuro, mesmo que já exploradas. */
  concealed: readonly RegionPoint[][]
}

type PathMap = Pick<MapData, 'width' | 'height' | 'grid' | 'walls' | 'floor'>

export type MotivoSemCaminhoConhecido = 'sem-caminho' | 'porta-trancada' | 'porta-fechada'

export type CaminhoConhecido =
  | { tipo: 'caminho'; trechos: Point[] }
  | { tipo: 'sem-caminho'; motivo: MotivoSemCaminhoConhecido; portas: string[] }

/**
 * A rede do passo do jogador tem um ponto a cada MEIA casa (a malha é montada
 * com a casa partida em dois), como a busca antiga: parede e porta desenhadas
 * fora da linha da grade (porta de 275 a 325 numa grade de 50) deixam o vão
 * entre dois centros de casa, e a rede de casa inteira não passava. Mapa
 * gigante engrossa para uma casa inteira (como a busca antiga engrossava o
 * passo): a rede fina dele passaria deste teto, e a consulta, de 5 ms.
 */
const MAX_PONTOS_DA_REDE_FINA = 90_000
/**
 * O raio da ficha na malha: o de uma ficha de meia casa, qualquer que seja o
 * tamanho dela. O host confere só o CENTRO da ficha (`validateTokenMove`), e a
 * folga da ficha grande barraria a porta de uma casa por onde ela passa hoje
 * arrastada.
 */
const RAIO_NA_REDE = 0.5
/** Amostras do trecho por casa: o mesmo passo com que o host confere o chão. */
const AMOSTRAS_POR_CASA = 4
/** Teto de amostras de um trecho, como no host (`MAX_PATH_SAMPLES`). */
const MAX_AMOSTRAS_DO_TRECHO = 10_000

const SEM_CAMINHO: CaminhoConhecido = { tipo: 'sem-caminho', motivo: 'sem-caminho', portas: [] }

/** Um anel com a caixa dele: a maioria dos pontos sai pela caixa, sem o teste do polígono. */
interface AnelComCaixa {
  pontos: RegionPoint[]
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function comCaixas(aneis: readonly RegionPoint[][]): AnelComCaixa[] {
  return aneis
    .filter((anel) => anel.length >= 3)
    .map((pontos) => ({
      pontos,
      minX: Math.min(...pontos.map((p) => p.x)),
      minY: Math.min(...pontos.map((p) => p.y)),
      maxX: Math.max(...pontos.map((p) => p.x)),
      maxY: Math.max(...pontos.map((p) => p.y)),
    }))
}

function emAlgum(aneis: readonly AnelComCaixa[], p: RegionPoint): boolean {
  return aneis.some((a) => p.x >= a.minX && p.x <= a.maxX && p.y >= a.minY && p.y <= a.maxY && pointInRing(p, a.pontos))
}

function inRings(point: RegionPoint, rings: readonly RegionPoint[][]): boolean {
  return rings.some((ring) => ring.length >= 3 && pointInRing(point, ring))
}

/** O jogador conhece o ponto: está na visão de agora ou na memória, e fora de zona oculta. */
export function isPointKnown(area: KnownArea, point: RegionPoint): boolean {
  if (inRings(point, area.concealed)) return false
  if (inRings(point, area.vision)) return true
  return area.explored !== undefined && isPointExplored(area.explored, point)
}

/** O chão compilado da última consulta: a mesma lista de peças não compila de novo. */
let chaoGuardado: { pecas: FloorPiece[]; compilado: CompiledFloor } | null = null

function chaoDe(pecas: FloorPiece[]): CompiledFloor {
  if (chaoGuardado !== null && chaoGuardado.pecas === pecas) return chaoGuardado.compilado
  const compilado = compileFloor(pecas)
  chaoGuardado = { pecas, compilado }
  return compilado
}

/**
 * Onde a ficha do jogador pode pisar: dentro do mapa, no chão (sem peça de
 * chão visível, o chão não restringe — a regra do host) e no que ele conhece
 * (`isPointKnown`, com as caixas dos anéis na frente).
 *
 * O CONHECIDO é conferido nos quatro cantos de um quadrado de meio passo de
 * amostra em volta do ponto: duas amostras vizinhas de um traço (um passo
 * entre elas) cobrem o traço inteiro com os quadrados delas, então o traço não
 * corta a quina do escuro entre uma amostra e outra (o robô achou 2 px assim).
 * O chão fica na regra do host, ponto a ponto.
 */
function mascaraConhecida(map: PathMap, area: KnownArea): (x: number, y: number) => boolean {
  const chao = chaoDe(map.floor)
  const largura = map.width * map.grid
  const altura = map.height * map.grid
  const ocultas = comCaixas(area.concealed)
  const visao = comCaixas(area.vision)
  const memoria = area.explored
  const meio = passoDaAmostra(map) / 2
  const conhece = (x: number, y: number): boolean => {
    const p = { x, y }
    if (emAlgum(ocultas, p)) return false
    if (memoria !== undefined && isPointExplored(memoria, p)) return true
    return emAlgum(visao, p)
  }
  return (x, y) => {
    if (!(x >= 0 && y >= 0 && x <= largura && y <= altura)) return false
    if (chao.bounds !== null && chao.sample(x, y) > 0) return false
    return conhece(x - meio, y - meio) && conhece(x + meio, y - meio) && conhece(x - meio, y + meio) && conhece(x + meio, y + meio)
  }
}

/**
 * A malha do passo do jogador, guardada entre consultas: refeita só quando a
 * ESTRUTURA das paredes muda (abrir ou fechar porta não muda, `mesmaEstrutura`).
 * Uma só: o jogador anda numa cena por vez.
 */
let malhaGuardada: { malha: Malha; ultimas: readonly Wall[] } | null = null

/** O mapa como a malha do jogador o vê: a casa partida em dois, salvo no mapa gigante (`MAX_PONTOS_DA_REDE_FINA`). */
function mapaDaRede(map: PathMap): MapaDoCaminho {
  const nosPorCasa = 4 * map.width * map.height <= MAX_PONTOS_DA_REDE_FINA ? 2 : 1
  return { walls: map.walls, grid: map.grid / nosPorCasa, width: map.width * nosPorCasa, height: map.height * nosPorCasa }
}

/**
 * Adianta a montagem da malha do jogador por até `orcamentoMs` (em fatias de
 * `PAREDES_POR_FATIA` paredes, como a agenda dos NPCs), para a primeira
 * consulta não montar tudo de uma vez: num mapa de 300 x 300 casas a malha
 * inteira leva mais que uma tarefa longa. `true` quando está pronta.
 */
export function prepararCaminhoConhecido(map: PathMap, orcamentoMs: number, agora: () => number = () => performance.now()): boolean {
  if (!mapaValido(map)) return true
  const malha = malhaDoJogador(map)
  const inicio = agora()
  while (!malhaPronta(malha)) {
    if (agora() - inicio >= orcamentoMs) return false
    avancarMalha(malha, PAREDES_POR_FATIA)
  }
  return true
}

function mapaValido(map: PathMap): boolean {
  return [map.grid, map.width, map.height].every(Number.isFinite) && map.grid > 0 && map.width > 0 && map.height > 0
}

function malhaDoJogador(map: PathMap): Malha {
  const mapa = mapaDaRede(map)
  const raio = mapa.grid * RAIO_NA_REDE
  const g = malhaGuardada
  const largura = Math.max(1, Math.ceil(mapa.width))
  const altura = Math.max(1, Math.ceil(mapa.height))
  const serve =
    g !== null &&
    g.malha.grid === mapa.grid &&
    g.malha.raio === raio &&
    g.malha.largura === largura &&
    g.malha.altura === altura &&
    (g.ultimas === mapa.walls || mesmaEstrutura(g.malha.paredes, mapa.walls))
  if (serve) {
    g.ultimas = mapa.walls
    return g.malha
  }
  const malha = criarMalha(mapa, raio)
  malhaGuardada = { malha, ultimas: mapa.walls }
  return malha
}

/** A porta trancada no caminho dá `porta-trancada`; só porta fechada (que o jogador abre), `porta-fechada`. */
function motivoDoJogador(r: Extract<ResultadoDoCaminho, { tipo: 'sem-caminho' }>, paredes: readonly Wall[]): MotivoSemCaminhoConhecido {
  if (r.motivo !== 'porta-trancada') return 'sem-caminho'
  const trancada = r.portas.some((id) => paredes.find((w) => w.id === id)?.door?.locked === true)
  return trancada ? 'porta-trancada' : 'porta-fechada'
}

/**
 * Os trechos que vão ao host, já arredondados, passam: pela regra do arrasto
 * do host (`isTokenPathClear` com a casa do mapa, só com as paredes de perto
 * do traço, pelos baldes da malha) e com toda amostra (no passo e nas posições
 * em que o host confere o chão; a origem, onde a ficha já está, não conta) na
 * máscara.
 */
function trechosPassam(malha: Malha, map: PathMap, de: Point, trechos: readonly Point[], mascara: (x: number, y: number) => boolean): boolean {
  const passo = passoDaAmostra(map)
  let a = de
  for (const b of trechos) {
    const perto: Wall[] = []
    for (const k of paredesAoLongo(malha, a, b)) {
      const w = map.walls[k]
      if (w !== undefined) perto.push(w)
    }
    if (!isTokenPathClear(a, b, perto, map.grid)) return false
    const querido = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / passo)
    const amostras = Math.min(MAX_AMOSTRAS_DO_TRECHO, Math.max(1, querido))
    for (let k = 1; k <= amostras; k += 1) {
      const t = k / amostras
      if (!mascara(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false
    }
    a = b
  }
  return true
}

/**
 * O caminho de `from` até `target` pelo que o jogador conhece, ou por que não
 * há: `sem-caminho` (destino no escuro, fora do chão, ou nenhum caminho
 * conhecido chega lá), `porta-trancada` ou `porta-fechada` (há caminho
 * conhecido, mas passa por ela). Cada trecho termina num ponto inteiro (o
 * último é o destino arredondado).
 */
export function caminhoConhecido(map: PathMap, from: Point, target: Point, area: KnownArea): CaminhoConhecido {
  if (![from.x, from.y, target.x, target.y].every(Number.isFinite) || !mapaValido(map)) return SEM_CAMINHO
  // O pedido ao host sai em px inteiros (como o arrasto): o caminho é conferido já arredondado.
  const to = roundPoint(target)
  const mascara = mascaraConhecida(map, area)
  if (!mascara(to.x, to.y)) return SEM_CAMINHO
  const malha = malhaDoJogador(map)
  const r = acharCaminhoNaMalha(malha, map.walls, { de: from, para: to, fichas: [], mascara, passoDaMascara: passoDaAmostra(map), portaFechadaBarra: true })
  if (r.tipo === 'sem-caminho') {
    const motivo = motivoDoJogador(r, map.walls)
    return { tipo: 'sem-caminho', motivo, portas: motivo === 'sem-caminho' ? [] : r.portas }
  }
  const pontos = r.pontos.slice(1).map(roundPoint)
  const trechos = pontos.length > 0 ? pontos : [to]
  // Arredondar mexe o ponto até meio px: o que a busca aprovou é conferido de novo, como o host vai conferir.
  return trechosPassam(malha, map, from, trechos, mascara) ? { tipo: 'caminho', trechos } : SEM_CAMINHO
}

/** O passo com que o host amostra o chão de um trecho (`moveValidation`): as amostras daqui caem nas mesmas posições. */
function passoDaAmostra(map: PathMap): number {
  return Math.max(map.grid / AMOSTRAS_POR_CASA, 1)
}

/**
 * Trechos de `from` até `to` pelo que o jogador conhece: cada ponto devolvido
 * é o fim de um trecho reto (o último é `to`). `null` quando não há caminho
 * conhecido (o motivo está em `caminhoConhecido`).
 */
export function findKnownPath(map: PathMap, from: Point, target: Point, area: KnownArea): Point[] | null {
  const r = caminhoConhecido(map, from, target, area)
  return r.tipo === 'caminho' ? r.trechos : null
}

function roundPoint(p: Point): Point {
  return { x: Math.round(p.x), y: Math.round(p.y) }
}
