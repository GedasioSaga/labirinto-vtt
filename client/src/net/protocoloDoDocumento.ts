/**
 * DOCUMENTOS — as mensagens do documento (plano dos puzzles, §2.2; fase D3).
 * Aditivo como o resto do protocolo: jogador antigo cai no `default` e
 * ignora; mestre antigo responde `error invalid_message`.
 *
 *  - jogador → mestre: `documento.ler` (encostou no papel e tocou, ou abriu
 *    pela lista "Documentos") e `documento.lido` (tira o "novo" da linha dele);
 *  - mestre → jogador: `documento.conteudo` (o documento como ELE o lê, montado
 *    na hora pelo host, `documentos/resolver.ts`) e `documento.recusado`.
 *
 * O host é a autoridade: o jogador só pede. O texto claro de um trecho
 * protegido nunca viaja para quem não tem o item (o resolver o troca antes);
 * aqui o jogador confere a forma de tudo, e a mensagem torta cai inteira em
 * vez de virar meia leitura.
 *
 * O "recebeu do mestre" não tem mensagem própria: a linha nova, com "novo",
 * chega na lista da ficha dele (`personagens`), e a tela acende o aviso pela
 * lista. Assim o F5 e a sessão nova mostram o mesmo número.
 *
 * Este módulo não importa `protocol.ts`, que importa daqui.
 */
import { ehIdDeDocumento, ehIdDeTrecho, lerDocumento } from '../documentos/leitor'
import {
  extrasPadrao,
  MOSTRAS_DO_TRECHO,
  PAGINAS_DO_DOCUMENTO_MAX,
  PAPEIS_DO_DOCUMENTO,
  TEXTO_CIFRADO_MAX,
  TEXTO_CLARO_MAX,
  TEXTO_DA_PAGINA_MAX,
  TITULO_DO_DOCUMENTO_MAX,
  TRECHOS_MAX,
} from '../documentos/tipos'
import type { BlocoNoFio, DocumentoNoFio, ExtrasDoDocumento, MostraDoTrecho, PaginaNoFio, PapelDoDocumento } from '../documentos/tipos'

// ------------------------------------------------------------------ tetos do fio (só barram lixo)

/** Id da ficha (boneco) que leu. */
const TOKEN_ID_MAX = 200
/** Referência de imagem (`midia:<id>`); maior que isto não é referência. */
const IMAGEM_NO_FIO_MAX = 512
/** Um trecho protegido no fio: o claro, o cifrado do mestre ou o embaralhado de um deles. */
const TEXTO_DO_TRECHO_MAX = Math.max(TEXTO_CLARO_MAX, TEXTO_CIFRADO_MAX)
/** Pedaços de uma página: cada marca de trecho parte o texto em dois, então no máximo o dobro dos trechos e mais um. */
const BLOCOS_DA_PAGINA_MAX = TRECHOS_MAX * 2 + 1
/** O id do item que abriu o trecho (`ItemDoCatalogo.id`), com folga. */
const ITEM_ID_MAX = 200

// ------------------------------------------------------------------ recusas

/**
 * Por que o host não deixou ler:
 * - `longe`: nenhuma ficha dele encostada no papel;
 * - `indisponivel`: cena em pausa, papel fora do recorte dele (névoa, outro piso, outra cena);
 * - `congelado`: a ficha que alcança está parada;
 * - `pego`: "some depois de pego", e alguém já levou;
 * - `apagado`: o mestre apagou o documento da biblioteca;
 * - `nao_tem`: pela lista, um documento que não está na lista dele.
 */
export type DocumentoMotivoDaRecusa = 'longe' | 'indisponivel' | 'congelado' | 'pego' | 'apagado' | 'nao_tem'

const MOTIVOS_DA_RECUSA: readonly DocumentoMotivoDaRecusa[] = ['longe', 'indisponivel', 'congelado', 'pego', 'apagado', 'nao_tem']

