import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DoorKind, FloorPiece, FreehandTexture, Region, Wall } from '../types/map'
import type { DrawingTool } from '../types/tools'
import type { StairSizePreset } from '../lib/stairs'
import type { FloorShapeKind } from '../lib/floorTool'
import type { TamanhoDePincel } from '../lib/floorBlocks'
import type { ToolVariantGroup, ToolVariantOption, ToolVariantStoreKey } from '../lib/toolVariants'

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
  /** Fase 5 — modo de gesto da Borracha. */
  eraseMode: { value: 'objeto' | 'parte'; onChange: (value: 'objeto' | 'parte') => void }
  /** Chão por peças — forma, operação e lados da PRÓXIMA peça. */
  floorShapeKind: { value: FloorShapeKind; onChange: (value: FloorShapeKind) => void }
  floorOp: { value: FloorPiece['op']; onChange: (value: FloorPiece['op']) => void }
  floorPolygonSides: { value: number; onChange: (value: number) => void }
  /** Lado do pincel de blocos, em blocos (1, 2 ou 3). */
  floorBrushSize: { value: TamanhoDePincel; onChange: (value: TamanhoDePincel) => void }
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
  /** Ícone de cada opção do grupo Forma (`drawShape`). Os outros grupos não têm ícone. */
  iconFor?: (tool: DrawingTool) => ReactNode
}

/**
 * Uma opção de rádio. O nome acessível é SÓ o rótulo (`aria-label`), e a
 * descrição vai para `aria-describedby`: se a descrição entrasse no nome,
 * "Linha" casaria com "... linha reta" e um seletor `exact` falharia (D10).
 */
function VariantOption<V>({
  option,
  checked,
  icon,
  onPick,
}: {
  option: ToolVariantOption<V>
  checked: boolean
  icon?: ReactNode
  onPick: () => void
}) {
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
      className={icon ? 'lb-toolvariant-menu__option lb-toolvariant-menu__option--icon' : 'lb-toolvariant-menu__option'}
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

/** Um grupo de botões-rádio para UM eixo — genérico em `V` (o tipo do
 *  `value` da opção), reaproveitado por todos os `storeKey`. Type-safe
 *  sem `as`: o chamador (`GroupOptions` abaixo) só instancia isto dentro do
 *  `case` de switch certo, onde o TypeScript já estreitou `group.options`
 *  para `ToolVariantOption<V>[]` e a `binding` correspondente para o mesmo `V`. */
function renderOptions<V>(
  options: ToolVariantOption<V>[],
  value: V,
  onChange: (value: V) => void,
  onPicked: () => void,
  iconFor?: (value: V) => ReactNode,
) {
  return options.map((option) => (
    <VariantOption
      key={option.id}
      option={option}
      checked={value === option.value}
      icon={iconFor?.(option.value)}
      onPick={() => {
        onChange(option.value)
        onPicked()
      }}
    />
  ))
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
  switch (group.storeKey) {
    case 'doorKind':
      return <>{renderOptions(group.options, bindings.doorKind.value, bindings.doorKind.onChange, onPicked)}</>
    case 'wallKind': {
      // Wall['wallKind'] === undefined significa 'exterior' — convenção
      // documentada em types/map.ts (Wall.wallKind) e replicada em
      // WallStyleControlsProps ("`undefined` conta como 'exterior'").
      // Normalizado só pra comparação de aria-checked abaixo; nunca
      // repassado assim pro `onChange`, que já exige NonNullable (mesma
      // assinatura de setWallKind/setWallKindForWall em mapStore.ts).
      const wallKindValue = bindings.wallKind.value ?? 'exterior'
      return <>{renderOptions(group.options, wallKindValue, bindings.wallKind.onChange, onPicked)}</>
    }
    case 'regionFillPattern':
      return <>{renderOptions(group.options, bindings.regionFillPattern.value, bindings.regionFillPattern.onChange, onPicked)}</>
    case 'polygonSides':
      return <>{renderOptions(group.options, bindings.polygonSides.value, bindings.polygonSides.onChange, onPicked)}</>
    case 'stairSizePreset':
      return <>{renderOptions(group.options, bindings.stairSizePreset.value, bindings.stairSizePreset.onChange, onPicked)}</>
    case 'drawTexture':
      return <>{renderOptions(group.options, bindings.drawTexture.value, bindings.drawTexture.onChange, onPicked)}</>
    case 'eraseMode':
      return <>{renderOptions(group.options, bindings.eraseMode.value, bindings.eraseMode.onChange, onPicked)}</>
    case 'floorShapeKind':
      return <>{renderOptions(group.options, bindings.floorShapeKind.value, bindings.floorShapeKind.onChange, onPicked)}</>
    case 'floorOp':
      return <>{renderOptions(group.options, bindings.floorOp.value, bindings.floorOp.onChange, onPicked)}</>
    case 'floorPolygonSides':
      return <>{renderOptions(group.options, bindings.floorPolygonSides.value, bindings.floorPolygonSides.onChange, onPicked)}</>
    case 'floorBrushSize':
      return <>{renderOptions(group.options, bindings.floorBrushSize.value, bindings.floorBrushSize.onChange, onPicked)}</>
    case 'drawShape':
      return <>{renderOptions(group.options, bindings.drawShape.value, bindings.drawShape.onChange, onPicked, iconFor)}</>
    default:
      return null
  }
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
export function ToolVariantMenu({ title, groups, bindings, onClose, onChoose, iconFor }: ToolVariantMenuProps) {
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
   * O TypeScript contribui com UMA medida — `--lb-toolvariant-topo`, a
   * distância entre o topo da janela e o topo do popover, que depende de em
   * qual fileira da barra a setinha caiu. O orçamento (`max-height`) é conta de
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
      const topo = Math.max(0, Math.round(raiz.getBoundingClientRect().top))
      raiz.style.setProperty('--lb-toolvariant-topo', `${topo}px`)
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

  const classes = ['lb-panel', 'lb-scroll', 'lb-toolvariant-menu']
  if (colunasDeGrupos.length > 1) classes.push('lb-toolvariant-menu--multi')
  if (ancorarPelaDireita) classes.push('lb-toolvariant-menu--direita')

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className={classes.join(' ')}
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
            <div className="lb-toolvariant-menu__group" key={group.storeKey}>
              <h3 className="lb-eyebrow">{group.label}</h3>
              <div className="lb-toolvariant-menu__options" role="radiogroup" aria-label={group.label}>
                <GroupOptions
                  group={group}
                  bindings={bindings}
                  onPicked={() => {
                    onChoose?.(group.storeKey)
                    onClose()
                  }}
                  iconFor={iconFor}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
