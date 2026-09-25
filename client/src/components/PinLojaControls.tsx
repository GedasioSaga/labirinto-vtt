import type { LojaItem } from '../types/map'
import { LOJA_ESTOQUE_MAX, LOJA_ITENS_MAX, LOJA_NOME_MAX, LOJA_PRECO_MAX, novaMercadoria } from '../lib/loja'
import { Toggle } from './Toggle'

export interface PinLojaControlsProps {
  /** As mercadorias do pino aberto no painel; `null` = sem loja. */
  loja: LojaItem[] | null
  /** `undefined` tira a loja do pino. */
  onChange: (loja: LojaItem[] | undefined) => void
  /** Id da mercadoria nova. Ausente = um id aleatório. */
  novoId?: () => string
}

const HINT_ID = 'lb-pin-loja-hint'

const idAleatorio = (): string => `item_${crypto.randomUUID()}`

/** A mercadoria sem o estoque: ausente é "sem conta", e ausente não é `undefined` gravado. */
function semEstoque(item: LojaItem): LojaItem {
  return { id: item.id, nome: item.nome, preco: item.preco }
}

/**
 * O estoque que o campo digitado pede: vazio = sem conta (`null`); número vira
 * inteiro dentro da faixa; lixo (`NaN`) = não mexe (`undefined`).
 */
function estoqueDigitado(texto: string): number | null | undefined {
  if (texto.trim() === '') return null
  const numero = Number(texto)
  if (!Number.isFinite(numero)) return undefined
  return Math.min(LOJA_ESTOQUE_MAX, Math.max(0, Math.floor(numero)))
}

/**
 * LOJA COM PREÇOS no painel do pino "!"/"?". O mestre liga a loja e escreve
 * cada mercadoria: nome, preço (texto livre, na moeda da aventura) e estoque
 * (vazio = não acaba). O jogador vê a lista no cartão e toca "Quero"; o pedido
 * chega na caixa "Pedidos" com "Vender" e "Não".
 */
export function PinLojaControls({ loja, onChange, novoId = idAleatorio }: PinLojaControlsProps) {
  const trocar = (indice: number, item: LojaItem) => {
    if (loja === null) return
    onChange(loja.map((atual, i) => (i === indice ? item : atual)))
  }
  const tirar = (indice: number) => {
    if (loja === null) return
    const resto = loja.filter((_, i) => i !== indice)
    onChange(resto.length === 0 ? undefined : resto)
  }
  return (
    <div className="lb-field">
      <Toggle
        label="Loja com preços"
        checked={loja !== null}
        describedBy={loja === null ? undefined : HINT_ID}
        onChange={(on) => onChange(on ? [novaMercadoria(novoId())] : undefined)}
      />
      {loja !== null && (
        <>
          <ul className="lb-loja" aria-label="Mercadorias da loja">
            {loja.map((item, indice) => {
              const numero = indice + 1
              const base = `lb-loja-${item.id}`
              return (
                <li key={item.id} className="lb-loja__item">
                  <label className="lb-label" htmlFor={`${base}-nome`}>
                    {`Mercadoria ${numero}`}
                  </label>
                  <input
                    id={`${base}-nome`}
                    className="lb-input"
                    type="text"
                    value={item.nome}
                    maxLength={LOJA_NOME_MAX}
                    placeholder="Xarope de tosse"
                    onChange={(event) => trocar(indice, { ...item, nome: event.target.value })}
                  />
                  <div className="lb-loja__linha">
                    <div className="lb-loja__campo">
                      <label className="lb-label" htmlFor={`${base}-preco`}>
                        {`Preço da mercadoria ${numero}`}
                      </label>
                      <input
                        id={`${base}-preco`}
                        className="lb-input"
                        type="text"
                        value={item.preco}
                        maxLength={LOJA_PRECO_MAX}
                        placeholder="1 moeda"
                        onChange={(event) => trocar(indice, { ...item, preco: event.target.value })}
                      />
                    </div>
                    <div className="lb-loja__campo">
                      <label className="lb-label" htmlFor={`${base}-estoque`}>
                        {`Estoque da mercadoria ${numero}`}
                      </label>
                      <input
                        id={`${base}-estoque`}
                        className="lb-input"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={LOJA_ESTOQUE_MAX}
                        step={1}
                        value={item.estoque ?? ''}
                        placeholder="Sem conta"
                        onChange={(event) => {
                          const estoque = estoqueDigitado(event.target.value)
                          if (estoque === undefined) return
                          trocar(indice, estoque === null ? semEstoque(item) : { ...item, estoque })
                        }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="lb-btn lb-btn--ghost"
                    aria-label={`Tirar ${item.nome.trim() === '' ? `mercadoria ${numero}` : item.nome}`}
                    onClick={() => tirar(indice)}
                  >
                    Tirar
                  </button>
                </li>
              )
            })}
          </ul>
          <button type="button" className="lb-btn lb-btn--block" disabled={loja.length >= LOJA_ITENS_MAX} onClick={() => onChange([...loja, novaMercadoria(novoId())])}>
            + Mercadoria
          </button>
          <p className="lb-label" id={HINT_ID}>
            O jogador vê nome, preço e estoque no cartão e toca “Quero”; o pedido chega a você com Vender e Não. Vender baixa o estoque e põe a mercadoria na mochila dele. Estoque vazio não acaba.
          </p>
        </>
      )}
    </div>
  )
}
