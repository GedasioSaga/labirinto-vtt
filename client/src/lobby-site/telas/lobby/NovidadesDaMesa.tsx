import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { NoticiaDoMural } from '../../../lib/nuvem/muralDoLobby'
import type { EstadoDoMural } from '../../dados/muralDaCampanha'
import { enderecoDaRota, type Rota } from '../../dados/rotas'
import type { EstadoDaCampanha } from '../../dados/sessaoDaCampanha'
import { aoClicarNoLink, useAgora, useDoSite, useSite } from '../contexto'
import { Icone } from '../Icone'
import { horaExata, quandoRelativo, tomDe } from '../textos'
import { nomeDaReacao, partesDaFrase, urlDaImagem } from '../mural/textosDoMural'

/**
 * AS NOVIDADES DA MESA no lobby (H1), pelo mural da M2: os AVISOS do mestre
 * (os não lidos primeiro, com "marcar como lido"; os lidos ficam, mais
 * quietos), as últimas NOTÍCIAS e as últimas MODIFICAÇÕES nas fichas. Cada
 * uma mostra pouco e leva ao mural inteiro. Texto de quem escreveu sempre
 * literal (filho React, nunca HTML).
 */

/** Avisos à vista no lobby; o resto está no mural. */
const AVISOS_NO_LOBBY = 3
const NOTICIAS_NO_LOBBY = 3
const MODIFICACOES_NO_LOBBY = 5
/** Uma ficha mudou: espera a rajada acabar antes de pedir as modificações de novo (como o painel do mural). */
const ESPERA_DA_ATUALIZACAO_MS = 1_500

interface Props {
  campanha: EstadoDaCampanha
  mural: EstadoDoMural | null
}

