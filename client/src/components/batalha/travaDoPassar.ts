import { useMemo } from 'react'
import { create } from 'zustand'
import { contrasQueSeguramAVez, type TurnosDaCena } from '../../lib/batalha/turnos'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'
import { nomesNumerados } from './nomesNumerados'

/**
 * A TRAVA DO PASSAR A VEZ do mestre (One Piece), a mesma da mesa da batalha:
 * enquanto alguém deve um contra-ataque desta vez ou uma reação a um golpe,
 * nenhum "Passar a vez" do mestre anda (o painel do livro, a faixa do alto, o
 * menu da vez no meio do mapa). O mestre responde, ou usa o "Seguir sem
 * esperar" (o jogador que sumiu): a trava sai daqui e o pedido fica de pé até
 * ser respondido ou a rodada virar. A mesa da batalha tem o dela, na própria
 * tela (doca e janela à parte), com as mesmas frases.
 */

export interface TravaDoPassar {
  /** A mesma chave da mesa: `contra:<golpe>` ou `<golpe>|<token>`. */
  chave: string
  texto: string
}

/** O alvo que ainda deve a reação ao golpe (o mesmo filtro dos pedidos da mesa, `espelhoOP.pendentes`). */
export function deveAReacao(alvo: { danoFinal?: unknown; podeReagir: boolean }): boolean {
  return alvo.danoFinal === undefined && alvo.podeReagir
}

/** O que segura o Passar a vez agora, na ordem da mesa: o contra-ataque desta vez, depois as reações que esperam. */
export function travasDoPassar(turnos: TurnosDaCena, nomeDe: (tokenId: string) => string): TravaDoPassar[] {
  const travas: TravaDoPassar[] = contrasQueSeguramAVez(turnos).map((contra) => ({ chave: `contra:${contra.golpeId}`, texto: `Falta o contra-ataque de ${nomeDe(contra.tokenId)}.` }))
  for (const golpe of turnos.golpes ?? [])
    for (const alvo of golpe.alvos) if (deveAReacao(alvo)) travas.push({ chave: `${golpe.id}|${alvo.tokenId}`, texto: `Falta a reação de ${nomeDe(alvo.tokenId)}.` })
  return travas
}

/** As travas que o mestre deixou para depois nesta janela ("Seguir sem esperar"). */
const useDeixadas = create<{ chaves: ReadonlySet<string> }>(() => ({ chaves: new Set() }))

function deixar(travas: readonly TravaDoPassar[]): void {
  deixarParaDepois(travas.map((trava) => trava.chave))
}

/**
 * O "Seguir sem esperar" de qualquer tela do mestre (a mesa encostada ou na janela à parte, o menu da vez no meio do
 * mapa, o painel e a faixa): as chaves (`contra:<golpe>` ou `<golpe>|<ficha>`, as mesmas dos pendentes da mesa) ficam
 * para depois em todas, e o Passar a vez de cada uma volta a valer. O pedido segue de pé.
 */
export function deixarParaDepois(chaves: readonly string[]): void {
  if (chaves.length === 0) return
  useDeixadas.setState((antes) => ({ chaves: new Set([...antes.chaves, ...chaves]) }))
}

/** As chaves deixadas para depois agora (o espelho da mesa leva para a janela à parte). */
export function travasDeixadas(): ReadonlySet<string> {
  return useDeixadas.getState().chaves
}

/** Avisa quando o mestre deixa algo para depois (o espelho da mesa se refaz). */
export function ouvirDeixadas(ouvinte: () => void): () => void {
  return useDeixadas.subscribe(ouvinte)
}

/** As chaves deixadas para depois, para a tela (o menu da vez no meio do mapa). */
export function useTravasDeixadas(): ReadonlySet<string> {
  return useDeixadas((state) => state.chaves)
}

type Fichas = readonly { id: string; name: string }[]

function nomeNaCena(fichas: Fichas, rotulos: ReadonlyMap<string, string>, tokenId: string): string {
  const noMapa = fichas.find((ficha) => ficha.id === tokenId)?.name.trim()
  return (noMapa ? rotulos.get(tokenId) : undefined) || noMapa || 'Ficha'
}

function travasDe(turnos: TurnosDaCena, fichas: Fichas, deixadas: ReadonlySet<string>): TravaDoPassar[] {
  const rotulos = nomesNumerados(fichas.map((ficha) => ({ id: ficha.id, nome: ficha.name })))
  return travasDoPassar(turnos, (tokenId) => nomeNaCena(fichas, rotulos, tokenId)).filter((trava) => !deixadas.has(trava.chave))
}

/** A trava de agora, lida fora do React (o clique do Passar a vez); `null` = passa. */
export function travaDoPassarAgora(sceneKey: string): string | null {
  const cenas = useBatalhaStore.getState().cenas
  if (!Object.hasOwn(cenas, sceneKey)) return null
  return travasDe(cenas[sceneKey].turnos, useMapStore.getState().map.tokens, useDeixadas.getState().chaves)[0]?.texto ?? null
}

/** A trava para a tela: a frase (ou `null`) e o "Seguir sem esperar" (ausente sem trava). */
export function useTravaDoPassar(sceneKey: string): { trava: string | null; seguirSemEsperar: (() => void) | undefined } {
  const turnos = useBatalhaStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey].turnos : undefined))
  const fichas = useMapStore((state) => state.map.tokens)
  const deixadas = useDeixadas((state) => state.chaves)
  const travas = useMemo(() => (turnos === undefined ? [] : travasDe(turnos, fichas, deixadas)), [turnos, fichas, deixadas])
  const primeira = travas[0]
  return { trava: primeira?.texto ?? null, seguirSemEsperar: primeira === undefined ? undefined : () => deixar(travas) }
}
