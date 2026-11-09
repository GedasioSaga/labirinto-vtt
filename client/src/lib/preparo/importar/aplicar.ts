import { FEATURES, type FeatureFlags } from '../../features'
import { preparoLigado } from '../chave'
import { LUGARES, gravarNoPreparoSeMudou, idDoPreparoValido, lerDoPreparo, lerVerbete, pastaDoPreparo, type DocumentoLido } from '../disco'
import {
  ARQUIVO_DAS_LIGACOES,
  ARQUIVO_DA_LIXEIRA,
  ARQUIVO_DA_TEIA,
  ARQUIVO_DOS_CHATS,
  ARQUIVO_DOS_VINDOS,
  ARQUIVO_DO_INDICE,
  ARQUIVO_DO_QUADRO,
  ARQUIVO_DO_VERBETE,
  type IndiceDoPreparo,
  type Origem,
  type VindosDoGrimorio,
} from '../tipos'
import { compararCaminhos, idFixoDoCaminho, type LeitorDoCofre } from './cofre'
import { copiarMidias, criarPastaDaImportacao, gravarRelatorio, guardarOriginais, vaoParaOOriginal, type Andar } from './copiarArquivos'
import { lerPreludio, type FotoDoPreludio } from './noPreludio'
import { hashDoQuadro, hashDoVerbete } from './reimportar'
import { MINIMO_QUE_SOBRA_BYTES, type ChatDoGrimorio, type PlanoDaImportacao, type ResultadoDaSimulacao } from './relatorio'

/**
 * O "APLICAR" DA IMPORTAÇÃO (plano §4, passos 6 a 10): grava no Prelúdio o
 * plano que a simulação montou, depois do ok do mestre na tela.
 *
 * Antes de gravar qualquer coisa, recusa (`RecusaDaImportacao`) quando: o
 * relatório trava, o espaço livre não foi medido ou sobrariam menos de 8 GB, ou
 * o Prelúdio mudou desde a simulação. Depois, na ordem:
 *   1. imagens em `midia/<sha256>.<ext>`, cada uma uma vez (`copiarArquivos.ts`);
 *   2. verbetes e quadros, pelos moldes da F0. Cada um é conferido de novo na
 *      hora: o que o mestre editou no Prelúdio fica como está;
 *   3. o que é só leitura no Prelúdio: chat de IA, Teia e lixeira do Grimório;
 *   4. as ligações e o índice, com a pasta do Labirinto que o mestre ligou a
 *      cada campanha (passo 8);
 *   5. se algo mudou: `importacoes/<data>/` com o relatório e os JSON originais;
 *   6. o registro do que veio do Grimório: o que sumir do Prelúdio depois foi
 *      apagado pelo mestre, e a reimportação não traz de volta.
 * Nada mudou = nada é gravado, nem a pasta da importação. O cofre só é lido.
 */

export class RecusaDaImportacao extends Error {}

export type FaseDaAplicacao = 'conferindo' | 'imagens' | 'verbetes' | 'quadros' | 'restante' | 'original'

export interface OpcoesDaAplicacao {
  /** A foto do Prelúdio que a simulação usou (`lerPreludio`). */
  readonly foto: FotoDoPreludio
  /** Campanha → pasta do Labirinto (`null` = sem pasta). Campanha fora do mapa fica como está. */
  readonly pastas: ReadonlyMap<string, string | null>
  /** Medido agora, na hora de aplicar; `null` = não deu para medir, e a importação é recusada. */
  readonly espacoLivreBytes: number | null
  readonly agora?: () => Date
  readonly aoAvancar?: (fase: FaseDaAplicacao, feitos: number, total: number) => void
  readonly flags?: Readonly<FeatureFlags>
}

export interface ItemPreservado {
  readonly id: string
  readonly titulo: string
}

export interface ResumoDaAplicacao {
  /** Arquivos do Prelúdio que mudaram; 0 = já estava igual ao Grimório. */
  readonly mudancas: number
  readonly verbetes: number
  readonly quadros: number
  /** Imagens novas em `midia/`. */
  readonly imagens: number
  /** Chats, Teia e entradas da lixeira que mudaram. */
  readonly soLeitura: number
  readonly ligacoesMudaram: boolean
  readonly indiceMudou: boolean
  /** Mexidos no Prelúdio desde a simulação: ficaram como estavam. */
  readonly preservados: readonly ItemPreservado[]
  /** `importacoes/<data>` (relativo a preparo/); `null` quando nada mudou. */
  readonly pasta: string | null
  readonly avisos: readonly string[]
}

