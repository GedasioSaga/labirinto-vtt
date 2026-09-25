import { useId, useState, type FormEvent } from 'react'
import { MOEDAS_MAX, tradeSideText } from '../lib/troca'
import type { CarriedItem } from '../types/map'
import type { TradePhase, TradeOfferState } from './playerConnection'

export interface PlayerTradeCardProps {
  troca: TradeOfferState
  /** O que as fichas dele carregam: a contraproposta escolhe daqui. */
  mochila: CarriedItem[]
  /** A bolsa das fichas dele (a maior: uma ficha só paga). */
  moedas: number
  onAnswer(accept: boolean): void
  onCounter(itemIds: string[], moedas: number): void
  /** Fecha o cartão da troca que já acabou. */
  onDismiss(): void
}

/** O que o cartão diz quando a oferta não espera mais o jogador. */
const PHASE_TEXT: Record<Exclude<TradePhase, 'open'>, string> = {
  answered: 'Resposta enviada…',
  countered: 'Contraproposta enviada ao mestre',
  done: 'Troca feita',
  refused: 'Troca recusada',
  cancelled: 'O mestre desfez a oferta',
  unavailable: 'Não deu: algo mudou desde a oferta',
}

/** Fases em que a troca acabou: o cartão ganha "Fechar". */
function isClosed(phase: TradePhase): boolean {
  return phase === 'done' || phase === 'refused' || phase === 'cancelled' || phase === 'unavailable'
}

/**
 * MOEDAS E TROCA — a oferta do mestre na tela do jogador: quem oferece, o
 * que dá e o que pede, com Aceitar, Recusar e Contrapropor. Não rouba o foco
 * (chega sem ele pedir, como o recado). O texto do mestre entra como texto
 * do React, nunca como HTML.
 */
export function PlayerTradeCard({ troca, mochila, moedas, onAnswer, onCounter, onDismiss }: PlayerTradeCardProps) {
  const titleId = useId()
  const [countering, setCountering] = useState(false)
  const pedidos = new Set(troca.peco.itens.map((item) => item.id))
  const tem = new Set(mochila.map((item) => item.id))
  const podePagar = [...pedidos].every((id) => tem.has(id)) && moedas >= troca.peco.moedas
  const dou = tradeSideText(troca.dou.itens, troca.dou.moedas)
  const peco = tradeSideText(
    troca.peco.itens.map((item) => item.nome),
    troca.peco.moedas,
  )

  return (
    <section className="pp-note pp-troca" aria-labelledby={titleId}>
      <h2 id={titleId} className="pp-note__title">
        Oferta de {troca.de}
      </h2>
      <p className="pp-note__text">
        {troca.de} dá: {dou}
      </p>
      <p className="pp-note__text">
        {troca.de} pede: {peco}
      </p>
      {troca.phase !== 'open' ? (
        <>
          <p className="pp-note__hint" role="status" aria-live="polite">
            {PHASE_TEXT[troca.phase]}
          </p>
          {isClosed(troca.phase) && (
            <button type="button" className="pp-note__close" onClick={onDismiss}>
              Fechar
            </button>
          )}
        </>
      ) : countering ? (
        <CounterForm mochila={mochila} moedas={moedas} onSend={onCounter} onBack={() => setCountering(false)} />
      ) : (
        <>
          {!podePagar && <p className="pp-note__hint">Você não tem tudo o que é pedido</p>}
          <div className="pp-troca__acoes">
            <button type="button" className="pp-button" disabled={!podePagar} onClick={() => onAnswer(true)}>
              Aceitar
            </button>
            <button type="button" className="pp-button" onClick={() => onAnswer(false)}>
              Recusar
            </button>
            <button type="button" className="pp-button" onClick={() => setCountering(true)}>
              Contrapropor
            </button>
          </div>
        </>
      )}
    </section>
  )
}

interface CounterFormProps {
  mochila: CarriedItem[]
  moedas: number
  onSend(itemIds: string[], moedas: number): void
  onBack(): void
}

/** O valor do campo de moedas: inteiro de 0 ao que ele tem; o resto não vale. */
function coinsFrom(raw: string, max: number): number | null {
  if (raw.trim() === '') return 0
  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 && value <= max ? value : null
}

/**
 * A contraproposta: marca itens do bolso e escreve quantas moedas dá no lugar
 * do pedido. Enviar fica indisponível sem nada marcado nem moeda, ou com mais
 * moedas do que ele tem. É um `<form>`: Enter no campo envia.
 */
function CounterForm({ mochila, moedas, onSend, onBack }: CounterFormProps) {
  const coinsId = useId()
  const [marcados, setMarcados] = useState<string[]>([])
  const [valor, setValor] = useState('')
  const coins = coinsFrom(valor, Math.min(moedas, MOEDAS_MAX))
  const vazio = marcados.length === 0 && (coins === null || coins === 0)
  const invalido = coins === null

  const toggle = (id: string) => setMarcados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (vazio || coins === null) return
    onSend(marcados, coins)
  }

  return (
    <form className="pp-troca__contra" aria-label="Contraproposta" onSubmit={submit}>
      {mochila.length === 0 ? (
        <p className="pp-note__hint">Nada no bolso para oferecer.</p>
      ) : (
        <fieldset className="pp-troca__itens">
          <legend>Dar no lugar</legend>
          {mochila.map((item) => (
            <label key={item.id} className="pp-troca__item">
              <input type="checkbox" value={item.id} checked={marcados.includes(item.id)} onChange={() => toggle(item.id)} /> {item.nome}
            </label>
          ))}
        </fieldset>
      )}
      <label htmlFor={coinsId}>Moedas (você tem {moedas})</label>
      <input id={coinsId} type="number" inputMode="numeric" min={0} max={moedas} step={1} value={valor} onChange={(event) => setValor(event.target.value)} />
      {invalido && (
        <p className="pp-note__hint" role="alert">
          Use um número inteiro até {moedas}
        </p>
      )}
      <div className="pp-troca__acoes">
        <button type="button" className="pp-button" onClick={onBack}>
          Voltar
        </button>
        <button type="submit" className="pp-button" disabled={vazio || invalido}>
          Enviar contraproposta
        </button>
      </div>
    </form>
  )
}
