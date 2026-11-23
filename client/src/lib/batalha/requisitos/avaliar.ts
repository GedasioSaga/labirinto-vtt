import { mesmaMarca, type RequisitosLidos } from './ler'
import {
  MOTIVO_DE_APP_NOVO,
  MOTIVO_DO_ALVO_ESCONDIDO,
  MOTIVO_NA_REACAO,
  MOTIVO_SO_NA_MESA,
  NOTA_O_MESTRE_CONFERE,
  fraseDoRequisito,
  fraseDoUmDestes,
  motivoDaFalta,
  nomeCurtoDoRequisito,
  perguntaDaCaixa,
  type FaltaDoRequisito,
} from './frases'
import {
  RESPOSTA_SIM,
  chaveDaResposta,
  ehNaoLido,
  ehUmDestes,
  type GrupoDeRequisitos,
  type OpcaoDoUmDestes,
  type PecaDoGrupo,
  type RecursoDoAliado,
  type Referencia,
  type Requisito,
  type RequisitoDo,
  type RequisitosDoCartao,
  type UmDestes,
} from './modelo'
import { mesmaReferencia, type AlvoNoContexto, type ContextoDosRequisitos, type RespostasDosRequisitos, type VizinhoNoContexto, type VizinhosNoContexto } from './contexto'
import type { OpcaoDaPergunta, PerguntaNaHora } from '../perguntaNaHora'

/**
 * REQUISITOS: O AVALIADOR (fase B1 de docs/design/habilidades/REQUISITOS.md §4). Uma função pura
 * julga o grupo contra o retrato da batalha (`contexto.ts`) e o que já foi respondido; a mesma
 * conta no menu do mestre, no do jogador, no host, no Testar e no treino do Lobby.
 *
 * Cada requisito sai `ok`, `falta`, `pergunta` (espera a caixa, o aliado, o mestre ou o d20) ou
 * `naoSei` (o retrato não tem o dado: "o mestre confere"; a técnica fica clicável e o host decide).
 * O veredito: alguma falta = `falta`; senão, alguma pergunta = `pergunta`; senão `cumpre`. As
 * perguntas só saem quando nada automático falta.
 *
 * "Um destes": vale se uma opção vale. Com resposta (`req.<id do grupo>`), vale a opção escolhida.
 * Sem resposta: uma opção só que não falta é a escolhida; com várias, a primeira que já vale sem
 * gastar nem perguntar nada; senão quem usa escolhe (a pergunta `escolha`).
 *
 * Os gastos saem só dos requisitos que valem: o mestre que força pula os que faltam e os gastos
 * deles (o custo normal da técnica continua, e é do portão, não daqui).
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** O requisito de alvo antes da mira (o menu): espera o alvo. */
export const NOTA_NO_ALVO = 'confere ao escolher o alvo'

export type EstadoDoRequisito = 'ok' | 'falta' | 'pergunta' | 'naoSei'
export type Veredito = 'cumpre' | 'falta' | 'pergunta'

/** O que o requisito gasta ao usar (só os que valem). `doAliado`: o aliado só paga; nada passa para quem pediu. */
export type Gasto = { requisitoId: string } & (
  | { recurso: 'sp'; n: number }
  | { recurso: 'hp'; n: number }
  | { recurso: 'acumulador'; acumulador: Referencia; n: number }
  | { recurso: 'concentracao'; n: number }
  | { recurso: 'reacao' }
  | { recurso: 'item'; item: Referencia; n: number }
  | { recurso: 'municao'; n: number }
  | { recurso: 'doAliado'; aliadoTokenId: string; de: RecursoDoAliado; n: number }
)

/** Um aliado que pode atender o pedido (G1, G2). `mestre`: NPC, quem responde é o mestre. */
export interface CandidatoDaAjuda {
  tokenId: string
  nome: string
  responde: 'dono' | 'mestre'
}

/**
 * O que espera alguém, na ordem em que a tela pergunta (§10): a escolha do "Um destes", a caixa
 * "Cumpriu?", o aliado; o mestre e o teste são do host. A escolha e a caixa já vêm no formato da
 * `PerguntaNaHora` (resposta no campo `respostas` do pedido).
 */
export type PerguntaDosRequisitos =
  | { tipo: 'escolha'; grupoId: string; pergunta: PerguntaNaHora }
  | { tipo: 'caixa'; requisitoId: string; pergunta: PerguntaNaHora }
  | { tipo: 'aliado'; requisitoId: string; requisito: RequisitoDo<'pedirAoAliado' | 'ajudaDeAliado'>; candidatos: readonly CandidatoDaAjuda[]; escolhido: string | null }
  | { tipo: 'mestre'; requisitoId: string; requisito: RequisitoDo<'mestreDecide'> }
  | { tipo: 'teste'; requisitoId: string; requisito: RequisitoDo<'teste' | 'disputa'> }

const ORDEM_DAS_PERGUNTAS: Readonly<Record<PerguntaDosRequisitos['tipo'], number>> = { escolha: 0, caixa: 1, aliado: 2, mestre: 3, teste: 4 }

