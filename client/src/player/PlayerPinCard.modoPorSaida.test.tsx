import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/**
 * MODO POR SAÍDA no cartão do jogador: numa encruzilhada com saídas de modos
 * diferentes, cada botão diz o modo da saída, e a pergunta e a confirmação
 * seguem o modo DELA — "Passar" na livre, "Pedir" na que pede, "abrir" na
 * trancada. Trancada num pino mudo não oferece pedido nenhum.
 */

const CRUZ: Pin = {
  id: 'cruz',
  x: 1,
  y: 1,
  kind: 'viagem',
  description: 'Encruzilhada',
  image: null,
  escolhas: [
    { id: 'principal', rotulo: 'Porta' },
    { id: 'saida_torre', rotulo: 'Escada', passagem: 'livre' },
    { id: 'saida_poco', rotulo: 'Poço', passagem: 'trancada' },
  ],
}

describe('PlayerPinCard: modo por saída', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(pin: Pin, onRequestTravel: (exitId?: string) => void = () => {}): void {
    act(() => root.render(<PlayerPinCard pin={pin} stairs={[]} onClose={() => {}} onRequestTravel={onRequestTravel} />))
  }

  const saidas = (): HTMLButtonElement[] => Array.from(container.querySelectorAll<HTMLButtonElement>('.pp-pincard__exits button'))
  const saida = (rotulo: string): HTMLButtonElement | undefined => saidas().find((b) => (b.textContent ?? '').startsWith(rotulo))
  const botao = (texto: string): HTMLButtonElement | undefined => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === texto)
  const pergunta = (): string => container.querySelector('.pp-pincard__question')?.textContent ?? ''

  it('cada saída diz o modo dela no botão', () => {
    render(CRUZ)
    expect(saidas().map((b) => b.textContent)).toEqual(['Porta Pede ao mestre', 'Escada Livre', 'Poço Trancada'])
    // Nenhum "Está trancada" do pino inteiro: só uma saída é trancada.
    expect(container.textContent).not.toContain('Está trancada')
  })

  /**
   * Decisão 5 do mestre (12/11/2026): cada saída manda o pedido num toque, sem
   * pergunta. A pergunta só abre com 2 fichas ou mais no pino ("Quem passa?"),
   * e aí ela e o botão de confirmar seguem o modo DA SAÍDA.
   */
  const DUAS_FICHAS = [
    { id: 'enzo', name: 'Enzo' },
    { id: 'rufo', name: 'Rufo' },
  ]
  function renderComDuas(pin: Pin, onRequestTravel: (exitId?: string, tokenIds?: string[]) => void): void {
    act(() => root.render(<PlayerPinCard pin={pin} stairs={[]} onClose={() => {}} onRequestTravel={onRequestTravel} travelers={DUAS_FICHAS} />))
  }

  it('saída livre: um toque manda a saída; com duas fichas, "Passar por Escada?" e o botão de confirmar é "Passar"', () => {
    const pedir = vi.fn()
    render(CRUZ, pedir)
    act(() => saida('Escada')?.click())
    expect(pergunta()).toBe('')
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(pedir).toHaveBeenCalledWith('saida_torre')

    const pedirDuas = vi.fn()
    renderComDuas(CRUZ, pedirDuas)
    act(() => saida('Escada')?.click())
    expect(pergunta()).toBe('Passar por Escada?')
    expect(pedirDuas).not.toHaveBeenCalled()
    act(() => botao('Passar')?.click())
    expect(pedirDuas).toHaveBeenCalledWith('saida_torre', ['enzo', 'rufo'])
  })

  it('saída que pede: um toque manda a saída; com duas fichas, "Pedir ao mestre para passar por Porta?" e "Pedir"', () => {
    const pedir = vi.fn()
    render(CRUZ, pedir)
    act(() => saida('Porta')?.click())
    expect(pergunta()).toBe('')
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(pedir).toHaveBeenCalledWith('principal')

    const pedirDuas = vi.fn()
    renderComDuas(CRUZ, pedirDuas)
    act(() => saida('Porta')?.click())
    expect(pergunta()).toBe('Pedir ao mestre para passar por Porta?')
    expect(pedirDuas).not.toHaveBeenCalled()
    act(() => botao('Pedir')?.click())
    expect(pedirDuas).toHaveBeenCalledWith('principal', ['enzo', 'rufo'])
  })

  it('saída trancada que aceita tentativas: um toque manda; com duas fichas, pede ao mestre para ABRIR', () => {
    const pedir = vi.fn()
    render(CRUZ, pedir)
    act(() => saida('Poço')?.click())
    expect(pergunta()).toBe('')
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(pedir).toHaveBeenCalledWith('saida_poco')

    const pedirDuas = vi.fn()
    renderComDuas(CRUZ, pedirDuas)
    act(() => saida('Poço')?.click())
    expect(pergunta()).toBe('Pedir ao mestre para abrir Poço?')
    expect(pedirDuas).not.toHaveBeenCalled()
    act(() => botao('Pedir')?.click())
    expect(pedirDuas).toHaveBeenCalledWith('saida_poco', ['enzo', 'rufo'])
  })

  it('saída trancada num pino mudo: o botão dela fica desligado; as outras seguem', () => {
    render({ ...CRUZ, mudo: true })
    expect(saida('Poço')?.disabled).toBe(true)
    expect(saida('Escada')?.disabled).toBe(false)
    expect(saida('Porta')?.disabled).toBe(false)
  })

  it('pino trancado com uma saída livre: a livre passa, as outras dizem Trancada', () => {
    const pedir = vi.fn()
    const pin: Pin = {
      ...CRUZ,
      passagem: 'trancada',
      mudo: true,
      escolhas: [
        { id: 'principal', rotulo: 'Porta' },
        { id: 'saida_torre', rotulo: 'Escada', passagem: 'livre' },
      ],
    }
    render(pin, pedir)
    expect(saidas().map((b) => b.textContent)).toEqual(['Porta Trancada', 'Escada Livre'])
    expect(saida('Porta')?.disabled).toBe(true)
    act(() => saida('Escada')?.click())
    act(() => botao('Passar')?.click())
    expect(pedir).toHaveBeenCalledWith('saida_torre')
  })

  /**
   * Barrar e chamar a cabine são do PINO, não da saída: o host
   * (`handlePinBar`, `handleCabineCall` em `net/hostSession.ts`) recusa em
   * silêncio quando o modo do pino é trancada, mesmo com uma extra livre. O
   * cartão não pode oferecer um botão que nunca faz nada.
   */
  function renderComGestos(pin: Pin, onBarrar: (on: boolean) => void, onChamarCabine: () => boolean): void {
    act(() =>
      root.render(
        <PlayerPinCard pin={pin} stairs={[]} onClose={() => {}} onRequestTravel={() => {}} onBarrar={onBarrar} onChamarCabine={onChamarCabine} />,
      ),
    )
  }

  const TRANCADO_COM_LIVRE: Pin = {
    ...CRUZ,
    passagem: 'trancada',
    escolhas: [
      { id: 'principal', rotulo: 'Porta' },
      { id: 'saida_torre', rotulo: 'Escada', passagem: 'livre' },
    ],
  }

  it('pino trancado com uma saída livre: não oferece "Barrar a passagem"', () => {
    const barrar = vi.fn()
    renderComGestos(TRANCADO_COM_LIVRE, barrar, () => true)
    // A encruzilhada continua lá, com a saída livre dizendo o modo dela.
    expect(saidas().map((b) => b.textContent)).toEqual(['Porta Trancada', 'Escada Livre'])
    expect(botao('Barrar a passagem')).toBeUndefined()
    expect(barrar).not.toHaveBeenCalled()
  })

  it('pino trancado com uma saída livre e a cabine longe: não oferece "Chamar a cabine"', () => {
    const chamar = vi.fn(() => true)
    renderComGestos({ ...TRANCADO_COM_LIVRE, cabine: 'longe' }, () => {}, chamar)
    expect(container.textContent).toContain('Fechar')
    expect(botao('Chamar a cabine')).toBeUndefined()
    expect(chamar).not.toHaveBeenCalled()
  })

  it('pino que pede com uma saída trancada: "Barrar a passagem" e "Chamar a cabine" seguem valendo', () => {
    const barrar = vi.fn()
    const chamar = vi.fn(() => true)
    renderComGestos({ ...CRUZ, cabine: 'longe' }, barrar, chamar)
    act(() => botao('Barrar a passagem')?.click())
    expect(barrar).toHaveBeenCalledWith(true)
    act(() => botao('Chamar a cabine')?.click())
    expect(chamar).toHaveBeenCalledTimes(1)
  })

  /**
   * O MOTIVO ("Desabou") é do pino trancado: o host manda com uma extra livre
   * ao lado (`blockReasonOf` só olha o pino). O cartão mostra junto do nome da
   * saída trancada, para o jogador saber QUAL está fechada. "Me avise" segue a
   * mesma regra: o aviso (`passageWatchAfter`) dispara quando o PINO abre.
   */
  function renderComVigia(pin: Pin, onWatch: (on: boolean) => void): void {
    act(() => root.render(<PlayerPinCard pin={pin} stairs={[]} onClose={() => {}} onRequestTravel={() => {}} onWatch={onWatch} />))
  }
  const motivo = (): string | null => container.querySelector('.pp-pincard__reason')?.textContent ?? null
  const fechada = (): string => container.querySelector('.pp-pincard__locked')?.textContent ?? ''

  it('pino trancado com motivo e uma saída livre: o motivo aparece junto da saída trancada', () => {
    renderComVigia({ ...TRANCADO_COM_LIVRE, motivo: 'desabou' }, () => {})
    expect(motivo()).toBe('Desabou.')
    expect(fechada()).toBe('Porta: Desabou. Só o mestre pode abrir.')
    expect(saidas().map((b) => b.textContent)).toEqual(['Porta Trancada', 'Escada Livre'])
  })

  it('pino trancado com motivo, duas saídas trancadas e uma livre: o motivo nomeia as duas', () => {
    const pin: Pin = { ...TRANCADO_COM_LIVRE, motivo: 'desabou', escolhas: [...(TRANCADO_COM_LIVRE.escolhas ?? []), { id: 'saida_poco', rotulo: 'Poço' }] }
    renderComVigia(pin, () => {})
    expect(fechada()).toBe('Porta e Poço: Desabou. Só o mestre pode abrir.')
  })

  it('pino trancado MUDO com motivo e uma saída livre: o motivo diz que não dá para passar', () => {
    renderComVigia({ ...TRANCADO_COM_LIVRE, mudo: true, motivo: 'desabou' }, () => {})
    expect(fechada()).toBe('Porta: Desabou. Não dá para passar por aqui agora.')
  })

  it('pino trancado com uma saída livre: "Me avise quando der" vigia o pino', () => {
    const onWatch = vi.fn()
    renderComVigia({ ...TRANCADO_COM_LIVRE, motivo: 'desabou' }, onWatch)
    act(() => botao('Me avise quando der')?.click())
    expect(onWatch).toHaveBeenCalledWith(true)
  })

  it('pino trancado com uma saída livre e a chave na mochila: nem motivo nem "Me avise"', () => {
    renderComVigia({ ...TRANCADO_COM_LIVRE, motivo: 'desabou', chave: 'Chave de ferro' }, () => {})
    expect(motivo()).toBeNull()
    expect(botao('Me avise quando der')).toBeUndefined()
  })

  it('pino que pede com uma saída trancada: sem motivo e sem "Me avise" (o pino não está trancado)', () => {
    renderComVigia({ ...CRUZ, motivo: 'desabou' }, () => {})
    expect(motivo()).toBeNull()
    expect(botao('Me avise quando der')).toBeUndefined()
  })

  it('controle: todas as saídas no mesmo modo, o cartão é o de sempre (sem etiqueta de modo)', () => {
    render({ ...CRUZ, escolhas: [{ id: 'principal', rotulo: 'Porta' }, { id: 'saida_torre', rotulo: 'Escada' }] })
    expect(saidas().map((b) => b.textContent)).toEqual(['Porta', 'Escada'])
  })
})
