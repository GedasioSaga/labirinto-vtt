import { describe, expect, it } from 'vitest'
import { Container, Text, Ticker } from 'pixi.js'
import { APARICAO, type LugarComNome } from '../lib/nomesDosLugares'
import { MEDIDAS_DA_PILULA, createNomesDosLugaresRenderer, type MovimentoDasPilulas } from './drawNomesDosLugares'

/**
 * NOMES DOS LUGARES NO PALCO: a pílula nasce invisível e aparece em cascata no
 * relógio, que só roda enquanto alguma aparece; o mesmo lugar não reaparece na
 * mesma cena; cena nova (ou chave religada) é mapa abrindo, e a cascata volta.
 * O zoom só troca a escala (tamanho fixo na tela) e refaz a colisão.
 */

function relogio(reduzido = false) {
  const ticker = new Ticker()
  let agora = 1000
  const movimento: MovimentoDasPilulas = { ticker, reducedMotion: () => reduzido, now: () => agora }
  return {
    ticker,
    movimento,
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
  }
}

function lugar(id: string, x: number, y: number, extra: Partial<LugarComNome> = {}): LugarComNome {
  return { id, texto: id, ancora: { x, y }, fundo: 0x2f5e3a, esmaecido: false, ...extra }
}

function raiz(camada: Container, id: string): Container {
  const achada = camada.children.find((c) => c.label === `nomeDoLugar:${id}`)
  if (achada === undefined) throw new Error(`pílula ${id} ausente`)
  return achada
}

function partes(camada: Container, id: string) {
  const r = raiz(camada, id)
  const [haste, , elevador] = r.children
  const corpo = elevador.children[0]
  const texto = corpo.children.find((c): c is Text => c instanceof Text)
  if (texto === undefined) throw new Error('sem texto')
  return { raiz: r, haste, elevador, corpo, texto }
}

const FIM_DA_CASCATA = APARICAO.tetoMs + 50

describe('aparição em cascata', () => {
  it('mapa abrindo: cada pílula nasce invisível e aparece 45 ms depois da anterior; parado, o relógio sai', () => {
    const { movimento, ticker, quadro } = relogio()
    const nomes = createNomesDosLugaresRenderer(movimento)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0), lugar('b', 500, 0)], animar: true })
    expect(raiz(nomes.camada, 'a').alpha).toBe(0)
    expect(raiz(nomes.camada, 'b').alpha).toBe(0)
    expect(ticker.count).toBe(1)
    quadro(40)
    const a = partes(nomes.camada, 'a')
    expect(a.raiz.alpha).toBeGreaterThan(0)
    // A segunda só começa aos 45 ms.
    expect(raiz(nomes.camada, 'b').alpha).toBe(0)
    expect(a.corpo.scale.x).toBeGreaterThan(APARICAO.escalaInicial)
    expect(a.corpo.scale.x).toBeLessThan(1)
    expect(a.corpo.y).toBeGreaterThan(0)
    quadro(APARICAO.duracaoMs + APARICAO.passoMs)
    for (const id of ['a', 'b']) {
      const p = partes(nomes.camada, id)
      expect(p.raiz.alpha).toBe(1)
      expect(p.corpo.scale.x).toBe(1)
      expect(p.corpo.y).toBe(0)
    }
    expect(ticker.count).toBe(0)
  })

  it('o mesmo recorte de novo não refaz nada: mesma pílula, sem relógio', () => {
    const { movimento, ticker, quadro } = relogio()
    const nomes = createNomesDosLugaresRenderer(movimento)
    const lista = [lugar('a', 0, 0)]
    nomes.atualizar({ cena: 'c1', lugares: lista, animar: true })
    quadro(FIM_DA_CASCATA)
    const antes = raiz(nomes.camada, 'a')
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0)], animar: true })
    expect(raiz(nomes.camada, 'a')).toBe(antes)
    expect(antes.alpha).toBe(1)
    expect(ticker.count).toBe(0)
  })

  it('lugar revelado depois: só ele aparece; o que já apareceu e voltou nesta cena volta assentado', () => {
    const { movimento, ticker, quadro } = relogio()
    const nomes = createNomesDosLugaresRenderer(movimento)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0)], animar: true })
    quadro(FIM_DA_CASCATA)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0), lugar('novo', 400, 0)], animar: true })
    expect(raiz(nomes.camada, 'a').alpha).toBe(1)
    expect(raiz(nomes.camada, 'novo').alpha).toBe(0)
    expect(ticker.count).toBe(1)
    quadro(FIM_DA_CASCATA)
    // Saiu da memória e voltou: sem nova aparição.
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0)], animar: true })
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0), lugar('novo', 400, 0)], animar: true })
    expect(raiz(nomes.camada, 'novo').alpha).toBe(1)
    expect(ticker.count).toBe(0)
  })

  it('cena nova é mapa abrindo: a cascata volta; chave desligada e religada também', () => {
    const { movimento, quadro } = relogio()
    const nomes = createNomesDosLugaresRenderer(movimento)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0)], animar: true })
    quadro(FIM_DA_CASCATA)
    nomes.atualizar({ cena: 'c2', lugares: [lugar('a', 0, 0)], animar: true })
    expect(raiz(nomes.camada, 'a').alpha).toBe(0)
    quadro(FIM_DA_CASCATA)
    nomes.atualizar(null)
    expect(nomes.camada.children).toHaveLength(0)
    nomes.atualizar({ cena: 'c2', lugares: [lugar('a', 0, 0)], animar: true })
    expect(raiz(nomes.camada, 'a').alpha).toBe(0)
  })

  it('modo leve (sem "Efeitos do mapa") e sem relógio: aparece já assentada', () => {
    const { movimento, ticker } = relogio()
    const leve = createNomesDosLugaresRenderer(movimento)
    leve.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0)], animar: false })
    expect(raiz(leve.camada, 'a').alpha).toBe(1)
    expect(ticker.count).toBe(0)
    const semRelogio = createNomesDosLugaresRenderer()
    semRelogio.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0)], animar: true })
    expect(raiz(semRelogio.camada, 'a').alpha).toBe(1)
  })

  it('"Reduzir movimento": só a opacidade, sem crescer nem subir', () => {
    const { movimento, quadro } = relogio(true)
    const nomes = createNomesDosLugaresRenderer(movimento)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0)], animar: true })
    quadro(60)
    const a = partes(nomes.camada, 'a')
    expect(a.raiz.alpha).toBeGreaterThan(0)
    expect(a.raiz.alpha).toBeLessThan(1)
    expect(a.corpo.scale.x).toBe(1)
    expect(a.corpo.y).toBe(0)
  })

  it('exportar no meio da cascata: tudo assentado na hora e fora do relógio', () => {
    const { movimento, ticker, quadro } = relogio()
    const nomes = createNomesDosLugaresRenderer(movimento)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0), lugar('b', 300, 0)], animar: true })
    quadro(10)
    nomes.concluirAparicao()
    expect(raiz(nomes.camada, 'a').alpha).toBe(1)
    expect(raiz(nomes.camada, 'b').alpha).toBe(1)
    expect(ticker.count).toBe(0)
  })

  it('destruir sai do relógio no meio da cascata', () => {
    const { movimento, ticker } = relogio()
    const nomes = createNomesDosLugaresRenderer(movimento)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0)], animar: true })
    nomes.destruir()
    expect(ticker.count).toBe(0)
    expect(nomes.camada.destroyed).toBe(true)
  })
})

