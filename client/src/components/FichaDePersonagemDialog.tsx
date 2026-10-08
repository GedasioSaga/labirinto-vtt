import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { PERSONAGEM_SEM_NOME, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { FichaDePersonagem } from './FichaDePersonagem'
import { CloseIcon } from './icons'

/** Um token da cena aberta, como o "Ligar a um token" o oferece. */
export interface TokenParaLigar {
  id: string
  nome: string
  /** Personagem a que ele já está ligado, ou `null`. */
  personagemId: string | null
}

export interface FichaDePersonagemDialogProps {
  personagem: Personagem
  /** `undefined` quando o sistema da aventura não está na biblioteca deste computador. */
  sistema: SistemaDeRpg | undefined
  /** Nome que a janela dá ao sistema que falta (o id gravado na aventura). */
  sistemaId: string | undefined
  editandoNoInicio: boolean
  onSalvar: (personagem: Personagem) => void
  onClose: () => void
  escolherImagem: () => Promise<string | null>
  /** Tokens da cena aberta. Vazio = não há token para ligar. */
  tokens: readonly TokenParaLigar[]
  onLigarToken: (tokenId: string) => void
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/**
 * Janela da FICHA DE PERSONAGEM. Lê por padrão; "Editar" troca a mesma ficha
 * por campos e o que se digita fica num RASCUNHO até "Salvar" — cancelar não
 * deixa meia ficha gravada, e a aventura só pede Salvar quando algo mudou.
 * Mesma casca das outras janelas (`SceneSettingsDialog`): portal no `body`,
 * foco preso dentro, Esc fecha — mas com rascunho mudado o Esc pergunta antes,
 * em vez de jogar fora o que o mestre escreveu.
 */
export function FichaDePersonagemDialog({
  personagem,
  sistema,
  sistemaId,
  editandoNoInicio,
  onSalvar,
  onClose,
  escolherImagem,
  tokens,
  onLigarToken,
}: FichaDePersonagemDialogProps) {
  const tituloId = useId()
  const ligarId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const pressStartedOnBackdrop = useRef(false)
  const [editando, setEditando] = useState(editandoNoInicio && sistema !== undefined)
  const [rascunho, setRascunho] = useState(personagem)
  const [perguntaDeSaida, setPerguntaDeSaida] = useState(false)
  const [ligado, setLigado] = useState<string | null>(null)
  const mudou = editando && rascunho !== personagem

  useEffect(() => {
    const opener = document.activeElement
    dialogRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus()
    }
  }, [])

  const salvar = () => {
    onSalvar({ ...rascunho, nome: rascunho.nome.trim() || PERSONAGEM_SEM_NOME })
    setEditando(false)
    setPerguntaDeSaida(false)
  }
  const descartar = () => {
    setRascunho(personagem)
    setEditando(false)
    setPerguntaDeSaida(false)
  }
  /** Fechar (Esc, X, fundo): com rascunho mudado, pergunta antes. */
  const pedirFechar = () => {
    if (mudou) setPerguntaDeSaida(true)
    else onClose()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Janela modal: nenhuma tecla daqui vale como atalho do editor atrás dela.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      pedirFechar()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (pressStartedOnBackdrop.current && event.target === event.currentTarget) pedirFechar()
    pressStartedOnBackdrop.current = false
  }

  const mostrado = editando ? rascunho : personagem
  const ligadosAqui = tokens.filter((token) => token.personagemId === personagem.id)

  return createPortal(
    <div className="lb-dialog-backdrop" onMouseDown={(event) => (pressStartedOnBackdrop.current = event.target === event.currentTarget)} onClick={onBackdropClick}>
      <div ref={dialogRef} className="lb-panel lb-dialog lb-ficha-janela" role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1} onKeyDown={onKeyDown}>
        <header className="lb-dialog__head lb-ficha-janela__topo">
          <p className="lb-eyebrow">Ficha de personagem{sistema !== undefined ? ` · ${sistema.nome}` : ''}</p>
          <div className="lb-ficha-janela__acoes">
            {editando ? (
              <>
                <button type="button" className="lb-btn lb-btn--ghost" onClick={descartar}>
                  Cancelar
                </button>
                <button type="button" className="lb-btn lb-btn--primary lb-ficha-janela__salvar" onClick={salvar}>
                  Salvar
                </button>
              </>
            ) : (
              <>
                {tokens.length > 0 && (
                  <select
                    id={ligarId}
                    className="lb-input lb-ficha-janela__ligar"
                    aria-label="Ligar a um token desta cena"
                    value=""
                    onChange={(event) => {
                      const token = tokens.find((candidato) => candidato.id === event.target.value)
                      if (token === undefined) return
                      onLigarToken(token.id)
                      setLigado(token.nome)
                    }}
                  >
                    <option value="">Ligar a um token…</option>
                    {tokens.map((token) => (
                      <option key={token.id} value={token.id} disabled={token.personagemId === personagem.id}>
                        {token.nome || 'Token sem nome'}
                        {token.personagemId === personagem.id ? ' (já ligado)' : token.personagemId !== null ? ' (ligado a outro)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {sistema !== undefined && (
                  <button type="button" className="lb-btn" onClick={() => setEditando(true)}>
                    Editar
                  </button>
                )}
              </>
            )}
            <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={pedirFechar}>
              <CloseIcon size={16} />
            </button>
          </div>
        </header>
        {perguntaDeSaida && (
          <div className="lb-ficha-janela__pergunta" role="alert">
            <span>A ficha tem mudanças que não foram salvas.</span>
            <button type="button" className="lb-btn lb-btn--compact" onClick={() => setPerguntaDeSaida(false)}>
              Continuar editando
            </button>
            <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={onClose}>
              Descartar e fechar
            </button>
            <button type="button" className="lb-btn lb-btn--primary lb-btn--compact" onClick={salvar}>
              Salvar
            </button>
          </div>
        )}
        {!editando && (ligado !== null || ligadosAqui.length > 0) && (
          <p className="lb-ficha-janela__ligacao" aria-live="polite">
            {ligado !== null ? `Ligado a ${ligado || 'Token sem nome'}.` : `No mapa desta cena: ${ligadosAqui.map((token) => token.nome || 'Token sem nome').join(', ')}.`}
          </p>
        )}
        <div className="lb-dialog__body lb-scroll lb-ficha-janela__corpo">
          {sistema === undefined ? (
            <div className="lb-ficha-janela__sem-sistema">
              <h2 id={tituloId} className="lb-dialog__title">
                {personagem.nome}
              </h2>
              <p>
                O sistema de RPG desta aventura ({sistemaId ?? 'nenhum'}) não está na biblioteca deste computador. Importe o arquivo do sistema em "Sistema de RPG" para ver e
                editar a ficha — os números dela continuam guardados.
              </p>
            </div>
          ) : (
            <FichaDePersonagem personagem={mostrado} sistema={sistema} editando={editando} onChange={setRascunho} escolherImagem={escolherImagem} tituloId={tituloId} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
