import { useState } from 'react'
import { DIFICULDADES_BOLHA, NOME_DA_DIFICULDADE_BOLHA, NOME_DO_CENARIO_BOLHA, type DificuldadeBolha, type MinigameBolha, type ModoBolha } from '../minigames/bolha/tipos'
import type { BolhaAoVivo, BolhaConviteResultado, BolhaParticipanteNoMestre } from '../net/bolhaNoHost'
import { BOLHA_EQUIPE_MAX, type BolhaResultado, type BolhaStatus } from '../net/protocoloDaBolha'
// As classes são as do fogo: o painel da bolha tem a mesma cara.
import './FogoAoVivo.css'

/**
 * A BOLHA D'ÁGUA AO VIVO, no painel do pino de minigame (irmão do
 * `FogoAoVivo.tsx`, sem ferramenta nem hash): antes do convite, quem joga e se
 * é em equipe ou cada um no seu; com o convite aberto, quem está pronto, a
 * dificuldade e o "Começar"; no jogo, "Pausar/Continuar" e "Encerrar para
 * todos". No fim, uma linha por jogador com os pontos dele: passou = apagou.
 *
 * Quem decide é a sessão (`net/bolhaNoHost.ts`): este painel só lê e pede.
 */

export interface JogadorDaBolha {
  playerId: string
  name: string
}

export interface BolhaAoVivoProps {
  pinId: string
  /** A dificuldade que o pino permite agora: 'escolha' = o mestre escolhe aqui. */
  permitida: MinigameBolha['permitida']
  /** Quem pode ser chamado agora: jogando e com a página aberta. */
  players: readonly JogadorDaBolha[]
  /** A bolha da sala (a ativa ou a última); `null` = nenhuma. */
  bolha: BolhaAoVivo | null
  onConvidar(playerIds: string[], modo: ModoBolha): BolhaConviteResultado | null
  onComecar(dificuldade: DificuldadeBolha): boolean
  onPausar(): boolean
  onRetomar(): boolean
  onEncerrar(): boolean
}

export const CHAMAR_PARA_A_BOLHA = 'Chamar para a bolha'

const NOME_DO_STATUS: Record<BolhaStatus, string> = {
  convidado: 'Convidado',
  pronto: 'Pronto',
  jogando: 'Jogando',
  terminou: 'Terminou',
  saiu: 'Saiu',
  fora: 'Ficou de fora',
}

const NOME_DO_RESULTADO: Record<BolhaResultado, string> = {
  venceu: 'Apagou',
  perdeu: 'Não apagou',
  saiu: 'Saiu',
}

const MOTIVO_DA_RECUSA: Record<Extract<BolhaConviteResultado, { ok: false }>['motivo'], string> = {
  pino: "Este pino não é mais da Bolha d'Água.",
  ocupada: 'Já há uma partida da bolha em andamento: encerre a outra antes.',
  ninguem: 'Ninguém escolhido está na sala agora.',
}

/** Escolha única em pastilhas: o mesmo `.lb-seg` do painel do minigame. */
function Pastilhas<T extends string>({ rotulo, opcoes, valor, onChange }: { rotulo: string; opcoes: readonly { valor: T; rotulo: string }[]; valor: T; onChange(valor: T): void }) {
  return (
    <div className="lb-seg lb-minigame__seg" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((opcao) => (
        <button key={opcao.valor} type="button" role="radio" aria-checked={valor === opcao.valor} className="lb-seg__option" onClick={() => onChange(opcao.valor)}>
          {opcao.rotulo}
        </button>
      ))}
    </div>
  )
}

const MODOS: readonly { valor: ModoBolha; rotulo: string }[] = [
  { valor: 'equipe', rotulo: 'Equipe (a mesma partida)' },
  { valor: 'solo', rotulo: 'Solo (cada um no seu)' },
]

