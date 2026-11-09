import { useEffect, useMemo, useRef } from 'react'
import { compararTitulos, formaDe, idNovo, mencoesNoTexto, ordemDe, verbeteNovo } from '../../lib/preparo/enciclopedia'
import { paginasDaSessao } from '../../lib/preparo/sessoes'
import type { Forma, Secao, Verbete } from '../../lib/preparo/tipos'
import { BarraDoTexto } from '../editor/sobDemanda'
import { SecaoDoVerbete } from '../enciclopedia/PaginaDoVerbete'
import { lugarDoVerbete } from '../enciclopedia/ListaDeVerbetes'
import { usePreludio } from '../estado/preludio'
import { OQueAconteceu } from './OQueAconteceu'
import { RevelarHoje } from './RevelarHoje'
import './sessoes.css'

/**
 * A SESSÃO ABERTA (plano §1, F4): o roteiro escrito (o texto das seções, com
 * @menção e o link "Ligar à mesa" para cena, pino e ficha), o "O que
 * aconteceu" e, ao lado, o "Revelar hoje" e as páginas desta sessão (as notas
 * que vieram do Grimório moram nelas). A sessão nunca vai ao jogador.
 */

/** Os verbetes mencionados no roteiro (seções e páginas da sessão), na ordem do nome. */
function mencionadosNoRoteiro(sessao: Verbete, paginas: readonly Verbete[], verbetes: ReadonlyMap<string, Verbete>): Verbete[] {
  const ids = new Set<string>()
  for (const dono of [sessao, ...paginas]) for (const forma of dono.formas) for (const secao of forma.secoes) mencoesNoTexto(secao.texto, ids)
  return [...ids]
    .map((id) => verbetes.get(id))
    .filter((verbete): verbete is Verbete => verbete !== undefined && verbete.id !== sessao.id)
    .sort((a, b) => compararTitulos(a.titulo, b.titulo))
}

const TEXTO_VAZIO = { type: 'doc' as const, content: [{ type: 'paragraph' }] }

/** A sessão que acabou de ser criada: ao abrir, o nome vem selecionado para digitar por cima (uma vez). */
let recemCriada: string | null = null

export function abrirComONomeSelecionado(sessaoId: string): void {
  recemCriada = sessaoId
}

