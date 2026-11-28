import type { GolpeDaBatalha, LembreteDaPassiva, PorVezDoSelo, RegrasDoSelo, SaidaDaReacao, SeloDaBatalha, VantagemDoDado } from './combate'
import { normalizar } from './formula'
import type { AlcanceDoSelo } from './mecanica/modelo'
import { condicaoDaFabricaDoSelo, type CondicaoDeFabrica } from '../condicoes/fabrica'
import { chaveDaCondicao, type BloqueioDaCondicao, type EfeitoNaVez, type TipoDaCondicao, type TipoDoGolpe } from '../condicoes/modelo'
import { traduzirCondicao } from '../condicoes/traducao'

/**
 * CONDIÇÕES QUE A REGRA APLICA, conserto das fichas F1 (fatia S4; regras do
 * sistema em docs/auditoria-fichas/respostas-do-grilling.md):
 *  - Atordoado e Paralisado: na vez do dono só "Passar a vez" fica liberado,
 *    e ele não reage (o golpe nele resolve sem caixa de reação);
 *  - Sangrando (de qualquer fonte): no começo da vez da vítima, um lembrete
 *    "Aplicar / pular" para o MESTRE; Aplicar tira 10 direto no HP (ignora o
 *    Escudo).
 *
 * O selo é achado pelo NOME ("Atordoado 2", "Sangrando"), sem acento nem
 * caixa: vale o posto à mão e o que o golpe sugeriu.
 *
 * Rework das condições (docs/design/condicoes-rework/PLANO.md D2 e D3, E3): a tabela pelo nome virou a
 * FÁBRICA (`lib/condicoes/fabrica.ts`). O selo que nasceu de uma condição do catálogo traz a regra dela
 * congelada (`SeloDaBatalha.regras`, `criarSelo`); o que não traz (batalha salva antes, nome digitado,
 * Worker antes do deploy, a carta do jogador) acha a de fábrica pelo nome na hora, pela tradução dela
 * (`traduzirCondicao`). Na tabela ficam só as de uma ficha (Imã-Gumelo, Campo de Contenção, Atração,
 * Redoma, Chamas Celestes e a Bênção de uma Raposa). "Perde a vez" e "não reage" são dois bloqueios:
 * `travaDosSelos` é o primeiro (só "Passar a vez"), `naoReageDosSelos` o segundo.
 *
 * Puro: sem store, sem rede.
 */

/**
 * O que o selo FAZ, pelo nome (conserto das fichas F2, fatia A; seção 6 de
 * docs/planos/construtor-de-mecanicas-2026-11-08.md: "tabela nome →
 * comportamento", que a peça `selo` do construtor reusa). Respostas do
 * grilling: Aéreo (May), Cego (Harvey), Ferido por prata (Vincent; hoje Cura reduzida),
 * Queimando (Aira), Sangrando (Alexei e Siegfried), Atordoado (Jimboy).
 */
export interface ComportamentoDoSelo {
  /** O nome que a tela mostra ("Aéreo"). */
  nome: string
  sinal: RegExp
  /** Na vez do dono só "Passar a vez", e ele não reage (os dois bloqueios juntos, como o Atordoado de sempre). */
  trava?: true
  /** Rework das condições (D3): na vez do dono só "Passar a vez" (o bloqueio "Perde a vez"). */
  perdeVez?: true
  /** Rework das condições (D3): o golpe nele resolve sem caixa de reação (o bloqueio "Não pode reagir"). */
  naoReage?: true
  /** As saídas da reação que o selo tira (Aéreo: Esquiva e Contra-ataque; Defender e Receber ficam). */
  tiraSaidas?: readonly SaidaDaReacao[]
  /** O atributo que fica em 0 enquanto o selo existe (Cego: Percepção). Lido na hora (`bonusDaBatalha` põe a parte que zera), nunca congelado quando o selo nasce. */
  zera?: string
  /** O que tira no começo da vez da vítima, direto no HP, pelo lembrete "Aplicar / pular" do mestre. O selo pode trazer o dele (`SeloDaBatalha.porVez`). */
  porVez?: number
  /** O verbo da linha do registro quando o mestre aplica ("Ilo sangra: -10 HP"). */
  verbo?: string
  /** Um acerto novo com o mesmo selo renova os turnos dele em vez de pôr outro (Queimando). */
  renova?: true
  /** O selo só lembra o mestre disto (o app não aplica nada). */
  lembrete?: string
  /** F2 (fatia C): quem tem o selo recupera esta porcentagem do dano que causa, em vida (Bênção de uma Raposa: 10). */
  curaDoDano?: number
  /**
   * CURA REDUZIDA (decisão do dono de 25/11/2026): quanto muda a cura que quem tem o selo recebe, em %
   * (−50 = metade), quando o selo não traz a própria regra (`regra.curaRecebida`, o % escolhido no editor).
   */
  curaRecebida?: number
  /** F2 (revisão da fatia D): quem tem o selo rola a reação com desvantagem (2 d20, fica o menor), sem precisar marcar (Preso no Campo de Contenção). */
  reageComDesvantagem?: true
  /**
   * F2 (revisão da fatia E, Marcado): só a Esquiva e o Contra-ataque de quem
   * tem o selo vão com desvantagem (o app rola mais um d20 para eles e fica o
   * menor); Defender e Receber usam o dado normal (`saidasDaRolagem`).
   */
  esquivaComDesvantagem?: true
  /** F2 (fatia F, redoma da Orquídea): o selo sai quando o próximo golpe chega em quem o tem ("dura até o próximo golpe no alvo"). */
  saiNoProximoGolpe?: true
  /**
   * Fase B do alcance (docs/design/habilidades/ALCANCE.md §3.3): o que o selo faz no alcance de
   * quem o tem ("Ofuscado: -2 em tudo"). Vazia de propósito: a revisão das condições (Cego,
   * Ofuscado...) é o lote SEGUINTE, com perguntas e protótipo próprios.
   */
  alcance?: AlcanceDoSelo
  /** Rework das condições (D3): o dano que quem tem o selo recebe, em % (Vulnerável: +25), quando o selo não traz a própria regra (`regra.danoRecebido`). */
  danoRecebido?: number
  /** Rework das condições (E3, a marca pela condição): a Marca da de fábrica (Marcado: o dobro, sai no golpe que a usa), para o selo sem a regra congelada. */
  marca?: { vezes?: number; fica?: true }
  /** Rework das condições (D3): o id da de fábrica ("queimando"). Ausente = da tabela das de uma ficha. */
  condId?: string
  /** Rework das condições (D1): a regra da de fábrica, traduzida (os bloqueios, o tipo, as saídas, o contra...). Ausente = da tabela. */
  regras?: RegrasDoSelo
}

