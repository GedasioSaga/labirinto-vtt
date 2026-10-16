import type { DrawingTool } from '../types/tools'
import type { Drawing, FloorPiece, Light, Prop, Region, Stair, Token, Wall } from '../types/map'
import { DrawingStyleControls, type DrawingStyleControlsProps } from './DrawingStyleControls'
import { PathStyleControls, type PathStyleControlsProps } from './PathStyleControls'
import type { GridControlsProps } from './GridControls'
import { CollapsibleSection } from './CollapsibleSection'
import type { TokenPersonagemControlsProps } from './TokenPersonagemControls'
import { PropLayerControls, type PropLayerControlsProps } from './PropLayerControls'
import { PropPlayerControls, type PropPlayerControlsProps } from './PropPlayerControls'
import { SelectionControls, type SelectionControlsProps } from './SelectionControls'
import { CabecaDaSelecao, deleteLabelFor, endireitarAction, floorActions, selectionIdentity, useOndeDaPorta } from './livro/CabecaDaSelecao'
import { Essencial } from './grimorio/Cartoes'
import { NadaSelecionado, type NadaSelecionadoProps } from './NadaSelecionado'
import { FichaDaFerramenta } from './livro/FichaDaFerramenta'
import type { ToolVariantBindings } from './ToolVariantMenu'
import { BOTAO_NOVO_TOKEN_ID, NovoTokenForm } from './NovoTokenForm'
import { selectEndireitarMudaria, useMapStore } from '../stores/mapStore'
import { WallDoorControls, type WallDoorControlsProps } from './WallDoorControls'
import { DoorKindControls, type DoorKindControlsProps } from './DoorKindControls'
import { DoorModeControls, type DoorModeControlsProps } from './DoorModeControls'
import { TextLabelControls, type TextLabelControlsProps } from './TextLabelControls'
import { RegionJoinField, RegionSmoothButton, RegionStyleControls, type RegionStyleControlsProps } from './RegionStyleControls'
import { AdvancedField, AdvancedSection } from './AdvancedSection'
import { PolygonSidesControls, type PolygonSidesControlsProps } from './PolygonSidesControls'
import type { LayersPanelProps } from './LayersPanel'
import type { TerritorioControlsProps } from './TerritorioControls'
import type { TokenImageControlsProps } from './TokenImageControls'
import type { TokenNameControlsProps } from './TokenNameControls'
import type { TokenColorControlsProps } from './TokenColorControls'
import type { TokenPlayerCharacterControlsProps } from './TokenPlayerCharacterControls'
import type { TokenSizeControlsProps } from './TokenSizeControls'
import type { TokenNpcControlsProps } from './TokenNpcControls'
import type { TokenCarryWiring } from '../lib/party'
import type { TokenConditionControlsProps } from './TokenConditionControls'
import type { TokenWatchControlsProps } from './TokenWatchControls'
import type { TokenPatrolControlsProps } from './TokenPatrolControls'
import type { TokenCarryControlsProps } from './TokenCarryControls'
import type { TokenVehicleControlsProps } from './TokenVehicleControls'
import { LightControls, type LightControlsProps } from './LightControls'
import type { TokenLightsControlsProps } from './TokenLightsControls'
import type { TokenSeenByProps } from './TokenSeenBy'
import { FichaDoToken } from './livro/FichaDoToken'
import { WallLineStyleField, WallStyleControls, type WallStyleControlsProps } from './WallStyleControls'
import { StairControls, type StairControlsProps } from './StairControls'
import { LEVAR_AO_PISO_HINT, PisoControls } from './PisoControls'
import { TransicaoSection } from '../transicoes/TransicaoSection'
import type { TransicaoEscolhida } from '../transicoes/catalogo'
import { pisoDe } from '../lib/pisos'
import { RoomControls, type RoomControlsProps } from './RoomControls'
import { ItemTransformControls, type ItemTransformControlsProps } from './ItemTransformControls'
import { MobiliaControls, type MobiliaControlsProps } from './MobiliaControls'
import { ToolPropertiesSection } from './ToolPropertiesSection'
import { LineCapControls, type LineCapControlsProps } from './LineCapControls'
import { AvisoParedePresa, ParedesAoRedorControls, type AvisoParedePresaProps, type ParedesAoRedorControlsProps } from './ParedesAoRedorControls'
import { LineShapeControls, type LineShapeControlsProps } from './LineShapeControls'
import { FillControls, type FillControlsProps } from './FillControls'
import { RegionSplitControls, type RegionSplitControlsProps } from './RegionSplitControls'
import { FEATURES } from '../lib/features'
import { AreaSelectionControls, type AreaSelectionControlsProps } from './AreaSelectionControls'
import { AlignDistributeControls, type AlignDistributeControlsProps } from './AlignDistributeControls'
import { FloorPieceControls, type FloorPieceControlsProps } from './FloorPieceControls'
import type { FloorStyleControlsProps } from './FloorStyleControls'
import { FloorLayersList, type FloorLayersListProps } from './FloorLayersList'
import { PlayerSecretControls, type PlayerSecretControlsProps } from './PlayerSecretControls'
import { AreaTriggerControls, type AreaTriggerControlsProps } from './AreaTriggerControls'
import { ConcealZoneControls, type ConcealZoneControlsProps } from './ConcealZoneControls'
import { ConcealBrushControls, type ConcealBrushControlsProps } from './ConcealBrushControls'
import { PenhascoControls } from './PenhascoControls'
import { TexturasControls } from './TexturasControls'
import { CarimbosControls } from './CarimbosControls'
import { PinControls, type PinControlsProps } from './PinControls'
import type { PinIconControlsProps } from './PinIconControls'
import { TokenLibraryPanel, type TokenLibraryPanelProps } from './TokenLibraryPanel'
import { AcervoDeItensPanel, type AcervoDeItensPanelProps } from './AcervoDeItensPanel'
import { ItemNoChaoControls, type ItemNoChaoControlsProps } from './ItemNoMapaControls'
import { isAxisAlignedRect, roomDimensions } from '../lib/roomOps'
import { roomRotationOf } from '../lib/roomRotation'
import { roomLabelStyleOf } from '../lib/roomLabelStyle'
import { pinKindShowsIcon } from '../lib/pins'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'
import { panelHeadingTool, type PropertyGroupId } from '../lib/toolProperties'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useLivroDoMestreStore } from '../stores/livroDoMestreStore'
import { FolhaDoLivro } from './livro/FolhaDoLivro'
import { PaginaAcervo } from './livro/PaginaAcervo'
import { PaginaAventura } from './livro/PaginaAventura'
import { PaginaCena } from './livro/PaginaCena'
import './PropertiesPanel.css'

