import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { colar, emPng, escrever, novaTela } from './moveis/folhaDeContato.testkit'
import { BIOMAS, chaoDe, ladrilhoDe, pintarAntes, pintarRegiao, recortar, type Regiao } from './chaoNoMundo.testkit'

/**
 * FOLHA DE CONTATO da MT7 (chão sem repetição): 15 quadros, 5 por bioma
 * (grama, terra, floresta), no mapa de prova de 30 x 20 casas de 64 px (o
 * ladrilho no mínimo de 3 casas, 192 px):
 *
 * 1. antes a 100% (o ladrilho repetido); 2. depois a 100% (os pedaços);
 * 3. antes a 25% (6 x 4,5 ladrilhos: a grade da repetição salta à vista);
 * 4. depois a 25% (pedaços do nível 2); 5. depois a 300% (o pedaço de 1x
 * ampliado 3 vezes com filtro linear, como a câmera faz).
 *
 * Embaixo de cada quadro, o tempo de pintar os bytes dele em Node (ms). Só
 * grava o PNG com `GERAR_FOLHA_MT7=1`.
 */

const GERAR = import.meta.env.GERAR_FOLHA_MT7 === '1'
const DESTINO = '../docs/design/objetos/provas/mt7-folha-de-contato.png'
const W = 384
const H = 288
const MARGEM = 12
const LEGENDA = 22
const TOPO = 40
const FUNDO = [40, 38, 34] as const
const LETRA = [232, 226, 210] as const

function ampliar(r: Regiao, z: number): Regiao {
  const largura = r.largura * z
  const altura = r.altura * z
  const rgba = new Uint8ClampedArray(largura * altura * 4)
  for (let y = 0; y < altura; y += 1) {
    const v = Math.min(r.altura - 1.001, Math.max(0, (y + 0.5) / z - 0.5))
    const j = Math.floor(v)
    const fv = v - j
    for (let x = 0; x < largura; x += 1) {
      const u = Math.min(r.largura - 1.001, Math.max(0, (x + 0.5) / z - 0.5))
      const i = Math.floor(u)
      const fu = u - i
      const a = (j * r.largura + i) * 4
      const b = a + 4
      const c = a + r.largura * 4
      const d = c + 4
      const o = (y * largura + x) * 4
      for (let k = 0; k < 3; k += 1) rgba[o + k] = r.rgba[a + k] * (1 - fu) * (1 - fv) + r.rgba[b + k] * fu * (1 - fv) + r.rgba[c + k] * (1 - fu) * fv + r.rgba[d + k] * fu * fv
      rgba[o + 3] = 255
    }
  }
  return { largura, altura, rgba }
}

function medir<T>(f: () => T): { valor: T; ms: number } {
  const t0 = performance.now()
  const valor = f()
  return { valor, ms: performance.now() - t0 }
}

it.skipIf(!GERAR)('folha de contato da MT7: 15 quadros (3 biomas x antes/depois em 3 zooms)', { timeout: 120_000 }, () => {
  const colunas = 5
  const tela = novaTela(MARGEM + colunas * (W + MARGEM), TOPO + BIOMAS.length * (H + LEGENDA + MARGEM), FUNDO)
  escrever(tela, 'MT7 CHAO SEM REPETICAO, MAPA 30 X 20 CASAS DE 64, LADRILHO DE 192 PX', MARGEM, 12, 2, LETRA)
  BIOMAS.forEach((id, linha) => {
    const chao = chaoDe(id)
    const img = ladrilhoDe(id)
    const quadros: { nome: string; r: Regiao; ms: number }[] = []
    const a1 = medir(() => pintarAntes(img, chao.ladoNoMundo, W, H))
    quadros.push({ nome: 'ANTES 100', r: a1.valor, ms: a1.ms })
    const d1 = medir(() => recortar(pintarRegiao(chao, 0, 0, 2, 2, 0), 0, 0, W, H))
    quadros.push({ nome: 'DEPOIS 100', r: d1.valor, ms: d1.ms })
    const a4 = medir(() => pintarAntes(img, chao.ladoNoMundo, W, H, 4))
    quadros.push({ nome: 'ANTES 25', r: a4.valor, ms: a4.ms })
    const d4 = medir(() => recortar(pintarRegiao(chao, 0, 0, 2, 2, 2), 0, 0, W, H))
    quadros.push({ nome: 'DEPOIS 25', r: d4.valor, ms: d4.ms })
    const d3 = medir(() => ampliar(recortar(pintarRegiao(chao, 0, 0, 1, 1, 0), 64, 64, W / 3, H / 3), 3))
    quadros.push({ nome: 'DEPOIS 300', r: d3.valor, ms: d3.ms })
    const y = TOPO + linha * (H + LEGENDA + MARGEM)
    quadros.forEach((q, coluna) => {
      const x = MARGEM + coluna * (W + MARGEM)
      colar(tela, q.r.rgba, q.r.largura, q.r.altura, x, y)
      escrever(tela, `${id.toUpperCase()} ${q.nome}  ${q.ms.toFixed(0)} MS`, x, y + H + 5, 2, LETRA)
    })
  })
  const png = emPng(tela)
  writeFileSync(DESTINO, png)
  expect(png.length).toBeGreaterThan(1000)
})
