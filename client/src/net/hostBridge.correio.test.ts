import { beforeEach, describe, expect, it, vi } from 'vitest'
import { agruparAvisos, deixarTodos } from '../components/caixaDeAvisos'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore, type ToastMessage } from '../stores/toastStore'
import type { Token } from '../types/map'
import type { HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * CORREIO DE BILHETES do lado do mestre: o bilhete vira um aviso que espera a
 * resposta dele — "Entregar" leva ao destinatário, "Interceptar" (ou o ×)
 * some com o bilhete, e ninguém além do destinatário recebe nada.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }

const ficha = (id: string, x: number): Token => ({ id, characterId: null, name: id, x, y: 100, size: 1, image: null })

/** Ana no Salão (aberto), Bruno na Cripta (de fundo). */
const world = (): HostWorld => ({
  open: { sceneId: 'cena-a', name: 'Salão', map: { ...createEmptyMap('mapa-a', 'A', 20, 10, 50), tokens: [ficha('ficha-ana', 100)] } },
  background: [{ sceneId: 'cena-b', name: 'Cripta', map: { ...createEmptyMap('mapa-b', 'B', 20, 10, 50), tokens: [ficha('ficha-bruno', 200)] } }],
})

async function mesa() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world().open.map,
    getWorld: world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  const sent = () => invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1])
  await bridge.start()
  const entra = (clientId: string, name: string, tokenId: string) => {
    emit({ clientId, msg: { type: 'join', code: ROOM.code, name } })
    const player = bridge.players().find((p) => p.name === name)
    if (player === undefined) throw new Error(`${name} deveria ter entrado`)
    bridge.assignToken(player.playerId, tokenId)
  }
  entra('c1', 'Ana', 'ficha-ana')
  entra('c2', 'Bruno', 'ficha-bruno')
  return { emit, sent }
}

function avisoDoBilhete(): ToastMessage {
  const aviso = useToastStore.getState().toasts.find((t) => t.grupo === 'Bilhetes')
  if (aviso === undefined) throw new Error('o bilhete deveria virar aviso do mestre')
  return aviso
}

function aperta(aviso: ToastMessage, label: string): void {
  const acao = aviso.actions?.find((a) => a.label === label)
  if (acao === undefined) throw new Error(`sem o botão ${label}`)
  acao.run()
}

describe('hostBridge: bilhete no aviso do mestre', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('o mestre lê quem, para quem, por onde e o texto, e responde Entregar ou Interceptar', async () => {
    const { emit } = await mesa()
    emit({ clientId: 'c1', msg: { type: 'letter.send', to: 'Bruno', via: 'pombo', text: 'No poço.' } })
    const aviso = avisoDoBilhete()
    expect(aviso.text).toBe('Ana → Bruno, pelo pombo: "No poço."')
    expect(aviso.kind).toBe('instrucao')
    expect(aviso.actions?.map((a) => a.label)).toEqual(['Entregar', 'Interceptar'])
  })

  it('Entregar: só Bruno recebe o bilhete, e o aviso sai', async () => {
    const { emit, sent } = await mesa()
    emit({ clientId: 'c1', msg: { type: 'letter.send', to: 'Bruno', via: 'pombo', text: 'No poço.' } })
    const antes = sent().length
    aperta(avisoDoBilhete(), 'Entregar')
    const depois = sent().slice(antes)
    expect(depois).toEqual([{ clientId: 'c2', msg: { type: 'scene.note', id: expect.any(String), text: 'No poço.', at: 0, from: 'Ana', via: 'pombo' } }])
    expect(useToastStore.getState().toasts.filter((t) => t.grupo === 'Bilhetes')).toEqual([])
  })

  it('Interceptar e o ×: nada sai para ninguém', async () => {
    const { emit, sent } = await mesa()
    emit({ clientId: 'c1', msg: { type: 'letter.send', to: 'Bruno', via: 'pombo', text: 'Primeiro.' } })
    const antes = sent().length
    aperta(avisoDoBilhete(), 'Interceptar')
    expect(sent().slice(antes)).toEqual([])

    // O segundo bilhete espera o intervalo mínimo do remetente: quem manda agora é Bruno.
    emit({ clientId: 'c2', msg: { type: 'letter.send', to: 'Ana', via: 'tubo', text: 'Segundo.' } })
    const aviso = avisoDoBilhete()
    const meio = sent().length
    aviso.onDismiss?.()
    useToastStore.getState().dismiss(aviso.id)
    expect(sent().slice(meio)).toEqual([])
    expect(JSON.stringify(sent())).not.toContain('Segundo.')
  })

  it('dois bilhetes viram a caixa "Bilhetes (2)" e o "Deixar todos" dela entrega os dois', async () => {
    const { emit, sent } = await mesa()
    emit({ clientId: 'c1', msg: { type: 'letter.send', to: 'Bruno', via: 'pombo', text: 'Da Ana.' } })
    emit({ clientId: 'c2', msg: { type: 'letter.send', to: 'Ana', via: 'tubo', text: 'Do Bruno.' } })
    const caixa = agruparAvisos(useToastStore.getState().toasts).find((item) => item.tipo === 'caixa')
    if (caixa === undefined || caixa.tipo !== 'caixa') throw new Error('dois bilhetes deveriam virar uma caixa')
    expect(caixa.grupo).toBe('Bilhetes')
    expect(caixa.toasts).toHaveLength(2)
    const antes = sent().length
    deixarTodos(caixa.toasts, useToastStore.getState().dismiss)
    expect(sent().slice(antes)).toEqual([
      { clientId: 'c2', msg: { type: 'scene.note', id: expect.any(String), text: 'Da Ana.', at: 0, from: 'Ana', via: 'pombo' } },
      { clientId: 'c1', msg: { type: 'scene.note', id: expect.any(String), text: 'Do Bruno.', at: 0, from: 'Bruno', via: 'tubo' } },
    ])
    expect(useToastStore.getState().toasts.filter((t) => t.grupo === 'Bilhetes')).toEqual([])
  })
})
