import { createContext, Fragment, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMapStore } from '../stores/mapStore'
import type { DoorKind, FloorPiece, FreehandTexture, Region, TipoMobilia, Wall } from '../types/map'
import type { DrawingTool, RoomFreeKind } from '../types/tools'
import type { StairSizePreset } from '../lib/stairs'
import type { FloorShapeKind } from '../lib/floorTool'
import type { TamanhoDePincel } from '../lib/floorBlocks'
import type { CamadaDoChao } from '../lib/camadasDoChao'
import type { BrushMode } from '../lib/baldeDeTinta'
import { ATALHO_DA_ARVORE, type ToolVariantGroup, type ToolVariantOption, type ToolVariantStoreKey } from '../lib/toolVariants'
import { TOOL_SHORTCUTS } from '../lib/keymap'
import { MobiliaIcon } from './icons'
import type { ComSaidaFilho } from './grimorio/ComSaida'

/** Tamanho do desenho do móvel ao lado de cada opção de Objetos — o mesmo dos ícones do grupo Forma. */
const MOBILIA_ICON_SIZE = 16

/**
 * Binding de valor/ação por eixo de variante (`ToolVariantGroup['storeKey']`)
 * — o chamador (Toolbar, alimentado pela store via App.tsx — ver CONTRATO do
 * agente) resolve a fonte; este componente só mostra o controle e chama
 * `onChange`. Mesma separação "chamador decide a fonte" de DoorKindControls/
 * WallStyleControls/RegionStyleControls/PolygonSidesControls — só que aqui os
 * eixos presentes na ferramenta ativa cabem todos no mesmo popover.
 *
 * Os eixos editam a preferência da PRÓXIMA entidade a nascer
 * (`doorKind`/`wallKind`/`regionFillPattern`/`polygonSides` em mapStore.ts,
 * sem histórico de undo — mesma classe de `wallKind`/`polygonSides` já
 * documentada lá) — nunca uma entidade já selecionada. A exceção é
 * `drawShape` (botão Desenho): escolher uma forma ATIVA a ferramenta.
 * Editar a selecionada continua sendo papel do painel esquerdo
 * (PropertiesPanel), que já faz isso hoje via as ações
 * `setWallKindForWall`/`setWallDoorKind`/`setRegionPattern`.
 */
export interface ToolVariantBindings {
  doorKind: { value: DoorKind; onChange: (value: DoorKind) => void }
  wallKind: { value: Wall['wallKind']; onChange: (value: NonNullable<Wall['wallKind']>) => void }
  regionFillPattern: { value: Region['fillPattern']; onChange: (value: Region['fillPattern']) => void }
  polygonSides: { value: number; onChange: (value: number) => void }
  /** Fase 5 — preset nomeado (P/M/G) da PRÓXIMA escada. */
  stairSizePreset: { value: StairSizePreset; onChange: (value: StairSizePreset) => void }
  /** Fase 5 — textura do PRÓXIMO traço livre (pincel). */
  drawTexture: { value: FreehandTexture; onChange: (value: FreehandTexture) => void }
  brushMode: { value: BrushMode; onChange: (value: BrushMode) => void }
  /** Fase 5 — modo de gesto da Borracha. */
  eraseMode: { value: 'objeto' | 'parte'; onChange: (value: 'objeto' | 'parte') => void }
  /** Chão por peças — forma, operação e lados da PRÓXIMA peça. */
  floorShapeKind: { value: FloorShapeKind; onChange: (value: FloorShapeKind) => void }
  floorOp: { value: FloorPiece['op']; onChange: (value: FloorPiece['op']) => void }
  floorPolygonSides: { value: number; onChange: (value: number) => void }
  /** Lado do pincel de blocos, em blocos (1, 2 ou 3). */
  floorBrushSize: { value: TamanhoDePincel; onChange: (value: TamanhoDePincel) => void }
  /** Camada da próxima peça de chão (Chão, Mar, Grama...). */
  floorCamada: { value: CamadaDoChao; onChange: (value: CamadaDoChao) => void }
  /** Sala livre — o traçado vira sala ou só paredes. */
  roomFreeKind: { value: RoomFreeKind; onChange: (value: RoomFreeKind) => void }
  /** Sala livre — cantos arredondados (sala e parede). */
  roomFreeRounded: { value: boolean; onChange: (value: boolean) => void }
  /** Objetos — o móvel que o próximo clique no mapa põe. */
  mobiliaTipo: { value: TipoMobilia; onChange: (value: TipoMobilia) => void }
  /** Botão Desenho — forma ativa (`value` = ferramenta ativa) e a ação que troca de ferramenta. */
  drawShape: { value: DrawingTool; onChange: (value: DrawingTool) => void }
}

