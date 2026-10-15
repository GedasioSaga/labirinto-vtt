import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { classes } from './comum'
import './grimorio.css'

export type VarianteDoBotao = 'primario' | 'latao' | 'fantasma' | 'perigo'

type BotaoBase = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  /** Sem variante é o botão de cartão (pedra quente com filete). */
  variante?: VarianteDoBotao
  /** `p`: 28 px, linha de ações e topo do livro. `alto`: 40 px, a ação que fecha a folha. */
  tamanho?: 'p' | 'alto'
  /** Ocupa a linha inteira. */
  largo?: boolean
  /** Padrão `button`, para um botão dentro de formulário nunca enviar sem querer. */
  tipo?: 'button' | 'submit'
  ref?: Ref<HTMLButtonElement>
}

/**
 * Só ícone: o nome acessível não tem texto de onde sair, então `aria-label`
 * passa a ser obrigatório pelo tipo.
 */
export type BotaoProps = BotaoBase & ({ soIcone: true; 'aria-label': string } | { soIcone?: false })

/** O `.bt` do protótipo. `aria-pressed` acende o latão (botão que liga e desliga). */
export function Botao({ variante, tamanho, largo, soIcone, tipo = 'button', className, ref, children, ...resto }: BotaoProps) {
  return (
    <button
      ref={ref}
      type={tipo}
      className={classes(
        'gr-bt',
        variante && `gr-bt--${variante}`,
        tamanho && `gr-bt--${tamanho}`,
        largo && 'gr-bt--largo',
        soIcone && 'gr-bt--ic',
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  )
}

/** Fileira de botões que quebra a linha; `coluna` empilha alinhando à esquerda. */
export function Acoes({ coluna, children }: { coluna?: boolean; children: ReactNode }) {
  return <div className={classes('gr-acoes', coluna && 'gr-acoes--col')}>{children}</div>
}

/** Tecla de atalho desenhada (o `kbd` do protótipo). */
export function Tecla({ children }: { children: ReactNode }) {
  return <kbd className="gr-kbd">{children}</kbd>
}
