import { Application, Container, Graphics, Rectangle, Ticker, UPDATE_PRIORITY } from 'pixi.js'
import { createAnimadorDePortas } from '../../../../client/src/pixi/animadorDePortas'
import { DOOR_PADLOCK_FILL, drawDoors, type PortaAnimando } from '../../../../client/src/pixi/drawDoors'
import { drawWalls } from '../../../../client/src/pixi/drawWalls'
import { ABAFADOR_HZ } from '../../../../client/src/lib/sons/contexto'
import { carregarPacoteDeAnimacoes, type OrigemDoPacote } from '../../../../client/src/lib/pacoteDeAnimacoes'
import { animacaoDePorta, curvaDoSentido, duracaoDoSentido, listarAnimacoesDePorta, type AnimacaoDePorta } from '../../../../client/src/portas/animacoesDePorta'
import { agendarSomDePorta, type EventoDeSomDaPorta } from '../../../../client/src/portas/somDePorta'
import type { DoorState, Wall } from '../../../../client/src/types/map'
import dupla from '../../../../client/src/animacoes/porta/dupla'
import grade from '../../../../client/src/animacoes/porta/grade'
import arrombada from '../../../../client/src/animacoes/porta/arrombada'
import sanfona from '../../../../client/src/animacoes/porta/sanfona'
import cortina from '../../../../client/src/animacoes/porta/cortina'
import metaDupla from '../../../../client/src/animacoes/porta/dupla.json'
import metaGrade from '../../../../client/src/animacoes/porta/grade.json'
import metaArrombada from '../../../../client/src/animacoes/porta/arrombada.json'
import metaSanfona from '../../../../client/src/animacoes/porta/sanfona.json'
import metaCortina from '../../../../client/src/animacoes/porta/cortina.json'

/**
 * LABORATÓRIO DAS PROVAS da faixa A3 (desenho novo da porta e as cinco
 * animações do pacote no app): roda no Chromium com o código REAL do app
 * (Pixi, `drawDoors`, `createAnimadorDePortas`, o carregador do pacote, o
 * som), empacotado pelo `gerar-provas.cjs`. As cinco entram pelo MESMO
 * carregador do pacote baixado (`carregarPacoteDeAnimacoes`), com o índice
 * montado dos `<id>.json`. Cada função devolve dados; quem grava arquivo e
 * julga as metas é o gerador.
 */

const QUADRO_MS = 1000 / 60
const LARGURA = 260
const ALTURA = 170
const CHAO = 0x1b1711
/** O vão das provas: 100 de mundo, de parede a parede. */
const VAO = 100

const MODULOS: Record<string, { desenhar: AnimacaoDePorta['desenhar']; meta: object }> = {
  dupla: { desenhar: dupla, meta: metaDupla },
  grade: { desenhar: grade, meta: metaGrade },
  arrombada: { desenhar: arrombada, meta: metaArrombada },
  sanfona: { desenhar: sanfona, meta: metaSanfona },
  cortina: { desenhar: cortina, meta: metaCortina },
}

/** As cinco pelo carregador de verdade: índice como o `scripts/pacote-animacoes.cjs` monta, módulo como o import do app recebe. */
async function carregarAsCinco(): Promise<string[]> {
  const ids = Object.keys(MODULOS)
  const indice = {
    formato: 1,
    versao: 1,
    motorMinimo: '0.4.21',
    arquivos: ids.map((id) => ({ nome: `porta-${id}.js`, sha256: '0'.repeat(64), tamanho: 1 })),
    animacoes: ids.map((id) => ({ id, tipo: 'porta', ...MODULOS[id].meta, arquivo: `porta-${id}.js` })),
  }
  const origem: OrigemDoPacote = {
    lerIndice: async () => JSON.stringify(indice),
    importar: async (arquivo: string) => ({ default: MODULOS[arquivo.replace(/^porta-|\.js$/g, '')].desenhar }),
  }
  await carregarPacoteDeAnimacoes(origem, JSON.stringify(indice))
  return listarAnimacoesDePorta().map((a) => a.id)
}

