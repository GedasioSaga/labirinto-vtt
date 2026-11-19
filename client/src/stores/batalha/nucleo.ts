/**
 * O núcleo da store da batalha One Piece, que toda fatia de `stores/batalha/` recebe: ler e gravar a
 * cena, avisar quem caiu, os lembretes depois do dano, a revelação ao usar e o Desfazer de uma linha.
 */
import type { StoreApi } from 'zustand/vanilla'
import { combateVazio, type CombateDoPersonagem } from '../../lib/batalha/combate'
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
import { type FichasDaMesa, fichasDaMesa, type LinhaNova, comMudanca, comEfeitos, nomeDoTokenNa, nomeDoBandoNa, linhaAtualizada } from './cena'
import { desfazerReversao, reacoesComTecnicaDe, contrasDaReversao } from './desfazer'

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
  return { mesa, deps, set, get, mesaDoRpg, cenaDe, gravarCena, mudarTurnos, avisarQuemCaiu, comAvisoDeQuemCaiu, revelarAoUsar, ocultoParaQuemPede, lembrarDepoisDoDano, desfazerLinha }
}

/** O que `criarNucleo` devolve. */
export type NucleoDaBatalha = ReturnType<typeof criarNucleo>
