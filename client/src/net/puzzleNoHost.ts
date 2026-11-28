import type { CarriedItem, Desafio, MapData, Token } from '../types/map'
import { avisosDosDocumentos, darDocumentos, linhaDoDocumento, tituloOuSemTitulo } from '../documentos/naFicha'
import type { Documento } from '../documentos/tipos'
import { aplicarAjuste } from '../lib/ajusteDaFicha'
import { itemParaAMochila } from '../lib/conteudoDoObjeto'
import { mapaComProgressoDoPuzzle, seloDoPonto } from '../lib/desafios'
import { mochilaComItemDoAcervo, type ItemParaDar } from '../lib/items'
import { fichaComMochila } from '../lib/mochila/juncao'
import type { Personagem } from '../lib/personagem'
import { mudarFichaNoMapa } from '../lib/prazoDaCondicao'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { moedasDe } from '../lib/troca'
import { recursoDeVida, vidaDoPersonagem } from '../lib/vidaDaFicha'
import { agirNoPuzzle, progressoInicial } from '../puzzles/motor'
import { TEXTO_DO_CASTIGO_PADRAO, TEXTO_DO_DESFECHO_PADRAO } from '../puzzles/padroes'
import { vistaDoPuzzle } from '../puzzles/recorte'
import type {
  AcaoNoPuzzle,
  CastigoQueAge,
  DesfechoDoPuzzle,
  EfeitoDoPuzzle,
  MinigamePuzzle,
  MotivoDaRecusa,
  PecaDoAcervo,
  PecaPosta,
  ProgressoDoPuzzle,
  QuemMexe,
  VistaDoPuzzle,
} from '../puzzles/tipos'
import type { CastigoDoPuzzleNoFio, ErroDoPuzzleNoFio, PremioDoPuzzleNoFio } from './protocoloDoPuzzle'

/**
 * PUZZLES NO HOST (plano dos puzzles, §2.2 a §2.4; fase P7): as contas puras
 * da ação de um jogador. A sessão (`hostSession.ts`) confere quem pediu (está
 * dentro, alcança, a ficha é dele, o `rev` é o de agora) e chama daqui; a
 * ponte (`hostBridge.ts` → `playerChanges.applyPuzzle`) grava o resultado no
 * mapa e nas fichas do mestre, fora do Ctrl+Z dele, como o baú.
 *
 * O motor é um só (`puzzles/motor.ts`): aqui só se lê a mochila de quem age
 * (a da FICHA DE PERSONAGEM; boneco sem ficha: a do boneco), e se leva cada
 * efeito à ficha certa:
 * - a peça sai da mochila ao encaixar (a mochila nova que o motor devolve);
 * - a peça de OUTRA pessoa que alguém tirou volta para a mochila de quem pôs;
 * - resolver entrega o desfecho a quem resolveu (itens, moedas, a porta
 *   ligada); as peças ficam presas no progresso;
 * - errar castiga só quem errou (PV pela ficha; o barulho só avisa o mestre).
 *
 * Tudo numa gravação só por ação (`AppliedPuzzle`): o mapa (progresso, porta,
 * mochila do boneco sem ficha) e as fichas que mudaram. Três aplicadores
 * seguidos perderiam as primeiras mudanças da ficha (o motivo escrito em
 * `minigames/desfecho.ts`).
 */

/** O nome de quem mexe, no teto que o leitor do progresso guarda (`puzzles/leitor.ts`). */
const NOME_DE_QUEM_MAX = 40
const NOME_DE_QUEM_PADRAO = 'Alguém'

export type DesafioDePuzzle = Desafio & { minigame: MinigamePuzzle }

export function ehDesafioDePuzzle(desafio: Desafio): desafio is DesafioDePuzzle {
  return desafio.minigame.jogo === 'puzzle'
}

/**
 * O desafio de puzzle `id` deste mapa; `null` = não existe, ou não é puzzle.
 * `id` pode ser o selo de um dos outros pontos da cooperação (`idDoSeloDoPonto`):
 * é o mesmo puzzle.
 */
