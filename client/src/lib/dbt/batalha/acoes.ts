import { barreiraNaAcao, curarComTecnica, custoDaAcao, iniciarAtaque, type PedidoDeAtaque } from './ataque'
import { tecnicaOfensiva } from './choque'
import { tirarCondicao } from './condicoes'
import { epTotal, kiDeDesengajar, kiDeVoo, temCondicao } from './contas'
import { destransformar, transformar } from './formas'
import { conferirKiZerado } from './morte'
import { passarAVez } from './ordem'
import { combatente, envolver, escrever, fichaDe, foraDeCombate, mudarCombatente, nomeDe, pkDe, porRecurso, tipoDaLinha, type Trabalho } from './trabalho'
import { contarTecnicaPaga } from './uso'
import {
  ALVOS_MAX,
  BASICOS_ANUNCIADOS_MAX,
  BASICOS_ANUNCIADOS_MIN,
  CARGAS_KI_MAX,
  KI_OCULTO_MAX,
  TEXTO_DBT_MAX,
  type ComandoDBT,
  type IdDoCombatente,
  type NivelDeVoo,
  type OpcaoDeAcao,
} from './tipos'

/**
 * AÇÕES DO TURNO (docs/planos/dbt-batalha.md, seção 6.2). `opcoesDeAcao`
 * enumera tudo com custo e motivo de bloqueio (a opção nunca some); `agir`
 * confere a chave contra a MESMA lista antes de fazer qualquer coisa.
 */

const NIVEIS: readonly NivelDeVoo[] = [0, 1, 2, 3]

function opcao(parcial: Omit<OpcaoDeAcao, 'gratis' | 'alvosMax' | 'tecnicaId'> & Partial<Pick<OpcaoDeAcao, 'alvosMax' | 'tecnicaId'>>): OpcaoDeAcao {
  return { ...parcial, gratis: parcial.ki === 0, alvosMax: parcial.alvosMax ?? (parcial.alvo === 'nenhum' ? 0 : 1), tecnicaId: parcial.tecnicaId ?? null }
}

