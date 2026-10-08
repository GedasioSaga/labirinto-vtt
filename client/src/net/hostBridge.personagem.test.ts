/**
 * FICHA DE PERSONAGEM NA MESA, na ponte do mestre — as duas mãos ao vivo:
 *  - o jogador salva: a ponte grava pela `applyPersonagem` (a aventura do
 *    mestre), o mestre ouve "criou a ficha" e quem salvou recebe a confirmação;
 *  - o mestre grava pela janela dele: o broadcast leva a ficha nova SÓ ao dono.
 */
import { describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { Token } from '../types/map'
import { createHostBridge } from './hostBridge'
import type { AppliedPersonagem, HostWorld } from './hostSession'

const ROOM = { code: 'AB12CD', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const LUFFY: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'pers_luffy' }

const ficha = (id: string, name: string, characterId: string | null): Token => ({ id, characterId, name, x: 100, y: 100, size: 1, image: null })

interface Enviado {
  clientId: string
  msg: { type: string; [chave: string]: unknown }
}

function isEnviado(args: unknown): args is Enviado {
  if (typeof args !== 'object' || args === null) return false
  const msg: unknown = Reflect.get(args, 'msg')
  return typeof Reflect.get(args, 'clientId') === 'string' && typeof msg === 'object' && msg !== null && typeof Reflect.get(msg, 'type') === 'string'
}

async function salaComFichas() {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  // A "aventura" do mestre: o que a `applyPersonagem` grava e o que a janela dele grava.
  let personagens: readonly Personagem[] = [LUFFY]
  let tokens: Token[] = [ficha('tok-ana', 'Ana', LUFFY.id), ficha('tok-beto', 'Beto', null)]
  const mapa = () => ({ ...createEmptyMap('m1', 'Navio', 20, 20, 50), tokens })
  const getWorld = (): HostWorld => ({ open: { sceneId: 'cena-1', name: 'Navio', map: mapa() }, background: [], rpg: { sistema: SISTEMA_ONE_PIECE, personagens } })
  const applyPersonagem = vi.fn((aplicado: AppliedPersonagem) => {
    const { personagem, ligarTokenId } = aplicado
    personagens = personagens.some((p) => p.id === personagem.id) ? personagens.map((p) => (p.id === personagem.id ? personagem : p)) : [...personagens, personagem]
    if (ligarTokenId !== undefined) tokens = tokens.map((t) => (t.id === ligarTokenId ? { ...t, characterId: personagem.id } : t))
  })
  const toasts: string[] = []
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: mapa,
    getWorld,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    applyPersonagem,
    toasts: {
      push: (_kind, text) => {
        toasts.push(text)
        return `t${toasts.length}`
      },
      dismiss: () => {},
      toasts: () => [],
    },
    broadcastThrottleMs: 0,
    now: () => 0,
  })
  await bridge.start()
  const emit = (payload: unknown) => handlers.get('net:message')?.({ payload })
  emit({ clientId: 'c1', msg: { type: 'join', code: ROOM.code, name: 'Ana' } })
  emit({ clientId: 'c2', msg: { type: 'join', code: ROOM.code, name: 'Beto' } })
  const [ana, beto] = bridge.players()
  if (ana === undefined || beto === undefined) throw new Error('os dois deveriam estar na sala')
  bridge.assignToken(ana.playerId, 'tok-ana')
  bridge.assignToken(beto.playerId, 'tok-beto')
  await vi.waitFor(() => expect(enviados().some((e) => e.clientId === 'c1' && e.msg.type === 'personagens')).toBe(true))
  invoke.mockClear()
  function enviados(): Enviado[] {
    return invoke.mock.calls.filter((call) => call[0] === 'net_send').map((call) => call[1]).filter(isEnviado)
  }
  const deTipo = (clientId: string, type: string) => enviados().filter((e) => e.clientId === clientId && e.msg.type === type)
  return {
    bridge,
    emit,
    deTipo,
    applyPersonagem,
    toasts,
    personagens: () => personagens,
    mestreGrava: (personagem: Personagem) => {
      personagens = personagens.map((p) => (p.id === personagem.id ? personagem : p))
      bridge.notifyMapChanged()
    },
  }
}

describe('hostBridge: ficha de personagem nas duas mãos', () => {
  it('jogador -> mestre: a Ana salva a Força, a aventura do mestre grava e a Ana recebe a ficha e o ok', async () => {
    const t = await salaComFichas()
    t.emit({ clientId: 'c1', msg: { type: 'personagem.editar', reqId: 'p1', personagemId: LUFFY.id, partes: { atributos: { forca: 45 } } } })
    await vi.waitFor(() => expect(t.deTipo('c1', 'personagem.resultado')).toHaveLength(1))
    expect(t.applyPersonagem).toHaveBeenCalledTimes(1)
    expect(t.personagens().find((p) => p.id === LUFFY.id)?.atributos.forca).toBe(45)
    expect(t.deTipo('c1', 'personagem.resultado')[0]?.msg).toEqual({ type: 'personagem.resultado', reqId: 'p1', ok: true })
    // A ficha nova foi com a resposta, uma vez só: o broadcast que segue a gravação não a repete.
    expect(t.deTipo('c1', 'personagens')).toHaveLength(1)
    // O Beto não fica sabendo de nada.
    expect(t.deTipo('c2', 'personagens')).toEqual([])
  })

  it('mestre -> jogador: o mestre grava a descrição do Luffy e só a Ana recebe, ao vivo', async () => {
    const t = await salaComFichas()
    t.mestreGrava({ ...LUFFY, descricao: 'Capitão dos Chapéus de Palha.' })
    await vi.waitFor(() => expect(t.deTipo('c1', 'personagens')).toHaveLength(1))
    const [chegou] = t.deTipo('c1', 'personagens')
    expect(JSON.stringify(chegou?.msg)).toContain('Capitão dos Chapéus de Palha.')
    expect(t.deTipo('c2', 'personagens')).toEqual([])
  })

  it('o Beto cria a ficha dele: a ponte grava, liga a ficha e avisa o mestre', async () => {
    const t = await salaComFichas()
    t.emit({ clientId: 'c2', msg: { type: 'personagem.criar', reqId: 'p1', tokenId: 'tok-beto' } })
    await vi.waitFor(() => expect(t.deTipo('c2', 'personagem.resultado')).toHaveLength(1))
    const criado = t.applyPersonagem.mock.calls[0]?.[0]
    expect(criado?.ligarTokenId).toBe('tok-beto')
    expect(t.toasts).toContain('Beto criou a ficha de personagem Beto.')
    // A Ana não recebe a ficha nova do Beto.
    expect(t.deTipo('c1', 'personagens')).toEqual([])
  })
})
