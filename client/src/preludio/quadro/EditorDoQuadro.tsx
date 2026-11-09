/// <reference types="vite/client" />
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite'
import { Tldraw, createTLStore, defaultShapeUtils, getSnapshot, loadSnapshot, type Editor, type TLAnyShapeUtilConstructor, type TLAssetStore, type TLEditorSnapshot, type TLStore } from 'tldraw'
import 'tldraw/tldraw.css'
import {
  caminhosSemMidia,
  ehPlanta,
  extensaoDaImagem,
  fotoComMidia,
  gravarMidiaDoQuadro,
  gravarQuadro,
  lerQuadro,
  midiaDoAsset,
  midiaNaTabela,
  tabelaDeMidiaDasImportacoes,
} from '../../lib/preparo/quadros'
import type { Quadro } from '../../lib/preparo/tipos'
import { agendarGravacaoDeFora, gravacaoPendente, usePreludio } from '../estado/preludio'
import { prepararMidia, urlDaMidia } from '../midia'
import { UTILS_DOS_CARTOES, verbeteDoCartao } from './cartoes'
import { useQuadros } from './estadoDosQuadros'
import { exportarQuadro, type FormatoDeExportacao } from './exportarQuadro'
import { UTILS_DA_PLANTA, definirResolvedoresDaPlanta } from './planta'

/**
 * O QUADRO ABERTO (fatia F3a): o tldraw 4.5.12, o mesmo do Grimório, com a
 * foto do arquivo `preparo/quadros/<id>.json`.
 *
 * - Fontes, ícones e traduções do tldraw vêm de dentro do app
 *   (`@tldraw/assets/imports.vite`): o Grimório os buscava na internet.
 * - A chave de licença entra na hora do build por `VITE_TLDRAW_LICENSE_KEY` e
 *   nunca no git. Sem ela, o app (http://tauri.localhost) roda com a marca
 *   "made with tldraw" (plano, "Licença do tldraw").
 * - Os cartões e as peças de planta têm o esquema e as migrações do Grimório,
 *   letra por letra: sem isso a foto importada não abre.
 * - Salvar é automático, pela mesma fila dos verbetes (`agendarGravacaoDeFora`):
 *   o rodapé "Tudo salvo neste PC", o "Tentar de novo" e a pergunta ao fechar
 *   a janela valem para o quadro. Abrir não grava: só a mudança do mestre.
 * - A planta do Grimório e o arquivo de formato mais novo abrem só para ver.
 */

export interface EditorDoQuadroProps {
  id: string
  aoVoltar: () => void
}

const UTILS_DO_QUADRO: TLAnyShapeUtilConstructor[] = [...UTILS_DOS_CARTOES, ...UTILS_DA_PLANTA]
/** O store precisa do esquema inteiro; o `<Tldraw>` soma os padrões aos de `shapeUtils` sozinho. */
const UTILS_DO_STORE: TLAnyShapeUtilConstructor[] = [...defaultShapeUtils, ...UTILS_DO_QUADRO]
const ENDERECOS_DO_TLDRAW = getAssetUrlsByImport()
const CHAVE_DO_TLDRAW: string | undefined = import.meta.env.VITE_TLDRAW_LICENSE_KEY || undefined

const PLANTA_SO_PARA_VER = 'Planta do Grimório: abre só para ver. O mapa se faz no editor de mapas do Labirinto.'

/** Quanto tempo o resultado da exportação fica na barra. */
const AVISO_DA_EXPORTACAO_MS = 5000

const chaveDaGravacao = (id: string) => `quadro:${id}`

/**
 * O último quadro mandado ao disco que ainda não chegou lá (o disco recusou),
 * por id: reabrir o quadro mostra este, e não o do disco, que é o de antes.
 */
const naoGravados = new Map<string, Quadro>()

type Abertura =
  | { readonly t: 'lendo' }
  | { readonly t: 'sumiu' }
  | { readonly t: 'falhou'; readonly aviso: string }
  | { readonly t: 'pronto'; readonly store: TLStore; readonly quadro: Quadro; readonly soLeitura: string | null; readonly semArquivo: number }

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** As imagens do quadro moram em `preparo/midia/`; a foto guarda o caminho em `meta.midia`. */
function lojaDeImagens(raiz: string | null): TLAssetStore {
  return {
    async upload(_asset, arquivo) {
      const bytes = new Uint8Array(await arquivo.arrayBuffer())
      const midia = await gravarMidiaDoQuadro(bytes, extensaoDaImagem(arquivo.type, arquivo.name))
      return { src: (raiz === null ? null : urlDaMidia(raiz, midia)) ?? midia, meta: { midia } }
    },
    resolve(asset) {
      const midia = midiaDoAsset(asset.meta)
      const url = midia === null || raiz === null ? null : urlDaMidia(raiz, midia)
      return url ?? asset.props.src
    },
  }
}

