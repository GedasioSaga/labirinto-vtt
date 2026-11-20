import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoTexto } from '../grimorio/CampoTexto'
import { Nota } from '../grimorio/Nota'
import { SubFicha } from '../grimorio/Cartoes'
import { useImagemDaMesa } from '../ImagemDaMesa'
import { NOMES_DOS_PAPEIS, Papel } from '../../documentos/Papel'
import { quantosTem } from '../../documentos/naFicha'
import { PAGINAS_DO_DOCUMENTO_MAX, PAPEIS_DO_DOCUMENTO, TEXTO_DA_PAGINA_MAX, TITULO_DO_DOCUMENTO_MAX, type Documento, type PaginaDoDocumento, type PapelDoDocumento } from '../../documentos/tipos'
import { useAdventureStore } from '../../stores/adventureStore'
import { personagensAtivos } from '../../stores/donoDasFichas'
import { useDocumentosStore } from '../../stores/documentosStore'
import { useToastStore } from '../../stores/toastStore'
import { IconeDoPapel } from './IconeDoPapel'
import { escolherImagemDoDocumento } from './imagemDoDocumento'
import { SecaoEntregar } from './SecaoEntregar'
import { SecaoNoMapa } from './SecaoNoMapa'
import { useRascunhoDoDocumento } from './useRascunhoDoDocumento'
import { useDocumentosDoMestreStore } from './documentosDoMestreStore'
import './documentos.css'

/**
 * A FICHA DO DOCUMENTO na página Documentos do livro do mestre (plano dos
 * puzzles, fase D2; protótipo v2, `htmlFichaDoc` e `htmlPainelDoc`): título,
 * papel, páginas com negrito, itálico e imagem, a prévia "como o jogador vê",
 * o papel no mapa, a entrega e quem tem. Tudo editável a qualquer hora (o
 * pedido "deixe bem editável"): o texto mora na biblioteca, então uma
 * correção vale também para quem já leu.
 */

/** As marcas da barra de cada página, e a tecla de cada uma dentro do texto. */
const MARCAS = {
  negrito: { marca: '**', tecla: 'b', rotulo: 'Negrito', letra: 'N' },
  italico: { marca: '*', tecla: 'i', rotulo: 'Itálico', letra: 'I' },
} as const
type Marca = keyof typeof MARCAS
const ORDEM_DAS_MARCAS: readonly Marca[] = ['negrito', 'italico']

function comPagina(documento: Documento, indice: number, mudar: (pagina: PaginaDoDocumento) => PaginaDoDocumento): Documento {
  return { ...documento, paginas: documento.paginas.map((pagina, i) => (i === indice ? mudar(pagina) : pagina)) }
}

function avisarErro(erro: unknown): void {
  useToastStore.getState().push('error', erro instanceof Error ? erro.message : String(erro))
}

/** A escolha do papel: as 6 miniaturas como rádios nativos (setas e Tab do navegador). */
function EscolhaDoPapel({ papel, onChange, nome }: { papel: PapelDoDocumento; onChange: (papel: PapelDoDocumento) => void; nome: string }) {
  return (
    <div className="doc-papeis" role="radiogroup" aria-label="Papel">
      {PAPEIS_DO_DOCUMENTO.map((opcao) => (
        <label key={opcao} className="doc-papel-op">
          <input type="radio" name={nome} value={opcao} checked={papel === opcao} onChange={() => onChange(opcao)} />
          <IconeDoPapel papel={opcao} />
          <span>{NOMES_DOS_PAPEIS[opcao]}</span>
        </label>
      ))}
    </div>
  )
}

interface PropsDaPagina {
  pagina: PaginaDoDocumento
  indice: number
  total: number
  onTexto: (texto: string) => void
  onFoco: () => void
  onTirar: () => void
  onImagem: () => void
  onTirarImagem: () => void
}

