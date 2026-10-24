import { Graphics } from 'pixi.js'

/**
 * CLICAR PARA ANDAR: a marca no ponto onde a caminhada termina, em px de TELA
 * (tamanho fixo em qualquer zoom; quem chama só a posiciona). Anel claro com
 * contorno escuro e um ponto no meio: lê sobre chão claro e escuro, e não usa
 * o azul da ficha própria. Sem animação: o clique se repete muitas vezes por
 * sessão, e a marca só precisa dizer "vai para cá".
 */
const RAIO_DO_ANEL_PX = 9
const LARGURA_DO_ANEL_PX = 2.5
const LARGURA_DO_CONTORNO_PX = 5
const RAIO_DO_PONTO_PX = 2.5
const COR_CLARA = 0xffffff
const COR_ESCURA = 0x111827
const OPACIDADE_DO_CONTORNO = 0.55

export function desenharMarcaDaCaminhada(): Graphics {
  const marca = new Graphics()
  marca.eventMode = 'none'
  marca
    .circle(0, 0, RAIO_DO_ANEL_PX)
    .stroke({ width: LARGURA_DO_CONTORNO_PX, color: COR_ESCURA, alpha: OPACIDADE_DO_CONTORNO })
    .circle(0, 0, RAIO_DO_ANEL_PX)
    .stroke({ width: LARGURA_DO_ANEL_PX, color: COR_CLARA })
    .circle(0, 0, RAIO_DO_PONTO_PX)
    .fill({ color: COR_CLARA })
    .stroke({ width: 1, color: COR_ESCURA, alpha: OPACIDADE_DO_CONTORNO })
  marca.visible = false
  return marca
}
