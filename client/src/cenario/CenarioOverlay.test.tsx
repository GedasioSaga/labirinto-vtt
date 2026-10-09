import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CenarioOverlay } from './CenarioOverlay'
import { instalarAudioContextFalso, type AudioContextFalso } from './audioContextFalso.fixture'
import { CENARIO_PADRAO } from './catalogo'
import { GANHO_TECLAS } from './revelacao/som'

/**
 * REVELAÇÃO DO LOCAL na tela do jogador: o painel com o nome do local e a
 * descrição datilografada; "Pular" leva ao fim e vira "Fechar"; Esc faz o
 * mesmo (sem chegar ao cartão por baixo); clique no painel completa o texto;
 * movimento reduzido mostra tudo de uma vez.
 */

let container: HTMLDivElement
let root: Root
let quadros: Map<number, FrameRequestCallback>
let proximoId = 0
let agora = 0
const NOME = 'Base da Marinha'
const DESCRICAO = 'Muralhas brancas brotam da selva como um dente de pedra. O brasão azul da Marinha ainda vigia a trilha.'

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  quadros = new Map()
  agora = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    quadros.set(++proximoId, cb)
    return proximoId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    quadros.delete(id)
  })
  vi.spyOn(performance, 'now').mockImplementation(() => agora)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Avança o relógio da revelação até `ms` e roda os quadros pendentes. */
function quadro(ms: number) {
  agora = ms
  const pendentes = [...quadros.values()]
  quadros.clear()
  act(() => {
    for (const f of pendentes) f(ms)
  })
}

const botao = () => document.querySelector<HTMLButtonElement>('.lb-revelacao__pular')
const escrito = () => document.querySelector('.lb-revelacao__texto > span')?.textContent ?? ''

function abrir(extra: { nome?: string; descricao?: string } = {}) {
  const onFim = vi.fn()
  act(() => root.render(<CenarioOverlay imagem={null} nome={extra.nome ?? NOME} descricao={extra.descricao ?? DESCRICAO} onFim={onFim} />))
  return onFim
}

describe('CenarioOverlay: revelação do local sem imagem', () => {
  it('o painel mostra o nome do local; a descrição chega letra a letra e termina até 4,25 s', () => {
    abrir()
    expect(document.querySelector('.lb-revelacao__nome')?.textContent).toBe(NOME)
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(NOME)
    // O leitor de tela recebe o texto inteiro desde o começo.
    expect(document.querySelector('.lb-revelacao__leitor')?.textContent).toBe(DESCRICAO)
    expect(escrito()).toBe('')
    quadro(2000)
    expect(escrito().length).toBeGreaterThan(0)
    expect(escrito().length).toBeLessThan(DESCRICAO.length)
    expect(DESCRICAO.startsWith(escrito())).toBe(true)
    quadro(4300)
    expect(escrito()).toBe(DESCRICAO)
    expect(botao()?.textContent).toBe('Pular')
    quadro(4900)
    expect(botao()?.textContent).toBe('Fechar')
  })

  it('"Pular" mostra tudo e vira "Fechar"; "Fechar" devolve a vez ao cartão', () => {
    const onFim = abrir()
    quadro(500)
    act(() => botao()?.click())
    expect(escrito()).toBe(DESCRICAO)
    expect(botao()?.textContent).toBe('Fechar')
    expect(onFim).not.toHaveBeenCalled()
    act(() => botao()?.click())
    act(() => vi.advanceTimersByTime(300))
    expect(onFim).toHaveBeenCalledTimes(1)
  })

  it('Esc faz o mesmo que o botão e não chega ao cartão do pino por baixo', () => {
    const onFim = abrir()
    const doCartao = vi.fn()
    document.addEventListener('keydown', doCartao)
    quadro(800)
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(botao()?.textContent).toBe('Fechar')
    expect(escrito()).toBe(DESCRICAO)
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    act(() => vi.advanceTimersByTime(300))
    expect(onFim).toHaveBeenCalledTimes(1)
    expect(doCartao).not.toHaveBeenCalled()
    document.removeEventListener('keydown', doCartao)
  })

  it('clique no painel completa o texto sem fechar nem pular', () => {
    const onFim = abrir()
    quadro(1500)
    expect(escrito().length).toBeLessThan(DESCRICAO.length)
    act(() => document.querySelector<HTMLElement>('.lb-revelacao__painel')?.click())
    quadro(1520)
    expect(escrito()).toBe(DESCRICAO)
    expect(botao()?.textContent).toBe('Pular')
    expect(onFim).not.toHaveBeenCalled()
  })

  it('sem descrição: só o título; sem nome: só o texto, e o diálogo ganha um nome genérico', () => {
    abrir({ descricao: '   ' })
    expect(document.querySelector('.lb-revelacao__nome')?.textContent).toBe(NOME)
    expect(document.querySelector('.lb-revelacao__texto')).toBeNull()
    act(() => root.render(<></>))
    abrir({ nome: '' })
    expect(document.querySelector('.lb-revelacao__nome')).toBeNull()
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Local revelado')
    expect(document.querySelector('.lb-revelacao__leitor')?.textContent).toBe(DESCRICAO)
  })

  it('movimento reduzido: o texto inteiro de uma vez e "Fechar" logo de cara', () => {
    vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta.includes('reduce'), addEventListener: () => undefined, removeEventListener: () => undefined }))
    abrir()
    expect(escrito()).toBe(DESCRICAO)
    expect(botao()?.textContent).toBe('Fechar')
  })
})

