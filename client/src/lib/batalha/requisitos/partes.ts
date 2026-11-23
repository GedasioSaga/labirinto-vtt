import { mesmaReferencia } from './contexto'
import type { Referencia, RequisitosDoCartao } from './modelo'

/**
 * REQUISITOS: AS PARTES DA FORMA EM DADOS (I1 e I2 de REQUISITOS-LISTA.md; §8 do plano). O que hoje
 * a tabela à mão faz pela Ryoko (`subidaDeParte` e `motivoDaOrdemDasPartes` em
 * `lib/batalha/transformacao.ts`, lidos de `mecanicasAMao.ts`), aqui lido do bloco do cartão, com
 * os mesmos motivos. A fase D liga isto ao motor ("bloco manda; sem bloco, a tabela").
 *
 * Recebe as Partes já em ordem (o grupo da forma na ordem da ficha), para não puxar o motor.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** Os motivos de hoje (`transformacao.ts`), iguais para o portão das três regras dar o mesmo veredito. */
export const MOTIVO_FORMA_DESLIGADA = 'A forma desta técnica não está ligada'
export const MOTIVO_ULTIMA_PARTE = 'Já está na última Parte'

/** A forma de onde a técnica vem: as Partes do grupo em ordem, a posição dela e se está ligada. */
export interface FormaDeOndeVem {
  partes: readonly Referencia[]
  indice: number
  ligada: boolean
}

/**
 * I1 (`aoUsar.sobeParte`, a Fúria do Dragão): a Parte que a técnica liga (a seguinte à forma de
 * onde ela vem), ou o motivo de não subir. `null` = a técnica não sobe de Parte. `forma` `null` =
 * a técnica não é de forma nenhuma.
 */
export function subidaDaParte(bloco: RequisitosDoCartao | null, forma: FormaDeOndeVem | null): { para: Referencia } | { motivo: string } | null {
  if (bloco?.aoUsar?.sobeParte !== true) return null
  if (forma === null || !forma.ligada) return { motivo: MOTIVO_FORMA_DESLIGADA }
  const seguinte = forma.partes[forma.indice + 1]
  return seguinte === undefined ? { motivo: MOTIVO_ULTIMA_PARTE } : { para: seguinte }
}

/**
 * I2 (`forma.partesEmOrdem`, a Forma Híbrida): por que ligar a Parte `indice` fura a ordem, ou
 * `null`. `ligada`: a posição da Parte ligada mais alta do grupo (-1 = nenhuma). Só liga a seguinte.
 */
export function motivoDaOrdem(bloco: RequisitosDoCartao | null, partes: readonly Referencia[], indice: number, ligada: number): string | null {
  if (bloco?.forma?.partesEmOrdem !== true) return null
  const seguinte = partes[ligada + 1]
  if (seguinte !== undefined && ligada + 1 === indice) return null
  return seguinte === undefined ? MOTIVO_ULTIMA_PARTE : `Uma Parte por vez: a próxima é ${seguinte.nome.trim() || 'a Parte seguinte'}`
}

/**
 * I2 (`forma.soLigaPor`, "só transforma com o Grito"): por que a forma não liga por este caminho,
 * ou `null`. `pela` = a técnica que está ligando; ausente = o botão Ativar.
 */
export function motivoDoSoLigaPor(bloco: RequisitosDoCartao | null, pela?: Referencia): string | null {
  const lista = bloco?.forma?.soLigaPor
  if (lista === undefined || lista.length === 0) return null
  if (pela !== undefined && lista.some((ref) => mesmaReferencia(ref, pela))) return null
  return `Só liga com ${lista.map((ref) => ref.nome).join(' ou ')}`
}
