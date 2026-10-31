import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { fichasNoLado, montagemPronta } from '../../lib/arena/montagem'
import {
  EQUIPE_DO_LADO,
  FICHAS_POR_LADO_MAX,
  GRADES_DA_ARENA,
  VEZES_MAX,
  type EscolhaNaMontagem,
  type LadoDaArena,
  type ModoDaArena,
  type MontagemDaArena,
  type TamanhoDaGrade,
} from '../../lib/arena/tipos'
import { recursoDoEscudo } from '../../lib/batalha/leituraDaFicha'
import { entraNaBatalha } from '../../lib/livros/combate'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { recursoDeVida } from '../../lib/vidaDaFicha'
import { useArenaStore } from '../../stores/arenaStore'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { escolhasDaFicha, Retrato } from '../livros/comum'
import { IconeDoMundo } from '../livros/icones'
import { AjustesDoBoneco } from './AjustesDoBoneco'
import { TelaDaArena } from './TelaDaArena'
import './arena.css'

/**
 * A ARENA DE TESTES no mundo do livro (marcador "Arena de testes";
 * docs/planos/batalha-arena-de-testes-plano.md §4.4): a MONTAGEM. O mestre
 * escolhe o modo (dois lados, com o Judge de árbitro, ou um lado contra o
 * Judge-boneco), põe fichas da pasta em cada lado (até 6 por lado, o mesmo
 * NPC repetido vale), ajusta o boneco, a grade, e "Começar o teste". A luta
 * abre em tela cheia por cima do mundo (`TelaDaArena`).
 *
 * As escolhas moram na sessão da `useArenaStore` (memória da sessão do app):
 * trocar de marcador ou fechar o mundo não as perde. Nada aqui grava na
 * pasta: a luta usa CÓPIAS das fichas de agora.
 */

export interface PaginaArenaProps {
  /** As fichas da pasta (`usePersonagensDoMundo`). */
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
  sistemaId: string
}

const NOME_DO_LADO: Record<LadoDaArena, string> = { a: 'A', b: 'B' }

/** A cor do lado (a da equipe virtual) para o CSS: `--ar-cor`. */
function corDoLado(lado: LadoDaArena): CSSProperties {
  return { ['--ar-cor']: EQUIPE_DO_LADO[lado].cor } as CSSProperties
}

const MODOS: readonly { modo: ModoDaArena; rotulo: string }[] = [
  { modo: 'lados', rotulo: 'Dois lados' },
  { modo: 'boneco', rotulo: 'Contra o Judge-boneco' },
]

const TAMANHOS: readonly { grade: TamanhoDaGrade; rotulo: string }[] = [
  { grade: 'pequena', rotulo: 'Pequena' },
  { grade: 'media', rotulo: 'Média' },
]

/** As escolhas do lado, na ordem em que entraram. */
function escolhasDoLado(montagem: MontagemDaArena, lado: LadoDaArena): EscolhaNaMontagem[] {
  return montagem.escolhas.filter((escolha) => escolha.lado === lado)
}

/** O que falta para começar, numa frase; `null` = pronto. */
function oQueFalta(montagem: MontagemDaArena, existe: ReadonlySet<string>): string | null {
  const tem = (lado: LadoDaArena) => montagem.escolhas.some((escolha) => escolha.lado === lado && existe.has(escolha.personagemId))
  if (montagem.modo === 'boneco') return tem('a') ? null : 'Ponha ao menos uma ficha no Lado A para bater no Judge.'
  if (!tem('a') && !tem('b')) return 'Ponha ao menos uma ficha em cada lado.'
  if (!tem('a')) return 'Falta uma ficha no Lado A.'
  if (!tem('b')) return 'Falta uma ficha no Lado B.'
  return null
}

/** "Jogador · Humano · Navegador", "NPC de combate". */
function subDaFicha(personagem: Personagem, sistema: SistemaDeRpg): string {
  const escolhas = escolhasDaFicha(personagem, sistema)
  const tipo = personagem.tipo === 'jogador' ? 'Jogador' : 'NPC de combate'
  return escolhas.length > 0 ? `${tipo} · ${escolhas}` : tipo
}

interface LinhaDaFichaProps {
  personagem: Personagem
  sistema: SistemaDeRpg
  montagem: MontagemDaArena
  lados: readonly LadoDaArena[]
}

