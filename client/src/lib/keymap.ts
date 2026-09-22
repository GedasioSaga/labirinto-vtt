import type { DrawingTool } from '../types/tools'
import { FEATURES, type FeatureFlags } from './features'

/**
 * Mapa de teclado — itens 5 e 7 do `docs/PLANO-REFINAMENTO.md` (Onda 1,
 * frente C). PURO: só decide "esta tecla significa o quê", não mexe em DOM,
 * store nem `PixiCanvas.tsx`. Quem liga isto a `window.addEventListener`
 * é o integrador da onda — ver o bloco "CONTRATO" no relatório do agente
 * para o trecho pronto para colar.
 *
 * Por que existe: hoje só há Ctrl+Z/Ctrl+Y (App.tsx:161-178). Trocar de
 * ferramenta é sempre olho→barra→clique→olho — dezenas de vezes por sessão
 * (diagnóstico do plano, item 5).
 */

/**
 * Forma mínima de um evento de teclado que `resolveShortcut` precisa —
 * assinatura pedida pelo integrador para que a função não dependa de
 * `KeyboardEvent`/DOM e continue testável sem jsdom. `targetTagName` é
 * `event.target.tagName` (sempre maiúsculo no DOM real, ex. `'INPUT'`) ou
 * `''` quando não há elemento focado.
 */
export interface ShortcutEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  targetTagName: string
  /** `type` do INPUT focado, em minúsculas (`'checkbox'`, `'text'`…); ignorado
   *  nas outras tags. Ausente num INPUT = campo de texto, o lado seguro: na
   *  dúvida a letra continua sendo letra. */
  targetInputType?: string
  /** O alvo é `contenteditable` — digita como um campo, mesmo sem ser INPUT. */
  targetContentEditable?: boolean
  /** Há rascunho ponto a ponto aberto (Região, Área poligonal, Chão corredor).
   *  Com ele, Ctrl+Z e Backspace tiram o último ponto do rascunho. */
  hasPointDraft?: boolean
}

export type Action =
  | { kind: 'selectTool'; tool: DrawingTool }
  /** dx/dy já vêm na unidade certa: célula de grade quando `fine` é falso
   *  (1 célula sem modificador, 10 com Shift), pixel cru quando `fine` é
   *  verdadeiro (Alt) — quem multiplica por `map.grid` é o integrador, que
   *  é quem tem o mapa em mãos; esta função não recebe grid nenhum. */
  | { kind: 'nudge'; dx: number; dy: number; fine: boolean }
  | { kind: 'duplicate' }
  | { kind: 'save' }
  | { kind: 'open' }
  | { kind: 'zoomReset' }
  | { kind: 'selectAll' }
  | { kind: 'fitAll' }
  | { kind: 'cancel' }
  | { kind: 'deleteSelected' }
  | { kind: 'undo' }
  | { kind: 'redo' }
  /** Tira o último ponto do rascunho aberto; sem ponto sobrando, cancela o rascunho. */
  | { kind: 'undoDraftPoint' }
  /** `?` — alterna o pino selecionado entre "!" e "?". Sem pino selecionado,
   *  quem executa não faz nada: a tecla fica livre para outro papel. */
  | { kind: 'togglePinType' }

/**
 * Tabela ferramenta → letra, para o integrador mostrar no `data-tip` de cada
 * botão (item 6 do plano — atalho invisível é atalho inexistente). Segue
 * V/W/R/O/L/P/E/T de Figma/Excalidraw onde a convenção existe (select,
 * rect, ellipse, line, brush/pen, eraser, text); o resto do léxico é
 * específico deste VTT (sem equivalente em nenhuma das duas ferramentas),
 * então a letra é mnemônica onde deu (circle→C, stair→S, measure→M) e livre
 * onde não sobrou letra óbvia (light→H porque L já é line; region→G;
 * polygon→A, pensando na "Área poligonal" do rótulo em pt-BR).
 *
 * `Record<DrawingTool, string>` é exaustivo por construção: se `DrawingTool`
 * ganhar uma ferramenta nova e este objeto não for atualizado, `tsc` recusa
 * compilar (falta a chave) — a tabela não pode ficar desatualizada em
 * silêncio.
 */
