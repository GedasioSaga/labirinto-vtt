import type { ReactNode, Ref } from 'react'
import { useLivroDoMestreStore, type PaginaDoMestre } from '../../stores/livroDoMestreStore'

/**
 * Uma página do livro do mestre. Todas ficam montadas e só a aberta fica à
 * vista (`hidden` nas outras): trocar de marcador não apaga o que estava
 * digitado numa busca ou num campo da Agenda, como a coluna única de antes.
 */
export function FolhaDoLivro({ pagina, corpoRef, children }: { pagina: PaginaDoMestre; corpoRef?: Ref<HTMLDivElement>; children: ReactNode }) {
  const aberta = useLivroDoMestreStore((state) => state.pagina) === pagina
  // O corpo que rola leva a classe de sempre: as dicas sob demanda (lib/dicaDoPainel.ts) e a faixa que gruda moram nele.
  return (
    <div className="gr-folha" data-pagina={pagina} hidden={!aberta}>
      <div className="lb-inspector__body lb-scroll" ref={corpoRef}>
        {children}
      </div>
    </div>
  )
}

/** Título em serifa e a linha de baixo, no alto das páginas Cena, Aventura e Acervo. */
export function TituloDaPagina({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <>
      <h2 className="gr-titulo-pagina">{titulo}</h2>
      <p className="gr-sub-pagina">{sub}</p>
    </>
  )
}
