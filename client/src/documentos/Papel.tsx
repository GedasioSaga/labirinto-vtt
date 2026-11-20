import { useId, type CSSProperties, type ReactNode } from 'react'
import type { ResolverDeImagem } from '../lib/midia'
import { ARTES, contornoDaCera, furosDoCarimbo, recorteDoPapel, tamanhoDoTextoDoCarimbo, tom, fundoDasManchas } from './desenhoDoPapel'
import { sementeDoTexto } from './resolver'
import type { ArteDoDocumento, BlocoNoFio, BlocoProtegidoNoFio, DocumentoNoFio, ExtrasDoDocumento, PaginaNoFio, PapelDoDocumento } from './tipos'
import './Papel.css'

/**
 * O PAPEL de um documento (plano dos puzzles, §3.1 e fase D5; protótipos
 * aprovados `docs/design/puzzles/prototipo-v2.html`, `htmlPapel`, e
 * `prototipo-documento-extras.html`, `htmlFolha`): os 5 papéis desenhados em
 * CSS e a imagem própria do mestre, uma página por vez, com os extras: letra,
 * tinta, desgaste, o selo ou carimbo e a assinatura no fim da última página,
 * o brasão no cabeçalho da primeira.
 *
 * Desenha SÓ o que o host mandou (`DocumentoNoFio`): o trecho protegido chega
 * resolvido para quem lê, e o claro de quem não tem o item nunca está aqui. O
 * mestre passa o mesmo pacote, montado no computador dele pelo resolver.
 *
 * O texto vira elementos do React, nunca HTML: `**negrito**`, `*itálico*`,
 * linha em branco separa parágrafos e a quebra simples vira `<br>`.
 */

export const NOMES_DOS_PAPEIS: Readonly<Record<PapelDoDocumento, string>> = {
  alfinete: 'Com alfinete',
  carta: 'Carta',
  diario: 'Página de diário',
  bilhete: 'Bilhete rasgado',
  pergaminho: 'Pergaminho',
  imagem: 'Imagem própria',
}

export interface PapelProps {
  documento: DocumentoNoFio
  /** Índice da página (de 0); fora da lista, a mais perto. */
  pagina: number
  resolver: ResolverDeImagem
  /** `previa`: menor, para caber na página do livro. */
  tamanho?: 'cheio' | 'previa'
  /** Id do título, para o diálogo da leitura se nomear por ele (nas outras páginas o título fica só para o leitor de tela). */
  idDoTitulo?: string
  /** O nome do item que leu um trecho (o mestre o acha no acervo). Ausente, ou `null`: "um item que você carrega". */
  nomeDoItem?: (itemId: string) => string | null
}

const NEGRITO_OU_ITALICO = /\*\*(.+?)\*\*|\*(.+?)\*/g
const SO_ITALICO = /\*(.+?)\*/g
/** O lugar de cada trecho protegido no texto juntado da página: dois caracteres de uso privado em volta do índice. */
const LUGAR_DO_TRECHO = /(\d+)/g
const MARCA_DO_LUGAR = /[]/g

type DesenharTrecho = (indice: number, chave: string) => ReactNode

/** Um pedaço sem marca de negrito nem itálico: o texto, com os trechos protegidos no lugar deles. */
function comTrechos(texto: string, chave: string, trecho: DesenharTrecho): ReactNode[] {
  const nos: ReactNode[] = []
  let depoisDoUltimo = 0
  for (const lugar of texto.matchAll(LUGAR_DO_TRECHO)) {
    if (lugar.index > depoisDoUltimo) nos.push(texto.slice(depoisDoUltimo, lugar.index))
    nos.push(trecho(Number(lugar[1]), `${chave}-t${lugar.index}`))
    depoisDoUltimo = lugar.index + lugar[0].length
  }
  if (depoisDoUltimo < texto.length) nos.push(texto.slice(depoisDoUltimo))
  return nos
}

