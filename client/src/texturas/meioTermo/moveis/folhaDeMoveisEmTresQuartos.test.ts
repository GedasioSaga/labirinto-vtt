import { it, vi } from 'vitest'
import type { Prop, TipoMobilia } from '../../../types/map'
import { criarMovel } from '../../../lib/mobilia'
import { chaveDoMovel } from '../../../pixi/rasterDosMoveis'
import { escalaDoNivel, GRADE_DE_REFERENCIA, pintarMovel } from './index'
import { colar, emPng, escrever, novaTela, type Tela } from './folhaDeContato.testkit'

/**
 * FOLHA DE ANTES E DEPOIS do baú, do balcão, da geladeira e da pia (pedidos do
 * mestre de 15/11/2026: "a geladeira coloque a versão original de metal", "o
 * 3/4 do baú é estranho", "o balcão em 3/4 fica estranho" e "faz um rework da
 * pia também, [...] faz uma moderna"). Cada móvel como o APP o
 * pede (`chaveDoMovel`, tamanho e materiais de partida), de cima e em 3/4, nos
 * quatro giros (0, 90, 180 e 270 graus), no nível 2 (zoom 200%), sobre o chão
 * claro do app; embaixo, os mesmos desenhos a 25% de zoom (a imagem do nível 1
 * reduzida a um quarto, ampliada 3x para dar para ver os pixels).
 *
 * Em duas rodadas, de `C:/dev/labirinto/client`:
 *   FOLHA_MOVEIS_34=antes FOLHA_MOVEIS_34_PASTA=../tmp/moveis-3-4-2026-11-15/desenho rtk proxy npx vitest run src/texturas/meioTermo/moveis/folhaDeMoveisEmTresQuartos.test.ts
 * grava os desenhos do código de agora em `antes.bin`; depois da mudança, com
 * `FOLHA_MOVEIS_34=depois`, pinta de novo e junta os dois em `folha.png`. Sem a
 * variável o teste é pulado e o arquivo não faz nada.
 */

const MODO: unknown = import.meta.env.FOLHA_MOVEIS_34
const PASTA_PEDIDA: unknown = import.meta.env.FOLHA_MOVEIS_34_PASTA
const PASTA = typeof PASTA_PEDIDA === 'string' && PASTA_PEDIDA !== '' ? PASTA_PEDIDA : '../tmp/moveis-3-4-2026-11-15/desenho'
const PEDIDA = MODO === 'antes' || MODO === 'depois'

const TIPOS: readonly (readonly [TipoMobilia, string])[] = [
  ['bau', 'BAU'],
  ['balcao', 'BALCAO'],
  ['geladeira', 'GELADEIRA'],
  ['pia', 'PIA'],
]
const GIROS = [0, 90, 180, 270] as const
const VISTAS = ['de-cima', 'tres-quartos'] as const
type Vista = (typeof VISTAS)[number]

const NIVEL_DA_FOLHA = 2
/** A 25% de zoom o app usa a imagem do nível 1 reduzida a um quarto; aqui ela sai ampliada 3x. */
const REDUCAO_DA_MESA = 4
const AMPLIACAO_DA_MESA = 3

type Rgb = readonly [number, number, number]
const FUNDO: Rgb = [0x2a, 0x24, 0x20]
const CHAO_CLARO: Rgb = [0xa8, 0x77, 0x6a]
const TINTA: Rgb = [0xee, 0xe4, 0xd8]
const APAGADA: Rgb = [0xb0, 0xa4, 0x96]
const MARGEM = 24
const VAO = 14
const ESCALA_DA_LETRA = 2
const LINHA = 7 * ESCALA_DA_LETRA + 8

interface Painel {
  readonly W: number
  readonly H: number
  /** Canto de cima à esquerda em relação ao centro do móvel, em pixels da folha. */
  readonly x0: number
  readonly y0: number
  readonly px: Uint8ClampedArray
}

function chave(tipo: TipoMobilia, vista: Vista, giro: number, mesa: boolean): string {
  return `${tipo}|${vista}|${giro}${mesa ? '|mesa' : ''}`
}

function movel(tipo: TipoMobilia, giro: number): Prop {
  return { ...criarMovel(tipo, { x: 0, y: 0 }, GRADE_DE_REFERENCIA, `folha-34-${tipo}`), rotation: giro }
}

