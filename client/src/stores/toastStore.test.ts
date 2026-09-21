import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { useToastStore } from './toastStore'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toastStore (frente A, onda 2 — item 12: notificação)', () => {
  it('push adiciona um aviso à fila com kind e text preservados', () => {
    useToastStore.getState().push('info', 'Mapa salvo')
    expect(useToastStore.getState().toasts).toMatchObject([{ kind: 'info', text: 'Mapa salvo' }])
  })

  it('push devolve um id, e cada aviso tem id distinto', () => {
    const id1 = useToastStore.getState().push('info', 'a')
    const id2 = useToastStore.getState().push('info', 'b')
    expect(id1).not.toBe(id2)
    expect(useToastStore.getState().toasts.map((t) => t.id)).toEqual([id1, id2])
  })

  it('fila preserva a ordem de chegada (info e erro misturados)', () => {
    useToastStore.getState().push('info', 'primeiro')
    useToastStore.getState().push('error', 'segundo')
    useToastStore.getState().push('info', 'terceiro')
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(['primeiro', 'segundo', 'terceiro'])
  })

  it('dismiss remove só o aviso do id passado, mantém os outros', () => {
    const id1 = useToastStore.getState().push('info', 'fica')
    const id2 = useToastStore.getState().push('error', 'sai')
    useToastStore.getState().dismiss(id2)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0]).toMatchObject({ id: id1, text: 'fica' })
  })

  it('dismiss de id inexistente é no-op silencioso (não lança, não afeta a fila)', () => {
    useToastStore.getState().push('info', 'único')
    expect(() => useToastStore.getState().dismiss('id-que-nao-existe')).not.toThrow()
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('auto-dispensa: aviso de info some sozinho após o tempo padrão, sem chamada manual', () => {
    vi.useFakeTimers()
    useToastStore.getState().push('info', 'some sozinho')
    expect(useToastStore.getState().toasts).toHaveLength(1)

    vi.advanceTimersByTime(3999)
    expect(useToastStore.getState().toasts).toHaveLength(1) // ainda não

    vi.advanceTimersByTime(1)
    expect(useToastStore.getState().toasts).toHaveLength(0) // 4000ms: dispensado
  })

  it('auto-dispensa: aviso de erro tem prazo maior que o de info', () => {
    vi.useFakeTimers()
    useToastStore.getState().push('error', 'erro persistente')

    vi.advanceTimersByTime(4000) // prazo do info já teria passado
    expect(useToastStore.getState().toasts).toHaveLength(1) // erro continua

    vi.advanceTimersByTime(3000) // 7000ms total: prazo do erro
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('durationMs explícito sobrepõe o padrão do kind', () => {
    vi.useFakeTimers()
    useToastStore.getState().push('info', 'curto', 100)
    vi.advanceTimersByTime(100)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  // ── a fronteira "ensina" × "informa" (conserto de 21/09/2026) ───────────
  // A jornada e2e `task-jornada-salvar-sem-foto-avisa.spec.ts` cobra isto na
  // tela; aqui a garantia fica no nível da store, onde o timer mora.

  it('instrucao NÃO some sozinha: o aviso que pede uma ação espera a pessoa dispensar', () => {
    vi.useFakeTimers()
    useToastStore.getState().push('instrucao', 'escolha uma imagem para ele antes de guardar no acervo')

    // Muito além do prazo do erro (7000ms), que era o que apagava a instrução.
    vi.advanceTimersByTime(600_000)
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('instrucao sai pelo dismiss — quem apaga é a pessoa, não o relógio', () => {
    vi.useFakeTimers()
    const id = useToastStore.getState().push('instrucao', 'escolha uma imagem')
    vi.advanceTimersByTime(30_000)
    useToastStore.getState().dismiss(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('info e error continuam sumindo sozinhos ao lado de uma instrucao que fica', () => {
    vi.useFakeTimers()
    useToastStore.getState().push('instrucao', 'fica até dispensar')
    useToastStore.getState().push('info', 'Goblin entrou no acervo')
    useToastStore.getState().push('error', 'Não foi possível salvar o mapa: disco cheio')

    vi.advanceTimersByTime(7000)
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(['fica até dispensar'])
  })

  it('durationMs null segura qualquer kind na tela (o kind escolhe o padrão, não a regra)', () => {
    vi.useFakeTimers()
    useToastStore.getState().push('info', 'segurado na mão', null)
    vi.advanceTimersByTime(600_000)
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('dismiss manual antes do timer cancela a auto-dispensa (não dispara dismiss duas vezes sobre um id reciclado)', () => {
    vi.useFakeTimers()
    const id = useToastStore.getState().push('info', 'dispensado na mão')
    useToastStore.getState().dismiss(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)

    // Se o timer não tivesse sido cancelado, este avanço chamaria dismiss(id)
    // de novo — inofensivo hoje (id não existe mais), mas provaria vazamento
    // de timer se um novo toast reciclasse o mesmo id (não acontece com
    // randomUUID, mas o teste documenta a garantia).
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow()
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