/** Uma linha com as marcas de negrito e itálico; dentro do negrito, só itálico (como o protótipo). */
function linhaMarcada(linha: string, chave: string, soItalico: boolean, trecho: DesenharTrecho): ReactNode[] {
  const marca = new RegExp(soItalico ? SO_ITALICO : NEGRITO_OU_ITALICO)
  const nos: ReactNode[] = []
  let depoisDoUltimo = 0
  let achado = marca.exec(linha)
  while (achado !== null) {
    if (achado.index > depoisDoUltimo) nos.push(...comTrechos(linha.slice(depoisDoUltimo, achado.index), `${chave}-${depoisDoUltimo}`, trecho))
    const k = `${chave}-${achado.index}`
    // Com `soItalico`, o único grupo é o itálico (o 1); sem ele, o 1 é o negrito e o 2, o itálico.
    const negrito = soItalico ? undefined : achado[1]
    const italico = soItalico ? achado[1] : achado[2]
    if (negrito !== undefined) nos.push(<strong key={k}>{linhaMarcada(negrito, k, true, trecho)}</strong>)
    else if (italico !== undefined) nos.push(<em key={k}>{comTrechos(italico, k, trecho)}</em>)
    depoisDoUltimo = achado.index + achado[0].length
    achado = marca.exec(linha)
  }
  if (depoisDoUltimo < linha.length) nos.push(...comTrechos(linha.slice(depoisDoUltimo), `${chave}-${depoisDoUltimo}`, trecho))
  return nos
}

/** Os parágrafos de uma página; vazia = `null` (o papel diz "Página em branco"). */
function paragrafosDoTexto(texto: string, trecho: DesenharTrecho): ReactNode[] | null {
  const limpo = texto.trim()
  if (limpo === '') return null
  return limpo.split(/\n{2,}/).map((paragrafo, p) => (
    <p key={p}>
      {paragrafo.split('\n').map((linha, l) => (
        <span key={l}>
          {l > 0 && <br />}
          {linhaMarcada(linha, `${p}-${l}`, false, trecho)}
        </span>
      ))}
    </p>
  ))
}

/**
 * Os pedaços da página num texto só (o `htmlBlocos` do protótipo): cada
 * trecho protegido vira um lugar marcado, para o negrito e o itálico em volta
 * dele continuarem valendo. O texto do mestre perde os dois caracteres da marca.
 */
function textoComLugares(blocos: readonly BlocoNoFio[]): { texto: string; protegidos: BlocoProtegidoNoFio[] } {
  const protegidos: BlocoProtegidoNoFio[] = []
  const texto = blocos
    .map((bloco) => {
      if (bloco.t === 'texto') return bloco.texto.replace(MARCA_DO_LUGAR, '')
      protegidos.push(bloco)
      return `${protegidos.length - 1}`
    })
    .join('')
  return { texto, protegidos }
}

/** A lente da etiqueta "lido com": o mesmo ícone para todo item (o acervo do mestre não tem um desenho por item). */
export function IconeDaLente() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14.6 14.6 20.5 20.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M6.9 8.6a3.6 3.6 0 0 1 2.4-2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".75" />
    </svg>
  )
}

/** O desenho de um selo, carimbo ou brasão no traço simples (a escolha da ficha). */
export function DesenhoDaArte({ arte }: { arte: ArteDoDocumento }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d={ARTES[arte].d} />
    </svg>
  )
}

function Trecho({ bloco, nomeDoItem }: { bloco: BlocoProtegidoNoFio; nomeDoItem: PapelProps['nomeDoItem'] }) {
  if (bloco.tipo === 'borrado') {
    return (
      <>
        <span className="trecho trecho--borrado" aria-hidden="true">
          {bloco.texto}
        </span>
        <span className="papel__so-leitor">(um trecho borrado, impossível de ler)</span>
      </>
    )
  }
  if (!bloco.lido) {
    return (
      <>
        <span className={`trecho trecho--cifra trecho--${bloco.mostra}`}>{bloco.texto}</span>
        <span className="papel__so-leitor">(um trecho que você não consegue ler)</span>
      </>
    )
  }
  const nome = nomeDoItem?.(bloco.com) ?? null
  const com = nome === null ? 'um item que você carrega' : nome
  return (
    <>
      {/* O texto deste span é do leitor do jogador enquanto ele decifra (`PlayerDocumentos.tsx`): o React o escreve uma vez só. */}
      <span className="trecho trecho--lido" data-trecho={bloco.id}>
        {bloco.texto}
      </span>
      <span className="trecho__com" data-com={bloco.id} title={`Lido com ${com}`}>
        <IconeDaLente />
        <span className="papel__so-leitor">(lido com {com})</span>
      </span>
    </>
  )
}

