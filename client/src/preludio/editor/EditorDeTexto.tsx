import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { EditorContent, ReactRenderer, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import { create } from 'zustand'
import { compararTitulos, ROTULO_DO_TIPO, semAcento, textoPlano } from '../../lib/preparo/enciclopedia'
import type { TextoRico } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { urlDaMidia, useRaizDaMidia } from '../midia'
import { extensoesDoTexto, textoCabeNoEditor, type ItemDaMencao } from './extensoes'

/**
 * O EDITOR DE TEXTO DO PRELÚDIO (TipTap, licença MIT). Este arquivo e o
 * TipTap só baixam quando um texto aparece na tela (`sobDemanda.tsx`).
 *
 * - Emite o documento 250 ms depois da última tecla, ao sair do campo e ao
 *   fechar; o salvar automático da loja espera mais 800 ms antes do disco.
 * - Só emite o que mudou de verdade: abrir, clicar e mover o cursor não contam
 *   como edição (a reimportação preserva o que o mestre editou, plano §4.7).
 * - Documento com algo que o esquema não conhece abre só para leitura, em
 *   texto puro, e nunca é regravado.
 */

const ESPERA_PARA_EMITIR_MS = 250
const SUGESTOES_MAXIMAS = 8

// ─── O editor que a barra comanda ────────────────────────────────────────────

interface EditorAtivo {
  editor: Editor | null
}

/** O último editor que ganhou o foco: a barra de formatação age nele. */
const useEditorAtivo = create<EditorAtivo>()(() => ({ editor: null }))

// ─── Sugestão de @menção ─────────────────────────────────────────────────────

function sugerir(consulta: string): ItemDaMencao[] {
  const limpa = semAcento(consulta.trim())
  const achados: { pontos: number; item: ItemDaMencao }[] = []
  for (const verbete of usePreludio.getState().verbetes.values()) {
    const titulo = semAcento(verbete.titulo)
    const pontos =
      limpa === ''
        ? 1
        : titulo.startsWith(limpa)
          ? 4
          : titulo.split(/\s+/).some((palavra) => palavra.startsWith(limpa))
            ? 3
            : titulo.includes(limpa)
              ? 2
              : verbete.apelidos.some((apelido) => semAcento(apelido).includes(limpa))
                ? 1
                : 0
    if (pontos > 0) achados.push({ pontos, item: { id: verbete.id, titulo: verbete.titulo, tipo: ROTULO_DO_TIPO[verbete.tipo].um } })
  }
  achados.sort((a, b) => b.pontos - a.pontos || compararTitulos(a.item.titulo, b.item.titulo))
  return achados.slice(0, SUGESTOES_MAXIMAS).map(({ item }) => item)
}

interface ListaDeMencaoProps {
  items: ItemDaMencao[]
  query: string
  command: (item: ItemDaMencao) => void
}

interface ListaDeMencaoAlca {
  aoTeclar: (evento: KeyboardEvent) => boolean
}

const ListaDeMencao = forwardRef<ListaDeMencaoAlca, ListaDeMencaoProps>(function ListaDeMencao({ items, query, command }, ref) {
  const [ativo, setAtivo] = useState(0)
  useEffect(() => setAtivo(0), [items])
  useImperativeHandle(
    ref,
    () => ({
      aoTeclar(evento) {
        if (items.length === 0) return false
        if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
          const passo = evento.key === 'ArrowDown' ? 1 : -1
          setAtivo((atual) => (atual + passo + items.length) % items.length)
          return true
        }
        if (evento.key === 'Enter' || evento.key === 'Tab') {
          const item = items[ativo]
          if (item !== undefined) command(item)
          return true
        }
        return false
      },
    }),
    [items, ativo, command],
  )
  return (
    <div className="pr-sugestao" role="listbox" aria-label="Mencionar verbete">
      {items.length === 0 ? (
        <p className="pr-sugestao__vazia">{query === '' ? 'Nenhum verbete no Prelúdio ainda.' : `Nenhum verbete com "${query}".`}</p>
      ) : (
        items.map((item, indice) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={indice === ativo}
            className="pr-sugestao__item"
            // O clique não tira o foco do editor: a menção entra onde o cursor estava.
            onMouseDown={(evento) => evento.preventDefault()}
            onClick={() => command(item)}
          >
            <span className="pr-sugestao__titulo">{item.titulo}</span>
            <span className="pr-sugestao__tipo">{item.tipo}</span>
          </button>
        ))
      )}
    </div>
  )
})

const MARGEM_DA_SUGESTAO = 6

