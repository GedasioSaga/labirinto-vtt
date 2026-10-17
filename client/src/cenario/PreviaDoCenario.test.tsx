import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { instalarAudioContextFalso, type AudioContextFalso } from './audioContextFalso.fixture'
import { CENARIO_PADRAO, type CenarioDoPino } from './catalogo'
import { PreviaDoCenario, TETO_DO_PALCO_S, duracaoDaRevelacaoS } from './PreviaDoCenario'

/**
 * PRÉVIA VIVA DO CENÁRIO: parada não abre áudio nem deixa quadro vivo;
 * "Assistir" toca e volta sozinho ao último quadro no fim natural, em até 5 s
 * no palco da ficha; sair de vista para; mudar o texto parada redesenha sem
 * tocar. Relógio e quadros de mentira, como no teste do som da revelação.
 */

let container: HTMLDivElement
let root: Root
let contextos: AudioContextFalso[]
let quadros: Map<number, FrameRequestCallback>
let proximoId = 0
let agora = 0
let avisarSaida: ((entradas: Array<{ isIntersecting: boolean }>) => void) | null = null
const IMAGEM = 'data:image/png;base64,AAAA'
const DESCRICAO = 'Muralhas brancas brotam da selva.'

class ObservadorFalso {
  constructor(aviso: (entradas: Array<{ isIntersecting: boolean }>) => void) {
    avisarSaida = aviso
  }
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  quadros = new Map()
  agora = 0
  avisarSaida = null
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    quadros.set(++proximoId, cb)
    return proximoId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    quadros.delete(id)
  })
  vi.stubGlobal('IntersectionObserver', ObservadorFalso)
  vi.spyOn(performance, 'now').mockImplementation(() => agora)
  contextos = instalarAudioContextFalso()
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

/** Avança o relógio até `ms` e roda os quadros pendentes. */
function quadro(ms: number) {
  agora = ms
  const pendentes = [...quadros.values()]
  quadros.clear()
  act(() => {
    for (const f of pendentes) f(ms)
  })
}

function desenhar(cenario: CenarioDoPino, descricao = DESCRICAO) {
  act(() => root.render(<PreviaDoCenario imagem={IMAGEM} cenario={cenario} nome="Base da Marinha" descricao={descricao} onVerGrande={() => {}} />))
}

/** Monta e espera a imagem: no jsdom ela nunca carrega, e a revelação segue depois de 1,5 s. */
async function montar(cenario: CenarioDoPino = CENARIO_PADRAO) {
  desenhar(cenario)
  await act(async () => {
    vi.advanceTimersByTime(1600)
  })
}

const botao = (texto: string) => Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === texto) ?? null
const clicar = (texto: string) => act(() => botao(texto)?.click())
/** O vento fecha o contexto depois de assentar: passa o tempo antes de conferir. */
function todosFechados(): boolean {
  act(() => {
    vi.advanceTimersByTime(3000)
  })
  return contextos.every((c) => c.fechado)
}
const textoNaTela = () => container.querySelector('.lb-revelacao__texto span')?.textContent

