import { afterEach, describe, expect, it, vi } from 'vitest'
import { Graphics } from 'pixi.js'
import { desenharBatente, desenharFolhaFechada, esquecerAnimacoesDePortaDeFora, animacaoDePorta, listarAnimacoesDePorta, type AnimacaoDePorta, type PortaParaDesenho } from '../../portas/animacoesDePorta'
import { carregarPacoteDeAnimacoes, esquecerPacoteCarregado, type OrigemDoPacote } from '../../lib/pacoteDeAnimacoes'
import { curvaBezierValida } from '../../portas/curvaBezier'
import dupla from './dupla'
import grade from './grade'
import arrombada from './arrombada'
import sanfona from './sanfona'
import cortina from './cortina'
import metaDupla from './dupla.json'
import metaGrade from './grade.json'
import metaArrombada from './arrombada.json'
import metaSanfona from './sanfona.json'
import metaCortina from './cortina.json'

/**
 * AS CINCO PORTAS DO PACOTE (22/10/2026), no desenho novo: creme com contorno
 * escuro, vão inteiro. Os extremos são a porta parada instrução por instrução,
 * tudo opaco, e o desenho só depende do progresso (inverter não salta). A prova
 * no pixel, com o renderizador de verdade, está em docs/design/porta-animacoes/app.
 */
const MODULOS: Record<string, { desenhar: AnimacaoDePorta['desenhar']; meta: { nome: string; duracaoMs: number; duracaoFecharMs?: number; curvaAbrir?: number[]; curvaFechar?: number[]; som?: string } }> = {
  dupla: { desenhar: dupla, meta: metaDupla },
  grade: { desenhar: grade, meta: metaGrade },
  arrombada: { desenhar: arrombada, meta: metaArrombada },
  sanfona: { desenhar: sanfona, meta: metaSanfona },
  cortina: { desenhar: cortina, meta: metaCortina },
}
const IDS = Object.keys(MODULOS)

/** Como `pixi/drawDoors.ts` monta a porta a 100% (horizontal) e a 250% (vertical), cor sem e com. */
const HORIZONTAL: PortaParaDesenho = { x1: 0, y1: 0, x2: 100, y2: 0, cx: 50, cy: 0, ux: 1, uy: 0, meioComprimento: 50, espessura: 4, contorno: 1, borda: 1, cor: 0xd9d2c0, escala: 1 }
const VERTICAL: PortaParaDesenho = { x1: 0, y1: 0, x2: 0, y2: 80, cx: 0, cy: 40, ux: 0, uy: 1, meioComprimento: 40, espessura: 1.6, contorno: 0.4, borda: 0.4, cor: 0x5e8c4a, escala: 2.5 }
const PORTAS = [HORIZONTAL, VERTICAL]

type Instruction = Graphics['context']['instructions'][number]

function desenhoInteiro(g: Graphics): string {
  return JSON.stringify(g.context.instructions.map((i: Instruction) => (i.action === 'fill' || i.action === 'stroke' ? [i.action, i.data.style.color, i.data.style.alpha, i.data.path.instructions.map((p) => [p.action, p.data])] : [i.action])))
}

function quadro(id: string, porta: PortaParaDesenho, progresso: number, abrindo = true): Graphics {
  const g = new Graphics()
  MODULOS[id].desenhar(g, porta, progresso, abrindo)
  return g
}

function so(desenho: (g: Graphics, porta: PortaParaDesenho) => void, porta: PortaParaDesenho): Graphics {
  const g = new Graphics()
  desenho(g, porta)
  return g
}

