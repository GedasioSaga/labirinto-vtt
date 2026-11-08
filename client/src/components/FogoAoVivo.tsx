import { useState } from 'react'
import { DIFICULDADES_FOGO, FUNCOES_FOGO, type DificuldadeFogo, type FuncaoFogo, type MinigameFogo, type ModoFogo } from '../minigames/fogo/tipos'
import { NOME_DA_DIFICULDADE_FOGO, NOME_DA_FUNCAO_FOGO, NOME_DO_RESULTADO_FOGO } from '../minigames/fogo/tela/textos'
import type { FogoAoVivo, FogoConviteResultado, FogoParticipanteNoMestre } from '../net/fogoNoHost'
import { FOGO_EQUIPE_MAX, type FogoStatus } from '../net/protocoloDoFogo'
import './FogoAoVivo.css'

/**
 * O FOGO NA FLORESTA AO VIVO, no painel do pino de minigame: antes do
 * convite, quem joga (com a função inicial de cada um) e se é em equipe ou
 * cada um no seu; com o convite aberto, quem está pronto, a dificuldade e o
 * "Começar"; no jogo, "Pausar/Continuar" e "Encerrar para todos", e o aviso
 * se as partidas dos aparelhos ficarem diferentes (hash). No fim, o placar.
 *
 * Quem decide é a sessão (`net/fogoNoHost.ts`): este painel só lê e pede.
 */

export interface JogadorDoFogo {
  playerId: string
  name: string
}

export interface FogoAoVivoProps {
  pinId: string
  /** A dificuldade que o pino permite agora: 'escolha' = o mestre escolhe aqui. */
  permitida: MinigameFogo['permitida']
  /** Quem pode ser chamado agora: jogando e com a página aberta. */
  players: readonly JogadorDoFogo[]
  /** O fogo da sala (o ativo ou o último); `null` = nenhum. */
  fogo: FogoAoVivo | null
  onConvidar(convidados: { playerId: string; funcao: FuncaoFogo }[], modo: ModoFogo): FogoConviteResultado | null
  onMudarFuncao(playerId: string, funcao: FuncaoFogo): boolean
  onComecar(dificuldade: DificuldadeFogo): boolean
  onPausar(): boolean
  onRetomar(): boolean
  onEncerrar(): boolean
}

export const CHAMAR_PARA_O_FOGO = 'Chamar para o fogo'

const NOME_DO_STATUS: Record<FogoStatus, string> = {
  convidado: 'Convidado',
  pronto: 'Pronto',
  jogando: 'Jogando',
  terminou: 'Terminou',
  saiu: 'Saiu',
  fora: 'Ficou de fora',
}

const MOTIVO_DA_RECUSA: Record<Extract<FogoConviteResultado, { ok: false }>['motivo'], string> = {
  pino: 'Este pino não é mais do Fogo na Floresta.',
  ocupada: 'Já há um incêndio em andamento: encerre o outro antes.',
  ninguem: 'Ninguém escolhido está na sala agora.',
}

/** A função sugerida para o n-ésimo da lista: Bombeiro, Lenhador, Socorrista, e de novo. */
const funcaoSugerida = (indice: number): FuncaoFogo => FUNCOES_FOGO[indice % FUNCOES_FOGO.length]

interface SeletorDeFuncaoProps {
  nome: string
  valor: FuncaoFogo
  desligado?: boolean
  onChange(funcao: FuncaoFogo): void
}

