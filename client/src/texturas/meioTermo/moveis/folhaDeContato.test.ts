import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import type { OpcaoDeMaterial } from '../materiais'
import { escalaDoNivel, pintarMovel, type TipoComTextura } from './index'
import { colar, emPng, escrever, novaTela } from './folhaDeContato.testkit'

/**
 * FOLHA DE CONTATO da fatia MT2: os 6 móveis "de cima com volume" em 3
 * materiais, cada um no nível 1 e no nível 3 lado a lado, no chão padrão do
 * app (#a8776a), com o tipo e os materiais escritos em cima. Grava
 * `docs/design/objetos/provas/mt2-folha-de-contato.png`.
 *
 * Só roda quando pedida (a folha é prova para o usuário, não teste de
 * regressão): `GERAR_FOLHA_MT2=1 npx vitest run src/texturas/meioTermo/moveis/folhaDeContato.test.ts`.
 */

/** O vitest roda de `client/` (o ambiente jsdom não dá `import.meta.url` de arquivo). */
const DESTINO = resolve(process.cwd(), '../docs/design/objetos/provas/mt2-folha-de-contato.png')
const CHAO: readonly [number, number, number] = [0xa8, 0x77, 0x6a]
const TINTA: readonly [number, number, number] = [0x24, 0x1c, 0x18]
const MARGEM = 24
const VAO = 18
const ESCALA_DA_LETRA = 2
const ALTURA_DO_ROTULO = 7 * ESCALA_DA_LETRA + 8

const LINHAS: readonly { tipo: TipoComTextura; nome: string; casasW: number; casasH: number; materiais: readonly (readonly OpcaoDeMaterial[])[] }[] = [
  { tipo: 'barril', nome: 'BARRIL', casasW: 0.75, casasH: 0.75, materiais: [['carvalho', 'ferro'], ['nogueira', 'latao'], ['velha', 'ferro']] },
  { tipo: 'caixa', nome: 'CAIXA', casasW: 0.75, casasH: 0.75, materiais: [['pinho'], ['cerejeira'], ['nogueira']] },
  { tipo: 'bau', nome: 'BAU', casasW: 1, casasH: 0.5, materiais: [['nogueira', 'latao'], ['carvalho', 'ferro'], ['cerejeira', 'latao']] },
  { tipo: 'catre', nome: 'CAMA', casasW: 1, casasH: 2, materiais: [['carvalho', 'vinho', 'linho'], ['nogueira', 'azul', 'musgo'], ['pinho', 'ocre', 'vinho']] },
  { tipo: 'mesa', nome: 'MESA', casasW: 2, casasH: 1, materiais: [['carvalho'], ['nogueira'], ['velha']] },
  { tipo: 'cadeira', nome: 'CADEIRA', casasW: 0.5, casasH: 0.5, materiais: [['carvalho', 'palha'], ['nogueira', 'mesma'], ['pinho', 'palha']] },
]

const NIVEIS = [1, 3] as const

it.skipIf(process.env.GERAR_FOLHA_MT2 !== '1')('gera a folha de contato dos 6 móveis x 3 materiais x 2 níveis', () => {
  const linhas = LINHAS.map((linha) => ({
    ...linha,
    celulas: linha.materiais.map((materiais) => ({
      rotulo: `${linha.nome} ${materiais.join('+').toUpperCase()}`,
      imagens: NIVEIS.map((nivel) => pintarMovel({ tipo: linha.tipo, lado: 'frente', materiais, casasW: linha.casasW, casasH: linha.casasH, semente: 7 }, escalaDoNivel(nivel))),
    })),
  }))
  /** Cada nível ocupa a largura da imagem ou a do letreiro "NIVEL n", a maior. */
  const colunaDe = (W: number): number => Math.max(W, 'NIVEL 1'.length * 6 * ESCALA_DA_LETRA)
  const larguraDaCelula = (imagens: (typeof linhas)[number]['celulas'][number]['imagens']): number => imagens.reduce((s, im) => s + colunaDe(im.limites.W), 0) + VAO
  const larguras = linhas.map((l) => l.celulas.reduce((s, c) => s + Math.max(larguraDaCelula(c.imagens), c.rotulo.length * 6 * ESCALA_DA_LETRA) + VAO * 2, 0))
  const alturas = linhas.map((l) => Math.max(...l.celulas.flatMap((c) => c.imagens.map((im) => im.limites.H))) + ALTURA_DO_ROTULO * 2 + VAO)
  const tela = novaTela(Math.max(...larguras) + MARGEM * 2, alturas.reduce((s, h) => s + h, 0) + MARGEM * 2, CHAO)
  let y = MARGEM
  linhas.forEach((linha, li) => {
    let x = MARGEM
    for (const celula of linha.celulas) {
      escrever(tela, celula.rotulo, x, y, ESCALA_DA_LETRA, TINTA)
      let xi = x
      celula.imagens.forEach((im, k) => {
        escrever(tela, `NIVEL ${NIVEIS[k]}`, xi, y + ALTURA_DO_ROTULO, ESCALA_DA_LETRA, TINTA)
        colar(tela, im.pixels, im.limites.W, im.limites.H, xi, y + ALTURA_DO_ROTULO * 2)
        xi += colunaDe(im.limites.W) + VAO
      })
      x += Math.max(larguraDaCelula(celula.imagens), celula.rotulo.length * 6 * ESCALA_DA_LETRA) + VAO * 2
    }
    y += alturas[li]
  })
  const png = emPng(tela)
  writeFileSync(DESTINO, png)
  expect(png.length).toBeGreaterThan(0)
})