const ID_DA_TEIA = 'layout-teia'

function emGb(bytes: number): string {
  return `${(bytes / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
}

// ─── As conferências antes de gravar ─────────────────────────────────────────

function conferirRelatorio(resultado: ResultadoDaSimulacao): void {
  if (!resultado.relatorio.podeAplicar) throw new RecusaDaImportacao(['O relatório trava a importação.', ...resultado.relatorio.motivosParaNaoAplicar].join(' '))
}

function conferirEspaco(necessario: number, livre: number | null): void {
  if (livre === null) throw new RecusaDaImportacao('O espaço livre no disco não foi medido agora: sem a medida, não dá para garantir os 8 GB que precisam sobrar.')
  const sobra = livre - necessario
  if (sobra < MINIMO_QUE_SOBRA_BYTES) {
    throw new RecusaDaImportacao(`Depois de importar sobrariam ${emGb(Math.max(0, sobra))} livres no disco, e o mínimo é ${emGb(MINIMO_QUE_SOBRA_BYTES)}. Libere espaço e simule de novo.`)
  }
}

async function conferirPreludio(plano: PlanoDaImportacao, foto: FotoDoPreludio, flags: Readonly<FeatureFlags>): Promise<void> {
  if (plano.modo === 'importacao' && !foto.vazio) throw new RecusaDaImportacao('A simulação foi feita como primeira importação, mas o Prelúdio já tem conteúdo. Simule de novo.')
  const agora = await lerPreludio(flags)
  if (!agora.ok) throw new RecusaDaImportacao(`O Prelúdio tem arquivos que esta versão não abre para editar: ${agora.problemas.join(' ')}`)
  if (agora.foto.impressao !== foto.impressao) throw new RecusaDaImportacao('O Prelúdio mudou desde a simulação. Simule de novo para o relatório valer.')
}

// ─── Verbetes e quadros ──────────────────────────────────────────────────────

/** Não existe, ou veio do Grimório e ninguém mexeu desde então (bate com o hash guardado na importação). */
async function podeTrocar<T extends { origem?: Origem }>(atual: DocumentoLido<T>, hash: (valor: T) => Promise<string>): Promise<boolean> {
  if (atual.estado === 'novo') return true
  if (atual.estado !== 'ok') return false
  const guardado = atual.valor.origem?.grimorio?.hash
  return guardado !== undefined && (await hash(atual.valor)) === guardado
}

interface Gravados {
  /** Os que estão no Prelúdio como vieram desta importação (gravados agora ou já iguais). */
  readonly ids: string[]
  mudaram: number
  readonly preservados: ItemPreservado[]
}

async function gravarVerbetes(plano: PlanoDaImportacao, flags: Readonly<FeatureFlags>, andar: Andar): Promise<Gravados> {
  const saida: Gravados = { ids: [], mudaram: 0, preservados: [] }
  for (const [posicao, verbete] of plano.verbetes.entries()) {
    if (await podeTrocar(await lerVerbete(verbete.id, flags), hashDoVerbete)) {
      if (await gravarNoPreparoSeMudou(ARQUIVO_DO_VERBETE, LUGARES.verbete(verbete.id), verbete, flags)) saida.mudaram += 1
      saida.ids.push(verbete.id)
    } else {
      saida.preservados.push({ id: verbete.id, titulo: verbete.titulo })
    }
    andar(posicao + 1, plano.verbetes.length)
  }
  return saida
}

async function gravarQuadros(plano: PlanoDaImportacao, flags: Readonly<FeatureFlags>, andar: Andar): Promise<Gravados> {
  const saida: Gravados = { ids: [], mudaram: 0, preservados: [] }
  for (const [posicao, { id, quadro }] of plano.quadros.entries()) {
    if (await podeTrocar(await lerDoPreparo(ARQUIVO_DO_QUADRO, LUGARES.quadro(id), flags), hashDoQuadro)) {
      if (await gravarNoPreparoSeMudou(ARQUIVO_DO_QUADRO, LUGARES.quadro(id), quadro, flags)) saida.mudaram += 1
      saida.ids.push(id)
    } else {
      saida.preservados.push({ id, titulo: quadro.nome })
    }
    andar(posicao + 1, plano.quadros.length)
  }
  return saida
}

// ─── Só leitura no Prelúdio: chat, Teia e lixeira ────────────────────────────

function chatsPorDono(chats: readonly ChatDoGrimorio[]): Map<string, ChatDoGrimorio[]> {
  const porDono = new Map<string, ChatDoGrimorio[]>()
  for (const chat of chats) porDono.set(chat.donoId, [...(porDono.get(chat.donoId) ?? []), chat])
  return porDono
}

async function gravarChats(plano: PlanoDaImportacao, flags: Readonly<FeatureFlags>, avisos: string[]): Promise<number> {
  let mudaram = 0
  for (const [donoId, chats] of chatsPorDono(plano.chats)) {
    if (!idDoPreparoValido(donoId)) {
      avisos.push(`O chat de IA de "${donoId}" ficou só no original: o id não serve de nome de arquivo.`)
      continue
    }
    const emOrdem = [...chats].sort((a, b) => compararCaminhos(a.caminho, b.caminho))
    const arquivo = { formato: ARQUIVO_DOS_CHATS.formato, donoId, chats: emOrdem.map((chat) => ({ caminho: chat.caminho, conteudo: chat.conteudo })) }
    if (await gravarNoPreparoSeMudou(ARQUIVO_DOS_CHATS, LUGARES.chats(donoId), arquivo, flags)) mudaram += 1
  }
  return mudaram
}

async function gravarTeiaELixeira(plano: PlanoDaImportacao, flags: Readonly<FeatureFlags>): Promise<number> {
  let mudaram = 0
  if (plano.teia !== null) {
    const teia = { formato: ARQUIVO_DA_TEIA.formato, porEscopo: plano.teia.porEscopo, origem: { grimorio: { id: ID_DA_TEIA, caminho: plano.teia.caminho } } }
    if (await gravarNoPreparoSeMudou(ARQUIVO_DA_TEIA, LUGARES.teia(), teia, flags)) mudaram += 1
  }
  for (const entrada of plano.lixeira) {
    const caminho = `.lixeira/${entrada.id}`
    const id = idDoPreparoValido(entrada.id) ? entrada.id : await idFixoDoCaminho(caminho)
    const arquivos = entrada.arquivos.map((item) => ({ caminho: item.caminho, conteudo: item.conteudo }))
    const arquivo = { formato: ARQUIVO_DA_LIXEIRA.formato, id: entrada.id, arquivos, origem: { grimorio: { id: entrada.id, caminho } } }
    if (await gravarNoPreparoSeMudou(ARQUIVO_DA_LIXEIRA, LUGARES.lixeiraDoGrimorio(id), arquivo, flags)) mudaram += 1
  }
  return mudaram
}

// ─── Índice e registro ───────────────────────────────────────────────────────

/** A pasta do Labirinto que o mestre escolheu para cada campanha (passo 8). */
function comAsPastas(indice: IndiceDoPreparo, pastas: ReadonlyMap<string, string | null>): IndiceDoPreparo {
  return {
    ...indice,
    campanhas: indice.campanhas.map((campanha) => {
      const escolha = pastas.get(campanha.id)
      if (escolha === undefined) return campanha
      const nova = { ...campanha }
      if (escolha === null) delete nova.pastaId
      else nova.pastaId = escolha
      return nova
    }),
  }
}

function idsComOrigem(itens: readonly { readonly id: string; readonly origem?: Origem }[]): string[] {
  return itens.filter((item) => item.origem?.grimorio !== undefined).map((item) => item.id)
}

function uniao(...listas: readonly (readonly string[])[]): string[] {
  return [...new Set(listas.flat())].sort(compararCaminhos)
}

function vindosDepois(foto: FotoDoPreludio, verbetes: Gravados, quadros: Gravados, plano: PlanoDaImportacao): VindosDoGrimorio {
  const antes = foto.vindos
  const quadrosComOrigem = (foto.noPreludio.quadros ?? []).filter(({ quadro }) => quadro.origem?.grimorio !== undefined).map(({ id }) => id)
  return {
    formato: ARQUIVO_DOS_VINDOS.formato,
    verbetes: uniao(antes?.verbetes ?? [], idsComOrigem(foto.noPreludio.verbetes), verbetes.ids),
    quadros: uniao(antes?.quadros ?? [], quadrosComOrigem, quadros.ids),
    ligacoes: uniao(antes?.ligacoes ?? [], idsComOrigem(plano.ligacoes.ligacoes)),
    campanhas: uniao(antes?.campanhas ?? [], idsComOrigem(plano.indice.campanhas)),
  }
}

// ─── Aplicar ─────────────────────────────────────────────────────────────────

interface ConteudoGravado {
  readonly imagens: number
  readonly verbetes: Gravados
  readonly quadros: Gravados
  readonly soLeitura: number
  readonly ligacoesMudaram: boolean
  readonly indiceMudou: boolean
  /** O índice como foi gravado, com as pastas escolhidas. */
  readonly indice: IndiceDoPreparo
  readonly avisos: string[]
  readonly andar: (fase: FaseDaAplicacao) => Andar
}

function mudancasDe(feito: ConteudoGravado): number {
  return feito.imagens + feito.verbetes.mudaram + feito.quadros.mudaram + feito.soLeitura + (feito.ligacoesMudaram ? 1 : 0) + (feito.indiceMudou ? 1 : 0)
}

function resumoDe(feito: ConteudoGravado, pasta: string | null): ResumoDaAplicacao {
  return {
    mudancas: mudancasDe(feito),
    verbetes: feito.verbetes.mudaram,
    quadros: feito.quadros.mudaram,
    imagens: feito.imagens,
    soLeitura: feito.soLeitura,
    ligacoesMudaram: feito.ligacoesMudaram,
    indiceMudou: feito.indiceMudou,
    preservados: [...feito.verbetes.preservados, ...feito.quadros.preservados],
    pasta,
    avisos: feito.avisos,
  }
}

async function gravarConteudo(resultado: ResultadoDaSimulacao, leitor: LeitorDoCofre, opcoes: OpcoesDaAplicacao, raiz: string, flags: Readonly<FeatureFlags>): Promise<ConteudoGravado> {
  const { plano } = resultado
  const andar = (fase: FaseDaAplicacao): Andar => (feitos, total) => opcoes.aoAvancar?.(fase, feitos, total)
  const avisos: string[] = []
  const imagens = await copiarMidias(leitor, raiz, plano.midias, andar('imagens'))
  const verbetes = await gravarVerbetes(plano, flags, andar('verbetes'))
  const quadros = await gravarQuadros(plano, flags, andar('quadros'))
  andar('restante')(0, 1)
  const soLeitura = (await gravarChats(plano, flags, avisos)) + (await gravarTeiaELixeira(plano, flags))
  const ligacoesMudaram = await gravarNoPreparoSeMudou(ARQUIVO_DAS_LIGACOES, LUGARES.ligacoes(), plano.ligacoes, flags)
  const indice = comAsPastas(plano.indice, opcoes.pastas)
  const indiceMudou = await gravarNoPreparoSeMudou(ARQUIVO_DO_INDICE, LUGARES.indice(), indice, flags)
  andar('restante')(1, 1)
  return { imagens, verbetes, quadros, soLeitura, ligacoesMudaram, indiceMudou, indice, avisos, andar }
}

/** Grava a importação. Lança `RecusaDaImportacao` (nada foi gravado) ou outro erro (parou no meio: o que já foi gravado fica). */
export async function aplicarImportacao(resultado: ResultadoDaSimulacao, leitor: LeitorDoCofre, opcoes: OpcoesDaAplicacao): Promise<ResumoDaAplicacao> {
  const flags = opcoes.flags ?? FEATURES
  if (!preparoLigado(flags)) throw new RecusaDaImportacao('O Prelúdio está desligado: nada é gravado.')
  opcoes.aoAvancar?.('conferindo', 0, 1)
  conferirRelatorio(resultado)
  conferirEspaco(resultado.relatorio.espaco.necessarioBytes, opcoes.espacoLivreBytes)
  await conferirPreludio(resultado.plano, opcoes.foto, flags)

  const raiz = await pastaDoPreparo(flags)
  const feito = await gravarConteudo(resultado, leitor, opcoes, raiz, flags)
  let pasta: string | null = null
  if (mudancasDe(feito) > 0) {
    const quando = (opcoes.agora ?? (() => new Date()))()
    const daImportacao = await criarPastaDaImportacao(raiz, quando)
    pasta = daImportacao.relativa
    feito.avisos.push(...(await guardarOriginais(leitor, daImportacao.absoluta, vaoParaOOriginal(resultado.relatorio.arquivos), feito.andar('original'))))
    const aplicacao = { em: quando.toISOString(), modo: resultado.plano.modo, pastas: Object.fromEntries(opcoes.pastas), ...resumoDe(feito, pasta) }
    await gravarRelatorio(daImportacao.absoluta, { ...resultado.relatorio, aplicacao })
  }
  const vindos = vindosDepois(opcoes.foto, feito.verbetes, feito.quadros, { ...resultado.plano, indice: feito.indice })
  await gravarNoPreparoSeMudou(ARQUIVO_DOS_VINDOS, LUGARES.vindosDoGrimorio(), vindos, flags)
  return resumoDe(feito, pasta)
}
