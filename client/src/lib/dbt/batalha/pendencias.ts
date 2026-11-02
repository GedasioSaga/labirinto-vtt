import { aplicarResultado, editarAtaque, iniciarAtaque, opcoesDeReacao, pagarAtaque, resolverJanela, responderJanela, seguirAtaque } from './ataque'
import { apostarNoChoque, tecnicaOfensiva } from './choque'
import { cair, reacaoDobrada, testeDeAtributo } from './condicoes'
import { custoEfetivo } from './contas'
import { rolarSalvaguarda } from './morte'
import { passarAVez } from './ordem'
import { combatente, ehMestre, escrever, fichaDe, mudarCombatente, nomeDe, pkDe, porRecurso, tecnicaDe, tipoDaLinha, tirarPendencia, trocarPendencia, type Trabalho } from './trabalho'
import { CD_ESTABILIZAR, KI_ESTABILIZAR, type ComandoDBT, type IdDoCombatente, type OpcaoDaPendencia, type Pendencia } from './tipos'

/**
 * RESPONDER A QUALQUER PENDÊNCIA (docs/planos/dbt-batalha.md, seções 1.6 e
 * 16). `opcoesDaPendencia` enumera; `responder` confere a chave contra a
 * mesma lista. O mestre sempre pode responder por qualquer um.
 */

function simples(chave: string, rotulo: string, ki = 0, bloqueio: string | null = null, pede: OpcaoDaPendencia['pede'] = null): OpcaoDaPendencia {
  return { chave, rotulo, ki, gratis: ki === 0, bloqueio, pede }
}

function tecnicasDeAtaque(t: Trabalho, id: IdDoCombatente, gratis: boolean): OpcaoDaPendencia[] {
  const f = fichaDe(t, combatente(t, id))
  if (f === null) return []
  return f.tecnicas.filter(tecnicaOfensiva).map((tecnica) => {
    const ki = gratis ? 0 : tecnica.ki
    return simples(`tecnica:${tecnica.id}`, tecnica.nome, ki, pkDe(t, f) < ki ? 'Ki insuficiente' : null)
  })
}

/** As respostas possíveis de `quem` (combatente; null = o mestre) a esta pendência. */
export function opcoesDaPendencia(t: Trabalho, pendencia: Pendencia, quem: IdDoCombatente | null): OpcaoDaPendencia[] {
  switch (pendencia.tipo) {
    case 'declaracao':
      return [simples('rolar', 'Rolar já (quem não declarou não transforma)')]
    case 'confirmar': {
      const opcoes = [simples('confirmar', 'Confirmar')]
      if ((pendencia.etapa === 'ataque' || pendencia.etapa === 'especial') && pendencia.ataque?.kiPago !== true) opcoes.push(simples('cancelar', 'Cancelar ação'))
      return opcoes
    }
    case 'reacao': {
      const id = quem ?? pendencia.janela.ataque.alvoId
      const opcoes = opcoesDeReacao(t, pendencia.janela, id)
      if (quem !== null && !pendencia.janela.convidados.includes(quem)) return [simples('entrar', 'Reagir também', 0, opcoes.some((opcao) => opcao.chave !== 'nao' && opcao.bloqueio === null) ? null : 'Sem reação pagável')]
      return quem === null ? [...opcoes, simples('resolver', 'Resolver reações')] : opcoes
    }
    case 'teste':
      return [simples('rolar', 'Rolar', 0, null, pendencia.teste.motivo === 'agarrao' ? 'atributo' : null)]
    case 'salvaguarda':
      return [simples('rolar', 'Rolar a salvaguarda')]
    case 'choque':
      return [simples('apostar', 'Apostar e rolar', 0, null, 'aposta')]
    case 'apoioAoChoque':
      return [simples('fechar', 'Fechar (sem Choque)')]
    case 'acaoGratuita':
      return [...tecnicasDeAtaque(t, pendencia.combatenteId, pendencia.motivo !== 'oportunidade'), simples('nao', 'Não usar')]
    case 'ataqueForcado':
      return [...tecnicasDeAtaque(t, pendencia.combatenteId, false), simples('nao', 'O mestre resolve à mão')]
    case 'inicioDoTurno': {
      const opcoes: OpcaoDaPendencia[] = []
      const c = combatente(t, pendencia.combatenteId)
      const f = fichaDe(t, c)
      for (const escolha of pendencia.escolhas) {
        if (escolha === 'manterRajada') {
          const ki = c?.mantendo === null || c === undefined ? 0 : (tecnicaDe(t, c.id, c.mantendo.tecnicaId)?.ki ?? 0)
          opcoes.push(simples('manterRajada', 'Manter a Rajada Contínua', ki, f !== null && pkDe(t, f) < ki ? 'Ki insuficiente' : null), simples('soltarRajada', 'Soltar a Rajada'))
        }
        if (escolha === 'continuarCarga') opcoes.push(simples('continuarCarga', 'Continuar carregando (passa a vez)'), simples('dispararCarga', 'Disparar neste turno'))
        if (escolha === 'tentarSoltar') opcoes.push(simples('tentarSoltar', 'Tentar se soltar'))
      }
      opcoes.push(simples('pronto', 'Seguir o turno'))
      return opcoes
    }
    case 'queda': {
      const c = combatente(t, pendencia.combatenteId)
      const f = fichaDe(t, c)
      const ki = c === undefined ? KI_ESTABILIZAR : custoEfetivo(KI_ESTABILIZAR, { sobrecarregado: false, reacaoDobrada: reacaoDobrada(c), choque: false })
      const bloqueio = !pendencia.podeEstabilizar ? 'Desequilibrado' : f === null || pkDe(t, f) < ki ? 'Ki insuficiente' : null
      return [simples('estabilizar', 'Estabilizar o voo (DES CD 15)', ki, bloqueio), simples('cair', 'Cair')]
    }
  }
}

