import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { textoDaEsperaParaOMestre } from '../lib/encontroMarcado'
import {
  agruparPorCena,
  cenaCongelada,
  contarPedindo,
  esperandoFicha,
  fichasDaCena,
  presencaNaLinha,
  seloFora,
  type CenaNaOrdem,
  type GrupoDeCena,
  type LinhaDoGrupo,
} from '../lib/grupoPorCena'
import type { PlayerInfo } from '../net/hostSession'
import {
  CONGELADO_TAG,
  CONGELAR_TODOS_LABEL,
  DESCONGELAR_TODOS_LABEL,
  PartyActions,
  PartyAwayTokens,
  PartyBag,
  PartyDestinationMark,
  PartyNoteForm,
  PartySendForm,
  PartyStatus,
  partyBagVisible,
  playerNoteFeedbackText,
  useNoteFeedback,
  useOfflineClock,
  usePartySend,
  type PartySectionProps,
} from './PartySection'
import {
  AssignControls,
  AwayControls,
  EMPTY_GROUP_HINT,
  GiveMapControls,
  GROUP_VIEW_FEEDBACK_MS,
  GROUP_VIEW_LABEL,
  groupCountLabel,
  groupViewFeedbackText,
  HelperLoanControls,
  PLAN_HINT,
  PlayerName,
  ShareMapControls,
  TokenChips,
  tokenOwners,
  VisionFields,
  type PlayerAdminProps,
} from './RoomPanel'

/*
 * GRUPO COMPACTO (aba Jogo): com 10 jogadores, os cartões abertos de antes
 * davam ~1.700 px e o pedido de alguém sumia no meio. Agora cada jogador é
 * uma linha de 36 px (bolinha da ficha, nome, personagem, selos do que pede
 * atenção), a mesa vem em grupos por cena e UMA ficha abre por vez, com as
 * ações de toda cena no topo e o resto em abas (Mochila · Visão · Ficha).
 */

export const BUSCA_LABEL = 'Buscar jogador'
export const PEDINDO_LABEL = 'Pedindo'
export const CHEGANDO_LABEL = 'Chegando'
export const NINGUEM_ACHADO = 'Ninguém com esse nome.'
export const NINGUEM_PEDINDO = 'Ninguém pedindo nada agora.'
/** A segunda linha de quem não tem personagem no mapa (a mesma frase da aba Mochila). */
export const SEM_PERSONAGEM_LABEL = 'sem ficha no mapa'
/** Quanto a ficha leva para fechar (o `lb-grupo-fecha` do main.css): só então ela sai da árvore. */
export const FICHA_FECHA_MS = 150

/** As abas da ficha aberta. */
export type AbaDaFicha = 'mochila' | 'visao' | 'ficha'

export const ABA_ROTULO: Record<AbaDaFicha, string> = { mochila: 'Mochila', visao: 'Visão', ficha: 'Ficha' }

/** O porquê dos botões de congelar, no `title` (a frase do "Congelado" da ficha). */
const CONGELAR_A_MESA_TITLE = 'Os jogadores não movem as próprias fichas; você continua movendo.'

/** Traços das figuras do Grupo (viewBox 16): floco, floco riscado, entrar, pausar e a seta do título. */
const FIGURA = {
  floco: 'M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5',
  degelo: 'M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5M2 14L14 2',
  entrar: 'M6.5 2.5h-4v11h4M8.5 5l3 3-3 3M11.5 8h-7',
  pausar: 'M5.5 3.5v9M10.5 3.5v9',
  seta: 'M6 4l4 4-4 4',
} as const

