/**
 * SONS AO VIVO, fatia F5 (contrato em `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`,
 * seção 2): a sala só serve `/sons/<id>` de dentro da pasta da aventura aberta,
 * e quem conta a pasta ao servidor é a ponte (`net_sons_aventura`): ao
 * registrar a rede, se a aba Sons já disse a pasta, e a cada troca dela. Sem
 * sala aberta não há a quem contar. A ponte é a de verdade; o transporte é falso.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createHostBridge } from './hostBridge'
import { informarPastaDosSons } from './ponteDosSons'

const ROOM = { code: 'P4STA1', urls: ['http://192.168.0.2:7777'], qrSvg: '<svg/>' }
const PASTA = 'C:/Aventuras/A Cripta'
const OUTRA = 'C:/Aventuras/O Farol'

function ponte(opcoes: { falhaNaPasta?: boolean; redeDosSons?: boolean } = {}) {
  const pastas: unknown[] = []
  const avisos: string[] = []
  const invoke = vi.fn(async (cmd: string, args?: unknown) => {
    if (cmd === 'net_start_room') return ROOM
    if (cmd === 'net_sons_aventura') {
      pastas.push(JSON.parse(JSON.stringify(args)))
      if (opcoes.falhaNaPasta === true) throw new Error('pasta recusada')
    }
    return undefined
  })
  const listen = vi.fn(async () => () => undefined)
  const mapa = createEmptyMap('m1', 'Mapa', 10, 10, 50)
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => mapa,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    toasts: {
      push: (_tipo, texto) => {
        avisos.push(texto)
        return `aviso-${avisos.length}`
      },
      dismiss: () => undefined,
      toasts: () => [],
    },
    ...(opcoes.redeDosSons === undefined ? {} : { redeDosSons: opcoes.redeDosSons }),
  })
  return { bridge, pastas, avisos }
}

afterEach(() => {
  informarPastaDosSons(null)
})

describe('hostBridge: a pasta da aventura vai ao servidor da sala (net_sons_aventura)', () => {
  it('a pasta já informada vai ao abrir a sala; a troca vai na hora; voltar a null revoga', async () => {
    informarPastaDosSons(PASTA)
    const m = ponte()
    expect(m.pastas).toEqual([])
    await m.bridge.start()
    expect(m.pastas).toEqual([{ pasta: PASTA }])
    informarPastaDosSons(PASTA)
    expect(m.pastas).toHaveLength(1)
    informarPastaDosSons(OUTRA)
    informarPastaDosSons(null)
    expect(m.pastas).toEqual([{ pasta: PASTA }, { pasta: OUTRA }, { pasta: null }])
  })

  it('sem pasta ao abrir, nada vai (o servidor começa sem pasta); a primeira pasta vai quando chega', async () => {
    const m = ponte()
    await m.bridge.start()
    expect(m.pastas).toEqual([])
    informarPastaDosSons(PASTA)
    expect(m.pastas).toEqual([{ pasta: PASTA }])
  })

  it('sala fechada: a troca de pasta não vai a lugar nenhum, e a próxima sala recebe a de agora', async () => {
    const m = ponte()
    await m.bridge.start()
    await m.bridge.stop()
    informarPastaDosSons(OUTRA)
    expect(m.pastas).toEqual([])
    await m.bridge.start()
    expect(m.pastas).toEqual([{ pasta: OUTRA }])
  })

  it('a Visão de jogador (ponte que não se registra) nunca conta a pasta', async () => {
    informarPastaDosSons(PASTA)
    const m = ponte({ redeDosSons: false })
    await m.bridge.start()
    informarPastaDosSons(OUTRA)
    expect(m.pastas).toEqual([])
  })

  it('o servidor recusou a pasta: o mestre fica sabendo (aviso), e nada quebra', async () => {
    informarPastaDosSons(PASTA)
    const m = ponte({ falhaNaPasta: true })
    await m.bridge.start()
    await vi.waitFor(() => expect(m.avisos.some((aviso) => aviso.startsWith('Os sons não vão tocar na mesa'))).toBe(true))
  })
})