interface PropertiesPanelProps {
  /** Seção "Cenas" da aventura, montada por quem sabe da aventura (App). */
  scenes?: ReactNode
  /** Seção "Estado do mundo" da aventura (Maré, Giro…), logo abaixo das Cenas. Ausente no mapa solto. */
  worldState?: ReactNode
  /**
   * ESTADO DO MUNDO — "Depende do estado" da porta, do pino de viagem, da zona
   * oculta e da luz selecionados, cada um dentro da seção do seu elemento.
   * Montados pelo App (`DependeDoEstadoControls.tsx`), que sabe da aventura;
   * ausentes no mapa solto.
   */
  estadoDaPorta?: ReactNode
  estadoDoPino?: ReactNode
  estadoDaZona?: ReactNode
  estadoDaLuz?: ReactNode
  /** PERIGO QUE SE ALASTRA — bloco "Perigo" da Sala selecionada (`PerigoDaSalaControls.tsx`), montado pelo App. */
  perigoDaSala?: ReactNode
  /** SALA EM DUAS CORES da sala selecionada; ausente = sem o bloco. */
  regionSplit?: RegionSplitControlsProps
  /** ROTINA DO NPC da ficha selecionada (`RotinaDaFichaControls.tsx`), montada pelo App; ausente no mapa solto. */
  rotinaDaFicha?: ReactNode
  /** Seção "Objetos do mapa" (busca e "Ir até lá"), montada pelo App, que sabe da câmera e da seleção. */
  objects?: ReactNode
  /**
   * "Neste mapa" da página Ficha sem seleção (fatia 7): a cena aberta e o mesmo
   * "ir até" da lista de objetos (seleciona e leva a câmera). Ausente = sem a lista.
   */
  nesteMapa?: NadaSelecionadoProps['nesteMapa']
  /**
   * As preferências da PRÓXIMA peça (forma, tinta, tamanho...), as mesmas do
   * cantinho da barra (App.tsx): a ficha da ferramenta mostra os eixos que os
   * controles de sempre não têm. Ausente = só os controles de sempre.
   */
  variantes?: ToolVariantBindings
  mapName: string
  mapWidth: number
  mapHeight: number
  mapGrid: number
  activeTool: DrawingTool
  /** F4 (integrador I8) — N2 "painel contextual": saída de
   *  `relevantPropertyGroups` (lib/toolProperties.ts), computada em App.tsx a
   *  partir de `activeTool` + o que está selecionado. Cada seção abaixo
   *  decide visibilidade checando `groups.has('...')` via `ToolPropertiesSection`,
   *  em vez do `show*` booleano disperso que existia antes desta fase. */
  groups: ReadonlySet<PropertyGroupId>
  /** F4 — N2/B2 "ponta da linha". `null` = nenhuma fonte aplicável agora
   *  (nem ferramenta brush/line/curve ativa, nem freehand/line/curve
   *  selecionado) — `ToolPropertiesSection` já esconderia a seção pelo grupo,
   *  mas sem um valor concreto não haveria o que passar pro controle. */
  lineCap: LineCapControlsProps | null
  /** PAREDES AO REDOR do desenho selecionado (`paredesAoRedorDoPainel`).
   *  Ausente/`null` = nenhum desenho que aceite paredes selecionado. */
  paredesAoRedor?: ParedesAoRedorControlsProps | null
  /** Parede PRESA a um desenho selecionada: o aviso no lugar dos controles
   *  de parede (`avisoDaParedePresa`). Ausente/`null` = parede comum. */
  paredePresa?: AvisoParedePresaProps | null
  /** Fase 5 — B2 "dobrar a linha": converte `line` ⇄ `curve` (segmented
   *  control "Reta | Curva", `LineShapeControls.tsx`). `null` = nada
   *  selecionado é `line` nem `curve` (seção não aparece). */
  lineShape: LineShapeControlsProps | null
  /** F4 — N2 "tirar o fundo" (Região/Sala e forma preenchível selecionada). */
  fill: FillControlsProps
  /** F4 — N3 "ferramenta de seleção de área". */
  areaSelection: AreaSelectionControlsProps
  /** Alinhar e distribuir os itens selecionados (aparece com 2+ itens). */
  alignDistribute: AlignDistributeControlsProps
  drawingStyle: DrawingStyleControlsProps
  /** Cor e largura do PRÓXIMO caminho (ferramenta "Caminho"). */
  pathStyle: PathStyleControlsProps
  grid: GridControlsProps
  layers: LayersPanelProps
  selection: SelectionControlsProps
  selectedWall: Wall | null
  wallDoor: Omit<WallDoorControlsProps, 'door'>
  doorKind: DoorKindControlsProps
  /** "Porta | Vão aberto": o que o clique da ferramenta Porta abre na parede. */
  doorMode: DoorModeControlsProps
  wallStyle: WallStyleControlsProps
  selectedProp: Prop | null
  /** "Objetos | Decoração" do Prop selecionado — mora na seção do objeto. */
  onSetPropLayer: PropLayerControlsProps['onSetPropLayer']
  /** F3, contrato do agente C4 — rotação/travar/ocultar do Objeto selecionado. */
  propTransform: Omit<ItemTransformControlsProps, 'title' | 'rotation' | 'locked' | 'hidden' | 'secret'>
  /** "Rótulo para jogadores" e "Mostrar imagem ao jogador" do Objeto selecionado. */
  propPlayer: Omit<PropPlayerControlsProps, 'label' | 'showImage'>
  /** Seção "Móvel" (tipo e aparência) — só aparece quando o Objeto selecionado é um móvel desenhado. */
  propMobilia: Omit<MobiliaControlsProps, 'prop'>
  /**
   * ITEM NO CHÃO (entrega 5): quando o Objeto selecionado é a imagem de um
   * item, a seção dele (nome, modo de pegar, quantidade, trocar para pino)
   * toma o lugar de "Móvel" e "Para os jogadores". Ausente = nunca aparece.
   */
  itemNoChao?: Omit<ItemNoChaoControlsProps, 'item'>
  selectedToken: Token | null
  tokenName: Omit<TokenNameControlsProps, 'name' | 'publicName'>
  tokenImage: Omit<TokenImageControlsProps, 'image'>
  /** Cor da ficha selecionada — separa aliado de inimigo no meio da luta. */
  tokenColor: Omit<TokenColorControlsProps, 'color'>
  /** Tamanho da ficha em QUADRADOS da grade — para o dragão não ficar do
   *  tamanho do rato. */
  tokenSize: Omit<TokenSizeControlsProps, 'size'>
  /** Marca de NPC — tira a ficha dos botões "Atribuir" de um clique do painel da sala. */
  tokenNpc: Omit<TokenNpcControlsProps, 'npc'>
  /**
   * "Levar para…" da ficha sem dono (NPC, monstro) para outra cena. Ausente =
   * sem o controle (quem monta o painel sem aventura).
   */
  tokenSceneCarry?: TokenCarryWiring
  /** Tocha presa (ou luz solta sob a ficha): o clique no mapa pega a ficha,
   *  então o caminho para a luz é pelo painel da ficha. */
  tokenLights: TokenLightsControlsProps
  /** Condições da ficha selecionada (envenenado, caído...) — marcadas no meio da luta. */
  tokenCondition: Omit<TokenConditionControlsProps, 'conditions'>
  /** OLHOS DO GUARDA: liga a vigia da ficha de NPC e diz como ela olha. */
  tokenWatch: Omit<TokenWatchControlsProps, 'watch'>
  /** ROTA DE PATRULHA: marca a ronda do NPC e o faz andar um passo. */
  tokenPatrol: Omit<TokenPatrolControlsProps, 'patrol'>
  /** LEVAR FICHA JUNTO: quem leva a ficha selecionada, quem ela leva, a quem pode ser presa, e as ações. */
  tokenCarry: Omit<TokenCarryControlsProps, 'tokenId'>
  /** "Visto por" da ficha sem dono (`HostBridge.tokenSeenBy`). Ausente = sala fechada. */
  tokenSeenBy?: Omit<TokenSeenByProps, 'tokenId'>
  /**
   * VEÍCULO COM LUGARES: faz da ficha um cesto/bote e marca quem está a
   * bordo. Ausente = sem o controle (quem monta o painel sem essa ligação).
   */
  tokenVehicle?: Omit<TokenVehicleControlsProps, 'vehicle'>
  /** F3, contrato do agente C4 — rotação/travar/ocultar do Token selecionado. `onCongeladoChange`: o "Congelado" (CONGELAR FICHA). */
  tokenTransform: Omit<ItemTransformControlsProps, 'title' | 'rotation' | 'locked' | 'congelado' | 'hidden' | 'secret'>
  /** "Ficha de jogador" do Token selecionado: entra na lista de quem chega sem personagem. */
  tokenPlayerCharacter: Omit<TokenPlayerCharacterControlsProps, 'playerCharacter'>
  /** "Personagem" do token (liga ao personagem da aventura). Ausente no mapa solto: sem aventura não há personagem. */
  tokenPersonagem?: Omit<TokenPersonagemControlsProps, 'characterId'>
  selectedTextLabel: Extract<Drawing, { kind: 'text' }> | null
  textLabel: Omit<TextLabelControlsProps, 'text' | 'color' | 'fontSize' | 'fontFamily'>
  /** "Travar movimentação" da Região/Sala selecionada (pedido de 18/09/2026:
   *  a ilha arrastada sem querer no meio da sessão). Só `onLockedChange`:
   *  Região não tem `rotation` no schema, o render ignora `hidden`, e
   *  "Oculto para jogadores" já mora no grupo `playerVisibility`. */
  regionTransform: Pick<ItemTransformControlsProps, 'onLockedChange'>
  selectedRegion: Region | null
  regionStyle: RegionStyleControlsProps
  room: Omit<
    RoomControlsProps,
    | 'name'
    | 'shape'
    | 'axisAligned'
    | 'width'
    | 'height'
    | 'rotation'
    | 'locked'
    | 'nameHiddenFromPlayers'
    | 'labelStyle'
    | 'roof'
    | 'comodo'
    | 'textoAoEntrar'
    | 'notaDoMestre'
    | 'dark'
    | 'dentroVeFora'
    | 'foraVeDentro'
    | 'faccao'
    | 'raioDeVisao'
    // O painel passa o id da Sala selecionada; o resto do "Abrir para o corredor" vem da store.
    | 'salaId'
  > &
    // Obrigatória aqui (opcional no RoomControls): sem ela o campo "Raio de
    // visão aqui" some do painel, e esquecê-la no App tem de quebrar o tipo.
    Required<Pick<RoomControlsProps, 'onRaioDeVisaoChange'>>
  selectedLight: Light | null
  /** `onVistaDeLongeChange` obrigatória pelo mesmo motivo de `room.onRaioDeVisaoChange`. */
  lightControls: Omit<LightControlsProps, 'color' | 'intensity' | 'attachedTokenId' | 'vistaDeLonge'> &
    Required<Pick<LightControlsProps, 'onVistaDeLongeChange'>>
  selectedStair: Stair | null
  stairControls: Omit<StairControlsProps, 'direction' | 'shape'>
  /**
   * PISOS NA MESMA CENA: "Piso" da ficha e da escada, e "Leva ao piso" da
   * escada. Ausente = sem os campos (quem monta o painel sem essa ligação).
   */
  pisos?: PisosWiring
  polygonSides: PolygonSidesControlsProps
  /** Chão por peças — peça selecionada (`null` = nenhuma) e seus controles. */
  selectedFloorPiece: FloorPiece | null
  floorPieceControls: Omit<FloorPieceControlsProps, 'piece' | 'floorFillColor'>
  /** Chão por peças — estilo do chão do mapa (a conversão da imagem fica no menu Arquivo do livro do mestre). */
  floorStyle: FloorStyleControlsProps
  /** "Camadas do chão": peças do chão com cor, trava e ordem. Ausente = sem a seção. */
  floorLayers?: FloorLayersListProps
  /** A5 — "Oculto para jogadores" da Região/Escada/Desenho selecionado; `null` = nenhum. */
  playerSecret: PlayerSecretControlsProps | null
  /** GATILHO DE ÁREA da Região/Sala selecionada; `null` = nenhuma região selecionada. */
  areaTrigger: AreaTriggerControlsProps | null
  /** A5 — zona oculta aberta no painel; `null` = nenhuma. */
  concealZone: ConcealZoneControlsProps | null
  /** Pincel de revelar: "Revelar | Esconder" e a largura do próximo traço. */
  concealBrush: ConcealBrushControlsProps
  /** Ponto de interesse: tipo do próximo pino, ou o pino aberto no painel. */
  pin: Omit<PinControlsProps, 'iconChoice'>
  /** Ícone do ponto de interesse — mesmo par de estados de `pin`. */
  pinIcon: Omit<PinIconControlsProps, 'pinSelected'>
  /** Há um pino aberto no painel — conta como seleção para o título do topo. */
  pinSelected: boolean
  /** Estante de NPCs prontos, global do app (pedido de 18/09/2026). */
  tokenLibrary: TokenLibraryPanelProps
  /** ACERVO DE ITENS, logo abaixo dos tokens: do app, como eles. Ausente = sem a seção. */
  acervoDeItens?: AcervoDeItensPanelProps
  /** FACÇÃO E ALERTA do mapa inteiro ("Território"). Ausente = sem a seção. */
  territorio?: TerritorioControlsProps
}

