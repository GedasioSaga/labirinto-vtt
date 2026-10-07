import type { PlayerInfo } from '../net/hostSession'
import { normalizeForSearch } from './mapObjects'
import { offlineForLabel, type PartyMember } from './party'

/**
 * O GRUPO POR CENA (aba Jogo): a mesa inteira em grupos, um por cena, cada
 * jogador numa linha curta. Lógica pura: lê o que o painel já recebe
 * (`PlayerInfo` da sala e `PartyMember` do Grupo) e devolve a ordem em que o
 * mestre lê. Com 10 jogadores, o pedido de alguém não some no meio da lista:
 * a busca e o filtro "Pedindo" vêm daqui.
 */

/** Um jogador na lista: o que a sala sabe dele e, com aventura ou câmera, a linha do Grupo. */
export interface LinhaDoGrupo {
  player: PlayerInfo
  /** Ausente quando o painel foi montado sem o `party` (sem mundo para ler). */
  member: PartyMember | undefined
  /** O nome do personagem (a ficha da linha, ou a primeira dele); `null` = sem ficha. */
  personagem: string | null
}

/** Uma cena com gente: o título recolhível e as linhas, na ordem de chegada. */
export interface GrupoDeCena {
  /** `null` = sem cena de aventura: o mapa solto, ou quem não está em cena nenhuma. */
  sceneId: string | null
  nome: string
  linhas: LinhaDoGrupo[]
}

export interface GrupoPorCena {
  /** Quem entrou e espera personagem: o grupo "Chegando", no topo e aberto. */
  chegando: LinhaDoGrupo[]
  grupos: GrupoDeCena[]
}

/** Uma cena da lista Cenas, na ordem da aventura. */
export interface CenaNaOrdem {
  id: string
  name: string
}

export interface OpcoesDoGrupo {
  /** A cena aberta no editor; `null` = mapa solto (sem aventura). */
  cenaAberta: string | null
  /** As cenas na ordem da lista Cenas: é dela que sai a ordem dos grupos e o nome de cada um. */
  ordemDasCenas: readonly CenaNaOrdem[]
  /** Nome do grupo de quem não tem cena no mapa solto: o do mapa. */
  nomeDoMapa?: string
  /** Id da ficha → nome: o personagem da linha e a busca por ele. */
  nomesDasFichas?: ReadonlyMap<string, string>
  /** Texto da busca: casa o nome do jogador ou do personagem, sem acento nem maiúscula. */
  busca?: string
  /** Só quem pede algo ao mestre (`estaPendente`). */
  soPedindo?: boolean
}

/** O grupo de quem está sem cena numa aventura (caiu antes de ganhar ficha, ficha fora de toda cena). */
export const SEM_CENA_LABEL = 'Sem cena'
/** O grupo do mapa solto quando o mapa ainda não tem nome. */
export const MAPA_SEM_NOME_LABEL = 'Mapa'

/**
 * Quem está sem personagem AGORA, do outro lado, olhando uma tela parada. A
 * mesma regra do cartão aberto de antes: desconectado não conta, porque
 * fechou a aba e não espera nada.
 */
export function esperandoFicha(player: PlayerInfo): boolean {
  return player.status === 'waiting' && player.connected
}

/**
 * "Pendente" = algo dele espera o mestre: um pedido de passagem, a ficha que
 * ainda não ganhou, ou uma ficha dele que ficou noutra cena.
 */
export function estaPendente(player: PlayerInfo, member: PartyMember | undefined): boolean {
  if (esperandoFicha(player)) return true
  if (member?.travelPending === true || player.travelPending === true) return true
  return (member?.awayTokens?.length ?? 0) > 0
}

/** O personagem da linha: a ficha que o Grupo acha em cena ou, sem ela, a primeira que ele tem. */
export function personagemDe(player: PlayerInfo, member: PartyMember | undefined, nomesDasFichas?: ReadonlyMap<string, string>): string | null {
  const tokenId = member?.token?.id ?? player.tokenIds[0]
  if (tokenId === undefined) return null
  const nome = nomesDasFichas?.get(tokenId)?.trim()
  return nome === undefined || nome === '' ? null : nome
}

/** A busca casa qualquer trecho do nome do jogador ou do personagem, sem acento nem maiúscula. Vazia casa todos. */
export function casaBusca(linha: Pick<LinhaDoGrupo, 'player' | 'personagem'>, busca: string): boolean {
  const agulha = normalizeForSearch(busca.trim())
  if (agulha === '') return true
  return normalizeForSearch(linha.player.name).includes(agulha) || (linha.personagem !== null && normalizeForSearch(linha.personagem).includes(agulha))
}

/** Quantos pedem algo agora: o número do chip "Pedindo N" (sem busca nem filtro). */
export function contarPedindo(players: readonly PlayerInfo[], members: readonly PartyMember[] = []): number {
  const porId = new Map(members.map((member) => [member.playerId, member]))
  return players.filter((player) => estaPendente(player, porId.get(player.playerId))).length
}

/** A cena do jogador: a da linha do Grupo (quem caiu continua na cena da ficha) ou a da sala. */
function cenaDe(linha: LinhaDoGrupo): string | null {
  return linha.member?.sceneId ?? linha.player.sceneId ?? null
}

