/**
 * "TRAZER DE OUTRA FICHA" nas Habilidades em edição (pedido do mestre,
 * 09/11/2026): o Frog traz a Bolha do Tree. O que entra é uma cópia, com a
 * mecânica por peças inteira e sem ligação com a original.
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ABA_DAS_TECNICAS } from '../lib/batalha/leituraDaFicha'
import { guardarMecanica, mecanicaDoModelo } from '../lib/batalha/mecanica/modelos'
import { novoCartao, novoPersonagem, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { copiaDoCartao } from '../lib/trazerDeOutraFicha'
import { FichaDePersonagem } from './FichaDePersonagem'

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

/** A Bolha do Tree: uma cura montada por peças (custo, ação, alvo, cura). */
const BOLHA: CartaoDaFicha = {
  ...novoCartao('Bolha'),
  id: 'cart_bolha_do_tree',
  campos: { efeito: 'Uma bolha de ar que cura quem está dentro.' },
  mecanica: guardarMecanica(mecanicaDoModelo('cura', SISTEMA_ONE_PIECE)),
}
const RAIZ: CartaoDaFicha = { ...novoCartao('Raiz'), id: 'cart_raiz_do_tree' }

const TREE: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'npc', 'Tree'), id: 'pers_tree', abas: { [ABA_DAS_TECNICAS]: [BOLHA, RAIZ] } }
const FROG: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'npc', 'Frog'), id: 'pers_frog' }
const SEM_GOLPES: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Nav'), id: 'pers_nav' }

