import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { EditorContent, ReactRenderer, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import { create } from 'zustand'
import { compararTitulos, ROTULO_DO_TIPO, semAcento, textoPlano } from '../../lib/preparo/enciclopedia'
import { alvoParaGravar, type AlvoNaMesa } from '../../lib/preparo/sessoes'
import type { TextoRico, Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { estadoDoLink, mapaNaMemoriaAgora, pedirLeitura, useCatalogoDaMesa } from '../mesa/catalogo'
import { EscolherNaMesa } from '../mesa/EscolherNaMesa'
import { abrirNaMesaPeloPreludio, podeAbrirNaMesa } from '../mesa/ponte'
import { urlDaMidia, useRaizDaMidia } from '../midia'
import { EscolherNoQuadro } from '../quadro/EscolherNoQuadro'
import { quadroDaSessao, useQuadros } from '../quadro/estadoDosQuadros'
import { extensoesDoTexto, reavaliarMesa, reavaliarSoNome, textoCabeNoEditor, type AlvoDaCitacao, type EstadoDaMesaNoTexto, type ItemDaMencao } from './extensoes'

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

// ─── Links para a mesa ───────────────────────────────────────────────────────

/** O verbete ligado à ficha (pela ficha do Livro do verbete): é para ele que o link de ficha leva, dentro do Prelúdio. */
function verbeteDaFicha(alvo: Extract<AlvoNaMesa, { tipo: 'ficha' }>): Verbete | undefined {
  for (const verbete of usePreludio.getState().verbetes.values()) {
    if (verbete.liga?.fichas.some((ficha) => ficha.pastaId === alvo.pastaId && ficha.personagemId === alvo.personagemId) === true) return verbete
  }
  return undefined
}

function estadoDaMesa(alvo: AlvoNaMesa): EstadoDaMesaNoTexto {
  // O mapa aberto no editor vale pela memória (o que ainda não foi salvo conta); os outros, pelo disco.
  const estado = estadoDoLink(alvo, useCatalogoDaMesa.getState(), mapaNaMemoriaAgora())
  if (estado.t === 'lendo') pedirLeitura(alvo)
  if (estado.t === 'quebrado') return { quebrado: true, dica: estado.aviso, abre: false }
  if (alvo.tipo === 'ficha') {
    // "Vigia: NPC na pasta Ilha." Sem baixar a primeira letra do "onde": "NPC" viraria "nPC".
    const sobre = estado.t === 'ok' ? `${estado.nome}: ${estado.onde}.` : 'Ficha do Livro do mestre.'
    const verbete = verbeteDaFicha(alvo)
    return verbete === undefined
      ? { quebrado: false, dica: `${sobre} Na mesa, clicar seleciona o boneco dela.`, abre: false }
      : { quebrado: false, dica: `${sobre} Abrir o verbete ${verbete.titulo || 'sem nome'}.`, abre: true }
  }
  const onde = estado.t === 'ok' ? (alvo.pinoId === undefined ? estado.onde : `${estado.onde}, pino ${estado.nome}`) : 'o mapa deste link'
  return podeAbrirNaMesa() ? { quebrado: false, dica: `Abrir no mapa: ${onde}`, abre: true } : { quebrado: false, dica: onde, abre: false }
}

function abrirDaMesa(alvo: AlvoNaMesa): void {
  if (alvo.tipo === 'cena') {
    abrirNaMesaPeloPreludio(alvo.pinoId === undefined ? { chave: alvo.chave, sceneId: alvo.sceneId } : { chave: alvo.chave, sceneId: alvo.sceneId, pinoId: alvo.pinoId })
    return
  }
  const verbete = verbeteDaFicha(alvo)
  if (verbete !== undefined) usePreludio.getState().ir({ secao: 'enciclopedia', tipo: verbete.tipo, verbeteId: verbete.id })
}

// ─── Citação do quadro (F3b) ─────────────────────────────────────────────────

/** Abre o quadro citado naquele ponto: o da sessão, na aba Quadro dela; os outros, em Quadros. */
function abrirCitacao(alvo: AlvoDaCitacao): void {
  const { verbetes, ir } = usePreludio.getState()
  const lista = useQuadros.getState().lista
  const resumo = lista.t === 'pronta' ? lista.quadros.find((quadro) => quadro.id === alvo.quadroId) : undefined
  const ponto = alvo.formaId === null ? {} : { alvo: alvo.formaId }
  const sessao = resumo?.sessaoId == null ? undefined : verbetes.get(resumo.sessaoId)
  if (sessao?.tipo === 'sessao' && quadroDaSessao(lista, sessao.id)?.id === alvo.quadroId) {
    ir({ secao: 'sessoes', sessaoId: sessao.id, aba: 'quadro', ...ponto })
    return
  }
  ir({ secao: 'quadros', quadroId: alvo.quadroId, ...ponto })
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
  /** Os verbetes que o jogador lê só pelo nome, sem link, neste texto (F2c): a menção a eles ganha marca própria. */
  soNome?: ReadonlySet<string>
}

const NENHUM_SO_NOME: ReadonlySet<string> = new Set()

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

function EditorQueCabe({ texto, rotulo, convite, editavel, aoMudar, classe, soNome = NENHUM_SO_NOME }: EditorDeTextoProps) {
  const raiz = useRaizDaMidia()
  const raizAtual = useRef(raiz)
  const aoMudarAtual = useRef(aoMudar)
  const soNomeAtual = useRef(soNome)
  const ultimoEmitido = useRef<string | null>(null)
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null)
  useLayoutEffect(() => {
    aoMudarAtual.current = aoMudar
    raizAtual.current = raiz
    soNomeAtual.current = soNome
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
            ir(alvo.tipo === 'pagina' ? { secao: 'escrita', paginaId: id } : alvo.tipo === 'sessao' ? { secao: 'sessoes', sessaoId: id } : { secao: 'enciclopedia', tipo: alvo.tipo, verbeteId: id })
          },
          soNome: (id) => soNomeAtual.current.has(id),
          sugestao: { items: ({ query }) => sugerir(query), render: desenhoDaSugestao },
        },
        mesa: { estadoDe: estadoDaMesa, aoAbrir: abrirDaMesa },
        citacao: { aoAbrir: abrirCitacao },
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

  // A lista chega nova a cada gravação do texto: o editor refaz a marca só quando ela muda de verdade.
  const chaveDoSoNome = [...soNome].sort().join('\n')
  useEffect(() => {
    reavaliarSoNome(editor)
  }, [editor, chaveDoSoNome])

  // O catálogo da mesa leu o disco (ou esqueceu): os links refazem o "existe / não existe mais".
  useEffect(() => useCatalogoDaMesa.subscribe(() => queueMicrotask(() => reavaliarMesa(editor))), [editor])

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
  quadro: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <rect x="5.5" y="6.5" width="4" height="3" rx="0.6" />
      <rect x="11" y="10.5" width="3.5" height="3" rx="0.6" />
      <path d="m9.5 9.5 1.5 1" />
    </svg>
  ),
  mesa: (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 17.5s5-4.6 5-8.6a5 5 0 0 0-10 0c0 4 5 8.6 5 8.6z" />
      <circle cx="10" cy="8.8" r="1.8" />
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
  /** O editor que pediu o link: o diálogo tira o foco dele, e o link entra onde o cursor estava. */
  const [ligandoEm, setLigandoEm] = useState<Editor | null>(null)
  /** O mesmo, para a citação do quadro. */
  const [citandoEm, setCitandoEm] = useState<Editor | null>(null)
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
      <BotaoDaBarra rotulo="Ligar à mesa: cena, pino ou ficha" desligado={desligado} aoAcionar={comando((e) => setLigandoEm(e))}>
        {ICONES.mesa}
      </BotaoDaBarra>
      <BotaoDaBarra rotulo="Citar o quadro: inteiro, uma moldura ou um cartão" desligado={desligado} aoAcionar={comando((e) => setCitandoEm(e))}>
        {ICONES.quadro}
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
      {citandoEm !== null && (
        <EscolherNoQuadro
          aoFechar={() => {
            if (!citandoEm.isDestroyed) citandoEm.commands.focus()
            setCitandoEm(null)
          }}
          aoEscolher={(alvo, rotulo) => {
            if (!citandoEm.isDestroyed) {
              citandoEm
                .chain()
                .focus()
                .insertContent([
                  { type: 'citacaoQuadro', attrs: { quadroId: alvo.quadroId, formaId: alvo.formaId, rotulo } },
                  { type: 'text', text: ' ' },
                ])
                .run()
            }
            setCitandoEm(null)
          }}
        />
      )}
      {ligandoEm !== null && (
        <EscolherNaMesa
          aoFechar={() => {
            if (!ligandoEm.isDestroyed) ligandoEm.commands.focus()
            setLigandoEm(null)
          }}
          aoEscolher={(alvo, rotulo) => {
            if (!ligandoEm.isDestroyed) {
              ligandoEm
                .chain()
                .focus()
                .insertContent([
                  { type: 'ligacaoMesa', attrs: { alvo: alvoParaGravar(alvo), rotulo } },
                  { type: 'text', text: ' ' },
                ])
                .run()
            }
            setLigandoEm(null)
          }}
        />
      )}
    </div>
  )
}
