import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { Prop, TipoMobilia } from '../../../types/map'
import { criarMovel } from '../../../lib/mobilia'
import { TIPOS_MOBILIA } from '../../../lib/mobilia/tipos'
import { chaveDoMovel } from '../../../pixi/rasterDosMoveis'
import { MATERIAIS } from '../materiais'
import { escalaDoNivel, pintarMovel } from './index'
import { colar, emPng, escrever, novaTela, type Tela } from './folhaDeContato.testkit'

/**
 * FOLHA DE CONTATO da VISTA 3/4 (MT11), para o usuário aprovar: 16 quadros,
 * cada um com os móveis "de cima" (a fileira de cima) e em 3/4 (a de baixo),
 * lado a lado, como o APP os pede (`chaveDoMovel`, semente do app, o hex
 * oficial do material no campo de cor), no nível 2 (zoom 200%). Os 25 tipos do
 * catálogo (o teste falha se faltar um), as 3 madeiras onde há madeira, as
 * mesas nas 3 formas, a cama e a mesa giradas um quarto de volta, e o chão
 * claro (o padrão do app) e o escuro. Embaixo de cada quadro, o tempo de
 * gerar as imagens 3/4 dele no nível 3 (Node, esta máquina, esta rodada).
 * Grava `docs/design/objetos/provas/mt11-folha-de-contato.png`.
 *
 * Só roda quando pedida: `GERAR_FOLHA_MT11=1 npx vitest run src/texturas/meioTermo/moveis/folhaDeContatoMt11.test.ts`.
 */

const DESTINO = '../docs/design/objetos/provas/mt11-folha-de-contato.png'
const PEDIDA = import.meta.env.GERAR_FOLHA_MT11 === '1'
const CASA = 50
const NIVEL_DA_FOLHA = 2
const NIVEL_DO_TEMPO = 3
type Rgb = readonly [number, number, number]
const FUNDO: Rgb = [0x2a, 0x24, 0x20]
const CHAO_CLARO: Rgb = [0xa8, 0x77, 0x6a]
const CHAO_ESCURO: Rgb = [0x4a, 0x40, 0x38]
const TINTA: Rgb = [0xee, 0xe4, 0xd8]
const APAGADA: Rgb = [0xb0, 0xa4, 0x96]
const MARGEM = 24
const VAO = 16
const ESCALA_DA_LETRA = 2
const LINHA = 7 * ESCALA_DA_LETRA + 8
const COLUNAS = 4

interface Item {
  readonly prop: Prop
}

interface Quadro {
  readonly titulo: string
  readonly itens: readonly Item[]
  readonly escuro?: boolean
}

function movel(tipo: TipoMobilia, extra: Partial<Prop> = {}): Item {
  return { prop: { ...criarMovel(tipo, { x: 0, y: 0 }, CASA, `f-${tipo}-${JSON.stringify(extra)}`), ...extra } }
}

function madeira(id: 'carvalho' | 'nogueira' | 'velha'): Partial<Prop> {
  return { mobiliaCor: MATERIAIS[id].hex }
}

const TRES_MADEIRAS = [madeira('carvalho'), madeira('nogueira'), madeira('velha')]

