import { describe, expect, it } from 'vitest'
import { Container, Sprite, Texture, Ticker } from 'pixi.js'
import { CURVAS } from '../cenario/revelacao/tempo'
import {
  ALFA_DA_SOMBRA_DO_TELHADO,
  CRESCIMENTO_DO_TELHADO,
  DURACAO_DO_TELHADO_MS,
  MAXIMO_DE_PIXELS_DA_TEXTURA,
  SUBIDA_DO_TELHADO_PX,
  createTelhadosRenderer,
  escalaDaTexturaDoTelhado,
  type MovimentoDosTelhados,
  type TelhadoParaDesenhar,
  type TexturaDoTelhado,
} from './telhadosRenderer'

/**
 * TELHADOS DESENHADOS: o fade de 300 ms (alpha 1→0 subindo e crescendo), o
 * relógio que desliga no fim, movimento reduzido sem subir, o caminho que vira
 * no meio sem pular, a foto da sala por baixo, e o cache de texturas (a mesma
 * chave não repinta). Sem GPU: a textura é um `Texture` vazio injetado, e a
 * pintura roda quando o teste manda (`agendar`).
 */

const CASA = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 400, y: 300 },
  { x: 100, y: 300 },
]

function montar(opcoes: { reduzido?: boolean; semMovimento?: boolean; escalaDaTela?: number } = {}) {
  const ticker = new Ticker()
  let agora = 1000
  const tarefas: (() => void)[] = []
  let geradas = 0
  const movimento: MovimentoDosTelhados = {
    ticker,
    reducedMotion: () => opcoes.reduzido === true,
    now: () => agora,
    escalaDaTela: () => opcoes.escalaDaTela ?? 1,
  }
  const renderer = createTelhadosRenderer({
    movimento: opcoes.semMovimento ? undefined : movimento,
    agendar: (tarefa) => tarefas.push(tarefa),
    gerarTextura: (): TexturaDoTelhado => {
      geradas += 1
      return { texture: new Texture(), origemX: 91, origemY: 91, escala: 1 }
    },
  })
  const camada = new Container()
  return {
    ticker,
    renderer,
    camada,
    geradas: () => geradas,
    pintarTudo() {
      while (tarefas.length > 0) tarefas.shift()?.()
    },
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
    casa(extra: Partial<TelhadoParaDesenhar> = {}): TelhadoParaDesenhar {
      return { id: 'casa', points: CASA, modelo: 'telhas', cor: '#8a5a46', camada, ...extra }
    },
  }
}

/** O container que sobe, cresce e desbota (o corpo do telhado). */
function topo(camada: Container): Container {
  const raiz = camada.children[0]
  const ultimo = raiz?.children[raiz.children.length - 1]
  if (!(ultimo instanceof Container)) throw new Error('sem telhado na camada')
  return ultimo
}

function sombra(camada: Container): Container {
  const raiz = camada.children[0]
  const filhos = raiz?.children ?? []
  const s = filhos[filhos.length - 2]
  if (!(s instanceof Container)) throw new Error('sem sombra')
  return s
}

