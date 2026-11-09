import type { GolpeDaBatalha, LembreteDaPassiva, PorVezDoSelo, SaidaDaReacao, SeloDaBatalha, VantagemDoDado } from './combate'
import { normalizar } from './formula'

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
 * Puro: sem store, sem rede.
 */

/**
 * O que o selo FAZ, pelo nome (conserto das fichas F2, fatia A; seção 6 de
 * docs/planos/construtor-de-mecanicas-2026-11-08.md: "tabela nome →
 * comportamento", que a peça `selo` do construtor reusa). Respostas do
 * grilling: Aéreo (May), Cego (Harvey), Ferido por prata (Vincent),
 * Queimando (Aira), Sangrando (Alexei e Siegfried), Atordoado (Jimboy).
 */
export interface ComportamentoDoSelo {
  /** O nome que a tela mostra ("Aéreo"). */
  nome: string
  sinal: RegExp
  /** Na vez do dono só "Passar a vez", e ele não reage. */
  trava?: true
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
}

/** Regra do sistema (respostas do Alexei e do Siegfried): o Sangramento tira 10 por vez, direto no HP. */
export const DANO_DO_SANGRAMENTO = 10
const NOME_DO_SANGRAMENTO = 'Sangrando'

/** A tabela, na ordem em que o nome é procurado. */
const COMPORTAMENTOS_DOS_SELOS: readonly ComportamentoDoSelo[] = [
  { nome: 'Atordoado', sinal: /^atordoad/, trava: true },
  { nome: 'Paralisado', sinal: /^paralisad/, trava: true },
  { nome: 'Aéreo', sinal: /^aere[oa]/, tiraSaidas: ['esquiva', 'contra'] },
  { nome: 'Cego', sinal: /^ceg[oa]/, zera: 'percepcao' },
  // Vincent (Olhar artístico, resposta do mestre): "deixa o Dano Dobrado e coloca que o alvo tem desvantagem em desviar". O dobro mora em `marca.ts`.
  { nome: 'Marcado', sinal: /^marcad[oa]/, esquivaComDesvantagem: true },
  { nome: 'Ferido por prata', sinal: /^ferid[oa] por prata/, lembrete: 'a cura que recebe cai pela metade (o mestre corta à mão)' },
  { nome: NOME_DO_SANGRAMENTO, sinal: /^sangr/, porVez: DANO_DO_SANGRAMENTO, verbo: 'sangra' },
  { nome: 'Queimando', sinal: /^queima/, porVez: 10, verbo: 'queima', renova: true },
  // Aira (texto novo do mestre): "toda vez que um aliado com esse buff causar dano ele vai recuperar na vida 10% do dano que ele causou".
  { nome: 'Bênção de uma Raposa', sinal: /^bencao de uma raposa/, curaDoDano: 10 },
  // Alexei (armadilhas; o mestre põe o selo em quem pisou, pelo "Pôr selo…"): o app só lembra a regra, a armadilha no mapa é do construtor.
  { nome: 'Enraizado', sinal: /^enraizad/, lembrete: 'não anda: sai destruindo a planta, ou com técnica de movimento e d20 15 ou mais' },
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
 * campo do Vagn) ficam de fora. Todos estão na tabela acima.
 */
export const SELOS_COM_REGRA = ['Atordoado', 'Paralisado', 'Aéreo', 'Cego', 'Marcado', 'Sangrando', 'Queimando'] as const

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
  return (selos ?? []).filter((selo) => alvos.has(selo.tokenId) && (comportamentoDoSelo(selo.nome)?.saiNoProximoGolpe === true || (!ajuda && selo.saiNoProximoGolpe === true)))
}

/**
 * F2 (revisão da fatia D): a vantagem com que a reação rola. Selo de quem
 * reage que pede desvantagem (Preso no Campo de Contenção) vence o que veio no
 * pedido, como o mestre disse ("vai jogar com desvantagem"); sem ele, vale o pedido.
 */
