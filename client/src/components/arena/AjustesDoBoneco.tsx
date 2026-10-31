import { useId, useState } from 'react'
import { MODIFICADOR_DA_REACAO_MAX } from '../../lib/batalha/combate'
import { VIDA_INFINITA, type AjustesDoBoneco as Ajustes, type ReacaoDoBoneco } from '../../lib/arena/tipos'

/**
 * OS AJUSTES DO JUDGE-BONECO (docs/planos/batalha-arena-de-testes-plano.md
 * §4.4): vida infinita ou um HP, o Escudo, o modificador da reação e como ele
 * reage (rola o d20 ou fica parado). Na montagem fica dentro do cartão do
 * boneco; na luta, no popover do placar. Cada número válido vai na hora para
 * `onAjustar` (a store guarda na montagem e troca a cópia do boneco na luta,
 * sem linha no registro); o campo vazio ou torto volta ao valor guardado ao
 * sair dele.
 */

export interface AjustesDoBonecoProps {
  valor: Ajustes
  onAjustar: (ajuste: Partial<Ajustes>) => void
  /** O sistema do livro tem Escudo; sem ele o campo fica desligado, com o motivo. */
  comEscudo: boolean
  /** O sistema tem vida: sem ela o boneco nunca cai, e o HP fica desligado, com o motivo. */
  comVida: boolean
  /** "luta": a nota de que o ajuste não entra no registro. */
  momento: 'montagem' | 'luta'
}

const HP_MAX = VIDA_INFINITA - 1

const EXPLICACAO_DA_REACAO: Record<ReacaoDoBoneco, string> = {
  d20: 'Rola o d20 com o modificador e fica com a melhor defesa que o dado liberar: esquiva, metade ou cheio. Nunca contra-ataca.',
  parado: 'Não reage: todo golpe entra cheio.',
}

/** "+5", "−3", "0": o modificador como a caixa de reação o escreve. */
function comSinal(valor: number): string {
  if (valor > 0) return `+${valor}`
  if (valor < 0) return `−${Math.abs(valor)}`
  return '0'
}

interface CampoInteiroProps {
  rotulo: string
  valor: number
  min: number
  max: number
  onMudar: (valor: number) => void
  /** O motivo de estar desligado (vira a dica embaixo). */
  desligado?: string | null
  /** Uma dica embaixo com o campo ligado. */
  dica?: string | null
  /** O que aparece no lugar do número com o campo desligado ("∞"). */
  noLugar?: string
  /** Botões − e + (o modificador). */
  passos?: boolean
  mostrar?: (valor: number) => string
}

/**
 * Um inteiro com rascunho: cada número válido digitado já vai para `onMudar`
 * (o ajuste é de laboratório, sem registro); o texto torto fica só no campo,
 * marcado, e volta ao valor guardado ao sair dele. Setas para cima e para
 * baixo andam de 1.
 */