interface Caixa {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Os pontos que um preenchimento pinta (cantos dos retângulos, a caixa das
 * contas), nos eixos do mundo. O Pixi abre cada caminho depois do primeiro com
 * um `moveTo(0, 0)` que não pinta nada: o `moveTo` só conta quando uma linha sai dele.
 */
function pontosDoPreenchimento(instrucao: Instruction): { xs: number[]; ys: number[] } {
  const xs: number[] = []
  const ys: number[] = []
  if (instrucao.action !== 'fill') return { xs, ys }
  let inicioDaLinha: [number, number] | null = null
  for (const forma of instrucao.data.path.instructions) {
    if (forma.action === 'moveTo') {
      const [x, y] = forma.data
      inicioDaLinha = [x, y]
      continue
    }
    if (forma.action === 'lineTo') {
      if (inicioDaLinha !== null) {
        xs.push(inicioDaLinha[0])
        ys.push(inicioDaLinha[1])
      }
      const [x, y] = forma.data
      xs.push(x)
      ys.push(y)
    } else if (forma.action === 'poly') {
      const [pontos] = forma.data
      if (!Array.isArray(pontos)) throw new Error('poly sem lista de números')
      const numeros = pontos.filter((v): v is number => typeof v === 'number')
      numeros.forEach((v, i) => (i % 2 === 0 ? xs : ys).push(v))
    } else if (forma.action === 'circle') {
      const [x, y, raio] = forma.data
      xs.push(x - raio, x + raio)
      ys.push(y - raio, y + raio)
    } else if (forma.action !== 'closePath') {
      throw new Error(`forma não prevista no teste: ${forma.action}`)
    }
    inicioDaLinha = null
  }
  return { xs, ys }
}

/** A caixa de tudo o que os preenchimentos pintam, nos eixos do mundo. */
function caixaDe(instrucoes: readonly Instruction[]): Caixa {
  const xs: number[] = []
  const ys: number[] = []
  for (const instrucao of instrucoes) {
    const pontos = pontosDoPreenchimento(instrucao)
    xs.push(...pontos.xs)
    ys.push(...pontos.ys)
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

function caixaDoDesenho(g: Graphics): Caixa {
  return caixaDe(g.context.instructions)
}

/** Folga da prova do fim: meio px de TELA, bem abaixo do 1,5 px da régua M5 de docs/design/porta-animacoes/app. */
const FOLGA_DO_FIM_TELA_PX = 0.5
/** O passo da régua M5b de docs/design/porta-animacoes/app (0,05% do caminho) e o salto que ela aceita, em px de TELA. */
const QUADROS_REFINADOS = 2000
const SALTO_MAX_TELA_PX = 1.5
/** `QUEDA_MAX_DO_VAO` de arrombada.ts: o estilhaço cai a no máximo 80% do vão, contado da fechadura. */
const QUEDA_MAX_DO_VAO = 0.8

/** Uma porta como `pixi/drawDoors.ts` a monta: 4 px de TELA de espessura, 1 de ombreira e 1 de contorno. */
function portaDe(x1: number, y1: number, x2: number, y2: number, escala: number): PortaParaDesenho {
  const vao = Math.hypot(x2 - x1, y2 - y1)
  return { x1, y1, x2, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, ux: (x2 - x1) / vao, uy: (y2 - y1) / vao, meioComprimento: vao / 2, espessura: 4 / escala, contorno: 1 / escala, borda: 1 / escala, cor: 0xd9d2c0, escala }
}

/** Uma casa de grade (50) nas duas orientações e em três zooms; a posição muda o sorteio dos estilhaços. */
const PORTAS_DA_ARROMBADA = [1, 2.5, 4].flatMap((escala, i) => [
  { nome: `horizontal a ${escala * 100}%`, porta: portaDe(100 + 50 * i, 200, 150 + 50 * i, 200, escala) },
  { nome: `vertical a ${escala * 100}%`, porta: portaDe(300, 100 + 50 * i, 300, 150 + 50 * i, escala) },
  // A porta curta vista de longe: 5 px de TELA de vão, menos que o ponto de queda sorteado (4 a 14 px).
  { nome: `curta de longe ${i + 1}`, porta: i % 2 === 0 ? portaDe(40 + 10 * i, 60, 50 + 10 * i, 60, 0.5) : portaDe(80, 40 + 10 * i, 80, 50 + 10 * i, 0.5) },
])

function media(valores: readonly number[]): number {
  return valores.reduce((soma, v) => soma + v, 0) / valores.length
}

/**
 * Os quadros a 0,05% do caminho que têm estilhaço, com os preenchimentos
 * deles: o trecho dos estilhaços sai do desenho, não das constantes de
 * arrombada.ts. Ela pinta o batente, a folha numa peça só e, por cima, os
 * estilhaços, e cada `pintarFolha` faz o escuro de todas as peças antes da cor
 * delas. Então, depois do batente, a folha é o primeiro preenchimento, mais o
 * seguinte quando é da cor da porta (a cor some na folha mais fina que a borda).
 */
function quadrosComEstilhacos(porta: PortaParaDesenho): { p: number; estilhacos: Instruction[] }[] {
  const depoisDoBatente = so(desenharBatente, porta).context.instructions.length
  const quadros: { p: number; estilhacos: Instruction[] }[] = []
  for (let i = 1; i < QUADROS_REFINADOS; i += 1) {
    const p = i / QUADROS_REFINADOS
    const instrucoes = quadro('arrombada', porta, p).context.instructions
    const segunda = depoisDoBatente + 1 < instrucoes.length ? instrucoes[depoisDoBatente + 1] : null
    const daFolha = segunda !== null && segunda.action === 'fill' && segunda.data.style.color === porta.cor ? 2 : 1
    const estilhacos = instrucoes.slice(depoisDoBatente + daFolha)
    if (estilhacos.length > 0) quadros.push({ p, estilhacos })
  }
  return quadros
}

afterEach(() => {
  esquecerPacoteCarregado()
  esquecerAnimacoesDePortaDeFora()
  vi.restoreAllMocks()
})

describe('as cinco portas do pacote — o desenho', () => {
  it.each(IDS)('%s em 0 é a fechada parada e em 1 a aberta parada, instrução por instrução, nas duas orientações', (id) => {
    for (const porta of PORTAS) {
      expect(desenhoInteiro(quadro(id, porta, 0))).toBe(desenhoInteiro(so(desenharFolhaFechada, porta)))
      expect(desenhoInteiro(quadro(id, porta, 1))).toBe(desenhoInteiro(so(desenharBatente, porta)))
      // Fora de [0, 1] (curva torta de outro app) cai no extremo, sem desenho estranho.
      expect(desenhoInteiro(quadro(id, porta, -0.2))).toBe(desenhoInteiro(so(desenharFolhaFechada, porta)))
      expect(desenhoInteiro(quadro(id, porta, 1.3))).toBe(desenhoInteiro(so(desenharBatente, porta)))
    }
  })

  it.each(IDS)('%s é opaco e chapado o caminho inteiro: 201 pontos, só preenchimento, alfa 1', (id) => {
    for (const porta of PORTAS) {
      for (let i = 0; i <= 200; i += 1) {
        for (const instrucao of quadro(id, porta, i / 200).context.instructions) {
          expect(instrucao.action).toBe('fill')
          if (instrucao.action === 'fill') expect(instrucao.data.style.alpha).toBe(1)
        }
      }
    }
  })

  // Em 1 a folha some e sobra o batente. O que ainda está pintado logo antes precisa
  // caber na caixa dele: um toco atravessado na dobradiça sumiria de uma vez em 1 (e
  // apareceria de uma vez ao começar a fechar), o salto que a régua M5 mede no pixel.
  it.each(IDS)('%s acaba dentro do batente: a 0,9999 do caminho nada sai da caixa da porta parada', (id) => {
    for (const porta of PORTAS) {
      const batente = caixaDoDesenho(so(desenharBatente, porta))
      const quase = caixaDoDesenho(quadro(id, porta, 0.9999))
      const folga = FOLGA_DO_FIM_TELA_PX / porta.escala
      expect(quase.minX).toBeGreaterThanOrEqual(batente.minX - folga)
      expect(quase.maxX).toBeLessThanOrEqual(batente.maxX + folga)
      expect(quase.minY).toBeGreaterThanOrEqual(batente.minY - folga)
      expect(quase.maxY).toBeLessThanOrEqual(batente.maxY + folga)
    }
  })

  it.each(IDS)('%s só depende do progresso: abrir e fechar passam pelo mesmo desenho (inverter não salta)', (id) => {
    for (let i = 0; i <= 20; i += 1) expect(desenhoInteiro(quadro(id, HORIZONTAL, i / 20, true))).toBe(desenhoInteiro(quadro(id, HORIZONTAL, i / 20, false)))
  })

  it.each(IDS)('%s no meio do caminho usa a cor da porta e o contorno escuro, e nada fora da caixa do vão mais 1 de folga', (id) => {
    const cores = new Set<number>()
    for (const p of [0.25, 0.5, 0.75]) {
      for (const instrucao of quadro(id, HORIZONTAL, p).context.instructions) if (instrucao.action === 'fill') cores.add(instrucao.data.style.color)
    }
    expect(cores.has(HORIZONTAL.cor)).toBe(true)
    expect(cores.has(0x15181a)).toBe(true)
  })
})

// A régua M5b do laboratório mede isto no pixel, à mão (gerar-provas). Aqui é o
// portão de cada mudança: antes de 22/10/2026 os estilhaços sumiam no ar, a 7-15
// px da fechadura, e fechando (o mesmo desenho de trás para a frente) nasciam do
// nada lá — passos de 5 a 10 px em 0,05% do caminho.
describe('a Arrombada — os estilhaços saem da fechadura e caem na soleira', () => {
  it.each(PORTAS_DA_ARROMBADA)('$nome: no primeiro e no último quadro com estilhaços, todos cabem na caixa do batente', ({ porta }) => {
    const quadros = quadrosComEstilhacos(porta)
    expect(quadros.length, 'a Arrombada não soltou estilhaço nenhum').toBeGreaterThan(0)
    const batente = caixaDoDesenho(so(desenharBatente, porta))
    const folga = FOLGA_DO_FIM_TELA_PX / porta.escala
    for (const { p, estilhacos } of [quadros[0], quadros[quadros.length - 1]]) {
      const caixa = caixaDe(estilhacos)
      const onde = `em ${p}: estilhaços de (${caixa.minX}, ${caixa.minY}) a (${caixa.maxX}, ${caixa.maxY}), batente de (${batente.minX}, ${batente.minY}) a (${batente.maxX}, ${batente.maxY})`
      expect(caixa.minX, onde).toBeGreaterThanOrEqual(batente.minX - folga)
      expect(caixa.maxX, onde).toBeLessThanOrEqual(batente.maxX + folga)
      expect(caixa.minY, onde).toBeGreaterThanOrEqual(batente.minY - folga)
      expect(caixa.maxY, onde).toBeLessThanOrEqual(batente.maxY + folga)
    }
  })

  it.each(PORTAS_DA_ARROMBADA)('$nome: a 0,05% do caminho a caixa do desenho anda no máximo 1,5 px de tela', ({ porta }) => {
    let anterior = caixaDoDesenho(quadro('arrombada', porta, 0))
    let pior = { px: 0, em: 0 }
    for (let i = 1; i <= QUADROS_REFINADOS; i += 1) {
      const atual = caixaDoDesenho(quadro('arrombada', porta, i / QUADROS_REFINADOS))
      const px = Math.max(Math.abs(atual.minX - anterior.minX), Math.abs(atual.maxX - anterior.maxX), Math.abs(atual.minY - anterior.minY), Math.abs(atual.maxY - anterior.maxY)) * porta.escala
      if (px > pior.px) pior = { px, em: i / QUADROS_REFINADOS }
      anterior = atual
    }
    expect(pior.px, `o pior passo, chegando em ${pior.em}`).toBeLessThanOrEqual(SALTO_MAX_TELA_PX)
  })

  it.each(PORTAS_DA_ARROMBADA)('$nome: o estilhaço cai dentro do vão, entre a fechadura e 80% do vão contado dela', ({ porta }) => {
    const vao = 2 * porta.meioComprimento
    const fechaduraX = porta.cx + porta.ux * porta.meioComprimento
    const fechaduraY = porta.cy + porta.uy * porta.meioComprimento
    const recuos: number[] = []
    for (const { estilhacos } of quadrosComEstilhacos(porta)) {
      for (const instrucao of estilhacos) {
        const { xs, ys } = pontosDoPreenchimento(instrucao)
        recuos.push(((fechaduraX - media(xs)) * porta.ux + (fechaduraY - media(ys)) * porta.uy) / vao)
      }
    }
    expect(recuos.length, 'a Arrombada não soltou estilhaço nenhum').toBeGreaterThan(0)
    expect(Math.min(...recuos), 'um estilhaço passou da fechadura, para fora do vão').toBeGreaterThanOrEqual(-1e-9)
    expect(Math.max(...recuos), 'um estilhaço caiu além de 80% do vão').toBeLessThanOrEqual(QUEDA_MAX_DO_VAO + 1e-9)
  })
})

describe('as cinco portas do pacote — as metas e o registro', () => {
  it.each(IDS)('%s.json: tempos de abrir e fechar, curvas sem quique e o som dela', (id) => {
    const { meta } = MODULOS[id]
    expect(meta.duracaoMs).toBeGreaterThan(0)
    expect(meta.duracaoFecharMs).toBeGreaterThan(0)
    expect(curvaBezierValida(meta.curvaAbrir)).toBe(true)
    expect(curvaBezierValida(meta.curvaFechar)).toBe(true)
    expect(meta.som).toBe(id)
  })

  it('os tempos do protótipo aprovado: Dupla 320/280, Grade 600/420, Arrombada 560/320, Sanfona 440/380, Cortina 480/420', () => {
    expect(IDS.map((id) => [id, MODULOS[id].meta.duracaoMs, MODULOS[id].meta.duracaoFecharMs])).toEqual([
      ['dupla', 320, 280],
      ['grade', 600, 420],
      ['arrombada', 560, 320],
      ['sanfona', 440, 380],
      ['cortina', 480, 420],
    ])
  })

  it('carregar o pacote com as cinco registra 7 animações de porta, com tempo de fechar, curvas e som', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const animacoes = IDS.map((id) => ({ id, tipo: 'porta', arquivo: `porta-${id}.js`, ...MODULOS[id].meta }))
    const indice = JSON.stringify({ formato: 1, versao: 1, motorMinimo: '0.4.21', arquivos: animacoes.map((a) => ({ nome: a.arquivo, sha256: 'a'.repeat(64), tamanho: 10 })), animacoes })
    const origem: OrigemDoPacote = {
      lerIndice: async () => indice,
      importar: async (arquivo: string) => ({ default: MODULOS[arquivo.replace(/^porta-|\.js$/g, '')].desenhar }),
    }
    await carregarPacoteDeAnimacoes(origem, indice)
    expect(listarAnimacoesDePorta().map((a) => a.id)).toEqual(['girar', 'deslizar', ...IDS])
    for (const id of IDS) {
      const animacao = animacaoDePorta(id)
      const { meta } = MODULOS[id]
      expect(animacao?.duracaoMs).toBe(meta.duracaoMs)
      expect(animacao?.duracaoFecharMs).toBe(meta.duracaoFecharMs)
      expect(animacao?.curvaAbrir).toEqual(meta.curvaAbrir)
      expect(animacao?.curvaFechar).toEqual(meta.curvaFechar)
      expect(animacao?.som).toBe(id)
    }
  })
})
