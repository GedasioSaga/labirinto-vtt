import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import type { AberturaDoEditor } from '../stores/rpgStore'
import { iniciais } from './FichaPecas'
import { CloseIcon } from './icons'
import './FichaDePersonagem.css'

export interface SistemasDialogProps {
  sistemas: readonly SistemaDeRpg[]
  /** O sistema da aventura aberta; `undefined` = nenhum ainda. */
  escolhidoId: string | undefined
  /** Arquivos da biblioteca que não deu para ler. */
  avisos: readonly string[]
  onEscolher: (sistemaId: string) => void
  /** "Importar arquivo…": pede o arquivo, importa e devolve o sistema que entrou (`null` = cancelou). Lança com a razão. */
  onImportar: () => Promise<SistemaDeRpg | null>
  /** Abre o editor. O embutido nunca chega aqui como "editar": a grade oferece a cópia antes. */
  onEditar: (abertura: AberturaDoEditor) => void
  /** Grava uma cópia (nome e id novos) e a devolve. Lança com a razão. */
  onDuplicar: (sistema: SistemaDeRpg) => Promise<SistemaDeRpg>
  /** Pede onde salvar e grava o arquivo; `false` = cancelou. Lança com a razão. */
  onExportar: (sistema: SistemaDeRpg) => Promise<boolean>
  /** Tira da biblioteca (já confirmado aqui). Lança com a razão. */
  onApagar: (sistema: SistemaDeRpg) => Promise<void>
  /** O sistema vem com o app: não muda no lugar e não sai da grade. */
  ehEmbutido: (sistemaId: string) => boolean
  onClose: () => void
}

const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** O que o cartão pergunta antes de agir: editar o embutido (vira cópia) ou apagar. */
type Pergunta = { tipo: 'copiar' | 'apagar'; sistemaId: string }

/**
 * "Sistema de RPG": a grade de cartões da biblioteca do app, como no esboço
 * do usuário — um cartão por sistema e um "+" no fim. Tocar um cartão faz
 * dele o sistema da aventura inteira e fecha a grade. Cada cartão também
 * edita, duplica, exporta e apaga (entrega 6); o "+" cria um sistema em
 * branco, copia outro ou importa um arquivo.
 *
 * O embutido (One Piece) não muda no lugar: "Editar" oferece uma cópia sua.
 * Apagar pede confirmação e recusa o sistema da aventura aberta — ela ficaria
 * com as fichas sem sistema.
 */
