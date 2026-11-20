/**
 * O PAPEL NO CHÃO do lado do MESTRE (plano dos puzzles, §1.5 e fase D2):
 * pôr, mudar e tirar um `DocumentoNoMapa` do mapa, e o que o canvas do mestre
 * desenha. Funções puras sobre o `MapData`: a store (`mapStore`) as chama com
 * o desfazer, e devolvem o PRÓPRIO mapa quando nada muda (nem passo vazio no
 * Ctrl+Z, nem redesenho à toa).
 *
 * O jogador nunca vê isto: o recorte dele é `papeisNoChao` (`recorte.ts`).
 */
import { pontoDoDesafio } from '../lib/desafios'
import type { MapData } from '../types/map'
import type { PapeisDosDocumentos } from './recorte'
import { sumiuDoMapa } from './recorte'
import { DOCUMENTOS_NO_MAPA_MAX, type DocumentoNoMapa, type LugarDoDocumento, type PapelDoDocumento } from './tipos'

const SEM_DOCUMENTOS: readonly DocumentoNoMapa[] = []

export function documentosDoMapa(map: Pick<MapData, 'documentos'>): readonly DocumentoNoMapa[] {
  return map.documentos ?? SEM_DOCUMENTOS
}

/** Os papéis de UM documento da biblioteca neste mapa (o mesmo texto pode estar em mais de um lugar). */
export function papeisDoDocumento(map: Pick<MapData, 'documentos'>, docId: string): DocumentoNoMapa[] {
  return documentosDoMapa(map).filter((documento) => documento.docId === docId)
}

/** O id do papel no chão: `[A-Za-z0-9_-]`, como o leitor do mapa exige. */
export function novoIdDoPapel(): string {
  return `papel_${crypto.randomUUID()}`
}

/**
 * O papel novo: fica no mapa depois de lido (o padrão do plano). No ponto, o
 * piso é o de quem marcou; no objeto, o piso é o do próprio objeto
 * (`pontoDoDesafio`), então não se grava outro.
 */
export function novoPapelNoMapa(id: string, docId: string, lugar: LugarDoDocumento, piso: number): DocumentoNoMapa {
  const papel: DocumentoNoMapa = { id, docId, lugar, depois: 'fica' }
  if (lugar.tipo === 'ponto' && piso !== 0) papel.piso = piso
  return papel
}

/** Põe o papel no mapa. Já há um com esse id, ou o mapa chegou ao teto: o mapa como estava. */
export function mapaComPapel(map: MapData, papel: DocumentoNoMapa): MapData {
  const atuais = documentosDoMapa(map)
  if (atuais.length >= DOCUMENTOS_NO_MAPA_MAX || atuais.some((documento) => documento.id === papel.id)) return map
  return { ...map, documentos: [...atuais, papel] }
}

/** Troca o papel de mesmo id pelo que `mudar` devolve. Sem esse papel, ou `mudar` devolveu o mesmo: o mapa como estava. */
export function mapaComPapelMudado(map: MapData, id: string, mudar: (papel: DocumentoNoMapa) => DocumentoNoMapa): MapData {
  const atuais = documentosDoMapa(map)
  const indice = atuais.findIndex((documento) => documento.id === id)
  if (indice < 0) return map
  const antes = atuais[indice]
  const depois = mudar(antes)
  if (depois === antes) return map
  // O id não muda por aqui: é o que o jogador manda de volta ao tocar no papel.
  const proximos = atuais.slice()
  proximos[indice] = { ...depois, id: antes.id }
  return { ...map, documentos: proximos }
}

/** Tira o papel do mapa. A lista vazia sai do arquivo (campo opcional: ausente = nenhum). */
export function mapaSemPapel(map: MapData, id: string): MapData {
  const atuais = documentosDoMapa(map)
  if (!atuais.some((documento) => documento.id === id)) return map
  const proximos = atuais.filter((documento) => documento.id !== id)
  if (proximos.length > 0) return { ...map, documentos: proximos }
  const { documentos: _tirada, ...semLista } = map
  return semLista
}

/** Muda o lugar: no ponto, o piso passa a ser o de quem marcou; no objeto, o do objeto. */
export function papelNoLugar(papel: DocumentoNoMapa, lugar: LugarDoDocumento, piso: number): DocumentoNoMapa {
  const { piso: _antigo, ...semPiso } = papel
  return lugar.tipo === 'ponto' && piso !== 0 ? { ...semPiso, lugar, piso } : { ...semPiso, lugar }
}

export function papelDepois(papel: DocumentoNoMapa, depois: DocumentoNoMapa['depois']): DocumentoNoMapa {
  return papel.depois === depois ? papel : { ...papel, depois }
}

/** "Pôr o papel de volta no mapa": esquece quem pegou. */
export function papelDeVolta(papel: DocumentoNoMapa): DocumentoNoMapa {
  if (papel.pego === undefined) return papel
  const { pego: _pego, ...semPego } = papel
  return semPego
}

/** O papel como o canvas desenha (mestre e jogador): o ponto, o tipo e dois realces só do mestre. */
export interface PapelDesenhado {
  id: string
  x: number
  y: number
  papel: PapelDoDocumento
  /** Já foi pego e saiu do mapa dos jogadores: o mestre ainda o vê, apagado, para saber onde estava. */
  apagado?: boolean
  /** O documento aberto na página Documentos: o papel dele acende no mapa. */
  aceso?: boolean
}

/**
 * O que o canvas do MESTRE desenha no piso em edição: todo papel com lugar,
 * mesmo o já pego (apagado). Documento apagado da biblioteca sai como o papel
 * padrão, para o mestre achá-lo e tirá-lo; objeto apagado não tem onde desenhar.
 */
export function papeisDoMestre(map: Pick<MapData, 'documentos' | 'props'>, papeis: PapeisDosDocumentos, piso: number, docAceso: string | null): PapelDesenhado[] {
  const desenhados: PapelDesenhado[] = []
  for (const documento of documentosDoMapa(map)) {
    const ponto = pontoDoDesafio(documento, map.props)
    if (ponto === null || (ponto.piso ?? 0) !== piso) continue
    const desenhado: PapelDesenhado = { id: documento.id, x: ponto.x, y: ponto.y, papel: papeis.get(documento.docId)?.papel ?? 'alfinete' }
    if (sumiuDoMapa(documento)) desenhado.apagado = true
    if (docAceso !== null && documento.docId === docAceso) desenhado.aceso = true
    desenhados.push(desenhado)
  }
  return desenhados
}
