import type { Andamento, CopiaNoDrive, ResumoDaCopia, ResumoDaRestauracao, UltimaCopia } from './ponteDaCopia'

/**
 * As frases da cópia no Google Drive, separadas da tela (puras: data, tamanho e o
 * que dizer em cada momento).
 */

const HORA_MS = 60 * 60 * 1000
/**
 * A CÓPIA DIÁRIA (resposta do mestre em 08/11: "salvar automático + cópia diária"):
 * ao abrir o Prelúdio, se a última cópia deste PC tem mais que isto, uma nova roda
 * sozinha. 20 h, e não 24, para quem abre todo dia num horário um pouco diferente.
 */
export const INTERVALO_DA_COPIA_DIARIA_MS = 20 * HORA_MS

export function precisaDaCopiaDiaria(ultima: UltimaCopia | null, agora: number): boolean {
  return ultima === null || agora - ultima.quando >= INTERVALO_DA_COPIA_DIARIA_MS
}

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })
const NUMERO = new Intl.NumberFormat('pt-BR')
const UMA_CASA = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** "8 de nov. de 2026 21:30", na hora deste PC. */
export function textoDaData(quando: number): string {
  return DATA.format(quando)
}

const KIB = 1024
const MIB = KIB * 1024
const GIB = MIB * 1024

/** "830 KB", "12,4 MB", "1,5 GB". */
export function textoDoTamanho(bytes: number): string {
  if (bytes < KIB) return `${NUMERO.format(bytes)} B`
  if (bytes < MIB) return `${NUMERO.format(Math.round(bytes / KIB))} KB`
  if (bytes < GIB) return `${UMA_CASA.format(bytes / MIB)} MB`
  return `${UMA_CASA.format(bytes / GIB)} GB`
}

export function textoDosArquivos(quantos: number): string {
  return quantos === 1 ? '1 arquivo' : `${NUMERO.format(quantos)} arquivos`
}

/** "8 de nov. de 2026 21:30 · 1.463 arquivos · 1,5 GB". */
export function textoDaCopia(copia: CopiaNoDrive | UltimaCopia): string {
  return `${textoDaData(copia.quando)} · ${textoDosArquivos(copia.arquivos)} · ${textoDoTamanho(copia.bytes)}`
}

/** O que a linha de andamento diz (`null` = nada a dizer). */
export function textoDoAndamento(andamento: Andamento): string | null {
  const vez = `${NUMERO.format(Math.min(andamento.feitos + 1, andamento.total))} de ${NUMERO.format(andamento.total)}`
  switch (andamento.fase) {
    case 'lendo':
      return 'Lendo o Prelúdio deste PC…'
    case 'conferindo':
      return 'Conferindo o que o Google Drive já tem…'
    case 'enviando':
      return `Enviando ${vez}…`
    case 'baixando':
      return `Trazendo ${vez}…`
    case 'trocando':
      return 'Pondo a cópia no lugar…'
    case 'fim':
      return null
  }
}

/** A frase de uma cópia que terminou bem. */
export function textoDaCopiaFeita(resumo: ResumoDaCopia): string {
  if (resumo.nadaMudou && resumo.enviados === 0) {
    return 'Nada mudou desde a última cópia: o Google Drive já tem tudo.'
  }
  if (resumo.enviados === 0) return `Cópia feita: ${textoDosArquivos(resumo.arquivos)}, todos já estavam no Google Drive.`
  const subiram = resumo.enviados === 1 ? '1 arquivo subiu' : `${textoDosArquivos(resumo.enviados)} subiram`
  return `Cópia feita: ${subiram} agora (${textoDoTamanho(resumo.bytesEnviados)}); o resto o Google Drive já tinha.`
}

/** A frase de uma restauração que terminou bem. */
export function textoDaRestauracao(resumo: ResumoDaRestauracao, quando: number | null): string {
  const data = quando === null ? 'a cópia escolhida' : `a cópia de ${textoDaData(quando)}`
  const guardado = resumo.guardadoEm === null ? '' : ` O de antes ficou guardado na pasta de dados do app, em ${resumo.guardadoEm}.`
  return `O Prelúdio voltou para ${data} (${textoDosArquivos(resumo.arquivos)}).${guardado}`
}

/** A restauração nem começou: antes de trocar a pasta, o que mudou tem de estar no disco (e não foi). */
export function textoDaRestauracaoBarrada(motivo: string): string {
  return `A restauração não começou, e nada foi trocado: antes dela, o Prelúdio precisa gravar o que mudou, e não conseguiu. ${motivo.trim()}`
}
