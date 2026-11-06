import { describe, expect, it } from 'vitest'
import { urlDaSalaValida } from '../../../../lobby/nuvem/src/salaAberta'
import { novaChaveDaSala } from '../../lib/nuvem/bilhete'
import type { PedidoDaR1 } from './comandosDaR1'
import { BATIDA_DA_SALA_MS, criarSalaNoLobby, enderecosDaSala, ENDERECOS_DA_SALA_MAX } from './salaNoLobby'

/**
 * A sala aberta no Lobby (fatia B4): o que vai ao Lobby quando o mestre abre,
 * bate, troca o túnel e fecha a sala, e com que relógio o host confere o
 * bilhete. Tudo com `pedir`, relógio e batida falsos: nada fala com a rede.
 */

const TUNEL = 'https://alfa-beta-gama-delta.trycloudflare.com/player'
const OUTRO_TUNEL = 'https://eta-teta-iota-capa.trycloudflare.com/player'
const LAN = 'http://192.168.0.10:7878/player'
const LAN_2 = 'http://10.0.0.5:7878/player'
const LOOPBACK = 'http://127.0.0.1:7878/player'

interface Chamada {
  pedido: PedidoDaR1
  resolver: (corpo: unknown) => void
  rejeitar: (erro: unknown) => void
}

/** Um `pedir` que só responde quando o teste manda (`responder`), para ver o que fica no ar. */
function mesa(opcoes: { campanhaId?: () => string | null | Promise<string | null>; inicio?: number } = {}) {
  const chamadas: Chamada[] = []
  const batidas: { fazer: () => void; ms: number; parada: boolean }[] = []
  let relogio = opcoes.inicio ?? 1_000_000
  const sala = criarSalaNoLobby({
    pedir: (pedido) =>
      new Promise((resolve, reject) => {
        chamadas.push({ pedido, resolver: resolve, rejeitar: reject })
      }),
    campanhaId: opcoes.campanhaId ?? (() => 'camp-1'),
    now: () => relogio,
    repetir: (fazer, ms) => {
      const batida = { fazer, ms, parada: false }
      batidas.push(batida)
      return () => {
        batida.parada = true
      }
    },
  })
  return {
    sala,
    chamadas,
    batidas,
    avancar(ms: number) {
      relogio += ms
    },
    agora: () => relogio,
  }
}

/** Deixa as promessas encadeadas andarem até parar. */
async function assentar(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve()
}

function rotas(chamadas: readonly Chamada[]): string[] {
  return chamadas.map((chamada) => chamada.pedido.rota)
}

function corpoDe(chamada: Chamada | undefined): unknown {
  if (chamada === undefined || chamada.pedido.rota !== 'abrirSala') return undefined
  return chamada.pedido.corpo
}

