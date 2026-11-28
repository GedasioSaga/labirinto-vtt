/**
 * O DESENHO DE CADA VERSÃO (I0-a do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): para cada
 * tipo com versão (`lib/mobilia/versoes.ts`), o montador de cada versão que não é a 1ª. A 1ª é sempre o desenho de
 * `MONTADORES` (`../index.ts`), o de hoje. `montarCena` pergunta aqui primeiro.
 *
 * Cada `<tipo>Versoes.ts` é do desenhista (só cria o arquivo; contrato em `docs/design/arte-temas/COMO-DESENHAR.md`).
 * A linha deste registro é do integrador, junto da linha da tabela em `lib/mobilia/versoes.ts`, com os mesmos ids.
 */
import type { TipoMobilia } from '../../../../lib/mobilia/tipos'
import type { MontarMovel } from '../contexto'
import { versoesDoNichoFunerario } from './nichoFunerarioVersoes'
import { versoesDoPiramideEmDegraus } from './piramideEmDegrausVersoes'

/** O montador de cada versão, pelo id gravado em `Prop.mobiliaVersao` (a 1ª versão não entra). */
export type VersoesDesenhadas = Readonly<Record<string, MontarMovel>>

export const VERSOES_DESENHADAS: Readonly<Partial<Record<TipoMobilia, VersoesDesenhadas>>> = {
  nichoFunerario: versoesDoNichoFunerario,
  piramideEmDegraus: versoesDoPiramideEmDegraus,
}

/** O montador da versão (`undefined` = a 1ª, versão sem desenho ou tipo sem versão: vale o de `MONTADORES`). */
export function montadorDaVersao(tipo: TipoMobilia, versao: string | undefined): MontarMovel | undefined {
  const versoes = VERSOES_DESENHADAS[tipo]
  if (versao === undefined || versoes === undefined || !Object.hasOwn(versoes, versao)) return undefined
  return versoes[versao]
}
