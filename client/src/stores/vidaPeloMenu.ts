import { valorDaParte, type Ajuste } from '../lib/ajusteDaFicha'
import { curaComOsSelos, notaDosSelosNaCura } from '../lib/batalha/condicoes'
import type { RecursoDoSistema, SistemaDeRpg } from '../lib/sistemaDeRpg'
import { recursoDeVida } from '../lib/vidaDaFicha'
import { fichasComVidaDosTokens, type FichaComVida } from '../lib/vidaPeloMenu'
import { personagensAtivos, sistemaAtivo, useAdventureStore } from './adventureStore'
import { ajustarFichaComoMestre, gravarAjusteDoMestre } from './ajusteDoMestre'
import { cenasComOPersonagem } from './batalha/cena'
import { useBatalhaStore } from './batalhaStore'
import { useMapStore } from './mapStore'
import { sistemaPorId, useRpgStore } from './rpgStore'
import { useToastStore } from './toastStore'

/**
 * "VIDA ›" DO BOTÃO DIREITO (pedido de 25/11/2026): tirar e dar vida às
 * fichas selecionadas sem abrir a ficha. Cada ficha vai pelo ajuste rápido do
 * mestre (`stores/ajusteDoMestre.ts`): na batalha, o dano é o "Dar dano" dela
 * (Escudo, redução, registro com Desfazer, queda) e a cura sai cortada pelos
 * selos dela (Cura reduzida) e vira linha "ficha" no registro; fora da
 * batalha, o número muda na ficha e o aviso traz UM Desfazer para todas.
 */

export type SentidoDaVida = 'tirar' | 'dar'

/** O sistema da aventura e o recurso de vida dele; `null` = sem sistema ou sem vida com máximo. */
export function vidaDoSistemaAberto(): { sistema: SistemaDeRpg; recurso: RecursoDoSistema } | null {
  const sistema = sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(useAdventureStore.getState()))
  if (sistema === undefined) return null
  const recurso = recursoDeVida(sistema)
  return recurso === null ? null : { sistema, recurso }
}

/** Uma ficha que mudou fora da batalha: o Desfazer volta dela. */
interface VoltaDaVida {
  personagemId: string
  nome: string
  de: number
  para: number
}

/** A primeira batalha com a ficha na ordem: os selos dela cortam a cura. */
function curaNaBatalha(personagemId: string, quanto: number): { cura: number; nota: string } | null {
  const [daBatalha] = cenasComOPersonagem(useBatalhaStore.getState().cenas, personagemId)
  const tokenId = daBatalha?.tokenIds[0]
  if (daBatalha === undefined || tokenId === undefined) return null
  const { selos } = daBatalha.cena.turnos
  return { cura: curaComOsSelos(quanto, selos, tokenId), nota: notaDosSelosNaCura(selos, tokenId) }
}

function avisar(recurso: RecursoDoSistema, sentido: SentidoDaVida, quanto: number, voltas: readonly VoltaDaVida[], naBatalha: readonly string[], notas: ReadonlySet<string>, sistema: SistemaDeRpg): void {
  const partes: string[] = []
  const [uma] = voltas
  if (voltas.length === 1 && uma !== undefined) partes.push(`${uma.nome}: ${recurso.nome} ${uma.de} → ${uma.para}`)
  else if (voltas.length > 1) partes.push(`${voltas.length} fichas: ${sentido === 'tirar' ? '−' : '+'}${quanto} ${recurso.nome}`)
  const [primeiraNaBatalha] = naBatalha
  if (naBatalha.length === 1 && primeiraNaBatalha !== undefined) partes.push(`${primeiraNaBatalha} no registro da batalha`)
  else if (naBatalha.length > 1) partes.push(`${naBatalha.length} fichas no registro da batalha`)
  for (const nota of notas) partes.push(`cura cortada${nota}`)
  if (partes.length === 0) {
    useToastStore.getState().push('info', sentido === 'dar' ? `Nada mudou: ${recurso.nome} já está no máximo.` : 'Nada mudou.')
    return
  }
  const texto = `${partes.join('; ')}.`
  if (voltas.length === 0) {
    useToastStore.getState().push('info', texto)
    return
  }
  // Um Desfazer para todas as fichas de fora da batalha. Com `de`, o que mudou no meio (um golpe, o jogador) fica.
  const desfazer = () => {
    for (const volta of voltas) gravarAjusteDoMestre(volta.personagemId, sistema, [{ parte: 'recurso', chave: recurso.id, valor: volta.de, de: volta.para }])
  }
  useToastStore.getState().push('info', texto, undefined, { actions: [{ label: 'Desfazer', run: desfazer }] })
}

/**
 * Tira ou dá `quanto` de vida em cada ficha ligada aos tokens `tokenIds` (a
 * mesma ficha uma vez só) e avisa o mestre. `false` = nenhuma ficha com vida
 * (o aviso diz por quê).
 */
export function mudarVidaDosTokens(tokenIds: readonly string[], sentido: SentidoDaVida, quanto: number): boolean {
  const daVida = vidaDoSistemaAberto()
  if (daVida === null) {
    useToastStore.getState().push('error', 'O sistema de RPG desta aventura não tem vida com máximo.')
    return false
  }
  const { sistema, recurso } = daVida
  const fichas: FichaComVida[] = fichasComVidaDosTokens(tokenIds, useMapStore.getState().map.tokens, personagensAtivos(useAdventureStore.getState()), recurso)
  if (fichas.length === 0) {
    useToastStore.getState().push('error', 'Nenhum token selecionado tem ficha com vida.')
    return false
  }
  const voltas: VoltaDaVida[] = []
  const naBatalha: string[] = []
  const notas = new Set<string>()
  for (const ficha of fichas) {
    // Relida a cada ficha: o dano da anterior pode ter mexido nesta (a mesma batalha, a queda).
    const personagem = personagensAtivos(useAdventureStore.getState()).find((candidato) => candidato.id === ficha.personagemId)
    if (personagem === undefined) continue
    const agora = valorDaParte(personagem, 'recurso', recurso.id)
    const daBatalha = sentido === 'dar' ? curaNaBatalha(personagem.id, quanto) : null
    if (daBatalha !== null && daBatalha.nota !== '') notas.add(daBatalha.nota)
    const passo = sentido === 'tirar' ? -quanto : (daBatalha?.cura ?? quanto)
    const ajuste: Ajuste = { parte: 'recurso', chave: recurso.id, valor: agora + passo, de: agora }
    const feito = ajustarFichaComoMestre(personagem.id, sistema, ajuste)
    if (feito === 'batalha') {
      naBatalha.push(ficha.nome)
      continue
    }
    if (!feito.gravou || feito.mudou === null) continue
    // Na batalha, a linha "ficha" do registro já traz o Desfazer: o aviso não oferece um segundo.
    if (cenasComOPersonagem(useBatalhaStore.getState().cenas, personagem.id).length > 0) {
      naBatalha.push(ficha.nome)
      continue
    }
    voltas.push({ personagemId: personagem.id, nome: ficha.nome, de: valorDaParte(feito.mudou.antes, 'recurso', recurso.id), para: valorDaParte(feito.mudou.depois, 'recurso', recurso.id) })
  }
  avisar(recurso, sentido, quanto, voltas, naBatalha, notas, sistema)
  return true
}
