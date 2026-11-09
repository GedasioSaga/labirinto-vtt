import { Fragment, useCallback, useRef, useState, type ReactNode } from 'react'
import { Pop } from '../../components/grimorio/Pop'
import { ehRegistro } from '../../lib/preparo/molde'
import { alvoDaMesa, type AlvoNaMesa } from '../../lib/preparo/sessoes'
import { PECAS_DO_TEXTO, type TextoRico } from '../../lib/preparo/tipos'
import { useEstadoDoLink } from '../mesa/catalogo'
import { urlDaMidia } from '../midia'

/**
 * O ROTEIRO NO LIVRO DO MESTRE: o texto da sessão desenhado do JSON, sem o
 * editor (o TipTap não entra no mapa). Só leitura: a menção abre o Revelar
 * daquele verbete, o segredo aparece (quem lê é o mestre), o link da mesa abre
 * a cena, o pino ou a ficha, e o link que perdeu o alvo mostra "não existe
 * mais". O React escapa todo texto; o nó que esta versão não conhece mostra só
 * o que tem dentro.
 */

export interface ContextoDoRoteiro {
  /** A pasta das imagens do Prelúdio; `null` enquanto não chega. */
  readonly raiz: string | null
  readonly tituloDe: (verbeteId: string) => string | undefined
  /** Clique num link da mesa que existe: `nome` é o do alvo agora (o rótulo, se ainda lendo). */
  readonly aoAbrirLink: (alvo: AlvoNaMesa, nome: string) => void
  /** O que o pop da menção mostra (o Revelar do verbete); `null` = a menção é só o nome (sessão nunca vai ao jogador). */
  readonly revelarMencao?: (verbeteId: string) => ReactNode | null
}

type No = Record<string, unknown>

const NAO_EXISTE_MAIS = 'não existe mais'

function nosDe(bruto: unknown): No[] {
  return Array.isArray(bruto) ? bruto.filter(ehRegistro) : []
}

function atributosDe(no: No): No {
  return ehRegistro(no.attrs) ? no.attrs : {}
}

