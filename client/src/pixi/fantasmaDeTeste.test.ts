import { afterEach, describe, expect, it, vi } from 'vitest'
// O teste de clique do Pixi (`EventBoundary.hitTest`) precisa do sistema de eventos montado.
import 'pixi.js/events'
import { Container, EventBoundary, Graphics, RenderTexture, Sprite, Text, Ticker, type FillInstruction, type Texture } from 'pixi.js'
import { TOKEN_GLIDE_MS } from '../player/tokenGlide'
import type { Token } from '../types/map'
import { FANTASMA_CORPO_ALPHA, FANTASMA_DE_TESTE_LABEL, ETIQUETA_FONTE_PX, type FantasmaNaCena } from './drawFantasmaDeTeste'
import { tokenLabelTop } from './drawTokenHealth'
import { tokenCircleRadius } from './drawTokens'
import { createFantasmaDeTesteRenderer, FANTASMA_APAGAR_MS, type FantasmaDeTesteMotion } from './fantasmaDeTeste'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

/**
 * As fotos pedidas — embutidas (`textureFromDataUrl`) e do arquivo do mestre
 * (`Assets.load`) —, para o teste decidir quando (e com o quê) cada uma volta.
 */
const fotos = vi.hoisted(() => ({
  pedidos: [] as { src: string; voltar: (textura: Texture) => void }[],
  arquivos: [] as { url: string; voltar: (textura: Texture) => void }[],
}))

vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>()
  // Só o `load` do cache de arquivos do Pixi: no jsdom não há o que baixar.
  return { ...pixi, Assets: { load: (url: string) => new Promise<Texture>((resolve) => fotos.arquivos.push({ url, voltar: resolve })) } }
})

vi.mock('./tokenPhotoSprite', async (importOriginal) => {
  const real = await importOriginal<typeof import('./tokenPhotoSprite')>()
  return {
    ...real,
    textureFromDataUrl: (src: string) => new Promise<Texture>((resolve) => fotos.pedidos.push({ src, voltar: resolve })),
  }
})

/**
 * Visão de jogador, entrega 3 — o RENDERER do fantasma da ficha de teste: a
 * cópia translúcida que aparece no editor onde a ficha está no teste, anda com
 * ela e some, sem nunca virar coisa que se clica.
 */

const GRADE = 64
const CENA = 'aventura|cripta|0'
const FOTO_A = 'data:image/png;base64,AAAA'
const FOTO_B = 'data:image/png;base64,BBBB'

function ficha(sobra: Partial<Token> = {}): Token {
  return { id: 'aria', characterId: null, name: 'Aria', x: 160, y: 160, size: 1, image: null, color: '#c0392b', ...sobra }
}

function alvo(x = 480, y = 160, sobra: Partial<Token> = {}): FantasmaNaCena {
  return { ficha: ficha(sobra), x, y }
}

function relogio(reduzido = false) {
  const ticker = new Ticker()
  let agora = 1000
  const motion: FantasmaDeTesteMotion = { ticker, reducedMotion: () => reduzido, now: () => agora }
  return {
    ticker,
    motion,
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
  }
}

/** As partes do fantasma, pela ordem em que o renderer as monta. */
function partes(camada: Container) {
  const raiz = camada.children[0] as Container
  const [ligacao, corpo] = raiz.children as [Graphics, Container]
  const [disco, anel, etiqueta] = corpo.children as [Container, Graphics, Container]
  const [cor, foto, mascara] = disco.children as [Graphics, Sprite, Graphics]
  const [placa, texto] = etiqueta.children as [Graphics, Text]
  return { raiz, ligacao, corpo, disco, cor, foto, mascara, anel, etiqueta, placa, texto }
}

function preenchimentos(g: Graphics): FillInstruction[] {
  return g.context.instructions.filter((i): i is FillInstruction => i.action === 'fill')
}

afterEach(() => {
  fotos.pedidos.length = 0
  fotos.arquivos.length = 0
  vi.restoreAllMocks()
})

