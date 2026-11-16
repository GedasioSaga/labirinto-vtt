import type { MudancaNoPreparo } from './protocolo'

/**
 * "MUDOU X": a loja do Prelúdio (`estado/preludio.ts`) avisa aqui cada coisa
 * que gravou em preparo/, e quem cuida do fio entre as janelas
 * (`mesaDoPreludio.ts` na principal, `entrada.tsx` na janela do Prelúdio)
 * repassa à outra, que relê só aquilo. Sem fio ligado, o aviso não vai a lugar
 * nenhum. A loja não importa o fio: este arquivo é a porta entre os dois.
 */

type AvisoDeMudanca = (mudanca: MudancaNoPreparo) => void

let aviso: AvisoDeMudanca | null = null

export function definirAvisoDeMudanca(funcao: AvisoDeMudanca | null): void {
  aviso = funcao
}

export function avisarMudanca(mudanca: MudancaNoPreparo): void {
  aviso?.(mudanca)
}
