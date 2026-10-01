import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { destravarAudioNoPrimeiroGesto } from '../lib/sons/contexto'
import type { SomId } from '../lib/sons/receitas'
import { tocarAmostra } from '../lib/sons/tocarSom'
import { estaCalado, percentualDoVolume, useSomStore } from '../stores/somStore'
import { SomIcon, SomMudoIcon } from './icons'
import './ControleDeSom.css'

/**
 * SOM DA MESA (pedido "sons", fatia 3): o alto-falante que regula os sons de
 * clima (`lib/sons`). Um clique abre um popover pequeno com a barra de volume
 * e o mudo de um clique. A escolha é do APARELHO (`somStore`, no localStorage
 * de quem ouve) e nunca vai pela rede.
 *
 * Serve às duas telas: no jogador flutua sobre o mapa, na pilha do canto de
 * baixo à direita (`.pp-som`, player.css); no mestre fica no cabeçalho da sala
 * (`RoomPanel`). O popover não é modal — o mapa segue vivo atrás — e fecha com
 * Esc (o foco volta ao alto-falante), com o toque fora e com o foco saindo.
 */

export type VarianteDoControleDeSom = 'flutuante' | 'painel'

export interface ControleDeSomProps {
  /** `flutuante`: botão de toque de 44 px sobre o mapa do jogador. `painel`: o botão compacto do mestre. */
  variante: VarianteDoControleDeSom
  /** Classe a mais na raiz: onde o controle mora na tela de quem monta (no jogador, `.pp-som`). */
  className?: string
  /**
   * Texto à vista ao lado do alto-falante, que também lhe dá o nome e aumenta
   * o alvo do clique (no mestre: "Som da mesa"). Sem ele, o nome é "Som".
   */
  legenda?: string
  /**
   * Quem toca a amostra. Padrão: `tocarAmostra`, que respeita mudo, volume e
   * destravamento, mas fica fora do intervalo mínimo dos sons do jogo.
   */
  tocar?: (id: SomId) => unknown
  /** Escuta os gestos que destravam o áudio. Padrão: o motor do app (`lib/sons/contexto.ts`). */
  destravar?: (alvo: EventTarget) => () => void
}

/** O som da amostra: o sino de "item obtido", curto e reconhecível, no volume escolhido. */
export const SOM_DE_AMOSTRA: SomId = 'item'
export const TITULO_DO_SOM = 'Som da mesa'

/** Como o popover abriu. Pelo teclado ele aparece na hora: animação depois da tecla parece atraso. */
type Abertura = 'ponteiro' | 'teclado'

/** Teclas que a barra de volume trata sozinha: passo, passo grande e as pontas. */
const TECLAS_DA_BARRA: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])
/** Teclas que apertam o botão em foco. */
const TECLAS_DO_BOTAO: ReadonlySet<string> = new Set([' ', 'Enter'])

/** Respiro mínimo entre o popover e a borda da tela: o mesmo do menu do ponto (`PointActionMenu`). */
export const MARGEM_DA_TELA = 8

/** Uma caixa na tela, em px a partir do canto de cima à esquerda. */
export interface CaixaNaTela {
  x: number
  y: number
  largura: number
  altura: number
}

/** O quanto mover, em px: positivo é para a direita e para baixo. */
export interface Desvio {
  x: number
  y: number
}

const SEM_DESVIO: Desvio = { x: 0, y: 0 }

/** Onde a caixa começa num eixo para caber com a margem; maior que o espaço, o começo vence. */
function inicioQueCabe(inicio: number, tamanho: number, limite: number, margem: number): number {
  return Math.max(margem, Math.min(inicio, limite - margem - tamanho))
}

/**
 * PRESO À MARGEM DA TELA: quanto mover a caixa para ela caber na tela com a
 * margem. Cabendo, nada. Maior que a tela, a borda de cima e a da esquerda
 * ganham: é por onde a leitura começa (o título "Som da mesa").
 */
