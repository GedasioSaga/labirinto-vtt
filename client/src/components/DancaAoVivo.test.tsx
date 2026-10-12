import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MINIGAME_PADRAO } from '../minigames/danca/tipos'
import type { DancaAoVivo, DancaParticipanteNoMestre } from '../net/dancaNoHost'
import { CHAMAR_PARA_DANCAR, DancaAoVivoPainel, textoDoConviteRecusado, textoDoStatus, type DancaAoVivoProps } from './DancaAoVivo'

/**
 * A DANÇA AO VIVO no painel do pino: o convite vai só aos marcados, "Começar"
 * espera alguém pronto, pausar/retomar/encerrar chamam a ponte, o placar
 * aparece por jogador e, no fim, o desfecho com a porta e o que cada um levou.
 */

const PIN = 'pin-danca'
const JOGADORES = [
  { playerId: 'p-ana', name: 'Ana' },
  { playerId: 'p-bruno', name: 'Bruno' },
  { playerId: 'p-caio', name: 'Caio' },
]

function pessoa(playerId: string, nome: string, extra: Partial<DancaParticipanteNoMestre> = {}): DancaParticipanteNoMestre {
  return { playerId, nome, status: 'convidado', conectado: true, ...extra }
}

function danca(extra: Partial<DancaAoVivo> = {}): DancaAoVivo {
  return {
    sessao: 's1',
    pinId: PIN,
    npc: 'Dona Ziza',
    fase: 'convite',
    notaMin: 'B',
    temPorta: true,
    premio: { ...MINIGAME_PADRAO.premio },
    consequencia: { ...MINIGAME_PADRAO.consequencia },
    participantes: [pessoa('p-ana', 'Ana'), pessoa('p-bruno', 'Bruno')],
    ...extra,
  }
}

const FINAL_A = { precisao: 0.931, letra: 'A', falhou: false, perfeito: 40, bom: 5, ok: 2, errou: 1, comboMax: 22, segOk: 3, segTotal: 3 } as const

