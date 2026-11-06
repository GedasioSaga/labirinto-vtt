import {
  ehJson,
  ehRegistro,
  lerEnvelope,
  lerJsonSeguro,
  personagemDoArquivo,
  proprio,
  type Acao,
  type Conflito,
  type Cota,
  type FichaGuardada,
  type Json,
  type Membro,
  type Op,
  type OpGravada,
  type Origem,
  type Papel,
  type Recusada,
  type Visibilidade,
} from './nucleo'

/**
 * Linha do SQLite -> tipo do núcleo, conferindo cada coluna em tempo de
 * execução (o `exec<T>` do runtime não confere nada, então nenhum cast aqui).
 * Coluna fora do formato é erro de programa — só este Worker grava nessas
 * tabelas —, nunca dado de cliente: lança `ErroDoBanco`.
 */

export type Linha = Record<string, SqlStorageValue>

export class ErroDoBanco extends Error {}

export function texto(linha: Linha, coluna: string): string {
  const valor = linha[coluna]
  if (typeof valor !== 'string') throw new ErroDoBanco(`coluna ${coluna} sem texto`)
  return valor
}

export function textoOuNulo(linha: Linha, coluna: string): string | null {
  const valor = linha[coluna]
  return valor === null ? null : texto(linha, coluna)
}

export function numero(linha: Linha, coluna: string): number {
  const valor = linha[coluna]
  if (typeof valor !== 'number') throw new ErroDoBanco(`coluna ${coluna} sem número`)
  return valor
}

function numeroOuNulo(linha: Linha, coluna: string): number | null {
  return linha[coluna] === null ? null : numero(linha, coluna)
}

export function jsonDoTexto(textoJson: string): Json {
  const valor = lerJsonSeguro(textoJson)
  if (!ehJson(valor)) throw new ErroDoBanco('JSON gravado fora do formato')
  return valor
}

/** Coluna JSON opcional: SQL `NULL` = ausente; o texto `null` = o valor JSON null. */
function jsonOuAusente(linha: Linha, coluna: string): Json | undefined {
  const valor = textoOuNulo(linha, coluna)
  return valor === null ? undefined : jsonDoTexto(valor)
}

/** Para gravar: ausente vira SQL `NULL`, qualquer valor (inclusive null) vira texto JSON. */
export function jsonParaColuna(valor: Json | undefined): string | null {
  return valor === undefined ? null : JSON.stringify(valor)
}

function ehAcao(valor: string): valor is Acao {
  return valor === 'definir' || valor === 'somar' || valor === 'criar' || valor === 'apagar' || valor === 'ordenar'
}

function ehOrigem(valor: string): valor is Origem {
  return valor === 'app' || valor === 'site' || valor === 'mesa'
}

export function ehPapel(valor: unknown): valor is Papel {
  return valor === 'mestre' || valor === 'jogador'
}

function ehVisibilidade(valor: string): valor is Visibilidade {
  return valor === 'mesa' || valor === 'treino' || valor === 'mestre'
}

export function visivelDe(valor: string): Visibilidade {
  if (!ehVisibilidade(valor)) throw new ErroDoBanco('visibilidade gravada fora do formato')
  return valor
}

function acaoDe(valor: unknown): Acao {
  if (typeof valor !== 'string' || !ehAcao(valor)) throw new ErroDoBanco('ação gravada fora do formato')
  return valor
}

function caminhoDe(valor: unknown): string[] {
  if (!Array.isArray(valor)) throw new ErroDoBanco('caminho gravado fora do formato')
  const caminho: unknown[] = Array.from(valor)
  if (!caminho.every((segmento): segmento is string => typeof segmento === 'string')) throw new ErroDoBanco('caminho gravado fora do formato')
  return caminho
}

export function opDaLinha(linha: Linha): OpGravada {
  const origem = texto(linha, 'origem')
  if (!ehOrigem(origem)) throw new ErroDoBanco('origem gravada fora do formato')
  const op: OpGravada = {
    opId: texto(linha, 'opId'),
    loteId: texto(linha, 'loteId'),
    fichaId: texto(linha, 'fichaId'),
    caminho: caminhoDe(jsonDoTexto(texto(linha, 'caminho'))),
    acao: acaoDe(texto(linha, 'acao')),
    baseRev: numero(linha, 'baseRev'),
    clienteId: texto(linha, 'clienteId'),
    quandoCliente: numero(linha, 'quandoCliente'),
    rev: numero(linha, 'rev'),
    autorContaId: texto(linha, 'autorContaId'),
    autorNome: texto(linha, 'autorNome'),
    origem,
    atestadoPeloApp: numero(linha, 'atestadoPeloApp') !== 0,
    quando: numero(linha, 'quando'),
  }
  completarOp(op, linha)
  return op
}

