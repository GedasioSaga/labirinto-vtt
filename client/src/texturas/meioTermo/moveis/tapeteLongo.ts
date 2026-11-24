/**
 * TAPETE LONGO de cima com volume (peça nova da MT5): a passadeira de
 * comprimento livre, no chão como o tapete (quem a põe por baixo dos outros
 * móveis é `emOrdemDeDesenho`/`ehMovelDoChao` de `lib/mobilia.ts` e o
 * contêiner do chão do editor).
 *
 * Desde 24/11/2026 é o desenho "Medalhão com haste" (`tapeteComHaste.ts`), o
 * mesmo do tapete retangular: a moldura, a franja, o medalhão e as pontas têm
 * tamanho fixo e só a haste do meio estica com o comprimento. Antes o longo
 * repetia um losango por casa e, no corredor de 14 casas, virava papel de
 * parede. Material: `tecido`.
 */
import type { MontarMovel } from './contexto'
import { montarTapeteComHaste } from './tapeteComHaste'

export const montarTapeteLongo: MontarMovel = (c, cena) => montarTapeteComHaste(c, cena)
