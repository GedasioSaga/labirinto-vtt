import { useMemo } from 'react'
import { limiteDeArmas } from '../../lib/batalha/leituraDaFicha'
import { acervoDaMochila } from '../../lib/mochila/acervoDaMochila'
import { ehRecusa, equiparNaMochila, guardarNaMochila, mochilaDesfeita } from '../../lib/mochila/armaNaMochila'
import { fichaComMochila } from '../../lib/mochila/juncao'
import type { Personagem } from '../../lib/personagem'
import { moedasDe } from '../../lib/troca'
import { useAcervoDeItensStore } from '../../stores/acervoDeItensStore'
import { mochilaMoraNaFicha, personagensAtivos, useAdventureStore } from '../../stores/adventureStore'
import { useToastStore } from '../../stores/toastStore'
import type { CarriedItem } from '../../types/map'
import { armasDaMochilaNoMenu } from './dadosDoMenu'
import type { MenuDaVezProps } from './MenuDaVez'

/**
 * Pendência do rework de itens (26/11/2026): o "Guardar" e o "Equipar" no pé do Atacar do mestre (a vez
 * do NPC), pelo mesmo caminho da mochila do mestre (`MochilaDoMestre`, alternarEquipado): as regras de
 * `lib/mochila/armaNaMochila.ts` e a gravação na ficha, a dona da mochila. Não gasta ação.
 * Na aventura que ainda não migrou a mochila (a dona é o boneco), o bloco não aparece: fica na mochila do token.
 */
export function useArmasDaMochilaDoMestre(personagem: Personagem | null): MenuDaVezProps['armasDaMochila'] {
  const mochilaNaFicha = useAdventureStore(mochilaMoraNaFicha)
  const itensDoAcervo = useAcervoDeItensStore((state) => state.itens)
  const acervo = useMemo(() => acervoDaMochila(itensDoAcervo), [itensDoAcervo])
  if (personagem === null || !mochilaNaFicha) return undefined
  const personagemId = personagem.id
  const dono = personagem.nome.trim() || 'o personagem'
  const mochilaDeAgora = (): CarriedItem[] => personagensAtivos(useAdventureStore.getState()).find((candidato) => candidato.id === personagemId)?.mochila ?? []
  const gravar = (mochila: CarriedItem[]): boolean => useAdventureStore.getState().ajustarPersonagem(personagemId, (atual) => fichaComMochila(atual, mochila, moedasDe(atual)))
  const onEquipar = (vagaId: string, equipar: boolean): void => {
    const antes = mochilaDeAgora()
    const nome = antes.find((vaga) => vaga.id === vagaId)?.nome ?? 'A arma'
    const nova = equipar ? equiparNaMochila(antes, vagaId, limiteDeArmas(personagem), dono, acervo) : guardarNaMochila(antes, vagaId)
    if (ehRecusa(nova)) {
      useToastStore.getState().push('error', nova.recusa)
      return
    }
    if (!gravar(nova)) {
      useToastStore.getState().push('error', 'Não deu para gravar a mochila.')
      return
    }
    useToastStore.getState().push('info', equipar ? `${nome} equipado em ${dono}.` : `${nome} guardado na mochila de ${dono}.`, undefined, {
      actions: [{ label: 'Desfazer', run: () => void gravar(mochilaDesfeita(mochilaDeAgora(), antes, nova)) }],
    })
  }
  return { armas: armasDaMochilaNoMenu(personagem, acervo), onEquipar }
}
