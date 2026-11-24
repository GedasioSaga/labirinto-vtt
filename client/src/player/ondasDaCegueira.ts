import type { RegionPoint } from '../types/map'

/**
 * A ONDA DA CEGUEIRA (protótipo aprovado em 23/11/2026; docs/design/caracteristicas/NOTAS.md, "A onda"):
 * três anéis de pergaminho nascem no chão onde está quem o olho cego sente e se abrem até 2,6 casas;
 * um miolo fraco e parado marca o lugar. Cada anel vive 2,1 s e sai um a cada 700 ms; cada onda tem a
 * sua fase, para não pulsarem em coro. Abre em LINHA RETA: com ease-out o anel parava na borda meio
 * aceso por quase 1 s e lia como um círculo desenhado, não como uma onda (provas/onda-amostras.csv).
 * Entra em 150 ms; sai na hora. Movimento reduzido: três anéis parados.
 *
 * Conta pura: o Pixi (`camadaDasOndas.ts`) só aplica escala e alfa.
 */

export const ONDA_CICLO_MS = 2100
export const ONDA_INTERVALO_MS = 700
export const ONDA_ANEIS = 3
/** Diâmetro do anel aberto, em casas. */
export const ONDA_DIAMETRO_CASAS = 2.6
export const ONDA_ESCALA_INICIAL = 0.18
export const ONDA_ALFA_MAXIMO = 0.85
/** Fração do ciclo em que o anel chega ao alfa máximo (14%, como no protótipo). */
export const ONDA_PICO = 0.14
export const ONDA_ENTRADA_MS = 150
/** A onda que andou até esta distância (em casas) entre dois recortes é a mesma: guarda fase e entrada. */
export const ONDA_MESMA_ATE_CASAS = 1.5
/** Movimento reduzido: os três anéis parados. */
export const ONDA_PARADA: readonly Anel[] = [
  { escala: 0.4, alfa: 0.62 },
  { escala: 0.7, alfa: 0.4 },
  { escala: 1, alfa: 0.22 },
]

export interface Anel {
  escala: number
  alfa: number
}

export interface OndaViva {
  /** Chave local da tela (contador do cliente), nunca vinda do host. */
  chave: number
  x: number
  y: number
  fase: number
  nasceu: number
}

function resto(valor: number, divisor: number): number {
  return ((valor % divisor) + divisor) % divisor
}

/** O anel `indice` de uma onda de fase `fase`, no instante `agora` (ms). */
export function anelDaOnda(agora: number, fase: number, indice: number): Anel {
  const t = resto(agora - fase + indice * ONDA_INTERVALO_MS, ONDA_CICLO_MS) / ONDA_CICLO_MS
  const escala = ONDA_ESCALA_INICIAL + (1 - ONDA_ESCALA_INICIAL) * t
  const alfa = t < ONDA_PICO ? ONDA_ALFA_MAXIMO * (t / ONDA_PICO) : ONDA_ALFA_MAXIMO * (1 - (t - ONDA_PICO) / (1 - ONDA_PICO))
  return { escala, alfa }
}

/** A entrada de 150 ms (0 a 1), em ease-out como a `transition: opacity` do protótipo: aparece logo e assenta. */
export function entradaDaOnda(agora: number, nasceu: number): number {
  const p = Math.min(1, Math.max(0, (agora - nasceu) / ONDA_ENTRADA_MS))
  return 1 - (1 - p) ** 3
}

/** A fase de uma onda nova, pela posição: a mesma posição, a mesma fase (a folha de contato repete). */
export function faseDaPosicao(x: number, y: number): number {
  const mistura = Math.imul(Math.round(x), 73856093) ^ Math.imul(Math.round(y), 19349663)
  return resto(mistura, ONDA_CICLO_MS)
}

/**
 * Casa as ondas do recorte novo com as de antes: a mais perto, até 1,5 casa, continua a mesma
 * (fase, entrada e chave) e vai para a posição nova; a que sobrou nasce agora; a que não veio some.
 */
export function casarOndas(antes: readonly OndaViva[], novas: readonly RegionPoint[], casa: number, agora: number, proximaChave: () => number): OndaViva[] {
  const limite2 = (ONDA_MESMA_ATE_CASAS * casa) ** 2
  const livres = new Set(antes)
  return novas.map((ponto) => {
    let melhor: OndaViva | null = null
    let melhorD2 = limite2
    for (const onda of livres) {
      const d2 = (onda.x - ponto.x) ** 2 + (onda.y - ponto.y) ** 2
      if (d2 <= melhorD2) {
        melhor = onda
        melhorD2 = d2
      }
    }
    if (melhor === null) return { chave: proximaChave(), x: ponto.x, y: ponto.y, fase: faseDaPosicao(ponto.x, ponto.y), nasceu: agora }
    livres.delete(melhor)
    return { ...melhor, x: ponto.x, y: ponto.y }
  })
}
