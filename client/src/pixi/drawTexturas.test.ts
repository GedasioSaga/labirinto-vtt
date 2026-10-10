/**
 * TEXTURAS no palco (`drawTexturas.ts`), com a pintura das máscaras e o
 * ladrilho falsos (o jsdom não tem canvas). Prova: pinta na hora ao abrir a
 * cena e espera a mão parar na edição; não repinta o mesmo (nem quando o mapa
 * do jogador chega com referências novas e o mesmo conteúdo); a cena nova
 * solta a anterior NA HORA; desligar solta tudo; o ladrilho fica alinhado à
 * origem do mundo; a máscara de cada pintura é destruída quando sai.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Sprite, Texture, TilingSprite } from 'pixi.js'
import type { Drawing, PinceladaDeTextura, Region } from '../types/map'
import { esquecerTexturasDeFora, registrarTexturaDoPacote } from '../texturas/catalogo'
import { createTexturasRenderer, ESPERA_DAS_TEXTURAS_MS, ladoDoLadrilhoNoMundo, vistaDaCamera, type EntradaDasTexturas } from './drawTexturas'

const MAPA = { width: 200, height: 200, grid: 64 }
const pincel = (id: string, textura: string, x: number): PinceladaDeTextura => ({ id, tipo: 'pincel', textura, forca: 1, raio: 100, pontos: [{ x, y: 500 }] })
const ilha: Region = { id: 'ilha', tag: 'region', fillColor: '#a8776a', fillPattern: 'solid', data: {}, points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] }
const balde: PinceladaDeTextura = { id: 'b', tipo: 'balde', textura: 'areia', forca: 1, alvo: { tipo: 'regiao', id: 'ilha' } }

function entrada(cena: string, passos: PinceladaDeTextura[], regioes: Region[] = [], desenhos: Drawing[] = []): EntradaDasTexturas {
  return { cena, mapa: MAPA, passos, importadas: undefined, regioes, desenhos }
}

function falsos() {
  const mascaras: Texture[] = []
  const rasterizar = vi.fn(async (plano: { camadas: unknown[] }) => plano.camadas.map(() => document.createElement('canvas')))
  const ladrilho = vi.fn(async () => new Texture())
  const mascara = vi.fn(() => {
    const t = new Texture()
    mascaras.push(t)
    return t
  })
  return { rasterizar, ladrilho, mascara, mascaras }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  esquecerTexturasDeFora()
})

/** Os falsos, guardando cada ladrilho que sai (para conferir quem foi destruído). */
function falsosComLadrilhos() {
  const f = falsos()
  const ladrilhos: Texture[] = []
  f.ladrilho.mockImplementation(async () => {
    const t = new Texture()
    ladrilhos.push(t)
    return t
  })
  return { ...f, ladrilhos }
}

const MUSGO = { id: 'musgo-teste', nome: 'Musgo', escala: 40, cor: () => 0x557744 }

/** As texturas que os TilingSprite do palco estão usando agora. */
function emUso(camada: { children: readonly unknown[] }): Texture[] {
  return camada.children.filter((c): c is TilingSprite => c instanceof TilingSprite).map((c) => c.texture)
}

