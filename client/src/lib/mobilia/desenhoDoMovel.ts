/**
 * O DESENHO de cada móvel com o Meio-Termo ligado (fatia MT12 do plano
 * `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`): com textura (o
 * padrão) ou EM LINHAS, o desenho de antes (`Prop.mobiliaDesenho: 'linhas'`).
 *
 * Decisão do usuário: "versões antigas de linhas ficam no catálogo para mapas
 * novos". Só os 11 móveis de antes TÊM uma versão em linhas que o usuário
 * conhecia; as peças novas (MT4 e MT5) nasceram com textura e o desenho de
 * linhas delas é só o provisório que aparece enquanto a imagem não fica pronta
 * (`pecasNovas.ts`), nunca aprovado como desenho. Por isso o catálogo oferece
 * "Linhas" só nos 11 de antes, e a peça nova sai SEMPRE com textura, mesmo que
 * um arquivo traga `mobiliaDesenho: 'linhas'` nela (a leitura do arquivo aceita
 * o campo em qualquer tipo, MT9; quem decide o desenho é daqui).
 *
 * Sem import de `types/map.ts` nem de `lib/mobilia.ts`, para não criar ciclo.
 */
import { ehPecaNova } from './pecasNovas'
import { TIPOS_MOBILIA, type TipoMobilia } from './tipos'

/** Os tipos que o catálogo oferece em linhas: os 11 de antes, na ordem de `TIPOS_MOBILIA`. */
export const TIPOS_COM_DESENHO_EM_LINHAS: readonly TipoMobilia[] = TIPOS_MOBILIA.filter((tipo) => !ehPecaNova(tipo))

/** O catálogo oferece a versão em linhas deste tipo? */
export function ofereceDesenhoEmLinhas(tipo: TipoMobilia | undefined): boolean {
  return tipo !== undefined && TIPOS_COM_DESENHO_EM_LINHAS.includes(tipo)
}

/** O que decide o desenho de um móvel: o tipo e o desenho gravado. */
export interface DesenhoPedido {
  readonly mobilia?: TipoMobilia
  readonly mobiliaDesenho?: 'linhas'
}

/** O móvel pediu a versão em linhas, e o tipo dele tem uma. */
export function desenhaEmLinhas(prop: DesenhoPedido): boolean {
  return prop.mobiliaDesenho === 'linhas' && ofereceDesenhoEmLinhas(prop.mobilia)
}

/**
 * O móvel sai com textura? A peça nova, sempre; os 11 de antes, com a chave
 * de obra ligada e sem pedir a versão em linhas. Sem a chave, os 11 de antes
 * são o desenho de linhas, peçam ou não.
 */
export function saiComTextura(prop: DesenhoPedido, obraLigada: boolean): boolean {
  if (ehPecaNova(prop.mobilia)) return true
  return obraLigada && !desenhaEmLinhas(prop)
}
