import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import type { ToastMessage, ToastResposta } from '../stores/toastStore'
import { agruparAvisos, deixarTodos, temRespostaEmLote, tituloDaCaixa } from './caixaDeAvisos'
import './Toast.css'

interface ToastProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
  /**
   * O relógio dos avisos para: o ponteiro entrou num aviso, ou o foco entrou
   * na pilha (`usePausaEnquantoLe`). Sem ele, os avisos somem no prazo de
   * sempre — o caso dos testes que não tratam de tempo.
   */
  onPausar?: () => void
  /** O ponteiro e o foco saíram da pilha, ou ela saiu da tela: o relógio volta a correr. */
  onRetomar?: () => void
}

/**
 * FRENTE A (onda 2, plano de refinamento — item 12: NOTIFICAÇÃO).
 *
 * Empilha os avisos de `useToastStore` no canto da tela. Não lê a store
 * direto (recebe `toasts`/`onDismiss` por prop) — mesma escolha de
 * `ZoomHud.tsx` (recebe `scale`/`onReset`), deixa o componente testável sem
 * precisar montar a store real e dá ao integrador o mesmo ponto de wiring
 * (um `useToastStore()` + `useToastStore.getState().dismiss` em `App.tsx`).
 *
 * Acessibilidade: cada aviso tem `role="alert"` (erro e instrução —
 * interrompe o leitor de tela) ou `role="status"` (info, anuncia sem
 * interromper — mesmo papel já usado no hint da Toolbar, `Toolbar.tsx:307`).
 * A instrução entra com `alert` de propósito: ela é o único aviso que a
 * pessoa PRECISA ouvir inteiro, porque o gesto dela não foi adiante. O nome
 * acessível é o
 * PRÓPRIO texto do aviso (conteúdo, não `aria-label`) — estável e é
 * exatamente o que a spec e2e deve procurar com
 * `getByRole('alert', { name: '...' })` / `getByRole('status', { name: '...' })`.
 * O botão de dispensar tem `aria-label` fixo ("Dispensar aviso"), igual para
 * todo toast — não inclui o texto do aviso porque um leitor de tela já leu o
 * texto do próprio card antes de chegar no botão.
 *
 * Aviso com `actions` (pedido de passagem do jogador) ganha os botões embaixo
 * do texto, na ordem: o primeiro é a resposta esperada (latão), os outros são
 * a alternativa. O × de um aviso desses roda `onDismiss` — a pergunta nunca
 * some sem resposta. Aviso com `resposta` ganha também um campo de texto, de
 * um de dois jeitos: com `enviar` (o "Responder" do chamado), um botão que
 * abre o campo na linha e manda o texto sozinho; sem `enviar` (pedido de ação
 * sobre ficha), um campo acima dos botões, e o que se escreve nele vai com o
 * botão apertado.
 *
 * Avisos de mesmo `grupo` (os pedidos de passagem), dois ou mais, viram UMA
 * caixa — ver `CaixaDeAvisos` e a regra em `caixaDeAvisos.ts`. O pedido da
 * porta trancada (`sempreEmCaixa`) abre a caixa mesmo sozinho: "Pedidos (1)".
 *
 * Nenhum aviso some enquanto é lido: com o ponteiro em cima de um deles, ou o
 * foco dentro da pilha, o relógio de todos para (`onPausar`/`onRetomar`).
 */
