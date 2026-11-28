/**
 * A BANCADA DA MISTURA NO QUADRO DO PUZZLE (28/11): a base fixa (a parede, a
 * prateleira, a torneira, a pia, o receptáculo e a plaqueta, `BaseDaMistura`)
 * e o que se mexe (`PainelDaMistura`): os recipientes de vidro, com o líquido,
 * o menisco e o brilho, e os lugares onde se despeja.
 *
 * Os gestos (os mesmos no mouse, no dedo e no teclado):
 * - tocar num recipiente (ou na torneira) o pega; tocar noutro lugar despeja
 *   nele: noutro recipiente, na pia (esvazia) ou no receptáculo (entrega);
 *   tocar de novo no da mão o devolve; com um recipiente na mão, tocar na
 *   torneira o enche;
 * - arrastar um recipiente (ou a torneira) até o lugar faz o mesmo; o lugar
 *   sob o dedo acende enquanto ele espera, antes de soltar;
 * - Enter e Espaço pegam e despejam; Esc devolve o da mão;
 * - na receita, o item escolhido na mochila vai ao frasco tocado.
 *
 * O que vale é o host (a vista): a tela não despeja sozinha, só pede. O
 * recipiente inclina e o fio cai na hora (só no gesto do ponteiro; o teclado
 * não anima), e o nível muda quando a vista chega.
 *
 * Sem `onDespejar` (o editor), tudo é só para ver.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as EventoDoMouse, type PointerEvent as EventoDoPonteiro, type RefObject } from 'react'
import { classes } from '../../lib/primitivosDaTela'
import type { TecladoDoControle } from '../ControlesDaCombinacao'
import type { MisturaNaVista, RecipienteNaVista } from '../tipos'
import { ALTURA_DO_QUADRO, ARO_DO_RECIPIENTE, LARGURA_DO_QUADRO, PE_DO_RECIPIENTE, VIDRO_DO_RECIPIENTE, geometriaDaBancada, urlDaBaseDaBancada, type Caixa } from './arte'
import { corDoRecipiente, opacidadeDasPartes, total } from './mistura'
import { tocarSomDaMistura } from './somDaMistura'
import './mistura.css'

type Origem = number | 'fonte'
type Destino = number | 'ralo' | 'receptaculo' | 'fonte'

/** O fio e a inclinação duram isto (a vista do host chega antes, na mesa). */
const VERTER_MS = 220
/** O aviso de um toque sem efeito fica isto na linha da dica. */
const AVISO_MS = 2600
/** O dedo anda isto (px) antes de virar arrasto (menos que isto é um toque). */
const LIMIAR_DO_ARRASTO = 8

const TINTA_DA_TORNEIRA = '#a8d4e0'

/** A parede, a bancada e a plaqueta (a arte do quadro, por baixo da camada). */
export function BaseDaMistura({ mistura }: { mistura: MisturaNaVista }) {
  const capacidades = mistura.recipientes.map((r) => r.capacidade)
  return (
    <div className="qpz__arte qpz-mx-base">
      <img src={urlDaBaseDaBancada(mistura.material, capacidades, mistura.fonte, true)} alt="" draggable={false} />
    </div>
  )
}