function pintar(prop: Prop, vista: Vista, nivel: number): Painel {
  const c = chaveDoMovel(prop, nivel, 1, vista === 'tres-quartos' ? 'tres-quartos' : undefined)
  if (c === null) throw new Error(`${prop.mobilia}: sem desenho`)
  const S = escalaDoNivel(nivel)
  const { limites, pixels } = pintarMovel(c.desenho, S)
  return { W: limites.W, H: limites.H, x0: Math.round(limites.x0 * S), y0: Math.round(limites.y0 * S), px: pixels }
}

/** A imagem reduzida `k` vezes (média pelo alfa: a cor do pixel transparente não vaza) e ampliada `a` vezes, sem filtro. */
function reduzir(p: Painel, k: number, a: number): Painel {
  const w = Math.ceil(p.W / k)
  const h = Math.ceil(p.H / k)
  const px = new Uint8ClampedArray(w * a * h * a * 4)
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      let r = 0
      let g = 0
      let b = 0
      let soma = 0
      let n = 0
      for (let y = j * k; y < Math.min(p.H, (j + 1) * k); y += 1) {
        for (let x = i * k; x < Math.min(p.W, (i + 1) * k); x += 1) {
          const o = (y * p.W + x) * 4
          const al = p.px[o + 3] / 255
          r += p.px[o] * al
          g += p.px[o + 1] * al
          b += p.px[o + 2] * al
          soma += al
          n += 1
        }
      }
      const cor = soma > 0 ? [r / soma, g / soma, b / soma] : [0, 0, 0]
      const alfa = n > 0 ? (soma / n) * 255 : 0
      for (let y = 0; y < a; y += 1) {
        for (let x = 0; x < a; x += 1) {
          const o = ((j * a + y) * w * a + i * a + x) * 4
          px[o] = cor[0]
          px[o + 1] = cor[1]
          px[o + 2] = cor[2]
          px[o + 3] = alfa
        }
      }
    }
  }
  return { W: w * a, H: h * a, x0: Math.round((p.x0 / k) * a), y0: Math.round((p.y0 / k) * a), px }
}

function pintarTudo(): Map<string, Painel> {
  const paineis = new Map<string, Painel>()
  for (const [tipo] of TIPOS) {
    for (const giro of GIROS) {
      for (const vista of VISTAS) {
        const prop = movel(tipo, giro)
        paineis.set(chave(tipo, vista, giro, false), pintar(prop, vista, NIVEL_DA_FOLHA))
        paineis.set(chave(tipo, vista, giro, true), reduzir(pintar(prop, vista, 1), REDUCAO_DA_MESA, AMPLIACAO_DA_MESA))
      }
    }
  }
  return paineis
}

/** Os painéis num arquivo só: 4 bytes com o tamanho do índice (JSON), o índice e os pixels em seguida. */
/** O pedaço do Node que a folha usa, pelo `vi.importActual` (o projeto não tem `@types/node`). */
interface NodeDaFolha {
  readonly fs: {
    existsSync(caminho: string): boolean
    readFileSync(caminho: string): Uint8Array
    writeFileSync(caminho: string, dados: Uint8Array): void
    mkdirSync(caminho: string, opcoes: { recursive: true }): string | undefined
  }
  readonly path: { join(...partes: string[]): string }
}

async function nodeDaFolha(): Promise<NodeDaFolha> {
  const fs = await vi.importActual<NodeDaFolha['fs']>('node:fs')
  const path = await vi.importActual<NodeDaFolha['path']>('node:path')
  return { fs, path }
}

function gravarPaineis({ writeFileSync }: NodeDaFolha['fs'], caminho: string, paineis: Map<string, Painel>): void {
  const indice = [...paineis].map(([k, p]) => ({ k, W: p.W, H: p.H, x0: p.x0, y0: p.y0 }))
  const cabeca = new TextEncoder().encode(JSON.stringify(indice))
  let total = 4 + cabeca.length
  for (const p of paineis.values()) total += p.px.length
  const buf = new Uint8Array(total)
  new DataView(buf.buffer).setUint32(0, cabeca.length)
  buf.set(cabeca, 4)
  let o = 4 + cabeca.length
  for (const p of paineis.values()) {
    buf.set(p.px, o)
    o += p.px.length
  }
  writeFileSync(caminho, buf)
}

interface Indice {
  readonly k: string
  readonly W: number
  readonly H: number
  readonly x0: number
  readonly y0: number
}

