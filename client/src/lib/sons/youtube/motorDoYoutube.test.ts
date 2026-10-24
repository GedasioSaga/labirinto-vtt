// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreferenciaDeSom } from '../../../stores/somStore'
import { MAX_LOOPS, MAX_YOUTUBE, PRAZO_DO_CARREGAMENTO_MS, type EventoDoMotor, type MotorAoVivo } from '../aoVivo/motor'
import { motorComYoutube } from '../aoVivo/motorComYoutube'
import { ehVideoDoYoutube, type FonteDoSom, type VideoDoYoutube } from '../biblioteca'
import { criarPlayerPorMensagens, ESCUTA_A_CADA_MS, HOST_DO_PLAYER, MENSAGEM_DO_PLAYER_MAX, type EventosDoPlayerYT, type PlayerYT } from './apiDoYoutube'
import { criarMotorDoYoutube, ESPERA_DO_PLAY_MS, type FonteDoYoutube } from './motorDoYoutube'
import { ALLOW_DO_PLAYER, criarIframeDoPlayer, criarPalcoDoYoutube, enderecoDoPlayer, SANDBOX_DO_PLAYER } from './playerEscondido'

function video(id: string): VideoDoYoutube {
  if (!ehVideoDoYoutube(id)) throw new Error(`vídeo inválido no teste: ${id}`)
  return id
}

const BARDO = video('dQw4w9WgXcQ')
const VENTO = video('a-b_C1234xY')
const CHUVA = video('Zz9_-yY8xXw')

interface PlayerFalso extends PlayerYT {
  readonly video: VideoDoYoutube
  readonly eventos: EventosDoPlayerYT
  playVideo: ReturnType<typeof vi.fn<PlayerYT['playVideo']>>
  pauseVideo: ReturnType<typeof vi.fn<PlayerYT['pauseVideo']>>
  seekTo: ReturnType<typeof vi.fn<PlayerYT['seekTo']>>
  setVolume: ReturnType<typeof vi.fn<PlayerYT['setVolume']>>
  loadVideoById: ReturnType<typeof vi.fn<PlayerYT['loadVideoById']>>
  destroy: ReturnType<typeof vi.fn<PlayerYT['destroy']>>
}

/** A API FALSA do YouTube: cada player guarda o que o motor mandou e deixa o teste disparar pronto, estado e erro. */
function apiFalsa() {
  const players: PlayerFalso[] = []
  const abrirPlayer = vi.fn((videoId: VideoDoYoutube, eventos: EventosDoPlayerYT): PlayerYT => {
    const player: PlayerFalso = {
      video: videoId,
      eventos,
      playVideo: vi.fn<PlayerYT['playVideo']>(),
      pauseVideo: vi.fn<PlayerYT['pauseVideo']>(),
      seekTo: vi.fn<PlayerYT['seekTo']>(),
      setVolume: vi.fn<PlayerYT['setVolume']>(),
      loadVideoById: vi.fn<PlayerYT['loadVideoById']>(),
      getDuration: () => 200,
      destroy: vi.fn<PlayerYT['destroy']>(),
    }
    players.push(player)
    return player
  })
  return { players, abrirPlayer }
}

function montar({ destravado = true, preferencia = { volume: 1, mudo: false } }: { destravado?: boolean; preferencia?: PreferenciaDeSom } = {}) {
  const api = apiFalsa()
  let aberto = destravado
  let pref = preferencia
  const aoDestravar = new Set<() => void>()
  const aoGesto = new Set<() => void>()
  const aoMudarPreferencia = new Set<() => void>()
  const assinarEm = (lista: Set<() => void>) => (ouvinte: () => void) => {
    lista.add(ouvinte)
    return () => {
      lista.delete(ouvinte)
    }
  }
  const motor = criarMotorDoYoutube({
    abrirPlayer: api.abrirPlayer,
    destravado: () => aberto,
    aoDestravar: assinarEm(aoDestravar),
    aoGesto: assinarEm(aoGesto),
    lerPreferencia: () => pref,
    assinarPreferencia: assinarEm(aoMudarPreferencia),
    agora: () => 5000,
  })
  const eventos: EventoDoMotor[] = []
  motor.assinar((evento) => eventos.push(evento))
  return {
    motor,
    api,
    eventos,
    destravar() {
      aberto = true
      for (const ouvinte of [...aoDestravar]) ouvinte()
    },
    tocarNaFaixinha() {
      for (const ouvinte of [...aoGesto]) ouvinte()
    },
    mudarPreferencia(nova: PreferenciaDeSom) {
      pref = nova
      for (const ouvinte of [...aoMudarPreferencia]) ouvinte()
    },
  }
}