describe('telhadosRenderer — desenho', () => {
  it('mapa abrindo: o telhado sai inteiro, sem relógio; chapado até a textura ficar pronta', () => {
    const m = montar()
    m.renderer.desenhar([m.casa()], 'mapa')
    expect(topo(m.camada).alpha).toBe(1)
    expect(m.ticker.count).toBe(0)
    expect(topo(m.camada).children[0]).not.toBeInstanceOf(Sprite)
    m.pintarTudo()
    expect(topo(m.camada).children[0]).toBeInstanceOf(Sprite)
    expect(sombra(m.camada).alpha).toBeCloseTo(ALFA_DA_SOMBRA_DO_TELHADO)
    expect(m.camada.children[0].eventMode).toBe('none')
  })

  it('cache: a mesma (pontos, modelo, cor) não repinta; outra cor pinta uma vez e voltar não repinta', () => {
    const m = montar({ semMovimento: true })
    m.renderer.desenhar([m.casa()], 'mapa')
    m.pintarTudo()
    m.renderer.desenhar([m.casa()], 'mapa')
    m.renderer.desenhar([m.casa({ id: 'outra-casa' }), m.casa()], 'mapa')
    m.pintarTudo()
    expect(m.geradas()).toBe(1)
    m.renderer.desenhar([m.casa({ cor: '#4d5f4f', modelo: 'madeira' })], 'mapa')
    m.pintarTudo()
    m.renderer.desenhar([m.casa()], 'mapa')
    m.pintarTudo()
    expect(m.geradas()).toBe(2)
  })

  it('cor trocada duas vezes antes da vez dela: só a última é pintada', () => {
    const m = montar({ semMovimento: true })
    m.renderer.desenhar([m.casa({ cor: '#111111' })], 'mapa')
    m.renderer.desenhar([m.casa({ cor: '#222222' })], 'mapa')
    m.renderer.desenhar([m.casa({ cor: '#333333' })], 'mapa')
    m.pintarTudo()
    expect(m.geradas()).toBe(1)
  })

  it('sala enorme: a textura não passa do teto de pixels', () => {
    const enorme = [
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 3000, y: 2000 },
      { x: 0, y: 2000 },
    ]
    const k = escalaDaTexturaDoTelhado(enorme)
    expect(k).toBeLessThan(1)
    expect(Math.ceil(3018 * k) * Math.ceil(2018 * k)).toBeLessThanOrEqual(MAXIMO_DE_PIXELS_DA_TEXTURA * 1.01)
    expect(escalaDaTexturaDoTelhado(CASA)).toBe(1)
  })
})

