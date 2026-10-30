/**
 * O MUNDO DE UM LIVRO DE REGRAS (M1, docs/planos/livros-de-regras-plano.md
 * §3): marcadores à esquerda e a página no meio (sem a coluna da IA até a M4,
 * decisão D6). Lê o que está aberto em `useMundoDoLivroStore` e as fichas por
 * `usePersonagensDoMundo`; abre pela tela inicial (dentro da `LivrosScreen`)
 * ou por cima do editor (atalho no livro do mestre), em camada própria.
 *
 * CONTRATO DA FASE 0: só as props, para a LivrosScreen e o App montarem. O
 * corpo é do escritor das telas (fase 1).
 */
export interface MundoDoLivroProps {
  /** "Fechar" e Esc: quem montou decide para onde volta (a escolha do sistema, ou o mapa). */
  onFechar: () => void
}

export function MundoDoLivro({ onFechar }: MundoDoLivroProps) {
  return (
    <section className="lb-mundo" aria-label="Mundo do livro de regras">
      <button type="button" className="lb-btn" onClick={onFechar}>
        Fechar
      </button>
    </section>
  )
}