function yt(videoId: VideoDoYoutube, trecho: { inicioS?: number; fimS?: number } = {}): FonteDoYoutube {
  return { tipo: 'youtube', video: videoId, ...trecho }
}

const LOOP = { loop: true, volumeDoEfeito: 1 }
const CURTO = { loop: false, volumeDoEfeito: 1 }

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('motor do YouTube (API falsa)', () => {
  it('nada do YouTube abre antes do gesto: o pedido espera e o destravar abre o player', () => {
    const m = montar({ destravado: false })
    expect(m.motor.tocar('chuva', yt(CHUVA), LOOP)).toEqual({ aceito: true })
    expect(m.api.abrirPlayer).not.toHaveBeenCalled()
    expect(m.eventos).toEqual([{ tipo: 'esperando', instancia: 'chuva' }])
    m.destravar()
    expect(m.api.abrirPlayer).toHaveBeenCalledTimes(1)
    expect(m.eventos.at(-1)).toEqual({ tipo: 'carregando', instancia: 'chuva' })
  })

  it('efeito curto antes do gesto desiste em 2 s com sem-gesto, sem abrir player', () => {
    const m = montar({ destravado: false })
    m.motor.tocar('grito', yt(BARDO), CURTO)
    vi.advanceTimersByTime(2000)
    expect(m.eventos.at(-1)).toEqual({ tipo: 'recusado', instancia: 'grito', motivo: 'sem-gesto' })
    m.destravar()
    expect(m.api.abrirPlayer).not.toHaveBeenCalled()
  })

  it('pede o vídeo do início do trecho e avisa tocando com a duração do trecho', () => {
    const m = montar()
    m.motor.tocar('bardo', yt(BARDO, { inicioS: 42, fimS: 102 }), LOOP)
    const [player] = m.api.players
    if (player === undefined) throw new Error('o player não abriu')
    expect(player.loadVideoById).not.toHaveBeenCalled()
    player.eventos.onReady()
    expect(player.loadVideoById).toHaveBeenCalledWith({ videoId: BARDO, startSeconds: 42, endSeconds: 102 })
    player.eventos.onStateChange(1)
    expect(m.eventos.at(-1)).toEqual({ tipo: 'tocando', instancia: 'bardo', loop: true, duracaoS: 60, deslocamentoS: 0, inicioEmMs: 5000 })
  })

  it('ENDED com loop volta a inicioS (não ao zero) e segue tocando', () => {
    const m = montar()
    m.motor.tocar('bardo', yt(BARDO, { inicioS: 42 }), LOOP)
    const [player] = m.api.players
    if (player === undefined) throw new Error('o player não abriu')
    player.eventos.onReady()
    player.eventos.onStateChange(1)
    player.eventos.onStateChange(0)
    expect(player.seekTo).toHaveBeenCalledWith(42, true)
    expect(player.playVideo).toHaveBeenCalled()
    expect(m.eventos.some((evento) => evento.tipo === 'terminou')).toBe(false)
  })

  it('ENDED com loop e fim marcado pede o trecho inteiro de novo (o endSeconds vale uma passada)', () => {
    const m = montar()
    m.motor.tocar('bardo', yt(BARDO, { inicioS: 10, fimS: 20 }), LOOP)
    const [player] = m.api.players
    if (player === undefined) throw new Error('o player não abriu')
    player.eventos.onReady()
    player.eventos.onStateChange(1)
    player.eventos.onStateChange(0)
    expect(player.loadVideoById).toHaveBeenLastCalledWith({ videoId: BARDO, startSeconds: 10, endSeconds: 20 })
    expect(player.loadVideoById).toHaveBeenCalledTimes(2)
  })

  it('ENDED sem loop termina com fim e libera o player para o próximo vídeo', () => {
    const m = montar()
    m.motor.tocar('grito', yt(BARDO), CURTO)
    const [player] = m.api.players
    if (player === undefined) throw new Error('o player não abriu')
    player.eventos.onReady()
    player.eventos.onStateChange(1)
    player.eventos.onStateChange(0)
    expect(m.eventos.at(-1)).toEqual({ tipo: 'terminou', instancia: 'grito', motivo: 'fim' })
    m.motor.tocar('vento', yt(VENTO), CURTO)
    expect(m.api.abrirPlayer).toHaveBeenCalledTimes(1)
    expect(player.loadVideoById).toHaveBeenLastCalledWith({ videoId: VENTO, startSeconds: 0 })
  })

  it.each([
    [150, 'youtube-bloqueado'],
    [101, 'youtube-bloqueado'],
    [153, 'youtube-bloqueado'],
    [100, 'youtube-indisponivel'],
    [2, 'fonte-invalida'],
    [5, 'nao-carregou'],
  ] as const)('erro %i vira recusa %s sem travar: o próximo vídeo usa a mesma vaga', (codigo, motivo) => {
    const m = montar()
    m.motor.tocar('bardo', yt(BARDO), LOOP)
    const [player] = m.api.players
    if (player === undefined) throw new Error('o player não abriu')
    player.eventos.onReady()
    player.eventos.onError(codigo)
    expect(m.eventos.at(-1)).toEqual({ tipo: 'recusado', instancia: 'bardo', motivo })
    expect(m.motor.tocar('vento', yt(VENTO), CURTO)).toEqual({ aceito: true })
    expect(player.loadVideoById).toHaveBeenLastCalledWith({ videoId: VENTO, startSeconds: 0 })
  })

  it(`no máximo ${MAX_YOUTUBE} players: o 3º vídeo derruba o mais antigo e reaproveita a vaga dele`, () => {
    const m = montar()
    m.motor.tocar('a', yt(BARDO), LOOP)
    m.motor.tocar('b', yt(VENTO), LOOP)
    for (const player of m.api.players) player.eventos.onReady()
    m.motor.tocar('c', yt(CHUVA), LOOP)
    expect(m.api.abrirPlayer).toHaveBeenCalledTimes(MAX_YOUTUBE)
    expect(m.eventos).toContainEqual({ tipo: 'terminou', instancia: 'a', motivo: 'derrubado' })
    expect(m.api.players[0]?.loadVideoById).toHaveBeenLastCalledWith({ videoId: CHUVA, startSeconds: 0 })
  })

  it('volume = efeito × aparelho ao quadrado; Mudo zera sem parar', () => {
    const m = montar({ preferencia: { volume: 0.6, mudo: false } })
    m.motor.tocar('bardo', yt(BARDO), { loop: true, volumeDoEfeito: 0.5 })
    const [player] = m.api.players
    if (player === undefined) throw new Error('o player não abriu')
    player.eventos.onReady()
    expect(player.setVolume).toHaveBeenLastCalledWith(18)
    m.mudarPreferencia({ volume: 0.6, mudo: true })
    expect(player.setVolume).toHaveBeenLastCalledWith(0)
    expect(player.pauseVideo).not.toHaveBeenCalled()
    m.motor.mudarVolume('bardo', 1)
    m.mudarPreferencia({ volume: 1, mudo: false })
    expect(player.setVolume).toHaveBeenLastCalledWith(100)
  })

  it('id torto (fora do validador, vindo de JSON cru) é recusado antes de abrir player', () => {
    const m = montar()
    const torto: unknown = JSON.parse('{"tipo":"youtube","video":"javascript:alert(1)"}')
    const fonte: FonteDoYoutube = Object.assign(yt(BARDO), torto)
    expect(m.motor.tocar('x', fonte, CURTO)).toEqual({ aceito: false, motivo: 'fonte-invalida' })
    expect(m.api.abrirPlayer).not.toHaveBeenCalled()
  })

  it('player que nunca responde (sem internet) recusa com nao-carregou e é descartado', () => {
    const m = montar()
    m.motor.tocar('bardo', yt(BARDO), LOOP)
    vi.advanceTimersByTime(PRAZO_DO_CARREGAMENTO_MS)
    expect(m.eventos.at(-1)).toEqual({ tipo: 'recusado', instancia: 'bardo', motivo: 'nao-carregou' })
    expect(m.api.players[0]?.destroy).toHaveBeenCalled()
    m.motor.tocar('bardo', yt(BARDO), LOOP)
    expect(m.api.abrirPlayer).toHaveBeenCalledTimes(2)
  })

  it('loop parado no começo (iOS sem toque) volta a esperar; o toque na faixinha dá o play dentro do gesto', () => {
    const m = montar()
    m.motor.tocar('chuva', yt(CHUVA), LOOP)
    const [player] = m.api.players
    if (player === undefined) throw new Error('o player não abriu')
    player.eventos.onReady()
    player.eventos.onStateChange(-1)
    vi.advanceTimersByTime(ESPERA_DO_PLAY_MS)
    expect(m.eventos.at(-1)).toEqual({ tipo: 'esperando', instancia: 'chuva' })
    m.tocarNaFaixinha()
    expect(player.playVideo).toHaveBeenCalledTimes(1)
    player.eventos.onStateChange(1)
    expect(m.eventos.at(-1)).toMatchObject({ tipo: 'tocando', instancia: 'chuva' })
  })

  it('parar pausa e avisa; desmontar destrói os players', () => {
    const m = montar()
    m.motor.tocar('bardo', yt(BARDO), LOOP)
    const [player] = m.api.players
    if (player === undefined) throw new Error('o player não abriu')
    player.eventos.onReady()
    m.motor.parar('bardo')
    expect(player.pauseVideo).toHaveBeenCalled()
    expect(m.eventos.at(-1)).toEqual({ tipo: 'terminou', instancia: 'bardo', motivo: 'parado' })
    m.motor.desmontar()
    expect(player.destroy).toHaveBeenCalled()
  })
})

