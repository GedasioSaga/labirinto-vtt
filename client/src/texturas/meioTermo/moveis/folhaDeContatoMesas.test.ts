import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { Prop } from '../../../types/map'
import { chaveDoMovel } from '../../../pixi/rasterDosMoveis'
import { MATERIAIS } from '../materiais'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel } from './index'
import { colar, emPng, escrever, novaTela } from './folhaDeContato.testkit'
import { pintarMesaAntiga } from './mesasAntigas.testkit'

/**
 * FOLHA DE CONTATO das MESAS (pedido de 24/10/2026: "falta a versão redonda,
 * a quadrada pode ser melhor, a mesa parece um móvel e não uma mesa"): as 3
 * formas (retangular 2 x 1, quadrada 1 x 1, redonda 1,25 x 1,25) em cada uma
 * das 3 madeiras (carvalho, nogueira, madeira velha), e a retangular esticada
 * para 3 x 1. Cada quadro tem o ANTES (o desenho até 24/10, mesma semente e
 * mesmo material) e o DEPOIS, cada um no nível 1 e no nível 3, como o APP os
 * pede (a semente da chave, o tom oficial do material no campo de cor), no
 * chão padrão do app (#a8776a). Embaixo, o tempo de gerar o DEPOIS no nível 1
 * e no nível 3, nesta máquina e nesta rodada (Node).
 * Grava `docs/design/objetos/provas/mt-mesas-folha-de-contato.png`.
 *
 * Só roda quando pedida (prova para o usuário, não teste de regressão):
 * `GERAR_FOLHA_MESAS=1 npx vitest run src/texturas/meioTermo/moveis/folhaDeContatoMesas.test.ts`.
 */

const DESTINO = '../docs/design/objetos/provas/mt-mesas-folha-de-contato.png'
const PEDIDA = import.meta.env.GERAR_FOLHA_MESAS === '1'
const CHAO: readonly [number, number, number] = [0xa8, 0x77, 0x6a]
const TINTA: readonly [number, number, number] = [0x24, 0x1c, 0x18]
const APAGADA: readonly [number, number, number] = [0x55, 0x40, 0x38]
const MARGEM = 24
const VAO = 14
const ENTRE_ANTES_E_DEPOIS = 40
const ESCALA_DA_LETRA = 2
const ALTURA_DA_LETRA = 7 * ESCALA_DA_LETRA + 8
const NIVEIS = [1, 3] as const
/** Px de mundo por casa do app (a grade de referência). */
const CASA = 50

type Madeira = 'carvalho' | 'nogueira' | 'velha'
const MADEIRAS: readonly Madeira[] = ['carvalho', 'nogueira', 'velha']
const NOME_DA_MADEIRA: Readonly<Record<Madeira, string>> = { carvalho: 'CARVALHO', nogueira: 'NOGUEIRA', velha: 'VELHA' }

const FORMAS = [
  { rotulo: 'MESA 2X1', tipo: 'mesa', casasW: 2, casasH: 1 },
  { rotulo: 'MESA QUADRADA', tipo: 'mesaQuadrada', casasW: 1, casasH: 1 },
  { rotulo: 'MESA REDONDA', tipo: 'mesaRedonda', casasW: 1.25, casasH: 1.25 },
  { rotulo: 'MESA 3X1', tipo: 'mesa', casasW: 3, casasH: 1 },
] as const

function peca(tipo: NonNullable<Prop['mobilia']>, casasW: number, casasH: number, madeira: Madeira): Prop {
  return { id: `p-${tipo}`, src: '', x: 0, y: 0, width: casasW * CASA, height: casasH * CASA, linkedMapPath: null, mobilia: tipo, mobiliaCor: MATERIAIS[madeira].hex }
}

function desenhoDoApp(prop: Prop, nivel: number): DesenhoDoMovel {
  const chave = chaveDoMovel(prop, nivel, 1)
  if (chave === null) throw new Error(`${prop.mobilia}: sem desenho com textura`)
  return chave.desenho
}

function emMs(ms: number): string {
  return ms.toFixed(1).replace('.', ',')
}

