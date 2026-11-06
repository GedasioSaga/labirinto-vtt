import { salvarSobreOAtual } from '../../lib/ajusteDaFicha'
import { ehRefDeMidia } from '../../lib/midia'
import { aplicar } from '../../lib/nuvem/aplicar'
import { lerMudanca, quemEscreveAMudanca } from '../../lib/nuvem/caminho'
import { caminhosSeSobrepoem } from '../../lib/nuvem/conflito'
import { diferencas } from '../../lib/nuvem/diferencas'
import { bytesDoJson } from '../../lib/nuvem/json'
import { tetoDaOpEmBytes } from '../../lib/nuvem/limites'
import type { Mudanca, Op } from '../../lib/nuvem/tipos'
import type { CartaoDaFicha, Personagem } from '../../lib/personagem'

/**
 * EMISSOR DO LOBBY (docs/planos/lobby-jogadores-2026-11-05.md §5.1, fatia
 * A4): a captura. Toda mudança de ficha de uma pasta PUBLICADA nasce aqui como
 * ops pequenas, por campo, e só por dois funis — `donoDosPersonagens().gravar`
 * no ramo da pasta (`stores/adventureStore.ts`) e `editarRpgDaPasta`
 * (`stores/rpgDaPasta.ts`). Carregar o `rpg.json` do disco nunca passa por
 * aqui, e `mudarRpgDaPasta` também não (senão a mesma mudança sairia duas vezes).
 *
 * Quem leva as ops para a fila no disco e para o servidor é o sincronizador
 * (fatia A5), que liga um destino por pasta publicada (`ligarEmissor`). Sem
 * destino a pasta não está publicada: nada é calculado e nada muda no app.
 *
 * A BASE CERTA (o erro mais grave dos desenhos): a op diz de que rev saiu a
 * ficha que o autor VIU (`baseRev`), para o servidor ver o conflito de quem
 * mexeu no mesmo campo depois. Ação na hora (ajuste, imagem, dano, Mundo do
 * Livro) vê a ficha de agora. A janela do mestre (`comBase`) e a edição do
 * jogador pela sala LAN (`comAutor` com a vista) viram a ficha antes: a marca
 * (`marcaDaBase`) é tirada quando a janela abre e quando a ficha é enviada ao
 * jogador. Na sala, só o caminho que mudou desde a ficha enviada sai com a
 * marca; o resto, com a base de agora (`baseRevPorCaminho`).
 *
 * Sem store e sem Tauri: o contexto do autor e o registro dos destinos são
 * estado do módulo; o resto é puro.
 */

// ── Destinos e marca da base ────────────────────────────────────────────────

/** A rev confirmada de cada pasta publicada num instante: a base de quem abriu a janela ou recebeu a ficha na sala. */
export type MarcaDaBase = ReadonlyMap<string, number>

/** O que o sincronizador (A5) liga para cada pasta publicada. */
export interface DestinoDoEmissor {
  /** Uma por instalação do app (§4.6). */
  readonly clienteId: string
  /** A rev confirmada pelo servidor que a ficha de agora já inclui: a `baseRev` da op que nasce agora. */
  revConfirmada(): number
  /**
   * A conta da sala é membro ATIVO da campanha (`membros`, §4.5)? Só ela vira
   * `autorDeclarado`: o servidor nega a op que declara quem não é membro
   * (§6.4), e só entra em `membros` quem tem e-mail. Fora dela (conta sem
   * e-mail, conta removida), a mudança da sala sai como do mestre.
   */
  ehMembro(contaId: string): boolean
  /** As ops que nasceram agora, já conferidas pelo esquema e pelos tetos, na ordem. Chamado depois de a mudança entrar no app. */
  receber(ops: readonly Op[]): void
}

const destinos = new Map<string, DestinoDoEmissor>()

const SEM_PASTA_PUBLICADA: MarcaDaBase = new Map()

/** Liga a pasta publicada ao destino e devolve o desligar (que só desliga se ainda for este destino). */
export function ligarEmissor(pastaId: string, destino: DestinoDoEmissor): () => void {
  destinos.set(pastaId, destino)
  return () => {
    if (destinos.get(pastaId) === destino) destinos.delete(pastaId)
  }
}

export function marcaDaBase(): MarcaDaBase {
  if (destinos.size === 0) return SEM_PASTA_PUBLICADA
  return new Map([...destinos].map(([pastaId, destino]): [string, number] => [pastaId, destino.revConfirmada()]))
}

