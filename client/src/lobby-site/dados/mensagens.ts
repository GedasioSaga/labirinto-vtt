import { lerMudanca, segmentoValido } from '../../lib/nuvem/caminho'
import { lerRegistro } from '../../lib/nuvem/fila'
import { ehJson, ehRegistro, lerJsonSeguro, proprio } from '../../lib/nuvem/json'
import { CATALOGOS_DO_LIVRO, type ChaveDoCatalogo, type ResumoDoLivro } from '../../lib/livroDeRegras'
import { lerEnvelope } from '../../lib/nuvem/lote'
import { sistemaParaOJogador } from '../../lib/nuvem/projecao'
import { parseLivroParte, parseLivroRecusa } from '../../net/protocoloDoLivro'
import type { FichaNoEstado, MembroProjetado, MensagemDoServidor, OpGravada, Origem, Papel, PresencaNaMesa, Visibilidade } from '../../lib/nuvem/tipos'
import { personagemDoArquivo } from '../../lib/personagem'
import { ehIdDeMidia } from '../../lib/midia'
import type { MotivoDoVerComo } from '../../lib/nuvem/verComo'
import type { EnderecoDaMesa, EstadoComSala, MensagemDoSite, MensagemDoVerComoNoSite, SalaDaMesa } from './fonte'
import { lerFrameDoChat } from './fioDoChat'
import { enderecoDaMesaValido } from './rotas'
import { lerFrameDoDuelo } from './fioDoDuelo'
import { lerFrameDoMural } from './fioDoMural'

/**
 * LEITURA DO FIO (§5.4): o que chega do servidor é conferido aqui antes de
 * tocar na fila ou na tela, como qualquer entrada de fora. `null` = fora do
 * formato. Uma lista com um item torto vale como torta inteira: deixar o item
 * de fora faria a base local divergir da do servidor sem ninguém ver.
 */

function ehRev(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

function ehPapel(valor: unknown): valor is Papel {
  return valor === 'mestre' || valor === 'jogador'
}

function ehVisibilidade(valor: unknown): valor is Visibilidade {
  return valor === 'mesa' || valor === 'treino' || valor === 'mestre'
}

function ehOrigem(valor: unknown): valor is Origem {
  return valor === 'app' || valor === 'site' || valor === 'mesa'
}

/** Cada item pela leitura; um torto = a lista inteira torta. */
function lerLista<T>(bruto: unknown, ler: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(bruto)) return null
  const itens: readonly unknown[] = bruto
  const lidos: T[] = []
  for (const item of itens) {
    const lido = ler(item)
    if (lido === null) return null
    lidos.push(lido)
  }
  return lidos
}

function lerMembro(bruto: unknown): MembroProjetado | null {
  if (!ehRegistro(bruto)) return null
  const contaId = proprio(bruto, 'contaId')
  const nome = proprio(bruto, 'nome')
  const papel = proprio(bruto, 'papel')
  if (typeof contaId !== 'string' || typeof nome !== 'string' || !ehPapel(papel)) return null
  // A foto de perfil (07/11/2026) é opcional: o DO de antes não manda; `null` ou fora da forma do id = a inicial,
  // nunca o membro (nem o `estado` inteiro) recusado por causa dela.
  const foto = proprio(bruto, 'foto')
  return ehIdDeMidia(foto) ? { contaId, nome, papel, foto } : { contaId, nome, papel }
}

function lerPresenca(bruto: unknown): PresencaNaMesa | null {
  const membro = lerMembro(bruto)
  const onde = ehRegistro(bruto) ? proprio(bruto, 'onde') : undefined
  return membro !== null && (onde === 'site' || onde === 'app') ? { ...membro, onde } : null
}

function lerFichaNoEstado(bruto: unknown): FichaNoEstado | null {
  if (!ehRegistro(bruto)) return null
  const doc = personagemDoArquivo(proprio(bruto, 'doc'))
  const visivel = proprio(bruto, 'visivel')
  const rev = proprio(bruto, 'rev')
  const ehMinha = proprio(bruto, 'ehMinha')
  const nomeDoDono = proprio(bruto, 'nomeDoDono')
  if (doc === null || !ehVisibilidade(visivel) || !ehRev(rev) || typeof ehMinha !== 'boolean') return null
  if (nomeDoDono !== null && typeof nomeDoDono !== 'string') return null
  return { doc, visivel, rev, ehMinha, nomeDoDono }
}