export interface Caso {
  titulo: string
  fechada: Partial<DoorState>
  aberta: Partial<DoorState>
}

/** A porta do palco: horizontal ou vertical, sempre com o vão de `VAO`. */
function porta(door: Partial<DoorState>, vertical: boolean, id = 'porta', x = 0, y = 0): Wall {
  const fim = vertical ? { x2: x, y2: y + VAO } : { x2: x + VAO, y2: y }
  return { id, x1: x, y1: y, ...fim, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal', ...door } }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

const apps = new Map<number, Application>()

async function aplicacao(resolucao: number): Promise<Application> {
  const pronta = apps.get(resolucao)
  if (pronta !== undefined) return pronta
  const nova = new Application()
  // Sem antialias: borda serrilhada é 0 ou 255 de alfa, e a prova de "opaco" lê o alfa de cada pixel.
  await nova.init({ width: 1200, height: 900, antialias: false, backgroundAlpha: 0, preference: 'webgl', resolution: resolucao, autoStart: false })
  apps.set(resolucao, nova)
  return nova
}

/** Um palco com (ou sem) chão, as paredes dos dois lados do vão e a camada das portas, como no editor. */
function palco(zoom: number, resolucao: number, vertical: boolean, comChao: boolean, largura = LARGURA, altura = ALTURA) {
  const cena = new Container()
  const mundo = new Container()
  if (comChao) cena.addChild(new Graphics().rect(0, 0, largura, altura).fill({ color: CHAO }))
  cena.addChild(mundo)
  mundo.scale.set(zoom)
  // Posição em pixel físico inteiro (a receita de `pixelAlign.ts`), com o vão no meio do quadro.
  const px = (v: number) => Math.round(v * resolucao) / resolucao
  mundo.position.set(px(vertical ? largura / 2 : largura / 2 - (VAO / 2) * zoom), px(vertical ? altura / 2 - (VAO / 2) * zoom : altura / 2))
  const paredes = new Graphics()
  const portas = new Graphics()
  mundo.addChild(paredes, portas)
  const lados = vertical ? [parede('w1', 0, -80, 0, 0), parede('w2', 0, VAO, 0, VAO + 80)] : [parede('w1', -80, 0, 0, 0), parede('w2', VAO, 0, VAO + 80, 0)]
  drawWalls(paredes, lados, null, zoom, resolucao)
  return { cena, mundo, portas }
}

function relogio() {
  const ticker = new Ticker()
  let agora = 1000
  return {
    ticker,
    agora: () => agora,
    andar(ms: number) {
      agora += ms
      ticker.update(agora)
    },
  }
}

function pixels(renderizador: Application, alvo: Container, largura = LARGURA, altura = ALTURA): Uint8ClampedArray {
  renderizador.renderer.render(alvo)
  return renderizador.renderer.extract.pixels({ target: alvo, frame: new Rectangle(0, 0, largura, altura), resolution: renderizador.renderer.resolution }).pixels
}

/** Quadro da porta parada (M11): cabe o vão inteiro a 400% com folga dos dois lados. */
const QUADRO_DA_PARADA = 560

function diferentes(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let n = 0
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n += 1
  return n
}

function translucidos(p: Uint8ClampedArray): number {
  let n = 0
  for (let i = 3; i < p.length; i += 4) if (p[i] !== 0 && p[i] !== 255) n += 1
  return n
}

const comAnimacao = (d: Partial<DoorState>, id: string, vertical: boolean): Wall[] => [porta({ ...d, animacao: id }, vertical)]

/**
 * M1 e M2: a animação em 0 e em 1 (pelo `drawDoors` com a porta animando)
 * contra a porta parada, pixel a pixel; o fim do caminho pelo animador real; o
 * alfa de cada pixel em cada quadro do caminho; e a cópia por cima (telhado).
 */
async function extremos(id: string, caso: Caso, zoom: number, resolucao: number, vertical: boolean) {
  const animacao = animacaoDePorta(id)
  if (animacao === null) throw new Error(`sem a animação ${id}`)
  const r = await aplicacao(resolucao)
  const a = palco(zoom, resolucao, vertical, false)
  const b = palco(zoom, resolucao, vertical, false)
  const conta = (estado: Partial<DoorState>, progresso: number, abrindo: boolean): number => {
    const walls = comAnimacao(estado, id, vertical)
    drawDoors(a.portas, walls, null, zoom, resolucao, undefined, new Map<string, PortaAnimando>([['porta', { animacao, progresso, abrindo }]]))
    drawDoors(b.portas, walls, null, zoom, resolucao)
    return diferentes(pixels(r, a.cena), pixels(r, b.cena))
  }
  const em0 = Math.max(conta(caso.fechada, 0, true), conta(caso.fechada, 0, false))
  const em1 = Math.max(conta(caso.aberta, 1, true), conta(caso.aberta, 1, false))

  // O animador real: o caminho inteiro, quadro a quadro, e o último quadro contra a parada.
  const rel = relogio()
  const animador = createAnimadorDePortas({ ticker: rel.ticker, reducedMotion: () => false, now: rel.agora })
  let semOpacidade = 0
  let quadros = 0
  const caminho = (de: Partial<DoorState>, para: Partial<DoorState>, abrindo: boolean): number => {
    animador.desenhar(a.portas, comAnimacao(de, id, vertical), null, zoom, resolucao)
    animador.desenhar(a.portas, comAnimacao(para, id, vertical), null, zoom, resolucao)
    const fim = duracaoDoSentido(animacao, abrindo)
    for (let t = 0; t < fim + QUADRO_MS; t += QUADRO_MS) {
      semOpacidade += translucidos(pixels(r, a.cena))
      quadros += 1
      rel.andar(QUADRO_MS)
    }
    drawDoors(b.portas, comAnimacao(para, id, vertical), null, zoom, resolucao)
    return diferentes(pixels(r, a.cena), pixels(r, b.cena))
  }
  const fimDoAbrir = caminho(caso.fechada, caso.aberta, true)
  const fimDoFechar = caminho(caso.aberta, caso.fechada, false)
  animador.cancelar()

  // Telhado: a mesma porta pintada duas vezes, uma por cima da outra, a meio caminho.
  const meio = new Map<string, PortaAnimando>([['porta', { animacao, progresso: 0.5, abrindo: true }]])
  drawDoors(a.portas, comAnimacao(caso.fechada, id, vertical), null, zoom, resolucao, undefined, meio)
  const copia = new Graphics()
  a.mundo.addChild(copia)
  drawDoors(copia, comAnimacao(caso.fechada, id, vertical), null, zoom, resolucao, undefined, meio)
  drawDoors(b.portas, comAnimacao(caso.fechada, id, vertical), null, zoom, resolucao, undefined, meio)
  const telhado = diferentes(pixels(r, a.cena), pixels(r, b.cena))

  a.cena.destroy({ children: true })
  b.cena.destroy({ children: true })
  return { em0, em1, fimDoAbrir, fimDoFechar, semOpacidade, quadros, telhado }
}

/** Cor (0xrrggbb) e alfa do pixel (x, y) físico. */
function cor(p: Uint8ClampedArray, largura: number, x: number, y: number): { rgb: number; a: number } {
  const i = (y * largura + x) * 4
  return { rgb: (p[i] << 16) | (p[i + 1] << 8) | p[i + 2], a: p[i + 3] }
}

/** Corridas de cor ao longo de uma linha de pixels: [cor, tamanho][] (alfa 0 = -1). */
function corridas(valores: { rgb: number; a: number }[]): [number, number][] {
  const saida: [number, number][] = []
  for (const v of valores) {
    const c = v.a === 0 ? -1 : v.rgb
    const ultimo = saida[saida.length - 1]
    if (ultimo !== undefined && ultimo[0] === c) ultimo[1] += 1
    else saida.push([c, 1])
  }
  return saida
}

/**
 * M11: a porta PARADA, lida no pixel. A seção transversal no meio do vão
 * (corridas de cor) e a corrida ao longo do vão; o cadeado (pixels do corpo
 * creme); porta secreta com cor e trancada (sem cadeado).
 */
async function parada(estado: Partial<DoorState>, zoom: number, resolucao: number, vertical: boolean) {
  const r = await aplicacao(resolucao)
  const lado = QUADRO_DA_PARADA
  const p = palco(zoom, resolucao, vertical, false, lado, lado)
  drawDoors(p.portas, [porta(estado, vertical)], null, zoom, resolucao)
  const px = pixels(r, p.cena, lado, lado)
  const largura = Math.round(lado * resolucao)
  const altura = Math.round(lado * resolucao)
  // O meio do vão na tela, em pixel físico.
  const meioX = Math.floor((lado / 2) * resolucao)
  const meioY = Math.floor((lado / 2) * resolucao)
  // Um pouco fora do meio (um quarto do vão): o cadeado fica no meio e esconderia a seção.
  const quarto = Math.round(((VAO / 4) * zoom) * resolucao)
  const transversal: { rgb: number; a: number }[] = []
  const aoLongo: { rgb: number; a: number }[] = []
  if (vertical) {
    for (let x = meioX - 12 * resolucao; x <= meioX + 12 * resolucao; x += 1) transversal.push(cor(px, largura, x, meioY - quarto))
    for (let y = 0; y < altura; y += 1) aoLongo.push(cor(px, largura, meioX, y))
  } else {
    for (let y = meioY - 12 * resolucao; y <= meioY + 12 * resolucao; y += 1) transversal.push(cor(px, largura, meioX - quarto, y))
    for (let x = 0; x < largura; x += 1) aoLongo.push(cor(px, largura, x, meioY))
  }
  let cadeado = 0
  let semOpacidade = 0
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] !== 0 && px[i + 3] !== 255) semOpacidade += 1
    if (px[i + 3] === 255 && ((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]) === DOOR_PADLOCK_FILL) cadeado += 1
  }
  // Onde a cor da porta começa e acaba ao longo do vão, em px de tela, contra onde o vão começa e acaba.
  const inicioDoVao = lado / 2 - (VAO / 2) * zoom
  p.cena.destroy({ children: true })
  return { transversal: corridas(transversal), aoLongo: corridas(aoLongo), inicioDoVaoPx: inicioDoVao, fimDoVaoPx: inicioDoVao + VAO * zoom, cadeado, semOpacidade, resolucao }
}