async function abrir(id: string): Promise<Abertura> {
  // Uma mudança deste quadro ainda esperando o relógio: vai ao disco antes de reler.
  if (gravacaoPendente(chaveDaGravacao(id))) await usePreludio.getState().salvarPendentes()
  let quadro: Quadro
  let soLeitura: string | null = null
  const pendente = naoGravados.get(id)
  if (pendente !== undefined && gravacaoPendente(chaveDaGravacao(id))) {
    quadro = pendente
  } else {
    naoGravados.delete(id)
    const lido = await lerQuadro(id)
    if (lido.estado === 'novo') return { t: 'sumiu' }
    if (lido.estado === 'falhou') return { t: 'falhou', aviso: lido.aviso }
    if (lido.valor === null) return { t: 'falhou', aviso: lido.estado === 'somenteLeitura' ? lido.aviso : 'O arquivo do quadro está vazio.' }
    quadro = lido.valor
    if (lido.estado === 'somenteLeitura') soLeitura = lido.aviso
  }
  if (soLeitura === null && ehPlanta(quadro)) soLeitura = PLANTA_SO_PARA_VER

  // Imagem vinda do Grimório: o endereço do Prelúdio sai da tabela da importação (o `meta.rel` fica).
  let foto: unknown = quadro.tldraw
  let semArquivo = 0
  if (caminhosSemMidia(foto).length > 0) {
    const tabela = await tabelaDeMidiaDasImportacoes()
    const comMidia = fotoComMidia(foto, (rel) => midiaNaTabela(tabela, rel))
    foto = comMidia.foto
    semArquivo = comMidia.semArquivo
  }

  const raiz = await prepararMidia()
  const store = createTLStore({ shapeUtils: UTILS_DO_STORE, assets: lojaDeImagens(raiz) })
  if (foto !== null && foto !== undefined) {
    try {
      // O próprio tldraw migra a foto antiga ({store, schema}) e a de {document, session}.
      loadSnapshot(store, foto as Partial<TLEditorSnapshot>)
    } catch (erro) {
      return { t: 'falhou', aviso: `O tldraw não abriu este quadro (${motivo(erro)}). O arquivo continua intacto.` }
    }
  }
  return { t: 'pronto', store, quadro, soLeitura, semArquivo }
}

interface QuadroProntoProps {
  id: string
  store: TLStore
  quadro: Quadro
  soLeitura: string | null
  semArquivo: number
  aoVoltar: () => void
}

