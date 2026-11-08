import { tipoDosBytes, hashHex } from '../../midia'
import { idDoPreparoValido } from '../disco'
import { ehRegistro, type Molde } from '../molde'
import {
  ARQUIVO_DAS_LIGACOES,
  ARQUIVO_DO_INDICE,
  ARQUIVO_DO_QUADRO,
  ARQUIVO_DO_VERBETE,
  CAMPANHA,
  LIGACAO,
  type ArquivoDoPreparo,
  type Campanha,
  type Ligacao,
  type Quadro,
  type TipoDeVerbete,
  type Verbete,
} from '../tipos'
import { classificar, type Classificacao, type Destino, type TipoNoGrimorio } from './classificar'
import { chaveDoCaminho, compararCaminhos, extensaoDe, idFixoDoCaminho, nomeDe, pastaDe, type LeitorDoCofre } from './cofre'
import { compararCopiasDeConflito, type CopiasDeConflito } from './conflitos'
import { campanhaDoGrimorio, Conversor, type MetaDoVerbete } from './converter'
import {
  TIPO_PARTICIPA,
  datasDe,
  normalizarCampanha,
  normalizarCenario,
  normalizarDocumento,
  normalizarItem,
  normalizarPagina,
  normalizarPasta,
  normalizarPersonagem,
  normalizarVinculos,
  type Bruto,
  type PastaG,
  type VinculoG,
} from './grimorio'
import { inventariar, type EstadoNoDisco, type PastaIlegivel } from './inventario'
import {
  campanhaComHash,
  comHashDaImportacao,
  ligacaoComHash,
  planejarReimportacao,
  planoDaReimportacao,
  quadroComHash,
  type NoPreludio,
  type QuadroComId,
} from './reimportar'
import {
  FORMATO_DO_RELATORIO,
  MINIMO_QUE_SOBRA_BYTES,
  registroDe,
  somarPorDestino,
  somarPorTipo,
  type ArquivoNoRelatorio,
  type ChatDoGrimorio,
  type Contagens,
  type EntradaDaLixeira,
  type EspacoEmDisco,
  type PlanoDaImportacao,
  type PosicaoNaTeia,
  type ResultadoDaSimulacao,
  type TeiaDoGrimorio,
} from './relatorio'

/**
 * A SIMULAÇÃO DA IMPORTAÇÃO DO GRIMÓRIO (plano §4, passos 1 a 5): lê o cofre
 * só para leitura, faz o inventário com tamanho, lê o formato antigo com a
 * lógica do Grimório, mantém os ids (id fixo do caminho para quem não tem),
 * converte para os tipos do Prelúdio e monta o relatório. NÃO grava nada:
 * nem no cofre (o leitor não sabe gravar) nem no Prelúdio (o "Aplicar" é da F2).
 */

export interface OpcoesDaSimulacao {
  /** A pasta das cópias de conflito, para comparar com os originais (elas não entram). */
  readonly copiasDeConflito?: LeitorDoCofre
  /** Espaço livre no disco do Prelúdio; `null`/ausente = não medido, e o "Aplicar" fica travado. */
  readonly espacoLivreBytes?: number | null
  /** O que já está no Prelúdio: o relatório traz o plano da reimportação, e o plano respeita a regra dela. */
  readonly existentes?: NoPreludio
  /** Andamento da leitura (as imagens demoram). */
  readonly aoAvancar?: (feitos: number, total: number) => void
  readonly agora?: () => Date
}

interface Registro {
  readonly caminho: string
  readonly chave: string
  readonly bytes: number
  readonly estado: EstadoNoDisco
  readonly classe: Classificacao
  tipo: TipoNoGrimorio
  destino: Destino
  motivo?: string
  vira?: string
}

/** O que vira verbete, quadro ou campanha: o JSON do arquivo e o tipo dele. */
interface Entidade {
  readonly tipo: 'personagem' | 'cenario' | 'item' | 'pagina' | 'sessao' | 'caderno' | 'canvas' | 'mapa' | 'campanha'
  readonly bruto: Bruto
}

interface Resolvida {
  readonly registro: Registro
  readonly entidade: Entidade
  /** Id no Prelúdio. */
  readonly id: string
  /** Id no Grimório (o fixo do caminho, quando o arquivo não tinha). */
  readonly idNoGrimorio: string
}

const LOTE_DE_IMAGENS = 8
/** Os destinos cujo JSON é aberto: todos os que viram alguma coisa no Prelúdio. */
const DESTINOS_LIDOS: ReadonlySet<Destino> = new Set(['verbete', 'quadro', 'ligacoes', 'campanha', 'organizacao', 'chat', 'teia', 'lixeira'])
const TIPOS_DE_VERBETE: readonly TipoDeVerbete[] = ['personagem', 'lugar', 'item', 'faccao', 'pagina', 'sessao']
const ESPACO_DO_ID: Readonly<Record<Entidade['tipo'], 'verbete' | 'quadro' | 'campanha'>> = {
  personagem: 'verbete', cenario: 'verbete', item: 'verbete', pagina: 'verbete', sessao: 'verbete', caderno: 'verbete',
  canvas: 'quadro', mapa: 'quadro', campanha: 'campanha',
}
const ESCOPO_DE_CAMPANHA = 'campanha:'
/** Problemas da conferência de destino listados um a um nos avisos; o resto vira "e mais N". */
const PROBLEMAS_LISTADOS = 20
/** As saídas do plano que vêm, cada uma, de arquivos do cofre (conferência de destino). */
const ESPACOS_DO_PLANO: readonly ('verbete' | 'quadro' | 'campanha' | 'midia')[] = ['verbete', 'quadro', 'campanha', 'midia']

function motivoDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** Por que o arquivo que não está no disco virou falha (com falha na lista, o "Aplicar" não roda). */
function motivoDaFalha(estado: Exclude<EstadoNoDisco, 'local'>, motivo: string | undefined): string {
  switch (estado) {
    case 'soNaNuvem':
      return 'só na nuvem do OneDrive: não foi baixado nem lido'
    case 'atalho':
      return 'atalho (link ou junção): não foi seguido, para a leitura não sair da pasta escolhida'
    case 'semInfo':
      return `sem informação do disco: ${motivo ?? 'motivo desconhecido'}`
  }
}

function bytesDoTexto(texto: string): number {
  return new TextEncoder().encode(texto).length
}

type Conferido = { ok: true; bytes: number } | { ok: false; motivo: string }