/** A etiqueta curta do requisito que pergunta (o menu a mostra ao lado da técnica). */
export const ETIQUETA_DA_PERGUNTA: Readonly<Record<PerguntaDosRequisitos['tipo'], string>> = {
  escolha: 'escolha um',
  caixa: 'Cumpriu?',
  aliado: 'pede ajuda',
  mestre: 'o mestre decide',
  teste: 'teste',
}

/** Um requisito julgado: a frase, e na falta o pedaço do motivo ("Polaridade 2, tem 1"). */
export interface AvaliacaoDoRequisito {
  tipo: 'requisito'
  id: string
  estado: EstadoDoRequisito
  frase: string
  motivo?: string
  nota?: string
  /** O que ele gasta se valer (a prévia do menu); o que vale de fato está em `AvaliacaoDosRequisitos.gastos`. */
  gastos: readonly Gasto[]
}

/** Um "Um destes" julgado, com cada opção e a escolhida (`null` = nenhuma ainda). */
export interface AvaliacaoDoUmDestes {
  tipo: 'umDestes'
  id: string
  estado: EstadoDoRequisito
  frase: string
  motivo?: string
  nota?: string
  opcoes: readonly AvaliacaoDoRequisito[]
  escolhida: string | null
}

export interface AvaliacaoDosRequisitos {
  veredito: Veredito
  /** Uma por peça da raiz, na ordem do bloco. */
  itens: readonly (AvaliacaoDoRequisito | AvaliacaoDoUmDestes)[]
  /** O motivo curto do cinza ("Falta: Polaridade 2, tem 1"); `null` fora da falta. */
  motivo: string | null
  /** As peças que faltam (para o registro do mestre que força, `fraseDoForcado`). */
  faltas: readonly FaltaDoRequisito[]
  /** O que sai ao usar: só dos requisitos que valem. */
  gastos: readonly Gasto[]
  /** O que espera alguém; vazio fora do veredito `pergunta`. */
  perguntas: readonly PerguntaDosRequisitos[]
  /** A caixa e a escolha feitas (respondidas ou não): o host confere as `respostas` contra elas (`motivoDasRespostas`). */
  perguntasNaHora: readonly PerguntaNaHora[]
  /** Algum requisito ficou sem dado: clicável, com a nota "o mestre confere". */
  naoSei: boolean
  notas: readonly string[]
  /** As caixas marcadas "sim" (`fraseDoDeclarado`). */
  declarados: readonly RequisitoDo<'personalizado'>[]
  /** Um teste falhou com "perde a ação": a ação e o custo vão, o golpe não sai. */
  perdeAAcao: boolean
}

/* ------------------------------------------------------------------ o julgamento de um ---- */

/** O julgamento de um requisito, antes de virar item. `especial`: a falta tem motivo fixo (reação, treino, alvo escondido). */
interface Julgamento {
  estado: EstadoDoRequisito
  tem?: number | string
  nota?: string
  especial?: string
  /** O que gasta se valer. */
  gastos?: readonly Gasto[]
  pergunta?: PerguntaDosRequisitos
  /** A caixa perguntada (respondida ou não). */
  perguntaNaHora?: PerguntaNaHora
  declarado?: RequisitoDo<'personalizado'>
  perdeAAcao?: true
}

const OK: Julgamento = { estado: 'ok' }

function ok(gastos: readonly Gasto[] = []): Julgamento {
  return { estado: 'ok', gastos }
}

function falta(tem?: number | string): Julgamento {
  return { estado: 'falta', tem }
}

function naoSei(nota: string = NOTA_O_MESTRE_CONFERE): Julgamento {
  return { estado: 'naoSei', nota }
}

/** Sim ou não, com o "não ter" do requisito; `undefined` = não sei. */
function conforme(vale: boolean | undefined, nao: true | undefined, tem?: number | string): Julgamento {
  if (vale === undefined) return naoSei()
  return (nao === true ? !vale : vale) ? OK : falta(tem)
}

function mesmoNome(a: string, b: string): boolean {
  return mesmaMarca(a, b)
}

/** A porcentagem de vida, arredondada para o lado que não mente no motivo ("abaixo de 30%, tem 30%"). */
function porcentoDaVida(atual: number, max: number, lado: 'abaixo' | 'acima'): string {
  const exata = (atual * 100) / max
  return `${lado === 'abaixo' ? Math.floor(exata) : Math.ceil(exata)}%`
}

function vidaDoLado(atual: number, max: number, porcento: number, lado: 'abaixo' | 'acima'): boolean {
  return lado === 'abaixo' ? atual * 100 < porcento * max : atual * 100 > porcento * max
}

