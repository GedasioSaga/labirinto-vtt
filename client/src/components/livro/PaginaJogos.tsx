import { useEffect, useId, useState } from 'react'
import { Acoes, Botao } from '../grimorio/Botao'
import { Nota } from '../grimorio/Nota'
import { SubFicha } from '../grimorio/Cartoes'
import { MinigameControls, type MinigameControlsProps } from '../MinigameControls'
import { FolhaDoLivro, TituloDaPagina } from './FolhaDoLivro'
import type { PaginaExtraDoMestre } from './LivroDoMestre'
import { IconeDoJogo, IconeDosJogos } from './IconeDoJogo'
import { DESAFIO_NOME_MAX_LENGTH, desafiosDo, desafiosMigrados, faltaNoLugar, novoDesafio, patchDaTrocaDeJogo, pontoDoDesafio, textoDoLugar } from '../../lib/desafios'
import { BlocoDoConvite } from './desafio/BlocoDoConvite'
import { BlocoOndeEComoComeca, irAoDesafio } from './desafio/BlocoOndeEComoComeca'
import { PreviaDoJogador } from './desafio/PreviaDoJogador'
import { ORDEM_DOS_JOGOS, REGISTRO_DE_MINIGAMES, nomeDoJogo, nomeDoJogoDoDesafio, type CategoriaDoJogo } from '../../minigames/registro'
import type { JogoDoMinigame } from '../../minigames/tipos'
import type { DancaAoVivo } from '../../net/dancaNoHost'
import type { PescaAoVivo } from '../../net/pescaNoHost'
import type { TiroAoVivo } from '../../net/tiroNoHost'
import type { FogoAoVivo } from '../../net/fogoNoHost'
import type { BolhaAoVivo } from '../../net/bolhaNoHost'
import type { AlavancaAoVivo } from '../../net/alavancaNoHost'
import type { PuzzleAoVivo } from '../../net/puzzleNoHost'
import type { Desafio, Prop } from '../../types/map'
import { useDesafiosStore } from '../../stores/desafiosStore'
import { useMapStore } from '../../stores/mapStore'
import { ObjetosQueAbrem } from './ObjetosQueAbrem'
import { mobiliaDoConteudo } from '../../lib/conteudoDoObjeto'
import { EditorDoPuzzleNaTela } from '../puzzles/EditorDoPuzzle'
import { MeusPuzzles, textoDaCopia } from '../puzzles/MeusPuzzles'
import { contagemDoPuzzle } from '../../puzzles/motor'
import { useMeusPuzzlesStore } from '../../stores/meusPuzzlesStore'
import './paginas.css'
import './paginaJogos.css'

/**
 * A PÁGINA JOGOS do livro do mestre (desafios, 15/11/2026; protótipo aprovado
 * com o pedido "coloca jogos para o lado esquerdo"): os minigames da cena fora
 * do pino. Lista, ao vivo, ficha de cada desafio (o mesmo painel do jogo que o
 * pino tinha) e o aviso dos pinos ▷ que viraram desafios ao abrir o mapa.
 */

/** O marcador da página no livro, antes do Roteiro do Prelúdio. */
export const PAGINA_DOS_JOGOS: PaginaExtraDoMestre = { id: 'jogos', rotulo: 'Jogos', icone: <IconeDosJogos /> }

/** Uma sessão ao vivo da sala, pelo id do desafio (o `pinId` das sessões). */
export interface SessaoAoVivo {
  pinId: string
  jogo: JogoDoMinigame
  fase: string
  jogadores: number
  /** Só no puzzle: quem está dentro agora, pelo nome (a sessão do host, `puzzlesAoVivo`). */
  dentro?: readonly string[]
}

interface SessaoDoHost {
  pinId: string
  fase: string
  participantes: readonly unknown[]
}

function sessao(jogo: JogoDoMinigame, s: SessaoDoHost): SessaoAoVivo {
  return { pinId: s.pinId, jogo, fase: s.fase, jogadores: s.participantes.length }
}

