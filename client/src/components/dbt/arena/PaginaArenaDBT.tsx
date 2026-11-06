import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { EQUIPE_DO_LADO, GRADES_DA_ARENA, type LadoDaArena, type TamanhoDaGrade } from '../../../lib/arena/grade'
import { FICHAS_POR_LADO_MAX, VEZES_MAX } from '../../../lib/arena/tipos'
import type { ModoDaBatalha } from '../../../lib/dbt/batalha/tipos'
import { INDICE_DOS_NPCS_PRONTOS, type ResumoDeNpcProntoDBT } from '../../../lib/dbt/dados/npcsProntos'
import { NOME_DA_CATEGORIA } from '../../../lib/dbt/regras/ficha'
import { entraNaBatalha } from '../../../lib/livros/combate'
import type { Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { BONECOS_MAX, fichasNoLadoDBT, montagemProntaDBT, temFichaNaMontagemDBT, temNoLadoDBT, useArenaDBTStore, type MontagemDaArenaDBT } from '../../../stores/arenaDBTStore'
import { useMundoDoLivroStore } from '../../../stores/mundoDoLivroStore'
import { Retrato } from '../../livros/comum'
import { IconeDoMundo } from '../../livros/icones'
import { Segmentos } from '../ficha/pecas'
import { ND_SUGERIDO } from '../mundo/contasDoMundo'
import { BonecoDaArenaDBT } from './BonecoDaArenaDBT'
import { fichasProntasDoLivro, idDoProntoNaArena, useProntosDaArenaDBT } from './npcsProntosDaArena'
import { TelaDaArenaDBT } from './TelaDaArenaDBT'
import '../ficha/fichaDBT.css'
import './arenaDBT.css'

/**
 * A ARENA DE TESTES DO DRAGON BALL no mundo do livro (marcador "Arena de
 * testes"): a MONTAGEM. O mestre põe fichas da pasta em cada lado (jogadores
 * do grupo e NPCs de combate; o NPC pode repetir), NPCs prontos do livro
 * (fichas montadas só na memória, `npcsProntosDaArena.ts`), bonecos de treino com CA,
 * PV e EP à mão, escolhe a grade e o modo (Automático ou Manual) e "Começar
 * o teste". A luta abre em tela cheia por cima do mundo (`TelaDaArenaDBT`).
 *
 * As escolhas moram na sessão da `useArenaDBTStore` (memória do app): trocar
 * de marcador não as perde. Nada aqui grava na pasta: a luta usa CÓPIAS.
 */

export interface PaginaArenaDBTProps {
  /** As fichas da pasta (`usePersonagensDoMundo`). */
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
  sistemaId: string
}

const NOME_DO_LADO: Record<LadoDaArena, string> = { a: 'A', b: 'B' }
const LADOS: readonly LadoDaArena[] = ['a', 'b']

const GRADES: readonly { valor: TamanhoDaGrade; texto: string }[] = (['pequena', 'media'] as const).map((grade) => ({
  valor: grade,
  texto: `${grade === 'pequena' ? 'Pequena' : 'Média'} ${GRADES_DA_ARENA[grade].colunas} × ${GRADES_DA_ARENA[grade].linhas}`,
}))

const MODOS: readonly { valor: ModoDaBatalha; texto: string }[] = [
  { valor: 'automatico', texto: 'Automático' },
  { valor: 'manual', texto: 'Manual' },
]

/** A cor do lado (a da equipe virtual) para o CSS: `--dba-cor`. */
function corDoLado(lado: LadoDaArena): CSSProperties {
  const estilo: CSSProperties & { '--dba-cor': string } = { '--dba-cor': EQUIPE_DO_LADO[lado].cor }
  return estilo
}

/** O que falta para começar, numa frase; `null` = pronto. */
function oQueFalta(montagem: MontagemDaArenaDBT, fichas: readonly Personagem[]): string | null {
  const a = temNoLadoDBT(montagem, 'a', fichas)
  const b = temNoLadoDBT(montagem, 'b', fichas)
  if (!a && !b) return 'Ponha alguém em cada lado: uma ficha ou um boneco de treino.'
  if (!a) return 'Falta alguém no Lado A.'
  if (!b) return 'Falta alguém no Lado B.'
  if (!temFichaNaMontagemDBT(montagem, fichas)) return 'Ponha ao menos uma ficha: só bonecos de treino não lutam.'
  return null
}

/** "Jogador · EP 3", "NPC de combate · sem ficha Dragon Ball". */
function subDaFicha(personagem: Personagem): string {
  const tipo = personagem.tipo === 'jogador' ? 'Jogador' : 'NPC de combate'
  return personagem.dbt === undefined ? `${tipo} · sem ficha Dragon Ball (entra à mão)` : tipo
}

interface LinhaDaFichaProps {
  personagem: Personagem
  montagem: MontagemDaArenaDBT
}

/** Uma ficha da pasta com o "+ A" / "+ B". O jogador entra uma vez por lado; o NPC repete. */
function LinhaDaFicha({ personagem, montagem }: LinhaDaFichaProps) {
  const repete = personagem.tipo === 'npc'
  return (
    <li className="dba-ficha">
      <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
      <span className="dba-ficha__txt">
        <span className="dba-ficha__nome">{personagem.nome}</span>
        <span className="dba-ficha__sub">{subDaFicha(personagem)}</span>
      </span>
      <span className="dba-ficha__botoes">
        {LADOS.map((lado) => {
          const atual = montagem.escolhas.find((escolha) => escolha.personagemId === personagem.id && escolha.lado === lado)
          const cheio = fichasNoLadoDBT(montagem, lado) >= FICHAS_POR_LADO_MAX
          const jaEsta = atual !== undefined && (!repete || atual.vezes >= VEZES_MAX)
          const rotulo = jaEsta
            ? `${personagem.nome} já está no Lado ${NOME_DO_LADO[lado]}`
            : cheio
              ? `O Lado ${NOME_DO_LADO[lado]} já tem ${FICHAS_POR_LADO_MAX} fichas`
              : atual !== undefined
                ? `Mais um ${personagem.nome} no Lado ${NOME_DO_LADO[lado]} (fica com ${atual.vezes + 1})`
                : `Pôr ${personagem.nome} no Lado ${NOME_DO_LADO[lado]}`
          return (
            <button
              key={lado}
              type="button"
              className="dbf-btn dbf-btn--xs dba-mais"
              style={corDoLado(lado)}
              data-esta={atual !== undefined ? 'sim' : undefined}
              disabled={jaEsta || cheio}
              aria-label={rotulo}
              title={rotulo}
              onClick={() => useArenaDBTStore.getState().escolher(personagem.id, lado, (atual?.vezes ?? 0) + 1)}
            >
              {jaEsta ? `No ${NOME_DO_LADO[lado]}` : `+ ${NOME_DO_LADO[lado]}`}
            </button>
          )
        })}
      </span>
    </li>
  )
}

const SEM_IDS: readonly string[] = []

/** Sem acento e sem caixa: "goku" acha "Son Gokū". */
function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/** "Saga Saiyajin · Chefão · Rank D · EP 2". */
function subDoPronto(resumo: ResumoDeNpcProntoDBT): string {
  return [resumo.saga, NOME_DA_CATEGORIA[resumo.categoria], `Rank ${resumo.rank}`, `EP ${resumo.ep}`].filter((parte) => parte !== null).join(' · ')
}

interface NpcsProntosNaMontagemProps {
  montagem: MontagemDaArenaDBT
  sistema: SistemaDeRpg
  sistemaId: string
}

/**
 * Os NPCs prontos do livro, direto como cópia na arena: "+ A" monta a ficha
 * (só na memória, nunca na pasta) e põe no lado; o NPC repete como os da
 * pasta. Fechado por padrão: a lista é longa e a pasta vem primeiro.
 */
function NpcsProntosNaMontagem({ montagem, sistema, sistemaId }: NpcsProntosNaMontagemProps) {
  const [busca, setBusca] = useState('')
  const buscaId = useId()
  const carregando = useProntosDaArenaDBT((state) => (state.sistemaId === sistemaId ? state.carregando : SEM_IDS))
  const erro = useProntosDaArenaDBT((state) => (state.sistemaId === sistemaId ? state.erro : null))
  const termo = normalizarBusca(busca)
  const lista = termo === '' ? INDICE_DOS_NPCS_PRONTOS : INDICE_DOS_NPCS_PRONTOS.filter((resumo) => normalizarBusca(resumo.nome).includes(termo))

  const por = async (resumo: ResumoDeNpcProntoDBT, lado: LadoDaArena, vezes: number) => {
    if (await useProntosDaArenaDBT.getState().preparar(sistemaId, sistema, resumo.id)) useArenaDBTStore.getState().escolher(idDoProntoNaArena(resumo.id), lado, vezes)
  }

  return (
    <details className="dba-fichas__grupo dba-prontos">
      <summary className="dba-fichas__grupo-tit">
        NPCs prontos do livro <small>{INDICE_DOS_NPCS_PRONTOS.length}</small>
      </summary>
      <label className="dba-prontos__busca" htmlFor={buscaId}>
        <span className="dba-ficha__sub">Entram como cópia, com ND {ND_SUGERIDO}; a pasta não muda.</span>
        <input id={buscaId} className="dbf-inp" type="search" placeholder="Procurar pelo nome" value={busca} onChange={(evento) => setBusca(evento.target.value)} />
      </label>
      {erro !== null && (
        <p className="mu-campo__erro" role="alert">
          {erro}
        </p>
      )}
      {lista.length === 0 ? (
        <p className="dba-lado__vazio">Nenhum NPC pronto com esse nome.</p>
      ) : (
        <ul className="dba-fichas__lista dba-prontos__lista">
          {lista.map((resumo) => {
            const id = idDoProntoNaArena(resumo.id)
            const montando = carregando.includes(resumo.id)
            return (
              <li key={resumo.id} className="dba-ficha">
                <Retrato imagem={null} nome={resumo.nome} tamanho="p" />
                <span className="dba-ficha__txt">
                  <span className="dba-ficha__nome">{resumo.nome}</span>
                  <span className="dba-ficha__sub">{montando ? 'Montando a ficha…' : subDoPronto(resumo)}</span>
                </span>
                <span className="dba-ficha__botoes">
                  {LADOS.map((lado) => {
                    const atual = montagem.escolhas.find((escolha) => escolha.personagemId === id && escolha.lado === lado)
                    const cheio = fichasNoLadoDBT(montagem, lado) >= FICHAS_POR_LADO_MAX
                    const jaEsta = atual !== undefined && atual.vezes >= VEZES_MAX
                    const rotulo = jaEsta
                      ? `${resumo.nome} já está no Lado ${NOME_DO_LADO[lado]}`
                      : cheio
                        ? `O Lado ${NOME_DO_LADO[lado]} já tem ${FICHAS_POR_LADO_MAX} fichas`
                        : atual !== undefined
                          ? `Mais um ${resumo.nome} no Lado ${NOME_DO_LADO[lado]} (fica com ${atual.vezes + 1})`
                          : `Pôr ${resumo.nome}, NPC pronto do livro, no Lado ${NOME_DO_LADO[lado]}`
                    return (
                      <button
                        key={lado}
                        type="button"
                        className="dbf-btn dbf-btn--xs dba-mais"
                        style={corDoLado(lado)}
                        data-esta={atual !== undefined ? 'sim' : undefined}
                        disabled={jaEsta || cheio || montando}
                        aria-label={rotulo}
                        title={rotulo}
                        onClick={() => void por(resumo, lado, (atual?.vezes ?? 0) + 1)}
                      >
                        {jaEsta ? `No ${NOME_DO_LADO[lado]}` : `+ ${NOME_DO_LADO[lado]}`}
                      </button>
                    )
                  })}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </details>
  )
}

interface LadoNaMontagemProps {
  lado: LadoDaArena
  montagem: MontagemDaArenaDBT
  porId: ReadonlyMap<string, Personagem>
}

/** Uma coluna da montagem: as fichas do lado (− ×2 + no NPC), os bonecos e o "+ Boneco". */
function LadoNaMontagem({ lado, montagem, porId }: LadoNaMontagemProps) {
  const tituloId = useId()
  const escolhas = montagem.escolhas.filter((escolha) => escolha.lado === lado)
  const bonecos = montagem.bonecos.filter((boneco) => boneco.lado === lado)
  const n = fichasNoLadoDBT(montagem, lado)
  const cheio = n >= FICHAS_POR_LADO_MAX
  const semBoneco = montagem.bonecos.length >= BONECOS_MAX
  const { escolher, tirar, porBoneco, tirarBoneco, ajustarBoneco } = useArenaDBTStore.getState()
  return (
    <section className="dbf dba-lado" style={corDoLado(lado)} aria-labelledby={tituloId}>
      <header className="dba-lado__cab">
        <span className="dba-lado__marca" aria-hidden="true" />
        <h3 className="dba-lado__tit" id={tituloId}>
          {EQUIPE_DO_LADO[lado].nome}
        </h3>
        <span className={cheio ? 'dba-lado__n dba-lado__n--cheio' : 'dba-lado__n'}>
          {n}/{FICHAS_POR_LADO_MAX} fichas{cheio ? ' · cheio' : ''}
        </span>
      </header>
      {escolhas.length === 0 && bonecos.length === 0 ? (
        <p className="dba-lado__vazio">Ninguém ainda. Toque em “+ {NOME_DO_LADO[lado]}” numa ficha, ou ponha um boneco de treino.</p>
      ) : (
        <ul className="dba-lado__lista">
          {escolhas.map((escolha) => {
            const personagem = porId.get(escolha.personagemId)
            const nome = personagem?.nome ?? 'Ficha que saiu da pasta'
            return (
              <li key={escolha.personagemId} className={personagem === undefined ? 'dba-escolha dba-escolha--sumiu' : 'dba-escolha'}>
                <Retrato imagem={personagem?.retrato ?? null} nome={nome} tamanho="p" />
                <span className="dba-escolha__nome">{nome}</span>
                {personagem?.tipo === 'npc' ? (
                  <span className="dba-vezes" role="group" aria-label={`Quantos ${nome} no Lado ${NOME_DO_LADO[lado]}`}>
                    <button type="button" className="dbf-sbtn" aria-label={`Um ${nome} a menos`} disabled={escolha.vezes <= 1} onClick={() => escolher(escolha.personagemId, lado, escolha.vezes - 1)}>
                      −
                    </button>
                    <span className="dba-vezes__n" aria-live="polite">
                      ×{escolha.vezes}
                    </span>
                    <button
                      type="button"
                      className="dbf-sbtn"
                      aria-label={`Mais um ${nome}`}
                      disabled={cheio || escolha.vezes >= VEZES_MAX}
                      onClick={() => escolher(escolha.personagemId, lado, escolha.vezes + 1)}
                    >
                      +
                    </button>
                  </span>
                ) : (
                  <span />
                )}
                <button type="button" className="dbf-btn dbf-btn--xs dbf-btn--ghost" aria-label={`Tirar ${nome} do Lado ${NOME_DO_LADO[lado]}`} title="Tirar do lado" onClick={() => tirar(escolha.personagemId, lado)}>
                  <IconeDoMundo nome="x" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {bonecos.length > 0 && (
        <ul className="dba-bonecos" aria-label={`Bonecos de treino no Lado ${NOME_DO_LADO[lado]}`}>
          {bonecos.map((boneco) => (
            <BonecoDaArenaDBT key={boneco.id} boneco={boneco} momento="montagem" onAjustar={(ajuste) => ajustarBoneco(boneco.id, ajuste)} onTirar={() => tirarBoneco(boneco.id)} />
          ))}
        </ul>
      )}
      <button
        type="button"
        className="dbf-btn dbf-btn--sm dba-lado__boneco"
        disabled={semBoneco}
        title={semBoneco ? `Já são ${BONECOS_MAX} bonecos na arena` : 'Um alvo que só apanha: CA, PV e EP à mão'}
        onClick={() => porBoneco(lado)}
      >
        <IconeDoMundo nome="boneco" />
        <span>+ Boneco de treino</span>
      </button>
    </section>
  )
}

export function PaginaArenaDBT({ personagens, sistema, sistemaId }: PaginaArenaDBTProps) {
  const sessao = useArenaDBTStore((state) => state.sessao)
  const [erro, setErro] = useState<string | null>(null)
  const faltaId = useId()

  // A sessão do mesmo livro continua como estava; outro livro abre uma nova.
  useEffect(() => {
    useArenaDBTStore.getState().abrir(sistemaId)
  }, [sistemaId])

  const jogadores = useMemo(() => personagens.filter((personagem) => personagem.tipo === 'jogador'), [personagens])
  const npcs = useMemo(() => personagens.filter((personagem) => personagem.tipo === 'npc' && entraNaBatalha(personagem)), [personagens])
  // Os NPCs prontos do livro que já entraram: fichas só da memória, copiadas como as da pasta.
  const prontos = useProntosDaArenaDBT((state) => fichasProntasDoLivro(state, sistemaId))
  const disponiveis = useMemo(() => [...jogadores, ...npcs, ...prontos], [jogadores, npcs, prontos])
  const porId = useMemo(() => new Map([...personagens, ...prontos].map((personagem) => [personagem.id, personagem] as const)), [personagens, prontos])
  const pastaVazia = jogadores.length === 0 && npcs.length === 0

  if (sessao === null || sessao.sistemaId !== sistemaId) {
    return (
      <div className="mu-pg" aria-busy="true">
        <p className="mu-pg-nota">Abrindo a arena…</p>
      </div>
    )
  }

  const { montagem } = sessao
  const falta = oQueFalta(montagem, disponiveis)
  const pronto = falta === null && montagemProntaDBT(montagem, disponiveis)

  const comecar = () => {
    setErro(null)
    if (!useArenaDBTStore.getState().lutar(disponiveis)) setErro('Não deu para começar o teste. Confira se as fichas escolhidas ainda estão na pasta.')
  }

  return (
    <div className="mu-pg dba-pg">
      <div className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">Arena de testes</h2>
          <p className="mu-pg-sub">Monte dois lados com fichas do grupo, NPCs e bonecos de treino, e jogue a batalha Dragon Ball inteira controlando todos.</p>
        </div>
        <div className="dba-comecar">
          <button type="button" className="mu-bt mu-bt--primario" disabled={!pronto} aria-describedby={falta === null ? undefined : faltaId} onClick={comecar}>
            Começar o teste
          </button>
          {falta !== null && (
            <p className="mu-pg-nota" id={faltaId}>
              {falta}
            </p>
          )}
          {erro !== null && (
            <p className="mu-campo__erro" role="alert">
              {erro}
            </p>
          )}
        </div>
      </div>

      <p className="dba-aviso">
        <IconeDoMundo nome="copia" />
        <span>As fichas aqui são cópias: nada mexe nas fichas de verdade.</span>
      </p>

      <div className="dbf dba-opcoes">
        <div className="dba-opcao">
          <span className="dba-opcao__rot">Grade</span>
          <Segmentos<TamanhoDaGrade> rotulo="Grade" opcoes={GRADES} valor={montagem.grade} onTrocar={(grade) => useArenaDBTStore.getState().trocarGrade(grade)} />
        </div>
        <div className="dba-opcao">
          <span className="dba-opcao__rot">Modo da batalha</span>
          <Segmentos<ModoDaBatalha> rotulo="Modo da batalha" opcoes={MODOS} valor={montagem.modo} onTrocar={(modo) => useArenaDBTStore.getState().trocarModo(modo)} />
        </div>
        <p className="dba-opcao__nota">
          Automático: o motor rola, compara com a CA, gasta o Ki e aplica. Manual: cada resultado para no cartão para você conferir ou trocar. Dá para trocar no meio da luta.
        </p>
      </div>

      <div className="dba-montagem">
        <section className="dbf dba-fichas" aria-labelledby="dba-fichas-tit">
          <h3 className="dba-fichas__tit" id="dba-fichas-tit">
            Fichas da pasta
          </h3>
          {pastaVazia ? (
            <div className="mu-vazio">
              <p>Esta pasta ainda não tem jogadores nem NPCs de combate. Crie fichas num desses marcadores, ponha um NPC pronto do livro, ou teste só com bonecos de treino.</p>
              <div className="mu-pg-acoes">
                <button type="button" className="mu-bt mu-bt--p" onClick={() => useMundoDoLivroStore.getState().trocarAba('jogadores')}>
                  Ir a Jogadores
                </button>
                <button type="button" className="mu-bt mu-bt--p" onClick={() => useMundoDoLivroStore.getState().trocarAba('npcs')}>
                  Ir a NPCs de combate
                </button>
              </div>
            </div>
          ) : (
            [
              { chave: 'jogadores', titulo: 'Grupo', lista: jogadores },
              { chave: 'npcs', titulo: 'NPCs de combate', lista: npcs },
            ]
              .filter((grupo) => grupo.lista.length > 0)
              .map((grupo) => (
                <div key={grupo.chave} className="dba-fichas__grupo">
                  <h4 className="dba-fichas__grupo-tit">
                    {grupo.titulo} <small>{grupo.lista.length}</small>
                  </h4>
                  <ul className="dba-fichas__lista">
                    {grupo.lista.map((personagem) => (
                      <LinhaDaFicha key={personagem.id} personagem={personagem} montagem={montagem} />
                    ))}
                  </ul>
                </div>
              ))
          )}
          <NpcsProntosNaMontagem montagem={montagem} sistema={sistema} sistemaId={sistemaId} />
        </section>
        {LADOS.map((lado) => (
          <LadoNaMontagem key={lado} lado={lado} montagem={montagem} porId={porId} />
        ))}
      </div>

      {sessao.fase === 'lutando' && <TelaDaArenaDBT sistema={sistema} />}
    </div>
  )
}