/** A op gravada: o envelope e a mudança pelo mesmo esquema do servidor, mais o carimbo dele. */
export function lerOpGravada(bruto: unknown): OpGravada | null {
  if (!ehRegistro(bruto)) return null
  const envelope = lerEnvelope(bruto)
  const lida = lerMudanca(bruto)
  if (!envelope.ok || !lida.ok) return null
  const rev = proprio(bruto, 'rev')
  const autorContaId = proprio(bruto, 'autorContaId')
  const autorNome = proprio(bruto, 'autorNome')
  const origem = proprio(bruto, 'origem')
  const atestadoPeloApp = proprio(bruto, 'atestadoPeloApp')
  const quando = proprio(bruto, 'quando')
  const antes = proprio(bruto, 'antes')
  if (!ehRev(rev) || rev === 0 || typeof autorContaId !== 'string' || typeof autorNome !== 'string' || !ehOrigem(origem)) return null
  if (typeof atestadoPeloApp !== 'boolean' || typeof quando !== 'number' || !Number.isFinite(quando)) return null
  if (antes !== undefined && !ehJson(antes)) return null
  const op: OpGravada = { ...envelope.envelope, ...lida.mudanca, rev, autorContaId, autorNome, origem, atestadoPeloApp, quando }
  if (antes !== undefined) op.antes = antes
  return op
}

function lerEnderecoDaMesa(bruto: unknown): EnderecoDaMesa | null {
  if (!ehRegistro(bruto)) return null
  const tipo = proprio(bruto, 'tipo')
  const url = proprio(bruto, 'url')
  if ((tipo !== 'lan' && tipo !== 'tunel') || typeof url !== 'string') return null
  const endereco: EnderecoDaMesa = { tipo, url }
  return enderecoDaMesaValido(endereco) ? endereco : null
}

/** A mesma forma do código no DO e no bilhete (o app sorteia 6 de `A-Z2-9`; aceita até 16). */
const FORMA_DO_CODIGO_DA_SALA = /^[A-Za-z0-9]{1,16}$/

/**
 * A sala aberta no app (B6), do `estado`, do frame `sala` e da resposta do
 * convite. Ao contrário da base, sala torta NÃO derruba o canal (não há base
 * a divergir, e derrubar repetiria em cada `estado`): vale como "nenhuma
 * sala", e o botão não aparece. Endereço fora da forma exata fica de fora;
 * sem endereço que sobre, também não há sala.
 */
export function lerSalaDaMesa(bruto: unknown): SalaDaMesa | null {
  if (!ehRegistro(bruto)) return null
  const codigo = proprio(bruto, 'codigo')
  const lista = proprio(bruto, 'enderecos')
  if (typeof codigo !== 'string' || !FORMA_DO_CODIGO_DA_SALA.test(codigo) || !Array.isArray(lista)) return null
  const brutos: readonly unknown[] = lista
  const enderecos = brutos.flatMap((item) => {
    const endereco = lerEnderecoDaMesa(item)
    return endereco === null ? [] : [endereco]
  })
  return enderecos.length > 0 ? { codigo, enderecos } : null
}

function lerEstado(bruto: Record<string, unknown>): EstadoComSala | null {
  const rev = proprio(bruto, 'rev')
  const fichas = lerLista(proprio(bruto, 'fichas'), lerFichaNoEstado)
  const membros = lerLista(proprio(bruto, 'membros'), lerMembro)
  const eu = lerMembro(proprio(bruto, 'eu'))
  if (!ehRev(rev) || fichas === null || membros === null || eu === null) return null
  const estado: EstadoComSala = { t: 'estado', rev, fichas, membros, eu }
  // O DO de antes da B2 não manda o campo: sem ele, a sessão entende "nenhuma sala".
  const sala = proprio(bruto, 'sala')
  if (sala !== undefined) estado.sala = lerSalaDaMesa(sala)
  // O sistema (F1) pela mesma leitura do app. Torto vale como ausente, como a sala: não há base a divergir, e o site cai no One Piece.
  const sistema = sistemaParaOJogador(proprio(bruto, 'sistema'))
  if (sistema === null) return estado
  estado.sistema = sistema
  // A marca e o resumo do livro só valem com o sistema lido: são dele. Torto = ausente (sem marca, a volta pede o `estado`; sem resumo, sem "Livro").
  const marca = proprio(bruto, 'marcaDoSistema')
  if (typeof marca === 'string' && marca.length > 0 && marca.length <= MARCA_MAX) estado.marcaDoSistema = marca
  const livro = lerResumoDoLivro(proprio(bruto, 'livro'))
  if (livro !== null) estado.livro = livro
  return estado
}

