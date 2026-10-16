import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
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
import type { PassagemNoPainel, PlayerInfo } from '../net/hostSession'
import {
  CONGELADO_TAG,
  CONGELAR_TODOS_LABEL,
  DESCONGELAR_TODOS_LABEL,
  FOLLOW_LABEL,
  NOTE_LABEL,
  PartyAwayTokens,
  PartyBag,
  PartyDestinationMark,
  PartyNoteForm,
  PartySendForm,
  PartyStatus,
  SEND_TO_LABEL,
  mirrorLabel,
  partyBagVisible,
  playerNoteFeedbackText,
  sendDestinationsFor,
  useNoteFeedback,
  useOfflineClock,
  usePartySend,
  type PartySectionProps,
} from './PartySection'
import type { PartyMember } from '../lib/party'
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
import { Balao } from './grimorio/Balao'
import { Botao } from './grimorio/Botao'
import { CampoSeg } from './grimorio/CampoSeg'
import { IconeDoLivro, type NomeDoIcone } from './livro/icones'
import './livro/grupo.css'

/*
 * GRUPO DO MESTRE (página Grupo do livro da mesa; fatia 5 do design
 * consolidado, docs/design/consolidado/PLANO.md). Cada jogador é uma linha
 * (bola na cor da ficha, nome, personagem, selos do que pede atenção) com as
 * duas ações de toda hora à mão — "Ir lá" e "Recado" — e UMA ficha aberta por
 * vez, com o seg Ações · Mochila · Visão · Ficha. A mesa vem em grupos por
 * cena, com Ir à cena, Congelar e Pausar no título e o pedido de passagem
 * logo abaixo dele, à vista sem abrir ninguém.
 */

export const BUSCA_LABEL = 'Buscar jogador'
export const PEDINDO_LABEL = 'Pedindo'
export const CHEGANDO_LABEL = 'Chegando'
export const NINGUEM_ACHADO = 'Ninguém com esse nome.'
export const NINGUEM_PEDINDO = 'Ninguém pedindo nada agora.'
/** A segunda linha de quem não tem personagem no mapa (a mesma frase da aba Mochila). */
export const SEM_PERSONAGEM_LABEL = 'sem ficha no mapa'
/** Quanto a ficha leva para fechar (o `gr-grupo-fecha` do grupo.css): só então ela sai da árvore. */
export const FICHA_FECHA_MS = 150

/** As partes da ficha aberta (o seg). */
export type AbaDaFicha = 'acoes' | 'mochila' | 'visao' | 'ficha'

export const ABA_ROTULO: Record<AbaDaFicha, string> = { acoes: 'Ações', mochila: 'Mochila', visao: 'Visão', ficha: 'Ficha' }

/** O porquê dos botões de congelar, no balão (a frase do "Congelado" da ficha). */
const CONGELAR_A_MESA_TITLE = 'Os jogadores não movem as próprias fichas; você continua movendo.'

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
  /** Responde o pedido de passagem pelo Grupo (`HostBridge.answerTravel`). */
  onAnswerTravel?(requestId: string, allow: boolean): void
}

interface BotaoDeIconeProps {
  /** O texto do balão (o que o botão faz, curto). */
  balao: string
  /** O nome acessível, com quem ou onde ("Ir à cena Cripta"). */
  nome: string
  icone: NomeDoIcone
  onClick(event: MouseEvent<HTMLButtonElement>): void
  pressionado?: boolean
  expandido?: boolean
  controla?: string
}

/** Botão só de ícone com o balão do Grimório: as ações rápidas da linha e os atalhos de cada cena. */
function BotaoDeIcone({ balao, nome, icone, onClick, pressionado, expandido, controla }: BotaoDeIconeProps) {
  return (
    <Balao texto={balao}>
      {(gatilho) => (
        <Botao soIcone tamanho="p" aria-label={nome} aria-pressed={pressionado} aria-expanded={expandido} aria-controls={controla} {...gatilho} onClick={onClick}>
          <IconeDoLivro nome={icone} />
        </Botao>
      )}
    </Balao>
  )
}

