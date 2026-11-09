import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ancestraisDe, compararTitulos, formaDe, formaNova, idNovo, ordemDe, ROTULO_DO_TIPO, textoPlano, verbeteNovo } from '../../lib/preparo/enciclopedia'
import { nomesSemLinkNasCampanhas, type NomeSemLink, type RevelacoesParaOPacote } from '../../lib/preparo/pacoteDoJogador'
import { alvoDaForma, alvoDaSecao, alvoDoVerbete, paraDe } from '../../lib/preparo/revelado'
import type { AlvoDaRevelacao, Forma, Secao, TextoRico, Verbete } from '../../lib/preparo/tipos'
import { citadoEm, usePreludio, type Lugar } from '../estado/preludio'
import { BarraDoTexto, TextoDoPreludio } from '../editor/sobDemanda'
import { bloqueioDoVerbete, ControleDeRevelacao, RevelarVerbete, useCampanhaDaRevelacao, useRevelacoesDaCampanha } from '../revelar/Revelar'
import { FichaDoLivro } from './FichaDoLivro'
import { Galeria, Retrato } from './Imagens'

/**
 * O VERBETE ABERTO (plano §1, Enciclopédia): nome, apelidos e campanhas; as
 * formas (Dia/Noite, Bruce/Hulk) em abas; o resumo; as seções com o editor
 * (seção de segredo marcada); a galeria; e, ao lado, quem cita este verbete,
 * os lugares e páginas que ficam dentro dele e a ficha do Livro.
 *
 * Página e sessão usam a mesma tela, sem a casca de verbete: só o título, o
 * texto e as páginas de dentro (a Escrita).
 *
 * Num verbete grande as seções entram uma por quadro (as duas primeiras na
 * hora): cada editor custa a montar, e montar todos de uma vez travaria o quadro.
 */

const SECOES_NA_HORA = 2

function lugarDe(verbete: Verbete): Lugar {
  if (verbete.tipo === 'sessao') return { secao: 'sessoes', sessaoId: verbete.id }
  return verbete.tipo === 'pagina' ? { secao: 'escrita', paginaId: verbete.id } : { secao: 'enciclopedia', tipo: verbete.tipo, verbeteId: verbete.id }
}

function ehDocumento(verbete: Verbete): boolean {
  return verbete.tipo === 'pagina' || verbete.tipo === 'sessao'
}

/** O tipo do que fica dentro: lugar dentro de lugar; dentro de página ou sessão, páginas (a sessão importada é a casca, e o roteiro mora nas páginas filhas). */
function tipoDosFilhos(verbete: Verbete): Verbete['tipo'] {
  return ehDocumento(verbete) ? 'pagina' : verbete.tipo
}

/** Os filhos diretos do verbete que esta tela mostra e cria (`tipoDosFilhos`). */
function filhosDe(verbete: Verbete, verbetes: ReadonlyMap<string, Verbete>): Verbete[] {
  const tipo = tipoDosFilhos(verbete)
  const filhos: Verbete[] = []
  for (const outro of verbetes.values()) if (outro.paiId === verbete.id && outro.tipo === tipo) filhos.push(outro)
  return filhos.sort((a, b) => (ordemDe(a) ?? Infinity) - (ordemDe(b) ?? Infinity) || compararTitulos(a.titulo, b.titulo))
}

// ─── O nome sem link (F2c) ───────────────────────────────────────────────────

function chaveDaSecao(formaId: string, secaoId: string): string {
  return JSON.stringify([formaId, secaoId])
}

/** Em cada seção deste verbete (`chaveDaSecao`), os mencionados que o jogador lê só pelo nome. */
function soNomePorSecao(nomes: readonly NomeSemLink[]): Map<string, Set<string>> {
  const porSecao = new Map<string, Set<string>>()
  for (const nome of nomes) {
    const chave = chaveDaSecao(nome.formaId, nome.secaoId)
    const mencionados = porSecao.get(chave) ?? new Set<string>()
    mencionados.add(nome.mencionadoId)
    porSecao.set(chave, mencionados)
  }
  return porSecao
}

