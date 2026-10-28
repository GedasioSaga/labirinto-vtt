import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { BALAS, DIF } from '../minigames/tiro/sim'
import { fmtT, NOME_DIF, NOMES_MED, pctTxt } from '../minigames/tiro/tela/textos'
import type { EntradaTiro } from '../minigames/tiro/tipos'
import type { TiroAoVivo, TiroConviteResultado, TiroFase, TiroParticipanteNoMestre } from '../net/tiroNoHost'
import './TiroAoVivo.css'

/**
 * O TIRO AO VIVO, no painel do pino de minigame (molde do `PescaAoVivo`): o
 * placar do protótipo, uma linha por jogador com o que ele está fazendo, os
 * pontos, a precisão, as balas, o tempo que falta e a dificuldade, ao vivo
 * pela ponte (`onTiroChange`). Embaixo, "Chamar para a barraca" (só no modo
 * "Mestre chama"), "Pausar/Continuar para todos" e "Encerrar para todos",
 * que vira "Reabrir para todos" com a barraca encerrada.
 *
 * Quem decide é a sessão (`net/tiroNoHost.ts`), que conta as tentativas:
 * este painel só lê e pede. Cada aparelho atira na própria rodada.
 */

export interface JogadorDoTiro {
  playerId: string
  name: string
}

export interface TiroAoVivoProps {
  pinId: string
  /** Como a barraca deste pino começa agora (o que está gravado no pino). */
  entrada: EntradaTiro
  /** Quem pode ser chamado agora: jogando e com a página aberta. */
  players: readonly JogadorDoTiro[]
  /** A barraca deste pino (aberta, pausada ou a última encerrada); `null` = nenhuma. */
  tiro: TiroAoVivo | null
  onConvidar(playerIds: string[]): TiroConviteResultado | null
  onPausar(): boolean
  onRetomar(): boolean
  onEncerrar(): boolean
  onReabrir(): boolean
}

export const CHAMAR_PARA_A_BARRACA = 'Chamar para a barraca'

export function textoDoConviteRecusado(resultado: TiroConviteResultado | null): string | null {
  if (resultado === null) return 'Não deu: a sala não está aberta.'
  if (resultado.ok) return null
  if (resultado.motivo === 'pino') return 'Este pino não está mais no mapa, ou não é mais de tiro.'
  return 'Ninguém marcado está jogando agora.'
}

const ativa = (fase: TiroFase): boolean => fase === 'aberta' || fase === 'pausa'

/** O que cada um está fazendo, nas palavras do protótipo ("atirando", "recarregando", "terminou: Prata"). */
export function estadoNoPlacar(p: TiroParticipanteNoMestre, fase: TiroFase): string {
  const foraDoAr = p.conectado ? '' : ' · fora do ar'
  if (p.status === 'saiu') return 'saiu'
  if (p.status === 'terminou' || (p.status === 'convidado' && p.rodadas.length > 0)) {
    const ultima = p.rodadas.at(-1)
    if (ultima === undefined) return `terminou${foraDoAr}`
    if (ultima.desfecho === 'encerrado') return 'encerrado'
    if (ultima.desfecho === 'desistiu') return `desistiu${foraDoAr}`
    return `terminou: ${ultima.medalha === null ? 'sem medalha' : NOMES_MED[ultima.medalha]}${foraDoAr}`
  }
  if (p.status === 'convidado') return `no convite${foraDoAr}`
  if (fase === 'encerrada') return 'encerrado'
  if (fase === 'pausa') return 'pausado pelo mestre'
  if (p.vivo === undefined) return `contagem${foraDoAr}`
  return `${p.vivo.recarregando ? 'recarregando' : 'atirando'}${foraDoAr}`
}

