/**
 * A fatia dos SELOS da store da batalha One Piece: o selo que o golpe põe no acerto (e o que renova), os
 * aliados que ele poupa, e o que o mestre põe, edita e tira à mão (`porSelo`, `editarSelo`, `tirarSelo`).
 */
import { NOME_DO_SELO_MAX, type AlvoDoGolpe, type GolpeDaBatalha, type SeloDaBatalha, type SeloDoGolpe } from '../../lib/batalha/combate'
import type { CondicaoPropria } from '../../types/map'
import type { Ajuste } from '../../lib/ajusteDaFicha'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import {
  bonusDaBatalha,
  criarSelo,
  ehNomeDeSelo,
  entradaDoSelo,
  ondeNaVez,
  modsIguais,
  naturezaDosMods,
  novoIdDeSelo,
  pegaOSelo,
  quedaEmNumeros,
  seloComACondicao,
  seloComPilhas,
  seloComQuedaNoToken,
  seloEditado,
  seloPedidoValido,
  textoDoSelo,
  textoDoSeloComMods,
  type EntradaDoSelo,
} from '../../lib/batalha/selos'
import { valorDoRank } from '../../lib/ajusteDaFicha'
import { curaComOsSelos } from '../../lib/batalha/condicoes'
import { ajustesDaCura, ajustesDoDano } from '../../lib/batalha/reacao'
import { ajustesDoRecursoDaCura } from '../../lib/batalha/curaDoRecurso'
import { condicaoDaFabricaDoSelo } from '../../lib/condicoes/fabrica'
import { chaveDaCondicao, type CondicaoMontada, type EfeitoNaVez } from '../../lib/condicoes/modelo'
import { traduzirCondicao } from '../../lib/condicoes/traducao'
import type { AoAcertarDoGolpe } from '../../lib/batalha/aoAcertarDoItem'
import { condicaoDoCatalogo, condicaoDoCatalogoPeloNome } from '../../lib/condicoes/catalogo'
import { condicoesNaFicha, espelhoNaHora, porCondicoesDoAcerto, tirarDaFichaPeloEspelho } from './condicoesNaFicha'
import { aliadosNaLuta, quemLutaPeloDono } from '../../lib/batalha/equipes'
import { quemUsaVence, rolarDisputa, textoDaDisputa } from '../../lib/batalha/disputa'
import { disputaNoAcerto, seloPegaNoAlvo } from '../../lib/batalha/mecanicasAMao'
import { TEXTO_DO_ALVO_SEM_FICHA } from '../../lib/batalha/disputaNoUso'
import { disputaDoTesteDoSelo } from '../../lib/batalha/mecanica/teste'
import { novoIdDeLinha, type Reversao } from '../../lib/batalha/registro'
import { selosQueALimpezaTira } from '../../lib/batalha/debuffs'
import type { AutorDaAcao, TurnosDaCena } from '../../lib/batalha/turnos'
import type { Personagem } from '../../lib/personagem'
import type { BatalhaState } from './tipos'
import { comMudanca, MESTRE, type EfeitoNovo, nomeDoTokenNa, quemNaFicha } from './cena'
import { mexerNaFicha, reversaoDaFicha, tirarPastilhasNaMesa } from './naMesa'
import type { NucleoDaBatalha } from './nucleo'

/** Um efeito "selo" por selo que acabou ("ATORDOADO ACABOU"). */
export function efeitosDosSelos(acabaram: readonly SeloDaBatalha[]): EfeitoNovo[] {
  return acabaram.map((selo): EfeitoNovo => ({ tipo: 'selo', tokenId: selo.tokenId, nome: selo.nome, acabou: true }))
}

// ─── Rework das condições (PLANO.md D2, D4, D7, E3): o selo congela a condição ao nascer ───

/** D2: a condição montada que o selo de nome `nome` põe (o catálogo pelo nome, com a precedência de D5; senão a de fábrica pela tolerância do selo, "Atordoado 2"); `null` = selo comum. */
function condicaoDoSelo(nome: string, criadas: readonly CondicaoPropria[]): CondicaoMontada | null {
  return condicaoDoCatalogoPeloNome(nome, criadas)?.montada ?? condicaoDaFabricaDoSelo(nome)
}

/** A condição traduzida para o selo `pedido` (o nome e os turnos dele), com as pilhas e quem pôs (a Marca "só de quem pôs"). */
function traducaoDaCondicao(condicao: CondicaoMontada, pedido: Pick<SeloDoGolpe, 'nome' | 'turnos'>, criadas: readonly CondicaoPropria[], pilhas: number | undefined, quemPos: string | null): SeloDoGolpe {
  return traduzirCondicao(condicao, {
    turnos: pedido.turnos,
    nome: pedido.nome,
    nomeDoId: (id) => condicaoDoCatalogo(id, criadas)?.nome ?? null,
    ...(pilhas === undefined ? {} : { pilhas }),
    ...(quemPos === null ? {} : { quemPos: { personagemId: quemPos } }),
  })
}

