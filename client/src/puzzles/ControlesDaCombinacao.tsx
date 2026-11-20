/**
 * OS CONTROLES DA COMBINAÇÃO no quadro de perto (protótipo aprovado
 * `prototipo-v2.html`: `htmlControle`, `htmlRelogio`, o arrasto do ponteiro e
 * a roda do mouse): as rodas de números e de símbolos com "Tentar abrir", o
 * relógio de ponteiros arrastáveis com "Tentar", e os botões com as luzes da
 * sequência.
 *
 * Só desenha e pede: o valor que vale é o da vista (o host), e cada gesto sai
 * por `acoes`. Sem `acoes` (o editor), tudo é só para ver.
 *
 * O ponteiro arrastado é o único estado da tela que corre na frente da vista:
 * ele anda sob o dedo sem pedir nada a ninguém (só este relógio redesenha) e a
 * hora vai ao host ao soltar. Rodas e botões pedem a cada toque; os pedidos
 * não esperam a vista de antes (`acaoDeControle`), então cliques seguidos somam.
 *
 * O teclado: a tela do jogador segura todas as teclas na janela (o mapa atrás
 * não pode ouvir), então quem a usa passa `teclado`, e a tela entrega aqui as
 * setas que caem numa roda ou num ponteiro.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as EventoDePonteiro, type RefObject, type SVGProps } from 'react'
import { classes, movimentoReduzido } from '../lib/primitivosDaTela'
import { ALGARISMOS, minutosNoMostrador, modulo, NOME_DO_SIMBOLO, textoDaHora } from './combinacao'
import { SIMBOLOS_DA_RODA } from './tipos'
import type { CombinacaoNaVista, SimboloDaRoda } from './tipos'

export interface AcoesDaCombinacao {
  onGirar: (roda: number, passo: 1 | -1) => void
  onPonteiro: (minutos: number) => void
  onApertar: (botao: number) => void
  onTentar: () => void
}

/** A tecla que a tela recebeu primeiro, entregue ao controle. `true` = era dele (a tela não faz mais nada). */
export type TecladoDoControle = (evento: KeyboardEvent) => boolean

/** O rolar do mouse precisa juntar isto antes de virar um passo da roda (v2). */
const ROLAR_POR_PASSO = 40
/** O número que entra na janela da roda (v2: 150 ms, de 45% da altura). */
const GIRO_MS = 150
const GIRO_DESLOCAMENTO = '45%'
/** O botão afunda e volta (v2: `is-apertado` por 120 ms). */
const APERTO_MS = 120
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
/** Os ponteiros pelo teclado: a hora anda 1 h ou 5 min (v2). */
const UMA_HORA = 60
const CINCO_MINUTOS = 5

/** O lugar do controle sobre a arte. Pelo `translate` e o `scale` próprios, para o "não" (o `transform` do tremer) somar sem tirá-lo do lugar. */
export function estiloDoControle(lugar: { x: number; y: number; s: number }): CSSProperties {
  return { left: `${lugar.x}%`, top: `${lugar.y}%`, translate: '-50% -50%', scale: String(lugar.s) }
}

interface PropsDoCorpo {
  combinacao: CombinacaoNaVista
  /** Resolvido, ou só para ver: os controles não respondem. */
  travado: boolean
  /** Ausente = só para ver (o editor). */
  acoes?: AcoesDaCombinacao
  /** Onde a tela do jogador pendura o teclado do controle. */
  teclado?: RefObject<TecladoDoControle | null>
}

/** O miolo do controle (o `.controle` do v2 sem o lugar): o quadro do jogador e o editor põem cada um a sua casca. */
export function CorpoDoControle({ combinacao, travado, acoes, teclado }: PropsDoCorpo) {
  const bloqueado = travado || acoes === undefined
  switch (combinacao.forma) {
    case 'numeros':
    case 'simbolos':
      return <Rodas forma={combinacao.forma} rodas={combinacao.rodas} bloqueado={bloqueado} acoes={acoes} teclado={teclado} />
    case 'relogio':
      return <Relogio minutos={combinacao.minutos} bloqueado={bloqueado} acoes={acoes} teclado={teclado} />
    case 'botoes':
      return <Botoes rotulos={combinacao.rotulos} total={combinacao.total} certos={combinacao.certos} bloqueado={bloqueado} acoes={acoes} />
  }
}

