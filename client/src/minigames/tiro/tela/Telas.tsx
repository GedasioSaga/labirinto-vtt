import { useEffect, useId, useRef, type CSSProperties, type ReactNode, type Ref } from 'react'
import type { TiroDoJogador } from '../../../player/estadoDoTiro'
import { desenharMedalha, desenharProibidos, desenharRetrato } from '../arte'
import { BALAS, DIF, MEDALHAS, passou, pontosDaMedalha, type DificuldadeSim } from '../sim'
import { DIFICULDADES_TIRO, type MedalhaTiro } from '../tipos'
import type { HudDoTiro, ResultadoDaRodada } from './motor'
import { comArtigo, DESCRICAO_DIF, NOME_DIF, NOMES_MED, pctTxt, textoDaMeta } from './textos'

/**
 * AS TELAS DA COLUNA da barraca de tiro (convite, rodada, resultado) e a
 * pausa, como no protótipo aprovado (docs/design/minigame-tiro/prototipo).
 * Só mostram e chamam: quem decide é o `TiroOverlay`, e quem joga é o
 * `MotorDoTiro`. Todo texto do mestre entra como texto (o React escapa).
 */

// ------------------------------------------------------------------ canvas

/** O contexto 2D da tela, ou `null` (o jsdom do teste não desenha). */
function contexto(cv: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  const g = cv?.getContext('2d') ?? null
  if (g !== null) g.imageSmoothingEnabled = false
  return g
}

function Retrato() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const g = contexto(ref.current)
    if (g !== null) desenharRetrato(g)
  }, [])
  return <canvas ref={ref} width={16} height={16} aria-hidden="true" />
}

function Proibidos() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const g = contexto(ref.current)
    if (g !== null) desenharProibidos(g)
  }, [])
  return <canvas ref={ref} width={28} height={14} aria-hidden="true" />
}

function Medalha({ medalha }: { medalha: MedalhaTiro | null }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const g = contexto(ref.current)
    if (g !== null) desenharMedalha(g, medalha)
  }, [medalha])
  return <canvas ref={ref} width={32} height={40} aria-hidden="true" />
}

function usarFocoAoMontar<T extends HTMLElement>(): Ref<T> {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}

// ------------------------------------------------------------------ escada das medalhas

const COR_DA_MEDALHA: Readonly<Record<MedalhaTiro, string>> = { bronze: 'var(--tz-bronze)', prata: 'var(--tz-prata)', ouro: 'var(--tz-ouro)' }
/** A cor da medalha vai para o CSS em `--c` (o risco no trilho e a bolinha da marca). */
type EstiloDaMarca = CSSProperties & { '--c': string }
/** O trilho vai um pouco além do ouro, para o ouro não colar na ponta. */
const FOLGA_DO_TRILHO = 1.18

function marca(cor: string, left?: string): EstiloDaMarca {
  return left === undefined ? { '--c': cor } : { '--c': cor, left }
}

/** A régua de bronze, prata e ouro da dificuldade, com os pontos de agora e a meta marcada. */
function Escada({ dif, meta, pontos }: { dif: DificuldadeSim; meta: MedalhaTiro; pontos: number }) {
  const m = DIF[dif].medalhas
  const topo = (m[2] ?? 1) * FOLGA_DO_TRILHO
  const k = Math.min(1, Math.max(0, pontos / topo))
  return (
    <div className="tz-escada">
      <span className="tz-escada__trilho" aria-hidden="true">
        <i style={{ transform: `scaleX(${k.toFixed(3)})` }} />
        {MEDALHAS.map((med) => (
          <b key={med} style={marca(COR_DA_MEDALHA[med], `${((pontosDaMedalha(dif, med) / topo) * 100).toFixed(1)}%`)} />
        ))}
      </span>
      <span className="tz-escada__marcas" aria-hidden="true">
        {MEDALHAS.map((med) => (
          <span key={med} style={marca(COR_DA_MEDALHA[med])} data-meta={med === meta ? '1' : undefined}>
            {NOMES_MED[med]} {pontosDaMedalha(dif, med)}
            {med === meta ? ' (meta)' : ''}
          </span>
        ))}
      </span>
      <span className="tz-sr">
        Bronze {m[0]}, prata {m[1]}, ouro {m[2]} pontos. Meta: {NOMES_MED[meta]}.
      </span>
    </div>
  )
}

// ------------------------------------------------------------------ convite