export interface PropsDaBancada {
  mistura: MisturaNaVista
  resolvido: boolean
  /** Ausente = só para ver (o editor e o resumo). */
  onDespejar?: (de: Origem, para: number | 'ralo' | 'receptaculo') => void
  onRecomecar?: () => void
  /** Na receita: o item escolhido na mochila (vai ao frasco tocado). */
  ingrediente?: { vagaId: string; nome: string } | null
  onDeitar?: (vagaId: string, recipiente: number) => void
  /** Onde a tela do jogador pendura o teclado do painel (o Esc devolve o da mão). */
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

function dentroDe(caixa: Caixa, fora: Caixa): CSSProperties {
  return {
    left: `${(((caixa.x - fora.x) / fora.largura) * 100).toFixed(3)}%`,
    top: `${(((caixa.y - fora.y) / fora.altura) * 100).toFixed(3)}%`,
    width: `${((caixa.largura / fora.largura) * 100).toFixed(3)}%`,
    height: `${((caixa.altura / fora.altura) * 100).toFixed(3)}%`,
  }
}

function nomeDe(i: number, modo: MisturaNaVista['modo'], comArtigo = true): string {
  const nome = modo === 'volumes' ? 'jarra' : 'frasco'
  return comArtigo ? `${modo === 'volumes' ? 'a' : 'o'} ${nome} ${i + 1}` : `${nome[0]?.toLocaleUpperCase('pt-BR')}${nome.slice(1)} ${i + 1}`
}

function lista(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

function rotuloDoRecipiente(i: number, r: RecipienteNaVista, modo: MisturaNaVista['modo'], naMao: boolean): string {
  const litros = total(r.partes)
  const conteudo = litros === 0 ? 'vazio' : `${litros} de ${r.capacidade} L`
  const capacidade = litros === 0 ? `, cabem ${r.capacidade} L` : ''
  return `${nomeDe(i, modo, false)}: ${conteudo}${capacidade}${r.turvo ? ', turvo' : ''}${r.itens.length > 0 ? `, com ${lista(r.itens.map((p) => p.nome))}` : ''}${naMao ? ', na mão' : ''}`
}

/** Clareia uma cor `#rrggbb` em direção ao branco (o menisco pega a luz). */
function clarear(cor: string, t: number): string {
  const canal = (k: number) => Math.round(parseInt(cor.slice(1 + 2 * k, 3 + 2 * k), 16) * (1 - t) + 255 * t)
  return `rgb(${canal(0)},${canal(1)},${canal(2)})`
}

/** Um número de 0 a 1 que sai do texto (a mesma folha cai sempre no mesmo lugar). */
function sorteio(texto: string, sal: number): number {
  let h = 2166136261 ^ sal
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

export function PainelDaMistura({ mistura, resolvido, onDespejar, onRecomecar, ingrediente = null, onDeitar, teclado }: PropsDaBancada) {
  const { recipientes, modo } = mistura
  const capacidades = recipientes.map((r) => r.capacidade).join(',')
  const geometria = useMemo(() => geometriaDaBancada(capacidades.split(',').map(Number), mistura.fonte), [capacidades, mistura.fonte])
  const interativo = onDespejar !== undefined && !resolvido
  const raiz = useRef<HTMLDivElement>(null)

  const [naMao, setNaMao] = useState<Origem | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [vertendo, setVertendo] = useState<{ de: Origem; para: Destino; cor: string } | null>(null)
  const idDoMotivo = useId()
  const [arrasto, setArrasto] = useState<{ de: Origem; x: number; y: number; sobre: Destino | null } | null>(null)
  const [peloTeclado, setPeloTeclado] = useState(false)
  const inicioDoArrasto = useRef<{ de: Origem; x: number; y: number; id: number } | null>(null)
  const acabouDeArrastar = useRef(false)
  const relogios = useRef<{ aviso?: number; verter?: number }>({})

  // O da mão que sumiu (o mestre mudou a bancada) ou o puzzle resolvido: a mão esvazia.
  const maoValida = naMao === null || naMao === 'fonte' ? (naMao === 'fonte' && !mistura.fonte ? null : naMao) : naMao < recipientes.length ? naMao : null
  const mao = interativo ? maoValida : null

  useEffect(() => {
    const r = relogios.current
    return () => {
      window.clearTimeout(r.aviso)
      window.clearTimeout(r.verter)
    }
  }, [])

  const avisar = (texto: string) => {
    window.clearTimeout(relogios.current.aviso)
    setAviso(texto)
    relogios.current.aviso = window.setTimeout(() => setAviso(null), AVISO_MS)
  }

  const verter = (de: Origem, para: Destino, comMovimento: boolean) => {
    if (!comMovimento) return
    window.clearTimeout(relogios.current.verter)
    // A cor de agora: quando a vista chegar, o de origem pode já estar vazio.
    setVertendo({ de, para, cor: corNaMao(de) })
    relogios.current.verter = window.setTimeout(() => setVertendo(null), VERTER_MS)
  }

  /** Despejar `de` em `para` (pedido ao host). */
  const despejar = (de: Origem, para: Destino, comMovimento: boolean) => {
    if (onDespejar === undefined || !interativo) return
    setNaMao(null)
    setAviso(null)
    if (para === 'fonte') {
      // Com um recipiente na mão, a torneira o enche.
      if (de === 'fonte') return
      onDespejar('fonte', de)
      verter('fonte', de, comMovimento)
      return
    }
    if (de === 'fonte') {
      if (para === 'ralo') return avisar('A água da torneira iria direto pelo ralo.')
      if (para === 'receptaculo') return avisar('O receptáculo quer a mistura de um recipiente, não água da torneira.')
      onDespejar('fonte', para)
      verter('fonte', para, comMovimento)
      return
    }
    onDespejar(de, para)
    verter(de, para, comMovimento)
  }

  /** O toque (ou o Enter) num lugar da bancada. */
  const tocar = (onde: Destino, comMovimento: boolean) => {
    if (!interativo) return
    setPeloTeclado(!comMovimento)
    if (typeof onde === 'number' && ingrediente !== null && onDeitar !== undefined && modo === 'receita') {
      setNaMao(null)
      onDeitar(ingrediente.vagaId, onde)
      return
    }
    if (mao === null) {
      if (onde === 'fonte') return setNaMao('fonte')
      if (onde === 'ralo') return avisar('Pegue um recipiente primeiro e depois toque na pia para esvaziá-lo.')
      if (onde === 'receptaculo') return avisar('Pegue o recipiente com a mistura e depois toque no receptáculo.')
      const r = recipientes[onde]
      if (r !== undefined && total(r.partes) === 0 && r.itens.length === 0) {
        return avisar(`${nomeDe(onde, modo, false)} está vazi${modo === 'volumes' ? 'a' : 'o'}: ${mistura.fonte ? 'encha na torneira ou despeje outro nele' : 'despeje outro nele'}.`)
      }
      return setNaMao(onde)
    }
    if (mao === onde) return setNaMao(null)
    despejar(mao, onde, comMovimento)
  }

  const aoClicar = (onde: Destino) => (evento: EventoDoMouse<HTMLButtonElement>) => {
    if (acabouDeArrastar.current) {
      acabouDeArrastar.current = false
      return
    }
    // `detail === 0`: o clique veio do teclado (Enter ou Espaço), que não anima.
    tocar(onde, evento.detail !== 0)
  }

  // ---------------------------------------------------------------- arrastar

  const destinoSob = (x: number, y: number): Destino | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-destino]')
    if (el === null || el === undefined || raiz.current === null || !raiz.current.contains(el)) return null
    const valor = el.dataset.destino ?? ''
    if (valor === 'ralo' || valor === 'receptaculo' || valor === 'fonte') return valor
    const i = Number(valor)
    return Number.isInteger(i) && i >= 0 && i < recipientes.length ? i : null
  }

  const aoApertar = (de: Origem) => (evento: EventoDoPonteiro<HTMLButtonElement>) => {
    if (!interativo || evento.button !== 0 || inicioDoArrasto.current !== null) return
    if (typeof de === 'number' && ingrediente !== null && modo === 'receita') return
    inicioDoArrasto.current = { de, x: evento.clientX, y: evento.clientY, id: evento.pointerId }
  }

  const aoMover = (evento: EventoDoPonteiro<HTMLButtonElement>) => {
    const inicio = inicioDoArrasto.current
    if (inicio === null || inicio.id !== evento.pointerId || raiz.current === null) return
    const caixa = raiz.current.getBoundingClientRect()
    if (arrasto === null) {
      if (Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y) < LIMIAR_DO_ARRASTO) return
      const r = typeof inicio.de === 'number' ? recipientes[inicio.de] : undefined
      if (r !== undefined && total(r.partes) === 0) {
        inicioDoArrasto.current = null
        return
      }
      evento.currentTarget.setPointerCapture(evento.pointerId)
      setNaMao(null)
    }
    const sobre = destinoSob(evento.clientX, evento.clientY)
    setArrasto({ de: inicio.de, x: evento.clientX - caixa.left, y: evento.clientY - caixa.top, sobre: sobre === inicio.de ? null : sobre })
  }

