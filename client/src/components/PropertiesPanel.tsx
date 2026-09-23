import type { DrawingTool } from '../types/tools'
import type { Drawing, FloorPiece, Light, Prop, Region, Stair, Token, Wall } from '../types/map'
import { LabyrinthMark } from './icons'
import { DrawingStyleControls, type DrawingStyleControlsProps } from './DrawingStyleControls'
import { PathStyleControls, type PathStyleControlsProps } from './PathStyleControls'
import { GridQuickToggles, type GridControlsProps } from './GridControls'
import { MapSettingsButton } from './MapSettingsDialog'
import { CollapsibleSection } from './CollapsibleSection'
import { PropLayerControls, type PropLayerControlsProps } from './PropLayerControls'
import { SelectionControls, type SelectionControlsProps } from './SelectionControls'
import { WallDoorControls, type WallDoorControlsProps } from './WallDoorControls'
import { DoorKindControls, type DoorKindControlsProps } from './DoorKindControls'
import { DoorModeControls, type DoorModeControlsProps } from './DoorModeControls'
import type { ScenarioLinkControlsProps } from './ScenarioLinkControls'
import { TextLabelControls, type TextLabelControlsProps } from './TextLabelControls'
import { RegionJoinField, RegionSmoothButton, RegionStyleControls, type RegionStyleControlsProps } from './RegionStyleControls'
import { AdvancedField, AdvancedSection } from './AdvancedSection'
import { PolygonSidesControls, type PolygonSidesControlsProps } from './PolygonSidesControls'
import { LayersPanel, type LayersPanelProps } from './LayersPanel'
import { TokenImageControls, type TokenImageControlsProps } from './TokenImageControls'
import { tokenPhotoRef } from '../lib/tokenPhoto'
import { selectedTokenColor } from '../lib/tokenColor'
import { TokenNameControls, type TokenNameControlsProps } from './TokenNameControls'
import { TokenColorControls, type TokenColorControlsProps } from './TokenColorControls'
import { TokenSizeControls, type TokenSizeControlsProps } from './TokenSizeControls'
import { TokenNpcControls, type TokenNpcControlsProps } from './TokenNpcControls'
import { TokenCarryControls } from './TokenCarryControls'
import type { TokenCarryWiring } from '../lib/party'
import { selectedTokenSize } from '../lib/tokenSize'
import { LightControls, type LightControlsProps } from './LightControls'
import { WallLineStyleField, WallStyleControls, type WallStyleControlsProps } from './WallStyleControls'
import { StairControls, type StairControlsProps } from './StairControls'
import { RoomControls, type RoomControlsProps } from './RoomControls'
import type { MapScaleControlsProps } from './MapScaleControls'
import type { GridAlignControlsProps } from './GridAlignControls'
import { ItemTransformControls, type ItemTransformControlsProps } from './ItemTransformControls'
import { ToolPropertiesSection } from './ToolPropertiesSection'
import { LineCapControls, type LineCapControlsProps } from './LineCapControls'
import { LineShapeControls, type LineShapeControlsProps } from './LineShapeControls'
import { FillControls, type FillControlsProps } from './FillControls'
import { AreaSelectionControls, type AreaSelectionControlsProps } from './AreaSelectionControls'
import { AlignDistributeControls, type AlignDistributeControlsProps } from './AlignDistributeControls'
import { FloorPieceControls, type FloorPieceControlsProps } from './FloorPieceControls'
import { FloorStyleControls, type FloorStyleControlsProps } from './FloorStyleControls'
import { PlayerSecretControls, type PlayerSecretControlsProps } from './PlayerSecretControls'
import { ConcealZoneControls, type ConcealZoneControlsProps } from './ConcealZoneControls'
import { PinControls, type PinControlsProps } from './PinControls'
import { PinIconControls, type PinIconControlsProps } from './PinIconControls'
import { TokenLibraryPanel, type TokenLibraryPanelProps } from './TokenLibraryPanel'
import { isAxisAlignedRect, roomDimensions } from '../lib/roomOps'
import { roomRotationOf } from '../lib/roomRotation'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'
import { panelHeadingTool, type PropertyGroupId } from '../lib/toolProperties'
import { TOOL_LABELS } from './labels'
import type { ReactNode } from 'react'

