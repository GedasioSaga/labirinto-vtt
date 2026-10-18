import { useEffect, useId, useLayoutEffect, useRef, type PointerEvent as PointerDoReact, type ReactNode, type RefObject } from 'react'
import type { PescaDoJogador } from '../../../player/estadoDaPesca'
import { desenharNpc, desenharPlaca, IH, IW, spriteDoPeixe, type ResultadoNaCena } from '../arte'
import { DIF, type Peixe } from '../sim'
import type { DificuldadePesca } from '../tipos'
import { FASES_NA_AGUA, type InstantaneoDaPesca, type MotorDaPesca, type ResultadoDoLance } from './motor'
import { FAIXA, fmtDec, RARIDADE, textoDoEncerramento, textoDosLances, TITULO_DO_LANCE } from './textos'

/**
 * AS TELAS DA COLUNA da pesca (convite, lance, resultado, cesto, encerrada) e
 * os pedaços de canvas que elas desenham. Só mostram e chamam: quem decide é
 * o `PescaOverlay`, e quem joga é o `MotorDaPesca`.
 */

// ------------------------------------------------------------------ canvas

/** Escala inteira a partir de 2x (pixel nítido); abaixo disso, a que couber (protótipo `encaixar`). */
export function usarEncaixe(caixa: RefObject<HTMLElement | null>, tela: RefObject<HTMLCanvasElement | null>, w: number, h: number, folga = 0): void {
  useLayoutEffect(() => {
    const c = caixa.current
    const cv = tela.current
    if (c === null || cv === null) return
    const medir = (): void => {
      const cw = c.clientWidth - folga
      const ch = c.clientHeight - folga
      if (cw <= 0 || ch <= 0) return
      let s = Math.min(cw / w, ch / h)
      s = s >= 2 ? Math.floor(s) : Math.max(0.5, s)
      cv.style.width = `${Math.round(w * s)}px`
      cv.style.height = `${Math.round(h * s)}px`
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(medir)
    ro.observe(c)
    return () => ro.disconnect()
  }, [caixa, tela, w, h, folga])
}

/** O contexto 2D da tela, ou `null` (o jsdom do teste não desenha). */
function contexto(cv: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  const g = cv?.getContext('2d') ?? null
  if (g !== null) g.imageSmoothingEnabled = false
  return g
}

function RetratoDoNpc() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const g = contexto(ref.current)
    if (g !== null) desenharNpc(g)
  }, [])
  return <canvas ref={ref} className="pz-npc__retrato" width={14} height={15} aria-hidden="true" />
}

function Placa({ resultado }: { resultado: ResultadoNaCena | null }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const g = contexto(ref.current)
    if (g !== null) desenharPlaca(g, resultado)
  }, [resultado])
  return (
    <div className="pz-placa">
      <canvas ref={ref} width={64} height={34} aria-hidden="true" />
    </div>
  )
}

/** O peixe miúdo do cesto, no tamanho do sprite. */
function PeixeMiudo({ peixe }: { peixe: Peixe }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (contexto(cv) === null || cv === null) return
    const sp = spriteDoPeixe(peixe)
    cv.width = sp.w
    cv.height = sp.h
    cv.style.width = `${sp.w}px`
    cv.style.height = `${sp.h}px`
    contexto(cv)?.drawImage(sp.c, 0, 0)
  }, [peixe])
  return <canvas ref={ref} width={1} height={1} aria-hidden="true" />
}

function Estrelas({ n }: { n: number }) {
  return (
    <span className="pz-estrelas" role="img" aria-label={`Qualidade ${n} de 4`}>
      {Array.from({ length: 4 }, (_, i) => (i < n ? <span key={i}>★</span> : <i key={i}>★</i>))}
    </span>
  )
}

function usarFocoAoMontar<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}

// ------------------------------------------------------------------ convite

const CARTOES: readonly { dif: DificuldadePesca; texto: string }[] = [
  { dif: 'normal', texto: 'Barra larga, peixe calmo, tempo para fisgar. Seis peixes do poço.' },
  { dif: 'extremo', texto: 'Barra curta, peixe arisco, fisgada rápida. Três raros e um lendário só aqui.' },
]

export interface ConviteProps {
  convite: PescaDoJogador['convite']
  dif: DificuldadePesca
  aoMudarDif(dif: DificuldadePesca): void
  pausadaPeloMestre: boolean
  erro: string | null
  somAtivo: boolean
  aoAlternarSom(): void
  aoPescar(): void
}

