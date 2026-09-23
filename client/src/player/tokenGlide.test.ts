import { describe, expect, it } from 'vitest'
import { TOKEN_GLIDE_MS, createTokenGlides, glidePosition, stepGlides, syncGlide } from './tokenGlide'

const ORIGEM = { x: 300, y: 250 }
const DESTINO = { x: 700, y: 250 }

describe('deslize da ficha na tela do jogador', () => {
  it('a ficha que muda de lugar na mesma cena sai do ponto antigo, passa pelo meio e para no novo', () => {
    const glides = createTokenGlides()
    const agora = syncGlide(glides, 'tok-bruno', { shown: ORIGEM, target: DESTINO, now: 1000, animate: true })
    expect(agora).toEqual(ORIGEM)

    const quadros = [1000 + TOKEN_GLIDE_MS * 0.25, 1000 + TOKEN_GLIDE_MS * 0.5, 1000 + TOKEN_GLIDE_MS * 0.75].map((t) => stepGlides(glides, t)[0])
    for (const q of quadros) {
      expect(q.x).toBeGreaterThan(ORIGEM.x)
      expect(q.x).toBeLessThan(DESTINO.x)
      // Linha reta: nunca sai da linha do trajeto.
      expect(q.y).toBe(250)
    }
    // Só avança.
    expect(quadros[1].x).toBeGreaterThan(quadros[0].x)
    expect(quadros[2].x).toBeGreaterThan(quadros[1].x)

    const fim = stepGlides(glides, 1000 + TOKEN_GLIDE_MS)
    expect(fim).toEqual([{ id: 'tok-bruno', ...DESTINO }])
    // Chegou: nada mais a animar.
    expect(stepGlides(glides, 1000 + TOKEN_GLIDE_MS + 16)).toEqual([])
  })

  it('o deslize é curto: entre 150 e 250 ms', () => {
    expect(TOKEN_GLIDE_MS).toBeGreaterThanOrEqual(150)
    expect(TOKEN_GLIDE_MS).toBeLessThanOrEqual(250)
  })

  it('pelo menos um terço do tempo a ficha está no miolo do trajeto (15%-85%), e não num pulo', () => {
    const track = { fromX: 0, fromY: 0, toX: 100, toY: 0, start: 0 }
    let noMeio = 0
    for (let t = 0; t <= TOKEN_GLIDE_MS; t += 1) {
      const { x } = glidePosition(track, t)
      if (x > 15 && x < 85) noMeio += 1
    }
    expect(noMeio).toBeGreaterThanOrEqual(TOKEN_GLIDE_MS / 3)
  })

  it('troca de cena é instantânea: animate false vai direto ao ponto novo', () => {
    const glides = createTokenGlides()
    expect(syncGlide(glides, 'tok-ana', { shown: ORIGEM, target: DESTINO, now: 0, animate: false })).toEqual(DESTINO)
    expect(stepGlides(glides, 50)).toEqual([])
  })

  it('ficha que acabou de aparecer (não estava na tela) surge no lugar, sem vir de onde estava escondida', () => {
    const glides = createTokenGlides()
    expect(syncGlide(glides, 'tok-lobo', { shown: null, target: DESTINO, now: 0, animate: true })).toEqual(DESTINO)
    expect(stepGlides(glides, 50)).toEqual([])
  })

  it('o mesmo movimento chegando de novo (otimista, aceito, snapshot) não recomeça o deslize', () => {
    const glides = createTokenGlides()
    syncGlide(glides, 'tok-bruno', { shown: ORIGEM, target: DESTINO, now: 0, animate: true })
    const meio = stepGlides(glides, TOKEN_GLIDE_MS / 2)[0]
    // Redraw no meio do caminho com o MESMO alvo: continua de onde estava.
    const deNovo = syncGlide(glides, 'tok-bruno', { shown: { x: meio.x, y: meio.y }, target: DESTINO, now: TOKEN_GLIDE_MS / 2, animate: true })
    expect(deNovo.x).toBeCloseTo(meio.x)
    expect(stepGlides(glides, TOKEN_GLIDE_MS)).toEqual([{ id: 'tok-bruno', ...DESTINO }])
  })

  it('alvo novo no meio do caminho parte de onde a ficha está desenhada, sem voltar ao ponto antigo', () => {
    const glides = createTokenGlides()
    syncGlide(glides, 'tok-bruno', { shown: ORIGEM, target: DESTINO, now: 0, animate: true })
    const meio = stepGlides(glides, TOKEN_GLIDE_MS / 2)[0]
    const outro = { x: 700, y: 450 }
    const agora = syncGlide(glides, 'tok-bruno', { shown: { x: meio.x, y: meio.y }, target: outro, now: TOKEN_GLIDE_MS / 2, animate: true })
    expect(agora).toEqual({ x: meio.x, y: meio.y })
    const depois = stepGlides(glides, TOKEN_GLIDE_MS / 2 + 10)[0]
    expect(depois.x).toBeGreaterThanOrEqual(meio.x)
    expect(depois.y).toBeGreaterThan(meio.y)
  })

  it('a própria ficha solta sob o dedo fica onde foi solta: o arredondamento do fim do arrasto não anima', () => {
    const glides = createTokenGlides()
    // O dedo soltou em 699.6; o movimento otimista chega arredondado a 700.
    expect(syncGlide(glides, 'tok-ana', { shown: { x: 699.6, y: 250.3 }, target: DESTINO, now: 0, animate: true })).toEqual(DESTINO)
    expect(stepGlides(glides, 10)).toEqual([])
  })

  it('cada ficha desliza por conta própria', () => {
    const glides = createTokenGlides()
    syncGlide(glides, 'a', { shown: { x: 0, y: 0 }, target: { x: 100, y: 0 }, now: 0, animate: true })
    syncGlide(glides, 'b', { shown: { x: 0, y: 0 }, target: { x: 0, y: 100 }, now: 100, animate: true })
    const quadro = stepGlides(glides, TOKEN_GLIDE_MS)
    expect(quadro.find((q) => q.id === 'a')).toEqual({ id: 'a', x: 100, y: 0 })
    const b = quadro.find((q) => q.id === 'b')
    expect(b?.x).toBe(0)
    expect(b?.y).toBeGreaterThan(0)
    expect(b?.y).toBeLessThan(100)
  })
})
