import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PinItem, PinKind, PinLock } from '../../types/map'
import { useToastStore } from '../../stores/toastStore'
import { PIN_NOME_MAX_LENGTH } from '../../lib/pins'
import { CabecaDaSelecao, EXCLUIR_PINO, pinIdentity } from './CabecaDaSelecao'
import { FichaDoPino, type FichaDoPinoProps } from './FichaDoPino'

let container: HTMLDivElement
let root: Root
const pushDeVerdade = useToastStore.getState().push

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useToastStore.setState({ push: pushDeVerdade })
  window.localStorage.clear()
})

function propsDoPino(kind: PinKind, pinId: string): FichaDoPinoProps {
  return {
    pinId,
    kind,
    onKindChange: vi.fn(),
    description: 'Caixas empilhadas no canto.',
    onDescriptionChange: vi.fn(),
    nome: 'Caixas suspeitas',
    onNomeChange: vi.fn(),
    locked: false,
    onLockedChange: vi.fn(),
    marco: false,
    onMarcoChange: vi.fn(),
    lerDePerto: null,
    onLerDePertoChange: vi.fn(),
    image: null,
    onChooseImage: vi.fn(),
    onClearImage: vi.fn(),
    iconChoice: null,
    quemVe: null,
  }
}

/** O "!" com fechadura e item, guardando o que os controles mandam (como o mapa faria). */
function PinoComRecursos(props: {
  pinId: string
  lock: PinLock | null
  item: PinItem | null
  aoMudarLock: (lock: PinLock | undefined) => void
  aoMudarItem: (item: PinItem | null) => void
}) {
  const [lock, setLock] = useState(props.lock)
  const [item, setItem] = useState(props.item)
  return (
    <FichaDoPino
      {...propsDoPino('exclamacao', props.pinId)}
      lock={{
        lock,
        doors: [],
        onChange: (novo) => {
          props.aoMudarLock(novo)
          setLock(novo ?? null)
        },
      }}
      item={{
        value: item,
        onChange: (novo) => {
          props.aoMudarItem(novo)
          setItem(novo)
        },
      }}
    />
  )
}

function montar(no: ReactNode) {
  act(() => root.render(no))
}

const cabecalho = (titulo: string) =>
  [...container.querySelectorAll<HTMLButtonElement>('.gr-ficha__cab')].find((b) => b.querySelector('.gr-ficha__tit')?.textContent === titulo)
const botao = (texto: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === texto)
const itensDoMenu = () => [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
const nomeDoItem = (item: HTMLElement) => document.getElementById(item.getAttribute('aria-labelledby') ?? '')?.textContent
const itemDoMenu = (nome: string) => itensDoMenu().find((item) => nomeDoItem(item) === nome)

/** `detail` 1 = clique do mouse; 0 = Enter ou espaço no botão. */
function clicar(alvo: HTMLElement | null | undefined, detail = 1) {
  if (alvo === null || alvo === undefined) throw new Error('alvo do clique não encontrado')
  act(() => {
    alvo.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }))
  })
}

describe('FichaDoPino: essencial', () => {
  it('abre com o título de antes, o Tipo com "!" e "?" só de ícone e os campos do local', () => {
    const props = propsDoPino('exclamacao', 'p-essencial')
    montar(<FichaDoPino {...props} />)
    const ficha = container.querySelector('section.lb-ficha-do-pino')
    // O primeiro título da ficha: as jornadas acham o painel por ele.
    expect(ficha?.querySelector('h2, h3')?.textContent).toBe('Ponto de interesse')
    const tipo = container.querySelector('[role="radiogroup"][aria-label="Tipo do pino"]')
    const radios = [...(tipo?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [])]
    expect(radios.map((r) => r.getAttribute('aria-label') ?? r.textContent)).toEqual(['Exclamação (!)', 'Interrogação (?)', 'Viagem', 'Alavanca', 'Minigame'])
    expect(radios[0].getAttribute('aria-checked')).toBe('true')
    clicar(radios[1])
    expect(props.onKindChange).toHaveBeenCalledWith('interrogacao')
    expect(container.querySelector<HTMLInputElement>('#lb-pin-nome')?.value).toBe('Caixas suspeitas')
    expect(container.querySelector<HTMLTextAreaElement>('#lb-pin-description')?.placeholder).toBe('O que aparece no cartão do local')
    // Nenhum recurso vale para este pino: nem ficha de recurso, nem o "+ Adicionar".
    expect(container.querySelector('.lb-recursos')).toBeNull()
    expect(botao('Adicionar ao pino')).toBeUndefined()
    expect(cabecalho('Aparência')?.getAttribute('aria-expanded')).toBe('false')
    expect(cabecalho('Mais da viagem')).toBeUndefined()
    expect(cabecalho('Na mesa')).toBeUndefined()
  })

  it('alavanca: a porta ligada e o "Acionar agora" de latão, apagado com o motivo', () => {
    const lever = { value: 'w1', options: [{ id: 'w1', label: 'Porta norte' }], onChange: vi.fn(), onPull: vi.fn(), pullBlocked: 'A porta está trancada.' }
    montar(<FichaDoPino {...propsDoPino('alavanca', 'p-alavanca')} lever={lever} />)
    expect(container.querySelector('section.lb-ficha-do-pino > h2')?.textContent).toBe('Alavanca')
    const acionar = botao('Acionar agora')
    expect(acionar?.classList.contains('gr-bt--latao')).toBe(true)
    expect(acionar?.disabled).toBe(true)
    expect(container.textContent).toContain('A porta está trancada.')
  })
})

