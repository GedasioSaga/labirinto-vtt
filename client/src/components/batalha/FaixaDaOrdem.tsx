import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import type { RegrasDaBatalha } from '../../lib/batalha/regrasDoCampo'
import { CartaDaOrdem } from './CartaDaOrdem'
import type { DadosDaCarta, DadosDaFaixa, LinhaNaTela } from './dadosDaFaixa'
import { MenuDaCarta, type ItemDoMenuDaCarta } from './MenuDaCarta'
import { RegistroDaBatalha } from './RegistroDaBatalha'
import { RegrasDoCampoDialog } from './RegrasDoCampoDialog'
import './batalha.css'

/**
 * A FAIXA DA ORDEM DOS TURNOS (F1, seção 4 do plano; o `.ordem` do protótipo
 * aprovado): as cartas na ordem, com VEZ e A SEGUIR, e à direita o quadro
 * "Rodada R · Turno N/M", de quem é a vez e o "Depois". Em cima, "Regras do
 * campo" e "Registro", iguais para o mestre e o jogador.
 *
 * O MESTRE arrasta as cartas (Pointer Events: os vizinhos abrem espaço e o
 * traço mostra onde ela cai durante a pausa antes de soltar), move com
 * Alt + ← → com a carta em foco, cancela com Esc e abre o menu da carta no
 * clique (ou no botão direito). A troca de lugar anda por FLIP em
 * `cubic-bezier(0.77, 0, 0.175, 1)`, só `translate`; com movimento reduzido,
 * as cartas trocam na hora.
 *
 * Só desenha e avisa: a ordem nova, o menu e o "Passar a vez" vão a quem
 * monta (a store do mestre, ou o pedido do jogador ao host).
 */

export interface FaixaDaOrdemProps {
  papel: 'mestre' | 'jogador'
  dados: DadosDaFaixa
  /** Mestre: a carta foi para `indice` (arrasto ou Alt + setas). Ausente = a faixa não arrasta. */
  onMover?: (cartaId: string, indice: number) => void
  /** Mestre: os itens do menu da carta. Jogador: a carta com itens abre o menu em vez do perfil. */
  menuDaCarta?: (carta: DadosDaCarta) => readonly ItemDoMenuDaCarta[]
  /** Jogador: abre o perfil da carta dele ou de aliado (a "outro" não é clicável). */
  onAbrirPerfil?: (carta: DadosDaCarta) => void
  /** Jogador: a carta abre algo? Ausente = toda carta com personagem. Carta que não abre fica texto, não botão. */
  abrePerfil?: (carta: DadosDaCarta) => boolean
  /** Ausente = sem o botão (o jogador fora da vez). */
  onPassarVez?: () => void
  /** O "Passar a vez" foi pedido e não voltou (o jogador espera o host). */
  passandoVez?: boolean
  regras: RegrasDaBatalha | null
  registro: readonly LinhaNaTela[]
  onDesfazer: (linhaId: string) => void
  pendentes?: ReadonlySet<string>
  className?: string
  /** F3, mestre: o clique caiu num selo da carta (`data-selo`): abre editar e tirar no lugar do menu. */
  onSelo?: (carta: DadosDaCarta, seloId: string) => void
}

/** Arrastar só começa depois deste tanto: clique com a mão tremendo continua clique. */
const LIMIAR_DO_ARRASTO = 5
const TROCA_MS = 260
const VOLTA_MS = 180
const CURVA_DA_TROCA = 'cubic-bezier(0.77, 0, 0.175, 1)'
const CURVA_DA_VOLTA = 'cubic-bezier(0.23, 1, 0.32, 1)'
const VIZINHO_ABRINDO = `translate ${VOLTA_MS}ms ${CURVA_DA_VOLTA}`
/** Respiro em volta da carta da vez quando a fila rola até ela (o contorno de latão e a sombra). */
const FOLGA_DA_VEZ_PX = 4

