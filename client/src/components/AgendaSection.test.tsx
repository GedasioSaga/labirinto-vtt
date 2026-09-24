/**
 * AGENDA DA CAMPANHA no painel do mestre. Aceite do pedido: "Disparo dos
 * Gêmeos, dia 7, Meio" aparece na Caixa na hora certa — e não antes.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AgendaDaCampanha } from '../lib/agendaDaCampanha'
import type { SceneListItem } from '../stores/adventureStore'
import { useToastStore } from '../stores/toastStore'
import { AgendaSection, GRUPO_DA_AGENDA, type AgendaSectionProps } from './AgendaSection'
import { agruparAvisos } from './caixaDeAvisos'

const GEMEOS = { id: 'ev-gemeos', titulo: 'Disparo dos Gêmeos', quando: { dia: 7, apito: 'meio' as const } }

describe('AgendaSection', () => {
  let container: HTMLDivElement
  let root: Root
  let agenda: AgendaDaCampanha

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    for (const toast of useToastStore.getState().toasts) useToastStore.getState().dismiss(toast.id)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  /** O painel controlado como o App o usa: `onChange` grava e o painel redesenha com a agenda nova. */
  function render(inicial: AgendaDaCampanha | undefined, extra: Omit<AgendaSectionProps, 'agenda' | 'onChange'> = {}): void {
    agenda = inicial ?? { agora: { dia: 1, apito: 'aurora' }, eventos: [] }
    const desenhar = (atual: AgendaDaCampanha | undefined) =>
      root.render(
        <AgendaSection
          agenda={atual}
          onChange={(nova) => {
            agenda = nova
            desenhar(nova)
          }}
          {...extra}
        />,
      )
    act(() => desenhar(inicial))
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === nome)
    if (achado === undefined) throw new Error(`sem botão "${nome}"`)
    return achado
  }

  function clica(nome: string): void {
    act(() => botao(nome).click())
  }

  function textosNaCaixa(): string[] {
    return useToastStore.getState().toasts.map((t) => t.text)
  }

  function campo(rotulo: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
    const achado = Array.from(container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')).find(
      (c) => c.labels?.[0]?.textContent?.trim() === rotulo,
    )
    if (achado === undefined) throw new Error(`sem campo "${rotulo}"`)
    return achado
  }

  function preenche(rotulo: string, valor: string): void {
    const alvo = campo(rotulo)
    const proto = alvo instanceof HTMLSelectElement ? HTMLSelectElement.prototype : alvo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    act(() => {
      setter?.call(alvo, valor)
      alvo.dispatchEvent(new Event(alvo instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    })
  }

  function marcaCaixa(rotulo: string): void {
    const alvo = campo(rotulo)
    if (!(alvo instanceof HTMLInputElement) || alvo.type !== 'checkbox') throw new Error(`"${rotulo}" não é caixa de marcar`)
    act(() => alvo.click())
  }

  it('Disparo dos Gêmeos (dia 7, Meio): nada na Aurora; no Meio aparece na Caixa "Agenda"', () => {
    render({ agora: { dia: 6, apito: 'sombra' }, eventos: [GEMEOS] })
    expect(container.textContent).toContain('Agora: dia 6, Sombra')

    clica('Próximo apito')
    expect(container.textContent).toContain('Agora: dia 7, Aurora')
    expect(textosNaCaixa()).toEqual([])

    clica('Próximo apito')
    expect(container.textContent).toContain('Agora: dia 7, Meio')
    expect(textosNaCaixa()).toEqual(['Disparo dos Gêmeos — dia 7, Meio'])
    const [aviso] = useToastStore.getState().toasts
    expect(aviso.grupo).toBe(GRUPO_DA_AGENDA)
    // Na Caixa, e não um aviso solto que some sozinho: é a caixa "Agenda (1)".
    expect(agruparAvisos(useToastStore.getState().toasts)).toEqual([{ tipo: 'caixa', grupo: 'Agenda', toasts: [aviso] }])
    expect(agenda.eventos[0].disparado).toBe(true)
    expect(container.querySelector('[data-disparado="true"]')?.textContent).toContain('Disparo dos Gêmeos')

    // A hora continua andando: o mesmo evento não volta à Caixa.
    clica('Próximo apito')
    expect(textosNaCaixa()).toEqual(['Disparo dos Gêmeos — dia 7, Meio'])
  })

  it('"Próximo dia" pula para a Aurora seguinte e dispara o que ficou no caminho', () => {
    render({ agora: { dia: 7, apito: 'aurora' }, eventos: [GEMEOS] })
    clica('Próximo dia')
    expect(container.textContent).toContain('Agora: dia 8, Aurora')
    expect(textosNaCaixa()).toEqual(['Disparo dos Gêmeos — dia 7, Meio'])
  })

  it('campanha sem agenda começa no dia 1, Aurora, e diz que não há evento', () => {
    render(undefined)
    expect(container.textContent).toContain('Agora: dia 1, Aurora')
    expect(container.textContent).toContain('Nenhum evento marcado')
  })

  it('marca evento pelo formulário; momento que já passou não deixa marcar', () => {
    render({ agora: { dia: 3, apito: 'brasa' }, eventos: [] })
    preenche('Evento', 'Disparo dos Gêmeos')
    preenche('Dia', '3')
    preenche('Apito', 'meio')
    expect(botao('Marcar').disabled).toBe(true)
    expect(container.textContent).toContain('Esse momento já passou')

    preenche('Dia', '7')
    expect(botao('Marcar').disabled).toBe(false)
    clica('Marcar')
    expect(agenda.eventos.map((e) => [e.titulo, e.quando])).toEqual([['Disparo dos Gêmeos', { dia: 7, apito: 'meio' }]])
    expect(container.textContent).toContain('dia 7, Meio')
    expect(textosNaCaixa()).toEqual([])
  })

  describe('efeito alarme', () => {
    const SINO = { tipo: 'alarme' as const, cenas: ['salao', 'porao'], texto: 'O sino da torre tocou!' }
    const CENAS: SceneListItem[] = [
      { id: 'salao', name: 'Salão', tokenCount: 2, available: true, active: true, renamable: true },
      { id: 'porao', name: 'Porão', tokenCount: 0, available: true, active: false, renamable: true },
      { id: 'sumida', name: 'Sumida', tokenCount: null, available: false, active: false, renamable: true },
    ]

    it('o alarme soa nas cenas marcadas SÓ quando o evento dispara (no Meio), com o texto dele', () => {
      const soados: Array<[readonly string[], string]> = []
      const onAlarm = (cenas: readonly string[], texto: string): number => {
        soados.push([cenas, texto])
        return 2
      }
      render({ agora: { dia: 6, apito: 'sombra' }, eventos: [{ ...GEMEOS, efeito: SINO }] }, { cenas: CENAS, onAlarm })
      // A linha do evento diz que ele soa alarme (só o mestre vê).
      expect(container.querySelector('.lb-agenda__evento')?.textContent).toContain('Alarme')

      clica('Próximo apito')
      // Aurora: nada ao jogador, nem aviso na Caixa.
      expect(soados).toEqual([])
      expect(textosNaCaixa()).toEqual([])

      clica('Próximo apito')
      expect(soados).toEqual([[['salao', 'porao'], 'O sino da torre tocou!']])
      expect(textosNaCaixa()).toEqual(['Disparo dos Gêmeos — dia 7, Meio'])

      // Disparado uma vez: a hora andando não soa de novo.
      clica('Próximo apito')
      expect(soados).toHaveLength(1)
    })

    it('com a sala fechada o evento ainda avisa, e a Caixa diz que o alarme não soou', () => {
      render({ agora: { dia: 7, apito: 'aurora' }, eventos: [{ ...GEMEOS, efeito: SINO }] }, { cenas: CENAS })
      clica('Próximo apito')
      expect(textosNaCaixa()).toEqual(['Disparo dos Gêmeos — dia 7, Meio', 'Alarme de "Disparo dos Gêmeos" não soou: a sala não está aberta.'])
      expect(useToastStore.getState().toasts.map((t) => t.grupo)).toEqual([GRUPO_DA_AGENDA, GRUPO_DA_AGENDA])
    })

    it('o host recusou (null): a Caixa diz que não soou', () => {
      render({ agora: { dia: 7, apito: 'aurora' }, eventos: [{ ...GEMEOS, efeito: SINO }] }, { cenas: CENAS, onAlarm: () => null })
      clica('Próximo apito')
      expect(textosNaCaixa()).toEqual(['Disparo dos Gêmeos — dia 7, Meio', 'Alarme de "Disparo dos Gêmeos" não soou: a sala não está aberta.'])
    })

    it('marca pelo formulário um evento que soa alarme; sem cena escolhida não deixa marcar', () => {
      render({ agora: { dia: 3, apito: 'brasa' }, eventos: [] }, { cenas: CENAS })
      preenche('Evento', 'Disparo dos Gêmeos')
      preenche('Dia', '7')
      preenche('Apito', 'meio')
      marcaCaixa('Soar alarme ao disparar')
      preenche('Aviso de alarme', 'O sino da torre tocou!')
      // Cena sem arquivo não é oferecida: o host recusaria.
      expect(() => campo('Sumida')).toThrow()
      expect(botao('Marcar').disabled).toBe(true)

      marcaCaixa('Salão')
      marcaCaixa('Porão')
      expect(botao('Marcar').disabled).toBe(false)
      clica('Marcar')
      expect(agenda.eventos.map((e) => [e.titulo, e.efeito])).toEqual([['Disparo dos Gêmeos', SINO]])
      expect(textosNaCaixa()).toEqual([])
    })

    it('sem cena da aventura com arquivo, o formulário não oferece alarme', () => {
      render({ agora: { dia: 3, apito: 'brasa' }, eventos: [] })
      expect(() => campo('Soar alarme ao disparar')).toThrow()
      expect(container.querySelector('form[aria-label="Novo evento"]')).not.toBeNull()
    })
  })

  it('remove o evento pela linha', () => {
    render({ agora: { dia: 1, apito: 'aurora' }, eventos: [GEMEOS] })
    clica('Remover Disparo dos Gêmeos')
    expect(agenda.eventos).toEqual([])
    expect(container.textContent).toContain('Nenhum evento marcado')
  })
})