export const TOOL_SHORTCUTS: Record<DrawingTool, string> = {
  select: 'V',
  wall: 'W',
  door: 'D',
  light: 'H',
  region: 'G',
  room: 'N',
  roomCircle: 'J',
  roomPolygon: 'Q',
  // Sala livre NASCEU SEM ATALHO, e isso é decisão de integração, não esquecimento:
  // ela e o Pino foram construídos em árvores separadas no mesmo dia e as duas
  // escolheram 'Y', a última letra livre (F é "enquadrar tudo" e Z fica reservada
  // ao Ctrl+Z, para quem erra o Ctrl não trocar de ferramenta sem querer). Duas
  // ferramentas na mesma letra fazem o índice letra→ferramenta perder uma delas
  // em silêncio. O Pino ficou com Y por ser anotação avulsa, usada no meio do
  // desenho; a Sala livre é a quarta forma da família Sala e o caminho natural
  // dela é o botão, ao lado de Sala, Sala Circular e Polígono Regular.
  // String vazia = sem letra; `buildToolByLetter` pula.
  roomFree: '',
  stair: 'S',
  token: 'K',
  prop: 'B',
  brush: 'P',
  line: 'L',
  circle: 'C',
  ellipse: 'O',
  rect: 'R',
  polygon: 'A',
  curve: 'U',
  text: 'T',
  measure: 'M',
  eraser: 'E',
  // Chão: nenhuma letra mnemônica sobrou (C/H/A ocupadas); I é livre e
  // X/Y/Z seguem sem atalho de propósito (keymap.test.ts).
  floor: 'I',
  // Zona oculta: todas as letras mnemônicas já estavam ocupadas; X ("área
  // riscada") era uma das livres. Z segue sem atalho.
  concealZone: 'X',
  // Pino (ponto de interesse): P é do Pincel e I do Chão; Y era a única letra
  // livre além de Z.
  pin: 'Y',
  // Caminho nasce SEM letra, pelo mesmo motivo da Sala livre acima: quando ele
  // chegou não sobrava nenhuma (C/H/A/I/P/X/Y ocupadas; F é "enquadrar tudo" e
  // Z fica reservada ao Ctrl+Z). String vazia = `buildToolByLetter` pula, e a
  // ferramenta fica alcançável pelo botão da barra, ao lado do Chão.
  path: '',
}

/** Ferramentas escondidas por flag: a letra delas fica na tabela, mas não aciona nada. */
export function hiddenTools(flags: Readonly<FeatureFlags> = FEATURES): ReadonlySet<DrawingTool> {
  const hidden = new Set<DrawingTool>()
  if (!flags.tokenTool) hidden.add('token')
  return hidden
}

/**
 * Índice letra → ferramenta, pulando as escondidas. `TOOL_SHORTCUTS` segue
 * exaustivo; religar a ferramenta é trocar a flag, sem mexer na tabela.
 */
export function buildToolByLetter(hidden: ReadonlySet<DrawingTool>): Map<string, DrawingTool> {
  const byLetter = new Map<string, DrawingTool>()
  for (const tool of Object.keys(TOOL_SHORTCUTS) as DrawingTool[]) {
    // `Object.keys` devolve `string[]` na lib padrão do TS — limitação
    // conhecida da própria assinatura, não imprecisão nossa: `TOOL_SHORTCUTS`
    // é `Record<DrawingTool, string>` EXAUSTIVO (comentário acima), então toda
    // chave que sai daqui é garantidamente uma `DrawingTool` de verdade.
    if (hidden.has(tool)) continue
    const letra = TOOL_SHORTCUTS[tool]
    // Ferramenta sem letra (string vazia) fica fora do índice: só a barra a
    // alcança. Sem esta guarda, todas elas colidiriam na chave ''.
    if (letra.length === 0) continue
    byLetter.set(letra.toLowerCase(), tool)
  }
  return byLetter
}

const TOOL_BY_LETTER = buildToolByLetter(hiddenTools())

type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

const ARROW_DELTA: Record<ArrowKey, { dx: number; dy: number }> = {
  // Y cresce pra baixo no canvas — mesma convenção documentada em
  // `pixi/world.ts` (`angleDegrees`) para não reinventar o sentido aqui.
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
}

function isArrowKey(key: string): key is ArrowKey {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight'
}

/**
 * Tipos de INPUT que NÃO recebem digitação: marcar, escolher, arrastar,
 * apertar. Com o foco num deles a letra não tem onde cair, então ela volta a
 * ser atalho (achado 10 do passeio de 20/09/2026: clicar no interruptor
 * "Mostrar grade" matava o W até alguém clicar no mapa).
 *
 * É lista do que NÃO digita, e não do que digita, de propósito: tipo
 * desconhecido ou futuro (e o `type` ausente, que o HTML trata como `text`)
 * continua sendo campo de texto — errar para esse lado só custa um atalho,
 * errar para o outro troca de ferramenta no meio de um nome.
 */