export function Toast({ toasts, onDismiss, onPausar, onRetomar }: ToastProps) {
  const pilhaRef = useRef<HTMLDivElement>(null)
  usePausaEnquantoLe(pilhaRef, toasts, onPausar, onRetomar)
  // Mora aqui, e não na linha: a linha é desmontada quando a pilha troca de forma.
  const [respostasEmCurso] = useState(() => new Map<string, RespostaEmCurso>())
  // O texto dos campos acima dos botões mora AQUI, por id de aviso, e não no
  // campo: chegar o 2º pedido troca o aviso solto pela caixa (outro
  // componente), e o que o mestre já tinha escrito não pode sumir no meio da frase.
  const [textos, setTextos] = useState<Readonly<Record<string, string>>>({})

  // Aviso que saiu da pilha (respondido, apagado pelo mestre ou pelo jogador) leva junto o rascunho.
  useEffect(() => {
    const presentes = new Set(toasts.map((toast) => toast.id))
    for (const id of respostasEmCurso.keys()) if (!presentes.has(id)) respostasEmCurso.delete(id)
  }, [toasts, respostasEmCurso])

  const vivos = new Set(toasts.map((toast) => toast.id))
  const rascunhos: Rascunhos = {
    de: (id) => textos[id] ?? '',
    // Aviso que já saiu da tela leva o rascunho junto: o mapa não cresce sem fim.
    escrever: (id, texto) => setTextos((atual) => ({ ...Object.fromEntries(Object.entries(atual).filter(([chave]) => vivos.has(chave))), [id]: texto })),
  }

  if (toasts.length === 0) return null

  return (
    <RespostasEmCurso.Provider value={respostasEmCurso}>
      <div ref={pilhaRef} className="lb-toaststack">
        {agruparAvisos(toasts).map((item) =>
          item.tipo === 'aviso' ? (
            <AvisoSolto key={item.toast.id} toast={item.toast} onDismiss={onDismiss} rascunhos={rascunhos} />
          ) : (
            <CaixaDeAvisos key={`grupo:${item.grupo}`} grupo={item.grupo} toasts={item.toasts} onDismiss={onDismiss} rascunhos={rascunhos} />
          ),
        )}
      </div>
    </RespostasEmCurso.Provider>
  )
}

/** Por que a pilha está parada. Os dois `false`: o relógio corre. */
interface MotivosDaPausa {
  ponteiro: boolean
  foco: boolean
}

/**
 * Segura os avisos enquanto a pessoa lê: o ponteiro em cima de um aviso, ou o
 * foco num botão ou campo da pilha, chamam `onPausar`; os dois fora,
 * `onRetomar`. Só avisa na virada (parou agora, voltou a correr agora): andar
 * de um aviso para outro, ou de um botão para outro, não chama nada.
 *
 * Ouve no `document`, e não na pilha: o aviso sob o ponteiro (ou com o foco)
 * pode sair da tela — dispensado no ×, respondido —, e dele não vem mais
 * saída nenhuma. Onde o ponteiro foi parar diz o próximo `pointerover`, venha
 * de onde vier; o foco que sumiu junto com o aviso, a conferência depois de
 * cada troca da pilha. Pilha vazia ou desmontada solta a pausa: senão o
 * próximo aviso nasceria parado e não sumiria mais.
 */
function usePausaEnquantoLe(
  pilhaRef: RefObject<HTMLDivElement | null>,
  toasts: readonly ToastMessage[],
  onPausar: (() => void) | undefined,
  onRetomar: (() => void) | undefined,
): void {
  const motivos = useRef<MotivosDaPausa>({ ponteiro: false, foco: false })
  // Os callbacks de agora, lidos na hora: o App trocar a função não reinstala
  // os ouvintes — nem solta a pausa no meio da leitura.
  const avisar = useRef({ onPausar, onRetomar })
  useLayoutEffect(() => {
    avisar.current = { onPausar, onRetomar }
  }, [onPausar, onRetomar])

  const marcar = useCallback((motivo: keyof MotivosDaPausa, ativo: boolean) => {
    const antes = motivos.current.ponteiro || motivos.current.foco
    motivos.current = { ...motivos.current, [motivo]: ativo }
    const agora = motivos.current.ponteiro || motivos.current.foco
    if (agora && !antes) avisar.current.onPausar?.()
    else if (antes && !agora) avisar.current.onRetomar?.()
  }, [])

  const temAvisos = toasts.length > 0

  useEffect(() => {
    if (!temAvisos) return
    const naPilha = (alvo: EventTarget | null): boolean => alvo instanceof Node && pilhaRef.current !== null && pilhaRef.current.contains(alvo)
    const aoPassar = (event: PointerEvent) => marcar('ponteiro', naPilha(event.target))
    // `pointerout` sem destino: o ponteiro saiu da janela.
    const aoSairDaJanela = (event: PointerEvent) => {
      if (event.relatedTarget === null) marcar('ponteiro', false)
    }
    const aoFocar = (event: FocusEvent) => marcar('foco', naPilha(event.target))
    // `focusout` sem destino: o foco foi para o `body` ou para fora da janela.
    // Com destino, quem decide é o `focusin` que vem logo depois.
    const aoDesfocar = (event: FocusEvent) => {
      if (event.relatedTarget === null) marcar('foco', false)
    }
    // Na captura: `stopPropagation` de outro canto da tela não esconde a passagem.
    document.addEventListener('pointerover', aoPassar, true)
    document.addEventListener('pointerout', aoSairDaJanela, true)
    document.addEventListener('focusin', aoFocar, true)
    document.addEventListener('focusout', aoDesfocar, true)
    return () => {
      document.removeEventListener('pointerover', aoPassar, true)
      document.removeEventListener('pointerout', aoSairDaJanela, true)
      document.removeEventListener('focusin', aoFocar, true)
      document.removeEventListener('focusout', aoDesfocar, true)
      marcar('ponteiro', false)
      marcar('foco', false)
    }
  }, [temAvisos, pilhaRef, marcar])

  // O botão com o foco pode sair da pilha sem `focusout` (o nó removido não
  // avisa). Roda depois do efeito da caixa, que devolve o foco à linha
  // seguinte quando há uma: só o foco que caiu fora da pilha solta a pausa.
  useLayoutEffect(() => {
    const pilha = pilhaRef.current
    if (pilha === null || !motivos.current.foco) return
    if (!pilha.contains(document.activeElement)) marcar('foco', false)
  }, [toasts, pilhaRef, marcar])
}

