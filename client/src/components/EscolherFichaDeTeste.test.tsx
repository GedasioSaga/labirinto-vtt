import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FichaParaTeste } from '../net/visaoDeTeste/tipos'
import {
  EscolherFichaDeTeste,
  FOLGA_DA_ANCORA,
  LARGURA_DA_ESCOLHA,
  MARGEM_DA_TELA,
  contadorDaBusca,
  fichaCasaComBusca,
  iniciaisDaFicha,
  iniciaisEscuras,
  lugarDaEscolha,
  ordenarFichas,
  palavrasDaBusca,
  trechosComBusca,
  type EscolherFichaDeTesteProps,
} from './EscolherFichaDeTeste'

/*
 * VISÃO DE JOGADOR — a lista "Escolher a ficha" (maquete 2A a 2D): a
 * selecionada no mapa primeiro, as com jogador antes das sem jogador, busca
 * sem acento por ficha e por jogador, teclado de combobox e os dois vazios.
 */

function ficha(id: string, nome: string, dono: string | null, cor = '#35b24a'): FichaParaTeste {
  return { id, nome, dono, retrato: null, cor, npc: dono === null }
}

const GOBLINS = Array.from({ length: 20 }, (_, i) => ficha(`gob${i + 1}`, `Goblin batedor ${i + 1}`, null, '#d6452f'))

/** As 30 fichas da maquete 2A, fora de ordem de propósito. */
const FICHAS: FichaParaTeste[] = [
  ficha('ze', 'Zé', 'Lu', '#5a8fd6'),
  ficha('cap', 'Capitão Gorzûl, o Que Ri por Último', null, '#d6452f'),
  ficha('grog', 'Grog', 'Ana'),
  ficha('lyra', 'Lyra Ventoleste', 'Bruno', '#5a8fd6'),
  ficha('irma', 'Irmã Benedita das Sete Chagas e do Perpétuo Socorro', 'Maria Eduarda Albuquerque de Sá', '#9a5fd0'),
  ficha('kael', 'Kael', 'Rafael'),
  ficha('tobias', 'Tobias “Pé-Leve” Moreira', 'Caio', '#d99a2b'),
  ficha('cult', 'Cultista encapuzado', null, '#9a5fd0'),
  ficha('esq', 'Esqueleto', null, '#b8bec8'),
  ficha('sac', 'Sacerdotisa Anaïs', null, '#9a5fd0'),
  ...GOBLINS,
]