/** Quem pode responder: o mestre sempre; o jogador, só a pendência endereçada ao combatente dele (o host confere a posse). */
function enderecadaA(pendencia: Pendencia, quem: IdDoCombatente | null): boolean {
  if (quem === null) return false
  if (pendencia.tipo === 'reacao') return true
  if (pendencia.tipo === 'choque') return quem === pendencia.choque.atacanteId || quem === pendencia.choque.defensorId
  return pendencia.responde.tipo === 'combatente' && pendencia.responde.id === quem
}

function confirmar(t: Trabalho, pendencia: Extract<Pendencia, { tipo: 'confirmar' }>, comando: Extract<ComandoDBT, { tipo: 'responder' }>): string | null {
  const ataque = pendencia.ataque
  if (ataque === undefined) {
    tirarPendencia(t, pendencia.id)
    return null
  }
  const doGrupo = t.nucleo.pendencias.filter((outra): outra is Extract<Pendencia, { tipo: 'confirmar' }> => outra.tipo === 'confirmar' && outra.id !== pendencia.id && outra.ataque?.grupo === ataque.grupo)
  if (comando.opcao === 'cancelar') {
    if (ataque.kiPago) return 'O Ki já foi pago'
    for (const outra of [pendencia, ...doGrupo]) tirarPendencia(t, outra.id)
    escrever(t, `Mestre cancela ${ataque.tecnica.nome} de ${nomeDe(t, ataque.atacanteId)}`)
    return null
  }
  const edicoes = comando.edicoes ?? {}
  tirarPendencia(t, pendencia.id)
  tipoDaLinha(t, 'tecnica')
  if (pendencia.etapa === 'resolucao') {
    aplicarResultado(t, editarAtaque(t, ataque, edicoes), edicoes)
    return null
  }
  if (pendencia.etapa === 'teste') return null
  let editado = editarAtaque(t, ataque, edicoes)
  // Sem edição do mestre, vale o do pedido (ação gratuita: o atacante não reage).
  const semJanela = edicoes.abrirReacoes === undefined ? editado.semJanela : !edicoes.abrirReacoes
  if (!editado.kiPago) {
    if (edicoes.gastarKi !== false) pagarAtaque(t, [editado, ...doGrupo.flatMap((outra) => (outra.ataque === undefined ? [] : [outra.ataque]))], semJanela)
    editado = { ...editado, kiPago: true }
    for (const outra of doGrupo) if (outra.ataque !== undefined) trocarPendencia(t, { ...outra, ataque: { ...outra.ataque, kiPago: true } })
  }
  seguirAtaque(t, editado, semJanela)
  return null
}

