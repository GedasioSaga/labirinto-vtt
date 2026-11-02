import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { ImagemOuIniciais } from '../../FichaPecas'
import { MenuDaCarta, type ItemDoMenuDaCarta } from '../../batalha/MenuDaCarta'
import '../../batalha/batalha.css'
import '../ficha/fichaDBT.css'
import './batalhaDBT.css'
import { NOME_DA_SITUACAO, NOME_DO_VOO } from './dadosDaBatalhaDBT'
import type { CartaNaFaixaDBT, DadosDaFaixaDBT, RecursoNaFaixaDBT } from './dadosDaFaixaDBT'
import { RegistroDBT, type LinhaNaTelaDBT } from './RegistroDBT'

/**
 * A FAIXA DA ORDEM DOS TURNOS NO MAPA, Dragon Ball (seção 19): o mesmo
 * desenho da faixa do One Piece (`bt-faixa`, `bt-carta`, o quadro da rodada)
 * com o que a carta DBT tem: PV e Ki, a forma, o voo, as condições, a
 * situação (salvaguarda, inconsciente, morto) e a iniciativa. Sem "Regras do
 * campo": o Dragon Ball não tem.
 *
 * O MESTRE arrasta as cartas (Pointer Events: os vizinhos abrem espaço e o
 * traço mostra onde ela cai durante a pausa antes de soltar), move com
 * Alt + ← → com a carta em foco, cancela com Esc e abre o menu no clique (ou
 * no botão direito). A troca de lugar anda por FLIP em
 * `cubic-bezier(0.77, 0, 0.175, 1)`, só `translate`; com movimento reduzido,
 * as cartas trocam na hora. O JOGADOR abre o perfil da carta que tem
 * personagem (a dele); a carta de outro lado fica texto.
 *
 * Só desenha e avisa: quem monta chama a store (mestre) ou o host (jogador).
 */

export interface FaixaDaOrdemDBTProps {
  papel: 'mestre' | 'jogador'
  dados: DadosDaFaixaDBT
  /** Mestre: a carta foi para `indice` (arrasto ou Alt + setas). Ausente = a faixa não arrasta. */
  onMover?: (cartaId: string, indice: number) => void
  /** Mestre: os itens do menu da carta. */
  menuDaCarta?: (carta: CartaNaFaixaDBT) => readonly ItemDoMenuDaCarta[]
  /** Jogador: abre o perfil da carta com personagem. */
  onAbrirPerfil?: (carta: CartaNaFaixaDBT) => void
  /** Ausente = sem o botão (fora da vez, ou fase da iniciativa). */
  onPassarVez?: () => void
  passandoVez?: boolean
  registro: readonly LinhaNaTelaDBT[]
  onDesfazer?: (linhaId: string) => void
  /** O Desfazer pedido e ainda sem resposta. */
  desfazendo?: string | null
  /** A última recusa (do motor ou do host), escrita sob as cartas. */
  aviso?: string | null
  className?: string
}

/** Arrastar só começa depois deste tanto: clique com a mão tremendo continua clique. */
const LIMIAR_DO_ARRASTO = 5
const TROCA_MS = 260
const VOLTA_MS = 180
const CURVA_DA_TROCA = 'cubic-bezier(0.77, 0, 0.175, 1)'
const CURVA_DA_VOLTA = 'cubic-bezier(0.23, 1, 0.32, 1)'
const VIZINHO_ABRINDO = `translate ${VOLTA_MS}ms ${CURVA_DA_VOLTA}`
/** Respiro em volta da carta da vez quando a fila rola até ela. */
const FOLGA_DA_VEZ_PX = 4
/** O brilho da carta quando a forma liga: `brightness` 1,8 → 1. */
const BRILHO_DA_FORMA_MS = 600

/** Sem `matchMedia` (jsdom, WebView antiga) vale o movimento normal. */
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

const numero = new Intl.NumberFormat('pt-BR')