/**
 * Valor corrente de UM eixo, lido pelo `storeKey` e já normalizado
 * (`wallKind === undefined` conta como 'exterior', mesma convenção de
 * `types/map.ts` aplicada em `GroupOptions` abaixo).
 *
 * Existe para a `Toolbar` poder ECOAR a escolha na tela sem repetir o switch
 * de bindings, e o retorno é `unknown` de propósito: quem chama compara o valor
 * com as opções do catálogo (`variantEcho`, em lib/toolVariants.ts), não faz
 * conta com ele. Só leitura — escrever continua sendo pelo `onChange` do eixo,
 * que é onde os tipos estreitos moram.
 */
export function readVariantValue(bindings: ToolVariantBindings, storeKey: ToolVariantStoreKey): unknown {
  if (storeKey === 'wallKind') return bindings.wallKind.value ?? 'exterior'
  return bindings[storeKey].value
}

export interface ToolVariantMenuProps {
  /** Nome do botão dono do menu: o grupo se chama `Opções de <title>`. */
  title: string
  groups: ToolVariantGroup[]
  bindings: ToolVariantBindings
  /** Fecha o popover — chamado por Escape e por qualquer opção escolhida
   *  (selecionar fecha, mesmo comportamento de um <select> nativo). O
   *  chamador (Toolbar) também usa isto para devolver o foco à setinha. */
  onClose: () => void
  /**
   * Avisa QUAL eixo o usuário acabou de escolher — chamado depois do `onChange`
   * do eixo e antes de fechar. Só o eixo: o valor o chamador já lê da store
   * (`readVariantValue`), e é de lá que ele tem de ler para a tela mostrar o
   * estado de agora em vez da lembrança de um clique.
   *
   * Por que o menu não mostra a confirmação sozinho: ele FECHA na escolha, e
   * uma confirmação que some junto com quem a disparou não confirma nada. Quem
   * fica na tela é a barra — então a barra é que fala.
   */
  onChoose?: (storeKey: ToolVariantStoreKey) => void
  /**
   * Ícone de cada opção do grupo Forma (`drawShape`). Fora dele, só o grupo
   * Objeto (`mobiliaTipo`) tem ícone, e esse o menu desenha sozinho: é o móvel
   * de cima (`MobiliaIcon`), não o ícone de uma ferramenta da barra.
   */
  iconFor?: (tool: DrawingTool) => ReactNode
}

/**
 * O grupo inteiro não vale agora (`inativoQuando`, em lib/toolVariants.ts): as
 * opções dele ficam `disabled` de uma vez, como dentro de um
 * `<fieldset disabled>`. Contexto em vez de prop para não costurar um
 * `disabled` por cada `case` de `GroupOptions`.
 */
const GrupoInativo = createContext(false)

/**
 * Uma opção de rádio. O nome acessível é SÓ o rótulo (`aria-label`), e a
 * descrição vai para `aria-describedby`: se a descrição entrasse no nome,
 * "Linha" casaria com "... linha reta" e um seletor `exact` falharia (D10).
 */
