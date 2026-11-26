import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { HEALTH_BAR_COLORS } from '../pixi/drawTokenHealth'
import { TOKEN_CONDITION_LABELS, TOKEN_CONDITION_SYMBOLS } from '../lib/tokenConditions'
import { simboloDaCondicaoPropria } from '../lib/condicoesProprias'
import { moedasLabel } from '../lib/troca'
import { useImagemDaMesa } from '../components/ImagemDaMesa'
import { PastilhaDeCondicao } from '../components/PastilhaDeCondicao'
import { itemNoticeText } from './itemNotice'
import type { ItemNotice } from './playerConnection'
import type { PedidoDaMochila } from '../net/protocoloDaMochila'
import { balasParaAArma, estadoDaVaga, fraseDoFeito, opcoesDaVaga, regrasDaVaga, rotuloDoTipo, SEM_REGRA, semRegra, textoDoPente, type OpcaoDaVaga } from './acoesDaMochila'
import {
  CONDITION_WORDS,
  INVENTORY_COLUMNS,
  VAGAS_DA_MOCHILA,
  ecgPath,
  emptySlotCount,
  gridMove,
  hiddenConditionLine,
  payerFor,
  payerLine,
  slotDescription,
  slotFallbackLine,
  type InventoryCharacter,
  type InventoryColleague,
  type InventoryCondition,
  type InventorySlot,
  type ItemGlyph,
  type ItemTexts,
} from './inventario'

/** Sem resposta da mesa nesse tempo, a espera vira aviso: nada gira para sempre (o host descarta pedido rápido demais sem responder). */
export const INVENTORY_PENDING_TIMEOUT_MS = 10_000

/** A pastilha de uma condição criada na lista "Condições na ficha", em px: o símbolo digitado (até 2 caracteres) ainda se lê. */
const PASTILHA_NA_LISTA = 22

/** Controles do inventário por onde o Tab circula; as vagas fora da escolhida saem (a grade é UMA parada do Tab). */
const FOCUSABLE = 'button:not(:disabled):not([tabindex="-1"]), input:not(:disabled)'

/** Livres por cima do véu: o alarme do mestre e o aviso de conexão caída (z 40; o véu começa logo abaixo do alarme). */
const ACIMA_DO_VEU = '.pp-alarm, .pp-reconnecting'

/** A raiz do app, onde os dois de cima nascem: ela nunca fica inerte inteira, só os outros filhos dela. */
const RAIZ_DO_APP = '#root'

interface PlayerInventoryProps {
  /** As fichas DELE no mapa da tela (`inventoryCharacters`), a própria primeiro. */
  characters: InventoryCharacter[]
  /** "Dar a…": o mesmo `item.give` do "Comigo". `false` = não saiu (sem conexão, item que já não está com ele). */
  onGive: (itemId: string, toTokenId: string) => boolean
  /** "Pagar a…": o mesmo `coins.give` do "Comigo". */
  onPay: (toTokenId: string, moedas: number) => boolean
  /** ITEM QUE ILUMINA: "Acender"/"Apagar" o item da ficha `tokenId` (`item.acender`). Ausente = sem o botão. */
  onAcender?: (tokenId: string, itemId: string, acesa: boolean) => boolean
  /**
   * SISTEMA DE ITENS REFEITO (E5a): equipar, guardar, recarregar, dar uma parte da pilha e largar
   * (`net/protocoloDaMochila.ts`). Resolve `null` quando o host fez, ou o motivo. Ausente = sem esses botões.
   */
  onPedir?: (pedido: PedidoDaMochila) => Promise<string | null>
  /** Fase 8: o "Usar" do consumível em si ou num colega (`item.usar`). Ausente = sem o botão. */
  onUsar?: (tokenId: string, vagaId: string, alvoTokenId: string) => Promise<string | null>
  /** O último aviso de item da conexão: a recusa do host aparece aqui dentro — o aviso de baixo fica atrás do véu. */
  notice?: ItemNotice
  onClose: () => void
  /** Aberto pelo teclado (tecla I): entra sem animação — movimento em resposta a tecla só atrasa. */
  instant?: boolean
  /** O texto que o mestre escreveu em cada item, lido enquanto ele estava no chão (`rememberItemTexts`). */
  itemTexts?: ItemTexts
}

/** Sem memória de textos: todo item cai na linha do que dá para fazer com ele. */
const NO_TEXTS: ItemTexts = new Map()

/**
 * Sem a pergunta "Sim / Não" (decisão 8 do mestre, 12/11): escolher o colega já dá ou paga. E5a:
 * "Usar em quem?", "Com qual bala?" e "Quantos largar?" têm a mesma forma de duas fileiras.
 */
type Step = { kind: 'idle' } | { kind: 'dar' } | { kind: 'pagar' } | { kind: 'usar' } | { kind: 'recarregar' } | { kind: 'largar' }

/**
 * Um pedido esperando o mapa novo. No pagamento, `bolsasAntes` é a bolsa de
 * CADA ficha dele na hora do pedido: o `coins.give` não diz de qual ficha sai,
 * e o host pode cobrar de outra que não a aberta — conferir só a aberta dava
 * "a mesa não respondeu" num pagamento feito, e convidava a pagar de novo. E a
 * soma das bolsas não serve: ela cai também quando uma ficha com moedas sai do
 * recorte (o mestre a esconde, encerra o empréstimo, dispensa o ajudante, ela
 * muda de piso) — dava "pagou" sem ninguém ter pago, e a recusa do host, que
 * chega depois, ficava sem pedido para mostrar.
 */
type Pending =
  | { kind: 'dar'; tokenId: string; itemId: string; nome: string; para: string; noticeId: number | null }
  /** `bolsa`: "Sai da bolsa de X." quando o host cobra de outra ficha dele (`payerFor`); a frase de sucesso diz. */
  | { kind: 'pagar'; quanto: number; bolsasAntes: ReadonlyMap<string, number>; para: string; noticeId: number | null; bolsa: string | null }
  /** E5a: um pedido da mochila ou um "Usar", esperando a resposta do host (a promessa). `texto`: "Equipando Rosa Fúnebre…". */
  | { kind: 'pedido'; texto: string }

/** A bolsa de cada ficha dele no mapa, por `tokenId`. */
function bolsasPorFicha(characters: readonly InventoryCharacter[]): ReadonlyMap<string, number> {
  return new Map(characters.map((c) => [c.tokenId, c.moedas]))
}

/**
 * O host cobrou: uma ficha que estava no recorte na hora do pedido, e continua
 * nele, tem exatamente `quanto` moedas a menos. Ficha que saiu do recorte não
 * conta — sumir não é pagar.
 */
function pagouDeUmaBolsa(antes: ReadonlyMap<string, number>, agora: readonly InventoryCharacter[], quanto: number): boolean {
  return agora.some((c) => {
    const moedasAntes = antes.get(c.tokenId)
    return moedasAntes !== undefined && moedasAntes - c.moedas === quanto
  })
}