  const aoSoltar = (evento: EventoDoPonteiro<HTMLButtonElement>) => {
    const inicio = inicioDoArrasto.current
    if (inicio === null || inicio.id !== evento.pointerId) return
    inicioDoArrasto.current = null
    if (arrasto === null) return
    acabouDeArrastar.current = true
    window.setTimeout(() => {
      acabouDeArrastar.current = false
    }, 0)
    const sobre = destinoSob(evento.clientX, evento.clientY)
    setArrasto(null)
    if (sobre !== null && sobre !== inicio.de) {
      setPeloTeclado(false)
      despejar(inicio.de, sobre, true)
    }
  }

  const cancelarArrasto = () => {
    inicioDoArrasto.current = null
    setArrasto(null)
  }

  // ---------------------------------------------------------------- o teclado (o Esc devolve o da mão)

  const tecla = (evento: KeyboardEvent): boolean => {
    if (evento.key !== 'Escape' || (mao === null && arrasto === null)) return false
    evento.preventDefault()
    cancelarArrasto()
    setNaMao(null)
    return true
  }
  const teclaAgora = useRef(tecla)
  useEffect(() => {
    teclaAgora.current = tecla
  })
  useEffect(() => {
    if (teclado === undefined) return
    teclado.current = (evento) => teclaAgora.current(evento)
    return () => {
      teclado.current = null
    }
  }, [teclado])

