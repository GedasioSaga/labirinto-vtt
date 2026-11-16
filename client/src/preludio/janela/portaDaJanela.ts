import type { LigaCena } from '../../lib/preparo/tipos'
import type { AbaDoVerbete } from './protocolo'

/**
 * A PORTA DA JANELA DO PRELÚDIO, no pacote principal (pequena de propósito):
 * o fio inteiro (`mesaDoPreludio.ts`) só baixa no primeiro "Abrir o Prelúdio".
 */

/** Onde a janela do Prelúdio abre: um verbete (a sessão, com o quadro dela). */
export interface FocoNoPreludio {
  readonly verbeteId: string
  readonly aba: AbaDoVerbete | null
  /** A seção do pino ligado (P3): a janela rola até ela e a marca. */
  readonly secaoId?: string
}

/** O que só o App sabe fazer pela janela do Prelúdio. */
export interface DepsDaMesa {
  /** Abre o mapa do link na cena e no pino (perguntando antes, se há trabalho não salvo). */
  readonly abrirNaMesa: (alvo: LigaCena) => void
  readonly avisar: (texto: string) => void
}

let aberta = false

/** Há janela do Prelúdio aberta, até onde a principal sabe? (A tela do Prelúdio na principal não abre junto: os dois editariam os mesmos verbetes.) */
export function janelaDoPreludioAberta(): boolean {
  return aberta
}

/** Só o fio (`mesaDoPreludio.ts`) chama. */
export function marcarJanelaDoPreludio(estado: boolean): void {
  aberta = estado
}

let depsDoApp: DepsDaMesa | null = null

/** O App entrega, ao montar, como abrir um link na mesa e avisar: a ficha do pino ligado abre o Prelúdio sem receber isso por propriedade. */
export function registrarDepsDaMesa(deps: DepsDaMesa | null): void {
  depsDoApp = deps
}

/** "Abrir no Prelúdio" de uma coisa do mapa (P3): a janela do Prelúdio, no verbete e na seção. */
export function abrirNoPreludio(foco: FocoNoPreludio): void {
  if (depsDoApp === null) return
  abrirOPreludioEmJanela(foco, depsDoApp)
}

/** Abre a janela do Prelúdio, ou traz para a frente a que existe, e leva ao `foco` (`null` = onde ela está). */
export function abrirOPreludioEmJanela(foco: FocoNoPreludio | null, deps: DepsDaMesa): void {
  void import('./mesaDoPreludio').then(
    ({ mesaDoPreludio }) => mesaDoPreludio(deps).abrir(foco),
    () => deps.avisar('O Prelúdio não abriu em janela. Feche e abra o Labirinto de novo.'),
  )
}
