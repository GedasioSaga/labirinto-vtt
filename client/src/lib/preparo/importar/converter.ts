import {
  ARQUIVO_DO_QUADRO,
  ARQUIVO_DO_VERBETE,
  type Campanha,
  type Forma,
  type ImagemDaForma,
  type ItemDoAcervo,
  type Ligacao,
  type Quadro,
  type Secao,
  type TextoRico,
  type TipoDeVerbete,
  type Verbete,
} from '../tipos'
import type { CampanhaG, CenarioG, DocumentoG, ImagemG, ItemG, ItemNoAcervoG, PaginaG, PersonagemG, VersaoCenarioG, VersaoPersonagemG, VinculoG } from './grimorio'
import { htmlParaTexto, htmlTemConteudo, type MidiaDoCaminho } from './texto'

/**
 * DO GRIMÓRIO PARA OS TIPOS DO PRELÚDIO (plano §4, passo 4):
 * - personagem → verbete Personagem (cada versão vira uma forma);
 * - cenário → Lugar (o subcenário ganha `paiId`); item → Item;
 * - página → Página, na mesma árvore; o caderno da Escrita vira a página-raiz das páginas dele;
 * - sessão → Sessão + o quadro dela; canvas e mapa → quadro, com a foto do tldraw intacta;
 * - a aba "Anotações" vira seção de segredo; o HTML vira texto do editor;
 * - imagens apontam para `midia/<sha256>.<ext>`.
 *
 * O que o Prelúdio ainda não tem campo para guardar vai em `extras` (o enquadramento do
 * retrato, a ordem da página, as camadas do mapa, os personagens do cenário): o molde
 * grava `extras` de volta como chave do arquivo, e a fatia que precisar declara o campo.
 */

/** O que cada arquivo leva além do conteúdo: ids já resolvidos, campanhas e lugar no cofre. */
export interface MetaDoVerbete {
  /** Id no Prelúdio (o do Grimório quando serve de nome de arquivo; senão o fixo do caminho). */
  readonly id: string
  /** Id como estava no Grimório (ou o fixo, quando o arquivo não tinha). */
  readonly idNoGrimorio: string
  /** Caminho do arquivo no cofre. */
  readonly caminho: string
  readonly campanhas: readonly string[]
  readonly paiId?: string
  /** As pastas do Grimório onde o arquivo morava, da seção até ele. */
  readonly pastas?: readonly string[]
}

interface SecaoDoGrimorio {
  readonly chave: string
  readonly titulo: string
  readonly html: string
  readonly segredo: boolean
}

const ANOTACOES = 'Anotações'

export class Conversor {
  naoEntendidos = 0
  readonly imagensSemArquivo = new Set<string>()

  constructor(
    private readonly midiaDe: MidiaDoCaminho,
    /** Id do Grimório → id no Prelúdio; id desconhecido volta como veio (link quebrado mostra "não existe mais"). */
    private readonly idNoPreludio: (idDoGrimorio: string) => string,
  ) {}

  private texto(html: string): TextoRico {
    const convertido = htmlParaTexto(html, this.midiaDe)
    this.naoEntendidos += convertido.naoEntendidos
    for (const rel of convertido.imagensSemArquivo) this.imagensSemArquivo.add(rel)
    return convertido.texto
  }

  private midia(rel: string | null): string | undefined {
    if (rel === null || rel === '') return undefined
    const midia = this.midiaDe(rel)
    if (midia === null) this.imagensSemArquivo.add(rel)
    return midia ?? undefined
  }

  /** Seção vazia não vira seção; o id sai da forma + a aba, então é o mesmo a cada reimportação. */
  private secoes(formaId: string, secoes: readonly SecaoDoGrimorio[]): Secao[] {
    return secoes
      .filter((secao) => htmlTemConteudo(secao.html))
      .map((secao) => ({ id: `${formaId}-${secao.chave}`, titulo: secao.titulo, texto: this.texto(secao.html), segredo: secao.segredo }))
  }

  private imagens(imagens: readonly ImagemG[]): ImagemDaForma[] {
    return imagens.flatMap((imagem) => {
      const midia = this.midia(imagem.rel)
      return midia === undefined ? [] : [{ midia, legenda: imagem.legenda ?? '' }]
    })
  }

  /** No Grimório `qtd` ausente é item único: aqui vira 1. */
  private acervo(acervo: readonly ItemNoAcervoG[]): ItemDoAcervo[] {
    return acervo.map((entrada) => ({ itemId: this.idNoPreludio(entrada.itemId), qtd: entrada.qtd ?? 1 }))
  }

  private forma(base: { id: string; nome: string; resumo: string; retrato: string | null; foco?: unknown }, secoes: Secao[]): Forma {
    const forma: Forma = { id: base.id, nome: base.nome, resumo: base.resumo, secoes, imagens: [] }
    const retrato = this.midia(base.retrato)
    if (retrato !== undefined) forma.retrato = retrato
    if (base.foco !== undefined) forma.extras = { foco: base.foco }
    return forma
  }

  private formaDePersonagem(versao: VersaoPersonagemG): Forma {
    const forma = this.forma(
      versao,
      this.secoes(versao.id, [
        { chave: 'descricao', titulo: 'Descrição', html: versao.descricao, segredo: false },
        { chave: 'informacao', titulo: 'Informações', html: versao.informacao, segredo: false },
        { chave: 'historia', titulo: 'História', html: versao.historia, segredo: false },
        { chave: 'extras', titulo: 'Extras', html: versao.extras, segredo: false },
        { chave: 'anotacoes', titulo: ANOTACOES, html: versao.anotacoes, segredo: true },
      ]),
    )
    forma.imagens = this.imagens(versao.imagens)
    if (versao.acervo.length > 0) forma.acervo = this.acervo(versao.acervo)
    return forma
  }