/** A marca que o DO dá tem 8 caracteres; o teto é o do `ola` no DO. */
const MARCA_MAX = 64
const CHAVES_DO_CATALOGO: ReadonlySet<string> = new Set(CATALOGOS_DO_LIVRO.map(({ chave }) => chave))

function ehChaveDoCatalogo(valor: unknown): valor is ChaveDoCatalogo {
  return typeof valor === 'string' && CHAVES_DO_CATALOGO.has(valor)
}

/** O resumo do livro no `estado` (F1): o que acende o "Livro" e o "Escolher do livro". `null` = sem livro, ou torto. */
function lerResumoDoLivro(bruto: unknown): ResumoDoLivro | null {
  if (!ehRegistro(bruto)) return null
  const capitulos = proprio(bruto, 'capitulos')
  const catalogos = lerLista(proprio(bruto, 'catalogos'), (item) => (ehChaveDoCatalogo(item) ? item : null))
  if (!ehRev(capitulos) || catalogos === null || (capitulos === 0 && catalogos.length === 0)) return null
  return { capitulos, catalogos }
}

/** Uma parte do livro (F1), pelo leitor da sala LAN: os mesmos tetos de parte e de total. */
function lerParteDoLivro(bruto: Record<string, unknown>): MensagemDoSite | null {
  const parte = parseLivroParte({ type: 'livro.parte', reqId: proprio(bruto, 'reqId'), indice: proprio(bruto, 'indice'), total: proprio(bruto, 'total'), texto: proprio(bruto, 'texto') })
  return parte === null ? null : { t: 'livro.parte', reqId: parte.reqId, indice: parte.indice, total: parte.total, texto: parte.texto }
}

function lerRecusaDoLivro(bruto: Record<string, unknown>): MensagemDoSite | null {
  const recusa = parseLivroRecusa({ type: 'livro.recusa', reqId: proprio(bruto, 'reqId') })
  return recusa === null ? null : { t: 'livro.recusa', reqId: recusa.reqId }
}

function lerOps(bruto: Record<string, unknown>): MensagemDoServidor | null {
  const desde = proprio(bruto, 'desde')
  const ate = proprio(bruto, 'ate')
  const lista = lerLista(proprio(bruto, 'lista'), lerOpGravada)
  return ehRev(desde) && ehRev(ate) && lista !== null ? { t: 'ops', desde, ate, lista } : null
}

/** `ack`, `conflito` e `negado` pelo mesmo leitor da fila (é o que ela grava). */
function lerResposta(bruto: Record<string, unknown>): MensagemDoServidor | null {
  const registro = lerRegistro(bruto)
  if (registro === null) return null
  switch (registro.t) {
    case 'ack':
    case 'conflito':
    case 'negado':
      return registro
    default:
      return null
  }
}

function lerAdiado(bruto: Record<string, unknown>): MensagemDoServidor | null {
  const opId = proprio(bruto, 'opId')
  const motivo = proprio(bruto, 'motivo')
  const tentarDepoisDe = proprio(bruto, 'tentarDepoisDe')
  if (!segmentoValido(opId) || (motivo !== 'cota' && motivo !== 'ritmo')) return null
  return typeof tentarDepoisDe === 'number' && Number.isFinite(tentarDepoisDe) ? { t: 'adiado', opId, motivo, tentarDepoisDe } : null
}

function lerHistorico(bruto: Record<string, unknown>): MensagemDoServidor | null {
  const fichaId = proprio(bruto, 'fichaId')
  const lista = lerLista(proprio(bruto, 'lista'), lerOpGravada)
  const temMaisAntigas = proprio(bruto, 'temMaisAntigas')
  return segmentoValido(fichaId) && lista !== null && typeof temMaisAntigas === 'boolean' ? { t: 'historico', fichaId, lista, temMaisAntigas } : null
}

function ehMotivoDoVerComo(valor: unknown): valor is MotivoDoVerComo {
  return valor === 'so-mestre' || valor === 'nao-e-jogador' || valor === 'ritmo' || valor === 'torta'
}

/**
 * A resposta do `verComo` (07/11/2026). O `estado` dentro dela passa pelo
 * MESMO leitor do `estado` do canal, e o mural e os duelos pelos leitores
 * deles. Ao contrário da base, vista torta NÃO derruba o canal (ela não
 * mexe na base do mestre): vale como recusa `torta`, e a tela diz que não deu.
 * Mural ou duelos tortos valem como ausentes (a vista mostra o resto).
 */