/**
 * D2 (congela ao nascer): o pedido com a regra da condição dele traduzida (D4: o número próprio do pedido
 * vence, campo a campo). Selo comum, ou que já traz a regra: o MESMO pedido. `quemPos` = o personagem que
 * pôs (a Marca "só de quem pôs"); `null` = o mestre.
 */
export function pedidoComACondicao(pedido: SeloDoGolpe, criadas: readonly CondicaoPropria[], quemPos: string | null): SeloDoGolpe {
  if (pedido.regras !== undefined) return pedido
  const condicao = condicaoDoSelo(pedido.nome, criadas)
  return condicao === null ? pedido : seloComACondicao(pedido, traducaoDaCondicao(condicao, pedido, criadas, pedido.pilhas, quemPos))
}

/**
 * PENDENCIAS do rework, nº 6: TODO selo que a store cria nasce por aqui (`criarSelo` com `pedidoComACondicao`),
 * para o que tem nome de condição congelar a regra dela (D2) por qualquer caminho: o "Pôr selo", o golpe, a
 * passiva, o gatilho, a preparação, o contador, o "Ajustar" e o cansaço. Nome que não é condição = o selo de sempre.
 */
export function criarSeloComACondicao(tokenId: string, pedido: SeloDoGolpe, onde: Parameters<typeof criarSelo>[2], criadas: readonly CondicaoPropria[], quemPos: string | null): SeloDaBatalha {
  return criarSelo(tokenId, pedidoComACondicao(pedido, criadas, quemPos), onde)
}

/** D7: o selo de antes com `pilhas` pilhas, pela condição dele achada de novo (o `condId` congelado; sem ele, pelo nome). */
function comPilhasDaMesa(criadas: readonly CondicaoPropria[]): (antes: SeloDaBatalha, pilhas: number) => SeloDaBatalha {
  return (antes, pilhas) => {
    const condId = antes.regras?.condId
    const condicao = condId === undefined ? condicaoDoSelo(antes.nome, criadas) : (condicaoDoCatalogo(condId, criadas)?.montada ?? null)
    if (condicao === null) return { ...antes, pilhas }
    const quemPos = antes.marcaDe ?? null
    return seloComPilhas(antes, pilhas, traducaoDaCondicao(condicao, antes, criadas, antes.pilhas ?? 1, quemPos), traducaoDaCondicao(condicao, antes, criadas, pilhas, quemPos))
  }
}

/** A entrada do selo como a store a grava: os selos de agora e a parte do Desfazer (o selo novo e os que o contra apagou, ou o de antes renovado). Não entrou = `null`. */
function selosDaEntrada(entrada: EntradaDoSelo): { selos: SeloDaBatalha[]; parte: Reversao } | null {
  switch (entrada.tipo) {
    case 'entrou': {
      const doSelo: Reversao = { tipo: 'selo', seloId: entrada.selo.id, antes: null }
      const apagados = entrada.apagados.map((apagado): Reversao => ({ tipo: 'selo', seloId: apagado.id, antes: apagado }))
      return { selos: entrada.selos, parte: apagados.length === 0 ? doSelo : { tipo: 'composta', partes: [doSelo, ...apagados] } }
    }
    case 'renovou':
    case 'pilha':
      return { selos: entrada.selos, parte: { tipo: 'selo', seloId: entrada.antes.id, antes: entrada.antes, editado: true } }
    default:
      return null
  }
}

/** O ajuste da ficha de um Efeito na vez "ao entrar" (fixo); `null` = o motor ainda não o faz ao entrar (tirar SP ou Escudo: E5). */
function ajusteAoEntrar(efeito: EfeitoNaVez, selos: readonly SeloDaBatalha[], tokenId: string): { ajustes: (atual: Personagem, sistema: SistemaDeRpg) => readonly Ajuste[]; texto: string } | null {
  if (efeito.faz === 'da' && efeito.recurso === 'vida') {
    const cura = curaComOsSelos(efeito.v, selos, tokenId)
    return { ajustes: (atual, sistema) => ajustesDaCura(atual, sistema, cura), texto: `+${cura} HP` }
  }
  if (efeito.faz === 'da') {
    const recurso = efeito.recurso === 'sp' ? 'sp' : 'escudo'
    return { ajustes: (atual, sistema) => ajustesDoRecursoDaCura(atual, sistema, recurso, efeito.v), texto: `+${efeito.v} ${recurso === 'sp' ? 'SP' : 'de Escudo'}` }
  }
  if (efeito.recurso === 'vida') return { ajustes: (atual, sistema) => ajustesDoDano(atual, sistema, efeito.v, efeito.direto === true), texto: `-${efeito.v} HP` }
  return null
}

/**
 * Q6: o selo do golpe no alvo que ele ACERTOU (resolvido com saída que pega). Sem selo, sem acerto, barrado,
 * igual ou no teto: `null`. `fixarQueda` = a queda em % em números com o atributo do alvo (D10), depois da
 * condição traduzida (a queda em % do Enfraquecido vem dela).
 */
