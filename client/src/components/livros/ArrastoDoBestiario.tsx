import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ehVariacao, idDaFamilia, podeVirarVariacaoDe, soltarDoModelo, variacoesDe, virarVariacaoDe, virarVariacaoTrocaAFicha } from '../../lib/livros/combate'
import type { Personagem } from '../../lib/personagem'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { gravarNoMundo, Retrato, trocarFicha } from './comum'
import { IconeDoMundo } from './icones'

/**
 * ARRASTAR NPC PARA DENTRO DE OUTRO no bestiário (pedido de 23/11/2026:
 * "porque não consigo puxar o cavaleiro de escudo para dentro do cavaleiro
 * com clava?"). Vale para as duas páginas de NPCs de combate, a padrão e a do
 * Dragon Ball, que têm a mesma lista "Modelos e variações".
 *
 *  - NPC único ou variação solto sobre outra linha vira VARIAÇÃO da família
 *    dela (a linha de uma variação conta como o modelo dela). NPC único sobre
 *    NPC único: o alvo vira o modelo dos dois.
 *  - Variação solta em "Soltar do modelo" (aparece no fim da lista durante o
 *    gesto) ou no vazio do cartão da lista vira NPC único.
 *  - Modelo com variações não arrasta: as variações dele ficariam sem lugar.
 *  - Fora de alvo (ou Esc): o fantasma volta para a linha e nada muda.
 *
 * O gesto segue o da linha de ficha (`useArrastoDaLinha`): ouvintes de janela
 * só durante o aperto, 6 px entre clique e arrasto, Esc desiste, o `click` do
 * soltar não escolhe o NPC. Durante o gesto só o fantasma e as marcas de alvo
 * mudam (estilo e atributo direto no elemento): a lista re-renderiza uma vez
 * ao começar e uma ao terminar. Quem grava é o funil de sempre
 * (`gravarNoMundo`), com o aviso e o Desfazer dele.
 *
 * A variação não guarda ficha própria (`sincronizarVariacoes` copia a do
 * modelo): quando os golpes, as armas ou os atributos do NPC são outros, a
 * troca pergunta ANTES (`PerguntaAntesDeVirarVariacao`), no arrasto e no
 * "Mover para o modelo…". Ficha igual à do modelo: grava sem perguntar.
 */

/** Quanto o ponteiro anda (px) antes de o aperto virar arrasto; abaixo disso é clique. */
const LIMIAR_DO_ARRASTO_PX = 6
/** A volta do fantasma para a linha quando o soltar não muda nada. */
const VOLTA_DO_FANTASMA_MS = 200
/** O brilho da linha no lugar novo, para o olho achar onde ela caiu (o mesmo `--ease-out` forte da casa). */
const POUSO_MS = 1200
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
/**
 * O fantasma anda ao lado do ponteiro, um pouco abaixo e à direita, e não por
 * cima dele: as linhas têm a altura do fantasma, e colado no ponto da pega ele
 * tapava a linha-alvo e o realce dela (prova de 23/11/2026).
 */
const FANTASMA_AO_LADO = { x: 14, y: 10 }
/** A saída da pergunta (a mesma do "Novo NPC", `.mu-modal-fundo--saindo`). */
const SAIDA_DA_PERGUNTA_MS = 150
/** O que recebe o foco na prisão do Tab da pergunta (só os dois botões dela). */
const FOCAVEIS_DA_PERGUNTA = 'button:not([disabled])'

/** O `id` do NPC da linha (o `<li>`). */
const ATRIBUTO_DO_NPC = 'data-bes-npc'
/** O modelo da família da linha: o próprio NPC, ou o modelo da variação. */
const ATRIBUTO_DA_FAMILIA = 'data-bes-familia'
/** O cartão da lista: soltar a variação no vazio dele também solta do modelo. */
const ATRIBUTO_DA_LISTA = 'data-bes-lista'
/** A faixa "Soltar do modelo" do fim da lista. */
const ATRIBUTO_DO_SOLTAR = 'data-bes-soltar'
/** O alvo aceso agora: `modelo` (a linha do modelo da família) ou `soltar` (a faixa). */
const ATRIBUTO_DO_ALVO = 'data-bes-alvo'