function posicionar(elemento: HTMLElement, retangulo: DOMRect | null | undefined): void {
  if (retangulo === null || retangulo === undefined) return
  const altura = elemento.offsetHeight
  const largura = elemento.offsetWidth
  const cabeEmbaixo = retangulo.bottom + MARGEM_DA_SUGESTAO + altura <= window.innerHeight
  const topo = cabeEmbaixo ? retangulo.bottom + MARGEM_DA_SUGESTAO : Math.max(MARGEM_DA_SUGESTAO, retangulo.top - MARGEM_DA_SUGESTAO - altura)
  const esquerda = Math.min(Math.max(MARGEM_DA_SUGESTAO, retangulo.left), window.innerWidth - largura - MARGEM_DA_SUGESTAO)
  elemento.style.transform = `translate(${Math.round(esquerda)}px, ${Math.round(topo)}px)`
}

function desenhoDaSugestao() {
  let lista: ReactRenderer<ListaDeMencaoAlca, ListaDeMencaoProps> | null = null
  const fechar = () => {
    lista?.element.remove()
    lista?.destroy()
    lista = null
  }
  return {
    onStart(props: SuggestionProps<ItemDaMencao, ItemDaMencao>) {
      lista = new ReactRenderer(ListaDeMencao, { editor: props.editor, props: { items: props.items, query: props.query, command: props.command }, className: 'pr-sugestao-casca' })
      document.body.appendChild(lista.element)
      requestAnimationFrame(() => {
        if (lista !== null) posicionar(lista.element, props.clientRect?.())
      })
    },
    onUpdate(props: SuggestionProps<ItemDaMencao, ItemDaMencao>) {
      lista?.updateProps({ items: props.items, query: props.query, command: props.command })
      requestAnimationFrame(() => {
        if (lista !== null) posicionar(lista.element, props.clientRect?.())
      })
    },
    onKeyDown(props: SuggestionKeyDownProps) {
      return lista?.ref?.aoTeclar(props.event) ?? false
    },
    onExit: fechar,
  }
}

// ─── O editor ────────────────────────────────────────────────────────────────

export interface EditorDeTextoProps {
  texto: TextoRico
  /** Nome acessível do campo ("Descrição de Fulano"). */
  rotulo: string
  /** O convite da primeira linha vazia. */
  convite: string
  editavel: boolean
  aoMudar: (texto: TextoRico) => void
  classe?: string
}

export function EditorDeTexto(props: EditorDeTextoProps) {
  // Conferido uma vez, ao abrir: o que o próprio editor emite cabe no esquema por construção.
  const [cabe] = useState(() => textoCabeNoEditor(props.texto))
  if (!cabe) {
    return (
      <div className={`pr-texto pr-texto--plano ${props.classe ?? ''}`} aria-label={props.rotulo}>
        <p className="pr-aviso" role="note">
          Este trecho tem algo que o editor não entende. Ele aparece só como texto, para leitura, e não é regravado.
        </p>
        <p className="pr-texto__plano">{textoPlano(props.texto)}</p>
      </div>
    )
  }
  return <EditorQueCabe {...props} />
}

