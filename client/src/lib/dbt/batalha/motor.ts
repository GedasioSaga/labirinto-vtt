import { agir } from './acoes'
import { resolverJanela } from './ataque'
import { aplicarCondicao, pedirQueda, tirarCondicao } from './condicoes'
import { casasDoDeslocamento, kiDaCorrida, modEfetivo, temCondicao } from './contas'
import type { FichaLida } from './leitura'
import { comecar, iniciarTurno, inserirNaOrdem, passarAVez, rolarIniciativas, terminarTurno } from './ordem'
import { responder } from './pendencias'
import {
  combatente,
  ehMestre,
  envolver,
  escrever,
  fichaDe,
  mudarCombatente,
  novoTrabalho,
  pkDe,
  porRecurso,
  rolarD20,
  tipoDaLinha,
  tirarPendencia,
  type ContextoDBT,
  type Trabalho,
} from './trabalho'
import {
  DETALHES_MAX,
  PASSO_DE_CORRIDA_M,
  type AcaoDoMestreDBT,
  type AutorDBT,
  type ComandoDBT,
  type CombatenteDBT,
  type EfeitoDBT,
  type EntranteDBT,
  type LinhaDBT,
  type NucleoDBT,
  type OpcoesDaBatalhaDBT,
} from './tipos'

export type { ContextoDBT } from './trabalho'

/**
 * MOTOR PURO (docs/planos/dbt-batalha.md, seção 1.1): `reduzir(núcleo,
 * comando, autor, ctx)` devolve o núcleo novo, os PV/PK finais das fichas, a
 * linha do registro e os efeitos. Sem store, sem rede, sem relógio, sem
 * `Math.random`: dado, id e hora entram por `ctx`.
 */

export interface ResultadoDBT {
  nucleo: NucleoDBT
  /** Valores finais (não deltas) de quem o comando tocou. */
  fichas: readonly { personagemId: string; pv: number; pk: number }[]
  linha: Omit<LinhaDBT, 'id' | 'seq' | 'quando' | 'reversao' | 'desfeita'> | null
  efeitos: readonly Omit<EfeitoDBT, 'seq'>[]
  /** Núcleo inalterado. */
  recusa?: string
}

export const OPCOES_PADRAO: OpcoesDaBatalhaDBT = { modo: 'automatico', exaustao: true, salvaguardaDeNpc: false }

function combatenteNovo(entrante: EntranteDBT, rodada: number): CombatenteDBT {
  return {
    id: entrante.tokenId,
    personagemId: entrante.personagemId,
    nome: entrante.nome,
    lado: entrante.lado,
    npc: entrante.npc,
    iniciativa: null,
    turnosJogados: 0,
    kiBloqueado: 0,
    kiDebito: 0,
    transformacao: null,
    voo: 0,
    agarrado: null,
    condicoes: [],
    imuneA: [],
    temporarios: [],
    morte: { sucessos: 0, falhas: 0, situacao: 'de-pe' },
    perdeProximoTurno: null,
    natural20: false,
    natural1: false,
    carga: null,
    mantendo: null,
    acaoOculta: null,
    reacaoEmDesvantagem: false,
    usos: { tecnicaDeRankMaximo: 0, transfInferiores: [], transfMaxima: 0, choque: false },
    entrouNaRodada: rodada,
  }
}

/** O núcleo do Iniciar: fase iniciativa e, se alguém tem forma, a pendência "transformar antes?" (5.1). */
export function nucleoInicial(entrantes: readonly EntranteDBT[], opcoes: Partial<OpcoesDaBatalhaDBT>, fichas: ReadonlyMap<string, FichaLida | null>, gerarId: () => string): NucleoDBT {
  const combatentes: Record<string, CombatenteDBT> = {}
  for (const entrante of entrantes) if (!Object.hasOwn(combatentes, entrante.tokenId)) combatentes[entrante.tokenId] = combatenteNovo(entrante, 0)
  const ids = Object.keys(combatentes)
  const faltam = ids.filter((id) => {
    const personagemId = combatentes[id].personagemId
    return personagemId !== null && (fichas.get(personagemId)?.transformacoes.length ?? 0) > 0
  })
  return {
    fase: 'iniciativa',
    opcoes: { ...OPCOES_PADRAO, ...opcoes },
    combatentes,
    ordem: { cartas: ids, vez: null, rodada: 0 },
    turno: null,
    pendencias: faltam.length === 0 ? [] : [{ id: gerarId(), responde: { tipo: 'mestre' }, tipo: 'declaracao', faltam }],
  }
}

