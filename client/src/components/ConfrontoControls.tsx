import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Confronto } from '../types/map'
import { PASSO_MAXIMO, PASSO_PADRAO } from '../lib/confronto'

export interface ConfrontoFicha {
  id: string
  /** Nome que o MESTRE lê (o de trabalho). */
  nome: string
}

export interface ConfrontoControlsProps {
  /** As fichas da cena aberta no editor. */
  fichas: readonly ConfrontoFicha[]
  /** O confronto desta cena; `undefined` = nenhum. */
  confronto: Confronto | undefined
  onIniciar(fila: string[], passo: number): void
  onProximaVez(): void
  onEncerrar(): void
}

/** O rótulo do botão que abre a montagem: é por ele que o teste e o leitor de tela acham a ação. */
export const CONFRONTO_LABEL = 'Confronto nesta cena'

/**
 * CONFRONTO POR CENA, no painel do mestre. Sem confronto: "Confronto nesta
 * cena" abre, ali mesmo, a montagem — marcar as fichas (a ordem é a da
 * marcação), acertar com Subir/Descer e escolher o passo. "Começar" confirma
 * (Enter também, é um `<form>`); "Cancelar" e Esc fecham sem mexer em nada.
 * Com confronto: a fila com a vez marcada, "Próxima vez" e "Encerrar".
 * Vale para a cena ABERTA; cada cena guarda o seu.
 */
export function ConfrontoControls({ fichas, confronto, onIniciar, onProximaVez, onEncerrar }: ConfrontoControlsProps) {
  if (confronto !== undefined) {
    return <ConfrontoAtivo fichas={fichas} confronto={confronto} onProximaVez={onProximaVez} onEncerrar={onEncerrar} />
  }
  return <MontarConfronto fichas={fichas} onIniciar={onIniciar} />
}

function ConfrontoAtivo({
  fichas,
  confronto,
  onProximaVez,
  onEncerrar,
}: Pick<ConfrontoControlsProps, 'fichas' | 'onProximaVez' | 'onEncerrar'> & { confronto: Confronto }) {
  const nomes = new Map(fichas.map((f) => [f.id, f.nome]))
  return (
    <section className="lb-party__send" aria-label="Confronto">
      <span className="lb-label">Confronto · {confronto.passo} casas por vez</span>
      <ol className="lb-gather__list">
        {confronto.fila.map((id, indice) => (
          <li key={id} aria-current={indice === confronto.vez ? 'true' : undefined} className={indice === confronto.vez ? 'lb-confronto__vez' : undefined}>
            {nomes.get(id) ?? 'Ficha fora da cena'}
          </li>
        ))}
      </ol>
      <div className="lb-party__actions">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onEncerrar}>
          Encerrar
        </button>
        <button type="button" className="lb-btn lb-btn--primary" onClick={onProximaVez}>
          Próxima vez
        </button>
      </div>
    </section>
  )
}

