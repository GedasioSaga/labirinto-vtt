import type { LigaCena } from '../../lib/preparo/tipos'

/**
 * A PORTA DO PRELÚDIO PARA O MAPA: o App entrega, ao abrir a tela, como abrir
 * um mapa pela chave e ir à cena e ao pino (`irParaAMesa.ts`). O editor de
 * texto fica fundo demais na árvore para receber isso por propriedade; sem a
 * porta (num teste), o link de cena só não abre.
 */

type AbrirNaMesa = (alvo: LigaCena) => void

let abrir: AbrirNaMesa | null = null

/** A tela do Prelúdio liga ao abrir e desliga ao sair. */
export function definirAberturaNaMesa(funcao: AbrirNaMesa | null): void {
  abrir = funcao
}

export function podeAbrirNaMesa(): boolean {
  return abrir !== null
}

export function abrirNaMesaPeloPreludio(alvo: LigaCena): void {
  abrir?.(alvo)
}
