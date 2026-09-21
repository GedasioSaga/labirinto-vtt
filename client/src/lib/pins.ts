import type { Pin, PinIcon, PinKind, RegionPoint } from '../types/map'

/**
 * Regras do pino de ponto de interesse, compartilhadas pelo editor (render e
 * clique) e pelo jogador (render e toque). Puro: sem DOM, sem Pixi, sem store.
 */

/** Altura do pino em px de mundo, da ponta cravada ao topo da cabeça. */
export const PIN_HEIGHT = 34
/** Raio da cabeça redonda onde mora o glifo, em px de mundo. */
export const PIN_HEAD_RADIUS = 11
/** Centro da cabeça fica esta distância acima do ponto cravado. */
export const PIN_HEAD_OFFSET = PIN_HEIGHT - PIN_HEAD_RADIUS

/**
 * Glifo de cada tipo — é o que distingue "!" de "?" na tela do jogador. O pino
 * de viagem não desenha glifo: a cabeça dele leva o símbolo de passagem
 * (`PIN_TRAVEL_SYMBOL`); a seta aqui só existe para quem precisa de texto.
 */
export const PIN_GLYPH: Record<PinKind, string> = {
  exclamacao: '!',
  interrogacao: '?',
  viagem: '→',
}

/** Nome de cada tipo na interface do mestre. */
export const PIN_KIND_LABELS: Record<PinKind, string> = {
  exclamacao: 'Exclamação (!)',
  interrogacao: 'Interrogação (?)',
  viagem: 'Viagem',
}

/** Ordem em que os tipos aparecem no painel: a viagem por último, ao lado dos dois de sempre. */
export const PIN_KIND_ORDER: readonly PinKind[] = ['exclamacao', 'interrogacao', 'viagem']

/** Guarda de leitura: tipo desconhecido (arquivo editado à mão, versão futura) não entra no desenho. */
export function isPinKind(value: unknown): value is PinKind {
  return typeof value === 'string' && (PIN_KIND_ORDER as readonly string[]).includes(value)
}

/** Nome de cada símbolo na interface do mestre e no leitor de tela. */
export const PIN_ICON_LABELS: Record<PinIcon, string> = {
  bau: 'Baú',
  armadilha: 'Armadilha',
  chave: 'Chave',
  perigo: 'Perigo',
  escada: 'Escada',
  agua: 'Água',
}

/** Ordem em que os símbolos aparecem na grade do painel. */
export const PIN_ICON_ORDER: readonly PinIcon[] = ['bau', 'armadilha', 'chave', 'perigo', 'escada', 'agua']

/** Guarda de leitura: arquivo de mapa editado à mão ou de versão futura não derruba o desenho. */
export function isPinIcon(value: unknown): value is PinIcon {
  return typeof value === 'string' && (PIN_ICON_ORDER as readonly string[]).includes(value)
}

/** Ponto do desenho do símbolo, no quadrado normalizado -1..1 com a origem no centro da cabeça. */
export interface PinSymbolPoint {
  x: number
  y: number
}

/** Traço do símbolo: polilinha aberta, ou fechada quando o contorno volta ao início. */
export interface PinSymbolStroke {
  points: readonly PinSymbolPoint[]
  closed?: boolean
}

/** Círculo do símbolo, no mesmo quadrado normalizado. */
export interface PinSymbolCircle extends PinSymbolPoint {
  r: number
}

/**
 * Forma vetorial de um símbolo. Coordenadas NORMALIZADAS (-1..1, y para baixo)
 * porque os dois desenhistas têm réguas diferentes: o mapa desenha em px de
 * mundo dentro de uma cabeça de 11 px de raio (`pixi/drawPins.ts`), o painel
 * desenha num `viewBox` de 24 (`components/PinSymbolArt.tsx`). Uma fonte só
 * para as duas telas — o que o mestre escolhe no painel é a mesma forma que
 * ele vê no mapa e que o jogador recebe.
 */
export interface PinSymbolShape {
  strokes: readonly PinSymbolStroke[]
  /** Círculo de contorno (o anel da chave). */
  rings?: readonly PinSymbolCircle[]
  /** Círculo cheio (o ponto do "perigo"). */
  dots?: readonly PinSymbolCircle[]
}

