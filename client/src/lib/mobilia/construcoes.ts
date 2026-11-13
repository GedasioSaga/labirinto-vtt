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
] as const

export type IdDoGrupoDeConstrucao = (typeof GRUPOS_DE_CONSTRUCAO)[number]['id']

/**
 * O grupo de cada construção, na ordem em que ela aparece dentro do grupo. As 19 da lista aprovada; tipo novo
 * de construção entra com uma linha aqui (e sai do Objeto sozinho, por `ehConstrucao`).
 */
export const GRUPO_DA_CONSTRUCAO = {
  torreDePedra: 'torresEPredios',
  torreDeVigia: 'torresEPredios',
  moinho: 'torresEPredios',
  mausoleu: 'torresEPredios',
  galinheiro: 'torresEPredios',
  barraca: 'torresEPredios',
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
  arcoDoPortao: 'abrigosEPassagens',
  tenda: 'abrigosEPassagens',
  tendaDeAdivinha: 'abrigosEPassagens',
} as const satisfies Partial<Record<TipoMobilia, IdDoGrupoDeConstrucao>>

export type TipoDeConstrucao = keyof typeof GRUPO_DA_CONSTRUCAO

const TIPOS_DE_CONSTRUCAO: ReadonlySet<string> = new Set(Object.keys(GRUPO_DA_CONSTRUCAO))

/** O tipo é uma construção (mora na ferramenta Construção e segue as regras dela)? */
export function ehConstrucao(tipo: TipoMobilia | undefined): tipo is TipoDeConstrucao {
  return tipo !== undefined && TIPOS_DE_CONSTRUCAO.has(tipo)
}

/** O nome da ferramenta onde a construção mora, para a busca do Objeto dizer "em Construção". */
export const NOME_DA_FERRAMENTA_CONSTRUCAO = 'Construção'