/** O puzzle com alguém dentro, desta cena (o puzzle de outra cena não está na lista desta página). */
function sessoesDosPuzzles(puzzles: readonly PuzzleAoVivo[], mapaId: string): SessaoAoVivo[] {
  return puzzles
    .filter((p) => p.mapaId === mapaId && p.dentro.length > 0)
    .map((p): SessaoAoVivo => ({ pinId: p.desafioId, jogo: 'puzzle', fase: 'dentro', jogadores: p.dentro.length, dentro: p.dentro.map((quem) => quem.nome) }))
}

/** As sessões da sala que ainda não acabaram, de todos os jogos. `mapaId`: a cena aberta, a dos puzzles mostrados. */
export function sessoesAoVivo(fontes: {
  danca: DancaAoVivo | null
  pescas: readonly PescaAoVivo[]
  tiros: readonly TiroAoVivo[]
  fogo: FogoAoVivo | null
  bolha: BolhaAoVivo | null
  /** A alavanca da ponte (a ativa ou a última); ausente = nenhuma. */
  alavanca?: AlavancaAoVivo | null
  puzzles: readonly PuzzleAoVivo[]
  mapaId: string
}): SessaoAoVivo[] {
  return [
    ...sessoesDosPuzzles(fontes.puzzles, fontes.mapaId),
    ...(fontes.danca === null ? [] : [sessao('danca', fontes.danca)]),
    ...fontes.pescas.map((s) => sessao('pesca', s)),
    ...fontes.tiros.map((s) => sessao('tiro', s)),
    ...(fontes.fogo === null ? [] : [sessao('fogo', fontes.fogo)]),
    ...(fontes.bolha === null ? [] : [sessao('bolha', fontes.bolha)]),
    ...(fontes.alavanca === null || fontes.alavanca === undefined ? [] : [sessao('alavanca', fontes.alavanca)]),
  ].filter((s) => s.fase !== 'encerrada')
}

const TEXTO_DA_FASE: Readonly<Record<string, string>> = {
  convite: 'chamando',
  musica: 'dançando',
  jogo: 'em jogo',
  aberta: 'aberta',
  pausa: 'em pausa',
  // A alavanca da ponte: a contagem e a rodada são o mesmo "girando" para quem lê a lista.
  contagem: 'girando',
  rodada: 'girando',
  fim: 'acabando',
}

function Seta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

interface PropsDaPaginaJogos {
  /** O painel do jogo do desafio (o mesmo que o pino tinha), montado pelo App com a sala e a visão de teste. */
  painelDoDesafio: (desafio: Desafio) => MinigameControlsProps
  /** As sessões ao vivo da sala (`sessoesAoVivo`). */
  aoVivo: readonly SessaoAoVivo[]
}

/**
 * As 3 abas da lista (plano dos puzzles, §3.2): os jogos de ação, os objetos
 * que abrem (baú, caixa, barril) e os puzzles com "Meus puzzles".
 */
type AbaDosJogos = CategoriaDoJogo | 'objetos'

const ABAS: readonly { valor: AbaDosJogos; rotulo: string }[] = [
  { valor: 'acao', rotulo: 'Ação' },
  { valor: 'objetos', rotulo: 'Objetos' },
  { valor: 'puzzle', rotulo: 'Puzzles' },
]