/** Regra do sistema (respostas do Alexei e do Siegfried): o Sangramento tira 10 por vez, direto no HP. */
export const DANO_DO_SANGRAMENTO = 10
const NOME_DO_SANGRAMENTO = 'Sangrando'
const ID_DO_SANGRAMENTO = 'sangrando'

/** CURA REDUZIDA (decisão do dono de 25/11/2026): o nome da condição e o corte de partida, em % (a bala de prata: metade). */
export const NOME_DA_CURA_REDUZIDA = 'Cura reduzida'
export const CURA_REDUZIDA_PADRAO = 50

/**
 * A tabela das de UMA FICHA, na ordem em que o nome é procurado (antes da fábrica). As gerais (Atordoado,
 * Paralisado, Aéreo, Cego, Marcado, Cura reduzida, Sangrando, Queimando, Enraizado) moraram aqui até a
 * 0.6.6; agora são de fábrica (D3) e fazem o mesmo pela tradução.
 */
const COMPORTAMENTOS_DOS_SELOS: readonly ComportamentoDoSelo[] = [
  // Aira (texto novo do mestre): "toda vez que um aliado com esse buff causar dano ele vai recuperar na vida 10% do dano que ele causou".
  { nome: 'Bênção de uma Raposa', sinal: /^bencao de uma raposa/, curaDoDano: 10 },
  { nome: 'Preso pelo Imã-Gumelo', sinal: /^preso pelo ima/, lembrete: 'para se mover ou arremessar, d20 12 ou mais (senão fica no lugar)' },
  // Vagn (Campo de Contenção; o golpe põe nos marcados, e sai quando ele para de manter): "se alguém que foi pego no campo usar
  // reação de algum golpe vai jogar com desvantagem". O teste para se aproximar ou atacar o Vagn é do mestre (o app não sabe quem
  // entra na área); a pílula diz a CD da fruta (respostas de 08/11: Proficiência em Fruta 1, `CD_DA_FRUTA_DO_VAGN` em mecanicasAMao.ts).
  {
    nome: 'Preso no Campo de Contenção',
    sinal: /^preso no campo/,
    reageComDesvantagem: true,
    lembrete:
      'reage com desvantagem (o app rola 2 d20); para se aproximar ou atacar o Vagn com metal, teste de Espírito contra a CD da fruta (11 + mod. de Espírito do Vagn; com carga: 11, 14, ou pega sem teste na 3ª); de armadura, fica paralisado',
  },
  // Vagn (Atração Relâmpago): quem falhou no teste de Força é puxado até ele; o mestre move a ficha.
  { nome: 'Puxado pela Atração', sinal: /^puxad[oa] pela atracao/, lembrete: 'puxado até o Vagn (o mestre move a ficha) e vulnerável a ataques até o fim da próxima vez dele' },
  // Siegfried (Orquídea): "Cego" (Percepção 0) e "Imobilizado" dentro da redoma, até o próximo golpe nele. Os 30 de fogo e o golpe de
  // oportunidade quando o preso tenta atacar ou sair: o mestre dá (a pílula lembra).
  {
    nome: 'Redoma da Orquídea',
    sinal: /^redoma da orquidea/,
    zera: 'percepcao',
    saiNoProximoGolpe: true,
    lembrete: 'cego e sem poder se mexer; se tentar atacar ou sair: 30 de fogo e o Siegfried ganha um golpe de oportunidade (a Florescer sai sem a Bônus)',
  },
  // Siegfried (Chamas Celestes): o app tira e dá o SP sozinho no fim de cada vez de quem tem o selo (`mecanicasAMao.ts`).
  { nome: 'Chamas Celestes', sinal: /^chamas celestes/, lembrete: 'no fim de cada vez dele: -15 SP nele, +10 SP e -3% do HP no Siegfried (o app faz)' },
]