export function desvioParaCaber(caixa: CaixaNaTela, tela: { largura: number; altura: number }, margem: number): Desvio {
  return {
    x: inicioQueCabe(caixa.x, caixa.largura, tela.largura, margem) - caixa.x,
    y: inicioQueCabe(caixa.y, caixa.altura, tela.altura, margem) - caixa.y,
  }
}

/**
 * O desvio do popover aberto, medido na tela. As medidas são as de layout
 * (`offset*`, a partir de quem posiciona o popover: a raiz, que quem monta
 * deixa posicionada), e não a caixa desenhada do popover: a entrada anima
 * `transform: scale(0.95)`, e a caixa encolhida mentiria o lugar; o
 * `translate` do próprio desvio também não entra nelas. Sem caixa (ainda sem
 * layout), fica onde o CSS o pôs.
 */
function medirDesvio(raiz: HTMLElement, popover: HTMLElement): Desvio {
  if (popover.offsetWidth === 0 && popover.offsetHeight === 0) return SEM_DESVIO
  const posicionador = popover.offsetParent instanceof HTMLElement ? popover.offsetParent : raiz
  const origem = posicionador.getBoundingClientRect()
  const caixa = { x: origem.left + popover.offsetLeft, y: origem.top + popover.offsetTop, largura: popover.offsetWidth, altura: popover.offsetHeight }
  return desvioParaCaber(caixa, { largura: window.innerWidth, altura: window.innerHeight }, MARGEM_DA_TELA)
}

/** O alto-falante é mais vazado que o + e o − do zoom: 22 px no botão de 46 lhe dão o mesmo peso. */
const TAMANHO_DO_ICONE: Record<VarianteDoControleDeSom, number> = { flutuante: 22, painel: 16 }
/** Sobre o mapa, o traço do + e do − do zoom; no painel, o da família de ícones. */
const TRACO_DO_ICONE: Record<VarianteDoControleDeSom, number> = { flutuante: 2, painel: 1.6 }