function julgarRecurso(r: RequisitoDo<'sp' | 'vida' | 'escudo' | 'contador' | 'concentracao' | 'pagaVida' | 'reacaoLivre'>, ctx: ContextoDosRequisitos): Julgamento {
  const quem = ctx.quemUsa
  switch (r.tipo) {
    case 'sp': {
      if (quem.sp === undefined) return naoSei()
      if (r.nao === true) return quem.sp < r.n ? OK : falta(quem.sp)
      if (r.gasta !== true) return quem.sp >= r.n ? OK : falta(quem.sp)
      // Gasta ALÉM do custo normal da técnica (35 de custo + "gasta 50" = 85).
      const custo = ctx.custoEmSp ?? 0
      if (quem.sp - custo >= r.n) return ok([{ requisitoId: r.id, recurso: 'sp', n: r.n }])
      return falta(custo > 0 ? `${quem.sp - custo} além do custo` : quem.sp)
    }
    case 'vida':
      if (quem.vida === undefined || quem.vida.max <= 0) return naoSei()
      return vidaDoLado(quem.vida.atual, quem.vida.max, r.porcento, r.lado) ? OK : falta(porcentoDaVida(quem.vida.atual, quem.vida.max, r.lado))
    case 'escudo':
      return conforme(quem.escudo === undefined ? undefined : quem.escudo > 0, r.nao)
    case 'contador': {
      if (quem.acumuladores === undefined) return naoSei()
      const id = r.acumulador.id
      const achado = (id === undefined ? undefined : quem.acumuladores.find((a) => a.id === id)) ?? quem.acumuladores.find((a) => mesmoNome(a.nome, r.acumulador.nome))
      const nivel = achado?.nivel ?? 0 // a ficha sem esse acumulador está no nível 0
      if (r.nao === true) return nivel < r.nivel ? OK : falta(nivel)
      if (nivel < r.nivel) return falta(nivel)
      return ok(r.gasta === true ? [{ requisitoId: r.id, recurso: 'acumulador', acumulador: r.acumulador, n: r.nivel }] : [])
    }
    case 'concentracao': {
      if (quem.carga === undefined) return naoSei()
      if (r.nao === true) return quem.carga < r.n ? OK : falta(quem.carga)
      if (quem.carga < r.n) return falta(quem.carga)
      return ok(r.gasta === true ? [{ requisitoId: r.id, recurso: 'concentracao', n: r.n }] : [])
    }
    case 'pagaVida': {
      if (quem.vida === undefined) return naoSei()
      // A porcentagem é do HP máximo, arredondada para cima (nunca paga menos do que diz).
      const custo = r.porcento !== undefined ? Math.ceil((quem.vida.max * r.porcento) / 100) : r.hp
      // A mesma regra do custo de hoje (`motivoDaTecnica`): tem de ter o que paga.
      return quem.vida.atual >= custo ? ok([{ requisitoId: r.id, recurso: 'hp', n: custo }]) : falta(`${quem.vida.atual} HP`)
    }
    case 'reacaoLivre':
      if (quem.reacaoLivre === undefined) return naoSei()
      return quem.reacaoLivre ? ok([{ requisitoId: r.id, recurso: 'reacao' }]) : falta()
  }
}

function julgarEstado(r: RequisitoDo<'ligada' | 'selo' | 'naForma' | 'parado' | 'andou' | 'apanhou' | 'acertou' | 'errou'>, ctx: ContextoDosRequisitos): Julgamento {
  const quem = ctx.quemUsa
  const rastro = quem.rastro
  switch (r.tipo) {
    case 'ligada': {
      const opcao = r.opcao
      const ligada = quem.ligadas?.some((l) => mesmaReferencia(l, r.cartao) && (opcao === undefined || (l.opcao !== undefined && mesmoNome(l.opcao, opcao))))
      return conforme(ligada, r.nao)
    }
    case 'selo':
      return conforme(quem.selos?.some((selo) => mesmoNome(selo, r.nome)), r.nao)
    case 'naForma': {
      const forma = r.forma
      return conforme(quem.formas === undefined ? undefined : forma === undefined ? quem.formas.length > 0 : quem.formas.some((f) => mesmaReferencia(f, forma)), r.nao)
    }
    case 'parado':
      return conforme(rastro?.casasAndadas === undefined ? undefined : rastro.casasAndadas === 0, undefined)
    case 'andou': {
      const casas = rastro?.casasAndadas
      if (casas === undefined) return naoSei()
      return casas >= r.casas ? OK : falta(casas)
    }
    case 'apanhou':
      return conforme(rastro?.danoDesdeAVez === undefined ? undefined : rastro.danoDesdeAVez > 0, r.nao)
    case 'acertou':
      return conforme(rastro?.acertouNaVez, r.nao)
    case 'errou':
      return conforme(rastro?.ultimoAtaque === undefined ? undefined : rastro.ultimoAtaque === 'errou', r.nao)
  }
}

function julgarTempo(r: RequisitoDo<'rodada' | 'depoisDe' | 'jaUsada' | 'ordemNaVez'>, ctx: ContextoDosRequisitos): Julgamento {
  const rastro = ctx.quemUsa.rastro
  switch (r.tipo) {
    case 'rodada':
      if (ctx.rodada === undefined) return naoSei()
      return (r.ate === true ? ctx.rodada <= r.n : ctx.rodada >= r.n) ? OK : falta(ctx.rodada)
    case 'depoisDe': {
      const ultima = rastro?.ultimaAcao
      if (ultima === undefined) return naoSei()
      return conforme(ultima !== null && ultima.tipo === 'cartao' && mesmaReferencia(ultima.cartao, r.cartao), r.nao)
    }
    case 'jaUsada':
      return conforme(rastro?.usadas?.some((usada) => mesmaReferencia(usada, r.cartao)), r.nao)
    case 'ordemNaVez':
      if (r.qual === 'primeira') return conforme(rastro?.acoesNaVez === undefined ? undefined : rastro.acoesNaVez === 0, r.nao)
      return conforme(rastro?.ehAUltimaAcao, r.nao)
  }
}

