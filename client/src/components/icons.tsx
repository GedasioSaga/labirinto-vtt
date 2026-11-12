/**
 * Ícones da interface — SVG inline, traço em `currentColor`, sem dependência
 * externa. Todos decorativos (`aria-hidden`): quem carrega o nome acessível é
 * sempre o `aria-label` do botão que os contém.
 */

import type { ReactNode } from 'react'
import type { FormaDoTapete, TipoMobilia } from '../types/map'

interface IconProps {
  size?: number
  /**
   * Traço do contorno. O padrão é o do painel; o que flutua sobre o mapa do
   * jogador usa 2, como o + e o − do zoom (`PlayerZoomControls`).
   */
  strokeWidth?: number
}

/**
 * Toda forma herda daqui `fill="none"` e `stroke="currentColor"`: a família é de
 * contorno, sem silhueta preenchida, e nenhum ícone deve declarar `fill`.
 *
 * Cuidado com círculo pequeno: o traço come `strokeWidth / 2` de cada lado, e
 * abaixo de r≈2.8 o miolo fecha — o círculo passa a ler como ponto sólido e
 * quebra a leitura de contorno mesmo sem `fill` nenhum.
 */
function Icon({ size = 18, strokeWidth = 1.6, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
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
 * Pincel de revelar: o canto tracejado da zona oculta com um traço de pincel
 * aberto atravessando — o pedaço que deixa de estar escondido.
 */
export function RevealBrushIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4h3M10.5 4h3M17 4h3v3M4 7V4M4 10.5v3" />
      <path d="M6 18c2.5-4 5-6.5 12-8" />
      <path d="M15.5 16.5l3-3 2 2-3 3z" />
    </Icon>
  )
}

/**
 * Texturas: o rolo de pintura passando por cima de um chão de pintinhas — a
 * textura que vai por cima do que já está pintado.
 */
export function TexturasIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="3.5" width="13" height="5" rx="1.5" />
      <path d="M17 6h2.5v4.5H11v3" />
      <path d="M10 13.5h2v7h-2z" />
      <path d="M4.5 13.5h.01M6.5 17h.01M4.5 20h.01M15.5 16h.01M17.5 19.5h.01" />
    </Icon>
  )
}

/** Neblina: três faixas de bruma onduladas, desencontradas como névoa passando. */
export function NeblinaIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7.5c1.8-1.3 3.7-1.3 5.5 0s3.7 1.3 5.5 0c1.4-1 2.8-1.2 4-.6" />
      <path d="M3 12c1.8-1.3 3.7-1.3 5.5 0s3.7 1.3 5.5 0 3.7-1.3 5.5 0" />
      <path d="M6 16.5c1.8-1.3 3.7-1.3 5.5 0s3.7 1.3 5.5 0" />
    </Icon>
  )
}

/**
 * Carimbos: um pinheiro de dois andares em pé no chão, com as pintinhas do
 * spray em volta — o objeto que se solta (ou se espalha) no mapa.
 */
export function CarimbosIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5l-4 5.5h2.5L7 14.5h10L13.5 9H16z" />
      <path d="M12 14.5v4M7 20.5h10" />
      <path d="M4.5 9.5h.01M19.5 11h.01M4 15.5h.01M20 17h.01" />
    </Icon>
  )
}

/**
 * Barranco: a beira de cima ondulando e a parede de terra caindo para o lado
 * baixo, como o ícone do Risco no protótipo (`docs/design/barranco/`).
 */
export function BarrancoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 9c4-3 7 2 11-1s5-3 7-2" />
      <path d="M3 14c4-3 7 2 11-1s5-3 7-2" />
      <path d="M3 9v5M21 6v5" />
    </Icon>
  )
}

/**
 * Penhasco: a terra vista de lado — o chão em cima e a parede descendo em
 * degraus até a água, que ondula no pé dela.
 */
export function PenhascoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 6.5h8.5l1.6 3.2-1.1 2.4 2 2.6-.9 3.8H3z" />
      <path d="M3 11.5h6.5M3 15h8" />
      <path d="M15.5 19.5c.9 0 1.3-.9 2.2-.9s1.3.9 2.2.9 1.2-.9 2.1-.9" />
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

/**
 * Alfinete de fixar (tachinha): a cabeça larga e a ponta para baixo. Fixa uma
 * cena no topo da lista ("Hoje na sessão"); não confundir com o `PinIcon`, a
 * gota do pino do mapa.
 */
export function TachinhaIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 3.5h6l-.8 5.2 3.3 3.8h-11l3.3-3.8z" />
      <path d="M12 12.5V21" />
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

/**
 * Objetos (a mobília desenhada): um baú visto de frente — tampa abaulada, a
 * junta da tampa e o fecho. De frente, e não de cima como os móveis da setinha
 * (`MobiliaIcon`), para o botão ler como "objeto" antes de ler como um móvel só.
 */
export function ObjetosIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10V8.5A3.5 3.5 0 0 1 7.5 5h9A3.5 3.5 0 0 1 20 8.5V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M4 10h16" />
      <path d="M12 10v3.5" />
    </Icon>
  )
}

/**
 * Um móvel visto de cima, com a silhueta e os poucos traços finos que o mapa
 * desenha nele (`tracosDoGlifo`, lib/mobilia.ts), nas mesmas proporções: a
 * opção da setinha lembra o que o clique vai pôr.
 */
export function MobiliaIcon({ tipo, ...props }: IconProps & { tipo: TipoMobilia }) {
  return <Icon {...props}>{glifoDoMovel(tipo)}</Icon>
}

