import { beforeEach, describe, expect, it } from 'vitest'
import { AQUECER_DE_NOVO_MS, aquecerJogoDoFogo, esquecerAquecimentoDoFogo, type AmbienteDoAquecimento } from './aquecer'

/** Ambiente falso: guarda o que foi pedido e deixa o teste rodar o "ocioso" na hora que quiser. */
function ambienteDeTeste(opcoes: { protocol?: string; hostname?: string; vale?: boolean; status?: number } = {}) {
  const pedidos: { url: string; priority: unknown }[] = []
  const ociosos: (() => void)[] = []
  let agora = 1_000_000
  const amb: AmbienteDoAquecimento = {
    local: { protocol: opcoes.protocol ?? 'http:', hostname: opcoes.hostname ?? '192.168.0.10' },
    buscar: (url, init) => {
      pedidos.push({ url, priority: (init as { priority?: unknown }).priority })
      return Promise.resolve(new Response('corpo', { status: opcoes.status ?? 200 }))
    },
    quandoOcioso: (fazer) => ociosos.push(fazer),
    agora: () => agora,
    valeAquecer: () => opcoes.vale ?? true,
  }
  return {
    amb,
    pedidos,
    passar: (ms: number) => {
      agora += ms
    },
    /** Roda o que esperava a página ociosa e deixa as promessas do download terminarem. */
    async ocioso() {
      for (const fazer of ociosos.splice(0)) fazer()
      // Quatro downloads em fila, cada um lendo o corpo até o fim: várias voltas do laço de eventos.
      for (let volta = 0; volta < 20; volta += 1) await new Promise((ok) => setTimeout(ok, 0))
    },
  }
}

describe('aquecer o jogo do fogo', () => {
  beforeEach(() => esquecerAquecimentoDoFogo())

  it('baixa os 4 arquivos uma vez só, em prioridade baixa, e só quando a página fica ociosa', async () => {
    const { amb, pedidos, ocioso } = ambienteDeTeste()
    aquecerJogoDoFogo(amb)
    aquecerJogoDoFogo(amb)
    expect(pedidos).toEqual([])
    await ocioso()
    expect(pedidos.map((p) => p.url)).toEqual(['/minigames/fogo/index.html', '/minigames/fogo/index.js', '/minigames/fogo/index.pck', '/minigames/fogo/index.wasm'])
    expect(pedidos.every((p) => p.priority === 'low')).toBe(true)
    // Já está no cache do navegador: pino de novo no mapa não baixa de novo.
    aquecerJogoDoFogo(amb)
    await ocioso()
    expect(pedidos).toHaveLength(4)
  })

  it('não aquece na janela do app nem em aparelho que não joga; sem o pacote no mestre, tenta de novo só depois de um minuto', async () => {
    // A Visão de jogador do app: o jogo vem do disco pelo protocolo `minigame`.
    const noApp = ambienteDeTeste({ protocol: 'http:', hostname: 'tauri.localhost' })
    aquecerJogoDoFogo(noApp.amb)
    await noApp.ocioso()
    // Celular (sem mouse) ou economia de dados.
    const semMouse = ambienteDeTeste({ vale: false })
    aquecerJogoDoFogo(semMouse.amb)
    await semMouse.ocioso()
    expect([...noApp.pedidos, ...semMouse.pedidos]).toEqual([])

    // O mestre ainda não baixou o jogo (404): para no primeiro arquivo e não insiste na hora.
    const semPacote = ambienteDeTeste({ status: 404 })
    aquecerJogoDoFogo(semPacote.amb)
    await semPacote.ocioso()
    expect(semPacote.pedidos.map((p) => p.url)).toEqual(['/minigames/fogo/index.html'])
    semPacote.passar(AQUECER_DE_NOVO_MS - 1)
    aquecerJogoDoFogo(semPacote.amb)
    await semPacote.ocioso()
    expect(semPacote.pedidos).toHaveLength(1)
    semPacote.passar(1)
    aquecerJogoDoFogo(semPacote.amb)
    await semPacote.ocioso()
    expect(semPacote.pedidos).toHaveLength(2)
  })
})