/** "Reino › Descrição", com a forma no meio quando o verbete tem mais de uma; `null` = a seção não existe mais. */
function lugarDoNome(nome: NomeSemLink, verbetes: ReadonlyMap<string, Verbete>): string | null {
  const dono = verbetes.get(nome.verbeteId)
  const forma = dono === undefined ? undefined : dono.formas.find((uma) => uma.id === nome.formaId)
  const secao = forma === undefined ? undefined : forma.secoes.find((uma) => uma.id === nome.secaoId)
  if (dono === undefined || forma === undefined || secao === undefined) return null
  const partes = [dono.titulo || 'Sem nome', ...(dono.formas.length > 1 ? [forma.nome || 'Forma sem nome'] : []), secao.titulo || 'Texto']
  return partes.join(' › ')
}

const LUGARES_NO_AVISO = 3
const LISTA = new Intl.ListFormat('pt-BR', { type: 'conjunction' })

/** "Reino › Descrição (revelada)", "A, B e C", "A, B, C e mais 2". */
function lugaresEmTexto(lugares: readonly string[]): string {
  const comEstado = lugares.map((lugar) => `${lugar} (revelada)`)
  if (comEstado.length <= LUGARES_NO_AVISO + 1) return LISTA.format(comEstado)
  return LISTA.format([...comEstado.slice(0, LUGARES_NO_AVISO), `mais ${comEstado.length - LUGARES_NO_AVISO}`])
}

const CADEADO = (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <rect x="4.5" y="9" width="11" height="7.5" rx="1.5" />
    <path d="M7 9V6.8a3 3 0 0 1 6 0V9" />
  </svg>
)

// ─── Seção ───────────────────────────────────────────────────────────────────

interface SecaoProps {
  secao: Secao
  dono: string
  /** Página ou sessão: a primeira seção sem nome é o corpo do texto, sem cabeça. */
  documento: boolean
  primeira: boolean
  editavel: boolean
  montada: boolean
  aoMudar: (mudar: (secao: Secao) => Secao) => void
  /** Quem vê esta seção (some enquanto ela é de segredo: segredo nunca sai do PC). */
  revelacao?: ReactNode
  /** Virou segredo: a revelação dela sai, para não voltar sozinha se deixar de ser. */
  aoTornarSegredo?: () => void
  /** Os mencionados que o jogador lê só pelo nome no texto desta seção (F2c). */
  soNome?: ReadonlySet<string>
}

export function SecaoDoVerbete({ secao, dono, documento, primeira, editavel, montada, aoMudar, revelacao, aoTornarSegredo, soNome }: SecaoProps) {
  const temTitulo = secao.titulo !== ''
  const rotulo = temTitulo ? `${secao.titulo} de ${dono}` : `Texto de ${dono}`
  // A cabeça (nome e segredo) não muda a cada tecla: apagar o nome para escrever outro não pode tirar o campo do lugar.
  const [cabecaAoAbrir] = useState(() => temTitulo || secao.segredo)
  const comCabeca = !documento || !primeira || cabecaAoAbrir
  return (
    <section className={`pr-secao ${secao.segredo ? 'pr-secao--segredo' : ''}`} aria-label={rotulo}>
      {comCabeca && (
        <header className="pr-secao__cabeca">
          <input
            className="pr-secao__nome"
            value={secao.titulo}
            aria-label="Título da seção"
            placeholder="Seção sem título"
            readOnly={!editavel}
            onChange={(evento) => aoMudar((atual) => ({ ...atual, titulo: evento.target.value }))}
          />
          <button
            type="button"
            className="pr-segredo-bt"
            aria-pressed={secao.segredo}
            disabled={!editavel}
            title={secao.segredo ? 'Seção de segredo: só você vê. Clique para tornar comum.' : 'Tornar esta seção um segredo (só você vê)'}
            onClick={() => {
              if (!secao.segredo) aoTornarSegredo?.()
              aoMudar((atual) => ({ ...atual, segredo: !atual.segredo }))
            }}
          >
            {CADEADO}
            <span>{secao.segredo ? 'Segredo' : 'Comum'}</span>
          </button>
          {!secao.segredo && revelacao}
        </header>
      )}
      {montada ? (
        <TextoDoPreludio
          texto={secao.texto}
          rotulo={rotulo}
          convite={temTitulo ? `Escreva ${secao.titulo.toLowerCase()}… (@ menciona um verbete)` : 'Escreva aqui… (@ menciona um verbete)'}
          editavel={editavel}
          aoMudar={(texto: TextoRico) => aoMudar((atual) => ({ ...atual, texto }))}
          soNome={soNome}
        />
      ) : (
        <div className="pr-texto pr-texto--esperando">
          <p className="pr-texto__plano">{textoPlano(secao.texto)}</p>
        </div>
      )}
    </section>
  )
}

