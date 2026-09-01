/**
 * Geometria pura e determinística das texturas de traço livre (Drawing kind
 * "freehand") — feature N1 do usuário ("pincel: caneta, lápis e afins",
 * ROADMAP.md Fase 4, exemplo dado pelo próprio usuário). Fonte da decisão:
 * `docs/DOSSIE-FEEDBACK-F4.md`, entrada "brush" do catálogo em
 * `lib/toolVariants.ts`.
 *
 * Sem estado, sem `Math.random`: cada textura calcula sua variação a partir
 * das próprias coordenadas do traço (mais o índice do segmento), então o
 * mesmo `points` produz sempre o mesmo resultado — regra dura do briefing:
 * "não use Math.random no render, senão o desenho muda a cada frame". Sem
 * shader custom, sem dependência nova — só geometria e variação de largura/
 * alpha por segmento, aplicadas pelo chamador (pixi/drawDrawings.ts,
 * pixi/drawDraft.ts) via chamadas normais de `Graphics.stroke()`.
 *
 * "pen" (caneta) NÃO usa nada deste arquivo — é o traço sólido de hoje,
 * literal, para garantir compatibilidade byte-a-byte com mapa legado
 * (`texture === undefined` tem que renderizar EXATAMENTE como antes desta
 * fase, mesma regra que já vale para `cap`). Só "pencil" e "marker" passam
 * pelas funções abaixo.
 */

/**
 * As 3 texturas viáveis em PixiJS 8 sem shader/dependência nova. Tipo dono
 * deste arquivo — não importado de `types/map.ts` de propósito, mesmo padrão
 * já usado no repo entre `lib/curveMath.ts` (`Point`/`BezierSegment`) e
 * `types/map.ts` (`DrawingPoint`): dois tipos estruturalmente iguais,
 * declarados em módulos diferentes, sem acoplar o arquivo-fundação (que hoje
 * não importa nada, `types/map.ts:1-6`) a um lib. Ver CONTRATO no relatório
 * do agente para o campo equivalente que o integrador adiciona em
 * `types/map.ts` (`FreehandTexture`, sugerido) — os dois convivem porque são
 * o MESMO union literal, só com nomes diferentes por módulo.
 */
export type BrushTexture = 'pen' | 'pencil' | 'marker'

export interface BrushPoint {
  x: number
  y: number
}

/** Um trecho de traço com sua própria largura/alpha. Várias dessas por
 *  desenho é o que dá a irregularidade do lápis — um `stroke()` só (como o
 *  traço de caneta) teria largura/alpha uniforme o traço inteiro. */
export interface BrushSegment {
  from: BrushPoint
  to: BrushPoint
  width: number
  alpha: number
}

/**
 * Lê `texture` de um `Drawing` freehand SEM depender do campo já existir em
 * `types/map.ts` (arquivo do integrador, fora do meu escopo nesta fase — ver
 * CONTRATO). `texture?: unknown` no parâmetro é o truque: qualquer objeto
 * `{kind:'freehand', ...}` — com ou sem a propriedade `texture` de fato —
 * satisfaz esse tipo estruturalmente (propriedade opcional ausente é válida
 * em TS), então não precisa de `as`/cast nenhum aqui. O valor é então
 * VALIDADO em runtime contra o union literal: qualquer coisa que não seja
 * exatamente 'pencil'/'marker' (`undefined` de mapa legado incluído, e
 * qualquer valor corrompido/desconhecido) cai em 'pen', o comportamento de
 * hoje. Assim que o integrador adicionar `texture?: <Tipo>` de verdade ao
 * kind 'freehand', esta função continua funcionando sem mudar nenhum
 * chamador — a propriedade real passa a ser lida no lugar de `undefined`.
 */
export function readFreehandTexture(drawing: { kind: 'freehand'; texture?: unknown }): BrushTexture {
  const raw = drawing.texture
  return raw === 'pencil' || raw === 'marker' ? raw : 'pen'
}

/**
 * Hash determinístico clássico (seno de grande escala, fração descartada) —
 * mesmo truque usado em ruído procedural sem dependência: para o mesmo par
 * (x, y) sempre produz o mesmo valor em [0, 1). Nada de `Math.random`, nada
 * de estado — é por isso que o traço de lápis não "treme" entre frames.
 */
function hash01(x: number, y: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

const PENCIL_WIDTH_FACTOR_MIN = 0.55
const PENCIL_WIDTH_FACTOR_MAX = 1.0
const PENCIL_ALPHA_MIN = 0.5
const PENCIL_ALPHA_MAX = 0.85

/**
 * Quebra o traço em um segmento por par de pontos consecutivos, cada um com
 * largura e alpha levemente diferentes — é essa variação segmento a segmento
 * que sugere grafite (traço de caneta é um `stroke()` só, uniforme). Cada
 * segmento usa DOIS hashes com offsets diferentes (largura vs. alpha) pra não
 * andarem em lockstep — senão o traço fica "pulsando" de forma óbvia em vez
 * de parecer textura orgânica.
 *
 * `points.length < 2` retorna `[]` (nada pra desenhar) — mesma guarda que o
 * chamador já aplica antes de qualquer `moveTo`.
 */
export function computePencilSegments(points: BrushPoint[], baseWidth: number): BrushSegment[] {
  if (points.length < 2) return []

  const segments: BrushSegment[] = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]
    const to = points[i + 1]
    const midX = (from.x + to.x) / 2
    const midY = (from.y + to.y) / 2

    const widthT = hash01(midX * 0.5 + i, midY * 0.5 - i)
    const alphaT = hash01(midX * 0.9 - i * 3, midY * 0.9 + i * 7)

    const width = baseWidth * (PENCIL_WIDTH_FACTOR_MIN + widthT * (PENCIL_WIDTH_FACTOR_MAX - PENCIL_WIDTH_FACTOR_MIN))
    const alpha = PENCIL_ALPHA_MIN + alphaT * (PENCIL_ALPHA_MAX - PENCIL_ALPHA_MIN)

    segments.push({ from, to, width, alpha })
  }
  return segments
}

const MARKER_WIDTH_FACTOR = 1.7
const MARKER_ALPHA = 0.55

/**
 * Estilo do traço de marcador: mais grosso e translúcido. Diferente do
 * lápis, é um `stroke()` só (uniforme) — a "sobreposição visível" que o
 * usuário pediu vem de graça do próprio alpha < 1 nos trechos em que o traço
 * livre se cruza consigo mesmo (mão passando duas vezes pelo mesmo lugar),
 * sem precisar desenhar nada em duplicata nem calcular interseção — é
 * exatamente como um marcador real overlapa quando a mão volta no mesmo
 * traço.
 */
export function computeMarkerStroke(baseWidth: number): { width: number; alpha: number } {
  return { width: baseWidth * MARKER_WIDTH_FACTOR, alpha: MARKER_ALPHA }
}
