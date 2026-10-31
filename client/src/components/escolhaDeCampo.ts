import { normalizar } from '../lib/batalha/formula'
import { CAMPO_DA_CATEGORIA, CATEGORIAS_DE_ARMA, categoriaAtira, lerCategoria } from '../lib/batalha/leituraDaFicha'

/**
 * As peças comuns da caixa de escolha de um campo com `opcoes` (a Categoria
 * da arma), usadas pela ficha (`FichaAbas`) e pela janela do catálogo
 * (`livros/EntradaDoCatalogoDialog`).
 */

/** Uma opção da caixa: o valor gravado e o texto mostrado. */
export interface OpcaoDaEscolha {
  valor: string
  rotulo: string
}

/** O que a caixa mostra para um valor: a opção que casa e as opções a desenhar. */
export interface EscolhaDoCampo {
  selecionada: string
  opcoes: OpcaoDaEscolha[]
}

/**
 * As opções da caixa para o valor guardado. Vazio = "—". O valor casa com a
 * lista sem acento e sem caixa; a Categoria da arma casa também como a batalha
 * lê ("arma de fogo" = De fogo). Texto que não casa (ficha antiga) vira uma
 * opção a mais, "(fora da lista)": a caixa nunca troca o valor sozinha.
 */
export function escolhaDoCampo(opcoes: readonly string[], valor: string, casarComCategoria: boolean): EscolhaDoCampo {
  const atual = valor.trim()
  const base: OpcaoDaEscolha[] = [{ valor: '', rotulo: '—' }, ...opcoes.map((opcao) => ({ valor: opcao, rotulo: opcao }))]
  if (atual.length === 0) return { selecionada: '', opcoes: base }
  const porTexto = opcoes.find((opcao) => normalizar(opcao) === normalizar(atual))
  const categoria = casarComCategoria ? lerCategoria(atual) : null
  const porCategoria = categoria === null ? undefined : opcoes.find((opcao) => lerCategoria(opcao) === categoria)
  const casada = porTexto ?? porCategoria
  if (casada !== undefined) return { selecionada: casada, opcoes: base }
  return { selecionada: atual, opcoes: [...base, { valor: atual, rotulo: `${atual} (fora da lista)` }] }
}

/** A Categoria guardada nos campos é uma que não atira (Branca, Arremesso, Natural)? Vazia ou fora da lista: não. */
export function categoriaSemTiro(campos: Readonly<Record<string, string>>): boolean {
  const categoria = lerCategoria(campos[CAMPO_DA_CATEGORIA] ?? '')
  return categoria !== null && !categoriaAtira(categoria)
}

/** O nome da categoria como a lista escreve ("fogo" vira "De fogo"); fora da lista, o texto guardado; vazio, `null`. */
export function rotuloDaCategoria(campos: Readonly<Record<string, string>>): string | null {
  const texto = (campos[CAMPO_DA_CATEGORIA] ?? '').trim()
  if (texto.length === 0) return null
  const categoria = lerCategoria(texto)
  return CATEGORIAS_DE_ARMA.find((opcao) => opcao.id === categoria)?.rotulo ?? texto
}

/**
 * O aviso de que a Capacidade e as balas continuam guardadas, fora da tela,
 * quando a arma passa para uma categoria que não atira. `null` = nada guardado.
 */
export function avisoDoQueFicaGuardado(capacidade: boolean, balas: number): string | null {
  const partes: string[] = []
  if (capacidade) partes.push('a Capacidade')
  if (balas === 1) partes.push('1 tipo de bala')
  else if (balas > 1) partes.push(`${balas} tipos de bala`)
  if (partes.length === 0) return null
  const verbo = partes.length > 1 || balas > 1 ? 'ficam guardados' : capacidade ? 'fica guardada' : 'fica guardado'
  return `Esta categoria não atira: ${partes.join(' e ')} ${verbo}, fora da tela. Volte para De fogo ou Híbrida para ver de novo.`
}
