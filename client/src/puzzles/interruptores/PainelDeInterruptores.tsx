/**
 * O PAINEL DOS INTERRUPTORES NO QUADRO DO PUZZLE (28/11): a base fixa (a parede,
 * a chapa, as fendas, os números e a plaqueta, `BaseDosInterruptores`) e o que
 * se mexe (`PainelDeInterruptores`): os lampiões, com a chama e o clarão na
 * chapa, e as alavancas.
 *
 * Os gestos: tocar (ou clicar) numa célula puxa a alavanca dela; a alavanca
 * desce enquanto o dedo aperta e volta na mola ao soltar, e o pedido vai ao
 * soltar (soltar fora da célula não puxa, como num botão). Com o foco numa
 * célula, Enter e Espaço puxam e as setas andam pela grade. O teclado não
 * anima a alavanca (a tecla é repetida; a resposta são os lampiões).
 *
 * O que vale é o host (a vista): a regra de quem vira quem só ele sabe, então a
 * tela não adivinha. A alavanca responde na hora; os lampiões mudam quando a
 * vista chega (na rede da mesa, dentro do décimo de segundo).
 *
 * Sem `onPuxar` (o editor), tudo é só para ver.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as EventoDeTecla, type RefObject } from 'react'
import { classes } from '../../lib/primitivosDaTela'
import type { TecladoDoControle } from '../ControlesDaCombinacao'
import type { InterruptoresNaVista } from '../tipos'
import { ALTURA_DO_QUADRO, BRACO_DA_ALAVANCA, LADO_DO_PUNHO, LARGURA_DO_QUADRO, arteDoLampiao, geometriaDoPainel, urlDaBaseDoPainel, type Caixa } from './arte'
import { colunasDoPainel } from './interruptores'
import { tocarSomDosInterruptores } from './somDosInterruptores'
import './interruptores.css'

/** O punho desce duas vezes o braço da alavanca (do alto da fenda ao pé), em % do próprio tamanho. */
const CURSO_DO_PUNHO = `${((2 * BRACO_DA_ALAVANCA * 100) / LADO_DO_PUNHO).toFixed(2)}%`

/** As chamas não tremulam juntas: cada uma começa num ponto diferente do ciclo (segundos). */
const DEFASAGEM_DA_CHAMA = 0.53

/** A parede, a chapa e a plaqueta (a arte do quadro, por baixo da camada). */
export function BaseDosInterruptores({ interruptores }: { interruptores: InterruptoresNaVista }) {
  return (
    <div className="qpz__arte qpz-int-base">
      <img src={urlDaBaseDoPainel(interruptores.material, interruptores.luzes.length, interruptores.desenho)} alt="" draggable={false} />
    </div>
  )
}

export interface PropsDoPainel {
  interruptores: InterruptoresNaVista
  resolvido: boolean
  /** Ausente = só para ver (o editor e o resumo). */
  onPuxar?: (alavanca: number) => void
  /** Onde a tela do jogador pendura o teclado do painel; ausente = as células ouvem as setas elas mesmas. */
  teclado?: RefObject<TecladoDoControle | null>
}

function noQuadro(caixa: Caixa): CSSProperties {
  return {
    left: `${((caixa.x / LARGURA_DO_QUADRO) * 100).toFixed(3)}%`,
    top: `${((caixa.y / ALTURA_DO_QUADRO) * 100).toFixed(3)}%`,
    width: `${((caixa.largura / LARGURA_DO_QUADRO) * 100).toFixed(3)}%`,
    height: `${((caixa.altura / ALTURA_DO_QUADRO) * 100).toFixed(3)}%`,
  }
}

function naCelula(caixa: Caixa, celula: Caixa): CSSProperties {
  return {
    left: `${(((caixa.x - celula.x) / celula.largura) * 100).toFixed(3)}%`,
    top: `${(((caixa.y - celula.y) / celula.altura) * 100).toFixed(3)}%`,
    width: `${((caixa.largura / celula.largura) * 100).toFixed(3)}%`,
    height: `${((caixa.altura / celula.altura) * 100).toFixed(3)}%`,
  }
}