function glifoDoMovel(tipo: TipoMobilia): ReactNode {
  switch (tipo) {
    case 'barril':
      return (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="4.5" />
        </>
      )
    case 'caixa':
      return (
        <>
          <rect x="5" y="5" width="14" height="14" />
          <path d="M5 5l14 14M19 5L5 19" />
        </>
      )
    case 'bau':
      return (
        <>
          <rect x="3" y="7" width="18" height="10" />
          <path d="M3 10.5h18M12 10.5V13" />
        </>
      )
    case 'catre':
      return (
        <>
          <rect x="7" y="2" width="10" height="20" />
          <rect x="8.2" y="3.2" width="7.6" height="3.6" />
          <path d="M7 10.4h10" />
        </>
      )
    case 'mesa':
      return (
        <>
          <rect x="2" y="7" width="20" height="10" />
          <rect x="3.8" y="8.8" width="16.4" height="6.4" />
        </>
      )
    case 'cadeira':
      return (
        <>
          <rect x="6" y="6" width="12" height="12" />
          <path d="M6 9.4h12" />
        </>
      )
    case 'cerca':
      // Três mourões redondos (um em cada ponta e um no meio) ligados por um fio.
      return (
        <>
          <circle cx="4" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="20" cy="12" r="2" />
          <path d="M6 12h4M14 12h4" />
        </>
      )
    case 'armario':
      // O degrau no meio (a frente do armário de cima) e os dois puxadores subindo da frente.
      return (
        <>
          <rect x="3" y="7.5" width="18" height="9" />
          <path d="M3 11.6h18M7.5 16.5v-1.6M16.5 16.5v-1.6" />
        </>
      )
    case 'aparador':
      // Comprido e raso: a borda do tampo, baixa, e o encontro das portas descendo até a frente.
      return (
        <>
          <rect x="2" y="9" width="20" height="6" />
          <path d="M2 13.3h20M12 13.3V15" />
        </>
      )
    case 'fogueira':
      // A roda de pedras (as duas bordas e as juntas entre elas) e a lenha em X no meio.
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="6.3" />
          <path d="M17.8 14.4l2.5 1.0M14.4 17.8l1.0 2.5M9.6 17.8l-1.0 2.5M6.2 14.4l-2.5 1.0M6.2 9.6l-2.5-1.0M9.6 6.2l-1.0-2.5M14.4 6.2l1.0-2.5M17.8 9.6l2.5-1.0" />
          <path d="M8.3 9.4l7.4 5.2M8.3 14.6l7.4-5.2" />
        </>
      )
    case 'tapete':
      // O corpo, o losango do medalhão e três fios de franja em cada ponta curta.
      return (
        <>
          <rect x="4.5" y="6" width="15" height="12" />
          <path d="M12 8.6l4.4 3.4-4.4 3.4-4.4-3.4z" />
          <path d="M4.5 8.5H2.5M4.5 12H2.5M4.5 15.5H2.5M19.5 8.5h2M19.5 12h2M19.5 15.5h2" />
        </>
      )
    // As peças novas do lote 1 (MT4), de cima como o desenho com textura delas.
    case 'mesaQuadrada':
      // O tampo quadrado e as juntas das tábuas.
      return (
        <>
          <rect x="5" y="5" width="14" height="14" />
          <path d="M5 9.7h14M5 14.3h14" />
        </>
      )
    case 'mesaRedonda':
      // O tampo redondo e duas juntas de tábua perto das bordas, como a quadrada (no meio liam como sinal de menos).
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M4.8 8.5h14.4M4.8 15.5h14.4" />
        </>
      )
    case 'lapide':
      // A pedra em pé de topo em arco, a cruz gravada e o chão (o retângulo deitado era igual ao baú).
      return (
        <>
          <path d="M7.5 19.5V10a4.5 4.5 0 0 1 9 0v9.5" />
          <path d="M4.5 19.5h15M12 10.5v5.5M10 12.3h4" />
        </>
      )
    case 'vaso':
      // A boca do vaso e três folhas saindo do meio.
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 12c-1.6-1.3-1.6-3.2 0-4.6 1.6 1.4 1.6 3.3 0 4.6zM12 12c1.3 1.6 3.2 1.6 4.6 0-1.4-1.6-3.3-1.6-4.6 0zM12 12c-1.3 1.6-3.2 1.6-4.6 0 1.4-1.6 3.3-1.6 4.6 0z" />
        </>
      )
    case 'lampiao':
      // A lanterna de perfil: a argola, o chapéu, o vidro com as duas hastes e a base (de cima ela era um quadrado no quadrado).
      return (
        <>
          <circle cx="12" cy="3.8" r="1.3" />
          <path d="M8.5 8.2h7l-1.6-2.9h-3.8z" />
          <rect x="9" y="8.2" width="6" height="9" rx="0.8" />
          <path d="M8 19.8h8M12 10.2v5" />
        </>
      )
    case 'quadroDeAvisos':
      // A moldura, dois papéis tortos e os dois pés (com três papéis retos parecia uma caixa com três pontos).
      return (
        <>
          <rect x="3" y="5" width="18" height="11.5" />
          <path d="M6.3 8.4l4-0.7 0.7 4.6-4 0.7zM13.2 7.8l4.3 0.6-0.6 5-4.3-0.6zM6.5 16.5v3.5M17.5 16.5v3.5" />
        </>
      )
    case 'poco':
      // O anel de 8 pedras (tracejado), a boca e a trave com o sarilho (com dois aros lisos parecia o barril).
      return (
        <>
          <circle cx="12" cy="12" r="7.5" strokeDasharray="4.4 1.5" />
          <circle cx="12" cy="12" r="4.4" />
          <path d="M3 12h18M10.3 10.6h3.4v2.8h-3.4z" />
        </>
      )
    case 'barraca':
      // O toldo, os 3 gomos da beira e o balcão embaixo (as listras de pé liam como código de barras).
      return (
        <>
          <path d="M4 4h16v7H4zM4 11a2.67 2.67 0 0 0 5.33 0a2.67 2.67 0 0 0 5.34 0a2.67 2.67 0 0 0 5.33 0" />
          <rect x="5" y="16" width="14" height="4" />
        </>
      )
    case 'carroca':
      // A caixa, as 2 rodas e o varal (de cima, com as rodas em barra, parecia uma tomada).
      return (
        <>
          <rect x="7.5" y="7" width="13" height="8.5" />
          <circle cx="11" cy="17.5" r="2.5" />
          <circle cx="17" cy="17.5" r="2.5" />
          <path d="M7.5 11.5H2.5" />
        </>
      )
    // As peças novas do lote 2 (MT5).
    case 'sebe':
      // Três lóbulos de r 3,2 sobre a base reta, 8 de altura (a 6 de altura a fileira de copinhas lia como cápsula achatada).
      return <path d="M3.8 16V11.2a3.2 3.2 0 0 1 5.7-2a3.2 3.2 0 0 1 5 0a3.2 3.2 0 0 1 5.7 2V16z" />
    case 'jardineira':
      // O cocho de frente e três flores acima da borda (de cima, a caixa com bolinhas lia como teclado).
      return (
        <>
          <path d="M4 13h16l-1.5 6h-13z" />
          <circle cx="7.5" cy="10" r="2" />
          <circle cx="12" cy="9" r="2" />
          <circle cx="16.5" cy="10" r="2" />
        </>
      )
    case 'arcoDoPortao':
      // De frente: os dois postes, a trave por cima e a placa pendurada por duas correntinhas (de cima ele lia como drone).
      return (
        <>
          <path d="M5 21V7M19 21V7M3 7h18M10 7v3M14 7v3" />
          <rect x="8.5" y="10" width="7" height="4.5" />
        </>
      )
    case 'placaDeSeta':
      // A tábua com rabo de andorinha apontando e o poste embaixo (com o círculo no meio ela lia como pilha).
      return <path d="M4 6h11l4 3.5-4 3.5H4l2-3.5zM9 13v8" />

    case 'tapeteLongo':
      // A passadeira em pé: comprida e estreita, um losango por casa e a franja nas pontas.
      return (
        <>
          <rect x="8" y="3.5" width="8" height="17" />
          <path d="M12 6.2l1.8 1.8-1.8 1.8-1.8-1.8zM12 14.2l1.8 1.8-1.8 1.8-1.8-1.8z" />
          <path d="M9.5 3.5V2M12 3.5V2M14.5 3.5V2M9.5 20.5V22M12 20.5V22M14.5 20.5V22" />
        </>
      )
    case 'fogo':
      // Três línguas em pé (a do meio mais alta), a chama da fogueira repetida, sobre o chão queimado.
      return (
        <>
          <path d="M12 3c1.6 3 4 5 4 9a4 4 0 0 1-8 0c0-4 2.4-6 4-9z" />
          <path d="M6.5 9.5c.9 1.7 2 2.9 2 5a2 2 0 0 1-4 0c0-2.1 1.1-3.3 2-5zM17.5 9.5c.9 1.7 2 2.9 2 5a2 2 0 0 1-4 0c0-2.1 1.1-3.3 2-5z" />
          <path d="M3 20.5h18" />
        </>
      )
    // Móveis de casa (28/10/2026), de frente, como a lápide e a jardineira: de cima eles liam como caixas.
    case 'fogao':
      // O corpo sobre os pés, a chapa, o cano subindo e a portinha da lenha.
      return (
        <>
          <rect x="4" y="9" width="16" height="9.5" rx="1" />
          <path d="M3 9h18M15.5 9V3.5h2.5V9M6 18.5V21M18 18.5V21" />
          <rect x="8" y="12" width="8" height="3.5" />
        </>
      )
    case 'geladeira':
      // O armário alto em duas portas (a do gelo em cima, menor), com os trincos.
      return (
        <>
          <rect x="6" y="3" width="12" height="18" rx="1" />
          <path d="M6 9.5h12M15 5.2v2.2M15 11.8v3.4" />
        </>
      )
    case 'pia':
      // A bica sobre a cuba funda, embutida no tampo.
      return (
        <>
          <path d="M3 11h18M6 11v3.5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V11" />
          <path d="M12 11V5.5h3.5V7.5" />
        </>
      )
    case 'pratos':
      // De cima, como na mesa: o prato com a aba e o garfo ao lado (o prato sozinho seria o barril).
      return (
        <>
          <circle cx="10" cy="13" r="7" />
          <circle cx="10" cy="13" r="4" />
          <path d="M20 21V9.5M18.3 3.5v4a1.7 1.7 0 0 0 3.4 0v-4M20 3.5v4" />
        </>
      )
    case 'privada':
      // De lado: a caixa de descarga na parede, o assento e o vaso descendo até o pé.
      return (
        <>
          <rect x="5" y="3" width="7" height="6.5" />
          <path d="M5 13h14M6.5 13a5.5 5.5 0 0 0 5.5 5.5h1M12 18.5V21h-3M10 9.5V13" />
        </>
      )
    case 'sofa':
      // De frente: o encosto, os dois braços mais baixos e as duas almofadas.
      return (
        <>
          <path d="M5 13V7.5A1.5 1.5 0 0 1 6.5 6h11A1.5 1.5 0 0 1 19 7.5V13" />
          <path d="M2.5 11h2.5v7h14v-7h2.5v7.5h-19zM5 14h14M12 14v4M4 18.5v2M20 18.5v2" />
        </>
      )
    case 'poltrona':
      // De frente, estreita e funda: o encosto alto, os braços largos e uma almofada.
      return (
        <>
          <path d="M8 13V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V13" />
          <path d="M4 10.5h4V18h8v-7.5h4V19H4zM8 14.5h8M5.5 19v2M18.5 19v2" />
        </>
      )
    case 'balcao':
      // Comprido, o tampo com a beira da frente e a barra de pé rente ao chão.
      return (
        <>
          <rect x="2" y="8" width="20" height="3" />
          <path d="M3.5 11v7.5h17V11M2 20.5h20" />
        </>
      )
    // Lareira e oficina (29/10/2026), de frente como os móveis de casa.
    case 'lareira':
      // O peito da chaminé, o consolo de ponta a ponta e a boca em arco com a chama.
      return (
        <>
          <path d="M8 8.5V3h8v5.5M3 8.5h18v2H3zM4.5 10.5V21h15V10.5M2 21h20" />
          <path d="M8.5 21v-4.5a3.5 3.5 0 0 1 7 0V21" />
          <path d="M12 20.2c-1.3-.7-1.6-2-.4-3.4.2.8.7 1.2 1.1 1.6.6.6.4 1.4-.7 1.8z" />
        </>
      )
    case 'fornalha':
      // A coifa sobre a bancada, a chaminé saindo dela e o monte de brasas no meio.
      return (
        <>
          <path d="M10.5 2.5h3V6M6 10.5 10 6h4l4 4.5" />
          <rect x="3" y="10.5" width="18" height="3" />
          <path d="M5 13.5V21h14v-7.5M9.5 10.5c.6-1.2 1.4-1.7 2.5-1.7s1.9.5 2.5 1.7" />
        </>
      )
    case 'bigorna':
      // O chifre afinando para a esquerda, a mesa reta, a cintura e o toco embaixo.
      return (
        <>
          <path d="M2.5 6.5C4.8 6 6.3 6 8 6h12v3.5h-4.5l-1 2.5h1.5v1.5h-8V12h1.5l-1-2.5C6 9.5 4 8.6 2.5 6.5z" />
          <path d="M7.5 13.5v7h9v-7" />
        </>
      )
    case 'balde':
      // Mais largo na boca, os dois aros e a alça em arco.
      return (
        <>
          <path d="M4.5 10h15l-1.6 10.5H6.1z" />
          <path d="M5 13.3h14M5.7 17.5h12.6M6 10a6 6 0 0 1 12 0" />
        </>
      )
    // Troncos e feno (29/10/2026). As duas formas de cada um dividem o ícone (o painel troca a forma).
    case 'troncos':
      // Três toras de ponta, em pirâmide, cada uma com o miolo do corte.
      return (
        <>
          <circle cx="8" cy="16.5" r="3.8" />
          <circle cx="16" cy="16.5" r="3.8" />
          <circle cx="12" cy="9.6" r="3.8" />
          <path d="M8 16.5h.01M16 16.5h.01M12 9.6h.01" />
        </>
      )
    case 'feno':
      // O fardo de lado: o bloco, as duas cordas em volta e uns fios espetados no alto.
      return (
        <>
          <rect x="3" y="8.5" width="18" height="11" rx="1.5" />
          <path d="M9 8.5v11M15 8.5v11M5.5 8.5 4.6 6.6M12 8.5l.3-2M18.4 8.5l1-1.8" />
        </>
      )
    // O chafariz (02/11/2026), de lado: a bacia larga embaixo, a coluna, o prato e o jato abrindo em dois
    // arcos que caem nas bordas do prato. As duas formas dividem o ícone (o painel troca a forma).
    case 'chafariz':
      return (
        <>
          <path d="M3 15.5h18l-1.6 5H4.6z" />
          <path d="M11 15.5v-3.2h2v3.2M7.5 9.5h9c0 1.6-2 2.8-4.5 2.8s-4.5-1.2-4.5-2.8z" />
          <path d="M12 9.5V3.5M12 3.5c-2.2 0-3.6 1.6-4 4M12 3.5c2.2 0 3.6 1.6 4 4" />
        </>
      )
    // Os objetos de vento (02/11/2026), de frente, como ficam no mapa (as pás em pé).
    case 'cataVento':
      // A torre de pés abertos, a roda de muitas pás no alto e o leme saindo para o lado.
      return (
        <>
          <path d="M9 21.5 11.2 12h1.6l2.2 9.5M10 17.5h4" />
          <circle cx="12" cy="8.5" r="5.5" />
          <path d="M12 3v11M6.5 8.5h11M8.1 4.6l7.8 7.8M15.9 4.6l-7.8 7.8M12 8.5l8.5 1.5 1 2.5-6.5-1.2" />
        </>
      )
    case 'moinho':
      // A torre de pedra com o telhado em cone, e as quatro velas em X saindo do alto.
      return (
        <>
          <path d="M8 21.5 9 13.5h6l1 8zM9 13.5 12 10l3 3.5" />
          <path d="M12 10 5 3.5M12 10l7-6.5M12 10l-6.5 6M12 10l6.5 6" />
          <path d="M5 3.5 3.6 5l5.6 5M19 3.5 20.4 5l-5.6 5" />
        </>
      )
    case 'cataVentoBrinquedo':
      // As quatro folhas dobradas em redemoinho, no alto do palito.
      return (
        <>
          <path d="M12 9v12.5" />
          <path d="M12 9V2.5l4 4.3zM12 9h6.5l-4.3 4zM12 9v6.5l-4-4.3zM12 9H5.5l4.3-4z" />
        </>
      )
    // A ponte (03/11/2026), de lado: o tabuleiro em arco, o corrimão com três postes e o vão do arco embaixo,
    // com a água. As três formas dividem o ícone (o painel troca a forma).
    case 'ponte':
      return (
        <>
          <path d="M2 14c3.2-3.2 6.4-4.8 10-4.8s6.8 1.6 10 4.8M2.5 10.2c3-3 6-4.5 9.5-4.5s6.5 1.5 9.5 4.5" />
          <path d="M6.2 8v4M12 5.7v3.5M17.8 8v4" />
          <path d="M6 19.5c.9-3.1 3.1-4.9 6-4.9s5.1 1.8 6 4.9M2.5 21.5h3M18.5 21.5h3" />
        </>
      )
    // O cemitério (07/11/2026), de cima como a arte: 1 x 2 casas, em pé.
    case 'cova':
      // O monte de terra comprido, a beira da terra escura de través e uma pedra.
      return (
        <>
          <rect x="7" y="2.5" width="10" height="19" rx="5" />
          <path d="M7 12.5c2-1 3.5.8 5 0s3-1.2 5-.3M10.5 15.5l2.5-.8.7 1.8-2.4.9z" />
        </>
      )
    case 'caixao':
      // O hexágono da tampa (a cabeça estreita, o ombro largo) e a emenda das duas tábuas.
      return (
        <>
          <path d="M9.5 2.5h5l3 5-1.5 14h-8l-1.5-14z" />
          <path d="M12 2.5v19" />
        </>
      )
    case 'caixaoAberto':
      // O mesmo hexágono, a tampa da cabeça de través e o forro por dentro.
      return (
        <>
          <path d="M9.5 2.5h5l3 5-1.5 14h-8l-1.5-14z" />
          <path d="M6.8 9h10.4M9.3 11.5h5.4l-1 7.5h-3.4z" />
        </>
      )
    // Destroços e sucata (10/11/2026), de cima como o desenho do mapa.
    case 'destrocosDeMadeira':
      // Três tábuas cruzadas, duas com a ponta lascada em dentes.
      return (
        <>
          <path d="M2.5 15.2l15.6-3.4 1 1-.7 1.1 1.3.6-.5 1.5L3.2 18.6z" />
          <path d="M6.2 3.4l2.8-.9 5.4 16.9-2.8.9z" />
          <path d="M13.4 12.2l5.2-8 .2 1.6 1.2-.9.3 1.5 1.2-.2-5.4 8.2" />
        </>
      )
    case 'sucataChapas':
      // A chapa torta com o canto dobrado e a viga atravessada por cima.
      return (
        <>
          <path d="M3.5 8.5l11-3 5.5 11.5-12.5 4z" />
          <path d="M16.2 8.6l-3.4 1 3.9 1.8" />
          <path d="M2.5 13.6l18-9.4M3.6 15.8l18-9.4" />
        </>
      )
    case 'sucataEngrenagens':
      // A roda dentada grande com o furo do eixo e a pequena engrenada nela.
      return (
        <>
          <circle cx="9.5" cy="13.5" r="5" />
          <circle cx="9.5" cy="13.5" r="1.6" />
          <path d="M9.5 6.5v2M9.5 18.5v2M2.5 13.5h2M14.5 13.5h2M4.6 8.6l1.4 1.4M13 17l1.4 1.4M4.6 18.4L6 17M13 10l1.4-1.4" />
          <circle cx="18" cy="6.5" r="2.6" />
          <path d="M18 2.4v1.5M18 9.1v1.5M13.9 6.5h1.5M20.6 6.5h1.5" />
        </>
      )
    case 'sucataTambores':
      // O tambor em pé (a boca amassada, com o bujão) e o deitado na frente, com os dois aros.
      return (
        <>
          <path d="M3 8a5 5 0 0 1 9.6-1.6L10.8 9l1.4 2.4A5 5 0 0 1 3 8z" />
          <path d="M6 6.4h.01" />
          <rect x="7.5" y="14" width="14" height="7" rx="1.6" />
          <path d="M12 14v7M17 14v7" />
        </>
      )
    // O campinho (10/11/2026), de cima: as linhas de fora, a do meio, o círculo central e as duas áreas.
    case 'campinho':
      return (
        <>
          <rect x="2" y="5" width="20" height="14" />
          <path d="M12 5v14M2 9h3.5v6H2M22 9h-3.5v6H22" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      )
    // Lote 1 dos 95 objetos novos (11/11/2026): o ícone que cada desenhista entregou com o desenho.
    case 'bonecoDeTreino':
      // De frente: a cabeça de saco, a travessa dos braços, o corpo de palha com a corda, o poste e a base em cruz.
      return (
        <>
          <circle cx="12" cy="4.6" r="2.6" />
          <path d="M3 9h18" />
          <path d="M8.5 7.6h7l-1 8h-5z" />
          <path d="M8.8 11.5h6.4" />
          <path d="M12 15.6v4M6.5 21.5l11-3M6.5 18.5l11 3" />
        </>
      )
    case 'pilar':
      // De frente: o plinto, o toro, o fuste com duas caneluras e o capitel largo no alto (de cima era um alvo, como o barril).
      return (
        <>
          <path d="M5 19h14v2.5H5zM7 19v-1.8h10V19" />
          <path d="M8.5 17.2V7.5M15.5 17.2V7.5M10.8 17.2V7.5M13.2 17.2V7.5" />
          <path d="M8.5 7.5 6 5V3h12v2l-2.5 2.5z" />
        </>
      )
    case 'altar':
      // De frente: o degrau, o bloco, o tampo grosso, o pano caindo no meio com a barra e, em cima, a tigela entre as duas velas apagadas.
      return (
        <>
          <path d="M2.5 21.5h19v-2.5h-19zM5 19v-7.5M19 19v-7.5" />
          <rect x="4" y="9" width="16" height="2.5" />
          <path d="M9.5 11.5v5h5v-5M9.5 15h5" />
          <path d="M7 9V5.5M17 9V5.5M10 7h4a2 2 0 0 1-4 0z" />
        </>
      )
    case 'estanteDeLivros':
      // De frente: a estante alta, duas prateleiras, os livros em pé (um tombado) e uma pilha deitada embaixo.
      return (
        <>
          <rect x="4" y="2.5" width="16" height="19" />
          <path d="M4 8.5h16M4 14.5h16" />
          <path d="M7 8.5V5M9.5 8.5V4.5M12 8.5V5.5M16.5 8.5l-1.6-3.6" />
          <path d="M8 14.5V11M13 14.5v-4M15.5 14.5v-3M17.5 14.5V11" />
          <path d="M6.5 21.5V18M9 21.5V17M14 19.5h4M14 21.5v-2M18 21.5v-2" />
        </>
      )
    case 'sacosDeGrao':
      // O saco de frente: o corpo gordo fechado pela amarra, a boca franzida acima dela e três grãos (com a espiga o miolo virava borrão).
      return (
        <>
          <path d="M8.5 8.5C5.3 10.8 3.5 13.8 3.5 17a3.5 3.5 0 0 0 3.5 3.5h10a3.5 3.5 0 0 0 3.5-3.5c0-3.2-1.8-6.2-5-8.5z" />
          <path d="M8.5 8.5 7 4.5l2.6 1.2L12 4l2.4 1.7L17 4.5l-1.5 4" />
          <path d="M9.5 14.2h.01M14.5 14.2h.01M12 17h.01" />
        </>
      )
    case 'bancoDePraca':
      // De frente: as duas ripas do encosto entre os montantes, o assento, os dois braços de ferro e os pés.
      return (
        <>
          <path d="M5 4.5v9M19 4.5v9M5 6.5h14M5 10h14" />
          <rect x="3" y="13.5" width="18" height="2.2" />
          <path d="M5 11.5H3v2M19 11.5h2v2M4.5 15.7V21M19.5 15.7V21" />
        </>
      )
    case 'escombrosDePedra':
      // O monte de blocos tombados: dois no chão, um atravessado por cima e as pedrinhas soltas em volta.
      return (
        <>
          <path d="M3 20.5l1.2-6.2 7 .9-.6 5.3z" />
          <path d="M11.8 20.5l.8-5 7.6 1.3-1 3.7z" />
          <path d="M8.5 13.9l3-5.9 6 2.8-2.5 4.8z" />
          <path d="M21 13.5h.01M5 10.5h.01M21.5 20.5h.01" />
        </>
      )
    case 'canhao':
      // De lado: o cano afinando até a tulipa da boca, com um anel, o botão do cascavel atrás, a carreta em degrau e as duas rodas.
      return (
        <>
          <path d="M4.5 7.5 19 8.6l2-.6v4.5l-2-.6L4.5 13z" />
          <circle cx="3" cy="10.2" r="1.2" />
          <path d="M9.5 7.9v4.7M16.5 12.1v4.4h-13v-1.8H6v-1.6" />
          <circle cx="6.5" cy="18.6" r="2.3" />
          <circle cx="14" cy="18.6" r="2.3" />
        </>
      )
    // Lote 2 dos 95 objetos novos (11/11/2026): o ícone que cada desenhista entregou com o desenho.
    case 'guardaRoupa':
      // De frente: a cornija larga no alto, as duas portas com a almofada de cada uma, os dois puxadores junto do meio e os pés.
      return (
        <>
          <path d="M3.5 2.5h17v2.6h-17z" />
          <rect x="4.5" y="5.1" width="15" height="14.9" />
          <path d="M12 5.1V20" />
          <rect x="6.6" y="7.2" width="3.3" height="6.2" />
          <rect x="14.1" y="7.2" width="3.3" height="6.2" />
          <path d="M10.5 16h.01M13.5 16h.01" />
          <path d="M6 20v1.5M18 20v1.5" />
        </>
      )
    case 'caldeirao':
      // De frente: o beiço, a barriga redonda com as duas orelhas, os três pés e o vapor subindo do caldo (o balde é reto e tem alça).
      return (
        <>
          <path d="M4.5 9.5h15" />
          <path d="M6 9.5c-1.3 1.5-2 3.2-2 5a6 6 0 0 0 6 6h4a6 6 0 0 0 6-6c0-1.8-.7-3.5-2-5" />
          <path d="M4 13H2.5M20 13h1.5M7.5 20 6.5 22.5M16.5 20l1 2.5M12 20.5v2" />
          <path d="M9.5 6.5c-.8-1 .8-1.7 0-3M14.5 6.5c-.8-1 .8-1.7 0-3" />
        </>
      )
    case 'fornoDePao':
      // De frente: a cúpula redonda com a chaminé curta, a boca em arco com um pão dentro e a soleira (a lareira é quadrada e tem consolo).
      return (
        <>
          <path d="M3.5 20v-7a8.5 8.5 0 0 1 17 0v7" />
          <path d="M14 4.8V2.5h3v3.6" />
          <path d="M8.5 20v-4a3.5 3.5 0 0 1 7 0v4" />
          <ellipse cx="12" cy="18.2" rx="2.2" ry="1.2" />
          <path d="M2 20h20" />
        </>
      )
    case 'prateleiraDeDeposito':
      // De frente: os dois montantes até o chão, as três tábuas e a carga nas duas de baixo, um pote redondo e um caixote em cada.
      return (
        <>
          <path d="M4 2.5v19M20 2.5v19" />
          <path d="M4 4h16M4 11.5h16M4 19h16" />
          <circle cx="8.7" cy="8.1" r="2.6" />
          <rect x="13.3" y="6.6" width="4.2" height="4.9" />
          <rect x="6.6" y="14.6" width="5.2" height="4.4" />
          <circle cx="15.4" cy="15.6" r="2.6" />
        </>
      )
    case 'estatua':
      // De frente: a figura de capa em cima do pedestal (a cabeça, o corpo abrindo até o pé), a espada de ponta para baixo na frente dela e o pedestal com a cornija e o soco.
      return (
        <>
          <circle cx="12" cy="4.2" r="1.9" />
          <path d="M9.6 7h4.8l1.8 7.5H7.8z" />
          <path d="M12 8.2v6.3M10.4 9.8h3.2" />
          <path d="M6.5 14.5h11v2h-11zM8 16.5V20h8v-3.5M5.5 20h13v2h-13z" />
        </>
      )
    case 'pedrasERochas':
      // A rocha grande de facetas (as arestas que descem do alto dela), a média encostada nela e duas pedrinhas no chão.
      return (
        <>
          <path d="M2.5 19.5 4 12.5 8 7l5 1.5 2.5 5 .5 6z" />
          <path d="M8 7l1 5.5H4M9 12.5l4 1 3 6M9 12.5l-1.5 7" />
          <path d="M16 19.5l.8-4 3-1.5 2.2 2.5-.5 3z" />
          <path d="M3 22h.01M12.5 22h.01" />
        </>
      )
    case 'mausoleu':
      // De frente: o frontão em triângulo, a cornija, as duas colunas dos cantos, a porta de duas folhas no meio e os degraus.
      return (
        <>
          <path d="M3 9l9-6 9 6z" />
          <path d="M4 9v2.2h16V9M5.5 11.2v8M18.5 11.2v8" />
          <path d="M9.5 19.2v-6h5v6M12 13.2v6" />
          <path d="M3.5 19.2h17M2 21.5h20" />
        </>
      )
    case 'alvoDeArcoEFlecha':
      // De frente: o disco com um anel e a mosca, uma flecha cravada perto do meio (as penas para fora), os dois pés do cavalete e a travessa.
      return (
        <>
          <circle cx="11" cy="10" r="7.5" />
          <circle cx="11" cy="10" r="4.2" />
          <path d="M11 10h.01" />
          <path d="M12.8 8.2 20.5 1.5M18 4V1.5M18 4h2.5" />
          <path d="M6.6 16.1 4 21.5M15.4 16.1l2.6 5.4" />
          <path d="M5.4 18.6h11.2" />
        </>
      )
    // Lote 3 dos 95 objetos novos (11/11/2026): o ícone que cada desenhista entregou com o desenho.
    case 'bancaDeFrutas':
      // De frente: o caixote de ripas sobre os pés e, em cima, a maçã grande com o cabinho e a folha entre duas frutas menores (o caixote com três bolas em fila era a jardineira).
      return (
        <>
          <path d="M2.5 11.5h19V17h-19zM2.5 14.2h19M5.5 17v4.5M18.5 17v4.5" />
          <circle cx="12" cy="7.9" r="3.4" />
          <path d="M12 4.5V3M12 3.6c1.1-1.4 2.4-1.8 3.7-1.4" />
          <circle cx="6" cy="9.3" r="2" />
          <circle cx="18" cy="9.3" r="2" />
        </>
      )
    case 'toldoListrado':
      // De frente: as duas estacas até o chão, o pano com a barriga no meio, as listras e a sanefa em gomos (sem o balcão da barraca; de cima, o quadrado com quatro bolas nos cantos lia como drone).
      return (
        <>
          <path d="M4 3v18.5M20 3v18.5" />
          <path d="M4 4.8c2.6 1.4 5.2 2 8 2s5.4-.6 8-2" />
          <path d="M4 9.6a2 2 0 0 0 4 1a2 2 0 0 0 4 .6a2 2 0 0 0 4-.6a2 2 0 0 0 4-1" />
          <path d="M8 6.3v4.3M12 6.8v4.4M16 6.3v4.3" />
        </>
      )
    case 'bancadaDeFerramentas':
      // De frente: o tampo grosso, as duas pernas com a prateleira de baixo, a morsa na ponta (o mordente, o fuso e a manivela) e o martelo em cima.
      return (
        <>
          <path d="M2.5 9.5h19v3h-19z" />
          <path d="M4.5 12.5v9M19.5 12.5v9M4.5 17.5h15" />
          <path d="M5 9.5V6h3.5v3.5M6.7 6V4M5.4 4h2.7" />
          <path d="M13 8.5l5-4M16.6 3.2l2.6 2.9" />
        </>
      )
    case 'pedraDeAmolar':
      // De frente: a roda de pedra com o cubo, o trilho do cavalete na frente dela, as duas pernas, a calha e a manivela.
      return (
        <>
          <circle cx="12" cy="9" r="6.5" />
          <path d="M12 9h.01" />
          <path d="M3 13.5h18M5 13.5v8M19 13.5v8" />
          <path d="M7.5 13.5v4h9v-4" />
          <path d="M12 9l3.2 2.4v2.4" />
        </>
      )
    case 'suporteDeArmas':
      // De frente: os dois postes com as duas travessas, a espada (a guarda atravessada), a lança de ponta em folha, o machado e o escudo redondo no pé.
      return (
        <>
          <path d="M2.5 11v10.5M21.5 11v10.5M2.5 13h19M2.5 19.5h19" />
          <path d="M6.5 19.5V5.5M4.7 8.3h3.6" />
          <path d="M11 19.5V6l-1.2-2.2L11 1.5l1.2 2.3L11 6" />
          <path d="M15 19.5V6.5M15 7.2h2.6l1 2.4-1 2H15" />
          <circle cx="18" cy="17.5" r="3.3" />
        </>
      )
    case 'espantalho':
      // De frente: o chapéu de aba larga, a cabeça, os braços abertos com a palha saindo dos punhos, a camisa e o poste fincado no chão.
      return (
        <>
          <path d="M6 6.2h12M9.3 6.2l.9-3.7h3.6l.9 3.7" />
          <circle cx="12" cy="8.7" r="2.3" />
          <path d="M4 12.2h16M4 12.2l-1.8-1.3M4 12.2l-1.8 1.3M20 12.2l1.8-1.3M20 12.2l1.8 1.3" />
          <path d="M9.2 11.2h5.6l1.4 6.8H7.8z" />
          <path d="M12 18v3.5M9 21.5h6" />
        </>
      )
    case 'cocho':
      // De lado: o cocho comprido, mais largo na boca, a água em onda dentro dele e os dois pés (a jardineira tem flores e não tem pés; o balde é alto e tem alça).
      return (
        <>
          <path d="M2.5 8.5h19l-1.6 7h-15.8z" />
          <path d="M5.2 11.6c1.1-.8 2.3-.8 3.4 0s2.3.8 3.4 0 2.3-.8 3.4 0 2.3.8 3.4 0" />
          <path d="M6.5 15.5v5M17.5 15.5v5M4.8 20.5h3.4M15.8 20.5h3.4" />
        </>
      )
    case 'ossos':
      // O crânio (a caixa redonda, o queixo estreito, as duas órbitas e dois dentes) e, embaixo, um osso comprido com os nós nas pontas.
      return (
        <>
          <path d="M9 11.4a4.5 4.5 0 1 1 6 0v2.6H9z" />
          <circle cx="10.4" cy="8.6" r="1" />
          <circle cx="13.6" cy="8.6" r="1" />
          <path d="M11 14v-1.5M13 14v-1.5" />
          <path d="M5.5 20.2l13-2.4M5.5 20.2l-1.9-.7M5.5 20.2l-1.1 1.6M18.5 17.8l1.9.7M18.5 17.8l1.1-1.6" />
        </>
      )
    case 'antenaParabolica':
      // De lado: o prato virado para o céu (a boca reta e as costas em arco), as duas hastes até o receptor no foco, o mastro e a base no chão.
      return (
        <>
          <path d="M4 4.5Q4.2 15.3 14.5 15.5z" />
          <path d="M4 4.5l9.6 1.7M14.5 15.5l-.9-9.3" />
          <circle cx="14.6" cy="5.3" r="1.4" />
          <path d="M7.6 13.6v7.9M4.5 21.5h6.5" />
        </>
      )
    // Lote 4 dos 95 objetos novos (11/11/2026): o ícone que cada desenhista entregou com o desenho.
    case 'escrivaninha':
      // De frente: o tampo, os dois pedestais com duas gavetas cada (o puxador de cada uma), o vão dos joelhos no meio e a pena no tinteiro em cima.
      return (
        <>
          <path d="M2.5 9.5h19" />
          <path d="M3.5 9.5v11h5.5v-11M15 9.5v11h5.5v-11" />
          <path d="M3.5 15h5.5M15 15h5.5" />
          <path d="M6.25 12.3h.01M6.25 17.8h.01M17.75 12.3h.01M17.75 17.8h.01" />
          <path d="M15.5 9.5V7.2h3v2.3" />
          <path d="M17 7.2 20.8 2.2l.4 2.8-2.3-.25" />
        </>
      )
    case 'criadoMudo':
      // De frente: o tampo, a gaveta com o puxador, o nicho aberto entre os dois pés e, em cima, a vela acesa (a chama em losango) e o livro deitado.
      return (
        <>
          <path d="M4 11h16" />
          <path d="M5.5 11v10.5M18.5 11v10.5" />
          <path d="M5.5 15.5h13M5.5 19.5h13" />
          <path d="M12 13.3h.01" />
          <path d="M7.5 11V7h2.2v4" />
          <path d="M8.6 5.2 7.6 3.7 8.6 1.8l1 1.9z" />
          <path d="M13.5 11V9h5v2" />
        </>
      )
    case 'camaDeCasal':
      // De cima, larga: a cabeceira passando dos lados, os dois travesseiros e a dobra do lençol (a de solteiro é estreita, com um travesseiro só).
      return (
        <>
          <rect x="3" y="3.5" width="18" height="17.5" />
          <path d="M2 3.5h20" />
          <rect x="5" y="5.6" width="6" height="3.8" />
          <rect x="13" y="5.6" width="6" height="3.8" />
          <path d="M3 11.6h18M3 14h18" />
        </>
      )
    case 'berco':
      // De lado: a cabeceira alta de topo redondo, a peseira, a grade de ripas entre as duas travessas e o balanço em arco embaixo.
      return (
        <>
          <path d="M4 17V5.5a1.5 1.5 0 0 1 3 0v3M20 6.5V17" />
          <path d="M4 8.5h16M4 17h16" />
          <path d="M10.2 8.5V17M13.5 8.5V17M16.8 8.5V17" />
          <path d="M2.5 19c3.2 2.6 15.8 2.6 19 0M5.5 17v3.3M18.5 17v3.3" />
        </>
      )
    case 'banqueta':
      // De frente: o assento grosso em cima, os três pés abrindo para baixo (o do meio reto) e a travessa entre eles.
      return (
        <>
          <rect x="5.5" y="4.5" width="13" height="3" rx="1.2" />
          <path d="M8 7.5 4.5 20.5M16 7.5l3.5 13M12 7.5v13" />
          <path d="M6.2 15h11.6" />
        </>
      )
    case 'biombo':
      // De frente: as quatro folhas em sanfona (uma sobe, a outra desce) e a risca da almofada de madeira, embaixo, de folha em folha.
      return (
        <>
          <path d="M3 6.5 7.5 4v14.5L3 21zM7.5 4l4.5 2.5V21l-4.5-2.5M12 6.5 16.5 4v14.5L12 21M16.5 4 21 6.5V21l-4.5-2.5" />
          <path d="M3 15.5l4.5-2.5 4.5 2.5 4.5-2.5 4.5 2.5" />
        </>
      )
    case 'piano':
      // De frente: a tampa mais larga que a caixa, o painel, o teclado saindo dela com as pretas em duas e três, os dois consolos e o banquinho no meio.
      return (
        <>
          <path d="M3 2.5h18M4 2.5v9.5M20 2.5v9.5" />
          <rect x="8" y="5" width="8" height="4" />
          <rect x="2.5" y="12" width="19" height="3.5" />
          <path d="M6 12v2M8.5 12v2M12.5 12v2M15 12v2M17.5 12v2" />
          <path d="M3.5 15.5v6M20.5 15.5v6" />
          <path d="M9 18.5h6M10 18.5v3M14 18.5v3" />
        </>
      )
    case 'candelabroDeChao':
      // De frente: o tripé, o mastro com o nó, os braços abertos em arco e as três velas com a chama de cada uma (o lampião é uma caixa de vidro com chapéu).
      return (
        <>
          <path d="M12 19.5v-7M7.5 21.5l4.5-2 4.5 2" />
          <circle cx="12" cy="15.8" r="1" />
          <path d="M6 9.5c0 2.4 2.6 3 6 3s6-.6 6-3" />
          <path d="M6 9.5v-3M12 12.5V5M18 9.5v-3" />
          <path d="M6 4.3h.01M12 2.8h.01M18 4.3h.01" />
        </>
      )
    case 'banheira':
      // De lado: a borda de ponta a ponta, o bojo fundo sobre os dois pés de garra, a torneira em arco numa ponta e as bolhas de espuma (a pia não tem pés nem bolhas).
      return (
        <>
          <path d="M2 10h20" />
          <path d="M3.5 10v2.5a5.5 5.5 0 0 0 5.5 5.5h6a5.5 5.5 0 0 0 5.5-5.5V10" />
          <path d="M7 18l-1.2 3.2M17 18l1.2 3.2" />
          <path d="M20.5 10V6.2a2 2 0 0 0-4 0" />
          <circle cx="7.5" cy="6.8" r="1.3" />
          <circle cx="11" cy="5.2" r="0.9" />
        </>
      )
    case 'tinaDeMadeira':
      // De frente: a tina larga e baixa com os dois aros, o vapor subindo da água e o banquinho de dois degraus ao lado (o balde é estreito e tem alça).
      return (
        <>
          <path d="M2.5 9.5H16l-1 11H3.5z" />
          <path d="M2.9 13h12.7M3.2 17h12.1" />
          <path d="M6.5 6.5c-.8-1 .8-1.7 0-3M11.5 6.5c-.8-1 .8-1.7 0-3" />
          <path d="M17.5 20.5V14H20v3h2.5v3.5z" />
        </>
      )
    case 'lavatorioComJarro':
      // De frente: a mesinha de duas pernas com a toalha pendurada na barra, a bacia em cima do tampo e o jarro de asa ao lado.
      return (
        <>
          <path d="M2.5 12.5h19M4.5 12.5v9M19.5 12.5v9" />
          <path d="M8 15h8M9.5 15v4.5h5V15" />
          <path d="M4 9h7.5c0 2-1.5 3.5-3.75 3.5S4 11 4 9z" />
          <path d="M14.3 12.5c-1-1-1.1-3 .4-4.3V6h3.2v2.2c1.5 1.3 1.4 3.3.4 4.3" />
          <path d="M17.9 6.8h1.1a1.2 1.2 0 0 1 1.2 1.2v.5a1.4 1.4 0 0 1-1.4 1.4" />
        </>
      )
    case 'prateleiraDePotes':
      // De frente, na parede: as duas tábuas com as mãos-francesas, um vidro de tampa de pano e um pote redondo em cima, um vidro no vão, e a réstia de alho e o maço de ervas pendurados embaixo.
      return (
        <>
          <path d="M2.5 9h19M2.5 14.5h19M4 9v8.5M20 9v8.5" />
          <path d="M6.5 9V4.5h4V9M6 4.5h5M13.5 14.5v-3.2h3.2v3.2" />
          <circle cx="16" cy="6.4" r="2.6" />
          <path d="M9 14.5v2M15.5 14.5v2.2l-1.6 3.6M15.5 16.7l1.6 3.6M15.5 16.7v4" />
          <circle cx="9" cy="17.7" r="1.2" />
          <circle cx="9" cy="20.3" r="1.2" />
        </>
      )
    case 'mesaDeCorte':
      // De frente: o bloco grosso do tampo sobre as duas pernas, o cutelo cravado nele (a lâmina em pé, com o furo, e o cabo para o alto) e o peixe ao lado.
      return (
        <>
          <rect x="2.5" y="11" width="19" height="4" />
          <path d="M5 15v6.5M19 15v6.5" />
          <path d="M13.5 11V5.5h4.5V11M18 6.5l3-2.5M15 7.5h.01" />
          <path d="M3.5 9.5c2-2.6 5-2.6 7 0c-2 1.6-5 1.6-7 0zM3.5 9.5l-1.5-1.3M3.5 9.5l-1.5 1M8.8 9h.01" />
        </>
      )
    case 'ganchoComCarne':
      // De frente: a trave sobre os dois postes e, pendurados nela, o presunto (o jarrete fino e o corpo gordo) e a volta de linguiça com o rabo que sobra.
      return (
        <>
          <path d="M2 4.5h20M3.5 4.5v17M20.5 4.5v17" />
          <path d="M8 4.5v3.5M8 8c-2.2 2.6-3 4.8-3 6.6a3 3 0 0 0 6 0c0-1.8-.8-4-3-6.6z" />
          <path d="M13 4.5v3a2.5 2.5 0 0 0 5 0v-3M15.5 10v3.5" />
        </>
      )
    case 'pilhaDeCaixas':
      // De frente: dois caixotes no chão, cada um com a emenda das tábuas, e um terceiro, torto, em cima dos dois, com os sarrafos em cruz (a caixa é uma só, de cima).
      return (
        <>
          <rect x="2.5" y="12.5" width="9" height="8.5" />
          <rect x="12.5" y="14" width="9" height="7" />
          <path d="M6.2 5.2l8.6-1.6 1.5 7.6-8.6 1.6z" />
          <path d="M6.2 5.2l10.1 6M14.8 3.6L7.7 12.8" />
          <path d="M2.5 16.5h9M12.5 17.5h9" />
        </>
      )
    case 'barrisDeitados':
      // De frente: os tampos redondos de dois barris lado a lado, a torneira no pé de cada um e o cavalete embaixo (o barril é um só, de cima, com dois aros; os troncos são três, em pirâmide).
      return (
        <>
          <circle cx="7" cy="10" r="5" />
          <circle cx="17" cy="10" r="5" />
          <path d="M7 12.8v2.6M17 12.8v2.6" />
          <path d="M1.5 17.5h21M4.5 17.5v3.5M19.5 17.5v3.5" />
        </>
      )
    case 'tonelDeAdega':
      // De frente: o tampo redondo grande com a travessa, a torneira embaixo, os dois pés do berço e a escadinha encostada (os barris deitados são dois, pequenos, sem escada).
      return (
        <>
          <circle cx="10" cy="10.5" r="8" />
          <path d="M2.6 8h14.8" />
          <path d="M10 14.5v3" />
          <path d="M4.3 16.2l-1 5.3M15.7 16.2l1 5.3" />
          <path d="M18.5 22l1.6-12M22.5 22l-1-12M19 18.2h3.2M19.5 14.4h2.4" />
        </>
      )
    case 'anforasDeBarro':
      // De lado: o beiço, o pescoço fino com uma asa de cada lado, o bojo que afina até o pé e as duas beiras da faixa pintada (o vaso de planta é uma boca redonda com folhas).
      return (
        <>
          <path d="M9.5 3h5M10.5 3v3.2M13.5 3v3.2" />
          <path d="M10.5 6.2C7.5 7.4 6 9.6 6 12c0 3.4 2.4 6.3 4.8 8.5h2.4C15.6 18.3 18 15.4 18 12c0-2.4-1.5-4.6-4.5-5.8" />
          <path d="M10.5 4.2C7.7 4.2 6.6 6 7.4 8.3M13.5 4.2c2.8 0 3.9 1.8 3.1 4.1" />
          <path d="M6.2 11h11.6M6.6 14.2h10.8" />
          <path d="M9.5 21.5h5" />
        </>
      )
    case 'cestoDeVime':
      // De lado: a borda grossa, o cesto bojudo com a trama (duas voltas e três estacas), uma alça em orelha de cada lado e três maçãs por cima (o balde é liso e tem a alça por cima).
      return (
        <>
          <path d="M3.5 10.5h17v2h-17z" />
          <path d="M4.5 12.5c0 4.5 1.5 7 3.5 8.5h8c2-1.5 3.5-4 3.5-8.5" />
          <path d="M5.1 15.5h13.8M6.6 18.5h10.8M9 12.5V21M12 12.5V21M15 12.5V21" />
          <path d="M3.5 11.5C1.6 11.5 1.6 15 4.7 15M20.5 11.5c1.9 0 1.9 3.5-1.2 3.5" />
          <circle cx="8.6" cy="8.2" r="2.2" />
          <circle cx="15.4" cy="8.2" r="2.2" />
          <circle cx="12" cy="6.6" r="2.4" />
        </>
      )
    case 'cofre':
      // De frente: a caixa pesada, a porta por dentro do quadro, a roda de segredo com os raios em X, a alavanca, as duas dobradiças e os pés (o baú é deitado e tem tampa; o guarda-roupa tem duas portas).
      return (
        <>
          <rect x="3" y="3" width="18" height="17" />
          <rect x="5.5" y="5.5" width="13" height="12" />
          <circle cx="13" cy="11.5" r="3.4" />
          <path d="M10.6 9.1l4.8 4.8M15.4 9.1l-4.8 4.8" />
          <path d="M8.2 10.4 7 12.8" />
          <path d="M18.5 8H21M18.5 15H21" />
          <path d="M5.5 20v1.5M18.5 20v1.5" />
        </>
      )
    case 'varalDeRoupa':
      // De frente: os dois postes, a corda entre eles, a camisa (com as mangas) e o lençol de barra ondulada, cada um com dois pregadores (o toldo listrado tem o pano com barriga e a sanefa; aqui são roupas soltas na corda).
      return (
        <>
          <path d="M3 3.5v18M21 3.5v18" />
          <path d="M3 5.5h18" />
          <path d="M7.6 5.5h3.8L13 8l-1.1.9-.9-.8v5.4H8V8.1l-.9.8L6 8z" />
          <path d="M14.8 5.5V17c.7.5 1.4.5 2.1 0 .7-.5 1.4-.5 2.1 0V5.5" />
          <path d="M8.4 4.4v1.6M10.6 4.4v1.6M15.7 4.4v1.6M18.1 4.4v1.6" />
        </>
      )
    case 'horta':
      // De lado, cortada: a linha da terra, a cenoura enterrada (com os dois riscos dela), a rama aberta em cima e, ao lado, a muda de duas folhas.
      return (
        <>
          <path d="M2.5 11.5h19" />
          <path d="M7.4 11.5 10 21l2.6-9.5" />
          <path d="M8.7 14.8h2.6M9.4 17.6h1.2" />
          <path d="M10 11.5 6.8 5.2M10 11.5V3.5M10 11.5l3.2-6.3" />
          <path d="M17.5 11.5V7.6" />
          <path d="M17.5 8.4c-1.7 0-2.6-1-2.6-2.5 1.7 0 2.6 1 2.6 2.5zM17.5 8.4c1.7 0 2.6-1 2.6-2.5-1.7 0-2.6 1-2.6 2.5z" />
        </>
      )
    case 'canteiroDeFlores':
      // De cima: a borda de pedras roliças (a oval tracejada, deitada) e três flores na terra (o poço é redondo, com a boca e a trave; a jardineira é o cocho de frente).
      return (
        <>
          <ellipse cx="12" cy="12" rx="10" ry="7.5" strokeDasharray="3.6 1.4" />
          <circle cx="7.5" cy="11" r="2.1" />
          <circle cx="13" cy="9.3" r="2.1" />
          <circle cx="14.5" cy="14.6" r="2.1" />
        </>
      )
    case 'muroBaixoDePedra':
      // De frente: a capa de lajes sobrando dos dois lados (uma laje mais alta que a outra), as duas fiadas de pedras tortas, de juntas inclinadas, e a pedra caída ao pé (a ferramenta Parede é o retângulo liso de tijolos, sem capa nem pedra caída).
      return (
        <>
          <path d="M1.5 12V9.5h9v-1h12V12z" />
          <path d="M10.5 9.5V12M16.5 8.5V12" />
          <path d="M3 12v7.5h13M21 12v4.5" />
          <path d="M3 15.7l6-.3 6 .5 6-.3" />
          <path d="M8 12l.5 3.4M14.6 12l-.4 3.8M11.4 15.6l.4 3.9" />
          <path d="M17.5 21.5l1-2.3 2.6-.4 1.4 1.7-.6 1z" />
        </>
      )
    case 'tocoDeArvore':
      // De lado: o topo serrado em elipse com um arco de anel, o tronco curto com dois riscos de casca, as raízes abrindo em dentes no pé e um cogumelo ao lado (os troncos são três toras de ponta; a bigorna tem o toco liso debaixo dela).
      return (
        <>
          <ellipse cx="11" cy="6.5" rx="6.5" ry="2.8" />
          <path d="M8.2 6.2c1.2 1.4 4.4 1.4 5.6 0" />
          <path d="M4.5 6.5V14c0 2.4-1.2 4.2-3 6h4.2l1.6-1.8L9.2 20h3.6l1.9-1.8 1.6 1.8h2M17.5 6.5V14c0 1.3.3 2.2.9 3" />
          <path d="M8.5 11.5v3M13.5 10.5V14" />
          <path d="M18.6 18.2a2.2 1.9 0 0 1 4.4 0zM20.8 18.2v2.3" />
        </>
      )
    case 'carrinhoDeMao':
      // De lado: a caçamba funda, a roda única na frente, o cabo comprido para trás, o pé e duas abóboras passando da borda (a carroça é a caixa reta com duas rodas).
      return (
        <>
          <path d="M6.5 8.5h11l-2.2 6.5H9z" />
          <circle cx="17.5" cy="18" r="3" />
          <path d="M2 10.5l7 4.5h6.3l2.2 3" />
          <path d="M9 15l-1 6" />
          <path d="M9.5 8.5a2.2 2.2 0 0 1 4.4 0M13.9 8.5a1.6 1.6 0 0 1 3.2 0" />
        </>
      )
    case 'placaDeLoja':
      // De frente: o poste, o braço de ferro com a ponta enrolada e a voluta por baixo, as duas correntes e a tabuleta chanfrada com a caneca (o arco do portão tem dois postes e a placa lisa).
      return (
        <>
          <path d="M5 21.5V2.5" />
          <path d="M5 5h14.5a1.3 1.3 0 1 0-1.3-1.3" />
          <path d="M5 11.5c3 0 5-2.5 5-6.5" />
          <path d="M11.5 5v3.5M18.5 5v3.5" />
          <path d="M9.5 8.5h11v8l-1.5 1.5h-8l-1.5-1.5z" />
          <path d="M13 11.5h3.5v4H13zM16.5 12.5h1.2v2h-1.2" />
        </>
      )
    case 'cruzDeMadeira':
      // De frente: a travessa larga no alto com a amarra de corda em X, a coroa de flores pendurada logo abaixo, o poste de tábua descendo dela e o monte de terra no pé (a lápide é a pedra de topo em arco com a cruz pequena gravada; o espantalho tem chapéu e cabeça).
      return (
        <>
          <path d="M3.5 3.5h17v3h-17z" />
          <path d="M10.5 3.5l3 3M13.5 3.5l-3 3" />
          <circle cx="12" cy="10" r="3.2" />
          <path d="M10.5 12.8v5.6M13.5 12.8v5.6" />
          <path d="M2.5 21.5c2.2-2.4 5.4-3.4 9.5-3.4s7.3 1 9.5 3.4z" />
        </>
      )
    case 'anjoDePedra':
      // De frente: a cabeça baixa, as mãos juntas no peito, o manto abrindo em pregas até o pé, as duas asas fechadas subindo acima da cabeça e o pedestal com a placa (a estátua tem a espada e nenhuma asa).
      return (
        <>
          <circle cx="12" cy="6.2" r="1.9" />
          <path d="M10 8.6h4l1.6 7.4H8.4z" />
          <path d="M12 9.8v2.2M11 16v-3M13 16v-3" />
          <path d="M9.6 8.4C7.8 6.4 7 3.6 7.6 2c-2.6.6-4.4 3.6-4.2 7.4.2 3 1.4 5.2 3.6 6.6" />
          <path d="M14.4 8.4c1.8-2 2.6-4.8 2-6.4 2.6.6 4.4 3.6 4.2 7.4-.2 3-1.4 5.2-3.6 6.6" />
          <path d="M5.5 16h13v5.5h-13zM9 18h6" />
        </>
      )
    case 'cercaDeFerro':
      // De frente: os dois pilaretes de pedra com a ponta em pirâmide, as duas travessas e as barras com ponta de lança (a cerca de madeira tem mourões redondos e fio; o arco do portão, a trave por cima e a placa pendurada).
      return (
        <>
          <path d="M2 21.5V8h4v13.5M18 21.5V8h4v13.5" />
          <path d="M1.5 8L4 5l2.5 3M17.5 8L20 5l2.5 3" />
          <path d="M6 10.5h12M6 18.5h12" />
          <path d="M9 20.5V8M12 20.5V8M15 20.5V8" />
          <path d="M8 8.5l1-2.5 1 2.5M11 8.5l1-2.5 1 2.5M14 8.5l1-2.5 1 2.5" />
        </>
      )
    case 'paCravada':
      // De frente: o monte de terra em meia-lua, a pá cravada no alto dele (a lâmina de ombros, o cabo e o punho em D) e o lampião apagado no pé (a cova é o monte comprido visto de cima, com a beira escura de través).
      return (
        <>
          <path d="M1.5 21c1.3-5 4.5-7.8 8.5-7.8s7.2 2.8 8.5 7.8z" />
          <path d="M8 13.4V9.8l1.2-1.3h1.6L12 9.8v3.6" />
          <path d="M10 8.5V4.6M8 2.2h4L10 4.6z" />
          <rect x="19" y="16.5" width="3.5" height="4.5" rx="0.6" />
          <path d="M20.75 16.5v-1.6" />
        </>
      )
    case 'velasEOferendas':
      // De frente: o pano estendido no chão, a tigela no meio dele e duas velas de alturas diferentes, cada uma com a chama em gota (o candelabro de chão tem o tripé, o mastro e os braços; o altar, o degrau, o bloco e o tampo).
      return (
        <>
          <path d="M1.5 21.5l2.5-3h16l2.5 3z" />
          <path d="M9.5 15.8h5a2.5 2.5 0 0 1-5 0z" />
          <rect x="3.5" y="7" width="3" height="11.5" rx="0.4" />
          <rect x="17.5" y="11.5" width="3" height="7" rx="0.4" />
          <path d="M5 6.8c-1-.9-1-2.1 0-3.4 1 1.3 1 2.5 0 3.4zM19 11.3c-1-.9-1-2.1 0-3.4 1 1.3 1 2.5 0 3.4z" />
        </>
      )
    case 'arvoreSeca':
      // De lado: o tronco torto alargando no pé, os galhos nus abrindo em forquilhas, um galho quebrado de ponta lascada e as raízes saindo no chão (o toco de árvore é o tronco curto serrado, com cogumelo; o espantalho tem a travessa reta).
      return (
        <>
          <path d="M10.4 21.5c.6-2.6.3-5.2-.8-7.6M13.6 21.5c-.3-2.6 0-5.2 1.3-7.6" />
          <path d="M9.6 13.9C7.8 11.4 5.4 10.1 2.6 9.7M5.6 10.3 4.4 6.9" />
          <path d="M14.9 13.9c1.3-2.6 3.3-4 6.4-4.6M18.4 10l.6-3.5" />
          <path d="M12 13.9V8.4l-1.8-3.6M12 8.4l2.3-4.2" />
          <path d="M12 11.4l2.2-1.5.3.9.7-.6" />
          <path d="M10.4 21.5c-1.2-.2-2.5.1-3.6.8M13.6 21.5c1.2-.2 2.5.1 3.6.8" />
        </>
      )
    case 'balancaDeMercador':
      // De frente: a balança de dois pratos sobre o caixote (a coluna com o pé torneado e o fiel em cima, o travessão inclinado e cada prato pendurado em duas correntes, o mais pesado mais baixo) e um peso com botão no tampo. A banca de frutas mostra fruta no caixote, não balança.
      return (
        <>
          <path d="M2.5 18.5h19v3h-19z" />
          <path d="M12 18.5V3M10 18.5c0-1.3.9-2.1 2-2.1s2 .8 2 2.1" />
          <path d="M4.2 7.4L19.8 4.6" />
          <path d="M4.2 7.4L2 13.4M4.2 7.4l2.2 6M1.6 13.4h5.2a2.6 2.1 0 0 1-5.2 0z" />
          <path d="M19.8 4.6l-2.2 6M19.8 4.6l2.2 6M17.2 10.6h5.2a2.6 2.1 0 0 1-5.2 0z" />
          <path d="M15.6 18.5v-1.9h2.8v1.9M17 16.6v-.8" />
        </>
      )
    case 'tendaDeAdivinha':
      // De frente: a tenda redonda (o telhado em cone com o mastro e a flâmula, a beira em bicos e a parede reta), a porta em arco ogival e uma lua no pano. A barraca é um toldo reto sobre balcão; o toldo listrado são duas estacas com o pano listrado.
      return (
        <>
          <path d="M12 6.5V2.2l3.6 1.2-3.6 1.2" />
          <path d="M12 6.5L3 13.2h18z" />
          <path d="M4 13.2v8h16v-8" />
          <path d="M3 13.2a1.5 1.5 0 0 0 3 0a1.5 1.5 0 0 0 3 0a1.5 1.5 0 0 0 3 0a1.5 1.5 0 0 0 3 0a1.5 1.5 0 0 0 3 0a1.5 1.5 0 0 0 3 0" />
          <path d="M9.6 21.2v-4.4c0-1.6 1-3 2.4-4.4c1.4 1.4 2.4 2.8 2.4 4.4v4.4" />
          <path d="M7.4 15.6a2.1 2.1 0 0 0 0 4.2a1.5 2.1 0 0 1 0-4.2z" />
        </>
      )
    case 'gaiolaComAves':
      // De frente: a gaiola de ripas com a galinha atrás delas (o corpo, a cabeça com a crista e o bico, o rabo em pé) e, em cima, a gaiolinha de arame em domo com o gancho. Sem a ave, as ripas liam como caixote ou engradado.
      return (
        <>
          <path d="M2.5 12h19v9.5h-19z" />
          <path d="M6 12v9.5M10 12v9.5" />
          <path d="M3.5 12V8.5a3 3 0 0 1 6 0V12M6.5 3.6V12" />
          <path d="M12.6 18.6a2.9 2.1 0 1 0 5.8 0a2.9 2.1 0 1 0-5.8 0" />
          <circle cx="17.9" cy="16" r="1.3" />
          <path d="M17.3 14.7l.6-1.1.7 1M19.2 16l1.1.4-1.1.4M13.2 17.4l-1.2-2.6 2.5 1.2" />
        </>
      )
    case 'rolosDeTecido':
      // De frente: a mesa baixa com três rolos empilhados de ponta (o miolo de cada um), o pano que cai da beira em dobras e o rolo em pé no caixote ao lado.
      return (
        <>
          <path d="M2 13.5h13M3.5 13.5v6M13.5 13.5v6" />
          <circle cx="6" cy="10.8" r="2.7" />
          <circle cx="11.4" cy="10.8" r="2.7" />
          <circle cx="8.7" cy="6.4" r="2.7" />
          <path d="M6 10.8h.01M11.4 10.8h.01M8.7 6.4h.01" />
          <path d="M5 13.5v4.5c1 .8 2 .8 3 0c1 .8 2 .8 3 0v-4.5" />
          <path d="M16.5 15h5v6.5h-5zM17.5 15V4.5h3V15" />
        </>
      )
    case 'palcoDeBardo':
      // De frente: o tablado baixo sobre as pernas, o degrau na frente, os dois postes com a trave, as bandeirolas penduradas nela e a cortina franzida no fundo.
      return (
        <>
          <path d="M2 15.5h20V18H2zM3.5 18v3.5M20.5 18v3.5M9 21.5V19h6v2.5" />
          <path d="M3.5 15.5V3M20.5 15.5V3M3.5 4h17" />
          <path d="M6 4l1.5 2.2L9 4M11 4l1 2.2L13 4M15 4l1.5 2.2L18 4" />
          <path d="M5 7.5c1 .6 2 .6 3 0s2-.6 3 0s2 .6 3 0s2-.6 3 0s2 .6 2 0M6.5 8v7.5M9.5 8v7.5M12.5 8v7.5M15.5 8v7.5M18.5 8v7.5" />
        </>
      )
    case 'barrilDePeixe':
      // De frente: o barril aberto de bojo e dois aros, dois peixes de rabo para fora da boca (o corpo, o rabo em V e o olho), e a tampa encostada ao lado.
      return (
        <>
          <path d="M4.5 10h11l1 5.5l-1 6h-11l-1-6z" />
          <path d="M3.8 13h12.4M3.8 18.5h12.4" />
          <path d="M8 10c-1.3-1.8-1.3-3.6 0-5.4c1.3 1.8 1.3 3.6 0 5.4zM12 10c-1.3-1.8-1.3-3.6 0-5.4c1.3 1.8 1.3 3.6 0 5.4z" />
          <path d="M8 4.6l-1-1.6M8 4.6l1-1.6M12 4.6l-1-1.6M12 4.6l1-1.6M8 8.4h.01M12 8.4h.01" />
          <path d="M18 21.5l2.5-9l1.5.5l-2.5 9z" />
        </>
      )
    case 'fole':
      // De cima: a pera com a orla do couro, a tábua dentro dela, o bico afinando para a direita e a alavanca com a bola no cabo.
      return (
        <>
          <path d="M2.5 12c0-4 2.6-6.5 6.5-6.5 3.6 0 6.2 2.6 8 4.6v3.8c-1.8 2-4.4 4.6-8 4.6-3.9 0-6.5-2.5-6.5-6.5z" />
          <path d="M5 12c0-2.6 1.7-4.2 4.2-4.2 2.4 0 4.2 1.7 5.6 3.2v2c-1.4 1.5-3.2 3.2-5.6 3.2C6.7 16.2 5 14.6 5 12z" />
          <path d="M17 10.6l4.5.8v1.2l-4.5.8" />
          <path d="M4 12.6l11.5-5.4" />
          <circle cx="3.2" cy="12.9" r="1" />
        </>
      )
    case 'manequimComArmadura':
      // De frente: o elmo fechado com a fresta em T, a linha dos ombros com as ombreiras, o peitoral afinando até a cintura, o poste e a base.
      return (
        <>
          <path d="M9.5 8V4.5a2.5 2.5 0 0 1 5 0V8z" />
          <path d="M10.6 5.6h2.8M12 5.6v1.6" />
          <path d="M4 12.2c0-2.2 1.6-3.6 3.6-3.6h8.8c2 0 3.6 1.4 3.6 3.6" />
          <path d="M7.6 8.6l.8 7.4h7.2l.8-7.4" />
          <path d="M12 16v4.5M7.5 20.5h9" />
        </>
      )
    case 'pilhaDeLingotes':
      // De frente: os lingotes em tronco de pirâmide empilhados em degraus (três, dois e um) sobre o estrado com os tocos.
      return (
        <>
          <path d="M2.5 20.5l1-3.5h4l1 3.5M9 20.5l1-3.5h4l1 3.5M15.5 20.5l1-3.5h4l1 3.5" />
          <path d="M5.75 17l1-3.5h4l1 3.5M12.25 17l1-3.5h4l1 3.5" />
          <path d="M9 13.5l1-3.5h4l1 3.5" />
          <path d="M1.5 20.5h21M3 20.5v2M12 20.5v2M21 20.5v2" />
        </>
      )
    case 'serra':
      // De cima, um pouco de lado (como no mapa): a tora deitada com o corte da ponta, o cavalete em X por baixo dela (as pontas saindo dos dois lados) e o traçador de pé no corte, com o cabo atravessado em cada ponta e os dentes à mostra embaixo (os troncos são três toras de ponta; a pedra de amolar é a roda no cavalete).
      return (
        <>
          <path d="M16.5 9.5H4.2a1.7 2.5 0 0 0 0 5h12.3" />
          <ellipse cx="16.5" cy="12" rx="1.7" ry="2.5" />
          <path d="M5.5 4.5l1.33 5M9.5 4.5l-1.33 5M8.17 14.5l1.33 5M6.83 14.5l-1.33 5" />
          <path d="M13 3.5v17M11.6 3.5h2.8M11.6 20.5h2.8" />
          <path d="M13 15.6l-1.2.9 1.2.9-1.2.9" />
        </>
      )
    case 'galinheiro':
      // De frente: a casinha de tábuas em cima dos pés, com o telhado de duas águas e a portinhola, a rampa de ripas descendo até o chão e a galinha no terreiro (o corpo, o rabo, a cabeça com a crista e o bico). A gaiola com aves é a grade de ripas com a gaiolinha em cima; o mausoléu, o frontão com colunas.
      return (
        <>
          <path d="M1.8 9.2 8 3.6l6.2 5.6" />
          <path d="M3.2 9.2v6h9.6v-6" />
          <path d="M6.8 15.2v-3.4h2.4v3.4" />
          <path d="M4.2 15.2v6.3M11.8 15.2v6.3" />
          <path d="M9.2 15.2l4.4 6.3M10.4 17.6l1-.6M11.7 19.5l1-.6" />
          <path d="M1.5 21.5h21" />
          <path d="M15.4 19.3a2.6 1.9 0 1 0 5.2 0a2.6 1.9 0 1 0-5.2 0" />
          <circle cx="20.6" cy="16.6" r="1.1" />
          <path d="M20.1 15.5l.5-1 .6.9M21.7 16.6l1 .35-1 .35M15.6 18.6l-.9-2.5 2.3 1.1" />
        </>
      )
    case 'colmeia':
      // De frente: o cortiço de palha em sino, com duas voltas do rolo, o pegador no alto e a boca embaixo, em cima do banco de tábua de dois pés, e duas abelhas voando (o corpo e a asa). O forno de pão é a cúpula com a chaminé e a boca grande em arco, no chão.
      return (
        <>
          <path d="M5.5 15.5C5.5 9.5 8.1 5.6 12 5.6s6.5 3.9 6.5 9.9z" />
          <path d="M6 12.4c4 .9 8 .9 12 0M7.3 9.3c3.1.7 6.3.7 9.4 0" />
          <path d="M11 5.6V4.3h2v1.3" />
          <path d="M10.5 15.5a1.5 1.5 0 0 1 3 0" />
          <path d="M3.2 15.5h17.6v1.9H3.2zM5 17.4v4.1M19 17.4v4.1" />
          <ellipse cx="20.3" cy="6.8" rx="1.3" ry=".8" />
          <path d="M19.4 6.2a1 1 0 0 1 1.9-.5" />
          <ellipse cx="3.7" cy="10" rx="1.3" ry=".8" />
          <path d="M4.6 9.4a1 1 0 0 0-1.9-.5" />
        </>
      )
    case 'arado':
      // De lado: a relha em ponta rente ao chão com a aiveca curva subindo atrás dela, a coluna até o timão comprido para a frente, a argola da corrente na ponta dele, a rabiça subindo para trás com o punho e a leiva virada no chão (o carrinho de mão tem a caçamba e a roda).
      return (
        <>
          <path d="M7 20.5h8.5l-.6-4.2c-2.6-.2-5 1.4-7.9 4.2z" />
          <path d="M12.6 16.5v-4" />
          <path d="M18 12.5H4.2" />
          <circle cx="2.6" cy="12.5" r="1.6" />
          <path d="M15.3 18.5L20.5 7.2h2" />
          <path d="M17 21.3c1.3-1.9 3-2.4 5-1.4" />
        </>
      )
    case 'tocoComMachado':
      // De lado: o cepo baixo e largo, reto (sem raiz), com um nó e a rachadura do golpe, a cabeça do machado cravada no topo com o fio enterrado, o cabo subindo de través e uma acha rachada no chão (o toco de árvore tem o topo em elipse, as raízes e o cogumelo).
      return (
        <>
          <path d="M3 13.5h14c.35 2.3.35 4.7 0 7H3c-.35-2.3-.35-4.7 0-7z" />
          <path d="M5.98 10.22l1.64-1.14.86 1.23 3.47 2.69-.71.5H7.5l-.66-2.05z" />
          <path d="M8.5 10.3l9-6.3" />
          <path d="M10.3 13.5l.5 1.6-.6 1.4" />
          <ellipse cx="13.6" cy="17.4" rx=".9" ry="1.3" />
          <path d="M18.2 20.5h4a4 4 0 0 0-2-3.46z" />
        </>
      )
    case 'plantacaoEmFileiras':
      // De lado, cortada: três leiras em monte na linha da terra, cada uma com a muda de milho em cima (as dos lados com um par de folhas; a do meio, mais alta, com as folhas desencontradas). A horta é a cenoura enterrada com a rama; o canteiro, a borda de pedras com as flores.
      return (
        <>
          <path d="M1.5 21h21" />
          <path d="M2 21a3.3 3.2 0 0 1 6.6 0M8.7 21a3.3 3.2 0 0 1 6.6 0M15.4 21a3.3 3.2 0 0 1 6.6 0" />
          <path d="M5.3 17.8v-7.2M12 17.8V5.5M18.7 17.8v-7.2" />
          <path d="M5.3 14.6c-1.8-.3-2.9-1.4-3.1-3 1.8.3 2.9 1.4 3.1 3zM5.3 14.6c1.8-.3 2.9-1.4 3.1-3-1.8.3-2.9 1.4-3.1 3z" />
          <path d="M12 13.2c-1.9-.3-3-1.5-3.2-3.2 1.9.3 3 1.5 3.2 3.2zM12 9.4c1.9-.3 3-1.5 3.2-3.2-1.9.3-3 1.5-3.2 3.2z" />
          <path d="M18.7 14.6c-1.8-.3-2.9-1.4-3.1-3 1.8.3 2.9 1.4 3.1 3zM18.7 14.6c1.8-.3 2.9-1.4 3.1-3-1.8.3-2.9 1.4-3.1 3z" />
        </>
      )
  }
}

