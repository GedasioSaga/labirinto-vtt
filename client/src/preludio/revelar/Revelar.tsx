import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pop } from '../../components/grimorio/Pop'
import { classes } from '../../components/grimorio/comum'
import { podeIrAoJogador } from '../../lib/preparo/pacoteDoJogador'
import { alvoDaForma, alvoDaSecao, alvoDoVerbete, paraDe, paraNormal, revelacoesPorAlvo, type ParaQuem } from '../../lib/preparo/revelado'
import type { AlvoDaRevelacao, Campanha, Forma, Revelacao, Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import { useContasDoJogo, type ContaDoJogo } from './contas'
import { VerComoJogador } from './VerComoJogador'
import './revelar.css'

/**
 * REVELAR AOS JOGADORES (plano §1 e §2, F2c), ainda só no PC: no topo do
 * verbete, o estado "oculto / revelado a todos / revelado a fulano" e o "Ver
 * como jogador"; o mesmo controle em cada forma e em cada seção. Tudo nasce
 * oculto, e cada clique vai ao disco na hora (`estado/preludio.ts`).
 *
 * Os jogadores são as contas do app (Contas dos jogadores, na aba Jogo): o id
 * da conta é o mesmo que o Lobby conhece, e é por ele que a revelação a
 * fulano vai valer no site (F5).
 */

const SEM_CAMPANHA = 'Marque uma campanha neste verbete para poder revelar: cada campanha tem os jogadores dela.'
const NAO_ABRIU = 'As revelações desta campanha não abriram: nada dela é revelado até abrir de novo.'
const TRAVADO = 'O Prelúdio está gravando uma importação ou uma cópia restaurada. Dá para revelar quando terminar.'
const FORMATO_NOVO = 'Este verbete é de uma versão mais nova do Labirinto: ele não vai aos jogadores por esta versão.'

// ─── Campanha ────────────────────────────────────────────────────────────────

export interface CampanhaDaRevelacao {
  /** Onde a página revela; `null` = o verbete não está em campanha nenhuma. */
  readonly campanhaId: string | null
  /** As campanhas do índice em que o verbete está. */
  readonly campanhas: readonly Campanha[]
  readonly escolher: (campanhaId: string) => void
}

/** A campanha em que a página revela: a escolhida aqui, senão a do filtro da barra lateral, senão a primeira do verbete. */
export function useCampanhaDaRevelacao(verbete: Verbete | undefined): CampanhaDaRevelacao {
  const filtro = usePreludio((estado) => estado.campanhaId)
  const todas = usePreludio((estado) => estado.campanhas)
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const campanhas = verbete === undefined ? [] : todas.filter((campanha) => verbete.campanhas.includes(campanha.id))
  const existe = (id: string | null) => id !== null && campanhas.some((campanha) => campanha.id === id)
  const campanhaId = existe(escolhida) ? escolhida : existe(filtro) ? filtro : (campanhas[0]?.id ?? null)
  return { campanhaId, campanhas, escolher: setEscolhida }
}

export interface RevelacoesNaTela {
  readonly porAlvo: ReadonlyMap<string, Revelacao>
  /** Por que não dá para mudar agora; `null` = dá. */
  readonly bloqueio: string | null
}

const NENHUMA: ReadonlyMap<string, Revelacao> = new Map()

/** O revelado da campanha, lido pelas mesmas funções do pacote do jogador. */
export function useRevelacoesDaCampanha(campanhaId: string | null): RevelacoesNaTela {
  const daCampanha = usePreludio((estado) => (campanhaId === null ? undefined : estado.revelados.get(campanhaId)))
  const travado = usePreludio((estado) => estado.travado)
  const porAlvo = useMemo(() => (daCampanha === undefined ? NENHUMA : revelacoesPorAlvo(daCampanha.revelado)), [daCampanha])
  const bloqueio = campanhaId === null ? SEM_CAMPANHA : daCampanha === undefined ? NAO_ABRIU : (daCampanha.soLeitura ?? (travado ? TRAVADO : null))
  return { porAlvo, bloqueio }
}

// ─── O controle ──────────────────────────────────────────────────────────────

const LISTA = new Intl.ListFormat('pt-BR', { type: 'conjunction' })

/** "Oculto", "Revelado a todos", "Revelado a Ana e Bia", "Revelado a Ana e mais 2". */
export function estadoEmTexto(para: ParaQuem | null, contas: readonly ContaDoJogo[], feminino: boolean): string {
  if (para === null) return feminino ? 'Oculta' : 'Oculto'
  const revelado = feminino ? 'Revelada' : 'Revelado'
  if (para === 'todos') return `${revelado} a todos`
  const nomes = para.map((id) => contas.find((conta) => conta.id === id)?.nome).filter((nome): nome is string => nome !== undefined)
  if (nomes.length === 0) return `${revelado} a ${para.length === 1 ? '1 jogador' : `${para.length} jogadores`}`
  if (nomes.length === para.length && nomes.length <= 2) return `${revelado} a ${LISTA.format(nomes)}`
  return `${revelado} a ${nomes[0]} e mais ${para.length - 1}`
}

const OLHO = (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5z" />
    <circle cx="10" cy="10" r="2.3" />
  </svg>
)

const OLHO_FECHADO = (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M4.2 7.4C3.1 8.6 2.5 10 2.5 10s2.8 5 7.5 5c1.2 0 2.3-.3 3.2-.8M8.1 5.2A7 7 0 0 1 10 5c4.7 0 7.5 5 7.5 5s-.6 1.2-1.7 2.4" />
    <path d="M3.5 3.5l13 13" />
  </svg>
)

interface ControleDeRevelacaoProps {
  readonly campanhaId: string | null
  readonly revelacoes: RevelacoesNaTela
  readonly alvo: AlvoDaRevelacao
  /** Quem a pergunta nomeia: "Capitão Nuvem", "a forma Noite", "a seção História". */
  readonly nome: string
  /** O que o jogador passa a ver: a frase do pé do pop. */
  readonly explica: string
  /** Texto antes do estado, no próprio botão ("Esta forma"). */
  readonly prefixo?: string
  readonly feminino?: boolean
  readonly pequeno?: boolean
  /** Outros alvos que mudam junto (a página: as formas e as seções comuns dela). */
  readonly junto?: readonly AlvoDaRevelacao[]
  /** O verbete ou a forma de cima ainda está oculto: o estado fica tracejado e o pop avisa. */
  readonly acimaOculto?: string | null
  /** Bloqueio desta parte; vence o da campanha. */
  readonly bloqueio?: string | null
  /** Uma ação a mais no pé do pop, quando alguém vê. */
  readonly extra?: (para: ParaQuem) => ReactNode
}

/**
 * O estado no botão e, no pop: Oculto, Todos os jogadores, ou só as contas
 * marcadas. Cada escolha grava na hora; o pop fica aberto para a próxima.
 * Bloqueado (sem campanha, travado, só leitura), o pop diz o porquê.
 */
export function ControleDeRevelacao({
  campanhaId,
  revelacoes,
  alvo,
  nome,
  explica,
  prefixo,
  feminino = false,
  pequeno = false,
  junto = [],
  acimaOculto = null,
  bloqueio = null,
  extra,
}: ControleDeRevelacaoProps) {
  const revelar = usePreludio((estado) => estado.revelar)
  const contas = useContasDoJogo()
  const [aberto, setAberto] = useState(false)
  const gatilho = useRef<HTMLButtonElement>(null)
  const grupo = useId()
  const para = paraDe(revelacoes.porAlvo, alvo)
  const motivo = bloqueio ?? revelacoes.bloqueio
  const estado = estadoEmTexto(para, contas, feminino)
  const marcadas = para === null || para === 'todos' ? [] : para

  const mudar = (novo: ParaQuem | null) => {
    if (campanhaId === null || motivo !== null) return
    void revelar(
      campanhaId,
      [alvo, ...junto].map((outro) => ({ alvo: outro, para: novo })),
    )
  }
  const alternarConta = (contaId: string, marcada: boolean) => {
    const novas = marcada ? [...marcadas, contaId] : marcadas.filter((outra) => outra !== contaId)
    mudar(novas.length === 0 ? null : novas)
  }

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        className={classes('pr-revelar__estado', pequeno && 'pr-revelar__estado--p')}
        data-estado={para === null ? 'oculto' : 'revelado'}
        data-espera={acimaOculto !== null && para !== null ? '' : undefined}
        data-bloqueado={motivo !== null ? '' : undefined}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`Quem vê ${nome}: ${estado}`}
        onClick={() => setAberto((antes) => !antes)}
      >
        {para === null ? OLHO_FECHADO : OLHO}
        {prefixo !== undefined && <span className="pr-revelar__prefixo">{prefixo}</span>}
        <span>{estado}</span>
      </button>
      <Pop aberto={aberto} gatilho={gatilho} onFechar={() => setAberto(false)} tipo="dialogo" rotulo={`Quem vê ${nome}`} titulo={`Quem vê ${nome}`}>
        <div className="pr-revelar-pop">
          {motivo !== null ? (
            <p className="pr-revelar-pop__explica" role="note">
              {motivo}
            </p>
          ) : (
            <>
              <div className="pr-revelar-pop__opcoes" role="radiogroup" aria-label="Quem vê">
                <label className="pr-revelar-pop__opcao">
                  <input type="radio" name={grupo} checked={para === null} onChange={() => mudar(null)} />
                  <span>
                    {feminino ? 'Oculta' : 'Oculto'}
                    <small>Ninguém vê. É como tudo nasce.</small>
                  </span>
                </label>
                <label className="pr-revelar-pop__opcao">
                  <input type="radio" name={grupo} checked={para === 'todos'} onChange={() => mudar('todos')} />
                  <span>
                    Todos os jogadores
                    <small>Todo jogador desta campanha</small>
                  </span>
                </label>
              </div>
              <p className="pr-revelar-pop__legenda" id={`${grupo}-alguns`}>
                Só para
              </p>
              {contas.length === 0 ? (
                <p className="pr-revelar-pop__explica">Nenhuma conta de jogador ainda. Elas ficam em Contas dos jogadores, na aba Jogo.</p>
              ) : (
                <ul className="pr-revelar-pop__contas" aria-labelledby={`${grupo}-alguns`}>
                  {contas.map((conta) => (
                    <li key={conta.id}>
                      <label className="pr-revelar-pop__opcao">
                        <input type="checkbox" checked={marcadas.includes(conta.id)} onChange={(evento) => alternarConta(conta.id, evento.target.checked)} />
                        <span>{conta.nome}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="pr-revelar-pop__explica">{explica}</p>
              {acimaOculto !== null && <p className="pr-revelar-pop__explica pr-revelar-pop__espera">{acimaOculto}</p>}
              {para !== null && extra?.(para)}
            </>
          )}
        </div>
      </Pop>
    </>
  )
}

// ─── A barra do verbete ──────────────────────────────────────────────────────

interface RevelarVerbeteProps {
  readonly verbete: Verbete
  /** A forma que a página mostra. */
  readonly forma: Forma
  /** Página: sem formas nem cabeça de seção, então revelar a página revela o texto dela inteiro, menos o segredo. */
  readonly documento: boolean
  readonly campanha: CampanhaDaRevelacao
  readonly revelacoes: RevelacoesNaTela
}

/** Quem não pode ir ao jogador por esta versão (formato mais novo): o bloqueio de todos os controles da página. */
export function bloqueioDoVerbete(verbete: Verbete): string | null {
  return podeIrAoJogador(verbete) ? null : FORMATO_NOVO
}

export function RevelarVerbete({ verbete, forma, documento, campanha, revelacoes }: RevelarVerbeteProps) {
  const revelar = usePreludio((estado) => estado.revelar)
  const aviso = usePreludio((estado) => estado.avisoDoRevelado)
  const dispensarAviso = usePreludio((estado) => estado.dispensarAvisoDoRevelado)
  const [vendo, setVendo] = useState(false)
  const { campanhaId } = campanha
  const comuns = forma.secoes.filter((secao) => !secao.segredo)
  const junto = documento
    ? verbete.formas.flatMap((outra) => [alvoDaForma(verbete.id, outra.id), ...outra.secoes.filter((secao) => !secao.segredo).map((secao) => alvoDaSecao(verbete.id, outra.id, secao.id))])
    : []
  const nomeDaForma = forma.nome === '' ? 'esta forma' : `a forma ${forma.nome}`
  // Na página, a forma e a primeira seção sem título não têm botão próprio: o
  // texto começado depois de revelar a página nasce oculto e só aparece aqui.
  const paraDaPagina = paraDe(revelacoes.porAlvo, alvoDoVerbete(verbete.id))
  const semBotao = documento
    ? verbete.formas.flatMap((outra) => [
        alvoDaForma(verbete.id, outra.id),
        ...outra.secoes.filter((secao, indice) => indice === 0 && secao.titulo === '' && !secao.segredo).map((secao) => alvoDaSecao(verbete.id, outra.id, secao.id)),
      ])
    : []
  const atrasados = paraDaPagina === null ? [] : semBotao.filter((alvo) => JSON.stringify(paraNormal(paraDe(revelacoes.porAlvo, alvo))) !== JSON.stringify(paraNormal(paraDaPagina)))

  const revelarJunto = (alvos: readonly AlvoDaRevelacao[], para: ParaQuem) => {
    if (campanhaId === null) return
    void revelar(
      campanhaId,
      alvos.map((alvo) => ({ alvo, para })),
    )
  }
  const revelarAsPartes = (para: ParaQuem) => revelarJunto([alvoDaForma(verbete.id, forma.id), ...comuns.map((secao) => alvoDaSecao(verbete.id, forma.id, secao.id))], para)

  return (
    <div className="pr-revelar" role="group" aria-label="Revelar aos jogadores">
      <ControleDeRevelacao
        campanhaId={campanhaId}
        revelacoes={revelacoes}
        alvo={alvoDoVerbete(verbete.id)}
        nome={verbete.titulo || (documento ? 'esta página' : 'este verbete')}
        explica={
          documento
            ? 'O jogador lê a página inteira, menos os blocos e as seções de segredo.'
            : 'O jogador vê o nome e o tipo. A forma e cada seção se revelam no botão delas, ou pelo atalho abaixo.'
        }
        feminino={documento}
        junto={junto}
        acimaOculto={atrasados.length > 0 ? 'Parte do texto desta página ainda está oculta: foi começada depois de a página ser revelada.' : null}
        bloqueio={bloqueioDoVerbete(verbete)}
        extra={
          documento
            ? atrasados.length === 0
              ? undefined
              : (para) => (
                  <button type="button" className="gr-bt gr-bt--p gr-bt--latao pr-revelar-pop__extra" onClick={() => revelarJunto(atrasados, para)}>
                    Incluir o texto novo
                  </button>
                )
            : (para) => (
                <button type="button" className="gr-bt gr-bt--p gr-bt--latao pr-revelar-pop__extra" onClick={() => revelarAsPartes(para)}>
                  Igual para {nomeDaForma} e {comuns.length === 1 ? 'a seção comum' : 'as seções comuns'}
                </button>
              )
        }
      />
      {campanha.campanhas.length > 1 ? (
        <label className="pr-revelar__campanha">
          <span>na campanha</span>
          <select className="pr-revelar__escolha" value={campanhaId ?? ''} onChange={(evento) => campanha.escolher(evento.target.value)}>
            {campanha.campanhas.map((outra) => (
              <option key={outra.id} value={outra.id}>
                {outra.nome}
              </option>
            ))}
          </select>
        </label>
      ) : (
        campanha.campanhas[0] !== undefined && <span className="pr-revelar__campanha">na campanha {campanha.campanhas[0].nome}</span>
      )}
      <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma pr-revelar__ver" disabled={campanhaId === null} onClick={() => setVendo(true)}>
        Ver como jogador
      </button>
      {campanhaId !== null && <VerComoJogador aberto={vendo} aoFechar={() => setVendo(false)} verbeteId={verbete.id} campanhaId={campanhaId} />}
      {aviso !== null && (
        <p className="pr-aviso pr-revelar__aviso" role="alert">
          <span>{aviso}</span>
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={dispensarAviso}>
            Entendi
          </button>
        </p>
      )}
    </div>
  )
}