/** Um alvo contra o requisito de alvo. A vida só entra no motivo para quem vê a barra. */
function julgarUmAlvo(r: RequisitoDo<'alvoComSelo' | 'alvoVida' | 'alvoMarcado' | 'alvoTipo' | 'alvoJaAgiu'>, alvo: AlvoNoContexto): Julgamento {
  switch (r.tipo) {
    case 'alvoComSelo':
      return conforme(alvo.selos?.some((selo) => mesmoNome(selo, r.nome)), r.nao)
    case 'alvoVida': {
      if (alvo.vida === undefined || alvo.vida.max <= 0) return naoSei()
      if (vidaDoLado(alvo.vida.atual, alvo.vida.max, r.porcento, r.lado)) return OK
      return alvo.barraVisivel ? falta(porcentoDaVida(alvo.vida.atual, alvo.vida.max, r.lado)) : { estado: 'falta', especial: MOTIVO_DO_ALVO_ESCONDIDO }
    }
    case 'alvoMarcado':
      return conforme(alvo.marcadoPorQuemUsa, r.nao)
    case 'alvoTipo':
      return conforme(alvo.tipo === undefined ? undefined : alvo.tipo === r.quem, r.nao)
    case 'alvoJaAgiu':
      return conforme(alvo.jaAgiuNaRodada, r.nao)
  }
}

/** Com vários alvos, todos têm de cumprir. Sem alvo ainda (o menu), espera a mira. */
function julgarAlvos(r: RequisitoDo<'alvoComSelo' | 'alvoVida' | 'alvoMarcado' | 'alvoTipo' | 'alvoJaAgiu'>, ctx: ContextoDosRequisitos): Julgamento {
  if (ctx.alvos === undefined) return naoSei(NOTA_NO_ALVO)
  if (ctx.alvos.length === 0) return falta()
  const julgados = ctx.alvos.map((alvo) => julgarUmAlvo(r, alvo))
  return julgados.find((j) => j.estado === 'falta') ?? julgados.find((j) => j.estado === 'naoSei') ?? OK
}

/**
 * Tem alguém de pé a até `casas`? `true` = alguém conhecido está; `false` = certeza de que
 * ninguém; `undefined` = não sei (distância desconhecida, ou gente que quem lê não enxerga).
 */
function alguemAte(vizinhos: VizinhosNoContexto | undefined, casas: number): boolean | undefined {
  if (vizinhos === undefined) return undefined
  const dePe = vizinhos.lista.filter((v) => v.dePe)
  if (dePe.some((v) => v.distancia !== undefined && v.distancia <= casas)) return true
  return vizinhos.completa && dePe.every((v) => v.distancia !== undefined) ? false : undefined
}

function julgarCampo(r: RequisitoDo<'aliadoPerto' | 'sozinho' | 'semInimigoColado' | 'inimigosPerto' | 'luz'>, ctx: ContextoDosRequisitos): Julgamento {
  switch (r.tipo) {
    case 'aliadoPerto':
      return conforme(alguemAte(ctx.aliados, r.casas), undefined)
    case 'sozinho': {
      const alguem = alguemAte(ctx.aliados, r.casas)
      return conforme(alguem === undefined ? undefined : !alguem, undefined)
    }
    case 'semInimigoColado': {
      const colado = alguemAte(ctx.inimigos, 1)
      return conforme(colado === undefined ? undefined : !colado, r.nao)
    }
    case 'inimigosPerto': {
      const raio = r.casas ?? ctx.alcanceDaTecnica
      if (raio === undefined || ctx.inimigos === undefined) return naoSei()
      const dePe = ctx.inimigos.lista.filter((v) => v.dePe)
      const perto = dePe.filter((v) => v.distancia !== undefined && v.distancia <= raio).length
      if (perto >= r.n) return OK
      const talvez = !ctx.inimigos.completa || dePe.some((v) => v.distancia === undefined)
      return talvez ? naoSei() : falta(perto)
    }
    case 'luz':
      return conforme(ctx.naLuz === undefined ? undefined : r.onde === 'luz' ? ctx.naLuz : !ctx.naLuz, undefined)
  }
}

function julgarEquipamento(r: RequisitoDo<'item' | 'armaNaMao' | 'municao'>, ctx: ContextoDosRequisitos): Julgamento {
  const quem = ctx.quemUsa
  switch (r.tipo) {
    case 'item': {
      if (quem.mochila === undefined) return naoSei()
      const tem = quem.mochila.filter((item) => mesmaReferencia(item, r.item)).reduce((soma, item) => soma + item.quantidade, 0)
      if (r.nao === true) return tem === 0 ? OK : falta(tem)
      if (tem < r.quantidade) return falta(tem)
      return ok(r.gasta === true ? [{ requisitoId: r.id, recurso: 'item', item: r.item, n: r.quantidade }] : [])
    }
    case 'armaNaMao': {
      const { arma, categoria } = r
      const armas = quem.armasNaMao
      if (armas === undefined) return naoSei()
      const tem = arma !== undefined ? armas.some((a) => mesmaReferencia(a, arma)) : categoria !== undefined ? armas.some((a) => a.categoria !== undefined && mesmoNome(a.categoria, categoria)) : armas.length > 0
      return conforme(tem, r.nao)
    }
    case 'municao':
      if (quem.balas === undefined) return naoSei()
      if (quem.balas < r.n) return falta(quem.balas)
      return ok(r.gasta === true ? [{ requisitoId: r.id, recurso: 'municao', n: r.n }] : [])
  }
}