/** O nome que a sala dá à cena dele, para a cena que não está na lista. */
function nomeDaCenaDe(linha: LinhaDoGrupo): string | null {
  return linha.member?.sceneName ?? linha.player.sceneName ?? null
}

/**
 * Agrupa a mesa por cena. Ordem dos grupos: a cena aberta no editor, depois a
 * ordem da lista Cenas, depois as cenas fora da lista (na ordem em que
 * apareceram), e por último quem está sem cena — no mapa solto, um grupo só
 * com o nome do mapa. Dentro de cada grupo, a ordem de chegada. Cena sem
 * ninguém (ou sem ninguém que passe pela busca) não aparece.
 */
export function agruparPorCena(players: readonly PlayerInfo[], members: readonly PartyMember[] | undefined, opcoes: OpcoesDoGrupo): GrupoPorCena {
  const porId = new Map((members ?? []).map((member) => [member.playerId, member]))
  const busca = opcoes.busca ?? ''
  const linhas: LinhaDoGrupo[] = players
    .map((player) => {
      const member = porId.get(player.playerId)
      return { player, member, personagem: personagemDe(player, member, opcoes.nomesDasFichas) }
    })
    .filter((linha) => casaBusca(linha, busca) && (opcoes.soPedindo !== true || estaPendente(linha.player, linha.member)))

  const chegando = linhas.filter((linha) => esperandoFicha(linha.player))
  const porCena = new Map<string | null, LinhaDoGrupo[]>()
  for (const linha of linhas) {
    if (esperandoFicha(linha.player)) continue
    const sceneId = cenaDe(linha)
    const doGrupo = porCena.get(sceneId)
    if (doGrupo === undefined) porCena.set(sceneId, [linha])
    else doGrupo.push(linha)
  }

  const posicao = new Map(opcoes.ordemDasCenas.map((cena, indice) => [cena.id, indice]))
  const nomeNaLista = new Map(opcoes.ordemDasCenas.map((cena) => [cena.id, cena.name]))
  const chegada = [...porCena.keys()]
  const rank = (sceneId: string | null): number => {
    if (sceneId === null) return Number.MAX_SAFE_INTEGER
    if (sceneId === opcoes.cenaAberta) return -1
    // Fora da lista: depois de todas as da lista, na ordem em que apareceram.
    return posicao.get(sceneId) ?? opcoes.ordemDasCenas.length + chegada.indexOf(sceneId)
  }

  const grupos = [...chegada]
    .sort((a, b) => rank(a) - rank(b))
    .map((sceneId): GrupoDeCena => {
      const doGrupo = porCena.get(sceneId) ?? []
      return { sceneId, nome: nomeDoGrupo(sceneId, doGrupo, nomeNaLista, opcoes), linhas: doGrupo }
    })
  return { chegando, grupos }
}

function nomeDoGrupo(sceneId: string | null, linhas: readonly LinhaDoGrupo[], nomeNaLista: ReadonlyMap<string, string>, opcoes: OpcoesDoGrupo): string {
  if (sceneId === null) {
    if (opcoes.cenaAberta !== null) return SEM_CENA_LABEL
    const nomeDoMapa = opcoes.nomeDoMapa?.trim() ?? ''
    return nomeDoMapa === '' ? MAPA_SEM_NOME_LABEL : nomeDoMapa
  }
  const daLista = nomeNaLista.get(sceneId)
  if (daLista !== undefined) return daLista
  for (const linha of linhas) {
    const nome = nomeDaCenaDe(linha)
    if (nome !== null) return nome
  }
  return SEM_CENA_LABEL
}

/** O ponto de presença no avatar da linha. */
export type PresencaNaLinha = 'online' | 'fora' | 'volto-ja' | 'congelado'

/**
 * Volto já vem antes da conexão (saiu de propósito, não caiu); quem caiu vem
 * antes do congelado (a queda é o que o mestre precisa ver primeiro).
 */
export function presencaNaLinha(player: PlayerInfo, member: PartyMember | undefined): PresencaNaLinha {
  if (player.away === true || member?.away === true) return 'volto-ja'
  if (!player.connected) return 'fora'
  if (member?.congelado === true) return 'congelado'
  return 'online'
}

/** "fora 4 min", "fora 0:10": o selo de quem caiu; sem a hora da queda, só "fora". */
export function seloFora(player: PlayerInfo, now: number): string {
  if (player.disconnectedAt === undefined) return 'fora'
  return `fora ${offlineForLabel(now - player.disconnectedAt)}`
}

/** Toda ficha do grupo congelada (e há ao menos uma)? É o que vira "Descongelar a cena". */
export function cenaCongelada(linhas: readonly LinhaDoGrupo[]): boolean {
  const comFicha = linhas.filter((linha) => linha.member?.token != null)
  return comFicha.length > 0 && comFicha.every((linha) => linha.member?.congelado === true)
}

/**
 * As fichas que "Congelar a cena" segura: a da linha de cada jogador do grupo
 * e as que andam com ela (montaria, familiar). A que ficou noutra cena não.
 */
export function fichasDaCena(linhas: readonly LinhaDoGrupo[]): string[] {
  const ids: string[] = []
  for (const linha of linhas) {
    const token = linha.member?.token
    if (token == null) continue
    ids.push(token.id, ...(linha.member?.entourageIds ?? []))
  }
  return ids
}
