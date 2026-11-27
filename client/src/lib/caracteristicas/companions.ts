import { agilidadeDe } from '../batalha/turnos'
import { ehInvocadoTemporario } from '../livros/combate'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { recursoDeVida, vidaDoPersonagem } from '../vidaDaFicha'
import { gruposDeCompanion, type Caracteristica, type CaracteristicaCompanion, type ModoDoCompanion } from './tipos'

/**
 * COMPANION (docs/design/caracteristicas/PLANO-COMPANION.md): a regra pura que
 * a ficha, a escolha do começo da batalha, a store e o host usam. Sem store,
 * sem rede.
 */

/** Uma ficha ligada como a escolha e a página a mostram. */
export interface OpcaoDeCompanion {
  personagemId: string
  nome: string
  retrato: string | null
  modo: ModoDoCompanion
  /** `null` = o sistema não tem vida (ou a ficha não tem máximo). */
  vida: { atual: number; maximo: number } | null
  agilidade: number
  /** HP 0: não entra na escolha ("Desmaiada: cure antes de levar"). */
  desmaiada: boolean
}

/** Um grupo na escolha de quem vai: as fichas que existem, e quem vem marcado. */
export interface GrupoNaEscolha {
  id: string
  nome: string
  limite: number
  opcoes: OpcaoDeCompanion[]
  /** Quem vem marcado: a última escolha (só quem está de pé), ou as primeiras de pé até o limite. */
  padrao: string[]
}

export const MOTIVO_DESMAIADA = 'Desmaiada: cure antes de levar'

/** "Já são 3. Desmarque um para trocar." */
export function motivoDoLimite(limite: number): string {
  return `Já são ${limite}. Desmarque um para trocar.`
}

let contador = 0
/** `carac_<tempo>_<n>`: único na ficha (o leitor recusa id repetido). */
export function novoIdDeCaracteristica(): string {
  contador += 1
  return `carac_${Date.now().toString(36)}_${contador.toString(36)}`
}

/** As fichas que podem ser ligadas como companion: NPC da aventura, não temporário (invocado da batalha), nem a própria. */
export function fichasQuePodemSerLigadas(dono: Personagem, personagens: readonly Personagem[]): Personagem[] {
  return personagens.filter((personagem) => personagem.id !== dono.id && personagem.tipo === 'npc' && !ehInvocadoTemporario(personagem))
}

/** A ficha ligada como a tela a mostra; `null` = a ficha não existe mais (apagada do livro). */
export function opcaoDoLigado(ligado: CaracteristicaCompanion['ligados'][number], porId: ReadonlyMap<string, Personagem>, sistema: SistemaDeRpg | null): OpcaoDeCompanion | null {
  const personagem = porId.get(ligado.personagemId)
  if (personagem === undefined) return null
  const recurso = recursoDeVida(sistema)
  const vida = recurso === null ? null : vidaDoPersonagem(personagem, recurso)
  return {
    personagemId: personagem.id,
    nome: personagem.nome,
    retrato: personagem.retrato,
    modo: ligado.modo,
    vida,
    agilidade: agilidadeDe(personagem, sistema),
    desmaiada: vida !== null && vida.atual <= 0,
  }
}

/** Os grupos do dono para a escolha do começo da batalha. Grupo sem ficha que exista não aparece. */
export function gruposParaEscolha(dono: Personagem, personagens: readonly Personagem[], sistema: SistemaDeRpg | null): GrupoNaEscolha[] {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const grupos: GrupoNaEscolha[] = []
  for (const grupo of gruposDeCompanion(dono.caracteristicas)) {
    const opcoes = grupo.ligados.map((ligado) => opcaoDoLigado(ligado, porId, sistema)).filter((opcao): opcao is OpcaoDeCompanion => opcao !== null)
    if (opcoes.length === 0) continue
    const dePe = opcoes.filter((opcao) => !opcao.desmaiada).map((opcao) => opcao.personagemId)
    const padrao = grupo.ultimaEscolha === undefined ? dePe.slice(0, grupo.limite) : grupo.ultimaEscolha.filter((id) => dePe.includes(id)).slice(0, grupo.limite)
    grupos.push({ id: grupo.id, nome: grupo.nome, limite: grupo.limite, opcoes, padrao })
  }
  return grupos
}

/** O dono tem alguém para escolher (algum grupo com ficha que exista)? */
export function temCompanionsParaEscolher(dono: Personagem, personagens: readonly Personagem[]): boolean {
  const ids = new Set(personagens.map((personagem) => personagem.id))
  return gruposDeCompanion(dono.caracteristicas).some((grupo) => grupo.ligados.some((ligado) => ids.has(ligado.personagemId)))
}

/**
 * Confere a escolha (a do jogador, que o host recebe, e a do mestre): cada id
 * num grupo do dono, sem repetir, nenhum desmaiado, e cada grupo no limite.
 * `null` = vale.
 */
export function motivoDaEscolha(grupos: readonly GrupoNaEscolha[], escolhidos: readonly string[]): string | null {
  if (new Set(escolhidos).size !== escolhidos.length) return 'A mesma ficha foi escolhida duas vezes.'
  for (const id of escolhidos) {
    const grupo = grupos.find((candidato) => candidato.opcoes.some((opcao) => opcao.personagemId === id))
    const opcao = grupo?.opcoes.find((candidata) => candidata.personagemId === id)
    if (grupo === undefined || opcao === undefined) return 'Essa ficha não é companion deste personagem.'
    if (opcao.desmaiada) return `${opcao.nome}: ${MOTIVO_DESMAIADA.toLocaleLowerCase('pt-BR')}.`
  }
  for (const grupo of grupos) {
    const doGrupo = escolhidos.filter((id) => grupo.opcoes.some((opcao) => opcao.personagemId === id)).length
    if (doGrupo > grupo.limite) return `${grupo.nome}: leva até ${grupo.limite}.`
  }
  return null
}

/** A ficha com a lista nova (vazia = a chave sai). */
export function comCaracteristicas(personagem: Personagem, lista: readonly Caracteristica[]): Personagem {
  if (lista.length > 0) return { ...personagem, caracteristicas: [...lista] }
  if (personagem.caracteristicas === undefined) return personagem
  const { caracteristicas: _antigas, ...sem } = personagem
  return sem
}

/** Grava em cada grupo quem foi desta vez (o padrão da próxima escolha). */
export function comUltimaEscolha(dono: Personagem, escolhidos: readonly string[]): Personagem {
  if (dono.caracteristicas === undefined) return dono
  const lista = dono.caracteristicas.map((caracteristica): Caracteristica => {
    if (caracteristica.tipo !== 'companion') return caracteristica
    const doGrupo = new Set(caracteristica.ligados.map((ligado) => ligado.personagemId))
    return { ...caracteristica, ultimaEscolha: escolhidos.filter((id) => doGrupo.has(id)) }
  })
  return { ...dono, caracteristicas: lista }
}

/** O grupo e o modo de uma ficha ligada ao dono; `null` = não é companion dele. */
export function grupoDoCompanion(dono: Personagem, personagemId: string): { grupo: CaracteristicaCompanion; modo: ModoDoCompanion } | null {
  for (const grupo of gruposDeCompanion(dono.caracteristicas)) {
    const ligado = grupo.ligados.find((candidato) => candidato.personagemId === personagemId)
    if (ligado !== undefined) return { grupo, modo: ligado.modo }
  }
  return null
}
