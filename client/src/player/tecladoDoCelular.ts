/**
 * O TECLADO DO CELULAR sobre a folha do jogador (fatia 19b).
 *
 * No Chrome do Android e no Safari do iPhone o teclado não encolhe a janela
 * do layout: ele encolhe só a VISTA VISÍVEL (`window.visualViewport`). A folha
 * mede a altura pela janela, então o pé dela, onde mora o campo do chat,
 * ficava debaixo do teclado. Aqui a altura que o teclado cobre vai para
 * `--pp-teclado` na própria folha (o CSS a desconta do teto dela) e o campo
 * com o foco rola para dentro do que sobrou.
 */

/** O que a vista visível diz dela mesma (o subconjunto de `VisualViewport` que a conta usa). */
export interface VistaVisivel {
  height: number
  offsetTop: number
  scale: number
}

/** A variável do CSS com a altura coberta, em px. */
export const VARIAVEL_DO_TECLADO = '--pp-teclado'

/**
 * Abaixo disto não é teclado: a barra do navegador que aparece e some muda a
 * vista em uns 56 px, e encolher a folha por ela a faria pular ao rolar.
 * Teclado de celular tem mais de 200.
 */
const MENOR_TECLADO_PX = 80

/** Quanto do pé da janela o teclado cobre, em px do CSS (0 = nada). */
export function alturaDoTeclado(alturaDaJanela: number, vista: VistaVisivel): number {
  // Pinça de zoom também encolhe a vista visível, e não é teclado.
  if (Math.abs(vista.scale - 1) > 0.01) return 0
  const coberto = alturaDaJanela - vista.height - vista.offsetTop
  return coberto >= MENOR_TECLADO_PX ? Math.round(coberto) : 0
}

/**
 * Acompanha o teclado enquanto `folha` está aberta e devolve quem para.
 * Sem `visualViewport` (navegador antigo, jsdom) não há o que acompanhar.
 */
export function acompanharTeclado(folha: HTMLElement, janela: Window = window): () => void {
  const vista = janela.visualViewport
  // O tipo diz `null`, mas o jsdom e o navegador antigo nem têm a propriedade: `undefined`.
  if (vista === null || vista === undefined) return () => {}
  let atual = -1
  const medir = () => {
    const altura = alturaDoTeclado(janela.innerHeight, vista)
    if (altura === atual) return
    atual = altura
    folha.style.setProperty(VARIAVEL_DO_TECLADO, `${altura}px`)
    if (altura === 0) return
    // O teto novo já vale na medida que o rolar força: o campo vai para o que sobrou acima do teclado.
    const foco = janela.document.activeElement
    if (foco instanceof HTMLElement && folha.contains(foco)) foco.scrollIntoView({ block: 'nearest' })
  }
  medir()
  vista.addEventListener('resize', medir)
  vista.addEventListener('scroll', medir)
  return () => {
    vista.removeEventListener('resize', medir)
    vista.removeEventListener('scroll', medir)
    folha.style.removeProperty(VARIAVEL_DO_TECLADO)
  }
}
