import { useCallback, useId, useState, type ReactNode } from 'react'
import { NOME_DO_SELO_MAX } from '../../../../lib/batalha/combate'
import { TURNOS_DA_PECA_MAX, type CondicaoDaPeca } from '../../../../lib/batalha/mecanica/pecas'
import { Glifo } from './glifos'
import { CONDICOES_DAS_PECAS, turnos, type OpcaoDaPeca } from './vocabulario'

/**
 * OS CONTROLES DAS PEÇAS (rework do editor de habilidades, E4; `num`, `txt`, `sel`, `caixa` e `seg` do
 * protótipo aprovado). Cada peça se lê como uma frase com campos dentro: o campo tem o nome na
 * leitura de tela (`aria-label`) e a frase em volta diz o que ele é. O que o leitor das peças recusaria
 * (número fora da faixa, nome vazio, 0 onde 0 não vale) não sai do campo: fica só na tela, marcado,
 * até a pessoa acertar ou sair dele.
 */

/**
 * Põe uma variável CSS no elemento (a cor da família, a do elemento). Pelo `ref`, e não pelo `style`:
 * o tipo do `style` do React não conhece propriedades `--*`, e o caminho do tipo seria um `as`.
 */
export function useVariavelCss(nome: string, valor: string): (no: HTMLElement | null) => void {
  return useCallback(
    (no: HTMLElement | null) => {
      no?.style.setProperty(nome, valor)
    },
    [nome, valor],
  )
}

/** Uma linha da frase ("Ao acertar, o alvo perde [10] [pontos] de [Velocidade]"). */
export function Frase({ children, sub = false }: { children: ReactNode; sub?: boolean }) {
  return <div className={sub ? 'lb-pc__frase lb-pc__frase--sub' : 'lb-pc__frase'}>{children}</div>
}

/** O texto em volta dos campos. */
export function Texto({ children, forte = false }: { children: ReactNode; forte?: boolean }) {
  return forte ? <b className="lb-pc__forte">{children}</b> : <span>{children}</span>
}

export function Nota({ children }: { children: ReactNode }) {
  return <p className="lb-pc__nota">{children}</p>
}

/** O rótulo de um grupo de linhas ("Faz", "Ritmo"). */
export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const id = useId()
  return (
    <div className="lb-pc__campo" role="group" aria-labelledby={id}>
      <span className="lb-pc__rot" id={id}>
        {rotulo}
      </span>
      {children}
    </div>
  )
}

interface NumeroProps {
  rotulo: string
  valor: number
  minimo: number
  maximo: number
  onChange: (valor: number) => void
  /** O 0 não vale (o "quanto sobe", o "quanto muda"): fica só na tela, marcado. */
  semZero?: boolean
}

/**
 * Número inteiro dentro da faixa. Digitando, o texto fica como está ("-" a caminho de "-5"); o que
 * passa da faixa grava o teto, e ao sair do campo o texto volta ao número guardado.
 */
export function Numero({ rotulo, valor, minimo, maximo, onChange, semZero = false }: NumeroProps) {
  const [texto, setTexto] = useState<string | null>(null)
  const lido = texto === null ? valor : Number(texto)
  const torto = texto !== null && (texto.trim() === '' || !Number.isInteger(lido) || lido < minimo || lido > maximo || (semZero && lido === 0))
  return (
    <input
      className="lb-pc__num"
      type="number"
      inputMode="numeric"
      min={minimo}
      max={maximo}
      step={1}
      aria-label={rotulo}
      aria-invalid={torto || undefined}
      title={torto ? `De ${minimo} a ${maximo}${semZero ? ', sem o 0' : ''}` : undefined}
      value={texto ?? String(valor)}
      onChange={(evento) => {
        const digitado = evento.target.value
        setTexto(digitado)
        const numero = Number(digitado)
        if (digitado.trim() === '' || !Number.isInteger(numero) || (semZero && numero === 0)) return
        const preso = Math.min(maximo, Math.max(minimo, numero))
        if (preso !== valor) onChange(preso)
      }}
      onBlur={() => setTexto(null)}
    />
  )
}

interface TextoCurtoProps {
  rotulo: string
  valor: string
  maximo: number
  onChange: (valor: string) => void
  placeholder?: string
  /** O vazio vale ("sem grupo"); sem isto, o vazio fica só na tela. */
  vazioVale?: boolean
  /** Nasce com o foco (o nome do elemento próprio, logo depois do "+"). */
  focar?: boolean
  largo?: boolean
}

/** Texto de uma linha (nome de condição, de resposta, de criatura). */
export function TextoCurto({ rotulo, valor, maximo, onChange, placeholder, vazioVale = false, focar = false, largo = false }: TextoCurtoProps) {
  const [texto, setTexto] = useState<string | null>(null)
  const naTela = texto ?? valor
  const torto = !vazioVale && naTela.trim() === ''
  return (
    <input
      className={largo ? 'lb-pc__txt lb-pc__txt--largo' : 'lb-pc__txt'}
      type="text"
      aria-label={rotulo}
      aria-invalid={torto || undefined}
      title={torto ? 'Precisa de um nome' : undefined}
      value={naTela}
      maxLength={maximo}
      placeholder={placeholder}
      spellCheck={false}
      autoFocus={focar}
      onChange={(evento) => {
        const digitado = evento.target.value
        setTexto(digitado)
        if (vazioVale || digitado.trim() !== '') onChange(digitado)
      }}
      onBlur={() => setTexto(null)}
    />
  )
}

