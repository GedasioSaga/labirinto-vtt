import desenharGirassois from '../../animacoes/carimbo/girassois'
import { PALETA_DO_GIRASSOL } from '../../animacoes/carimbo/_girassol'
import type { DefinicaoDeCarimbo, Rgb } from '../embutidos'

/**
 * GIRASSÓIS (item 126 da lista de 14/11/2026; correção da auditoria de 14/11/2026: a lista pediu o item na biblioteca,
 * e ele só existia no pacote baixado do GitHub). O tufo de três girassóis em hastes de alturas diferentes, o MESMO
 * desenho do pacote, aprovado em outubro (`animacoes/carimbo/girassois.ts`, a flor em `_girassol.ts`): importado de
 * lá, e não copiado, para a arte ter um lugar só. Nome, tamanho e sombra são os de `girassois.json`.
 *
 * O id é o do pacote (`girassois`): os mapas que já têm o tufo continuam com ele, e o mapa Desenhado troca o desenho
 * pelo id (`texturas/desenhado/carimbos.ts`). Agora que é da biblioteca, o app pula a entrada do pacote (a embutida
 * ganha, `lib/pacoteDeAnimacoes.ts`); o pacote continua levando o tufo para o app mais velho, que não o tem embutido.
 */
export const carimbo: DefinicaoDeCarimbo = {
  id: 'girassois',
  nome: 'Girassóis',
  tamanho: 9,
  sombra: 'em-pe',
  desenhar: desenharGirassois,
}

/** As cores chapadas da flor, da haste e das folhas (as de `_girassol.ts`). */
export const paleta: readonly Rgb[] = PALETA_DO_GIRASSOL
