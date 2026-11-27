import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { MOTIVO_DESMAIADA, motivoDoLimite, type GrupoNaEscolha } from '../../lib/caracteristicas/companions'
import { ImagemOuIniciais } from '../FichaPecas'
import './caracteristicas.css'

/**
 * "Quem vai com a Aira?" (protótipo das características, estado 3): um bloco
 * por grupo com "N de 3"; chegou ao limite, as outras travam com o motivo; HP 0
 * trava como "Desmaiada". `Espaço` marca (a caixa nativa), `Enter` entra.
 * "Entrar sozinha" leva ninguém. Vem marcado o padrão de cada grupo. O mesmo
 * diálogo serve ao jogador dono e ao mestre ("Escolher por ela").
 */

export interface EscolhaDosCompanionsProps {
  donoNome: string
  grupos: readonly GrupoNaEscolha[]
  /** Quem olha: o jogador lê a nota do "escolhendo…"; o mestre pode fechar sem escolher. */
  quem: 'jogador' | 'mestre'
  onEntrar: (escolhidos: string[]) => void
  /** Só o mestre: fecha sem escolher (a vez segue esperando o jogador). */
  onFechar?: () => void
  /** A recusa do host, se houve ("Já são 3…"). */
  erro?: string | null
}

const FOCAVEIS = 'button:not([disabled]), input:not([disabled])'

function padraoDe(grupos: readonly GrupoNaEscolha[]): Set<string> {
  return new Set(grupos.flatMap((grupo) => grupo.padrao))
}

export function EscolhaDosCompanions({ donoNome, grupos, quem, onEntrar, onFechar, erro = null }: EscolhaDosCompanionsProps) {
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(() => padraoDe(grupos))
  const caixaRef = useRef<HTMLDivElement>(null)
  const tituloId = useId()
  const total = marcados.size
  const ordenados = grupos.flatMap((grupo) => grupo.opcoes.map((opcao) => opcao.personagemId)).filter((id) => marcados.has(id))

  useEffect(() => {
    // O foco vai à primeira caixa que dá para marcar (ou ao "Entrar").
    const primeira = caixaRef.current?.querySelector<HTMLElement>('input:not([disabled])') ?? caixaRef.current?.querySelector<HTMLElement>('button')
    primeira?.focus()
  }, [])

  function alternar(grupo: GrupoNaEscolha, id: string, sim: boolean) {
    setMarcados((antes) => {
      const novos = new Set(antes)
      if (!sim) novos.delete(id)
      else if (grupo.opcoes.filter((opcao) => novos.has(opcao.personagemId)).length < grupo.limite) novos.add(id)
      return novos
    })
  }

  function aoTeclar(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault()
      onEntrar(ordenados)
      return
    }
    if (event.key === 'Escape' && onFechar !== undefined) {
      event.preventDefault()
      onFechar()
      return
    }
    if (event.key !== 'Tab') return
    const itens = Array.from(caixaRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [])
    const primeiro = itens[0]
    const ultimo = itens[itens.length - 1]
    if (primeiro === undefined || ultimo === undefined) return
    if (event.shiftKey && document.activeElement === primeiro) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  return createPortal(
    <div className="lb-carac-modal-fundo">
      <div ref={caixaRef} className="lb-carac-modal lb-carac-modal--largo lb-carac-escolha" role="dialog" aria-modal="true" aria-labelledby={tituloId} onKeyDown={aoTeclar}>
        <div>
          <p className="lb-carac-escolha__olho">A batalha vai começar</p>
          <h2 className="lb-carac-escolha__tit" id={tituloId}>
            Quem vai com {quem === 'mestre' ? 'o personagem ' : 'a '}
            {donoNome}?
          </h2>
          <p className="lb-carac-modal__sub">
            Cada um entra do lado de {donoNome}, colado no mapa, com vez própria na ordem. {quem === 'jogador' ? 'Você joga por eles.' : 'Quem joga por eles é o dono.'}
          </p>
        </div>
        {grupos.map((grupo) => {
          const doGrupo = grupo.opcoes.filter((opcao) => marcados.has(opcao.personagemId)).length
          const cheio = doGrupo >= grupo.limite
          return (
            <fieldset key={grupo.id} className="lb-carac-escolha__grupo">
              <legend className="lb-carac-escolha__legenda">
                <span>
                  {grupo.nome} <span className="lb-carac__conta">leve até {grupo.limite}</span>
                </span>
                <span className="lb-carac-escolha__conta" aria-live="polite">
                  <b>{doGrupo}</b> de {grupo.limite}
                </span>
              </legend>
              <div className="lb-carac-escolha__opcoes">
                {grupo.opcoes.map((opcao) => {
                  const marcada = marcados.has(opcao.personagemId)
                  const travada = opcao.desmaiada || (cheio && !marcada)
                  const motivo = opcao.desmaiada ? MOTIVO_DESMAIADA : null
                  return (
                    <label key={opcao.personagemId} className="lb-carac-escolha__op" data-marcada={marcada ? 'sim' : undefined} data-travada={travada ? 'sim' : undefined}>
                      <span className="lb-carac-ligada__retrato" aria-hidden="true">
                        <ImagemOuIniciais imagem={opcao.retrato} nome={opcao.nome} />
                      </span>
                      <span className="lb-carac-escolha__texto">
                        <strong>{opcao.nome}</strong>
                        {opcao.vida !== null && (
                          <span>
                            HP {opcao.vida.atual}/{opcao.vida.maximo}
                          </span>
                        )}
                        <span className={motivo === null ? undefined : 'lb-carac-ligada__desmaiada'}>{motivo ?? (opcao.modo === 'efeito' ? 'Dá efeito' : 'Luta no campo')}</span>
                      </span>
                      <input type="checkbox" checked={marcada} disabled={travada} onChange={(event) => alternar(grupo, opcao.personagemId, event.target.checked)} aria-describedby={cheio && !marcada && !opcao.desmaiada ? `${tituloId}-${grupo.id}-cheio` : undefined} />
                    </label>
                  )
                })}
              </div>
              {cheio && grupo.opcoes.length > grupo.limite && (
                <p className="lb-carac-pagina__nota" id={`${tituloId}-${grupo.id}-cheio`}>
                  {motivoDoLimite(grupo.limite)}
                </p>
              )}
            </fieldset>
          )
        })}
        {erro !== null && (
          <p className="lb-carac-escolha__erro" role="alert">
            {erro}
          </p>
        )}
        <div className="lb-carac-escolha__rodape">
          <p className="lb-carac-modal__sub">{quem === 'jogador' ? `O mestre vê "${donoNome} escolhendo…" até você entrar.` : `Você decide no lugar do jogador de ${donoNome}.`}</p>
          <div className="lb-carac-modal__acoes">
            {onFechar !== undefined && (
              <button type="button" className="lb-btn lb-btn--ghost" onClick={onFechar}>
                Cancelar
              </button>
            )}
            <button type="button" className="lb-btn" onClick={() => onEntrar([])}>
              Entrar {quem === 'jogador' ? 'sozinha' : 'sem companion'}
            </button>
            <button type="button" className="lb-btn lb-btn--primary" onClick={() => onEntrar(ordenados)}>
              {total === 0 ? 'Entrar' : `Entrar com ${total}`} <kbd>Enter</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