/**
 * Construtor C5: os selos com regra que a tela de montar oferece em botões, na
 * ordem da tela. Só os gerais: os de uma ficha só (a redoma do Siegfried, o
 * campo do Vagn) ficam de fora. Rework das condições (D3): Envenenado, Lento e Confuso ganharam regra
 * (são de fábrica) e entram no fim, para os botões da tela seguirem os mesmos, na mesma ordem.
 */
export const SELOS_COM_REGRA = ['Atordoado', 'Paralisado', 'Aéreo', 'Cego', 'Marcado', 'Sangrando', 'Queimando', NOME_DA_CURA_REDUZIDA, 'Envenenado', 'Lento', 'Confuso'] as const // as const: só estreita os literais (o tipo dos botões da tela), não converte valor

// ─── A de fábrica pelo nome (D3) ─────────────────────────────────────────────

/** As saídas da reação que quem "não pode desviar" perde (o Aéreo de sempre: Defender e Receber ficam). */
const SAIDAS_DE_QUEM_NAO_DESVIA: readonly SaidaDaReacao[] = ['esquiva', 'contra']

/** O verbo da linha do "Aplicar" das de fábrica que tiram vida por vez; as outras dizem "sofre com X". */
const VERBOS_DO_POR_VEZ: Readonly<Record<string, string>> = { sangrando: 'sangra', queimando: 'queima' }

/** Quantos nomes de selo a memória de nome → de fábrica guarda (a mesa digita nomes à vontade). */
const NOMES_NA_MEMORIA_MAX = 512

const FABRICA_DO_NOME = new Map<string, CondicaoDeFabrica | null>()
const COMPORTAMENTO_DA_FABRICA = new Map<string, ComportamentoDoSelo>()

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A de fábrica pelo nome do selo (o exato, o apelido, o começo de nome de antes), com memória. */
function fabricaDoSelo(nomeDoSelo: string): CondicaoDeFabrica | null {
  const lembrada = FABRICA_DO_NOME.get(nomeDoSelo)
  if (lembrada !== undefined) return lembrada
  const achada = condicaoDaFabricaDoSelo(nomeDoSelo)
  if (FABRICA_DO_NOME.size >= NOMES_NA_MEMORIA_MAX) FABRICA_DO_NOME.clear()
  FABRICA_DO_NOME.set(nomeDoSelo, achada)
  return achada
}

/**
 * A vida fixa que a condição tira no começo de cada vez (a 1ª peça assim): o "Aplicar / pular" do mestre.
 * A tradução põe em `porVez` só a que é direto na vida; a que passa pelo Escudo (Queimando, Envenenado)
 * fica em `regras.vez`, e o lembrete a tira do mesmo jeito (E5 faz o Escudo valer). `undefined` = nenhuma.
 */
function vidaFixaNoComecoDaVez(regras: RegrasDoSelo | undefined): number | undefined {
  const efeito = regras?.vez?.find((vez) => vez.quando === 'comeco' && vez.faz === 'tira' && vez.recurso === 'vida' && vez.conta === 'fixo' && vez.rouba !== true && vez.v > 0)
  return efeito?.v
}

/** A vida da ficha agora (o HP máximo e o atual): a vida em % do "Aplicar" sai dela (PENDENCIAS nº 7). */
export interface VidaNaHora {
  maximo: number | null
  atual: number
}

/**
 * Quanto o efeito mexe: o fixo (já vezes as pilhas, `traduzirCondicao`), ou a % do máximo ou do atual do
 * recurso, arredondada como o boneco do protótipo (prototipo.html:934). Sem máximo, a % do máximo é a do atual.
 * (Mora aqui para o "Aplicar" do começo da vez usar a mesma conta; `condicoesNaVez.ts` o reexporta.)
 */
export function quantoDoEfeito(efeito: Pick<EfeitoNaVez, 'v' | 'conta'>, maximo: number | null, atual: number): number {
  if (efeito.conta === 'fixo') return Math.max(0, Math.trunc(efeito.v))
  const base = Math.max(0, efeito.conta === 'pctMax' ? (maximo ?? atual) : atual)
  return Math.max(0, Math.round((base * efeito.v) / 100))
}

/**
 * PENDENCIAS nº 7: a vida que a condição tira no começo da vez pelo "Aplicar / pular" (a 1ª peça assim), fixa
 * ou em % da vida máxima ou atual. A % sai da vida da ficha na hora (`vida`); sem ela, 0 (o lembrete nasce e o
 * número sai no Aplicar). `undefined` = nenhuma.
 */
function vidaNoComecoDaVez(regras: RegrasDoSelo | undefined, vida?: VidaNaHora): number | undefined {
  const efeito = regras?.vez?.find((vez) => vez.quando === 'comeco' && vez.faz === 'tira' && vez.recurso === 'vida' && vez.rouba !== true && vez.v > 0)
  if (efeito === undefined) return undefined
  if (efeito.conta === 'fixo') return efeito.v
  return vida === undefined ? 0 : quantoDoEfeito(efeito, vida.maximo, vida.atual)
}

