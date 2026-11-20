import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Botao } from '../grimorio/Botao'
import { classes, focaveisEm, movimentoReduzido, SAIDA_DO_DIALOGO_MS } from '../grimorio/comum'
import { desafiosDo, mapaComProgressoDoPuzzle } from '../../lib/desafios'
import { leverDoorOptions } from '../../lib/lever'
import { copiaSalva, mesmoPuzzle } from '../../puzzles/meusPuzzles'
import type { IdDaPecaDesenhada, ModeloDoPuzzle, Puzzle } from '../../puzzles/tipos'
import { lerOAcervoSeFaltar } from '../../stores/acervoDeItensStore'
import { useMapStore } from '../../stores/mapStore'
import { PUZZLE_SEM_NOME, useMeusPuzzlesStore } from '../../stores/meusPuzzlesStore'
import { BibliotecaDePecas } from './BibliotecaDePecas'
import { comEncaixeNovo, comModelo, comVisual, semEncaixe } from './edicao'
import { devolverAsPecas, useEditorDoPuzzleStore, type AlvoDoEditor } from './editorDoPuzzleStore'
import { SecaoCastigo, SecaoDesfecho, SecaoDica, type PortaDoEditor } from './FichaDoEditor/SecaoDesfecho'
import { comPecaNoEncaixe, SecaoEncaixes, SecaoMecanica } from './FichaDoEditor/SecaoEncaixes'
import { SecaoTroca } from './FichaDoEditor/SecaoTroca'
import { SecaoBasico, SecaoVisual } from './FichaDoEditor/SecaoVisual'
import { escolherFundoDoPuzzle, fundoDoPuzzleDoArquivo } from './imagemDoPuzzle'
import { garantirNoAcervo, usePecasDoEditor, type PecaDoEditor } from './pecasDoEditor'
import { QuadroDoEditor } from './QuadroDoEditor'
import { TestarComoJogador } from './TestarComoJogador'
import './editorDoPuzzle.css'

/**
 * O EDITOR DO PUZZLE em tela cheia, por cima do mapa (plano dos puzzles, §4
 * P6 e decisão 7; protótipo aprovado, aba "Editor do puzzle"). À esquerda a
 * ficha (básico, visual, mecânica, encaixes, troca, dica, desfecho, castigo);
 * à direita o quadro de verdade com os encaixes editáveis e a biblioteca de
 * peças. As mudanças ficam no editor (com Desfazer, Ctrl+Z) até salvar.
 *
 * As teclas não passam daqui: o mapa atrás não recebe Ctrl+Z, Delete nem setas.
 */

/** O Desfazer guarda até 40 passos (v2). */
const DESFAZER_MAX = 40

interface Edicao {
  alvo: AlvoDoEditor
  puzzle: Puzzle
  /** O puzzle como está salvo no alvo: a diferença é o "ainda não salvo". */
  base: Puzzle
  desfazer: Puzzle[]
  /** O campo do último passo: passos seguidos dele viram um só. */
  chave: string | null
  /** Só na cópia: a porta do mapa, salva junto. */
  porta: string | null
  portaBase: string | null
}

type Aviso = { texto: string; tipo: 'info' | 'error' } | null

function chaveDoAlvo(alvo: AlvoDoEditor): string {
  return alvo.tipo === 'copia' ? `copia:${alvo.desafioId}` : alvo.tipo === 'modelo' ? `modelo:${alvo.modeloId}` : 'rascunho'
}

/** O puzzle do alvo agora; `null` = sumiu (o desafio foi apagado, o modelo também). */
function lerAlvo(alvo: AlvoDoEditor): { puzzle: Puzzle; porta: string | null } | null {
  if (alvo.tipo === 'rascunho') return { puzzle: structuredClone(alvo.puzzle), porta: null }
  if (alvo.tipo === 'modelo') {
    const modelo = useMeusPuzzlesStore.getState().modelos.find((candidato) => candidato.id === alvo.modeloId)
    return modelo === undefined ? null : { puzzle: structuredClone(modelo.puzzle), porta: null }
  }
  const desafio = desafiosDo(useMapStore.getState().map).find((candidato) => candidato.id === alvo.desafioId)
  if (desafio === undefined || desafio.minigame.jogo !== 'puzzle') return null
  return { puzzle: structuredClone(desafio.minigame.puzzle), porta: desafio.portaLigada ?? null }
}

