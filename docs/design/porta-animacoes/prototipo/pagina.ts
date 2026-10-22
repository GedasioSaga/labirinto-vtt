/**
 * A vitrine: oito portas, cada uma num palco do app (paredes reais, animador
 * proposto, drawDoors proposto), com seletor de animação, cor, trancar, abrir e
 * ouvir. Um renderer Pixi só (WebGL) pinta todos os palcos e copia para o canvas
 * de cada cartão: oito contextos WebGL estourariam o limite de celular.
 */
import { autoDetectRenderer, type Renderer } from 'pixi.js'
import { duracaoDoSentido } from '../portas/animacoesDePorta'
import { animacaoPorId, descricaoDe, ehNova, PALETA, registrarNovas, todasAsAnimacoes } from './catalogo'
import { ALTURA_CSS, CHAOS, criarCena, desenharPortas, LARGURA_CSS, montarFundo, paredeDaPorta, pintarNoCanvas, type Cena, type Chao, type EstadoDaPorta, type Orientacao } from './palco'
import { agendarSom, duracaoDoSentidoS, temSom, type SomTocando } from './som'
import { criarEstresse, type Estresse } from './estresse'

const RESOLUCAO = Math.max(1, Math.min(2, Math.round(window.devicePixelRatio || 1)))
const PAUSA_DO_REPETIR_MS = 700
const SEM_ANIMACAO_REPETIR_MS = 900

/** Relógio virtual: anda na velocidade escolhida (1x, 0,5x, 0,25x) sem saltar quando ela muda. */
function criarRelogio(): { agora: () => number; mudarVelocidade: (v: number) => void; velocidade: () => number } {
  let real = performance.now()
  let virtual = 0
  let velocidade = 1
  const agora = (): number => {
    const r = performance.now()
    virtual += (r - real) * velocidade
    real = r
    return virtual
  }
  return {
    agora,
    mudarVelocidade: (v) => {
      agora()
      velocidade = v
    },
    velocidade: () => velocidade,
  }
}

export const relogio = criarRelogio()

const consultaReduzido = window.matchMedia('(prefers-reduced-motion: reduce)')

export const ajustes = {
  repetir: false,
  zoom: 2,
  chao: 'escuro' as Chao,
  somAoAbrir: true,
  volume: 0.5,
  reduzidoSimulado: false,
}

export function movimentoReduzido(): boolean {
  return ajustes.reduzidoSimulado || consultaReduzido.matches
}

interface Cartao {
  el: HTMLElement
  ctx: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  cena: Cena
  comTelhado: boolean
  orientacao: Orientacao
  estado: EstadoDaPorta
  sujo: boolean
  som: SomTocando | null
  proximaTroca: number
  ui: {
    nome: HTMLElement
    tipo: HTMLElement
    descricao: HTMLElement
    tempos: HTMLElement
    select: HTMLSelectElement
    cores: HTMLButtonElement[]
    livre: HTMLInputElement
    livreRotulo: HTMLElement
    contraste: HTMLElement
    orientacoes: HTMLButtonElement[]
    abrir: HTMLButtonElement
    trancar: HTMLButtonElement
    ouvir: HTMLButtonElement
    aviso: HTMLElement
    avisoDoSom: HTMLElement
  }
}

const INICIAIS: readonly { animacao: string; orientacao: Orientacao; telhado?: boolean }[] = [
  { animacao: 'dupla', orientacao: 'horizontal' },
  { animacao: 'grade', orientacao: 'vertical' },
  { animacao: 'arrombada', orientacao: 'horizontal' },
  { animacao: 'sanfona', orientacao: 'vertical' },
  { animacao: 'cortina', orientacao: 'horizontal' },
  { animacao: 'girar', orientacao: 'vertical' },
  { animacao: 'deslizar', orientacao: 'horizontal' },
  { animacao: 'arrombada', orientacao: 'horizontal', telhado: true },
]

let renderer: Renderer | null = null
const cartoes: Cartao[] = []
let laco = false
let audio: { ctx: AudioContext; mestre: GainNode } | null = null

function exigir<T extends Element>(raiz: ParentNode, seletor: string): T {
  const el = raiz.querySelector<T>(seletor)
  if (el === null) throw new Error(`a página está sem "${seletor}"`)
  return el
}

const hex = (cor: number): string => `#${cor.toString(16).padStart(6, '0')}`