// ── Quem mexeu e a base que viu ─────────────────────────────────────────────

/** O que o jogador da sala viu: a ficha que o host lhe enviou por último e a marca da nuvem de quando ela saiu (`hostSession.ts`). */
export interface VistaDaConexao {
  ficha: Personagem
  marca: MarcaDaBase
}

/** Quem mexeu pela sala LAN e, na edição, o que ele viu. */
export interface AutoriaDaMesa {
  /** A conta do jogador na sala. Ausente = jogador sem conta: só o mestre edita a ficha dele no Lobby (12.6), e a mudança sai como do mestre. */
  contaId?: string
  /**
   * A base da EDIÇÃO (a aba inteira que o jogador mandou). Ausente = a base é
   * a ficha de agora: o ajuste e a imagem calculam o valor novo sobre ela, e
   * uma marca velha faria o servidor contar como concorrente o que o jogador já viu.
   */
  vista?: VistaDaConexao
}

/** O que vale para as mudanças que nascem agora. Vazio = o mestre, sobre a ficha de agora. */
export interface OrigemDaMudanca {
  /** O jogador da sala LAN; o servidor só aceita do app e marca "atestado pelo app" (§6.4). */
  autorDeclarado?: string
  marca?: MarcaDaBase
  /**
   * A ficha que o autor viu (a da sala). O caminho que ninguém mudou desde ela
   * sai com a base de agora; só o que mudou depois sai com a `marca`. Ausente
   * = tudo com a `marca`.
   */
  vista?: Personagem
}

let origemDeAgora: OrigemDaMudanca = {}

function comOrigem<T>(origem: OrigemDaMudanca, fazer: () => T): T {
  const anterior = origemDeAgora
  origemDeAgora = origem
  try {
    return fazer()
  } finally {
    origemDeAgora = anterior
  }
}

function origemDaAutoria(autoria: AutoriaDaMesa): OrigemDaMudanca {
  const origem: OrigemDaMudanca = {}
  if (autoria.contaId !== undefined) origem.autorDeclarado = autoria.contaId
  if (autoria.vista !== undefined) {
    origem.marca = autoria.vista.marca
    origem.vista = autoria.vista.ficha
  }
  return origem
}

/**
 * Grava a mudança do jogador da sala LAN em nome dele: o que os funis
 * capturarem dentro de `fazer` (síncrono) sai com `autorDeclarado` (se a conta
 * é membro do Lobby) e, na edição, com a base que ele viu. Sem autoria, só roda.
 */
export function comAutor<T>(autoria: AutoriaDaMesa | undefined, fazer: () => T): T {
  if (autoria === undefined) return fazer()
  return comOrigem(origemDaAutoria(autoria), fazer)
}

/** O Salvar da janela do mestre: o que os funis capturarem dentro de `fazer` (síncrono) sai com a base de quando a janela abriu. */
export function comBase<T>(marca: MarcaDaBase, fazer: () => T): T {
  return comOrigem({ marca }, fazer)
}

/** A origem de agora, para o funil que só emite depois de um `await` (`editarRpgDaPasta`) guardá-la antes dele. */
export function origemAgora(): OrigemDaMudanca {
  return origemDeAgora
}

// ── As mudanças de uma pasta ────────────────────────────────────────────────

/** Só ficha de jogador que não é invocação sobe ao Lobby (§5.1): NPC não vaza nem gasta cota. */
export function vaiAoLobby(ficha: Personagem): boolean {
  return ficha.tipo === 'jogador' && ficha.combate?.invocadoNaCena === undefined
}

/** A imagem que viaja na op (Si7): a referência `midia:` ou nenhuma. */
function ehImagemDaNuvem(imagem: string | null): boolean {
  return imagem === null || ehRefDeMidia(imagem)
}

