import type { TipoMobilia } from './tipos'

/**
 * AS CONSTRUÇÕES (pedido do mestre de 12/11/2026: "certo objetos são construções inteiras [...] um torre não
 * da para passar por cima como barril então essas estruturas grande como torre tem que ter regrias própias").
 * Lista e critério: `tmp/novos-2026-11-12/construcoes/ACHADOS.md` §1; decisões do mestre no fim de `PEDIDOS.md`.
 *
 * Construção é estrutura feita para ficar ali (pedra, madeira, metal), do tamanho de uma pessoa em pé ou maior,
 * que dá nome ao lugar ("a praça do chafariz", "a torre"). Ela sai da ferramenta Objeto e mora na ferramenta
 * Construção (`'construcao'` em `types/tools.ts`), com os grupos daqui.
 *
 * NADA MUDA NO ARQUIVO DO MAPA: a construção continua um `Prop` com `mobilia: 'torreDePedra'`. A ferramenta é só
 * onde se escolhe, e a regra vem do tipo. Ponte, píer, palco e ringue ficam no Objeto (anda-se em cima deles).
 */
export const GRUPOS_DE_CONSTRUCAO = [
  { id: 'torresEPredios', titulo: 'Torres e prédios' },
  { id: 'pracaRuaECampo', titulo: 'Praça, rua e campo' },
  { id: 'monumentosEColunas', titulo: 'Monumentos e colunas' },
  { id: 'abrigosEPassagens', titulo: 'Abrigos e passagens' },
  // Os grupos das construções de 14/11/2026 (lotes L15, L16 e L19), na ordem da lista do dia: os fortes da base militar
  // vão com os do castelo; a caixa d'água vai para as torres e a estátua equestre e o obelisco, para os monumentos.
  { id: 'fortesECastelos', titulo: 'Fortes e castelos' },
  { id: 'cidadeEPorto', titulo: 'Cidade e porto' },
  { id: 'parqueEDiversao', titulo: 'Parque e diversão' },
] as const

export type IdDoGrupoDeConstrucao = (typeof GRUPOS_DE_CONSTRUCAO)[number]['id']

/**
 * O grupo de cada construção, na ordem em que ela aparece dentro do grupo. As 19 da lista aprovada e as 19 de
 * 14/11/2026 (lotes L15, L16 e L19, na ordem da lista do dia); tipo novo de construção entra com uma linha aqui (e sai
 * do Objeto sozinho, por `ehConstrucao`).
 */
export const GRUPO_DA_CONSTRUCAO = {
  torreDePedra: 'torresEPredios',
  torreDeVigia: 'torresEPredios',
  moinho: 'torresEPredios',
  mausoleu: 'torresEPredios',
  galinheiro: 'torresEPredios',
  barraca: 'torresEPredios',
  caixaDAguaElevada: 'torresEPredios',
  poco: 'pracaRuaECampo',
  chafariz: 'pracaRuaECampo',
  cataVento: 'pracaRuaECampo',
  antenaParabolica: 'pracaRuaECampo',
  estatua: 'monumentosEColunas',
  anjoDePedra: 'monumentosEColunas',
  pilar: 'monumentosEColunas',
  blocoDeInscricoesAzul: 'monumentosEColunas',
  blocoDeInscricoesVermelho: 'monumentosEColunas',
  blocoDeInscricoesDourado: 'monumentosEColunas',
  estatuaEquestre: 'monumentosEColunas',
  obelisco: 'monumentosEColunas',
  arcoDoPortao: 'abrigosEPassagens',
  tenda: 'abrigosEPassagens',
  tendaDeAdivinha: 'abrigosEPassagens',
  portaoComGradeLevadica: 'fortesECastelos',
  torreDeCerco: 'fortesECastelos',
  forcaComCadafalso: 'fortesECastelos',
  guarita: 'fortesECastelos',
  bunkerDeConcreto: 'fortesECastelos',
  conteiner: 'fortesECastelos',
  tendaMilitar: 'fortesECastelos',
  torreDeRadio: 'fortesECastelos',
  tanqueDeCombustivel: 'fortesECastelos',
  torreDoSino: 'cidadeEPorto',
  carrossel: 'parqueEDiversao',
  tendaDeCirco: 'parqueEDiversao',
  rodaGigante: 'parqueEDiversao',
  casaNaArvore: 'parqueEDiversao',
  pergolaComTrepadeira: 'parqueEDiversao',
  portalTorii: 'parqueEDiversao',
} as const satisfies Partial<Record<TipoMobilia, IdDoGrupoDeConstrucao>>

export type TipoDeConstrucao = keyof typeof GRUPO_DA_CONSTRUCAO

const TIPOS_DE_CONSTRUCAO: ReadonlySet<string> = new Set(Object.keys(GRUPO_DA_CONSTRUCAO))

