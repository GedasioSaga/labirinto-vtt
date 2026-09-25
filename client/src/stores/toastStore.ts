import { create } from 'zustand'

/**
 * FRENTE A (onda 2, plano de refinamento — item 12: NOTIFICAÇÃO).
 *
 * Fila mínima de avisos, pura o bastante para ser testada sem montar nenhum
 * componente React — todo teste chama `useToastStore.getState()` direto,
 * mesmo padrão de `useMapStore.getState()` já usado fora de componente em
 * `pixi/PixiCanvas.tsx`. `Toast.tsx` só lê `toasts` com o hook e chama
 * `dismiss`; toda a lógica de fila/tempo mora aqui.
 */

/**
 * `info` e `error` RELATAM um fato ("Mapa salvo", "não deu para abrir o
 * arquivo") e somem sozinhos. `instrucao` ENSINA: a frase pede uma ação da
 * pessoa para o gesto poder acontecer, e ela precisa da frase na tela
 * ENQUANTO cumpre — ler, achar o botão, abrir o seletor do sistema, procurar
 * o arquivo. Esse não tem prazo: quem apaga é ela, pelo "Dispensar aviso".
 *
 * A fronteira, e por que ela não é "todo erro fica", estão em
 * `lib/erroQueEnsina.ts`.
 */
export type ToastKind = 'info' | 'error' | 'instrucao'

/** Botão de um aviso. Clicar roda `run` e dispensa o aviso (salvo `mantem`). */
export interface ToastAction {
  label: string
  /**
   * `resposta`: o que a pessoa escreveu no campo do aviso (`ToastMessage.resposta`),
   * já aparado; `''` com o campo vazio. Aviso sem campo, e o "Deixar todos", não passam nada.
   */
  run: (resposta?: string) => void
  /**
   * A ação que o "Deixar todos" da caixa roda por este aviso
   * (`components/caixaDeAvisos.ts`). Marcada, e não "a primeira": a ordem
   * dos botões é de desenho, e trocar a ordem não pode trocar o que o lote faz.
   */
  emLote?: boolean
  /**
   * O botão age SEM tirar o aviso da tela. É o "Ir lá" do chamado e da ação
   * no ponto: ir ver o lugar não responde nada, e a linha precisa continuar
   * para o "Visto"/"Responder" ou o "Nada aqui"/"Feito" depois.
   */
  mantem?: boolean
}

/**
 * Aviso que pede um TEXTO de volta (o "Responder" do chamado do jogador): o
 * botão `rotulo` abre um campo na própria linha, e enviar roda `enviar` com o
 * texto aparado e tira o aviso. Texto vazio não envia.
 */
export interface ToastResposta {
  rotulo: string
  maxLength: number
  enviar: (texto: string) => void
  /**
   * Respostas prontas mostradas com o campo aberto (os motivos recentes do
   * "Não, porque…"): tocar numa envia ela. Função, e não lista, porque o
   * aviso nasce antes das respostas dadas enquanto ele espera. Ausente = nenhuma.
   */
  recentes?: () => readonly string[]
}

/**
 * Campo de texto do aviso, acima dos botões: quem responde a pergunta escreve
 * junto ("o que Severa diz"). O texto vai para a `run` do botão apertado.
 */
export interface ToastReplyField {
  /** O rótulo visível do campo ("Resposta só para Ana (opcional)"). */
  rotulo: string
  maxLength: number
}

export interface ToastMessage {
  id: string
  kind: ToastKind
  text: string
  /**
   * Botões do aviso, na ordem. Ausente = só o "Dispensar aviso". É o que faz
   * um aviso virar pergunta ("Grog quer passar…": Deixar ir / Não).
   */
  actions?: ToastAction[]
  /**
   * O que o × ("Dispensar aviso") faz além de tirar o aviso da tela. Aviso
   * que pergunta não pode sumir sem resposta: quem espera do outro lado
   * ficaria esperando para sempre.
   */
  onDismiss?: () => void
  /**
   * Nome do grupo do aviso ("Pedidos"). Com dois ou mais avisos do mesmo
   * grupo na tela, eles viram UMA caixa "Pedidos (N)" em vez de uma pilha de
   * avisos soltos (`components/caixaDeAvisos.ts`). Ausente = aviso de sempre.
   */
  grupo?: string
  /**
   * Este aviso abre a caixa do `grupo` mesmo sozinho: "Pedidos (1)". É o
   * pedido da porta trancada — o mestre pode estar noutra cena, e o título
   * da caixa é o que diz a ele que alguém espera resposta. Ausente = a regra
   * de sempre (caixa só a partir de dois).
   */
  sempreEmCaixa?: boolean
  /**
   * Campo de resposta do aviso, de um de dois jeitos: `ToastResposta` (com
   * `enviar`: o "Responder" do chamado, depois dos botões, manda o texto
   * sozinho) ou `ToastReplyField` (sem `enviar`: campo acima dos botões, o
   * texto vai com o botão apertado). Ausente = o aviso não pede texto.
   */
  resposta?: ToastResposta | ToastReplyField
  /** Dentro da caixa do grupo, sobe para o topo (o chamado "Urgente"). A ordem de chegada vale entre iguais. */
  urgente?: true
  /**
   * Linha pequena embaixo do texto que muda sozinha enquanto o aviso espera
   * ("há 3 min · agora a 20 casas do pino"): a tela relê de tempos em tempos
   * (`DETALHE_RELEITURA_MS` em `Toast.tsx`). `''` = nada a mostrar agora.
   * Função, e não texto: a idade anda com o relógio, sem ninguém empurrar
   * aviso novo.
   */
  detalhe?: () => string
}

