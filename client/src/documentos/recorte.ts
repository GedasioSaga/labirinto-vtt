/**
 * O PAPEL NO CHÃO PARA O JOGADOR (plano §2.3). De cada `DocumentoNoMapa` sai
 * só `{ id, x, y, piso, papel, titulo }`, montado por LISTA BRANCA: nada do
 * texto, do `docId`, do objeto onde ele está nem de quem pegou. O papel já
 * pego com "some depois de pego" não sai para ninguém.
 *
 * O título e o papel moram na biblioteca do app, e não no mapa: o host passa
 * o que precisa (`papeisDaBiblioteca`) ao recorte (`lib/fogFilter.ts`, campo
 * `papeis`). Sem ele, ou com o documento apagado da biblioteca, o papel não
 * sai (falha fechada).
 */
import { pontoDoDesafio } from '../lib/desafios'
import type { Prop, RegionPoint } from '../types/map'
import type { Documento, DocumentoNoMapa, PapelDoDocumento, PapelNoChao } from './tipos'

/** O que o chão precisa de cada documento da biblioteca. */
export interface PapelNaBiblioteca {
  titulo: string
  papel: PapelDoDocumento
}

/** Pelo `Documento.id`. */
export type PapeisDosDocumentos = ReadonlyMap<string, PapelNaBiblioteca>

/** Só o título e o papel de cada documento: o resto da biblioteca não entra no recorte nem por engano. */
export function papeisDaBiblioteca(documentos: readonly Pick<Documento, 'id' | 'titulo' | 'papel'>[]): PapeisDosDocumentos {
  return new Map(documentos.map((documento) => [documento.id, { titulo: documento.titulo, papel: documento.papel }]))
}

/** O papel saiu do mapa para todos: "some depois de pego", e alguém já pegou. */
export function sumiuDoMapa(documento: Pick<DocumentoNoMapa, 'depois' | 'pego'>): boolean {
  return documento.depois === 'some' && documento.pego !== undefined
}

/** As regras do recorte que o chão segue (as mesmas do selo do desafio, `lib/fogFilter.ts`). */
export interface RegrasDoChao {
  /** Os objetos do piso deste recorte: o papel posto num objeto fica no ponto dele. */
  props: readonly Prop[]
  /** O piso do grupo que olha. */
  piso: number
  /** O objeto chega a este jogador? O papel num objeto que não chega não sai: contaria que o objeto existe. */
  objetoChega: (propId: string) => boolean
  /** O ponto está à vista dele agora? */
  aVista: (ponto: RegionPoint) => boolean
}

export function papeisNoChao(documentos: readonly DocumentoNoMapa[] | undefined, papeis: PapeisDosDocumentos | undefined, regras: RegrasDoChao): PapelNoChao[] {
  if (documentos === undefined || papeis === undefined) return []
  const noChao: PapelNoChao[] = []
  for (const documento of documentos) {
    if (sumiuDoMapa(documento)) continue
    const daBiblioteca = papeis.get(documento.docId)
    if (daBiblioteca === undefined) continue
    if (documento.lugar.tipo === 'objeto' && !regras.objetoChega(documento.lugar.propId)) continue
    const ponto = pontoDoDesafio(documento, regras.props)
    if (ponto === null || (ponto.piso ?? 0) !== regras.piso || !regras.aVista(ponto)) continue
    noChao.push({
      id: documento.id,
      x: ponto.x,
      y: ponto.y,
      ...(ponto.piso === undefined || ponto.piso === 0 ? {} : { piso: ponto.piso }),
      papel: daBiblioteca.papel,
      titulo: daBiblioteca.titulo,
    })
  }
  return noChao
}
