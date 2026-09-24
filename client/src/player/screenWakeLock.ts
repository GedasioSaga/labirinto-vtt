import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * TELA NÃO APAGA: enquanto o jogador está na sessão, o celular não pode
 * apagar a tela no meio da cena — o mapa é o tabuleiro dele. A Wake Lock API
 * pede isso ao navegador; onde ela não existe (navegador antigo, página fora
 * de contexto seguro), nada acontece e a sessão segue como sempre.
 *
 * O navegador SOLTA a trava sozinho quando a aba some (troca de app, tela
 * bloqueada) e não a devolve ao voltar: quem quer a tela acesa pede de novo
 * no `visibilitychange`. Por isso o guardião guarda o "quero" separado do
 * "tenho".
 */

/** O pedaço da trava que o guardião usa. O `WakeLockSentinel` do navegador cabe aqui. */
export interface WakeLockSentinelLike {
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
  removeEventListener(type: 'release', listener: () => void): void
}

/** Quem entrega a trava: o `navigator.wakeLock` do navegador, ou um falso no teste. */
export interface WakeLockSource {
  request(type: 'screen'): Promise<WakeLockSentinelLike>
}

/** A página: saber se está à vista e ouvir quando volta. O `document` cabe aqui. */
export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

export interface ScreenWakeLock {
  /** Passa a querer a tela acesa (e pede já, se a página estiver à vista). */
  start(): void
  /** Não quer mais: solta a trava que tiver, e a que ainda estiver a caminho. */
  stop(): void
  /** A tela está, agora, travada acesa. */
  isActive(): boolean
  subscribe(listener: () => void): () => void
}

/** Recusa ou falta de suporte não é erro para o jogador: a tela só pode apagar como antes. */
function ignore(): void {}

export function createScreenWakeLock(source: WakeLockSource | null, page: VisibilitySource): ScreenWakeLock {
  let wanted = false
  let pending = false
  let sentinel: WakeLockSentinelLike | null = null
  let active = false
  const listeners = new Set<() => void>()

  function setActive(next: boolean): void {
    if (active === next) return
    active = next
    for (const listener of listeners) listener()
  }

  function onRelease(): void {
    // O navegador soltou (aba escondida, bateria): a trava morreu, e o "quero" continua.
    sentinel?.removeEventListener('release', onRelease)
    sentinel = null
    setActive(false)
  }

  function acquire(): void {
    if (!wanted || source === null || sentinel !== null || pending) return
    // Pedir com a aba escondida é recusado; o `visibilitychange` pede quando ela voltar.
    if (page.visibilityState !== 'visible') return
    let request: Promise<WakeLockSentinelLike>
    try {
      request = source.request('screen')
    } catch {
      return
    }
    pending = true
    request.then(
      (granted) => {
        pending = false
        if (!wanted) {
          // Saiu da sessão antes do navegador responder: a trava chega e sai na hora.
          granted.release().catch(ignore)
          return
        }
        sentinel = granted
        granted.addEventListener('release', onRelease)
        setActive(true)
      },
      () => {
        pending = false
        setActive(false)
      },
    )
  }

  function onVisibility(): void {
    if (page.visibilityState === 'visible') acquire()
  }

  return {
    start() {
      if (wanted) return
      wanted = true
      page.addEventListener('visibilitychange', onVisibility)
      acquire()
    },
    stop() {
      if (!wanted) return
      wanted = false
      page.removeEventListener('visibilitychange', onVisibility)
      const held = sentinel
      sentinel = null
      if (held !== null) {
        held.removeEventListener('release', onRelease)
        held.release().catch(ignore)
      }
      setActive(false)
    },
    isActive: () => active,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** A Wake Lock do navegador, ou `null` onde ela não existe (fora de contexto seguro, navegador antigo). */
function browserWakeLock(): WakeLockSource | null {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return null
  // O lib.dom declara `wakeLock` sempre presente; em HTTP comum ele vem `undefined`.
  const wakeLock: WakeLock | undefined = navigator.wakeLock
  return wakeLock ?? null
}

/**
 * Mantém a tela acesa enquanto `wanted` for verdadeiro e devolve se ela está,
 * de fato, travada acesa agora (para o selo "Tela acesa").
 */
export function useScreenWakeLock(wanted: boolean): boolean {
  const [keeper] = useState(() => createScreenWakeLock(browserWakeLock(), document))
  const active = useSyncExternalStore(keeper.subscribe, keeper.isActive)
  useEffect(() => {
    if (!wanted) return
    keeper.start()
    return () => keeper.stop()
  }, [keeper, wanted])
  return active
}
