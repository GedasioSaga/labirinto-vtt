/**
 * 50 portas animando ao mesmo tempo, num animador só (como uma camada do app):
 * mede o intervalo entre quadros (p95), o tempo de desenho por quadro e as
 * tarefas longas do navegador. Os números saem na página, para quem quiser
 * conferir na própria máquina.
 */
import { autoDetectRenderer, Container, Graphics, Ticker, type Renderer } from 'pixi.js'
import { createAnimadorDePortas } from '../proposta/animadorDePortas'
import { paredeDaPorta, type EstadoDaPorta } from './palco'

export interface ResultadoDoEstresse {
  portas: number
  duracaoMs: number
  quadros: number
  quadroP50: number
  quadroP95: number
  quadroMax: number
  desenhoP95: number
  desenhoMax: number
  tarefasLongas: number[]
  tarefasLongasObservadas: boolean
  reduzido: boolean
}

export interface Estresse {
  rodar: (ms?: number) => Promise<ResultadoDoEstresse>
}

const PORTAS = 50
const COLUNAS = 10
const CELULA = 72
const LARGURA = COLUNAS * CELULA
const ALTURA = (PORTAS / COLUNAS) * CELULA
const TROCA_MS = 700
const ANIMACOES = ['dupla', 'grade', 'arrombada', 'sanfona', 'cortina', 'girar', 'deslizar']

function percentil(valores: readonly number[], p: number): number {
  if (valores.length === 0) return 0
  const ordenados = [...valores].sort((a, b) => a - b)
  return ordenados[Math.min(ordenados.length - 1, Math.max(0, Math.ceil(p * ordenados.length) - 1))]
}

const ms = (n: number): string => `${n.toFixed(1).replace('.', ',')} ms`

export function criarEstresse(secao: HTMLElement, reduzido: () => boolean): Estresse {
  const botao = secao.querySelector<HTMLButtonElement>('button.medir')
  const palco = secao.querySelector<HTMLElement>('.palco-estresse')
  const saida = secao.querySelector<HTMLElement>('.resultado')
  if (botao === null || palco === null || saida === null) throw new Error('a seção das 50 portas está incompleta')
  const resolucao = Math.max(1, Math.min(2, Math.round(window.devicePixelRatio || 1)))
  let renderer: Renderer | null = null
  let rodando = false

  async function rodar(duracaoMs = 4000): Promise<ResultadoDoEstresse> {
    if (rodando || botao === null || palco === null || saida === null) throw new Error('a medida das 50 portas já está rodando')
    rodando = true
    botao.disabled = true
    botao.textContent = 'Medindo por 4 s'
    saida.textContent = ''
    if (renderer === null) {
      renderer = await autoDetectRenderer({ width: LARGURA, height: ALTURA, resolution: resolucao, antialias: true, background: 0x2b2b2b, preference: 'webgl' })
      const tela = renderer.canvas as HTMLCanvasElement
      tela.setAttribute('role', 'img')
      tela.setAttribute('aria-label', '50 portas abrindo e fechando ao mesmo tempo')
      palco.append(tela)
    }
    const pintor = renderer
    const raiz = new Container()
    const portas = new Graphics()
    raiz.addChild(portas)
    const ticker = new Ticker()
    ticker.autoStart = false
    const animador = createAnimadorDePortas({ ticker, reducedMotion: reduzido })
    const estados: EstadoDaPorta[] = Array.from({ length: PORTAS }, (_, i) => ({ aberta: false, trancada: false, animacao: ANIMACOES[i % ANIMACOES.length], cor: undefined }))
    const paredes = () => estados.map((estado, i) => paredeDaPorta(i % 2 === 0 ? 'horizontal' : 'vertical', estado, `p${i}`, (i % COLUNAS) * CELULA + CELULA / 2, Math.floor(i / COLUNAS) * CELULA + CELULA / 2))
    animador.desenhar(portas, paredes(), null, 1, resolucao)

    const longas: number[] = []
    let observador: PerformanceObserver | null = null
    try {
      observador = new PerformanceObserver((lista) => {
        for (const tarefa of lista.getEntries()) longas.push(tarefa.duration)
      })
      observador.observe({ type: 'longtask', buffered: false })
    } catch {
      observador = null
    }
    const quadros: number[] = []
    const desenho: number[] = []
    const inicio = performance.now()
    let anterior = inicio
    let rodada = -1
    await new Promise<void>((resolver) => {
      const passo = (agora: number): void => {
        if (agora - inicio > duracaoMs) {
          resolver()
          return
        }
        const t0 = performance.now()
        const esta = Math.floor((agora - inicio) / TROCA_MS)
        if (esta !== rodada) {
          rodada = esta
          // Dois terços trocam a cada rodada; com tempos de 240 a 640 ms, várias invertem no meio.
          estados.forEach((estado, i) => {
            if ((i + esta) % 3 !== 0) estado.aberta = !estado.aberta
          })
          animador.desenhar(portas, paredes(), null, 1, resolucao)
        }
        if (ticker.count > 0) ticker.update(t0)
        pintor.render({ container: raiz })
        desenho.push(performance.now() - t0)
        quadros.push(agora - anterior)
        anterior = agora
        requestAnimationFrame(passo)
      }
      requestAnimationFrame(passo)
    })
    observador?.disconnect()
    animador.cancelar()
    quadros.shift()
    const resultado: ResultadoDoEstresse = {
      portas: PORTAS,
      duracaoMs,
      quadros: quadros.length,
      quadroP50: percentil(quadros, 0.5),
      quadroP95: percentil(quadros, 0.95),
      quadroMax: Math.max(0, ...quadros),
      desenhoP95: percentil(desenho, 0.95),
      desenhoMax: Math.max(0, ...desenho),
      tarefasLongas: longas,
      tarefasLongasObservadas: observador !== null,
      reduzido: reduzido(),
    }
    const longasDe200 = longas.filter((d) => d >= 200).length
    saida.textContent = resultado.reduzido
      ? 'Movimento reduzido ligado: as portas trocaram na hora, sem animar. Desligue para medir a animação.'
      : `${resultado.quadros} quadros em 4 s. Intervalo entre quadros: p95 ${ms(resultado.quadroP95)} (meta: até 20 ms), pior ${ms(resultado.quadroMax)}. Desenho das 50 por quadro: p95 ${ms(resultado.desenhoP95)}. Tarefas longas de 200 ms ou mais: ${resultado.tarefasLongasObservadas ? longasDe200 : 'o navegador não informa'}.`
    botao.disabled = false
    botao.textContent = 'Medir de novo'
    rodando = false
    return resultado
  }

  botao.addEventListener('click', () => {
    void rodar()
  })
  return { rodar }
}