/** O texto que o "Aplicar" gravaria, lido de volta pelo próprio molde (o mesmo teste de `disco.ts`). */
function peloMolde<T>(molde: Molde<T>, valor: T): Conferido {
  const texto = JSON.stringify(molde.gravar(valor), null, 2)
  const deVolta = molde.ler(JSON.parse(texto), '')
  return deVolta.ok ? { ok: true, bytes: bytesDoTexto(texto) } : { ok: false, motivo: deVolta.motivo }
}

function noDisco<T extends { formato: number }>(arquivo: ArquivoDoPreparo<T>, valor: T): Conferido {
  return peloMolde(arquivo.molde, { ...valor, formato: arquivo.formato })
}

function ehPosicao(valor: unknown): valor is PosicaoNaTeia {
  return ehRegistro(valor) && typeof valor.x === 'number' && Number.isFinite(valor.x) && typeof valor.y === 'number' && Number.isFinite(valor.y)
}

class Simulacao {
  readonly avisos: string[] = []
  readonly registros: Registro[]
  private readonly porChave = new Map<string, Registro>()
  private readonly brutos = new Map<string, unknown>()
  private readonly midiaPorChave = new Map<string, { midia: string; bytes: number }>()
  readonly midias = new Map<string, { midia: string; caminho: string; bytes: number }>()
  private readonly idNoPreludio = new Map<string, string>()
  private readonly idsUsados = { verbete: new Set<string>(), quadro: new Set<string>(), campanha: new Set<string>(), ligacao: new Set<string>() }
  readonly resolvidas: Resolvida[] = []
  private readonly porCaminho = new Map<string, Resolvida>()
  private readonly pastas = new Map<string, PastaG>()
  private readonly campanhaPorSlug = new Map<string, string>()
  private readonly campanhaNoPreludio = new Map<string, string>()
  private readonly participa = new Map<string, Set<string>>()
  relacoes: VinculoG[] = []
  contagemDeVinculos = { validos: 0, participacoes: 0, descartados: 0, participacoesSemCampanha: 0, participacoesComData: 0 }
  private semId = 0
  private idsRepetidos = 0
  private idsQueNaoServem = 0

  constructor(
    private readonly leitor: LeitorDoCofre,
    arquivos: readonly { caminho: string; bytes: number; estado: EstadoNoDisco; motivo?: string }[],
    private readonly aoAvancar: (feitos: number, total: number) => void,
  ) {
    this.registros = arquivos.map((arquivo) => {
      const classe = classificar(arquivo.caminho)
      const registro: Registro = { caminho: arquivo.caminho, chave: chaveDoCaminho(arquivo.caminho), bytes: arquivo.bytes, estado: arquivo.estado, classe, tipo: classe.tipo, destino: classe.destino }
      if (classe.motivo !== undefined) registro.motivo = classe.motivo
      if (arquivo.estado !== 'local') this.falhou(registro, motivoDaFalha(arquivo.estado, arquivo.motivo))
      this.porChave.set(registro.chave, registro)
      return registro
    })
  }

  private falhou(registro: Registro, motivo: string): void {
    registro.destino = 'falha'
    registro.motivo = motivo
  }

  /** O arquivo não vira nada no Prelúdio: fica só em `importacoes/<data>/original/`. */
  soOriginal(registro: Registro, motivo: string): void {
    registro.destino = 'soOriginal'
    registro.motivo = motivo
    delete registro.vira
  }

  registroDaChave(chave: string): Registro | undefined {
    return this.porChave.get(chave)
  }

  // ─── Leitura ───────────────────────────────────────────────────────────────

  async lerJsons(): Promise<void> {
    const alvos = this.registros.filter((registro) => DESTINOS_LIDOS.has(registro.destino))
    let feitos = 0
    await Promise.all(
      alvos.map(async (registro) => {
        try {
          // Só a lixeira guarda arquivo de qualquer tipo; o resto já é JSON pela classificação.
          if (extensaoDe(registro.caminho) !== 'json') this.soOriginal(registro, 'arquivo da lixeira que não é JSON: guardado só como original')
          else this.guardarJson(registro, await this.leitor.lerTexto(registro.caminho))
        } catch (erro) {
          this.falhou(registro, `não deu para ler: ${motivoDe(erro)}`)
        }
        feitos += 1
        this.aoAvancar(feitos, alvos.length)
      }),
    )
  }

  private guardarJson(registro: Registro, texto: string): void {
    let bruto: unknown
    try {
      bruto = JSON.parse(texto)
    } catch {
      this.soOriginal(registro, 'JSON quebrado: guardado só como original')
      return
    }
    if (ehRegistro(bruto)) this.brutos.set(registro.chave, bruto)
    else this.soOriginal(registro, 'o JSON não é um objeto: guardado só como original')
  }

  /** Cada imagem vira `midia/<sha256>.<ext>`: conteúdo repetido (`Imagens`/`imagens`, `imagens-cenarios/`) vira um arquivo só. */
  async lerImagens(): Promise<void> {
    const imagens = this.registros.filter((registro) => registro.destino === 'midia')
    for (let inicio = 0; inicio < imagens.length; inicio += LOTE_DE_IMAGENS) {
      await Promise.all(imagens.slice(inicio, inicio + LOTE_DE_IMAGENS).map((registro) => this.lerImagem(registro)))
      this.aoAvancar(Math.min(inicio + LOTE_DE_IMAGENS, imagens.length), imagens.length)
    }
  }

  private async lerImagem(registro: Registro): Promise<void> {
    try {
      const bytes = await this.leitor.lerBytes(registro.caminho)
      const extensao = tipoDosBytes(bytes) ?? extensaoDe(registro.caminho).replace('jpeg', 'jpg')
      const midia = `midia/${await hashHex(bytes)}.${extensao}`
      registro.vira = midia
      this.midiaPorChave.set(registro.chave, { midia, bytes: bytes.length })
      if (!this.midias.has(midia)) this.midias.set(midia, { midia, caminho: registro.caminho, bytes: bytes.length })
    } catch (erro) {
      this.falhou(registro, `não deu para ler a imagem: ${motivoDe(erro)}`)
    }
  }

  midiaDe = (rel: string): string | null => this.midiaPorChave.get(chaveDoCaminho(rel))?.midia ?? null

  // ─── Ids ───────────────────────────────────────────────────────────────────

