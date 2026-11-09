import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { arvoreDe, compararTitulos, ehDaEscrita, naCampanha, ROTULO_DO_TIPO, semAcento, textoPlano, TIPOS_DA_ENCICLOPEDIA, verbeteNovo, type NoDaArvore } from '../../lib/preparo/enciclopedia'
import type { TipoDeVerbete, Verbete } from '../../lib/preparo/tipos'
import { Arvore, type ItemDaArvore } from '../arvore/Arvore'
import { usePreludio, type Lugar } from '../estado/preludio'
import { Retrato } from './Imagens'

/**
 * A LISTA DA ENCICLOPÉDIA: os verbetes do tipo escolhido na barra lateral,
 * filtrados pela campanha e pelo nome. Lugares aparecem em árvore (lugar
 * dentro de lugar) enquanto não há filtro de nome; com filtro, viram lista com
 * o caminho de cada um.
 */

const LINHA_DO_RESUMO = 160

const resumos = new WeakMap<Verbete, string>()

/** O resumo da forma atual, ou o começo do primeiro texto quando não há resumo. */
function resumoDe(verbete: Verbete): string {
  const guardado = resumos.get(verbete)
  if (guardado !== undefined) return guardado
  const forma = verbete.formas.find((uma) => uma.id === verbete.formaAtivaId) ?? verbete.formas[0]
  let texto = forma?.resumo.trim() ?? ''
  if (texto === '' && forma !== undefined) {
    for (const secao of forma.secoes) {
      if (secao.segredo) continue
      texto = textoPlano(secao.texto).replace(/\s+/g, ' ')
      if (texto !== '') break
    }
  }
  const curto = texto.length > LINHA_DO_RESUMO ? `${texto.slice(0, LINHA_DO_RESUMO).trimEnd()}…` : texto
  resumos.set(verbete, curto)
  return curto
}

function itensDaArvore(nos: readonly NoDaArvore[]): ItemDaArvore[] {
  return nos.map((no) => ({ id: no.verbete.id, rotulo: no.verbete.titulo || 'Sem nome', filhos: itensDaArvore(no.filhos) }))
}

export function lugarDoVerbete(verbete: Verbete, verbetes: ReadonlyMap<string, Verbete>): Lugar {
  if (verbete.tipo === 'pagina' && ehDaEscrita(verbete, verbetes)) return { secao: 'escrita', paginaId: verbete.id }
  return { secao: 'enciclopedia', tipo: verbete.tipo, verbeteId: verbete.id }
}

interface ListaDeVerbetesProps {
  tipo: TipoDeVerbete | 'todos'
}

