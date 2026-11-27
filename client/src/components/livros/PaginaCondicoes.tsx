import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { catalogoDeCondicoes, type CondicaoDoCatalogo } from '../../lib/condicoes/catalogo'
import { frasesDoCartao, textoDaFrase, type LinhaDoCartao } from '../../lib/condicoes/frasesDaCondicao'
import { FAMILIAS_DA_CONDICAO, chaveDaCondicao, type FamiliaDaPecaDaCondicao, type TipoDaCondicao } from '../../lib/condicoes/modelo'
import { comCondicoesNaFicha, condicoesDe, porCondicao, tirarCondicao, type PedidoDeCondicao } from '../../lib/condicoes/naFicha'
import { nomeDaCondicaoPosta, textoDoUso, usosDaCondicao, type FontesDosUsos } from '../../lib/condicoes/usos'
import type { CondicaoNaFicha } from '../../lib/itens/modelo'
import { variacoesDe } from '../../lib/livros/combate'
import type { Personagem } from '../../lib/personagem'
import { useCatalogoStore } from '../../stores/catalogoStore'
import { tirarCondicaoDeTodasAsCenas } from '../../stores/condicoesNasCenas'
import { useCondicoesPropriasStore } from '../../stores/condicoesPropriasStore'
import { useToastStore } from '../../stores/toastStore'
import type { CondicaoPropria } from '../../types/map'
import { BonecoDaCondicao } from '../condicoes/editor/BonecoDaCondicao'
import { EditorDaCondicao, type AberturaDoEditor } from '../condicoes/editor/EditorDaCondicao'
import { PapelDaCondicao } from '../condicoes/editor/PapelDaCondicao'
import { GlifoDaCondicao } from '../condicoes/editor/pecas/glifos'
import { REGISTRO_DAS_PECAS_DA_CONDICAO } from '../condicoes/editor/registro'
import { ChipDaCondicao, contextoDoCatalogo, FormDePorCondicao, simboloDoCatalogo } from '../condicoes/PorCondicao'
import { PastilhaDeCondicao } from '../PastilhaDeCondicao'
import { avisarComDesfazer, gravarNoMundo } from './comum'
import { IconeDoMundo } from './icones'
import '../condicoes/condicoes.css'
import '../condicoes/editor/editor.css'

type FiltroDoTipo = 'todas' | TipoDaCondicao
const FILTROS_DO_TIPO: readonly { valor: FiltroDoTipo; nome: string }[] = [
  { valor: 'todas', nome: 'Todas' },
  { valor: 'negativa', nome: 'Negativas' },
  { valor: 'positiva', nome: 'Positivas' },
]

function nomeDe(personagem: Personagem): string {
  return personagem.nome.trim() || 'Personagem sem nome'
}

/** As postas de `condId` numa ficha. */
function postasDe(personagem: Personagem, condId: string): readonly CondicaoNaFicha[] {
  return condicoesDe(personagem).filter((condicao) => condicao.condId === condId)
}

/** Guarda as condições de antes das fichas que mudam, para o Desfazer voltar só elas. */
function gravarCondicoes(personagens: readonly Personagem[], ids: readonly string[], mudar: (atual: Personagem) => Personagem, texto: string): boolean {
  const antes = new Map<string, readonly CondicaoNaFicha[]>()
  for (const personagem of personagens) {
    if (!ids.includes(personagem.id)) continue
    if (mudar(personagem) !== personagem) antes.set(personagem.id, condicoesDe(personagem))
  }
  if (antes.size === 0) return false
  void gravarNoMundo((lista) => lista.map((personagem) => (antes.has(personagem.id) ? mudar(personagem) : personagem)), {
    texto,
    desfazer: (lista) => lista.map((personagem) => {
      const voltam = antes.get(personagem.id)
      return voltam === undefined ? personagem : comCondicoesNaFicha(personagem, voltam)
    }),
  })
  return true
}

/** O que digitar no "/" não pode roubar: quem já está escrevendo num campo. */
function escrevendo(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  return alvo.isContentEditable || alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement || alvo instanceof HTMLSelectElement
}

function quantasNaFrase(n: number): string {
  return n === 0 ? '' : n === 1 ? '1 está com ela' : `${n} estão com ela`
}

