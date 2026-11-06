import { useId } from 'react'
import type { MembroProjetado } from '../../../lib/nuvem/tipos'
import type { EstadoDoMural, PostagemPendente } from '../../dados/muralDaCampanha'
import type { EstadoDaCampanha } from '../../dados/sessaoDaCampanha'
import { useAgora, useSite } from '../contexto'
import { tomDe } from '../textos'
import { CartaoDaNoticia } from './CartaoDaNoticia'
import { EscreverNoticia, type ImagemParaEscolher } from './EscreverNoticia'
import { imagensDaMesa, textoDaPostagem, urlDaImagem } from './textosDoMural'

/**
 * AS NOTÍCIAS DO MURAL: para o mestre, o "escrever" no topo; depois o que
 * ainda está saindo, os AVISOS (as fixadas) e as notícias, da mais nova para
 * a mais velha, com "carregar anteriores" no fim.
 */

interface Props {
  campanha: EstadoDaCampanha
  mural: EstadoDoMural
  eu: MembroProjetado | null
  souMestre: boolean
  demo: boolean
}

export function PainelNoticias({ campanha, mural, eu, souMestre, demo }: Props) {
  const site = useSite()
  const avisosId = useId()
  const noticiasId = useId()
  // Segundo a segundo só com notícia segurada esperando a hora de ir (o "vai sozinha em 12 s").
  const agora = useAgora(mural.pendentes.some((pendente) => pendente.situacao.t === 'esperando') ? 1_000 : 30_000)
  const imagens: ImagemParaEscolher[] = imagensDaMesa([...mural.fixadas, ...mural.noticias], campanha.fichas).map((ref, i) => ({
    ref,
    src: urlDaImagem(ref, campanha.campanhaId, demo),
    nome: `Imagem ${i + 1} da mesa`,
  }))
  const fixadas = new Set(mural.fixadas.map((noticia) => noticia.id))
  const lista = mural.noticias.filter((noticia) => !fixadas.has(noticia.id))

  const cartao = (noticia: EstadoDoMural['noticias'][number]) => (
    <CartaoDaNoticia
      key={noticia.id}
      noticia={noticia}
      eu={eu}
      souMestre={souMestre}
      membros={campanha.membros}
      pronto={mural.pronto}
      aCaminho={mural.aCaminho.get(noticia.id)}
      recusa={mural.recusas.get(noticia.id)}
      nova={mural.novas.has(noticia.id)}
      campanhaId={campanha.campanhaId}
      demo={demo}
      imagens={imagens}
      agora={agora}
    />
  )

  return (
    <>
      {souMestre && (
        <section aria-label="Escrever uma notícia" className="lo-mural__secao">
          <EscreverNoticia modo="nova" imagens={imagens} pronto={mural.pronto} aoEnviar={(texto, imagem) => site.mural()?.postar(texto, imagem) ?? false} />
        </section>
      )}

      {mural.pendentes.length > 0 && (
        <section aria-label="Saindo" className="lo-mural__secao">
          <ol className="lo-noticias">
            {mural.pendentes.map((pendente) => (
              <li key={pendente.idDoCliente}>
                <Pendente pendente={pendente} eu={eu} agora={agora} campanhaId={campanha.campanhaId} demo={demo} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {!mural.carregado ? (
        <p className="lo-carregando" role="status">
          <span className="lo-giro" aria-hidden="true" />
          {campanha.conexao === 'sem-rede' ? 'Sem internet: o mural abre quando a conexão voltar.' : 'Carregando o mural…'}
        </p>
      ) : (
        <>
          {mural.fixadas.length > 0 && (
            <section aria-labelledby={avisosId} className="lo-mural__secao">
              <h2 className="lo-mural__secao-titulo" id={avisosId}>
                Avisos fixados
              </h2>
              <div className="lo-noticias">{mural.fixadas.map(cartao)}</div>
            </section>
          )}
          <section aria-labelledby={noticiasId} className="lo-mural__secao">
            <h2 className="lo-mural__secao-titulo" id={noticiasId}>
              Notícias
            </h2>
            {lista.length === 0 ? (
              <p className="lo-vazio">
                {souMestre
                  ? 'Nenhuma notícia ainda. Escreva a primeira aqui em cima: toda a mesa lê, e quem você chamar com @Nome fica sabendo.'
                  : 'O mestre ainda não postou nada. Quando postar, a notícia aparece aqui.'}
              </p>
            ) : (
              <div className="lo-noticias">{lista.map(cartao)}</div>
            )}
            {mural.temMaisAntigas && (
              <div className="lo-mochila__pe">
                <button type="button" className="lo-btn" disabled={!mural.pronto || mural.carregandoAntigas} onClick={() => site.mural()?.carregarAntigas()}>
                  {mural.carregandoAntigas ? <span className="lo-giro" aria-hidden="true" /> : null}
                  {mural.carregandoAntigas ? 'Carregando…' : 'Carregar notícias anteriores'}
                </button>
                {!mural.pronto && <span className="lo-motivo">Sem conexão: volta quando ela voltar.</span>}
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}

function Pendente({ pendente, eu, agora, campanhaId, demo }: { pendente: PostagemPendente; eu: MembroProjetado | null; agora: number; campanhaId: string; demo: boolean }) {
  const site = useSite()
  const recusada = pendente.situacao.t === 'recusada'
  const src = pendente.imagem === null ? null : urlDaImagem(pendente.imagem, campanhaId, demo)
  return (
    <article className="lo-noticia" data-pendente="1" data-recusada={recusada ? '1' : undefined} aria-label="Notícia saindo">
      <span className="lo-av" data-tom={tomDe(eu?.contaId ?? 'mestre')} aria-hidden="true">
        {(eu?.nome ?? 'M').slice(0, 1).toUpperCase()}
      </span>
      <div className="lo-noticia__corpo">
        <p className="lo-noticia__texto">{pendente.texto}</p>
        {src !== null && (
          <figure className="lo-noticia__imagem">
            <img src={src} alt="A imagem desta notícia" />
          </figure>
        )}
        <div className="lo-noticia__pe">
          <span className="lo-noticia__estado" role="status">
            {pendente.situacao.t === 'enviando' && <span className="lo-giro" aria-hidden="true" />}
            {textoDaPostagem(pendente.situacao, agora)}
          </span>
          {recusada && (
            <>
              <button type="button" className="lo-btn" onClick={() => site.mural()?.tentarDeNovo(pendente.idDoCliente)}>
                Tentar de novo
              </button>
              <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => site.mural()?.descartar(pendente.idDoCliente)}>
                Descartar
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
