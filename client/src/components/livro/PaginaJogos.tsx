import { useEffect, useId, useState } from 'react'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoFaixa } from '../grimorio/CampoFaixa'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { Nota } from '../grimorio/Nota'
import { SubFicha } from '../grimorio/Cartoes'
import { MinigameControls, type MinigameControlsProps } from '../MinigameControls'
import { FolhaDoLivro, TituloDaPagina } from './FolhaDoLivro'
import type { PaginaExtraDoMestre } from './LivroDoMestre'
import { IconeDoJogo, IconeDosJogos } from './IconeDoJogo'
import { DESAFIO_NOME_MAX_LENGTH, desafiosDo, desafiosMigrados, faltaNoLugar, novoDesafio, patchDoTamanhoDoSelo, pontoDoDesafio, tamanhoDoSelo, textoDoLugar } from '../../lib/desafios'
import { PIN_ESCALA_MAX, PIN_ESCALA_MIN } from '../../lib/pins'
import { ORDEM_DOS_JOGOS, REGISTRO_DE_MINIGAMES, nomeDoJogo, nomeDoJogoDoDesafio, type CategoriaDoJogo } from '../../minigames/registro'
import type { JogoDoMinigame } from '../../minigames/tipos'
import type { DancaAoVivo } from '../../net/dancaNoHost'
import type { PescaAoVivo } from '../../net/pescaNoHost'
import type { TiroAoVivo } from '../../net/tiroNoHost'
import type { FogoAoVivo } from '../../net/fogoNoHost'
import type { BolhaAoVivo } from '../../net/bolhaNoHost'
import type { AlavancaAoVivo } from '../../net/alavancaNoHost'
import type { PuzzleAoVivo } from '../../net/puzzleNoHost'
import type { Desafio, Prop, TipoDoLugarDoDesafio } from '../../types/map'
import { useAdventureStore } from '../../stores/adventureStore'
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

const OPCOES_DO_LUGAR: readonly OpcaoDoSeg<TipoDoLugarDoDesafio>[] = [
  { valor: 'ponto', rotulo: 'Ponto' },
  { valor: 'objeto', rotulo: 'Objeto' },
  { valor: 'nenhum', rotulo: 'Fora do mapa' },
]