function EditorDaPagina({ pagina, indice, total, onTexto, onFoco, onTirar, onImagem, onTirarImagem }: PropsDaPagina) {
  const area = useRef<HTMLTextAreaElement>(null)
  const numero = indice + 1

  // Põe a marca em volta do que está selecionado (ou de "texto", sem seleção) e deixa o miolo selecionado.
  const marcar = (qual: Marca) => {
    const campo = area.current
    if (campo === null) return
    const { marca } = MARCAS[qual]
    const inicio = campo.selectionStart
    const fim = campo.selectionEnd
    const miolo = campo.value.slice(inicio, fim) || 'texto'
    const novo = `${campo.value.slice(0, inicio)}${marca}${miolo}${marca}${campo.value.slice(fim)}`
    if (novo.length > TEXTO_DA_PAGINA_MAX) return
    // O campo já sai com o texto novo: o React vê o mesmo valor e não mexe na seleção.
    campo.value = novo
    onTexto(novo)
    campo.focus()
    campo.setSelectionRange(inicio + marca.length, inicio + marca.length + miolo.length)
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(evento.ctrlKey || evento.metaKey) || evento.altKey || evento.shiftKey) return
    const tecla = evento.key.toLowerCase()
    const qual = tecla === MARCAS.negrito.tecla ? 'negrito' : tecla === MARCAS.italico.tecla ? 'italico' : null
    if (qual === null) return
    evento.preventDefault()
    marcar(qual)
  }

  return (
    <li className="doc-pagina">
      <div className="doc-pagina__cab">
        <span>Página {numero}</span>
        {ORDEM_DAS_MARCAS.map((qual) => (
          <button
            key={qual}
            type="button"
            className={`doc-fmt doc-fmt--${qual}`}
            aria-label={`${MARCAS[qual].rotulo} na página ${numero}`}
            title={`${MARCAS[qual].rotulo} (Ctrl+${MARCAS[qual].tecla.toUpperCase()})`}
            onMouseDown={(evento) => evento.preventDefault()}
            onClick={() => marcar(qual)}
          >
            {MARCAS[qual].letra}
          </button>
        ))}
        {total > 1 && (
          <Botao soIcone variante="fantasma" tamanho="p" aria-label={`Tirar a página ${numero}`} title="Tirar a página" onClick={onTirar}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
            </svg>
          </Botao>
        )}
      </div>
      <textarea
        ref={area}
        className="gr-entrada doc-pagina__texto"
        rows={6}
        maxLength={TEXTO_DA_PAGINA_MAX}
        aria-label={`Texto da página ${numero}`}
        value={pagina.texto}
        onChange={(evento) => onTexto(evento.currentTarget.value)}
        onFocus={onFoco}
        onKeyDown={aoTeclar}
      />
      <Acoes>
        <Botao tamanho="p" onClick={onImagem}>
          {pagina.imagem === null ? 'Imagem (opcional)' : 'Trocar a imagem'}
        </Botao>
        {pagina.imagem !== null && (
          <Botao variante="fantasma" tamanho="p" onClick={onTirarImagem}>
            Tirar a imagem
          </Botao>
        )}
      </Acoes>
    </li>
  )
}

function Previa({ documento, pagina, onPagina }: { documento: Documento; pagina: number; onPagina: (pagina: number) => void }) {
  const resolver = useImagemDaMesa()
  const total = documento.paginas.length
  return (
    <section className="doc-secao" aria-labelledby={`doc-previa-${documento.id}`}>
      <h3 className="mg-secao" id={`doc-previa-${documento.id}`}>
        Como o jogador vê <small>muda enquanto você escreve</small>
      </h3>
      <div className="doc-previa">
        <Papel documento={documento} pagina={pagina} resolver={resolver} tamanho="previa" />
      </div>
      {total > 1 && (
        <div className="doc-previa__pe">
          <Botao tamanho="p" disabled={pagina === 0} onClick={() => onPagina(pagina - 1)}>
            ‹ Anterior
          </Botao>
          <span className="doc-previa__pag" aria-live="polite">
            Página {pagina + 1} de {total}
          </span>
          <Botao tamanho="p" disabled={pagina >= total - 1} onClick={() => onPagina(pagina + 1)}>
            Próxima ›
          </Botao>
        </div>
      )}
    </section>
  )
}

function BotaoDeApagar({ documento }: { documento: Documento }) {
  const [confirmando, setConfirmando] = useState(false)
  const personagens = useAdventureStore((estado) => personagensAtivos(estado))
  const quantos = quantosTem(personagens, documento.id)
  // O "Apagar mesmo?" volta sozinho se ele não confirmar (o protótipo esperava o próximo clique).
  useEffect(() => {
    if (!confirmando) return
    const relogio = setTimeout(() => setConfirmando(false), 5000)
    return () => clearTimeout(relogio)
  }, [confirmando])
  const apagar = () => {
    if (!confirmando) {
      setConfirmando(true)
      return
    }
    useDocumentosDoMestreStore.getState().abrir(null)
    useDocumentosStore.getState().apagar(documento.id).catch(avisarErro)
  }
  return (
    <div className="doc-secao">
      {confirmando && (
        <Nota>
          {quantos === 0 ? 'Ninguém tem este documento.' : quantos === 1 ? '1 jogador tem este documento.' : `${quantos} jogadores têm este documento.`} Na lista deles ele
          fica, com o aviso de que o mestre o apagou; os papéis no mapa deixam de abrir.
        </Nota>
      )}
      <Botao variante="perigo" largo onClick={apagar}>
        {confirmando ? 'Apagar mesmo?' : 'Apagar documento'}
      </Botao>
    </div>
  )
}

