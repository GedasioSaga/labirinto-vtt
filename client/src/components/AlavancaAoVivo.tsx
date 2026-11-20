import { useEffect, useState } from 'react'
import { DIF, estimar } from '../minigames/alavanca/sim'
import { ALAVANCA_JOGADORES_MAX, NOME_DA_DIFICULDADE_ALAVANCA, type DificuldadeAlavanca } from '../minigames/alavanca/tipos'
import type { AlavancaAoVivo, AlavancaConviteResultado, AlavancaParticipanteNoMestre, AlavancaVivoNoMestre } from '../net/alavancaNoHost'
import type { AlavancaStatus } from '../net/protocoloDaAlavanca'
// As classes são as do fogo: o painel da alavanca tem a mesma cara.
import './FogoAoVivo.css'
import './AlavancaAoVivo.css'

/**
 * A ALAVANCA DA PONTE AO VIVO, no painel do desafio (irmão do
 * `BolhaAoVivo.tsx`): antes do convite, quem gira (até 4); com o convite
 * aberto, quem está pronto e o "Começar com os prontos"; na rodada, a
 * "Rodada ao vivo" do protótipo (situação, tempo, ponte, corrente e giros),
 * "Pausar para todos" e "Encerrar". No fim, a última rodada.
 *
 * Quem decide é a sessão (`net/alavancaNoHost.ts`): este painel só lê e pede.
 * A rodada ao vivo é lida a cada 100 ms pela ponte (`lerVivo`), fora do
 * estado do App: 20 mudanças por segundo não redesenham a tela do mestre.
 */

export interface JogadorDaAlavanca {
  playerId: string
  name: string
}

export interface AlavancaAoVivoProps {
  pinId: string
  /** Quem pode ser chamado agora: jogando e com a página aberta. */
  players: readonly JogadorDaAlavanca[]
  /** A alavanca da sala (a ativa ou a última); `null` = nenhuma. */
  alavanca: AlavancaAoVivo | null
  lerVivo(): AlavancaVivoNoMestre | null
  onConvidar(playerIds: string[]): AlavancaConviteResultado | null
  onComecar(): boolean
  onPausar(): boolean
  onRetomar(): boolean
  onEncerrar(): boolean
}

export const CHAMAR_PARA_A_ALAVANCA = 'Chamar para a alavanca'

const NOME_DO_STATUS: Record<AlavancaStatus, string> = {
  convidado: 'Convidado',
  pronto: 'Pronto',
  girando: 'Girando',
  saiu: 'Saiu',
  fora: 'Ficou de fora',
}

const MOTIVO_DA_RECUSA: Record<Extract<AlavancaConviteResultado, { ok: false }>['motivo'], string> = {
  pino: 'Este desafio não é mais da Alavanca da ponte.',
  ocupada: 'Já há uma alavanca em andamento: encerre a outra antes.',
  ninguem: 'Ninguém escolhido está na mesa online agora.',
}

const virg = (v: number, c = 1): string => v.toFixed(c).replace('.', ',')
const VIVO_A_CADA_MS = 100
/** A espera do protótipo antes de estimar: mexer no controle não trava a cada passo. */
const ESPERA_DA_CHANCE_MS = 60
/** Partidas do robô que joga como gente por estimativa (as do protótipo). */
const PARTIDAS_DA_CHANCE = 200

const chances = new Map<string, number>()

/**
 * "Chance de vitória estimada", como no protótipo: o robô que joga como
 * gente, 200 partidas, com a dificuldade, quantos giram e o tempo. A conta
 * é guardada por combinação: voltar a uma escolha não refaz.
 */
export function ChanceDaAlavanca({ dificuldade, jogadores, tempo }: { dificuldade: DificuldadeAlavanca; jogadores: number; tempo: number | null }) {
  const chave = `${dificuldade}|${jogadores}|${tempo ?? ''}`
  const [chance, setChance] = useState<number | null>(chances.get(chave) ?? null)
  useEffect(() => {
    const pronta = chances.get(chave)
    if (pronta !== undefined) {
      setChance(pronta)
      return
    }
    setChance(null)
    const timer = setTimeout(() => {
      const v = estimar({ dif: dificuldade, jogadores, tempo }, PARTIDAS_DA_CHANCE, 'mestre')
      chances.set(chave, v)
      setChance(v)
    }, ESPERA_DA_CHANCE_MS)
    return () => clearTimeout(timer)
  }, [chave, dificuldade, jogadores, tempo])
  return (
    <div className="lb-fogo-vivo__placar" aria-live="polite">
      <span className="lb-label">Chance de vitória estimada</span>
      <b className="lb-alavanca-chance">{chance === null ? '…' : `${Math.round(chance * 100)}%`}</b>
      <span className="lb-label">
        {NOME_DA_DIFICULDADE_ALAVANCA[dificuldade]}, {jogadores} {jogadores > 1 ? 'jogadores' : 'jogador'}, {tempo ?? DIF[dificuldade].tempo} s · robô que joga como gente,{' '}
        {PARTIDAS_DA_CHANCE} partidas
      </span>
    </div>
  )
}