describe('regras puras da lista', () => {
  it('ordem: a selecionada primeiro, depois com jogador, por fim sem jogador, cada grupo alfabético com número em ordem de número', () => {
    const ids = ordenarFichas(FICHAS, 'grog').map((f) => f.id)
    expect(ids.slice(0, 6)).toEqual(['grog', 'irma', 'kael', 'lyra', 'tobias', 'ze'])
    expect(ids.slice(6, 9)).toEqual(['cap', 'cult', 'esq'])
    expect(ids.slice(9, 29)).toEqual(GOBLINS.map((g) => g.id))
    expect(ids[29]).toBe('sac')
    // Sem seleção (ou com o id de uma ficha que saiu do mapa), só a ordem dos grupos: Grog volta ao lugar dele no G.
    expect(ordenarFichas(FICHAS, null).map((f) => f.id).slice(0, 3)).toEqual(['grog', 'irma', 'kael'])
    expect(ordenarFichas(FICHAS, 'sumiu').map((f) => f.id).slice(0, 3)).toEqual(['grog', 'irma', 'kael'])
    expect(ordenarFichas(FICHAS, 'esq')[0]?.id).toBe('esq')
  })

  it('busca sem acento nem maiúscula, pela ficha e pelo jogador; toda palavra precisa casar', () => {
    const achadas = (busca: string) => FICHAS.filter((f) => fichaCasaComBusca(f, palavrasDaBusca(busca))).map((f) => f.id)
    expect(achadas('ana').sort()).toEqual(['grog', 'sac'])
    expect(achadas('ANAÏS')).toEqual(['sac'])
    expect(achadas('irma')).toEqual(['irma'])
    expect(achadas('grog ana')).toEqual(['grog'])
    expect(achadas('grog bruno')).toEqual([])
    expect(achadas('   ')).toHaveLength(30)
  })

  it('o realce volta ao texto com acento, inclusive com o acento solto (decomposto)', () => {
    expect(trechosComBusca('Sacerdotisa Anaïs', ['ana'])).toEqual([
      { texto: 'Sacerdotisa ', marca: false },
      { texto: 'Ana', marca: true },
      { texto: 'ïs', marca: false },
    ])
    const decomposto = 'Anai' + String.fromCharCode(0x308) + 's'
    expect(trechosComBusca(decomposto, ['anai'])).toEqual([
      { texto: 'Anai' + String.fromCharCode(0x308), marca: true },
      { texto: 's', marca: false },
    ])
    expect(trechosComBusca('Grog', [])).toEqual([{ texto: 'Grog', marca: false }])
  })

  it('o contador diz o total parado e "N de total" buscando', () => {
    expect(contadorDaBusca(30, 30, false)).toBe('30 fichas')
    expect(contadorDaBusca(1, 1, false)).toBe('1 ficha')
    expect(contadorDaBusca(2, 30, true)).toBe('2 de 30')
  })

  it('iniciais: as duas primeiras palavras fortes, sem o apelido entre aspas', () => {
    expect(iniciaisDaFicha('Grog')).toBe('G')
    expect(iniciaisDaFicha('Irmã Benedita das Sete Chagas e do Perpétuo Socorro')).toBe('IB')
    expect(iniciaisDaFicha('Tobias “Pé-Leve” Moreira')).toBe('TM')
    expect(iniciaisDaFicha('Capitão Gorzûl, o Que Ri por Último')).toBe('CG')
    expect(iniciaisDaFicha('Goblin batedor 1')).toBe('G1')
    // Numa leva numerada é o número que diferencia: entra inteiro (até dois algarismos).
    expect(iniciaisDaFicha('Goblin batedor 13')).toBe('G13')
    expect(iniciaisDaFicha('(Ana) 2ª ficha')).toBe('A2')
    expect(iniciaisDaFicha('Cultista encapuzado')).toBe('CE')
    expect(iniciaisDaFicha('zé')).toBe('Z')
    expect(iniciaisDaFicha('   ')).toBe('?')
  })

  it('iniciais escuras só no disco claro (âmbar, cinza), como na maquete', () => {
    expect(iniciaisEscuras('#d99a2b')).toBe(true)
    expect(iniciaisEscuras('#b8bec8')).toBe(true)
    for (const cor of ['#35b24a', '#5a8fd6', '#9a5fd0', '#d6452f']) expect(iniciaisEscuras(cor)).toBe(false)
    expect(iniciaisEscuras('vermelho')).toBe(false)
  })

  it('lugar: colada embaixo do botão com a borda direita alinhada; presa à margem; sem espaço embaixo, abre para cima', () => {
    const tela = { largura: 1280, altura: 800 }
    const embaixo = lugarDaEscolha({ esquerda: 1000, topo: 160, direita: 1232, base: 194 }, tela)
    expect(embaixo).toMatchObject({ esquerda: 1232 - LARGURA_DA_ESCOLHA, topo: 194 + FOLGA_DA_ANCORA, base: null, origem: `${LARGURA_DA_ESCOLHA}px 0` })
    expect(embaixo.alturaMaxima).toBe(800 - MARGEM_DA_TELA - 194 - FOLGA_DA_ANCORA)
    // Botão encostado na esquerda: a lista não sai da tela.
    expect(lugarDaEscolha({ esquerda: 10, topo: 10, direita: 60, base: 38 }, tela).esquerda).toBe(MARGEM_DA_TELA)
    // Botão no pé da tela: abre para cima, crescendo do canto de baixo.
    const emCima = lugarDaEscolha({ esquerda: 1000, topo: 700, direita: 1232, base: 734 }, tela)
    expect(emCima).toMatchObject({ topo: null, base: 800 - 700 + FOLGA_DA_ANCORA, origem: `${LARGURA_DA_ESCOLHA}px 100%` })
    // Janela estreita: a lista encolhe para caber com as margens.
    expect(lugarDaEscolha({ esquerda: 200, topo: 0, direita: 290, base: 34 }, { largura: 300, altura: 800 }).largura).toBe(300 - 2 * MARGEM_DA_TELA)
  })
})