export type DestinoNoBestiario = { tipo: 'modelo'; modelo: Personagem } | { tipo: 'soltar' }

interface AlvoNaTela {
  destino: DestinoNoBestiario
  el: HTMLElement
}

interface ApertoNaLinha {
  personagem: Personagem
  /** A lista no momento do aperto: o gesto decide os alvos por ela. */
  deCombate: readonly Personagem[]
  pointerId: number
  inicio: { x: number; y: number }
  /** A linha de onde saiu: o fantasma volta para ela quando nada muda. */
  linha: HTMLElement
  arrastando: boolean
}

function movimentoReduzido(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** O NPC e o modelo dele, pelo nome curto: "Cavaleiro com Clava". */
function nomeDoModelo(personagem: Personagem, deCombate: readonly Personagem[]): string {
  const modeloId = personagem.combate?.modeloId
  return deCombate.find((candidato) => candidato.id === modeloId)?.nome ?? 'o modelo'
}

/**
 * Grava "virou variação" pelo funil do mundo, com o Desfazer que devolve a
 * ficha inteira de antes (a ficha da variação passa a seguir o modelo; sem a
 * cópia de antes, o Desfazer não teria de onde tirar a dela).
 */
export function virarVariacaoNoMundo(personagem: Personagem, modelo: Personagem): Promise<boolean> {
  const antes = personagem
  return gravarNoMundo((lista) => virarVariacaoDe(lista, antes.id, modelo.id), {
    texto: `${antes.nome} virou variação de ${modelo.nome}: a ficha agora segue o modelo.`,
    desfazer: (lista) => trocarFicha(lista, antes.id, () => antes),
  })
}

/** A troca que espera o "Virar variação" da pergunta. */
interface PedidoDeVariacao {
  personagem: Personagem
  /** O modelo da família de destino (o alvo que é variação já chega como o modelo dela). */
  modelo: Personagem
  /** O alvo era NPC único: os dois viram uma família, com ele de modelo. */
  viraFamilia: boolean
}

/**
 * A troca pede pergunta antes? Só quando a ficha do NPC some
 * (`virarVariacaoTrocaAFicha`); `null` = grava direto.
 */
function pedidoQuePergunta(personagem: Personagem, modelo: Personagem, deCombate: readonly Personagem[]): PedidoDeVariacao | null {
  if (!virarVariacaoTrocaAFicha(deCombate, personagem.id, modelo.id)) return null
  return { personagem, modelo, viraFamilia: variacoesDe(modelo.id, deCombate).length === 0 }
}

/** "Soltar do modelo" (botão do detalhe e o arrasto para fora): vira NPC único com a ficha que tem agora. */
export function soltarDoModeloNoMundo(personagem: Personagem, nomeDoModelo: string): Promise<boolean> {
  const antes = personagem
  return gravarNoMundo((lista) => trocarFicha(lista, antes.id, soltarDoModelo), {
    texto: `${antes.nome} agora é NPC único: a ficha não segue mais ${nomeDoModelo}.`,
    desfazer: (lista) => trocarFicha(lista, antes.id, () => antes),
  })
}

/** O destino sob o ponteiro (o fantasma não conta: `pointer-events: none`). */
function alvoSob(x: number, y: number, aperto: ApertoNaLinha): AlvoNaTela | null {
  const el = document.elementFromPoint(x, y)
  if (!(el instanceof Element)) return null
  const linha = el.closest(`[${ATRIBUTO_DA_FAMILIA}]`)
  if (linha !== null) {
    const familia = linha.getAttribute(ATRIBUTO_DA_FAMILIA)
    const modelo = aperto.deCombate.find((candidato) => candidato.id === familia)
    if (modelo === undefined || !podeVirarVariacaoDe(aperto.personagem, modelo, aperto.deCombate)) return null
    const linhaDoModelo = document.querySelector<HTMLElement>(`[${ATRIBUTO_DO_NPC}="${CSS.escape(modelo.id)}"]`)
    return linhaDoModelo === null ? null : { destino: { tipo: 'modelo', modelo }, el: linhaDoModelo }
  }
  if (!ehVariacao(aperto.personagem) || el.closest(`[${ATRIBUTO_DA_LISTA}]`) === null) return null
  const faixa = document.querySelector<HTMLElement>(`[${ATRIBUTO_DO_SOLTAR}]`)
  return faixa === null ? null : { destino: { tipo: 'soltar' }, el: faixa }
}

function textoDoAlvo(alvo: AlvoNaTela | null): string {
  if (alvo === null) return 'Solte sobre outro NPC'
  return alvo.destino.tipo === 'modelo' ? `Vira variação de ${alvo.destino.modelo.nome}` : 'Vira NPC único'
}

export interface ArrastoDoBestiario {
  comecar: (event: ReactPointerEvent<HTMLElement>, personagem: Personagem) => void
  /** O `click` que chega logo depois do soltar: não escolhe o NPC. */
  engolirClique: () => boolean
  /** O NPC no gesto (a linha dele fica apagada), `null` = nenhum. */
  arrastado: Personagem | null
  /** O NPC que acabou de mudar de família: a linha dele brilha no lugar novo. */
  pousou: string | null
  /** O fantasma do gesto e a pergunta antes de trocar a ficha (portais no `body`): a página os põe uma vez. */
  camadas: ReactNode
}

/** O gesto da lista "Modelos e variações". `deCombate` é a lista dos NPCs de combate da página. */
export function useArrastoDoBestiario(deCombate: readonly Personagem[]): ArrastoDoBestiario {
  const [arrastado, setArrastado] = useState<Personagem | null>(null)
  const [pousou, setPousou] = useState<string | null>(null)
  const [pedido, setPedido] = useState<PedidoDeVariacao | null>(null)
  const apertoRef = useRef<ApertoNaLinha | null>(null)
  const pontoRef = useRef({ x: 0, y: 0 })
  const fantasmaRef = useRef<HTMLDivElement | null>(null)
  const dicaRef = useRef<HTMLSpanElement | null>(null)
  const alvoRef = useRef<HTMLElement | null>(null)
  const voltaRef = useRef<Animation | null>(null)
  const engolirRef = useRef(false)
  const soltarOuvintesRef = useRef<(() => void) | null>(null)
  const relogioDoPousoRef = useRef<number | null>(null)

  const marcarAlvo = (alvo: AlvoNaTela | null) => {
    const el = alvo?.el ?? null
    if (alvoRef.current !== el) {
      alvoRef.current?.removeAttribute(ATRIBUTO_DO_ALVO)
      alvoRef.current = el
      if (alvo !== null) alvo.el.setAttribute(ATRIBUTO_DO_ALVO, alvo.destino.tipo)
    }
    const fantasma = fantasmaRef.current
    if (fantasma !== null) fantasma.dataset.aceita = alvo === null ? 'nao' : 'sim'
    if (dicaRef.current !== null) dicaRef.current.textContent = textoDoAlvo(alvo)
  }

  const posicionarFantasma = () => {
    const fantasma = fantasmaRef.current
    if (apertoRef.current === null || fantasma === null) return
    fantasma.style.transform = `translate(${pontoRef.current.x + FANTASMA_AO_LADO.x}px, ${pontoRef.current.y + FANTASMA_AO_LADO.y}px)`
  }

  // Página desmontada no meio do gesto (troca de aba do mundo): nada de ouvinte nem marca sobrando.
  useEffect(
    () => () => {
      soltarOuvintesRef.current?.()
      alvoRef.current?.removeAttribute(ATRIBUTO_DO_ALVO)
      voltaRef.current?.cancel()
      delete document.documentElement.dataset.muArrastando
      if (relogioDoPousoRef.current !== null) window.clearTimeout(relogioDoPousoRef.current)
    },
    [],
  )

  const marcarPouso = (personagemId: string) => {
    if (relogioDoPousoRef.current !== null) window.clearTimeout(relogioDoPousoRef.current)
    setPousou(personagemId)
    relogioDoPousoRef.current = window.setTimeout(() => {
      relogioDoPousoRef.current = null
      setPousou(null)
    }, POUSO_MS)
  }

  /** Gravou (aviso com Desfazer): escolhe o NPC, que agora mostra a família nova, e acende a linha dele. */
  const mostrarOPouso = (gravou: Promise<boolean>, personagemId: string) => {
    void gravou.then((ok) => {
      if (!ok) return
      useMundoDoLivroStore.getState().escolherNpc(personagemId)
      marcarPouso(personagemId)
    })
  }

  /** Soltou num alvo. Virar variação que apaga a ficha do NPC espera o "Virar variação" da pergunta. */
  const aplicar = (personagem: Personagem, destino: DestinoNoBestiario, lista: readonly Personagem[]) => {
    if (destino.tipo === 'soltar') {
      mostrarOPouso(soltarDoModeloNoMundo(personagem, nomeDoModelo(personagem, lista)), personagem.id)
      return
    }
    const pergunta = pedidoQuePergunta(personagem, destino.modelo, lista)
    if (pergunta !== null) {
      setPedido(pergunta)
      return
    }
    mostrarOPouso(virarVariacaoNoMundo(personagem, destino.modelo), personagem.id)
  }

  /** Nada mudou: o fantasma volta para a linha de onde saiu (sem movimento reduzido) e some. */
  const voltarFantasma = (aperto: ApertoNaLinha) => {
    const fantasma = fantasmaRef.current
    if (fantasma === null || movimentoReduzido()) {
      setArrastado(null)
      return
    }
    const caixa = aperto.linha.getBoundingClientRect()
    const volta = fantasma.animate([{ transform: fantasma.style.transform }, { transform: `translate(${caixa.left}px, ${caixa.top}px)` }], {
      duration: VOLTA_DO_FANTASMA_MS,
      easing: EASE_OUT,
      fill: 'forwards',
    })
    voltaRef.current = volta
    volta.onfinish = () => {
      voltaRef.current = null
      // Outro gesto pode ter começado durante a volta: o fantasma dele não some aqui.
      if (apertoRef.current === null) setArrastado(null)
    }
  }

  const comecar = (event: ReactPointerEvent<HTMLElement>, personagem: Personagem) => {
    if (event.button !== 0 || !event.isPrimary) return
    const linha = event.currentTarget.closest('li')
    if (linha === null) return
    // Aperto velho que perdeu o `pointerup` (soltou fora da janela): sai antes do novo.
    if (apertoRef.current !== null) {
      soltarOuvintesRef.current?.()
      apertoRef.current = null
      marcarAlvo(null)
      delete document.documentElement.dataset.muArrastando
    }
    if (voltaRef.current !== null) {
      voltaRef.current.cancel()
      voltaRef.current = null
      setArrastado(null)
    }
    soltarOuvintesRef.current?.()
    engolirRef.current = false
    apertoRef.current = {
      personagem,
      deCombate,
      pointerId: event.pointerId,
      inicio: { x: event.clientX, y: event.clientY },
      linha,
      arrastando: false,
    }

    const mover = (e: PointerEvent) => {
      const aperto = apertoRef.current
      if (aperto === null || e.pointerId !== aperto.pointerId) return
      pontoRef.current = { x: e.clientX, y: e.clientY }
      if (!aperto.arrastando) {
        if (Math.hypot(e.clientX - aperto.inicio.x, e.clientY - aperto.inicio.y) < LIMIAR_DO_ARRASTO_PX) return
        aperto.arrastando = true
        document.documentElement.dataset.muArrastando = 'sim'
        setArrastado(aperto.personagem)
      }
      posicionarFantasma()
      marcarAlvo(alvoSob(e.clientX, e.clientY, aperto))
    }

    const encerrar = (e: PointerEvent | null, soltou: boolean) => {
      const aperto = apertoRef.current
      if (aperto === null || (e !== null && e.pointerId !== aperto.pointerId)) return
      soltarOuvintesRef.current?.()
      apertoRef.current = null
      if (!aperto.arrastando) return
      delete document.documentElement.dataset.muArrastando
      // O `click` chega logo depois deste `pointerup`; o `setTimeout` libera o próximo clique de verdade.
      engolirRef.current = true
      window.setTimeout(() => {
        engolirRef.current = false
      }, 0)
      const alvo = soltou && e !== null ? alvoSob(e.clientX, e.clientY, aperto) : null
      marcarAlvo(null)
      if (alvo === null) {
        voltarFantasma(aperto)
        return
      }
      setArrastado(null)
      aplicar(aperto.personagem, alvo.destino, aperto.deCombate)
    }
    const aoSoltar = (e: PointerEvent) => encerrar(e, true)
    const aoCancelar = (e: PointerEvent) => encerrar(e, false)
    // Esc desiste, na CAPTURA e parando ali: chegando ao mundo, fecharia o livro.
    const aoTeclar = (e: KeyboardEvent) => {
      const aperto = apertoRef.current
      if (e.key !== 'Escape' || aperto === null || !aperto.arrastando) return
      e.preventDefault()
      e.stopImmediatePropagation()
      encerrar(null, false)
    }

    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', aoSoltar)
    window.addEventListener('pointercancel', aoCancelar)
    window.addEventListener('keydown', aoTeclar, true)
    soltarOuvintesRef.current = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', aoSoltar)
      window.removeEventListener('pointercancel', aoCancelar)
      window.removeEventListener('keydown', aoTeclar, true)
      soltarOuvintesRef.current = null
    }
  }

  const fantasma =
    arrastado === null
      ? null
      : // Portal no `body`: a lista tem rolagem e recorte. `aria-hidden`: eco visual do gesto; o teclado tem o "Mover para o modelo…".
        createPortal(
          <div
            className="mu-bes-fantasma"
            aria-hidden="true"
            data-aceita="nao"
            ref={(el) => {
              fantasmaRef.current = el
              if (el !== null) posicionarFantasma()
            }}
          >
            <span className="mu-bes-fantasma__corpo">
              <Retrato imagem={arrastado.retrato} nome={arrastado.nome} tamanho="p" />
              <span className="mu-bes-item__txt">
                <span className="mu-bes-item__nome">{arrastado.nome}</span>
                <span className="mu-bes-fantasma__dica" ref={dicaRef}>
                  {textoDoAlvo(null)}
                </span>
              </span>
            </span>
          </div>,
          document.body,
        )

  const camadas = (
    <>
      {fantasma}
      {pedido !== null && (
        <PerguntaAntesDeVirarVariacao
          pedido={pedido}
          onVirar={() => mostrarOPouso(virarVariacaoNoMundo(pedido.personagem, pedido.modelo), pedido.personagem.id)}
          onFechar={() => setPedido(null)}
        />
      )}
    </>
  )

  return { comecar, engolirClique: () => engolirRef.current, arrastado, pousou, camadas }
}