/** A "Forma" do tapete no painel: o retângulo deitado ou o círculo, só a silhueta. */
export function FormaDoTapeteIcon({ forma, ...props }: IconProps & { forma: FormaDoTapete }) {
  return <Icon {...props}>{forma === 'redondo' ? <circle cx="12" cy="12" r="7.5" /> : <rect x="3" y="6.5" width="18" height="11" />}</Icon>
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
 *
 * A placa vista de cima (a do mapa) perdeu o swap cego de 28/09 a 18 px: lia
 * como documento, lista ou bateria. Ela continua na miniatura do Sentido, que
 * tem rótulo ao lado; aqui, sem rótulo, a silhueta de degrau é o que se lê.
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
/** Balde de tinta (forma "Balde" do Chão): o mesmo desenho do protótipo consolidado. */
export function BaldeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 9.5h14l-1.5 10h-11z" />
      <path d="M6.5 9.5c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5" />
    </Icon>
  )
}

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

/** "Exportar imagem": o quadro da imagem com a seta saindo pelo canto. */
export function ExportImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11 6H5a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2v-5" />
      <path d="M3.5 17.5l4-3.5 3 2.5 2.5-2 5 4" />
      <path d="M15 3h6v6M21 3l-7 7" />
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

/** Expandir: quatro cantos apontando para fora (abre as cenas em tela grande). */
export function ExpandIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9V4H9M15 4H20V9M20 15V20H15M9 20H4V15" />
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

