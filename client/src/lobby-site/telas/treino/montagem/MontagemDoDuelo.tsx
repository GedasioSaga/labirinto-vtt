import { useMemo } from 'react'
import type { LadoDoTreino } from '../../../../lib/treino/mesaEmMemoria'
import type { FichaDoSite } from '../../../dados/sessaoDaCampanha'
import { useDoSite } from '../../contexto'
import { MontagemNaGrade } from './MontagemNaGrade'
import { soAsQueExistem, type PecaDaMontagem, type PecaNaGrade } from './regrasDaMontagem'
import { fichasDaMontagem, naLargada, regrasDoDuelo } from './regrasDoDuelo'

/**
 * A MONTAGEM POR ARRASTO NO DUELO (pendência da fatia J): a mesma lista e a
 * mesma grade do treino, com as regras do duelo (`regrasDoDuelo.ts`): só os
 * seus personagens, só na sua metade, cada um uma vez, na casa de largada que
 * o servidor vai usar. O que sai daqui para o servidor é a ordem das fichas
 * (`fichasDaMontagem`), e é ela que decide a casa de cada um.
 */

function pecasDoDuelo(minhas: readonly FichaDoSite[]): PecaDaMontagem[] {
  return minhas.map((ficha) => ({
    id: ficha.doc.id,
    nome: ficha.doc.nome,
    retrato: ficha.doc.retrato,
    selo: ficha.doc.tipo === 'npc' ? 'npc' : 'jogador',
    origem: 'minha',
    detalhe: 'seu personagem',
  }))
}

/** A montagem com que o desafio (ou o aceite) abre: o seu primeiro personagem na largada. */
export function montagemInicialDoDuelo(minhas: readonly FichaDoSite[], lado: LadoDoTreino): PecaNaGrade[] {
  const primeira = pecasDoDuelo(minhas)[0]
  if (primeira === undefined) return []
  const feito = regrasDoDuelo(lado, '').porSemArrasto([], primeira)
  return feito.ok ? feito.lista : []
}

/**
 * As fichas que vão ao servidor, na ordem da montagem: só as que ainda são
 * suas e estão na mesa (uma que saiu da mesa no meio seria recusada).
 */
export function fichasDoPedido(lista: readonly PecaNaGrade[], minhas: readonly FichaDoSite[], lado: LadoDoTreino): { lista: PecaNaGrade[]; fichas: string[] } {
  const valida = naLargada(soAsQueExistem(lista, pecasDoDuelo(minhas)), lado)
  return { lista: valida, fichas: fichasDaMontagem(valida) }
}

export function MontagemDoDuelo({ minhas, lado, nomeDoOutro, lista, onMudar }: { minhas: readonly FichaDoSite[]; lado: LadoDoTreino; nomeDoOutro: string; lista: readonly PecaNaGrade[]; onMudar(lista: PecaNaGrade[]): void }) {
  const demo = useDoSite((site) => site.demo)
  const pecas = useMemo(() => pecasDoDuelo(minhas), [minhas])
  const regras = useMemo(() => regrasDoDuelo(lado, nomeDoOutro), [lado, nomeDoOutro])
  return <MontagemNaGrade pecas={pecas} lista={lista} onMudar={onMudar} demo={demo} regras={regras} />
}