// ------------------------------------------------------------------ as rodas

interface PropsDasRodas {
  forma: 'numeros' | 'simbolos'
  rodas: readonly number[]
  bloqueado: boolean
  acoes: AcoesDaCombinacao | undefined
  teclado: RefObject<TecladoDoControle | null> | undefined
}

function Rodas({ forma, rodas, bloqueado, acoes, teclado }: PropsDasRodas) {
  const caixa = useRef<HTMLDivElement>(null)
  // A roda girada pelo teclado não anima (o v2: só a seta e o rolar do mouse animam).
  const semAnimar = useRef(new Set<number>())
  const onGirar = acoes?.onGirar

  const girar = (roda: number, passo: 1 | -1, animado: boolean) => {
    if (bloqueado || onGirar === undefined) return
    if (!animado) semAnimar.current.add(roda)
    onGirar(roda, passo)
  }
  const girarAgora = useRef(girar)
  useEffect(() => {
    girarAgora.current = girar
  })

  // O rolar do mouse sobre a janela gira a roda; o ouvinte não é passivo para a página não rolar junto.
  useEffect(() => {
    const el = caixa.current
    if (el === null) return
    let juntado = 0
    const rolou = (evento: WheelEvent) => {
      const janela = evento.target instanceof Element ? evento.target.closest<HTMLElement>('[data-roda]') : null
      if (janela === null || janela.tabIndex < 0) return
      evento.preventDefault()
      juntado += evento.deltaY
      if (Math.abs(juntado) < ROLAR_POR_PASSO) return
      girarAgora.current(Number(janela.dataset.roda), juntado < 0 ? 1 : -1, true)
      juntado = 0
    }
    el.addEventListener('wheel', rolou, { passive: false })
    return () => el.removeEventListener('wheel', rolou)
  }, [])

  useEffect(() => {
    if (teclado === undefined) return
    teclado.current = (evento) => {
      if (evento.key !== 'ArrowUp' && evento.key !== 'ArrowDown') return false
      const janela = evento.target instanceof Element ? evento.target.closest<HTMLElement>('[data-roda]') : null
      if (janela === null || caixa.current === null || !caixa.current.contains(janela)) return false
      evento.preventDefault()
      girarAgora.current(Number(janela.dataset.roda), evento.key === 'ArrowUp' ? 1 : -1, false)
      return true
    }
    return () => {
      teclado.current = null
    }
  }, [teclado])

  const numeros = forma === 'numeros'
  return (
    <>
      <span className="qpz-controle__rot">{numeros ? 'Números' : 'Símbolos'}</span>
      <div ref={caixa} className="qpz-controle__rodas">
        {rodas.map((valor, i) => (
          <Roda key={i} indice={i} valor={valor} numeros={numeros} bloqueado={bloqueado} semAnimar={semAnimar} onGirar={girar} />
        ))}
      </div>
      <button type="button" className="qpz-tentar" disabled={bloqueado} tabIndex={acoes === undefined ? -1 : undefined} onClick={() => acoes?.onTentar()}>
        Tentar abrir
      </button>
    </>
  )
}

interface PropsDaRoda {
  indice: number
  valor: number
  numeros: boolean
  bloqueado: boolean
  semAnimar: RefObject<Set<number>>
  onGirar: (roda: number, passo: 1 | -1, animado: boolean) => void
}

