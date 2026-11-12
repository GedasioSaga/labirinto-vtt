/**
 * O FOGO DA LAREIRA E DA FORNALHA (pedido do mestre de 29/10/2026): a chama
 * animada e o brilho são os da fogueira de hoje (`pixi/chamasDasFogueiras.ts`),
 * e o mestre acende ou apaga no painel ("Fogo": Aceso | Apagado). Aqui mora a
 * disposição que a imagem parada (`texturas/meioTermo/moveis/lareira.ts` e
 * `fornalha.ts`: as brasas, o halo, a lenha) e a camada animada (as línguas)
 * leem juntas, para cada língua nascer em cima da brasa pintada. O FORNO DE
 * PÃO e o BRASEIRO (11/11/2026) e as duas TOCHAS (12/11/2026) usam o mesmo
 * fogo, sem código novo de animação.
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

/**
 * Os móveis com fogo que acende e apaga: a lareira, a fornalha, o forno de pão e o braseiro (11/11/2026) e a
 * tocha de parede e a tocha de pé (12/11/2026).
 */
export type MovelComFogoDeCasa = 'lareira' | 'fornalha' | 'fornoDePao' | 'braseiro' | 'tochaDeParede' | 'tochaDePe'

export function ehMovelComFogoDeCasa(tipo: string | undefined): tipo is MovelComFogoDeCasa {
  return tipo === 'lareira' || tipo === 'fornalha' || tipo === 'fornoDePao' || tipo === 'braseiro' || tipo === 'tochaDeParede' || tipo === 'tochaDePe'
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

/** Onde a chama nasce, no formato do `BRASEIRO`: o fogo em fração da pegada (sem giro) e a altura em fração do menor lado. */
export interface DisposicaoDoFogo {
  readonly fogo: { readonly x: number; readonly y: number }
  readonly alturaDaBorda: number
}

/**
 * TOCHA DE PÉ (0,6 x 0,6 casa de partida, 12/11/2026): as alturas que a imagem
 * parada (`texturas/meioTermo/moveis/tochaDePe.ts`) e a chama animada leem
 * juntas. A haste (até o fundo do cesto) e o quanto a cabeça passa da boca do
 * cesto são em LADOS (o menor lado da pegada: esticada, a tocha cresce junto);
 * a altura do cesto é em casas e não cresce. Moram aqui, e não no desenho,
 * pela mesma razão do `BRASEIRO`: a tela lê a altura sem carregar o motor dos
 * móveis.
 */
export const TOCHA_DE_PE = {
  alturaDaHaste: 1.92,
  sobraDaCabeca: 0.1,
  alturaDoCestoEmCasas: 0.16,
} as const

/**
 * Onde a chama da tocha de pé nasce: o meio da cabeça, no meio da pegada, e o
 * alto da cabeça em fração do menor lado (2,29 no tamanho de partida; muda um
 * pouco com o tamanho porque o cesto tem altura fixa). A pegada em casas.
 */
export function fogoDaTochaDePe(largura: number, altura: number): DisposicaoDoFogo {
  const lado = Math.min(largura, altura)
  return { fogo: { x: 0, y: 0 }, alturaDaBorda: TOCHA_DE_PE.alturaDaHaste + TOCHA_DE_PE.sobraDaCabeca + TOCHA_DE_PE.alturaDoCestoEmCasas / lado }
}

/**
 * TOCHA DE PAREDE (0,4 x 0,5 casa de partida, 12/11/2026): a parede é a beira
 * de cima da pegada. Em fração do menor MEIO lado, contadas da parede: onde
 * fica a argola, quanto a cabeça passa dela e a grossura da chapa; em lados, a
 * altura da chapa e a da cabeça no desenho EM PÉ (antes de
 * `SUBIDA_DA_TOCHA_DE_PAREDE`). Moram aqui pela razão da tocha de pé; o
 * desenho (`texturas/meioTermo/moveis/tochaDeParede.ts`) lê daqui.
 */
export const TOCHA_DE_PAREDE = {
  argolaEm: 0.55,
  cabecaAlemDaArgola: 0.36,
  grossuraDaChapa: 0.2,
  alturaDaChapa: 0.9,
  alturaDaCabeca: 1.6,
} as const

/**
 * Quanto a tocha de parede sobe na 3/4, em fração das alturas do desenho em pé
 * (decisão 27 do mestre, achado V5 de 12/11/2026). A parede do app é uma linha
 * sem altura: subindo inteira (a chapa a 0,9 lado), a tocha da parede de cima
 * ia parar fora da sala e a da parede de baixo ficava solta, a meia casa da
 * linha. Agora ela sobe só o bastante para a chapa continuar na linha da
 * parede: a chapa sobe a própria grossura (0,1 lado, 1/9 do em pé), a cabeça
 * fica dentro da sala na parede de cima e, na de baixo, a chapa fica encostada
 * na linha. Todas as alturas (a chapa, o cabo, a cabeça, a beirada e a chama
 * animada) encolhem pelo mesmo fator: a forma da 3/4 é a mesma, mais baixa.
 */
export const SUBIDA_DA_TOCHA_DE_PAREDE = TOCHA_DE_PAREDE.grossuraDaChapa / 2 / TOCHA_DE_PAREDE.alturaDaChapa

/**
 * Onde a chama da tocha de parede nasce: o meio da cabeça e o alto dela em
 * fração do menor lado. A cabeça mora a uma distância fixa da parede, então
 * esticar a pegada muda a fração: por isso é função, não constante. A pegada
 * em casas (ou em px: a fração não muda com a escala); no tamanho de partida
 * dá x 0, y -0,136 e altura 1,6 / 9 (a cabeça na 3/4, `SUBIDA_DA_TOCHA_DE_PAREDE`).
 */
export function fogoDaTochaDeParede(largura: number, altura: number): DisposicaoDoFogo {
  const meioLado = Math.min(largura, altura) / 2
  const cabeca = -altura / 2 + (TOCHA_DE_PAREDE.argolaEm + TOCHA_DE_PAREDE.cabecaAlemDaArgola) * meioLado
  return { fogo: { x: 0, y: cabeca / altura }, alturaDaBorda: TOCHA_DE_PAREDE.alturaDaCabeca * SUBIDA_DA_TOCHA_DE_PAREDE }
}

/**
 * As tochas (lote 17, 12/11/2026): uma chama de pano com óleo, alta e estreita, com duas línguas baixas dos
 * lados. Em volta do FOGO de cada uma (`linguasDoFogoDeCasa` soma o lugar dele), e não do meio da pegada: na
 * de parede o fogo muda de lugar com a pegada.
 */
export const LINGUAS_DA_TOCHA_DE_PAREDE: readonly LinguaDeCasa[] = [
  { x: -0.07, y: 0.02, altura: 0.4, fase: 0.41 },
  { x: 0.07, y: -0.01, altura: 0.42, fase: 0.77 },
  { x: 0, y: 0, altura: 0.75, fase: 0 },
]

export const LINGUAS_DA_TOCHA_DE_PE: readonly LinguaDeCasa[] = [
  { x: -0.07, y: 0.02, altura: 0.3, fase: 0.37 },
  { x: 0.07, y: -0.02, altura: 0.32, fase: 0.71 },
  { x: 0, y: 0, altura: 0.55, fase: 0 },
]

const LINGUAS_DO_FOGO_DE_CASA: Readonly<Record<MovelComFogoDeCasa, readonly LinguaDeCasa[]>> = {
  lareira: LINGUAS_DA_LAREIRA,
  fornalha: LINGUAS_DA_FORNALHA,
  fornoDePao: LINGUAS_DO_FORNO_DE_PAO,
  braseiro: LINGUAS_DO_BRASEIRO,
  tochaDeParede: LINGUAS_DA_TOCHA_DE_PAREDE,
  tochaDePe: LINGUAS_DA_TOCHA_DE_PE,
}

/**
 * As línguas do móvel nesta pegada (largura e altura na mesma unidade). Móvel novo com fogo de casa sem as
 * línguas dele aqui não compila. As das tochas são em volta do fogo, que a pegada põe no lugar; as dos outros
 * já são em fração da pegada a partir do meio.
 */
export function linguasDoFogoDeCasa(tipo: MovelComFogoDeCasa, largura: number, altura: number): readonly LinguaDeCasa[] {
  const linguas = LINGUAS_DO_FOGO_DE_CASA[tipo]
  if (tipo !== 'tochaDeParede' && tipo !== 'tochaDePe') return linguas
  const { fogo } = tipo === 'tochaDeParede' ? fogoDaTochaDeParede(largura, altura) : fogoDaTochaDePe(largura, altura)
  return linguas.map((lingua) => ({ ...lingua, x: lingua.x + fogo.x, y: lingua.y + fogo.y }))
}