  /** O id do Grimório fica quando serve de nome de arquivo e não se repete; senão, o fixo do caminho. */
  async resolverIds(): Promise<void> {
    for (const registro of this.registros) {
      const entidade = this.entidadeDe(registro)
      if (entidade === null) continue
      const reserva = await idFixoDoCaminho(registro.caminho)
      const idBruto = entidade.bruto.id
      const idNoGrimorio = typeof idBruto === 'string' && idBruto !== '' ? idBruto : reserva
      if (idNoGrimorio === reserva) this.semId += 1
      const usados = this.idsUsados[ESPACO_DO_ID[entidade.tipo]]
      let id = idNoGrimorio
      if (!idDoPreparoValido(id)) {
        this.idsQueNaoServem += 1
        id = reserva
      } else if (usados.has(id)) {
        this.idsRepetidos += 1
        id = reserva
      }
      usados.add(id)
      if (!this.idNoPreludio.has(idNoGrimorio)) this.idNoPreludio.set(idNoGrimorio, id)
      const resolvida: Resolvida = { registro, entidade, id, idNoGrimorio }
      this.resolvidas.push(resolvida)
      this.porCaminho.set(registro.chave, resolvida)
      registro.vira = id
    }
  }

  private entidadeDe(registro: Registro): Entidade | null {
    const bruto = this.brutos.get(registro.chave)
    if (!ehRegistro(bruto) || !DESTINOS_LIDOS.has(registro.destino)) return null
    switch (registro.tipo) {
      case 'personagem':
      case 'cenario':
      case 'item':
      case 'pagina':
      case 'sessao':
      case 'caderno':
      case 'canvas':
      case 'mapa':
      case 'campanha':
        return { tipo: registro.tipo, bruto }
      default:
        return null
    }
  }

  idPara = (idDoGrimorio: string): string => this.idNoPreludio.get(idDoGrimorio) ?? idDoGrimorio

  avisosDosIds(): void {
    if (this.semId > 0) this.avisos.push(`${this.semId} arquivo(s) sem id ganharam um id fixo, tirado do caminho (o mesmo a cada reimportação).`)
    if (this.idsRepetidos > 0) this.avisos.push(`${this.idsRepetidos} arquivo(s) com id repetido ganharam o id fixo do caminho; as ligações seguem o primeiro.`)
    if (this.idsQueNaoServem > 0) this.avisos.push(`${this.idsQueNaoServem} id(s) do Grimório não servem de nome de arquivo e foram trocados pelo id fixo do caminho.`)
  }

  // ─── Organização: pastas, campanhas, vínculos ──────────────────────────────

  lerOrganizacao(): void {
    for (const registro of this.registros) {
      const bruto = this.brutos.get(registro.chave)
      if (!ehRegistro(bruto)) continue
      if (registro.tipo === 'pasta') this.pastas.set(chaveDoCaminho(pastaDe(registro.caminho)), normalizarPasta(bruto))
      if (registro.tipo === 'vinculos') this.lerVinculos(bruto)
    }
    for (const resolvida of this.resolvidas) {
      if (resolvida.entidade.tipo !== 'campanha' || resolvida.registro.classe.campanhaSlug === undefined) continue
      this.campanhaPorSlug.set(resolvida.registro.classe.campanhaSlug.toLowerCase(), resolvida.id)
      this.campanhaNoPreludio.set(resolvida.idNoGrimorio, resolvida.id)
    }
    this.contarParticipacoesSemCampanha()
  }

  private lerVinculos(bruto: Bruto): void {
    const { vinculos, descartados } = normalizarVinculos(bruto)
    this.contagemDeVinculos.validos = vinculos.length
    this.contagemDeVinculos.descartados = descartados
    for (const vinculo of vinculos) {
      if (vinculo.paraTipo !== 'campanha') {
        this.relacoes.push(vinculo)
        continue
      }
      if (vinculo.tipo !== TIPO_PARTICIPA) continue
      this.contagemDeVinculos.participacoes += 1
      if (vinculo.datas !== undefined) this.contagemDeVinculos.participacoesComData += 1
      const campanhas = this.participa.get(vinculo.deId) ?? new Set<string>()
      campanhas.add(vinculo.paraId)
      this.participa.set(vinculo.deId, campanhas)
    }
    if (descartados > 0) this.avisos.push(`${descartados} entrada(s) do vinculos.json estão incompletas e o próprio Grimório as ignora: ficam só no original.`)
  }

  /** As pastas acima de `pasta` dentro da seção (sem a raiz dela), de cima para baixo. */
  private pastasDaSecao(pasta: string): string[] {
    const partes = pasta.split('/')
    const saida: string[] = []
    for (let fim = 2; fim <= partes.length; fim += 1) saida.push(partes.slice(0, fim).join('/'))
    return saida
  }

  /**
   * As campanhas do que mora em `pasta`: a participação direta, a de cada pasta
   * e cenário acima (o filtro do Grimório libera a subárvore inteira,
   * `filtroCampanha.ts:22-41,75-100`) e a da campanha onde o arquivo mora.
   */
  campanhasDe(idNoGrimorio: string, pasta: string, campanhaSlug: string | undefined): string[] {
    const doGrimorio = new Set(this.participa.get(idNoGrimorio) ?? [])
    for (const acima of this.pastasDaSecao(pasta)) {
      const chave = chaveDoCaminho(acima)
      const pastaG = this.pastas.get(chave)
      if (pastaG?.id !== undefined) for (const campanha of this.participa.get(pastaG.id) ?? []) doGrimorio.add(campanha)
      const cenario = this.porCaminho.get(`${chave}/cenario.json`)
      if (cenario !== undefined) for (const campanha of this.participa.get(cenario.idNoGrimorio) ?? []) doGrimorio.add(campanha)
    }
    const campanhas = new Set<string>()
    if (campanhaSlug !== undefined) {
      const daPasta = this.campanhaPorSlug.get(campanhaSlug.toLowerCase())
      if (daPasta !== undefined) campanhas.add(daPasta)
    }
    for (const campanha of doGrimorio) {
      const noPreludio = this.campanhaNoPreludio.get(campanha)
      if (noPreludio !== undefined) campanhas.add(noPreludio)
    }
    return [...campanhas].sort(compararCaminhos)
  }

  /** Participações cuja campanha não está no cofre (na lixeira ou apagada): contadas uma vez cada. */
  private contarParticipacoesSemCampanha(): void {
    let semCampanha = 0
    for (const campanhas of this.participa.values()) for (const campanha of campanhas) if (!this.campanhaNoPreludio.has(campanha)) semCampanha += 1
    this.contagemDeVinculos.participacoesSemCampanha = semCampanha
  }

