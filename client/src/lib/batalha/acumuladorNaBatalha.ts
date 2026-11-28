import type { CartaoDaFicha, Personagem } from '../personagem'
import { ALVO_DO_DANO, combateVazio, type BonusDaBatalha, type CombateDoPersonagem, type ParteDoBonus, type SoEmDoBonus } from './combate'
import type { TurnosDaCena } from './turnos'
import { mesmaReferencia } from './requisitos/contexto'
import { lerAcumulador } from './requisitos/ler'
import type { AcumuladorDaFicha, GanhoDoAcumulador, MarcoDoAcumulador, Referencia, ValeEmDoAcumulador } from './requisitos/modelo'

/**
 * REQUISITOS, fases B3 e C: o NÍVEL de cada acumulador genérico na batalha (Polaridade, Fúria, Cargas).
 * A definição mora no cartão (`CartaoDaFicha.acumulador`, lida por `lerAcumulador`); o nível de
 * agora mora no combate (`CombateDoPersonagem.acumuladores`, id → nível) e volta no Desfazer pela
 * parte "combate" da linha, por delta (`combateSemALinha`).
 *
 * Aqui: ler as definições da ficha, ler e mudar o nível (de 0 ao máximo), as regras de subir e de
 * cair por evento (acerta, apanha, usa a técnica, derruba, esquiva, gasta a reação, gasta SP, começo
 * da vez), a queda por rodada sem uso (na virada), o gasto do requisito A4 e o ganho de cada nível
 * (o dano a mais e o atributo a mais, como parte do bônus da batalha). O fim da batalha zera sozinho:
 * o nível mora no combate, que a batalha nova começa vazio.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** O que aconteceu com a ficha, para as regras de subir e de cair. */
export type EventoDoAcumulador =
  | { quando: 'acerta' }
  | { quando: 'apanha' }
  | { quando: 'usaTecnica'; tecnica: Referencia }
  /** Fase ED4: o golpe da técnica acertou alguém (o "+N se acertar"); uma vez por golpe. */
  | { quando: 'acertaComTecnica'; tecnica: Referencia }
  | { quando: 'derruba' }
  | { quando: 'esquiva' }
  | { quando: 'gastaReacao' }
  | { quando: 'comecoDaVez' }
  /** `sp`: quanto SP saiu agora (a regra sobe `quanto` a cada `cada` SP inteiros). */
  | { quando: 'gastaSp'; sp: number }

/** As definições de acumulador nos cartões da ficha (abas e subcartões), uma por id (a primeira vale). Torta = de fora. */
export function acumuladoresDoPersonagem(personagem: Pick<Personagem, 'abas'>): AcumuladorDaFicha[] {
  return acumuladoresComODono(personagem).map((item) => item.acumulador)
}

/** Os acumuladores da ficha com o cartão que define cada um (o dono, para o "Vale em: só a técnica dona"). O primeiro de cada id. */
export function acumuladoresComODono(personagem: Pick<Personagem, 'abas'>): { acumulador: AcumuladorDaFicha; dono: Referencia }[] {
  const achados = new Map<string, { acumulador: AcumuladorDaFicha; dono: Referencia }>()
  const ler = (cartao: CartaoDaFicha): void => {
    if (cartao.acumulador !== undefined) {
      const lido = lerAcumulador(cartao.acumulador).acumulador
      if (lido !== null && !achados.has(lido.id)) achados.set(lido.id, { acumulador: lido, dono: { id: cartao.id, nome: cartao.nome } })
    }
    cartao.subcartoes.forEach(ler)
  }
  for (const cartoes of Object.values(personagem.abas)) cartoes.forEach(ler)
  return [...achados.values()]
}

/** O "Vale em" na forma do bônus (`ParteDoBonus.soEm`): todo golpe = nada. "Só a técnica dona" = o cartão do medidor. */
function soEmDoValeEm(valeEm: ValeEmDoAcumulador | undefined, dono: Referencia | undefined): SoEmDoBonus | undefined {
  switch (valeEm?.em) {
    case undefined:
    case 'todo':
      return undefined
    case 'tecnicas':
      return { tecnicas: valeEm.tecnicas }
    case 'fisicos':
      return { fisicos: true }
    case 'tiros':
      return { tiros: true }
    case 'dona':
      // Sem o dono conhecido (quem chama sem `donos`), não soma em golpe nenhum: nunca em todos por engano.
      return { tecnicas: dono === undefined ? [] : [dono] }
  }
}