/** Um motor de arquivos de mentira que avisa o que tocou, para o motor com YouTube contar os loops. */
function localFalso() {
  const ouvintes = new Set<(evento: EventoDoMotor) => void>()
  const avisar = (evento: EventoDoMotor) => {
    for (const ouvinte of [...ouvintes]) ouvinte(evento)
  }
  const motor = {
    tocar: vi.fn<MotorAoVivo['tocar']>(() => ({ aceito: true })),
    parar: vi.fn<MotorAoVivo['parar']>((instancia) => avisar({ tipo: 'terminou', instancia, motivo: 'parado' })),
    pararTudo: vi.fn<MotorAoVivo['pararTudo']>(),
    mudarVolume: vi.fn<MotorAoVivo['mudarVolume']>(),
    precarregar: vi.fn<MotorAoVivo['precarregar']>(),
    assinar: vi.fn<MotorAoVivo['assinar']>((ouvinte) => {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    }),
    desmontar: vi.fn<MotorAoVivo['desmontar']>(),
  } satisfies MotorAoVivo
  return motor
}

describe('motor com YouTube: o mesmo contrato do motor local', () => {
  const ARQUIVO: FonteDoSom = { tipo: 'arquivo', ref: `midia:${'a'.repeat(64)}.mp3`, bytes: 1000 }

  it('arquivo vai ao motor local; vídeo vai ao player escondido', () => {
    const local = localFalso()
    const m = montar()
    const motor = motorComYoutube(local, m.motor)
    motor.tocar('grito', ARQUIVO, CURTO)
    expect(local.tocar).toHaveBeenCalledWith('grito', ARQUIVO, CURTO)
    motor.tocar('bardo', yt(BARDO), LOOP)
    expect(local.tocar).toHaveBeenCalledTimes(1)
    expect(m.api.abrirPlayer).toHaveBeenCalledTimes(1)
    motor.precarregar(['x'])
    expect(local.precarregar).toHaveBeenCalledWith(['x'])
  })

  it(`o teto de ${MAX_LOOPS} loops conta arquivo e vídeo juntos; a recusa chega a quem ouve`, () => {
    const local = localFalso()
    const m = montar()
    const motor = motorComYoutube(local, m.motor)
    const eventos: EventoDoMotor[] = []
    motor.assinar((evento) => eventos.push(evento))
    motor.tocar('chuva', ARQUIVO, LOOP)
    motor.tocar('vento', ARQUIVO, LOOP)
    expect(motor.tocar('bardo', yt(BARDO), LOOP)).toEqual({ aceito: true })
    expect(motor.tocar('mar', yt(VENTO), LOOP)).toEqual({ aceito: false, motivo: 'limite-de-loops' })
    expect(eventos).toContainEqual({ tipo: 'recusado', instancia: 'mar', motivo: 'limite-de-loops' })
    // Parar um loop abre a vaga.
    motor.parar('chuva')
    expect(motor.tocar('mar', yt(VENTO), LOOP)).toEqual({ aceito: true })
  })

  it('a mesma instância trocando de arquivo para vídeo para o arquivo; Parar tudo para os dois', () => {
    const local = localFalso()
    const m = montar()
    const motor = motorComYoutube(local, m.motor)
    motor.tocar('fundo', ARQUIVO, LOOP)
    motor.tocar('fundo', yt(BARDO), LOOP)
    expect(local.parar).toHaveBeenCalledWith('fundo', 0)
    motor.pararTudo()
    expect(local.pararTudo).toHaveBeenCalled()
    expect(m.eventos).toContainEqual({ tipo: 'terminou', instancia: 'fundo', motivo: 'parado' })
  })
})