export function PaginaJogos({ painelDoDesafio, aoVivo }: PropsDaPaginaJogos) {
  const map = useMapStore((estado) => estado.map)
  const abertoId = useDesafiosStore((estado) => estado.aberto)
  const destacado = useDesafiosStore((estado) => estado.destacado)
  const avisoDispensado = useDesafiosStore((estado) => estado.avisosDispensados.has(map.id))
  const escolhaDoJogo = useDesafiosStore((estado) => estado.escolhaDoJogo)
  const [aba, setAba] = useState<AbaDosJogos>('acao')
  // O "Ver" do aviso de baú aberto destaca o objeto: a lista vai para a aba dele.
  const [destacadoVisto, setDestacadoVisto] = useState(destacado)
  if (destacado !== destacadoVisto) {
    setDestacadoVisto(destacado)
    if (destacado !== null) setAba('objetos')
  }
  const desafios = desafiosDo(map)
  const aberto = desafios.find((desafio) => desafio.id === abertoId)
  // A aba segue o desafio aberto (B18 das NOTAS do editor): o desafio que virou puzzle volta para a lista dos puzzles, não some da Ação.
  const abaDoAberto = aberto === undefined ? null : REGISTRO_DE_MINIGAMES[aberto.minigame.jogo].categoria
  if (abaDoAberto !== null && abaDoAberto !== aba) setAba(abaDoAberto)
  return (
    <FolhaDoLivro pagina="jogos">
      {escolhaDoJogo !== null && (escolhaDoJogo.para === 'novo' || aberto !== undefined) ? (
        <EscolhaDoJogo desafio={escolhaDoJogo.para === 'trocar' ? aberto : undefined} />
      ) : aberto === undefined ? (
        <ListaDosJogos desafios={desafios} props={map.props} aoVivo={aoVivo} mapaId={map.id} avisoDispensado={avisoDispensado} aba={aba} onAba={setAba} />
      ) : (
        <FichaDoDesafio key={aberto.id} desafio={aberto} props={map.props} painel={painelDoDesafio(aberto)} emJogo={aoVivo.some((s) => s.pinId === aberto.id)} />
      )}
      <EditorDoPuzzleNaTela />
    </FolhaDoLivro>
  )
}

interface PropsDaLista {
  desafios: readonly Desafio[]
  props: readonly Prop[]
  aoVivo: readonly SessaoAoVivo[]
  mapaId: string
  avisoDispensado: boolean
  aba: AbaDosJogos
  onAba: (aba: AbaDosJogos) => void
}

/** As abas da lista, com as setas andando entre elas (o padrão de abas do WAI-ARIA). */
function AbasDosJogos({ aba, onAba, contas }: { aba: AbaDosJogos; onAba: (aba: AbaDosJogos) => void; contas: Readonly<Record<AbaDosJogos, number>> }) {
  return (
    <div
      className="mg-abas"
      role="tablist"
      aria-label="Tipos de jogo"
      onKeyDown={(evento) => {
        const i = ABAS.findIndex((opcao) => opcao.valor === aba)
        const passo = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0
        if (passo === 0) return
        evento.preventDefault()
        const proxima = ABAS[(i + passo + ABAS.length) % ABAS.length]
        onAba(proxima.valor)
        const botao = evento.currentTarget.querySelector(`[data-aba="${proxima.valor}"]`)
        if (botao instanceof HTMLElement) botao.focus()
      }}
    >
      {ABAS.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          role="tab"
          className="mg-aba"
          data-aba={opcao.valor}
          aria-selected={aba === opcao.valor}
          tabIndex={aba === opcao.valor ? 0 : -1}
          onClick={() => onAba(opcao.valor)}
        >
          {opcao.rotulo} <small>{contas[opcao.valor]}</small>
        </button>
      ))}
    </div>
  )
}

/** "Lara e Bento dentro · 2 de 3": quem está no puzzle e quantos encaixes já estão cheios (plano §3.2). */
function textoDeQuemEstaDentro(dentro: readonly string[], desafio: Desafio | undefined): string {
  const nomes = dentro.length <= 1 ? dentro.join('') : `${dentro.slice(0, -1).join(', ')} e ${dentro[dentro.length - 1]}`
  const quem = `${nomes} dentro`
  if (desafio === undefined || desafio.minigame.jogo !== 'puzzle') return quem
  const progresso = desafio.progressoDoPuzzle
  if (progresso?.resolvido != null) return `${quem} · resolvido`
  const conta = contagemDoPuzzle(desafio.minigame.puzzle, progresso ?? { encaixes: {} })
  return conta.total === 0 ? quem : `${quem} · ${conta.postos} de ${conta.total}`
}

