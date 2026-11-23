import {
  ehNaoLido,
  ehUmDestes,
  type AcumuladorDaFicha,
  type DescidaDoAcumulador,
  type GanhoDoAcumulador,
  type GrupoDeRequisitos,
  type LadoDaVida,
  type OpcaoDoUmDestes,
  type PecaDoAcumulador,
  type PecaDoGrupo,
  type RecursoDoAliado,
  type Requisito,
  type RequisitoDo,
  type RequisitosDoCartao,
  type SeFalhar,
  type SubidaDoAcumulador,
  type TipoDoAlvo,
  type UmDestes,
} from './modelo'
import { normalizar } from '../formula'

/**
 * REQUISITOS: AS FRASES (fase A de docs/design/habilidades/REQUISITOS.md §4), como
 * `descreverAlcance` fez para o alcance. A mesma frase no editor, no menu, no host e no registro:
 *
 * - `fraseDoRequisito`: a frase inteira ("Polaridade 2 ou mais, gasta 2");
 * - `motivoDaFalta`: o motivo curto do cinza ("Falta: Polaridade 2, tem 1"; vários: "Falta:
 *   Melodia ligada; 50 SP ou ajuda de aliado com Fogo");
 * - `frasesDosRequisitos`: o bloco inteiro, por seção ("Para usar", "Para evoluir", "Ao usar", "Forma").
 *
 * Puro: sem store, sem rede.
 */

/** O cartão fica cinza com isto quando algum requisito é de um app mais novo (o mestre pode forçar). */
export const MOTIVO_DE_APP_NOVO = 'Requisito de app mais novo: atualize o app'
/** A peça torta no editor. */
export const MOTIVO_DO_TORTO = 'Requisito torto: refaça no editor'
/** O que o jogador não enxerga (a vida do alvo, o NPC no escuro): a técnica fica clicável com esta nota. */
export const NOTA_O_MESTRE_CONFERE = 'o mestre confere'
/** Requisito que espera alguém (G1, G2, J2) na reação. */
export const MOTIVO_NA_REACAO = 'Não dá na reação'
/** Requisito que espera alguém no treino do Lobby (sem mestre e sem relógio do servidor). */
export const MOTIVO_SO_NA_MESA = 'Só na mesa'
/** O motivo de alvo para quem não vê a barra dele (não entrega a vida do NPC). */
export const MOTIVO_DO_ALVO_ESCONDIDO = 'O alvo não cumpre o requisito'

/** A frase inteira e o nome curto (o do motivo), começando em minúscula quando a palavra é do app. */
interface TextosDoRequisito {
  frase: string
  curto: string
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}

function minuscula(texto: string): string {
  return texto.charAt(0).toLocaleLowerCase('pt-BR') + texto.slice(1)
}

function plural(n: number, singular: string, varios: string): string {
  return `${n} ${n === 1 ? singular : varios}`
}

function casas(n: number): string {
  return plural(n, 'casa', 'casas')
}

const LADO: Readonly<Record<LadoDaVida, string>> = { abaixo: 'abaixo', acima: 'acima' }
const RECURSO: Readonly<Record<RecursoDoAliado, string>> = { sp: 'SP', hp: 'HP', escudo: 'de Escudo' }
const ALVOS: Readonly<Record<TipoDoAlvo, string>> = { npc: 'NPCs', jogador: 'jogadores', invocacao: 'invocações' }
const SE_FALHAR: Readonly<Record<SeFalhar, string>> = { perdeAAcao: 'perde a ação', naoGasta: 'não usa e não gasta nada' }

/** As palavras que o final engana: masculinas com final de feminina (o "-ma" grego, "coração")... */
const MASCULINAS: ReadonlySet<string> = new Set(['dia', 'mapa', 'planeta', 'cometa', 'sistema', 'problema', 'tema', 'esquema', 'programa', 'drama', 'poema', 'clima', 'dilema', 'fantasma', 'enigma', 'estigma', 'carisma', 'dogma', 'aroma', 'idioma', 'prisma', 'trauma', 'panorama', 'magma', 'axioma', 'coracao'])
/** ...e femininas sem final de feminina (as comuns em nome de técnica). */
const FEMININAS: ReadonlySet<string> = new Set(['mao', 'luz', 'voz', 'cruz', 'paz', 'raiz', 'flor', 'dor', 'cor', 'ordem', 'nuvem', 'lei', 'fe', 'morte', 'noite', 'tarde', 'arte', 'chave', 'sorte', 'mente', 'fome', 'febre', 'ponte', 'torre', 'lente', 'rede', 'neve', 'parede', 'fonte', 'frente', 'nave', 'serpente', 'corrente', 'ave', 'pele', 'fase', 'base', 'classe', 'fenix'])