/** A ficha com cada imagem (retrato e cartões, em qualquer nível) passada por `trocar`; a mesma referência se nenhuma mudou. */
function comImagens(ficha: Personagem, trocar: (imagem: string | null, cartaoId?: string) => string | null): Personagem {
  const retrato = trocar(ficha.retrato)
  let mudou = retrato !== ficha.retrato
  const noCartao = (cartao: CartaoDaFicha): CartaoDaFicha => {
    const imagem = trocar(cartao.imagem, cartao.id)
    const subcartoes = cartao.subcartoes.map(noCartao)
    if (imagem === cartao.imagem && subcartoes.every((sub, i) => sub === cartao.subcartoes[i])) return cartao
    mudou = true
    return { ...cartao, imagem, subcartoes }
  }
  const abas = Object.fromEntries(Object.entries(ficha.abas).map(([aba, cartoes]): [string, CartaoDaFicha[]] => [aba, cartoes.map(noCartao)]))
  return mudou ? { ...ficha, retrato, abas } : ficha
}

function imagensDosCartoes(ficha: Personagem): Map<string, string | null> {
  const imagens = new Map<string, string | null>()
  const visitar = (cartao: CartaoDaFicha): void => {
    imagens.set(cartao.id, cartao.imagem)
    cartao.subcartoes.forEach(visitar)
  }
  for (const cartoes of Object.values(ficha.abas)) cartoes.forEach(visitar)
  return imagens
}

/** A ficha de antes como a nuvem a conhece: a foto embutida (data URL) ainda não virou mídia e não viaja na op. */
function semImagemEmbutida(ficha: Personagem): Personagem {
  return comImagens(ficha, (imagem) => (ehImagemDaNuvem(imagem) ? imagem : null))
}

/**
 * A ficha de depois com a foto embutida no lugar da de antes: a troca de
 * imagem só sai quando vira mídia, pelo `trocarImagensDosPersonagens`, que
 * passa pelo mesmo funil — e o cartão novo entra sem ela até lá.
 */
function imagensComoAntes(ficha: Personagem, antes: Personagem | null): Personagem {
  const deAntes = antes === null ? new Map<string, string | null>() : imagensDosCartoes(antes)
  return comImagens(ficha, (imagem, cartaoId) => {
    if (ehImagemDaNuvem(imagem)) return imagem
    if (cartaoId === undefined) return antes?.retrato ?? null
    return deAntes.get(cartaoId) ?? null
  })
}

/**
 * O que mudou entre as duas listas de personagens da pasta, em mudanças por
 * campo, TODAS (o app é o mestre: quem assina cada uma é `opsDoLote`). Ficha
 * que não vai ao Lobby conta como ausente: a troca de jogador para NPC vira
 * `apagar` de `[]`, e a de NPC para jogador, `criar`.
 */
export function mudancasDaPasta(antes: readonly Personagem[], depois: readonly Personagem[]): Mudanca[] {
  const porIdAntes = new Map(antes.map((ficha): [string, Personagem] => [ficha.id, ficha]))
  const porIdDepois = new Map(depois.map((ficha): [string, Personagem] => [ficha.id, ficha]))
  const ids = [...new Set([...porIdDepois.keys(), ...porIdAntes.keys()])]
  return ids.flatMap((id) => {
    const deAntes = porIdAntes.get(id)
    const deDepois = porIdDepois.get(id)
    if (deAntes === deDepois) return []
    const naNuvemAntes = deAntes !== undefined && vaiAoLobby(deAntes) ? semImagemEmbutida(deAntes) : null
    const naNuvemDepois = deDepois !== undefined && vaiAoLobby(deDepois) ? imagensComoAntes(deDepois, naNuvemAntes) : null
    return diferencas(naNuvemAntes, naNuvemDepois)
  })
}

// ── A emissão ───────────────────────────────────────────────────────────────

interface EnvelopeDoLote {
  clienteId: string
  quandoCliente: number
  /** O jogador da sala, já conferido como membro: assina só o que o jogador escreve. */
  autorDeclarado?: string
}

/**
 * Quem assina a mudança: o jogador declarado só no que o jogador escreve
 * (4.7). O caminho do mestre (retrato, imagem, cartão novo com imagem, a
 * ficha inteira) sai como do mestre — o app mudou de fato, e descartá-lo
 * deixaria a nuvem com o valor antigo para sempre.
 */
function autorDaMudanca(mudanca: Mudanca, autorDeclarado: string | undefined): string | undefined {
  return autorDeclarado !== undefined && quemEscreveAMudanca(mudanca) !== 'mestre' ? autorDeclarado : undefined
}

/**
 * As ops de um instante, na ordem das mudanças: um `loteId` por quem assina
 * (o jogador declarado e o mestre; o tudo-ou-nada é sempre do mestre e fica
 * inteiro), um `opId` para cada, a base de cada uma por `baseRevDe`.
 */
