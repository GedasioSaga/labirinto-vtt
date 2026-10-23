import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { Prop } from '../../../types/map'
import { chaveDoMovel } from '../../../pixi/rasterDosMoveis'
import type { OpcaoDeMaterial } from '../materiais'
import type { LadoDoMovel } from './contexto'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel, type TipoComTextura } from './index'
import { colar, emPng, escrever, novaTela } from './folhaDeContato.testkit'

/**
 * FOLHA DE CONTATO da fatia MT2: os 6 móveis "de cima com volume" em 3
 * materiais (o baú e a cadeira também de lado), cada um no nível 1 e no nível
 * 3 lado a lado, no chão padrão do app (#a8776a), com o tipo e os materiais
 * escritos em cima; na última linha, o baú padrão como o app o desenha (o
 * objeto de 50 x 30 px e a semente da chave). Grava
 * `docs/design/objetos/provas/mt2-folha-de-contato.png`.
 *
 * Só roda quando pedida (a folha é prova para o usuário, não teste de
 * regressão): `GERAR_FOLHA_MT2=1 npx vitest run src/texturas/meioTermo/moveis/folhaDeContato.test.ts`.
 */

/** Relativo à pasta em que o vitest roda (`client/`); o ambiente jsdom não dá `import.meta.url` de arquivo. */
const DESTINO = '../docs/design/objetos/provas/mt2-folha-de-contato.png'
/** No vitest, `import.meta.env` traz as variáveis do ambiente do processo. */
const PEDIDA = import.meta.env.GERAR_FOLHA_MT2 === '1'
const CHAO: readonly [number, number, number] = [0xa8, 0x77, 0x6a]
const TINTA: readonly [number, number, number] = [0x24, 0x1c, 0x18]
const MARGEM = 24
const VAO = 18
const ESCALA_DA_LETRA = 2
const ALTURA_DO_ROTULO = 7 * ESCALA_DA_LETRA + 8

interface Linha {
  readonly tipo: TipoComTextura
  readonly nome: string
  readonly lado: LadoDoMovel
  readonly casasW: number
  readonly casasH: number
  readonly materiais: readonly (readonly OpcaoDeMaterial[])[]
}

/** Tamanho padrão de cada tipo (`lib/mobilia.ts`), exato como o desenho usa; mais as duas vistas de lado. */
const LINHAS: readonly Linha[] = [
  { tipo: 'barril', nome: 'BARRIL', lado: 'frente', casasW: 0.7, casasH: 0.7, materiais: [['carvalho', 'ferro'], ['nogueira', 'latao'], ['velha', 'ferro']] },
  { tipo: 'caixa', nome: 'CAIXA', lado: 'frente', casasW: 0.8, casasH: 0.8, materiais: [['pinho'], ['cerejeira'], ['nogueira']] },
  { tipo: 'bau', nome: 'BAU', lado: 'frente', casasW: 1, casasH: 0.6, materiais: [['nogueira', 'latao'], ['carvalho', 'ferro'], ['cerejeira', 'latao']] },
  { tipo: 'bau', nome: 'BAU DE LADO', lado: 'lado', casasW: 0.6, casasH: 0.6, materiais: [['nogueira', 'latao'], ['pinho', 'ferro'], ['velha', 'latao']] },
  { tipo: 'catre', nome: 'CAMA', lado: 'frente', casasW: 1, casasH: 2, materiais: [['carvalho', 'vinho', 'linho'], ['nogueira', 'azul', 'musgo'], ['pinho', 'ocre', 'vinho']] },
  { tipo: 'mesa', nome: 'MESA', lado: 'frente', casasW: 2, casasH: 1, materiais: [['carvalho'], ['nogueira'], ['velha']] },
  { tipo: 'cadeira', nome: 'CADEIRA', lado: 'frente', casasW: 0.5, casasH: 0.5, materiais: [['carvalho', 'palha'], ['nogueira', 'mesma'], ['pinho', 'palha']] },
  { tipo: 'cadeira', nome: 'CADEIRA DE LADO', lado: 'lado', casasW: 0.5, casasH: 0.75, materiais: [['carvalho', 'palha'], ['nogueira', 'mesma'], ['cerejeira', 'palha']] },
]

const NIVEIS = [1, 3] as const

/** O baú padrão como o app o desenha: o objeto de 50 x 30 px no mapa e a semente que a chave dá (o hash do desenho). */
const BAU_DO_APP: Prop = { id: 'bau', src: '', x: 0, y: 0, width: 50, height: 30, linkedMapPath: null, mobilia: 'bau' }

function desenhoDoApp(nivel: number): DesenhoDoMovel {
  const chave = chaveDoMovel(BAU_DO_APP, nivel, 1)
  if (chave === null) throw new Error('o baú perdeu o desenho com textura')
  return chave.desenho
}

it.skipIf(!PEDIDA)('gera a folha de contato dos 6 móveis (e 2 de lado) x 3 materiais x 2 níveis, mais o baú como o app desenha', () => {
  const linhas = LINHAS.map((linha) => ({
    ...linha,
    celulas: linha.materiais.map((materiais) => ({
      rotulo: `${linha.nome} ${materiais.join('+').toUpperCase()}`,
      imagens: NIVEIS.map((nivel) => pintarMovel({ tipo: linha.tipo, lado: linha.lado, materiais, casasW: linha.casasW, casasH: linha.casasH, semente: 7 }, escalaDoNivel(nivel))),
    })),
  }))
  linhas.push({
    tipo: 'bau',
    nome: 'BAU NO APP',
    lado: 'frente',
    casasW: 1,
    casasH: 0.6,
    materiais: [],
    // A fonte de bitmap só tem as letras e os dígitos 1 e 3: o tamanho fica no nome do teste, não no letreiro.
    celulas: [{ rotulo: 'BAU COMO O APP DESENHA', imagens: NIVEIS.map((nivel) => pintarMovel(desenhoDoApp(nivel), escalaDoNivel(nivel))) }],
  })
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