/**
 * O nome pede "ligada" ou "ligado"? Pela primeira palavra ("Melodia de Todas as Coisas" → a,
 * "Caminho do Dano" → o): as das listas acima pelo que são; o resto termina em -a, -ção, -são,
 * -ade, -ude, -gem, -ie ou -ez = feminina; senão, masculina.
 */
function ehFeminino(nome: string): boolean {
  const primeira = normalizar(nome).split(' ')[0] ?? ''
  if (MASCULINAS.has(primeira)) return false
  if (FEMININAS.has(primeira)) return true
  return /(a|cao|sao|ade|ude|gem|ie|ez)$/.test(primeira)
}

/** "ligada" ou "ligado", "desligada" ou "desligado", de acordo com o nome. */
function concordado(nome: string, palavra: 'ligad' | 'desligad'): string {
  return `${palavra}${ehFeminino(nome) ? 'a' : 'o'}`
}

/** Igual nos dois. */
function iguais(texto: string): TextosDoRequisito {
  return { frase: texto, curto: texto }
}

function textosDoRecurso(r: RequisitoDo<'sp' | 'pagaVida' | 'reacaoLivre' | 'concentracao' | 'contador'>): TextosDoRequisito {
  switch (r.tipo) {
    case 'sp':
      if (r.nao === true) return iguais(`menos de ${r.n} SP`)
      return { frase: r.gasta === true ? `gasta ${r.n} SP` : `${r.n} SP ou mais`, curto: `${r.n} SP` }
    case 'contador': {
      // O nome do acumulador é do dono: vai como ele escreveu ("Polaridade 2, tem 1"), como o da técnica ligada.
      const nome = r.acumulador.nome
      if (r.nao === true) return iguais(`${nome} abaixo de ${r.nivel}`)
      return { frase: `${nome} ${r.nivel} ou mais${r.gasta === true ? `, gasta ${r.nivel}` : ''}`, curto: `${nome} ${r.nivel}` }
    }
    case 'concentracao':
      if (r.nao === true) return iguais(`concentração abaixo de ${r.n}`)
      return { frase: `concentração ${r.n} ou mais${r.gasta === true ? `, gasta ${r.n}` : ''}`, curto: `concentração ${r.n}` }
    case 'pagaVida': {
      const quanto = r.porcento !== undefined ? `${r.porcento}% do HP máximo` : `${r.hp} de HP`
      return { frase: `paga ${quanto}`, curto: quanto }
    }
    case 'reacaoLivre':
      return { frase: 'com a reação livre, gasta a reação', curto: 'reação livre' }
  }
}