/** Uma ficha da pasta com o "+ A" / "+ B". O jogador entra uma vez por lado; o NPC repete (mais uma cópia a cada toque). */
function LinhaDaFicha({ personagem, sistema, montagem, lados }: LinhaDaFichaProps) {
  const repete = personagem.tipo === 'npc'
  return (
    <li className="ar-ficha">
      <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
      <span className="ar-ficha__txt">
        <span className="ar-ficha__nome">{personagem.nome}</span>
        <span className="ar-ficha__sub">{subDaFicha(personagem, sistema)}</span>
      </span>
      <span className="ar-ficha__botoes">
        {lados.map((lado) => {
          const atual = montagem.escolhas.find((escolha) => escolha.personagemId === personagem.id && escolha.lado === lado)
          const cheio = fichasNoLado(montagem, lado) >= FICHAS_POR_LADO_MAX
          const jaEsta = atual !== undefined && (!repete || atual.vezes >= VEZES_MAX)
          const texto = jaEsta ? `No ${NOME_DO_LADO[lado]}` : `+ ${NOME_DO_LADO[lado]}`
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
              className="ar-mais"
              style={corDoLado(lado)}
              data-esta={atual !== undefined ? 'sim' : undefined}
              disabled={jaEsta || cheio}
              aria-label={rotulo}
              title={rotulo}
              onClick={() => useArenaStore.getState().escolher(personagem.id, lado, (atual?.vezes ?? 0) + 1)}
            >
              {texto}
            </button>
          )
        })}
      </span>
    </li>
  )
}

interface LadoNaMontagemProps {
  lado: LadoDaArena
  montagem: MontagemDaArena
  porId: ReadonlyMap<string, Personagem>
}