  // ---------------------------------------------------------------- o som de cada mudança (de quem for, aqui ou na mesa)

  const antes = useRef(recipientes)
  useLayoutEffect(() => {
    const anterior = antes.current
    if (anterior === recipientes) return
    antes.current = recipientes
    if (!interativo || anterior.length !== recipientes.length) return
    const subiu = recipientes.some((r, i) => total(r.partes) > total(anterior[i]?.partes ?? []))
    const desceu = recipientes.some((r, i) => total(r.partes) < total(anterior[i]?.partes ?? []))
    const caiu = recipientes.some((r, i) => r.itens.length > (anterior[i]?.itens.length ?? 0))
    const turvou = recipientes.some((r, i) => r.turvo && anterior[i]?.turvo !== true)
    if (caiu) tocarSomDaMistura('plop')
    if (turvou) window.setTimeout(() => tocarSomDaMistura('turvou'), 140)
    else if (subiu && desceu) tocarSomDaMistura('despejar')
    else if (subiu) tocarSomDaMistura('encher')
    else if (desceu) tocarSomDaMistura('esvaziar')
  }, [recipientes, interativo])

  // ---------------------------------------------------------------- o que a linha de baixo diz

  const segurando: Origem | null = arrasto?.de ?? mao
  const dica = (() => {
    if (resolvido) return 'A mistura desceu pelo funil.'
    if (!interativo) return ''
    if (aviso !== null) return aviso
    if (ingrediente !== null && modo === 'receita') return `Com ${ingrediente.nome} na mão: toque no frasco onde ele vai.`
    if (segurando === 'fonte') return 'Torneira aberta: toque no recipiente que vai encher. Esc fecha.'
    if (segurando !== null) return `Com ${nomeDe(segurando, modo)} na mão: toque onde despejar, na pia ou no receptáculo. Esc devolve.`
    if (modo === 'receita') return `${mistura.fonte ? 'Encha um frasco na torneira, ' : ''}ponha os itens da mochila e leve ao receptáculo.`
    return `Toque num${modo === 'volumes' ? 'a jarra' : ' frasco'}${mistura.fonte ? ' (ou na torneira)' : ''} e depois onde despejar, ou arraste.`
  })()