function Roda({ indice, valor, numeros, bloqueado, semAnimar, onGirar }: PropsDaRoda) {
  const miolo = useRef<HTMLSpanElement>(null)
  const anterior = useRef(valor)
  const tamanho = numeros ? ALGARISMOS : SIMBOLOS_DA_RODA.length

  // O valor novo entra pela direção do giro (vem de baixo quando a roda sobe), seja de quem for o giro.
  useLayoutEffect(() => {
    const antes = anterior.current
    anterior.current = valor
    const doTeclado = semAnimar.current.delete(indice)
    if (antes === valor || doTeclado || movimentoReduzido()) return
    const subiu = modulo(valor - antes, tamanho) <= tamanho / 2
    miolo.current?.animate(
      [
        { transform: `translateY(${subiu ? '' : '-'}${GIRO_DESLOCAMENTO})`, opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      { duration: GIRO_MS, easing: EASE_OUT },
    )
  }, [valor, indice, tamanho, semAnimar])

  const simbolo = SIMBOLOS_DA_RODA[modulo(valor, SIMBOLOS_DA_RODA.length)]
  const rotulo = `Roda ${indice + 1}`
  return (
    <div className="qpz-roda">
      <button type="button" className="qpz-roda__seta" tabIndex={-1} aria-label={`${rotulo}, para cima`} disabled={bloqueado} onClick={() => onGirar(indice, 1, true)}>
        <SetaParaCima />
      </button>
      <div
        className="qpz-roda__janela"
        role="spinbutton"
        tabIndex={bloqueado ? -1 : 0}
        data-roda={indice}
        aria-label={rotulo}
        aria-valuenow={valor}
        aria-valuemin={0}
        aria-valuemax={tamanho - 1}
        aria-valuetext={numeros ? String(valor) : NOME_DO_SIMBOLO[simbolo]}
        aria-disabled={bloqueado || undefined}
      >
        <span ref={miolo} className="qpz-roda__valor">
          {numeros ? valor : <Glifo simbolo={simbolo} />}
        </span>
      </div>
      <button type="button" className="qpz-roda__seta qpz-roda__seta--baixo" tabIndex={-1} aria-label={`${rotulo}, para baixo`} disabled={bloqueado} onClick={() => onGirar(indice, -1, true)}>
        <SetaParaCima />
      </button>
    </div>
  )
}

function SetaParaCima() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** O traço dos glifos do v2. */
const TRACO_DO_GLIFO: SVGProps<SVGPathElement> = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinejoin: 'round' }

/** Os glifos das rodas de símbolos (`GLIFO` do v2). */
function Glifo({ simbolo }: { simbolo: SimboloDaRoda }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <DesenhoDoGlifo simbolo={simbolo} />
    </svg>
  )
}

function DesenhoDoGlifo({ simbolo }: { simbolo: SimboloDaRoda }) {
  switch (simbolo) {
    case 'ancora':
      return (
        <>
          <path d="M24 10v26M17 16h14M12 27c1 6 6 9 12 9s11-3 12-9" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="24" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="2.6" />
        </>
      )
    case 'estrela':
      return <path d="M24 8l4.7 9.6 10.6 1.5-7.7 7.5 1.8 10.5L24 32.1l-9.4 5 1.8-10.5-7.7-7.5 10.6-1.5z" {...TRACO_DO_GLIFO} />
    case 'peixe':
      return (
        <>
          <path d="M9 24c5-7 13-9 21-5 2 1 4 3 5 5-1 2-3 4-5 5-8 4-16 2-21-5zM35 24l5-6v12z" {...TRACO_DO_GLIFO} />
          <circle cx="17" cy="22.5" r="1.8" fill="currentColor" />
        </>
      )
    case 'coroa':
      return <path d="M10 34h28l2-17-8 7-8-11-8 11-8-7z" {...TRACO_DO_GLIFO} />
    case 'chave':
      return (
        <>
          <circle cx="15" cy="24" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M21 24h18M33 24v6M38 24v4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </>
      )
    case 'olho':
      return (
        <>
          <path d="M7 24c5-8 12-11 17-11s12 3 17 11c-5 8-12 11-17 11S12 32 7 24z" {...TRACO_DO_GLIFO} />
          <circle cx="24" cy="24" r="4.5" fill="currentColor" />
        </>
      )
  }
}

