import { useDeferredValue, useId, useState } from 'react'
import { normalizarParaBusca } from '../lib/buscaNoLivro'
import { capituloNovo, itemNovo, tirarLinha, trocarLinha, type RascunhoDeCapitulo, type RascunhoDeItem } from '../lib/editorDeSistema'
import { CATALOGOS_DO_LIVRO, type ChaveDoCatalogo } from '../lib/livroDeRegras'
import { CAPITULO_TEXTO_MAX, CAPITULO_TITULO_MAX, CATALOGO_NOME_MAX, CATALOGO_TEXTO_MAX } from '../lib/sistemaDeRpg'
import { CampoDeTexto, DICA_DO_ID, type SecaoDoEditorProps } from './EditorDeSistemaPartes'
import { MarcacaoLeve } from './MarcacaoLeve'
import './LivroDeRegras.css'

/**
 * Catálogos e Livro do EDITOR DE SISTEMA: listas que passam de cem itens (o
 * One Piece tem 47 perícias e 14 capítulos de ~74 mil letras), por isso em
 * LISTA E DETALHE — à esquerda os nomes, à direita só o item aberto. Desenhar
 * todos os campos de uma vez faria cada tecla redesenhar centenas de caixas.
 */

const milhar = (n: number): string => n.toLocaleString('pt-BR')
const DICA_DA_MARCACAO = 'Marcação leve: # título, **negrito**, *itálico*, __sublinhado__, ~~riscado~~, - lista, 1. lista, > citação, --- régua.'