/**
 * CONGELAR FICHA — os gestos de mesa no pé do Grupo: "Congelar todos"
 * enquanto alguma ficha de jogador está solta, "Descongelar todos" enquanto
 * alguma está congelada (os dois, quando só uma parte está). Ações de uma vez,
 * não interruptor.
 */
function CongelarAMesa({ todas, alguma, onChange }: NonNullable<PartySectionProps['congelar']>) {
  return (
    <div className="gr-acoes gr-grupo__pe">
      {!todas && (
        <Botao tamanho="p" title={`${CONGELAR_TODOS_LABEL}. ${CONGELAR_A_MESA_TITLE}`} onClick={() => onChange(true)}>
          <IconeDoLivro nome="floco" />
          {CONGELAR_TODOS_LABEL}
        </Botao>
      )}
      {alguma && (
        <Botao tamanho="p" className="gr-grupo__degelo" title={DESCONGELAR_TODOS_LABEL} onClick={() => onChange(false)}>
          <IconeDoLivro nome="degelo" />
          {DESCONGELAR_TODOS_LABEL}
        </Botao>
      )}
    </div>
  )
}

/** Expulsar: derruba alguém, então mora em "Sair da mesa". Desconectado não tem: não há conexão para derrubar. */
function Expulsar({ player, onKick }: { player: PlayerInfo; onKick(clientId: string): void }) {
  const clientId = player.clientId
  if (clientId === null) return null
  return (
    <Botao tamanho="p" variante="perigo" className="lb-player__kick" onClick={() => onKick(clientId)}>
      <IconeDoLivro nome="dispensar" />
      Expulsar
    </Botao>
  )
}

/** A letra da bola: a tinta escura sobre cor clara e a clara sobre cor escura, para ler sempre. */
function tintaSobre(cor: string): string {
  const hex = cor.startsWith('#') && cor.length === 7 ? cor.slice(1) : null
  if (hex === null) return '#101214'
  const canal = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255
  const luz = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4)
  return luz > 0.45 ? '#101214' : '#f3efe6'
}

