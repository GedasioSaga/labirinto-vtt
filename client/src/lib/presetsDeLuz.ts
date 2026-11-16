import type { Light, Periodo, TipoMobilia } from '../types/map'
import type { Point } from '../pixi/world'
import { buildLightAt } from './drawingFactory'

/**
 * A LUZ SOLTA da ferramenta Luz (Luz L3, decisão D4; Fase 6 de 16/11/2026).
 *
 * Até a Fase 6 a ferramenta tinha os presets Tocha, Lampião e Fogueira: um ponto
 * de luz invisível com o alcance da chama. Desde 09/11 o OBJETO tocha, lampião e
 * fogueira acende sozinho (`lib/luzDoFogo.ts`), e os dois caminhos davam o claro
 * em dobro quando o mestre punha o lampião e a luz. Decisão do mestre ("Luz da
 * tocha no objeto"): a luz da chama mora no objeto, acende e apaga na ficha dele,
 * e a ferramenta Luz cria só a LUZ SOLTA, sem objeto (a de sempre: 4 casas,
 * `buildLightAt`), que nasce acesa à tarde e à noite. O mestre muda depois no
 * painel da luz ("Acesa em", cor, força) e o raio pela alça do círculo.
 *
 * Mapa antigo abre igual: a luz criada por um preset é uma `Light` comum, com a
 * cor e o alcance gravados nela; nada aqui é lido para desenhá-la.
 */

/** Toda luz nova acende sozinha à tarde e à noite. */
const ACESA_EM_DA_LUZ_NOVA: readonly Periodo[] = ['tarde', 'noite']

/** A luz solta nova no ponto; `raioArrastado` (arrasto da ferramenta) troca o alcance de 4 casas. */
export function luzSolta(id: string, ponto: Point, grid: number, raioArrastado?: number): Light {
  return { ...buildLightAt(id, ponto, grid, raioArrastado), acesaEm: [...ACESA_EM_DA_LUZ_NOVA] }
}

/**
 * Os objetos de fogo que o painel da ferramenta Luz oferece no lugar dos presets
 * antigos: o botão arma a ferramenta Objeto com o tipo, e a luz vem dele.
 */
export const OBJETOS_DE_LUZ: readonly { readonly rotulo: string; readonly tipo: TipoMobilia }[] = [
  { rotulo: 'Tocha', tipo: 'tochaDePe' },
  { rotulo: 'Lampião', tipo: 'lampiao' },
  { rotulo: 'Fogueira', tipo: 'fogueira' },
]