export function SecaoCatalogos({ rascunho, mudar }: SecaoDoEditorProps) {
  const filtroId = useId()
  const [catalogo, setCatalogo] = useState<ChaveDoCatalogo>('pericias')
  const [aberto, setAberto] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')
  const itens = rascunho.catalogos[catalogo]
  const rotulo = CATALOGOS_DO_LIVRO.find((entrada) => entrada.chave === catalogo)?.rotulo ?? catalogo
  const trocarItens = (mudanca: (lista: RascunhoDeItem[]) => RascunhoDeItem[]) =>
    mudar((atual) => ({ ...atual, catalogos: { ...atual.catalogos, [catalogo]: mudanca(atual.catalogos[catalogo]) } }))
  const consulta = normalizarParaBusca(filtro.trim())
  const visiveis = consulta.length === 0 ? itens : itens.filter((item) => normalizarParaBusca(item.nome).includes(consulta))
  const item = itens.find((candidato) => candidato.chave === aberto)

  return (
    <div className="lb-sistema-editor__secao-corpo">
      <p className="lb-field__hint">O que o "Escolher do livro" da ficha copia para um cartão, e o que o livro lista. O nome não repete dentro de um catálogo.</p>
      <div className="lb-seg lb-sistema-editor__catalogos" role="group" aria-label="Catálogo">
        {CATALOGOS_DO_LIVRO.map((entrada) => (
          <button
            key={entrada.chave}
            type="button"
            className="lb-seg__option"
            aria-pressed={entrada.chave === catalogo}
            onClick={() => {
              setCatalogo(entrada.chave)
              setAberto(null)
              setFiltro('')
            }}
          >
            {entrada.rotulo} <span className="lb-sistema-editor__conta">{rascunho.catalogos[entrada.chave].length}</span>
          </button>
        ))}
      </div>
      <div className="lb-sistema-editor__mestre">
        <div className="lb-sistema-editor__indice">
          <label className="lb-label" htmlFor={filtroId}>
            Filtrar {rotulo.toLocaleLowerCase('pt-BR')}
          </label>
          <input id={filtroId} type="search" className="lb-input" value={filtro} onChange={(event) => setFiltro(event.target.value)} />
          <ul className="lb-sistema-editor__nomes" aria-label={rotulo}>
            {visiveis.map((candidato) => (
              <li key={candidato.chave}>
                <button type="button" className="lb-sistema-editor__nome" aria-pressed={candidato.chave === aberto} onClick={() => setAberto(candidato.chave)}>
                  {candidato.nome.trim() || '(sem nome)'}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="lb-btn lb-sistema-editor__mais"
            onClick={() => {
              const novo = itemNovo()
              trocarItens((lista) => [...lista, novo])
              setAberto(novo.chave)
              setFiltro('')
            }}
          >
            + Item
          </button>
        </div>
        <div className="lb-sistema-editor__detalhe">
          {item === undefined ? (
            <p className="lb-field__hint">{itens.length === 0 ? `Nenhum item em ${rotulo}.` : 'Escolha um item à esquerda.'}</p>
          ) : (
            <DetalheDoItem
              key={item.chave}
              item={item}
              catalogo={catalogo}
              atributos={rascunho.atributos.map((atributo, i) => ({ chave: atributo.chave, nome: atributo.nome.trim() || `Atributo ${i + 1}` }))}
              trocar={(parcial) => trocarItens((lista) => trocarLinha(lista, item.chave, parcial))}
              onTirar={() => {
                trocarItens((lista) => tirarLinha(lista, item.chave))
                setAberto(null)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface DetalheDoItemProps {
  item: RascunhoDeItem
  catalogo: ChaveDoCatalogo
  atributos: readonly { chave: string; nome: string }[]
  trocar: (parcial: Partial<RascunhoDeItem>) => void
  onTirar: () => void
}

function DetalheDoItem({ item, catalogo, atributos, trocar, onTirar }: DetalheDoItemProps) {
  const comEfeito = catalogo === 'vantagens' || catalogo === 'desvantagens'
  const nome = item.nome.trim() || 'o item'
  return (
    <>
      <CampoDeTexto rotulo="Nome" valor={item.nome} onChange={(valor) => trocar({ nome: valor })} maxLength={CATALOGO_NOME_MAX} />
      <CampoDeTexto rotulo="Descrição" valor={item.descricao} onChange={(descricao) => trocar({ descricao })} linhas={6} maxLength={CATALOGO_TEXTO_MAX} dica={DICA_DA_MARCACAO} />
      {comEfeito && <CampoDeTexto rotulo="Efeito" valor={item.efeito} onChange={(efeito) => trocar({ efeito })} linhas={3} maxLength={CATALOGO_TEXTO_MAX} />}
      {catalogo === 'pericias' && (
        <fieldset className="lb-sistema-editor__partes">
          <legend className="lb-eyebrow">Atributos da perícia</legend>
          {atributos.map((atributo) => (
            <label key={atributo.chave} className="lb-sistema-editor__marca">
              <input
                type="checkbox"
                checked={item.atributos.includes(atributo.chave)}
                onChange={(event) =>
                  trocar({ atributos: event.target.checked ? [...item.atributos, atributo.chave] : item.atributos.filter((chave) => chave !== atributo.chave) })
                }
              />
              {atributo.nome}
            </label>
          ))}
        </fieldset>
      )}
      <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact lb-sistema-editor__tirar" onClick={onTirar}>
        Tirar {nome}
      </button>
    </>
  )
}

/** A ordem do sumário, como o leitor do livro faz: ordem que não é número vai para o fim. */
function ordemDe(capitulo: RascunhoDeCapitulo): number {
  const ordem = Number(capitulo.ordem.trim())
  return capitulo.ordem.trim().length > 0 && Number.isFinite(ordem) ? ordem : Number.POSITIVE_INFINITY
}

export function SecaoLivro({ rascunho, mudar }: SecaoDoEditorProps) {
  const livro = rascunho.livro
  const [aberto, setAberto] = useState<string | null>(livro.length > 0 ? livro[0].chave : null)
  const trocarLivro = (mudanca: (lista: RascunhoDeCapitulo[]) => RascunhoDeCapitulo[]) => mudar((atual) => ({ ...atual, livro: mudanca(atual.livro) }))
  const sumario = livro.map((capitulo, indice) => ({ capitulo, indice })).sort((a, b) => ordemDe(a.capitulo) - ordemDe(b.capitulo) || a.indice - b.indice)
  const capitulo = livro.find((candidato) => candidato.chave === aberto)
  const total = livro.reduce((soma, candidato) => soma + candidato.texto.trim().length, 0)

  return (
    <div className="lb-sistema-editor__secao-corpo">
      <p className="lb-field__hint">
        Os capítulos do livro de regras, na ordem do sumário. {milhar(livro.length)} capítulo(s), {milhar(total)} letras. {DICA_DO_ID}
      </p>
      <div className="lb-sistema-editor__mestre">
        <div className="lb-sistema-editor__indice">
          <ul className="lb-sistema-editor__nomes" aria-label="Capítulos">
            {sumario.map(({ capitulo: candidato }) => (
              <li key={candidato.chave}>
                <button type="button" className="lb-sistema-editor__nome" aria-pressed={candidato.chave === aberto} onClick={() => setAberto(candidato.chave)}>
                  <span className="lb-sistema-editor__ordem">{candidato.ordem.trim() || '?'}</span> {candidato.titulo.trim() || '(sem título)'}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="lb-btn lb-sistema-editor__mais"
            onClick={() => {
              const novo = capituloNovo(livro)
              trocarLivro((lista) => [...lista, novo])
              setAberto(novo.chave)
            }}
          >
            + Capítulo
          </button>
        </div>
        <div className="lb-sistema-editor__detalhe">
          {capitulo === undefined ? (
            <p className="lb-field__hint">{livro.length === 0 ? 'O sistema ainda não tem livro: o "+ Capítulo" começa um.' : 'Escolha um capítulo à esquerda.'}</p>
          ) : (
            <DetalheDoCapitulo
              key={capitulo.chave}
              capitulo={capitulo}
              trocar={(parcial) => trocarLivro((lista) => trocarLinha(lista, capitulo.chave, parcial))}
              onTirar={() => {
                trocarLivro((lista) => tirarLinha(lista, capitulo.chave))
                setAberto(null)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface DetalheDoCapituloProps {
  capitulo: RascunhoDeCapitulo
  trocar: (parcial: Partial<RascunhoDeCapitulo>) => void
  onTirar: () => void
}

function DetalheDoCapitulo({ capitulo, trocar, onTirar }: DetalheDoCapituloProps) {
  // A prévia segue a digitação sem segurar a tecla: o capítulo pode ter dezenas de milhares de letras.
  const textoDaPrevia = useDeferredValue(capitulo.texto)
  const tamanho = capitulo.texto.trim().length
  return (
    <>
      <div className="lb-sistema-editor__grade lb-sistema-editor__grade--3">
        <CampoDeTexto rotulo="Título" valor={capitulo.titulo} onChange={(titulo) => trocar({ titulo })} maxLength={CAPITULO_TITULO_MAX} />
        <CampoDeTexto rotulo="Ordem" valor={capitulo.ordem} onChange={(ordem) => trocar({ ordem })} className="lb-sistema-editor__curto" />
        <CampoDeTexto rotulo="Id" valor={capitulo.id} onChange={(id) => trocar({ id })} somenteLeitura={!capitulo.novo} placeholder="automático (do título)" maxLength={64} className="lb-sistema-editor__id" />
      </div>
      <CampoDeTexto
        rotulo="Texto"
        valor={capitulo.texto}
        onChange={(texto) => trocar({ texto })}
        linhas={14}
        dica={`${DICA_DA_MARCACAO} ${milhar(tamanho)} de ${milhar(CAPITULO_TEXTO_MAX)} letras.`}
      />
      <section className="lb-sistema-editor__previa-livro" aria-label="Prévia do capítulo">
        <p className="lb-eyebrow">Prévia</p>
        <h3 className="lb-sistema-editor__previa-titulo">{capitulo.titulo.trim() || '(sem título)'}</h3>
        <MarcacaoLeve texto={textoDaPrevia} className="lb-livro__texto" />
      </section>
      <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact lb-sistema-editor__tirar" onClick={onTirar}>
        Tirar o capítulo
      </button>
    </>
  )
}