export function vantagemDaReacao(pedida: VantagemDoDado | undefined, selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined, golpe?: Pick<GolpeDaBatalha, 'reacaoComDesvantagem'>): VantagemDoDado | undefined {
  // F2 (fatia E): o golpe com a vantagem de Ogro (a Ryoko respondeu "sim") também faz o alvo rolar com desvantagem.
  if (golpe?.reacaoComDesvantagem === true) return 'desvantagem'
  return (selos ?? []).some((selo) => comportamentoDoSelo(selo.nome)?.reageComDesvantagem === true) ? 'desvantagem' : pedida
}

/**
 * F2 (revisão da fatia E, Marcado): a esquiva de quem reage vai com
 * desvantagem? Não quando a reação inteira já rola com desvantagem (o dado que
 * ficou já é o menor). `vantagem` = a com que a reação rolou.
 */
export function esquivaComDesvantagem(selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined, vantagem: VantagemDoDado | undefined): boolean {
  if (vantagem === 'desvantagem') return false
  return (selos ?? []).some((selo) => comportamentoDoSelo(selo.nome)?.esquivaComDesvantagem === true)
}

/**
 * F2 (fatia C): a porcentagem do dano que volta em vida para quem bate, pelos
 * selos dele agora (a maior vale; não somam). 0 = nenhum.
 */
export function curaDoDanoDosSelos(selos: readonly Pick<SeloDaBatalha, 'tokenId' | 'nome'>[] | undefined, tokenId: string): number {
  return (selos ?? []).reduce((maior, selo) => (selo.tokenId === tokenId ? Math.max(maior, comportamentoDoSelo(selo.nome)?.curaDoDano ?? 0) : maior), 0)
}

/** F2 (fatia C): quanto volta em vida de um dano causado, para baixo. */
export function curaDoDano(dano: number, porcento: number): number {
  return dano > 0 && porcento > 0 ? Math.floor((dano * porcento) / 100) : 0
}

/** O comportamento do selo pelo nome (sem acento nem caixa); `null` = selo comum. */
export function comportamentoDoSelo(nomeDoSelo: string): ComportamentoDoSelo | null {
  const normal = normalizar(nomeDoSelo).trim()
  return COMPORTAMENTOS_DOS_SELOS.find((comportamento) => comportamento.sinal.test(normal)) ?? null
}

/** O que o selo só lembra ao mestre (Ferido por prata: a cura cai pela metade), para o título da pílula; `null` = nada a lembrar. */
export function lembreteDoSelo(nomeDoSelo: string): string | null {
  return comportamentoDoSelo(nomeDoSelo)?.lembrete ?? null
}

/** O nome da condição que trava ("Atordoado"), se o selo é uma; `null` = não trava. */
function condicaoQueTrava(nomeDoSelo: string): string | null {
  const comportamento = comportamentoDoSelo(nomeDoSelo)
  return comportamento?.trava === true ? comportamento.nome : null
}

/**
 * As saídas da reação que o d20 liberou, sem as que os selos de quem reage
 * tiram (Aéreo: só Defender e Receber). A melhor que sobra fica primeiro.
 */
export function saidasComOsSelos(saidas: readonly SaidaDaReacao[], selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined): SaidaDaReacao[] {
  const tiradas = new Set(saidasTiradas(selos))
  return saidas.filter((saida) => !tiradas.has(saida))
}

/** As saídas que os selos de quem reage tiram (Aéreo: Esquiva e Contra-ataque); nenhuma = vazio. */
export function saidasTiradas(selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined): SaidaDaReacao[] {
  return [...new Set((selos ?? []).flatMap((selo) => comportamentoDoSelo(selo.nome)?.tiraSaidas ?? []))]
}

/**
 * Quanto o selo tira por vez (o dele, ou o da tabela); `null` = não tira.
 * Construtor C5: o selo montado com "tira X por vez" tira mesmo com nome fora
 * da tabela (um veneno de NPC). O `porVez` do selo só nasce no host, da peça
 * ou da tabela à mão (o Queimando da Aira), então nenhum selo de hoje muda.
 */
export function danoPorVezDoSelo(selo: Pick<SeloDaBatalha, 'nome' | 'porVez'>): number | null {
  const doSelo = selo.porVez !== undefined && Number.isInteger(selo.porVez) && selo.porVez > 0 ? selo.porVez : null
  return doSelo ?? comportamentoDoSelo(selo.nome)?.porVez ?? null
}

