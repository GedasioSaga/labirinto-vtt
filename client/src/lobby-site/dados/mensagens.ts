import { lerMudanca, segmentoValido } from '../../lib/nuvem/caminho'
import { lerRegistro } from '../../lib/nuvem/fila'
import { ehJson, ehRegistro, lerJsonSeguro, proprio } from '../../lib/nuvem/json'
import { lerEnvelope } from '../../lib/nuvem/lote'
import { sistemaParaOJogador } from '../../lib/nuvem/projecao'
import type { FichaNoEstado, MembroProjetado, MensagemDoServidor, OpGravada, Origem, Papel, PresencaNaMesa, Visibilidade } from '../../lib/nuvem/tipos'
import { personagemDoArquivo } from '../../lib/personagem'
import type { EnderecoDaMesa, EstadoComSala, MensagemDoSite, SalaDaMesa } from './fonte'
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
  return typeof contaId === 'string' && typeof nome === 'string' && ehPapel(papel) ? { contaId, nome, papel } : null
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
  if (sistema !== null) estado.sistema = sistema
  return estado
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

function lerDoRegistro(bruto: Record<string, unknown>): MensagemDoSite | null {
  const t = proprio(bruto, 't')
  // O chat (C2) anda pelo mesmo canal: os frames dele têm leitor próprio.
  if (typeof t === 'string' && t.startsWith('chat.')) return lerFrameDoChat(bruto)
  // O mural (M2) também: o DO manda o `mural.estado` logo depois de cada `ola`.
  if (typeof t === 'string' && t.startsWith('mural.')) return lerFrameDoMural(bruto)
  // E o duelo (T7): o DO manda o `duelo.lista` depois de cada `ola`.
  if (typeof t === 'string' && t.startsWith('duelo.')) return lerFrameDoDuelo(bruto)
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
