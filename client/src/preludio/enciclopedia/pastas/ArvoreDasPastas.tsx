import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { NOME_DA_PASTA_MAX, type PastaNaArvore } from '../../../lib/preparo/pastasDeVerbetes'
import { semAcento } from '../../../lib/preparo/enciclopedia'
import { IconeBandeja, IconeMais, IconePasta, IconePilha, IconeSeta } from './icones'

/**
 * A BARRA DAS PASTAS (E3): "Todos", "Sem pasta" e as pastas em árvore, um
 * nível de subpasta. Cada linha é alvo do arrasto (`data-solta-pasta`).
 * Teclado de árvore (WAI-ARIA tree): setas andam, → abre e ← fecha, Enter
 * escolhe, F2 renomeia, Delete apaga, Shift+F10 abre o menu, letra pula.
 */

export const TODAS = 'todas'
export const SEM = 'sem'

/** Recuo da linha e o a mais de cada nível, em px. */
const RECUO_DA_LINHA = 4
const RECUO_DO_NIVEL = 14

interface LinhaDaArvore {
  readonly id: string
  readonly nome: string
  readonly nivel: number
  readonly ehPasta: boolean
  readonly doGrimorio: boolean
  readonly comSubpastas: boolean
}

export interface ArvoreDasPastasProps {
  arvore: readonly PastaNaArvore[]
  /** Ids das pastas que vieram do Grimório (o pontinho). */
  doGrimorio: ReadonlySet<string>
  escolhida: string
  abertas: ReadonlySet<string>
  contas: ReadonlyMap<string, number>
  renomeando: string | null
  /** Travado (importação, restauração): só escolher e abrir. */
  travado: boolean
  rodape: string
  aoEscolher: (id: string) => void
  aoAlternar: (id: string) => void
  aoRenomear: (id: string) => void
  /** `null` = desistiu. */
  aoTerminarRenomear: (id: string, nome: string | null) => void
  aoApagar: (id: string) => void
  aoAbrirMenu: (id: string, gatilho: HTMLElement) => void
  aoNovaPasta: (gatilho: HTMLElement) => void
}

function CampoDoNome({ id, nome, aoTerminar }: { id: string; nome: string; aoTerminar: (id: string, nome: string | null) => void }) {
  const campo = useRef<HTMLInputElement>(null)
  const terminou = useRef(false)
  useEffect(() => {
    campo.current?.focus()
    campo.current?.select()
  }, [])
  const terminar = (valor: string | null) => {
    if (terminou.current) return
    terminou.current = true
    aoTerminar(id, valor)
  }
  return (
    <input
      ref={campo}
      type="text"
      className="pp-arvore__campo"
      defaultValue={nome}
      maxLength={NOME_DA_PASTA_MAX}
      aria-label="Nome da pasta"
      onClick={(evento) => evento.stopPropagation()}
      onKeyDown={(evento) => {
        evento.stopPropagation()
        if (evento.key === 'Enter') {
          evento.preventDefault()
          terminar(evento.currentTarget.value)
        } else if (evento.key === 'Escape') {
          evento.preventDefault()
          terminar(null)
        }
      }}
      onBlur={(evento) => terminar(evento.currentTarget.value)}
    />
  )
}