/**
 * A resposta que o mestre está escrevendo num aviso, guardada pelo `id` do
 * aviso. Um chamado sozinho é aviso solto; dois ou mais viram a caixa — e a
 * troca desmonta a linha inteira (outro componente, outra chave). Sem isto o
 * campo aberto fechava, o texto se perdia e o foco caía no `body` a cada
 * chamado que chegava ou saía enquanto o mestre escrevia.
 */
interface RespostaEmCurso {
  rascunho: string
  /** O campo tinha o foco quando a linha saiu da tela: a linha nova o devolve. */
  focado: boolean
}

/**
 * Valor padrão só para `RespostaNoAviso` fora de um `Toast`, o que não
 * acontece: o `Toast` sempre fornece o mapa dele.
 */
const RespostasEmCurso = createContext(new Map<string, RespostaEmCurso>())

/** O texto de cada campo acima dos botões, por id de aviso (ver `Toast`). */
interface Rascunhos {
  de: (id: string) => string
  escrever: (id: string, texto: string) => void
}

/** O campo de resposta de um aviso, dos dois jeitos (ver `Toast`). */
type CampoDoAviso = NonNullable<ToastMessage['resposta']>

/** Com `enviar`, o campo manda o texto sozinho; sem, o texto vai com o botão apertado. */
function respostaQueEnvia(campo: CampoDoAviso): campo is CampoDoAviso & ToastResposta {
  return 'enviar' in campo
}

interface AvisoSoltoProps {
  toast: ToastMessage
  onDismiss: (id: string) => void
  rascunhos: Rascunhos
}

function AvisoSolto({ toast, onDismiss, rascunhos }: AvisoSoltoProps) {
  return (
    <div role={toast.kind === 'info' ? 'status' : 'alert'} className={`lb-panel lb-toast lb-toast--${toast.kind}`}>
      <div className="lb-toast__body">
        <span className="lb-toast__text">{toast.text}</span>
        {toast.detalhe !== undefined && <DetalheVivo ler={toast.detalhe} />}
        {/* O primeiro botão é a resposta esperada; os outros, a alternativa. */}
        <AcoesDoAviso toast={toast} rascunhos={rascunhos} classeDoPrimeiro="lb-btn lb-btn--primary" onResponder={() => onDismiss(toast.id)} />
      </div>
      <button
        type="button"
        className="lb-toast__dismiss"
        onClick={() => {
          onDismiss(toast.id)
          toast.onDismiss?.()
        }}
        aria-label="Dispensar aviso"
      >
        ×
      </button>
    </div>
  )
}