describe('enderecosDaSala: o que vai ao Lobby', () => {
  it('põe o túnel primeiro e deixa de fora o 127.0.0.1 de "sem rede"', () => {
    // Arrange / Act
    const enderecos = enderecosDaSala([LOOPBACK, LAN], TUNEL)

    // Assert
    expect(enderecos).toEqual([
      { tipo: 'tunel', url: TUNEL },
      { tipo: 'lan', url: LAN },
    ])
  })

  it('só com 127.0.0.1 e sem túnel não sobra endereço nenhum', () => {
    expect(enderecosDaSala([LOOPBACK], null)).toEqual([])
  })

  it('URL da LAN repetida vai uma vez só (o Lobby recusa o pedido com repetida)', () => {
    expect(enderecosDaSala([LAN, LAN, LAN_2], null)).toEqual([
      { tipo: 'lan', url: LAN },
      { tipo: 'lan', url: LAN_2 },
    ])
  })

  it('corta no teto do Worker sem nunca levar o túnel', () => {
    const muitas = Array.from({ length: 10 }, (_, i) => `http://192.168.0.${i + 1}:7878/player`)
    const enderecos = enderecosDaSala(muitas, TUNEL)
    expect(enderecos).toHaveLength(ENDERECOS_DA_SALA_MAX)
    expect(enderecos[0]).toEqual({ tipo: 'tunel', url: TUNEL })
  })

  it('túnel fora da forma (http, maiúscula, outro domínio) fica de fora', () => {
    expect(enderecosDaSala([], 'http://alfa-beta.trycloudflare.com/player')).toEqual([])
    expect(enderecosDaSala([], 'https://Alfa-Beta.trycloudflare.com/player')).toEqual([])
    expect(enderecosDaSala([], 'https://alfa-beta.trycloudflare.com.evil.io/player')).toEqual([])
    // Nome acima de 63 caracteres: o Lobby recusa (ROTULO_MAX), e com ele o pedido inteiro.
    expect(enderecosDaSala([LAN], `https://${'a'.repeat(60)}-bbbb.trycloudflare.com/player`)).toEqual([{ tipo: 'lan', url: LAN }])
  })

  it('172.15 e 172.32 não são rede local; 172.16 e 172.31 são', () => {
    const urls = ['http://172.15.0.1:7878/player', 'http://172.16.0.1:7878/player', 'http://172.31.0.1:7878/player', 'http://172.32.0.1:7878/player']
    expect(enderecosDaSala(urls, null).map((endereco) => endereco.url)).toEqual(['http://172.16.0.1:7878/player', 'http://172.31.0.1:7878/player'])
  })

  it('tudo que o app deixa passar o Lobby aceita (senão o pedido inteiro é recusado e o túnel some junto)', () => {
    // Arrange: endereços que a forma do app aceita mas a do Worker pode não aceitar.
    const candidatas = [
      'http://192.168.0.10:0/player',
      'http://192.168.0.10:99999/player',
      'http://192.168.0.999:7878/player',
      'http://192.168.00.10:7878/player',
      'http://010.0.0.1:7878/player',
      LAN,
    ]

    // Act
    const enviados = enderecosDaSala(candidatas, TUNEL)

    // Assert
    for (const endereco of enviados) expect(urlDaSalaValida(endereco.tipo, endereco.url), endereco.url).toBe(true)
  })
})