function luminancia(cor: number): number {
  const canal = (c: number): number => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal((cor >> 16) & 255) + 0.7152 * canal((cor >> 8) & 255) + 0.0722 * canal(cor & 255)
}

export function contraste(a: number, b: number): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}

const virgula = (n: number, casas = 1): string => n.toFixed(casas).replace('.', ',')

function corPintada(estado: EstadoDaPorta): number {
  if (estado.cor !== undefined) return estado.cor
  return estado.trancada ? 0xc0392b : 0xd08c3a
}

// ---------------------------------------------------------------------------
// Som
// ---------------------------------------------------------------------------

function garantirAudio(): { ctx: AudioContext; mestre: GainNode } {
  if (audio === null) {
    const ctx = new AudioContext()
    const mestre = ctx.createGain()
    mestre.gain.value = ajustes.volume
    mestre.connect(ctx.destination)
    audio = { ctx, mestre }
  }
  if (audio.ctx.state === 'suspended') void audio.ctx.resume()
  return audio
}

export function aplicarVolume(): void {
  if (audio !== null) audio.mestre.gain.setTargetAtTime(ajustes.volume, audio.ctx.currentTime, 0.02)
}

/** Por que o som não toca agora, ou `null` se toca. */
function motivoSemSom(id: string | null): string | null {
  if (movimentoReduzido()) return 'Som mudo: o movimento reduzido está ligado.'
  if (!temSom(id)) return id === 'girar' || id === 'deslizar' ? 'O som do Girar e do Deslizar está sendo feito no app, em outro trabalho.' : 'Sem animação, sem som.'
  return null
}

function tocar(cartao: Cartao, abrindo: boolean): void {
  const id = cartao.estado.animacao
  const animacao = animacaoPorId(id)
  if (!temSom(id) || animacao === null || motivoSemSom(id) !== null) return
  const { ctx, mestre } = garantirAudio()
  cartao.som?.parar()
  cartao.som = agendarSom(ctx, mestre, id, abrindo, ctx.currentTime + 0.005, animacao)
}

// ---------------------------------------------------------------------------
// Laço de quadros
// ---------------------------------------------------------------------------

function pedirQuadro(): void {
  if (laco) return
  laco = true
  requestAnimationFrame(quadro)
}

function quadro(): void {
  laco = false
  if (renderer === null) return
  const agora = relogio.agora()
  let continuar = ajustes.repetir
  for (const cartao of cartoes) {
    if (ajustes.repetir && !cartao.estado.trancada && agora >= cartao.proximaTroca) alternar(cartao, true)
    const animando = cartao.cena.ticker.count > 0
    if (animando) cartao.cena.ticker.update(performance.now())
    if (animando || cartao.sujo) {
      pintarNoCanvas(renderer, cartao.cena, cartao.ctx)
      cartao.sujo = false
    }
    if (cartao.cena.ticker.count > 0) continuar = true
  }
  if (continuar) pedirQuadro()
}

// ---------------------------------------------------------------------------
// Cartão
// ---------------------------------------------------------------------------

function redesenharPorta(cartao: Cartao): void {
  desenharPortas(cartao.cena, paredeDaPorta(cartao.orientacao, cartao.estado), ajustes.zoom, RESOLUCAO)
  cartao.sujo = true
  pedirQuadro()
}

function remontar(cartao: Cartao): void {
  montarFundo(cartao.cena, cartao.orientacao, ajustes.zoom, ajustes.chao, RESOLUCAO)
  redesenharPorta(cartao)
}

function alternar(cartao: Cartao, emLote = false): void {
  if (cartao.estado.trancada) return
  cartao.estado.aberta = !cartao.estado.aberta
  const animacao = animacaoPorId(cartao.estado.animacao)
  const agora = relogio.agora()
  cartao.proximaTroca = agora + (animacao === null ? SEM_ANIMACAO_REPETIR_MS : duracaoDoSentido(animacao, cartao.estado.aberta) + PAUSA_DO_REPETIR_MS)
  redesenharPorta(cartao)
  // Som só no clique da própria porta: "Abrir todas" e "Repetir" tocariam oito sons juntos.
  if (relogio.velocidade() === 1 && ajustes.somAoAbrir && !emLote) tocar(cartao, cartao.estado.aberta)
  atualizarUi(cartao)
}

function nomeDaAnimacao(id: string | null): string {
  return id === null ? 'Sem animação' : (animacaoPorId(id)?.nome ?? id)
}

