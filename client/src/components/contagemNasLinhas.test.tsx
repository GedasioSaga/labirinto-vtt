import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AgendaDaCampanha, EventoDaAgenda } from '../lib/agendaDaCampanha'
import type { EstadoDoMundo } from '../lib/estadoDoMundo'
import { pinDirectory, type PinDirectoryEntry } from '../lib/pinDirectory'
import type { SceneListItem } from '../stores/adventureStore'
import type { MarcaNoLugar, Pin } from '../types/map'
import { AgendaSection } from './AgendaSection'
import { MarcasDaCena } from './MarcasDaCena'
import { PinsSection } from './PinsSection'
import { ScenesSection } from './ScenesSection'
import { WorldStateSection } from './WorldStateSection'

/*
 * CONTAGEM DISCRETA NAS LINHAS (pedido painel-acervo, fatia 5). Fechada, a
 * linha diz quanto tem dentro: "Cenas 3 ›", "Pinos 12 ›". Só onde a lista já
 * está na mão de quem desenha a linha — Cenas, Pinos, Agenda, Estado do mundo
 * e Marcas dos jogadores —, e só acima de zero: linha sem número é lista
 * vazia. Objetos do mapa e Locais ficam sem: são `lazy`, e contar montaria a
 * lista fechada.
 *
 * O número é o tamanho da MESMA lista que a seção mostra aberta: muda junto
 * com ela, no render seguinte, sem estado próprio.
 */

const nada = (): void => {}

/** O nome acessível: o texto do botão sem o que é `aria-hidden` (o que o `getByRole` dos specs ouve). */
function nomeAcessivel(el: Element): string {
  const copia = el.cloneNode(true)
  if (!(copia instanceof Element)) return ''
  for (const oculto of copia.querySelectorAll('[aria-hidden="true"]')) oculto.remove()
  return (copia.textContent ?? '').trim()
}

function cena(id: string, name: string, extra: Partial<SceneListItem> = {}): SceneListItem {
  return { id, name, active: false, available: true, renamable: true, tokenCount: 0, ...extra }
}

function pino(id: string, nome: string): Pin {
  return { id, x: 100, y: 200, kind: 'interrogacao', description: '', image: null, nome }
}

function evento(id: string, titulo: string, extra: Partial<EventoDaAgenda> = {}): EventoDaAgenda {
  return { id, titulo, quando: { dia: 7, apito: 'meio' }, ...extra }
}

function agendaCom(eventos: EventoDaAgenda[]): AgendaDaCampanha {
  return { agora: { dia: 1, apito: 'aurora' }, eventos }
}

const MARE: EstadoDoMundo = { id: 'mare', nome: 'Maré', valores: ['alta', 'baixa'], atual: 'alta' }
const GIRO: EstadoDoMundo = { id: 'giro', nome: 'Giro', valores: ['1', '2', '3'], atual: '2' }

const BILHETE: MarcaNoLugar = { id: 'b-escada', tipo: 'bilhete', x: 230, y: 200, texto: 'Fui pela escada', autor: 'Ana', em: 1 }
const SETA: MarcaNoLugar = { id: 's-leste', tipo: 'seta', x: 260, y: 200, rumo: 'ne', autor: 'Caio', em: 2 }