export function desafioDePuzzleDoMapa(map: Pick<MapData, 'desafios'>, id: string): DesafioDePuzzle | null {
  const { desafioId } = seloDoPonto(id)
  const desafio = (map.desafios ?? []).find((d) => d.id === desafioId)
  return desafio !== undefined && ehDesafioDePuzzle(desafio) ? desafio : null
}

/** Quem está dentro de um puzzle agora: memória do host, por jogador. */
export interface PuzzleAberto {
  desafioId: string
  /** A cena do puzzle (`sceneKey` da sessão). */
  cena: string
  /** A ficha dele que entrou: é ela que alcança, põe, tira e recebe. */
  tokenId: string
  /** O puzzle como estava ao entrar (`assinaturaDoPuzzle`): mudou = o mestre editou a cópia. */
  assinatura: string
}

/**
 * O puzzle como o jogo o vê, para saber se o mestre mudou a cópia com alguém
 * dentro. Fica de fora só o nome do mestre (mudá-lo não muda nada na mesa).
 */
export function assinaturaDoPuzzle(minigame: MinigamePuzzle): string {
  const { nome: _soDoMestre, ...doJogo } = minigame.puzzle
  return JSON.stringify({ versao: minigame.versao, puzzle: doJogo })
}

/** O progresso de agora; ausente = ninguém mexeu. */
export function progressoDoDesafio(desafio: DesafioDePuzzle): ProgressoDoPuzzle {
  return desafio.progressoDoPuzzle ?? progressoInicial(desafio.minigame.puzzle)
}

/** A ficha de personagem do boneco; `null` = boneco sem ficha, ou ficha que não está na lista (mapa solto). */
export function fichaDoBoneco(token: Pick<Token, 'characterId'>, personagens: readonly Personagem[]): Personagem | null {
  const id = token.characterId
  return id === null ? null : (personagens.find((p) => p.id === id) ?? null)
}

/** A mochila que conta: a da ficha de personagem; sem ficha, a do boneco. */
export function mochilaQueConta(token: Pick<Token, 'mochila'>, ficha: Pick<Personagem, 'mochila'> | null): CarriedItem[] {
  return ficha !== null ? [...(ficha.mochila ?? [])] : [...(token.mochila ?? [])]
}

/** O documento da biblioteca do app pelo id; `null` = o mestre o apagou (ou não há biblioteca). */
export type DocumentoDaBiblioteca = (docId: string) => Documento | null

/**
 * O puzzle como o jogador da ficha `token` o vê (o recorte, por lista branca),
 * com a mochila dele. A dica por documento: "já leu" é ter a linha na lista da
 * FICHA que está dentro (é ela que leu, e é por ela que o "Ler" reabre); o
 * título é o da biblioteca de agora, como a leitura (uma correção do mestre vale).
 *
 * `naTela`: o selo pelo qual ele entrou (na cooperação, o ponto onde a ficha
 * está; a vista volta com esse id, que é o que a tela dele conhece) e a hora do
 * host (o que está aceso e quanto falta). Ausente = o selo do desafio, sem hora.
 */
export function vistaParaABoneco(desafio: DesafioDePuzzle, token: Token, personagens: readonly Personagem[], documentoDaBiblioteca: DocumentoDaBiblioteca, naTela?: { selo: string; agora: number }): VistaDoPuzzle {
  const ficha = fichaDoBoneco(token, personagens)
  const mochila = mochilaQueConta(token, ficha)
  const documentoDaDica = (docId: string): { titulo: string; podeLer: boolean } | null => {
    const documento = documentoDaBiblioteca(docId)
    if (documento === null) return null
    return { titulo: tituloOuSemTitulo(documento), podeLer: ficha !== null && linhaDoDocumento(ficha, docId) !== undefined }
  }
  const selo = naTela?.selo ?? desafio.id
  return vistaDoPuzzle({ desafioId: selo, puzzle: desafio.minigame.puzzle, progresso: progressoDoDesafio(desafio), mochila, documentoDaDica, agora: naTela?.agora, ponto: seloDoPonto(selo).ponto })
}