/**
 * Os seis símbolos, em traço e nada mais: é o estilo da casa (minimapa de
 * Resident Evil — linha fina clara, sem hachura, sem ilustração), e é o que
 * continua legível numa cabeça de 22 px de diâmetro e com zoom para fora.
 *
 * Cada um foi desenhado para ser reconhecível pela SILHUETA, não pelo detalhe:
 * duas mandíbulas com dentes não se confundem com uma caixa de tampa reta nem
 * com três ondas, mesmo quando a cabeça do pino tem poucos pixels na tela.
 */
export const PIN_SYMBOLS: Record<PinIcon, PinSymbolShape> = {
  // Caixa de tampa reta com a correia do fecho cruzando a emenda.
  bau: {
    strokes: [
      {
        points: [
          { x: -0.85, y: -0.16 },
          { x: 0.85, y: -0.16 },
          { x: 0.85, y: 0.62 },
          { x: -0.85, y: 0.62 },
        ],
        closed: true,
      },
      {
        points: [
          { x: -0.85, y: -0.16 },
          { x: -0.7, y: -0.62 },
          { x: 0.7, y: -0.62 },
          { x: 0.85, y: -0.16 },
        ],
      },
      {
        points: [
          { x: 0, y: -0.36 },
          { x: 0, y: 0.22 },
        ],
      },
    ],
  },
  // Duas mandíbulas de dentes apontando uma para a outra.
  armadilha: {
    strokes: [
      {
        points: [
          { x: -0.85, y: -0.64 },
          { x: -0.42, y: -0.14 },
          { x: 0, y: -0.64 },
          { x: 0.42, y: -0.14 },
          { x: 0.85, y: -0.64 },
        ],
      },
      {
        points: [
          { x: -0.85, y: 0.64 },
          { x: -0.42, y: 0.14 },
          { x: 0, y: 0.64 },
          { x: 0.42, y: 0.14 },
          { x: 0.85, y: 0.64 },
        ],
      },
    ],
  },
  // Anel, haste e dois dentes na ponta.
  chave: {
    strokes: [
      {
        points: [
          { x: -0.04, y: 0 },
          { x: 0.88, y: 0 },
        ],
      },
      {
        points: [
          { x: 0.46, y: 0 },
          { x: 0.46, y: 0.44 },
        ],
      },
      {
        points: [
          { x: 0.78, y: 0 },
          { x: 0.78, y: 0.44 },
        ],
      },
    ],
    rings: [{ x: -0.44, y: 0, r: 0.4 }],
  },
  // Triângulo com barra e ponto — o aviso universal, e não mais um "!" solto.
  perigo: {
    strokes: [
      {
        points: [
          { x: 0, y: -0.74 },
          { x: 0.82, y: 0.64 },
          { x: -0.82, y: 0.64 },
        ],
        closed: true,
      },
      {
        points: [
          { x: 0, y: -0.22 },
          { x: 0, y: 0.16 },
        ],
      },
    ],
    // Ponto cheio, não anel: abaixo de r≈0.2 um círculo de contorno fecha o
    // miolo e vira borrão (o aviso de `components/icons.tsx`).
    dots: [{ x: 0, y: 0.44, r: 0.18 }],
  },
  // Degraus subindo para a direita — a mesma leitura da ferramenta Escada.
  escada: {
    strokes: [
      {
        points: [
          { x: -0.86, y: 0.7 },
          { x: -0.86, y: 0.24 },
          { x: -0.29, y: 0.24 },
          { x: -0.29, y: -0.22 },
          { x: 0.29, y: -0.22 },
          { x: 0.29, y: -0.68 },
          { x: 0.86, y: -0.68 },
        ],
      },
    ],
  },
  // Três ondas paralelas, amplitude curta: não se confunde com o zigue-zague da armadilha.
  agua: {
    strokes: [
      {
        points: [
          { x: -0.85, y: -0.3 },
          { x: -0.42, y: -0.6 },
          { x: 0, y: -0.3 },
          { x: 0.42, y: -0.6 },
          { x: 0.85, y: -0.3 },
        ],
      },
      {
        points: [
          { x: -0.85, y: 0.15 },
          { x: -0.42, y: -0.15 },
          { x: 0, y: 0.15 },
          { x: 0.42, y: -0.15 },
          { x: 0.85, y: 0.15 },
        ],
      },
      {
        points: [
          { x: -0.85, y: 0.6 },
          { x: -0.42, y: 0.3 },
          { x: 0, y: 0.6 },
          { x: 0.42, y: 0.3 },
          { x: 0.85, y: 0.6 },
        ],
      },
    ],
  },
}