/** O texto curto de cada recusa, na tela do jogador. O `apagado` é o texto do plano (§1.5). */
export function textoDaRecusaDoDocumento(motivo: DocumentoMotivoDaRecusa): string {
  switch (motivo) {
    case 'longe':
      return 'Encoste a ficha no papel e toque nele para ler.'
    case 'indisponivel':
      return 'Não dá para ler este papel agora.'
    case 'congelado':
      return 'Sua ficha está parada agora.'
    case 'pego':
      return 'Alguém já pegou este papel.'
    case 'apagado':
      return 'O mestre apagou este documento.'
    case 'nao_tem':
      return 'Este documento não está na sua lista.'
  }
}

// ------------------------------------------------------------------ o que viaja

/**
 * O que a leitura fez com a lista dele: `agora` = entrou agora (a primeira
 * leitura no mapa: o papel voa até "Documentos"); `antes` = já estava lá (a
 * releitura, ou a leitura pela lista); `nao` = não ficou guardado (ficha sem
 * personagem, mapa solto, lista cheia).
 */
export type GuardadoDoDocumento = 'agora' | 'antes' | 'nao'
const GUARDADOS: readonly GuardadoDoDocumento[] = ['agora', 'antes', 'nao']

export type DocumentoPlayerMessage =
  /** Encostou no papel `noMapaId` (`PapelNoChao.id`) e tocou. `tokenId` ausente: o host usa a primeira ficha dele encostada e solta. */
  | { type: 'documento.ler'; noMapaId: string; tokenId?: string }
  /** Pela lista "Documentos": o `docId` tem de estar na lista de uma ficha dele. */
  | { type: 'documento.ler'; docId: string; daLista: true }
  /** Leu: o "novo" sai da linha dele. */
  | { type: 'documento.lido'; docId: string }

export type DocumentoHostMessage =
  /** `noMapaId`: a leitura veio do papel no chão (a tela o liga ao toque que ela fez). */
  | { type: 'documento.conteudo'; documento: DocumentoNoFio; guardado: GuardadoDoDocumento; noMapaId?: string }
  | { type: 'documento.recusado'; motivo: DocumentoMotivoDaRecusa; noMapaId?: string; docId?: string }

// ------------------------------------------------------------------ peças pequenas

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textoAte(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max
}

