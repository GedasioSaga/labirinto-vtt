import { Fragment, useId, useRef, useState, type ReactElement } from 'react'
import type { DoorState, Drawing, FloorPiece, Light, MapData, PinKind, Prop, Region, Stair, TipoMobilia, Token, Wall } from '../../types/map'
import { ROTULO_MOBILIA } from '../../lib/mobilia'
import { PISO_MAX, PISO_MIN, nomeDoPiso } from '../../lib/pisos'
import { salasDaPorta } from '../../lib/mapObjects'
import { findContainingRoom } from '../../lib/roomNesting'
import type { MotivoSemCorredor, bloqueioDaSala } from '../../lib/abrirCorredor'
import { TOKEN_COLOR_DEFAULT } from '../../lib/tokenColor'
import { selectBloqueioParaAbrir, selectCorredoresParaAbrir, selectMotivoSemCorredor, useMapStore } from '../../stores/mapStore'
import type { SelectionSummary } from '../SelectionControls'
import { MOTIVO_SALA_SECRETA_SEM_VAO, MOTIVO_SALA_TRAVADA_SEM_VAO, MOTIVO_SEM_CORREDOR, deleteSelectionLabel, rotuloAbrirParaOCorredor } from '../labels'
import { iniciaisDaFicha } from '../EscolherFichaDeTeste'
import { BrushIcon, DoorIcon, FloorIcon, LightIcon, MobiliaIcon, PropIcon, RegionIcon, RoomIcon, StairIcon, TextIcon, TokenIcon, WallIcon } from '../icons'
import { Balao } from '../grimorio/Balao'
import { Botao } from '../grimorio/Botao'
import { Cabeca, CabecaMedalha, CabecaRetrato } from '../grimorio/Cabeca'
import { MenuItem, MenuNota, MenuSeparador, Pop } from '../grimorio/Pop'
import { IconeDoLivro, type NomeDoIcone } from './icones'
import { MedalhaDaPorta, type MedalhaDaPortaProps } from './MedalhaDaPorta'
import './fichaDaSelecao.css'

/** De que tipo é o que está selecionado — decide o ícone da medalha. */
export type SelectionIconKind =
  | 'room'
  | 'region'
  | 'token'
  | 'wall'
  | 'door'
  | 'light'
  | 'stair'
  | 'prop'
  | 'mobilia'
  | 'text'
  | 'drawing'
  | 'floor'
  | 'pin'
  | 'several'

/** O que a cabeça diz da seleção. */
export type SelectionIdentity = IdentidadeComum | IdentidadeDeMovel | IdentidadeDoPino

interface IdentidadeBase {
  /** O tipo, com o nome do botão da ferramenta que cria a coisa ("Sala", "Porta", "Token"). */
  type: string
  /** O nome do item, quando ele tem um; `null` = a cabeça diz só o tipo. */
  name: string | null
}

interface IdentidadeComum extends IdentidadeBase {
  icon: Exclude<SelectionIconKind, 'mobilia' | 'pin'>
}

/** Móvel desenhado: a medalha leva o desenho DAQUELE móvel, o mesmo da setinha da ferramenta Objeto. */
interface IdentidadeDeMovel extends IdentidadeBase {
  icon: 'mobilia'
  mobilia: TipoMobilia
}

/** Pino (fatia 12): a medalha leva o ícone do tipo, o mesmo "!", "?", viagem ou alavanca do seletor. */
interface IdentidadeDoPino extends IdentidadeBase {
  icon: 'pin'
  pinKind: PinKind
}

/** Os itens que o painel já recebe; com UM item selecionado, só um deles não é `null`. */
export interface SelectedItems {
  region: Region | null
  token: Token | null
  wall: Wall | null
  prop: Prop | null
  light: Light | null
  stair: Stair | null
  textLabel: Extract<Drawing, { kind: 'text' }> | null
  floorPiece: FloorPiece | null
}