function textosDoEstado(r: RequisitoDo<'escudo' | 'vida' | 'ligada' | 'selo' | 'naForma' | 'parado' | 'andou' | 'apanhou' | 'acertou' | 'errou'>): TextosDoRequisito {
  switch (r.tipo) {
    case 'vida':
      return iguais(`vida ${LADO[r.lado]} de ${r.porcento}%`)
    case 'escudo':
      return r.nao === true ? iguais('sem Escudo') : { frase: 'com o Escudo de pé', curto: 'Escudo de pé' }
    case 'ligada': {
      const opcao = r.opcao === undefined ? '' : ` na opção ${r.opcao}`
      const nome = r.cartao.nome
      const ligada = concordado(nome, 'ligad')
      return r.nao === true ? { frase: `sem ${nome} ${ligada}${opcao}`, curto: `${nome} ${concordado(nome, 'desligad')}` } : { frase: `com ${nome} ${ligada}${opcao}`, curto: `${nome} ${ligada}` }
    }
    case 'selo':
      return r.nao === true ? { frase: `sem o selo ${r.nome}`, curto: `sem ${r.nome}` } : { frase: `com o selo ${r.nome}`, curto: r.nome }
    case 'naForma':
      if (r.forma === undefined) return iguais(r.nao === true ? 'sem transformação' : 'transformado')
      return r.nao === true ? iguais(`fora da forma ${r.forma.nome}`) : { frase: `na forma ${r.forma.nome}`, curto: `forma ${r.forma.nome}` }
    case 'parado':
      return { frase: 'sem andar nesta vez', curto: 'não ter andado' }
    case 'andou':
      return { frase: `andou ${casas(r.casas)} ou mais nesta vez`, curto: `andar ${casas(r.casas)}` }
    case 'apanhou':
      return r.nao === true ? { frase: 'sem receber dano desde a última vez', curto: 'sem receber dano' } : { frase: 'recebeu dano desde a última vez', curto: 'ter recebido dano' }
    case 'acertou':
      return r.nao === true ? { frase: 'sem acertar ninguém nesta vez', curto: 'sem acertar ninguém' } : { frase: 'acertou alguém nesta vez', curto: 'acertar alguém' }
    case 'errou':
      return r.nao === true ? iguais('sem errar o último ataque') : { frase: 'errou o último ataque', curto: 'ter errado o último ataque' }
  }
}

function textosDoTempoEDoAlvo(r: RequisitoDo<'rodada' | 'depoisDe' | 'jaUsada' | 'ordemNaVez' | 'alvoComSelo' | 'alvoVida' | 'alvoMarcado' | 'alvoTipo' | 'alvoJaAgiu'>): TextosDoRequisito {
  switch (r.tipo) {
    case 'rodada':
      return iguais(r.ate === true ? `até a rodada ${r.n}` : `a partir da rodada ${r.n}`)
    case 'depoisDe':
      return r.nao === true ? { frase: `sem usar ${r.cartao.nome} logo antes`, curto: `sem ${r.cartao.nome} logo antes` } : { frase: `logo depois de usar ${r.cartao.nome}`, curto: `logo depois de ${r.cartao.nome}` }
    case 'jaUsada':
      return r.nao === true ? iguais(`sem ter usado ${r.cartao.nome} nesta batalha`) : { frase: `depois de usar ${r.cartao.nome} nesta batalha`, curto: `ter usado ${r.cartao.nome}` }
    case 'ordemNaVez': {
      const qual = r.qual === 'primeira' ? 'a primeira ação da vez' : 'a última ação da vez'
      return iguais(r.nao === true ? `não ser ${qual}` : qual)
    }
    case 'alvoComSelo':
      return r.nao === true ? { frase: `alvo sem o selo ${r.nome}`, curto: `alvo sem ${r.nome}` } : { frase: `alvo com o selo ${r.nome}`, curto: `alvo com ${r.nome}` }
    case 'alvoVida':
      return { frase: `alvo com vida ${LADO[r.lado]} de ${r.porcento}%`, curto: `alvo ${LADO[r.lado]} de ${r.porcento}%` }
    case 'alvoMarcado':
      return r.nao === true ? { frase: 'alvo sem a marca de quem usa', curto: 'alvo sem marca' } : { frase: 'alvo marcado por quem usa', curto: 'alvo marcado' }
    case 'alvoTipo':
      return iguais(r.nao === true ? `não contra ${ALVOS[r.quem]}` : `só contra ${ALVOS[r.quem]}`)
    case 'alvoJaAgiu':
      return iguais(r.nao === true ? 'alvo que ainda não agiu nesta rodada' : 'alvo que já agiu nesta rodada')
  }
}

