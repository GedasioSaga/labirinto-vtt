import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { MarcaRumo } from '../types/map'
import { MARCA_TEXTO_MAX, normalizarTextoDaMarca, RUMO_NOME } from '../lib/marcas'
import type { MarkPlace, MarkPlaceIntent } from './playerConnection'

export type { MarkPlaceIntent } from './playerConnection'

/**
 * BILHETE NO LUGAR — "Deixar marca aqui…" no painel do jogador. Um bilhete de
 * até `MARCA_TEXTO_MAX` letras ou uma seta de giz, cravados onde a ficha dele
 * está. Quem confere o lugar é o host; a linha de status conta a resposta. O
 * bilhete sai sem o nome de quem deixou: quem quiser assinar escreve no texto.
 */
export interface PlayerMarkFormProps {
  /** A última marca e o que o host respondeu; ausente = nada enviado ainda. */
  result: MarkPlace | undefined
  onPlace: (intent: MarkPlaceIntent) => void
  /** Recolhe o formulário (o dono zera `result`). */
  onClose: () => void
}

/** A rosa em 3 x 3 (o meio vazio é onde a ficha está), na ordem da leitura. */
const ROSA: readonly { rumo: MarcaRumo; glifo: string }[] = [
  { rumo: 'no', glifo: '↖' },
  { rumo: 'n', glifo: '↑' },
  { rumo: 'ne', glifo: '↗' },
  { rumo: 'o', glifo: '←' },
  { rumo: 'l', glifo: '→' },
  { rumo: 'so', glifo: '↙' },
  { rumo: 's', glifo: '↓' },
  { rumo: 'se', glifo: '↘' },
]

function resultText(result: MarkPlace): string | null {
  if (result.phase === 'sending') return null
  if (result.phase === 'ok') return 'Deixado. Quem passar por aqui vai ver.'
  if (result.reason === 'full') return 'Você já deixou marcas demais nesta cena. Peça ao mestre para apagar alguma.'
  if (result.reason === 'too_soon') return 'Espere um instante e tente de novo.'
  // Sem dizer por quê: o motivo exato contaria o que existe ali.
  return 'Não dá para deixar marca aqui.'
}

function faltam(n: number): string {
  return n === 1 ? 'Falta 1 letra' : `Faltam ${n} letras`
}

export function PlayerMarkForm({ result, onPlace, onClose }: PlayerMarkFormProps) {
  const [open, setOpen] = useState(false)
  const [tipo, setTipo] = useState<'bilhete' | 'seta'>('bilhete')
  const [texto, setTexto] = useState('')
  const [vazio, setVazio] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const fieldId = useId()
  const countId = useId()
  const errorId = useId()
  const sending = result?.phase === 'sending'
  const placed = result?.phase === 'ok'

  useEffect(() => {
    // Ficou no chão: o campo esvazia para o próximo bilhete. Na recusa, o texto fica.
    if (placed) setTexto('')
  }, [placed])

  useEffect(() => {
    // Abriu no bilhete: quem veio pelo teclado já está no campo.
    if (open && tipo === 'bilhete') inputRef.current?.focus()
  }, [open, tipo])

  const close = () => {
    // O foco vai antes ao botão que abre: o "Fechar" some junto com o formulário.
    triggerRef.current?.focus()
    setOpen(false)
    setVazio(false)
    onClose()
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending) return
    const limpo = normalizarTextoDaMarca(texto)
    if (limpo.length === 0) {
      setVazio(true)
      inputRef.current?.focus()
      return
    }
    setVazio(false)
    onPlace({ tipo: 'bilhete', texto: limpo })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape' || sending) return
    // O Escape é do formulário: sem isto ele chega à janela e fecha a gaveta junto.
    event.stopPropagation()
    close()
  }

  const status = result === undefined ? null : resultText(result)

  return (
    <>
      <button ref={triggerRef} type="button" className="pp-button" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        Deixar marca aqui…
      </button>
      {open && (
        <form className="pp-field pp-mark" aria-label="Deixar marca aqui" noValidate onSubmit={submit} onKeyDown={onKeyDown}>
          <div className="pp-mark__tipos" role="group" aria-label="Tipo de marca">
            <button type="button" className="pp-button pp-button--toggle" aria-pressed={tipo === 'bilhete'} onClick={() => setTipo('bilhete')}>
              Bilhete
            </button>
            <button type="button" className="pp-button pp-button--toggle" aria-pressed={tipo === 'seta'} onClick={() => setTipo('seta')}>
              Seta de giz
            </button>
          </div>
          {tipo === 'bilhete' ? (
            <>
              <label className="pp-label" htmlFor={fieldId}>
                Bilhete
              </label>
              <input
                ref={inputRef}
                id={fieldId}
                className="pp-input"
                type="text"
                maxLength={MARCA_TEXTO_MAX}
                value={texto}
                aria-invalid={vazio}
                aria-describedby={vazio ? `${errorId} ${countId}` : countId}
                onChange={(event) => {
                  setTexto(event.target.value)
                  // O aviso some assim que o valor fica válido.
                  if (vazio && normalizarTextoDaMarca(event.target.value).length > 0) setVazio(false)
                }}
              />
              <p id={countId} className="pp-empty">
                {faltam(MARCA_TEXTO_MAX - texto.length)}
              </p>
              {vazio && (
                <p id={errorId} className="pp-error" role="alert">
                  Escreva o bilhete antes de deixar.
                </p>
              )}
              <button type="submit" className="pp-button" disabled={sending}>
                {sending ? 'Deixando…' : 'Deixar bilhete'}
              </button>
            </>
          ) : (
            <div className="pp-mark__rosa" role="group" aria-label="Para onde a seta aponta">
              {ROSA.map(({ rumo, glifo }) => (
                <button
                  key={rumo}
                  type="button"
                  className="pp-button"
                  aria-label={`Seta para o ${RUMO_NOME[rumo]}`}
                  disabled={sending}
                  onClick={() => onPlace({ tipo: 'seta', rumo })}
                >
                  <span aria-hidden="true">{glifo}</span>
                </button>
              ))}
            </div>
          )}
          <p className="pp-empty">Fica no chão onde seu personagem está, sem o seu nome. Quem passar por aqui vai ver.</p>
          {status !== null && (
            <p className="pp-empty" role="status">
              {status}
            </p>
          )}
          <button type="button" className="pp-button" disabled={sending} onClick={close}>
            Fechar
          </button>
        </form>
      )}
    </>
  )
}