function EditorQueCabe({ texto, rotulo, convite, editavel, aoMudar, classe }: EditorDeTextoProps) {
  const raiz = useRaizDaMidia()
  const raizAtual = useRef(raiz)
  const aoMudarAtual = useRef(aoMudar)
  const ultimoEmitido = useRef<string | null>(null)
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null)
  useLayoutEffect(() => {
    aoMudarAtual.current = aoMudar
    raizAtual.current = raiz
  })

  const emitir = (editor: Editor) => {
    if (relogio.current !== null) clearTimeout(relogio.current)
    relogio.current = null
    const documento = editor.getJSON() as TextoRico
    const serializado = JSON.stringify(documento)
    if (serializado === ultimoEmitido.current) return
    ultimoEmitido.current = serializado
    aoMudarAtual.current(documento)
  }

  const editor = useEditor(
    {
      extensions: extensoesDoTexto({
        convite,
        imagem: { urlDe: (midia) => (raizAtual.current === null ? null : urlDaMidia(raizAtual.current, midia)) },
        mencao: {
          tituloDe: (id) => usePreludio.getState().verbetes.get(id)?.titulo,
          aoAbrir: (id) => {
            const { verbetes, ir } = usePreludio.getState()
            const alvo = verbetes.get(id)
            if (alvo === undefined) return
            ir(alvo.tipo === 'pagina' ? { secao: 'escrita', paginaId: id } : { secao: 'enciclopedia', tipo: alvo.tipo, verbeteId: id })
          },
          sugestao: { items: ({ query }) => sugerir(query), render: desenhoDaSugestao },
        },
      }),
      // O texto já passou por `textoCabeNoEditor` (mesmo esquema): aqui ele é um documento do TipTap.
      content: texto as JSONContent,
      editable: editavel,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editorProps: { attributes: { class: 'pr-texto__campo', 'aria-label': rotulo, 'aria-multiline': 'true', role: 'textbox', spellcheck: 'true' } },
      onCreate: ({ editor: criado }) => {
        ultimoEmitido.current = JSON.stringify(criado.getJSON())
      },
      onUpdate: ({ editor: mudado }) => {
        if (relogio.current !== null) clearTimeout(relogio.current)
        relogio.current = setTimeout(() => emitir(mudado), ESPERA_PARA_EMITIR_MS)
      },
      onFocus: ({ editor: focado }) => useEditorAtivo.setState({ editor: focado }),
      onBlur: ({ editor: deixado }) => {
        if (relogio.current !== null) emitir(deixado)
      },
    },
    [],
  )

  useEffect(() => {
    editor.setEditable(editavel, false)
  }, [editor, editavel])

  useEffect(
    () => () => {
      if (relogio.current !== null) {
        try {
          emitir(editor)
        } catch {
          // Editor já desmontado: a última emissão (no blur) já levou o texto.
        }
      }
      if (useEditorAtivo.getState().editor === editor) useEditorAtivo.setState({ editor: null })
    },
    // `emitir` lê só refs; o efeito é o fechamento deste editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor],
  )

  return <EditorContent editor={editor} className={`pr-texto ${classe ?? ''}`} />
}

// ─── A barra de formatação ───────────────────────────────────────────────────

interface EstadoDaBarra {
  editavel: boolean
  negrito: boolean
  italico: boolean
  sublinhado: boolean
  riscado: boolean
  titulo: boolean
  subtitulo: boolean
  lista: boolean
  numerada: boolean
  citacao: boolean
  segredo: boolean
  desfazer: boolean
  refazer: boolean
}

function estadoDaBarra(editor: Editor | null): EstadoDaBarra | null {
  if (editor === null || editor.isDestroyed) return null
  return {
    editavel: editor.isEditable,
    negrito: editor.isActive('bold'),
    italico: editor.isActive('italic'),
    sublinhado: editor.isActive('underline'),
    riscado: editor.isActive('strike'),
    titulo: editor.isActive('heading', { level: 2 }),
    subtitulo: editor.isActive('heading', { level: 3 }),
    lista: editor.isActive('bulletList'),
    numerada: editor.isActive('orderedList'),
    citacao: editor.isActive('blockquote'),
    segredo: editor.isActive('segredo'),
    desfazer: editor.can().undo(),
    refazer: editor.can().redo(),
  }
}

const ICONES: Readonly<Record<string, ReactNode>> = {
  lista: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M8 5.5h9M8 10h9M8 14.5h9" />
      <circle cx="4" cy="5.5" r="1.1" />
      <circle cx="4" cy="10" r="1.1" />
      <circle cx="4" cy="14.5" r="1.1" />
    </svg>
  ),
  numerada: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M8 5.5h9M8 10h9M8 14.5h9M3.2 4.2 4.4 3.6v4M3 16.4h2.4l-2.3-2.6c.6-.9 2.2-.5 2.1.6" />
    </svg>
  ),
  citacao: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 4.5v11M8 6.5h8M8 10h8M8 13.5h5" />
    </svg>
  ),
  segredo: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="4.5" y="9" width="11" height="7.5" rx="1.5" />
      <path d="M7 9V6.8a3 3 0 0 1 6 0V9" />
    </svg>
  ),
  desfazer: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.5 5 4 8.5 7.5 12M4.5 8.5h7a4 4 0 0 1 0 8H9" />
    </svg>
  ),
  refazer: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m12.5 5 3.5 3.5-3.5 3.5M15.5 8.5h-7a4 4 0 0 0 0 8H11" />
    </svg>
  ),
}

interface BotaoDaBarraProps {
  rotulo: string
  atalho?: string
  ativo?: boolean
  desligado: boolean
  aoAcionar: () => void
  children: ReactNode
}