/**
 * Tira de cena o que fica atrás do véu, como a pausa do RE: cada pedaço da
 * página fora do inventário ganha `inert` (clique, foco e leitor de tela não
 * chegam lá) e `data-pp-inv-fundo`, que o CSS esconde quando o véu termina de
 * cobrir — ou na hora (`'ja'`), para o que abriu pelo teclado ou chegou com ele
 * aberto (um aviso, um cartão). Quem já era inerte fica como estava, e a
 * volta desfaz só o que foi marcado aqui.
 */
function coverBackground(veil: Element, instant: boolean): () => void {
  const marked = new Set<Element>()
  const observers: MutationObserver[] = []

  function mark(el: Element, now: boolean): void {
    if (el.hasAttribute('inert')) return
    el.setAttribute('inert', '')
    el.setAttribute('data-pp-inv-fundo', now ? 'ja' : '')
    marked.add(el)
  }

  // O véu e os avisos de cima ficam livres; quem os contém é descido, para marcar só os irmãos deles.
  function place(el: Element, now: boolean): void {
    if (el === veil || el.matches(ACIMA_DO_VEU)) return
    if (el.matches(RAIZ_DO_APP) || el.contains(veil) || el.querySelector(ACIMA_DO_VEU) !== null) descend(el, now)
    else mark(el, now)
  }

  function descend(container: Element, now: boolean): void {
    for (const child of Array.from(container.children)) place(child, now)
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) if (node instanceof Element) place(node, true)
      }
    })
    observer.observe(container, { childList: true })
    observers.push(observer)
  }

  descend(document.body, instant)
  return () => {
    for (const observer of observers) observer.disconnect()
    for (const el of marked) {
      el.removeAttribute('inert')
      el.removeAttribute('data-pp-inv-fundo')
    }
  }
}

interface Outcome {
  tone: 'ok' | 'erro'
  text: string
}

/** Para onde o foco vai depois do próximo desenho — quem mudou o passo diz. */
type FocusTarget = 'vaga' | 'acao' | 'colega' | 'campo'

const IDLE: Step = { kind: 'idle' }

/**
 * INVENTÁRIO ESTILO RESIDENT EVIL (tecla I). O jogo "pausa" sob um véu escuro:
 * à esquerda o retrato e a faixa da condição (o ECG do RE — Bem, Cuidado,
 * Perigo, ou oculta quando o mestre guarda a vida), à direita a grade de itens
 * com a quantidade, e no meio o item escolhido com o que dá para fazer com ele.
 * Dar e pagar vão num toque, sem a pergunta "Sim/Não" (decisão 8 do mestre:
 * o mesmo número de passos do "Comigo" e do cartão da ficha), e saem pelas
 * MESMAS mensagens do "Comigo".
 *
 * Modal de verdade: o foco entra na grade, as setas andam de vaga em vaga,
 * Enter leva às ações, Esc volta um passo (ou fecha), o Tab não sai, e fechar
 * devolve o foco a quem abriu.
 */