/** Quem mexe, como o progresso guarda: a ficha, o boneco e o nome que os colegas veem nele. */
export function quemEhOBoneco(token: Pick<Token, 'id' | 'name' | 'characterId'>): QuemMexe {
  const nome = token.name.trim().slice(0, NOME_DE_QUEM_MAX)
  return { personagemId: token.characterId, tokenId: token.id, nome: nome === '' ? NOME_DE_QUEM_PADRAO : nome }
}

// ------------------------------------------------------------------ o que vai ao mapa do mestre

/** O que o mestre lê no aviso. Ausente = nada a avisar (pôr e tirar, que ele vê ao vivo no painel). */
export interface AvisoDoPuzzle {
  desafioId: string
  /** `perdeu`: pôr ou tirar não avisam, mas uma peça não conseguiu voltar a quem a pôs. */
  tipo: 'resolveu' | 'errou' | 'trocou' | 'perdeu'
  /** "Lara resolveu Fonte do pátio" (o nome do jogador e o do mestre). */
  titulo: string
  /** "Levou Chave de latão.", o castigo, e o que não deu para entregar. */
  linhas: string[]
}

/** A ação validada, pronta para o mapa do mestre (`playerChanges.applyPuzzle`). */
export interface AppliedPuzzle {
  /** Cena de fundo; ausente = a aberta. */
  sceneId?: string
  desafioId: string
  progresso: ProgressoDoPuzzle
  /** As fichas de personagem que mudaram (mochila, bolsa, PV), inteiras. */
  personagens: Personagem[]
  /** Bonecos SEM ficha de personagem cuja mochila mudou, neste mapa. */
  mochilasDosBonecos: { tokenId: string; mochila: CarriedItem[] }[]
  /** A parede-porta ligada (`Desafio.portaLigada`) que destranca e abre: resolvido com "Abre a porta". */
  abrirPorta?: string
  aviso?: AvisoDoPuzzle
}

function comMochila(token: Token, mochila: readonly CarriedItem[]): Token {
  const { mochila: _antes, ...semMochila } = token
  return mochila.length > 0 ? { ...semMochila, mochila: [...mochila] } : semMochila
}

function mapaComPortaAberta(map: MapData, wallId: string): MapData {
  const door = map.walls.find((w) => w.id === wallId)?.door
  if (door === undefined || door === null || (door.open && !door.locked)) return map
  return { ...map, walls: map.walls.map((w) => (w.id === wallId ? { ...w, door: { ...door, open: true, locked: false } } : w)) }
}

/**
 * A ação no mapa (pura e reaplicável, para todo passo do desfazer da cena): o
 * progresso, a mochila dos bonecos sem ficha e a porta ligada aberta. Num passo
 * em que o desafio, o boneco ou a porta não existem, o resto vale.
 */
export function mapaComPuzzle(map: MapData, aplicado: Pick<AppliedPuzzle, 'desafioId' | 'progresso' | 'mochilasDosBonecos' | 'abrirPorta'>): MapData {
  const novo = mapaComMochilasDosBonecos(mapaComProgressoDoPuzzle(map, aplicado.desafioId, aplicado.progresso), aplicado.mochilasDosBonecos)
  return aplicado.abrirPorta === undefined ? novo : mapaComPortaAberta(novo, aplicado.abrirPorta)
}

/** A mochila nova de cada boneco sem ficha (pura e reaplicável: o boneco que não existe no passo fica como está). */
export function mapaComMochilasDosBonecos(map: MapData, mochilas: AppliedPuzzle['mochilasDosBonecos']): MapData {
  let novo = map
  for (const { tokenId, mochila } of mochilas) novo = mudarFichaNoMapa(novo, tokenId, (token) => comMochila(token, mochila))
  return novo
}

// ------------------------------------------------------------------ a ação

