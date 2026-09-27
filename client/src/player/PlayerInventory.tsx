import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { HEALTH_BAR_COLORS } from '../pixi/drawTokenHealth'
import { TOKEN_CONDITION_LABELS, TOKEN_CONDITION_SYMBOLS } from '../lib/tokenConditions'
import { moedasLabel } from '../lib/troca'
import { itemNoticeText } from './itemNotice'
import type { ItemNotice } from './playerConnection'
import {
  CONDITION_WORDS,
  INVENTORY_COLUMNS,
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
  type InventoryPayer,
  type InventorySlot,
  type ItemGlyph,
  type ItemTexts,
} from './inventario'

/** Sem resposta da mesa nesse tempo, a espera vira aviso: nada gira para sempre (o host descarta pedido rápido demais sem responder). */
export const INVENTORY_PENDING_TIMEOUT_MS = 10_000

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

type Step =
  | { kind: 'idle' }
  | { kind: 'dar' }
  | { kind: 'confirmar-dar'; colleague: InventoryColleague }
  | { kind: 'pagar' }
  /** `payer`: de qual bolsa o host vai tirar (`payerFor`) — pode não ser a da ficha aberta. */
  | { kind: 'confirmar-pagar'; colleague: InventoryColleague; quanto: number; payer: InventoryPayer | undefined }

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
  | { kind: 'pagar'; quanto: number; bolsasAntes: ReadonlyMap<string, number>; para: string; noticeId: number | null }

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
type FocusTarget = 'vaga' | 'acao' | 'colega' | 'sim' | 'campo'

const IDLE: Step = { kind: 'idle' }

/**
 * INVENTÁRIO ESTILO RESIDENT EVIL (tecla I). O jogo "pausa" sob um véu escuro:
 * à esquerda o retrato e a faixa da condição (o ECG do RE — Bem, Cuidado,
 * Perigo, ou oculta quando o mestre guarda a vida), à direita a grade de itens
 * com a quantidade, e no meio o item escolhido com o que dá para fazer com ele.
 * Dar e pagar passam pela pergunta "Sim/Não" do RE e saem pelas MESMAS
 * mensagens do "Comigo" — nada novo no protocolo.
 *
 * Modal de verdade: o foco entra na grade, as setas andam de vaga em vaga,
 * Enter leva às ações, Esc volta um passo (ou fecha), o Tab não sai, e fechar
 * devolve o foco a quem abriu.
 */
