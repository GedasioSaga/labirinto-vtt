/**
 * GRUPOS SALVOS (análise de 18/11/2026, seção 2.1): o grupo do Ctrl+G vivia só
 * na memória da sessão — fechou o app, a casa voltava a ser parede por parede —
 * e a cópia (Ctrl+D, Ctrl+V) saía solta. Agora o grupo mora no próprio mapa
 * (`MapData.grupos`, campo opcional): vai para o arquivo, volta com o Ctrl+Z e
 * acompanha a cópia.
 *
 * Módulo PURO: o arquivo, o mapa e a regra da cópia. A store
 * (`stores/mapStore.ts`) espelha `MapData.grupos` em `itemGroups[map.id]`, que
 * é o que o painel e o canvas leem.
 *
 * NUNCA VAI AO JOGADOR: a lista entrega o id de coisa que ele não vê. O recorte
 * (`lib/fogFilter.ts`) tira o campo.
 */
import type { MapData } from '../types/map'
import { NO_GROUPS, type ItemGroup, type ItemGroups } from './itemGroups'
import type { SelectionItem } from './selectionModel'
import { ehTipoDoEditor } from './tiposDoEditor'

/** Tetos de leitura: arquivo adulterado não enche a memória. Uma cena de verdade fica longe deles. */
const TETO_DE_GRUPOS = 2000
const TETO_DE_MEMBROS = 5000
const TAMANHO_MAXIMO_DO_ID = 120

/** Os grupos do mapa (ausente = nenhum). */
export function gruposDoMapa(map: Pick<MapData, 'grupos'>): ItemGroups {
  return map.grupos ?? NO_GROUPS
}

/** O mapa com estes grupos. Lista vazia TIRA o campo: o arquivo volta a ser o de um mapa sem grupo. Nada muda: o mesmo mapa. */
export function comGrupos(map: MapData, grupos: ItemGroups): MapData {
  if (grupos === map.grupos) return map
  if (grupos.length > 0) return { ...map, grupos }
  if (map.grupos === undefined) return map
  const { grupos: _semGrupos, ...resto } = map
  return resto
}

/** A chave de um item entre tipos: o mesmo id pode existir em dois tipos. */
export function chaveDoItem(item: SelectionItem): string {
  return `${item.kind}:${item.id}`
}

function ehId(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= TAMANHO_MAXIMO_DO_ID
}

function membroLido(valor: unknown): SelectionItem | null {
  if (typeof valor !== 'object' || valor === null || !('kind' in valor) || !('id' in valor)) return null
  const { kind, id } = valor
  if (typeof kind !== 'string' || !ehTipoDoEditor(kind) || !ehId(id)) return null
  return { kind, id }
}

/**
 * Leitura do arquivo, tolerante: o que não é grupo de verdade sai calado e o
 * resto fica. Sai o grupo sem id, de id repetido ou com menos de 2 membros
 * válidos; sai o membro de tipo desconhecido, sem id, repetido ou que já está
 * em outro grupo (cada item mora em no máximo um: `lib/itemGroups.ts`).
 * Campo ausente, torto ou sem grupo válido: nada (o mapa de antes abre igual).
 */
export function gruposDoArquivo(valor: unknown): Pick<MapData, 'grupos'> {
  if (!Array.isArray(valor)) return {}
  const brutos: readonly unknown[] = valor
  const grupos: ItemGroup[] = []
  const idsDeGrupo = new Set<string>()
  const jaEmGrupo = new Set<string>()
  for (const bruto of brutos.slice(0, TETO_DE_GRUPOS)) {
    if (typeof bruto !== 'object' || bruto === null || !('id' in bruto) || !('members' in bruto)) continue
    const { id, members } = bruto
    if (!ehId(id) || idsDeGrupo.has(id) || !Array.isArray(members)) continue
    const lidos: readonly unknown[] = members
    const membros: SelectionItem[] = []
    const chaves = new Set<string>()
    for (const lido of lidos.slice(0, TETO_DE_MEMBROS)) {
      const membro = membroLido(lido)
      if (membro === null) continue
      const chave = chaveDoItem(membro)
      if (chaves.has(chave) || jaEmGrupo.has(chave)) continue
      chaves.add(chave)
      membros.push(membro)
    }
    if (membros.length < 2) continue
    idsDeGrupo.add(id)
    for (const chave of chaves) jaEmGrupo.add(chave)
    grupos.push({ id, members: membros })
  }
  return grupos.length > 0 ? { grupos } : {}
}

/**
 * Os grupos das CÓPIAS de um lote (Ctrl+D, Ctrl+V): o grupo cujos membros que
 * ainda existem vieram TODOS no lote ganha um grupo novo, só com as cópias.
 * Copiar metade de um grupo dá itens soltos — a metade não é o grupo.
 *
 * `copiaDe`: chave do original (`chaveDoItem`) → a cópia dele. `existe`: o
 * membro ainda está no mapa de origem (membro apagado não segura o grupo).
 */
export function gruposDasCopias(
  grupos: ItemGroups,
  copiaDe: ReadonlyMap<string, SelectionItem>,
  existe: (membro: SelectionItem) => boolean,
  novoId: () => string,
): ItemGroup[] {
  const novos: ItemGroup[] = []
  for (const grupo of grupos) {
    const vivos = grupo.members.filter(existe)
    const copias: SelectionItem[] = []
    for (const membro of vivos) {
      const copia = copiaDe.get(chaveDoItem(membro))
      if (copia !== undefined) copias.push(copia)
    }
    if (copias.length < 2 || copias.length !== vivos.length) continue
    novos.push({ id: novoId(), members: copias })
  }
  return novos
}