/** A bola do jogador: a cor da ficha com a inicial; sem ficha no mapa, o anel vazio. */
function Bola({ nome, cor }: { nome: string; cor: string | null }) {
  const inicial = nome.trim().charAt(0).toUpperCase()
  return (
    <span className="gr-bola lb-grupo__avatar" aria-hidden="true" data-vazia={cor === null ? '' : undefined} style={cor === null ? undefined : { background: cor, color: tintaSobre(cor) }}>
      {inicial}
    </span>
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
    <div className="lb-field lb-player gr-chegando">
      <div className="gr-item">
        <Bola nome={player.name} cor={null} />
        <span className="gr-item__txt">
          <span className="gr-item__nome">
            <PlayerName player={player} />
          </span>
          <span className="gr-item__sub lb-player__status" aria-hidden="true">
            aguardando
          </span>
        </span>
      </div>
      <div className="gr-chegando__corpo">
        <TokenChips player={player} tokens={admin.tokens} onUnassign={admin.onUnassign} />
        <AssignControls player={player} tokens={admin.tokens} owners={admin.owners} onAssign={admin.onAssign} />
        {admin.onLend !== undefined && <HelperLoanControls player={player} tokens={admin.tokens} owners={admin.owners} onLend={admin.onLend} quiet />}
        <VisionFields player={player} onVisionRadiusChange={admin.onVisionRadiusChange} onVisionFactorChange={admin.onVisionFactorChange} />
        <div className="gr-acoes">
          <Expulsar player={player} onKick={admin.onKick} />
        </div>
      </div>
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
  /** "Ir lá" e "Recado", ao lado da linha. */
  rapidas: ReactNode
  /** O recado aberto e o aviso dele, logo abaixo da linha (com a ficha aberta ou não). */
  abaixo: ReactNode
  /** O conteúdo da ficha: só montado com ela aberta ou fechando. */
  ficha: () => ReactNode
  /** O botão da linha, para o foco voltar a ele quando a ficha fecha pelo teclado. */
  registrar(el: HTMLButtonElement | null): void
}

/**
 * Uma linha: a bola na cor da ficha (anel vazio = sem ficha no mapa), o nome
 * do jogador com o do personagem embaixo, os selos do que pede atenção e o
 * ponto de presença — tudo isso é o botão que abre a ficha. Do lado, as duas
 * ações rápidas. O "<nome> —" do leitor de tela (`PlayerName`) é também o
 * gancho das jornadas.
 */
function LinhaDoJogador({ linha, estado, instantaneo, now, seguindo, onAlternar, onFechar, rapidas, abaixo, ficha, registrar }: LinhaDoJogadorProps) {
  const { player, member, personagem } = linha
  const fichaId = `lb-grupo-ficha-${player.playerId}`
  const presenca = presencaNaLinha(player, member)
  const cor = member?.token?.color ?? null
  const aberta = estado === 'aberta'
  const selos = selosDa(linha, now, seguindo)
  const classe = ['lb-grupo__item', 'gr-jogador', aberta ? 'lb-grupo__item--aberta gr-e-aberto' : ''].filter(Boolean).join(' ')
  return (
    <li className={classe} data-presenca={presenca}>
      <div className="lb-field lb-player lb-grupo__jogador">
        <div className="gr-jogador__linha">
          <button
            ref={registrar}
            type="button"
            className="lb-grupo__linha gr-jogador__abrir"
            aria-expanded={aberta}
            aria-controls={aberta ? fichaId : undefined}
            onClick={(event) => onAlternar(event.detail === 0)}
            onKeyDown={(event) => {
              if (aberta) closeOnEscape(event, onFechar)
            }}
          >
            <Bola nome={player.name} cor={cor} />
            <span className="lb-grupo__nomes gr-item__txt">
              <span className="lb-grupo__nome gr-item__nome">
                <PlayerName player={player} />
              </span>
              <span className={personagem === null ? 'lb-grupo__personagem gr-item__sub lb-grupo__personagem--sem' : 'lb-grupo__personagem gr-item__sub'} title={personagem ?? undefined}>
                {personagem ?? SEM_PERSONAGEM_LABEL}
              </span>
            </span>
            {/* Os espaços em texto separam as partes no nome acessível ("Adaga, fora", não "Adagafora"). */}
            {selos.length > 0 && (
              <span className="gr-selos">
                {selos.map((selo) => (
                  <Fragment key={selo.chave}>
                    {' '}
                    <span className={`gr-selo gr-selo--${selo.tom}`} title={selo.texto}>
                      {selo.figura !== undefined && <span aria-hidden="true">{selo.figura}</span>}
                      {/* O congelado leva a classe de sempre: é por ela que o resto do app lê a marca. */}
                      <span className={selo.tom === 'gelo' ? 'lb-player__congelado' : undefined}>{selo.texto}</span>
                    </span>
                  </Fragment>
                ))}
              </span>
            )}
            {/* O estado da conexão já vai no nome ("— jogando · conectado"): o ponto é só para o olho. */}
            <span className="gr-ponto lb-grupo__presenca" data-presenca={presenca} aria-hidden="true" />
          </button>
          {rapidas}
        </div>
        {abaixo}
        {estado !== 'fechada' && (
          <div
            id={fichaId}
            className="lb-grupo__ficha gr-jogador__ficha"
            role="group"
            aria-label={`Ficha de ${player.name}`}
            data-estado={estado}
            data-instant={instantaneo ? '' : undefined}
            inert={estado === 'fechando'}
            onKeyDown={(event) => closeOnEscape(event, onFechar)}
          >
            <div className="gr-jogador__ficha-dentro">{ficha()}</div>
          </div>
        )}
      </div>
    </li>
  )
}

/** Um bloco da parte Ações: o título pequeno e os botões que quebram a linha. */
function BlocoDeAcoes({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="gr-jogador__bloco">
      <h4 className="gr-jogador__h">{titulo}</h4>
      <div className="gr-jogador__acoes">{children}</div>
    </div>
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
  /** "Dar o que o grupo viu" já ligado a ESTE jogador. Ausente = sem o botão. */
  onGiveGroupView?(): void
  groupViewFeedback: string | null
}

/** O que a parte Ações tem para este jogador; as quatro seções só aparecem com algo dentro. */
function AcoesDaFicha({ linha, party, admin, sendOpen, sendFormId, onToggleSend, onCloseSend, onGiveGroupView, groupViewFeedback }: FichaDoJogadorProps) {
  const { player, member } = linha
  const comFicha = member !== undefined && member.token !== null
  const seguir = comFicha && party?.onToggleFollow !== undefined
  const destinos = comFicha && party !== undefined ? sendDestinationsFor(member, party.destinations) : []
  const verTela = comFicha && party?.onViewScreen !== undefined
  // Só quem joga tem cena: quem aguarda não tem onde receber o que o grupo viu.
  const darOGrupo = onGiveGroupView !== undefined && player.status === 'playing'
  const temVer = verTela || darOGrupo || admin.onShareMap !== undefined || (admin.onGiveMap !== undefined && (admin.giftScenes?.length ?? 0) > 0)
  const dispensar = player.clientId === null && admin.onDismiss !== undefined
  return (
    <>
      {(seguir || destinos.length > 0) && member !== undefined && party !== undefined && (
        <BlocoDeAcoes titulo="Mover">
          {seguir && (
            // Ligado ganha o latão: um botão de modo, não uma ação de uma vez.
            <Botao tamanho="p" aria-pressed={party.followingId === member.playerId} onClick={() => party.onToggleFollow?.(member)}>
              <IconeDoLivro nome="seguir" />
              {FOLLOW_LABEL}
            </Botao>
          )}
          {destinos.length > 0 && (
            <Botao tamanho="p" aria-expanded={sendOpen} aria-controls={sendOpen ? sendFormId : undefined} onClick={(event) => onToggleSend(event.currentTarget)}>
              <IconeDoLivro nome="seta" />
              {SEND_TO_LABEL}
            </Botao>
          )}
          {sendOpen && comFicha && <PartySendForm member={member} party={party} formId={sendFormId} onClose={onCloseSend} />}
        </BlocoDeAcoes>
      )}
      {temVer && (
        <BlocoDeAcoes titulo="Ver">
          {/* Fora do ar também: a janela de teste parte da memória dele, não da conexão. */}
          {verTela && member !== undefined && (
            <Botao tamanho="p" aria-label={mirrorLabel(member.name)} title={`${mirrorLabel(member.name)}: abre a Visão de jogador nesta ficha`} onClick={() => party?.onViewScreen?.(member)}>
              <IconeDoLivro nome="monitor" />
              Ver tela
            </Botao>
          )}
          {darOGrupo && (
            <Botao tamanho="p" onClick={onGiveGroupView}>
              <IconeDoLivro nome="olho" />
              {GROUP_VIEW_LABEL}
            </Botao>
          )}
          {darOGrupo && groupViewFeedback !== null && (
            <p className="gr-nota" role="status">
              {groupViewFeedback}
            </p>
          )}
          {admin.onShareMap !== undefined && <ShareMapControls player={player} players={admin.roster} onShareMap={admin.onShareMap} />}
          {admin.onGiveMap !== undefined && admin.giftScenes !== undefined && admin.giftScenes.length > 0 && (
            <GiveMapControls player={player} scenes={admin.giftScenes} onGiveMap={admin.onGiveMap} />
          )}
        </BlocoDeAcoes>
      )}
      {(admin.onLend !== undefined || player.clientId === null) && (
        <BlocoDeAcoes titulo="Ficha">
          {admin.onLend !== undefined && <HelperLoanControls player={player} tokens={admin.tokens} owners={admin.owners} onLend={admin.onLend} />}
          {/* O "Dispensar" mora em "Sair da mesa": aqui fica o que acontece com as fichas de quem saiu. */}
          <AwayControls
            player={player}
            players={admin.roster}
            onStoreTokens={admin.onStoreTokens}
            onHandOver={admin.onHandOver}
            onLendTokens={admin.onLendTokens}
            onEndLoans={admin.onEndLoans}
          />
        </BlocoDeAcoes>
      )}
      {(player.clientId !== null || dispensar) && (
        <BlocoDeAcoes titulo="Sair da mesa">
          {dispensar && (
            <Botao tamanho="p" variante="fantasma" onClick={() => admin.onDismiss?.(player.playerId)}>
              <IconeDoLivro nome="dispensar" />
              Dispensar
            </Botao>
          )}
          <Expulsar player={player} onKick={admin.onKick} />
        </BlocoDeAcoes>
      )}
    </>
  )
}

/**
 * A ficha aberta: no topo o que pede o mestre (ficha longe, marca de destino,
 * empréstimo, encontro marcado), depois o seg Ações · Mochila · Visão · Ficha.
 * A parte escolhida vale para a próxima ficha.
 */
function FichaDoJogador(props: FichaDoJogadorProps) {
  const { linha, party, admin, aba, onAba } = props
  const { player, member } = linha
  const hintId = `lb-grupo-${player.playerId}-dica`
  const abas: AbaDaFicha[] = member === undefined ? ['acoes', 'visao', 'ficha'] : ['acoes', 'mochila', 'visao', 'ficha']
  const ativa = abas.includes(aba) ? aba : abas[0]
  return (
    <>
      {member !== undefined && <PartyAwayTokens member={member} onBring={party?.onBring} />}
      {member !== undefined && <PartyDestinationMark member={member} onViewDestination={party?.onViewDestination} />}
      {player.borrowedFrom !== undefined && <p className="gr-nota">Jogando também a ficha de {player.borrowedFrom.join(', ')}.</p>}
      {/* ENCONTRO MARCADO: o mestre não guarda de cabeça quem espera quem, onde e até quando. */}
      {player.waiting !== undefined && <p className="gr-nota">{textoDaEsperaParaOMestre(player.waiting)}</p>}
      <CampoSeg nomeAcessivel={`Parte da ficha de ${player.name}`} opcoes={abas.map((valor) => ({ valor, rotulo: ABA_ROTULO[valor] }))} valor={ativa} onChange={onAba} />
      <div className="gr-jogador__parte" data-parte={ativa}>
        {ativa === 'acoes' && <AcoesDaFicha {...props} />}
        {ativa === 'mochila' && member !== undefined && (
          <>
            <PartyStatus member={member} />
            {party !== undefined && partyBagVisible(member, party) && <PartyBag member={member} party={party} />}
          </>
        )}
        {ativa === 'visao' && (
          <>
            <VisionFields player={player} onVisionRadiusChange={admin.onVisionRadiusChange} onVisionFactorChange={admin.onVisionFactorChange} />
            <div className="gr-acoes">
              <Botao tamanho="p" aria-describedby={hintId} onClick={() => admin.onRevealPlan(player.playerId)}>
                <IconeDoLivro nome="olho" />
                Revelar planta
              </Botao>
              <Botao tamanho="p" onClick={() => admin.onHidePlan(player.playerId)}>
                <IconeDoLivro nome="olhoFechado" />
                Esconder de novo
              </Botao>
            </div>
            <p id={hintId} className="gr-nota">
              {PLAN_HINT}
            </p>
          </>
        )}
        {ativa === 'ficha' && (
          <>
            <TokenChips player={player} tokens={admin.tokens} onUnassign={admin.onUnassign} />
            <AssignControls player={player} tokens={admin.tokens} owners={admin.owners} onAssign={admin.onAssign} />
          </>
        )}
      </div>
    </>
  )
}

/** Os botões de cada tipo de pedido: os mesmos do aviso flutuante, para o mestre não aprender duas vezes. */
const RESPOSTAS_DA_PASSAGEM: Record<PassagemNoPainel['tipo'], { sim: string; nao: string }> = {
  comum: { sim: 'Deixar ir', nao: 'Não' },
  trancada: { sim: 'Liberar uma vez', nao: 'Não' },
  barrada: { sim: 'Passa (quebra a barra)', nao: 'A barra aguenta' },
}

/**
 * O pedido de passagem de quem está nesta cena, logo abaixo do título dela:
 * quem quer ir, para onde, e as duas respostas. O nome acessível das
 * respostas leva o nome do jogador ("Deixar ir: Ana"): o aviso flutuante tem
 * os mesmos botões, e os dois juntos não podem se confundir. Sem o detalhe do
 * pedido (ou sem como responder daqui), só a frase que manda ao aviso.
 */
function PedidoDePassagem({ player, onAnswer }: { player: PlayerInfo; onAnswer?(requestId: string, allow: boolean): void }) {
  const pedido = player.travelRequest
  if (pedido === undefined || onAnswer === undefined) {
    return (
      <div className="gr-pedido lb-grupo__pendencia">
        <p>
          <b>{player.name}</b> pediu passagem: responda no aviso.
        </p>
      </div>
    )
  }
  const respostas = RESPOSTAS_DA_PASSAGEM[pedido.tipo]
  return (
    <div className="gr-pedido" role="group" aria-label={`Pedido de passagem de ${player.name}`}>
      <p>
        <b>{player.name}</b> pede passagem para {pedido.toSceneName}.{pedido.tipo === 'barrada' && <span className="gr-pedido__nota"> Barrada do outro lado.</span>}
      </p>
      <div className="gr-acoes">
        <Botao tamanho="p" variante="primario" aria-label={`${respostas.sim}: ${player.name}`} onClick={() => onAnswer(pedido.requestId, true)}>
          {respostas.sim}
        </Botao>
        <Botao tamanho="p" variante={pedido.tipo === 'barrada' ? 'fantasma' : undefined} aria-label={`${respostas.nao}: ${player.name}`} onClick={() => onAnswer(pedido.requestId, false)}>
          {respostas.nao}
        </Botao>
      </div>
    </div>
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
  onAnswerTravel?(requestId: string, allow: boolean): void
  children: ReactNode
}

function quantos(n: number): string {
  return n === 1 ? '1 jogador' : `${n} jogadores`
}

/**
 * Um grupo por cena: o título recolhível (nome e quantos) e os atalhos de
 * cena — Ir à cena, Congelar a cena (vira Descongelar com todas congeladas)
 * e Pausar a cena. Sem cena de aventura (mapa solto), só o congelar: não há
 * cena para abrir nem para pausar. Os pedidos de passagem de quem está ali
 * vêm logo abaixo do título.
 */
function CenaDoGrupo({ grupo, noEditor, recolhida, instantanea, onRecolher, pausada, onIrACena, onCongelarCena, onPausarCena, onAnswerTravel, children }: CenaDoGrupoProps) {
  const tituloId = useId()
  const corpoId = useId()
  const { sceneId, nome, linhas } = grupo
  const fichas = fichasDaCena(linhas)
  const congelada = cenaCongelada(linhas)
  const pedindo = linhas.filter(({ player, member }) => member?.travelPending === true || player.travelPending === true)
  return (
    <section className="lb-grupo__cena gr-grupo-cena" aria-labelledby={tituloId} data-recolhida={recolhida ? '' : undefined}>
      <div className="gr-grupo-cena__cab">
        <button
          type="button"
          className="lb-grupo__cena-alterna gr-grupo-cena__alterna"
          aria-expanded={!recolhida}
          aria-controls={corpoId}
          data-instant={instantanea ? '' : undefined}
          onClick={(event) => onRecolher(event.detail === 0)}
        >
          <span id={tituloId} className="lb-grupo__cena-nome gr-grupo-cena__nome" title={nome}>
            {nome}
          </span>
          <small className="gr-grupo-cena__conta" aria-hidden="true">
            {linhas.length}
          </small>
          <span className="lb-sr-only">{`, ${quantos(linhas.length)}`}</span>
          {/* "No editor" vira o pontinho de latão: o nome da cena, que é o que se lê, fica com a largura. */}
          {noEditor && (
            <span className="gr-grupo-cena__aqui" title="Aberta no editor">
              <span className="lb-sr-only">, no editor</span>
            </span>
          )}
          <svg className="gr-grupo-cena__seta" aria-hidden="true" focusable="false" viewBox="0 0 16 16">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
        {sceneId !== null && onIrACena !== undefined && <BotaoDeIcone balao="Ir à cena" nome={`Ir à cena ${nome}`} icone="seta" onClick={() => onIrACena(sceneId)} />}
        {onCongelarCena !== undefined && fichas.length > 0 && (
          <BotaoDeIcone
            balao={congelada ? 'Descongelar a cena' : `Congelar a cena. ${CONGELAR_A_MESA_TITLE}`}
            nome={congelada ? `Descongelar a cena ${nome}` : `Congelar a cena ${nome}`}
            icone={congelada ? 'degelo' : 'floco'}
            onClick={() => onCongelarCena(fichas, !congelada)}
          />
        )}
        {sceneId !== null && onPausarCena !== undefined && (
          <BotaoDeIcone balao={pausada ? 'Retomar a cena' : 'Pausar a cena'} nome={`Pausar a cena ${nome}`} icone="pausa" pressionado={pausada} onClick={() => onPausarCena(sceneId, !pausada)} />
        )}
      </div>
      <div id={corpoId} className="lb-grupo__cena-corpo gr-grupo-cena__corpo" data-instant={instantanea ? '' : undefined} inert={recolhida}>
        <div className="gr-grupo-cena__dentro">
          {pedindo.map(({ player }) => (
            <PedidoDePassagem key={player.playerId} player={player} onAnswer={onAnswerTravel} />
          ))}
          <ul className="lb-grupo__lista gr-lista">{children}</ul>
        </div>
      </div>
    </section>
  )
}

/** A chave de uma cena no conjunto das recolhidas: o mapa solto é ''. */
const chaveDaCena = (sceneId: string | null): string => sceneId ?? ''

/**
 * O Grupo: a mesa inteira, por cena. No topo, a busca por jogador ou
 * personagem e o "Pedindo N" (só quem pede algo). Quem espera personagem vem
 * primeiro, em "Chegando", aberto; depois a cena aberta no editor e as outras
 * na ordem da lista Cenas; no pé, o congelar da mesa.
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
  onAnswerTravel,
  ...rest
}: GrupoCompactoProps) {
  const headingId = useId()
  const chegandoId = useId()
  const sendFormId = useId()
  const noteFormId = useId()
  const [busca, setBusca] = useState('')
  const [soPedindo, setSoPedindo] = useState(false)
  const [aba, setAba] = useState<AbaDaFicha>('acoes')
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
  // cena já com a ficha aberta na parte Ficha — o mestre vê o que atribuiu (e
  // o "Remover") sem procurar a linha nova entre as outras.
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

  /** "Ir lá" e "Recado" da linha: o primeiro só com ficha no mapa; o recado chega quando o mapa dele aparecer. */
  const rapidasDe = (member: PartyMember | undefined) => {
    if (member === undefined || party === undefined) return null
    const id = member.playerId
    const recadoAberto = send.notingId === id
    return (
      <div className="gr-jogador__rapidas">
        {member.token !== null && <BotaoDeIcone balao="Ir lá" nome={`Ir lá: ${member.name}`} icone="mira" onClick={() => party.onGoTo(member)} />}
        {party.onNote !== undefined && (
          // Montado também com o campo aberto: é para ele que o foco volta.
          <BotaoDeIcone
            balao="Recado: só este jogador lê"
            nome={`${NOTE_LABEL} para ${member.name}`}
            icone="carta"
            expandido={recadoAberto}
            controla={recadoAberto ? noteFormId : undefined}
            onClick={(event) => {
              note.clear()
              send.toggle(id, event.currentTarget, 'note')
            }}
          />
        )}
      </div>
    )
  }

  const abaixoDe = ({ player, member }: LinhaDoGrupo) => {
    const id = player.playerId
    const onNote = party?.onNote
    const recado = member !== undefined && onNote !== undefined && send.notingId === id ? member : null
    const aviso = note.feedback?.playerId === id ? note.feedback.text : null
    if (recado === null && aviso === null) return null
    return (
      <div className="gr-jogador__recado">
        {recado !== null && onNote !== undefined && (
          <PartyNoteForm
            member={recado}
            formId={noteFormId}
            onSend={(text) => {
              const delivery = onNote(id, text) ?? null
              note.show(id, playerNoteFeedbackText(player.name, delivery))
              send.close()
            }}
            onCancel={send.close}
          />
        )}
        {aviso !== null && (
          <p className="lb-party__recado-aviso gr-nota" role="status">
            {aviso}
          </p>
        )}
      </div>
    )
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
        onGiveGroupView={
          onGiveGroupView === undefined ? undefined : () => groupView.show(id, groupViewFeedbackText(player.name, onGiveGroupView(id) ?? null))
        }
        groupViewFeedback={groupView.feedback?.playerId === id ? groupView.feedback.text : null}
      />
    )
  }

  const vazio = players.length > 0 && chegando.length === 0 && grupos.length === 0

  return (
    <section className="lb-party lb-grupo gr-grupo" aria-labelledby={headingId}>
      {/* O marcador Grupo da lombada já diz onde se está: o título fica para o leitor de tela. */}
      <div className="lb-sr-only">
        <h3 id={headingId}>Grupo</h3>
        {players.length > 0 && <span className={esperando > 0 ? 'lb-party__count lb-party__count--waiting' : 'lb-party__count'}>{groupCountLabel(players.length, esperando)}</span>}
      </div>
      {players.length === 0 && (
        <div className="gr-vazio">
          <p>{EMPTY_GROUP_HINT}</p>
        </div>
      )}
      {players.length > 0 && (
        <div className="gr-linha gr-grupo__topo">
          <div className="gr-busca">
            <IconeDoLivro nome="busca" />
            <input
              type="search"
              className="gr-entrada lb-grupo__busca"
              aria-label={BUSCA_LABEL}
              // Curto à vista: na coluna de 264 px "Buscar jogador" cortava no meio.
              placeholder="Buscar"
              autoComplete="off"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              onKeyDown={(event) => {
                // Esc limpa a busca e para aqui; vazia, segue o caminho de sempre.
                if (busca !== '') closeOnEscape(event, () => setBusca(''))
              }}
            />
          </div>
          <button
            type="button"
            className="gr-chip lb-grupo__pedindo"
            aria-pressed={soPedindo}
            disabled={pedindo === 0 && !soPedindo}
            title="Só quem pede algo: passagem, ficha longe ou personagem"
            onClick={() => setSoPedindo((atual) => !atual)}
          >
            {PEDINDO_LABEL} <span className="lb-num">{pedindo}</span>
          </button>
        </div>
      )}
      {chegando.length > 0 && (
        <section className="lb-grupo__chegando gr-grupo-cena" aria-labelledby={chegandoId}>
          <div className="gr-grupo-cena__cab">
            <h4 id={chegandoId} className="gr-grupo-cena__nome">
              {CHEGANDO_LABEL}
            </h4>
            <small className="gr-grupo-cena__conta">sem ficha</small>
          </div>
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
          onAnswerTravel={onAnswerTravel}
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
                rapidas={rapidasDe(linha.member)}
                abaixo={abaixoDe(linha)}
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
        <p className="gr-nota" role="status">
          {soPedindo && busca.trim() === '' ? NINGUEM_PEDINDO : NINGUEM_ACHADO}
        </p>
      )}
      {players.length > 0 && party?.congelar !== undefined && <CongelarAMesa {...party.congelar} />}
    </section>
  )
}