/** "1, 3 e 4": os lampiões acesos, para o leitor de tela. */
function textoDosAcesos(luzes: readonly boolean[]): string {
  const acesos = luzes.flatMap((acesa, i) => (acesa ? [String(i + 1)] : []))
  if (acesos.length === 0) return 'Nenhum lampião aceso.'
  if (acesos.length === luzes.length) return 'Todos os lampiões acesos.'
  const lista = acesos.length === 1 ? acesos[0] : `${acesos.slice(0, -1).join(', ')} e ${acesos[acesos.length - 1]}`
  return `${acesos.length === 1 ? 'Aceso' : 'Acesos'}: ${lista}.`
}

/** A seta anda quantas células; 0 = não é seta (ou sai da grade pelo lado). */
function passoDaSeta(evento: KeyboardEvent, i: number, quantos: number): number {
  if (evento.ctrlKey || evento.metaKey || evento.altKey) return 0
  const colunas = colunasDoPainel(quantos)
  const coluna = i % colunas
  if (evento.key === 'ArrowRight') return coluna < colunas - 1 && i + 1 < quantos ? 1 : 0
  if (evento.key === 'ArrowLeft') return coluna > 0 ? -1 : 0
  if (evento.key === 'ArrowDown') return i + colunas < quantos ? colunas : 0
  if (evento.key === 'ArrowUp') return i - colunas >= 0 ? -colunas : 0
  return 0
}