export function ListaDeVerbetes({ tipo }: ListaDeVerbetesProps) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  const travado = usePreludio((estado) => estado.travado)
  const ir = usePreludio((estado) => estado.ir)
  const criarVerbete = usePreludio((estado) => estado.criarVerbete)
  const escolherCampanha = usePreludio((estado) => estado.escolherCampanha)
  const [filtro, setFiltro] = useState('')
  const [foco, setFoco] = useState(0)
  const lista = useRef<HTMLUListElement>(null)

  const campanha = campanhas.find((uma) => uma.id === campanhaId)
  const tipos = tipo === 'todos' ? TIPOS_DA_ENCICLOPEDIA : [tipo]
  const titulo = tipo === 'todos' ? 'Enciclopédia' : ROTULO_DO_TIPO[tipo].varios

  const doTipo = useMemo(
    () =>
      [...verbetes.values()].filter(
        (verbete) => tipos.includes(verbete.tipo) && naCampanha(verbete, campanhaId) && (verbete.tipo !== 'pagina' || ehDaEscrita(verbete, verbetes)),
      ),
    // `tipos` sai de `tipo`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verbetes, campanhaId, tipo],
  )
  const limpo = semAcento(filtro.trim())
  const visiveis = useMemo(() => {
    const achados = limpo === '' ? doTipo : doTipo.filter((verbete) => semAcento(verbete.titulo).includes(limpo) || verbete.apelidos.some((apelido) => semAcento(apelido).includes(limpo)))
    return [...achados].sort((a, b) => compararTitulos(a.titulo, b.titulo))
  }, [doTipo, limpo])
  const emArvore = tipo === 'lugar' && limpo === ''
  const arvore = useMemo(() => (emArvore ? itensDaArvore(arvoreDe(doTipo)) : []), [emArvore, doTipo])

  const criar = async (novoTipo: TipoDeVerbete) => {
    const novo = verbeteNovo(novoTipo, `${ROTULO_DO_TIPO[novoTipo].um} sem nome`, { campanhas: campanhaId === null ? [] : [campanhaId] })
    await criarVerbete(novo)
    ir(lugarDoVerbete(novo, usePreludio.getState().verbetes))
  }

  const abrir = (id: string) => {
    const verbete = verbetes.get(id)
    if (verbete !== undefined) ir(lugarDoVerbete(verbete, verbetes))
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLUListElement>) => {
    const passos: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, Home: -Infinity, End: Infinity }
    const passo = passos[evento.key]
    if (passo === undefined || visiveis.length === 0) return
    evento.preventDefault()
    const proximo = Math.min(visiveis.length - 1, Math.max(0, Number.isFinite(passo) ? foco + passo : passo > 0 ? visiveis.length - 1 : 0))
    setFoco(proximo)
    lista.current?.querySelectorAll<HTMLElement>('.pr-linha')[proximo]?.focus()
  }

  const tiposParaCriar: readonly TipoDeVerbete[] = tipo === 'todos' ? ['personagem', 'lugar', 'item', 'faccao'] : tipo === 'pagina' ? [] : [tipo]
  const caminhoDe = (verbete: Verbete) => {
    const nomes: string[] = []
    let pai = verbete.paiId === undefined ? undefined : verbetes.get(verbete.paiId)
    while (pai !== undefined && nomes.length < 4 && !nomes.includes(pai.titulo)) {
      nomes.unshift(pai.titulo)
      pai = pai.paiId === undefined ? undefined : verbetes.get(pai.paiId)
    }
    return nomes.join(' › ')
  }

  return (
    <section className="pr-lista" aria-labelledby="pr-lista-titulo">
      <header className="pr-lista__cabeca">
        <div>
          <h2 id="pr-lista-titulo" className="pr-lista__titulo">
            {titulo}
          </h2>
          <p className="pr-lista__conta">
            {doTipo.length === 1 ? '1 verbete' : `${doTipo.length} verbetes`}
            {campanha === undefined ? ' em todas as campanhas' : ` em ${campanha.nome}`}
          </p>
        </div>
        <div className="pr-lista__acoes">
          {tiposParaCriar.map((novoTipo) => (
            <button key={novoTipo} type="button" className="gr-bt gr-bt--p gr-bt--latao" disabled={travado} onClick={() => void criar(novoTipo)}>
              {tipo === 'todos' ? `+ ${ROTULO_DO_TIPO[novoTipo].um}` : `+ ${ROTULO_DO_TIPO[novoTipo].novo}`}
            </button>
          ))}
        </div>
      </header>

      {doTipo.length > 0 && (
        <label className="pr-filtro">
          <span className="pr-sr">Filtrar pelo nome</span>
          <input type="search" className="pr-filtro__campo" placeholder="Filtrar pelo nome ou apelido" value={filtro} onChange={(evento) => setFiltro(evento.target.value)} />
        </label>
      )}

      {doTipo.length === 0 ? (
        <div className="pr-vazio">
          <p className="pr-vazio__texto">
            {verbetes.size === 0
              ? 'A Enciclopédia está vazia. Importe as campanhas do Grimório na tela Início ou crie o primeiro verbete aqui.'
              : campanha !== undefined
                ? `Nenhum verbete deste tipo em ${campanha.nome}.`
                : tipo === 'pagina'
                  ? 'Nenhuma página na Escrita ainda. Crie um caderno na barra lateral.'
                  : 'Nenhum verbete deste tipo ainda.'}
          </p>
          {campanha !== undefined && verbetes.size > 0 && (
            <button type="button" className="gr-bt gr-bt--p" onClick={() => escolherCampanha(null)}>
              Ver todas as campanhas
            </button>
          )}
        </div>
      ) : visiveis.length === 0 ? (
        <div className="pr-vazio">
          <p className="pr-vazio__texto">Nada com "{filtro.trim()}" no nome ou nos apelidos. Para procurar dentro dos textos, use a busca (Ctrl+K).</p>
          <button type="button" className="gr-bt gr-bt--p" onClick={() => setFiltro('')}>
            Limpar o filtro
          </button>
        </div>
      ) : emArvore ? (
        <Arvore itens={arvore} rotulo="Lugares" selecionado={null} aoAbrir={abrir} classe="pr-arvore--lista" />
      ) : (
        <ul ref={lista} className="pr-linhas" aria-label={titulo} onKeyDown={aoTeclar}>
          {visiveis.map((verbete, indice) => {
            const resumo = resumoDe(verbete)
            const caminho = verbete.tipo === 'lugar' || verbete.tipo === 'pagina' ? caminhoDe(verbete) : ''
            return (
              <li key={verbete.id}>
                <button type="button" className="pr-linha" tabIndex={indice === Math.min(foco, visiveis.length - 1) ? 0 : -1} onFocus={() => setFoco(indice)} onClick={() => abrir(verbete.id)}>
                  <Retrato nome={verbete.titulo} midia={(verbete.formas.find((forma) => forma.id === verbete.formaAtivaId) ?? verbete.formas[0])?.retrato} tamanho="p" />
                  <span className="pr-linha__texto">
                    <span className="pr-linha__titulo">{verbete.titulo || 'Sem nome'}</span>
                    {caminho !== '' && <span className="pr-linha__caminho">{caminho}</span>}
                    {resumo !== '' && <span className="pr-linha__resumo">{resumo}</span>}
                  </span>
                  {tipo === 'todos' && <span className="pr-linha__tipo">{ROTULO_DO_TIPO[verbete.tipo].um}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