describe('createFantasmaDeTesteRenderer — o que aparece', () => {
  it('sem alvo, nada: a raiz existe, escondida', () => {
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada)
    renderer.draw(null, GRADE, CENA, 1)
    const { raiz } = partes(camada)
    expect(raiz.label).toBe(FANTASMA_DE_TESTE_LABEL)
    expect(raiz.visible).toBe(false)
  })

  it('com alvo: a cópia no ponto do teste, disco na cor da ficha pela metade, anel e "Teste" no lugar do nome', () => {
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada)
    renderer.draw(alvo(), GRADE, CENA, 1)
    const { raiz, corpo, disco, cor, foto, anel, etiqueta, texto } = partes(camada)
    expect(raiz.visible).toBe(true)
    expect(raiz.alpha).toBe(1)
    expect({ x: corpo.position.x, y: corpo.position.y }).toEqual({ x: 480, y: 160 })
    expect(disco.alpha).toBe(FANTASMA_CORPO_ALPHA)
    const [disc] = preenchimentos(cor)
    expect(disc?.data.style.color).toBe(0xc0392b)
    const raio = tokenCircleRadius(GRADE, 1)
    expect(disc?.data.path.instructions[0]?.data.slice(0, 3)).toEqual([0, 0, raio])
    expect(foto.visible).toBe(false)
    expect(anel.context.instructions.length).toBeGreaterThan(0)
    expect(texto.text).toBe('Teste')
    expect(etiqueta.position.y).toBe(tokenLabelTop(raio, false))
  })

  it('ficha de 2 casas: o fantasma tem o tamanho dela', () => {
    const camada = new Container()
    createFantasmaDeTesteRenderer(camada).draw(alvo(480, 160, { size: 2 }), GRADE, CENA, 1)
    const [disc] = preenchimentos(partes(camada).cor)
    expect(disc?.data.path.instructions[0]?.data[2]).toBe(tokenCircleRadius(GRADE, 2))
  })

  it('não se toca: eventMode none, filhos fora do teste de clique — o mesmo ponto com algo clicável acharia', () => {
    const palco = new Container()
    const camada = new Container()
    palco.addChild(camada)
    createFantasmaDeTesteRenderer(camada).draw(alvo(), GRADE, CENA, 1)
    const { raiz } = partes(camada)
    expect(raiz.eventMode).toBe('none')
    expect(raiz.interactiveChildren).toBe(false)
    expect(raiz.hitArea ?? null).toBeNull()
    const fronteira = new EventBoundary(palco)
    expect(fronteira.hitTest(480, 160)).toBeNull()

    // Controle: um disco clicável no mesmo ponto é achado — o teste de clique funciona aqui.
    const clicavel = new Graphics().circle(480, 160, 20).fill({ color: 0xffffff })
    clicavel.eventMode = 'static'
    palco.addChild(clicavel)
    expect(fronteira.hitTest(480, 160)).toBe(clicavel)
  })

  it('a etiqueta escala como os nomes: 11 px de tela a 50% de zoom, some abaixo de 30%', () => {
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada)
    renderer.draw(alvo(), GRADE, CENA, 0.5)
    const { etiqueta } = partes(camada)
    expect(ETIQUETA_FONTE_PX * 0.5 * etiqueta.scale.x).toBeCloseTo(11)
    expect(etiqueta.visible).toBe(true)
    renderer.setCameraScale(0.2)
    expect(etiqueta.visible).toBe(false)
    renderer.setCameraScale(2)
    expect(etiqueta.visible).toBe(true)
    expect(etiqueta.scale.x).toBe(1)
  })

  it('barato: a ficha de verdade só andou (mesma cara) não refaz o disco nem o anel; trocar a cor refaz', () => {
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada)
    renderer.draw(alvo(), GRADE, CENA, 1)
    const { cor, anel } = partes(camada)
    const limpouDisco = vi.spyOn(cor, 'clear')
    const limpouAnel = vi.spyOn(anel, 'clear')

    renderer.draw({ ficha: ficha({ x: 224 }), x: 480, y: 160 }, GRADE, CENA, 1)
    expect(limpouDisco).not.toHaveBeenCalled()
    expect(limpouAnel).not.toHaveBeenCalled()

    renderer.draw(alvo(480, 160, { color: '#2e86c1' }), GRADE, CENA, 1)
    expect(limpouDisco).toHaveBeenCalled()
    expect(preenchimentos(cor)[0]?.data.style.color).toBe(0x2e86c1)
  })

  it('o anel e a ligação são de px de tela: o zoom que assentou os refaz', () => {
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada)
    renderer.draw(alvo(), GRADE, CENA, 1)
    const { anel, ligacao } = partes(camada)
    const larguraDoFio = () => anel.context.instructions.find((i) => i.action === 'stroke')?.data.style.width ?? 0
    const raioDoPonto = () => Number(preenchimentos(ligacao)[1]?.data.path.instructions[0]?.data[2] ?? 0)
    const fioAntes = larguraDoFio()
    const pontoAntes = raioDoPonto()
    const limpouAnel = vi.spyOn(anel, 'clear')
    renderer.setCameraScale(2)
    expect(limpouAnel).not.toHaveBeenCalled()

    renderer.draw(alvo(), GRADE, CENA, 2)
    expect(limpouAnel).toHaveBeenCalledTimes(1)
    expect(larguraDoFio()).toBeCloseTo(fioAntes / 2)
    expect(raioDoPonto()).toBeCloseTo(pontoAntes / 2)
  })

  it('a ligação: pontos da ficha de verdade até o fantasma; em casas vizinhas, nenhum', () => {
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada)
    renderer.draw(alvo(480, 160), GRADE, CENA, 1)
    const { ligacao } = partes(camada)
    expect(preenchimentos(ligacao)).toHaveLength(2)
    renderer.draw(alvo(224, 160), GRADE, CENA, 1)
    expect(ligacao.context.instructions).toHaveLength(0)
  })

  it('a ficha ficou em outra cena: a cara dela no ponto do teste, com anel e etiqueta, sem ligação', () => {
    const camada = new Container()
    createFantasmaDeTesteRenderer(camada).draw({ ...alvo(480, 160), deOutraCena: true }, GRADE, CENA, 1)
    const { raiz, corpo, cor, anel, texto, ligacao } = partes(camada)
    expect(raiz.visible).toBe(true)
    expect({ x: corpo.position.x, y: corpo.position.y }).toEqual({ x: 480, y: 160 })
    expect(preenchimentos(cor)[0]?.data.style.color).toBe(0xc0392b)
    expect(anel.context.instructions.length).toBeGreaterThan(0)
    expect(texto.text).toBe('Teste')
    expect(ligacao.context.instructions).toHaveLength(0)
  })

  it('de ligado para outra cena, os pontos de antes somem; de volta à cena da ficha, voltam', () => {
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada)
    renderer.draw(alvo(480, 160), GRADE, CENA, 1)
    const { ligacao } = partes(camada)
    expect(preenchimentos(ligacao)).toHaveLength(2)

    renderer.draw({ ...alvo(352, 96), deOutraCena: true }, GRADE, 'aventura|torre|0', 1)
    expect(ligacao.context.instructions).toHaveLength(0)

    renderer.draw(alvo(480, 160), GRADE, CENA, 1)
    expect(preenchimentos(ligacao)).toHaveLength(2)
  })

  it('sem relógio (nada anima): some na hora', () => {
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada)
    renderer.draw(alvo(), GRADE, CENA, 1)
    renderer.draw(null, GRADE, CENA, 1)
    expect(partes(camada).raiz.visible).toBe(false)
  })
})