/** O que espera alguém não vale na reação nem no treino do Lobby (§6, §7). */
function foraDaMesa(ctx: ContextoDosRequisitos): Julgamento | null {
  if (ctx.naReacao === true) return { estado: 'falta', especial: MOTIVO_NA_REACAO }
  if (ctx.noTreino === true) return { estado: 'falta', especial: MOTIVO_SO_NA_MESA }
  return null
}

/** O aliado pode atender? `undefined` = não sei (o retrato não tem o recurso ou as marcas dele). */
function aliadoPode(r: RequisitoDo<'pedirAoAliado' | 'ajudaDeAliado'>, aliado: VizinhoNoContexto): boolean | undefined {
  if (r.tipo === 'ajudaDeAliado') return aliado.marcas === undefined ? undefined : aliado.marcas.some((marca) => mesmaMarca(marca, r.marca))
  const tem = aliado[r.recurso]
  return tem === undefined ? undefined : tem >= r.n
}

/**
 * G1 e G2: o app lista só os aliados de pé que podem (a marca certa, o recurso que paga) e quem
 * pede escolhe um (`ajudaDe`). Aceito = vale; o G1 que gasta tira do aliado (ele só paga).
 */
function julgarAjuda(r: RequisitoDo<'pedirAoAliado' | 'ajudaDeAliado'>, ctx: ContextoDosRequisitos, pedido: RespostasDosRequisitos): Julgamento {
  const fora = foraDaMesa(ctx)
  if (fora !== null) return fora
  if (ctx.aliados === undefined) return naoSei()
  const dePe = ctx.aliados.lista.filter((aliado) => aliado.dePe)
  const candidatos: CandidatoDaAjuda[] = dePe.filter((aliado) => aliadoPode(r, aliado) === true).map((aliado) => ({ tokenId: aliado.tokenId, nome: aliado.nome, responde: aliado.npc ? 'mestre' : 'dono' }))
  if (candidatos.length === 0) {
    const talvez = !ctx.aliados.completa || dePe.some((aliado) => aliadoPode(r, aliado) === undefined)
    return talvez ? naoSei() : falta()
  }
  const escolhido = candidatos.find((candidato) => candidato.tokenId === pedido.ajudaDe)?.tokenId ?? null
  if (escolhido !== null && pedido.ajudaAceita === true) {
    return ok(r.tipo === 'pedirAoAliado' && r.gasta === true ? [{ requisitoId: r.id, recurso: 'doAliado', aliadoTokenId: escolhido, de: r.recurso, n: r.n }] : [])
  }
  return { estado: 'pergunta', nota: ETIQUETA_DA_PERGUNTA.aliado, pergunta: { tipo: 'aliado', requisitoId: r.id, requisito: r, candidatos, escolhido } }
}

function julgarAliados(r: RequisitoDo<'aliadoUsou' | 'aliadosDePe' | 'aliadoCaiu'>, ctx: ContextoDosRequisitos): Julgamento {
  switch (r.tipo) {
    case 'aliadoUsou':
      return conforme(ctx.usadasPorAliadosNaRodada?.some((usada) => mesmaReferencia(usada, r.cartao)), r.nao)
    case 'aliadosDePe': {
      const aliados = ctx.aliados
      if (aliados === undefined) return naoSei()
      const dePe = aliados.lista.filter((aliado) => aliado.dePe).length
      if (r.quantos === 'todos') {
        if (dePe < aliados.lista.length) return falta(`${dePe} de ${aliados.lista.length}`)
        return aliados.completa ? OK : naoSei()
      }
      if (dePe >= r.quantos) return OK
      return aliados.completa ? falta(dePe) : naoSei()
    }
    case 'aliadoCaiu': {
      // Sem o `jaCairam` (fase B3), um aliado caído agora já prova; ninguém caído agora não prova nada.
      const caiuAgora = ctx.aliados?.lista.some((aliado) => !aliado.dePe) === true
      return conforme(ctx.aliadoCaiuNaBatalha ?? (caiuAgora ? true : undefined), r.nao)
    }
  }
}

/** H1 e H2: o host rola o d20 na hora do pedido e passa o resultado em `testes`. */
function julgarTeste(r: RequisitoDo<'teste' | 'disputa'>, ctx: ContextoDosRequisitos, pedido: RespostasDosRequisitos): Julgamento {
  if (r.tipo === 'disputa' && ctx.alvos !== undefined && ctx.alvos.length === 0) return falta()
  const passou = pedido.testes?.[r.id]
  if (passou === true) return OK
  if (passou === false) return r.seFalhar === 'perdeAAcao' ? { estado: 'falta', perdeAAcao: true } : falta()
  return { estado: 'pergunta', nota: ETIQUETA_DA_PERGUNTA.teste, pergunta: { tipo: 'teste', requisitoId: r.id, requisito: r } }
}

const OPCOES_DA_CAIXA: readonly OpcaoDaPergunta[] = [
  { valor: RESPOSTA_SIM, rotulo: 'Sim, cumpri' },
  { valor: 'nao', rotulo: 'Não' },
]

