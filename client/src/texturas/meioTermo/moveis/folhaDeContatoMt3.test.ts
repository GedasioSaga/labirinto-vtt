import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { FormaDoTapete, Prop } from '../../../types/map'
import { chaveDoMovel } from '../../../pixi/rasterDosMoveis'
import type { OpcaoDeMaterial } from '../materiais'
import type { LadoDoMovel } from './contexto'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel, type TipoComTextura } from './index'
import { colar, emPng, escrever, novaTela } from './folhaDeContato.testkit'

/**
 * FOLHA DE CONTATO da fatia MT3: os 11 móveis "de cima com volume" em 3
 * materiais, com as vistas de lado, a cerca curva e o tapete redondo, cada um
 * no nível 1 e no nível 3 lado a lado, no chão padrão do app (#a8776a), com o
 * tipo e os materiais escritos em cima; nas últimas linhas, a fogueira e a
 * cerca curva como o app as desenha (objeto no tamanho padrão e a semente da
 * chave). Grava `docs/design/objetos/provas/mt3-folha-de-contato.png`.
 *
 * Só roda quando pedida (prova para o usuário, não teste de regressão):
 * `GERAR_FOLHA_MT3=1 npx vitest run src/texturas/meioTermo/moveis/folhaDeContatoMt3.test.ts`.
 */

/** Relativo à pasta em que o vitest roda (`client/`). */
const DESTINO = '../docs/design/objetos/provas/mt3-folha-de-contato.png'
/** No vitest, `import.meta.env` traz as variáveis do ambiente do processo. */
const PEDIDA = import.meta.env.GERAR_FOLHA_MT3 === '1'
const CHAO: readonly [number, number, number] = [0xa8, 0x77, 0x6a]
const TINTA: readonly [number, number, number] = [0x24, 0x1c, 0x18]
const MARGEM = 24
const VAO = 18
const ESCALA_DA_LETRA = 2
const ALTURA_DO_ROTULO = 7 * ESCALA_DA_LETRA + 8
const NIVEIS = [1, 3] as const

interface Linha {
  readonly tipo: TipoComTextura
  readonly nome: string
  readonly lado: LadoDoMovel
  readonly casasW: number
  readonly casasH: number
  readonly materiais: readonly (readonly OpcaoDeMaterial[])[]
  readonly forma?: FormaDoTapete
  readonly curva?: number
}

/** Tamanho padrão de cada tipo e vista (`lib/mobilia.ts`). A fonte da folha só tem letras, '+' e os dígitos 1 e 3. */
const LINHAS: readonly Linha[] = [
  { tipo: 'barril', nome: 'BARRIL', lado: 'frente', casasW: 0.7, casasH: 0.7, materiais: [['carvalho', 'ferro'], ['nogueira', 'latao'], ['velha', 'ferro']] },
  { tipo: 'caixa', nome: 'CAIXA', lado: 'frente', casasW: 0.8, casasH: 0.8, materiais: [['pinho'], ['cerejeira'], ['nogueira']] },
  { tipo: 'bau', nome: 'BAU', lado: 'frente', casasW: 1, casasH: 0.6, materiais: [['nogueira', 'latao'], ['carvalho', 'ferro'], ['cerejeira', 'latao']] },
  { tipo: 'bau', nome: 'BAU DE LADO', lado: 'lado', casasW: 0.6, casasH: 0.6, materiais: [['nogueira', 'latao'], ['pinho', 'ferro'], ['velha', 'latao']] },
  { tipo: 'catre', nome: 'CAMA', lado: 'frente', casasW: 1, casasH: 2, materiais: [['carvalho', 'vinho', 'linho'], ['nogueira', 'azul', 'musgo'], ['pinho', 'ocre', 'vinho']] },
  { tipo: 'mesa', nome: 'MESA', lado: 'frente', casasW: 2, casasH: 1, materiais: [['carvalho'], ['nogueira'], ['velha']] },
  { tipo: 'cadeira', nome: 'CADEIRA', lado: 'frente', casasW: 0.5, casasH: 0.5, materiais: [['carvalho', 'palha'], ['nogueira', 'mesma'], ['pinho', 'palha']] },
  { tipo: 'cadeira', nome: 'CADEIRA DE LADO', lado: 'lado', casasW: 0.5, casasH: 0.75, materiais: [['carvalho', 'palha'], ['nogueira', 'mesma'], ['cerejeira', 'palha']] },
  { tipo: 'cerca', nome: 'CERCA', lado: 'frente', casasW: 2, casasH: 0.25, materiais: [['carvalho', 'varas'], ['nogueira', 'corda'], ['velha', 'arame']] },
  { tipo: 'cerca', nome: 'CERCA CURVA', lado: 'frente', casasW: 3, casasH: 0.25, curva: 90, materiais: [['carvalho', 'varas'], ['pinho', 'corda'], ['velha', 'arame']] },
  { tipo: 'armario', nome: 'ARMARIO', lado: 'frente', casasW: 1, casasH: 0.5, materiais: [['pinho', 'ferro'], ['nogueira', 'latao'], ['velha', 'ferro']] },
  { tipo: 'armario', nome: 'ARMARIO DE LADO', lado: 'lado', casasW: 1, casasH: 1.5, materiais: [['pinho', 'ferro'], ['nogueira', 'latao'], ['velha', 'latao']] },
  { tipo: 'aparador', nome: 'APARADOR', lado: 'frente', casasW: 2, casasH: 0.5, materiais: [['nogueira', 'latao'], ['cerejeira', 'latao'], ['velha', 'ferro']] },
  { tipo: 'aparador', nome: 'APARADOR DE LADO', lado: 'lado', casasW: 2, casasH: 0.9, materiais: [['nogueira', 'latao'], ['pinho', 'ferro'], ['velha', 'latao']] },
  { tipo: 'fogueira', nome: 'FOGUEIRA', lado: 'frente', casasW: 1, casasH: 1, materiais: [['granito', 'lenhaCarvalho'], ['arenito', 'lenhaPinho'], ['ardosia', 'lenhaBetula']] },
  { tipo: 'fogueira', nome: 'FOGUEIRA DE LADO', lado: 'lado', casasW: 1, casasH: 1.25, materiais: [['granito', 'lenhaCarvalho'], ['arenito', 'lenhaPinho'], ['ardosia', 'lenhaBetula']] },
  { tipo: 'tapete', nome: 'TAPETE', lado: 'frente', casasW: 3, casasH: 2, materiais: [['azul'], ['vinho'], ['linho']] },
  { tipo: 'tapete', nome: 'TAPETE REDONDO', lado: 'frente', casasW: 2, casasH: 2, forma: 'redondo', materiais: [['ocre'], ['musgo'], ['azul']] },
  { tipo: 'tapete', nome: 'TAPETE DE LADO', lado: 'lado', casasW: 3, casasH: 0.25, materiais: [['azul'], ['vinho'], ['linho']] },
]

