import { alcanceDoCartao } from '../batalha/alcanceDoCartao'
import type { CorDoAlcance } from '../batalha/alcance/cor'
import type { FormaDoAlcance } from '../batalha/alcance/forma'
import { categoriaDaHabilidade } from '../batalha/mecanica/categoria'
import type { FichaDaPrevia } from '../batalha/mecanica/resumo'
import { resumoDoEfeitoDoItem } from '../batalha/mecanica/resumoDoItem'
import { fraseDoPapel } from '../batalha/mecanica/textoGerado'
import { normalizarParaBusca } from '../buscaNoLivro'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { ehDoAcervo } from './acervoNoLivro'
import { ehDoLivro } from './catalogo'
import { GRUPOS_DE_ARMA, spDaEntrada, type GrupoDaBiblioteca } from './gruposDaBiblioteca'
import { pecasDaEntrada, type EntradaDaBiblioteca } from './paginasDaBiblioteca'
import { alcanceLido, frasesDoItem, TIPOS_QUE_ATACAM } from '../itens/editorDoItem'

/**
 * A LINHA DA LISTA da biblioteca organizada (protótipo `.linha`): o ícone, a
 * frase em uma linha (a gerada pelas peças, a mesma do papel e do campo
 * Efeito; sem peças, o texto escrito), as fichas que mudam de uma para outra
 * (ação, SP, espera; o dano da arma; o atributo da perícia) e o desenho do
 * alcance. Puro: sem store, sem disco.
 */

export type IconeDaLinha =
  | 'impacto' | 'cortante' | 'perfurante' | 'queimadura' | 'veneno' | 'choque' | 'cegueira'
  | 'ataque' | 'apoio' | 'reacao' | 'passiva' | 'pericia' | 'vantagem' | 'desvantagem'
  | 'espada' | 'fogo' | 'frasco' | 'balas' | 'caixa'

/** As cores das fichas da linha: SP em azul, Overload em brasa, dano em vermelho, o resto apagado. */
export type CorDaFicha = 'sp' | 'over' | 'dano' | 'fraco'

export interface FichaDaLinha {
  texto: string
  cor?: CorDaFicha
}

/** O alcance da linha: a forma e a cor (verde = ajuda, azul = dá dano); `'falta'` = pede alcance e não tem (o "?" que a ferramenta resolve). */
export type AlcanceDaLinha = { forma: FormaDoAlcance; cor: CorDoAlcance } | 'falta' | null

export interface DadosDaLinha {
  icone: IconeDaLinha
  frase: string
  /** A frase é o texto escrito (sem peças): vai em itálico, apagada. */
  fraseDoTexto: boolean
  fichas: FichaDaLinha[]
  alcance: AlcanceDaLinha
}

const ICONE_DO_GRUPO: Readonly<Record<GrupoDaBiblioteca, IconeDaLinha>> = {
  ataque: 'ataque', apoio: 'apoio', reacao: 'reacao', passiva: 'passiva', pericia: 'pericia', vantagem: 'vantagem', desvantagem: 'desvantagem',
  corpo: 'espada', fogo: 'fogo', hibrida: 'fogo', arremesso: 'impacto', consumivel: 'frasco', municao: 'balas', equipamento: 'apoio', outro: 'caixa',
}
const ICONES_DO_GOLPE: ReadonlySet<string> = new Set(['impacto', 'cortante', 'perfurante', 'queimadura', 'veneno', 'choque', 'cegueira'])
const NOME_DA_ACAO: Readonly<Record<string, string>> = { simples: 'Simples', completa: 'Completa', bonus: 'Bônus', livre: 'Livre', perguntar: 'Na hora' }
/** A Ação escrita no cartão de texto ("Ação Completa", "OVERLOAD"), na ordem em que vence. */
const ACAO_ESCRITA: readonly [RegExp, string][] = [
  [/overload/u, 'Overload'],
  [/complet/u, 'Completa'],
  [/bonus/u, 'Bônus'],
  [/livre/u, 'Livre'],
  [/simples/u, 'Simples'],
]

function ehIconeDoGolpe(tipo: string): tipo is IconeDaLinha {
  return ICONES_DO_GOLPE.has(tipo)
}

/** O traço que a ficha usa para "nada" ("-", "—"): na linha vale como campo vazio. */
const SO_UM_TRACO = /^[-–—]+$/u

/** O que só tem texto (o mestre escreveu): o Efeito, senão o texto da entrada; o da coisa do Acervo é a descrição. */
function fraseEscrita(entrada: EntradaDaBiblioteca): string {
  if (ehDoAcervo(entrada)) return entrada.acervo.descricao.trim()
  const efeito = (entrada.campos.efeito ?? '').trim()
  return efeito !== '' && !SO_UM_TRACO.test(efeito) ? efeito : entrada.texto.trim()
}

/** As fichas da habilidade sem peças, lidas dos campos escritos (Ação, Custo, Tempo). */
function fichasDoTexto(entrada: EntradaDaBiblioteca, grupo: GrupoDaBiblioteca): FichaDaLinha[] {
  if (ehDoAcervo(entrada) || ehDoLivro(entrada)) return []
  const fichas: FichaDaLinha[] = []
  const acao = normalizarParaBusca(entrada.campos.acao ?? '')
  const escrita = ACAO_ESCRITA.find(([padrao]) => padrao.test(acao))
  if (escrita !== undefined && grupo !== 'reacao' && grupo !== 'passiva') fichas.push(escrita[1] === 'Overload' ? { texto: 'Overload', cor: 'over' } : { texto: escrita[1] })
  const sp = spDaEntrada(entrada)
  if (sp !== null && sp > 0) fichas.push({ texto: `${sp} SP`, cor: 'sp' })
  const tempo = (entrada.campos.tempo ?? '').trim()
  if (/^\d+$/u.test(tempo) && Number(tempo) > 0 && escrita?.[1] !== 'Overload') fichas.push({ texto: `espera ${tempo}`, cor: 'fraco' })
  return fichas
}

