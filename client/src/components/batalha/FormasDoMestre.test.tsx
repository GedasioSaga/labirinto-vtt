import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FormaPendente } from '../../lib/batalha/combate'
import { ficha, sistema } from '../../lib/batalha/fichasDaFatiaB.testkit'
import { PECA_DO_MESTRE_NA_FORMA } from '../../lib/batalha/mecanica/formaDoMestre'
import type { CartaoDaFicha, Personagem } from '../../lib/personagem'
import { FormasPendentes } from './FormasDoMestre'

/**
 * A TELA DO MESTRE AO TRANSFORMAR (construtor C6, revisão): dois pedidos
 * seguidos abrem as janelas uma depois da outra, e a habilidade da última
 * decisão vem oferecida, desmarcada, e não como "Já vem com a forma". Dados
 * inventados.
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

const GARRAS: CartaoDaFicha = { id: 'cart_garras', nome: 'Garras de Lua', campos: { efeito: '+30 no Atacar' }, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [], aMao: true }
const PELE: CartaoDaFicha = { ...GARRAS, id: 'cart_pele', nome: 'Pele Grossa', campos: {} }

function forma(id: string, nome: string, subcartoes: CartaoDaFicha[] = [], mecanica: CartaoDaFicha['mecanica'] = { ...PECA_DO_MESTRE_NA_FORMA }): CartaoDaFicha {
  return { id, nome, campos: {}, extras: [], atributos: [], imagem: null, modificadores: [{ atributo: 'forca', delta: 5 }], subcartoes, mecanica }
}

function pendente(id: string, personagem: Personagem, cartaoId: string, nome: string): FormaPendente {
  return { id, linhaId: `linha_${id}`, rodada: 1, cartaId: 'carta_1', autor: { tipo: 'mestre' }, tokenId: `token_${personagem.id}`, personagemId: personagem.id, cartaoId, nome, trocarImagem: false }
}

function montar(itens: readonly FormaPendente[], personagens: readonly Personagem[]): void {
  act(() =>
    root.render(
      <FormasPendentes
        itens={itens}
        personagens={personagens}
        sistema={sistema}
        turnos={{ vez: 'carta_1', rodada: 1 }}
        registro={[]}
        nomeDoToken={(tokenId) => personagens.find((personagem) => `token_${personagem.id}` === tokenId)?.nome ?? '?'}
        onDecidir={() => true}
        onRecusar={() => true}
      />,
    ),
  )
}

const tituloDaJanela = (): string | null => document.querySelector('[role="dialog"] h2')?.textContent ?? null

function clicarDepois(): void {
  const depois = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find((botao) => botao.textContent === 'Depois')
  if (depois === undefined) throw new Error('sem o Depois')
  act(() => depois.click())
}

describe('FormasPendentes (C6, revisão)', () => {
  it('o segundo pedido espera a janela do primeiro fechar e então abre sozinho; o que ficou para depois não reabre', () => {
    const may = ficha('May', {}, { hp: 500, sp: 50, escudo: 0 }, { transformacoes: [forma('cart_sulong_may', 'Sulong')] })
    const aira = { ...ficha('Aira', {}, { hp: 500, sp: 50, escudo: 0 }, { transformacoes: [forma('cart_sulong_aira', 'Sulong')] }), id: 'pers_aira' }
    const daMay = pendente('decisao_may', may, 'cart_sulong_may', 'Sulong')
    const daAira = pendente('decisao_aira', aira, 'cart_sulong_aira', 'Sulong')
    montar([daMay], [may, aira])
    expect(tituloDaJanela()).toBe('Sulong de May')
    montar([daMay, daAira], [may, aira])
    expect(tituloDaJanela()).toBe('Sulong de May')

    clicarDepois()
    expect(tituloDaJanela()).toBe('Sulong de Aira')
    clicarDepois()
    expect(tituloDaJanela()).toBeNull()
  })

  it('a habilidade da última decisão vem desmarcada, com o aviso, e a do cartão segue como "Já vem com a forma"', () => {
    const sulong = forma('cart_sulong', 'Sulong', [PELE, GARRAS], { ...PECA_DO_MESTRE_NA_FORMA, habilidade: GARRAS.id })
    const may = ficha('May', {}, { hp: 500, sp: 50, escudo: 0 }, { transformacoes: [sulong] })
    montar([pendente('decisao_may', may, sulong.id, 'Sulong')], [may])
    const janela = document.querySelector('[role="dialog"]')
    expect(janela?.textContent).toContain('Já vem com a forma: Pele Grossa.')
    expect(janela?.textContent).not.toContain('Já vem com a forma: Pele Grossa, Garras de Lua')
    expect(janela?.textContent).toContain('Da última vez ganhou Garras de Lua.')
    const marcar = janela?.querySelector<HTMLInputElement>('.bt-decisao__opcao input[type="checkbox"]')
    expect(marcar?.checked).toBe(false)
    act(() => marcar?.click())
    expect(janela?.querySelector<HTMLInputElement>('input.bt-num--texto')?.value).toBe('Garras de Lua')
  })
})
