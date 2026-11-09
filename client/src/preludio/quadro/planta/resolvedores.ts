/**
 * Resolvedores injetáveis da planta: substituem o `useApp` do Grimório.
 *
 * No Grimório as formas de sala e de item liam o store do app (nome do cenário ligado à
 * sala, abrir a ficha no duplo clique). No Labirinto a planta abre só para ver, então quem
 * monta o quadro decide se liga alguma coisa aqui. Sem nada registrado, cada função devolve
 * `undefined` / não faz nada, e a forma desenha só o próprio rótulo, sem badge de vínculo.
 */
export interface ResolvedoresDaPlanta {
  /** Nome do cenário ligado a uma sala, ou `undefined` se não houver como saber. */
  nomeDoCenario?(id: string): string | undefined
  /** Nome do item ligado a um pino de item, ou `undefined` se não houver como saber. */
  nomeDoItem?(id: string): string | undefined
  /** Duplo clique numa sala ligada. Opcional: sem ele o duplo clique não abre nada. */
  abrirCenario?(id: string): void
  /** Duplo clique num pino de item ligado. Opcional: sem ele o duplo clique não abre nada. */
  abrirItem?(id: string): void
}

let resolvedores: ResolvedoresDaPlanta = {}

/** Registra (ou troca) os resolvedores. Chamar de novo substitui o conjunto inteiro. */
export function definirResolvedoresDaPlanta(r: ResolvedoresDaPlanta): void {
  resolvedores = r
}

export function nomeDoCenario(id: string): string | undefined {
  return id ? resolvedores.nomeDoCenario?.(id) : undefined
}

export function nomeDoItem(id: string): string | undefined {
  return id ? resolvedores.nomeDoItem?.(id) : undefined
}

export function abrirCenario(id: string): void {
  if (id) resolvedores.abrirCenario?.(id)
}

export function abrirItem(id: string): void {
  if (id) resolvedores.abrirItem?.(id)
}