describe('FichaDoPino: a forma do protótipo', () => {
  it('Tipo: "!", "?" e o minigame só de ícone; Viagem e Alavanca em texto', () => {
    montar(<FichaDoPino {...propsDoPino('exclamacao', 'p-forma-tipo')} />)
    const radios = [...container.querySelectorAll<HTMLButtonElement>('[role="radiogroup"][aria-label="Tipo do pino"] [role="radio"]')]
    expect(radios.map((r) => r.classList.contains('gr-seg__op--ic'))).toEqual([true, true, false, false, true])
    expect(radios[2].getAttribute('aria-label')).toBeNull()
    expect(radios[2].textContent).toBe('Viagem')
    expect(radios[3].textContent).toBe('Alavanca')
  })

  it('Nome do local e Descrição são campos do grimório, com o id e o limite de antes', () => {
    montar(<FichaDoPino {...propsDoPino('exclamacao', 'p-forma-campos')} />)
    const nome = container.querySelector<HTMLInputElement>('#lb-pin-nome')
    expect(nome?.classList.contains('gr-entrada')).toBe(true)
    expect(nome?.maxLength).toBe(PIN_NOME_MAX_LENGTH)
    expect(container.querySelector<HTMLLabelElement>('label[for="lb-pin-nome"]')?.textContent).toBe('Nome do local')
    const descricao = container.querySelector<HTMLTextAreaElement>('#lb-pin-description')
    expect(descricao?.classList.contains('gr-entrada')).toBe(true)
    expect(container.querySelector<HTMLLabelElement>('label[for="lb-pin-description"]')?.textContent).toBe('Descrição · o jogador lê')
  })

  it('alavanca: o "Abre a porta" é a lista do grimório', () => {
    const lever = { value: null, options: [{ id: 'w1', label: 'Porta norte' }], onChange: vi.fn(), onPull: vi.fn(), pullBlocked: null }
    montar(<FichaDoPino {...propsDoPino('alavanca', 'p-forma-alavanca')} lever={lever} />)
    expect(container.querySelector('#lb-pin-lever-door')?.classList.contains('gr-entrada')).toBe(true)
  })
})

describe('FichaDoPino: recurso que desliga por dentro', () => {
  const cabine = (target: string | null): NonNullable<FichaDoPinoProps['cabin']> => ({
    target,
    targets: [{ id: 'pino-b', label: 'Pino B' }],
    canAdvance: false,
    onChange: vi.fn(),
    onAdvance: vi.fn(),
  })

  it('a cabine que já vinha ligada continua na ficha quando o "Nenhuma" de dentro a desliga', () => {
    const props = propsDoPino('exclamacao', 'p-dentro')
    montar(<FichaDoPino {...props} cabin={cabine('pino-b')} />)
    expect(cabecalho('Cabine contínua')).toBeDefined()
    // O "Nenhuma" de dentro grava `null`: a ficha fica, e só o "Tirar do pino" a tira.
    montar(<FichaDoPino {...props} cabin={cabine(null)} />)
    expect(cabecalho('Cabine contínua')).toBeDefined()
  })
})