  private formaDeCenario(versao: VersaoCenarioG): Forma {
    const forma = this.forma(
      versao,
      this.secoes(versao.id, [
        { chave: 'descricao', titulo: 'Descrição', html: versao.descricao, segredo: false },
        { chave: 'informacao', titulo: 'Informações', html: versao.informacao, segredo: false },
        { chave: 'historia', titulo: 'História', html: versao.historia, segredo: false },
        { chave: 'eventos', titulo: 'Eventos', html: versao.eventos, segredo: false },
        { chave: 'itens', titulo: 'Itens', html: versao.itens, segredo: false },
        { chave: 'anotacoes', titulo: ANOTACOES, html: versao.anotacoes, segredo: true },
      ]),
    )
    forma.imagens = this.imagens(versao.imagens)
    if (versao.acervo.length > 0) forma.acervo = this.acervo(versao.acervo)
    return forma
  }

  personagem(personagem: PersonagemG, meta: MetaDoVerbete): Verbete {
    return verbete('personagem', personagem.nome, personagem.versoes.map((versao) => this.formaDePersonagem(versao)), personagem.versaoAtivaId, meta)
  }

  cenario(cenario: CenarioG, meta: MetaDoVerbete): Verbete {
    const lugar = verbete('lugar', cenario.nome, cenario.versoes.map((versao) => this.formaDeCenario(versao)), cenario.versaoAtivaId, meta)
    if (cenario.personagens.length > 0) lugar.extras = { personagens: cenario.personagens.map((id) => this.idNoPreludio(id)) }
    return lugar
  }

  item(item: ItemG, meta: MetaDoVerbete): Verbete {
    const formaId = `${meta.id}-forma`
    const secoes = this.secoes(formaId, [
      { chave: 'descricao', titulo: 'Descrição', html: item.descricao, segredo: false },
      { chave: 'informacao', titulo: 'Informações', html: item.informacao, segredo: false },
      { chave: 'efeito', titulo: 'Efeito', html: item.efeito, segredo: false },
    ])
    return verbete('item', item.nome, [this.forma({ ...item, id: formaId }, secoes)], formaId, meta)
  }

  /** A página guarda a ordem entre irmãs em `extras.ordem` (o Grimório ordena por ela). */
  pagina(pagina: PaginaG, meta: MetaDoVerbete): Verbete {
    const formaId = `${meta.id}-forma`
    const secoes = htmlTemConteudo(pagina.corpo) ? [{ id: `${formaId}-corpo`, titulo: '', texto: this.texto(pagina.corpo), segredo: false }] : []
    const resultado = verbete('pagina', pagina.titulo, [{ id: formaId, nome: pagina.titulo, resumo: '', secoes, imagens: [] }], formaId, meta)
    resultado.extras = { ordem: pagina.ordem }
    return resultado
  }

  /** Sessão e caderno da Escrita: o verbete é a casca; o texto mora nas páginas filhas. */
  documento(tipo: Extract<TipoDeVerbete, 'sessao' | 'pagina'>, documento: DocumentoG, meta: MetaDoVerbete): Verbete {
    const formaId = `${meta.id}-forma`
    return verbete(tipo, documento.nome, [{ id: formaId, nome: documento.nome, resumo: '', secoes: [], imagens: [] }], formaId, meta)
  }

  /** As camadas do mapa (nome, travada, oculta) vão em `extras`; a foto do tldraw vai intacta. */
  quadro(documento: DocumentoG, campanhaId: string | undefined, sessaoId: string | undefined): Quadro {
    const quadro: Quadro = { formato: ARQUIVO_DO_QUADRO.formato, nome: documento.nome, tldraw: documento.documento }
    if (campanhaId !== undefined) quadro.campanhaId = campanhaId
    if (sessaoId !== undefined) quadro.sessaoId = sessaoId
    const extras: Record<string, unknown> = {}
    if (documento.camadas !== undefined) extras.camadas = documento.camadas
    if (documento.versaoCamadas !== undefined) extras.versaoCamadas = documento.versaoCamadas
    if (Object.keys(extras).length > 0) quadro.extras = extras
    return quadro
  }

  ligacao(vinculo: VinculoG, id: string): Ligacao {
    return { id, de: this.idNoPreludio(vinculo.deId), para: this.idNoPreludio(vinculo.paraId), tipo: vinculo.tipo, notas: vinculo.notas, segredo: false }
  }
}

function verbete(tipo: TipoDeVerbete, titulo: string, formas: Forma[], formaAtivaId: string, meta: MetaDoVerbete): Verbete {
  const resultado: Verbete = {
    formato: ARQUIVO_DO_VERBETE.formato,
    id: meta.id,
    tipo,
    titulo,
    apelidos: [],
    campanhas: [...meta.campanhas],
    formas,
    formaAtivaId,
    origem: { grimorio: { id: meta.idNoGrimorio, caminho: meta.caminho } },
  }
  if (meta.paiId !== undefined) resultado.paiId = meta.paiId
  if (meta.pastas !== undefined && meta.pastas.length > 0) resultado.organizacao = [...meta.pastas]
  return resultado
}

export function campanhaDoGrimorio(campanha: CampanhaG, id: string): Campanha {
  const resultado: Campanha = { id, nome: campanha.nome }
  if (campanha.descricao !== '') resultado.extras = { descricao: campanha.descricao }
  return resultado
}