export function ControleDeSom({ variante, className, legenda, tocar = tocarAmostra, destravar = destravarAudioNoPrimeiroGesto }: ControleDeSomProps) {
  const volume = useSomStore((estado) => estado.volume)
  const mudo = useSomStore((estado) => estado.mudo)
  const [abertura, setAbertura] = useState<Abertura | null>(null)
  const [desvio, setDesvio] = useState<Desvio>(SEM_DESVIO)
  const raizRef = useRef<HTMLDivElement>(null)
  const gatilhoRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const barraRef = useRef<HTMLInputElement>(null)
  const gatilhoId = useId()
  const popoverId = useId()
  const tituloId = useId()
  const dicaId = useId()
  const barraId = useId()
  const aberto = abertura !== null
  const percentual = percentualDoVolume(volume)
  /** Nada sai: mudo, ou a barra no 0%. A mesma regra cala os sons e o bipe. */
  const calado = estaCalado({ volume, mudo })
  const icone = { size: TAMANHO_DO_ICONE[variante], strokeWidth: TRACO_DO_ICONE[variante] }

  // O gesto feito AQUI também destrava o áudio. O mestre e a sessão do jogador
  // já destravam pela janela; este fica para quem montar o controle sem aquilo,
  // e não abre outro contexto (o motor é um só).
  useEffect(() => {
    const raiz = raizRef.current
    return raiz === null ? undefined : destravar(raiz)
  }, [destravar])

  // O foco entra na barra, o controle principal: as setas já regulam.
  useLayoutEffect(() => {
    if (aberto) barraRef.current?.focus()
  }, [aberto])

  // Preso à margem da tela: onde o CSS o põe e ele não cabe, o popover entra
  // na tela antes de pintar. No celular deitado com a barra do navegador
  // (844 x 340), aberto à esquerda com o pé no pé do botão, ele ainda passaria
  // 12 px do alto. Mede de novo quando a tela muda (o aparelho girou).
  useLayoutEffect(() => {
    const raiz = raizRef.current
    const popover = popoverRef.current
    if (!aberto || raiz === null || popover === null) return
    const encaixar = (): void => {
      const novo = medirDesvio(raiz, popover)
      setDesvio((atual) => (atual.x === novo.x && atual.y === novo.y ? atual : novo))
    }
    encaixar()
    window.addEventListener('resize', encaixar)
    return () => window.removeEventListener('resize', encaixar)
  }, [aberto])

  // Soltar a alça toca a amostra. É o `change` nativo: o `onChange` do React
  // é o `input`, que dispara a cada passo do arrasto e tocaria em rajada. Pelo
  // teclado cada passo também é um `change`, e cada toque na seta toca. A seta
  // SEGURADA é o arrasto do teclado: a repetição (uns 30 passos por segundo,
  // cada sino soando 1 s) não toca a cada passo; toca ao soltar a tecla, no
  // volume final.
  useEffect(() => {
    const barra = barraRef.current
    if (!aberto || barra === null) return
    let segurando = false
    let devendo = false
    const aoApertarTecla = (evento: HTMLElementEventMap['keydown']): void => {
      if (TECLAS_DA_BARRA.has(evento.key)) segurando = evento.repeat
    }
    const aoSoltar = (): void => {
      if (segurando) devendo = true
      else tocar(SOM_DE_AMOSTRA)
    }
    const aoSoltarTecla = (evento: HTMLElementEventMap['keyup']): void => {
      if (!TECLAS_DA_BARRA.has(evento.key)) return
      segurando = false
      if (!devendo) return
      devendo = false
      tocar(SOM_DE_AMOSTRA)
    }
    barra.addEventListener('keydown', aoApertarTecla)
    barra.addEventListener('change', aoSoltar)
    barra.addEventListener('keyup', aoSoltarTecla)
    return () => {
      barra.removeEventListener('keydown', aoApertarTecla)
      barra.removeEventListener('change', aoSoltar)
      barra.removeEventListener('keyup', aoSoltarTecla)
    }
  }, [aberto, tocar])

  // O toque fora e o foco que sai (Tab) fecham, sem roubar o gesto: o arrasto do mapa segue.
  useEffect(() => {
    const raiz = raizRef.current
    if (!aberto || raiz === null) return
    const fecharSeForFora = (evento: Event): void => {
      if (evento.target instanceof Node && !raiz.contains(evento.target)) setAbertura(null)
    }
    document.addEventListener('pointerdown', fecharSeForFora, true)
    document.addEventListener('focusin', fecharSeForFora)
    return () => {
      document.removeEventListener('pointerdown', fecharSeForFora, true)
      document.removeEventListener('focusin', fecharSeForFora)
    }
  }, [aberto])

  function fechar(devolverFoco: boolean): void {
    setAbertura(null)
    if (devolverFoco) gatilhoRef.current?.focus()
  }

  function alternarPopover(evento: MouseEvent<HTMLButtonElement>): void {
    if (aberto) {
      fechar(false)
      return
    }
    // `detail` conta os cliques do dedo ou do mouse; Enter e Espaço sintetizam o clique com 0.
    setAbertura(evento.detail === 0 ? 'teclado' : 'ponteiro')
  }

  function mudarVolume(valor: number): void {
    const som = useSomStore.getState()
    som.setVolume(valor / 100)
    // Como o volume do sistema: quem mexe na barra quer ouvir.
    if (som.mudo) som.alternarMudo()
  }

  function alternarMudo(): void {
    useSomStore.getState().alternarMudo()
    // Tirar do mudo toca a amostra no volume escolhido: o ouvido confirma que o som voltou.
    if (!useSomStore.getState().mudo) tocar(SOM_DE_AMOSTRA)
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>): void {
    const alvo = evento.target
    const fecha = aberto && evento.key === 'Escape'
    const daBarra = alvo instanceof HTMLInputElement && alvo.type === 'range' && TECLAS_DA_BARRA.has(evento.key)
    const doBotao = alvo instanceof HTMLButtonElement && TECLAS_DO_BOTAO.has(evento.key)
    if (!fecha && !daBarra && !doBotao) return
    // A tecla é deste controle. No mestre a seta também empurraria o objeto
    // selecionado no mapa e o Espaço armaria o arrasto da vista; o Esc fecharia
    // junto o cartão aberto no jogador. As outras teclas seguem para os atalhos.
    evento.stopPropagation()
    evento.nativeEvent.stopImmediatePropagation()
    if (!fecha) return
    evento.preventDefault()
    fechar(true)
  }

  const classes = ['lb-som', `lb-som--${variante}`, legenda === undefined ? undefined : 'lb-som--com-legenda', className]
    .filter((classe) => classe !== undefined && classe !== '')
    .join(' ')

  return (
    <div ref={raizRef} className={classes} onKeyDown={aoTeclar}>
      {legenda !== undefined && (
        <label className="lb-som__legenda" htmlFor={gatilhoId}>
          {legenda}
        </label>
      )}
      <button
        ref={gatilhoRef}
        id={gatilhoId}
        type="button"
        className={variante === 'painel' ? 'lb-btn lb-btn--compact lb-som__gatilho' : 'lb-som__gatilho'}
        // Com legenda à vista, o nome é ela (`<label for>`): quem lê e quem fala o comando de voz dizem o mesmo.
        aria-label={legenda === undefined ? 'Som' : undefined}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={aberto ? popoverId : undefined}
        data-estado={calado ? 'mudo' : 'ligado'}
        title={mudo ? 'Som: mudo' : `Som: ${percentual}%`}
        onClick={alternarPopover}
      >
        {calado ? <SomMudoIcon {...icone} /> : <SomIcon {...icone} />}
      </button>
      {abertura !== null && (
        <div
          ref={popoverRef}
          id={popoverId}
          className="lb-som__pop"
          role="dialog"
          aria-labelledby={tituloId}
          aria-describedby={dicaId}
          data-abertura={abertura}
          data-mudo={mudo}
          // O `translate` compõe com o `transform` da entrada: a escala anima, o desvio fica.
          style={desvio.x === 0 && desvio.y === 0 ? undefined : { translate: `${desvio.x}px ${desvio.y}px` }}
        >
          <div className="lb-som__cabeca">
            <p id={tituloId} className="lb-som__titulo">
              {TITULO_DO_SOM}
            </p>
            {/* O leitor de tela já ouve o valor pela barra (`aria-valuetext`) e o mudo pelo botão. */}
            <span className="lb-som__valor" aria-hidden="true">
              {mudo ? 'Mudo' : `${percentual}%`}
            </span>
          </div>
          <div className="lb-som__linha">
            <button
              type="button"
              className="lb-som__mudo"
              aria-label="Mudo"
              aria-pressed={mudo}
              title={mudo ? 'Tirar do mudo' : 'Mudo'}
              onClick={alternarMudo}
            >
              {mudo ? <SomMudoIcon {...icone} /> : <SomIcon {...icone} />}
            </button>
            <label className="lb-som__rotulo" htmlFor={barraId}>
              Volume
            </label>
            <input
              ref={barraRef}
              id={barraId}
              className="lb-som__barra"
              type="range"
              min={0}
              max={100}
              step={1}
              value={percentual}
              aria-valuetext={`${percentual}%`}
              // A parte cheia do trilho vai até a alça (o primeiro fundo do `.lb-som__barra`).
              style={{ backgroundSize: `${percentual}% 4px, 100% 4px` }}
              onChange={(evento) => mudarVolume(Number(evento.currentTarget.value))}
            />
          </div>
          <p id={dicaId} className="lb-som__dica">
            Sons baixos de clima.
          </p>
        </div>
      )}
    </div>
  )
}
