import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { comSinal, descreverRegistro, interpretarAjuste, interpretarValor } from '../lib/ajusteDaFicha'
import type { RegistroDaFicha } from '../lib/personagem'

/**
 * Peças do AJUSTE RÁPIDO da ficha (`lib/ajusteDaFicha.ts`): o − e o +, o
 * campo que aceita "-50", a linha que junta os três, o painel que abre ao
 * tocar o HP, e o "Histórico". Nada aqui grava: cada peça devolve o valor
 * NOVO a quem a usa, que decide para onde ele vai (a aventura do mestre, o
 * envio juntado do jogador).
 */

interface BotaoPassoProps {
  /** Nome acessível: "Diminuir HP", "Aumentar Força". */
  rotulo: string
  sinal: '−' | '+'
  /** Já no limite: o botão continua focável (o foco não some no meio do teclado), só não faz nada. */
  noLimite?: boolean
  onClick: () => void
}

export function BotaoPasso({ rotulo, sinal, noLimite = false, onClick }: BotaoPassoProps) {
  return (
    <button type="button" className="lb-passo" aria-label={rotulo} aria-disabled={noLimite || undefined} onClick={noLimite ? undefined : onClick}>
      <span aria-hidden="true">{sinal}</span>
    </button>
  )
}

interface CampoDeAjusteProps {
  id?: string
  /** Nome acessível do campo ("HP", "modificador de Força"). */
  rotulo: string
  valor: number
  onTrocar: (valor: number) => void
  /**
   * `conta` (padrão): "-50" tira, "+30" soma, "450" é o valor exato.
   * `valor`: o modificador — o sinal é do número ("+3" é +3, não "soma 3").
   */
  modo?: 'conta' | 'valor'
  dicaId?: string
}

/**
 * O número que se digita: Enter (ou sair do campo) aplica; Esc desfaz o que
 * foi digitado. Texto que não é ajuste fica marcado no Enter e volta ao
 * valor ao sair — nunca grava lixo. Teclado de texto, e não o numérico: o
 * numérico do celular não tem "-" nem "+".
 */
export function CampoDeAjuste({ id, rotulo, valor, onTrocar, modo = 'conta', dicaId }: CampoDeAjusteProps) {
  const mostrado = modo === 'valor' ? comSinal(valor) : String(valor)
  /** `null` = ninguém digitando: o campo mostra o valor de agora (o mestre mudou, a mesa confirmou). */
  const [texto, setTexto] = useState<string | null>(null)
  const [invalido, setInvalido] = useState(false)

  /** `false` = o texto não é ajuste (fica para corrigir). */
  const aplicar = (): boolean => {
    if (texto === null || texto.trim() === mostrado) {
      setTexto(null)
      return true
    }
    const novo = modo === 'valor' ? interpretarValor(texto) : interpretarAjuste(texto, valor)
    if (novo === null) {
      setInvalido(true)
      return false
    }
    setTexto(null)
    setInvalido(false)
    if (novo !== valor) onTrocar(novo)
    return true
  }
  const desfazer = () => {
    setTexto(null)
    setInvalido(false)
  }

  return (
    <input
      id={id}
      className="lb-input lb-ajuste__campo"
      type="text"
      inputMode="text"
      autoComplete="off"
      enterKeyHint="done"
      spellCheck={false}
      aria-label={rotulo}
      aria-describedby={dicaId}
      aria-invalid={invalido || undefined}
      value={texto ?? mostrado}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        setTexto(event.target.value)
        setInvalido(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          aplicar()
        } else if (event.key === 'Escape' && texto !== null) {
          // Só desfaz a digitação; o Esc seguinte (sem texto) fecha o painel.
          event.preventDefault()
          event.stopPropagation()
          desfazer()
        }
      }}
      onBlur={() => {
        if (!aplicar()) desfazer()
      }}
    />
  )
}

interface LinhaDeAjusteProps {
  /** O que a linha é, visível: "Atual", "Máximo", "Modificador". */
  rotulo: string
  /** O nome do número para quem não vê: "HP", "HP máximo", "modificador de Força". */
  nome: string
  valor: number
  onTrocar: (valor: number) => void
  min?: number
  max?: number
  modo?: 'conta' | 'valor'
  dicaId?: string
}