/** O comportamento da de fábrica, da tradução dela com o pedido vazio (1 pilha, o prazo dela). Um objeto por condição. */
function comportamentoDaFabrica(condicao: CondicaoDeFabrica): ComportamentoDoSelo {
  const lembrado = COMPORTAMENTO_DA_FABRICA.get(condicao.id)
  if (lembrado !== undefined) return lembrado
  const traduzido = traduzirCondicao(condicao)
  const regras = traduzido.regras
  const bloqueios = new Set(regras?.bloqueios ?? [])
  const comportamento: ComportamentoDoSelo = { nome: condicao.nome, sinal: new RegExp(`^${escaparRegex(chaveDaCondicao(condicao.nome))}`), condId: condicao.id }
  if (regras !== undefined) comportamento.regras = regras
  if (bloqueios.has('perdeVez')) comportamento.perdeVez = true
  if (bloqueios.has('naoReage')) comportamento.naoReage = true
  if (bloqueios.has('perdeVez') && bloqueios.has('naoReage')) comportamento.trava = true
  if (bloqueios.has('naoDesvia')) comportamento.tiraSaidas = SAIDAS_DE_QUEM_NAO_DESVIA
  const zera = regras?.ficaEm?.find((fica) => fica.v === 0)
  if (zera !== undefined) comportamento.zera = zera.alvo
  const porVez = traduzido.porVez ?? vidaFixaNoComecoDaVez(regras)
  if (porVez !== undefined) comportamento.porVez = porVez
  const verbo = VERBOS_DO_POR_VEZ[condicao.id]
  if (verbo !== undefined) comportamento.verbo = verbo
  if (regras?.deNovo === 'renova') comportamento.renova = true
  if (regras?.curaDoDano !== undefined) comportamento.curaDoDano = regras.curaDoDano
  if (traduzido.regra?.curaRecebida !== undefined) comportamento.curaRecebida = traduzido.regra.curaRecebida
  if (traduzido.regra?.danoRecebido !== undefined && traduzido.regra.danoRecebido !== 0) comportamento.danoRecebido = traduzido.regra.danoRecebido
  if (traduzido.regra?.reageComDesvantagem === true) comportamento.reageComDesvantagem = true
  if (traduzido.marca === true) {
    const marca: NonNullable<ComportamentoDoSelo['marca']> = {}
    if (traduzido.marcaVezes !== undefined) marca.vezes = traduzido.marcaVezes
    if (traduzido.marcaFica === true) marca.fica = true
    comportamento.marca = marca
  }
  if (regras?.esquivaComDesvantagem === true) comportamento.esquivaComDesvantagem = true
  if (traduzido.saiNoProximoGolpe === true) comportamento.saiNoProximoGolpe = true
  if (traduzido.alcance !== undefined) comportamento.alcance = traduzido.alcance
  COMPORTAMENTO_DA_FABRICA.set(condicao.id, comportamento)
  return comportamento
}

/**
 * O comportamento do selo pelo nome (sem acento nem caixa): a tabela das de uma ficha, depois a de fábrica
 * (o nome, o apelido e o começo de nome de antes: "Atordoado 2", "Ferida por prata"); `null` = selo comum.
 * O mesmo nome dá sempre o MESMO objeto ("Atordoado" e "Atordoado 2" também).
 */
export function comportamentoDoSelo(nomeDoSelo: string): ComportamentoDoSelo | null {
  const normal = normalizar(nomeDoSelo).trim()
  const daTabela = COMPORTAMENTOS_DOS_SELOS.find((comportamento) => comportamento.sinal.test(normal))
  if (daTabela !== undefined) return daTabela
  const daFabrica = fabricaDoSelo(nomeDoSelo)
  return daFabrica === null ? null : comportamentoDaFabrica(daFabrica)
}

// ─── O selo como as regras o leem (D2) ───────────────────────────────────────

/** O selo para as regras: o nome e, no host, a regra congelada e a própria (o jogador só tem o nome). */
export type SeloComARegra = Pick<SeloDaBatalha, 'nome'> & Partial<Pick<SeloDaBatalha, 'regras' | 'regra'>>

/**
 * A regra da condição do selo: a congelada quando ele nasceu (D2) ou, sem ela, a da de fábrica pelo nome
 * (D3). `null` = selo comum ou da tabela das de uma ficha.
 */
export function regrasDoSelo(selo: Pick<SeloDaBatalha, 'nome'> & Partial<Pick<SeloDaBatalha, 'regras'>>): RegrasDoSelo | null {
  return selo.regras ?? comportamentoDoSelo(selo.nome)?.regras ?? null
}

/** O que vale pelo nome: só no selo sem regra congelada (o congelado de uma criada não volta para a de fábrica). */
function peloNome(selo: Pick<SeloDaBatalha, 'nome'> & Partial<Pick<SeloDaBatalha, 'regras'>>): ComportamentoDoSelo | null {
  return selo.regras === undefined ? comportamentoDoSelo(selo.nome) : null
}

/** Negativa ou positiva, pela condição do selo; `null` = selo comum (vale a natureza, como antes). */
export function tipoDoSelo(selo: Pick<SeloDaBatalha, 'nome'> & Partial<Pick<SeloDaBatalha, 'regras'>>): TipoDaCondicao | null {
  return regrasDoSelo(selo)?.tipo ?? null
}

/** O selo tem o bloqueio (pela condição dele)? */
export function seloComBloqueio(selo: SeloComARegra, bloqueio: BloqueioDaCondicao): boolean {
  return regrasDoSelo(selo)?.bloqueios?.includes(bloqueio) === true
}