function Seta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** Leva a câmera do editor ao selo do desafio (e ao piso dele). Sem lugar no mapa: nada. */
function irAoDesafio(desafio: Desafio, props: readonly Prop[]): void {
  const ponto = pontoDoDesafio(desafio, props)
  if (ponto === null) return
  const store = useMapStore.getState()
  const piso = ponto.piso ?? 0
  if (piso !== store.pisoAtivo) store.setPisoAtivo(piso)
  useAdventureStore.getState().goToPoint(null, { x: ponto.x, y: ponto.y })
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
      {escolhaDoJogo !== null && escolhaDoJogo.para === 'novo' ? (
        <EscolhaDoJogo />
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
 * A ESCOLHA DO JOGO (decisão 1 do editor de 21/11/2026): os 7 jogos do
 * registro, com o que cada um é. Escolher cria o desafio já montado para o
 * jogo; "Jogos" volta à lista sem criar nada.
 */
function EscolhaDoJogo() {
  const fechar = () => useDesafiosStore.getState().abrirEscolhaDoJogo(null)
  return (
    <SubFicha voltarPara="Jogos" onVoltar={fechar} icone={<IconeDosJogos />} titulo="Qual é o jogo?" tipo="Escolha primeiro: a ficha, o nome e o convite já vêm montados para ele.">
      <ul className="mg-lista">
        {ORDEM_DOS_JOGOS.map((jogo) => (
          <li key={jogo}>
            <button type="button" className="mg-linha" data-jogo={jogo} onClick={() => criarDesafio(jogo)}>
              <span className="mg-linha__med">
                <IconeDoJogo jogo={jogo} />
              </span>
              <span className="mg-linha__nome">{nomeDoJogo(jogo)}</span>
              <span className="mg-linha__seta">
                <Seta />
              </span>
              <span className="mg-linha__onde">{REGISTRO_DE_MINIGAMES[jogo].resumo}</span>
            </button>
          </li>
        ))}
      </ul>
    </SubFicha>
  )
}

/**
 * O NOME na ficha: o mestre escreve à vontade e o nome grava ao sair do campo
 * ou no Enter. Vazio volta ao nome automático (B10); gravar por tecla
 * comeria o espaço do fim enquanto ele digita.
 */
function CampoDoNome({ desafio }: { desafio: Desafio }) {
  const id = useId()
  const [rascunho, setRascunho] = useState<string | null>(null)
  const gravar = () => {
    if (rascunho === null) return
    setRascunho(null)
    useMapStore.getState().updateDesafio(desafio.id, { nome: rascunho })
  }
  return (
    <div className="gr-campo">
      <label className="gr-campo__rot" htmlFor={id}>
        Nome <small>{desafio.nomeProprio === true ? 'seu' : 'automático: segue o jogo e quem chama'}</small>
      </label>
      <input
        id={id}
        className="gr-entrada"
        type="text"
        autoComplete="off"
        maxLength={DESAFIO_NOME_MAX_LENGTH}
        value={rascunho ?? desafio.nome}
        onChange={(evento) => setRascunho(evento.currentTarget.value)}
        onBlur={gravar}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') gravar()
          if (evento.key === 'Escape') setRascunho(null)
        }}
      />
    </div>
  )
}

/** O "Tamanho" do selo anda de 10 em 10%, a régua da etiqueta da alça de canto no mapa (a mesma do papel). */
const PASSO_DO_TAMANHO_PCT = 10

interface PropsDaFicha {
  desafio: Desafio
  props: readonly Prop[]
  painel: MinigameControlsProps
  /** Há partida aberta deste desafio: a troca de jogo trava (B7). */
  emJogo: boolean
}

function FichaDoDesafio({ desafio, props, painel, emJogo }: PropsDaFicha) {
  const marcando = useDesafiosStore((estado) => estado.marcando)
  const cliqueForaDoObjeto = useDesafiosStore((estado) => estado.cliqueForaDoObjeto)
  // APAGAR PERGUNTA NO LUGAR (decisão 13, B15): "Apagar mesmo / Manter", sem janela.
  const [apagando, setApagando] = useState(false)
  const { abrir, marcar, pararDeMarcar } = useDesafiosStore.getState()
  const marcandoEste = marcando !== null && marcando.id === desafio.id ? marcando.modo : null
  const falta = faltaNoLugar(desafio, props)
  const gravar = useMapStore.getState().updateDesafio

  // Fechar a ficha (voltar, apagar, outra página) cancela o "Marcar no mapa" deste desafio.
  useEffect(
    () => () => {
      if (useDesafiosStore.getState().marcando?.id === desafio.id) useDesafiosStore.getState().pararDeMarcar()
    },
    [desafio.id],
  )
  // Esc cancela a marcação em curso.
  useEffect(() => {
    if (marcandoEste === null) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') useDesafiosStore.getState().pararDeMarcar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [marcandoEste])

  // Só os lugares que o jogo aceita: o puzzle não fica fora do mapa. Sem lugar, nenhuma opção marcada e a falta dita (B4).
  const lugaresDoJogo = REGISTRO_DE_MINIGAMES[desafio.minigame.jogo].lugares
  const opcoesDoLugar = OPCOES_DO_LUGAR.filter((opcao) => lugaresDoJogo.includes(opcao.valor))
  const escolherLugar = (tipo: TipoDoLugarDoDesafio) => {
    if (tipo === 'nenhum') {
      pararDeMarcar()
      // O piso do ponto de antes sai com o lugar (B30).
      if (desafio.lugar.tipo !== 'nenhum') gravar(desafio.id, { lugar: { tipo: 'nenhum' }, piso: undefined })
      return
    }
    marcar(desafio.id, tipo)
  }
  const apagar = () => {
    abrir(null)
    useMapStore.getState().removeDesafio(desafio.id)
  }

  return (
    <SubFicha voltarPara="Jogos" onVoltar={() => abrir(null)} icone={<IconeDoJogo jogo={desafio.minigame.jogo} />} titulo={desafio.nome} tipo={`Desafio de ${nomeDoJogoDoDesafio(desafio.minigame).toLowerCase()}`}>
      <CampoDoNome key={desafio.nome} desafio={desafio} />
      <div className="mg-onde">
        <CampoSeg rotulo="Onde fica" opcoes={opcoesDoLugar} valor={marcandoEste ?? desafio.lugar.tipo} onChange={escolherLugar} />
        {marcandoEste !== null ? (
          <>
            <Nota>{marcandoEste === 'ponto' ? 'Clique no mapa onde o jogo acontece.' : 'Clique no objeto do mapa onde o jogo acontece.'} Esc cancela.</Nota>
            {marcandoEste === 'objeto' && cliqueForaDoObjeto && (
              <p className="mg-erro" role="alert">
                Ali não há objeto. Clique em cima de uma mesa, um baú ou outro móvel do mapa.
              </p>
            )}
            <Acoes>
              <Botao variante="fantasma" tamanho="p" onClick={pararDeMarcar}>
                Cancelar
              </Botao>
            </Acoes>
          </>
        ) : (
          <>
            {desafio.lugar.tipo === 'nenhum' && falta !== null && (
              <p className="mg-erro" role="alert">
                Falta o lugar: o {nomeDoJogo(desafio.minigame.jogo).toLowerCase()} só existe com selo no mapa. Escolha um ponto ou um objeto.
              </p>
            )}
            <Nota>
              Fica {textoDoLugar(desafio, props, 'fora do mapa')}.{falta !== null && desafio.lugar.tipo !== 'nenhum' && ` ${falta}: escolha outro lugar.`}
              {desafio.lugar.tipo === 'nenhum' && falta === null && ' Sem selo: o jogador só vê o convite quando você chamar.'}
              {desafio.lugar.tipo === 'ponto' && ' No mapa: arraste o selo para mudar de lugar; os cantos mudam o tamanho, a bolinha gira e Delete tira do mapa.'}
              {desafio.lugar.tipo === 'objeto' && ' No mapa: os cantos do selo mudam o tamanho, a bolinha gira e Delete tira do mapa.'}
            </Nota>
            {desafio.lugar.tipo !== 'nenhum' && (
              <CampoFaixa
                rotulo="Tamanho"
                valor={Math.round(tamanhoDoSelo(desafio) * 100)}
                min={PIN_ESCALA_MIN * 100}
                max={PIN_ESCALA_MAX * 100}
                passo={PASSO_DO_TAMANHO_PCT}
                formatar={(pct) => `${pct}%`}
                // O deslizante inteiro é UM passo do Ctrl+Z (a chave junta as mudanças seguidas deste selo), como o do papel.
                onChange={(pct) => gravar(desafio.id, patchDoTamanhoDoSelo(desafio, pct / 100), `desafio-tamanho:${desafio.id}`)}
              />
            )}
            {desafio.lugar.tipo !== 'nenhum' && (
              <Acoes>
                <Botao variante="fantasma" tamanho="p" onClick={() => marcar(desafio.id, desafio.lugar.tipo === 'objeto' ? 'objeto' : 'ponto')}>
                  {desafio.lugar.tipo === 'objeto' ? 'Escolher outro objeto' : 'Marcar de novo'}
                </Botao>
                {falta === null && (
                  <Botao variante="fantasma" tamanho="p" onClick={() => irAoDesafio(desafio, props)}>
                    Mostrar no mapa
                  </Botao>
                )}
              </Acoes>
            )}
          </>
        )}
      </div>
      <MinigameControls key={desafio.id} {...painel} trocaTravada={emJogo ? 'Há uma partida aberta deste desafio: encerre-a antes de trocar o jogo.' : null} />
      {desafio.eraPino !== undefined && (
        <Nota>
          Veio do pino ▷{desafio.eraPino.nome ? ` “${desafio.eraPino.nome}”` : ''}. O pino saiu do mapa; o selo do desafio ficou no lugar dele.
        </Nota>
      )}
      <div className="mg-nota-pe">
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
      </div>
    </SubFicha>
  )
}