/** J1: quem usa marca a caixa (vale na reação e no treino); J2: espera o mestre. */
function julgarDeclarado(r: RequisitoDo<'personalizado' | 'mestreDecide'>, ctx: ContextoDosRequisitos, pedido: RespostasDosRequisitos): Julgamento {
  if (r.tipo === 'mestreDecide') {
    const fora = foraDaMesa(ctx)
    if (fora !== null) return fora
    if (ctx.autorEhMestre === true || pedido.mestreDeixou === true) return OK
    return { estado: 'pergunta', nota: ETIQUETA_DA_PERGUNTA.mestre, pergunta: { tipo: 'mestre', requisitoId: r.id, requisito: r } }
  }
  const caixa: PerguntaNaHora = { chave: chaveDaResposta(r.id), texto: perguntaDaCaixa(r), para: 'quemUsa', tipo: 'opcoes', opcoes: OPCOES_DA_CAIXA }
  const resposta = pedido.respostas?.[caixa.chave]
  if (resposta === RESPOSTA_SIM) return { estado: 'ok', perguntaNaHora: caixa, declarado: r }
  if (resposta !== undefined) return { estado: 'falta', perguntaNaHora: caixa }
  return { estado: 'pergunta', nota: ETIQUETA_DA_PERGUNTA.caixa, perguntaNaHora: caixa, pergunta: { tipo: 'caixa', requisitoId: r.id, pergunta: caixa } }
}

function julgarRequisito(r: Requisito, ctx: ContextoDosRequisitos, pedido: RespostasDosRequisitos): Julgamento {
  switch (r.tipo) {
    case 'sp':
    case 'vida':
    case 'escudo':
    case 'contador':
    case 'concentracao':
    case 'pagaVida':
    case 'reacaoLivre':
      return julgarRecurso(r, ctx)
    case 'ligada':
    case 'selo':
    case 'naForma':
    case 'parado':
    case 'andou':
    case 'apanhou':
    case 'acertou':
    case 'errou':
      return julgarEstado(r, ctx)
    case 'rodada':
    case 'depoisDe':
    case 'jaUsada':
    case 'ordemNaVez':
      return julgarTempo(r, ctx)
    case 'alvoComSelo':
    case 'alvoVida':
    case 'alvoMarcado':
    case 'alvoTipo':
    case 'alvoJaAgiu':
      return julgarAlvos(r, ctx)
    case 'aliadoPerto':
    case 'sozinho':
    case 'semInimigoColado':
    case 'inimigosPerto':
    case 'luz':
      return julgarCampo(r, ctx)
    case 'item':
    case 'armaNaMao':
    case 'municao':
      return julgarEquipamento(r, ctx)
    case 'pedirAoAliado':
    case 'ajudaDeAliado':
      return julgarAjuda(r, ctx, pedido)
    case 'aliadoUsou':
    case 'aliadosDePe':
    case 'aliadoCaiu':
      return julgarAliados(r, ctx)
    case 'teste':
    case 'disputa':
      return julgarTeste(r, ctx, pedido)
    case 'personalizado':
    case 'mestreDecide':
      return julgarDeclarado(r, ctx, pedido)
  }
}

/* ------------------------------------------------------------------ peças e grupo --------- */

/** Uma peça da raiz julgada: o item da tela e o que ela soma ao todo. */
interface PecaJulgada<Item> {
  item: Item
  /** A peça que falta (`null` = não falta). */
  falta: FaltaDoRequisito | null
  /** O motivo fixo da falta, no lugar da frase curta (reação, treino, alvo escondido). */
  especial: string | null
  /** O que sai: só se vale. */
  gastos: readonly Gasto[]
  perguntas: readonly PerguntaDosRequisitos[]
  perguntasNaHora: readonly PerguntaNaHora[]
  declarados: readonly RequisitoDo<'personalizado'>[]
  perdeAAcao: boolean
  nota: string | null
}

function julgarOpcao(opcao: OpcaoDoUmDestes, ctx: ContextoDosRequisitos, pedido: RespostasDosRequisitos): Julgamento {
  // Peça que o leitor não entendeu (app mais novo, ou torta): falta, e o mestre pode forçar.
  return ehNaoLido(opcao) ? { estado: 'falta' } : julgarRequisito(opcao, ctx, pedido)
}

function motivoDoItem(peca: PecaDoGrupo, tem: number | string | undefined, especial: string | undefined): string {
  if (especial !== undefined) return especial
  const curto = ehUmDestes(peca) ? peca.umDestes.map(nomeCurtoDoRequisito).join(' ou ') : nomeCurtoDoRequisito(peca)
  return tem === undefined ? curto : `${curto}, tem ${tem}`
}

