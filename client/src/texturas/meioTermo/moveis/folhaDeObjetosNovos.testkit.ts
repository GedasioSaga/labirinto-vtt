/**
 * O PEDIDO da folha de objetos novos (`folhaDeObjetosNovos.test.ts`): o JSON
 * que diz o que pintar e onde gravar. Quem o escreve é o desenhista do objeto
 * e o integrador do lote, à mão, então cada campo é conferido aqui, com o lugar
 * do erro na mensagem. Campo desconhecido também é erro: um "perfi" escrito
 * errado cairia no perfil padrão em silêncio e a 3/4 sairia outra.
 *
 * Só para teste: nenhum código do app importa isto.
 */
import { MATERIAIS, type IdDoMaterial } from '../materiais'
import { G } from './contexto'
import { TIPOS_COM_TEXTURA, type TipoComTextura } from './index'
import type { ModoDoTresQuartos, PerfilDoTresQuartos } from './tresQuartos'

/** Um tipo que já está no catálogo: sai como o app o pede (tamanho, materiais e semente de partida). */
export interface ItemRegistrado {
  readonly registrado: true
  readonly tipo: TipoComTextura
}

/** Um montador que ainda não entrou no catálogo: o arquivo novo do desenhista. */
export interface ItemNovo {
  readonly registrado: false
  /** A chave do módulo em `moveis/`, como o `import.meta.glob` a escreve: `./pilar.ts`. */
  readonly modulo: string
  readonly exporta: string
  /** A legenda (o nome do objeto na lista do mestre). */
  readonly nome: string
  /** Pegada em casas. */
  readonly largura: number
  readonly altura: number
  readonly perfil: PerfilDoTresQuartos
  /** O material de cada lugar que o desenho lê em `c.m`; vazio = o desenho não usa `c.m`. */
  readonly materiais: Readonly<Record<string, IdDoMaterial>>
  /** Objeto de chão (mora por baixo dos outros, como o campinho): rente ao chão, a 3/4 não precisa mudar. */
  readonly chao: boolean
}

export type ItemDoPedido = ItemRegistrado | ItemNovo

export interface PedidoDaFolha {
  /** O caminho do PNG como está no pedido (quem grava resolve em relação à pasta do pedido). */
  readonly saida: string
  readonly itens: readonly ItemDoPedido[]
}

/**
 * Maior lado aceito, em casas. O maior objeto do catálogo (o campinho) tem
 * 10; acima de 12 o número quase sempre é engano de unidade (px no lugar de
 * casas), e a imagem do nível 3 passaria de 1800 px de lado.
 */
export const LADO_MAXIMO_EM_CASAS = 12

export const TERMINA_EM_PNG = /\.png$/i

const CAMPOS_DO_PEDIDO = ['saida', 'itens']
const CAMPOS_DO_ITEM_NOVO = ['arquivo', 'exporta', 'nome', 'largura', 'altura', 'perfil', 'materiais', 'chao']
const CAMPOS_DO_PERFIL = ['modo', 'alturaSoltaEmCasas', 'espessuraEmCasas', 'posteEmCasas', 'sombrasSobem', 'forcaDaSombraDeBaixo']

/** Só o nome de um arquivo de `moveis/` (com ou sem `./` e `.ts`): nada de pasta, para o pedido não sair dela. */
const NOME_DE_MODULO = /^(?:\.\/)?([A-Za-z][A-Za-z0-9]*)(?:\.ts)?$/
const NOME_DE_EXPORTACAO = /^[A-Za-z_$][A-Za-z0-9_$]*$/

type Registro = Readonly<Record<string, unknown>>

/** Objeto simples do JSON (não lista, não nulo): daqui em diante cada campo é lido como `unknown` e conferido. */
function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function falha(onde: string, porque: string): Error {
  return new Error(`pedido da folha: ${onde} ${porque}`)
}

function conferirCampos(registro: Registro, conhecidos: readonly string[], onde: string): void {
  const estranho = Object.keys(registro).find((campo) => !conhecidos.includes(campo))
  if (estranho !== undefined) throw falha(`${onde}.${estranho}`, `não é um campo conhecido (os campos são: ${conhecidos.join(', ')})`)
}

function texto(valor: unknown, onde: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') throw falha(onde, 'tem de ser um texto não vazio')
  return valor
}

function numero(valor: unknown, onde: string): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) throw falha(onde, 'tem de ser um número')
  return valor
}

function casas(valor: unknown, onde: string): number {
  const lado = numero(valor, onde)
  if (lado <= 0 || lado > LADO_MAXIMO_EM_CASAS) throw falha(onde, `é em casas: maior que 0 e até ${LADO_MAXIMO_EM_CASAS}`)
  return lado
}

function simOuNao(valor: unknown, onde: string): boolean | undefined {
  if (valor === undefined || typeof valor === 'boolean') return valor
  throw falha(onde, 'tem de ser true ou false')
}

/**
 * Medida do perfil, escrita em CASAS como o código a escreve (`0.3 * G` vira
 * 0.3) e devolvida em px do protótipo. Ausente fica ausente.
 */
function medidaEmCasas(valor: unknown, onde: string): number | undefined {
  if (valor === undefined) return undefined
  const medida = numero(valor, onde)
  if (medida < 0) throw falha(onde, 'não pode ser negativo')
  return medida * G
}

