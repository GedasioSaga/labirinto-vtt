import { theme } from '../theme'

/**
 * DICAS SOB DEMANDA no painel do mestre (peça P3 do laudo do painel, 26/09/2026).
 *
 * A frase que explica um controle (`p.lb-field__hint` ligado a ele por
 * `aria-describedby`) sai do fluxo da coluna e vira um balão: aparece quando o
 * mestre para o ponteiro na linha do controle ou chega nela pelo teclado, e
 * some ao sair. A coluna encolhe o que as frases ocupavam e nada se mexe
 * quando o balão abre (ele é `position: fixed`, por cima do painel). A frase
 * continua no DOM, com o mesmo `id` e o mesmo texto: o leitor de tela segue
 * lendo a descrição do controle, aberta ou não.
 *
 * O que NÃO vira balão, e continua à vista no fluxo:
 * - frase sem ligação com um controle (aviso de estado, lista vazia, a
 *   instrução da ferramenta armada): é conteúdo, não explicação;
 * - frase de um controle desabilitado: é o motivo de ele não fazer nada, e o
 *   teclado nem chega nele;
 * - frase dentro do "Avançado": a seção já é a camada sob demanda, quem a abriu
 *   veio ler a explicação;
 * - frase com a classe `lb-field__hint--fixa`: o componente diz que é aviso.
 *
 * Um único ouvinte por tipo de evento, no documento, e um MutationObserver que
 * reclassifica quando o painel troca de conteúdo. Nenhum componente muda: a
 * ligação `aria-describedby` que cada um já declara é o contrato.
 *
 * Gestos (catálogo de convenções, "Dica de ferramenta"):
 * - pairar espera `ESPERA_DO_PRIMEIRO_MS` só no primeiro balão; o da linha
 *   vizinha abre na hora, sem animação, enquanto a janela do vizinho durar;
 * - foco que chegou pelo teclado abre na hora; `Esc` fecha (e só fecha: o Esc
 *   seguinte volta a largar a seleção, como antes);
 * - apertar a linha é usar o controle: o balão sai da frente e não volta
 *   enquanto o ponteiro ficar nela;
 * - rolar o corpo fecha o balão de pairar (o conteúdo andou sob o ponteiro).
 */

/** Tempo parado sobre a linha antes do PRIMEIRO balão. */
export const ESPERA_DO_PRIMEIRO_MS = 400

/** Depois que um balão de pairar fecha, o da linha vizinha ainda abre na hora durante esta janela. */
export const JANELA_DO_VIZINHO_MS = 500

const SELETOR_CORPO = '.lb-inspector__body'
const SELETOR_DICA = '.lb-field__hint'
const CLASSE_FIXA = 'lb-field__hint--fixa'
const SELETOR_AVANCADO = '.lb-advanced__item'
const SELETOR_LINHA = '[data-dica-linha]'

const px = (valor: string) => Number.parseFloat(valor)

/** Vão entre a linha e o balão, onde mora a seta. */
const FOLGA_PX = px(theme.space[2])

/** Respiro das seções do painel: o balão fica na mesma coluna dos rótulos. */
const RECUO_PX = px(theme.space[4])

/** Entre dois balões da mesma linha (controle com mais de uma frase). */
const PILHA_PX = px(theme.space[1])

/** A seta nunca encosta no canto arredondado do balão (mesmo recuo de `hintPlacement.ts`). */
const SETA_RECUO_PX = 12

export interface Caixa {
  left: number
  top: number
  right: number
  bottom: number
}

export type Lado = 'abaixo' | 'acima'

export interface EntradaDoBalao {
  /** Caixa da linha que o balão explica, em px de viewport. */
  linha: Caixa
  /** Tamanho já medido do balão (ou da pilha de balões da linha). */
  largura: number
  altura: number
  /** Parte visível do corpo que rola, já sem a faixa fixa do topo. */
  area: Caixa
  /** Até onde o balão pode ir quando não cabe inteiro na área: o painel. */
  limite: Caixa
  folga: number
  recuo: number
}

export interface Posicao {
  x: number
  y: number
  lado: Lado
  /** Centro da seta, em px a partir da borda esquerda do balão. */
  seta: number
}

const clamp = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), maximo)