/**
 * REQUISITOS C: o acumulador que o "Carregar" sobe (a regra "sobe ao gastar a reação"; a Polaridade do
 * Vagn no motor genérico), com o cartão que o define (o pedido `contador` o aponta por ele). O
 * primeiro da ficha; nenhum = `null`.
 */
export function acumuladorQueCarrega(personagem: Pick<Personagem, 'abas'>): { cartao: CartaoDaFicha; acumulador: AcumuladorDaFicha } | null {
  const achar = (cartao: CartaoDaFicha): { cartao: CartaoDaFicha; acumulador: AcumuladorDaFicha } | null => {
    const lido = cartao.acumulador === undefined ? null : lerAcumulador(cartao.acumulador).acumulador
    if (lido !== null && lido.sobe.some((regra) => regra.quando === 'gastaReacao')) return { cartao, acumulador: lido }
    for (const sub of cartao.subcartoes) {
      const doSub = achar(sub)
      if (doSub !== null) return doSub
    }
    return null
  }
  for (const cartoes of Object.values(personagem.abas)) {
    for (const cartao of cartoes) {
      const achado = achar(cartao)
      if (achado !== null) return achado
    }
  }
  return null
}

/** A definição que a referência aponta: pelo id; senão pelo nome (o bloco veio do catálogo). */
export function acumuladorDaReferencia(definicoes: readonly AcumuladorDaFicha[], ref: Referencia): AcumuladorDaFicha | null {
  const id = ref.id
  return (id === undefined ? undefined : definicoes.find((def) => def.id === id)) ?? definicoes.find((def) => mesmaReferencia({ nome: def.nome }, { nome: ref.nome })) ?? null
}

/** O nível de agora (fora do mapa = 0). */
export function nivelDoAcumulador(combate: CombateDoPersonagem | undefined, acumuladorId: string): number {
  const niveis = combate?.acumuladores
  return niveis !== undefined && Object.hasOwn(niveis, acumuladorId) ? (niveis[acumuladorId] ?? 0) : 0
}

/** O combate com o nível somado de `delta`, entre 0 e o máximo; 0 sai do mapa. Nada muda = o MESMO combate. */
export function comNivelSomado(combate: CombateDoPersonagem, acumulador: Pick<AcumuladorDaFicha, 'id' | 'maximo'>, delta: number): CombateDoPersonagem {
  const antes = nivelDoAcumulador(combate, acumulador.id)
  const depois = Math.min(acumulador.maximo, Math.max(0, antes + Math.trunc(delta)))
  if (depois === antes) return combate
  const { [acumulador.id]: _fora, ...outros } = combate.acumuladores ?? {}
  const niveis = depois === 0 ? outros : { ...outros, [acumulador.id]: depois }
  const { acumuladores: _niveis, ...resto } = combate
  return Object.keys(niveis).length === 0 ? resto : { ...resto, acumuladores: niveis }
}

/** O acumulador foi usado (subiu por gatilho ou foi gasto) na rodada `rodada`: a queda "por rodada sem uso" não o pega nesta virada. */
function comUso(combate: CombateDoPersonagem, acumuladorId: string, rodada: number | undefined): CombateDoPersonagem {
  if (rodada === undefined || combate.acumuladoresUsados?.[acumuladorId] === rodada) return combate
  return { ...combate, acumuladoresUsados: { ...(combate.acumuladoresUsados ?? {}), [acumuladorId]: rodada } }
}

/** Quanto o evento sobe (as regras de subir) menos quanto desce (as de cair) num acumulador. "tudo" = o nível inteiro. */
function deltaDoEvento(acumulador: AcumuladorDaFicha, nivel: number, evento: EventoDoAcumulador): number {
  let delta = 0
  for (const regra of acumulador.sobe) {
    if (regra.quando === 'usaTecnica') {
      // Fase ED4: o "+N ao usar" sobe no uso; o "+N se acertar", quando o golpe da técnica acerta.
      const espera = regra.seAcertar === true ? 'acertaComTecnica' : 'usaTecnica'
      if ((evento.quando === 'usaTecnica' || evento.quando === 'acertaComTecnica') && evento.quando === espera && mesmaReferencia(regra.tecnica, evento.tecnica)) delta += regra.quanto
      continue
    }
    if (regra.quando !== evento.quando) continue
    if (regra.quando === 'gastaSp') {
      // "Sobe 1 a cada 10 SP gastos": só os inteiros (25 SP = 2 vezes); o resto não guarda.
      if (evento.quando !== 'gastaSp' || !(regra.cada > 0)) continue
      delta += Math.floor(evento.sp / regra.cada) * regra.quanto
      continue
    }
    delta += regra.quanto
  }
  for (const regra of acumulador.desce) {
    if (evento.quando !== 'apanha' || regra.quando !== 'apanha') continue
    delta -= regra.quanto === 'tudo' ? nivel + Math.max(0, delta) : regra.quanto
  }
  return delta
}