/**
 * Dois bustos, um à frente do outro: o olho "Jogadores veem" do painel de
 * Camadas. Ícone próprio para não ser um segundo olho igual ao do mestre na
 * mesma linha (dois olhos idênticos lado a lado não dizem qual é qual).
 */
export function JogadoresIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0111 0" />
      <path d="M15 6.2a2.6 2.6 0 110 5.2" />
      <path d="M16.6 13.9a5.2 5.2 0 013.9 5.1" />
    </Icon>
  )
}

/** Os mesmos bustos cortados pela diagonal do `EyeOffIcon`: os jogadores não veem. */
export function JogadoresOcultosIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0111 0" />
      <path d="M15 6.2a2.6 2.6 0 110 5.2" />
      <path d="M16.6 13.9a5.2 5.2 0 013.9 5.1" />
      <path d="M4 4l16 16" />
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

/**
 * Alto-falante: caixa + cone e duas ondas — o botão do som da mesa
 * (`ControleDeSom`). As ondas são arcos abertos, sem círculo pequeno.
 */
export function SomIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </Icon>
  )
}

/** Alto-falante mudo: o mesmo corpo do `SomIcon`, com um X no lugar das ondas. */
export function SomMudoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
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

/** Divisa para cima — "Subir" na lista de camadas do chão. */
export function ChevronUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 15l6-6 6 6" />
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

