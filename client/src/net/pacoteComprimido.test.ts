// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  abrirPacote,
  COMPRIMIR_A_PARTIR_DE,
  comprimirPacote,
  criarEntradaEmOrdem,
  criarSaidaEmOrdem,
  ehRedeLocal,
  lerPacote,
  pedeGzip,
  valeComprimir,
} from './pacoteComprimido'

/**
 * PACOTE COMPRIMIDO para quem joga pelo 4G: a mensagem grande do mestre (o
 * mapa inteiro da cena) sai em gzip, dentro de um envelope `{"gz":"<base64>"}`,
 * só para quem disse no `join` que sabe abrir. A pequena sai como sempre. E a
 * ordem nunca muda: o que o jogador lê é a mesma sequência que o mestre mandou.
 */

/** JSON parecido com o de um mapa: muita parede repetida, que é o que o gzip encolhe. */
function mapaGrande(paredes: number): string {
  const walls = Array.from({ length: paredes }, (_, i) => ({ id: `parede-${i}`, x1: i * 50, y1: 0, x2: i * 50, y2: 50, blocksLight: true, blocksMove: true, door: null }))
  return JSON.stringify({ type: 'snapshot', rev: 1, map: { id: 'm1', walls } })
}

const esperar = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('comprimirPacote / abrirPacote', () => {
  it('o mapa grande vai comprimido e volta idêntico, com muito menos bytes', async () => {
    const texto = mapaGrande(800)
    expect(texto.length).toBeGreaterThan(COMPRIMIR_A_PARTIR_DE)
    const pacote = await comprimirPacote(texto)
    if (pacote === null) throw new Error('o mapa grande deveria ir comprimido')
    const envelope = JSON.stringify(pacote)
    // Mesmo com o base64, o envelope é várias vezes menor que o texto.
    expect(envelope.length * 5).toBeLessThan(texto.length)
    expect(await abrirPacote(pacote.gz)).toBe(texto)
  })

  it('acentos e emoji atravessam a compressão sem estragar', async () => {
    const texto = JSON.stringify({ type: 'snapshot', nome: 'Câmara do Dragão 🐉'.repeat(3000) })
    const pacote = await comprimirPacote(texto)
    if (pacote === null) throw new Error('deveria ir comprimido')
    expect(await abrirPacote(pacote.gz)).toBe(texto)
  })

  it('pacote estragado não abre: devolve null, sem lançar', async () => {
    expect(await abrirPacote('isto não é base64 de gzip')).toBeNull()
    expect(await abrirPacote('AAAA')).toBeNull()
  })

  it('só vale comprimir a partir do limite', () => {
    expect(valeComprimir('x'.repeat(COMPRIMIR_A_PARTIR_DE - 1))).toBe(false)
    expect(valeComprimir('x'.repeat(COMPRIMIR_A_PARTIR_DE))).toBe(true)
    expect(COMPRIMIR_A_PARTIR_DE).toBe(32 * 1024)
  })
})

describe('pedeGzip: só quem veio pelo link público', () => {
  it('rede local (IP privado, localhost, .local) recebe texto, como sempre', () => {
    for (const nome of ['localhost', '127.0.0.1', '192.168.0.2', '10.1.2.3', '172.16.0.9', '172.31.255.1', '169.254.1.1', 'mesa.local', '[::1]', '[fe80::1]', '[fd12::3]']) {
      expect(ehRedeLocal(nome)).toBe(true)
      expect(pedeGzip(nome)).toBe(false)
    }
  })

  it('o link público do túnel (e IP público) pede gzip', () => {
    for (const nome of ['abc-def.trycloudflare.com', '172.32.0.1', '8.8.8.8', '192.169.0.1']) {
      expect(ehRedeLocal(nome)).toBe(false)
      expect(pedeGzip(nome)).toBe(true)
    }
  })
})

describe('lerPacote', () => {
  it('reconhece o envelope e só ele', () => {
    expect(lerPacote('{"gz":"H4sI"}')).toBe('H4sI')
    expect(lerPacote('{"type":"welcome","playerId":"p1"}')).toBeNull()
    expect(lerPacote('{"gz":1}')).toBeNull()
    expect(lerPacote('{"gz":"H4sI","type":"x"}')).toBeNull()
    expect(lerPacote('{"gz":"H4sI"')).toBeNull()
    expect(lerPacote(42)).toBeNull()
  })
})

