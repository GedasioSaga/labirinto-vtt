import { useState, type ReactNode } from 'react'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { TituloDaPagina } from './FolhaDoLivro'
import { IconeDoLivro } from './icones'
import './paginas.css'

type ParteDoAcervo = 'tokens' | 'itens'

const PARTES: readonly OpcaoDoSeg<ParteDoAcervo>[] = [
  { valor: 'tokens', rotulo: 'Tokens', icone: <IconeDoLivro nome="ficha" /> },
  { valor: 'itens', rotulo: 'Itens', icone: <IconeDoLivro nome="joia" /> },
]

export interface PaginaAcervoProps {
  /** O acervo de tokens (`TokenLibraryPanel`). */
  tokens: ReactNode
  /** O acervo de itens (`AcervoDeItensPanel`); ausente, a página é só a dos tokens, sem a escolha. */
  itens?: ReactNode
  /** O acervo de tokens mostra também as fichas de NPC da aventura aberta: o subtítulo diz isso. */
  comFichas?: boolean
  /** Cresce a cada "Mostrar no Acervo" (coluna dos jogadores): a página volta para os tokens. */
  pedidosDeMostrar?: number
}

/**
 * Página Acervo do livro do mestre (fatia 18b): o seg do protótipo escolhe
 * entre o acervo de tokens e o de itens, um de cada vez. Os dois ficam
 * montados e só o escolhido à vista (`hidden` no outro), como as páginas do
 * livro: trocar não perde a pasta que se estava criando nem o item aberto.
 */
export function PaginaAcervo({ tokens, itens, comFichas = false, pedidosDeMostrar = 0 }: PaginaAcervoProps) {
  const [parte, setParte] = useState<ParteDoAcervo>('tokens')
  // "Mostrar no Acervo" com a parte dos itens à vista: as fichas moram nos tokens.
  const [pedidosVistos, setPedidosVistos] = useState(pedidosDeMostrar)
  if (pedidosDeMostrar !== pedidosVistos) {
    setPedidosVistos(pedidosDeMostrar)
    setParte('tokens')
  }
  return (
    <>
      <TituloDaPagina titulo="Acervo" sub={comFichas ? 'Tokens do app e as fichas de NPC desta aventura' : 'Do app, vale para todas as aventuras'} />
      <div className="lb-zona gr-paginas lb-acervo-pagina">
        {itens !== undefined && <CampoSeg nomeAcessivel="O que mostrar" opcoes={PARTES} valor={parte} onChange={setParte} />}
        <div className="lb-acervo-pagina__parte" hidden={parte !== 'tokens'}>
          {tokens}
        </div>
        {itens !== undefined && (
          <div className="lb-acervo-pagina__parte" hidden={parte !== 'itens'}>
            {itens}
          </div>
        )}
      </div>
    </>
  )
}
