/**
 * ALCANCE: A COR DAS CASAS (plano docs/design/habilidades/ALCANCE.md §4; decisão do dono de
 * 23/11/2026): azul quando dá dano (mesmo com efeito junto), verde claro quando não dá (ajuda,
 * atrapalha, cura). O único classificador "dá dano ou ajuda" do app: a mira, o Pixi e o Testar
 * do editor leem daqui.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

import type { LeituraDoDano } from '../formula'

export type CorDoAlcance = 'azul' | 'verde'

/** O que se usa: o Atacar (sempre dano) ou um cartão, pelo dano que a leitura de sempre dá a ele. */
export type AcaoDaCor = { tipo: 'atacar' } | { tipo: 'cartao'; dano: LeituraDoDano }

export function corDoAlcance(acao: AcaoDaCor): CorDoAlcance {
  if (acao.tipo === 'atacar') return 'azul'
  return acao.dano.tipo === 'semDano' ? 'verde' : 'azul'
}