/** Uma coluna da montagem: quem está no lado, as vezes do NPC (− ×2 +) e o tirar. */
function LadoNaMontagem({ lado, montagem, porId }: LadoNaMontagemProps) {
  const tituloId = useId()
  const escolhas = escolhasDoLado(montagem, lado)
  const n = fichasNoLado(montagem, lado)
  const cheio = n >= FICHAS_POR_LADO_MAX
  const equipe = EQUIPE_DO_LADO[lado]
  return (
    <section className="mu-cartao ar-lado" style={corDoLado(lado)} aria-labelledby={tituloId}>
      <header className="ar-lado__cab">
        <span className="ar-lado__marca" aria-hidden="true" />
        <h3 className="ar-lado__tit" id={tituloId}>
          {equipe.nome}
        </h3>
        <span className={cheio ? 'ar-lado__n ar-lado__n--cheio' : 'ar-lado__n'}>
          {n}/{FICHAS_POR_LADO_MAX}
          {cheio ? ' · cheio' : ''}
        </span>
      </header>
      {escolhas.length === 0 ? (
        <p className="ar-lado__vazio">Ninguém ainda. Toque em “+ {NOME_DO_LADO[lado]}” numa ficha da lista.</p>
      ) : (
        <ul className="ar-lado__lista">
          {escolhas.map((escolha) => {
            const personagem = porId.get(escolha.personagemId)
            const nome = personagem?.nome ?? 'Ficha que saiu da pasta'
            const repete = personagem?.tipo === 'npc'
            const { escolher, tirar } = useArenaStore.getState()
            return (
              <li key={escolha.personagemId} className={personagem === undefined ? 'ar-escolha ar-escolha--sumiu' : 'ar-escolha'}>
                <Retrato imagem={personagem?.retrato ?? null} nome={nome} tamanho="p" />
                <span className="ar-escolha__nome">{nome}</span>
                {repete ? (
                  <span className="ar-vezes" role="group" aria-label={`Quantos ${nome} no ${equipe.nome}`}>
                    <button
                      type="button"
                      className="mu-bt mu-bt--p mu-bt--ic"
                      aria-label={`Um ${nome} a menos`}
                      disabled={escolha.vezes <= 1}
                      onClick={() => escolher(escolha.personagemId, lado, escolha.vezes - 1)}
                    >
                      {'−'}
                    </button>
                    <span className="ar-vezes__n" aria-live="polite">
                      ×{escolha.vezes}
                    </span>
                    <button
                      type="button"
                      className="mu-bt mu-bt--p mu-bt--ic"
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
                <button type="button" className="mu-bt mu-bt--p mu-bt--ic" aria-label={`Tirar ${nome} do ${equipe.nome}`} title="Tirar do lado" onClick={() => tirar(escolha.personagemId, lado)}>
                  <IconeDoMundo nome="x" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** O cartão do Judge-boneco no lugar do Lado B: o que ele é e os ajustes. */
function CartaoDoBoneco({ montagem, comEscudo, comVida }: { montagem: MontagemDaArena; comEscudo: boolean; comVida: boolean }) {
  const tituloId = useId()
  return (
    <section className="mu-cartao ar-lado ar-boneco" aria-labelledby={tituloId}>
      <header className="ar-lado__cab">
        <span className="ar-boneco__med" aria-hidden="true">
          <IconeDoMundo nome="boneco" />
        </span>
        <h3 className="ar-lado__tit" id={tituloId}>
          Judge-boneco
        </h3>
      </header>
      <p className="ar-boneco__sub">O alvo do teste: apanha, reage sozinho e conta cada dano no placar.</p>
      <AjustesDoBoneco valor={montagem.boneco} onAjustar={(ajuste) => useArenaStore.getState().ajustarBoneco(ajuste)} comEscudo={comEscudo} comVida={comVida} momento="montagem" />
    </section>
  )
}

export function PaginaArena({ personagens, sistema, sistemaId }: PaginaArenaProps) {
  const sessao = useArenaStore((state) => state.sessao)
  const [erro, setErro] = useState<string | null>(null)
  const faltaId = useId()

  // A sessão do mesmo livro continua como estava; outro livro abre uma nova.
  useEffect(() => {
    useArenaStore.getState().abrir(sistemaId)
  }, [sistemaId])

  const jogadores = useMemo(() => personagens.filter((personagem) => personagem.tipo === 'jogador'), [personagens])
  const npcs = useMemo(() => personagens.filter((personagem) => personagem.tipo === 'npc' && entraNaBatalha(personagem)), [personagens])
  const porId = useMemo(() => new Map(personagens.map((personagem) => [personagem.id, personagem] as const)), [personagens])
  const existe = useMemo(() => new Set([...jogadores, ...npcs].map((personagem) => personagem.id)), [jogadores, npcs])
  const comEscudo = recursoDoEscudo(sistema) !== null
  const comVida = recursoDeVida(sistema) !== null

  if (sessao === null || sessao.sistemaId !== sistemaId) {
    return (
      <div className="mu-pg" aria-busy="true">
        <p className="mu-pg-nota">Abrindo a arena…</p>
      </div>
    )
  }

  const { montagem } = sessao
  const lados: readonly LadoDaArena[] = montagem.modo === 'boneco' ? ['a'] : ['a', 'b']
  const falta = oQueFalta(montagem, existe)
  const pronto = falta === null && montagemPronta(montagem, [...jogadores, ...npcs])
  const vazia = jogadores.length === 0 && npcs.length === 0

  const comecar = () => {
    setErro(null)
    if (!useArenaStore.getState().lutar([...jogadores, ...npcs])) setErro('Não deu para começar o teste. Confira se as fichas escolhidas ainda estão na pasta.')
  }

  return (
    <div className="mu-pg ar-pg">
      <div className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">Arena de testes</h2>
          <p className="mu-pg-sub">Monte dois lados com as fichas da pasta, ou ponha um lado contra o Judge-boneco, e jogue a batalha inteira controlando todos.</p>
        </div>
        <div className="ar-comecar">
          <button type="button" className="mu-bt mu-bt--primario ar-comecar__bt" disabled={!pronto} aria-describedby={falta === null ? undefined : faltaId} onClick={comecar}>
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

      <p className="ar-aviso">
        <IconeDoMundo nome="copia" />
        <span>As fichas aqui são cópias: nada mexe nas fichas de verdade.</span>
      </p>

      <div className="ar-opcoes">
        <fieldset className="ar-opcao">
          <legend className="mu-campo__rot">Modo</legend>
          <div className="ar-seg">
            {MODOS.map(({ modo, rotulo }) => (
              <label key={modo} className="ar-seg__op">
                <input type="radio" name="ar-modo" value={modo} checked={montagem.modo === modo} onChange={() => useArenaStore.getState().trocarModo(modo)} />
                <span>{rotulo}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="ar-opcao">
          <legend className="mu-campo__rot">Grade</legend>
          <div className="ar-seg">
            {TAMANHOS.map(({ grade, rotulo }) => {
              const { colunas, linhas } = GRADES_DA_ARENA[grade]
              return (
                <label key={grade} className="ar-seg__op">
                  <input type="radio" name="ar-grade" value={grade} checked={montagem.grade === grade} onChange={() => useArenaStore.getState().trocarGrade(grade)} />
                  <span>
                    {rotulo} <small>{`${colunas} × ${linhas}`}</small>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>

      <div className="ar-montagem">
        <section className="mu-cartao ar-fichas" aria-labelledby="ar-fichas-tit">
          <h3 className="ar-fichas__tit" id="ar-fichas-tit">
            Fichas da pasta
          </h3>
          {vazia ? (
            <div className="mu-vazio ar-fichas__vazio">
              <p>Esta pasta ainda não tem jogadores nem NPCs de combate. Crie as fichas num desses marcadores e volte aqui.</p>
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
              { chave: 'jogadores', titulo: 'Jogadores', lista: jogadores },
              { chave: 'npcs', titulo: 'NPCs de combate', lista: npcs },
            ]
              .filter((grupo) => grupo.lista.length > 0)
              .map((grupo) => (
                <div key={grupo.chave} className="ar-fichas__grupo">
                  <h4 className="ar-fichas__grupo-tit">
                    {grupo.titulo} <small>{grupo.lista.length}</small>
                  </h4>
                  <ul className="ar-fichas__lista">
                    {grupo.lista.map((personagem) => (
                      <LinhaDaFicha key={personagem.id} personagem={personagem} sistema={sistema} montagem={montagem} lados={lados} />
                    ))}
                  </ul>
                </div>
              ))
          )}
        </section>

        <LadoNaMontagem lado="a" montagem={montagem} porId={porId} />
        {montagem.modo === 'lados' ? (
          <LadoNaMontagem key="b" lado="b" montagem={montagem} porId={porId} />
        ) : (
          <CartaoDoBoneco key="boneco" montagem={montagem} comEscudo={comEscudo} comVida={comVida} />
        )}
      </div>

      {sessao.fase === 'lutando' && <TelaDaArena sistema={sistema} />}
    </div>
  )
}