/** O resumo do puzzle na linha da lista: de onde a cópia veio e quantos encaixes estão cheios. */
function ResumoDoPuzzle({ desafio }: { desafio: Desafio }) {
  const modelos = useMeusPuzzlesStore((estado) => estado.modelos)
  if (desafio.minigame.jogo !== 'puzzle') return null
  const { puzzle } = desafio.minigame
  const progresso = desafio.progressoDoPuzzle
  const conta = progresso === undefined ? null : contagemDoPuzzle(puzzle, progresso)
  return (
    <>
      <span className="mg-tag">{textoDaCopia(desafio.minigame, modelos)}</span>
      {progresso?.resolvido != null ? (
        <span className="mg-tag mg-tag--feito">Resolvido</span>
      ) : (
        conta !== null && conta.postos > 0 && <span className="mg-tag mg-tag--latao">{`${conta.postos} de ${conta.total}`}</span>
      )}
    </>
  )
}

function ListaDosJogos({ desafios: todos, props, aoVivo, mapaId, avisoDispensado, aba, onAba }: PropsDaLista) {
  const migrados = desafiosMigrados({ desafios: [...todos] })
  const { abrir, dispensarAviso } = useDesafiosStore.getState()
  const emJogo = new Set(aoVivo.map((s) => s.pinId))
  const nomeDe = (id: string) => todos.find((desafio) => desafio.id === id)?.nome
  const categoriaDe = (desafio: Desafio) => REGISTRO_DE_MINIGAMES[desafio.minigame.jogo].categoria
  const desafios = aba === 'objetos' ? [] : todos.filter((desafio) => categoriaDe(desafio) === aba)
  const contas: Record<AbaDosJogos, number> = {
    acao: todos.filter((desafio) => categoriaDe(desafio) === 'acao').length,
    puzzle: todos.filter((desafio) => categoriaDe(desafio) === 'puzzle').length,
    objetos: props.filter((prop) => mobiliaDoConteudo(prop) !== null).length,
  }

  // JOGO PRIMEIRO (decisão 1 do editor, B2): "Novo desafio" abre a escolha dos jogos; nada entra no mapa antes.
  // Na aba dos puzzles só há um jogo: o puzzle novo entra direto, já pedindo o lugar.
  const criar = () => {
    if (aba === 'puzzle') criarDesafio('puzzle')
    else useDesafiosStore.getState().abrirEscolhaDoJogo({ para: 'novo' })
  }
  const mostrarMigrados = () => {
    const primeiro = migrados.find((desafio) => pontoDoDesafio(desafio, props) !== null)
    if (primeiro === undefined) return
    irAoDesafio(primeiro, props)
    abrir(primeiro.id)
  }

  // A margem das páginas Cena, Aventura e Acervo (`.gr-paginas`): sem ela os títulos das seções e os cartões
  // encostavam na borda do livro (auditoria de 16/11/2026).
  return (
    <>
      <TituloDaPagina titulo="Jogos" sub="Os desafios desta cena: dança, pesca, tiro, fogo, bolha, alavanca e puzzle." />
      <div className="lb-zona gr-paginas">
        {migrados.length > 0 && !avisoDispensado && (
          <div className="mg-aviso" role="status">
            <p>
              {migrados.length === 1 ? '1 pino ▷ deste mapa virou desafio.' : `${migrados.length} pinos ▷ deste mapa viraram desafios.`} Os jogos
              moram aqui agora; no mapa, cada um aparece como um selo.
            </p>
            <Acoes>
              <Botao variante="latao" tamanho="p" onClick={mostrarMigrados}>
                Mostrar no mapa
              </Botao>
              <Botao variante="fantasma" tamanho="p" onClick={() => dispensarAviso(mapaId)}>
                Entendi
              </Botao>
            </Acoes>
          </div>
        )}

        {aoVivo.length > 0 && (
          <>
            <h3 className="mg-secao">
              Ao vivo <small>{aoVivo.length}</small>
            </h3>
            <ul className="mg-vivo">
              {aoVivo.map((s) => (
                <li key={`${s.jogo}:${s.pinId}`}>
                  <button type="button" className="mg-linha" onClick={() => abrir(s.pinId)}>
                    <span className="mg-linha__med">
                      <IconeDoJogo jogo={s.jogo} />
                    </span>
                    <span className="mg-linha__nome">
                      <span className="mg-pulsando" aria-hidden="true" /> {nomeDe(s.pinId) ?? nomeDoJogo(s.jogo)}
                    </span>
                    <span className="mg-linha__seta">
                      <Seta />
                    </span>
                    <span className="mg-linha__onde">
                      {s.dentro !== undefined ? textoDeQuemEstaDentro(s.dentro, todos.find((desafio) => desafio.id === s.pinId)) : `${TEXTO_DA_FASE[s.fase] ?? s.fase} · ${s.jogadores === 1 ? '1 jogador' : `${s.jogadores} jogadores`}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <AbasDosJogos aba={aba} onAba={onAba} contas={contas} />

        {aba === 'objetos' ? (
          <ObjetosQueAbrem props={props} />
        ) : (
          <>
            <h3 className="mg-secao">
              {aba === 'puzzle' ? 'Puzzles neste mapa' : 'Desafios'} <small>{desafios.length}</small>
            </h3>
            {desafios.length === 0 ? (
              <p className="mg-vazio">
                {aba === 'puzzle'
                  ? 'Nenhum puzzle nesta cena. Crie um aqui ou ponha um dos seus puzzles, e marque onde ele fica: um ponto do mapa ou um objeto.'
                  : 'Nenhum desafio nesta cena. Crie um e marque onde ele acontece: um ponto do mapa ou um objeto.'}
              </p>
            ) : (
              <ul className="mg-lista">
                {desafios.map((desafio) => {
                  const falta = faltaNoLugar(desafio, props)
                  const ehPuzzle = desafio.minigame.jogo === 'puzzle'
                  const temTags = ehPuzzle || desafio.eraPino !== undefined || emJogo.has(desafio.id) || falta !== null
                  return (
                    <li key={desafio.id}>
                      <button type="button" className="mg-linha" onClick={() => abrir(desafio.id)}>
                        <span className="mg-linha__med">
                          <IconeDoJogo jogo={desafio.minigame.jogo} />
                        </span>
                        <span className="mg-linha__nome">{desafio.nome}</span>
                        <span className="mg-linha__seta">
                          <Seta />
                        </span>
                        <span className="mg-linha__onde">
                          {nomeDoJogoDoDesafio(desafio.minigame)} · {textoDoLugar(desafio, props)}
                        </span>
                        {temTags && (
                          <span className="mg-linha__tags">
                            {desafio.eraPino !== undefined && <span className="mg-tag mg-tag--latao">Era pino ▷</span>}
                            {emJogo.has(desafio.id) && <span className="mg-tag mg-tag--feito">Em jogo</span>}
                            {ehPuzzle && <ResumoDoPuzzle desafio={desafio} />}
                            {falta !== null && <span className="mg-tag mg-tag--perigo">{falta}</span>}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="mg-nota-pe">
              <Botao variante="latao" largo onClick={criar}>
                {aba === 'puzzle' ? 'Novo puzzle neste mapa' : 'Novo desafio'}
              </Botao>
            </div>
            {aba === 'puzzle' && <MeusPuzzles />}
          </>
        )}
      </div>
    </>
  )
}

/** O desafio novo do jogo escolhido, aberto na ficha. O jogo que não vive fora do mapa (o puzzle) já entra marcando o ponto. */
function criarDesafio(jogo: JogoDoMinigame): void {
  const desafio = novoDesafio(crypto.randomUUID(), jogo)
  useMapStore.getState().addDesafio(desafio)
  const { abrir, marcar } = useDesafiosStore.getState()
  abrir(desafio.id)
  if (faltaNoLugar(desafio, [])) marcar(desafio.id, 'ponto')
}

/**
 * TROCAR O JOGO do desafio (decisões 3 e 4 do editor): o jogo de agora fica
 * guardado na memória e o novo volta como ficou, ou nasce com o exemplo dele
 * (`patchDaTrocaDeJogo`). Um passo do Ctrl+Z. O aviso da ficha oferece
 * "Desfazer a troca", que é trocar de volta (o de antes está guardado).
 */
function trocarOJogo(desafio: Desafio, jogo: JogoDoMinigame, avisar: boolean): void {
  if (jogo === desafio.minigame.jogo) return
  const store = useDesafiosStore.getState()
  const guardado = store.guardados[desafio.id]?.[jogo]
  store.guardarJogo(desafio.id, desafio.portaLigada === undefined ? { minigame: desafio.minigame } : { minigame: desafio.minigame, portaLigada: desafio.portaLigada })
  useMapStore.getState().updateDesafio(desafio.id, patchDaTrocaDeJogo(desafio, jogo, guardado))
  store.avisarTroca(avisar ? { id: desafio.id, de: desafio.minigame.jogo, voltou: guardado !== undefined } : null)
  if (faltaNoLugar({ lugar: desafio.lugar, minigame: { jogo } }, [])) store.marcar(desafio.id, 'ponto')
}

/**
 * A ESCOLHA DO JOGO (decisão 1 do editor de 21/11/2026): os 7 jogos do
 * registro, com o que cada um é. Para um desafio novo, escolher cria o
 * desafio já montado para o jogo; para trocar (`desafio`), o lugar no mapa
 * fica e o jogo de agora fica guardado.
 */
function EscolhaDoJogo({ desafio }: { desafio?: Desafio }) {
  const guardados = useDesafiosStore((estado) => (desafio === undefined ? undefined : estado.guardados[desafio.id]))
  const fechar = () => useDesafiosStore.getState().abrirEscolhaDoJogo(null)
  const escolher = (jogo: JogoDoMinigame) => {
    if (desafio === undefined) {
      criarDesafio(jogo)
      return
    }
    fechar()
    trocarOJogo(desafio, jogo, true)
  }
  return (
    <SubFicha
      voltarPara={desafio === undefined ? 'Jogos' : desafio.nome}
      onVoltar={fechar}
      icone={desafio === undefined ? <IconeDosJogos /> : <IconeDoJogo jogo={desafio.minigame.jogo} />}
      titulo={desafio === undefined ? 'Qual é o jogo?' : 'Trocar o jogo'}
      tipo={desafio === undefined ? 'Escolha primeiro: a ficha, o nome e o convite já vêm montados para ele.' : 'O lugar no mapa fica. O que é do jogo de agora fica guardado e volta se você voltar.'}
    >
      <ul className="mg-lista">
        {ORDEM_DOS_JOGOS.map((jogo) => {
          const atual = desafio !== undefined && desafio.minigame.jogo === jogo
          const guardado = !atual && guardados?.[jogo] !== undefined
          return (
            <li key={jogo}>
              <button type="button" className="mg-linha" data-jogo={jogo} aria-current={atual || undefined} onClick={() => (atual ? fechar() : escolher(jogo))}>
                <span className="mg-linha__med">
                  <IconeDoJogo jogo={jogo} />
                </span>
                <span className="mg-linha__nome">{nomeDoJogo(jogo)}</span>
                <span className="mg-linha__seta">
                  <Seta />
                </span>
                <span className="mg-linha__onde">{REGISTRO_DE_MINIGAMES[jogo].resumo}</span>
                {(atual || guardado) && (
                  <span className="mg-linha__tags">
                    {atual && <span className="mg-tag mg-tag--latao">É o de agora</span>}
                    {guardado && <span className="mg-tag mg-tag--feito">Guardado: volta como estava</span>}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </SubFicha>
  )
}

function Lapis() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 20l1-4L16.5 4.5l3 3L8 19z M14 7l3 3" />
    </svg>
  )
}

/**
 * O NOME (decisão 2 do editor): automático, no título da ficha. O lápis abre
 * o campo; Enter ou sair grava, Esc desiste, vazio volta ao automático (B10).
 * "Voltar ao automático" desfaz o nome do mestre.
 */
function NomeDoDesafio({ desafio }: { desafio: Desafio }) {
  const id = useId()
  const [rascunho, setRascunho] = useState<string | null>(null)
  const gravar = (nome: string) => useMapStore.getState().updateDesafio(desafio.id, { nome })
  const fechar = (gravando: boolean) => {
    if (rascunho !== null && gravando) gravar(rascunho)
    setRascunho(null)
  }
  const proprio = desafio.nomeProprio === true
  if (rascunho !== null) {
    return (
      <div className="gr-campo mg-nome">
        <label className="gr-campo__rot" htmlFor={id}>
          Nome do desafio <small>Enter grava. Vazio volta ao automático.</small>
        </label>
        <input
          id={id}
          className="gr-entrada"
          type="text"
          autoComplete="off"
          autoFocus
          maxLength={DESAFIO_NOME_MAX_LENGTH}
          value={rascunho}
          onChange={(evento) => setRascunho(evento.currentTarget.value)}
          onFocus={(evento) => evento.currentTarget.select()}
          onBlur={() => fechar(true)}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') fechar(true)
            if (evento.key === 'Escape') {
              // O Esc é do campo: não cancela a marcação nem fecha a página.
              evento.stopPropagation()
              fechar(false)
            }
          }}
        />
      </div>
    )
  }
  return (
    <div className="mg-nome">
      <span className={`mg-tag${proprio ? ' mg-tag--latao' : ''}`}>{proprio ? 'nome seu' : 'nome automático'}</span>
      {proprio ? (
        <button type="button" className="mg-link" onClick={() => gravar('')}>
          Voltar ao automático
        </button>
      ) : (
        <span className="mg-nome__dica">Só você vê este nome.</span>
      )}
      <button type="button" className="mg-lapis" aria-label="Renomear o desafio" onClick={() => setRascunho(desafio.nome)}>
        <Lapis />
      </button>
    </div>
  )
}

interface PropsDaFicha {
  desafio: Desafio
  props: readonly Prop[]
  painel: MinigameControlsProps
  /** Há partida aberta deste desafio: a troca de jogo trava (B7). */
  emJogo: boolean
}

/**
 * A FICHA DO DESAFIO (protótipo aprovado em 21/11/2026, "gostei"): o nome
 * automático no título, o jogo com "Trocar", o convite, onde fica e como
 * começa, as regras e o que vale do jogo, a mesa e o apagar que pergunta.
 */
function FichaDoDesafio({ desafio, props, painel, emJogo }: PropsDaFicha) {
  const { abrir } = useDesafiosStore.getState()
  const troca = useDesafiosStore((estado) => (estado.trocaRecente !== null && estado.trocaRecente.id === desafio.id ? estado.trocaRecente : null))
  // APAGAR PERGUNTA NO LUGAR (decisão 13, B15): "Apagar mesmo / Manter", sem janela.
  const [apagando, setApagando] = useState(false)
  const jogo = desafio.minigame.jogo

  // Fechar a ficha (voltar, apagar, outra página) cancela o "Marcar no mapa" deste desafio.
  useEffect(
    () => () => {
      if (useDesafiosStore.getState().marcando?.id === desafio.id) useDesafiosStore.getState().pararDeMarcar()
    },
    [desafio.id],
  )
  // Esc cancela a marcação em curso.
  const marcandoEste = useDesafiosStore((estado) => estado.marcando !== null && estado.marcando.id === desafio.id)
  useEffect(() => {
    if (!marcandoEste) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') useDesafiosStore.getState().pararDeMarcar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [marcandoEste])

  const apagar = () => {
    abrir(null)
    useMapStore.getState().removeDesafio(desafio.id)
  }
  const trocaTravada = emJogo ? 'Há uma partida aberta deste desafio: encerre-a antes de trocar o jogo.' : null

  return (
    <SubFicha voltarPara="Jogos" onVoltar={() => abrir(null)} icone={<IconeDoJogo jogo={jogo} />} titulo={desafio.nome} tipo={`Desafio · ${nomeDoJogoDoDesafio(desafio.minigame)}`}>
      <NomeDoDesafio key={desafio.nome} desafio={desafio} />
      {/* Depois do Ctrl+Z que desfaz a troca, o jogo de agora é o de antes: o aviso some em vez de mentir. */}
      {troca !== null && troca.de !== jogo && (
        <div className="mg-aviso" role="status">
          <p>
            Agora é {nomeDoJogo(jogo)}. {troca.voltou ? 'Voltou como você tinha deixado. ' : ''}O que era {nomeDoJogo(troca.de)} ficou guardado: se você voltar, volta igual.
          </p>
          <Acoes>
            <Botao variante="latao" tamanho="p" onClick={() => trocarOJogo(desafio, troca.de, false)} disabled={trocaTravada !== null}>
              Desfazer a troca
            </Botao>
          </Acoes>
        </div>
      )}
      <div className="mg-jogo-atual">
        <span>
          <b>{nomeDoJogo(jogo)}</b>
          <small>{REGISTRO_DE_MINIGAMES[jogo].resumo}</small>
        </span>
        <Botao tamanho="p" onClick={() => useDesafiosStore.getState().abrirEscolhaDoJogo({ para: 'trocar', id: desafio.id })} disabled={trocaTravada !== null}>
          Trocar
        </Botao>
      </div>
      {trocaTravada !== null && <Nota>{trocaTravada}</Nota>}
      <BlocoDoConvite desafio={desafio} />
      <BlocoOndeEComoComeca desafio={desafio} props={props} />
      <section className="mg-bloco mg-troca" key={jogo}>
        <h3 className="mg-secao">Regras e o que vale</h3>
        <MinigameControls key={desafio.id} {...painel} naFicha trocaTravada={trocaTravada} />
      </section>
      {desafio.eraPino !== undefined && (
        <Nota>
          Veio do pino ▷{desafio.eraPino.nome ? ` “${desafio.eraPino.nome}”` : ''}. O pino saiu do mapa; o selo do desafio ficou no lugar dele.
        </Nota>
      )}
      <section className="mg-bloco">
        {apagando ? (
          <>
            <p className="mg-erro">
              Apagar “{desafio.nome}”?{desafio.lugar.tipo === 'nenhum' ? '' : ' O selo sai do mapa.'}{emJogo ? ' A partida aberta perde o desafio.' : ''}
            </p>
            <Acoes>
              <Botao variante="perigo" onClick={apagar}>
                Apagar mesmo
              </Botao>
              <Botao variante="fantasma" onClick={() => setApagando(false)}>
                Manter
              </Botao>
            </Acoes>
          </>
        ) : (
          <Botao variante="perigo" onClick={() => setApagando(true)}>
            Apagar desafio
          </Botao>
        )}
      </section>
      {/* Por último: gruda no pé da coluna do livro enquanto a folha rola, e nunca fica sobre o mapa. */}
      <PreviaDoJogador desafio={desafio} />
    </SubFicha>
  )
}
