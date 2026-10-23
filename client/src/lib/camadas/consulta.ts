/**
 * UM PONTO SÓ para perguntar sobre camadas (`docs/planos/camadas-fase3-2026-10-22.md`,
 * "Interação, jogador e rede"): em que camada está o item, o mestre vê, os
 * jogadores veem, está travada, que opacidade tem, em que ordem vêm, e se o
 * item pode ser mexido. Render, hit-test, recorte do jogador e painel
 * perguntam aqui em vez de ler `hiddenLayers` e cia. cada um do seu jeito.
 *
 * Mapa de antes (sem `versaoDasCamadas`): Chão segue o olho e o cadeado de
 * Salas e Desenhos segue os de Anotações — é o que a tela já fazia
 * (`PixiCanvas`: chão some com 'salas'; `drawingLayer` põe todo desenho em
 * 'anotacoes'). `ocultasDoJogador` ausente = igual a `hiddenLayers`;
 * opacidade ausente = 1.
 */
import type { CamadaId, MapData } from '../../types/map'
import { canInteract, type Lockable } from '../itemTransform'
import { CAMADAS_PADRAO, camadaEscolhidaDe, camadaPadraoDe, ehCamadaId, ehCamadaPadrao, type ItemPorTipo, type TipoDeObjeto } from './padrao'

export interface ContextoDeCamadas {
  /** A camada do item: a escolhida, se existe; senão a padrão do tipo. */
  camadaDe<K extends TipoDeObjeto>(tipo: K, item: ItemPorTipo[K]): CamadaId
  /** O olho "Mestre vê". */
  mestreVe(id: CamadaId): boolean
  /** O olho "Jogadores veem". */
  jogadorVe(id: CamadaId): boolean
  /**
   * O olho "Jogadores veem" do ITEM: o da camada dele (`camadaDe`), MAS a
   * camada livre bem formada que está em `ocultasDoJogador` fica escondida
   * mesmo sem o modelo no mapa (ninguém copia ainda o modelo da aventura para
   * o mapa, e sem ele `camadaDe` cairia na padrão do tipo: falharia aberta).
   */
  jogadorVeItem<K extends TipoDeObjeto>(tipo: K, item: ItemPorTipo[K]): boolean
  travada(id: CamadaId): boolean
  /** Opacidade de 0 a 1, a mesma para mestre e jogadores. */
  alfa(id: CamadaId): number
  /** A lista de camadas, de baixo para cima (a ordem das faixas sai de `ordemDeRender`). */
  readonly ordem: readonly CamadaId[]
  /** Pode selecionar/mover: o item não está travado E a camada dele não está. */
  podeMexer<K extends TipoDeObjeto>(tipo: K, item: ItemPorTipo[K]): boolean
}

const memo = new WeakMap<MapData, ContextoDeCamadas>()

/** Memorizado pela referência do mapa: a store é imutável, então mapa novo = contexto novo. */
export function contextoDeCamadas(map: MapData): ContextoDeCamadas {
  const pronto = memo.get(map)
  if (pronto !== undefined) return pronto
  const novo = criarContexto(map)
  memo.set(map, novo)
  return novo
}

/** Só o que `canInteract` olha. Carimbo, linha e marcador não têm `locked`: contam como destravados. */
function trancaDoItem(item: object): Lockable {
  return 'locked' in item && typeof item.locked === 'boolean' ? { locked: item.locked } : {}
}

function criarContexto(map: MapData): ContextoDeCamadas {
  const legado = map.versaoDasCamadas !== 2
  // Mapa de antes: Chão e Desenhos não tinham estado próprio, seguiam Salas e Anotações.
  const efetiva = (id: CamadaId): CamadaId => {
    if (!legado) return id
    if (id === 'chao') return 'salas'
    if (id === 'desenhos') return 'anotacoes'
    return id
  }
  const ocultasDoMestre: ReadonlySet<string> = new Set<string>(map.hiddenLayers)
  const ocultasDoJogador: ReadonlySet<string> = map.ocultasDoJogador === undefined ? ocultasDoMestre : new Set<string>(map.ocultasDoJogador)
  const travadas: ReadonlySet<string> = new Set<string>(map.lockedLayers)
  const ordem: readonly CamadaId[] = map.modeloCamadas === undefined ? CAMADAS_PADRAO : map.modeloCamadas.ordem.map((c) => c.id)
  const livres: ReadonlySet<string> = new Set(ordem.filter((id) => !ehCamadaPadrao(id)))

  function camadaDe<K extends TipoDeObjeto>(tipo: K, item: ItemPorTipo[K]): CamadaId {
    const escolhida: unknown = camadaEscolhidaDe(tipo, item)
    // O arquivo pode trazer lixo no campo; camada livre apagada cai na padrão do tipo.
    if (ehCamadaId(escolhida) && (ehCamadaPadrao(escolhida) || livres.has(escolhida))) return escolhida
    return camadaPadraoDe(tipo, item)
  }

  function travada(id: CamadaId): boolean {
    return travadas.has(efetiva(id))
  }

  function jogadorVe(id: CamadaId): boolean {
    return !ocultasDoJogador.has(efetiva(id))
  }

  function jogadorVeItem<K extends TipoDeObjeto>(tipo: K, item: ItemPorTipo[K]): boolean {
    const escolhida: unknown = camadaEscolhidaDe(tipo, item)
    // Livre escondida dos jogadores falha FECHADA; a desconhecida que não está escondida segue a padrão do tipo.
    if (ehCamadaId(escolhida) && !ehCamadaPadrao(escolhida) && ocultasDoJogador.has(escolhida)) return false
    return jogadorVe(camadaDe(tipo, item))
  }

  return {
    camadaDe,
    mestreVe: (id) => !ocultasDoMestre.has(efetiva(id)),
    jogadorVe,
    jogadorVeItem,
    travada,
    alfa: (id) => {
      const valor = map.opacidadeDasCamadas?.[id]
      return valor === undefined || !Number.isFinite(valor) ? 1 : Math.min(1, Math.max(0, valor))
    },
    ordem,
    podeMexer: (tipo, item) => canInteract(trancaDoItem(item)) && !travada(camadaDe(tipo, item)),
  }
}