  /** Os nomes das pastas do Grimório acima do arquivo (sem os cenários, que viram `paiId`). */
  nomesDasPastas(pasta: string): string[] {
    return this.pastasDaSecao(pasta)
      .filter((acima) => !this.porCaminho.has(`${chaveDoCaminho(acima)}/cenario.json`))
      .map((acima) => this.pastas.get(chaveDoCaminho(acima))?.nome ?? nomeDe(acima))
  }

  /** O cenário-pai: a pasta mais próxima acima que também é cenário. */
  cenarioPai(pastaDoCenario: string): string | undefined {
    for (let acima = pastaDe(pastaDoCenario); acima.includes('/'); acima = pastaDe(acima)) {
      const pai = this.porCaminho.get(`${chaveDoCaminho(acima)}/cenario.json`)
      if (pai !== undefined) return pai.id
    }
    return undefined
  }

  resolvidaDoCaminho(caminho: string): Resolvida | undefined {
    return this.porCaminho.get(chaveDoCaminho(caminho))
  }

  // ─── Chat, Teia e lixeira (só leitura no Prelúdio) ─────────────────────────

  /** O chat de IA fica preso ao dono (sessão, caderno ou quadro); sem dono importado, só no original. */
  chats(): ChatDoGrimorio[] {
    const chats: ChatDoGrimorio[] = []
    for (const registro of this.registros) {
      const conteudo = this.brutos.get(registro.chave)
      if (registro.destino !== 'chat' || !ehRegistro(conteudo)) continue
      const dono = registro.classe.dono === undefined ? undefined : this.resolvidaDoCaminho(registro.classe.dono)
      if (dono === undefined || dono.registro.destino === 'soOriginal' || dono.registro.destino === 'falha') {
        this.soOriginal(registro, 'chat de IA sem a sessão ou o caderno dono na importação: guardado só como original')
        continue
      }
      registro.vira = dono.id
      chats.push({ donoId: dono.id, caminho: registro.caminho, conteudo })
    }
    return chats
  }

  /** As posições da Teia, com os ids (e as campanhas dos escopos) trocados pelos do Prelúdio. */
  teia(): TeiaDoGrimorio | null {
    const registro = this.registros.find((candidato) => candidato.destino === 'teia')
    const bruto = registro === undefined ? undefined : this.brutos.get(registro.chave)
    if (registro === undefined || !ehRegistro(bruto)) return null
    let invalidas = 0
    const escopos: [string, Record<string, PosicaoNaTeia>][] = []
    for (const [escopo, layout] of Object.entries(bruto)) {
      if (escopo === '' || !ehRegistro(layout)) {
        invalidas += 1
        continue
      }
      const posicoes: [string, PosicaoNaTeia][] = []
      for (const [id, posicao] of Object.entries(layout)) {
        if (id !== '' && ehPosicao(posicao)) posicoes.push([this.idPara(id), { x: posicao.x, y: posicao.y }])
        else invalidas += 1
      }
      const noPreludio = escopo.startsWith(ESCOPO_DE_CAMPANHA) ? `${ESCOPO_DE_CAMPANHA}${this.idPara(escopo.slice(ESCOPO_DE_CAMPANHA.length))}` : escopo
      // `fromEntries` cria a chave como dado, mesmo um id esquisito como "__proto__".
      escopos.push([noPreludio, Object.fromEntries(posicoes)])
    }
    if (invalidas > 0) this.avisos.push(`${invalidas} posição(ões) do layout-teia.json estão inválidas e o próprio Grimório as ignora: ficam só no original.`)
    registro.vira = 'teia'
    return { caminho: registro.caminho, porEscopo: Object.fromEntries(escopos) }
  }

  /** Cada pasta `.lixeira/<id>/` é uma entrada: o `entrada.json` e o que foi apagado, como vieram. */
  lixeira(): EntradaDaLixeira[] {
    const porEntrada = new Map<string, { caminho: string; conteudo: Record<string, unknown> }[]>()
    for (const registro of this.registros) {
      const conteudo = this.brutos.get(registro.chave)
      if (registro.destino !== 'lixeira' || !ehRegistro(conteudo)) continue
      const partes = registro.caminho.split('/')
      if (partes.length < 3) {
        this.soOriginal(registro, 'solto na lixeira, fora de uma entrada (.lixeira/<id>/): guardado só como original')
        continue
      }
      const arquivos = porEntrada.get(partes[1]) ?? []
      arquivos.push({ caminho: registro.caminho, conteudo })
      porEntrada.set(partes[1], arquivos)
      registro.vira = partes[1]
    }
    return [...porEntrada].map(([id, arquivos]) => ({ id, arquivos }))
  }
}

// ─── Conversão ───────────────────────────────────────────────────────────────

/** O que cada arquivo virou, com a chave do registro de onde saiu (para a conferência e o descarte). */
interface Saida {
  readonly verbetes: { readonly chave: string; readonly verbete: Verbete }[]
  readonly quadros: { readonly chave: string; readonly id: string; readonly quadro: Quadro }[]
  readonly campanhas: { readonly chave: string; readonly campanha: Campanha }[]
}

interface ExtraDoVerbete {
  readonly paiId?: string
  readonly pastas?: readonly string[]
  readonly campanhas?: readonly string[]
  readonly quadroId?: string
}

function metaDe(simulacao: Simulacao, resolvida: Resolvida, extra: ExtraDoVerbete = {}): MetaDoVerbete {
  const { registro } = resolvida
  return {
    id: resolvida.id,
    idNoGrimorio: resolvida.idNoGrimorio,
    caminho: registro.caminho,
    campanhas: extra.campanhas ?? simulacao.campanhasDe(resolvida.idNoGrimorio, pastaDe(registro.caminho), registro.classe.campanhaSlug),
    paiId: extra.paiId,
    pastas: extra.pastas,
    quadroId: extra.quadroId,
    datas: datasDe(resolvida.entidade.bruto),
  }
}