/** O nome da tabela ("Queimando"), ou o do selo fora dela, e quanto tira por vez; `null` = não tira. */
export function porVezDoSelo(selo: Pick<SeloDaBatalha, 'nome' | 'porVez'>): PorVezDoSelo | null {
  const dano = danoPorVezDoSelo(selo)
  return dano === null ? null : { nome: comportamentoDoSelo(selo.nome)?.nome ?? selo.nome, dano }
}

/** O verbo da linha do Aplicar ("sangra", "queima"); fora da tabela, "sofre com Veneno". */
export function verboDoPorVez(nomeDoSelo: string): string {
  return comportamentoDoSelo(nomeDoSelo)?.verbo ?? `sofre com ${nomeDoSelo}`
}

/** "Atordoado: nesta vez só dá para passar a vez". */
export function motivoDaTrava(condicao: string): string {
  return `${condicao}: nesta vez só dá para passar a vez`
}

/** A condição que trava ("Atordoado") entre os selos da ficha; `null` = livre. */
function condicaoDosSelos(selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined): string | null {
  for (const selo of selos ?? []) {
    const condicao = condicaoQueTrava(selo.nome)
    if (condicao !== null) return condicao
  }
  return null
}

/**
 * Por que a ficha não age nem reage agora (Atordoado ou Paralisado), ou
 * `null`. `selos` = os da ficha (o jogador passa os da carta dele).
 */
export function travaDosSelos(selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined): string | null {
  const condicao = condicaoDosSelos(selos)
  return condicao === null ? null : motivoDaTrava(condicao)
}

/**
 * Por que a ficha não carrega o contador (a Polaridade) agora: carregar gasta
 * a reação, e quem está Atordoado ou Paralisado não reage. `null` = livre.
 * `selos` = os da ficha, como em `travaDosSelos`.
 */
export function travaDoContador(selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined): string | null {
  const condicao = condicaoDosSelos(selos)
  return condicao === null ? null : `${condicao}: não reage, então não dá para carregar`
}

/** A trava da ficha `tokenId` entre os selos da cena; `null` = livre. */
export function travaDoToken(selos: readonly Pick<SeloDaBatalha, 'tokenId' | 'nome'>[] | undefined, tokenId: string): string | null {
  return travaDosSelos((selos ?? []).filter((selo) => selo.tokenId === tokenId))
}

// ───────────────────────────────────────────────────────────────────────────
// Sangramento
// ───────────────────────────────────────────────────────────────────────────

/** O selo é de sangramento ("Sangrando", "Sangramento 3"). */
export function ehSeloDeSangramento(selo: Pick<SeloDaBatalha, 'nome'>): boolean {
  return comportamentoDoSelo(selo.nome)?.nome === NOME_DO_SANGRAMENTO
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
export function lembreteDoSangramento(selo: SeloDaBatalha, rodada: number): LembreteDaPassiva {
  const lembrete: LembreteDaPassiva = { cartaoId: selo.id, tokenId: selo.tokenId, tipo: 'porTurno', chave: chaveDoSangramento(selo.id), rodada }
  const porVez = porVezDoSelo(selo)
  if (porVez !== null) lembrete.porVez = porVez
  return lembrete
}

/**
 * O que o lembrete do sangramento tira quando o mestre clica Aplicar: o do
 * selo, se ele ainda está na ficha (o mestre pode ter editado); senão o
 * gravado no lembrete quando nasceu (o selo saiu no fim da vez); senão, no
 * lembrete gravado antes disto, o Sangrando da regra (10).
 */
export function porVezDoLembrete(lembrete: Pick<LembreteDaPassiva, 'cartaoId' | 'porVez'>, selos: readonly SeloDaBatalha[] | undefined): PorVezDoSelo {
  const selo = selos?.find((candidato) => candidato.id === lembrete.cartaoId)
  const doSelo = selo === undefined ? null : porVezDoSelo(selo)
  if (doSelo !== null) return doSelo
  return lembrete.porVez ?? { nome: NOME_DO_SANGRAMENTO, dano: DANO_DO_SANGRAMENTO }
}
