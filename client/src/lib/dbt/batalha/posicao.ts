/**
 * A grade da cena para o motor (docs/planos/dbt-batalha.md, seções 7.1 e 11).
 * Só existe com a cena aberta no mapa do mestre; sem posição, as fontes
 * posicionais ficam desligadas e o mestre liga à mão.
 */

export interface PosicaoNaCena {
  col: number
  row: number
  /** Lado em casas (token 2x2 = 2). */
  tamanho: number
}

export interface PosicoesDaCena {
  metrosPorCasa: number
  tokens: ReadonlyMap<string, PosicaoNaCena>
}

/** Casas entre as bordas de dois tokens (diagonal conta 1); 0 = sobrepostos, 1 = lado a lado. */
export function casasEntre(a: PosicaoNaCena, b: PosicaoNaCena): number {
  const dx = Math.max(0, a.col - (b.col + b.tamanho - 1), b.col - (a.col + a.tamanho - 1))
  const dy = Math.max(0, a.row - (b.row + b.tamanho - 1), b.row - (a.row + a.tamanho - 1))
  return Math.max(dx, dy)
}

export function adjacentes(p: PosicoesDaCena, a: string, b: string): boolean {
  const pa = p.tokens.get(a)
  const pb = p.tokens.get(b)
  return pa !== undefined && pb !== undefined && casasEntre(pa, pb) <= 1
}

export function distanciaEmMetros(p: PosicoesDaCena, a: string, b: string): number | null {
  const pa = p.tokens.get(a)
  const pb = p.tokens.get(b)
  return pa === undefined || pb === undefined ? null : Math.max(0, casasEntre(pa, pb) - 1) * p.metrosPorCasa
}

function centro(pos: PosicaoNaCena): { x: number; y: number } {
  return { x: pos.col + pos.tamanho / 2, y: pos.row + pos.tamanho / 2 }
}

/** Flanqueamento: um aliado do atacante, adjacente ao alvo, do lado oposto ao atacante (7.1). */
export function flanqueado(p: PosicoesDaCena, alvoId: string, atacanteId: string, aliadosDoAtacante: readonly string[]): boolean {
  const alvo = p.tokens.get(alvoId)
  const atacante = p.tokens.get(atacanteId)
  if (alvo === undefined || atacante === undefined || !adjacentes(p, alvoId, atacanteId)) return false
  const c = centro(alvo)
  const ida = { x: centro(atacante).x - c.x, y: centro(atacante).y - c.y }
  return aliadosDoAtacante.some((id) => {
    const aliado = p.tokens.get(id)
    if (id === atacanteId || aliado === undefined || !adjacentes(p, alvoId, id)) return false
    const volta = { x: centro(aliado).x - c.x, y: centro(aliado).y - c.y }
    return ida.x * volta.x + ida.y * volta.y < 0
  })
}

/** Sob ameaça: algum inimigo adjacente. */
export function sobAmeaca(p: PosicoesDaCena, id: string, inimigos: readonly string[]): boolean {
  return inimigos.some((inimigo) => adjacentes(p, id, inimigo))
}

/** O mais perto de `id` entre os candidatos; sem posição de ninguém, o primeiro. */
export function maisProximo(p: PosicoesDaCena | null, id: string, candidatos: readonly string[]): string | null {
  if (candidatos.length === 0) return null
  if (p === null) return candidatos[0]
  let melhor: string | null = null
  let menor = Number.POSITIVE_INFINITY
  for (const candidato of candidatos) {
    const metros = distanciaEmMetros(p, id, candidato)
    if (metros !== null && metros < menor) {
      menor = metros
      melhor = candidato
    }
  }
  return melhor ?? candidatos[0]
}
