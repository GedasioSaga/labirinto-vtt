/**
 * As versões do PORTAL MÁGICO (lote L09 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`).
 * A 1ª, INFERNAL, é o desenho de `MONTADORES` (`montarPortalMagicoInfernal`: a parte parada e o redemoinho de brasa
 * em repouso numa imagem só). As outras ficam aqui, cada uma inteira, com o redemoinho em repouso: é a imagem de
 * "menos movimento" e a que fica debaixo do redemoinho que gira (o animador `girar` desenha por cima o de
 * `VORTICE_DO_PORTAL_MAGICO[versao]`, um disco do tamanho do que está pintado). O APAGADO não tem redemoinho e não
 * gira. Desenhadas no arquivo do tipo, para a pedra, o anel e as runas serem os mesmos nas quatro.
 */
import type { VersoesDesenhadas } from '.'
import { montarPortalMagicoApagado, montarPortalMagicoArcano, montarPortalMagicoGelo } from '../portalMagico'

export const versoesDoPortalMagico: VersoesDesenhadas = {
  arcano: montarPortalMagicoArcano,
  gelo: montarPortalMagicoGelo,
  apagado: montarPortalMagicoApagado,
}
