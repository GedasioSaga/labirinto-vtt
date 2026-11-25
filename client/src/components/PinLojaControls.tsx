import { useEffect, useMemo, useState } from 'react'
import type { LojaItem } from '../types/map'
import { LOJA_ESTOQUE_MAX, LOJA_ITENS_MAX, LOJA_NOME_MAX, novaMercadoria, precoAConferir, precoEmBerries, precoProprio, precoSemOProprio } from '../lib/loja'
import { ITEM_PRECO_MAX } from '../lib/leituraDoItem'
import { Toggle } from './Toggle'
import { itemParaDar, type ItemDoCatalogo as ItemDoAcervo, type PastaDeItens } from '../lib/acervoDeItens'
import { gruposPorPasta, itemCasaNaBusca, palavrasDaBusca, textosDeBusca } from './BuscaDoAcervoDeItens'
import { lerOAcervoSeFaltar, useAcervoDeItensStore } from '../stores/acervoDeItensStore'

export interface PinLojaControlsProps {
  /** As mercadorias do pino aberto no painel; `null` = sem loja. */
  loja: LojaItem[] | null
  /** `undefined` tira a loja do pino. */
  onChange: (loja: LojaItem[] | undefined) => void
  /** Id da mercadoria nova. Ausente = um id aleatório. */
  novoId?: () => string
}

const HINT_ID = 'lb-pin-loja-hint'

export const idAleatorio = (): string => `item_${crypto.randomUUID()}`

/** A mercadoria sem o estoque: ausente é "sem conta", e ausente não é `undefined` gravado. A coisa do Acervo fica. */
function semEstoque(item: LojaItem): LojaItem {
  const { estoque: _estoque, ...resto } = item
  return resto
}

/**
 * Fase 5 (uma porta para criar item): a mercadoria vira a coisa do Acervo
 * escolhida: nome, os dados da coisa e o preço dela, que passa a seguir o
 * Acervo (sem preço próprio: mudar lá chega aqui). "" = volta a ser digitada:
 * o nome fica e, se seguia o Acervo, o preço que cobrava vira o próprio (sem a
 * coisa, ela sairia grátis sem o mestre ver).
 */
function comCoisa(item: LojaItem, coisa: ItemDoAcervo | undefined, acervo: readonly ItemDoAcervo[]): LojaItem {
  const { acervo: _antes, ...digitada } = item
  if (coisa === undefined) return digitada.preco === '' ? { ...digitada, preco: String(precoSemOProprio(item)) } : digitada
  // Com as munições e a luz (18/11/2026): a arma comprada chega à mochila com as balas que aceita, e a tocha ilumina.
  const { nome, ...dados } = itemParaDar(coisa, acervo)
  const itemId = dados.itemId ?? coisa.id
  return { ...digitada, nome: nome.slice(0, LOJA_NOME_MAX), preco: '', acervo: { ...dados, itemId } }
}

/**
 * O preço que o campo digitado pede: vazio = sem preço próprio (''); número
 * vira inteiro de berries dentro da faixa, em dígitos; lixo (`NaN`) = não mexe.
 */
function precoDigitado(texto: string): string | undefined {
  if (texto.trim() === '') return ''
  const numero = Number(texto)
  if (!Number.isFinite(numero)) return undefined
  return String(Math.min(ITEM_PRECO_MAX, Math.max(0, Math.floor(numero))))
}

/** O que o campo de preço vazio diz: o que a mercadoria cobra sem preço próprio. */
function precoDoCampoVazio(item: LojaItem): string {
  const preco = precoSemOProprio(item)
  const texto = preco === 0 ? 'Grátis' : precoEmBerries(preco)
  return item.acervo === undefined ? texto : `${texto} (do Acervo)`
}

/** O texto da opção: o nome e, com preço, o preço em berries. */
function rotuloDaCoisa(coisa: ItemDoAcervo): string {
  return coisa.preco === null ? coisa.nome : `${coisa.nome} (${precoEmBerries(coisa.preco)})`
}

interface SeletorDaCoisaProps {
  base: string
  numero: number
  item: LojaItem
  doAcervo: readonly ItemDoAcervo[]
  pastas: readonly PastaDeItens[]
  onEscolher: (coisa: ItemDoAcervo | undefined) => void
}

/**
 * A coisa do Acervo da mercadoria (18/11/2026, análise Fable: a loja era um
 * `<select>` sem busca). O campo de busca é o mesmo do painel do Acervo
 * (nome, categoria, descrição e pasta) e estreita a lista; as pastas viram os
 * grupos da lista, na ordem da árvore. A coisa escolhida fica na lista mesmo
 * fora da busca: sem ela o seletor mostraria outra.
 */
