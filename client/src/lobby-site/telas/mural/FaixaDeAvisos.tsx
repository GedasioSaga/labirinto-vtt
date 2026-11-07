import { useState } from 'react'
import type { NoticiaDoMural } from '../../../lib/nuvem/muralDoLobby'
import { enderecoDaRota, type Rota } from '../../dados/rotas'
import { aoClicarNoLink, useAgora, useDoSite, useSite } from '../contexto'
import { Icone } from '../Icone'
import { horaExata, quandoRelativo } from '../textos'
import { useSoLeitura } from '../VerComo'
import './mural.css'

/**
 * OS AVISOS AO ENTRAR (fatia M2): em toda tela da mesa, logo abaixo da cabeça,
 * o aviso que o mestre fixou e que a pessoa ainda não marcou como lido. Some
 * ao marcar (na hora; o servidor guarda o lido por conta) e volta se o mestre
 * editar ou fixar de novo. No mural ele não aparece aqui: lá os avisos estão
 * no topo da lista. No chat a folha ocupa a janela, então o aviso vira uma
 * linha só, de altura fixa, que a folha desconta (`mural.css`).
 */

/** Mais do que isto de uma vez vira "mais N avisos no mural". */
const AVISOS_NA_FAIXA = 2
/** A saída do aviso lido (mais rápida que a entrada de 220 ms). */
const SAIDA_MS = 150

export function FaixaDeAvisos() {
  const demo = useDoSite((estado) => estado.demo)
  const rota = useDoSite((estado) => estado.rota)
  const mural = useDoSite((estado) => estado.mural)
  const campanha = useDoSite((estado) => estado.campanha)
  const agora = useAgora()
  if (mural === null || campanha === null || rota.tela === 'mural') return null
  const eu = campanha.eu
  const avisos = mural.fixadas.filter((noticia) => !noticia.lida && noticia.autorContaId !== eu?.contaId)
  if (avisos.length === 0) return null
  const noMural: Rota = { tela: 'mural', campanhaId: campanha.campanhaId, aba: 'noticias' }
  const resto = avisos.length - AVISOS_NA_FAIXA

  if (rota.tela === 'chat') {
    const [primeiro] = avisos
    return (
      <section className="lo-avisos lo-avisos--linha" aria-label="Avisos do mestre">
        <AvisoFixado
          key={`${primeiro.id}:${primeiro.versao}`}
          noticia={primeiro}
          noMural={noMural}
          demo={demo}
          agora={agora}
          linha={avisos.length > 1 ? `Ver os ${avisos.length} no mural` : 'Ver no mural'}
        />
      </section>
    )
  }

  return (
    <section className="lo-avisos" aria-label="Avisos do mestre">
      {avisos.slice(0, AVISOS_NA_FAIXA).map((noticia) => (
        <AvisoFixado key={`${noticia.id}:${noticia.versao}`} noticia={noticia} noMural={noMural} demo={demo} agora={agora} />
      ))}
      {resto > 0 && (
        <p className="lo-avisos__mais">
          Mais {resto} {resto === 1 ? 'aviso' : 'avisos'} no{' '}
          <MuralLink alvo={noMural} demo={demo}>
            mural
          </MuralLink>
          .
        </p>
      )}
    </section>
  )
}

function MuralLink({ alvo, demo, children }: { alvo: Rota; demo: boolean; children: string }) {
  const site = useSite()
  return (
    <a href={enderecoDaRota(alvo, demo)} onClick={aoClicarNoLink(site, alvo)}>
      {children}
    </a>
  )
}

interface PropsDoAviso {
  noticia: NoticiaDoMural
  noMural: Rota
  demo: boolean
  agora: number
  /** Na forma de uma linha só (no chat): o rótulo do link para o mural. */
  linha?: string
}

function AvisoFixado({ noticia, noMural, demo, agora, linha }: PropsDoAviso) {
  const site = useSite()
  const [saindo, setSaindo] = useState(false)
  // "Ver como": o "lido" seria o do mestre. A faixa é de uma linha: o botão sai, o link para o mural fica.
  const soLeitura = useSoLeitura()

  function marcarLido() {
    if (saindo) return
    const mural = site.mural()
    setSaindo(true)
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(
      () => {
        mural?.marcarLido(noticia.id, noticia.versao)
        // O botão some junto com o aviso: o foco volta ao começo do conteúdo, sem pular a tela.
        document.getElementById('conteudo')?.focus({ preventScroll: true })
      },
      reduzido ? 0 : SAIDA_MS,
    )
  }

  return (
    <article className="lo-aviso-fixo" data-entra="1" data-saindo={saindo ? '1' : undefined} aria-label={`Aviso de ${noticia.autorNome}`}>
      <span className="lo-aviso-fixo__pino" aria-hidden="true">
        <Icone nome="fixar" />
      </span>
      {linha === undefined ? (
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
      ) : (
        // Uma linha: o texto inteiro fica no title e no mural; aqui ele corta com reticências.
        <p className="lo-aviso-fixo__linha" title={noticia.texto}>
          <b>Aviso de {noticia.autorNome}:</b> {noticia.texto}
        </p>
      )}
      <div className="lo-aviso-fixo__acoes">
        <MuralLink alvo={noMural} demo={demo}>
          {linha ?? 'Ver no mural'}
        </MuralLink>
        {soLeitura === null && (
          <button type="button" className="lo-btn lo-btn--primario" onClick={marcarLido} disabled={saindo} aria-label="Marcar como lido">
            <Icone nome="visto" /> <span className="lo-aviso-fixo__rotulo">Marcar como lido</span>
          </button>
        )}
      </div>
    </article>
  )
}