function textosDoCampoEDoEquipamento(r: RequisitoDo<'aliadoPerto' | 'sozinho' | 'semInimigoColado' | 'inimigosPerto' | 'luz' | 'item' | 'armaNaMao' | 'municao'>): TextosDoRequisito {
  switch (r.tipo) {
    case 'aliadoPerto':
      return { frase: `um aliado a até ${casas(r.casas)}`, curto: `aliado a até ${casas(r.casas)}` }
    case 'sozinho':
      return iguais(`nenhum aliado a até ${casas(r.casas)}`)
    case 'semInimigoColado':
      return iguais(r.nao === true ? 'com um inimigo colado' : 'nenhum inimigo colado')
    case 'inimigosPerto': {
      const onde = r.casas === undefined ? 'no alcance' : `a até ${casas(r.casas)}`
      return { frase: `${plural(r.n, 'inimigo', 'inimigos')} ou mais ${onde}`, curto: `${plural(r.n, 'inimigo', 'inimigos')} ${onde}` }
    }
    case 'luz':
      return iguais(r.onde === 'luz' ? 'na luz' : 'no escuro')
    case 'item':
      if (r.nao === true) return { frase: `sem ${r.item.nome} na mochila`, curto: `sem ${r.item.nome}` }
      return { frase: r.gasta === true ? `gasta ${r.quantidade} ${r.item.nome}` : `com ${r.quantidade} ${r.item.nome} na mochila`, curto: `${r.quantidade} ${r.item.nome}` }
    case 'armaNaMao': {
      const qual = r.arma !== undefined ? r.arma.nome : r.categoria !== undefined ? `arma da categoria ${r.categoria}` : null
      return r.nao === true ? iguais(`sem ${qual ?? 'arma'} na mão`) : { frase: `com ${qual ?? 'uma arma'} na mão`, curto: `${qual ?? 'uma arma'} na mão` }
    }
    case 'municao': {
      const balas = plural(r.n, 'bala', 'balas')
      return { frase: r.gasta === true ? `gasta ${balas}` : `com ${balas} ou mais`, curto: balas }
    }
  }
}

function textosDosAliadosEDoResto(r: RequisitoDo<'pedirAoAliado' | 'ajudaDeAliado' | 'aliadoUsou' | 'aliadosDePe' | 'aliadoCaiu' | 'teste' | 'disputa' | 'personalizado' | 'mestreDecide'>): TextosDoRequisito {
  switch (r.tipo) {
    case 'pedirAoAliado': {
      const quanto = `${r.n} ${RECURSO[r.recurso]}`
      return { frase: r.gasta === true ? `pede ${quanto} a um aliado` : `um aliado com ${quanto} ou mais aceita`, curto: `${quanto} de um aliado` }
    }
    case 'ajudaDeAliado':
      return { frase: `ajuda de um aliado com ${r.marca}`, curto: `ajuda de aliado com ${r.marca}` }
    case 'aliadoUsou':
      return iguais(r.nao === true ? `nenhum aliado usou ${r.cartao.nome} nesta rodada` : `um aliado usou ${r.cartao.nome} nesta rodada`)
    case 'aliadosDePe':
      return iguais(r.quantos === 'todos' ? 'todos os aliados de pé' : `${plural(r.quantos, 'aliado', 'aliados')} ou mais de pé`)
    case 'aliadoCaiu':
      return iguais(r.nao === true ? 'nenhum aliado caiu nesta batalha' : 'um aliado caiu nesta batalha')
    case 'teste':
      return { frase: `passar num teste de ${r.atributo.nome} CD ${r.cd} (se falhar, ${SE_FALHAR[r.seFalhar]})`, curto: `teste de ${r.atributo.nome} CD ${r.cd}` }
    case 'disputa': {
      const contra = r.doAlvo === undefined || r.doAlvo.nome === r.atributo.nome ? 'com o alvo' : `contra ${r.doAlvo.nome} do alvo`
      return { frase: `vencer uma disputa de ${r.atributo.nome} ${contra} (se perder, ${SE_FALHAR[r.seFalhar]})`, curto: `vencer a disputa de ${r.atributo.nome}` }
    }
    case 'personalizado':
      return iguais(r.texto)
    case 'mestreDecide':
      return { frase: r.texto === undefined ? 'o mestre decide' : `o mestre decide: ${r.texto}`, curto: 'o mestre deixar' }
  }
}