describe('contagem discreta nas linhas da coluna do mestre', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    window.localStorage.clear()
  })

  const render = (ui: ReactNode) => act(() => root.render(ui))

  /** O botão que abre e fecha a linha, pelo nome acessível exato. */
  function cabecalho(titulo: string): HTMLButtonElement {
    const botao = [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')].find((b) => nomeAcessivel(b) === titulo)
    if (botao === undefined) throw new Error(`sem a linha "${titulo}" (o nome do botão mudou?)`)
    return botao
  }

  /** O número da linha, ou `null` quando ela não mostra nenhum. */
  const contagem = (titulo: string) => cabecalho(titulo).querySelector('.lb-collapsible__contagem')?.textContent ?? null

  it('Cenas conta as cenas da aventura, as de dentro de pastas também', () => {
    const cenas = [cena('s-a', 'Salão', { active: true }), cena('s-b', 'Cripta'), cena('s-c', 'Poço', { parentId: 's-b' })]
    render(<ScenesSection scenes={cenas} onSelect={nada} onCreate={nada} onRename={nada} defaultOpen={false} />)
    expect(contagem('Cenas')).toBe('3')
  })

  it('Pinos conta os pinos da aventura inteira com a seção fechada, sem montar a lista', () => {
    const entradas: PinDirectoryEntry[] = pinDirectory([
      { sceneId: 's-casa', sceneName: 'Casa do crime', pins: [pino('faca', 'Faca')] },
      { sceneId: 's-porao', sceneName: 'Porão', pins: [pino('pegada', 'Pegada')] },
    ])
    render(<PinsSection entries={entradas} onGo={nada} />)
    expect(cabecalho('Pinos').getAttribute('aria-expanded')).toBe('false')
    expect(contagem('Pinos')).toBe('2')
    // Fechada, a lista continua sem existir: contar não custa o que o `lazy` poupa.
    expect(container.querySelector('ul')).toBeNull()
  })

  it('Pinos conta todos, não os que a busca deixou à vista', () => {
    window.localStorage.setItem('lb-section:pins', '1')
    const entradas = pinDirectory([{ sceneId: 's-casa', sceneName: 'Casa do crime', pins: [pino('faca', 'Faca'), pino('bilhete', 'Bilhete'), pino('pegada', 'Pegada')] }])
    render(<PinsSection entries={entradas} onGo={nada} />)
    const busca = container.querySelector('input[type="search"]')
    if (!(busca instanceof HTMLInputElement)) throw new Error('sem a busca de pinos')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(busca, 'faca')
      busca.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelectorAll('.lb-pinos__linha')).toHaveLength(1)
    expect(contagem('Pinos')).toBe('3')
  })

  it('Agenda conta os eventos da lista, os que já dispararam também (continuam nela até o mestre tirar)', () => {
    render(<AgendaSection agenda={agendaCom([evento('e1', 'Disparo dos Gêmeos'), evento('e2', 'Maré cheia', { disparado: true })])} onChange={nada} />)
    expect(contagem('Agenda')).toBe('2')
  })

  it('Estado do mundo conta os estados', () => {
    render(<WorldStateSection estados={[MARE]} amarrados={new Map()} onCriar={() => null} onTrocar={() => null} />)
    expect(contagem('Estado do mundo')).toBe('1')
    render(<WorldStateSection estados={[MARE, GIRO]} amarrados={new Map()} onCriar={() => null} onTrocar={() => null} />)
    expect(contagem('Estado do mundo')).toBe('2')
  })

  it('Marcas dos jogadores conta as marcas da cena aberta', () => {
    render(<MarcasDaCena marcas={[BILHETE, SETA]} onApagar={nada} />)
    expect(contagem('Marcas dos jogadores')).toBe('2')
  })

  it('lista vazia não mostra número: a linha fica só com o nome e a seta', () => {
    render(<PinsSection entries={[]} onGo={nada} />)
    expect(contagem('Pinos')).toBeNull()
    render(<AgendaSection agenda={undefined} onChange={nada} />)
    expect(contagem('Agenda')).toBeNull()
    render(<WorldStateSection estados={[]} amarrados={new Map()} onCriar={() => null} onTrocar={() => null} />)
    expect(contagem('Estado do mundo')).toBeNull()
  })

  it('o número acompanha a lista: tirar o único evento da Agenda tira o número da linha', () => {
    let agenda = agendaCom([evento('e1', 'Disparo dos Gêmeos')])
    const desenhar = () =>
      render(
        <AgendaSection
          agenda={agenda}
          onChange={(nova) => {
            agenda = nova
            desenhar()
          }}
        />,
      )
    desenhar()
    expect(contagem('Agenda')).toBe('1')
    // "Remover" do evento na lista aberta: a linha volta a ficar sem número.
    act(() => cabecalho('Agenda').click())
    const remover = container.querySelector<HTMLButtonElement>('button[aria-label="Remover Disparo dos Gêmeos"]')
    if (remover === null) throw new Error('sem o "Remover" do evento')
    act(() => remover.click())
    expect(agenda.eventos).toHaveLength(0)
    expect(contagem('Agenda')).toBeNull()
  })
})
