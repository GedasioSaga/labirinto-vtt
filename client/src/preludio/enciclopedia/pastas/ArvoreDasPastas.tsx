import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { NOME_DA_PASTA_MAX } from '../../../lib/preparo/pastasDeVerbetes'
import { semAcento } from '../../../lib/preparo/enciclopedia'
import { IconeBandeja, IconeMais, IconePasta, IconePilha, IconeSeta } from './icones'

/**
 * A BARRA DAS PASTAS (E3): "Todos", "Sem pasta" e as pastas em árvore. Cada
 * linha é alvo do arrasto (`data-solta-pasta`). Teclado de árvore (WAI-ARIA
 * tree): setas andam, → abre e ← fecha, Enter escolhe, F2 renomeia, Delete
 * apaga, Shift+F10 abre o menu, letra pula.
 *
 * Serve também à barra das REGIÕES de Lugares (16/11): ali as linhas são os
 * lugares que têm lugares dentro, em quantos níveis houver, e renomear, apagar
 * e criar não existem (o nome é o do lugar, mudado na página dele). Por isso
 * essas ações são opcionais: sem a função, a tecla e o botão não aparecem.
 */

export const TODAS = 'todas'
export const SEM = 'sem'

/** Recuo da linha e o a mais de cada nível, em px. */
const RECUO_DA_LINHA = 4
const RECUO_DO_NIVEL = 14

/** Uma linha da árvore, em ordem de árvore (pai antes dos de dentro). A pasta de verdade (`PastaNaArvore`) já tem esta forma. */
export interface RamoDaArvore {
  readonly pasta: { readonly id: string; readonly nome: string; readonly paiId?: string }
  readonly nivel: number
}

interface LinhaDaArvore {
  readonly id: string
  readonly nome: string
  readonly nivel: number
  readonly ehPasta: boolean
  readonly doGrimorio: boolean
  readonly comSubpastas: boolean
  readonly paiId: string | undefined
}

export interface ArvoreDasPastasProps {
  arvore: readonly RamoDaArvore[]
  /** Ids das pastas que vieram do Grimório (o pontinho). */
  doGrimorio?: ReadonlySet<string>
  escolhida: string
  abertas: ReadonlySet<string>
  contas: ReadonlyMap<string, number>
  renomeando?: string | null
  /** Travado (importação, restauração): só escolher e abrir. */
  travado: boolean
  rodape: string
  /** O título da barra ("Pastas", "Regiões"). */
  titulo?: string
  /** Os nomes das duas linhas fixas ("Todos" / "Sem pasta"). */
  rotuloDeTodas?: string
  rotuloDeSem?: string
  /** O ícone das linhas da árvore (a pasta, por padrão). */
  icone?: ReactNode
  aoEscolher: (id: string) => void
  aoAlternar: (id: string) => void
  aoRenomear?: (id: string) => void
  /** `null` = desistiu. */
  aoTerminarRenomear?: (id: string, nome: string | null) => void
  aoApagar?: (id: string) => void
  aoAbrirMenu?: (id: string, gatilho: HTMLElement) => void
  aoNovaPasta?: (gatilho: HTMLElement) => void
}

const NENHUMA: ReadonlySet<string> = new Set()

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
  const { arvore, escolhida, abertas, contas, travado, rodape } = props
  const doGrimorio = props.doGrimorio ?? NENHUMA
  const renomeando = props.renomeando ?? null
  const titulo = props.titulo ?? 'Pastas'
  const [foco, setFoco] = useState(escolhida)
  const raiz = useRef<HTMLDivElement>(null)

  const linhas: LinhaDaArvore[] = [
    { id: TODAS, nome: props.rotuloDeTodas ?? 'Todos', nivel: 0, ehPasta: false, doGrimorio: false, comSubpastas: false, paiId: undefined },
    { id: SEM, nome: props.rotuloDeSem ?? 'Sem pasta', nivel: 0, ehPasta: false, doGrimorio: false, comSubpastas: false, paiId: undefined },
  ]
  // Quem está abaixo de uma linha fechada some, em qualquer profundidade.
  let escondeAbaixoDe = Number.POSITIVE_INFINITY
  for (const [indice, { pasta, nivel }] of arvore.entries()) {
    if (nivel > escondeAbaixoDe) continue
    escondeAbaixoDe = Number.POSITIVE_INFINITY
    const comSubpastas = (arvore[indice + 1]?.nivel ?? -1) > nivel
    linhas.push({ id: pasta.id, nome: pasta.nome, nivel, ehPasta: true, doGrimorio: doGrimorio.has(pasta.id), comSubpastas, paiId: nivel > 0 ? pasta.paiId : undefined })
    if (comSubpastas && !abertas.has(pasta.id)) escondeAbaixoDe = nivel
  }
  const focado = linhas.some((linha) => linha.id === foco) ? foco : escolhida
  const editavel = (linha: LinhaDaArvore) => linha.ehPasta && !travado

  const focarLinha = (id: string | undefined) => {
    if (id === undefined) return
    setFoco(id)
    requestAnimationFrame(() => raiz.current?.querySelector<HTMLElement>(`[data-linha="${CSS.escape(id)}"]`)?.focus())
  }

  const aoTeclar = (linha: LinhaDaArvore, indice: number, evento: KeyboardEvent<HTMLDivElement>) => {
    const pai = linha.paiId
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
        if (!editavel(linha) || props.aoRenomear === undefined) return
        props.aoRenomear(linha.id)
        break
      case 'Delete':
        if (!editavel(linha) || props.aoApagar === undefined) return
        props.aoApagar(linha.id)
        break
      case 'ContextMenu':
        if (!linha.ehPasta || props.aoAbrirMenu === undefined) return
        props.aoAbrirMenu(linha.id, evento.currentTarget)
        break
      case 'F10':
        if (!evento.shiftKey || !linha.ehPasta || props.aoAbrirMenu === undefined) return
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
    props.aoAbrirMenu?.(id, evento.currentTarget)
  }
  const { aoNovaPasta, aoAbrirMenu, aoTerminarRenomear } = props

  return (
    <nav className="pp-pastas" aria-label={titulo}>
      <div className="pp-pastas__cab">
        <h3 className="pp-pastas__tit" id="pp-pastas-titulo">
          {titulo}
        </h3>
        {aoNovaPasta !== undefined && (
          <button type="button" className="gr-bt gr-bt--ic gr-bt--p" aria-label="Nova pasta" title="Nova pasta" disabled={travado} onClick={(evento) => aoNovaPasta(evento.currentTarget)}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" className="pp-ic">
              <path d="M10 4v12M4 10h12" />
            </svg>
          </button>
        )}
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
                if (!linha.ehPasta || aoAbrirMenu === undefined) return
                evento.preventDefault()
                aoAbrirMenu(linha.id, evento.currentTarget)
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
              {linha.id === TODAS ? <IconePilha /> : linha.id === SEM ? <IconeBandeja /> : (props.icone ?? <IconePasta />)}
              <span className="pp-linha__nome" title={linha.nome}>
                {renomeando === linha.id && aoTerminarRenomear !== undefined ? <CampoDoNome id={linha.id} nome={linha.nome} aoTerminar={aoTerminarRenomear} /> : linha.nome}
              </span>
              {linha.doGrimorio && <span className="pp-grimorio" title="Veio do Grimório" />}
              <span className="pp-linha__conta">{contas.get(linha.id) ?? 0}</span>
              {linha.ehPasta && aoAbrirMenu !== undefined && (
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