function declarar(t: Trabalho, comando: Extract<ComandoDBT, { tipo: 'declarar' }>): string | null {
  const pendencia = t.nucleo.pendencias.find((candidata) => candidata.tipo === 'declaracao')
  if (t.nucleo.fase !== 'iniciativa' || pendencia === undefined || pendencia.tipo !== 'declaracao') return 'Não é hora de declarar'
  if (!pendencia.faltam.includes(comando.combatenteId)) return 'Já declarou'
  const c = combatente(t, comando.combatenteId)
  const f = fichaDe(t, c)
  if (c === undefined || f === null) return 'Sem ficha'
  tipoDaLinha(t, 'iniciativa')
  envolver(t, c.id)
  if (comando.transformacaoId !== null) {
    const forma = f.transformacoes.find((candidata) => candidata.id === comando.transformacaoId)
    if (forma === undefined) return 'Transformação não existe'
    // Provisória até a iniciativa: o custo e o uso entram em `rolarIniciativas` (0 com 20 natural).
    mudarCombatente(t, c.id, (atual) => ({ ...atual, transformacao: { id: forma.id, nome: forma.nome, estagio: forma.estagio, epBonus: forma.epBonus, maxima: forma.maxima, desdeRodada: 0 } }))
    escrever(t, `${c.nome} vai se transformar antes do combate: ${forma.nome}`, `${c.nome} declarou`)
  } else escrever(t, `${c.nome} não se transforma antes`, `${c.nome} declarou`)
  const faltam = pendencia.faltam.filter((id) => id !== c.id)
  t.nucleo = {
    ...t.nucleo,
    pendencias: faltam.length === 0 ? t.nucleo.pendencias.filter((candidata) => candidata.id !== pendencia.id) : t.nucleo.pendencias.map((candidata) => (candidata.id === pendencia.id ? { ...pendencia, faltam } : candidata)),
  }
  return null
}

/**
 * Movimento aceito pelo host (seção 11): conta as casas do turno; casas além
 * do deslocamento cobram Correr. Sem Ki, só a linha (o mestre decide).
 */
function andou(t: Trabalho, tokenId: string, blocos: number): string | null {
  const c = combatente(t, tokenId)
  if (c === undefined || !Number.isFinite(blocos) || blocos <= 0) return 'Movimento inválido'
  tipoDaLinha(t, 'movimento')
  envolver(t, tokenId)
  const turno = t.nucleo.turno
  if (turno === null || turno.combatenteId !== tokenId) {
    escrever(t, `${c.nome} moveu fora da vez`, '')
    return null
  }
  if (temCondicao(c, 'enraizado') || temCondicao(c, 'paralisado') || c.agarrado !== null) escrever(t, `${c.nome} não devia se mover (Enraizado, Paralisado ou Agarrado): o mestre decide`, '')
  const andadas = turno.andou + Math.trunc(blocos)
  const f = fichaDe(t, c)
  // Sem mapa aberto: a casa padrão do livro (1,5 m, o passo da corrida).
  const metros = t.ctx.posicoes?.metrosPorCasa ?? PASSO_DE_CORRIDA_M
  const casas = casasDoDeslocamento(metros, f?.deslocamentoM, temCondicao(c, 'caido'))
  const alem = Math.max(0, andadas - casas - turno.casasCobradas)
  t.nucleo = { ...t.nucleo, turno: { ...turno, andou: andadas } }
  if (alem === 0 || f === null) return null
  const ki = kiDaCorrida(alem, metros)
  const antes = pkDe(t, f)
  if (antes < ki) {
    escrever(t, `${c.nome} correu além do deslocamento sem Ki para isso: o mestre decide`)
    return null
  }
  porRecurso(t, f, 'pk', antes - ki)
  const agora = t.nucleo.turno
  if (agora !== null) t.nucleo = { ...t.nucleo, turno: { ...agora, casasCobradas: agora.casasCobradas + alem } }
  escrever(t, `${c.nome} correu ${alem * metros} m: Ki ${antes} -> ${pkDe(t, f)}`, `${c.nome} correu`)
  return null
}

