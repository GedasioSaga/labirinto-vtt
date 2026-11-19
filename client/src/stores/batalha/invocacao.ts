/**
 * A fatia da INVOCAÇÃO da store da batalha One Piece: invocar (a pendência do mestre), colocar o invocado
 * no mapa, cancelar, e agir com o invocado na vez do bando.
 */
import {
  chaveDoGastoDoInvocado,
  comBandosEmDia,
  comunsQueSaem,
  invocadoDaPendencia,
  membrosDoBando,
  motivoDaInvocacao,
  nomeDaColocacao,
  nomeNumerado,
  novoIdDeInvocacao,
  numerosValidos,
  pedirInvocacao,
  pendenciaPorId,
  ultraEmCampo,
  type ContextoDaInvocacao,
} from '../../lib/batalha/invocacao'
import { fichaDoInvocado } from '../../lib/livros/combate'
import { isTokenPhotoData } from '../../lib/tokenPhoto'
import type { Token } from '../../types/map'
import { travaDoToken } from '../../lib/batalha/condicoes'
import { acoesDaCarta } from '../../lib/batalha/golpe'
import { recursoDoCusto } from '../../lib/batalha/leituraDaFicha'
import { novoIdDeLinha, type Reversao } from '../../lib/batalha/registro'
import { cartaDaVez, type CartaDaOrdem, type TurnosDaCena } from '../../lib/batalha/turnos'
import { cartaoPorId as cartaoEmQualquerNivel, NOME_DO_OCULTO, ocultoNaBatalha } from '../../lib/habilidadeOculta'
import type { BatalhaState } from './tipos'
import { MESTRE, GASTO_ZERO, comMudanca, quemNaFicha, nomeDoTokenNa, nomeDoBandoNa, partesDosLembretes } from './cena'
import { tirarDoMapa, mexerNaFicha, textoDosQueSairam, reversaoDaFicha } from './naMesa'
import type { NucleoDaBatalha } from './nucleo'
import type { GolpeNaStore } from './golpe'

