import { useEffect, useId, useRef, useState } from 'react'
import { MURAL_REACOES, type NoticiaDoMural, type ReacaoDoMural } from '../../../lib/nuvem/muralDoLobby'
import type { MembroProjetado } from '../../../lib/nuvem/tipos'
import type { AcaoNaNoticia, RecusaNaNoticia } from '../../dados/muralDaCampanha'
import { pedacosDoTexto } from '../chat/textosDoChat'
import { useSite } from '../contexto'
import { Icone } from '../Icone'
import { Rosto } from '../Rosto'
import { horaExata, quandoRelativo } from '../textos'
import { motivoDaSoLeitura, useSoLeitura } from '../VerComo'
import { EscreverNoticia, type ImagemParaEscolher } from './EscreverNoticia'
import { nomeDaReacao, textoDaRecusa, urlDaImagem } from './textosDoMural'

/**
 * UMA NOTÍCIA DO MURAL: quem postou e quando, o texto (sempre literal, filho
 * de texto do React, nunca HTML), a imagem pela rota de mídia da campanha e as
 * reações da lista fixa. O mestre edita, fixa e apaga (apagar pede
 * confirmação e deixa lápide). O aviso fixado não lido tem "Marcar como lido".
 */

interface Props {
  noticia: NoticiaDoMural
  eu: MembroProjetado | null
  souMestre: boolean
  membros: readonly MembroProjetado[]
  pronto: boolean
  aCaminho: AcaoNaNoticia | undefined
  recusa: RecusaNaNoticia | undefined
  nova: boolean
  campanhaId: string
  demo: boolean
  imagens: readonly ImagemParaEscolher[]
  agora: number
}