describe('DancaAoVivoPainel', () => {
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

  function props(extra: Partial<DancaAoVivoProps> = {}): DancaAoVivoProps {
    return {
      pinId: PIN,
      players: JOGADORES,
      danca: null,
      onConvidar: vi.fn(() => ({ ok: true as const, sessao: 's1', convidados: 2 })),
      onComecar: vi.fn(() => true),
      onPausar: vi.fn(() => true),
      onRetomar: vi.fn(() => true),
      onEncerrar: vi.fn(() => true),
      ...extra,
    }
  }

  function render(p: DancaAoVivoProps): void {
    act(() => root.render(<DancaAoVivoPainel {...p} />))
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === nome)
    if (achado === undefined) throw new Error(`sem botão "${nome}"`)
    return achado
  }

  function caixa(nome: string): HTMLInputElement {
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent === nome)
    const input = label?.querySelector('input')
    if (input === null || input === undefined) throw new Error(`sem caixa "${nome}"`)
    return input
  }

  it('"Chamar para dançar" abre a lista com todos marcados e o convite vai só aos marcados', () => {
    const p = props()
    render(p)
    expect(container.querySelector('form')).toBeNull()
    act(() => botao(CHAMAR_PARA_DANCAR).click())
    expect(botao(CHAMAR_PARA_DANCAR).getAttribute('aria-expanded')).toBe('true')
    expect(JOGADORES.map((j) => caixa(j.name).checked)).toEqual([true, true, true])
    // O foco vai ao "Enviar convite": Enter já chama.
    expect(document.activeElement?.textContent).toBe('Enviar convite')
    act(() => caixa('Bruno').click())
    act(() => botao('Enviar convite').click())
    expect(p.onConvidar).toHaveBeenCalledWith(['p-ana', 'p-caio'])
    // Saiu: a lista fecha (a dança aparece pela ponte).
    expect(container.querySelector('form')).toBeNull()
  })

  it('ninguém marcado: "Enviar convite" desliga e diz por quê; Esc fecha sem chamar', () => {
    const p = props({ players: [JOGADORES[0]] })
    render(p)
    act(() => botao(CHAMAR_PARA_DANCAR).click())
    act(() => caixa('Ana').click())
    expect(botao('Enviar convite').disabled).toBe(true)
    expect(container.textContent).toContain('Marque ao menos um jogador.')
    const form = container.querySelector('form')
    act(() => form?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(container.querySelector('form')).toBeNull()
    expect(p.onConvidar).not.toHaveBeenCalled()
  })

  it('convite recusado: a frase do motivo', () => {
    render(props({ onConvidar: vi.fn(() => ({ ok: false as const, motivo: 'ocupada' as const })) }))
    act(() => botao(CHAMAR_PARA_DANCAR).click())
    act(() => botao('Enviar convite').click())
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(textoDoConviteRecusado({ ok: false, motivo: 'ocupada' }))
    expect(textoDoConviteRecusado(null)).toBe('Não deu: a sala não está aberta.')
  })

  it('"Começar" só com alguém pronto e na sala; o status mostra a dificuldade escolhida', () => {
    const p = props({ danca: danca() })
    render(p)
    expect(botao('Começar').disabled).toBe(true)
    expect(container.textContent).toContain('Começa quando alguém marcar Pronto.')
    // Pronto mas fora do ar não conta: não ouviria o "começar".
    render({ ...p, danca: danca({ participantes: [pessoa('p-ana', 'Ana', { status: 'pronto', dificuldade: 'expert', conectado: false })] }) })
    expect(botao('Começar').disabled).toBe(true)
    render({ ...p, danca: danca({ participantes: [pessoa('p-ana', 'Ana', { status: 'pronto', dificuldade: 'expert' }), pessoa('p-bruno', 'Bruno')] }) })
    expect(container.textContent).toContain('Pronto · Expert')
    expect(container.textContent).toContain('Convidado')
    expect(botao('Começar').disabled).toBe(false)
    act(() => botao('Começar').click())
    expect(p.onComecar).toHaveBeenCalledTimes(1)
  })

  it('na música: placar ao vivo por jogador, vida no Expert, e "Pausar"/"Encerrar para todos" chamam a ponte', () => {
    const p = props({
      danca: danca({
        fase: 'musica',
        participantes: [
          pessoa('p-ana', 'Ana', { status: 'dancando', dificuldade: 'expert', placar: { precisao: 0.931, combo: 22, vida: 74, julgadas: 30 } }),
          pessoa('p-bruno', 'Bruno', { status: 'dancando', dificuldade: 'diversao', placar: { precisao: 1, combo: 29, vida: 60, julgadas: 31 } }),
          pessoa('p-caio', 'Caio', { status: 'fora' }),
        ],
      }),
    })
    render(p)
    expect(container.textContent).toContain('Precisão 93,1% · Combo 22')
    expect(container.textContent).toContain('Precisão 100,0% · Combo 29')
    expect(container.textContent).toContain('Ficou de fora')
    const vidas = Array.from(container.querySelectorAll('[role="meter"]'))
    // Só o Expert tem vida.
    expect(vidas.map((v) => [v.getAttribute('aria-label'), v.getAttribute('aria-valuenow')])).toEqual([['Vida de Ana', '74']])
    act(() => botao('Pausar para todos').click())
    expect(p.onPausar).toHaveBeenCalledTimes(1)
    act(() => botao('Encerrar para todos').click())
    expect(p.onEncerrar).toHaveBeenCalledTimes(1)
  })

  it('pausado: "Retomar para todos" chama a ponte e quem dança aparece pausado', () => {
    const p = props({ danca: danca({ fase: 'pausa', participantes: [pessoa('p-ana', 'Ana', { status: 'dancando', dificuldade: 'diversao' })] }) })
    render(p)
    expect(container.textContent).toContain('Pausado')
    act(() => botao('Retomar para todos').click())
    expect(p.onRetomar).toHaveBeenCalledTimes(1)
    expect(p.onPausar).not.toHaveBeenCalled()
  })

  it('no fim: o desfecho (todos passaram, a porta abriu, o item de cada um) e "Fechar" volta ao chamar', () => {
    const fim = danca({
      fase: 'fim',
      desfecho: { todosPassaram: true, portaAberta: true },
      participantes: [
        pessoa('p-ana', 'Ana', { status: 'terminou', dificuldade: 'expert', final: FINAL_A, passou: true }),
        pessoa('p-bruno', 'Bruno', { status: 'terminou', dificuldade: 'diversao', final: { ...FINAL_A, letra: 'S', precisao: 0.97 }, passou: true }),
      ],
    })
    render(props({ danca: fim }))
    const desfecho = container.querySelector('.lb-danca__desfecho')
    expect(desfecho?.textContent).toContain('Todos passaram')
    expect(desfecho?.textContent).toContain('A porta abriu.')
    expect(desfecho?.textContent).toContain('Nota A · 93,1%')
    expect(desfecho?.textContent).toContain('Recebeu: Chave de latão')
    act(() => botao('Fechar').click())
    expect(container.querySelector('.lb-danca__desfecho')).toBeNull()
    expect(botao(CHAMAR_PARA_DANCAR).disabled).toBe(false)
  })

  it('no fim sem todos passarem: quem não passou leva a consequência, e a porta fica fechada', () => {
    const fim = danca({
      fase: 'fim',
      desfecho: { todosPassaram: false, portaAberta: false },
      participantes: [
        pessoa('p-ana', 'Ana', { status: 'terminou', final: FINAL_A, passou: true }),
        pessoa('p-bruno', 'Bruno', { status: 'terminou', final: { ...FINAL_A, falhou: true, letra: 'D' }, passou: false }),
        pessoa('p-caio', 'Caio', { status: 'saiu', passou: false }),
      ],
    })
    render(props({ danca: fim }))
    const texto = container.querySelector('.lb-danca__desfecho')?.textContent ?? ''
    expect(texto).toContain('Nem todos passaram')
    expect(texto).toContain('A porta continua fechada.')
    expect(texto).toContain('Falhou')
    expect(texto).toContain('Saiu no meio')
    expect(texto.match(/Penalidade: −2 no próximo teste de Agilidade/g)?.length).toBe(2)
    expect(texto).not.toContain('Recebeu')
  })

  it('o desfecho diz o prêmio e a consequência da DANÇA (congelados no convite), não os de um pino editado depois', () => {
    const fim = danca({
      fase: 'fim',
      premio: { tipo: 'pista', texto: 'A chave está sob o altar' },
      consequencia: { tipo: 'barulho', texto: '' },
      desfecho: { todosPassaram: true, portaAberta: true },
      participantes: [pessoa('p-ana', 'Ana', { status: 'terminou', final: FINAL_A, passou: true })],
    })
    render(props({ danca: fim }))
    const texto = container.querySelector('.lb-danca__desfecho')?.textContent ?? ''
    expect(texto).toContain('Pista no caderno: A chave está sob o altar')
    expect(texto).not.toContain('Chave de latão')
    render(props({ danca: { ...fim, desfecho: { todosPassaram: false, portaAberta: false }, participantes: [pessoa('p-ana', 'Ana', { status: 'terminou', final: { ...FINAL_A, falhou: true, letra: 'D' }, passou: false })] } }))
    expect(container.querySelector('.lb-danca__desfecho')?.textContent).toContain('Barulho: narre o que ele chamou')
  })

  it('encerrada pelo mestre: nada foi ganho nem perdido', () => {
    render(props({ danca: danca({ fase: 'encerrada' }) }))
    expect(container.textContent).toContain('Dança encerrada: nada foi ganho nem perdido.')
    act(() => botao('Fechar').click())
    expect(botao(CHAMAR_PARA_DANCAR)).toBeDefined()
  })

  it('dança acontecendo em OUTRO pino: o chamar desliga e diz por quê', () => {
    render(props({ danca: danca({ pinId: 'outro', fase: 'musica' }) }))
    expect(botao(CHAMAR_PARA_DANCAR).disabled).toBe(true)
    expect(container.textContent).toContain('Já há uma dança acontecendo em outro pino.')
  })

  it('textoDoStatus: cada status na palavra do mestre', () => {
    expect(textoDoStatus(pessoa('a', 'A', { status: 'convidado', conectado: false }), 'convite')).toBe('Convidado · fora do ar')
    expect(textoDoStatus(pessoa('a', 'A', { status: 'pronto', dificuldade: 'diversao' }), 'convite')).toBe('Pronto · Diversão')
    expect(textoDoStatus(pessoa('a', 'A', { status: 'dancando' }), 'musica')).toBe('Dançando')
    expect(textoDoStatus(pessoa('a', 'A', { status: 'terminou', final: FINAL_A }), 'musica')).toBe('Terminou · A')
    expect(textoDoStatus(pessoa('a', 'A', { status: 'saiu' }), 'musica')).toBe('Saiu')
  })
})