describe('pílula no palco', () => {
  it('nome em caixa alta; comprido demais vira reticências', () => {
    const nomes = createNomesDosLugaresRenderer()
    const longo = 'Floresta das Mil Árvores Antigas do Norte Distante'
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0, { texto: 'Pântano' }), lugar('b', 900, 0, { texto: longo })], animar: false })
    expect(partes(nomes.camada, 'a').texto.text).toBe('PÂNTANO')
    const cortado = partes(nomes.camada, 'b').texto.text
    expect([...cortado].length).toBeLessThanOrEqual(MEDIDAS_DA_PILULA.maxCaracteres)
    // Reticências coladas na palavra, sem espaço sobrando antes delas.
    expect(cortado).toMatch(/\S…$/)
    expect(longo.toLocaleUpperCase('pt-BR').startsWith(cortado.slice(0, -1))).toBe(true)
  })

  it('tamanho fixo na tela: a pílula leva a escala 1/zoom, e o zoom só troca a escala', () => {
    const nomes = createNomesDosLugaresRenderer()
    nomes.setCameraScale(0.25)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 100, 100)], animar: false })
    const r = raiz(nomes.camada, 'a')
    expect(r.scale.x).toBeCloseTo(4)
    expect(r.position.x).toBe(100)
    nomes.setCameraScale(2)
    expect(raiz(nomes.camada, 'a')).toBe(r)
    expect(r.scale.x).toBeCloseTo(0.5)
  })

  it('colisão: de longe, duas vizinhas se encostam e a de cima sobe com a haste esticada; de perto, nenhuma sobe', () => {
    const nomes = createNomesDosLugaresRenderer()
    nomes.setCameraScale(2)
    // 40 px de mundo entre as âncoras: a 2x são 80 px de tela, sobra espaço.
    nomes.atualizar({ cena: 'c1', lugares: [lugar('cima', 0, 0), lugar('baixo', 0, 40)], animar: false })
    expect(partes(nomes.camada, 'cima').elevador.y).toBe(-MEDIDAS_DA_PILULA.haste)
    expect(partes(nomes.camada, 'baixo').elevador.y).toBe(-MEDIDAS_DA_PILULA.haste)
    nomes.setCameraScale(0.1)
    const cima = partes(nomes.camada, 'cima')
    const baixo = partes(nomes.camada, 'baixo')
    expect(baixo.elevador.y).toBe(-MEDIDAS_DA_PILULA.haste)
    expect(cima.elevador.y).toBeLessThan(-MEDIDAS_DA_PILULA.haste)
    expect(cima.haste.scale.y).toBe(-cima.elevador.y)
  })

  it('pílula deslizada de lado: a haste fica no ponto e a pílula cresce a partir dela (a origem não anda)', () => {
    const nomes = createNomesDosLugaresRenderer()
    // Encostam só nas pontas: a de cima desliza em vez de subir.
    nomes.atualizar({ cena: 'c1', lugares: [lugar('cima', 60, 0, { texto: 'Cidade das Pedras' }), lugar('baixo', 0, 4, { texto: 'Porto' })], animar: false })
    const cima = partes(nomes.camada, 'cima')
    expect(cima.elevador.x).toBe(0)
    expect(cima.elevador.y).toBe(-MEDIDAS_DA_PILULA.haste)
    expect(cima.corpo.pivot.x).not.toBe(0)
    expect(cima.corpo.x).toBe(0)
  })

  it('nome escondido dos jogadores (só o mestre recebe): meia-tinta', () => {
    const nomes = createNomesDosLugaresRenderer()
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0, { esmaecido: true })], animar: false })
    expect(raiz(nomes.camada, 'a').alpha).toBeCloseTo(0.55)
  })

  it('o mestre esconde (e volta a mostrar) o nome de uma pílula já assentada: a meia-tinta acompanha na hora', () => {
    const nomes = createNomesDosLugaresRenderer()
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0)], animar: false })
    const a = raiz(nomes.camada, 'a')
    expect(a.alpha).toBe(1)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0, { esmaecido: true })], animar: false })
    expect(raiz(nomes.camada, 'a')).toBe(a)
    expect(a.alpha).toBeCloseTo(0.55)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0)], animar: false })
    expect(a.alpha).toBe(1)
  })

  it('nome escondido no meio da aparição: o quadro seguinte já sai em meia-tinta e assenta em 0,55', () => {
    const { movimento, quadro } = relogio()
    const nomes = createNomesDosLugaresRenderer(movimento)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0)], animar: true })
    quadro(40)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0, { esmaecido: true })], animar: true })
    quadro(FIM_DA_CASCATA)
    expect(raiz(nomes.camada, 'a').alpha).toBeCloseTo(0.55)
  })

  it('a vizinha de baixo sai (região apagada, nome vazio, camada escondida): a de cima volta para a haste curta', () => {
    const nomes = createNomesDosLugaresRenderer()
    nomes.atualizar({ cena: 'c1', lugares: [lugar('cima', 100, 100, { texto: 'Nome comprido do lugar' }), lugar('baixo', 100, 110, { texto: 'Nome comprido do lugar' })], animar: false })
    expect(partes(nomes.camada, 'cima').elevador.y).toBeLessThan(-MEDIDAS_DA_PILULA.haste)
    nomes.atualizar({ cena: 'c1', lugares: [lugar('cima', 100, 100, { texto: 'Nome comprido do lugar' })], animar: false })
    expect(partes(nomes.camada, 'cima').elevador.y).toBe(-MEDIDAS_DA_PILULA.haste)
    expect(partes(nomes.camada, 'cima').haste.scale.y).toBe(MEDIDAS_DA_PILULA.haste)
  })

  it('continente afastado: a do topo da pilha passou do teto e sumiu; tirar as de baixo a traz de volta sem esperar o zoom', () => {
    const nomes = createNomesDosLugaresRenderer()
    nomes.setCameraScale(0.25)
    const pilha = Array.from({ length: 8 }, (_, i) => lugar(`p${i}`, 400, 400 + i * 4, { texto: 'Nome comprido do lugar' }))
    nomes.atualizar({ cena: 'c1', lugares: pilha, animar: false })
    expect(raiz(nomes.camada, 'p0').visible).toBe(false)
    nomes.atualizar({ cena: 'c1', lugares: [pilha[0]], animar: false })
    expect(raiz(nomes.camada, 'p0').visible).toBe(true)
    expect(partes(nomes.camada, 'p0').elevador.y).toBe(-MEDIDAS_DA_PILULA.haste)
  })

  it('campo de nome aberto: a pílula daquela sala sai e volta ao fechar', () => {
    const nomes = createNomesDosLugaresRenderer()
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0), lugar('b', 400, 0)], animar: false })
    nomes.setLugarEmEdicao('a')
    expect(raiz(nomes.camada, 'a').visible).toBe(false)
    expect(raiz(nomes.camada, 'b').visible).toBe(true)
    nomes.setLugarEmEdicao(null)
    expect(raiz(nomes.camada, 'a').visible).toBe(true)
  })

  it('renomear redesenha a mesma pílula; lugar que sai do recorte é destruído', () => {
    const nomes = createNomesDosLugaresRenderer()
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0), lugar('b', 400, 0)], animar: false })
    const a = raiz(nomes.camada, 'a')
    const b = raiz(nomes.camada, 'b')
    nomes.atualizar({ cena: 'c1', lugares: [lugar('a', 0, 0, { texto: 'Vila Nova' })], animar: false })
    expect(raiz(nomes.camada, 'a')).toBe(a)
    expect(partes(nomes.camada, 'a').texto.text).toBe('VILA NOVA')
    expect(b.destroyed).toBe(true)
    expect(nomes.camada.children).toHaveLength(1)
  })
})
