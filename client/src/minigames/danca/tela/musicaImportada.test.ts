import { describe, expect, it, vi } from 'vitest'
import { MIDIA_AUDIO_MAX_BYTES } from '../../../lib/midia'
import { CABECALHO_DA_CHAVE_DA_MIDIA } from '../../../player/carregadorDeSons'
import { baixarMusica, ErroDaMusica, type FontesDaMusica } from './musicaImportada'

/**
 * SONS F5d: a música importada da dança chega ao jogador pela MESMA rota dos
 * sons ao vivo (`/sons/<id>`, com a chave da conexão no cabeçalho), nunca por
 * `/media/<id>`, que deixa de servir áudio. O servidor só entrega a quem o
 * mestre liberou a música (no `net_send` do convite); qualquer recusa é o
 * mesmo 404, e o jogador lê uma frase clara, sem chave nem caminho.
 */

const ID = `${'b'.repeat(64)}.mp3`
const REF = `midia:${ID}`
const CHAVE = 'c'.repeat(64)
const OUTRA_CHAVE = 'd'.repeat(64)

type Pedido = { url: string; init: RequestInit }

function audio(bytes = 1000, tipo = 'audio/mpeg'): Response {
  return new Response(new Uint8Array(bytes), { status: 200, headers: { 'Content-Type': tipo, 'Content-Length': String(bytes) } })
}

/** A sala de mentira: devolve as respostas na ordem (a última se repete) e anota cada pedido. */
function daSala(respostas: readonly (() => Response)[], chave: () => string | null = () => CHAVE) {
  const pedidos: Pedido[] = []
  const esperas: number[] = []
  const buscar = vi.fn(async (url: string, init: RequestInit) => {
    pedidos.push({ url, init })
    return respostas[Math.min(pedidos.length - 1, respostas.length - 1)]()
  })
  const fontes: FontesDaMusica = {
    buscar,
    decodificar: () => Promise.resolve({ duration: 41 } as AudioBuffer), // o jsdom não tem Web Audio: só a duração importa aqui
    origem: { tipo: 'sala', chave },
    esperar: async (ms) => {
      esperas.push(ms)
    },
  }
  return { fontes, pedidos, esperas, buscar }
}

const sinal = (): AbortSignal => new AbortController().signal

/** A frase que o jogador lê, para conferir que não leva segredo nem caminho. */
async function fraseDoErro(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroDaMusica)
    return erro instanceof Error ? erro.message : ''
  }
  throw new Error('devia ter dado erro')
}

function semSegredo(frase: string): void {
  for (const proibido of [CHAVE, OUTRA_CHAVE, ID, '/sons', '/media', 'midia', 'C:']) expect(frase).not.toContain(proibido)
}

describe('música importada da dança pela sala (F5d)', () => {
  it('busca /sons/<id> com a chave no cabeçalho, na mesma origem, sem credencial e sem seguir redirecionamento; nunca /media', async () => {
    const { fontes, pedidos } = daSala([() => audio()])
    const buffer = await baixarMusica(REF, () => undefined, sinal(), fontes)
    expect(buffer.duration).toBe(41)
    expect(pedidos).toHaveLength(1)
    const [{ url, init }] = pedidos
    expect(url).toBe(`/sons/${ID}`)
    expect(url).not.toContain('/media/')
    expect(new Headers(init.headers).get(CABECALHO_DA_CHAVE_DA_MIDIA)).toBe(CHAVE)
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error', mode: 'same-origin' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('mostra o progresso pelo Content-Length e termina decodificando', async () => {
    const { fontes } = daSala([() => audio(1000)])
    const estados: string[] = []
    await baixarMusica(REF, (e) => estados.push(e.fase === 'baixando' ? `baixando ${e.fracao}` : e.fase), sinal(), fontes)
    expect(estados[0]).toBe('baixando 0')
    expect(estados).toContain('baixando 1')
    expect(estados.at(-1)).toBe('decodificando')
  })

  it('sem a chave da sala: frase clara e nada sai para a rede', async () => {
    const { fontes, buscar } = daSala([() => audio()], () => null)
    const frase = await fraseDoErro(baixarMusica(REF, () => undefined, sinal(), fontes))
    expect(frase).toMatch(/conexão com a sala/)
    semSegredo(frase)
    expect(buscar).not.toHaveBeenCalled()
  })

  it('404 (a música não foi liberada a esta conexão, ou não está na aventura): frase clara, sem a chave nem o caminho', async () => {
    const { fontes } = daSala([() => new Response(null, { status: 404 })])
    const frase = await fraseDoErro(baixarMusica(REF, () => undefined, sinal(), fontes))
    expect(frase).toMatch(/não chegou/)
    expect(frase).toMatch(/mestre/)
    semSegredo(frase)
  })

  it('429: uma nova tentativa depois do Retry-After, com a chave de AGORA; o segundo 429 vira "a sala está ocupada"', async () => {
    const chaves = [CHAVE, OUTRA_CHAVE]
    let vez = 0
    const ocupadaUmaVez = daSala([() => new Response(null, { status: 429, headers: { 'Retry-After': '2' } }), () => audio()], () => chaves[Math.min(vez++, 1)])
    await baixarMusica(REF, () => undefined, sinal(), ocupadaUmaVez.fontes)
    expect(ocupadaUmaVez.esperas).toEqual([2000])
    expect(ocupadaUmaVez.pedidos.map((p) => new Headers(p.init.headers).get(CABECALHO_DA_CHAVE_DA_MIDIA))).toEqual([CHAVE, OUTRA_CHAVE])

    const sempreOcupada = daSala([() => new Response(null, { status: 429, headers: { 'Retry-After': '1' } })])
    const frase = await fraseDoErro(baixarMusica(REF, () => undefined, sinal(), sempreOcupada.fontes))
    expect(frase).toMatch(/ocupada/)
    expect(sempreOcupada.pedidos).toHaveLength(2)
    semSegredo(frase)
  })

  it('resposta que não é áudio, ou que passa do teto de 15 MB, é recusada sem decodificar', async () => {
    const html = daSala([() => audio(10, 'text/html')])
    await expect(baixarMusica(REF, () => undefined, sinal(), html.fontes)).rejects.toBeInstanceOf(ErroDaMusica)
    const grande = daSala([
      () => new Response(new Uint8Array(4), { status: 200, headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(MIDIA_AUDIO_MAX_BYTES + 1) } }),
    ])
    await expect(baixarMusica(REF, () => undefined, sinal(), grande.fontes)).rejects.toBeInstanceOf(ErroDaMusica)
  })

  it('a Visão de jogador (base local, sem sala) segue buscando na mídia do mestre, sem chave', async () => {
    const pedidos: Pedido[] = []
    const fontes: FontesDaMusica = {
      buscar: async (url, init) => {
        pedidos.push({ url, init })
        return new Response(new Uint8Array(8), { status: 200 })
      },
      decodificar: () => Promise.resolve({ duration: 41 } as AudioBuffer), // idem: o jsdom não tem Web Audio
      origem: { tipo: 'local', base: 'http://asset.localhost/midia/' },
    }
    await baixarMusica(REF, () => undefined, sinal(), fontes)
    expect(pedidos.map((p) => p.url)).toEqual([`http://asset.localhost/midia/${ID}`])
    expect(new Headers(pedidos[0].init.headers).has(CABECALHO_DA_CHAVE_DA_MIDIA)).toBe(false)
  })
})
