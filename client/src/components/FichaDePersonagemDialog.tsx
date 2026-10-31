import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { salvarSobreOAtual, type Ajuste } from '../lib/ajusteDaFicha'
import { comNotaDoMestre, NOTA_DO_MESTRE_MAX, PERSONAGEM_SEM_NOME, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { FichaDePersonagem } from './FichaDePersonagem'
import { CloseIcon } from './icons'
import './livros/anotacoes.css'

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
  /** Abre o livro de regras do sistema; ausente = o sistema não tem livro (sem botão). */
  onAbrirLivro?: () => void
  /** Tokens da cena aberta. Vazio = não há token para ligar. */
  tokens: readonly TokenParaLigar[]
  onLigarToken: (tokenId: string) => void
  /** AJUSTE RÁPIDO do mestre, fora da edição: grava na hora, com histórico. Ausente = sem − e +. */
  onAjustar?: (ajuste: Ajuste) => void
  /** O inventário do personagem (a mochila do token ligado), já com as ações do mestre. Ausente = sem token ligado. */
  inventario?: ReactNode
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
  onAbrirLivro,
  tokens,
  onLigarToken,
  onAjustar,
  inventario,
}: FichaDePersonagemDialogProps) {
  const tituloId = useId()
  const ligarId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const pressStartedOnBackdrop = useRef(false)
  const [editando, setEditando] = useState(editandoNoInicio && sistema !== undefined)
  /** A ficha quando a edição abriu: o Salvar troca só o que mudou desde ela (`salvarSobreOAtual`). */
  const [base, setBase] = useState(personagem)
  const [rascunho, setRascunho] = useState(personagem)
  const [perguntaDeSaida, setPerguntaDeSaida] = useState(false)
  const [ligado, setLigado] = useState<string | null>(null)
  /**
   * ANOTAÇÃO DO MESTRE (M2): no rascunho como o resto, mas à parte da ficha —
   * `salvarSobreOAtual` mantém a nota de agora (para o Salvar comum não a
   * apagar), então a nota escrita aqui entra DEPOIS dele, pelo funil único
   * `comNotaDoMestre`. Esta janela só existe do lado do mestre (RpgDialogs e
   * GavetaDaFicha); o jogador nem recebe a nota (`paraOFio`).
   */
  const [nota, setNota] = useState(personagem.notaDoMestre ?? '')
  const notaMudou = nota !== (base.notaDoMestre ?? '')
  const notaId = useId()
  const mudou = editando && (rascunho !== base || notaMudou)

  useEffect(() => {
    const opener = document.activeElement
    dialogRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus()
    }
  }, [])

  const salvar = () => {
    // Sobre a ficha de AGORA: o dano que o jogador tomou durante a edição não volta atrás.
    const salvo = salvarSobreOAtual(base, { ...rascunho, nome: rascunho.nome.trim() || PERSONAGEM_SEM_NOME }, personagem)
    // Nota não mexida: vale a de agora (pode ter mudado na página Anotações enquanto esta janela editava).
    onSalvar(notaMudou ? comNotaDoMestre(salvo, nota) : salvo)
    setEditando(false)
    setPerguntaDeSaida(false)
  }
  const descartar = () => {
    setRascunho(personagem)
    setNota(personagem.notaDoMestre ?? '')
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
            {onAbrirLivro !== undefined && (
              <button type="button" className="lb-btn lb-btn--ghost" onClick={onAbrirLivro}>
                Livro
              </button>
            )}
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
                  <button
                    type="button"
                    className="lb-btn"
                    onClick={() => {
                      // A edição começa da ficha de agora: os ajustes rápidos feitos depois de abrir a janela entram.
                      setBase(personagem)
                      setRascunho(personagem)
                      setNota(personagem.notaDoMestre ?? '')
                      setEditando(true)
                    }}
                  >
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
            <FichaDePersonagem
              personagem={mostrado}
              sistema={sistema}
              editando={editando}
              onChange={setRascunho}
              escolherImagem={escolherImagem}
              tituloId={tituloId}
              onAjustar={onAjustar}
              inventario={inventario}
            />
          )}
          <section className="lb-ficha-nota" aria-labelledby={`${notaId}-titulo`}>
            <div className="lb-ficha-nota__cab">
              <h3 className="lb-ficha-nota__tit" id={`${notaId}-titulo`}>
                {editando ? <label htmlFor={notaId}>Anotação do mestre</label> : 'Anotação do mestre'}
              </h3>
              <span className="lb-ficha-nota__privado">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                Só você vê
              </span>
            </div>
            {editando ? (
              <textarea
                id={notaId}
                className="lb-input lb-textarea lb-ficha-nota__campo"
                value={nota}
                maxLength={NOTA_DO_MESTRE_MAX}
                placeholder="Segredos, ganchos, o que ele quer, como reage se perder..."
                onChange={(event) => setNota(event.target.value)}
              />
            ) : (personagem.notaDoMestre ?? '').trim().length > 0 ? (
              <p className="lb-ficha-nota__texto">{personagem.notaDoMestre}</p>
            ) : (
              <p className="lb-ficha-nota__vazio">Sem anotação.{sistema !== undefined ? ' Escreva em Editar ou na página Anotações do livro de regras.' : ''}</p>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
