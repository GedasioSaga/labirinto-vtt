import { useState } from 'react'
import type { PinColecao } from '../types/map'
import { COLECAO_MAX_PARTES, COLECAO_NOME_MAX_LENGTH } from '../lib/colecao'
import { CLUE_TEXT_MAX_LENGTH } from '../lib/clues'
import { Toggle } from './Toggle'

export interface PinColecaoControlsProps {
  /** A peça do pino aberto no painel; `null` = pino avulso. */
  colecao: PinColecao | null
  /** `undefined` tira o pino da coleção. */
  onChange: (colecao: PinColecao | undefined) => void
  /** Nomes de coleção que outros pinos desta cena já usam: sugestões do campo, para a peça cair na mesma coleção. */
  nomes: readonly string[]
  /**
   * O pino tem texto ou foto que o jogador lê? Sem isso ninguém lê o cartão,
   * o host não guarda a pista e a peça nunca soma — o painel avisa.
   */
  temCartao: boolean
}

const NOME_ID = 'lb-pin-colecao-nome'
const NOMES_ID = 'lb-pin-colecao-nomes'
const PARTE_ID = 'lb-pin-colecao-parte'
const TOTAL_ID = 'lb-pin-colecao-total'
const INTEIRA_ID = 'lb-pin-colecao-inteira'

/** A peça sem a frase: ausente não é `undefined` gravado. */
function withoutInteira(colecao: PinColecao): PinColecao {
  return { nome: colecao.nome, parte: colecao.parte, total: colecao.total }
}

/** O que a peça faz para o jogador, ou por que ela não conta. */
function resumo(colecao: PinColecao, temCartao: boolean): string {
  if (colecao.nome.trim() === '') return 'Sem nome, a peça não conta.'
  if (colecao.parte > colecao.total) return `A peça ${colecao.parte} não cabe numa coleção de ${colecao.total}.`
  if (!temCartao) return 'Sem texto nem imagem, ninguém lê este pino: a peça não conta.'
  return `Quem lê esta peça ganha a casa ${colecao.parte} de “${colecao.nome.trim()}” no Caderno.`
}

/**
 * Número de peça: o campo guarda o que o mestre digita (apagar para escrever
 * outro número não pode pular de volta), e só um inteiro de 1 a
 * `COLECAO_MAX_PARTES` vai para o pino. Ao sair do campo, volta ao gravado.
 */
function NumeroDaPeca({ id, label, value, onCommit }: { id: string; label: string; value: number; onCommit: (value: number) => void }) {
  const [rascunho, setRascunho] = useState<string | null>(null)
  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="lb-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={rascunho ?? String(value)}
        onChange={(event) => {
          const texto = event.target.value
          setRascunho(texto)
          if (!/^[0-9]+$/.test(texto)) return
          const numero = Number(texto)
          if (numero >= 1 && numero <= COLECAO_MAX_PARTES && numero !== value) onCommit(numero)
        }}
        onBlur={() => setRascunho(null)}
      />
    </div>
  )
}

/**
 * COLEÇÃO DE PISTAS no painel do pino (qualquer tipo). O mestre diz de que
 * coleção o pino é peça, o número e o total, e escreve a frase ou o item
 * inteiro — que só o jogador que juntar todas as peças lê. Nada disso vai no
 * recorte: o jogador recebe só o progresso dele, do host.
 */
export function PinColecaoControls({ colecao, onChange, nomes, temCartao }: PinColecaoControlsProps) {
  return (
    <div className="lb-field">
      <Toggle label="Peça de coleção" checked={colecao !== null} onChange={(on) => onChange(on ? { nome: '', parte: 1, total: 2 } : undefined)} />
      {colecao !== null && (
        <>
          <label className="lb-label" htmlFor={NOME_ID}>
            Coleção
          </label>
          <input
            id={NOME_ID}
            className="lb-input"
            type="text"
            list={NOMES_ID}
            value={colecao.nome}
            maxLength={COLECAO_NOME_MAX_LENGTH}
            autoComplete="off"
            onChange={(event) => onChange({ ...colecao, nome: event.target.value })}
          />
          <datalist id={NOMES_ID}>
            {nomes.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
          <NumeroDaPeca id={PARTE_ID} label="Peça nº" value={colecao.parte} onCommit={(parte) => onChange({ ...colecao, parte })} />
          <NumeroDaPeca id={TOTAL_ID} label="De quantas" value={colecao.total} onCommit={(total) => onChange({ ...colecao, total })} />
          <p className="lb-travel__hint">{resumo(colecao, temCartao)}</p>
          <label className="lb-label" htmlFor={INTEIRA_ID}>
            Frase ou item inteiro
          </label>
          <textarea
            id={INTEIRA_ID}
            className="lb-input lb-textarea"
            rows={3}
            value={colecao.inteira ?? ''}
            maxLength={CLUE_TEXT_MAX_LENGTH}
            onChange={(event) => onChange(event.target.value === '' ? withoutInteira(colecao) : { ...colecao, inteira: event.target.value })}
          />
          <span className="lb-label">Só aparece para quem juntar todas as peças. Basta escrever numa delas.</span>
        </>
      )}
    </div>
  )
}
