/**
 * O QUADRO DE PERTO do puzzle (PLANO §3.1): a arte do modelo (ou a imagem do
 * mestre), o grão, os encaixes com as peças postas, a troca de peso, os
 * controles da combinação (`ControlesDaCombinacao.tsx`) e a porta que abre ao
 * resolver. Um componente só para a tela do jogador, o "Testar
 * como jogador" e o editor (que põe a camada dele por cima, em `children`).
 *
 * Só desenha: o que tocar faz é de quem usa (`onTocarEncaixe`, `onTocarBandeja`,
 * `onTrocar`). Sem esses, os encaixes e a bandeja são só para ver, sem botão.
 *
 * A porta abre sozinha quando `resolvido` passa de falso a verdadeiro com o
 * quadro na tela, e avisa em `onAbriu` (a hora do cartão do desfecho). Quem
 * entra num puzzle já resolvido o vê aberto, sem animação e sem aviso.
 *
 * A arte é memoizada pelo visual: mexer nos encaixes (a cada peça posta) não
 * redesenha o SVG grande (PLANO §5.4, desempenho).
 */
import { memo, useEffect, useId, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react'
import { classes, movimentoReduzido } from '../lib/primitivosDaTela'
import { useImagemDaMesa } from '../components/ImagemDaMesa'
import { ArteSvg } from './arte/ArteSvg'
import { desenhoDoModelo, temMolduraPorta } from './arte/modelos'
import { CorpoDoControle, estiloDoControle, nomeDoControle, type AcoesDaCombinacao, type TecladoDoControle } from './ControlesDaCombinacao'
import { BaseDoMedalhao, DiscoNoQuadro } from './giratorias/DiscoNoQuadro'
import { BaseDosInterruptores, PainelDeInterruptores } from './interruptores/PainelDeInterruptores'
import { BaseDaCooperacao, PainelDaCooperacao } from './cooperacao/PainelDaCooperacao'
import { BaseDaMistura, PainelDaMistura, type PropsDaBancada } from './mistura/PainelDaMistura'
import { BaseDasCamadas, PainelDasCamadas, type PropsDaMesa } from './camadas/MesaDeLuz'
import { ArteDoRelevo, PlacaNoQuadro, useFonteDoPainel } from './relevo/PainelNoQuadro'
import { PESO_MAX } from './tipos'
import type { CamadasNaVista, CombinacaoNaVista, CooperacaoNaVista, EncaixeNaVista, GiratoriasNaVista, InterruptoresNaVista, MisturaNaVista, PostaNaVista, VisualDoPuzzle, VistaDoPuzzle } from './tipos'
import './QuadroDoPuzzle.css'

/** O tempo até o cartão do desfecho: a porta inteira (900 ms) e a folga do v2; sem arte, só a folga; reduzido, quase já. */
const ESPERA_DA_PORTA_MS = 1000
const ESPERA_SEM_ARTE_MS = 260
const ESPERA_REDUZIDA_MS = 160

/** A caixa da troca do v1 (`left 69,4%`, `top 12%`, `19,4% x 84%`), centrada em (x, y). */
const MEIA_LARGURA_DA_TROCA = 9.7
const MEIA_ALTURA_DA_TROCA = 42

export interface PropsDoQuadroDoPuzzle {
  visual: VisualDoPuzzle
  encaixes: readonly EncaixeNaVista[]
  /** Troca de peso; ausente ou `null` = sem troca. */
  troca?: VistaDoPuzzle['troca']
  resolvido: boolean
  /** O nome de quem olha: a peça que ele mesmo pôs não leva o "posto por". */
  eu?: string
  /** Encaixes acesos como alvo da peça escolhida (tracejado do v2). */
  alvos?: ReadonlySet<string>
  /** A bandeja acesa como alvo. */
  bandejaEhAlvo?: boolean
  /** O peso para onde a agulha do mostrador aponta; ausente = o peso pedido. */
  agulha?: number
  onTocarEncaixe?: (encaixeId: string, botao: HTMLButtonElement) => void
  onTocarBandeja?: (botao: HTMLButtonElement) => void
  onTrocar?: () => void
  /** A porta acabou de abrir (ou, sem arte de modelo, o resolver assentou): mostre o cartão do desfecho. */
  onAbriu?: () => void
  /** O controle da combinação sobre a arte; ausente = puzzle de encaixes. */
  combinacao?: CombinacaoNaVista
  /** O que girar, mexer o ponteiro, apertar e tentar fazem. Sem isto, o controle é só para ver. */
  acoesDaCombinacao?: AcoesDaCombinacao
  /** Onde pendurar o teclado do controle (a tela do jogador segura as teclas e as entrega a ele). */
  tecladoDoControle?: RefObject<TecladoDoControle | null>
  /** O medalhão das peças giratórias (a arte vira a base dele); ausente = outro puzzle. */
  giratorias?: GiratoriasNaVista
  /** O que girar um anel faz (`passo` +1 = horário). Sem isto, o medalhão é só para ver. */
  onGirarAnel?: (anel: number, passo: 1 | -1) => void
  /** O painel dos interruptores com estado (a arte vira a chapa dele); ausente = outro puzzle. */
  interruptores?: InterruptoresNaVista
  /** O que puxar uma alavanca faz. Sem isto, o painel é só para ver. */
  onPuxarAlavanca?: (alavanca: number) => void
  /** Os pontos da cooperação em dois lugares (a arte vira a chapa deles); ausente = outro puzzle. */
  cooperacao?: CooperacaoNaVista
  /** O que acionar um ponto faz. Sem isto, os pontos são só para ver. */
  onAcionarPonto?: (ponto: number) => void
  /** A bancada da mistura de líquidos (a arte vira a prateleira dela); ausente = outro puzzle. */
  mistura?: MisturaNaVista
  /** Despejar, deitar o item da mochila e recomeçar. Sem `onDespejar`, a bancada é só para ver. */
  acoesDaMistura?: Pick<PropsDaBancada, 'onDespejar' | 'onRecomecar' | 'onDeitar' | 'ingrediente'>
  /** A mesa de luz das camadas (a arte vira a parede e a mesa); ausente = outro puzzle. */
  camadas?: CamadasNaVista
  /** Empilhar, girar, mover e tirar uma lâmina, e a lâmina na mão. Sem `onEmpilhar`, a mesa é só para ver. */
  acoesDasCamadas?: Pick<PropsDaMesa, 'onEmpilhar' | 'onGirar' | 'onMover' | 'onTirar' | 'naMao'>
  /** O nome do quadro para o leitor de tela ("Fonte", o título público). */
  rotulo?: string
  className?: string
  ref?: Ref<HTMLDivElement>
  /** Por cima de tudo: o cartão do desfecho, a camada do editor, a faixa do teste. */
  children?: ReactNode
}

export function QuadroDoPuzzle(props: PropsDoQuadroDoPuzzle) {
  const { visual, encaixes, troca, resolvido, onAbriu, giratorias, interruptores, cooperacao, mistura, camadas } = props
  const id = useId()
  // O medalhão e os painéis contam como arte: o cartão do desfecho espera as juntas (ou os lampiões) acenderem e o acorde soar.
  const abrindo = useAbertura(resolvido, visual.tipo === 'modelo' || giratorias !== undefined || interruptores !== undefined || cooperacao !== undefined || mistura !== undefined || camadas !== undefined, onAbriu)
  const grao = graoDoQuadro()
  // A Porta de brasões: a placa e os encaixes somem quando a porta se abre.
  const encaixesSomem = visual.tipo === 'modelo' && visual.modelo === 'porta'
  // O painel em relevo: a arte é o painel em bitmap, e cada encaixe com placa é o vão da placa que falta.
  const relevo = visual.tipo === 'relevo' ? visual : null
  const fonte = useFonteDoPainel(relevo)

  return (
    <div
      ref={props.ref}
      className={classes(
        'qpz',
        resolvido && 'is-resolvido',
        resolvido && abrindo && 'is-abrindo',
        temMolduraPorta(visual) && giratorias === undefined && interruptores === undefined && cooperacao === undefined && mistura === undefined && camadas === undefined && 'is-porta',
        relevo !== null && 'is-relevo',
        giratorias !== undefined && 'is-giratorias',
        interruptores !== undefined && 'is-interruptores',
        cooperacao !== undefined && 'is-coop',
        mistura !== undefined && 'is-mistura',
        camadas !== undefined && 'is-camadas',
        props.className,
      )}
      role="group"
      aria-label={props.rotulo}
    >
      {giratorias !== undefined ? (
        <BaseDoMedalhao material={giratorias.material} />
      ) : interruptores !== undefined ? (
        <BaseDosInterruptores interruptores={interruptores} />
      ) : cooperacao !== undefined ? (
        <BaseDaCooperacao cooperacao={cooperacao} />
      ) : mistura !== undefined ? (
        <BaseDaMistura mistura={mistura} />
      ) : camadas !== undefined ? (
        <BaseDasCamadas camadas={camadas} />
      ) : relevo !== null ? (
        <ArteDoRelevo visual={relevo} fonte={fonte} />
      ) : (
        <ArteDoQuadro visual={visual} prefixo={id} />
      )}
      {grao !== null && <div className="qpz__grao" style={{ backgroundImage: `url(${grao})` }} aria-hidden="true" />}
      <div className="qpz__camada">
        {encaixes.map((encaixe, i) =>
          relevo !== null && encaixe.placa !== undefined ? (
            <PlacaNoQuadro
              key={encaixe.id}
              encaixe={{ ...encaixe, placa: encaixe.placa }}
              cena={relevo.cena}
              fonte={fonte}
              rotulo={rotuloDoEncaixe(encaixe, i + 1, resolvido, props.eu)}
              resolvido={resolvido}
              mostraQuem={encaixe.posta !== null && encaixe.posta.por !== '' && encaixe.posta.por !== props.eu && !resolvido}
              alvo={props.alvos?.has(encaixe.id) ?? false}
              onTocar={props.onTocarEncaixe}
            />
          ) : (
            <EncaixeDoQuadro
              key={encaixe.id}
              encaixe={encaixe}
              numero={i + 1}
              resolvido={resolvido}
              eu={props.eu}
              alvo={props.alvos?.has(encaixe.id) ?? false}
              some={encaixesSomem}
              onTocar={props.onTocarEncaixe}
            />
          ),
        )}
        {troca && (
          <TrocaDoQuadro
            troca={troca}
            resolvido={resolvido}
            alvo={props.bandejaEhAlvo ?? false}
            agulha={props.agulha ?? troca.pesoPedido}
            onTocarBandeja={props.onTocarBandeja}
            onTrocar={props.onTrocar}
          />
        )}
        {props.combinacao !== undefined && (
          // Dentro da camada: com a moldura Porta, o controle some junto com as folhas (o `.controle` do v2).
          <div className={classes('qpz-controle', resolvido && 'is-feito')} style={estiloDoControle(props.combinacao)} role="group" aria-label={nomeDoControle(props.combinacao)} data-controle>
            <CorpoDoControle combinacao={props.combinacao} travado={resolvido} acoes={props.acoesDaCombinacao} teclado={props.tecladoDoControle} />
          </div>
        )}
        {giratorias !== undefined && <DiscoNoQuadro giratorias={giratorias} resolvido={resolvido} onGirar={props.onGirarAnel} teclado={props.tecladoDoControle} />}
        {interruptores !== undefined && <PainelDeInterruptores interruptores={interruptores} resolvido={resolvido} onPuxar={props.onPuxarAlavanca} teclado={props.tecladoDoControle} />}
        {cooperacao !== undefined && <PainelDaCooperacao cooperacao={cooperacao} resolvido={resolvido} onAcionar={props.onAcionarPonto} />}
        {mistura !== undefined && <PainelDaMistura mistura={mistura} resolvido={resolvido} {...props.acoesDaMistura} teclado={props.tecladoDoControle} />}
        {camadas !== undefined && <PainelDasCamadas camadas={camadas} resolvido={resolvido} {...props.acoesDasCamadas} teclado={props.tecladoDoControle} />}
      </div>
      <div className="qpz__flash" aria-hidden="true" />
      {props.children}
    </div>
  )
}

/**
 * `true` enquanto a porta abre: do instante em que `resolvido` vira verdadeiro
 * até o fim da espera, quando `onAbriu` é chamado. Montar já resolvido não
 * conta (o quadro nasce aberto).
 */
function useAbertura(resolvido: boolean, comArte: boolean, onAbriu: (() => void) | undefined): boolean {
  const [resolvidoVisto, setResolvidoVisto] = useState(resolvido)
  const [abertura, setAbertura] = useState<{ vez: number; comArte: boolean } | null>(null)
  const [abrindo, setAbrindo] = useState(false)
  const onAbriuAgora = useRef(onAbriu)
  useEffect(() => {
    onAbriuAgora.current = onAbriu
  })

  // O ajuste de estado na mudança da prop (o padrão do React), no mesmo render: a classe já sai com a porta.
  if (resolvido !== resolvidoVisto) {
    setResolvidoVisto(resolvido)
    setAbrindo(resolvido && comArte)
    // Zerado no meio da abertura (o mestre devolveu as peças): a espera cai junto, e `onAbriu` não chega.
    setAbertura(resolvido ? { vez: (abertura?.vez ?? 0) + 1, comArte } : null)
  }

  useEffect(() => {
    if (abertura === null) return
    const espera = movimentoReduzido() ? ESPERA_REDUZIDA_MS : abertura.comArte ? ESPERA_DA_PORTA_MS : ESPERA_SEM_ARTE_MS
    const timer = window.setTimeout(() => {
      setAbrindo(false)
      onAbriuAgora.current?.()
    }, espera)
    return () => window.clearTimeout(timer)
  }, [abertura])

  return abrindo
}

// ------------------------------------------------------------------ a arte

const ArteDoQuadro = memo(
  function ArteDoQuadro({ visual, prefixo }: { visual: VisualDoPuzzle; prefixo: string }) {
    const resolver = useImagemDaMesa()
    // Só roda quando a chave da arte muda (o `memo` abaixo compara por ela), e não a cada vista nova da rede.
    if (visual.tipo === 'modelo') {
      return (
        <div className="qpz__arte">
          <ArteSvg arte={desenhoDoModelo(visual, prefixo)} />
        </div>
      )
    }
    const src = visual.tipo === 'imagem' ? resolver(visual.imagem) : null
    if (src === null) return <div className="qpz__vazio">Sem imagem ainda.</div>
    return (
      <div className="qpz__arte">
        <img src={src} alt="" draggable={false} />
      </div>
    )
  },
  (antes, depois) => antes.prefixo === depois.prefixo && mesmaChave(chaveDaArte(antes.visual), chaveDaArte(depois.visual)),
)

/** O que muda o desenho: o resto da vista (encaixes, mochila, rev) não. */
function chaveDaArte(visual: VisualDoPuzzle): readonly string[] {
  if (visual.tipo === 'imagem') return ['imagem', visual.imagem ?? '']
  if (visual.tipo === 'relevo') return ['relevo', visual.cena ?? '', visual.imagem ?? '', visual.metal]
  return ['modelo', visual.modelo, visual.moldura, visual.cores.parede, visual.cores.chao, visual.cores.objeto, visual.inscricao]
}

function mesmaChave(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((parte, i) => parte === b[i])
}

const LADO_DO_GRAO = 96
const SEMENTE_DO_GRAO = 7
let graoGuardado: string | null | undefined

/** O grão de papel do v2 (96 px de ruído cinza), gerado uma vez por página. `null` = sem canvas aqui. */
function graoDoQuadro(): string | null {
  if (graoGuardado !== undefined) return graoGuardado
  const canvas = document.createElement('canvas')
  canvas.width = LADO_DO_GRAO
  canvas.height = LADO_DO_GRAO
  const ctx = canvas.getContext('2d')
  if (ctx === null) {
    graoGuardado = null
    return null
  }
  const imagem = ctx.createImageData(LADO_DO_GRAO, LADO_DO_GRAO)
  let s = SEMENTE_DO_GRAO
  for (let i = 0; i < imagem.data.length; i += 4) {
    // O mulberry32 do v2, em linha: o mesmo grão em toda abertura.
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    const v = 110 + (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 60
    imagem.data[i] = v
    imagem.data[i + 1] = v
    imagem.data[i + 2] = v
    imagem.data[i + 3] = 255
  }
  ctx.putImageData(imagem, 0, 0)
  graoGuardado = canvas.toDataURL()
  return graoGuardado
}

// ------------------------------------------------------------------ o encaixe

interface PropsDoEncaixe {
  encaixe: EncaixeNaVista
  numero: number
  resolvido: boolean
  eu: string | undefined
  alvo: boolean
  some: boolean
  onTocar: PropsDoQuadroDoPuzzle['onTocarEncaixe']
}

function EncaixeDoQuadro({ encaixe, numero, resolvido, eu, alvo, some, onTocar }: PropsDoEncaixe) {
  const { posta } = encaixe
  const mostraQuem = posta !== null && posta.por !== '' && posta.por !== eu && !resolvido
  const className = classes('qpz-encaixe', encaixe.forma !== 'redondo' && `qpz-encaixe--${encaixe.forma}`, alvo && !resolvido && 'is-pode', some && 'qpz-some')
  const style = { left: `${encaixe.x}%`, top: `${encaixe.y}%`, width: `${encaixe.t}cqw` }
  const miolo = (
    <>
      {posta !== null && <PecaNoEncaixe posta={posta} />}
      <span className="qpz-encaixe__brilho" />
      {mostraQuem && <span className="qpz-encaixe__quem">{posta.por}</span>}
    </>
  )
  if (onTocar === undefined) {
    return (
      <span className={className} style={style} aria-hidden="true">
        {miolo}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={className}
      style={style}
      data-alvo="encaixe"
      data-enc={encaixe.id}
      aria-label={rotuloDoEncaixe(encaixe, numero, resolvido, eu)}
      aria-disabled={resolvido || undefined}
      onClick={(event) => onTocar(encaixe.id, event.currentTarget)}
    >
      {miolo}
    </button>
  )
}

function PecaNoEncaixe({ posta }: { posta: PostaNaVista }) {
  const src = useImagemDaMesa()(posta.imagem)
  return (
    <span className="qpz-encaixe__peca">
      {src !== null ? <img src={src} alt="" draggable={false} /> : <span className="qpz-encaixe__inicial">{inicial(posta.nome)}</span>}
    </span>
  )
}

function inicial(nome: string): string {
  return Array.from(nome.trim())[0]?.toUpperCase() ?? '?'
}

/** "Encaixe 2: Medalhão do Sapo, posto por Bento, preso" (o rótulo do v2; as metades, do v1). */
function rotuloDoEncaixe(encaixe: EncaixeNaVista, numero: number, resolvido: boolean, eu: string | undefined): string {
  const { posta } = encaixe
  let conteudo: string
  if (encaixe.jeito === 'metades' && encaixe.metadesPostas !== 2) {
    conteudo = posta === null ? 'vazio, cabem duas metades' : `só ${posta.nome}, falta a outra metade`
  } else {
    conteudo = posta === null ? 'vazio' : posta.nome
  }
  const quem = posta !== null && posta.por !== '' && posta.por !== eu ? `, posto por ${posta.por}` : ''
  // No painel em relevo, o encaixe é o vão de uma placa.
  if (encaixe.placa !== undefined) return `Vão ${numero} do painel: ${posta === null ? 'falta uma placa' : posta.nome}${quem}${resolvido ? ', preso' : ''}`
  return `Encaixe ${numero}: ${conteudo}${quem}${resolvido ? ', preso' : ''}`
}

// ------------------------------------------------------------------ a troca de peso (v1)

interface PropsDaTroca {
  troca: NonNullable<VistaDoPuzzle['troca']>
  resolvido: boolean
  alvo: boolean
  agulha: number
  onTocarBandeja: PropsDoQuadroDoPuzzle['onTocarBandeja']
  onTrocar: PropsDoQuadroDoPuzzle['onTrocar']
}

/** O peso em traços, como o mostrador do v1 ("IIII"). */
function romano(n: number): string {
  return n <= 0 ? '0' : 'I'.repeat(n)
}

function TrocaDoQuadro({ troca, resolvido, alvo, agulha, onTocarBandeja, onTrocar }: PropsDaTroca) {
  const soma = troca.naBandeja.reduce((total, pedra) => total + pedra.peso, 0)
  const travada = resolvido || troca.feita
  const style = { left: `${troca.x - MEIA_LARGURA_DA_TROCA}%`, top: `${troca.y - MEIA_ALTURA_DA_TROCA}%` }
  const pedras = troca.naBandeja.length > 0 ? troca.naBandeja.map((pedra, i) => <Pedra key={i} nome={pedra.nome} peso={pedra.peso} />) : <span className="qpz-bandeja__vazia">Bandeja vazia</span>
  const rotuloDaBandeja = `Bandeja de troca: ${troca.naBandeja.length > 0 ? `${troca.naBandeja.map((pedra) => pedra.nome).join(', ')}, peso ${soma}` : 'vazia'}`
  return (
    <div className="qpz-troca" style={style}>
      <div className="qpz-troca__pedestal" data-pedestal>
        {troca.feita ? (
          <span className="qpz-troca__joia qpz-troca__joia--vazia" aria-hidden="true" />
        ) : onTrocar !== undefined ? (
          <button type="button" className="qpz-troca__joia" disabled={travada} aria-label="Pegar o que está no pedestal, trocando pelo que está na bandeja" onClick={onTrocar}>
            <JoiaGuardada />
          </button>
        ) : (
          <span className="qpz-troca__joia" aria-hidden="true">
            <JoiaGuardada />
          </span>
        )}
        <div className="qpz-mostrador" aria-hidden="true">
          <Mostrador pedido={troca.pesoPedido} agora={agulha} />
        </div>
      </div>
      {onTocarBandeja !== undefined ? (
        <button
          type="button"
          className={classes('qpz-bandeja', alvo && !travada && 'is-pode')}
          data-alvo="bandeja"
          aria-label={rotuloDaBandeja}
          aria-disabled={travada || undefined}
          onClick={(event) => onTocarBandeja(event.currentTarget)}
        >
          {pedras}
        </button>
      ) : (
        <span className="qpz-bandeja" aria-label={rotuloDaBandeja} role="img">
          {pedras}
        </span>
      )}
      <span className="qpz-troca__soma">{troca.feita ? 'Trocada: as pedras ficaram no lugar da joia' : `Bandeja: ${romano(soma)} · o pedestal pede ${romano(troca.pesoPedido)}`}</span>
      {!travada && onTrocar !== undefined && (
        <button type="button" className="qpz-troca__trocar" onClick={onTrocar}>
          Trocar a joia pela bandeja
        </button>
      )}
    </div>
  )
}

/** O ângulo da agulha: 0 à esquerda (-90°), `PESO_MAX` à direita (90°). */
function anguloDoPeso(peso: number): number {
  return (Math.min(PESO_MAX, Math.max(0, peso)) / PESO_MAX) * 180 - 90
}

/** O mostrador do v1: meia-lua de latão com uma marca por peso e a do pedido em destaque. */
function Mostrador({ pedido, agora }: { pedido: number; agora: number }) {
  const marcas = []
  for (let w = 0; w <= PESO_MAX; w++) {
    const a = (w / PESO_MAX) * Math.PI
    const ehPedido = w === pedido
    const r1 = 46
    const r2 = ehPedido ? 32 : 39
    marcas.push(
      <line
        key={w}
        x1={(60 - Math.cos(a) * r1).toFixed(1)}
        y1={(60 - Math.sin(a) * r1).toFixed(1)}
        x2={(60 - Math.cos(a) * r2).toFixed(1)}
        y2={(60 - Math.sin(a) * r2).toFixed(1)}
        stroke={ehPedido ? '#f6dfa8' : '#4a3b1f'}
        strokeWidth={ehPedido ? 5 : 2.5}
        strokeLinecap="round"
      />,
    )
  }
  return (
    <svg viewBox="0 0 120 68" focusable="false">
      <path d="M6 62A54 54 0 0 1 114 62Z" fill="#b89552" stroke="#6e5931" strokeWidth="3" />
      {marcas}
      <g className="qpz-mostrador__agulha" style={{ transform: `rotate(${anguloDoPeso(agora)}deg)` }}>
        <path d="M60 60V22" stroke="#383a3c" strokeWidth="4" strokeLinecap="round" />
      </g>
      <circle cx="60" cy="60" r="6" fill="#5d6164" stroke="#383a3c" strokeWidth="2" />
    </svg>
  )
}

/**
 * O que está no pedestal. A peça guardada não vai ao jogador antes da troca
 * (PLANO §2.3), então o pedestal mostra uma joia lapidada genérica, de latão.
 */
function JoiaGuardada() {
  return (
    <svg viewBox="0 0 48 48" focusable="false">
      <path d="M11 19 18 10h12l7 9-13 22z" fill="#c9a45c" stroke="#5e4720" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M11 19h26M18 10l6 9 6-9M24 19v22M17 19l7 22 7-22" stroke="#7d6130" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
      <path d="M20 13h6" stroke="#f1dca6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Uma pedra da bandeja: a vista traz só o nome e o peso, então ela é desenhada com o peso marcado. */
function Pedra({ nome, peso }: { nome: string; peso: number }) {
  return (
    <svg viewBox="0 0 48 48" focusable="false">
      <title>{nome}</title>
      <path d="M8 30c0-9 7-15 16-15s16 5 16 13-6 12-16 12S8 38 8 30z" fill="#8d8a80" stroke="#4b4943" strokeWidth="2.5" />
      <path d="M14 24c3-4 7-5 11-5" stroke="#b3b0a6" strokeWidth="2" fill="none" strokeLinecap="round" />
      <text x="24" y="34" textAnchor="middle" fontSize="10" fontWeight="600" fill="#2f2d29">
        {romano(peso)}
      </text>
    </svg>
  )
}
