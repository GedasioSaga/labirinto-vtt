import { useToastStore } from '../stores/toastStore'
import type { AppliedTransfer } from './hostSession'

/**
 * atencao-do-mestre — o aviso "<jogador> entrou em <cena>", UM por cena.
 *
 * Antes era um cartão por jogador que só saía no ×: com sete jogadores, cinco
 * cartões cobriam o mapa até o mestre dispensar um a um (simulação de
 * 22/09/2026). Agora quem chega numa cena entra no cartão DELA ("Ana, Bruno e
 * Carla entraram em Porão"), com "Ir lá", e o cartão some sozinho — é notícia,
 * e a lista Cenas continua dizendo quem está onde.
 *
 * O cartão da cena é recriado a cada chegada (texto novo e prazo reiniciado).
 * Se ele já saiu da tela — o prazo venceu, o mestre fechou ou foi lá — a
 * próxima chegada recomeça a lista só com ela.
 */

/** Quanto o cartão de chegada fica na tela depois da última chegada à cena. */
export const CHEGADA_TOAST_MS = 30_000

/** Nomes listados por inteiro; além disso, "e mais N". */
const NOMES_POR_EXTENSO = 3

/** "Ana entrou em Porão", "Ana e Bruno entraram…", "Ana, Bruno, Carla e mais 2 entraram…". */
export function textoDeChegada(nomes: readonly string[], cena: string): string {
  const [primeiro] = nomes
  if (nomes.length === 1 && primeiro !== undefined) return `${primeiro} entrou em ${cena}`
  if (nomes.length > NOMES_POR_EXTENSO) {
    const mais = nomes.length - NOMES_POR_EXTENSO
    return `${nomes.slice(0, NOMES_POR_EXTENSO).join(', ')} e mais ${mais} entraram em ${cena}`
  }
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]} entraram em ${cena}`
}

interface Chegado {
  name: string
  x: number
  y: number
}

interface CartaoDaCena {
  toastId: string
  sceneName: string
  /** Por `playerId`, na ordem de chegada (o último é o mais recente). */
  chegados: Map<string, Chegado>
}

/**
 * Devolve a função que a ponte chama a cada viagem concluída. `goTo` ausente
 * = sem "Ir lá" (a ponte sem editor para onde ir).
 */
export function createArrivalAnnouncer(
  goTo: ((sceneId: string, x: number, y: number) => void) | undefined,
  duracaoMs: number = CHEGADA_TOAST_MS,
): (transfer: AppliedTransfer) => void {
  const cartoes = new Map<string, CartaoDaCena>()
  /** Em que cartão cada jogador está agora: `playerId` -> `sceneId`. */
  const cenaDe = new Map<string, string>()

  const naTela = (toastId: string): boolean => useToastStore.getState().toasts.some((toast) => toast.id === toastId)

  /** O cartão da cena, se ainda está na tela; o que saiu é esquecido. */
  const cartaoVivo = (sceneId: string): CartaoDaCena | undefined => {
    const cartao = cartoes.get(sceneId)
    if (cartao === undefined) return undefined
    if (naTela(cartao.toastId)) return cartao
    cartoes.delete(sceneId)
    return undefined
  }

  const mostrar = (sceneId: string, sceneName: string, chegados: Map<string, Chegado>) => {
    const ultimo = [...chegados.values()].at(-1)
    if (ultimo === undefined) return
    const nomes = [...chegados.values()].map((chegado) => chegado.name)
    const toastId = useToastStore
      .getState()
      .push(
        'info',
        textoDeChegada(nomes, sceneName),
        duracaoMs,
        goTo === undefined ? {} : { actions: [{ label: 'Ir lá', run: () => goTo(sceneId, ultimo.x, ultimo.y) }] },
      )
    cartoes.set(sceneId, { toastId, sceneName, chegados })
  }

  /** Quem seguiu viagem sai do cartão da cena anterior; cartão vazio some. */
  const tirarDoCartao = (sceneId: string, playerId: string) => {
    const cartao = cartaoVivo(sceneId)
    if (cartao === undefined || !cartao.chegados.has(playerId)) return
    useToastStore.getState().dismiss(cartao.toastId)
    cartoes.delete(sceneId)
    const restantes = new Map(cartao.chegados)
    restantes.delete(playerId)
    if (restantes.size > 0) mostrar(sceneId, cartao.sceneName, restantes)
  }

  return (transfer) => {
    const anterior = cenaDe.get(transfer.playerId)
    if (anterior !== undefined && anterior !== transfer.toSceneId) tirarDoCartao(anterior, transfer.playerId)

    const cartao = cartaoVivo(transfer.toSceneId)
    const chegados = new Map(cartao?.chegados ?? [])
    // Chegou de novo: vai para o fim da lista (é a chegada mais recente), sem repetir o nome.
    chegados.delete(transfer.playerId)
    chegados.set(transfer.playerId, { name: transfer.playerName, x: transfer.x, y: transfer.y })
    if (cartao !== undefined) useToastStore.getState().dismiss(cartao.toastId)
    mostrar(transfer.toSceneId, transfer.toSceneName, chegados)
    cenaDe.set(transfer.playerId, transfer.toSceneId)
  }
}