  const ehDestino = (onde: Destino): boolean => {
    if (!interativo || segurando === null || segurando === onde) return false
    if (segurando === 'fonte') return typeof onde === 'number'
    return true
  }
  const sobre = arrasto?.sobre ?? null
  const corNaMao = (de: Origem | null): string => {
    if (de === null || de === 'fonte') return TINTA_DA_TORNEIRA
    const r = recipientes[de]
    return r === undefined ? TINTA_DA_TORNEIRA : corDoRecipiente(r.partes, r.itens.map((p) => p.nome), r.turvo)
  }
  const recomecarParado = !interativo || mistura.noComeco || onRecomecar === undefined
  const motivoDoRecomecar = resolvido ? 'Resolvido.' : mistura.noComeco ? 'Ainda está como começou.' : ''

  const estacao = (onde: 'fonte' | 'ralo' | 'receptaculo', caixa: Caixa, rotulo: string) => (
    <button
      type="button"
      className={classes('qpz-mx__alvo', 'qpz-mx__estacao', ehDestino(onde) && 'is-destino', sobre === onde && 'is-sobre', segurando === onde && 'is-na-mao')}
      style={noQuadro(caixa)}
      data-destino={onde}
      tabIndex={onDespejar !== undefined ? 0 : -1}
      aria-label={rotulo}
      aria-pressed={onde === 'fonte' ? segurando === 'fonte' : undefined}
      aria-disabled={!interativo || undefined}
      onClick={aoClicar(onde)}
      onPointerDown={onde === 'fonte' ? aoApertar('fonte') : undefined}
      onPointerMove={onde === 'fonte' ? aoMover : undefined}
      onPointerUp={onde === 'fonte' ? aoSoltar : undefined}
      onPointerCancel={onde === 'fonte' ? cancelarArrasto : undefined}
    />
  )

