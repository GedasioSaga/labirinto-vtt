import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { estaCalado, useSomStore } from '../stores/somStore'
import { assinarTelasQueFaltam, entrarNaLargadaDoMestre, esperarLargadaDoJogador, largarAgora, telasQueFaltam, type EsperaDoJogador } from './largada'
import { tocarAberturaDeBatalha, type ControleDeTransicao } from './motor'
import './transicoes.css'

/**
 * MODO BATALHA (fatia B5): a abertura da batalha (as espadas ou a Marinha, com o nome ou sem) em
 * tela cheia, no mestre, no jogador e na TV. Toca uma vez por `abertura.id` e
 * some com o mesmo fade curto da transição de local (`TransicaoOverlay.tsx`).
 * Sem `transicao` ("Nenhuma") não aparece; abertura que este app não tem
 * (pacote ainda não baixado) termina na hora pelo próprio motor.
 *
 * LARGADA COMBINADA (09/11/2026, `largada.ts`): cada tela prepara a cena por
 * baixo da cortina preta, avisa que está pronta e só toca quando a mesa larga
 * (todas prontas, ou o prazo). No mestre a conta vem das telas da sala; no
 * jogador e na TV, do `preparo` e do `largouEm` que a conexão entrega.
 * Enquanto carrega, o jogador e a TV batem "carregando" para o mestre (a tela
 * viva segura a mesa por mais tempo que a muda); o mestre vê quantas telas
 * faltam e pode largar já, no "Tocar agora".
 */

/** O pedido de tocar: `id` novo a cada batalha ligada. */
export interface AberturaPedida {
  id: number
  transicao?: string
  texto?: string
  /** Jogador e TV: o número que o mestre deu a este preparo. Ausente = mestre antigo, ou a tela do próprio mestre. */
  preparo?: number
  /** Jogador e TV: o instante (`performance.now()`) em que a ordem de tocar chegou. */
  largouEm?: number
  /** Jogador e TV: de quanto em quanto avisar o mestre de que a cena ainda carrega. Ausente = o mestre não ouve a batida. */
  batidaMs?: number
}

interface AberturaDeBatalhaOverlayProps {
  abertura: AberturaPedida | null | undefined
  /** 0 a 1. Ausente = o "Som da mesa" deste aparelho (volume e mudo). A TV passa o volume fixo dela. */
  volume?: number
  /** Jogador e TV: conta ao mestre que a abertura do `preparo` está carregada aqui (ou que esta tela desistiu dela). */
  aoFicarPronta?: (preparo: number) => void
  /** Jogador e TV: a batida de quem ainda carrega a abertura do `preparo` ("estou viva"). */
  aoCarregar?: (preparo: number) => void
}

/** Saída da cortina: o mesmo fade da transição de local. */
const SAIDA_MS = 260

/** Em que pé está a abertura nesta tela: carregando, esperando a mesa largar, ou no ar. */
type Fase = 'preparando' | 'esperando' | 'tocando'

function querMovimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface AberturaTelaProps {
  id: string
  nome: string | undefined
  volume: number
  preparo: number | undefined
  largouEm: number | undefined
  batidaMs: number | undefined
  aoFicarPronta: ((preparo: number) => void) | undefined
  aoCarregar: ((preparo: number) => void) | undefined
  onFase: (fase: Fase) => void
  onFim: () => void
}

function AberturaTela({ id, nome, volume, preparo, largouEm, batidaMs, aoFicarPronta, aoCarregar, onFase, onFim }: AberturaTelaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cortinaRef = useRef<HTMLDivElement>(null)
  const controleRef = useRef<ControleDeTransicao | null>(null)
  const esperaRef = useRef<EsperaDoJogador | null>(null)
  /** O aviso de "esta tela saiu" de uma desmontagem, adiado um instante (ver a limpeza do efeito). */
  const desistenciaRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onFimRef = useRef(onFim)
  onFimRef.current = onFim
  const onFaseRef = useRef(onFase)
  onFaseRef.current = onFase
  const aoFicarProntaRef = useRef(aoFicarPronta)
  aoFicarProntaRef.current = aoFicarPronta
  const aoCarregarRef = useRef(aoCarregar)
  aoCarregarRef.current = aoCarregar
  const volumeRef = useRef(volume)
  volumeRef.current = volume
  const largouEmRef = useRef(largouEm)
  largouEmRef.current = largouEm

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (desistenciaRef.current !== null) clearTimeout(desistenciaRef.current)
    desistenciaRef.current = null
    let vivo = true
    const desistencia = new AbortController()
    // Quem diz a hora de largar: no mestre, as telas da sala; no jogador e na TV, a ordem do mestre.
    const lugar = preparo === undefined ? entrarNaLargadaDoMestre() : null
    const espera = preparo === undefined ? null : esperarLargadaDoJogador()
    esperaRef.current = espera
    if (espera !== null && largouEmRef.current !== undefined) espera.largou(largouEmRef.current)
    const largada = lugar?.largada ?? espera?.largada
    let avisou = false
    // Jogador e TV: enquanto a cena carrega aqui, a batida diz ao mestre que esta tela está viva
    // (a primeira já saiu da conexão, ao receber o aviso). Para quando a tela solta a mesa.
    const batida = preparo === undefined || batidaMs === undefined ? undefined : setInterval(() => aoCarregarRef.current?.(preparo), batidaMs)
    /** Pronta, terminada ou desistida: nos três casos a mesa não espera mais por esta tela. Uma vez só. */
    const soltarAMesa = () => {
      if (avisou) return
      avisou = true
      clearInterval(batida)
      lugar?.pronta()
      if (preparo !== undefined) aoFicarProntaRef.current?.(preparo)
    }
    void tocarAberturaDeBatalha({
      canvas,
      id,
      ...(nome === undefined ? {} : { nome }),
      ...(largada === undefined ? {} : { largada }),
      volume: volumeRef.current,
      reduzirMovimento: querMovimentoReduzido(),
      sinal: desistencia.signal,
      onPronta: () => {
        soltarAMesa()
        if (vivo) onFaseRef.current('esperando')
      },
      onLargada: () => {
        if (vivo) onFaseRef.current('tocando')
      },
      onFade: (opacidade) => {
        if (cortinaRef.current) cortinaRef.current.style.opacity = String(opacidade)
      },
      onFim: () => {
        // Abertura que este app não tem, ou cena que falhou: a mesa também não espera por ela.
        soltarAMesa()
        if (vivo) onFimRef.current()
      },
    }).then((controle) => {
      if (vivo) controleRef.current = controle
      else controle.parar()
    })
    return () => {
      vivo = false
      clearInterval(batida)
      desistencia.abort()
      espera?.cancelar()
      esperaRef.current = null
      controleRef.current?.parar()
      controleRef.current = null
      // Saiu antes de ficar pronta (pulou, a batalha acabou): não segura a mesa. Adiado um instante
      // porque o React de desenvolvimento desmonta e monta de novo na hora, e essa não é uma saída.
      if (!avisou) desistenciaRef.current = setTimeout(soltarAMesa, 0)
    }
  }, [id, nome, preparo, batidaMs])

  // A ordem de tocar chegou pela conexão (jogador e TV).
  useEffect(() => {
    if (largouEm !== undefined) esperaRef.current?.largou(largouEm)
  }, [largouEm])

  useEffect(() => {
    controleRef.current?.definirVolume(volume)
  }, [volume])

  return (
    <div className="lb-transicao-tela">
      <canvas ref={canvasRef} className="lb-transicao-tela__cena" />
      <div ref={cortinaRef} className="lb-transicao-tela__cortina" aria-hidden="true" />
    </div>
  )
}