export interface PedidoNoPuzzle {
  desafio: DesafioDePuzzle
  /** O mapa da cena do puzzle (o do mestre). */
  map: MapData
  /** A ficha que age, no mapa do mestre. */
  token: Token
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg | null
  acao: AcaoNoPuzzle
  /** O nome do jogador, para o aviso do mestre. */
  nomeDoJogador: string
  agora: number
  novoId: () => string
  /** O item do acervo pelo id (a peça guardada da troca); `null` = não está no acervo. */
  pecaDoAcervo: (itemId: string) => PecaDoAcervo | null
  /** Os documentos do desfecho saem da biblioteca de agora (o título e o papel que vão à lista). */
  documentoDaBiblioteca: DocumentoDaBiblioteca
  /** Na cooperação: o ponto do selo pelo qual a ficha entrou (a sessão conferiu que ela o alcança). */
  ponto?: number
}

/** O que quem resolveu leva, e o que todos os que estão dentro leem. */
export interface ResolvidoNoHost {
  por: string
  modo: 'texto' | 'cena'
  texto: string
  abriuPorta: boolean
  /** O que QUEM AGIU ganhou; os outros que estão dentro não ganham nada. */
  premio: PremioDoPuzzleNoFio
}

export type ResultadoNoHost =
  | { ok: false; motivo: MotivoDaRecusa }
  | {
      ok: true
      aplicado: Omit<AppliedPuzzle, 'sceneId'>
      /** Só para quem errou. */
      castigo: { erro: ErroDoPuzzleNoFio; castigo: CastigoDoPuzzleNoFio } | null
      resolvido: ResolvidoNoHost | null
    }

/** O que a ação mudou nas fichas e nos bonecos, até virar o `AppliedPuzzle`. */
interface Livro {
  map: MapData
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg | null
  novoId: () => string
  /** As fichas que mudaram, pelo id. */
  fichas: Map<string, Personagem>
  /** As mochilas novas dos bonecos sem ficha, pelo id do boneco. */
  bonecos: Map<string, CarriedItem[]>
  /** O que não deu para entregar, para o aviso do mestre. */
  avisos: string[]
}

/** Para onde vai o que é dado a `quem`: a ficha dele, ou o boneco sem ficha. `null` = nenhum dos dois existe mais. */
type Destino = { tipo: 'ficha'; ficha: Personagem } | { tipo: 'boneco'; tokenId: string; mochila: CarriedItem[] }

function destinoDe(livro: Livro, quem: Pick<QuemMexe, 'personagemId' | 'tokenId'>): Destino | null {
  if (quem.personagemId !== null) {
    const ficha = livro.fichas.get(quem.personagemId) ?? livro.personagens.find((p) => p.id === quem.personagemId)
    if (ficha !== undefined) return { tipo: 'ficha', ficha }
  }
  const token = livro.map.tokens.find((t) => t.id === quem.tokenId)
  if (token === undefined) return null
  // A ficha ligada que está na lista já respondeu acima; aqui é o boneco que guarda a própria mochila.
  return { tipo: 'boneco', tokenId: token.id, mochila: livro.bonecos.get(token.id) ?? [...(token.mochila ?? [])] }
}

function mochilaDoDestino(destino: Destino): readonly CarriedItem[] {
  return destino.tipo === 'ficha' ? (destino.ficha.mochila ?? []) : destino.mochila
}

function gravarMochila(livro: Livro, destino: Destino, mochila: readonly CarriedItem[]): void {
  if (destino.tipo === 'ficha') livro.fichas.set(destino.ficha.id, fichaComMochila(destino.ficha, mochila, moedasDe(destino.ficha)))
  else livro.bonecos.set(destino.tokenId, [...mochila])
}

/** O id de antes, se ninguém na mochila o usa; senão, um novo. */
function idLivre(mochila: readonly CarriedItem[], preferido: string, novoId: () => string): string {
  return mochila.some((vaga) => vaga.id === preferido) ? novoId() : preferido
}

/**
 * Põe `quantidade` do item na mochila pela regra de pilha do acervo
 * (`mochilaComItemDoAcervo`). A pilha no teto não engole o que chega: ele abre
 * vaga própria, como no motor.
 */
