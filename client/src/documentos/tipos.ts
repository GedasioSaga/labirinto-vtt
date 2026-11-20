/**
 * CONTRATO DO DOCUMENTO (1ª leva, plano `docs/design/puzzles/PLANO.md` §1.5,
 * §1.5.1 e §2.3; protótipos aprovados `docs/design/puzzles/prototipo-v2.html`,
 * aba Documentos, e `docs/design/puzzles/prototipo-documento-extras.html`).
 *
 * Onde cada parte mora:
 *  - o TEXTO, na biblioteca "Documentos" do app (`<appData>/documentos`,
 *    `documentos/biblioteca.ts`), fora da campanha e do acervo;
 *  - o PAPEL NO CHÃO, no mapa (`MapData.documentos`, `DocumentoNoMapa`);
 *  - a LISTA de quem leu, na ficha (`Personagem.documentos`, só metadados).
 *
 * Todo campo é do mestre ("deixe bem editável"). O texto claro de um trecho
 * protegido mora SÓ no `Documento`, que nunca vai ao jogador inteiro: o host
 * monta o `DocumentoNoFio` (`documentos/resolver.ts`) por lista branca, na
 * hora da leitura.
 */
import type { LugarDoDesafio, NoPiso } from '../types/map'

/** 1 (20/11/2026): a primeira. Quando houver a 2, o passo de 1 para 2 entra em `lerDocumento`. */
export const VERSAO_DO_DOCUMENTO = 1

// ------------------------------------------------------------------ as escolhas do mestre

/** Os 5 papéis do protótipo v2 e a imagem própria. */
export const PAPEIS_DO_DOCUMENTO = ['alfinete', 'carta', 'diario', 'bilhete', 'pergaminho', 'imagem'] as const
export type PapelDoDocumento = (typeof PAPEIS_DO_DOCUMENTO)[number]
/** O papel de um documento novo, e o de um papel torto lido do disco (o "Documento novo" do v2). */
export const PAPEL_PADRAO: PapelDoDocumento = 'alfinete'
/** O título que o "Novo documento" põe. Enquanto ele está lá, o mestre ainda não deu título: a ficha oferece os exemplos, e o exemplo põe o dele. */
export const TITULO_DO_DOCUMENTO_NOVO = 'Documento novo'

export const LETRAS_DO_DOCUMENTO = ['mao', 'maquina', 'impressa'] as const
export type LetraDoDocumento = (typeof LETRAS_DO_DOCUMENTO)[number]

export const TINTAS_DO_DOCUMENTO = ['preta', 'sepia', 'vermelha', 'sangue'] as const
export type TintaDoDocumento = (typeof TINTAS_DO_DOCUMENTO)[number]

/** Os desenhos de selo, carimbo e brasão do protótipo dos extras (`ARTES`). A arte de cada um é do papel (D5). */
export const ARTES_DO_DOCUMENTO = ['rosa', 'corvo', 'chave', 'coroa', 'torre', 'ancora'] as const
export type ArteDoDocumento = (typeof ARTES_DO_DOCUMENTO)[number]

/** O que vê quem NÃO tem o item de um trecho cifrado: letras ao acaso, o código do mestre ou o texto na outra língua. */
export const MOSTRAS_DO_TRECHO = ['embaralhado', 'codigo', 'lingua'] as const
export type MostraDoTrecho = (typeof MOSTRAS_DO_TRECHO)[number]

export const MANCHAS_DO_PAPEL = [0, 1, 2, 3] as const
export type ManchasDoPapel = (typeof MANCHAS_DO_PAPEL)[number]

export const ORIGENS_DO_DOCUMENTO = ['mapa', 'puzzle', 'objeto', 'mestre'] as const
export type OrigemDoDocumento = (typeof ORIGENS_DO_DOCUMENTO)[number]

// ------------------------------------------------------------------ tetos (os `maxlength` dos protótipos)

