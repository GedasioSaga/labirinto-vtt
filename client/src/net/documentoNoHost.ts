import { lerDocumentoNaFicha } from '../documentos/leitor'
import { darDocumento, linhaDoDocumento } from '../documentos/naFicha'
import { mapaComPapelMudado } from '../documentos/noMapa'
import { documentoNoFio, itensDeQuemLe } from '../documentos/resolver'
import type { Documento, DocumentoNaFicha, DocumentoNoFio, DocumentoNoMapa } from '../documentos/tipos'
import type { Personagem } from '../lib/personagem'
import type { MapData, Token } from '../types/map'
import { fichaDoBoneco, mochilaQueConta, quemEhOBoneco } from './puzzleNoHost'
import type { GuardadoDoDocumento } from './protocoloDoDocumento'

/**
 * DOCUMENTOS NO HOST (plano dos puzzles, §2.2 a §2.4; fase D3): as contas
 * puras de uma leitura. A sessão (`hostSession.ts`) confere quem pediu (o
 * papel no recorte dele, a ficha dele encostada e solta, a linha na lista
 * dele) e chama daqui; a ponte (`hostBridge.ts` → `playerChanges.applyDocumento`)
 * grava o resultado no mapa e nas fichas do mestre, fora do Ctrl+Z dele.
 *
 * O texto sai SÓ pelo resolver (`documentos/resolver.ts`), na hora de cada
 * leitura, com os itens que a ficha de quem lê carrega agora: o claro de um
 * trecho cifrado só para quem tem o item, o borrado sempre embaralhado.
 *
 * Regras do dono:
 * - lido no mapa entra na lista SEM "novo" (ele acabou de ler);
 * - "some depois de pego": o primeiro que lê leva, e o papel sai do mapa de
 *   todos; o documento fica na lista dele;
 * - a lista mora na FICHA DE PERSONAGEM (vale em qualquer mapa e sessão).
 *   Boneco sem ficha, ou mapa solto: ele lê, mas a lista não guarda, e o
 *   mestre é avisado.
 */

/** O aviso do mestre: o que aconteceu com o documento `docId`. */
export interface AvisoDoDocumento {
  docId: string
  tom: 'info' | 'error'
  texto: string
}

/** A leitura validada, pronta para o mapa e as fichas do mestre (`playerChanges.applyDocumento`). */
export interface AppliedDocumento {
  /** Cena de fundo; ausente = a aberta. */
  sceneId?: string
  /** As fichas de personagem que mudaram (a linha nova, ou o "novo" que saiu), inteiras. */
  personagens: Personagem[]
  /** O papel "some depois de pego" que saiu do mapa de todos: quem pegou, e quando. */
  pego?: { papelId: string; por: string; em: number }
  aviso?: AvisoDoDocumento
}

/**
 * O papel pego no mapa (puro e reaplicável, para todo passo do desfazer da
 * cena): só no papel "some" que ainda ninguém pegou. Num passo em que o papel
 * não existe, ou já foi pego, o mapa como está.
 */
export function mapaComDocumento(map: MapData, aplicado: Pick<AppliedDocumento, 'pego'>): MapData {
  const pego = aplicado.pego
  if (pego === undefined) return map
  return mapaComPapelMudado(map, pego.papelId, (papel) => (papel.depois !== 'some' || papel.pego !== undefined ? papel : { ...papel, pego: { por: pego.por, em: pego.em } }))
}

/** "“Bilhete na parede”", e "Sem título" para o documento que o mestre ainda não nomeou (como o papel). */
function tituloEntreAspas(documento: Pick<Documento, 'titulo'>): string {
  const titulo = documento.titulo.trim()
  return `“${titulo === '' ? 'Sem título' : titulo}”`
}

/**
 * A linha nova como o leitor da ficha a devolve (`lerDocumentoNaFicha`): é
 * assim que o lobby a recebe, e uma linha que ele lesse diferente seria
 * recusada lá. Do resolver de sempre ela já sai igual; isto só segura.
 */
function comLinhaLida(personagem: Personagem, docId: string): Personagem {
  const lista = personagem.documentos
  if (lista === undefined) return personagem
  return { ...personagem, documentos: lista.map((linha) => (linha.docId === docId ? (lerDocumentoNaFicha(linha) ?? linha) : linha)) }
}