/** O nome da condição do selo: o da de fábrica ("Atordoado 2" é o "Atordoado"), senão o do selo. É o que o contra e a frase do motivo comparam. */
export function nomeDaCondicaoDoSelo(selo: Pick<SeloDaBatalha, 'nome'>): string {
  return comportamentoDoSelo(selo.nome)?.nome ?? selo.nome
}

function nomeNoMotivo(selo: Pick<SeloDaBatalha, 'nome'>): string {
  return nomeDaCondicaoDoSelo(selo)
}

/** A condição (o nome) com o bloqueio entre os selos; `null` = nenhuma. */
function condicaoComBloqueio(selos: readonly SeloComARegra[] | undefined, bloqueio: BloqueioDaCondicao): string | null {
  for (const selo of selos ?? []) if (seloComBloqueio(selo, bloqueio)) return nomeNoMotivo(selo)
  return null
}

/** O pedaço do motivo de cada bloqueio ("Silenciado: não pode usar técnica"). */
const MOTIVO_DO_BLOQUEIO: Readonly<Record<BloqueioDaCondicao, string>> = {
  perdeVez: 'nesta vez só dá para passar a vez',
  naoReage: 'não reage',
  reageDesv: 'reage com desvantagem',
  naoDesvia: 'não pode desviar',
  naoMove: 'não pode se mover',
  naoTecnica: 'não pode usar técnica',
  soSimples: 'só usa ação simples (sem Completa nem Bônus)',
  naoAlvo: 'não pode ser alvo de golpe',
}

/**
 * D10: por que a ficha `tokenId` não pode o que o bloqueio proíbe ("Silenciado: não pode usar técnica",
 * "Invisível: não pode ser alvo de golpe"), pelos selos dela; `null` = pode. O host e o menu leem daqui.
 */
export function motivoDoBloqueio(selos: readonly (SeloComARegra & Pick<SeloDaBatalha, 'tokenId'>)[] | undefined, tokenId: string, bloqueio: BloqueioDaCondicao): string | null {
  return motivoDoBloqueioNosSelos(
    (selos ?? []).filter((selo) => selo.tokenId === tokenId),
    bloqueio,
  )
}

/** O mesmo motivo, com os selos de UMA ficha (a carta do jogador traz só os dela, sem o token). `null` = pode. */
export function motivoDoBloqueioNosSelos(selos: readonly SeloComARegra[] | undefined, bloqueio: BloqueioDaCondicao): string | null {
  const condicao = condicaoComBloqueio(selos, bloqueio)
  return condicao === null ? null : `${condicao}: ${MOTIVO_DO_BLOQUEIO[bloqueio]}`
}

// ─── As regras de sempre, agora pela condição ─────────────────────────────────

/**
 * F2 (fatia F, redoma da Orquídea): os selos que saem porque um golpe novo
 * chegou nestes alvos. Nenhum = lista vazia. Construtor C5: também o selo
 * montado com a duração "até o próximo golpe", mas esse só sai com golpe de
 * verdade: a técnica de ajuda (`ajuda`: em si, nos aliados, o Buff) não o
 * tira (revisão da C5: a cura de um aliado levava o "Protegido até o próximo
 * golpe"). A redoma da tabela sai com qualquer golpe, como na F2.
 */
export function selosQueSaemNoGolpe(selos: readonly SeloDaBatalha[] | undefined, alvosTokenIds: readonly string[], ajuda = false): SeloDaBatalha[] {
  const alvos = new Set(alvosTokenIds)
  return (selos ?? []).filter((selo) => alvos.has(selo.tokenId) && (peloNome(selo)?.saiNoProximoGolpe === true || (!ajuda && selo.saiNoProximoGolpe === true)))
}

/**
 * F2 (revisão da fatia D): a vantagem com que a reação rola. Selo de quem
 * reage que pede desvantagem (Preso no Campo de Contenção) vence o que veio no
 * pedido, como o mestre disse ("vai jogar com desvantagem"); sem ele, vale o pedido.
 */
export function vantagemDaReacao(pedida: VantagemDoDado | undefined, selos: readonly SeloComARegra[] | undefined, golpe?: Pick<GolpeDaBatalha, 'reacaoComDesvantagem'>): VantagemDoDado | undefined {
  // F2 (fatia E): o golpe com a vantagem de Ogro (a Ryoko respondeu "sim") também faz o alvo rolar com desvantagem.
  if (golpe?.reacaoComDesvantagem === true) return 'desvantagem'
  // Fase ED4: também o selo montado com a regra (o Congelado do tipo do golpe), além da tabela pelo nome.
  // Rework das condições: o "reage com desvantagem" da condição vai em `regra` (a congelada) ou vem da de fábrica pelo nome.
  return (selos ?? []).some((selo) => selo.regra?.reageComDesvantagem === true || peloNome(selo)?.reageComDesvantagem === true) ? 'desvantagem' : pedida
}

/**
 * F2 (revisão da fatia E, Marcado): a esquiva de quem reage vai com
 * desvantagem? Não quando a reação inteira já rola com desvantagem (o dado que
 * ficou já é o menor). `vantagem` = a com que a reação rolou.
 */
export function esquivaComDesvantagem(selos: readonly SeloComARegra[] | undefined, vantagem: VantagemDoDado | undefined): boolean {
  if (vantagem === 'desvantagem') return false
  return (selos ?? []).some((selo) => regrasDoSelo(selo)?.esquivaComDesvantagem === true || peloNome(selo)?.esquivaComDesvantagem === true)
}

