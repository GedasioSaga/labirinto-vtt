/**
 * O núcleo da store da batalha One Piece, que toda fatia de `stores/batalha/` recebe: ler e gravar a
 * cena, avisar quem caiu, os lembretes depois do dano, a revelação ao usar e o Desfazer de uma linha.
 */
import type { StoreApi } from 'zustand/vanilla'
import { acumuladoresDoPersonagem, comOEventoNosAcumuladores, type EventoDoAcumulador } from '../../lib/batalha/acumuladorNaBatalha'
import { combateVazio, type CombateDoPersonagem, type GolpeDaBatalha, type UltimaAcaoDoRastro } from '../../lib/batalha/combate'
import { acertouOAlvo, alvosResolvidosAgora, chaveDaVezDe, comAcaoNoRastro, comDanoNoRastro, comGolpeNoRastro, comQueda, comReacaoNoRastro } from '../../lib/batalha/rastro'
import type { AcumuladorDaFicha } from '../../lib/batalha/requisitos/modelo'
import { comBandosEmDia } from '../../lib/batalha/invocacao'
import { recursoDeVida, vidaDoPersonagem } from '../../lib/vidaDaFicha'
import { textoDoGolpe } from '../../lib/batalha/golpe'
import { avisoAoCairDe } from '../../lib/batalha/mecanicasAMao'
import { comLembretesDoMomento, type TurnosComLembretes } from '../../lib/batalha/passivas'
import type { MesaDaBatalha } from '../../lib/batalha/mesa'
import { marcarDesfeita, nomeDoAutor, semOContraGasto, semARecargaNasVezes, semOGastoNaFotoDaVez, type Reversao } from '../../lib/batalha/registro'
import type { AutorDaAcao, TurnosDaCena } from '../../lib/batalha/turnos'
import { motivoDoOcultoParaJogador, revelacaoAoUsar } from '../../lib/habilidadeOculta'
import type { Personagem } from '../../lib/personagem'
import type { DependenciasDaBatalha, BatalhaDaCena, BatalhaState } from './tipos'
import { type EfeitoNovo, type FichasDaMesa, fichasDaMesa, type LinhaNova, comMudanca, comEfeitos, nomeDoTokenNa, nomeDoBandoNa, linhaAtualizada, personagemDoTokenNa } from './cena'
import { desfazerReversao, reacoesComTecnicaDe, contrasDaReversao } from './desfazer'

/** REQUISITOS B3: um golpe que a linha lançou (`antes` `null`) ou resolveu (alvo a alvo), para o rastro de quem atacou. */
export interface GolpeNaLinha {
  antes: GolpeDaBatalha | null
  depois: GolpeDaBatalha
}

/** As partes soltas da reversão (a composta aberta). */
function partesSoltas(reversao: Reversao): Reversao[] {
  return reversao.tipo === 'composta' ? reversao.partes.flatMap(partesSoltas) : [reversao]
}

/**
 * O núcleo preso à `mesa` (toda leitura e gravação de ficha passa por ela) e à store do zustand (`set`,
 * `get`). Todo d20 sai de `deps.rolarD20`.
 */
