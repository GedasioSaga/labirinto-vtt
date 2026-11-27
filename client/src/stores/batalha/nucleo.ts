/**
 * O núcleo da store da batalha One Piece, que toda fatia de `stores/batalha/` recebe: ler e gravar a
 * cena, avisar quem caiu, os lembretes depois do dano, a revelação ao usar e o Desfazer de uma linha.
 */
import type { StoreApi } from 'zustand/vanilla'
import { acumuladoresDoPersonagem, comOEventoNosAcumuladores, type EventoDoAcumulador } from '../../lib/batalha/acumuladorNaBatalha'
import { combateVazio, NOME_DO_SELO_MAX, type CombateDoPersonagem, type GolpeDaBatalha, type SeloDaBatalha, type SeloDoGolpe, type UltimaAcaoDoRastro } from '../../lib/batalha/combate'
import { acertouOAlvo, alvosResolvidosAgora, chaveDaVezDe, comAcaoNoRastro, comDanoNoRastro, comGolpeNoRastro, comQueda, comReacaoNoRastro } from '../../lib/batalha/rastro'
import type { AcumuladorDaFicha } from '../../lib/batalha/requisitos/modelo'
import { comBandosEmDia } from '../../lib/batalha/invocacao'
import { recursoDeVida, vidaDoPersonagem } from '../../lib/vidaDaFicha'
import { recursoDoCusto, recursoDoEscudo, tecnicaPorId } from '../../lib/batalha/leituraDaFicha'
import { ajustesDoCusto, textoDoGolpe } from '../../lib/batalha/golpe'
import { avisoAoCairDe, mecanicaDoCartao } from '../../lib/batalha/mecanicasAMao'
import { pecasDoCartao } from '../../lib/batalha/mecanica/leitura'
import { comLembrada, comLembreteDoGatilho, comLembretesDoMomento, custoDaPassiva, disparosDosGatilhos, lembreteDoDisparo, quandoDoGatilho, semLembretes, type DisparoDoGatilho, type EventoDoGatilho, type TurnosComLembretes } from '../../lib/batalha/passivas'
import { comSeloNovo, criarSelo, novoIdDeSelo, ondeNaVez, textoDoSeloComMods } from '../../lib/batalha/selos'
import { ajusteDoRecurso } from '../../lib/batalha/recursosDaBatalha'
import { curaComOsSelos } from '../../lib/batalha/condicoes'
import type { MesaDaBatalha } from '../../lib/batalha/mesa'
import { marcarDesfeita, nomeDoAutor, semOContraGasto, semARecargaNasVezes, semOGastoNaFotoDaVez, type Reversao } from '../../lib/batalha/registro'
import type { AutorDaAcao, TurnosDaCena } from '../../lib/batalha/turnos'
import { motivoDoOcultoParaJogador, nomeNaBatalha, revelacaoAoUsar } from '../../lib/habilidadeOculta'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import type { DependenciasDaBatalha, BatalhaDaCena, BatalhaState } from './tipos'
import { comAVezDeAgora } from '../../lib/batalha/requisitos/ajuda'
import { type EfeitoNovo, type FichasDaMesa, fichasDaMesa, type LinhaNova, comMudanca, comEfeitos, nomeDoTokenNa, nomeDoBandoNa, linhaAtualizada, personagemDoTokenNa, MESTRE, quemNaFicha } from './cena'
import { desfazerReversao, reacoesComTecnicaDe, contrasDaReversao } from './desfazer'
import { mexerNaFicha, reversaoDaFicha } from './naMesa'

/** REQUISITOS B3: um golpe que a linha lançou (`antes` `null`) ou resolveu (alvo a alvo), para o rastro de quem atacou. */
export interface GolpeNaLinha {
  antes: GolpeDaBatalha | null
  depois: GolpeDaBatalha
}

/** As partes soltas da reversão (a composta aberta). */
function partesSoltas(reversao: Reversao): Reversao[] {
  return reversao.tipo === 'composta' ? reversao.partes.flatMap(partesSoltas) : [reversao]
}

/** A primeira ficha do personagem na ordem (a original antes da extra). */
function tokenDoPersonagem(turnos: TurnosDaCena, personagemId: string): string | null {
  const dele = turnos.cartas.filter((carta) => carta.personagemId === personagemId)
  return (dele.find((carta) => carta.extra === undefined) ?? dele[0])?.tokenId ?? null
}

