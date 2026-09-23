/**
 * Ícones da interface — SVG inline, traço em `currentColor`, sem dependência
 * externa. Todos decorativos (`aria-hidden`): quem carrega o nome acessível é
 * sempre o `aria-label` do botão que os contém.
 */

import type { ReactNode } from 'react'

interface IconProps {
  size?: number
}

/**
 * Toda forma herda daqui `fill="none"` e `stroke="currentColor"`: a família é de
 * contorno, sem silhueta preenchida, e nenhum ícone deve declarar `fill`.
 *
 * Cuidado com círculo pequeno: o traço come `strokeWidth / 2` de cada lado, e
 * abaixo de r≈2.8 o miolo fecha — o círculo passa a ler como ponto sólido e
 * quebra a leitura de contorno mesmo sem `fill` nenhum.
 */
function Icon({ size = 18, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** Marca do app: um labirinto quadrado de traço único. */
export function LabyrinthMark({ size = 22 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 21H3V3h18v18h-6V7H7v10h4" />
    </svg>
  )
}

export function CursorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3l14 8-6 1.6L10.6 19 5 3z" />
    </Icon>
  )
}

/**
 * Alvenaria em fiadas alternadas — parede, não controle deslizante.
 *
 * Duas fiadas em vez de três, e uma junta por fiada em vez de duas. O desenho
 * anterior somava traço demais para o mesmo `strokeWidth` dos vizinhos e lia
 * como o ícone mais pesado da barra.
 */
export function WallIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="7" width="15" height="10" rx="1.5" />
      <path d="M4.5 12h15M12 7v5M9 12v5" />
    </Icon>
  )
}

/**
 * Batente de porta: dois traços paralelos (as ombreiras) com um pequeno arco
 * entre eles sugerindo o raio de abertura da folha — distingue de `WallIcon`
 * (fiadas de tijolo) e de `RoomIcon` (contorno fechado com vão na aresta).
 */
export function DoorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4v16M17 4v16" />
      <path d="M7 20a9 9 0 009-9" />
    </Icon>
  )
}

export function LightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </Icon>
  )
}

/**
 * Polígono de vértices. Os pontos que marcavam os vértices eram os únicos
 * `fill` sólidos da barra; a r 1.4 eles nem sequer poderiam virar contorno (o
 * miolo daria 0.6 e fecharia), então saem — a forma sozinha já diz "área".
 */
export function RegionIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 6.5l8-2.5 6 5-2 9-9 1-3-12.5z" />
    </Icon>
  )
}

/**
 * Contorno de sala com vão de porta numa das paredes — distingue de `WallIcon`
 * (fiadas de tijolo) e de `RegionIcon` (polígono irregular): aqui é retângulo
 * fechado, com um gap na aresta de baixo indicando a porta.
 */
/** Zona oculta: retângulo tracejado com um olho riscado no meio. */
export function ConcealZoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4h3M10.5 4h3M17 4h3v3M20 10.5v3M20 17v3h-3M13.5 20h-3M7 20H4v-3M4 13.5v-3M4 7V4" />
      <path d="M7.5 12s1.8-3 4.5-3 4.5 3 4.5 3-1.8 3-4.5 3-4.5-3-4.5-3z" />
      <path d="M8 16l8-8" />
    </Icon>
  )
}

/**
 * Pino de ponto de interesse: a gota cravada no mapa, com o miolo vazado —
 * o glifo ("!" ou "?") é escolha do pino, não do ícone da barra, então aqui
 * fica só a forma que identifica a ferramenta.
 */
export function PinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s6-6.2 6-10.5A6 6 0 006 10.5C6 14.8 12 21 12 21z" />
      <circle cx="12" cy="10.3" r="2.2" />
    </Icon>
  )
}

export function RoomIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 19.5V4.5h15v15h-5.5" />
      <path d="M4.5 19.5h5.5" />
    </Icon>
  )
}

/**
 * Sala circular: mesmo círculo simples de `CircleIcon`, mas sem a linha
 * diagonal de raio (aquela é a leitura "arraste pra definir o raio" da
 * ferramenta de desenho) — no lugar, uma corda curta perto da base sugere um
 * vão de porta sem precisar abrir o contorno do círculo com arco SVG.
 */
export function RoomCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.7 17.5h6.6" />
    </Icon>
  )
}

/**
 * Polígono regular (hexágono) — distingue de `RegionIcon` (polígono
 * IRREGULAR, vértices desenhados à mão livre): aqui os 6 vértices são
 * equidistantes do centro, lidos como forma "regular" mesmo em traço fino.
 */