export const TITULO_DO_DOCUMENTO_MAX = 60
export const PAGINAS_DO_DOCUMENTO_MAX = 20
/** Texto de uma página, em unidades UTF-16. O protótipo não fixa: é o teto da anotação do mestre. */
export const TEXTO_DA_PAGINA_MAX = 4000
export const TEXTO_CLARO_MAX = 400
export const TEXTO_CIFRADO_MAX = 400
export const TEXTO_DO_CARIMBO_MAX = 30
export const ASSINATURA_MAX = 40
/** Trechos protegidos de um documento. */
export const TRECHOS_MAX = 64
/** Itens que leem um trecho cifrado (o protótipo tem 3; o app aceita qualquer item do acervo). */
export const CHAVES_DO_TRECHO_MAX = 8
/** A lista de uma ficha (plano §1.5). */
export const DOCUMENTOS_NA_FICHA_MAX = 200
/** Papéis no chão de um mapa. */
export const DOCUMENTOS_NO_MAPA_MAX = 500
/**
 * O TAMANHO DO PAPEL NO CHÃO (pedido de 20/11/2026: "não consigo mudar o
 * tamanho dele"), em vezes o padrão: 1 = o desenho de sempre (~0,6 casa).
 * A alça de canto e o "Tamanho" da ficha andam dentro desta faixa.
 */
export const TAMANHO_DO_PAPEL_MIN = 0.5
export const TAMANHO_DO_PAPEL_MAX = 4

/** O tamanho do papel dentro da faixa, de centésimo em centésimo (a alça não grava 1,2345678). Não-número: 1. */
export function tamanhoDoPapelNaFaixa(tamanho: number): number {
  if (!Number.isFinite(tamanho)) return 1
  return Math.round(Math.min(TAMANHO_DO_PAPEL_MAX, Math.max(TAMANHO_DO_PAPEL_MIN, tamanho)) * 100) / 100
}
/** "Cofre do Capitão", "o mestre": de onde veio o documento da lista. */
export const DE_ONDE_MAX = 60
/** O nome de quem pegou o papel ("Lara"), como o nome do jogador no chat. */
export const NOME_DE_QUEM_PEGOU_MAX = 40

/** Id de trecho: o do protótipo (`c1`, `b2`). Fica dentro da marca `{{cifra:c1}}` do texto da página. */
export const FORMA_DO_ID_DO_TRECHO = /^[a-z0-9]{1,16}$/

// ------------------------------------------------------------------ a biblioteca

/** Na biblioteca "Documentos" do app. */
export interface Documento {
  id: string
  /** `VERSAO_DO_DOCUMENTO` ao gravar; a maior, de um app mais novo, não é rebaixada (`lerDocumento`). */
  versao: number
  /** Pode ficar vazio enquanto o mestre escreve; a tela mostra "Sem título". */
  titulo: string
  papel: PapelDoDocumento
  /** `midia:<id>`. Vale só com o papel 'imagem', mas fica guardada ao trocar de papel e voltar. */
  imagemDoPapel: string | null
  /** De 1 a `PAGINAS_DO_DOCUMENTO_MAX`. */
  paginas: PaginaDoDocumento[]
  /** O modelo de puzzle ("Meus puzzles") cuja dica é este documento. Só do mestre. */
  dicaDe: string | null
  /** Letra, tinta, desgaste, selo, assinatura e brasão (§1.5.1). Nasce com `extrasPadrao()`. */
  extras: ExtrasDoDocumento
  /** Os trechos protegidos, pelo id da marca no texto. Nasce vazio. Trecho sem marca no texto fica (o protótipo o oferece para apagar). */
  trechos: Record<string, TrechoProtegido>
  criadoEm: number
  mudadoEm: number
}

export interface PaginaDoDocumento {
  /** `**negrito**`, `*itálico*` e as marcas `{{cifra:ID}}` e `{{borrado:ID}}` (ID de `FORMA_DO_ID_DO_TRECHO`). */
  texto: string
  /** `midia:<id>`. */
  imagem: string | null
}

