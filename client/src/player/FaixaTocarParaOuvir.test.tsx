/**
 * A FAIXINHA "TOQUE PARA OUVIR" (sons ao vivo, F5): aparece quando um som do
 * mestre espera o gesto e some quando nada mais espera. O toque nela tem de
 * destravar o áudio e preparar os `<audio>` de reserva DENTRO do próprio
 * clique, de forma síncrona: fora do gesto (num efeito, numa promessa, num
 * timer) o iOS não destrava nada. O instalador é o de verdade; a conexão e o
 * motor são de mentira (o motor só avisa "esperando" e "tocando").
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarElementoDeAudioFalso, type ElementoDeAudioFalso } from '../lib/sons/audioFalso.fixture'
import type { EventoDoMotor, MotorAoVivo } from '../lib/sons/aoVivo/motor'
import type { SomHostMessage } from '../net/protocol'
import { FaixaTocarParaOuvir } from './FaixaTocarParaOuvir'
import type { PlayerState } from './playerConnection'
import { criarReservaDoGesto, instalarSonsAoVivo, RESERVAS_POR_GESTO, type ConexaoDosSons, type SonsAoVivo } from './sonsAoVivoDoJogador'

const ID = `${'a'.repeat(64)}.mp3`

function montar() {
  let ouvinteDosSons: ((msg: SomHostMessage) => void) | null = null
  const estado: PlayerState = { status: 'playing', rev: 1, sceneEpoch: 0 }
  const conexao: ConexaoDosSons = {
    getState: () => estado,
    subscribe: () => () => undefined,
    ouvirSons: (ouvinte) => {
      ouvinteDosSons = ouvinte
      return () => {
        ouvinteDosSons = null
      }
    },
    informarSomFalhou: () => true,
    chaveDaMidia: () => null,
  }
  const ouvintesDoMotor = new Set<(evento: EventoDoMotor) => void>()
  const emitir = (evento: EventoDoMotor) => {
    for (const ouvinte of ouvintesDoMotor) ouvinte(evento)
  }
  const motor: MotorAoVivo = {
    tocar: (instancia) => {
      emitir({ tipo: 'esperando', instancia })
      return { aceito: true }
    },
    parar: () => undefined,
    pararTudo: () => undefined,
    mudarVolume: () => undefined,
    precarregar: () => undefined,
    assinar: (ouvinte) => {
      ouvintesDoMotor.add(ouvinte)
      return () => {
        ouvintesDoMotor.delete(ouvinte)
      }
    },
    desmontar: () => undefined,
  }
  /** O tipo do evento em curso quando cada coisa aconteceu: 'click' = dentro do gesto. */
  const momentos: string[] = []
  const elementos: ElementoDeAudioFalso[] = []
  const reservas = criarReservaDoGesto(() => {
    const elemento = criarElementoDeAudioFalso()
    elemento.play.mockImplementation(async () => {
      momentos.push(`play:${window.event?.type ?? 'fora'}`)
    })
    elementos.push(elemento)
    return elemento
  })
  const sons: SonsAoVivo = instalarSonsAoVivo(conexao, {
    criarMotor: () => motor,
    reservas,
    destravarAgora: () => momentos.push(`destravar:${window.event?.type ?? 'fora'}`),
    destravarNoPrimeiroGesto: () => () => undefined,
  })
  const chega = (instancia: string) =>
    act(() => {
      ouvinteDosSons?.({ type: 'som.tocar', instancia, fonte: { tipo: 'arquivo', midia: ID }, volume: 0.5, loop: true })
    })
  return { sons, chega, emitir, momentos, elementos }
}

let raiz: Root
let palco: HTMLDivElement

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  palco = document.createElement('div')
  document.body.append(palco)
  raiz = createRoot(palco)
})

afterEach(() => {
  act(() => raiz.unmount())
  palco.remove()
})

const botao = (): HTMLButtonElement | null => palco.querySelector('button')

describe('faixinha "Toque para ouvir"', () => {
  it('só aparece com som esperando o gesto, e some quando ele começa', () => {
    const m = montar()
    act(() => raiz.render(createElement(FaixaTocarParaOuvir, { sons: m.sons })))
    expect(botao()).toBeNull()
    m.chega('som-chuva')
    expect(botao()?.textContent).toBe('Toque para ouvir')
    expect(botao()?.type).toBe('button')
    act(() => m.emitir({ tipo: 'tocando', instancia: 'som-chuva', loop: true, duracaoS: 10, deslocamentoS: 0, inicioEmMs: 0 }))
    expect(botao()).toBeNull()
  })

  it('some também quando a fila esvazia sem tocar (parado ou recusado)', () => {
    const m = montar()
    act(() => raiz.render(createElement(FaixaTocarParaOuvir, { sons: m.sons })))
    m.chega('a')
    m.chega('b')
    act(() => m.emitir({ tipo: 'terminou', instancia: 'a', motivo: 'parado' }))
    expect(botao()).not.toBeNull()
    act(() => m.emitir({ tipo: 'recusado', instancia: 'b', motivo: 'sem-gesto' }))
    expect(botao()).toBeNull()
  })

  it('o toque destrava e prepara as reservas DENTRO do clique, de forma síncrona', () => {
    const m = montar()
    act(() => raiz.render(createElement(FaixaTocarParaOuvir, { sons: m.sons })))
    m.chega('som-chuva')
    const alvo = botao()
    if (alvo === null) throw new Error('a faixinha deveria estar na tela')
    // Sem act e sem await: o que não aconteceu até o click() voltar não aconteceu dentro do gesto.
    alvo.click()
    expect(m.momentos).toEqual(['destravar:click', ...Array.from({ length: RESERVAS_POR_GESTO }, () => 'play:click')])
    expect(m.elementos).toHaveLength(RESERVAS_POR_GESTO)
  })

  it('sem sons instalados não mostra nada', () => {
    act(() => raiz.render(createElement(FaixaTocarParaOuvir, { sons: null })))
    expect(botao()).toBeNull()
  })

  it('o texto é fixo e o aviso é anunciado (região viva sempre montada)', () => {
    const m = montar()
    act(() => raiz.render(createElement(FaixaTocarParaOuvir, { sons: m.sons })))
    const regiao = palco.querySelector('[aria-live="polite"]')
    expect(regiao).not.toBeNull()
    m.chega('som-1')
    expect(regiao?.contains(botao())).toBe(true)
    expect(botao()?.getAttribute('aria-label')).toBeNull()
  })
})

vi.mock('./FaixaTocarParaOuvir.css', () => ({}))
