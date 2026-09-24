import type { MapData, Token, TokenCondition } from '../types/map'

/**
 * CONDIÇÃO NA FICHA — regras compartilhadas pelo editor do mestre (painel e
 * mapa) e pela tela de quem joga. Puro: sem DOM, sem Pixi, sem store.
 *
 * A marca é uma PASTILHA chapada sentada na borda de cima da ficha: disco de
 * cor própria, contorno fino escuro e um desenho simples na tinta do
 * contorno, no mesmo idioma da cabeça do pino (`lib/pins.ts`) — estilo
 * minimapa, sem brilho, sem degradê, sem ilustração.
 */

/** As condições, na ordem em que aparecem no painel e em cima da ficha. */
export const TOKEN_CONDITION_ORDER: readonly TokenCondition[] = ['envenenado', 'caido', 'dormindo', 'atordoado', 'invisivel']

/** O nome que a pessoa lê — no botão do painel e no leitor de tela. */
export const TOKEN_CONDITION_LABELS: Record<TokenCondition, string> = {
  envenenado: 'Envenenado',
  caido: 'Caído',
  dormindo: 'Dormindo',
  atordoado: 'Atordoado',
  invisivel: 'Invisível',
}

/** Guarda de leitura: id desconhecido (arquivo editado à mão, versão futura) não vira marca. */
export function isTokenCondition(value: unknown): value is TokenCondition {
  return typeof value === 'string' && (TOKEN_CONDITION_ORDER as readonly string[]).includes(value)
}

/**
 * As condições que valem numa ficha, na ordem da lista e sem repetição.
 *
 * O parâmetro é `{ conditions?: unknown }` e não `Pick<Token, 'conditions'>`
 * de propósito, mesmo motivo de `tokenSizeInSquares`: a entrada real inclui
 * mapa lido do disco (`lib/mapFile.ts` espalha o JSON cru) e ficha montada por
 * `page.evaluate` num spec. O que não é da lista cai fora em vez de chegar ao
 * desenho.
 */
export function tokenConditionsOf(token: { conditions?: unknown } | undefined): TokenCondition[] {
  const raw = token?.conditions
  if (!Array.isArray(raw)) return []
  return TOKEN_CONDITION_ORDER.filter((condition) => raw.includes(condition))
}

/** A ficha com exatamente estas condições. Lista vazia APAGA o campo: a ficha volta a ser a de antes. */
function withConditions(token: Token, conditions: readonly TokenCondition[]): Token {
  const { conditions: _antigas, ...semCondicoes } = token
  return conditions.length === 0 ? semCondicoes : { ...semCondicoes, conditions: [...conditions] }
}

/**
 * Marca a condição se ela não está na ficha, desmarca se está — o clique do
 * painel. Ficha inexistente devolve o MESMO mapa, para quem chama não gastar
 * entrada de histórico à toa. Desmarcar também limpa o lixo que um arquivo
 * editado à mão tenha deixado no campo.
 */
export function toggleTokenCondition(map: MapData, tokenId: string, condition: TokenCondition): MapData {
  const index = map.tokens.findIndex((t) => t.id === tokenId)
  if (index === -1) return map
  const token = map.tokens[index]
  const current = tokenConditionsOf(token)
  const next = current.includes(condition)
    ? current.filter((c) => c !== condition)
    : TOKEN_CONDITION_ORDER.filter((c) => c === condition || current.includes(c))
  const tokens = map.tokens.slice()
  tokens[index] = withConditions(token, next)
  return { ...map, tokens }
}

/**
 * O campo `conditions` como o jogador pode recebê-lo: só ids da lista, sem
 * repetição, na ordem da lista; sem nenhum que valha, o campo nem viaja. Texto
 * que o mestre (ou o arquivo) tenha enfiado ali fica na máquina dele.
 *
 * Não decide SE a ficha vai: isso é de `lib/fogFilter.ts`, e a condição só
 * atravessa junto com a ficha que atravessa. Ficha já limpa sai na mesma
 * instância — nada é copiado no caminho comum.
 */
export function tokenConditionsForPlayer(token: Token): Token {
  if (!('conditions' in token)) return token
  const clean = tokenConditionsOf(token)
  const raw: unknown = token.conditions
  const intact = clean.length > 0 && Array.isArray(raw) && raw.length === clean.length && clean.every((c, i) => raw[i] === c)
  return intact ? token : withConditions(token, clean)
}

// ───────────────────────────────────────────────────────────────────────────
// A PASTILHA: cor, desenho e onde ela senta
// ───────────────────────────────────────────────────────────────────────────