/** A página-mãe: outra página do mesmo caderno (pelo `paiId` do Grimório) ou, na raiz, a sessão ou o caderno dono. */
function paiDaPagina(simulacao: Simulacao, resolvida: Resolvida, paiIdNoGrimorio: string | null, dono: Resolvida | undefined): string | undefined {
  const caminhoDoDono = resolvida.registro.classe.dono
  if (paiIdNoGrimorio !== null) {
    const irma = simulacao.resolvidas.find(
      (outra) => outra.entidade.tipo === 'pagina' && outra.idNoGrimorio === paiIdNoGrimorio && outra.registro.classe.dono === caminhoDoDono,
    )
    if (irma !== undefined) return irma.id
  }
  return dono !== undefined && (dono.entidade.tipo === 'sessao' || dono.entidade.tipo === 'caderno') ? dono.id : undefined
}

function converterPagina(simulacao: Simulacao, conversor: Conversor, resolvida: Resolvida, saida: Saida): void {
  const { entidade, registro } = resolvida
  const pagina = normalizarPagina(entidade.bruto, resolvida.idNoGrimorio)
  const dono = registro.classe.dono === undefined ? undefined : simulacao.resolvidaDoCaminho(registro.classe.dono)
  const paiId = paiDaPagina(simulacao, resolvida, pagina.paiId, dono)
  // O caderno de um canvas ou mapa (`buscaPaginas.ts:12`): a página-raiz guarda o quadro dono.
  const quadroId = paiId === undefined && dono !== undefined && ESPACO_DO_ID[dono.entidade.tipo] === 'quadro' ? dono.id : undefined
  if (paiId === undefined && quadroId === undefined) {
    simulacao.avisos.push(`A página ${registro.caminho} não tem página-mãe nem documento dono (sessão, caderno, canvas ou mapa) no cofre: entra na raiz.`)
  }
  const campanhas = dono === undefined ? [] : simulacao.campanhasDe(dono.idNoGrimorio, pastaDe(dono.registro.caminho), dono.registro.classe.campanhaSlug)
  saida.verbetes.push({ chave: registro.chave, verbete: conversor.pagina(pagina, metaDe(simulacao, resolvida, { paiId, quadroId, campanhas })) })
}

function converterUma(simulacao: Simulacao, conversor: Conversor, resolvida: Resolvida, saida: Saida): void {
  const { entidade, registro } = resolvida
  const { chave } = registro
  const pasta = pastaDe(registro.caminho)
  const origem = { id: resolvida.idNoGrimorio, caminho: registro.caminho }
  switch (entidade.tipo) {
    case 'personagem':
      saida.verbetes.push({ chave, verbete: conversor.personagem(normalizarPersonagem(entidade.bruto, resolvida.idNoGrimorio), metaDe(simulacao, resolvida, { pastas: simulacao.nomesDasPastas(pasta) })) })
      return
    case 'item':
      saida.verbetes.push({ chave, verbete: conversor.item(normalizarItem(entidade.bruto, resolvida.idNoGrimorio), metaDe(simulacao, resolvida, { pastas: simulacao.nomesDasPastas(pasta) })) })
      return
    case 'cenario': {
      const extra = { pastas: simulacao.nomesDasPastas(pastaDe(pasta)), paiId: simulacao.cenarioPai(pasta) }
      saida.verbetes.push({ chave, verbete: conversor.cenario(normalizarCenario(entidade.bruto, resolvida.idNoGrimorio), metaDe(simulacao, resolvida, extra)) })
      return
    }
    case 'pagina':
      converterPagina(simulacao, conversor, resolvida, saida)
      return
    case 'sessao':
    case 'caderno': {
      const documento = normalizarDocumento(entidade.bruto, resolvida.idNoGrimorio)
      const meta = metaDe(simulacao, resolvida)
      saida.verbetes.push({ chave, verbete: conversor.documento(entidade.tipo === 'sessao' ? 'sessao' : 'pagina', documento, meta) })
      if (entidade.tipo === 'sessao') {
        const quadro = conversor.quadro(documento, { campanhaId: meta.campanhas.at(0), sessaoId: resolvida.id, origem, datas: datasDe(entidade.bruto) })
        saida.quadros.push({ chave, id: resolvida.id, quadro })
      }
      return
    }
    case 'canvas':
    case 'mapa': {
      const campanhas = simulacao.campanhasDe(resolvida.idNoGrimorio, pasta, registro.classe.campanhaSlug)
      if (campanhas.length > 1) simulacao.avisos.push(`O quadro ${registro.caminho} está em ${campanhas.length} campanhas; o Prelúdio guarda a primeira.`)
      const quadro = conversor.quadro(normalizarDocumento(entidade.bruto, resolvida.idNoGrimorio), { campanhaId: campanhas.at(0), origem, datas: datasDe(entidade.bruto) })
      saida.quadros.push({ chave, id: resolvida.id, quadro })
      return
    }
    case 'campanha':
      saida.campanhas.push({ chave, campanha: campanhaDoGrimorio(normalizarCampanha(entidade.bruto, resolvida.idNoGrimorio), resolvida.id, registro.caminho, datasDe(entidade.bruto)) })
      return
  }
}

async function ligacoesDe(simulacao: Simulacao, conversor: Conversor): Promise<Ligacao[]> {
  const usados = new Set<string>()
  const ligacoes: Ligacao[] = []
  for (const vinculo of simulacao.relacoes) {
    const id = idDoPreparoValido(vinculo.id) && !usados.has(vinculo.id) ? vinculo.id : await idFixoDoCaminho(`vinculos.json#${vinculo.id}`)
    usados.add(id)
    ligacoes.push(conversor.ligacao(vinculo, id))
  }
  return ligacoes
}

// ─── Conferência ─────────────────────────────────────────────────────────────

interface Validada {
  readonly verbetes: Verbete[]
  readonly quadros: QuadroComId[]
  readonly campanhas: Campanha[]
  readonly ligacoes: Ligacao[]
  readonly bytes: number
}

/**
 * Grava o hash da importação em tudo e confere cada um pelo molde. O arquivo que
 * reprovar sai do plano INTEIRO (a sessão leva junto o quadro dela) e volta a
 * ser "só original", com o motivo; a ligação que reprovar sai com aviso.
 */
