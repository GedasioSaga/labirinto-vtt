import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PEIXES } from '../minigames/pesca/sim'
import type { PescaAoVivo, PescaParticipanteNoMestre } from '../net/pescaNoHost'
import { PescaAoVivoPainel, type PescaAoVivoProps } from './PescaAoVivo'

/**
 * O PLACAR DA PESCA no painel do mestre: o que cada um faz em palavras, o
 * lance k de N, o medidor, o cesto e o maior peixe; "Chamar para pescar" só
 * no modo mestre (e sem quem já está dentro); pausar, continuar e encerrar
 * chegam à ponte; recusa aparece em vez de clique mudo.
 */

const PINO = 'pino-lago'
const BAGRE = { peixe: PEIXES[0].id, cm: 30, estrelas: 1, perfeito: false, bau: false }
const GRANDE = { peixe: PEIXES[1].id, cm: 88, estrelas: 3, perfeito: false, bau: false }

function pessoas(): PescaParticipanteNoMestre[] {
  return [
    { playerId: 'p1', nome: 'Bia', status: 'pescando', conectado: true, dificuldade: 'normal', vivo: { fase: 'puxada', lance: 2, de: 3, medidor: 0.63 }, lances: [{ lance: 1, resultado: 'pegou', peixe: BAGRE }], cesto: [BAGRE], maior: BAGRE },
    { playerId: 'p2', nome: 'Caio', status: 'pescando', conectado: true, dificuldade: 'extremo', vivo: { fase: 'espera', lance: 1, de: 3, medidor: 0 }, lances: [], cesto: [] },
    { playerId: 'p3', nome: 'Duda', status: 'terminou', conectado: true, dificuldade: 'normal', lances: [{ lance: 1, resultado: 'pegou', peixe: GRANDE }, { lance: 2, resultado: 'fugiu' }, { lance: 3, resultado: 'escapou' }], cesto: [GRANDE], maior: GRANDE },
    { playerId: 'p4', nome: 'Eva', status: 'convidado', conectado: false, lances: [], cesto: [] },
  ]
}

function pesca(extra: Partial<PescaAoVivo> = {}): PescaAoVivo {
  return { sessao: 's1', pinId: PINO, npc: 'Bento', lago: 'Poço', entrada: 'mestre', lances: 3, fase: 'aberta', participantes: pessoas(), ...extra }
}

describe('PescaAoVivoPainel', () => {
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

  function props(extra: Partial<PescaAoVivoProps> = {}): PescaAoVivoProps {
    return {
      pinId: PINO,
      entrada: 'mestre',
      players: [
        { playerId: 'p1', name: 'Bia' },
        { playerId: 'p9', name: 'Zeca' },
      ],
      pesca: pesca(),
      onConvidar: vi.fn(() => ({ ok: true as const, sessao: 's1', convidados: 1 })),
      onPausar: vi.fn(() => true),
      onRetomar: vi.fn(() => true),
      onEncerrar: vi.fn(() => true),
      ...extra,
    }
  }

  function render(p: PescaAoVivoProps): void {
    act(() => root.render(<PescaAoVivoPainel {...p} />))
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === nome)
    if (achado === undefined) throw new Error(`sem botão "${nome}"`)
    return achado
  }

  const linhas = (): string[] => Array.from(container.querySelectorAll('.lb-pesca-vivo__pessoa')).map((li) => li.textContent ?? '')

  it('uma linha por jogador: estado em palavras, lance k de N, cesto, maior peixe e dificuldade', () => {
    render(props())
    const [bia, caio, duda, eva] = linhas()
    expect(bia).toContain('puxando 63%')
    expect(bia).toContain('Lance 2 de 3')
    expect(bia).toContain(`Maior ${PEIXES[0].nome}, 30 cm`)
    expect(bia).toContain('Normal')
    expect(caio).toContain('esperando')
    expect(caio).toContain('Extremo')
    expect(duda).toContain('terminou')
    expect(duda).toContain('3 de 3 lances')
    expect(duda).toContain('Cesto 1')
    expect(eva).toContain('no convite · fora do ar')
    expect(eva).toContain('Sem dificuldade ainda')
    const medidor = container.querySelector('[role="meter"]')
    expect(medidor?.getAttribute('aria-valuenow')).toBe('63')
    expect(medidor?.querySelector('i')?.getAttribute('style')).toContain('scaleX(0.630)')
  })

  it('pausada: "pausado" na linha e "Continuar para todos" chama o retomar', () => {
    const p = props({ pesca: pesca({ fase: 'pausa' }) })
    render(p)
    expect(linhas()[0]).toContain('pausado')
    act(() => botao('Continuar para todos').click())
    expect(p.onRetomar).toHaveBeenCalledTimes(1)
  })

  it('pausar e encerrar chegam à ponte; recusa vira aviso', () => {
    const p = props({ onEncerrar: vi.fn(() => false) })
    render(p)
    act(() => botao('Pausar para todos').click())
    expect(p.onPausar).toHaveBeenCalledTimes(1)
    act(() => botao('Encerrar para todos').click())
    expect(p.onEncerrar).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Não deu: a pesca já acabou ou a sala fechou.')
  })

  it('encerrada: a linha diz e não há mais pausar nem encerrar', () => {
    render(props({ pesca: pesca({ fase: 'encerrada' }) }))
    expect(container.textContent).toContain('Pesca encerrada.')
    expect(linhas()[0]).toContain('encerrado')
    expect(container.textContent).not.toContain('Pausar para todos')
    expect(container.textContent).not.toContain('Encerrar para todos')
  })

  it('"Chamar para pescar": lista quem não está na pesca, todos marcados, e envia', () => {
    const p = props()
    render(p)
    act(() => botao('Chamar para pescar').click())
    const nomes = Array.from(container.querySelectorAll('.lb-pesca-vivo__convite .lb-pesca-vivo__nome')).map((n) => n.textContent)
    // Bia já está pescando: só o Zeca aparece.
    expect(nomes).toEqual(['Zeca'])
    act(() => botao('Enviar convite').click())
    expect(p.onConvidar).toHaveBeenCalledWith(['p9'])
    expect(container.querySelector('.lb-pesca-vivo__convite')).toBeNull()
  })

  it('convite recusado: o aviso diz por quê e a lista fica aberta', () => {
    render(props({ onConvidar: vi.fn(() => ({ ok: false as const, motivo: 'ninguem' as const })) }))
    act(() => botao('Chamar para pescar').click())
    act(() => botao('Enviar convite').click())
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Ninguém marcado está jogando agora.')
    expect(container.querySelector('.lb-pesca-vivo__convite')).not.toBeNull()
  })

  it('modo "Jogador toca no pino": sem "Chamar para pescar", com a nota de como começa', () => {
    render(props({ entrada: 'pino', pesca: null }))
    expect(container.textContent).not.toContain('Chamar para pescar')
    expect(container.textContent).toContain('Os jogadores começam tocando no pino.')
  })

  it('pesca de outro pino não aparece neste', () => {
    render(props({ pesca: pesca({ pinId: 'outro' }) }))
    expect(linhas()).toEqual([])
  })
})