describe('createFantasmaDeTesteRenderer — movimento', () => {
  it('aparece saindo de dentro da ficha de verdade, acendendo, no tempo do passo do jogador', () => {
    const { motion, quadro, ticker } = relogio()
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada, motion)
    renderer.draw(null, GRADE, CENA, 1)
    renderer.draw(alvo(480, 160), GRADE, CENA, 1)
    const { raiz, corpo } = partes(camada)
    expect(corpo.position.x).toBe(160)
    expect(raiz.alpha).toBe(0)

    quadro(TOKEN_GLIDE_MS / 2)
    expect(corpo.position.x).toBeGreaterThan(160)
    expect(corpo.position.x).toBeLessThan(480)
    expect(raiz.alpha).toBeGreaterThan(0)
    expect(raiz.alpha).toBeLessThan(1)

    quadro(TOKEN_GLIDE_MS / 2)
    expect(corpo.position.x).toBe(480)
    expect(raiz.alpha).toBe(1)
    expect(ticker.count).toBe(0)
  })

  it('cada passo do teste desliza como o passo do jogador; a ligação acompanha', () => {
    const { motion, quadro, ticker } = relogio()
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada, motion)
    renderer.draw(alvo(480, 160), GRADE, CENA, 1)
    const { corpo, ligacao } = partes(camada)
    expect(corpo.position.x).toBe(480)
    const pontosAntes = preenchimentos(ligacao)[1]?.data.path.instructions.length ?? 0

    renderer.draw(alvo(608, 160), GRADE, CENA, 1)
    expect(corpo.position.x).toBe(480)
    quadro(TOKEN_GLIDE_MS / 2)
    expect(corpo.position.x).toBeGreaterThan(480)
    expect(corpo.position.x).toBeLessThan(608)
    quadro(TOKEN_GLIDE_MS / 2)
    expect(corpo.position.x).toBe(608)
    expect(preenchimentos(ligacao)[1]?.data.path.instructions.length ?? 0).toBeGreaterThan(pontosAntes)
    expect(ticker.count).toBe(0)
  })

  it('some apagando onde está, mais rápido que a entrada, e solta o relógio', () => {
    const { motion, quadro, ticker } = relogio()
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada, motion)
    renderer.draw(alvo(), GRADE, CENA, 1)
    const { raiz, corpo } = partes(camada)

    renderer.draw(null, GRADE, CENA, 1)
    expect(FANTASMA_APAGAR_MS).toBeLessThan(TOKEN_GLIDE_MS)
    quadro(FANTASMA_APAGAR_MS / 2)
    expect(raiz.visible).toBe(true)
    expect(raiz.alpha).toBeLessThan(1)
    expect(raiz.alpha).toBeGreaterThan(0)
    expect(corpo.position.x).toBe(480)

    quadro(FANTASMA_APAGAR_MS / 2)
    expect(raiz.visible).toBe(false)
    expect(ticker.count).toBe(0)
  })

  it('voltou antes de sumir: acende de novo de onde estava', () => {
    const { motion, quadro } = relogio()
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada, motion)
    renderer.draw(alvo(), GRADE, CENA, 1)
    renderer.draw(null, GRADE, CENA, 1)
    quadro(FANTASMA_APAGAR_MS / 2)
    const { raiz } = partes(camada)
    const meioApagado = raiz.alpha

    renderer.draw(alvo(), GRADE, CENA, 1)
    expect(raiz.alpha).toBe(meioApagado)
    quadro(FANTASMA_APAGAR_MS)
    expect(raiz.visible).toBe(true)
    expect(raiz.alpha).toBe(1)
  })

  it('trocar de cena não atravessa a tela: some na hora e, na outra cena, já aparece no lugar', () => {
    const { motion } = relogio()
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada, motion)
    renderer.draw(alvo(), GRADE, CENA, 1)
    const { raiz, corpo } = partes(camada)

    renderer.draw(null, GRADE, 'aventura|torre|0', 1)
    expect(raiz.visible).toBe(false)

    renderer.draw(null, GRADE, CENA, 1)
    renderer.draw(alvo(544, 288), GRADE, 'aventura|torre|0', 1)
    expect(raiz.visible).toBe(true)
    expect(raiz.alpha).toBe(1)
    expect({ x: corpo.position.x, y: corpo.position.y }).toEqual({ x: 544, y: 288 })
  })

  it('a ficha chegou a esta cena pelo teste: acende no lugar, curto — não sai de dentro da ficha de lá', () => {
    const { motion, quadro, ticker } = relogio()
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada, motion)
    renderer.draw(null, GRADE, CENA, 1)
    // A ficha de verdade está em (160, 160) da OUTRA cena: aqui não é ponto de partida.
    renderer.draw({ ...alvo(480, 160), deOutraCena: true }, GRADE, CENA, 1)
    const { raiz, corpo } = partes(camada)
    expect(corpo.position.x).toBe(480)
    expect(raiz.alpha).toBe(0)

    quadro(FANTASMA_APAGAR_MS / 2)
    expect(corpo.position.x).toBe(480)
    expect(raiz.alpha).toBeGreaterThan(0)
    expect(raiz.alpha).toBeLessThan(1)
    quadro(FANTASMA_APAGAR_MS / 2)
    expect(raiz.alpha).toBe(1)
    expect(ticker.count).toBe(0)
  })

  it('o mestre abre a cena para onde o teste levou a ficha: o fantasma já está lá, aceso', () => {
    const { motion, ticker } = relogio()
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada, motion)
    renderer.draw(null, GRADE, CENA, 1)
    renderer.draw({ ...alvo(352, 96), deOutraCena: true }, GRADE, 'aventura|torre|0', 1)
    const { raiz, corpo } = partes(camada)
    expect(raiz.visible).toBe(true)
    expect(raiz.alpha).toBe(1)
    expect({ x: corpo.position.x, y: corpo.position.y }).toEqual({ x: 352, y: 96 })
    expect(ticker.count).toBe(0)
  })

  it('abrir o editor com o teste já em curso: aparece no lugar, sem animar', () => {
    const { motion, ticker } = relogio()
    const camada = new Container()
    createFantasmaDeTesteRenderer(camada, motion).draw(alvo(), GRADE, CENA, 1)
    const { raiz, corpo } = partes(camada)
    expect(raiz.alpha).toBe(1)
    expect(corpo.position.x).toBe(480)
    expect(ticker.count).toBe(0)
  })

  it('movimento reduzido: nada desliza; aparecer e sumir ficam só na opacidade, curtos', () => {
    const { motion, quadro, ticker } = relogio(true)
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada, motion)
    renderer.draw(null, GRADE, CENA, 1)
    renderer.draw(alvo(480, 160), GRADE, CENA, 1)
    const { raiz, corpo } = partes(camada)
    expect(corpo.position.x).toBe(480)
    expect(raiz.alpha).toBe(0)
    quadro(FANTASMA_APAGAR_MS)
    expect(raiz.alpha).toBe(1)

    renderer.draw(alvo(608, 160), GRADE, CENA, 1)
    expect(corpo.position.x).toBe(608)

    renderer.draw(null, GRADE, CENA, 1)
    quadro(FANTASMA_APAGAR_MS)
    expect(raiz.visible).toBe(false)
    expect(ticker.count).toBe(0)
  })

  it('desmontar no meio de uma animação sai do relógio', () => {
    const { motion, ticker } = relogio()
    const renderer = createFantasmaDeTesteRenderer(new Container(), motion)
    renderer.draw(null, GRADE, CENA, 1)
    renderer.draw(alvo(), GRADE, CENA, 1)
    expect(ticker.count).toBe(1)
    renderer.desmontar()
    expect(ticker.count).toBe(0)
  })
})