/** "Atual  [−] [450] [+]": a linha do painel. */
export function LinhaDeAjuste({ rotulo, nome, valor, onTrocar, min, max, modo, dicaId }: LinhaDeAjusteProps) {
  const id = useId()
  return (
    <div className="lb-ajuste__linha">
      <label className="lb-ajuste__rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <span className="lb-ajuste__controles">
        <BotaoPasso rotulo={`Diminuir ${nome}`} sinal="−" noLimite={min !== undefined && valor <= min} onClick={() => onTrocar(valor - 1)} />
        <CampoDeAjuste id={id} rotulo={nome} valor={valor} onTrocar={onTrocar} modo={modo} dicaId={dicaId} />
        <BotaoPasso rotulo={`Aumentar ${nome}`} sinal="+" noLimite={max !== undefined && valor >= max} onClick={() => onTrocar(valor + 1)} />
      </span>
    </div>
  )
}

interface PainelDeAjusteProps {
  id: string
  /** "Ajustar HP": o nome do grupo. */
  rotulo: string
  titulo: string
  /** O valor de agora no topo do painel ("450/700"). */
  resumo: string
  onFechar: () => void
  children: (dicaId: string) => ReactNode
}

/**
 * O painel que abre embaixo do número tocado. Não é janela: a ficha
 * continua à mão, e o foco vai para ele (sem abrir o teclado do celular,
 * que só sobe quando a pessoa toca um campo). Esc ou × fecha.
 */
export function PainelDeAjuste({ id, rotulo, titulo, resumo, onFechar, children }: PainelDeAjusteProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dicaId = useId()
  useEffect(() => {
    ref.current?.focus()
  }, [])
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return
    // O Esc fecha só o painel, e não a ficha inteira em volta dele.
    event.preventDefault()
    event.stopPropagation()
    onFechar()
  }
  return (
    <div ref={ref} id={id} className="lb-ajuste" role="group" aria-label={rotulo} tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="lb-ajuste__topo">
        <span className="lb-ajuste__titulo">{titulo}</span>
        <span className="lb-ajuste__resumo">{resumo}</span>
        <button type="button" className="lb-passo lb-passo--fechar" aria-label={`Fechar o ajuste de ${titulo}`} onClick={onFechar}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {children(dicaId)}
    </div>
  )
}

/** A dica dos campos do painel; quem a usa liga o `id` no `aria-describedby`. */
export function DicaDoAjuste({ id, modificador = false }: { id: string; modificador?: boolean }) {
  return (
    <p id={id} className="lb-ajuste__dica">
      {modificador ? 'Digite e Enter: -50 tira, +30 soma, 450 é o valor exato; no modificador, +5 é +5.' : 'Digite e Enter: -50 tira, +30 soma, 450 é o valor exato.'}
    </p>
  )
}

/** "14:32", e "07/10 14:32" quando não é de hoje. */
function horaDoRegistro(quando: number, agora: Date): string {
  const data = new Date(quando)
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return data.toDateString() === agora.toDateString() ? hora : `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`
}

/**
 * O "Histórico" da ficha: fechado por padrão (no celular, não toma o lugar
 * dos números), o mais novo em cima, uma linha curta por mudança.
 */
export function HistoricoDaFicha({ historico }: { historico: readonly RegistroDaFicha[] }) {
  if (historico.length === 0) return null
  const agora = new Date()
  return (
    <details className="lb-ficha__historico">
      <summary className="lb-ficha__historico-titulo">
        Histórico <span className="lb-ficha__historico-conta">{historico.length}</span>
      </summary>
      <ol className="lb-ficha__historico-lista">
        {historico
          .map((registro, indice) => ({ registro, indice }))
          .reverse()
          .map(({ registro, indice }) => (
            <li key={`${registro.quando}-${indice}`} className="lb-ficha__historico-item">
              <span className="lb-ficha__historico-texto">{descreverRegistro(registro)}</span>
              <span className="lb-ficha__historico-meta">
                {registro.quem} · <time dateTime={new Date(registro.quando).toISOString()}>{horaDoRegistro(registro.quando, agora)}</time>
              </span>
            </li>
          ))}
      </ol>
    </details>
  )
}
