import type { FonteNoPreludio } from '../types/map'
import { ehRegistro } from './preparo/molde'

/**
 * A LIGAÇÃO DE UMA COISA DO MAPA COM O PRELÚDIO, no pacote principal (pequena
 * de propósito: o disco do mapa e a ficha do pino a leem; o texto em si é
 * resolvido em `lib/preparo/pinoLigado.ts`, que só baixa com o Prelúdio).
 * Ver `FonteNoPreludio` em `types/map.ts`.
 */

/** O id do verbete serve de nome de arquivo em preparo/ (o mesmo teste de `idDoPreparoValido`). */
const ID_DO_VERBETE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/
/** Teto dos ids de forma e de seção e das cópias de nome. */
const TEXTO_MAX = 200

function semControle(texto: string): boolean {
  for (const letra of texto) {
    const codigo = letra.codePointAt(0) ?? 0
    if (codigo < 0x20 || codigo === 0x7f) return false
  }
  return true
}

function idDentroDoVerbete(valor: unknown): valor is string {
  return typeof valor === 'string' && valor !== '' && valor.length <= TEXTO_MAX && semControle(valor)
}

/** Cópia de nome: aparada, no teto e sem caractere de controle. */
export function nomeDaFonte(valor: unknown): string {
  if (typeof valor !== 'string') return ''
  let limpo = ''
  for (const letra of valor) {
    const codigo = letra.codePointAt(0) ?? 0
    limpo += codigo < 0x20 || codigo === 0x7f ? ' ' : letra
  }
  return limpo.trim().slice(0, TEXTO_MAX)
}

/**
 * A fonte gravada no disco. Forma errada volta AUSENTE: o pino fica com o
 * texto que tem (a cópia de reserva), como um pino comum. O `...p` da leitura
 * do pino copiaria o valor cru.
 */
export function readFonteNoPreludio(bruto: unknown): FonteNoPreludio | undefined {
  if (!ehRegistro(bruto)) return undefined
  const { verbeteId, formaId, secaoId, verbete, secao } = bruto
  if (typeof verbeteId !== 'string' || !ID_DO_VERBETE.test(verbeteId) || !idDentroDoVerbete(formaId) || !idDentroDoVerbete(secaoId)) return undefined
  return { verbeteId, formaId, secaoId, verbete: nomeDaFonte(verbete), secao: nomeDaFonte(secao) }
}

/** "Vila Tasmaturi › Ao chegar": a ligação como o mestre a lê. */
export function caminhoDaFonte(fonte: Pick<FonteNoPreludio, 'verbete' | 'secao'>): string {
  const verbete = fonte.verbete || 'Verbete sem nome'
  return fonte.secao === '' ? verbete : `${verbete} › ${fonte.secao}`
}

/** O que o jogador lê quando a seção ligada virou segredo depois de posta no mapa. */
export const TEXTO_INDISPONIVEL = 'Texto indisponível.'
