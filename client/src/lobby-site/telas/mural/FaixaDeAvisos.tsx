import { useState } from 'react'
import type { NoticiaDoMural } from '../../../lib/nuvem/muralDoLobby'
import { enderecoDaRota, type Rota } from '../../dados/rotas'
import { aoClicarNoLink, useAgora, useDoSite, useSite } from '../contexto'
import { Icone } from '../Icone'
import { horaExata, quandoRelativo } from '../textos'
import './mural.css'

/**
 * OS AVISOS AO ENTRAR (fatia M2): em toda tela da mesa, logo abaixo da cabeça,
 * o aviso que o mestre fixou e que a pessoa ainda não marcou como lido. Some
 * ao marcar (na hora; o servidor guarda o lido por conta) e volta se o mestre
 * editar ou fixar de novo. No mural ele não aparece aqui: lá os avisos estão
 * no topo da lista.
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

function AvisoFixado({ noticia, noMural, demo, agora }: { noticia: NoticiaDoMural; noMural: Rota; demo: boolean; agora: number }) {
  const site = useSite()
  const [saindo, setSaindo] = useState(false)

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
        <MuralLink alvo={noMural} demo={demo}>
          Ver no mural
        </MuralLink>
        <button type="button" className="lo-btn lo-btn--primario" onClick={marcarLido} disabled={saindo}>
          <Icone nome="visto" /> Marcar como lido
        </button>
      </div>
    </article>
  )
}