function Barra({ rotulo, tom, recurso }: { rotulo: string; tom: 'vida' | 'energia'; recurso: RecursoNaFaixaDBT }) {
  const proporcao = recurso.max > 0 ? Math.max(0, Math.min(1, recurso.atual / recurso.max)) : 0
  const escala = { transform: `scaleX(${proporcao.toFixed(4)})` }
  return (
    <>
      <span className="bt-carta__linha">
        <b data-tom={tom}>{rotulo}</b>
        <span className="bt-carta__num">
          {numero.format(recurso.atual)}/{numero.format(recurso.max)}
        </span>
      </span>
      <span className="bt-barra" data-tom={tom} aria-hidden="true">
        <b style={escala} />
        <i style={escala} />
      </span>
    </>
  )
}

/** O que o leitor de tela diz da carta, numa frase. */
export function descricaoDaCartaDBT(carta: CartaNaFaixaDBT, posicao: number, vez: boolean, proxima: boolean): string {
  const partes = [`${posicao}º ${carta.nome}`]
  if (carta.lado !== null) partes.push(`lado ${carta.lado}`)
  if (vez) partes.push('é a vez')
  else if (proxima) partes.push('a seguir')
  if (carta.iniciativa !== null) partes.push(`iniciativa ${carta.iniciativa}`)
  if (carta.vida === 'numeros' && carta.pv !== null) partes.push(`PV ${carta.pv.atual} de ${carta.pv.max}`)
  if (carta.vida === 'numeros' && carta.pk !== null) partes.push(`Ki ${carta.pk.atual} de ${carta.pk.max}`)
  if (carta.vida === 'oculta') partes.push('PV e Ki ocultos')
  if (carta.vida === 'manual') partes.push('sem ficha Dragon Ball, resolvido à mão')
  if (carta.transformacao !== null) partes.push(`em ${carta.transformacao}`)
  if (carta.voo > 0) partes.push(NOME_DO_VOO[carta.voo])
  for (const condicao of carta.condicoes) partes.push(condicao.nome)
  if (carta.agarrado) partes.push('agarrado')
  if (carta.situacao !== 'de-pe') partes.push(NOME_DA_SITUACAO[carta.situacao])
  if (carta.perdeTurno !== null) partes.push(`perde o próximo turno: ${carta.perdeTurno}`)
  return partes.join(', ')
}

interface CartaDaFaixaDBTProps {
  carta: CartaNaFaixaDBT
  posicao: number
  vez: boolean
  proxima: boolean
  rotuloDoClique?: string
  onClique?: (evento: MouseEvent<HTMLButtonElement>) => void
  onMenuDeContexto?: (evento: MouseEvent<HTMLButtonElement>) => void
  menuAberto?: boolean
}

