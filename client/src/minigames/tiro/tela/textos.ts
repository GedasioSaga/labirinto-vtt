import { DIF, pontosDaMedalha, type DificuldadeSim } from '../sim'
import type { MedalhaTiro } from '../tipos'

/**
 * TEXTOS DA BARRACA DE TIRO: formatos de número e as frases do convite, da
 * rodada e do resultado, como no protótipo aprovado. Puro: a tela e o motor
 * leem daqui.
 */

/** Segundos restantes em m:ss, arredondando para cima (0:40 no começo, 0:00 só no fim). */
export function fmtT(s: number): string {
  const v = Math.max(0, Math.ceil(s - 1e-6))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}

export const fmtDec = (v: number, casas = 1): string => v.toFixed(casas).replace('.', ',')

export const pctTxt = (a: number, b: number): string => (b ? `${Math.round((a / b) * 100)}%` : '—')

export const NOMES_MED: Readonly<Record<MedalhaTiro, string>> = { bronze: 'Bronze', prata: 'Prata', ouro: 'Ouro' }
export const NOME_DIF: Readonly<Record<DificuldadeSim, string>> = { normal: 'Normal', extremo: 'Extremo' }

export const DESCRICAO_DIF: Readonly<Record<DificuldadeSim, string>> = {
  normal: `Alvos grandes e calmos. ${DIF.normal.tempo} s de rodada, recarga de ${fmtDec(DIF.normal.recarga)} s.`,
  extremo: `Alvos menores e rápidos valendo 50% a mais. ${DIF.extremo.tempo} s, recarga de ${fmtDec(DIF.extremo.recarga)} s. Aldeão e gato de lata tiram 50.`,
}

export function textoDaMeta(meta: MedalhaTiro, dif: DificuldadeSim): string {
  return `${NOMES_MED[meta]} no ${NOME_DIF[dif]}: ${pontosDaMedalha(dif, meta)} pontos em ${DIF[dif].tempo} s.`
}

/** "o bronze", "a prata", "o ouro". */
export const comArtigo = (m: MedalhaTiro): string => (m === 'prata' ? 'a prata' : `o ${m}`)

/** Os pontos de cada medalha nas duas dificuldades, para a nota do painel do mestre. */
export const NOTA_DAS_MEDALHAS = `Bronze, prata e ouro: ${DIF.normal.medalhas.join(', ')} pontos no Normal; ${DIF.extremo.medalhas.join(', ')} no Extremo.`

export const DICA_VAZIO = 'Tambor vazio: R, botão direito, X ou o botão Recarregar.'
export const DICA_PADRAO = 'Mire e atire. Acertos seguidos sobem o combo; um erro zera.'
export const DICA_CONTAGEM = 'Prontos? A rodada começa no "Já!".'
