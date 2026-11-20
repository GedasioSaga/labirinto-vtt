/**
 * O QUE QUEM LÊ RECEBE (plano §2.3; o `montarNoFio` do protótipo dos extras).
 * Puro: o host chama na hora de cada leitura, com o documento da biblioteca e
 * os itens que a ficha de quem lê carrega agora. Quem pegar a lente depois e
 * reler pela lista passa a ler.
 *
 * É o ÚNICO lugar que lê o texto claro de um trecho protegido, e ele só entra
 * no que sai quando quem lê tem um dos itens do trecho. O resto sai montado
 * por LISTA BRANCA: nada de `trechos`, `dicaDe` nem datas, e nenhum campo que
 * o documento ganhe depois atravessa sozinho.
 */
import type { CarriedItem } from '../types/map'
import { ehIdDeTrecho } from './leitor'
import type { BlocoNoFio, Documento, DocumentoNoFio, ExtrasDoDocumento, PaginaDoDocumento, PaginaNoFio, SeloDoDocumento, TrechoProtegido } from './tipos'

/** A marca de um trecho protegido no texto da página (`{{cifra:c1}}`, `{{borrado:b1}}`). Nova a cada uso: a global guarda posição. */
function marcasDoTrecho(): RegExp {
  return /\{\{(cifra|borrado):([a-z0-9]{1,16})\}\}/g
}

/** As letras do embaralhado: as mesmas do protótipo dos extras. */
const LETRAS_DO_EMBARALHADO = 'abcdefghijlmnopqrstuvxz'

/** FNV-1a de 32 bits (o `hash` do protótipo dos extras): o mesmo texto dá sempre a mesma semente. */
export function sementeDoTexto(texto: string): number {
  let h = 0x811c9dc5
  for (const letra of texto) {
    h ^= letra.codePointAt(0) ?? 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** A semente de cada trecho sai do id do documento e do trecho, então o embaralhado é o mesmo a cada leitura. */
export function sementeDoTrecho(docId: string, trechoId: string): number {
  return sementeDoTexto(`${docId}:${trechoId}`)
}

/**
 * mulberry32: a sequência de números da semente (a mesma do protótipo). Serve
 * também ao desenho do papel (`documentos/desenhoDoPapel.ts`): bordas comidas,
 * manchas e cera saem iguais a cada abertura.
 */
export function sorteio(semente: number): () => number {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Letras ao acaso, do mesmo tamanho e com os mesmos espaços. NÃO é uma cifra
 * do claro: as letras saem só da semente, então não há como desfazer.
 */
export function embaralhar(texto: string, semente: number): string {
  const proxima = sorteio(semente)
  return [...texto].map((letra) => (/\s/.test(letra) ? letra : LETRAS_DO_EMBARALHADO[Math.floor(proxima() * LETRAS_DO_EMBARALHADO.length)])).join('')
}

/** Os `itemId` das mochilas de quem lê (a da ficha, a do boneco): o que abre um trecho cifrado. */
export function itensDeQuemLe(...mochilas: readonly (readonly Pick<CarriedItem, 'itemId'>[] | undefined)[]): Set<string> {
  const itens = new Set<string>()
  for (const mochila of mochilas) {
    for (const vaga of mochila ?? []) if (vaga.itemId !== undefined) itens.add(vaga.itemId)
  }
  return itens
}

/**
 * O documento como sai para quem lê. `itens`: os `itemId` que a ficha dele
 * carrega agora (`itensDeQuemLe`). Cada `{{borrado:ID}}` vira sempre o
 * embaralhado; cada `{{cifra:ID}}` vira o claro SÓ se `itens` tem uma das
 * `chaves` do trecho, e senão o `textoCifrado` do mestre (com `mostra` código
 * ou língua) ou o embaralhado. Marca sem trecho, ou de outro tipo, some do texto.
 */
export function documentoNoFio(documento: Documento, itens: ReadonlySet<string>): DocumentoNoFio {
  return {
    docId: documento.id,
    titulo: documento.titulo,
    papel: documento.papel,
    imagemDoPapel: documento.papel === 'imagem' ? documento.imagemDoPapel : null,
    extras: extrasNoFio(documento.extras),
    paginas: documento.paginas.map((pagina) => paginaNoFio(documento, pagina, itens)),
  }
}

function paginaNoFio(documento: Documento, pagina: PaginaDoDocumento, itens: ReadonlySet<string>): PaginaNoFio {
  const blocos: BlocoNoFio[] = []
  let ate = 0
  for (const marca of pagina.texto.matchAll(marcasDoTrecho())) {
    if (marca.index > ate) blocos.push({ t: 'texto', texto: pagina.texto.slice(ate, marca.index) })
    ate = marca.index + marca[0].length
    const bloco = blocoProtegido(documento, marca[1], marca[2], itens)
    if (bloco !== null) blocos.push(bloco)
  }
  if (ate < pagina.texto.length) blocos.push({ t: 'texto', texto: pagina.texto.slice(ate) })
  return { blocos, imagem: pagina.imagem }
}

function trechoDoDocumento(documento: Documento, id: string): TrechoProtegido | undefined {
  // `Object.hasOwn`: um id como "constructor" acharia o do protótipo do objeto, e não um trecho.
  return ehIdDeTrecho(id) && Object.hasOwn(documento.trechos, id) ? documento.trechos[id] : undefined
}

function blocoProtegido(documento: Documento, tipoDaMarca: string | undefined, id: string | undefined, itens: ReadonlySet<string>): BlocoNoFio | null {
  if (id === undefined) return null
  const trecho = trechoDoDocumento(documento, id)
  if (trecho === undefined || trecho.tipo !== tipoDaMarca) return null
  const semente = sementeDoTrecho(documento.id, id)
  if (trecho.tipo === 'borrado') return { t: 'protegido', id, tipo: 'borrado', texto: embaralhar(trecho.claro, semente), lido: false }
  const doMestre = trecho.mostra === 'embaralhado' ? '' : trecho.textoCifrado.trim()
  const cifrado = doMestre === '' ? embaralhar(trecho.claro, semente) : doMestre
  const com = trecho.chaves.find((itemId) => itens.has(itemId))
  if (com === undefined) return { t: 'protegido', id, tipo: 'cifra', mostra: trecho.mostra, texto: cifrado, lido: false }
  return { t: 'protegido', id, tipo: 'cifra', mostra: trecho.mostra, texto: trecho.claro, lido: true, com, antes: cifrado }
}

/** Os extras campo a campo: cópia nova, sem nenhuma chave que o objeto do mestre carregue a mais. */
function extrasNoFio(extras: ExtrasDoDocumento): ExtrasDoDocumento {
  const { desgaste, brasao } = extras
  return {
    letra: extras.letra,
    tinta: extras.tinta,
    desgaste: { cor: desgaste.cor, manchas: desgaste.manchas, bordaQueimada: desgaste.bordaQueimada, dobras: desgaste.dobras, rasgos: desgaste.rasgos },
    selo: seloNoFio(extras.selo),
    assinatura: extras.assinatura,
    brasao: brasao === null ? null : { arte: brasao.arte, imagem: brasao.imagem },
  }
}

function seloNoFio(selo: SeloDoDocumento | null): SeloDoDocumento | null {
  if (selo === null) return null
  return selo.tipo === 'cera' ? { tipo: 'cera', cor: selo.cor, arte: selo.arte } : { tipo: 'carimbo', cor: selo.cor, arte: selo.arte, texto: selo.texto }
}
