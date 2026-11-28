import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Ticker } from 'pixi.js'
import { createChamasDasFogueiras, sincronizarChamas } from './chamasDasFogueiras'
import { FIOS_DE_AGUA } from './fioDeAgua'
import { animacaoValida } from '../lib/mobilia/animadores'
import type { Prop } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

/**
 * O FIO DE ÁGUA (I0-e, 28/11/2026): só a saída Escorrendo e a fonte Correndo ganham o nó; com movimento as gotas
 * descem do pivô até onde a água bate e o relógio roda; com "menos movimento" o nó fica apagado (a imagem já tem a
 * água em repouso) e o relógio não roda.
 */

function objeto(mobilia: Prop['mobilia'], extra: Partial<Prop> = {}): Prop {
  return { id: `${mobilia}-1`, src: '', x: 200, y: 100, width: 64, height: 64, linkedMapPath: null, mobilia, ...extra }
}

function palco(reduzido: boolean) {
  const ticker = new Ticker()
  let agora = 1_000_000
  const chamas = createChamasDasFogueiras({ movimento: { ticker, reducedMotion: () => reduzido, agora: () => agora } })
  return {
    chamas,
    ticker,
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
  }
}

function gotasDe(camada: Container): Graphics[] {
  return camada.children.flatMap((no) => no.getChildByLabel('plano')?.children ?? []).filter((g): g is Graphics => g instanceof Graphics && g.label === 'gota')
}

describe('fio de água', () => {
  it('corre só na saída Escorrendo e na fonte Correndo, desce do pivô com movimento e fica apagado com menos movimento', () => {
    for (const fio of Object.values(FIOS_DE_AGUA)) expect(animacaoValida(fio.animacao)).toBe(true)
    const props = [
      objeto('saidaDeEsgoto', { mobiliaVersao: 'escorrendo' }),
      objeto('saidaDeEsgoto', { id: 'seca-1' }),
      objeto('fonteDeParede', { width: 64, height: 48 }),
      objeto('fonteDeParede', { id: 'fonte-seca', mobiliaVersao: 'seca' }),
    ]

    const vivo = palco(false)
    const camada = new Container()
    expect(sincronizarChamas(vivo.chamas, camada, props, { cameraScale: 1 })).toBe(2)
    expect(camada.children.map((no) => no.label)).toEqual(['fio:saidaDeEsgoto-1', 'fio:fonteDeParede-1'])
    expect(vivo.ticker.count).toBeGreaterThan(0)
    const saida = gotasDe(camada).slice(0, 3)
    const alturas: number[] = []
    for (let i = 0; i < 4; i += 1) {
      vivo.quadro(50)
      alturas.push(saida[0].position.y)
    }
    // A primeira gota desce (y cresce) entre o pivô (0,52 da altura) e a poça (8,5/56 casa abaixo).
    const pivoY = (FIOS_DE_AGUA.saidaDeEsgoto.animacao.pivo.y - 0.5) * 64
    const batidaY = pivoY + FIOS_DE_AGUA.saidaDeEsgoto.queda * 64
    expect(alturas.every((y, i) => i === 0 || y >= alturas[i - 1])).toBe(true)
    for (const y of alturas) expect(y).toBeGreaterThanOrEqual(pivoY - 1e-9)
    for (const y of alturas) expect(y).toBeLessThanOrEqual(batidaY + 1e-9)
    expect(gotasDe(camada).some((g) => g.alpha > 0)).toBe(true)

    const parado = palco(true)
    const camadaParada = new Container()
    expect(sincronizarChamas(parado.chamas, camadaParada, props, { cameraScale: 1 })).toBe(2)
    expect(gotasDe(camadaParada).every((g) => g.alpha === 0)).toBe(true)
    expect(parado.ticker.count).toBe(0)
  })
})