/** Quadros de uma linha da folha de contato (8 abrindo, 8 fechando), pelo animador real no relógio de mentira. */
async function linhaDaFolha(id: string, caso: Caso): Promise<{ titulo: string; quadros: { src: string; rotulo: string }[] }> {
  const animacao = animacaoDePorta(id)
  if (animacao === null) throw new Error(`sem a animação ${id}`)
  const zoom = 2
  const r = await aplicacao(1)
  const { cena, portas } = palco(zoom, 1, false, true)
  const rel = relogio()
  const animador = createAnimadorDePortas({ ticker: rel.ticker, reducedMotion: () => false, now: rel.agora })
  const quadros: { src: string; rotulo: string }[] = []
  for (const abrindo of [true, false]) {
    animador.desenhar(portas, comAnimacao(abrindo ? caso.fechada : caso.aberta, id, false), null, zoom, 1)
    animador.desenhar(portas, comAnimacao(abrindo ? caso.aberta : caso.fechada, id, false), null, zoom, 1)
    const total = duracaoDoSentido(animacao, abrindo)
    let andado = 0
    for (let i = 0; i < 8; i += 1) {
      const ms = Math.round((total * i) / 7)
      if (ms > andado) rel.andar(ms - andado)
      andado = ms
      r.renderer.render(cena)
      quadros.push({ src: await r.renderer.extract.base64({ target: cena, frame: new Rectangle(0, 0, LARGURA, ALTURA) }), rotulo: `${abrindo ? 'abre' : 'fecha'} ${ms} ms` })
    }
    rel.andar(QUADRO_MS)
  }
  animador.cancelar()
  cena.destroy({ children: true })
  return { titulo: caso.titulo, quadros }
}

