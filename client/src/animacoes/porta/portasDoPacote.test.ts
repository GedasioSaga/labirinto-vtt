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
