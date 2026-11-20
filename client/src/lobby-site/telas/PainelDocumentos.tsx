import { useId } from 'react'
import type { DocumentoNaFicha, PapelDoDocumento } from '../../documentos/tipos'
import type { FichaDoSite } from '../dados/sessaoDaCampanha'
import { Icone, type NomeDoIcone } from './Icone'

/**
 * OS DOCUMENTOS que o personagem leu (plano dos puzzles, decisão 4): no site
 * só o título e o papel. O texto mora no app do mestre e se lê na mesa. Só o
 * mestre muda a lista (`['documentos', docId]`, D4): aqui todo mundo só vê.
 *
 * A lista já chega lida: o estado passa por `personagemDoArquivo` e cada
 * mudança por `lerDocumentoNaFicha` (`lib/nuvem/caminho.ts`).
 */

const PAPEIS: Record<PapelDoDocumento, { icone: NomeDoIcone; nome: string }> = {
  alfinete: { icone: 'papel-alfinete', nome: 'Papel com alfinete' },
  carta: { icone: 'papel-carta', nome: 'Carta' },
  diario: { icone: 'papel-diario', nome: 'Página de diário' },
  bilhete: { icone: 'papel-bilhete', nome: 'Bilhete rasgado' },
  pergaminho: { icone: 'papel-pergaminho', nome: 'Pergaminho' },
  imagem: { icone: 'papel-imagem', nome: 'Imagem' },
}

/** O título vazio é de documento que o mestre ainda não nomeou (`Documento.titulo`). */
const SEM_TITULO = 'Sem título'

/** O mais novo em cima, como a gaveta do jogador no protótipo v2 (a ficha guarda o mais novo no fim). */
function maisNovosPrimeiro(lista: readonly DocumentoNaFicha[]): DocumentoNaFicha[] {
  return [...lista].sort((a, b) => b.em - a.em)
}

export function PainelDocumentos({ ficha }: { ficha: FichaDoSite }) {
  const tituloId = useId()
  const documentos = maisNovosPrimeiro(ficha.doc.documentos ?? [])

  return (
    <section aria-labelledby={tituloId}>
      <div className="lo-painel__cab">
        <h2 className="lo-painel__titulo" id={tituloId}>
          Documentos
        </h2>
        <p className="lo-nota-mapas">
          <Icone nome="olho" /> O texto se lê na mesa, no app do mestre
        </p>
      </div>
      <ul className="lo-itens" aria-label="Documentos lidos">
        {documentos.length === 0 ? <li className="lo-vazio">Nenhum documento ainda.</li> : documentos.map((documento) => <LinhaDoDocumento key={documento.docId} documento={documento} />)}
      </ul>
    </section>
  )
}

function LinhaDoDocumento({ documento }: { documento: DocumentoNaFicha }) {
  const papel = PAPEIS[documento.papel]
  return (
    <li className="lo-item lo-doc">
      <span className="lo-vaga lo-doc__papel" data-tom="0" aria-hidden="true">
        <Icone nome={papel.icone} />
      </span>
      <div className="lo-item__texto">
        <p className="lo-item__nome">{documento.titulo === '' ? SEM_TITULO : documento.titulo}</p>
        <p className="lo-item__desc">{papel.nome}</p>
      </div>
      {documento.novo === true && (
        <span className="lo-doc__novo">
          <span className="lo-doc__ponto" aria-hidden="true" />
          novo
        </span>
      )}
    </li>
  )
}