async function validarSaida(simulacao: Simulacao, saida: Saida, ligacoes: readonly Ligacao[]): Promise<Validada> {
  const verbetes = await Promise.all(saida.verbetes.map(async ({ chave, verbete }) => ({ chave, verbete: await comHashDaImportacao(verbete) })))
  const quadros = await Promise.all(saida.quadros.map(async ({ chave, id, quadro }) => ({ chave, id, quadro: await quadroComHash(quadro) })))
  const campanhas = await Promise.all(saida.campanhas.map(async ({ chave, campanha }) => ({ chave, campanha: await campanhaComHash(campanha) })))
  const conferidos = new Map<object, Conferido>()
  const reprovados = new Map<string, string>()
  const conferir = (chave: string, oQue: string, valor: object, conferido: Conferido) => {
    conferidos.set(valor, conferido)
    if (!conferido.ok && !reprovados.has(chave)) reprovados.set(chave, `${oQue} não passou na conferência (${conferido.motivo})`)
  }
  for (const { chave, verbete } of verbetes) conferir(chave, 'o verbete', verbete, noDisco(ARQUIVO_DO_VERBETE, verbete))
  for (const { chave, quadro } of quadros) conferir(chave, 'o quadro', quadro, noDisco(ARQUIVO_DO_QUADRO, quadro))
  for (const { chave, campanha } of campanhas) conferir(chave, 'a campanha', campanha, peloMolde(CAMPANHA, campanha))
  for (const [chave, motivo] of reprovados) {
    const registro = simulacao.registroDaChave(chave)
    if (registro === undefined) continue
    simulacao.soOriginal(registro, `${motivo}: guardado só como original`)
    simulacao.avisos.push(`${registro.caminho}: ${motivo}; fica só no original.`)
  }
  const aprovado = (chave: string) => !reprovados.has(chave)
  const ligacoesComHash = await Promise.all(ligacoes.map(ligacaoComHash))
  const ligacoesAprovadas = ligacoesComHash.filter((ligacao) => {
    const conferido = peloMolde(LIGACAO, ligacao)
    conferidos.set(ligacao, conferido)
    if (!conferido.ok) simulacao.avisos.push(`A ligação ${ligacao.id} não passou na conferência (${conferido.motivo}): fica só no original (vinculos.json).`)
    return conferido.ok
  })
  const validada = {
    verbetes: verbetes.filter(({ chave }) => aprovado(chave)).map(({ verbete }) => verbete),
    quadros: quadros.filter(({ chave }) => aprovado(chave)).map(({ id, quadro }) => ({ id, quadro })),
    campanhas: campanhas.filter(({ chave }) => aprovado(chave)).map(({ campanha }) => campanha),
    ligacoes: ligacoesAprovadas,
  }
  const bytesDe = (valor: object) => {
    const conferido = conferidos.get(valor)
    return conferido !== undefined && conferido.ok ? conferido.bytes : 0
  }
  const bytes = [...validada.verbetes, ...validada.quadros.map(({ quadro }) => quadro)].reduce((soma, valor) => soma + bytesDe(valor), 0)
  return { ...validada, bytes }
}

/** Conta quantas vezes cada saída foi pedida por um arquivo do cofre. */
function marcar(contagem: Map<string, number>, id: string): void {
  contagem.set(id, (contagem.get(id) ?? 0) + 1)
}

/**
 * A regra do plano (§4, passo 5), conferida de verdade: cada arquivo do
 * inventário aparece uma vez no relatório; o destino declarado tem a saída no
 * plano (verbete, quadro, campanha, mídia, chat, Teia, lixeira); e cada saída do
 * plano vem de exatamente um arquivo. Devolve os problemas (vazio = certo).
 */
function conferirDestinos(inventariados: readonly string[], registros: readonly Registro[], plano: PlanoDaImportacao): string[] {
  const problemas: string[] = []
  const caminhos = new Set(registros.map((registro) => registro.caminho))
  if (registros.length !== inventariados.length || caminhos.size !== registros.length || inventariados.some((caminho) => !caminhos.has(caminho))) {
    problemas.push('o relatório não tem cada arquivo do inventário exatamente uma vez')
  }
  const noPlano = {
    verbete: new Set(plano.verbetes.map((verbete) => verbete.id)),
    quadro: new Set(plano.quadros.map((quadro) => quadro.id)),
    campanha: new Set(plano.indice.campanhas.map((campanha) => campanha.id)),
    midia: new Set(plano.midias.map((midia) => midia.midia)),
  }
  const pedidos = { verbete: new Map<string, number>(), quadro: new Map<string, number>(), campanha: new Map<string, number>(), midia: new Map<string, number>() }
  const chats = new Set(plano.chats.map((chat) => chat.caminho))
  const daLixeira = new Set(plano.lixeira.flatMap((entrada) => entrada.arquivos.map((arquivo) => arquivo.caminho)))
  const semSaida = (registro: Registro) => problemas.push(`${registro.caminho}: o destino é "${registro.destino}", mas o plano não tem o que ele vira`)
  for (const registro of registros) {
    const vira = registro.vira ?? ''
    switch (registro.destino) {
      case 'verbete':
      case 'quadro':
      case 'campanha':
      case 'midia': {
        const espaco = registro.destino
        if (!noPlano[espaco].has(vira)) semSaida(registro)
        if (espaco !== 'midia') marcar(pedidos[espaco], vira)
        else pedidos.midia.set(vira, 1)
        // A sessão vira verbete E o quadro dela, com o mesmo id.
        if (registro.tipo === 'sessao') {
          if (!noPlano.quadro.has(vira)) semSaida(registro)
          marcar(pedidos.quadro, vira)
        }
        break
      }
      case 'chat':
        if (!chats.has(registro.caminho)) semSaida(registro)
        break
      case 'lixeira':
        if (!daLixeira.has(registro.caminho)) semSaida(registro)
        break
      case 'teia':
        if (plano.teia?.caminho !== registro.caminho) semSaida(registro)
        break
      case 'ligacoes':
      case 'organizacao':
      case 'soOriginal':
      case 'ignorado':
      case 'falha':
        break
    }
  }
  for (const espaco of ESPACOS_DO_PLANO) {
    for (const id of noPlano[espaco]) {
      const vezes = pedidos[espaco].get(id) ?? 0
      if (vezes !== 1) problemas.push(`${espaco} ${id}: no plano, mas vem de ${vezes} arquivo(s) do cofre`)
    }
  }
  const comDestino = (destino: Destino) => new Set(registros.filter((registro) => registro.destino === destino).map((registro) => registro.caminho))
  const registrosDeChat = comDestino('chat')
  const registrosDaLixeira = comDestino('lixeira')
  for (const caminho of chats) if (!registrosDeChat.has(caminho)) problemas.push(`chat ${caminho}: no plano, sem o destino "chat"`)
  for (const caminho of daLixeira) if (!registrosDaLixeira.has(caminho)) problemas.push(`lixeira ${caminho}: no plano, sem o destino "lixeira"`)
  if (plano.teia !== null && !comDestino('teia').has(plano.teia.caminho)) problemas.push(`teia ${plano.teia.caminho}: no plano, sem o destino "teia"`)
  return problemas
}