/** Monta o editor do alvo aberto (e o tira com a saída curta do diálogo). Vive na página Jogos. */
export function EditorDoPuzzleNaTela() {
  const alvo = useEditorDoPuzzleStore((estado) => estado.alvo)
  const [mostrado, setMostrado] = useState<AlvoDoEditor | null>(alvo)
  const [saindo, setSaindo] = useState(false)
  if (alvo !== null && alvo !== mostrado) {
    setMostrado(alvo)
    setSaindo(false)
  } else if (alvo === null && mostrado !== null && !saindo) {
    setSaindo(true)
  }
  useEffect(() => {
    if (!saindo) return
    const timer = window.setTimeout(
      () => {
        setMostrado(null)
        setSaindo(false)
      },
      movimentoReduzido() ? 0 : SAIDA_DO_DIALOGO_MS,
    )
    return () => window.clearTimeout(timer)
  }, [saindo])
  // Fechar a página Jogos (outra página do livro, outra cena) fecha o editor junto.
  useEffect(() => () => useEditorDoPuzzleStore.getState().fechar(), [])
  if (mostrado === null) return null
  return <EditorDoPuzzle key={chaveDoAlvo(mostrado)} alvo={mostrado} saindo={saindo} />
}

function EditorDoPuzzle({ alvo: alvoInicial, saindo }: { alvo: AlvoDoEditor; saindo: boolean }) {
  const tituloId = useId()
  const raiz = useRef<HTMLDivElement>(null)
  const [edicao, setEdicao] = useState<Edicao | null>(() => {
    const lido = lerAlvo(alvoInicial)
    return lido === null ? null : { alvo: alvoInicial, puzzle: lido.puzzle, base: lido.puzzle, desfazer: [], chave: null, porta: lido.porta, portaBase: lido.porta }
  })
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [pecaEscolhida, setPecaEscolhida] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [confirmarSair, setConfirmarSair] = useState(false)
  const [salvando, setSalvando] = useState(false)
  // "Testar como jogador" (P9): a tela do jogador por cima do editor, com o que está aqui agora.
  const [testando, setTestando] = useState(false)
  const testandoAgora = useRef(false)
  testandoAgora.current = testando
  const pecas = usePecasDoEditor()
  // Só paredes e salas: o resto do mapa (fichas andando na sessão) não redesenha o editor.
  const walls = useMapStore((estado) => estado.map.walls)
  const regions = useMapStore((estado) => estado.map.regions)
  const opcoesDePorta = useMemo(() => leverDoorOptions({ walls, regions }), [walls, regions])
  const titulo = useRef<HTMLHeadingElement>(null)

  // O foco entra no editor e, ao fechar, volta a quem o abriu (o "Abrir editor").
  useEffect(() => {
    const antes = document.activeElement
    titulo.current?.focus()
    lerOAcervoSeFaltar()
    return () => {
      if (antes instanceof HTMLElement && antes.isConnected) antes.focus()
    }
  }, [])

  // Rede de segurança: a tecla que nasce FORA do editor (o foco caiu no body
  // quando o encaixe focado saiu) não chega ao mapa atrás, e o Ctrl+Z e o Esc
  // continuam sendo do editor.
  const teclaDeFora = useRef<((evento: globalThis.KeyboardEvent) => void) | null>(null)
  useEffect(() => {
    const ouvir = (evento: globalThis.KeyboardEvent) => {
      // No teste, as teclas são da tela do jogador (o Esc volta ao editor por ela).
      if (testandoAgora.current) return
      const alvo = evento.target
      if (raiz.current === null || (alvo instanceof Node && raiz.current.contains(alvo))) return
      evento.stopPropagation()
      teclaDeFora.current?.(evento)
    }
    window.addEventListener('keydown', ouvir, true)
    return () => window.removeEventListener('keydown', ouvir, true)
  }, [])

  if (edicao === null) {
    return <EditorSemAlvo saindo={saindo} />
  }

  const { alvo, puzzle } = edicao
  const sujo = !mesmoPuzzle(puzzle, edicao.base) || edicao.porta !== edicao.portaBase
  const fechar = () => useEditorDoPuzzleStore.getState().fechar()
  const avisar = (texto: string, tipo: 'info' | 'error' = 'info') => setAviso({ texto, tipo })

  const mudar = (proximo: Puzzle | ((atual: Puzzle) => Puzzle), chave?: string) => {
    setConfirmarSair(false)
    setEdicao((antes) => {
      if (antes === null) return antes
      const novo = typeof proximo === 'function' ? proximo(antes.puzzle) : proximo
      if (novo === antes.puzzle) return antes
      const junta = chave !== undefined && chave === antes.chave
      return { ...antes, puzzle: novo, desfazer: junta ? antes.desfazer : [...antes.desfazer, antes.puzzle].slice(-DESFAZER_MAX), chave: chave ?? null }
    })
  }

  const desfazer = () => {
    const anterior = edicao.desfazer.at(-1)
    if (anterior === undefined) {
      avisar('Nada para desfazer.')
      return
    }
    // O encaixe que volta fica escolhido (Delete logo depois tira o mesmo); um que some sai da escolha.
    const atuais = new Set(puzzle.encaixes.map((encaixe) => encaixe.id))
    const voltou = anterior.encaixes.find((encaixe) => !atuais.has(encaixe.id))
    if (voltou !== undefined) setEscolhido(voltou.id)
    else if (escolhido !== null && !anterior.encaixes.some((encaixe) => encaixe.id === escolhido)) setEscolhido(null)
    setEdicao({ ...edicao, puzzle: anterior, desfazer: edicao.desfazer.slice(0, -1), chave: null })
    avisar('Desfeito.')
  }

  /** A peça escolhida pronta: a desenhada entra no acervo antes de virar a peça certa. */
  const usarPeca = async (peca: PecaDoEditor): Promise<string | null> => {
    try {
      return await garantirNoAcervo(peca)
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : String(erro), 'error')
      return null
    }
  }

  const pecaNoEncaixe = (encaixeId: string, peca: PecaDoEditor) => {
    const numero = puzzle.encaixes.findIndex((encaixe) => encaixe.id === encaixeId) + 1
    if (numero === 0) return
    setEscolhido(encaixeId)
    void usarPeca(peca).then((itemId) => {
      if (itemId === null) return
      mudar((atual) => comPecaNoEncaixe(atual, encaixeId, itemId))
      avisar(`${peca.nome} é a peça certa do encaixe ${numero}.`)
    })
  }

  const novoEncaixe = () => {
    const novo = comEncaixeNovo(puzzle)
    if (novo === null) {
      avisar('Já são 12 encaixes, o máximo de um puzzle.', 'error')
      return
    }
    mudar(novo.puzzle)
    setEscolhido(novo.id)
    avisar(`Encaixe ${novo.puzzle.encaixes.length} no meio do quadro. Arraste para o lugar e escolha a peça certa.`)
    requestAnimationFrame(() => {
      const botao = raiz.current?.querySelector(`[data-enc-ed="${novo.id}"]`)
      if (botao instanceof HTMLElement) botao.focus()
    })
  }

  const tirarEncaixe = (encaixeId: string) => {
    const numero = puzzle.encaixes.findIndex((encaixe) => encaixe.id === encaixeId) + 1
    if (numero === 0) return
    mudar(semEncaixe(puzzle, encaixeId))
    setEscolhido(null)
    avisar(`Encaixe ${numero} tirado. Desfazer (Ctrl+Z) traz de volta.`)
    // O botão focado sumiu: o foco fica no editor, para o Ctrl+Z seguinte ser dele.
    requestAnimationFrame(() => {
      const caixa = raiz.current
      if (caixa !== null && !caixa.contains(document.activeElement)) caixa.focus({ preventScroll: true })
    })
  }

  const usarModelo = (modelo: ModeloDoPuzzle) => {
    const ligadas: Partial<Record<IdDaPecaDesenhada, string>> = {}
    for (const peca of pecas.biblioteca) if (peca.desenhada !== null && peca.noAcervo) ligadas[peca.desenhada] = peca.itemId
    mudar(comModelo(puzzle, modelo, ligadas))
    setEscolhido(null)
    avisar('Modelo aplicado. Desfazer volta ao que estava.')
  }

  const usarImagem = async (pegar: () => Promise<string | null>) => {
    try {
      const imagem = await pegar()
      if (imagem === null) return
      mudar((atual) => comVisual(atual, { tipo: 'imagem', imagem }))
      avisar('Imagem própria no fundo. Agora arraste os encaixes sobre ela.')
    } catch (erro) {
      avisar(`Não deu para usar a imagem: ${erro instanceof Error ? erro.message : String(erro)}.`, 'error')
    }
  }

  const salvar = async (como: 'copia' | 'modelo' | 'novo') => {
    if (puzzle.nome.trim() === '') {
      avisar(PUZZLE_SEM_NOME, 'error')
      return
    }
    setSalvando(true)
    try {
      if (como === 'copia' && alvo.tipo === 'copia') {
        await salvarCopia(alvo.desafioId)
      } else if (como === 'modelo' && alvo.tipo === 'modelo') {
        const modelo = await useMeusPuzzlesStore.getState().salvarNoModelo(alvo.modeloId, puzzle)
        setEdicao((antes) => (antes === null ? antes : { ...antes, puzzle: modelo.puzzle, base: modelo.puzzle, chave: null }))
        avisar('Modelo salvo. As cópias que já estão nos lugares não mudam.')
      } else {
        const modelo = await useMeusPuzzlesStore.getState().salvarComoNovo(puzzle)
        // A cópia continua a do lugar; o rascunho vira o modelo que acabou de nascer.
        setEdicao((antes) => (antes === null ? antes : antes.alvo.tipo === 'copia' ? antes : { ...antes, alvo: { tipo: 'modelo', modeloId: modelo.id }, puzzle: modelo.puzzle, base: modelo.puzzle, chave: null }))
        avisar(`“${modelo.puzzle.nome}” guardado em Meus puzzles.`)
      }
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : String(erro), 'error')
    } finally {
      setSalvando(false)
    }
  }

  /** "Salvar a cópia deste lugar": a configuração pelo patch (Ctrl+Z do mestre), o progresso recomeçado fora dele. */
  const salvarCopia = async (desafioId: string) => {
    const loja = useMapStore.getState()
    const desafio = desafiosDo(loja.map).find((candidato) => candidato.id === desafioId)
    if (desafio === undefined || desafio.minigame.jogo !== 'puzzle') throw new Error('Esse lugar não existe mais neste mapa. Use “Salvar como novo em Meus puzzles”.')
    const portaMudou = edicao.porta !== edicao.portaBase
    if (mesmoPuzzle(puzzle, edicao.base)) {
      if (portaMudou) loja.updateDesafio(desafioId, { portaLigada: edicao.porta ?? undefined })
    } else {
      const salva = copiaSalva(desafio.minigame, puzzle, desafio.progressoDoPuzzle)
      // As peças postas voltam a quem pôs ANTES de o progresso recomeçar (a P7 liga a devolução).
      await devolverAsPecas(desafioId, salva.devolver)
      loja.updateDesafio(desafioId, portaMudou ? { minigame: salva.minigame, portaLigada: edicao.porta ?? undefined } : { minigame: salva.minigame })
      loja.applyPlayerChange((map) => mapaComProgressoDoPuzzle(map, desafioId, salva.progresso))
      setEdicao((antes) => (antes === null ? antes : { ...antes, puzzle: salva.minigame.puzzle, base: salva.minigame.puzzle, portaBase: antes.porta, chave: null }))
    }
    setEdicao((antes) => (antes === null ? antes : { ...antes, portaBase: antes.porta }))
    avisar('Cópia salva neste lugar. O puzzle recomeça daqui, e o modelo continua igual.')
  }

  const pedirFechar = () => {
    if (sujo && !confirmarSair) {
      setConfirmarSair(true)
      avisar('Há mudanças ainda não salvas. Aperte de novo para sair sem salvar.', 'error')
      return
    }
    fechar()
  }

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    // O mapa atrás não ouve nada do editor (a tecla para no portal, antes da janela).
    evento.stopPropagation()
    const alvoDaTecla = evento.target instanceof HTMLElement ? evento.target : null
    const emCampo = alvoDaTecla?.closest('input, textarea, select, [contenteditable="true"]') != null
    if ((evento.ctrlKey || evento.metaKey) && !evento.shiftKey && evento.key.toLowerCase() === 'z' && !emCampo) {
      evento.preventDefault()
      desfazer()
    } else if (evento.key === 'Escape' && !evento.defaultPrevented) {
      evento.preventDefault()
      pedirFechar()
    } else if (evento.key === 'Tab' && raiz.current !== null) {
      prenderOFoco(evento, raiz.current)
    }
  }
  // Lido pelo ouvinte da janela (efeito acima) só na hora da tecla: sempre o desfazer e o fechar desta renderização.
  teclaDeFora.current = (evento) => {
    if ((evento.ctrlKey || evento.metaKey) && !evento.shiftKey && evento.key.toLowerCase() === 'z') {
      evento.preventDefault()
      desfazer()
    } else if (evento.key === 'Escape') {
      evento.preventDefault()
      pedirFechar()
    }
    raiz.current?.focus({ preventScroll: true })
  }

  const numeroEscolhido = puzzle.encaixes.findIndex((encaixe) => encaixe.id === escolhido) + 1
  const nomeDaPorta = alvo.tipo === 'copia' && edicao.porta !== null ? (opcoesDePorta.find((opcao) => opcao.id === edicao.porta)?.label ?? null) : null
  const porta: PortaDoEditor | null =
    alvo.tipo === 'copia'
      ? { valor: edicao.porta, opcoes: opcoesDePorta, onChange: (wallId) => setEdicao((antes) => (antes === null ? antes : { ...antes, porta: wallId })) }
      : null

  return (
    <>
      {createPortal(
        <div ref={raiz} className={classes('pze', saindo && 'is-saindo')} role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1} onKeyDown={teclar}>
          <div className="pze__janela">
            <header className="pze-cab">
              <div className="pze-cab__titulo">
                <h2 ref={titulo} id={tituloId} tabIndex={-1}>
                  {puzzle.nome.trim() === '' ? 'Puzzle sem nome' : puzzle.nome}
                </h2>
                <p>
                  <span className={classes('pze-alvo', alvo.tipo === 'copia' && 'pze-alvo--copia')}>{textoDoAlvo(alvo)}</span>
                  <span className={classes('pze-sujo', sujo && 'is-sujo')}>{sujo ? 'Mudanças só no editor, ainda não salvas' : 'Tudo salvo'}</span>
                </p>
              </div>
              <div className="pze-cab__acoes">
                <Botao tamanho="p" disabled={edicao.desfazer.length === 0} title="Desfazer (Ctrl+Z)" onClick={desfazer}>
                  Desfazer
                </Botao>
                <Botao variante="latao" tamanho="p" title="Jogar o que está no editor, sem entregar nada a ninguém" onClick={() => setTestando(true)}>
                  Testar como jogador
                </Botao>
                {alvo.tipo === 'copia' && (
                  <Botao variante="primario" tamanho="p" disabled={!sujo || salvando} onClick={() => void salvar('copia')}>
                    Salvar a cópia deste lugar
                  </Botao>
                )}
                {alvo.tipo === 'modelo' && (
                  <Botao variante="primario" tamanho="p" disabled={!sujo || salvando} onClick={() => void salvar('modelo')}>
                    Salvar no modelo
                  </Botao>
                )}
                <Botao variante={alvo.tipo === 'rascunho' ? 'primario' : 'latao'} tamanho="p" disabled={salvando} onClick={() => void salvar('novo')}>
                  {alvo.tipo === 'rascunho' ? 'Salvar nos meus puzzles' : 'Salvar como novo em Meus puzzles'}
                </Botao>
                <Botao variante={confirmarSair ? 'perigo' : 'fantasma'} tamanho="p" onClick={pedirFechar} onBlur={() => setConfirmarSair(false)}>
                  {confirmarSair ? 'Sair sem salvar?' : 'Fechar'}
                </Botao>
              </div>
            </header>
            <p className={classes('pze-aviso', aviso?.tipo === 'error' && 'pze-aviso--perigo')} role="status" aria-live="polite">
              {aviso?.texto ?? 'Arraste os encaixes no quadro. Teclado: setas movem, + e − mudam o tamanho, Delete tira, Ctrl+Z desfaz.'}
            </p>
            <div className="pze-corpo">
              <div className="pze-ficha-col">
                <SecaoBasico puzzle={puzzle} mudar={mudar} />
                <SecaoVisual puzzle={puzzle} mudar={mudar} onModelo={usarModelo} onImagem={() => void usarImagem(escolherFundoDoPuzzle)} />
                <SecaoMecanica puzzle={puzzle} mudar={mudar} />
                <SecaoEncaixes puzzle={puzzle} mudar={mudar} pecas={pecas} escolhido={escolhido} onEscolher={setEscolhido} onTirar={tirarEncaixe} usarPeca={usarPeca} />
                <SecaoTroca puzzle={puzzle} mudar={mudar} pecas={pecas} usarPeca={usarPeca} />
                <SecaoDica puzzle={puzzle} mudar={mudar} />
                <SecaoDesfecho puzzle={puzzle} mudar={mudar} porta={porta} />
                <SecaoCastigo puzzle={puzzle} mudar={mudar} />
              </div>
              <div className="pze-palco">
                <QuadroDoEditor
                  puzzle={puzzle}
                  escolhido={escolhido}
                  pecas={pecas}
                  onEscolher={setEscolhido}
                  onMudar={mudar}
                  onTirar={tirarEncaixe}
                  onImagemSolta={(arquivo) => void usarImagem(() => fundoDoPuzzleDoArquivo(arquivo))}
                />
                <div className="pze-barra">
                  <Botao variante="latao" tamanho="p" onClick={novoEncaixe}>
                    + Adicionar encaixe
                  </Botao>
                  <Botao tamanho="p" disabled={numeroEscolhido === 0} title={numeroEscolhido === 0 ? 'Escolha um encaixe no quadro' : undefined} onClick={() => escolhido !== null && tirarEncaixe(escolhido)}>
                    {numeroEscolhido === 0 ? 'Tirar o encaixe' : `Tirar o encaixe ${numeroEscolhido}`}
                  </Botao>
                  <span className="pze-nota">Arraste para mover; a alça do canto muda o tamanho.</span>
                </div>
                <BibliotecaDePecas
                  pecas={pecas}
                  selecionada={pecaEscolhida}
                  onSelecionar={setPecaEscolhida}
                  encaixe={escolhido !== null && numeroEscolhido > 0 ? { id: escolhido, numero: numeroEscolhido } : null}
                  onPecaNoEncaixe={pecaNoEncaixe}
                  onAviso={avisar}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {testando && <TestarComoJogador puzzle={puzzle} porta={nomeDaPorta} onVoltar={() => setTestando(false)} />}
    </>
  )
}