function seloDoGolpe(turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe, criadas: readonly CondicaoPropria[], fixarQueda: (pedido: SeloDoGolpe) => SeloDoGolpe): { selos: SeloDaBatalha[]; parte: Reversao } | null {
  // Fase 5 (B16): quem passou no teste da Explosão toma metade, mas o selo não pega.
  if (golpe.selo === undefined || alvo.saida === undefined || !pegaOSelo(alvo.saida) || alvo.passouNoTeste === true) return null
  // Rework das condições (D2): o selo leva a regra da condição congelada (a de fábrica ou a criada da mesa).
  const pedido = fixarQueda(pedidoComACondicao(golpe.selo, criadas, golpe.atacantePersonagemId))
  // Rework das habilidades (PLANO.md D10, decisão 12): o Diminui atributo que o alvo já tem desta técnica só recomeça o prazo (não soma outra queda).
  const comQueda = seloComQuedaNoToken(turnos.selos, alvo.tokenId, pedido)
  if (comQueda !== undefined) {
    const depois: SeloDaBatalha = { ...comQueda, turnos: pedido.turnos, total: pedido.turnos }
    return { selos: (turnos.selos ?? []).map((selo) => (selo.id === comQueda.id ? depois : selo)), parte: { tipo: 'selo', seloId: comQueda.id, antes: comQueda, editado: true } }
  }
  // Rework das condições ("ao entrar"): a Contra-condição, o "se ganhar de novo" (o Queimando renova, o Envenenado soma pilha) e o teto.
  const selo = criarSelo(alvo.tokenId, pedido, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: golpe.nome })
  return selosDaEntrada(entradaDoSelo(turnos.selos, selo, { comPilhas: comPilhasDaMesa(criadas) }))
}

/**
 * E6c: as condições do acerto do item como selos da batalha (a mesa sem condição na ficha, o token sem
 * ficha): os turnos da duração ("até o fim da batalha" = sem turnos, sai com ela), a vida por vez da de
 * regra `vida` e o corte da de regra `cura`, pelo catálogo de fábrica.
 */
function selosDasCondicoesDoAcerto(aoAcertar: Pick<AoAcertarDoGolpe, 'condicoes'>): SeloDoGolpe[] {
  return aoAcertar.condicoes.flatMap((condicao): SeloDoGolpe[] => {
    const pedido: SeloDoGolpe = { nome: condicao.nome, turnos: typeof condicao.duracao === 'number' ? condicao.duracao : null, natureza: 'debuff' }
    // Rework das condições (D4): só o número próprio da peça do item vai no pedido; a regra da condição vem da tradução (`seloDoGolpe`).
    const doCatalogo = condicao.n === undefined ? null : condicaoDoCatalogoPeloNome(condicao.nome, [])
    const n = condicao.n ?? 0
    if (doCatalogo?.regra === 'vida' && n > 0) pedido.porVez = n
    if (doCatalogo?.regra === 'cura' && n > 0) pedido.regra = { curaRecebida: -n }
    return ehNomeDeSelo(pedido.nome) ? [pedido] : []
  })
}