/**
 * O combate com as regras de todos os acumuladores da ficha aplicadas ao evento. `rodada` marca o
 * uso de quem mudou (a queda por rodada sem uso lê); ausente = não marca. Nada muda = o MESMO combate.
 */
export function comOEventoNosAcumuladores(combate: CombateDoPersonagem, definicoes: readonly AcumuladorDaFicha[], evento: EventoDoAcumulador, rodada?: number): CombateDoPersonagem {
  let volta = combate
  for (const acumulador of definicoes) {
    const delta = deltaDoEvento(acumulador, nivelDoAcumulador(volta, acumulador.id), evento)
    if (delta === 0) continue
    const mudado = comNivelSomado(volta, acumulador, delta)
    if (mudado !== volta) volta = comUso(mudado, acumulador.id, rodada)
  }
  return volta
}

/**
 * O gasto do requisito A4 ("Polaridade 2 ou mais, gasta 2"): o nível desce `n` (nunca abaixo de 0) e
 * conta como uso na `rodada`. Sem a definição na ficha = o mesmo combate (nada a gastar).
 */
export function comGastoNoAcumulador(combate: CombateDoPersonagem, definicoes: readonly AcumuladorDaFicha[], ref: Referencia, n: number, rodada?: number): CombateDoPersonagem {
  const acumulador = acumuladorDaReferencia(definicoes, ref)
  if (acumulador === null || !(n > 0)) return combate
  const mudado = comNivelSomado(combate, acumulador, -n)
  return mudado === combate ? combate : comUso(mudado, acumulador.id, rodada)
}

/**
 * A virada da rodada: cada acumulador com a regra "cai N por rodada sem uso" que não mudou por uso
 * na rodada que acabou (`rodadaQueAcabou`) desce N. Nada a mudar = o MESMO combate.
 */
export function comARodadaSemUso(combate: CombateDoPersonagem, definicoes: readonly AcumuladorDaFicha[], rodadaQueAcabou: number): CombateDoPersonagem {
  let volta = combate
  for (const acumulador of definicoes) {
    const nivel = nivelDoAcumulador(volta, acumulador.id)
    if (nivel === 0 || combate.acumuladoresUsados?.[acumulador.id] === rodadaQueAcabou) continue
    const cai = acumulador.desce.reduce((soma, regra) => (regra.quando === 'rodadaSemUso' ? soma + regra.quanto : soma), 0)
    if (cai > 0) volta = comNivelSomado(volta, acumulador, -cai)
  }
  return volta
}

/**
 * O começo de uma vez (a store chama na linha "Vez", que guarda o combate de antes e de depois): na
 * virada (`rodadaQueAcabou` não `null`), a queda por rodada sem uso de todos; depois, o "sobe no começo
 * da vez" de quem entra (`entra`, o personagem da carta). Nada muda = o MESMO mapa.
 */
export function combatesNoComecoDaVez(turnos: Pick<TurnosDaCena, 'combate' | 'rodada'>, personagens: readonly Pick<Personagem, 'id' | 'abas'>[], entra: string | null, rodadaQueAcabou: number | null): TurnosDaCena['combate'] {
  let combates = turnos.combate
  const definicoes = new Map<string, AcumuladorDaFicha[]>()
  const deQuem = (personagemId: string): AcumuladorDaFicha[] => {
    const achadas = definicoes.get(personagemId)
    if (achadas !== undefined) return achadas
    const personagem = personagens.find((candidato) => candidato.id === personagemId)
    const lidas = personagem === undefined ? [] : acumuladoresDoPersonagem(personagem)
    definicoes.set(personagemId, lidas)
    return lidas
  }
  const trocar = (personagemId: string, depois: CombateDoPersonagem, antes: CombateDoPersonagem | undefined): void => {
    if (depois !== antes) combates = { ...(combates ?? {}), [personagemId]: depois }
  }
  if (rodadaQueAcabou !== null) {
    for (const [personagemId, combate] of Object.entries(combates ?? {})) {
      if (combate.acumuladores === undefined) continue
      trocar(personagemId, comARodadaSemUso(combate, deQuem(personagemId), rodadaQueAcabou), combate)
    }
  }
  if (entra !== null) {
    const daFicha = deQuem(entra)
    const base = combates?.[entra] ?? combateVazio()
    if (daFicha.length > 0) trocar(entra, comOEventoNosAcumuladores(base, daFicha, { quando: 'comecoDaVez' }, turnos.rodada), base)
  }
  return combates
}