export function Convite({ convite, dif, aoMudarDif, pausadaPeloMestre, erro, somAtivo, aoAlternarSom, aoPescar }: ConviteProps) {
  const baseId = useId()
  const pescarRef = usarFocoAoMontar<HTMLButtonElement>()
  const lago = convite.lago || 'Lago sem nome'
  const so = convite.permitida === 'escolha' ? null : convite.permitida
  const aviso = pausadaPeloMestre ? 'O mestre pausou a pesca. Espere ele continuar.' : erro
  return (
    <div className="pz-tela" aria-labelledby={`${baseId}-npc`}>
      <div className="pz-npc">
        <RetratoDoNpc />
        <div>
          <h1 id={`${baseId}-npc`}>{convite.npc || 'Alguém sem nome'}</h1>
          <p>desafia você no {lago}</p>
        </div>
      </div>
      <p className="pz-fala">{convite.fala || '…'}</p>
      <fieldset>
        <legend className="pz-rotulo pz-legenda">Dificuldade</legend>
        <div className="pz-cartoes">
          {CARTOES.map((c) => (
            <label key={c.dif} className="pz-cartao">
              <input type="radio" name={`${baseId}-dif`} value={c.dif} checked={dif === c.dif} disabled={so !== null && so !== c.dif} onChange={() => aoMudarDif(c.dif)} />
              <b>{DIF[c.dif].nome}</b>
              <span>{c.texto}</span>
            </label>
          ))}
        </div>
        {so !== null && <p className="pz-nota pz-nota--dif">{so === 'normal' ? 'O mestre liberou só o Normal neste pino.' : 'O mestre liberou só o Extremo neste pino.'}</p>}
      </fieldset>
      <dl className="pz-premios">
        <div>
          <dt className="pz-rotulo">Se pegar algum peixe</dt>
          <dd>{convite.premio.texto || 'Nada combinado.'}</dd>
        </div>
        <div>
          <dt className="pz-rotulo">Se o cesto voltar vazio</dt>
          <dd>{convite.consequencia.texto || 'Nada combinado.'}</dd>
        </div>
      </dl>
      <p className="pz-nota">{textoDosLances(convite.lances)} para encher o cesto.</p>
      {aviso !== null && (
        <p className="pz-aviso" role="alert">
          {aviso}
        </p>
      )}
      <button ref={pescarRef} type="button" className="pz-btn pz-btn--primario pz-btn--bloco" disabled={pausadaPeloMestre} onClick={aoPescar}>
        Ir pescar
      </button>
      <div className="pz-linha">
        <button type="button" className="pz-btn pz-btn--sm" aria-pressed={somAtivo} onClick={aoAlternarSom}>
          {somAtivo ? 'Som ligado' : 'Som desligado'}
        </button>
      </div>
      <p className="pz-teclas">
        Segurar: <kbd>Espaço</kbd>
        <kbd>↑</kbd>
        <kbd>W</kbd>, clique, toque ou <kbd>A</kbd>/<kbd>RT</kbd> no controle. Pausa: <kbd>Esc</kbd> ou <kbd>Start</kbd>.
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ o lance

export interface SegurarProps {
  onPointerDown(e: PointerDoReact<HTMLElement>): void
  onPointerUp(e: PointerDoReact<HTMLElement>): void
  onPointerCancel(e: PointerDoReact<HTMLElement>): void
  onLostPointerCapture(e: PointerDoReact<HTMLElement>): void
  onContextMenu(e: { preventDefault(): void }): void
}

export interface JogoProps {
  motor: MotorDaPesca
  inst: InstantaneoDaPesca
  segurar: SegurarProps
  aoPausar(): void
}

export function Jogo({ motor, inst, segurar, aoPausar }: JogoProps) {
  const campoRef = useRef<HTMLButtonElement>(null)
  const instrRef = useRef<HTMLCanvasElement>(null)
  usarEncaixe(campoRef, instrRef, IW, IH, 8)
  useEffect(() => {
    motor.telas.instr = contexto(instrRef.current)
    campoRef.current?.focus({ preventScroll: true })
    return () => {
      motor.telas.instr = null
    }
  }, [motor])
  const { hud } = inst
  return (
    <section className="pz-tela pz-tela--jogo" aria-label="Pescando">
      <div className="pz-hud">
        <p className="pz-rotulo pz-hud__lance">
          Lance {inst.lance} de {inst.lances}
        </p>
        <button type="button" className="pz-btn pz-btn--sm pz-hud__pausa" disabled={!FASES_NA_AGUA.has(inst.fase) || inst.pausaDoMestre} onClick={aoPausar}>
          Pausar <kbd>Esc</kbd>
        </button>
        <p className="pz-hud__fase" data-tom={hud.tom}>
          {hud.titulo}
        </p>
        <p className="pz-hud__dica">{hud.dica}</p>
      </div>
      <button ref={campoRef} type="button" className="pz-campo" data-seg={inst.segurando ? '1' : '0'} aria-label="Segurar: mede a força do lance, fisga e sobe a barra verde" {...segurar}>
        <canvas ref={instrRef} width={IW} height={IH} aria-hidden="true" />
      </button>
      <p className="pz-teclas">
        Segure <kbd>Espaço</kbd>
        <kbd>↑</kbd>
        <kbd>W</kbd>, o mouse, o dedo na tela ou <kbd>A</kbd>/<kbd>RT</kbd>.
      </p>
    </section>
  )
}

// ------------------------------------------------------------------ resultado do lance

function subtitulo(r: ResultadoDoLance): string {
  if (r.tipo === 'pegou') return r.peixe.nome
  if (r.tipo === 'escapou') return `O medidor zerou. Era um(a) ${r.peixe.nome}.`
  return 'Algo mordeu e foi embora: a fisgada passou da janela.'
}

function textoDoBau(r: ResultadoDoLance): string | null {
  if (r.bau === 'pego' && r.itens !== null) return `Baú: ${r.itens.join(' e ')}.`
  if (r.bau === 'perdido') return 'Baú: você segurou o baú, mas ele foi junto com o peixe.'
  if (r.bau === 'sumiu') return 'Baú: apareceu e sumiu antes de encher.'
  return null
}

const naCena = (r: ResultadoDoLance): ResultadoNaCena => (r.tipo === 'pegou' ? { tipo: 'pegou', peixe: r.peixe } : { tipo: r.tipo, peixe: r.peixe })

export interface ResultadoDoLanceProps {
  r: ResultadoDoLance
  lances: number
  pausadaPeloMestre: boolean
  aoSeguir(): void
}

export function ResultadoDoLanceTela({ r, lances, pausadaPeloMestre, aoSeguir }: ResultadoDoLanceProps) {
  const baseId = useId()
  const seguirRef = usarFocoAoMontar<HTMLButtonElement>()
  const ultimo = r.lance >= lances
  const nums: [string, ReactNode][] = []
  if (r.tipo === 'pegou') nums.push(['Tamanho', `${r.cm} cm`], ['Qualidade', <Estrelas key="q" n={r.estrelas} />])
  nums.push(['Lance', `${FAIXA[r.faixa]}, ${Math.round(r.dist * 100)}%`])
  if (r.tipo !== 'fugiu') nums.push(['Puxada', `${fmtDec(r.tempo)} s`], ['Reação', `${fmtDec(r.reacao, 2)} s`])
  const bau = textoDoBau(r)
  const travado = pausadaPeloMestre && !ultimo
  return (
    <section className="pz-tela pz-tela--resultado" aria-labelledby={`${baseId}-titulo`}>
      <div>
        <p className="pz-rotulo">
          Lance {r.lance} de {lances}
        </p>
        <h2 id={`${baseId}-titulo`} data-tom={r.tipo === 'pegou' ? 'bom' : 'ruim'}>
          {TITULO_DO_LANCE[r.tipo]}
        </h2>
        <p className="pz-res__sub">{subtitulo(r)}</p>
      </div>
      <Placa resultado={naCena(r)} />
      {r.tipo === 'pegou' && (
        <div className="pz-etiquetas">
          <span className="pz-etq" data-r={r.peixe.rar}>
            {RARIDADE[r.peixe.rar]}
          </span>
          {r.perfeito && (
            <span className="pz-etq" data-r="perfeito">
              Captura perfeita: +1 estrela
            </span>
          )}
          <span className="pz-etq" data-r="comum">
            {DIF[r.dif].nome}
          </span>
        </div>
      )}
      <dl className="pz-numeros">
        {nums.map(([k, v]) => (
          <div key={k}>
            <dt className="pz-rotulo">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {bau !== null && <p className="pz-nota">{bau}</p>}
      {travado && <p className="pz-aviso">O mestre pausou a pesca. Espere ele continuar.</p>}
      <button ref={seguirRef} type="button" className="pz-btn pz-btn--primario pz-btn--bloco" disabled={travado} onClick={aoSeguir}>
        {ultimo ? 'Ver o cesto' : 'Próximo lance'}
      </button>
    </section>
  )
}

// ------------------------------------------------------------------ cesto

function maiorDe(resultados: readonly ResultadoDoLance[]): ResultadoDoLance | null {
  return resultados.reduce<ResultadoDoLance | null>((maior, r) => (r.tipo === 'pegou' && (maior === null || r.cm > maior.cm) ? r : maior), null)
}

function ListaDoCesto({ pegos }: { pegos: readonly ResultadoDoLance[] }) {
  return (
    <ul className="pz-cesto" aria-label="Seu cesto">
      {pegos.map((r) => (
        <li key={r.lance}>
          <PeixeMiudo peixe={r.peixe} />
          <span>
            {r.peixe.nome}, {r.cm} cm
          </span>
          <Estrelas n={r.estrelas} />
        </li>
      ))}
    </ul>
  )
}

export interface CestoProps {
  convite: PescaDoJogador['convite']
  resultados: readonly ResultadoDoLance[]
  aoFechar(): void
}

export function Cesto({ convite, resultados, aoFechar }: CestoProps) {
  const baseId = useId()
  const fecharRef = usarFocoAoMontar<HTMLButtonElement>()
  const pegos = resultados.filter((r) => r.tipo === 'pegou')
  const maior = maiorDe(pegos)
  const perdidos = resultados.length - pegos.length
  const titulo = pegos.length === 0 ? 'Cesto vazio' : pegos.length === 1 ? '1 peixe no cesto' : `${pegos.length} peixes no cesto`
  return (
    <section className="pz-tela pz-tela--resultado" aria-labelledby={`${baseId}-titulo`}>
      <div>
        <p className="pz-rotulo">Fim da pesca no {convite.lago || 'lago'}</p>
        <h2 id={`${baseId}-titulo`} data-tom={pegos.length > 0 ? 'bom' : 'ruim'}>
          {titulo}
        </h2>
        <p className="pz-res__sub">
          {textoDosLances(resultados.length)}: {pegos.length} {pegos.length === 1 ? 'pego' : 'pegos'}, {perdidos} {perdidos === 1 ? 'perdido' : 'perdidos'}.
        </p>
      </div>
      <Placa resultado={maior === null ? null : { tipo: 'pegou', peixe: maior.peixe }} />
      {maior !== null && (
        <p className="pz-maior">
          Maior peixe: <b>{maior.peixe.nome}</b>, {maior.cm} cm
        </p>
      )}
      {pegos.length > 0 && <ListaDoCesto pegos={pegos} />}
      <p className="pz-desfecho" data-tom={pegos.length > 0 ? 'bom' : 'ruim'}>
        {pegos.length > 0 ? `Prêmio: ${convite.premio.texto || 'nada combinado.'}` : `Consequência: ${convite.consequencia.texto || 'nada combinado.'}`}
      </p>
      <button ref={fecharRef} type="button" className="pz-btn pz-btn--primario pz-btn--bloco" onClick={aoFechar}>
        Fechar
      </button>
    </section>
  )
}

// ------------------------------------------------------------------ encerrada

export function Encerrada({ motivo, resultados, aoFechar }: { motivo: NonNullable<PescaDoJogador['encerrada']>; resultados: readonly ResultadoDoLance[]; aoFechar(): void }) {
  const baseId = useId()
  const fecharRef = usarFocoAoMontar<HTMLButtonElement>()
  const { titulo, texto } = textoDoEncerramento(motivo)
  const pegos = resultados.filter((r) => r.tipo === 'pegou')
  return (
    <section className="pz-tela pz-tela--resultado" aria-labelledby={`${baseId}-titulo`}>
      <div>
        <h2 id={`${baseId}-titulo`} data-tom="ruim">
          {titulo}
        </h2>
        <p className="pz-res__sub">{texto}</p>
      </div>
      {pegos.length > 0 && <ListaDoCesto pegos={pegos} />}
      <button ref={fecharRef} type="button" className="pz-btn pz-btn--primario pz-btn--bloco" onClick={aoFechar}>
        Fechar
      </button>
    </section>
  )
}

// ------------------------------------------------------------------ pausa

export function Pausa({ doMestre, aoContinuar, aoSair }: { doMestre: boolean; aoContinuar(): void; aoSair(): void }) {
  const baseId = useId()
  const continuarRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!doMestre) continuarRef.current?.focus({ preventScroll: true })
  }, [doMestre])
  return (
    <div className="pz-pausa" role="dialog" aria-modal="true" aria-labelledby={`${baseId}-titulo`}>
      <div className="pz-pausa__caixa">
        <h2 id={`${baseId}-titulo`}>{doMestre ? 'O mestre pausou a pesca' : 'Pausado'}</h2>
        <p className="pz-nota">{doMestre ? 'Tudo parado para todos, a linha também. Volta quando o mestre continuar.' : 'A linha fica parada onde está.'}</p>
        {!doMestre && (
          <>
            <button ref={continuarRef} type="button" className="pz-btn pz-btn--primario" onClick={aoContinuar}>
              Continuar
            </button>
            <button type="button" className="pz-btn" onClick={aoSair}>
              Sair da pesca
            </button>
          </>
        )}
      </div>
    </div>
  )
}
