import { signalLabelForMaster } from '../lib/signals'
import { useToastStore } from '../stores/toastStore'
import type { HostSignal } from './hostSession'

/**
 * G6 — CHAMADO DE CENA DE FUNDO. O sinal de um jogador chega ao mestre por um
 * caminho só (`onSignal` da ponte), mas vale coisas diferentes conforme a
 * cena de onde veio:
 *   - da cena aberta no editor: o ping no mapa, como sempre;
 *   - de uma cena de FUNDO: o (x, y) é de outro mapa. Desenhado no editor,
 *     viraria um ping falso no lugar errado da cena aberta. Vira o aviso
 *     "<jogador> chamou em <cena>", com "Ir lá".
 *
 * Um aviso por jogador: o sinal seguinte do mesmo jogador troca o aviso
 * anterior DELE (texto e ponto novos), como o "entrou em" da ponte. Fica até
 * o mestre dispensar ou ir: é uma oferta de ação, e o mestre está de olho no
 * canvas de outra cena.
 */
export interface SignalRouterDeps {
  /** O ping no mapa aberto (a `signalStore`). Só recebe sinal da cena aberta. */
  drawPing: (signal: HostSignal) => void
  /** O bipe: vale para os dois casos — quem chama de longe também quer ser ouvido. */
  beep: () => void
  /** "Ir lá": abrir `sceneId` no editor com (`x`, `y`) no centro. */
  goTo: (sceneId: string, x: number, y: number) => void
}

export function createSignalRouter(deps: SignalRouterDeps): (signal: HostSignal) => void {
  const callToasts = new Map<string, string>()

  const announceCall = (signal: HostSignal, scene: { sceneId: string; name: string }) => {
    const previous = callToasts.get(signal.playerId)
    // `dismiss` de aviso que o mestre já fechou é no-op: não precisa checar.
    if (previous !== undefined) useToastStore.getState().dismiss(previous)
    const toastId = useToastStore.getState().push('info', `${signalLabelForMaster(signal.name, signal.tokenName)} chamou em ${scene.name}`, null, {
      actions: [{ label: 'Ir lá', run: () => deps.goTo(scene.sceneId, signal.x, signal.y) }],
    })
    callToasts.set(signal.playerId, toastId)
  }

  return (signal) => {
    if (signal.background === undefined) deps.drawPing(signal)
    else announceCall(signal, signal.background)
    deps.beep()
  }
}
