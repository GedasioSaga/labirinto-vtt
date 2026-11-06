import { useId, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent } from 'react'
import { CHAT_TEXT_MAX_LENGTH, cleanChatText, mentionBeingTyped, mentionOptions } from '../../../lib/chat'

/**
 * O CAMPO DE ESCREVER do chat (C2): Enter manda, Shift+Enter pula a linha, e
 * "@" abre a lista de quem dá para mencionar (setas escolhem, Enter ou Tab
 * põe, Esc fecha). O rascunho de cada conversa fica guardado enquanto a
 * página está aberta: trocar de conversa não perde o que foi escrito.
 */

/** O contador aparece quando faltam menos caracteres que isto. */
const CONTADOR_A_PARTIR_DE = 250

/** Rascunho por conversa (chave do canal), só nesta página. */
const rascunhos = new Map<string, string>()

function textoDoContador(faltam: number): string | null {
  if (faltam >= CONTADOR_A_PARTIR_DE) return null
  if (faltam >= 0) return faltam === 1 ? 'Falta 1 caractere' : `Faltam ${faltam} caracteres`
  return `Passou ${-faltam} ${faltam === -1 ? 'caractere' : 'caracteres'} do limite`
}

export interface PropsDoCompositor {
  /** A chave da conversa: o rascunho é dela. */
  chave: string
  rotulo: string
  /** Quem dá para mencionar com "@" (vazio = sem sugestões, como no privado). */
  nomes: readonly string[]
  /** Motivo de não dar para escrever (a pessoa saiu da mesa); `null` = pode. */
  bloqueado: string | null
  /** `false` = não foi (vazia depois da limpeza ou acima do teto). */
  aoEnviar(texto: string): boolean
}