/** PISOS NA MESMA CENA — as gravações do painel, por id (a seleção quem sabe é o painel). */
export interface PisosWiring {
  onTokenPisoChange: (tokenId: string, piso: number) => void
  onStairPisosChange: (stairId: string, mudanca: { piso?: number; levaAoPiso?: number | null }) => void
  /** TRANSIÇÃO ESPECIAL da escada que leva a outro piso (`undefined` = nenhuma). */
  onStairTransicaoChange?: (stairId: string, transicao: TransicaoEscolhida | undefined) => void
  /** O piso em edição no editor (o que o canvas mostra e onde o mestre constrói). */
  pisoAtivo: number
  /** "Editar o 1º piso" da escada: leva o editor ao outro lado dela. */
  onEditarPiso: (piso: number) => void
  /** "Levar ao piso" da seleção inteira; o editor vai junto. */
  onLevarSelecaoAoPiso: (piso: number) => void
}

/**
 * Ferramenta armada e nada selecionado: as seções da ferramenta dentro da
 * ficha dela (fatia 7), com "Camadas do chão" no fim do cartão do Chão — é nela
 * que se vê onde a primeira pincelada cai. Sem ferramenta a nomear (Selecionar
 * na mão, ou algo selecionado): as seções soltas, como sempre.
 */
