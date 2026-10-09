import { useEffect, useState, type ReactNode } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { resolverComBase, resolverSoEmbutida, type ResolverDeImagem } from '../lib/midia'
import { baseDaMidiaNoMestre, guardarDataUrl } from '../lib/midiaNoDisco'
import { iniciarMidiaDosPersonagens } from '../stores/midiaDosPersonagens'
import { ImagemDaMesa } from './ImagemDaMesa'

/**
 * MÍDIA DA MESA no app do mestre, montada uma vez em volta do `App`:
 *  - a tela busca a imagem por referência no disco, pela ponte de arquivos do
 *    Tauri (até a base chegar, só a embutida aparece);
 *  - a ficha de personagem que traz imagem embutida tem cada uma gravada como
 *    mídia (`iniciarMidiaDosPersonagens`), e o jogador passa a recebê-la por URL.
 * Fora do aplicativo (navegador) não há disco: nada disto liga, e a ficha
 * continua com a embutida.
 */
export function MidiaDoMestre({ children }: { children: ReactNode }) {
  const [resolver, setResolver] = useState<ResolverDeImagem>(() => resolverSoEmbutida)

  useEffect(() => {
    if (!isTauri()) return
    let vivo = true
    baseDaMidiaNoMestre().then(
      (base) => {
        if (vivo) setResolver(() => resolverComBase(base))
      },
      () => {
        // Sem a pasta de dados do app, a tela fica com as embutidas: as iniciais ocupam o lugar da imagem.
      },
    )
    const parar = iniciarMidiaDosPersonagens(guardarDataUrl)
    return () => {
      vivo = false
      parar()
    }
  }, [])

  return <ImagemDaMesa.Provider value={resolver}>{children}</ImagemDaMesa.Provider>
}