function SeletorDaCoisa({ base, numero, item, doAcervo, pastas, onEscolher }: SeletorDaCoisaProps) {
  const [busca, setBusca] = useState('')
  const textos = useMemo(() => textosDeBusca(doAcervo, pastas), [doAcervo, pastas])
  const palavras = palavrasDaBusca(busca)
  const achados = palavras.length === 0 ? doAcervo : doAcervo.filter((coisa) => itemCasaNaBusca(textos.get(coisa.id), palavras))
  const grupos = gruposPorPasta(achados, pastas)
  const escolhidaId = item.acervo?.itemId
  const escolhida = escolhidaId === undefined ? undefined : doAcervo.find((coisa) => coisa.id === escolhidaId)
  const escolhidaFora = escolhida !== undefined && !achados.includes(escolhida)
  const nadaAchado = palavras.length > 0 && achados.length === 0
  return (
    <>
      <label className="lb-label" htmlFor={`${base}-acervo-busca`}>
        {`Buscar no Acervo, mercadoria ${numero}`}
      </label>
      <input
        id={`${base}-acervo-busca`}
        className="lb-input"
        type="search"
        value={busca}
        placeholder="Nome, categoria ou pasta"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => setBusca(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || busca === '') return
          // Esc limpa a busca e não chega ao mapa; com ela vazia, o Esc segue o caminho de sempre.
          event.preventDefault()
          event.stopPropagation()
          setBusca('')
        }}
      />
      <label className="lb-label" htmlFor={`${base}-acervo`}>
        {`Coisa do Acervo da mercadoria ${numero}`}
      </label>
      <select id={`${base}-acervo`} className="lb-input" value={escolhidaId ?? ''} onChange={(event) => onEscolher(doAcervo.find((coisa) => coisa.id === event.target.value))}>
        <option value="">Nenhuma (digitada)</option>
        {/* A coisa que saiu do Acervo continua escolhida: a mercadoria guarda a cópia dela. */}
        {escolhidaId !== undefined && escolhida === undefined && <option value={escolhidaId}>{item.nome} (fora do Acervo)</option>}
        {escolhidaFora && <option value={escolhida.id}>{rotuloDaCoisa(escolhida)}</option>}
        {grupos.map((grupo) => (
          <optgroup key={grupo.id ?? 'sem-pasta'} label={grupo.rotulo}>
            {grupo.itens.map((coisa) => (
              <option key={coisa.id} value={coisa.id}>
                {rotuloDaCoisa(coisa)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {nadaAchado && (
        <p className="lb-label" role="status">
          {`Nada no Acervo com “${busca.trim()}”.`}
        </p>
      )}
    </>
  )
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
 * cada mercadoria: nome, preço (número de berries; vazio = o do Acervo, ou
 * grátis na digitada) e estoque (vazio = não acaba). O jogador vê a lista no
 * cartão, com o preço que a bolsa paga, e toca "Quero"; o pedido chega na
 * caixa "Pedidos" com "Vender" e "Não".
 */
export function PinLojaControls({
  loja,
  onChange,
  novoId = idAleatorio,
  embutido = false,
}: PinLojaControlsProps & {
  /** Dentro da ficha do recurso (fatia 12): sem o interruptor, que lá é o "Tirar do pino". */
  embutido?: boolean
}) {
  const doAcervo = useAcervoDeItensStore((state) => state.itens)
  const pastas = useAcervoDeItensStore((state) => state.pastas)
  // O Acervo mora no disco do app: sem o painel aberto antes, a lista da loja nasceria vazia.
  useEffect(() => lerOAcervoSeFaltar(), [])
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
      {!embutido && (
        <Toggle
          label="Loja com preços"
          checked={loja !== null}
          describedBy={loja === null ? undefined : HINT_ID}
          onChange={(on) => onChange(on ? [novaMercadoria(novoId())] : undefined)}
        />
      )}
      {loja !== null && (
        <>
          <ul className="lb-loja" aria-label="Mercadorias da loja">
            {loja.map((item, indice) => {
              const numero = indice + 1
              const base = `lb-loja-${item.id}`
              const aConferir = precoAConferir(item)
              const conferirId = `${base}-preco-conferir`
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
                  <SeletorDaCoisa
                    base={base}
                    numero={numero}
                    item={item}
                    doAcervo={doAcervo}
                    pastas={pastas}
                    onEscolher={(coisa) => trocar(indice, comCoisa(item, coisa, doAcervo))}
                  />
                  <div className="lb-loja__linha">
                    <div className="lb-loja__campo">
                      <label className="lb-label" htmlFor={`${base}-preco`}>
                        {`Preço da mercadoria ${numero}`}
                      </label>
                      <input
                        id={`${base}-preco`}
                        className="lb-input"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={ITEM_PRECO_MAX}
                        step={1}
                        value={precoProprio(item) ?? ''}
                        placeholder={aConferir === null ? precoDoCampoVazio(item) : 'Berries'}
                        aria-describedby={aConferir === null ? undefined : conferirId}
                        onChange={(event) => {
                          // "-" ou "e" no meio da digitação chegam como vazio: não apagam o preço nem o texto antigo a conferir.
                          if (event.target.validity.badInput) return
                          const preco = precoDigitado(event.target.value)
                          if (preco !== undefined) trocar(indice, { ...item, preco })
                        }}
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
                  {aConferir !== null && (
                    <p className="lb-field__error" id={conferirId}>
                      {`O preço antigo “${aConferir}” não é número: escreva em berries (0 = grátis). Até lá ela não sai à venda.`}
                    </p>
                  )}
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
            O jogador vê nome, preço e estoque no cartão e toca “Quero”; o pedido chega a você com Vender e Não. Vender baixa o estoque, põe a mercadoria na mochila dele e tira o preço da bolsa dele. Preço vazio segue o Acervo (a digitada sai grátis); um número vale só nesta banca. Estoque vazio não acaba. A coisa do Acervo chega com foto e empilha.
          </p>
        </>
      )}
    </div>
  )
}
