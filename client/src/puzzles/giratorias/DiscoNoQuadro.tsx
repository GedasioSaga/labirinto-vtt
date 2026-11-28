/**
 * O MEDALHÃO DAS PEÇAS GIRATÓRIAS NO QUADRO DO PUZZLE (28/11): a base fixa (a
 * parede e o aro com a marca, `BaseDoMedalhao`) e os anéis que giram
 * (`DiscoNoQuadro`), cada um a mesma imagem do disco recortada no círculo dele.
 *
 * Os gestos: tocar num anel gira 45 graus no sentido do relógio; arrastar gira
 * para qualquer lado (o anel segue o dedo sem atraso, estala a cada dente que
 * passa e assenta no dente mais perto ao soltar); a roda do mouse gira um dente
 * por vez; com o foco num anel, as setas giram (direita e cima no sentido do
 * relógio), Enter e Espaço também. O teclado não anima (o Emil: a tecla é
 * repetida, a animação a faria parecer lenta).
 *
 * O valor que vale é o do host (a vista). Para o anel não voltar e ir de novo
 * enquanto a resposta viaja, o que a pessoa pediu fica "esperado" até a vista
 * chegar igual (ou 1,5 s, se o host recusou). Com "vizinhas", o arrasto e o
 * esperado levam os dois anéis do lado, como o host fará.
 *
 * Sem `onGirar` (o editor), tudo é só para ver.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as EventoDeTecla, type PointerEvent as EventoDePonteiro, type RefObject } from 'react'
import { useImagemDaMesa } from '../../components/ImagemDaMesa'
import { classes, movimentoReduzido } from '../../lib/primitivosDaTela'
import type { TecladoDoControle } from '../ControlesDaCombinacao'
import { PASSOS_DO_GIRO } from '../tipos'
import type { GiratoriasNaVista, MaterialDasGiratorias } from '../tipos'
import { LADO_DO_DISCO, RAIO_DO_DISCO, RAIO_DO_MIOLO, raiosDosAneis, urlDaBase, urlDoDisco } from './arte'
import { girarAneis, modulo, NOME_DO_SIMBOLO_DO_ANEL, simboloNaMarca } from './giratorias'
import { ALVO_DE_TOQUE_PX, ReguaDosAneis, useFaixaDoAnel } from './ReguaDosAneis'
import { tocarSomDasGiratorias } from './somDasGiratorias'
import './giratorias.css'

/** Graus por dente. */
const GRAUS_DO_PASSO = 360 / PASSOS_DO_GIRO
/** O toque que anda menos que isto (graus ou pixels) é toque, não arrasto. */
const ARRASTO_MIN_GRAUS = 8
const ARRASTO_MIN_PX = 6
/** O rolar do mouse junta isto antes de virar um dente (o mesmo das rodas da combinação). */
const ROLAR_POR_PASSO = 40
/** Sem a vista igual neste tempo, o anel volta para onde a vista diz (o host recusou, ou caiu). */
const ESPERA_DO_HOST_MS = 1500
/** O centro do disco, nas unidades da arte. */
const CENTRO = LADO_DO_DISCO / 2

/** A parede e o aro fixo (a arte do quadro, por baixo da camada). */
export function BaseDoMedalhao({ material }: { material: MaterialDasGiratorias }) {
  return (
    <div className="qpz__arte qpz-giro-base">
      <img src={urlDaBase(material)} alt="" draggable={false} />
    </div>
  )
}

export interface PropsDoDisco {
  giratorias: GiratoriasNaVista
  resolvido: boolean
  /** Ausente = só para ver (o editor e o resumo). */
  onGirar?: (anel: number, passo: 1 | -1) => void
  /** Onde a tela do jogador pendura o teclado do medalhão; ausente = o anel ouve as teclas ele mesmo. */
  teclado?: RefObject<TecladoDoControle | null>
}

