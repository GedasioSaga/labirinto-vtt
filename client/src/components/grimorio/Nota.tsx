import type { MouseEvent, ReactNode } from 'react'
import { ChevronDownIcon } from '../icons'
import './grimorio.css'

export interface NotaProps {
  children: ReactNode
  /**
   * Link "ir" no fim da frase ("Ir para Cena", "Abrir configurações"). O
   * evento diz se veio do ponteiro (`detail > 0`) ou do teclado: a troca de
   * página só anima pelo ponteiro.
   */
  ir?: { rotulo: string; onClick: (evento: MouseEvent<HTMLButtonElement>) => void }
}

/** Frase de ajuda apagada dentro de uma ficha (o `.nota`). */
export function Nota({ children, ir }: NotaProps) {
  return (
    <p className="gr-nota">
      {children}
      {ir && (
        <>
          {' '}
          <button type="button" className="gr-link" onClick={ir.onClick}>
            {ir.rotulo}
          </button>
        </>
      )}
    </p>
  )
}

export interface GrupoAvancadoProps {
  /** Padrão "Avançado". */
  rotulo?: string
  abertoInicial?: boolean
  children: ReactNode
}

/**
 * O que raramente se mexe, recolhido no pé da ficha (o `.subgrupo`). É um
 * `<details>`: abrir e fechar, Enter e Espaço são do navegador, e a escolha vale
 * enquanto a ficha estiver montada.
 */
export function GrupoAvancado({ rotulo = 'Avançado', abertoInicial = false, children }: GrupoAvancadoProps) {
  return (
    <details className="gr-subgrupo" open={abertoInicial}>
      <summary>
        <ChevronDownIcon />
        {rotulo}
      </summary>
      <div className="gr-subgrupo__dentro">{children}</div>
    </details>
  )
}