export function FichaDoDocumento({ documento: original, podeGravar }: { documento: Documento; podeGravar: boolean }) {
  const { rascunho, mudar, gravarJa } = useRascunhoDoDocumento(original)
  const [pagina, setPagina] = useState(0)
  const nomeDoGrupo = useId()
  const total = rascunho.paginas.length
  const paginaDaPrevia = Math.min(pagina, total - 1)

  const escolherImagem = (destino: (documento: Documento, imagem: string) => Documento) => {
    escolherImagemDoDocumento()
      .then((imagem) => {
        if (imagem !== null) mudar((atual) => destino(atual, imagem))
      })
      .catch(avisarErro)
  }

  const maisUmaPagina = () => {
    if (total >= PAGINAS_DO_DOCUMENTO_MAX) return
    mudar((atual) => ({ ...atual, paginas: [...atual.paginas, { texto: '', imagem: null }] }))
    setPagina(total)
  }
  const tirarPagina = (indice: number) => {
    mudar((atual) => (atual.paginas.length <= 1 ? atual : { ...atual, paginas: atual.paginas.filter((_, i) => i !== indice) }))
    setPagina((atual) => Math.max(0, atual > indice ? atual - 1 : Math.min(atual, total - 2)))
  }

  return (
    <SubFicha
      voltarPara="Documentos"
      onVoltar={() => useDocumentosDoMestreStore.getState().abrir(null)}
      icone={<IconeDoPapel papel={rascunho.papel} />}
      titulo={rascunho.titulo.trim() === '' ? 'Sem título' : rascunho.titulo}
      tipo={`Documento · ${NOMES_DOS_PAPEIS[rascunho.papel]}`}
    >
      {!podeGravar && <Nota>As mudanças daqui não vão para o disco: a biblioteca não pôde ser lida ou é de uma versão mais nova do app.</Nota>}
      <CampoTexto rotulo="Título" valor={rascunho.titulo} maxLength={TITULO_DO_DOCUMENTO_MAX} onChange={(titulo) => mudar((atual) => ({ ...atual, titulo }))} />

      <section className="doc-secao" aria-label="Papel">
        <h3 className="mg-secao">Papel</h3>
        <EscolhaDoPapel nome={nomeDoGrupo} papel={rascunho.papel} onChange={(papel) => mudar((atual) => ({ ...atual, papel }))} />
        {rascunho.papel === 'imagem' && (
          <Acoes>
            <Botao variante="latao" tamanho="p" onClick={() => escolherImagem((atual, imagem) => ({ ...atual, imagemDoPapel: imagem }))}>
              {rascunho.imagemDoPapel === null ? 'Escolher a imagem do papel' : 'Trocar a imagem do papel'}
            </Botao>
          </Acoes>
        )}
      </section>

      <section className="doc-secao" aria-labelledby={`doc-texto-${rascunho.id}`}>
        <h3 className="mg-secao" id={`doc-texto-${rascunho.id}`}>
          Texto <small>{total === 1 ? '1 página' : `${total} páginas`}</small>
        </h3>
        <ol className="doc-paginas">
          {rascunho.paginas.map((estaPagina, indice) => (
            <EditorDaPagina
              // A página não tem id próprio: a posição é a identidade (tirar uma reorganiza as de baixo, e o rascunho já está gravado nelas).
              key={indice}
              pagina={estaPagina}
              indice={indice}
              total={total}
              onTexto={(texto) => mudar((atual) => comPagina(atual, indice, (p) => ({ ...p, texto })))}
              onFoco={() => setPagina(indice)}
              onTirar={() => tirarPagina(indice)}
              onImagem={() => escolherImagem((atual, imagem) => comPagina(atual, indice, (p) => ({ ...p, imagem })))}
              onTirarImagem={() => mudar((atual) => comPagina(atual, indice, (p) => ({ ...p, imagem: null })))}
            />
          ))}
        </ol>
        <Acoes>
          <Botao variante="latao" tamanho="p" onClick={maisUmaPagina} disabled={total >= PAGINAS_DO_DOCUMENTO_MAX}>
            + Página
          </Botao>
        </Acoes>
        <Nota>Negrito: **assim** (Ctrl+B). Itálico: *assim* (Ctrl+I). Linha em branco separa parágrafos.</Nota>
      </section>

      <Previa documento={rascunho} pagina={paginaDaPrevia} onPagina={setPagina} />
      <SecaoNoMapa docId={rascunho.id} />
      <SecaoEntregar documento={rascunho} antesDeEntregar={gravarJa} />
      <BotaoDeApagar documento={rascunho} />
    </SubFicha>
  )
}
