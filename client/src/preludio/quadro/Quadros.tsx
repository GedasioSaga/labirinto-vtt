import { usePreludio } from '../estado/preludio'
import { quadrosDaCampanha, resumoDaContagem, useQuadros } from './estadoDosQuadros'
import { QuadroSobDemanda } from './sobDemanda'

/**
 * OS QUADROS (MAPA MENTAL) DO PRELÚDIO, fatia F3: a lista dos quadros do
 * filtro "Campanha" e, aberto, o quadro no tldraw (baixado só então).
 */

/** "+ Novo quadro": cria na campanha do filtro e abre com o nome selecionado; se o disco recusar, a lista diz por quê. */
export function useNovoQuadro(): () => Promise<void> {
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  const ir = usePreludio((estado) => estado.ir)
  return async () => {
    if (usePreludio.getState().travado) return
    const id = await useQuadros.getState().criar(campanhaId)
    ir({ secao: 'quadros', quadroId: id })
  }
}

function ListaDeQuadros() {
  const lista = useQuadros((estado) => estado.lista)
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  const travado = usePreludio((estado) => estado.travado)
  const ir = usePreludio((estado) => estado.ir)
  const novoQuadro = useNovoQuadro()
  const falha = useQuadros((estado) => estado.avisoDaCriacao)
  const quadros = quadrosDaCampanha(lista, campanhaId)

  return (
    <section className="pr-lista" aria-labelledby="pr-quadros-titulo" aria-busy={lista.t === 'lendo'}>
      <header className="pr-lista__cabeca">
        <div>
          <h2 id="pr-quadros-titulo" className="pr-lista__titulo">
            Quadros
          </h2>
          <p className="pr-lista__conta">{lista.t === 'pronta' ? (quadros.length === 1 ? '1 quadro' : `${quadros.length} quadros`) : '\u00a0'}</p>
        </div>
        <div className="pr-lista__acoes">
          <button type="button" className="gr-bt gr-bt--p gr-bt--latao" disabled={travado || lista.t !== 'pronta'} onClick={() => void novoQuadro()}>
            + Novo quadro
          </button>
        </div>
      </header>
      {falha !== null && (
        <p className="pr-aviso" role="alert">
          {falha}
        </p>
      )}
      {lista.t === 'falhou' ? (
        <p className="pr-aviso" role="alert">
          {lista.aviso}
        </p>
      ) : lista.t !== 'pronta' ? null : quadros.length === 0 ? (
        <div className="pr-vazio">
          <p className="pr-vazio__texto">Nenhum quadro ainda. Um quadro é o mapa mental da sessão: imagens, notas, cartões dos verbetes e setas entre eles.</p>
        </div>
      ) : (
        <ul className="pr-cadernos">
          {quadros.map((quadro) => (
            <li key={quadro.id}>
              <button type="button" className="pr-caderno" onClick={() => ir({ secao: 'quadros', quadroId: quadro.id })}>
                <span className="pr-caderno__nome">{quadro.nome || 'Quadro sem nome'}</span>
                <span className="pr-caderno__conta">{quadro.contagem === null ? 'Não abriu' : resumoDaContagem(quadro.contagem)}</span>
                {quadro.planta && <span className="pr-quadro__selo">Planta do Grimório, só para ver</span>}
                {quadro.aviso !== null && <span className="pr-quadro__aviso">{quadro.aviso}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function Quadros({ quadroId, alvo }: { quadroId: string | null; alvo?: string }) {
  const ir = usePreludio((estado) => estado.ir)
  if (quadroId === null) return <ListaDeQuadros />
  return <QuadroSobDemanda key={quadroId} id={quadroId} alvo={alvo} aoVoltar={() => ir({ secao: 'quadros', quadroId: null })} />
}