function Bloco({ titulo, extra, children, className }: { titulo: string; extra?: ReactNode; children: ReactNode; className?: string }) {
  const tituloId = useId()
  return (
    <section className={className === undefined ? 'lo-saguao__bloco' : `lo-saguao__bloco ${className}`} aria-labelledby={tituloId}>
      <div className="lo-saguao__bloco-cab">
        <h2 className="lo-secao__titulo" id={tituloId}>
          {titulo}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

function LinkDoMural({ alvo, children, rotulo }: { alvo: Rota; children: ReactNode; rotulo?: string }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  return (
    <a className="lo-saguao__mais" href={enderecoDaRota(alvo, demo)} onClick={aoClicarNoLink(site, alvo)} aria-label={rotulo}>
      {children}
      <Icone nome="ir" />
    </a>
  )
}

/** Sem o mural ainda: abrindo, ou sem rede antes da primeira vez. */
function SemMural({ mural, texto }: { mural: EstadoDoMural | null; texto: string }) {
  if (mural !== null && !mural.pronto && !mural.carregado) {
    return (
      <p className="lo-saguao__vazio">
        <Icone nome="sem-rede" /> Sem internet: {texto} aparecem quando a conexão voltar.
      </p>
    )
  }
  return (
    <p className="lo-carregando lo-saguao__vazio" role="status">
      <span className="lo-giro" aria-hidden="true" />
      Carregando {texto}…
    </p>
  )
}

export function AvisosDaMesa({ campanha, mural }: Props) {
  const site = useSite()
  const agora = useAgora()
  const noMural: Rota = { tela: 'mural', campanhaId: campanha.campanhaId, aba: 'noticias' }
  const meuId = campanha.eu?.contaId ?? null
  // O aviso que a própria pessoa postou não espera o "lido" dela (como na faixa do mural).
  const naoLido = (noticia: NoticiaDoMural) => !noticia.lida && noticia.autorContaId !== meuId
  const fixadas = mural?.fixadas ?? []
  const ordem = [...fixadas.filter(naoLido), ...fixadas.filter((noticia) => !naoLido(noticia))]
  const naTela = ordem.slice(0, AVISOS_NO_LOBBY)
  const resto = ordem.length - naTela.length
  const naoLidos = fixadas.filter(naoLido).length

  function marcarLido(noticia: NoticiaDoMural) {
    site.mural()?.marcarLido(noticia.id, noticia.versao)
    // O botão some (o aviso fica, lido): o foco vai para o próprio aviso, sem pular a tela.
    requestAnimationFrame(() => document.getElementById(`aviso-${noticia.id}`)?.focus({ preventScroll: true }))
  }

  let conteudo
  if (mural === null || !mural.carregado) conteudo = <SemMural mural={mural} texto="os avisos" />
  else if (fixadas.length === 0) conteudo = <p className="lo-saguao__vazio">Nenhum aviso fixado agora. Quando o mestre fixar um, ele aparece aqui.</p>
  else {
    conteudo = (
      <div className="lo-saguao__avisos-lista">
        {naTela.map((noticia) => {
          const lido = !naoLido(noticia)
          return (
            <article
              key={`${noticia.id}:${noticia.versao}`}
              id={`aviso-${noticia.id}`}
              className="lo-aviso-fixo"
              data-lido={lido ? '1' : undefined}
              data-entra={mural.novas.has(noticia.id) ? '1' : undefined}
              tabIndex={-1}
              aria-label={`Aviso de ${noticia.autorNome}${lido ? ', lido' : ', não lido'}`}
            >
              <span className="lo-aviso-fixo__pino" aria-hidden="true">
                <Icone nome="fixar" />
              </span>
              <div className="lo-aviso-fixo__corpo">
                <p className="lo-aviso-fixo__de">
                  Aviso de <b>{noticia.autorNome}</b>,{' '}
                  <time dateTime={new Date(noticia.criadaEm).toISOString()} title={horaExata(noticia.criadaEm)}>
                    {quandoRelativo(noticia.criadaEm, agora)}
                  </time>
                  {noticia.editadaEm !== null && ', editado'}
                </p>
                <p className="lo-aviso-fixo__texto">{noticia.texto}</p>
              </div>
              <div className="lo-aviso-fixo__acoes">
                {lido ? (
                  <span className="lo-saguao__lido">
                    <Icone nome="visto" /> Lido
                  </span>
                ) : (
                  <button type="button" className="lo-btn lo-btn--primario" onClick={() => marcarLido(noticia)}>
                    <Icone nome="visto" /> Marcar como lido
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <Bloco
      titulo="Avisos do mestre"
      className="lo-saguao__avisos"
      extra={
        <>
          {naoLidos > 0 && <span className="lo-tag lo-tag--latao">{naoLidos === 1 ? '1 não lido' : `${naoLidos} não lidos`}</span>}
          {resto > 0 && (
            <LinkDoMural alvo={noMural}>
              Mais {resto} no mural
            </LinkDoMural>
          )}
        </>
      }
    >
      {conteudo}
    </Bloco>
  )
}

export function UltimasNoticias({ campanha, mural }: Props) {
  const demo = useDoSite((estado) => estado.demo)
  const agora = useAgora()
  const noMural: Rota = { tela: 'mural', campanhaId: campanha.campanhaId, aba: 'noticias' }
  // Os avisos já estão no alto da página; aqui, o resto, sem as apagadas.
  const noticias = (mural?.noticias ?? []).filter((noticia) => !noticia.fixada && noticia.apagadaEm === null).slice(0, NOTICIAS_NO_LOBBY)

  let conteudo
  if (mural === null || !mural.carregado) conteudo = <SemMural mural={mural} texto="as notícias" />
  else if (noticias.length === 0) conteudo = <p className="lo-saguao__vazio">Nenhuma notícia ainda. O que o mestre postar no mural aparece aqui.</p>
  else {
    conteudo = (
      <ol className="lo-noticias lo-saguao__noticias">
        {noticias.map((noticia) => {
          const src = noticia.imagem === null ? null : urlDaImagem(noticia.imagem, campanha.campanhaId, demo)
          return (
            <li key={noticia.id} className="lo-noticia" data-nova={mural.novas.has(noticia.id) ? '1' : undefined}>
              <span className="lo-av" data-tom={tomDe(noticia.autorContaId)} aria-hidden="true">
                {noticia.autorNome.slice(0, 1).toUpperCase()}
              </span>
              <div className="lo-noticia__corpo">
                <p className="lo-noticia__cab">
                  <span className="lo-noticia__quem">{noticia.autorNome}</span>
                  <time className="lo-noticia__hora" dateTime={new Date(noticia.criadaEm).toISOString()} title={horaExata(noticia.criadaEm)}>
                    {quandoRelativo(noticia.criadaEm, agora)}
                  </time>
                </p>
                <p className="lo-noticia__texto">{noticia.texto}</p>
                {src !== null && (
                  <span className="lo-saguao__miniatura">
                    <img src={src} alt="" loading="lazy" />
                  </span>
                )}
                {noticia.reacoes.length > 0 && (
                  <p className="lo-saguao__reacoes">
                    {noticia.reacoes.map((contagem) => (
                      <span key={contagem.reacao} title={nomeDaReacao(contagem.reacao)}>
                        <span aria-hidden="true">{contagem.reacao}</span>
                        <span className="lo-sr">{nomeDaReacao(contagem.reacao)}:</span> {contagem.total}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <Bloco titulo="Últimas notícias" extra={<LinkDoMural alvo={noMural} rotulo="Ver todas as notícias no mural">Ver no mural</LinkDoMural>}>
      {conteudo}
    </Bloco>
  )
}

export function UltimasModificacoes({ campanha, mural }: Props) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const agora = useAgora()
  const doMural: Rota = { tela: 'mural', campanhaId: campanha.campanhaId, aba: 'modificacoes' }
  const pronto = mural?.pronto === true

  // Aqui o feed é o da mesa inteira, sem filtro (o mural guarda um só): pede quando o lobby abre e de novo quando
  // o canal fica pronto. Pedir o mesmo filtro outra vez não sai de novo.
  useEffect(() => {
    site.mural()?.verModificacoes(null, null)
  }, [site, pronto])

  // Ficha mudou com o lobby aberto: as linhas novas entram no topo.
  const revVista = useRef(campanha.rev)
  useEffect(() => {
    if (campanha.rev === revVista.current) return
    revVista.current = campanha.rev
    const id = setTimeout(() => site.mural()?.atualizarModificacoes(), ESPERA_DA_ATUALIZACAO_MS)
    return () => clearTimeout(id)
  }, [site, campanha.rev])

  const feed = mural?.modificacoes ?? null
  const semFiltro = feed !== null && feed.fichaId === null && feed.autorContaId === null
  const linhas = semFiltro ? feed.lista.slice(0, MODIFICACOES_NO_LOBBY) : []
  const visiveis = new Set(campanha.fichas.map((ficha) => ficha.doc.id))

  let conteudo
  if (mural === null || (!mural.pronto && !mural.carregado)) conteudo = <SemMural mural={mural} texto="as modificações" />
  else if (!semFiltro || !feed.carregada) conteudo = <SemMural mural={mural} texto="as modificações" />
  else if (linhas.length === 0) conteudo = <p className="lo-saguao__vazio">Ninguém mudou as fichas ainda. Cada mudança aparece aqui, com quem fez e quando.</p>
  else {
    conteudo = (
      <ol className="lo-eventos lo-saguao__eventos">
        {linhas.map((linha) => {
          const { quem, resto } = partesDaFrase(linha.frase, linha.autorNome)
          const historico: Rota = { tela: 'ficha', campanhaId: campanha.campanhaId, fichaId: linha.fichaId, aba: 'historico' }
          return (
            <li key={linha.rev} className="lo-ev">
              <span className="lo-av" data-tom={tomDe(linha.autorContaId)} aria-hidden="true">
                {linha.autorNome.slice(0, 1).toUpperCase()}
              </span>
              <div className="lo-ev__corpo">
                <p className="lo-ev__frase">
                  {quem !== '' && <b>{quem}</b>} {resto}
                </p>
                <p className="lo-ev__meta">
                  <time dateTime={new Date(linha.quando).toISOString()} title={horaExata(linha.quando)}>
                    {quandoRelativo(linha.quando, agora)}
                  </time>
                  {visiveis.has(linha.fichaId) ? (
                    <a className="lo-ev__ficha" href={enderecoDaRota(historico, demo)} onClick={aoClicarNoLink(site, historico)} aria-label={`Histórico de ${linha.fichaNome}`}>
                      {linha.fichaNome}
                    </a>
                  ) : (
                    <span>{linha.fichaNome}</span>
                  )}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <Bloco titulo="Últimas modificações" extra={<LinkDoMural alvo={doMural} rotulo="Ver todas as modificações no mural">Ver todas</LinkDoMural>}>
      {conteudo}
    </Bloco>
  )
}