export function RegularPolygonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.5L18.5 8.25L18.5 15.75L12 19.5L5.5 15.75L5.5 8.25Z" />
    </Icon>
  )
}

/**
 * Sala de formato livre: contorno IRREGULAR (como `RegionIcon`) mas com um vão
 * de porta numa das arestas (como `RoomIcon`) — as duas metades da leitura que
 * a ferramenta precisa passar de relance, "o formato é seu" e "é sala, tem
 * parede e aceita porta". Sem o vão, ficaria igual à Região; sem a
 * irregularidade, igual à Sala retangular.
 */
export function RoomFreeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.5 19.5L4.5 7L12.5 3.5L19.5 8.5L17 18" />
      <path d="M17 18l-3 1.1" />
    </Icon>
  )
}

/**
 * Chão por peças — contorno irregular com um furo redondo: as duas operações
 * da ferramenta (somar forma, subtrair buraco) num ícone só. Distingue de
 * `RegionIcon` (contorno sem furo) e `DungeonMapIcon` (quadrado de mapa).
 */
export function FloorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 9L9 4.5h10.5v10L15 19.5H4.5z" />
      <circle cx="12" cy="12" r="2.5" />
    </Icon>
  )
}

/**
 * Trilha que serpenteia entre duas margens — as duas bordas paralelas dizem
 * "faixa por onde se anda", e não "risco de caneta" (que é o `LineIcon`).
 * Mesma família de contorno das demais: viewBox 24, sem fill.
 */
export function PathIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 20c0-5 6-5 6-9s-4-4-4-7" />
      <path d="M15 20c0-6 4-6 4-10" />
      <path d="M4.5 20h15" />
    </Icon>
  )
}

/** Miniatura de tabuleiro — distingue "peça" de "imagem de fundo". */
export function PropIcon(props: IconProps) {
  return (
    <Icon {...props}>
      {/* Cabeça a r 3.2: a r 2.6 o miolo sobrava 1.8 no viewBox, ou 1,35px na
          tela, e o círculo fechava — era isso que fazia a peça parecer uma
          silhueta preenchida no meio de uma barra toda de contorno. */}
      <circle cx="12" cy="6.6" r="3.2" />
      <path d="M8 17c0-3.2 1.8-5.4 4-5.4s4 2.2 4 5.4z" />
      <ellipse cx="12" cy="18.4" rx="5.6" ry="1.6" />
    </Icon>
  )
}

export function BrushIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15.5 4.5l4 4L10 18l-5 1 1-5 9.5-9.5z" />
      <path d="M13.5 6.5l4 4" />
    </Icon>
  )
}

export function LineIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.3 16.7L16.7 7.3" />
      {/* r 2.8 e não 2: a r 2 o miolo dava 0,9px e os dois nós fechavam. */}
      <circle cx="5.4" cy="18.6" r="2.8" />
      <circle cx="18.6" cy="5.4" r="2.8" />
    </Icon>
  )
}

/**
 * O ponto central era o outro `fill` sólido. No lugar dele vai o próprio raio,
 * que diz o que a ferramenta faz — clique no centro, arraste até a borda. Uma
 * cruz central resolveria o fill, mas círculo com cruz lê como "adicionar".
 */
export function CircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12l5.2 5.2" />
    </Icon>
  )
}

export function CurveIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 18c0-6 4-6 7-6s7 0 7-6" />
    </Icon>
  )
}

/** "T" maiúsculo em traço — ferramenta de rótulo de texto. Sem miolo fechando. */
export function TextIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 6h14M12 6v13" />
    </Icon>
  )
}

/** Borracha: contorno de bloco de borracha e a linha da mesa por baixo. */
export function EraserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 21l-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="M5 11l9 9" />
    </Icon>
  )
}

export function TokenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="10" r="2.6" />
      <path d="M6.6 18.4a6 6 0 0110.8 0" />
    </Icon>
  )
}

/**
 * Perfil de escada vista de lado — degraus ascendentes em zigue-zague único.
 * Distingue de `WallIcon` (fiadas horizontais de tijolo) e de `DungeonMapIcon`
 * (retângulo com divisão em L): aqui não há nenhum contorno fechado, só a
 * diagonal de degraus subindo da esquerda pra direita.
 */
export function StairIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20v-4h4v-4h4v-4h4v-4h4" />
    </Icon>
  )
}

