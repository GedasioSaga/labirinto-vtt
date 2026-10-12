import { describe, expect, it, vi } from 'vitest'
import type { DancaDoJogador } from '../../../player/estadoDaDanca'
import { POSE_PARADA } from '../palco'
import { DIF } from '../regras'
import type { MusicaDaDanca, NotaDaDanca } from '../tipos'
import { ATRASO_DOS_COLEGAS_S, avancarColegas, criarPlateia, receberLotes } from './colegas'
import { baixarMusica, ErroDaMusica, type FontesDaMusica } from './musicaImportada'
import { configDaPartida, dificuldadeDaPartida, esperaDaMusica } from './partidaDoConvite'
import { CHAVE_DAS_PREFERENCIAS, gravarPreferencias, lerPreferencias, PREFERENCIAS_PADRAO } from './preferencias'

/** Os módulos de apoio da tela da dança: preferências, partida do convite, colegas e música importada. */

const AUDIO_ID = `${'a'.repeat(64)}.mp3`

function importada(primeiraDiversao: number, primeiraExpert: number): MusicaDaDanca {
  const nota = (t: number): NotaDaDanca => ({ t, lane: 0, len: 0, sub: 4 })
  return {
    tipo: 'arquivo',
    midia: `midia:${AUDIO_ID}`,
    nome: 'Funky',
    bpm: 119.75,
    primeiraBatida: 0.924,
    fase4: 0,
    duracaoS: 41.45,
    coreografias: { diversao: [nota(primeiraDiversao), nota(5)], expert: [nota(primeiraExpert), nota(4)] },
  }
}

function danca(musica: MusicaDaDanca, extra: Partial<DancaDoJogador> = {}): DancaDoJogador {
  return {
    sessao: 's',
    convite: { sessao: 's', pinId: 'pino', npc: 'Dona Ziza', fala: '…', permitida: 'escolha', notaMin: 'B', premio: { tipo: 'nada', texto: '' }, musica, participantes: [] },
    pausada: false,
    colegas: [],
    placares: {},
    fimEnviado: false,
    ...extra,
  }
}

describe('preferências da dança', () => {
  it('lê o que foi gravado e devolve o padrão campo a campo quando o dado está torto ou o armazém lança', () => {
    const dados = new Map<string, string>()
    const armazem = { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => void dados.set(k, v) }
    gravarPreferencias(armazem, { ajusteMs: 42, teclas: 'dfjk', somAcerto: false })
    expect(lerPreferencias(armazem)).toEqual({ ajusteMs: 42, teclas: 'dfjk', somAcerto: false })
    dados.set(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ ajusteMs: 9999, teclas: 'qwer', somAcerto: 'sim' }))
    expect(lerPreferencias(armazem)).toEqual({ ajusteMs: 300, teclas: 'setas', somAcerto: true })
    dados.set(CHAVE_DAS_PREFERENCIAS, '{quebrado')
    expect(lerPreferencias(armazem)).toEqual(PREFERENCIAS_PADRAO)
    const bloqueado = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('cheio')
      },
    }
    expect(lerPreferencias(bloqueado)).toEqual(PREFERENCIAS_PADRAO)
    expect(() => gravarPreferencias(bloqueado, PREFERENCIAS_PADRAO)).not.toThrow()
  })
})

describe('partida a partir do convite', () => {
  it('a música importada espera o mesmo tanto em todo aparelho, pela queda mais lenta e a primeira seta das duas coreografias', () => {
    const musica = importada(2.5, 1.0)
    expect(esperaDaMusica(musica)).toBeCloseTo(Math.max(DIF.diversao.tela, DIF.expert.tela) + 1.2 - 1.0, 9)
    expect(esperaDaMusica({ tipo: 'demo' })).toBe(0)
    const comecar = { emMs: 3000, recebidoEm: 500, participantes: [] }
    const buffer = { duration: 41 } as AudioBuffer
    const diversao = configDaPartida(danca(musica, { comecar }), 'diversao', buffer)
    const expert = configDaPartida(danca(musica, { comecar }), 'expert', buffer)
    expect(diversao?.inicioMs).toBe(expert?.inicioMs)
    expect(diversao?.inicioMs).toBeCloseTo(500 + 3000 + esperaDaMusica(musica) * 1000, 6)
    expect(diversao?.contagem).toBe('antes')
    expect(expert?.notas).toBe(musica.tipo === 'arquivo' ? musica.coreografias.expert : null)
  })

  it('sem o "começar", ou com a importada ainda baixando, não há partida; a dificuldade confirmada pelo mestre vale', () => {
    expect(configDaPartida(danca({ tipo: 'demo' }), 'diversao', null)).toBeNull()
    const comecar = { emMs: 3000, recebidoEm: 0, participantes: [{ playerId: 'eu', nome: 'Eu', dificuldade: 'expert' as const }] }
    expect(configDaPartida(danca(importada(3, 3), { comecar }), 'diversao', null)).toBeNull()
    const demo = configDaPartida(danca({ tipo: 'demo' }, { comecar }), 'diversao', null)
    expect(demo?.contagem).toBe('faixa')
    expect(demo?.notas.length).toBeGreaterThan(0)
    expect(dificuldadeDaPartida(danca({ tipo: 'demo' }, { comecar, pronto: 'diversao' }), 'eu', 'diversao')).toBe('expert')
    expect(dificuldadeDaPartida(danca({ tipo: 'demo' }, { pronto: 'diversao' }), 'eu', 'expert')).toBe('diversao')
  })
})

