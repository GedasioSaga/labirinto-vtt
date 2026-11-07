import { resolverComBase, resolverSoEmbutida, type ResolverDeImagem } from '../../lib/midia'

/**
 * AS IMAGENS DA MESA NO SITE (bug de 07/11/2026: os retratos `midia:` saíam
 * como iniciais). O retrato e as imagens das fichas são `midia:<sha256>.<ext>`
 * e moram no DO da campanha, servidos por `GET /api/c/:id/midia/:midiaId`
 * na MESMA origem do site (o cookie do Access vai junto no `<img>`). É o
 * mesmo resolvedor que a grade do treino e a foto de perfil já usam.
 *
 * Na demo não há servidor: só a embutida (`data:`) aparece, como antes
 * (as fichas inventadas trazem os retratos embutidos). Fora de uma mesa,
 * também só a embutida: sem campanha não há de onde buscar.
 */

/** A rota da mídia da campanha; o id vai colado no fim. */
export function baseDaMidiaDaCampanha(campanhaId: string): string {
  return `/api/c/${encodeURIComponent(campanhaId)}/midia/`
}

/** O resolvedor do `ImagemDaMesa` para a página: `midia:` vira a rota da campanha, `data:` passa, o resto não vira `src`. */
export function resolverDoLobby(campanhaId: string | null, demo: boolean): ResolverDeImagem {
  if (demo || campanhaId === null) return resolverSoEmbutida
  return resolverComBase(baseDaMidiaDaCampanha(campanhaId))
}