/** Centro dos pixels pintados de um Graphics, em px de tela (M5: continuidade do desenho). */
async function centro(id: string, progresso: number): Promise<{ x: number; y: number; n: number }> {
  const animacao = animacaoDePorta(id)
  if (animacao === null) throw new Error(`sem a animação ${id}`)
  const r = await aplicacao(1)
  const p = palco(2, 1, false, false)
  p.mundo.removeChildAt(0)
  drawDoors(p.portas, comAnimacao({}, id, false), null, 2, 1, undefined, new Map([['porta', { animacao, progresso, abrindo: true }]]))
  const px = pixels(r, p.cena)
  let sx = 0
  let sy = 0
  let n = 0
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    const k = i / 4
    sx += k % LARGURA
    sy += Math.floor(k / LARGURA)
    n += 1
  }
  p.cena.destroy({ children: true })
  return { x: n === 0 ? 0 : sx / n, y: n === 0 ? 0 : sy / n, n }
}

async function continuidade(id: string): Promise<{ maiorPassoPx: number; ondeMaior: number }> {
  let anterior = await centro(id, 0)
  let maior = 0
  let onde = 0
  for (let i = 1; i <= 200; i += 1) {
    const atual = await centro(id, i / 200)
    const passo = Math.hypot(atual.x - anterior.x, atual.y - anterior.y)
    if (passo > maior) {
      maior = passo
      onde = i / 200
    }
    anterior = atual
  }
  return { maiorPassoPx: maior, ondeMaior: onde }
}

