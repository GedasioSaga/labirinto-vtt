/**
 * CENAS EM PASTAS na seção Cenas da aba Mapa (`ScenesSection.tsx`): 27 cenas
 * numa lista plana, com duas "Taverna", viram uma árvore — região > cidade >
 * bairro > casa. Cobra a tela: o recuo, recolher com as bolinhas somadas na
 * linha da pasta, "Filtrar cenas" com o caminho em cinza, arrastar uma cena
 * sobre outra para pôr dentro, "Mover para…" pelo teclado e as setas.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScenePeople } from '../lib/party'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection } from './ScenesSection'

function cena(id: string, name: string, parentId?: string, extra: Partial<SceneListItem> = {}): SceneListItem {
  return { id, name, tokenCount: 0, available: true, active: false, renamable: true, ...(parentId === undefined ? {} : { parentId }), ...extra }
}

/** A viagem: Costa Norte > Porto Cinza > Taverna, o Mercado ainda solto, e a outra Taverna na Vila do Vau. */
const VIAGEM: SceneListItem[] = [
  cena('costa', 'Costa Norte'),
  cena('porto', 'Porto Cinza', 'costa', { active: true }),
  cena('mercado', 'Mercado'),
  cena('tav-porto', 'Taverna', 'porto'),
  cena('estrada', 'Estrada Velha'),
  cena('vila', 'Vila do Vau'),
  cena('tav-vila', 'Taverna', 'vila'),
]

const GENTE = new Map<string, ScenePeople>([
  ['tav-porto', { people: [{ playerId: 'ana', name: 'Ana', color: '#3cff00' }], pendingRequests: 0 }],
  ['porto', { people: [{ playerId: 'bruno', name: 'Bruno', color: '#2f7bff' }], pendingRequests: 1 }],
  ['estrada', { people: [{ playerId: 'caio', name: 'Caio', color: '#ff5a1f' }], pendingRequests: 0 }],
])

interface RenderProps {
  scenes?: SceneListItem[]
  people?: ReadonlyMap<string, ScenePeople>
  onMove?: ((sceneId: string, parentId: string | null) => boolean) | null
  adventureId?: string | null
}

