import type { MapData, RegionPoint } from '../types/map'
import { pinSummary } from './pins'

/**
 * ABALO POR DISTÂNCIA (estrondo, sino, tranco): o mestre marca de onde veio o
 * evento — a cena e, se quiser, um ponto dela — e escreve um texto por FAIXA.
 * Cada jogador recebe só o texto da faixa dele:
 * - `perto`: está na cena da origem. Ganha a seta (do ponto de vista da
 *   PRÓPRIA ficha) e o aparelho vibra;
 * - `andar`: está numa cena vizinha na árvore de pastas da aventura (a mesma
 *   pasta, a de fora ou uma de dentro) — é o "mesmo andar" de uma torre
 *   organizada em pastas;
 * - `longe`: qualquer outra cena da aventura.
 *
 * O ponto de origem nunca viaja: só o rumo de 8 pontas, e só para quem está na
 * mesma cena (`lib/fogFilter.ts` → `abaloSetaForPlayer`).
 */

export type AbaloFaixa = 'perto' | 'andar' | 'longe'

/** Rumo da origem visto da ficha, com o norte no ALTO da tela. `aqui` = em cima do jogador. */
export type AbaloSeta = 'n' | 'ne' | 'l' | 'se' | 's' | 'so' | 'o' | 'no' | 'aqui'

export const ABALO_SETAS: readonly AbaloSeta[] = ['n', 'ne', 'l', 'se', 's', 'so', 'o', 'no', 'aqui']

/** O texto de cada faixa como o mestre escreveu. Vazio = aquela faixa não recebe nada. */
export type AbaloTextos = Record<AbaloFaixa, string>

/** Quantos jogadores receberam em cada faixa: o aviso do mestre. */
export type AbaloContagem = Record<AbaloFaixa, number>

/** A origem do abalo. `sceneId` `null` = mapa solto. Sem `x`/`y`, ninguém ganha seta. */
export interface AbaloOrigem {
  sceneId: string | null
  x?: number
  y?: number
}

/** Uma vibração curta: sente-se no bolso sem virar alarme. */
export const ABALO_VIBRACAO_MS = 300

/** Glifo e nome de cada rumo, para o cartão do jogador (o nome é o que o leitor de tela lê). */
export const ABALO_SETA_ROTULO: Record<AbaloSeta, { glifo: string; nome: string }> = {
  n: { glifo: '↑', nome: 'norte' },
  ne: { glifo: '↗', nome: 'nordeste' },
  l: { glifo: '→', nome: 'leste' },
  se: { glifo: '↘', nome: 'sudeste' },
  s: { glifo: '↓', nome: 'sul' },
  so: { glifo: '↙', nome: 'sudoeste' },
  o: { glifo: '←', nome: 'oeste' },
  no: { glifo: '↖', nome: 'noroeste' },
  aqui: { glifo: '•', nome: 'bem aqui' },
}

/** Os 8 rumos na ordem do ângulo matemático (0 = leste, sentido anti-horário, y para CIMA). */
const RUMOS_POR_ANGULO: readonly AbaloSeta[] = ['l', 'ne', 'n', 'no', 'o', 'so', 's', 'se']

const OITAVO_DE_VOLTA = Math.PI / 4

/**
 * De que lado a origem está, vista de `de` (a ficha). O y do mapa cresce para
 * BAIXO: origem com y menor está ao norte. Dentro de `raioAqui` (px de mundo)
 * não há rumo: foi em cima do jogador.
 */
export function setaDoAbalo(de: RegionPoint, origem: RegionPoint, raioAqui: number): AbaloSeta {
  const dx = origem.x - de.x
  const dy = de.y - origem.y
  if (Math.hypot(dx, dy) <= raioAqui) return 'aqui'
  const setor = Math.round(Math.atan2(dy, dx) / OITAVO_DE_VOLTA)
  return RUMOS_POR_ANGULO[((setor % 8) + 8) % 8]
}

interface CenaNaArvore {
  id: string
  parentId?: string
}

/**
 * As cenas da faixa do meio: as da mesma pasta da origem (no primeiro nível,
 * as outras de primeiro nível), a pasta de fora e as de dentro dela. Nunca a
 * própria origem. Origem que não está na lista: nenhuma.
 */
export function cenasVizinhas(cenas: readonly CenaNaArvore[], origemId: string): Set<string> {
  const origem = cenas.find((cena) => cena.id === origemId)
  if (origem === undefined) return new Set()
  const vizinhas = new Set<string>()
  for (const cena of cenas) {
    if (cena.id === origemId) continue
    const irma = cena.parentId === origem.parentId
    const deFora = cena.id === origem.parentId
    const deDentro = cena.parentId === origemId
    if (irma || deFora || deDentro) vizinhas.add(cena.id)
  }
  return vizinhas
}

/** A faixa de quem está em `cenaDoJogador`. Mapa solto (`null` dos dois lados) é tudo perto. */
export function faixaDoAbalo(cenaDoJogador: string | null, origemId: string | null, vizinhas: ReadonlySet<string>): AbaloFaixa {
  if (cenaDoJogador === origemId) return 'perto'
  if (cenaDoJogador !== null && vizinhas.has(cenaDoJogador)) return 'andar'
  return 'longe'
}

/** Um ponto que o mestre pode escolher como origem: uma Sala (o centro dela) ou um pino. Só a tela do mestre vê. */
export interface OrigemDoAbalo {
  /** `sala:<id>` ou `pino:<id>`: o valor da lista do formulário. */
  chave: string
  rotulo: string
  x: number
  y: number
}

function centroDaCaixa(points: readonly RegionPoint[]): RegionPoint | null {
  if (points.length === 0) return null
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
}

/** As Salas (com nome) e os pinos da cena, na ordem do mapa: as escolhas do "De onde veio". */
export function origensDaCena(map: MapData): OrigemDoAbalo[] {
  const origens: OrigemDoAbalo[] = []
  for (const region of map.regions) {
    const nome = region.room?.name.trim() ?? ''
    const centro = centroDaCaixa(region.points)
    if (nome === '' || centro === null) continue
    origens.push({ chave: `sala:${region.id}`, rotulo: `Sala: ${nome}`, ...centro })
  }
  for (const pin of map.pins) origens.push({ chave: `pino:${pin.id}`, rotulo: `Pino: ${pinSummary(pin)}`, x: pin.x, y: pin.y })
  return origens
}
