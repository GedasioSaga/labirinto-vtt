import type { LembreteDaPassiva, SeloDaBatalha } from './combate'
import { regrasDoSelo } from './condicoes'
import { contarUmTurnoDoGatilho } from '../condicoes/gatilho'
import type { EfeitoNaVez, SaidaDaCondicao } from '../condicoes/modelo'
import { alvoNoMotor } from '../condicoes/traducao'
import type { PecaDoGatilho } from '../itens/modelo'

/**
 * O MOTOR DA VEZ DAS CONDIÇÕES (rework das condições, PLANO.md E5). O que a regra congelada do selo
 * (`SeloDaBatalha.regras`, ou a de fábrica pelo nome, `regrasDoSelo`) faz na vez de quem tem o selo, sem
 * store: quem chama (`stores/batalha/vez.ts`) grava na ficha, com a linha e o Desfazer.
 *  - Efeito na vez (D1): o do começo e o do fim que o motor de antes não fazia (SP e Escudo no começo, vida
 *    no fim, em % do máximo ou do atual, a vida que passa pelo Escudo, quem pôs ganha). A 1ª vida fixa
 *    tirada no começo fica com o "Aplicar / pular" de sempre (`danoPorVezDoSelo`, lib/batalha/condicoes.ts):
 *    o `porVez` próprio do selo (D4) ocupa a mesma vaga;
 *  - o gatilho "Depois de X turnos" nos selos, pela MESMA conta da ficha (`contarUmTurnoDoGatilho`);
 *  - as saídas por teste no fim da vez e o "Tentar sair" pagando e/ou com teste (D8), pela regra de
 *    `comoMarca.ts` ("e" paga e rola; "ou" paga se puder, senão rola).
 * O espelho da pastilha (`daPastilha`) mora na ficha: o gatilho e as saídas dele são os da ficha.
 *
 * API pública: `efeitoDoAplicar`, `aplicarPassaPeloEscudo`, `EfeitoDoSelo`, `efeitosDaVez`, `quantoDoEfeito`,
 * `DisparoDoSelo`, `GatilhosDaVez`, `gatilhosDaVez`, `TesteDoSelo`, `testesDoFimDaVez`, `SaidaPagando`,
 * `saidasPagandoDe`, `chaveDaSaida`, `ehLembreteDaSaida`, `lembreteDaSaida`, `RecursosDeQuemTenta`,
 * `Tentativa`, `podePagar`, `tentarSair`, `textoDaPaga`.
 */

// ─── Efeito na vez ─────────────────────────────────────────────────────────

/**
 * É o efeito do "Aplicar / pular": a 1ª vida tirada no começo (o mesmo filtro de `danoPorVezDoSelo`). PENDENCIAS
 * nº 7: também a vida em % da máxima ou da atual, que antes saía sozinha, sem o Aplicar.
 */
function ehDoAplicar(efeito: EfeitoNaVez): boolean {
  return efeito.quando === 'comeco' && efeito.faz === 'tira' && efeito.recurso === 'vida' && efeito.rouba !== true && efeito.v > 0
}

type SeloComRegras = Pick<SeloDaBatalha, 'nome'> & Partial<Pick<SeloDaBatalha, 'regras' | 'porVez'>>

/** O Efeito na vez do "Aplicar / pular" do selo; `null` = o selo não tem (ou o dele é o `porVez` próprio). */
export function efeitoDoAplicar(selo: SeloComRegras): EfeitoNaVez | null {
  return regrasDoSelo(selo)?.vez?.find(ehDoAplicar) ?? null
}

/**
 * A vida do "Aplicar" passa pelo Escudo? O `porVez` do selo (o número próprio de antes, e a vida "direto"
 * da condição) vai direto no HP, como sempre; a vida da condição sem "direto" (Queimando, Envenenado,
 * Infectado) passa pelo Escudo (prototipo.html:940). O selo que já saiu: direto, como antes.
 */
export function aplicarPassaPeloEscudo(selo: SeloComRegras | undefined): boolean {
  if (selo === undefined || selo.porVez !== undefined) return false
  const efeito = efeitoDoAplicar(selo)
  return efeito !== null && efeito.direto !== true
}

/** Um Efeito na vez que o motor aplica sozinho, com o selo que o tem. */
export interface EfeitoDoSelo {
  selo: SeloDaBatalha
  efeito: EfeitoNaVez
}

/**
 * Os Efeitos na vez de `momento` dos selos de `tokenId`, na ordem dos selos e das peças, sem o do "Aplicar
 * / pular" (a 1ª vida fixa do começo de cada selo). Nenhum = vazio.
 */
export function efeitosDaVez(selos: readonly SeloDaBatalha[] | undefined, tokenId: string, momento: 'comeco' | 'fim'): EfeitoDoSelo[] {
  const lista: EfeitoDoSelo[] = []
  for (const selo of selos ?? []) {
    if (selo.tokenId !== tokenId) continue
    let doAplicar = false
    for (const efeito of regrasDoSelo(selo)?.vez ?? []) {
      if (efeito.quando !== momento || !(efeito.v > 0)) continue
      if (momento === 'comeco' && !doAplicar && ehDoAplicar(efeito)) {
        doAplicar = true
        continue
      }
      lista.push({ selo, efeito })
    }
  }
  return lista
}