export function PainelDeInterruptores({ interruptores, resolvido, onPuxar, teclado }: PropsDoPainel) {
  const { luzes, material, desenho } = interruptores
  const quantos = luzes.length
  const comPlaqueta = desenho !== null
  const geometria = useMemo(() => geometriaDoPainel(quantos, comPlaqueta), [quantos, comPlaqueta])
  const arte = arteDoLampiao(material)
  const interativo = onPuxar !== undefined && !resolvido
  const caixa = useRef<HTMLDivElement>(null)

  // Quantas vezes cada lampião acendeu desde que o painel abriu: o vidro e a chama renascem e a chama "pega".
  // Os que já estavam acesos ao abrir não fingem acender.
  const [acendeu, setAcendeu] = useState<number[]>(() => luzes.map(() => 0))
  const luzesAntes = useRef(luzes)
  useLayoutEffect(() => {
    const antes = luzesAntes.current
    if (antes === luzes) return
    luzesAntes.current = luzes
    if (antes.length !== luzes.length) {
      setAcendeu(luzes.map(() => 0))
      return
    }
    const acenderam = luzes.some((acesa, i) => acesa && antes[i] !== true)
    const apagaram = luzes.some((acesa, i) => !acesa && antes[i] === true)
    if (acenderam) setAcendeu((vezes) => luzes.map((acesa, i) => (acesa && antes[i] !== true ? (vezes[i] ?? 0) + 1 : (vezes[i] ?? 0))))
    // O som do gás: de quem puxou, aqui ou noutro lugar da mesa (no editor, calado).
    if (onPuxar !== undefined && !resolvido) {
      if (acenderam) tocarSomDosInterruptores('acende')
      else if (apagaram) tocarSomDosInterruptores('apaga')
    }
  }, [luzes, onPuxar, resolvido])

  const puxar = (alavanca: number) => {
    if (onPuxar === undefined || !interativo) return
    onPuxar(alavanca)
    tocarSomDosInterruptores('alavanca')
  }

  /** A seta numa célula: o foco anda pela grade, sem animar. Devolve se a tecla era do painel. */
  const tecla = (evento: KeyboardEvent): boolean => {
    const alvo = evento.target instanceof Element ? evento.target.closest<HTMLElement>('[data-alavanca]') : null
    if (alvo === null || caixa.current === null || !caixa.current.contains(alvo)) return false
    const i = Number(alvo.dataset.alavanca)
    const passo = passoDaSeta(evento, i, quantos)
    if (passo === 0) return false
    evento.preventDefault()
    caixa.current.querySelector<HTMLElement>(`[data-alavanca="${i + passo}"]`)?.focus()
    return true
  }
  const teclaAgora = useRef(tecla)
  useEffect(() => {
    teclaAgora.current = tecla
  })

  // A tela do jogador segura as teclas na janela e entrega aqui as que caem numa célula.
  useEffect(() => {
    if (teclado === undefined) return
    teclado.current = (evento) => teclaAgora.current(evento)
    return () => {
      teclado.current = null
    }
  }, [teclado])

  const como = interruptores.objetivo === 'todas' ? 'até todos os lampiões acenderem' : comPlaqueta ? 'até os lampiões ficarem como na plaqueta' : 'até os lampiões ficarem como a pista pede'

  return (
    <div
      ref={caixa}
      className={classes('qpz-int', resolvido && 'is-resolvido', !interativo && 'is-parado')}
      data-material={material}
      data-arranjo={geometria.arranjo}
      style={{ '--int-curso': CURSO_DO_PUNHO } as CSSProperties}
      role="group"
      aria-label={interativo ? `Painel de lampiões: puxe as alavancas ${como}` : 'Painel de lampiões'}
    >
      <div className="qpz-int__claroes" aria-hidden="true">
        {geometria.celulas.map((celula, i) => (
          <img key={i} className={classes('qpz-int__clarao', luzes[i] === true && 'is-aceso')} src={arte.clarao} style={noQuadro(celula.clarao)} alt="" draggable={false} />
        ))}
      </div>
      {geometria.celulas.map((celula, i) => {
        const acesa = luzes[i] === true
        const vez = acendeu[i] ?? 0
        return (
          <button
            key={i}
            type="button"
            className={classes('qpz-int__chave', acesa && 'is-aceso', vez > 0 && 'is-acendeu')}
            style={noQuadro(celula)}
            data-alavanca={i}
            tabIndex={onPuxar !== undefined ? 0 : -1}
            aria-label={`Alavanca ${i + 1}, lampião ${acesa ? 'aceso' : 'apagado'}`}
            aria-disabled={!interativo || undefined}
            onClick={() => puxar(i)}
            onKeyDown={teclado === undefined ? (evento: EventoDeTecla<HTMLButtonElement>) => void tecla(evento.nativeEvent) : undefined}
          >
            <span className="qpz-int__lampiao" style={naCelula(celula.lampiao, celula)} aria-hidden="true">
              <img className="qpz-int__vidro" src={arte.vidro} alt="" draggable={false} />
              <img key={`a${vez}`} className="qpz-int__aceso" src={arte.aceso} alt="" draggable={false} />
              <img key={`c${vez}`} className="qpz-int__chama" src={arte.chama} alt="" draggable={false} style={{ animationDelay: `${(-i * DEFASAGEM_DA_CHAMA).toFixed(2)}s, 0s` }} />
              <img className="qpz-int__corpo" src={arte.corpo} alt="" draggable={false} />
              <img className="qpz-int__reflexo" src={arte.reflexo} alt="" draggable={false} />
            </span>
            <span className="qpz-int__haste" style={naCelula(celula.haste, celula)} aria-hidden="true">
              <img src={arte.haste} alt="" draggable={false} />
            </span>
            <span className="qpz-int__punho" style={naCelula(celula.punho, celula)} aria-hidden="true">
              <img src={arte.punho} alt="" draggable={false} />
            </span>
          </button>
        )
      })}
      <div className="qpz-int__brilho" style={noQuadro(geometria.placa)} aria-hidden="true" />
      <span className="qpz-int__leitor" aria-live="polite">
        {textoDosAcesos(luzes)}
      </span>
    </div>
  )
}