/** Sem `matchMedia` (jsdom, WebView antiga) vale o movimento normal. Cópia do grimório, que o jogador não carrega. */
function movimentoReduzido(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

interface Arrasto {
  li: HTMLElement
  id: string
  pointerId: number
  x0: number
  ativo: boolean
  itens: HTMLElement[]
  rects: DOMRect[]
  deslocamentos: number[]
  de: number
  para: number
  dx: number
}

function cartasDa(lista: HTMLElement): HTMLElement[] {
  return Array.from(lista.querySelectorAll<HTMLElement>(':scope > .bt-carta'))
}

function moverVoltando(el: HTMLElement, dx: number): void {
  if (Math.abs(dx) <= 1 || movimentoReduzido()) return
  el.animate([{ translate: `${dx}px 0` }, { translate: '0 0' }], { duration: VOLTA_MS, easing: CURVA_DA_VOLTA })
}

export function FaixaDaOrdem({ papel, dados, onMover, menuDaCarta, onAbrirPerfil, abrePerfil, onPassarVez, passandoVez, regras, registro, onDesfazer, pendentes, className, onSelo }: FaixaDaOrdemProps) {
  const doMestre = papel === 'mestre'
  const arrasta = doMestre && onMover !== undefined
  const tituloId = useId()
  const registroId = useId()
  const caixa = useRef<HTMLDivElement>(null)
  const lista = useRef<HTMLOListElement>(null)
  const encaixe = useRef<HTMLDivElement>(null)
  const arrasto = useRef<Arrasto | null>(null)
  const cliqueEngolido = useRef(false)
  const [menu, setMenu] = useState<{ cartaId: string; ancora: HTMLElement } | null>(null)
  const [regrasAbertas, setRegrasAbertas] = useState(false)
  const [registroAberto, setRegistroAberto] = useState(false)

  // FLIP: onde cada carta estava no último desenho (ou onde ela foi solta).
  const ordem = dados.cartas.map((carta) => carta.id).join('|')
  const ordemAnterior = useRef(ordem)
  const posicoes = useRef(new Map<string, number>())
  const posicoesDaSoltura = useRef<Map<string, number> | null>(null)
  const focoDepois = useRef<string | null>(null)

  useLayoutEffect(() => {
    const ol = lista.current
    if (!ol) return
    const mudou = ordemAnterior.current !== ordem
    ordemAnterior.current = ordem
    const antes = posicoesDaSoltura.current ?? posicoes.current
    posicoesDaSoltura.current = null
    // Alt + setas (teclado) não anima: a troca vale na hora, como todo atalho; só o arrasto e a mudança vinda de fora deslizam.
    const animar = mudou && !movimentoReduzido() && focoDepois.current === null
    const novas = new Map<string, number>()
    for (const el of cartasDa(ol)) {
      const id = el.dataset.id ?? ''
      const agora = el.offsetLeft
      novas.set(id, agora)
      const antigo = antes.get(id)
      if (!animar || antigo === undefined || Math.abs(antigo - agora) <= 1) continue
      el.animate([{ translate: `${antigo - agora}px 0` }, { translate: '0 0' }], { duration: TROCA_MS, easing: CURVA_DA_TROCA })
    }
    posicoes.current = novas
    // Alt + setas: a carta continua com o foco depois de trocar de lugar no DOM.
    const focar = focoDepois.current
    focoDepois.current = null
    if (focar !== null) ol.querySelector<HTMLElement>(`.bt-carta[data-id="${CSS.escape(focar)}"] .bt-carta__corpo`)?.focus({ preventScroll: false })
  })

  // A vez andou (ou a faixa abriu): a carta da vez fica à vista. Só a fila de cartas
  // rola, nunca a página; a carta já inteira na janela não mexe nada.
  const vezAgora = dados.vez
  useEffect(() => {
    const ol = lista.current
    if (ol === null || vezAgora === null) return
    const carta = ol.querySelector<HTMLElement>(`.bt-carta[data-id="${CSS.escape(vezAgora)}"]`)
    if (carta === null) return
    const inicio = carta.offsetLeft - FOLGA_DA_VEZ_PX
    const fim = carta.offsetLeft + carta.offsetWidth + FOLGA_DA_VEZ_PX
    const destino = inicio < ol.scrollLeft ? inicio : fim > ol.scrollLeft + ol.clientWidth ? fim - ol.clientWidth : null
    if (destino === null || Math.max(0, destino) === ol.scrollLeft) return
    // Sem `scrollTo` no elemento (jsdom): o pulo seco.
    if (typeof ol.scrollTo !== 'function') ol.scrollLeft = Math.max(0, destino)
    else ol.scrollTo({ left: Math.max(0, destino), behavior: movimentoReduzido() ? 'auto' : 'smooth' })
  }, [vezAgora, ordem])

  // A carta do menu saiu da ordem (outro tirou, desfez): o menu fecha.
  const cartaDoMenu = menu === null ? undefined : dados.cartas.find((carta) => carta.id === menu.cartaId)
  useEffect(() => {
    if (menu !== null && cartaDoMenu === undefined) setMenu(null)
  }, [menu, cartaDoMenu])

  const aoApertar = (evento: PointerEvent<HTMLOListElement>) => {
    if (!arrasta || evento.button !== 0 || arrasto.current !== null || !lista.current) return
    const li = evento.target instanceof Element ? evento.target.closest<HTMLElement>('.bt-carta') : null
    if (li === null || li.parentElement !== lista.current) return
    const itens = cartasDa(lista.current)
    const de = itens.indexOf(li)
    arrasto.current = {
      li,
      id: li.dataset.id ?? '',
      pointerId: evento.pointerId,
      x0: evento.clientX,
      ativo: false,
      itens,
      rects: itens.map((item) => item.getBoundingClientRect()),
      deslocamentos: itens.map(() => 0),
      de,
      para: de,
      dx: 0,
    }
  }

  const aoMover = (evento: PointerEvent<HTMLOListElement>) => {
    const a = arrasto.current
    if (a === null || evento.pointerId !== a.pointerId) return
    const dx = evento.clientX - a.x0
    if (!a.ativo) {
      if (Math.abs(dx) < LIMIAR_DO_ARRASTO) return
      a.ativo = true
      a.li.setPointerCapture(evento.pointerId)
      a.li.classList.add('bt-carta--arrastando')
      a.li.style.setProperty('transition', 'none')
      setMenu(null)
    }
    a.dx = dx
    a.li.style.setProperty('translate', `${dx}px 0`)
    const daCarta = a.rects[a.de]
    if (daCarta === undefined) return
    const meio = daCarta.left + daCarta.width / 2 + dx
    let para = 0
    a.rects.forEach((r, i) => {
      if (i !== a.de && meio > r.left + r.width / 2) para += 1
    })
    a.para = para
    const primeiro = a.rects[0]
    const segundo = a.rects[1]
    const passo = primeiro !== undefined && segundo !== undefined ? segundo.left - primeiro.left : 0
    a.itens.forEach((el, i) => {
      if (el === a.li) return
      let desloc = 0
      if (a.de < para && i > a.de && i <= para) desloc = -passo
      if (a.de > para && i >= para && i < a.de) desloc = passo
      a.deslocamentos[i] = desloc
      el.style.setProperty('transition', VIZINHO_ABRINDO)
      el.style.setProperty('translate', `${desloc}px 0`)
    })
    // O traço do encaixe: na frente da carta que vai ceder o lugar (ou depois dela, andando para a direita).
    const alvo = a.rects[para]
    const base = caixa.current?.getBoundingClientRect().left ?? 0
    if (encaixe.current && alvo !== undefined) {
      encaixe.current.style.left = `${(para > a.de ? alvo.right + 8 : alvo.left) - base}px`
      encaixe.current.dataset.ativo = para === a.de ? 'nao' : 'sim'
    }
  }

  const soltar = (cancelar: boolean) => {
    const a = arrasto.current
    arrasto.current = null
    if (encaixe.current) encaixe.current.dataset.ativo = 'nao'
    if (a === null || !a.ativo) return
    // O clique que o navegador manda depois de soltar não abre o menu.
    cliqueEngolido.current = true
    window.setTimeout(() => {
      cliqueEngolido.current = false
    }, 0)
    a.li.classList.remove('bt-carta--arrastando')
    const visuais = new Map(a.itens.map((el, i) => [el.dataset.id ?? '', el.offsetLeft + (el === a.li ? a.dx : (a.deslocamentos[i] ?? 0))]))
    for (const el of a.itens) {
      el.style.setProperty('transition', 'none')
      el.style.removeProperty('translate')
    }
    requestAnimationFrame(() => {
      for (const el of a.itens) el.style.removeProperty('transition')
    })
    if (cancelar || a.para === a.de) {
      // Fora de destino (ou Esc): tudo volta ao lugar, com animação curta.
      a.itens.forEach((el, i) => moverVoltando(el, el === a.li ? a.dx : (a.deslocamentos[i] ?? 0)))
      return
    }
    posicoesDaSoltura.current = visuais
    onMover?.(a.id, a.para)
  }

  const teclar = (evento: KeyboardEvent<HTMLOListElement>) => {
    if (evento.key === 'Escape' && arrasto.current?.ativo) {
      evento.preventDefault()
      evento.stopPropagation()
      soltar(true)
      return
    }
    if (!arrasta || !evento.altKey || (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight')) return
    const li = evento.target instanceof Element ? evento.target.closest<HTMLElement>('.bt-carta') : null
    const id = li?.dataset.id
    if (id === undefined) return
    // A seta é da faixa: o mapa (que ouve no `window`) não empurra a seleção junto.
    evento.preventDefault()
    evento.stopPropagation()
    const indice = dados.cartas.findIndex((carta) => carta.id === id)
    const para = Math.max(0, Math.min(dados.cartas.length - 1, indice + (evento.key === 'ArrowRight' ? 1 : -1)))
    if (indice < 0 || para === indice) return
    focoDepois.current = id
    onMover?.(id, para)
  }

  // O mestre tem menu em toda carta; o jogador, só na carta que traz itens (F2: "Me dar dano" na dele).
  const comMenu = (carta: DadosDaCarta) => menuDaCarta !== undefined && (doMestre || menuDaCarta(carta).length > 0)
  const clicar = (carta: DadosDaCarta, evento: MouseEvent<HTMLButtonElement>) => {
    if (cliqueEngolido.current) return
    // F3: o selo da carta do mestre abre editar e tirar (pelo teclado, os selos ficam no menu da carta).
    const selo = onSelo === undefined || !(evento.target instanceof Element) ? null : evento.target.closest<HTMLElement>('[data-selo]')
    const seloId = selo?.dataset.selo
    if (onSelo !== undefined && seloId !== undefined && seloId !== '') {
      setMenu(null)
      onSelo(carta, seloId)
      return
    }
    if (comMenu(carta)) {
      const ancora = evento.currentTarget
      setMenu((aberto) => (aberto?.cartaId === carta.id ? null : { cartaId: carta.id, ancora }))
      return
    }
    onAbrirPerfil?.(carta)
  }

  const cartaDaVez = dados.vez === null ? undefined : dados.cartas.find((carta) => carta.id === dados.vez)
  const quem = dados.minhaVez ? 'Sua vez' : cartaDaVez !== undefined ? cartaDaVez.nome : dados.vezForaDaVista ? 'Vez de alguém fora da sua vista' : 'Ninguém na vez'
  const anuncio = dados.minhaVez ? 'Sua vez' : cartaDaVez !== undefined ? `Vez de ${cartaDaVez.nome}` : dados.vezForaDaVista ? 'Vez de alguém fora da sua vista' : ''
  const estiloDoQuadro = cartaDaVez?.cor ? ({ '--lado': cartaDaVez.cor } as CSSProperties) : undefined
  const itensDoMenu = cartaDoMenu === undefined || menuDaCarta === undefined ? [] : menuDaCarta(cartaDoMenu)

  return (
    <section className={className === undefined ? 'bt-faixa' : `bt-faixa ${className}`} aria-labelledby={tituloId}>
      <div className="bt-faixa__esq">
        <div className="bt-faixa__cab">
          <h2 className="bt-faixa__titulo" id={tituloId}>
            Ordem dos turnos ({dados.cartas.length})
          </h2>
          <button type="button" className="bt-botao bt-botao--p" aria-haspopup="dialog" onClick={() => setRegrasAbertas(true)}>
            Regras do campo
          </button>
          <button
            type="button"
            className="bt-botao bt-botao--p"
            aria-expanded={registroAberto}
            aria-controls={registroId}
            onClick={() => setRegistroAberto((aberto) => !aberto)}
          >
            Registro
          </button>
        </div>
        {dados.cartas.length === 0 ? (
          <p className="bt-faixa__vazia">
            {doMestre ? 'Ninguém na ordem. Inclua um combatente pelo painel da batalha, no livro da mesa.' : 'Nenhum combatente à sua vista.'}
          </p>
        ) : (
          <div ref={caixa} className="bt-cartas-caixa">
            <ol
              ref={lista}
              className="bt-cartas"
              aria-label="Ordem dos turnos"
              data-arrasta={arrasta ? 'sim' : 'nao'}
              onPointerDown={aoApertar}
              onPointerMove={aoMover}
              onPointerUp={() => soltar(false)}
              onPointerCancel={() => soltar(true)}
              onLostPointerCapture={() => soltar(false)}
              onKeyDown={teclar}
            >
              {dados.cartas.map((carta, indice) => {
                const temMenu = comMenu(carta)
                const clicavel = doMestre ? menuDaCarta !== undefined : temMenu || (onAbrirPerfil !== undefined && carta.personagemId !== null && (abrePerfil?.(carta) ?? true))
                return (
                  <CartaDaOrdem
                    key={carta.id}
                    carta={carta}
                    posicao={indice + 1}
                    vez={carta.id === dados.vez}
                    proxima={carta.id === dados.proxima}
                    doMestre={doMestre}
                    rotuloDoClique={temMenu ? 'Abre o menu da carta' : carta.minha ? 'Abre a sua ficha' : 'Abre o perfil'}
                    onClique={clicavel ? (evento) => clicar(carta, evento) : undefined}
                    onMenuDeContexto={
                      temMenu && clicavel
                        ? (evento) => {
                            evento.preventDefault()
                            setMenu({ cartaId: carta.id, ancora: evento.currentTarget })
                          }
                        : undefined
                    }
                    menuAberto={temMenu && clicavel ? menu?.cartaId === carta.id : undefined}
                  />
                )
              })}
            </ol>
            <div ref={encaixe} className="bt-encaixe" data-ativo="nao" aria-hidden="true" />
          </div>
        )}
        {arrasta && dados.cartas.length > 1 && <p className="bt-faixa__dica">Arraste uma carta para mudar a ordem · com a carta em foco, Alt + ← → move · clique abre o menu</p>}
      </div>
      <div className="bt-turno" style={estiloDoQuadro}>
        <span className="bt-turno__rodada">Rodada {dados.rodada}</span>
        <span className="bt-turno__num">
          Turno {dados.turno.n}
          <small>/{dados.turno.m}</small>
        </span>
        <span className="bt-turno__quem" data-fora={cartaDaVez === undefined ? 'sim' : 'nao'}>
          ▸ {quem}
        </span>
        {dados.depois !== null && <span className="bt-turno__depois">{dados.depois}</span>}
        {onPassarVez !== undefined && (
          <button type="button" className="bt-botao bt-botao--batalha" disabled={passandoVez} onClick={onPassarVez}>
            {passandoVez ? 'Passando…' : 'Passar a vez'}
          </button>
        )}
        <span className="bt-sr" aria-live="polite">
          {anuncio}
        </span>
      </div>
      {registroAberto && (
        <div className="bt-faixa__registro" id={registroId}>
          <RegistroDaBatalha linhas={registro} onDesfazer={onDesfazer} pendentes={pendentes} />
        </div>
      )}
      {menu !== null && cartaDoMenu !== undefined && itensDoMenu.length > 0 && (
        <MenuDaCarta ancora={menu.ancora} rotulo={`Carta de ${cartaDoMenu.nome}`} itens={itensDoMenu} onFechar={() => setMenu(null)} />
      )}
      {regrasAbertas && <RegrasDoCampoDialog regras={regras} doMestre={doMestre} onFechar={() => setRegrasAbertas(false)} />}
    </section>
  )
}