/** Quanto o efeito mexe (o fixo, ou a % do máximo ou do atual): a conta mora em `condicoes.ts`, para o "Aplicar" usar a mesma. */
export { quantoDoEfeito } from './condicoes'

// ─── O gatilho nos selos ───────────────────────────────────────────────────

/** Um gatilho de selo que disparou: o selo como estava, as peças e se ele saiu. */
export interface DisparoDoSelo {
  selo: SeloDaBatalha
  pecas: readonly PecaDoGatilho[]
  saiu: boolean
}

/** O fim da vez com os gatilhos dos selos: os selos de agora, os que mudaram (o de antes, para o Desfazer) e os disparos. */
export interface GatilhosDaVez {
  selos: SeloDaBatalha[]
  /** Os selos como estavam antes da conta (os que ficaram na cena). */
  contados: SeloDaBatalha[]
  /** Os que saíram ao disparar ("some"), como estavam. */
  sairam: SeloDaBatalha[]
  disparos: DisparoDoSelo[]
}

/**
 * O fim da vez de `tokenId` com os gatilhos (a conta da ficha, `lib/condicoes/gatilho.ts`): cada selo
 * dele com gatilho que ainda conta soma 1 e, ao chegar a X, dispara. Os que o prazo acabou de tirar
 * (`acabaram`) contam esta última vez também, como na ficha (a conta vem antes do desconto). O espelho
 * da pastilha não conta aqui (a conta dele é a da ficha). Nada a contar = a MESMA lista em `selos`.
 */
export function gatilhosDaVez(selos: readonly SeloDaBatalha[] | undefined, acabaram: readonly SeloDaBatalha[], tokenId: string): GatilhosDaVez {
  const lista = selos ?? []
  const contados: SeloDaBatalha[] = []
  const sairam: SeloDaBatalha[] = []
  const disparos: DisparoDoSelo[] = []
  const trocados = new Map<string, SeloDaBatalha | null>()
  const conta = (selo: SeloDaBatalha, naCena: boolean): void => {
    const gatilho = selo.tokenId !== tokenId || selo.daPastilha === true || selo.gatilhoFeito === true ? undefined : regrasDoSelo(selo)?.gatilho
    if (gatilho === undefined) return
    const contado = contarUmTurnoDoGatilho(selo, gatilho)
    if (contado.dispara) disparos.push({ selo, pecas: gatilho.pecas, saiu: contado.item === null || !naCena })
    if (!naCena) return
    trocados.set(selo.id, contado.item)
    if (contado.item === null) sairam.push(selo)
    else contados.push(selo)
  }
  for (const selo of lista) conta(selo, true)
  for (const selo of acabaram) conta(selo, false)
  if (trocados.size === 0) return { selos: [...lista], contados, sairam, disparos }
  const novos = lista.flatMap((selo) => {
    const trocado = trocados.get(selo.id)
    return trocado === undefined ? [selo] : trocado === null ? [] : [trocado]
  })
  return { selos: novos, contados, sairam, disparos }
}

// ─── As saídas por teste e pagando (D8) ────────────────────────────────────

/** Um teste para sair do selo: o atributo (no id do motor) e a CD. */
export interface TesteDoSelo {
  selo: SeloDaBatalha
  atributo: string
  cd: number
}

/** Os testes do fim da vez dos selos de `tokenId` ("Teste no fim da vez"), um por saída; o espelho fica de fora (mora na ficha). */
export function testesDoFimDaVez(selos: readonly SeloDaBatalha[] | undefined, tokenId: string): TesteDoSelo[] {
  return (selos ?? []).flatMap((selo) => {
    if (selo.tokenId !== tokenId || selo.daPastilha === true) return []
    return (regrasDoSelo(selo)?.saidas ?? []).flatMap((saida) => (saida.tipo === 'teste' ? [{ selo, atributo: alvoNoMotor(saida.atr), cd: saida.cd }] : []))
  })
}

export type SaidaPagando = Extract<SaidaDaCondicao, { tipo: 'pagar' }>

/** As saídas "Tentar sair" (pagar e/ou teste) do selo; nenhuma = vazio. */
export function saidasPagandoDe(selo: SeloComRegras): SaidaPagando[] {
  return (regrasDoSelo(selo)?.saidas ?? []).filter((saida): saida is SaidaPagando => saida.tipo === 'pagar')
}

/** A chave do lembrete "Tentar sair": o `cartaoId` do lembrete é o id do SELO (como o do sangramento). */
export function chaveDaSaida(seloId: string): string {
  return `${seloId}:sair`
}

/** O lembrete é o "Tentar sair" de um selo. */
export function ehLembreteDaSaida(lembrete: Pick<LembreteDaPassiva, 'cartaoId' | 'chave'>): boolean {
  return lembrete.chave === chaveDaSaida(lembrete.cartaoId)
}