describe('criarEntradaEmOrdem (lado do jogador)', () => {
  it('mensagem comum, sem pacote na frente, é entregue na hora (síncrona)', () => {
    const entregues: unknown[] = []
    const receber = criarEntradaEmOrdem((dado) => entregues.push(dado))
    receber('{"type":"pong"}')
    expect(entregues).toEqual(['{"type":"pong"}'])
  })

  it('o que chega depois de um pacote espera ele abrir: a ordem é a do mestre', async () => {
    const grande = mapaGrande(800)
    const outroGrande = mapaGrande(900)
    const a = await comprimirPacote(grande)
    const c = await comprimirPacote(outroGrande)
    if (a === null || c === null) throw new Error('deveriam ir comprimidos')
    const entregues: unknown[] = []
    const receber = criarEntradaEmOrdem((dado) => entregues.push(dado))
    receber(JSON.stringify(a))
    receber('{"type":"b"}')
    receber(JSON.stringify(c))
    receber('{"type":"d"}')
    // Nada passa na frente do pacote que ainda está abrindo.
    expect(entregues).toEqual([])
    await vi.waitFor(() => expect(entregues).toHaveLength(4))
    expect(entregues).toEqual([grande, '{"type":"b"}', outroGrande, '{"type":"d"}'])
  })

  it('pacote estragado some sozinho; o resto segue, em ordem', async () => {
    const entregues: unknown[] = []
    const receber = criarEntradaEmOrdem((dado) => entregues.push(dado))
    receber('{"gz":"estragado"}')
    receber('{"type":"b"}')
    await vi.waitFor(() => expect(entregues).toHaveLength(1))
    await esperar()
    expect(entregues).toEqual(['{"type":"b"}'])
    // Fila vazia de novo: volta a entregar na hora.
    receber('{"type":"c"}')
    expect(entregues).toEqual(['{"type":"b"}', '{"type":"c"}'])
  })
})

describe('criarSaidaEmOrdem (lado do mestre)', () => {
  function saida() {
    const enviados: { clientId: string; carga: object }[] = []
    const enviar = criarSaidaEmOrdem(async (clientId, carga) => {
      enviados.push({ clientId, carga })
    })
    return { enviar, enviados }
  }

  it('quem não pediu gzip recebe tudo como sempre, na hora', () => {
    const { enviar, enviados } = saida()
    const grande: object = JSON.parse(mapaGrande(800))
    void enviar('c1', grande, false)
    expect(enviados).toEqual([{ clientId: 'c1', carga: grande }])
  })

  it('quem pediu gzip: mensagem pequena sai na hora, igual', () => {
    const { enviar, enviados } = saida()
    void enviar('c1', { type: 'pong' }, true)
    expect(enviados).toEqual([{ clientId: 'c1', carga: { type: 'pong' } }])
  })

  it('quem pediu gzip: a grande vai no envelope, e a pequena de trás espera por ela', async () => {
    const { enviar, enviados } = saida()
    const texto = mapaGrande(800)
    const grande: object = JSON.parse(texto)
    const prontos = Promise.all([enviar('c1', grande, true), enviar('c1', { type: 'pong' }, true), enviar('c2', { type: 'outro' }, false)])
    // Outro jogador não espera na fila de ninguém.
    expect(enviados).toEqual([{ clientId: 'c2', carga: { type: 'outro' } }])
    await prontos
    const doC1 = enviados.filter((e) => e.clientId === 'c1').map((e) => e.carga)
    expect(doC1).toHaveLength(2)
    const pacote = lerPacote(JSON.stringify(doC1[0]))
    if (pacote === null) throw new Error('a grande deveria ir no envelope')
    expect(await abrirPacote(pacote)).toBe(texto)
    expect(doC1[1]).toEqual({ type: 'pong' })
    // Fila vazia de novo: a pequena volta a sair na hora.
    void enviar('c1', { type: 'pong', n: 2 }, true)
    expect(enviados.at(-1)).toEqual({ clientId: 'c1', carga: { type: 'pong', n: 2 } })
  })
})