function Figura({ tracos, className = 'lb-grupo__figura' }: { tracos: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false" viewBox="0 0 16 16">
      <path d={tracos} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

/** Esc fecha o que está aberto e para aqui: no editor ele cancelaria a ferramenta. */
function closeOnEscape(event: KeyboardEvent, close: () => void): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  close()
}

/** Aviso do último "Dar o que o grupo viu", com o mesmo formato do recado (`useNoteFeedback`). */
function useGroupViewFeedback() {
  const [feedback, setFeedback] = useState<{ playerId: string; text: string } | null>(null)
  useEffect(() => {
    if (feedback === null) return
    const timer = setTimeout(() => setFeedback(null), GROUP_VIEW_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [feedback])
  return { feedback, show: (playerId: string, text: string) => setFeedback({ playerId, text }) }
}

/** O estado de uma linha: a ficha aberta, fechando (ainda na árvore, sem resposta a clique) ou fechada. */
type EstadoDaFicha = 'aberta' | 'fechando' | 'fechada'

/**
 * Uma ficha aberta por vez. Pelo mouse ela abre e fecha com movimento; pelo
 * teclado (`instant`, clique sem contagem) aparece e some de uma vez. Trocar
 * de linha com uma aberta também é de uma vez: a lista não dança duas vezes.
 * `onMudou` roda a cada troca (fecha os formulários da ficha que sai).
 */
function useFichaAberta(onMudou: () => void) {
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [fechandoId, setFechandoId] = useState<string | null>(null)
  const [instantaneo, setInstantaneo] = useState(false)
  useEffect(() => {
    if (fechandoId === null) return
    const timer = setTimeout(() => setFechandoId(null), FICHA_FECHA_MS)
    return () => clearTimeout(timer)
  }, [fechandoId])

  const fechar = (instant: boolean) => {
    onMudou()
    setInstantaneo(instant)
    setFechandoId(instant ? null : abertoId)
    setAbertoId(null)
  }
  const alternar = (playerId: string, instant: boolean) => {
    if (abertoId === playerId) {
      fechar(instant)
      return
    }
    onMudou()
    setInstantaneo(instant || abertoId !== null)
    setFechandoId(null)
    setAbertoId(playerId)
  }
  const estadoDe = (playerId: string): EstadoDaFicha => {
    if (abertoId === playerId) return 'aberta'
    return fechandoId === playerId ? 'fechando' : 'fechada'
  }
  return { instantaneo, alternar, fechar, estadoDe }
}

export interface GrupoCompactoProps extends Omit<PlayerAdminProps, 'owners' | 'roster'> {
  players: PlayerInfo[]
  party: PartySectionProps | undefined
  /**
   * "Dar o que o grupo viu": o jogador ganha o que os colegas viram na cena
   * onde ele está. Devolve quantos colegas (0 = ninguém mais explorou), ou
   * `null` se não deu. Ausente = a ficha fica sem o botão.
   */
  onGiveGroupView?(playerId: string): number | null
  /** A cena aberta no editor, que vem primeiro; `null` = mapa solto. */
  cenaAberta?: string | null
  /** As cenas na ordem da lista Cenas. */
  ordemDasCenas?: readonly CenaNaOrdem[]
  /** Nome do grupo único do mapa solto. */
  mapName?: string
  onIrACena?(sceneId: string): void
  onCongelarCena?(tokenIds: string[], congelar: boolean): void
  pausedScenes?: ReadonlySet<string>
  onPausarCena?(sceneId: string, pause: boolean): void
}

/**
 * CONGELAR FICHA — os gestos de mesa no alto do Grupo, como figura: o floco
 * ("Congelar todos") enquanto alguma ficha de jogador está solta, o floco
 * riscado ("Descongelar todos") enquanto alguma está congelada (os dois,
 * quando só uma parte está). Ações de uma vez, não interruptor.
 */
function CongelarAMesa({ todas, alguma, onChange }: NonNullable<PartySectionProps['congelar']>) {
  return (
    <>
      {!todas && (
        <button type="button" className="lb-grupo__icone" title={`${CONGELAR_TODOS_LABEL}. ${CONGELAR_A_MESA_TITLE}`} onClick={() => onChange(true)}>
          <Figura tracos={FIGURA.floco} />
          <span className="lb-sr-only">{CONGELAR_TODOS_LABEL}</span>
        </button>
      )}
      {alguma && (
        <button type="button" className="lb-grupo__icone lb-grupo__icone--gelo" title={DESCONGELAR_TODOS_LABEL} onClick={() => onChange(false)}>
          <Figura tracos={FIGURA.degelo} />
          <span className="lb-sr-only">{DESCONGELAR_TODOS_LABEL}</span>
        </button>
      )}
    </>
  )
}

/** Expulsar, por último e separado: derruba alguém. Desconectado não tem: não há conexão para derrubar. */
function Expulsar({ player, onKick }: { player: PlayerInfo; onKick(clientId: string): void }) {
  const clientId = player.clientId
  if (clientId === null) return null
  return (
    <div className="lb-player__perigo">
      <button type="button" className="lb-btn lb-btn--danger lb-btn--compact lb-player__kick" onClick={() => onKick(clientId)}>
        Expulsar
      </button>
    </div>
  )
}

/**
 * Quem espera personagem, no grupo "Chegando": aberto, com atribuir em um
 * clique, a lista e o raio de visão à vista (o mestre acerta a lanterna
 * antes de dar a ficha), e o Expulsar no fim. Sem planta: sem cena, não há
 * planta a revelar (a sessão ignora o pedido).
 */
function CartaoChegando({ player, admin }: { player: PlayerInfo; admin: PlayerAdminProps }) {
  return (
    <div className="lb-field lb-player lb-player--waiting">
      <div className="lb-player__line">
        <span className="lb-party__dot" aria-hidden="true" />
        <PlayerName player={player} />
        <span className="lb-player__status" aria-hidden="true">
          aguardando
        </span>
      </div>
      <TokenChips player={player} tokens={admin.tokens} onUnassign={admin.onUnassign} />
      <AssignControls player={player} tokens={admin.tokens} owners={admin.owners} onAssign={admin.onAssign} />
      {admin.onLend !== undefined && <HelperLoanControls player={player} tokens={admin.tokens} owners={admin.owners} onLend={admin.onLend} quiet />}
      <VisionFields player={player} onVisionRadiusChange={admin.onVisionRadiusChange} onVisionFactorChange={admin.onVisionFactorChange} />
      <Expulsar player={player} onKick={admin.onKick} />
    </div>
  )
}

/** Um selo da linha: figura opcional (só à vista) e o texto. */
interface Selo {
  chave: string
  texto: string
  figura?: string
  tom: 'pede' | 'fora' | 'gelo' | 'neutro'
}

function selosDa(linha: LinhaDoGrupo, now: number, seguindo: boolean): Selo[] {
  const { player, member } = linha
  const selos: Selo[] = []
  if (member?.travelPending === true || player.travelPending === true) selos.push({ chave: 'passagem', figura: '✋', texto: 'passagem', tom: 'pede' })
  if ((member?.awayTokens?.length ?? 0) > 0) selos.push({ chave: 'longe', figura: '↩', texto: 'ficha longe', tom: 'pede' })
  if (player.away === true) selos.push({ chave: 'volto', texto: 'volto já', tom: 'fora' })
  else if (!player.connected) selos.push({ chave: 'fora', texto: seloFora(player, now), tom: 'fora' })
  if (member?.congelado === true) selos.push({ chave: 'gelo', figura: '❄', texto: CONGELADO_TAG, tom: 'gelo' })
  if (seguindo) selos.push({ chave: 'seguindo', texto: 'seguindo', tom: 'neutro' })
  return selos
}

interface LinhaDoJogadorProps {
  linha: LinhaDoGrupo
  estado: EstadoDaFicha
  instantaneo: boolean
  now: number
  seguindo: boolean
  onAlternar(instant: boolean): void
  /** Esc dentro da ficha: fecha e devolve o foco à linha. */
  onFechar(): void
  /** O conteúdo da ficha: só montado com ela aberta ou fechando. */
  ficha: () => ReactNode
  /** O botão da linha, para o foco voltar a ele quando a ficha fecha pelo teclado. */
  registrar(el: HTMLButtonElement | null): void
}

/**
 * Uma linha de 36 px: a bolinha na cor da ficha (anel vazio = sem ficha no
 * mapa) com o ponto de presença, o nome do jogador, o do personagem embaixo
 * e os selos do que pede atenção. A linha inteira é o botão que abre a ficha.
 * O "<nome> —" do leitor de tela (`PlayerName`) é também o gancho das jornadas.
 */
function LinhaDoJogador({ linha, estado, instantaneo, now, seguindo, onAlternar, onFechar, ficha, registrar }: LinhaDoJogadorProps) {
  const { player, member, personagem } = linha
  const fichaId = `lb-grupo-ficha-${player.playerId}`
  const presenca = presencaNaLinha(player, member)
  const cor = member?.token?.color ?? null
  const aberta = estado === 'aberta'
  const selos = selosDa(linha, now, seguindo)
  const classe = ['lb-party__item', 'lb-grupo__item', presenca === 'fora' ? 'lb-party__item--away' : '', aberta ? 'lb-grupo__item--aberta' : ''].filter(Boolean).join(' ')
  return (
    <li className={classe}>
      <div className="lb-field lb-player lb-grupo__jogador">
        <button
          ref={registrar}
          type="button"
          className="lb-grupo__linha"
          aria-expanded={aberta}
          aria-controls={aberta ? fichaId : undefined}
          onClick={(event) => onAlternar(event.detail === 0)}
          onKeyDown={(event) => {
            if (aberta) closeOnEscape(event, onFechar)
          }}
        >
          {/* Sem ficha, sem cor: o anel vazio diz "não está no mapa". */}
          <span className="lb-party__dot lb-grupo__avatar" aria-hidden="true" style={cor === null ? undefined : { background: cor }}>
            <span className="lb-grupo__presenca" data-presenca={presenca} />
          </span>
          <span className="lb-grupo__nomes">
            <span className="lb-grupo__nome">
              <PlayerName player={player} />
            </span>
            <span className={personagem === null ? 'lb-grupo__personagem lb-grupo__personagem--sem' : 'lb-grupo__personagem'} title={personagem ?? undefined}>
              {personagem ?? SEM_PERSONAGEM_LABEL}
            </span>
          </span>
          {/* Os espaços em texto separam as partes no nome acessível ("Adaga, fora", não "Adagafora"). */}
          {selos.length > 0 && (
            <span className="lb-grupo__selos">
              {selos.map((selo) => (
                <Fragment key={selo.chave}>
                  {' '}
                  <span className={`lb-grupo__selo lb-grupo__selo--${selo.tom}`} title={selo.texto}>
                    {selo.figura !== undefined && <span aria-hidden="true">{selo.figura}</span>}
                    {/* O congelado leva a classe de sempre: é por ela que o resto do app lê a marca. */}
                    <span className={selo.tom === 'gelo' ? 'lb-player__congelado' : undefined}>{selo.texto}</span>
                  </span>
                </Fragment>
              ))}
            </span>
          )}
        </button>
        {estado !== 'fechada' && (
          <div
            id={fichaId}
            className="lb-grupo__ficha"
            role="group"
            aria-label={`Ficha de ${player.name}`}
            data-estado={estado}
            data-instant={instantaneo ? '' : undefined}
            inert={estado === 'fechando'}
            onKeyDown={(event) => closeOnEscape(event, onFechar)}
          >
            <div className="lb-grupo__ficha-dentro">{ficha()}</div>
          </div>
        )}
      </div>
    </li>
  )
}

interface AbasProps {
  idBase: string
  nome: string
  abas: readonly AbaDaFicha[]
  ativa: AbaDaFicha
  onEscolher(aba: AbaDaFicha): void
  children: ReactNode
}

/** As abas da ficha: setas, Home e End andam entre elas (o foco vai junto); a escolhida vale para a próxima ficha. */
function AbasDaFicha({ idBase, nome, abas, ativa, onEscolher, children }: AbasProps) {
  const refs = useRef(new Map<AbaDaFicha, HTMLButtonElement>())
  const ir = (aba: AbaDaFicha | undefined) => {
    if (aba === undefined) return
    onEscolher(aba)
    refs.current.get(aba)?.focus()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const atual = abas.indexOf(ativa)
    if (event.key === 'ArrowRight') ir(abas[(atual + 1) % abas.length])
    else if (event.key === 'ArrowLeft') ir(abas[(atual - 1 + abas.length) % abas.length])
    else if (event.key === 'Home') ir(abas[0])
    else if (event.key === 'End') ir(abas[abas.length - 1])
    else return
    event.preventDefault()
  }
  return (
    <>
      <div className="lb-grupo__abas" role="tablist" aria-label={`Ficha de ${nome}`} onKeyDown={onKeyDown}>
        {abas.map((aba) => (
          <button
            key={aba}
            ref={(el) => {
              if (el === null) refs.current.delete(aba)
              else refs.current.set(aba, el)
            }}
            type="button"
            role="tab"
            id={`${idBase}-aba-${aba}`}
            className="lb-grupo__aba"
            aria-selected={aba === ativa}
            aria-controls={`${idBase}-painel`}
            tabIndex={aba === ativa ? 0 : -1}
            onClick={() => onEscolher(aba)}
          >
            {ABA_ROTULO[aba]}
          </button>
        ))}
      </div>
      <div id={`${idBase}-painel`} className="lb-grupo__painel" role="tabpanel" aria-labelledby={`${idBase}-aba-${ativa}`}>
        {children}
      </div>
    </>
  )
}

interface FichaDoJogadorProps {
  linha: LinhaDoGrupo
  party: PartySectionProps | undefined
  admin: PlayerAdminProps
  aba: AbaDaFicha
  onAba(aba: AbaDaFicha): void
  sendOpen: boolean
  sendFormId: string
  onToggleSend(opener: HTMLElement): void
  onCloseSend(): void
  noteOpen: boolean
  noteFormId: string
  onToggleNote(opener: HTMLElement): void
  onSendNote(text: string): void
  onCancelNote(): void
  /** O aviso do último recado a este jogador; `null` = nenhum. */
  noteFeedback: string | null
  /** "Dar o que o grupo viu" já ligado a ESTE jogador. Ausente = sem o botão. */
  onGiveGroupView?(): void
  groupViewFeedback: string | null
}

/**
 * A ficha aberta: no topo o que pede o mestre (passagem, ficha longe, marca
 * de destino), depois as cinco ações de toda cena — com o "Recado" e o
 * "Mandar para…" abrindo ali mesmo — e as abas Mochila · Visão · Ficha.
 */
function FichaDoJogador(props: FichaDoJogadorProps) {
  const { linha, party, admin, aba, onAba } = props
  const { player, member } = linha
  const idBase = `lb-grupo-${player.playerId}`
  const hintId = `${idBase}-dica`
  const abas: AbaDaFicha[] = member === undefined ? ['visao', 'ficha'] : ['mochila', 'visao', 'ficha']
  const ativa = abas.includes(aba) ? aba : abas[0]
  const pedePassagem = member?.travelPending === true || player.travelPending === true
  return (
    <>
      {pedePassagem && <p className="lb-grupo__pendencia">✋ Pediu passagem: responda no aviso.</p>}
      {member !== undefined && <PartyAwayTokens member={member} onBring={party?.onBring} />}
      {member !== undefined && <PartyDestinationMark member={member} onViewDestination={party?.onViewDestination} />}
      {player.borrowedFrom !== undefined && <p className="lb-player__note">Jogando também a ficha de {player.borrowedFrom.join(', ')}.</p>}
      {/* ENCONTRO MARCADO: o mestre não guarda de cabeça quem espera quem, onde e até quando. */}
      {player.waiting !== undefined && <p className="lb-player__note">{textoDaEsperaParaOMestre(player.waiting)}</p>}
      {member !== undefined && party !== undefined && (
        <PartyActions
          member={member}
          party={party}
          sendOpen={props.sendOpen}
          sendFormId={props.sendFormId}
          onToggleSend={props.onToggleSend}
          noteOpen={props.noteOpen}
          noteFormId={props.noteFormId}
          onToggleNote={props.onToggleNote}
        />
      )}
      {member !== undefined && party?.onNote !== undefined && props.noteOpen && (
        <PartyNoteForm member={member} formId={props.noteFormId} onSend={props.onSendNote} onCancel={props.onCancelNote} />
      )}
      {props.noteFeedback !== null && (
        <p className="lb-party__recado-aviso" role="status">
          {props.noteFeedback}
        </p>
      )}
      {member !== undefined && member.token !== null && party !== undefined && props.sendOpen && (
        <PartySendForm member={member} party={party} formId={props.sendFormId} onClose={props.onCloseSend} />
      )}
      <AbasDaFicha idBase={idBase} nome={player.name} abas={abas} ativa={ativa} onEscolher={onAba}>
        {ativa === 'mochila' && member !== undefined && (
          <>
            <PartyStatus member={member} />
            {party !== undefined && partyBagVisible(member, party) && <PartyBag member={member} party={party} />}
          </>
        )}
        {ativa === 'visao' && (
          <>
            {/* Só quem joga tem cena: quem aguarda não tem onde receber o que o grupo viu. */}
            {props.onGiveGroupView !== undefined && player.status === 'playing' && (
              <>
                <button type="button" className="lb-btn lb-btn--compact" onClick={props.onGiveGroupView}>
                  {GROUP_VIEW_LABEL}
                </button>
                {props.groupViewFeedback !== null && (
                  <p className="lb-player__note" role="status">
                    {props.groupViewFeedback}
                  </p>
                )}
              </>
            )}
            <VisionFields player={player} onVisionRadiusChange={admin.onVisionRadiusChange} onVisionFactorChange={admin.onVisionFactorChange} />
            <div className="lb-player__plan">
              <button type="button" className="lb-btn lb-btn--compact" aria-describedby={hintId} onClick={() => admin.onRevealPlan(player.playerId)}>
                Revelar planta
              </button>
              <button type="button" className="lb-btn lb-btn--compact" onClick={() => admin.onHidePlan(player.playerId)}>
                Esconder de novo
              </button>
            </div>
            <p id={hintId} className="lb-field__hint">
              {PLAN_HINT}
            </p>
            {admin.onShareMap !== undefined && <ShareMapControls player={player} players={admin.roster} onShareMap={admin.onShareMap} />}
            {admin.onGiveMap !== undefined && admin.giftScenes !== undefined && admin.giftScenes.length > 0 && (
              <GiveMapControls player={player} scenes={admin.giftScenes} onGiveMap={admin.onGiveMap} />
            )}
          </>
        )}
        {ativa === 'ficha' && (
          <>
            <TokenChips player={player} tokens={admin.tokens} onUnassign={admin.onUnassign} />
            <AssignControls player={player} tokens={admin.tokens} owners={admin.owners} onAssign={admin.onAssign} />
            {admin.onLend !== undefined && <HelperLoanControls player={player} tokens={admin.tokens} owners={admin.owners} onLend={admin.onLend} />}
            <AwayControls
              player={player}
              players={admin.roster}
              onStoreTokens={admin.onStoreTokens}
              onDismiss={admin.onDismiss}
              onHandOver={admin.onHandOver}
              onLendTokens={admin.onLendTokens}
              onEndLoans={admin.onEndLoans}
            />
            <Expulsar player={player} onKick={admin.onKick} />
          </>
        )}
      </AbasDaFicha>
    </>
  )
}

interface CenaDoGrupoProps {
  grupo: GrupoDeCena
  /** É a cena aberta no editor agora. */
  noEditor: boolean
  recolhida: boolean
  instantanea: boolean
  onRecolher(instant: boolean): void
  pausada: boolean
  onIrACena?(sceneId: string): void
  onCongelarCena?(tokenIds: string[], congelar: boolean): void
  onPausarCena?(sceneId: string, pause: boolean): void
  children: ReactNode
}

function quantos(n: number): string {
  return n === 1 ? '1 jogador' : `${n} jogadores`
}

/**
 * Um grupo por cena: o título recolhível (seta, nome, quantos) e os atalhos
 * de cena — Ir à cena, Congelar a cena (vira Descongelar com todas
 * congeladas) e Pausar a cena. Sem cena de aventura (mapa solto), só o
 * congelar: não há cena para abrir nem para pausar.
 */
function CenaDoGrupo({ grupo, noEditor, recolhida, instantanea, onRecolher, pausada, onIrACena, onCongelarCena, onPausarCena, children }: CenaDoGrupoProps) {
  const tituloId = useId()
  const corpoId = useId()
  const { sceneId, nome, linhas } = grupo
  const fichas = fichasDaCena(linhas)
  const congelada = cenaCongelada(linhas)
  return (
    <section className="lb-grupo__cena" aria-labelledby={tituloId} data-recolhida={recolhida ? '' : undefined}>
      <div className="lb-grupo__cena-topo">
        <button
          type="button"
          className="lb-grupo__cena-alterna"
          aria-expanded={!recolhida}
          aria-controls={corpoId}
          data-instant={instantanea ? '' : undefined}
          onClick={(event) => onRecolher(event.detail === 0)}
        >
          <Figura tracos={FIGURA.seta} className="lb-grupo__seta" />
          <span id={tituloId} className="lb-grupo__cena-nome" title={nome}>
            {nome}
          </span>
          {noEditor && <span className="lb-grupo__cena-aqui">no editor</span>}
          <span className="lb-grupo__cena-conta" aria-hidden="true">
            {linhas.length}
          </span>
          <span className="lb-sr-only">{`, ${quantos(linhas.length)}`}</span>
        </button>
        <div className="lb-grupo__cena-atalhos">
          {sceneId !== null && onIrACena !== undefined && (
            <button type="button" className="lb-grupo__icone" aria-label={`Ir à cena ${nome}`} title="Ir à cena" onClick={() => onIrACena(sceneId)}>
              <Figura tracos={FIGURA.entrar} />
            </button>
          )}
          {onCongelarCena !== undefined && fichas.length > 0 && (
            <button
              type="button"
              className="lb-grupo__icone"
              aria-label={congelada ? `Descongelar a cena ${nome}` : `Congelar a cena ${nome}`}
              title={congelada ? 'Descongelar a cena' : `Congelar a cena. ${CONGELAR_A_MESA_TITLE}`}
              onClick={() => onCongelarCena(fichas, !congelada)}
            >
              <Figura tracos={congelada ? FIGURA.degelo : FIGURA.floco} />
            </button>
          )}
          {sceneId !== null && onPausarCena !== undefined && (
            <button
              type="button"
              className="lb-grupo__icone"
              aria-label={`Pausar a cena ${nome}`}
              aria-pressed={pausada}
              title="Pausar a cena"
              onClick={() => onPausarCena(sceneId, !pausada)}
            >
              <Figura tracos={FIGURA.pausar} />
            </button>
          )}
        </div>
      </div>
      <div id={corpoId} className="lb-grupo__cena-corpo" data-instant={instantanea ? '' : undefined} inert={recolhida}>
        <div className="lb-grupo__cena-dentro">
          <ul className="lb-party__list lb-grupo__lista">{children}</ul>
        </div>
      </div>
    </section>
  )
}

/** A chave de uma cena no conjunto das recolhidas: o mapa solto é ''. */
const chaveDaCena = (sceneId: string | null): string => sceneId ?? ''

/**
 * O Grupo: a mesa inteira, por cena. No topo, a busca por jogador ou
 * personagem, o "Pedindo N" (só quem pede algo) e o congelar da mesa. Quem
 * espera personagem vem primeiro, em "Chegando", aberto; depois a cena aberta
 * no editor e as outras na ordem da lista Cenas.
 */
export function GrupoCompacto({
  players,
  party,
  onGiveGroupView,
  cenaAberta = null,
  ordemDasCenas = [],
  mapName,
  onIrACena,
  onCongelarCena,
  pausedScenes,
  onPausarCena,
  ...rest
}: GrupoCompactoProps) {
  const headingId = useId()
  const chegandoId = useId()
  const sendFormId = useId()
  const noteFormId = useId()
  const [busca, setBusca] = useState('')
  const [soPedindo, setSoPedindo] = useState(false)
  const [aba, setAba] = useState<AbaDaFicha>('mochila')
  const [recolhidas, setRecolhidas] = useState<ReadonlySet<string>>(() => new Set())
  const [recolhaInstantanea, setRecolhaInstantanea] = useState(false)
  const linhasRef = useRef(new Map<string, HTMLButtonElement>())
  const send = usePartySend()
  const note = useNoteFeedback()
  const groupView = useGroupViewFeedback()
  const ficha = useFichaAberta(send.reset)
  const now = useOfflineClock(players.some((player) => !player.connected && player.disconnectedAt !== undefined))
  const admin: PlayerAdminProps = { ...rest, owners: tokenOwners(players), roster: players }
  const nomesDasFichas = new Map(rest.tokens.map((token) => [token.id, token.name]))
  const { chegando, grupos } = agruparPorCena(players, party?.members, { cenaAberta, ordemDasCenas, nomeDoMapa: mapName, nomesDasFichas, busca, soPedindo })
  const pedindo = contarPedindo(players, party?.members)
  const esperando = players.filter(esperandoFicha).length

  // ACABOU DE GANHAR FICHA: quem sai de "Chegando" com ficha desce para a
  // cena já com a ficha aberta na aba Ficha — o mestre vê o que atribuiu (e o
  // "Remover") sem procurar a linha nova entre as outras.
  const esperandoAntes = useRef<ReadonlySet<string>>(new Set(players.filter(esperandoFicha).map((player) => player.playerId)))
  useEffect(() => {
    const agora = new Set(players.filter(esperandoFicha).map((player) => player.playerId))
    const atribuido = [...esperandoAntes.current].find((id) => !agora.has(id) && players.some((player) => player.playerId === id && player.tokenIds.length > 0))
    esperandoAntes.current = agora
    if (atribuido === undefined) return
    setAba('ficha')
    if (ficha.estadoDe(atribuido) !== 'aberta') ficha.alternar(atribuido, true)
    // Só a troca de jogadores importa; `ficha` é refeito a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players])

  const recolher = (sceneId: string | null, instant: boolean) => {
    setRecolhaInstantanea(instant)
    setRecolhidas((atual) => {
      const proxima = new Set(atual)
      const chave = chaveDaCena(sceneId)
      if (proxima.has(chave)) proxima.delete(chave)
      else proxima.add(chave)
      return proxima
    })
  }

  const fechaPeloTeclado = (playerId: string) => {
    ficha.fechar(true)
    linhasRef.current.get(playerId)?.focus()
  }

  const fichaDe = (linha: LinhaDoGrupo) => {
    const { player } = linha
    const id = player.playerId
    return (
      <FichaDoJogador
        linha={linha}
        party={party}
        admin={admin}
        aba={aba}
        onAba={setAba}
        sendOpen={send.sendingId === id}
        sendFormId={sendFormId}
        onToggleSend={(opener) => send.toggle(id, opener)}
        onCloseSend={send.close}
        noteOpen={send.notingId === id}
        noteFormId={noteFormId}
        onToggleNote={(opener) => {
          note.clear()
          send.toggle(id, opener, 'note')
        }}
        onSendNote={(text) => {
          const delivery = party?.onNote?.(id, text) ?? null
          note.show(id, playerNoteFeedbackText(player.name, delivery))
          send.close()
        }}
        onCancelNote={send.close}
        noteFeedback={note.feedback?.playerId === id ? note.feedback.text : null}
        onGiveGroupView={
          onGiveGroupView === undefined ? undefined : () => groupView.show(id, groupViewFeedbackText(player.name, onGiveGroupView(id) ?? null))
        }
        groupViewFeedback={groupView.feedback?.playerId === id ? groupView.feedback.text : null}
      />
    )
  }

  const vazio = players.length > 0 && chegando.length === 0 && grupos.length === 0

  return (
    <section className="lb-party lb-grupo" aria-labelledby={headingId}>
      <div className="lb-party__head">
        <h3 id={headingId} className="lb-eyebrow">
          Grupo
        </h3>
        {players.length > 0 && (
          <span className={esperando > 0 ? 'lb-party__count lb-party__count--waiting' : 'lb-party__count'}>{groupCountLabel(players.length, esperando)}</span>
        )}
      </div>
      {players.length === 0 && <p className="lb-player__note">{EMPTY_GROUP_HINT}</p>}
      {players.length > 0 && (
        <div className="lb-grupo__topo">
          <input
            type="search"
            className="lb-input lb-grupo__busca"
            aria-label={BUSCA_LABEL}
            // Curto à vista: na coluna de 264 px "Buscar jogador" cortava no meio.
            placeholder="Buscar"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            onKeyDown={(event) => {
              // Esc limpa a busca e para aqui; vazia, segue o caminho de sempre.
              if (busca !== '') closeOnEscape(event, () => setBusca(''))
            }}
          />
          <button
            type="button"
            className="lb-grupo__pedindo"
            aria-pressed={soPedindo}
            disabled={pedindo === 0 && !soPedindo}
            title="Só quem pede algo: passagem, ficha longe ou personagem"
            onClick={() => setSoPedindo((atual) => !atual)}
          >
            {PEDINDO_LABEL} <span className="lb-num">{pedindo}</span>
          </button>
          {party?.congelar !== undefined && <CongelarAMesa {...party.congelar} />}
        </div>
      )}
      {chegando.length > 0 && (
        <section className="lb-grupo__chegando" aria-labelledby={chegandoId}>
          <h4 id={chegandoId} className="lb-grupo__chegando-titulo">
            {CHEGANDO_LABEL}
          </h4>
          {chegando.map(({ player }) => (
            <CartaoChegando key={player.playerId} player={player} admin={admin} />
          ))}
        </section>
      )}
      {grupos.map((grupo) => (
        <CenaDoGrupo
          key={chaveDaCena(grupo.sceneId)}
          grupo={grupo}
          noEditor={grupo.sceneId !== null && grupo.sceneId === cenaAberta}
          recolhida={recolhidas.has(chaveDaCena(grupo.sceneId))}
          instantanea={recolhaInstantanea}
          onRecolher={(instant) => recolher(grupo.sceneId, instant)}
          pausada={grupo.sceneId !== null && pausedScenes?.has(grupo.sceneId) === true}
          onIrACena={onIrACena}
          onCongelarCena={onCongelarCena}
          onPausarCena={onPausarCena}
        >
          {grupo.linhas.map((linha) => {
            const id = linha.player.playerId
            return (
              <LinhaDoJogador
                key={id}
                linha={linha}
                estado={ficha.estadoDe(id)}
                instantaneo={ficha.instantaneo}
                now={now}
                seguindo={party?.followingId === id}
                onAlternar={(instant) => ficha.alternar(id, instant)}
                onFechar={() => fechaPeloTeclado(id)}
                ficha={() => fichaDe(linha)}
                registrar={(el) => {
                  if (el === null) linhasRef.current.delete(id)
                  else linhasRef.current.set(id, el)
                }}
              />
            )
          })}
        </CenaDoGrupo>
      ))}
      {vazio && (
        <p className="lb-player__note" role="status">
          {soPedindo && busca.trim() === '' ? NINGUEM_PEDINDO : NINGUEM_ACHADO}
        </p>
      )}
    </section>
  )
}