interface Imagem {
  readonly limites: { readonly W: number; readonly H: number }
  readonly pixels: Uint8ClampedArray
}

it.skipIf(!PEDIDA)('gera a folha de contato das mesas: 3 formas x 3 madeiras e a de 3 x 1, antes e depois, nos níveis 1 e 3, com o tempo embaixo', () => {
  const quadros = FORMAS.flatMap((forma) =>
    MADEIRAS.map((madeira) => {
      const prop = peca(forma.tipo, forma.casasW, forma.casasH, madeira)
      const antes: Imagem[] = NIVEIS.map((nivel) => pintarMesaAntiga(desenhoDoApp(prop, nivel), escalaDoNivel(nivel)))
      const tempos: number[] = []
      const depois: Imagem[] = NIVEIS.map((nivel) => {
        const d = desenhoDoApp(prop, nivel)
        const t0 = performance.now()
        const im = pintarMovel(d, escalaDoNivel(nivel))
        tempos.push(performance.now() - t0)
        return im
      })
      return { rotulo: `${forma.rotulo} ${NOME_DA_MADEIRA[madeira]}`, antes, depois, tempo: `DEPOIS 1X ${emMs(tempos[0])} MS / 3X ${emMs(tempos[1])} MS` }
    }),
  )
  const larguraDasImagens = (ims: readonly Imagem[]): number => ims.reduce((s, im) => s + im.limites.W + VAO, 0)
  const larguraDe = (q: (typeof quadros)[number]): number =>
    Math.max(larguraDasImagens(q.antes) + ENTRE_ANTES_E_DEPOIS + larguraDasImagens(q.depois), q.rotulo.length * 6 * ESCALA_DA_LETRA, q.tempo.length * 6 * ESCALA_DA_LETRA)
  const alturaDe = (q: (typeof quadros)[number]): number => Math.max(...[...q.antes, ...q.depois].map((im) => im.limites.H)) + ALTURA_DA_LETRA * 3 + VAO * 2
  const linhas: (typeof quadros)[] = []
  for (let i = 0; i < quadros.length; i += MADEIRAS.length) linhas.push(quadros.slice(i, i + MADEIRAS.length))
  const largura = Math.max(...linhas.map((l) => l.reduce((s, q) => s + larguraDe(q) + VAO * 3, 0)))
  const altura = linhas.reduce((s, l) => s + Math.max(...l.map(alturaDe)), 0)
  const tela = novaTela(largura + MARGEM * 2, altura + MARGEM * 2, CHAO)
  let y = MARGEM
  for (const linha of linhas) {
    const alturaDaLinha = Math.max(...linha.map(alturaDe))
    let x = MARGEM
    for (const q of linha) {
      escrever(tela, q.rotulo, x, y, ESCALA_DA_LETRA, TINTA)
      escrever(tela, 'ANTES', x, y + ALTURA_DA_LETRA, ESCALA_DA_LETRA, APAGADA)
      const xDepois = x + larguraDasImagens(q.antes) + ENTRE_ANTES_E_DEPOIS
      escrever(tela, 'DEPOIS', xDepois, y + ALTURA_DA_LETRA, ESCALA_DA_LETRA, TINTA)
      const alturaDasImagens = Math.max(...[...q.antes, ...q.depois].map((im) => im.limites.H))
      let xi = x
      for (const im of q.antes) {
        colar(tela, im.pixels, im.limites.W, im.limites.H, xi, y + ALTURA_DA_LETRA * 2)
        xi += im.limites.W + VAO
      }
      xi = xDepois
      for (const im of q.depois) {
        colar(tela, im.pixels, im.limites.W, im.limites.H, xi, y + ALTURA_DA_LETRA * 2)
        xi += im.limites.W + VAO
      }
      escrever(tela, q.tempo, x, y + ALTURA_DA_LETRA * 2 + alturaDasImagens + 6, ESCALA_DA_LETRA, TINTA)
      x += larguraDe(q) + VAO * 3
    }
    y += alturaDaLinha
  }
  const png = emPng(tela)
  writeFileSync(DESTINO, png)
  expect(quadros).toHaveLength(12)
  expect(png.length).toBeGreaterThan(0)
})