function textosDoRequisito(r: Requisito): TextosDoRequisito {
  switch (r.tipo) {
    case 'sp':
    case 'contador':
    case 'concentracao':
    case 'pagaVida':
    case 'reacaoLivre':
      return textosDoRecurso(r)
    case 'vida':
    case 'escudo':
    case 'ligada':
    case 'selo':
    case 'naForma':
    case 'parado':
    case 'andou':
    case 'apanhou':
    case 'acertou':
    case 'errou':
      return textosDoEstado(r)
    case 'rodada':
    case 'depoisDe':
    case 'jaUsada':
    case 'ordemNaVez':
    case 'alvoComSelo':
    case 'alvoVida':
    case 'alvoMarcado':
    case 'alvoTipo':
    case 'alvoJaAgiu':
      return textosDoTempoEDoAlvo(r)
    case 'aliadoPerto':
    case 'sozinho':
    case 'semInimigoColado':
    case 'inimigosPerto':
    case 'luz':
    case 'item':
    case 'armaNaMao':
    case 'municao':
      return textosDoCampoEDoEquipamento(r)
    case 'pedirAoAliado':
    case 'ajudaDeAliado':
    case 'aliadoUsou':
    case 'aliadosDePe':
    case 'aliadoCaiu':
    case 'teste':
    case 'disputa':
    case 'personalizado':
    case 'mestreDecide':
      return textosDosAliadosEDoResto(r)
  }
}

function textosDaOpcao(opcao: OpcaoDoUmDestes): TextosDoRequisito {
  if (!ehNaoLido(opcao)) return textosDoRequisito(opcao)
  return iguais(opcao.porque === 'appNovo' ? MOTIVO_DE_APP_NOVO : MOTIVO_DO_TORTO)
}

/** A frase inteira de um requisito ("Polaridade 2 ou mais, gasta 2"; a peça não lida: "Requisito de app mais novo: atualize o app"). */
export function fraseDoRequisito(requisito: OpcaoDoUmDestes): string {
  return maiuscula(textosDaOpcao(requisito).frase)
}

/** O nome curto do requisito, o que vai no motivo ("Polaridade 2", "50 SP", "Melodia ligada"). */
export function nomeCurtoDoRequisito(requisito: OpcaoDoUmDestes): string {
  return textosDaOpcao(requisito).curto
}

/** "Um destes: gasta 50 SP ou ajuda de um aliado com Fogo". */
export function fraseDoUmDestes(grupo: UmDestes): string {
  if (grupo.umDestes.length === 0) return 'Um destes: nenhuma opção ainda'
  return `Um destes: ${grupo.umDestes.map((opcao) => textosDaOpcao(opcao).frase).join(' ou ')}`
}

function fraseDaPeca(peca: PecaDoGrupo): string {
  return ehUmDestes(peca) ? fraseDoUmDestes(peca) : fraseDoRequisito(peca)
}

/** A frase da peça no meio de uma frase maior ("precisa: 50 SP ou mais; com Melodia ligada"): sem a maiúscula do começo, os nomes como vieram. */
function fraseDaPecaNoMeio(peca: PecaDoGrupo): string {
  return ehUmDestes(peca) ? minuscula(fraseDoUmDestes(peca)) : textosDaOpcao(peca).frase
}

function curtoDaPeca(peca: PecaDoGrupo): string {
  return ehUmDestes(peca) ? peca.umDestes.map(nomeCurtoDoRequisito).join(' ou ') : nomeCurtoDoRequisito(peca)
}

/** Uma linha por peça da raiz "Todos estes". `noMeio`: as linhas vão juntas depois de "precisa:" (sem maiúscula no começo). */
export function frasesDoGrupo(grupo: GrupoDeRequisitos, noMeio = false): string[] {
  return grupo.todos.map(noMeio ? fraseDaPecaNoMeio : fraseDaPeca)
}

/** Uma seção do bloco, com o título que o editor e o menu mostram. */
export interface SecaoDosRequisitos {
  titulo: string
  linhas: string[]
}

/**
 * O bloco inteiro, por seção; seção vazia não sai. `ehForma`: o cartão é uma forma (o "Para usar"
 * vira "Para ligar"). `noMeio`: quem mostra junta as linhas de uma seção numa frase só ("Para usar:
 * 50 SP ou mais; com Melodia ligada"), então os requisitos saem sem a maiúscula do começo.
 */
