import { useDeferredValue, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { compararTitulos, formaDe, naCampanha, ROTULO_DO_TIPO, semAcento, TIPOS_DA_ENCICLOPEDIA } from '../../lib/preparo/enciclopedia'
import type { TipoDeVerbete, Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { urlDaMidia, useRaizDaMidia } from '../midia'
import { MIME_DO_VERBETE, viraCartao } from './quadroAtivo'

/**
 * A GAVETA DE VERBETES DO QUADRO (fatia F3b): a paleta de onde o mestre arrasta
 * um verbete para o quadro, como a barra lateral do Grimório. Arrastar põe o
 * cartão onde soltar; Enter (ou clique) põe no meio da vista e, se o verbete já
 * está no quadro, mostra o cartão. Setas sobem e descem na lista; Esc fecha.
 */

const TIPOS_DE_CARTAO: readonly TipoDeVerbete[] = TIPOS_DA_ENCICLOPEDIA.filter(viraCartao)

export interface GavetaDeVerbetesProps {
  id: string
  /** A campanha do quadro (ou a do filtro); `null` = todas. */
  campanhaId: string | null
  /** Verbetes que já têm cartão no quadro. */
  noQuadro: ReadonlySet<string>
  editavel: boolean
  /** Setas das ligações que faltam entre os cartões do quadro. */
  faltam: number
  aoEscolher: (verbete: Verbete) => void
  aoDesenharSetas: () => void
  aoFechar: () => void
  /** Aberta agora pelo botão: assenta (aberta junto com o quadro, aparece parada). */
  entra?: boolean
}

function Retrato({ verbete, raiz }: { verbete: Verbete; raiz: string | null }) {
  const retrato = raiz === null ? null : urlDaMidia(raiz, formaDe(verbete, null)?.retrato)
  if (retrato === null) {
    return (
      <span className="pr-gaveta__retrato" aria-hidden="true">
        {(verbete.titulo || '?').charAt(0).toUpperCase()}
      </span>
    )
  }
  return (
    <span className="pr-gaveta__retrato" aria-hidden="true">
      <img src={retrato} alt="" loading="lazy" draggable={false} />
    </span>
  )
}

export function GavetaDeVerbetes({ id, campanhaId, noQuadro, editavel, faltam, entra = false, aoEscolher, aoDesenharSetas, aoFechar }: GavetaDeVerbetesProps) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const raiz = useRaizDaMidia()
  const [consulta, setConsulta] = useState('')
  const adiada = useDeferredValue(consulta)
  const [tipo, setTipo] = useState<TipoDeVerbete | 'todos'>('todos')
  const [levantado, setLevantado] = useState<string | null>(null)
  const lista = useRef<HTMLUListElement>(null)

  const daCampanha = useMemo(() => [...verbetes.values()].filter((verbete) => viraCartao(verbete.tipo) && naCampanha(verbete, campanhaId)), [verbetes, campanhaId])
  const mostrados = useMemo(() => {
    const procura = semAcento(adiada.trim())
    return daCampanha
      .filter((verbete) => tipo === 'todos' || verbete.tipo === tipo)
      .filter((verbete) => procura === '' || semAcento([verbete.titulo, ...verbete.apelidos].join('\n')).includes(procura))
      .sort((a, b) => compararTitulos(a.titulo, b.titulo))
  }, [daCampanha, tipo, adiada])
  const tiposPresentes = useMemo(() => new Set(daCampanha.map((verbete) => verbete.tipo)), [daCampanha])

  const focarItem = (indice: number) => {
    const itens = lista.current?.querySelectorAll<HTMLButtonElement>('.pr-gaveta__item')
    if (itens === undefined || itens.length === 0) return
    itens[Math.max(0, Math.min(itens.length - 1, indice))]?.focus()
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLElement>) => {
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      aoFechar()
      return
    }
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return
    const itens = [...(lista.current?.querySelectorAll<HTMLButtonElement>('.pr-gaveta__item') ?? [])]
    const atual = itens.indexOf(document.activeElement as HTMLButtonElement)
    if (atual === -1 && evento.key === 'ArrowUp') return
    evento.preventDefault()
    focarItem(atual === -1 ? 0 : atual + (evento.key === 'ArrowDown' ? 1 : -1))
  }

  const aoPegar = (evento: DragEvent<HTMLButtonElement>, verbete: Verbete) => {
    evento.dataTransfer.setData(MIME_DO_VERBETE, verbete.id)
    evento.dataTransfer.setData('text/plain', verbete.titulo || 'Sem nome')
    evento.dataTransfer.effectAllowed = 'copy'
    setLevantado(verbete.id)
  }

  const vazia = daCampanha.length === 0
  return (
    <aside id={id} className={entra ? 'pr-gaveta pr-gaveta--entra' : 'pr-gaveta'} aria-label="Verbetes para pôr no quadro" onKeyDown={aoTeclar}>
      <header className="pr-gaveta__cabeca">
        <h3 className="pr-gaveta__titulo">Verbetes</h3>
        <span className="pr-gaveta__conta">{vazia ? '' : mostrados.length === daCampanha.length ? `${daCampanha.length}` : `${mostrados.length} de ${daCampanha.length}`}</span>
        <button type="button" className="pr-gaveta__fechar" aria-label="Fechar a gaveta de verbetes" title="Fechar (Esc)" onClick={aoFechar}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
          </svg>
        </button>
      </header>
      {!vazia && (
        <>
          <div className="pr-gaveta__busca">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4 4" />
            </svg>
            <input
              type="search"
              className="pr-gaveta__campo"
              aria-label="Procurar verbete pelo nome"
              placeholder="Procurar pelo nome…"
              value={consulta}
              onChange={(evento) => setConsulta(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter' && mostrados[0] !== undefined && editavel) {
                  evento.preventDefault()
                  aoEscolher(mostrados[0])
                }
              }}
            />
          </div>
          {tiposPresentes.size > 1 && (
            <div className="pr-chips pr-gaveta__tipos" role="group" aria-label="Mostrar só um tipo">
              <button type="button" className="pr-chip" aria-pressed={tipo === 'todos'} onClick={() => setTipo('todos')}>
                Todos
              </button>
              {TIPOS_DE_CARTAO.filter((cada) => tiposPresentes.has(cada)).map((cada) => (
                <button key={cada} type="button" className="pr-chip" aria-pressed={tipo === cada} onClick={() => setTipo(tipo === cada ? 'todos' : cada)}>
                  {ROTULO_DO_TIPO[cada].varios}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {vazia ? (
        <p className="pr-gaveta__vazio">
          {campanhaId === null ? 'Nenhum verbete ainda.' : 'Nenhum verbete nesta campanha.'} Personagens, lugares, itens e facções criados na Enciclopédia aparecem aqui para arrastar ao quadro.
        </p>
      ) : mostrados.length === 0 ? (
        <p className="pr-gaveta__vazio" role="status">
          Nada com "{adiada.trim()}"{tipo === 'todos' ? '' : ` em ${ROTULO_DO_TIPO[tipo].varios.toLowerCase()}`}. Tente outro nome{tipo === 'todos' ? '' : ' ou todos os tipos'}.
        </p>
      ) : (
        <ul ref={lista} className="pr-gaveta__lista">
          {mostrados.map((verbete) => {
            const presente = noQuadro.has(verbete.id)
            const nome = verbete.titulo || 'Sem nome'
            return (
              <li key={verbete.id}>
                <button
                  type="button"
                  className={`pr-gaveta__item${levantado === verbete.id ? ' pr-gaveta__item--levantado' : ''}`}
                  draggable={editavel}
                  disabled={!editavel && !presente}
                  aria-label={presente ? `${nome}, já no quadro: mostrar o cartão` : `${nome}: pôr no meio do quadro`}
                  title={presente ? 'Já está no quadro: clique para ver o cartão. Arraste para pôr outro.' : editavel ? 'Arraste para o quadro, ou clique para pôr no meio da vista' : undefined}
                  onDragStart={(evento) => aoPegar(evento, verbete)}
                  onDragEnd={() => setLevantado(null)}
                  onClick={() => aoEscolher(verbete)}
                >
                  <Retrato verbete={verbete} raiz={raiz} />
                  <span className="pr-gaveta__nomes">
                    <span className="pr-gaveta__nome">{nome}</span>
                    <span className="pr-gaveta__tipo">{ROTULO_DO_TIPO[verbete.tipo].um}</span>
                  </span>
                  {presente && (
                    <span className="pr-gaveta__no" aria-hidden="true">
                      no quadro
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <footer className="pr-gaveta__pe">
        {faltam > 0 && editavel && (
          <p className="pr-gaveta__faltam">
            <span>{faltam === 1 ? '1 ligação entre cartões deste quadro está sem seta.' : `${faltam} ligações entre cartões deste quadro estão sem seta.`}</span>
            <button type="button" className="gr-bt gr-bt--p gr-bt--latao" onClick={aoDesenharSetas}>
              Desenhar {faltam === 1 ? 'a seta' : 'as setas'}
            </button>
          </p>
        )}
        <p className="pr-gaveta__dica">{editavel ? 'Arraste um verbete para o quadro. Enter ou clique põe no meio da vista.' : 'Este quadro abre só para ver: clique num verbete para achar o cartão.'}</p>
      </footer>
    </aside>
  )
}