function CartaDaFaixaDBT({ carta, posicao, vez, proxima, rotuloDoClique, onClique, onMenuDeContexto, menuAberto }: CartaDaFaixaDBTProps) {
  const estilo = carta.cor === null ? undefined : ({ '--lado': carta.cor } as CSSProperties)
  const descricao = descricaoDaCartaDBT(carta, posicao, vez, proxima)
  const forma = carta.transformacao
  const caiu = carta.situacao !== 'de-pe'

  // A forma ligou (não na montagem): a carta acende e apaga. Movimento reduzido: só o contorno.
  const corpo = useRef<HTMLElement | null>(null)
  const formaAntes = useRef(forma)
  useEffect(() => {
    const antes = formaAntes.current
    formaAntes.current = forma
    if (forma === null || forma === antes || movimentoReduzido()) return
    corpo.current?.animate([{ filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: BRILHO_DA_FORMA_MS, easing: CURVA_DA_VOLTA })
  }, [forma])
  const guardarCorpo = (elemento: HTMLElement | null) => {
    corpo.current = elemento
  }

  const miolo = (
    <>
      {vez ? (
        <span className="bt-carta__fita bt-carta__fita--vez" aria-hidden="true">
          VEZ
        </span>
      ) : (
        proxima && (
          <span className="bt-carta__fita bt-carta__fita--seguir" aria-hidden="true">
            A SEGUIR
          </span>
        )
      )}
      <span className="bt-carta__topo">
        <span className="bt-carta__retrato">
          <ImagemOuIniciais imagem={carta.imagem} nome={carta.nome} />
        </span>
        <span className="bt-carta__nome" title={carta.nome}>
          {carta.nome}
        </span>
        <span className="bt-carta__pos">{posicao}</span>
      </span>
      {forma !== null && (
        <span className="bt-carta__forma" title={forma}>
          {forma}
        </span>
      )}
      {carta.vida === 'numeros' && carta.pv !== null && <Barra rotulo="PV" tom="vida" recurso={carta.pv} />}
      {carta.vida === 'numeros' && carta.pk !== null && <Barra rotulo="Ki" tom="energia" recurso={carta.pk} />}
      {carta.vida === 'oculta' && <span className="bt-carta__oculta">PV e Ki ocultos</span>}
      {carta.vida === 'manual' && <span className="bt-carta__oculta">Sem ficha DBT: à mão</span>}
      {(carta.condicoes.length > 0 || carta.voo > 0 || carta.agarrado) && (
        <span className="bt-carta__selos" aria-hidden="true">
          {carta.voo > 0 && (
            <span className="bt-selo dbb-fx-selo dbb-fx-selo--voo" title={`${NOME_DO_VOO[carta.voo]} (níveis 1 a 3)`}>
              {NOME_DO_VOO[carta.voo]}
            </span>
          )}
          {carta.agarrado && (
            <span className="bt-selo dbb-fx-selo" title="Agarrado">
              Agarrado
            </span>
          )}
          {carta.condicoes.map((condicao) => (
            <span key={condicao.id} className="bt-selo dbb-fx-selo" title={condicao.nome}>
              {condicao.nome}
            </span>
          ))}
        </span>
      )}
      <span className="bt-carta__marcas" aria-hidden="true">
        {carta.lado !== null && <span className="bt-marca bt-marca--equipe">{carta.lado}</span>}
        {carta.iniciativa !== null && (
          <span className="bt-marca dbb-fx-ini" title="Iniciativa (d20 + DES + EP)">
            Ini {carta.iniciativa}
          </span>
        )}
        {caiu && <span className="bt-marca dbb-fx-caiu">{NOME_DA_SITUACAO[carta.situacao]}</span>}
        {carta.perdeTurno !== null && (
          <span className="bt-marca" title={carta.perdeTurno}>
            perde a vez
          </span>
        )}
      </span>
    </>
  )
  return (
    <li
      className="bt-carta"
      data-id={carta.id}
      data-vez={vez ? 'sim' : 'nao'}
      data-proxima={proxima ? 'sim' : 'nao'}
      data-caiu={caiu ? 'sim' : 'nao'}
      data-forma={forma === null ? undefined : 'sim'}
      style={estilo}
    >
      {onClique === undefined ? (
        <div ref={guardarCorpo} className="bt-carta__corpo" aria-label={descricao} role="group">
          {miolo}
        </div>
      ) : (
        <button
          ref={guardarCorpo}
          type="button"
          className="bt-carta__corpo"
          aria-label={`${descricao}. ${rotuloDoClique ?? ''}`.trim()}
          aria-haspopup={menuAberto === undefined ? undefined : 'menu'}
          aria-expanded={menuAberto}
          onClick={onClique}
          onContextMenu={onMenuDeContexto}
        >
          {miolo}
        </button>
      )}
    </li>
  )
}

export function FaixaDaOrdemDBT({ papel, dados, onMover, menuDaCarta, onAbrirPerfil, onPassarVez, passandoVez, registro, onDesfazer, desfazendo = null, aviso = null, className }: FaixaDaOrdemDBTProps) {
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
    // Alt + setas (teclado) não anima: a troca vale na hora; só o arrasto e a mudança vinda de fora deslizam.
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

  // A vez andou (ou a faixa abriu): a carta da vez fica à vista. Só a fila rola, nunca a página.
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
    if (typeof ol.scrollTo !== 'function') ol.scrollLeft = Math.max(0, destino)
    else ol.scrollTo({ left: Math.max(0, destino), behavior: movimentoReduzido() ? 'auto' : 'smooth' })
  }, [vezAgora, ordem])

  // A carta do menu saiu da ordem (tirada, desfeita): o menu fecha.
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

  const comMenu = doMestre && menuDaCarta !== undefined
  const abre = (carta: CartaNaFaixaDBT) => comMenu || (onAbrirPerfil !== undefined && carta.personagemId !== null)
  const clicar = (carta: CartaNaFaixaDBT, evento: MouseEvent<HTMLButtonElement>) => {
    if (cliqueEngolido.current) return
    if (comMenu) {
      const ancora = evento.currentTarget
      setMenu((aberto) => (aberto?.cartaId === carta.id ? null : { cartaId: carta.id, ancora }))
      return
    }
    onAbrirPerfil?.(carta)
  }

  const cartaDaVez = dados.vez === null ? undefined : dados.cartas.find((carta) => carta.id === dados.vez)
  const iniciativa = dados.fase === 'iniciativa'
  const quem = iniciativa
    ? doMestre
      ? 'Declarar formas e rolar'
      : 'Esperando a iniciativa'
    : dados.minhaVez
      ? 'Sua vez'
      : cartaDaVez !== undefined
        ? cartaDaVez.nome
        : dados.vezForaDaVista
          ? 'Vez de alguém fora da sua vista'
          : 'Ninguém na vez'
  const anuncio = iniciativa ? '' : dados.minhaVez ? 'Sua vez' : cartaDaVez !== undefined ? `Vez de ${cartaDaVez.nome}` : dados.vezForaDaVista ? 'Vez de alguém fora da sua vista' : ''
  const estiloDoQuadro = cartaDaVez?.cor ? ({ '--lado': cartaDaVez.cor } as CSSProperties) : undefined
  const itensDoMenu = cartaDoMenu === undefined || menuDaCarta === undefined ? [] : menuDaCarta(cartaDoMenu)

  return (
    <section className={className === undefined ? 'bt-faixa dbb-fx' : `bt-faixa dbb-fx ${className}`} aria-labelledby={tituloId}>
      <div className="bt-faixa__esq">
        <div className="bt-faixa__cab">
          <h2 className="bt-faixa__titulo" id={tituloId}>
            Ordem dos turnos ({dados.cartas.length})
          </h2>
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
          <p className="bt-faixa__vazia">{doMestre ? 'Ninguém na ordem. Inclua um combatente pelo painel da batalha, no livro da mesa.' : 'Nenhum combatente à sua vista.'}</p>
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
                const clicavel = abre(carta)
                return (
                  <CartaDaFaixaDBT
                    key={carta.id}
                    carta={carta}
                    posicao={indice + 1}
                    vez={carta.id === dados.vez}
                    proxima={carta.id === dados.proxima}
                    rotuloDoClique={comMenu ? 'Abre o menu da carta' : 'Abre o perfil'}
                    onClique={clicavel ? (evento) => clicar(carta, evento) : undefined}
                    onMenuDeContexto={
                      comMenu
                        ? (evento) => {
                            evento.preventDefault()
                            setMenu({ cartaId: carta.id, ancora: evento.currentTarget })
                          }
                        : undefined
                    }
                    menuAberto={comMenu ? menu?.cartaId === carta.id : undefined}
                  />
                )
              })}
            </ol>
            <div ref={encaixe} className="bt-encaixe" data-ativo="nao" aria-hidden="true" />
          </div>
        )}
        {aviso !== null && (
          <p className="dbb-fx-aviso" role="status">
            {aviso}
          </p>
        )}
        {arrasta && dados.cartas.length > 1 && <p className="bt-faixa__dica">Arraste uma carta para mudar a ordem · com a carta em foco, Alt + ← → move · clique abre o menu</p>}
      </div>
      <div className="bt-turno" style={estiloDoQuadro}>
        <span className="bt-turno__rodada">{iniciativa ? 'Iniciativa' : `Rodada ${dados.rodada}`}</span>
        {iniciativa ? (
          <span className="bt-turno__num">—</span>
        ) : (
          <span className="bt-turno__num">
            Turno {dados.turno.n}
            <small>/{dados.turno.m}</small>
          </span>
        )}
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
          <div className="dbf dbb-fx-registro">
            <RegistroDBT linhas={registro} onDesfazer={onDesfazer} desfazendo={desfazendo} />
          </div>
        </div>
      )}
      {menu !== null && cartaDoMenu !== undefined && itensDoMenu.length > 0 && (
        <MenuDaCarta ancora={menu.ancora} rotulo={`Carta de ${cartaDoMenu.nome}`} itens={itensDoMenu} onFechar={() => setMenu(null)} />
      )}
    </section>
  )
}