function VariantOption({
  option,
  checked,
  icon,
  onPick,
}: {
  option: Pick<OpcaoDoEixo, 'label' | 'description'>
  checked: boolean
  icon?: ReactNode
  onPick: () => void
}) {
  const inativo = useContext(GrupoInativo)
  const descId = useId()
  const description = (
    <span id={descId} className="lb-toolvariant-menu__option-desc">
      {option.description}
    </span>
  )
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={option.label}
      aria-describedby={descId}
      // Na grade de duas colunas a descrição sai da vista; o balão nativo a mostra a quem para o ponteiro.
      title={option.description}
      className={icon ? 'lb-toolvariant-menu__option lb-toolvariant-menu__option--icon' : 'lb-toolvariant-menu__option'}
      disabled={inativo}
      onClick={onPick}
    >
      {icon ? (
        <>
          <span className="lb-toolvariant-menu__option-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="lb-toolvariant-menu__option-text">
            <span>{option.label}</span>
            {description}
          </span>
        </>
      ) : (
        <>
          <span>{option.label}</span>
          {description}
        </>
      )}
    </button>
  )
}

/** Uma opção de um eixo, já sem o tipo do valor: o que a tela mostra dela. */
export interface OpcaoDoEixo {
  /** O `id` do catálogo (lib/toolVariants.ts): chave estável, nunca o rótulo. */
  id: string
  label: string
  description: string
  /** O móvel de cima (Objetos) ou o ícone da ferramenta (grupo Forma). */
  icon?: ReactNode
  /** Grupo Forma: a letra que arma aquela ferramenta (`lib/keymap.ts`). */
  atalho?: string
}

/**
 * Um eixo de variante pronto para a tela, sem o tipo do valor: as opções, a
 * marcada e o que fazer quando outra é escolhida. Mora aqui porque o cantinho
 * da barra e a ficha da ferramenta (página Ficha) mostram os MESMOS eixos, com a
 * mesma leitura e a mesma escrita na store — duas telas, uma regra.
 */
export interface EixoDaVariante {
  opcoes: readonly OpcaoDoEixo[]
  /** `id` da opção que vale agora; `null` quando o valor da store não está no catálogo. */
  marcada: string | null
  escolher: (id: string) => void
}

/** Genérico em `V` (o tipo do `value` da opção). Type-safe sem `as`: só é
 *  chamado dentro do `case` certo de `eixoDaVariante`, onde o TypeScript já
 *  estreitou `group.options` e a binding correspondente para o mesmo `V`. */
function eixo<V>(
  options: ToolVariantOption<V>[],
  value: V,
  onChange: (value: V) => void,
  enfeite?: (value: V) => Pick<OpcaoDoEixo, 'icon' | 'atalho'>,
): EixoDaVariante {
  return {
    opcoes: options.map((option) => ({ id: option.id, label: option.label, description: option.description, ...enfeite?.(option.value) })),
    marcada: options.find((option) => option.value === value)?.id ?? null,
    escolher: (id) => {
      const escolhida = options.find((option) => option.id === id)
      if (escolhida !== undefined) onChange(escolhida.value)
    },
  }
}

/**
 * O eixo `group.storeKey` lido de `bindings`. `iconFor` só vale para o grupo
 * Forma (`drawShape`): ali a opção é uma ferramenta da barra, com o ícone e a
 * letra dela. O grupo Objeto (`mobiliaTipo`) desenha o móvel de cima sozinho.
 */
