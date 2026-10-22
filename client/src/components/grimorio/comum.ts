import type { KeyboardEvent } from 'react'
import { theme } from '../../theme'

/*
 * Peças que os primitivos do Grimório dividem. Os tempos moram aqui porque o JS
 * precisa saber quando a animação de saída do CSS (grimorio.css) termina para
 * desmontar o elemento: os números são os mesmos dos dois lados.
 */

/** `.gr-pop.gr-sai` (gr-pop-sai, 110 ms). */
export const SAIDA_DO_POP_MS = 110
/** `.gr-dlg-fundo.gr-sai` (gr-fade-sai, 140 ms). */
export const SAIDA_DO_DIALOGO_MS = 140
/** `.gr-balao` some na mesma transição de opacidade com que aparece. */
export const SAIDA_DO_BALAO_MS = 140
/** `.gr-torrada.gr-sai` (150 ms) mais a folga do protótipo; 130 com movimento reduzido. */
export const SAIDA_DA_TORRADA_MS = 160
export const SAIDA_DA_TORRADA_REDUZIDA_MS = 130
/** Espera do primeiro balão ao pairar: o mesmo número do `.lb-tip` de hoje. */
export const ESPERA_DO_BALAO_MS = Number.parseInt(theme.motion.tipDelay, 10)
/** Depois que um balão some, o vizinho que abrir dentro deste prazo aparece na hora. */
export const BALAO_QUENTE_MS = 600

const FOCAVEIS =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * O que o Tab alcança dentro de um diálogo ou pop, na ordem do documento. A
 * ordem é refeita à mão porque com uma lista de seletores o jsdom devolve por
 * seletor, e não pela posição no documento como o navegador.
 */
export function focaveisEm(raiz: ParentNode): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS)).sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  )
}

/** Junta as classes que valem, na ordem: `classes('gr-bt', ativo && 'gr-bt--p')`. */
export function classes(...partes: (string | false | null | undefined)[]): string {
  return partes.filter(Boolean).join(' ')
}

/** Sem `matchMedia` (jsdom, WebView antiga) vale o movimento normal. */
export function movimentoReduzido(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

const SETAS_QUE_VOLTAM = new Set(['ArrowLeft', 'ArrowUp'])
const SETAS = new Set(['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'])

/**
 * Teclado de um grupo de opções (`role="radiogroup"`): as setas levam o foco à
 * vizinha e já a escolhem, dando a volta nas pontas (o seg e as cores do
 * protótipo); Home e End vão à primeira e à última (as abas que o seg da
 * ficha do jogador substituiu já faziam isso). Vai no `onKeyDown` do grupo.
 *
 * A tecla usada aqui para no grupo: o mapa (`PixiCanvas`) ouve o teclado no
 * `window` e faria da mesma seta um empurrão da seleção — a escada trocava de
 * sentido e andava uma casa no mesmo toque. O `preventDefault` não basta, o
 * mapa não o lê.
 */
export function andarPelosRadios(evento: KeyboardEvent<HTMLElement>): void {
  const pontas = evento.key === 'Home' || evento.key === 'End'
  if (!SETAS.has(evento.key) && !pontas) return
  const radios = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'))
  const atual = radios.findIndex((radio) => radio === evento.target)
  if (atual < 0) return
  const passo = SETAS_QUE_VOLTAM.has(evento.key) ? -1 : 1
  const proximo = pontas ? radios[evento.key === 'Home' ? 0 : radios.length - 1] : radios[(atual + passo + radios.length) % radios.length]
  evento.preventDefault()
  evento.stopPropagation()
  proximo.focus()
  proximo.click()
}