interface Arrasto {
  anel: number
  pointerId: number
  cx: number
  cy: number
  /** O ângulo do ponteiro no último movimento. */
  ultimo: number
  /** O quanto o anel já andou desde o aperto (passa de meia volta sem pular). */
  graus: number
  x0: number
  y0: number
  arrastando: boolean
}

/** O ângulo do ponteiro em volta do centro, em graus (0 = direita, horário). */
function anguloDoPonteiro(x: number, y: number, cx: number, cy: number): number {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI
}

/** A diferença de ângulo entre -180 e 180 (o arrasto que cruza a costura do atan2 não pula). */
function diferenca(a: number, b: number): number {
  return modulo(a - b + 180, 360) - 180
}

/** O ângulo contínuo mais perto de `antes` que cai em `alvo` (graus): o anel anda pelo caminho curto. */
function maisPerto(antes: number, alvo: number): number {
  return antes + diferenca(alvo, antes)
}

function dentesDoArrasto(arrasto: Arrasto | null): number {
  return arrasto !== null && arrasto.arrastando ? Math.round(arrasto.graus / GRAUS_DO_PASSO) : 0
}

function rotuloDoAnel(anel: number, total: number): string {
  const onde = anel === 0 ? ', o de fora' : anel === total - 1 ? ', o de dentro' : ''
  return `Anel ${anel + 1} de ${total}${onde}`
}

function textoDoValor(giratorias: GiratoriasNaVista, anel: number, giro: number): string {
  if (giratorias.desenho === 'simbolos') return `${NOME_DO_SIMBOLO_DO_ANEL[simboloNaMarca(giro, anel)]} na marca`
  return `posição ${giro + 1} de ${PASSOS_DO_GIRO}`
}

function iguais(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((valor, k) => valor === b[k])
}

/** A seta (ou Enter e Espaço) vira quantos dentes; 0 = a tecla não é do medalhão. */
function passoDaTecla(evento: KeyboardEvent): 1 | -1 | 0 {
  if (evento.ctrlKey || evento.metaKey || evento.altKey) return 0
  if (evento.key === 'ArrowRight' || evento.key === 'ArrowUp' || evento.key === 'Enter' || evento.key === ' ') return 1
  if (evento.key === 'ArrowLeft' || evento.key === 'ArrowDown') return -1
  return 0
}