/**
 * F2 (fatia C): a porcentagem do dano que volta em vida para quem bate, pelos
 * selos dele agora (a maior vale; não somam). 0 = nenhum. Rework das condições: também a da condição
 * (Abençoado: 10).
 */
export function curaDoDanoDosSelos(selos: readonly (Pick<SeloDaBatalha, 'tokenId' | 'nome'> & Partial<Pick<SeloDaBatalha, 'regras'>>)[] | undefined, tokenId: string): number {
  return (selos ?? []).reduce((maior, selo) => (selo.tokenId === tokenId ? Math.max(maior, regrasDoSelo(selo)?.curaDoDano ?? 0, peloNome(selo)?.curaDoDano ?? 0) : maior), 0)
}

type SeloQueMexeNaCura = Pick<SeloDaBatalha, 'tokenId' | 'nome' | 'regra'> & Partial<Pick<SeloDaBatalha, 'regras'>>

/**
 * Os selos de `tokenId` que mudam a cura que ele recebe, com o % de cada: o da regra do selo montado
 * (`regra.curaRecebida`), senão o da condição pelo nome (Cura reduzida: −50). 0 não muda nada.
 */
function selosQueMexemNaCura(selos: readonly SeloQueMexeNaCura[] | undefined, tokenId: string): { nome: string; porcento: number }[] {
  return (selos ?? []).flatMap((selo) => {
    if (selo.tokenId !== tokenId) return []
    const porcento = selo.regra?.curaRecebida ?? peloNome(selo)?.curaRecebida
    return porcento === undefined || porcento === 0 ? [] : [{ nome: selo.nome, porcento }]
  })
}

/**
 * Fase 5 (SISTEMA.md, `regra.curaRecebida` do selo montado; antes só
 * lembrete): a cura que chega em quem tem o selo, para baixo (−50 = metade,
 * +50 = 1,5 vez). Vários selos: um depois do outro. Sem selo com a regra: a
 * MESMA cura. 25/11/2026: também a Cura reduzida pelo nome (a posta à mão, a da bala de prata).
 */
export function curaComOsSelos(cura: number, selos: readonly SeloQueMexeNaCura[] | undefined, tokenId: string): number {
  const fator = selosQueMexemNaCura(selos, tokenId).reduce((produto, { porcento }) => (produto * Math.max(0, 100 + porcento)) / 100, 1)
  return fator === 1 ? cura : Math.max(0, Math.floor(cura * fator))
}

/**
 * CURA REDUZIDA (decisão do dono de 25/11/2026): o pedaço da linha do registro que diz por que a cura
 * veio cortada (" (Cura reduzida −50%)"), para ir logo depois do "curou N". '' = nenhum selo mexeu nela.
 */
export function notaDosSelosNaCura(selos: readonly SeloQueMexeNaCura[] | undefined, tokenId: string): string {
  const mexem = selosQueMexemNaCura(selos, tokenId)
  if (mexem.length === 0) return ''
  return ` (${mexem.map(({ nome, porcento }) => `${nome} ${porcento < 0 ? `−${-porcento}` : `+${porcento}`}%`).join(', ')})`
}

/** F2 (fatia C): quanto volta em vida de um dano causado, para baixo. */
export function curaDoDano(dano: number, porcento: number): number {
  return dano > 0 && porcento > 0 ? Math.floor((dano * porcento) / 100) : 0
}

/** O que o selo só lembra ao mestre (Preso no Campo de Contenção), para o título da pílula; `null` = nada a lembrar. */
export function lembreteDoSelo(nomeDoSelo: string): string | null {
  return comportamentoDoSelo(nomeDoSelo)?.lembrete ?? null
}

/** Fase B do alcance: o que a condição, pelo nome, faz no alcance de quem a tem; `null` = não mexe. */
export function alcanceDaCondicao(nomeDoSelo: string): AlcanceDoSelo | null {
  return comportamentoDoSelo(nomeDoSelo)?.alcance ?? null
}

/**
 * As saídas da reação que o d20 liberou, sem as que os selos de quem reage
 * tiram (Aéreo: só Defender e Receber). A melhor que sobra fica primeiro.
 */
export function saidasComOsSelos(saidas: readonly SaidaDaReacao[], selos: readonly SeloComARegra[] | undefined): SaidaDaReacao[] {
  const tiradas = new Set(saidasTiradas(selos))
  return saidas.filter((saida) => !tiradas.has(saida))
}

/** As saídas que os selos de quem reage tiram (Aéreo, Caído: Esquiva e Contra-ataque); nenhuma = vazio. */
export function saidasTiradas(selos: readonly SeloComARegra[] | undefined): SaidaDaReacao[] {
  return [...new Set((selos ?? []).flatMap((selo) => (seloComBloqueio(selo, 'naoDesvia') ? SAIDAS_DE_QUEM_NAO_DESVIA : (peloNome(selo)?.tiraSaidas ?? []))))]
}

/**
 * Quanto o selo tira por vez (o dele, ou o da condição); `null` = não tira.
 * Construtor C5: o selo montado com "tira X por vez" tira mesmo com nome fora
 * da tabela (um veneno de NPC). O `porVez` do selo só nasce no host, da peça
 * ou da condição (o Queimando da Aira). Rework das condições: o da condição é a 1ª vida fixa que ela tira
 * no começo da vez (a congelada no selo, já vezes as pilhas; ou a da de fábrica pelo nome).
 */