function lerPaineis({ readFileSync }: NodeDaFolha['fs'], caminho: string): Map<string, Painel> {
  const buf = new Uint8Array(readFileSync(caminho))
  const tamanho = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(0)
  const indice = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + tamanho))) as Indice[]
  const paineis = new Map<string, Painel>()
  let o = 4 + tamanho
  for (const e of indice) {
    const n = e.W * e.H * 4
    paineis.set(e.k, { W: e.W, H: e.H, x0: e.x0, y0: e.y0, px: new Uint8ClampedArray(buf.subarray(o, o + n)) })
    o += n
  }
  return paineis
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

/** Meia largura e meia altura que cabem a imagem centrada no móvel. */
function meias(p: Painel): readonly [number, number] {
  return [Math.max(-p.x0, p.W + p.x0), Math.max(-p.y0, p.H + p.y0)]
}

function colarNoMeio(tela: Tela, p: Painel, cx: number, cy: number): void {
  colar(tela, p.px, p.W, p.H, Math.round(cx + p.x0), Math.round(cy + p.y0))
}

/** A folha: um bloco por móvel, ANTES nas quatro colunas da esquerda e DEPOIS nas da direita. */
function montarFolha(antes: Map<string, Painel>, depois: Map<string, Painel>, tipos = TIPOS): Tela {
  const lados = [antes, depois] as const
  const pegar = (lado: Map<string, Painel>, k: string): Painel => {
    const p = lado.get(k)
    if (p === undefined) throw new Error(`painel ${k} faltando`)
    return p
  }
  const blocos = tipos.map(([tipo, nome]) => {
    let meiaColuna = 0
    const meiaLinha: Record<Vista, number> = { 'de-cima': 0, 'tres-quartos': 0 }
    let meiaMesa = 0
    let altaMesa = 0
    for (const lado of lados) {
      for (const giro of GIROS) {
        for (const vista of VISTAS) {
          const [mx, my] = meias(pegar(lado, chave(tipo, vista, giro, false)))
          meiaColuna = Math.max(meiaColuna, mx)
          meiaLinha[vista] = Math.max(meiaLinha[vista], my)
          const [ax, ay] = meias(pegar(lado, chave(tipo, vista, giro, true)))
          meiaMesa = Math.max(meiaMesa, ax)
          altaMesa = Math.max(altaMesa, ay)
        }
      }
    }
    const largura = Math.max(2 * meiaColuna, 4 * meiaMesa + VAO) + VAO
    return { tipo, nome, largura, meiaLinha, meiaMesa, altaMesa }
  })
  const larguraDaColuna = Math.max(...blocos.map((b) => b.largura))
  const largura = MARGEM * 2 + 8 * larguraDaColuna + 9 * VAO
  const alturaDoBloco = (b: (typeof blocos)[number]): number => LINHA * 2 + 2 * b.meiaLinha['de-cima'] + VAO + 2 * b.meiaLinha['tres-quartos'] + VAO + LINHA + 2 * b.altaMesa + VAO * 2
  const altura = MARGEM * 2 + LINHA * 2 + blocos.reduce((s, b) => s + alturaDoBloco(b) + VAO, 0)
  const tela = novaTela(largura, altura, FUNDO)
  escrever(tela, 'BAU, BALCAO, GELADEIRA E PIA: ANTES A ESQUERDA, DEPOIS A DIREITA. EM CADA BLOCO, DE CIMA, 3/4 E EMBAIXO OS DOIS A 25 DE ZOOM AMPLIADOS 3X', MARGEM, MARGEM, ESCALA_DA_LETRA, TINTA)
  let y = MARGEM + LINHA * 2
  for (const b of blocos) {
    escrever(tela, b.nome, MARGEM, y, ESCALA_DA_LETRA + 1, TINTA)
    lados.forEach((_lado, li) => {
      const x = MARGEM + VAO + li * 4 * (larguraDaColuna + VAO)
      escrever(tela, li === 0 ? 'ANTES' : 'DEPOIS', x + 160, y + 2, ESCALA_DA_LETRA, li === 0 ? APAGADA : TINTA)
    })
    const yTitulos = y + LINHA
    const yCima = yTitulos + LINHA
    const yTres = yCima + 2 * b.meiaLinha['de-cima'] + VAO
    const yMesa = yTres + 2 * b.meiaLinha['tres-quartos'] + VAO
    const fimDoBloco = yMesa + LINHA + 2 * b.altaMesa + VAO
    lados.forEach((lado, li) => {
      GIROS.forEach((giro, gi) => {
        const x = MARGEM + VAO + (li * 4 + gi) * (larguraDaColuna + VAO)
        retangulo(tela, x, yTitulos, larguraDaColuna, fimDoBloco - yTitulos, CHAO_CLARO)
        escrever(tela, `GIRO ${giro}`, x + 6, yTitulos + 4, ESCALA_DA_LETRA, [0x24, 0x1c, 0x18])
        const cx = x + larguraDaColuna / 2
        colarNoMeio(tela, pegar(lado, chave(b.tipo, 'de-cima', giro, false)), cx, yCima + b.meiaLinha['de-cima'])
        colarNoMeio(tela, pegar(lado, chave(b.tipo, 'tres-quartos', giro, false)), cx, yTres + b.meiaLinha['tres-quartos'])
        escrever(tela, 'A 25, DE CIMA E 3/4', x + 6, yMesa, ESCALA_DA_LETRA, [0x55, 0x40, 0x38])
        colarNoMeio(tela, pegar(lado, chave(b.tipo, 'de-cima', giro, true)), cx - b.meiaMesa - VAO / 2, yMesa + LINHA + b.altaMesa)
        colarNoMeio(tela, pegar(lado, chave(b.tipo, 'tres-quartos', giro, true)), cx + b.meiaMesa + VAO / 2, yMesa + LINHA + b.altaMesa)
      })
    })
    y = fimDoBloco + VAO
  }
  return tela
}

