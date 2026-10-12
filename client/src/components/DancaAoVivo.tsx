import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { DificuldadeDanca } from '../minigames/danca/tipos'
import type { DancaAoVivo, DancaConviteResultado, DancaParticipanteNoMestre } from '../net/dancaNoHost'
import './DancaAoVivo.css'

/**
 * A DANÇA AO VIVO, no painel do pino de minigame (molde do `SecretCheckSection`
 * e do "Reunir o grupo aqui"): "Chamar para dançar" abre a lista de quem está
 * jogando, todos marcados; "Enviar convite" chama só os marcados. Depois, uma
 * linha por jogador com o status, a precisão, o combo e (no Expert) a vida,
 * ao vivo pela ponte (`onDancaChange`); "Começar", "Pausar/Retomar para
 * todos" e "Encerrar para todos". No fim, o desfecho e "Fechar".
 *
 * Quem decide é a sessão (`net/dancaNoHost.ts`): este painel só lê a dança e
 * pede. Os avisos do desfecho também saem da ponte (`linhasDoDesfechoDaDanca`).
 */

export interface JogadorDaDanca {
  playerId: string
  name: string
}

export interface DancaAoVivoProps {
  pinId: string
  /** Quem pode ser chamado agora: jogando e com a página aberta. */
  players: readonly JogadorDaDanca[]
  /** A dança de agora (ou a última) na sala; `null` = nenhuma. */
  danca: DancaAoVivo | null
  onConvidar(playerIds: string[]): DancaConviteResultado | null
  onComecar(): boolean
  onPausar(): boolean
  onRetomar(): boolean
  onEncerrar(): boolean
}

export const CHAMAR_PARA_DANCAR = 'Chamar para dançar'

/** O aviso quando o convite não saiu (o que saiu aparece na lista ao vivo). */
export function textoDoConviteRecusado(resultado: DancaConviteResultado | null): string | null {
  if (resultado === null) return 'Não deu: a sala não está aberta.'
  if (resultado.ok) return null
  if (resultado.motivo === 'pino') return 'Este pino não está mais no mapa.'
  if (resultado.motivo === 'ocupada') return 'Já há uma dança acontecendo. Encerre aquela antes.'
  return 'Ninguém marcado está jogando agora.'
}

const NOME_DA_DIFICULDADE: Record<DificuldadeDanca, string> = { diversao: 'Diversão', expert: 'Expert' }

const ativa = (danca: DancaAoVivo): boolean => danca.fase === 'convite' || danca.fase === 'musica' || danca.fase === 'pausa'

function porcento(fracao: number): string {
  return `${(fracao * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

/** O status de cada um, na palavra que o mestre lê. */
export function textoDoStatus(p: DancaParticipanteNoMestre, fase: DancaAoVivo['fase']): string {
  const foraDoAr = p.conectado ? '' : ' · fora do ar'
  switch (p.status) {
    case 'convidado':
      return `Convidado${foraDoAr}`
    case 'pronto':
      return `Pronto${p.dificuldade === undefined ? '' : ` · ${NOME_DA_DIFICULDADE[p.dificuldade]}`}${foraDoAr}`
    case 'dancando':
      return fase === 'pausa' ? 'Pausado' : 'Dançando'
    case 'terminou':
      if (p.final === undefined) return 'Terminou'
      return p.final.falhou ? 'Falhou' : `Terminou · ${p.final.letra}`
    case 'saiu':
      return 'Saiu'
    case 'fora':
      return 'Ficou de fora'
  }
}

/**
 * O que o jogador levou do desfecho: o prêmio (todos passaram) ou a
 * consequência (ele não passou). Lidos da DANÇA, congelados no convite: o pino
 * pode ter sido editado no meio, e o painel tem de dizer o que foi aplicado.
 */
function textoDoQueLevou(p: DancaParticipanteNoMestre, todosPassaram: boolean, danca: DancaAoVivo): string | null {
  const { premio, consequencia } = danca
  if (todosPassaram) {
    if (premio.tipo === 'item') return `Recebeu: ${premio.texto}`
    if (premio.tipo === 'pista') return `Pista no caderno: ${premio.texto}`
    if (premio.tipo === 'bonus') return `Bônus: ${premio.texto}`
    return null
  }
  if (p.passou === true) return null
  if (consequencia.tipo === 'teste') return `Penalidade: ${consequencia.texto}`
  if (consequencia.tipo === 'barulho') return 'Barulho: narre o que ele chamou'
  if (consequencia.tipo === 'espera') return 'Só tenta de novo na próxima rodada'
  return null
}

function Pessoa({ p, fase }: { p: DancaParticipanteNoMestre; fase: DancaAoVivo['fase'] }) {
  const placar = p.final ?? p.placar
  const vida = p.final === undefined && p.dificuldade === 'expert' && p.placar !== undefined ? Math.round(p.placar.vida) : null
  return (
    <li className="lb-danca__pessoa">
      <span className="lb-danca__nome">{p.nome}</span>
      <span className="lb-danca__status" data-status={p.status}>
        {textoDoStatus(p, fase)}
      </span>
      {placar !== undefined && (
        <span className="lb-danca__nums">
          Precisão <b>{porcento(placar.precisao)}</b>
          {p.placar !== undefined && p.final === undefined && (
            <>
              {' '}
              · Combo <b>{p.placar.combo}</b>
            </>
          )}
          {p.final !== undefined && (
            <>
              {' '}
              · Combo máx. <b>{p.final.comboMax}</b>
            </>
          )}
        </span>
      )}
      {vida !== null && (
        <span className="lb-danca__vida" role="meter" aria-label={`Vida de ${p.nome}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={vida}>
          <i style={{ transform: `scaleX(${Math.max(0, Math.min(100, vida)) / 100})` }} />
        </span>
      )}
    </li>
  )
}

