import { agilidadesDasCartas, inserirCarta, novaCarta, type CartaDaOrdem, type TurnosDaCena } from '../batalha/turnos'
import type { EscolhaDeCompanionsParaJogador, EstadoParaJogador } from '../batalha/vistaDoJogador'
import { ehRefDeMidia } from '../midia'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { gruposParaEscolha, temCompanionsParaEscolher } from './companions'
import { gruposDeCompanion, type CompanionNaBatalha } from './tipos'

/**
 * COMPANION NA ORDEM (PLANO-COMPANION.md, fatia 3): a regra pura que a store
 * usa no Iniciar e quando o dono escolhe quem vai. Sem store, sem mapa.
 */

/**
 * O dono com os grupos de companion que valem na batalha: os dele; a cópia
 * numerada ("Rei Lazaro 2") que nasceu ANTES de o modelo ganhar companion
 * (a variação não recebe `caracteristicas` do modelo) usa os do modelo.
 * Conserto de 27/11/2026 ("coloquei no Rei Lazaro 3 companions, cadê eles?").
 */
export function fichaComOsCompanions(dono: Personagem, personagens: readonly Personagem[]): Personagem {
  const modeloId = dono.combate?.modeloId
  if (modeloId === undefined || gruposDeCompanion(dono.caracteristicas).length > 0) return dono
  const doModelo = gruposDeCompanion(personagens.find((personagem) => personagem.id === modeloId)?.caracteristicas)
  return doModelo.length === 0 ? dono : { ...dono, caracteristicas: [...(dono.caracteristicas ?? []), ...doModelo] }
}

/** Os personagens com carta própria na ordem (sem carta extra nem bando), sem repetir, na ordem das cartas. */
function personagensComCartaPropria(cartas: readonly CartaDaOrdem[], personagens: readonly Personagem[]): Personagem[] {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const vistos: Personagem[] = []
  for (const carta of cartas) {
    if (carta.personagemId === null || carta.extra !== undefined || carta.bando !== undefined) continue
    const personagem = porId.get(carta.personagemId)
    if (personagem !== undefined && !vistos.includes(personagem)) vistos.push(personagem)
  }
  return vistos
}

/** Os donos que escolhem quem vai: personagem com carta própria na ordem e algum companion que exista. Sem repetir, na ordem das cartas. */
export function donosQueEscolhem(cartas: readonly CartaDaOrdem[], personagens: readonly Personagem[]): string[] {
  return personagensComCartaPropria(cartas, personagens)
    .filter((dono) => temCompanionsParaEscolher(fichaComOsCompanions(dono, personagens), personagens))
    .map((dono) => dono.id)
}

/** "Os companions de Rei Lazaro não têm ficha: ligue de novo na ficha." */
export function motivoSemFichaDosCompanions(nome: string): string {
  return `Os companions de ${nome} não têm ficha: ligue de novo na ficha.`
}

/**
 * Os donos da ordem com um grupo de companion cujas fichas ligadas foram
 * TODAS apagadas do livro (conserto de 27/11/2026): esse grupo não entra na
 * escolha, e a mesa mostra o motivo em vez de nada.
 */
export function donosSemFichaDosCompanions(cartas: readonly CartaDaOrdem[], personagens: readonly Personagem[]): Personagem[] {
  const ids = new Set(personagens.map((personagem) => personagem.id))
  return personagensComCartaPropria(cartas, personagens).filter((dono) =>
    gruposDeCompanion(fichaComOsCompanions(dono, personagens).caracteristicas).some((grupo) => grupo.ligados.length > 0 && !grupo.ligados.some((ligado) => ids.has(ligado.personagemId))),
  )
}

/**
 * "Incluir combatente" no meio da batalha (conserto de 27/11/2026): o dono que
 * acabou de entrar pelo token `tokenId` também escolhe quem vai, como no
 * Iniciar. `null` = não tem companion, já está escolhendo, ou já levou os dele.
 */
export function donoQueEntrouEscolhe(turnos: Pick<TurnosDaCena, 'cartas' | 'companions' | 'escolhendoCompanions'>, tokenId: string, personagens: readonly Personagem[]): string | null {
  const [dono] = donosQueEscolhem(turnos.cartas.filter((carta) => carta.tokenId === tokenId), personagens)
  if (dono === undefined || (turnos.escolhendoCompanions ?? []).includes(dono)) return null
  return (turnos.companions ?? []).some((companion) => companion.donoPersonagemId === dono) ? null : dono
}

/**
 * Onde a carta nova entra: depois da última carta de Agilidade maior ou
 * igual (a ordem do Iniciar é a maior Agilidade primeiro; no empate, quem já
 * estava fica antes).
 */
export function indicePelaAgilidade(cartas: readonly CartaDaOrdem[], agilidades: ReadonlyMap<string, number>, agilidade: number): number {
  let indice = 0
  cartas.forEach((carta, posicao) => {
    if ((agilidades.get(carta.id) ?? 0) >= agilidade) indice = posicao + 1
  })
  return indice
}

