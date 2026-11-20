import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { ItemDoCatalogo } from '../../../lib/acervoDeItens'
import type { Puzzle } from '../../../puzzles/tipos'
import { useAcervoDeItensStore } from '../../../stores/acervoDeItensStore'
import type { PecaDoEditor, PecasDoEditor } from '../pecasDoEditor'

/** O que toda seção da ficha do editor recebe: o puzzle do editor e o caminho de mudar (um passo do Desfazer). */
export interface PropsDaSecao {
  puzzle: Puzzle
  /**
   * `chave` junta passos seguidos do mesmo campo (cada letra não vira um passo).
   * A função recebe o puzzle de AGORA: serve a quem muda depois de esperar (a
   * peça desenhada que entra no acervo antes de virar a peça certa).
   */
  mudar: (proximo: Puzzle | ((atual: Puzzle) => Puzzle), chave?: string) => void
}

/** A peça escolhida pronta para o encaixe: a desenhada entra no acervo antes. `null` = não deu (o aviso já saiu). */
export type UsarPeca = (peca: PecaDoEditor) => Promise<string | null>

/** A seção da ficha (`.ficha` do protótipo): título, contagem opcional e o corpo. */
export function Secao({ titulo, conta, children }: { titulo: string; conta?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <section className="pze-ficha" aria-labelledby={id}>
      <h3 id={id}>
        {titulo}
        {conta !== undefined && <small>{conta}</small>}
      </h3>
      {children}
    </section>
  )
}

/** O valor da opção "nenhuma peça" dos seletores de peça. */
export const SEM_PECA = ''

/**
 * O seletor da peça certa (o `opcoesPeca` do v2): a biblioteca primeiro (as
 * desenhadas que faltam no acervo entram nele ao escolher), depois os outros
 * itens do acervo. A peça que sumiu do acervo continua escolhida, com o aviso.
 */
export function SeletorDePeca({
  pecas,
  valor,
  vazio,
  rotulo,
  onEscolher,
}: {
  pecas: PecasDoEditor
  valor: string | null
  vazio: string
  rotulo: string
  onEscolher: (peca: PecaDoEditor | null) => void
}) {
  const sumiu = valor !== null && pecas.porId(valor) === null
  const opcao = (peca: PecaDoEditor) => (
    <option key={peca.itemId} value={peca.itemId}>
      {peca.noAcervo ? peca.nome : `${peca.nome} (desenhada)`}
    </option>
  )
  return (
    <select
      className="gr-entrada"
      aria-label={rotulo}
      value={valor ?? SEM_PECA}
      onChange={(evento) => {
        const id = evento.currentTarget.value
        onEscolher(id === SEM_PECA ? null : pecas.porId(id))
      }}
    >
      <option value={SEM_PECA}>{vazio}</option>
      {sumiu && <option value={valor}>Item apagado do acervo</option>}
      {pecas.biblioteca.length > 0 && <optgroup label="Peças de puzzle">{pecas.biblioteca.map(opcao)}</optgroup>}
      {pecas.outras.length > 0 && <optgroup label="Outros itens do acervo">{pecas.outras.map(opcao)}</optgroup>}
    </select>
  )
}

/**
 * Número inteiro curto (peso, PV, quantidade, moedas). O texto do campo é
 * dele enquanto se digita (apagar para trocar "3" por "5" passa por vazio);
 * só um número dentro da faixa chega a `onChange`, e sair do campo volta ao valor.
 */
export function NumeroDoCampo({ valor, min, max, rotulo, onChange }: { valor: number; min: number; max: number; rotulo: string; onChange: (valor: number) => void }) {
  const [texto, setTexto] = useState(String(valor))
  const [visto, setVisto] = useState(valor)
  if (valor !== visto) {
    setVisto(valor)
    setTexto(String(valor))
  }
  return (
    <input
      className="gr-entrada pze-numero"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={1}
      aria-label={rotulo}
      value={texto}
      onChange={(evento) => {
        const bruto = evento.currentTarget.value
        setTexto(bruto)
        const n = Number(bruto)
        if (bruto.trim() !== '' && Number.isInteger(n) && n >= min && n <= max) onChange(n)
      }}
      onBlur={() => setTexto(String(valor))}
    />
  )
}

const LIMITE_DA_BUSCA = 8

/**
 * "+ Item do acervo": a mesma busca do conteúdo do baú (`ConteudoDoObjetoFicha`,
 * com as classes dela), para o desfecho e as pedras da troca. Enter escolhe o
 * primeiro, Esc fecha.
 */
export function EscolhaDeItem({ aoEscolher, aoFechar, verbo }: { aoEscolher: (item: ItemDoCatalogo) => void; aoFechar: () => void; verbo: string }) {
  const itens = useAcervoDeItensStore((estado) => estado.itens)
  const [busca, setBusca] = useState('')
  const campo = useRef<HTMLInputElement>(null)
  const listaId = useId()
  useEffect(() => {
    campo.current?.focus()
  }, [])
  const achados = useMemo(() => {
    const chave = busca.trim().toLocaleLowerCase('pt-BR')
    const lista = chave === '' ? itens : itens.filter((item) => item.nome.toLocaleLowerCase('pt-BR').includes(chave) || item.categoria.toLocaleLowerCase('pt-BR').includes(chave))
    return lista.slice(0, LIMITE_DA_BUSCA)
  }, [busca, itens])
  const aoTeclar = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      aoFechar()
    } else if (evento.key === 'Enter' && achados.length > 0) {
      evento.preventDefault()
      aoEscolher(achados[0])
    }
  }
  return (
    <div className="lb-conteudo__acervo" role="dialog" aria-label="Itens do acervo">
      <input
        ref={campo}
        className="lb-conteudo__busca"
        type="search"
        placeholder="Procurar no acervo"
        aria-label="Procurar no acervo"
        aria-controls={listaId}
        value={busca}
        onChange={(evento) => setBusca(evento.target.value)}
        onKeyDown={aoTeclar}
      />
      {itens.length === 0 ? (
        <p className="lb-field__hint">O acervo de itens está vazio. Crie itens na aba Acervo do livro.</p>
      ) : achados.length === 0 ? (
        <p className="lb-field__hint">Nada com esse nome no acervo.</p>
      ) : (
        <ul id={listaId} className="lb-conteudo__achados">
          {achados.map((item) => (
            <li key={item.id}>
              <button type="button" className="lb-conteudo__achado" onClick={() => aoEscolher(item)}>
                <span>{item.nome}</span>
                {item.categoria !== '' && <small>{item.categoria}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="lb-field__hint">Enter {verbo} · Esc fecha</p>
    </div>
  )
}
