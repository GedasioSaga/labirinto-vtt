/**
 * PONTOS ESPALHADOS NO LADRILHO, sem grade: as árvores do Bosque, as poças do
 * Pântano. A grade de células (`vizinhos` em `ruido.ts`) põe um ponto por
 * célula; de longe ela ainda se lê como fileira, e o mestre viu o padrão.
 * Aqui os pontos caem por sorteio (dardo) com distância mínima entre eles, e
 * o mesmo sorteio decide onde ficam mais juntos (grupinhos) ou somem
 * (clareiras).
 *
 * O ladrilho é um TORO: a distância mede pela volta mais curta, então o ponto
 * perto da borda aparece inteiro dos dois lados da emenda (nenhuma copa
 * cortada) e a distância mínima vale atravessando a emenda também.
 *
 * Sorteio próprio (`sorteador`, só `Math.imul`): o mesmo ladrilho em qualquer
 * aparelho, como o `hash` de `ruido.ts`.
 */

export interface PontoEspalhado {
  /** Posição no ladrilho, em [0, 1). */
  x: number
  y: number
  /** Raio do que mora no ponto, em lados de ladrilho. */
  r: number
  /** Sorteios próprios do ponto em [0, 1) (cor, fase, forma). */
  a: number
  b: number
  c: number
}

export interface Espalhamento {
  pontos: readonly PontoEspalhado[]
  /** Células por lado da grade de busca. */
  grade: number
  /** Os índices dos pontos de cada célula (linha a linha). */
  baldes: readonly (readonly number[])[]
}

/** Sorteador determinístico (mulberry32) em [0, 1). */
export function sorteador(semente: number): () => number {
  let s = semente | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Diferença pela volta mais curta do toro, em (-0,5, 0,5]. */
export function naVolta(d: number): number {
  return d - Math.round(d)
}

export interface OpcoesDoEspalhamento {
  semente: number
  /** Quantos dardos jogar: mais dardos, mais cheio (até a distância mínima travar). */
  dardos: number
  /** Células por lado da grade de busca (a célula deve ser ~ o maior alcance). */
  grade: number
  /** Raio do ponto, do sorteio `s` e do lugar. */
  raio: (s: number, x: number, y: number) => number
  /** O dardo fica? `s` é um sorteio novo; devolva `false` para clareira. */
  fica: (x: number, y: number, s: number) => boolean
  /** Distância mínima entre os centros de dois pontos (raio + raio + folga). */
  distanciaMinima: (p: PontoEspalhado, q: PontoEspalhado) => number
}

function celula(t: number, grade: number): number {
  const c = Math.floor(t * grade)
  return ((c % grade) + grade) % grade
}

/**
 * Visita os pontos a menos de `alcance` de (u, v) (pela volta do toro), com a
 * diferença (dx, dy) = (u, v) - ponto já na volta mais curta. Nenhum ponto é
 * visitado duas vezes, mesmo com alcance grande.
 */
export function pontosPerto(
  e: Espalhamento,
  u: number,
  v: number,
  alcance: number,
  visita: (p: PontoEspalhado, dx: number, dy: number, indice: number) => void,
): void {
  const g = e.grade
  const raioEmCelulas = Math.min(Math.ceil(alcance * g), Math.floor((g - 1) / 2))
  const cx = celula(u, g)
  const cy = celula(v, g)
  for (let oy = -raioEmCelulas; oy <= raioEmCelulas; oy += 1) {
    const linha = (((cy + oy) % g) + g) % g
    for (let ox = -raioEmCelulas; ox <= raioEmCelulas; ox += 1) {
      const coluna = (((cx + ox) % g) + g) % g
      for (const i of e.baldes[linha * g + coluna]) {
        const p = e.pontos[i]
        visita(p, naVolta(u - p.x), naVolta(v - p.y), i)
      }
    }
  }
}

/**
 * Onde cada ponto ALCANÇA: a grade em que cada célula lista os pontos cujo
 * alcance (o raio da copa, da poça) toca nela. O ladrilho pergunta "quem
 * chega aqui?" olhando uma célula só, em vez de varrer as vizinhas — no
 * Pântano eram ~160 poças conferidas por pixel, agora são umas poucas.
 */
export interface Cobertura {
  grade: number
  baldes: readonly (readonly number[])[]
}

export function cobertura(e: Espalhamento, alcanceDe: (p: PontoEspalhado) => number, grade: number): Cobertura {
  const baldes: number[][] = Array.from({ length: grade * grade }, () => [])
  e.pontos.forEach((p, i) => {
    const a = alcanceDe(p)
    // Nunca mais que a volta inteira: o mesmo ponto não entra duas vezes na célula.
    const x0 = Math.floor((p.x - a) * grade)
    const y0 = Math.floor((p.y - a) * grade)
    const x1 = Math.min(Math.floor((p.x + a) * grade), x0 + grade - 1)
    const y1 = Math.min(Math.floor((p.y + a) * grade), y0 + grade - 1)
    for (let cy = y0; cy <= y1; cy += 1) {
      const linha = ((cy % grade) + grade) % grade
      for (let cx = x0; cx <= x1; cx += 1) baldes[linha * grade + (((cx % grade) + grade) % grade)].push(i)
    }
  })
  return { grade, baldes }
}

/** Visita os pontos cujo alcance cobre (u, v), com (dx, dy) já pela volta mais curta. */
export function pontosQueAlcancam(
  e: Espalhamento,
  c: Cobertura,
  u: number,
  v: number,
  visita: (p: PontoEspalhado, dx: number, dy: number, indice: number) => void,
): void {
  for (const i of c.baldes[celula(v, c.grade) * c.grade + celula(u, c.grade)]) {
    const p = e.pontos[i]
    visita(p, naVolta(u - p.x), naVolta(v - p.y), i)
  }
}

/** Espalha os pontos (dardo com distância mínima no toro). Puro e determinístico. */
export function espalhar(o: OpcoesDoEspalhamento): Espalhamento {
  const sorteio = sorteador(o.semente)
  const pontos: PontoEspalhado[] = []
  const baldes: number[][] = Array.from({ length: o.grade * o.grade }, () => [])
  const espalhamento: Espalhamento = { pontos, grade: o.grade, baldes }
  let maiorRaio = 0
  for (let k = 0; k < o.dardos; k += 1) {
    const x = sorteio()
    const y = sorteio()
    const s = sorteio()
    const novo: PontoEspalhado = { x, y, r: o.raio(s, x, y), a: sorteio(), b: sorteio(), c: sorteio() }
    if (!o.fica(x, y, sorteio())) continue
    // O alcance da busca: a maior distância mínima possível com quem já está.
    const alcance = novo.r + maiorRaio + o.distanciaMinima(novo, novo)
    let livre = true
    pontosPerto(espalhamento, x, y, alcance, (p, dx, dy) => {
      if (livre && Math.hypot(dx, dy) < o.distanciaMinima(novo, p)) livre = false
    })
    if (!livre) continue
    baldes[celula(y, o.grade) * o.grade + celula(x, o.grade)].push(pontos.length)
    pontos.push(novo)
    maiorRaio = Math.max(maiorRaio, novo.r)
  }
  return espalhamento
}