/** O Frog em edição, guardando o rascunho como a janela guarda; `visto` recebe cada versão. */
function FrogEditando({ visto, fichas = [FROG, TREE, SEM_GOLPES] }: { visto: (p: Personagem) => void; fichas?: Personagem[] }) {
  const [personagem, setPersonagem] = useState(FROG)
  return (
    <FichaDePersonagem
      personagem={personagem}
      sistema={SISTEMA_ONE_PIECE}
      editando
      onChange={(novo) => {
        visto(novo)
        setPersonagem(novo)
      }}
      escolherImagem={async () => null}
      outrasFichas={fichas}
    />
  )
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith(nome))
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Trazer de outra ficha', () => {
  it('o Frog traz a Bolha do Tree: vem a mesma mecânica num cartão novo, e mudar a do Frog não muda a do Tree', () => {
    const visto = vi.fn<(p: Personagem) => void>()
    act(() => root.render(<FrogEditando visto={visto} />))
    act(() => botao('Trazer de outra ficha').click())

    // Só entra na lista quem tem habilidade: o Tree. O próprio Frog e o Nav (sem golpes) ficam de fora.
    const busca = container.querySelector<HTMLInputElement>('input[type="search"]')
    if (busca === null) throw new Error('sem a busca das fichas')
    expect(Array.from(container.querySelectorAll('.lb-trazer__ficha .lb-escolher__nome')).map((el) => el.firstChild?.textContent)).toEqual(['Tree'])

    // "bolha" acha o Tree pelo golpe, e a Bolha já vem marcada; a Raiz, não.
    digitar(busca, 'bolha')
    // O texto da linha começa pelas iniciais do retrato (decorativas): a linha é achada pela classe.
    const linhas = Array.from(container.querySelectorAll<HTMLButtonElement>('.lb-trazer__ficha'))
    expect(linhas).toHaveLength(1)
    act(() => linhas[0].click())
    const caixas = Array.from(container.querySelectorAll<HTMLInputElement>('.lb-trazer__cartao input'))
    expect(caixas.map((caixa) => caixa.checked)).toEqual([true, false])
    expect(container.querySelector('.lb-trazer__frases')?.textContent).not.toBe('')
    act(() => botao('Trazer 1 habilidade').click())

    const frog = visto.mock.calls.at(-1)?.[0]
    const trazida = frog?.abas[ABA_DAS_TECNICAS]?.[0]
    expect(frog?.abas[ABA_DAS_TECNICAS]).toHaveLength(1)
    expect(trazida?.nome).toBe('Bolha')
    expect(trazida?.id).not.toBe(BOLHA.id)
    expect(trazida?.campos).toEqual(BOLHA.campos)
    expect(trazida?.mecanica).toEqual(BOLHA.mecanica)
    // Cópia de verdade: nem o cartão nem a mecânica são o mesmo objeto do Tree.
    expect(trazida?.mecanica).not.toBe(BOLHA.mecanica)
    expect(container.querySelector('.lb-trazer__veio')?.textContent).toContain('Bolha veio de Tree')

    // Mudar o nome da cópia na ficha do Frog não toca o Tree.
    const nome = Array.from(container.querySelectorAll<HTMLInputElement>('.lb-cartao--edit input')).find((input) => input.value === 'Bolha')
    if (nome === undefined) throw new Error('sem o campo Nome da Bolha trazida')
    digitar(nome, 'Bolha do Frog')
    expect(visto.mock.calls.at(-1)?.[0].abas[ABA_DAS_TECNICAS]?.[0]?.nome).toBe('Bolha do Frog')
    expect(TREE.abas[ABA_DAS_TECNICAS]?.[0]).toBe(BOLHA)
    expect(BOLHA.nome).toBe('Bolha')
  })

  it('a técnica que mora dentro de uma transformação diz de que forma é: "da forma Gear 4", e "da Forma Híbrida" sem repetir a palavra', () => {
    const forma = (nome: string, tecnica: string): CartaoDaFicha => ({ ...novoCartao(nome), id: `cart_${nome}`, subcartoes: [{ ...novoCartao(tecnica), id: `cart_${tecnica}` }] })
    const treeComFormas: Personagem = { ...TREE, abas: { [ABA_DAS_TECNICAS]: [BOLHA], transformacoes: [forma('Gear 4', 'Esmagar'), forma('Forma Híbrida', 'Garra')] } }
    act(() => root.render(<FrogEditando visto={() => undefined} fichas={[FROG, treeComFormas]} />))
    act(() => botao('Trazer de outra ficha').click())
    const tree = container.querySelector<HTMLButtonElement>('.lb-trazer__ficha')
    if (tree === null) throw new Error('sem o Tree na lista de fichas')
    act(() => tree.click())

    const origens = Array.from(container.querySelectorAll('.lb-trazer__cartao')).map((linha) => [
      linha.querySelector('.lb-escolher__nome')?.firstChild?.textContent,
      linha.querySelector('.lb-escolher__ja')?.textContent ?? null,
    ])
    // A Bolha é solta na aba: sem origem. As outras duas saem de dentro das formas.
    expect(origens).toEqual([
      ['Bolha', null],
      ['Esmagar', 'da forma Gear 4'],
      ['Garra', 'da Forma Híbrida'],
    ])
  })

  it('copiaDoCartao: ids novos de cima a baixo, a mecânica inteira, sem a proposta do dono nem a arma padrão', () => {
    const proposta = guardarMecanica(mecanicaDoModelo('golpe', SISTEMA_ONE_PIECE))
    const forma: CartaoDaFicha = {
      ...novoCartao('Forma Gigante'),
      id: 'cart_forma',
      extras: [{ nome: 'Opção 2', valor: 'Esmaga' }],
      subcartoes: [{ ...BOLHA, mecanicaProposta: proposta }],
      armaPadrao: true,
    }
    const copia = copiaDoCartao(forma)
    expect(copia.id).not.toBe(forma.id)
    expect(copia.armaPadrao).toBeUndefined()
    expect(copia.extras).toEqual(forma.extras)
    expect(copia.extras).not.toBe(forma.extras)
    expect(copia.subcartoes).toHaveLength(1)
    expect(copia.subcartoes[0].id).not.toBe(BOLHA.id)
    expect(copia.subcartoes[0].mecanica).toEqual(BOLHA.mecanica)
    expect(copia.subcartoes[0].mecanicaProposta).toBeUndefined()
    // Mexer na cópia (como o editor faz, trocando o objeto) não alcança o original.
    copia.extras[0].valor = 'Outra coisa'
    expect(forma.extras[0].valor).toBe('Esmaga')
  })
})