export function opsDoLote(mudancas: readonly Mudanca[], envelope: EnvelopeDoLote, baseRevDe: (mudanca: Mudanca) => number, novoId: () => string): Op[] {
  const loteDoMestre = novoId()
  const loteDoJogador = novoId()
  return mudancas.map((mudanca) => {
    const autor = autorDaMudanca(mudanca, envelope.autorDeclarado)
    const op: Op = {
      ...mudanca,
      baseRev: baseRevDe(mudanca),
      clienteId: envelope.clienteId,
      quandoCliente: envelope.quandoCliente,
      opId: novoId(),
      loteId: autor === undefined ? loteDoMestre : loteDoJogador,
    }
    if (autor !== undefined) op.autorDeclarado = autor
    return op
  })
}

/**
 * A base de cada mudança. Nunca à frente da de agora: a fila recusa base que
 * ainda não chegou. Com a ficha que o autor viu (`vista`), o caminho que
 * mudou desde ela sai com a marca — o servidor vê quem mexeu nele depois —, e
 * o resto com a de agora: a marca é a rev confirmada de quando a ficha saiu,
 * e a op do mestre que ainda esperava o servidor naquela hora (o jogador a
 * viu) contaria como concorrente. Outra ficha mudada no mesmo instante (as
 * variações) é consequência de agora. Sem vista, tudo com a marca.
 */
function baseRevPorCaminho(pastaId: string, origem: OrigemDaMudanca, antes: readonly Personagem[], revAgora: number): (mudanca: Mudanca) => number {
  const daMarca = Math.min(origem.marca?.get(pastaId) ?? revAgora, revAgora)
  const { vista } = origem
  if (vista === undefined) return () => daMarca
  const deAgora = antes.find((ficha) => ficha.id === vista.id)
  // A ficha vista já não está na lista: tudo mudou desde ela.
  const mudados = deAgora === undefined ? null : diferencas(vista, deAgora).map((mudanca) => mudanca.caminho)
  return (mudanca) => {
    if (mudanca.fichaId !== vista.id) return revAgora
    if (mudados === null || mudados.some((caminho) => caminhosSeSobrepoem(caminho, mudanca.caminho))) return daMarca
    return revAgora
  }
}

function novoIdDeOp(): string {
  return crypto.randomUUID()
}

/** As ops da mudança `antes` → `depois` da pasta, com a origem de agora. Vazio = nada a emitir. */
function opsDaOrigem(pastaId: string, destino: DestinoDoEmissor, antes: readonly Personagem[], depois: readonly Personagem[], origem: OrigemDaMudanca, agora: number): Op[] {
  const mudancas = mudancasDaPasta(antes, depois)
  if (mudancas.length === 0) return []
  const envelope: EnvelopeDoLote = { clienteId: destino.clienteId, quandoCliente: agora }
  const { autorDeclarado } = origem
  if (autorDeclarado !== undefined && destino.ehMembro(autorDeclarado)) envelope.autorDeclarado = autorDeclarado
  return opsDoLote(mudancas, envelope, baseRevPorCaminho(pastaId, origem, antes, destino.revConfirmada()), novoIdDeOp)
}

/** O primeiro motivo de recusa pelo mesmo esquema e pelos mesmos tetos do servidor (§5.6); `null` = todas passam. */
export function problemaNasOps(ops: readonly Op[]): string | null {
  for (const op of ops) {
    const lida = lerMudanca(op)
    if (!lida.ok) return lida.detalhe
    if (bytesDoJson(op) > tetoDaOpEmBytes(lida.lida.regra)) return 'Mudança grande demais para o Lobby'
  }
  return null
}

/** `problema` = o motivo cru (o esquema, o teto), para quem precisa de outra frase que não "ficou como estava". */
export type Emissao = { ok: true; entregar: () => void } | { ok: false; motivo: string; problema: string }

const NADA_A_EMITIR: Emissao = { ok: true, entregar: () => undefined }

/**
 * Prepara as ops de uma mudança da pasta, ANTES de ela entrar no app: a que o
 * Lobby recusaria (esquema, teto) volta com o motivo em português e não deve
 * entrar — a tela mostra o motivo e o valor anterior fica (§5.6). Passou: quem
 * chamou aplica a mudança e então chama `entregar`. Pasta não publicada: nada.
 */