describe('player escondido: iframe e conversa por mensagem', () => {
  it('o endereço sai só do id e da origem, no host sem cookies', () => {
    const endereco = new URL(enderecoDoPlayer(BARDO, 'http://tauri.localhost'))
    expect(endereco.origin).toBe(HOST_DO_PLAYER)
    expect(endereco.pathname).toBe(`/embed/${BARDO}`)
    expect(endereco.searchParams.get('origin')).toBe('http://tauri.localhost')
    expect(endereco.searchParams.get('enablejsapi')).toBe('1')
    expect(endereco.searchParams.get('playsinline')).toBe('1')
  })

  it('o iframe tem sandbox e allow mínimos, Referer só com a origem e fica fora do Tab', () => {
    const iframe = criarIframeDoPlayer(document, BARDO, 'http://localhost:1420')
    expect(iframe.getAttribute('sandbox')).toBe(SANDBOX_DO_PLAYER)
    expect(SANDBOX_DO_PLAYER.split(' ').sort()).toEqual(['allow-same-origin', 'allow-scripts'])
    expect(iframe.getAttribute('allow')).toBe(ALLOW_DO_PLAYER)
    expect(iframe.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin')
    expect(iframe.tabIndex).toBe(-1)
  })

  it('o palco só entra na página no primeiro player, fora da tela e escondido do leitor', () => {
    const palco = criarPalcoDoYoutube(window)
    expect(document.querySelector('.lb-sons-youtube')).toBeNull()
    const player = palco.abrirPlayer(BARDO, { onReady: vi.fn(), onStateChange: vi.fn(), onError: vi.fn() })
    const no = document.querySelector<HTMLElement>('.lb-sons-youtube')
    expect(no?.getAttribute('aria-hidden')).toBe('true')
    expect(no?.style.position).toBe('fixed')
    expect(no?.style.left).toBe('-10000px')
    expect(no?.querySelectorAll('iframe')).toHaveLength(1)
    player.destroy()
    expect(no?.querySelectorAll('iframe')).toHaveLength(0)
    palco.fechar()
    expect(document.querySelector('.lb-sons-youtube')).toBeNull()
  })

  function conversa() {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const janelaDoPlayer = iframe.contentWindow
    if (janelaDoPlayer === null) throw new Error('o jsdom não deu janela ao iframe')
    const enviados = vi.spyOn(janelaDoPlayer, 'postMessage').mockImplementation(() => undefined)
    const eventos = { onReady: vi.fn<() => void>(), onStateChange: vi.fn<(estado: number) => void>(), onError: vi.fn<(codigo: number) => void>() }
    const player = criarPlayerPorMensagens(window, iframe, eventos)
    const receber = (data: unknown, origin: string = HOST_DO_PLAYER, source: Window = janelaDoPlayer) => window.dispatchEvent(new MessageEvent('message', { data, origin, source }))
    const comandos = () => enviados.mock.calls.map(([mensagem]) => (typeof mensagem === 'string' ? JSON.parse(mensagem) : null))
    return { iframe, enviados, eventos, player, receber, comandos }
  }

  it('repete o listening só para a origem do player até ele responder; comando antes do pronto espera', () => {
    const c = conversa()
    c.player.playVideo()
    vi.advanceTimersByTime(ESCUTA_A_CADA_MS)
    const antesDoPronto = c.comandos()
    expect(antesDoPronto.length).toBeGreaterThan(0)
    for (const mensagem of antesDoPronto) expect(mensagem).toMatchObject({ event: 'listening', channel: 'widget' })
    for (const [, alvo] of c.enviados.mock.calls) expect(alvo).toBe(HOST_DO_PLAYER)
    c.receber(JSON.stringify({ event: 'onReady' }))
    expect(c.eventos.onReady).toHaveBeenCalledTimes(1)
    expect(c.comandos().slice(antesDoPronto.length).map((mensagem) => mensagem?.func)).toEqual(['addEventListener', 'addEventListener', 'playVideo'])
    const total = c.comandos().length
    vi.advanceTimersByTime(ESCUTA_A_CADA_MS * 4)
    expect(c.comandos()).toHaveLength(total)
  })

  it('confere a origem e a janela de quem manda; texto torto ou grande demais cai fora', () => {
    const c = conversa()
    const pronto = JSON.stringify({ event: 'onReady' })
    c.receber(pronto, 'https://golpe.net')
    c.receber(pronto, 'https://www.youtube.com')
    c.receber(pronto, HOST_DO_PLAYER, window)
    c.receber({ event: 'onReady' })
    c.receber('{não é json')
    c.receber(JSON.stringify({ event: 'onReady', lixo: 'x'.repeat(MENSAGEM_DO_PLAYER_MAX) }))
    expect(c.eventos.onReady).not.toHaveBeenCalled()
    c.receber(pronto)
    expect(c.eventos.onReady).toHaveBeenCalledTimes(1)
  })

  it('estado repetido (onStateChange e infoDelivery) é um aviso só; erro chega com o código; destruído não ouve mais', () => {
    const c = conversa()
    c.receber(JSON.stringify({ event: 'onReady' }))
    c.receber(JSON.stringify({ event: 'onStateChange', info: 1 }))
    c.receber(JSON.stringify({ event: 'infoDelivery', info: { playerState: 1, duration: 212.5 } }))
    c.receber(JSON.stringify({ event: 'infoDelivery', info: { playerState: 0 } }))
    expect(c.eventos.onStateChange.mock.calls).toEqual([[1], [0]])
    expect(c.player.getDuration()).toBe(212.5)
    c.receber(JSON.stringify({ event: 'onError', info: 150 }))
    expect(c.eventos.onError).toHaveBeenCalledWith(150)
    c.player.destroy()
    expect(c.iframe.isConnected).toBe(false)
    c.receber(JSON.stringify({ event: 'onError', info: 101 }))
    expect(c.eventos.onError).toHaveBeenCalledTimes(1)
  })
})
