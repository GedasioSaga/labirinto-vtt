/**
 * O FOGO DA LAREIRA E DA FORNALHA (pedido do mestre de 29/10/2026): a chama
 * animada e o brilho são os da fogueira de hoje (`pixi/chamasDasFogueiras.ts`),
 * e o mestre acende ou apaga no painel ("Fogo": Aceso | Apagado). Aqui mora a
 * disposição que a imagem parada (`texturas/meioTermo/moveis/lareira.ts` e
 * `fornalha.ts`: as brasas, o halo, a lenha) e a camada animada (as línguas)
 * leem juntas, para cada língua nascer em cima da brasa pintada. O FORNO DE
 * PÃO e o BRASEIRO (11/11/2026) usam o mesmo fogo, sem código novo de
 * animação.
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

/** Os móveis com fogo que acende e apaga: a lareira, a fornalha, o forno de pão e o braseiro (11/11/2026). */
export type MovelComFogoDeCasa = 'lareira' | 'fornalha' | 'fornoDePao' | 'braseiro'

export function ehMovelComFogoDeCasa(tipo: string | undefined): tipo is MovelComFogoDeCasa {
  return tipo === 'lareira' || tipo === 'fornalha' || tipo === 'fornoDePao' || tipo === 'braseiro'
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

/**
 * FORNO DE PÃO (2 x 2 casas de partida, 11/11/2026): as três línguas no lar,
 * de trás para a frente, as duas do lado mais baixas e a do meio por último,
 * como na lareira. Nascem em volta do meio do fogo da imagem parada
 * (`FORNO_DE_PAO.fogo` em `texturas/meioTermo/moveis/fornoDePao.ts`: x 0,
 * y 0,355, onde as brasas e o halo ficam; a disposição mora lá porque só o
 * desenho a lê). São baixas (a do meio, 0,13 do lado menor): de cima a ponta
 * fica em cima do arco, sem passar para a cúpula, e na 3/4 fica dentro do
 * escuro da boca, abaixo do arco.
 */
export const LINGUAS_DO_FORNO_DE_PAO: readonly LinguaDeCasa[] = [
  { x: -0.055, y: 0.35, altura: 0.085, fase: 0.37 },
  { x: 0.055, y: 0.345, altura: 0.08, fase: 0.71 },
  { x: 0, y: 0.37, altura: 0.13, fase: 0 },
]

/**
 * BRASEIRO (0,8 x 0,8 casa de partida, 11/11/2026): a disposição que a imagem
 * parada (`texturas/meioTermo/moveis/braseiro.ts`) e a chama animada leem
 * juntas. `fogo` é o meio do monte de carvão, onde as línguas nascem, em
 * frações da pegada a partir do centro (x da largura, y da altura), sem giro;
 * `alturaDaBorda` é a altura da borda em fração do menor lado (0,72 casa no
 * braseiro de 0,8). O carvão queima rente à borda: na 3/4 a chama sobe essa
 * altura (`deslocamentoDaChama`), como a da fornalha. Mora aqui, e não no
 * desenho, pela mesma razão da `FORNALHA`: a tela lê a altura sem carregar o
 * motor dos móveis.
 */
export const BRASEIRO = {
  fogo: { x: 0, y: 0 },
  alturaDaBorda: 0.9,
} as const

/**
 * O braseiro (lote 13, 11/11/2026): o fogo de carvão numa bacia redonda, baixo e largo. Duas línguas atrás,
 * uma no meio do fundo, duas na frente e a principal no meio, todas dentro do miolo em brasa (0,34 da pegada).
 */
export const LINGUAS_DO_BRASEIRO: readonly LinguaDeCasa[] = [
  { x: -0.16, y: -0.06, altura: 0.24, fase: 0.21 },
  { x: 0.15, y: -0.07, altura: 0.22, fase: 0.63 },
  { x: 0, y: -0.12, altura: 0.27, fase: 0.45 },
  { x: -0.11, y: 0.07, altura: 0.26, fase: 0.37 },
  { x: 0.12, y: 0.06, altura: 0.25, fase: 0.79 },
  { x: 0, y: 0.02, altura: 0.36, fase: 0 },
]

const LINGUAS_DO_FOGO_DE_CASA: Readonly<Record<MovelComFogoDeCasa, readonly LinguaDeCasa[]>> = {
  lareira: LINGUAS_DA_LAREIRA,
  fornalha: LINGUAS_DA_FORNALHA,
  fornoDePao: LINGUAS_DO_FORNO_DE_PAO,
  braseiro: LINGUAS_DO_BRASEIRO,
}

/** As línguas do móvel. Móvel novo com fogo de casa sem as línguas dele aqui não compila. */
export function linguasDoFogoDeCasa(tipo: MovelComFogoDeCasa): readonly LinguaDeCasa[] {
  return LINGUAS_DO_FOGO_DE_CASA[tipo]
}