const INPUT_QUE_NAO_DIGITA: ReadonlySet<string> = new Set([
  'checkbox',
  'radio',
  'range',
  'button',
  'submit',
  'reset',
  'color',
  'file',
  'image',
])

/**
 * O foco está num lugar onde a tecla vira TEXTO? Campo de texto (INPUT de
 * digitar, TEXTAREA), lista suspensa (SELECT, que salta pela inicial) e
 * `contenteditable`. Interruptor, rádio, controle deslizante e botão não.
 */
export function isEditableTarget(tagName: string, inputType?: string, contentEditable = false): boolean {
  if (contentEditable) return true
  if (tagName === 'TEXTAREA' || tagName === 'SELECT') return true
  if (tagName !== 'INPUT') return false
  if (inputType === undefined) return true
  return !INPUT_QUE_NAO_DIGITA.has(inputType.toLowerCase())
}

/**
 * Decide a ação para uma tecla — sem tocar em DOM, store ou `PixiCanvas`.
 * `null` significa "não é atalho nosso, deixe o navegador/campo tratar".
 *
 * REGRA CRÍTICA (risco #4 do plano): com o foco em INPUT/TEXTAREA/SELECT,
 * toda tecla que teria efeito ao digitar devolve `null` — letra de
 * ferramenta, `F`, setas (moveriam o cursor de texto) e todo combo Ctrl
 * (Ctrl+A/Z/Y já têm significado nativo de edição de texto no campo). Só
 * `Escape` escapa dessa trava, porque cancelar um rascunho de desenho não
 * atrapalha ninguém digitando — mesmo comportamento que `PixiCanvas.tsx`
 * já tem hoje para `Escape` (não checa `target`) enquanto `Delete` checa
 * (`:2051-2053`); este módulo generaliza a mesma linha de raciocínio pros
 * atalhos novos.
 */
export function resolveShortcut(evt: ShortcutEvent): Action | null {
  if (evt.key === 'Escape') return { kind: 'cancel' }
  if (isEditableTarget(evt.targetTagName, evt.targetInputType, evt.targetContentEditable)) return null

  const ctrlOrCmd = evt.ctrlKey || evt.metaKey
  const key = evt.key
  const lower = key.length === 1 ? key.toLowerCase() : key

  if (ctrlOrCmd) {
    if (lower === 'z' && evt.shiftKey) return { kind: 'redo' }
    // Com rascunho aberto o último ponto é o "último passo" do mestre;
    // desfazer o mapa aqui apagava a Sala anterior e deixava o rascunho vivo.
    if (lower === 'z') return evt.hasPointDraft ? { kind: 'undoDraftPoint' } : { kind: 'undo' }
    if (lower === 'y') return { kind: 'redo' }
    if (lower === 'd') return { kind: 'duplicate' }
    if (lower === 's') return { kind: 'save' }
    if (lower === 'o') return { kind: 'open' }
    if (lower === 'a') return { kind: 'selectAll' }
    if (key === '0') return { kind: 'zoomReset' }
    return null
  }

  if (key === 'Backspace' && evt.hasPointDraft) return { kind: 'undoDraftPoint' }
  if (key === 'Delete' || key === 'Backspace') return { kind: 'deleteSelected' }

  if (isArrowKey(key)) {
    const base = ARROW_DELTA[key]
    if (evt.altKey) {
      // Alt sempre vence sobre Shift — mesma convenção de `applySnap` em
      // `pixi/PixiCanvas.tsx:527` ("altKey INVERTE... só neste gesto").
      return { kind: 'nudge', dx: base.dx, dy: base.dy, fine: true }
    }
    const magnitude = evt.shiftKey ? 10 : 1
    return { kind: 'nudge', dx: base.dx * magnitude, dy: base.dy * magnitude, fine: false }
  }

  // A partir daqui só sobra tecla "crua" de letra única (ferramenta ou
  // `F`=enquadrar). Shift e Alt já têm significado próprio nas setas acima;
  // exigir ausência dos dois aqui evita, por exemplo, Shift+V competir no
  // futuro com um atalho de Shift+letra que venha a existir.
  //
  // `?` é a exceção, e vem ANTES da trava: ele só existe com Shift (Shift+/
  // no teclado americano e no ABNT2), então a trava o engolia sempre. Lê
  // `key`, não a tecla física, para valer em qualquer layout. Alt fica de
  // fora pelo mesmo motivo das letras.
  if (key === '?' && !evt.altKey) return { kind: 'togglePinType' }
  if (evt.shiftKey || evt.altKey) return null

  if (lower === 'f') return { kind: 'fitAll' }

  const tool = TOOL_BY_LETTER.get(lower)
  if (tool) return { kind: 'selectTool', tool }

  return null
}