function mochilaQueRecebeu(mochila: readonly CarriedItem[], item: ItemParaDar, quantidade: number, idDaVaga: string): CarriedItem[] {
  const recebeu = mochilaComItemDoAcervo(mochila, item, quantidade, idDaVaga)
  if (recebeu !== null && recebeu.entraram > 0) return recebeu.mochila
  const { quantidade: _daPilha, ...umaSo } = item
  return [...mochila, { ...umaSo, id: idDaVaga }]
}

/** A peça de outra pessoa volta para quem a pôs, igual (o id de antes, se estiver livre). */
function devolver(livro: Livro, para: QuemMexe, vaga: CarriedItem): void {
  const destino = destinoDe(livro, para)
  if (destino === null) {
    livro.avisos.push(`${vaga.nome} de ${para.nome} não voltou: a ficha não está mais nesta cena.`)
    return
  }
  const mochila = mochilaDoDestino(destino)
  const { id, ...item } = vaga
  gravarMochila(livro, destino, mochilaQueRecebeu(mochila, item, 1, idLivre(mochila, id, livro.novoId)))
}

/** As peças que o mestre devolve ao recomeçar um puzzle, prontas para gravar. */
export interface PecasDevolvidas {
  /** As fichas de personagem que receberam peças, inteiras. */
  personagens: Personagem[]
  /** Bonecos SEM ficha de personagem que receberam peças, neste mapa. */
  mochilasDosBonecos: { tokenId: string; mochila: CarriedItem[] }[]
  /** As peças que não voltaram: a ficha e o boneco de quem pôs não estão mais nesta cena. */
  avisos: string[]
}

/**
 * "Zerar progresso" e "Salvar a cópia deste lugar", do mestre: cada peça posta
 * (nos encaixes e na bandeja) volta a quem a pôs, pelo mesmo caminho da peça que
 * um jogador tira de outro (`devolver`): a ficha de personagem dele, ou o boneco
 * sem ficha; o id da vaga de antes, se ainda estiver livre. Pura.
 */
export function devolverPecasNoHost(entrada: { map: MapData; personagens: readonly Personagem[]; pecas: readonly PecaPosta[]; novoId: () => string }): PecasDevolvidas {
  const livro: Livro = { map: entrada.map, personagens: entrada.personagens, sistema: null, novoId: entrada.novoId, fichas: new Map(), bonecos: new Map(), avisos: [] }
  for (const peca of entrada.pecas) devolver(livro, peca.por, peca.vaga)
  return { personagens: [...livro.fichas.values()], mochilasDosBonecos: [...livro.bonecos].map(([tokenId, mochila]) => ({ tokenId, mochila })), avisos: livro.avisos }
}

/** O que os documentos do desfecho precisam para entrar na lista de quem resolveu. */
interface EntregaDeDocumentos {
  documentoDaBiblioteca: DocumentoDaBiblioteca
  /** O "de" da linha ("ganhou em Cofre do Capitão"): o título que o jogador vê; `undefined` = o puzzle sem título público. */
  de: string | undefined
  agora: number
}

/**
 * Os documentos do desfecho na lista da FICHA DE PERSONAGEM de quem resolveu,
 * com o "novo" (`darDocumento`, origem 'puzzle'). Devolve os títulos que
 * entraram agora; o que ele já tinha não entra de novo nem volta a ser novo.
 * Boneco sem ficha, documento apagado e lista cheia viram aviso do mestre.
 */
function entregarDocumentos(livro: Livro, destino: Destino, para: QuemMexe, docIds: readonly string[], entrega: EntregaDeDocumentos): string[] {
  const quantos = new Set(docIds).size
  if (quantos === 0) return []
  if (destino.tipo === 'boneco') {
    livro.avisos.push(`${para.nome} não tem ficha de personagem: ${quantos === 1 ? 'o documento do desfecho não foi guardado' : `os ${quantos} documentos do desfecho não foram guardados`}.`)
    return []
  }
  const dados = darDocumentos(destino.ficha, docIds, entrega.documentoDaBiblioteca, 'puzzle', entrega.de, entrega.agora)
  if (dados.personagem !== destino.ficha) livro.fichas.set(dados.personagem.id, dados.personagem)
  livro.avisos.push(...avisosDosDocumentos(dados, destino.ficha.nome))
  return dados.entraram
}