export function criarNucleo(mesa: MesaDaBatalha, deps: DependenciasDaBatalha, set: StoreApi<BatalhaState>['setState'], get: StoreApi<BatalhaState>['getState']) {
  /** O sistema e os personagens da mesa desta store, lidos agora. */
  const mesaDoRpg = (): FichasDaMesa => fichasDaMesa(mesa)

  /** A cena ligada, ou `undefined`. */
  const cenaDe = (sceneKey: string): BatalhaDaCena | undefined => get().cenas[sceneKey]

  /** Troca a cena (que tem de estar ligada). */
  const gravarCena = (sceneKey: string, cena: BatalhaDaCena): void => {
    set({ cenas: { ...get().cenas, [sceneKey]: cena } })
  }

  /** Aplica `mudar` aos turnos da cena; mudou = grava com a linha que `linha` monta. */
  const mudarTurnos = (sceneKey: string, mudar: (turnos: TurnosDaCena) => TurnosDaCena, linha: (antes: TurnosDaCena, depois: TurnosDaCena) => LinhaNova | null): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return false
    const turnos = mudar(cena.turnos)
    if (turnos === cena.turnos) return false
    gravarCena(sceneKey, comMudanca(cena, turnos, linha(cena.turnos, turnos)))
    return true
  }

  /**
   * F2 (fatia B): o aviso ao mestre de quem caiu a 0 com cartão que avisa
   * (Recuperação Espantosa: o mestre decide quando e com quanto HP volta), uma
   * vez por batalha (chave em `lembradas`). Linha própria "acao", cujo
   * Desfazer tira a chave. Nada a avisar: a cena fica como está.
   */
  const avisarQuemCaiu = (sceneKey: string, autor: AutorDaAcao): void => {
    const cena = cenaDe(sceneKey)
    const { personagens, sistema } = mesaDoRpg()
    const recurso = sistema === null ? null : recursoDeVida(sistema)
    if (cena === undefined || recurso === null) return
    let novos = cena.turnos
    const partes: Reversao[] = []
    const textos: string[] = []
    const ids = new Set(cena.turnos.cartas.flatMap((carta) => (carta.personagemId === null ? [] : [carta.personagemId])))
    for (const personagemId of ids) {
      const personagem = personagens.find((candidato) => candidato.id === personagemId)
      const vida = personagem === undefined ? null : vidaDoPersonagem(personagem, recurso)
      if (personagem === undefined || vida === null || vida.atual > 0) continue
      const aviso = avisoAoCairDe(Object.values(personagem.abas).flatMap((cartoes) => cartoes.map((cartao) => cartao.id)))
      const chave = aviso === null ? null : `${aviso.cartaoId}:caiu`
      const antes = novos.combate?.[personagemId]
      if (aviso === null || chave === null || (antes?.lembradas ?? []).includes(chave)) continue
      const depois: CombateDoPersonagem = { ...(antes ?? combateVazio()), lembradas: [...(antes?.lembradas ?? []), chave] }
      partes.push({ tipo: 'combate', personagemId, antes: antes ?? null, depois })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
      textos.push(`${personagem.nome.trim() || 'A ficha'}: ${aviso.texto}`)
    }
    if (textos.length === 0) return
    gravarCena(sceneKey, comMudanca(cena, novos, { tipo: 'acao', texto: textos.join(' · '), autor, reversao: { tipo: 'composta', partes } }))
  }

  /** F2 (fatia B): o pedido que saiu e pode ter tirado HP (o Aplicar do Sangramento ou do Queimando, o "a cada turno", o Ajustar) passa pelo aviso de quem caiu. */
  const comAvisoDeQuemCaiu = (sceneKey: string, autor: AutorDaAcao, feito: boolean): boolean => {
    if (feito) avisarQuemCaiu(sceneKey, autor)
    return feito
  }

  /**
   * Fatia C7 (revisão): o cartão oculto que revela ao usar sai revelado depois
   * do uso (golpe, forma, passiva, reação, evolução, contador, marca,
   * invocação). O Desfazer da linha não o esconde de novo. Cartão sem a marca:
   * a ficha fica a mesma e nada grava.
   */
  const revelarAoUsar = (personagemId: string, cartaoId: string): void => {
    mesa.ajustarPersonagem(personagemId, (atual) => revelacaoAoUsar(atual, cartaoId) ?? atual)
  }

  /** Fatia C7 (revisão): o pedido do JOGADOR por um cartão oculto (que ele nem vê) é forjado: recusado em toda rota. */
  const ocultoParaQuemPede = (autor: AutorDaAcao, personagem: Personagem | null | undefined, cartaoId: string): boolean =>
    autor.tipo === 'jogador' && motivoDoOcultoParaJogador(personagem ?? null, cartaoId) !== null

  /**
   * Tipos de habilidade F3: depois de dano ou custo de vida (golpe, reação,
   * Dar dano), os lembretes das passivas de vida baixa. Um ponto só, chamado
   * depois de `danoNoAlvo` e de `darDano`: a ficha já mudou pela mesa, e o
   * gatilho lê a vida de AGORA.
   */
  const lembrarDepoisDoDano = (turnos: TurnosDaCena): TurnosComLembretes => comLembretesDoMomento('dano', turnos, mesaDoRpg())

  /**
   * REQUISITOS, fase B3: o rastro do que a linha fez, chamado nos mesmos pontos do
   * `lembrarDepoisDoDano` (antes dele). O dano vem dos efeitos "dano" da linha (o custo de HP da
   * técnica não é dano: não tem efeito); a queda, da parte "ficha" de quem apanhou que levou o HP de
   * mais de 0 a 0; o acerto e o erro, dos alvos de ataque que os `golpes` resolveram agora. Os
   * acumuladores sobem e descem com isso (`acumuladorNaBatalha.ts`). Devolve os turnos novos e as
   * partes da linha: uma "combate" por personagem que mudou e uma "caiu" por queda.
   */
  const rastrear = (turnos: TurnosDaCena, efeitos: readonly EfeitoNovo[], partes: readonly Reversao[], golpes: readonly GolpeNaLinha[] = []): { turnos: TurnosDaCena; partes: Reversao[] } => {
    const { personagens, sistema } = mesaDoRpg()
    const vida = sistema === null ? null : recursoDeVida(sistema)
    const doToken = personagemDoTokenNa(turnos)
    const mudados = new Map<string, CombateDoPersonagem>()
    const definicoes = new Map<string, readonly AcumuladorDaFicha[]>()
    const combateDe = (personagemId: string): CombateDoPersonagem => mudados.get(personagemId) ?? turnos.combate?.[personagemId] ?? combateVazio()
    const anotar = (personagemId: string, mudar: (combate: CombateDoPersonagem) => CombateDoPersonagem): void => {
      const antes = combateDe(personagemId)
      const depois = mudar(antes)
      if (depois !== antes) mudados.set(personagemId, depois)
    }
    const noAcumulador = (personagemId: string, evento: EventoDoAcumulador): void => {
      let dele = definicoes.get(personagemId)
      if (dele === undefined) {
        const personagem = personagens.find((candidato) => candidato.id === personagemId)
        dele = personagem === undefined ? [] : acumuladoresDoPersonagem(personagem)
        definicoes.set(personagemId, dele)
      }
      const daFicha = dele
      if (daFicha.length > 0) anotar(personagemId, (combate) => comOEventoNosAcumuladores(combate, daFicha, evento))
    }
    // O dano: o de verdade (o que esquivou ou contra-atacou não apanhou).
    const apanharam = new Map<string, string>()
    for (const efeito of efeitos) {
      if (efeito.tipo !== 'dano' || !(efeito.valor > 0) || efeito.saida === 'esquiva' || efeito.saida === 'contra') continue
      const personagemId = doToken(efeito.tokenId)
      if (personagemId === undefined || personagemId === null) continue
      const valor = efeito.valor
      anotar(personagemId, (combate) => comDanoNoRastro(combate, valor))
      noAcumulador(personagemId, { quando: 'apanha' })
      if (!apanharam.has(personagemId)) apanharam.set(personagemId, efeito.tokenId)
    }
    const cairam = new Set<string>()
    if (vida !== null) {
      for (const parte of partes.flatMap(partesSoltas)) {
        if (parte.tipo !== 'ficha' || !apanharam.has(parte.personagemId)) continue
        if (parte.partes.some((mudou) => mudou.parte === 'recurso' && mudou.chave === vida.id && mudou.de > 0 && mudou.para <= 0)) cairam.add(parte.personagemId)
      }
    }
    // O golpe: o último ataque, o "acertou na vez", e os acumuladores de quem acerta, esquiva ou derruba.
    const vezDeAgora = chaveDaVezDe(turnos)
    for (const { antes, depois } of golpes) {
      const agora = alvosResolvidosAgora(antes, depois)
      const quem = depois.atacantePersonagemId
      if (agora.length === 0 || quem === null) continue
      anotar(quem, (combate) => comGolpeNoRastro(combate, depois, vezDeAgora))
      for (const alvo of agora) {
        if (acertouOAlvo(alvo) === true) noAcumulador(quem, { quando: 'acerta' })
        else if (alvo.saida === 'esquiva' && alvo.personagemId !== null) noAcumulador(alvo.personagemId, { quando: 'esquiva' })
        if (alvo.personagemId !== null && cairam.has(alvo.personagemId)) noAcumulador(quem, { quando: 'derruba' })
      }
    }
    let novos = turnos
    const novas: Reversao[] = []
    for (const [personagemId, depois] of mudados) {
      novas.push({ tipo: 'combate', personagemId, antes: turnos.combate?.[personagemId] ?? null, depois })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
    }
    for (const personagemId of cairam) {
      const tokenId = apanharam.get(personagemId)
      const comEla = tokenId === undefined ? null : comQueda(novos, tokenId)
      if (comEla === null || tokenId === undefined) continue
      novos = comEla
      novas.push({ tipo: 'caiu', tokenId })
    }
    return { turnos: novos, partes: novas }
  }

  /**
   * REQUISITOS, fase B3: a ação de `personagemId` no rastro (a técnica, o Atacar ou o item; a
   * técnica da reação só entra nas usadas) e o acumulador que sobe ao usar a técnica. `naVez` = a
   * chave da vez dele quando a carta da vez é a dele; senão `null`. Nada mudou = sem parte.
   */
  const anotarAcao = (turnos: TurnosDaCena, personagemId: string, acao: UltimaAcaoDoRastro | { tipo: 'reacao'; cartaoId: string; nome: string }, naVez: string | null): { turnos: TurnosDaCena; partes: Reversao[] } => {
    const antes = turnos.combate?.[personagemId]
    const base = antes ?? combateVazio()
    let depois = acao.tipo === 'reacao' ? comReacaoNoRastro(base, acao.cartaoId, turnos.rodada) : comAcaoNoRastro(base, acao, turnos.rodada, naVez)
    if (acao.tipo === 'cartao' || acao.tipo === 'reacao') {
      const personagem = mesaDoRpg().personagens.find((candidato) => candidato.id === personagemId)
      const definicoes = personagem === undefined ? [] : acumuladoresDoPersonagem(personagem)
      if (definicoes.length > 0) depois = comOEventoNosAcumuladores(depois, definicoes, { quando: 'usaTecnica', tecnica: { id: acao.cartaoId, nome: acao.nome } })
    }
    if (depois === base) return { turnos, partes: [] }
    return { turnos: { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: depois } }, partes: [{ tipo: 'combate', personagemId, antes: antes ?? null, depois }] }
  }

  /**
   * Reverte a linha e a deixa riscada, sem conferir quem pede (o `desfazer`
   * confere). A reação com técnica desfeita refaz o texto da linha do golpe
   * (o alvo volta a "esperando reação").
   */
  const desfazerLinha = (sceneKey: string, linhaId: string, autor: AutorDaAcao): boolean => {
    const cena = cenaDe(sceneKey)
    const linha = cena?.registro.find((candidata) => candidata.id === linhaId)
    if (cena === undefined || linha === undefined || linha.desfeita !== undefined) return false
    const feito = desfazerReversao(mesa, sceneKey, cena, linha.reversao, autor)
    if (!feito.ok) return false
    const por = `${nomeDoAutor(autor)}${feito.emParte ? ' (em parte)' : ''}`
    // A cena de agora: o Desfazer da ficha passa pela aventura, e a store pode ter mudado no meio.
    const atual = cenaDe(sceneKey) ?? cena
    // F3: o desfazer do MESTRE faz o Judge erguer a carta em todas as telas; o do jogador, não.
    const efeitos = autor.tipo === 'mestre' ? comEfeitos(atual.efeitos, [{ tipo: 'judge', gesto: 'carta' }]) : atual.efeitos
    // Bug 3: a linha de uma vez que já passou: o gasto dela sai também da linha "Vez" que encerrou aquela vez.
    let registro = semOGastoNaFotoDaVez(marcarDesfeita(atual.registro, linhaId, por, Date.now()), linha)
    // Bug 3: a recarga que esta linha pôs sai também das linhas "Vez" que a desceram (a que chegou a 0 voltaria no Desfazer delas).
    registro = semARecargaNasVezes(registro, linha)
    // O contra-ataque que esta linha deu e alguém já gastou: o Desfazer de quem gastou não o devolve mais.
    for (const { golpeId, tokenId } of contrasDaReversao(linha.reversao)) registro = semOContraGasto(registro, golpeId, tokenId)
    const nomeDoToken = nomeDoTokenNa(feito.cena.turnos, mesaDoRpg().personagens)
    for (const parte of reacoesComTecnicaDe(linha.reversao)) {
      const voltou = feito.cena.turnos.golpes?.find((golpe) => golpe.id === parte.golpe.id)
      if (voltou !== undefined) registro = linhaAtualizada(registro, voltou.linhaId, textoDoGolpe(voltou, nomeDoToken), [])
    }
    // Invocação: o invocado que saiu ou voltou leva a carta do bando junto (some sem ninguém, volta com o mesmo id).
    const turnos = comBandosEmDia(feito.cena.turnos, nomeDoBandoNa(feito.cena.turnos, mesaDoRpg().personagens))
    gravarCena(sceneKey, { ...atual, turnos, regras: feito.cena.regras, registro, efeitos, turnosRev: atual.turnosRev + 1 })
    return true
  }
  return { mesa, deps, set, get, mesaDoRpg, cenaDe, gravarCena, mudarTurnos, avisarQuemCaiu, comAvisoDeQuemCaiu, revelarAoUsar, ocultoParaQuemPede, lembrarDepoisDoDano, rastrear, anotarAcao, desfazerLinha }
}

/** O que `criarNucleo` devolve. */
export type NucleoDaBatalha = ReturnType<typeof criarNucleo>
