import type { Personagem } from '../personagem'
import { FICHAS_POR_LADO_MAX, PREFIXO_DA_COPIA, VEZES_MAX, type LadoDaArena, type MontagemDaArena } from './tipos'

/**
 * AS CÓPIAS DA ARENA (fase 1 de docs/planos/batalha-arena-de-testes-plano.md,
 * seção 4.3): cada ficha escolhida vira uma cópia em memória, com id novo e
 * histórico zerado. A batalha da arena só mexe nas cópias; a ficha de verdade
 * nunca é tocada.
 *
 * O id novo garante o espelho (Bruno contra Bruno) sem colisão. O nome só
 * ganha número quando a mesma ficha entra mais de uma vez na arena, nos dois
 * lados contados juntos ("Marinheiro", "Marinheiro 2", "Marinheiro 3"): o
 * registro nunca fica com dois nomes iguais.
 *
 * Puro: sem store.
 */

/** Id da cópia: `arena_<uuid>`. */
export function novoIdDeCopia(): string {
  return `${PREFIXO_DA_COPIA}${crypto.randomUUID()}`
}

/** A cópia de uma ficha real: tudo igual (clone fundo), menos o id, o nome e o histórico. */
export function copiaDaFicha(real: Personagem, id: string, nome: string): Personagem {
  return { ...structuredClone(real), id, nome, historico: [] }
}

/** Quantas cópias a escolha pede, inteiro em 1..`VEZES_MAX`. */
export function vezesValidas(vezes: number): number {
  if (!Number.isFinite(vezes)) return 1
  return Math.min(VEZES_MAX, Math.max(1, Math.trunc(vezes)))
}

/** Uma cópia pronta para a luta, com o lado e a ficha de onde veio. */
export interface CopiaNaArena {
  personagem: Personagem
  lado: LadoDaArena
  /** O id da ficha REAL. */
  origem: string
}

/**
 * As cópias da montagem, a partir das fichas reais de AGORA: Lado A primeiro,
 * depois o B (só no modo "lados"), cada lado no máximo `FICHAS_POR_LADO_MAX`.
 * Ficha escolhida que sumiu da pasta fica de fora.
 */
export function copiasDaMontagem(montagem: MontagemDaArena, fichas: readonly Personagem[], novoId: () => string = novoIdDeCopia): CopiaNaArena[] {
  const porId = new Map(fichas.map((ficha) => [ficha.id, ficha]))
  const lados: LadoDaArena[] = montagem.modo === 'boneco' ? ['a'] : ['a', 'b']
  const pedidas: { real: Personagem; lado: LadoDaArena }[] = []
  for (const lado of lados) {
    let noLado = 0
    for (const escolha of montagem.escolhas) {
      if (escolha.lado !== lado) continue
      const real = porId.get(escolha.personagemId)
      if (real === undefined) continue
      // O que cabe no lado: 0 quando ele já está cheio.
      const vezes = Math.min(vezesValidas(escolha.vezes), FICHAS_POR_LADO_MAX - noLado)
      for (let i = 0; i < vezes; i += 1) pedidas.push({ real, lado })
      noLado += vezes
    }
  }
  // O número no nome conta a mesma ficha nos dois lados juntos.
  const total = new Map<string, number>()
  for (const { real } of pedidas) total.set(real.id, (total.get(real.id) ?? 0) + 1)
  const contadas = new Map<string, number>()
  return pedidas.map(({ real, lado }) => {
    const n = (contadas.get(real.id) ?? 0) + 1
    contadas.set(real.id, n)
    const nome = (total.get(real.id) ?? 1) > 1 && n > 1 ? `${real.nome} ${n}` : real.nome
    return { personagem: copiaDaFicha(real, novoId(), nome), lado, origem: real.id }
  })
}
