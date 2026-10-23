// @vitest-environment node
/**
 * SONS AO VIVO, fatia F5 (contrato em `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`,
 * seção 3): o jogador e a TV buscam o áudio em `/sons/<id>`, na mesma origem,
 * com a chave da conexão no cabeçalho `X-Labirinto-Chave`. Id torto ou sem
 * chave não chega à rede; a resposta só vale se for 200, áudio e até 15 MB;
 * 429 ganha UMA nova tentativa dentro do prazo do motor. A chave nunca vai
 * para a mensagem de erro (que pode virar log).
 */
import { describe, expect, it, vi } from 'vitest'
import { MIDIA_AUDIO_MAX_BYTES } from '../lib/midia'
import { PRAZO_DO_CARREGAMENTO_MS } from '../lib/sons/aoVivo/motor'
import { CABECALHO_DA_CHAVE_DA_MIDIA, criarCarregadorDaSala, type BuscarNaSala } from './carregadorDeSons'

const CHAVE = 'f'.repeat(64)
const ID = `${'a'.repeat(64)}.mp3`
const BYTES = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 1, 2, 3])

function resposta(status: number, corpo: BodyInit | null = BYTES, cabecalhos: Record<string, string> = { 'Content-Type': 'audio/mpeg' }): Response {
  return new Response(corpo, { status, headers: cabecalhos })
}

function carregador(respostas: Response[], chave: () => string | null = () => CHAVE) {
  const pedidos: { url: string; init: RequestInit }[] = []
  const buscar = vi.fn<BuscarNaSala>(async (url, init) => {
    pedidos.push({ url, init })
    const proxima = respostas.shift()
    if (proxima === undefined) throw new Error('o teste não esperava mais um pedido')
    return proxima
  })
  const esperas: number[] = []
  const carregar = criarCarregadorDaSala({
    chave,
    buscar,
    esperar: async (ms) => {
      esperas.push(ms)
    },
  })
  return { carregar, buscar, pedidos, esperas }
}

/** A promessa rejeitada, com a mensagem conferida: nunca a chave dentro. */
async function recusa(promessa: Promise<unknown>): Promise<string> {
  try {
    await promessa
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    expect(mensagem).not.toContain(CHAVE)
    return mensagem
  }
  throw new Error('deveria ter recusado')
}

describe('carregador da sala: o pedido', () => {
  it('busca /sons/<id> na mesma origem, com a chave no cabeçalho, sem cache, sem credencial e sem seguir redirecionamento', async () => {
    const { carregar, pedidos } = carregador([resposta(200)])
    expect(await carregar(ID)).toEqual(BYTES)
    expect(pedidos).toHaveLength(1)
    const [{ url, init }] = pedidos
    expect(url).toBe(`/sons/${ID}`)
    expect(new Headers(init.headers).get(CABECALHO_DA_CHAVE_DA_MIDIA)).toBe(CHAVE)
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error', mode: 'same-origin' })
  })

  it('id torto não chega à rede (nem caminho, nem ref, nem maiúscula, nem outra extensão)', async () => {
    const { carregar, buscar } = carregador([])
    for (const torto of ['../adventure.json', `midia:${ID}`, `${'A'.repeat(64)}.mp3`, `${'a'.repeat(64)}.png`, `${ID}?x=1`, '', `/${ID}`]) await recusa(carregar(torto))
    expect(buscar).not.toHaveBeenCalled()
  })

  it('sem chave da conexão não chega à rede', async () => {
    const { carregar, buscar } = carregador([], () => null)
    await recusa(carregar(ID))
    expect(buscar).not.toHaveBeenCalled()
  })
})

