import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { corMedidor } from '../minigames/pesca/arte'
import { DIF, peixePorId } from '../minigames/pesca/sim'
import { estadoEmPalavras } from '../minigames/pesca/tela/textos'
import type { EntradaPesca } from '../minigames/pesca/tipos'
import type { PescaAoVivo, PescaConviteResultado, PescaFase, PescaParticipanteNoMestre } from '../net/pescaNoHost'
import type { PeixeNoCesto } from '../net/protocoloDaPesca'
import './PescaAoVivo.css'

/**
 * A PESCA AO VIVO, no painel do pino de minigame (molde do `DancaAoVivo`):
 * uma linha por jogador com o que ele está fazendo, o lance k de N, o medidor
 * da puxada, o cesto, o maior peixe e a dificuldade, ao vivo pela ponte
 * (`onPescaChange`). Embaixo, "Chamar para pescar" (só no modo "Mestre
 * chama"), "Pausar/Continuar para todos" e "Encerrar para todos".
 *
 * Quem decide é a sessão (`net/pescaNoHost.ts`): este painel só lê e pede.
 * Cada aparelho joga a própria pesca; o mestre só acompanha.
 */

export interface JogadorDaPesca {
  playerId: string
  name: string
}

export interface PescaAoVivoProps {
  pinId: string
  /** Como a pesca deste pino começa agora (o que está gravado no pino). */
  entrada: EntradaPesca
  /** Quem pode ser chamado agora: jogando e com a página aberta. */
  players: readonly JogadorDaPesca[]
  /** A pesca deste pino (aberta, pausada ou a última encerrada); `null` = nenhuma. */
  pesca: PescaAoVivo | null
  onConvidar(playerIds: string[]): PescaConviteResultado | null
  onPausar(): boolean
  onRetomar(): boolean
  onEncerrar(): boolean
}

export const CHAMAR_PARA_PESCAR = 'Chamar para pescar'

export function textoDoConviteRecusado(resultado: PescaConviteResultado | null): string | null {
  if (resultado === null) return 'Não deu: a sala não está aberta.'
  if (resultado.ok) return null
  if (resultado.motivo === 'pino') return 'Este pino não está mais no mapa, ou não é mais de pesca.'
  return 'Ninguém marcado está jogando agora.'
}

const ativa = (fase: PescaFase): boolean => fase === 'aberta' || fase === 'pausa'

function nomeDoPeixe(peixe: PeixeNoCesto): string {
  return peixePorId(peixe.peixe)?.nome ?? 'Peixe'
}

/** O que cada um está fazendo, nas palavras do protótipo ("lançando", "puxando 63%", "pegou Bagre"). */
export function estadoNoPlacar(p: PescaParticipanteNoMestre, fase: PescaFase): string {
  const foraDoAr = p.conectado ? '' : ' · fora do ar'
  if (p.status === 'convidado') return `no convite${foraDoAr}`
  if (p.status === 'terminou') return 'terminou'
  if (p.status === 'saiu') return 'saiu'
  if (fase === 'encerrada') return 'encerrado'
  if (fase === 'pausa') return 'pausado'
  if (p.vivo === undefined) return `pescando${foraDoAr}`
  const ultimo = p.lances.at(-1)
  const desfecho = ultimo === undefined ? null : { tipo: ultimo.resultado, peixe: ultimo.resultado === 'pegou' ? nomeDoPeixe(ultimo.peixe) : undefined }
  return `${estadoEmPalavras(p.vivo.fase, desfecho, p.vivo.medidor)}${foraDoAr}`
}