export function frasesDosRequisitos(bloco: RequisitosDoCartao, ehForma = false, noMeio = false): SecaoDosRequisitos[] {
  const secoes: SecaoDosRequisitos[] = []
  if (bloco.usar !== undefined && bloco.usar.todos.length > 0) secoes.push({ titulo: ehForma ? 'Para ligar' : 'Para usar', linhas: frasesDoGrupo(bloco.usar, noMeio) })
  // As linhas fixas também vão no meio da frase com `noMeio` (nenhuma começa por nome).
  const fixa = (texto: string): string => (noMeio ? minuscula(texto) : texto)
  if (bloco.evoluir !== undefined) secoes.push({ titulo: 'Para evoluir', linhas: [...frasesDoGrupo(bloco.evoluir.grupo, noMeio), fixa('Evoluída, vale até ser usada uma vez')] })
  if (bloco.aoUsar !== undefined) secoes.push({ titulo: 'Ao usar', linhas: [fixa('Sobe uma Parte da forma de onde vem')] })
  const forma: string[] = []
  if (bloco.forma?.partesEmOrdem === true) forma.push(fixa('Uma Parte por vez, em ordem'))
  if (bloco.forma?.soLigaPor !== undefined) forma.push(fixa(`Só liga com ${bloco.forma.soLigaPor.map((ref) => ref.nome).join(' ou ')}`))
  if (forma.length > 0) secoes.push({ titulo: 'Forma', linhas: forma })
  return secoes
}

/** O que falta: a peça e, quando ela tem número, o que quem usa tem agora ("tem 1"). */
export interface FaltaDoRequisito {
  peca: PecaDoGrupo
  tem?: number | string
}

function temAlgumDeAppNovo(faltas: readonly FaltaDoRequisito[]): boolean {
  const opcoes = faltas.flatMap(({ peca }) => (ehUmDestes(peca) ? peca.umDestes : [peca]))
  return opcoes.some((opcao) => ehNaoLido(opcao) && opcao.porque === 'appNovo')
}

/**
 * O motivo curto do cinza: "Falta: Polaridade 2, tem 1"; vários, separados por ";". Peça de app
 * mais novo manda sozinha ("Requisito de app mais novo: atualize o app"). Nada faltando = `null`.
 */
export function motivoDaFalta(faltas: readonly FaltaDoRequisito[]): string | null {
  if (faltas.length === 0) return null
  if (temAlgumDeAppNovo(faltas)) return MOTIVO_DE_APP_NOVO
  return `Falta: ${faltas.map(({ peca, tem }) => (tem === undefined ? curtoDaPeca(peca) : `${curtoDaPeca(peca)}, tem ${tem}`)).join('; ')}`
}

/** A nota do registro quando o mestre usa mesmo assim: "(o mestre forçou: faltava Melodia ligada)". */
export function fraseDoForcado(faltas: readonly FaltaDoRequisito[]): string {
  return `(o mestre forçou: faltava ${faltas.map(({ peca }) => curtoDaPeca(peca)).join('; ')})`
}

/** A pergunta da caixa do requisito personalizado: "Cumpriu: Só depois de ouvir a música do bardo?". */
export function perguntaDaCaixa(requisito: RequisitoDo<'personalizado'>): string {
  return `Cumpriu: ${requisito.texto.replace(/[.!?;:,\s]+$/u, '')}?`
}

/** A nota do registro de quem marcou a caixa: "(declarou: Só depois de ouvir a música do bardo)". */
export function fraseDoDeclarado(requisitos: readonly RequisitoDo<'personalizado'>[]): string {
  return `(declarou: ${requisitos.map((requisito) => requisito.texto.replace(/[.!?;:,\s]+$/u, '')).join('; ')})`
}

/** A frase da pendência de ajuda para os dois lados: "Vagn pede 30 SP para Chuva". */
export function fraseDoPedidoDeAjuda(quemPede: string, requisito: RequisitoDo<'pedirAoAliado' | 'ajudaDeAliado' | 'mestreDecide'>, tecnica: string): string {
  switch (requisito.tipo) {
    case 'pedirAoAliado':
      return `${quemPede} pede ${requisito.n} ${RECURSO[requisito.recurso]} para ${tecnica}`
    case 'ajudaDeAliado':
      return `${quemPede} pede ajuda (${requisito.marca}) para ${tecnica}`
    case 'mestreDecide': {
      // J2: a caixa do mestre diz o requisito como foi escrito ("Ana pede: Só se o bardo tocou").
      const texto = requisito.texto?.trim() ?? ''
      return texto === '' ? `${quemPede} pede ao mestre para usar ${tecnica}` : `${quemPede} pede: ${texto}`
    }
  }
}