interface CaixaDeAvisosProps {
  grupo: string
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
  rascunhos: Rascunhos
}

/**
 * A caixa "Pedidos (N)": uma linha por aviso, cada uma com os botões dela, e
 * "Deixar todos" embaixo. É uma `region` com nome, não um diálogo modal: o
 * mestre continua mexendo no mapa enquanto os pedidos esperam.
 *
 * Sem ×: cada linha já tem o "Não", e fechar a caixa inteira sumiria com
 * perguntas que alguém do outro lado está esperando.
 *
 * O foco: responder uma linha pelo teclado tira o botão focado da tela. Se o
 * foco estava na caixa e ela continua, ele volta para o primeiro botão da
 * linha seguinte — senão cairia no `body` e quem usa teclado recomeçaria do
 * topo da página a cada resposta.
 */
function CaixaDeAvisos({ grupo, toasts, onDismiss, rascunhos }: CaixaDeAvisosProps) {
  const caixaRef = useRef<HTMLElement>(null)
  const devolverFoco = useRef(false)
  const titulo = tituloDaCaixa(grupo, toasts.length)
  // Caixa de uma linha só (o pedido da porta, `sempreEmCaixa`): "Deixar todos"
  // repetiria o botão da linha, e a resposta esperada volta a ser de latão.
  const variasLinhas = toasts.length > 1

  useLayoutEffect(() => {
    if (!devolverFoco.current) return
    devolverFoco.current = false
    caixaRef.current?.querySelector('button')?.focus()
  }, [toasts.length])

  /** Guarda se o foco estava aqui antes de a resposta tirar o botão da tela. */
  const lembrarFoco = () => {
    const caixa = caixaRef.current
    devolverFoco.current = caixa !== null && caixa.contains(document.activeElement)
  }

  return (
    <section ref={caixaRef} role="region" aria-label={titulo} className="lb-panel lb-toast lb-toast--instrucao lb-toastcaixa">
      {/* Polido, e não alerta: o número mudando é notícia, não interrupção. */}
      <h2 className="lb-toastcaixa__title" aria-live="polite">
        {titulo}
      </h2>
      <ul className="lb-toastcaixa__rows lb-scroll">
        {toasts.map((toast) => (
          <li key={toast.id} className="lb-toastcaixa__row">
            <span className="lb-toast__text">{toast.text}</span>
            {toast.detalhe !== undefined && <DetalheVivo ler={toast.detalhe} />}
            {/* Na linha, o botão de latão é o "Deixar todos" da caixa; aqui a
                resposta esperada só ganha o contorno cheio. Caixa de uma linha
                só: sem "Deixar todos", o latão volta para a resposta. */}
            <AcoesDoAviso
              toast={toast}
              rascunhos={rascunhos}
              classeDoPrimeiro={variasLinhas ? 'lb-btn' : 'lb-btn lb-btn--primary'}
              onResponder={() => {
                lembrarFoco()
                onDismiss(toast.id)
              }}
            />
          </li>
        ))}
      </ul>
      {/* Só com várias linhas e resposta em lote: numa caixa de chamados, ou de
          uma linha só, "Deixar todos" não quer dizer nada. */}
      {variasLinhas && temRespostaEmLote(toasts) && (
        <button type="button" className="lb-btn lb-btn--primary lb-toastcaixa__all" onClick={() => deixarTodos(toasts, onDismiss)}>
          Deixar todos
        </button>
      )}
    </section>
  )
}

/**
 * De quanto em quanto tempo a linha viva do aviso (`toast.detalhe`) se relê.
 * Um segundo: a idade anda em minutos, mas a distância muda quando a ficha
 * anda, e o mestre que olha a caixa enquanto o jogador caminha não pode ler
 * uma distância velha.
 */
export const DETALHE_RELEITURA_MS = 1000

/**
 * A linha "há 3 min · agora a 20 casas do pino" de um pedido. Só ELA relê:
 * o relógio é deste componente, e não da pilha, para o resto dos avisos (e o
 * rascunho do campo de resposta) não renderizar a cada segundo. O estado
 * guarda o último texto só para a React pular a renderização quando nada
 * mudou; o que aparece é sempre a leitura de agora.
 *
 * `aria-live="off"`: o aviso de fora é `alert`, e uma linha que muda sozinha
 * dentro dele seria lida em voz alta de novo a cada minuto.
 */