function passar(t: Trabalho, comando: Extract<ComandoDBT, { tipo: 'passar' }>): string | null {
  const c = combatente(t, comando.vez.combatenteId)
  if (t.nucleo.fase !== 'combate' || c === undefined || t.nucleo.ordem.vez !== c.id) return 'Não é a vez dele'
  if (comando.vez.rodada !== t.nucleo.ordem.rodada || comando.vez.turno !== c.turnosJogados) return 'A vez já mudou'
  if (t.nucleo.pendencias.length > 0) return 'Há uma resposta pendente'
  tipoDaLinha(t, 'vez')
  escrever(t, `${c.nome} passa a vez`)
  passarAVez(t)
  return null
}

function acaoDoMestre(t: Trabalho, acao: AcaoDoMestreDBT): string | null {
  tipoDaLinha(t, 'mestre')
  const rodada = t.nucleo.ordem.rodada
  switch (acao.tipo) {
    case 'modo':
      t.nucleo = { ...t.nucleo, opcoes: { ...t.nucleo.opcoes, modo: acao.modo } }
      escrever(t, `Mestre muda para o modo ${acao.modo === 'manual' ? 'manual' : 'automático'}`)
      return null
    case 'opcoes':
      t.nucleo = { ...t.nucleo, opcoes: { ...t.nucleo.opcoes, ...(acao.exaustao === undefined ? {} : { exaustao: acao.exaustao }), ...(acao.salvaguardaDeNpc === undefined ? {} : { salvaguardaDeNpc: acao.salvaguardaDeNpc }) } }
      escrever(t, 'Mestre muda as opções da batalha')
      return null
    case 'porCondicao': {
      if (combatente(t, acao.combatenteId) === undefined) return 'Fora da batalha'
      const cd = acao.cd === undefined || !Number.isFinite(acao.cd) ? null : Math.trunc(acao.cd)
      aplicarCondicao(t, acao.combatenteId, { condicao: acao.condicao, origem: { combatenteId: null, tecnicaId: null, tecnicaNome: 'Mestre', kiDaTecnica: 0 }, cd, ...(acao.nome === undefined ? {} : { nome: acao.nome.slice(0, 60) }) })
      return null
    }
    case 'tirarCondicao':
      tirarCondicao(t, acao.combatenteId, acao.condicaoId, 'mestre')
      return null
    case 'temporario': {
      const c = combatente(t, acao.combatenteId)
      if (c === undefined) return 'Fora da batalha'
      const temporario = { id: t.ctx.gerarId(), rotulo: acao.rotulo.slice(0, 60), acerto: Math.trunc(acao.acerto), ca: Math.trunc(acao.ca), dano: Math.trunc(acao.dano), ateRodada: acao.rodadas === null ? null : rodada + Math.max(1, Math.trunc(acao.rodadas)) - 1 }
      mudarCombatente(t, c.id, (atual) => ({ ...atual, temporarios: [...atual.temporarios, temporario] }))
      escrever(t, `Mestre dá a ${c.nome}: ${temporario.rotulo}`)
      return null
    }
    case 'tirarTemporario':
      mudarCombatente(t, acao.combatenteId, (atual) => ({ ...atual, temporarios: atual.temporarios.filter((temporario) => temporario.id !== acao.temporarioId) }))
      escrever(t, `Mestre tira um modificador de ${combatente(t, acao.combatenteId)?.nome ?? '?'}`)
      return null
    case 'lado':
      mudarCombatente(t, acao.combatenteId, (atual) => ({ ...atual, lado: acao.lado.slice(0, 80) }))
      escrever(t, `Mestre troca o lado de ${combatente(t, acao.combatenteId)?.nome ?? '?'}`)
      return null
    case 'desvantagem':
      mudarCombatente(t, acao.combatenteId, (atual) => ({ ...atual, reacaoEmDesvantagem: acao.ligada }))
      escrever(t, `Reação em Desvantagem ${acao.ligada ? 'ligada' : 'desligada'} para ${combatente(t, acao.combatenteId)?.nome ?? '?'}`)
      return null
    case 'derrubar': {
      const c = combatente(t, acao.combatenteId)
      if (c === undefined || c.voo === 0) return 'Não está voando'
      pedirQueda(t, c.id, !temCondicao(c, 'desequilibrado'))
      return null
    }
    case 'acaoGratuita': {
      const turno = t.nucleo.turno
      if (acao.motivo === 'oportunidade' && turno !== null && turno.combatenteId === acao.contra && turno.desengajouDe.includes(acao.combatenteId)) return 'Ele desengajou deste combatente'
      const c = combatente(t, acao.combatenteId)
      if (c === undefined || combatente(t, acao.contra) === undefined) return 'Fora da batalha'
      t.nucleo = { ...t.nucleo, pendencias: [{ id: t.ctx.gerarId(), responde: c.npc ? { tipo: 'mestre' } : { tipo: 'combatente', id: c.id }, tipo: 'acaoGratuita', combatenteId: c.id, contra: acao.contra, motivo: acao.motivo }, ...t.nucleo.pendencias] }
      escrever(t, `Mestre abre ${acao.motivo === 'oportunidade' ? 'ataque de oportunidade' : 'ação gratuita'} de ${c.nome}`)
      return null
    }
    case 'dispararOculta': {
      const c = combatente(t, acao.combatenteId)
      if (c?.acaoOculta === null || c === undefined) return 'Sem Ação Oculta'
      escrever(t, `${c.nome} dispara a Ação Oculta: ${c.acaoOculta.texto} (o mestre resolve)`, `${c.nome} dispara a Ação Oculta`)
      mudarCombatente(t, c.id, (atual) => ({ ...atual, acaoOculta: null }))
      return null
    }
    case 'darAVez': {
      if (t.nucleo.fase !== 'combate' || combatente(t, acao.combatenteId) === undefined) return 'Fora do combate'
      const vez = t.nucleo.ordem.vez
      if (vez !== null) terminarTurno(t, vez)
      escrever(t, `Mestre dá a vez a ${combatente(t, acao.combatenteId)?.nome ?? '?'}`)
      iniciarTurno(t, acao.combatenteId)
      return null
    }
    case 'moverCarta': {
      const cartas = t.nucleo.ordem.cartas.filter((id) => id !== acao.combatenteId)
      if (cartas.length === t.nucleo.ordem.cartas.length) return 'Fora da ordem'
      const posicao = Math.min(cartas.length, Math.max(0, Math.trunc(acao.posicao)))
      t.nucleo = { ...t.nucleo, ordem: { ...t.nucleo.ordem, cartas: [...cartas.slice(0, posicao), acao.combatenteId, ...cartas.slice(posicao)] } }
      escrever(t, `Mestre move ${combatente(t, acao.combatenteId)?.nome ?? '?'} na ordem`)
      return null
    }
    case 'incluir': {
      const { entrante } = acao
      if (combatente(t, entrante.tokenId) !== undefined) return 'Já está na batalha'
      const novo = combatenteNovo(entrante, rodada)
      t.nucleo = { ...t.nucleo, combatentes: { ...t.nucleo.combatentes, [novo.id]: novo } }
      const f = fichaDe(t, novo)
      const d20 = acao.total === undefined ? rolarD20(t) : 0
      const total = acao.total !== undefined && Number.isFinite(acao.total) ? Math.trunc(acao.total) : d20 + (f === null ? 0 : modEfetivo(novo, f, 'des') + f.epBase)
      mudarCombatente(t, novo.id, (atual) => ({ ...atual, iniciativa: { d20, total, destreza: f?.atributos.des ?? 0, desempate: null, transformou: null, digitada: acao.total !== undefined }, natural20: d20 === 20, natural1: d20 === 1 }))
      inserirNaOrdem(t, novo.id, total)
      envolver(t, novo.id)
      escrever(t, `${novo.nome} entra na batalha (iniciativa ${total})`)
      return null
    }
    case 'tirar': {
      const c = combatente(t, acao.combatenteId)
      if (c === undefined) return 'Fora da batalha'
      if (t.nucleo.ordem.vez === c.id) passarAVez(t)
      const resto = Object.fromEntries(Object.entries(t.nucleo.combatentes).filter(([id]) => id !== c.id))
      t.nucleo = {
        ...t.nucleo,
        combatentes: resto,
        ordem: { ...t.nucleo.ordem, cartas: t.nucleo.ordem.cartas.filter((id) => id !== c.id), vez: t.nucleo.ordem.vez === c.id ? null : t.nucleo.ordem.vez },
        pendencias: t.nucleo.pendencias.filter((pendencia) => !(pendencia.responde.tipo === 'combatente' && pendencia.responde.id === c.id)),
      }
      escrever(t, `${c.nome} sai da batalha`)
      return null
    }
    case 'resolverReacoes': {
      const ativa = t.nucleo.pendencias[0]
      if (ativa === undefined || ativa.tipo !== 'reacao') return 'Nenhuma janela aberta'
      tirarPendencia(t, ativa.id)
      resolverJanela(t, ativa.janela)
      return null
    }
    case 'descartarPendencia':
      if (!t.nucleo.pendencias.some((pendencia) => pendencia.id === acao.pendenciaId)) return 'Pendência não existe'
      tirarPendencia(t, acao.pendenciaId)
      escrever(t, 'Mestre descarta uma pendência')
      return null
    case 'situacao':
      mudarCombatente(t, acao.combatenteId, (atual) => ({ ...atual, morte: { sucessos: 0, falhas: 0, situacao: acao.situacao } }))
      escrever(t, `Mestre põe ${combatente(t, acao.combatenteId)?.nome ?? '?'} como ${acao.situacao}`)
      return null
  }
}