/** As ações do combatente agora (na vez dele), cada uma com custo e bloqueio. */
export function opcoesDeAcao(t: Trabalho, id: IdDoCombatente): OpcaoDeAcao[] {
  const c = combatente(t, id)
  const f = fichaDe(t, c)
  const narrativa = opcao({ chave: 'narrativa', rotulo: 'Ação narrativa', ki: 0, bloqueio: null, alvo: 'nenhum' })
  if (c === undefined || f === null) return [narrativa]
  const turno = t.nucleo.turno?.combatenteId === id ? t.nucleo.turno : null
  const pk = pkDe(t, f)
  const paralisado = temCondicao(c, 'paralisado')
  const lacuna = c.condicoes.find((ativa) => ativa.condicao === 'lacuna-mental')?.extra?.tecnicaBloqueada
  const semKi = (ki: number): string | null => (pk < ki ? 'Ki insuficiente' : null)
  const opcoes: OpcaoDeAcao[] = []
  for (const tecnica of f.tecnicas) {
    const ofensiva = tecnicaOfensiva(tecnica)
    const custo = custoDaAcao(t, { atacanteId: id, tecnica, basicos: 1, cargasKi: 0, gratis: false, reacao: false })
    let bloqueio: string | null = null
    if (tecnica.uso === 'reacao') bloqueio = 'Só como reação'
    else if (paralisado && ofensiva) bloqueio = 'Paralisado'
    else if (turno?.semTecnicas === true) bloqueio = 'Sem técnicas neste turno'
    else if (!tecnica.basica && turno?.tecnicasUsadas.includes(tecnica.id) === true) bloqueio = 'Já usada neste turno'
    else if (tecnica.barreira > 0 && !ofensiva && turno?.barreiraUsada === true) bloqueio = 'Uma barreira por turno'
    else if (ofensiva && tecnica.alcance.tipo !== 'area' && temCondicao(c, 'alucinacao-sensorial')) bloqueio = 'Alucinação: sem alvo único'
    else if (tecnica.alcance.tipo === 'longo' && temCondicao(c, 'cego')) bloqueio = 'Cego: sem longo alcance'
    else if (lacuna === tecnica.id) bloqueio = 'Bloqueada pela Lacuna Mental'
    else bloqueio = semKi(custo)
    const alvo = tecnica.cura ? 'aliado' : ofensiva ? 'inimigo' : 'nenhum'
    opcoes.push(opcao({ chave: `tecnica:${tecnica.id}`, rotulo: tecnica.nome, ki: custo, bloqueio, alvo, alvosMax: alvo === 'inimigo' && tecnica.alcance.tipo === 'area' ? ALVOS_MAX : undefined, tecnicaId: tecnica.id }))
    if (tecnica.acumulacao) {
      const outra = c.carga !== null && c.carga.tecnicaId !== tecnica.id ? 'Já carrega outra técnica' : null
      opcoes.push(opcao({ chave: `carregar:${tecnica.id}`, rotulo: `Carregar ${tecnica.nome} (gasta o turno)`, ki: 0, bloqueio: outra, alvo: 'nenhum', tecnicaId: tecnica.id }))
    }
  }
  const primeiroTurno = c.natural20 && c.turnosJogados <= 1
  for (const forma of f.transformacoes) {
    const ki = primeiroTurno ? 0 : forma.ki
    const bloqueio = c.transformacao?.id === forma.id ? 'Já nesta forma' : lacuna === forma.id ? 'Bloqueada pela Lacuna Mental' : semKi(ki)
    opcoes.push(opcao({ chave: `transformar:${forma.id}`, rotulo: `Transformar: ${forma.nome}`, ki, bloqueio, alvo: 'nenhum' }))
  }
  if (c.transformacao !== null) opcoes.push(opcao({ chave: 'destransformar', rotulo: 'Voltar à forma normal', ki: 0, bloqueio: null, alvo: 'nenhum' }))
  for (const nivel of NIVEIS) {
    if (nivel === c.voo) continue
    const ki = kiDeVoo(c.voo, nivel)
    const bloqueio = nivel > 0 && temCondicao(c, 'desequilibrado') ? 'Desequilibrado: não voa' : paralisado ? 'Paralisado' : semKi(ki)
    const rotulo = nivel === 0 ? 'Pousar' : c.voo === 0 ? `Decolar (nível ${nivel})` : `Voo: nível ${nivel}`
    opcoes.push(opcao({ chave: `voo:${nivel}`, rotulo, ki, bloqueio, alvo: 'nenhum' }))
  }
  opcoes.push(opcao({ chave: 'desengajar', rotulo: 'Desengajar', ki: kiDeDesengajar(0), bloqueio: paralisado ? 'Paralisado' : null, alvo: 'inimigo' }))
  opcoes.push(opcao({ chave: 'oculta', rotulo: 'Ação Oculta', ki: 0, bloqueio: c.acaoOculta !== null ? 'Já tem uma Ação Oculta' : null, alvo: 'nenhum' }))
  const caido = c.condicoes.find((ativa) => ativa.condicao === 'caido')
  if (caido !== undefined) opcoes.push(opcao({ chave: 'levantar', rotulo: 'Levantar', ki: caido.origem.kiDaTecnica, bloqueio: semKi(caido.origem.kiDaTecnica), alvo: 'nenhum' }))
  for (const movimento of f.movimentos) {
    if (movimento.ki === null || movimento.reacao) continue
    opcoes.push(opcao({ chave: `movimento:${movimento.id}`, rotulo: movimento.nome, ki: movimento.ki, bloqueio: semKi(movimento.ki), alvo: 'nenhum' }))
  }
  opcoes.push(narrativa)
  return opcoes
}

function pagar(t: Trabalho, id: IdDoCombatente, ki: number): boolean {
  const f = fichaDe(t, combatente(t, id))
  if (f === null || ki <= 0) return true
  const antes = pkDe(t, f)
  if (antes < ki) return false
  porRecurso(t, f, 'pk', antes - ki)
  escrever(t, `${nomeDe(t, id)}: Ki ${antes} -> ${pkDe(t, f)}`, '')
  conferirKiZerado(t, id, pkDe(t, f))
  return true
}

function inteiroEntre(valor: number | undefined, min: number, max: number): number | null {
  if (valor === undefined || !Number.isFinite(valor)) return null
  const inteiro = Math.trunc(valor)
  return inteiro < min || inteiro > max ? null : inteiro
}