export function Compositor({ chave, rotulo, nomes, bloqueado, aoEnviar }: PropsDoCompositor) {
  const campoId = useId()
  const listaId = useId()
  const dicaId = useId()
  const contadorId = useId()
  const alertaId = useId()
  const [rascunho, setRascunho] = useState(() => rascunhos.get(chave) ?? '')
  const [cursor, setCursor] = useState(0)
  const [ativa, setAtiva] = useState(0)
  const [sugerindo, setSugerindo] = useState(false)
  const [alerta, setAlerta] = useState<string | null>(null)
  const campoRef = useRef<HTMLTextAreaElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)
  const cursorPendente = useRef<number | null>(null)

  const digitando = sugerindo && nomes.length > 0 ? mentionBeingTyped(rascunho, cursor) : null
  const opcoes = digitando === null ? [] : mentionOptions(nomes, digitando.typed)
  const opcaoAtiva = opcoes.length === 0 ? -1 : Math.min(ativa, opcoes.length - 1)
  const contador = textoDoContador(CHAT_TEXT_MAX_LENGTH - rascunho.length)
  const descritoPor = [dicaId, contador === null ? '' : contadorId, alerta === null ? '' : alertaId].filter((id) => id !== '').join(' ')

  function guardar(valor: string): void {
    setRascunho(valor)
    if (valor === '') rascunhos.delete(chave)
    else rascunhos.set(chave, valor)
  }

  // Depois de pôr a menção, o cursor volta para logo depois dela (o React o leva ao fim ao trocar o valor).
  useLayoutEffect(() => {
    const em = cursorPendente.current
    const campo = campoRef.current
    if (em === null || campo === null) return
    cursorPendente.current = null
    campo.setSelectionRange(em, em)
  }, [rascunho])

  useLayoutEffect(() => {
    const lista = listaRef.current
    if (lista === null || opcaoAtiva < 0) return
    const item = lista.children.item(opcaoAtiva)
    if (item instanceof HTMLElement) item.scrollIntoView({ block: 'nearest' })
  }, [opcaoAtiva, opcoes.length])

  function mudarRascunho(evento: ChangeEvent<HTMLTextAreaElement>): void {
    guardar(evento.target.value)
    setCursor(evento.target.selectionStart)
    setAtiva(0)
    setSugerindo(true)
    setAlerta(null)
  }

  function seguirOCursor(evento: SyntheticEvent<HTMLTextAreaElement>): void {
    const em = evento.currentTarget.selectionStart
    if (em === cursor) return
    setCursor(em)
    setAtiva(0)
  }

  function porMencao(nome: string): void {
    if (digitando === null) return
    const antes = rascunho.slice(0, digitando.start)
    const posta = `@${nome} `
    const em = antes.length + posta.length
    cursorPendente.current = em
    guardar(antes + posta + rascunho.slice(cursor))
    setCursor(em)
    setAtiva(0)
  }

  function mandar(): void {
    if (bloqueado !== null) return
    const texto = cleanChatText(rascunho)
    if (texto === '') {
      setAlerta('Escreva alguma coisa antes de enviar.')
      campoRef.current?.focus()
      return
    }
    if (texto.length > CHAT_TEXT_MAX_LENGTH) {
      setAlerta('A mensagem passou de 1.000 caracteres: divida em duas.')
      campoRef.current?.focus()
      return
    }
    if (!aoEnviar(texto)) {
      setAlerta('Não deu para enviar esta mensagem.')
      return
    }
    setAlerta(null)
    setSugerindo(false)
    guardar('')
    setCursor(0)
  }

  function teclar(evento: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    // Enter que confirma a palavra do teclado de acentos (IME) não é Enter de mandar.
    if (evento.nativeEvent.isComposing) return
    if (digitando !== null && opcoes.length > 0) {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        setSugerindo(false)
        return
      }
      if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
        evento.preventDefault()
        const passo = evento.key === 'ArrowDown' ? 1 : -1
        setAtiva((opcaoAtiva + passo + opcoes.length) % opcoes.length)
        return
      }
      if ((evento.key === 'Enter' && !evento.shiftKey) || evento.key === 'Tab') {
        evento.preventDefault()
        porMencao(opcoes[opcaoAtiva])
        return
      }
    }
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault()
      mandar()
    }
  }

  function enviarPeloBotao(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    mandar()
  }

  if (bloqueado !== null) {
    return (
      <div className="lo-chat__escrever lo-chat__escrever--bloqueado">
        <p className="lo-motivo">{bloqueado}</p>
      </div>
    )
  }

  return (
    <form className="lo-chat__escrever" aria-label="Enviar mensagem" noValidate onSubmit={enviarPeloBotao}>
      <label className="lo-sr" htmlFor={campoId}>
        {rotulo}
      </label>
      <div className="lo-chat__campo">
        {opcoes.length > 0 && (
          <ul ref={listaRef} id={listaId} className="lo-chat__sugestoes" role="listbox" aria-label="Mencionar">
            {opcoes.map((nome, i) => (
              <li
                key={nome}
                id={`${listaId}-${i}`}
                className="lo-chat__sugestao"
                role="option"
                aria-selected={i === opcaoAtiva}
                // Sem isto o clique tira o foco do campo antes de chegar, e a lista some.
                onMouseDown={(evento) => evento.preventDefault()}
                onClick={() => porMencao(nome)}
              >
                @{nome}
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={campoRef}
          id={campoId}
          className="lo-texto lo-chat__texto"
          rows={1}
          value={rascunho}
          placeholder={rotulo}
          enterKeyHint="send"
          autoComplete="off"
          spellCheck
          aria-autocomplete={nomes.length > 0 ? 'list' : undefined}
          aria-controls={opcoes.length > 0 ? listaId : undefined}
          aria-expanded={nomes.length > 0 ? opcoes.length > 0 : undefined}
          aria-activedescendant={opcaoAtiva >= 0 ? `${listaId}-${opcaoAtiva}` : undefined}
          aria-invalid={alerta !== null || rascunho.length > CHAT_TEXT_MAX_LENGTH ? true : undefined}
          aria-describedby={descritoPor}
          onChange={mudarRascunho}
          onSelect={seguirOCursor}
          onKeyDown={teclar}
          onBlur={() => setSugerindo(false)}
        />
        <button type="submit" className="lo-btn lo-btn--primario lo-chat__enviar">
          Enviar
        </button>
      </div>
      <div className="lo-chat__dicas">
        <p id={dicaId} className="lo-motivo lo-chat__dica">
          {nomes.length > 0 ? 'Enter envia; Shift+Enter pula a linha; @ menciona alguém da mesa.' : 'Enter envia; Shift+Enter pula a linha.'}
        </p>
        {contador !== null && (
          <p id={contadorId} className="lo-motivo" data-passou={rascunho.length > CHAT_TEXT_MAX_LENGTH ? '1' : undefined}>
            {contador}
          </p>
        )}
      </div>
      {alerta !== null && (
        <p id={alertaId} className="lo-erro-campo" role="alert">
          {alerta}
        </p>
      )}
    </form>
  )
}
