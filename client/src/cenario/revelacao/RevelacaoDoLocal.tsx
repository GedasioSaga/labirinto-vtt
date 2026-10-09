import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimacaoCenario } from '../AnimacaoCenario'
import type { CenarioDoPino } from '../catalogo'
import { aplicarEstado, medirEPosicionar, type MedidasDaImagem, type PecasDaRevelacao } from './coreografia'
import type { Layout } from './layout'
import { criarSomDaRevelacao, type SomDaRevelacao } from './som'
import {
  CURSOR_SOME_DEPOIS_S,
  FECHAR_EM_S,
  PARA_O_RELOGIO_S,
  estadoNoTempo,
  filaDeSons,
  planoDaRevelacao,
  type EventoDeSom,
  type PlanoDeDatilografia,
} from './tempo'
import './revelacao.css'

/** A imagem do pino e a animação do cenário que roda dentro da moldura. */
export interface ImagemDoLocal {
  src: string
  cenario: CenarioDoPino
}

export interface RevelacaoDoLocalProps {
  /** `null` = pino sem imagem: o painel sozinho, entrando pela direita. */
  imagem: ImagemDoLocal | null
  /** Título do painel (o "Nome do local" do pino). Vazio = sem título. */
  nome: string
  /** O texto datilografado. Vazio = só o título. */
  descricao: string
  /** 0 a 1, o "Som da mesa" (0 = mudo): máquina de escrever, porta e vento. */
  volume: number
  /** Prévia do mestre: sem "Pular"/"Fechar" e sem Esc (a janela cuida de fechar). */
  previa?: boolean
  /** Muda o valor para recomeçar do zero. */
  rodada?: number
  /** O jogador apertou "Fechar" (ou Esc depois de tudo aberto). */
  onFechar?: () => void
}

/** Sem a imagem carregar a tempo (arquivo torto), a moldura usa este formato e segue. */
const MEDIDAS_PADRAO: MedidasDaImagem = { proporcao: 3 / 4, altura: 600 }
const ESPERA_DA_IMAGEM_MS = 1500

/**
 * Aquecimento: na primeira vez, o compositor ainda não tem as camadas do
 * postigo (que nasce escondido atrás da imagem) nem o filtro de desfoque
 * compilado; isso dava 2 ou 3 quadros de 33 a 50 ms logo que a porta começava
 * a aparecer (medido no protótipo). Antes do t = 0, desenhamos alguns instantes
 * da abertura com a tela a 0,2% de opacidade, um quadro cada, uma vez por
 * formato. Cabe no escurecer do mapa.
 */
const INSTANTES_DO_AQUECIMENTO = [0.3, 0.5, 0.75, 1.0]
const aquecidas = new Set<string>()