const DICA_DO_MODO: Record<ModoBolha, string> = {
  equipe: 'Em equipe todos começam o mesmo fogo, cada um na sua tela; no fim a mesa mostra os pontos de cada um.',
  solo: 'Solo: cada um apaga o seu fogo, e o resultado é de cada um.',
}

const DIFICULDADES = DIFICULDADES_BOLHA.map((d) => ({ valor: d, rotulo: NOME_DA_DIFICULDADE_BOLHA[d] }))

/** Antes do convite: quem joga e o modo. */
function Chamar({ players, onConvidar }: Pick<BolhaAoVivoProps, 'players' | 'onConvidar'>) {
  const [modo, setModo] = useState<ModoBolha>('equipe')
  const [escolhidos, setEscolhidos] = useState<ReadonlySet<string>>(new Set())
  const [aviso, setAviso] = useState<string | null>(null)
  const cheio = modo === 'equipe' && escolhidos.size >= BOLHA_EQUIPE_MAX
  const alternar = (playerId: string) => {
    const novo = new Set(escolhidos)
    if (novo.has(playerId)) novo.delete(playerId)
    else novo.add(playerId)
    setEscolhidos(novo)
  }
  const chamar = () => {
    // Só quem ainda está na lista: quem saiu da sala desde a marcação não vai.
    const playerIds = players.filter((p) => escolhidos.has(p.playerId)).map((p) => p.playerId)
    const resultado = onConvidar(playerIds, modo)
    if (resultado === null) setAviso('A sala fechou: abra a sala para chamar.')
    else if (!resultado.ok) setAviso(MOTIVO_DA_RECUSA[resultado.motivo])
    else setAviso(null)
  }
  if (players.length === 0) return <span className="lb-label">Ninguém jogando na sala agora.</span>
  return (
    <div className="lb-fogo-vivo__chamar">
      <Pastilhas<ModoBolha> rotulo="Como jogam" opcoes={MODOS} valor={modo} onChange={setModo} />
      <ul className="lb-fogo-vivo__lista" aria-label="Quem joga">
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
      <span className="lb-label">{DICA_DO_MODO[modo]}</span>
      <span className="lb-label">Joga-se com o mouse: segurar carrega a bolha, soltar lança.</span>
      {cheio && <span className="lb-label">Na mesma partida cabem até {BOLHA_EQUIPE_MAX}.</span>}
      <button type="button" className="lb-btn lb-btn--primary lb-btn--block" disabled={escolhidos.size === 0} onClick={chamar}>
        {CHAMAR_PARA_A_BOLHA}
      </button>
      {aviso !== null && (
        <p className="lb-minigame__aviso" role="alert">
          {aviso}
        </p>
      )}
    </div>
  )
}

function Linha({ p }: { p: BolhaParticipanteNoMestre }) {
  const estrelas = p.estrelas ?? 0
  return (
    <li className="lb-fogo-vivo__pessoa">
      <span className="lb-fogo-vivo__nome">
        {p.nome}
        {!p.conectado && <span className="lb-label"> (fora do ar)</span>}
      </span>
      <span className="lb-fogo-vivo__status">
        {p.placarRecusado !== undefined
          ? `Placar recusado: não confere com a partida (${p.placarRecusado})`
          : p.resultado !== undefined
            ? `${NOME_DO_RESULTADO[p.resultado]} · ${p.pontos ?? 0} pontos${p.resultado === 'venceu' ? ` · ${estrelas} ${estrelas === 1 ? 'estrela' : 'estrelas'}` : ''}`
            : NOME_DO_STATUS[p.status]}
      </span>
    </li>
  )
}