/** A invocação presa ao núcleo da store e ao golpe. */
export function criarInvocacao(nucleo: NucleoDaBatalha, fatiaDoGolpe: GolpeNaStore) {
  const { mesa, mesaDoRpg, cenaDe, gravarCena, revelarAoUsar, ocultoParaQuemPede, lembrarDepoisDoDano, desfazerLinha } = nucleo
  const { agirComACarta } = fatiaDoGolpe

  const acoes: Pick<BatalhaState, 'agirComInvocado' | 'invocar' | 'colocarInvocado' | 'cancelarInvocacao'> = {
    agirComInvocado: (sceneKey, vez, tokenId, pedido) => {
      if ((pedido.tipo !== 'atacar' && pedido.tipo !== 'habilidade') || pedido.contraDe !== undefined) return false
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return false
      const { turnos } = cena
      if (turnos.vez !== vez.cartaId || turnos.rodada !== vez.rodada) return false
      const bando = cartaDaVez(turnos)
      const invocado = bando === null ? undefined : membrosDoBando(turnos, bando).find((membro) => membro.tokenId === tokenId)
      if (bando === null || invocado === undefined) return false
      // O invocado age como se fosse a carta da vez, com o gasto DELE (a Simples de cada um é dele).
      const chave = chaveDoGastoDoInvocado(bando.id, tokenId)
      const carta: CartaDaOrdem = { id: bando.id, tokenId, personagemId: invocado.personagemId, nome: invocado.nome }
      const doInvocado: TurnosDaCena = { ...turnos, gastos: { ...turnos.gastos, [bando.id]: turnos.gastos[chave] ?? GASTO_ZERO } }
      return agirComACarta(sceneKey, cena, MESTRE, carta, doInvocado, chave, pedido)
    },

    invocar: (sceneKey, autor, pedido) => {
      const cena = cenaDe(sceneKey)
      // Mesa que não diz onde pôr o token não invoca. A arena põe no palco dela (`mesaDaArena`).
      if (cena === undefined || mesa.criarInvocado === undefined) return false
      const { turnos } = cena
      const dono = turnos.cartas.find((carta) => carta.tokenId === pedido.tokenId && carta.bando === undefined)
      const daVez = cartaDaVez(turnos)
      if (dono === undefined || dono.personagemId === null || daVez === null || daVez.bando !== undefined) return false
      // Conserto das fichas F1 (S4): Atordoado ou Paralisado só passa a vez, então não invoca.
      if (travaDoToken(turnos.selos, dono.tokenId) !== null) return false
      const personagemId = dono.personagemId
      const { personagens, sistema } = mesaDoRpg()
      const personagem = personagens.find((candidato) => candidato.id === personagemId) ?? null
      const ctx: ContextoDaInvocacao = { personagem, sistema, turnos, acoes: acoesDaCarta({ turnos, carta: daVez, personagem, sistema, regras: cena.regras }) }
      if (ocultoParaQuemPede(autor, personagem, pedido.cartaoId) || motivoDaInvocacao(ctx, pedido) !== null) return false
      const linhaId = novoIdDeLinha()
      const pedida = pedirInvocacao({ ...ctx, autor, donoTokenId: dono.tokenId }, pedido, { pendente: novoIdDeInvocacao(), linha: linhaId })
      if (pedida === null) return false
      // Desfazer de trás para a frente: lembretes, a pendência (e o invocado que veio dela), o SP, a recarga e a carga, a ação.
      const partes: Reversao[] = [
        // A ação só volta se ainda é esta vez: o Cancelar da pendência numa vez depois não zera o gasto de agora.
        { tipo: 'gasto', cartaId: daVez.id, antes: turnos.gastos[daVez.id] ?? null, vez: { cartaId: daVez.id, rodada: turnos.rodada } },
        { tipo: 'combate', personagemId, antes: turnos.combate?.[personagemId] ?? null, depois: pedida.combate },
      ]
      const { custo } = pedida
      if (custo.length > 0) {
        const doCusto = mexerNaFicha(mesa, personagemId, () => custo, quemNaFicha(autor))
        // Bug 11: custo recusado = a invocação não sai.
        if (doCusto === 'recusada') return false
        partes.push(...reversaoDaFicha(personagemId, doCusto))
      }
      partes.push({ tipo: 'invocacaoPedida', pendente: pedida.pendente })
      let novos: TurnosDaCena = {
        ...turnos,
        gastos: { ...turnos.gastos, [daVez.id]: pedida.gasto },
        combate: { ...(turnos.combate ?? {}), [personagemId]: pedida.combate },
        invocacoes: [...(turnos.invocacoes ?? []), pedida.pendente],
      }
      // O custo de HP pode levar o dono abaixo do gatilho de vida (o mesmo ponto do golpe).
      const lembrados = lembrarDepoisDoDano(novos)
      partes.push(...partesDosLembretes(lembrados))
      novos = lembrados.turnos
      // O SP só aparece na linha da ficha de jogador (o de NPC nunca vai à mesa).
      const recurso = pedida.pago === null || sistema === null ? null : (recursoDoCusto(sistema, pedida.pago.recurso)?.nome ?? pedida.pago.recurso.toUpperCase())
      const pago = pedida.pago !== null && personagem !== null && personagem.tipo === 'jogador' ? ` (${pedida.pago.valor} ${recurso ?? ''})` : ''
      // Fatia C7 (revisão): a técnica de invocação oculta sai como "???" (o invocado aparece no mapa de todo jeito).
      const daTecnica = personagem === null ? null : cartaoEmQualquerNivel(personagem, pedido.cartaoId)
      const tecnica = daTecnica !== null && ocultoNaBatalha(personagem, daTecnica) ? NOME_DO_OCULTO : pedida.tecnica
      const texto = `${nomeDoTokenNa(turnos, personagens)(dono.tokenId)} invocou 1 ${pedida.pendente.nome} com ${tecnica}${pago}`
      // A ficha passa pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
      const atual = cenaDe(sceneKey) ?? cena
      gravarCena(sceneKey, comMudanca(atual, novos, { id: linhaId, tipo: 'habilidade', texto, autor, tokenIds: [dono.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
      revelarAoUsar(personagemId, pedido.cartaoId)
      return true
    },

    colocarInvocado: (sceneKey, invocacaoId, onde, ajuste = {}) => {
      const cena = cenaDe(sceneKey)
      const sistema = mesa.sistema()
      if (cena === undefined || sistema === null || mesa.criarInvocado === undefined) return null
      const { turnos } = cena
      const pendente = pendenciaPorId(turnos, invocacaoId)
      if (pendente === null || !Number.isFinite(onde.x) || !Number.isFinite(onde.y) || (onde.piso !== undefined && !Number.isInteger(onde.piso))) return null
      // Decisão 10: o comum pendente de antes do Ultra não entra ao lado dele (o mestre cancela a pendência e o custo volta).
      if (ultraEmCampo(turnos, pendente)) return null
      // Os números do texto, ou os que o mestre ajustou (o Ultra só sugere, decisão 10); torto = nada muda.
      const pedidos = ajuste.numeros ?? pendente.numeros
      const numeros = pedidos === null ? null : numerosValidos(pedidos)
      if (numeros === null) return null
      // "Lobo 1", "Lobo 2", "Lobo 3": os do mesmo dono com o mesmo nome ganham número (a lista "Quem age" e o mapa dizem qual é qual).
      const nome = nomeNumerado(turnos, pendente, nomeDaColocacao(pendente, ajuste.nome))
      const personagem = fichaDoInvocado(sistema, nome, { hp: numeros.hp, dano: numeros.dano }, pendente.donoPersonagemId, sceneKey)
      const token: Token = { id: crypto.randomUUID(), characterId: personagem.id, name: nome, x: onde.x, y: onde.y, size: 1, image: null }
      // A foto só vale embutida (`data:image/...`); `midia:` do cartão quem chama resolve e manda em `ajuste.imageData`.
      const foto = ajuste.imageData === undefined ? pendente.imagem : ajuste.imageData
      if (isTokenPhotoData(foto)) token.imageData = foto
      if (onde.piso !== undefined && onde.piso !== 0) token.piso = onde.piso
      if (!mesa.criarInvocado(sceneKey, personagem, token)) return null
      const linhaId = novoIdDeLinha()
      const invocado = invocadoDaPendencia(pendente, { tokenId: token.id, personagemId: personagem.id, linhaId, nome, numeros })
      let novos: TurnosDaCena = {
        ...turnos,
        invocacoes: (turnos.invocacoes ?? []).filter((candidata) => candidata.id !== pendente.id),
        invocados: [...(turnos.invocados ?? []), invocado],
      }
      // Desfazer de trás para a frente: os comuns voltam, depois o invocado sai e a pendência volta.
      const partes: Reversao[] = [{ tipo: 'invocacaoColocada', pendente, invocado }]
      // Ultra (decisão 10): os comuns do mesmo dono e da mesma técnica saem quando ele entra.
      const saem = comunsQueSaem(turnos, pendente)
      for (const comum of saem) {
        const tirado = tirarDoMapa(mesa, sceneKey, novos, comum)
        novos = tirado.turnos
        partes.push(tirado.parte)
      }
      const personagens = mesa.personagens()
      novos = comBandosEmDia(novos, nomeDoBandoNa(novos, personagens))
      const texto = `${nomeDoTokenNa(turnos, personagens)(pendente.donoTokenId)}: ${nome} entrou no mapa${textoDosQueSairam(saem.map((comum) => comum.nome))}`
      const atual = cenaDe(sceneKey) ?? cena
      gravarCena(sceneKey, comMudanca(atual, novos, { id: linhaId, tipo: 'invocacao', texto, autor: MESTRE, tokenIds: [pendente.donoTokenId, token.id], personagemIds: [pendente.donoPersonagemId], reversao: { tipo: 'composta', partes } }))
      return token.id
    },

    cancelarInvocacao: (sceneKey, invocacaoId) => {
      const cena = cenaDe(sceneKey)
      const pendente = cena === undefined ? null : pendenciaPorId(cena.turnos, invocacaoId)
      if (cena === undefined || pendente === null) return false
      // É o Desfazer da linha do pedido: a pendência sai e o SP, a recarga, a carga e a ação voltam.
      if (cena.registro.some((linha) => linha.id === pendente.linhaId)) return desfazerLinha(sceneKey, pendente.linhaId, MESTRE)
      // A linha do pedido saiu do teto do registro: não há o que devolver, mas a pendência não fica presa.
      const turnos: TurnosDaCena = { ...cena.turnos, invocacoes: (cena.turnos.invocacoes ?? []).filter((candidata) => candidata.id !== pendente.id) }
      const nomeDoDono = nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)(pendente.donoTokenId)
      const texto = `Mestre cancelou 1 ${pendente.nome} de ${nomeDoDono} (o pedido já saiu do registro: o custo não volta)`
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'invocacao', texto, tokenIds: [pendente.donoTokenId], personagemIds: [pendente.donoPersonagemId], reversao: { tipo: 'invocacaoCancelada', pendente } }))
      return true
    },
  }
  return { acoes }
}