describe('CenarioOverlay: revelação do local com imagem', () => {
  it('a animação do cenário roda dentro da moldura, com as dobradiças do postigo', async () => {
    const onFim = vi.fn()
    act(() =>
      root.render(<CenarioOverlay imagem={{ src: 'data:image/png;base64,AAAA', cenario: { ...CENARIO_PADRAO, som: false } }} nome={NOME} descricao={DESCRICAO} onFim={onFim} />),
    )
    // jsdom não carrega imagem: a moldura espera um pouco e segue com o formato padrão.
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    expect(document.querySelector('.lb-revelacao__vista .lb-cenario--moldura')).not.toBeNull()
    expect(document.querySelector('.lb-revelacao__moldura')).not.toBeNull()
    expect(document.querySelectorAll('.lb-revelacao__dobradicas i')).toHaveLength(2)
    expect(document.querySelector('.lb-revelacao__nome')?.textContent).toBe(NOME)
    quadro(1000)
    act(() => botao()?.click())
    expect(botao()?.textContent).toBe('Fechar')
  })

  it('"Pular" corta teclas e vento; "Fechar" e a saída não deixam áudio, timer nem quadro vivo', async () => {
    const contextos = instalarAudioContextFalso()
    const onFim = vi.fn()
    act(() => root.render(<CenarioOverlay imagem={{ src: 'data:image/png;base64,AAAA', cenario: { ...CENARIO_PADRAO, som: true } }} nome={NOME} descricao={DESCRICAO} onFim={onFim} />))
    // O vento nasce com a panorâmica; a revelação abre o dela quando a moldura fica pronta.
    await act(async () => {
      vi.advanceTimersByTime(1600)
    })
    const base = vi.getTimerCount()
    expect(contextos).toHaveLength(2)
    // A revelação é a que tem o barramento das teclas; o outro é o vento.
    const revelacaoCtx = contextos.find((c) => c.ganhos.some((g) => g.gain.value === GANHO_TECLAS))
    const ventoCtx = contextos.find((c) => c !== revelacaoCtx)
    if (!revelacaoCtx || !ventoCtx) throw new Error('faltou o contexto da revelação ou o do vento')
    quadro(1000)
    quadro(2000)
    expect(revelacaoCtx.iniciadas).toBeGreaterThan(0)
    act(() => botao()?.click())
    const cortes = (ctx: AudioContextFalso) => ctx.ganhos.filter((g) => g.gain.setTargetAtTime.mock.calls.some(([alvo]) => alvo === 0)).length
    expect(cortes(revelacaoCtx)).toBeGreaterThan(0)
    expect(cortes(ventoCtx)).toBe(1)
    const tocadas = revelacaoCtx.iniciadas
    quadro(3000)
    expect(revelacaoCtx.iniciadas).toBe(tocadas)
    act(() => botao()?.click())
    act(() => vi.advanceTimersByTime(300))
    expect(onFim).toHaveBeenCalledTimes(1)
    // Quem chamou tira a revelação da tela: os dois contextos fecham e nada fica agendado.
    act(() => root.render(<></>))
    expect(ventoCtx.fechado).toBe(true)
    expect(revelacaoCtx.fechado).toBe(true)
    expect(vi.getTimerCount()).toBeLessThanOrEqual(base)
    expect(quadros.size).toBe(0)
  })
})