function inicioDoTurno(t: Trabalho, pendencia: Extract<Pendencia, { tipo: 'inicioDoTurno' }>, opcao: string): string | null {
  const id = pendencia.combatenteId
  const c = combatente(t, id)
  if (c === undefined) return 'Combatente fora da batalha'
  const restantes = (tirar: 'manterRajada' | 'continuarCarga' | 'tentarSoltar'): void => {
    const escolhas = pendencia.escolhas.filter((escolha) => escolha !== tirar)
    if (escolhas.length === 0) tirarPendencia(t, pendencia.id)
    else trocarPendencia(t, { ...pendencia, escolhas })
  }
  switch (opcao) {
    case 'pronto':
      tirarPendencia(t, pendencia.id)
      return null
    case 'soltarRajada':
      mudarCombatente(t, id, (atual) => ({ ...atual, mantendo: null }))
      escrever(t, `${c.nome} solta a Rajada Contínua`)
      restantes('manterRajada')
      return null
    case 'manterRajada': {
      const mantendo = c.mantendo
      const tecnica = mantendo === null ? undefined : tecnicaDe(t, id, mantendo.tecnicaId)
      if (mantendo === null || tecnica === undefined) return 'Sem Rajada para manter'
      const alvos = mantendo.alvos.filter((alvo) => combatente(t, alvo) !== undefined)
      restantes('manterRajada')
      escrever(t, `${c.nome} mantém a Rajada Contínua`)
      iniciarAtaque(t, { atacanteId: id, alvos, tecnica, modo: 'dano', basicos: 1, cargasKi: 0, profundidade: 0, gratis: false, semJanela: false, reacao: false, totalFixo: mantendo.total })
      return null
    }
    case 'continuarCarga':
      mudarCombatente(t, id, (atual) => (atual.carga === null ? atual : { ...atual, carga: { ...atual.carga, cargas: atual.carga.cargas + 1 } }))
      escrever(t, `${c.nome} continua carregando`)
      tirarPendencia(t, pendencia.id)
      passarAVez(t)
      return null
    case 'dispararCarga':
      restantes('continuarCarga')
      return null
    case 'tentarSoltar': {
      const agarrado = c.agarrado
      if (agarrado === null) return 'Não está agarrado'
      // Empate = continua preso (seção 11): precisa passar do acerto.
      const teste = testeDeAtributo(t, id, ['des', 'for'], agarrado.acerto + 1)
      tipoDaLinha(t, 'teste')
      if (teste.passou) mudarCombatente(t, id, (atual) => ({ ...atual, agarrado: null }))
      escrever(t, `${c.nome} tenta se soltar: d20 ${teste.d20}, ${teste.total} vs ${agarrado.acerto}: ${teste.passou ? 'livre' : 'continua preso'}`)
      restantes('tentarSoltar')
      return null
    }
    default:
      return 'Escolha fora das opções'
  }
}