export function danoPorVezDoSelo(selo: Pick<SeloDaBatalha, 'nome' | 'porVez'> & Partial<Pick<SeloDaBatalha, 'regras'>>, vida?: VidaNaHora): number | null {
  const doSelo = selo.porVez !== undefined && Number.isInteger(selo.porVez) && selo.porVez > 0 ? selo.porVez : null
  // PENDENCIAS nº 7: a vida em % da condição também pede o "Aplicar"; o número sai da vida da ficha na hora (`vida`).
  const daCondicao = selo.regras !== undefined ? vidaNoComecoDaVez(selo.regras, vida) : comportamentoDoSelo(selo.nome)?.porVez
  return doSelo ?? daCondicao ?? null
}

/** O nome da condição ("Queimando"), ou o do selo fora dela, e quanto tira por vez (a % pela `vida` da ficha agora); `null` = não tira. */
export function porVezDoSelo(selo: Pick<SeloDaBatalha, 'nome' | 'porVez'> & Partial<Pick<SeloDaBatalha, 'regras'>>, vida?: VidaNaHora): PorVezDoSelo | null {
  const dano = danoPorVezDoSelo(selo, vida)
  return dano === null ? null : { nome: comportamentoDoSelo(selo.nome)?.nome ?? selo.nome, dano }
}

/** O verbo da linha do Aplicar ("sangra", "queima"); fora delas, "sofre com Veneno". */
export function verboDoPorVez(nomeDoSelo: string): string {
  return comportamentoDoSelo(nomeDoSelo)?.verbo ?? `sofre com ${nomeDoSelo}`
}

/** "Atordoado: nesta vez só dá para passar a vez". */
export function motivoDaTrava(condicao: string): string {
  return `${condicao}: ${MOTIVO_DO_BLOQUEIO.perdeVez}`
}

/**
 * Por que a ficha não age agora (Atordoado, Paralisado, Dormindo: o bloqueio "Perde a vez"), ou `null`.
 * `selos` = os da ficha (o jogador passa os da carta dele, só com o nome: vale a de fábrica).
 */
export function travaDosSelos(selos: readonly SeloComARegra[] | undefined): string | null {
  const condicao = condicaoComBloqueio(selos, 'perdeVez')
  return condicao === null ? null : motivoDaTrava(condicao)
}

/**
 * Rework das condições (D3): por que a ficha não reage agora (o bloqueio "Não pode reagir": o golpe nela
 * resolve sem caixa de reação), ou `null`. As de fábrica que travam (Atordoado, Paralisado, Dormindo) têm
 * os dois bloqueios: travam a vez e a reação, como antes.
 */
export function naoReageDosSelos(selos: readonly SeloComARegra[] | undefined): string | null {
  const condicao = condicaoComBloqueio(selos, 'naoReage')
  return condicao === null ? null : `${condicao}: ${MOTIVO_DO_BLOQUEIO.naoReage}`
}

/** A ficha `tokenId` não reage agora (o motivo); `null` = reage. */
export function naoReageDoToken(selos: readonly (SeloComARegra & Pick<SeloDaBatalha, 'tokenId'>)[] | undefined, tokenId: string): string | null {
  return naoReageDosSelos((selos ?? []).filter((selo) => selo.tokenId === tokenId))
}

/**
 * Por que a ficha não carrega o contador (a Polaridade) agora: carregar gasta
 * a reação, e quem não reage (Atordoado, Paralisado) não carrega. `null` = livre.
 * `selos` = os da ficha, como em `travaDosSelos`.
 */
export function travaDoContador(selos: readonly SeloComARegra[] | undefined): string | null {
  const condicao = condicaoComBloqueio(selos, 'naoReage')
  return condicao === null ? null : `${condicao}: não reage, então não dá para carregar`
}

/** A trava da ficha `tokenId` entre os selos da cena; `null` = livre. */
export function travaDoToken(selos: readonly (SeloComARegra & Pick<SeloDaBatalha, 'tokenId'>)[] | undefined, tokenId: string): string | null {
  return travaDosSelos((selos ?? []).filter((selo) => selo.tokenId === tokenId))
}

// ─── As saídas que a batalha vê acontecer (D8, E3) ───────────────────────────

/** O que aconteceu com quem tem o selo: recebeu cura, tomou dano (dos tipos do golpe; vazio = sem tipo), ou agiu (atacou, usou técnica). */
export type AcontecimentoDaSaida = { tipo: 'cura' } | { tipo: 'dano'; tipos: readonly TipoDoGolpe[] } | { tipo: 'agir' }

/**
 * Os selos de `tokenId` que saem com o acontecimento, pelas saídas da condição deles (Sangrando sai com
 * cura; Congelado e Molhado com dano de Fogo; Confuso e Dormindo com qualquer dano; Invisível ao agir). O
 * golpe sem tipo só tira o "qualquer dano". O espelho de uma condição da ficha não sai aqui: ela mora na
 * ficha (a vez e a ficha são da E5). Nenhum = vazio.
 */