// ------------------------------------------------------------------ o relógio

/** O ângulo mais perto de `atual` que aponta para `alvo` (o `perto` do v2): o ponteiro nunca dá a volta pelo lado longo. */
function perto(alvo: number, atual: number): number {
  return atual + modulo(alvo - atual + 180, 360) - 180
}

interface Angulos {
  de: number
  h: number
  m: number
}

function angulosDe(minutos: number, antes: Angulos | null): Angulos {
  const h = minutos / 2
  const m = (minutos % UMA_HORA) * 6
  return antes === null ? { de: minutos, h, m } : { de: minutos, h: perto(h, antes.h), m: perto(m, antes.m) }
}

interface PropsDoRelogio {
  minutos: number
  bloqueado: boolean
  acoes: AcoesDaCombinacao | undefined
  teclado: RefObject<TecladoDoControle | null> | undefined
}

function Relogio({ minutos, bloqueado, acoes, teclado }: PropsDoRelogio) {
  const svg = useRef<SVGSVGElement>(null)
  const arrasto = useRef<{ ponteiro: 'h' | 'm'; id: number } | null>(null)
  // A hora que ESTA tela pôs e o host ainda não devolveu; `null` = a da vista.
  const [pendente, setPendente] = useState<number | null>(null)
  const [vistaVista, setVistaVista] = useState(minutos)
  if (minutos !== vistaVista) {
    setVistaVista(minutos)
    setPendente(null)
  }
  const agora = pendente ?? minutos
  // Os ângulos andam pelo caminho curto a partir de onde estavam (sem o salto das 12 para a 1).
  const [angulos, setAngulos] = useState<Angulos>(() => angulosDe(agora, null))
  if (angulos.de !== agora) setAngulos(angulosDe(agora, angulos))
  // Arrasto e teclado: o ponteiro segue sem a transição; os botões animam.
  const [solto, setSolto] = useState(false)
  const onPonteiro = acoes?.onPonteiro

  const por = (proximos: number, animado: boolean, mandar: boolean) => {
    if (bloqueado || onPonteiro === undefined) return
    const certo = minutosNoMostrador(proximos)
    setSolto(!animado)
    setPendente(certo)
    if (mandar) onPonteiro(certo)
  }
  const porAgora = useRef(por)
  const agoraAgora = useRef(agora)
  useEffect(() => {
    porAgora.current = por
    agoraAgora.current = agora
  })

  useEffect(() => {
    if (teclado === undefined) return
    teclado.current = (evento) => {
      if (!evento.key.startsWith('Arrow')) return false
      const ponteiro = evento.target instanceof Element ? evento.target.closest<SVGGElement>('[data-ponteiro]') : null
      if (ponteiro === null || svg.current === null || !svg.current.contains(ponteiro)) return false
      evento.preventDefault()
      const sobe = evento.key === 'ArrowUp' || evento.key === 'ArrowRight' ? 1 : -1
      porAgora.current(agoraAgora.current + sobe * (ponteiro.dataset.ponteiro === 'h' ? UMA_HORA : CINCO_MINUTOS), false, true)
      return true
    }
    return () => {
      teclado.current = null
    }
  }, [teclado])

  const pegar = (evento: EventoDePonteiro<SVGGElement>, ponteiro: 'h' | 'm') => {
    if (evento.button !== 0 || bloqueado || svg.current === null) return
    arrasto.current = { ponteiro, id: evento.pointerId }
    svg.current.setPointerCapture(evento.pointerId)
    evento.preventDefault()
  }

  /** O ângulo do dedo em volta do centro (0 = 12h), e a hora para onde o ponteiro arrastado aponta (o v2). */
  const mover = (evento: EventoDePonteiro<SVGSVGElement>) => {
    const a = arrasto.current
    if (a === null || evento.pointerId !== a.id || svg.current === null) return
    const caixa = svg.current.getBoundingClientRect()
    const graus = modulo((Math.atan2(evento.clientX - (caixa.left + caixa.width / 2), -(evento.clientY - (caixa.top + caixa.height / 2))) * 180) / Math.PI, 360)
    const hora = Math.floor(agora / UMA_HORA)
    const minuto = agora % UMA_HORA
    if (a.ponteiro === 'm') {
      const novo = (Math.round(graus / 30) * CINCO_MINUTOS) % UMA_HORA
      if (novo === minuto) return
      // Passar pelo 12 leva a hora junto, para frente ou para trás.
      let proximos = hora * UMA_HORA + novo
      if (minuto >= 45 && novo < 15) proximos += UMA_HORA
      if (minuto < 15 && novo >= 45) proximos -= UMA_HORA
      por(proximos, false, false)
      return
    }
    const novaHora = modulo(Math.round((graus - minuto / 2) / 30), 12)
    if (novaHora === hora % 12) return
    por(novaHora * UMA_HORA + minuto, false, false)
  }

  const soltar = (evento: EventoDePonteiro<SVGSVGElement>) => {
    const a = arrasto.current
    if (a === null || evento.pointerId !== a.id) return
    arrasto.current = null
    if (svg.current?.hasPointerCapture(evento.pointerId) === true) svg.current.releasePointerCapture(evento.pointerId)
    // A hora vai ao host uma vez, ao soltar: o arrasto não manda um pedido por passo.
    if (pendente !== null && pendente !== minutos) onPonteiro?.(pendente)
  }

  const hora = Math.floor(agora / UMA_HORA) || 12
  const minuto = agora % UMA_HORA
  const tab = bloqueado ? -1 : 0
  return (
    <>
      <svg
        ref={svg}
        className="qpz-relogio"
        viewBox="0 0 200 200"
        role="group"
        aria-label={`Mostrador do relógio: ${textoDaHora(agora)}`}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
      >
        <circle cx="100" cy="100" r="97" fill="#b89552" stroke="#6e5931" strokeWidth="4" />
        <circle cx="100" cy="100" r="88" fill="#efe6d0" stroke="#8b8270" strokeWidth="2" />
        <MarcasDoMostrador />
        <g
          className={classes('qpz-ponteiro', solto && 'is-solto')}
          data-ponteiro="h"
          tabIndex={tab}
          role="slider"
          aria-label="Ponteiro das horas"
          aria-valuemin={1}
          aria-valuemax={12}
          aria-valuenow={hora}
          aria-valuetext={`${hora} horas`}
          style={{ transform: `rotate(${angulos.h}deg)` }}
          onPointerDown={(evento) => pegar(evento, 'h')}
        >
          <line x1="100" y1="104" x2="100" y2="46" stroke="transparent" strokeWidth="22" />
          <path className="qpz-ponteiro__haste" d="M100 112V54" stroke="#383a3c" strokeWidth="7" strokeLinecap="round" fill="none" />
        </g>
        <g
          className={classes('qpz-ponteiro', solto && 'is-solto')}
          data-ponteiro="m"
          tabIndex={tab}
          role="slider"
          aria-label="Ponteiro dos minutos"
          aria-valuemin={0}
          aria-valuemax={55}
          aria-valuenow={minuto}
          aria-valuetext={`${minuto} minutos`}
          style={{ transform: `rotate(${angulos.m}deg)` }}
          onPointerDown={(evento) => pegar(evento, 'm')}
        >
          <line x1="100" y1="104" x2="100" y2="22" stroke="transparent" strokeWidth="22" />
          <path className="qpz-ponteiro__haste" d="M100 116V26" stroke="#5d6164" strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
        <circle cx="100" cy="100" r="6" fill="#b89552" stroke="#6e5931" strokeWidth="2" pointerEvents="none" />
      </svg>
      <div className="qpz-relogio__bts" role="group" aria-label="Ajustar a hora">
        {[
          { rotulo: '−1 h', passo: -UMA_HORA },
          { rotulo: '+1 h', passo: UMA_HORA },
          { rotulo: '−5 min', passo: -CINCO_MINUTOS },
          { rotulo: '+5 min', passo: CINCO_MINUTOS },
        ].map(({ rotulo, passo }) => (
          <button key={rotulo} type="button" className="qpz-relogio__bt" disabled={bloqueado} tabIndex={acoes === undefined ? -1 : undefined} onClick={() => por(agora + passo, true, true)}>
            {rotulo}
          </button>
        ))}
      </div>
      <button type="button" className="qpz-tentar" disabled={bloqueado} tabIndex={acoes === undefined ? -1 : undefined} onClick={() => acoes?.onTentar()}>
        Tentar
      </button>
    </>
  )
}

