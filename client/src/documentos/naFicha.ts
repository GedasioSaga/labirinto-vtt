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

/** O título como o jogador o lê; o documento que o mestre não nomeou é "Sem título", como o papel. */
export function tituloOuSemTitulo(documento: Pick<Documento, 'titulo'>): string {
  const titulo = documento.titulo.trim()
  return titulo === '' ? 'Sem título' : titulo
}

/** O que sobrou de dar vários documentos de uma vez: a ficha nova e o que não entrou, para o aviso do mestre. */
export interface DocumentosDados {
  /** A ficha com as linhas novas; nada entrou = a MESMA ficha. */
  personagem: Personagem
  /** Os títulos que entraram agora, com o "novo". */
  entraram: string[]
  /** Quantos o mestre apagou da biblioteca (não há o que dar). */
  apagados: number
  /** Os títulos que não couberam: a lista no teto. */
  naoCouberam: string[]
}

/**
 * O desfecho do puzzle e o conteúdo do baú: cada documento pelo id, da
 * biblioteca de AGORA, um por um por `darDocumento` (o repetido e o que ele
 * já tinha não entram de novo nem voltam a ser novos).
 */
export function darDocumentos(
  personagem: Personagem,
  docIds: readonly string[],
  documentoPeloId: (docId: string) => Pick<Documento, 'id' | 'titulo' | 'papel'> | null,
  origem: Exclude<OrigemDoDocumento, 'mapa'>,
  de: string | undefined,
  agora: number,
): DocumentosDados {
  const dados: DocumentosDados = { personagem, entraram: [], apagados: 0, naoCouberam: [] }
  for (const docId of docIds) {
    const documento = documentoPeloId(docId)
    if (documento === null) {
      dados.apagados++
      continue
    }
    const dado = darDocumento(dados.personagem, documento, origem, de, agora)
    if (dado.tipo === 'cheia') dados.naoCouberam.push(tituloOuSemTitulo(documento))
    if (dado.tipo !== 'entrou') continue
    dados.personagem = dado.personagem
    dados.entraram.push(tituloOuSemTitulo(documento))
  }
  return dados
}

/** As linhas do aviso do mestre para o que `darDocumentos` não entregou (vazia: nada a avisar). */
export function avisosDosDocumentos(dados: Pick<DocumentosDados, 'apagados' | 'naoCouberam'>, nome: string): string[] {
  const avisos: string[] = []
  if (dados.apagados > 0) avisos.push(dados.apagados === 1 ? 'Um documento foi apagado da biblioteca: não foi entregue.' : `${dados.apagados} documentos foram apagados da biblioteca: não foram entregues.`)
  for (const titulo of dados.naoCouberam) avisos.push(`A lista de documentos de ${nome} está cheia: “${titulo}” não foi guardado.`)
  return avisos
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