export interface DesgasteDoPapel {
  /** `#rrggbb`; `null` = a cor do próprio papel. */
  cor: string | null
  manchas: ManchasDoPapel
  bordaQueimada: boolean
  dobras: boolean
  rasgos: boolean
}

/**
 * No fim da última página: o selo de cera ou o carimbo oficial, que tem o
 * texto em volta. O meio é um desenho (`arte`) ou uma imagem própria
 * (`imagem`, `midia:<id>`), pelo mesmo caminho do brasão: `{ arte: null,
 * imagem: null }` = o mestre escolheu "Imagem própria" e ainda não a mandou
 * (o selo fica sem nada no meio até lá).
 */
export type SeloDoDocumento =
  | { tipo: 'cera'; /** `#rrggbb` */ cor: string; arte: ArteDoDocumento | null; imagem: string | null }
  | { tipo: 'carimbo'; /** `#rrggbb` */ cor: string; arte: ArteDoDocumento | null; imagem: string | null; /** até `TEXTO_DO_CARIMBO_MAX` */ texto: string }

/**
 * No cabeçalho da 1ª página: um desenho (`arte`) ou uma imagem (`midia:<id>`).
 * `{ arte: null, imagem: null }` = o mestre escolheu "Imagem" e ainda não a
 * mandou: o cabeçalho fica sem brasão até lá (como no protótipo).
 */
export interface BrasaoDoDocumento {
  arte: ArteDoDocumento | null
  imagem: string | null
}

export interface ExtrasDoDocumento {
  letra: LetraDoDocumento
  tinta: TintaDoDocumento
  desgaste: DesgasteDoPapel
  selo: SeloDoDocumento | null
  /** A linha no fim da última página; `null` = sem assinatura. Até `ASSINATURA_MAX`. */
  assinatura: string | null
  brasao: BrasaoDoDocumento | null
}

/** Ninguém lê: todos recebem letras ao acaso, do mesmo tamanho e com os mesmos espaços. */
export interface TrechoBorrado {
  tipo: 'borrado'
  /** O texto claro. Mora SÓ aqui, no mestre. */
  claro: string
}

/** Só lê quem tem um dos itens (`chaves`); os outros recebem o `textoCifrado` ou o embaralhado. */
export interface TrechoCifrado {
  tipo: 'cifra'
  /** O texto claro. Mora SÓ aqui, no mestre; sai só para quem tem um dos itens. */
  claro: string
  mostra: MostraDoTrecho
  /** O código ou o texto na outra língua do mestre; vazio (ou com `mostra: 'embaralhado'`) = o embaralhado. */
  textoCifrado: string
  /** Ids de item do acervo (`ItemDoCatalogo.id`): a lente, o dicionário, a chave de cifra. Vazio = ninguém lê. */
  chaves: string[]
}

/** Trecho que nem todo jogador lê. O texto claro mora SÓ aqui, e só no mestre. */
export type TrechoProtegido = TrechoBorrado | TrechoCifrado

/** O índice no disco (`<appData>/documentos/documentos.json`). */
export interface IndiceDaBiblioteca {
  versao: number
  documentos: Documento[]
}

/** Os extras de um documento novo e de um extra torto lido do disco (o `extrasPadrao` do protótipo). */
export function extrasPadrao(): ExtrasDoDocumento {
  return {
    letra: 'mao',
    tinta: 'preta',
    desgaste: { cor: null, manchas: 0, bordaQueimada: false, dobras: false, rasgos: false },
    selo: null,
    assinatura: null,
    brasao: null,
  }
}

// ------------------------------------------------------------------ o mapa e a ficha

/** Onde o papel fica: num ponto do mapa ou num objeto (o mesmo lugar do desafio, sem o "nenhum"). */
export type LugarDoDocumento = Exclude<LugarDoDesafio, { tipo: 'nenhum' }>

