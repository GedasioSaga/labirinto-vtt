/**
 * SONS AO VIVO, fatia F5, o jogador e a TV TOCAM (contrato em
 * `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`, seção 3). A conexão é a de
 * verdade (com socket de mentira), o motor é o de verdade sobre o Web Audio de
 * mentira, e o carregador é o da sala com um `fetch` de mentira: o que se
 * observa é o que toca, de onde começa e o que volta ao mestre (`som.falhou`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarSomStore, PREFERENCIA_DE_SOM_PADRAO } from '../stores/somStore'
import { BYTES_POR_SEGUNDO_FALSO, criarAudioFalso, criarElementoDeAudioFalso, type ElementoDeAudioFalso, type FonteFalsa, type NoFalso } from '../lib/sons/audioFalso.fixture'
import { criarMotorDeSom, type ContextoDeSom } from '../lib/sons/contexto'
import { criarMotorAoVivo, ESPERA_DO_EFEITO_CURTO_MS, type MotorAoVivo } from '../lib/sons/aoVivo/motor'
import { MOTIVOS_DA_FALHA_DO_SOM } from '../net/protocol'
import type { BuscarNaSala } from './carregadorDeSons'
import { createPlayerConnection, TABLE_SCREEN_NAME, type SocketLike } from './playerConnection'
import { criarReservaDoGesto, instalarSonsAoVivo, RESERVAS_POR_GESTO, type PreferenciaDosSons } from './sonsAoVivoDoJogador'

class FakeSocket implements SocketLike {
  readyState = 0
  sent: { type?: unknown; [campo: string]: unknown }[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }
  close(): void {}
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
  cair(): void {
    this.readyState = 3
    this.onclose?.(new CloseEvent('close'))
  }
}

const CHAVE = 'c0ffee'.repeat(10) + 'c0ff'
const MB = 1024 * 1024
/** Guardado antes de os relógios ficarem falsos: deixa a corrente de promessas assentar. */
const setTimeoutDeVerdade = globalThis.setTimeout
const assentar = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await new Promise<void>((resolve) => setTimeoutDeVerdade(resolve, 0))
}

function idDeAudio(n: number, extensao = 'mp3'): string {
  return `${n.toString(16).padStart(64, '0')}.${extensao}`
}

