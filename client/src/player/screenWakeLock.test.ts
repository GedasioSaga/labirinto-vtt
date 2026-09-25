/**
 * TELA NÃO APAGA: o guardião da Wake Lock da tela do jogador, sem navegador.
 * O navegador vira um falso que entrega uma "trava" (sentinela) por pedido; a
 * página vira um alvo de eventos com `visibilityState` que o teste troca.
 */
import { describe, expect, it, vi } from 'vitest'
import { createScreenWakeLock, type VisibilitySource, type WakeLockSource } from './screenWakeLock'

class TravaFalsa extends EventTarget {
  released = false
  readonly release = vi.fn(async () => {
    if (this.released) return
    this.released = true
    this.dispatchEvent(new Event('release'))
  })
  /** O navegador solta sozinho (aba escondida, bateria fraca). */
  soltaPeloNavegador(): void {
    this.released = true
    this.dispatchEvent(new Event('release'))
  }
}

function navegadorFalso() {
  const travas: TravaFalsa[] = []
  const request = vi.fn(async (_type: 'screen') => {
    const trava = new TravaFalsa()
    travas.push(trava)
    return trava
  })
  const source: WakeLockSource = { request }
  return { source, request, travas }
}

class PaginaFalsa extends EventTarget implements VisibilitySource {
  visibilityState: DocumentVisibilityState = 'visible'
  mostra(): void {
    this.visibilityState = 'visible'
    this.dispatchEvent(new Event('visibilitychange'))
  }
  esconde(): void {
    this.visibilityState = 'hidden'
    this.dispatchEvent(new Event('visibilitychange'))
  }
}

/** Deixa as promessas pendentes (o pedido ao navegador) terminarem. */
async function assenta(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('createScreenWakeLock: a tela do celular não apaga durante a sessão', () => {
  it('ao entrar pede a tela acesa ao navegador e avisa que está ativa', async () => {
    const { source, request } = navegadorFalso()
    const guarda = createScreenWakeLock(source, new PaginaFalsa())
    const avisos = vi.fn()
    guarda.subscribe(avisos)
    expect(guarda.isActive()).toBe(false)

    guarda.start()
    await assenta()

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('screen')
    expect(guarda.isActive()).toBe(true)
    expect(avisos).toHaveBeenCalled()
  })

  it('ao sair solta a trava e deixa de estar ativa', async () => {
    const { source, travas } = navegadorFalso()
    const guarda = createScreenWakeLock(source, new PaginaFalsa())
    guarda.start()
    await assenta()

    guarda.stop()
    await assenta()

    expect(travas).toHaveLength(1)
    expect(travas[0]?.release).toHaveBeenCalledTimes(1)
    expect(guarda.isActive()).toBe(false)
  })

  it('navegador sem Wake Lock: não quebra e nunca fica ativa', async () => {
    const guarda = createScreenWakeLock(null, new PaginaFalsa())
    expect(() => guarda.start()).not.toThrow()
    await assenta()
    expect(guarda.isActive()).toBe(false)
    expect(() => guarda.stop()).not.toThrow()
  })

  it('navegador recusa (bateria fraca, sem permissão): falha em silêncio e fica inativa', async () => {
    const request = vi.fn(async (_type: 'screen'): Promise<TravaFalsa> => {
      throw new DOMException('recusado', 'NotAllowedError')
    })
    const guarda = createScreenWakeLock({ request }, new PaginaFalsa())
    guarda.start()
    await assenta()
    expect(request).toHaveBeenCalledTimes(1)
    expect(guarda.isActive()).toBe(false)
  })

  it('pedido que explode na hora (sem promessa) também falha em silêncio', () => {
    const request = vi.fn((_type: 'screen'): Promise<TravaFalsa> => {
      throw new TypeError('sem suporte')
    })
    const guarda = createScreenWakeLock({ request }, new PaginaFalsa())
    expect(() => guarda.start()).not.toThrow()
    expect(guarda.isActive()).toBe(false)
  })

  it('o navegador solta ao esconder a aba; ao voltar, pede de novo e volta a ficar ativa', async () => {
    const { source, request, travas } = navegadorFalso()
    const pagina = new PaginaFalsa()
    const guarda = createScreenWakeLock(source, pagina)
    guarda.start()
    await assenta()

    pagina.esconde()
    travas[0]?.soltaPeloNavegador()
    expect(guarda.isActive()).toBe(false)

    pagina.mostra()
    await assenta()
    expect(request).toHaveBeenCalledTimes(2)
    expect(guarda.isActive()).toBe(true)
  })

  it('aba escondida no momento de entrar: só pede quando a aba volta', async () => {
    const { source, request } = navegadorFalso()
    const pagina = new PaginaFalsa()
    pagina.visibilityState = 'hidden'
    const guarda = createScreenWakeLock(source, pagina)
    guarda.start()
    await assenta()
    expect(request).toHaveBeenCalledTimes(0)

    pagina.mostra()
    await assenta()
    expect(request).toHaveBeenCalledTimes(1)
    expect(guarda.isActive()).toBe(true)
  })

  it('depois de sair, voltar à aba não pede a tela acesa de novo', async () => {
    const { source, request } = navegadorFalso()
    const pagina = new PaginaFalsa()
    const guarda = createScreenWakeLock(source, pagina)
    guarda.start()
    await assenta()
    guarda.stop()

    pagina.esconde()
    pagina.mostra()
    await assenta()
    expect(request).toHaveBeenCalledTimes(1)
    expect(guarda.isActive()).toBe(false)
  })

  it('saiu antes do navegador responder: a trava que chega atrasada é solta na hora', async () => {
    const { source, travas } = navegadorFalso()
    const guarda = createScreenWakeLock(source, new PaginaFalsa())
    guarda.start()
    guarda.stop()
    await assenta()

    expect(travas).toHaveLength(1)
    expect(travas[0]?.release).toHaveBeenCalledTimes(1)
    expect(guarda.isActive()).toBe(false)
  })

  it('sai e entra de novo com o pedido no ar (StrictMode): um pedido só, e fica ativa', async () => {
    const { source, request, travas } = navegadorFalso()
    const guarda = createScreenWakeLock(source, new PaginaFalsa())
    guarda.start()
    guarda.stop()
    guarda.start()
    await assenta()

    expect(request).toHaveBeenCalledTimes(1)
    expect(travas[0]?.release).toHaveBeenCalledTimes(0)
    expect(guarda.isActive()).toBe(true)
  })
})
