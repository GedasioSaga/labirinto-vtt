/**
 * ARRASTAR A LINHA DE UM ITEM PARA A CAMADA (fatia 8 de
 * `docs/planos/camadas-fase3-2026-10-22.md`): a linha da lista "Objetos do
 * mapa" vira arrastável (arrastar nativo do navegador) e a linha da camada no
 * painel recebe. O pacote do arrasto leva só o tipo e o id do item, num tipo
 * de dado próprio; o que chega de fora (outra janela, outro app) é lido com
 * desconfiança e, torto, não move nada.
 */
import type { CamadaId } from '../../types/map'
import type { SelectionKind } from '../../types/tools'
import { useMapStore } from '../../stores/mapStore'
import type { MapObjectKind } from '../mapObjects'
import { refsDaSelecao, type RefDeItem } from './mover'
import type { TipoDeObjeto } from './padrao'

/** O tipo de dado do arrasto: só a lista de camadas o aceita. */
export const TIPO_DO_ARRASTO = 'application/x-labirinto-item-do-mapa'

/** Teto do id lido do arrasto: os ids do mapa são curtos; mais que isto é lixo. */
const MAX_CARACTERES_DO_ID = 200

const TIPO_DA_ENTRADA: Record<MapObjectKind, TipoDeObjeto> = {
  token: 'ficha',
  door: 'parede',
  pin: 'pino',
  room: 'regiao',
  text: 'desenho',
}

const TIPOS_ACEITOS: ReadonlySet<string> = new Set<TipoDeObjeto>(Object.values(TIPO_DA_ENTRADA))

/** A linha da lista de objetos como ref de mover (a porta é a parede; a sala, a região; o texto, o desenho). */
export function refDaEntrada(entrada: { kind: MapObjectKind; id: string }): RefDeItem {
  return { tipo: TIPO_DA_ENTRADA[entrada.kind], id: entrada.id }
}

export function escreverArrasto(dados: DataTransfer, ref: RefDeItem): void {
  dados.setData(TIPO_DO_ARRASTO, JSON.stringify({ tipo: ref.tipo, id: ref.id }))
  dados.effectAllowed = 'move'
}

/** Durante o arrasto o navegador só mostra os TIPOS do pacote, não o conteúdo: basta para acender o alvo. */
export function temArrastoDeItem(dados: DataTransfer): boolean {
  return Array.from(dados.types).includes(TIPO_DO_ARRASTO)
}

/** O item do pacote, ou `null` se não for um pacote nosso bem formado. */
export function lerArrasto(dados: DataTransfer): RefDeItem | null {
  const bruto = dados.getData(TIPO_DO_ARRASTO)
  if (bruto === '' || bruto.length > MAX_CARACTERES_DO_ID * 2) return null
  let lido: unknown
  try {
    lido = JSON.parse(bruto)
  } catch {
    return null
  }
  if (typeof lido !== 'object' || lido === null || !('tipo' in lido) || !('id' in lido)) return null
  const { tipo, id } = lido
  if (typeof tipo !== 'string' || !TIPOS_ACEITOS.has(tipo) || typeof id !== 'string' || id === '' || id.length > MAX_CARACTERES_DO_ID) return null
  return { tipo: tipo as TipoDeObjeto, id } // as: `tipo` acabou de passar pela lista dos aceitos
}

/** Arrastou um item que está na seleção: vai a seleção inteira (um passo só); senão, só ele. */
export function refsDoArrasto(ref: RefDeItem, selection: readonly { kind: SelectionKind; id: string }[], pinoId: string | null): RefDeItem[] {
  const daSelecao = refsDaSelecao(selection, pinoId)
  return daSelecao.some((r) => r.tipo === ref.tipo && r.id === ref.id) ? daSelecao : [ref]
}

/** Soltou na linha da camada: o mesmo caminho da ficha e do menu (`mapStore.moverParaCamada`). */
export function soltarNaCamada(ref: RefDeItem, destino: CamadaId): void {
  const { selection, selectedPinId, moverParaCamada } = useMapStore.getState()
  moverParaCamada(refsDoArrasto(ref, selection, selectedPinId), destino)
}