/**
 * Retângulo puro com a diagonal de arrasto (canto a canto) — mesmo idioma
 * visual de `CircleIcon` (centro até a borda) e `LineIcon` (ponta a ponta).
 * Sem conteúdo interno: é o que distingue de `ImageIcon` (moldura de foto por
 * dentro), `NewMapIcon` (retângulo + cruz do lado de fora) e `DungeonMapIcon`
 * (retângulo + T interno) — aqui o retângulo fica vazio, só com a diagonal.
 */
export function RectIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="7" width="14" height="10" />
      <path d="M5 7l14 10" />
    </Icon>
  )
}

/**
 * Elipse achatada + diagonal de arrasto do centro até a borda, mesma lógica
 * de `CircleIcon`. Distingue dele pela proporção rx/ry desigual — não é um
 * círculo — e de `RoomCircleIcon` (círculo com corda de porta perto da base).
 */
export function EllipseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="12" cy="12" rx="9" ry="6" />
      <path d="M12 12l6 3" />
    </Icon>
  )
}

/**
 * Polígono irregular COM um ponto em cada vértice — o oposto da escolha feita
 * em `RegionIcon`, que remove os pontos de propósito (ver comentário lá). Aqui
 * eles voltam porque esta ferramenta cria a forma clicando vértice a vértice
 * (mesmo gesto de Região, mas gera um `Drawing`, não uma `Region`), e o ponto
 * é o que comunica "clique aqui" no ícone. Vértices espaçados de forma
 * desigual distinguem de `RegularPolygonIcon` (hexágono de vértices
 * equidistantes, sem pontos marcados).
 */
export function PolygonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 7L18 5L20 17L6 19Z" />
      <circle cx="5" cy="7" r="2.8" />
      <circle cx="18" cy="5" r="2.8" />
      <circle cx="20" cy="17" r="2.8" />
      <circle cx="6" cy="19" r="2.8" />
    </Icon>
  )
}

/**
 * Régua: mesma diagonal ponta-a-ponta de `LineIcon`, mas com marcações
 * perpendiculares ao longo do traço no lugar dos nós circulares nas pontas —
 * é essa troca (tique de régua vs. nó de vértice) que distingue os dois.
 */
export function MeasureIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 19L19 5M7.3 14.3L9.7 16.7M10.8 10.8L13.2 13.2M14.3 7.3L16.7 9.7" />
    </Icon>
  )
}

export function SaveIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8.5 4v5h7V4M8.5 20v-6h7v6" />
    </Icon>
  )
}

export function FolderIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7.5A1.5 1.5 0 014.5 6h4l2 2.5h7A1.5 1.5 0 0119 10v1" />
      <path d="M3 7.5V18a1.5 1.5 0 001.5 1.5h13.2a1.5 1.5 0 001.44-1.07L21 11H6.2a1.5 1.5 0 00-1.44 1.07L3 18" />
    </Icon>
  )
}

export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      {/* r 2.4 e não 1.6, que fechava o miolo em 0,6px. */}
      <circle cx="8.6" cy="10.2" r="2.4" />
      <path d="M3.5 16.5l4.5-4 3.5 3.5 3-2.5 6 5" />
    </Icon>
  )
}

export function ExportIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 15V4M8.5 7.5L12 4l3.5 3.5" />
      <path d="M4 14v4.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V14" />
    </Icon>
  )
}

export function ImportIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v11M8.5 11.5L12 15l3.5-3.5" />
      <path d="M4 14v4.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V14" />
    </Icon>
  )
}

/**
 * Engrenagem: círculo central `r 3.4` + coroa poligonal de dentes (um único
 * path fechado, alternando raio curto/longo em 16 pontos). **Não** é "círculo
 * + raios retos" — isso já é o `LightIcon` (:98, círculo com traços soltos
 * saindo dele) e os dois ficariam indistinguíveis; aqui os "dentes" são um
 * contorno fechado, não linhas radiais soltas.
 */
export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 12L18.28 14.6L18.36 18.36L14.6 18.28L12 21L9.4 18.28L5.64 18.36L5.72 14.6L3 12L5.72 9.4L5.64 5.64L9.4 5.72L12 3L14.6 5.72L18.36 5.64L18.28 9.4Z" />
      <circle cx="12" cy="12" r="3.4" />
    </Icon>
  )
}

