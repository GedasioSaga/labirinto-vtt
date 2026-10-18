import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { receberPesca, registrarLance, type PescaDoJogador } from '../../../player/estadoDaPesca'
import { DIF, DT, politicaSegue } from '../sim'
import { MINIGAME_PESCA_PADRAO, type DificuldadePesca } from '../tipos'
import { MotorDaPesca, type AmbienteDaPesca } from './motor'
import { PescaOverlay, type AcoesDaPesca } from './PescaOverlay'

/**
 * TELA DA PESCA no jsdom, com uma conexão de mentira que guarda o estado
 * como a de verdade (`receberPesca`, `registrarLance`): convite -> Pronto ->
 * os lances (o robô joga pelo motor, em passos fixos) -> cesto -> Fechar; a
 * pausa do mestre congela tudo; o encerramento do mestre fecha; o teclado
 * segura e pausa.
 */

const PINO = 'pino-lago'
const EU = 'p-eu'

/** Sem laço de quadros: o teste anda o motor com `rodar`. */
const AMBIENTE_PARADO: AmbienteDaPesca = { agora: () => 0, quadro: () => 0, cancelarQuadro: () => undefined, controles: () => [] }

type Conexao = { [K in keyof AcoesDaPesca]: Mock<AcoesDaPesca[K]> }

function convite(extra: Partial<Parameters<typeof receberPesca>[1] & { type: 'pesca.convite' }> = {}) {
  const m = MINIGAME_PESCA_PADRAO
  return {
    type: 'pesca.convite' as const,
    sessao: 's1',
    pinId: PINO,
    npc: m.npc,
    fala: m.fala,
    lago: m.lago,
    lances: 2,
    permitida: 'escolha' as const,
    premio: { texto: 'A chave da comporta.' },
    consequencia: { texto: 'O barqueiro ri de você.' },
    participantes: [
      { playerId: EU, nome: 'Gedasio' },
      { playerId: 'p-bia', nome: 'Bia' },
    ],
    ...extra,
  }
}

/** Um lance inteiro pelo motor: carrega a força, espera o "!", fisga e segue o peixe. */
function jogarLance(m: MotorDaPesca, dif: DificuldadePesca = 'normal'): void {
  act(() => {
    m.apertar('robo')
    m.rodar(DIF[dif].ciclo * 0.8)
    m.soltar('robo')
    for (let i = 0; i < 4000 && m.J.fase !== 'fisgada'; i++) m.rodar(DT * 6)
    m.rodar(0.1)
    m.apertar('robo')
    m.soltar('robo')
    const politica = politicaSegue(0.12)
    for (let i = 0; i < 4000 && m.J.fase === 'puxada'; i++) m.rodar(DT * 12, politica)
    for (let i = 0; i < 100 && m.J.fase === 'final'; i++) m.rodar(0.1)
  })
}