/**
 * M3, M6, M7 e M8: o progresso que o animador entrega à animação, quadro a
 * quadro (60 Hz), no relógio de mentira. `inverterEm` = fração do tempo do
 * sentido em que a porta volta.
 */
function amostrar(id: string, abrindo: boolean, inverterEm: number | null = null, reduzido = false) {
  const original = animacaoDePorta(id)
  if (original === null) throw new Error(`sem a animação ${id}`)
  const progressos: { ms: number; p: number }[] = []
  let ultimo: number | null = null
  const espiao = original.desenhar
  // Lê o progresso do caminho no próprio desenho: o que a porta mostra é o que conta.
  original.desenhar = (g, porta, progresso, sentido) => {
    ultimo = progresso
    espiao(g, porta, progresso, sentido)
  }
  const g = new Graphics()
  const rel = relogio()
  const sons: EventoDeSomDaPorta[] = []
  const animador = createAnimadorDePortas({ ticker: rel.ticker, reducedMotion: () => reduzido, now: rel.agora, som: (e) => sons.push(e) })
  const estado = (open: boolean): Wall[] => [porta({ animacao: id, open }, false)]
  animador.desenhar(g, estado(!abrindo))
  ultimo = null
  animador.desenhar(g, estado(abrindo))
  let intermediarios = 0
  let invertido = false
  const total = duracaoDoSentido(original, abrindo)
  progressos.push({ ms: 0, p: ultimo ?? (abrindo ? 1 : 0) })
  let parou: { ms: number; p: number } | null = null
  for (let ms = QUADRO_MS; ms <= total * 2.2; ms += QUADRO_MS) {
    ultimo = null
    rel.andar(QUADRO_MS)
    if (inverterEm !== null && !invertido && ms >= total * inverterEm) {
      animador.desenhar(g, estado(!abrindo))
      invertido = true
    }
    if (ultimo !== null) {
      intermediarios += 1
      progressos.push({ ms, p: ultimo })
    } else if (parou === null) {
      parou = { ms, p: invertido ? (abrindo ? 0 : 1) : abrindo ? 1 : 0 }
      progressos.push(parou)
    }
  }
  original.desenhar = espiao
  animador.cancelar()
  g.destroy()
  return { progressos, sons, quadrosIntermediarios: intermediarios, chegouEmMs: parou?.ms ?? null, declaradoMs: total }
}

