import desenharGirassol from '../../animacoes/carimbo/girassol'
import { PALETA_DO_GIRASSOL } from '../../animacoes/carimbo/_girassol'
import type { DefinicaoDeCarimbo, Rgb } from '../embutidos'

/**
 * GIRASSOL, um só (o par do item 126, Girassóis; correção da auditoria de 14/11/2026). Entra na biblioteca junto do
 * tufo (decisão do Claude, 14/11/2026): os dois são a mesma flor no pacote e no mapa Desenhado, e só o tufo embutido
 * deixaria o girassol sozinho dependendo do download. O MESMO desenho do pacote (`animacoes/carimbo/girassol.ts`),
 * importado de lá; nome, tamanho e sombra os de `girassol.json`. O pacote continua levando-o para o app mais velho.
 */
export const carimbo: DefinicaoDeCarimbo = {
  id: 'girassol',
  nome: 'Girassol',
  tamanho: 9,
  sombra: 'em-pe',
  desenhar: desenharGirassol,
}

/** As cores chapadas da flor, da haste e das folhas (as de `_girassol.ts`). */
export const paleta: readonly Rgb[] = PALETA_DO_GIRASSOL