export function eixoDaVariante(
  group: ToolVariantGroup,
  bindings: ToolVariantBindings,
  iconFor?: (tool: DrawingTool) => ReactNode,
): EixoDaVariante {
  switch (group.storeKey) {
    case 'doorKind':
      return eixo(group.options, bindings.doorKind.value, bindings.doorKind.onChange)
    case 'wallKind':
      // Wall['wallKind'] === undefined significa 'exterior' — convenção
      // documentada em types/map.ts (Wall.wallKind) e replicada em
      // WallStyleControlsProps ("`undefined` conta como 'exterior'").
      // Normalizado só pra achar a opção marcada; nunca repassado assim pro
      // `onChange`, que já exige NonNullable (mesma assinatura de
      // setWallKind/setWallKindForWall em mapStore.ts).
      return eixo(group.options, bindings.wallKind.value ?? 'exterior', bindings.wallKind.onChange)
    case 'regionFillPattern':
      return eixo(group.options, bindings.regionFillPattern.value, bindings.regionFillPattern.onChange)
    case 'polygonSides':
      return eixo(group.options, bindings.polygonSides.value, bindings.polygonSides.onChange)
    case 'stairSizePreset':
      return eixo(group.options, bindings.stairSizePreset.value, bindings.stairSizePreset.onChange)
    case 'drawTexture':
      return eixo(group.options, bindings.drawTexture.value, bindings.drawTexture.onChange)
    case 'brushMode':
      return eixo(group.options, bindings.brushMode.value, bindings.brushMode.onChange)
    case 'eraseMode':
      return eixo(group.options, bindings.eraseMode.value, bindings.eraseMode.onChange)
    case 'floorShapeKind':
      return eixo(group.options, bindings.floorShapeKind.value, bindings.floorShapeKind.onChange)
    case 'floorOp':
      return eixo(group.options, bindings.floorOp.value, bindings.floorOp.onChange)
    case 'floorPolygonSides':
      return eixo(group.options, bindings.floorPolygonSides.value, bindings.floorPolygonSides.onChange)
    case 'floorBrushSize':
      return eixo(group.options, bindings.floorBrushSize.value, bindings.floorBrushSize.onChange)
    case 'floorCamada':
      return eixo(group.options, bindings.floorCamada.value, bindings.floorCamada.onChange)
    case 'roomFreeKind':
      return eixo(group.options, bindings.roomFreeKind.value, bindings.roomFreeKind.onChange)
    case 'roomFreeRounded':
      return eixo(group.options, bindings.roomFreeRounded.value, bindings.roomFreeRounded.onChange)
    case 'mobiliaTipo':
      return eixo(group.options, bindings.mobiliaTipo.value, bindings.mobiliaTipo.onChange, (tipo) => ({
        icon: <MobiliaIcon tipo={tipo} size={MOBILIA_ICON_SIZE} />,
      }))
    case 'drawShape':
      return eixo(group.options, bindings.drawShape.value, bindings.drawShape.onChange, (tool) => ({
        icon: iconFor?.(tool),
        atalho: TOOL_SHORTCUTS[tool] || undefined,
      }))
  }
}

function GroupOptions({
  group,
  bindings,
  onPicked,
  iconFor,
}: {
  group: ToolVariantGroup
  bindings: ToolVariantBindings
  onPicked: () => void
  iconFor?: (tool: DrawingTool) => ReactNode
}) {
  const { opcoes, marcada, escolher } = eixoDaVariante(group, bindings, iconFor)
  return (
    <>
      {opcoes.map((opcao) => (
        <VariantOption
          key={opcao.id}
          option={opcao}
          checked={opcao.id === marcada}
          icon={opcao.icon}
          onPick={() => {
            escolher(opcao.id)
            onPicked()
          }}
        />
      ))}
    </>
  )
}

/**
 * Um eixo do menu: título, opções e, quando outra escolha do mesmo menu
 * desliga o eixo (`inativoQuando`), as opções esmaecidas no lugar de sempre
 * com o motivo escrito logo abaixo delas — a frase de apoio do app
 * (`lb-field__hint`, a mesma do "Distribuir precisa de 3 ou mais itens" em
 * AlignDistributeControls), ligada ao grupo por `aria-describedby`.
 *
 * `disabled` de verdade, não só a cor: a opção esmaecida não recebe clique nem
 * foco, então a preferência que não vale não muda por acidente. Ela continua
 * mostrando qual foi a última escolha, porque é essa que volta a valer quando
 * o eixo que desligou o grupo mudar de novo.
 */