/** O grupo pede alcance (o golpe e a ajuda; a arma e o consumível): sem ele aparece o "?". */
function pedeAlcance(grupo: GrupoDaBiblioteca): boolean {
  return grupo === 'ataque' || grupo === 'apoio' || GRUPOS_DE_ARMA.has(grupo) || grupo === 'consumivel'
}

/**
 * Os dados da linha. `ficha` é quem "usa" a frase gerada (o boneco de treino
 * do sistema, só com os nomes): a lista não depende de quem está escolhido.
 * `atributos` dá o nome do atributo da perícia.
 */
export function dadosDaLinha(entrada: EntradaDaBiblioteca, grupo: GrupoDaBiblioteca, ficha: FichaDaPrevia, sistema: SistemaDeRpg, atributos: ReadonlyMap<string, string>): DadosDaLinha {
  const pecas = pecasDaEntrada(entrada)
  let icone = ICONE_DO_GRUPO[grupo]
  let frase: string
  let fraseDoTexto = false
  let fichas: FichaDaLinha[] = []

  if (pecas !== null) {
    frase = fraseDoPapel(pecas, ficha)
    const bate = pecas.golpe?.bate?.tipo
    if (bate !== undefined && ehIconeDoGolpe(bate)) icone = bate
    // Versão 5 (D6, D7): a passiva não gasta ação; o "Ligar e manter" diz a ação que liga e que fica ligado.
    const categoria = categoriaDaHabilidade(pecas)
    if (categoria === 'overload') fichas.push({ texto: 'Overload', cor: 'over' })
    else if (categoria === 'passiva') fichas.push({ texto: 'Passiva' })
    else if (categoria !== 'reacao') fichas.push({ texto: NOME_DA_ACAO[pecas.acao] ?? pecas.acao })
    if (categoria === 'manter') fichas.push({ texto: 'liga e mantém', cor: 'fraco' })
    const sp = spDaEntrada(entrada)
    if (sp !== null && sp > 0) fichas.push({ texto: `${sp} SP`, cor: 'sp' })
    const { recarga, usosPorBatalha } = pecas.limite
    if (categoria !== 'overload' && usosPorBatalha !== undefined) fichas.push({ texto: `${usosPorBatalha}× por combate`, cor: 'fraco' })
    else if (categoria !== 'overload' && recarga !== undefined && recarga > 0) fichas.push({ texto: `espera ${recarga}`, cor: 'fraco' })
  } else if (ehDoAcervo(entrada) && entrada.acervo.efeito !== undefined) {
    frase = resumoDoEfeitoDoItem(entrada.acervo.efeito, sistema)
  } else if (ehDoAcervo(entrada) && entrada.acervo.tipo !== undefined && entrada.acervo.tipo !== 'outros') {
    // Itens refeitos (E2): a 1ª frase do "O que acontece" (o ataque, a bala, o uso), sem os nomes de outros itens.
    frase = frasesDoItem(entrada.acervo, { nomeDoItem: () => null, nomeDoAtributo: (id) => sistema.atributos.find((atributo) => atributo.id === id)?.nome ?? id, armasQueAceitam: () => [] })[0] ?? fraseEscrita(entrada)
  } else {
    frase = fraseEscrita(entrada)
    fraseDoTexto = true
    fichas = fichasDoTexto(entrada, grupo)
  }

  if (!ehDoAcervo(entrada) && ehDoLivro(entrada) && entrada.atributos.length > 0) {
    fichas.push({ texto: entrada.atributos.map((id) => atributos.get(id) ?? id).join(', '), cor: 'fraco' })
  }
  if (entrada.tipo === 'arma' && !ehDoAcervo(entrada)) {
    const dano = (entrada.campos.dano ?? '').trim()
    if (dano !== '') fichas.unshift({ texto: `Dano ${dano}`, cor: 'dano' })
  }

  let alcance: AlcanceDaLinha = null
  if (pedeAlcance(grupo) && !ehDoAcervo(entrada) && !ehDoLivro(entrada)) {
    const lido = alcanceDoCartao(entrada)
    alcance = lido === null ? 'falta' : { forma: lido.forma, cor: grupo === 'apoio' ? 'verde' : 'azul' }
  } else if (ehDoAcervo(entrada)) {
    const { ataque, uso, tipo } = entrada.acervo
    if (ataque !== undefined && tipo !== undefined && TIPOS_QUE_ATACAM.has(tipo)) fichas.unshift({ texto: `Dano ${ataque.dano}`, cor: 'dano' })
    const forma = alcanceLido(tipo !== undefined && TIPOS_QUE_ATACAM.has(tipo) ? ataque?.alcance : tipo === 'consumivel' ? uso?.alcance : undefined)
    if (forma !== null) alcance = { forma, cor: tipo === 'consumivel' ? 'verde' : 'azul' }
  }
  return { icone, frase, fraseDoTexto, fichas, alcance }
}

/** O número ao lado do desenho pequeno (o tamanho do alcance); `null` = a forma não tem tamanho (só em quem usa). */
export function tamanhoDoAlcance(forma: FormaDoAlcance): number | null {
  if (forma.tipo === 'si') return null
  return forma.tipo === 'frente' ? forma.lado : forma.ate
}