function MolduraDaFicha({
  ferramenta,
  variantes,
  camadasDoChao,
  children,
}: {
  ferramenta: DrawingTool | null
  variantes?: ToolVariantBindings
  camadasDoChao?: FloorLayersListProps
  children: ReactNode
}) {
  if (ferramenta === null) return <>{children}</>
  return (
    <FichaDaFerramenta ferramenta={ferramenta} variantes={variantes}>
      {children}
      {camadasDoChao !== undefined && (
        <div className="lb-ficha-ferramenta__camadas">
          <h3 className="gr-campo__rot">Camadas do chão</h3>
          <FloorLayersList {...camadasDoChao} />
        </div>
      )}
    </FichaDaFerramenta>
  )
}

/**
 * O recheio do livro do mestre (components/livro/LivroDoMestre.tsx): a página
 * Ficha (o que está na mão ou selecionado) e as páginas Cena, Aventura e
 * Acervo, cada uma numa `FolhaDoLivro`. Só compõe — cada seção é responsável
 * pelos próprios controles.
 */
export function PropertiesPanel({
  scenes,
  worldState,
  estadoDaPorta,
  estadoDoPino,
  estadoDaZona,
  estadoDaLuz,
  perigoDaSala,
  regionSplit,
  rotinaDaFicha,
  objects: objetosDaCena,
  nesteMapa,
  variantes,
  mapName,
  mapWidth,
  mapHeight,
  mapGrid,
  activeTool,
  groups,
  lineCap,
  paredesAoRedor,
  paredePresa,
  lineShape,
  fill,
  areaSelection,
  alignDistribute,
  drawingStyle,
  pathStyle,
  grid,
  layers,
  selection,
  selectedWall,
  wallDoor,
  doorKind,
  doorMode,
  wallStyle,
  selectedProp,
  onSetPropLayer,
  propTransform,
  propPlayer,
  propMobilia,
  itemNoChao,
  selectedToken,
  tokenName,
  tokenImage,
  tokenColor,
  tokenSize,
  tokenNpc,
  tokenSceneCarry,
  tokenLights,
  tokenCondition,
  tokenWatch,
  tokenPatrol,
  tokenCarry,
  tokenSeenBy,
  tokenVehicle,
  tokenTransform,
  tokenPlayerCharacter,
  tokenPersonagem,
  selectedTextLabel,
  textLabel,
  regionTransform,
  selectedRegion,
  regionStyle,
  room,
  selectedLight,
  lightControls,
  selectedStair,
  stairControls,
  pisos,
  polygonSides,
  selectedFloorPiece,
  floorPieceControls,
  floorStyle,
  floorLayers,
  playerSecret,
  areaTrigger,
  concealZone,
  concealBrush,
  pin,
  pinIcon,
  pinSelected,
  tokenLibrary,
  acervoDeItens,
  territorio,
}: PropertiesPanelProps) {
  // "Que ferramenta está na minha mão?" (fatia 7 do design consolidado): com
  // uma ferramenta armada e nada selecionado, a página Ficha é a FICHA DA
  // FERRAMENTA — a cabeça com o nome dela (o mesmo `TOOL_LABELS` do botão da
  // barra, letra por letra), a dica e a tecla, e os controles num cartão. Com
  // Selecionar na mão, o convite "Nada selecionado". `panelHeadingTool` decide
  // QUEM a cabeça nomeia (ninguém, com algo selecionado). Zona oculta aberta
  // conta como seleção: `ConcealZoneControls` já é o título "Zona oculta".
  // Pino e zona oculta não entram no resumo `selection.selection`, mas estão
  // selecionados: a página não pode dizer "Nada selecionado" em cima do cartão deles.
  const algoSelecionado = selection.selection !== null || concealZone !== null || pinSelected
  const ferramentaDaFicha = panelHeadingTool(activeTool, algoSelecionado)
  // Campos da região que moram no Avançado (fatia 3), em consts para o TS estreitar dentro do render prop.
  const { strokeJoin, onStrokeJoinChange, onSmoothRegion } = regionStyle
  // A faixa da seleção remonta quando o item muda (o menu aberto não passa de um item para o outro).
  const selectedItem = selectedRegion ?? selectedToken ?? selectedWall ?? selectedProp ?? selectedLight ?? selectedStair ?? selectedTextLabel ?? selectedFloorPiece
  const selectionKey = selection.selection === null ? '' : `${selection.selection.kind}:${selection.selection.count}:${selectedItem?.id ?? ''}`
  // "Oculto para jogadores" da região selecionada: vai para o bloco do Travado.
  const regionSecret = selectedRegion !== null && groups.has('playerVisibility') ? playerSecret : null
  // A seção "Parede" muda de lugar conforme o item (ordem por tarefa): montada uma vez só.
  const doorSelected = selectedWall !== null && selectedWall.door !== null
  // "MAIS AÇÕES" DA CABEÇA (fatia 8): as ações raras da seleção, por assunto.
  // Endireitar só entra quando o clique mudaria alguma coisa (Linha, Parede
  // solta ou Caminho tortos), como o botão que ele substitui; "Levar ao piso"
  // vale para qualquer seleção, com a ligação de pisos montada.
  const endireitarMudaria = useMapStore(selectEndireitarMudaria)
  const endireitarSelecionados = useMapStore((state) => state.endireitarSelecionados)
  const ondeDaPorta = useOndeDaPorta(doorSelected ? selectedWall.id : null)
  const acoesDaSelecao = [
    ...(endireitarMudaria ? [endireitarAction(() => endireitarSelecionados())] : []),
    ...(pisos === undefined ? [] : floorActions(pisos.pisoAtivo, pisos.onLevarSelecaoAoPiso)),
  ]
  // VÁRIOS ITENS na gramática da ficha (decisão 4.1): o que vale para todos —
  // seleção de área, alinhar e o "Oculto para jogadores" em lote — num bloco
  // essencial logo abaixo da cabeça. Com um item só, as mesmas seções no fim.
  const variosSelecionados = selection.selection !== null && selection.selection.count > 1
  const controlesDeVarios = groups.has('selection') ? (
    <>
      <AreaSelectionControls {...areaSelection} />
      <AlignDistributeControls {...alignDistribute} />
      <SelectionControls secret={selection.secret} />
    </>
  ) : null
  // "+ TOKEN" NO TOPO DO LIVRO (LivroDoMestre): um lugar só, o mesmo com e
  // sem seleção, fora do corpo que rola. O campo do nome nasce no topo da
  // página Ficha, logo abaixo da faixa, e não depende da seleção: trocar o
  // item selecionado não apaga o nome digitado.
  const novoTokenAberto = useLivroDoMestreStore((state) => state.novoTokenAberto)
  // Um cartão do token aberto em ficha própria (fatia 9): a sub-ficha toma a
  // página, sem a cabeça do item (o "voltar" leva de volta a ela).
  const subFicha = useLivroDoMestreStore((state) => state.subFicha)
  const subFichaAberta = selectedToken !== null && subFicha !== null && subFicha.item === selectedToken.id
  const corpoRef = useRef<HTMLDivElement>(null)
  // Pendências do commit seguinte: o que só dá para fazer depois que o React
  // tirou o campo da tela e trouxe a ficha do token novo.
  const revelarFichaNovaRef = useRef(false)
  const devolverFocoAoMaisTokenRef = useRef(false)
  useLayoutEffect(() => {
    // A ficha do token novo nasce selecionada no TOPO do corpo: com a coluna
    // rolada, quem criou não veria nada mudar. Sem animação: o gesto costuma
    // ser o Enter.
    if (revelarFichaNovaRef.current) {
      revelarFichaNovaRef.current = false
      if (corpoRef.current !== null) corpoRef.current.scrollTop = 0
    }
    // O foco volta a quem abriu o campo (criou ou desistiu), e não cai no
    // body quando o campo sai: o Enter seguinte já abre o próximo token. O
    // botão é o mesmo antes e depois da seleção nova — o cabeçalho não troca.
    if (devolverFocoAoMaisTokenRef.current) {
      devolverFocoAoMaisTokenRef.current = false
      document.getElementById(BOTAO_NOVO_TOKEN_ID)?.focus()
    }
  })
  const confirmarNovoToken = (nome: string) => {
    revelarFichaNovaRef.current = true
    devolverFocoAoMaisTokenRef.current = true
    if (corpoRef.current !== null) corpoRef.current.scrollTop = 0
    useLivroDoMestreStore.getState().fecharNovoToken()
    selection.onAddToken(nome)
  }
  const desistirDoNovoToken = () => {
    devolverFocoAoMaisTokenRef.current = true
    useLivroDoMestreStore.getState().fecharNovoToken()
  }
  // NA FICHA, só o que é da ferramenta ou do item: com a ferramenta Chão na
  // mão ou uma peça de chão selecionada, "Camadas do chão". O "Chão do mapa"
  // (cor, contorno e moldura do mapa inteiro) e o resto da cena moram na
  // página Cena; a ficha do Chão leva até lá pela nota "Ir para Cena".
  // Com o pincel/balde na mão a lista aparece mesmo sem chão: é nela que se
  // vê onde a primeira pincelada vai cair ("Camada 1 · pinte para criar").
  const camadasDoChaoNaFicha =
    floorLayers !== undefined &&
    (floorLayers.floor.length > 0 || floorLayers.pincel !== undefined) &&
    ((activeTool === 'floor' && groups.has('floorStyle')) || groups.has('floorPiece'))

  const wallStyleSection = (
    <ToolPropertiesSection group="wallStyle" groups={groups}>
      <WallStyleControls
        {...wallStyle}
        // A última linha do bloco Parede, sem fio (fatia 3): "Ponta e canto" é
        // da parede. `key` pelo id: outra parede selecionada faz o Avançado
        // nascer fechado.
        avancado={
          <AdvancedSection key={selectedWall?.id ?? 'wall-tool'}>
            <AdvancedField hint="Arredondada suaviza a ponta solta e a quina entre paredes; Reta deixa a quina viva.">
              {(hintId) => <WallLineStyleField lineStyle={wallStyle.lineStyle} onLineStyleChange={wallStyle.onLineStyleChange} describedBy={hintId} />}
            </AdvancedField>
          </AdvancedSection>
        }
      />
    </ToolPropertiesSection>
  )

  return (
    <>
      <FolhaDoLivro pagina="ficha" corpoRef={corpoRef}>
        {/* A cabeça da ficha (fatia 8): retrato ou medalha, nome, tipo, Apagar
            e "Mais ações". Sem título, então o primeiro `h2` continua sendo o
            do item. `key`: outro item selecionado reabre a cabeça com o menu
            fechado. */}
        {selection.selection !== null && !subFichaAberta && (
          <CabecaDaSelecao
            key={selectionKey}
            identidade={selectionIdentity(selection.selection, {
              region: selectedRegion,
              token: selectedToken,
              wall: selectedWall,
              prop: selectedProp,
              light: selectedLight,
              stair: selectedStair,
              textLabel: selectedTextLabel,
              floorPiece: selectedFloorPiece,
            })}
            token={selection.selection.count === 1 && selection.selection.kind === 'token' ? selectedToken : null}
            onde={ondeDaPorta}
            rotuloApagar={deleteLabelFor(selection.selection)}
            onApagar={selection.onRemoveSelected}
            acoes={acoesDaSelecao}
            notaDasAcoes={pisos === undefined ? null : LEVAR_AO_PISO_HINT}
          />
        )}
        {/* O campo do "+ Token" do cabeçalho: o mais perto do botão que o
            abriu — no alto da página sem seleção (como no protótipo), logo
            abaixo da faixa com algo selecionado. Sempre nesta posição entre os
            filhos: selecionar com o campo aberto não o remonta, e o nome
            digitado fica. Sem título, para o primeiro `h2` continuar sendo o
            da ferramenta ou do item. */}
        {novoTokenAberto && (
          <NovoTokenForm
            className="lb-section"
            defaultTokenName={selection.defaultTokenName}
            onConfirm={confirmarNovoToken}
            onCancel={desistirDoNovoToken}
          />
        )}
        {/* Selecionar na mão e nada selecionado: o convite com os atalhos e
            um exemplo de cada tipo da cena (fatia 7). */}
        {!algoSelecionado && ferramentaDaFicha === null && <NadaSelecionado nesteMapa={nesteMapa} />}
        {variosSelecionados && controlesDeVarios !== null && (
          <div className="lb-ficha-multipla">
            <Essencial>{controlesDeVarios}</Essencial>
          </div>
        )}
        {/* Ferramenta armada e nada selecionado: as seções dela entram no
            cartão da ficha da ferramenta, embaixo da cabeça (fatia 7). Com
            algo selecionado, as seções do item, como antes. */}
        <MolduraDaFicha ferramenta={ferramentaDaFicha} variantes={variantes} camadasDoChao={camadasDoChaoNaFicha ? floorLayers : undefined}>
        {/* Sala no topo: o nome é o que o usuário quer mexer logo depois de
            desenhar, e no fim do painel ele precisava rolar para achar. */}
        {selectedRegion?.room && (
          <ToolPropertiesSection group="room" groups={groups}>
            <RoomControls
              // Um painel por sala: número digitado e não confirmado no campo
              // Rotação vai para a sala DELE, não para a que o clique no mapa
              // acabou de escolher (ver `RoomRotationField`).
              key={selectedRegion.id}
              salaId={selectedRegion.id}
              name={selectedRegion.room.name}
              shape={selectedRegion.room.shape}
              axisAligned={isAxisAlignedRect(selectedRegion.points)}
              width={roomDimensions(selectedRegion.points).width}
              height={roomDimensions(selectedRegion.points).height}
              rotation={roomRotationOf(selectedRegion.room)}
              locked={!!selectedRegion.locked}
              nameHiddenFromPlayers={!!selectedRegion.room.nameHiddenFromPlayers}
              labelStyle={roomLabelStyleOf(selectedRegion.room)}
              roof={!!selectedRegion.room.roof}
              comodo={selectedRegion.room.comodo === true}
              textoAoEntrar={selectedRegion.room.textoAoEntrar ?? ''}
              notaDoMestre={selectedRegion.room.notaDoMestre ?? ''}
              dark={selectedRegion.room.dark === true}
              dentroVeFora={selectedRegion.room.dentroVeFora === true}
              foraVeDentro={selectedRegion.room.foraVeDentro === true}
              faccao={selectedRegion.room.faccao ?? ''}
              raioDeVisao={selectedRegion.room.raioDeVisao ?? null}
              {...room}
            />
          </ToolPropertiesSection>
        )}
        {/* Sala e Região, em ordem de tarefa: travar e esconder dos jogadores
            logo depois do bloco do item (eram a 20ª e a 14ª rolagem), num bloco
            só, como na ficha; depois a aparência (Região + Preenchimento), o
            Gatilho, o Perigo que se alastra e, por último, o Avançado. */}
        {selectedRegion && (
          <ToolPropertiesSection group="itemTransform" groups={groups}>
            <ItemTransformControls
              // Rótulo segue o que o usuário chama a coisa: desenhada pela
              // ferramenta Sala é "Sala", pela ferramenta Região é "Região".
              title={selectedRegion.room ? 'Sala' : 'Região'}
              locked={!!selectedRegion.locked}
              // O "Oculto para jogadores" da região (grupo `playerVisibility`)
              // mora aqui, ao lado do Travado, e não num bloco "Jogadores" à
              // parte: na região ele não traz mais nada (a lista "Quem vê" é
              // só do pino, e o "Revelar para…", só da escada).
              secret={regionSecret?.secret}
              onSecretChange={regionSecret?.onSecretChange}
              {...regionTransform}
            />
          </ToolPropertiesSection>
        )}
        {concealZone && (
          <ToolPropertiesSection group="concealZone" groups={groups}>
            <ConcealZoneControls {...concealZone} />
            {estadoDaZona}
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="revealBrush" groups={groups}>
          <ConcealBrushControls {...concealBrush} />
        </ToolPropertiesSection>
        <ToolPropertiesSection group="penhasco" groups={groups}>
          <PenhascoControls />
        </ToolPropertiesSection>
        <ToolPropertiesSection group="texturas" groups={groups}>
          <TexturasControls />
        </ToolPropertiesSection>
        <ToolPropertiesSection group="carimbos" groups={groups}>
          <CarimbosControls />
        </ToolPropertiesSection>
        {/* Perto do topo pelo mesmo motivo da Sala: descrição e imagem são o
            que o mestre quer mexer logo depois de cravar o pino. */}
        <ToolPropertiesSection group="pin" groups={groups}>
          {/* Tipo e ícone num bloco só: o ícone mora logo abaixo do tipo, dentro
              de `PinControls`. Viagem e alavanca têm símbolo próprio (a
              passagem, a alavanca): a grade de ícones não faria nada nelas,
              então `iconChoice` fica nulo para as duas. */}
          <PinControls {...pin} iconChoice={pinKindShowsIcon(pin.kind) ? { ...pinIcon, pinSelected } : null} />
          {estadoDoPino}
        </ToolPropertiesSection>
        {/* Escada, desenho, texto e pino: "Jogadores" logo depois do bloco do
            item, onde sempre esteve. A região o tem lá em cima, junto do Travado. */}
        {!selectedRegion && playerSecret && (
          <ToolPropertiesSection group="playerVisibility" groups={groups}>
            <PlayerSecretControls {...playerSecret} />
          </ToolPropertiesSection>
        )}
        {/* ANTES do Estilo de desenho: com a ferramenta Caminho na mão esta é
            a seção da ferramenta, e a cor tem de ser a primeira coisa lida —
            ela é escolhida antes do primeiro ponto. */}
        <ToolPropertiesSection group="pathStyle" groups={groups}>
          <PathStyleControls {...pathStyle} />
        </ToolPropertiesSection>
        <ToolPropertiesSection group="drawingStyle" groups={groups}>
          <DrawingStyleControls {...drawingStyle} />
        </ToolPropertiesSection>
        {lineCap && (
          <ToolPropertiesSection group="lineCap" groups={groups}>
            <LineCapControls {...lineCap} />
            {lineShape && <LineShapeControls {...lineShape} />}
          </ToolPropertiesSection>
        )}
        {/* PAREDES AO REDOR: logo depois do traço, que é de onde as paredes nascem. */}
        {paredesAoRedor && (
          <ToolPropertiesSection group="paredesAoRedor" groups={groups}>
            <ParedesAoRedorControls {...paredesAoRedor} />
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="regionStyle" groups={groups}>
          <RegionStyleControls {...regionStyle} />
        </ToolPropertiesSection>
        {/* Preenchimento junto da Região: as duas dizem como a área aparece. */}
        <ToolPropertiesSection group="fill" groups={groups}>
          <FillControls {...fill} />
        </ToolPropertiesSection>
        {/* GATILHO DE ÁREA: decide o que o jogador recebe ao entrar. Região e
            Sala, não só Sala. */}
        {/* SALA EM DUAS CORES: logo depois do Preenchimento, que é o fundo que ela divide. */}
        {selectedRegion?.room && regionSplit && (
          <ToolPropertiesSection group="fill" groups={groups}>
            <RegionSplitControls key={selectedRegion.id} {...regionSplit} />
          </ToolPropertiesSection>
        )}
        {selectedRegion && areaTrigger && (FEATURES.gatilhoDeArea || selectedRegion.room === undefined) && (
          <ToolPropertiesSection group="playerVisibility" groups={groups}>
            <section className="lb-section">
              <AreaTriggerControls key={selectedRegion.id} {...areaTrigger} />
            </section>
          </ToolPropertiesSection>
        )}
        {/* PERIGO QUE SE ALASTRA: gesto de mesa (pôr fogo, avançar), não de
            construir a sala — depois do que a sala é. */}
        {FEATURES.perigoDaSala && selectedRegion?.room && (
          <ToolPropertiesSection group="room" groups={groups}>
            {perigoDaSala}
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="regionStyle" groups={groups}>
          {/* Por último no bloco da região. `key` pelo id: outra região
              selecionada faz o Avançado nascer fechado. */}
          <AdvancedSection key={selectedRegion?.id ?? 'region-tool'}>
            {strokeJoin !== undefined && onStrokeJoinChange && (
              <AdvancedField hint="Define se os vértices do contorno ficam arredondados ou em quina.">
                {(hintId) => <RegionJoinField strokeJoin={strokeJoin} onStrokeJoinChange={onStrokeJoinChange} describedBy={hintId} />}
              </AdvancedField>
            )}
            {onSmoothRegion && (
              <AdvancedField hint="Simplifica e arredonda o contorno inteiro de uma vez; Ctrl+Z desfaz.">
                {(hintId) => <RegionSmoothButton onSmoothRegion={onSmoothRegion} describedBy={hintId} />}
              </AdvancedField>
            )}
          </AdvancedSection>
        </ToolPropertiesSection>
        <ToolPropertiesSection group="polygonSides" groups={groups}>
          <PolygonSidesControls {...polygonSides} />
        </ToolPropertiesSection>
        {selectedTextLabel && (
          <ToolPropertiesSection group="textLabel" groups={groups}>
            <TextLabelControls
              text={selectedTextLabel.text}
              color={selectedTextLabel.color}
              fontSize={selectedTextLabel.fontSize}
              fontFamily={selectedTextLabel.fontFamily ?? DEFAULT_TEXT_FONT_FAMILY}
              {...textLabel}
            />
          </ToolPropertiesSection>
        )}
        {selectedFloorPiece && (
          <ToolPropertiesSection group="floorPiece" groups={groups}>
            {/* A cor do chão do mapa vem de `floorStyle`, que este painel já
                recebe: o swatch da peça sem cor própria mostra ela. */}
            <FloorPieceControls piece={selectedFloorPiece} floorFillColor={floorStyle.style.fillColor} {...floorPieceControls} />
          </ToolPropertiesSection>
        )}
        {/* Parede lisa: "Parede" primeiro, "Virar porta" depois. Porta
            selecionada: o que se mexe na porta (aberta, trancada, tipo) vem
            antes da espessura da parede em que ela mora. */}
        {/* Parede presa a um desenho: o aviso no lugar de Parede/Porta (o
            grupo `paredePresa` já tira os controles de parede do painel). */}
        {paredePresa && (
          <ToolPropertiesSection group="paredePresa" groups={groups}>
            <AvisoParedePresa {...paredePresa} />
          </ToolPropertiesSection>
        )}
        {!doorSelected && wallStyleSection}
        {selectedWall && (
          <ToolPropertiesSection group="wallDoor" groups={groups}>
            <WallDoorControls door={selectedWall.door} {...wallDoor} />
            {selectedWall.door !== null && estadoDaPorta}
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="doorKind" groups={groups}>
          {/* Só com a ferramenta Porta na mão: escolher "Porta ou vão" é
              preferência do PRÓXIMO clique, não propriedade de uma porta já
              selecionada (aí o grupo abre pela outra metade da condição de
              `relevantPropertyGroups`). */}
          {activeTool === 'door' && <DoorModeControls {...doorMode} />}
          {/* Não existe porta normal/dupla/portão de um buraco: com o vão
              escolhido a seção "Tipo de porta" sairia oferecendo uma escolha
              que o clique seguinte ignoraria. */}
          {(activeTool !== 'door' || doorMode.mode === 'porta') && <DoorKindControls {...doorKind} />}
        </ToolPropertiesSection>
        {doorSelected && wallStyleSection}
        {selectedProp && (
          <ToolPropertiesSection group="itemTransform" groups={groups}>
            {/* ITEM NO CHÃO: a imagem do item não é móvel nem tem "imagem ao
                jogador" própria — a imagem do item já é o que ele vê. */}
            {selectedProp.item !== undefined && itemNoChao !== undefined ? (
              <ItemNoChaoControls key={selectedProp.id} item={selectedProp.item} {...itemNoChao} />
            ) : (
              <MobiliaControls prop={selectedProp} {...propMobilia} />
            )}
            <ItemTransformControls
              title={selectedProp.item !== undefined ? 'Imagem no chão' : 'Objeto'}
              rotation={selectedProp.rotation ?? 0}
              locked={!!selectedProp.locked}
              hidden={!!selectedProp.hidden}
              secret={!!selectedProp.secret}
              {...propTransform}
            />
            <PropLayerControls prop={selectedProp} onSetPropLayer={onSetPropLayer} />
            {selectedProp.item === undefined && (
              <PropPlayerControls label={selectedProp.playerLabel ?? ''} showImage={selectedProp.playerImage !== undefined} {...propPlayer} />
            )}
          </ToolPropertiesSection>
        )}
        {/* A FICHA DO TOKEN (fatia 9): tipo de ficha, as fichas Nome,
            Condições, No mapa e Levar para outra cena, e os cartões de
            Comportamento com a sub-ficha de cada um. Os controles e os
            handlers são os de antes; a Vida saiu (fatia 10, D). `key`: outra
            ficha selecionada nasce do zero (a sub-ficha e o foco de volta). */}
        {selectedToken && (
          <ToolPropertiesSection group="tokenImage" groups={groups}>
            <FichaDoToken
              key={selectedToken.id}
              token={selectedToken}
              comTrava={groups.has('itemTransform')}
              tokenName={tokenName}
              tokenImage={tokenImage}
              tokenColor={tokenColor}
              tokenSize={tokenSize}
              tokenNpc={tokenNpc}
              tokenPlayerCharacter={tokenPlayerCharacter}
              tokenPersonagem={tokenPersonagem}
              tokenCondition={tokenCondition}
              tokenTransform={tokenTransform}
              tokenWatch={tokenWatch}
              tokenPatrol={tokenPatrol}
              tokenCarry={tokenCarry}
              tokenVehicle={tokenVehicle}
              tokenLights={tokenLights}
              tokenSeenBy={tokenSeenBy}
              tokenSceneCarry={tokenSceneCarry}
              rotinaDaFicha={rotinaDaFicha}
              pisos={pisos}
            />
          </ToolPropertiesSection>
        )}
        {selectedLight && (
          <ToolPropertiesSection group="lightControls" groups={groups}>
            <LightControls
              color={selectedLight.color}
              intensity={selectedLight.intensity}
              attachedTokenId={selectedLight.attachedTokenId ?? null}
              vistaDeLonge={selectedLight.vistaDeLonge === true}
              {...lightControls}
            />
            {estadoDaLuz}
          </ToolPropertiesSection>
        )}
        {selectedStair && (
          <ToolPropertiesSection group="stairControls" groups={groups}>
            <StairControls direction={selectedStair.direction} shape={selectedStair.shape} {...stairControls} />
            {pisos !== undefined && (
              <PisoControls
                key={`piso-${selectedStair.id}`}
                piso={pisoDe(selectedStair)}
                onPisoChange={(piso) => pisos.onStairPisosChange(selectedStair.id, { piso })}
                levaAoPiso={selectedStair.levaAoPiso ?? null}
                onLevaAoPisoChange={(levaAoPiso) => pisos.onStairPisosChange(selectedStair.id, { levaAoPiso })}
                pisoAtivo={pisos.pisoAtivo}
                onEditarPiso={pisos.onEditarPiso}
              />
            )}
            {/* TRANSIÇÃO ESPECIAL em toda escada: vale para a que leva a outro
                piso desta cena e para a que leva a outra cena (o pino invisível
                dela lê a da escada). A de enfeite mostra a galeria com o aviso. */}
            {pisos?.onStairTransicaoChange !== undefined && (
              <TransicaoSection
                key={`transicao-${selectedStair.id}`}
                transicao={selectedStair.transicao}
                onChange={(transicao) => pisos.onStairTransicaoChange?.(selectedStair.id, transicao)}
                origem="escada"
                semDestino={selectedStair.levaAoPiso === undefined && !stairControls.travel?.linkedSceneId}
              />
            )}
          </ToolPropertiesSection>
        )}
        {/* "Levar ao piso" e Apagar moram na cabeça; o "Adicionar token" é o
            "+ Token" do topo do livro. Com vários itens, o que é de vários
            mora no essencial lá em cima; com um, aqui no fim. */}
        {!variosSelecionados && !subFichaAberta && controlesDeVarios}
        </MolduraDaFicha>
        {/* Uma peça de chão selecionada: "Camadas do chão" no pé da ficha dela.
            Com a ferramenta Chão na mão a lista mora no cartão da ferramenta
            (`MolduraDaFicha`); a página Cena tem as duas sempre. */}
        {algoSelecionado && camadasDoChaoNaFicha && floorLayers !== undefined && (
          <CollapsibleSection id="floor-layers" title="Camadas do chão" defaultOpen>
            <FloorLayersList {...floorLayers} />
          </CollapsibleSection>
        )}
      </FolhaDoLivro>
      <FolhaDoLivro pagina="cena">
        <PaginaCena
          mapName={mapName}
          mapWidth={mapWidth}
          mapHeight={mapHeight}
          mapGrid={mapGrid}
          objetos={objetosDaCena}
          territorio={territorio}
          floorStyle={floorStyle}
          floorLayers={floorLayers}
          layers={layers}
          grid={grid}
        />
      </FolhaDoLivro>
      <FolhaDoLivro pagina="aventura">
        <PaginaAventura>
          {scenes}
          {worldState}
        </PaginaAventura>
      </FolhaDoLivro>
      {/* O Acervo é do app, não da aventura nem da cena. */}
      <FolhaDoLivro pagina="acervo">
        <PaginaAcervo>
          <TokenLibraryPanel {...tokenLibrary} />
          {acervoDeItens !== undefined && <AcervoDeItensPanel {...acervoDeItens} />}
        </PaginaAcervo>
      </FolhaDoLivro>
    </>
  )
}
