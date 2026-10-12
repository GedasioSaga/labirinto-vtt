import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { DancaDoJogador } from '../../../player/estadoDaDanca'
import { useSomStore } from '../../../stores/somStore'
import { notasDaMusica } from '../coreografia'
import { MINIGAME_PADRAO } from '../tipos'
import { montarAudioDaDanca, type AudioDaDanca } from './audioDaDanca'
import { DancaOverlay, type AcoesDaDanca } from './DancaOverlay'
import type { AmbienteDoMotor } from './motor'

/**
 * TELA DA DANÇA no jsdom: o convite respeita o que o mestre permitiu e avisa
 * do som desligado, o Pronto chega à conexão, o encerramento fecha, o
 * desfecho mostra a mesa e o prêmio, e o teclado chega à partida.
 */

const PINO = 'pino-teste'
const EU = 'p-eu'
const BIA = 'p-bia'

/** Nó de áudio de mentira: aceita qualquer chamada e devolve a si mesmo (o jsdom não tem Web Audio). */
function noFalso(): object {
  const alvo = function nada() {}
  const proxy: object = new Proxy(alvo, {
    get: (_alvo, chave) => {
      if (chave === 'value' || chave === 'length') return 0
      if (chave === 'then') return undefined
      if (chave === 'getChannelData') return () => new Float32Array(0)
      if (chave === Symbol.toPrimitive) return () => 0
      return proxy
    },
    set: () => true,
    apply: () => proxy,
  })
  return proxy
}

/** O relógio do teste, parado: o toque cai exatamente onde o teste quer. */
const AGORA_MS = 1_000_000

/** Contexto de mentira: relógio parado em AGORA_MS, sem latência, sempre rodando. */
function audioFalso(): AudioDaDanca {
  const fixos: Record<string, unknown> = {
    state: 'running',
    sampleRate: 48000,
    outputLatency: 0,
    baseLatency: 0,
    getOutputTimestamp: () => ({ contextTime: AGORA_MS / 1000, performanceTime: AGORA_MS }),
    resume: () => Promise.resolve(),
    suspend: () => Promise.resolve(),
    close: () => Promise.resolve(),
  }
  const ctx = new Proxy(
    {},
    {
      get: (_alvo, chave) => {
        if (chave === 'currentTime') return AGORA_MS / 1000
        if (typeof chave === 'string' && chave in fixos) return fixos[chave]
        return () => noFalso()
      },
    },
  ) as unknown as AudioContext
  return montarAudioDaDanca(ctx, 1)
}

/** Sem laço de quadros: o teste anda o que precisa. */
const AMBIENTE_PARADO: AmbienteDoMotor = {
  agora: () => AGORA_MS,
  quadro: () => 0,
  cancelarQuadro: () => undefined,
  controles: () => [],
}

function convite(extra: Partial<DancaDoJogador['convite']> = {}): DancaDoJogador['convite'] {
  return {
    sessao: 's1',
    pinId: PINO,
    npc: MINIGAME_PADRAO.npc,
    fala: MINIGAME_PADRAO.fala,
    permitida: 'escolha',
    notaMin: 'B',
    premio: { tipo: 'item', texto: 'Chave de latão' },
    musica: { tipo: 'demo' },
    participantes: [
      { playerId: EU, nome: 'Gedasio' },
      { playerId: BIA, nome: 'Bia' },
    ],
    ...extra,
  }
}

function danca(extra: Partial<DancaDoJogador> = {}): DancaDoJogador {
  return { sessao: 's1', convite: convite(), pausada: false, colegas: [], placares: {}, fimEnviado: false, ...extra }
}

interface AcoesEspiadas {
  dancaPronto: Mock<AcoesDaDanca['dancaPronto']>
  dancaToques: Mock<AcoesDaDanca['dancaToques']>
  dancaFim: Mock<AcoesDaDanca['dancaFim']>
  fecharDanca: Mock<AcoesDaDanca['fecharDanca']>
}

function acoesFalsas(): AcoesEspiadas {
  return {
    dancaPronto: vi.fn<AcoesDaDanca['dancaPronto']>(() => true),
    dancaToques: vi.fn<AcoesDaDanca['dancaToques']>(() => true),
    dancaFim: vi.fn<AcoesDaDanca['dancaFim']>(() => true),
    fecharDanca: vi.fn<AcoesDaDanca['fecharDanca']>(),
  }
}

function armazemVazio(): Pick<Storage, 'getItem' | 'setItem'> {
  const dados = new Map<string, string>()
  return { getItem: (k) => dados.get(k) ?? null, setItem: (k, v) => void dados.set(k, v) }
}