function CampoInteiro({ rotulo, valor, min, max, onMudar, desligado = null, dica = null, noLugar, passos = false, mostrar = String }: CampoInteiroProps) {
  const id = useId()
  const dicaId = `${id}-dica`
  // O rascunho vale só para o valor em que nasceu: gravou (ou mudou por fora), ele sai sozinho.
  const [guardado, setGuardado] = useState<{ texto: string; de: number } | null>(null)
  const rascunho = guardado !== null && guardado.de === valor ? guardado.texto : null
  const setRascunho = (texto: string | null) => setGuardado(texto === null ? null : { texto, de: valor })

  const ler = (texto: string): number | null => {
    const limpo = texto.trim().replace('−', '-').replace(/^\+/, '')
    if (!/^-?\d+$/.test(limpo)) return null
    const numero = Number(limpo)
    return Number.isSafeInteger(numero) && numero >= min && numero <= max ? numero : null
  }
  const passo = (delta: number) => {
    const novo = Math.min(max, Math.max(min, valor + delta))
    if (novo !== valor) onMudar(novo)
  }
  // Campo apagado para redigitar ainda não é erro: só o texto torto.
  const invalido = rascunho !== null && rascunho.trim() !== '' && ler(rascunho) === null
  const textoDaDica = desligado ?? (invalido ? null : dica)

  return (
    <div className="mu-campo ar-ajuste">
      <label htmlFor={id}>{rotulo}</label>
      <div className="ar-ajuste__linha">
        {passos && (
          <button type="button" className="mu-bt mu-bt--p ar-passo" aria-label={`${rotulo}: menos 1`} disabled={desligado !== null || valor <= min} onClick={() => passo(-1)}>
            {'−'}
          </button>
        )}
        <input
          id={id}
          className="mu-entrada ar-ajuste__num"
          inputMode="numeric"
          autoComplete="off"
          disabled={desligado !== null}
          aria-invalid={invalido || undefined}
          aria-describedby={textoDaDica !== null || invalido ? dicaId : undefined}
          value={desligado !== null && noLugar !== undefined ? noLugar : (rascunho ?? mostrar(valor))}
          onChange={(evento) => {
            const texto = evento.target.value
            setRascunho(texto)
            const lido = ler(texto)
            if (lido !== null && lido !== valor) onMudar(lido)
          }}
          onBlur={() => setRascunho(null)}
          onKeyDown={(evento) => {
            if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
              evento.preventDefault()
              passo(evento.key === 'ArrowUp' ? 1 : -1)
              setRascunho(null)
            } else if (evento.key === 'Enter') {
              setRascunho(null)
            }
          }}
        />
        {passos && (
          <button type="button" className="mu-bt mu-bt--p ar-passo" aria-label={`${rotulo}: mais 1`} disabled={desligado !== null || valor >= max} onClick={() => passo(1)}>
            +
          </button>
        )}
      </div>
      {invalido && desligado === null ? (
        <span className="mu-campo__erro" id={dicaId}>
          Use um número inteiro de {mostrar(min)} a {mostrar(max)}.
        </span>
      ) : (
        textoDaDica !== null && (
          <span className="mu-campo__dica" id={dicaId}>
            {textoDaDica}
          </span>
        )
      )}
    </div>
  )
}

export function AjustesDoBoneco({ valor, onAjustar, comEscudo, comVida, momento }: AjustesDoBonecoProps) {
  const reacaoId = useId()
  const motivoDoHp = !comVida ? 'O sistema deste livro não tem vida: o Judge não cai.' : valor.infinito ? 'Vida infinita: nenhum golpe derruba o Judge.' : null

  return (
    <div className="ar-ajustes">
      <label className="ar-chave">
        <input type="checkbox" role="switch" checked={valor.infinito} disabled={!comVida} onChange={(evento) => onAjustar({ infinito: evento.target.checked })} />
        <span className="ar-chave__trilho" aria-hidden="true" />
        <span>Vida infinita</span>
      </label>
      <div className="ar-ajustes__grade">
        <CampoInteiro rotulo="HP" valor={valor.hp} min={1} max={HP_MAX} onMudar={(hp) => onAjustar({ hp })} desligado={motivoDoHp} noLugar={'∞'} />
        <CampoInteiro
          rotulo="Escudo"
          valor={valor.escudo}
          min={0}
          max={HP_MAX}
          onMudar={(escudo) => onAjustar({ escudo })}
          desligado={comEscudo ? null : 'O sistema deste livro não tem Escudo.'}
          noLugar="—"
        />
      </div>
      <CampoInteiro
        rotulo="Modificador da reação"
        valor={valor.modificador}
        min={-MODIFICADOR_DA_REACAO_MAX}
        max={MODIFICADOR_DA_REACAO_MAX}
        onMudar={(modificador) => onAjustar({ modificador })}
        dica={valor.reage === 'parado' ? 'Parado não rola: fica guardado para quando ele rolar o d20.' : null}
        passos
        mostrar={comSinal}
      />
      <fieldset className="ar-ajustes__reage" aria-describedby={reacaoId}>
        <legend className="mu-campo__rot">Quando leva um golpe</legend>
        <div className="ar-seg ar-seg--cheio">
          {(['d20', 'parado'] as const).map((reage) => (
            <label key={reage} className="ar-seg__op">
              <input type="radio" name={`${reacaoId}-reage`} value={reage} checked={valor.reage === reage} onChange={() => onAjustar({ reage })} />
              <span>{reage === 'd20' ? 'Rola o d20' : 'Fica parado'}</span>
            </label>
          ))}
        </div>
        <p className="mu-campo__dica ar-ajustes__nota" id={reacaoId}>
          {EXPLICACAO_DA_REACAO[valor.reage]}
        </p>
      </fieldset>
      {momento === 'luta' && <p className="mu-pg-nota ar-ajustes__nota">Ajuste de laboratório: vale na hora e não entra no registro.</p>}
    </div>
  )
}
