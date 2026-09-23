import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore, type ToastMessage } from '../stores/toastStore'
import { agruparAvisos, deixarTodos, tituloDaCaixa, type ItemDaPilha } from './caixaDeAvisos'

/** Um pedido de passagem como o `hostBridge` empilha: grupo "Pedidos", "Deixar ir" em lote. */
function pedido(id: string, jogador: string, deixarIr: () => void = () => {}, nao: () => void = () => {}): ToastMessage {
  return {
    id,
    kind: 'instrucao',
    text: `${jogador} quer passar por Escada → Cripta`,
    actions: [
      { label: 'Deixar ir', run: deixarIr, emLote: true },
      { label: 'Não', run: nao },
    ],
    grupo: 'Pedidos',
  }
}

function aviso(id: string, text: string): ToastMessage {
  return { id, kind: 'info', text }
}

/** O formato da pilha em uma linha por item, para comparar sem os objetos inteiros. */
function formato(itens: ItemDaPilha[]): string[] {
  return itens.map((item) => (item.tipo === 'aviso' ? item.toast.id : `${item.grupo}[${item.toasts.map((t) => t.id).join(',')}]`))
}

describe('agruparAvisos', () => {
  it('um pedido só continua o aviso de hoje', () => {
    expect(formato(agruparAvisos([pedido('p1', 'Ana')]))).toEqual(['p1'])
  })

  it('dois ou mais pedidos viram UMA caixa, no topo da pilha, e os outros avisos ficam fora dela na ordem de chegada', () => {
    const pilha = [aviso('a1', 'Bruno entrou'), pedido('p1', 'Ana'), aviso('e1', 'Falhou'), pedido('p2', 'Bruno'), pedido('p3', 'Carla')]
    expect(formato(agruparAvisos(pilha))).toEqual(['Pedidos[p1,p2,p3]', 'a1', 'e1'])
  })

  it('responder uma linha tira só ela; sobrando um, volta a ser o aviso de hoje', () => {
    const pilha = [pedido('p1', 'Ana'), pedido('p2', 'Bruno'), pedido('p3', 'Carla')]
    expect(formato(agruparAvisos(pilha.filter((t) => t.id !== 'p2')))).toEqual(['Pedidos[p1,p3]'])
    expect(formato(agruparAvisos(pilha.filter((t) => t.id === 'p3')))).toEqual(['p3'])
    expect(agruparAvisos([])).toEqual([])
  })

  it('aviso sem grupo nunca entra em caixa, nem com vários iguais', () => {
    expect(formato(agruparAvisos([aviso('a1', 'X'), aviso('a2', 'X')]))).toEqual(['a1', 'a2'])
  })

  it('grupos diferentes não se misturam', () => {
    const outro = (id: string): ToastMessage => ({ ...aviso(id, 'outro'), grupo: 'Outros' })
    expect(formato(agruparAvisos([pedido('p1', 'Ana'), outro('o1'), pedido('p2', 'Bruno'), outro('o2')]))).toEqual(['Pedidos[p1,p2]', 'Outros[o1,o2]'])
  })

  it('pedido marcado "sempreEmCaixa" (a porta trancada) já vira a caixa sozinho, e puxa um pedido de passagem para ela', () => {
    const porta: ToastMessage = { ...pedido('d1', 'Ana'), text: 'Ana tenta forçar a porta', sempreEmCaixa: true }
    expect(formato(agruparAvisos([aviso('a1', 'Bruno entrou'), porta]))).toEqual(['Pedidos[d1]', 'a1'])
    expect(formato(agruparAvisos([pedido('p1', 'Bruno'), porta]))).toEqual(['Pedidos[p1,d1]'])
    // Respondida a porta, o pedido de passagem que sobrou volta a ser o aviso de hoje.
    expect(formato(agruparAvisos([pedido('p1', 'Bruno')]))).toEqual(['p1'])
  })

  it('o título é o nome acessível "Pedidos (N)"', () => {
    expect(tituloDaCaixa('Pedidos', 3)).toBe('Pedidos (3)')
  })
})

describe('deixarTodos', () => {
  it('roda o "Deixar ir" de cada pedido, tira cada um da tela antes, e não roda o "Não"', () => {
    const ordem: string[] = []
    const nao = vi.fn()
    const pilha = [pedido('p1', 'Ana', () => ordem.push('ir:p1'), nao), pedido('p2', 'Bruno', () => ordem.push('ir:p2'), nao)]
    deixarTodos(pilha, (id) => ordem.push(`fora:${id}`))
    expect(ordem).toEqual(['fora:p1', 'ir:p1', 'fora:p2', 'ir:p2'])
    expect(nao).not.toHaveBeenCalled()
  })

  it('um pedido que lança não trava os seguintes, e o erro não some: sai no fim', () => {
    const deixarCarla = vi.fn()
    const falha = new Error('revalidação explodiu')
    const pilha = [
      pedido('p1', 'Ana', () => {
        throw falha
      }),
      pedido('p2', 'Carla', deixarCarla),
    ]
    const dispensar = vi.fn()
    expect(() => deixarTodos(pilha, dispensar)).toThrow(falha)
    expect(deixarCarla).toHaveBeenCalledTimes(1)
    expect(dispensar.mock.calls).toEqual([['p1'], ['p2']])
  })

  it('aviso sem ação em lote fica onde está', () => {
    const dispensar = vi.fn()
    deixarTodos([aviso('a1', 'Ana entrou em Cripta')], dispensar)
    expect(dispensar).not.toHaveBeenCalled()
  })
})

describe('toastStore: o grupo chega ao aviso', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('push com grupo guarda o grupo; sem grupo, o aviso continua { id, kind, text }', () => {
    const store = useToastStore.getState()
    store.push('instrucao', 'Ana quer passar', null, { grupo: 'Pedidos' })
    store.push('info', 'Mapa salvo', null)
    store.push('instrucao', 'Ana tenta forçar a porta', null, { grupo: 'Pedidos', sempreEmCaixa: true })
    const [comGrupo, simples, porta] = useToastStore.getState().toasts
    expect(comGrupo?.grupo).toBe('Pedidos')
    expect(comGrupo?.sempreEmCaixa).toBeUndefined()
    expect(porta?.sempreEmCaixa).toBe(true)
    expect(simples === undefined ? [] : Object.keys(simples).sort()).toEqual(['id', 'kind', 'text'])
  })
})
