import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { buscarNoLivro, filtrarItens, indexarLivro, itensDoCatalogo, type ItemDoLivro, type ResultadoDaBusca, type TrechoAchado } from '../lib/buscaNoLivro'
import { atributosAbreviados, CATALOGOS_DO_LIVRO, type ChaveDoCatalogo } from '../lib/livroDeRegras'
import type { CapituloDoLivro, CatalogosDoSistema, SistemaDeRpg } from '../lib/sistemaDeRpg'
import { MarcacaoLeve } from './MarcacaoLeve'
import './LivroDeRegras.css'

/**
 * LIVRO DE REGRAS do sistema, só leitura (o editor vem na entrega 6): o
 * sumário (capítulos e catálogos) ao lado do leitor, e uma busca por cima que
 * acha nos dois sem ligar para acento. É a mesma tela no mestre (janela) e no
 * jogador (dentro da ficha em tela cheia); abaixo de 760 px o sumário vira um
 * seletor "Ir para", para o leitor ter a largura toda.
 */

export interface LivroDeRegrasProps {
  sistema: SistemaDeRpg
  livro: readonly CapituloDoLivro[]
  catalogos: CatalogosDoSistema | undefined
}

type Secao = { tipo: 'capitulo'; id: string } | { tipo: 'catalogo'; chave: ChaveDoCatalogo }

/** Valor do seletor "Ir para": o tipo e o id juntos (id de capítulo não tem ":"). */
function valorDaSecao(secao: Secao): string {
  return secao.tipo === 'capitulo' ? `capitulo:${secao.id}` : `catalogo:${secao.chave}`
}