/** O tipo é uma construção (mora na ferramenta Construção e segue as regras dela)? */
export function ehConstrucao(tipo: TipoMobilia | undefined): tipo is TipoDeConstrucao {
  return tipo !== undefined && TIPOS_DE_CONSTRUCAO.has(tipo)
}

/**
 * AS REGRAS DE FÁBRICA de cada construção (a chave da ficha vence, gravada só quando difere daqui):
 * - `barra`: barra a passagem da ficha do jogador, do NPC de rotina, da batalha e do veículo que o jogador dirige
 *   (o mestre atravessa sempre). Não barram as em que se entra ou se passa por baixo (o arco do portão, as duas
 *   tendas) e o galinheiro (o terreiro cercado é parte da pegada), como já era. A antena parabólica passa a barrar
 *   (2 x 2, sólida; decisão do mestre de 12/11/2026, a lista recomendada). Das construções de 14/11/2026 (decisão
 *   do Claude, pelo mesmo critério) não barram o portão com a grade erguida, a tenda militar, a tenda de circo e o
 *   carrossel (entra-se neles), a pérgola e o portal torii (passa-se por baixo); as outras barram.
 * - `peloMenorLado`: o desenho é medido pelo MENOR lado da caixa (`Math.min(hw, hh)` no desenho do Meio-Termo), e
 *   a colisão também (achado A5: a torre esticada barrava 1 casa de parede invisível além do desenho). Das de
 *   14/11/2026, as torres finas e altas: a torre do sino e a torre de rádio.
 */
interface RegraDeFabrica {
  readonly barra: boolean
  readonly peloMenorLado?: true
  /**
   * TAPA A VISÃO de fábrica (decisão do mestre de 12/11/2026): só quem é fechado de alvenaria do chão ao alto e mais
   * alto que uma pessoa — a torre de pedra, o moinho, o mausoléu e os 3 blocos de inscrições ("da altura do
   * mausoléu"). Vale também para os que já estão nos mapas (nos dele, só as 8 torres de pedra passam a tapar).
   * Das de 14/11/2026 (decisão do Claude), as fechadas e mais altas que uma pessoa: a torre do sino, o bunker de
   * concreto e o contêiner.
   */
  readonly tapa?: true
}

const REGRA_DE_FABRICA: Readonly<Record<TipoDeConstrucao, RegraDeFabrica>> = {
  torreDePedra: { barra: true, peloMenorLado: true, tapa: true },
  torreDeVigia: { barra: true, peloMenorLado: true },
  moinho: { barra: true, peloMenorLado: true, tapa: true },
  mausoleu: { barra: true, tapa: true },
  galinheiro: { barra: false },
  barraca: { barra: true },
  poco: { barra: true },
  chafariz: { barra: true },
  cataVento: { barra: true },
  antenaParabolica: { barra: true },
  estatua: { barra: true },
  anjoDePedra: { barra: true },
  pilar: { barra: true },
  blocoDeInscricoesAzul: { barra: true, tapa: true },
  blocoDeInscricoesVermelho: { barra: true, tapa: true },
  blocoDeInscricoesDourado: { barra: true, tapa: true },
  arcoDoPortao: { barra: false },
  tenda: { barra: false },
  tendaDeAdivinha: { barra: false },
  portaoComGradeLevadica: { barra: false },
  torreDeCerco: { barra: true },
  estatuaEquestre: { barra: true },
  obelisco: { barra: true },
  forcaComCadafalso: { barra: true },
  torreDoSino: { barra: true, peloMenorLado: true, tapa: true },
  guarita: { barra: true },
  bunkerDeConcreto: { barra: true, tapa: true },
  conteiner: { barra: true, tapa: true },
  tendaMilitar: { barra: false },
  caixaDAguaElevada: { barra: true },
  torreDeRadio: { barra: true, peloMenorLado: true },
  tanqueDeCombustivel: { barra: true },
  carrossel: { barra: false },
  tendaDeCirco: { barra: false },
  rodaGigante: { barra: true },
  casaNaArvore: { barra: true },
  pergolaComTrepadeira: { barra: false },
  portalTorii: { barra: false },
}

/** A construção barra a passagem de fábrica? */
export function construcaoBarraDeFabrica(tipo: TipoDeConstrucao): boolean {
  return REGRA_DE_FABRICA[tipo].barra
}

/** A construção tapa a visão de fábrica? */
export function construcaoTapaDeFabrica(tipo: TipoDeConstrucao): boolean {
  return REGRA_DE_FABRICA[tipo].tapa === true
}

/** A colisão (e o desenho) da construção é medida pelo menor lado da caixa? Não-construção: não. */
export function medidaPeloMenorLado(tipo: TipoMobilia | undefined): boolean {
  return ehConstrucao(tipo) && REGRA_DE_FABRICA[tipo].peloMenorLado === true
}

/** O nome da ferramenta onde a construção mora, para a busca do Objeto dizer "em Construção". */
export const NOME_DA_FERRAMENTA_CONSTRUCAO = 'Construção'
