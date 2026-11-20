import type { RetanguloNaTela } from './documentosDoJogador'
import { EASE_OUT, movimentoReduzido } from './puzzle/movimento'

/**
 * O movimento do documento na tela do jogador, por WAAPI (`element.animate`):
 * só `transform` e `opacity`, chamado na hora do acontecimento, sem re-render.
 * Os números são os do protótipo aprovado (`prototipo-v2.html`: `abrirLeitura`,
 * `fecharLeitura`, `voarParaDocumentos`, `alternarGaveta`).
 *
 * Movimento reduzido: nada anda nem cresce; fica a opacidade que explica o que
 * mudou, e o pulso do botão vira só o aviso do selo (sem o voo).
 */

/** O ease-in-out forte: o que se move NA tela (o papel que voa até "Documentos"). */
const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)'

const VEU_MS = 200
const ABRIR_DO_PAPEL_MS = 300
const ABRIR_MS = 220
const FECHAR_MS = 160
const GAVETA_MS = 160
const VOO_MS = 420
const PULSO_MS = 260
/** O papel que voa (o `.voo` do protótipo): o tamanho dele parado, antes da escala. */
const VOO_LARGURA = 36
const VOO_ALTURA = 46
/** Abrindo do papel no chão: a menor escala de partida (um papel minúsculo não some numa linha). */
const ESCALA_DE_PARTIDA_MIN = 0.08

function animar(el: Element | null | undefined, quadros: Keyframe[], opcoes: KeyframeAnimationOptions, reduzidos?: Keyframe[]): Animation | null {
  if (el === null || el === undefined || typeof el.animate !== 'function') return null
  if (movimentoReduzido()) {
    if (reduzidos === undefined) return null
    return el.animate(reduzidos, { ...opcoes, easing: 'ease' })
  }
  return el.animate(quadros, opcoes)
}

const SURGIR: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }]

/**
 * A leitura abre: o véu escurece e o papel sai do lugar onde estava no mapa
 * (`de`), crescendo até o meio; sem o retângulo (pela lista), cresce um pouco no lugar.
 */
export function abrirLeitura(veu: Element | null, rolo: Element | null, de: RetanguloNaTela | null): void {
  animar(veu, SURGIR, { duration: VEU_MS, easing: EASE_OUT }, SURGIR)
  if (rolo === null) return
  if (de !== null && de.width > 0) {
    const caixa = rolo.getBoundingClientRect()
    if (caixa.width > 0) {
      const dx = de.left + de.width / 2 - (caixa.left + caixa.width / 2)
      const dy = de.top + de.height / 2 - (caixa.top + caixa.height / 2)
      const escala = Math.max(ESCALA_DE_PARTIDA_MIN, de.width / caixa.width)
      animar(
        rolo,
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${escala})`, opacity: 0.4 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: ABRIR_DO_PAPEL_MS, easing: EASE_OUT },
        SURGIR,
      )
      return
    }
  }
  animar(
    rolo,
    [
      { transform: 'scale(0.96)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: ABRIR_MS, easing: EASE_OUT },
    SURGIR,
  )
}

/** A leitura fecha: some mais rápido do que entrou. `pronto` roda no fim (ou na hora, sem animação). */
export function fecharLeitura(caixa: Element | null, pronto: () => void): void {
  const sumir: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }]
  const animacao = animar(caixa, sumir, { duration: FECHAR_MS, easing: EASE_OUT, fill: 'forwards' }, sumir)
  if (animacao === null) {
    pronto()
    return
  }
  animacao.onfinish = pronto
  animacao.oncancel = pronto
}

/** A gaveta "Documentos" desce um pouco da barra. Pelo teclado (`instant`) abre na hora. */
export function abrirGaveta(gaveta: Element | null): void {
  animar(
    gaveta,
    [
      { opacity: 0, transform: 'translateY(-6px)' },
      { opacity: 1, transform: 'none' },
    ],
    { duration: GAVETA_MS, easing: EASE_OUT },
    SURGIR,
  )
}

/** O botão "Documentos" acusa o recebimento: cresce um tico e volta. */
function pulsar(botao: Element | null): void {
  animar(botao, [{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: PULSO_MS, easing: EASE_OUT })
}

/**
 * A PRIMEIRA leitura de um papel no mapa: ao fechar, o papel voa de onde estava
 * a leitura (`de`) até o botão "Documentos" (`alvo`) e o botão pulsa. Raro (uma
 * vez por documento): pode ter um pouco mais de tempo. Movimento reduzido: só o
 * aviso do botão. Sem o botão na tela (barra escondida), nada.
 */
export function voarParaDocumentos(de: RetanguloNaTela, alvo: Element | null): void {
  if (alvo === null) return
  if (movimentoReduzido() || typeof document.body.animate !== 'function') return
  const para = alvo.getBoundingClientRect()
  const voo = document.createElement('div')
  voo.className = 'pp-docs-voo'
  voo.setAttribute('aria-hidden', 'true')
  document.body.appendChild(voo)
  const x0 = de.left + de.width / 2 - VOO_LARGURA / 2
  const y0 = de.top + de.height / 2 - VOO_ALTURA / 2
  const x1 = para.left + para.width / 2 - VOO_LARGURA / 2
  const y1 = para.top + para.height / 2 - VOO_ALTURA / 2
  const animacao = voo.animate(
    [
      { transform: `translate(${x0}px, ${y0}px) scale(3.2) rotate(-2deg)`, opacity: 0.9 },
      { transform: `translate(${x1}px, ${y1}px) scale(0.55) rotate(0deg)`, opacity: 1 },
    ],
    { duration: VOO_MS, easing: EASE_IN_OUT },
  )
  const fim = () => {
    voo.remove()
    pulsar(alvo)
  }
  animacao.onfinish = fim
  animacao.oncancel = () => voo.remove()
}