export function PlayerInventory({ characters, onGive, onPay, notice, onClose, instant = false, itemTexts = NO_TEXTS }: PlayerInventoryProps) {
  const titleId = useId()
  const textId = useId()
  const veilRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const slotRef = useRef<HTMLButtonElement | null>(null)
  const actionRef = useRef<HTMLButtonElement | null>(null)
  const colleagueRef = useRef<HTMLButtonElement | null>(null)
  const yesRef = useRef<HTMLButtonElement | null>(null)
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
      sim: yesRef.current,
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
    if (pending === null) return
    if (pending.kind === 'pagar') {
      if (!pagouDeUmaBolsa(pending.bolsasAntes, characters, pending.quanto)) return
      setOutcome({ tone: 'ok', text: `Você pagou ${moedasLabel(pending.quanto)} a ${pending.para}.` })
      setPending(null)
      return
    }
    const dono = characters.find((c) => c.tokenId === pending.tokenId)
    if (dono === undefined || dono.slots.some((s) => s.itemIds.includes(pending.itemId))) return
    setOutcome({ tone: 'ok', text: `${pending.nome} foi para ${pending.para}.` })
    setPending(null)
  }, [characters, pending])

  // O host recusou: o aviso novo é deste pedido.
  useEffect(() => {
    if (pending === null || notice === undefined || notice.id === pending.noticeId) return
    const recusa = (pending.kind === 'dar' && notice.phase === 'give_rejected') || (pending.kind === 'pagar' && notice.phase === 'coins_rejected')
    if (!recusa) return
    setOutcome({ tone: 'erro', text: itemNoticeText(notice) })
    setPending(null)
  }, [notice, pending])

  // Nem resposta nem mapa novo: a espera acaba com aviso.
  useEffect(() => {
    if (pending === null) return
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

  function confirmGive(colleague: InventoryColleague) {
    const itemId = selected?.itemIds[0]
    if (character === undefined || selected === undefined || itemId === undefined) return
    setStep(IDLE)
    setOutcome(null)
    if (!onGive(itemId, colleague.tokenId)) {
      setOutcome({ tone: 'erro', text: 'Não deu para enviar. Confira a conexão e tente de novo.' })
    } else {
      setPending({ kind: 'dar', tokenId: character.tokenId, itemId, nome: selected.nome, para: colleague.name, noticeId: notice?.id ?? null })
    }
    focusNext.current = 'vaga'
  }

  function confirmPay(colleague: InventoryColleague, quanto: number) {
    if (character === undefined) return
    setStep(IDLE)
    setOutcome(null)
    if (!onPay(colleague.tokenId, quanto)) {
      setOutcome({ tone: 'erro', text: 'Não deu para enviar. Confira a conexão e tente de novo.' })
    } else {
      setPending({ kind: 'pagar', quanto, bolsasAntes: bolsasPorFicha(characters), para: colleague.name, noticeId: notice?.id ?? null })
    }
    focusNext.current = 'vaga'
  }

  const statusText =
    pending !== null
      ? pending.kind === 'dar'
        ? `Entregando a ${pending.para}…`
        : `Pagando ${moedasLabel(pending.quanto)} a ${pending.para}…`
      : (outcome?.text ?? '')

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
              {character.conditions.length > 0 && (
                <ul className="pp-inv__marcas" aria-label="Condições na ficha">
                  {character.conditions.map((c) => (
                    <li key={c} className="pp-inv__marca">
                      <span className="pp-inv__marca-cor" style={{ background: TOKEN_CONDITION_SYMBOLS[c].fill }} aria-hidden="true" />
                      {TOKEN_CONDITION_LABELS[c]}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="pp-inv__lado-grade">
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
                      <Glyph kind={selected.glyph} className="pp-inv__palco-glifo" />
                    </div>
                    {(selected.kind === 'moedas' || selected.quantidade > 1) && <span className="pp-inv__palco-qtd">{selected.quantidade}</span>}
                  </div>
                  <div className="pp-inv__detalhe-corpo">
                    {/* A placa do RE: caixa de borda fina, o nome no alto, um fio e o texto. Sem o texto do mestre, a linha do que dá para fazer, em tinta mais fraca. */}
                    <div className="pp-inv__placa">
                      <h3 className="pp-inv__detalhe-nome">{selected.nome}</h3>
                      <p id={textId} className={descricao === null ? 'pp-inv__detalhe-texto pp-inv__detalhe-texto--derivado' : 'pp-inv__detalhe-texto'}>
                        {descricao ?? slotFallbackLine(selected)}
                      </p>
                    </div>
                    {/* A caixa das ações tem sempre a altura do passo mais alto, como a
                        janela de comandos do RE3: trocar "Dar a…" por "Dar a quem?" ou
                        "Pagar" troca só o miolo, e nem o texto nem a grade saem do lugar. */}
                    <div className="pp-inv__passos">
                      <Actions
                        slot={selected}
                        character={character}
                        step={step}
                        valor={valor}
                        busy={pending !== null}
                        refs={{ actionRef, colleagueRef, yesRef, fieldRef }}
                        onValor={setValor}
                        onStart={() => {
                          setOutcome(null)
                          if (selected.kind === 'moedas') {
                            setValor('1')
                            setStep({ kind: 'pagar' })
                            focusNext.current = 'campo'
                          } else {
                            setStep({ kind: 'dar' })
                            focusNext.current = 'colega'
                          }
                        }}
                        onChooseGive={(colleague) => {
                          setStep({ kind: 'confirmar-dar', colleague })
                          focusNext.current = 'sim'
                        }}
                        onChoosePay={(colleague, quanto) => {
                          setStep({ kind: 'confirmar-pagar', colleague, quanto, payer: payerFor(colleague, quanto) })
                          focusNext.current = 'sim'
                        }}
                        onConfirm={() => {
                          if (step.kind === 'confirmar-dar') confirmGive(step.colleague)
                          else if (step.kind === 'confirmar-pagar') confirmPay(step.colleague, step.quanto)
                        }}
                        onBack={back}
                      />
                      <StepMold colleagues={character.colleagues} />
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

/** Rótulo da vaga para o leitor de tela: o nome e, quando conta, quantos. */
function slotLabel(slot: InventorySlot): string {
  if (slot.kind === 'moedas') return `Moedas: ${slot.quantidade}`
  return slot.quantidade > 1 ? `${slot.nome}, ${slot.quantidade} unidades` : slot.nome
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
              return (
                <div key={slot.key} role="gridcell" aria-selected={chosen} className="pp-inv__vaga">
                  <button
                    ref={chosen ? slotRef : undefined}
                    type="button"
                    className="pp-inv__item"
                    tabIndex={chosen ? 0 : -1}
                    aria-label={slotLabel(slot)}
                    aria-describedby={chosen ? describedBy : undefined}
                    onClick={() => onSelect(at)}
                    onKeyDown={(event) => onKeyDown(event, at)}
                  >
                    <Glyph kind={slot.glyph} className="pp-inv__glifo" />
                    <span className="pp-inv__rotulo" aria-hidden="true">
                      {slot.nome}
                    </span>
                    {(slot.kind === 'moedas' || slot.quantidade > 1) && (
                      <span className="pp-inv__qtd" aria-hidden="true">
                        {slot.quantidade}
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
    yesRef: RefObject<HTMLButtonElement | null>
    fieldRef: RefObject<HTMLInputElement | null>
  }
  onValor: (valor: string) => void
  onStart: () => void
  onChooseGive: (colleague: InventoryColleague) => void
  onChoosePay: (colleague: InventoryColleague, quanto: number) => void
  onConfirm: () => void
  onBack: () => void
}

/**
 * O que dá para fazer com a vaga: "Dar a…" num item, "Pagar a…" na bolsa. Os
 * dois só com colega encostado — sem ninguém, o botão fica desligado e a
 * frase ao lado diz como ligar. Escolhido o colega, a pergunta do RE: Sim/Não.
 */
function Actions({ slot, character, step, valor, busy, refs, onValor, onStart, onChooseGive, onChoosePay, onConfirm, onBack }: ActionsProps) {
  const reasonId = useId()
  const questionId = useId()
  const fieldId = useId()
  const pagar = slot.kind === 'moedas'
  const semColega = character.colleagues.length === 0

  if (step.kind === 'confirmar-dar' || step.kind === 'confirmar-pagar') {
    const pergunta = step.kind === 'confirmar-dar' ? `Dar ${slot.nome} a ${step.colleague.name}?` : `Pagar ${moedasLabel(step.quanto)} a ${step.colleague.name}?`
    // O host cobra de outra ficha dele (vem antes no mapa e tem saldo): a pergunta diz, antes do Sim.
    const outraBolsa = step.kind === 'confirmar-pagar' && step.payer !== undefined && step.payer.tokenId !== character.tokenId ? payerLine(step.payer) : null
    return (
      <div className="pp-inv__passo" role="group" aria-labelledby={questionId} aria-describedby={outraBolsa === null ? undefined : reasonId}>
        <p id={questionId} className="pp-inv__pergunta">
          {pergunta}
        </p>
        {outraBolsa !== null && (
          <p id={reasonId} className="pp-inv__motivo pp-inv__bolsa">
            {outraBolsa}
          </p>
        )}
        <div className="pp-inv__acoes">
          <button ref={refs.yesRef} type="button" className="pp-button pp-inv__acao" onClick={onConfirm}>
            Sim
          </button>
          <button type="button" className="pp-button pp-inv__acao pp-inv__acao--nao" onClick={onBack}>
            Não
          </button>
        </div>
      </div>
    )
  }

  // No "Dar a quem?" e no "Pagar", o "Voltar" sobe para a fileira de cima,
  // sempre no mesmo canto, e o que recebe o foco ao entrar no passo (o
  // primeiro colega, o campo de moedas) mora nessa mesma fileira: numa tela
  // de celular a fileira de baixo já passa da borda, e focar lá rolaria a
  // página e arrastaria a grade junto.
  if (step.kind === 'dar') {
    return (
      <div className="pp-inv__passo">
        <div className="pp-inv__passo-topo">
          <p id={questionId} className="pp-inv__pergunta">
            Dar a quem?
          </p>
          <ul className="pp-inv__colegas" aria-labelledby={questionId}>
            {character.colleagues.map((colleague, i) => (
              <li key={colleague.tokenId}>
                <button ref={i === 0 ? refs.colleagueRef : undefined} type="button" className="pp-button pp-inv__acao" onClick={() => onChooseGive(colleague)}>
                  {colleague.name}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="pp-button pp-inv__acao pp-inv__acao--nao" onClick={onBack}>
            Voltar
          </button>
        </div>
      </div>
    )
  }

  if (step.kind === 'pagar') {
    const quanto = Number(valor)
    const valido = Number.isInteger(quanto) && quanto >= 1 && quanto <= character.moedas
    return (
      <div className="pp-inv__passo">
        <div className="pp-inv__passo-topo">
          <div className="pp-inv__campo">
            <label className="pp-label" htmlFor={fieldId}>
              Quantas moedas
            </label>
            <input
              ref={refs.fieldRef}
              id={fieldId}
              className="pp-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={character.moedas}
              step={1}
              value={valor}
              aria-invalid={!valido}
              onChange={(event) => onValor(event.target.value)}
            />
          </div>
          <button type="button" className="pp-button pp-inv__acao pp-inv__acao--nao" onClick={onBack}>
            Voltar
          </button>
        </div>
        {!valido ? (
          <p className="pp-error" role="alert">
            Use um número inteiro de 1 a {character.moedas}
          </p>
        ) : (
          <>
            <p id={questionId} className="pp-inv__pergunta">
              Pagar a quem?
            </p>
            <ul className="pp-inv__colegas" aria-labelledby={questionId}>
              {character.colleagues.map((colleague) => (
                <li key={colleague.tokenId}>
                  <button type="button" className="pp-button pp-inv__acao" onClick={() => onChoosePay(colleague, quanto)}>
                    {colleague.name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="pp-inv__passo">
      <div className="pp-inv__acoes">
        <button
          ref={refs.actionRef}
          type="button"
          className="pp-button pp-inv__acao"
          disabled={semColega || busy}
          aria-describedby={semColega ? reasonId : undefined}
          onClick={onStart}
        >
          {pagar ? 'Pagar a…' : 'Dar a…'}
        </button>
      </div>
      {semColega && (
        <p id={reasonId} className="pp-inv__motivo">
          {pagar ? 'Para pagar, encoste a sua ficha na de um colega.' : 'Para dar, encoste a sua ficha na de um colega.'}
        </p>
      )}
    </div>
  )
}

/**
 * O molde da caixa de ações: o passo "Pagar", o mais alto, desenhado sem
 * tinta na mesma célula dos passos de verdade. A caixa fica com a altura dele
 * em todos os passos, e trocar de passo não empurra nada. O texto vem do CSS
 * (`data-texto`), fora do texto da página e do leitor de tela.
 */
function StepMold({ colleagues }: { colleagues: readonly InventoryColleague[] }) {
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
