import { useEffect, useRef, useState } from 'react'
import { atualizarEspera, cenaQueEsperaMais, cenasOcupadas, ehAtalhoDaCenaQueEspera, type EsperaPorCena } from '../lib/cenaQueEspera'
import type { PartyMember } from '../lib/party'
import { useAdventureStore } from './adventureStore'
import { useToastStore } from './toastStore'

/**
 * atencao-do-mestre — liga a cena que espera (`lib/cenaQueEspera.ts`) ao
 * editor: cada cena com gente que o editor NÃO mostra guarda desde quando
 * espera (o que a lista Cenas mostra como 'há N min'), e o Ctrl+J abre a que
 * espera há mais tempo, centrada na ficha de quem está lá. Abrir a cena é o
 * que zera o relógio dela: `activeSceneId` muda e ela sai da espera.
 *
 * `atalhoLigado` é falso fora do editor (menu, tela de abertura): lá o Ctrl+J
 * não é nosso e fica com o navegador.
 */
export function useCenaQueEspera(members: readonly PartyMember[], activeSceneId: string | null, atalhoLigado: boolean): EsperaPorCena {
  // Chave estável: o efeito só roda quando a ocupação muda de fato, não a cada render.
  const occupiedKey = [...cenasOcupadas(members)].sort().join('\n')
  const [waitingSince, setWaitingSince] = useState<EsperaPorCena>(() => new Map())
  useEffect(() => {
    const occupied = new Set(occupiedKey === '' ? [] : occupiedKey.split('\n'))
    setWaitingSince((previous) => atualizarEspera(previous, occupied, activeSceneId, Date.now()))
  }, [occupiedKey, activeSceneId])

  // O atalho lê a mesa e o relógio DESTE render sem se re-registrar a cada um.
  const openWaitingSceneRef = useRef<() => void>(() => {})
  useEffect(() => {
    openWaitingSceneRef.current = () => {
      const target = cenaQueEsperaMais(waitingSince, members)
      if (target === null) {
        useToastStore.getState().push('info', 'Nenhuma cena esperando você')
        return
      }
      useAdventureStore.getState().goToPoint(target.sceneId, { x: target.x, y: target.y })
    }
  })
  useEffect(() => {
    if (!atalhoLigado) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const shortcut = {
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        targetTagName: target instanceof HTMLElement ? target.tagName : '',
        targetInputType: target instanceof HTMLInputElement ? target.type : undefined,
        targetContentEditable: target instanceof HTMLElement && target.isContentEditable,
      }
      if (!ehAtalhoDaCenaQueEspera(shortcut)) return
      // Ctrl+J no navegador abre os downloads: aqui a tecla é do mestre.
      event.preventDefault()
      openWaitingSceneRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [atalhoLigado])

  return waitingSince
}
