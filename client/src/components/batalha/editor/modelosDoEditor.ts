import { GRUPOS_DOS_MODELOS_DA_ARMA, MODELOS_DA_ARMA, mecanicaDoModeloDaArma } from '../../../lib/batalha/mecanica/arma'
import type { MecanicaV1 } from '../../../lib/batalha/mecanica/modelo'
import { GRUPOS_DOS_MODELOS, MODELOS_PRONTOS, mecanicaDoModelo, mecanicaDoModeloNoCartao } from '../../../lib/batalha/mecanica/modelos'
import { GRUPOS_DOS_MODELOS_DE_ITEM, MODELOS_DE_ITEM, mecanicaDoModeloDeItem, ondeDoModeloDeItem } from '../../../lib/batalha/mecanica/modelosDeItem'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import type { CartaoDaFicha } from '../../../lib/personagem'
import type { EfeitoDoItem } from '../../../types/map'
import type { DoQueNoEditor } from './gravarNoCartao'

/**
 * "COMEÇAR DE UM MODELO" para cada coisa que o editor monta (ED7): os 22 da técnica, os 20 da arma
 * (ARMAS-FONTE-UNICA §5) e os 25 do item ("O que ele faz", SISTEMA.md §5.1), cada um nos grupos de
 * sempre. Quem aplica (com o aviso e o Ctrl+Z) é o editor.
 */
export interface ModeloNoEditor {
  id: string
  nome: string
  /** O que ele monta, numa frase (a dica do botão). */
  dica: string
  grupo: string
  /** A mecânica do modelo neste cartão: o da técnica aproveita o custo, a ação e o dano escritos; o da arma soma o que ela soma no Atacar. */
  montar: (ficha: FichaDaPrevia, cartao: CartaoDaFicha) => MecanicaV1
  /** A mecânica do modelo sozinho, para a linha curta da lista. */
  previa: (ficha: FichaDaPrevia) => MecanicaV1
  /** Só no item: onde o modelo vale (a granada, só na batalha). */
  onde?: EfeitoDoItem['onde']
}

export interface ModelosDoEditor {
  grupos: readonly { grupo: string; nome: string }[]
  modelos: readonly ModeloNoEditor[]
}

const DA_TECNICA: ModelosDoEditor = {
  grupos: GRUPOS_DOS_MODELOS,
  modelos: MODELOS_PRONTOS.map((modelo) => ({
    ...modelo,
    montar: (ficha, cartao) => mecanicaDoModeloNoCartao(modelo.id, ficha, cartao),
    previa: (ficha) => mecanicaDoModelo(modelo.id, ficha.sistema),
  })),
}

const DA_ARMA: ModelosDoEditor = {
  grupos: GRUPOS_DOS_MODELOS_DA_ARMA,
  modelos: MODELOS_DA_ARMA.map((modelo) => ({
    ...modelo,
    montar: (ficha, cartao) => mecanicaDoModeloDaArma(modelo.id, ficha.sistema, cartao),
    previa: (ficha) => mecanicaDoModeloDaArma(modelo.id, ficha.sistema),
  })),
}

const DO_ITEM: ModelosDoEditor = {
  grupos: GRUPOS_DOS_MODELOS_DE_ITEM,
  modelos: MODELOS_DE_ITEM.map((modelo) => ({
    ...modelo,
    montar: (ficha) => mecanicaDoModeloDeItem(modelo.id, ficha.sistema),
    previa: (ficha) => mecanicaDoModeloDeItem(modelo.id, ficha.sistema),
    onde: ondeDoModeloDeItem(modelo.id),
  })),
}

export function modelosDoEditor(doQue: DoQueNoEditor): ModelosDoEditor {
  return doQue === 'arma' ? DA_ARMA : doQue === 'item' ? DO_ITEM : DA_TECNICA
}
