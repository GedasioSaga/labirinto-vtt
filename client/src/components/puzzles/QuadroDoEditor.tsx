import { useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { classes } from '../grimorio/comum'
import { useImagemDaMesa } from '../ImagemDaMesa'
import { combinacaoDoPuzzle, combinacaoNaVista } from '../../puzzles/combinacao'
import { CorpoDoControle, estiloDoControle, nomeDoControle } from '../../puzzles/ControlesDaCombinacao'
import { giratoriasDoPuzzle, giratoriasNaVista, girosResolvidos } from '../../puzzles/giratorias/giratorias'
import { alvoDosInterruptores, interruptoresDoPuzzle, interruptoresNaVista } from '../../puzzles/interruptores/interruptores'
import { misturaDoPuzzle, misturaNaVista } from '../../puzzles/mistura/mistura'
import { camadasDoEditor, camadasDoPuzzle } from '../../puzzles/camadas/camadas'
import { cooperacaoDoPuzzle, cooperacaoNaVista } from '../../puzzles/cooperacao/cooperacao'
import { progressoInicial } from '../../puzzles/motor'
import { QuadroDoPuzzle } from '../../puzzles/QuadroDoPuzzle'
import { TAMANHO_DO_ENCAIXE_MAX, TAMANHO_DO_ENCAIXE_MIN, type CombinacaoDoPuzzle, type EncaixeDoPuzzle, type Puzzle } from '../../puzzles/tipos'
import { comControle, comEncaixe, encaixeDoTamanho, encaixeMovido, limitar, PASSO_DA_SETA, PASSO_DO_TAMANHO, PASSO_LARGO_DA_SETA, umaCasa } from './edicao'
import { srcDaPeca, type PecasDoEditor } from './pecasDoEditor'
import { CamadaDoRelevo, vaosDoEditor } from './CamadaDoRelevo'

/**
 * O QUADRO DO EDITOR (protótipo aprovado, `htmlQuadroEd` e `iniciarEdArrasto`):
 * a arte de verdade (`QuadroDoPuzzle`, a mesma do jogador) com a camada dos
 * encaixes editáveis por cima. Arrastar move; a alça do canto muda o tamanho;
 * com o encaixe em foco, as setas movem (Shift: passo largo), + e − mudam o
 * tamanho, Delete tira e Esc solta a escolha.
 *
 * Na combinação, no lugar dos encaixes fica o controle (o `is-ed` do v2):
 * arrastar o leva para onde ele fica na imagem; com ele em foco, as setas o
 * movem e + e − mudam o tamanho.
 *
 * O gesto não re-renderiza nada: o encaixe (ou o controle) se move pelo
 * `transform` do próprio elemento, e o puzzle só muda (um passo do Desfazer) ao soltar.
 */

/** O + e o − no tamanho do controle (a faixa do v2 anda de 0,05). */
const PASSO_DA_ESCALA = 0.05

/** Abaixo disto o toque é escolha, não arrasto (v2: 3 px). */
const LIMIAR_DO_ARRASTO_PX = 3
/** A alça cresce o encaixe nos dois lados: arrastar 10 px dá 20 px de largura (v2). */
const GANHO_DA_ALCA = 2

interface Arrasto {
  tipo: 'mover' | 'alca'
  encaixe: EncaixeDoPuzzle
  el: HTMLElement
  ponteiro: number
  x0: number
  y0: number
  largura: number
  altura: number
  moveu: boolean
  x: number
  y: number
  t: number
}

interface PropsDoQuadroDoEditor {
  puzzle: Puzzle
  escolhido: string | null
  pecas: PecasDoEditor
  onEscolher: (encaixeId: string | null) => void
  /** Um passo do Desfazer; `chave` junta passos seguidos do mesmo gesto (as setas no mesmo encaixe). */
  onMudar: (proximo: Puzzle, chave?: string) => void
  onTirar: (encaixeId: string) => void
  onImagemSolta: (arquivo: File) => void
  /** O aviso da ficha (o painel em relevo avisa quando bate no mínimo ou no máximo de placas). */
  onAviso?: (texto: string, tipo?: 'info' | 'error') => void
  /** Peças giratórias: o medalhão fechado no lugar do começo embaralhado. */
  verResolvido?: boolean
}

export function QuadroDoEditor({ puzzle, escolhido, pecas, onEscolher, onMudar, onTirar, onImagemSolta, onAviso, verResolvido = false }: PropsDoQuadroDoEditor) {
  const relevo = puzzle.visual.tipo === 'relevo' ? puzzle.visual : null
  const arrasto = useRef<Arrasto | null>(null)
  const [soltandoArquivo, setSoltandoArquivo] = useState(false)
  const resolver = useImagemDaMesa()
  const { troca } = puzzle
  const combinacao = combinacaoDoPuzzle(puzzle)
  // O medalhão no editor é só para ver: o começo que o jogador encontra, ou fechado.
  const giratorias = giratoriasDoPuzzle(puzzle)
  const medalhao = giratorias === null ? undefined : { ...giratoriasNaVista(giratorias, progressoInicial(puzzle)), ...(verResolvido ? { giros: girosResolvidos(giratorias) } : {}) }
  // O painel de lampiões também: o começo que o jogador encontra, ou como o objetivo pede.
  const interruptores = interruptoresDoPuzzle(puzzle)
  const painel = interruptores === null ? undefined : { ...interruptoresNaVista(interruptores, progressoInicial(puzzle)), ...(verResolvido ? { luzes: alvoDosInterruptores(interruptores) } : {}) }
  // Os pontos da cooperação: apagados como o jogador os encontra; "Ver resolvido" acende todos (o quadro resolvido).
  const cooperacao = cooperacaoDoPuzzle(puzzle)
  const pontos = cooperacao === null ? undefined : cooperacaoNaVista(cooperacao, progressoInicial(puzzle), undefined, null)
  // A bancada da mistura: como o jogador a encontra (o caminho até o alvo está na ficha).
  const mistura = misturaDoPuzzle(puzzle)
  const bancada = mistura === null ? undefined : misturaNaVista(mistura, progressoInicial(puzzle))
  // A mesa de luz: todas as lâminas como pousam (fora de ordem e tortas), ou a figura fechada.
  const camadas = camadasDoPuzzle(puzzle)
  const mesa = camadas === null ? undefined : camadasDoEditor(puzzle, camadas, verResolvido)
  const semEncaixes = medalhao !== undefined || painel !== undefined || pontos !== undefined || bancada !== undefined || mesa !== undefined

  const comecar = (evento: PointerEvent<HTMLButtonElement>, encaixe: EncaixeDoPuzzle) => {
    if (evento.button !== 0 || arrasto.current !== null) return
    const el = evento.currentTarget
    const quadro = el.closest('.qpz')
    if (quadro === null) return
    const caixa = quadro.getBoundingClientRect()
    const tipo = evento.target instanceof Element && evento.target.closest('[data-alca]') !== null ? 'alca' : 'mover'
    if (escolhido !== encaixe.id) onEscolher(encaixe.id)
    arrasto.current = { tipo, encaixe, el, ponteiro: evento.pointerId, x0: evento.clientX, y0: evento.clientY, largura: caixa.width, altura: caixa.height, moveu: false, x: encaixe.x, y: encaixe.y, t: encaixe.t }
    el.setPointerCapture(evento.pointerId)
    // Sem isto o navegador seleciona texto e o foco não chega ao botão no Safari; o foco vai à mão.
    evento.preventDefault()
    el.focus({ preventScroll: true })
  }

  const mover = (evento: PointerEvent<HTMLButtonElement>) => {
    const a = arrasto.current
    if (a === null || evento.pointerId !== a.ponteiro) return
    const dx = evento.clientX - a.x0
    const dy = evento.clientY - a.y0
    if (!a.moveu && Math.hypot(dx, dy) < LIMIAR_DO_ARRASTO_PX) return
    if (!a.moveu) {
      a.moveu = true
      a.el.classList.add('is-arrastando')
    }
    if (a.tipo === 'alca') {
      a.t = limitar(a.encaixe.t + ((Math.max(dx, dy) * GANHO_DA_ALCA) / a.largura) * 100, TAMANHO_DO_ENCAIXE_MIN, TAMANHO_DO_ENCAIXE_MAX)
      a.el.style.width = `${a.t}cqw`
      return
    }
    a.x = limitar(a.encaixe.x + (dx / a.largura) * 100, 0, 100)
    a.y = limitar(a.encaixe.y + (dy / a.altura) * 100, 0, 100)
    const px = ((a.x - a.encaixe.x) / 100) * a.largura
    const py = ((a.y - a.encaixe.y) / 100) * a.altura
    a.el.style.transform = `translate(calc(-50% + ${px.toFixed(1)}px), calc(-50% + ${py.toFixed(1)}px))`
  }

  /** Devolve o botão ao que o React desenha; `aplicar` grava o gesto antes, num passo só. */
  const terminar = (evento: PointerEvent<HTMLButtonElement>, aplicar: boolean) => {
    const a = arrasto.current
    if (a === null || evento.pointerId !== a.ponteiro) return
    arrasto.current = null
    if (a.el.hasPointerCapture(a.ponteiro)) a.el.releasePointerCapture(a.ponteiro)
    if (a.moveu && aplicar) {
      const id = a.encaixe.id
      // O lugar novo entra no DOM AGORA, e o deslocamento sai com a transição ainda desligada:
      // senão o encaixe somava os dois por 150 ms e escorregava de volta.
      flushSync(() => onMudar(comEncaixe(puzzle, id, (encaixe) => (a.tipo === 'alca' ? encaixeDoTamanho(encaixe, a.t) : encaixeMovido(encaixe, a.x, a.y)))))
      a.el.style.transform = ''
      a.el.style.width = `${a.tipo === 'alca' ? umaCasa(a.t) : a.encaixe.t}cqw`
      void a.el.offsetWidth
      a.el.classList.remove('is-arrastando')
      return
    }
    // Cancelado: volta ao lugar com a transição de 150 ms do quadro.
    a.el.classList.remove('is-arrastando')
    a.el.style.transform = ''
    a.el.style.width = `${a.encaixe.t}cqw`
  }

  const teclar = (evento: KeyboardEvent<HTMLButtonElement>, encaixe: EncaixeDoPuzzle) => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return
    const passo = evento.shiftKey ? PASSO_LARGO_DA_SETA : PASSO_DA_SETA
    const seta: Readonly<Record<string, readonly [number, number]>> = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }
    const d = seta[evento.key]
    const chave = `teclado:${encaixe.id}`
    if (d !== undefined) {
      evento.preventDefault()
      onMudar(comEncaixe(puzzle, encaixe.id, (atual) => encaixeMovido(atual, atual.x + d[0], atual.y + d[1])), chave)
    } else if (evento.key === '+' || evento.key === '=' || evento.key === '-') {
      evento.preventDefault()
      const sinal = evento.key === '-' ? -1 : 1
      onMudar(comEncaixe(puzzle, encaixe.id, (atual) => encaixeDoTamanho(atual, atual.t + sinal * PASSO_DO_TAMANHO)), chave)
    } else if (evento.key === 'Delete' || evento.key === 'Backspace') {
      evento.preventDefault()
      onTirar(encaixe.id)
    } else if (evento.key === 'Escape') {
      evento.preventDefault()
      onEscolher(null)
    }
  }

  const temArquivo = (evento: DragEvent) => Array.from(evento.dataTransfer.types).includes('Files')

  return (
    <div
      className={classes('pze-quadro', soltandoArquivo && 'is-solta')}
      onDragOver={(evento) => {
        if (!temArquivo(evento)) return
        evento.preventDefault()
        if (!soltandoArquivo) setSoltandoArquivo(true)
      }}
      onDragLeave={(evento) => {
        const destino = evento.relatedTarget
        if (destino instanceof Node && evento.currentTarget.contains(destino)) return
        setSoltandoArquivo(false)
      }}
      onDrop={(evento) => {
        if (!temArquivo(evento)) return
        evento.preventDefault()
        setSoltandoArquivo(false)
        const arquivo = evento.dataTransfer.files[0]
        if (arquivo !== undefined) onImagemSolta(arquivo)
      }}
    >
      <QuadroDoPuzzle
        visual={puzzle.visual}
        encaixes={relevo !== null && !semEncaixes ? vaosDoEditor(puzzle) : []}
        troca={troca === null || semEncaixes ? null : { x: troca.x, y: troca.y, pesoPedido: troca.peso, naBandeja: [], feita: false }}
        resolvido={semEncaixes && verResolvido}
        giratorias={medalhao}
        interruptores={painel}
        mistura={bancada}
        cooperacao={pontos}
        camadas={mesa}
        rotulo={`Quadro do puzzle ${puzzle.nome}`}
      >
        {semEncaixes ? null : relevo !== null ? (
          <CamadaDoRelevo puzzle={puzzle} visual={relevo} onMudar={(proximo) => onMudar(proximo)} onAviso={onAviso} />
        ) : (
        <div
          className="pze-camada"
          onPointerDown={(evento) => {
            if (evento.target === evento.currentTarget && escolhido !== null) onEscolher(null)
          }}
        >
          {combinacao !== null && <ControleNoEditor puzzle={puzzle} combinacao={combinacao} onMudar={onMudar} />}
          {combinacao === null && puzzle.encaixes.map((encaixe, i) => {
            const certa = encaixe.jeito === 'peca' ? encaixe.itemId : encaixe.metades[0]
            const peca = pecas.porId(certa)
            const src = srcDaPeca(peca, resolver)
            const numero = i + 1
            const nome = encaixe.jeito === 'metades' ? `duas metades que viram ${encaixe.vira.nome}` : peca === null ? 'sem peça certa' : peca.nome
            return (
              <button
                key={encaixe.id}
                type="button"
                className={classes('qpz-encaixe', 'pze-enc', encaixe.forma !== 'redondo' && `qpz-encaixe--${encaixe.forma}`, escolhido === encaixe.id && 'is-escolhido')}
                style={{ left: `${encaixe.x}%`, top: `${encaixe.y}%`, width: `${encaixe.t}cqw` }}
                data-enc-ed={encaixe.id}
                aria-label={`Encaixe ${numero}: ${nome}. Arraste para mover; setas movem, + e − mudam o tamanho, Delete tira`}
                aria-pressed={escolhido === encaixe.id}
                onPointerDown={(evento) => comecar(evento, encaixe)}
                onPointerMove={mover}
                onPointerUp={(evento) => terminar(evento, true)}
                onPointerCancel={(evento) => terminar(evento, false)}
                onLostPointerCapture={(evento) => terminar(evento, true)}
                onKeyDown={(evento) => teclar(evento, encaixe)}
              >
                {src !== null && (
                  <span className="pze-enc__peca">
                    <img src={src} alt="" draggable={false} />
                  </span>
                )}
                <span className="pze-enc__num">
                  {numero}
                  {encaixe.jeito === 'metades' && <small>½</small>}
                </span>
                <span className="pze-enc__alca" data-alca aria-hidden="true" />
              </button>
            )
          })}
        </div>
        )}
        <div className="pze-quadro__solta" aria-hidden="true">
          Solte a imagem para usar como fundo
        </div>
      </QuadroDoPuzzle>
    </div>
  )
}