describe('EscolherFichaDeTeste', () => {
  let container: HTMLDivElement
  let root: Root
  let ancora: HTMLButtonElement

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    ancora = document.createElement('button')
    ancora.textContent = 'Visão de jogador'
    document.body.appendChild(ancora)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    ancora.remove()
  })

  function montar(props: Partial<EscolherFichaDeTesteProps> = {}) {
    const onEscolher = vi.fn()
    const onFechar = vi.fn()
    act(() =>
      root.render(
        <EscolherFichaDeTeste
          fichas={FICHAS}
          fichaSelecionadaId="grog"
          ancora={ancora}
          abertura="ponteiro"
          acaoDoEnter="abrir"
          onEscolher={onEscolher}
          onFechar={onFechar}
          {...props}
        />,
      ),
    )
    return { onEscolher, onFechar }
  }

  function dialogo(): HTMLElement {
    const achado = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Escolher a ficha"]')
    if (achado === null) throw new Error('a lista não abriu')
    return achado
  }

  function campo(): HTMLInputElement {
    const achado = dialogo().querySelector<HTMLInputElement>('input[role="combobox"]')
    if (achado === null) throw new Error('sem a busca')
    return achado
  }

  function linhas(): HTMLElement[] {
    return [...dialogo().querySelectorAll<HTMLElement>('[role="option"]')]
  }

  function ativa(): HTMLElement | undefined {
    return linhas().find((linha) => linha.getAttribute('aria-selected') === 'true')
  }

  function tecla(key: string, alvo: Element = campo()): KeyboardEvent {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    act(() => {
      alvo.dispatchEvent(evento)
    })
    return evento
  }

  function digitar(texto: string): void {
    const definir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      definir?.call(campo(), texto)
      campo().dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('abre com o foco na busca, a selecionada primeiro e ativa com o selo, e o contador das 30', () => {
    montar()
    expect(document.activeElement).toBe(campo())
    expect(dialogo().getAttribute('data-abertura')).toBe('ponteiro')
    expect(dialogo().querySelector('.vj-escolha__contador')?.textContent).toBe('30 fichas')
    expect(linhas()).toHaveLength(30)
    const primeira = linhas()[0]
    expect(primeira?.getAttribute('aria-label')).toBe('Grog, de Ana, selecionada no mapa')
    expect(primeira?.querySelector('.vj-escolha__selo')?.textContent).toBe('Selecionada')
    expect(ativa()).toBe(primeira)
    expect(campo().getAttribute('aria-activedescendant')).toBe(primeira?.id)
    // O separador vem logo depois da selecionada: ela é um grupo à parte.
    expect(primeira?.nextElementSibling?.className).toBe('vj-escolha__sep')
    // Nome comprido corta na tela e vai inteiro no balão.
    expect(dialogo().querySelector('[title="Irmã Benedita das Sete Chagas e do Perpétuo Socorro"]')).not.toBeNull()
    expect(dialogo().querySelector('.vj-escolha__dono--sem')?.textContent).toBe('sem jogador')
  })

  it('↑ ↓ andam (dando a volta), Home e End vão às pontas, Enter escolhe e devolve o foco ao botão', () => {
    const { onEscolher, onFechar } = montar()
    tecla('ArrowDown')
    expect(ativa()?.getAttribute('aria-label')).toMatch(/^Irmã Benedita/)
    expect(campo().getAttribute('aria-activedescendant')).toBe(ativa()?.id)
    tecla('ArrowUp')
    tecla('ArrowUp')
    expect(ativa()?.getAttribute('aria-label')).toBe('Sacerdotisa Anaïs, sem jogador')
    tecla('Home')
    expect(ativa()).toBe(linhas()[0])
    tecla('End')
    expect(ativa()).toBe(linhas()[29])
    tecla('Home')
    tecla('ArrowDown')
    tecla('Enter')
    expect(onEscolher).toHaveBeenCalledExactlyOnceWith('irma')
    expect(onFechar).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(ancora)
  })

  it('a busca filtra na hora, acende o trecho e conta "2 de 30"; sem nada, diz o que buscar e o Enter não escolhe', () => {
    const { onEscolher } = montar()
    digitar('ana')
    expect(linhas().map((linha) => linha.getAttribute('aria-label'))).toEqual(['Grog, de Ana, selecionada no mapa', 'Sacerdotisa Anaïs, sem jogador'])
    expect(dialogo().querySelector('.vj-escolha__contador')?.textContent).toBe('2 de 30')
    expect([...dialogo().querySelectorAll('mark')].map((marca) => marca.textContent)).toEqual(['Ana', 'Ana'])
    expect(ativa()).toBe(linhas()[0])
    digitar('zzk')
    expect(linhas()).toHaveLength(0)
    expect(dialogo().querySelector('[role="status"]')?.textContent).toBe('Nenhuma ficha com “zzk”.Busque pelo nome da ficha ou do jogador.')
    expect(dialogo().querySelector('.vj-escolha__contador')?.textContent).toBe('0 de 30')
    expect(campo().hasAttribute('aria-activedescendant')).toBe(false)
    tecla('Enter')
    expect(onEscolher).not.toHaveBeenCalled()
  })

  it('Esc fecha, devolve o foco ao botão e não chega aos atalhos da janela (no editor, soltaria a seleção do mapa)', () => {
    const { onEscolher, onFechar } = montar()
    const atalho = vi.fn()
    window.addEventListener('keydown', atalho)
    try {
      const evento = tecla('Escape')
      expect(evento.defaultPrevented).toBe(true)
      expect(atalho).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', atalho)
    }
    expect(onFechar).toHaveBeenCalledOnce()
    expect(onEscolher).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(ancora)
  })

  it('Tab fecha com o foco de volta no botão, sem prender a tecla (o navegador segue a ordem dali)', () => {
    const { onFechar } = montar()
    const evento = tecla('Tab')
    expect(evento.defaultPrevented).toBe(false)
    expect(onFechar).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(ancora)
  })

  it('clicar numa linha escolhe; o ponteiro passando acende a linha', () => {
    const { onEscolher } = montar()
    const kael = linhas().find((linha) => linha.getAttribute('aria-label') === 'Kael, de Rafael')
    if (kael === undefined) throw new Error('sem o Kael')
    act(() => {
      kael.dispatchEvent(new Event('pointermove', { bubbles: true }))
    })
    expect(ativa()).toBe(kael)
    act(() => {
      kael.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(onEscolher).toHaveBeenCalledExactlyOnceWith('kael')
  })

  it('o clique fora fecha sem roubar o foco; o clique no próprio botão fica com quem abriu (ele alterna)', () => {
    const { onFechar } = montar()
    act(() => {
      ancora.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(onFechar).not.toHaveBeenCalled()
    act(() => {
      container.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(onFechar).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(campo())
  })

  it('aberta pelo teclado aparece parada (sem a animação de entrada)', () => {
    montar({ abertura: 'teclado' })
    expect(dialogo().getAttribute('data-abertura')).toBe('teclado')
  })

  it('cena sem ficha: diz por que a lista está vazia e o que fazer; o Esc ainda fecha', () => {
    const { onFechar } = montar({ fichas: [] })
    expect(dialogo().querySelector('input')).toBeNull()
    expect(dialogo().textContent).toContain('Nenhuma ficha nesta cena')
    expect(dialogo().textContent).toContain('Ponha uma ficha no mapa e abra de novo.')
    expect(document.activeElement).toBe(dialogo())
    tecla('Escape', dialogo())
    expect(onFechar).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(ancora)
  })

  it('na barra (Trocar ficha): a ficha da janela leva "Na janela", não nasce ativa, e escolhê-la só fecha', () => {
    const { onEscolher, onFechar } = montar({ fichaAbertaId: 'grog', acaoDoEnter: 'trocar' })
    const grog = linhas()[0]
    expect(grog?.querySelector('.vj-escolha__selo')?.textContent).toBe('Na janela')
    expect(grog?.getAttribute('aria-label')).toBe('Grog, de Ana, já está na janela')
    expect(ativa()).toBe(linhas()[1])
    expect(dialogo().querySelector('.vj-escolha__pe')?.textContent).toContain('trocar')
    act(() => {
      grog?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    })
    expect(onEscolher).not.toHaveBeenCalled()
    expect(onFechar).toHaveBeenCalledOnce()
  })

  it('a lista muda ao vivo sem pular a linha ativa (o mestre mexe no editor com ela aberta)', () => {
    montar()
    tecla('ArrowDown')
    tecla('ArrowDown')
    expect(ativa()?.getAttribute('aria-label')).toBe('Kael, de Rafael')
    montar({ fichas: [ficha('novo', 'Aranha', null), ...FICHAS] })
    expect(ativa()?.getAttribute('aria-label')).toBe('Kael, de Rafael')
  })
})
