import { useEffect, useRef, useState } from 'react'
import { DiceFeed, type DiceFeedRoll } from '../components/DiceControls'
import { foraDeCampoDeTexto } from './playerMeasure'

/** Quanto tempo a rolagem fica no canto: o mesmo prazo do aviso `info` do app (`stores/toastStore.ts`). */
export const ROLAGEM_NO_CANTO_MS = 4000

const NENHUMA: ReadonlySet<string> = new Set()

/**
 * DADO ROLADO NA SALA, o selo do canto da tela do jogador: cada rolagem que
 * chega fica `ROLAGEM_NO_CANTO_MS` e sai sozinha, como os avisos do app. O
 * clique no selo e o Escape (fora de campo de texto) tiram as que estão na
 * tela. Antes o selo ficava até a janela fechar. A lista (`role="log"`) segue
 * na tela mesmo vazia: a região viva que nasce com a primeira rolagem nem
 * sempre é anunciada. As rolagens da mesa continuam inteiras na aba Dados.
 */
export function RolagensDoCanto({ rolls }: { rolls: readonly DiceFeedRoll[] }) {
  const [saidas, setSaidas] = useState<ReadonlySet<string>>(NENHUMA)
  /** Prazo de cada rolagem já vista (o id fica depois de vencer: a rolagem que saiu não volta). */
  const prazos = useRef(new Map<string, ReturnType<typeof setTimeout> | null>())

  const tirar = (ids: readonly string[]) => {
    if (ids.length === 0) return
    setSaidas((antes) => {
      // O prazo que vence depois do clique não refaz a lista.
      const novas = ids.filter((id) => !antes.has(id))
      if (novas.length === 0) return antes
      const depois = new Set(antes)
      for (const id of novas) depois.add(id)
      return depois
    })
  }

  useEffect(() => {
    const naLista = new Set(rolls.map((roll) => roll.id))
    for (const roll of rolls) {
      if (prazos.current.has(roll.id)) continue
      prazos.current.set(
        roll.id,
        setTimeout(() => {
          prazos.current.set(roll.id, null)
          tirar([roll.id])
        }, ROLAGEM_NO_CANTO_MS),
      )
    }
    // A rolagem que saiu da lista da mesa não volta: o prazo e a saída dela são esquecidos.
    for (const [id, prazo] of prazos.current) {
      if (naLista.has(id)) continue
      if (prazo !== null) clearTimeout(prazo)
      prazos.current.delete(id)
    }
    setSaidas((antes) => {
      const ficam = [...antes].filter((id) => naLista.has(id))
      return ficam.length === antes.size ? antes : new Set(ficam)
    })
  }, [rolls])

  useEffect(() => {
    const deste = prazos.current
    return () => {
      for (const prazo of deste.values()) if (prazo !== null) clearTimeout(prazo)
      // Remontar (o modo estrito do React) agenda de novo as que ainda estão na tela.
      deste.clear()
    }
  }, [])

  const naTela = rolls.filter((roll) => !saidas.has(roll.id))
  const algumaNaTela = naTela.length > 0
  /** As que estão na tela agora, para o Escape sem religar o ouvinte a cada rolagem. */
  const naTelaRef = useRef<readonly string[]>([])
  naTelaRef.current = naTela.map((roll) => roll.id)

  useEffect(() => {
    if (!algumaNaTela) return
    const aoTeclar = (event: KeyboardEvent) => {
      // No campo de texto (o chat, o modificador do dado), o Escape é da edição.
      if (event.key !== 'Escape' || !foraDeCampoDeTexto(event.target)) return
      tirar(naTelaRef.current)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [algumaNaTela])

  return (
    // Só as linhas pegam o toque (player.css); o resto da caixa deixa o toque atravessar para o mapa.
    <div className="pp-rolagens" onClick={() => tirar(naTelaRef.current)}>
      <DiceFeed rolls={naTela} className="pp-dice-feed" />
    </div>
  )
}
