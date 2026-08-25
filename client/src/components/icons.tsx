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

export function TokenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="10" r="2.6" />
      <path d="M6.6 18.4a6 6 0 0110.8 0" />
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

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1H5a1 1 0 01-1-1v-8.5z" />
      <path d="M9.5 20v-6h5v6" />
    </Icon>
  )
}