function QuadroPronto({ id, store, quadro, soLeitura, semArquivo, aoVoltar }: QuadroProntoProps) {
  const travado = usePreludio((estado) => estado.travado)
  const recemCriado = useQuadros((estado) => estado.recemCriado === id)
  const [nome, setNome] = useState(quadro.nome)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [exportando, setExportando] = useState(false)
  const [resultado, setResultado] = useState<{ texto: string; falhou: boolean } | null>(null)
  const nomeGravado = useRef(quadro.nome)
  const campoDoNome = useRef<HTMLInputElement>(null)
  const somenteVer = soLeitura !== null

  // O que vai ao disco é montado na hora de gravar: a foto de agora, o nome de agora, o resto como veio.
  const agendar = useRef(() => {
    agendarGravacaoDeFora(chaveDaGravacao(id), async () => {
      const novo: Quadro = { ...quadro, nome: nomeGravado.current, tldraw: getSnapshot(store) }
      naoGravados.set(id, novo)
      await gravarQuadro(id, novo)
      if (naoGravados.get(id) === novo) naoGravados.delete(id)
      useQuadros.getState().gravado(id, novo)
    })
  }).current

  useEffect(() => {
    if (!recemCriado) return
    campoDoNome.current?.select()
    useQuadros.getState().esquecerRecemCriado()
  }, [recemCriado])

  useEffect(() => {
    editor?.updateInstanceState({ isReadonly: somenteVer || travado })
  }, [editor, somenteVer, travado])

  useEffect(() => {
    if (resultado === null) return
    const relogio = setTimeout(() => setResultado(null), AVISO_DA_EXPORTACAO_MS)
    return () => clearTimeout(relogio)
  }, [resultado])

  const aoMontar = (montado: Editor) => {
    montado.user.updateUserPreferences({ colorScheme: 'dark' })
    // As salas da planta mostram o nome do lugar ligado, e o duplo clique abre o verbete.
    const verbeteDe = (verbeteId: string) => verbeteDoCartao(usePreludio.getState().verbetes, verbeteId)
    const abrirVerbete = (verbeteId: string) => {
      const verbete = verbeteDe(verbeteId)
      if (verbete !== undefined) usePreludio.getState().ir({ secao: 'enciclopedia', tipo: 'todos', verbeteId: verbete.id })
    }
    definirResolvedoresDaPlanta({ nomeDoCenario: (cenarioId) => verbeteDe(cenarioId)?.titulo, nomeDoItem: (itemId) => verbeteDe(itemId)?.titulo, abrirCenario: abrirVerbete, abrirItem: abrirVerbete })
    // Depois de montar: o que o editor arruma ao nascer (página, câmera) não conta como mudança do mestre.
    const pararDeOuvir = somenteVer ? () => undefined : montado.store.listen(agendar, { scope: 'document', source: 'user' })
    setEditor(montado)
    return () => {
      pararDeOuvir()
      definirResolvedoresDaPlanta({})
      setEditor(null)
    }
  }

  const confirmarNome = () => {
    const limpo = nome.trim()
    if (somenteVer || limpo === nomeGravado.current) {
      setNome(nomeGravado.current)
      return
    }
    nomeGravado.current = limpo
    setNome(limpo)
    useQuadros.getState().renomear(id, limpo)
    agendar()
  }

  const aoTeclarNoNome = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Enter') {
      evento.preventDefault()
      evento.currentTarget.blur()
    } else if (evento.key === 'Escape') {
      evento.preventDefault()
      setNome(nomeGravado.current)
      requestAnimationFrame(() => campoDoNome.current?.blur())
    }
  }

  const exportar = async (formato: FormatoDeExportacao) => {
    if (editor === null || exportando) return
    setExportando(true)
    try {
      const caminho = await exportarQuadro(editor, nomeGravado.current, formato)
      if (caminho !== null) setResultado({ texto: `${formato.toUpperCase()} salvo em ${caminho}`, falhou: false })
    } catch (erro) {
      setResultado({ texto: `A exportação falhou: ${motivo(erro)}`, falhou: true })
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="pr-quadro">
      <div className="pr-quadro__barra">
        <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoVoltar}>
          ‹ Quadros
        </button>
        <input
          ref={campoDoNome}
          className="pr-quadro__nome"
          aria-label="Nome do quadro"
          value={nome}
          readOnly={somenteVer || travado}
          placeholder="Quadro sem nome"
          onChange={(evento) => setNome(evento.target.value)}
          onBlur={confirmarNome}
          onKeyDown={aoTeclarNoNome}
        />
        <span className="pr-quadro__espaco" />
        {resultado !== null && (
          <span className={`pr-quadro__resultado${resultado.falhou ? ' pr-quadro__resultado--falhou' : ''}`} role={resultado.falhou ? 'alert' : 'status'}>
            {resultado.texto}
          </span>
        )}
        <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" disabled={editor === null || exportando} onClick={() => void exportar('png')}>
          Exportar PNG
        </button>
        <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" disabled={editor === null || exportando} onClick={() => void exportar('svg')}>
          Exportar SVG
        </button>
      </div>
      {(soLeitura !== null || semArquivo > 0) && (
        <div className="pr-quadro__avisos">
          {soLeitura !== null && <p className="pr-quadro__nota">{soLeitura}</p>}
          {semArquivo > 0 && (
            <p className="pr-quadro__nota">
              {semArquivo === 1 ? '1 imagem deste quadro não veio na importação do Grimório.' : `${semArquivo} imagens deste quadro não vieram na importação do Grimório.`} Importe de novo pelo Início para trazê-las.
            </p>
          )}
        </div>
      )}
      <div className="pr-quadro__tela">
        <Tldraw store={store} shapeUtils={UTILS_DO_QUADRO} assetUrls={ENDERECOS_DO_TLDRAW} licenseKey={CHAVE_DO_TLDRAW} onMount={aoMontar} />
      </div>
    </div>
  )
}

export function EditorDoQuadro({ id, aoVoltar }: EditorDoQuadroProps) {
  const [abertura, setAbertura] = useState<Abertura>({ t: 'lendo' })

  useEffect(() => {
    let vivo = true
    abrir(id).then(
      (aberto) => {
        if (vivo) setAbertura(aberto)
      },
      (erro: unknown) => {
        if (vivo) setAbertura({ t: 'falhou', aviso: `Não deu para ler o quadro: ${motivo(erro)}.` })
      },
    )
    return () => {
      vivo = false
    }
  }, [id])

  if (abertura.t === 'pronto') return <QuadroPronto id={id} store={abertura.store} quadro={abertura.quadro} soLeitura={abertura.soLeitura} semArquivo={abertura.semArquivo} aoVoltar={aoVoltar} />
  if (abertura.t === 'lendo') {
    return (
      <p className="pr-quieto pr-palco__abrindo" role="status">
        Abrindo o quadro…
      </p>
    )
  }
  return (
    <section className="pr-lista">
      <p className="pr-aviso" role="alert">
        {abertura.t === 'sumiu' ? 'Este quadro não existe mais.' : abertura.aviso}
      </p>
      <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoVoltar}>
        Voltar aos quadros
      </button>
    </section>
  )
}