// ─── Relatório ───────────────────────────────────────────────────────────────

function contagensDe(simulacao: Simulacao, quadros: number): Contagens {
  const doTipo = (tipo: TipoNoGrimorio) => simulacao.registros.filter((registro) => registro.tipo === tipo).length
  const lixeira = new Set(simulacao.registros.filter((registro) => registro.tipo === 'lixeira').map((registro) => registro.chave.split('/')[1]))
  return {
    campanhas: doTipo('campanha'),
    sessoes: doTipo('sessao'),
    cadernos: doTipo('caderno'),
    paginas: doTipo('pagina'),
    personagens: doTipo('personagem'),
    cenarios: doTipo('cenario'),
    itens: doTipo('item'),
    quadros,
    vinculos: simulacao.contagemDeVinculos.validos,
    participacoes: simulacao.contagemDeVinculos.participacoes,
    relacoes: simulacao.relacoes.length,
    imagens: doTipo('imagem'),
    imagensUnicas: simulacao.midias.size,
    chats: doTipo('chat'),
    pastas: doTipo('pasta'),
    lixeira: lixeira.size,
  }
}

function espacoDe(necessarioBytes: number, livreBytes: number | null): EspacoEmDisco {
  const sobraDepoisBytes = livreBytes === null ? null : livreBytes - necessarioBytes
  return { necessarioBytes, livreBytes, minimoQueSobraBytes: MINIMO_QUE_SOBRA_BYTES, sobraDepoisBytes, cabe: sobraDepoisBytes === null ? null : sobraDepoisBytes >= MINIMO_QUE_SOBRA_BYTES }
}

function arquivoNoRelatorio(registro: Registro): ArquivoNoRelatorio {
  const arquivo: { -readonly [K in keyof ArquivoNoRelatorio]: ArquivoNoRelatorio[K] } = { caminho: registro.caminho, bytes: registro.bytes, tipo: registro.tipo, destino: registro.destino }
  if (registro.motivo !== undefined) arquivo.motivo = registro.motivo
  if (registro.vira !== undefined && registro.destino !== 'falha' && registro.destino !== 'soOriginal') arquivo.vira = registro.vira
  return arquivo
}

function falhasDe(simulacao: Simulacao, pastasIlegiveis: readonly PastaIlegivel[]): { caminho: string; motivo: string }[] {
  return [
    ...pastasIlegiveis.map((pasta) => ({ caminho: pasta.caminho, motivo: `pasta que não deu para listar: ${pasta.motivo}` })),
    ...simulacao.registros.filter((registro) => registro.destino === 'falha').map((registro) => ({ caminho: registro.caminho, motivo: registro.motivo ?? 'falha' })),
  ]
}

function avisosDasCopias(simulacao: Simulacao, copias: CopiasDeConflito): void {
  if (copias.pastasIlegiveis.length > 0) {
    const pastas = copias.pastasIlegiveis.map((pasta) => `"${pasta.caminho === '' ? 'a pasta escolhida' : pasta.caminho}" (${pasta.motivo})`).join('; ')
    simulacao.avisos.push(`A comparação das cópias de conflito NÃO foi feita dentro de ${copias.pastasIlegiveis.length} pasta(s) que não deu para listar: ${pastas}. O relatório não sabe se elas têm algo a mais.`)
  }
  if (copias.naoLidas > 0) simulacao.avisos.push(`${copias.naoLidas} cópia(s) de conflito não deram para comparar (só na nuvem, atalho, JSON quebrado ou erro de leitura): confira à mão.`)
  if (copias.comCoisaAMais > 0) simulacao.avisos.push(`${copias.comCoisaAMais} cópia(s) de conflito têm campo, item ou palavra que o original não tem: confira antes de largar as cópias.`)
  if (copias.soDiferencas > 0) simulacao.avisos.push(`${copias.soDiferencas} cópia(s) de conflito têm valores diferentes do original, sem nada novo (versão mais velha ou com menos): confira se quiser.`)
  const semOriginal = copias.comparacoes.filter((comparacao) => comparacao.situacao === 'semOriginal').length
  if (semOriginal > 0) simulacao.avisos.push(`${semOriginal} cópia(s) de conflito não têm mais original no cofre.`)
  const naLixeira = copias.comparacoes.filter((comparacao) => comparacao.naLixeira).length
  if (naLixeira > 0) simulacao.avisos.push(`${naLixeira} cópia(s) de conflito são de um original que está na lixeira do Grimório (comparadas com ele).`)
}

function avisosDoTexto(simulacao: Simulacao, conversor: Conversor): void {
  if (conversor.naoEntendidos > 0) simulacao.avisos.push(`${conversor.naoEntendidos} trecho(s) de HTML com etiqueta que o editor não conhece viraram texto simples (o HTML original fica guardado).`)
  if (conversor.imagensSemArquivo.size > 0) simulacao.avisos.push(`${conversor.imagensSemArquivo.size} imagem(ns) citadas nas fichas, páginas ou quadros não existem no cofre.`)
  const { participacoesSemCampanha, participacoesComData } = simulacao.contagemDeVinculos
  if (participacoesSemCampanha > 0) simulacao.avisos.push(`${participacoesSemCampanha} participação(ões) apontam para campanha que não está no cofre (na lixeira ou apagada): ficam de fora das etiquetas.`)
  if (participacoesComData > 0) simulacao.avisos.push(`A data de criação de ${participacoesComData} participação(ões) ("participa") fica só no original: no Prelúdio a participação vira etiqueta de campanha, sem data.`)
}

/** Caminho do cofre (pela `chaveDoCaminho`: o cofre cita `imagens/…`, o disco tem `Imagens/…`) → `midia/…`. */
function tabelaDeMidiaDe(registros: readonly Registro[]): Record<string, string> {
  const pares: [string, string][] = []
  for (const registro of registros) if (registro.destino === 'midia' && registro.vira !== undefined) pares.push([registro.chave, registro.vira])
  // `fromEntries` cria a chave como dado, mesmo um nome esquisito.
  return Object.fromEntries(pares)
}

