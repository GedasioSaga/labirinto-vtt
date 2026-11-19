import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpcaoDaPendencia } from '../../../lib/dbt/batalha/tipos'
import type { PendenciaDBTParaJogador, VistaDBT } from '../../../lib/dbt/batalha/vista'
import { BatalhaDoJogadorDBT, type EnvioDaBatalhaDBT } from './BatalhaDoJogadorDBT'

/**
 * Conserto de 18/11/2026 ("às vezes não aparecia para reagir"; "às vezes
 * ficava na lateral em vez do meio"): a resposta que a mesa espera DELE agora
 * (a pendência ativa, também a reação sem janela à vista, quando atacante e
 * alvo estão fora do recorte) vai para a caixa do meio (`.dbb-jogador-reacao`).
 * No menu da lateral fica só a fila.
 */
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

const DEFENDER: OpcaoDaPendencia = { chave: 'defender', rotulo: 'Defender', ki: 0, gratis: true, bloqueio: null, pede: null }

function pendencia(id: string, ativa: boolean, texto: string): PendenciaDBTParaJogador {
  return { id, tipo: 'reacao', combatenteId: 'tok_goku', ativa, texto, opcoes: [DEFENDER] }
}

function vistaCom(pendencias: PendenciaDBTParaJogador[]): VistaDBT {
  return {
    fase: 'combate',
    rodada: 2,
    modo: 'automatico',
    vez: null,
    minhaVez: false,
    turno: { n: 1, m: 3 },
    cartas: [],
    meus: [],
    declaracoes: [],
    pendencias,
    // Atacante e alvo fora do recorte: o host não manda janela.
    janela: null,
    aguardando: null,
    registro: [],
  }
}

function envio() {
  const responder = vi.fn()
  const enviar: EnvioDaBatalhaDBT = { declarar: vi.fn(), agir: vi.fn(), responder, passar: vi.fn(), desfazer: vi.fn() }
  return { enviar, responder }
}

describe('BatalhaDoJogadorDBT: a resposta esperada vai para o meio', () => {
  it('reação ativa sem janela à vista abre na caixa do meio, com o botão, e responde a pendência certa', () => {
    const { enviar, responder } = envio()
    act(() => root.render(<BatalhaDoJogadorDBT vista={vistaCom([pendencia('p1', true, 'Reaja ao golpe em Goku')])} enviar={enviar} />))
    const meio = container.querySelector('.dbb-jogador-reacao')
    const menu = container.querySelector('.dbb-jogador-menu')
    expect(meio?.textContent).toContain('Reaja ao golpe em Goku')
    expect(menu?.textContent).not.toContain('Reaja ao golpe em Goku')
    expect(menu?.textContent).toContain('A mesa espera a sua resposta')
    const botao = [...(meio?.querySelectorAll('button') ?? [])].find((candidato) => candidato.textContent?.includes('Defender'))
    if (botao === undefined) throw new Error('sem o botão Defender na caixa do meio')
    act(() => botao.click())
    expect(responder).toHaveBeenCalledWith({ pendenciaId: 'p1', combatenteId: 'tok_goku', opcao: 'defender' })
  })

  it('pendência na fila (não ativa) fica no menu, sem caixa do meio', () => {
    act(() => root.render(<BatalhaDoJogadorDBT vista={vistaCom([pendencia('p2', false, 'Reação na fila')])} enviar={envio().enviar} />))
    expect(container.querySelector('.dbb-jogador-reacao')).toBeNull()
    expect(container.querySelector('.dbb-jogador-menu')?.textContent).toContain('Na fila: responde quando chegar a vez desta.')
  })
})