/** Os campos opcionais da op: só entram quando a coluna tem valor (o núcleo distingue ausente de null). */
function completarOp(op: OpGravada, linha: Linha): void {
  const valor = jsonOuAusente(linha, 'valor')
  if (valor !== undefined) op.valor = valor
  const antes = jsonOuAusente(linha, 'antes')
  if (antes !== undefined) op.antes = antes
  const delta = numeroOuNulo(linha, 'delta')
  if (delta !== null) op.delta = delta
  if (numero(linha, 'atomico') !== 0) op.atomico = true
  const desfaz = textoOuNulo(linha, 'desfaz')
  if (desfaz !== null) op.desfaz = desfaz
  const resolve = textoOuNulo(linha, 'resolve')
  if (resolve !== null) op.resolve = resolve
  const autorDeclarado = textoOuNulo(linha, 'autorDeclarado')
  if (autorDeclarado !== null) op.autorDeclarado = autorDeclarado
}

export function fichaDaLinha(linha: Linha): FichaGuardada {
  // O doc foi gravado a partir de uma ficha do núcleo; reler pelo leitor do disco é a mesma porta da criação (`lerMudanca`).
  const doc = personagemDoArquivo(lerJsonSeguro(texto(linha, 'doc')))
  if (doc === null) throw new ErroDoBanco('ficha gravada fora do formato')
  return { doc, apagada: numero(linha, 'apagada') !== 0, visivel: visivelDe(texto(linha, 'visivel')), rev: numero(linha, 'rev') }
}

export function membroDaLinha(linha: Linha): Membro {
  const papel = texto(linha, 'papel')
  const estado = texto(linha, 'estado')
  if (!ehPapel(papel) || (estado !== 'ativo' && estado !== 'removido')) throw new ErroDoBanco('membro gravado fora do formato')
  return { contaId: texto(linha, 'contaId'), email: texto(linha, 'email'), nome: texto(linha, 'nome'), papel, estado }
}

export function cotaDaLinha(linha: Linha): Cota {
  const cota: Cota = { ops: numero(linha, 'ops'), bytes: numero(linha, 'bytes'), negadas: numero(linha, 'negadas') }
  const paceAt = numeroOuNulo(linha, 'paceAt')
  if (paceAt !== null) cota.paceAt = paceAt
  return cota
}

/** A op guardada em `recusadas`: o envelope pelo leitor do núcleo e a mudança campo a campo (sem reaplicar o esquema de hoje). */
function opDoJson(valor: Json): Op {
  const envelope = lerEnvelope(valor)
  if (!envelope.ok || !ehRegistro(valor)) throw new ErroDoBanco('op recusada gravada fora do formato')
  const fichaId = proprio(valor, 'fichaId')
  if (typeof fichaId !== 'string') throw new ErroDoBanco('op recusada gravada fora do formato')
  const op: Op = { ...envelope.envelope, fichaId, caminho: caminhoDe(proprio(valor, 'caminho')), acao: acaoDe(proprio(valor, 'acao')) }
  const dado = proprio(valor, 'valor')
  if (dado !== undefined && ehJson(dado)) op.valor = dado
  const delta = proprio(valor, 'delta')
  if (typeof delta === 'number') op.delta = delta
  if (proprio(valor, 'atomico') === true) op.atomico = true
  return op
}

function conflitoDoJson(valor: Json): Conflito {
  if (!ehRegistro(valor)) throw new ErroDoBanco('conflito gravado fora do formato')
  const opId = proprio(valor, 'opId')
  const quem = proprio(valor, 'quem')
  const quando = proprio(valor, 'quando')
  const revAtual = proprio(valor, 'revAtual')
  if (typeof opId !== 'string' || typeof quem !== 'string' || typeof quando !== 'number' || typeof revAtual !== 'number') {
    throw new ErroDoBanco('conflito gravado fora do formato')
  }
  const conflito: Conflito = { opId, quem, quando, revAtual }
  const valorAtual = proprio(valor, 'valorAtual')
  if (valorAtual !== undefined && ehJson(valorAtual)) conflito.valorAtual = valorAtual
  if (proprio(valor, 'fichaApagada') === true) conflito.fichaApagada = true
  const porCausaDe = proprio(valor, 'porCausaDe')
  if (typeof porCausaDe === 'string') conflito.porCausaDe = porCausaDe
  return conflito
}

export function recusadaDaLinha(linha: Linha): Recusada {
  return {
    opId: texto(linha, 'opId'),
    op: opDoJson(jsonDoTexto(texto(linha, 'op'))),
    autorContaId: texto(linha, 'autorContaId'),
    resposta: conflitoDoJson(jsonDoTexto(texto(linha, 'resposta'))),
    quando: numero(linha, 'quando'),
  }
}
