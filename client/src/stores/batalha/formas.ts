/**
 * A fatia das FORMAS da store da batalha One Piece: ligar e desligar a forma (transformar, destransformar,
 * subir de parte), o cansaço do Overload, o custo por vez da forma e das mantidas, e a decisão do mestre
 * sobre a forma pedida (`decidirForma`, `cancelarForma`).
 */
import {
  chaveDaVez,
  combateVazio,
  FORMAS_PENDENTES_MAX,
  type CombateDoPersonagem,
  type FormaPendente,
  type PedidoDeAcao,
  type PedidoDePassiva,
  type AcaoDaForma,
  type FormaNaBatalha,
  type NumeroDaForma,
} from '../../lib/batalha/combate'
import { comAcoesDaForma, gastarAcao, semAcoesDaForma } from '../../lib/batalha/acoes'
import { comADonaDesligada } from '../../lib/batalha/acumuladorNaBatalha'
import { comSeloNovo, criarSelo, novoIdDeSelo, ondeNaVez, quedaEmNumeros, textoDoSeloComMods } from '../../lib/batalha/selos'
import { condicaoDaFabricaDoSelo } from '../../lib/condicoes/fabrica'
import { pedidoComACondicao } from './selos'
import { acaoDaForma, acoesAMaisDaForma, ativarForma, descerUmaParte, desfazerForma, duracaoDaForma, formaDaFicha, formaEhOverload, formaMontada, formaQueATecnicaLiga, subidaDeParte, usosDaForma } from '../../lib/batalha/transformacao'
import {
  cartaoComADecisao,
  cartaoPorId,
  comCartaoTrocado,
  decisaoValida,
  escritoNoCartao,
  formaDecididaPeloMestre,
  novoIdDeDecisao,
  textoDaDecisao,
  type EscritoPelaDecisao,
} from '../../lib/batalha/mecanica/formaDoMestre'
import { comOCansaco, modsDoCansaco } from '../../lib/batalha/recursosDaBatalha'
import { custoPorTurno, manterNaVez, mantidasComCusto, motivoDoCustoPorTurno, motivoDoPedidoDoCusto, pararAMantida, textoDoCustoPorTurno } from '../../lib/batalha/custoPorTurno'
import { ajustesDoCusto, custoEmSp, podeAgir, portaoDoPedido, type ContextoDoGolpe } from '../../lib/batalha/golpe'
import { gastarOsRequisitos, notaDaLinha } from './gastosDosRequisitos'
import { devolverFichasDaAcao } from './desfazer'
import { cartoesLigados, fatorDaVelocidade } from '../../lib/batalha/mecanicasAMao'
import { semLembretes } from '../../lib/batalha/passivas'
import { recursoDoCusto, tecnicaPorId } from '../../lib/batalha/leituraDaFicha'
import type { VezEsperada } from '../../lib/batalha/ponte'
import { novoIdDeLinha, type Reversao } from '../../lib/batalha/registro'
import { cartaDaVez, type AutorDaAcao, type CartaDaOrdem, type TurnosDaCena } from '../../lib/batalha/turnos'
import { NOME_DO_MESTRE, valorDoRank } from '../../lib/ajusteDaFicha'
import { nomeNaBatalha, ocultoNaBatalha, revelacaoAoUsar } from '../../lib/habilidadeOculta'
import type { CartaoDaFicha, Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import type { BatalhaDaCena, BatalhaState } from './tipos'
import { MESTRE, GASTO_ZERO, comMudanca, type EfeitoNovo, comEfeitos, quemNaFicha, personagemDoTokenNa, nomeDoTokenNa } from './cena'
import { mexerNaFicha, reversaoDaFicha, trocarFicha } from './naMesa'
import type { NucleoDaBatalha } from './nucleo'

const ROTULO_DA_ACAO_DA_FORMA: Readonly<Record<AcaoDaForma, string>> = { simples: 'Simples', completa: 'Completa', bonus: 'Bônus', livre: 'Livre' }

/** As formas presas ao núcleo da store. */
export function criarFormas(nucleo: NucleoDaBatalha) {
  const { mesa, mesaDoRpg, cenaDe, gravarCena, desfazerLinha, rastrear } = nucleo

  /**
   * Conserto das fichas F1 (Overload): depois dele, os atributos base do
   * personagem da ficha `tokenId` ficam pela metade até o fim da batalha. Mora
   * nos selos "Cansaço do Overload" da batalha (`comOCansaco`), NUNCA na ficha:
   * o app fechado no meio não deixa a ficha pela metade. Já cansado = `null`
   * (a metade não divide de novo). As partes "selo" vão na linha do Overload:
   * o Desfazer dela tira o cansaço; o mestre também tira pelo selo.
   */
  const cansarNoOverload = (personagemId: string, tokenId: string, turnos: TurnosDaCena): { turnos: TurnosDaCena; partes: Reversao[] } | null => {
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId)
    if (personagem === undefined || sistema === null) return null
    const cansado = comOCansaco(turnos, tokenId, modsDoCansaco(personagem, sistema), novoIdDeSelo)
    return cansado === null ? null : { turnos: cansado.turnos, partes: cansado.selos.map((selo): Reversao => ({ tipo: 'selo', seloId: selo.id, antes: null })) }
  }

  /**
   * Desliga a forma `cartaoId` do personagem: a ficha (`desfazerForma`), o
   * cansaço da forma Overload (resposta do Alexei: o fim dela deixa os
   * atributos base pela metade) e a imagem e o nome na carta (só se eram desta
   * forma). O Desfazer da forma (ação livre) e o fim sozinho da forma com
   * duração (F2b, A Caçada Começa) passam por aqui. `null` = a ficha recusou.
   */
  const desligarAForma = (personagemId: string, tokenId: string, cartaoId: string, overload: boolean, turnos: TurnosDaCena, quem: string): { turnos: TurnosDaCena; partes: Reversao[]; nota?: string } | null => {
    // Rework das habilidades (D10, E5): a forma montada, lida antes de desligar (o cartão fica na ficha).
    const { personagens, sistema } = mesaDoRpg()
    const dona = personagens.find((candidato) => candidato.id === personagemId)
    const cartaoDaForma = dona === undefined || sistema === null ? null : formaDaFicha(dona, sistema, cartaoId)
    const montada = cartaoDaForma === null ? null : formaMontada(cartaoDaForma)
    const fichaMudou = trocarFicha(mesa, personagemId, (atual, sistemaDaMesa) => desfazerForma(atual, sistemaDaMesa, cartaoId, quem, Date.now()))
    if (fichaMudou === null || fichaMudou === 'recusada') return null
    const partes: Reversao[] = [...reversaoDaFicha(personagemId, fichaMudou)]
    let novos = turnos
    let nota: string | undefined
    if (montada !== null) {
      // D10: a forma montada deixa a Fadiga da peça no dono (no lugar do cansaço de antes) e leva as ações a mais que deu.
      const fadiga = montada.forma.fadiga
      if (fadiga !== undefined && sistema !== null) {
        // Rework das condições (E5): a Fadiga é a de fábrica (a peça só dá os turnos); sem ela no catálogo, a da peça, como antes.
        const daFabrica = condicaoDaFabricaDoSelo(fadiga.nome) !== null
        const pedido = daFabrica ? { nome: fadiga.nome, turnos: fadiga.turnos, cartaoId } : { ...fadiga, cartaoId }
        const resolvido = quedaEmNumeros(pedidoComACondicao(pedido, mesa.condicoesCriadas?.() ?? [], personagemId), (atributo) => (dona === undefined ? 0 : valorDoRank(dona, atributo)))
        const selo = criarSelo(tokenId, resolvido, { id: novoIdDeSelo(), rodada: novos.rodada, ...ondeNaVez(novos), origem: fadiga.nome })
        const selos = comSeloNovo(novos.selos, selo)
        if (selos !== null) {
          partes.push({ tipo: 'selo', seloId: selo.id, antes: null })
          novos = { ...novos, selos }
          nota = `: ${textoDoSeloComMods(selo, sistema)}`
        }
      }
      const extras = { ...novos.extras }
      for (const [cartaId, extra] of Object.entries(novos.extras)) {
        const sobra = semAcoesDaForma(extra, cartaoId, montada.forma.acoesAMais)
        if (sobra === extra) continue
        partes.push({ tipo: 'acoesExtras', cartaId, antes: extra })
        if (sobra === null) delete extras[cartaId]
        else extras[cartaId] = sobra
      }
      novos = { ...novos, extras }
    }
    // Mecânica 7 (E5): o acumulador do cartão da forma com a descida "desliga" zera agora.
    const combateDaDona = novos.combate?.[personagemId]
    const zerado = combateDaDona === undefined || dona === undefined ? undefined : comADonaDesligada(combateDaDona, dona, cartaoId)
    if (combateDaDona !== undefined && zerado !== undefined && zerado !== combateDaDona) {
      partes.push({ tipo: 'combate', personagemId, antes: combateDaDona, depois: zerado })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: zerado } }
    }
    if (overload && montada === null) {
      const cansado = cansarNoOverload(personagemId, tokenId, novos)
      if (cansado !== null) {
        partes.push(...cansado.partes)
        novos = cansado.turnos
      }
    }
    const formaAntes = turnos.formas?.[personagemId] ?? null
    if (formaAntes !== null && formaAntes.cartaoId === cartaoId) {
      partes.push({ tipo: 'forma', personagemId, antes: formaAntes })
      const formas = { ...(novos.formas ?? {}) }
      delete formas[personagemId]
      novos = { ...novos, formas }
    }
    return nota === undefined ? { turnos: novos, partes } : { turnos: novos, partes, nota }
  }

  /**
   * F3 (fatia T): Ativar a forma (gasta a ação escolhida, liga o cartão, o
   * atual ganha a diferença do máximo, Q1) ou Desfazer a forma (ação livre).
   * Só na vez da carta. A ficha muda pela aventura; a linha "transformacao"
   * leva a reversão composta [gasto, ficha, forma] e o texto sem números.
   */
  /**
   * F2 (fatia E, Fúria do Dragão): o pedido da técnica que sobe de Parte, na
   * vez da carta, vira o Ativar da Parte seguinte (a ação é a do campo Ação da
   * técnica). `null` = não é essa técnica, ou não há Parte acima (aí o pedido
   * segue e o `podeAgir` recusa com o motivo).
   */
  const subidaDoPedido = (sceneKey: string, pedido: PedidoDeAcao): Extract<PedidoDeAcao, { tipo: 'transformar' }> | null => {
    if (pedido.tipo !== 'habilidade' || pedido.contraDe !== undefined) return null
    const cena = cenaDe(sceneKey)
    const carta = cena === undefined ? null : cartaDaVez(cena.turnos)
    const { personagens, sistema } = mesaDoRpg()
    const personagem = carta === null || carta.personagemId === null ? undefined : personagens.find((candidato) => candidato.id === carta.personagemId)
    if (personagem === undefined || sistema === null) return null
    const tecnica = tecnicaPorId(personagem, sistema, pedido.cartaoId)
    if (tecnica === null) return null
    // REQUISITOS D (I1): a subida pelo bloco da técnica (`aoUsar.sobeParte`) ou, sem bloco, pela tabela à mão.
    // I2 (`forma.soLigaPor`): a técnica listada numa forma desligada liga essa forma. O mestre que força leva a força junto.
    const subida = subidaDeParte(personagem, sistema, pedido.cartaoId)
    const liga = subida === null ? formaQueATecnicaLiga(personagem, sistema, tecnica.cartao) : null
    const para = subida !== null && 'para' in subida ? subida.para : liga
    if (para === null) return null
    return { tipo: 'transformar', cartaoId: para.id, acao: acaoDaForma(tecnica.cartao), trocarImagem: true, pela: tecnica.cartao.id, ...(pedido.forcarRequisitos === true ? { forcarRequisitos: true } : {}) }
  }

  /**
   * O que Ativar a forma gasta na vez: a ação escolhida ("livre" não gasta), o
   * uso dos "Usos por batalha" e, na forma Overload (A Caçada Começa), o
   * Overload da batalha. O Desfazer devolve pelas partes "gasto" e "combate".
   * C6: `soNaVez` = o gasto só volta se ainda é aquela vez (o mestre pode
   * recusar a forma pedida numa vez depois, como o Cancelar da invocação).
   */
  const gastosDoAtivar = (turnos: TurnosDaCena, cartaId: string, personagemId: string, cartao: CartaoDaFicha | null, acao: AcaoDaForma, soNaVez: boolean): { turnos: TurnosDaCena; partes: Reversao[] } => {
    const partes: Reversao[] = []
    let novos = turnos
    if (acao !== 'livre') {
      const antes = turnos.gastos[cartaId] ?? null
      partes.push(soNaVez ? { tipo: 'gasto', cartaId, antes, vez: { cartaId, rodada: turnos.rodada } } : { tipo: 'gasto', cartaId, antes })
      novos = { ...novos, gastos: { ...novos.gastos, [cartaId]: gastarAcao(turnos.gastos[cartaId] ?? GASTO_ZERO, acao) } }
    }
    if (cartao !== null && usosDaForma(cartao) !== null) {
      const combateAntes = novos.combate?.[personagemId]
      const base = combateAntes ?? combateVazio()
      const depois: CombateDoPersonagem = { ...base, usos: { ...base.usos, [cartao.id]: (base.usos[cartao.id] ?? 0) + 1 } }
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
    }
    // Conserto das fichas F1: a forma Overload (A Caçada Começa) gasta o Overload da batalha (1 por batalha). E5: e a montada com Overload.
    if (cartao !== null && formaEhOverload(cartao)) {
      const combateAntes = novos.combate?.[personagemId]
      const depois: CombateDoPersonagem = { ...(combateAntes ?? combateVazio()), overload: true }
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
    }
    return { turnos: novos, partes }
  }

  const mudarForma = (sceneKey: string, autor: AutorDaAcao, vez: VezEsperada | null, pedido: Extract<PedidoDeAcao, { tipo: 'transformar' | 'destransformar' }>): boolean => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined || vez === null) return false
    const { turnos } = cena
    if (turnos.vez !== vez.cartaId || turnos.rodada !== vez.rodada) return false
    const carta = cartaDaVez(turnos)
    if (carta === null || carta.personagemId === null) return false
    const personagemId = carta.personagemId
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === personagemId) ?? null
    if (personagem === null || sistema === null) return false
    const ctx: ContextoDoGolpe = { turnos, carta, personagem, sistema, regras: cena.regras, autor, personagens, personagemDoToken: personagemDoTokenNa(turnos) }
    if (podeAgir(ctx, pedido) !== null) return false
    // REQUISITOS C: o "Para ligar" da forma (o mesmo portão do `podeAgir`), lido antes de mexer: os gastos e a nota.
    const doPortao = pedido.tipo === 'transformar' ? portaoDoPedido(ctx, pedido) : null
    const cartao = formaDaFicha(personagem, sistema, pedido.cartaoId)
    // Fatia C7: a forma oculta liga como "???" (a não ser que revele ao usar: aí o uso a revela, logo abaixo).
    const nomeDaForma = cartao === null ? 'a forma' : nomeNaBatalha(personagem, cartao, 'a forma')
    const quem = quemNaFicha(autor)
    const quemAge = nomeDoTokenNa(turnos, personagens)(carta.tokenId)
    const formaAntes = turnos.formas?.[personagemId] ?? null
    const partes: Reversao[] = []
    const efeitos: EfeitoNovo[] = []
    let novos: TurnosDaCena = turnos
    let texto: string
    // Construtor C6: a forma em que o mestre decide os números não liga aqui: o pedido gasta e espera o mestre.
    if (pedido.tipo === 'transformar' && cartao !== null && formaDecididaPeloMestre(cartao)) {
      const lista = turnos.formasPendentes ?? []
      if (lista.length >= FORMAS_PENDENTES_MAX || lista.some((outra) => outra.personagemId === personagemId && outra.cartaoId === cartao.id)) return false
      const gastos = gastosDoAtivar(turnos, carta.id, personagemId, cartao, pedido.acao, true)
      const linhaId = novoIdDeLinha()
      const pendente: FormaPendente = { id: novoIdDeDecisao(), linhaId, rodada: turnos.rodada, cartaId: carta.id, autor, tokenId: carta.tokenId, personagemId, cartaoId: cartao.id, nome: nomeDaForma, trocarImagem: pedido.trocarImagem }
      const comoPede = pedido.acao === 'livre' ? 'sem gastar ação' : ROTULO_DA_ACAO_DA_FORMA[pedido.acao]
      const textoDoPedido = `${quemAge} quer ativar ${nomeDaForma} (${comoPede}) · o mestre decide os números`
      const comPendente: TurnosDaCena = { ...gastos.turnos, formasPendentes: [...lista, pendente] }
      const atualDoPedido = cenaDe(sceneKey) ?? cena
      gravarCena(sceneKey, comMudanca(atualDoPedido, comPendente, { id: linhaId, tipo: 'transformacao', texto: textoDoPedido, autor, tokenIds: [carta.tokenId], reversao: { tipo: 'composta', partes: [...gastos.partes, { tipo: 'formaPedida', pendente }] } }))
      return true
    }
    if (pedido.tipo === 'transformar') {
      let numeros: NumeroDaForma[] = []
      // R2: as formas do mesmo grupo que a troca desligou (os cartões voltam pela parte "ficha" no Desfazer).
      let desligadas: string[] = []
      const fichaMudou = trocarFicha(mesa, personagemId, (atual, sistemaDaMesa) => {
        const feito = ativarForma(atual, sistemaDaMesa, pedido.cartaoId, quem, Date.now())
        if (feito !== null) {
          numeros = feito.numeros
          desligadas = feito.desligadas.map((cartaoDesligado) => nomeNaBatalha(atual, cartaoDesligado, 'a forma'))
        }
        // Fatia C7: a forma oculta que revela ao usar sai revelada (o Desfazer da linha não a esconde de novo).
        return feito === null ? null : (revelacaoAoUsar(feito.personagem, pedido.cartaoId) ?? feito.personagem)
      })
      if (fichaMudou === null || fichaMudou === 'recusada') return false
      const gastos = gastosDoAtivar(novos, carta.id, personagemId, cartao, pedido.acao, false)
      partes.push(...gastos.partes)
      novos = gastos.turnos
      // Rework das habilidades (D10, E5): as ações a mais da forma montada, na carta que ligou (saem quando a forma desliga).
      const acoesAMais = cartao === null ? 0 : acoesAMaisDaForma(cartao)
      if (acoesAMais > 0) {
        const extrasAntes = novos.extras[carta.id] ?? null
        partes.push({ tipo: 'acoesExtras', cartaId: carta.id, antes: extrasAntes })
        novos = { ...novos, extras: { ...novos.extras, [carta.id]: comAcoesDaForma(extrasAntes, acoesAMais, pedido.cartaoId, novos.rodada) } }
      }
      // O Desfazer volta as partes de trás para a frente: o cartão vem PRIMEIRO aqui para o ganho voltar antes de
      // desligar (1.500/1.800 → 900/1.800 → 900/1.200). Na ordem de `partesDoAjuste`, o corte do desligar viria antes
      // e o delta tiraria o ganho de novo (1.200 − 600 = 600).
      const cartaoPrimeiro = [...fichaMudou.filter((parte) => parte.parte === 'cartao'), ...fichaMudou.filter((parte) => parte.parte !== 'cartao')]
      partes.push(...reversaoDaFicha(personagemId, cartaoPrimeiro))
      // REQUISITOS C: os gastos do "Para ligar" que vale, nesta linha (o Desfazer devolve tudo).
      let notaDosRequisitos = doPortao?.tipo === 'passa' ? doPortao.nota : null
      if (doPortao?.tipo === 'passa') {
        const gastosDoPortao = gastarOsRequisitos(mesa, sceneKey, personagemId, carta.tokenId, novos, doPortao.gastos, autor)
        if (gastosDoPortao === 'recusada') {
          devolverFichasDaAcao(mesa, sceneKey, cena, partes, autor)
          return false
        }
        partes.push(...gastosDoPortao.partes)
        novos = gastosDoPortao.turnos
        notaDosRequisitos = notaDaLinha(gastosDoPortao.texto, notaDosRequisitos)
        // REQUISITOS D: o SP que o "Para ligar" gastou sobe o acumulador "a cada N SP gastos" (gatilho gastaSp). Só as partes
        // dos gastos: o atual que a troca de Parte mexe (o máximo que cai) não é gasto.
        const rastreado = rastrear(novos, [], gastosDoPortao.partes)
        partes.push(...rastreado.partes)
        novos = rastreado.turnos
      }
      const imagem = pedido.trocarImagem ? (cartao?.imagem ?? null) : null
      const forma: FormaNaBatalha = { cartaoId: pedido.cartaoId, imagem }
      // F2b (A Caçada Começa): a forma com duração conta as vezes dele DEPOIS desta (`fimDaVezDasMecanicas` desliga no fim da última).
      // F0c: o campo Duração da forma vale; sem ele, a tabela à mão (`duracaoDaForma`).
      const vezes = cartao === null ? null : duracaoDaForma(cartao)
      if (vezes !== null) forma.duracao = { faltam: vezes, ligouNa: chaveDaVez(turnos.rodada, carta.id) }
      partes.push({ tipo: 'forma', personagemId, antes: formaAntes })
      novos = { ...novos, formas: { ...(novos.formas ?? {}), [personagemId]: forma } }
      const efeito: EfeitoNovo = { tipo: 'transformacao', tokenId: carta.tokenId, forma: nomeDaForma, imagem }
      // Fatia C7 (revisão): os números da forma oculta são do segredo (o efeito chega ao dono e aos aliados).
      if (numeros.length > 0 && (cartao === null || !ocultoNaBatalha(personagem, cartao))) efeito.numeros = numeros
      efeitos.push(efeito)
      const comoAtiva = pedido.acao === 'livre' ? 'sem gastar ação' : ROTULO_DA_ACAO_DA_FORMA[pedido.acao]
      const aMais = acoesAMais === 0 ? '' : ` · ${acoesAMais === 1 ? '+1 ação' : `+${acoesAMais} ações`} a mais por vez`
      texto = `${quemAge} ativa ${nomeDaForma} (${comoAtiva})${aMais}${desligadas.length === 0 ? '' : ` · desliga ${desligadas.join(', ')}`}${notaDosRequisitos === null ? '' : ` ${notaDosRequisitos}`}`
    } else {
      const desligada = desligarAForma(personagemId, carta.tokenId, pedido.cartaoId, cartao !== null && formaEhOverload(cartao), novos, quem)
      if (desligada === null) return false
      partes.push(...desligada.partes)
      novos = desligada.turnos
      efeitos.push({ tipo: 'forma', tokenId: carta.tokenId, forma: nomeDaForma, ligou: false })
      texto = `${quemAge} desfaz ${nomeDaForma} (ação livre)${desligada.nota ?? ''}`
    }
    // F2b (revisão, Ignição): a troca que muda a Velocidade marca a carta; ela vai ao lugar novo na virada (`passarVez`),
    // nunca no meio da rodada. O Desfazer desta linha tira a marca (parte "combate").
    const depoisDaTroca = mesaDoRpg().personagens.find((candidato) => candidato.id === personagemId)
    if (depoisDaTroca !== undefined && fatorDaVelocidade(cartoesLigados(depoisDaTroca)) !== fatorDaVelocidade(cartoesLigados(personagem))) {
      const combateAntes = novos.combate?.[personagemId]
      const depois: CombateDoPersonagem = { ...(combateAntes ?? combateVazio()), reordenarNaVirada: true }
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois })
      novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
      texto = `${texto} · a ordem muda no começo da próxima rodada`
    }
    // A ficha passou pela aventura no meio: grava sobre a cena de agora, com a ordem calculada daqui.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, {
      ...comMudanca(atual, novos, { tipo: 'transformacao', texto, autor, tokenIds: [carta.tokenId], reversao: { tipo: 'composta', partes } }),
      efeitos: comEfeitos(atual.efeitos, efeitos),
    })
    return true
  }

  /**
   * Conserto das fichas F1 (bug 10, P6): o lembrete "Aplicar / pular" do
   * custo por turno de uma FORMA ligada. Pular: só tira o lembrete. Aplicar
   * com recurso: cobra (`ajustesDoCusto`) e marca `gastouSp`. Sem recurso: a
   * forma desce uma Parte (`descerUmaParte`: da Parte 1, volta para a base).
   * A reversão é [combate, ficha, forma]; o Desfazer devolve o lembrete.
   */
  const custoDaFormaNaVez = (
    sceneKey: string,
    cena: BatalhaDaCena,
    autor: AutorDaAcao,
    carta: CartaDaOrdem,
    personagem: Personagem,
    sistema: SistemaDeRpg,
    pedido: Extract<PedidoDePassiva, { tipo: 'lembrete' }>,
  ): boolean => {
    const { turnos } = cena
    if (motivoDoPedidoDoCusto({ personagem, sistema, turnos, aplicarSoComLembrete: autor.tipo === 'jogador' }, pedido) !== null) return false
    const personagemId = personagem.id
    const combateAntes = turnos.combate?.[personagemId] ?? null
    const combateBase = combateAntes ?? combateVazio()
    const semOLembrete = semLembretes(combateBase, pedido.cartaoId)
    if (!pedido.aplicar) {
      gravarCena(sceneKey, comMudanca(cena, { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: semOLembrete } }, null))
      return true
    }
    const cartao = formaDaFicha(personagem, sistema, pedido.cartaoId)
    const custo = cartao === null ? null : custoPorTurno(cartao, personagem)
    if (cartao === null || custo === null) return false
    const quem = quemNaFicha(autor)
    const nome = nomeNaBatalha(personagem, cartao, 'a forma')
    const dono = nomeDoTokenNa(turnos, mesaDoRpg().personagens)(carta.tokenId)
    const partes: Reversao[] = []
    let novos: TurnosDaCena
    let texto: string
    const paga = motivoDoCustoPorTurno(personagem, sistema, custo) === null
    if (paga) {
      const doCusto = mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, custo), quem)
      // Bug 11: o custo recusado não aplica (o lembrete fica esperando).
      if (doCusto === 'recusada') return false
      const combate: CombateDoPersonagem = custoEmSp(custo) && semOLembrete.gastouSp !== true ? { ...semOLembrete, gastouSp: true } : semOLembrete
      const doCustoNaLinha = reversaoDaFicha(personagemId, doCusto)
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: combate }, ...doCustoNaLinha)
      novos = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: combate } }
      // REQUISITOS D: o SP que a forma ligada paga na vez sobe o acumulador "a cada N SP gastos" (gatilho gastaSp).
      const rastreado = rastrear(novos, [], doCustoNaLinha)
      partes.push(...rastreado.partes)
      novos = rastreado.turnos
      texto = `${dono} mantém ${nome} (paga ${textoDoCustoPorTurno(custo, sistema)})`
    } else {
      // Sem recurso (resposta da Ryoko): desce uma Parte. O cartão vem primeiro na reversão, como no Ativar da forma.
      // Num objeto: a atribuição dentro do callback não estreita a variável de fora.
      const descida: { anterior: CartaoDaFicha | null } = { anterior: null }
      const fichaMudou = trocarFicha(mesa, personagemId, (atual, sistemaDaMesa) => {
        const feita = descerUmaParte(atual, sistemaDaMesa, cartao.id, quem, Date.now())
        descida.anterior = feita?.anterior ?? null
        return feita?.personagem ?? null
      })
      if (fichaMudou === null || fichaMudou === 'recusada') return false
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: semOLembrete })
      partes.push(...reversaoDaFicha(personagemId, [...fichaMudou.filter((parte) => parte.parte === 'cartao'), ...fichaMudou.filter((parte) => parte.parte !== 'cartao')]))
      novos = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: semOLembrete } }
      // A imagem da forma na carta: passa para a Parte anterior (se a de agora mostrava imagem) ou sai.
      const formaAntes = turnos.formas?.[personagemId] ?? null
      if (formaAntes !== null && formaAntes.cartaoId === cartao.id) {
        partes.push({ tipo: 'forma', personagemId, antes: formaAntes })
        const formas = { ...(novos.formas ?? {}) }
        const voltou = descida.anterior
        if (voltou === null) delete formas[personagemId]
        else formas[personagemId] = { cartaoId: voltou.id, imagem: formaAntes.imagem === null ? null : voltou.imagem }
        novos = { ...novos, formas }
      }
      const destino = descida.anterior
      const recurso = recursoDoCusto(sistema, custo.recurso)?.nome ?? custo.recurso.toUpperCase()
      texto = `${dono} sem ${recurso} para manter ${nome}: ${destino === null ? 'sai da forma' : `volta para ${nomeNaBatalha(personagem, destino, 'a Parte anterior')}`}`
    }
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, comMudanca(atual, novos, { tipo: 'transformacao', texto, autor, tokenIds: [carta.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    return true
  }

  /**
   * F2 (revisão da fatia D): o lembrete "Aplicar / pular" da técnica MANTIDA
   * (Giro da Lança, Campo de Contenção). Aplicar com recurso: cobra o custo da
   * vez (`custoDaMantida`), marca `gastouSp` e, no Campo, +1 de Concentração
   * (`manterNaVez`). Pular, ou Aplicar sem recurso: para (`pararAMantida`: a
   * recarga começa agora) e os selos que a técnica pôs saem (ninguém fica
   * preso no campo desligado). A reversão é [combate, ficha | selos].
   */
  const custoDaMantidaNaVez = (
    sceneKey: string,
    cena: BatalhaDaCena,
    autor: AutorDaAcao,
    carta: CartaDaOrdem,
    personagem: Personagem,
    sistema: SistemaDeRpg,
    pedido: Extract<PedidoDePassiva, { tipo: 'lembrete' }>,
  ): boolean => {
    const { turnos } = cena
    if (motivoDoPedidoDoCusto({ personagem, sistema, turnos, aplicarSoComLembrete: autor.tipo === 'jogador' }, pedido) !== null) return false
    const personagemId = personagem.id
    const combateAntes = turnos.combate?.[personagemId] ?? null
    const semOLembrete = semLembretes(combateAntes ?? combateVazio(), pedido.cartaoId)
    const mantida = mantidasComCusto(personagem, sistema, combateAntes ?? undefined).find(({ cartao }) => cartao.id === pedido.cartaoId)
    if (mantida === undefined) return false
    const { cartao, custo } = mantida
    const nome = nomeNaBatalha(personagem, cartao, 'a técnica')
    const dono = nomeDoTokenNa(turnos, mesaDoRpg().personagens)(carta.tokenId)
    const partes: Reversao[] = []
    let novos: TurnosDaCena
    let texto: string
    if (pedido.aplicar && motivoDoCustoPorTurno(personagem, sistema, custo) === null) {
      // Rework (D7): a "Ligar e manter" sem custo só mantém (nada a cobrar na ficha).
      const semCusto = custo.valor === 0
      const doCusto = semCusto ? [] : mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, custo), quemNaFicha(autor))
      // Bug 11: o custo recusado não aplica (o lembrete fica esperando).
      if (doCusto === 'recusada') return false
      const mantido = manterNaVez(semOLembrete, cartao.id)
      const combate: CombateDoPersonagem = !semCusto && custoEmSp(custo) && mantido.gastouSp !== true ? { ...mantido, gastouSp: true } : mantido
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: combate }, ...reversaoDaFicha(personagemId, doCusto))
      novos = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: combate } }
      const daCarga = combate.carga === semOLembrete.carga ? '' : `; Concentração ${combate.carga}`
      texto = semCusto ? `${dono} mantém ${nome}${daCarga === '' ? '' : ` (${daCarga.slice(2)})`}` : `${dono} mantém ${nome} (paga ${textoDoCustoPorTurno(custo, sistema)}${daCarga})`
    } else {
      // Mecânica 7 (E5): o acumulador da técnica com a descida "desliga" zera quando ela para.
      const parado = comADonaDesligada(pararAMantida(semOLembrete, cartao), personagem, cartao.id)
      const tirados = (turnos.selos ?? []).filter((selo) => selo.cartaoId === cartao.id)
      partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: parado }, ...tirados.map((selo): Reversao => ({ tipo: 'selo', seloId: selo.id, antes: selo })))
      novos = { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: parado }, selos: (turnos.selos ?? []).filter((selo) => selo.cartaoId !== cartao.id) }
      const recarga = parado.recargas[cartao.id]
      const porque = pedido.aplicar ? `sem ${recursoDoCusto(sistema, custo.recurso)?.nome ?? custo.recurso.toUpperCase()} para manter` : 'parou'
      texto = `${dono} ${porque} ${nome}${recarga === undefined ? '' : ` (recarga ${recarga})`}`
    }
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, comMudanca(atual, novos, { tipo: 'habilidade', texto, autor, tokenIds: [carta.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    return true
  }

  const acoes: Pick<BatalhaState, 'decidirForma' | 'cancelarForma'> = {
    decidirForma: (sceneKey, pendenteId, pedida) => {
      const cena = cenaDe(sceneKey)
      const sistema = mesa.sistema()
      const pendente = cena?.turnos.formasPendentes?.find((candidata) => candidata.id === pendenteId)
      if (cena === undefined || sistema === null || pendente === undefined) return false
      const { turnos } = cena
      const { personagemId } = pendente
      const personagens = mesa.personagens()
      const personagem = personagens.find((candidato) => candidato.id === personagemId)
      const cartao = personagem === undefined ? null : cartaoPorId(personagem, pendente.cartaoId)
      const valida = decisaoValida(pedida, sistema)
      if (personagem === undefined || cartao === null || personagem.cartoesAtivos.includes(cartao.id) || 'motivo' in valida) return false
      const { decisao } = valida
      // 1) O cartão recebe os números do mestre (os modificadores trocam; a habilidade entra como subcartão).
      // `as`: o callback escreve; sem ele o TypeScript fixaria `null` aqui.
      let escrito = null as EscritoPelaDecisao | null
      const escreveu = mesa.ajustarPersonagem(personagemId, (atual) => {
        const doCartao = cartaoPorId(atual, cartao.id)
        if (doCartao === null) return atual
        const comDecisao = cartaoComADecisao(doCartao, decisao)
        escrito = escritoNoCartao(comDecisao)
        return comCartaoTrocado(atual, comDecisao)
      })
      if (!escreveu || escrito === null) return false
      const partes: Reversao[] = [{ tipo: 'cartaoDaForma', personagemId, antes: cartao, escrito }]
      // 2) A forma liga como no Ativar de sempre (os máximos, o atual, as do mesmo grupo).
      let numeros: NumeroDaForma[] = []
      let desligadas: string[] = []
      const fichaMudou = trocarFicha(mesa, personagemId, (atual, sistemaDaMesa) => {
        const feito = ativarForma(atual, sistemaDaMesa, cartao.id, NOME_DO_MESTRE, Date.now())
        if (feito !== null) {
          numeros = feito.numeros
          desligadas = feito.desligadas.map((cartaoDesligado) => nomeNaBatalha(atual, cartaoDesligado, 'a forma'))
        }
        // Fatia C7 (revisão): a forma oculta que revela ao usar sai revelada, como no Ativar de sempre.
        return feito === null ? null : (revelacaoAoUsar(feito.personagem, cartao.id) ?? feito.personagem)
      })
      if (fichaMudou === null || fichaMudou === 'recusada') {
        // Não ligou: o cartão volta como era e nada mais muda.
        mesa.ajustarPersonagem(personagemId, (atual) => comCartaoTrocado(atual, cartao))
        return false
      }
      partes.push(...reversaoDaFicha(personagemId, [...fichaMudou.filter((parte) => parte.parte === 'cartao'), ...fichaMudou.filter((parte) => parte.parte !== 'cartao')]))
      const imagem = pendente.trocarImagem ? cartao.imagem : null
      const forma: FormaNaBatalha = { cartaoId: cartao.id, imagem }
      // A Duração conta desde a vez do pedido, não desde a vez em que o mestre decidiu.
      const vezes = duracaoDaForma(cartao)
      if (vezes !== null) forma.duracao = { faltam: vezes, ligouNa: chaveDaVez(pendente.rodada, pendente.cartaId) }
      partes.push({ tipo: 'forma', personagemId, antes: turnos.formas?.[personagemId] ?? null })
      let novos: TurnosDaCena = { ...turnos, formas: { ...(turnos.formas ?? {}), [personagemId]: forma } }
      // Rework das habilidades (D10): as ações a mais da forma montada, na carta do pedido, como no Ativar de sempre (`mudarForma`).
      const acoesAMais = acoesAMaisDaForma(cartao)
      if (acoesAMais > 0) {
        const extrasAntes = novos.extras[pendente.cartaId] ?? null
        partes.push({ tipo: 'acoesExtras', cartaId: pendente.cartaId, antes: extrasAntes })
        novos = { ...novos, extras: { ...novos.extras, [pendente.cartaId]: comAcoesDaForma(extrasAntes, acoesAMais, cartao.id, novos.rodada) } }
      }
      const quemAge = nomeDoTokenNa(turnos, personagens)(pendente.tokenId)
      // Fatia C7 (revisão): os números que o mestre decidiu para a forma oculta são do segredo (a linha e o efeito chegam a todos).
      const oculta = ocultoNaBatalha(personagem, cartao)
      const decidiu = oculta ? 'o mestre decidiu' : `o mestre decidiu: ${textoDaDecisao(decisao, sistema)}`
      const aMais = acoesAMais === 0 ? '' : ` · ${acoesAMais === 1 ? '+1 ação' : `+${acoesAMais} ações`} a mais por vez`
      let texto = `${quemAge} ativa ${pendente.nome} · ${decidiu}${aMais}${desligadas.length === 0 ? '' : ` · desliga ${desligadas.join(', ')}`}`
      // F2b (Ignição): a troca que muda a Velocidade marca a carta para a virada, como no Ativar de sempre.
      const depoisDaTroca = mesa.personagens().find((candidato) => candidato.id === personagemId)
      if (depoisDaTroca !== undefined && fatorDaVelocidade(cartoesLigados(depoisDaTroca)) !== fatorDaVelocidade(cartoesLigados(personagem))) {
        const combateAntes = novos.combate?.[personagemId]
        const depois: CombateDoPersonagem = { ...(combateAntes ?? combateVazio()), reordenarNaVirada: true }
        partes.push({ tipo: 'combate', personagemId, antes: combateAntes ?? null, depois })
        novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: depois } }
        texto = `${texto} · a ordem muda no começo da próxima rodada`
      }
      // 3) A pendência sai por último: o Desfazer a devolve primeiro.
      partes.push({ tipo: 'formaDecidida', pendente })
      novos = { ...novos, formasPendentes: (novos.formasPendentes ?? []).filter((candidata) => candidata.id !== pendente.id) }
      const efeito: EfeitoNovo = { tipo: 'transformacao', tokenId: pendente.tokenId, forma: pendente.nome, imagem }
      if (numeros.length > 0 && !oculta) efeito.numeros = numeros
      const atual = cenaDe(sceneKey) ?? cena
      gravarCena(sceneKey, {
        ...comMudanca(atual, novos, { tipo: 'transformacao', texto, autor: MESTRE, tokenIds: [pendente.tokenId], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }),
        efeitos: comEfeitos(atual.efeitos, [efeito]),
      })
      return true
    },

    cancelarForma: (sceneKey, pendenteId) => {
      const cena = cenaDe(sceneKey)
      const pendente = cena?.turnos.formasPendentes?.find((candidata) => candidata.id === pendenteId)
      if (cena === undefined || pendente === undefined) return false
      // É o Desfazer da linha do pedido: a pendência sai e a ação, os usos e o Overload voltam.
      if (cena.registro.some((linha) => linha.id === pendente.linhaId)) return desfazerLinha(sceneKey, pendente.linhaId, MESTRE)
      // A linha do pedido saiu do teto do registro: nada a devolver, mas a pendência não fica presa (o Desfazer a traz de volta).
      const turnos: TurnosDaCena = { ...cena.turnos, formasPendentes: (cena.turnos.formasPendentes ?? []).filter((candidata) => candidata.id !== pendente.id) }
      const texto = `Mestre recusou ${pendente.nome} de ${nomeDoTokenNa(cena.turnos, mesaDoRpg().personagens)(pendente.tokenId)} (o pedido já saiu do registro: a ação não volta)`
      gravarCena(sceneKey, comMudanca(cena, turnos, { tipo: 'transformacao', texto, tokenIds: [pendente.tokenId], reversao: { tipo: 'formaDecidida', pendente } }))
      return true
    },
  }
  return { cansarNoOverload, desligarAForma, subidaDoPedido, mudarForma, custoDaFormaNaVez, custoDaMantidaNaVez, acoes }
}

/** O que `criarFormas` devolve. */
export type FormasDaBatalha = ReturnType<typeof criarFormas>