/** Como o app desenha: o objeto no tamanho padrão (grade de 50 px), sem cor gravada (os materiais padrão), e a semente da chave. */
const NO_APP: readonly { readonly rotulo: string; readonly prop: Prop }[] = [
  { rotulo: 'FOGUEIRA COMO O APP DESENHA', prop: { id: 'f', src: '', x: 0, y: 0, width: 50, height: 50, linkedMapPath: null, mobilia: 'fogueira' } },
  { rotulo: 'CERCA CURVA COMO O APP DESENHA', prop: { id: 'c', src: '', x: 0, y: 0, width: 150, height: 12.5, linkedMapPath: null, mobilia: 'cerca', mobiliaCurva: 120 } },
]

function desenhoDoApp(prop: Prop, nivel: number): DesenhoDoMovel {
  const chave = chaveDoMovel(prop, nivel, 1)
  if (chave === null) throw new Error('o móvel perdeu o desenho com textura')
  return chave.desenho
}

it.skipIf(!PEDIDA)('gera a folha de contato dos 11 móveis (e as vistas de lado, a cerca curva e o tapete redondo) x 3 materiais x 2 níveis', () => {
  const linhas = LINHAS.map((linha) => ({
    celulas: linha.materiais.map((materiais) => ({
      rotulo: `${linha.nome} ${materiais.join('+').toUpperCase()}`,
      imagens: NIVEIS.map((nivel) => pintarMovel({ tipo: linha.tipo, lado: linha.lado, materiais, casasW: linha.casasW, casasH: linha.casasH, semente: 7, forma: linha.forma, curva: linha.curva }, escalaDoNivel(nivel))),
    })),
  }))
  linhas.push({ celulas: NO_APP.map(({ rotulo, prop }) => ({ rotulo, imagens: NIVEIS.map((nivel) => pintarMovel(desenhoDoApp(prop, nivel), escalaDoNivel(nivel))) })) })
  /** Cada nível ocupa a largura da imagem ou a do letreiro "NIVEL n", a maior. */
  const colunaDe = (W: number): number => Math.max(W, 'NIVEL 1'.length * 6 * ESCALA_DA_LETRA)
  type Celula = (typeof linhas)[number]['celulas'][number]
  const larguraDaCelula = (c: Celula): number => Math.max(c.imagens.reduce((s, im) => s + colunaDe(im.limites.W), 0) + VAO, c.rotulo.length * 6 * ESCALA_DA_LETRA)
  const larguras = linhas.map((l) => l.celulas.reduce((s, c) => s + larguraDaCelula(c) + VAO * 2, 0))
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
      x += larguraDaCelula(celula) + VAO * 2
    }
    y += alturas[li]
  })
  const png = emPng(tela)
  writeFileSync(DESTINO, png)
  expect(png.length).toBeGreaterThan(0)
})