export function BolhaAoVivoPainel({ pinId, permitida, players, bolha, onConvidar, onComecar, onPausar, onRetomar, onEncerrar }: BolhaAoVivoProps) {
  const [dificuldade, setDificuldade] = useState<DificuldadeBolha>('normal')
  const destaBolha = bolha !== null && bolha.pinId === pinId ? bolha : null
  // Outro pino com partida aberta: este não chama até aquela acabar.
  const outraAtiva = bolha !== null && bolha.pinId !== pinId && (bolha.fase === 'convite' || bolha.fase === 'jogo' || bolha.fase === 'pausa')
  const ativa = destaBolha !== null && (destaBolha.fase === 'convite' || destaBolha.fase === 'jogo' || destaBolha.fase === 'pausa')
  const dificuldadeFinal: DificuldadeBolha = permitida === 'escolha' ? dificuldade : permitida
  return (
    <section className="lb-fogo-vivo" aria-label="Bolha d'Água ao vivo">
      {ativa ? (
        <>
          <span className="lb-fogo-vivo__fase">
            {destaBolha.fase === 'convite'
              ? destaBolha.sozinho
                ? 'Começando sozinho no pino'
                : 'Convite aberto'
              : destaBolha.fase === 'pausa'
                ? 'Pausado'
                : `Jogando · ${destaBolha.dificuldade === undefined ? '' : NOME_DA_DIFICULDADE_BOLHA[destaBolha.dificuldade]}`}
            {' · '}
            {destaBolha.modo === 'equipe' ? 'Equipe' : 'Solo'}
            {' · '}
            {NOME_DO_CENARIO_BOLHA[destaBolha.cenario]}
          </span>
          <ul className="lb-fogo-vivo__lista">
            {destaBolha.participantes.map((p) => (
              <Linha key={p.playerId} p={p} />
            ))}
          </ul>
          {destaBolha.fase === 'convite' && !destaBolha.sozinho && (
            <>
              {permitida === 'escolha' ? (
                <Pastilhas<DificuldadeBolha> rotulo="Dificuldade" opcoes={DIFICULDADES} valor={dificuldade} onChange={setDificuldade} />
              ) : (
                <span className="lb-label">Dificuldade: {NOME_DA_DIFICULDADE_BOLHA[permitida]}</span>
              )}
              <button
                type="button"
                className="lb-btn lb-btn--primary lb-btn--block"
                disabled={!destaBolha.participantes.some((p) => p.status === 'pronto' && p.conectado)}
                onClick={() => onComecar(dificuldadeFinal)}
              >
                Começar
              </button>
              <span className="lb-label">Começa quem estiver Pronto; quem não estiver fica de fora.</span>
            </>
          )}
          <div className="lb-party__actions">
            {destaBolha.fase === 'jogo' && (
              <button type="button" className="lb-btn" onClick={onPausar}>
                Pausar para todos
              </button>
            )}
            {destaBolha.fase === 'pausa' && (
              <button type="button" className="lb-btn" onClick={onRetomar}>
                Continuar para todos
              </button>
            )}
            <button type="button" className="lb-btn lb-btn--ghost" onClick={onEncerrar}>
              Encerrar para todos
            </button>
          </div>
        </>
      ) : (
        <>
          {destaBolha !== null && destaBolha.fase === 'fim' && (
            <div className="lb-fogo-vivo__placar">
              <span className="lb-eyebrow">Última partida</span>
              {destaBolha.desfecho !== undefined && (
                <span className="lb-fogo-vivo__fase">
                  {destaBolha.desfecho.apagaram} de {destaBolha.desfecho.jogaram} apagaram o fogo · {destaBolha.desfecho.pontos} pontos na mesa
                </span>
              )}
              <ul className="lb-fogo-vivo__lista">
                {destaBolha.participantes
                  .filter((p) => p.resultado !== undefined)
                  .map((p) => (
                    <Linha key={p.playerId} p={p} />
                  ))}
              </ul>
            </div>
          )}
          {outraAtiva ? <span className="lb-label">Há uma partida da bolha aberta em outro pino: encerre aquela antes.</span> : <Chamar players={players} onConvidar={onConvidar} />}
        </>
      )}
    </section>
  )
}