/**
 * "Mover para…" da lista Cenas: a seta desce e entra à direita, o mesmo gesto
 * do recuo de uma cena que vai para dentro de outra.
 */
export function MoveIntoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4.5v8a3 3 0 0 0 3 3h9" />
      <path d="M15.5 12l3.5 3.5-3.5 3.5" />
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

/**
 * Teclado — botão da tela de atalhos (ActionBar). Moldura mais larga que alta
 * com duas fileiras de teclas curtas e a barra de espaço. Distingue de
 * `ImageIcon` (moldura parecida, com montanha e sol por dentro) pelas teclas
 * em grade. Cada tecla é um traço curto de ponta redonda — o mesmo traço do resto
 * da família, sem `fill` e sem círculo pequeno que feche o miolo.
 */
export function KeyboardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6.25 9.5h1M9.75 9.5h1M13.25 9.5h1M16.75 9.5h1M6.25 12.25h1M9.75 12.25h1M13.25 12.25h1M16.75 12.25h1M8.5 15h7" />
    </Icon>
  )
}

/**
 * Pipeta — o conta-gotas que pega uma cor do mapa (`CampoDeCorComPipeta`). Bulbo
 * no alto à direita, haste em diagonal até a ponta embaixo à esquerda, com o
 * anel entre o bulbo e a haste.
 */