function prefereMenosMovimento(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Tamanho original da imagem (a moldura nunca a amplia). */
function medirImagem(src: string): Promise<MedidasDaImagem> {
  return new Promise((resolver) => {
    const foto = new Image()
    let feito = false
    const pronto = () => {
      if (feito) return
      feito = true
      clearTimeout(espera)
      resolver(foto.naturalWidth > 0 && foto.naturalHeight > 0 ? { proporcao: foto.naturalWidth / foto.naturalHeight, altura: foto.naturalHeight } : MEDIDAS_PADRAO)
    }
    const espera = setTimeout(pronto, ESPERA_DA_IMAGEM_MS)
    foto.onload = pronto
    foto.onerror = pronto
    foto.src = src
    if (foto.complete && foto.naturalWidth > 0) pronto()
  })
}

const proximoQuadro = () => new Promise<void>((ok) => requestAnimationFrame(() => ok()))

/**
 * REVELAÇÃO DO LOCAL (pino "!"): a imagem entra pela direita já com a moldura
 * de madeira e metal, a animação do cenário roda dentro dela, o postigo gira
 * de trás da moldura nas dobradiças (luz corre na face, "clunk" no batente) e
 * a descrição é datilografada letra a letra, com som, até 4,25 s. Sem imagem,
 * o painel chega sozinho. "Pular" leva ao último quadro e vira "Fechar"; Esc
 * faz o mesmo; clique no painel completa o texto. Com movimento reduzido: só
 * fades curtos, o texto inteiro e nenhum som de tecla.
 *
 * Um relógio só (requestAnimationFrame) desenha tudo a partir de `tempo.ts`:
 * o quadro seguinte é sempre função do tempo, e o React não re-renderiza por
 * letra. A câmera dentro da moldura é a panorâmica de sempre
 * (`AnimacaoCenario` com `emMoldura`), na duração que o mestre escolheu.
 */
export function RevelacaoDoLocal({ imagem, nome, descricao, volume, previa = false, rodada = 0, onFechar }: RevelacaoDoLocalProps) {
  const temNome = nome.trim() !== ''
  // Espaço e linha em branco nas pontas não viram tecla nem pausa.
  const texto = descricao.trim()
  const temTexto = texto !== ''
  const temPainel = temNome || temTexto
  const src = imagem?.src ?? null
  const [medidas, setMedidas] = useState<MedidasDaImagem | null>(null)
  const [reduzir] = useState(prefereMenosMovimento)
  const [fechar, setFechar] = useState(false)
  const [pulado, setPulado] = useState(false)
  const pronto = src === null || medidas !== null

  const raizRef = useRef<HTMLDivElement>(null)
  const fundoRef = useRef<HTMLDivElement>(null)
  const grupoRef = useRef<HTMLDivElement>(null)
  const quadroRef = useRef<HTMLDivElement>(null)
  const molduraImagemRef = useRef<HTMLCanvasElement>(null)
  const vistaRef = useRef<HTMLDivElement>(null)
  const dobradicasRef = useRef<HTMLDivElement>(null)
  const trilhoRef = useRef<HTMLDivElement>(null)
  const carroRef = useRef<HTMLDivElement>(null)
  const painelRef = useRef<HTMLElement>(null)
  const molduraPainelRef = useRef<HTMLCanvasElement>(null)
  const folhasRef = useRef<HTMLDivElement>(null)
  const nomeRef = useRef<HTMLHeadingElement>(null)
  const faceSombraRef = useRef<HTMLDivElement>(null)
  const reflexoRef = useRef<HTMLSpanElement>(null)
  const rolagemRef = useRef<HTMLDivElement>(null)
  const textoRef = useRef<HTMLParagraphElement>(null)
  const feitoRef = useRef<HTMLSpanElement>(null)
  const cursorRef = useRef<HTMLSpanElement>(null)
  const faltaRef = useRef<HTMLSpanElement>(null)
  const pularRef = useRef<HTMLButtonElement>(null)
  const onFecharRef = useRef(onFechar)
  onFecharRef.current = onFechar
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  const somRef = useRef<SomDaRevelacao | null>(null)
  /** As ações do relógio vivo (pular, completar), trocadas a cada rodada. */
  const acoesRef = useRef<{ pularOuFechar: () => void; completar: () => void } | null>(null)

  useEffect(() => {
    if (src === null) return
    let vivo = true
    setMedidas(null)
    void medirImagem(src).then((m) => {
      if (vivo) setMedidas(m)
    })
    return () => {
      vivo = false
    }
  }, [src])

  useEffect(() => {
    somRef.current?.volume(volume)
  }, [volume])

  useEffect(() => {
    if (!previa) pularRef.current?.focus()
  }, [previa])

  // Antes da pintura: o grupo já nasce no lugar certo, fora da tela à direita (sem piscar no canto).
  useLayoutEffect(() => {
    const raiz = raizRef.current
    const fundo = fundoRef.current
    const grupo = grupoRef.current
    if (!pronto || !raiz || !fundo || !grupo) return
    const pecas: PecasDaRevelacao = {
      raiz,
      fundo,
      grupo,
      quadro: quadroRef.current,
      molduraImagem: molduraImagemRef.current,
      vista: vistaRef.current,
      dobradicas: dobradicasRef.current,
      trilho: trilhoRef.current,
      carro: carroRef.current,
      painel: painelRef.current,
      molduraPainel: molduraPainelRef.current,
      folhas: folhasRef.current,
      nome: nomeRef.current,
      faceSombra: faceSombraRef.current,
      reflexo: reflexoRef.current,
    }
    const semImagem = src === null
    const plano = planoDaRevelacao(texto, semImagem)
    // Sem painel não há porta: nada de "clunk" de uma porta que não aparece.
    const fila = filaDeSons(plano, { semImagem, temPainel })
    const relogio = new Relogio(pecas, {
      plano,
      fila,
      semImagem,
      reduzir,
      medidas: semImagem ? null : (medidas ?? MEDIDAS_PADRAO),
      temPainel,
      comPular: !previa,
      texto: { feito: feitoRef.current, falta: faltaRef.current, cursor: cursorRef.current, rolagem: rolagemRef.current, paragrafo: textoRef.current },
      quandoVirarFechar: () => setFechar(true),
      quandoPular: () => setPulado(true),
      quandoFechar: () => onFecharRef.current?.(),
    })
    setFechar(false)
    setPulado(false)
    // Som só fora do movimento reduzido: lá o texto chega inteiro, sem rajada de teclas, e não há porta.
    if (!reduzir && fila.length > 0) somRef.current = criarSomDaRevelacao(volumeRef.current)
    relogio.som = somRef.current
    acoesRef.current = { pularOuFechar: () => relogio.pularOuFechar(), completar: () => relogio.completarTexto() }
    relogio.medir()
    void relogio.aquecerEComecar()
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => relogio.medir()) : null
    observador?.observe(raiz)
    return () => {
      observador?.disconnect()
      relogio.parar()
      acoesRef.current = null
      somRef.current?.fechar()
      somRef.current = null
    }
    // `medidas` muda uma vez (a imagem carregou) e já está em `pronto`; trocar de pino remonta pelo `key` de quem chama.
  }, [pronto, rodada, reduzir, previa])

  useEffect(() => {
    if (previa) return
    // Captura na janela: o Esc da revelação não chega ao cartão do pino aberto por baixo.
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      evento.preventDefault()
      evento.stopPropagation()
      acoesRef.current?.pularOuFechar()
    }
    window.addEventListener('keydown', tecla, true)
    return () => window.removeEventListener('keydown', tecla, true)
  }, [previa])

  const rotulo = fechar ? 'Fechar' : 'Pular'
  return (
    <div ref={raizRef} className="lb-revelacao" data-previa={previa} data-reduzir={reduzir}>
      <div ref={fundoRef} className="lb-revelacao__fundo" aria-hidden="true" />
      {pronto && (
        <div ref={grupoRef} className="lb-revelacao__grupo">
          {imagem !== null && (
            <>
              <div ref={quadroRef} className="lb-revelacao__quadro">
                <canvas ref={molduraImagemRef} className="lb-revelacao__moldura" aria-hidden="true" />
                <div ref={vistaRef} className="lb-revelacao__vista">
                  <AnimacaoCenario imagem={imagem.src} cenario={imagem.cenario} volume={volume} emMoldura pularParaOFim={pulado} rodada={rodada} />
                </div>
              </div>
              {temPainel && (
                <div ref={dobradicasRef} className="lb-revelacao__dobradicas" aria-hidden="true">
                  <i />
                  <i />
                </div>
              )}
            </>
          )}
          {temPainel && (
            <div ref={trilhoRef} className="lb-revelacao__trilho">
              <div ref={carroRef} className="lb-revelacao__carro">
                <section ref={painelRef} className="lb-revelacao__painel" onClick={() => acoesRef.current?.completar()}>
                  <div className="lb-revelacao__painel-sombra" aria-hidden="true" />
                  <canvas ref={molduraPainelRef} className="lb-revelacao__painel-moldura" aria-hidden="true" />
                  <div className="lb-revelacao__papel">
                    <div className="lb-revelacao__papel-fundo" aria-hidden="true" />
                    {temNome && (
                      <div className="lb-revelacao__cabeca">
                        <h2 ref={nomeRef} className="lb-revelacao__nome">
                          {nome}
                        </h2>
                      </div>
                    )}
                    {temTexto && (
                      <div ref={rolagemRef} className="lb-revelacao__rolagem">
                        {/* O que se vê é escrito pelo relógio (sem re-render por letra); o leitor de tela lê o texto inteiro. */}
                        <p ref={textoRef} className="lb-revelacao__texto" aria-hidden="true">
                          <span ref={feitoRef} />
                          <span ref={cursorRef} className="lb-revelacao__cursor" />
                          <span ref={faltaRef} className="lb-revelacao__falta" />
                        </p>
                        <p className="lb-revelacao__leitor">{texto}</p>
                      </div>
                    )}
                  </div>
                  {imagem !== null && (
                    <div ref={folhasRef} className="lb-revelacao__folhas" aria-hidden="true">
                      <i />
                      <i />
                    </div>
                  )}
                  <div ref={faceSombraRef} className="lb-revelacao__face-sombra" aria-hidden="true" />
                  <div className="lb-revelacao__reflexo" aria-hidden="true">
                    <span ref={reflexoRef} />
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      )}
      {!previa && (
        <button ref={pularRef} type="button" className="lb-revelacao__pular" onClick={() => acoesRef.current?.pularOuFechar()}>
          {rotulo}
        </button>
      )}
    </div>
  )
}

interface PecasDoTexto {
  feito: HTMLSpanElement | null
  falta: HTMLSpanElement | null
  cursor: HTMLSpanElement | null
  rolagem: HTMLDivElement | null
  paragrafo: HTMLParagraphElement | null
}

interface OpcoesDoRelogio {
  plano: PlanoDeDatilografia
  fila: readonly EventoDeSom[]
  semImagem: boolean
  reduzir: boolean
  medidas: MedidasDaImagem | null
  temPainel: boolean
  comPular: boolean
  texto: PecasDoTexto
  quandoVirarFechar: () => void
  quandoPular: () => void
  quandoFechar: () => void
}

/**
 * O relógio de uma rodada da revelação. Vive fora do React: guarda o instante,
 * as letras na tela e o que o jogador já fez (pular, completar), e desenha a
 * cada quadro. Uma rodada nova = um relógio novo.
 */
class Relogio {
  som: SomDaRevelacao | null = null
  private layout: Layout | null = null
  private t0 = 0
  private ultimoT = 0
  private quadro = 0
  private rodando = false
  private parado = false
  private aquecendo = false
  private textoCompleto = false
  private pulado = false
  private fimDoTexto: number
  private letrasNaTela = -1
  private virouFechar = false
  private fechado = false
  /** Muda quando o aquecimento é abandonado (pular no meio dele): o laço antigo para de mexer. */
  private geracao = 0
  private tamanhoMedido = ''
  private readonly pecas: PecasDaRevelacao
  private readonly o: OpcoesDoRelogio

  constructor(pecas: PecasDaRevelacao, o: OpcoesDoRelogio) {
    this.pecas = pecas
    this.o = o
    this.fimDoTexto = o.plano.fimS
  }

  medir(): void {
    // O ResizeObserver avisa também ao começar a observar: mesmo tamanho não repinta as molduras.
    const tamanho = `${this.pecas.raiz.clientWidth}x${this.pecas.raiz.clientHeight}`
    if (tamanho === this.tamanhoMedido && this.layout !== null) return
    this.tamanhoMedido = tamanho
    // A altura do painel é a do texto INTEIRO: antes da primeira letra, o resto já ocupa o lugar (transparente).
    if (this.letrasNaTela < 0) this.escreverAte(0)
    this.layout = medirEPosicionar(this.pecas, this.o.medidas, this.o.temPainel, this.o.comPular) ?? this.layout
    if (!this.rodando && !this.aquecendo) this.desenhar(this.ultimoT)
  }

  async aquecerEComecar(): Promise<void> {
    const L = this.layout
    const forma = this.o.semImagem ? 'sem-imagem' : L?.coluna ? 'coluna' : 'linha'
    if (L === null || this.o.reduzir || aquecidas.has(forma)) return this.comecar()
    const geracao = ++this.geracao
    const abandonado = () => this.parado || geracao !== this.geracao
    this.aquecendo = true
    this.pecas.raiz.style.opacity = '0.002'
    for (const t of INSTANTES_DO_AQUECIMENTO) {
      aplicarEstado(this.pecas, this.layout, estadoNoTempo(t, { coluna: L.coluna, semImagem: this.o.semImagem }), false)
      await proximoQuadro()
      if (abandonado()) return
    }
    await proximoQuadro()
    if (abandonado()) return
    this.pecas.raiz.style.opacity = ''
    this.aquecendo = false
    aquecidas.add(forma)
    this.comecar()
  }

  private comecar(): void {
    this.t0 = performance.now()
    this.desenhar(0)
    this.acordar()
  }

  parar(): void {
    this.parado = true
    cancelAnimationFrame(this.quadro)
    this.pecas.raiz.style.opacity = ''
  }

  private acordar(): void {
    if (this.rodando || this.parado || this.aquecendo) return
    this.rodando = true
    this.quadro = requestAnimationFrame(() => this.passo())
  }

  private passo(): void {
    if (this.parado) return
    const t = (performance.now() - this.t0) / 1000
    this.desenhar(t)
    if (!this.pulado && !this.o.reduzir) this.som?.agendar(this.o.fila, t, this.textoCompleto)
    const dormir = t > PARA_O_RELOGIO_S || (this.pulado && this.virouFechar)
    if (dormir) {
      this.rodando = false
      return
    }
    this.quadro = requestAnimationFrame(() => this.passo())
  }

  private desenhar(t: number): void {
    this.ultimoT = t
    const { plano, reduzir, semImagem } = this.o
    const tv = this.pulado ? Math.max(t, PARA_O_RELOGIO_S) : t
    const est = estadoNoTempo(tv, { reduzir, plano, coluna: this.layout?.coluna ?? false, semImagem })
    aplicarEstado(this.pecas, this.layout, est, reduzir)
    const total = plano.letras.length
    const letras = this.textoCompleto || this.pulado ? total : est.letras
    this.escreverAte(letras)
    const fim = this.textoCompleto || this.pulado ? Math.min(this.fimDoTexto, plano.fimS) : plano.fimS
    const cursor = this.o.texto.cursor
    const sumiu = String(letras >= total && tv > fim + CURSOR_SOME_DEPOIS_S)
    if (cursor && cursor.dataset.sumiu !== sumiu) cursor.dataset.sumiu = sumiu
    if (!this.virouFechar && (this.pulado || reduzir || tv >= FECHAR_EM_S)) {
      this.virouFechar = true
      this.o.quandoVirarFechar()
    }
  }

  /** Datilografia: o resto do texto já ocupa o lugar (transparente), então nada pula de linha. */
  private escreverAte(letras: number): void {
    if (letras === this.letrasNaTela) return
    this.letrasNaTela = letras
    const { feito, falta } = this.o.texto
    const todas = this.o.plano.letras
    if (feito) feito.textContent = todas.slice(0, letras).join('')
    if (falta) falta.textContent = todas.slice(letras).join('')
    if (this.pecas.painel) this.pecas.painel.dataset.escrevendo = String(letras < todas.length && !this.o.reduzir)
    this.seguirOCursor()
  }

  /** Texto maior que o painel: a rolagem acompanha a linha que está sendo escrita. */
  private seguirOCursor(): void {
    const { rolagem, cursor, paragrafo } = this.o.texto
    if (!rolagem || !cursor || !paragrafo || rolagem.scrollHeight <= rolagem.clientHeight + 1) return
    const linha = cursor.offsetHeight || 20
    const fundoDoCursor = paragrafo.offsetTop + cursor.offsetTop + linha * 1.5
    if (fundoDoCursor > rolagem.scrollTop + rolagem.clientHeight) rolagem.scrollTop = fundoDoCursor - rolagem.clientHeight
  }

  /** Clique no painel durante a escrita: o texto inteiro aparece, sem tocar as teclas que faltavam. */
  completarTexto(): void {
    if (this.fechado || this.textoCompleto || this.pulado || this.letrasNaTela >= this.o.plano.letras.length) return
    this.textoCompleto = true
    this.fimDoTexto = this.ultimoT
    this.acordar()
  }

  /** "Pular" leva ao último quadro (tudo aberto e escrito); depois vira "Fechar". */
  pularOuFechar(): void {
    if (this.fechado) return
    if (!this.virouFechar) {
      if (this.letrasNaTela < this.o.plano.letras.length) this.fimDoTexto = this.ultimoT
      this.pulado = true
      this.som?.cortar()
      this.o.quandoPular()
      // Ainda aquecendo: começa já, direto no último quadro.
      if (this.aquecendo) {
        this.geracao++
        this.aquecendo = false
        this.pecas.raiz.style.opacity = ''
        this.comecar()
        return
      }
      this.desenhar(this.ultimoT)
      this.acordar()
      return
    }
    this.fechado = true
    this.som?.cortar()
    this.o.quandoFechar()
  }
}
