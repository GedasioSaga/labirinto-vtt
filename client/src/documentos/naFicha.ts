/**
 * A LISTA DE DOCUMENTOS NA FICHA, do lado do MESTRE (plano dos puzzles, §1.5
 * e fase D2): o "Dar a todos" e o "Dar a…" da página Documentos, o "Quem tem"
 * e o tirar da lista. Funções puras sobre o `Personagem`; quem grava é o
 * `ajustarPersonagem` da aventura, que parte da ficha de AGORA.
 *
 * Só os metadados entram na ficha (título e papel copiados, quando, de onde,
 * o "novo"); o texto continua na biblioteca e o host o monta na leitura.
 */
import type { Personagem } from '../lib/personagem'
import { DOCUMENTOS_NA_FICHA_MAX, type Documento, type DocumentoNaFicha, type OrigemDoDocumento } from './tipos'

/** O "de" de quem recebeu direto do mestre (o texto do plano). */
export const DE_O_MESTRE = 'o mestre'

/** O que aconteceu ao dar: entrou, ele já tinha (não duplica nem renova o "novo"), ou a lista dele está no teto. */
export type ResultadoDeDar = { tipo: 'entrou'; personagem: Personagem } | { tipo: 'ja-tinha' } | { tipo: 'cheia' }

export function linhaDoDocumento(personagem: Pick<Personagem, 'documentos'>, docId: string): DocumentoNaFicha | undefined {
  return personagem.documentos?.find((linha) => linha.docId === docId)
}

/**
 * Dá o documento ao personagem. Do mestre (e de puzzle ou objeto), entra com
 * o aviso de "novo"; lido no mapa, sem ele (o jogador acabou de ler).
 */
export function darDocumento(
  personagem: Personagem,
  documento: Pick<Documento, 'id' | 'titulo' | 'papel'>,
  origem: OrigemDoDocumento,
  de: string | undefined,
  agora: number,
): ResultadoDeDar {
  const lista = personagem.documentos ?? []
  if (lista.some((linha) => linha.docId === documento.id)) return { tipo: 'ja-tinha' }
  if (lista.length >= DOCUMENTOS_NA_FICHA_MAX) return { tipo: 'cheia' }
  const linha: DocumentoNaFicha = { docId: documento.id, titulo: documento.titulo, papel: documento.papel, em: agora, origem }
  if (de !== undefined && de !== '') linha.de = de
  if (origem !== 'mapa') linha.novo = true
  return { tipo: 'entrou', personagem: { ...personagem, documentos: [...lista, linha] } }
}

/** Tira o documento da lista. Sem ele na lista: o mesmo personagem. A lista vazia sai da ficha. */
export function semDocumento(personagem: Personagem, docId: string): Personagem {
  const lista = personagem.documentos
  if (lista === undefined || !lista.some((linha) => linha.docId === docId)) return personagem
  const proxima = lista.filter((linha) => linha.docId !== docId)
  if (proxima.length > 0) return { ...personagem, documentos: proxima }
  const { documentos: _tirada, ...semLista } = personagem
  return semLista
}

/** Quantos personagens (de qualquer tipo) têm o documento: o aviso do "Apagar". */
export function quantosTem(personagens: readonly Pick<Personagem, 'documentos'>[], docId: string): number {
  return personagens.filter((personagem) => linhaDoDocumento(personagem, docId) !== undefined).length
}

/** "leu no mapa", "ganhou em Cofre do Capitão", "recebeu do mestre": a linha do "Quem tem". */
export function textoDaOrigem(linha: Pick<DocumentoNaFicha, 'origem' | 'de'>): string {
  switch (linha.origem) {
    case 'mapa':
      return 'leu no mapa'
    case 'puzzle':
      return linha.de === undefined ? 'ganhou num puzzle' : `ganhou em ${linha.de}`
    case 'objeto':
      return linha.de === undefined ? 'achou num objeto' : `achou em ${linha.de}`
    case 'mestre':
      return 'recebeu do mestre'
  }
}

/** "Bento", "Bento e Lara", "Bento, Lara e Nami": o aviso do "Dar a todos". */
export function juntarNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}