function DetalheVivo({ ler }: { ler: () => string }) {
  const [, guardarLeitura] = useState('')
  useEffect(() => {
    const relogio = setInterval(() => guardarLeitura(ler()), DETALHE_RELEITURA_MS)
    return () => clearInterval(relogio)
  }, [ler])
  const texto = ler()
  if (texto === '') return null
  return (
    <span className="lb-toast__detalhe" aria-live="off">
      {texto}
    </span>
  )
}

interface AcoesDoAvisoProps {
  toast: ToastMessage
  rascunhos: Rascunhos
  /** Classe do primeiro botão (a resposta esperada); os outros são sempre fantasma. */
  classeDoPrimeiro: string
  /** Tira o aviso da tela (e, na caixa, lembra o foco): a pergunta respondida não pode ficar clicável. */
  onResponder: () => void
}

/**
 * Os botões de um aviso, na ordem, e o campo de resposta quando o aviso pede
 * texto. O botão que `mantem` age sem tirar o aviso; os outros tiram ANTES de
 * agir — a ação pode empilhar outro aviso.
 *
 * Campo sem `enviar` (`toast.resposta`, pedido de ação sobre ficha): fica
 * acima dos botões; o mestre escreve o que o NPC responde e aperta Aceitar ou
 * Recusar, e o texto, aparado, vai para a `run` do botão. O campo é de CADA
 * aviso (por id, em `rascunhos`): na caixa, o que se escreve numa linha não
 * vaza para a outra. O texto entra no `value` do campo, nunca como HTML.
 *
 * Campo com `enviar` (o "Responder" do chamado): vira o botão de
 * `RespostaNoAviso`, depois dos outros.
 */
function AcoesDoAviso({ toast, rascunhos, classeDoPrimeiro, onResponder }: AcoesDoAvisoProps) {
  const campoId = useId()
  const campo = toast.resposta
  if (toast.actions === undefined && campo === undefined) return null
  const campoAcima = campo !== undefined && !respostaQueEnvia(campo) ? campo : undefined
  const campoQueEnvia = campo !== undefined && respostaQueEnvia(campo) ? campo : undefined
  const escrito = rascunhos.de(toast.id)
  return (
    <>
      {campoAcima !== undefined && (
        <div className="lb-toast__resposta">
          <label className="lb-toast__rotulo" htmlFor={campoId}>
            {campoAcima.rotulo}
          </label>
          <input
            id={campoId}
            className="lb-input lb-toast__campo"
            type="text"
            value={escrito}
            maxLength={campoAcima.maxLength}
            onChange={(event) => rascunhos.escrever(toast.id, event.target.value)}
          />
        </div>
      )}
      <div className="lb-toast__actions">
        {toast.actions?.map((action, index) => (
          <button
            key={action.label}
            type="button"
            className={index === 0 ? classeDoPrimeiro : 'lb-btn lb-btn--ghost'}
            onClick={() => {
              if (action.mantem !== true) onResponder()
              // Aviso sem campo acima dos botões chama como sempre chamou: sem argumento.
              if (campoAcima === undefined) action.run()
              else action.run(escrito.trim())
            }}
          >
            {action.label}
          </button>
        ))}
        {campoQueEnvia !== undefined && <RespostaNoAviso id={toast.id} texto={toast.text} resposta={campoQueEnvia} onEnviada={onResponder} />}
      </div>
    </>
  )
}

interface RespostaNoAvisoProps {
  /** O `id` do aviso: chave da resposta em curso, que sobrevive à linha. */
  id: string
  /** O texto do aviso: entra no nome do campo ("Resposta para Carla: Pergunta"). */
  texto: string
  resposta: ToastResposta
  onEnviada: () => void
}

/**
 * "Responder" dentro do aviso: o botão abre um campo na própria linha, com o
 * foco nele. Enter (ou "Enviar") manda e tira o aviso; Esc (ou "Cancelar")
 * fecha só o campo e devolve o foco ao botão — o aviso continua esperando.
 *
 * Campo aberto e texto vivem também em `RespostasEmCurso`: quando a pilha
 * troca de forma (aviso solto ↔ caixa) esta linha é desmontada e a nova
 * recomeça dali — aberta, com o rascunho, e com o foco se ele estava no campo.
 */