export function DiscoNoQuadro({ giratorias, resolvido, onGirar, teclado }: PropsDoDisco) {
  const { giros, vizinhas } = giratorias
  const total = giros.length
  const raios = useMemo(() => raiosDosAneis(total), [total])
  const interativo = onGirar !== undefined && !resolvido
  const resolver = useImagemDaMesa()
  const src = giratorias.desenho === 'imagem' ? resolver(giratorias.imagem) : urlDoDisco(giratorias.desenho, giratorias.cena ?? 'dragao', giratorias.material, total)

  const caixa = useRef<HTMLDivElement>(null)
  const [esperado, setEsperado] = useState<number[] | null>(null)
  const pendentes = useRef(0)
  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  const arrastoAgora = useRef<Arrasto | null>(null)
  const [focado, setFocado] = useState<number | null>(null)
  // A linha da régua apontada (com anéis estreitos demais para o dedo).
  const [apontado, setApontado] = useState<number | null>(null)
  const faixa = useFaixaDoAnel(caixa, total)
  // Os anéis que andam sem animar no próximo desenho (o teclado).
  const semAnimar = useRef(new Set<number>())
  // O ângulo contínuo assentado de cada anel: o próximo giro sai dele pelo caminho curto.
  const angulosAntes = useRef<number[]>([])

  // A vista nova chegou. Igual ao esperado: o host confirmou tudo. Sem pedido na fila: foi outra pessoa (o estalo dela).
  const girosAntes = useRef(giros)
  useEffect(() => {
    if (girosAntes.current === giros) return
    const mudou = !iguais(girosAntes.current, giros)
    girosAntes.current = giros
    if (esperado !== null && iguais(esperado, giros)) {
      pendentes.current = 0
      setEsperado(null)
    } else if (mudou && pendentes.current > 0) {
      pendentes.current -= 1
    } else if (mudou && onGirar !== undefined) {
      tocarSomDasGiratorias('giro')
    }
  }, [giros, esperado, onGirar])

  // O host não confirmou: o anel volta ao que a vista diz.
  useEffect(() => {
    if (esperado === null) return
    const id = window.setTimeout(() => {
      pendentes.current = 0
      setEsperado(null)
    }, ESPERA_DO_HOST_MS)
    return () => window.clearTimeout(id)
  }, [esperado])

  // O mestre zerou o progresso, ou o puzzle mudou de tamanho: nada de esperado velho.
  useEffect(() => {
    pendentes.current = 0
    setEsperado(null)
  }, [total, resolvido])

  const mostrados = esperado !== null && esperado.length === total ? esperado : giros

  /** Pede `passos` dentes no anel (um pedido por dente, como o host conta) e já mostra o resultado esperado. */
  const pedir = (anel: number, passos: number, comSom: boolean) => {
    if (onGirar === undefined || resolvido || passos === 0) return
    const passo: 1 | -1 = passos > 0 ? 1 : -1
    let proximo = [...mostrados]
    for (let i = 0; i < Math.abs(passos); i++) {
      proximo = girarAneis(proximo, anel, passo, vizinhas)
      onGirar(anel, passo)
    }
    if (comSom) tocarSomDasGiratorias('giro')
    pendentes.current += Math.abs(passos)
    setEsperado(proximo)
  }
  const pedirAgora = useRef(pedir)
  useEffect(() => {
    pedirAgora.current = pedir
  })

  /** A tecla num anel: gira sem animar. Devolve se a tecla era do medalhão. */
  const tecla = (evento: KeyboardEvent): boolean => {
    const alvo = evento.target instanceof Element ? evento.target.closest<HTMLElement>('[data-anel]') : null
    if (alvo === null || caixa.current === null || !caixa.current.contains(alvo)) return false
    const passo = passoDaTecla(evento)
    if (passo === 0) return false
    evento.preventDefault()
    if (evento.repeat && (evento.key === 'Enter' || evento.key === ' ')) return true
    const anel = Number(alvo.dataset.anel)
    for (const k of vizinhas ? [anel - 1, anel, anel + 1] : [anel]) semAnimar.current.add(k)
    pedirAgora.current(anel, passo, true)
    return true
  }
  const teclaAgora = useRef(tecla)
  useEffect(() => {
    teclaAgora.current = tecla
  })

  // A tela do jogador segura as teclas na janela e entrega aqui as que caem num anel.
  useEffect(() => {
    if (teclado === undefined) return
    teclado.current = (evento) => teclaAgora.current(evento)
    return () => {
      teclado.current = null
    }
  }, [teclado])

  // O rolar do mouse sobre um anel: um dente a cada `ROLAR_POR_PASSO`; o ouvinte não é passivo para a página não rolar.
  useEffect(() => {
    const el = caixa.current
    if (el === null) return
    let juntado = 0
    const rolou = (evento: WheelEvent) => {
      const alvo = evento.target instanceof Element ? evento.target.closest<HTMLElement>('[data-anel]') : null
      if (alvo === null || alvo.getAttribute('aria-disabled') === 'true' || arrastoAgora.current !== null) return
      evento.preventDefault()
      juntado += evento.deltaY
      if (Math.abs(juntado) < ROLAR_POR_PASSO) return
      pedirAgora.current(Number(alvo.dataset.anel), juntado > 0 ? 1 : -1, true)
      juntado = 0
    }
    el.addEventListener('wheel', rolou, { passive: false })
    return () => el.removeEventListener('wheel', rolou)
  }, [])

  // ---------------------------------------------------------------- o arrasto

  /** Os anéis que andam junto com o arrastado (ele mesmo e, no modo difícil, os do lado). */
  const levados = (anel: number) => (vizinhas ? [anel - 1, anel, anel + 1] : [anel]).filter((k) => k >= 0 && k < total)

  const apertar = (anel: number, evento: EventoDePonteiro<HTMLDivElement>) => {
    if (!interativo || arrastoAgora.current !== null || (evento.pointerType === 'mouse' && evento.button !== 0)) return
    const caixaDoDisco = caixa.current?.getBoundingClientRect()
    if (caixaDoDisco === undefined) return
    const cx = caixaDoDisco.left + caixaDoDisco.width / 2
    const cy = caixaDoDisco.top + caixaDoDisco.height / 2
    evento.currentTarget.setPointerCapture(evento.pointerId)
    const novo: Arrasto = { anel, pointerId: evento.pointerId, cx, cy, ultimo: anguloDoPonteiro(evento.clientX, evento.clientY, cx, cy), graus: 0, x0: evento.clientX, y0: evento.clientY, arrastando: false }
    arrastoAgora.current = novo
    setArrasto(novo)
  }

  const mover = (evento: EventoDePonteiro<HTMLDivElement>) => {
    const atual = arrastoAgora.current
    if (atual === null || evento.pointerId !== atual.pointerId) return
    const angulo = anguloDoPonteiro(evento.clientX, evento.clientY, atual.cx, atual.cy)
    const graus = atual.graus + diferenca(angulo, atual.ultimo)
    const longe = Math.hypot(evento.clientX - atual.x0, evento.clientY - atual.y0) >= ARRASTO_MIN_PX
    const proximo: Arrasto = { ...atual, ultimo: angulo, graus, arrastando: atual.arrastando || longe || Math.abs(graus) >= ARRASTO_MIN_GRAUS }
    // A catraca: um estalo a cada dente que o anel passa, durante o gesto.
    if (proximo.arrastando && dentesDoArrasto(proximo) !== dentesDoArrasto(atual)) tocarSomDasGiratorias('giro')
    arrastoAgora.current = proximo
    setArrasto(proximo)
  }

  const soltar = (evento: EventoDePonteiro<HTMLDivElement>, cancelado: boolean) => {
    const atual = arrastoAgora.current
    if (atual === null || evento.pointerId !== atual.pointerId) return
    arrastoAgora.current = null
    setArrasto(null)
    if (cancelado) return
    if (!atual.arrastando) {
      pedir(atual.anel, 1, true)
      return
    }
    // O anel assenta no dente mais perto de onde o dedo o deixou: nada de voltar dando a volta.
    for (const k of levados(atual.anel)) angulosAntes.current[k] = (angulosAntes.current[k] ?? (mostrados[k] ?? 0) * GRAUS_DO_PASSO) + atual.graus
    // Uma volta inteira não muda nada: só os dentes que sobram vão para o host, pelo caminho curto.
    const dentes = Math.round(diferenca(dentesDoArrasto(atual) * GRAUS_DO_PASSO, 0) / GRAUS_DO_PASSO)
    pedir(atual.anel, dentes, false)
  }

  // ---------------------------------------------------------------- os ângulos

  const vaiJunto = (k: number) => arrasto !== null && arrasto.arrastando && levados(arrasto.anel).includes(k)
  const noArrasto = dentesDoArrasto(arrasto)
  const angulos = mostrados.map((giro, k) => {
    const base = maisPerto(angulosAntes.current[k] ?? giro * GRAUS_DO_PASSO, giro * GRAUS_DO_PASSO)
    return vaiJunto(k) && arrasto !== null ? base + arrasto.graus : base
  })
  useLayoutEffect(() => {
    angulosAntes.current = mostrados.map((giro, k) => maisPerto(angulosAntes.current[k] ?? giro * GRAUS_DO_PASSO, giro * GRAUS_DO_PASSO))
    semAnimar.current.clear()
  })

  const reduzido = movimentoReduzido()
  const emPorcento = (raio: number) => `${((raio / LADO_DO_DISCO) * 100).toFixed(2)}%`
  const pegado = arrasto !== null ? arrasto.anel : null
  const comRegua = interativo && src !== null && faixa < ALVO_DE_TOQUE_PX
  const daRegua = comRegua ? apontado : null
  const destaque = focado !== null ? { anel: focado, tipo: 'foco' as const } : pegado !== null ? { anel: pegado, tipo: 'pega' as const } : daRegua !== null ? { anel: daRegua, tipo: 'foco' as const } : null
  const anelDoDestaque = destaque !== null ? raios[destaque.anel] : undefined

  /** Um dente pela régua; pelo teclado o anel não anima (como as setas no anel). */
  const girarPelaRegua = (anel: number, passo: 1 | -1, peloTeclado: boolean) => {
    if (peloTeclado) for (const k of vizinhas ? [anel - 1, anel, anel + 1] : [anel]) semAnimar.current.add(k)
    pedir(anel, passo, true)
  }

  return (
    <>
      <div
        ref={caixa}
        className={classes('qpz-giro', resolvido && 'is-resolvido', arrasto?.arrastando === true && 'is-arrastando', !interativo && 'is-parado')}
        data-material={giratorias.material}
        role="group"
        aria-label={interativo ? 'Medalhão de anéis: gire cada anel até o desenho fechar' : 'Medalhão de anéis'}
      >
        {src === null ? (
          <div className="qpz-giro__vazio">Sem imagem ainda.</div>
        ) : (
          raios.map((raio, k) => {
            const giro = modulo((mostrados[k] ?? 0) + (vaiJunto(k) ? noArrasto : 0), PASSOS_DO_GIRO)
            return (
              <div
                key={k}
                className={classes('qpz-giro__anel', (vaiJunto(k) || semAnimar.current.has(k) || reduzido) && 'is-seco', pegado === k && 'is-pegado')}
                style={{ clipPath: `circle(${emPorcento(raio.fora)} at 50% 50%)`, transform: `rotate(${(angulos[k] ?? 0).toFixed(2)}deg)` }}
                data-anel={k}
                role="slider"
                tabIndex={onGirar !== undefined ? 0 : -1}
                aria-label={rotuloDoAnel(k, total)}
                aria-valuemin={0}
                aria-valuemax={PASSOS_DO_GIRO - 1}
                aria-valuenow={giro}
                aria-valuetext={textoDoValor(giratorias, k, giro)}
                aria-disabled={!interativo || undefined}
                onPointerDown={(evento) => apertar(k, evento)}
                onPointerMove={mover}
                onPointerUp={(evento) => soltar(evento, false)}
                onPointerCancel={(evento) => soltar(evento, true)}
                onLostPointerCapture={(evento) => soltar(evento, true)}
                onKeyDown={teclado === undefined ? (evento: EventoDeTecla<HTMLDivElement>) => void tecla(evento.nativeEvent) : undefined}
                onFocus={(evento) => setFocado(evento.currentTarget.matches(':focus-visible') ? k : null)}
                onBlur={() => setFocado(null)}
              >
                <img className={classes('qpz-giro__arte', giratorias.desenho === 'imagem' && 'is-propria')} src={src} alt="" draggable={false} />
              </div>
            )
          })
        )}
        {src !== null && (
          <div className="qpz-giro__miolo" style={{ clipPath: `circle(${emPorcento(RAIO_DO_MIOLO)} at 50% 50%)` }} aria-hidden="true">
            <img className={classes('qpz-giro__arte', giratorias.desenho === 'imagem' && 'is-propria')} src={src} alt="" draggable={false} />
          </div>
        )}
        <div className="qpz-giro__luz" style={{ clipPath: `circle(${emPorcento(RAIO_DO_DISCO)} at 50% 50%)` }} aria-hidden="true" />
        <JuntasEMarca juntas={raios.map((raio) => raio.dentro)} destaque={anelDoDestaque !== undefined && destaque !== null ? { ...anelDoDestaque, tipo: destaque.tipo } : null} />
      </div>
      {comRegua && <ReguaDosAneis total={total} material={giratorias.material} rotulo={(k) => rotuloDoAnel(k, total)} onGirar={girarPelaRegua} onApontar={setApontado} />}
    </>
  )
}