function VariantGroup({
  group,
  bindings,
  onPicked,
  iconFor,
}: {
  group: ToolVariantGroup
  bindings: ToolVariantBindings
  onPicked: () => void
  iconFor?: (tool: DrawingTool) => ReactNode
}) {
  const motivoId = useId()
  const regra = group.inativoQuando
  const inativo = regra !== undefined && readVariantValue(bindings, regra.storeKey) === regra.value
  return (
    <div className="lb-toolvariant-menu__group">
      <h3 className="lb-eyebrow">{group.label}</h3>
      <div
        className="lb-toolvariant-menu__options"
        role="radiogroup"
        aria-label={group.label}
        aria-disabled={inativo || undefined}
        aria-describedby={inativo ? motivoId : undefined}
      >
        <GrupoInativo.Provider value={inativo}>
          <GroupOptions group={group} bindings={bindings} onPicked={onPicked} iconFor={iconFor} />
        </GrupoInativo.Provider>
      </div>
      {inativo && (
        <p id={motivoId} className="lb-field__hint lb-toolvariant-menu__motivo">
          {regra.motivo}
        </p>
      )}
    </div>
  )
}

/**
 * ATALHO DA ÁRVORE (fatia MT5 do Meio-Termo): a árvore continua CARIMBO, não
 * móvel; no menu do Objeto ela tem este atalho, que arma a ferramenta Carimbo
 * já com a árvore redonda escolhida (o mesmo caminho do botão da barra para a
 * ferramenta e a mesma escolha do painel de carimbos). Não é rádio: não é um
 * valor do eixo Objeto, é uma ação. Sem tecla nova.
 */