describe('colegas no palco', () => {
  it('cada lote entra uma vez, e cada toque vira pose só meio segundo depois, no tempo da música deste aparelho', () => {
    const plateia = criarPlateia(
      [
        { playerId: 'eu', nome: 'Eu' },
        { playerId: 'bia', nome: 'Bia', dificuldade: 'expert' },
      ],
      'eu',
    )
    expect(plateia.colegas.map((c) => c.nome)).toEqual(['Bia'])
    const lote = { seq: 1, playerId: 'bia', eventos: [{ lane: 2 as const, j: 'perfeito' as const, t: 10 }], placar: { precisao: 1, combo: 1, vida: 62, julgadas: 1 } }
    receberLotes(plateia, [lote])
    receberLotes(plateia, [lote])
    expect(plateia.colegas[0].fila).toHaveLength(1)
    avancarColegas(plateia, 10 + ATRASO_DOS_COLEGAS_S - 0.01, 0.5, {})
    expect(plateia.colegas[0].dancarino.pose).toBe(POSE_PARADA)
    avancarColegas(plateia, 10 + ATRASO_DOS_COLEGAS_S, 0.5, {})
    expect(plateia.colegas[0].dancarino.pose.bE).toBe('cima')
    // Vida zerada no Expert: cai e fica caída.
    avancarColegas(plateia, 11, 0.5, { bia: { precisao: 0.2, combo: 0, vida: 0, julgadas: 30 } })
    expect(plateia.colegas[0].dancarino.caiu).toBe(true)
  })
})

describe('música importada', () => {
  const sinal = (): AbortSignal => new AbortController().signal

  function fontes(resposta: () => Promise<Response>, decodificar: FontesDaMusica['decodificar'] = () => Promise.resolve({ duration: 41 } as AudioBuffer)): FontesDaMusica {
    return { buscar: vi.fn(resposta) as unknown as typeof fetch, decodificar, base: '/media/' }
  }

  it('baixa de /media/<id> mostrando o progresso e decodifica', async () => {
    const corpo = new Uint8Array(1000)
    const f = fontes(() => Promise.resolve(new Response(corpo, { status: 200, headers: { 'content-length': '1000' } })))
    const estados: string[] = []
    const buffer = await baixarMusica(`midia:${AUDIO_ID}`, (e) => estados.push(e.fase === 'baixando' ? `baixando ${e.fracao}` : e.fase), sinal(), f)
    expect(buffer.duration).toBe(41)
    expect(f.buscar).toHaveBeenCalledWith(`/media/${AUDIO_ID}`, expect.anything())
    expect(estados[0]).toBe('baixando 0')
    expect(estados).toContain('baixando 1')
    expect(estados.at(-1)).toBe('decodificando')
  })

  it('erro de rede, música sumida e arquivo que o navegador não abre viram frases claras', async () => {
    const semRede = fontes(() => Promise.reject(new TypeError('Failed to fetch')))
    await expect(baixarMusica(`midia:${AUDIO_ID}`, () => undefined, sinal(), semRede)).rejects.toThrow(/Confira a conexão com a sala/)
    const sumiu = fontes(() => Promise.resolve(new Response(null, { status: 404 })))
    await expect(baixarMusica(`midia:${AUDIO_ID}`, () => undefined, sinal(), sumiu)).rejects.toThrow(/não está mais na sala/)
    const torta = fontes(
      () => Promise.resolve(new Response(new Uint8Array(4), { status: 200 })),
      () => Promise.reject(new Error('EncodingError')),
    )
    await expect(baixarMusica(`midia:${AUDIO_ID}`, () => undefined, sinal(), torta)).rejects.toBeInstanceOf(ErroDaMusica)
    await expect(baixarMusica('midia:nao-e-audio.png', () => undefined, sinal(), sumiu)).rejects.toThrow(/formato/)
  })
})
