import { tipoDosBytes, hashHex } from '../../midia'
import { idDoPreparoValido } from '../disco'
import { ehRegistro } from '../molde'
import { ARQUIVO_DAS_LIGACOES, ARQUIVO_DO_INDICE, ARQUIVO_DO_QUADRO, ARQUIVO_DO_VERBETE, type ArquivoDoPreparo, type Campanha, type Ligacao, type Quadro, type TipoDeVerbete, type Verbete } from '../tipos'
import { classificar, type Classificacao, type Destino, type TipoNoGrimorio } from './classificar'
import { chaveDoCaminho, compararCaminhos, extensaoDe, idFixoDoCaminho, nomeDe, pastaDe, type LeitorDoCofre } from './cofre'
import { compararCopiasDeConflito, type CopiasDeConflito } from './conflitos'
import { campanhaDoGrimorio, Conversor, type MetaDoVerbete } from './converter'
import {
  TIPO_PARTICIPA,
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
import { comHashDaImportacao, planejarReimportacao } from './reimportar'
import {
  FORMATO_DO_RELATORIO,
  MINIMO_QUE_SOBRA_BYTES,
  registroDe,
  somarPorDestino,
  somarPorTipo,
  type ArquivoNoRelatorio,
  type Contagens,
  type EspacoEmDisco,
  type PlanoDaImportacao,
  type ResultadoDaSimulacao,
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
  /** Espaço livre no disco do Prelúdio; `null`/ausente = não medido. */
  readonly espacoLivreBytes?: number | null
  /** O que já está no Prelúdio: o relatório traz o plano da reimportação. */
  readonly existentes?: readonly Verbete[]
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
const DESTINOS_LIDOS: ReadonlySet<Destino> = new Set(['verbete', 'quadro', 'ligacoes', 'campanha', 'organizacao'])
const TIPOS_DE_VERBETE: readonly TipoDeVerbete[] = ['personagem', 'lugar', 'item', 'faccao', 'pagina', 'sessao']
const ESPACO_DO_ID: Readonly<Record<Entidade['tipo'], 'verbete' | 'quadro' | 'campanha'>> = {
  personagem: 'verbete', cenario: 'verbete', item: 'verbete', pagina: 'verbete', sessao: 'verbete', caderno: 'verbete',
  canvas: 'quadro', mapa: 'quadro', campanha: 'campanha',
}

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

/** O texto que o "Aplicar" gravaria, conferido pelo próprio molde (o mesmo teste de `disco.ts`). */
function noDisco<T extends { formato: number }>(arquivo: ArquivoDoPreparo<T>, valor: T): { ok: true; bytes: number } | { ok: false; motivo: string } {
  const texto = JSON.stringify(arquivo.molde.gravar({ ...valor, formato: arquivo.formato }), null, 2)
  const deVolta = arquivo.molde.ler(JSON.parse(texto), '')
  return deVolta.ok ? { ok: true, bytes: bytesDoTexto(texto) } : { ok: false, motivo: deVolta.motivo }
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
  contagemDeVinculos = { validos: 0, participacoes: 0, descartados: 0, participacoesSemCampanha: 0 }
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

  private soOriginal(registro: Registro, motivo: string): void {
    registro.destino = 'soOriginal'
    registro.motivo = motivo
  }

  // ─── Leitura ───────────────────────────────────────────────────────────────

  async lerJsons(): Promise<void> {
    const alvos = this.registros.filter((registro) => DESTINOS_LIDOS.has(registro.destino))
    let feitos = 0
    await Promise.all(
      alvos.map(async (registro) => {
        try {
          const bruto: unknown = JSON.parse(await this.leitor.lerTexto(registro.caminho))
          if (ehRegistro(bruto)) this.brutos.set(registro.chave, bruto)
          else this.soOriginal(registro, 'o JSON não é um objeto: guardado só como original')
        } catch (erro) {
          if (erro instanceof SyntaxError) this.soOriginal(registro, 'JSON quebrado: guardado só como original')
          else this.falhou(registro, `não deu para ler: ${motivoDe(erro)}`)
        }
        feitos += 1
        this.aoAvancar(feitos, alvos.length)
      }),
    )
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
}

// ─── Conversão ───────────────────────────────────────────────────────────────

interface Saida {
  readonly verbetes: Verbete[]
  readonly quadros: { id: string; quadro: Quadro }[]
  readonly campanhas: Campanha[]
}

function metaDe(simulacao: Simulacao, resolvida: Resolvida, extra: { paiId?: string; pastas?: string[]; campanhas?: string[] } = {}): MetaDoVerbete {
  const { registro } = resolvida
  const campanhas = extra.campanhas ?? simulacao.campanhasDe(resolvida.idNoGrimorio, pastaDe(registro.caminho), registro.classe.campanhaSlug)
  return { id: resolvida.id, idNoGrimorio: resolvida.idNoGrimorio, caminho: registro.caminho, campanhas, ...extra }
}

/** A página-mãe: outra página do mesmo caderno (pelo `paiId` do Grimório) ou, na raiz, o caderno ou a sessão dona. */
function paiDaPagina(simulacao: Simulacao, resolvida: Resolvida, paiIdNoGrimorio: string | null): string | undefined {
  const dono = resolvida.registro.classe.dono
  if (paiIdNoGrimorio !== null) {
    const irma = simulacao.resolvidas.find(
      (outra) => outra.entidade.tipo === 'pagina' && outra.idNoGrimorio === paiIdNoGrimorio && outra.registro.classe.dono === dono,
    )
    if (irma !== undefined) return irma.id
  }
  const doDono = dono === undefined ? undefined : simulacao.resolvidaDoCaminho(dono)
  return doDono !== undefined && (doDono.entidade.tipo === 'sessao' || doDono.entidade.tipo === 'caderno') ? doDono.id : undefined
}

function converterUma(simulacao: Simulacao, conversor: Conversor, resolvida: Resolvida, saida: Saida): void {
  const { entidade, registro } = resolvida
  const pasta = pastaDe(registro.caminho)
  switch (entidade.tipo) {
    case 'personagem':
      saida.verbetes.push(conversor.personagem(normalizarPersonagem(entidade.bruto, resolvida.idNoGrimorio), metaDe(simulacao, resolvida, { pastas: simulacao.nomesDasPastas(pasta) })))
      return
    case 'item':
      saida.verbetes.push(conversor.item(normalizarItem(entidade.bruto, resolvida.idNoGrimorio), metaDe(simulacao, resolvida, { pastas: simulacao.nomesDasPastas(pasta) })))
      return
    case 'cenario': {
      const extra: { paiId?: string; pastas: string[] } = { pastas: simulacao.nomesDasPastas(pastaDe(pasta)) }
      const paiId = simulacao.cenarioPai(pasta)
      if (paiId !== undefined) extra.paiId = paiId
      saida.verbetes.push(conversor.cenario(normalizarCenario(entidade.bruto, resolvida.idNoGrimorio), metaDe(simulacao, resolvida, extra)))
      return
    }
    case 'pagina': {
      const pagina = normalizarPagina(entidade.bruto, resolvida.idNoGrimorio)
      const paiId = paiDaPagina(simulacao, resolvida, pagina.paiId)
      if (paiId === undefined) simulacao.avisos.push(`A página ${registro.caminho} não tem página-mãe, caderno nem sessão no cofre: entra na raiz.`)
      const dono = registro.classe.dono === undefined ? undefined : simulacao.resolvidaDoCaminho(registro.classe.dono)
      const campanhas = dono === undefined ? [] : simulacao.campanhasDe(dono.idNoGrimorio, pastaDe(dono.registro.caminho), dono.registro.classe.campanhaSlug)
      saida.verbetes.push(conversor.pagina(pagina, metaDe(simulacao, resolvida, paiId === undefined ? { campanhas } : { paiId, campanhas })))
      return
    }
    case 'sessao':
    case 'caderno': {
      const documento = normalizarDocumento(entidade.bruto, resolvida.idNoGrimorio)
      const meta = metaDe(simulacao, resolvida)
      saida.verbetes.push(conversor.documento(entidade.tipo === 'sessao' ? 'sessao' : 'pagina', documento, meta))
      if (entidade.tipo === 'sessao') saida.quadros.push({ id: resolvida.id, quadro: conversor.quadro(documento, meta.campanhas[0], resolvida.id) })
      return
    }
    case 'canvas':
    case 'mapa': {
      const campanhas = simulacao.campanhasDe(resolvida.idNoGrimorio, pasta, registro.classe.campanhaSlug)
      if (campanhas.length > 1) simulacao.avisos.push(`O quadro ${registro.caminho} está em ${campanhas.length} campanhas; o Prelúdio guarda a primeira.`)
      saida.quadros.push({ id: resolvida.id, quadro: conversor.quadro(normalizarDocumento(entidade.bruto, resolvida.idNoGrimorio), campanhas[0], undefined) })
      return
    }
    case 'campanha':
      saida.campanhas.push(campanhaDoGrimorio(normalizarCampanha(entidade.bruto, resolvida.idNoGrimorio), resolvida.id))
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

// ─── Relatório ───────────────────────────────────────────────────────────────

function contagensDe(simulacao: Simulacao, saida: Saida): Contagens {
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
    quadros: saida.quadros.length,
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

/** Confere a regra do plano: cada arquivo do inventário aparece uma vez, com um destino. */
function cadaUmComUmDestino(inventariados: readonly string[], arquivos: readonly ArquivoNoRelatorio[]): boolean {
  const vistos = new Set(arquivos.map((arquivo) => arquivo.caminho))
  return arquivos.length === inventariados.length && vistos.size === arquivos.length && inventariados.every((caminho) => vistos.has(caminho))
}

/** Converte cada verbete e quadro e confere pelo molde; o que não passar volta a ser "só original", com o motivo. */
async function validarSaida(simulacao: Simulacao, saida: Saida): Promise<{ verbetes: Verbete[]; bytes: number }> {
  let bytes = 0
  const verbetes: Verbete[] = []
  for (const verbete of saida.verbetes) {
    const conferido = noDisco(ARQUIVO_DO_VERBETE, verbete)
    if (conferido.ok) {
      bytes += conferido.bytes
      verbetes.push(await comHashDaImportacao(verbete))
    } else {
      simulacao.avisos.push(`O verbete ${verbete.id} não passou na conferência (${conferido.motivo}): fica só no original.`)
    }
  }
  for (const { quadro } of saida.quadros) {
    const conferido = noDisco(ARQUIVO_DO_QUADRO, quadro)
    if (conferido.ok) bytes += conferido.bytes
    else simulacao.avisos.push(`O quadro ${quadro.nome} não passou na conferência (${conferido.motivo}).`)
  }
  return { verbetes, bytes }
}

function falhasDe(simulacao: Simulacao, pastasIlegiveis: readonly PastaIlegivel[]): { caminho: string; motivo: string }[] {
  return [
    ...pastasIlegiveis.map((pasta) => ({ caminho: pasta.caminho, motivo: `pasta que não deu para listar: ${pasta.motivo}` })),
    ...simulacao.registros.filter((registro) => registro.destino === 'falha').map((registro) => ({ caminho: registro.caminho, motivo: registro.motivo ?? 'falha' })),
  ]
}

function avisosDoTexto(simulacao: Simulacao, conversor: Conversor, copias: CopiasDeConflito | null): void {
  if (conversor.naoEntendidos > 0) simulacao.avisos.push(`${conversor.naoEntendidos} trecho(s) de HTML com etiqueta que o editor não conhece viraram texto simples (o HTML original fica guardado).`)
  if (conversor.imagensSemArquivo.size > 0) simulacao.avisos.push(`${conversor.imagensSemArquivo.size} imagem(ns) citadas nas fichas ou páginas não existem no cofre.`)
  const semCampanha = simulacao.contagemDeVinculos.participacoesSemCampanha
  if (semCampanha > 0) simulacao.avisos.push(`${semCampanha} participação(ões) apontam para campanha que não está no cofre (na lixeira ou apagada): ficam de fora das etiquetas.`)
  if (copias !== null && copias.comCoisaAMais > 0) simulacao.avisos.push(`${copias.comCoisaAMais} cópia(s) de conflito têm algo que o original não tem: confira antes de largar as cópias.`)
  const semOriginal = copias === null ? 0 : copias.comparacoes.filter((comparacao) => comparacao.situacao === 'semOriginal').length
  if (semOriginal > 0) simulacao.avisos.push(`${semOriginal} cópia(s) de conflito não têm mais original no cofre.`)
  const naLixeira = copias === null ? 0 : copias.comparacoes.filter((comparacao) => comparacao.naLixeira).length
  if (naLixeira > 0) simulacao.avisos.push(`${naLixeira} cópia(s) de conflito são de um original que está na lixeira do Grimório (comparadas com ele).`)
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
  const ligacoes = { formato: ARQUIVO_DAS_LIGACOES.formato, ligacoes: await ligacoesDe(simulacao, conversor) }
  const indice = { formato: ARQUIVO_DO_INDICE.formato, campanhas: saida.campanhas }
  const validada = await validarSaida(simulacao, saida)

  const copias = opcoes.copiasDeConflito === undefined ? null : await compararCopiasDeConflito(opcoes.copiasDeConflito, leitor, new Map(inventario.arquivos.map((arquivo) => [chaveDoCaminho(arquivo.caminho), arquivo])))
  avisosDoTexto(simulacao, conversor, copias)
  const reimportacao = opcoes.existentes === undefined ? null : await planejarReimportacao(opcoes.existentes, validada.verbetes)

  const arquivos = simulacao.registros.map(arquivoNoRelatorio)
  const falhas = falhasDe(simulacao, inventario.pastasIlegiveis)
  const midias = [...simulacao.midias.values()]
  const originais = arquivos.filter((arquivo) => arquivo.caminho.toLowerCase().endsWith('.json') || arquivo.destino === 'soOriginal').reduce((soma, arquivo) => soma + arquivo.bytes, 0)
  const extrasDoPlano = noDisco(ARQUIVO_DAS_LIGACOES, ligacoes)
  const doIndice = noDisco(ARQUIVO_DO_INDICE, indice)
  const necessario = midias.reduce((soma, midia) => soma + midia.bytes, 0) + validada.bytes + originais + (extrasDoPlano.ok ? extrasDoPlano.bytes : 0) + (doIndice.ok ? doIndice.bytes : 0)
  const espaco = espacoDe(necessario, opcoes.espacoLivreBytes ?? null)
  const cadaArquivoUmDestino = cadaUmComUmDestino(inventario.arquivos.map((arquivo) => arquivo.caminho), arquivos)

  const motivosParaNaoAplicar: string[] = []
  if (falhas.length > 0) motivosParaNaoAplicar.push(`${falhas.length} arquivo(s) ou pasta(s) não foram lidos.`)
  if (espaco.cabe === false) motivosParaNaoAplicar.push('Depois de importar sobrariam menos de 8 GB livres no disco.')
  if (!cadaArquivoUmDestino) motivosParaNaoAplicar.push('Algum arquivo do cofre ficou sem destino ou com mais de um.')

  const plano: PlanoDaImportacao = { indice, verbetes: validada.verbetes, quadros: saida.quadros, ligacoes, midias }
  return {
    plano,
    relatorio: {
      formato: FORMATO_DO_RELATORIO,
      geradoEm: (opcoes.agora ?? (() => new Date()))().toISOString(),
      cofre: { arquivos: arquivos.length, bytes: arquivos.reduce((soma, arquivo) => soma + arquivo.bytes, 0) },
      cadaArquivoUmDestino,
      destinos: somarPorDestino(arquivos),
      porTipo: somarPorTipo(arquivos),
      contagens: contagensDe(simulacao, saida),
      saida: {
        verbetes: registroDe(TIPOS_DE_VERBETE, (tipo) => validada.verbetes.filter((verbete) => verbete.tipo === tipo).length),
        quadros: saida.quadros.length,
        ligacoes: ligacoes.ligacoes.length,
        campanhas: saida.campanhas.length,
        midias: midias.length,
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

/** Caminho antigo → `midia/…`. `fromEntries` cria a chave como dado, mesmo um nome esquisito. */
function tabelaDeMidiaDe(registros: readonly Registro[]): Record<string, string> {
  const pares: [string, string][] = []
  for (const registro of registros) if (registro.destino === 'midia' && registro.vira !== undefined) pares.push([registro.caminho, registro.vira])
  return Object.fromEntries(pares)
}