/**
 * Rework das habilidades (PLANO.md D7, E5): a técnica "Ligar e manter" que ligou põe no dono o selo
 * `ligada` (natureza "passiva", `donoId` + `cartaoId`): aparece nas passivas ativas e sai quando ela
 * para (`custoDaMantidaNaVez` tira os selos do cartão). Já tem, ou não é "manter": `null`.
 */
function comOSeloDaLigada(turnos: TurnosDaCena, personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string): { turnos: TurnosDaCena; parte: Reversao } | null {
  const achada = tecnicaPorId(personagem, sistema, cartaoId)
  if (achada === null || pecasDoCartao(achada.cartao)?.uso !== 'manter') return null
  if ((turnos.selos ?? []).some((selo) => selo.ligada === true && selo.donoId === personagem.id && selo.cartaoId === cartaoId)) return null
  const tokenId = tokenDoPersonagem(turnos, personagem.id)
  if (tokenId === null) return null
  const nome = nomeNaBatalha(personagem, achada.cartao, 'a técnica')
  const pedido: SeloDoGolpe = { nome: nome.slice(0, NOME_DO_SELO_MAX), turnos: null, natureza: 'passiva', cartaoId }
  const selo: SeloDaBatalha = { ...criarSelo(tokenId, pedido, { id: novoIdDeSelo(), rodada: turnos.rodada, ...ondeNaVez(turnos), origem: nome }), donoId: personagem.id, ligada: true }
  const selos = comSeloNovo(turnos.selos, selo)
  return selos === null ? null : { turnos: { ...turnos, selos }, parte: { tipo: 'selo', seloId: selo.id, antes: null } }
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
    // REQUISITOS E (§7.5): passar a vez (ou a rodada) cancela o pedido de ajuda que esperava; num lugar só, para todo caminho que troca a vez.
    const turnos = cena.turnos.pedidosDeAjuda === undefined ? cena.turnos : comAVezDeAgora(cena.turnos, deps.agora === undefined ? Date.now() : deps.agora())
    set({ cenas: { ...get().cenas, [sceneKey]: turnos === cena.turnos ? cena : { ...cena, turnos } } })
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
  /** E5 (D6): os eventos dos gatilhos das passivas montadas que o `rastrear` viu, esperando a linha gravar (`avisarQuemCaiu`). */
  let filaDosGatilhos: EventoDoGatilho[] = []

  const avisarQuemCaiu = (sceneKey: string, autor: AutorDaAcao): void => {
    avisarDosCaidos(sceneKey, autor)
    dispararAFila(sceneKey)
  }

  /** O aviso de quem caiu de antes; a passiva montada com o "avisa ao cair" (`avisoAoCair` da peça) também avisa. */
  const avisarDosCaidos = (sceneKey: string, autor: AutorDaAcao): void => {
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
      const cartoes = Object.values(personagem.abas).flat()
      const aviso = avisoAoCairDe(cartoes.map((cartao) => cartao.id)) ?? avisoMontadoAoCair(cartoes)
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

  /** O "avisa ao cair" do cartão montado (a tabela à mão acha pelo id; o montado, pelo cartão). */
  const avisoMontadoAoCair = (cartoes: readonly CartaoDaFicha[]): { cartaoId: string; texto: string } | null => {
    for (const cartao of cartoes) {
      const texto = cartao.mecanica === undefined ? undefined : mecanicaDoCartao(cartao)?.avisoAoCair
      if (texto !== undefined) return { cartaoId: cartao.id, texto }
    }
    return null
  }

  /** E5 (D6): a fila de eventos dos gatilhos, disparada depois que a linha que os causou gravou. */
  const dispararAFila = (sceneKey: string): void => {
    const fila = filaDosGatilhos
    filaDosGatilhos = []
    if (fila.length > 0) dispararGatilhos(sceneKey, fila)
  }

  /**
   * E5 (mecânica 3, D6): os gatilhos que os eventos disparam. O que pergunta antes vira o lembrete
   * "Ativar / Agora não" de hoje (sem linha, como os lembretes de sempre); o que não pergunta dispara
   * sozinho, numa linha do mestre com Desfazer (`aplicarDisparo`).
   */
  const dispararGatilhos = (sceneKey: string, eventos: readonly EventoDoGatilho[]): void => {
    for (const evento of eventos) {
      const cena = cenaDe(sceneKey)
      if (cena === undefined) return
      for (const disparo of disparosDosGatilhos(evento, cena.turnos, mesaDoRpg())) {
        if (disparo.gatilho.pergunta === true) lembrarDoDisparo(sceneKey, disparo)
        else aplicarDisparo(sceneKey, disparo, MESTRE)
      }
    }
  }

  /** O lembrete do gatilho que pergunta antes; na "uma por batalha", a chave entra em `lembradas` já (pergunta uma vez só, como hoje). */
  const lembrarDoDisparo = (sceneKey: string, disparo: DisparoDoGatilho): void => {
    const cena = cenaDe(sceneKey)
    if (cena === undefined) return
    const { turnos } = cena
    const lembrado = comLembreteDoGatilho(turnos.combate?.[disparo.personagemId] ?? combateVazio(), lembreteDoDisparo(disparo, turnos.rodada))
    const depois = disparo.gatilho.umaPorBatalha === true ? comLembrada(lembrado, disparo.chave) : lembrado
    gravarCena(sceneKey, comMudanca(cena, { ...turnos, combate: { ...(turnos.combate ?? {}), [disparo.personagemId]: depois } }, null))
  }

  /**
   * E5 (mecânica 3, D6): os efeitos do gatilho, numa linha "habilidade" com Desfazer: o selo no dono ou
   * em quem disparou, o "recupera" (de uma vez, ou por N vezes num selo que regenera), o Escudo, o aviso
   * e, no "Ao cair" com "fica com N", a vida em N. O lembrete sai; a "uma por batalha" fica em
   * `lembradas`. O Ativar do lembrete (a tira) e o disparo sozinho passam por aqui. `false` = nada feito.
   */
  const aplicarDisparo = (sceneKey: string, disparo: DisparoDoGatilho, autor: AutorDaAcao): boolean => {
    const cena = cenaDe(sceneKey)
    const { personagens, sistema } = mesaDoRpg()
    const personagem = personagens.find((candidato) => candidato.id === disparo.personagemId)
    const achada = personagem === undefined || sistema === null ? null : tecnicaPorId(personagem, sistema, disparo.cartaoId)
    if (cena === undefined || personagem === undefined || sistema === null || achada === null) return false
    const { turnos } = cena
    const { personagemId, tokenId } = disparo
    const quem = quemNaFicha(autor)
    const nomeDoToken = nomeDoTokenNa(turnos, personagens)
    const nome = nomeNaBatalha(personagem, achada.cartao, 'a passiva')
    const partes: Reversao[] = []
    const textos: string[] = []
    const tokenIds = new Set<string>([tokenId])
    // O custo da passiva, o mesmo do Ativar de antes (a conversão da E2 guarda o custo igual no texto): sem o recurso, não dispara.
    const custo = custoDaPassiva(achada.cartao, personagem, null)
    const recursoDoGasto = custo.tipo === 'valor' && custo.valor > 0 ? recursoDoCusto(sistema, custo.recurso) : null
    if (custo.tipo === 'valor' && recursoDoGasto !== null && numeroDaFicha(personagem.recursos, recursoDoGasto.id) < custo.valor) return false
    if (custo.tipo === 'valor' && recursoDoGasto !== null) {
      const doCusto = mexerNaFicha(mesa, personagemId, (atual, sistemaDaMesa) => ajustesDoCusto(atual, sistemaDaMesa, custo), quem)
      if (doCusto === 'recusada') return false
      partes.push(...reversaoDaFicha(personagemId, doCusto))
      textos.push(`paga ${custo.valor} ${recursoDoGasto.nome}`)
    }
    const combateAntes = turnos.combate?.[personagemId] ?? null
    const base = combateAntes ?? combateVazio()
    const semOLembrete = semLembretes(base, disparo.cartaoId)
    const combate = disparo.gatilho.umaPorBatalha === true ? comLembrada(semOLembrete, disparo.chave) : semOLembrete
    let novos: TurnosDaCena = combate === base ? turnos : { ...turnos, combate: { ...(turnos.combate ?? {}), [personagemId]: combate } }
    if (combate !== base) partes.push({ tipo: 'combate', personagemId, antes: combateAntes, depois: combate })
    const naFicha = (mudar: Parameters<typeof mexerNaFicha>[2]): boolean => {
      const feito = mexerNaFicha(mesa, personagemId, mudar, quem)
      if (feito === null || feito === 'recusada' || feito.length === 0) return false
      partes.push(...reversaoDaFicha(personagemId, feito))
      return true
    }
    const porSelo = (em: string, pedido: Parameters<typeof criarSelo>[1]): string | null => {
      const selo: SeloDaBatalha = { ...criarSelo(em, { ...pedido, cartaoId: disparo.cartaoId }, { id: novoIdDeSelo(), rodada: novos.rodada, ...ondeNaVez(novos), origem: nome }), donoId: personagemId }
      const selos = comSeloNovo(novos.selos, selo)
      if (selos === null) return null
      partes.push({ tipo: 'selo', seloId: selo.id, antes: null })
      novos = { ...novos, selos }
      tokenIds.add(em)
      return textoDoSeloComMods(selo, sistema)
    }
    for (const efeito of disparo.gatilho.efeitos) {
      if (efeito.tipo === 'selo') {
        const em = efeito.em === 'dono' ? tokenId : disparo.alvoTokenId
        const naLuta = em !== undefined && novos.cartas.some((carta) => carta.tokenId === em)
        const posto = naLuta ? porSelo(em, efeito.selo) : null
        textos.push(posto === null ? `${efeito.selo.nome}: sem alvo ou sem lugar para o selo` : em === tokenId ? posto : `${posto} em ${nomeDoToken(em ?? tokenId)}`)
      } else if (efeito.tipo === 'recupera' && efeito.turnos > 1) {
        const posto = porSelo(tokenId, { nome: nome.slice(0, NOME_DO_SELO_MAX), turnos: efeito.turnos, natureza: 'buff', regenera: { recurso: efeito.recurso, quanto: efeito.valor } })
        textos.push(posto === null ? `${nome}: sem lugar para o selo` : `+${efeito.valor} ${efeito.recurso === 'hp' ? 'HP' : 'SP'} por vez, ${efeito.turnos} vezes`)
      } else if (efeito.tipo === 'recupera') {
        const quanto = efeito.recurso === 'hp' ? curaComOsSelos(efeito.valor, novos.selos, tokenId) : efeito.valor
        const deu = naFicha((atual, sistemaDaMesa) => {
          const ajuste = ajusteDoRecurso(atual, sistemaDaMesa, efeito.recurso, quanto)
          return ajuste === null ? [] : [ajuste]
        })
        textos.push(deu ? `+${quanto} ${efeito.recurso === 'hp' ? 'HP' : 'SP'}` : `${efeito.recurso === 'hp' ? 'HP' : 'SP'} já cheio`)
      } else if (efeito.tipo === 'escudo') {
        const escudo = recursoDoEscudo(sistema)
        const deu = escudo !== null && naFicha((atual) => [{ parte: 'recurso', chave: escudo.id, valor: numeroDaFicha(atual.recursos, escudo.id) + efeito.valor }])
        textos.push(deu ? `+${efeito.valor} de Escudo` : 'Escudo: o sistema não tem')
      } else {
        textos.push(efeito.texto)
      }
    }
    const ficaCom = disparo.gatilho.quando === 'aoCair' ? disparo.gatilho.ficaCom : undefined
    if (ficaCom !== undefined) {
      const voltou = naFicha((_, sistemaDaMesa) => {
        const vida = recursoDeVida(sistemaDaMesa)
        return vida === null ? [] : [{ parte: 'recurso', chave: vida.id, valor: ficaCom }]
      })
      if (voltou) textos.push(`fica com ${ficaCom} de vida`)
    }
    if (partes.length === 0 && textos.length === 0) return false
    const texto = `${nomeDoToken(tokenId)}: ${nome} (${quandoDoGatilho(disparo.gatilho)})${textos.length === 0 ? '' : ` · ${textos.join(' · ')}`}`
    // A ficha passou pela aventura no meio: grava sobre a cena de agora. `personagemIds` = o dono: a linha da passiva de NPC não sai ao jogador.
    const atual = cenaDe(sceneKey) ?? cena
    gravarCena(sceneKey, comMudanca(atual, novos, { tipo: 'habilidade', texto, autor, tokenIds: [...tokenIds], personagemIds: [personagemId], reversao: { tipo: 'composta', partes } }))
    revelarAoUsar(personagemId, disparo.cartaoId)
    return true
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
      if (daFicha.length > 0) anotar(personagemId, (combate) => comOEventoNosAcumuladores(combate, daFicha, evento, turnos.rodada))
    }
    // REQUISITOS C: o SP que a linha tirou (o custo, o gasto do requisito) sobe o acumulador "a cada N SP gastos".
    const sp = sistema === null ? null : recursoDoCusto(sistema, 'sp')
    if (sp !== null) {
      for (const parte of partes.flatMap(partesSoltas)) {
        if (parte.tipo !== 'ficha') continue
        const gasto = parte.partes.reduce((soma, mudou) => (mudou.parte === 'recurso' && mudou.chave === sp.id && mudou.de > mudou.para ? soma + (mudou.de - mudou.para) : soma), 0)
        if (gasto > 0) noAcumulador(parte.personagemId, { quando: 'gastaSp', sp: gasto })
      }
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
      // Fase ED4: o "+N se acertar" da técnica, uma vez por golpe: no primeiro alvo que ele acerta (o de antes já resolvido não conta de novo).
      const tecnicaId = depois.tecnicaId
      const jaAcertara = antes !== null && alvosResolvidosAgora(null, antes).some((alvo) => acertouOAlvo(alvo) === true)
      if (tecnicaId !== undefined && !jaAcertara && agora.some((alvo) => acertouOAlvo(alvo) === true)) noAcumulador(quem, { quando: 'acertaComTecnica', tecnica: { id: tecnicaId, nome: depois.nome } })
    }
    // Rework das habilidades (D6, E5): o que dispara os gatilhos das passivas montadas fica na fila até a linha gravar
    // (`avisarQuemCaiu`): quem acertou ("Ao acertar", com o alvo), quem apanhou ("Ao receber dano", com quem bateu, e
    // "Vida abaixo de N%") e quem caiu ("Ao cair").
    if (sistema !== null) {
      const quemBateu = new Map<string, string>()
      for (const { antes, depois } of golpes) {
        const quem = depois.atacantePersonagemId
        for (const alvo of alvosResolvidosAgora(antes, depois)) {
          if (acertouOAlvo(alvo) !== true) continue
          if (alvo.personagemId !== null && !quemBateu.has(alvo.personagemId)) quemBateu.set(alvo.personagemId, depois.atacanteTokenId)
          if (quem !== null) filaDosGatilhos.push({ momento: 'aoAcertar', personagemId: quem, alvoTokenId: alvo.tokenId })
        }
      }
      for (const personagemId of apanharam.keys()) {
        const atacante = quemBateu.get(personagemId)
        filaDosGatilhos.push(atacante === undefined ? { momento: 'aoReceber', personagemId } : { momento: 'aoReceber', personagemId, alvoTokenId: atacante })
        filaDosGatilhos.push({ momento: cairam.has(personagemId) ? 'aoCair' : 'vidaAbaixo', personagemId })
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
    // D7: a técnica "Ligar e manter" que a linha ligou (nova em `mantidas`) põe o selo `ligada` no dono.
    if (sistema !== null) {
      for (const parte of partes.flatMap(partesSoltas)) {
        if (parte.tipo !== 'combate') continue
        const personagem = personagens.find((candidato) => candidato.id === parte.personagemId)
        const jaEram = new Set(parte.antes?.mantidas ?? [])
        for (const cartaoId of parte.depois.mantidas ?? []) {
          const ligada = personagem === undefined || jaEram.has(cartaoId) ? null : comOSeloDaLigada(novos, personagem, sistema, cartaoId)
          if (ligada === null) continue
          novos = ligada.turnos
          novas.push(ligada.parte)
        }
      }
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
      if (definicoes.length > 0) depois = comOEventoNosAcumuladores(depois, definicoes, { quando: 'usaTecnica', tecnica: { id: acao.cartaoId, nome: acao.nome } }, turnos.rodada)
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
  return { mesa, deps, set, get, mesaDoRpg, cenaDe, gravarCena, mudarTurnos, avisarQuemCaiu, comAvisoDeQuemCaiu, revelarAoUsar, ocultoParaQuemPede, lembrarDepoisDoDano, rastrear, anotarAcao, desfazerLinha, dispararGatilhos, aplicarDisparo }
}

/** O que `criarNucleo` devolve. */
export type NucleoDaBatalha = ReturnType<typeof criarNucleo>
