import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoSel, CampoTexto } from '../grimorio/CampoTexto'
import { Nota } from '../grimorio/Nota'
import { SubFicha } from '../grimorio/Cartoes'
import { useImagemDaMesa } from '../ImagemDaMesa'
import { NOMES_DOS_PAPEIS, Papel } from '../../documentos/Papel'
import { quantosTem } from '../../documentos/naFicha'
import { documentoNoFio } from '../../documentos/resolver'
import { PAGINAS_DO_DOCUMENTO_MAX, PAPEIS_DO_DOCUMENTO, TEXTO_DA_PAGINA_MAX, TITULO_DO_DOCUMENTO_MAX, type Documento, type PaginaDoDocumento, type PapelDoDocumento } from '../../documentos/tipos'
import type { ItemDoCatalogo } from '../../lib/acervoDeItens'
import { useAcervoDeItensStore } from '../../stores/acervoDeItensStore'
import { useAdventureStore } from '../../stores/adventureStore'
import { personagensAtivos } from '../../stores/donoDasFichas'
import { useDocumentosStore } from '../../stores/documentosStore'
import { useToastStore } from '../../stores/toastStore'
import { comExemplo, EXEMPLOS_DE_DOCUMENTO, estaEmBranco, semTextoParaPerder, type ExemploDeDocumento } from './exemplosDoDocumento'
import { IconeDoPapel } from './IconeDoPapel'
import { escolherImagemDoDocumento } from './imagemDoDocumento'
import { SecaoDesgaste, SecaoLetraETinta, SecaoSeloAssinaturaBrasao } from './SecaoDosExtras'
import { SecaoDosTrechos } from './SecaoDosTrechos'
import { chavesDoDocumento, protegerTrecho, type TipoDoTrecho } from './trechosDoRascunho'
import { SecaoEntregar } from './SecaoEntregar'
import { SecaoNoMapa } from './SecaoNoMapa'
import { useRascunhoDoDocumento } from './useRascunhoDoDocumento'
import { useDocumentosDoMestreStore } from './documentosDoMestreStore'
import './documentos.css'

/**
 * A FICHA DO DOCUMENTO na página Documentos do livro do mestre (plano dos
 * puzzles, fases D2 e D5; protótipo v2, `htmlFichaDoc` e `htmlPainelDoc`, e o
 * dos extras, `htmlFicha` e `htmlPainel`): título, papel, páginas com negrito,
 * itálico, imagem e os trechos cifrados e borrados, a letra, a tinta, o
 * desgaste, o selo, a assinatura e o brasão, a prévia "como o jogador vê" (com
 * ou sem o item), o papel no mapa, a entrega e quem tem. Tudo editável a qualquer hora (o
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

function avisar(texto: string): void {
  useToastStore.getState().push('info', texto)
}

/** O que a página fica depois de Cifrar ou Borrar: o texto novo e onde o cursor para. `null` = recusado (o aviso já saiu). */
type Protegido = { texto: string; cursor: number } | null

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
  /** Faz do pedaço selecionado um trecho cifrado ou borrado. */
  onProteger: (tipo: TipoDoTrecho, inicio: number, fim: number) => Protegido
}