/** Uma sala: conexão de verdade, motor de verdade sobre áudio de mentira, `fetch` de mentira. */
function sala({ role, elementoRecusaPlay = false, mudo = false, ignorarPreferenciaGuardada }: { role?: 'table'; elementoRecusaPlay?: boolean; mudo?: boolean; ignorarPreferenciaGuardada?: true } = {}) {
  const sockets: FakeSocket[] = []
  const conexao = createPlayerConnection({
    url: 'ws://host/ws',
    code: 'ABC123',
    name: role === 'table' ? TABLE_SCREEN_NAME : 'Ana',
    storage: null,
    ...(role === 'table' ? { role, tableKey: 'chave-da-tv' } : {}),
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  })
  const socket = sockets[0]
  if (socket === undefined) throw new Error('socket não criado')
  socket.open()
  socket.receive({ type: 'midia.chave', chave: CHAVE })
  if (role !== 'table') socket.receive({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok', name: 'Ana' })
  socket.sent.length = 0

  const audio = criarAudioFalso()
  const contexto = criarMotorDeSom((): ContextoDeSom<NoFalso> | null => audio.ctx)
  const som = criarSomStore(null)
  som.getState().setVolume(0.5)
  if (mudo) som.getState().alternarMudo()
  /** O Mudo e o volume guardados neste navegador (o `lb-som` de mentira). */
  const preferenciaDoAparelho: PreferenciaDosSons = { lerPreferencia: () => som.getState(), assinarPreferencia: (ouvinte) => som.subscribe(() => ouvinte()) }
  const tamanhos = new Map<string, number>()
  const respostas = new Map<string, () => Response | Promise<Response>>()
  const pedidos: { url: string; chave: string | null }[] = []
  const buscar = vi.fn<BuscarNaSala>(async (url, init) => {
    pedidos.push({ url, chave: new Headers(init.headers).get('X-Labirinto-Chave') })
    const id = url.slice('/sons/'.length)
    const especial = respostas.get(id)
    if (especial !== undefined) return especial()
    const tamanho = tamanhos.get(id)
    if (tamanho === undefined) return new Response(null, { status: 404 })
    return new Response(new Uint8Array(tamanho), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
  })
  /** Os `<audio>` que o motor criou fora da reserva (o iOS os recusa sem gesto). */
  const avulsos: ElementoDeAudioFalso[] = []
  const daReserva: ElementoDeAudioFalso[] = []
  const reservas = criarReservaDoGesto(() => {
    const elemento = criarElementoDeAudioFalso()
    daReserva.push(elemento)
    return elemento
  })
  let motor: MotorAoVivo | null = null
  const sons = instalarSonsAoVivo(conexao, {
    buscar,
    reservas,
    preferencia: preferenciaDoAparelho,
    ...(ignorarPreferenciaGuardada === undefined ? {} : { ignorarPreferenciaGuardada }),
    destravarAgora: () => contexto.destravarAgora(),
    destravarNoPrimeiroGesto: () => () => undefined,
    // A preferência que o instalador escolheu (a do aparelho, ou a fixa da TV) é a que o motor lê.
    criarMotor: (carregar, reservasDoMotor, preferencia = preferenciaDoAparelho) => {
      motor = criarMotorAoVivo<NoFalso>({
        carregarBytes: carregar,
        obterSaida: () => {
          const aoVivo = contexto.obterEntradaAoVivo()
          return aoVivo === null ? null : { ctx: audio.ctx, aoVivo }
        },
        aoDestravar: (ouvinte) => contexto.quandoRodar(ouvinte),
        lerPreferencia: preferencia.lerPreferencia,
        assinarPreferencia: preferencia.assinarPreferencia,
        criarElementoDeAudio: () => {
          const daReservaAgora = reservasDoMotor.tirar()
          if (daReservaAgora !== null) return daReservaAgora
          const elemento = criarElementoDeAudioFalso()
          if (elementoRecusaPlay) elemento.play.mockRejectedValue(Object.assign(new Error('sem gesto'), { name: 'NotAllowedError' }))
          avulsos.push(elemento)
          return elemento
        },
        criarUrlDoAudio: () => 'blob:som',
        revogarUrl: () => undefined,
        agora: () => Date.now(),
        orcamentoDoCacheBytes: 150 * MB,
        aoReporReservas: (ouvinte) => reservasDoMotor.aoRepor(ouvinte),
      })
      return motor
    },
  })
  const motorCriado = (): MotorAoVivo => {
    if (motor === null) throw new Error('o instalador não criou o motor')
    return motor
  }
  /** Um áudio de `segundos` segundos que a sala sabe servir. */
  const arquivo = (n: number, segundos: number): string => {
    const id = idDeAudio(n)
    tamanhos.set(id, Math.round(segundos * BYTES_POR_SEGUNDO_FALSO))
    return id
  }
  const tocar = (instancia: string, midia: string, loop: boolean, extra: { deslocamentoS?: number } = {}) =>
    socket.receive({ type: 'som.tocar', instancia, fonte: { tipo: 'arquivo', midia }, volume: 0.7, loop, ...extra })
  const fontesTocadas = (): FonteFalsa[] => audio.fontes.filter((fonte) => fonte.addEventListener.mock.calls.length > 0)
  const falhas = () => socket.sent.filter((m) => m.type === 'som.falhou')
  /** O ganho com que a fonte começou (o volume do efeito vezes o do aparelho ao quadrado; 0 com Mudo). */
  const ganhoInicialDe = (fonte: FonteFalsa): number => {
    const ganho = audio.ganhos.find((candidato) => candidato === fonte.destino)
    const inicial = ganho?.gain.setValueAtTime.mock.calls[0]?.[0]
    if (inicial === undefined) throw new Error('a fonte não está ligada a um ganho')
    return inicial
  }
  return { conexao, socket, sons, som, motorCriado, arquivo, tocar, fontesTocadas, falhas, pedidos, buscar, respostas, avulsos, daReserva, reservas, ganhoInicialDe }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(10_000)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('sons ao vivo do jogador: toca o que o mestre manda', () => {
  it('loop pego no meio: chega antes do gesto, espera sem prazo, conta "sem-gesto" UMA vez e começa no deslocamento corrigido', async () => {
    const s = sala()
    const chuva = s.arquivo(1, 10)
    s.tocar('som-chuva', chuva, true, { deslocamentoS: 7.5 })
    expect(s.sons.esperando()).toBe(1)
    // O volume que chega enquanto espera não conta outra falha.
    s.socket.receive({ type: 'som.volume', instancia: 'som-chuva', volume: 0.4 })
    vi.setSystemTime(10_000 + 3 * ESPERA_DO_EFEITO_CURTO_MS)
    await assentar()
    expect(s.falhas()).toEqual([{ type: 'som.falhou', instancia: 'som-chuva', motivo: 'sem-gesto' }])
    expect(s.sons.esperando()).toBe(1)
    expect(s.fontesTocadas()).toEqual([])

    // O toque na faixinha: 6 s depois do pedido, o loop de 10 s começa em (7,5 + 6) % 10 = 3,5.
    s.sons.tocarParaOuvir()
    await assentar()
    const [fonte] = s.fontesTocadas()
    expect(fonte?.start).toHaveBeenCalledWith(0, 3.5)
    expect(s.sons.esperando()).toBe(0)
    expect(s.pedidos).toEqual([{ url: `/sons/${chuva}`, chave: CHAVE }])
    expect(s.falhas()).toHaveLength(1)
  })

  it('o loop que a conexão guardou antes de instalar entra no ponto de agora', async () => {
    const sockets: FakeSocket[] = []
    const conexao = createPlayerConnection({ url: 'ws://h/ws', code: 'ABC123', name: 'Ana', storage: null, createSocket: () => sockets[sockets.push(new FakeSocket()) - 1] })
    const socket = sockets[0]
    socket.open()
    socket.receive({ type: 'welcome', playerId: 'p', resumeToken: 't', name: 'Ana' })
    socket.receive({ type: 'som.tocar', instancia: 'som-l', fonte: { tipo: 'arquivo', midia: idDeAudio(9) }, volume: 0.5, loop: true, deslocamentoS: 2 })
    vi.setSystemTime(14_000)
    const tocados: unknown[] = []
    const sons = instalarSonsAoVivo(conexao, {
      destravarNoPrimeiroGesto: () => () => undefined,
      criarMotor: () => ({
        tocar: (instancia, fonte, opcoes) => {
          tocados.push({ instancia, fonte, opcoes })
          return { aceito: true }
        },
        parar: () => undefined,
        pararTudo: () => undefined,
        mudarVolume: () => undefined,
        precarregar: () => undefined,
        assinar: () => () => undefined,
        desmontar: () => undefined,
      }),
    })
    expect(tocados).toEqual([{ instancia: 'som-l', fonte: { tipo: 'arquivo', ref: `midia:${idDeAudio(9)}`, bytes: 0 }, opcoes: { loop: true, volumeDoEfeito: 0.5, deslocamentoS: 6 } }])
    sons.desinstalar()
  })

  it('efeito curto que esperou o gesto 2 s é descartado e vira "sem-gesto"; o toque depois não o toca', async () => {
    const s = sala()
    s.tocar('som-grito', s.arquivo(2, 1), false)
    expect(s.sons.esperando()).toBe(1)
    expect(s.falhas()).toEqual([])
    vi.advanceTimersByTime(ESPERA_DO_EFEITO_CURTO_MS)
    expect(s.falhas()).toEqual([{ type: 'som.falhou', instancia: 'som-grito', motivo: 'sem-gesto' }])
    expect(s.sons.esperando()).toBe(0)
    s.sons.tocarParaOuvir()
    await assentar()
    expect(s.fontesTocadas()).toEqual([])
  })

  it('recusa do motor vira som.falhou com o motivo da lista fechada, sem a chave', async () => {
    const s = sala()
    s.sons.tocarParaOuvir()
    // Não carregou: a sala recusou (o mesmo 404 de toda recusa).
    s.tocar('som-x', idDeAudio(77), false)
    await assentar()
    // O 4º loop: o motor recusa na hora.
    for (const [i, instancia] of ['l1', 'l2', 'l3', 'l4'].entries()) s.tocar(instancia, s.arquivo(10 + i, 10), true)
    await assentar()
    expect(s.falhas()).toEqual([
      { type: 'som.falhou', instancia: 'som-x', motivo: 'nao-carregou' },
      { type: 'som.falhou', instancia: 'l4', motivo: 'limite-de-loops' },
    ])
    for (const falha of s.falhas()) expect(MOTIVOS_DA_FALHA_DO_SOM).toContain(falha.motivo)
    expect(JSON.stringify(s.socket.sent)).not.toContain(CHAVE)
  })

  it('dois toques do mesmo som fazem UMA busca; a pré-carga busca antes do clique', async () => {
    const s = sala()
    s.sons.tocarParaOuvir()
    const sino = s.arquivo(3, 1)
    s.tocar('som-a', sino, false)
    s.tocar('som-b', sino, false)
    await assentar()
    expect(s.buscar).toHaveBeenCalledTimes(1)
    expect(s.fontesTocadas()).toHaveLength(2)
    const pre = s.arquivo(4, 1)
    s.socket.receive({ type: 'som.precarregar', midias: [pre] })
    await assentar()
    expect(s.pedidos.map((p) => p.url)).toEqual([`/sons/${sino}`, `/sons/${pre}`])
    s.tocar('som-c', pre, false)
    await assentar()
    expect(s.buscar).toHaveBeenCalledTimes(2)
  })

  it('parar, volume e parar tudo do mestre chegam ao motor', async () => {
    const s = sala()
    const motor = s.motorCriado()
    const parar = vi.spyOn(motor, 'parar')
    const mudarVolume = vi.spyOn(motor, 'mudarVolume')
    const pararTudo = vi.spyOn(motor, 'pararTudo')
    s.socket.receive({ type: 'som.parar', instancia: 'som-1', fadeMs: 300 })
    s.socket.receive({ type: 'som.volume', instancia: 'som-1', volume: 0.2 })
    s.socket.receive({ type: 'som.pararTudo' })
    expect(parar).toHaveBeenCalledWith('som-1', 300)
    expect(mudarVolume).toHaveBeenCalledWith('som-1', 0.2)
    expect(pararTudo).toHaveBeenCalledTimes(1)
  })

  it('o <audio> recusado (iOS, contexto já rodando) recomeça no toque da faixinha com um <audio> da reserva', async () => {
    const s = sala({ elementoRecusaPlay: true })
    s.sons.tocarParaOuvir()
    expect(s.daReserva).toHaveLength(RESERVAS_POR_GESTO)
    // Dois sons grandes já levaram as reservas deste toque.
    s.reservas.tirar()
    s.reservas.tirar()
    // Mais de 1 MB: toca por <audio>; sem reserva, o motor cria um que o iOS recusa fora do gesto.
    s.tocar('som-trilha', s.arquivo(5, (2 * MB) / BYTES_POR_SEGUNDO_FALSO), true)
    await assentar()
    const [avulso] = s.avulsos
    avulso?.disparar('loadedmetadata')
    await assentar()
    expect(s.sons.esperando()).toBe(1)
    expect(s.falhas()).toEqual([{ type: 'som.falhou', instancia: 'som-trilha', motivo: 'sem-gesto' }])

    // O contexto já roda: o aviso de destravamento não vem de novo. O toque repõe a reserva e o motor tenta outra vez.
    s.sons.tocarParaOuvir()
    await assentar()
    const reposto = s.daReserva[RESERVAS_POR_GESTO]
    if (reposto === undefined) throw new Error('o toque deveria repor a reserva')
    reposto.disparar('loadedmetadata')
    await assentar()
    // O play do aquecimento (no toque) e o do motor.
    expect(reposto.play).toHaveBeenCalledTimes(2)
    expect(s.sons.esperando()).toBe(0)
  })

  it('a faixinha sai assim que o toque tira o som da espera, com o arquivo ainda descendo', async () => {
    const s = sala()
    const chuva = s.arquivo(1, 10)
    let soltar: () => void = () => undefined
    s.respostas.set(
      chuva,
      () =>
        new Promise<Response>((resolve) => {
          soltar = () => resolve(new Response(new Uint8Array(10 * BYTES_POR_SEGUNDO_FALSO), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }))
        }),
    )
    s.tocar('som-chuva', chuva, true)
    await assentar()
    expect(s.sons.esperando()).toBe(1)
    s.sons.tocarParaOuvir()
    await assentar()
    // O áudio já destravou; o que falta é o arquivo, e a faixinha não pede outro toque por isso.
    expect(s.fontesTocadas()).toEqual([])
    expect(s.sons.esperando()).toBe(0)
    soltar()
    await assentar()
    expect(s.fontesTocadas()).toHaveLength(1)
    expect(s.sons.esperando()).toBe(0)
  })

  it('com Mudo, a faixinha não aparece e nada volta ao mestre como sem-gesto; tirar o Mudo a mostra', async () => {
    const s = sala({ mudo: true })
    const avisos = vi.fn()
    s.sons.assinar(avisos)
    s.tocar('som-chuva', s.arquivo(1, 10), true)
    s.tocar('som-grito', s.arquivo(2, 1), false)
    await assentar()
    expect(s.sons.esperando()).toBe(0)
    vi.advanceTimersByTime(ESPERA_DO_EFEITO_CURTO_MS)
    await assentar()
    expect(s.falhas()).toEqual([])
    avisos.mockClear()
    s.som.getState().alternarMudo()
    expect(avisos).toHaveBeenCalled()
    // O efeito curto já foi descartado; o loop segue esperando o toque.
    expect(s.sons.esperando()).toBe(1)
  })

  it('a TV ignora o Mudo e o volume guardados neste navegador (ela não tem controle de som): mostra a faixinha e toca no volume padrão', async () => {
    const s = sala({ role: 'table', mudo: true, ignorarPreferenciaGuardada: true })
    s.tocar('som-chuva', s.arquivo(1, 10), true)
    await assentar()
    expect(s.sons.esperando()).toBe(1)
    s.sons.tocarParaOuvir()
    await assentar()
    const [fonte] = s.fontesTocadas()
    if (fonte === undefined) throw new Error('a TV não tocou')
    // 0,7 do efeito x 0,35 (o volume padrão do aparelho) ao quadrado; com o Mudo guardado valendo, seria 0.
    expect(s.ganhoInicialDe(fonte)).toBeCloseTo(0.7 * PREFERENCIA_DE_SOM_PADRAO.volume * PREFERENCIA_DE_SOM_PADRAO.volume)
  })
})

describe('sons ao vivo do jogador: os fins de sessão param tudo', () => {
  const fins: { nome: string; role?: 'table'; fazer: (socket: FakeSocket) => void }[] = [
    { nome: 'room.closed', fazer: (socket) => socket.receive({ type: 'room.closed' }) },
    { nome: 'kicked', fazer: (socket) => socket.receive({ type: 'kicked' }) },
    { nome: 'session.replaced', fazer: (socket) => socket.receive({ type: 'session.replaced' }) },
    { nome: 'queda do socket (o jogador volta sozinho)', fazer: (socket) => socket.cair() },
    { nome: 'queda do socket da TV (vira erro)', role: 'table', fazer: (socket) => socket.cair() },
  ]
  for (const fim of fins) {
    it(fim.nome, async () => {
      const s = sala({ role: fim.role })
      s.sons.tocarParaOuvir()
      s.tocar('som-chuva', s.arquivo(1, 10), true)
      await assentar()
      expect(s.fontesTocadas()).toHaveLength(1)
      const pararTudo = vi.spyOn(s.motorCriado(), 'pararTudo')
      fim.fazer(s.socket)
      await assentar()
      expect(pararTudo).toHaveBeenCalledTimes(1)
      // E a fonte para (com o fade do Parar).
      expect(s.fontesTocadas()[0]?.stop).toHaveBeenCalled()
    })
  }

  it('desinstalar desmonta o motor e para de ouvir a conexão', async () => {
    const s = sala()
    const desmontar = vi.spyOn(s.motorCriado(), 'desmontar')
    s.sons.desinstalar()
    expect(desmontar).toHaveBeenCalledTimes(1)
    s.sons.tocarParaOuvir()
    s.tocar('som-1', s.arquivo(1, 1), false)
    await assentar()
    expect(s.fontesTocadas()).toEqual([])
  })
})

describe('a reserva de <audio> do gesto', () => {
  it('repor cria e dá play em 2 <audio> AGORA (síncrono), avisa quem ouve, e cada um sai uma vez só', () => {
    const elementos: ElementoDeAudioFalso[] = []
    const reserva = criarReservaDoGesto(() => {
      const elemento = criarElementoDeAudioFalso()
      elementos.push(elemento)
      return elemento
    })
    const avisado = vi.fn()
    reserva.aoRepor(avisado)
    expect(reserva.tirar()).toBeNull()
    reserva.repor()
    expect(elementos).toHaveLength(RESERVAS_POR_GESTO)
    for (const elemento of elementos) {
      expect(elemento.play).toHaveBeenCalledTimes(1)
      expect(elemento.src).toMatch(/^data:audio\/wav;base64,/)
    }
    expect(avisado).toHaveBeenCalledTimes(1)
    const primeiro = reserva.tirar()
    expect(primeiro).toBe(elementos[0])
    // Repor de novo completa só o que saiu.
    reserva.repor()
    expect(elementos).toHaveLength(RESERVAS_POR_GESTO + 1)
    expect(reserva.tirar()).toBe(elementos[1])
  })
})
