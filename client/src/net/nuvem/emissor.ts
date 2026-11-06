import { salvarSobreOAtual } from '../../lib/ajusteDaFicha'
import { ehRefDeMidia } from '../../lib/midia'
import { aplicar } from '../../lib/nuvem/aplicar'
import { lerMudanca } from '../../lib/nuvem/caminho'
import { caminhosSeSobrepoem } from '../../lib/nuvem/conflito'
import { diferencas } from '../../lib/nuvem/diferencas'
import { bytesDoJson } from '../../lib/nuvem/json'
import { tetoDaOpEmBytes } from '../../lib/nuvem/limites'
import type { Mudanca, Op, Papel } from '../../lib/nuvem/tipos'
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
 * mexeu no mesmo campo depois. Ação na hora (ajuste, dano, Mundo do Livro) vê a
 * ficha de agora. A janela do mestre (`comBase`) e a edição do jogador pela
 * sala LAN (`comAutor`) viram a ficha antes: a marca (`marcaDaBase`) é tirada
 * quando a janela abre e quando a ficha é enviada ao jogador.
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

/** Quem mexeu pela sala LAN e a base que ele viu: a marca de quando a ficha foi enviada a ele (`hostSession.ts`). */
export interface AutoriaDaMesa {
  /** A conta do jogador na sala. Ausente = jogador sem conta: só o mestre edita a ficha dele no Lobby (12.6), e a mudança sai como do mestre. */
  contaId?: string
  marca: MarcaDaBase
}

/** O que vale para as mudanças que nascem agora. Vazio = o mestre, sobre a ficha de agora. */
export interface OrigemDaMudanca {
  /** O jogador da sala LAN; o servidor só aceita do app e marca "atestado pelo app" (§6.4). */
  autorDeclarado?: string
  marca?: MarcaDaBase
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

/**
 * Grava a edição do jogador da sala LAN em nome dele: o que os funis
 * capturarem dentro de `fazer` (síncrono) sai com `autorDeclarado` e com a
 * base que ele viu. Sem autoria, só roda.
 */
export function comAutor<T>(autoria: AutoriaDaMesa | undefined, fazer: () => T): T {
  if (autoria === undefined) return fazer()
  return comOrigem(autoria.contaId === undefined ? { marca: autoria.marca } : { autorDeclarado: autoria.contaId, marca: autoria.marca }, fazer)
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
 * campo. Ficha que não vai ao Lobby conta como ausente: a troca de jogador
 * para NPC vira `apagar` de `[]`, e a de NPC para jogador, `criar`. `jogador`
 * = só o que o jogador escreve (`diferencas`).
 */
export function mudancasDaPasta(antes: readonly Personagem[], depois: readonly Personagem[], papel: Papel): Mudanca[] {
  const porIdAntes = new Map(antes.map((ficha): [string, Personagem] => [ficha.id, ficha]))
  const porIdDepois = new Map(depois.map((ficha): [string, Personagem] => [ficha.id, ficha]))
  const ids = [...new Set([...porIdDepois.keys(), ...porIdAntes.keys()])]
  return ids.flatMap((id) => {
    const deAntes = porIdAntes.get(id)
    const deDepois = porIdDepois.get(id)
    if (deAntes === deDepois) return []
    const naNuvemAntes = deAntes !== undefined && vaiAoLobby(deAntes) ? semImagemEmbutida(deAntes) : null
    const naNuvemDepois = deDepois !== undefined && vaiAoLobby(deDepois) ? imagensComoAntes(deDepois, naNuvemAntes) : null
    return diferencas(naNuvemAntes, naNuvemDepois, { papel })
  })
}

// ── A emissão ───────────────────────────────────────────────────────────────

interface EnvelopeDoLote {
  baseRev: number
  clienteId: string
  quandoCliente: number
  autorDeclarado?: string
}

/** As ops de um instante: um `loteId` para todas, um `opId` para cada. */
export function opsDoLote(mudancas: readonly Mudanca[], envelope: EnvelopeDoLote, novoId: () => string): Op[] {
  const loteId = novoId()
  return mudancas.map((mudanca) => ({ ...mudanca, ...envelope, opId: novoId(), loteId }))
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

export type Emissao = { ok: true; entregar: () => void } | { ok: false; motivo: string }

const NADA_A_EMITIR: Emissao = { ok: true, entregar: () => undefined }

function novoIdDeOp(): string {
  return crypto.randomUUID()
}

/**
 * Prepara as ops de uma mudança da pasta, ANTES de ela entrar no app: a que o
 * Lobby recusaria (esquema, teto) volta com o motivo em português e não deve
 * entrar — a tela mostra o motivo e o valor anterior fica (§5.6). Passou: quem
 * chamou aplica a mudança e então chama `entregar`. Pasta não publicada: nada.
 */
export function prepararEmissao(pastaId: string, antes: readonly Personagem[], depois: readonly Personagem[], origem: OrigemDaMudanca = origemAgora(), agora = Date.now()): Emissao {
  const destino = destinos.get(pastaId)
  if (destino === undefined || antes === depois) return NADA_A_EMITIR
  const { autorDeclarado, marca } = origem
  const mudancas = mudancasDaPasta(antes, depois, autorDeclarado === undefined ? 'mestre' : 'jogador')
  if (mudancas.length === 0) return NADA_A_EMITIR
  const revAgora = destino.revConfirmada()
  // A base nunca à frente da de agora: a fila recusa base que ainda não chegou.
  const baseRev = Math.min(marca?.get(pastaId) ?? revAgora, revAgora)
  const envelope: EnvelopeDoLote = { baseRev, clienteId: destino.clienteId, quandoCliente: agora }
  if (autorDeclarado !== undefined) envelope.autorDeclarado = autorDeclarado
  const ops = opsDoLote(mudancas, envelope, novoIdDeOp)
  const problema = problemaNasOps(ops)
  if (problema !== null) return { ok: false, motivo: `O Lobby não aceita esta mudança (${problema}). A ficha ficou como estava.` }
  return {
    ok: true,
    entregar: () => {
      // A pasta deixou de ser publicada entre preparar e entregar (o funil do disco espera a gravação): não há fila.
      if (destinos.get(pastaId) === destino) destino.receber(ops)
    },
  }
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