describe('FichaDoPino: recursos', () => {
  it('recurso ligado vira ficha com resumo e sem o interruptor; o menu oferece só os que sobram', () => {
    montar(<PinoComRecursos pinId="p-ligado" lock={{ resposta: '1234', forma: 'teclado' }} item={null} aoMudarLock={vi.fn()} aoMudarItem={vi.fn()} />)
    const cab = cabecalho('Fechadura com segredo')
    expect(cab?.querySelector('.gr-ficha__resumo')?.textContent).toBe('Segredo 1234')
    expect(cab?.getAttribute('aria-expanded')).toBe('false')
    expect([...container.querySelectorAll('.lb-recursos label')].some((l) => l.textContent?.includes('Fechadura com segredo'))).toBe(false)
    const mais = botao('Adicionar ao pino')
    expect(mais?.getAttribute('aria-haspopup')).toBe('menu')
    clicar(mais)
    expect(itensDoMenu().map(nomeDoItem)).toEqual(['Item pegável'])
  })

  it('pelo menu, com o mouse: liga com o padrão de antes, entra aberto e com a subida, e o foco vai ao título', () => {
    const aoMudarItem = vi.fn()
    montar(<PinoComRecursos pinId="p-mouse" lock={null} item={null} aoMudarLock={vi.fn()} aoMudarItem={aoMudarItem} />)
    clicar(botao('Adicionar ao pino'))
    expect(itensDoMenu().map(nomeDoItem)).toEqual(['Item pegável', 'Fechadura com segredo'])
    clicar(itemDoMenu('Item pegável'))
    expect(aoMudarItem).toHaveBeenCalledWith({ nome: 'Item' })
    const cab = cabecalho('Item pegável')
    expect(cab?.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(cab)
    expect(cab?.closest('.gr-ficha')?.classList.contains('gr-e-nova')).toBe(true)
  })

  it('pelo teclado o recurso aparece na hora, sem a subida, com o foco no título', () => {
    montar(<PinoComRecursos pinId="p-teclado" lock={null} item={null} aoMudarLock={vi.fn()} aoMudarItem={vi.fn()} />)
    clicar(botao('Adicionar ao pino'))
    clicar(itemDoMenu('Fechadura com segredo'), 0)
    const cab = cabecalho('Fechadura com segredo')
    expect(document.activeElement).toBe(cab)
    expect(cab?.closest('.gr-ficha')?.classList.contains('gr-e-nova')).toBe(false)
  })

  it('Tirar do pino: avisa com Desfazer, que devolve os valores; pelo menu eles também voltam', () => {
    const push = vi.fn((_tipo: string, _texto: string, _duracao?: number | null, _extras?: { actions?: { label: string; run: () => void }[] }) => 'aviso')
    useToastStore.setState({ push })
    const aoMudarLock = vi.fn()
    montar(<PinoComRecursos pinId="p-tirar" lock={{ resposta: '42', forma: 'volantes' }} item={null} aoMudarLock={aoMudarLock} aoMudarItem={vi.fn()} />)
    clicar(botao('Tirar do pino'))
    expect(aoMudarLock).toHaveBeenLastCalledWith(undefined)
    expect(cabecalho('Fechadura com segredo')).toBeUndefined()
    expect(document.activeElement).toBe(botao('Adicionar ao pino'))
    expect(push).toHaveBeenCalledTimes(1)
    expect(push.mock.calls[0][0]).toBe('info')
    expect(push.mock.calls[0][1]).toBe('"Fechadura com segredo" saiu do pino.')
    const desfazer = push.mock.calls[0][3]?.actions?.[0]
    expect(desfazer?.label).toBe('Desfazer')
    act(() => desfazer?.run())
    expect(aoMudarLock).toHaveBeenLastCalledWith({ resposta: '42', forma: 'volantes' })
    expect(cabecalho('Fechadura com segredo')).toBeDefined()
    // Tirar de novo e pôr pelo menu: volta com o que estava escrito, não com o padrão.
    clicar(botao('Tirar do pino'))
    clicar(botao('Adicionar ao pino'))
    clicar(itemDoMenu('Fechadura com segredo'), 0)
    expect(aoMudarLock).toHaveBeenLastCalledWith({ resposta: '42', forma: 'volantes' })
  })
})

describe('CabecaDaSelecao do pino', () => {
  it('a medalha do tipo, o nome do local, o tipo embaixo e o Excluir de antes', () => {
    const onApagar = vi.fn()
    montar(
      <CabecaDaSelecao identidade={pinIdentity('viagem', 'Subida para a Cidade Alta')} rotuloApagar={EXCLUIR_PINO.viagem} onApagar={onApagar} acoes={[]} notaDasAcoes={null} />,
    )
    expect(container.textContent).toContain('Subida para a Cidade Alta')
    expect(container.textContent).toContain('Pino de viagem')
    expect(container.querySelector('.gr-cabeca__med svg')).not.toBeNull()
    clicar(container.querySelector<HTMLButtonElement>('button[aria-label="Excluir pino de viagem"]'))
    expect(onApagar).toHaveBeenCalledTimes(1)
    // Sem ação rara no pino: o "Mais ações" não aparece (menu sem ação é controle falso).
    expect(container.querySelector('button[aria-label="Mais ações"]')).toBeNull()
  })

  it('pino sem nome: a cabeça diz o tipo', () => {
    expect(pinIdentity('exclamacao', '   ')).toEqual({ icon: 'pin', type: 'Ponto de interesse', name: null, pinKind: 'exclamacao' })
  })
})
