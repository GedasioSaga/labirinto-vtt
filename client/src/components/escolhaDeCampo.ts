import { ATAQUE_SO_DE_EFEITO, ATRIBUTO_PADRAO_DO_ATAQUE, CAMPO_DO_ATRIBUTO_DO_ATAQUE, ehAtaqueSoDeEfeito, lerAtributoDoAtaque, normalizar } from '../lib/batalha/formula'
import { CAMPO_DA_CATEGORIA, CATEGORIAS_DE_ARMA, categoriaAtira, lerCategoria } from '../lib/batalha/leituraDaFicha'
import { CAMPO_DO_TIPO, lerTipo, rotuloDoTipo } from '../lib/batalha/tiposDaHabilidade'
import type { CampoDoCartao, SistemaDeRpg } from '../lib/sistemaDeRpg'

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

/** O texto da opção vazia da caixa. */
const ROTULO_DO_VAZIO = '—'

/** Construtor C8: a opção que guarda uma palavra curta e mostra a frase inteira ("Nada" = arma só de efeito). */
const ROTULO_DA_OPCAO: Readonly<Record<string, string>> = { [ATAQUE_SO_DE_EFEITO]: `${ATAQUE_SO_DE_EFEITO}: arma só de efeito (sem dano)` }

/**
 * O texto da opção vazia de um campo. No Tipo da habilidade, vazio não é
 * "nada": a batalha deduz pela Ação, então a caixa diz o que vale
 * ("— pela Ação (Reação)"). Nos outros campos, "—".
 */
export function rotuloDoVazio(campoId: string, campos: Readonly<Record<string, string>>): string {
  if (campoId === CAMPO_DO_ATRIBUTO_DO_ATAQUE) return `${ROTULO_DO_VAZIO} ${ATRIBUTO_PADRAO_DO_ATAQUE} (padrão)`
  if (campoId !== CAMPO_DO_TIPO) return ROTULO_DO_VAZIO
  const deduzido = lerTipo({ campos: { ...campos, [CAMPO_DO_TIPO]: '' } }).tipo
  return `${ROTULO_DO_VAZIO} pela Ação (${rotuloDoTipo(deduzido)})`
}

/**
 * As opções da caixa para o valor guardado. Vazio = "—" (ou `rotuloDoVazio`). O valor casa com a
 * lista sem acento e sem caixa; a Categoria da arma casa também como a batalha
 * lê ("arma de fogo" = De fogo). Texto que não casa (ficha antiga) vira uma
 * opção a mais, "(fora da lista)": a caixa nunca troca o valor sozinha.
 */
export function escolhaDoCampo(opcoes: readonly string[], valor: string, casarComCategoria: boolean, rotuloDoVazio = ROTULO_DO_VAZIO): EscolhaDoCampo {
  const atual = valor.trim()
  const base: OpcaoDaEscolha[] = [{ valor: '', rotulo: rotuloDoVazio }, ...opcoes.map((opcao) => ({ valor: opcao, rotulo: ROTULO_DA_OPCAO[opcao] ?? opcao }))]
  if (atual.length === 0) return { selecionada: '', opcoes: base }
  const porTexto = opcoes.find((opcao) => normalizar(opcao) === normalizar(atual))
  const categoria = casarComCategoria ? lerCategoria(atual) : null
  const porCategoria = categoria === null ? undefined : opcoes.find((opcao) => lerCategoria(opcao) === categoria)
  const casada = porTexto ?? porCategoria
  if (casada !== undefined) return { selecionada: casada, opcoes: base }
  return { selecionada: atual, opcoes: [...base, { valor: atual, rotulo: `${atual} (fora da lista)` }] }
}

/**
 * As opções da caixa de um campo; `undefined` = texto livre. O "Soma no
 * ataque" da arma lista os atributos do sistema da ficha (não uma lista fixa:
 * o sistema editado leva os atributos dele); os outros, as `opcoes` do molde.
 */
export function opcoesDoCampo(campo: CampoDoCartao, sistema: SistemaDeRpg): readonly string[] | undefined {
  // Construtor C8: por último, "Nada" (a arma que não dá dano, só põe o efeito: o Boomerang).
  if (campo.id === CAMPO_DO_ATRIBUTO_DO_ATAQUE) return [...sistema.atributos.map((atributo) => atributo.nome), ATAQUE_SO_DE_EFEITO]
  return campo.opcoes
}

/**
 * O valor que a caixa casa com as opções. No "Soma no ataque", casa como a
 * batalha lê: "PER" e "percepcao" mostram Percepção. O valor guardado não muda.
 */
export function valorDaEscolha(campoId: string, valor: string, sistema: SistemaDeRpg): string {
  if (campoId !== CAMPO_DO_ATRIBUTO_DO_ATAQUE) return valor
  if (ehAtaqueSoDeEfeito(valor)) return ATAQUE_SO_DE_EFEITO
  return lerAtributoDoAtaque(valor, sistema)?.nome ?? valor
}

/** O que o Atacar faz com a arma "Nada" (construtor C8), dito embaixo da caixa. */
const AVISO_DO_SO_DE_EFEITO = 'O Atacar com esta arma não dá dano. O alvo reage só se houver efeito (um selo no Efeito ou na mecânica).'

/**
 * O "Soma no ataque" guarda um atributo que o sistema não tem? Então avisa que o Atacar soma a Força.
 * Construtor C8: "Nada" explica que a arma é só de efeito. `null` = nada a dizer.
 */
export function avisoDoAtributoDoAtaque(valor: string, sistema: SistemaDeRpg): string | null {
  const texto = valor.trim()
  if (ehAtaqueSoDeEfeito(texto)) return AVISO_DO_SO_DE_EFEITO
  if (texto.length === 0 || lerAtributoDoAtaque(texto, sistema) !== null) return null
  return `"${texto}" não é um atributo deste sistema: o Atacar soma a ${ATRIBUTO_PADRAO_DO_ATAQUE}.`
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
