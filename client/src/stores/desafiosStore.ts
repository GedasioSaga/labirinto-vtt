import { create } from 'zustand'
import type { RegistroDoObjetoAberto } from '../net/objetoNoHost'
import type { GuardadoDoJogo } from '../lib/desafios'
import type { JogoDoMinigame } from '../minigames/tipos'

/**
 * A PÁGINA JOGOS do livro do mestre (desafios, 15/11/2026): qual desafio está
 * aberto na ficha da página, o "Marcar no mapa" em curso e os mapas cujo aviso
 * de migração ("N pinos ▷ viraram desafios") o mestre já dispensou. O resto
 * vale enquanto o app está aberto; o "Entendi" fica no aparelho, por mapa.
 */

/** O que o próximo clique no mapa marca: um ponto, ou o objeto clicado. */
export type ModoDeMarcar = 'ponto' | 'objeto'

/** A ESCOLHA DO JOGO aberta na página (editor de 21/11/2026, decisão 1): para um desafio novo, ou para trocar o jogo de um. */
export type EscolhaDoJogoAberta = { para: 'novo' } | { para: 'trocar'; id: string }

export const CHAVE_DOS_AVISOS_DISPENSADOS = 'lb-desafios-aviso-dispensado'

interface EstadoDosDesafios {
  /** O desafio aberto na ficha da página Jogos; `null` = a lista. */
  aberto: string | null
  /** "Marcar no mapa" / "Escolher no mapa" em curso: o próximo clique decide o lugar. */
  marcando: { id: string; modo: ModoDeMarcar } | null
  /**
   * No "Objeto", o último clique caiu fora de um objeto (B25 das NOTAS do editor): a ficha diz,
   * em vez de nada acontecer. Volta a `false` a cada marcação nova e ao parar.
   */
  cliqueForaDoObjeto: boolean
  /** "Novo desafio" ou "Trocar": a lista dos jogos no lugar da página; `null` = fechada. */
  escolhaDoJogo: EscolhaDoJogoAberta | null
  /**
   * TROCAR DE JOGO GUARDA (decisão 3 do editor): o que cada desafio tinha em cada jogo de antes, para
   * voltar igual. Só na memória, de propósito: a música importada é pesada, e o arquivo do mapa não muda.
   */
  guardados: Readonly<Record<string, Partial<Record<JogoDoMinigame, GuardadoDoJogo>>>>
  /** A última troca de jogo da ficha aberta: o aviso e o "Desfazer a troca". `null` = nenhuma. */
  trocaRecente: { id: string; de: JogoDoMinigame; voltou: boolean } | null
  /** Ids de mapa cujo aviso de migração o mestre dispensou ("Entendi"). */
  avisosDispensados: ReadonlySet<string>
  abrir: (id: string | null) => void
  marcar: (id: string, modo: ModoDeMarcar) => void
  pararDeMarcar: () => void
  avisarCliqueForaDoObjeto: () => void
  abrirEscolhaDoJogo: (escolha: EscolhaDoJogoAberta | null) => void
  guardarJogo: (id: string, guardado: GuardadoDoJogo) => void
  avisarTroca: (troca: { id: string; de: JogoDoMinigame; voltou: boolean } | null) => void
  dispensarAviso: (mapaId: string) => void
  /**
   * AO VIVO (baú, caixa e barril, 15/11/2026): as aberturas desta sessão, a
   * mais nova primeiro (`AO_VIVO_MAX`). Só memória: o objeto aberto fica
   * gravado no mapa, e a ficha dele diz quem abriu.
   */
  aoVivo: readonly RegistroDoObjetoAberto[]
  /** O objeto que o "Ver" do aviso pediu para destacar na página Jogos. */
  destacado: string | null
  registrarAbertura: (registro: RegistroDoObjetoAberto) => void
  destacar: (propId: string | null) => void
}

/** Quantas aberturas a lista "Ao vivo" guarda. */
export const AO_VIVO_MAX = 20

function armazem(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** A lista gravada no aparelho; torta ou bloqueada = nenhum aviso dispensado. */
export function lerAvisosDispensados(origem: Pick<Storage, 'getItem'> | null): Set<string> {
  if (origem === null) return new Set()
  try {
    const cru: unknown = JSON.parse(origem.getItem(CHAVE_DOS_AVISOS_DISPENSADOS) ?? '[]')
    return new Set(Array.isArray(cru) ? cru.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

function gravarAvisosDispensados(ids: ReadonlySet<string>): void {
  const destino = armazem()
  if (destino === null) return
  try {
    destino.setItem(CHAVE_DOS_AVISOS_DISPENSADOS, JSON.stringify([...ids]))
  } catch {
    // Storage cheio ou bloqueado: o aviso volta na próxima vez que o app abrir, e só.
  }
}

export const useDesafiosStore = create<EstadoDosDesafios>((set, get) => ({
  aberto: null,
  marcando: null,
  cliqueForaDoObjeto: false,
  escolhaDoJogo: null,
  guardados: {},
  trocaRecente: null,
  avisosDispensados: lerAvisosDispensados(armazem()),
  aoVivo: [],
  destacado: null,
  registrarAbertura: (registro) => set({ aoVivo: [registro, ...get().aoVivo].slice(0, AO_VIVO_MAX) }),
  destacar: (propId) => set({ destacado: propId }),
  abrir: (id) => set({ aberto: id, escolhaDoJogo: null, trocaRecente: null }),
  marcar: (id, modo) => set({ marcando: { id, modo }, cliqueForaDoObjeto: false }),
  pararDeMarcar: () => set({ marcando: null, cliqueForaDoObjeto: false }),
  avisarCliqueForaDoObjeto: () => set({ cliqueForaDoObjeto: true }),
  abrirEscolhaDoJogo: (escolha) => set({ escolhaDoJogo: escolha }),
  guardarJogo: (id, guardado) => set({ guardados: { ...get().guardados, [id]: { ...get().guardados[id], [guardado.minigame.jogo]: guardado } } }),
  avisarTroca: (troca) => set({ trocaRecente: troca }),
  dispensarAviso: (mapaId) => {
    const avisosDispensados = new Set(get().avisosDispensados)
    avisosDispensados.add(mapaId)
    gravarAvisosDispensados(avisosDispensados)
    set({ avisosDispensados })
  },
}))
