import { MenuShell } from './MenuShell'
import './MainMenu.css'

/**
 * MUNDO DO LIVRO DE REGRAS — a porta 04 da tela inicial (M1,
 * docs/planos/livros-de-regras-plano.md §3): passo 1, a escolha do sistema;
 * passo 2, a campanha, só quando mais de uma pasta usa o sistema (decisão D4);
 * passo 3, o `MundoDoLivro` (components/livros/MundoDoLivro.tsx).
 *
 * CONTRATO DA FASE 0: só as props, para o App montar a rota. O corpo é do
 * escritor das telas (fase 1).
 */
export interface LivrosScreenProps {
  /** Volta à tela inicial (`parentScreen('livros')`). */
  onBack: () => void
}

export function LivrosScreen({ onBack }: LivrosScreenProps) {
  return (
    <MenuShell title="Livros de regras" subtitle="Escolha o sistema" onBack={onBack} crumbs={['Labirinto']}>
      {null}
    </MenuShell>
  )
}