function textoDoAlvo(alvo: AlvoDoEditor): string {
  if (alvo.tipo === 'copia') return 'Cópia deste lugar: o modelo não muda'
  if (alvo.tipo === 'modelo') return 'Modelo de Meus puzzles'
  return 'Rascunho novo'
}

/** O Tab dá a volta dentro do editor: atrás dele só há o mapa, que não é para mexer agora. */
function prenderOFoco(evento: KeyboardEvent<HTMLDivElement>, raiz: HTMLElement): void {
  const focaveis = focaveisEm(raiz)
  const primeiro = focaveis[0]
  const ultimo = focaveis.at(-1)
  if (primeiro === undefined || ultimo === undefined) return
  if (evento.shiftKey && document.activeElement === primeiro) {
    evento.preventDefault()
    ultimo.focus()
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault()
    primeiro.focus()
  }
}

/** O alvo sumiu entre abrir e montar (o desafio apagado, o modelo também). */
function EditorSemAlvo({ saindo }: { saindo: boolean }) {
  return createPortal(
    <div className={classes('pze', saindo && 'is-saindo')} role="alertdialog" aria-modal="true" aria-label="Editor do puzzle">
      <div className="pze__janela pze__janela--vazia">
        <p>Este puzzle não existe mais: o lugar ou o modelo foi apagado.</p>
        <Botao variante="primario" onClick={() => useEditorDoPuzzleStore.getState().fechar()}>
          Fechar
        </Botao>
      </div>
    </div>,
    document.body,
  )
}
