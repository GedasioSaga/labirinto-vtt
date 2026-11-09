import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialogo } from '../../components/grimorio/Dialogo'
import { compararTitulos, ROTULO_DO_TIPO } from '../../lib/preparo/enciclopedia'
import { montarPacoteDoJogador, podeIrAoJogador, type FormaDoPacote, type VerbeteDoPacote } from '../../lib/preparo/pacoteDoJogador'
import type { Verbete } from '../../lib/preparo/tipos'
import { Retrato } from '../enciclopedia/Imagens'
import { usePreludio } from '../estado/preludio'
import { urlDaMidia, useRaizDaMidia } from '../midia'
import { useContasDoJogo } from './contas'
import { TextoDoJogador } from './TextoDoJogador'

/**
 * VER COMO JOGADOR (plano §2, passo 2): o pacote de um jogador de uma
 * campanha, montado pela MESMA função que vai mandá-lo ao Lobby (F5), e
 * desenhado do JSON dele. O que o mestre vê aqui é o que sobe. Dá para andar
 * pelo que o jogador vê: a lista ao lado e as menções do texto.
 */

interface VerComoJogadorProps {
  readonly aberto: boolean
  readonly aoFechar: () => void
  readonly verbeteId: string
  readonly campanhaId: string
}

export function VerComoJogador({ aberto, aoFechar, verbeteId, campanhaId }: VerComoJogadorProps) {
  return (
    <Dialogo
      aberto={aberto}
      titulo="Ver como jogador"
      descricao="Montado pela mesma função que vai mandar o revelado ao Lobby: o que aparece aqui é o que o jogador recebe."
      onFechar={aoFechar}
      classe="pr-jogador-dlg"
    >
      <VistaDoJogador verbeteId={verbeteId} campanhaInicial={campanhaId} />
    </Dialogo>
  )
}

/** Por que o jogador não vê o verbete aberto. */
function porQueNaoVe(original: Verbete | undefined, campanhaId: string, nomeDaCampanha: string, quem: string): string {
  if (original === undefined) return 'Este verbete não existe mais.'
  const nome = original.titulo || 'Este verbete'
  if (original.tipo === 'sessao') return 'Sessão é do mestre: ela nunca vai aos jogadores.'
  if (!podeIrAoJogador(original)) return `${nome} é de uma versão mais nova do Labirinto: esta versão não o manda aos jogadores.`
  if (!original.campanhas.includes(campanhaId)) return `${nome} não está na campanha ${nomeDaCampanha}.`
  return `${quem} não vê ${original.titulo || 'este verbete'}: ele está oculto para este jogador. Revele no topo do verbete.`
}

