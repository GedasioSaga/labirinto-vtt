/**
 * Guias de alinhamento (Onda 3, item 19).
 *
 * `computeAlignment` é o núcleo, puro: testa X e Y de forma independente
 * contra uma lista de candidatos e devolve tanto o ponto ajustado quanto as
 * linhas a desenhar (o integrador desenha, via `pixi/drawGuides.ts`). Não
 * sabe nada sobre "parede" ou "escada" — qualquer chamador com um `Point` e
 * uma lista de `AlignmentCandidate` usa, e sempre usou (a assinatura não
 * mudou). A cobertura INCONSISTENTE hoje — gruda ao mover parede/sala/token/
 * prop, não gruda ao mover escada, linha, curva, e nenhum resize — não é
 * limitação desta função: é que só 6 dos ~17 modos de arrasto/resize em
 * `pixi/PixiCanvas.tsx` chamam `computeAlignment`. Ver a tabela completa no
 * relatório do agente que fez este módulo (Onda 3, Frente C).
 *
 * Generalização entregue aqui — três candidatos novos, compostos livremente
 * com os de entidade que o chamador já monta:
 *  - `mapBoundsCandidates` — bordas e centro do mapa
 *  - `gridAlignmentCandidates` — interseção de grade mais próxima do ponto
 *  - `nearbyCandidates` — pré-filtro de proximidade (ver nota de custo nela)
 */

export interface Point {
  x: number
  y: number
}

export interface AlignmentCandidate {
  x: number
  y: number
}

export interface AlignmentGuide {
  axis: 'x' | 'y'
  position: number
}

export interface AlignmentResult {
  point: Point
  guides: AlignmentGuide[]
}

export const ALIGNMENT_THRESHOLD = 6

export function computeAlignment(
  point: Point,
  candidates: AlignmentCandidate[],
  threshold = ALIGNMENT_THRESHOLD,
): AlignmentResult {
  const result: Point = { ...point }
  const guides: AlignmentGuide[] = []

  for (const axis of ['x', 'y'] as const) {
    let bestDistance = Infinity
    let bestPosition: number | null = null
    for (const candidate of candidates) {
      const distance = Math.abs(candidate[axis] - point[axis])
      if (distance <= threshold && distance < bestDistance) {
        bestDistance = distance
        bestPosition = candidate[axis]
      }
    }
    if (bestPosition !== null) {
      result[axis] = bestPosition
      guides.push({ axis, position: bestPosition })
    }
  }

  return { point: result, guides }
}

/**
 * Bordas e centro do mapa como candidatos de alinhamento. Como cada eixo é
 * testado de forma independente em `computeAlignment` (eixo X só olha
 * `candidate.x`, eixo Y só `candidate.y`), os 4 cantos + o centro bastam pra
 * cobrir as 3 guias por eixo (esquerda/direita/centro-X, topo/base/centro-Y)
 * — não precisa enumerar a borda inteira nem repetir candidato por eixo.
 */
export function mapBoundsCandidates(map: { width: number; height: number }): AlignmentCandidate[] {
  const { width, height } = map
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: 0, y: height },
    { x: width, y: height },
    { x: width / 2, y: height / 2 },
  ]
}

/**
 * Interseção de grade mais próxima do ponto sendo arrastado, como candidato
 * único. Não enumera linhas de grade (seriam infinitas) — calcula a mais
 * próxima direto, O(1). `cellSize` ausente/zero/negativo (grade desligada ou
 * campo não preenchido) devolve lista vazia, nunca `NaN`.
 *
 * Nota pro integrador: quando o snap de grade "duro" já está ligado
 * (`applySnap` em `pixi/PixiCanvas.tsx` roda ANTES de chamar
 * `computeAlignment` em todo modo hoje), este candidato tende a ser
 * redundante — o ponto já chega exatamente na grade, então a guia de grade
 * coincidiria com a de snap. Ele passa a importar quando o snap de grade
 * está desligado (Alt) ou nos modos que ainda não chamam `applySnap` com
 * `map.grid` — aí a guia visual é o único sinal de "a grade está aqui perto".
 */
export function gridAlignmentCandidates(point: Point, cellSize: number): AlignmentCandidate[] {
  if (!(cellSize > 0)) return []
  return [
    {
      x: Math.round(point.x / cellSize) * cellSize,
      y: Math.round(point.y / cellSize) * cellSize,
    },
  ]
}

/**
 * Pré-filtro de proximidade: reduz a lista de candidatos antes do loop O(n)
 * de `computeAlignment`. Mantém um candidato se ele está dentro de `radius`
 * em QUALQUER um dos dois eixos — mesma semântica por-eixo de
 * `computeAlignment` (um candidato longe em Y mas perto em X ainda é válido
 * pra guia X; filtrar por distância euclidiana descartaria esse caso).
 *
 * Custo medido (mapa sintético gerado em `bench-alignment.mjs`, script
 * descartável apagado depois da medição — números no relatório do agente):
 *  - mapa "grande" realista pra este app (500 paredes + 100 salas de 8
 *    pontos + 200 tokens = 2000 candidatos): ~43µs por chamada de
 *    `computeAlignment` SEM pré-filtro — 0,26% de um frame de 16,6ms a
 *    60fps. Não precisa de pré-filtro nessa escala, e é a escala normal de
 *    uma masmorra.
 *  - estresse (5000 paredes + 1000 salas + 2000 tokens = 20 000
 *    candidatos): ~442µs sem pré-filtro, ~113µs com (~4× mais rápido).
 *  - extremo (20 000 paredes = 40 000 candidatos): ~886µs sem, ~227µs com.
 * Mesmo no extremo, sem pré-filtro, o custo fica abaixo de 1 frame inteiro.
 * Conclusão: no tamanho de mapa que este app trata, `computeAlignment`
 * sozinho já é barato o bastante — este pré-filtro é uma salvaguarda
 * disponível para mapa fora do normal (importação grande, geração
 * procedural), não uma exigência do caminho comum. Não chamá-la por padrão.
 */
export function nearbyCandidates(
  point: Point,
  candidates: AlignmentCandidate[],
  radius = ALIGNMENT_THRESHOLD,
): AlignmentCandidate[] {
  const out: AlignmentCandidate[] = []
  for (const candidate of candidates) {
    if (Math.abs(candidate.x - point.x) <= radius || Math.abs(candidate.y - point.y) <= radius) {
      out.push(candidate)
    }
  }
  return out
}
