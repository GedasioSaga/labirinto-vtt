import { MARCA_MAX, MARCAS_MAX, type ObjetoJson } from './modelo'

/**
 * REQUISITOS: O QUE O DISCO E O FIO GUARDAM (fase B2 de docs/design/habilidades/REQUISITOS.md §3.2 e §12).
 * As portas de leitura (a ficha em `lib/personagem.ts`, o item em `lib/leituraDoItem.ts`, o Acervo, o
 * catálogo, o Worker do Lobby) guardam o bloco `requisitos`, a definição do `acumulador` e as `marcas`
 * como vieram, para o app regravar o que um app mais novo escreveu sem apagar. Quem confere o conteúdo
 * é `ler.ts` (`lerRequisitos`, `lerAcumulador`, `lerMarcas`), na hora de usar.
 *
 * Mora à parte de `ler.ts` porque a ficha (`lib/personagem.ts`) importa daqui, e `ler.ts` chega de volta
 * à ficha pela fórmula: daqui só sai import de `modelo.ts`, que não importa nada. Puro: sem store, sem rede.
 */

/** Teto do JSON do bloco guardado: o mesmo da mecânica do cartão; mais que isto é lixo (o bloco sai, o cartão fica). */
export const REQUISITOS_GUARDADOS_MAX = 16_000
/** Teto do JSON da definição do acumulador: 8 regras de subir, 8 de cair e 99 níveis de ganho cabem folgados. */
export const ACUMULADOR_GUARDADO_MAX = 4_000

function ehRegistro(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** O objeto em cópia funda e só JSON, abaixo do teto; `null` = não é objeto, não vira JSON ou passa do teto. */
function copiaNoTeto(valor: unknown, max: number): ObjetoJson | null {
  if (!ehRegistro(valor)) return null
  let texto: string | undefined
  try {
    texto = JSON.stringify(valor)
  } catch {
    return null
  }
  if (texto === undefined || texto.length > max) return null
  const copia: unknown = JSON.parse(texto)
  return ehRegistro(copia) ? (copia as ObjetoJson) : null // saiu de JSON.stringify: todo valor de dentro já é JSON, por construção
}

/**
 * O bloco `requisitos` como veio: objeto abaixo do teto fica, em cópia; o resto sai (sem requisito).
 * Bloco torto ou de versão mais nova fica, para `lerRequisitos` dizer "torto" ou "atualize o app" sem
 * que o app de agora o apague ao salvar.
 */
export function requisitosGuardados(valor: unknown): ObjetoJson | undefined {
  return copiaNoTeto(valor, REQUISITOS_GUARDADOS_MAX) ?? undefined
}

/**
 * A definição do acumulador como veio: só objeto com `id` em texto e abaixo do teto (o requisito A4 e a
 * peça "+N" o apontam pelo id). Torta com `id` fica, para `lerAcumulador` ignorá-la com aviso sem apagar
 * a de um app mais novo.
 */
export function acumuladorGuardado(valor: unknown): ObjetoJson | undefined {
  if (!ehRegistro(valor) || typeof valor.id !== 'string') return undefined
  return copiaNoTeto(valor, ACUMULADOR_GUARDADO_MAX) ?? undefined
}

/**
 * As marcas como o disco as guarda: só texto, numa linha, aparado e cortado no teto, sem vazio nem
 * repetido igual, até `MARCAS_MAX`. Nenhuma = `undefined` (o cartão sem marca não ganha a chave). A
 * repetida com outra caixa ou acento ("fogo" e "Fogo") fica: quem a junta é `lerMarcas`.
 */
export function marcasGuardadas(valor: unknown): string[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const marcas: string[] = []
  for (const item of valor) {
    if (typeof item !== 'string') continue
    const marca = item.replace(/\s+/g, ' ').trim().slice(0, MARCA_MAX).trim()
    if (marca.length === 0 || marcas.includes(marca)) continue
    marcas.push(marca)
    if (marcas.length === MARCAS_MAX) break
  }
  return marcas.length === 0 ? undefined : marcas
}