/** A curva de cada sentido, amostrada em 201 pontos (M3: sobe ou desce sempre, sem passar de 0 a 1). */
function curva(id: string): { abrir: number[]; fechar: number[] } {
  const animacao = animacaoDePorta(id)
  if (animacao === null) throw new Error(`sem a animação ${id}`)
  const amostra = (f: (t: number) => number) => Array.from({ length: 201 }, (_, i) => f(i / 200))
  return { abrir: amostra(curvaDoSentido(animacao, true)), fechar: amostra(curvaDoSentido(animacao, false)) }
}

/** Renderização offline de um evento de som, com o mestre e o passa-baixa da mesa (`lib/sons/contexto.ts`), no volume máximo. */
async function renderizarSom(evento: EventoDeSomDaPorta): Promise<{ amostras: number[]; taxa: number; inicioS: number; fimS: number }> {
  const taxa = 48000
  const inicioS = 0.05
  const ctx = new OfflineAudioContext(1, Math.ceil(1.4 * taxa), taxa)
  const mestre = ctx.createGain()
  const abafador = ctx.createBiquadFilter()
  abafador.type = 'lowpass'
  abafador.frequency.setValueAtTime(ABAFADOR_HZ, 0)
  mestre.connect(abafador)
  abafador.connect(ctx.destination)
  const fimS = agendarSomDePorta<AudioNode>(ctx, mestre, inicioS, evento)
  const buffer = await ctx.startRendering()
  return { amostras: Array.from(buffer.getChannelData(0)), taxa, inicioS, fimS }
}

/** O evento de som que o animador pede para o caminho inteiro de uma animação. */
function eventoDoCaminho(id: string, abrindo: boolean): EventoDeSomDaPorta {
  const { sons } = amostrar(id, abrindo)
  const evento = sons.find((s) => s.tipo === (abrindo ? 'abrir' : 'fechar'))
  if (evento === undefined) throw new Error(`${id}: o animador não pediu som`)
  return evento
}

/**
 * M9: 50 portas (5 x 10) no relógio REAL do Pixi, as 7 animações misturadas,
 * abrindo e fechando juntas a cada 700 ms por `duracaoMs`. Mede o intervalo
 * entre quadros (rAF), as tarefas longas e o custo do animador por quadro.
 */