/** Responde à pendência (comando `responder`). Devolve a recusa, ou null. */
export function responder(t: Trabalho, comando: Extract<ComandoDBT, { tipo: 'responder' }>): string | null {
  const pendencia = t.nucleo.pendencias.find((candidata) => candidata.id === comando.pendenciaId)
  if (pendencia === undefined) return 'Essa pendência já foi resolvida'
  if (t.nucleo.pendencias[0]?.id !== pendencia.id) return 'Responda a pendência da vez primeiro'
  const mestre = ehMestre(t.autor)
  const quem = comando.combatenteId
  if (!mestre && !enderecadaA(pendencia, quem)) return 'Não é com ele'
  const id = quem ?? (pendencia.responde.tipo === 'combatente' ? pendencia.responde.id : null)
  const opcoes = opcoesDaPendencia(t, pendencia, pendencia.tipo === 'reacao' && mestre && quem === null ? null : id)
  const escolhida = opcoes.find((opcao) => opcao.chave === comando.opcao)
  if (escolhida === undefined) return 'Resposta fora das opções'
  if (escolhida.bloqueio !== null) return escolhida.bloqueio
  switch (pendencia.tipo) {
    case 'declaracao':
      tirarPendencia(t, pendencia.id)
      return null
    case 'confirmar':
      return mestre ? confirmar(t, pendencia, comando) : 'Só o mestre confirma'
    case 'reacao':
      if (comando.opcao === 'resolver') {
        if (!mestre) return 'Só o mestre fecha a janela'
        tirarPendencia(t, pendencia.id)
        resolverJanela(t, pendencia.janela)
        return null
      }
      return responderJanela(t, pendencia, id ?? pendencia.janela.ataque.alvoId, comando.opcao)
    case 'teste': {
      const { teste } = pendencia
      const atributo = teste.motivo === 'agarrao' ? (comando.atributo ?? 'des') : null
      // Agarrão: empate fica livre; soltar-se: empate continua preso (seção 11).
      const contra = teste.motivo === 'soltar' ? teste.contra + 1 : teste.contra
      const resultado = testeDeAtributo(t, teste.combatenteId, atributo === null ? teste.atributos : [atributo], contra)
      const c = combatente(t, teste.combatenteId)
      tirarPendencia(t, pendencia.id)
      tipoDaLinha(t, 'teste')
      if (teste.motivo === 'agarrao' && !resultado.passou && teste.outroId !== null) {
        const porId = teste.outroId
        mudarCombatente(t, teste.combatenteId, (atual) => ({ ...atual, agarrado: { porId, acerto: teste.contra } }))
      }
      if (teste.motivo === 'soltar' && resultado.passou) mudarCombatente(t, teste.combatenteId, (atual) => ({ ...atual, agarrado: null }))
      const preso = combatente(t, teste.combatenteId)?.agarrado !== null
      escrever(t, `${c?.nome ?? '?'}, ${resultado.atributo.toUpperCase()}: d20 ${resultado.d20}, ${resultado.total} vs ${teste.contra}: ${preso ? 'agarrado' : 'livre'}`)
      return null
    }
    case 'salvaguarda': {
      tirarPendencia(t, pendencia.id)
      const digitado = mestre && comando.edicoes?.d20 !== undefined ? Math.min(20, Math.max(1, Math.trunc(comando.edicoes.d20))) : null
      rolarSalvaguarda(t, pendencia.combatenteId, digitado)
      // Salvaguarda do início do turno: rolou, a vez passa sozinha (6.1 passo 4).
      if (t.nucleo.turno?.combatenteId === pendencia.combatenteId) passarAVez(t)
      return null
    }
    case 'choque':
      if (id === null) return 'Diga de que lado é a aposta'
      return apostarNoChoque(t, pendencia, id, comando.aposta ?? 0)
    case 'apoioAoChoque':
      tirarPendencia(t, pendencia.id)
      return null
    case 'acaoGratuita':
    case 'ataqueForcado': {
      tirarPendencia(t, pendencia.id)
      if (comando.opcao === 'nao') return null
      const tecnica = tecnicaDe(t, pendencia.combatenteId, comando.opcao.slice('tecnica:'.length))
      const alvo = pendencia.tipo === 'acaoGratuita' ? pendencia.contra : pendencia.alvoSugerido
      if (tecnica === undefined || alvo === null) return 'Sem técnica ou alvo'
      const gratis = pendencia.tipo === 'acaoGratuita' && pendencia.motivo !== 'oportunidade'
      iniciarAtaque(t, { atacanteId: pendencia.combatenteId, alvos: [alvo], tecnica, modo: 'dano', basicos: 1, cargasKi: 0, profundidade: 1, gratis, semJanela: gratis, reacao: false })
      return null
    }
    case 'inicioDoTurno':
      return inicioDoTurno(t, pendencia, comando.opcao)
    case 'queda': {
      tirarPendencia(t, pendencia.id)
      if (comando.opcao === 'cair') {
        cair(t, pendencia.combatenteId)
        return null
      }
      const c = combatente(t, pendencia.combatenteId)
      const f = fichaDe(t, c)
      if (f !== null) porRecurso(t, f, 'pk', pkDe(t, f) - escolhida.ki)
      const teste = testeDeAtributo(t, pendencia.combatenteId, ['des'], CD_ESTABILIZAR)
      tipoDaLinha(t, 'voo')
      escrever(t, `${c?.nome ?? '?'} tenta estabilizar o voo: d20 ${teste.d20}, ${teste.total} vs CD ${CD_ESTABILIZAR}`)
      if (!teste.passou) cair(t, pendencia.combatenteId)
      return null
    }
  }
}
