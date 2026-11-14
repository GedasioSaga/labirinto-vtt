import { describe, expect, it } from 'vitest'
import { CUTSCENE_TITULO_MAX, lerCutsceneVideoDoJogador, lerCutsceneVideoOrdem, lerCutsceneVideoPreparar } from './protocol'

/**
 * CUTSCENE EM VÍDEO (14/11/2026): as mensagens `cutscene.video.*`. O jogador
 * só aceita do mestre o `preparar` com id de vídeo da mídia da mesa e o
 * título curto; o mestre só aceita do jogador o andamento de 0 a 100.
 */

const VIDEO = `${'a'.repeat(64)}.webm`

describe('cutscene.video: o que o jogador recebe', () => {
  it('preparar: id <sha256>.<mp4|webm>, título curto sem quebra, jaLargou só booleano', () => {
    const certo = { type: 'cutscene.video.preparar', exibicao: 3, video: VIDEO, titulo: 'A chegada' }
    expect(lerCutsceneVideoPreparar(certo)).toEqual(certo)
    expect(lerCutsceneVideoPreparar({ ...certo, video: `${'b'.repeat(64)}.mp4`, jaLargou: true })).toEqual({ ...certo, video: `${'b'.repeat(64)}.mp4`, jaLargou: true })
    // `jaLargou: false` sai como ausente (jogador antigo não estranha).
    expect(lerCutsceneVideoPreparar({ ...certo, jaLargou: false })).toEqual(certo)
    expect(lerCutsceneVideoPreparar({ ...certo, titulo: 'x'.repeat(CUTSCENE_TITULO_MAX) })).not.toBeNull()
    for (const torto of [
      { ...certo, video: `${'a'.repeat(64)}.png` },
      { ...certo, video: `${'A'.repeat(64)}.mp4` },
      { ...certo, video: `../${'a'.repeat(64)}.mp4` },
      { ...certo, video: 'https://exemplo.com/v.mp4' },
      { ...certo, titulo: 'x'.repeat(CUTSCENE_TITULO_MAX + 1) },
      { ...certo, titulo: 'linha\nnova' },
      { ...certo, titulo: '   ' },
      { ...certo, exibicao: 0 },
      { ...certo, exibicao: 1.5 },
      { ...certo, jaLargou: 'sim' },
      { ...certo, type: 'cutscene.preparar' },
    ]) {
      expect(lerCutsceneVideoPreparar(torto)).toBeNull()
    }
  })

  it('tocar e parar só levam o número da exibição', () => {
    expect(lerCutsceneVideoOrdem({ type: 'cutscene.video.tocar', exibicao: 2 })).toEqual({ type: 'cutscene.video.tocar', exibicao: 2 })
    expect(lerCutsceneVideoOrdem({ type: 'cutscene.video.parar', exibicao: 2, extra: 1 })).toEqual({ type: 'cutscene.video.parar', exibicao: 2 })
    expect(lerCutsceneVideoOrdem({ type: 'cutscene.video.pular', exibicao: 2 })).toBeNull()
    expect(lerCutsceneVideoOrdem({ type: 'cutscene.video.tocar', exibicao: -1 })).toBeNull()
    expect(lerCutsceneVideoOrdem(null)).toBeNull()
  })
})

describe('cutscene.video: o que o mestre recebe da tela', () => {
  it('andamento inteiro de 0 a 100, "falhou" só booleano; pronta e fim só com a exibição', () => {
    expect(lerCutsceneVideoDoJogador({ type: 'cutscene.video.progresso', exibicao: 1, pct: 40 })).toEqual({ type: 'cutscene.video.progresso', exibicao: 1, pct: 40 })
    expect(lerCutsceneVideoDoJogador({ type: 'cutscene.video.progresso', exibicao: 1, pct: 0, falhou: true })).toEqual({ type: 'cutscene.video.progresso', exibicao: 1, pct: 0, falhou: true })
    expect(lerCutsceneVideoDoJogador({ type: 'cutscene.video.pronta', exibicao: 1, pct: 100 })).toEqual({ type: 'cutscene.video.pronta', exibicao: 1 })
    expect(lerCutsceneVideoDoJogador({ type: 'cutscene.video.fim', exibicao: 1 })).toEqual({ type: 'cutscene.video.fim', exibicao: 1 })
    for (const torto of [
      { type: 'cutscene.video.progresso', exibicao: 1, pct: 101 },
      { type: 'cutscene.video.progresso', exibicao: 1, pct: -1 },
      { type: 'cutscene.video.progresso', exibicao: 1, pct: 50.5 },
      { type: 'cutscene.video.progresso', exibicao: 1, pct: '50' },
      { type: 'cutscene.video.progresso', exibicao: 1, pct: 50, falhou: 'sim' },
      { type: 'cutscene.video.progresso', exibicao: 0, pct: 50 },
      { type: 'cutscene.video.tocar', exibicao: 1 },
      { type: 'cutscene.video.parar', exibicao: 1 },
    ]) {
      expect(lerCutsceneVideoDoJogador(torto)).toBeNull()
    }
  })
})
