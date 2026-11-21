import { useEffect, useState } from 'react'
import { Botao } from '../grimorio/Botao'
import { FolhaDoLivro, TituloDaPagina } from './FolhaDoLivro'
import type { PaginaExtraDoMestre } from './LivroDoMestre'
import { FichaDoDocumento } from '../documentos/FichaDoDocumento'
import { IconeDoPapel, IconeDosDocumentos } from '../documentos/IconeDoPapel'
import { useDocumentosDoMestreStore } from '../documentos/documentosDoMestreStore'
import { NOMES_DOS_PAPEIS } from '../../documentos/Papel'
import { quantosTem } from '../../documentos/naFicha'
import { papeisDoDocumento } from '../../documentos/noMapa'
import { sumiuDoMapa } from '../../documentos/recorte'
import type { Documento, DocumentoNoMapa } from '../../documentos/tipos'
import type { Personagem } from '../../lib/personagem'
import { useAdventureStore } from '../../stores/adventureStore'
import { personagensAtivos } from '../../stores/donoDasFichas'
import { useDocumentosStore } from '../../stores/documentosStore'
import { useMapStore } from '../../stores/mapStore'
import { useToastStore } from '../../stores/toastStore'
import './paginas.css'
import './paginaJogos.css'
import '../documentos/documentos.css'

/**
 * A PÁGINA DOCUMENTOS do livro do mestre (plano dos puzzles, fase D2; protótipo
 * v2, aba "Documentos (mestre)"): a biblioteca do app, SEPARADA do acervo
 * (decisão do dono), e a ficha de cada documento. Escreve-se uma vez e põe-se
 * em qualquer mapa, ou entrega-se direto.
 */

/** O marcador da página no livro, logo depois de Jogos (a ordem da lombada do protótipo). */
export const PAGINA_DOS_DOCUMENTOS: PaginaExtraDoMestre = { id: 'documentos', rotulo: 'DOCS', icone: <IconeDosDocumentos /> }

function Seta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** "no mapa", "pego, saiu do mapa", "fora do mapa": onde o documento está nesta cena. */
function textoDoMapa(papeis: readonly DocumentoNoMapa[]): string {
  if (papeis.length === 0) return 'fora do mapa'
  if (papeis.every(sumiuDoMapa)) return 'pego, saiu do mapa'
  return papeis.length === 1 ? 'no mapa' : `${papeis.length} vezes no mapa`
}

function textoDeQuemTem(n: number): string {
  return n === 0 ? 'ninguém tem' : n === 1 ? '1 tem' : `${n} têm`
}

function ListaDosDocumentos({ documentos, podeGravar, aviso, personagens }: { documentos: readonly Documento[]; podeGravar: boolean; aviso: string | null; personagens: readonly Personagem[] }) {
  const noMapa = useMapStore((estado) => estado.map.documentos)
  const [criando, setCriando] = useState(false)
  const criar = () => {
    setCriando(true)
    useDocumentosStore
      .getState()
      .criar()
      .then((documento) => useDocumentosDoMestreStore.getState().abrir(documento.id))
      .catch((erro: unknown) => useToastStore.getState().push('error', erro instanceof Error ? erro.message : String(erro)))
      .finally(() => setCriando(false))
  }
  return (
    <>
      <TituloDaPagina titulo="Documentos" sub="Escreva uma vez, ponha em qualquer mapa ou entregue direto." />
      <div className="lb-zona gr-paginas">
        {aviso !== null && (
          <div className="mg-aviso" role="status">
            <p>{aviso}</p>
          </div>
        )}
        <div className="mg-nota-pe">
          <Botao variante="latao" largo onClick={criar} disabled={!podeGravar || criando}>
            Novo documento
          </Botao>
        </div>
        <h3 className="mg-secao">
          Biblioteca <small>{documentos.length}</small>
        </h3>
        {documentos.length === 0 ? (
          <p className="mg-vazio">
            {podeGravar
              ? 'Nenhum documento ainda. Crie um bilhete, uma carta ou uma página de diário: quem encostar no papel do mapa lê e guarda.'
              : 'Os documentos moram no aplicativo do mestre: abra o Labirinto instalado para escrevê-los.'}
          </p>
        ) : (
          <ul className="mg-lista">
            {documentos.map((documento) => (
              <li key={documento.id}>
                <button type="button" className="mg-linha" onClick={() => useDocumentosDoMestreStore.getState().abrir(documento.id)}>
                  <span className="mg-linha__med">
                    <IconeDoPapel papel={documento.papel} />
                  </span>
                  <span className="mg-linha__nome">{documento.titulo.trim() === '' ? 'Sem título' : documento.titulo}</span>
                  <span className="mg-linha__seta">
                    <Seta />
                  </span>
                  <span className="mg-linha__onde">
                    {NOMES_DOS_PAPEIS[documento.papel]} · {textoDoMapa(papeisDoDocumento({ documentos: noMapa }, documento.id))} ·{' '}
                    {textoDeQuemTem(quantosTem(personagens, documento.id))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

export function PaginaDocumentos() {
  const documentos = useDocumentosStore((estado) => estado.documentos)
  const podeGravar = useDocumentosStore((estado) => estado.podeGravar)
  const aviso = useDocumentosStore((estado) => estado.aviso)
  const abertoId = useDocumentosDoMestreStore((estado) => estado.aberto)
  const personagens = useAdventureStore((estado) => personagensAtivos(estado))
  // A biblioteca é do app, não do mapa: relê quando a página monta. A leitura espera a gravação da ficha que acabou de fechar (`lerBiblioteca`).
  useEffect(() => {
    useDocumentosStore
      .getState()
      .recarregar()
      .catch((erro: unknown) => useToastStore.getState().push('error', erro instanceof Error ? erro.message : String(erro)))
  }, [])
  const aberto = abertoId === null ? undefined : documentos.find((documento) => documento.id === abertoId)
  return (
    <FolhaDoLivro pagina="documentos">
      {aberto === undefined ? (
        <ListaDosDocumentos documentos={documentos} podeGravar={podeGravar} aviso={aviso} personagens={personagens} />
      ) : (
        <div className="lb-zona gr-paginas">
          <FichaDoDocumento key={aberto.id} documento={aberto} podeGravar={podeGravar} />
        </div>
      )}
    </FolhaDoLivro>
  )
}