function SeloDeCera({ cor, arte, semente }: { cor: string; arte: ArteDoDocumento; semente: number }) {
  const escuro = tom(cor, 0.6)
  const claro = tom(cor, 1.5)
  const d = ARTES[arte].d
  return (
    <svg className="papel__selo papel__selo--cera" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
      <path d={contornoDaCera(semente)} fill={cor} stroke={escuro} strokeWidth="1.2" />
      <circle r="31" fill={tom(cor, 0.84)} />
      <circle r="31" fill="none" stroke={escuro} strokeWidth="2.4" />
      <circle r="27.4" fill="none" stroke={claro} strokeWidth="1" opacity=".45" />
      <g transform="translate(-21.6 -21.6) scale(.9)" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.2">
        <path d={d} stroke={claro} opacity=".5" transform="translate(-.9 -.9)" />
        <path d={d} stroke={escuro} transform="translate(.8 .8)" />
        <path d={d} stroke={tom(cor, 0.92)} />
      </g>
      <path d="M-31-17a36 36 0 0 1 21-19" stroke={claro} strokeWidth="3" fill="none" strokeLinecap="round" opacity=".45" />
    </svg>
  )
}

function Carimbo({ cor, arte, texto, semente, idBase }: { cor: string; arte: ArteDoDocumento; texto: string; semente: number; idBase: string }) {
  const emVolta = texto.trim().toLocaleUpperCase('pt-BR')
  const mascara = `${idBase}-m`
  const volta = `${idBase}-c`
  return (
    <svg className="papel__selo papel__selo--carimbo" viewBox="-60 -60 120 120" aria-hidden="true" focusable="false">
      <defs>
        <mask id={mascara}>
          <rect x="-60" y="-60" width="120" height="120" fill="#fff" />
          {furosDoCarimbo(semente).map((furo, i) => (
            <circle key={i} cx={furo.cx.toFixed(1)} cy={furo.cy.toFixed(1)} r={furo.r.toFixed(1)} fill="#000" />
          ))}
        </mask>
        <path id={volta} d="M-41 0a41 41 0 1 1 82 0a41 41 0 1 1-82 0" />
      </defs>
      <g mask={`url(#${mascara})`} fill="none" stroke={cor}>
        <circle r="55" strokeWidth="3.6" />
        <circle r="50" strokeWidth="1.2" />
        <circle r="31" strokeWidth="1.6" />
        {emVolta !== '' && (
          <text fill={cor} stroke="none" fontFamily="'Courier New', monospace" fontWeight="700" fontSize={tamanhoDoTextoDoCarimbo(emVolta).toFixed(1)} letterSpacing="1.2">
            <textPath href={`#${volta}`} startOffset="25%" textAnchor="middle">
              {emVolta}
            </textPath>
          </text>
        )}
        <g transform="translate(-19.2 -19.2) scale(.8)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d={ARTES[arte].d} />
        </g>
      </g>
    </svg>
  )
}

function DesenhoDoBrasao({ arte }: { arte: ArteDoDocumento }) {
  return (
    <svg viewBox="0 0 48 52" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
      <path d="M7 5h34v16c0 12-7.6 19.6-17 23.6C14.6 40.6 7 33 7 21z" strokeWidth="2.2" />
      <path d="M11 9h26v12c0 9.4-5.8 15.4-13 18.6C16.8 36.4 11 30.4 11 21z" strokeWidth="1" />
      <g transform="translate(13.2 11) scale(.45)" strokeWidth="4.4">
        <path d={ARTES[arte].d} />
      </g>
    </svg>
  )
}

/** O cabeçalho da 1ª página: o brasão (imagem ou desenho) em cima do título; sem brasão, só o título. */
function Cabeca({ extras, titulo, idDoTitulo, resolver }: { extras: ExtrasDoDocumento; titulo: string; idDoTitulo: string | undefined; resolver: ResolverDeImagem }) {
  const h2 = (
    <h2 className="papel__titulo" id={idDoTitulo}>
      {titulo}
    </h2>
  )
  const brasao = extras.brasao
  const imagem = brasao === null ? null : resolver(brasao.imagem)
  const arte = brasao === null || imagem !== null ? null : brasao.arte
  if (imagem === null && arte === null) return h2
  return (
    <header className="papel__cabeca">
      {imagem !== null ? <img src={imagem} alt="" draggable={false} /> : arte !== null && <DesenhoDoBrasao arte={arte} />}
      {h2}
    </header>
  )
}

function Assinatura({ texto }: { texto: string }) {
  return (
    <p className="papel__assinatura">
      {texto}
      <svg viewBox="0 0 160 12" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M3 8C28 2 52 11 80 7s52-5 77 1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </p>
  )
}