interface PerguntaAntesDeVirarVariacaoProps {
  pedido: PedidoDeVariacao
  /** "Virar variação": grava na hora; a janela sai em seguida. */
  onVirar: () => void
  /** A janela terminou de sair (pelos dois botões, pelo Esc ou pelo fundo). */
  onFechar: () => void
}

/**
 * A PERGUNTA ANTES DE TROCAR A FICHA: virar variação troca os golpes, as
 * armas e os atributos do NPC pelos do modelo, e os dele somem (soltar do
 * modelo depois não os traz de volta). Janela modal pequena, com o foco
 * começando no Cancelar (o Enter sem querer não apaga nada); Esc ou clique
 * no fundo cancelam; o Tab fica nos dois botões; o foco volta a quem estava
 * com ele.
 */
function PerguntaAntesDeVirarVariacao({ pedido, onVirar, onFechar }: PerguntaAntesDeVirarVariacaoProps) {
  const tituloId = useId()
  const textoId = useId()
  const caixaRef = useRef<HTMLDivElement | null>(null)
  const cancelarRef = useRef<HTMLButtonElement | null>(null)
  const apertouNoFundo = useRef(false)
  const [saindo, setSaindo] = useState(false)
  const { personagem, modelo, viraFamilia } = pedido

  useEffect(() => {
    const abriu = document.activeElement
    cancelarRef.current?.focus()
    return () => {
      if (abriu instanceof HTMLElement && abriu !== document.body && abriu.isConnected) abriu.focus()
    }
  }, [])

  const sair = () => {
    if (saindo) return
    setSaindo(true)
    window.setTimeout(onFechar, movimentoReduzido() ? 0 : SAIDA_DA_PERGUNTA_MS)
  }

  const virar = () => {
    if (saindo) return
    onVirar()
    sair()
  }

  const aoTeclar = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Janela modal: nenhuma tecla daqui vale para o mundo (o Esc fecharia o livro) nem para o "Mover para o modelo…".
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      sair()
      return
    }
    if (event.key !== 'Tab') return
    const botoes = Array.from(caixaRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS_DA_PERGUNTA) ?? [])
    const primeiro = botoes[0]
    const ultimo = botoes[botoes.length - 1]
    if (primeiro === undefined || ultimo === undefined) return
    if (event.shiftKey && document.activeElement === primeiro) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  const aoClicarNoFundo = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (apertouNoFundo.current && event.target === event.currentTarget) sair()
    apertouNoFundo.current = false
  }

  return createPortal(
    <div
      className={saindo ? 'mu-modal-fundo mu-modal-fundo--saindo' : 'mu-modal-fundo'}
      onMouseDown={(event) => (apertouNoFundo.current = event.target === event.currentTarget)}
      onClick={aoClicarNoFundo}
    >
      <div
        ref={caixaRef}
        className="mu-modal mu-modal--pergunta"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={textoId}
        onKeyDown={aoTeclar}
      >
        <div className="mu-modal__cab">
          <h2 className="mu-modal__tit" id={tituloId}>
            Virar variação?
          </h2>
        </div>
        <div className="mu-modal__corpo" id={textoId}>
          {viraFamilia ? (
            <p>
              <b>{personagem.nome}</b> e <b>{modelo.nome}</b> viram uma família: <b>{modelo.nome}</b> fica como modelo, e <b>{personagem.nome}</b>, como variação.
            </p>
          ) : (
            <p>
              <b>{personagem.nome}</b> vai virar variação de <b>{modelo.nome}</b>.
            </p>
          )}
          <p>
            Os golpes, as armas e os atributos passam a ser os de <b>{modelo.nome}</b>: os de agora somem. O nome, o retrato e a vida ficam.
          </p>
        </div>
        <div className="mu-modal__pe">
          <button ref={cancelarRef} type="button" className="mu-bt" onClick={sair}>
            Cancelar
          </button>
          <button type="button" className="mu-bt mu-bt--primario" onClick={virar}>
            Virar variação
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

interface LinhaDoBestiarioProps {
  personagem: Personagem
  deCombate: readonly Personagem[]
  escolhido: boolean
  /** Linha recuada embaixo do modelo. */
  variacao: boolean
  arrasto: ArrastoDoBestiario
  /** Retrato, nome, papel e a coluna da direita (força ou rank). */
  children: ReactNode
}

/** Uma linha da lista "Modelos e variações": escolhe o NPC no clique e arrasta para outra família. */
export function LinhaDoBestiario({ personagem, deCombate, escolhido, variacao, arrasto, children }: LinhaDoBestiarioProps) {
  // Modelo com variações não vira variação de ninguém (`podeVirarVariacaoDe`): a linha dele não arrasta.
  const arrasta = variacoesDe(personagem.id, deCombate).length === 0
  return (
    <li
      {...{ [ATRIBUTO_DO_NPC]: personagem.id, [ATRIBUTO_DA_FAMILIA]: idDaFamilia(personagem) }}
      data-bes-arrastando={arrasto.arrastado?.id === personagem.id ? 'sim' : undefined}
      data-bes-pousou={arrasto.pousou === personagem.id ? 'sim' : undefined}
    >
      <button
        type="button"
        className={variacao ? 'mu-bes-item mu-bes-item--var' : 'mu-bes-item'}
        aria-current={escolhido}
        title={arrasta ? 'Arraste sobre outro NPC para virar variação dele' : undefined}
        onPointerDown={arrasta ? (event) => arrasto.comecar(event, personagem) : undefined}
        // O retrato é um <img>: sem isto o navegador começa o arrasto nativo dele e cancela o nosso.
        onDragStart={(event) => event.preventDefault()}
        onClick={() => {
          if (!arrasto.engolirClique()) useMundoDoLivroStore.getState().escolherNpc(personagem.id)
        }}
      >
        {children}
      </button>
    </li>
  )
}

/** A faixa do fim da lista durante o arrasto de uma variação: soltar aqui (ou no vazio do cartão) a deixa NPC única. */
export function FaixaSoltarDoModelo({ arrasto }: { arrasto: ArrastoDoBestiario }) {
  if (arrasto.arrastado === null || !ehVariacao(arrasto.arrastado)) return null
  return (
    <li className="mu-bes-soltar" {...{ [ATRIBUTO_DO_SOLTAR]: '' }} aria-hidden="true">
      Soltar do modelo · vira NPC único
    </li>
  )
}

/** O atributo do cartão da lista (o vazio dele aceita a variação que sai do modelo). */
export const PROPS_DO_CARTAO_DA_LISTA = { [ATRIBUTO_DA_LISTA]: '' }

/**
 * "MOVER PARA O MODELO…" do detalhe do NPC: o mesmo que o arrasto, pelo
 * teclado e pelo leitor de tela. O botão abre, logo embaixo, os NPCs que
 * aceitam este como variação; Esc fecha e devolve o foco ao botão. Modelo com
 * variações não tem o botão (não vira variação, `podeVirarVariacaoDe`). A
 * troca que apaga a ficha do NPC pergunta antes, como no arrasto.
 */
export function MoverParaOModelo({ personagem, deCombate }: { personagem: Personagem; deCombate: readonly Personagem[] }) {
  const [aberto, setAberto] = useState(false)
  const [pedido, setPedido] = useState<PedidoDeVariacao | null>(null)
  const botaoRef = useRef<HTMLButtonElement | null>(null)
  const listaRef = useRef<HTMLDivElement | null>(null)
  // Só as linhas de cima: a variação de um modelo leva à mesma família que ele.
  const alvos = deCombate.filter((candidato) => !ehVariacao(candidato) && podeVirarVariacaoDe(personagem, candidato, deCombate))

  useEffect(() => {
    if (aberto) listaRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [aberto])

  if (variacoesDe(personagem.id, deCombate).length > 0) return null

  const fecharPelaTecla = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    setAberto(false)
    botaoRef.current?.focus()
  }

  return (
    <div className="mu-mover-modelo" onKeyDown={fecharPelaTecla}>
      <button
        ref={botaoRef}
        type="button"
        className="mu-bt mu-bt--p mu-bt--fantasma"
        aria-expanded={aberto}
        disabled={alvos.length === 0}
        title={alvos.length === 0 ? 'Nenhum outro NPC de combate para ser o modelo.' : 'Também dá para arrastar a linha da lista até o modelo.'}
        onClick={() => setAberto(!aberto)}
      >
        <IconeDoMundo nome="copia" />
        Mover para o modelo…
      </button>
      {aberto && (
        <div ref={listaRef} className="mu-pg-acoes" role="group" aria-label={`Modelo de ${personagem.nome}`}>
          {alvos.map((alvo) => (
            <button
              key={alvo.id}
              type="button"
              className="mu-chip"
              onClick={() => {
                setAberto(false)
                const pergunta = pedidoQuePergunta(personagem, alvo, deCombate)
                if (pergunta === null) void virarVariacaoNoMundo(personagem, alvo)
                else setPedido(pergunta)
              }}
            >
              <Retrato imagem={alvo.retrato} nome={alvo.nome} tamanho="p" />
              {alvo.nome}
            </button>
          ))}
        </div>
      )}
      {pedido !== null && (
        <PerguntaAntesDeVirarVariacao
          pedido={pedido}
          onVirar={() => void virarVariacaoNoMundo(pedido.personagem, pedido.modelo)}
          onFechar={() => {
            setPedido(null)
            // O chip que abriu a pergunta já saiu da tela: o foco volta ao "Mover para o modelo…".
            botaoRef.current?.focus()
          }}
        />
      )}
    </div>
  )
}