/**
 * Fase ED4: o combate de quem entra na batalha com o nível de começo de cada acumulador ("começa a
 * batalha em N"); o acumulador que já tem nível fica como está. Sem nenhum = o MESMO combate.
 */
export function combateNoComecoDaBatalha(combate: CombateDoPersonagem, definicoes: readonly Pick<AcumuladorDaFicha, 'id' | 'maximo' | 'inicial'>[]): CombateDoPersonagem {
  let volta = combate
  for (const acumulador of definicoes) {
    const inicial = acumulador.inicial ?? 0
    if (inicial > 0 && nivelDoAcumulador(volta, acumulador.id) === 0) volta = comNivelSomado(volta, acumulador, inicial)
  }
  return volta
}

/** Fase ED4: o Iniciar põe o nível de começo dos acumuladores de cada ficha da ordem. Sem nenhum = o MESMO mapa. */
export function combatesNoComecoDaBatalha(turnos: Pick<TurnosDaCena, 'cartas' | 'combate'>, personagens: readonly Pick<Personagem, 'id' | 'abas'>[]): TurnosDaCena['combate'] {
  let combates = turnos.combate
  const vistos = new Set<string>()
  for (const carta of turnos.cartas) {
    const personagemId = carta.personagemId
    if (personagemId === null || vistos.has(personagemId)) continue
    vistos.add(personagemId)
    const personagem = personagens.find((candidato) => candidato.id === personagemId)
    if (personagem === undefined) continue
    const base = combates?.[personagemId] ?? combateVazio()
    const depois = combateNoComecoDaBatalha(base, acumuladoresDoPersonagem(personagem))
    if (depois !== base) combates = { ...(combates ?? {}), [personagemId]: depois }
  }
  return combates
}

/** O valor do ganho no nível (0 = nada). `cada` x o nível; ou o total da lista (`niveis[0]` = nível 1; acima do tamanho, o último). */
export function valorDoGanho(ganho: GanhoDoAcumulador | { ganho: 'naoLido' }, nivel: number): number {
  if (nivel <= 0 || ganho.ganho === 'nada' || ganho.ganho === 'naoLido') return 0
  if (ganho.cada !== undefined) return ganho.cada * nivel
  const lista = ganho.niveis
  return lista[Math.min(nivel, lista.length) - 1] ?? 0
}

/**
 * O que os níveis de agora dão, no formato do bônus da batalha (`bonusDaBatalha`, por alvo: `dano`
 * ou o id do atributo), com o nome e o nível ("Polaridade 2"). O golpe lê o bônus ANTES de a linha
 * gastar o acumulador: o golpe que gasta sai com a carga (decisão do dono de 23/11).
 */
export function bonusDosAcumuladores(definicoes: readonly AcumuladorDaFicha[], combate: CombateDoPersonagem | undefined, donos?: ReadonlyMap<string, Referencia>): BonusDaBatalha {
  const porAlvo = new Map<string, ParteDoBonus[]>()
  for (const acumulador of definicoes) {
    const nivel = nivelDoAcumulador(combate, acumulador.id)
    if (nivel <= 0) continue
    // Uma parte por alvo e por acumulador ("+25 (Polaridade 2)"), somando o ganho de todo nível e o do marco.
    const doAcumulador = new Map<string, number>()
    const somar = (alvo: string | undefined, n: number): void => {
      if (alvo !== undefined && n !== 0) doAcumulador.set(alvo, (doAcumulador.get(alvo) ?? 0) + n)
    }
    const { ganho } = acumulador
    // O "Igual em todo nível: +N" (a regra antiga "cada nível +10") ou o valor por nível.
    const valor = valorDoGanho(ganho, nivel)
    if (ganho.ganho === 'dano') somar(ALVO_DO_DANO, valor)
    else if (ganho.ganho === 'atributo') somar(ganho.atributo.id, valor)
    // Pedido de 28/11/2026: o que os marcos dão no nível de agora (o maior até ele, ou todos com "soma os níveis de baixo").
    const doMarco = ganhoDosMarcos(acumulador, nivel)
    somar(ALVO_DO_DANO, doMarco.dano)
    for (const [alvo, n] of doMarco.atributos) somar(alvo, n)
    // O "Vale em" (28/11/2026) só no dano: os atributos são da ficha, não do golpe.
    const soEm = soEmDoValeEm(acumulador.valeEm, donos?.get(acumulador.id))
    for (const [alvo, delta] of doAcumulador) {
      const parte: ParteDoBonus = { nome: `${acumulador.nome} ${nivel}`, delta, ...(alvo === ALVO_DO_DANO && soEm !== undefined ? { soEm } : {}) }
      porAlvo.set(alvo, [...(porAlvo.get(alvo) ?? []), parte])
    }
  }
  return Object.fromEntries(porAlvo)
}