function idAte(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function umDaLista<T extends string>(lista: readonly T[], value: unknown): T | undefined {
  return lista.find((item) => item === value)
}

/** A imagem do fio: referência curta, ou `null`. O que não é texto (ou é grande demais) vira `null`, sem derrubar a leitura. */
function imagemDoFio(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= IMAGEM_NO_FIO_MAX ? value : null
}

// ------------------------------------------------------------------ do jogador, no host

/** Do jogador, no host: a sessão confere o resto (alcance, recorte, a lista dele). */
export function parseDocumentoPlayerMessage(value: unknown): DocumentoPlayerMessage | null {
  if (!isRecord(value)) return null
  switch (value.type) {
    case 'documento.ler':
      if (value.daLista === true) return ehIdDeDocumento(value.docId) ? { type: 'documento.ler', docId: value.docId, daLista: true } : null
      if (!ehIdDeDocumento(value.noMapaId)) return null
      if (value.tokenId === undefined) return { type: 'documento.ler', noMapaId: value.noMapaId }
      return idAte(value.tokenId, TOKEN_ID_MAX) ? { type: 'documento.ler', noMapaId: value.noMapaId, tokenId: value.tokenId } : null
    case 'documento.lido':
      return ehIdDeDocumento(value.docId) ? { type: 'documento.lido', docId: value.docId } : null
    default:
      return null
  }
}

// ------------------------------------------------------------------ do mestre, no jogador

function lerBloco(value: unknown): BlocoNoFio | null {
  if (!isRecord(value)) return null
  if (value.t === 'texto') return textoAte(value.texto, TEXTO_DA_PAGINA_MAX) ? { t: 'texto', texto: value.texto } : null
  if (value.t !== 'protegido' || typeof value.id !== 'string' || !ehIdDeTrecho(value.id) || !textoAte(value.texto, TEXTO_DO_TRECHO_MAX)) return null
  const { id, texto } = value
  if (value.tipo === 'borrado') return value.lido === false ? { t: 'protegido', id, tipo: 'borrado', texto, lido: false } : null
  const mostra: MostraDoTrecho | undefined = umDaLista(MOSTRAS_DO_TRECHO, value.mostra)
  if (value.tipo !== 'cifra' || mostra === undefined) return null
  if (value.lido === false) return { t: 'protegido', id, tipo: 'cifra', mostra, texto, lido: false }
  if (value.lido !== true || !idAte(value.com, ITEM_ID_MAX) || !textoAte(value.antes, TEXTO_DO_TRECHO_MAX)) return null
  return { t: 'protegido', id, tipo: 'cifra', mostra, texto, lido: true, com: value.com, antes: value.antes }
}

function lerPagina(value: unknown): PaginaNoFio | null {
  if (!isRecord(value) || !Array.isArray(value.blocos) || value.blocos.length > BLOCOS_DA_PAGINA_MAX) return null
  const blocos: BlocoNoFio[] = []
  for (const cru of value.blocos) {
    const bloco = lerBloco(cru)
    if (bloco === null) return null
    blocos.push(bloco)
  }
  return { blocos, imagem: imagemDoFio(value.imagem) }
}

/**
 * Os extras pela MESMA leitura da biblioteca (`lerDocumento`): campo torto
 * vira o padrão, campo a campo, e nenhum campo a mais atravessa. O id é só o
 * que o leitor exige para devolver o documento.
 */
function lerExtrasDoFio(docId: string, value: unknown): ExtrasDoDocumento {
  return lerDocumento({ id: docId, extras: value })?.extras ?? extrasPadrao()
}

/** O documento inteiro, campo a campo; um campo torto (fora os extras) derruba a mensagem. */
export function lerDocumentoNoFio(value: unknown): DocumentoNoFio | null {
  if (!isRecord(value) || !ehIdDeDocumento(value.docId) || !textoAte(value.titulo, TITULO_DO_DOCUMENTO_MAX)) return null
  const papel: PapelDoDocumento | undefined = umDaLista(PAPEIS_DO_DOCUMENTO, value.papel)
  if (papel === undefined || !Array.isArray(value.paginas) || value.paginas.length === 0 || value.paginas.length > PAGINAS_DO_DOCUMENTO_MAX) return null
  const paginas: PaginaNoFio[] = []
  for (const cru of value.paginas) {
    const pagina = lerPagina(cru)
    if (pagina === null) return null
    paginas.push(pagina)
  }
  return {
    docId: value.docId,
    titulo: value.titulo,
    papel,
    imagemDoPapel: papel === 'imagem' ? imagemDoFio(value.imagemDoPapel) : null,
    extras: lerExtrasDoFio(value.docId, value.extras),
    paginas,
  }
}

/** Do mestre, no jogador. O host é de confiança, mas a mensagem torta cai inteira em vez de virar meia leitura. */
export function parseDocumentoHostMessage(value: unknown): DocumentoHostMessage | null {
  if (!isRecord(value)) return null
  const noMapaId = value.noMapaId === undefined ? undefined : ehIdDeDocumento(value.noMapaId) ? value.noMapaId : null
  if (noMapaId === null) return null
  switch (value.type) {
    case 'documento.conteudo': {
      const documento = lerDocumentoNoFio(value.documento)
      const guardado = umDaLista(GUARDADOS, value.guardado)
      if (documento === null || guardado === undefined) return null
      return noMapaId === undefined ? { type: 'documento.conteudo', documento, guardado } : { type: 'documento.conteudo', documento, guardado, noMapaId }
    }
    case 'documento.recusado': {
      const motivo = umDaLista(MOTIVOS_DA_RECUSA, value.motivo)
      const docId = value.docId === undefined ? undefined : ehIdDeDocumento(value.docId) ? value.docId : null
      if (motivo === undefined || docId === null) return null
      return { type: 'documento.recusado', motivo, ...(noMapaId === undefined ? {} : { noMapaId }), ...(docId === undefined ? {} : { docId }) }
    }
    default:
      return null
  }
}