/** Uma escolha numa lista (`select`): o valor volta tipado, só os da lista. */
export function Escolher<T extends string>({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: T; opcoes: readonly OpcaoDaPeca<T>[]; onChange: (valor: T) => void }) {
  const fora = !opcoes.some((opcao) => opcao.valor === valor)
  return (
    <select
      className="lb-pc__sel"
      aria-label={rotulo}
      value={valor}
      onChange={(evento) => {
        const achada = opcoes.find((opcao) => opcao.valor === evento.target.value)
        if (achada !== undefined) onChange(achada.valor)
      }}
    >
      {fora && <option value={valor}>{valor}</option>}
      {opcoes.map((opcao) => (
        <option key={opcao.valor} value={opcao.valor}>
          {opcao.rotulo}
        </option>
      ))}
    </select>
  )
}

/** Botões de escolha única, com rádio de verdade por baixo (setas e Espaço como no sistema). */
export function Segmentos<T extends string>({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: T; opcoes: readonly OpcaoDaPeca<T>[]; onChange: (valor: T) => void }) {
  const nome = useId()
  return (
    <fieldset className="lb-pc__seg">
      <legend className="lb-sr-only">{rotulo}</legend>
      {opcoes.map((opcao) => (
        <label key={opcao.valor} className="lb-pc__seg-op" data-marcado={opcao.valor === valor ? '' : undefined}>
          <input className="lb-sr-only" type="radio" name={nome} value={opcao.valor} checked={opcao.valor === valor} onChange={() => onChange(opcao.valor)} />
          <span>{opcao.rotulo}</span>
        </label>
      ))}
    </fieldset>
  )
}

/** Caixa de marcar com o texto clicável na frente. */
export function Caixa({ rotulo, marcado, onChange }: { rotulo: string; marcado: boolean; onChange: (marcado: boolean) => void }) {
  return (
    <label className="lb-pc__caixa">
      <input type="checkbox" checked={marcado} onChange={(evento) => onChange(evento.target.checked)} />
      <span>{rotulo}</span>
    </label>
  )
}

/** O "×" de tirar uma linha, com o nome do que sai. */
export function Tirar({ rotulo, onClick }: { rotulo: string; onClick: () => void }) {
  return (
    <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-ed__bt--ic lb-pc__tirar" aria-label={rotulo} title={rotulo} onClick={onClick}>
      <Glifo nome="x" />
    </button>
  )
}

/** O "+ Resposta", "+ Atributo". */
export function Mais({ children, onClick, fantasma = false }: { children: ReactNode; onClick: () => void; fantasma?: boolean }) {
  return (
    <button type="button" className={fantasma ? 'lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-pc__mais' : 'lb-ed__bt lb-ed__bt--p lb-pc__mais'} onClick={onClick}>
      <Glifo nome="mais" />
      {children}
    </button>
  )
}

/** Um "+ algo" que é uma lista: escolher já põe (e a lista volta ao rótulo). */
export function PorDaLista<T extends string>({ rotulo, opcoes, onPor }: { rotulo: string; opcoes: readonly OpcaoDaPeca<T>[]; onPor: (valor: T) => void }) {
  return (
    <select
      className="lb-pc__sel lb-pc__sel--por"
      aria-label={rotulo}
      value=""
      onChange={(evento) => {
        const achada = opcoes.find((opcao) => opcao.valor === evento.target.value)
        if (achada !== undefined) onPor(achada.valor)
      }}
    >
      <option value="" disabled>
        + {rotulo.toLocaleLowerCase('pt-BR')}
      </option>
      {opcoes.map((opcao) => (
        <option key={opcao.valor} value={opcao.valor}>
          {opcao.rotulo}
        </option>
      ))}
    </select>
  )
}

const SEM_CONDICAO = ''

/**
 * A condição que a peça põe: o nome (da lista do protótipo, ou o que já estava guardado) e, com
 * condição, por quantos turnos. `nenhuma` = dá para escolher "nenhuma condição" (fica ausente).
 */
export function EscolherCondicao({ rotulo, valor, nenhuma, onChange }: { rotulo: string; valor: CondicaoDaPeca | undefined; nenhuma: boolean; onChange: (valor: CondicaoDaPeca | undefined) => void }) {
  const nomeAtual = valor?.nome ?? SEM_CONDICAO
  const conhecida = CONDICOES_DAS_PECAS.some((condicao) => condicao.nome === nomeAtual)
  return (
    <>
      <select
        className="lb-pc__sel"
        aria-label={rotulo}
        value={nomeAtual}
        onChange={(evento) => {
          const nome = evento.target.value
          if (nome === SEM_CONDICAO) {
            if (nenhuma) onChange(undefined)
            return
          }
          if (nome.length <= NOME_DO_SELO_MAX) onChange({ nome, turnos: valor?.turnos ?? 1 })
        }}
      >
        {nenhuma && <option value={SEM_CONDICAO}>nenhuma condição</option>}
        {!conhecida && nomeAtual !== SEM_CONDICAO && <option value={nomeAtual}>{nomeAtual}</option>}
        {CONDICOES_DAS_PECAS.map((condicao) => (
          <option key={condicao.nome} value={condicao.nome} title={condicao.faz}>
            {condicao.nome}
          </option>
        ))}
      </select>
      {valor !== undefined && (
        <>
          <Texto>por</Texto>
          <Numero rotulo={`${rotulo}: turnos`} valor={valor.turnos} minimo={1} maximo={TURNOS_DA_PECA_MAX} onChange={(n) => onChange({ ...valor, turnos: n })} />
          <Texto>{turnos(valor.turnos)}</Texto>
        </>
      )}
    </>
  )
}