function pecaDoRequisito(opcao: OpcaoDoUmDestes, ctx: ContextoDosRequisitos, pedido: RespostasDosRequisitos): PecaJulgada<AvaliacaoDoRequisito> {
  const j = julgarOpcao(opcao, ctx, pedido)
  const vale = j.estado === 'ok'
  const item: AvaliacaoDoRequisito = { tipo: 'requisito', id: opcao.id, estado: j.estado, frase: fraseDoRequisito(opcao), gastos: j.gastos ?? [] }
  if (j.estado === 'falta') item.motivo = motivoDoItem(opcao, j.tem, j.especial)
  if (j.nota !== undefined) item.nota = j.nota
  return {
    item,
    falta: j.estado === 'falta' ? (j.especial === undefined && j.tem !== undefined ? { peca: opcao, tem: j.tem } : { peca: opcao }) : null,
    especial: j.estado === 'falta' ? (j.especial ?? null) : null,
    gastos: vale ? (j.gastos ?? []) : [],
    perguntas: j.estado === 'pergunta' && j.pergunta !== undefined ? [j.pergunta] : [],
    perguntasNaHora: j.perguntaNaHora === undefined ? [] : [j.perguntaNaHora],
    declarados: vale && j.declarado !== undefined ? [j.declarado] : [],
    perdeAAcao: j.perdeAAcao === true,
    nota: j.estado === 'naoSei' || j.estado === 'pergunta' ? (j.nota ?? null) : null,
  }
}

/** A opção que vale sem gastar nem perguntar nada. */
function valeDeGraca(opcao: PecaJulgada<AvaliacaoDoRequisito>): boolean {
  return opcao.item.estado === 'ok' && opcao.item.gastos.length === 0 && opcao.perguntasNaHora.length === 0
}

/** A opção escolhida: a da resposta; senão a única possível; senão a de graça; senão nenhuma (quem usa escolhe). */
function opcaoEscolhida(opcoes: readonly PecaJulgada<AvaliacaoDoRequisito>[], possiveis: readonly PecaJulgada<AvaliacaoDoRequisito>[], resposta: string | undefined): PecaJulgada<AvaliacaoDoRequisito> | null {
  if (resposta !== undefined) return opcoes.find((opcao) => opcao.item.id === resposta) ?? null
  if (possiveis.length === 1) return possiveis[0] ?? null
  return possiveis.find(valeDeGraca) ?? null
}

const NADA_GASTO = { gastos: [], declarados: [], perdeAAcao: false }

/**
 * O "Um destes" sem opção possível: falta. Uma opção de app mais novo deixa o grupo inteiro cinza
 * ("atualize o app", §3.1); uma de vida do alvo escondida esconde o motivo do grupo (ele listaria a
 * vida do alvo).
 */
function umDestesEmFalta(grupo: UmDestes, opcoes: readonly PecaJulgada<AvaliacaoDoRequisito>[]): PecaJulgada<AvaliacaoDoUmDestes> {
  const escondido = opcoes.some((opcao) => opcao.especial === MOTIVO_DO_ALVO_ESCONDIDO)
  const especial = escondido ? MOTIVO_DO_ALVO_ESCONDIDO : undefined
  const item: AvaliacaoDoUmDestes = { tipo: 'umDestes', id: grupo.id, estado: 'falta', frase: fraseDoUmDestes(grupo), opcoes: opcoes.map((opcao) => opcao.item), escolhida: null, motivo: motivoDoItem(grupo, undefined, especial) }
  return { ...NADA_GASTO, item, falta: { peca: grupo }, especial: especial ?? null, perguntas: [], perguntasNaHora: [], nota: null }
}

function pecaDoUmDestes(grupo: UmDestes, ctx: ContextoDosRequisitos, pedido: RespostasDosRequisitos): PecaJulgada<AvaliacaoDoUmDestes> {
  const opcoes = grupo.umDestes.map((opcao) => pecaDoRequisito(opcao, ctx, pedido))
  const deAppNovo = grupo.umDestes.some((opcao) => ehNaoLido(opcao) && opcao.porque === 'appNovo')
  const possiveis = deAppNovo ? [] : opcoes.filter((opcao) => opcao.item.estado !== 'falta')
  if (possiveis.length === 0) return umDestesEmFalta(grupo, opcoes)
  const frase = fraseDoUmDestes(grupo)
  const chave = chaveDaResposta(grupo.id)
  const dada = pedido.respostas?.[chave]
  const resposta = typeof dada === 'string' ? dada : undefined
  const escolha: PerguntaNaHora = { chave, texto: frase, para: 'quemUsa', tipo: 'opcoes', opcoes: possiveis.map((opcao) => ({ valor: opcao.item.id, rotulo: opcao.item.frase })) }
  // A escolha é perguntada quando há mais de uma possível, e sempre que veio resposta (o host a confere).
  const naHora = possiveis.length >= 2 || resposta !== undefined ? [escolha] : []
  const itens = opcoes.map((opcao) => opcao.item)
  const escolhida = opcaoEscolhida(opcoes, possiveis, resposta)
  if (escolhida !== null) {
    const item: AvaliacaoDoUmDestes = { tipo: 'umDestes', id: grupo.id, estado: escolhida.item.estado, frase, opcoes: itens, escolhida: escolhida.item.id }
    if (escolhida.item.motivo !== undefined) item.motivo = escolhida.item.motivo
    if (escolhida.item.nota !== undefined) item.nota = escolhida.item.nota
    return { ...escolhida, item, perguntasNaHora: [...naHora, ...escolhida.perguntasNaHora] }
  }
  // Mais de uma possível e nenhuma de graça (ou a resposta não é de nenhuma opção): quem usa escolhe.
  const item: AvaliacaoDoUmDestes = { tipo: 'umDestes', id: grupo.id, estado: 'pergunta', frase, opcoes: itens, escolhida: null, nota: ETIQUETA_DA_PERGUNTA.escolha }
  return { ...NADA_GASTO, item, falta: null, especial: null, perguntas: [{ tipo: 'escolha', grupoId: grupo.id, pergunta: escolha }], perguntasNaHora: [escolha], nota: ETIQUETA_DA_PERGUNTA.escolha }
}

