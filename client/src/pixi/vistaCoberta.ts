/**
 * VISTA COBERTA — portão de redesenho para camadas recortadas à vista.
 *
 * A moldura do mapa (sombra fora do mapa) é recortada ao retângulo visível.
 * Redesenhar a cada quadro de pan limpava e refazia um `Graphics` pequeno
 * DENTRO do grupo de render do mundo, e todo `Graphics` pequeno (que entra no
 * lote) que muda obriga o Pixi a refazer a lista de instruções do mundo
 * inteiro (`validateRenderable` do GraphicsPipe devolve "reconstruir").
 *
 * Aqui a camada é desenhada com folga (a vista mais uma tela para cada lado)
 * e só volta a desenhar quando a vista sai da área coberta ou quando muda o
 * que não é posição (`chave`: escala, resolução, tamanho do mapa). O que
 * passa da tela não aparece, então a imagem é a mesma.
 */
import type { Viewport } from './grid'

/** Folga em telas para cada lado: 1 = área coberta de 3x3 telas. */
export const FOLGA_EM_TELAS = 1

export interface PortaoDaVista {
  /**
   * A vista a desenhar (com folga) se é preciso redesenhar, ou `null` se o que
   * já está desenhado cobre `vista` com a mesma `chave`.
   */
  precisa(chave: string, vista: Viewport): Viewport | null
  /** Esquece o que foi desenhado (o próximo `precisa` sempre redesenha). */
  esquecer(): void
}

export function contem(fora: Viewport, dentro: Viewport): boolean {
  return dentro.left >= fora.left && dentro.top >= fora.top && dentro.right <= fora.right && dentro.bottom <= fora.bottom
}

export function comFolga(vista: Viewport, folga = FOLGA_EM_TELAS): Viewport {
  const w = (vista.right - vista.left) * folga
  const h = (vista.bottom - vista.top) * folga
  return { left: vista.left - w, top: vista.top - h, right: vista.right + w, bottom: vista.bottom + h }
}

export function criarPortaoDaVista(): PortaoDaVista {
  let chaveDesenhada: string | null = null
  let coberta: Viewport | null = null
  return {
    precisa(chave, vista) {
      const finita = Number.isFinite(vista.left) && Number.isFinite(vista.top) && Number.isFinite(vista.right) && Number.isFinite(vista.bottom)
      if (finita && chave === chaveDesenhada && coberta !== null && contem(coberta, vista)) return null
      // Vista não finita (tela de tamanho 0, escala inválida): desenha a vista como veio e não guarda.
      if (!finita) {
        chaveDesenhada = null
        coberta = null
        return vista
      }
      chaveDesenhada = chave
      coberta = comFolga(vista)
      return coberta
    },
    esquecer() {
      chaveDesenhada = null
      coberta = null
    },
  }
}
