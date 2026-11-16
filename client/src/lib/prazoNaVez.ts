import type { Token } from '../types/map'
import { contarFimDaVez, vidaDoComecoDaVez, type VidaDoTurno } from './prazoDaCondicao'

/**
 * O PRAZO DAS CONDIÇÕES NA BATALHA (Fase C, item 4; regra em
 * `tmp/fase-3-condicoes/REGRA.md`): quando a vez passa, a ficha que SAI
 * desconta 1 turno de cada prazo (`contarFimDaVez`) e a que ENTRA perde a vida
 * por turno (`vidaDoComecoDaVez`). Vale nos dois sistemas: One Piece
 * (`stores/batalhaFabrica.ts`, `prazosDaVez`) e Dragon Ball (o motor,
 * `lib/dbt/batalha/ordem.ts`, `iniciarTurno` e `terminarTurno`). Envenenado
 * 3 x 4 tira 12, como no "Passar turno" de fora da batalha; Lento 2 vale as
 * duas vezes seguintes inteiras.
 *
 * Puro: quem chama lê a ficha da cena e grava.
 */

/** O fim da vez de uma ficha: a ficha com o prazo descontado e os nomes que acabaram. */
export interface FimDoPrazo {
  token: Token
  acabaram: string[]
}

/** O fim da vez: `null` = a ficha não tinha prazo (nada a gravar). `seguradas`: as chaves que a batalha ainda segura acesas. */
export function fimDoPrazoNaVez(token: Token, seguradas?: ReadonlySet<string>): FimDoPrazo | null {
  const fim = contarFimDaVez(token, seguradas)
  return fim.token === token ? null : { token: fim.token, acabaram: fim.acabaram }
}

/** O começo da vez: a vida a tirar agora, somada, com o nome de cada condição; `null` = nada a tirar. */
export function comecoDoPrazoNaVez(token: Token): { dano: number; danos: VidaDoTurno[] } | null {
  const vida = vidaDoComecoDaVez(token)
  return vida.dano > 0 ? vida : null
}

/** "Envenenado" ou "Envenenado e Queimando": o motivo do dano na linha da batalha. */
export function motivoDoPrazo(danos: readonly VidaDoTurno[]): string {
  const nomes = danos.map((parte) => parte.nome)
  return nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

/** "Lento acabou em Tomás" / "Lento e Envenenado acabaram em Tomás". */
export function textoDosPrazosQueAcabaram(acabaram: readonly string[], nome: string): string {
  if (acabaram.length === 0) return ''
  return `${motivoDoPrazo(acabaram.map((nomeDaCondicao) => ({ nome: nomeDaCondicao, dano: 0 })))} ${acabaram.length === 1 ? 'acabou' : 'acabaram'} em ${nome}`
}