export function CartaoDaNoticia({ noticia, eu, souMestre, membros, pronto, aCaminho, recusa, nova, campanhaId, demo, imagens, agora }: Props) {
  const site = useSite()
  const quemId = useId()
  // "Ver como": reagir e marcar como lido gravariam em nome do mestre. Ficam desligados, com o motivo.
  const soLeitura = useSoLeitura()
  const motivo = soLeitura === null ? null : motivoDaSoLeitura(soLeitura.nome)
  const [editando, setEditando] = useState(false)
  /** A versão de quando a edição saiu: a notícia com versão maior fecha o editor. */
  const [versaoDaEdicao, setVersaoDaEdicao] = useState<number | null>(null)
  const [confirmandoApagar, setConfirmandoApagar] = useState(false)
  const botaoEditar = useRef<HTMLButtonElement>(null)
  const apagada = noticia.apagadaEm !== null
  const souAutor = eu !== null && noticia.autorContaId === eu.contaId

  useEffect(() => {
    if (versaoDaEdicao === null || noticia.versao <= versaoDaEdicao) return
    setEditando(false)
    setVersaoDaEdicao(null)
    requestAnimationFrame(() => botaoEditar.current?.focus())
  }, [noticia.versao, versaoDaEdicao])

  // A recusa da edição devolve o botão "Salvar" (o texto continua no editor).
  useEffect(() => {
    if (recusa?.acao === 'editar') setVersaoDaEdicao(null)
  }, [recusa])

  function fecharEditor() {
    setEditando(false)
    setVersaoDaEdicao(null)
    site.mural()?.esquecerRecusa(noticia.id)
    requestAnimationFrame(() => botaoEditar.current?.focus())
  }

  function reagir(reacao: ReacaoDoMural) {
    site.mural()?.reagir(noticia.id, noticia.minhaReacao === reacao ? null : reacao)
  }

  const imagemSrc = noticia.imagem === null ? null : urlDaImagem(noticia.imagem, campanhaId, demo)
  const editada = noticia.editadaEm !== null && !apagada
  const avisoNaoLido = noticia.fixada && !noticia.lida && !souAutor && !apagada

  return (
    <article className="lo-noticia" aria-labelledby={quemId} data-fixada={noticia.fixada && !apagada ? '1' : undefined} data-nova={nova ? '1' : undefined}>
      <Rosto contaId={noticia.autorContaId} nome={noticia.autorNome} />
      <div className="lo-noticia__corpo">
        <header className="lo-noticia__cab">
          <span className="lo-noticia__quem" id={quemId}>
            {noticia.autorNome}
          </span>
          <span className="lo-noticia__papel">mestre</span>
          <time className="lo-noticia__hora" dateTime={new Date(noticia.criadaEm).toISOString()} title={horaExata(noticia.criadaEm)}>
            {quandoRelativo(noticia.criadaEm, agora)}
          </time>
          {editada && noticia.editadaEm !== null && (
            <span className="lo-noticia__hora" title={`Editada ${horaExata(noticia.editadaEm)}`}>
              editada
            </span>
          )}
          {noticia.fixada && !apagada && (
            <span className="lo-tag lo-tag--latao">
              <Icone nome="fixar" /> Aviso fixado
            </span>
          )}
          {souMestre && !apagada && !editando && (
            <div className="lo-noticia__acoes">
              <button type="button" ref={botaoEditar} className="lo-btn lo-btn--fantasma" onClick={() => setEditando(true)} disabled={aCaminho !== undefined}>
                <Icone nome="editar" /> Editar
              </button>
              <button
                type="button"
                className="lo-btn lo-btn--fantasma"
                onClick={() => site.mural()?.fixar(noticia.id, !noticia.fixada)}
                disabled={!pronto || aCaminho !== undefined}
                title={pronto ? undefined : 'Sem conexão: volta quando ela voltar.'}
              >
                {aCaminho === 'fixar' ? <span className="lo-giro" aria-hidden="true" /> : <Icone nome="fixar" />}
                {noticia.fixada ? 'Desafixar' : 'Fixar como aviso'}
              </button>
              <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => setConfirmandoApagar(true)} disabled={!pronto || aCaminho !== undefined}>
                {aCaminho === 'apagar' ? <span className="lo-giro" aria-hidden="true" /> : <Icone nome="tirar" />} Apagar
              </button>
            </div>
          )}
        </header>

        {apagada ? (
          <p className="lo-noticia__lapide">O mestre apagou esta notícia.</p>
        ) : editando ? (
          <EscreverNoticia
            modo="editar"
            textoInicial={noticia.texto}
            imagemInicial={noticia.imagem}
            imagens={imagens}
            pronto={pronto}
            salvando={aCaminho === 'editar' || versaoDaEdicao !== null}
            aoEnviar={(texto, imagem) => {
              const foi = site.mural()?.editar(noticia.id, texto, imagem) ?? false
              if (foi) setVersaoDaEdicao(noticia.versao)
              return foi
            }}
            aoCancelar={fecharEditor}
          />
        ) : (
          <>
            <p className="lo-noticia__texto">
              {pedacosDoTexto(noticia.texto, membros, eu).map((pedaco, i) =>
                pedaco.t === 'texto' ? (
                  <span key={i}>{pedaco.texto}</span>
                ) : (
                  <span key={i} className="lo-chat__mencao" data-a-mim={pedaco.aMim ? '1' : undefined}>
                    {pedaco.texto}
                  </span>
                ),
              )}
            </p>
            {noticia.imagem !== null && <ImagemDaNoticia key={noticia.imagem} src={imagemSrc} autor={noticia.autorNome} />}
          </>
        )}

        {confirmandoApagar && !apagada && (
          <div
            className="lo-confirma"
            role="group"
            aria-label="Confirmar apagar"
            onKeyDown={(evento) => {
              if (evento.key === 'Escape') setConfirmandoApagar(false)
            }}
          >
            <p>Apagar esta notícia? Some o texto, a imagem e as reações; fica só a marca de que ela existiu.</p>
            <div>
              <button
                type="button"
                className="lo-btn lo-btn--primario"
                autoFocus
                disabled={!pronto}
                onClick={() => {
                  if (site.mural()?.apagar(noticia.id) === true) setConfirmandoApagar(false)
                }}
              >
                Apagar a notícia
              </button>
              <button type="button" className="lo-btn" onClick={() => setConfirmandoApagar(false)}>
                Manter
              </button>
            </div>
          </div>
        )}

        {recusa !== undefined && (
          <p className="lo-erro-campo" role="alert">
            {recusa.acao === 'reagir' ? 'A reação não foi' : recusa.acao === 'editar' ? 'A edição não foi' : recusa.acao === 'fixar' ? 'Não deu para fixar' : 'Não deu para apagar'}: {textoDaRecusa(recusa.motivo)}
          </p>
        )}

        {!apagada && (
          <div className="lo-noticia__pe">
            <div className="lo-reacoes" role="group" aria-label="Reações">
              {MURAL_REACOES.map((reacao) => {
                const total = noticia.reacoes.find((contagem) => contagem.reacao === reacao)?.total ?? 0
                const minha = noticia.minhaReacao === reacao
                return (
                  <button
                    key={reacao}
                    type="button"
                    className="lo-reacao"
                    data-tem={total > 0 ? '1' : undefined}
                    aria-pressed={minha}
                    aria-label={`${nomeDaReacao(reacao)}: ${total} ${total === 1 ? 'pessoa' : 'pessoas'}${minha ? ', inclusive você' : ''}`}
                    title={motivo ?? (pronto ? nomeDaReacao(reacao) : 'Sem conexão: volta quando ela voltar.')}
                    disabled={!pronto || motivo !== null}
                    onClick={() => reagir(reacao)}
                  >
                    <span className="lo-reacao__emoji" aria-hidden="true">
                      {reacao}
                    </span>
                    {total > 0 && <span aria-hidden="true">{total}</span>}
                  </button>
                )
              })}
            </div>
            {avisoNaoLido && (
              <button type="button" className="lo-btn" disabled={motivo !== null} onClick={() => site.mural()?.marcarLido(noticia.id, noticia.versao)}>
                <Icone nome="visto" /> Marcar como lido
              </button>
            )}
            {motivo !== null && <span className="lo-motivo">{motivo} Reagir fica desligado.</span>}
          </div>
        )}
      </div>
    </article>
  )
}

function ImagemDaNoticia({ src, autor }: { src: string | null; autor: string }) {
  const [falhou, setFalhou] = useState(false)
  return (
    <figure className="lo-noticia__imagem">
      {src === null || falhou ? (
        <p className="lo-noticia__imagem-falhou">A imagem não carregou. Ela volta quando o Lobby conseguir buscá-la.</p>
      ) : (
        <img src={src} alt={`Imagem que ${autor} pôs na notícia`} loading="lazy" decoding="async" onError={() => setFalhou(true)} />
      )}
    </figure>
  )
}