interface PropertiesPanelProps {
  /** Seção "Cenas" da aventura, montada por quem sabe da aventura (App). */
  scenes?: ReactNode
  /** Seção "Objetos do mapa" (busca e "Ir até lá"), montada pelo App, que sabe da câmera e da seleção. */
  objects?: ReactNode
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
  mapScale: MapScaleControlsProps
  gridAlign: GridAlignControlsProps
  layers: LayersPanelProps
  selection: SelectionControlsProps
  scenarioLink: ScenarioLinkControlsProps
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
  selectedToken: Token | null
  tokenName: Omit<TokenNameControlsProps, 'name'>
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
  tokenCarry?: TokenCarryWiring
  /** F3, contrato do agente C4 — rotação/travar/ocultar do Token selecionado. */
  tokenTransform: Omit<ItemTransformControlsProps, 'title' | 'rotation' | 'locked' | 'hidden' | 'secret'>
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
    'name' | 'shape' | 'axisAligned' | 'width' | 'height' | 'rotation' | 'locked' | 'nameHiddenFromPlayers' | 'roof' | 'textoAoEntrar' | 'notaDoMestre'
  >
  selectedLight: Light | null
  lightControls: Omit<LightControlsProps, 'color' | 'intensity'>
  selectedStair: Stair | null
  stairControls: Omit<StairControlsProps, 'direction'>
  polygonSides: PolygonSidesControlsProps
  /** Chão por peças — peça selecionada (`null` = nenhuma) e seus controles. */
  selectedFloorPiece: FloorPiece | null
  floorPieceControls: Omit<FloorPieceControlsProps, 'piece' | 'floorFillColor'>
  /** Chão por peças — estilo do chão do mapa (a conversão da imagem fica no menu da ActionBar). */
  floorStyle: FloorStyleControlsProps
  /** A5 — "Oculto para jogadores" da Região/Escada/Desenho selecionado; `null` = nenhum. */
  playerSecret: PlayerSecretControlsProps | null
  /** A5 — zona oculta aberta no painel; `null` = nenhuma. */
  concealZone: ConcealZoneControlsProps | null
  /** Ponto de interesse: tipo do próximo pino, ou o pino aberto no painel. */
  pin: PinControlsProps
  /** Ícone do ponto de interesse — mesmo par de estados de `pin`. */
  pinIcon: Omit<PinIconControlsProps, 'pinSelected'>
  /** Há um pino aberto no painel — conta como seleção para o título do topo. */
  pinSelected: boolean
  /** Estante de NPCs prontos, global do app (pedido de 18/09/2026). */
  tokenLibrary: TokenLibraryPanelProps
}

/**
 * Inspetor da coluna esquerda: identidade do mapa aberto e as seções de
 * propriedade. Só compõe — cada seção é responsável pelos próprios controles.
 */
