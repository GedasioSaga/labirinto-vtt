import { useStore, type StoreApi, type UseBoundStore } from 'zustand'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import type { PonteDaBatalha } from '../lib/batalha/ponte'
import { secureRollDie } from '../lib/dice'
import { useBatalhaDBTStore } from './batalhaDBTStore'
import {
  criarBatalhaStore as criarBatalhaStoreComDependencias,
  esperandoOMestre as esperandoOMestreNaMesa,
  type BatalhaState,
  type DependenciasDaBatalha,
  type LojaDaBatalha as LojaSemReact,
} from './batalhaFabrica'
import { mesaDaAventura } from './mesaDaAventura'

/**
 * A batalha One Piece da mesa de verdade. LOBBY v2, fatia T1
 * (docs/planos/lobby-jogadores-2026-11-05.md §8.2): a regra inteira mora na
 * fábrica (`stores/batalhaFabrica.ts`, sem Tauri); aqui só se instancia com o
 * d20 seguro e a store DBT, e se reexporta o que o App, o host, a arena e as
 * telas já importavam daqui.
 *
 * A fábrica devolve a store vanilla do zustand (sem React, para caber no
 * Worker do Lobby); o hook `useBatalhaStore(seletor)` que o App e a arena usam
 * nasce AQUI, embrulhando-a com o `useStore` (`comHookDoReact`).
 */

export {
  deveAvisarJogadores,
  efeitosDaCena,
  judgeDaCena,
  vezTokenIdDaCena,
} from './batalhaFabrica'
export type {
  AberturaDaBatalha,
  AjusteDaColocacao,
  AnuncioDaBatalha,
  BatalhaDaCena,
  BatalhaState,
  DependenciasDaBatalha,
  InicioDaBatalha,
  OndeNasceOInvocado,
} from './batalhaFabrica'

/** Uma store de batalha COM o hook do React: a da mesa de verdade e a da arena (a do treino é a `LojaDaBatalha` da fábrica, sem hook). */
export type LojaDaBatalha = UseBoundStore<StoreApi<BatalhaState>>

const LADOS_DO_D20 = 20

/** O seletor do hook chamado sem seletor: o estado inteiro (o `identity` do `create` do zustand). */
const estadoInteiro = (state: BatalhaState): BatalhaState => state

/** Prende o hook do React à store vanilla da fábrica: o mesmo que o `create` do zustand faz por dentro. */
function comHookDoReact(loja: LojaSemReact): LojaDaBatalha {
  function useLoja(): BatalhaState
  function useLoja<U>(seletor: (state: BatalhaState) => U): U
  function useLoja<U>(seletor?: (state: BatalhaState) => U): BatalhaState | U {
    // Os argumentos de tipo explícitos juntam as duas saídas: a inferência pegaria só a do primeiro seletor.
    return useStore<LojaSemReact, BatalhaState | U>(loja, seletor ?? estadoInteiro)
  }
  return Object.assign(useLoja, loja)
}

/** O que a mesa de verdade (e a arena) dá à fábrica: o d20 seguro e a batalha DBT da mesa. */
const DEPENDENCIAS_DA_MESA: DependenciasDaBatalha = {
  rolarD20: () => secureRollDie(LADOS_DO_D20),
  // BATALHA DBT: a mesma cena nunca fica nas duas batalhas.
  outraBatalhaLigada: (sceneKey) => useBatalhaDBTStore.getState().ligada(sceneKey),
}

/**
 * Uma store de batalha nova sobre `mesa`, com o d20 seguro e a store DBT da
 * mesa (o que a arena usa: `stores/arenaStore.ts`). O treino chama a fábrica
 * direto, com o d20 da semente.
 */
export function criarBatalhaStore(mesa: MesaDaBatalha): LojaDaBatalha {
  return comHookDoReact(criarBatalhaStoreComDependencias(mesa, DEPENDENCIAS_DA_MESA))
}

/** A batalha da mesa de verdade (aventura ou pasta): a que o App, o host e a ponte usam. */
export const useBatalhaStore: LojaDaBatalha = criarBatalhaStore(mesaDaAventura)

/**
 * A ponte que o host usa (S1: `App.tsx` a passa às duas pontes como
 * `ponteDaBatalha`). Lê e muda pela store; o host já validou quem pede.
 */
export const ponteDaBatalha: PonteDaBatalha = {
  cena: (sceneKey) => useBatalhaStore.getState().cenas[sceneKey] ?? null,
  passarVez: (sceneKey, autor, esperado) => useBatalhaStore.getState().passarVez(sceneKey, autor, esperado),
  desfazer: (sceneKey, linhaId, autor) => useBatalhaStore.getState().desfazer(sceneKey, linhaId, autor),
  registrarAjuste: (personagemId, antes, depois, autor) => useBatalhaStore.getState().registrarAjuste(personagemId, antes, depois, autor),
  agir: (sceneKey, autor, vez, pedido) => useBatalhaStore.getState().agir(sceneKey, autor, vez, pedido),
  reagir: (sceneKey, autor, pedido) => useBatalhaStore.getState().reagir(sceneKey, autor, pedido),
  darDano: (sceneKey, autor, tokenId, valor) => useBatalhaStore.getState().darDano(sceneKey, autor, tokenId, valor),
  escolherArmas: (sceneKey, autor, personagemId, armas) => useBatalhaStore.getState().escolherArmas(sceneKey, autor, personagemId, armas),
  zerarCarga: (sceneKey, autor, personagemId) => useBatalhaStore.getState().zerarCarga(sceneKey, autor, personagemId),
  passiva: (sceneKey, autor, pedido) => useBatalhaStore.getState().passiva(sceneKey, autor, pedido),
  evoluir: (sceneKey, autor, pedido) => useBatalhaStore.getState().evoluir(sceneKey, autor, pedido),
  invocar: (sceneKey, autor, pedido) => useBatalhaStore.getState().invocar(sceneKey, autor, pedido),
  marcar: (sceneKey, autor, pedido) => useBatalhaStore.getState().marcar(sceneKey, autor, pedido),
  ajustar: (sceneKey, autor, pedido) => useBatalhaStore.getState().ajustar(sceneKey, autor, pedido),
  contador: (sceneKey, autor, pedido) => useBatalhaStore.getState().contador(sceneKey, autor, pedido),
}

/**
 * S9 (Q7): o contador do marcador Batalha no livro da mesa (regra em
 * `esperandoOMestre` da fábrica). `mesa` ausente = a de verdade (a arena
 * passa a dela).
 */
export function esperandoOMestre(state: Pick<BatalhaState, 'cenas'>, sceneKey: string | null, mesa: MesaDaBatalha = mesaDaAventura): number {
  return esperandoOMestreNaMesa(state, sceneKey, mesa)
}