const QUADROS: readonly Quadro[] = [
  { titulo: 'BARRIL: CARVALHO, NOGUEIRA, VELHA', itens: TRES_MADEIRAS.map((m) => movel('barril', m)) },
  { titulo: 'CAIXA: 3 MADEIRAS', itens: TRES_MADEIRAS.map((m) => movel('caixa', m)) },
  { titulo: 'BAU: 3 MADEIRAS', itens: TRES_MADEIRAS.map((m) => movel('bau', m)) },
  { titulo: 'CAMA, CADEIRA E CADEIRA DE LADO', itens: [movel('catre'), movel('cadeira'), movel('cadeira', { mobiliaVista: 'lado' })] },
  { titulo: 'MESA 2X1: 3 MADEIRAS', itens: TRES_MADEIRAS.map((m) => movel('mesa', { ...m, width: 100, height: 50 })) },
  { titulo: 'MESA QUADRADA: 3 MADEIRAS', itens: TRES_MADEIRAS.map((m) => movel('mesaQuadrada', m)) },
  { titulo: 'MESA REDONDA: 3 MADEIRAS', itens: TRES_MADEIRAS.map((m) => movel('mesaRedonda', m)) },
  { titulo: 'ARMARIO, APARADOR E ARMARIO DE LADO', itens: [movel('armario'), movel('aparador'), movel('armario', { mobiliaVista: 'lado' })] },
  { titulo: 'CERCA, CERCA CURVA, SEBE', itens: [movel('cerca'), movel('cerca', { mobiliaCurva: 90 }), movel('sebe')] },
  { titulo: 'FOGUEIRA, TAPETES', itens: [movel('fogueira'), movel('tapete'), movel('tapete', { mobiliaForma: 'redondo' }), movel('tapeteLongo')] },
  { titulo: 'LAPIDE, VASO, LAMPIAO, QUADRO', itens: [movel('lapide'), movel('vaso'), movel('lampiao'), movel('quadroDeAvisos')] },
  { titulo: 'POCO, BARRACA, CARROCA', itens: [movel('poco'), movel('barraca'), movel('carroca')] },
  { titulo: 'JARDINEIRA, ARCO, PLACA GIRADA 90', itens: [movel('jardineira'), movel('arcoDoPortao'), movel('placaDeSeta', { rotation: 90 })] },
  { titulo: 'GIRO 90: CAMA, MESA 2X1, BAU', itens: [movel('catre', { rotation: 90 }), movel('mesa', { width: 100, height: 50, rotation: 90 }), movel('bau', { rotation: 90 })] },
  { titulo: 'CHAO ESCURO: BARRIL, MESA, CAMA', escuro: true, itens: [movel('barril', madeira('nogueira')), movel('mesaRedonda', madeira('nogueira')), movel('catre')] },
  { titulo: 'CHAO ESCURO: CERCA, FOGUEIRA, LAMPIAO', escuro: true, itens: [movel('cerca'), movel('fogueira'), movel('lampiao')] },
]

interface Pintada {
  readonly px: Uint8ClampedArray
  readonly W: number
  readonly H: number
  /** Canto da imagem em relação ao centro do móvel, em pixels da folha. */
  readonly x0: number
  readonly y0: number
}

function pintar(prop: Prop, vista: 'tres-quartos' | undefined, nivel: number): Pintada {
  const chave = chaveDoMovel(prop, nivel, 1, vista)
  if (chave === null) throw new Error(`${prop.mobilia}: sem desenho`)
  const S = escalaDoNivel(nivel)
  const { limites, pixels } = pintarMovel(chave.desenho, S)
  return { px: pixels, W: limites.W, H: limites.H, x0: Math.round(limites.x0 * S), y0: Math.round(limites.y0 * S) }
}

function retangulo(tela: Tela, x: number, y: number, w: number, h: number, cor: Rgb): void {
  for (let j = Math.max(0, y); j < Math.min(tela.altura, y + h); j += 1) {
    for (let i = Math.max(0, x); i < Math.min(tela.largura, x + w); i += 1) {
      const d = (j * tela.largura + i) * 3
      tela.rgb[d] = cor[0]
      tela.rgb[d + 1] = cor[1]
      tela.rgb[d + 2] = cor[2]
    }
  }
}

interface Montado {
  readonly quadro: Quadro
  readonly deCima: readonly Pintada[]
  readonly tres: readonly Pintada[]
  readonly ms: number
  readonly largura: number
  readonly alturaDeCima: number
  readonly alturaTres: number
}

/** Largura de uma coluna do quadro: cabe a imagem nas duas vistas, centrada no móvel. */
function meiaLargura(p: Pintada): number {
  return Math.max(-p.x0, p.W + p.x0)
}

