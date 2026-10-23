import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { Prop } from '../../../types/map'
import { chaveDoMovel } from '../../../pixi/rasterDosMoveis'
import { varianteDaLapide } from '../../../lib/mobilia/pecasNovas'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel } from './index'
import { colar, emPng, escrever, novaTela } from './folhaDeContato.testkit'

/**
 * FOLHA DE CONTATO da fatia MT4: as 9 peças novas como o APP as desenha (o
 * objeto no tamanho padrão, sem cor gravada, os materiais padrão e a semente
 * da chave), as 3 lápides (o id escolhe o desenho), a barraca e a carroça de
 * lado, e a mesa antiga de 2 x 1 para comparar com as mesas novas. Cada quadro
 * tem a peça no nível 1 e no nível 3, no chão padrão do app (#a8776a), e
 * embaixo o tempo de gerar cada imagem (o nível 1 e o nível 3, em ms, nesta
 * máquina e nesta rodada). Grava `docs/design/objetos/provas/mt4-folha-de-contato.png`.
 *
 * Só roda quando pedida (prova para o usuário, não teste de regressão):
 * `GERAR_FOLHA_MT4=1 npx vitest run src/texturas/meioTermo/moveis/folhaDeContatoMt4.test.ts`.
 */

const DESTINO = '../docs/design/objetos/provas/mt4-folha-de-contato.png'
const PEDIDA = import.meta.env.GERAR_FOLHA_MT4 === '1'
const CHAO: readonly [number, number, number] = [0xa8, 0x77, 0x6a]
const TINTA: readonly [number, number, number] = [0x24, 0x1c, 0x18]
const MARGEM = 24
const VAO = 18
const ESCALA_DA_LETRA = 2
const ALTURA_DA_LETRA = 7 * ESCALA_DA_LETRA + 8
const NIVEIS = [1, 3] as const
const POR_LINHA = 4
/** Px de mundo por casa do app (a grade de referência). */
const CASA = 50

function idDaLapide(variante: number): string {
  for (let i = 0; i < 100; i += 1) if (varianteDaLapide(`lapide-${i}`) === variante) return `lapide-${i}`
  throw new Error(`nenhum id dá a lápide ${variante}`)
}

function peca(mobilia: NonNullable<Prop['mobilia']>, casasW: number, casasH: number, extra: Partial<Prop> = {}): Prop {
  return { id: `p-${mobilia}`, src: '', x: 0, y: 0, width: casasW * CASA, height: casasH * CASA, linkedMapPath: null, mobilia, ...extra }
}

/** A fonte da folha só tem maiúsculas, dígitos, '+', ',' e '/'. */
const QUADROS: readonly { readonly rotulo: string; readonly prop: Prop }[] = [
  { rotulo: 'MESA QUADRADA', prop: peca('mesaQuadrada', 1, 1) },
  { rotulo: 'MESA REDONDA', prop: peca('mesaRedonda', 1.25, 1.25) },
  { rotulo: 'MESA ANTIGA 2X1', prop: peca('mesa', 2, 1) },
  { rotulo: 'LAPIDE ARCO', prop: peca('lapide', 0.6, 0.35, { id: idDaLapide(0) }) },
  { rotulo: 'LAPIDE RETA', prop: peca('lapide', 0.6, 0.35, { id: idDaLapide(1) }) },
  { rotulo: 'LAPIDE CRUZ', prop: peca('lapide', 0.6, 0.35, { id: idDaLapide(2) }) },
  { rotulo: 'VASO DE PLANTA', prop: peca('vaso', 0.5, 0.5) },
  { rotulo: 'LAMPIAO', prop: peca('lampiao', 0.5, 0.5) },
  { rotulo: 'QUADRO DE AVISOS', prop: peca('quadroDeAvisos', 1, 0.4) },
  { rotulo: 'POCO', prop: peca('poco', 1.5, 1.5) },
  { rotulo: 'BARRACA', prop: peca('barraca', 2, 2) },
  { rotulo: 'BARRACA DE LADO', prop: peca('barraca', 2, 2, { mobiliaVista: 'lado' }) },
  { rotulo: 'CARROCA', prop: peca('carroca', 2, 1.25) },
  { rotulo: 'CARROCA DE LADO', prop: peca('carroca', 2, 1.25, { mobiliaVista: 'lado' }) },
]

function desenhoDoApp(prop: Prop, nivel: number): DesenhoDoMovel {
  const chave = chaveDoMovel(prop, nivel, 1)
  if (chave === null) throw new Error(`${prop.mobilia}: sem desenho com textura`)
  return chave.desenho
}

function emMs(ms: number): string {
  return ms.toFixed(1).replace('.', ',')
}

it.skipIf(!PEDIDA)('gera a folha de contato das 9 peças novas (14 quadros: as lápides, as vistas de lado e a mesa antiga), cada uma a 1x e a 3x com o tempo embaixo', () => {
  const quadros = QUADROS.map(({ rotulo, prop }) => {
    const imagens = NIVEIS.map((nivel) => {
      const d = desenhoDoApp(prop, nivel)
      const t0 = performance.now()
      const im = pintarMovel(d, escalaDoNivel(nivel))
      return { ...im, ms: performance.now() - t0 }
    })
    return { rotulo, imagens, tempo: imagens.map((im, k) => `${NIVEIS[k]}X ${emMs(im.ms)} MS`).join(' / ') }
  })
  const larguraDe = (q: (typeof quadros)[number]): number =>
    Math.max(q.imagens.reduce((s, im) => s + im.limites.W + VAO, 0), q.rotulo.length * 6 * ESCALA_DA_LETRA, q.tempo.length * 6 * ESCALA_DA_LETRA)
  const alturaDe = (q: (typeof quadros)[number]): number => Math.max(...q.imagens.map((im) => im.limites.H)) + ALTURA_DA_LETRA * 2 + VAO
  const linhas: (typeof quadros)[] = []
  for (let i = 0; i < quadros.length; i += POR_LINHA) linhas.push(quadros.slice(i, i + POR_LINHA))
  const largura = Math.max(...linhas.map((l) => l.reduce((s, q) => s + larguraDe(q) + VAO * 2, 0)))
  const altura = linhas.reduce((s, l) => s + Math.max(...l.map(alturaDe)), 0)
  const tela = novaTela(largura + MARGEM * 2, altura + MARGEM * 2, CHAO)
  let y = MARGEM
  for (const linha of linhas) {
    const alturaDaLinha = Math.max(...linha.map(alturaDe))
    let x = MARGEM
    for (const q of linha) {
      escrever(tela, q.rotulo, x, y, ESCALA_DA_LETRA, TINTA)
      const alturaDasImagens = Math.max(...q.imagens.map((im) => im.limites.H))
      let xi = x
      for (const im of q.imagens) {
        colar(tela, im.pixels, im.limites.W, im.limites.H, xi, y + ALTURA_DA_LETRA)
        xi += im.limites.W + VAO
      }
      escrever(tela, q.tempo, x, y + ALTURA_DA_LETRA + alturaDasImagens + 6, ESCALA_DA_LETRA, TINTA)
      x += larguraDe(q) + VAO * 2
    }
    y += alturaDaLinha
  }
  const png = emPng(tela)
  writeFileSync(DESTINO, png)
  expect(quadros).toHaveLength(14)
  expect(png.length).toBeGreaterThan(0)
})
