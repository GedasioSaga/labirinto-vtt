import { useEffect, useState } from 'react'
import type { CampanhaPublicada } from '../../net/nuvem/estadoNoDisco'
import { useNuvemStore, type CampanhaNoApp } from '../../stores/nuvemStore'
import { campanhaDaPasta } from './ponteDoLobby'

/**
 * O sistema foi junto na publicação (a `meta` da campanha guarda o sistema
 * publicado) e o site lê as fichas por ele. Vale para os dois lugares que
 * trocam o sistema universal: o Configurar pasta e a grade de sistemas de um
 * mapa que herda da pasta.
 */
export const SISTEMA_FIXO_NO_LOBBY = 'Esta pasta está publicada no Lobby: o site dos jogadores usa o sistema que foi junto na publicação, então ele não muda mais por aqui.'

export interface PastaPublicada {
  /** A pasta já está no Lobby: o sincronizador dela ligou, ou ela está na lista do disco. */
  publicada: boolean
  /** O sincronizador desta pasta, quando ligou. */
  campanhaLigada: CampanhaNoApp | undefined
  /** Acabou de publicar (a campanha entrou no disco, mas o sincronizador pode não ter ligado). */
  marcarPublicada: (campanha: CampanhaPublicada) => void
}

/**
 * Se a pasta já foi publicada, para as duas abas do Configurar pasta: a do
 * Lobby (publicar ou não) e a do Sistema (o sistema fica fixo depois de
 * publicar, porque o site dos jogadores usa o que foi junto). O disco
 * (`<appData>/nuvem/campanhas.json`) vale mesmo quando o sincronizador não
 * ligou; fora do app, nada está publicado. `null` = não há pasta a conferir
 * (o mapa não herda de nenhuma): nunca publicada, sem ler o disco.
 */
export function usePastaPublicada(pastaId: string | null): PastaPublicada {
  const campanhaLigada = useNuvemStore((state) => (pastaId === null ? undefined : Object.values(state.campanhas).find((campanha) => campanha.pastaId === pastaId)))
  // A leitura guarda de que pasta ela é: trocar de pasta não herda o "publicada" da anterior.
  const [noDisco, setNoDisco] = useState<{ pastaId: string; campanha: CampanhaPublicada | null } | null>(null)

  useEffect(() => {
    if (pastaId === null) return
    let vivo = true
    campanhaDaPasta(pastaId).then(
      (achada) => {
        if (vivo) setNoDisco({ pastaId, campanha: achada })
      },
      () => undefined,
    )
    return () => {
      vivo = false
    }
  }, [pastaId, campanhaLigada?.campanhaId])

  const publicadaNoDisco = pastaId !== null && noDisco !== null && noDisco.pastaId === pastaId && noDisco.campanha !== null
  return {
    publicada: campanhaLigada !== undefined || publicadaNoDisco,
    campanhaLigada,
    marcarPublicada: (campanha) => {
      if (pastaId !== null) setNoDisco({ pastaId, campanha })
    },
  }
}
