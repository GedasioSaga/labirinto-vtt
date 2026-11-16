/**
 * SORTE DETERMINÍSTICA DOS JOGOS DE ABRIR: mulberry32 semeado por um hash
 * FNV-1a da semente (texto ou número), igual à pesca do app. Mesma semente,
 * mesma partida; fluxos independentes saem de sufixos (`semente + '|robo'`),
 * para o sorteio do robô nunca mudar o sorteio do jogo.
 */

export type Rng = () => number

function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(a: number): Rng {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Gerador em [0, 1) a partir de uma semente de texto ou número. */
export const rngDe = (s: string | number): Rng => mulberry32(hash(String(s)))

/** Sorteio uniforme em [a, b). */
export const entre = (r: Rng, a: number, b: number): number => a + (b - a) * r()

/** Inteiro uniforme em [0, n). */
export const inteiro = (r: Rng, n: number): number => Math.floor(r() * n)

/** Normal padrão (Box-Muller): o erro humano do robô. */
export function gauss(r: Rng): number {
  let u = 0
  while (u === 0) u = r()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}
