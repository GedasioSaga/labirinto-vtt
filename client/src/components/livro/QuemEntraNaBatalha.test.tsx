import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ficha } from '../../lib/batalha/fichasDaFatiaB.testkit'
import type { LadoDoNpc } from '../../lib/batalha/equipes'
import type { CandidatoDaBatalha, EscolhaDaBatalha } from '../../lib/livros/combate'
import type { Personagem } from '../../lib/personagem'
import { QuemEntraNaBatalha } from './QuemEntraNaBatalha'

/**
 * Conserto de 09/11/2026 (achados 1 e 3 da auditoria da batalha): a lista de
 * quem entra não repete o clique velho do mapa ao nascer, vem com quem o
 * mestre selecionou no mapa, tem "Todos" e "Nenhum" e leva o lado de cada NPC.
 * Sem StrictMode, como o app montado. Dados inventados; no máximo 2 testes.
 */

function de(nome: string, tipo: Personagem['tipo']): Personagem {
  return { ...ficha(nome, { forca: 20 }, { hp: 300, sp: 60, escudo: 0 }, {}), tipo }
}

const capita = de('Capitã de Teste', 'jogador')
const ursoA = de('Urso de Teste', 'npc')
const ursoB = de('Urso de Teste', 'npc')
const arvore = de('Árvore de Teste', 'npc')
const personagens = [capita, ursoA, ursoB, arvore]
const candidatos: CandidatoDaBatalha[] = [
  { tokenId: 't_capita', nome: 'Capitã de Teste', personagemId: capita.id, situacao: 'combate' },
  { tokenId: 't_urso_1', nome: 'Urso de Teste', personagemId: ursoA.id, situacao: 'combate' },
  { tokenId: 't_urso_2', nome: 'Urso de Teste', personagemId: ursoB.id, situacao: 'combate' },
  { tokenId: 't_arvore', nome: 'Árvore de Teste', personagemId: arvore.id, situacao: 'combate' },
]

let container: HTMLDivElement
let root: Root

function marcadas(): string[] {
  return Array.from(container.querySelectorAll<HTMLInputElement>('.gr-entra input[type="checkbox"]'))
    .filter((caixa) => caixa.checked)
    .map((caixa) => caixa.closest('li')?.dataset.token ?? '')
}

function botao(texto: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((candidato) => candidato.textContent === texto)
  if (achado === undefined) throw new Error(`sem o botão "${texto}"`)
  return achado
}

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

describe('QuemEntraNaBatalha: a lista de quem luta', () => {
  it('a lista que nasce com um clique velho do mapa guardado não o repete: todos seguem marcados; o clique novo desmarca', () => {
    const montar = (seq: number) =>
      act(() => {
        root.render(<QuemEntraNaBatalha aberto candidatos={candidatos} jogadoresSemFicha={0} modelos={[]} personagens={personagens} cliqueNoMapa={{ tokenId: 't_urso_2', seq }} onConfirmar={() => undefined} onCancelar={() => undefined} />)
      })
    montar(1)
    expect(marcadas()).toEqual(['t_capita', 't_urso_1', 't_urso_2', 't_arvore'])
    montar(2)
    expect(marcadas()).toEqual(['t_capita', 't_urso_1', 't_arvore'])
  })

  it('vem com quem o mestre selecionou no mapa; "Nenhum" e "Todos" marcam de uma vez; o Iniciar leva os marcados e o lado de cada NPC', () => {
    const confirmados: { escolhas: EscolhaDaBatalha[]; lados: [string, LadoDoNpc][] }[] = []
    act(() => {
      root.render(
        <QuemEntraNaBatalha
          aberto
          candidatos={candidatos}
          jogadoresSemFicha={0}
          modelos={[]}
          personagens={personagens}
          marcadosDePartida={new Set(['t_capita', 't_urso_2'])}
          ladoDe={() => 'contra'}
          onConfirmar={(escolhas, lados) => confirmados.push({ escolhas, lados: [...lados] })}
          onCancelar={() => undefined}
        />,
      )
    })
    expect(marcadas()).toEqual(['t_capita', 't_urso_2'])
    act(() => botao('Nenhum').click())
    expect(marcadas()).toEqual([])
    act(() => botao('Todos').click())
    expect(marcadas()).toEqual(['t_capita', 't_urso_1', 't_urso_2', 't_arvore'])
    const ladoDaArvore = container.querySelector<HTMLSelectElement>('li[data-token="t_arvore"] select')
    if (ladoDaArvore === null) throw new Error('sem a escolha do lado da Árvore')
    act(() => {
      ladoDaArvore.value = 'jogadores'
      ladoDaArvore.dispatchEvent(new Event('change', { bubbles: true }))
    })
    act(() => botao('Iniciar com 4').click())
    expect(confirmados).toEqual([
      {
        escolhas: candidatos.map((candidato) => ({ tokenId: candidato.tokenId, como: { tipo: 'propria' } })),
        lados: [
          ['t_urso_1', 'contra'],
          ['t_urso_2', 'contra'],
          ['t_arvore', 'jogadores'],
        ],
      },
    ])
  })
})