  return (
    <div
      ref={raiz}
      className={classes('qpz-mx', resolvido && 'is-resolvido', !interativo && 'is-parado', peloTeclado && 'is-teclado', arrasto !== null && 'is-arrastando')}
      data-material={mistura.material}
      role="group"
      aria-label={interativo ? 'Bancada de mistura: despeje de um recipiente no outro e leve ao receptáculo' : 'Bancada de mistura'}
      onKeyDown={teclado === undefined ? (evento) => void tecla(evento.nativeEvent) : undefined}
    >
      <Plaqueta mistura={mistura} caixa={geometria.plaqueta} />
      {geometria.torneira !== null && estacao('fonte', geometria.torneira, segurando === 'fonte' ? 'Torneira aberta: escolha o recipiente que vai encher' : 'Torneira: encher')}
      {estacao('ralo', geometria.pia, 'Pia: esvaziar')}
      {estacao('receptaculo', geometria.receptaculo, 'Receptáculo: entregar a mistura')}
      <span className="qpz-mx__visor" style={noQuadro(geometria.visor)} aria-hidden="true" />
      {geometria.recipientes.map((lugar, i) => {
        const r = recipientes[i]
        if (r === undefined) return null
        const litros = total(r.partes)
        return (
          <span key={i} className="qpz-mx__lugar">
            <button
              type="button"
              className={classes('qpz-mx__alvo', 'qpz-mx__rec', ehDestino(i) && 'is-destino', sobre === i && 'is-sobre', segurando === i && 'is-na-mao', ingrediente !== null && modo === 'receita' && interativo && 'is-destino')}
              style={noQuadro(lugar.alvo)}
              data-destino={i}
              tabIndex={onDespejar !== undefined ? 0 : -1}
              aria-label={rotuloDoRecipiente(i, r, modo, segurando === i)}
              aria-pressed={interativo ? segurando === i : undefined}
              aria-disabled={!interativo || undefined}
              onClick={aoClicar(i)}
              onPointerDown={aoApertar(i)}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerCancel={cancelarArrasto}
            >
              <span className="qpz-mx__corpo" style={dentroDe(lugar.caixa, lugar.alvo)} data-vertendo={vertendo !== null && vertendo.de === i ? (vertendo.para === 'ralo' || vertendo.para === 'fonte' || (typeof vertendo.para === 'number' && vertendo.para < i) ? 'esq' : 'dir') : undefined}>
                <Vidro recipiente={r} largura={lugar.caixa.largura} altura={lugar.caixa.altura} material={mistura.material} recebendo={vertendo !== null && vertendo.para === i ? vertendo.cor : null} />
              </span>
            </button>
            <span className="qpz-mx__litros" style={noQuadro(lugar.plaquinha)} aria-hidden="true">
              {litros} de {r.capacidade} L
            </span>
          </span>
        )
      })}
      <button
        type="button"
        className="qpz-mx__recomecar"
        style={noQuadro(geometria.recomecar)}
        tabIndex={onDespejar !== undefined ? 0 : -1}
        aria-disabled={recomecarParado || undefined}
        aria-describedby={motivoDoRecomecar !== '' && onDespejar !== undefined ? idDoMotivo : undefined}
        onClick={() => {
          if (recomecarParado || onRecomecar === undefined) return
          setNaMao(null)
          onRecomecar()
        }}
      >
        <span>Recomeçar a bancada</span>
        {motivoDoRecomecar !== '' && onDespejar !== undefined && (
          <small className="qpz-mx__motivo" id={idDoMotivo}>
            {motivoDoRecomecar}
          </small>
        )}
      </button>
      <span className="qpz-mx__leitor" aria-live="polite">
        {recipientes.map((r, i) => `${nomeDe(i, modo, false)}: ${total(r.partes) === 0 ? 'vazio' : `${total(r.partes)} de ${r.capacidade} L`}${r.turvo ? ', turvo' : ''}.`).join(' ')}
      </span>
      {dica !== '' && (
        <p className={classes('qpz-mx__dica', aviso !== null && 'is-aviso')} style={noQuadro(geometria.dica)} aria-live="polite">
          {dica}
        </p>
      )}
      {arrasto !== null && <span className="qpz-mx__fantasma" style={{ transform: `translate(${arrasto.x}px, ${arrasto.y}px)`, '--mx-cor': corNaMao(arrasto.de) } as CSSProperties} aria-hidden="true" />}
    </div>
  )
}

/** O alvo da plaqueta: a medida, a cor ou a receita (ou que ele está na pista). */
function Plaqueta({ mistura, caixa }: { mistura: MisturaNaVista; caixa: Caixa }) {
  const alvo = mistura.alvo
  return (
    <div className="qpz-mx__plaqueta" style={noQuadro(caixa)}>
      {alvo === null ? (
        <span className="qpz-mx__rotulo">O alvo está na pista.</span>
      ) : alvo.tipo === 'litros' ? (
        <>
          <span className="qpz-mx__rotulo">Meça</span>
          <strong className="qpz-mx__numero">{alvo.litros} L</strong>
          <span className="qpz-mx__rotulo">no receptáculo</span>
        </>
      ) : alvo.tipo === 'cor' ? (
        <>
          <span className="qpz-mx__amostra" style={{ '--mx-cor': alvo.cor } as CSSProperties} role="img" aria-label="A cor pedida" />
          <span className="qpz-mx__rotulo">Esta cor no receptáculo</span>
        </>
      ) : (
        <span className="qpz-mx__receita">
          <span className="qpz-mx__rotulo">{alvo.emOrdem ? 'Receita, nesta ordem' : 'Receita'}</span>
          <span className="qpz-mx__itens">
            {alvo.ingredientes.length === 0 ? 'só água' : alvo.ingredientes.map((nome, i) => (alvo.emOrdem ? `${i + 1}. ${nome}` : nome)).join(alvo.emOrdem ? ', ' : ' + ')}
            {alvo.litros !== null ? `, em ${alvo.litros} L de água` : ''}
          </span>
        </span>
      )}
    </div>
  )
}