function julgarPeca(peca: PecaDoGrupo, ctx: ContextoDosRequisitos, pedido: RespostasDosRequisitos): PecaJulgada<AvaliacaoDoRequisito | AvaliacaoDoUmDestes> {
  return ehUmDestes(peca) ? pecaDoUmDestes(peca, ctx, pedido) : pecaDoRequisito(peca, ctx, pedido)
}

function semRepetir(textos: readonly string[]): string[] {
  return [...new Set(textos)]
}

/** O motivo do cinza: as frases curtas (`motivoDaFalta`) e depois os motivos fixos. App mais novo manda sozinho. */
function motivoDoCinza(pecas: readonly PecaJulgada<unknown>[]): string | null {
  const comuns = pecas.flatMap((peca) => (peca.falta !== null && peca.especial === null ? [peca.falta] : []))
  const especiais = semRepetir(pecas.flatMap((peca) => (peca.falta !== null && peca.especial !== null ? [peca.especial] : [])))
  const base = motivoDaFalta(comuns)
  if (base === MOTIVO_DE_APP_NOVO) return base
  const partes = base === null ? especiais : [base, ...especiais]
  return partes.length === 0 ? null : partes.join('; ')
}

/** Nada pedido: cumpre. */
export const SEM_REQUISITOS: AvaliacaoDosRequisitos = {
  veredito: 'cumpre',
  itens: [],
  motivo: null,
  faltas: [],
  gastos: [],
  perguntas: [],
  perguntasNaHora: [],
  naoSei: false,
  notas: [],
  declarados: [],
  perdeAAcao: false,
}

/**
 * Julga o grupo "Todos estes" contra o retrato da batalha e o que já foi respondido. Sem grupo
 * (ou vazio) = cumpre.
 */
export function avaliarRequisitos(grupo: GrupoDeRequisitos | undefined, ctx: ContextoDosRequisitos, pedido: RespostasDosRequisitos = {}): AvaliacaoDosRequisitos {
  if (grupo === undefined || grupo.todos.length === 0) return SEM_REQUISITOS
  const pecas = grupo.todos.map((peca) => julgarPeca(peca, ctx, pedido))
  const estados = new Set(pecas.map((peca) => peca.item.estado))
  const veredito: Veredito = estados.has('falta') ? 'falta' : estados.has('pergunta') ? 'pergunta' : 'cumpre'
  const perguntas = veredito === 'pergunta' ? pecas.flatMap((peca) => peca.perguntas).sort((a, b) => ORDEM_DAS_PERGUNTAS[a.tipo] - ORDEM_DAS_PERGUNTAS[b.tipo]) : []
  return {
    veredito,
    itens: pecas.map((peca) => peca.item),
    motivo: veredito === 'falta' ? motivoDoCinza(pecas) : null,
    faltas: pecas.flatMap((peca) => (peca.falta === null ? [] : [peca.falta])),
    gastos: pecas.flatMap((peca) => peca.gastos),
    perguntas,
    perguntasNaHora: pecas.flatMap((peca) => peca.perguntasNaHora),
    naoSei: estados.has('naoSei'),
    notas: semRepetir(pecas.flatMap((peca) => (peca.item.estado === 'naoSei' && peca.nota !== null ? [peca.nota] : []))),
    declarados: pecas.flatMap((peca) => peca.declarados),
    perdeAAcao: pecas.some((peca) => peca.perdeAAcao),
  }
}

/** O bloco inteiro de um app mais novo (`lerRequisitos` devolveu `bloco: null` com `deAppNovo`): cinza, o mestre pode forçar. */
export const DE_APP_NOVO: AvaliacaoDosRequisitos = { ...SEM_REQUISITOS, veredito: 'falta', motivo: MOTIVO_DE_APP_NOVO }

/**
 * O bloco lido de um cartão, para usar (técnica, arma, item; a forma, para ligar) ou para evoluir.
 * `null` = o cartão não tem esse grupo: segue como hoje (a evolução sem bloco não muda nada).
 */
export function avaliarDoCartao(lidos: Pick<RequisitosLidos, 'bloco' | 'deAppNovo'>, para: 'usar' | 'evoluir', ctx: ContextoDosRequisitos, pedido: RespostasDosRequisitos = {}): AvaliacaoDosRequisitos | null {
  if (lidos.bloco === null) return lidos.deAppNovo ? DE_APP_NOVO : null
  const grupo = grupoDoBloco(lidos.bloco, para)
  return grupo === undefined ? null : avaliarRequisitos(grupo, ctx, pedido)
}

function grupoDoBloco(bloco: RequisitosDoCartao, para: 'usar' | 'evoluir'): GrupoDeRequisitos | undefined {
  return para === 'usar' ? bloco.usar : bloco.evoluir?.grupo
}