/** O desfecho de quem resolveu: os itens (como o baú), as moedas e os documentos (só com ficha) e a porta ligada. */
function entregar(livro: Livro, para: QuemMexe, desfecho: DesfechoDoPuzzle, entrega: EntregaDeDocumentos): PremioDoPuzzleNoFio {
  const premio: PremioDoPuzzleNoFio = { itens: [], moedas: 0, documentos: [] }
  let destino = destinoDe(livro, para)
  if (destino === null) {
    livro.avisos.push(`${para.nome} não está mais nesta cena: o desfecho não foi entregue.`)
    return premio
  }
  for (const { item, quantidade } of desfecho.itens) {
    const mochila = mochilaDoDestino(destino)
    const recebeu = mochilaComItemDoAcervo(mochila, itemParaAMochila(item), quantidade, livro.novoId())
    if (recebeu === null || recebeu.entraram === 0) continue
    gravarMochila(livro, destino, recebeu.mochila)
    destino = destinoDe(livro, para) ?? destino
    premio.itens.push({ nome: item.nome, quantidade: recebeu.entraram })
  }
  if (desfecho.moedas > 0) {
    if (destino.tipo === 'ficha') {
      livro.fichas.set(destino.ficha.id, fichaComMochila(destino.ficha, destino.ficha.mochila ?? [], moedasDe(destino.ficha) + desfecho.moedas))
      premio.moedas = desfecho.moedas
    } else livro.avisos.push(`${para.nome} não tem ficha de personagem: as ${desfecho.moedas} moedas não foram entregues.`)
  }
  // A ficha de agora (com os itens e as moedas já dentro): os documentos entram por cima dela.
  premio.documentos = entregarDocumentos(livro, destinoDe(livro, para) ?? destino, para, desfecho.documentos, entrega)
  return premio
}

/** O castigo de quem errou: PV pela ficha (o caminho do baú); o barulho só avisa o mestre. Devolve os PV que de fato saíram. */
function castigar(livro: Livro, para: QuemMexe, castigo: CastigoQueAge): number {
  if (castigo.tipo === 'barulho' || castigo.pv <= 0) return 0
  const destino = destinoDe(livro, para)
  const recurso = recursoDeVida(livro.sistema)
  const ficha = destino?.tipo === 'ficha' ? destino.ficha : null
  const vida = ficha === null || recurso === null ? null : vidaDoPersonagem(ficha, recurso)
  if (ficha === null || livro.sistema === null || recurso === null || vida === null) {
    livro.avisos.push(`${para.nome} não tem vida numa ficha de personagem: os ${castigo.pv} PV do castigo não foram tirados.`)
    return 0
  }
  const tirados = Math.min(castigo.pv, vida.atual)
  livro.fichas.set(ficha.id, aplicarAjuste(ficha, livro.sistema, { parte: 'recurso', chave: recurso.id, valor: vida.atual - castigo.pv }))
  return tirados
}

function textoDoCastigo(castigo: CastigoQueAge): string {
  const texto = castigo.texto.trim()
  return texto === '' ? TEXTO_DO_CASTIGO_PADRAO[castigo.tipo] : texto
}

/** A linha do castigo para o mestre ("Dano: −3 PV. Um choque sobe pelas mãos"). */
function linhaDoCastigo(castigo: CastigoDoPuzzleNoFio): string {
  switch (castigo.tipo) {
    case 'nada':
      return 'Sem castigo.'
    case 'barulho':
      return `Barulho: ${castigo.texto}`
    case 'dano':
    case 'armadilha': {
      const nome = castigo.tipo === 'dano' ? 'Dano' : 'Armadilha'
      return castigo.pv > 0 ? `${nome}: −${castigo.pv} PV. ${castigo.texto}` : `${nome}: ${castigo.texto}`
    }
  }
}

