import { useEffect, useId, useMemo, useRef, type KeyboardEvent } from 'react'
import { BackIcon } from '../components/icons'
import { ehDaEscrita, naCampanha, ROTULO_DO_TIPO, TIPOS_DA_ENCICLOPEDIA, type NoDaArvore } from '../lib/preparo/enciclopedia'
import type { TipoDeVerbete } from '../lib/preparo/tipos'
import { Arvore, type ItemDaArvore } from './arvore/Arvore'
import { useCadernos, useNovoCaderno } from './escrita/Escrita'
import { usePreludio } from './estado/preludio'
import { useNovaSessao, useSessoes } from './sessoes/Sessoes'
import { SUBTITULO_DO_PRELUDIO, TITULO_DO_PRELUDIO } from './textos'

/**
 * A BARRA LATERAL DO PRELÚDIO: voltar, o filtro "Campanha" (como no Grimório),
 * a busca, as seções (Início, Sessões, Enciclopédia por tipo, Escrita em
 * árvore) e, embaixo, se está tudo salvo.
 */

/** Quantas sessões a barra mostra: as últimas, a mais recente embaixo, junto do "+ Nova sessão". */
const SESSOES_NA_BARRA = 5

function itensDosCadernos(nos: readonly NoDaArvore[]): ItemDaArvore[] {
  return nos.map((no) => ({ id: no.verbete.id, rotulo: no.verbete.titulo || 'Sem nome', filhos: itensDosCadernos(no.filhos) }))
}

/** Pediu para sair com algo que não gravou. */
export interface SaidaPendente {
  aoSair: () => void
  aoFicar: () => void
}

/** A pergunta antes de sair: "Ficar" é o padrão (o foco cai nele) e Esc desiste, sem tirar o mestre da tela. */
function PerguntaDeSaida({ aoSair, aoFicar }: SaidaPendente) {
  const id = useId()
  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'Escape') return
    evento.preventDefault()
    evento.stopPropagation()
    aoFicar()
  }
  return (
    <div className="pr-salvo__sair" role="group" aria-labelledby={id} onKeyDown={aoTeclar}>
      <p className="pr-salvo__texto" id={id}>
        Sair mesmo assim? O que não salvou fica guardado até você fechar o Labirinto, e o Prelúdio tenta gravar de novo quando você voltar.
      </p>
      <div className="pr-salvo__acoes">
        <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoSair}>
          Sair mesmo assim
        </button>
        <button type="button" className="gr-bt gr-bt--p gr-bt--latao" autoFocus onClick={aoFicar}>
          Ficar
        </button>
      </div>
    </div>
  )
}

function Salvamento({ saida }: { saida?: SaidaPendente }) {
  const salvamento = usePreludio((estado) => estado.salvamento)
  const tentarDeNovo = usePreludio((estado) => estado.tentarDeNovo)
  if (salvamento.t === 'falhou') {
    return (
      <>
        <div className="pr-salvo pr-salvo--falhou" role="alert">
          <p className="pr-salvo__texto">Não salvou: {salvamento.motivo} O texto continua aqui.</p>
          <button type="button" className="gr-bt gr-bt--p gr-bt--perigo" onClick={tentarDeNovo}>
            Tentar de novo
          </button>
        </div>
        {saida !== undefined && <PerguntaDeSaida {...saida} />}
      </>
    )
  }
  return (
    <p className="pr-salvo" role="status" data-estado={salvamento.t}>
      <span className="pr-salvo__ponto" aria-hidden="true" />
      {salvamento.t === 'em-dia' ? 'Tudo salvo neste PC' : 'Salvando…'}
    </p>
  )
}

interface LadoProps {
  /** Ausente enquanto a importação ou a restauração gravam: sair no meio deixaria a tela sem o aviso de como terminou. */
  aoVoltar?: () => void
  aoBuscar: () => void
  /** Presente quando o mestre pediu para sair e algo não gravou: o rodapé pergunta. */
  saida?: SaidaPendente
}

