/**
 * O FOGO DA LAREIRA E DA FORNALHA (pedido do mestre de 29/10/2026): a chama
 * animada e o brilho são os da fogueira de hoje (`pixi/chamasDasFogueiras.ts`),
 * e o mestre acende ou apaga no painel ("Fogo": Aceso | Apagado). Aqui mora a
 * disposição que a imagem parada (`texturas/meioTermo/moveis/lareira.ts` e
 * `fornalha.ts`: as brasas, o halo, a lenha) e a camada animada (as línguas)
 * leem juntas, para cada língua nascer em cima da brasa pintada.
 *
 * Tudo em FRAÇÃO da pegada (centro na origem, frente = lado de baixo, sem
 * giro): esticar a lareira afasta as línguas junto com a lenha, sem desenhar
 * outra coisa. Sem import de Pixi nem de `types/map.ts`: função pura.
 */

/** O estado do fogo que o painel oferece. Só `'apagado'` é gravado (em `Prop.mobiliaForma`): ausente = aceso. */
export type FogoDoMovel = 'aceso' | 'apagado'

export const FOGOS_DO_MOVEL: readonly FogoDoMovel[] = ['aceso', 'apagado']

export const ROTULO_DO_FOGO_DO_MOVEL: Readonly<Record<FogoDoMovel, string>> = {
  aceso: 'Aceso',
  apagado: 'Apagado',
}

/** Os móveis com fogo que acende e apaga. */
export type MovelComFogoDeCasa = 'lareira' | 'fornalha'

export function ehMovelComFogoDeCasa(tipo: string | undefined): tipo is MovelComFogoDeCasa {
  return tipo === 'lareira' || tipo === 'fornalha'
}

/** Uma língua: a base em fração da pegada (x da largura, y da altura), a altura em fração do lado menor e o atraso de fase. */
export interface LinguaDeCasa {
  readonly x: number
  readonly y: number
  readonly altura: number
  readonly fase: number
}

/**
 * LAREIRA (2 x 1 casas de partida), de trás para a frente: o peito da chaminé
 * de pedra, o consolo de madeira por cima da boca, as duas ombreiras de pedra,
 * o lar (o chão da boca, onde a lenha queima) entre elas e a soleira de pedra
 * rente ao chão. Frações da largura (x) e da altura (y), a partir do centro.
 */
export const LAREIRA = {
  chamine: { meiaLargura: 0.34, de: -0.5, ate: -0.2 },
  consolo: { meiaLargura: 0.47, de: -0.25, ate: -0.12 },
  ombreira: { de: 0.27, ate: 0.46 },
  lar: { meiaLargura: 0.27, de: -0.14, ate: 0.3 },
  soleira: { meiaLargura: 0.49, de: 0.28, ate: 0.49 },
  /** O centro do fogo no lar: o cruzamento das toras, onde as brasas e o halo ficam. */
  fogo: { x: 0, y: 0.1 },
} as const

/**
 * As três línguas da lareira, de TRÁS para a FRENTE (a da frente cobre a de
 * trás): as duas do lado, mais baixas e um pouco mais para o fundo, e a do
 * meio, a mais alta. A altura da do meio é a da fogueira de 1 casa (0,36 do
 * lado menor): a ponta chega no consolo, como o fogo subindo pela boca.
 */
export const LINGUAS_DA_LAREIRA: readonly LinguaDeCasa[] = [
  { x: -0.12, y: 0.13, altura: 0.25, fase: 0.37 },
  { x: 0.12, y: 0.12, altura: 0.23, fase: 0.71 },
  { x: 0, y: 0.17, altura: 0.36, fase: 0 },
]

/**
 * FORNALHA de ferreiro (1,5 x 1,5 casas de partida): a bancada de pedra com a
 * borda alta, o leito de carvão e o FOGAREIRO (a cova redonda das brasas), a
 * coifa da chaminé no fundo e o fole de madeira e couro à esquerda, soprando
 * na cova pelo bico de ferro. A altura da bancada é uma fração do lado menor
 * (`alturaDaBancada`), para a chama subir junto na vista 3/4 em qualquer grade.
 */
export const FORNALHA = {
  bancada: { de: -0.27, ate: 0.48, topo: -0.36, base: 0.46 },
  chamine: { x: 0.1, meiaLargura: 0.21, de: -0.5, ate: -0.22 },
  fogareiro: { x: 0.1, y: 0.1, raio: 0.15 },
  fole: { de: -0.49, ate: -0.2, y: 0.1, meiaLargura: 0.2 },
  /** Altura da bancada em fração do lado menor: 0,75 casa na fornalha de 1,5. */
  alturaDaBancada: 0.5,
} as const

/** A fornalha queima carvão: uma língua baixa no meio da cova, as brasas fazem o resto. */
export const LINGUAS_DA_FORNALHA: readonly LinguaDeCasa[] = [{ x: FORNALHA.fogareiro.x, y: FORNALHA.fogareiro.y + 0.03, altura: 0.24, fase: 0 }]

export function linguasDoFogoDeCasa(tipo: MovelComFogoDeCasa): readonly LinguaDeCasa[] {
  return tipo === 'lareira' ? LINGUAS_DA_LAREIRA : LINGUAS_DA_FORNALHA
}
