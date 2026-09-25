/**
 * atencao-do-mestre — chegadas agrupadas. Na simulação de sete jogadores, cinco
 * cartões "X entrou em Y" cobriam o mapa até o mestre dispensar um a um. A
 * regra agora: UM cartão por cena de destino, com todos os nomes que chegaram
 * lá, e o cartão some sozinho.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../stores/toastStore'
import { CHEGADA_TOAST_MS, createArrivalAnnouncer, textoDeChegada } from './avisoDeChegada'
import type { AppliedTransfer } from './hostSession'

function chegada(playerId: string, playerName: string, toSceneId: string, toSceneName: string, x = 100, y = 200): AppliedTransfer {
  return { tokenId: `t-${playerId}`, playerId, playerName, fromSceneId: 's-cais', toSceneId, toSceneName, x, y }
}

const avisos = () => useToastStore.getState().toasts

describe('textoDeChegada', () => {
  it('um nome: a frase de sempre', () => {
    expect(textoDeChegada(['Ana'], 'Porão')).toBe('Ana entrou em Porão')
  })

  it('dois e três nomes: "e" antes do último, verbo no plural', () => {
    expect(textoDeChegada(['Ana', 'Bruno'], 'Porão')).toBe('Ana e Bruno entraram em Porão')
    expect(textoDeChegada(['Ana', 'Bruno', 'Carla'], 'Porão')).toBe('Ana, Bruno e Carla entraram em Porão')
  })

  it('mais de três: os três primeiros e quantos mais, para o cartão não virar parágrafo', () => {
    expect(textoDeChegada(['Ana', 'Bruno', 'Carla', 'Davi', 'Edu'], 'Porão')).toBe('Ana, Bruno, Carla e mais 2 entraram em Porão')
    expect(textoDeChegada(['Ana', 'Bruno', 'Carla', 'Davi'], 'Porão')).toBe('Ana, Bruno, Carla e mais 1 entraram em Porão')
  })
})

describe('createArrivalAnnouncer: um cartão por cena', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('3 chegadas ao Porão = UM cartão com os três nomes e "Ir lá"', () => {
    const goTo = vi.fn()
    const anunciar = createArrivalAnnouncer(goTo)
    anunciar(chegada('p-ana', 'Ana', 's-porao', 'Porão', 100, 100))
    anunciar(chegada('p-bruno', 'Bruno', 's-porao', 'Porão', 140, 100))
    anunciar(chegada('p-carla', 'Carla', 's-porao', 'Porão', 180, 100))
    expect(avisos()).toHaveLength(1)
    const cartao = avisos()[0]
    expect(cartao?.text).toBe('Ana, Bruno e Carla entraram em Porão')
    expect(cartao?.actions?.map((a) => a.label)).toEqual(['Ir lá'])
    // "Ir lá" leva à cena, na última chegada.
    cartao?.actions?.[0]?.run()
    // PISOS: e no piso de chegada (aqui, o térreo).
    expect(goTo).toHaveBeenCalledWith('s-porao', 180, 100, 0)
  })

  it('PISOS: o "Ir lá" leva ao piso onde a ficha chegou (o do pino par), não ao térreo', () => {
    const goTo = vi.fn()
    const anunciar = createArrivalAnnouncer(goTo)
    anunciar({ ...chegada('p-ana', 'Ana', 's-torre', 'Torre', 900, 600), piso: 2 })
    avisos()[0]?.actions?.[0]?.run()
    expect(goTo).toHaveBeenCalledWith('s-torre', 900, 600, 2)
  })

  it('cenas diferentes, cartões diferentes', () => {
    const anunciar = createArrivalAnnouncer(vi.fn())
    anunciar(chegada('p-ana', 'Ana', 's-porao', 'Porão'))
    anunciar(chegada('p-bruno', 'Bruno', 's-sotao', 'Sótão'))
    anunciar(chegada('p-carla', 'Carla', 's-porao', 'Porão'))
    expect(avisos().map((t) => t.text).sort()).toEqual(['Ana e Carla entraram em Porão', 'Bruno entrou em Sótão'])
  })

  it('o cartão some sozinho; a chegada seguinte à mesma cena abre um cartão novo, só com ela', () => {
    const anunciar = createArrivalAnnouncer(vi.fn())
    anunciar(chegada('p-ana', 'Ana', 's-porao', 'Porão'))
    expect(avisos()).toHaveLength(1)
    vi.advanceTimersByTime(CHEGADA_TOAST_MS - 1)
    expect(avisos()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(avisos()).toEqual([])
    anunciar(chegada('p-bruno', 'Bruno', 's-porao', 'Porão'))
    expect(avisos().map((t) => t.text)).toEqual(['Bruno entrou em Porão'])
  })

  it('cada chegada nova reinicia o prazo do cartão da cena', () => {
    const anunciar = createArrivalAnnouncer(vi.fn())
    anunciar(chegada('p-ana', 'Ana', 's-porao', 'Porão'))
    vi.advanceTimersByTime(CHEGADA_TOAST_MS - 1000)
    anunciar(chegada('p-bruno', 'Bruno', 's-porao', 'Porão'))
    vi.advanceTimersByTime(2000)
    expect(avisos().map((t) => t.text)).toEqual(['Ana e Bruno entraram em Porão'])
  })

  it('quem segue viagem sai do cartão da cena anterior; cartão vazio some', () => {
    const anunciar = createArrivalAnnouncer(vi.fn())
    anunciar(chegada('p-ana', 'Ana', 's-porao', 'Porão'))
    anunciar(chegada('p-bruno', 'Bruno', 's-porao', 'Porão'))
    anunciar(chegada('p-ana', 'Ana', 's-sotao', 'Sótão'))
    expect(avisos().map((t) => t.text).sort()).toEqual(['Ana entrou em Sótão', 'Bruno entrou em Porão'])
    anunciar(chegada('p-bruno', 'Bruno', 's-sotao', 'Sótão'))
    expect(avisos().map((t) => t.text)).toEqual(['Ana e Bruno entraram em Sótão'])
  })

  it('o mesmo jogador chegando de novo não repete o nome', () => {
    const anunciar = createArrivalAnnouncer(vi.fn())
    anunciar(chegada('p-ana', 'Ana', 's-porao', 'Porão'))
    anunciar(chegada('p-ana', 'Ana', 's-porao', 'Porão'))
    expect(avisos().map((t) => t.text)).toEqual(['Ana entrou em Porão'])
  })

  it('o mestre fechou o cartão: a próxima chegada recomeça a lista', () => {
    const anunciar = createArrivalAnnouncer(vi.fn())
    anunciar(chegada('p-ana', 'Ana', 's-porao', 'Porão'))
    const id = avisos()[0]?.id
    expect(id).toBeDefined()
    if (id !== undefined) useToastStore.getState().dismiss(id)
    anunciar(chegada('p-bruno', 'Bruno', 's-porao', 'Porão'))
    expect(avisos().map((t) => t.text)).toEqual(['Bruno entrou em Porão'])
  })

  it('sem "Ir lá" (ponte sem onGoToScene): o cartão vem sem botão', () => {
    const anunciar = createArrivalAnnouncer(undefined)
    anunciar(chegada('p-ana', 'Ana', 's-porao', 'Porão'))
    expect(avisos()).toHaveLength(1)
    expect(avisos()[0]?.actions).toBeUndefined()
  })
})