// ─── Formas ──────────────────────────────────────────────────────────────────

interface FormasProps {
  verbete: Verbete
  forma: Forma
  editavel: boolean
  aoVer: (formaId: string) => void
  aoCriar: () => void
  aoTornarAtual: () => void
  aoRenomear: (nome: string) => void
  /** Quem vê a forma aberta. */
  revelacao?: ReactNode
}

function Formas({ verbete, forma, editavel, aoVer, aoCriar, aoTornarAtual, aoRenomear, revelacao }: FormasProps) {
  const lista = useRef<HTMLDivElement>(null)
  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    const indice = verbete.formas.findIndex((outra) => outra.id === forma.id)
    const passos: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }
    let alvo: number | undefined
    if (evento.key in passos) alvo = (indice + (passos[evento.key] ?? 0) + verbete.formas.length) % verbete.formas.length
    else if (evento.key === 'Home') alvo = 0
    else if (evento.key === 'End') alvo = verbete.formas.length - 1
    const proxima = alvo === undefined ? undefined : verbete.formas[alvo]
    if (proxima === undefined) return
    evento.preventDefault()
    aoVer(proxima.id)
    // As abas já existem todas: o foco muda na hora, junto com a aba.
    lista.current?.querySelector<HTMLElement>(`[data-forma="${CSS.escape(proxima.id)}"]`)?.focus()
  }
  return (
    <div className="pr-formas">
      <div className="pr-formas__linha">
        {verbete.formas.length > 1 && (
          <div ref={lista} role="tablist" aria-label="Formas" className="pr-formas__abas" onKeyDown={aoTeclar}>
            {verbete.formas.map((outra) => (
              <button
                key={outra.id}
                type="button"
                role="tab"
                data-forma={outra.id}
                aria-selected={outra.id === forma.id}
                tabIndex={outra.id === forma.id ? 0 : -1}
                className="pr-formas__aba"
                onClick={() => aoVer(outra.id)}
              >
                {outra.nome || 'Forma sem nome'}
                {outra.id === verbete.formaAtivaId && <span className="pr-formas__atual" title="Forma atual" aria-label="(atual)" />}
              </button>
            ))}
          </div>
        )}
        {editavel && (
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoCriar} title="Outra forma do mesmo verbete, como Dia e Noite">
            + Nova forma
          </button>
        )}
        {revelacao}
      </div>
      {verbete.formas.length > 1 && (
        <div className="pr-formas__detalhe">
          <label className="pr-campo pr-campo--linha">
            <span className="pr-campo__rotulo">Nome da forma</span>
            <input className="pr-campo__entrada" value={forma.nome} readOnly={!editavel} onChange={(evento) => aoRenomear(evento.target.value)} />
          </label>
          {forma.id !== verbete.formaAtivaId && editavel && (
            <button type="button" className="gr-bt gr-bt--p gr-bt--latao" onClick={aoTornarAtual}>
              Usar como forma atual
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── A página ────────────────────────────────────────────────────────────────

interface PaginaDoVerbeteProps {
  id: string
}

export function PaginaDoVerbete({ id }: PaginaDoVerbeteProps) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const avisoDeLeitura = usePreludio((estado) => estado.soLeitura.get(id))
  const travado = usePreludio((estado) => estado.travado)
  const mudarVerbete = usePreludio((estado) => estado.mudarVerbete)
  const criarVerbete = usePreludio((estado) => estado.criarVerbete)
  const revelar = usePreludio((estado) => estado.revelar)
  const ir = usePreludio((estado) => estado.ir)
  const voltar = usePreludio((estado) => estado.voltar)
  const revelados = usePreludio((estado) => estado.revelados)
  const verbete = verbetes.get(id)
  const campanha = useCampanhaDaRevelacao(verbete)
  const revelacoes = useRevelacoesDaCampanha(campanha.campanhaId)
  const [formaVista, setFormaVista] = useState<string | null>(null)
  const [montadas, setMontadas] = useState(SECOES_NA_HORA)
  const [renomeando, setRenomeando] = useState(false)
  const artigo = useRef<HTMLElement>(null)

  const forma = verbete === undefined ? undefined : formaDe(verbete, formaVista)
  const totalDeSecoes = forma?.secoes.length ?? 0

  // Ao abrir outro verbete (ou outra forma), o foco e a rolagem voltam ao começo. Recém-criado ("Item sem nome"): o nome já vem selecionado para digitar por cima.
  useEffect(() => {
    const titulo = artigo.current?.querySelector<HTMLInputElement>('.pr-verbete__titulo')
    const recemCriado = usePreludio.getState().verbetes.get(id)?.titulo.endsWith(' sem nome') === true
    if (recemCriado && titulo != null && !titulo.readOnly && !titulo.disabled) {
      titulo.focus({ preventScroll: true })
      titulo.select()
    } else artigo.current?.focus({ preventScroll: true })
    artigo.current?.closest('.pr-palco')?.scrollTo({ top: 0 })
  }, [id])

  useEffect(() => {
    if (montadas >= totalDeSecoes) return
    const quadro = requestAnimationFrame(() => setMontadas((antes) => antes + 1))
    return () => cancelAnimationFrame(quadro)
  }, [montadas, totalDeSecoes])

  const ancestrais = useMemo(() => (verbete === undefined ? [] : ancestraisDe(verbete, verbetes)), [verbete, verbetes])
  const filhos = useMemo(() => (verbete === undefined ? [] : filhosDe(verbete, verbetes)), [verbete, verbetes])
  const citacoes = useMemo(
    () =>
      verbete === undefined
        ? []
        : citadoEm(verbete.id)
            .map((outro) => verbetes.get(outro))
            .filter((outro): outro is Verbete => outro !== undefined)
            .sort((a, b) => compararTitulos(a.titulo, b.titulo)),
    [verbete, verbetes],
  )

  // Nome sem link (F2c): a menção a quem o jogador não vê, num texto que ele lê, chega a ele só como o nome de agora.
  const revelacoesDoPacote = useMemo(
    // Campanha sem revelado lido (o arquivo não abriu) não revela nada.
    (): RevelacoesParaOPacote[] => campanhas.map((uma) => ({ campanhaId: uma.id, revelado: revelados.get(uma.id)?.revelado ?? null })),
    [campanhas, revelados],
  )
  const soNomeNasSecoes = useMemo(
    () => (verbete === undefined ? new Map<string, Set<string>>() : soNomePorSecao(nomesSemLinkNasCampanhas(revelacoesDoPacote, verbetes.values(), new Set([verbete.id])))),
    [verbete, verbetes, revelacoesDoPacote],
  )
  // Onde o nome DESTE verbete chega ao jogador como texto: renomear troca o que ele lê lá.
  const nomeComoTexto = useMemo(() => {
    if (verbete === undefined) return []
    const nomes = nomesSemLinkNasCampanhas(revelacoesDoPacote, verbetes.values(), new Set(citadoEm(verbete.id))).filter((nome) => nome.mencionadoId === verbete.id)
    return nomes.map((nome) => lugarDoNome(nome, verbetes)).filter((lugar): lugar is string => lugar !== null)
  }, [verbete, verbetes, revelacoesDoPacote])

  if (verbete === undefined || forma === undefined) {
    return (
      <section className="pr-vazio" aria-live="polite">
        <p className="pr-vazio__texto">Este verbete não existe mais.</p>
        <button type="button" className="gr-bt gr-bt--latao" onClick={() => ir({ secao: 'enciclopedia', tipo: 'todos', verbeteId: null })}>
          Voltar à Enciclopédia
        </button>
      </section>
    )
  }

  const editavel = avisoDeLeitura === undefined && !travado
  const avisaNomeComoTexto = editavel && nomeComoTexto.length > 0
  const documento = ehDocumento(verbete)
  const rotuloDoTipo = ROTULO_DO_TIPO[verbete.tipo]
  const mudar = (fazer: (atual: Verbete) => Verbete) => mudarVerbete(verbete.id, fazer)
  const mudarForma = (formaId: string, fazer: (atual: Forma) => Forma) => mudar((atual) => ({ ...atual, formas: atual.formas.map((outra) => (outra.id === formaId ? fazer(outra) : outra)) }))
  const mudarSecao = (secaoId: string, fazer: (atual: Secao) => Secao) =>
    mudarForma(forma.id, (atual) => ({ ...atual, secoes: atual.secoes.map((secao) => (secao.id === secaoId ? fazer(secao) : secao)) }))

  const renomear = (titulo: string) =>
    mudar((atual) => ({
      ...atual,
      titulo,
      // Forma única com o mesmo nome do verbete acompanha o nome (como no Grimório).
      formas: atual.formas.length === 1 && atual.formas[0]?.nome === atual.titulo ? atual.formas.map((unica) => ({ ...unica, nome: titulo })) : atual.formas,
    }))

  const criarFilho = async () => {
    const ultimo = filhos[filhos.length - 1]
    const ordem = documento ? (ultimo === undefined ? 0 : (ordemDe(ultimo) ?? filhos.length) + 1) : undefined
    const novo = verbeteNovo(tipoDosFilhos(verbete), documento ? 'Página sem nome' : `${rotuloDoTipo.novo.replace(/^Nov[oa] /, '')} sem nome`, { campanhas: verbete.campanhas, paiId: verbete.id, ordem })
    await criarVerbete(novo)
    ir(lugarDe(novo))
  }

  const novaSecao = () =>
    mudarForma(forma.id, (atual) => ({ ...atual, secoes: [...atual.secoes, { id: idNovo('sc'), titulo: 'Nova seção', texto: { type: 'doc', content: [{ type: 'paragraph' }] }, segredo: false }] }))

  // Revelar (F2c): a sessão é do mestre e não tem controle; o resto nasce oculto.
  const revelavel = verbete.tipo !== 'sessao'
  const bloqueio = bloqueioDoVerbete(verbete)
  const verbeteOculto = paraDe(revelacoes.porAlvo, alvoDoVerbete(verbete.id)) === null
  const formaOculta = paraDe(revelacoes.porAlvo, alvoDaForma(verbete.id, forma.id)) === null
  const esperaDaSecao = verbeteOculto
    ? `${documento ? 'A página ainda está oculta' : 'O verbete ainda está oculto'}: esta seção só aparece depois que ${documento ? 'ela for revelada' : 'ele for revelado'}.`
    : !documento && formaOculta
      ? `A forma ${forma.nome || 'sem nome'} ainda está oculta: esta seção só aparece depois que ela for revelada.`
      : null
  const ocultarEmTodas = (alvo: AlvoDaRevelacao) => {
    for (const outra of campanha.campanhas) void revelar(outra.id, [{ alvo, para: null }])
  }

  return (
    <div className="pr-folha">
      <article ref={artigo} className="pr-verbete" tabIndex={-1} aria-labelledby="pr-verbete-titulo">
        {voltar !== null && (
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma pr-voltar" onClick={() => ir(voltar.lugar)}>
            ‹ {voltar.rotulo}
          </button>
        )}
        {ancestrais.length > 0 && (
          <nav className="pr-trilha" aria-label={documento ? 'Dentro de' : 'Fica dentro de'}>
            {ancestrais.map((ancestral) => (
              <button key={ancestral.id} type="button" className="pr-trilha__passo" onClick={() => ir(lugarDe(ancestral))}>
                {ancestral.titulo || 'Sem nome'}
              </button>
            ))}
          </nav>
        )}
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

        <header className={`pr-verbete__cabeca ${documento ? 'pr-verbete__cabeca--doc' : ''}`}>
          {!documento && <Retrato nome={verbete.titulo} midia={forma.retrato} tamanho="g" />}
          <div className="pr-verbete__nomes">
            <h2 className="pr-sr" id="pr-verbete-titulo">
              {verbete.titulo || 'Sem nome'}
            </h2>
            <input
              className="pr-verbete__titulo"
              value={verbete.titulo}
              aria-label={documento ? 'Título da página' : `Nome do ${rotuloDoTipo.um.toLowerCase()}`}
              aria-describedby={avisaNomeComoTexto ? 'pr-verbete-nome-texto' : undefined}
              placeholder="Sem nome"
              readOnly={!editavel}
              onChange={(evento) => renomear(evento.target.value)}
              onFocus={() => setRenomeando(true)}
              onBlur={() => setRenomeando(false)}
            />
            {avisaNomeComoTexto && (
              // Fica no DOM, escondido, enquanto o nome não está em edição: o leitor de tela já o lê ao entrar no campo.
              <p id="pr-verbete-nome-texto" className="pr-verbete__nome-texto" hidden={!renomeando}>
                Este nome aparece como texto em: <strong>{lugaresEmTexto(nomeComoTexto)}</strong>. Trocar o nome troca o texto que o jogador lê.
              </p>
            )}
            {!documento && (
              <>
                <div className="pr-verbete__meta">
                  <span className="pr-verbete__tipo">{rotuloDoTipo.um}</span>
                  {campanhas.length > 0 && (
                    <div className="pr-chips" role="group" aria-label="Campanhas deste verbete">
                      {campanhas.map((campanha) => {
                        const dentro = verbete.campanhas.includes(campanha.id)
                        return (
                          <button
                            key={campanha.id}
                            type="button"
                            className="pr-chip"
                            aria-pressed={dentro}
                            disabled={!editavel}
                            onClick={() =>
                              mudar((atual) => ({ ...atual, campanhas: dentro ? atual.campanhas.filter((outra) => outra !== campanha.id) : [...atual.campanhas, campanha.id] }))
                            }
                          >
                            {campanha.nome}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <Apelidos apelidos={verbete.apelidos} editavel={editavel} aoMudar={(apelidos) => mudar((atual) => ({ ...atual, apelidos }))} />
              </>
            )}
          </div>
        </header>

        {revelavel && <RevelarVerbete verbete={verbete} forma={forma} documento={documento} campanha={campanha} revelacoes={revelacoes} />}

        {!documento && (
          <Formas
            verbete={verbete}
            forma={forma}
            editavel={editavel}
            revelacao={
              revelavel ? (
                <ControleDeRevelacao
                  campanhaId={campanha.campanhaId}
                  revelacoes={revelacoes}
                  alvo={alvoDaForma(verbete.id, forma.id)}
                  nome={`a forma ${forma.nome || 'sem nome'}`}
                  prefixo={verbete.formas.length > 1 ? 'Esta forma' : 'Forma'}
                  explica="O jogador vê o nome, o retrato, o resumo e a galeria desta forma. As seções se revelam uma a uma."
                  feminino
                  pequeno
                  acimaOculto={verbeteOculto ? 'O verbete ainda está oculto: esta forma só aparece depois que ele for revelado.' : null}
                  bloqueio={bloqueio}
                />
              ) : undefined
            }
            aoVer={(formaId) => {
              setFormaVista(formaId)
              setMontadas(SECOES_NA_HORA)
            }}
            aoCriar={() => {
              const nova = formaNova(forma, `Forma ${verbete.formas.length + 1}`)
              mudar((atual) => ({ ...atual, formas: [...atual.formas, nova] }))
              setFormaVista(nova.id)
              setMontadas(SECOES_NA_HORA)
            }}
            aoTornarAtual={() => mudar((atual) => ({ ...atual, formaAtivaId: forma.id }))}
            aoRenomear={(nome) => mudarForma(forma.id, (atual) => ({ ...atual, nome }))}
          />
        )}

        {!documento && (
          <label className="pr-resumo">
            <span className="pr-sr">Resumo</span>
            <textarea
              className="pr-resumo__campo"
              value={forma.resumo}
              rows={2}
              placeholder="Resumo em uma ou duas linhas: aparece na lista da Enciclopédia."
              readOnly={!editavel}
              onChange={(evento) => mudarForma(forma.id, (atual) => ({ ...atual, resumo: evento.target.value }))}
            />
          </label>
        )}

        <div className="pr-barra-casca">
          <BarraDoTexto />
        </div>

        <div className="pr-secoes" key={forma.id}>
          {forma.secoes.map((secao, indice) => (
            <SecaoDoVerbete
              key={secao.id}
              secao={secao}
              dono={verbete.titulo || 'sem nome'}
              documento={documento}
              primeira={indice === 0}
              editavel={editavel}
              montada={indice < montadas}
              aoMudar={(fazer) => mudarSecao(secao.id, fazer)}
              revelacao={
                revelavel ? (
                  <ControleDeRevelacao
                    campanhaId={campanha.campanhaId}
                    revelacoes={revelacoes}
                    alvo={alvoDaSecao(verbete.id, forma.id, secao.id)}
                    nome={`a seção ${secao.titulo || 'sem título'}`}
                    explica="O jogador lê o título e o texto desta seção, sem os blocos de segredo."
                    feminino
                    pequeno
                    acimaOculto={esperaDaSecao}
                    bloqueio={bloqueio}
                  />
                ) : undefined
              }
              aoTornarSegredo={revelavel ? () => ocultarEmTodas(alvoDaSecao(verbete.id, forma.id, secao.id)) : undefined}
              soNome={soNomeNasSecoes.get(chaveDaSecao(forma.id, secao.id))}
            />
          ))}
          {forma.secoes.length === 0 && <p className="pr-quieto">Nenhum texto nesta forma ainda.</p>}
          {editavel && (
            <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma pr-secoes__nova" onClick={documento && forma.secoes.length === 0 ? () => mudarForma(forma.id, (atual) => ({ ...atual, secoes: [{ id: idNovo('sc'), titulo: '', texto: { type: 'doc', content: [{ type: 'paragraph' }] }, segredo: false }] })) : novaSecao}>
              {documento && forma.secoes.length === 0 ? 'Começar a escrever' : '+ Nova seção'}
            </button>
          )}
        </div>

        <Galeria imagens={forma.imagens} titulo={`Galeria de ${verbete.titulo || 'sem nome'}${verbete.formas.length > 1 ? ` (${forma.nome})` : ''}`} />
      </article>

      <aside className="pr-trilho" aria-label={`Ao redor de ${verbete.titulo || 'sem nome'}`}>
        {(verbete.tipo === 'lugar' || documento) && (
          <section className="pr-trilho__bloco" aria-labelledby="pr-dentro-titulo">
            <h3 id="pr-dentro-titulo" className="pr-trilho__titulo">
              {documento ? 'Páginas aqui dentro' : 'Lugares aqui dentro'}
            </h3>
            {filhos.length === 0 ? (
              <p className="pr-quieto">{documento ? 'Nenhuma página dentro desta.' : 'Nenhum lugar dentro deste.'}</p>
            ) : (
              <ul className="pr-ligacoes">
                {filhos.map((filho) => (
                  <li key={filho.id}>
                    <button type="button" className="pr-ligacoes__item" onClick={() => ir(lugarDe(filho))}>
                      {filho.titulo || 'Sem nome'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {editavel && (
              <button type="button" className="gr-bt gr-bt--p gr-bt--latao" onClick={() => void criarFilho()}>
                {documento ? '+ Página aqui dentro' : '+ Lugar aqui dentro'}
              </button>
            )}
          </section>
        )}

        <section className="pr-trilho__bloco" aria-labelledby="pr-citado-titulo">
          <h3 id="pr-citado-titulo" className="pr-trilho__titulo">
            Citado em
          </h3>
          {citacoes.length === 0 ? (
            <p className="pr-quieto">Nenhum texto menciona {verbete.titulo || 'este verbete'} ainda. Num texto, digite @ e o nome para mencionar.</p>
          ) : (
            <ul className="pr-ligacoes">
              {citacoes.map((quem) => (
                <li key={quem.id}>
                  <button type="button" className="pr-ligacoes__item" onClick={() => ir(lugarDe(quem))}>
                    <span>{quem.titulo || 'Sem nome'}</span>
                    <span className="pr-ligacoes__tipo">{ROTULO_DO_TIPO[quem.tipo].um}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {verbete.tipo === 'personagem' && <FichaDoLivro verbete={verbete} editavel={editavel} />}

        {verbete.origem?.grimorio !== undefined && (
          <p className="pr-quieto pr-trilho__origem">Veio do Grimório. Depois de editado aqui, a próxima importação deixa este verbete como está.</p>
        )}
      </aside>
    </div>
  )
}

function Apelidos({ apelidos, editavel, aoMudar }: { apelidos: readonly string[]; editavel: boolean; aoMudar: (apelidos: string[]) => void }) {
  const [texto, setTexto] = useState(() => apelidos.join(', '))
  const juntos = apelidos.join(', ')
  // O que veio de fora (outra forma de editar, recarga) troca o campo, mas não no meio da digitação.
  const [ultimo, setUltimo] = useState(juntos)
  if (juntos !== ultimo) {
    setUltimo(juntos)
    setTexto(juntos)
  }
  if (!editavel && apelidos.length === 0) return null
  return (
    <label className="pr-campo pr-campo--linha pr-apelidos">
      <span className="pr-campo__rotulo">Também chamado de</span>
      <input
        className="pr-campo__entrada"
        value={texto}
        readOnly={!editavel}
        placeholder="Apelidos, separados por vírgula"
        onChange={(evento) => setTexto(evento.target.value)}
        onBlur={() => {
          const lista = texto
            .split(',')
            .map((apelido) => apelido.trim())
            .filter((apelido) => apelido !== '')
          if (lista.join(', ') !== juntos) aoMudar(lista)
        }}
      />
    </label>
  )
}
