import { acaoDoGolpe, motivoDoAtacar, motivoDaTecnica, tecnicasNoMenu, type AcoesDaVez, type TecnicaNoMenu } from '../../lib/batalha/acoes'
import {
  CARGA_MAX,
  MULTIPLICADOR_DA_CARGA,
  MODIFICADOR_DA_REACAO_MAX,
  MULTIPLICADOR_DA_SURPRESA,
  PERFURACAO_MAX,
  PERFURACAO_MIN,
  type AcaoDaTecnica,
  type BonusDaBatalha,
  type CombateDoPersonagem,
  type EfeitoDaBatalha,
  type RolagemDaReacao,
  type SaidaDaReacao,
  type SeloDoGolpe,
} from '../../lib/batalha/combate'
import { alvosDeMod, seloDaTecnica, type AlvoDeMod } from '../../lib/batalha/selos'
import { basesDaEvolucao, efeitoNaBatalha, evolucaoDe, evoluiuNaBatalha, preenchimentoDaVariante, usoEvoluido, variantesDe } from '../../lib/batalha/escolhaEEvolucao'
import { CAMPO_DO_DANO, danoDoAtaque, formulaUsaBala, lerDano, type LeituraDoDano } from '../../lib/batalha/formula'
import { lerMarca } from '../../lib/batalha/marca'
import { chavesDoDono, golpesSaoOverload, limpezaDe, mecanicaDoCartao, perguntaAArma, perguntasComAsFormas, perguntasDoGolpe, respostasPadrao, seloDaMecanica, semSeloPelaResposta, type AreaAMao } from '../../lib/batalha/mecanicasAMao'
import { cartaoMontado, formulaDoDanoDasPecas, pecasDoCartao } from '../../lib/batalha/mecanica/leitura'
import { casaNaAreaVirada, type Casa } from '../../lib/batalha/area'
import { danoDaTecnica } from '../../lib/batalha/leituraDaTecnica'
import { subidaDeParte } from '../../lib/batalha/transformacao'
import type { PerguntaNaHora } from '../../lib/batalha/perguntaNaHora'
import { alvoPadraoEmSi, reacaoDoTipo, rotuloDoTipo, seloSugeridoDaTecnica, type ReacaoDoTipo } from '../../lib/batalha/tiposDaHabilidade'
import {
  CAMPO_DA_ACAO,
  CAMPO_DO_EFEITO,
  CATEGORIAS_DE_ARMA,
  armasDe,
  lerAcao,
  perfuracaoDe,
  tecnicasDe,
  type ArmaDaFicha,
  type BalaDaArma,
  type LeituraDoCusto,
  type LeituraDoTempo,
  vezesDeRecarga,
} from '../../lib/batalha/leituraDaFicha'
import { danoFinal, danoQueChega, saidasDaRolagem } from '../../lib/batalha/reacao'
import { blocosEntreTokens, ordenarAlvosDaMira } from '../../lib/batalha/ordemDosAlvos'
import type { CombateParaJogador } from '../../lib/batalha/vistaDoJogador'
import type { CartaoDaFicha, Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'

/**
 * O ADAPTADOR DO MENU DA VEZ (F2 da batalha One Piece, seção 5.2 do plano):
 * personagem, combate e sistema viram as props que as telas de golpe e de
 * reação desenham. Puro, nos dois lados (mestre e jogador): toda regra mora em
 * `lib/batalha` (`tecnicasNoMenu`, `danoDoAtaque`, `danoQueChega`,
 * `saidasPossiveis`); aqui só se junta o texto.
 */

/** O dano como a tira e a mira o mostram. `valor` null = a ficha não dá um número (a pessoa digita). */
export interface DanoNaTela {
  valor: number | null
  /** "160 Força + 5 Balmung = 165", ou o porquê de não ter número. */
  conta: string
  /** Golpe de suporte ("-"): nenhum dano a digitar. */
  semDano: boolean
  /** F2 (fatia D, Explosão): o dano sai da vida de cada alvo e o app calcula ao lançar; nada a digitar. */
  pelaVida?: true
}

/** Um golpe que o menu oferece: uma arma (Atacar) ou uma técnica (Habilidades). */
export interface GolpeNaTela {
  /** Chave estável na lista: "arma:<id>", "tecnica:<id>" ou "ataque" (sem arma). */
  chave: string
  /** F2 (fatia C): a técnica sai sem alvo (Armadilhar posiciona a armadilha); a mira não pede ninguém. */
  semAlvo?: true
  /** F2 (fatia F, Giro de Pá): a área da técnica; a mira já abre com quem está nela marcado (quem usa pode mudar). */
  area?: AreaAMao
  /** F2 (fatia F, Lua Incandescente): o dano se divide entre os marcados, até este teto de alvos. */
  divide?: number
  /** F2 (fatia F, Golpe Baixo): o que a mira lembra (o mestre confere). */
  lembrete?: string
  /** Construtor C1: os multiplicadores extras da técnica montada (furtivo ×3), na ordem; a prévia os mostra na conta. */
  multiplicadores?: readonly { nome: string; vezes: number }[]
  /** Construtor C1: a técnica montada não multiplica a Surpresa (o ×1,5). */
  semSurpresa?: true
  /** F2 (fatia F, Siegfried): as armas levadas, cada uma com o dano da técnica com ela; a mira pergunta qual (a 1ª vem marcada). Ausente = sem escolha. */
  armas?: readonly { id: string; nome: string; dano: DanoNaTela }[]
  tipo: 'atacar' | 'habilidade'
  /** Só na habilidade. */
  cartaoId: string | null
  /** A arma do Atacar; na habilidade, a arma que entra na conta ("Dano da arma"). */
  armaId: string | null
  nome: string
  descricao: string
  /** A transformação ligada de onde a técnica vem. */
  forma?: string
  /** "45 SP", "? SP", "15 SP por turno"; `null` = não custa. */
  custoTexto: string | null
  custo: LeituraDoCusto
  /** A da ficha; `null` = a ficha não diz (a mira pergunta). */
  acao: AcaoDaTecnica | 'passiva' | null
  acaoTexto: string
  /** "Recarga 1", "1/2 usos", "Overload"; `null` = livre. */
  tempoTexto: string | null
  dano: DanoNaTela
  overload: boolean
  /** Q4: o valor inicial do interruptor Perfurante. */
  perfurante: boolean
  /** Quanto perfura, de 1 a 100, quando a habilidade diz ("perfura 50%"); `null` = não diz (a mira começa em 100). */
  perfuracao: number | null
  /** Presente = apagado, com a frase. */
  motivo: string | null
  /** O texto inteiro da ficha, para ler antes de usar (a caixa de leitura da lista). */
  leitura: readonly LinhaDaLeitura[]
  /**
   * F3: o selo que o texto sugere ("Atordoa por 1 turno"); a mira o traz
   * marcado. Ausente = nenhum. Tipos de habilidade F2: Buff e Debuff sempre
   * trazem um, com os mods lidos do Efeito e a natureza (a cor).
   */
  selo?: SeloDoGolpe
  /** Tipos de habilidade F2: as opções das linhas "atributo / delta" do selo (só Buff e Debuff); ausente = o selo sem mods. */
  alvosDeMod?: readonly AlvoDeMod[]
  /** Tipos de habilidade F2: se o alvo reage (Buff "nunca", Debuff "sempre"); ausente = como sempre (reage se há dano). */
  reacao?: ReacaoDoTipo
  /** Tipos de habilidade F2: Buff, a mira começa em quem usa (aliados também marcáveis). */
  alvoEmSi?: boolean
  /** Tipos de habilidade F2: o bônus dos selos de quem age que entrou na conta (`bonusDaBatalha`); ausente = nenhum. */
  bonus?: BonusDaBatalha
  /** Atacar com arma: a categoria da ficha ("De fogo"); ausente = a ficha não diz. */
  categoria?: string
  /** Atacar com arma: a capacidade da ficha ("6"), só mostra; ausente = a ficha não diz. */
  capacidade?: string
  /**
   * Os tipos de bala, cada um com o dano já feito; ausente = sem escolha. No
   * Atacar, os da arma de fogo ou híbrida; na habilidade cuja fórmula diz
   * "Dano da Bala", os da arma que entra na conta.
   */
  balas?: readonly BalaNaTela[]
  /** Só na habilidade: o Tipo ("Reação"), o selo pequeno da tira. */
  tipoTexto?: string
  /** Só na habilidade: o Tipo veio da Ação, não do campo Tipo (o selo diz "pela Ação"). */
  tipoInferido?: boolean
  /** Tipos de habilidade F4: a marca e o estado da evolução nesta batalha; ausente = a técnica não evolui nem é evoluída. */
  evolucao?: EvolucaoNaTela
  /** Tipos de habilidade F4: as opções "um ou outro" (a principal primeiro), os chips da mira; ausente = sem escolha. */
  opcoes?: readonly OpcaoNaTela[]
  /**
   * F2 (fatia B): as perguntas na hora da mecânica à mão ("Acertou ponto
   * vital?", "Quantos quadrados empurrou?"); a resposta vai no pedido
   * (`respostas`). Ausente = a técnica não pergunta.
   */
  perguntas?: readonly PerguntaNaHora[]
  /** F2 (fatia B): o que cada resposta muda, com o dano já feito (a última que casa vence). */
  respostasMudam?: readonly RespostaNaTela[]
  /** Invocação F3: a técnica de Tipo Invocação. Abre a mira da invocação (não lança golpe); o `motivo` é o do Invocar. */
  invocacao?: boolean
}

/**
 * Tipos de habilidade F4: a evolução como a tira e o detalhe a mostram.
 * "Evolui" = a base que ainda pode evoluir; "Evoluída" = a versão evoluída
 * (o "Evolui para" de outra) ou a base evoluída sem link; "Evoluiu" = a base
 * com link que já evoluiu (apagada: "Evoluiu: use Y").
 */
export interface EvolucaoNaTela {
  marca: 'Evolui' | 'Evoluída' | 'Evoluiu'
  /** A base ainda não evoluiu nesta batalha: o detalhe dá o botão Evoluir. */
  podeEvoluir: boolean
  /** O nome da técnica do "Evolui para", achada na ficha; `null` = sem link. */
  para: string | null
  /** O nome escrito em "Evolui para" que não acha técnica nenhuma; `null` = achou, ou não escreveu. */
  paraNaoAchada: string | null
  /** Sem link, o texto da Evolution diz OVERLOAD: o uso evoluído é Overload. */
  overload: boolean
  /** "Condições do Evolution" ('' = não tem). O app só mostra. */
  condicoes: string
  /** O título da marca: o que ela quer dizer nesta batalha. */
  dica: string
}

/**
 * Tipos de habilidade F4: uma opção da habilidade na mira (`variantesDe`), com
 * o que ela já preenche (`preenchimentoDaVariante`); tudo segue editável.
 */
export interface OpcaoNaTela {
  /** O que vai no pedido (`variante`). */
  chave: string
  /** O chip: "Efeito principal", "Cirugia". */
  rotulo: string
  texto: string
  principal: boolean
  /** O dano lido do texto da opção; `null` = o do campo Dano (o da técnica). */
  dano: DanoNaTela | null
  /** O selo que o texto da opção traz; `null` = o da técnica. */
  selo: SeloDoGolpe | null
}

/** Um tipo de bala na mira: o texto da ficha e o dano do ataque com ela. */
export interface BalaNaTela {
  id: string
  nome: string
  /** Como a ficha diz: "+15" soma ao dano da arma, "40" troca; vazio = o da arma. */
  danoTexto: string
  efeito: string
  /** Texto livre, só mostra: o app não conta tiros. */
  quantidade: string
  /** O dano do Atacar com esta bala ("160 Força + 20 Rosa + 15 Prata = 195"). */
  dano: DanoNaTela
}

/** Uma linha da leitura inteira: o rótulo do campo e o texto como a ficha diz. */
export interface LinhaDaLeitura {
  rotulo: string
  texto: string
  /** O campo da ficha de onde veio ("custo", "tempo"...); ausente nos extras. */
  campo?: string
}

/** A leitura começa por estes campos (descrição, efeito, dano, ação, custo, tempo); os outros da aba seguem a ordem dela. */
const ORDEM_DA_LEITURA = ['descricao', 'efeito', 'dano', 'acao', 'custo', 'tempo'] as const
const ROTULO_DA_LEITURA: Record<(typeof ORDEM_DA_LEITURA)[number], string> = {
  descricao: 'Descrição',
  efeito: 'Efeito',
  dano: 'Dano',
  acao: 'Ação',
  custo: 'Custo',
  tempo: 'Tempo',
}

/**
 * O cartão inteiro em linhas de leitura: cada campo da aba com texto, o dano
 * com a fórmula da ficha e a conta já feita ("Conta: 160 Força + 5 Balmung =
 * 165"), e os extras (Overload, Requisito, Alcance...) pelo nome que a ficha
 * deu. Campo vazio não entra.
 */
export function leituraDoCartao(cartao: CartaoDaFicha | null, sistema: SistemaDeRpg | null, abaId: string, dano: DanoNaTela): LinhaDaLeitura[] {
  const campos = sistema?.abas.find((aba) => aba.id === abaId)?.campos ?? []
  const rotuloDe = new Map<string, string>(Object.entries(ROTULO_DA_LEITURA))
  for (const campo of campos) rotuloDe.set(campo.id, campo.rotulo.trim() || rotuloDe.get(campo.id) || campo.id)
  const primeiros: readonly string[] = ORDEM_DA_LEITURA
  const ids = [...primeiros, ...campos.map((campo) => campo.id).filter((id) => !primeiros.includes(id))]
  const linhas: LinhaDaLeitura[] = []
  for (const id of ids) {
    const texto = (cartao?.campos[id] ?? '').trim()
    const rotulo = rotuloDe.get(id) ?? id
    if (id === 'dano') {
      if (texto !== '') linhas.push({ rotulo, texto, campo: id })
      // A conta só quando diz algo além da fórmula (a fórmula "-" já é "sem dano").
      if (!dano.semDano && dano.conta !== texto) linhas.push({ rotulo: texto === '' ? rotulo : 'Conta', texto: dano.conta, campo: id })
      continue
    }
    if (texto !== '') linhas.push({ rotulo, texto, campo: id })
  }
  for (const extra of cartao?.extras ?? []) {
    const nome = extra.nome.trim()
    const valor = extra.valor.trim()
    if (nome === '' && valor === '') continue
    linhas.push(valor === '' || nome === '' ? { rotulo: 'Extra', texto: valor || nome } : { rotulo: nome, texto: valor })
  }
  return linhas
}

/** Uma ficha que pode ser alvo, como a mira a lista. */
export interface AlvoNaMira {
  tokenId: string
  nome: string
  /** 'eu' = do jogador que olha (ou do NPC da vez, no mestre). */
  lado: 'eu' | 'aliado' | 'outro'
  caiu: boolean
  /** Presente = não pode ser alvo (ficha sem personagem), com a frase. */
  motivo?: string | null
  /** A miniatura: a imagem da forma, a foto do token ou o retrato (referência ou embutida, como na faixa); ausente = as iniciais. */
  imagem?: string | null
  /** A cor da equipe, no anel da miniatura; ausente = o anel neutro. */
  cor?: string | null
  /** F2 (fatia F): a casa do alvo em relação a quem age (colunas e linhas); ausente = sem posição ou sem o tamanho da casa. */
  deslocamento?: Casa
}

/** A ficha sem personagem não é alvo (a store recusa): fica na lista, apagada. */
export const MOTIVO_SEM_PERSONAGEM = 'sem ficha ligada'

/** Uma ficha do mapa como a ordem da mira a lê: a posição (px do mundo); sem posição, vai para o fim do lado dela. */
export interface FichaComPosicao {
  id: string
  x?: number
  y?: number
}

/**
 * C4 (lote de 01/11): os alvos na ordem da mira, do ponto de vista de `deTokenId`:
 * inimigos do mais perto ao mais longe, os aliados depois, quem age por último
 * (`ordenarAlvosDaMira`). `tamanhoDaCasa` ausente (a Arena) = a conta em px, que
 * dá a mesma ordem fora do empate dentro da casa.
 */
export function alvosNaOrdemDaMira<T extends AlvoNaMira>(alvos: readonly T[], fichas: readonly FichaComPosicao[], deTokenId: string, tamanhoDaCasa?: number): T[] {
  const porId = new Map(fichas.map((ficha) => [ficha.id, ficha] as const))
  const ponto = (tokenId: string) => {
    const ficha = porId.get(tokenId)
    return ficha === undefined || ficha.x === undefined || ficha.y === undefined ? undefined : { x: ficha.x, y: ficha.y }
  }
  const temCasa = tamanhoDaCasa !== undefined && Number.isFinite(tamanhoDaCasa) && tamanhoDaCasa > 0
  const casa = temCasa ? tamanhoDaCasa : 1
  const origem = ponto(deTokenId)
  const ordenados = ordenarAlvosDaMira(alvos, (tokenId) => blocosEntreTokens(origem, ponto(tokenId), casa))
  if (!temCasa || origem === undefined) return ordenados
  // F2 (fatia F, Giro de Pá): a casa de cada alvo em relação a quem age, para a mira marcar quem está na área.
  const casaDe = (p: { x: number; y: number }): Casa => ({ col: Math.floor(p.x / casa), row: Math.floor(p.y / casa) })
  const daOrigem = casaDe(origem)
  return ordenados.map((alvo) => {
    const p = ponto(alvo.tokenId)
    if (p === undefined) return alvo
    const dele = casaDe(p)
    return { ...alvo, deslocamento: { col: dele.col - daOrigem.col, row: dele.row - daOrigem.row } }
  })
}

const ROTULO_DA_ACAO: Record<AcaoDaTecnica | 'passiva', string> = {
  simples: 'Simples',
  completa: 'Completa',
  bonus: 'Bônus',
  livre: 'Livre',
  passiva: 'Passiva',
}

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

export function formatarNumero(valor: number): string {
  return numero.format(valor)
}

export function textoDaAcao(acao: AcaoDaTecnica | 'passiva' | null): string {
  return acao === null ? 'Ação ?' : ROTULO_DA_ACAO[acao]
}

/** "45 SP", "? SP", "15 SP por turno"; `null` = não custa. */
export function textoDoCusto(custo: LeituraDoCusto): string | null {
  switch (custo.tipo) {
    case 'nada':
      return null
    case 'valor':
      return `${formatarNumero(custo.valor)} ${custo.recurso.toUpperCase()}${custo.porTurno ? ' por turno' : ''}`
    case 'pergunta':
      return `? ${custo.recurso.toUpperCase()}`
  }
}

/** "Recarga 1" (o que falta, se está recarregando), "1/2 usos", "Overload"; `null` = livre. */
export function textoDoTempo(tempo: LeituraDoTempo, combate: CombateDoPersonagem | undefined, cartaoId: string): string | null {
  switch (tempo.tipo) {
    case 'livre':
      return null
    case 'recarga': {
      // P1: a recarga guarda o "+1" da vez do uso; a tela mostra as vezes que ainda ficam bloqueadas.
      const falta = vezesDeRecarga(combate?.recargas[cartaoId] ?? 0, tempo)
      return falta > 0 ? `Recarga ${falta}/${tempo.turnos}` : `Recarga ${tempo.turnos}`
    }
    case 'usos':
      return `${combate?.usos[cartaoId] ?? 0}/${tempo.vezes} usos`
    case 'overload':
      return 'Overload'
    case 'texto':
      return tempo.texto.trim() || null
  }
}

/** F2 (fatia B): uma mudança por resposta, como a mira a usa: o dano já lido e o selo; `null` = a resposta não muda aquilo. */
export interface RespostaNaTela {
  chave: string
  valor: string | number
  dano: DanoNaTela | null
  selo: SeloDoGolpe | null
}

/** A leitura do dano em texto de tela. */
export function danoNaTela(leitura: LeituraDoDano): DanoNaTela {
  switch (leitura.tipo) {
    case 'semDano':
      return { valor: null, conta: 'Sem dano', semDano: true }
    case 'valor':
      return { valor: leitura.valor, conta: leitura.conta, semDano: false }
    case 'precisaArma':
      return { valor: null, conta: `Precisa de uma arma: ${leitura.conta}`, semDano: false }
    case 'precisaAlvo':
      return { valor: null, conta: 'Depende da vida do alvo: o app calcula ao lançar', semDano: false, pelaVida: true }
    case 'naoEntende':
      return { valor: null, conta: leitura.texto.trim() === '' ? 'A ficha não diz: digite o dano' : `"${leitura.texto.trim()}": digite o dano`, semDano: false }
  }
}

/** A aba das técnicas (a das transformações também guarda técnicas desta aba). */
const ABA_DAS_TECNICAS = 'habilidades'
const ABA_DAS_ARMAS = 'armas'

/**
 * As balas da técnica cuja fórmula diz "Dano da Bala" (tipos de habilidade
 * F1): uma por tipo de bala da arma que entra na conta, com o dano da técnica
 * já feito com ela. Sem arma, arma sem balas ou fórmula sem bala: nenhuma.
 * Construtor C1 (revisão): no cartão montado, a fórmula e a prévia são as da
 * peça (o campo Dano é só descrição), a mesma conta que o host confere.
 */
function balasDaTecnica(cartao: CartaoDaFicha, personagem: Personagem, sistema: SistemaDeRpg, arma: ArmaDaFicha | null, bonus: BonusDaBatalha | undefined): BalaNaTela[] {
  const formula = formulaDoDanoDasPecas(cartao) ?? cartao.campos[CAMPO_DO_DANO] ?? ''
  if (arma === null || arma.balas.length === 0 || !formulaUsaBala(formula)) return []
  const montado = cartaoMontado(cartao)
  return arma.balas.map((bala) => ({
    id: bala.id,
    nome: bala.nome,
    danoTexto: bala.dano,
    efeito: bala.efeito,
    quantidade: bala.quantidade,
    dano: danoNaTela(montado ? danoDaTecnica(cartao, { personagem, sistema, arma, bala, bonusDaBatalha: bonus }) : lerDano(formula, { personagem, sistema, arma, vidaDoAlvo: null, bala, bonusDaBatalha: bonus })),
  }))
}

/** O bônus que vai junto do golpe (para pintar a conta): só quando algum selo soma. */
function comBonus(bonus: BonusDaBatalha | undefined): { bonus?: BonusDaBatalha } {
  return bonus === undefined || Object.keys(bonus).length === 0 ? {} : { bonus }
}

/**
 * Tipos de habilidade F4: a evolução da técnica nesta batalha (`todas` = as
 * técnicas que valem agora). Base que evolui: "Evolui" até Evoluir; depois,
 * "Evoluída" (sem link: o efeito vira o da Evolution) ou "Evoluiu" (com link:
 * apagada, use a outra). A técnica do "Evolui para" de outra: "Evoluída"
 * (apagada até a base evoluir: o motivo vem de `motivoDaTecnica`).
 */
function evolucaoNaTela(cartao: CartaoDaFicha, todas: readonly CartaoDaFicha[], evoluidas: readonly string[] | undefined, overloadUsado = false): EvolucaoNaTela | undefined {
  const evolucao = evolucaoDe(cartao, todas)
  if (evolucao === null) {
    const [base] = basesDaEvolucao(cartao, todas)
    if (base === undefined) return undefined
    const nomeDaBase = base.nome.trim() || 'a base'
    return { marca: 'Evoluída', podeEvoluir: false, para: null, paraNaoAchada: null, overload: false, condicoes: '', dica: `A versão evoluída de ${nomeDaBase}: libera quando ${nomeDaBase} evoluir nesta batalha` }
  }
  const evoluiu = evoluiuNaBatalha(evoluidas, cartao.id)
  const para = evolucao.para === null ? null : evolucao.para.nome.trim() || 'a evoluída'
  const paraNaoAchada = evolucao.para === null && evolucao.paraEscrito !== '' ? evolucao.paraEscrito : null
  const base = { podeEvoluir: !evoluiu, para, paraNaoAchada, overload: evolucao.para === null && evolucao.overload, condicoes: evolucao.condicoes }
  if (!evoluiu) {
    const vira = para !== null ? `vira ${para}` : evolucao.overload ? 'o efeito vira o da Evolução, como Overload' : 'o efeito vira o da Evolução'
    return { ...base, marca: 'Evolui', dica: `Evolui nesta batalha: ${vira}` }
  }
  // F2b (revisão da fatia F, CAÇA AS BRUXAS!): depois da evoluída usada (Overload, 1 por batalha) a base volta; a dica não manda mais para ela.
  if (para !== null && overloadUsado && mecanicaDoCartao(cartao.id)?.voltaDepoisDoOverload === true) return { ...base, marca: 'Evoluiu', dica: `${para} já foi usada (Overload, 1 por batalha): esta técnica volta, sem evoluir de novo` }
  if (para !== null) return { ...base, marca: 'Evoluiu', dica: `Evoluiu nesta batalha: use ${para}` }
  return { ...base, marca: 'Evoluída', dica: base.overload ? 'Evoluída nesta batalha: vale o efeito da Evolução, como Overload' : 'Evoluída nesta batalha: vale o efeito da Evolução' }
}

/** Tipos de habilidade F4: as opções da técnica com o pré-preenchimento de cada uma; uma só (sem escolha) = `undefined`. */
function opcoesNaTela(cartao: CartaoDaFicha, personagem: Personagem, sistema: SistemaDeRpg, arma: ArmaDaFicha | null, bonus: BonusDaBatalha | undefined): OpcaoNaTela[] | undefined {
  const variantes = variantesDe(cartao)
  if (variantes.length < 2) return undefined
  const ctx = { personagem, sistema, arma, vidaDoAlvo: null, bonusDaBatalha: bonus }
  return variantes.map((variante) => {
    // A principal é a técnica como sempre: o dano e o selo do golpe.
    const lido = variante.principal ? { dano: null, selo: null } : preenchimentoDaVariante(cartao, variante, ctx)
    return { chave: variante.chave, rotulo: variante.rotulo, texto: variante.texto, principal: variante.principal, dano: lido.dano === null ? null : danoNaTela(lido.dano), selo: lido.selo }
  })
}

/** Tipos de habilidade F4: a base evoluída sem link lê o efeito da Evolution no lugar do Efeito (e diz que é o evoluído). */
function leituraEvoluida(leitura: LinhaDaLeitura[], efeito: string): LinhaDaLeitura[] {
  const linha: LinhaDaLeitura = { rotulo: 'Efeito evoluído', texto: efeito, campo: CAMPO_DO_EFEITO }
  const indice = leitura.findIndex((candidata) => candidata.campo === CAMPO_DO_EFEITO)
  if (indice < 0) return [linha, ...leitura]
  return leitura.map((candidata, i) => (i === indice ? linha : candidata))
}

function golpeDaTecnica(
  tecnica: TecnicaNoMenu,
  personagem: Personagem,
  sistema: SistemaDeRpg,
  combate: CombateDoPersonagem | undefined,
  arma: ArmaDaFicha | null,
  bonus: BonusDaBatalha | undefined,
  todas: readonly CartaoDaFicha[],
  acoes: AcoesDaVez | null,
): GolpeNaTela {
  const dano = danoNaTela(tecnica.dano)
  const balas = balasDaTecnica(tecnica.cartao, personagem, sistema, arma, bonus)
  const tipo = tecnica.tipo.tipo
  const golpe: GolpeNaTela = {
    ...(balas.length === 0 ? {} : { balas }),
    ...comBonus(bonus),
    reacao: reacaoDoTipo(tipo),
    alvoEmSi: alvoPadraoEmSi(tipo),
    tipoTexto: rotuloDoTipo(tecnica.tipo.tipo),
    tipoInferido: tecnica.tipo.inferido,
    chave: `tecnica:${tecnica.cartao.id}`,
    tipo: 'habilidade',
    cartaoId: tecnica.cartao.id,
    armaId: arma?.id ?? null,
    nome: tecnica.cartao.nome.trim() || 'Habilidade sem nome',
    descricao: (tecnica.cartao.campos.descricao ?? tecnica.cartao.campos.efeito ?? '').trim(),
    custoTexto: textoDoCusto(tecnica.custo),
    custo: tecnica.custo,
    acao: tecnica.acao,
    acaoTexto: textoDaAcao(tecnica.acao),
    tempoTexto: textoDoTempo(tecnica.tempo, combate, tecnica.cartao.id),
    dano,
    // F2b (A Caçada Começa): com a forma ligada, todo golpe dele é Overload (a mira diz que o alvo não reage).
    overload: tecnica.overload || golpesSaoOverload(personagem.cartoesAtivos),
    perfurante: tecnica.perfurante,
    perfuracao: tecnica.perfuracao ?? null,
    motivo: tecnica.motivo,
    leitura: leituraDoCartao(tecnica.cartao, sistema, ABA_DAS_TECNICAS, dano),
  }
  if (tecnica.forma !== undefined) golpe.forma = tecnica.forma
  // Invocação F3: a regra do Invocar (`motivoDaInvocacao`): a técnica como toda técnica, sem a carga virar Completa.
  if (tipo === 'invocacao') {
    golpe.invocacao = true
    const { transformacao } = lerAcao(tecnica.cartao.campos[CAMPO_DA_ACAO] ?? '')
    golpe.motivo = motivoDaTecnica({ ...tecnica, transformacao }, personagem, sistema, combate === undefined ? undefined : { ...combate, carga: 0 }, acoes, false, true)
  }
  // Tipos de habilidade F2: Buff e Debuff trazem o selo com mods (editável na mira); o resto, o "por N turnos" de sempre.
  // A técnica que marca ao acertar (Desenhar o Alvo, Tipo Debuff) já põe a marca: o selo do Tipo deixaria o alvo marcado duas vezes.
  // F2 (fatia B): o selo da mecânica à mão (Aéreo, Paralisado 2, o Atordoado da disputa) vence a leitura do texto;
  // a técnica que só põe selo por resposta (Grande Chifre: bateu na parede) começa sem.
  const id = tecnica.cartao.id
  // Construtor C1: a mecânica é procurada pelo cartão (o montado dá a linha das peças; o de texto cai na tabela pelo id).
  const { cartao } = tecnica
  const padrao = respostasPadrao(cartao)
  // Tudo ou nada: a técnica montada sem selo na peça não sugere o selo lido do texto.
  const semSelo = lerMarca(cartao, sistema)?.tipo === 'aoAcertar' || semSeloPelaResposta(cartao, padrao) || cartaoMontado(cartao)
  const selo = seloDaMecanica(cartao, padrao) ?? (semSelo ? null : seloSugeridoDaTecnica(cartao, sistema))
  if (selo !== null) golpe.selo = selo
  const mecanica = mecanicaDoCartao(cartao)
  if (mecanica?.semAlvo === true) golpe.semAlvo = true
  // F2 (fatia F): a área (Giro de Pá), o dano dividido (Lua Incandescente) e o lembrete da mira (Golpe Baixo).
  if (mecanica?.area !== undefined) golpe.area = mecanica.area
  if (mecanica?.divide !== undefined) golpe.divide = mecanica.divide.teto
  if (mecanica?.lembreteNaMira !== undefined) golpe.lembrete = mecanica.lembreteNaMira
  // Construtor C1: os multiplicadores da peça entram na prévia (o host recalcula de qualquer jeito).
  const multiplicadores = pecasDoCartao(cartao)?.dano?.multiplicadores
  if (multiplicadores?.extra !== undefined && multiplicadores.extra.length > 0) golpe.multiplicadores = multiplicadores.extra
  if (multiplicadores?.surpresa === false) golpe.semSurpresa = true
  // F2 (fatia F, Siegfried): qual arma, quando o dano muda com ela (a técnica com "Dano da Arma").
  const armas = perguntaAArma(idsDosCartoes(personagem)) ? armasDaTecnica(tecnica.cartao, personagem, sistema, combate, bonus) : null
  if (armas !== null) golpe.armas = armas
  // F2 (fatia E, Fúria do Dragão): sem Parte acima, apagada com o motivo (a mesma frase do host).
  const subida = subidaDeParte(personagem, sistema, id)
  if (golpe.motivo === null && subida !== null && 'motivo' in subida) golpe.motivo = subida.motivo
  // F2 (fatia D, Revigorar): a técnica que limpa começa em quem usa (vale nele ou num aliado).
  if (limpezaDe(cartao) !== null) golpe.alvoEmSi = true
  // F2 (fatia C): mais as perguntas de todo golpe do dono (o Electro da Aira).
  // F2 (fatia D, Imbuir Fogo): a opção que a forma ligada não deixa some (a Ignição ligada deixa só "Não" no fogo).
  const perguntas = perguntasComAsFormas(perguntasDoGolpe(id, idsDosCartoes(personagem)), id, personagem.cartoesAtivos)
  if (perguntas.length > 0) {
    golpe.perguntas = perguntas
    const ctxDaFormula = { personagem, sistema, arma, vidaDoAlvo: null, bonusDaBatalha: bonus }
    golpe.respostasMudam = (mecanicaDoCartao(id)?.respostasMudam ?? []).map((regra) => ({
      chave: regra.chave,
      valor: regra.valor,
      dano: regra.dano === undefined ? null : danoNaTela(lerDano(regra.dano, ctxDaFormula)),
      selo: regra.selo ?? null,
    }))
  }
  // Tipos de habilidade F4: a evolução nesta batalha e as opções "um ou outro".
  const evolucao = evolucaoNaTela(tecnica.cartao, todas, combate?.evoluidas, combate?.overload === true)
  if (evolucao !== undefined) golpe.evolucao = evolucao
  if (usoEvoluido(tecnica.cartao, todas, combate?.evoluidas)) {
    const efeito = efeitoNaBatalha(tecnica.cartao, todas, combate?.evoluidas)
    golpe.leitura = leituraEvoluida(golpe.leitura.slice(), efeito)
    // A linha da tira vinha do Efeito (sem Descrição): passa a ser o evoluído, o que vale agora.
    if ((tecnica.cartao.campos.descricao ?? '').trim() === '' && efeito.trim() !== '') golpe.descricao = efeito.trim()
  }
  const opcoes = opcoesNaTela(tecnica.cartao, personagem, sistema, arma, bonus)
  if (opcoes !== undefined) golpe.opcoes = opcoes
  // As linhas "atributo / delta" do selo: Buff e Debuff, ou a opção cujo texto traz mods (senão a mira os perderia).
  const comMods = selo?.natureza === 'buff' || selo?.natureza === 'debuff' || (opcoes ?? []).some((opcao) => (opcao.selo?.mods?.length ?? 0) > 0)
  if (comMods) golpe.alvosDeMod = alvosDeMod(sistema)
  return golpe
}

/**
 * As técnicas (Habilidades + as das transformações ligadas), com o motivo de
 * cada apagada. `acoes` null = fora da vez (contra-ataque). `bonus` (tipos de
 * habilidade F2) = o `bonusDaBatalha` de quem age: entra na conta do dano.
 */
export function golpesDeHabilidade(
  personagem: Personagem,
  sistema: SistemaDeRpg,
  combate: CombateDoPersonagem | undefined,
  acoes: AcoesDaVez | null,
  arma: ArmaDaFicha | null,
  bonus?: BonusDaBatalha,
): GolpeNaTela[] {
  const todas = tecnicasDe(personagem, sistema)
  return tecnicasNoMenu(personagem, sistema, combate, acoes, arma, bonus).map((tecnica) => golpeDaTecnica(tecnica, personagem, sistema, combate, arma, bonus, todas, acoes))
}

/**
 * F2 (fatia F, Siegfried): cada arma levada com o dano da técnica com ela, na
 * ordem das levadas (a 1ª é a padrão até a ficha ter o campo). `null` = uma
 * arma só, ou o dano não muda com a arma (a técnica não usa "Dano da Arma").
 */
function armasDaTecnica(cartao: CartaoDaFicha, personagem: Personagem, sistema: SistemaDeRpg, combate: CombateDoPersonagem | undefined, bonus: BonusDaBatalha | undefined): { id: string; nome: string; dano: DanoNaTela }[] | null {
  const armas = armasNaBatalha(personagem, combate)
  if (armas.length < 2) return null
  const comDano = armas.map((arma) => ({ id: arma.id, nome: arma.nome.trim() || 'Arma sem nome', dano: danoNaTela(danoDaTecnica(cartao, { personagem, sistema, arma, bonusDaBatalha: bonus })) }))
  const valores = new Set(comDano.map((arma) => arma.dano.valor))
  return valores.size < 2 ? null : comDano
}

/**
 * F2 (fatia F, Giro de Pá): quem a área da técnica pega, pela casa de cada
 * alvo em relação a quem usa (`deslocamento`, de `alvosNaOrdemDaMira`). A
 * frente de quem usa não é conhecida aqui: vale qualquer lado
 * (`casaNaAreaVirada`). Alvo sem posição fica de fora (quem usa marca à mão).
 */
export function alvosNaAreaDaMira(area: AreaAMao, alvos: readonly AlvoNaMira[]): string[] {
  const origem: Casa = { col: 0, row: 0 }
  return alvos
    .filter((alvo) => !alvo.motivo && !alvo.caiu && alvo.lado !== 'eu' && (area.quem === 'todos' || alvo.lado === 'outro'))
    .filter((alvo) => alvo.deslocamento !== undefined && casaNaAreaVirada(area.forma, origem, null, alvo.deslocamento))
    .map((alvo) => alvo.tokenId)
}

/** As armas que valem nesta batalha: as levadas (Q8) ou, sem escolha, todas da aba Armas. */
/** F2 (fatia C): os ids dos cartões da ficha (todas as abas), e (fatia E) as chaves da raça e da ficha, para as perguntas de todo golpe do dono. */
function idsDosCartoes(personagem: Personagem): string[] {
  return chavesDoDono(personagem)
}

export function armasNaBatalha(personagem: Personagem | null, combate: Pick<CombateDoPersonagem, 'armas'> | undefined): ArmaDaFicha[] {
  if (personagem === null) return []
  const todas = armasDe(personagem)
  const levadas = combate?.armas
  if (levadas === null || levadas === undefined) return todas
  return todas.filter((arma) => levadas.includes(arma.id))
}

const DESCRICAO_DO_DESARMADO = 'Sem arma: o dano é a Força.'

/** R6: o que sobra do ataque adicional da forma nesta rodada ("+1 ataque"); `null` = fora da vez, nenhuma forma dá, ou já usou. */
function textoDoAtaqueExtra(acoes: AcoesDaVez | null): string | null {
  if (acoes === null || acoes.ataqueExtra === undefined) return null
  const sobram = acoes.ataqueExtra.total - acoes.ataqueExtra.usadas
  return sobram <= 0 ? null : `+${sobram} ${sobram === 1 ? 'ataque' : 'ataques'}`
}

/**
 * O Atacar: uma tira por arma levada; sem arma, o ataque desarmado (Força).
 * Q2: Força + dano da arma, editável. `bonus` (tipos de habilidade F2) = o
 * `bonusDaBatalha` de quem age ("FOR +20" entra na Força da conta).
 */
export function golpesDeAtaque(
  personagem: Personagem | null,
  sistema: SistemaDeRpg | null,
  combate: CombateDoPersonagem | undefined,
  acoes: AcoesDaVez | null,
  bonus?: BonusDaBatalha,
): GolpeNaTela[] {
  const carga = combate?.carga ?? 0
  const danoCom = (arma: ArmaDaFicha | null, bala: BalaDaArma | null): DanoNaTela =>
    personagem === null || sistema === null ? danoNaTela({ tipo: 'naoEntende', texto: '' }) : danoNaTela(danoDoAtaque({ personagem, sistema, arma, vidaDoAlvo: null, bonusDaBatalha: bonus }, bala))
  const perguntasDoAtaque = personagem === null ? [] : perguntasDoGolpe(null, idsDosCartoes(personagem))
  const golpeDe = (arma: ArmaDaFicha | null): GolpeNaTela => {
    const lida = arma === null ? null : lerAcao(arma.campos[CAMPO_DA_ACAO] ?? '').acao
    const acaoDaFicha: AcaoDaTecnica = lida === null || lida === 'passiva' ? 'simples' : lida
    const gasta = acaoDoGolpe(acaoDaFicha, carga) ?? acaoDaFicha
    const dano = danoCom(arma, null)
    const descricao = arma === null ? DESCRICAO_DO_DESARMADO : (arma.campos.descricao ?? arma.campos.efeito ?? '').trim()
    const selo = arma === null ? null : seloDaTecnica(arma)
    const categoria = arma === null || arma.categoria === null ? null : (CATEGORIAS_DE_ARMA.find((candidata) => candidata.id === arma.categoria)?.rotulo ?? null)
    const balas: BalaNaTela[] =
      arma === null
        ? []
        : arma.balas.map((bala) => ({ id: bala.id, nome: bala.nome, danoTexto: bala.dano, efeito: bala.efeito, quantidade: bala.quantidade, dano: danoCom(arma, bala) }))
    return {
      ...(selo === null ? {} : { selo }),
      // F2 (fatia C): as perguntas de todo golpe do dono (o Electro da Aira) também no Atacar.
      ...(perguntasDoAtaque.length === 0 ? {} : { perguntas: perguntasDoAtaque }),
      ...comBonus(bonus),
      ...(categoria === null ? {} : { categoria }),
      ...(arma === null || arma.capacidade === null ? {} : { capacidade: arma.capacidade }),
      ...(balas.length === 0 ? {} : { balas }),
      chave: arma === null ? 'ataque' : `arma:${arma.id}`,
      tipo: 'atacar',
      cartaoId: null,
      armaId: arma?.id ?? null,
      nome: arma === null ? 'Ataque desarmado' : arma.nome.trim() || 'Arma sem nome',
      descricao,
      leitura: arma === null ? [{ rotulo: 'Descrição', texto: DESCRICAO_DO_DESARMADO }, ...leituraDoCartao(null, sistema, ABA_DAS_ARMAS, dano)] : leituraDoCartao(arma, sistema, ABA_DAS_ARMAS, dano),
      custoTexto: null,
      custo: { tipo: 'nada' },
      acao: acaoDaFicha,
      acaoTexto: textoDaAcao(gasta),
      // R6: o ataque adicional da forma ligada (Ignição) aparece como etiqueta do Atacar.
      tempoTexto: textoDoAtaqueExtra(acoes),
      dano,
      // F2b (A Caçada Começa): com a forma ligada, os tiros dele são Overload (a mira diz que o alvo não reage).
      overload: personagem !== null && golpesSaoOverload(personagem.cartoesAtivos),
      perfurante: false,
      // A arma que diz "perfura 50%" já traz o número, para quando ligarem o Perfurante.
      perfuracao: arma === null ? null : perfuracaoDe(arma),
      // R6: a mesma regra do host (`podeAgir`): depois do primeiro Atacar, o adicional da forma cabe sem a Simples.
      motivo: acoes === null ? null : motivoDoAtacar(acoes),
    }
  }
  const armas = armasNaBatalha(personagem, combate)
  return armas.length === 0 ? [golpeDe(null)] : armas.map(golpeDe)
}

/** A arma de um golpe pelo id, entre as da ficha. */
export function armaPorId(personagem: Personagem | null, armaId: string | null): CartaoDaFicha | null {
  if (personagem === null || armaId === null) return null
  return armasDe(personagem).find((arma) => arma.id === armaId) ?? null
}

/** Um pip da cabeça do menu ("Simples 1", riscado quando gasto). */
export interface PipDaVez {
  id: 'simples' | 'bonus' | 'mov'
  texto: string
  gasto: boolean
  /** Mov passou do limite: vermelho, nunca trava (decisão 6). */
  passou?: boolean
}

/** "Simples 1 · Bônus 0 · Mov 2/4": o que sobrou da vez, como no protótipo. */
export function pipsDaVez(acoes: AcoesDaVez): PipDaVez[] {
  const sobra = (contagem: { usadas: number; total: number }) => Math.max(0, contagem.total - contagem.usadas)
  const pips: PipDaVez[] = [{ id: 'simples', texto: `Simples ${sobra(acoes.simples)}`, gasto: sobra(acoes.simples) === 0 }]
  if (acoes.bonus.total > 0) pips.push({ id: 'bonus', texto: `Bônus ${sobra(acoes.bonus)}`, gasto: sobra(acoes.bonus) === 0 })
  const { andados, limite } = acoes.blocos
  pips.push({
    id: 'mov',
    texto: limite === null ? `Mov ${andados}` : `Mov ${andados}/${limite}`,
    gasto: sobra(acoes.movimento) === 0,
    passou: limite !== null && andados > limite,
  })
  return pips
}

/** O mesmo texto dos pips, numa linha, para o leitor de tela e o painel do mestre. */
export function economiaEmTexto(acoes: AcoesDaVez): string {
  return pipsDaVez(acoes)
    .map((pip) => pip.texto)
    .join(' · ')
}

/** O combate do personagem dele como a regra o lê, a partir do recorte (`concentrouNestaVez` vira a chave da vez). */
export function combateDoJogador(meu: CombateParaJogador | undefined, chaveDaVezAgora: string | null): CombateDoPersonagem | undefined {
  if (meu === undefined) return undefined
  const carga = Math.min(CARGA_MAX, Math.max(0, Math.trunc(meu.carga))) as CombateDoPersonagem['carga']
  const combate: CombateDoPersonagem = { recargas: meu.recargas, usos: meu.usos, overload: meu.overload, carga, armas: meu.armas }
  if (meu.concentrouNestaVez && chaveDaVezAgora !== null) combate.concentrouEm = chaveDaVezAgora
  // Tipos de habilidade F4: as evoluídas apagam e liberam técnicas no menu e valem como Overload na caixa REAÇÃO.
  if (meu.evoluidas !== undefined && meu.evoluidas.length > 0) combate.evoluidas = meu.evoluidas
  return combate
}

/** "Carga 2 · próximo golpe ×2"; `null` sem carga. */
export function textoDaCarga(carga: number): string | null {
  if (carga <= 0) return null
  const vezes = MULTIPLICADOR_DA_CARGA[Math.min(CARGA_MAX, carga)] ?? 1
  return `Carga ${carga} · próximo golpe ×${formatarNumero(vezes)}`
}

/** A porcentagem do Perfurante digitada: inteiro de 1 a 100, ou `null` (vazio, 0, mais de 100, texto). */
export function lerPerfuracao(texto: string): number | null {
  const limpo = texto.trim().replace(/\s*%$/, '')
  if (!/^\d{1,3}$/.test(limpo)) return null
  const valor = Number(limpo)
  return valor >= PERFURACAO_MIN && valor <= PERFURACAO_MAX ? valor : null
}

/** O que o Perfurante faz: "direto no HP, sem gastar o Escudo" (100%) ou "30% direto no HP, o resto passa pelo Escudo". */
export function textoDoPerfurante(porcentagem: number): string {
  return porcentagem >= PERFURACAO_MAX ? 'direto no HP, sem gastar o Escudo' : `${porcentagem}% direto no HP, o resto passa pelo Escudo`
}

/**
 * O dano que chega e a conta ao lado: "205 × 2 concentração × 1,5 Surpresa = 615".
 * Construtor C1: `extras` (os multiplicadores da técnica montada) entram depois
 * da Surpresa, na ordem: "100 × 1,5 Surpresa × 3 furtivo = 450".
 */
export function contaDoGolpe(base: number, carga: number, surpresa: boolean, extras?: readonly { nome: string; vezes: number }[]): { valor: number; conta: string } {
  const valor = danoQueChega(base, carga, surpresa, extras === undefined ? undefined : { extras: extras.map((extra) => extra.vezes) })
  const partes = [formatarNumero(base)]
  const vezes = MULTIPLICADOR_DA_CARGA[Math.min(CARGA_MAX, Math.max(0, carga))] ?? 1
  if (vezes !== 1) partes.push(`${formatarNumero(vezes)} concentração`)
  if (surpresa) partes.push(`${formatarNumero(MULTIPLICADOR_DA_SURPRESA)} Surpresa`)
  for (const extra of extras ?? []) partes.push(`${formatarNumero(extra.vezes)} ${extra.nome}`)
  return { valor, conta: partes.length === 1 ? formatarNumero(valor) : `${partes.join(' × ')} = ${formatarNumero(valor)}` }
}

/** O que cada saída diz no botão da caixa REAÇÃO e no selo do d20. */
export const TEXTO_DA_SAIDA: Record<SaidaDaReacao, { botao: string; selo: string }> = {
  critico: { botao: 'Receber o golpe', selo: 'Falha crítica · ×1,5' },
  cheio: { botao: 'Receber o golpe', selo: 'Acertou' },
  metade: { botao: 'Defender', selo: 'Defendeu · metade' },
  esquiva: { botao: 'Esquivar', selo: 'Esquivou' },
  contra: { botao: 'Contra-atacar', selo: 'Contra-ataque!' },
  naoReagiu: { botao: 'Não reagir', selo: 'Não reagiu' },
  passou: { botao: 'Passar', selo: 'Passou' },
  semReacao: { botao: 'Receber o golpe', selo: 'Sem reação' },
}

export interface SaidaNaTela {
  saida: SaidaDaReacao
  rotulo: string
  /** O dano que cai com esta saída; `null` = golpe sem dano. */
  dano: number | null
}

/**
 * As saídas que o d20 liberou (a melhor primeiro), com o dano de cada uma.
 * `tiradas` (F2, fatia A) = as que os selos de quem reage tiram (Aéreo). F2
 * (revisão da fatia E): o Marcado só esquiva se o dado da esquiva também deixa (`saidasDaRolagem`).
 */
export function saidasNaTela(rolagem: Pick<RolagemDaReacao, 'd20' | 'modificador' | 'total' | 'd20DaEsquiva'>, dano: number | null, tiradas: readonly SaidaDaReacao[] = []): SaidaNaTela[] {
  return saidasDaRolagem(rolagem).filter((saida) => !tiradas.includes(saida)).map((saida) => ({ saida, rotulo: TEXTO_DA_SAIDA[saida].botao, dano: dano === null ? null : danoFinal(dano, saida) }))
}

/** A palavra grande sobre o número do dano; `null` = só o número. */
export function palavraDoDano(saida: SaidaDaReacao | 'direto'): string | null {
  switch (saida) {
    case 'critico':
      return 'CRÍTICO'
    case 'esquiva':
      return 'ESQUIVOU'
    case 'contra':
      return 'CONTRA-ATAQUE'
    case 'metade':
      return 'DEFENDEU'
    default:
      return null
  }
}

/** O efeito como texto para a região viva (leitor de tela). */
export function anuncioDoEfeito(efeito: EfeitoDaBatalha, nomeDe: (tokenId: string) => string): string {
  switch (efeito.tipo) {
    case 'golpe':
      return `${nomeDe(efeito.atacanteTokenId)} usa ${efeito.nome}${efeito.surpresa ? ', Surpresa' : ''}`
    case 'reacao':
      return `${nomeDe(efeito.tokenId)} rolou ${efeito.d20}${efeito.modificador === 0 ? '' : ` ${efeito.modificador > 0 ? '+' : '−'} ${Math.abs(efeito.modificador)}`} = ${efeito.total}`
    case 'dano': {
      const palavra = palavraDoDano(efeito.saida)
      return `${nomeDe(efeito.tokenId)}: ${palavra === null ? '' : `${palavra.toLowerCase()}, `}${formatarNumero(efeito.valor)} de dano`
    }
    case 'judge':
      return 'O Judge ergue a carta: jogada desfeita'
    // F3 (fatia T): o texto da região viva (a animação toca em `EfeitosDaBatalha`).
    case 'transformacao':
      return `${nomeDe(efeito.tokenId)} ativa ${efeito.forma}`
    case 'forma':
      return `${nomeDe(efeito.tokenId)} desfaz ${efeito.forma}`
    case 'selo':
      return `${efeito.nome} acabou em ${nomeDe(efeito.tokenId)}`
  }
}

/** Movimento reduzido do sistema (o jogador não carrega o grimório, então não importa `grimorio/comum`). */
export function movimentoReduzido(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
}

/** Um inteiro de 0 ao teto, a partir do que foi digitado; `null` = vazio ou inválido. */
/** O modificador de reação digitado ("+3", "-2"); vazio ou torto = 0, no teto de ±`MODIFICADOR_DA_REACAO_MAX`. */
export function lerModificadorDaReacao(texto: string): number {
  const limpo = texto.trim().replace(/^\+/, '')
  const valor = Number(limpo)
  if (limpo === '' || limpo === '-' || !Number.isFinite(valor)) return 0
  return Math.max(-MODIFICADOR_DA_REACAO_MAX, Math.min(MODIFICADOR_DA_REACAO_MAX, Math.trunc(valor)))
}

export function lerInteiro(texto: string, teto: number): number | null {
  const limpo = texto.replace(/\D/g, '')
  if (limpo === '') return null
  const valor = Number(limpo)
  return Number.isFinite(valor) ? Math.min(teto, Math.max(0, Math.trunc(valor))) : null
}