function atualizarUi(cartao: Cartao): void {
  const { ui, estado } = cartao
  const animacao = animacaoPorId(estado.animacao)
  ui.nome.textContent = cartao.comTelhado ? 'Sobre o telhado' : nomeDaAnimacao(estado.animacao)
  ui.tipo.textContent = cartao.comTelhado ? nomeDaAnimacao(estado.animacao) : ehNova(estado.animacao) ? 'nova' : estado.animacao === null ? '' : 'de hoje'
  ui.tipo.dataset.tipo = ehNova(estado.animacao) ? 'nova' : 'hoje'
  ui.descricao.textContent = cartao.comTelhado ? 'A porta da frente de uma casa: o beiral cobre a porta e a cópia de cima, opaca, aparece por cima dele.' : descricaoDe(estado.animacao)
  ui.tempos.textContent = animacao === null ? 'Troca na hora.' : `Abre em ${duracaoDoSentido(animacao, true)} ms e fecha em ${duracaoDoSentido(animacao, false)} ms.`
  ui.abrir.textContent = estado.aberta ? 'Fechar' : 'Abrir'
  ui.abrir.disabled = estado.trancada
  ui.trancar.textContent = estado.trancada ? 'Destrancar' : 'Trancar'
  ui.trancar.disabled = estado.aberta && !estado.trancada
  ui.aviso.textContent = estado.trancada ? 'Trancada: destranque para abrir.' : estado.aberta ? 'Aberta: feche para poder trancar.' : ''
  const semSom = motivoSemSom(estado.animacao)
  ui.ouvir.disabled = semSom !== null
  ui.avisoDoSom.textContent = semSom ?? ''
  ui.select.value = estado.animacao ?? ''
  const escolhida = PALETA.findIndex((c) => c.cor === estado.cor)
  ui.cores.forEach((botao, i) => botao.setAttribute('aria-checked', String(i === escolhida)))
  const livre = escolhida < 0
  ui.livreRotulo.dataset.marcado = String(livre)
  if (livre && estado.cor !== undefined) ui.livre.value = hex(estado.cor)
  const razao = contraste(corPintada(estado), CHAOS[ajustes.chao].cor)
  ui.contraste.textContent = `Contraste com o chão: ${virgula(razao)}:1${razao < 3 ? ', fraco: a porta some no chão' : ''}`
  ui.contraste.dataset.fraco = String(razao < 3)
  ui.orientacoes.forEach((botao) => botao.setAttribute('aria-checked', String(botao.dataset.orientacao === cartao.orientacao)))
  const corNome = PALETA[escolhida]?.nome ?? hex(corPintada(estado))
  cartao.canvas.setAttribute('aria-label', `Porta ${cartao.orientacao}, ${estado.trancada ? 'trancada' : estado.aberta ? 'aberta' : 'fechada'}, cor ${corNome}, animação ${nomeDaAnimacao(estado.animacao)}`)
}

