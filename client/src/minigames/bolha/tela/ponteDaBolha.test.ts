import { describe, expect, it } from 'vitest'
import type { BolhaPlacar } from '../../../net/protocoloDaBolha'
import { criarPonteDaBolha, ERRO_DO_PLACAR_TORTO, type EstadoDaPonteDaBolha, type PartidaDaBolha } from './ponteDaBolha'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A ponte com um iframe de mentira: `doJogo` entrega uma mensagem como se viesse dele. */
function ponteDeTeste() {
  const janela = {} as MessageEventSource // só a identidade importa: a ponte compara `ev.source`, nunca chama nada nela
  const mudancas: { estado: EstadoDaPonteDaBolha; erro?: string }[] = []
  const placares: BolhaPlacar[] = []
  const paraOJogo: Record<string, unknown>[] = []
  const ponte = criarPonteDaBolha({
    janela: () => janela,
    enviar: (texto) => {
      const valor: unknown = JSON.parse(texto)
      if (!isRecord(valor)) throw new Error(`a ponte mandou algo que não é objeto: ${texto}`)
      paraOJogo.push(valor)
    },
    aoTerminar: (placar) => placares.push(placar),
    aoMudar: (estado, erro) => mudancas.push(erro === undefined ? { estado } : { estado, erro }),
  })
  const doJogo = (campos: Record<string, unknown>) => ponte.receber({ source: janela, data: JSON.stringify({ jogo: 'bolha', v: 1, ...campos }) })
  return { ponte, janela, doJogo, mudancas, placares, paraOJogo }
}

const NOME_LONGO = 'Baronesa Ifigênia das Águas Claras do Vale Sereno'

const PARTIDA: PartidaDaBolha = {
  semente: 4242,
  dificuldade: 'normal',
  cenario: 'casa',
  modo: 'equipe',
  jogadores: [
    { id: 'jog-a', nome: 'Tico' },
    { id: 'jog-b', nome: NOME_LONGO },
  ],
  eu: 'jog-a',
}

/** O placar como o jogo manda (snake_case), com o `extremo` que o jogo aceita como `dificil`. */
const PLACAR_DO_JOGO = {
  vitoria: true,
  motivo: 'apagou',
  cenario: 'casa',
  dificuldade: 'extremo',
  semente: 4242,
  modo: 'equipe',
  jogador: { id: 'jog-a', nome: 'Tico' },
  tempo_s: 61.25,
  bolhas: 40,
  acertos: 31,
  precisao: 77,
  focos_apagados: 9,
  focos_que_pegaram: 2,
  fogo_no_fim: 0,
  pontos: 1830,
  estrelas: 3,
}

describe('ponteDaBolha', () => {
  it('só ouve a Bolha d\'Água da janela do iframe, guarda o iniciar até o pronto e corta o nome no teto do jogo', () => {
    const { ponte, janela, doJogo, mudancas, paraOJogo } = ponteDeTeste()
    ponte.iniciar(PARTIDA)
    expect(paraOJogo).toEqual([])

    // Tortas pela origem: outra janela (outro iframe, a própria página) ou nenhuma.
    const pronto = JSON.stringify({ jogo: 'bolha', v: 1, tipo: 'pronto' })
    ponte.receber({ source: {} as MessageEventSource, data: pronto }) // só a identidade conta: outra janela qualquer
    ponte.receber({ source: null, data: pronto })
    // Tortas pelo conteúdo, da janela certa: objeto (não texto), outro jogo, outra versão, JSON quebrado, sem tipo.
    for (const data of [{ jogo: 'bolha', v: 1, tipo: 'pronto' }, JSON.stringify({ jogo: 'fogo', v: 1, tipo: 'pronto' }), JSON.stringify({ jogo: 'bolha', v: 2, tipo: 'pronto' }), '{torto', JSON.stringify({ jogo: 'bolha', v: 1 })]) {
      ponte.receber({ source: janela, data })
    }
    expect(mudancas).toEqual([])
    expect(ponte.estado()).toBe('carregando')

    doJogo({ tipo: 'pronto' })
    expect(ponte.estado()).toBe('esperando')
    expect(paraOJogo).toHaveLength(1)
    const iniciar = paraOJogo[0]
    expect(iniciar).toMatchObject({ jogo: 'bolha', v: 1, tipo: 'iniciar', semente: 4242, dificuldade: 'normal', cenario: 'casa', modo: 'equipe', eu: 'jog-a' })
    expect(iniciar.jogadores).toEqual([
      { id: 'jog-a', nome: 'Tico' },
      { id: 'jog-b', nome: Array.from(NOME_LONGO).slice(0, 40).join('') },
    ])

    // A pausa do mestre entre o iniciar e o iniciado sai logo depois do iniciado.
    ponte.pausar(true)
    doJogo({ tipo: 'iniciado', cenario: 'casa', dificuldade: 'normal' })
    expect(ponte.estado()).toBe('jogando')
    expect(paraOJogo.slice(1).map((m) => m.tipo)).toEqual(['pausa'])
  })

  it('o fim bom vira o placar do app (extremo vira dificil) e o torto vira erro', () => {
    const bom = ponteDeTeste()
    bom.ponte.iniciar(PARTIDA)
    bom.doJogo({ tipo: 'pronto' })
    bom.doJogo({ tipo: 'iniciado' })
    bom.doJogo({ tipo: 'fim', placar: PLACAR_DO_JOGO })
    expect(bom.placares).toEqual([
      { vitoria: true, motivo: 'apagou', cenario: 'casa', dificuldade: 'dificil', tempoS: 61.25, bolhas: 40, acertos: 31, precisao: 77, focosApagados: 9, focosQuePegaram: 2, fogoNoFim: 0, pontos: 1830, estrelas: 3 },
    ])
    expect(bom.ponte.estado()).toBe('fim')
    // Um segundo fim (repetido) não manda outro placar.
    bom.doJogo({ tipo: 'fim', placar: PLACAR_DO_JOGO })
    expect(bom.placares).toHaveLength(1)

    const torto = ponteDeTeste()
    torto.ponte.iniciar(PARTIDA)
    torto.doJogo({ tipo: 'pronto' })
    torto.doJogo({ tipo: 'iniciado' })
    torto.doJogo({ tipo: 'fim', placar: { ...PLACAR_DO_JOGO, estrelas: 4 } })
    expect(torto.placares).toEqual([])
    expect(torto.mudancas.at(-1)).toEqual({ estado: 'erro', erro: ERRO_DO_PLACAR_TORTO })
  })
})