/** `agir` (6.2): só na vez dele, com a fila vazia, e só com uma chave de `opcoesDeAcao` sem bloqueio. Devolve a recusa, ou null. */
export function agir(t: Trabalho, comando: Extract<ComandoDBT, { tipo: 'agir' }>): string | null {
  const { combatenteId: id } = comando
  const c = combatente(t, id)
  const f = fichaDe(t, c)
  if (t.nucleo.fase !== 'combate') return 'O combate não começou'
  if (c === undefined || t.nucleo.ordem.vez !== id) return 'Não é a vez dele'
  if (comando.vez.rodada !== t.nucleo.ordem.rodada || comando.vez.turno !== c.turnosJogados) return 'A vez já mudou'
  if (t.nucleo.pendencias.length > 0) return 'Há uma resposta pendente'
  if (foraDeCombate(c)) return 'Fora de combate'
  const escolhida = opcoesDeAcao(t, id).find((candidata) => candidata.chave === comando.opcao)
  if (escolhida === undefined) return 'Ação fora das opções'
  if (escolhida.bloqueio !== null) return escolhida.bloqueio
  const alvos = [...new Set(comando.alvos)]
  if (alvos.length > Math.max(escolhida.alvosMax, 0)) return 'Alvos demais'
  if (alvos.some((alvo) => combatente(t, alvo) === undefined)) return 'Alvo fora da batalha'
  if (escolhida.alvo !== 'nenhum' && alvos.length === 0) return 'Escolha o alvo'
  const [prefixo, resto = ''] = comando.opcao.split(/:(.*)/s)
  tipoDaLinha(t, 'acao')
  envolver(t, id, ...alvos)
  const extras = comando.extras ?? {}
  switch (prefixo) {
    case 'tecnica': {
      const tecnica = f?.tecnicas.find((candidata) => candidata.id === resto)
      if (tecnica === undefined) return 'Técnica não existe'
      // Cura, barreira e de efeito: o Sobrecarregado (x2 já no custo) e a exaustão contam como na ofensiva.
      const sobrecarga = escolhida.ki > 0 && tecnica.tipo === 'ki'
      if (tecnica.cura) {
        if (alvos[0] === id) return 'A cura não é em si'
        if (!pagar(t, id, escolhida.ki)) return 'Ki insuficiente'
        contarTecnicaPaga(t, id, tecnica, sobrecarga)
        marcarTecnica(t, id, tecnica.id)
        curarComTecnica(t, id, alvos[0], tecnica)
        return null
      }
      if (!tecnicaOfensiva(tecnica)) {
        if (!pagar(t, id, escolhida.ki)) return 'Ki insuficiente'
        contarTecnicaPaga(t, id, tecnica, sobrecarga)
        marcarTecnica(t, id, tecnica.id)
        if (tecnica.barreira > 0) barreiraNaAcao(t, id, tecnica)
        else escrever(t, `${c.nome} usa ${tecnica.nome}: o mestre aplica o efeito`)
        return null
      }
      if (c.agarrado !== null && alvos.some((alvo) => alvo !== c.agarrado?.porId)) return 'Agarrado: só ataca quem o agarra'
      const fisico = tecnica.tipo === 'fisica' && (tecnica.alcance.tipo === 'toque' || tecnica.alcance.tipo === 'curto')
      if (fisico && alvos.some((alvo) => (combatente(t, alvo)?.voo ?? 0) > c.voo)) return 'Alvo voando acima (9.5.7)'
      const turno = t.nucleo.turno
      let basicos = 1
      if (extras.basicos !== undefined) {
        const anunciados = inteiroEntre(extras.basicos, BASICOS_ANUNCIADOS_MIN, BASICOS_ANUNCIADOS_MAX)
        if (anunciados === null || !tecnica.basica || (turno?.basicosUsados ?? 0) > 0) return 'Mais de 3 básicos só anunciados antes do 1º'
        basicos = anunciados
        if (turno !== null) t.nucleo = { ...t.nucleo, turno: { ...turno, basicosAnunciados: anunciados } }
      }
      let cargasKi = 0
      if (extras.cargasKi !== undefined && extras.cargasKi > 0) {
        const cargas = inteiroEntre(extras.cargasKi, 1, CARGAS_KI_MAX)
        if (cargas === null || !tecnica.acumulacao || c.carga !== null) return 'Carga por Ki inválida'
        cargasKi = cargas
      }
      const pedido: PedidoDeAtaque = { atacanteId: id, alvos, tecnica, modo: extras.modo ?? 'dano', basicos, cargasKi, profundidade: 0, gratis: false, semJanela: false, reacao: false }
      if (f === null || pkDe(t, f) < custoDaAcao(t, pedido)) return 'Ki insuficiente'
      iniciarAtaque(t, pedido)
      return null
    }
    case 'carregar': {
      const cargas = c.carga?.tecnicaId === resto ? c.carga.cargas + 1 : 1
      mudarCombatente(t, id, (atual) => ({ ...atual, carga: { tecnicaId: resto, cargas } }))
      escrever(t, `${c.nome} carrega ${f?.tecnicas.find((tecnica) => tecnica.id === resto)?.nome ?? 'a técnica'} (${cargas})`)
      passarAVez(t)
      return null
    }
    case 'transformar': {
      const forma = f?.transformacoes.find((candidata) => candidata.id === resto)
      if (forma === undefined) return 'Transformação não existe'
      transformar(t, id, forma, escolhida.ki)
      return null
    }
    case 'destransformar':
      destransformar(t, id)
      return null
    case 'voo': {
      const nivel = NIVEIS.find((candidato) => String(candidato) === resto)
      if (nivel === undefined || !pagar(t, id, escolhida.ki)) return 'Voo inválido'
      tipoDaLinha(t, 'voo')
      mudarCombatente(t, id, (atual) => ({ ...atual, voo: nivel }))
      escrever(t, nivel === 0 ? `${c.nome} pousa` : `${c.nome} voa no nível ${nivel}`)
      return null
    }
    case 'desengajar': {
      const outro = combatente(t, alvos[0])
      if (outro === undefined) return 'Escolha de quem se afasta'
      const ki = kiDeDesengajar(epTotal(outro, fichaDe(t, outro)))
      if (!pagar(t, id, ki)) return 'Ki insuficiente'
      const turno = t.nucleo.turno
      if (turno !== null) t.nucleo = { ...t.nucleo, turno: { ...turno, desengajouDe: [...turno.desengajouDe, outro.id] } }
      escrever(t, `${c.nome} desengaja de ${outro.nome}`)
      return null
    }
    case 'oculta': {
      const ki = inteiroEntre(extras.kiOculto ?? 0, 0, KI_OCULTO_MAX)
      if (ki === null || !pagar(t, id, ki)) return 'Ki inválido para a Ação Oculta'
      const texto = (extras.textoOculto ?? '').slice(0, TEXTO_DBT_MAX)
      mudarCombatente(t, id, (atual) => ({ ...atual, acaoOculta: { ki, texto, ateRodada: t.nucleo.ordem.rodada + 1 } }))
      escrever(t, `${c.nome} prepara uma Ação Oculta (${ki} Ki): ${texto}`, `${c.nome} prepara uma Ação Oculta`)
      return null
    }
    case 'levantar': {
      const caido = c.condicoes.find((ativa) => ativa.condicao === 'caido')
      if (caido === undefined || !pagar(t, id, escolhida.ki)) return 'Não dá para levantar'
      tirarCondicao(t, id, caido.id, 'levantou')
      return null
    }
    case 'movimento': {
      if (!pagar(t, id, escolhida.ki)) return 'Ki insuficiente'
      escrever(t, `${c.nome} usa ${escolhida.rotulo}: o mestre aplica o efeito`)
      return null
    }
    case 'narrativa':
      escrever(t, `${c.nome}: ação narrativa`)
      return null
    default:
      return 'Ação desconhecida'
  }
}

function marcarTecnica(t: Trabalho, id: IdDoCombatente, tecnicaId: string): void {
  const turno = t.nucleo.turno
  if (turno !== null && turno.combatenteId === id) t.nucleo = { ...t.nucleo, turno: { ...turno, tecnicasUsadas: [...turno.tecnicasUsadas, tecnicaId] } }
}