/** Ponto do desenho, no quadrado normalizado -1..1 (y para baixo) com a origem no centro da pastilha. */
export interface ConditionSymbolPoint {
  x: number
  y: number
}

/** Traço do desenho: polilinha aberta, ou fechada quando o contorno volta ao início. */
export interface ConditionSymbolStroke {
  points: readonly ConditionSymbolPoint[]
  closed?: boolean
}

/**
 * Ponto cheio do desenho. `hole`: pintado na cor da própria PASTILHA, e não na
 * tinta — é um furo na forma cheia desenhada antes (os olhos do fantasma).
 */
export interface ConditionSymbolDot extends ConditionSymbolPoint {
  r: number
  hole?: boolean
}

/**
 * Uma pastilha. Coordenadas NORMALIZADAS pelo mesmo motivo de
 * `PinSymbolShape`: o mapa desenha em px de mundo (`pixi/drawTokenConditions.ts`)
 * e o painel num `viewBox` de SVG (`components/TokenConditionControls.tsx`).
 * Uma fonte só para as duas telas — o que o mestre vê no botão é, ponto por
 * ponto, o que sai em cima da ficha para ele e para quem joga.
 *
 * Ordem do desenho: formas cheias, traços (na ordem da lista), pontos.
 */
export interface ConditionSymbol {
  /** Cor chapada da pastilha, `#rrggbb` minúsculo. */
  fill: string
  strokes: readonly ConditionSymbolStroke[]
  /** Formas cheias (a gota do veneno, a estrela do atordoado, o fantasma). */
  solids?: readonly (readonly ConditionSymbolPoint[])[]
  /** Pontos cheios, ou furos (os olhos do fantasma). */
  dots?: readonly ConditionSymbolDot[]
}

/** Tinta do contorno e do desenho: a mesma do contorno da ficha (`pixi/drawTokens.ts`). */
export const CONDITION_INK = '#1a1a1a'

/** Espessura do contorno da pastilha, em fração do raio dela. */
export const CONDITION_OUTLINE_FRACTION = 0.17
/** Meia-aresta do quadrado do desenho, em fração do raio da pastilha. */
export const CONDITION_GLYPH_FRACTION = 0.6
/** Espessura do traço do desenho, em fração do raio da pastilha. */
export const CONDITION_GLYPH_STROKE_FRACTION = 0.19

/**
 * As cinco pastilhas. A COR separa uma condição da outra de relance, e o
 * DESENHO separa quando a cor não basta (daltonismo, chão da mesma cor): as
 * duas pistas juntas, nunca uma só.
 *
 * Tons claros e chapados para o desenho escuro ler por cima e a pastilha
 * saltar tanto do chão marrom do minimapa quanto do fundo escuro e da névoa;
 * o contorno escuro a separa da cor da ficha, qualquer que seja. Nenhuma
 * repete o latão do pino nem o amarelo da seleção.
 */
export const TOKEN_CONDITION_SYMBOLS: Record<TokenCondition, ConditionSymbol> = {
  // Gota cheia — o veneno que pinga.
  envenenado: {
    fill: '#9ccc65',
    strokes: [],
    solids: [
      [
        { x: 0, y: -0.95 },
        { x: 0.52, y: -0.05 },
        { x: 0.6, y: 0.25 },
        { x: 0.52, y: 0.55 },
        { x: 0.3, y: 0.77 },
        { x: 0, y: 0.85 },
        { x: -0.3, y: 0.77 },
        { x: -0.52, y: 0.55 },
        { x: -0.6, y: 0.25 },
        { x: -0.52, y: -0.05 },
      ],
    ],
  },
  // Seta descendo até a linha do chão — foi ao chão.
  caido: {
    fill: '#ef8a80',
    strokes: [
      {
        points: [
          { x: 0, y: -0.85 },
          { x: 0, y: 0.35 },
        ],
      },
      {
        points: [
          { x: -0.45, y: -0.05 },
          { x: 0, y: 0.4 },
          { x: 0.45, y: -0.05 },
        ],
      },
      {
        points: [
          { x: -0.8, y: 0.8 },
          { x: 0.8, y: 0.8 },
        ],
      },
    ],
  },
  // O "Z" do sono.
  dormindo: {
    fill: '#90a4f4',
    strokes: [
      {
        points: [
          { x: -0.6, y: -0.7 },
          { x: 0.6, y: -0.7 },
          { x: -0.6, y: 0.7 },
          { x: 0.6, y: 0.7 },
        ],
      },
    ],
  },
  // Estrela de quatro pontas — ver estrelas.
  atordoado: {
    fill: '#f6d365',
    strokes: [],
    solids: [
      [
        { x: 0, y: -0.95 },
        { x: 0.24, y: -0.24 },
        { x: 0.95, y: 0 },
        { x: 0.24, y: 0.24 },
        { x: 0, y: 0.95 },
        { x: -0.24, y: 0.24 },
        { x: -0.95, y: 0 },
        { x: -0.24, y: -0.24 },
      ],
    ],
  },
  // Fantasma de barra recortada, com os olhos vazados. O olho cortado foi
  // descartado na prévia de 23/09: numa pastilha de 18 px ele virava borrão, e
  // a silhueta do fantasma continua lendo "não se vê" nesse tamanho.
  invisivel: {
    fill: '#d8dde4',
    strokes: [],
    solids: [
      [
        { x: -0.7, y: -0.15 },
        { x: -0.61, y: -0.5 },
        { x: -0.35, y: -0.76 },
        { x: 0, y: -0.85 },
        { x: 0.35, y: -0.76 },
        { x: 0.61, y: -0.5 },
        { x: 0.7, y: -0.15 },
        { x: 0.7, y: 0.8 },
        { x: 0.47, y: 0.55 },
        { x: 0.23, y: 0.8 },
        { x: 0, y: 0.55 },
        { x: -0.23, y: 0.8 },
        { x: -0.47, y: 0.55 },
        { x: -0.7, y: 0.8 },
      ],
    ],
    dots: [
      { x: -0.25, y: -0.2, r: 0.16, hole: true },
      { x: 0.25, y: -0.2, r: 0.16, hole: true },
    ],
  },
}

