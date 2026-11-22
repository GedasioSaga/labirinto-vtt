/**
 * O AVISO DO APP NO CHAT (Fase 8, o "Usar" fora da batalha): a linha vai ao
 * Global como fala do mestre, pela sessão do host quando ela existe. O
 * `App.tsx` liga; sem host (mesa sem jogadores na rede), nada sai e quem
 * chamou fica só com o aviso da tela.
 */

let falar: ((texto: string) => boolean) | null = null

export function ligarFalaNoChat(fala: ((texto: string) => boolean) | null): void {
  falar = fala
}

/** `false` = não saiu (sem host, ou o texto não coube no chat). */
export function falarNoChat(texto: string): boolean {
  return falar === null ? false : falar(texto)
}
