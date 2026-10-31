import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { arredondarParaDano, calcular, CONTA_MAX, formatarDaConta } from '../../lib/batalha/calculadora'
import './batalha.css'
import './combate.css'

/**
 * A CALCULADORA DO DANO (pedido de 31/10/2026): um campo onde o jogador
 * escreve a conta como fala ("200 + 15%", "10% de 900", "(80 + 45) x 1,5"), o
 * resultado ao vivo com a conta numa linha, teclas grandes para quem prefere
 * clicar e "Usar este valor", que entrega o dano (inteiro, para baixo) a quem
 * abriu. A conta é de `lib/batalha/calculadora.ts`; aqui é só a tela.
 *
 * Abre no lugar, logo abaixo do campo (a mira é papel recortado e rola: um
 * balão por cima seria cortado). Enter usa; Esc fecha sem mexer no campo e
 * não vaza para a mira ou a janela atrás. As teclas não roubam o foco do
 * campo da conta: o clique escreve onde o cursor está.
 */

export interface CalculadoraDeDanoProps {
  /** O id da caixa (o `aria-controls` do botão Calcular). */
  id?: string
  /** O que o campo do dano tem agora: vira o começo da conta ("60" → "60 + 15%"). */
  inicial: string
  /** O dano da conta, já inteiro e não negativo; quem abriu põe no campo e fecha. */
  onUsar: (dano: number) => void
  onFechar: () => void
}

interface Tecla {
  rotulo: string
  /** O que entra no campo; ausente = o próprio rótulo. */
  insere?: string
  /** O nome lido pelo leitor de tela, quando o rótulo é um sinal. */
  nome?: string
  tipo?: 'sinal' | 'acao'
  acao?: 'apagar' | 'limpar'
}

/** As quatro fileiras de cima (4 teclas) e a de baixo (5 teclas). */
const FILEIRAS: readonly (readonly Tecla[])[] = [
  [{ rotulo: '7' }, { rotulo: '8' }, { rotulo: '9' }, { rotulo: '÷', insere: ' ÷ ', nome: 'dividido por', tipo: 'sinal' }],
  [{ rotulo: '4' }, { rotulo: '5' }, { rotulo: '6' }, { rotulo: 'x', insere: ' x ', nome: 'vezes', tipo: 'sinal' }],
  [{ rotulo: '1' }, { rotulo: '2' }, { rotulo: '3' }, { rotulo: '−', insere: ' - ', nome: 'menos', tipo: 'sinal' }],
  [{ rotulo: '0' }, { rotulo: ',', nome: 'vírgula' }, { rotulo: '%', nome: 'por cento', tipo: 'sinal' }, { rotulo: '+', insere: ' + ', nome: 'mais', tipo: 'sinal' }],
  [
    { rotulo: '(', nome: 'abre parêntese', tipo: 'sinal' },
    { rotulo: ')', nome: 'fecha parêntese', tipo: 'sinal' },
    { rotulo: 'de', insere: ' de ', nome: 'de (porcentagem de)', tipo: 'sinal' },
    { rotulo: '⌫', nome: 'Apagar', tipo: 'acao', acao: 'apagar' },
    { rotulo: 'C', nome: 'Limpar tudo', tipo: 'acao', acao: 'limpar' },
  ],
]

const EXEMPLO = '200 + 15%, 10% de 900, (80 + 45) x 1,5'

/** O sinal que uma tecla acabou de pôr (" x ", " de "), para o ⌫ tirar inteiro. */
const SINAL_NO_FIM = /\s*(?:de|[-+−x×*/÷])\s+$/i

/** O texto sem o que vem antes do cursor: a seleção inteira, o sinal recém-posto ou uma letra. */
function apagarAntes(texto: string, inicio: number, fim: number): { texto: string; cursor: number } {
  if (inicio !== fim) return { texto: texto.slice(0, inicio) + texto.slice(fim), cursor: inicio }
  if (inicio === 0) return { texto, cursor: 0 }
  const sinal = SINAL_NO_FIM.exec(texto.slice(0, inicio))
  const corte = sinal === null ? inicio - 1 : sinal.index
  return { texto: texto.slice(0, corte) + texto.slice(inicio), cursor: corte }
}