it.skipIf(!PEDIDA)('gera a folha de antes e depois do baú, do balcão, da geladeira e da pia (FOLHA_MOVEIS_34)', async () => {
  const { fs, path } = await nodeDaFolha()
  const { existsSync, mkdirSync, writeFileSync } = fs
  const join = path.join
  mkdirSync(PASTA, { recursive: true })
  const arquivoDoAntes = join(PASTA, 'antes.bin')
  const agora = pintarTudo()
  if (MODO === 'antes') {
    gravarPaineis(fs, arquivoDoAntes, agora)
    // O antes sozinho também vira folha (antes dos dois lados), para conferir o que foi guardado.
    writeFileSync(join(PASTA, 'antes.png'), emPng(montarFolha(agora, agora)))
    return
  }
  if (!existsSync(arquivoDoAntes)) throw new Error(`falta ${arquivoDoAntes}: rode antes com FOLHA_MOVEIS_34=antes`)
  const antes = lerPaineis(fs, arquivoDoAntes)
  writeFileSync(join(PASTA, 'folha.png'), emPng(montarFolha(antes, agora)))
  // Um bloco por arquivo também, e o depois nos quatro giros no nível 3 (zoom 300%), para olhar de perto.
  for (const item of TIPOS) {
    writeFileSync(join(PASTA, `folha-${item[0]}.png`), emPng(montarFolha(antes, agora, [item])))
    writeFileSync(join(PASTA, `perto-${item[0]}.png`), emPng(pertoNosQuatroGiros(item[0])))
  }
}, 10 * 60_000)

/** O nível do olhar de perto (zoom 300%). */
const NIVEL_DE_PERTO = 3

/** O depois no nível 3, nos quatro giros (0, 90, 180 e 270 da esquerda para a direita): de cima em cima, a 3/4 embaixo. */
function pertoNosQuatroGiros(tipo: TipoMobilia): Tela {
  const linhas = VISTAS.map((vista) => GIROS.map((giro) => pintar(movel(tipo, giro), vista, NIVEL_DE_PERTO)))
  const meiaColuna = Math.max(...linhas.flat().map((p) => meias(p)[0]))
  const meiasDaLinha = linhas.map((linha) => Math.max(...linha.map((p) => meias(p)[1])))
  const largura = GIROS.length * (2 * meiaColuna + VAO) + VAO
  const altura = meiasDaLinha.reduce((soma, m) => soma + 2 * m + VAO, VAO)
  const tela = novaTela(largura, altura, CHAO_CLARO)
  let y = VAO
  linhas.forEach((linha, li) => {
    linha.forEach((p, gi) => colarNoMeio(tela, p, VAO + gi * (2 * meiaColuna + VAO) + meiaColuna, y + meiasDaLinha[li]))
    y += 2 * meiasDaLinha[li] + VAO
  })
  return tela
}