export function Lado({ aoVoltar, aoBuscar, saida }: LadoProps) {
  const lugar = usePreludio((estado) => estado.lugar)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const pronta = usePreludio((estado) => estado.carga.t === 'pronta')
  const travado = usePreludio((estado) => estado.travado)
  const ir = usePreludio((estado) => estado.ir)
  const escolherCampanha = usePreludio((estado) => estado.escolherCampanha)
  const cadernos = useCadernos()
  const novoCaderno = useNovoCaderno()
  const sessoes = useSessoes()
  const novaSessao = useNovaSessao()
  const titulo = useRef<HTMLHeadingElement>(null)
  const voltar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    titulo.current?.focus({ preventScroll: true })
  }, [])

  // Ficar devolve o foco ao Voltar, de onde a pergunta saiu (senão ele cairia no body).
  const saidaDoRodape: SaidaPendente | undefined =
    saida === undefined
      ? undefined
      : {
          aoSair: saida.aoSair,
          aoFicar: () => {
            saida.aoFicar()
            voltar.current?.focus()
          },
        }

  const contas = useMemo(() => {
    const porTipo = new Map<TipoDeVerbete, number>()
    let todos = 0
    for (const verbete of verbetes.values()) {
      if (!TIPOS_DA_ENCICLOPEDIA.includes(verbete.tipo) || !naCampanha(verbete, campanhaId)) continue
      if (verbete.tipo === 'pagina' && !ehDaEscrita(verbete, verbetes)) continue
      porTipo.set(verbete.tipo, (porTipo.get(verbete.tipo) ?? 0) + 1)
      todos += 1
    }
    return { porTipo, todos }
  }, [verbetes, campanhaId])
  const itensDaEscrita = useMemo(() => itensDosCadernos(cadernos), [cadernos])

  const sessoesNaBarra = sessoes.slice(-SESSOES_NA_BARRA)
  const sessaoAberta = lugar.secao === 'sessoes' ? lugar.sessaoId : null
  const naEnciclopedia = (tipo: TipoDeVerbete | 'todos') => lugar.secao === 'enciclopedia' && lugar.tipo === tipo && lugar.verbeteId === null
  const doTipoAberto = (tipo: TipoDeVerbete | 'todos') => lugar.secao === 'enciclopedia' && lugar.tipo === tipo

  return (
    <aside className="pr-lado" aria-label="Navegação do Prelúdio">
      <div className="pr-lado__topo">
        {aoVoltar !== undefined && (
          <button ref={voltar} type="button" className="gr-bt gr-bt--p gr-bt--fantasma pr-lado__voltar" onClick={aoVoltar}>
            <BackIcon />
            Voltar
          </button>
        )}
        <h1 className="pr-lado__titulo" ref={titulo} tabIndex={-1}>
          {TITULO_DO_PRELUDIO}
        </h1>
        <p className="pr-lado__subtitulo">{SUBTITULO_DO_PRELUDIO}</p>
      </div>

      <label className="pr-campo">
        <span className="pr-campo__rotulo">Campanha</span>
        <select className="pr-campo__entrada" value={campanhaId ?? ''} disabled={campanhas.length === 0} onChange={(evento) => escolherCampanha(evento.target.value === '' ? null : evento.target.value)}>
          <option value="">Todas</option>
          {campanhas.map((campanha) => (
            <option key={campanha.id} value={campanha.id}>
              {campanha.nome}
            </option>
          ))}
        </select>
      </label>

      <button type="button" className="pr-lado__busca" onClick={aoBuscar} disabled={!pronta}>
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4 4" />
        </svg>
        <span>Buscar no texto</span>
        <span className="pr-lado__atalho" aria-label="atalho Ctrl+K">
          <kbd className="gr-kbd">Ctrl</kbd>
          <kbd className="gr-kbd">K</kbd>
        </span>
      </button>

      <nav className="pr-nav" aria-label="Seções do Prelúdio">
        <button type="button" className="pr-nav__item" aria-current={lugar.secao === 'inicio' ? 'page' : undefined} onClick={() => ir({ secao: 'inicio' })}>
          Início
        </button>

        <h2 className="pr-nav__grupo">Sessões</h2>
        <ul className="pr-nav__lista">
          <li>
            <button
              type="button"
              className="pr-nav__item"
              aria-current={lugar.secao === 'sessoes' ? (sessaoAberta === null ? 'page' : 'true') : undefined}
              disabled={!pronta}
              onClick={() => ir({ secao: 'sessoes', sessaoId: null })}
            >
              <span>Todas</span>
              <span className="pr-nav__conta">{sessoes.length}</span>
            </button>
          </li>
          {sessoesNaBarra.map((sessao) => (
            <li key={sessao.id}>
              <button type="button" className="pr-nav__item" aria-current={sessaoAberta === sessao.id ? 'page' : undefined} title={sessao.titulo || 'Sessão sem nome'} onClick={() => ir({ secao: 'sessoes', sessaoId: sessao.id })}>
                <span className="pr-nav__nome">{sessao.titulo || 'Sessão sem nome'}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="pr-nav__novo" disabled={!pronta || travado} onClick={() => void novaSessao()}>
          + Nova sessão
        </button>

        <h2 className="pr-nav__grupo">Enciclopédia</h2>
        <ul className="pr-nav__lista">
          <li>
            <button
              type="button"
              className="pr-nav__item"
              aria-current={naEnciclopedia('todos') ? 'page' : doTipoAberto('todos') ? 'true' : undefined}
              disabled={!pronta}
              onClick={() => ir({ secao: 'enciclopedia', tipo: 'todos', verbeteId: null })}
            >
              <span>Tudo</span>
              <span className="pr-nav__conta">{contas.todos}</span>
            </button>
          </li>
          {TIPOS_DA_ENCICLOPEDIA.map((tipo) => (
            <li key={tipo}>
              <button
                type="button"
                className="pr-nav__item"
                aria-current={naEnciclopedia(tipo) ? 'page' : doTipoAberto(tipo) ? 'true' : undefined}
                disabled={!pronta}
                onClick={() => ir({ secao: 'enciclopedia', tipo, verbeteId: null })}
              >
                <span>{ROTULO_DO_TIPO[tipo].varios}</span>
                <span className="pr-nav__conta">{contas.porTipo.get(tipo) ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>

        <h2 className="pr-nav__grupo">
          <button type="button" className="pr-nav__grupo-bt" aria-current={lugar.secao === 'escrita' && lugar.paginaId === null ? 'page' : undefined} disabled={!pronta} onClick={() => ir({ secao: 'escrita', paginaId: null })}>
            Escrita
          </button>
        </h2>
        {itensDaEscrita.length > 0 && (
          <Arvore itens={itensDaEscrita} rotulo="Cadernos da Escrita" selecionado={lugar.secao === 'escrita' ? lugar.paginaId : null} aoAbrir={(id) => ir({ secao: 'escrita', paginaId: id })} classe="pr-arvore--lado" />
        )}
        <button type="button" className="pr-nav__novo" disabled={!pronta || travado} onClick={() => void novoCaderno()}>
          + Novo caderno
        </button>
      </nav>

      <div className="pr-lado__pe">
        <Salvamento saida={saidaDoRodape} />
      </div>
    </aside>
  )
}