function criarCartao(modelo: HTMLTemplateElement, inicial: (typeof INICIAIS)[number], indice: number): Cartao {
  const fragmento = modelo.content.cloneNode(true) as DocumentFragment
  const el = exigir<HTMLElement>(fragmento, '.cartao')
  const canvas = exigir<HTMLCanvasElement>(el, 'canvas')
  canvas.width = LARGURA_CSS * RESOLUCAO
  canvas.height = ALTURA_CSS * RESOLUCAO
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('canvas 2D indisponível')
  const comTelhado = inicial.telhado === true
  const select = exigir<HTMLSelectElement>(el, 'select')
  select.id = `animacao-${indice}`
  exigir<HTMLLabelElement>(el, '.rotulo-animacao').htmlFor = select.id
  const grupoNovas = document.createElement('optgroup')
  grupoNovas.label = 'Novas, para aprovar'
  const grupoHoje = document.createElement('optgroup')
  grupoHoje.label = 'As de hoje'
  for (const animacao of todasAsAnimacoes()) {
    const opcao = new Option(animacao.nome, animacao.id)
    ;(ehNova(animacao.id) ? grupoNovas : grupoHoje).append(opcao)
  }
  select.append(grupoNovas, grupoHoje, new Option('Sem animação', ''))
  const paleta = exigir<HTMLElement>(el, '.paleta')
  const cores = PALETA.map((cor) => {
    const botao = document.createElement('button')
    botao.type = 'button'
    botao.className = 'amostra'
    botao.setAttribute('role', 'radio')
    botao.setAttribute('aria-label', cor.nome)
    botao.title = cor.nome
    botao.style.setProperty('--amostra', hex(cor.amostra))
    paleta.append(botao)
    return botao
  })
  const livreRotulo = exigir<HTMLElement>(el, '.livre')
  paleta.append(livreRotulo)
  const cartao: Cartao = {
    el,
    ctx,
    canvas,
    cena: criarCena(comTelhado, relogio.agora, movimentoReduzido),
    comTelhado,
    orientacao: inicial.orientacao,
    estado: { aberta: false, trancada: false, animacao: inicial.animacao, cor: undefined },
    sujo: true,
    som: null,
    proximaTroca: 0,
    ui: {
      nome: exigir(el, '.nome'),
      tipo: exigir(el, '.tipo'),
      descricao: exigir(el, '.descricao'),
      tempos: exigir(el, '.tempos'),
      select,
      cores,
      livre: exigir(el, '.livre input'),
      livreRotulo,
      contraste: exigir(el, '.contraste'),
      orientacoes: [...el.querySelectorAll<HTMLButtonElement>('.orientacao button')],
      abrir: exigir(el, '.abrir'),
      trancar: exigir(el, '.trancar'),
      ouvir: exigir(el, '.ouvir'),
      aviso: exigir(el, '.aviso'),
      avisoDoSom: exigir(el, '.aviso-do-som'),
    },
  }
  if (comTelhado) el.classList.add('com-telhado')
  cartao.ui.abrir.addEventListener('click', () => alternar(cartao))
  cartao.ui.trancar.addEventListener('click', () => {
    if (cartao.estado.aberta && !cartao.estado.trancada) return
    cartao.estado.trancada = !cartao.estado.trancada
    redesenharPorta(cartao)
    atualizarUi(cartao)
  })
  cartao.ui.ouvir.addEventListener('click', () => {
    const animacao = animacaoPorId(cartao.estado.animacao)
    if (animacao === null) return
    tocar(cartao, true)
    // O de fechar logo depois do de abrir, com uma pausa: os dois sentidos numa escuta.
    const { ctx, mestre } = garantirAudio()
    const id = cartao.estado.animacao
    if (temSom(id)) agendarSom(ctx, mestre, id, false, ctx.currentTime + 0.005 + duracaoDoSentidoS(animacao, true) + 0.45, animacao)
  })
  select.addEventListener('change', () => {
    cartao.estado.animacao = select.value === '' ? null : select.value
    atualizarUi(cartao)
    redesenharPorta(cartao)
  })
  cores.forEach((botao, i) =>
    botao.addEventListener('click', () => {
      cartao.estado.cor = PALETA[i].cor
      redesenharPorta(cartao)
      atualizarUi(cartao)
    }),
  )
  cartao.ui.livre.addEventListener('input', () => {
    cartao.estado.cor = Number.parseInt(cartao.ui.livre.value.slice(1), 16)
    redesenharPorta(cartao)
    atualizarUi(cartao)
  })
  for (const botao of cartao.ui.orientacoes) {
    botao.addEventListener('click', () => {
      const orientacao = botao.dataset.orientacao === 'vertical' ? 'vertical' : 'horizontal'
      if (orientacao === cartao.orientacao) return
      cartao.orientacao = orientacao
      // Outra parede: o animador vê uma porta nova (sem animar), como no app.
      cartao.cena.animador.cancelar()
      cartao.cena.animadorDoTelhado?.cancelar()
      remontar(cartao)
      atualizarUi(cartao)
    })
  }
  return cartao
}

// ---------------------------------------------------------------------------
// Barra de cima
// ---------------------------------------------------------------------------

function ligarSegmentado(grupo: HTMLElement, aoEscolher: (valor: string) => void): void {
  const botoes = [...grupo.querySelectorAll<HTMLButtonElement>('button')]
  for (const botao of botoes) {
    botao.addEventListener('click', () => {
      for (const outro of botoes) outro.setAttribute('aria-checked', String(outro === botao))
      aoEscolher(botao.dataset.valor ?? '')
    })
  }
}

function ligarChave(botao: HTMLButtonElement, aoMudar: (ligada: boolean) => void): void {
  botao.addEventListener('click', () => {
    const ligada = botao.getAttribute('aria-pressed') !== 'true'
    botao.setAttribute('aria-pressed', String(ligada))
    aoMudar(ligada)
  })
}