export function PipetaIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20l1.5-1.5" />
      <path d="M5.5 18.5v-2l7.5-7.5 2.5 2.5-7.5 7.5z" />
      <path d="M11.5 6.5l6 6" />
      <path d="M13.5 8.5L17 5a2.12 2.12 0 013 3l-3.5 3.5" />
    </Icon>
  )
}

/**
 * Balão de fala — o chat dos jogadores na tela do mestre (`MasterChatPanel`).
 * Retângulo de cantos redondos com o rabicho embaixo à esquerda e duas
 * linhas de texto dentro.
 */
export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 5h13A1.5 1.5 0 0 1 20 6.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3.5V16h-.5A1.5 1.5 0 0 1 4 14.5v-8A1.5 1.5 0 0 1 5.5 5z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </Icon>
  )
}

/**
 * Divisa dupla para a direita — "Esconder a coluna": a coluna da direita sai
 * pela borda de onde mora.
 */
export function ChevronsRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 7l5 5-5 5M13 7l5 5-5 5" />
    </Icon>
  )
}

/** Divisa dupla para a esquerda — "Mostrar a coluna": ela volta da borda direita. */
export function ChevronsLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 7l-5 5 5 5M11 7l-5 5 5 5" />
    </Icon>
  )
}

/**
 * VISÃO DE JOGADOR — "Jogar": o triângulo de tocar, só contorno como a família.
 * Ao lado do `EyeIcon` ("Olhar") no seletor da janela de teste: olho é ver,
 * triângulo é pôr para andar.
 */
