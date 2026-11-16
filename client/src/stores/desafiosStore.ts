import { create } from 'zustand'

/**
 * A PÁGINA JOGOS do livro do mestre (desafios, 15/11/2026): qual desafio está
 * aberto na ficha da página, o "Marcar no mapa" em curso e os mapas cujo aviso
 * de migração ("N pinos ▷ viraram desafios") o mestre já dispensou. O resto
 * vale enquanto o app está aberto; o "Entendi" fica no aparelho, por mapa.
 */

/** O que o próximo clique no mapa marca: um ponto, ou o objeto clicado. */
export type ModoDeMarcar = 'ponto' | 'objeto'

export const CHAVE_DOS_AVISOS_DISPENSADOS = 'lb-desafios-aviso-dispensado'

interface EstadoDosDesafios {
  /** O desafio aberto na ficha da página Jogos; `null` = a lista. */
  aberto: string | null
  /** "Marcar no mapa" / "Escolher no mapa" em curso: o próximo clique decide o lugar. */
  marcando: { id: string; modo: ModoDeMarcar } | null
  /** Ids de mapa cujo aviso de migração o mestre dispensou ("Entendi"). */
  avisosDispensados: ReadonlySet<string>
  abrir: (id: string | null) => void
  marcar: (id: string, modo: ModoDeMarcar) => void
  pararDeMarcar: () => void
  dispensarAviso: (mapaId: string) => void
}

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
  avisosDispensados: lerAvisosDispensados(armazem()),
  abrir: (id) => set({ aberto: id }),
  marcar: (id, modo) => set({ marcando: { id, modo } }),
  pararDeMarcar: () => set({ marcando: null }),
  dispensarAviso: (mapaId) => {
    const avisosDispensados = new Set(get().avisosDispensados)
    avisosDispensados.add(mapaId)
    gravarAvisosDispensados(avisosDispensados)
    set({ avisosDispensados })
  },
}))