/** Um companion que entra: o token dele (novo ou o que já estava no mapa) e o nome da carta. */
export interface CompanionQueEntra {
  companion: CompanionNaBatalha
  nome: string
}

/**
 * A ordem com os companions que entram: cada um com carta própria, posta
 * pela Agilidade (token que já tem carta não ganha outra), a lista
 * `companions` e o dono fora de `escolhendoCompanions`. Devolve as cartas novas.
 */
export function comCompanionsNaOrdem(
  turnos: TurnosDaCena,
  donoPersonagemId: string,
  entram: readonly CompanionQueEntra[],
  personagens: readonly Personagem[],
  sistema: SistemaDeRpg | null,
): { turnos: TurnosDaCena; cartas: CartaDaOrdem[] } {
  const escolhendo = (turnos.escolhendoCompanions ?? []).filter((id) => id !== donoPersonagemId)
  const { escolhendoCompanions: _antes, ...semEscolha } = turnos
  let novos: TurnosDaCena = escolhendo.length === 0 ? semEscolha : { ...semEscolha, escolhendoCompanions: escolhendo }
  const cartas: CartaDaOrdem[] = []
  for (const { companion, nome } of entram) {
    if (novos.cartas.some((carta) => carta.tokenId === companion.tokenId)) continue
    const carta = novaCarta(companion.tokenId, companion.personagemId, nome)
    const comCarta: TurnosDaCena = { ...novos, cartas: [...novos.cartas, carta] }
    const agilidades = agilidadesDasCartas(comCarta.cartas, personagens, sistema)
    const agilidade = agilidades.get(carta.id) ?? 0
    agilidades.delete(carta.id)
    novos = inserirCarta(novos, carta, indicePelaAgilidade(novos.cartas, agilidades, agilidade))
    cartas.push(carta)
  }
  const ja = new Set((novos.companions ?? []).map((companion) => companion.tokenId))
  const companions = [...(novos.companions ?? []), ...entram.map(({ companion }) => companion).filter((companion) => !ja.has(companion.tokenId))]
  return { turnos: companions.length === 0 ? novos : { ...novos, companions }, cartas }
}

/**
 * O recorte do jogador com o que é de companion (o host chama depois de
 * `vistaParaJogador`): as escolhas que esperam ESTE jogador (só dos
 * personagens dele de verdade) e o "Companion de Aira" em cada carta de
 * companion. O retrato do NPC só vai como referência de mídia (curta).
 */
export function comCompanionsNaVista(
  estado: EstadoParaJogador,
  turnos: Pick<TurnosDaCena, 'companions' | 'escolhendoCompanions'>,
  meusPersonagens: ReadonlySet<string>,
  personagens: readonly Personagem[],
  sistema: SistemaDeRpg | null,
): EstadoParaJogador {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const escolhas: EscolhaDeCompanionsParaJogador[] = []
  for (const donoId of turnos.escolhendoCompanions ?? []) {
    const dono = porId.get(donoId)
    if (dono === undefined || !meusPersonagens.has(donoId)) continue
    const grupos = gruposParaEscolha(fichaComOsCompanions(dono, personagens), personagens, sistema).map((grupo) => ({ ...grupo, opcoes: grupo.opcoes.map((opcao) => ({ ...opcao, retrato: ehRefDeMidia(opcao.retrato) ? opcao.retrato : null })) }))
    if (grupos.length > 0) escolhas.push({ donoPersonagemId: dono.id, donoNome: dono.nome, grupos })
  }
  const companions = turnos.companions ?? []
  if (escolhas.length === 0 && companions.length === 0) return estado
  const cartas = companions.length === 0 ? estado.cartas : estado.cartas.map((carta) => {
    const companion = companions.find((candidato) => candidato.tokenId === carta.tokenId)
    const dono = companion === undefined ? undefined : porId.get(companion.donoPersonagemId)
    return dono === undefined ? carta : { ...carta, companionDe: dono.nome }
  })
  return escolhas.length === 0 ? { ...estado, cartas } : { ...estado, cartas, companions: escolhas }
}

/** O companion de um token na batalha; `null` = não é companion. */
export function companionDoToken(turnos: Pick<TurnosDaCena, 'companions'>, tokenId: string): CompanionNaBatalha | null {
  return turnos.companions?.find((companion) => companion.tokenId === tokenId) ?? null
}

/** Os tokens dos companions de qualquer um destes donos (o host soma às fichas do jogador, só na batalha). */
export function tokensDosCompanionsDe(turnos: Pick<TurnosDaCena, 'companions'> | null | undefined, donos: ReadonlySet<string>): string[] {
  return (turnos?.companions ?? []).filter((companion) => donos.has(companion.donoPersonagemId)).map((companion) => companion.tokenId)
}