function SeletorDeFuncao({ nome, valor, desligado = false, onChange }: SeletorDeFuncaoProps) {
  return (
    <select
      className="lb-input lb-fogo-vivo__funcao"
      aria-label={`Função de ${nome}`}
      value={valor}
      disabled={desligado}
      onChange={(event) => {
        const funcao = FUNCOES_FOGO.find((f) => f === event.target.value)
        if (funcao !== undefined) onChange(funcao)
      }}
    >
      {FUNCOES_FOGO.map((f) => (
        <option key={f} value={f}>
          {NOME_DA_FUNCAO_FOGO[f]}
        </option>
      ))}
    </select>
  )
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

const MODOS: readonly { valor: ModoFogo; rotulo: string }[] = [
  { valor: 'equipe', rotulo: 'Equipe (o mesmo incêndio)' },
  { valor: 'solo', rotulo: 'Solo (cada um no seu)' },
]

const DIFICULDADES = DIFICULDADES_FOGO.map((d) => ({ valor: d, rotulo: NOME_DA_DIFICULDADE_FOGO[d] }))

/** Antes do convite: quem joga, a função de cada um, e o modo. */
function Chamar({ players, onConvidar }: Pick<FogoAoVivoProps, 'players' | 'onConvidar'>) {
  const [modo, setModo] = useState<ModoFogo>('equipe')
  const [escolhidos, setEscolhidos] = useState<ReadonlyMap<string, FuncaoFogo>>(new Map())
  const [aviso, setAviso] = useState<string | null>(null)
  const cheio = modo === 'equipe' && escolhidos.size >= FOGO_EQUIPE_MAX
  const alternar = (playerId: string, indice: number) => {
    const novo = new Map(escolhidos)
    if (novo.has(playerId)) novo.delete(playerId)
    else novo.set(playerId, funcaoSugerida(indice))
    setEscolhidos(novo)
  }
  const chamar = () => {
    // Só quem ainda está na lista: quem saiu da sala desde a marcação não vai.
    const convidados = players.flatMap((p) => {
      const funcao = escolhidos.get(p.playerId)
      return funcao === undefined ? [] : [{ playerId: p.playerId, funcao }]
    })
    const resultado = onConvidar(convidados, modo)
    if (resultado === null) setAviso('A sala fechou: abra a sala para chamar.')
    else if (!resultado.ok) setAviso(MOTIVO_DA_RECUSA[resultado.motivo])
    else setAviso(null)
  }
  if (players.length === 0) return <span className="lb-label">Ninguém jogando na sala agora.</span>
  return (
    <div className="lb-fogo-vivo__chamar">
      <Pastilhas<ModoFogo> rotulo="Como jogam" opcoes={MODOS} valor={modo} onChange={setModo} />
      <ul className="lb-fogo-vivo__lista" aria-label="Quem joga">
        {players.map((p, indice) => {
          const funcao = escolhidos.get(p.playerId)
          return (
            <li key={p.playerId} className="lb-fogo-vivo__pessoa">
              <label className="lb-gather__item">
                <input type="checkbox" className="lb-gather__check" checked={funcao !== undefined} disabled={funcao === undefined && cheio} onChange={() => alternar(p.playerId, indice)} />
                <span className="lb-fogo-vivo__nome">{p.name}</span>
              </label>
              {funcao !== undefined && <SeletorDeFuncao nome={p.name} valor={funcao} onChange={(f) => setEscolhidos(new Map(escolhidos).set(p.playerId, f))} />}
            </li>
          )
        })}
      </ul>
      {cheio && <span className="lb-label">No mesmo incêndio cabem até {FOGO_EQUIPE_MAX}.</span>}
      <button type="button" className="lb-btn lb-btn--primary lb-btn--block" disabled={escolhidos.size === 0} onClick={chamar}>
        {CHAMAR_PARA_O_FOGO}
      </button>
      {aviso !== null && (
        <p className="lb-minigame__aviso" role="alert">
          {aviso}
        </p>
      )}
    </div>
  )
}

function Linha({ p, podeTrocar, onMudarFuncao }: { p: FogoParticipanteNoMestre; podeTrocar: boolean; onMudarFuncao(playerId: string, funcao: FuncaoFogo): boolean }) {
  return (
    <li className="lb-fogo-vivo__pessoa">
      <span className="lb-fogo-vivo__nome">
        {p.nome}
        {!p.conectado && <span className="lb-label"> (fora do ar)</span>}
      </span>
      {podeTrocar ? <SeletorDeFuncao nome={p.nome} valor={p.funcao} onChange={(f) => onMudarFuncao(p.playerId, f)} /> : <span className="lb-label">{NOME_DA_FUNCAO_FOGO[p.funcao]}</span>}
      <span className="lb-fogo-vivo__status">
        {p.resultado !== undefined ? `${NOME_DO_RESULTADO_FOGO[p.resultado]} · ${p.pontos ?? 0} pontos` : NOME_DO_STATUS[p.status]}
      </span>
    </li>
  )
}

export function FogoAoVivoPainel({ pinId, permitida, players, fogo, onConvidar, onMudarFuncao, onComecar, onPausar, onRetomar, onEncerrar }: FogoAoVivoProps) {
  const [dificuldade, setDificuldade] = useState<DificuldadeFogo>('normal')
  const desteFogo = fogo !== null && fogo.pinId === pinId ? fogo : null
  // Outro pino com incêndio aberto: este não chama até aquele acabar.
  const outroAtivo = fogo !== null && fogo.pinId !== pinId && (fogo.fase === 'convite' || fogo.fase === 'jogo' || fogo.fase === 'pausa')
  const ativo = desteFogo !== null && (desteFogo.fase === 'convite' || desteFogo.fase === 'jogo' || desteFogo.fase === 'pausa')
  const dificuldadeFinal: DificuldadeFogo = permitida === 'escolha' ? dificuldade : permitida
  return (
    <section className="lb-fogo-vivo" aria-label="Fogo na Floresta ao vivo">
      {desteFogo?.divergencia !== undefined && ativo && (
        <p className="lb-minigame__aviso" role="alert">
          As partidas de {desteFogo.divergencia.nomes.join(' e ')} ficaram diferentes no tique {desteFogo.divergencia.tique}. Encerre e chame de novo.
        </p>
      )}
      {ativo ? (
        <>
          <span className="lb-fogo-vivo__fase">
            {desteFogo.fase === 'convite' ? 'Convite aberto' : desteFogo.fase === 'pausa' ? 'Pausado' : `Jogando · ${desteFogo.dificuldade === undefined ? '' : NOME_DA_DIFICULDADE_FOGO[desteFogo.dificuldade]}`}
            {' · '}
            {desteFogo.modo === 'equipe' ? 'Equipe' : 'Solo'}
          </span>
          <ul className="lb-fogo-vivo__lista">
            {desteFogo.participantes.map((p) => (
              <Linha key={p.playerId} p={p} podeTrocar={desteFogo.fase === 'convite'} onMudarFuncao={onMudarFuncao} />
            ))}
          </ul>
          {desteFogo.fase === 'convite' && (
            <>
              {permitida === 'escolha' ? (
                <Pastilhas<DificuldadeFogo> rotulo="Dificuldade" opcoes={DIFICULDADES} valor={dificuldade} onChange={setDificuldade} />
              ) : (
                <span className="lb-label">Dificuldade: {NOME_DA_DIFICULDADE_FOGO[permitida]}</span>
              )}
              <button
                type="button"
                className="lb-btn lb-btn--primary lb-btn--block"
                disabled={!desteFogo.participantes.some((p) => p.status === 'pronto' && p.conectado)}
                onClick={() => onComecar(dificuldadeFinal)}
              >
                Começar
              </button>
              <span className="lb-label">Começa quem estiver Pronto; quem não estiver fica de fora.</span>
            </>
          )}
          <div className="lb-party__actions">
            {desteFogo.fase === 'jogo' && (
              <button type="button" className="lb-btn" onClick={onPausar}>
                Pausar para todos
              </button>
            )}
            {desteFogo.fase === 'pausa' && (
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
          {desteFogo !== null && desteFogo.fase === 'fim' && (
            <div className="lb-fogo-vivo__placar">
              <span className="lb-eyebrow">Último incêndio</span>
              {desteFogo.desfecho !== undefined && (
                <span className="lb-fogo-vivo__fase">
                  {desteFogo.desfecho.vitoria ? 'A equipe salvou a vila' : 'A equipe não salvou a vila'}
                  {desteFogo.desfecho.pontos !== undefined && ` · ${desteFogo.desfecho.pontos} pontos`}
                  {desteFogo.desfecho.florestaViva !== undefined && ` · floresta ${desteFogo.desfecho.florestaViva}%`}
                </span>
              )}
              <ul className="lb-fogo-vivo__lista">
                {desteFogo.participantes
                  .filter((p) => p.resultado !== undefined)
                  .map((p) => (
                    <Linha key={p.playerId} p={p} podeTrocar={false} onMudarFuncao={onMudarFuncao} />
                  ))}
              </ul>
            </div>
          )}
          {outroAtivo ? <span className="lb-label">Há um incêndio aberto em outro pino: encerre aquele antes.</span> : <Chamar players={players} onConvidar={onConvidar} />}
        </>
      )}
    </section>
  )
}