function BotaoDaBarra({ rotulo, atalho, ativo, desligado, aoAcionar, children }: BotaoDaBarraProps) {
  return (
    <button
      type="button"
      className="pr-barra__bt"
      aria-label={rotulo}
      title={atalho === undefined ? rotulo : `${rotulo} (${atalho})`}
      aria-pressed={ativo}
      disabled={desligado}
      // Clicar na barra não tira o foco do texto: a formatação vale onde o cursor está.
      onMouseDown={(evento) => evento.preventDefault()}
      onClick={aoAcionar}
    >
      {children}
    </button>
  )
}

/** A barra de formatação, no topo da coluna do texto: age no último editor que teve o foco. */
export function BarraDoEditor() {
  const editor = useEditorAtivo((estado) => estado.editor)
  const estado = useEditorState({ editor, selector: ({ editor: atual }) => estadoDaBarra(atual) })
  const desligado = estado === null || !estado.editavel
  const comando = (acao: (editor: Editor) => void) => () => {
    if (editor !== null && !editor.isDestroyed) acao(editor)
  }
  return (
    <div className="pr-barra" role="toolbar" aria-label="Formatação do texto">
      <BotaoDaBarra rotulo="Negrito" atalho="Ctrl+B" ativo={estado?.negrito} desligado={desligado} aoAcionar={comando((e) => e.chain().focus().toggleBold().run())}>
        <b>N</b>
      </BotaoDaBarra>
      <BotaoDaBarra rotulo="Itálico" atalho="Ctrl+I" ativo={estado?.italico} desligado={desligado} aoAcionar={comando((e) => e.chain().focus().toggleItalic().run())}>
        <i>I</i>
      </BotaoDaBarra>
      <BotaoDaBarra rotulo="Sublinhado" atalho="Ctrl+U" ativo={estado?.sublinhado} desligado={desligado} aoAcionar={comando((e) => e.chain().focus().toggleUnderline().run())}>
        <u>S</u>
      </BotaoDaBarra>
      <BotaoDaBarra rotulo="Riscado" atalho="Ctrl+Shift+S" ativo={estado?.riscado} desligado={desligado} aoAcionar={comando((e) => e.chain().focus().toggleStrike().run())}>
        <s>R</s>
      </BotaoDaBarra>
      <span className="pr-barra__div" aria-hidden="true" />
      <BotaoDaBarra rotulo="Título" atalho="## e espaço" ativo={estado?.titulo} desligado={desligado} aoAcionar={comando((e) => e.chain().focus().toggleHeading({ level: 2 }).run())}>
        <span className="pr-barra__t">T</span>
      </BotaoDaBarra>
      <BotaoDaBarra rotulo="Subtítulo" atalho="### e espaço" ativo={estado?.subtitulo} desligado={desligado} aoAcionar={comando((e) => e.chain().focus().toggleHeading({ level: 3 }).run())}>
        <span className="pr-barra__t pr-barra__t--p">T</span>
      </BotaoDaBarra>
      <BotaoDaBarra rotulo="Lista" atalho="- e espaço" ativo={estado?.lista} desligado={desligado} aoAcionar={comando((e) => e.chain().focus().toggleBulletList().run())}>
        {ICONES.lista}
      </BotaoDaBarra>
      <BotaoDaBarra rotulo="Lista numerada" atalho="1. e espaço" ativo={estado?.numerada} desligado={desligado} aoAcionar={comando((e) => e.chain().focus().toggleOrderedList().run())}>
        {ICONES.numerada}
      </BotaoDaBarra>
      <BotaoDaBarra rotulo="Citação" atalho="> e espaço" ativo={estado?.citacao} desligado={desligado} aoAcionar={comando((e) => e.chain().focus().toggleBlockquote().run())}>
        {ICONES.citacao}
      </BotaoDaBarra>
      <BotaoDaBarra rotulo="Bloco de segredo (só o mestre vê)" ativo={estado?.segredo} desligado={desligado} aoAcionar={comando((e) => e.chain().focus().alternarSegredo().run())}>
        {ICONES.segredo}
      </BotaoDaBarra>
      <span className="pr-barra__div" aria-hidden="true" />
      <BotaoDaBarra rotulo="Desfazer" atalho="Ctrl+Z" desligado={desligado || !estado.desfazer} aoAcionar={comando((e) => e.chain().focus().undo().run())}>
        {ICONES.desfazer}
      </BotaoDaBarra>
      <BotaoDaBarra rotulo="Refazer" atalho="Ctrl+Y" desligado={desligado || !estado.refazer} aoAcionar={comando((e) => e.chain().focus().redo().run())}>
        {ICONES.refazer}
      </BotaoDaBarra>
      <span className="pr-barra__dica">
        <kbd className="gr-kbd">@</kbd> menciona um verbete
      </span>
    </div>
  )
}