export interface ConviteProps {
  convite: TiroDoJogador['convite']
  dif: DificuldadeSim
  aoMudarDif(dif: DificuldadeSim): void
  /** Por que não dá para começar agora (pausa, encerrada, sem tentativas); `null` = pode. */
  bloqueio: string | null
  /** O Pronto saiu e o início do mestre ainda não chegou. */
  esperando: boolean
  erro: string | null
  /** "Sua melhor: …" desta visita, ou `null` se esta tela não viu rodada nenhuma. */
  melhor: { medalha: MedalhaTiro | null; pontos: number } | null
  usadas: number
  som: boolean
  realejo: boolean
  aoAlternarSom(): void
  aoAlternarRealejo(): void
  aoComecar(): void
  aoSair(): void
}

function textoDaMelhor(melhor: ConviteProps['melhor'], usadas: number): string {
  if (melhor !== null) return `Sua melhor: ${melhor.medalha === null ? 'sem medalha' : NOMES_MED[melhor.medalha]}, ${melhor.pontos} pontos.`
  return usadas === 0 ? 'Nenhuma rodada ainda.' : ''
}

export function Convite(p: ConviteProps) {
  const { convite, dif } = p
  const baseId = useId()
  const comecarRef = usarFocoAoMontar<HTMLButtonElement>()
  const barraca = convite.barraca || 'Barraca sem nome'
  const so = convite.permitida === 'escolha' ? null : convite.permitida
  const restam = Math.max(0, convite.tentativas - p.usadas)
  const aviso = p.bloqueio ?? p.erro
  return (
    <section className="tz-tela" aria-labelledby={`${baseId}-npc`}>
      <div className="tz-npc">
        <Retrato />
        <div>
          <h1 id={`${baseId}-npc`}>{convite.npc || 'Alguém da feira'}</h1>
          <p>desafia você na {barraca}</p>
        </div>
      </div>
      <p className="tz-fala">{convite.fala || '…'}</p>
      <fieldset>
        <legend className="tz-rotulo tz-legenda">Dificuldade</legend>
        <div className="tz-cartoes">
          {DIFICULDADES_TIRO.map((d) => (
            <label key={d} className="tz-cartao">
              <input type="radio" name={`${baseId}-dif`} value={d} checked={dif === d} disabled={so !== null && so !== d} onChange={() => p.aoMudarDif(d)} />
              <b>{NOME_DIF[d]}</b>
              <span>{DESCRICAO_DIF[d]}</span>
            </label>
          ))}
        </div>
        {so !== null && <p className="tz-nota tz-nota--dif">{so === 'normal' ? 'O mestre liberou só o Normal.' : 'O mestre liberou só o Extremo.'}</p>}
      </fieldset>
      <dl className="tz-premios">
        <div>
          <dt className="tz-rotulo">Meta</dt>
          <dd>{textoDaMeta(convite.meta, dif)}</dd>
        </div>
        <div>
          <dt className="tz-rotulo">Se passar</dt>
          <dd>{convite.premio.texto || 'Nada combinado.'}</dd>
        </div>
        <div>
          <dt className="tz-rotulo">Se não passar</dt>
          <dd>{convite.consequencia.texto || 'Nada combinado.'}</dd>
        </div>
      </dl>
      <p className="tz-nota">
        Tentativas: {restam} de {convite.tentativas}. {textoDaMelhor(p.melhor, p.usadas)}
      </p>
      {aviso !== null && (
        <p className="tz-aviso" role="alert">
          {aviso}
        </p>
      )}
      <button ref={comecarRef} type="button" className="tz-btn tz-btn--primario tz-btn--bloco" disabled={p.bloqueio !== null || p.esperando} onClick={p.aoComecar}>
        {p.esperando ? 'Esperando o mestre…' : 'Começar a rodada'}
      </button>
      <div className="tz-linha">
        <button type="button" className="tz-btn tz-btn--sm" aria-pressed={p.som} onClick={p.aoAlternarSom}>
          {p.som ? 'Som ligado' : 'Som desligado'}
        </button>
        <button type="button" className="tz-btn tz-btn--sm" aria-pressed={p.realejo} onClick={p.aoAlternarRealejo}>
          {p.realejo ? 'Realejo ligado' : 'Realejo desligado'}
        </button>
        <button type="button" className="tz-btn tz-btn--sm tz-linha__sair" onClick={p.aoSair}>
          Sair da barraca
        </button>
      </div>
      <p className="tz-teclas">
        Mire com o mouse e clique. Recarregar: <kbd>R</kbd> ou botão direito. Controle: analógico mira, <kbd>RT</kbd>/<kbd>A</kbd> atira, <kbd>X</kbd> recarrega. Pausa: <kbd>Esc</kbd> ou <kbd>Start</kbd>.
      </p>
    </section>
  )
}

// ------------------------------------------------------------------ a rodada

