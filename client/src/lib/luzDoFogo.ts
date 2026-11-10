import type { Prop } from '../types/map'
import { CASA_DO_FOGO_PX } from './mobilia/fogo'

/**
 * A LUZ DO OBJETO FOGO (pedido do mestre de 09/11/2026: "na gameplay isso não
 * ilumina nada os jogadores"). O fogo do mapa é fonte de luz de verdade: o
 * MESMO alcance vale para o desenho (`pixi/mapaDeLuz.ts`, o claro quente que
 * treme) e para a visão do jogador à noite (`lib/fogFilter.ts`, o claro do
 * fogo na linha de visão chega como o de um lampião).
 *
 * Antes disto a luz do fogo era só desenho: fogo fora do raio curto da noite
 * nem chegava ao jogador, e o claro era cortado na borda da visão dele.
 *
 * RASCUNHO: os três números abaixo são os que o mestre ajusta.
 */

/** O que a luz do fogo lê do objeto. */
export type FogoQueIlumina = Pick<Prop, 'id' | 'x' | 'y' | 'width' | 'height' | 'mobilia' | 'hidden'>

/**
 * O tom do claro: branco quente. A luz entra multiplicando o mapa, então
 * laranja forte apagaria o verde do chão e o azul das fichas no breu (medido
 * em 09/11/2026: chão verde sob `#ffa24d` virava marrom escuro); o laranja
 * fica por conta do brilho e das chamas do próprio fogo.
 */
export const COR_DA_LUZ_DO_FOGO = 0xffdca6
/** Quanto do claro entra no centro (0 a 1). */
export const FORCA_DA_LUZ_DO_FOGO = 0.95
/** Até onde a luz vai além da pegada do fogo, em casas do mapa. */
export const ALCANCE_DA_LUZ_DO_FOGO_EM_CASAS = 4

/** O objeto é um fogo que ilumina: `hidden` (só do mestre) e medida torta não acendem nada. */
export function fogoAcendeLuz(f: FogoQueIlumina): boolean {
  return f.mobilia === 'fogo' && f.hidden !== true && Number.isFinite(f.x) && Number.isFinite(f.y) && f.width > 0 && f.height > 0
}

/**
 * O alcance da luz do fogo em px de mundo: meia diagonal da pegada mais
 * `ALCANCE_DA_LUZ_DO_FOGO_EM_CASAS` casas. `casa` é a grade do mapa; sem ela
 * (ou torta), a grade de referência dos móveis.
 */
export function raioDaLuzDoFogo(f: Pick<Prop, 'width' | 'height'>, casa?: number): number {
  const grade = casa !== undefined && Number.isFinite(casa) && casa > 0 ? casa : CASA_DO_FOGO_PX
  return 0.5 * Math.hypot(f.width, f.height) + ALCANCE_DA_LUZ_DO_FOGO_EM_CASAS * grade
}
