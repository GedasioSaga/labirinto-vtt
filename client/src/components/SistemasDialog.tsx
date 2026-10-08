import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
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
  /** O "+": pede o arquivo, importa e devolve o sistema que entrou (`null` = cancelou). Lança com a razão. */
  onImportar: () => Promise<SistemaDeRpg | null>
  onClose: () => void
}

const FOCUSABLE = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * "Sistema de RPG": a grade de cartões da biblioteca do app, como no esboço
 * do usuário — um cartão por sistema e um "+" no fim que importa outro de
 * arquivo (o editor de sistema dentro do app é a entrega 6). Tocar um cartão
 * faz dele o sistema da aventura inteira e fecha a grade.
 */
export function SistemasDialog({ sistemas, escolhidoId, avisos, onEscolher, onImportar, onClose }: SistemasDialogProps) {
  const tituloId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const pressStartedOnBackdrop = useRef(false)
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [importando, setImportando] = useState(false)

  useEffect(() => {
    const opener = document.activeElement
    // O foco entra no sistema em uso (ou no primeiro): Enter confirma o que já está escolhido.
    const alvo = dialogRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? dialogRef.current?.querySelector<HTMLElement>('.lb-sistema')
    alvo?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus()
    }
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
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

  const importar = async () => {
    setImportando(true)
    setEstado(null)
    try {
      const sistema = await onImportar()
      if (sistema !== null) setEstado({ tipo: 'ok', texto: `${sistema.nome} entrou na biblioteca. Toque no cartão para usar nesta aventura.` })
    } catch (erro) {
      setEstado({ tipo: 'erro', texto: erro instanceof Error ? erro.message : String(erro) })
    } finally {
      setImportando(false)
    }
  }

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
              return (
                <li key={sistema.id}>
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
                      Versão {sistema.versao} · {sistema.atributos.length} atributos
                    </span>
                    {sistema.descricao.length > 0 && <span className="lb-sistema__descricao">{sistema.descricao}</span>}
                    {emUso && <span className="lb-sistema__uso">Em uso</span>}
                  </button>
                </li>
              )
            })}
            <li>
              <button type="button" className="lb-sistema lb-sistema--mais" disabled={importando} onClick={() => void importar()}>
                <span className="lb-sistema__mais" aria-hidden="true">
                  +
                </span>
                <span className="lb-sistema__nome">{importando ? 'Importando…' : 'Importar sistema…'}</span>
                <span className="lb-sistema__versao">Arquivo .json de sistema</span>
              </button>
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