describe('criarSalaNoLobby: abrir, bater, trocar o túnel e fechar', () => {
  it('abrir publica o código e os endereços da LAN sem o 127.0.0.1, e a batida fica marcada a cada 4 min', async () => {
    // Arrange
    const m = mesa()

    // Act
    void m.sala.abrir('ABC234', [LOOPBACK, LAN])
    await assentar()

    // Assert
    expect(rotas(m.chamadas)).toEqual(['abrirSala'])
    expect(m.chamadas[0]?.pedido).toMatchObject({ rota: 'abrirSala', campanhaId: 'camp-1' })
    expect(corpoDe(m.chamadas[0])).toEqual({ codigo: 'ABC234', enderecos: [{ tipo: 'lan', url: LAN }] })
    expect(m.batidas).toHaveLength(1)
    expect(m.batidas[0]?.ms).toBe(BATIDA_DA_SALA_MS)
    expect(BATIDA_DA_SALA_MS).toBe(4 * 60_000)
  })

  it('a mesma sala aberta de novo não manda outro pedido nem outra batida', async () => {
    const m = mesa()
    void m.sala.abrir('ABC234', [LAN])
    await assentar()
    m.chamadas[0]?.resolver({ chave: novaChaveDaSala(), agora: m.agora() })
    await assentar()

    void m.sala.abrir('ABC234', [LAN])
    await assentar()

    expect(rotas(m.chamadas)).toEqual(['abrirSala'])
    expect(m.batidas).toHaveLength(1)
  })

  it('sem campanha no Lobby nada é publicado e o bilhete não tem regra', async () => {
    const m = mesa({ campanhaId: () => null })
    await m.sala.abrir('ABC234', [LAN])
    expect(m.chamadas).toEqual([])
    expect(m.batidas).toEqual([])
    expect(m.sala.regrasDoBilhete()).toBeNull()
  })

  it('lista de campanhas ilegível (campanhaId rejeita) conta como fora do Lobby, sem lançar', async () => {
    const m = mesa({ campanhaId: () => Promise.reject(new Error('disco ilegível')) })
    await expect(m.sala.abrir('ABC234', [LAN])).resolves.toBeUndefined()
    expect(m.chamadas).toEqual([])
  })

  it('só com 127.0.0.1 e sem túnel não vai pedido nenhum (o jogador não teria para onde ir)', async () => {
    const m = mesa()
    void m.sala.abrir('ABC234', [LOOPBACK])
    await assentar()
    expect(m.chamadas).toEqual([])
  })

  it('a regra do bilhete usa a chave da resposta e o relógio do Lobby pelo meio da ida e volta', async () => {
    // Arrange: o pedido sai em t0, volta 2 s depois, e o Lobby diz que era t0 + 60 s.
    const m = mesa({ inicio: 5_000_000 })
    const chave = novaChaveDaSala()
    void m.sala.abrir('ABC234', [LAN])
    await assentar()
    const enviadoEm = m.agora()
    m.avancar(2_000)
    const recebidoEm = m.agora()
    const agoraDoLobby = enviadoEm + 60_000

    // Act
    m.chamadas[0]?.resolver({ chave, agora: agoraDoLobby, expiraEm: agoraDoLobby + 600_000 })
    await assentar()
    m.avancar(10_000)
    const regras = m.sala.regrasDoBilhete()

    // Assert: diferença = agora - (envio + volta) / 2 = 60 000 - 1 000 = 59 000.
    expect(regras).toEqual({ chave, sala: 'ABC234', agoraMs: m.agora() + (agoraDoLobby - (enviadoEm + recebidoEm) / 2) })
    expect(regras?.agoraMs).toBe(m.agora() + 59_000)
  })

  it('resposta sem chave válida (Worker de outra versão) não vira regra do bilhete', async () => {
    const m = mesa()
    void m.sala.abrir('ABC234', [LAN])
    await assentar()
    m.chamadas[0]?.resolver({ chave: 'curta', agora: m.agora() })
    await assentar()
    expect(m.sala.regrasDoBilhete()).toBeNull()
  })

  it('resposta com agora NaN ou texto não vira regra do bilhete', async () => {
    for (const agora of [Number.NaN, Number.POSITIVE_INFINITY, '123']) {
      const m = mesa()
      void m.sala.abrir('ABC234', [LAN])
      await assentar()
      m.chamadas[0]?.resolver({ chave: novaChaveDaSala(), agora })
      await assentar()
      expect(m.sala.regrasDoBilhete(), String(agora)).toBeNull()
    }
  })

  it('a rede caindo no abrir não lança, e a batida seguinte tenta de novo e publica', async () => {
    // Arrange
    const m = mesa()
    const chave = novaChaveDaSala()
    void m.sala.abrir('ABC234', [LAN])
    await assentar()

    // Act: o primeiro pedido falha (sem internet); 4 min depois, a batida.
    m.chamadas[0]?.rejeitar({ codigo: 'rede', mensagem: 'sem internet' })
    await assentar()
    expect(m.sala.regrasDoBilhete()).toBeNull()
    m.batidas[0]?.fazer()
    await assentar()
    m.chamadas[1]?.resolver({ chave, agora: m.agora() })
    await assentar()

    // Assert
    expect(rotas(m.chamadas)).toEqual(['abrirSala', 'abrirSala'])
    expect(m.sala.regrasDoBilhete()?.chave).toBe(chave)
  })

  it('a batida manda os mesmos endereços e a chave da resposta nova passa a valer', async () => {
    const m = mesa()
    const primeira = novaChaveDaSala()
    void m.sala.abrir('ABC234', [LAN])
    await assentar()
    m.chamadas[0]?.resolver({ chave: primeira, agora: m.agora() })
    await assentar()

    m.avancar(BATIDA_DA_SALA_MS)
    m.batidas[0]?.fazer()
    await assentar()
    expect(corpoDe(m.chamadas[1])).toEqual(corpoDe(m.chamadas[0]))
    // A batida falhou: a chave de antes segue valendo (o Lobby só esquece aos 10 min).
    m.chamadas[1]?.rejeitar(new Error('429'))
    await assentar()
    expect(m.sala.regrasDoBilhete()?.chave).toBe(primeira)
  })

  it('trocarTunel manda os endereços novos na hora, com o túnel primeiro; o mesmo túnel de novo não manda nada', async () => {
    const m = mesa()
    void m.sala.abrir('ABC234', [LAN])
    await assentar()
    m.chamadas[0]?.resolver({ chave: novaChaveDaSala(), agora: m.agora() })
    await assentar()

    void m.sala.trocarTunel(TUNEL)
    await assentar()
    void m.sala.trocarTunel(TUNEL)
    await assentar()

    expect(rotas(m.chamadas)).toEqual(['abrirSala', 'abrirSala'])
    expect(corpoDe(m.chamadas[1])).toEqual({
      codigo: 'ABC234',
      enderecos: [
        { tipo: 'tunel', url: TUNEL },
        { tipo: 'lan', url: LAN },
      ],
    })
  })

  it('trocarTunel no meio de um pedido espera ele voltar antes de mandar o seguinte (um de cada vez)', async () => {
    const m = mesa()
    void m.sala.abrir('ABC234', [LAN])
    await assentar()

    void m.sala.trocarTunel(OUTRO_TUNEL)
    await assentar()
    expect(rotas(m.chamadas)).toEqual(['abrirSala'])

    m.chamadas[0]?.resolver({ chave: novaChaveDaSala(), agora: m.agora() })
    await assentar()
    expect(rotas(m.chamadas)).toEqual(['abrirSala', 'abrirSala'])
    expect(corpoDe(m.chamadas[1])).toMatchObject({ enderecos: [{ tipo: 'tunel', url: OUTRO_TUNEL }, { tipo: 'lan', url: LAN }] })
  })

  it('o túnel que cai numa sala só com 127.0.0.1 tira a sala do Lobby (o botão some)', async () => {
    const m = mesa()
    await m.sala.trocarTunel(TUNEL)
    void m.sala.abrir('ABC234', [LOOPBACK])
    await assentar()
    m.chamadas[0]?.resolver({ chave: novaChaveDaSala(), agora: m.agora() })
    await assentar()

    void m.sala.trocarTunel(null)
    await assentar()

    expect(rotas(m.chamadas)).toEqual(['abrirSala', 'fecharSala'])
    expect(m.sala.regrasDoBilhete()).toBeNull()
  })

  it('o túnel que chega antes da sala abrir vai junto no primeiro pedido', async () => {
    const m = mesa()
    await m.sala.trocarTunel(TUNEL)
    expect(m.chamadas).toEqual([])
    void m.sala.abrir('ABC234', [LAN])
    await assentar()
    expect(corpoDe(m.chamadas[0])).toMatchObject({ enderecos: [{ tipo: 'tunel', url: TUNEL }, { tipo: 'lan', url: LAN }] })
  })

  it('fechar com o abrir no ar: o bilhete deixa de valer na hora, e o fecharSala só sai depois que o abrir volta', async () => {
    // Arrange
    const m = mesa()
    void m.sala.abrir('ABC234', [LAN])
    await assentar()
    m.chamadas[0]?.resolver({ chave: novaChaveDaSala(), agora: m.agora() })
    await assentar()
    m.batidas[0]?.fazer()
    await assentar()
    expect(rotas(m.chamadas)).toEqual(['abrirSala', 'abrirSala'])

    // Act: a batida está no ar quando o mestre fecha a sala.
    const fechou = m.sala.fechar()
    await assentar()

    // Assert
    expect(m.sala.regrasDoBilhete()).toBeNull()
    expect(rotas(m.chamadas)).toEqual(['abrirSala', 'abrirSala'])
    expect(m.batidas[0]?.parada).toBe(true)
    m.chamadas[1]?.resolver({ chave: novaChaveDaSala(), agora: m.agora() })
    await assentar()
    expect(rotas(m.chamadas)).toEqual(['abrirSala', 'abrirSala', 'fecharSala'])
    expect(m.chamadas[2]?.pedido).toEqual({ rota: 'fecharSala', campanhaId: 'camp-1' })
    // A resposta da batida que voltou depois do fechar não ressuscita a sala.
    expect(m.sala.regrasDoBilhete()).toBeNull()
    m.chamadas[2]?.resolver({})
    await expect(fechou).resolves.toBeUndefined()
  })

  it('fechar depois de um abrir que falhou manda o fecharSala mesmo assim (o Lobby pode ter gravado)', async () => {
    const m = mesa()
    void m.sala.abrir('ABC234', [LAN])
    await assentar()
    m.chamadas[0]?.rejeitar(new Error('timeout'))
    await assentar()

    void m.sala.fechar()
    await assentar()

    expect(rotas(m.chamadas)).toEqual(['abrirSala', 'fecharSala'])
  })

  it('fechar com o fecharSala falhando não lança', async () => {
    const m = mesa()
    void m.sala.abrir('ABC234', [LAN])
    await assentar()
    m.chamadas[0]?.resolver({ chave: novaChaveDaSala(), agora: m.agora() })
    await assentar()
    const fechou = m.sala.fechar()
    await assentar()
    m.chamadas[1]?.rejeitar(new Error('sem internet'))
    await expect(fechou).resolves.toBeUndefined()
  })

  it('fechar sem nunca ter publicado não manda nada', async () => {
    const m = mesa({ campanhaId: () => null })
    await m.sala.abrir('ABC234', [LAN])
    await m.sala.fechar()
    expect(m.chamadas).toEqual([])
  })

  it('reconferir com a pasta de outra campanha tira a sala da de antes e entra na nova', async () => {
    let campanha = 'camp-1'
    const m = mesa({ campanhaId: () => campanha })
    void m.sala.abrir('ABC234', [LAN])
    await assentar()
    m.chamadas[0]?.resolver({ chave: novaChaveDaSala(), agora: m.agora() })
    await assentar()

    campanha = 'camp-2'
    void m.sala.reconferir()
    await assentar()
    m.chamadas[1]?.resolver({})
    await assentar()

    expect(m.chamadas.map((chamada) => [chamada.pedido.rota, 'campanhaId' in chamada.pedido ? chamada.pedido.campanhaId : null])).toEqual([
      ['abrirSala', 'camp-1'],
      ['fecharSala', 'camp-1'],
      ['abrirSala', 'camp-2'],
    ])
    expect(m.batidas[0]?.parada).toBe(true)
    expect(m.batidas[1]?.parada).toBe(false)
  })

  it('reconferir com a mesma campanha não manda nada', async () => {
    const m = mesa()
    void m.sala.abrir('ABC234', [LAN])
    await assentar()
    m.chamadas[0]?.resolver({ chave: novaChaveDaSala(), agora: m.agora() })
    await assentar()
    await m.sala.reconferir()
    expect(rotas(m.chamadas)).toEqual(['abrirSala'])
  })

  it('a sala reaberta depois do fechar não herda o túnel de antes (o Rust o derruba junto)', async () => {
    const m = mesa()
    await m.sala.trocarTunel(TUNEL)
    void m.sala.abrir('ABC234', [LAN])
    await assentar()
    m.chamadas[0]?.resolver({ chave: novaChaveDaSala(), agora: m.agora() })
    await assentar()
    void m.sala.fechar()
    await assentar()
    m.chamadas[1]?.resolver({})
    await assentar()

    void m.sala.abrir('XYZ789', [LAN])
    await assentar()

    expect(corpoDe(m.chamadas[2])).toEqual({ codigo: 'XYZ789', enderecos: [{ tipo: 'lan', url: LAN }] })
  })
})