function despachar(t: Trabalho, comando: ComandoDBT): string | null {
  const mestre = ehMestre(t.autor)
  switch (comando.tipo) {
    case 'declarar':
      return declarar(t, comando)
    case 'rolarIniciativa':
      if (!mestre) return 'Só o mestre rola a iniciativa'
      if (t.nucleo.fase !== 'iniciativa') return 'O combate já começou'
      rolarIniciativas(t, comando.digitados)
      return null
    case 'ordenar': {
      if (!mestre) return 'Só o mestre ordena'
      const atuais = t.nucleo.ordem.cartas
      if (comando.ordem.length !== atuais.length || !atuais.every((id) => comando.ordem.includes(id))) return 'A ordem precisa ter as mesmas cartas'
      t.nucleo = { ...t.nucleo, ordem: { ...t.nucleo.ordem, cartas: [...comando.ordem] } }
      tipoDaLinha(t, 'iniciativa')
      escrever(t, 'Mestre reordena a iniciativa')
      return null
    }
    case 'comecar':
      if (!mestre) return 'Só o mestre começa'
      if (t.nucleo.fase !== 'iniciativa') return 'O combate já começou'
      if (Object.values(t.nucleo.combatentes).some((c) => c.iniciativa === null)) return 'Role a iniciativa antes'
      comecar(t)
      return null
    case 'agir':
      return agir(t, comando)
    case 'responder':
      return responder(t, comando)
    case 'passar':
      return passar(t, comando)
    case 'andou':
      return andou(t, comando.tokenId, comando.blocos)
    case 'mestre':
      return mestre ? acaoDoMestre(t, comando.acao) : 'Só o mestre'
  }
}

