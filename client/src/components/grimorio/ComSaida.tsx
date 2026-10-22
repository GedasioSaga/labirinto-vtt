import { cloneElement, isValidElement, useEffect, useLayoutEffect, useState, type ReactElement } from 'react'
import { SAIDA_DO_POP_MS, movimentoReduzido } from './comum'

/** O que um menu precisa aceitar para sair animado: com `saindo`, ele leva `.gr-sai` e fica inerte. */
export interface ComSaidaFilho {
  saindo?: boolean
}

export interface ComSaidaProps {
  /** O menu aberto, ou nada (`aberto && <Menu />`): o jeito de sempre de montar. */
  children: ReactElement<ComSaidaFilho> | null | false | undefined
}

/**
 * Saída animada para os menus antigos, que quem monta tira da tela na hora em
 * que fecham. Quando o filho some, o último fica mais 120 ms com `saindo`
 * (a transição `.gr-anima.gr-sai`) e então sai. Reabrir no meio da saída mostra
 * o filho novo no MESMO nó, se for o mesmo menu (mesmo tipo e `key`): a
 * transição volta do ponto em que estava, sem piscar. Com movimento reduzido,
 * sai na hora.
 */
export function ComSaida({ children }: ComSaidaProps) {
  const filho = isValidElement(children) ? children : null
  const [ultimo, setUltimo] = useState<ReactElement<ComSaidaFilho> | null>(filho)
  // Guardar o menu da vez é estado derivado do filho: sem ele, a saída não teria o que mostrar.
  if (filho !== null && filho !== ultimo) setUltimo(filho)
  const saindo = filho === null && ultimo !== null

  useLayoutEffect(() => {
    if (saindo && movimentoReduzido()) setUltimo(null)
  }, [saindo])

  useEffect(() => {
    if (!saindo || movimentoReduzido()) return
    const prazo = window.setTimeout(() => setUltimo(null), SAIDA_DO_POP_MS)
    return () => window.clearTimeout(prazo)
  }, [saindo])

  if (filho !== null) return filho
  if (ultimo === null) return null
  return cloneElement(ultimo, { saindo: true })
}
