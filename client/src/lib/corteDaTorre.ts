import type { PlayerInfo } from '../net/hostSession'
import type { MapData } from '../types/map'
import { sceneTree } from './adventure'
import { pinSummary } from './pins'
import { resolvePinTravel, travelExitsOf, type TravelScene } from './pinTravel'
import { findContainingRoom } from './roomNesting'
import { tokenFillColor } from './tokenColor'

/**
 * CORTE DA TORRE (só do mestre): a aventura vista de lado. Cada cena de
 * PRIMEIRO NÍVEL da lista Cenas é um andar, com as cenas de dentro dela no
 * mesmo andar — a mesma leitura de "andar = pasta" do Abalo (`lib/abalo.ts`).
 * O último andar da lista fica no alto, como numa torre desenhada de baixo
 * para cima.
 *
 * As fichas viram pontos: jogador na cor da ficha, com o nome do jogador; ficha
 * sem dono (NPC) cinza. Os pinos de viagem ligados entre andares diferentes
 * viram POÇOS: uma coluna por nome de pino, do andar mais baixo ao mais alto
 * que ela liga. Lógica pura: nada disto vai para o jogador.
 */

/** O mínimo de uma cena da lista Cenas que o corte precisa. */
export interface CorteCena {
  id: string
  name: string
  /** Cena de fora (pasta); ausente = primeiro nível, ou seja, um andar. */
  parentId?: string
  available: boolean
  active: boolean
}

/** O mínimo de um jogador da sala: quem é, onde a sessão o vê e quais fichas são dele. */
export interface CorteJogador {
  playerId: string
  name: string
  connected: boolean
  tokenIds: readonly string[]
  /** Cena do jogador; o pedido de passagem pendente acende o ponto dele nesta cena. */
  sceneId: string | null
  travelPending: boolean
}

export type TipoDoPonto = 'jogador' | 'npc'

export interface PontoDoCorte {
  chave: string
  tokenId: string
  sceneId: string
  tipo: TipoDoPonto
  /** Nome do jogador, ou o nome de trabalho da ficha sem dono. */
  nome: string
  /** `#rrggbb` da ficha do jogador; `null` = NPC (ponto cinza). */
  cor: string | null
  /** Sala mais funda onde a ficha está; `null` = fora de qualquer sala. */
  sala: string | null
  x: number
  y: number
  /** Pedido de passagem desse jogador esperando o mestre. */
  pedido: boolean
  conectado: boolean
}

export interface CenaDoCorte {
  id: string
  nome: string
  ativa: boolean
  /** `false` = o arquivo da cena não abriu: sem mapa, sem pontos. */
  disponivel: boolean
  pontos: PontoDoCorte[]
}

export interface AndarDoCorte {
  /** Id da cena de primeiro nível que dá nome ao andar. */
  id: string
  nome: string
  /** 1 = o andar de baixo (o primeiro da lista). */
  numero: number
  cenas: CenaDoCorte[]
}

export interface PocoDoCorte {
  chave: string
  nome: string
  /** Andar mais baixo e mais alto que o poço liga (`AndarDoCorte.numero`). */
  de: number
  ate: number
}

export interface CorteDaTorre {
  /** Do andar de cima para o de baixo: a ordem em que a janela os empilha. */
  andares: AndarDoCorte[]
  /** Por nome, em ordem alfabética: a ordem das colunas. */
  pocos: PocoDoCorte[]
}

/**
 * Os jogadores da sala como o corte os lê. Só quem está JOGANDO tem ficha em
 * cena (a mesma regra do Grupo, `lib/party.ts`): quem ainda espera ficha não
 * pinta ponto nenhum.
 */
export function jogadoresDoCorte(players: readonly PlayerInfo[]): CorteJogador[] {
  return players
    .filter((player) => player.status === 'playing')
    .map((player) => ({
      playerId: player.playerId,
      name: player.name,
      connected: player.connected,
      tokenIds: player.tokenIds,
      sceneId: player.sceneId ?? null,
      travelPending: player.travelPending === true,
    }))
}

/** Nome de ficha vazio vira este, para o ponto nunca ficar sem nome acessível. */
export const FICHA_SEM_NOME = 'Ficha sem nome'

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

function salaDoPonto(map: MapData, x: number, y: number): string | null {
  const nome = findContainingRoom(map.regions, [{ x, y }])?.room?.name.trim() ?? ''
  return nome === '' ? null : nome
}

function pontosDaCena(sceneId: string, map: MapData, donos: ReadonlyMap<string, CorteJogador>): PontoDoCorte[] {
  return map.tokens.map((token) => {
    const dono = donos.get(token.id)
    const base = { chave: `${sceneId}:${token.id}`, tokenId: token.id, sceneId, sala: salaDoPonto(map, token.x, token.y), x: token.x, y: token.y }
    if (dono === undefined) {
      const nome = token.name.trim()
      return { ...base, tipo: 'npc', nome: nome === '' ? FICHA_SEM_NOME : nome, cor: null, pedido: false, conectado: false }
    }
    return {
      ...base,
      tipo: 'jogador',
      nome: dono.name,
      cor: cssColor(tokenFillColor(token)),
      pedido: dono.travelPending && dono.sceneId === sceneId,
      conectado: dono.connected,
    }
  })
}

