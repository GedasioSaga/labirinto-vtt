/**
 * CORREIO DE BILHETES: o jogador escreve a um colega e o mestre é o carteiro
 * (entrega ou intercepta). Tetos e textos valendo para o host
 * (`net/hostSession.ts`), o protocolo (`net/protocol.ts`) e a tela do jogador.
 * Plano: `docs/planos/correio-de-bilhetes-p.md`.
 */

/** Por onde o bilhete vai. Só sabor por ora: o mestre é quem decide se chega. */
export type LetterVia = 'tubo' | 'pombo' | 'capsula'

/** Na ordem em que a tela oferece. */
export const LETTER_VIAS: readonly LetterVia[] = ['tubo', 'pombo', 'capsula']

/** Maior bilhete, em unidades UTF-16 (o `maxLength` do campo conta igual). */
export const LETTER_TEXT_MAX_LENGTH = 280

/** Intervalo mínimo entre dois bilhetes do mesmo jogador: o aviso do mestre não vira enxurrada. */
export const LETTER_SEND_MIN_INTERVAL_MS = 3000

/** Quantos bilhetes do mesmo jogador podem esperar o mestre ao mesmo tempo. */
export const LETTER_PENDING_MAX_PER_PLAYER = 3

const VIA_NAME: Record<LetterVia, { name: string; by: string }> = {
  tubo: { name: 'Tubo', by: 'pelo tubo' },
  pombo: { name: 'Pombo', by: 'pelo pombo' },
  capsula: { name: 'Cápsula', by: 'pela cápsula' },
}

export function isLetterVia(value: unknown): value is LetterVia {
  return LETTER_VIAS.some((via) => via === value)
}

/** "Tubo", "Pombo", "Cápsula": o rótulo da escolha. */
export function letterViaName(via: LetterVia): string {
  return VIA_NAME[via].name
}

/** "pelo pombo", "pela cápsula": o meio com o artigo certo. */
export function letterViaPhrase(via: LetterVia): string {
  return VIA_NAME[via].by
}

/** Cabeçalho do cartão e do Caderno: "Bilhete de Ana, pelo pombo". */
export function letterTitle(from: string, via: LetterVia): string {
  return `Bilhete de ${from}, ${letterViaPhrase(via)}`
}