describe('ScenesSection: cenas em pastas', () => {
  let container: HTMLDivElement
  let root: Root
  const noMapa = vi.fn()

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    noMapa.mockClear()
    window.addEventListener('keydown', noMapa)
  })

  afterEach(() => {
    window.removeEventListener('keydown', noMapa)
    act(() => root.unmount())
    container.remove()
  })

  function render(props: RenderProps = {}) {
    const onSelect = vi.fn()
    const onMove = vi.fn((_sceneId: string, _parentId: string | null) => true)
    const move = props.onMove === null ? undefined : (props.onMove ?? onMove)
    act(() =>
      root.render(
        <ScenesSection
          scenes={props.scenes ?? VIAGEM}
          onSelect={onSelect}
          onCreate={() => {}}
          onRename={() => {}}
          people={props.people}
          onMove={move}
          adventureId={props.adventureId === undefined ? 'adv_viagem' : props.adventureId}
        />,
      ),
    )
    return { onSelect, onMove }
  }

  const lista = (): HTMLUListElement => {
    const ul = container.querySelector<HTMLUListElement>('ul[aria-label="Cenas da aventura"]')
    if (ul === null) throw new Error('sem a lista "Cenas da aventura"')
    return ul
  }
  const linhas = () => Array.from(lista().children) as HTMLLIElement[]
  const nomeDa = (li: Element) => li.querySelector<HTMLButtonElement>('.lb-cenas__nome')
  const nomes = () => linhas().map((li) => nomeDa(li)?.textContent)
  /** A linha (o `<li>`) da cena: a primeira cujo botão do nome é `nome`. */
  const linha = (nome: string, n = 0): HTMLLIElement => {
    const achadas = linhas().filter((li) => nomeDa(li)?.textContent === nome)
    const li = achadas[n]
    if (li === undefined) throw new Error(`sem a linha "${nome}"`)
    return li
  }
  const botao = (nome: string) => Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
  const pasta = (nome: string) => botao(`Cenas dentro de ${nome}`)
  const filtro = () => container.querySelector<HTMLInputElement>('input[type="search"]')
  const fantasma = () => document.body.querySelector<HTMLElement>('.lb-cenas__fantasma')

  function digita(campo: HTMLInputElement | HTMLSelectElement | null, texto: string): void {
    if (campo === null) throw new Error('campo não existe')
    const proto = campo instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    act(() => {
      setter?.call(campo, texto)
      campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    })
  }

  function tecla(alvo: Element | null, key: string): void {
    if (alvo === null) throw new Error('sem alvo para a tecla')
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    })
  }

  function ponteiro(tipo: 'pointerdown' | 'pointermove' | 'pointerup', alvo: Element | null, x: number, y: number): void {
    if (alvo === null) throw new Error(`sem alvo para ${tipo}`)
    act(() => {
      alvo.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true }))
    })
  }

  /** Pega o nome de uma cena e leva o ponteiro até o nome da outra, sem soltar (a pausa antes de soltar). */
  function arrastaAte(de: HTMLElement, para: HTMLElement): void {
    ponteiro('pointerdown', nomeDa(de), 20, 200)
    ponteiro('pointermove', nomeDa(de), 22, 196)
    ponteiro('pointermove', nomeDa(para) ?? para, 24, 120)
  }

  it('cena dentro de cena aparece recuada, logo abaixo da de fora, e só a pasta tem a seta', () => {
    render()
    expect(nomes()).toEqual(['Costa Norte', 'Porto Cinza', 'Taverna', 'Mercado', 'Estrada Velha', 'Vila do Vau', 'Taverna'])
    expect(linhas().map((li) => li.getAttribute('aria-level'))).toEqual(['1', '2', '3', '1', '1', '1', '2'])
    expect(linhas().map((li) => li.style.getPropertyValue('--lb-cena-nivel'))).toEqual(['0', '1', '2', '0', '0', '0', '1'])
    expect(pasta('Costa Norte')?.getAttribute('aria-expanded')).toBe('true')
    expect(pasta('Porto Cinza')?.getAttribute('aria-expanded')).toBe('true')
    expect(pasta('Vila do Vau')?.getAttribute('aria-expanded')).toBe('true')
    expect(pasta('Mercado')).toBeUndefined()
    expect(pasta('Taverna')).toBeUndefined()
  })

  it('recolher esconde as de dentro sem trocar de cena, e a linha da pasta soma as bolinhas e os pedidos', () => {
    const { onSelect } = render({ people: GENTE })
    expect(linha('Costa Norte').querySelectorAll('.lb-cenas__pessoa')).toHaveLength(0)

    act(() => pasta('Costa Norte')?.click())

    expect(onSelect).not.toHaveBeenCalled()
    expect(pasta('Costa Norte')?.getAttribute('aria-expanded')).toBe('false')
    expect(nomes()).toEqual(['Costa Norte', 'Mercado', 'Estrada Velha', 'Vila do Vau', 'Taverna'])
    const costa = linha('Costa Norte')
    const bolinhas = Array.from(costa.querySelectorAll<HTMLElement>('.lb-cenas__pessoa'))
    expect(bolinhas.map((b) => b.getAttribute('aria-label'))).toEqual(['Bruno, em Porto Cinza', 'Ana, em Taverna'])
    expect(bolinhas.map((b) => b.style.background)).toEqual(['rgb(47, 123, 255)', 'rgb(60, 255, 0)'])
    expect(costa.textContent).toContain('1 pedido')
    // A Estrada Velha, fora da pasta, continua só com quem está nela.
    expect(Array.from(linha('Estrada Velha').querySelectorAll('.lb-cenas__pessoa')).map((b) => b.getAttribute('aria-label'))).toEqual(['Caio'])

    act(() => pasta('Costa Norte')?.click())
    expect(nomes()).toHaveLength(7)
    expect(linha('Costa Norte').querySelectorAll('.lb-cenas__pessoa')).toHaveLength(0)
    expect(Array.from(linha('Porto Cinza').querySelectorAll('.lb-cenas__pessoa')).map((b) => b.getAttribute('aria-label'))).toEqual(['Bruno'])
  })

  it('a pasta recolhida é lembrada por aventura: fechar e abrir a aba volta igual', () => {
    render()
    act(() => pasta('Vila do Vau')?.click())
    expect(nomes()).toEqual(['Costa Norte', 'Porto Cinza', 'Taverna', 'Mercado', 'Estrada Velha', 'Vila do Vau'])

    act(() => root.unmount())
    root = createRoot(container)
    render()
    expect(pasta('Vila do Vau')?.getAttribute('aria-expanded')).toBe('false')
    expect(nomes()).toHaveLength(6)

    // Outra aventura não herda o recolhido desta.
    render({ adventureId: 'adv_outra' })
    expect(pasta('Vila do Vau')?.getAttribute('aria-expanded')).toBe('true')
    expect(nomes()).toHaveLength(7)
  })

  it('"Filtrar cenas": "tav" mostra as duas Tavernas, cada uma com o caminho em cinza, mesmo dentro de pasta recolhida', () => {
    render()
    act(() => pasta('Costa Norte')?.click())
    const campo = filtro()
    expect(campo).not.toBeNull()
    expect(container.querySelector(`label[for="${campo?.id ?? ''}"]`)?.textContent).toBe('Filtrar cenas')

    digita(campo, 'tav')

    expect(nomes()).toEqual(['Taverna', 'Taverna'])
    const caminhos = linhas().map((li) => li.querySelector('.lb-cenas__caminho')?.textContent)
    expect(caminhos).toEqual(['Costa Norte › Porto Cinza', 'Vila do Vau'])
    // O nome acessível do botão continua só o nome; o caminho é a descrição dele.
    const primeira = nomeDa(linhas()[0])
    expect(primeira?.textContent).toBe('Taverna')
    expect(document.getElementById(primeira?.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Costa Norte › Porto Cinza')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('2 de 7 cenas')
    // Sem acento nem maiúscula: "VILA" acha a Vila do Vau e a Taverna de lá não (só o caminho tem "Vila").
    digita(campo, 'VILA')
    expect(nomes()).toEqual(['Vila do Vau'])
    // O caminho desempata: "porto tav" é só a Taverna de Porto Cinza.
    digita(campo, 'porto tav')
    expect(nomes()).toEqual(['Taverna'])
    expect(linhas()[0].querySelector('.lb-cenas__caminho')?.textContent).toBe('Costa Norte › Porto Cinza')
  })

  it('filtro sem nada diz que não achou; Esc apaga e o segundo Esc sai do campo, sem chegar ao mapa', () => {
    render()
    const campo = filtro()
    digita(campo, 'zzz')
    expect(linhas()).toHaveLength(0)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Nenhuma cena com “zzz”. Tente só o começo do nome.')

    campo?.focus()
    tecla(campo, 'Escape')
    expect(campo?.value).toBe('')
    expect(nomes()).toHaveLength(7)
    expect(document.activeElement).toBe(campo)
    tecla(campo, 'Escape')
    expect(document.activeElement).not.toBe(campo)
    expect(noMapa).not.toHaveBeenCalled()
  })

  it('Enter no filtro abre a primeira cena achada; seta para baixo desce para a lista', () => {
    const { onSelect } = render()
    const campo = filtro()
    digita(campo, 'merc')
    campo?.focus()
    tecla(campo, 'ArrowDown')
    expect(document.activeElement).toBe(nomeDa(linha('Mercado')))
    tecla(document.activeElement, 'ArrowUp')
    expect(document.activeElement).toBe(campo)
    tecla(campo, 'Enter')
    expect(onSelect).toHaveBeenCalledWith('mercado')
    expect(noMapa).not.toHaveBeenCalled()
  })

  it('arrastar o Mercado sobre Porto Cinza: na pausa o destino acende e o fantasma diz para onde vai; ao soltar, fica dentro', () => {
    const { onSelect, onMove } = render()
    const mercado = linha('Mercado')
    const porto = linha('Porto Cinza')

    arrastaAte(mercado, porto)

    expect(mercado.getAttribute('data-arrastando')).toBe('true')
    expect(porto.getAttribute('data-alvo')).toBe('dentro')
    expect(fantasma()?.textContent).toContain('Mercado')
    expect(fantasma()?.textContent).toContain('Dentro de Porto Cinza')
    expect(onMove).not.toHaveBeenCalled()

    ponteiro('pointerup', nomeDa(porto), 24, 120)

    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove).toHaveBeenCalledWith('mercado', 'porto')
    expect(fantasma()).toBeNull()
    expect(porto.hasAttribute('data-alvo')).toBe(false)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('o clique que o navegador dispara ao soltar no mesmo nome não troca de cena; o clique seguinte troca', async () => {
    const { onSelect, onMove } = render()
    const mercado = linha('Mercado')
    ponteiro('pointerdown', nomeDa(mercado), 20, 200)
    ponteiro('pointermove', nomeDa(mercado), 20, 230)
    ponteiro('pointerup', nomeDa(mercado), 20, 200)
    act(() => nomeDa(mercado)?.click())
    expect(onSelect).not.toHaveBeenCalled()
    expect(onMove).not.toHaveBeenCalled()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    act(() => nomeDa(linha('Mercado'))?.click())
    expect(onSelect).toHaveBeenCalledWith('mercado')
  })

  it('soltar dentro de uma cena que já está dentro dela é recusado, e o fantasma diz por quê', () => {
    const { onMove } = render()
    const costa = linha('Costa Norte')
    const taverna = linha('Taverna')

    arrastaAte(costa, taverna)

    expect(taverna.getAttribute('data-alvo')).toBe('invalido')
    expect(fantasma()?.textContent).toContain('Taverna está dentro de Costa Norte')
    ponteiro('pointerup', nomeDa(taverna), 24, 120)
    expect(onMove).not.toHaveBeenCalled()
    expect(fantasma()).toBeNull()
  })

  it('Esc no meio do arrasto desiste, sem chegar ao mapa', () => {
    const { onMove } = render()
    arrastaAte(linha('Mercado'), linha('Porto Cinza'))
    expect(fantasma()).not.toBeNull()

    tecla(document.body, 'Escape')

    expect(fantasma()).toBeNull()
    expect(linha('Porto Cinza').hasAttribute('data-alvo')).toBe(false)
    ponteiro('pointerup', nomeDa(linha('Porto Cinza')), 24, 120)
    expect(onMove).not.toHaveBeenCalled()
    expect(noMapa).not.toHaveBeenCalled()
  })

  it('arrastar uma cena de dentro mostra "primeiro nível"; soltar ali a tira da pasta', () => {
    const { onMove } = render()
    expect(container.querySelector('[data-cena-raiz]')).toBeNull()
    const porto = linha('Porto Cinza')
    ponteiro('pointerdown', nomeDa(porto), 20, 100)
    ponteiro('pointermove', nomeDa(porto), 20, 140)
    const raiz = container.querySelector<HTMLElement>('[data-cena-raiz]')
    expect(raiz?.textContent).toMatch(/primeiro nível/i)

    ponteiro('pointermove', raiz, 20, 400)
    expect(raiz?.getAttribute('data-alvo')).toBe('dentro')
    ponteiro('pointerup', raiz, 20, 400)

    expect(onMove).toHaveBeenCalledWith('porto', null)
    expect(container.querySelector('[data-cena-raiz]')).toBeNull()
  })

  it('"Mover para…" na cena aberta: sem ela e sem as de dentro dela, a pasta de hoje marcada, e move', () => {
    const { onMove } = render()
    const abrir = botao('Mover Porto Cinza para…')
    expect(abrir).toBeDefined()
    // Só a cena aberta tem o botão, como o renomear.
    expect(botao('Mover Mercado para…')).toBeUndefined()
    abrir?.focus()
    act(() => abrir?.click())

    const escolha = container.querySelector<HTMLSelectElement>('select')
    expect(container.querySelector(`label[for="${escolha?.id ?? ''}"]`)?.textContent).toBe('Mover Porto Cinza para dentro de')
    expect(Array.from(escolha?.options ?? []).map((o) => o.textContent)).toEqual([
      'Nenhuma (primeiro nível)',
      'Costa Norte',
      'Mercado',
      'Estrada Velha',
      'Vila do Vau',
      'Vila do Vau › Taverna',
    ])
    expect(escolha?.value).toBe('costa')
    expect(botao('Mover')?.disabled).toBe(true)

    digita(escolha, 'vila')
    act(() => botao('Mover')?.click())

    expect(onMove).toHaveBeenCalledWith('porto', 'vila')
    expect(container.querySelector('select')).toBeNull()
    expect(linha('Porto Cinza').querySelector('[role="status"]')?.textContent).toBe('Porto Cinza agora está dentro de Vila do Vau.')
  })

  it('"Mover para…": Esc fecha sem mover e sem chegar ao mapa', () => {
    const { onMove } = render()
    act(() => botao('Mover Porto Cinza para…')?.click())
    const escolha = container.querySelector('select')
    digita(escolha, '')
    tecla(escolha, 'Escape')
    expect(container.querySelector('select')).toBeNull()
    expect(onMove).not.toHaveBeenCalled()
    expect(noMapa).not.toHaveBeenCalled()
  })

  it('setas: direita abre a pasta e entra, esquerda fecha a aberta e depois volta à de fora, para baixo desce — nada chega ao mapa', () => {
    render()
    act(() => pasta('Costa Norte')?.click())
    const costa = nomeDa(linha('Costa Norte'))
    costa?.focus()

    tecla(costa, 'ArrowRight')
    expect(pasta('Costa Norte')?.getAttribute('aria-expanded')).toBe('true')
    tecla(costa, 'ArrowRight')
    const porto = nomeDa(linha('Porto Cinza'))
    expect(document.activeElement).toBe(porto)
    // Porto Cinza está aberta: a primeira esquerda a fecha; a segunda volta à Costa Norte.
    tecla(porto, 'ArrowLeft')
    expect(pasta('Porto Cinza')?.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(porto)
    tecla(porto, 'ArrowLeft')
    expect(document.activeElement).toBe(costa)
    tecla(costa, 'ArrowLeft')
    expect(pasta('Costa Norte')?.getAttribute('aria-expanded')).toBe('false')
    tecla(costa, 'ArrowDown')
    expect(document.activeElement).toBe(nomeDa(linha('Mercado')))
    tecla(document.activeElement, 'End')
    expect(document.activeElement).toBe(nomeDa(linhas()[linhas().length - 1]))
    tecla(document.activeElement, 'Home')
    expect(document.activeElement).toBe(costa)
    expect(noMapa).not.toHaveBeenCalled()
  })

  it('aventura sem pasta fica como antes: sem seta, sem recuo, sem filtro com poucas cenas, e o 1º botão é o nome da 1ª cena', () => {
    render({ scenes: [cena('salao', 'Salão', undefined, { active: true }), cena('cripta', 'Cripta')] })
    expect(container.querySelector('.lb-cenas__pasta')).toBeNull()
    expect(container.querySelector('.lb-cenas__recuo')).toBeNull()
    expect(filtro()).toBeNull()
    // A jornada do pino de viagem acha a 1ª cena como o 1º botão do corpo da seção.
    expect(container.querySelector('.lb-collapsible__body button')?.textContent).toBe('Salão')
    expect(linhas().map((li) => li.getAttribute('aria-level'))).toEqual(['1', '1'])
  })

  it('mapa solto (sem onMove): não arrasta nem oferece "Mover para…"', () => {
    const { onSelect } = render({ scenes: [cena('', 'Vale', undefined, { active: true, renamable: false })], onMove: null, adventureId: null })
    expect(botao('Mover Vale para…')).toBeUndefined()
    const vale = nomeDa(linhas()[0])
    ponteiro('pointerdown', vale, 20, 20)
    ponteiro('pointermove', vale, 20, 80)
    expect(fantasma()).toBeNull()
    ponteiro('pointerup', vale, 20, 80)
    act(() => vale?.click())
    expect(onSelect).toHaveBeenCalledWith('')
  })
})