/** O que a tela pinta a cada quadro sem passar pelo React: a barra do tempo e o arco da recarga. */
export interface PinturaDoQuadro {
  barra: Ref<HTMLElement>
  carga: Ref<SVGCircleElement>
}

/** Circunferência do arco da recarga (r = 35), como no protótipo. */
export const ARCO_DA_CARGA = 219.9
const RAIO_DO_TAMBOR = 22

const CAMARAS = Array.from({ length: BALAS }, (_, i) => {
  const a = ((i * (360 / BALAS) - 90) * Math.PI) / 180
  return { cx: (Math.cos(a) * RAIO_DO_TAMBOR).toFixed(2), cy: (Math.sin(a) * RAIO_DO_TAMBOR).toFixed(2) }
})

function Tambor({ hud, carga }: { hud: HudDoTiro; carga: Ref<SVGCircleElement> }) {
  return (
    <svg className="tz-tambor" viewBox="-38 -38 76 76" aria-hidden="true" data-nega={hud.nega ? '1' : '0'}>
      <circle className="tz-tambor__aro" r="31" />
      <circle ref={carga} className="tz-tambor__carga" r="35" strokeDasharray={ARCO_DA_CARGA} strokeDashoffset={ARCO_DA_CARGA} />
      <g className="tz-tambor__giro" style={{ transform: `rotate(${-(360 / BALAS) * hud.giro}deg)` }}>
        {CAMARAS.map((c, i) => (
          <circle key={i} className="tz-tambor__camara" r="4.6" cx={c.cx} cy={c.cy} data-cheia={i < hud.balas ? '1' : '0'} />
        ))}
      </g>
      <circle className="tz-tambor__eixo" r="5" />
    </svg>
  )
}

export interface JogoProps {
  hud: HudDoTiro
  dif: DificuldadeSim
  meta: MedalhaTiro
  pintura: PinturaDoQuadro
  podePausar: boolean
  aoPausar(): void
  aoRecarregar(): void
}

export function Jogo({ hud, dif, meta, pintura, podePausar, aoPausar, aoRecarregar }: JogoProps) {
  return (
    <section className="tz-tela tz-tela--jogo" aria-label="Rodada">
      <div className="tz-hud">
        <p className="tz-relogio" data-pouco={hud.pouco ? '1' : '0'}>
          <span className="tz-rotulo">Tempo</span>
          <b>{hud.tempo}</b>
        </p>
        <button type="button" className="tz-btn tz-btn--sm" disabled={!podePausar} onClick={aoPausar}>
          Pausar <kbd>Esc</kbd>
        </button>
        <span className="tz-barra" aria-hidden="true">
          <i ref={pintura.barra} />
        </span>
      </div>
      <dl className="tz-marcas">
        <div>
          <dt className="tz-rotulo">Pontos</dt>
          <dd>{hud.pontos}</dd>
        </div>
        <div>
          <dt className="tz-rotulo">Combo</dt>
          <dd>
            {hud.combo} <small>{hud.mult}</small>
          </dd>
        </div>
        <div>
          <dt className="tz-rotulo">Precisão</dt>
          <dd>{hud.prec}</dd>
        </div>
      </dl>
      <div className="tz-arma">
        <Tambor hud={hud} carga={pintura.carga} />
        <div className="tz-arma__lado">
          <button type="button" className="tz-btn tz-btn--bloco" disabled={!hud.podeRecarregar} onClick={aoRecarregar}>
            {hud.recarregando ? (
              'Recarregando…'
            ) : (
              <>
                Recarregar <kbd>R</kbd>
              </>
            )}
          </button>
          <p className="tz-balas">{hud.balasTxt}</p>
        </div>
      </div>
      <Escada dif={dif} meta={meta} pontos={hud.pontos} />
      {dif === 'extremo' && (
        <p className="tz-proibidos">
          <Proibidos />
          <span>Não atire no aldeão nem no gato de lata: cada um tira 50 pontos e zera o combo.</span>
        </p>
      )}
      <p className="tz-dica" data-tom={hud.dicaRuim ? 'ruim' : undefined} aria-live="polite">
        {hud.dica}
      </p>
      <p className="tz-teclas">
        Mire e clique. <kbd>R</kbd> ou botão direito recarrega. Setas e <kbd>Espaço</kbd> também miram e atiram.
      </p>
    </section>
  )
}

// ------------------------------------------------------------------ resultado

export interface ResultadoProps {
  r: ResultadoDaRodada
  convite: TiroDoJogador['convite']
  /** Por que não dá para jogar de novo; `null` = pode. */
  bloqueio: string | null
  esperando: boolean
  restam: number
  aoDeNovo(): void
  aoVoltar(): void
}