/**
 * Onde o balão fica: embaixo da linha se couber na parte visível do corpo, em
 * cima se só lá couber, e do lado mais folgado se nenhum couber (preso ao
 * painel). Na horizontal, alinhado ao começo da linha e nunca além da borda
 * direita da coluna; a seta aponta o começo do rótulo.
 */
export function posicionarBalao({ linha, largura, altura, area, limite, folga, recuo }: EntradaDoBalao): Posicao {
  const espacoAbaixo = area.bottom - (linha.bottom + folga)
  const espacoAcima = linha.top - folga - area.top
  let lado: Lado
  if (espacoAbaixo >= altura) lado = 'abaixo'
  else if (espacoAcima >= altura) lado = 'acima'
  else lado = espacoAbaixo >= espacoAcima ? 'abaixo' : 'acima'

  const yIdeal = lado === 'abaixo' ? linha.bottom + folga : linha.top - folga - altura
  const yMinimo = limite.top + folga
  const y = clamp(yIdeal, yMinimo, Math.max(yMinimo, limite.bottom - folga - altura))

  const xMinimo = area.left + recuo
  const x = clamp(linha.left, xMinimo, Math.max(xMinimo, area.right - recuo - largura))
  const seta = clamp(linha.left + SETA_RECUO_PX - x, SETA_RECUO_PX, Math.max(SETA_RECUO_PX, largura - SETA_RECUO_PX))
  return { x, y, lado, seta }
}

export interface Classificacao {
  /** Frases que viram balão: explicam um controle que o mestre pode usar agora. */
  sobDemanda: HTMLElement[]
  /** Cada linha (o que se paira e onde o foco cai) e as frases que ela abre. */
  linhas: Map<HTMLElement, HTMLElement[]>
}

function idsDescritos(controle: Element): string[] {
  return (controle.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id !== '')
}

function estaAtivo(controle: Element): boolean {
  return !controle.matches(':disabled') && controle.getAttribute('aria-disabled') !== 'true'
}

function ehFixaPeloAutor(dica: Element): boolean {
  return dica.classList.contains(CLASSE_FIXA) || dica.closest(SELETOR_AVANCADO) !== null
}

function acrescentar<Chave, Valor>(mapa: Map<Chave, Valor[]>, chave: Chave, valor: Valor): void {
  const lista = mapa.get(chave)
  if (lista === undefined) mapa.set(chave, [valor])
  else if (!lista.includes(valor)) lista.push(valor)
}

/**
 * A linha de um controle: o interruptor inteiro (rótulo e trilho); o campo
 * (`.lb-field`, rótulo e controle) quando ele é o único controle com frase ali
 * dentro; senão o próprio controle.
 */
function linhaDoControle(controle: HTMLElement, corpo: HTMLElement, descritos: ReadonlySet<HTMLElement>): HTMLElement {
  const interruptor = controle.closest<HTMLElement>('label.lb-switch')
  if (interruptor !== null && corpo.contains(interruptor)) return interruptor
  const campo = controle.closest<HTMLElement>('.lb-field')
  if (campo !== null && campo !== corpo && corpo.contains(campo)) {
    const outro = [...descritos].some((d) => d !== controle && campo.contains(d))
    if (!outro) return campo
  }
  return controle
}

/** Quais frases do corpo viram balão e de qual linha cada uma sai. Não muda o DOM. */
export function classificarDicas(corpo: HTMLElement): Classificacao {
  const porId = new Map<string, HTMLElement>()
  for (const dica of corpo.querySelectorAll<HTMLElement>(SELETOR_DICA)) {
    if (dica.id !== '' && !ehFixaPeloAutor(dica)) porId.set(dica.id, dica)
  }

  const quemDescreve = new Map<HTMLElement, HTMLElement[]>()
  const frasesDoControle = new Map<HTMLElement, HTMLElement[]>()
  for (const controle of corpo.querySelectorAll<HTMLElement>('[aria-describedby]')) {
    for (const id of idsDescritos(controle)) {
      const dica = porId.get(id)
      if (dica === undefined) continue
      acrescentar(quemDescreve, dica, controle)
      acrescentar(frasesDoControle, controle, dica)
    }
  }

  const sobDemanda = new Set<HTMLElement>()
  for (const [dica, controles] of quemDescreve) {
    if (controles.some(estaAtivo)) sobDemanda.add(dica)
  }

  const descritos = new Set<HTMLElement>()
  for (const [controle, frases] of frasesDoControle) {
    if (estaAtivo(controle) && frases.some((dica) => sobDemanda.has(dica))) descritos.add(controle)
  }

  const linhas = new Map<HTMLElement, HTMLElement[]>()
  for (const controle of descritos) {
    const linha = linhaDoControle(controle, corpo, descritos)
    for (const dica of frasesDoControle.get(controle) ?? []) {
      if (sobDemanda.has(dica)) acrescentar(linhas, linha, dica)
    }
  }

  return { sobDemanda: [...sobDemanda], linhas }
}