/** Os selos presos ao núcleo da store. */
export function criarSelos(nucleo: NucleoDaBatalha) {
  const { mesa, deps, mesaDoRpg, cenaDe, gravarCena } = nucleo
  /** D2: as condições criadas da mesa (a de fábrica vale em toda mesa; o treino e a Arena não têm criadas). */
  const criadas = (): readonly CondicaoPropria[] => mesa.condicoesCriadas?.() ?? []

  /**
   * "Ao entrar" (E3): os Efeitos na vez da condição que valem quando o selo entra (Protegido: +30 de Escudo), na
   * ficha de quem o recebeu, com o Desfazer junto. A ficha que não grava fica sem (o selo já entrou).
   */
  const efeitosAoEntrar = (selo: SeloDaBatalha, personagemId: string | null, quem: string, selos: readonly SeloDaBatalha[]): { partes: Reversao[]; notas: string[] } => {
    const partes: Reversao[] = []
    const notas: string[] = []
    if (personagemId === null) return { partes, notas }
    for (const efeito of selo.regras?.vez ?? []) {
      if (efeito.quando !== 'entrar' || efeito.conta !== 'fixo' || efeito.v <= 0) continue
      const ajuste = ajusteAoEntrar(efeito, selos, selo.tokenId)
      const feitas = ajuste === null ? null : mexerNaFicha(mesa, personagemId, ajuste.ajustes, quem)
      if (ajuste === null || feitas === null || feitas === 'recusada') continue
      partes.push(...reversaoDaFicha(personagemId, feitas))
      notas.push(`${selo.nome}: ${ajuste.texto}`)
    }
    return { partes, notas }
  }

  /** Os selos que acabaram de entrar no token (os ids que `antes` não tinha). */
  const entraramNoToken = (antes: readonly SeloDaBatalha[] | undefined, depois: readonly SeloDaBatalha[], tokenId: string): SeloDaBatalha[] => {
    const eram = new Set((antes ?? []).map((selo) => selo.id))
    return depois.filter((selo) => selo.tokenId === tokenId && !eram.has(selo.id))
  }

  /**
   * Rework das condições (D2, "ao entrar"): o selo que a store põe direto numa ficha (o "em quem usa" da técnica, o
   * da reação em quem atacou), pelo mesmo caminho do selo do golpe: a condição do nome congelada (D4: os números do
   * pedido vencem), a queda em % em números com o atributo de quem leva, a Contra-condição, o "se ganhar de novo",
   * as pilhas e o Efeito na vez "ao entrar". `quemPos` = o personagem que pôs (a Marca "só de quem pôs").
   * Barrado, igual ou no teto = `null` (nada muda); `notas` = o que o "ao entrar" fez, para a linha.
   */
  const seloPostoNaFicha = (
    turnos: TurnosDaCena,
    onde: { tokenId: string; personagemId: string | null },
    pedido: SeloDoGolpe,
    quem: { autor: AutorDaAcao; quemPos: string | null; origem?: string },
  ): { selos: SeloDaBatalha[]; parte: Reversao; notas: string[] } | null => {
    const dele = onde.personagemId === null ? undefined : mesaDoRpg().personagens.find((candidato) => candidato.id === onde.personagemId)
    const resolvido = quedaEmNumeros(pedidoComACondicao(pedido, criadas(), quem.quemPos), (atributo) => (dele === undefined ? 0 : valorDoRank(dele, atributo)))
    const selo = criarSelo(onde.tokenId, resolvido, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), ...(quem.origem === undefined ? {} : { origem: quem.origem }) })
    const entrada = entradaDoSelo(turnos.selos, selo, { comPilhas: comPilhasDaMesa(criadas()) })
    const gravada = selosDaEntrada(entrada)
    if (gravada === null) return null
    const aoEntrar = entrada.tipo === 'entrou' ? efeitosAoEntrar(selo, onde.personagemId, quemNaFicha(quem.autor), gravada.selos) : { partes: [], notas: [] }
    return { selos: gravada.selos, parte: aoEntrar.partes.length === 0 ? gravada.parte : { tipo: 'composta', partes: [gravada.parte, ...aoEntrar.partes] }, notas: aoEntrar.notas }
  }

  /**
   * F2 (fatia B): o selo do golpe no alvo acertado, com a disputa da mecânica
   * à mão (Corta Cenoura: d20 + FOR com vantagem contra d20 + RES do alvo): o
   * app rola e o selo só pega se quem usou vencer. O resultado vai no alvo
   * (`disputa`) para a linha do golpe. Sem disputa: o selo de sempre.
   */
  const seloNoAcerto = (sceneKey: string, turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: ReturnType<typeof seloDoGolpe>; alvo: AlvoDoGolpe } => {
    const dosSelos = selosNoAcerto(turnos, golpe, alvo)
    // ITENS REFEITOS, E6c: depois dos selos, o "Ao acertar" do item (a condição na ficha, o empurrão), com o Desfazer junto.
    const doItem = itemNoAcerto(sceneKey, dosSelos.selado === null ? turnos : { ...turnos, selos: dosSelos.selado.selos }, golpe, dosSelos.alvo)
    const juntos: { selado: { selos: SeloDaBatalha[]; parte: Reversao } | null; alvo: AlvoDoGolpe } =
      doItem === null ? dosSelos : { selado: dosSelos.selado === null ? doItem.selado : { selos: doItem.selado.selos, parte: { tipo: 'composta', partes: [dosSelos.selado.parte, doItem.selado.parte] } }, alvo: doItem.alvo }
    if (juntos.selado === null) return juntos
    // Rework das condições ("ao entrar"): o Efeito na vez de cada selo que entrou agora (o Protegido dá o Escudo).
    const { selos, parte } = juntos.selado
    const efeitos = entraramNoToken(turnos.selos, selos, alvo.tokenId).map((selo) => efeitosAoEntrar(selo, alvo.personagemId, quemNaFicha(golpe.autor), selos))
    const partes = efeitos.flatMap((efeito) => efeito.partes)
    if (partes.length === 0) return juntos
    const notas = efeitos.flatMap((efeito) => efeito.notas).join('; ')
    const comNota: AlvoDoGolpe = { ...juntos.alvo, disputa: juntos.alvo.disputa === undefined || juntos.alvo.disputa === '' ? notas : `${juntos.alvo.disputa}; ${notas}` }
    return { selado: { selos, parte: { tipo: 'composta', partes: [parte, ...partes] } }, alvo: comNota }
  }

  /**
   * ITENS REFEITOS, E6c: o "Ao acertar" do item (`golpe.aoAcertar`, a arma e a bala do tiro) no alvo que o
   * golpe ACERTOU. As condições vão para a FICHA dele (o espelho entra na hora); na mesa sem condição na
   * ficha (o treino, a Arena) ou no token sem ficha, viram selo da batalha. O empurrão move o token pela mesa
   * (A5). O texto do alvo na linha do golpe diz o que houve. `null` = nada a fazer.
   */
  const itemNoAcerto = (sceneKey: string, turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: { selos: SeloDaBatalha[]; parte: Reversao }; alvo: AlvoDoGolpe } | null => {
    const aoAcertar = golpe.aoAcertar
    if (aoAcertar === undefined || alvo.saida === undefined || !pegaOSelo(alvo.saida) || alvo.passouNoTeste === true) return null
    let selos: SeloDaBatalha[] = [...(turnos.selos ?? [])]
    const partes: Reversao[] = []
    const notas: string[] = []
    const naFicha = alvo.personagemId === null ? null : porCondicoesDoAcerto(mesa, alvo.personagemId, aoAcertar)
    if (naFicha !== null) {
      partes.push(naFicha.parte)
      notas.push(`${aoAcertar.condicoes.map((condicao) => condicao.nome).join(', ')} na ficha`)
      const espelho = alvo.personagemId === null ? null : espelhoNaHora(mesa, sceneKey, selos, alvo.tokenId, alvo.personagemId, turnos.rodada)
      if (espelho !== null) {
        partes.push(...espelho.partes)
        selos = espelho.selos
      }
    } else if (!condicoesNaFicha(mesa) || alvo.personagemId === null) {
      // O treino, a Arena e o token sem ficha: a condição fica só nesta batalha, como o selo de uma técnica.
      for (const pedido of selosDasCondicoesDoAcerto(aoAcertar)) {
        const feito = seloDoGolpe({ ...turnos, selos }, { ...golpe, nome: aoAcertar.origem, selo: pedido }, alvo, criadas(), (resolvido) => quedaFixadaNoAlvo(resolvido, alvo))
        if (feito === null) continue
        partes.push(feito.parte)
        selos = feito.selos
      }
    }
    const casas = aoAcertar.empurrar ?? 0
    if (casas > 0 && mesa.empurrarToken !== undefined) {
      const empurrao = mesa.empurrarToken(sceneKey, alvo.tokenId, golpe.atacanteTokenId, casas)
      if (empurrao !== null && empurrao.casas > 0) {
        partes.push({ tipo: 'empurrao', tokenId: alvo.tokenId, empurrao })
        notas.push(`empurrado ${empurrao.casas} ${empurrao.casas === 1 ? 'casa' : 'casas'}`)
      } else if (empurrao !== null) notas.push('não tinha para onde ser empurrado')
    }
    if (partes.length === 0 && notas.length === 0) return null
    const texto = notas.join('; ')
    const comTexto: AlvoDoGolpe = texto === '' ? alvo : { ...alvo, disputa: alvo.disputa === undefined || alvo.disputa === '' ? texto : `${alvo.disputa}; ${texto}` }
    return { selado: { selos, parte: { tipo: 'composta', partes } }, alvo: comTexto }
  }

  /** Os selos do golpe (o da mira ou da técnica, o da bala de texto e os a mais) no alvo acertado. */
  const selosNoAcerto = (turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: ReturnType<typeof seloDoGolpe>; alvo: AlvoDoGolpe } => {
    // Rework das habilidades (D10): o selo principal com a queda em % também já vai em números (o mesmo golpe nos outros campos).
    const feito = seloDoGolpeNoAcerto(turnos, golpe.selo?.queda?.emPorcento === true ? { ...golpe, selo: quedaFixadaNoAlvo(golpe.selo, alvo) } : golpe, alvo)
    // F2 (revisão da fatia E, Bala de Prata): o selo da bala pega junto, por cima do da mira, do da técnica e da marca.
    // Fase 5: os selos a mais da técnica montada pegam do mesmo jeito, um depois do outro (cada um com o seu Desfazer).
    // Fase ED4: cada um com o seu teste (`pega`), rolado na ordem dos selos.
    // Rework das habilidades (D10): a queda em % do Diminui atributo vira números com o atributo do alvo agora ("fixado no acerto").
    const extras = [...(golpe.seloDaBala === undefined ? [] : [golpe.seloDaBala]), ...(golpe.selosAMais ?? [])].map((extra) => quedaFixadaNoAlvo(extra, alvo))
    return extras.reduce((ate, extra) => {
      const teste = testeDoSelo(turnos, golpe, extra, ate.alvo)
      if (!teste.pega) return { ...ate, alvo: teste.alvo }
      const mais = seloDoGolpe(ate.selado === null ? turnos : { ...turnos, selos: ate.selado.selos }, { ...golpe, selo: extra }, teste.alvo, criadas(), (resolvido) => quedaFixadaNoAlvo(resolvido, alvo))
      if (mais === null) return { ...ate, alvo: teste.alvo }
      return { alvo: teste.alvo, selado: ate.selado === null ? mais : { selos: mais.selos, parte: { tipo: 'composta', partes: [ate.selado.parte, mais.parte] } } }
    }, feito)
  }

  /** D10: o selo com queda em % já em números, pelo atributo do alvo (o token sem ficha perde 0). Sem queda em %: o MESMO pedido. */
  const quedaFixadaNoAlvo = (pedido: SeloDoGolpe, alvo: AlvoDoGolpe): SeloDoGolpe => {
    if (pedido.queda?.emPorcento !== true) return pedido
    const dele = alvo.personagemId === null ? undefined : mesaDoRpg().personagens.find((candidato) => candidato.id === alvo.personagemId)
    return quedaEmNumeros(pedido, (atributo) => (dele === undefined ? 0 : valorDoRank(dele, atributo)))
  }

  /**
   * Fase ED4: o teste do selo (a peça `pega`, o "com teste" do tipo do golpe). No alvo que o golpe
   * acertou, ele rola d20 + mod do atributo contra a CD de quem usa (`rolarDisputa`, o mesmo dado do
   * teste da técnica, com os selos de cada um); passou, o selo não entra. A rolagem vai no texto do alvo
   * (a linha do golpe: "Resistência: teste 9 + 2 = 11 contra CD 12, Atordoado"); o Desfazer da linha
   * tira o selo junto. Sem teste, sem acerto, ou o alvo que já passou no teste da técnica: nada a rolar.
   */
  const testeDoSelo = (turnos: TurnosDaCena, golpe: GolpeDaBatalha, selo: SeloDoGolpe, alvo: AlvoDoGolpe): { pega: boolean; alvo: AlvoDoGolpe } => {
    const pega = selo.pega
    if (pega === undefined || alvo.saida === undefined || !pegaOSelo(alvo.saida) || alvo.passouNoTeste === true) return { pega: true, alvo }
    const comTexto = (texto: string): AlvoDoGolpe => ({ ...alvo, disputa: alvo.disputa === undefined || alvo.disputa === '' ? texto : `${alvo.disputa}; ${texto}` })
    const { personagens, sistema } = mesaDoRpg()
    const usa = personagens.find((candidato) => candidato.id === golpe.atacantePersonagemId)
    const resiste = personagens.find((candidato) => candidato.id === alvo.personagemId)
    // O alvo sem ficha (token genérico) não rola: o selo entra e a linha avisa, como no teste da técnica montada.
    if (usa === undefined || resiste === undefined || sistema === null) return { pega: true, alvo: comTexto(`${selo.nome}: ${TEXTO_DO_ALVO_SEM_FICHA}`) }
    const deQuemUsa = { personagem: usa, bonus: bonusDaBatalha(turnos.selos, golpe.atacanteTokenId) }
    const doAlvo = { personagem: resiste, bonus: bonusDaBatalha(turnos.selos, alvo.tokenId) }
    const resultado = rolarDisputa(disputaDoTesteDoSelo(pega), { testa: doAlvo, usa: deQuemUsa, resiste: deQuemUsa }, sistema, golpe.carga ?? 0, deps.rolarD20)
    const pegou = quemUsaVence(resultado, 'alvo')
    const atributo = sistema.atributos.find((candidato) => candidato.id === pega.atributoId)?.nome.trim()
    const quem = atributo === undefined || atributo === '' ? pega.atributoId : atributo
    return { pega: pegou, alvo: comTexto(`${quem}: ${textoDaDisputa(resultado)}, ${pegou ? selo.nome : `sem ${selo.nome}`}`) }
  }

  /** O selo principal do golpe no alvo, depois do teste dele (`testeDoSelo`); sem selo = nada. */
  const seloComOTeste = (turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: ReturnType<typeof seloDoGolpe>; alvo: AlvoDoGolpe } => {
    if (golpe.selo === undefined) return { selado: null, alvo }
    const teste = testeDoSelo(turnos, golpe, golpe.selo, alvo)
    return { selado: teste.pega ? seloDoGolpe(turnos, golpe, teste.alvo, criadas(), (resolvido) => quedaFixadaNoAlvo(resolvido, alvo)) : null, alvo: teste.alvo }
  }

  /**
   * U3 (plano de 10/11): os aliados de `personagemId` nesta luta, a regra única de "quem pode ajudar quem" (`aliadosNaLuta`):
   * quem está do lado dele entre as fichas da ordem e os invocados, jogador ou NPC.
   */
  const aliadosNaLutaDe = (personagemId: string | null, turnos: TurnosDaCena, personagens: readonly Personagem[]): Set<string> => {
    const invocados = turnos.invocados ?? []
    return aliadosNaLuta(personagemId, [...turnos.cartas.map((carta) => carta.personagemId), ...invocados.map((invocado) => invocado.personagemId)], { equipes: mesa.equipes(), personagens, invocados: quemLutaPeloDono(turnos) })
  }

  /** O selo do golpe (o da mira ou o da técnica) no alvo que ele acertou, com a disputa da mecânica à mão quando há. */
  const seloDoGolpeNoAcerto = (turnos: TurnosDaCena, golpe: GolpeDaBatalha, alvo: AlvoDoGolpe): { selado: ReturnType<typeof seloDoGolpe>; alvo: AlvoDoGolpe } => {
    const cartaoId = golpe.selo?.cartaoId
    const { personagens, sistema } = mesaDoRpg()
    // F2 (fatia C, A Luz do Sol): o selo só nos aliados de quem usou (no inimigo vai só o dano). U3: os aliados na luta, a mesma lista do golpe.
    if (cartaoId !== undefined && golpe.atacantePersonagemId !== null && !seloPegaNoAlvo(cartaoId, alvo.personagemId, aliadosNaLutaDe(golpe.atacantePersonagemId, turnos, personagens))) return { selado: null, alvo }
    const disputa = cartaoId === undefined || alvo.saida === undefined || !pegaOSelo(alvo.saida) ? null : disputaNoAcerto(cartaoId)
    const usa = personagens.find((candidato) => candidato.id === golpe.atacantePersonagemId)
    const resiste = personagens.find((candidato) => candidato.id === alvo.personagemId)
    if (disputa === null || usa === undefined || resiste === undefined || sistema === null) return seloComOTeste(turnos, golpe, alvo)
    const deQuemUsa = { personagem: usa, bonus: bonusDaBatalha(turnos.selos, golpe.atacanteTokenId) }
    const doAlvo = { personagem: resiste, bonus: bonusDaBatalha(turnos.selos, alvo.tokenId) }
    const quemUsaTesta = disputa.testa === 'quemUsa'
    // F2 (fatia C): a carga gasta no golpe entra na CD (a dança da Aira).
    const resultado = rolarDisputa(disputa, { testa: quemUsaTesta ? deQuemUsa : doAlvo, usa: deQuemUsa, resiste: quemUsaTesta ? doAlvo : deQuemUsa }, sistema, golpe.carga ?? 0, deps.rolarD20)
    // Quando o alvo testa, quem usa vence se o alvo NÃO passou; sem teste (concentração), quem usa vence.
    const venceu = quemUsaVence(resultado, disputa.testa)
    const comTexto: AlvoDoGolpe = { ...alvo, disputa: `${textoDaDisputa(resultado)}, ${venceu ? 'o selo pegou' : 'o selo não pegou'}` }
    return venceu ? seloComOTeste(turnos, golpe, comTexto) : { selado: null, alvo: comTexto }
  }

  /** O selo trocado (`depois`) ou tirado (`null`), com a linha "selo" do mestre. */
  const mudarSelo = (sceneKey: string, seloId: string, depois: SeloDaBatalha | null): boolean => {
    const cena = cenaDe(sceneKey)
    const antes = cena?.turnos.selos?.find((selo) => selo.id === seloId)
    if (cena === undefined || antes === undefined) return false
    const selos = (cena.turnos.selos ?? []).flatMap((selo) => (selo.id !== seloId ? [selo] : depois === null ? [] : [depois]))
    const { personagens, sistema } = mesaDoRpg()
    const nome = nomeDoTokenNa(cena.turnos, personagens)(antes.tokenId)
    const texto = depois === null ? `Mestre tirou ${textoDoSelo(antes)} de ${nome}` : `Mestre: ${textoDoSeloComMods(antes, sistema)} → ${textoDoSeloComMods(depois, sistema)} em ${nome}`
    const doSelo: Reversao = depois === null ? { tipo: 'selo', seloId, antes } : { tipo: 'selo', seloId, antes, editado: true }
    // Nº 3 do levantamento: tirar o espelho tira a pastilha dele (e o prazo) da ficha do mapa; senão a vez seguinte o poria de volta.
    const daFicha = depois === null && antes.daPastilha === true ? tirarPastilhasNaMesa(mesa, sceneKey, antes.tokenId, [antes.nome]) : null
    // ITENS REFEITOS, E6c: o espelho de uma condição da FICHA de personagem: ela sai da ficha também.
    const personagemId = cena.turnos.cartas.find((carta) => carta.tokenId === antes.tokenId)?.personagemId ?? null
    const daPersonagem = depois === null && antes.daPastilha === true && personagemId !== null ? tirarDaFichaPeloEspelho(mesa, personagemId, antes.nome) : null
    const partes = [doSelo, ...(daFicha === null ? [] : [daFicha]), ...(daPersonagem === null ? [] : [daPersonagem.parte])]
    const reversao: Reversao = partes.length === 1 ? doSelo : { tipo: 'composta', partes }
    gravarCena(sceneKey, comMudanca(cena, { ...cena.turnos, selos }, { tipo: 'selo', texto, tokenIds: [antes.tokenId], reversao }))
    return true
  }

  const acoes: Pick<BatalhaState, 'porSelo' | 'editarSelo' | 'tirarSelo' | 'tirarSelosPeloUso' | 'renomearSelos'> = {
    renomearSelos: (de, para) => {
      const chave = chaveDaCondicao(de)
      const nome = para.trim().slice(0, NOME_DO_SELO_MAX)
      if (chave === '' || nome === '' || chave === chaveDaCondicao(nome)) return 0
      let trocados = 0
      for (const [sceneKey, cena] of Object.entries(nucleo.get().cenas)) {
        const antes = cena.turnos.selos ?? []
        const deles = antes.filter((selo) => chaveDaCondicao(selo.nome) === chave).length
        if (deles === 0) continue
        trocados += deles
        const selos = antes.map((selo) => (chaveDaCondicao(selo.nome) === chave ? { ...selo, nome } : selo))
        // `turnosRev`: o host refaz o `batalha.estado`, e o jogador vê o nome novo na faixa.
        gravarCena(sceneKey, { ...cena, turnos: { ...cena.turnos, selos }, turnosRev: cena.turnosRev + 1 })
      }
      return trocados
    },

    porSelo: (sceneKey, tokenId, pedido) => {
      const cena = cenaDe(sceneKey)
      const { personagens, sistema } = mesaDoRpg()
      const selo = seloPedidoValido(pedido, sistema)
      if (cena === undefined || selo === null || !cena.turnos.cartas.some((carta) => carta.tokenId === tokenId)) return false
      const { turnos } = cena
      // Tipos de habilidade F2: a cor do selo à mão vem do sinal dos mods ("Reação +3" = buff).
      // Rework das condições (D2): a condição do nome (a de fábrica ou a criada) vai congelada no selo; os mods digitados vencem (D4).
      const personagemId = turnos.cartas.find((carta) => carta.tokenId === tokenId)?.personagemId ?? null
      // D10: a queda em % da condição (Enfraquecido) em números com o atributo de quem leva (o token sem ficha perde 0).
      const dele = personagemId === null ? undefined : personagens.find((candidato) => candidato.id === personagemId)
      const pedidoComRegra = quedaEmNumeros(pedidoComACondicao({ ...selo, natureza: naturezaDosMods(selo.mods) }, criadas(), null), (atributo) => (dele === undefined ? 0 : valorDoRank(dele, atributo)))
      const novo = criarSelo(tokenId, pedidoComRegra, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos) })
      // "Ao entrar": a Contra-condição, o "se ganhar de novo" e as pilhas; barrado, igual ou no teto = nada muda.
      const entrada = entradaDoSelo(turnos.selos, novo, { comPilhas: comPilhasDaMesa(criadas()) })
      const gravada = selosDaEntrada(entrada)
      if (gravada === null) return false
      const nome = nomeDoTokenNa(turnos, personagens)(tokenId)
      const apagados = entrada.tipo === 'entrou' && entrada.apagados.length > 0 ? ` (tirou ${entrada.apagados.map((apagado) => apagado.nome).join(', ')})` : ''
      const aoEntrar = entrada.tipo === 'entrou' ? efeitosAoEntrar(novo, personagemId, quemNaFicha(MESTRE), gravada.selos) : { partes: [], notas: [] }
      const notas = aoEntrar.notas.length === 0 ? '' : ` · ${aoEntrar.notas.join('; ')}`
      const texto =
        entrada.tipo === 'renovou'
          ? `Mestre renovou ${textoDoSelo(entrada.depois)} em ${nome}`
          : entrada.tipo === 'pilha'
            ? `Mestre pôs mais ${novo.nome} em ${nome} (${entrada.depois.pilhas ?? 1} pilhas)`
            : `Mestre pôs ${textoDoSeloComMods(novo, sistema)} em ${nome}${apagados}${notas}`
      const reversao: Reversao = aoEntrar.partes.length === 0 ? gravada.parte : { tipo: 'composta', partes: [gravada.parte, ...aoEntrar.partes] }
      gravarCena(sceneKey, comMudanca(cena, { ...turnos, selos: gravada.selos }, { tipo: 'selo', texto, tokenIds: [tokenId], reversao }))
      return true
    },

    editarSelo: (sceneKey, seloId, pedido) => {
      const selo = seloPedidoValido(pedido, mesaDoRpg().sistema)
      const antes = cenaDe(sceneKey)?.turnos.selos?.find((candidato) => candidato.id === seloId)
      if (selo === null || antes === undefined) return false
      if (antes.nome === selo.nome && antes.turnos === selo.turnos && modsIguais(antes.mods, selo.mods)) return false
      return mudarSelo(sceneKey, seloId, seloEditado(antes, selo))
    },

    tirarSelo: (sceneKey, seloId) => mudarSelo(sceneKey, seloId, null),

    tirarSelosPeloUso: (sceneKey, tokenId, nomes, quem) => {
      const cena = cenaDe(sceneKey)
      if (cena === undefined || nomes.length === 0) return null
      const saem = selosQueALimpezaTira(cena.turnos.selos, tokenId, { nomes }).filter((selo) => selo.daPastilha !== true)
      if (saem.length === 0) return null
      const ids = new Set(saem.map((selo) => selo.id))
      const selos = (cena.turnos.selos ?? []).filter((selo) => !ids.has(selo.id))
      const nome = nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)(tokenId)
      const texto = `${quem} tirou ${saem.map((selo) => textoDoSelo(selo)).join(', ')} de ${nome} (item usado fora da batalha)`
      const reversao: Reversao = { tipo: 'composta', partes: saem.map((selo): Reversao => ({ tipo: 'selo', seloId: selo.id, antes: selo })) }
      const id = novoIdDeLinha()
      gravarCena(sceneKey, comMudanca(cena, { ...cena.turnos, selos }, { id, tipo: 'selo', texto, tokenIds: [tokenId], reversao }))
      return id
    },
  }
  return { seloNoAcerto, seloPostoNaFicha, aliadosNaLutaDe, acoes }
}

/** O que `criarSelos` devolve. */
export type SelosDaBatalha = ReturnType<typeof criarSelos>