const ROMANOS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
const MARCAS_DO_MOSTRADOR = 60

/** As 60 marcas e os 12 romanos do mostrador do v2 (desenho fixo: nunca muda depois de montado). */
function MarcasDoMostrador() {
  const marcas = []
  for (let i = 0; i < MARCAS_DO_MOSTRADOR; i++) {
    const g = (i * 6 * Math.PI) / 180
    const fora = 84
    const dentro = i % 5 !== 0 ? 80 : 76
    marcas.push(
      <line
        key={`m${i}`}
        x1={(100 + Math.sin(g) * fora).toFixed(1)}
        y1={(100 - Math.cos(g) * fora).toFixed(1)}
        x2={(100 + Math.sin(g) * dentro).toFixed(1)}
        y2={(100 - Math.cos(g) * dentro).toFixed(1)}
        stroke="#8b8270"
        strokeWidth={i % 5 !== 0 ? 1 : 2}
      />,
    )
  }
  ROMANOS.forEach((romano, i) => {
    const g = (i * 30 * Math.PI) / 180
    marcas.push(
      <text key={`r${i}`} x={(100 + Math.sin(g) * 64).toFixed(1)} y={(104 - Math.cos(g) * 64).toFixed(1)} textAnchor="middle" className="qpz-relogio__romano">
        {romano}
      </text>,
    )
  })
  return <g aria-hidden="true">{marcas}</g>
}