export function prepararEmissao(pastaId: string, antes: readonly Personagem[], depois: readonly Personagem[], origem: OrigemDaMudanca = origemAgora(), agora = Date.now()): Emissao {
  const destino = destinos.get(pastaId)
  if (destino === undefined || antes === depois) return NADA_A_EMITIR
  const ops = opsDaOrigem(pastaId, destino, antes, depois, origem, agora)
  if (ops.length === 0) return NADA_A_EMITIR
  const problema = problemaNasOps(ops)
  if (problema !== null) return { ok: false, motivo: `O Lobby não aceita esta mudança (${problema}). A ficha ficou como estava.`, problema }
  return {
    ok: true,
    entregar: () => {
      // A pasta deixou de ser publicada entre preparar e entregar (o funil do disco espera a gravação): não há fila.
      if (destinos.get(pastaId) === destino) destino.receber(ops)
    },
  }
}

/**
 * A mudança de uma ficha pedida pela sala LAN, conferida pelo host ANTES de
 * responder ao jogador (§5.6): a que o Lobby recusaria volta com o motivo, e o
 * jogador recebe a recusa em vez de "salvo" — depois, o funil a recusaria
 * calado para ele. `null` = passa, ou nenhuma pasta está publicada. O host não
 * sabe de que pasta é a mesa: confere com o primeiro destino ligado (o esquema
 * e os tetos são os mesmos em todas). `antes` = `null` na ficha nova.
 */
export function problemaNaMesa(antes: Personagem | null, depois: Personagem, autoria: AutoriaDaMesa | undefined, agora = Date.now()): string | null {
  const primeiro = destinos.entries().next()
  if (primeiro.done === true) return null
  const [pastaId, destino] = primeiro.value
  const origem = autoria === undefined ? {} : origemDaAutoria(autoria)
  return problemaNasOps(opsDaOrigem(pastaId, destino, antes === null ? [] : [antes], [depois], origem, agora))
}

// ── Salvar sobre a ficha de agora pela base de quem editou ──────────────────

/**
 * As partes que o Salvar de hoje (`salvarSobreOAtual`, `aplicarPartes`) toma
 * inteiras do rascunho: nelas, o que outro mudou enquanto a edição estava
 * aberta voltaria atrás. Os números, a mochila, a bolsa, os cartões ligados,
 * os campos do mestre e a ficha Dragon Ball ele já junta campo a campo.
 */
const TOMADAS_DO_RASCUNHO: ReadonlySet<string> = new Set(['nome', 'descricao', 'retrato', 'escolhas', 'etiquetas', 'abas'])

/**
 * O Salvar de quem editou a partir de `base` (a janela do mestre, a edição do
 * jogador pela sala) sobre a ficha de AGORA, sem desfazer o que os outros
 * mudaram nesse meio-tempo (§5.1, §5.7): as mudanças deles desde a base que
 * não tocam no que o autor mudou voltam por cima de `juntado` (o Salvar de
 * hoje). Mesmo campo mudado nos dois lados: vale o do autor, e a op dele sai
 * com a base antiga — o servidor vê o conflito e o aviso aparece.
 *
 * O que vem dos outros passa por `aplicar` (o mesmo esquema da nuvem): o que
 * ele recusa (foto ainda embutida, texto acima do teto do Lobby) fica como no
 * Salvar de hoje.
 */
export function mesclarSemDesfazer(base: Personagem, rascunho: Personagem, atual: Personagem, juntado: Personagem): Personagem {
  if (atual === base || base.id !== atual.id || rascunho.id !== base.id) return juntado
  const doAutor = diferencas(base, rascunho)
  const dosOutros = diferencas(base, atual).filter(
    (outra) => TOMADAS_DO_RASCUNHO.has(outra.caminho[0] ?? '') && !doAutor.some((minha) => caminhosSeSobrepoem(minha.caminho, outra.caminho)),
  )
  if (dosOutros.length === 0) return juntado
  return aplicar(juntado, dosOutros).doc ?? juntado
}

/** O Salvar da janela do mestre: `base` = a ficha de quando a edição abriu, `atual` = a de agora. */
export function salvarPelaBase(base: Personagem, rascunho: Personagem, atual: Personagem): Personagem {
  return mesclarSemDesfazer(base, rascunho, atual, salvarSobreOAtual(base, rascunho, atual))
}