/**
 * Símbolo do pino de VIAGEM: a seta entrando num vão de porta — "passe por
 * aqui". Mesma régua normalizada e mesmo traço fino dos seis símbolos acima;
 * o que separa o pino de viagem dos outros no mapa é a cabeça ESCURA com a
 * linha clara (`pixi/drawPins.ts`), não um traço mais grosso.
 */
export const PIN_TRAVEL_SYMBOL: PinSymbolShape = {
  strokes: [
    // O vão: batente de cima, lateral e batente de baixo, aberto para a seta.
    {
      points: [
        { x: 0.02, y: -0.74 },
        { x: 0.8, y: -0.74 },
        { x: 0.8, y: 0.74 },
        { x: 0.02, y: 0.74 },
      ],
    },
    // A haste da seta, vinda de fora.
    {
      points: [
        { x: -0.86, y: 0 },
        { x: 0.44, y: 0 },
      ],
    },
    // A ponta.
    {
      points: [
        { x: 0.08, y: -0.36 },
        { x: 0.44, y: 0 },
        { x: 0.08, y: 0.36 },
      ],
    },
  ],
}

/**
 * Só data URL de imagem viaja para o jogador. Caminho de disco do mestre
 * (`C:\...`, `/home/...`, `file://...`) NUNCA sai: quem recorta o mapa
 * (`lib/fogFilter.ts`) apaga o campo quando esta função devolve `false`.
 */
export function isPlayerSafePinImage(image: string | null): image is string {
  return typeof image === 'string' && image.startsWith('data:image/')
}

/**
 * Pino sob o ponto do mundo, do desenhado por último para o primeiro (o de
 * cima ganha). A área de toque é a cabeça mais a haste: um retângulo alto e
 * estreito com a bola em cima, engordado por `tolerance` para o dedo — no
 * celular o alvo real é o dedo, não o desenho.
 */
export function findPinAt(pins: readonly Pin[], point: RegionPoint, tolerance = 0): Pin | null {
  for (let i = pins.length - 1; i >= 0; i--) {
    const pin = pins[i]
    const dx = point.x - pin.x
    const dy = point.y - pin.y
    // Cabeça: círculo em torno do centro dela.
    if (Math.hypot(dx, dy + PIN_HEAD_OFFSET) <= PIN_HEAD_RADIUS + tolerance) return pin
    // Haste: faixa vertical entre a ponta e a base da cabeça.
    if (Math.abs(dx) <= PIN_HEAD_RADIUS / 2 + tolerance && dy <= tolerance && dy >= -PIN_HEIGHT - tolerance) return pin
  }
  return null
}

/**
 * Texto curto do pino para o mestre (lista, título de painel e leitor de tela).
 * Sem descrição, quem nomeia o pino é o símbolo escolhido — e só na falta dele
 * o glifo, que é o que o pino de hoje tem.
 */
export function pinSummary(pin: Pin): string {
  const description = pin.description.trim()
  if (description !== '') return description
  // O pino de viagem desenha a passagem, nunca o símbolo escolhido: nomeá-lo
  // pelo símbolo diria "Baú" de um pino que no mapa é uma porta.
  if (pin.kind === 'viagem') return 'Pino de viagem'
  if (isPinIcon(pin.icon)) return `Ponto de interesse — ${PIN_ICON_LABELS[pin.icon]}`
  return `Ponto de interesse ${PIN_GLYPH[pin.kind]}`
}