function AtalhoDaArvore({ bindings, onPicked }: { bindings: ToolVariantBindings; onPicked: () => void }) {
  const descId = useId()
  const setCarimboEscolhido = useMapStore((s) => s.setCarimboEscolhido)
  return (
    <div className="lb-toolvariant-menu__group" role="group" aria-label="Atalho">
      <h3 className="lb-eyebrow">Atalho</h3>
      <div className="lb-toolvariant-menu__options">
        <button
          type="button"
          aria-label={ATALHO_DA_ARVORE.label}
          aria-describedby={descId}
          title={ATALHO_DA_ARVORE.description}
          className="lb-toolvariant-menu__option lb-toolvariant-menu__option--icon"
          onClick={() => {
            setCarimboEscolhido(ATALHO_DA_ARVORE.carimbo)
            bindings.drawShape.onChange(ATALHO_DA_ARVORE.ferramenta)
            onPicked()
          }}
        >
          <span className="lb-toolvariant-menu__option-icon" aria-hidden="true">
            <IconeDaArvoreRedonda />
          </span>
          <span className="lb-toolvariant-menu__option-text">
            <span>{ATALHO_DA_ARVORE.label}</span>
            <span id={descId} className="lb-toolvariant-menu__option-desc">
              {ATALHO_DA_ARVORE.description}
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}

/** A copa redonda de cima, no traço dos ícones do menu (16 px, `currentColor`). */
function IconeDaArvoreRedonda() {
  return (
    <svg width={MOBILIA_ICON_SIZE} height={MOBILIA_ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinejoin="round">
      <path d="M8 2.2c1.4 0 2.3.9 2.6 1.9 1.3.2 2.3 1.3 2.3 2.6 0 .7-.3 1.3-.7 1.8.3.4.4.9.4 1.4 0 1.5-1.2 2.6-2.7 2.6-.5 0-1-.1-1.4-.4-.3.2-.6.3-.9.3s-.6-.1-.9-.3c-.4.3-.9.4-1.4.4-1.5 0-2.7-1.1-2.7-2.6 0-.5.1-1 .4-1.4-.4-.5-.7-1.1-.7-1.8 0-1.3 1-2.4 2.3-2.6.3-1 1.2-1.9 2.6-1.9Z" />
      <path d="M8 12.6v1.6" />
      <circle cx="6.6" cy="6.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * Teto de colunas. Duas resolvem o menu mais alto que existe (Chão: 4 grupos,
 * 18 opções) e ainda deixam o popover mais estreito que um terço da janela;
 * daí em diante um menu de ferramenta viraria painel, e quem assume é a
 * rolagem. Não é "quantas cabem": é quantas ainda parecem um menu.
 */
const MAXIMO_DE_COLUNAS = 2

/**
 * Reparte os grupos em `quantas` colunas, na ordem em que eles chegam — a
 * leitura desce a primeira coluna inteira antes de começar a segunda, e o Tab
 * segue exatamente esse caminho porque a ordem do DOM é a mesma.
 *
 * O peso de cada grupo é o número de opções dele, não a altura medida: é a
 * conta que dá para fazer ANTES de desenhar, sem um ciclo medir-redesenhar-
 * medir. No menu de Chão ela cai em [Forma, Tamanho do pincel] | [Operação,
 * Lados do polígono] — 9 opções de cada lado, a mesma divisão que o
 * balanceador de colunas do navegador escolhe quando se pede a ele.
 *
 * Um grupo nunca é partido ao meio: título e opções migram juntos, senão a
 * segunda coluna começaria com opções órfãs de legenda.
 */
export function dividirEmColunas(groups: ToolVariantGroup[], quantas: number): ToolVariantGroup[][] {
  if (quantas <= 1 || groups.length < 2) return [groups]
  const totalDeOpcoes = groups.reduce((soma, group) => soma + group.options.length, 0)
  const alvoPorColuna = Math.ceil(totalDeOpcoes / quantas)
  const colunas: ToolVariantGroup[][] = [[]]
  let acumulado = 0
  for (const group of groups) {
    const atual = colunas[colunas.length - 1] ?? []
    const abrirOutra = atual.length > 0 && colunas.length < quantas && acumulado + group.options.length > alvoPorColuna
    if (abrirOutra) {
      colunas.push([group])
      acumulado = group.options.length
    } else {
      atual.push(group)
      acumulado += group.options.length
    }
  }
  return colunas
}

/**
 * Popover de variantes ancorado na setinha de uma ferramenta da barra — a
 * "mesma ideia para cada ferramenta" que o usuário pediu (ROADMAP.md, N1).
 * Puramente presentacional: só sabe desenhar `groups` e delegar
 * clique/valor para `bindings`; quem decide QUANDO renderizar (a setinha
 * clicada), os GRUPOS (uma ferramenta, ou Forma + variantes no botão Desenho)
 * e a ANCORAGEM (posição relativa ao botão) é `Toolbar.tsx`.
 *
 * Fecha com Escape (handler abaixo) ou clicando fora (handled em
 * `Toolbar.tsx`, que é quem sabe qual é "fora" de cada ferramenta). Abre por
 * clique OU teclado de graça: a setinha é um `<button>` nativo, e Enter/Space
 * nele já disparam `onClick` sem nenhum código extra aqui.
 */
export function ToolVariantMenu({ title, groups, bindings, onClose, onChoose, iconFor, saindo = false }: ToolVariantMenuProps & ComSaidaFilho) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [colunas, setColunas] = useState(1)
  const [ancorarPelaDireita, setAncorarPelaDireita] = useState(false)
  const colunasDeGrupos = useMemo(() => dividirEmColunas(groups, colunas), [groups, colunas])

  /**
   * O popover cabe na janela ou rola — o que ele nunca faz é empurrar a página.
   *
   * `preventScroll` é o conserto de UMA linha do defeito mais grosseiro: o
   * popover nasce fora da área visível, e um `focus()` comum faz o navegador
   * rolar o ancestral rolável mais próximo (`.lb-editor`) para alcançá-lo —
   * arrastando junto canvas, barra de ferramentas e o painel do cabeçalho,
   * que saíam da janela só de a pessoa abrir o menu.
   */
  useLayoutEffect(() => {
    rootRef.current?.focus({ preventScroll: true })
  }, [])

  /**
   * Orçamento de altura e número de colunas, medidos na tela.
   *
   * O TypeScript contribui com UMA medida — `--lb-toolvariant-teto`, a
   * distância entre o topo da janela e o topo da âncora (o menu abre para
   * cima dela), que depende de em qual fileira da barra o botão caiu. O orçamento (`max-height`) é conta de
   * CSS a partir dela, com o respiro de borda vindo do mesmo
   * `--lb-layout-edge-gap` dos outros painéis flutuantes: a régua de
   * espaçamento continua morando num lugar só.
   *
   * Com o orçamento aplicado, "não coube" é `scrollHeight > clientHeight` — o
   * próprio CSS respondendo, em vez de uma segunda conta de altura em
   * JavaScript para discordar dele. Enquanto não couber, o menu ganha mais uma
   * coluna; no teto, a rolagem assume. A subida é monotônica (`Math.min` com o
   * teto), então o efeito não se realimenta.
   */
  useLayoutEffect(() => {
    const raiz = rootRef.current
    if (!raiz) return
    const ajustar = () => {
      // A barra mora no pé do mapa (fatia 6) e o menu abre PARA CIMA: o
      // orçamento é o que sobra entre o topo da janela e o topo da âncora.
      const ancoraDoTeto = raiz.offsetParent ?? raiz
      const teto = Math.max(0, Math.round(ancoraDoTeto.getBoundingClientRect().top))
      raiz.style.setProperty('--lb-toolvariant-teto', `${teto}px`)
      if (raiz.scrollHeight > raiz.clientHeight) setColunas((atual) => Math.min(atual + 1, MAXIMO_DE_COLUNAS))
      // A largura cresce junto com as colunas, então a borda da direita vira
      // um risco novo — e menu cortado à direita é o mesmo defeito de menu
      // cortado embaixo. A conta sai da ÂNCORA (`offsetParent` é a
      // `.lb-toolvariant-anchor`, a única `position: relative` em volta), nunca
      // da caixa já virada: medir a caixa virada faria a resposta depender de
      // si mesma e o menu ficaria piscando de um lado para o outro.
      const folga = Number.parseFloat(getComputedStyle(raiz).getPropertyValue('--lb-layout-edge-gap')) || 0
      const ancora = raiz.offsetParent ?? raiz
      setAncorarPelaDireita(ancora.getBoundingClientRect().left + raiz.offsetWidth > window.innerWidth - folga)
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [colunas])

  // `gr-anima`: entra e sai em 150/120 ms com a curva do app; a saída é do `ComSaida` em volta (Toolbar.tsx).
  const classes = ['lb-panel', 'lb-scroll', 'lb-toolvariant-menu', 'gr-anima']
  if (colunasDeGrupos.length > 1) classes.push('lb-toolvariant-menu--multi')
  if (ancorarPelaDireita) classes.push('lb-toolvariant-menu--direita')
  if (saindo) classes.push('gr-sai')

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={classes.join(' ')}
      inert={saindo}
      role="group"
      aria-label={`Opções de ${title}`}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // Não deixa o Escape borbulhar pra cima e fechar algo mais (ex. um
        // diálogo pai) além deste popover.
        event.stopPropagation()
        onClose()
      }}
    >
      {colunasDeGrupos.map((grupos, indice) => (
        // A coluna é só caixa de layout: um `<div>` sem papel não entra na
        // árvore de acessibilidade, então `role="group"` da raiz e cada
        // `role="radiogroup"` continuam vizinhos diretos como antes. Ela também
        // é quem faz o primeiro grupo de CADA coluna não herdar a linha
        // divisória de `.lb-toolvariant-menu__group + .lb-toolvariant-menu__group`
        // — sem isso a segunda coluna abriria com um risco solto no topo.
        <div className="lb-toolvariant-menu__coluna" key={grupos[0]?.storeKey ?? indice}>
          {grupos.map((group) => (
            <Fragment key={group.storeKey}>
              <VariantGroup
                group={group}
                bindings={bindings}
                onPicked={() => {
                  onChoose?.(group.storeKey)
                  onClose()
                }}
                iconFor={iconFor}
              />
              {group.storeKey === 'mobiliaTipo' && <AtalhoDaArvore bindings={bindings} onPicked={onClose} />}
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  )
}
