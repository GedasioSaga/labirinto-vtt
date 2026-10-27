/**
 * CACHE DO RECORTE DO JOGADOR (F3 da otimização 200x200, 27/10/2026).
 *
 * Com a sala aberta, cada passo de ficha que o mestre arrasta refaz o recorte
 * de cada jogador (`filterMapForPlayer`) e o compara com a última tela. Duas
 * coisas não mudam entre um passo e outro e eram refeitas toda vez:
 * - os pontos de amostra de desenho e sala (`fogFilter.ts`), guardados aqui
 *   por referência do item (o mapa é imutável: item editado é objeto novo);
 * - o array de cada campo do mapa recortado: com os mesmos itens, volta o
 *   MESMO array da tela anterior, e o patch resolve por identidade
 *   (`hostSession.ts`, `viewPatch.ts`).
 *
 * `ligado` existe para o teste de igualdade (com cache = sem cache,
 * `net/hostSession.recorteComCache.test.ts`). O app nunca desliga.
 */
export const cacheDoRecorte = { ligado: true }

/** Cache por referência: `chave` já vista devolve o valor guardado. Com o cache desligado, calcula sempre. */
export function porReferencia<K extends object, V>(guardado: WeakMap<K, V>, chave: K, calcular: () => V): V {
  if (!cacheDoRecorte.ligado) return calcular()
  const ja = guardado.get(chave)
  if (ja !== undefined) return ja
  const novo = calcular()
  guardado.set(chave, novo)
  return novo
}
