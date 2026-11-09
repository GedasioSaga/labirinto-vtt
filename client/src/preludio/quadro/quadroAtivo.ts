/**
 * O QUADRO ABERTO, visto de fora do editor e sem puxar o tldraw (fatia F3b):
 * a busca (Ctrl+K) acha os cartões dele e põe um verbete nele. O editor do
 * quadro se registra ao montar e sai ao desmontar; fora do quadro, `null`.
 */

export interface CartaoNoQuadroAberto {
  /** O id da forma no tldraw (`shape:…`). */
  readonly formaId: string
  /** O verbete do Prelúdio que o cartão desenha (já achado pelo id do Grimório, se for o caso). */
  readonly verbeteId: string
}

export interface QuadroAberto {
  readonly nome: string
  /** Pode receber cartão novo (não é só para ver nem está travado). */
  readonly editavel: boolean
  cartoes(): readonly CartaoNoQuadroAberto[]
  /** Mostra e seleciona o cartão. */
  irAoCartao(formaId: string): void
  /** Põe o cartão do verbete no meio da vista, com as setas das ligações. */
  porNoQuadro(verbeteId: string): void
}

let aberto: QuadroAberto | null = null

export function definirQuadroAberto(quadro: QuadroAberto | null): void {
  aberto = quadro
}

export function quadroAberto(): QuadroAberto | null {
  return aberto
}

/** O verbete vira cartão? Página e sessão não (o Grimório também só tinha personagem, cenário e item). */
export function viraCartao(tipo: string): boolean {
  return tipo !== 'pagina' && tipo !== 'sessao'
}

/** O que a gaveta de verbetes põe no arrasto: o id do verbete (o quadro lê no soltar). */
export const MIME_DO_VERBETE = 'application/x-preludio-verbete'

/** Até quando o foco fica onde o teclado o pôs (as abas da sessão), sem o quadro que abre tomá-lo. */
let focoForaAte = 0
const JANELA_DO_FOCO_MS = 2000

export function guardarFocoFora(): void {
  focoForaAte = Date.now() + JANELA_DO_FOCO_MS
}

export function focoFicaFora(): boolean {
  return Date.now() < focoForaAte
}