function RespostaNoAviso({ id, texto, resposta, onEnviada }: RespostaNoAvisoProps) {
  const memoria = useContext(RespostasEmCurso)
  const [aberta, setAberta] = useState(() => memoria.has(id))
  const [rascunho, setRascunho] = useState(() => memoria.get(id)?.rascunho ?? '')
  const botaoRef = useRef<HTMLButtonElement>(null)
  const campoRef = useRef<HTMLInputElement>(null)
  /** Para onde vai o foco no próximo abrir/fechar. */
  const focoPendente = useRef<'campo' | 'botao' | null>(null)

  useLayoutEffect(() => {
    const alvo = focoPendente.current
    focoPendente.current = null
    if (alvo === 'campo') campoRef.current?.focus()
    else if (alvo === 'botao') botaoRef.current?.focus()
  }, [aberta])

  // Na saída da linha o DOM ainda está montado: dá para saber se o foco estava
  // no campo. A linha nova lê isso ao montar — no commit, depois da saída da
  // antiga; no render ainda não daria, a antiga não tinha saído.
  useLayoutEffect(() => {
    const campo = campoRef
    if (memoria.get(id)?.focado === true) campo.current?.focus()
    return () => {
      const emCurso = memoria.get(id)
      if (emCurso === undefined) return
      memoria.set(id, { ...emCurso, focado: campo.current !== null && campo.current === document.activeElement })
    }
  }, [memoria, id])

  const abrir = () => {
    memoria.set(id, { rascunho, focado: false })
    focoPendente.current = 'campo'
    setAberta(true)
  }

  const fechar = () => {
    memoria.delete(id)
    focoPendente.current = 'botao'
    setAberta(false)
  }

  const escrever = (valor: string) => {
    memoria.set(id, { rascunho: valor, focado: false })
    setRascunho(valor)
  }

  const responderCom = (texto: string) => {
    memoria.delete(id)
    onEnviada()
    resposta.enviar(texto)
  }

  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const limpo = rascunho.trim()
    if (limpo === '') return
    responderCom(limpo)
  }

  if (!aberta) {
    return (
      <button ref={botaoRef} type="button" className="lb-btn lb-btn--ghost" onClick={abrir}>
        {resposta.rotulo}
      </button>
    )
  }

  return (
    <form className="lb-toast__reply" onSubmit={enviar}>
      <input
        ref={campoRef}
        type="text"
        className="lb-input lb-toast__reply-input"
        aria-label={`Resposta para ${texto}`}
        value={rascunho}
        maxLength={resposta.maxLength}
        onChange={(event) => escrever(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          // O Escape é deste campo: não fecha mais nada da tela junto.
          event.stopPropagation()
          fechar()
        }}
      />
      <button type="submit" className="lb-btn" disabled={rascunho.trim() === ''}>
        Enviar
      </button>
      <button type="button" className="lb-btn lb-btn--ghost" onClick={fechar}>
        Cancelar
      </button>
      <RespostasProntas recentes={resposta.recentes?.() ?? []} onEscolher={responderCom} />
    </form>
  )
}

interface RespostasProntasProps {
  recentes: readonly string[]
  onEscolher: (texto: string) => void
}

/**
 * Os motivos recentes do "Não, porque…", um botão cada: o mestre repete o
 * motivo de agora há pouco num toque, sem redigitar. Sem nenhum, nada — um
 * grupo vazio só faria o leitor de tela anunciar um nome sem conteúdo.
 */
function RespostasProntas({ recentes, onEscolher }: RespostasProntasProps) {
  if (recentes.length === 0) return null
  return (
    <div role="group" aria-label="Motivos recentes" className="lb-toast__recentes">
      {recentes.map((texto) => (
        <button key={texto} type="button" className="lb-btn lb-btn--ghost" onClick={() => onEscolher(texto)}>
          {texto}
        </button>
      ))}
    </div>
  )
}