/** Monta a linha: o primeiro pedaço é o texto; os outros, os detalhes. Pedaço só do mestre fica fora do público. */
function linhaDoTrabalho(t: Trabalho): ResultadoDBT['linha'] {
  if (t.textos.length === 0) return null
  const publicos = t.publicos.filter((texto) => texto !== '')
  return {
    rodada: t.nucleo.ordem.rodada,
    autor: t.autor,
    tipo: t.tipo ?? 'acao',
    texto: t.textos[0],
    detalhes: t.textos.slice(1, 1 + DETALHES_MAX),
    textoPublico: publicos[0] ?? '',
    detalhesPublicos: publicos.slice(1, 1 + DETALHES_MAX),
    envolve: { tokenIds: [...t.tokenIds], personagemIds: [...t.personagemIds] },
    comD20: t.comD20,
  }
}

export function reduzir(nucleo: NucleoDBT, comando: ComandoDBT, autor: AutorDBT, ctx: ContextoDBT): ResultadoDBT {
  const t = novoTrabalho(nucleo, ctx, autor)
  const recusa = despachar(t, comando)
  if (recusa !== null) return { nucleo, fichas: [], linha: null, efeitos: [], recusa }
  const fichas = [...t.tocadas].flatMap((personagemId) => {
    const recursos = t.recursos.get(personagemId)
    return recursos === undefined ? [] : [{ personagemId, pv: recursos.pv, pk: recursos.pk }]
  })
  return { nucleo: t.nucleo, fichas, linha: linhaDoTrabalho(t), efeitos: [...t.efeitos] }
}

/** Leitura sem efeito (opções para a tela e o host): um trabalho que nunca rola dado. */
export function trabalhoDeLeitura(nucleo: NucleoDBT, fichas: ReadonlyMap<string, FichaLida | null>): Trabalho {
  return novoTrabalho(nucleo, { fichas, posicoes: null, rolar: () => 1, gerarId: () => '', agora: 0 }, { tipo: 'mestre' })
}