interface ConviteProps {
  players: readonly JogadorDaDanca[]
  onEnviar(playerIds: string[]): void
  onCancelar(): void
}

/**
 * A lista de quem dança, aberta por "Chamar para dançar". Guarda só quem o
 * mestre DESMARCOU: quem entra na sala com a lista aberta já vem marcado.
 */
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
    <form className="lb-party__send lb-danca__convite" aria-label="Quem dança" onSubmit={enviar} onKeyDown={teclas}>
      <span className="lb-label">Quem dança</span>
      {players.length === 0 ? (
        <span className="lb-label" id={dicaId}>
          Ninguém jogando agora.
        </span>
      ) : (
        <ul className="lb-danca__lista">
          {players.map((p) => (
            <li key={p.playerId}>
              <label className="lb-gather__item">
                <input type="checkbox" className="lb-gather__check" checked={!desmarcados.has(p.playerId)} onChange={(event) => marcar(p.playerId, event.target.checked)} />
                <span className="lb-danca__nome">{p.name}</span>
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

interface AcompanharProps {
  danca: DancaAoVivo
  onComecar(): boolean
  onPausar(): boolean
  onRetomar(): boolean
  onEncerrar(): boolean
}

/** A dança em andamento: uma linha por jogador e os comandos de cada fase. */
function Acompanhar({ danca, onComecar, onPausar, onRetomar, onEncerrar }: AcompanharProps) {
  const baseId = useId()
  const comecarRef = useRef<HTMLButtonElement>(null)
  const naMusica = danca.fase === 'musica' || danca.fase === 'pausa'
  const podeComecar = danca.participantes.some((p) => p.status === 'pronto' && p.conectado)
  const dicaId = `${baseId}-dica`

  // O foco vai para o "Começar" quando o convite sai: a lista de onde ele veio sumiu.
  useEffect(() => {
    if (danca.fase === 'convite') comecarRef.current?.focus()
  }, [danca.sessao, danca.fase])

  return (
    <>
      <p className="lb-danca__fase" role="status">
        {danca.fase === 'convite' ? 'Convite enviado. Cada um escolhe a dificuldade e marca Pronto.' : danca.fase === 'pausa' ? 'Pausado para todos.' : 'Dançando.'}
      </p>
      <ul className="lb-danca__lista lb-danca__placar" aria-label="Quem dança">
        {danca.participantes.map((p) => (
          <Pessoa key={p.playerId} p={p} fase={danca.fase} />
        ))}
      </ul>
      <div className="lb-party__actions lb-danca__acoes">
        {danca.fase === 'convite' ? (
          <button
            ref={comecarRef}
            type="button"
            className="lb-btn lb-btn--primary"
            disabled={!podeComecar}
            aria-describedby={podeComecar ? undefined : dicaId}
            onClick={() => onComecar()}
          >
            Começar
          </button>
        ) : (
          <button type="button" className="lb-btn" disabled={!naMusica} onClick={() => (danca.fase === 'pausa' ? onRetomar() : onPausar())}>
            {danca.fase === 'pausa' ? 'Retomar para todos' : 'Pausar para todos'}
          </button>
        )}
        <button type="button" className="lb-btn" onClick={() => onEncerrar()}>
          Encerrar para todos
        </button>
      </div>
      {danca.fase === 'convite' && !podeComecar && (
        <span className="lb-label" id={dicaId}>
          Começa quando alguém marcar Pronto.
        </span>
      )}
    </>
  )
}

interface DesfechoProps {
  danca: DancaAoVivo
  onFechar(): void
}

/** O fim: quem passou, se a porta abriu e o que cada um levou. Encerrada antes, nada foi ganho nem perdido. */
function Desfecho({ danca, onFechar }: DesfechoProps) {
  const desfecho = danca.desfecho
  const dancaram = danca.participantes.filter((p) => p.status === 'terminou' || p.status === 'saiu' || p.status === 'dancando')
  const deFora = danca.participantes.filter((p) => p.status === 'fora' || p.status === 'convidado' || p.status === 'pronto')
  return (
    <>
      {danca.fase === 'encerrada' || desfecho === undefined ? (
        <p className="lb-danca__fase" role="status">
          Dança encerrada: nada foi ganho nem perdido.
        </p>
      ) : (
        <div className="lb-danca__desfecho" role="status">
          <p className="lb-danca__manchete" data-passaram={desfecho.todosPassaram}>
            {desfecho.todosPassaram ? 'Todos passaram' : 'Nem todos passaram'}
          </p>
          {danca.temPorta && <p className="lb-danca__porta">{desfecho.portaAberta ? 'A porta abriu.' : 'A porta continua fechada.'}</p>}
          <ul className="lb-danca__lista">
            {dancaram.map((p) => {
              const levou = textoDoQueLevou(p, desfecho.todosPassaram, danca)
              return (
                <li key={p.playerId} className="lb-danca__pessoa">
                  <span className="lb-danca__nome">{p.nome}</span>
                  <span className="lb-danca__status" data-passou={p.passou === true}>
                    {p.passou === true ? 'Passou' : 'Não passou'}
                  </span>
                  <span className="lb-danca__nums">
                    {p.final === undefined ? 'Saiu no meio' : p.final.falhou ? 'Falhou' : `Nota ${p.final.letra}`}
                    {p.final !== undefined && (
                      <>
                        {' '}
                        · <b>{porcento(p.final.precisao)}</b>
                      </>
                    )}
                  </span>
                  {levou !== null && <span className="lb-danca__levou">{levou}</span>}
                </li>
              )
            })}
          </ul>
          {deFora.length > 0 && <p className="lb-label">Ficaram de fora: {deFora.map((p) => p.nome).join(', ')}.</p>}
        </div>
      )}
      <button type="button" className="lb-btn lb-btn--block" onClick={onFechar}>
        Fechar
      </button>
    </>
  )
}

export function DancaAoVivoPainel({ pinId, players, danca, onConvidar, onComecar, onPausar, onRetomar, onEncerrar }: DancaAoVivoProps) {
  const headingId = useId()
  const chamarRef = useRef<HTMLButtonElement>(null)
  const [convidando, setConvidando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  /** A dança terminada que o mestre já fechou: o resultado não volta a ocupar o painel. */
  const [fechada, setFechada] = useState<string | null>(null)
  const desta = danca !== null && danca.pinId === pinId ? danca : null
  const outraAtiva = danca !== null && danca.pinId !== pinId && ativa(danca)
  const acontecendo = desta !== null && ativa(desta)
  const acabou = desta !== null && !ativa(desta) && desta.sessao !== fechada

  const voltarAoChamar = () => {
    setConvidando(false)
    // O foco volta a quem abriu: o teclado não cai no começo da página.
    requestAnimationFrame(() => chamarRef.current?.focus())
  }

  const enviar = (playerIds: string[]) => {
    const recusa = textoDoConviteRecusado(onConvidar(playerIds))
    setAviso(recusa)
    if (recusa === null) setConvidando(false)
  }

  return (
    <section className="lb-danca" aria-labelledby={headingId}>
      <h3 id={headingId} className="lb-eyebrow">
        Dança ao vivo
      </h3>
      {acontecendo ? (
        <Acompanhar danca={desta} onComecar={onComecar} onPausar={onPausar} onRetomar={onRetomar} onEncerrar={onEncerrar} />
      ) : acabou ? (
        <Desfecho
          danca={desta}
          onFechar={() => {
            setFechada(desta.sessao)
            setAviso(null)
            requestAnimationFrame(() => chamarRef.current?.focus())
          }}
        />
      ) : (
        <>
          <button
            ref={chamarRef}
            type="button"
            className="lb-btn lb-btn--block"
            aria-expanded={convidando}
            disabled={outraAtiva}
            aria-describedby={outraAtiva ? `${headingId}-outra` : undefined}
            onClick={() => {
              setAviso(null)
              if (convidando) voltarAoChamar()
              else setConvidando(true)
            }}
          >
            {CHAMAR_PARA_DANCAR}
          </button>
          {outraAtiva && (
            <span className="lb-label" id={`${headingId}-outra`}>
              Já há uma dança acontecendo em outro pino.
            </span>
          )}
          {convidando && !outraAtiva && <Convite players={players} onEnviar={enviar} onCancelar={voltarAoChamar} />}
        </>
      )}
      {aviso !== null && (
        <p className="lb-danca__aviso" role="alert">
          {aviso}
        </p>
      )}
    </section>
  )
}
