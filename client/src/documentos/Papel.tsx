import type { ReactNode } from 'react'
import type { ResolverDeImagem } from '../lib/midia'
import type { Documento, PaginaDoDocumento, PapelDoDocumento } from './tipos'
import './Papel.css'

/**
 * O PAPEL de um documento (plano dos puzzles, §3.1; protótipo aprovado
 * `docs/design/puzzles/prototipo-v2.html`, `htmlPapel`): os 5 papéis desenhados
 * em CSS e a imagem própria do mestre, uma página por vez. Serve ao mestre (a
 * prévia da página Documentos) e, na D3, ao jogador. Os extras (letra, tinta,
 * desgaste, selo, assinatura, brasão) entram na D5.
 *
 * O texto vira elementos do React, nunca HTML: `**negrito**`, `*itálico*`,
 * linha em branco separa parágrafos e a quebra simples vira `<br>`. As marcas
 * de trecho protegido (`{{cifra:ID}}`) saem como estão até a D5.
 */

export const NOMES_DOS_PAPEIS: Readonly<Record<PapelDoDocumento, string>> = {
  alfinete: 'Com alfinete',
  carta: 'Carta',
  diario: 'Página de diário',
  bilhete: 'Bilhete rasgado',
  pergaminho: 'Pergaminho',
  imagem: 'Imagem própria',
}

/** O que o papel precisa do documento: o mestre passa o `Documento`; o jogador, o que o host mandou. */
export interface DocumentoNoPapel extends Pick<Documento, 'titulo' | 'papel' | 'imagemDoPapel'> {
  paginas: readonly PaginaDoDocumento[]
}

export interface PapelProps {
  documento: DocumentoNoPapel
  /** Índice da página (de 0); fora da lista, a mais perto. */
  pagina: number
  resolver: ResolverDeImagem
  /** `previa`: menor, para caber na página do livro. */
  tamanho?: 'cheio' | 'previa'
  /** Id do título, para o diálogo da leitura se nomear por ele (nas outras páginas o título fica só para o leitor de tela). */
  idDoTitulo?: string
}

const NEGRITO_OU_ITALICO = /\*\*(.+?)\*\*|\*(.+?)\*/g
const SO_ITALICO = /\*(.+?)\*/g

/** Uma linha com as marcas de negrito e itálico; dentro do negrito, só itálico (como o protótipo). */
function linhaMarcada(linha: string, chave: string, soItalico: boolean): ReactNode[] {
  const marca = new RegExp(soItalico ? SO_ITALICO : NEGRITO_OU_ITALICO)
  const nos: ReactNode[] = []
  let depoisDoUltimo = 0
  let achado = marca.exec(linha)
  while (achado !== null) {
    if (achado.index > depoisDoUltimo) nos.push(linha.slice(depoisDoUltimo, achado.index))
    const k = `${chave}-${achado.index}`
    // Com `soItalico`, o único grupo é o itálico (o 1); sem ele, o 1 é o negrito e o 2, o itálico.
    const negrito = soItalico ? undefined : achado[1]
    const italico = soItalico ? achado[1] : achado[2]
    if (negrito !== undefined) nos.push(<strong key={k}>{linhaMarcada(negrito, k, true)}</strong>)
    else if (italico !== undefined) nos.push(<em key={k}>{italico}</em>)
    depoisDoUltimo = achado.index + achado[0].length
    achado = marca.exec(linha)
  }
  if (depoisDoUltimo < linha.length) nos.push(linha.slice(depoisDoUltimo))
  return nos
}

/** Os parágrafos de uma página; vazia = `null` (o papel diz "Página em branco"). */
export function paragrafosDoTexto(texto: string): ReactNode[] | null {
  const limpo = texto.trim()
  if (limpo === '') return null
  return limpo.split(/\n{2,}/).map((paragrafo, p) => (
    <p key={p}>
      {paragrafo.split('\n').map((linha, l) => (
        <span key={l}>
          {l > 0 && <br />}
          {linhaMarcada(linha, `${p}-${l}`, false)}
        </span>
      ))}
    </p>
  ))
}

export function Papel({ documento, pagina, resolver, tamanho = 'cheio', idDoTitulo }: PapelProps) {
  const total = documento.paginas.length
  const indice = Math.min(Math.max(0, Math.floor(pagina)), Math.max(0, total - 1))
  const atual: PaginaDoDocumento = documento.paginas[indice] ?? { texto: '', imagem: null }
  const imagemDaPagina = resolver(atual.imagem)
  const fundo = documento.papel === 'imagem' ? resolver(documento.imagemDoPapel) : null
  const titulo = documento.titulo.trim() === '' ? 'Sem título' : documento.titulo
  const paragrafos = paragrafosDoTexto(atual.texto)
  return (
    <article
      className={`papel papel--${documento.papel}${tamanho === 'previa' ? ' papel--previa' : ''}`}
      style={fundo === null ? undefined : { backgroundImage: `url(${JSON.stringify(fundo)})` }}
    >
      <span className="papel__grao" aria-hidden="true" />
      {indice === 0 ? (
        <h2 className="papel__titulo" id={idDoTitulo}>
          {titulo}
        </h2>
      ) : (
        idDoTitulo !== undefined && (
          <h2 className="papel__so-leitor" id={idDoTitulo}>
            {titulo}
          </h2>
        )
      )}
      {imagemDaPagina !== null && <img className="papel__img" src={imagemDaPagina} alt="" draggable={false} />}
      <div className="papel__texto">{paragrafos ?? <p className="papel__vazio">Página em branco.</p>}</div>
      {total > 1 && (
        <span className="papel__folha">
          {indice + 1} / {total}
        </span>
      )}
    </article>
  )
}