function montar(quadro: Quadro): Montado {
  const deCima = quadro.itens.map((it) => pintar(it.prop, undefined, NIVEL_DA_FOLHA))
  const tres = quadro.itens.map((it) => pintar(it.prop, 'tres-quartos', NIVEL_DA_FOLHA))
  const inicio = performance.now()
  for (const it of quadro.itens) pintar(it.prop, 'tres-quartos', NIVEL_DO_TEMPO)
  const ms = performance.now() - inicio
  const colunas = quadro.itens.map((_it, i) => 2 * Math.max(meiaLargura(deCima[i]), meiaLargura(tres[i])))
  const largura = colunas.reduce((a, b) => a + b, 0) + VAO * (colunas.length + 1)
  const altura = (ps: readonly Pintada[]): number => Math.max(...ps.map((p) => 2 * Math.max(-p.y0, p.H + p.y0)))
  return { quadro, deCima, tres, ms, largura, alturaDeCima: altura(deCima), alturaTres: altura(tres) }
}

it.skipIf(!PEDIDA)('gera a folha de contato da MT11 (16 quadros, os 25 tipos)', () => {
  const tipos = new Set(QUADROS.flatMap((q) => q.itens.map((it) => it.prop.mobilia)))
  expect(TIPOS_MOBILIA.filter((t) => !tipos.has(t))).toEqual([])
  expect(QUADROS.length).toBeGreaterThanOrEqual(12)
  expect(QUADROS.length).toBeLessThanOrEqual(16)
  const montados = QUADROS.map(montar)
  const larguraDaColuna = Math.max(...montados.map((m) => m.largura))
  const linhas: Montado[][] = []
  for (let i = 0; i < montados.length; i += COLUNAS) linhas.push(montados.slice(i, i + COLUNAS))
  const alturaDoQuadro = (m: Montado): number => LINHA + m.alturaDeCima + VAO + m.alturaTres + LINHA + VAO
  const alturas = linhas.map((l) => Math.max(...l.map(alturaDoQuadro)))
  const largura = MARGEM * 2 + COLUNAS * larguraDaColuna + (COLUNAS - 1) * VAO
  const altura = MARGEM * 2 + LINHA * 2 + alturas.reduce((a, b) => a + b + VAO, 0)
  const tela = novaTela(largura, altura, FUNDO)
  escrever(tela, 'MT11 VISTA 3/4: EM CADA QUADRO, EM CIMA DE CIMA E EMBAIXO 3/4 (ZOOM 200%). TEMPO = AS 3/4 DO QUADRO NO NIVEL 3', MARGEM, MARGEM, ESCALA_DA_LETRA, TINTA)
  let y = MARGEM + LINHA * 2
  linhas.forEach((linha, li) => {
    linha.forEach((m, ci) => {
      const x = MARGEM + ci * (larguraDaColuna + VAO)
      retangulo(tela, x, y, larguraDaColuna, alturas[li], m.quadro.escuro === true ? CHAO_ESCURO : CHAO_CLARO)
      escrever(tela, m.quadro.titulo, x + 8, y + 6, ESCALA_DA_LETRA, m.quadro.escuro === true ? TINTA : [0x24, 0x1c, 0x18])
      let cx = x + VAO
      m.quadro.itens.forEach((_it, i) => {
        const meia = Math.max(meiaLargura(m.deCima[i]), meiaLargura(m.tres[i]))
        const centro = cx + meia
        const yCima = y + LINHA + m.alturaDeCima / 2
        const yTres = y + LINHA + m.alturaDeCima + VAO + m.alturaTres / 2
        colar(tela, m.deCima[i].px, m.deCima[i].W, m.deCima[i].H, Math.round(centro + m.deCima[i].x0), Math.round(yCima + m.deCima[i].y0))
        colar(tela, m.tres[i].px, m.tres[i].W, m.tres[i].H, Math.round(centro + m.tres[i].x0), Math.round(yTres + m.tres[i].y0))
        cx += 2 * meia + VAO
      })
      const rodape = `${m.quadro.itens.length} ITENS EM 3/4 NO NIVEL 3: ${m.ms.toFixed(1)} MS`
      escrever(tela, rodape, x + 8, y + alturas[li] - LINHA, ESCALA_DA_LETRA, m.quadro.escuro === true ? APAGADA : [0x55, 0x40, 0x38])
    })
    y += alturas[li] + VAO
  })
  writeFileSync(DESTINO, emPng(tela))
})