function lerModo(valor: unknown, onde: string): ModoDoTresQuartos {
  if (valor === 'derivado' || valor === 'em-pe') return valor
  throw falha(onde, 'tem de ser "derivado" ou "em-pe"')
}

/** O perfil da 3/4: os dois de sempre pelo nome que têm em `tresQuartos.ts`, ou o objeto com os ajustes. */
function lerPerfil(valor: unknown, onde: string): PerfilDoTresQuartos {
  if (valor === undefined || valor === 'DERIVADO') return { modo: 'derivado' }
  if (valor === 'EM_PE') return { modo: 'em-pe' }
  if (!ehRegistro(valor)) throw falha(onde, 'tem de ser "DERIVADO", "EM_PE" ou um objeto com "modo" e os ajustes')
  conferirCampos(valor, CAMPOS_DO_PERFIL, onde)
  return {
    modo: lerModo(valor.modo, `${onde}.modo`),
    alturaSolta: medidaEmCasas(valor.alturaSoltaEmCasas, `${onde}.alturaSoltaEmCasas`),
    espessura: medidaEmCasas(valor.espessuraEmCasas, `${onde}.espessuraEmCasas`),
    poste: medidaEmCasas(valor.posteEmCasas, `${onde}.posteEmCasas`),
    sombrasSobem: simOuNao(valor.sombrasSobem, `${onde}.sombrasSobem`),
    forcaDaSombraDeBaixo: valor.forcaDaSombraDeBaixo === undefined ? undefined : numero(valor.forcaDaSombraDeBaixo, `${onde}.forcaDaSombraDeBaixo`),
  }
}

function idDoMaterial(valor: unknown): IdDoMaterial | undefined {
  return Object.values(MATERIAIS).find((material) => material.id === valor)?.id
}

/** `{ lugar: material }`: só material com cor própria (as opções "mesma" e "varas" são do painel, não do desenho). */
function lerMateriais(valor: unknown, onde: string): Readonly<Record<string, IdDoMaterial>> {
  if (valor === undefined) return {}
  if (!ehRegistro(valor)) throw falha(onde, 'tem de ser um objeto { lugar: material }')
  const materiais: Record<string, IdDoMaterial> = {}
  for (const [lugar, escolhido] of Object.entries(valor)) {
    const id = idDoMaterial(escolhido)
    if (id === undefined) throw falha(`${onde}.${lugar}`, `"${String(escolhido)}" não é um material (os materiais são: ${Object.keys(MATERIAIS).join(', ')})`)
    materiais[lugar] = id
  }
  return materiais
}

function lerItemNovo(item: Registro, onde: string): ItemNovo {
  conferirCampos(item, CAMPOS_DO_ITEM_NOVO, onde)
  const arquivo = NOME_DE_MODULO.exec(texto(item.arquivo, `${onde}.arquivo`))
  if (arquivo === null) throw falha(`${onde}.arquivo`, 'é o nome do módulo dentro de moveis/, sem pasta: "./pilar"')
  const exporta = texto(item.exporta, `${onde}.exporta`)
  if (!NOME_DE_EXPORTACAO.test(exporta)) throw falha(`${onde}.exporta`, 'é o nome da função exportada: "montarPilar"')
  return {
    registrado: false,
    modulo: `./${arquivo[1]}.ts`,
    exporta,
    nome: texto(item.nome, `${onde}.nome`),
    largura: casas(item.largura, `${onde}.largura`),
    altura: casas(item.altura, `${onde}.altura`),
    perfil: lerPerfil(item.perfil, `${onde}.perfil`),
    materiais: lerMateriais(item.materiais, `${onde}.materiais`),
    chao: simOuNao(item.chao, `${onde}.chao`) === true,
  }
}

function lerItem(valor: unknown, onde: string): ItemDoPedido {
  if (!ehRegistro(valor)) throw falha(onde, 'tem de ser um objeto com "tipo", ou com "arquivo" e "exporta"')
  if (valor.tipo === undefined) return lerItemNovo(valor, onde)
  conferirCampos(valor, ['tipo'], onde)
  const tipo = TIPOS_COM_TEXTURA.find((registrado) => registrado === valor.tipo)
  if (tipo === undefined) throw falha(`${onde}.tipo`, `"${String(valor.tipo)}" não é um tipo do catálogo (montador ainda sem registro vai com "arquivo" e "exporta")`)
  return { registrado: true, tipo }
}

/** O pedido conferido, a partir do texto do arquivo. Qualquer coisa fora do formato vira erro com o lugar. */
export function lerPedido(conteudo: string): PedidoDaFolha {
  let bruto: unknown
  try {
    bruto = JSON.parse(conteudo)
  } catch (erro) {
    throw new Error(`pedido da folha: o arquivo não é um JSON válido (${erro instanceof Error ? erro.message : String(erro)})`, { cause: erro })
  }
  if (!ehRegistro(bruto)) throw falha('o arquivo', 'tem de ser um objeto com "saida" e "itens"')
  conferirCampos(bruto, CAMPOS_DO_PEDIDO, 'pedido')
  const saida = texto(bruto.saida, 'saida')
  if (!TERMINA_EM_PNG.test(saida)) throw falha('saida', 'tem de terminar em .png')
  const itens: unknown = bruto.itens
  if (!Array.isArray(itens) || itens.length === 0) throw falha('itens', 'tem de ser uma lista com pelo menos um item')
  return { saida, itens: itens.map((item: unknown, i) => lerItem(item, `itens[${i}]`)) }
}