export function PropertiesPanel({
  scenes,
  objects,
  mapName,
  mapWidth,
  mapHeight,
  mapGrid,
  activeTool,
  groups,
  lineCap,
  lineShape,
  fill,
  areaSelection,
  alignDistribute,
  drawingStyle,
  pathStyle,
  grid,
  mapScale,
  gridAlign,
  layers,
  selection,
  scenarioLink,
  selectedWall,
  wallDoor,
  doorKind,
  doorMode,
  wallStyle,
  selectedProp,
  onSetPropLayer,
  propTransform,
  selectedToken,
  tokenName,
  tokenImage,
  tokenColor,
  tokenSize,
  tokenNpc,
  tokenCarry,
  tokenTransform,
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
  polygonSides,
  selectedFloorPiece,
  floorPieceControls,
  floorStyle,
  playerSecret,
  concealZone,
  pin,
  pinIcon,
  pinSelected,
  tokenLibrary,
}: PropertiesPanelProps) {
  // "Só o que importa agora": as seções de mapa inteiro só abrem sozinhas
  // quando o usuário não está mexendo em nada (Selecionar, sem seleção).
  // Depois do primeiro clique no cabeçalho vale o estado lembrado.
  const mapSectionsOpenByDefault = activeTool === 'select' && selection.selection === null
  // "Que ferramenta está na minha mão?": com uma ferramenta armada e nada
  // selecionado, as seções abaixo são as da ferramenta — mas várias delas são
  // compartilhadas (Sala/Sala Circular/Polígono Regular usam a seção "Região")
  // ou nem existem (Escada/Peça abrem em "Seleção de área"), e o primeiro
  // título do painel acabava dizendo o nome de OUTRA ferramenta da barra.
  // `panelHeadingTool` decide QUEM nomear (e quando calar); o rótulo visível é
  // o mesmo `TOOL_LABELS` do botão da barra, para o painel repetir letra por
  // letra o que o usuário acabou de apertar. Zona oculta aberta conta como
  // seleção: `ConcealZoneControls` já é o título "Zona oculta".
  const headingTool = panelHeadingTool(activeTool, selection.selection !== null || concealZone !== null || pinSelected)
  const toolHeading = headingTool === null ? undefined : TOOL_LABELS[headingTool]
  // Campos da região que moram no Avançado (fatia 3), em consts para o TS estreitar dentro do render prop.
  const { strokeJoin, onStrokeJoinChange, onSmoothRegion } = regionStyle

  return (
    <div className="lb-panel lb-inspector">
      <header className="lb-inspector__head">
        <span className="lb-inspector__mark" aria-hidden="true">
          <LabyrinthMark size={20} />
        </span>
        <span className="lb-inspector__id">
          <h1 className="lb-inspector__wordmark">Labirinto</h1>
          <span className="lb-inspector__mapname" title={mapName}>
            {mapName} · {mapWidth}×{mapHeight} · {mapGrid}px
          </span>
        </span>
        <MapSettingsButton grid={grid} gridAlign={gridAlign} mapScale={mapScale} scenarioLink={scenarioLink} />
      </header>

      <div className="lb-inspector__body lb-scroll">
        {/* Cabeçalho de contexto: a primeira coisa lida na coluna é o nome da
            ferramenta ativa. O prefixo "Ferramenta ·" separa este título dos
            títulos de bloco que vêm abaixo ("Região", "Preenchimento"), que
            são propriedades e não o nome do que está na mão — mesmo padrão de
            `FloorPieceControls` ("Peça de chão · Retângulo"). */}
        {toolHeading && (
          <section className="lb-section">
            <h2 className="lb-eyebrow">Ferramenta · {toolHeading}</h2>
          </section>
        )}
        {/* Sala no topo: o nome é o que o usuário quer mexer logo depois de
            desenhar, e no fim do painel ele precisava rolar para achar. */}
        {selectedRegion?.room && (
          <ToolPropertiesSection group="room" groups={groups}>
            <RoomControls
              // Um painel por sala: número digitado e não confirmado no campo
              // Rotação vai para a sala DELE, não para a que o clique no mapa
              // acabou de escolher (ver `RoomRotationField`).
              key={selectedRegion.id}
              name={selectedRegion.room.name}
              shape={selectedRegion.room.shape}
              axisAligned={isAxisAlignedRect(selectedRegion.points)}
              width={roomDimensions(selectedRegion.points).width}
              height={roomDimensions(selectedRegion.points).height}
              rotation={roomRotationOf(selectedRegion.room)}
              locked={!!selectedRegion.locked}
              nameHiddenFromPlayers={!!selectedRegion.room.nameHiddenFromPlayers}
              roof={!!selectedRegion.room.roof}
              textoAoEntrar={selectedRegion.room.textoAoEntrar ?? ''}
              notaDoMestre={selectedRegion.room.notaDoMestre ?? ''}
              {...room}
            />
          </ToolPropertiesSection>
        )}
        {concealZone && (
          <ToolPropertiesSection group="concealZone" groups={groups}>
            <ConcealZoneControls {...concealZone} />
          </ToolPropertiesSection>
        )}
        {/* Perto do topo pelo mesmo motivo da Sala: descrição e imagem são o
            que o mestre quer mexer logo depois de cravar o pino. */}
        <ToolPropertiesSection group="pin" groups={groups}>
          {/* ANTES de `PinControls`, no mesmo grupo (o par `LineCapControls` +
              `LineShapeControls` logo abaixo usa a mesma composição): o último
              botão daquela seção é "Excluir ponto de interesse", e ação
              destrutiva não pode ficar no meio da coluna. */}
          {/* O pino de viagem tem símbolo próprio (a passagem): a grade de
              ícones não faria nada nele, então não aparece. */}
          {pin.kind !== 'viagem' && <PinIconControls {...pinIcon} pinSelected={pinSelected} />}
          <PinControls {...pin} />
        </ToolPropertiesSection>
        {playerSecret && (
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
        <ToolPropertiesSection group="regionStyle" groups={groups}>
          <RegionStyleControls {...regionStyle} />
          {/* Provisório (a fatia 4 reposiciona dentro do bloco do objeto). `key`
              pelo id: outra região selecionada faz o Avançado nascer fechado. */}
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
        {selectedRegion && (
          <ToolPropertiesSection group="itemTransform" groups={groups}>
            <ItemTransformControls
              // Rótulo segue o que o usuário chama a coisa: desenhada pela
              // ferramenta Sala é "Sala", pela ferramenta Região é "Região".
              title={selectedRegion.room ? 'Sala' : 'Região'}
              locked={!!selectedRegion.locked}
              {...regionTransform}
            />
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="fill" groups={groups}>
          <FillControls {...fill} />
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
        <ToolPropertiesSection group="wallStyle" groups={groups}>
          <WallStyleControls {...wallStyle} />
          {/* Provisório (a fatia 4 reposiciona). `key` pelo id: outra parede
              selecionada faz o Avançado nascer fechado. */}
          <AdvancedSection key={selectedWall?.id ?? 'wall-tool'}>
            <AdvancedField hint="Arredondada suaviza a ponta solta e a quina entre paredes; Reta deixa a quina viva.">
              {(hintId) => (
                <WallLineStyleField lineStyle={wallStyle.lineStyle} onLineStyleChange={wallStyle.onLineStyleChange} describedBy={hintId} />
              )}
            </AdvancedField>
          </AdvancedSection>
        </ToolPropertiesSection>
        {selectedWall && (
          <ToolPropertiesSection group="wallDoor" groups={groups}>
            <WallDoorControls door={selectedWall.door} {...wallDoor} />
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
        {selectedProp && (
          <ToolPropertiesSection group="itemTransform" groups={groups}>
            <ItemTransformControls
              title="Objeto"
              rotation={selectedProp.rotation ?? 0}
              locked={!!selectedProp.locked}
              hidden={!!selectedProp.hidden}
              secret={!!selectedProp.secret}
              {...propTransform}
            />
            <PropLayerControls prop={selectedProp} onSetPropLayer={onSetPropLayer} />
          </ToolPropertiesSection>
        )}
        {selectedToken && (
          <ToolPropertiesSection group="tokenImage" groups={groups}>
            <TokenNameControls name={selectedToken.name} {...tokenName} />
            {/* Logo depois do nome: quem acabou de criar "Dragão" quer dizer
                em seguida que ele é grande — e o tamanho manda no que a peça
                cobre na grade, então vem antes da aparência (cor, foto). */}
            <TokenSizeControls size={selectedTokenSize(selectedToken)} {...tokenSize} />
            {/* Antes da imagem: a cor é o caminho de um clique, a foto é o de
                abrir o disco. Quem só quer separar aliado de inimigo não
                precisa passar pelo controle caro para chegar no barato. */}
            <TokenColorControls color={selectedTokenColor(selectedToken)} {...tokenColor} />
            {/* `tokenPhotoRef`: foto escolhida pelo JOGADOR vive em `imageData` — sem isto o painel ofereceria "Escolher imagem..." num token que já tem foto. */}
            <TokenImageControls image={tokenPhotoRef(selectedToken)} {...tokenImage} />
            <TokenNpcControls npc={selectedToken.npc === true} {...tokenNpc} />
            {/* `key`: outra ficha selecionada reabre fechado, sem a escolha da anterior. */}
            {tokenCarry !== undefined && (
              <TokenCarryControls
                key={selectedToken.id}
                tokenName={selectedToken.name}
                destinations={tokenCarry.destinations}
                owned={tokenCarry.ownedTokenIds.has(selectedToken.id)}
                onCarry={(sceneId, pinId) => tokenCarry.onCarry(selectedToken.id, sceneId, pinId)}
              />
            )}
          </ToolPropertiesSection>
        )}
        {selectedToken && (
          <ToolPropertiesSection group="itemTransform" groups={groups}>
            <ItemTransformControls
              title="Token"
              rotation={selectedToken.rotation ?? 0}
              locked={!!selectedToken.locked}
              hidden={!!selectedToken.hidden}
              secret={!!selectedToken.secret}
              {...tokenTransform}
            />
          </ToolPropertiesSection>
        )}
        {selectedLight && (
          <ToolPropertiesSection group="lightControls" groups={groups}>
            <LightControls color={selectedLight.color} intensity={selectedLight.intensity} {...lightControls} />
          </ToolPropertiesSection>
        )}
        {selectedStair && (
          <ToolPropertiesSection group="stairControls" groups={groups}>
            <StairControls direction={selectedStair.direction} {...stairControls} />
          </ToolPropertiesSection>
        )}
        <ToolPropertiesSection group="selection" groups={groups}>
          <AreaSelectionControls {...areaSelection} />
          <AlignDistributeControls {...alignDistribute} />
          <SelectionControls {...selection} />
        </ToolPropertiesSection>
        {/* Cenas da aventura: depois do bloco da ferramenta e do objeto, junto das
            seções do mapa inteiro. No topo ela roubava o primeiro título da coluna,
            que é o nome do que está na mão ou do que acabou de ser desenhado
            (task-jornada-sala-livre.spec.ts, teste 3). */}
        {scenes}
        {/* Os objetos DA cena aberta, logo abaixo das cenas. Sem grupo de
            ferramenta: é navegação, como as Cenas, e nasce recolhida — com uma
            ferramenta de desenho na mão ela é só uma linha de título. Antes de
            "Chão do mapa": Camadas continua o último título da coluna. */}
        {objects}
        <ToolPropertiesSection group="floorStyle" groups={groups}>
          {/* "Chão do mapa", não "Chão": o botão da ferramenta na barra já se
              chama "Chão" e dois botões com o mesmo nome confundem leitor de
              tela (e o getByRole dos specs). */}
          <CollapsibleSection id="floor" title="Chão do mapa" defaultOpen={mapSectionsOpenByDefault}>
            <FloorStyleControls {...floorStyle} />
          </CollapsibleSection>
        </ToolPropertiesSection>
        <ToolPropertiesSection group="layers" groups={groups}>
          <CollapsibleSection id="layers" title="Camadas" defaultOpen={mapSectionsOpenByDefault}>
            <LayersPanel {...layers} quickToggles={<GridQuickToggles {...grid} />} />
          </CollapsibleSection>
        </ToolPropertiesSection>
        {/* Sem `ToolPropertiesSection` e sem `CollapsibleSection`: a estante de
            NPCs não pertence a ferramenta nem a seleção nenhuma, e é para ela
            estar à mão justamente quando nada está selecionado. */}
        <TokenLibraryPanel {...tokenLibrary} />
      </div>
    </div>
  )
}
