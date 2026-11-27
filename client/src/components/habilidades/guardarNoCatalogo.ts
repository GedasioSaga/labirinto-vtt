import { CATALOGO_CHEIO, CATALOGO_MAX, entradaDaHabilidade, type ItemDoCatalogo } from '../../lib/livros/catalogo'
import { gravarCatalogo, lerCatalogo } from '../../lib/livros/catalogoNoDisco'
import type { CartaoDaFicha } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { useCatalogoStore } from '../../stores/catalogoStore'

/**
 * "GUARDAR TAMBÉM NO CATÁLOGO DO LIVRO" (rework das habilidades, D14): a habilidade salva na ficha
 * entra também no catálogo do livro do sistema. Só no app do mestre (o catálogo mora no disco dele).
 * A de mesmo nome é trocada, com o mesmo id (`entradaDaHabilidade`). Lança com a frase pronta; devolve
 * a frase do que aconteceu.
 *
 * Com o catálogo do mesmo livro aberto na Biblioteca, grava por ele (a tela e o disco andam juntos);
 * senão lê o disco, junta e grava, e o catálogo aberto de outro livro fica como está.
 */
export async function guardarHabilidadeNoCatalogo(cartao: CartaoDaFicha, sistema: SistemaDeRpg): Promise<string> {
  const loja = useCatalogoStore.getState()
  if (loja.sistemaId === sistema.id && loja.podeGravar) {
    const item = entradaParaGuardar(cartao, loja.itens)
    await loja.salvarEntrada(item)
    return fraseDoGuardado(item, loja.itens)
  }
  const lido = await lerCatalogo(sistema.id)
  if (!lido.lido) throw new Error(lido.aviso ?? 'O catálogo do livro não foi lido do disco; nada foi gravado para não apagar o que está lá.')
  const item = entradaParaGuardar(cartao, lido.itens)
  const existe = lido.itens.some((atual) => atual.id === item.id)
  if (!existe && lido.itens.length >= CATALOGO_MAX) throw new Error(CATALOGO_CHEIO)
  await gravarCatalogo(sistema.id, existe ? lido.itens.map((atual) => (atual.id === item.id ? item : atual)) : [...lido.itens, item])
  if (useCatalogoStore.getState().sistemaId === sistema.id) await useCatalogoStore.getState().recarregar()
  return fraseDoGuardado(item, lido.itens)
}

function entradaParaGuardar(cartao: CartaoDaFicha, catalogo: readonly ItemDoCatalogo[]): ItemDoCatalogo {
  const item = entradaDaHabilidade(cartao, catalogo)
  if (item === null) throw new Error('Dê um nome próprio à habilidade para guardar no catálogo do livro.')
  return item
}

function fraseDoGuardado(item: ItemDoCatalogo, antes: readonly ItemDoCatalogo[]): string {
  return antes.some((atual) => atual.id === item.id) ? `${item.nome} foi atualizada no catálogo do livro.` : `${item.nome} entrou no catálogo do livro.`
}
