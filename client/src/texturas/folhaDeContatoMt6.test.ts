import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { PontoDoTelhado } from '../lib/telhado/aguas'
import { PALETA_DO_TETO, type ModeloDoTeto } from '../lib/telhado/paletas'
import { pintarTelhado } from './telhado'
import { colar, emPng, escrever, novaTela } from './meioTermo/moveis/folhaDeContato.testkit'

/**
 * FOLHA DE CONTATO da fatia MT6: o telhado de palha em 3 escalas da textura
 * (0,5x, 1x e 3x pixels por px do mapa) AO LADO da telha barro na mesma
 * escala, a madeira para comparar, as 6 cores da palha, a sala em L, uma cor
 * livre e uma sala comprida. Fundo: a grama do mapa (#56693f), onde o telhado
 * mora. Embaixo de cada quadro, o tempo de pintar a imagem (ms, nesta máquina e
 * nesta rodada, uma medida só). O app pinta a textura a 1x (ou menos, em sala
 * enorme) e a câmera amplia; a 3x aqui é o detalhe que a imagem teria.
 * Grava `docs/design/objetos/provas/mt6-folha-de-contato.png`.
 *
 * Só roda quando pedida (prova para o usuário, não teste de regressão):
 * `GERAR_FOLHA_MT6=1 npx vitest run src/texturas/folhaDeContatoMt6.test.ts`.
 */

const DESTINO = '../docs/design/objetos/provas/mt6-folha-de-contato.png'
const PEDIDA = import.meta.env.GERAR_FOLHA_MT6 === '1'
const GRAMA: readonly [number, number, number] = [0x56, 0x69, 0x3f]
const TINTA: readonly [number, number, number] = [0xf2, 0xea, 0xd8]
const MARGEM = 24
const VAO = 22
const ESCALA_DA_LETRA = 2
const ALTURA_DA_LETRA = 7 * ESCALA_DA_LETRA + 8
const POR_LINHA = 4
const CASA = 50

function sala(casasW: number, casasH: number): readonly PontoDoTelhado[] {
  return [{ x: 0, y: 0 }, { x: casasW * CASA, y: 0 }, { x: casasW * CASA, y: casasH * CASA }, { x: 0, y: casasH * CASA }]
}
const EL: readonly PontoDoTelhado[] = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 200 }, { x: 0, y: 200 }]
const CASA_4X3 = sala(4, 3)
const COR = Object.fromEntries(PALETA_DO_TETO.palha.map((c) => [c.id, c.hex]))
const BARRO = PALETA_DO_TETO.telhas[0].hex

/** A fonte da folha só tem maiúsculas, dígitos, '+', ',' e '/'. */
const QUADROS: readonly { rotulo: string; poligono: readonly PontoDoTelhado[]; modelo: ModeloDoTeto; cor: string; escala: number }[] = [
  { rotulo: 'PALHA 0,5X', poligono: CASA_4X3, modelo: 'palha', cor: COR.palha, escala: 0.5 },
  { rotulo: 'TELHAS BARRO 0,5X', poligono: CASA_4X3, modelo: 'telhas', cor: BARRO, escala: 0.5 },
  { rotulo: 'PALHA 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR.palha, escala: 1 },
  { rotulo: 'TELHAS BARRO 1X', poligono: CASA_4X3, modelo: 'telhas', cor: BARRO, escala: 1 },
  { rotulo: 'PALHA 3X', poligono: CASA_4X3, modelo: 'palha', cor: COR.palha, escala: 3 },
  { rotulo: 'TELHAS BARRO 3X', poligono: CASA_4X3, modelo: 'telhas', cor: BARRO, escala: 3 },
  { rotulo: 'MADEIRA CARVALHO 1X', poligono: CASA_4X3, modelo: 'madeira', cor: PALETA_DO_TETO.madeira[0].hex, escala: 1 },
  { rotulo: 'PALHA EM L 1X', poligono: EL, modelo: 'palha', cor: COR.palha, escala: 1 },
  { rotulo: 'PALHA CLARA 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR['palha-clara'], escala: 1 },
  { rotulo: 'FENO 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR.feno, escala: 1 },
  { rotulo: 'SAPE 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR.sape, escala: 1 },
  { rotulo: 'PALHA VELHA 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR['palha-velha'], escala: 1 },
  { rotulo: 'PALHA COM MUSGO 1X', poligono: CASA_4X3, modelo: 'palha', cor: COR.musgo, escala: 1 },
  { rotulo: 'PALHA COR LIVRE 1X', poligono: CASA_4X3, modelo: 'palha', cor: '#b8865a', escala: 1 },
  { rotulo: 'PALHA 7 X 2 CASAS 1X', poligono: sala(7, 2), modelo: 'palha', cor: COR.palha, escala: 1 },
  { rotulo: 'PALHA EM L 3X', poligono: EL, modelo: 'palha', cor: COR.feno, escala: 3 },
]

function emMs(ms: number): string {
  return ms.toFixed(1).replace('.', ',')
}

it.skipIf(!PEDIDA)('gera a folha de contato da palha (16 quadros, 3 escalas, ao lado das telhas) com o tempo embaixo', () => {
  const quadros = QUADROS.map((q) => {
    const t0 = performance.now()
    const img = pintarTelhado(q.poligono, q.modelo, q.cor, q.escala)
    return { ...q, img, tempo: `T ${emMs(performance.now() - t0)} MS` }
  })
  const larguraDe = (q: (typeof quadros)[number]): number => Math.max(q.img.largura, q.rotulo.length * 6 * ESCALA_DA_LETRA, q.tempo.length * 6 * ESCALA_DA_LETRA)
  const alturaDe = (q: (typeof quadros)[number]): number => q.img.altura + ALTURA_DA_LETRA * 2 + VAO
  const linhas: (typeof quadros)[] = []
  for (let i = 0; i < quadros.length; i += POR_LINHA) linhas.push(quadros.slice(i, i + POR_LINHA))
  const largura = Math.max(...linhas.map((l) => l.reduce((s, q) => s + larguraDe(q) + VAO * 2, 0)))
  const altura = linhas.reduce((s, l) => s + Math.max(...l.map(alturaDe)), 0)
  const tela = novaTela(largura + MARGEM * 2, altura + MARGEM * 2, GRAMA)
  let y = MARGEM
  for (const linha of linhas) {
    let x = MARGEM
    for (const q of linha) {
      escrever(tela, q.rotulo, x, y, ESCALA_DA_LETRA, TINTA)
      colar(tela, q.img.pixels, q.img.largura, q.img.altura, x, y + ALTURA_DA_LETRA)
      escrever(tela, q.tempo, x, y + ALTURA_DA_LETRA + q.img.altura + 6, ESCALA_DA_LETRA, TINTA)
      x += larguraDe(q) + VAO * 2
    }
    y += Math.max(...linha.map(alturaDe))
  }
  const png = emPng(tela)
  writeFileSync(DESTINO, png)
  expect(quadros).toHaveLength(16)
  expect(png.length).toBeGreaterThan(0)
})