describe('tela da dança do jogador', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    useSomStore.setState({ volume: 0.35, mudo: false })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  function montar(d: DancaDoJogador, acoes: AcoesDaDanca, criarAudio = vi.fn(() => audioFalso())): void {
    act(() => {
      root.render(<DancaOverlay danca={d} playerId={EU} acoes={acoes} criarAudio={criarAudio} armazem={armazemVazio()} ambiente={AMBIENTE_PARADO} />)
    })
  }

  const texto = (): string => document.body.textContent ?? ''
  const botao = (rotulo: string): HTMLButtonElement => {
    const achado = [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === rotulo)
    if (achado === undefined) throw new Error(`sem botão "${rotulo}"`)
    return achado
  }

  it('o convite trava o cartão que o mestre não permitiu e avisa quando o som da mesa está desligado', () => {
    useSomStore.setState({ mudo: true })
    montar(danca({ convite: convite({ permitida: 'expert' }) }), acoesFalsas())
    const radios = [...document.body.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    const diversao = radios.find((r) => r.value === 'diversao')
    const expert = radios.find((r) => r.value === 'expert')
    expect(diversao?.disabled).toBe(true)
    expect(diversao?.closest('label')?.dataset.travado).toBe('1')
    expect(expert?.checked).toBe(true)
    expect(texto()).toContain('O mestre deixou só a Expert.')
    expect(texto()).toContain('O som da mesa está desligado')
    act(() => botao('Ligar o som').click())
    expect(useSomStore.getState().mudo).toBe(false)
    expect(texto()).not.toContain('O som da mesa está desligado')
  })

  it('"Estou pronto" cria o áudio no gesto e manda o Pronto com a dificuldade escolhida', () => {
    const acoes = acoesFalsas()
    const criarAudio = vi.fn(() => audioFalso())
    montar(danca(), acoes, criarAudio)
    const expert = document.body.querySelector<HTMLInputElement>('input[value="expert"]')
    act(() => expert?.click())
    act(() => botao('Estou pronto').click())
    expect(criarAudio).toHaveBeenCalledTimes(1)
    expect(acoes.dancaPronto).toHaveBeenCalledWith('expert')
    // Com o Pronto aceito, a tela espera o mestre e mostra quem está pronto.
    montar(danca({ pronto: 'expert', estado: { fase: 'convite', participantes: [{ playerId: EU, status: 'pronto' }, { playerId: BIA, status: 'convidado' }] } }), acoes, criarAudio)
    expect(texto()).toContain('Esperando o mestre começar')
    expect(texto()).toContain('escolhendo')
  })

  it('o mestre encerrar mostra o aviso, e "Voltar ao mapa" fecha a dança', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const acoes = acoesFalsas()
    montar(danca({ encerrada: 'mestre' }), acoes)
    expect(texto()).toContain('O mestre encerrou a dança')
    expect(texto()).toContain('Nada foi ganho nem perdido.')
    act(() => botao('Voltar ao mapa').click())
    act(() => vi.advanceTimersByTime(200))
    expect(acoes.fecharDanca).toHaveBeenCalledTimes(1)
  })

  it('o desfecho mostra a mesa inteira e o prêmio deste jogador', () => {
    montar(
      danca({
        pronto: 'diversao',
        comecar: { emMs: 3000, recebidoEm: AGORA_MS - 200_000, participantes: [{ playerId: EU, nome: 'Gedasio', dificuldade: 'diversao' }, { playerId: BIA, nome: 'Bia', dificuldade: 'expert' }] },
        desfecho: {
          todosPassaram: true,
          portaAberta: true,
          mesa: [
            { playerId: EU, nome: 'Gedasio', letra: 'S', precisao: 0.97 },
            { playerId: BIA, nome: 'Bia', letra: 'A', precisao: 0.9 },
          ],
          seu: { passou: true, premio: { tipo: 'item', texto: 'Chave de latão' } },
        },
      }),
      acoesFalsas(),
    )
    expect(texto()).toContain('A porta se abriu')
    expect(texto()).toContain('Chave de latão foi para a sua mochila.')
    const linhas = [...document.body.querySelectorAll('.dz-mesa li')].map((li) => li.textContent)
    expect(linhas).toEqual(['VocêS97,0%', 'BiaA90,0%'])
  })

  it('o teclado chega à partida: a seta certa no tempo certo vira Perfeito e sai no lote para o mestre', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const acoes = acoesFalsas()
    const notas = notasDaMusica({ tipo: 'demo' }, 'diversao', PINO)
    const alvo = notas[3]
    // A música começou há `alvo.t` segundos: agora é a hora exata da quarta seta.
    const inicio = AGORA_MS - alvo.t * 1000
    const d = danca({ pronto: 'diversao', comecar: { emMs: 3000, recebidoEm: inicio - 3000, participantes: [{ playerId: EU, nome: 'Gedasio', dificuldade: 'diversao' }] } })
    montar(d, acoes)
    // O áudio nasce no gesto do Pronto; aqui o "Tocar a música" faz o papel do gesto.
    act(() => botao('Tocar a música').click())
    const mapa = vi.fn()
    document.addEventListener('keydown', mapa)
    const codigo = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'][alvo.lane]
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: codigo, bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keyup', { code: codigo, bubbles: true }))
    })
    document.removeEventListener('keydown', mapa)
    expect(document.body.querySelector('.dz-julg')?.textContent).toBe('Perfeito')
    // Tela modal: a tecla não chega ao mapa atrás.
    expect(mapa).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(260))
    expect(acoes.dancaToques).toHaveBeenCalled()
    const lote = acoes.dancaToques.mock.calls[0][0]
    expect(lote.eventos).toEqual([expect.objectContaining({ lane: alvo.lane, j: 'perfeito' })])
    expect(lote.placar.julgadas).toBe(1)
  })
})