function atualizarAvisoGlobal(): void {
  const aviso = exigir<HTMLElement>(document, '#aviso-global')
  const partes: string[] = []
  if (movimentoReduzido()) partes.push(ajustes.reduzidoSimulado ? 'Movimento reduzido simulado: as portas trocam na hora e o som fica mudo.' : 'Seu sistema pede movimento reduzido: as portas trocam na hora e o som fica mudo.')
  if (relogio.velocidade() !== 1) partes.push('Na velocidade lenta o som não toca (ele não estica junto).')
  aviso.textContent = partes.join(' ')
}

function ligarBarra(): void {
  ligarSegmentado(exigir(document, '#velocidade'), (v) => {
    relogio.mudarVelocidade(Number(v))
    atualizarAvisoGlobal()
  })
  ligarSegmentado(exigir(document, '#zoom'), (v) => {
    ajustes.zoom = Number(v)
    for (const cartao of cartoes) remontar(cartao)
  })
  ligarSegmentado(exigir(document, '#chao'), (v) => {
    ajustes.chao = v === 'pedra' || v === 'grama' ? v : 'escuro'
    for (const cartao of cartoes) {
      remontar(cartao)
      atualizarUi(cartao)
    }
  })
  ligarChave(exigir(document, '#repetir'), (ligada) => {
    ajustes.repetir = ligada
    const agora = relogio.agora()
    for (const cartao of cartoes) cartao.proximaTroca = agora
    pedirQuadro()
  })
  ligarChave(exigir(document, '#som-ao-abrir'), (ligada) => {
    ajustes.somAoAbrir = ligada
  })
  const volume = exigir<HTMLInputElement>(document, '#volume')
  volume.addEventListener('input', () => {
    ajustes.volume = Number(volume.value) / 100
    aplicarVolume()
  })
  ligarChave(exigir(document, '#reduzido'), (ligada) => {
    ajustes.reduzidoSimulado = ligada
    for (const cartao of cartoes) atualizarUi(cartao)
    atualizarAvisoGlobal()
  })
  exigir<HTMLButtonElement>(document, '#abrir-todas').addEventListener('click', () => {
    for (const cartao of cartoes) if (!cartao.estado.aberta && !cartao.estado.trancada) alternar(cartao, true)
  })
  exigir<HTMLButtonElement>(document, '#fechar-todas').addEventListener('click', () => {
    for (const cartao of cartoes) if (cartao.estado.aberta) alternar(cartao, true)
  })
  consultaReduzido.addEventListener('change', () => {
    for (const cartao of cartoes) atualizarUi(cartao)
    atualizarAvisoGlobal()
  })
  ligarTema()
}

function ligarTema(): void {
  const grupo = exigir<HTMLElement>(document, '#tema')
  let salvo: string | null = null
  try {
    salvo = localStorage.getItem('porta-animacoes:tema')
  } catch {
    salvo = null
  }
  const aplicar = (valor: string): void => {
    if (valor === 'light' || valor === 'dark') document.documentElement.dataset.theme = valor
    else delete document.documentElement.dataset.theme
    for (const botao of grupo.querySelectorAll<HTMLButtonElement>('button')) botao.setAttribute('aria-checked', String((botao.dataset.valor ?? '') === valor))
  }
  aplicar(salvo ?? '')
  ligarSegmentado(grupo, (valor) => {
    aplicar(valor)
    try {
      localStorage.setItem('porta-animacoes:tema', valor)
    } catch {
      // sem armazenamento (janela privada): o tema vale só até recarregar
    }
  })
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

let estresse: Estresse | null = null

export function estresseDaPagina(): Estresse | null {
  return estresse
}

export async function iniciar(): Promise<void> {
  registrarNovas()
  renderer = await autoDetectRenderer({ width: LARGURA_CSS, height: ALTURA_CSS, resolution: RESOLUCAO, antialias: true, preserveDrawingBuffer: true, background: 0x2b2b2b, preference: 'webgl' })
  const grade = exigir<HTMLElement>(document, '#portas')
  const modelo = exigir<HTMLTemplateElement>(document, '#modelo-cartao')
  INICIAIS.forEach((inicial, i) => {
    const cartao = criarCartao(modelo, inicial, i)
    cartoes.push(cartao)
    grade.append(cartao.el)
    remontar(cartao)
    atualizarUi(cartao)
  })
  ligarBarra()
  atualizarAvisoGlobal()
  estresse = criarEstresse(exigir(document, '#estresse'), movimentoReduzido)
  document.documentElement.dataset.pronto = 'sim'
}