export function ArvoreDasPastas(props: ArvoreDasPastasProps) {
  const { arvore, doGrimorio, escolhida, abertas, contas, renomeando, travado, rodape } = props
  const [foco, setFoco] = useState(escolhida)
  const raiz = useRef<HTMLDivElement>(null)

  const linhas: LinhaDaArvore[] = [
    { id: TODAS, nome: 'Todos', nivel: 0, ehPasta: false, doGrimorio: false, comSubpastas: false },
    { id: SEM, nome: 'Sem pasta', nivel: 0, ehPasta: false, doGrimorio: false, comSubpastas: false },
  ]
  for (const [indice, { pasta, nivel }] of arvore.entries()) {
    if (nivel === 1 && (pasta.paiId === undefined || !abertas.has(pasta.paiId))) continue
    const comSubpastas = arvore[indice + 1]?.nivel === 1 && nivel === 0
    linhas.push({ id: pasta.id, nome: pasta.nome, nivel, ehPasta: true, doGrimorio: doGrimorio.has(pasta.id), comSubpastas })
  }
  const focado = linhas.some((linha) => linha.id === foco) ? foco : escolhida

  const focarLinha = (id: string | undefined) => {
    if (id === undefined) return
    setFoco(id)
    requestAnimationFrame(() => raiz.current?.querySelector<HTMLElement>(`[data-linha="${CSS.escape(id)}"]`)?.focus())
  }

  const aoTeclar = (linha: LinhaDaArvore, indice: number, evento: KeyboardEvent<HTMLDivElement>) => {
    const pai = linha.nivel === 1 ? arvore.find(({ pasta }) => pasta.id === linha.id)?.pasta.paiId : undefined
    switch (evento.key) {
      case 'ArrowDown':
        focarLinha(linhas[indice + 1]?.id)
        break
      case 'ArrowUp':
        focarLinha(linhas[indice - 1]?.id)
        break
      case 'Home':
        focarLinha(linhas[0]?.id)
        break
      case 'End':
        focarLinha(linhas[linhas.length - 1]?.id)
        break
      case 'ArrowRight':
        if (!linha.comSubpastas) return
        if (abertas.has(linha.id)) focarLinha(linhas[indice + 1]?.id)
        else props.aoAlternar(linha.id)
        break
      case 'ArrowLeft':
        if (linha.comSubpastas && abertas.has(linha.id)) props.aoAlternar(linha.id)
        else if (pai !== undefined) focarLinha(pai)
        else return
        break
      case 'Enter':
      case ' ':
        props.aoEscolher(linha.id)
        break
      case 'F2':
        if (!linha.ehPasta || travado) return
        props.aoRenomear(linha.id)
        break
      case 'Delete':
        if (!linha.ehPasta || travado) return
        props.aoApagar(linha.id)
        break
      case 'ContextMenu':
        if (!linha.ehPasta) return
        props.aoAbrirMenu(linha.id, evento.currentTarget)
        break
      case 'F10':
        if (!evento.shiftKey || !linha.ehPasta) return
        props.aoAbrirMenu(linha.id, evento.currentTarget)
        break
      default: {
        if (evento.key.length !== 1 || evento.ctrlKey || evento.altKey || evento.metaKey || !/\S/.test(evento.key)) return
        const letra = semAcento(evento.key)
        const seguintes = [...linhas.slice(indice + 1), ...linhas.slice(0, indice + 1)]
        focarLinha(seguintes.find((outra) => semAcento(outra.nome).startsWith(letra))?.id)
      }
    }
    evento.preventDefault()
  }

  const abrirMenu = (id: string, evento: MouseEvent<HTMLButtonElement>) => {
    evento.stopPropagation()
    props.aoAbrirMenu(id, evento.currentTarget)
  }

  return (
    <nav className="pp-pastas" aria-label="Pastas">
      <div className="pp-pastas__cab">
        <h3 className="pp-pastas__tit" id="pp-pastas-titulo">
          Pastas
        </h3>
        <button type="button" className="gr-bt gr-bt--ic gr-bt--p" aria-label="Nova pasta" title="Nova pasta" disabled={travado} onClick={(evento) => props.aoNovaPasta(evento.currentTarget)}>
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" className="pp-ic">
            <path d="M10 4v12M4 10h12" />
          </svg>
        </button>
      </div>
      <div className="pp-arvore" role="tree" aria-labelledby="pp-pastas-titulo" ref={raiz}>
        {linhas.map((linha, indice) => (
          <div key={linha.id} role="none">
            {linha.id === SEM ? null : indice === 2 ? <div className="pp-arvore__sep" role="none" /> : null}
            <div
              className="pp-linha"
              role="treeitem"
              aria-level={linha.nivel + 1}
              aria-selected={escolhida === linha.id}
              aria-expanded={linha.comSubpastas ? abertas.has(linha.id) : undefined}
              tabIndex={focado === linha.id ? 0 : -1}
              data-linha={linha.id}
              data-solta-pasta={linha.id === TODAS ? undefined : linha.id}
              style={{ paddingInlineStart: RECUO_DA_LINHA + linha.nivel * RECUO_DO_NIVEL }}
              onFocus={() => setFoco(linha.id)}
              onClick={() => props.aoEscolher(linha.id)}
              onKeyDown={(evento) => {
                if (evento.target === evento.currentTarget) aoTeclar(linha, indice, evento)
              }}
              onContextMenu={(evento) => {
                if (!linha.ehPasta) return
                evento.preventDefault()
                props.aoAbrirMenu(linha.id, evento.currentTarget)
              }}
            >
              {linha.comSubpastas ? (
                <span
                  className="pp-linha__seta"
                  aria-hidden="true"
                  onClick={(evento) => {
                    evento.stopPropagation()
                    props.aoAlternar(linha.id)
                  }}
                >
                  <IconeSeta />
                </span>
              ) : (
                <span className="pp-linha__seta pp-linha__seta--vazia" aria-hidden="true" />
              )}
              {linha.id === TODAS ? <IconePilha /> : linha.id === SEM ? <IconeBandeja /> : <IconePasta />}
              <span className="pp-linha__nome">{renomeando === linha.id ? <CampoDoNome id={linha.id} nome={linha.nome} aoTerminar={props.aoTerminarRenomear} /> : linha.nome}</span>
              {linha.doGrimorio && <span className="pp-grimorio" title="Veio do Grimório" />}
              <span className="pp-linha__conta">{contas.get(linha.id) ?? 0}</span>
              {linha.ehPasta && (
                <button type="button" className="pp-linha__mais" tabIndex={-1} aria-label={`Ações da pasta ${linha.nome}`} aria-haspopup="menu" onClick={(evento) => abrirMenu(linha.id, evento)}>
                  <IconeMais />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="pp-pastas__pe">
        <p className="pr-quieto">{rodape}</p>
      </div>
    </nav>
  )
}
