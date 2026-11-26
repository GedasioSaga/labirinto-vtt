import type { ConfiraDoItem, TipoDoItem } from '../modelo'
import { CONFIRA_MAX } from '../leitura'

/**
 * Peças comuns da CONVERSÃO dos dados salvos (docs/design/itens-rework/PLANO.md §2). Puro: sem
 * disco, sem store. O efeito (gravar) fica em `stores/conversaoDosItens.ts`.
 */

/** Sem acento, sem caixa, espaços juntos: "Munições " = "municoes". */
export function normalizado(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Um hash curto e estável do texto (FNV-1a de 32 bits, duas vezes com sementes diferentes): a
 * mesma origem dá sempre o mesmo id (regra 3 do §2.1), e converter de novo nunca cria um segundo item.
 */
export function hashEstavel(texto: string): string {
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`
}

/** O id do item que nasce na conversão: `item_conv_<hash da origem>`. */
export function idDoItemConvertido(origem: string): string {
  return `item_conv_${hashEstavel(origem)}`
}

/** O id da vaga que nasce na conversão (o mesmo a cada conversão da mesma origem). */
export function idDaVagaConvertida(origem: string): string {
  return `vaga_conv_${hashEstavel(origem)}`
}

/** Junta os "Confira" novos aos que o item já tem, sem repetir o mesmo texto e a mesma origem, no teto. */
export function comConfira(atuais: readonly ConfiraDoItem[] | undefined, novos: readonly ConfiraDoItem[]): ConfiraDoItem[] | undefined {
  const lista = [...(atuais ?? [])]
  for (const novo of novos) {
    if (lista.length >= CONFIRA_MAX) break
    if (lista.some((atual) => atual.texto === novo.texto && atual.origem === novo.origem)) continue
    lista.push(novo)
  }
  return lista.length === 0 ? undefined : lista
}

/** "Arma", "Munição", "Consumível", "Armadura"... -> o tipo; `null` = "Arma" (decide a regra) ou outra categoria. */
export function tipoPelaCategoria(categoria: string): TipoDoItem | 'arma' | null {
  const nome = normalizado(categoria)
  if (/^(municao|municoes|balas?)$/.test(nome)) return 'municao'
  if (/^consumive(l|is)$/.test(nome)) return 'consumivel'
  if (/^(armadura|armaduras|roupa|roupas|equipamento|equipamentos)$/.test(nome)) return 'equipamento'
  if (/^armas?$/.test(nome)) return 'arma'
  return null
}

/** O nome é de explosivo ou de coisa que se joga (a Granada, a bomba, o boomerang). */
export function ehNomeDeArremesso(nome: string): boolean {
  return /\b(granadas?|bombas?|explosiv[oa]s?|dinamites?|molotov|shurikens?|kunais?|boomerangs?|bumerangues?|facas? de arremesso)\b/.test(normalizado(nome))
}

/** O nome é de coisa que volta para a mão (o boomerang). */
export function ehNomeQueVolta(nome: string): boolean {
  return /\b(boomerangs?|bumerangues?)\b/.test(normalizado(nome))
}

/** O primeiro número inteiro do texto ("6", "6 balas", "Pente de 6"); `null` = nenhum. */
export function primeiroNumero(texto: string): number | null {
  const achado = /(\d{1,7})/.exec(texto)
  if (achado === null) return null
  const n = Number.parseInt(achado[1], 10)
  return Number.isSafeInteger(n) ? n : null
}