/** Texto vazio (sala sem nome, rótulo em branco) não é nome: a cabeça cai no tipo. */
function nameOrNull(text: string | undefined): string | null {
  const trimmed = text?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

/**
 * Tipo e nome da seleção. O tipo repete o rótulo do botão da barra que cria a
 * coisa: quem desenhou com "Sala" lê "Sala", não "Região". Vários itens não
 * têm um tipo só, então a cabeça conta quantos são.
 */
export function selectionIdentity(summary: SelectionSummary, items: SelectedItems): SelectionIdentity {
  if (summary.count > 1) return { icon: 'several', type: 'Seleção', name: `${summary.count} itens` }
  switch (summary.kind) {
    case 'region': {
      const room = items.region?.room
      if (room !== undefined) return { icon: 'room', type: 'Sala', name: nameOrNull(room.name) }
      return { icon: 'region', type: 'Região', name: null }
    }
    case 'token':
      return { icon: 'token', type: 'Token', name: nameOrNull(items.token?.name) }
    case 'wall':
      return items.wall?.door ? { icon: 'door', type: 'Porta', name: null } : { icon: 'wall', type: 'Parede', name: null }
    case 'light':
      return { icon: 'light', type: 'Luz', name: null }
    case 'stair':
      return { icon: 'stair', type: 'Escada', name: null }
    case 'prop': {
      const mobilia = items.prop?.mobilia
      if (mobilia !== undefined) return { icon: 'mobilia', type: ROTULO_MOBILIA[mobilia], name: null, mobilia }
      return { icon: 'prop', type: 'Peça', name: null }
    }
    case 'drawing':
      // Rótulo de texto se chama pelo que diz; a primeira linha basta para achar.
      return items.textLabel !== null
        ? { icon: 'text', type: 'Texto', name: nameOrNull(items.textLabel.text.split('\n')[0]) }
        : { icon: 'drawing', type: 'Desenho', name: null }
    case 'floor':
      return { icon: 'floor', type: 'Peça de chão', name: null }
  }
}

/**
 * Nome do botão Apagar — o MESMO de antes, letra por letra: os testes e2e o
 * procuram pelo nome e pelo texto (`toHaveText('Apagar parede selecionada')`).
 */
export function deleteLabelFor(summary: SelectionSummary): string {
  return summary.count === 1 ? deleteSelectionLabel(summary.kind) : `Apagar ${summary.count} itens selecionados`
}

/** O título de cada tipo de pino, o mesmo de antes: as jornadas acham a ficha por ele. */
export const TITULO_DO_PINO: Record<PinKind, string> = {
  exclamacao: 'Ponto de interesse',
  interrogacao: 'Ponto de interesse',
  viagem: 'Pino de viagem',
  alavanca: 'Alavanca',
  minigame: 'Minigame',
}

/** O Excluir do pino, letra por letra o botão de antes (os testes e2e o procuram pelo nome). */
export const EXCLUIR_PINO: Record<PinKind, string> = {
  exclamacao: 'Excluir ponto de interesse',
  interrogacao: 'Excluir ponto de interesse',
  viagem: 'Excluir pino de viagem',
  alavanca: 'Excluir alavanca',
  minigame: 'Excluir minigame',
}

/**
 * PINO SELECIONADO (fatia 12): ele não entra no resumo `selection.selection`,
 * então a identidade sai do próprio pino — o tipo pelo título, e o nome do local.
 */
export function pinIdentity(kind: PinKind, nome: string): SelectionIdentity {
  return { icon: 'pin', type: TITULO_DO_PINO[kind], name: nameOrNull(nome), pinKind: kind }
}

/** O ícone de cada tipo de pino, na medalha da cabeça e no Tipo da ficha (o minigame não está no protótipo: fica o "play"). */
export const ICONE_DO_PINO: Record<PinKind, NomeDoIcone> = {
  exclamacao: 'exclamacao',
  interrogacao: 'interrogacao',
  viagem: 'viagem',
  alavanca: 'alavanca',
  minigame: 'play',
}

/** Um item do menu "Mais ações". */
export interface SelectionAction {
  /** Texto do item e o nome acessível dele ("Levar ao 1º piso"). */
  label: string
  onSelect: () => void
  /** Presente = o item fica no lugar, apagado, e diz por que não age agora. */
  disabledReason?: string
  /** Tecla desenhada à direita, a que faz o mesmo sem abrir o menu ("Alt"). */
  atalho?: string
  /** O que o item faz, na linha de baixo. Com `disabledReason`, o motivo vence. */
  detalhe?: string
  icone?: NomeDoIcone
  /** Itens do mesmo assunto ficam juntos; um fio separa um assunto do seguinte. */
  grupo: string
  /** A nota do pé do menu também explica este item (a frase do "Levar ao piso"). */
  explicadoPelaNota?: boolean
}

/**
 * PISOS NA MESMA CENA — "Levar ao piso" da seleção inteira, um piso acima e um
 * abaixo do piso em edição. Na ponta da faixa de pisos o item continua no
 * menu, apagado, com o motivo: o mestre aprende onde ele mora.
 */
export function floorActions(pisoAtivo: number, onLevar: (piso: number) => void): SelectionAction[] {
  const acima = pisoAtivo + 1
  const abaixo = pisoAtivo - 1
  return [
    {
      label: `Levar ao ${nomeDoPiso(acima)}`,
      onSelect: () => onLevar(acima),
      disabledReason: acima > PISO_MAX ? 'Não há piso acima deste.' : undefined,
      icone: 'cenas',
      grupo: 'piso',
      explicadoPelaNota: true,
    },
    {
      label: `Levar ao ${nomeDoPiso(abaixo)}`,
      onSelect: () => onLevar(abaixo),
      disabledReason: abaixo < PISO_MIN ? 'Não há subsolo abaixo deste.' : undefined,
      icone: 'cenas',
      grupo: 'piso',
      explicadoPelaNota: true,
    },
  ]
}

/**
 * ENDIREITAR (pedido 5): o clique faz o mesmo que tocar o Alt, num passo só de
 * Ctrl+Z. Quem monta só o põe no menu quando o clique mudaria alguma coisa
 * (`selectEndireitarMudaria`): Linha, Parede solta ou Caminho tortos.
 */
export function endireitarAction(onEndireitar: () => void): SelectionAction {
  return { label: 'Endireitar', onSelect: onEndireitar, atalho: 'Alt', detalhe: 'Sem mudar o tamanho', icone: 'regua', grupo: 'forma' }
}

/**
 * PORTA SELECIONADA (fatia 11): "Abrir agora"/"Fechar agora" e
 * "Trancar"/"Destrancar" com o rótulo do que o clique FAZ, e "Virar parede
 * sólida", que muda a forma do item (outro assunto, depois do fio). Os mesmos
 * handlers do bloco essencial da ficha: trancar fecha e abrir destranca.
 */
export function doorActions(
  porta: Pick<DoorState, 'open' | 'locked'>,
  handlers: { onToggleOpen: () => void; onToggleLocked: () => void; onToggleDoor: () => void },
): SelectionAction[] {
  return [
    { label: porta.open ? 'Fechar agora' : 'Abrir agora', onSelect: handlers.onToggleOpen, icone: 'porta', grupo: 'porta' },
    { label: porta.locked ? 'Destrancar' : 'Trancar', onSelect: handlers.onToggleLocked, icone: 'cadeado', grupo: 'porta' },
    { label: 'Virar parede sólida', onSelect: handlers.onToggleDoor, icone: 'parede', grupo: 'forma' },
  ]
}

/** O que a store diz do "Abrir para o corredor" da Sala selecionada. */
export interface ContaDoCorredor {
  /** Corredores (par de linhas) que o clique abre. */
  corredores: number
  /** Sala secreta ou travada: o item fica apagado, com o motivo. */
  bloqueio: ReturnType<typeof bloqueioDaSala>
  /** Parede encostando sem formar corredor: o que acertar no desenho. */
  semCorredor: MotivoSemCorredor | null
}

/** A frase do item apagado, por bloqueio da Sala. `Record`: bloqueio novo em `lib/abrirCorredor.ts` sem frase aqui não compila. */
const MOTIVO_SEM_VAO: Record<NonNullable<ReturnType<typeof bloqueioDaSala>>, string> = {
  secreta: MOTIVO_SALA_SECRETA_SEM_VAO,
  travada: MOTIVO_SALA_TRAVADA_SEM_VAO,
}

/** Por que o clique não abriria nada agora. Sem corredor vale o motivo do desenho: enquanto ele não muda, destravar a Sala não abriria nada. */
function motivoParaNaoAbrir({ corredores, bloqueio, semCorredor }: ContaDoCorredor): string | undefined {
  if (corredores === 0) return semCorredor === null ? undefined : MOTIVO_SEM_CORREDOR[semCorredor]
  return bloqueio === null ? undefined : MOTIVO_SEM_VAO[bloqueio]
}

/** O item só entra no menu com corredor a abrir, ou com parede encostando que não forma corredor (aí apagado, com o motivo). */
function mostraAbrirCorredor({ corredores, semCorredor }: Pick<ContaDoCorredor, 'corredores' | 'semCorredor'>): boolean {
  return corredores > 0 || semCorredor !== null
}

/**
 * ABRIR PARA O CORREDOR (pedido 4 de 30/09/2026; no "Mais ações" desde a fatia
 * 15): a parede da Sala abre entre as duas linhas de cada corredor que encosta
 * nela e as linhas param na borda, num passo só de Ctrl+Z
 * (`mapStore.abrirSalaParaCorredores`). Sala secreta ou travada, ou parede
 * encostando que não forma corredor: o item fica no lugar, apagado, com o
 * motivo. Porta ou parede travada no caminho só aparecem no clique, que recusa
 * e diz por quê.
 */
export function abrirCorredorAction(conta: ContaDoCorredor, onAbrir: () => void): SelectionAction {
  return {
    label: rotuloAbrirParaOCorredor(conta.corredores),
    onSelect: onAbrir,
    disabledReason: motivoParaNaoAbrir(conta),
    icone: 'porta',
    grupo: 'forma',
  }
}

/**
 * O item "Abrir para o corredor" da Sala `salaId`, ou `null` sem nada a mostrar
 * (sem Sala, ou nada encostando nela). A conta e o motivo vêm da store e mudam
 * quando o mestre desenha ou mexe numa linha com a ficha aberta, sem passar
 * pelo App.
 */
export function useAcaoAbrirCorredor(salaId: string | null): SelectionAction | null {
  const corredores = useMapStore((state) => (salaId === null ? 0 : selectCorredoresParaAbrir(state, salaId)))
  const bloqueio = useMapStore((state) => (salaId === null ? null : selectBloqueioParaAbrir(state, salaId)))
  const semCorredor = useMapStore((state) => (salaId === null ? null : selectMotivoSemCorredor(state, salaId)))
  const abrirSalaParaCorredores = useMapStore((state) => state.abrirSalaParaCorredores)
  const conta = { corredores, bloqueio, semCorredor }
  if (salaId === null || !mostraAbrirCorredor(conta)) return null
  return abrirCorredorAction(conta, () => abrirSalaParaCorredores(salaId))
}

/** As salas de uma porta ligadas por '↔' ("Cais do Porto ↔ corredor", a linha do protótipo); vazio para o resto. */
export function ondeDaPorta(map: MapData, paredeId: string): string {
  return salasDaPorta(map, paredeId).join(' ↔ ')
}

/** `ondeDaPorta` na cena aberta; vazio sem porta selecionada. */
export function useOndeDaPorta(paredeId: string | null): string {
  return useMapStore((state) => (paredeId === null ? '' : ondeDaPorta(state.map, paredeId)))
}

/** A Sala com nome onde o pino está ("Cais do Porto", o local do protótipo); vazio fora de sala ou para id que não existe. */
export function ondeDoPino(map: MapData, pinId: string): string {
  const pino = map.pins.find((p) => p.id === pinId)
  if (pino === undefined) return ''
  return findContainingRoom(map.regions, [{ x: pino.x, y: pino.y }])?.room?.name.trim() ?? ''
}

/** `ondeDoPino` na cena aberta; vazio sem pino aberto. */
export function useOndeDoPino(pinId: string | null): string {
  return useMapStore((state) => (pinId === null ? '' : ondeDoPino(state.map, pinId)))
}

/** A cor do disco de um token sem cor própria: a mesma do mapa. */
const COR_DO_TOKEN_PADRAO = `#${TOKEN_COLOR_DEFAULT.toString(16).padStart(6, '0')}`
const MAIS_ACOES = 'Mais ações'
/** A tecla de "Apagar a seleção", com o nome que a tela de atalhos usa (`shortcutSheet.ts`). */
const TECLA_DE_APAGAR = 'Delete'

export interface CabecaDaSelecaoProps {
  identidade: SelectionIdentity
  /** Token selecionado: o retrato na cor dele, com as iniciais, no lugar da medalha. */
  token?: Pick<Token, 'name' | 'color'> | null
  /** Porta selecionada: a medalha mostra a folha, que gira quando ela abre ou fecha. */
  porta?: MedalhaDaPortaProps['porta'] | null
  /** Onde o item está (as salas de uma porta), depois do tipo. */
  onde?: string
  /** Nome acessível (e texto) do Apagar: `deleteLabelFor`. */
  rotuloApagar: string
  onApagar: () => void
  /** Itens do "Mais ações", por assunto. Vazio = o botão não aparece (menu sem ação é controle falso). */
  acoes: readonly SelectionAction[]
  /** Frase no pé do menu, ligada aos itens com `explicadoPelaNota`. */
  notaDasAcoes: string | null
}

/**
 * CABEÇA DA FICHA da seleção (fatia 8 do design consolidado, o `.cabeca` do
 * protótipo): retrato do token ou medalha de latão com o ícone do tipo, o nome
 * em serifa, o tipo (e onde) embaixo, e à direita Apagar (Del) e "Mais ações",
 * o menu das ações raras de cada tipo ("Levar ao piso", "Endireitar").
 *
 * O nome não é título (`h2`) de propósito: o primeiro título da página
 * continua sendo o do item ("Sala", "Ficha"), que as jornadas leem. A cabeça
 * é a barra das ações (`toolbar`) descrita pelo nome: os botões ficam na
 * ordem do Tab, e as setas continuam sendo atalho do mapa.
 */
export function CabecaDaSelecao({ identidade, token, porta, onde, rotuloApagar, onApagar, acoes, notaDasAcoes }: CabecaDaSelecaoProps) {
  const [menuAberto, setMenuAberto] = useState(false)
  const gatilho = useRef<HTMLButtonElement | null>(null)
  const notaId = useId()
  const nome = identidade.name ?? identidade.type
  const marca =
    token !== undefined && token !== null ? (
      <CabecaRetrato cor={token.color ?? COR_DO_TOKEN_PADRAO} iniciais={iniciaisDaFicha(nome)} />
    ) : (
      <CabecaMedalha>{porta !== undefined && porta !== null ? <MedalhaDaPorta porta={porta} /> : iconeDoTipo(identidade)}</CabecaMedalha>
    )
  return (
    <div className="lb-cabeca-da-selecao">
      <Cabeca
        marca={marca}
        nome={nome}
        tipo={identidade.name === null ? undefined : identidade.type}
        onde={onde === '' ? undefined : onde}
        rotuloDasAcoes="Ações da seleção"
        acoes={
          <>
            <Balao texto={rotuloApagar} atalho="Del">
              {(propsDoBalao) => (
                <Botao soIcone aria-label={rotuloApagar} aria-keyshortcuts={TECLA_DE_APAGAR} {...propsDoBalao} onClick={onApagar}>
                  <IconeDoLivro nome="lixo" />
                  {/* O texto do botão, para quem lê pelo texto (`toHaveText`); a vista tem só o ícone. */}
                  <span className="gr-sr">{rotuloApagar}</span>
                </Botao>
              )}
            </Balao>
            {acoes.length > 0 && (
              <Balao texto={MAIS_ACOES}>
                {(propsDoBalao) => (
                  <Botao
                    soIcone
                    aria-label={MAIS_ACOES}
                    aria-haspopup="menu"
                    aria-expanded={menuAberto}
                    {...propsDoBalao}
                    ref={(no) => {
                      propsDoBalao.ref(no)
                      gatilho.current = no
                    }}
                    onClick={() => setMenuAberto((aberto) => !aberto)}
                  >
                    <IconeDoLivro nome="reticencias" />
                  </Botao>
                )}
              </Balao>
            )}
          </>
        }
      />
      {acoes.length > 0 && (
        <Pop aberto={menuAberto} gatilho={gatilho} onFechar={() => setMenuAberto(false)} rotulo={MAIS_ACOES}>
          {acoes.map((acao, indice) => (
            <Fragment key={acao.label}>
              {indice > 0 && acoes[indice - 1]?.grupo !== acao.grupo && <MenuSeparador />}
              <MenuItem
                icone={acao.icone === undefined ? undefined : <IconeDoLivro nome={acao.icone} />}
                atalho={acao.atalho}
                detalhe={acao.disabledReason ?? acao.detalhe}
                disabled={acao.disabledReason !== undefined}
                descritoPor={acao.explicadoPelaNota === true && notaDasAcoes !== null ? notaId : undefined}
                onClick={acao.onSelect}
              >
                {acao.label}
              </MenuItem>
            </Fragment>
          ))}
          {notaDasAcoes !== null && <MenuNota id={notaId}>{notaDasAcoes}</MenuNota>}
        </Pop>
      )}
    </div>
  )
}

/** O desenho da medalha: o mesmo do botão da ferramenta que cria a coisa (do móvel, o da setinha). */
function iconeDoTipo(identidade: SelectionIdentity): ReactElement {
  switch (identidade.icon) {
    case 'room':
      return <RoomIcon />
    case 'region':
      return <RegionIcon />
    case 'token':
      return <TokenIcon />
    case 'wall':
      return <WallIcon />
    case 'door':
      return <DoorIcon />
    case 'light':
      return <LightIcon />
    case 'stair':
      return <StairIcon />
    case 'prop':
      return <PropIcon />
    case 'mobilia':
      return <MobiliaIcon tipo={identidade.mobilia} />
    case 'text':
      return <TextIcon />
    case 'drawing':
      return <BrushIcon />
    case 'floor':
      return <FloorIcon />
    case 'pin':
      return <IconeDoLivro nome={ICONE_DO_PINO[identidade.pinKind]} />
    case 'several':
      return <VariosIcon />
  }
}

/** Vários itens: duas folhas, uma atrás da outra (traço da família de `icons.tsx`). */
function VariosIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="4" y="8.5" width="11.5" height="11.5" rx="1.5" />
      <path d="M8.5 8.5V5.5c0-.6.4-1 1-1h9c.6 0 1 .4 1 1v9c0 .6-.4 1-1 1h-3" />
    </svg>
  )
}
