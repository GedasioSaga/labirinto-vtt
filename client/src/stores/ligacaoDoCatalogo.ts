import { ligarCatalogoAoAcervo, type LigacaoDoCatalogo } from '../lib/itens/conversao/catalogo'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { useAcervoDeItensStore } from './acervoDeItensStore'
import { useCatalogoStore } from './catalogoStore'

/**
 * UMA COISA, UM LUGAR (itens refeitos): o efeito da ligação do livro com o Acervo
 * (`lib/itens/conversao/catalogo.ts`, puro). Grava o Acervo primeiro (as coisas novas e
 * completadas) e depois o `acervoId` no livro: se o livro falhar, a próxima vez acha a coisa pelo
 * id determinístico e liga sem fazer outra. Uma de cada vez (a fila): duas chamadas juntas não
 * criam a mesma coisa duas vezes.
 */

let fila: Promise<unknown> = Promise.resolve()

async function ligarAgora(sistema: SistemaDeRpg, abrir: string | undefined): Promise<LigacaoDoCatalogo | null> {
  const catalogo = useCatalogoStore.getState()
  const acervo = useAcervoDeItensStore.getState()
  if (catalogo.sistemaId !== sistema.id || !catalogo.podeGravar || !acervo.podeGravar) return null
  const feita = ligarCatalogoAoAcervo(catalogo.itens, acervo.itens, sistema, abrir === undefined ? {} : { abrir })
  if (feita.itens.length > 0) await acervo.juntarItens(feita.itens)
  if (feita.ligacoes.size > 0) await useCatalogoStore.getState().gravarLigacoes(feita.ligacoes)
  return feita
}

/**
 * Liga as armas e os itens do livro aberto às coisas do Acervo. `abrir` = a entrada que o mestre
 * quer editar (nunca fica solta). `null` = o livro ou o Acervo ainda não foram lidos: nada se grava.
 * Lança com a frase do disco.
 */
export function ligarOLivroAoAcervo(sistema: SistemaDeRpg, abrir?: string): Promise<LigacaoDoCatalogo | null> {
  const vez = fila.then(() => ligarAgora(sistema, abrir))
  fila = vez.then(
    () => undefined,
    () => undefined,
  )
  return vez
}

/** A frase do aviso do que a ligação fez; `null` = nada mudou. */
export function avisoDaLigacao(feita: LigacaoDoCatalogo): string | null {
  const partes = [
    ...(feita.ligadas.length > 0 ? [`${feita.ligadas.length} ${feita.ligadas.length === 1 ? 'ligada à coisa' : 'ligadas às coisas'} do Acervo`] : []),
    ...(feita.criadas.length > 0 ? [`${feita.criadas.length} ${feita.criadas.length === 1 ? 'virou item novo' : 'viraram itens novos'} no Acervo`] : []),
  ]
  const confira = feita.confira.length > 0 ? ` Para conferir no Acervo: ${feita.confira.join(', ')}.` : ''
  // Só "Confira" (nada ligou): avisa uma vez, quando o aviso entrou na coisa (`itens` não vazio); depois, silêncio.
  if (partes.length === 0) return confira !== '' && feita.itens.length > 0 ? `Armas e itens do livro:${confira}` : null
  return `Armas e itens do livro: ${partes.join('; ')}.${confira}`
}