export function PaginaDaSessao({ id }: { id: string }) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const avisoDeLeitura = usePreludio((estado) => estado.soLeitura.get(id))
  const travado = usePreludio((estado) => estado.travado)
  const mudarVerbete = usePreludio((estado) => estado.mudarVerbete)
  const criarVerbete = usePreludio((estado) => estado.criarVerbete)
  const ir = usePreludio((estado) => estado.ir)
  const artigo = useRef<HTMLElement>(null)
  const sessao = verbetes.get(id)
  const forma = sessao === undefined ? undefined : formaDe(sessao, null)
  const paginas = useMemo(() => (sessao === undefined ? [] : paginasDaSessao(sessao, verbetes)), [sessao, verbetes])
  const mencionados = useMemo(() => (sessao === undefined ? [] : mencionadosNoRoteiro(sessao, paginas, verbetes)), [sessao, paginas, verbetes])

  // Sessão recém-criada: o nome já vem selecionado para digitar por cima; as outras abrem no começo.
  useEffect(() => {
    const titulo = artigo.current?.querySelector<HTMLInputElement>('.pr-verbete__titulo')
    const nova = recemCriada === id
    recemCriada = null
    if (titulo != null && nova && !titulo.readOnly) {
      titulo.focus({ preventScroll: true })
      titulo.select()
    } else artigo.current?.focus({ preventScroll: true })
    artigo.current?.closest('.pr-palco')?.scrollTo({ top: 0 })
  }, [id])

  if (sessao === undefined || sessao.tipo !== 'sessao' || forma === undefined) {
    return (
      <section className="pr-vazio" aria-live="polite">
        <p className="pr-vazio__texto">Esta sessão não existe mais.</p>
        <button type="button" className="gr-bt gr-bt--latao" onClick={() => ir({ secao: 'sessoes', sessaoId: null })}>
          Ver as sessões
        </button>
      </section>
    )
  }

  const editavel = avisoDeLeitura === undefined && !travado
  const mudar = (fazer: (atual: Verbete) => Verbete) => mudarVerbete(sessao.id, fazer)
  const mudarForma = (fazer: (atual: Forma) => Forma) => mudar((atual) => ({ ...atual, formas: atual.formas.map((outra) => (outra.id === forma.id ? fazer(outra) : outra)) }))
  const mudarSecao = (secaoId: string, fazer: (atual: Secao) => Secao) => mudarForma((atual) => ({ ...atual, secoes: atual.secoes.map((secao) => (secao.id === secaoId ? fazer(secao) : secao)) }))
  const novaPagina = async () => {
    const ultima = paginas[paginas.length - 1]
    const nova = verbeteNovo('pagina', 'Página sem nome', { campanhas: sessao.campanhas, paiId: sessao.id, ordem: ultima === undefined ? 0 : (ordemDe(ultima) ?? paginas.length) + 1 })
    await criarVerbete(nova)
    ir(lugarDoVerbete(nova, usePreludio.getState().verbetes))
  }

  return (
    <div className="pr-folha pr-sessao">
      <article ref={artigo} className="pr-verbete" tabIndex={-1} aria-labelledby="pr-sessao-nome">
        {avisoDeLeitura !== undefined && (
          <p className="pr-aviso" role="note">
            {avisoDeLeitura}
          </p>
        )}
        {travado && (
          <p className="pr-aviso" role="status">
            O Prelúdio está gravando uma importação ou uma cópia restaurada. A edição volta quando terminar.
          </p>
        )}
        <header className="pr-verbete__cabeca pr-verbete__cabeca--doc">
          <div className="pr-verbete__nomes">
            <h2 className="pr-sr" id="pr-sessao-nome">
              {sessao.titulo || 'Sessão sem nome'}
            </h2>
            <input
              className="pr-verbete__titulo"
              value={sessao.titulo}
              aria-label="Nome da sessão"
              placeholder="Sessão sem nome"
              readOnly={!editavel}
              onChange={(evento) => {
                const titulo = evento.target.value
                // Forma única com o mesmo nome da sessão acompanha o nome (como no verbete).
                mudar((atual) => ({ ...atual, titulo, formas: atual.formas.length === 1 && atual.formas[0]?.nome === atual.titulo ? atual.formas.map((unica) => ({ ...unica, nome: titulo })) : atual.formas }))
              }}
            />
            <div className="pr-verbete__meta">
              <span className="pr-verbete__tipo">Sessão</span>
              {campanhas.length > 0 && (
                <div className="pr-chips" role="group" aria-label="Campanhas desta sessão">
                  {campanhas.map((campanha) => {
                    const dentro = sessao.campanhas.includes(campanha.id)
                    return (
                      <button
                        key={campanha.id}
                        type="button"
                        className="pr-chip"
                        aria-pressed={dentro}
                        disabled={!editavel}
                        onClick={() => mudar((atual) => ({ ...atual, campanhas: dentro ? atual.campanhas.filter((outra) => outra !== campanha.id) : [...atual.campanhas, campanha.id] }))}
                      >
                        {campanha.nome}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="pr-sessao__roteiro" aria-labelledby="pr-roteiro-titulo">
          <h3 id="pr-roteiro-titulo" className="pr-sessao__subtitulo">
            Roteiro
          </h3>
          <div className="pr-barra-casca">
            <BarraDoTexto />
          </div>
          <div className="pr-secoes" key={forma.id}>
            {forma.secoes.map((secao, indice) => (
              <SecaoDoVerbete
                key={secao.id}
                secao={secao}
                dono={sessao.titulo || 'sessão sem nome'}
                documento
                primeira={indice === 0}
                editavel={editavel}
                montada
                aoMudar={(fazer) => mudarSecao(secao.id, fazer)}
              />
            ))}
            {forma.secoes.length === 0 && <p className="pr-quieto">{paginas.length > 0 ? 'O roteiro que veio do Grimório está nas páginas desta sessão, ao lado.' : 'Nenhum roteiro ainda.'}</p>}
            {editavel && (
              <button
                type="button"
                className="gr-bt gr-bt--p gr-bt--fantasma pr-secoes__nova"
                onClick={() =>
                  mudarForma((atual) => ({
                    ...atual,
                    secoes: [...atual.secoes, { id: idNovo('sc'), titulo: atual.secoes.length === 0 ? '' : 'Nova seção', texto: TEXTO_VAZIO, segredo: false }],
                  }))
                }
              >
                {forma.secoes.length === 0 ? 'Começar o roteiro' : '+ Nova seção'}
              </button>
            )}
          </div>
        </section>

        <OQueAconteceu sessao={sessao} editavel={editavel} />
      </article>

      <aside className="pr-trilho" aria-label={`Ao redor de ${sessao.titulo || 'sessão sem nome'}`}>
        <div className="pr-trilho__bloco">
          <RevelarHoje sessao={sessao} editavel={editavel} mencionados={mencionados} aoAbrir={(verbete) => ir(lugarDoVerbete(verbete, verbetes))} tituloId="pr-hoje-titulo" />
        </div>
        <section className="pr-trilho__bloco" aria-labelledby="pr-paginas-da-sessao">
          <h3 id="pr-paginas-da-sessao" className="pr-trilho__titulo">
            Páginas desta sessão
          </h3>
          {paginas.length === 0 ? (
            <p className="pr-quieto">Nenhuma página. Notas longas, falas e mapas de cabeça cabem em páginas à parte.</p>
          ) : (
            <ul className="pr-ligacoes">
              {paginas.map((pagina) => (
                <li key={pagina.id}>
                  <button type="button" className="pr-ligacoes__item" onClick={() => ir(lugarDoVerbete(pagina, verbetes))}>
                    {pagina.titulo || 'Sem nome'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {editavel && (
            <button type="button" className="gr-bt gr-bt--p gr-bt--latao" onClick={() => void novaPagina()}>
              + Página nesta sessão
            </button>
          )}
        </section>
        <p className="pr-quieto pr-trilho__origem">No mapa, o marcador Roteiro do Livro do mestre mostra esta sessão, só para leitura, com os links e o Revelar.</p>
      </aside>
    </div>
  )
}