describe('PreviaDoCenario', () => {
  it('parada: último quadro com o texto inteiro, sem áudio e sem quadro vivo', async () => {
    await montar()
    expect(textoNaTela()).toBe(DESCRICAO)
    expect(contextos).toHaveLength(0)
    expect(quadros.size).toBe(0)
    expect(botao('Assistir')).not.toBeNull()
  })

  it('"Assistir" toca com som e volta sozinho a "Assistir" no fim natural (4,6 s)', async () => {
    await montar()
    clicar('Assistir')
    expect(botao('Parar')).not.toBeNull()
    // As teclas e o vento (o padrão liga o som do vento); nenhum antes do Assistir.
    expect(contextos.length).toBeGreaterThan(0)
    quadro(1000)
    quadro(4500)
    expect(botao('Parar')).not.toBeNull()
    quadro(4700)
    expect(botao('Assistir')).not.toBeNull()
    expect(todosFechados()).toBe(true)
  })

  it('cenário de 12 s: o palco da ficha para em 5 s', async () => {
    const longo = { ...CENARIO_PADRAO, duracaoS: 12 }
    expect(duracaoDaRevelacaoS(longo, null)).toBeCloseTo(11.6)
    await montar(longo)
    clicar('Assistir')
    quadro(1000)
    quadro(TETO_DO_PALCO_S * 1000 - 100)
    expect(botao('Parar')).not.toBeNull()
    quadro(TETO_DO_PALCO_S * 1000 + 100)
    expect(botao('Assistir')).not.toBeNull()
  })

  it('sair de vista para a prévia e fecha o áudio', async () => {
    await montar()
    clicar('Assistir')
    // As teclas e o vento (o padrão liga o som do vento); nenhum antes do Assistir.
    expect(contextos.length).toBeGreaterThan(0)
    act(() => avisarSaida?.([{ isIntersecting: false }]))
    expect(botao('Assistir')).not.toBeNull()
    expect(todosFechados()).toBe(true)
  })

  it('mudar a descrição parada redesenha o último quadro sem tocar', async () => {
    await montar()
    desenhar(CENARIO_PADRAO, 'Outra coisa.')
    expect(textoNaTela()).toBe('Outra coisa.')
    expect(botao('Assistir')).not.toBeNull()
    expect(contextos).toHaveLength(0)
  })

  it('movimento reduzido ligado com a ficha já aberta: o Assistir toca reduzido e acaba em 0,4 s', async () => {
    await montar()
    vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: true, media: consulta }))
    clicar('Assistir')
    expect(container.querySelector('.lb-revelacao')?.getAttribute('data-reduzir')).toBe('true')
    quadro(300)
    expect(botao('Parar')).not.toBeNull()
    quadro(500)
    expect(botao('Assistir')).not.toBeNull()
  })

  it('o teto de 5 s conta do Assistir no relógio de parede: sem quadro nenhum (página travada), o palco da ficha para mesmo assim', async () => {
    await montar({ ...CENARIO_PADRAO, duracaoS: 12 })
    clicar('Assistir')
    act(() => {
      vi.advanceTimersByTime(TETO_DO_PALCO_S * 1000 - 50)
    })
    expect(botao('Parar')).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(botao('Assistir')).not.toBeNull()
  })

  it('movimento reduzido: acaba 0,4 s depois do Assistir, mesmo com os quadros atrasados', async () => {
    await montar()
    vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: true, media: consulta }))
    clicar('Assistir')
    act(() => {
      vi.advanceTimersByTime(350)
    })
    expect(botao('Parar')).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(botao('Assistir')).not.toBeNull()
  })

  it('"Som do vento" ligado: a pílula Vento com 3 barras no canto da vista, que só oscila tocando', async () => {
    await montar({ ...CENARIO_PADRAO, som: true })
    const pilula = () => container.querySelector('.lb-revelacao__vista .lb-cena__vento')
    expect(pilula()?.textContent).toBe('Vento')
    expect(pilula()?.querySelectorAll('.lb-cena__barras i')).toHaveLength(3)
    expect(pilula()?.getAttribute('data-tocando')).toBe('false')
    clicar('Assistir')
    expect(pilula()?.getAttribute('data-tocando')).toBe('true')
  })

  it('"Som do vento" desligado: nada de pílula', async () => {
    await montar({ ...CENARIO_PADRAO, som: false })
    expect(container.querySelector('.lb-cena__vento')).toBeNull()
  })

  it('tocar de novo recomeça o texto do alto, mesmo com a rolagem do último quadro lá embaixo', async () => {
    const rolagens = new WeakMap<Element, number>()
    const ehRolagem = (el: Element) => el.classList.contains('lb-revelacao__rolagem')
    // Texto maior que o painel (o jsdom não mede): 300 px de texto numa janela de 100.
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get(this: HTMLElement) { return ehRolagem(this) ? 300 : 0 } })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return ehRolagem(this) ? 100 : 0 } })
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      configurable: true,
      get(this: HTMLElement) {
        return rolagens.get(this) ?? 0
      },
      set(this: HTMLElement, valor: number) {
        rolagens.set(this, valor)
      },
    })
    try {
      await montar()
      const rolagem = container.querySelector('.lb-revelacao__rolagem')
      if (!(rolagem instanceof HTMLElement)) throw new Error('sem a rolagem do texto')
      // O último quadro deixa a rolagem no fim do texto.
      rolagem.scrollTop = 200
      clicar('Assistir')
      expect(rolagem.scrollTop).toBe(0)
    } finally {
      for (const nome of ['scrollHeight', 'clientHeight', 'scrollTop']) Reflect.deleteProperty(HTMLElement.prototype, nome)
    }
  })
})
