import { normalizeForSearch } from './mapObjects'

/**
 * BUSCA DE CENA: a mesma régua na lista Cenas ("Filtrar cenas") e nos
 * seletores de destino ("Mandar para…", "Levar para…" e o "Leva a…" do pino).
 * Só a lista do mestre usa: nada daqui vai para o jogador.
 */

/** Com menos cenas que isto a lista inteira cabe no olho, e a busca não aparece. */
export const SCENE_FILTER_MIN = 6

/** As palavras da busca, sem maiúscula nem acento (a mesma régua do "Buscar objeto"). */
export function sceneSearchWords(query: string): string[] {
  return normalizeForSearch(query)
    .split(/\s+/)
    .filter((word) => word !== '')
}

/**
 * A cena entra na busca quando toda palavra aparece no caminho ou no nome, e
 * pelo menos uma no nome: "tav" acha as duas Tavernas, "porto tav" só a de
 * Porto Cinza, e "vila" acha a Vila do Vau sem trazer junto tudo o que ela tem.
 */
export function matchesSceneSearch(words: readonly string[], name: string, trail: readonly string[]): boolean {
  const own = normalizeForSearch(name)
  const whole = normalizeForSearch([...trail, name].join(' '))
  return words.every((word) => whole.includes(word)) && words.some((word) => own.includes(word))
}

/** Uma cena de um seletor: o nome dela e as de fora (ausente = primeiro nível). */
export interface SceneSearchItem {
  name: string
  trail?: readonly string[]
}

/** As cenas de `items` que a busca `query` acha, na ordem da lista. Busca vazia devolve todas. */
export function searchScenes<T extends SceneSearchItem>(items: readonly T[], query: string): readonly T[] {
  const words = sceneSearchWords(query)
  if (words.length === 0) return items
  return items.filter((item) => matchesSceneSearch(words, item.name, item.trail ?? []))
}

/** O que a busca diz embaixo do campo: quantas achou, ou que não achou nenhuma. */
export function sceneSearchSummary(found: number, query: string): string {
  if (found === 0) return `Nenhuma cena com “${query.trim()}”`
  return found === 1 ? '1 cena' : `${found} cenas`
}