type Origem = 'pairar' | 'foco'

interface Aberta {
  linha: HTMLElement
  dicas: HTMLElement[]
  origem: Origem
}

function caixaDe(retangulo: DOMRect): Caixa {
  return { left: retangulo.left, top: retangulo.top, right: retangulo.right, bottom: retangulo.bottom }
}

/** O Chromium tem `checkVisibility`; o jsdom não, e lá o `hidden` do ancestral basta. */
function estaDesenhada(elemento: HTMLElement): boolean {
  return typeof elemento.checkVisibility === 'function' ? elemento.checkVisibility() : elemento.closest('[hidden]') === null
}

function ehSoModificador(evento: KeyboardEvent): boolean {
  return evento.key === 'Shift' || evento.key === 'Control' || evento.key === 'Alt' || evento.key === 'Meta'
}

let desinstalarAtual: (() => void) | null = null

/**
 * Liga as dicas sob demanda no documento (uma vez, em `main.tsx`, antes do
 * primeiro render). Devolve o desligamento, que também devolve cada frase ao
 * fluxo.
 */
export function instalarDicasDoPainel(doc: Document = document): () => void {
  desinstalarAtual?.()
  const janela = doc.defaultView
  if (janela === null) return () => {}

  let modalidade: 'teclado' | 'ponteiro' = 'ponteiro'
  let aberta: Aberta | null = null
  let linhaSobPonteiro: HTMLElement | null = null
  let dispensadaPairar: HTMLElement | null = null
  let dispensadaFoco: HTMLElement | null = null
  let espera: ReturnType<typeof setTimeout> | null = null
  let fechouPairarEm = Number.NEGATIVE_INFINITY
  let ultimoPonteiro: { x: number; y: number } | null = null
  let quadro: number | null = null
  let dicasMarcadas = new Set<HTMLElement>()
  let linhasMarcadas = new Set<HTMLElement>()

  const animacaoPermitida = () => janela.matchMedia?.('(prefers-reduced-motion: reduce)').matches !== true

  const cancelarEspera = () => {
    if (espera === null) return
    clearTimeout(espera)
    espera = null
  }

  const desmarcarDica = (dica: HTMLElement) => {
    dica.removeAttribute('data-dica')
    dica.removeAttribute('data-dica-lado')
    dica.removeAttribute('data-dica-entrada')
    if (dica.getAttribute('role') === 'tooltip') dica.removeAttribute('role')
    for (const nome of ['--lb-dica-x', '--lb-dica-y', '--lb-dica-max', '--lb-dica-seta']) dica.style.removeProperty(nome)
  }

  const desmarcarLinha = (linha: HTMLElement) => {
    linha.removeAttribute('data-dica-linha')
    linha.removeAttribute('data-dica-ids')
  }

  const fechar = () => {
    if (aberta === null) return
    for (const dica of aberta.dicas) {
      if (dica.getAttribute('data-dica') === 'aberta') dica.setAttribute('data-dica', 'fechada')
      dica.removeAttribute('data-dica-entrada')
    }
    if (aberta.linha.getAttribute('data-dica-linha') === 'aberta') aberta.linha.setAttribute('data-dica-linha', '')
    if (aberta.origem === 'pairar') fechouPairarEm = Date.now()
    aberta = null
  }

  const linhaDe = (alvo: EventTarget | null): HTMLElement | null => {
    if (!(alvo instanceof Element)) return null
    const linha = alvo.closest<HTMLElement>(SELETOR_LINHA)
    return linha !== null && linhasMarcadas.has(linha) ? linha : null
  }

  const dicasDaLinha = (linha: HTMLElement): HTMLElement[] =>
    (linha.getAttribute('data-dica-ids') ?? '')
      .split(' ')
      .map((id) => doc.getElementById(id))
      .filter((dica): dica is HTMLElement => dica instanceof HTMLElement && dicasMarcadas.has(dica) && estaDesenhada(dica))

  /** Parte visível do corpo que rola, sem a faixa fixa (sticky) que cobre o topo dele. */
  const areaVisivel = (corpo: HTMLElement): Caixa => {
    const caixa = corpo.getBoundingClientRect()
    const left = caixa.left + corpo.clientLeft
    const top = caixa.top + corpo.clientTop
    let topoLivre = top
    for (const filho of corpo.children) {
      if (janela.getComputedStyle(filho).position === 'sticky') topoLivre = Math.max(topoLivre, filho.getBoundingClientRect().bottom)
    }
    return { left, top: topoLivre, right: left + corpo.clientWidth, bottom: top + corpo.clientHeight }
  }

  /** Põe o balão aberto no lugar. `false` quando não havia onde pô-lo (e ele fechou). */
  const posicionar = (): boolean => {
    if (aberta === null) return false
    const { linha, dicas } = aberta
    const corpo = linha.closest<HTMLElement>(SELETOR_CORPO)
    if (corpo === null) {
      fechar()
      return false
    }
    const area = areaVisivel(corpo)
    const caixaDaLinha = caixaDe(linha.getBoundingClientRect())
    // A linha rolou para fora da parte visível: o balão apontaria para o nada.
    if (caixaDaLinha.bottom <= area.top || caixaDaLinha.top >= area.bottom) {
      fechar()
      return false
    }
    const limite = caixaDe((corpo.closest<HTMLElement>('.lb-panel') ?? corpo).getBoundingClientRect())
    const larguraMaxima = Math.max(0, area.right - area.left - 2 * RECUO_PX)

    // Mede cada balão na origem do containing block (o .lb-panel, por causa do
    // backdrop-filter): a diferença entre essa origem e a janela vira o x/y.
    const medidas = dicas.map((dica) => {
      dica.removeAttribute('data-dica-entrada')
      dica.style.setProperty('--lb-dica-max', `${larguraMaxima}px`)
      dica.style.setProperty('--lb-dica-x', '0px')
      dica.style.setProperty('--lb-dica-y', '0px')
      const origem = dica.getBoundingClientRect()
      return { origemX: origem.left, origemY: origem.top, largura: dica.offsetWidth, altura: dica.offsetHeight }
    })
    const largura = Math.max(0, ...medidas.map((medida) => medida.largura))
    const altura = medidas.reduce((soma, medida) => soma + medida.altura, 0) + PILHA_PX * Math.max(0, medidas.length - 1)
    const posicao = posicionarBalao({ linha: caixaDaLinha, largura, altura, area, limite, folga: FOLGA_PX, recuo: RECUO_PX })

    let y = posicao.y
    dicas.forEach((dica, indice) => {
      const medida = medidas[indice]
      dica.style.setProperty('--lb-dica-x', `${posicao.x - medida.origemX}px`)
      dica.style.setProperty('--lb-dica-y', `${y - medida.origemY}px`)
      dica.style.setProperty('--lb-dica-seta', `${posicao.seta}px`)
      // Só o balão encostado na linha leva a seta.
      const encostado = posicao.lado === 'abaixo' ? indice === 0 : indice === dicas.length - 1
      dica.setAttribute('data-dica-lado', encostado ? posicao.lado : 'pilha')
      y += medida.altura + PILHA_PX
    })
    return true
  }

  const abrir = (linha: HTMLElement, origem: Origem, animar: boolean) => {
    const dicas = dicasDaLinha(linha)
    if (dicas.length === 0) return
    fechar()
    aberta = { linha, dicas, origem }
    // Posiciona ainda escondido (visibility: hidden mede) e só então mostra.
    if (!posicionar()) return
    for (const dica of dicas) {
      dica.setAttribute('data-dica', 'aberta')
      if (animar) dica.setAttribute('data-dica-entrada', '')
    }
    linha.setAttribute('data-dica-linha', 'aberta')
  }

  /** Quem está com o foco do teclado numa linha volta a ver a frase quando o balão de pairar sai. */
  const reabrirFoco = () => {
    if (modalidade !== 'teclado' || aberta !== null) return
    const linha = linhaDe(doc.activeElement)
    if (linha !== null && linha !== dispensadaFoco) abrir(linha, 'foco', false)
  }

  const quente = () => aberta?.origem === 'pairar' || Date.now() - fechouPairarEm < JANELA_DO_VIZINHO_MS

  const entrarNaLinha = (linha: HTMLElement | null) => {
    if (linha === linhaSobPonteiro) return
    if (dispensadaPairar === linhaSobPonteiro) dispensadaPairar = null
    linhaSobPonteiro = linha
    cancelarEspera()
    if (aberta !== null && aberta.origem === 'pairar' && aberta.linha !== linha) {
      fechar()
      if (linha === null) reabrirFoco()
    }
    if (linha === null || linha === dispensadaPairar || aberta?.linha === linha) return
    if (quente()) {
      abrir(linha, 'pairar', false)
      return
    }
    espera = setTimeout(() => {
      espera = null
      if (linhaSobPonteiro === linha && linha !== dispensadaPairar) abrir(linha, 'pairar', animacaoPermitida())
    }, ESPERA_DO_PRIMEIRO_MS)
  }

  const aoMoverPonteiro = (evento: PointerEvent) => {
    if (evento.pointerType === 'touch') return
    // O Chromium repete o último ponto quando o corpo rola sob o ponteiro parado:
    // isso não é o mestre pairando numa linha nova.
    if (ultimoPonteiro !== null && ultimoPonteiro.x === evento.clientX && ultimoPonteiro.y === evento.clientY) return
    ultimoPonteiro = { x: evento.clientX, y: evento.clientY }
    entrarNaLinha(linhaDe(evento.target))
  }

  const aoSairDoPonteiro = (evento: PointerEvent) => {
    if (evento.relatedTarget !== null || evento.pointerType === 'touch') return
    ultimoPonteiro = null
    entrarNaLinha(null)
  }

  const aoApertar = (evento: PointerEvent) => {
    modalidade = 'ponteiro'
    cancelarEspera()
    const linha = linhaDe(evento.target)
    if (linha !== null) {
      dispensadaPairar = linha
      linhaSobPonteiro = linha
    }
    fechar()
    // Clicar é usar o painel, não passear pelas frases: a próxima linha espera de novo.
    fechouPairarEm = Number.NEGATIVE_INFINITY
  }

  const aoTeclarAntes = (evento: KeyboardEvent) => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey || ehSoModificador(evento)) return
    modalidade = 'teclado'
  }

  // Fase de subida, no documento: os campos do painel tratam o Esc deles antes
  // (desfazer a digitação), e a janela, depois (largar a seleção).
  const aoTeclar = (evento: KeyboardEvent) => {
    if (evento.key !== 'Escape' || aberta === null) return
    const { linha, origem } = aberta
    fechar()
    if (origem === 'foco') {
      dispensadaFoco = linha
      // Este Esc só fecha o balão. Sem isto ele também largaria a seleção, e o
      // foco sumiria junto com o painel; o próximo Esc larga, como antes.
      evento.stopPropagation()
    } else {
      dispensadaPairar = linha
    }
  }

  const aoFocar = (evento: FocusEvent) => {
    const linha = linhaDe(evento.target)
    if (aberta !== null && aberta.origem === 'foco' && aberta.linha !== linha) fechar()
    if (linha === null || modalidade !== 'teclado' || linha === dispensadaFoco) return
    if (aberta?.linha === linha) {
      aberta.origem = 'foco'
      return
    }
    abrir(linha, 'foco', false)
  }

  const aoDesfocar = (evento: FocusEvent) => {
    const linha = linhaDe(evento.target)
    if (linha === null) return
    const destino = evento.relatedTarget
    // O foco anda dentro da mesma linha (os rádios de um grupo): o balão fica.
    if (destino instanceof Node && linha.contains(destino)) return
    if (dispensadaFoco === linha) dispensadaFoco = null
    if (aberta !== null && aberta.origem === 'foco' && aberta.linha === linha) fechar()
  }

  const agendarReposicao = () => {
    if (quadro !== null) return
    quadro = janela.requestAnimationFrame(() => {
      quadro = null
      posicionar()
    })
  }

  const aoRolar = (evento: Event) => {
    const alvo = evento.target
    if (!(alvo instanceof Element) || !alvo.matches(SELETOR_CORPO)) return
    cancelarEspera()
    linhaSobPonteiro = null
    if (aberta !== null && aberta.origem === 'pairar') fechar()
    else if (aberta !== null) agendarReposicao()
    // Rolar esfria: a próxima linha sob o ponteiro espera de novo.
    fechouPairarEm = Number.NEGATIVE_INFINITY
  }

  const fecharTudo = () => {
    cancelarEspera()
    linhaSobPonteiro = null
    fechar()
  }

  const aplicarClasses = () => {
    const dicas = new Set<HTMLElement>()
    const linhas = new Map<HTMLElement, HTMLElement[]>()
    for (const corpo of doc.querySelectorAll<HTMLElement>(SELETOR_CORPO)) {
      const classificacao = classificarDicas(corpo)
      for (const dica of classificacao.sobDemanda) dicas.add(dica)
      for (const [linha, frases] of classificacao.linhas) linhas.set(linha, frases)
    }
    for (const dica of dicasMarcadas) if (!dicas.has(dica)) desmarcarDica(dica)
    for (const linha of linhasMarcadas) if (!linhas.has(linha)) desmarcarLinha(linha)
    for (const dica of dicas) {
      if (dica.getAttribute('data-dica') === null) dica.setAttribute('data-dica', 'fechada')
      if (!dica.hasAttribute('role')) dica.setAttribute('role', 'tooltip')
    }
    for (const [linha, frases] of linhas) {
      if (!linha.hasAttribute('data-dica-linha')) linha.setAttribute('data-dica-linha', '')
      linha.setAttribute('data-dica-ids', frases.map((dica) => dica.id).join(' '))
    }
    dicasMarcadas = dicas
    linhasMarcadas = new Set(linhas.keys())
    if (aberta !== null && (!linhas.has(aberta.linha) || aberta.dicas.some((dica) => !dicas.has(dica) || !dica.isConnected))) fechar()
  }

  const tocaOCorpo = (registro: MutationRecord): boolean => {
    const alvo = registro.target
    if (registro.type === 'attributes') {
      if (!(alvo instanceof Element)) return false
      if (registro.attributeName === 'class') return alvo.matches(SELETOR_DICA)
      return alvo.closest(SELETOR_CORPO) !== null
    }
    if (alvo instanceof Element && alvo.closest(SELETOR_CORPO) !== null) return true
    return [...registro.addedNodes, ...registro.removedNodes].some(
      (no) => no instanceof Element && (no.matches(SELETOR_CORPO) || no.querySelector(SELETOR_CORPO) !== null),
    )
  }

  const observador = new janela.MutationObserver((registros) => {
    if (registros.some(tocaOCorpo)) aplicarClasses()
  })
  observador.observe(doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-describedby', 'aria-disabled', 'disabled', 'id', 'class'],
  })

  doc.addEventListener('pointermove', aoMoverPonteiro, { passive: true })
  doc.addEventListener('pointerout', aoSairDoPonteiro, { passive: true })
  doc.addEventListener('pointerdown', aoApertar, true)
  doc.addEventListener('keydown', aoTeclarAntes, true)
  doc.addEventListener('keydown', aoTeclar)
  doc.addEventListener('focusin', aoFocar)
  doc.addEventListener('focusout', aoDesfocar)
  doc.addEventListener('scroll', aoRolar, true)
  janela.addEventListener('resize', fecharTudo)
  janela.addEventListener('blur', fecharTudo)
  aplicarClasses()

  const desinstalar = () => {
    observador.disconnect()
    doc.removeEventListener('pointermove', aoMoverPonteiro)
    doc.removeEventListener('pointerout', aoSairDoPonteiro)
    doc.removeEventListener('pointerdown', aoApertar, true)
    doc.removeEventListener('keydown', aoTeclarAntes, true)
    doc.removeEventListener('keydown', aoTeclar)
    doc.removeEventListener('focusin', aoFocar)
    doc.removeEventListener('focusout', aoDesfocar)
    doc.removeEventListener('scroll', aoRolar, true)
    janela.removeEventListener('resize', fecharTudo)
    janela.removeEventListener('blur', fecharTudo)
    if (quadro !== null) janela.cancelAnimationFrame(quadro)
    fecharTudo()
    for (const dica of dicasMarcadas) desmarcarDica(dica)
    for (const linha of linhasMarcadas) desmarcarLinha(linha)
    dicasMarcadas = new Set()
    linhasMarcadas = new Set()
    if (desinstalarAtual === desinstalar) desinstalarAtual = null
  }
  desinstalarAtual = desinstalar
  return desinstalar
}