function EditorDaPagina({ pagina, indice, total, onTexto, onFoco, onTirar, onImagem, onTirarImagem, onProteger }: PropsDaPagina) {
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

  // A seleção vira a marca do trecho; o campo já sai com o texto novo (como `marcar`) e o cursor fica logo depois dela.
  const proteger = (tipo: TipoDoTrecho) => {
    const campo = area.current
    if (campo === null) return
    const feito = onProteger(tipo, campo.selectionStart, campo.selectionEnd)
    campo.focus()
    if (feito === null) return
    campo.value = feito.texto
    campo.setSelectionRange(feito.cursor, feito.cursor)
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
        <Botao variante="latao" tamanho="p" title="Selecione um pedaço do texto acima: só lê quem tem o item" onMouseDown={(evento) => evento.preventDefault()} onClick={() => proteger('cifra')}>
          Cifrar
        </Botao>
        <Botao tamanho="p" title="Selecione um pedaço do texto acima: ninguém lê" onMouseDown={(evento) => evento.preventDefault()} onClick={() => proteger('borrado')}>
          Borrar
        </Botao>
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

/** "Quem lê tem" da prévia: nenhum item, um dos itens que leem algum trecho, ou todos eles. */
const SEM_ITEM = ''
const TODOS_OS_ITENS = '*'

function Previa({ documento, itens, pagina, onPagina }: { documento: Documento; itens: readonly ItemDoCatalogo[]; pagina: number; onPagina: (pagina: number) => void }) {
  const resolver = useImagemDaMesa()
  const [quemLe, setQuemLe] = useState(SEM_ITEM)
  const total = documento.paginas.length
  const chaves = chavesDoDocumento(documento)
  const nomeDoItem = (itemId: string): string | null => itens.find((item) => item.id === itemId)?.nome ?? null
  const opcoes = [
    { valor: SEM_ITEM, rotulo: 'Nenhum item' },
    ...chaves.map((chave) => ({ valor: chave, rotulo: nomeDoItem(chave) ?? 'Item apagado do acervo' })),
    ...(chaves.length > 1 ? [{ valor: TODOS_OS_ITENS, rotulo: 'Todos esses itens' }] : []),
  ]
  // O item que saiu do documento (ou do acervo) volta a prévia para "nenhum".
  const escolhido = opcoes.some((opcao) => opcao.valor === quemLe) ? quemLe : SEM_ITEM
  const carrega = escolhido === TODOS_OS_ITENS ? new Set(chaves) : new Set(escolhido === SEM_ITEM ? [] : [escolhido])
  // O mesmo pacote que o host manda a um jogador com esses itens: montado aqui, no computador do mestre.
  const noFio = documentoNoFio(documento, carrega)
  return (
    <section className="doc-secao" aria-labelledby={`doc-previa-${documento.id}`}>
      <h3 className="mg-secao" id={`doc-previa-${documento.id}`}>
        Como o jogador vê <small>muda enquanto você escreve</small>
      </h3>
      {chaves.length > 0 && <CampoSel rotulo="Quem lê tem" opcoes={opcoes} valor={escolhido} onChange={setQuemLe} />}
      <div className="doc-previa">
        <Papel documento={noFio} pagina={pagina} resolver={resolver} tamanho="previa" nomeDoItem={nomeDoItem} />
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

/** Quanto o "Trocar mesmo?" espera o segundo clique (o mesmo do Apagar). */
const ESPERA_DA_CONFIRMACAO_MS = 5000

/** "Começar de um exemplo": as 4 combinações do protótipo dos extras, para o documento novo partir de uma delas. */
function ComecarDeUmExemplo({ documento, itens, mudar }: { documento: Documento; itens: readonly ItemDoCatalogo[]; mudar: (mudanca: (atual: Documento) => Documento) => void }) {
  const [confirmando, setConfirmando] = useState<string | null>(null)
  useEffect(() => {
    if (confirmando === null) return
    const relogio = setTimeout(() => setConfirmando(null), ESPERA_DA_CONFIRMACAO_MS)
    return () => clearTimeout(relogio)
  }, [confirmando])
  const aplicar = (exemplo: ExemploDeDocumento) => {
    // Com texto escrito, o primeiro clique só pergunta: o exemplo troca as páginas inteiras.
    if (!semTextoParaPerder(documento) && confirmando !== exemplo.id) {
      setConfirmando(exemplo.id)
      return
    }
    setConfirmando(null)
    const { semItem } = comExemplo(documento, exemplo, itens)
    mudar((atual) => comExemplo(atual, exemplo, itens).documento)
    if (semItem > 0) avisar(semItem === 1 ? 'O trecho cifrado do exemplo ainda não tem quem o leia: escolha um item em Trechos protegidos.' : 'Os trechos cifrados do exemplo ainda não têm quem os leia: escolha os itens em Trechos protegidos.')
  }
  return (
    <section className="doc-secao" aria-label="Começar de um exemplo">
      <h3 className="mg-secao">
        Começar de um exemplo <small>tudo continua editável</small>
      </h3>
      <ul className="doc-exemplos">
        {EXEMPLOS_DE_DOCUMENTO.map((exemplo) => (
          <li key={exemplo.id}>
            <button type="button" className="doc-exemplo" onClick={() => aplicar(exemplo)}>
              <IconeDoPapel papel={exemplo.papel} />
              <span className="doc-exemplo__nome">{confirmando === exemplo.id ? 'Trocar o texto de agora por este?' : exemplo.titulo}</span>
              <span className="doc-exemplo__como">{exemplo.nome}</span>
            </button>
          </li>
        ))}
      </ul>
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
    const relogio = setTimeout(() => setConfirmando(false), ESPERA_DA_CONFIRMACAO_MS)
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
  const itens = useAcervoDeItensStore((estado) => estado.itens)
  // O documento novo (em branco ao abrir) oferece os exemplos; eles ficam à vista até a ficha fechar, para nada pular de lugar.
  const [ofereceExemplos] = useState(() => estaEmBranco(original))
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
  const proteger = (indice: number, tipo: TipoDoTrecho, inicio: number, fim: number): Protegido => {
    // `mudar` chama a conta na hora, com o rascunho de agora: a caixa guarda o que ela devolveu.
    const caixa: { saida: ReturnType<typeof protegerTrecho> | null } = { saida: null }
    mudar((atual) => {
      const saida = protegerTrecho(atual, indice, inicio, fim, tipo)
      caixa.saida = saida
      return saida.tipo === 'ok' ? saida.documento : atual
    })
    const saida = caixa.saida
    if (saida === null) return null
    if (saida.tipo === 'recusa') {
      avisar(saida.aviso)
      return null
    }
    avisar(tipo === 'cifra' ? 'Trecho cifrado. Escolha em Trechos protegidos o item que o lê.' : 'Trecho borrado. Ninguém lê; todos veem a tinta borrada.')
    return { texto: saida.texto, cursor: saida.depoisDaMarca }
  }

  const mudarExtras = (mudanca: (extras: Documento['extras']) => Documento['extras']) => mudar((atual) => ({ ...atual, extras: mudanca(atual.extras) }))

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
      {ofereceExemplos && <ComecarDeUmExemplo documento={rascunho} itens={itens} mudar={mudar} />}

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
              onProteger={(tipo, inicio, fim) => proteger(indice, tipo, inicio, fim)}
            />
          ))}
        </ol>
        <Acoes>
          <Botao variante="latao" tamanho="p" onClick={maisUmaPagina} disabled={total >= PAGINAS_DO_DOCUMENTO_MAX}>
            + Página
          </Botao>
        </Acoes>
        <Nota>
          Negrito: **assim** (Ctrl+B). Itálico: *assim* (Ctrl+I). Linha em branco separa parágrafos. Para um trecho que só um item lê, selecione o texto e use Cifrar; para tinta
          borrada, Borrar.
        </Nota>
      </section>

      <SecaoDosTrechos documento={rascunho} itens={itens} mudar={mudar} onAviso={avisar} />
      <SecaoLetraETinta extras={rascunho.extras} mudar={mudarExtras} onErro={avisarErro} />
      <SecaoDesgaste extras={rascunho.extras} mudar={mudarExtras} onErro={avisarErro} />
      <SecaoSeloAssinaturaBrasao extras={rascunho.extras} mudar={mudarExtras} onErro={avisarErro} />
      <Previa documento={rascunho} itens={itens} pagina={paginaDaPrevia} onPagina={setPagina} />
      <SecaoNoMapa docId={rascunho.id} antesDeSeparar={gravarJa} />
      <SecaoEntregar documento={rascunho} antesDeEntregar={gravarJa} />
      <BotaoDeApagar documento={rascunho} />
    </SubFicha>
  )
}