/** A nota do registro quando o mestre aprova o J2: "(o mestre aprovou: Só se o bardo tocou)". */
export function fraseDoAprovado(requisitos: readonly RequisitoDo<'mestreDecide'>[]): string {
  const textos = requisitos.flatMap((requisito) => {
    const texto = (requisito.texto ?? '').replace(/[.!?;:,\s]+$/u, '').trim()
    return texto === '' ? [] : [texto]
  })
  return textos.length === 0 ? '(o mestre aprovou)' : `(o mestre aprovou: ${textos.join('; ')})`
}

/* ------------------------------------------------------------------ o acumulador ---------- */

function fraseDaSubida(regra: SubidaDoAcumulador): string {
  switch (regra.quando) {
    case 'gastaReacao':
      return `+${regra.quanto} ao gastar a reação`
    case 'acerta':
      return `+${regra.quanto} ao acertar um golpe`
    case 'apanha':
      return `+${regra.quanto} ao receber dano`
    case 'usaTecnica':
      return regra.seAcertar === true ? `+${regra.quanto} quando ${regra.tecnica.nome} acerta` : `+${regra.quanto} ao usar ${regra.tecnica.nome}`
    case 'comecoDaVez':
      return `+${regra.quanto} no começo da vez`
    case 'derruba':
      return `+${regra.quanto} ao derrubar alguém`
    case 'esquiva':
      return `+${regra.quanto} ao esquivar`
    case 'gastaSp':
      return `+${regra.quanto} a cada ${regra.cada} SP gastos`
  }
}

function fraseDaDescida(regra: DescidaDoAcumulador): string {
  switch (regra.quando) {
    case 'fimDaBatalha':
      return 'zera no fim da batalha'
    case 'rodadaSemUso':
      return `−${regra.quanto} por rodada sem usar`
    case 'apanha':
      return regra.quanto === 'tudo' ? 'zera ao receber dano' : `−${regra.quanto} ao receber dano`
  }
}

function fraseDoGanho(ganho: GanhoDoAcumulador): string {
  if (ganho.ganho === 'nada') return 'Cada nível: nada a mais (só conta)'
  const doQue = ganho.ganho === 'dano' ? 'de dano em todo golpe que acerta' : `de ${ganho.atributo.nome}`
  if (ganho.cada !== undefined) return `Cada nível: +${ganho.cada} ${doQue}`
  return `${ganho.niveis.map((valor, indice) => `${indice === 0 ? 'Nível' : 'nível'} ${indice + 1}: +${valor}`).join(', ')} ${doQue}`
}

/**
 * O acumulador em linhas: "Polaridade, até o nível 3" / "Sobe: +1 ao gastar a reação" / "Cai: zera
 * no fim da batalha" / "Nível 1: +10, nível 2: +20, nível 3: +30 de dano em todo golpe que acerta".
 */
export function frasesDoAcumulador(acumulador: AcumuladorDaFicha): string[] {
  const textoDaNaoLida = (porque: 'appNovo' | 'torto'): string => (porque === 'appNovo' ? 'regra de app mais novo (atualize o app)' : 'regra torta (refaça no editor)')
  const sobe = acumulador.sobe.map((regra) => (regra.quando === 'naoLida' ? textoDaNaoLida(regra.porque) : fraseDaSubida(regra)))
  const desce = acumulador.desce.map((regra) => (regra.quando === 'naoLida' ? textoDaNaoLida(regra.porque) : fraseDaDescida(regra)))
  return [
    `${acumulador.nome}, até o nível ${acumulador.maximo}`,
    sobe.length === 0 ? 'Sobe: só por uma técnica que dá "+N"' : `Sobe: ${sobe.join('; ')}`,
    desce.length === 0 ? 'Cai: só quando um requisito gasta' : `Cai: ${desce.join('; ')}`,
    acumulador.ganho.ganho === 'naoLido' ? `Cada nível: ${textoDaNaoLida(acumulador.ganho.porque)}` : fraseDoGanho(acumulador.ganho),
  ]
}

/** A peça de efeito: "+1 Polaridade". */
export function fraseDaPecaDoAcumulador(peca: PecaDoAcumulador): string {
  return `+${peca.quanto} ${peca.acumulador.nome}`
}