function MontarConfronto({ fichas, onIniciar }: Pick<ConfrontoControlsProps, 'fichas' | 'onIniciar'>) {
  const baseId = useId()
  const [open, setOpen] = useState(false)
  /** Os marcados, NA ORDEM DA VEZ. */
  const [fila, setFila] = useState<string[]>([])
  const [passo, setPasso] = useState(String(PASSO_PADRAO))
  const openButtonRef = useRef<HTMLButtonElement | null>(null)
  const firstCheckRef = useRef<HTMLInputElement | null>(null)
  const hintId = `${baseId}-hint`
  const emptyId = `${baseId}-vazio`
  const nomes = new Map(fichas.map((f) => [f.id, f.nome]))
  // Ficha que saiu da cena com a montagem aberta sai da fila.
  const filaNaCena = fila.filter((id) => nomes.has(id))
  const passoNumero = Number(passo)
  const passoOk = Number.isInteger(passoNumero) && passoNumero >= 1 && passoNumero <= PASSO_MAXIMO

  useEffect(() => {
    if (open) firstCheckRef.current?.focus()
  }, [open])

  const close = () => {
    setOpen(false)
    setFila([])
    setPasso(String(PASSO_PADRAO))
    // O foco volta a quem abriu: o teclado não cai no começo da página.
    openButtonRef.current?.focus()
  }

  const toggle = (id: string, checked: boolean) => {
    setFila((current) => (checked ? [...current.filter((x) => x !== id), id] : current.filter((x) => x !== id)))
  }

  const mover = (id: string, delta: -1 | 1) => {
    setFila((current) => {
      const i = current.indexOf(id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= current.length) return current
      const next = [...current]
      next[i] = current[j] ?? id
      next[j] = id
      return next
    })
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (filaNaCena.length === 0 || !passoOk) return
    onIniciar(filaNaCena, passoNumero)
    close()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha sem começar; não pode chegar ao canvas (Esc lá troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    close()
  }

  // A fila na ordem da vez, com o nome de cada uma.
  const marcadas = filaNaCena.flatMap((id) => {
    const nome = nomes.get(id)
    return nome === undefined ? [] : [{ id, nome }]
  })
  const semFicha = fichas.length === 0

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        className="lb-btn lb-btn--block"
        aria-expanded={open}
        aria-controls={open ? `${baseId}-form` : undefined}
        aria-describedby={semFicha ? emptyId : undefined}
        disabled={semFicha}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {CONFRONTO_LABEL}
      </button>
      {semFicha && (
        <span className="lb-label" id={emptyId}>
          Nenhuma ficha nesta cena.
        </span>
      )}
      {open && !semFicha && (
        <form id={`${baseId}-form`} className="lb-party__send" aria-label="Montar o confronto" onSubmit={submit} onKeyDown={onKeyDown}>
          <span className="lb-label">Quem entra</span>
          {/* A lista de marcar fica na ordem da cena e não pula ao marcar; a
              ordem da vez é a lista de baixo (a da marcação, acertada com Subir/Descer). */}
          <ul className="lb-gather__list">
            {fichas.map((ficha, indice) => (
              <li key={ficha.id}>
                <label className="lb-gather__item">
                  <input
                    ref={indice === 0 ? firstCheckRef : undefined}
                    type="checkbox"
                    className="lb-gather__check"
                    checked={filaNaCena.includes(ficha.id)}
                    onChange={(event) => toggle(ficha.id, event.target.checked)}
                  />
                  <span className="lb-party__name">{ficha.nome}</span>
                </label>
              </li>
            ))}
          </ul>
          {marcadas.length > 0 && (
            <>
              <span className="lb-label">Ordem da vez</span>
              <ol className="lb-gather__list">
                {marcadas.map((ficha, posicao) => (
                  <li key={ficha.id} className="lb-confronto__linha">
                    <span className="lb-party__name">{ficha.nome}</span>
                    <button type="button" className="lb-btn lb-btn--ghost" aria-label={`Subir ${ficha.nome}`} disabled={posicao === 0} onClick={() => mover(ficha.id, -1)}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="lb-btn lb-btn--ghost"
                      aria-label={`Descer ${ficha.nome}`}
                      disabled={posicao === marcadas.length - 1}
                      onClick={() => mover(ficha.id, 1)}
                    >
                      ↓
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
          <label className="lb-label" htmlFor={`${baseId}-passo`}>
            Passo por vez (casas)
          </label>
          <input
            id={`${baseId}-passo`}
            type="number"
            className="lb-input"
            min={1}
            max={PASSO_MAXIMO}
            step={1}
            value={passo}
            aria-invalid={!passoOk}
            onChange={(event) => setPasso(event.target.value)}
          />
          {!passoOk && <span className="lb-label">Use um número inteiro de 1 a {PASSO_MAXIMO}.</span>}
          {filaNaCena.length === 0 && (
            <span className="lb-label" id={hintId}>
              Marque ao menos uma ficha.
            </span>
          )}
          <div className="lb-party__actions">
            <button type="button" className="lb-btn lb-btn--ghost" onClick={close}>
              Cancelar
            </button>
            <button
              type="submit"
              className="lb-btn lb-btn--primary"
              disabled={filaNaCena.length === 0 || !passoOk}
              aria-describedby={filaNaCena.length === 0 ? hintId : undefined}
            >
              Começar
            </button>
          </div>
        </form>
      )}
    </>
  )
}
