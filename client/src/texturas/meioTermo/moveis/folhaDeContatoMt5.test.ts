import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { Prop } from '../../../types/map'
import { chaveDoMovel } from '../../../pixi/rasterDosMoveis'
import { MATERIAIS } from '../materiais'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel } from './index'
import { colar, emPng, escrever, novaTela } from './folhaDeContato.testkit'

/**
 * FOLHA DE CONTATO da fatia MT5: as 5 peças novas do lote 2 como o APP as
 * desenha (a semente da chave, o material gravado ou o padrão): a sebe reta nas
 * duas folhas, curva para os dois lados e comprida, a jardineira em 3 madeiras
 * e esticada, o arco em 2 pares de madeira, a placa de seta em 2 madeiras e o
 * tapete longo em 3 comprimentos (3, 4 e 7 casas) e deitado. Cada quadro tem a
 * peça no nível 1 e no nível 3, no chão padrão do app (#a8776a), e embaixo o
 * tempo de gerar cada imagem (ms, nesta máquina e nesta rodada). A árvore
 * redonda é carimbo (canvas do navegador) e não entra: ela aparece no e2e.
 * Grava `docs/design/objetos/provas/mt5-folha-de-contato.png`.
 *
 * Só roda quando pedida (prova para o usuário, não teste de regressão):
 * `GERAR_FOLHA_MT5=1 npx vitest run src/texturas/meioTermo/moveis/folhaDeContatoMt5.test.ts`.
 */

const DESTINO = '../docs/design/objetos/provas/mt5-folha-de-contato.png'
const PEDIDA = import.meta.env.GERAR_FOLHA_MT5 === '1'
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

function peca(mobilia: NonNullable<Prop['mobilia']>, casasW: number, casasH: number, extra: Partial<Prop> = {}): Prop {
  return { id: `p-${mobilia}`, src: '', x: 0, y: 0, width: casasW * CASA, height: casasH * CASA, linkedMapPath: null, mobilia, ...extra }
}

/** A fonte da folha só tem maiúsculas, dígitos, '+', ',' e '/'. */
const QUADROS: readonly { readonly rotulo: string; readonly prop: Prop }[] = [
  { rotulo: 'SEBE BUXO', prop: peca('sebe', 2, 0.5) },
  { rotulo: 'SEBE ALFENEIRO', prop: peca('sebe', 2, 0.5, { mobiliaCor: MATERIAIS.alfeneiro.hex }) },
  { rotulo: 'SEBE 4 CASAS CURVA 90', prop: peca('sebe', 4, 0.5, { mobiliaCurva: 90 }) },
  { rotulo: 'SEBE 3 CASAS CURVA 150', prop: peca('sebe', 3, 0.5, { mobiliaCurva: -150, mobiliaCor: MATERIAIS.alfeneiro.hex }) },
  { rotulo: 'JARDINEIRA NOGUEIRA', prop: peca('jardineira', 1, 0.5) },
  { rotulo: 'JARDINEIRA PINHO', prop: peca('jardineira', 1, 0.5, { mobiliaCor: MATERIAIS.pinho.hex }) },
  { rotulo: 'JARDINEIRA 2 CASAS', prop: peca('jardineira', 2, 0.5, { mobiliaCor: MATERIAIS.velha.hex }) },
  { rotulo: 'ARCO NOGUEIRA+PINHO', prop: peca('arcoDoPortao', 2, 0.5) },
  { rotulo: 'ARCO VELHA', prop: peca('arcoDoPortao', 2, 0.5, { mobiliaCor: MATERIAIS.velha.hex, mobiliaCorDaLinha: MATERIAIS.velha.hex }) },
  { rotulo: 'PLACA PINHO', prop: peca('placaDeSeta', 0.5, 0.5) },
  { rotulo: 'PLACA NOGUEIRA', prop: peca('placaDeSeta', 0.5, 0.5, { mobiliaCor: MATERIAIS.nogueira.hex }) },
  { rotulo: 'PLACA VELHA', prop: peca('placaDeSeta', 0.5, 0.5, { mobiliaCor: MATERIAIS.velha.hex }) },
  { rotulo: 'TAPETE LONGO 1X3', prop: peca('tapeteLongo', 1, 3) },
  { rotulo: 'TAPETE LONGO 1X4 AZUL', prop: peca('tapeteLongo', 1, 4, { mobiliaCor: MATERIAIS.azul.hex }) },
  { rotulo: 'TAPETE LONGO 1X7 LINHO', prop: peca('tapeteLongo', 1, 7, { mobiliaCor: MATERIAIS.linho.hex }) },
  { rotulo: 'TAPETE LONGO 4X1 OCRE', prop: peca('tapeteLongo', 4, 1, { mobiliaCor: MATERIAIS.ocre.hex }) },
]

function desenhoDoApp(prop: Prop, nivel: number): DesenhoDoMovel {
  const chave = chaveDoMovel(prop, nivel, 1)
  if (chave === null) throw new Error(`${prop.mobilia}: sem desenho com textura`)
  return chave.desenho
}

function emMs(ms: number): string {
  return ms.toFixed(1).replace('.', ',')
}

it.skipIf(!PEDIDA)('gera a folha de contato das 5 peças do lote 2 (16 quadros), cada uma a 1x e a 3x com o tempo embaixo', () => {
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
  expect(quadros).toHaveLength(16)
  expect(png.length).toBeGreaterThan(0)
})