describe('texturas no palco', () => {
  it('abre a cena pintando na hora: uma textura repetida com a máscara dela por camada', async () => {
    const f = falsos()
    const r = createTexturasRenderer(f)
    r.atualizar(entrada('a', [pincel('1', 'floresta', 300), pincel('2', 'areia', 5000)]))
    await vi.advanceTimersByTimeAsync(0)
    expect(f.rasterizar).toHaveBeenCalledTimes(1)
    const repetidas = r.camada.children.filter((c) => c instanceof TilingSprite)
    expect(repetidas).toHaveLength(2)
    // O ladrilho parte da origem do mundo: pintar mais (caixa maior) não desliza o desenho.
    const primeira = repetidas[0] as TilingSprite
    expect(primeira.tilePosition.x).toBe(-primeira.position.x)
    expect(primeira.mask).toBeInstanceOf(Sprite)
    r.destruir()
  })

  it('na edição espera a mão parar; o mesmo conteúdo não repinta', async () => {
    const f = falsos()
    const r = createTexturasRenderer(f)
    r.atualizar(entrada('a', [pincel('1', 'floresta', 300)]))
    await vi.advanceTimersByTimeAsync(0)
    r.atualizar(entrada('a', [pincel('1', 'floresta', 300), pincel('2', 'areia', 900)]))
    await vi.advanceTimersByTimeAsync(ESPERA_DAS_TEXTURAS_MS / 5)
    expect(f.rasterizar).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(ESPERA_DAS_TEXTURAS_MS)
    expect(f.rasterizar).toHaveBeenCalledTimes(2)
    // Passos novos com o mesmo conteúdo (o mapa do jogador chega novo a cada mensagem): nada.
    r.atualizar(entrada('a', [pincel('1', 'floresta', 300), pincel('2', 'areia', 900)]))
    await vi.advanceTimersByTimeAsync(ESPERA_DAS_TEXTURAS_MS * 2)
    expect(f.rasterizar).toHaveBeenCalledTimes(2)
    r.destruir()
  })

  it('com balde, regiões novas de mesmo conteúdo não repintam; forma mudada repinta', async () => {
    const f = falsos()
    const r = createTexturasRenderer(f)
    r.atualizar(entrada('a', [balde], [ilha]))
    await vi.advanceTimersByTimeAsync(0)
    r.atualizar(entrada('a', [balde], [{ ...ilha, points: ilha.points.map((p) => ({ ...p })) }]))
    await vi.advanceTimersByTimeAsync(ESPERA_DAS_TEXTURAS_MS * 2)
    expect(f.rasterizar).toHaveBeenCalledTimes(1)
    r.atualizar(entrada('a', [balde], [{ ...ilha, points: ilha.points.map((p) => ({ x: p.x + 10, y: p.y })) }]))
    await vi.advanceTimersByTimeAsync(ESPERA_DAS_TEXTURAS_MS * 2)
    expect(f.rasterizar).toHaveBeenCalledTimes(2)
    r.destruir()
  })

  it('cena nova solta a pintura da anterior NA HORA, e destrói as máscaras dela', async () => {
    const f = falsos()
    const r = createTexturasRenderer(f)
    r.atualizar(entrada('a', [pincel('1', 'floresta', 300)]))
    await vi.advanceTimersByTimeAsync(0)
    const destruir = vi.spyOn(f.mascaras[0], 'destroy')
    // A geração da cena nova fica pendurada: a velha já não pode estar no palco.
    f.rasterizar.mockImplementationOnce(() => new Promise(() => {}))
    r.atualizar(entrada('b', [pincel('9', 'areia', 300)]))
    expect(r.camada.children).toHaveLength(0)
    expect(destruir).toHaveBeenCalled()
    r.destruir()
  })

  it('desligado (modo leve, ou sem textura) solta tudo e avisa que a camada sumiu', async () => {
    const f = falsos()
    const visivel: boolean[] = []
    const r = createTexturasRenderer({ ...f, aoMudarVisibilidade: (v) => visivel.push(v) })
    r.atualizar(entrada('a', [pincel('1', 'floresta', 300)]))
    await vi.advanceTimersByTimeAsync(0)
    r.atualizar(null)
    expect(r.camada.children).toHaveLength(0)
    expect(visivel).toEqual([true, false])
    r.destruir()
  })

  it('pintura que falha não trava a próxima: a mesma entrada tenta de novo', async () => {
    const f = falsos()
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    f.rasterizar.mockImplementationOnce(async () => {
      throw new Error('canvas sumiu')
    })
    const r = createTexturasRenderer(f)
    r.atualizar(entrada('a', [pincel('1', 'floresta', 300)]))
    await vi.advanceTimersByTimeAsync(0)
    expect(aviso).toHaveBeenCalled()
    r.atualizar(entrada('a', [pincel('1', 'floresta', 300)]))
    await vi.advanceTimersByTimeAsync(ESPERA_DAS_TEXTURAS_MS * 2)
    expect(f.rasterizar).toHaveBeenCalledTimes(2)
    expect(r.camada.children.length).toBeGreaterThan(0)
    r.destruir()
  })

  it('pacote novo com a textura dele no palco: o ladrilho velho só é destruído depois que a repintura o tira do palco', async () => {
    const f = falsosComLadrilhos()
    expect(registrarTexturaDoPacote(MUSGO)).toBe(true)
    const r = createTexturasRenderer(f)
    r.atualizar(entrada('a', [pincel('1', 'musgo-teste', 300)]))
    await vi.advanceTimersByTimeAsync(0)
    expect(emUso(r.camada)).toEqual([f.ladrilhos[0]])
    // Chega a versão nova do pacote ("Procurar texturas novas"): a cor mudou.
    expect(registrarTexturaDoPacote({ ...MUSGO, cor: () => 0x668855 })).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    // Enquanto a repintura espera a vez, o Pixi ainda desenha o TilingSprite velho: o ladrilho dele não pode estar destruído.
    expect(emUso(r.camada).every((t) => !t.destroyed)).toBe(true)
    await vi.advanceTimersByTimeAsync(ESPERA_DAS_TEXTURAS_MS * 2)
    expect(f.rasterizar).toHaveBeenCalledTimes(2)
    expect(emUso(r.camada)).toEqual([f.ladrilhos[1]])
    // E o velho não fica vazando memória.
    expect(f.ladrilhos[0].destroyed).toBe(true)
    r.destruir()
  })

  it('pacote esquecido com a textura dele no palco: nada destruído em uso, e a camada sai na repintura', async () => {
    const f = falsosComLadrilhos()
    registrarTexturaDoPacote(MUSGO)
    const r = createTexturasRenderer(f)
    r.atualizar(entrada('a', [pincel('1', 'musgo-teste', 300), pincel('2', 'floresta', 900)]))
    await vi.advanceTimersByTimeAsync(0)
    expect(emUso(r.camada)).toHaveLength(2)
    esquecerTexturasDeFora()
    await vi.advanceTimersByTimeAsync(0)
    expect(emUso(r.camada).every((t) => !t.destroyed)).toBe(true)
    await vi.advanceTimersByTimeAsync(ESPERA_DAS_TEXTURAS_MS * 2)
    // Só a floresta continua; o musgo saiu do palco e foi solto.
    expect(emUso(r.camada)).toHaveLength(1)
    expect(emUso(r.camada).every((t) => !t.destroyed)).toBe(true)
    expect(f.ladrilhos.filter((t) => t.destroyed)).toHaveLength(1)
    r.destruir()
  })

  it('o ladrilho de pacote que a prévia do pincel está usando não é destruído no meio do traço', async () => {
    const f = falsosComLadrilhos()
    registrarTexturaDoPacote(MUSGO)
    const r = createTexturasRenderer(f)
    r.atualizar(entrada('a', [pincel('1', 'floresta', 300)]))
    await vi.advanceTimersByTimeAsync(0)
    expect(r.ladrilhoParaPrevia('musgo-teste', undefined)).toBeNull()
    await vi.advanceTimersByTimeAsync(0)
    const previa = r.ladrilhoParaPrevia('musgo-teste', undefined)
    expect(previa).not.toBeNull()
    registrarTexturaDoPacote({ ...MUSGO, cor: () => 0x668855 })
    await vi.advanceTimersByTimeAsync(ESPERA_DAS_TEXTURAS_MS * 2)
    expect(previa?.destroyed).toBe(false)
    r.destruir()
    await vi.advanceTimersByTimeAsync(0)
    expect(previa?.destroyed).toBe(true)
  })

  it('destruir solta todos os ladrilhos e todas as máscaras', async () => {
    const f = falsosComLadrilhos()
    const r = createTexturasRenderer(f)
    r.atualizar(entrada('a', [pincel('1', 'floresta', 300), pincel('2', 'areia', 5000)]))
    await vi.advanceTimersByTimeAsync(0)
    expect(f.ladrilhos).toHaveLength(2)
    expect(f.mascaras).toHaveLength(2)
    r.destruir()
    await vi.advanceTimersByTimeAsync(0)
    expect(f.ladrilhos.every((t) => t.destroyed)).toBe(true)
    expect(f.mascaras.every((t) => t.destroyed)).toBe(true)
  })

  it('o ladrilho cresce com o mapa, mas nunca fica menor que três células', () => {
    // 200 x 64 = 12.800 px: a floresta (escala 40) sai com ~412 px.
    expect(Math.round(ladoDoLadrilhoNoMundo(MAPA, 40))).toBe(412)
    expect(ladoDoLadrilhoNoMundo({ width: 20, height: 20, grid: 64 }, 40)).toBe(192)
    // Chão de masmorra mede em casas: o mesmo número de casas em qualquer mapa, grande ou pequeno.
    expect(ladoDoLadrilhoNoMundo({ width: 20, height: 20, grid: 64 }, { casas: 8 })).toBe(512)
    expect(ladoDoLadrilhoNoMundo(MAPA, { casas: 8 })).toBe(8 * MAPA.grid)
  })
})

