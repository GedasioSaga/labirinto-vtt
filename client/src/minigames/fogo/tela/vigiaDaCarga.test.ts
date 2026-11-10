import { describe, expect, it } from 'vitest'
import { CARGA_DO_MOTOR_MAX_MS, CARGA_PARADA_MAX_MS, CARGA_SEM_SINAL_MAX_MS, criarVigiaDaCarga, type MotivoDaCargaParada } from './vigiaDaCarga'

/** Relógio falso: `passar(ms)` roda o que venceu no caminho. */
function relogioFalso() {
  let agora = 0
  let seq = 0
  const marcados = new Map<number, { quando: number; fazer: () => void }>()
  return {
    agendar(fazer: () => void, ms: number) {
      const id = (seq += 1)
      marcados.set(id, { quando: agora + ms, fazer })
      return () => {
        marcados.delete(id)
      }
    },
    passar(ms: number) {
      agora += ms
      for (const [id, marcado] of [...marcados]) {
        if (marcado.quando > agora) continue
        marcados.delete(id)
        marcado.fazer()
      }
    },
  }
}

/** `segurarFila`: o que a vigia manda para depois da fila de mensagens espera o teste soltar (`fila`). */
function vigiaDeTeste(segurarFila = false) {
  const relogio = relogioFalso()
  const paradas: MotivoDaCargaParada[] = []
  const fila: (() => void)[] = []
  const vigia = criarVigiaDaCarga({
    agendar: relogio.agendar,
    depoisDaFila: (fazer) => (segurarFila ? void fila.push(fazer) : fazer()),
    aoParar: (motivo) => paradas.push(motivo),
  })
  return { relogio, paradas, vigia, fila }
}

const TOTAL = 39_800_000

describe('vigiaDaCarga: o prazo conta o tempo parado, não o total', () => {
  it('espera um download lento que anda (5 minutos) e desiste 40 s depois do último byte', () => {
    const { relogio, paradas, vigia } = vigiaDeTeste()
    // Rede bem lenta: um pouco a cada 10 s, por 5 minutos. O prazo antigo (90 s no total) estourava aqui.
    for (let passo = 0; passo <= 30; passo += 1) {
      vigia.progresso({ atual: passo * 1_000_000, total: TOTAL })
      relogio.passar(10_000)
    }
    expect(paradas).toEqual([])
    // Os bytes pararam: o mesmo número de novo não é sinal de vida.
    relogio.passar(CARGA_PARADA_MAX_MS - 10_000 - 1)
    vigia.progresso({ atual: 30_000_000, total: TOTAL })
    expect(paradas).toEqual([])
    relogio.passar(1)
    expect(paradas).toEqual(['parado'])
    // Uma vez só, mesmo que o jogo volte a avisar depois.
    vigia.progresso({ atual: 31_000_000, total: TOTAL })
    relogio.passar(CARGA_PARADA_MAX_MS)
    expect(paradas).toEqual(['parado'])
  })

  it('sem aviso nenhum vale o prazo inteiro; baixado tudo, espera o motor ligar; encerrada, não acusa nada', () => {
    // Pacote antigo (não avisa o progresso): o prazo de antes.
    const antigo = vigiaDeTeste()
    antigo.relogio.passar(CARGA_SEM_SINAL_MAX_MS - 1)
    expect(antigo.paradas).toEqual([])
    antigo.relogio.passar(1)
    expect(antigo.paradas).toEqual(['sem_sinal'])

    // Baixou tudo: o prazo passa a ser o do motor, mais longo que o de "parado".
    const baixado = vigiaDeTeste()
    baixado.vigia.progresso({ atual: TOTAL, total: TOTAL })
    baixado.relogio.passar(CARGA_PARADA_MAX_MS + 1)
    expect(baixado.paradas).toEqual([])
    baixado.relogio.passar(CARGA_DO_MOTOR_MAX_MS)
    expect(baixado.paradas).toEqual(['motor'])

    // O jogo disse `pronto` (a tela encerra a vigia): nenhum prazo dispara depois.
    const pronto = vigiaDeTeste()
    pronto.vigia.progresso({ atual: 1, total: TOTAL })
    pronto.vigia.encerrar()
    pronto.relogio.passar(CARGA_SEM_SINAL_MAX_MS * 2)
    expect(pronto.paradas).toEqual([])
  })

  it('página travada pelo motor ligando: o prazo vencido não passa na frente do que o jogo já tinha mandado', () => {
    // O motor segura a página por mais que o prazo de "parado"; quando ela volta, o temporizador
    // vencido roda, mas o `pronto` do jogo estava na fila antes dele: a tela encerra a vigia.
    const carregou = vigiaDeTeste(true)
    carregou.vigia.progresso({ atual: 36_000_000, total: TOTAL })
    carregou.relogio.passar(CARGA_PARADA_MAX_MS + 8_000)
    expect(carregou.fila).toHaveLength(1)
    carregou.vigia.encerrar()
    for (const fazer of carregou.fila.splice(0)) fazer()
    expect(carregou.paradas).toEqual([])

    // Na fila estava o aviso de que o download acabou: a espera vira a do motor, sem acusar parada.
    const baixou = vigiaDeTeste(true)
    baixou.vigia.progresso({ atual: 36_000_000, total: TOTAL })
    baixou.relogio.passar(CARGA_PARADA_MAX_MS)
    baixou.vigia.progresso({ atual: TOTAL, total: TOTAL })
    for (const fazer of baixou.fila.splice(0)) fazer()
    expect(baixou.paradas).toEqual([])
    baixou.relogio.passar(CARGA_DO_MOTOR_MAX_MS)
    for (const fazer of baixou.fila.splice(0)) fazer()
    expect(baixou.paradas).toEqual(['motor'])
  })
})
