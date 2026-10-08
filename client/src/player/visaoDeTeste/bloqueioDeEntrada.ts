import type { KeyboardEvent as ReactKeyboardEvent, SyntheticEvent } from 'react'

/**
 * MODO OLHAR da Visão de jogador: o mestre vê a tela do jogador, mexe a
 * câmera, mas não age como o jogador. São três camadas:
 *
 * 1. no mapa, o próprio `PlayerView` (`onAcaoNoOlhar`): a câmera fica livre e
 *    o toque que seria ação vira o recado;
 * 2. AQUI, em volta do `Session`: os eventos de intenção (apertar, clicar,
 *    teclar) de toda a HUD morrem na fase de captura do React. Por ser o React
 *    e não o DOM, os portais da tela do jogador (mochila, lugares, que vão
 *    para o `body`) contam como dentro, e os da barra da janela de teste não;
 * 3. a guarda do socket (`socketDoCanal.ts`), para o que escapar das duas.
 *
 * Arrastar e soltar (`pointermove`, `pointerup`) e a roda passam sempre: são a
 * câmera, e barrar o soltar deixaria um arrasto do mapa preso.
 */

/** Dentro da tela do jogador, o que fica livre no Olhar: o mapa (`PlayerView` marca o dele) e os botões de zoom. */
export const SELETOR_LIVRE_NO_OLHAR = '[data-camera-livre], .pp-zoom'

/** O alvo do evento é parte da câmera (livre no Olhar)? */
export function alvoLivreNoOlhar(alvo: EventTarget | null): boolean {
  return alvo instanceof Element && alvo.closest(SELETOR_LIVRE_NO_OLHAR) !== null
}

/** Teclas que acionam o controle com foco (botão, link): no Olhar elas dão o recado. */
function teclaQueAciona(tecla: string): boolean {
  return tecla === 'Enter' || tecla === ' '
}

/** Teclas que nunca são barradas: andar o foco e fechar o que estiver aberto não agem como o jogador. */
function teclaLivre(tecla: string): boolean {
  return tecla === 'Tab' || tecla === 'Escape'
}

export interface BloqueioDoOlhar {
  onPointerDownCapture: (evento: SyntheticEvent) => void
  onMouseDownCapture: (evento: SyntheticEvent) => void
  onTouchStartCapture: (evento: SyntheticEvent) => void
  onClickCapture: (evento: SyntheticEvent) => void
  onAuxClickCapture: (evento: SyntheticEvent) => void
  onDoubleClickCapture: (evento: SyntheticEvent) => void
  onContextMenuCapture: (evento: SyntheticEvent) => void
  onKeyDownCapture: (evento: ReactKeyboardEvent) => void
  onKeyUpCapture: (evento: ReactKeyboardEvent) => void
}

/**
 * As props de captura para o elemento em volta do `Session`. `ativo` é lido a
 * cada evento (o modo muda sem remontar); `aoBloquear` mostra o recado.
 */
export function criarBloqueioDoOlhar(ativo: () => boolean, aoBloquear: () => void): BloqueioDoOlhar {
  const barrado = (evento: SyntheticEvent): boolean => ativo() && !alvoLivreNoOlhar(evento.target)

  /** Morre aqui: nem os ouvintes da tela do jogador nem o efeito padrão (foco, seleção). */
  const barrar = (evento: SyntheticEvent, recado: boolean) => {
    if (!barrado(evento)) return
    evento.preventDefault()
    evento.stopPropagation()
    if (recado) aoBloquear()
  }

  const teclado = (evento: ReactKeyboardEvent) => {
    if (teclaLivre(evento.key) || !barrado(evento)) return
    // Só Enter e Espaço têm efeito padrão de ação (o clique no botão com foco). O resto
    // (F5, Ctrl+…) segue para o navegador; nenhum ouvinte da tela do jogador ouve.
    if (teclaQueAciona(evento.key)) evento.preventDefault()
    evento.stopPropagation()
    if (evento.type === 'keydown' && teclaQueAciona(evento.key)) aoBloquear()
  }

  return {
    // O apertar é o gesto: o recado sai uma vez por gesto, aqui.
    onPointerDownCapture: (evento) => barrar(evento, true),
    onMouseDownCapture: (evento) => barrar(evento, false),
    // `touchstart` do React é passivo: o `preventDefault` não vale lá, só o parar.
    onTouchStartCapture: (evento) => {
      if (barrado(evento)) evento.stopPropagation()
    },
    onClickCapture: (evento) => barrar(evento, false),
    onAuxClickCapture: (evento) => barrar(evento, false),
    onDoubleClickCapture: (evento) => barrar(evento, false),
    onContextMenuCapture: (evento) => barrar(evento, false),
    onKeyDownCapture: teclado,
    onKeyUpCapture: teclado,
  }
}

/**
 * Teclas com nada em foco: o alvo é o `body`, fora da árvore do React, e os
 * atalhos da tela do jogador ouvem na `window` (a mochila no "i", os do
 * painel). Barra na captura da `window`, antes de todos. Devolve o desligar.
 */
export function instalarGuardaDeTeclado(janela: Window, ativo: () => boolean): () => void {
  const guarda = (evento: KeyboardEvent) => {
    if (!ativo() || teclaLivre(evento.key)) return
    const alvo = evento.target
    const semFoco = alvo === janela.document.body || alvo === janela.document.documentElement || alvo === janela.document || alvo === janela
    if (semFoco) evento.stopImmediatePropagation()
  }
  janela.addEventListener('keydown', guarda, true)
  janela.addEventListener('keyup', guarda, true)
  return () => {
    janela.removeEventListener('keydown', guarda, true)
    janela.removeEventListener('keyup', guarda, true)
  }
}