function VistaDoJogador({ verbeteId, campanhaInicial }: { verbeteId: string; campanhaInicial: string }) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const revelados = usePreludio((estado) => estado.revelados)
  const contas = useContasDoJogo()
  const [campanhaId, setCampanhaId] = useState(campanhaInicial)
  const [contaId, setContaId] = useState<string | null>(null)
  const [vendoId, setVendoId] = useState(verbeteId)

  // As ligações ainda não se revelam (a Teia é da F6): sem elas, o pacote sai igual ao que subiria hoje.
  const pacote = useMemo(
    () => montarPacoteDoJogador({ campanhaId, contaId, verbetes: verbetes.values(), revelado: revelados.get(campanhaId)?.revelado ?? null }),
    [campanhaId, contaId, verbetes, revelados],
  )
  const porId = useMemo(() => new Map(pacote.verbetes.map((verbete): [string, VerbeteDoPacote] => [verbete.id, verbete])), [pacote])
  const lista = useMemo(() => [...pacote.verbetes].sort((a, b) => compararTitulos(a.titulo, b.titulo)), [pacote])

  // Menção, "Citado em" e trilha somem ao trocar de verbete: o foco iria para o
  // <body>, fora do diálogo (Esc e Tab deixariam de valer). Vai para a folha nova.
  const folha = useRef<HTMLDivElement>(null)
  const focarFolha = useRef(false)
  const abrirDeDentro = (id: string) => {
    focarFolha.current = true
    setVendoId(id)
  }
  useEffect(() => {
    if (!focarFolha.current) return
    focarFolha.current = false
    folha.current?.focus()
  }, [vendoId])

  const vendo = porId.get(vendoId)
  const quem = contaId === null ? 'Um jogador qualquer' : (contas.find((conta) => conta.id === contaId)?.nome ?? 'Este jogador')
  const nomeDaCampanha = campanhas.find((campanha) => campanha.id === campanhaId)?.nome ?? 'escolhida'
  const imagens = pacote.midias.length
  const contagem = [lista.length === 1 ? '1 verbete' : `${lista.length} verbetes`, ...(imagens === 0 ? [] : [imagens === 1 ? '1 imagem vai junto' : `${imagens} imagens vão junto`])].join(' · ')

  return (
    <div className="pr-jogador" data-gr-foco="">
      <div className="pr-jogador__barra">
        <label className="pr-campo pr-campo--linha">
          <span className="pr-campo__rotulo">Como</span>
          <select className="pr-campo__entrada" value={contaId ?? ''} onChange={(evento) => setContaId(evento.target.value === '' ? null : evento.target.value)}>
            <option value="">Um jogador qualquer (só o revelado a todos)</option>
            {contas.map((conta) => (
              <option key={conta.id} value={conta.id}>
                {conta.nome}
              </option>
            ))}
          </select>
        </label>
        {campanhas.length > 1 && (
          <label className="pr-campo pr-campo--linha">
            <span className="pr-campo__rotulo">Campanha</span>
            <select className="pr-campo__entrada" value={campanhaId} onChange={(evento) => setCampanhaId(evento.target.value)}>
              {campanhas.map((campanha) => (
                <option key={campanha.id} value={campanha.id}>
                  {campanha.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="pr-jogador__corpo">
        <div ref={folha} className="pr-jogador__folha" tabIndex={-1} aria-live="polite">
          {vendo === undefined ? (
            <div className="pr-vazio">
              <p className="pr-vazio__texto">{porQueNaoVe(verbetes.get(vendoId), campanhaId, nomeDaCampanha, quem)}</p>
            </div>
          ) : (
            <FolhaDoJogador verbete={vendo} porId={porId} aoAbrir={abrirDeDentro} />
          )}
        </div>
        <nav className="pr-jogador__lado" aria-label={`O que ${quem} vê`}>
          {/* Contagem fora do título: na serifa do título, o algarismo 1 parecia uma letra. */}
          <h3 className="pr-trilho__titulo">O jogador vê</h3>
          {lista.length === 0 ? (
            <p className="pr-quieto">
              {quem} não vê nada da campanha {nomeDaCampanha} ainda.
            </p>
          ) : (
            <p className="pr-quieto">{contagem}</p>
          )}
          {lista.length > 0 && (
            <ul className="pr-ligacoes">
              {lista.map((verbete) => (
                <li key={verbete.id}>
                  <button type="button" className="pr-ligacoes__item" aria-current={verbete.id === vendoId ? 'true' : undefined} onClick={() => setVendoId(verbete.id)}>
                    <span>{verbete.titulo || 'Sem nome'}</span>
                    <span className="pr-ligacoes__tipo">{ROTULO_DO_TIPO[verbete.tipo].um}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </div>
    </div>
  )
}

function FolhaDoJogador({ verbete, porId, aoAbrir }: { verbete: VerbeteDoPacote; porId: ReadonlyMap<string, VerbeteDoPacote>; aoAbrir: (id: string) => void }) {
  const pai = verbete.paiId === undefined ? undefined : porId.get(verbete.paiId)
  const citadoEm = verbete.citadoEm.map((id) => porId.get(id)).filter((quem): quem is VerbeteDoPacote => quem !== undefined)
  const [primeira] = verbete.formas
  return (
    <article className="pr-jogador__verbete" aria-label={verbete.titulo || 'Sem nome'}>
      {pai !== undefined && (
        <nav className="pr-trilha" aria-label="Fica dentro de">
          <button type="button" className="pr-trilha__passo" onClick={() => aoAbrir(pai.id)}>
            {pai.titulo || 'Sem nome'}
          </button>
        </nav>
      )}
      <header className="pr-jogador__cabeca">
        {verbete.tipo !== 'pagina' && <Retrato nome={verbete.titulo} midia={primeira?.retrato} tamanho="g" />}
        <div className="pr-jogador__nomes">
          <h3 className="pr-jogador__titulo">{verbete.titulo || 'Sem nome'}</h3>
          <span className="pr-verbete__tipo">{ROTULO_DO_TIPO[verbete.tipo].um}</span>
        </div>
      </header>
      {verbete.formas.length === 0 && <p className="pr-quieto">Só o nome foi revelado: nenhuma forma ainda.</p>}
      {verbete.formas.map((forma, indice) => (
        <FormaDoJogador key={forma.id} forma={forma} titulo={verbete.titulo} comCabeca={verbete.formas.length > 1 || forma.nome !== verbete.titulo} comRetrato={indice > 0} aoAbrir={aoAbrir} />
      ))}
      {citadoEm.length > 0 && (
        <section className="pr-jogador__citado" aria-label="Citado em">
          <h4 className="pr-trilho__titulo">Citado em</h4>
          <ul className="pr-ligacoes">
            {citadoEm.map((quem) => (
              <li key={quem.id}>
                <button type="button" className="pr-ligacoes__item" onClick={() => aoAbrir(quem.id)}>
                  <span>{quem.titulo || 'Sem nome'}</span>
                  <span className="pr-ligacoes__tipo">{ROTULO_DO_TIPO[quem.tipo].um}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

interface FormaDoJogadorProps {
  readonly forma: FormaDoPacote
  readonly titulo: string
  /** Mais de uma forma, ou forma com outro nome: o nome dela aparece. */
  readonly comCabeca: boolean
  /** O retrato da primeira já está no topo. */
  readonly comRetrato: boolean
  readonly aoAbrir: (id: string) => void
}

function FormaDoJogador({ forma, titulo, comCabeca, comRetrato, aoAbrir }: FormaDoJogadorProps) {
  const raiz = useRaizDaMidia()
  const nome = forma.nome || 'Forma sem nome'
  return (
    <section className="pr-jogador__forma" aria-label={comCabeca ? nome : `Texto de ${titulo || 'sem nome'}`}>
      {comCabeca && (
        <div className="pr-jogador__forma-cabeca">
          {comRetrato && <Retrato nome={forma.nome} midia={forma.retrato} tamanho="p" />}
          <h4 className="pr-jogador__forma-nome">{nome}</h4>
        </div>
      )}
      {forma.resumo !== '' && <p className="pr-jogador__resumo">{forma.resumo}</p>}
      {forma.secoes.length === 0 && <p className="pr-quieto">Nenhuma seção revelada nesta forma.</p>}
      {forma.secoes.map((secao) => (
        <section key={secao.id} className="pr-jogador__secao">
          {secao.titulo !== '' && <h5 className="pr-jogador__secao-titulo">{secao.titulo}</h5>}
          <TextoDoJogador texto={secao.texto} aoAbrir={aoAbrir} />
        </section>
      ))}
      {forma.imagens.length > 0 && (
        <ul className="pr-galeria__grade pr-jogador__galeria" aria-label={`Galeria de ${nome}`}>
          {forma.imagens.map((imagem, indice) => {
            const url = raiz === null ? null : urlDaMidia(raiz, imagem.midia)
            return (
              <li key={`${imagem.midia}-${indice}`}>
                <figure className="pr-jogador__imagem">
                  {url === null ? <span className="pr-galeria__falta">Imagem sem arquivo no Prelúdio</span> : <img src={url} alt={imagem.legenda} loading="lazy" decoding="async" />}
                  {imagem.legenda !== '' && <figcaption className="pr-galeria__legenda">{imagem.legenda}</figcaption>}
                </figure>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