function Linha({ p, pesca }: { p: PescaParticipanteNoMestre; pesca: PescaAoVivo }) {
  const medidor = p.status === 'pescando' && p.vivo?.fase === 'puxada' ? Math.min(1, Math.max(0, p.vivo.medidor)) : 0
  const lance = p.status === 'pescando' && p.vivo !== undefined ? `Lance ${p.vivo.lance} de ${pesca.lances}` : `${p.lances.length} de ${pesca.lances} lances`
  return (
    <li className="lb-pesca-vivo__pessoa">
      <span className="lb-pesca-vivo__nome">{p.nome}</span>
      <span className="lb-pesca-vivo__status" data-status={p.status}>
        {estadoNoPlacar(p, pesca.fase)}
      </span>
      <span className="lb-pesca-vivo__medidor" role="meter" aria-label={`Medidor de ${p.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(medidor * 100)}>
        <i style={{ transform: `scaleX(${medidor.toFixed(3)})`, background: corMedidor(medidor) }} />
      </span>
      <span className="lb-pesca-vivo__nums">
        <span>{lance}</span>
        <span>
          Cesto <b>{p.cesto.length}</b>
        </span>
        <span>
          Maior <b>{p.maior === undefined ? '—' : `${nomeDoPeixe(p.maior)}, ${p.maior.cm} cm`}</b>
        </span>
        <span>{p.dificuldade === undefined ? 'Sem dificuldade ainda' : DIF[p.dificuldade].nome}</span>
      </span>
    </li>
  )
}

interface ConviteProps {
  players: readonly JogadorDaPesca[]
  onEnviar(playerIds: string[]): void
  onCancelar(): void
}

/** A lista de quem pesca, aberta por "Chamar para pescar". Guarda só quem o mestre desmarcou. */
function Convite({ players, onEnviar, onCancelar }: ConviteProps) {
  const baseId = useId()
  const enviarRef = useRef<HTMLButtonElement>(null)
  const [desmarcados, setDesmarcados] = useState<ReadonlySet<string>>(new Set())
  const marcados = players.filter((p) => !desmarcados.has(p.playerId)).map((p) => p.playerId)
  const dicaId = `${baseId}-dica`

  useEffect(() => {
    enviarRef.current?.focus()
  }, [])

  const marcar = (playerId: string, marcado: boolean) => {
    setDesmarcados((atual) => {
      const novo = new Set(atual)
      if (marcado) novo.delete(playerId)
      else novo.add(playerId)
      return novo
    })
  }

  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (marcados.length > 0) onEnviar(marcados)
  }

  const teclas = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return
    // Esc fecha sem chamar ninguém; não chega ao canvas (Esc lá troca a ferramenta).
    event.preventDefault()
    event.stopPropagation()
    onCancelar()
  }

  return (
    <form className="lb-party__send lb-pesca-vivo__convite" aria-label="Quem pesca" onSubmit={enviar} onKeyDown={teclas}>
      <span className="lb-label">Quem pesca</span>
      {players.length === 0 ? (
        <span className="lb-label" id={dicaId}>
          Ninguém jogando agora.
        </span>
      ) : (
        <ul className="lb-pesca-vivo__lista">
          {players.map((p) => (
            <li key={p.playerId}>
              <label className="lb-gather__item">
                <input type="checkbox" className="lb-gather__check" checked={!desmarcados.has(p.playerId)} onChange={(event) => marcar(p.playerId, event.target.checked)} />
                <span className="lb-pesca-vivo__nome">{p.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {players.length > 0 && marcados.length === 0 && (
        <span className="lb-label" id={dicaId}>
          Marque ao menos um jogador.
        </span>
      )}
      <div className="lb-party__actions">
        <button type="button" className="lb-btn lb-btn--ghost" onClick={onCancelar}>
          Cancelar
        </button>
        <button ref={enviarRef} type="submit" className="lb-btn lb-btn--primary" disabled={marcados.length === 0} aria-describedby={marcados.length === 0 ? dicaId : undefined}>
          Enviar convite
        </button>
      </div>
    </form>
  )
}

const TEXTO_DA_FASE: Readonly<Record<PescaFase, string>> = {
  aberta: 'Pescando. Cada um joga no próprio aparelho.',
  pausa: 'Pausado para todos.',
  encerrada: 'Pesca encerrada.',
}

export function PescaAoVivoPainel({ pinId, entrada, players, pesca, onConvidar, onPausar, onRetomar, onEncerrar }: PescaAoVivoProps) {
  const headingId = useId()
  const chamarRef = useRef<HTMLButtonElement>(null)
  const [convidando, setConvidando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const desta = pesca !== null && pesca.pinId === pinId ? pesca : null
  const acontecendo = desta !== null && ativa(desta.fase)
  // Quem já está nesta pesca (no convite ou pescando) não aparece de novo na lista.
  const jaDentro = new Set(acontecendo ? desta.participantes.filter((p) => p.status === 'convidado' || p.status === 'pescando').map((p) => p.playerId) : [])
  const chamaveis = players.filter((p) => !jaDentro.has(p.playerId))

  const voltarAoChamar = () => {
    setConvidando(false)
    // O foco volta a quem abriu: o teclado não cai no começo da página.
    requestAnimationFrame(() => chamarRef.current?.focus())
  }

  const enviar = (playerIds: string[]) => {
    const recusa = textoDoConviteRecusado(onConvidar(playerIds))
    setAviso(recusa)
    if (recusa === null) voltarAoChamar()
  }

  const pedir = (feito: boolean) => setAviso(feito ? null : 'Não deu: a pesca já acabou ou a sala fechou.')

  return (
    <section className="lb-pesca-vivo" aria-labelledby={headingId}>
      <h3 id={headingId} className="lb-eyebrow">
        Pesca ao vivo
      </h3>
      {desta !== null && (
        <>
          <p className="lb-pesca-vivo__fase" role="status">
            {TEXTO_DA_FASE[desta.fase]}
          </p>
          {desta.participantes.length > 0 && (
            <ul className="lb-pesca-vivo__lista lb-pesca-vivo__placar" aria-label="Quem pesca">
              {desta.participantes.map((p) => (
                <Linha key={p.playerId} p={p} pesca={desta} />
              ))}
            </ul>
          )}
        </>
      )}
      {entrada === 'mestre' ? (
        <>
          <button
            ref={chamarRef}
            type="button"
            className="lb-btn lb-btn--block"
            aria-expanded={convidando}
            onClick={() => {
              setAviso(null)
              if (convidando) voltarAoChamar()
              else setConvidando(true)
            }}
          >
            {CHAMAR_PARA_PESCAR}
          </button>
          {convidando && <Convite players={chamaveis} onEnviar={enviar} onCancelar={voltarAoChamar} />}
        </>
      ) : (
        <span className="lb-label">Os jogadores começam tocando no pino. Daqui você acompanha, pausa e encerra.</span>
      )}
      {acontecendo && (
        <div className="lb-party__actions lb-pesca-vivo__acoes">
          <button type="button" className="lb-btn" onClick={() => pedir(desta.fase === 'pausa' ? onRetomar() : onPausar())}>
            {desta.fase === 'pausa' ? 'Continuar para todos' : 'Pausar para todos'}
          </button>
          <button type="button" className="lb-btn" onClick={() => pedir(onEncerrar())}>
            Encerrar para todos
          </button>
        </div>
      )}
      {aviso !== null && (
        <p className="lb-pesca-vivo__aviso" role="alert">
          {aviso}
        </p>
      )}
    </section>
  )
}