// ------------------------------------------------------------------ os botões

interface PropsDosBotoes {
  rotulos: readonly string[]
  total: number
  certos: number
  bloqueado: boolean
  acoes: AcoesDaCombinacao | undefined
}

function Botoes({ rotulos, total, certos, bloqueado, acoes }: PropsDosBotoes) {
  const apertar = (botao: number, el: HTMLButtonElement) => {
    if (bloqueado || acoes === undefined) return
    // O botão afunda também pelo teclado (o `:active` do CSS só pega o clique).
    if (!movimentoReduzido()) el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(0.25cqw)' }, { transform: 'translateY(0)' }], { duration: APERTO_MS, easing: EASE_OUT })
    acoes.onApertar(botao)
  }
  return (
    <>
      <span className="qpz-controle__rot">Sequência</span>
      <div className="qpz-botoes" role="group" aria-label={`Botões: ${certos} de ${total} na sequência`}>
        {rotulos.map((rotulo, i) => (
          <button key={i} type="button" className="qpz-botao" aria-label={`Botão ${rotulo}`} disabled={bloqueado} tabIndex={acoes === undefined ? -1 : undefined} onClick={(evento) => apertar(i, evento.currentTarget)}>
            {rotulo}
          </button>
        ))}
      </div>
      <div className="qpz-luzes" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < certos ? 'is-certa' : undefined} />
        ))}
      </div>
    </>
  )
}

/** O nome do controle para o leitor de tela e o rótulo do quadro do editor. */
export function nomeDoControle(combinacao: CombinacaoNaVista): string {
  switch (combinacao.forma) {
    case 'numeros':
      return `${combinacao.rodas.length} rodas de números`
    case 'simbolos':
      return `${combinacao.rodas.length} rodas de símbolos`
    case 'relogio':
      return 'Relógio'
    case 'botoes':
      return `${combinacao.rotulos.length} botões`
  }
}