export function Resultado({ r, convite, bloqueio, esperando, restam, aoDeNovo, aoVoltar }: ResultadoProps) {
  const baseId = useId()
  const tituloRef = usarFocoAoMontar<HTMLHeadingElement>()
  const { meta } = convite
  const alvo = pontosDaMedalha(r.dif, meta)
  const passouNaMeta = passou(r.medalha, meta)
  let titulo: string
  let sub: string
  let desfecho: string
  let tom: 'bom' | 'ruim' | undefined
  if (r.tipo === 'encerrado') {
    titulo = 'Barraca encerrada'
    sub = 'O mestre encerrou a rodada de todos antes do sino.'
    desfecho = 'Sem prêmio nem consequência: a rodada não valeu.'
    tom = undefined
  } else {
    titulo = r.medalha === null ? 'Sem medalha' : NOMES_MED[r.medalha]
    sub = passouNaMeta ? `Passou na meta (${NOMES_MED[meta].toLowerCase()}, ${alvo} pontos).` : `Faltaram ${alvo - r.pontos} pontos para ${comArtigo(meta)}, a meta.`
    desfecho = passouNaMeta ? `Prêmio: ${convite.premio.texto || 'nada combinado.'}` : `Consequência: ${convite.consequencia.texto || 'nada combinado.'}`
    tom = passouNaMeta ? 'bom' : 'ruim'
  }
  const nums: [string, ReactNode][] = [
    ['Pontos', r.pontos],
    ['Precisão', `${pctTxt(r.acertos, r.tiros)} (${r.acertos} de ${r.tiros})`],
    ['Combo máximo', r.comboMax],
    ['Alvos derrubados', r.derrubados],
    ['Recargas', r.recargas],
    r.dif === 'extremo' ? ['Proibidos acertados', r.proibidos] : ['Cliques sem bala', r.secos],
  ]
  const tentativas = bloqueio ?? `${restam === 1 ? 'Resta 1 tentativa' : `Restam ${restam} tentativas`}; vale a melhor. A próxima é no ${NOME_DIF[r.dif]}, a não ser que você troque no convite.`
  return (
    <section className="tz-tela tz-tela--resultado" aria-labelledby={`${baseId}-titulo`}>
      <div className="tz-res__topo">
        <Medalha medalha={r.medalha} />
        <div>
          <h2 ref={tituloRef} id={`${baseId}-titulo`} tabIndex={-1}>
            {titulo}
          </h2>
          <p className="tz-res__sub">{sub}</p>
        </div>
      </div>
      <Escada dif={r.dif} meta={meta} pontos={r.pontos} />
      <dl className="tz-numeros">
        {nums.map(([k, v]) => (
          <div key={k}>
            <dt className="tz-rotulo">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="tz-desfecho" data-tom={tom}>
        {desfecho}
      </p>
      <p className="tz-nota">{tentativas}</p>
      <div className="tz-botoes">
        <button type="button" className="tz-btn tz-btn--primario" disabled={bloqueio !== null || esperando} onClick={aoDeNovo}>
          {esperando ? 'Esperando o mestre…' : 'Jogar de novo'}
        </button>
        <button type="button" className="tz-btn" onClick={aoVoltar}>
          Voltar ao convite
        </button>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ pausa

export function Pausa({ doMestre, aoContinuar, aoDesistir }: { doMestre: boolean; aoContinuar(): void; aoDesistir(): void }) {
  const baseId = useId()
  const continuarRef = useRef<HTMLButtonElement>(null)
  const desistirRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    // Pausa do mestre: o Continuar não vale, o foco vai para o Desistir.
    ;(doMestre ? desistirRef : continuarRef).current?.focus({ preventScroll: true })
  }, [doMestre])
  return (
    <div className="tz-pausa" role="dialog" aria-modal="true" aria-labelledby={`${baseId}-titulo`}>
      <div className="tz-pausa__caixa">
        <h2 id={`${baseId}-titulo`}>{doMestre ? 'O mestre pausou' : 'Pausado'}</h2>
        <p className="tz-nota">{doMestre ? 'A rodada de todos está parada. Continua quando o mestre soltar.' : 'Os alvos ficam parados onde estão.'}</p>
        <button ref={continuarRef} type="button" className="tz-btn tz-btn--primario" disabled={doMestre} onClick={aoContinuar}>
          Continuar
        </button>
        <button ref={desistirRef} type="button" className="tz-btn" onClick={aoDesistir}>
          Desistir desta rodada
        </button>
      </div>
    </div>
  )
}