/** Antes do convite: quem gira (até 4). */
function Chamar({ players, onConvidar }: Pick<AlavancaAoVivoProps, 'players' | 'onConvidar'>) {
  const [escolhidos, setEscolhidos] = useState<ReadonlySet<string>>(new Set())
  const [aviso, setAviso] = useState<string | null>(null)
  const cheio = escolhidos.size >= ALAVANCA_JOGADORES_MAX
  const alternar = (playerId: string) => {
    const novo = new Set(escolhidos)
    if (novo.has(playerId)) novo.delete(playerId)
    else novo.add(playerId)
    setEscolhidos(novo)
  }
  const chamar = () => {
    // Só quem ainda está na lista: quem saiu da sala desde a marcação não vai.
    const playerIds = players.filter((p) => escolhidos.has(p.playerId)).map((p) => p.playerId)
    const resultado = onConvidar(playerIds)
    if (resultado === null) setAviso('A mesa online fechou: abra a mesa online para chamar.')
    else if (!resultado.ok) setAviso(MOTIVO_DA_RECUSA[resultado.motivo])
    else setAviso(null)
  }
  if (players.length === 0) return <span className="lb-label">Ninguém jogando na mesa online agora.</span>
  return (
    <div className="lb-fogo-vivo__chamar">
      <ul className="lb-fogo-vivo__lista" aria-label="Quem gira">
        {players.map((p) => {
          const marcado = escolhidos.has(p.playerId)
          return (
            <li key={p.playerId} className="lb-fogo-vivo__pessoa">
              <label className="lb-gather__item">
                <input type="checkbox" className="lb-gather__check" checked={marcado} disabled={!marcado && cheio} onChange={() => alternar(p.playerId)} />
                <span className="lb-fogo-vivo__nome">{p.name}</span>
              </label>
            </li>
          )
        })}
      </ul>
      <span className="lb-label">Cada um aperta X (ou o botão Girar) no próprio computador. Em equipe, cada aperto vale menos, mas a ponte desce mais rápido.</span>
      {cheio && <span className="lb-label">Na mesma alavanca giram até {ALAVANCA_JOGADORES_MAX}.</span>}
      <button type="button" className="lb-btn lb-btn--primary lb-btn--block" disabled={escolhidos.size === 0} onClick={chamar}>
        {CHAMAR_PARA_A_ALAVANCA}
      </button>
      {aviso !== null && (
        <p className="lb-minigame__aviso" role="alert">
          {aviso}
        </p>
      )}
    </div>
  )
}

function Linha({ p }: { p: AlavancaParticipanteNoMestre }) {
  return (
    <li className="lb-fogo-vivo__pessoa">
      <span className="lb-fogo-vivo__nome">
        {p.nome}
        {!p.conectado && <span className="lb-label"> (fora do ar)</span>}
      </span>
      <span className="lb-fogo-vivo__status">{NOME_DO_STATUS[p.status]}</span>
    </li>
  )
}