interface PropsDoVidro {
  recipiente: RecipienteNaVista
  largura: number
  altura: number
  material: MisturaNaVista['material']
  /** A cor do fio que cai nele agora; `null` = nada caindo. */
  recebendo: string | null
}

/** O recipiente de vidro: o líquido com o menisco, os ingredientes no fundo, as marcas de litro, o brilho e o metal. */
function Vidro({ recipiente, largura: w, altura: h, material, recebendo }: PropsDoVidro) {
  const id = useId().replace(/:/g, '')
  const litros = total(recipiente.partes)
  const cheio = recipiente.capacidade > 0 ? litros / recipiente.capacidade : 0
  const nomes = recipiente.itens.map((p) => p.nome)
  const cor = corDoRecipiente(recipiente.partes, nomes, recipiente.turvo)
  const opacidade = recipiente.turvo ? 0.9 : opacidadeDasPartes(recipiente.partes, nomes.length > 0)
  const x0 = VIDRO_DO_RECIPIENTE
  const x1 = w - VIDRO_DO_RECIPIENTE
  const y0 = ARO_DO_RECIPIENTE + 2
  const y1 = h - PE_DO_RECIPIENTE
  const largo = x1 - x0
  const alto = y1 - y0
  const desce = (1 - cheio) * alto
  const metal = material === 'ferro' ? ['#2a2926', '#5a5751', '#a39e94', '#ece8de'] : ['#4a3816', '#8a6a2a', '#d4b260', '#fff0c2']
  return (
    <svg className="qpz-mx-vidro" viewBox={`0 0 ${w.toFixed(1)} ${h.toFixed(1)}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-dentro`}>
          <rect x={x0} y={y0} width={largo} height={alto} rx={12} />
        </clipPath>
        <linearGradient id={`${id}-volume`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.34" />
          <stop offset="0.28" stopColor="#fff" stopOpacity="0.14" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={metal[2]} />
          <stop offset="0.3" stopColor={metal[3]} />
          <stop offset="0.62" stopColor={metal[1]} />
          <stop offset="1" stopColor={metal[0]} />
        </linearGradient>
      </defs>
      <ellipse cx={w / 2} cy={h + 2} rx={w * 0.56} ry={8} fill="#000" opacity="0.38" />
      {/* o vidro de trás */}
      <rect x={x0 - 4} y={y0 - 6} width={largo + 8} height={alto + 10} rx={15} fill="#cfe6ee" fillOpacity="0.07" stroke="#0d1a1e" strokeOpacity="0.4" strokeWidth="1.5" />
      <g clipPath={`url(#${id}-dentro)`}>
        <g className="qpz-mx-nivel" style={{ transform: `translateY(${desce.toFixed(1)}px)` }}>
          <rect className="qpz-mx-tinta" x={x0} y={y0} width={largo} height={alto + 24} fill={cor} style={{ opacity: litros === 0 ? 0 : opacidade }} />
          <rect x={x0} y={y0} width={largo} height={alto + 24} fill={`url(#${id}-volume)`} opacity={litros === 0 ? 0 : 1} />
          {recipiente.turvo &&
            [0.2, 0.45, 0.7, 0.33, 0.6].map((t, k) => <circle key={k} cx={x0 + largo * t} cy={y0 + 18 + k * 14} r={2.6} fill="#14120a" opacity="0.5" />)}
          {/* a superfície vista de cima e o menisco subindo no vidro */}
          <ellipse className="qpz-mx-tinta" cx={w / 2} cy={y0} rx={largo / 2} ry={6} fill={clarear(cor, 0.3)} style={{ opacity: litros === 0 ? 0 : Math.min(1, opacidade + 0.15) }} />
          <path d={`M${x0},${y0 - 6}Q${x0 + 3},${y0} ${x0 + 14},${y0 + 1}M${x1},${y0 - 6}Q${x1 - 3},${y0} ${x1 - 14},${y0 + 1}`} fill="none" stroke="#fff" strokeOpacity={litros === 0 ? 0 : 0.6} strokeWidth="2.4" strokeLinecap="round" />
        </g>
        {/* os ingredientes no fundo (ficam lá, com ou sem líquido) */}
        {nomes.map((nome, k) => {
          const cx = x0 + largo * (0.22 + 0.56 * sorteio(nome, k))
          const cy = y1 - 10 - (k % 3) * 11
          return (
            <g key={`${nome}-${k}`}>
              <ellipse cx={cx} cy={cy} rx={9} ry={5} fill={corDoRecipiente([0, 0, 0, 0, 0], [nome], false)} transform={`rotate(${Math.round(sorteio(nome, k + 7) * 50 - 25)} ${cx} ${cy})`} />
              <ellipse cx={cx - 2} cy={cy - 2} rx={3} ry={1.4} fill="#fff" opacity="0.35" />
            </g>
          )
        })}
      </g>
      {/* o fio que cai (só no gesto do ponteiro; reduzido, nem aparece) */}
      <rect className={classes('qpz-mx-fio', recebendo !== null && 'is-correndo')} x={w / 2 - 5} y={-40} width={10} height={Math.max(12, y0 + desce + 40)} rx={5} fill={recebendo ?? TINTA_DA_TORNEIRA} />
      {/* as marcas de litro gravadas no vidro */}
      {Array.from({ length: Math.max(0, recipiente.capacidade - 1) }, (_, k) => {
        const y = y1 - ((k + 1) * alto) / recipiente.capacidade
        return <path key={k} d={`M${x1 - 16},${y.toFixed(1)}H${x1 - 3}`} stroke="#eaf6fa" strokeOpacity="0.4" strokeWidth="2" />
      })}
      {/* o vidro da frente: a borda e os dois brilhos verticais */}
      <rect x={x0 - 4} y={y0 - 6} width={largo + 8} height={alto + 10} rx={15} fill="none" stroke="#e6f4f8" strokeOpacity="0.5" strokeWidth="3" />
      <rect x={x0 + 7} y={y0 + 12} width={8} height={Math.max(0, alto - 34)} rx={4} fill="#fff" opacity="0.34" />
      <rect x={x1 - 13} y={y0 + 22} width={4} height={Math.max(0, alto * 0.55)} rx={2} fill="#fff" opacity="0.14" />
      {/* o aro de metal, com o bico, e o pé */}
      <path d={`M${w - 6},6L${w + 12},-2L${w + 9},12L${w - 6},${ARO_DO_RECIPIENTE - 4}Z`} fill={`url(#${id}-metal)`} />
      <rect x={0} y={0} width={w} height={ARO_DO_RECIPIENTE} rx={7} fill={`url(#${id}-metal)`} />
      <path d={`M3,${ARO_DO_RECIPIENTE - 2}H${w - 3}`} stroke="#000" strokeOpacity="0.35" strokeWidth="2" />
      <rect x={-5} y={h - PE_DO_RECIPIENTE} width={w + 10} height={PE_DO_RECIPIENTE} rx={9} fill={`url(#${id}-metal)`} />
      <path d={`M0,${h - PE_DO_RECIPIENTE + 2}H${w}`} stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />
    </svg>
  )
}