/** Extras de `push`: botões, o que o × faz, o grupo, se ele abre a caixa sozinho, o campo de resposta, a urgência e a linha viva. */
export interface ToastExtras {
  actions?: ToastAction[]
  onDismiss?: () => void
  grupo?: string
  sempreEmCaixa?: boolean
  resposta?: ToastResposta | ToastReplyField
  urgente?: boolean
  detalhe?: () => string
}

interface ToastState {
  toasts: ToastMessage[]
  /**
   * Empilha um aviso e agenda a auto-dispensa. Devolve o `id` gerado — quem
   * chama pode ignorar, ou guardar para dispensar cedo (não usado hoje, mas
   * mantém a action simétrica com `dismiss`).
   *
   * `durationMs: null` (o padrão de `instrucao`) não agenda timer nenhum: o
   * aviso fica até alguém chamar `dismiss`. Passar `null` num `info` é
   * legítimo e faz a mesma coisa — o `kind` escolhe o padrão, não a regra.
   */
  push: (kind: ToastKind, text: string, durationMs?: number | null, extras?: ToastExtras) => string
  /** Dispensa por `id`, na mão (botão) ou pelo próprio timer de `push`. Idempotente: `id` que já não está na fila é um no-op silencioso. */
  dismiss: (id: string) => void
}

/**
 * Info some sozinho rápido; erro fica mais tempo porque normalmente pede
 * atenção (nome de arquivo, o que falhou).
 *
 * `instrucao: null` é o conserto de 21/09/2026 (jornada
 * `e2e/task-jornada-salvar-sem-foto-avisa.spec.ts`): o aviso de "este token
 * ainda não tem foto — escolha uma imagem" se apagava aos 7 s, no meio da
 * leitura, e não sobrava lugar nenhum na tela para reencontrá-lo. Prazo maior
 * não resolve — qualquer número seria o app apostando em quanto tempo a
 * pessoa leva para achar um arquivo na pasta dela. Sem prazo, quem decide que
 * já leu é ela.
 */
const DEFAULT_DURATION_MS: Record<ToastKind, number | null> = {
  info: 4000,
  error: 7000,
  instrucao: null,
}

/**
 * Timer de auto-dispensa por `id`, fora do state de propósito:
 * `ReturnType<typeof setTimeout>` não é dado de UI (não deve disparar
 * re-render) e só precisa existir para poder ser cancelado — mesmo padrão de
 * `sliderCommitTimers` em `App.tsx:187`, só que aqui module-scoped porque a
 * store (não um componente) é dona do ciclo de vida do timer.
 */
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],

  push: (kind, text, durationMs = DEFAULT_DURATION_MS[kind], extras = {}) => {
    const id = crypto.randomUUID()
    // Os extras só entram quando existem: o aviso simples continua exatamente `{ id, kind, text }`.
    const toast: ToastMessage = { id, kind, text }
    if (extras.actions !== undefined && extras.actions.length > 0) toast.actions = extras.actions
    if (extras.onDismiss !== undefined) toast.onDismiss = extras.onDismiss
    if (extras.grupo !== undefined) toast.grupo = extras.grupo
    if (extras.sempreEmCaixa === true) toast.sempreEmCaixa = true
    if (extras.resposta !== undefined) toast.resposta = extras.resposta
    if (extras.urgente === true) toast.urgente = true
    if (extras.detalhe !== undefined) toast.detalhe = extras.detalhe
    set((state) => ({ toasts: [...state.toasts, toast] }))
    if (durationMs !== null) {
      timers.set(
        id,
        setTimeout(() => {
          get().dismiss(id)
        }, durationMs),
      )
    }
    return id
  },

  dismiss: (id) => {
    const timer = timers.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.delete(id)
    }
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  },
}))
