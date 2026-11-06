import { useEffect, useState } from 'react'
import type { CampanhaPublicada } from '../../net/nuvem/estadoNoDisco'
import { useNuvemStore, type CampanhaNoApp } from '../../stores/nuvemStore'
import { campanhaDaPasta } from './ponteDoLobby'

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
 * ligou; fora do app, nada está publicado.
 */
export function usePastaPublicada(pastaId: string): PastaPublicada {
  const campanhaLigada = useNuvemStore((state) => Object.values(state.campanhas).find((campanha) => campanha.pastaId === pastaId))
  const [noDisco, setNoDisco] = useState<CampanhaPublicada | null>(null)

  useEffect(() => {
    let vivo = true
    campanhaDaPasta(pastaId).then(
      (achada) => {
        if (vivo) setNoDisco(achada)
      },
      () => undefined,
    )
    return () => {
      vivo = false
    }
  }, [pastaId, campanhaLigada?.campanhaId])

  return { publicada: campanhaLigada !== undefined || noDisco !== null, campanhaLigada, marcarPublicada: setNoDisco }
}