export function SistemasDialog({ sistemas, escolhidoId, avisos, onEscolher, onImportar, onEditar, onDuplicar, onExportar, onApagar, ehEmbutido, onClose }: SistemasDialogProps) {
  const tituloId = useId()
  const novoId = useId()
  const copiarId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const maisRef = useRef<HTMLButtonElement>(null)
  const pressStartedOnBackdrop = useRef(false)
  /** Quem abriu a pergunta do cartão: o foco volta para ele quando ela fecha. */
  const abridor = useRef<HTMLElement | null>(null)
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [pergunta, setPergunta] = useState<Pergunta | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [copiarDe, setCopiarDe] = useState(sistemas.length > 0 ? sistemas[0].id : '')
  const voltarAoMais = useRef(false)

  useEffect(() => {
    const opener = document.activeElement
    // O foco entra no sistema em uso (ou no primeiro): Enter confirma o que já está escolhido.
    const alvo = dialogRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? dialogRef.current?.querySelector<HTMLElement>('.lb-sistema')
    alvo?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    if (novoAberto || !voltarAoMais.current) return
    voltarAoMais.current = false
    maisRef.current?.focus()
  }, [novoAberto])

  const fecharNovo = () => {
    voltarAoMais.current = true
    setNovoAberto(false)
  }

  const fecharPergunta = () => {
    setPergunta(null)
    if (abridor.current?.isConnected === true) abridor.current.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      // Esc desfaz o passo de dentro antes de fechar a grade.
      if (pergunta !== null) fecharPergunta()
      else if (novoAberto) fecharNovo()
      else onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (pressStartedOnBackdrop.current && event.target === event.currentTarget) onClose()
    pressStartedOnBackdrop.current = false
  }

  /** Roda a ação da grade com o aviso de sempre: o texto do que deu certo, ou a razão de não dar. */
  const agir = async (acao: () => Promise<string | null>) => {
    setOcupado(true)
    setEstado(null)
    try {
      const texto = await acao()
      if (texto !== null) setEstado({ tipo: 'ok', texto })
    } catch (erro) {
      setEstado({ tipo: 'erro', texto: erro instanceof Error ? erro.message : String(erro) })
    } finally {
      setOcupado(false)
    }
  }

  const importar = () =>
    agir(async () => {
      const sistema = await onImportar()
      if (sistema === null) return null
      setNovoAberto(false)
      return `${sistema.nome} entrou na biblioteca. Toque no cartão para usar nesta aventura.`
    })

  const perguntar = (tipo: Pergunta['tipo'], sistemaId: string, quem: HTMLElement) => {
    abridor.current = quem
    setEstado(null)
    setPergunta({ tipo, sistemaId })
  }

  const sistemaACopiar = sistemas.find((sistema) => sistema.id === copiarDe)

  return createPortal(
    <div className="lb-dialog-backdrop" onMouseDown={(event) => (pressStartedOnBackdrop.current = event.target === event.currentTarget)} onClick={onBackdropClick}>
      <div ref={dialogRef} className="lb-panel lb-dialog lb-sistemas" role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1} onKeyDown={onKeyDown}>
        <header className="lb-dialog__head">
          <h2 id={tituloId} className="lb-dialog__title">
            Sistema de RPG
          </h2>
          <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="lb-dialog__body lb-scroll lb-sistemas__corpo">
          <p className="lb-field__hint">Um sistema vale para a aventura inteira: as fichas de todos os personagens seguem ele.</p>
          <ul className="lb-sistemas__grade" aria-label="Sistemas da biblioteca">
            {sistemas.map((sistema) => {
              const emUso = sistema.id === escolhidoId
              const embutido = ehEmbutido(sistema.id)
              const perguntaAqui = pergunta?.sistemaId === sistema.id ? pergunta.tipo : null
              return (
                <li key={sistema.id} className="lb-sistema-cartao" data-em-uso={emUso || undefined}>
                  <button
                    type="button"
                    className="lb-sistema"
                    aria-pressed={emUso}
                    onClick={() => {
                      onEscolher(sistema.id)
                      onClose()
                    }}
                  >
                    <span className="lb-sistema__capa" style={{ backgroundColor: sistema.cor }} aria-hidden="true">
                      {iniciais(sistema.nome)}
                    </span>
                    <span className="lb-sistema__nome">{sistema.nome}</span>
                    <span className="lb-sistema__versao">
                      Versão {sistema.versao} · {sistema.atributos.length} atributos{embutido ? ' · vem com o app' : ''}
                    </span>
                    {sistema.descricao.length > 0 && <span className="lb-sistema__descricao">{sistema.descricao}</span>}
                    {emUso && <span className="lb-sistema__uso">Em uso</span>}
                  </button>
                  <div className="lb-sistema__acoes" role="group" aria-label={`Ações de ${sistema.nome}`}>
                    <button
                      type="button"
                      className="lb-btn lb-btn--ghost lb-btn--compact"
                      aria-label={`Editar ${sistema.nome}`}
                      disabled={ocupado}
                      onClick={(event) => (embutido ? perguntar('copiar', sistema.id, event.currentTarget) : onEditar({ tipo: 'editar', sistema }))}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="lb-btn lb-btn--ghost lb-btn--compact"
                      aria-label={`Duplicar ${sistema.nome}`}
                      disabled={ocupado}
                      onClick={() => void agir(async () => `Cópia criada: ${(await onDuplicar(sistema)).nome}.`)}
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      className="lb-btn lb-btn--ghost lb-btn--compact"
                      aria-label={`Exportar arquivo de ${sistema.nome}`}
                      title="Exportar arquivo…"
                      disabled={ocupado}
                      onClick={() => void agir(async () => ((await onExportar(sistema)) ? `${sistema.nome} exportado.` : null))}
                    >
                      Exportar…
                    </button>
                    {!embutido && (
                      <button
                        type="button"
                        className="lb-btn lb-btn--ghost lb-btn--compact lb-sistema__apagar"
                        aria-label={`Apagar ${sistema.nome}`}
                        disabled={ocupado}
                        onClick={(event) => perguntar('apagar', sistema.id, event.currentTarget)}
                      >
                        Apagar
                      </button>
                    )}
                  </div>
                  {perguntaAqui === 'copiar' && (
                    <div className="lb-sistema__pergunta" role="group" aria-label={`Editar uma cópia de ${sistema.nome}`}>
                      <p>
                        O {sistema.nome} vem com o Labirinto e não muda. Edite uma cópia sua do {sistema.nome}: as fichas feitas nele abrem iguais na cópia.
                      </p>
                      <span className="lb-sistema__pergunta-acoes">
                        <button
                          type="button"
                          className="lb-btn lb-btn--primary lb-btn--compact"
                          autoFocus
                          onClick={() => {
                            setPergunta(null)
                            onEditar({ tipo: 'novo', copiaDe: sistema })
                          }}
                        >
                          Editar uma cópia
                        </button>
                        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={fecharPergunta}>
                          Cancelar
                        </button>
                      </span>
                    </div>
                  )}
                  {perguntaAqui === 'apagar' &&
                    (emUso ? (
                      <div className="lb-sistema__pergunta lb-sistema__pergunta--perigo" role="alert">
                        <p>Esta aventura usa o {sistema.nome}. Escolha outro sistema para ela antes de apagar este.</p>
                        <span className="lb-sistema__pergunta-acoes">
                          <button type="button" className="lb-btn lb-btn--compact" autoFocus onClick={fecharPergunta}>
                            Entendi
                          </button>
                        </span>
                      </div>
                    ) : (
                      <div className="lb-sistema__pergunta lb-sistema__pergunta--perigo" role="group" aria-label={`Apagar ${sistema.nome}?`}>
                        <p>
                          Apagar {sistema.nome} da biblioteca? Aventuras que o usam guardam as fichas, mas ficam sem sistema até você importar o arquivo de novo — exporte antes, se quiser guardar.
                        </p>
                        <span className="lb-sistema__pergunta-acoes">
                          <button
                            type="button"
                            className="lb-btn lb-btn--danger lb-btn--compact"
                            disabled={ocupado}
                            onClick={() =>
                              void agir(async () => {
                                await onApagar(sistema)
                                setPergunta(null)
                                return `${sistema.nome} saiu da biblioteca.`
                              })
                            }
                          >
                            Apagar
                          </button>
                          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" autoFocus onClick={fecharPergunta}>
                            Manter
                          </button>
                        </span>
                      </div>
                    ))}
                </li>
              )
            })}
            <li>
              {novoAberto ? (
                <div className="lb-sistema-novo" role="group" aria-labelledby={novoId}>
                  <p id={novoId} className="lb-eyebrow">
                    Novo sistema
                  </p>
                  <button
                    type="button"
                    className="lb-btn lb-btn--block"
                    autoFocus
                    onClick={() => {
                      setNovoAberto(false)
                      onEditar({ tipo: 'novo', copiaDe: null })
                    }}
                  >
                    Em branco
                  </button>
                  <label className="lb-label" htmlFor={copiarId}>
                    Copiar de…
                  </label>
                  <select id={copiarId} className="lb-input" value={copiarDe} onChange={(event) => setCopiarDe(event.target.value)}>
                    {sistemas.map((sistema) => (
                      <option key={sistema.id} value={sistema.id}>
                        {sistema.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="lb-btn lb-btn--block"
                    disabled={sistemaACopiar === undefined}
                    onClick={() => {
                      if (sistemaACopiar === undefined) return
                      setNovoAberto(false)
                      onEditar({ tipo: 'novo', copiaDe: sistemaACopiar })
                    }}
                  >
                    Copiar e editar
                  </button>
                  <span className="lb-sistema-novo__ou" aria-hidden="true">
                    ou
                  </span>
                  <button type="button" className="lb-btn lb-btn--block" disabled={ocupado} onClick={() => void importar()}>
                    {ocupado ? 'Importando…' : 'Importar arquivo…'}
                  </button>
                  <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={fecharNovo}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <button ref={maisRef} type="button" className="lb-sistema lb-sistema--mais" aria-expanded={false} onClick={() => setNovoAberto(true)}>
                  <span className="lb-sistema__mais" aria-hidden="true">
                    +
                  </span>
                  <span className="lb-sistema__nome">Novo sistema…</span>
                  <span className="lb-sistema__versao">Em branco, cópia de outro ou arquivo .json</span>
                </button>
              )}
            </li>
          </ul>
          {estado !== null && (
            <p className={estado.tipo === 'erro' ? 'lb-field__error' : 'lb-field__hint'} role={estado.tipo === 'erro' ? 'alert' : 'status'}>
              {estado.texto}
            </p>
          )}
          {avisos.length > 0 && (
            <div className="lb-sistemas__avisos" role="note">
              <p className="lb-eyebrow">Arquivos que não abriram</p>
              <ul>
                {avisos.map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
