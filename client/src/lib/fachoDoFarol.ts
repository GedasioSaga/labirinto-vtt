import type { RegionPoint } from '../types/map'

/**
 * O FACHO QUE GIRA do farol (item 95 da lista de 14/11/2026, "Farol: luz que gira"; correção da auditoria de
 * 14/11/2026). A luz redonda do farol continua a de toda peça (`LUZ_DOS_OBJETOS` em `lib/luzDoFogo.ts`: o alcance
 * vale para o desenho e para a visão do jogador); por cima dela, no mapa de luz (`pixi/mapaDeLuz.ts`), os FACHOS:
 * cunhas de claro que nascem da lanterna e dão a volta devagar, recortadas pela parede como a luz redonda. Só o
 * desenho gira: a visão do jogador não muda com o facho (o claro redondo já revela o alcance inteiro).
 *
 * Parte pura (sem Pixi): o ângulo no instante e a cunha recortada pelo polígono de visibilidade da luz.
 */

/** Como o facho é: quantos (opostos, como a lente de um farol de verdade), a abertura, a volta e a força dele. */
export interface FachoQueGira {
  /** Quantos fachos, espalhados por igual na volta (2 = um de cada lado da lente). */
  readonly fachos: number
  /** A abertura de cada facho, em radianos. */
  readonly abertura: number
  /** O tempo de uma volta inteira, em segundos. */
  readonly voltaEmSegundos: number
  /** Quanto do claro do facho entra no centro (0 a 1), somado por cima da luz redonda. */
  readonly forca: number
}

/** Raios por facho: a beira da cunha segue a parede com folga, e o custo fica em ~12 x arestas por quadro. */
const RAIOS_POR_FACHO = 12

/** O ângulo do primeiro facho no instante `tempoMs` (a `fase` em voltas tira os faróis do mesmo passo). */
export function anguloDoFacho(tempoMs: number, facho: Pick<FachoQueGira, 'voltaEmSegundos'>, fase: number): number {
  const volta = facho.voltaEmSegundos > 0 ? facho.voltaEmSegundos : 1
  return 2 * Math.PI * (tempoMs / 1000 / volta + fase)
}

/**
 * Onde o raio que sai do `centro` no `angulo` bate na borda do polígono (a visibilidade da luz, em estrela em volta
 * do centro: o raio sai dele uma vez só). Sem borda no caminho (polígono torto), a ponta no `raio`.
 */
function pontaDoRaio(centro: RegionPoint, poligono: readonly RegionPoint[], angulo: number, raio: number): RegionPoint {
  const dx = Math.cos(angulo)
  const dy = Math.sin(angulo)
  let menor = raio
  for (let i = 0; i < poligono.length; i += 1) {
    const a = poligono[i]
    const b = poligono[(i + 1) % poligono.length]
    const ex = b.x - a.x
    const ey = b.y - a.y
    const det = ex * dy - ey * dx
    if (Math.abs(det) < 1e-9) continue
    const ax = a.x - centro.x
    const ay = a.y - centro.y
    // centro + t (dx, dy) = a + s (ex, ey), com t >= 0 e s em [0, 1].
    const t = (ex * ay - ey * ax) / det
    const s = (dx * ay - dy * ax) / det
    if (t >= 0 && s >= 0 && s <= 1 && t < menor) menor = t
  }
  return { x: centro.x + dx * menor, y: centro.y + dy * menor }
}

/**
 * As cunhas dos fachos no ângulo dado, cada uma um polígono que começa no centro e vai de uma beira à outra pela
 * borda da visibilidade (a parede corta o facho como corta a luz redonda).
 */
export function cunhasDoFacho(
  centro: RegionPoint,
  poligono: readonly RegionPoint[],
  raio: number,
  facho: Pick<FachoQueGira, 'fachos' | 'abertura'>,
  angulo: number,
): RegionPoint[][] {
  if (poligono.length < 3 || !(raio > 0) || !(facho.abertura > 0)) return []
  const quantos = Math.max(1, Math.round(facho.fachos))
  const cunhas: RegionPoint[][] = []
  for (let k = 0; k < quantos; k += 1) {
    const meio = angulo + (2 * Math.PI * k) / quantos
    const cunha: RegionPoint[] = [{ x: centro.x, y: centro.y }]
    for (let r = 0; r <= RAIOS_POR_FACHO; r += 1) {
      cunha.push(pontaDoRaio(centro, poligono, meio - facho.abertura / 2 + (facho.abertura * r) / RAIOS_POR_FACHO, raio))
    }
    cunhas.push(cunha)
  }
  return cunhas
}
