/**
 * MINIATURA DA CUTSCENE (`lib/miniaturaDoVideo.ts`): o segundo do quadro e o
 * contrato da fila — nunca rejeita, um pedido por vídeo. O quadro em si (o
 * `<video>` decodificando o arquivo do disco) só existe no app e no navegador
 * de verdade: o jsdom não decodifica vídeo.
 */
import { describe, expect, it } from 'vitest'
import { pedirMiniaturaDoVideo, segundoDaMiniatura } from './miniaturaDoVideo'

describe('miniatura do vídeo da cutscene', () => {
  it('o quadro sai de 1 s; no vídeo curto, de 10% dele; duração desconhecida (webm sem duração) = 1 s', () => {
    expect(segundoDaMiniatura(95)).toBe(1)
    expect(segundoDaMiniatura(10)).toBe(1)
    expect(segundoDaMiniatura(4)).toBeCloseTo(0.4)
    for (const desconhecida of [Number.NaN, Number.POSITIVE_INFINITY, 0, -3]) expect(segundoDaMiniatura(desconhecida)).toBe(1)
  })

  it('sem o app (navegador puro) ou com id torto, devolve null sem lançar, e o mesmo vídeo é um pedido só', async () => {
    const valido = `${'c'.repeat(64)}.webm`
    const pedido = pedirMiniaturaDoVideo(valido)
    expect(pedirMiniaturaDoVideo(valido)).toBe(pedido)
    await expect(pedido).resolves.toBeNull()
    await expect(pedirMiniaturaDoVideo('C:/videos/cena.mp4')).resolves.toBeNull()
  })
})