export function LivroDeRegras({ sistema, livro, catalogos }: LivroDeRegrasProps) {
  const idBase = useId()
  const leitorRef = useRef<HTMLElement>(null)
  const catalogosComItens = CATALOGOS_DO_LIVRO.filter(({ chave }) => itensDoCatalogo(catalogos, chave).length > 0)
  const primeira: Secao | null =
    livro.length > 0 ? { tipo: 'capitulo', id: livro[0].id } : catalogosComItens.length > 0 ? { tipo: 'catalogo', chave: catalogosComItens[0].chave } : null
  const [escolhida, setEscolhida] = useState<Secao | null>(null)
  const [busca, setBusca] = useState('')
  /** Os achados que o capítulo aberto pela busca marca (consulta normalizada). */
  const [destaque, setDestaque] = useState('')
  const [filtros, setFiltros] = useState<Partial<Record<ChaveDoCatalogo, string>>>({})

  const indice = useMemo(() => indexarLivro(livro, catalogos), [livro, catalogos])
  const resultado = useMemo(() => buscarNoLivro(indice, busca), [indice, busca])
  const buscando = resultado.consulta.length > 0

  // Seção que sumiu (o livro mudou) volta para a primeira.
  const secao = escolhida !== null && secaoExiste(escolhida, livro, catalogos) ? escolhida : primeira

  // Trocou de seção: o leitor volta ao topo — ou ao primeiro achado, quando veio da busca.
  const chaveDoLeitor = secao === null ? '' : valorDaSecao(secao)
  useEffect(() => {
    const leitor = leitorRef.current
    if (leitor === null) return
    const marcado = destaque.length > 0 ? leitor.querySelector('mark') : null
    if (marcado !== null && typeof marcado.scrollIntoView === 'function') marcado.scrollIntoView({ block: 'center' })
    else leitor.scrollTop = 0
  }, [chaveDoLeitor, destaque])

  if (primeira === null || secao === null) {
    return <p className="lb-livro__vazio">O sistema {sistema.nome} não tem livro de regras.</p>
  }

  const irPara = (nova: Secao, marcar = '') => {
    setEscolhida(nova)
    setDestaque(marcar)
  }
  const abrirAchadoDoCatalogo = (chave: ChaveDoCatalogo, item: ItemDoLivro) => {
    setFiltros((atuais) => ({ ...atuais, [chave]: item.nome }))
    setBusca('')
    irPara({ tipo: 'catalogo', chave })
  }
  const abrirAchadoDoCapitulo = (capitulo: CapituloDoLivro) => {
    const marcar = resultado.consulta
    setBusca('')
    irPara({ tipo: 'capitulo', id: capitulo.id }, marcar)
  }

  const capituloAberto = secao.tipo === 'capitulo' ? livro.find((capitulo) => capitulo.id === secao.id) : undefined
  const posicao = capituloAberto === undefined ? -1 : livro.indexOf(capituloAberto)

  return (
    <div className="lb-livro">
      <div className="lb-livro__topo">
        <input
          type="search"
          className="lb-input lb-livro__busca"
          aria-label="Buscar no livro"
          placeholder="Buscar nas regras e nos catálogos…"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
        />
        <select
          className="lb-input lb-livro__ir"
          aria-label="Ir para"
          value={valorDaSecao(secao)}
          onChange={(event) => {
            const [tipo, id] = event.target.value.split(':')
            const chave = CATALOGOS_DO_LIVRO.find((catalogo) => catalogo.chave === id)
            if (tipo === 'capitulo') irPara({ tipo, id })
            else if (chave !== undefined) irPara({ tipo: 'catalogo', chave: chave.chave })
            setBusca('')
          }}
        >
          {livro.length > 0 && (
            <optgroup label="Capítulos">
              {livro.map((capitulo) => (
                <option key={capitulo.id} value={`capitulo:${capitulo.id}`}>
                  {capitulo.titulo}
                </option>
              ))}
            </optgroup>
          )}
          {catalogosComItens.length > 0 && (
            <optgroup label="Catálogos">
              {catalogosComItens.map(({ chave, rotulo }) => (
                <option key={chave} value={`catalogo:${chave}`}>
                  {rotulo}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <div className="lb-livro__miolo">
        <nav className="lb-livro__sumario lb-scroll" aria-label="Sumário do livro">
          {livro.length > 0 && (
            <>
              <p className="lb-livro__grupo" id={`${idBase}-capitulos`}>
                Capítulos
              </p>
              <ul aria-labelledby={`${idBase}-capitulos`}>
                {livro.map((capitulo) => (
                  <li key={capitulo.id}>
                    <button
                      type="button"
                      className="lb-livro__entrada"
                      aria-current={!buscando && secao.tipo === 'capitulo' && secao.id === capitulo.id ? 'true' : undefined}
                      onClick={() => {
                        setBusca('')
                        irPara({ tipo: 'capitulo', id: capitulo.id })
                      }}
                    >
                      {capitulo.titulo}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {catalogosComItens.length > 0 && (
            <>
              <p className="lb-livro__grupo" id={`${idBase}-catalogos`}>
                Catálogos
              </p>
              <ul aria-labelledby={`${idBase}-catalogos`}>
                {catalogosComItens.map(({ chave, rotulo }) => (
                  <li key={chave}>
                    <button
                      type="button"
                      className="lb-livro__entrada"
                      aria-current={!buscando && secao.tipo === 'catalogo' && secao.chave === chave ? 'true' : undefined}
                      onClick={() => {
                        setBusca('')
                        irPara({ tipo: 'catalogo', chave })
                      }}
                    >
                      {rotulo}
                      <span className="lb-livro__conta">{itensDoCatalogo(catalogos, chave).length}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>
        <article ref={leitorRef} className="lb-livro__leitor lb-scroll" aria-live={buscando ? 'polite' : undefined}>
          {buscando ? (
            <ResultadosDaBusca resultado={resultado} onCapitulo={abrirAchadoDoCapitulo} onItem={abrirAchadoDoCatalogo} />
          ) : capituloAberto !== undefined ? (
            <>
              <h2 className="lb-livro__titulo">{capituloAberto.titulo}</h2>
              {destaque.length > 0 && (
                <p className="lb-livro__marcados">
                  Achados da busca marcados.{' '}
                  <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setDestaque('')}>
                    Tirar marcas
                  </button>
                </p>
              )}
              <MarcacaoLeve texto={capituloAberto.texto} destaque={destaque} className="lb-livro__texto" />
              <div className="lb-livro__passos">
                {posicao > 0 && (
                  <button type="button" className="lb-btn lb-btn--ghost" onClick={() => irPara({ tipo: 'capitulo', id: livro[posicao - 1].id })}>
                    ← {livro[posicao - 1].titulo}
                  </button>
                )}
                {posicao >= 0 && posicao < livro.length - 1 && (
                  <button type="button" className="lb-btn lb-btn--ghost lb-livro__proximo" onClick={() => irPara({ tipo: 'capitulo', id: livro[posicao + 1].id })}>
                    {livro[posicao + 1].titulo} →
                  </button>
                )}
              </div>
            </>
          ) : secao.tipo === 'catalogo' ? (
            <ListaDoCatalogo
              sistema={sistema}
              chave={secao.chave}
              itens={itensDoCatalogo(catalogos, secao.chave)}
              filtro={filtros[secao.chave] ?? ''}
              onFiltro={(filtro) => setFiltros((atuais) => ({ ...atuais, [secao.chave]: filtro }))}
            />
          ) : null}
        </article>
      </div>
    </div>
  )
}

function secaoExiste(secao: Secao, livro: readonly CapituloDoLivro[], catalogos: CatalogosDoSistema | undefined): boolean {
  return secao.tipo === 'capitulo' ? livro.some((capitulo) => capitulo.id === secao.id) : itensDoCatalogo(catalogos, secao.chave).length > 0
}

function Trecho({ trecho }: { trecho: TrechoAchado }) {
  return (
    <span className="lb-livro__trecho">
      {trecho.antes}
      <mark>{trecho.achado}</mark>
      {trecho.depois}
    </span>
  )
}

const ROTULO_DO_CATALOGO = new Map(CATALOGOS_DO_LIVRO.map(({ chave, rotulo }) => [chave, rotulo]))

function ResultadosDaBusca({
  resultado,
  onCapitulo,
  onItem,
}: {
  resultado: ResultadoDaBusca
  onCapitulo: (capitulo: CapituloDoLivro) => void
  onItem: (chave: ChaveDoCatalogo, item: ItemDoLivro) => void
}) {
  const { capitulos, itens } = resultado
  if (capitulos.length === 0 && itens.length === 0) return <p className="lb-livro__vazio">Nada no livro com essa busca. Tente outra palavra.</p>
  return (
    <div className="lb-livro__resultados">
      {capitulos.length > 0 && (
        <section aria-label="Achados nos capítulos">
          <h2 className="lb-livro__grupo">Capítulos</h2>
          <ul>
            {capitulos.map((achado) => (
              <li key={achado.capitulo.id}>
                <button type="button" className="lb-livro__achado" onClick={() => onCapitulo(achado.capitulo)}>
                  <span className="lb-livro__achado-nome">
                    {achado.capitulo.titulo}
                    {achado.ocorrencias > 1 && <span className="lb-livro__conta">{achado.ocorrencias}×</span>}
                  </span>
                  {achado.trecho !== null && <Trecho trecho={achado.trecho} />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {itens.length > 0 && (
        <section aria-label="Achados nos catálogos">
          <h2 className="lb-livro__grupo">Catálogos</h2>
          <ul>
            {itens.map((achado) => (
              <li key={`${achado.chave}:${achado.item.nome}`}>
                <button type="button" className="lb-livro__achado" onClick={() => onItem(achado.chave, achado.item)}>
                  <span className="lb-livro__achado-nome">
                    {achado.item.nome}
                    <span className="lb-livro__conta">{ROTULO_DO_CATALOGO.get(achado.chave)}</span>
                  </span>
                  {achado.trecho !== null && <Trecho trecho={achado.trecho} />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ListaDoCatalogo({
  sistema,
  chave,
  itens,
  filtro,
  onFiltro,
}: {
  sistema: SistemaDeRpg
  chave: ChaveDoCatalogo
  itens: readonly ItemDoLivro[]
  filtro: string
  onFiltro: (filtro: string) => void
}) {
  const rotulo = ROTULO_DO_CATALOGO.get(chave) ?? chave
  const visiveis = useMemo(() => filtrarItens(itens, filtro), [itens, filtro])
  return (
    <div className="lb-livro__catalogo">
      <div className="lb-livro__catalogo-topo">
        <h2 className="lb-livro__titulo">{rotulo}</h2>
        <input
          type="search"
          className="lb-input lb-livro__filtro"
          aria-label={`Filtrar ${rotulo.toLowerCase()}`}
          placeholder={`Filtrar ${rotulo.toLowerCase()}…`}
          value={filtro}
          onChange={(event) => onFiltro(event.target.value)}
        />
      </div>
      <p className="lb-livro__quantos" aria-live="polite">
        {visiveis.length === itens.length ? `${itens.length} ${itens.length === 1 ? 'item' : 'itens'}` : `${visiveis.length} de ${itens.length}`}
      </p>
      {visiveis.length === 0 ? (
        <p className="lb-livro__vazio">Nada em {rotulo} com esse filtro.</p>
      ) : (
        <ul className="lb-livro__itens">
          {visiveis.map((item) => (
            <li key={item.nome} className="lb-livro__item">
              <h3 className="lb-livro__item-nome">
                {item.nome}
                {item.atributos !== undefined && item.atributos.length > 0 && <span className="lb-livro__atributos">{atributosAbreviados(sistema, item.atributos)}</span>}
              </h3>
              {item.descricao !== undefined && item.descricao.length > 0 && <MarcacaoLeve texto={item.descricao} className="lb-livro__item-texto" />}
              {item.efeito !== undefined && item.efeito.length > 0 && (
                <div className="lb-livro__efeito">
                  <span className="lb-livro__efeito-rotulo">Efeito</span>
                  <MarcacaoLeve texto={item.efeito} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