function lerDoVerComo(bruto: Record<string, unknown>, t: string): MensagemDoVerComoNoSite | null {
  const reqId = proprio(bruto, 'reqId')
  if (!segmentoValido(reqId)) return null
  if (t === 'verComo.recusa') {
    const motivo = proprio(bruto, 'motivo')
    return { t: 'verComo.recusa', reqId, motivo: ehMotivoDoVerComo(motivo) ? motivo : 'torta' }
  }
  if (t !== 'verComo.vista') return null
  const contaId = proprio(bruto, 'contaId')
  const brutoDoEstado = proprio(bruto, 'estado')
  const estado = ehRegistro(brutoDoEstado) && proprio(brutoDoEstado, 't') === 'estado' ? lerEstado(brutoDoEstado) : null
  if (typeof contaId !== 'string' || estado === null) return { t: 'verComo.recusa', reqId, motivo: 'torta' }
  const brutoDoMural = proprio(bruto, 'mural')
  const lidoDoMural = ehRegistro(brutoDoMural) ? lerFrameDoMural(brutoDoMural) : null
  const brutoDosDuelos = proprio(bruto, 'duelos')
  const lidoDosDuelos = ehRegistro(brutoDosDuelos) ? lerFrameDoDuelo(brutoDosDuelos) : null
  return {
    t: 'verComo.vista',
    reqId,
    contaId,
    estado,
    mural: lidoDoMural !== null && lidoDoMural.t === 'mural.estado' ? lidoDoMural : null,
    duelos: lidoDosDuelos !== null && lidoDosDuelos.t === 'duelo.lista' ? lidoDosDuelos : null,
  }
}

function lerDoRegistro(bruto: Record<string, unknown>): MensagemDoSite | null {
  const t = proprio(bruto, 't')
  // A vista do jogador pedida pelo mestre ("ver como"): só chega a quem pediu.
  if (typeof t === 'string' && t.startsWith('verComo.')) return lerDoVerComo(bruto, t)
  // O chat (C2) anda pelo mesmo canal: os frames dele têm leitor próprio.
  if (typeof t === 'string' && t.startsWith('chat.')) return lerFrameDoChat(bruto)
  // O mural (M2) também: o DO manda o `mural.estado` logo depois de cada `ola`.
  if (typeof t === 'string' && t.startsWith('mural.')) return lerFrameDoMural(bruto)
  // E o duelo (T7): o DO manda o `duelo.lista` depois de cada `ola`.
  if (typeof t === 'string' && t.startsWith('duelo.')) return lerFrameDoDuelo(bruto)
  // E a luta de N lados (Arena multijogador F5): o canal só separa o frame; as lutas (sob demanda) o leem,
  // e o torto vira `luta.torta` lá, nunca derruba o canal.
  if (typeof t === 'string' && t.startsWith('luta.')) return { t: 'luta.fio', bruto }
  switch (t) {
    case 'estado':
      return lerEstado(bruto)
    case 'ops':
      return lerOps(bruto)
    case 'ack':
    case 'conflito':
    case 'negado':
      return lerResposta(bruto)
    case 'adiado':
      return lerAdiado(bruto)
    case 'aplicada': {
      const op = lerOpGravada(proprio(bruto, 'op'))
      return op === null ? null : { t: 'aplicada', op }
    }
    case 'historico':
      return lerHistorico(bruto)
    case 'versao': {
      const versaoDoFormato = proprio(bruto, 'versaoDoFormato')
      return ehRev(versaoDoFormato) ? { t: 'versao', versaoDoFormato } : null
    }
    case 'presenca': {
      const naMesa = lerLista(proprio(bruto, 'naMesa'), lerPresenca)
      return naMesa === null ? null : { t: 'presenca', naMesa }
    }
    case 'sala':
      return { t: 'sala', sala: lerSalaDaMesa(proprio(bruto, 'sala')) }
    case 'livro.parte':
      return lerParteDoLivro(bruto)
    case 'livro.recusa':
      return lerRecusaDoLivro(bruto)
    default:
      return null
  }
}

/** O texto de um frame do servidor (fichas ou chat); `null` = JSON torto ou fora do formato. */
export function lerMensagemDoServidor(texto: string): MensagemDoSite | null {
  let bruto: unknown
  try {
    bruto = lerJsonSeguro(texto)
  } catch (erro) {
    if (erro instanceof SyntaxError) return null
    throw erro
  }
  return ehRegistro(bruto) ? lerDoRegistro(bruto) : null
}
