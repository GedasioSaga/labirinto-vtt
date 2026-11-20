/**
 * O movimento da tela do jogador no puzzle, por WAAPI (`element.animate`):
 * roda no compositor, só mexe em `transform` e `opacity`, e é chamado na hora
 * do acontecimento, sem re-render. Os números são os do protótipo aprovado
 * (`prototipo-v2.html`: `assentar`, `recusar`, `voarParaMochila`, `piscar`,
 * `sacudirQuadro`; o pedestal, do v1).
 *
 * Movimento reduzido: nada anda nem treme; fica só a opacidade que explica o
 * que mudou (a peça que assenta, o clarão do castigo, o cartão).
 */

/** O ease-out forte do Emil (o `--lb-gr-ease-out` do tema). */
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
/** O ease-in-out forte: o que se move NA tela (o pedestal que sobe e volta). */
const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)'

const ASSENTAR_MS = 200
const BRILHO_MS = 520
const TREMER_MS = 280
const SACUDIR_MS = 340
const CLARAO_MS = 560
const VOAR_MS = 280
const PEDESTAL_MS = 520

/** Sem `matchMedia` (jsdom, WebView antiga) vale o movimento normal. */
export function movimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function animar(el: Element | null | undefined, quadros: Keyframe[], opcoes: KeyframeAnimationOptions, reduzidos?: Keyframe[]): Animation | null {
  if (el === null || el === undefined || typeof el.animate !== 'function') return null
  if (movimentoReduzido()) {
    if (reduzidos === undefined) return null
    return el.animate(reduzidos, { ...opcoes, easing: 'ease' })
  }
  return el.animate(quadros, opcoes)
}

/** A peça que acabou de entrar no encaixe assenta (cresce um pouco e volta) e o encaixe brilha. */
export function assentar(encaixe: Element | null): void {
  if (encaixe === null) return
  animar(encaixe.querySelector('.qpz-encaixe__peca'), [{ transform: 'scale(1.14)', opacity: 0.55 }, { transform: 'scale(1)', opacity: 1 }], { duration: ASSENTAR_MS, easing: EASE_OUT }, [{ opacity: 0.4 }, { opacity: 1 }])
  brilhar(encaixe)
}

/** O brilho de latão do encaixe (assentar, juntar, a cena da imagem própria, esta em cascata pelo `atrasoMs`). */
export function brilhar(encaixe: Element | null, atrasoMs = 0): void {
  animar(encaixe?.querySelector('.qpz-encaixe__brilho'), [{ opacity: 0.85 }, { opacity: 0 }], { duration: BRILHO_MS, easing: EASE_OUT, delay: atrasoMs, fill: 'backwards' }, [{ opacity: 0.5 }, { opacity: 0 }])
}

/** O "não" do encaixe ou da bandeja: treme de lado. O encaixe já está em `translate(-50%, -50%)`. */
export function tremer(el: Element | null): void {
  if (el === null) return
  const base = el.classList.contains('qpz-encaixe') ? 'translate(-50%, -50%) ' : ''
  animar(el, [0, -5, 5, -3, 2, 0].map((x) => ({ transform: `${base}translateX(${x}px)` })), { duration: TREMER_MS, easing: EASE_OUT })
}

/** O quadro inteiro sacode com o castigo que machuca. */
export function sacudir(quadro: Element | null): void {
  animar(quadro, [0, -7, 6, -4, 2, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: SACUDIR_MS, easing: EASE_OUT })
}

/** O clarão do castigo (`.qpz__flash`, no tom dele). Com movimento reduzido também: é cor, não movimento. */
export function piscar(flash: HTMLElement | null, tom: 'dano' | 'armadilha' | 'barulho'): void {
  if (flash === null) return
  flash.dataset.tom = tom
  const quadros: Keyframe[] = [{ opacity: 0 }, { opacity: 1, offset: 0.22 }, { opacity: 0 }]
  animar(flash, quadros, { duration: CLARAO_MS, easing: EASE_OUT }, quadros)
}

/** O pedestal sobe (ou afunda) de estalo e volta: o peso errado da troca (v1). */
export function pedestalDeEstalo(pedestal: Element | null, sobe: boolean): void {
  const dy = sobe ? -1.4 : 1.4
  animar(pedestal, [{ transform: 'translateY(0)' }, { transform: `translateY(${dy}cqw)`, offset: 0.4 }, { transform: 'translateY(0)' }], { duration: PEDESTAL_MS, easing: EASE_IN_OUT })
}

/** A peça que voltou voa de onde estava (o encaixe, o pedestal) até a vaga dela na mochila. */
export function voarAte(vaga: Element | null, de: DOMRect): void {
  if (vaga === null) return
  const para = vaga.getBoundingClientRect()
  const dx = de.left + de.width / 2 - (para.left + para.width / 2)
  const dy = de.top + de.height / 2 - (para.top + para.height / 2)
  animar(vaga, [{ transform: `translate(${dx}px, ${dy}px) scale(0.85)`, opacity: 0.6 }, { transform: 'none', opacity: 1 }], { duration: VOAR_MS, easing: EASE_OUT }, [{ opacity: 0 }, { opacity: 1 }])
}