/**
 * A conta inteira de uma ação: o motor, e cada efeito na ficha certa. A sessão
 * já conferiu quem pede; o motor confere a ação (peça certa, encaixe ocupado,
 * vaga da mochila dele, resolvido).
 */
export function agirNoHost(pedido: PedidoNoPuzzle): ResultadoNoHost {
  const { desafio, token } = pedido
  const puzzle = desafio.minigame.puzzle
  const quem = quemEhOBoneco(token)
  const ficha = fichaDoBoneco(token, pedido.personagens)
  const resultado = agirNoPuzzle(puzzle, progressoDoDesafio(desafio), mochilaQueConta(token, ficha), pedido.acao, {
    quem,
    agora: pedido.agora,
    modo: 'jogo',
    pecaDoAcervo: pedido.pecaDoAcervo,
    novoId: pedido.novoId,
    ...(pedido.ponto === undefined ? {} : { ponto: pedido.ponto }),
  })
  const recusa = resultado.efeitos.find((efeito): efeito is Extract<EfeitoDoPuzzle, { tipo: 'recusado' }> => efeito.tipo === 'recusado')
  if (recusa !== undefined) return { ok: false, motivo: recusa.motivo }

  const livro: Livro = { map: pedido.map, personagens: pedido.personagens, sistema: pedido.sistema, novoId: pedido.novoId, fichas: new Map(), bonecos: new Map(), avisos: [] }
  // A mochila de quem agiu, como o motor a deixou: a peça saiu (ou a de antes voltou). Igual = a ficha não regrava.
  if (JSON.stringify(resultado.mochila) !== JSON.stringify(mochilaQueConta(token, ficha))) {
    gravarMochila(livro, ficha !== null ? { tipo: 'ficha', ficha } : { tipo: 'boneco', tokenId: token.id, mochila: [] }, resultado.mochila)
  }

  let erro: ErroDoPuzzleNoFio | null = null
  let castigo: CastigoDoPuzzleNoFio | null = null
  let premio: PremioDoPuzzleNoFio | null = null
  let abrirPorta: string | undefined
  let trocou: string | null = null
  for (const efeito of resultado.efeitos) {
    switch (efeito.tipo) {
      case 'devolver':
        devolver(livro, efeito.para, efeito.vaga)
        break
      case 'errou':
        erro = efeito.em === 'peso' ? { em: 'peso', soma: efeito.soma, pedido: efeito.pedido } : { em: efeito.em }
        castigo = { tipo: 'nada', texto: '', pv: 0 }
        break
      case 'castigar':
        castigo = { tipo: efeito.castigo.tipo, texto: textoDoCastigo(efeito.castigo), pv: castigar(livro, efeito.para, efeito.castigo) }
        break
      case 'entregar':
        premio = entregar(livro, efeito.para, efeito.desfecho, {
          documentoDaBiblioteca: pedido.documentoDaBiblioteca,
          de: puzzle.nomePublico.trim() === '' ? undefined : puzzle.nomePublico.trim(),
          agora: pedido.agora,
        })
        if (efeito.desfecho.abrePorta) {
          const porta = desafio.portaLigada
          if (porta !== undefined && pedido.map.walls.some((w) => w.id === porta && w.door !== null)) abrirPorta = porta
          else livro.avisos.push('A porta ligada a este puzzle não existe mais: nada abriu.')
        }
        break
      case 'trocou':
        trocou = pedido.pecaDoAcervo(efeito.guarda)?.nome ?? 'a peça guardada'
        break
      case 'resolveu':
      case 'juntou':
      case 'recusado':
        break
    }
  }

  const titulo = desafio.nome
  const desfecho = puzzle.desfecho
  const resolvido: ResolvidoNoHost | null =
    premio === null
      ? null
      : {
          por: quem.nome,
          modo: desfecho.modo,
          texto: desfecho.texto.trim() === '' ? TEXTO_DO_DESFECHO_PADRAO : desfecho.texto,
          abriuPorta: abrirPorta !== undefined,
          premio,
        }
  const aviso = avisoDaAcao(pedido.nomeDoJogador, desafio.id, titulo, { erro, castigo, resolvido, trocou, avisos: livro.avisos })
  const aplicado: Omit<AppliedPuzzle, 'sceneId'> = {
    desafioId: desafio.id,
    progresso: resultado.progresso,
    personagens: [...livro.fichas.values()],
    mochilasDosBonecos: [...livro.bonecos].map(([tokenId, mochila]) => ({ tokenId, mochila })),
    ...(abrirPorta === undefined ? {} : { abrirPorta }),
    ...(aviso === null ? {} : { aviso }),
  }
  return { ok: true, aplicado, castigo: erro === null || castigo === null ? null : { erro, castigo }, resolvido }
}