/** O lembrete "Tentar sair" do selo, na vez de quem o tem (vai ao jogador dono pelo combate de sempre). */
export function lembreteDaSaida(selo: Pick<SeloDaBatalha, 'id' | 'tokenId'>, rodada: number): LembreteDaPassiva {
  return { cartaoId: selo.id, tokenId: selo.tokenId, tipo: 'ativar', chave: chaveDaSaida(selo.id), rodada }
}

/** O que quem tenta sair tem para pagar agora. */
export interface RecursosDeQuemTenta {
  sp: number
  vida: number
  /** Nº 5 das pendências do rework: a ação simples ainda sobra na vez de quem tenta. Ausente = sobra (quem chama não conta a vez). */
  simples?: boolean
}

/** Dá para pagar o que a saída pede: a ação simples se ela ainda sobra na vez; SP com o bastante; vida só deixando ao menos 1 (prototipo.html:1006). */
export function podePagar(saida: Pick<SaidaPagando, 'paga' | 'v'>, recursos: RecursosDeQuemTenta): boolean {
  const quanto = saida.v ?? 0
  if (saida.paga === 'acao') return recursos.simples !== false
  return saida.paga === 'sp' ? recursos.sp >= quanto : recursos.vida > quanto
}

/** "20 SP", "10 de vida", "a ação simples". */
export function textoDaPaga(saida: Pick<SaidaPagando, 'paga' | 'v'>): string {
  if (saida.paga === 'acao') return 'a ação simples'
  return saida.paga === 'sp' ? `${saida.v ?? 0} SP` : `${saida.v ?? 0} de vida`
}

/** Uma tentativa de sair: o que paga (`null` = nada), se rola o teste, e se sai. */
export interface Tentativa {
  paga: { recurso: 'sp' | 'vida' | 'acao'; quanto: number } | null
  /** O teste rolado (o d20 que quem chama rolou e o modificador); `null` = não rolou. */
  teste: { atributo: string; cd: number; d20: number; modificador: number; total: number; passou: boolean } | null
  sai: boolean
  /** "paga 20 SP", "sem 20 SP, rola Espírito 9 + 1 = 10 contra CD 13, não passou". */
  texto: string
}

/**
 * Tentar sair pela saída (D8, a regra de `comoMarca.ts`): "pagar" só paga; "teste" só rola; "e" paga e
 * rola (sem o que pagar, não tenta); "ou" paga se puder, senão rola (o NPC e o robô fazem o mesmo).
 * `rolar` só é chamado quando o teste rola: o d20 e o modificador de quem tenta no atributo (id do motor).
 */
export function tentarSair(saida: SaidaPagando, recursos: RecursosDeQuemTenta, rolar: (atributo: string) => { d20: number; modificador: number }): Tentativa {
  const pode = podePagar(saida, recursos)
  const paga = { recurso: saida.paga, quanto: saida.paga === 'acao' ? 0 : (saida.v ?? 0) }
  const testar = (): NonNullable<Tentativa['teste']> | null => {
    if (saida.atr === undefined || saida.cd === undefined) return null
    const atributo = alvoNoMotor(saida.atr)
    const { d20, modificador } = rolar(atributo)
    const total = d20 + modificador
    return { atributo, cd: saida.cd, d20, modificador, total, passou: total >= saida.cd }
  }
  const doTeste = (teste: NonNullable<Tentativa['teste']>): string => `${teste.d20} ${teste.modificador < 0 ? '-' : '+'} ${Math.abs(teste.modificador)} = ${teste.total} contra CD ${teste.cd}, ${teste.passou ? 'passou' : 'não passou'}`
  const semPagar = `não tem ${textoDaPaga(saida)}`
  switch (saida.como) {
    case 'pagar':
      return pode ? { paga, teste: null, sai: true, texto: `paga ${textoDaPaga(saida)}` } : { paga: null, teste: null, sai: false, texto: semPagar }
    case 'teste': {
      const teste = testar()
      return teste === null ? { paga: null, teste: null, sai: false, texto: 'a saída não tem teste' } : { paga: null, teste, sai: teste.passou, texto: `rola ${doTeste(teste)}` }
    }
    case 'e': {
      if (!pode) return { paga: null, teste: null, sai: false, texto: semPagar }
      const teste = testar()
      return teste === null ? { paga, teste: null, sai: true, texto: `paga ${textoDaPaga(saida)}` } : { paga, teste, sai: teste.passou, texto: `paga ${textoDaPaga(saida)} e rola ${doTeste(teste)}` }
    }
    case 'ou': {
      if (pode) return { paga, teste: null, sai: true, texto: `paga ${textoDaPaga(saida)}` }
      const teste = testar()
      return teste === null ? { paga: null, teste: null, sai: false, texto: semPagar } : { paga: null, teste, sai: teste.passou, texto: `sem ${textoDaPaga(saida)}, rola ${doTeste(teste)}` }
    }
  }
}