describe('carregador da sala: a resposta', () => {
  it('404 recusa, sem tentar de novo', async () => {
    const { carregar, buscar } = carregador([resposta(404, null, {})])
    await recusa(carregar(ID))
    expect(buscar).toHaveBeenCalledTimes(1)
  })

  it('tipo que não é áudio recusa (html, sem tipo, octet-stream)', async () => {
    const tortos: Record<string, string>[] = [{ 'Content-Type': 'text/html' }, {}, { 'Content-Type': 'application/octet-stream' }]
    for (const cabecalhos of tortos) {
      const { carregar } = carregador([resposta(200, BYTES, cabecalhos)])
      await recusa(carregar(ID))
    }
    // O parâmetro do tipo não atrapalha.
    const { carregar } = carregador([resposta(200, BYTES, { 'Content-Type': 'Audio/MPEG; charset=binary' })])
    expect(await carregar(ID)).toEqual(BYTES)
  })

  it('acima de 15 MB recusa: pelo Content-Length, sem ler o corpo, e pelo corpo, quando o cabeçalho mente ou falta', async () => {
    let lido = false
    // highWaterMark 0: o `pull` só roda quando alguém lê (sem isso a própria stream puxa ao nascer).
    const corpoQueNaoDeveSerLido = new ReadableStream<Uint8Array>(
      {
        pull(controle) {
          lido = true
          controle.close()
        },
      },
      { highWaterMark: 0 },
    )
    const declarado = carregador([resposta(200, corpoQueNaoDeveSerLido, { 'Content-Type': 'audio/mpeg', 'Content-Length': String(MIDIA_AUDIO_MAX_BYTES + 1) })])
    await recusa(declarado.carregar(ID))
    expect(lido).toBe(false)

    const PEDACO = 1024 * 1024
    let entregues = 0
    const corpoSemFim = new ReadableStream<Uint8Array>({
      pull(controle) {
        entregues += 1
        controle.enqueue(new Uint8Array(PEDACO))
      },
    })
    const semCabecalho = carregador([resposta(200, corpoSemFim, { 'Content-Type': 'audio/wav' })])
    await recusa(semCabecalho.carregar(ID))
    // Parou logo depois de passar do teto, sem ler o resto.
    expect(entregues).toBeLessThanOrEqual(MIDIA_AUDIO_MAX_BYTES / PEDACO + 2)
  })

  it('exatamente 15 MB passa', async () => {
    const { carregar } = carregador([resposta(200, new Uint8Array(MIDIA_AUDIO_MAX_BYTES), { 'Content-Type': 'audio/wav', 'Content-Length': String(MIDIA_AUDIO_MAX_BYTES) })])
    expect((await carregar(ID)).length).toBe(MIDIA_AUDIO_MAX_BYTES)
  })

  it('corpo vazio recusa', async () => {
    const { carregar } = carregador([resposta(200, new Uint8Array(0))])
    await recusa(carregar(ID))
  })
})

describe('carregador da sala: 429', () => {
  it('uma nova tentativa, depois do Retry-After, e o segundo 200 vale', async () => {
    const { carregar, buscar, esperas } = carregador([resposta(429, null, { 'Retry-After': '2' }), resposta(200)])
    expect(await carregar(ID)).toEqual(BYTES)
    expect(buscar).toHaveBeenCalledTimes(2)
    expect(esperas).toEqual([2000])
  })

  it('só UMA: o segundo 429 recusa', async () => {
    const { carregar, buscar } = carregador([resposta(429, null, {}), resposta(429, null, {}), resposta(200)])
    await recusa(carregar(ID))
    expect(buscar).toHaveBeenCalledTimes(2)
  })

  it('Retry-After que passa do prazo do motor recusa sem tentar de novo', async () => {
    const segundos = String(Math.ceil(PRAZO_DO_CARREGAMENTO_MS / 1000) + 1)
    const { carregar, buscar, esperas } = carregador([resposta(429, null, { 'Retry-After': segundos }), resposta(200)])
    await recusa(carregar(ID))
    expect(buscar).toHaveBeenCalledTimes(1)
    expect(esperas).toEqual([])
  })

  it('a chave que caiu durante a espera não vai na nova tentativa', async () => {
    let chave: string | null = CHAVE
    const { carregar, buscar } = carregador([resposta(429, null, {}), resposta(200)], () => chave)
    const carregando = carregar(ID)
    chave = null
    await recusa(carregando)
    expect(buscar).toHaveBeenCalledTimes(1)
  })
})
