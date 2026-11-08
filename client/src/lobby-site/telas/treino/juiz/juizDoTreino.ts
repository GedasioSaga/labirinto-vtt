import { ajustesPadraoDoJuiz, validarAjustesDoJuiz, type AjustesDoJuiz } from '../../../../lib/treino/juiz'
import type { SistemaDeRpg } from '../../../../lib/sistemaDeRpg'

/**
 * OS AJUSTES DO JUDGE NESTE NAVEGADOR (fatia J, pedido de 06/11/2026: "o
 * boneco de teste vai ser o juiz e eles vão poder dar técnicas e modificar os
 * status deles"). A ficha do Judge e a leitura dos ajustes são puras e moram
 * em `lib/treino/juiz.ts` (o servidor da luta multijogador também as usa);
 * aqui fica só o armazenamento, por mesa: os ajustes nunca vão ao servidor, e
 * o "Voltar ao padrão" apaga. O robô que joga pelo Judge é o mesmo do treino.
 */

/** A grade do treino lê o id e o retrato do Judge por aqui. */
export { ID_DO_JUIZ, NOME_DO_JUIZ, RETRATO_DO_JUIZ } from '../../../../lib/treino/juiz'

const PREFIXO = 'labirinto.lobby.juizDoTreino'

function chave(campanhaId: string, demo: boolean): string {
  return `${PREFIXO}.${demo ? 'demo.' : ''}${campanhaId}`
}

function lerDoTexto(texto: string, sistema: SistemaDeRpg): AjustesDoJuiz | null {
  try {
    return validarAjustesDoJuiz(JSON.parse(texto), sistema)
  } catch {
    return null
  }
}

/** Os ajustes guardados; nenhum, tortos ou sem armazenamento = o padrão. */
export function lerAjustesDoJuiz(campanhaId: string, demo: boolean, sistema: SistemaDeRpg): AjustesDoJuiz {
  try {
    const texto = window.localStorage.getItem(chave(campanhaId, demo))
    return (texto === null ? null : lerDoTexto(texto, sistema)) ?? ajustesPadraoDoJuiz()
  } catch {
    return ajustesPadraoDoJuiz()
  }
}

/** Guarda; `false` = o navegador não deixou (modo privado, cheio ou bloqueado). */
export function guardarAjustesDoJuiz(campanhaId: string, demo: boolean, ajustes: AjustesDoJuiz): boolean {
  try {
    window.localStorage.setItem(chave(campanhaId, demo), JSON.stringify(ajustes))
    return true
  } catch {
    return false
  }
}

export function apagarAjustesDoJuiz(campanhaId: string, demo: boolean): void {
  try {
    window.localStorage.removeItem(chave(campanhaId, demo))
  } catch {
    // Sem armazenamento: não havia o que apagar.
  }
}