/** "Lara errou a combinação em Cofre do Capitão": o que errou, no aviso do mestre. */
const COMO_ERROU: Readonly<Record<Exclude<ErroDoPuzzleNoFio['em'], 'peso'>, string>> = {
  ordem: 'a ordem',
  combinacao: 'a combinação',
  hora: 'a hora',
  sequencia: 'a sequência',
  mistura: 'a mistura',
}

interface OQueAconteceu {
  erro: ErroDoPuzzleNoFio | null
  castigo: CastigoDoPuzzleNoFio | null
  resolvido: ResolvidoNoHost | null
  trocou: string | null
  avisos: string[]
}

/** "Chave de latão, 30 moedas e “Diário do capitão”" (a mesma frase do baú, `oQueLevou`). */
function textoDoPremio(premio: PremioDoPuzzleNoFio): string {
  const partes = premio.itens.map(({ nome, quantidade }) => (quantidade > 1 ? `${nome} ×${quantidade}` : nome))
  if (premio.moedas > 0) partes.push(premio.moedas === 1 ? '1 moeda' : `${premio.moedas} moedas`)
  for (const titulo of premio.documentos) partes.push(`“${titulo}”`)
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

/** O aviso do mestre: resolveu, errou ou trocou; pôr e tirar ele vê ao vivo, sem aviso (só o que não deu para devolver). */
function avisoDaAcao(nomeDoJogador: string, desafioId: string, titulo: string, o: OQueAconteceu): AvisoDoPuzzle | null {
  if (o.resolvido !== null) {
    const levou = textoDoPremio(o.resolvido.premio)
    const linhas = [levou === '' ? 'Não levou nada.' : `Levou ${levou}.`, ...(o.resolvido.abriuPorta ? ['A porta ligada abriu.'] : []), ...o.avisos]
    return { desafioId, tipo: 'resolveu', titulo: `${nomeDoJogador} resolveu ${titulo}`, linhas }
  }
  if (o.erro !== null && o.castigo !== null) {
    const como = o.erro.em === 'peso' ? `o peso (${o.erro.soma} de ${o.erro.pedido})` : COMO_ERROU[o.erro.em]
    return { desafioId, tipo: 'errou', titulo: `${nomeDoJogador} errou ${como} em ${titulo}`, linhas: [linhaDoCastigo(o.castigo), ...o.avisos] }
  }
  if (o.trocou !== null) return { desafioId, tipo: 'trocou', titulo: `${nomeDoJogador} fez a troca de peso em ${titulo}`, linhas: [`Levou ${o.trocou}.`, ...o.avisos] }
  return o.avisos.length === 0 ? null : { desafioId, tipo: 'perdeu', titulo: `${nomeDoJogador} mexeu em ${titulo}`, linhas: o.avisos }
}

// ------------------------------------------------------------------ ao vivo, para o mestre

/** Quem está dentro de cada puzzle agora (só quem está na sala), como a página Jogos do mestre lê. */
export interface PuzzleAoVivo {
  /** A cena (`MapData.id`). */
  mapaId: string
  desafioId: string
  dentro: { playerId: string; nome: string }[]
}