export function CalculadoraDeDano({ id, inicial, onUsar, onFechar }: CalculadoraDeDanoProps) {
  const idBase = useId()
  const raiz = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState(() => (/^\s*\d+\s*$/.test(inicial) ? inicial.trim() : ''))
  /** Onde o cursor fica depois da troca que uma tecla fez. */
  const cursorPendente = useRef<number | null>(null)

  // Abre com o foco na conta e o cursor no fim: "60" vira "60 + 15%" sem clicar.
  useLayoutEffect(() => {
    const el = campo.current
    if (el === null) return
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
    // Na mira que rola, a calculadora inteira (até o "Usar") entra na vista.
    raiz.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  useLayoutEffect(() => {
    const cursor = cursorPendente.current
    if (cursor === null) return
    cursorPendente.current = null
    campo.current?.setSelectionRange(cursor, cursor)
  }, [texto])

  const conta = texto.trim() === '' ? null : calcular(texto)
  const dano = conta !== null && conta.ok ? arredondarParaDano(conta.valor) : null

  const trocar = (novo: string, cursor: number) => {
    const cortado = novo.slice(0, CONTA_MAX)
    cursorPendente.current = Math.min(cursor, cortado.length)
    setTexto(cortado)
  }

  const apertar = (tecla: Tecla) => {
    const el = campo.current
    const inicio = el?.selectionStart ?? texto.length
    const fim = el?.selectionEnd ?? texto.length
    if (tecla.acao === 'limpar') {
      trocar('', 0)
      return
    }
    if (tecla.acao === 'apagar') {
      const apagado = apagarAntes(texto, inicio, fim)
      trocar(apagado.texto, apagado.cursor)
      return
    }
    const antes = texto.slice(0, inicio)
    // " + " depois de um espaço não dobra o espaço; no começo da conta, sem espaço na frente.
    let pedaco = tecla.insere ?? tecla.rotulo
    if (antes === '' || antes.endsWith(' ')) pedaco = pedaco.trimStart()
    trocar(antes + pedaco + texto.slice(fim), antes.length + pedaco.length)
  }

  const usar = () => {
    if (dano !== null) onUsar(dano)
  }

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === 'Escape') {
      // Fecha só a calculadora: nem a mira volta, nem a janela fecha.
      evento.preventDefault()
      evento.stopPropagation()
      onFechar()
      return
    }
    if (evento.key === 'Enter' && evento.target === campo.current) {
      // Enter na conta usa o valor; não lança o golpe nem confirma a janela.
      evento.preventDefault()
      evento.stopPropagation()
      usar()
    }
  }

  return (
    <div ref={raiz} id={id} className="bt-calc" role="group" aria-labelledby={`${idBase}-titulo`} onKeyDown={teclar}>
      <div className="bt-calc__topo">
        <span className="bt-calc__titulo" id={`${idBase}-titulo`}>
          Calculadora
        </span>
        <button type="button" className="bt-calc__fechar" aria-label="Fechar a calculadora" onClick={onFechar}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <input
        ref={campo}
        className="bt-calc__campo"
        type="text"
        value={texto}
        maxLength={CONTA_MAX}
        placeholder="200 + 15%"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label="Conta"
        aria-describedby={`${idBase}-resultado`}
        aria-invalid={conta !== null && !conta.ok ? true : undefined}
        onChange={(evento) => setTexto(evento.target.value)}
      />
      <div className="bt-calc__resultado" id={`${idBase}-resultado`} aria-live="polite" data-estado={conta === null ? 'vazio' : conta.ok ? 'ok' : 'erro'}>
        {conta === null ? (
          <span className="bt-calc__dica">Escreva como fala: {EXEMPLO}</span>
        ) : conta.ok ? (
          <>
            <span className="bt-calc__passos">{conta.passos}</span>
            <output className="bt-calc__valor">{formatarDaConta(dano ?? 0)}</output>
            {dano !== conta.valor && <span className="bt-calc__dica">Dano é inteiro: fica {formatarDaConta(dano ?? 0)}.</span>}
          </>
        ) : (
          <span className="bt-calc__motivo">{conta.motivo}</span>
        )}
      </div>
      <div className="bt-calc__teclas">
        {FILEIRAS.map((fileira) =>
          fileira.map((tecla) => (
            <button
              key={tecla.rotulo}
              type="button"
              className="bt-calc__tecla"
              data-tipo={tecla.tipo}
              data-cinco={fileira.length === 5 ? 'sim' : undefined}
              aria-label={tecla.nome}
              // O clique escreve na conta sem tirar o foco dela (o cursor fica onde estava).
              onMouseDown={(evento) => evento.preventDefault()}
              onClick={() => apertar(tecla)}
            >
              {tecla.rotulo}
            </button>
          )),
        )}
      </div>
      <div className="bt-calc__acoes">
        <button type="button" className="bt-botao bt-botao--batalha" disabled={dano === null} onClick={usar}>
          Usar este valor{dano === null ? '' : `: ${formatarDaConta(dano)}`} <kbd>Enter</kbd>
        </button>
        <button type="button" className="bt-botao" onClick={onFechar}>
          Fechar <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  )
}

/** O botão que abre e fecha a calculadora, ao lado do campo do dano. */
export function BotaoDaCalculadora({ aberta, controla, onAlternar, botao }: { aberta: boolean; controla?: string; onAlternar: () => void; botao?: Ref<HTMLButtonElement> }) {
  return (
    <button ref={botao} type="button" className="bt-botao bt-botao--p bt-calc-botao" aria-expanded={aberta} aria-controls={aberta ? controla : undefined} onClick={onAlternar}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        <rect x="3" y="1.5" width="10" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <rect x="5" y="3.5" width="6" height="2.5" rx="0.5" fill="currentColor" />
        <circle cx="5.75" cy="8.5" r="0.8" fill="currentColor" />
        <circle cx="8" cy="8.5" r="0.8" fill="currentColor" />
        <circle cx="10.25" cy="8.5" r="0.8" fill="currentColor" />
        <circle cx="5.75" cy="11.25" r="0.8" fill="currentColor" />
        <circle cx="8" cy="11.25" r="0.8" fill="currentColor" />
        <circle cx="10.25" cy="11.25" r="0.8" fill="currentColor" />
      </svg>
      Calcular
    </button>
  )
}