describe('createFantasmaDeTesteRenderer — foto', () => {
  it('foto embutida: textura só do fantasma, recortada no círculo e girada como a ficha; trocar solta a antiga', async () => {
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada)
    renderer.draw(alvo(480, 160, { imageData: FOTO_A, rotation: 90 }), GRADE, CENA, 1)
    const { foto, mascara, cor } = partes(camada)
    expect(foto.visible).toBe(true)
    expect(cor.context.instructions).toHaveLength(0)
    expect(foto.rotation).toBeCloseTo(Math.PI / 2)
    expect(preenchimentos(mascara)[0]?.data.path.instructions[0]?.data[2]).toBe(tokenCircleRadius(GRADE, 1))
    expect(fotos.pedidos.map((p) => p.src)).toEqual([FOTO_A])

    const texturaA = RenderTexture.create({ width: 8, height: 8 })
    const destruiuA = vi.spyOn(texturaA, 'destroy')
    fotos.pedidos[0].voltar(texturaA)
    await vi.waitFor(() => expect(foto.texture).toBe(texturaA))

    renderer.draw(alvo(480, 160, { imageData: FOTO_B }), GRADE, CENA, 1)
    expect(destruiuA).toHaveBeenCalledWith(true)
    const texturaB = RenderTexture.create({ width: 8, height: 8 })
    const destruiuB = vi.spyOn(texturaB, 'destroy')
    fotos.pedidos[1].voltar(texturaB)
    await vi.waitFor(() => expect(foto.texture).toBe(texturaB))

    renderer.desmontar()
    expect(destruiuB).toHaveBeenCalledWith(true)
  })

  it('a foto velha que volta atrasada não pinta por cima da nova, e é solta', async () => {
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada)
    renderer.draw(alvo(480, 160, { imageData: FOTO_A }), GRADE, CENA, 1)
    renderer.draw(alvo(480, 160, { imageData: FOTO_B }), GRADE, CENA, 1)
    const { foto } = partes(camada)
    const texturaB = RenderTexture.create({ width: 8, height: 8 })
    fotos.pedidos[1].voltar(texturaB)
    await vi.waitFor(() => expect(foto.texture).toBe(texturaB))

    const texturaA = RenderTexture.create({ width: 8, height: 8 })
    const destruiuA = vi.spyOn(texturaA, 'destroy')
    fotos.pedidos[0].voltar(texturaA)
    await vi.waitFor(() => expect(destruiuA).toHaveBeenCalledWith(true))
    expect(foto.texture).toBe(texturaB)
  })

  it('só o arquivo do mestre: a MESMA textura da ficha no cache do Pixi, que o fantasma nunca destrói', async () => {
    const camada = new Container()
    const renderer = createFantasmaDeTesteRenderer(camada)
    renderer.draw(alvo(480, 160, { image: 'C:/fotos/aria.png' }), GRADE, CENA, 1)
    const { foto } = partes(camada)
    await vi.waitFor(() => expect(fotos.arquivos.map((a) => a.url)).toEqual(['mocked://C:/fotos/aria.png']))
    expect(fotos.pedidos).toHaveLength(0)

    const textura = RenderTexture.create({ width: 8, height: 8 })
    const destruiu = vi.spyOn(textura, 'destroy')
    fotos.arquivos[0].voltar(textura)
    await vi.waitFor(() => expect(foto.texture).toBe(textura))

    renderer.draw(alvo(480, 160), GRADE, CENA, 1)
    renderer.desmontar()
    expect(destruiu).not.toHaveBeenCalled()
  })

  it('com as duas, a cópia embutida vem primeiro: textura só do fantasma, sem tocar no cache dos arquivos', async () => {
    const camada = new Container()
    createFantasmaDeTesteRenderer(camada).draw(alvo(480, 160, { image: 'C:/fotos/aria.png', imageData: FOTO_A }), GRADE, CENA, 1)
    await vi.waitFor(() => expect(fotos.pedidos.map((p) => p.src)).toEqual([FOTO_A]))
    expect(fotos.arquivos).toHaveLength(0)
  })
})