export function JogarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.5 5.2v13.6L18.5 12z" />
    </Icon>
  )
}

/** "Trocar ficha": duas setas em sentidos opostos, uma sobre a outra (troca, não volta). */
export function TrocarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3.5L4 7.5l4 4" />
      <path d="M4 7.5h15.5" />
      <path d="M16 20.5l4-4-4-4" />
      <path d="M20 16.5H4.5" />
    </Icon>
  )
}

/**
 * "Esquecer tudo": a volta inteira no sentido anti-horário, com a ponta no
 * começo. Diferente do `UndoIcon` (meia volta para trás, um passo só): aqui é
 * recomeçar do zero.
 */
export function EsquecerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 8.5-8.5 9.2 9.2 0 0 0-6.4 2.6L3.5 8.2" />
      <path d="M3.5 3.5v4.7h4.7" />
    </Icon>
  )
}

/**
 * Frasco de laboratório: o selo "Teste" da Visão de jogador. Experimento, e
 * não alerta: nada de triângulo nem de exclamação, porque o teste não é erro.
 */
export function FrascoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 3v6.6a2 2 0 0 1-.25.95L5.1 18.7a1.5 1.5 0 0 0 1.3 2.3h11.2a1.5 1.5 0 0 0 1.3-2.3l-4.65-8.15a2 2 0 0 1-.25-.95V3" />
      <path d="M8.5 3h7" />
      <path d="M7.2 15.5h9.6" />
    </Icon>
  )
}

/** A tecla Enter (seta que desce e volta à esquerda): marca a linha que o Enter escolhe numa lista. */
export function EnterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 10.5L5 15l4.5 4.5" />
      <path d="M19 4.5v6.5a4 4 0 0 1-4 4H5" />
    </Icon>
  )
}

/**
 * Reticências do menu "Mais". Aqui o círculo pequeno É para fechar o miolo
 * (ver o aviso no `Icon`): três pontos cheios, lidos de longe, pedem traço
 * 2.2 em quem monta.
 */
export function ReticenciasIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5.5" cy="12" r="1.1" />
      <circle cx="12" cy="12" r="1.1" />
      <circle cx="18.5" cy="12" r="1.1" />
    </Icon>
  )
}