describe('telhadosRenderer — fade', () => {
  it('teto que sai do pacote desbota 1→0 em 300 ms, subindo e crescendo; o relógio desliga no fim', () => {
    const m = montar()
    m.renderer.desenhar([m.casa()], 'mapa')
    m.renderer.desenhar([], 'mapa')
    expect(m.ticker.count).toBe(1)
    m.quadro(DURACAO_DO_TELHADO_MS / 2)
    const meio = CURVAS.saida.f(0.5)
    expect(topo(m.camada).alpha).toBeCloseTo(1 - meio, 5)
    expect(topo(m.camada).scale.x).toBeCloseTo(1 + CRESCIMENTO_DO_TELHADO * meio, 5)
    expect(topo(m.camada).position.y).toBeCloseTo(200 - SUBIDA_DO_TELHADO_PX * meio, 5)
    m.quadro(DURACAO_DO_TELHADO_MS / 2)
    expect(m.camada.children.length).toBe(0)
    expect(m.ticker.count).toBe(0)
  })

  it('a subida é de tela: com a câmera a 2x ela anda metade em px do mapa', () => {
    const m = montar({ escalaDaTela: 2 })
    m.renderer.desenhar([m.casa()], 'mapa')
    m.renderer.desenhar([], 'mapa')
    m.quadro(DURACAO_DO_TELHADO_MS / 2)
    expect(topo(m.camada).position.y).toBeCloseTo(200 - (SUBIDA_DO_TELHADO_PX / 2) * CURVAS.saida.f(0.5), 5)
  })

  it('teto que volta aparece 0→1 com a foto da sala por baixo, e a foto some no fim', () => {
    const m = montar()
    m.renderer.desenhar([m.casa()], 'mapa')
    m.renderer.desenhar([], 'mapa')
    m.quadro(DURACAO_DO_TELHADO_MS)
    expect(m.renderer.vaoAparecer(['casa', 'nunca-vista'], 'mapa')).toEqual(['casa'])
    const foto = new Container()
    m.renderer.guardarFoto('casa', foto)
    m.renderer.desenhar([m.casa()], 'mapa')
    expect(topo(m.camada).alpha).toBe(0)
    expect(m.camada.children[0].children[0]).toBe(foto)
    m.quadro(DURACAO_DO_TELHADO_MS / 2)
    expect(topo(m.camada).alpha).toBeCloseTo(CURVAS.saida.f(0.5), 5)
    m.quadro(DURACAO_DO_TELHADO_MS / 2)
    expect(topo(m.camada).alpha).toBe(1)
    expect(foto.destroyed).toBe(true)
    expect(m.ticker.count).toBe(0)
  })

  it('movimento reduzido: só desbota, sem subir nem crescer', () => {
    const m = montar({ reduzido: true })
    m.renderer.desenhar([m.casa()], 'mapa')
    m.renderer.desenhar([], 'mapa')
    m.quadro(DURACAO_DO_TELHADO_MS / 2)
    expect(topo(m.camada).alpha).toBeCloseTo(1 - CURVAS.saida.f(0.5), 5)
    expect(topo(m.camada).scale.x).toBe(1)
    expect(topo(m.camada).position.y).toBe(200)
  })

  it('entrar e sair na hora: o caminho vira no meio, sem pular', () => {
    const m = montar()
    m.renderer.desenhar([m.casa()], 'mapa')
    m.renderer.desenhar([], 'mapa')
    m.quadro(DURACAO_DO_TELHADO_MS / 3)
    const naVirada = topo(m.camada).alpha
    expect(m.renderer.vaoAparecer(['casa'], 'mapa')).toEqual(['casa'])
    m.renderer.desenhar([m.casa()], 'mapa')
    expect(topo(m.camada).alpha).toBeCloseTo(naVirada, 5)
    m.quadro(1)
    expect(Math.abs(topo(m.camada).alpha - naVirada)).toBeLessThan(0.05)
    m.quadro(DURACAO_DO_TELHADO_MS)
    expect(topo(m.camada).alpha).toBe(1)
    expect(m.ticker.count).toBe(0)
  })

  it('outro mapa: limpa na hora, sem animar nem foto', () => {
    const m = montar()
    m.renderer.desenhar([m.casa()], 'mapa')
    expect(m.renderer.vaoAparecer(['casa'], 'outro')).toEqual([])
    m.renderer.desenhar([], 'outro')
    expect(m.camada.children.length).toBe(0)
    expect(m.ticker.count).toBe(0)
  })

  it('sem movimento (editor): some e aparece na hora', () => {
    const m = montar({ semMovimento: true })
    m.renderer.desenhar([m.casa()], 'mapa')
    m.renderer.desenhar([], 'mapa')
    expect(m.camada.children.length).toBe(0)
    expect(m.renderer.vaoAparecer(['casa'], 'mapa')).toEqual([])
    m.renderer.desenhar([m.casa()], 'mapa')
    expect(topo(m.camada).alpha).toBe(1)
  })

  it('idsVisiveis: o telhado que sai continua visível durante o fade e solta quando o progresso chega a 0', () => {
    const m = montar()
    m.renderer.desenhar([m.casa()], 'mapa')
    expect([...m.renderer.idsVisiveis()]).toEqual(['casa'])
    m.renderer.desenhar([], 'mapa')
    expect([...m.renderer.idsVisiveis()]).toEqual(['casa'])
    m.quadro(DURACAO_DO_TELHADO_MS - 1)
    expect([...m.renderer.idsVisiveis()]).toEqual(['casa'])
    m.quadro(1)
    expect([...m.renderer.idsVisiveis()]).toEqual([])
  })

  it('idsVisiveis: o teto que volta só conta depois de começar a aparecer; sem movimento, some na hora', () => {
    const m = montar()
    m.renderer.desenhar([m.casa()], 'mapa')
    m.renderer.desenhar([], 'mapa')
    m.quadro(DURACAO_DO_TELHADO_MS)
    m.renderer.desenhar([m.casa()], 'mapa')
    expect([...m.renderer.idsVisiveis()]).toEqual([])
    m.quadro(DURACAO_DO_TELHADO_MS / 2)
    expect([...m.renderer.idsVisiveis()]).toEqual(['casa'])

    const editor = montar({ semMovimento: true })
    editor.renderer.desenhar([editor.casa()], 'mapa')
    editor.renderer.desenhar([], 'mapa')
    expect([...editor.renderer.idsVisiveis()]).toEqual([])
  })

  it('trocar de camada (espiar pela porta) muda o telhado de lugar sem animar', () => {
    const m = montar()
    const espiada = new Container()
    m.renderer.desenhar([m.casa()], 'mapa')
    m.renderer.desenhar([m.casa({ camada: espiada })], 'mapa')
    expect(m.camada.children.length).toBe(0)
    expect(topo(espiada).alpha).toBe(1)
    expect(m.ticker.count).toBe(0)
  })
})