/**
 * Pedido de 28/11/2026 ("por que não posso escolher cada carga?"): o que os marcos dão no `nivel`. Vale o
 * maior marco até o nível de agora; com `somaOsDeBaixo`, todos até ele somam. O atributo sem id fica de fora
 * (o bônus da batalha é por id).
 */
export function ganhoDosMarcos(acumulador: Pick<AcumuladorDaFicha, 'marcos' | 'somaOsDeBaixo'>, nivel: number): { dano: number; atributos: ReadonlyMap<string, number> } {
  const ate = (acumulador.marcos ?? []).filter((marco) => marco.nivel <= nivel)
  const maior = ate.reduce<MarcoDoAcumulador | undefined>((melhor, marco) => (melhor === undefined || marco.nivel > melhor.nivel ? marco : melhor), undefined)
  const valem = acumulador.somaOsDeBaixo === true ? ate : maior === undefined ? [] : [maior]
  const atributos = new Map<string, number>()
  let dano = 0
  for (const marco of valem) {
    dano += marco.dano ?? 0
    for (const { atributo, n } of marco.atributos ?? []) if (atributo.id !== undefined) atributos.set(atributo.id, (atributos.get(atributo.id) ?? 0) + n)
  }
  return { dano, atributos }
}

/** O bônus da batalha com o dos acumuladores somado (sem acumulador com ganho = o MESMO bônus). */
export function comOBonusDosAcumuladores(bonus: BonusDaBatalha | undefined, personagem: Pick<Personagem, 'abas'> | null | undefined, combate: CombateDoPersonagem | undefined): BonusDaBatalha | undefined {
  if (personagem === null || personagem === undefined || combate?.acumuladores === undefined) return bonus
  const comDono = acumuladoresComODono(personagem)
  const dos = bonusDosAcumuladores(
    comDono.map((item) => item.acumulador),
    combate,
    new Map(comDono.map((item) => [item.acumulador.id, item.dono])),
  )
  const alvos = Object.keys(dos)
  if (alvos.length === 0) return bonus
  const somado: Record<string, readonly ParteDoBonus[]> = { ...(bonus ?? {}) }
  for (const alvo of alvos) somado[alvo] = [...(somado[alvo] ?? []), ...(dos[alvo] ?? [])]
  return somado
}

// ─── Rework das habilidades (PLANO.md D9, E5): "zera quando a técnica desliga" ───

/** D9: o acumulador tem a descida "zera quando a técnica desliga" (`DescidaAoDesligar`). */
export function zeraAoDesligar(acumulador: Pick<AcumuladorDaFicha, 'desce'>): boolean {
  return acumulador.desce.some((regra) => regra.quando === 'desliga')
}

/** O cartão `cartaoId` da ficha (abas e subcartões); `null` = não está nela. */
function cartaoNaFicha(personagem: Pick<Personagem, 'abas'>, cartaoId: string): CartaoDaFicha | null {
  const achar = (cartoes: readonly CartaoDaFicha[]): CartaoDaFicha | null => {
    for (const cartao of cartoes) {
      if (cartao.id === cartaoId) return cartao
      const noSub = achar(cartao.subcartoes)
      if (noSub !== null) return noSub
    }
    return null
  }
  for (const cartoes of Object.values(personagem.abas)) {
    const achado = achar(cartoes)
    if (achado !== null) return achado
  }
  return null
}

/**
 * D9 (mecânica 7): a técnica dona `cartaoId` (a "Ligar e manter" que parou ou a forma que desligou)
 * desligou, e o acumulador dela com "zera quando a técnica desliga" volta a 0. Sem acumulador, sem a
 * descida ou já em 0 = o MESMO combate.
 */
export function comADonaDesligada(combate: CombateDoPersonagem, personagem: Pick<Personagem, 'abas'>, cartaoId: string): CombateDoPersonagem {
  const dona = cartaoNaFicha(personagem, cartaoId)
  if (dona === null || dona.acumulador === undefined) return combate
  const lido = lerAcumulador(dona.acumulador).acumulador
  if (lido === null || !zeraAoDesligar(lido)) return combate
  return comNivelSomado(combate, lido, -nivelDoAcumulador(combate, lido.id))
}