describe('a textura repetida do palco fica no tamanho da vista', () => {
  // O Pixi passa a área mascarada (`setMask channel:'alpha'`) por uma textura
  // do tamanho dela NA TELA, sem recortar na janela: um balde num continente
  // a 100% pedia 16384 x 8192 px e a tela do mestre ficava vazia.
  const VISTA = { minX: 200, minY: 300, maxX: 600, maxY: 700 }

  it('vista que chega antes da pintura: a área repetida é só o pedaço à vista, e o ladrilho continua preso à origem do mundo', async () => {
    const f = falsos()
    const r = createTexturasRenderer(f)
    r.ajustarAVista(VISTA)
    r.atualizar(entrada('a', [balde], [ilha]))
    await vi.advanceTimersByTimeAsync(0)
    const repetida = r.camada.children.find((c): c is TilingSprite => c instanceof TilingSprite)
    if (repetida === undefined) throw new Error('sem textura no palco')
    expect(repetida.position.x).toBeGreaterThanOrEqual(VISTA.minX)
    expect(repetida.position.y).toBeGreaterThanOrEqual(VISTA.minY)
    expect(repetida.position.x + repetida.width).toBeLessThanOrEqual(VISTA.maxX)
    expect(repetida.position.y + repetida.height).toBeLessThanOrEqual(VISTA.maxY)
    expect(repetida.tilePosition.x).toBe(-repetida.position.x)
    expect(repetida.tilePosition.y).toBe(-repetida.position.y)
    r.destruir()
  })

  it('vista que muda depois: recorta de novo, e some quando a pintura sai da vista', async () => {
    const f = falsos()
    const r = createTexturasRenderer(f)
    r.atualizar(entrada('a', [balde], [ilha]))
    await vi.advanceTimersByTimeAsync(0)
    const repetida = r.camada.children.find((c): c is TilingSprite => c instanceof TilingSprite)
    if (repetida === undefined) throw new Error('sem textura no palco')
    const larguraInteira = repetida.width
    r.ajustarAVista(VISTA)
    expect(repetida.width).toBeLessThan(larguraInteira)
    expect(repetida.position.x + repetida.width).toBeLessThanOrEqual(VISTA.maxX)
    r.ajustarAVista({ minX: 5000, minY: 5000, maxX: 6000, maxY: 6000 })
    expect(repetida.visible).toBe(false)
    r.ajustarAVista(VISTA)
    expect(repetida.visible).toBe(true)
    r.destruir()
  })

  it('a vista sai da câmera e do tamanho da tela', () => {
    expect(vistaDaCamera({ x: -100, y: -50, scale: 2 }, { width: 800, height: 600 })).toEqual({ minX: 50, minY: 25, maxX: 450, maxY: 325 })
  })
})

describe('pintura à parte (a do PNG exportado)', () => {
  it('ladrilho que falha devolve null em vez de rejeitar, e não fica preso no cache: a próxima tentativa pinta', async () => {
    const f = falsos()
    f.ladrilho.mockRejectedValueOnce(new Error('cor de fora que lança'))
    const r = createTexturasRenderer(f)
    await expect(r.pintarAParte(entrada('a', [pincel('1', 'floresta', 300)]))).resolves.toBeNull()
    const depois = await r.pintarAParte(entrada('a', [pincel('1', 'floresta', 300)]))
    expect(depois?.children.filter((c) => c instanceof TilingSprite)).toHaveLength(1)
  })

  it('máscara que falha devolve null em vez de rejeitar', async () => {
    const f = falsos()
    f.rasterizar.mockRejectedValueOnce(new Error('canvas sem contexto'))
    const r = createTexturasRenderer(f)
    await expect(r.pintarAParte(entrada('a', [pincel('1', 'floresta', 300)]))).resolves.toBeNull()
  })
})