export interface PaginaCondicoesProps {
  personagens: readonly Personagem[]
}

/**
 * LIVROS › CONDIÇÕES (rework das condições, PLANO.md E6; `telaCatalogo` do protótipo, prototipo.html:1168):
 * as 35 de fábrica e as criadas, com busca (pelo nome ou pelo que faz; "/" leva à busca), filtro por tipo e
 * pela peça, e quantas fichas estão com cada uma. A escolhida mostra o cartão, as ações (de fábrica: só
 * "Usar como modelo"; criada: Editar, Usar como modelo e Apagar só sem uso, com Desfazer), quem está com
 * ela, o "Pôr condição em alguém" e o boneco. Criar, Editar e Usar como modelo abrem o editor único (D13).
 *
 * Grava nas fichas da pasta (`gravarNoMundo`, com Desfazer); a lista das criadas mora na pasta
 * (`stores/condicoesPropriasStore.ts`). Só o mestre abre o livro (decisão 18).
 */
export function PaginaCondicoes({ personagens }: PaginaCondicoesProps) {
  const criadas = useCondicoesPropriasStore((state) => state.catalogo)
  const itensDoLivro = useCatalogoStore((state) => state.itens)
  const catalogo = useMemo(() => catalogoDeCondicoes(criadas), [criadas])
  const contexto = useMemo(() => contextoDoCatalogo(catalogo), [catalogo])
  // As frases do cartão de cada uma, escritas uma vez por mudança no catálogo (a lista e a busca leem daqui).
  const cartoes = useMemo(() => new Map(catalogo.map((condicao) => [condicao.id, frasesDoCartao(condicao.montada, contexto)])), [catalogo, contexto])
  // O que a busca lê: o nome e as frases do cartão, já na chave (sem acento nem caixa).
  const textos = useMemo(() => new Map(catalogo.map((condicao) => [condicao.id, chaveDaCondicao(`${condicao.nome} ${(cartoes.get(condicao.id) ?? []).map((linha) => textoDaFrase(linha.frase)).join(' ')}`)])), [catalogo, cartoes])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroDoTipo>('todas')
  const [peca, setPeca] = useState<FamiliaDaPecaDaCondicao | null>(null)
  const [selId, setSelId] = useState<string>(catalogo[0]?.id ?? '')
  const [edicao, setEdicao] = useState<AberturaDoEditor | null>(null)
  const campoDaBusca = useRef<HTMLInputElement>(null)
  const lista = useRef<HTMLUListElement>(null)
  const prefixo = useId().replace(/:/g, '')

  // "/" leva à busca, de qualquer lugar da página que não seja um campo (e não com o editor aberto).
  useEffect(() => {
    const aoTeclar = (evento: globalThis.KeyboardEvent) => {
      if (evento.key !== '/' || evento.ctrlKey || evento.metaKey || evento.altKey || escrevendo(evento.target) || edicao !== null) return
      evento.preventDefault()
      campoDaBusca.current?.focus()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [edicao])

  const chaveDaBusca = chaveDaCondicao(busca)
  const daBusca = chaveDaBusca === '' ? catalogo : catalogo.filter((condicao) => (textos.get(condicao.id) ?? '').includes(chaveDaBusca))
  const doTipo = filtro === 'todas' ? daBusca : daBusca.filter((condicao) => condicao.montada.tipo === filtro)
  const filtradas = peca === null ? doTipo : doTipo.filter((condicao) => condicao.montada.pecas.some((cada) => cada.tipo === peca))
  const sel = filtradas.find((condicao) => condicao.id === selId) ?? filtradas[0]

  // A ficha modelo do NPC não recebe condição: cada token tem a sua cópia (decisão 1).
  const alvos = personagens.filter((personagem) => variacoesDe(personagem.id, personagens).length === 0).map((personagem) => ({ id: personagem.id, nome: nomeDe(personagem) }))
  const quantasTem = (condId: string) => personagens.filter((personagem) => postasDe(personagem, condId).length > 0).length

  const por = (ids: readonly string[], pedido: PedidoDeCondicao): boolean => {
    const nomeDaCondicao = catalogo.find((condicao) => condicao.id === pedido.condId)?.nome ?? 'A condição'
    const nomes = personagens.filter((personagem) => ids.includes(personagem.id)).map(nomeDe)
    const pos = gravarCondicoes(personagens, ids, (atual) => porCondicao(atual, pedido, criadas), `${nomeDaCondicao} em ${nomes.join(', ')}.`)
    if (!pos) useToastStore.getState().push('error', `Não deu para pôr ${nomeDaCondicao}: a ficha já está com condições demais.`)
    return pos
  }

  const tirar = (personagem: Personagem, condicao: CondicaoNaFicha, nomeDaCondicao: string) => {
    gravarCondicoes(personagens, [personagem.id], (atual) => tirarCondicao(atual, condicao.id), `${nomeDaCondicao} saiu de ${nomeDe(personagem)}.`)
  }

  const apagar = (propria: CondicaoPropria) => {
    useCondicoesPropriasStore.getState().excluir(propria.id)
    tirarCondicaoDeTodasAsCenas(propria.id)
    avisarComDesfazer(`${propria.nome} saiu do catálogo.`, () => {
      if (!useCondicoesPropriasStore.getState().salvar(propria)) useToastStore.getState().push('error', `Não deu para trazer ${propria.nome} de volta: a lista está cheia.`)
    })
  }

  const andarNaLista = (evento: KeyboardEvent<HTMLUListElement>) => {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return
    const agora = filtradas.findIndex((condicao) => condicao.id === sel?.id)
    const proxima = filtradas[Math.min(filtradas.length - 1, Math.max(0, agora + (evento.key === 'ArrowDown' ? 1 : -1)))]
    if (proxima === undefined) return
    evento.preventDefault()
    setSelId(proxima.id)
    lista.current?.querySelector<HTMLElement>(`[data-cond="${CSS.escape(proxima.id)}"]`)?.focus()
  }

  const limpar = () => {
    setBusca('')
    setFiltro('todas')
    setPeca(null)
    campoDaBusca.current?.focus()
  }

  const deFabrica = catalogo.filter((condicao) => !condicao.criada).length
  return (
    <div className="mu-pg cdl">
      <header className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">Condições</h2>
          <p className="mu-pg-sub">
            {deFabrica} de fábrica e as que você criar. Cada uma se monta com as peças do editor e o cartão se escreve sozinho. Moram na ficha, não no token, e aparecem iguais no mapa, na batalha e na tela do jogador.
          </p>
        </div>
        <button type="button" className="mu-bt mu-bt--p" onClick={() => setEdicao({ tipo: 'nova' })}>
          <IconeDoMundo nome="mais" />
          Criar condição
        </button>
      </header>

      <div className="cdl-barra">
        <label className="cdl-busca">
          <span className="cdl-sr">Buscar condição</span>
          <input
            ref={campoDaBusca}
            className="lb-input"
            type="search"
            value={busca}
            placeholder="Buscar pelo nome ou pelo que faz"
            autoComplete="off"
            aria-keyshortcuts="/"
            onChange={(evento) => setBusca(evento.target.value)}
          />
          <kbd className="cdl-kbd" aria-hidden="true">
            /
          </kbd>
        </label>
      </div>
      <div className="cdl-filtros" role="group" aria-label="Filtrar por tipo">
        {FILTROS_DO_TIPO.map((opcao) => (
          <button key={opcao.valor} type="button" className="cdl-filtro" aria-pressed={filtro === opcao.valor} onClick={() => setFiltro(opcao.valor)}>
            {opcao.nome} <b>{opcao.valor === 'todas' ? daBusca.length : daBusca.filter((condicao) => condicao.montada.tipo === opcao.valor).length}</b>
          </button>
        ))}
      </div>
      <div className="cdl-filtros" role="group" aria-label="Filtrar pela peça">
        <span className="cdl-filtros__rot">Com a peça</span>
        {FAMILIAS_DA_CONDICAO.map((familia) => {
          const entrada = REGISTRO_DAS_PECAS_DA_CONDICAO[familia]
          const n = doTipo.filter((condicao) => condicao.montada.pecas.some((cada) => cada.tipo === familia)).length
          return (
            <button key={familia} type="button" className="cdl-filtro cdl-filtro--peca" data-familia={familia} aria-pressed={peca === familia} onClick={() => setPeca(peca === familia ? null : familia)}>
              <GlifoDaCondicao nome={entrada.icone} />
              {entrada.nome} <b>{n}</b>
            </button>
          )
        })}
      </div>

      <div className="cdl-cat">
        <div className="cdl-cat__lista">
          {filtradas.length === 0 ? (
            <div className="cdl-vazio">
              <p>{busca.trim() === '' ? 'Nenhuma condição neste filtro.' : `Nenhuma condição com "${busca.trim()}" neste filtro.`}</p>
              <button type="button" className="mu-bt" onClick={limpar}>
                Limpar a busca e os filtros
              </button>
            </div>
          ) : (
            <>
              <ul ref={lista} className="cdl-lista" aria-label="Catálogo de condições" onKeyDown={andarNaLista}>
                {filtradas.map((condicao) => (
                  <LinhaDaLista key={condicao.id} condicao={condicao} escolhida={condicao.id === sel?.id} comEla={quantasTem(condicao.id)} resumo={cartoes.get(condicao.id)?.[0]} onEscolher={() => setSelId(condicao.id)} />
                ))}
              </ul>
              <p className="cd-nota">Setas para cima e para baixo andam na lista.</p>
            </>
          )}
        </div>
        {sel !== undefined && (
          <aside className="cdl-lado" aria-label={sel.nome}>
            <PapelDaCondicao condicao={sel.montada} pastilha={simboloDoCatalogo(sel)} contexto={contexto} deFabrica={!sel.criada} />
            <AcoesDoLado
              condicao={sel}
              personagens={personagens}
              itensDoLivro={itensDoLivro}
              criadas={criadas}
              onEditar={(propria) => setEdicao({ tipo: 'editar', condicao: propria })}
              onModelo={() => setEdicao({ tipo: 'modelo', base: sel })}
              onApagar={apagar}
            />
            <section className="cd-pg-secao" aria-labelledby={`${prefixo}-quem`}>
              <h3 className="cd-pg-secao__tit" id={`${prefixo}-quem`}>
                Quem está com {sel.nome}
              </h3>
              <QuemEstaComEla condicao={sel} personagens={personagens} criadas={criadas} onTirar={tirar} />
            </section>
            <section className="cd-pg-secao" aria-labelledby={`${prefixo}-por`}>
              <h3 className="cd-pg-secao__tit" id={`${prefixo}-por`}>
                Pôr condição em alguém
              </h3>
              <FormDePorCondicao key={sel.id} alvos={alvos} catalogo={catalogo} condIdInicial={sel.id} onPor={por} />
            </section>
            <BonecoDaCondicao key={sel.id} condicao={sel.montada} pastilha={simboloDoCatalogo(sel)} contexto={contexto} onde={`${prefixo}-cat`} />
          </aside>
        )}
      </div>

      {edicao !== null && (
        <EditorDaCondicao
          abertura={edicao}
          personagens={personagens}
          onFechar={() => setEdicao(null)}
          onSalvou={(condicao) => {
            setSelId(condicao.id)
            setFiltro('todas')
            setPeca(null)
          }}
        />
      )}
    </div>
  )
}

function LinhaDaLista({ condicao, escolhida, comEla, resumo, onEscolher }: { condicao: CondicaoDoCatalogo; escolhida: boolean; comEla: number; resumo: LinhaDoCartao | undefined; onEscolher: () => void }) {
  const familias = [...new Set(condicao.montada.pecas.map((cada) => cada.tipo))]
  const positiva = condicao.montada.tipo === 'positiva'
  return (
    <li>
      <button type="button" className="cdl-linha" data-cond={condicao.id} aria-pressed={escolhida} tabIndex={escolhida ? 0 : -1} onClick={onEscolher}>
        <PastilhaDeCondicao symbol={simboloDoCatalogo(condicao)} tamanho={32} />
        <span className="cdl-linha__nome">
          <strong>{condicao.nome}</strong>
          <span className="cdl-etiquetas">
            <span className="cdl-etiqueta" data-tipo={positiva ? 'positiva' : 'negativa'}>
              {positiva ? 'Positiva' : 'Negativa'}
            </span>
            {condicao.criada ? <span className="cdl-etiqueta">Criada por você</span> : condicao.nova === true ? <span className="cdl-etiqueta cdl-etiqueta--nova">Nova</span> : null}
          </span>
        </span>
        <span className="cdl-linha__resumo">
          <span>{resumo === undefined ? '' : textoDaFrase(resumo.frase)}</span>
          {familias.length > 0 && (
            <span className="cdl-linha__pecas">
              {familias.map((familia) => (
                <span key={familia} className="cdl-chip-peca" data-familia={familia}>
                  <GlifoDaCondicao nome={REGISTRO_DAS_PECAS_DA_CONDICAO[familia].icone} />
                  {REGISTRO_DAS_PECAS_DA_CONDICAO[familia].nome}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="cdl-linha__qtd">{quantasNaFrase(comEla)}</span>
      </button>
    </li>
  )
}

interface AcoesDoLadoProps {
  condicao: CondicaoDoCatalogo
  personagens: readonly Personagem[]
  itensDoLivro: FontesDosUsos['catalogo']
  criadas: readonly CondicaoPropria[]
  onEditar: (propria: CondicaoPropria) => void
  onModelo: () => void
  onApagar: (propria: CondicaoPropria) => void
}

/** De fábrica: só "Usar como modelo" (a regra é fixa). Criada: Editar, Usar como modelo e Apagar só sem uso. */
function AcoesDoLado({ condicao, personagens, itensDoLivro, criadas, onEditar, onModelo, onApagar }: AcoesDoLadoProps) {
  const motivoId = useId()
  const usos = useMemo(() => usosDaCondicao(condicao, { personagens, catalogo: itensDoLivro, criadas }), [condicao, personagens, itensDoLivro, criadas])
  const textos = usos.map((uso) => textoDoUso(uso, nomeDaCondicaoPosta(criadas)))
  const propria = condicao.criada && condicao.pastilha.tipo === 'propria' ? condicao.pastilha.condicao : null
  if (propria === null) {
    return (
      <div className="cdl-acoes">
        <div className="cdl-acoes__botoes">
          <button type="button" className="mu-bt mu-bt--p" onClick={onModelo}>
            Usar como modelo
          </button>
        </div>
        <p className="cd-nota">De fábrica: a regra é fixa. "Usar como modelo" abre uma cópia sua no editor.{textos.length > 0 ? ` Hoje quem põe: ${textos.join('; ')}.` : ''}</p>
      </div>
    )
  }
  const comEla = personagens.filter((personagem) => postasDe(personagem, condicao.id).length > 0).map(nomeDe)
  const emUso = [...textos, ...comEla.map((nome) => `${nome} está com ela`)]
  return (
    <div className="cdl-acoes">
      <div className="cdl-acoes__botoes">
        <button type="button" className="mu-bt mu-bt--p" onClick={() => onEditar(propria)}>
          Editar
        </button>
        <button type="button" className="mu-bt" onClick={onModelo}>
          Usar como modelo
        </button>
        <button type="button" className="mu-bt" disabled={emUso.length > 0} aria-describedby={motivoId} onClick={() => onApagar(propria)}>
          <IconeDoMundo nome="lixo" />
          Apagar
        </button>
      </div>
      <p className="cd-nota" id={motivoId}>
        {emUso.length > 0 ? `Está em uso: ${emUso.join('; ')}. Tire de lá antes de apagar.` : 'Criada por você. Mudou aqui, muda em todo lugar onde ela aparece. Apagar dá para desfazer.'}
      </p>
    </div>
  )
}

function QuemEstaComEla({ condicao, personagens, criadas, onTirar }: { condicao: CondicaoDoCatalogo; personagens: readonly Personagem[]; criadas: readonly CondicaoPropria[]; onTirar: (personagem: Personagem, posta: CondicaoNaFicha, nome: string) => void }) {
  const comEla = personagens.filter((personagem) => postasDe(personagem, condicao.id).length > 0)
  if (comEla.length === 0) return <p className="cd-nota">Ninguém agora.</p>
  return (
    <ul className="cd-pg-quem">
      {comEla.map((personagem) => (
        <li key={personagem.id}>
          <span className="cd-pg-quem__nome">{nomeDe(personagem)}</span>
          {postasDe(personagem, condicao.id).map((posta) => (
            <ChipDaCondicao key={posta.id} condicao={posta} criadas={criadas} onTirar={(tirada, nome) => onTirar(personagem, tirada, nome)} />
          ))}
        </li>
      ))}
    </ul>
  )
}
