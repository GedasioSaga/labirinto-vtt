import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { useToastStore } from '../stores/toastStore'
import type { Pin, Token } from '../types/map'
import type { AppliedTransfer, HostWorld } from './hostSession'
import { createHostBridge } from './hostBridge'

/**
 * "VOLTO JÁ" do lado do mestre: o "Deixar ir" dado com o jogador fora da mesa
 * não pode ser engolido em silêncio. O mestre lê que a passagem ficou
 * esperando a volta, e a pergunta que reaparece na volta diz por quê.
 */

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const PERGUNTA = 'Ana quer passar por Escada que desce → Cripta'

/** Salão (aberto) com a ficha de Ana perto da escada; a Cripta de fundo. */
function mesa() {
  const naCripta = new Set<string>()
  const ficha = (id: string, name: string, x: number, y: number): Token => ({ id, characterId: null, name, x, y, size: 1, image: null })
  const escada = (id: string, x: number, y: number, description: string, sceneId: string, pinId: string): Pin => ({
    id,
    x,
    y,
    kind: 'viagem',
    description,
    image: null,
    destino: { sceneId, pinId },
  })
  const world = (): HostWorld => ({
    open: {
      sceneId: 'cena-a',
      name: 'Salão',
      map: {
        ...createEmptyMap('mapa-a', 'A', 40, 10, 50),
        tokens: naCripta.has('ficha-ana') ? [] : [ficha('ficha-ana', 'Ana', 200, 200)],
        pins: [escada('escada-a', 300, 200, 'Escada que desce', 'cena-b', 'escada-b')],
      },
    },
    background: [
      {
        sceneId: 'cena-b',
        name: 'Cripta',
        map: {
          ...createEmptyMap('mapa-b', 'B', 40, 10, 50),
          tokens: [...naCripta].map((id) => ficha(id, id, 1025, 275)),
          pins: [escada('escada-b', 1000, 250, 'Escada que sobe', 'cena-a', 'escada-a')],
        },
      },
    ],
  })
  const applyTransfer = vi.fn((transfer: AppliedTransfer) => {
    naCripta.add(transfer.tokenId)
    return true
  })
  return { world, applyTransfer }
}

async function anaPedeAEscada() {
  const m = mesa()
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => m.world().open.map,
    getWorld: m.world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyTransfer: m.applyTransfer,
    onPlayersChange: vi.fn(),
    now: () => 0,
  })
  const emit = (payload: unknown) => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload })
  }
  await bridge.start()
  emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  const ana = bridge.players().find((p) => p.name === 'Ana')
  if (ana === undefined) throw new Error('Ana deveria ter entrado')
  bridge.assignToken(ana.playerId, 'ficha-ana')
  // O "Ana entrou…" da chegada não é deste assunto: a tela começa limpa no pedido.
  useToastStore.setState({ toasts: [] })
  emit({ clientId: 'c1', msg: { type: 'pin.travel.request', pinId: 'escada-a' } })
  return { ...m, bridge, emit }
}

const textos = () => useToastStore.getState().toasts.map((t) => t.text)

/** Aperta um botão do aviso que tem `trecho` no texto, como o clique no Toast faz. */
function aperta(trecho: string, rotulo: string): void {
  const toast = useToastStore.getState().toasts.find((t) => t.text.includes(trecho))
  const acao = toast?.actions?.find((a) => a.label === rotulo)
  if (toast === undefined || acao === undefined) throw new Error(`sem "${rotulo}" no aviso "${trecho}": ${JSON.stringify(textos())}`)
  acao.run()
  useToastStore.getState().dismiss(toast.id)
}

describe('hostBridge: "Deixar ir" com o jogador no Volto já', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('o mestre lê que a passagem espera a volta; na volta a pergunta reaparece dizendo por quê, e aí a ficha passa', async () => {
    const { applyTransfer, emit } = await anaPedeAEscada()
    expect(textos()).toEqual([PERGUNTA])

    emit({ clientId: 'c1', msg: { type: 'away', away: true } })
    aperta(PERGUNTA, 'Deixar ir')

    // Nada passou, e o mestre SABE disso: um aviso diz que o "Deixar ir" esperou.
    expect(applyTransfer).not.toHaveBeenCalled()
    expect(textos()).toEqual(['Ana está no Volto já: o "Deixar ir" para Cripta espera a volta, e a pergunta volta aqui.'])

    emit({ clientId: 'c1', msg: { type: 'away', away: false } })
    // O aviso de espera sai, e a pergunta volta explicando que é a mesma.
    expect(textos()).toEqual(['Ana voltou do Volto já e ainda quer passar por Escada que desce → Cripta. O "Deixar ir" esperou a volta.'])

    aperta('Ana voltou do Volto já', 'Deixar ir')
    expect(applyTransfer).toHaveBeenCalledTimes(1)
    expect(applyTransfer).toHaveBeenCalledWith(expect.objectContaining({ tokenId: 'ficha-ana', toSceneId: 'cena-b' }))
    expect(textos()).toEqual(['Ana entrou em Cripta'])
  })

  it('expulsar quem está no Volto já tira o aviso de espera: não sobra promessa de pergunta', async () => {
    const { bridge, emit } = await anaPedeAEscada()
    emit({ clientId: 'c1', msg: { type: 'away', away: true } })
    aperta(PERGUNTA, 'Deixar ir')
    expect(textos()).toHaveLength(1)

    await bridge.kick('c1')
    expect(textos()).toEqual([])
  })

  it('controle: sair e voltar sem o mestre responder não repete a pergunta nem cria aviso de espera', async () => {
    const { emit } = await anaPedeAEscada()
    emit({ clientId: 'c1', msg: { type: 'away', away: true } })
    emit({ clientId: 'c1', msg: { type: 'away', away: false } })
    expect(textos()).toEqual([PERGUNTA])
  })
})