function textoDe(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

function comMarca(dentro: ReactNode, marca: unknown): ReactNode {
  if (!ehRegistro(marca)) return dentro
  switch (marca.type) {
    case 'bold':
      return <strong>{dentro}</strong>
    case 'italic':
      return <em>{dentro}</em>
    case 'strike':
      return <s>{dentro}</s>
    case 'code':
      return <code>{dentro}</code>
    case 'underline':
      return <u>{dentro}</u>
    case 'link':
      // Endereço de fora não abre aqui: trocaria a janela do Labirinto pela página.
      return (
        <span className="pr-roteiro__fora" title={textoDe(atributosDe(marca).href)}>
          {dentro}
        </span>
      )
    default:
      return dentro
  }
}

function tipoDoLink(alvo: AlvoNaMesa): 'ficha' | 'cena' | 'pino' {
  return alvo.tipo === 'ficha' ? 'ficha' : alvo.pinoId === undefined ? 'cena' : 'pino'
}

function LinkQuebrado({ tipo, rotulo, aviso }: { tipo: string; rotulo: string; aviso: string }) {
  return (
    <span className="pr-mesa pr-mesa--quebrada" data-tipo={tipo} data-aviso={NAO_EXISTE_MAIS} title={aviso}>
      {rotulo}
    </span>
  )
}

function LinkDaMesa({ alvo, rotulo, contexto }: { alvo: AlvoNaMesa; rotulo: string; contexto: ContextoDoRoteiro }) {
  const estado = useEstadoDoLink(alvo)
  const tipo = tipoDoLink(alvo)
  if (estado.t === 'quebrado') return <LinkQuebrado tipo={tipo} rotulo={rotulo} aviso={estado.aviso} />
  const nome = estado.t === 'ok' ? estado.nome : rotulo
  const dica =
    alvo.tipo === 'ficha'
      ? `Selecionar ${nome} na cena e abrir a ficha`
      : estado.t === 'ok'
        ? `Ir a ${tipo === 'pino' ? `${estado.onde}, pino ${estado.nome}` : estado.onde}`
        : 'Ir ao mapa deste link'
  return (
    <button type="button" className="pr-mesa pr-mesa--abre pr-roteiro__mesa" data-tipo={tipo} title={dica} onClick={() => contexto.aoAbrirLink(alvo, nome)}>
      {rotulo}
    </button>
  )
}

/** A menção a um verbete que existe: o nome, e o clique abre o Revelar dele ali mesmo, sem sair do mapa. */
function MencaoDoRoteiro({ verbeteId, titulo, contexto }: { verbeteId: string; titulo: string; contexto: ContextoDoRoteiro }) {
  const gatilho = useRef<HTMLButtonElement>(null)
  const [aberto, setAberto] = useState(false)
  const fechar = useCallback(() => setAberto(false), [])
  const nome = titulo || 'Sem nome'
  const conteudo = contexto.revelarMencao?.(verbeteId) ?? null
  if (conteudo === null) return <span className="pr-mencao pr-roteiro__mencao">@{nome}</span>
  return (
    <>
      <button
        ref={gatilho}
        type="button"
        className="pr-mencao pr-roteiro__mencao pr-roteiro__mencao--abre"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        title={`Quem vê ${nome}`}
        onClick={() => setAberto((antes) => !antes)}
      >
        @{nome}
      </button>
      {/* Ao lado, não embaixo: o mestre continua lendo as linhas seguintes do roteiro com o pop aberto. */}
      <Pop aberto={aberto} gatilho={gatilho} onFechar={fechar} lado="dir" tipo="dialogo" rotulo={`Revelar ${nome}`}>
        {conteudo}
      </Pop>
    </>
  )
}

function Figura({ atributos, raiz }: { atributos: No; raiz: string | null }) {
  const url = raiz === null ? null : urlDaMidia(raiz, textoDe(atributos.midia))
  const legenda = textoDe(atributos.legenda)
  return (
    <figure className="pr-figura">
      {url === null ? <span className="pr-figura__falta">Imagem sem arquivo no Prelúdio</span> : <img src={url} alt={legenda || textoDe(atributos.alt)} loading="lazy" decoding="async" />}
      {legenda !== '' && <figcaption>{legenda}</figcaption>}
    </figure>
  )
}

function filhos(no: No, contexto: ContextoDoRoteiro): ReactNode[] {
  return nosDe(no.content).map((filho, indice) => desenhar(filho, indice, contexto))
}

function desenhar(no: No, chave: number, contexto: ContextoDoRoteiro): ReactNode {
  const atributos = atributosDe(no)
  switch (no.type) {
    case 'text':
      // A primeira marca fica por fora, como no editor.
      return <Fragment key={chave}>{(Array.isArray(no.marks) ? no.marks : []).reduceRight<ReactNode>(comMarca, textoDe(no.text))}</Fragment>
    case 'hardBreak':
      return <br key={chave} />
    case 'horizontalRule':
      return <hr key={chave} />
    case 'paragraph':
      return <p key={chave}>{filhos(no, contexto)}</p>
    case 'heading':
      // O título da página é h2 e o da seção, h3: os do texto descem um degrau.
      return Number(atributos.level) <= 2 ? <h4 key={chave}>{filhos(no, contexto)}</h4> : <h5 key={chave}>{filhos(no, contexto)}</h5>
    case 'bulletList':
      return <ul key={chave}>{filhos(no, contexto)}</ul>
    case 'orderedList': {
      const inicio = Number(atributos.start)
      return (
        <ol key={chave} start={Number.isInteger(inicio) && inicio > 1 ? inicio : undefined}>
          {filhos(no, contexto)}
        </ol>
      )
    }
    case 'listItem':
      return <li key={chave}>{filhos(no, contexto)}</li>
    case 'blockquote':
      return <blockquote key={chave}>{filhos(no, contexto)}</blockquote>
    case 'codeBlock':
      return (
        <pre key={chave}>
          <code>{filhos(no, contexto)}</code>
        </pre>
      )
    case 'image':
      return <Figura key={chave} atributos={atributos} raiz={contexto.raiz} />
    case PECAS_DO_TEXTO.segredo:
      return (
        <div key={chave} className="pr-segredo">
          {filhos(no, contexto)}
        </div>
      )
    case PECAS_DO_TEXTO.mencao: {
      const verbeteId = textoDe(atributos.verbeteId)
      const titulo = contexto.tituloDe(verbeteId)
      return titulo === undefined ? (
        <span key={chave} className="pr-mencao pr-mencao--quebrada" title="Este verbete não existe mais">
          @{textoDe(atributos.rotulo) || 'verbete'}
        </span>
      ) : (
        <MencaoDoRoteiro key={chave} verbeteId={verbeteId} titulo={titulo} contexto={contexto} />
      )
    }
    case PECAS_DO_TEXTO.ligacaoMesa: {
      const alvo = alvoDaMesa(atributos.alvo)
      const rotulo = textoDe(atributos.rotulo) || 'mesa'
      return alvo === null ? (
        <LinkQuebrado key={chave} tipo="torto" rotulo={rotulo} aviso="Este link não aponta para nada que o Labirinto entenda." />
      ) : (
        <LinkDaMesa key={chave} alvo={alvo} rotulo={rotulo} contexto={contexto} />
      )
    }
    case PECAS_DO_TEXTO.citacaoQuadro:
      // No mapa, a citação do quadro é só o nome: o quadro abre no Prelúdio.
      return (
        <span key={chave} className="pr-citacao pr-citacao--so-nome" title="Quadro do Prelúdio">
          {textoDe(atributos.rotulo) || 'quadro'}
        </span>
      )
    default:
      return Array.isArray(no.content) ? <Fragment key={chave}>{filhos(no, contexto)}</Fragment> : null
  }
}

/** Um texto do roteiro (uma seção). Vazio desenha nada: quem chama decide o aviso. */
export function TextoDoRoteiro({ texto, contexto }: { texto: TextoRico; contexto: ContextoDoRoteiro }) {
  return <div className="pr-texto__campo pr-roteiro__texto">{nosDe(texto.content).map((no, indice) => desenhar(no, indice, contexto))}</div>
}

/** As peças que contam como conteúdo sozinhas, sem texto em volta (a seção só com uma citação do quadro existe). */
const PECAS_COM_CONTEUDO: ReadonlySet<unknown> = new Set(['image', PECAS_DO_TEXTO.mencao, PECAS_DO_TEXTO.ligacaoMesa, PECAS_DO_TEXTO.citacaoQuadro])

/** O texto tem algo para ler (um parágrafo vazio não conta). */
export function temTexto(texto: TextoRico): boolean {
  const andar = (nos: readonly No[]): boolean => nos.some((no) => (no.type === 'text' ? textoDe(no.text).trim() !== '' : PECAS_COM_CONTEUDO.has(no.type) || andar(nosDe(no.content))))
  return andar(nosDe(texto.content))
}
