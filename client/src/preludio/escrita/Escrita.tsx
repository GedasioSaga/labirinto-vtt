import { useMemo } from 'react'
import { arvoreDe, ehDaEscrita, naCampanha, verbeteNovo, type NoDaArvore } from '../../lib/preparo/enciclopedia'
import type { Verbete } from '../../lib/preparo/tipos'
import { PaginaDoVerbete } from '../enciclopedia/PaginaDoVerbete'
import { usePreludio } from '../estado/preludio'

/**
 * A ESCRITA (plano §1): cadernos livres em árvore, como no Grimório. Caderno
 * é a página de cima; dentro dele, páginas e subpáginas. A árvore mora na
 * barra lateral; aqui fica a página aberta, ou a lista dos cadernos.
 */

/** Os cadernos da Escrita na campanha escolhida, com as páginas de dentro. */
export function useCadernos(): NoDaArvore[] {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  return useMemo(() => {
    const daEscrita = [...verbetes.values()].filter((verbete) => ehDaEscrita(verbete, verbetes))
    // O filtro de campanha vale pelo caderno: as páginas seguem o caderno em que estão.
    return arvoreDe(daEscrita).filter((caderno) => naCampanha(caderno.verbete, campanhaId))
  }, [verbetes, campanhaId])
}

function contarPaginas(no: NoDaArvore): number {
  return no.filhos.reduce((total, filho) => total + 1 + contarPaginas(filho), 0)
}

/** Cria um caderno vazio (na campanha do filtro, se houver) e abre a primeira página dele. */
export function useNovoCaderno(): () => Promise<void> {
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  const criarVerbete = usePreludio((estado) => estado.criarVerbete)
  const ir = usePreludio((estado) => estado.ir)
  return async () => {
    const caderno: Verbete = verbeteNovo('pagina', 'Caderno sem nome', { campanhas: campanhaId === null ? [] : [campanhaId] })
    await criarVerbete(caderno)
    ir({ secao: 'escrita', paginaId: caderno.id })
  }
}

export function Escrita({ paginaId }: { paginaId: string | null }) {
  const cadernos = useCadernos()
  const novoCaderno = useNovoCaderno()
  const ir = usePreludio((estado) => estado.ir)
  const travado = usePreludio((estado) => estado.travado)

  if (paginaId !== null) return <PaginaDoVerbete key={paginaId} id={paginaId} />

  return (
    <section className="pr-lista" aria-labelledby="pr-escrita-titulo">
      <header className="pr-lista__cabeca">
        <div>
          <h2 id="pr-escrita-titulo" className="pr-lista__titulo">
            Escrita
          </h2>
          <p className="pr-lista__conta">{cadernos.length === 1 ? '1 caderno' : `${cadernos.length} cadernos`}</p>
        </div>
        <div className="pr-lista__acoes">
          <button type="button" className="gr-bt gr-bt--p gr-bt--latao" disabled={travado} onClick={() => void novoCaderno()}>
            + Novo caderno
          </button>
        </div>
      </header>
      {cadernos.length === 0 ? (
        <div className="pr-vazio">
          <p className="pr-vazio__texto">Nenhum caderno ainda. Um caderno guarda páginas livres em árvore: ideias, a história do mundo, o que vier.</p>
        </div>
      ) : (
        <ul className="pr-cadernos">
          {cadernos.map((caderno) => {
            const paginas = contarPaginas(caderno)
            return (
              <li key={caderno.verbete.id}>
                <button type="button" className="pr-caderno" onClick={() => ir({ secao: 'escrita', paginaId: caderno.verbete.id })}>
                  <span className="pr-caderno__nome">{caderno.verbete.titulo || 'Caderno sem nome'}</span>
                  <span className="pr-caderno__conta">{paginas === 1 ? '1 página' : `${paginas} páginas`}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