// ------------------------------------------------------------------ o que não gira: o brilho das juntas, a marca, o destaque

/** Um arco do círculo de raio `r`, centrado no ângulo `centro` (graus, horário a partir da direita), `meia` graus para cada lado. */
function arco(r: number, centro: number, meia: number): string {
  const a = ((centro - meia) * Math.PI) / 180
  const b = ((centro + meia) * Math.PI) / 180
  return `M${(CENTRO + r * Math.cos(a)).toFixed(1)},${(CENTRO + r * Math.sin(a)).toFixed(1)}A${r},${r} 0 0,1 ${(CENTRO + r * Math.cos(b)).toFixed(1)},${(CENTRO + r * Math.sin(b)).toFixed(1)}`
}

/**
 * A luz vem de cima à esquerda (225 graus) e não gira com os anéis: em cada
 * junta, a borda do anel de dentro brilha em cima à esquerda e a parede do anel
 * de fora brilha embaixo à direita; o contrário fica na sombra. O brilho curto
 * vai num caminho à parte para somar com o largo (o meio do arco é mais claro).
 */
function JuntasEMarca({ juntas, destaque }: { juntas: number[]; destaque: { fora: number; dentro: number; tipo: 'foco' | 'pega' } | null }) {
  const chave = juntas.join()
  const caminhos = useMemo(() => {
    const todas = [...juntas, RAIO_DO_DISCO]
    const largo = todas.map((r) => arco(r - 4.5, 225, 70) + arco(r + 4.5, 45, 70)).join('')
    const curto = todas.map((r) => arco(r - 4.5, 225, 34) + arco(r + 4.5, 45, 34)).join('')
    const sombra = todas.map((r) => arco(r - 4.5, 45, 75) + arco(r + 4.5, 225, 75)).join('')
    return { todas, largo, curto, sombra }
    // A chave é o conteúdo: a lista nasce nova a cada desenho do pai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])
  return (
    <svg className="qpz-giro__juntas" viewBox={`0 0 ${LADO_DO_DISCO} ${LADO_DO_DISCO}`} aria-hidden="true" focusable="false">
      <path d={caminhos.sombra} className="qpz-giro__sombra" />
      <path d={caminhos.largo} className="qpz-giro__reflexo" />
      <path d={caminhos.curto} className="qpz-giro__reflexo" />
      {/* o resolvido: as juntas se acendem de ouro (um halo largo e fraco, um fio forte por cima; sem filtro) */}
      <g className="qpz-giro__brilho">
        {caminhos.todas.map((r) => (
          <circle key={`h${r}`} className="qpz-giro__halo" cx={CENTRO} cy={CENTRO} r={r} />
        ))}
        {caminhos.todas.map((r) => (
          <circle key={`f${r}`} className="qpz-giro__fio" cx={CENTRO} cy={CENTRO} r={r} />
        ))}
      </g>
      {destaque !== null && (
        <g className={destaque.tipo === 'foco' ? 'qpz-giro__foco' : 'qpz-giro__pega'}>
          <circle cx={CENTRO} cy={CENTRO} r={destaque.fora - 3} />
          <circle cx={CENTRO} cy={CENTRO} r={destaque.dentro + 3} />
        </g>
      )}
      {/* a marca: a ponta da aba do aro, que desce sobre o anel de fora */}
      <g className="qpz-giro__marca">
        <path d={`M${CENTRO - 15},36H${CENTRO + 15}L${CENTRO},88Z`} className="qpz-giro__marca-sombra" transform="translate(4 5)" />
        <path d={`M${CENTRO - 15},36H${CENTRO}V88Z`} className="qpz-giro__marca-luz" />
        <path d={`M${CENTRO},36H${CENTRO + 15}L${CENTRO},88Z`} className="qpz-giro__marca-escuro" />
      </g>
    </svg>
  )
}