async function estresse(duracaoMs: number) {
  const renderizador = new Application()
  await renderizador.init({ width: 1440, height: 900, antialias: true, background: CHAO, preference: 'webgl', resolution: 1 })
  document.body.appendChild(renderizador.canvas)
  const mundo = new Container()
  mundo.scale.set(1.2)
  const paredes = new Graphics()
  const portas = new Graphics()
  mundo.addChild(paredes, portas)
  renderizador.stage.addChild(mundo)
  const ids = ['girar', 'deslizar', ...Object.keys(MODULOS)]
  const fechadas: Wall[] = []
  for (let linha = 0; linha < 5; linha += 1) for (let coluna = 0; coluna < 10; coluna += 1) fechadas.push(porta({ animacao: ids[(linha * 10 + coluna) % ids.length] }, false, `p${linha}-${coluna}`, 20 + coluna * 115, 60 + linha * 140))
  drawWalls(paredes, fechadas.flatMap((w, i) => [parede(`a${i}`, w.x1 - 10, w.y1, w.x1, w.y1), parede(`b${i}`, w.x2, w.y2, w.x2 + 10, w.y2)]), null, 1.2, 1)
  const animador = createAnimadorDePortas({ ticker: renderizador.ticker, reducedMotion: () => false })
  let abertas = false
  const estado = (): Wall[] => fechadas.map((w) => (w.door === null ? w : { ...w, door: { ...w.door, open: abertas } }))
  animador.desenhar(portas, estado(), null, 1.2, 1)
  const custo: number[] = []
  let antes = 0
  renderizador.ticker.add(() => {
    antes = performance.now()
  }, undefined, UPDATE_PRIORITY.NORMAL + 1)
  renderizador.ticker.add(() => custo.push(performance.now() - antes), undefined, UPDATE_PRIORITY.NORMAL - 1)
  const tarefasLongas: number[] = []
  let observadorAtivo = false
  const observador = new PerformanceObserver((lista) => {
    for (const e of lista.getEntries()) tarefasLongas.push(e.duration)
  })
  try {
    observador.observe({ type: 'longtask', buffered: false })
    observadorAtivo = true
  } catch {
    observadorAtivo = false
  }
  const intervalos: number[] = []
  const troca = setInterval(() => {
    abertas = !abertas
    animador.desenhar(portas, estado(), null, 1.2, 1)
  }, 700)
  await new Promise<void>((pronto) => {
    let anterior = performance.now()
    const inicio = anterior
    const passo = (agora: number): void => {
      intervalos.push(agora - anterior)
      anterior = agora
      if (agora - inicio < duracaoMs) requestAnimationFrame(passo)
      else pronto()
    }
    requestAnimationFrame(passo)
  })
  clearInterval(troca)
  observador.disconnect()
  animador.cancelar()
  renderizador.destroy(true, { children: true })
  return { intervalos: intervalos.slice(1), tarefasLongas, custo, portas: fechadas.length, observadorAtivo }
}

/** Folha de contato: as linhas, um quadro ao lado do outro, o tempo embaixo de cada um. */
async function compor(titulo: string, linhas: { titulo: string; quadros: { src: string; rotulo: string }[] }[]): Promise<string> {
  const carregar = (src: string) =>
    new Promise<HTMLImageElement>((ok, erro) => {
      const img = new Image()
      img.onload = () => ok(img)
      img.onerror = () => erro(new Error('quadro não carregou'))
      img.src = src
    })
  const colunas = 8
  const margem = 24
  const espaco = 6
  const c = document.createElement('canvas')
  const blocos = linhas.flatMap((l) => [l.quadros.slice(0, 8), l.quadros.slice(8)].map((quadros, k) => ({ titulo: `${l.titulo}: ${k === 0 ? 'abrindo' : 'fechando'}`, quadros })))
  c.width = margem * 2 + colunas * LARGURA + (colunas - 1) * espaco
  c.height = 70 + blocos.length * (34 + ALTURA + 30) + margem
  const g = c.getContext('2d')
  if (g === null) throw new Error('sem canvas 2D')
  g.fillStyle = '#fcfcfb'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#0b0b0b'
  g.font = '600 26px system-ui, sans-serif'
  g.fillText(titulo, margem, 42)
  let y = 70
  for (const bloco of blocos) {
    g.fillStyle = '#52514e'
    g.font = '500 19px system-ui, sans-serif'
    g.fillText(bloco.titulo, margem, y + 22)
    y += 34
    for (let i = 0; i < bloco.quadros.length; i += 1) {
      const x = margem + i * (LARGURA + espaco)
      g.drawImage(await carregar(bloco.quadros[i].src), x, y, LARGURA, ALTURA)
      g.fillStyle = '#0b0b0b'
      g.font = '500 16px system-ui, sans-serif'
      const texto = bloco.quadros[i].rotulo
      g.fillText(texto, x + (LARGURA - g.measureText(texto).width) / 2, y + ALTURA + 22)
    }
    y += ALTURA + 30
  }
  return c.toDataURL('image/png')
}

declare global {
  interface Window {
    PortaA3: typeof api
  }
}

const api = { carregarAsCinco, extremos, parada, linhaDaFolha, continuidade, centro, amostrar, curva, renderizarSom, eventoDoCaminho, estresse, compor }

window.PortaA3 = api
document.documentElement.dataset.pronto = 'sim'