/** "Rodada ao vivo" do protótipo: lida da ponte a cada 100 ms, só enquanto a rodada corre. */
function RodadaAoVivo({ alavanca, lerVivo }: { alavanca: AlavancaAoVivo; lerVivo: AlavancaAoVivoProps['lerVivo'] }) {
  const [vivo, setVivo] = useState<AlavancaVivoNoMestre | null>(() => lerVivo())
  const correndo = alavanca.fase === 'contagem' || alavanca.fase === 'rodada'
  useEffect(() => {
    setVivo(lerVivo())
    if (!correndo) return
    const timer = setInterval(() => setVivo(lerVivo()), VIVO_A_CADA_MS)
    return () => clearInterval(timer)
  }, [correndo, lerVivo])
  const nomes = alavanca.ordem.map((id) => alavanca.participantes.find((p) => p.playerId === id)?.nome ?? id)
  const situacao =
    alavanca.fase === 'pausa'
      ? `Pausada por ${alavanca.pausaPor === 'mestre' ? 'você' : (alavanca.pausaPor ?? 'alguém')}`
      : alavanca.fase === 'contagem'
        ? 'Contagem'
        : alavanca.fase === 'rodada'
          ? 'Girando'
          : alavanca.resultado?.tipo === 'baixou'
            ? 'Venceram: a ponte desceu'
            : alavanca.resultado?.tipo === 'subiu'
              ? 'Perderam: a corrente venceu'
              : 'Encerrada'
  return (
    <dl className="lb-fogo-vivo__placar lb-alavanca-vivo">
      <dt className="lb-label">Situação</dt>
      <dd>{situacao}</dd>
      <dt className="lb-label">Tempo</dt>
      <dd>{vivo === null ? '–' : `${virg(vivo.t)} s de ${vivo.tempo} s`}</dd>
      <dt className="lb-label">Ponte</dt>
      <dd>{vivo === null ? '–' : `${Math.round(vivo.p * 100)}% baixada`}</dd>
      <dt className="lb-label">Corrente</dt>
      <dd>{vivo === null || alavanca.fase !== 'rodada' ? 'parada' : vivo.solta > 0 ? 'catraca solta' : `${Math.round(vivo.tensao * 100)}% da força`}</dd>
      <dt className="lb-label">Giros</dt>
      <dd>{vivo === null ? '–' : vivo.giros.map((g, j) => `${nomes[j] ?? ''} ${g}`).join(' · ')}</dd>
    </dl>
  )
}

export function AlavancaAoVivoPainel({ pinId, players, alavanca, lerVivo, onConvidar, onComecar, onPausar, onRetomar, onEncerrar }: AlavancaAoVivoProps) {
  const desta = alavanca !== null && alavanca.pinId === pinId ? alavanca : null
  const ativaNaFase = (fase: AlavancaAoVivo['fase']) => fase === 'convite' || fase === 'contagem' || fase === 'rodada' || fase === 'pausa'
  // Outro desafio com alavanca aberta: este não chama até aquela acabar.
  const outraAtiva = alavanca !== null && alavanca.pinId !== pinId && ativaNaFase(alavanca.fase)
  const ativa = desta !== null && ativaNaFase(desta.fase)
  return (
    <section className="lb-fogo-vivo" aria-label="Alavanca da ponte ao vivo">
      {ativa ? (
        <>
          <span className="lb-fogo-vivo__fase">
            {desta.fase === 'convite' ? (desta.sozinho ? 'Começando sozinho no selo' : 'Convite aberto') : 'Rodada'}
            {' · '}
            {NOME_DA_DIFICULDADE_ALAVANCA[desta.dificuldade]} · {desta.tempo} s{desta.abrePorta ? ' · abre a porta ligada' : ''}
          </span>
          <ul className="lb-fogo-vivo__lista">
            {desta.participantes.map((p) => (
              <Linha key={p.playerId} p={p} />
            ))}
          </ul>
          {desta.fase === 'convite' && !desta.sozinho && (
            <>
              <button type="button" className="lb-btn lb-btn--primary lb-btn--block" disabled={!desta.participantes.some((p) => p.status === 'pronto' && p.conectado)} onClick={onComecar}>
                Começar com os prontos
              </button>
              <span className="lb-label">Começa sozinho quando todos estiverem prontos; quem não estiver fica de fora.</span>
            </>
          )}
          {desta.fase !== 'convite' && <RodadaAoVivo alavanca={desta} lerVivo={lerVivo} />}
          <div className="lb-party__actions">
            {(desta.fase === 'rodada' || desta.fase === 'contagem') && (
              <button type="button" className="lb-btn" onClick={onPausar}>
                Pausar para todos
              </button>
            )}
            {desta.fase === 'pausa' && (
              <button type="button" className="lb-btn" onClick={onRetomar}>
                Continuar para todos
              </button>
            )}
            <button type="button" className="lb-btn lb-btn--ghost" onClick={onEncerrar}>
              Encerrar
            </button>
          </div>
          <span className="lb-label">Mudanças no desafio valem a partir da próxima rodada.</span>
        </>
      ) : (
        <>
          {desta !== null && desta.resultado !== undefined && (
            <div className="lb-fogo-vivo__placar">
              <span className="lb-eyebrow">Última rodada</span>
              <RodadaAoVivo alavanca={desta} lerVivo={lerVivo} />
              {desta.resultado.portaAberta && <span className="lb-fogo-vivo__fase">A porta ligada abriu.</span>}
            </div>
          )}
          {outraAtiva ? <span className="lb-label">Há uma alavanca aberta em outro desafio: encerre aquela antes.</span> : <Chamar players={players} onConvidar={onConvidar} />}
        </>
      )}
    </section>
  )
}