/** O `useId` do React em forma que vale dentro de `url(#…)` do SVG (os ids dos dois carimbos na tela não se cruzam). */
function idParaSvg(id: string): string {
  return `papel-${id.replace(/[^A-Za-z0-9_-]/g, '')}`
}

export function Papel({ documento, pagina, resolver, tamanho = 'cheio', idDoTitulo, nomeDoItem }: PapelProps) {
  const idBase = idParaSvg(useId())
  const total = documento.paginas.length
  const indice = Math.min(Math.max(0, Math.floor(pagina)), Math.max(0, total - 1))
  const atual: PaginaNoFio = documento.paginas[indice] ?? { blocos: [], imagem: null }
  const primeira = indice === 0
  const ultima = indice === total - 1
  const { extras } = documento
  const { desgaste, selo } = extras
  const semente = sementeDoTexto(documento.docId)
  const imagemDaPagina = resolver(atual.imagem)
  const fundo = documento.papel === 'imagem' ? resolver(documento.imagemDoPapel) : null
  const titulo = documento.titulo.trim() === '' ? 'Sem título' : documento.titulo
  const recortado = desgaste.bordaQueimada || desgaste.rasgos
  const { texto, protegidos } = textoComLugares(atual.blocos)
  const desenharTrecho: DesenharTrecho = (i, chave) => {
    const bloco = protegidos[i]
    return bloco === undefined ? null : <Trecho key={chave} bloco={bloco} nomeDoItem={nomeDoItem} />
  }
  const paragrafos = paragrafosDoTexto(texto, desenharTrecho)
  const assinatura = extras.assinatura === null ? '' : extras.assinatura.trim()
  const seloAqui = ultima ? selo : null

  const estilo: CSSProperties = {}
  if (desgaste.cor !== null) estilo.backgroundColor = desgaste.cor
  if (fundo !== null) estilo.backgroundImage = `url(${JSON.stringify(fundo)})`
  if (recortado) estilo.clipPath = recorteDoPapel(semente, desgaste, documento.papel)

  const classes = [
    'papel',
    `papel--${documento.papel}`,
    `letra--${extras.letra}`,
    `tinta--${extras.tinta}`,
    selo !== null && 'papel--com-selo',
    seloAqui !== null && 'papel--selo-fim',
    tamanho === 'previa' && 'papel--previa',
  ].filter((classe) => classe !== false)

  return (
    <div className={`folha${recortado || documento.papel === 'bilhete' ? ' folha--recortada' : ''}${tamanho === 'previa' ? ' folha--previa' : ''}`}>
      <article className={classes.join(' ')} style={estilo}>
        <span className="papel__grao" aria-hidden="true" />
        {desgaste.manchas > 0 && <span className="papel__manchas" aria-hidden="true" style={{ background: fundoDasManchas(semente, desgaste.manchas) }} />}
        {desgaste.dobras && <span className="papel__dobras" aria-hidden="true" />}
        {desgaste.bordaQueimada && <span className="papel__queima" aria-hidden="true" />}
        {primeira ? (
          <Cabeca extras={extras} titulo={titulo} idDoTitulo={idDoTitulo} resolver={resolver} />
        ) : (
          idDoTitulo !== undefined && (
            <h2 className="papel__so-leitor" id={idDoTitulo}>
              {titulo}
            </h2>
          )
        )}
        {imagemDaPagina !== null && <img className="papel__img" src={imagemDaPagina} alt="" draggable={false} />}
        {/* `key` = a página: trocar de página monta os trechos de novo (a decifração de cada um começa do zero). */}
        <div className="papel__texto" key={indice}>
          {paragrafos ?? <p className="papel__vazio">Página em branco.</p>}
        </div>
        {ultima && assinatura !== '' && <Assinatura texto={assinatura} />}
        {seloAqui !== null &&
          (seloAqui.tipo === 'cera' ? (
            <SeloDeCera cor={seloAqui.cor} arte={seloAqui.arte} semente={semente} />
          ) : (
            <Carimbo cor={seloAqui.cor} arte={seloAqui.arte} texto={seloAqui.texto} semente={semente} idBase={idBase} />
          ))}
        {total > 1 && (
          <span className="papel__folha">
            {indice + 1} / {total}
          </span>
        )}
      </article>
    </div>
  )
}