function Linha({ p, tiro }: { p: TiroParticipanteNoMestre; tiro: TiroAoVivo }) {
  const vivo = p.status === 'atirando' ? p.vivo : undefined
  const dificuldade = p.dificuldade === undefined ? null : DIF[p.dificuldade]
  const resta = vivo !== undefined && dificuldade !== null ? Math.min(1, Math.max(0, 1 - vivo.t / dificuldade.tempo)) : 0
  const melhor = p.melhor
  return (
    <li className="lb-tiro-vivo__pessoa">
      <span className="lb-tiro-vivo__nome">{p.nome}</span>
      <span className="lb-tiro-vivo__status" data-status={p.status}>
        {estadoNoPlacar(p, tiro.fase)}
      </span>
      <span className="lb-tiro-vivo__nums">
        {vivo !== undefined && dificuldade !== null ? (
          <>
            <span>
              Pontos <b>{vivo.pontos}</b>
            </span>
            <span>
              Precisão <b>{pctTxt(vivo.acertos, vivo.tiros)}</b>
            </span>
            <span>
              Balas <b>{vivo.recarregando ? 'girando' : `${vivo.balas}/${BALAS}`}</b>
            </span>
            <span>
              Tempo <b>{fmtT(dificuldade.tempo - vivo.t)}</b>
            </span>
          </>
        ) : (
          <span>{p.rodadas.length === 0 ? 'Ainda não atirou.' : `Melhor: ${melhor === undefined ? '—' : `${melhor.medalha === null ? 'sem medalha' : NOMES_MED[melhor.medalha]}, ${melhor.pontos} pontos`}`}</span>
        )}
        <span>
          Tentativas <b>{`${p.usadas} de ${tiro.tentativas}`}</b>
        </span>
        <span>{p.dificuldade === undefined ? 'Sem dificuldade ainda' : NOME_DIF[p.dificuldade]}</span>
      </span>
      <span className="lb-tiro-vivo__medidor" role="meter" aria-label={`Tempo que falta para ${p.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(resta * 100)}>
        <i style={{ transform: `scaleX(${resta.toFixed(3)})` }} />
      </span>
    </li>
  )
}

interface ConviteProps {
  players: readonly JogadorDoTiro[]
  onEnviar(playerIds: string[]): void
  onCancelar(): void
}

/** A lista de quem atira, aberta por "Chamar para a barraca". Guarda só quem o mestre desmarcou. */
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
    <form className="lb-party__send" aria-label="Quem atira" onSubmit={enviar} onKeyDown={teclas}>
      <span className="lb-label">Quem atira</span>
      {players.length === 0 ? (
        <span className="lb-label" id={dicaId}>
          Ninguém jogando agora.
        </span>
      ) : (
        <ul className="lb-tiro-vivo__lista">
          {players.map((p) => (
            <li key={p.playerId}>
              <label className="lb-gather__item">
                <input type="checkbox" className="lb-gather__check" checked={!desmarcados.has(p.playerId)} onChange={(event) => marcar(p.playerId, event.target.checked)} />
                <span className="lb-tiro-vivo__nome">{p.name}</span>
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

const TEXTO_DA_FASE: Readonly<Record<TiroFase, string>> = {
  aberta: 'Barraca aberta. Cada um atira no próprio aparelho.',
  pausa: 'Pausado para todos.',
  encerrada: 'Barraca encerrada. "Reabrir para todos" devolve as tentativas.',
}

export function TiroAoVivoPainel({ pinId, entrada, players, tiro, onConvidar, onPausar, onRetomar, onEncerrar, onReabrir }: TiroAoVivoProps) {
  const headingId = useId()
  const chamarRef = useRef<HTMLButtonElement>(null)
  const [convidando, setConvidando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const desta = tiro !== null && tiro.pinId === pinId ? tiro : null
  const acontecendo = desta !== null && ativa(desta.fase)
  // Quem já está nesta barraca (no convite ou atirando) não aparece de novo na lista.
  const jaDentro = new Set(acontecendo ? desta.participantes.filter((p) => p.status === 'convidado' || p.status === 'atirando').map((p) => p.playerId) : [])
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

  const pedir = (feito: boolean) => setAviso(feito ? null : 'Não deu: a barraca já fechou ou a sala fechou.')

  return (
    <section className="lb-tiro-vivo" aria-labelledby={headingId}>
      <h3 id={headingId} className="lb-eyebrow">
        Placar ao vivo
      </h3>
      {desta !== null && (
        <>
          <p className="lb-tiro-vivo__fase" role="status">
            {TEXTO_DA_FASE[desta.fase]}
          </p>
          {desta.participantes.length > 0 && (
            <ul className="lb-tiro-vivo__lista lb-tiro-vivo__placar" aria-label="Quem atira">
              {desta.participantes.map((p) => (
                <Linha key={p.playerId} p={p} tiro={desta} />
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
            {CHAMAR_PARA_A_BARRACA}
          </button>
          {convidando && <Convite players={chamaveis} onEnviar={enviar} onCancelar={voltarAoChamar} />}
        </>
      ) : (
        <span className="lb-label">Os jogadores começam tocando no pino. Daqui você acompanha, pausa e encerra.</span>
      )}
      {acontecendo && (
        <div className="lb-party__actions lb-tiro-vivo__acoes">
          <button type="button" className="lb-btn" onClick={() => pedir(desta.fase === 'pausa' ? onRetomar() : onPausar())}>
            {desta.fase === 'pausa' ? 'Continuar para todos' : 'Pausar para todos'}
          </button>
          <button type="button" className="lb-btn" onClick={() => pedir(onEncerrar())}>
            Encerrar para todos
          </button>
        </div>
      )}
      {desta !== null && desta.fase === 'encerrada' && (
        <div className="lb-party__actions lb-tiro-vivo__acoes">
          <button type="button" className="lb-btn" onClick={() => pedir(onReabrir())}>
            Reabrir para todos
          </button>
        </div>
      )}
      {aviso !== null && (
        <p className="lb-tiro-vivo__aviso" role="alert">
          {aviso}
        </p>
      )}
    </section>
  )
}