/**
 * Raio da pastilha em fração da CÉLULA da grade, e não do tamanho da ficha: o
 * dragão de 3 quadrados ganha a mesma pastilha legível do humano — e mais
 * borda para enfileirá-las —, em vez de uma moeda gigante no meio da mesa.
 */
const BADGE_CELL_FRACTION = 0.18
/** Teto em fração do raio da ficha: ficha pequena encolhe a marca junto, a marca nunca engole a ficha. */
const BADGE_MAX_TOKEN_FRACTION = 0.5
/** Folga entre pastilhas vizinhas, em fração do raio da pastilha. */
const BADGE_GAP_FRACTION = 0.15
/** O leque de pastilhas nunca passa da metade de cima da ficha: embaixo mora o nome. */
const FAN_MAX_RADIANS = Math.PI

export interface ConditionBadge {
  condition: TokenCondition
  /** Centro da pastilha em px de mundo, relativo ao centro da ficha (y para baixo). */
  x: number
  y: number
}

export interface ConditionBadgeLayout {
  /** Raio de cada pastilha, em px de mundo. */
  radius: number
  badges: ConditionBadge[]
}

/**
 * Onde cada pastilha senta: centros NA BORDA da ficha, em leque simétrico a
 * partir do alto, na ordem recebida. Uma condição fica bem no topo; várias se
 * abrem para os lados sem encostar uma na outra e sem descer abaixo da linha
 * do meio da ficha (o nome é escrito embaixo). Se o leque não couber, as
 * pastilhas encolhem.
 *
 * Pastilha em px de mundo, como a ficha: acompanha o zoom junto com ela.
 */
export function conditionBadgeLayout(conditions: readonly TokenCondition[], tokenRadius: number, gridSize: number): ConditionBadgeLayout {
  const count = conditions.length
  if (count === 0 || !Number.isFinite(tokenRadius) || tokenRadius <= 0) return { radius: 0, badges: [] }
  const cell = Number.isFinite(gridSize) && gridSize > 0 ? gridSize : tokenRadius * 2
  // Distância entre centros vizinhos, medida em raios de pastilha.
  const spacing = 2 + BADGE_GAP_FRACTION
  let radius = Math.min(cell * BADGE_CELL_FRACTION, tokenRadius * BADGE_MAX_TOKEN_FRACTION)
  if (count > 1) {
    const widestStep = FAN_MAX_RADIANS / (count - 1)
    radius = Math.min(radius, (2 * tokenRadius * Math.sin(widestStep / 2)) / spacing)
  }
  const step = 2 * Math.asin(Math.min(1, (radius * spacing) / (2 * tokenRadius)))
  const badges = conditions.map((condition, i) => {
    const angle = -Math.PI / 2 + (i - (count - 1) / 2) * step
    return { condition, x: tokenRadius * Math.cos(angle), y: tokenRadius * Math.sin(angle) }
  })
  return { radius, badges }
}