export function selosQueSaemCom(selos: readonly SeloDaBatalha[] | undefined, tokenId: string, acontecimento: AcontecimentoDaSaida): SeloDaBatalha[] {
  return (selos ?? []).filter((selo) => {
    if (selo.tokenId !== tokenId || selo.daPastilha === true) return false
    return (regrasDoSelo(selo)?.saidas ?? []).some((saida) => {
      if (saida.tipo !== acontecimento.tipo) return false
      if (saida.tipo !== 'dano' || acontecimento.tipo !== 'dano') return true
      return saida.dano === 'qualquer' || acontecimento.tipos.some((tipo) => tipo === saida.dano)
    })
  })
}

/** "Sangrando saiu de Ilo (recebeu cura)": o pedaço da linha; nenhum = ''. */
export function textoDasSaidasDoSelo(saem: readonly Pick<SeloDaBatalha, 'nome'>[], acontecimento: AcontecimentoDaSaida, nomeDoToken: string): string {
  if (saem.length === 0) return ''
  const porque = acontecimento.tipo === 'cura' ? 'recebeu cura' : acontecimento.tipo === 'agir' ? 'agiu' : 'tomou dano'
  return `${saem.map((selo) => selo.nome).join(', ')} ${saem.length === 1 ? 'saiu' : 'saíram'} de ${nomeDoToken} (${porque})`
}

/**
 * Rework das condições (E3): os que saem de `tokenId` com o acontecimento, os selos da cena sem eles e o
 * texto da linha. Nada sai = `sairam` vazio (quem chama não mexe na cena).
 */
export function selosSemOsQueSaem(selos: readonly SeloDaBatalha[] | undefined, tokenId: string, acontecimento: AcontecimentoDaSaida, nomeDoToken: string): { selos: SeloDaBatalha[]; sairam: SeloDaBatalha[]; texto: string } {
  const sairam = selosQueSaemCom(selos, tokenId, acontecimento)
  const ids = new Set(sairam.map((selo) => selo.id))
  return { selos: (selos ?? []).filter((selo) => !ids.has(selo.id)), sairam, texto: textoDasSaidasDoSelo(sairam, acontecimento, nomeDoToken) }
}

// ───────────────────────────────────────────────────────────────────────────
// Sangramento
// ───────────────────────────────────────────────────────────────────────────

/** O selo é de sangramento ("Sangrando", "Sangramento 3"). */
export function ehSeloDeSangramento(selo: Pick<SeloDaBatalha, 'nome'>): boolean {
  return comportamentoDoSelo(selo.nome)?.condId === ID_DO_SANGRAMENTO
}

/**
 * Os selos da ficha que tiram por vez (Sangrando, Queimando), na ordem em que
 * foram postos: cada um pede "Aplicar / pular" ao mestre no começo da vez.
 */
export function sangramentosDoToken(selos: readonly SeloDaBatalha[] | undefined, tokenId: string): SeloDaBatalha[] {
  return (selos ?? []).filter((selo) => selo.tokenId === tokenId && danoPorVezDoSelo(selo) !== null)
}

/** A chave do lembrete do sangramento: o `cartaoId` do lembrete é o id do SELO. */
export function chaveDoSangramento(seloId: string): string {
  return `${seloId}:sangra`
}

/** O lembrete é o de um sangramento (e não o de uma passiva ou forma). */
export function ehLembreteDoSangramento(lembrete: Pick<LembreteDaPassiva, 'cartaoId' | 'chave'>): boolean {
  return lembrete.chave === chaveDoSangramento(lembrete.cartaoId)
}

/** O lembrete do sangramento da ficha da vez, com o nome e quanto o selo tira, gravados agora (o selo pode sair antes do Aplicar). */
export function lembreteDoSangramento(selo: SeloDaBatalha, rodada: number, vida?: VidaNaHora): LembreteDaPassiva {
  const lembrete: LembreteDaPassiva = { cartaoId: selo.id, tokenId: selo.tokenId, tipo: 'porTurno', chave: chaveDoSangramento(selo.id), rodada }
  const porVez = porVezDoSelo(selo, vida)
  if (porVez !== null) lembrete.porVez = porVez
  return lembrete
}

/**
 * O que o lembrete do sangramento tira quando o mestre clica Aplicar: o do
 * selo, se ele ainda está na ficha (o mestre pode ter editado); senão o
 * gravado no lembrete quando nasceu (o selo saiu no fim da vez); senão, no
 * lembrete gravado antes disto, o Sangrando da regra (10).
 */
export function porVezDoLembrete(lembrete: Pick<LembreteDaPassiva, 'cartaoId' | 'porVez'>, selos: readonly SeloDaBatalha[] | undefined, vida?: VidaNaHora): PorVezDoSelo {
  const selo = selos?.find((candidato) => candidato.id === lembrete.cartaoId)
  const doSelo = selo === undefined ? null : porVezDoSelo(selo, vida)
  // PENDENCIAS nº 7: sem a vida da ficha (a tela), a vida em % fica com o número gravado quando o lembrete nasceu.
  const emPorcento = selo !== undefined && selo.porVez === undefined && selo.regras !== undefined && vidaNoComecoDaVez(selo.regras) !== vidaFixaNoComecoDaVez(selo.regras)
  if (doSelo !== null && (vida !== undefined || !emPorcento || lembrete.porVez === undefined)) return doSelo
  return lembrete.porVez ?? { nome: NOME_DO_SANGRAMENTO, dano: DANO_DO_SANGRAMENTO }
}