export interface LeituraNoMapa {
  papel: DocumentoNoMapa
  documento: Documento
  /** A ficha que encostou, no mapa do mestre. */
  token: Token
  personagens: readonly Personagem[]
  /** Há aventura (há onde guardar a lista)? Mapa solto: não. */
  temAventura: boolean
  /** O nome do jogador, para o aviso do mestre. */
  nomeDoJogador: string
  agora: number
}

export interface ResultadoDaLeitura {
  noFio: DocumentoNoFio
  guardado: GuardadoDoDocumento
  /** `null` = nada a gravar nem a avisar (a releitura de um papel que fica). */
  aplicado: Omit<AppliedDocumento, 'sceneId'> | null
}

/** Encostou no papel e tocou: o documento como ele lê agora, a lista dele e o papel pego. */
export function lerNoMapa(leitura: LeituraNoMapa): ResultadoDaLeitura {
  const { papel, documento, token } = leitura
  const ficha = fichaDoBoneco(token, leitura.personagens)
  const noFio = documentoNoFio(documento, itensDeQuemLe(mochilaQueConta(token, ficha)))
  const titulo = tituloEntreAspas(documento)
  const quem = quemEhOBoneco(token)
  const pego = papel.depois === 'some' ? { papelId: papel.id, por: quem.nome, em: leitura.agora } : undefined
  const saiu = pego === undefined ? '' : ' O papel saiu do mapa.'

  if (ficha === null) {
    const onde = leitura.temAventura
      ? `a ficha ${quem.nome} não está ligada a uma ficha de personagem de ${leitura.nomeDoJogador}`
      : 'o mapa está solto (abra-o como aventura para guardar a lista)'
    const aviso: AvisoDoDocumento = { docId: documento.id, tom: 'error', texto: `${leitura.nomeDoJogador} leu ${titulo}, mas ${onde}: o documento não ficou guardado.${saiu}` }
    return { noFio, guardado: 'nao', aplicado: { personagens: [], ...(pego === undefined ? {} : { pego }), aviso } }
  }

  const dado = darDocumento(ficha, documento, 'mapa', undefined, leitura.agora)
  switch (dado.tipo) {
    case 'entrou': {
      const aviso: AvisoDoDocumento = { docId: documento.id, tom: 'info', texto: `${leitura.nomeDoJogador} leu ${titulo}.${saiu}` }
      return { noFio, guardado: 'agora', aplicado: { personagens: [comLinhaLida(dado.personagem, documento.id)], ...(pego === undefined ? {} : { pego }), aviso } }
    }
    case 'ja-tinha':
      return { noFio, guardado: 'antes', aplicado: pego === undefined ? null : { personagens: [], pego } }
    case 'cheia': {
      const aviso: AvisoDoDocumento = { docId: documento.id, tom: 'error', texto: `${leitura.nomeDoJogador} leu ${titulo}, mas a lista de documentos de ${ficha.nome} está cheia: o documento não ficou guardado.${saiu}` }
      return { noFio, guardado: 'nao', aplicado: { personagens: [], ...(pego === undefined ? {} : { pego }), aviso } }
    }
  }
}

/** A ficha DELE que tem o documento na lista; a primeira, na ordem de `personagens`. `null` = nenhuma. */
export function fichaComODocumento(personagens: readonly Personagem[], docId: string): Personagem | null {
  return personagens.find((personagem) => linhaDoDocumento(personagem, docId) !== undefined) ?? null
}

/** Pela lista: o documento como ele lê agora, com os itens que ESSA ficha carrega (quem pegou a lente depois passa a ler). */
export function lerDaLista(documento: Documento, ficha: Personagem): DocumentoNoFio {
  return documentoNoFio(documento, itensDeQuemLe(ficha.mochila))
}

/** A ficha sem o "novo" da linha `docId`. Sem a linha, ou já lida: a MESMA ficha (nada a gravar). */
export function semNovo(personagem: Personagem, docId: string): Personagem {
  const lista = personagem.documentos
  if (lista === undefined || !lista.some((linha) => linha.docId === docId && linha.novo === true)) return personagem
  const lidas = lista.map((linha): DocumentoNaFicha => {
    if (linha.docId !== docId || linha.novo !== true) return linha
    const { novo: _lido, ...semAviso } = linha
    return semAviso
  })
  return { ...personagem, documentos: lidas }
}