/** No mapa: o papel no chão (`MapData.documentos`). Nunca vai ao jogador como está: ele recebe o `PapelNoChao`. */
export interface DocumentoNoMapa extends NoPiso {
  /** `[A-Za-z0-9_-]`, até 80 (um `crypto.randomUUID()` serve): o leitor do mapa descarta o papel de id fora disso. */
  id: string
  /** O `Documento.id` da biblioteca. */
  docId: string
  lugar: LugarDoDocumento
  /** 'fica': cada um que lê guarda uma cópia e o papel continua; 'some': o primeiro que lê leva, e ele sai do mapa para todos. */
  depois: 'fica' | 'some'
  /** Quem leu primeiro, e quando. Com `depois: 'some'`, o papel sai do recorte de todos. */
  pego?: { por: string; em: number }
  /** O tamanho no mapa, em vezes o padrão (`TAMANHO_DO_PAPEL_MIN`..`MAX`). Ausente = 1: o mapa de antes abre igual. */
  tamanho?: number
}

/** Na ficha do personagem (`Personagem.documentos`): só metadados. O texto se monta na hora da leitura. */
export interface DocumentoNaFicha {
  docId: string
  /** Cópia: a lista abre no lobby e com o documento apagado da biblioteca. */
  titulo: string
  papel: PapelDoDocumento
  /** Quando entrou na lista, em ms desde 1970 no relógio do mestre. */
  em: number
  origem: OrigemDoDocumento
  /** "Cofre do Capitão", "o mestre". */
  de?: string
  /** O aviso de novo; sai quando ele lê (`documento.lido`). */
  novo?: true
}

// ------------------------------------------------------------------ o que vai ao jogador (§2.3)

/**
 * Campo de FIO, só no recorte do jogador (`MapData.papeisNoChao`): o papel no
 * chão como ele o vê de longe. O título é público: o "Ler 'Bilhete na parede'"
 * aparece antes da leitura. Nada do texto, do lugar no objeto nem de quem pegou.
 */
export interface PapelNoChao extends NoPiso {
  /** O id do `DocumentoNoMapa` (o "encostou e tocou" do jogador o manda de volta). */
  id: string
  x: number
  y: number
  papel: PapelDoDocumento
  titulo: string
  /** O tamanho que o mestre deu ao papel (`DocumentoNoMapa.tamanho`). Ausente = 1. */
  tamanho?: number
}

/** Um pedaço de página como o leitor do jogador o recebe. */
export type BlocoNoFio = { t: 'texto'; texto: string } | BlocoProtegidoNoFio

/**
 * Um trecho protegido no fio. `texto` é o que ele lê: o claro SÓ quando
 * `lido` (ele tem o item `com`); senão, o cifrado ou o embaralhado. `antes`
 * (só com `lido`) é o cifrado que ele veria sem o item: a animação da
 * decifração parte dele.
 */
export type BlocoProtegidoNoFio =
  | { t: 'protegido'; id: string; tipo: 'borrado'; texto: string; lido: false }
  | { t: 'protegido'; id: string; tipo: 'cifra'; mostra: MostraDoTrecho; texto: string; lido: false }
  | { t: 'protegido'; id: string; tipo: 'cifra'; mostra: MostraDoTrecho; texto: string; lido: true; com: string; antes: string }

export interface PaginaNoFio {
  blocos: BlocoNoFio[]
  imagem: string | null
}

/** O documento como sai do host para quem lê (`documento.conteudo`): montado por lista branca em `documentoNoFio`. */
export interface DocumentoNoFio {
  docId: string
  titulo: string
  papel: PapelDoDocumento
  /** Só com o papel 'imagem'. */
  imagemDoPapel: string | null
  extras: ExtrasDoDocumento
  paginas: PaginaNoFio[]
}