export function PlayerInventory({ characters, onGive, onPay, onAcender, onPedir, onUsar, notice, onClose, instant = false, itemTexts = NO_TEXTS }: PlayerInventoryProps) {
  const titleId = useId()
  const textId = useId()
  const veilRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const slotRef = useRef<HTMLButtonElement | null>(null)
  const actionRef = useRef<HTMLButtonElement | null>(null)
  const colleagueRef = useRef<HTMLButtonElement | null>(null)
  const fieldRef = useRef<HTMLInputElement | null>(null)
  const focusNext = useRef<FocusTarget | null>(null)

  const [characterId, setCharacterId] = useState(characters[0]?.tokenId ?? '')
  const character = characters.find((c) => c.tokenId === characterId) ?? characters[0]
  const slots = character?.slots ?? []
  const [selectedKey, setSelectedKey] = useState<string | null>(slots[0]?.key ?? null)
  // A vaga escolhida sumiu (o item foi dado): a escolha fica no vizinho, no mesmo lugar da grade.
  const lastIndex = useRef(0)
  const found = slots.findIndex((s) => s.key === selectedKey)
  const index = found !== -1 ? found : Math.min(lastIndex.current, slots.length - 1)
  const selected: InventorySlot | undefined = index >= 0 ? slots[index] : undefined
  useEffect(() => {
    lastIndex.current = Math.max(index, 0)
  })

  const [step, setStep] = useState<Step>(IDLE)
  const [valor, setValor] = useState('1')
  const [pending, setPending] = useState<Pending | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  // Como a vaga atual foi escolhida. Só o clique traz o objeto ao palco com
  // movimento: pela seta ou pelo Enter a troca é imediata, porque animação em
  // resposta a tecla só atrasa quem está percorrendo a grade.
  const [via, setVia] = useState<'clique' | null>(null)
  const descricao = selected === undefined ? null : slotDescription(selected, itemTexts)

  const stepRef = useRef(step)
  stepRef.current = step
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const back = useCallback(() => {
    setStep(IDLE)
    focusNext.current = 'acao'
  }, [])

  // Abrir: o resto da página sai de cena (inerte, e escondido quando o véu
  // cobre). Fechar: tudo volta, e o foco a quem abriu. Efeito de layout porque
  // marca antes do primeiro desenho (nada pisca por cima do véu) e, ao fechar,
  // devolve o foco antes de o véu sair da página, depois de desfazer o inerte
  // (quem abriu estava atrás do véu). `instant` só diz como a abertura entra.
  useLayoutEffect(() => {
    const opener = document.activeElement
    const veil = veilRef.current
    const uncover = veil === null ? null : coverBackground(veil, instant)
    return () => {
      uncover?.()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  // O foco entra na vaga escolhida (sem nada, no "Fechar").
  useEffect(() => {
    ;(slotRef.current ?? closeRef.current)?.focus()
  }, [])

  // Esc volta um passo ou fecha; Tab circula só aqui dentro. Na captura do
  // documento, antes de todo o resto: nenhum outro ouvinte vê o Esc — nem os
  // cartões e a gaveta que ficaram atrás do véu, nem os modos do mapa na janela.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        if (stepRef.current.kind === 'idle') onCloseRef.current()
        else back()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      if (dialog === null) return
      const controls = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (first === undefined || last === undefined) return
      const inside = document.activeElement instanceof Node && dialog.contains(document.activeElement)
      if (event.shiftKey && (!inside || document.activeElement === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [back])

  // O foco que o passo pediu, depois do desenho que o montou.
  useEffect(() => {
    const target = focusNext.current
    if (target === null) return
    focusNext.current = null
    const byTarget: Record<FocusTarget, HTMLElement | null> = {
      vaga: slotRef.current,
      acao: actionRef.current !== null && !actionRef.current.disabled ? actionRef.current : slotRef.current,
      colega: colleagueRef.current,
      campo: fieldRef.current,
    }
    byTarget[target]?.focus()
  })

  // A vaga com o foco sumiu (item dado, ficha trocada): o foco volta à grade em vez de cair no nada.
  useEffect(() => {
    if (document.activeElement === null || document.activeElement === document.body) (slotRef.current ?? closeRef.current)?.focus()
  }, [slots])

  // Deu certo: o mapa novo chegou sem o item, ou com `quanto` moedas a menos
  // numa das bolsas dele (o host escolhe de qual sai). Ficha que saiu do
  // recorte não é pagamento: o pedido segue esperando a recusa ou o prazo.
  useEffect(() => {
    // O pedido da mochila acaba pela promessa (o host responde `mochila.resultado`), não pelo mapa.
    if (pending === null || pending.kind === 'pedido') return
    if (pending.kind === 'pagar') {
      if (!pagouDeUmaBolsa(pending.bolsasAntes, characters, pending.quanto)) return
      const deOutraBolsa = pending.bolsa === null ? '' : ` ${pending.bolsa}`
      setOutcome({ tone: 'ok', text: `Você pagou ${moedasLabel(pending.quanto)} a ${pending.para}.${deOutraBolsa}` })
      setPending(null)
      return
    }
    const dono = characters.find((c) => c.tokenId === pending.tokenId)
    if (dono === undefined || dono.slots.some((s) => s.itemIds.includes(pending.itemId))) return
    // O aviso de quem deu, o mesmo do "Comigo" e do cartão da ficha (decisão 8 do mestre).
    setOutcome({ tone: 'ok', text: `Você deu ${pending.nome} a ${pending.para}.` })
    setPending(null)
  }, [characters, pending])

  // O host recusou: o aviso novo é deste pedido.
  useEffect(() => {
    if (pending === null || pending.kind === 'pedido' || notice === undefined || notice.id === pending.noticeId) return
    const recusa = (pending.kind === 'dar' && notice.phase === 'give_rejected') || (pending.kind === 'pagar' && notice.phase === 'coins_rejected')
    if (!recusa) return
    setOutcome({ tone: 'erro', text: itemNoticeText(notice) })
    setPending(null)
  }, [notice, pending])

  // Nem resposta nem mapa novo: a espera acaba com aviso. O pedido da mochila tem o teto da conexão.
  useEffect(() => {
    if (pending === null || pending.kind === 'pedido') return
    const timer = window.setTimeout(() => {
      setOutcome({ tone: 'erro', text: 'A mesa não respondeu. Confira a conexão e tente de novo.' })
      setPending(null)
    }, INVENTORY_PENDING_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [pending])

  function select(next: number) {
    const slot = slots[next]
    if (slot === undefined) return
    if (slot.key !== selected?.key) setStep(IDLE)
    setSelectedKey(slot.key)
  }

  function onSlotKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, at: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      // Outra vaga: o foco vai às ações depois do desenho novo. A mesma: nada
      // muda na tela, então nenhum desenho vem — o foco vai já.
      if (slots[at]?.key !== selected?.key) {
        select(at)
        setVia(null)
        focusNext.current = 'acao'
        return
      }
      const action = actionRef.current
      if (action !== null && !action.disabled) action.focus()
      return
    }
    const next = gridMove(at, event.key, slots.length, event.ctrlKey || event.metaKey)
    if (next === null) return
    event.preventDefault()
    select(next)
    setVia(null)
    focusNext.current = 'vaga'
  }

  function switchCharacter(tokenId: string) {
    const next = characters.find((c) => c.tokenId === tokenId)
    setCharacterId(tokenId)
    setSelectedKey(next?.slots[0]?.key ?? null)
    lastIndex.current = 0
    setStep(IDLE)
    setOutcome(null)
    setVia(null)
  }

  // A resposta de um pedido que chega depois de a tela fechar não escreve em nada.
  const vivo = useRef(true)
  useEffect(
    () => () => {
      vivo.current = false
    },
    [],
  )

  /** Um pedido que acaba pela promessa: a linha de status diz "…" enquanto espera e o resultado depois. */
  function esperar(promessa: Promise<string | null>, texto: string, feito: string) {
    setStep(IDLE)
    setOutcome(null)
    setPending({ kind: 'pedido', texto })
    focusNext.current = 'vaga'
    void promessa.then((motivo) => {
      if (!vivo.current) return
      setPending(null)
      setOutcome(motivo === null ? { tone: 'ok', text: feito } : { tone: 'erro', text: motivo })
    })
  }

  /** Equipar, Guardar, Recarregar (uma bala só), Jogar, Usar, Acender e Apagar: a ação do tipo da vaga. */
  function fazer(opcao: OpcaoDaVaga) {
    const vagaId = selected?.itemIds[0]
    if (character === undefined || selected === undefined || vagaId === undefined || opcao.motivo !== null) return
    const tokenId = character.tokenId
    switch (opcao.acao) {
      case 'equipar':
      case 'guardar':
        if (onPedir === undefined) return
        esperar(
          onPedir({ type: 'mochila.equipar', tokenId, vagaId, equipado: opcao.acao === 'equipar' }),
          `${opcao.acao === 'equipar' ? 'Equipando' : 'Guardando'} ${selected.nome}…`,
          fraseDoFeito(opcao.acao, selected.nome),
        )
        return
      case 'recarregar': {
        const balas = balasParaAArma(selected, slots)
        if (balas.length === 1) recarregarCom(balas[0])
        else {
          setOutcome(null)
          setStep({ kind: 'recarregar' })
          focusNext.current = 'colega'
        }
        return
      }
      case 'usar':
        setOutcome(null)
        setStep({ kind: 'usar' })
        focusNext.current = 'colega'
        return
      case 'acender':
      case 'apagar':
        if (onAcender === undefined || selected.luz === undefined) return
        if (!onAcender(tokenId, selected.luz.vagaId, !selected.luz.acesa)) setOutcome({ tone: 'erro', text: 'Sem conexão com a mesa agora.' })
        return
      case 'jogar':
        return
    }
  }

  function recarregarCom(bala: InventorySlot) {
    const armaVagaId = selected?.itemIds[0]
    const balaVagaId = bala.itemIds[0]
    if (character === undefined || selected === undefined || armaVagaId === undefined || balaVagaId === undefined || onPedir === undefined) return
    esperar(onPedir({ type: 'mochila.recarregar', tokenId: character.tokenId, armaVagaId, balaVagaId }), `Recarregando ${selected.nome}…`, fraseDoFeito('recarregar', selected.nome))
  }

  function usarEm(alvoTokenId: string, alvoNome: string) {
    const vagaId = selected?.itemIds[0]
    if (character === undefined || selected === undefined || vagaId === undefined || onUsar === undefined) return
    const emQuem = alvoTokenId === character.tokenId ? '' : ` em ${alvoNome}`
    esperar(onUsar(character.tokenId, vagaId, alvoTokenId), `Usando ${selected.nome}${emQuem}…`, `Você usou ${selected.nome}${emQuem}.`)
  }

  function largar(quantidade: number) {
    const vagaId = selected?.itemIds[0]
    if (character === undefined || selected === undefined || vagaId === undefined || onPedir === undefined) return
    esperar(onPedir({ type: 'mochila.largar', tokenId: character.tokenId, vagaId, quantidade }), `Largando ${selected.nome}…`, fraseDoFeito('largar', selected.nome, quantidade))
  }

  /** "Largar": a pilha pergunta quantos; a vaga de um só vai direto. */
  function comecarLargar() {
    if (selected === undefined) return
    if (quantosDaVaga(selected) > 1) {
      setOutcome(null)
      setValor(String(quantosDaVaga(selected)))
      setStep({ kind: 'largar' })
      focusNext.current = 'campo'
      return
    }
    largar(1)
  }

  function giveTo(colleague: InventoryColleague, quantidade?: number) {
    const itemId = selected?.itemIds[0]
    if (character === undefined || selected === undefined || itemId === undefined) return
    // Uma parte da pilha vai pelo pedido novo (E5a); a vaga inteira, pelo `item.give` de sempre.
    if (quantidade !== undefined && quantidade < selected.quantidade && onPedir !== undefined) {
      esperar(
        onPedir({ type: 'mochila.dar', tokenId: character.tokenId, vagaId: itemId, quantidade, paraTokenId: colleague.tokenId }),
        `Dando ${quantidade} ${selected.nome} a ${colleague.name}…`,
        `Você deu ${quantidade} ${selected.nome} a ${colleague.name}.`,
      )
      return
    }
    setStep(IDLE)
    setOutcome(null)
    if (!onGive(itemId, colleague.tokenId)) {
      setOutcome({ tone: 'erro', text: 'Não deu para enviar. Confira a conexão e tente de novo.' })
    } else {
      setPending({ kind: 'dar', tokenId: character.tokenId, itemId, nome: selected.nome, para: colleague.name, noticeId: notice?.id ?? null })
    }
    focusNext.current = 'vaga'
  }

  function payTo(colleague: InventoryColleague, quanto: number) {
    if (character === undefined) return
    setStep(IDLE)
    setOutcome(null)
    // Sem a pergunta, a bolsa de outra ficha (o host escolhe) vai na frase de depois.
    const payer = payerFor(colleague, quanto)
    const bolsa = payer !== undefined && payer.tokenId !== character.tokenId ? payerLine(payer) : null
    if (!onPay(colleague.tokenId, quanto)) {
      setOutcome({ tone: 'erro', text: 'Não deu para enviar. Confira a conexão e tente de novo.' })
    } else {
      setPending({ kind: 'pagar', quanto, bolsasAntes: bolsasPorFicha(characters), para: colleague.name, noticeId: notice?.id ?? null, bolsa })
    }
    focusNext.current = 'vaga'
  }

  const statusText =
    pending !== null
      ? pending.kind === 'pedido'
        ? pending.texto
        : pending.kind === 'dar'
          ? `Dando ${pending.nome} a ${pending.para}…`
          : `Pagando ${moedasLabel(pending.quanto)} a ${pending.para}…`
      : (outcome?.text ?? '')
  const vagasUsadas = slots.filter((slot) => slot.kind === 'item').length
  const naoCabem = vagasUsadas - VAGAS_DA_MOCHILA

  return createPortal(
    <div
      ref={veilRef}
      className="pp-inv"
      data-instant={instant ? '' : undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div ref={dialogRef} className="pp-inv__quadro" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="pp-inv__topo">
          <h2 id={titleId} className="pp-inv__titulo">
            Inventário
          </h2>
          <button ref={closeRef} type="button" className="pp-button pp-inv__fechar" onClick={onClose}>
            Fechar
          </button>
        </header>

        {character === undefined ? (
          <p className="pp-inv__nada">Nenhuma ficha sua nesta cena.</p>
        ) : (
          <div className="pp-inv__corpo">
            <section className="pp-inv__ficha" aria-label={`Ficha de ${character.name}`}>
              {characters.length > 1 && (
                <div className="pp-inv__fichas" role="group" aria-label="Ficha">
                  {characters.map((c) => (
                    <button
                      key={c.tokenId}
                      type="button"
                      className="pp-inv__ficha-botao"
                      aria-pressed={c.tokenId === character.tokenId}
                      onClick={() => switchCharacter(c.tokenId)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              <Portrait character={character} />
              {character.photo === null && (
                <p className="pp-inv__semfoto">{character.editable ? 'Sem foto. Escolha uma no Painel, em Meu personagem.' : 'Sem foto.'}</p>
              )}
              <p className="pp-inv__nome">{character.name}</p>
              <ConditionStrip condition={character.condition} owner={character} />
              {(character.conditions.length > 0 || character.condicoesProprias.length > 0) && (
                <ul className="pp-inv__marcas" aria-label="Condições na ficha">
                  {character.conditions.map((c) => (
                    <li key={c} className="pp-inv__marca">
                      <span className="pp-inv__marca-cor" style={{ background: TOKEN_CONDITION_SYMBOLS[c].fill }} aria-hidden="true" />
                      {TOKEN_CONDITION_LABELS[c]}
                    </li>
                  ))}
                  {/* As que o mestre criou: a mesma pastilha que está em cima da ficha no mapa, e o nome ao lado. */}
                  {character.condicoesProprias.map((c) => (
                    <li key={c.id} className="pp-inv__marca pp-inv__marca--criada">
                      <PastilhaDeCondicao symbol={simboloDaCondicaoPropria(c)} tamanho={PASTILHA_NA_LISTA} />
                      {c.nome}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="pp-inv__lado-grade">
              <p className="pp-inv__vagas">
                {vagasUsadas} de {VAGAS_DA_MOCHILA} vagas
              </p>
              {/* Nada some da mochila: o que passa das 16 aparece embaixo, com o aviso. */}
              {naoCabem > 0 && <p className="pp-inv__cheia">Mochila cheia: {naoCabem === 1 ? '1 coisa não cabe' : `${naoCabem} coisas não cabem`}. Dê ou largue algo.</p>}
              <Grid
                owner={character.name}
                slots={slots}
                index={index}
                slotRef={slotRef}
                describedBy={textId}
                onSelect={(at) => {
                  if (slots[at]?.key !== selected?.key) setVia('clique')
                  select(at)
                  focusNext.current = 'vaga'
                }}
                onKeyDown={onSlotKeyDown}
              />
            </div>

            <div className="pp-inv__detalhe">
              {selected === undefined ? (
                <p className="pp-inv__convite">Nada na mochila. Itens que você pegar no mapa aparecem aqui.</p>
              ) : (
                <>
                  {/* O palco de examinar do RE: o objeto grande sob a luz do lampião. Só desenho — o nome e o texto abaixo dizem o mesmo ao leitor de tela. */}
                  <div className="pp-inv__palco" aria-hidden="true" data-entrada={via ?? undefined}>
                    <div key={selected.key} className="pp-inv__palco-objeto">
                      <ImagemOuGlifo slot={selected} className="pp-inv__palco-glifo" />
                    </div>
                    {(selected.kind === 'moedas' || selected.quantidade > 1) && <span className="pp-inv__palco-qtd">{selected.quantidade}</span>}
                  </div>
                  <div className="pp-inv__detalhe-corpo">
                    {/* A placa do RE: caixa de borda fina, o nome no alto, um fio e o texto. Sem o texto do mestre, a linha do que dá para fazer, em tinta mais fraca. */}
                    <div className="pp-inv__placa">
                      <h3 className="pp-inv__detalhe-nome">{selected.nome}</h3>
                      {/* O cartão inteiro do item, só para ler (E5a): o tipo, o texto, o que ele faz, o estado da vaga e a nota do mestre. */}
                      <CartaoDaVaga slot={selected} />
                      <p id={textId} className={descricao === null ? 'pp-inv__detalhe-texto pp-inv__detalhe-texto--derivado' : 'pp-inv__detalhe-texto'}>
                        {descricao ?? slotFallbackLine(selected)}
                      </p>
                      {selected.notaDaVaga !== undefined && <p className="pp-inv__nota-da-vaga">Nota do mestre: {selected.notaDaVaga}</p>}
                    </div>
                    {/* A caixa das ações tem sempre a altura do passo mais alto, como a
                        janela de comandos do RE3: trocar "Dar item" por "Dar a quem?" ou
                        "Pagar" troca só o miolo, e nem o texto nem a grade saem do lugar. */}
                    <div className="pp-inv__passos">
                      <Actions
                        slot={selected}
                        character={character}
                        step={step}
                        valor={valor}
                        busy={pending !== null}
                        refs={{ actionRef, colleagueRef, fieldRef }}
                        onValor={setValor}
                        onStartPagar={() => {
                          setOutcome(null)
                          setValor('1')
                          setStep({ kind: 'pagar' })
                          focusNext.current = 'campo'
                        }}
                        onStartDar={() => {
                          setOutcome(null)
                          setValor(String(quantosDaVaga(selected)))
                          setStep({ kind: 'dar' })
                          focusNext.current = quantosDaVaga(selected) > 1 && onPedir !== undefined ? 'campo' : 'colega'
                        }}
                        opcoes={opcoesDaVaga(selected, character).filter((opcao) => podeFazer(opcao, onAcender !== undefined, onPedir !== undefined, onUsar !== undefined))}
                        balas={balasParaAArma(selected, slots)}
                        darComQuantidade={onPedir !== undefined && quantosDaVaga(selected) > 1}
                        podeLargar={onPedir !== undefined}
                        onFazer={fazer}
                        onRecarregarCom={recarregarCom}
                        onUsarEm={usarEm}
                        onLargar={comecarLargar}
                        onLargarQuantos={largar}
                        onChooseGive={giveTo}
                        onChoosePay={payTo}
                        onBack={back}
                      />
                      <StepMold colleagues={character.colleagues} moedas={character.moedas} />
                    </div>
                  </div>
                </>
              )}
              <p className={outcome?.tone === 'erro' && pending === null ? 'pp-inv__status pp-inv__status--erro' : 'pp-inv__status'} role="status" aria-live="polite">
                {statusText}
              </p>
            </div>
          </div>
        )}

        <ul className="pp-inv__teclas" aria-label="Atalhos do teclado">
          <li>
            <kbd>←</kbd>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <kbd>→</kbd> escolher
          </li>
          <li>
            <kbd>Enter</kbd> ações do item
          </li>
          <li>
            <kbd>Esc</kbd> voltar
          </li>
          <li>
            <kbd>I</kbd> fechar
          </li>
        </ul>
      </div>
    </div>,
    document.body,
  )
}

/** A foto que viaja no recorte, ou a inicial na cor da ficha. */
function Portrait({ character }: { character: InventoryCharacter }) {
  const initial = Array.from(character.name.trim())[0]?.toLocaleUpperCase('pt-BR') ?? '?'
  return (
    <div className="pp-inv__retrato" style={{ '--pp-inv-ficha': character.color } as CSSProperties}>
      {character.photo !== null ? (
        <img className="pp-inv__foto" src={character.photo} alt={`Foto de ${character.name}`} />
      ) : (
        <span className="pp-inv__monograma" aria-hidden="true">
          {initial}
        </span>
      )}
    </div>
  )
}

/** A cor do estado sai da MESMA constante que pinta a barra sob a ficha no mapa. */
function cssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/**
 * A faixa do ECG. Três pistas juntas, nunca a cor sozinha: a palavra, a cor e
 * o ritmo do traço (calmo no Bem, apertado no Cuidado, curto e irregular no
 * Perigo). Oculta: linha pontilhada parada — "sem leitura", nunca uma linha
 * reta, que leria como morte.
 */
function ConditionStrip({ condition, owner }: { condition: InventoryCondition; owner: Pick<InventoryCharacter, 'name' | 'editable'> }) {
  const hidden = condition.kind === 'hidden'
  const word = hidden ? 'Oculta' : CONDITION_WORDS[condition.state]
  const nota = hiddenConditionLine(owner)
  const label = hidden ? `Condição oculta. ${nota}` : `Condição: ${word}`
  const path = ecgPath(hidden ? 'hidden' : condition.state)
  const style = hidden ? undefined : ({ '--pp-inv-vida': cssHex(HEALTH_BAR_COLORS[condition.state]) } as CSSProperties)
  return (
    <div className={`pp-inv-ecg pp-inv-ecg--${hidden ? 'oculta' : condition.state}`} role="img" aria-label={label} style={style}>
      <svg className="pp-inv-ecg__linha" viewBox="0 0 240 56" aria-hidden="true" focusable="false">
        <path className="pp-inv-ecg__traco" d={path} />
        {!hidden && (
          <>
            <path className="pp-inv-ecg__halo" d={path} pathLength={100} />
            <path className="pp-inv-ecg__rastro" d={path} pathLength={100} />
            <path className="pp-inv-ecg__cabeca" d={path} pathLength={100} />
          </>
        )}
      </svg>
      <p className="pp-inv-ecg__estado">{word}</p>
      {hidden && <p className="pp-inv-ecg__nota">{nota}</p>}
    </div>
  )
}

interface GridProps {
  owner: string
  slots: InventorySlot[]
  index: number
  slotRef: RefObject<HTMLButtonElement | null>
  /** O id do texto do visor: a vaga escolhida aponta para ele, e o leitor de tela lê o que o item é ao chegar nela. */
  describedBy: string
  onSelect: (at: number) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, at: number) => void
}

/** Rótulo da vaga para o leitor de tela: o nome, quando conta, quantos e, aceso, que está aceso (como na mochila do mestre). */
function slotLabel(slot: InventorySlot): string {
  if (slot.kind === 'moedas') return `Moedas: ${slot.quantidade}`
  const partes = [slot.quantidade > 1 ? `${slot.nome}, ${slot.quantidade} unidades` : slot.nome]
  if (slot.equipado) partes.push('equipado')
  if (slot.pente !== undefined) partes.push(textoDoPente(slot).toLocaleLowerCase('pt-BR'))
  if (slot.luz?.acesa === true) partes.push('aceso')
  return partes.join(', ')
}

/** O número do pente no canto da vaga: "3/6", ou só "3" quando a vaga não traz a capacidade. */
function penteCurto(slot: InventorySlot): string | null {
  if (slot.pente === undefined) return slot.capacidade === undefined ? null : `0/${slot.capacidade}`
  return slot.capacidade === undefined ? String(slot.pente.n) : `${slot.pente.n}/${slot.capacidade}`
}

/**
 * A grade: 4 colunas em qualquer largura. As vagas vazias (o X do RE) só
 * completam o desenho — fora da árvore de acessibilidade e fora do foco.
 */
function Grid({ owner, slots, index, slotRef, describedBy, onSelect, onKeyDown }: GridProps) {
  const cells: (InventorySlot | null)[] = [...slots, ...Array.from({ length: emptySlotCount(slots.length) }, () => null)]
  const rows: (InventorySlot | null)[][] = []
  for (let at = 0; at < cells.length; at += INVENTORY_COLUMNS) rows.push(cells.slice(at, at + INVENTORY_COLUMNS))

  if (slots.length === 0) {
    return (
      <div className="pp-inv__grade" aria-hidden="true">
        {rows.map((row, r) => (
          <div key={r} className="pp-inv__fila">
            {row.map((_, c) => (
              <div key={c} className="pp-inv__vazia" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="pp-inv__grade" role="grid" aria-label={`Itens de ${owner}`}>
      {rows.map((row, r) => {
        const filled = row.some((cell) => cell !== null)
        return (
          <div key={r} className="pp-inv__fila" role={filled ? 'row' : undefined} aria-hidden={filled ? undefined : true}>
            {row.map((slot, c) => {
              const at = r * INVENTORY_COLUMNS + c
              if (slot === null) return <div key={`vazia-${c}`} className="pp-inv__vazia" aria-hidden="true" />
              const chosen = at === index
              // ITEM QUE ILUMINA: a vaga acesa ganha o claro morno por dentro (`data-acesa`, como a mochila do mestre).
              const acesa = slot.luz?.acesa === true
              const pente = penteCurto(slot)
              return (
                <div key={slot.key} role="gridcell" aria-selected={chosen} className="pp-inv__vaga" data-acesa={acesa ? '' : undefined} data-equipado={slot.equipado ? '' : undefined}>
                  <button
                    ref={chosen ? slotRef : undefined}
                    type="button"
                    className="pp-inv__item"
                    tabIndex={chosen ? 0 : -1}
                    title={acesa ? `${slot.nome}, aceso` : undefined}
                    aria-label={slotLabel(slot)}
                    aria-describedby={chosen ? describedBy : undefined}
                    onClick={() => onSelect(at)}
                    onKeyDown={(event) => onKeyDown(event, at)}
                  >
                    <ImagemOuGlifo slot={slot} className="pp-inv__glifo" />
                    <span className="pp-inv__rotulo" aria-hidden="true">
                      {slot.nome}
                    </span>
                    {(slot.kind === 'moedas' || slot.quantidade > 1) && (
                      <span className="pp-inv__qtd" aria-hidden="true">
                        {slot.quantidade}
                      </span>
                    )}
                    {/* E5a: o "em uso" (o E do protótipo) e o pente, como na mochila do mestre. O rótulo da vaga diz os dois. */}
                    {slot.equipado && (
                      <span className="pp-inv__eq" aria-hidden="true">
                        E
                      </span>
                    )}
                    {pente !== null && (
                      <span className="pp-inv__pente" aria-hidden="true">
                        {pente}
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

interface ActionsProps {
  slot: InventorySlot
  character: InventoryCharacter
  step: Step
  valor: string
  busy: boolean
  refs: {
    actionRef: RefObject<HTMLButtonElement | null>
    colleagueRef: RefObject<HTMLButtonElement | null>
    fieldRef: RefObject<HTMLInputElement | null>
  }
  onValor: (valor: string) => void
  onStartPagar: () => void
  onStartDar: () => void
  /** As ações do tipo da vaga (`opcoesDaVaga`), já sem as que esta tela não sabe fazer. */
  opcoes: OpcaoDaVaga[]
  /** As balas da mochila que a arma aceita: as escolhas do "Com qual bala?". */
  balas: InventorySlot[]
  /** O "Dar" pergunta quantos (a pilha de uma vaga só, com o pedido novo). */
  darComQuantidade: boolean
  podeLargar: boolean
  onFazer: (opcao: OpcaoDaVaga) => void
  onRecarregarCom: (bala: InventorySlot) => void
  onUsarEm: (alvoTokenId: string, alvoNome: string) => void
  onLargar: () => void
  onLargarQuantos: (quantidade: number) => void
  onChooseGive: (colleague: InventoryColleague, quantidade?: number) => void
  onChoosePay: (colleague: InventoryColleague, quantidade: number) => void
  onBack: () => void
}

/**
 * O que dá para fazer com a vaga (E5a, protótipo "Tela do jogador"): as ações do TIPO do item
 * (Equipar ou Guardar, Recarregar, Jogar, Usar, Acender), depois "Dar item" e "Largar", que valem
 * para todo item; na bolsa, "Pagar a…". Botão que não vale agora fica desligado com o motivo ao
 * lado ("O pente está cheio"), nunca escondido: o jogador sabe que existe e o que falta.
 * Escolher o colega já dá ou paga, sem a pergunta "Sim/Não" (decisão 8 do mestre); a frase de
 * depois diz o que foi.
 *
 * "Dar a quem?", "Pagar", "Usar em quem?", "Com qual bala?" e "Quantos largar?" têm a mesma forma,
 * como a janela de comandos do RE3: duas fileiras da altura de um botão. Em cima, o que se
 * pergunta (ou o campo da quantidade) e, no canto direito, o "Voltar"; embaixo, as respostas.
 *
 * Num valor que não vale, as respostas ficam indisponíveis com o aviso como motivo, até o valor
 * voltar a valer. `aria-disabled`, e não `disabled`, como no zoom do mapa: o botão desligado de
 * verdade não pega foco, e o toque nele jogava o foco do campo para fora da janela (no celular,
 * fechando o teclado). O clique não faz nada: devolve o foco ao campo, onde está o conserto.
 */
function Actions(props: ActionsProps) {
  const { slot, character, step, refs, onBack } = props
  const questionId = useId()

  if (step.kind === 'dar' || step.kind === 'pagar' || step.kind === 'largar') return <PassoComQuantidade {...props} />

  if (step.kind === 'usar' || step.kind === 'recarregar') {
    const usar = step.kind === 'usar'
    const escolhas = usar
      ? [{ id: character.tokenId, nome: `Em ${character.editable ? 'mim' : character.name}` }, ...character.colleagues.map((c) => ({ id: c.tokenId, nome: c.name }))]
      : props.balas.map((bala) => ({ id: bala.key, nome: bala.quantidade > 1 ? `${bala.nome} (${bala.quantidade})` : bala.nome }))
    return (
      <div className="pp-inv__passo">
        <div className="pp-inv__passo-topo">
          <p id={questionId} className="pp-inv__pergunta">
            {usar ? `Usar ${slot.nome} em quem?` : 'Recarregar com qual bala?'}
          </p>
          <button type="button" className="pp-button pp-inv__acao pp-inv__acao--nao" onClick={onBack}>
            Voltar
          </button>
        </div>
        <div className="pp-inv__passo-escolhas">
          <ul className="pp-inv__colegas" aria-labelledby={questionId}>
            {escolhas.map((escolha, i) => (
              <li key={escolha.id}>
                <button
                  ref={i === 0 ? refs.colleagueRef : undefined}
                  type="button"
                  className="pp-button pp-inv__acao"
                  onClick={() => {
                    if (usar) {
                      props.onUsarEm(escolha.id, escolha.id === character.tokenId ? character.name : escolha.nome)
                      return
                    }
                    const bala = props.balas.find((b) => b.key === escolha.id)
                    if (bala !== undefined) props.onRecarregarCom(bala)
                  }}
                >
                  {escolha.nome}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return <PassoInicial {...props} />
}

/** O passo de entrada: as ações do tipo e, embaixo, os motivos dos botões desligados. */
function PassoInicial({ slot, character, busy, refs, opcoes, podeLargar, onStartPagar, onStartDar, onFazer, onLargar }: ActionsProps) {
  const reasonId = useId()
  const pagar = slot.kind === 'moedas'
  const semColega = character.colleagues.length === 0
  // O Enter da vaga leva à primeira ação principal que vale; sem ela, à primeira que vale.
  const alvoDoEnter = opcoes.find((o) => o.principal && o.motivo === null) ?? opcoes.find((o) => o.motivo === null)
  const darRecebeOEnter = alvoDoEnter === undefined
  const desligadas = opcoes.filter((o) => o.motivo !== null)
  return (
    <div className="pp-inv__passo">
      <div className="pp-inv__acoes">
        {opcoes.map((opcao) => (
          <button
            key={opcao.acao}
            ref={opcao === alvoDoEnter ? refs.actionRef : undefined}
            type="button"
            className={opcao.principal ? 'pp-button pp-inv__acao pp-inv__acao--principal' : 'pp-button pp-inv__acao'}
            disabled={busy || opcao.motivo !== null}
            aria-describedby={opcao.motivo !== null ? `${reasonId}-${opcao.acao}` : undefined}
            aria-pressed={opcao.acao === 'apagar' ? true : opcao.acao === 'acender' ? false : undefined}
            onClick={() => onFazer(opcao)}
          >
            {opcao.rotulo}
          </button>
        ))}
        <button
          ref={darRecebeOEnter ? refs.actionRef : undefined}
          type="button"
          className="pp-button pp-inv__acao"
          disabled={semColega || busy}
          aria-describedby={semColega ? reasonId : undefined}
          onClick={pagar ? onStartPagar : onStartDar}
        >
          {pagar ? 'Pagar a…' : 'Dar item'}
        </button>
        {!pagar && podeLargar && (
          <button type="button" className="pp-button pp-inv__acao pp-inv__acao--nao" disabled={busy} onClick={onLargar}>
            Largar
          </button>
        )}
      </div>
      {desligadas.map((opcao) => (
        <p key={opcao.acao} id={`${reasonId}-${opcao.acao}`} className="pp-inv__motivo">
          {opcao.rotulo}: {opcao.motivo}
        </p>
      ))}
      {semColega && (
        <p id={reasonId} className="pp-inv__motivo">
          {pagar ? 'Para pagar, encoste a sua ficha na de um colega.' : 'Para dar, encoste a sua ficha na de um colega.'}
        </p>
      )}
      {semRegra(slot) && <p className="pp-inv__motivo">{SEM_REGRA}</p>}
    </div>
  )
}

/**
 * "Pagar", "Dar a quem?" (com a quantidade, na pilha) e "Quantos largar?": em cima o campo e o
 * "Voltar"; embaixo as respostas e a linha reservada do aviso de valor.
 */
function PassoComQuantidade({ slot, character, step, valor, refs, darComQuantidade, onValor, onChooseGive, onChoosePay, onLargarQuantos, onBack }: ActionsProps) {
  const questionId = useId()
  const fieldId = useId()
  const avisoId = useId()
  const pagar = step.kind === 'pagar'
  const largar = step.kind === 'largar'
  const comCampo = pagar || largar || darComQuantidade
  const maximo = pagar ? character.moedas : quantosDaVaga(slot)
  const quanto = Number(valor)
  const valido = !comCampo || (Number.isInteger(quanto) && quanto >= 1 && quanto <= maximo)
  const rotulo = pagar ? 'Quantas moedas' : largar ? 'Quantos largar' : 'Quantos dar'
  const pergunta = pagar ? 'Pagar a quem?' : 'Dar a quem?'

  function escolher(colleague: InventoryColleague) {
    if (!valido) {
      refs.fieldRef.current?.focus()
      return
    }
    if (pagar) onChoosePay(colleague, quanto)
    else onChooseGive(colleague, darComQuantidade ? quanto : undefined)
  }

  return (
    <div className="pp-inv__passo">
      <div className="pp-inv__passo-topo">
        {comCampo ? (
          <div className="pp-inv__campo">
            <label className="pp-label" htmlFor={fieldId}>
              {rotulo}
            </label>
            <input
              ref={refs.fieldRef}
              id={fieldId}
              className="pp-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={maximo}
              step={1}
              value={valor}
              aria-invalid={!valido}
              aria-describedby={valido ? undefined : avisoId}
              onChange={(event) => onValor(event.target.value)}
              onKeyDown={(event) => {
                if (largar && event.key === 'Enter' && valido) onLargarQuantos(quanto)
              }}
            />
          </div>
        ) : (
          <p id={questionId} className="pp-inv__pergunta">
            {pergunta}
          </p>
        )}
        <button type="button" className="pp-button pp-inv__acao pp-inv__acao--nao" onClick={onBack}>
          Voltar
        </button>
      </div>
      <div className="pp-inv__passo-escolhas">
        {largar ? (
          <button
            ref={refs.colleagueRef}
            type="button"
            className="pp-button pp-inv__acao"
            aria-disabled={valido ? undefined : true}
            aria-describedby={valido ? undefined : avisoId}
            onMouseDown={(event) => {
              if (!valido) event.preventDefault()
            }}
            onClick={() => {
              if (valido) onLargarQuantos(quanto)
              else refs.fieldRef.current?.focus()
            }}
          >
            Largar no chão
          </button>
        ) : (
          <>
            {comCampo && (
              <p id={questionId} className="pp-inv__pergunta">
                {pergunta}
              </p>
            )}
            <ul className="pp-inv__colegas" aria-labelledby={questionId}>
              {character.colleagues.map((colleague, i) => (
                <li key={colleague.tokenId}>
                  <button
                    ref={i === 0 && !comCampo ? refs.colleagueRef : undefined}
                    type="button"
                    className="pp-button pp-inv__acao"
                    aria-disabled={valido ? undefined : true}
                    aria-describedby={valido ? undefined : avisoId}
                    onMouseDown={(event) => {
                      if (!valido) event.preventDefault()
                    }}
                    onClick={() => escolher(colleague)}
                  >
                    {colleague.name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {/* Montado desde a entrada no passo, vazio enquanto o valor vale: o leitor de tela
            anuncia o aviso quando o texto chega, e a linha já está reservada. */}
        <p id={avisoId} className="pp-error pp-inv__aviso" role="alert">
          {valido ? '' : avisoDeValor(maximo)}
        </p>
      </div>
    </div>
  )
}

/** Quantos dá para escolher na vaga: a de um item do Acervo é uma vaga só; o pego de pino junto pelo nome vai um por vez. */
function quantosDaVaga(slot: InventorySlot): number {
  return slot.itemIds.length === 1 ? slot.quantidade : 1
}

/** A ação que esta tela sabe fazer com o que a página deu: sem o pedido da mochila, nem Equipar nem Recarregar. */
function podeFazer(opcao: OpcaoDaVaga, acende: boolean, pede: boolean, usa: boolean): boolean {
  switch (opcao.acao) {
    case 'acender':
    case 'apagar':
      return acende
    case 'usar':
      return usa
    case 'jogar':
      return true
    default:
      return pede
  }
}

/**
 * O cartão do item, só para ler: o tipo, as regras inteiras (decisão 18, quando a vaga traz a regra),
 * o que ele faz (a frase do efeito) e o estado da vaga.
 */
function CartaoDaVaga({ slot }: { slot: InventorySlot }) {
  if (slot.kind === 'moedas') return null
  const tipo = rotuloDoTipo(slot)
  const estado = estadoDaVaga(slot)
  const aceita = slot.aceita.map((m) => m.nome).join(', ')
  const regras = regrasDaVaga(slot)
  if (tipo === null && estado === '' && slot.efeitoResumo === undefined && aceita === '' && regras.length === 0) return null
  return (
    <dl className="pp-inv__cartao">
      {tipo !== null && (
        <div>
          <dt>Tipo</dt>
          <dd>{tipo}</dd>
        </div>
      )}
      {regras.length > 0 && (
        <div>
          <dt>Regras</dt>
          <dd>
            <ul className="pp-inv__regras">
              {regras.map((frase) => (
                <li key={frase}>{frase}</li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      {slot.efeitoResumo !== undefined && (
        <div>
          <dt>O que faz</dt>
          <dd>{slot.efeitoResumo}</dd>
        </div>
      )}
      {estado !== '' && (
        <div>
          <dt>Agora</dt>
          <dd>{estado}</dd>
        </div>
      )}
      {aceita !== '' && (
        <div>
          <dt>Aceita</dt>
          <dd>{aceita}</dd>
        </div>
      )}
    </dl>
  )
}

/** O aviso do "Pagar" quando o valor não vale; o molde reserva a linha dele com o mesmo texto. */
function avisoDeValor(moedas: number): string {
  return `Use um número inteiro de 1 a ${moedas}`
}

/**
 * O molde da caixa de ações: o passo "Pagar", o mais largo (o campo e o
 * "Voltar" em cima; "Pagar a quem?", os colegas e a linha do aviso de valor
 * embaixo), desenhado sem tinta na mesma célula dos passos de verdade. Numa
 * coluna estreita é ele que quebra primeiro, então a caixa fica com a altura
 * dele em todos os passos, e trocar de passo ou errar o valor não empurra
 * nada. O texto vem do CSS (`data-texto`), fora do texto da página e do leitor
 * de tela.
 */
function StepMold({ colleagues, moedas }: { colleagues: readonly InventoryColleague[]; moedas: number }) {
  return (
    <div className="pp-inv__molde" aria-hidden="true">
      <div className="pp-inv__passo">
        <span className="pp-inv__passo-topo">
          <span className="pp-inv__campo">
            <span className="pp-label" data-texto="Quantas moedas" />
            <span className="pp-input" />
          </span>
          <span className="pp-button pp-inv__acao pp-inv__acao--nao" data-texto="Voltar" />
        </span>
        <span className="pp-inv__passo-escolhas">
          <span className="pp-inv__pergunta" data-texto="Pagar a quem?" />
          <span className="pp-inv__colegas">
            {/* Sem colega, um botão vazio guarda a fileira: quando alguém encosta,
                a caixa já tem o tamanho certo e nada pula. */}
            {colleagues.length === 0 ? (
              <span className="pp-button pp-inv__acao" />
            ) : (
              colleagues.map((colleague) => <span key={colleague.tokenId} className="pp-button pp-inv__acao" data-texto={colleague.name} />)
            )}
          </span>
          <span className="pp-error pp-inv__aviso" data-texto={avisoDeValor(moedas)} />
        </span>
      </div>
    </div>
  )
}

/**
 * O desenho do item, no lugar da foto do RE, que a mesa não tem. Na vaga ele
 * tem o traço fino dos ícones da barra ("Minha ficha"); no palco do visor o
 * CSS o amplia, afina o traço na proporção e dá corpo às formas fechadas.
 * O nome vem sempre junto.
 */
/**
 * ACERVO DE ITENS: a imagem do item, quando ele tem uma (o jogador a busca por
 * URL da sala, `useImagemDaMesa`); sem ela, ou se não carregar, o desenho do nome.
 */
function ImagemOuGlifo({ slot, className }: { slot: InventorySlot; className: string }) {
  const src = useImagemDaMesa()(slot.imagem)
  const [falhou, setFalhou] = useState<string | null>(null)
  if (src === null || src === falhou) return <Glyph kind={slot.glyph} className={className} />
  return <img className={`${className} pp-inv__foto`} src={src} alt="" aria-hidden="true" onError={() => setFalhou(src)} />
}

function Glyph({ kind, className }: { kind: ItemGlyph; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {GLYPHS[kind]}
    </svg>
  )
}

const GLYPHS: Record<ItemGlyph, ReactNode> = {
  // Duas moedas empilhadas.
  moedas: (
    <>
      <ellipse cx="12" cy="7" rx="6.5" ry="2.6" />
      <path d="M5.5 7v4.5c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6V7" />
      <path d="M5.5 11.5V16c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6v-4.5" />
    </>
  ),
  // Chave de argola, dentes para baixo.
  chave: (
    <>
      <circle cx="7" cy="12" r="3.6" />
      <path d="M10.6 12H21M17.5 12v3.2M20.5 12v2.4" />
    </>
  ),
  // Folha dobrada com linhas de texto.
  papel: (
    <>
      <path d="M7 3h7.5L19 7.5V21H7Z" />
      <path d="M14.5 3v4.5H19M9.8 11.5h6.2M9.8 14.5h6.2M9.8 17.5h4" />
    </>
  ),
  // Raminho de erva: haste e três folhas.
  erva: (
    <>
      <path d="M12 21V9" />
      <path d="M12 14.5c-3.6 0-5.6-2.1-6.1-5.2 3.6 0 5.6 2.1 6.1 5.2Z" />
      <path d="M12 11.5c3.6 0 5.6-2.1 6.1-5.2-3.6 0-5.6 2.1-6.1 5.2Z" />
      <path d="M12 9c-1.6-1.5-1.6-4.2 0-6 1.6 1.8 1.6 4.5 0 6Z" />
    </>
  ),
  // Frasco de gargalo estreito, com o nível do líquido.
  frasco: (
    <>
      <path d="M9.5 3h5M10.5 3v5.2L6.3 16.3A2.5 2.5 0 0 0 8.5 20h7a2.5 2.5 0 0 0 2.2-3.7L13.5 8.2V3" />
      <path d="M7.6 14h8.8" />
    </>
  ),
  // Punhal de ponta para cima.
  arma: (
    <>
      <path d="M12 2.5 14 6v8.5h-4V6Z" />
      <path d="M7.5 14.5h9M12 14.5V19" />
      <circle cx="12" cy="20.5" r="1.2" />
    </>
  ),
  // Caixinha: o objeto genérico.
  item: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </>
  ),
}