/** O andar de cada cena: o id da cena de primeiro nível acima dela na árvore. */
function andarDeCadaCena(cenas: readonly CorteCena[]): { andares: CorteCena[]; andarDe: Map<string, string>; ordem: string[] } {
  const andarDe = new Map<string, string>()
  const andares: CorteCena[] = []
  const ordem: string[] = []
  let atual: string | null = null
  // A árvore em profundidade põe cada pasta seguida das de dentro: a última de nível 0 vista é o andar.
  for (const row of sceneTree(cenas)) {
    if (row.depth === 0) {
      atual = row.entry.id
      andares.push(row.entry)
    }
    if (atual !== null) andarDe.set(row.entry.id, atual)
    ordem.push(row.entry.id)
  }
  return { andares, andarDe, ordem }
}

function pocosEntreAndares(
  cenas: readonly CorteCena[],
  maps: ReadonlyMap<string, MapData>,
  numeroDaCena: (sceneId: string) => number | undefined,
): PocoDoCorte[] {
  const nomes = new Map(cenas.map((cena) => [cena.id, cena.name]))
  const sceneById = (sceneId: string): TravelScene | null => {
    const nome = nomes.get(sceneId)
    return nome === undefined ? null : { name: nome, map: maps.get(sceneId) ?? null }
  }
  const porChave = new Map<string, PocoDoCorte>()
  for (const cena of cenas) {
    const map = maps.get(cena.id)
    const aqui = numeroDaCena(cena.id)
    if (map === undefined || aqui === undefined) continue
    for (const pin of map.pins) {
      for (const saida of travelExitsOf(pin)) {
        const travel = resolvePinTravel(pin, cena.id, sceneById, saida.id)
        if (travel.status !== 'ligado') continue
        const la = numeroDaCena(travel.sceneId)
        if (la === undefined || la === aqui) continue
        const nome = pinSummary(pin)
        const chave = nome.toLocaleLowerCase('pt-BR')
        const antes = porChave.get(chave)
        const de = Math.min(aqui, la, antes?.de ?? Infinity)
        const ate = Math.max(aqui, la, antes?.ate ?? -Infinity)
        porChave.set(chave, { chave, nome: antes?.nome ?? nome, de, ate })
      }
    }
  }
  return Array.from(porChave.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Monta o corte a partir da lista Cenas, dos mapas que abriram e dos jogadores da sala (vazio = sala fechada). */
export function corteDaTorre(cenas: readonly CorteCena[], maps: ReadonlyMap<string, MapData>, jogadores: readonly CorteJogador[]): CorteDaTorre {
  const donos = new Map<string, CorteJogador>()
  for (const jogador of jogadores) for (const tokenId of jogador.tokenIds) donos.set(tokenId, jogador)

  const { andares, andarDe, ordem } = andarDeCadaCena(cenas)
  const numeroDoAndar = new Map(andares.map((andar, index) => [andar.id, index + 1]))
  const numeroDaCena = (sceneId: string): number | undefined => {
    const andar = andarDe.get(sceneId)
    return andar === undefined ? undefined : numeroDoAndar.get(andar)
  }
  const porId = new Map(cenas.map((cena) => [cena.id, cena]))

  const montados: AndarDoCorte[] = andares.map((andar, index) => {
    const cenasDoAndar: CenaDoCorte[] = []
    for (const id of ordem) {
      const cena = porId.get(id)
      if (cena === undefined || andarDe.get(id) !== andar.id) continue
      const map = cena.available ? maps.get(id) : undefined
      cenasDoAndar.push({
        id,
        nome: cena.name,
        ativa: cena.active,
        disponivel: cena.available,
        pontos: map === undefined ? [] : pontosDaCena(id, map, donos),
      })
    }
    return { id: andar.id, nome: andar.name, numero: index + 1, cenas: cenasDoAndar }
  })

  return { andares: montados.reverse(), pocos: pocosEntreAndares(cenas, maps, numeroDaCena) }
}

/** Nome acessível (e dica ao passar o mouse) do ponto: quem, a sala e a cena, mais o que pede atenção. */
export function rotuloDoPonto(ponto: Pick<PontoDoCorte, 'tipo' | 'nome' | 'sala' | 'pedido' | 'conectado'>, nomeDaCena: string): string {
  const partes = [ponto.nome, ponto.sala ?? 'fora de sala', nomeDaCena]
  if (ponto.pedido) partes.push('pedido de passagem')
  if (ponto.tipo === 'jogador' && !ponto.conectado) partes.push('fora')
  return partes.join(', ')
}