describe('PescaOverlay', () => {
  let container: HTMLDivElement
  let root: Root
  let pesca: PescaDoJogador | undefined
  let motor: MotorDaPesca
  let conexao: Conexao

  function desenhar(): void {
    root.render(pesca === undefined ? null : <PescaOverlay pesca={pesca} playerId={EU} acoes={conexao} ambiente={AMBIENTE_PARADO} motor={motor} armazem={null} criarAudio={() => null} />)
  }

  function chegar(msg: Parameters<typeof receberPesca>[1]): void {
    pesca = receberPesca(pesca, msg, 0)
    act(() => desenhar())
  }

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    motor = new MotorDaPesca(AMBIENTE_PARADO, false)
    pesca = undefined
    conexao = {
      prontoPesca: vi.fn((dificuldade: DificuldadePesca) => {
        if (pesca === undefined || pesca.pronto !== undefined) return false
        pesca = { ...pesca, pronto: dificuldade }
        desenhar()
        return true
      }),
      vivoPesca: vi.fn(() => true),
      lancePesca: vi.fn((lance) => {
        const registrada = pesca === undefined ? null : registrarLance(pesca, lance)
        if (registrada === null) return false
        pesca = registrada
        desenhar()
        return true
      }),
      fimPesca: vi.fn(() => {
        if (pesca === undefined) return false
        pesca = { ...pesca, fimEnviado: true }
        desenhar()
        return true
      }),
      fecharPesca: vi.fn(() => {
        pesca = undefined
        desenhar()
      }),
    }
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  const tela = (): HTMLElement => {
    const t = document.querySelector<HTMLElement>('.lb-pesca')
    if (t === null) throw new Error('a tela da pesca não está aberta')
    return t
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = Array.from(tela().querySelectorAll('button')).find((b) => b.textContent === nome)
    if (achado === undefined) throw new Error(`sem botão "${nome}"`)
    return achado
  }

  function tecla(tipo: 'keydown' | 'keyup', code: string): void {
    act(() => {
      window.dispatchEvent(new KeyboardEvent(tipo, { code, bubbles: true }))
    })
  }

  it('o convite mostra o desafio, os lances, o prêmio e a consequência; o mestre pode travar a dificuldade', () => {
    chegar(convite({ permitida: 'extremo' }))
    const t = tela()
    expect(t.getAttribute('role')).toBe('dialog')
    expect(t.textContent).toContain(MINIGAME_PESCA_PADRAO.npc)
    expect(t.textContent).toContain(`desafia você no ${MINIGAME_PESCA_PADRAO.lago}`)
    expect(t.textContent).toContain('2 lances para encher o cesto.')
    expect(t.textContent).toContain('A chave da comporta.')
    expect(t.textContent).toContain('O barqueiro ri de você.')
    const [normal, extremo] = Array.from(t.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
    expect(normal.disabled).toBe(true)
    expect(extremo.checked).toBe(true)
    expect(t.textContent).toContain('O mestre liberou só o Extremo neste pino.')
    act(() => botao('Ir pescar').click())
    expect(conexao.prontoPesca).toHaveBeenCalledWith('extremo')
  })

  it('do Pronto ao Fechar: cada lance vai à conexão, o último manda o fim, e o cesto diz o prêmio ou a consequência', () => {
    vi.useFakeTimers()
    chegar(convite())
    act(() => botao('Ir pescar').click())
    expect(conexao.prontoPesca).toHaveBeenCalledWith('normal')
    expect(tela().textContent).toContain('Lance 1 de 2')
    expect(motor.J.fase).toBe('lance')

    jogarLance(motor)
    expect(conexao.lancePesca).toHaveBeenCalledTimes(1)
    expect(conexao.lancePesca.mock.calls[0][0].lance).toBe(1)
    expect(conexao.fimPesca).not.toHaveBeenCalled()
    expect(tela().querySelector('.pz-tela--resultado')?.textContent).toContain('Lance 1 de 2')
    act(() => botao('Próximo lance').click())
    expect(tela().textContent).toContain('Lance 2 de 2')

    jogarLance(motor)
    expect(conexao.lancePesca).toHaveBeenCalledTimes(2)
    expect(conexao.lancePesca.mock.calls[1][0].lance).toBe(2)
    expect(conexao.fimPesca).toHaveBeenCalledTimes(1)
    act(() => botao('Ver o cesto').click())

    const pegos = conexao.lancePesca.mock.calls.filter(([l]) => l.resultado === 'pegou').length
    const cesto = tela().querySelector('.pz-tela--resultado')
    expect(cesto?.textContent).toContain('Fim da pesca no Poço Afogado')
    expect(cesto?.textContent).toContain(pegos > 0 ? 'Prêmio: A chave da comporta.' : 'Consequência: O barqueiro ri de você.')
    expect(tela().querySelectorAll('.pz-cesto li')).toHaveLength(pegos)

    act(() => botao('Fechar').click())
    expect(tela().dataset.saindo).toBe('true')
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(conexao.fecharPesca).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.lb-pesca')).toBeNull()
  })

  it('a pausa do mestre congela tudo (a linha não anda nem segura) até ele continuar', () => {
    chegar(convite())
    act(() => botao('Ir pescar').click())
    chegar({ type: 'pesca.pausa', sessao: 's1' })
    expect(tela().querySelector('.pz-pausa')?.textContent).toContain('O mestre pausou a pesca')
    expect(Array.from(tela().querySelectorAll('.pz-pausa button'))).toHaveLength(0)
    const t = motor.J.t
    act(() => {
      motor.apertar('robo')
      motor.rodar(2)
    })
    expect(motor.J.t).toBe(t)
    expect(motor.J.carregando).toBe(false)
    chegar({ type: 'pesca.retoma', sessao: 's1' })
    expect(tela().querySelector('.pz-pausa')).toBeNull()
    act(() => motor.rodar(0.5))
    expect(motor.J.t).toBeGreaterThan(t)
  })

  it('o mestre encerra no meio do lance: a tela diz, nenhum lance sai, e Fechar fecha', () => {
    vi.useFakeTimers()
    chegar(convite())
    act(() => botao('Ir pescar').click())
    act(() => {
      motor.apertar('robo')
      motor.rodar(0.6)
      motor.soltar('robo')
    })
    chegar({ type: 'pesca.encerra', sessao: 's1', motivo: 'mestre' })
    expect(tela().textContent).toContain('O mestre encerrou a pesca')
    act(() => motor.rodar(10))
    expect(conexao.lancePesca).not.toHaveBeenCalled()
    act(() => botao('Fechar').click())
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(conexao.fecharPesca).toHaveBeenCalledTimes(1)
  })

  it('teclado: Espaço segura a força e solta lança; Esc pausa só este jogador, e o Espaço pausado não pesca', () => {
    chegar(convite())
    act(() => botao('Ir pescar').click())
    tecla('keydown', 'Space')
    expect(motor.J.carregando).toBe(true)
    act(() => motor.rodar(0.5))
    tecla('keyup', 'Space')
    expect(motor.J.fase).toBe('voo')
    tecla('keydown', 'Escape')
    expect(tela().querySelector('.pz-pausa')?.textContent).toContain('Pausado')
    const t = motor.J.t
    act(() => motor.rodar(1))
    expect(motor.J.t).toBe(t)
    tecla('keydown', 'Escape')
    expect(tela().querySelector('.pz-pausa')).toBeNull()
  })

  it('o vivo de cada quadro vai à conexão só quando muda', () => {
    chegar(convite())
    act(() => botao('Ir pescar').click())
    act(() => motor.ganchos.quadro())
    act(() => motor.ganchos.quadro())
    expect(conexao.vivoPesca).toHaveBeenCalledTimes(1)
    expect(conexao.vivoPesca).toHaveBeenCalledWith({ fase: 'lance', lance: 1, medidor: 0 })
  })
})