/** O que a tela preta diz enquanto a cena não larga. No mestre, quantas telas da sala ainda carregam. */
function textoDoAviso(fase: Fase, doMestre: boolean, faltam: number): string {
  if (fase === 'preparando') return 'Preparando a cena…'
  if (!doMestre) return 'Esperando a mesa…'
  if (faltam === 0) return 'Preparando a cena…'
  return faltam === 1 ? 'Esperando 1 tela…' : `Esperando ${faltam} telas…`
}

export function AberturaDeBatalhaOverlay({ abertura, volume, aoFicarPronta, aoCarregar }: AberturaDeBatalhaOverlayProps) {
  const [vista, setVista] = useState<number | null>(null)
  const [saindo, setSaindo] = useState(false)
  const [fase, setFase] = useState<Fase>('preparando')
  const pularRef = useRef<HTMLButtonElement>(null)
  const volumeDoAparelho = useSomStore((estado) => (estaCalado(estado) ? 0 : estado.volume))
  const faltam = useSyncExternalStore(assinarTelasQueFaltam, telasQueFaltam)
  const pedido = abertura ?? null
  const ativa = pedido !== null && pedido.transicao !== undefined && vista !== pedido.id
  const nonce = pedido?.id ?? null

  useEffect(() => {
    setSaindo(false)
    setFase('preparando')
  }, [nonce])

  useEffect(() => {
    if (ativa) pularRef.current?.focus()
  }, [ativa, nonce])

  useEffect(() => {
    if (!saindo || nonce === null) return
    const timer = setTimeout(() => setVista(nonce), SAIDA_MS)
    return () => clearTimeout(timer)
  }, [saindo, nonce])

  if (!ativa || pedido === null || pedido.transicao === undefined) return null
  const terminar = () => setSaindo(true)
  const doMestre = pedido.preparo === undefined
  // Só o mestre larga a mesa, e só quando a cena dele já está pronta e ainda há tela carregando.
  const podeLargar = doMestre && fase === 'esperando' && faltam > 0 && !saindo

  return createPortal(
    <div className="lb-transicao-jogo" data-saindo={saindo} role="dialog" aria-modal="true" aria-label="Abertura da batalha">
      {/* `key`: outra batalha ligada no meio da animação recomeça do zero. */}
      <AberturaTela
        key={pedido.id}
        id={pedido.transicao}
        nome={pedido.texto}
        volume={volume ?? volumeDoAparelho}
        preparo={pedido.preparo}
        largouEm={pedido.largouEm}
        batidaMs={pedido.batidaMs}
        aoFicarPronta={aoFicarPronta}
        aoCarregar={aoCarregar}
        onFase={setFase}
        onFim={terminar}
      />
      {/* Só aparece se a espera passar de um instante (o atraso mora no CSS); com a cena no ar, some. */}
      <div className="lb-transicao-jogo__espera" data-visivel={fase !== 'tocando' && !saindo}>
        <p className="lb-transicao-jogo__aviso" role="status">
          {textoDoAviso(fase, doMestre, faltam)}
        </p>
        {/* "Tocar agora": o mestre não espera quem ainda carrega; essas telas entram no ponto certo da cena. */}
        {podeLargar && (
          <button type="button" className="lb-transicao-jogo__agora" onClick={largarAgora}>
            Tocar agora
          </button>
        )}
      </div>
      <button ref={pularRef} type="button" className="lb-transicao-jogo__pular" onClick={terminar}>
        Pular
      </button>
    </div>,
    document.body,
  )
}