// ------------------------------------------------------------------ o controle da combinação

interface ArrastoDoControle {
  ponteiro: number
  x0: number
  y0: number
  largura: number
  altura: number
  moveu: boolean
  x: number
  y: number
}

/** O controle no editor: o desenho de verdade, parado (a resposta não aparece nele), e arrastável. */
function ControleNoEditor({ puzzle, combinacao, onMudar }: { puzzle: Puzzle; combinacao: CombinacaoDoPuzzle; onMudar: PropsDoQuadroDoEditor['onMudar'] }) {
  const arrasto = useRef<ArrastoDoControle | null>(null)
  // Os controles como nascem para o jogador: o editor mostra o lugar e o tamanho, nunca a resposta.
  const vista = combinacaoNaVista(combinacao, {}, puzzle.controle)

  const comecar = (evento: PointerEvent<HTMLDivElement>) => {
    if (evento.button !== 0 || arrasto.current !== null) return
    const el = evento.currentTarget
    const quadro = el.closest('.qpz')
    if (quadro === null) return
    const caixa = quadro.getBoundingClientRect()
    arrasto.current = { ponteiro: evento.pointerId, x0: evento.clientX, y0: evento.clientY, largura: caixa.width, altura: caixa.height, moveu: false, x: puzzle.controle.x, y: puzzle.controle.y }
    el.setPointerCapture(evento.pointerId)
    evento.preventDefault()
    el.focus({ preventScroll: true })
  }

  const mover = (evento: PointerEvent<HTMLDivElement>) => {
    const a = arrasto.current
    if (a === null || evento.pointerId !== a.ponteiro) return
    const dx = evento.clientX - a.x0
    const dy = evento.clientY - a.y0
    if (!a.moveu && Math.hypot(dx, dy) < LIMIAR_DO_ARRASTO_PX) return
    if (!a.moveu) {
      a.moveu = true
      evento.currentTarget.classList.add('is-arrastando')
    }
    a.x = limitar(puzzle.controle.x + (dx / a.largura) * 100, 0, 100)
    a.y = limitar(puzzle.controle.y + (dy / a.altura) * 100, 0, 100)
    const px = ((a.x - puzzle.controle.x) / 100) * a.largura
    const py = ((a.y - puzzle.controle.y) / 100) * a.altura
    evento.currentTarget.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`
  }

  const terminar = (evento: PointerEvent<HTMLDivElement>, aplicar: boolean) => {
    const a = arrasto.current
    if (a === null || evento.pointerId !== a.ponteiro) return
    arrasto.current = null
    const el = evento.currentTarget
    if (el.hasPointerCapture(a.ponteiro)) el.releasePointerCapture(a.ponteiro)
    // O lugar novo entra no DOM antes de o deslocamento sair: senão o controle somava os dois por um quadro.
    if (a.moveu && aplicar) flushSync(() => onMudar(comControle(puzzle, { x: a.x, y: a.y })))
    el.style.transform = ''
    el.classList.remove('is-arrastando')
  }

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return
    const passo = evento.shiftKey ? PASSO_LARGO_DA_SETA : PASSO_DA_SETA
    const seta: Readonly<Record<string, readonly [number, number]>> = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }
    const d = seta[evento.key]
    if (d !== undefined) {
      evento.preventDefault()
      onMudar(comControle(puzzle, { x: puzzle.controle.x + d[0], y: puzzle.controle.y + d[1] }), 'teclado:controle')
    } else if (evento.key === '+' || evento.key === '=' || evento.key === '-') {
      evento.preventDefault()
      onMudar(comControle(puzzle, { s: puzzle.controle.s + (evento.key === '-' ? -PASSO_DA_ESCALA : PASSO_DA_ESCALA) }), 'teclado:controle')
    }
  }

  return (
    <div
      className="qpz-controle pze-controle"
      style={estiloDoControle(vista)}
      role="button"
      tabIndex={0}
      aria-label={`Controle da combinação (${nomeDoControle(vista)}): arraste para mudar o lugar; setas movem, + e − mudam o tamanho`}
      data-controle-ed
      onPointerDown={comecar}
      onPointerMove={mover}
      onPointerUp={(evento) => terminar(evento, true)}
      onPointerCancel={(evento) => terminar(evento, false)}
      onLostPointerCapture={(evento) => terminar(evento, true)}
      onKeyDown={teclar}
    >
      <div className="pze-controle__miolo" aria-hidden="true">
        <CorpoDoControle combinacao={vista} travado />
      </div>
    </div>
  )
}