/** A simulação inteira. Só lê; o resultado diz o que o "Aplicar" gravaria. */
export async function simularImportacao(leitor: LeitorDoCofre, opcoes: OpcoesDaSimulacao = {}): Promise<ResultadoDaSimulacao> {
  const inventario = await inventariar(leitor)
  const simulacao = new Simulacao(leitor, inventario.arquivos, opcoes.aoAvancar ?? (() => undefined))
  await simulacao.lerJsons()
  await simulacao.lerImagens()
  await simulacao.resolverIds()
  simulacao.lerOrganizacao()
  simulacao.avisosDosIds()

  const conversor = new Conversor(simulacao.midiaDe, simulacao.idPara)
  const saida: Saida = { verbetes: [], quadros: [], campanhas: [] }
  for (const resolvida of simulacao.resolvidas) converterUma(simulacao, conversor, resolvida, saida)
  const validada = await validarSaida(simulacao, saida, await ligacoesDe(simulacao, conversor))
  const ligacoes = { formato: ARQUIVO_DAS_LIGACOES.formato, ligacoes: validada.ligacoes }
  const indice = { formato: ARQUIVO_DO_INDICE.formato, campanhas: validada.campanhas }
  const midias = [...simulacao.midias.values()]
  const completo: PlanoDaImportacao = {
    modo: 'importacao',
    indice,
    verbetes: validada.verbetes,
    quadros: validada.quadros,
    ligacoes,
    midias,
    chats: simulacao.chats(),
    teia: simulacao.teia(),
    lixeira: simulacao.lixeira(),
  }

  const copias = opcoes.copiasDeConflito === undefined ? null : await compararCopiasDeConflito(opcoes.copiasDeConflito, leitor, new Map(inventario.arquivos.map((arquivo) => [chaveDoCaminho(arquivo.caminho), arquivo])))
  avisosDoTexto(simulacao, conversor)
  if (copias !== null) avisosDasCopias(simulacao, copias)
  const existentes = opcoes.existentes
  const reimportacao = existentes === undefined ? null : await planejarReimportacao(existentes, validada)
  const plano = existentes === undefined || reimportacao === null ? completo : planoDaReimportacao(completo, existentes, reimportacao)

  const arquivos = simulacao.registros.map(arquivoNoRelatorio)
  const falhas = falhasDe(simulacao, inventario.pastasIlegiveis)
  const originais = arquivos.filter((arquivo) => arquivo.caminho.toLowerCase().endsWith('.json') || arquivo.destino === 'soOriginal').reduce((soma, arquivo) => soma + arquivo.bytes, 0)
  const doIndice = noDisco(ARQUIVO_DO_INDICE, plano.indice)
  const dasLigacoes = noDisco(ARQUIVO_DAS_LIGACOES, plano.ligacoes)
  const deTudo = [...plano.chats.map((chat) => chat.conteudo), plano.teia?.porEscopo ?? {}, ...plano.lixeira.flatMap((entrada) => entrada.arquivos.map((arquivo) => arquivo.conteudo))]
  const doSoLeitura = deTudo.reduce<number>((soma, valor) => soma + bytesDoTexto(JSON.stringify(valor, null, 2)), 0)
  const necessario =
    midias.reduce((soma, midia) => soma + midia.bytes, 0) + validada.bytes + originais + doSoLeitura + (doIndice.ok ? doIndice.bytes : 0) + (dasLigacoes.ok ? dasLigacoes.bytes : 0)
  const espaco = espacoDe(necessario, opcoes.espacoLivreBytes ?? null)
  const problemas = conferirDestinos(inventario.arquivos.map((arquivo) => arquivo.caminho), simulacao.registros, completo)
  for (const problema of problemas.slice(0, PROBLEMAS_LISTADOS)) simulacao.avisos.push(`Conferência de destino: ${problema}.`)
  if (problemas.length > PROBLEMAS_LISTADOS) simulacao.avisos.push(`Conferência de destino: e mais ${problemas.length - PROBLEMAS_LISTADOS} problema(s).`)
  if (!doIndice.ok) simulacao.avisos.push(`O índice das campanhas (preparo.json) não passou na conferência (${doIndice.motivo}).`)
  if (!dasLigacoes.ok) simulacao.avisos.push(`As ligações (ligacoes.json) não passaram na conferência (${dasLigacoes.motivo}).`)

  const motivosParaNaoAplicar: string[] = []
  if (falhas.length > 0) motivosParaNaoAplicar.push(`${falhas.length} arquivo(s) ou pasta(s) não foram lidos.`)
  if (espaco.cabe === null) motivosParaNaoAplicar.push('O espaço livre no disco não foi medido: sem a medida, não dá para garantir os 8 GB que precisam sobrar.')
  if (espaco.cabe === false) motivosParaNaoAplicar.push('Depois de importar sobrariam menos de 8 GB livres no disco.')
  if (problemas.length > 0) motivosParaNaoAplicar.push('Algum arquivo do cofre ficou sem destino, com mais de um, ou sem a saída no plano.')
  if (!doIndice.ok || !dasLigacoes.ok) motivosParaNaoAplicar.push('O índice das campanhas ou as ligações não passaram na conferência.')

  return {
    plano,
    relatorio: {
      formato: FORMATO_DO_RELATORIO,
      geradoEm: (opcoes.agora ?? (() => new Date()))().toISOString(),
      cofre: { arquivos: arquivos.length, bytes: arquivos.reduce((soma, arquivo) => soma + arquivo.bytes, 0) },
      cadaArquivoUmDestino: problemas.length === 0,
      destinos: somarPorDestino(arquivos),
      porTipo: somarPorTipo(arquivos),
      contagens: contagensDe(simulacao, completo.quadros.length),
      saida: {
        verbetes: registroDe(TIPOS_DE_VERBETE, (tipo) => plano.verbetes.filter((verbete) => verbete.tipo === tipo).length),
        quadros: plano.quadros.length,
        ligacoes: plano.ligacoes.ligacoes.length,
        campanhas: plano.indice.campanhas.length,
        midias: plano.midias.length,
        chats: plano.chats.length,
        teia: plano.teia === null ? 0 : 1,
        lixeira: plano.lixeira.length,
      },
      espaco,
      podeAplicar: motivosParaNaoAplicar.length === 0,
      motivosParaNaoAplicar,
      avisos: simulacao.avisos,
      falhas,
      copiasDeConflito: copias,
      reimportacao,
      arquivos,
      tabelaDeMidia: tabelaDeMidiaDe(simulacao.registros),
    },
  }
}