/** Olho aberto: amêndoa + pupila `r 3` (acima do limite de miolo fechado). */
export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12C4.6 7.8 8 5.5 12 5.5S19.4 7.8 21.5 12C19.4 16.2 16 18.5 12 18.5S4.6 16.2 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

/** Olho riscado: mesma amêndoa do `EyeIcon` cortada por uma diagonal. */
export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12C4.6 7.8 8 5.5 12 5.5S19.4 7.8 21.5 12C19.4 16.2 16 18.5 12 18.5S4.6 16.2 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4l16 16" />
    </Icon>
  )
}

/** Cadeado fechado: corpo + arco inteiro encaixado nos dois lados. */
export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Icon>
  )
}

/** Cadeado aberto: mesmo corpo, arco solto do lado direito. */
export function UnlockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" />
    </Icon>
  )
}

/** Divisa para baixo — cabeçalho de seção recolhível (o CSS gira quando fechada). */
export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9l6 6 6-6" />
    </Icon>
  )
}

/** X de fechar janela — duas diagonais do mesmo comprimento da divisa acima. */
export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  )
}

/** Lupa do campo de busca: lente com miolo largo (r bem acima de 2.8) e cabo curto. */
export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </Icon>
  )
}

/**
 * "Criar Mapas" no menu raiz: retângulo de mapa + um `+` fora, no canto
 * superior direito. Distingue de `ImageIcon` (:266, mesmo retângulo mas com
 * moldura de foto por dentro) pela ausência de conteúdo interno e pela cruz
 * do lado de fora.
 */
export function NewMapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="13" height="14" rx="1.5" />
      <path d="M19 4v6M16 7h6" />
    </Icon>
  )
}

/**
 * Planta em grade: retângulo externo (paredes do dungeon) com uma divisão
 * interna em L e um vão de porta no meio dela. Distingue de `RoomIcon` (:125,
 * sala única com vão na aresta EXTERNA) pela subdivisão interna do espaço.
 */
export function DungeonMapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="1" />
      <path d="M12 4.5V10M12 13V19.5M12 13H19.5" />
    </Icon>
  )
}

/**
 * Topo de cubo em perspectiva isométrica: losango achatado com duas arestas
 * verticais descendo dos vértices laterais e um V fechando a base — sugere
 * volume. Distingue de `RegularPolygonIcon` (:154, hexágono plano, sem
 * arestas internas de profundidade).
 */
export function IsometricMapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5L19 9L12 13L5 9Z" />
      <path d="M5 9V15L12 19L19 15V9" />
    </Icon>
  )
}

/**
 * Globo: círculo `r 8` com dois meridianos elípticos (raios diferentes,
 * mesmo centro) e uma linha de equador. Distingue de `CircleIcon` (:201,
 * círculo com um raio diagonal só) e de `TokenIcon` (:238, círculo com
 * cabeça+ombros) pela malha de meridianos.
 */
export function WorldMapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <ellipse cx="12" cy="12" rx="5" ry="8" />
      <ellipse cx="12" cy="12" rx="2.5" ry="8" />
      <path d="M4 12H20" />
    </Icon>
  )
}

export function BackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11 5L4 12l7 7M4 12h16" />
    </Icon>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1H5a1 1 0 01-1-1v-8.5z" />
      <path d="M9.5 20v-6h5v6" />
    </Icon>
  )
}

/**
 * Onda 3, item 20 (histórico visível — ActionBar) — seta curva "em U" que
 * sai da ponta à esquerda, sobe, contorna pela direita e desce: leitura de
 * "desfazer o último passo". Distingue de `BackIcon` (:450, seta RETA
 * horizontal — navegação entre telas, não histórico de edição) pela curva;
 * distingue de `RedoIcon` logo abaixo por ser o espelho horizontal exato
 * (ponta pra esquerda em vez de pra direita).
 */
export function UndoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 15L4 10l5-5" />
      <path d="M4 10h9.5a5 5 0 010 10H10" />
    </Icon>
  )
}

/**
 * Espelho horizontal exato de `UndoIcon` (mesma curva, ponta pra direita) —
 * "refazer". Não reaproveita `UndoIcon` com `transform: scaleX(-1)` de
 * propósito: todo ícone deste arquivo é path SVG puro sem transform CSS,
 * mesmo padrão do par Exportar/Importar acima (:355 e :364), também
 * espelhados à mão em vez de compartilhar geometria via transform.
 */
export function RedoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 15L20 10l-5-5" />
      <path d="M20 10h-9.5a5 5 0 000 10h3.5" />
    </Icon>
  )
}
