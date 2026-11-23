import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { ehVariacao, entraNaBatalha, novaVariacao } from '../../lib/livros/combate'
import { colunaDaComparacao, FATOR_DA_REACAO, melhorGolpe } from '../../lib/livros/encontro'
import { forcaDe, type Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { ajustarFicha, BOTOES_DO_AJUSTE, LUTAS_POR_TESTE, NOME_DO_BOTAO, type AjusteDaFicha } from '../../lib/treino/balanceadorComum'
import { acharNoWorker, testarNoWorker } from '../../lib/treino/balanceadorNoWorker'
import { fichaSemHpNaEscolha, montarLutadores, nomeLivre, VAGAS_POR_LADO_MAX, type EscolhaDaVaga, type LadoDoTreino } from '../../lib/treino/mesaEmMemoria'
import { ALVO_TODOS, chaveDaMontagem, useBalanceadorStore, vagasNoLado, type FichaNoLado } from '../../stores/balanceadorStore'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { useToastStore } from '../../stores/toastStore'
import { formatarNumero, gravarNoMundo, Retrato } from './comum'
import { IconeDoMundo } from './icones'
import { CartaoDaProposta, ResultadoDoBalanco } from './ResultadoDoBalanco'

/**
 * "TESTAR A LUTA" (docs/design/balanceamento/prototipo.html, layout C "mesa
 * frente a frente"): o acervo, os dois lados com o placar no meio, a meta
 * escrita como frase, Testar / Achar os números e, embaixo, o resultado.
 * As lutas são as do robô do treino, num worker (`balanceadorNoWorker.ts`).
 */

const NOME_DO_LADO: Readonly<Record<LadoDoTreino, string>> = { a: 'Aliados', b: 'Inimigos' }
const NOS_LADOS: Readonly<Record<LadoDoTreino, string>> = { a: 'nos Aliados', b: 'nos Inimigos' }
const TIPO_DO_ARRASTO = 'application/x-labirinto-ficha'
const TURNOS_DA_META: [number, number] = [1, 30]
const VITORIA_DA_META: [number, number] = [5, 95]

export interface ResumoDaFicha {
  hp: number | null
  escudo: number
  sp: number | null
  golpe: number | null
}

export function resumoDaFicha(personagem: Personagem, sistema: SistemaDeRpg): ResumoDaFicha {
  const coluna = colunaDaComparacao(personagem, sistema)
  return { hp: coluna.hp?.maximo ?? null, escudo: coluna.escudo ?? 0, sp: coluna.sp?.maximo ?? null, golpe: melhorGolpe(personagem, sistema)?.valor ?? null }
}

function linhaDaFicha(resumo: ResumoDaFicha): string {
  const partes: string[] = []
  if (resumo.hp !== null) partes.push(`HP ${formatarNumero(resumo.hp)}`)
  if (resumo.escudo > 0) partes.push(`Esc ${formatarNumero(resumo.escudo)}`)
  if (resumo.sp !== null) partes.push(`SP ${formatarNumero(resumo.sp)}`)
  partes.push(resumo.golpe === null ? 'sem golpe com número' : `golpe ${formatarNumero(resumo.golpe)}`)
  return partes.join(' · ')
}

interface SomaDoLado {
  vida: number
  escudo: number
  danoPorTurno: number
}

function somaDoLado(lado: readonly FichaNoLado[], resumos: ReadonlyMap<string, ResumoDaFicha>): SomaDoLado {
  return lado.reduce<SomaDoLado>(
    (soma, ficha) => {
      const resumo = resumos.get(ficha.id)
      if (resumo === undefined) return soma
      return { vida: soma.vida + (resumo.hp ?? 0) * ficha.n, escudo: soma.escudo + resumo.escudo * ficha.n, danoPorTurno: soma.danoPorTurno + (resumo.golpe ?? 0) * ficha.n }
    },
    { vida: 0, escudo: 0, danoPorTurno: 0 },
  )
}

/** "~2,2 turnos", "menos de 1 turno", "nunca". */
function turnosEscritos(turnos: number): string {
  if (!Number.isFinite(turnos)) return 'nunca'
  if (turnos < 1) return 'menos de 1 turno'
  return `~${formatarNumero(Math.round(turnos * 10) / 10)} turnos`
}

function inteiroNaFaixa(texto: string, [minimo, maximo]: [number, number]): number | null {
  const numero = Number(texto)
  return Number.isInteger(numero) && numero >= minimo && numero <= maximo ? numero : null
}

/** Ajuste que não muda nada (a proposta igual à de hoje). */
function ajusteNulo(ajuste: AjusteDaFicha): boolean {
  return ajuste.hp === 1 && ajuste.escudo === 0 && ajuste.dano === 1 && ajuste.atributos === 1
}

interface Rodando {
  tipo: 'testar' | 'achar'
  cancelar: () => void
}

interface Progresso {
  feitas: number
  total: number
  fase: string
}

export interface BalanceadorDaLutaProps {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
}

export function BalanceadorDaLuta({ personagens, sistema }: BalanceadorDaLutaProps) {
  const estado = useBalanceadorStore()
  const { lados, meta, alvo, botoes, nLutas, semente, balanco, proposta } = estado
  const [rodando, setRodando] = useState<Rodando | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erroDaMeta, setErroDaMeta] = useState<string | null>(null)
  const [arrasto, setArrasto] = useState<{ id: string; nome: string } | null>(null)
  const [sobre, setSobre] = useState<LadoDoTreino | 'acervo' | null>(null)
  const [nova, setNova] = useState<string | null>(null)
  const rodandoRef = useRef<Rodando | null>(null)
  rodandoRef.current = rodando

  const lutaveis = useMemo(() => personagens.filter((personagem) => entraNaBatalha(personagem)), [personagens])
  const porId = useMemo(() => new Map(lutaveis.map((personagem) => [personagem.id, personagem])), [lutaveis])
  const resumos = useMemo(() => new Map(lutaveis.map((personagem) => [personagem.id, resumoDaFicha(personagem, sistema)])), [lutaveis, sistema])
  // Ficha que sumiu da pasta (apagada em outra página) sai da mesa.
  const ladosVivos = useMemo(() => ({ a: lados.a.filter((ficha) => porId.has(ficha.id)), b: lados.b.filter((ficha) => porId.has(ficha.id)) }), [lados, porId])
  const chave = chaveDaMontagem(ladosVivos, semente)
  const nA = vagasNoLado(ladosVivos.a)
  const nB = vagasNoLado(ladosVivos.b)

  const escolhas = useMemo<EscolhaDaVaga[]>(() => {
    const lista: EscolhaDaVaga[] = []
    for (const lado of ['a', 'b'] as const) {
      for (const ficha of ladosVivos[lado]) {
        const personagem = porId.get(ficha.id)
        if (personagem !== undefined) for (let i = 0; i < ficha.n; i += 1) lista.push({ ficha: personagem, lado })
      }
    }
    return lista
  }, [ladosVivos, porId])
  const semHp = useMemo(() => fichaSemHpNaEscolha(escolhas, sistema), [escolhas, sistema])

  const somaA = somaDoLado(ladosVivos.a, resumos)
  const somaB = somaDoLado(ladosVivos.b, resumos)
  const inimigosDoAlvo = ladosVivos.b.map((ficha) => ficha.id)
  const alvoValido = alvo === ALVO_TODOS || inimigosDoAlvo.includes(alvo) ? alvo : ALVO_TODOS

  const motivoDoTeste = nA === 0 || nB === 0 ? 'Ponha alguém nos dois lados para testar.' : semHp !== null ? `${semHp.nome} não tem HP: tire da luta ou dê HP na ficha.` : null
  const turnosPedidos = meta.usarTurnos ? inteiroNaFaixa(meta.turnos, TURNOS_DA_META) : null
  const vitoriaPedida = meta.usarVitoria ? inteiroNaFaixa(meta.vitoria, VITORIA_DA_META) : null
  const motivoDoAchar =
    motivoDoTeste ??
    (!meta.usarTurnos && !meta.usarVitoria
      ? 'Marque pelo menos uma meta na frase.'
      : !BOTOES_DO_AJUSTE.some((botao) => botoes[botao])
        ? 'Ligue pelo menos um botão em "mexendo em".'
        : meta.usarTurnos && !meta.usarVitoria && !botoes.hp && !botoes.escudo
          ? 'Para mudar quanto a luta dura, deixe o app mexer no HP ou no Escudo.'
          : null)

  const validarMeta = (): string | null => {
    if (meta.usarTurnos && turnosPedidos === null) return `A duração vai de ${TURNOS_DA_META[0]} a ${TURNOS_DA_META[1]} turnos, em número inteiro.`
    if (meta.usarVitoria && vitoriaPedida === null) return `A vitória vai de ${VITORIA_DA_META[0]}% a ${VITORIA_DA_META[1]}%, em número inteiro.`
    return null
  }

  const montar = () => {
    const montagem = montarLutadores(escolhas)
    if (!montagem.ok) {
      useToastStore.getState().push('error', `Os ${NOME_DO_LADO[montagem.lado]} têm fichas demais (até ${VAGAS_POR_LADO_MAX}).`)
      return null
    }
    return montagem.lutadores
  }

  const aoTerminar = (texto: string) => (saida: { ok: true } | { ok: false; motivo: 'cancelado' | 'falhou'; detalhe: string }) => {
    setRodando(null)
    setProgresso(null)
    if (!saida.ok && saida.motivo === 'falhou') useToastStore.getState().push('error', `${texto}: ${saida.detalhe}`)
  }

  const testar = (sementeDoTeste = semente) => {
    if (rodandoRef.current !== null || motivoDoTeste !== null) return
    const lutadores = montar()
    if (lutadores === null) return
    const chaveDoTeste = chaveDaMontagem(ladosVivos, sementeDoTeste)
    setProgresso({ feitas: 0, total: nLutas, fase: 'Lutando' })
    const tarefa = testarNoWorker({ tipo: 'balanco', serie: { sistema, lutadores, semente: sementeDoTeste }, n: nLutas }, (feitas, total, fase) => setProgresso({ feitas, total, fase }))
    setRodando({ tipo: 'testar', cancelar: tarefa.cancelar })
    void tarefa.saida.then((saida) => {
      if (saida.ok) useBalanceadorStore.getState().guardarBalanco({ valor: saida.valor, chave: chaveDoTeste, ms: saida.ms })
      aoTerminar('O teste parou')(saida)
    })
  }

  const achar = () => {
    if (rodandoRef.current !== null || motivoDoAchar !== null) return
    const erro = validarMeta()
    setErroDaMeta(erro)
    if (erro !== null) return
    const lutadores = montar()
    if (lutadores === null) return
    const alvos = alvoValido === ALVO_TODOS ? inimigosDoAlvo : [alvoValido]
    const turnos = turnosPedidos
    const vitoria = vitoriaPedida === null ? null : vitoriaPedida / 100
    setProgresso({ feitas: 0, total: 1, fase: 'Medindo a luta de agora' })
    const tarefa = acharNoWorker({ tipo: 'achar', serie: { sistema, lutadores, semente }, alvos, meta: { turnos, vitoria }, botoes }, (feitas, total, fase) => setProgresso({ feitas, total, fase }))
    setRodando({ tipo: 'achar', cancelar: tarefa.cancelar })
    void tarefa.saida.then((saida) => {
      if (saida.ok) useBalanceadorStore.getState().guardarProposta({ valor: { proposta: saida.valor, alvos, turnos, vitoria }, chave, ms: saida.ms })
      aoTerminar('A procura parou')(saida)
    })
  }

  const aplicar = async () => {
    const guardada = useBalanceadorStore.getState().proposta
    if (guardada === null || guardada.chave !== chave || ajusteNulo(guardada.valor.proposta.ajuste)) return
    const { proposta: achada, alvos, turnos, vitoria } = guardada.valor
    const usados = new Set(personagens.map((personagem) => personagem.nome))
    const sufixo = turnos !== null ? `${turnos} turnos` : vitoria !== null ? `${Math.round(vitoria * 100)}% de vitória` : 'ajustado'
    const trocas: { de: string; para: Personagem }[] = []
    for (const id of alvos) {
      const modelo = porId.get(id)
      if (modelo === undefined) continue
      const nome = nomeLivre(`${modelo.nome} (${sufixo})`, usados)
      usados.add(nome)
      const crua = novaVariacao(modelo, nome)
      // A variação nasce com força 1; a proposta foi medida com a força do modelo, então ela parte da mesma.
      const comForca: Personagem = { ...crua, combate: { ...crua.combate, forca: forcaDe(modelo) } }
      trocas.push({ de: id, para: ajustarFicha(comForca, achada.ajuste, sistema) })
    }
    if (trocas.length === 0) return
    const ids = new Set(trocas.map((troca) => troca.para.id))
    const gravou = await gravarNoMundo((lista) => [...lista, ...trocas.map((troca) => troca.para)])
    if (!gravou) return
    const loja = useBalanceadorStore.getState()
    for (const troca of trocas) loja.substituir(troca.de, troca.para.id)
    loja.guardarProposta(null)
    setNova(trocas[0].para.id)
    const desfazer = () => {
      const agora = useBalanceadorStore.getState()
      for (const troca of trocas) agora.substituir(troca.para.id, troca.de)
      void gravarNoMundo((lista) => lista.filter((personagem) => !ids.has(personagem.id)))
    }
    const compararComOriginal = () => {
      useMundoDoLivroStore.setState({ comparar: [trocas[0].de, trocas[0].para.id] })
      useBalanceadorStore.getState().trocarAba('comparar')
    }
    const nomes = trocas.map((troca) => `"${troca.para.nome}"`).join(', ')
    useToastStore.getState().push('info', `Criei ${nomes} e pus na luta no lugar do original. A ficha original não mudou.`, null, {
      actions: [
        { label: 'Desfazer', run: desfazer },
        { label: 'Comparar com o original', run: compararComOriginal },
      ],
    })
  }

  // O teste roda de novo sozinho depois do Aplicar (a montagem nova já está na store).
  useEffect(() => {
    if (nova !== null && ladosVivos.b.some((ficha) => ficha.id === nova)) {
      setNova(null)
      testar()
    }
  })

  // Atalhos num lugar só: Ctrl+Enter testa, Esc cancela. Fora de campo de texto longo.
  const testarRef = useRef(testar)
  testarRef.current = testar
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      const alvoDoEvento = evento.target
      if (alvoDoEvento instanceof HTMLElement && (alvoDoEvento.isContentEditable || alvoDoEvento.tagName === 'TEXTAREA')) return
      if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
        evento.preventDefault()
        testarRef.current()
      } else if (evento.key === 'Escape' && rodandoRef.current !== null) {
        evento.preventDefault()
        rodandoRef.current.cancelar()
      }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [])

  const enviarMeta = (evento: FormEvent) => {
    evento.preventDefault()
    achar()
  }

  const comecarArrasto = (evento: DragEvent, id: string, origem: LadoDoTreino | 'acervo') => {
    evento.dataTransfer.setData(TIPO_DO_ARRASTO, JSON.stringify({ id, origem }))
    evento.dataTransfer.effectAllowed = 'move'
    setArrasto({ id, nome: porId.get(id)?.nome ?? 'a ficha' })
  }
  const terminarArrasto = () => {
    setArrasto(null)
    setSobre(null)
  }
  const soltar = (evento: DragEvent, destino: LadoDoTreino | 'acervo') => {
    evento.preventDefault()
    terminarArrasto()
    let lido: unknown
    try {
      lido = JSON.parse(evento.dataTransfer.getData(TIPO_DO_ARRASTO))
    } catch {
      return
    }
    if (typeof lido !== 'object' || lido === null || !('id' in lido) || !('origem' in lido)) return
    const { id, origem } = lido
    if (typeof id !== 'string' || !porId.has(id)) return
    const loja = useBalanceadorStore.getState()
    if (destino === 'acervo') {
      if (origem === 'a' || origem === 'b') loja.tirar(id, origem)
      return
    }
    if (origem === destino) return
    if (origem === 'a' || origem === 'b') loja.trocarDeLado(id, origem)
    else if (!loja.por(id, destino)) useToastStore.getState().push('info', `Os ${NOME_DO_LADO[destino]} já têm ${VAGAS_POR_LADO_MAX} vagas.`)
  }
  const aceitarArrasto = (evento: DragEvent, destino: LadoDoTreino | 'acervo') => {
    if (!evento.dataTransfer.types.includes(TIPO_DO_ARRASTO)) return
    evento.preventDefault()
    if (sobre !== destino) setSobre(destino)
  }

  const clicarNaFicha = (id: string) => {
    const lado = useBalanceadorStore.getState().ladoDoClique
    if (!useBalanceadorStore.getState().por(id, lado)) useToastStore.getState().push('info', `Os ${NOME_DO_LADO[lado]} já têm ${VAGAS_POR_LADO_MAX} vagas: tire alguém para pôr outra ficha.`)
  }

  const balancoVelho = balanco !== null && balanco.chave !== chave
  const propostaVelha = proposta !== null && proposta.chave !== chave
  const vidaDoLadoA = somaA.vida + somaA.escudo
  const vidaDoLadoB = somaB.vida + somaB.escudo
  const contaRapida =
    nA > 0 && nB > 0
      ? `Conta rápida, sem dado: os aliados derrubam os inimigos em ${turnosEscritos(vidaDoLadoB / (somaA.danoPorTurno * FATOR_DA_REACAO))}; os inimigos derrubam os aliados em ${turnosEscritos(vidaDoLadoA / (somaB.danoPorTurno * FATOR_DA_REACAO))}. A conta não sabe do SP que acaba, da cura nem do d20: o teste sabe.`
      : null

  return (
    <div className="bl-testar">
      <div className="bl-montagem">
        <Acervo
          lutaveis={lutaveis}
          personagens={personagens}
          lados={ladosVivos}
          ladoDoClique={estado.ladoDoClique}
          soltandoAqui={sobre === 'acervo' && arrasto !== null}
          onClicar={clicarNaFicha}
          onArrastar={comecarArrasto}
          onFimDoArrasto={terminarArrasto}
          onAceitar={aceitarArrasto}
          onSoltar={soltar}
        />
        <div className="bl-mesa">
          <div className="bl-lados">
            {(['a', 'b'] as const).map((lado) => (
              <LadoDaMesa
                key={lado}
                lado={lado}
                fichas={ladosVivos[lado]}
                porId={porId}
                resumos={resumos}
                soma={lado === 'a' ? somaA : somaB}
                marcado={estado.ladoDoClique === lado}
                dica={sobre === lado && arrasto !== null ? `Soltar aqui: ${arrasto.nome} entra ${NOS_LADOS[lado]}` : null}
                onArrastar={comecarArrasto}
                onFimDoArrasto={terminarArrasto}
                onAceitar={aceitarArrasto}
                onSoltar={soltar}
              />
            ))}
            <div className="bl-vs" aria-hidden="true">
              <span className="bl-vs__moeda">
                {nA} × {nB}
              </span>
              <span className="bl-vs__rot">aliados contra inimigos</span>
            </div>
          </div>

          <form className="bl-meta" noValidate aria-label="Meta da luta" onSubmit={enviarMeta}>
            <p className="bl-meta__frase">
              <span className={meta.usarTurnos ? 'bl-meta__parte' : 'bl-meta__parte bl-meta__parte--off'}>
                <input type="checkbox" className="bl-meta__marca" aria-label="Usar a meta de duração" checked={meta.usarTurnos} onChange={(e) => estado.mudarMeta({ usarTurnos: e.target.checked })} />
                <label htmlFor="bl-meta-turnos">Quero que a luta dure</label>
                <input
                  id="bl-meta-turnos"
                  className="bl-meta__campo"
                  type="number"
                  inputMode="numeric"
                  min={TURNOS_DA_META[0]}
                  max={TURNOS_DA_META[1]}
                  step={1}
                  value={meta.turnos}
                  disabled={!meta.usarTurnos}
                  aria-describedby="bl-meta-erro"
                  onChange={(e) => estado.mudarMeta({ turnos: e.target.value })}
                  onBlur={() => setErroDaMeta(validarMeta())}
                />
                turnos
              </span>{' '}
              <span className={meta.usarVitoria ? 'bl-meta__parte' : 'bl-meta__parte bl-meta__parte--off'}>
                <input type="checkbox" className="bl-meta__marca" aria-label="Usar a meta de vitória" checked={meta.usarVitoria} onChange={(e) => estado.mudarMeta({ usarVitoria: e.target.checked })} />
                <label htmlFor="bl-meta-pct">e que os aliados vençam</label>
                <input
                  id="bl-meta-pct"
                  className="bl-meta__campo"
                  type="number"
                  inputMode="numeric"
                  min={VITORIA_DA_META[0]}
                  max={VITORIA_DA_META[1]}
                  step={1}
                  value={meta.vitoria}
                  disabled={!meta.usarVitoria}
                  aria-describedby="bl-meta-erro"
                  onChange={(e) => estado.mudarMeta({ vitoria: e.target.value })}
                  onBlur={() => setErroDaMeta(validarMeta())}
                />
                % das lutas.
              </span>
            </p>
            <div className="bl-meta__linha2">
              <label htmlFor="bl-meta-alvo">Ajustar</label>
              <select id="bl-meta-alvo" className="bl-select" value={alvoValido} onChange={(e) => estado.mudarAlvo(e.target.value)}>
                <option value={ALVO_TODOS}>todos os inimigos</option>
                {ladosVivos.b.map((ficha) => (
                  <option key={ficha.id} value={ficha.id}>
                    {porId.get(ficha.id)?.nome ?? ficha.id}
                  </option>
                ))}
              </select>
              <span id="bl-meta-botoes-rot">mexendo em</span>
              <span className="mu-chips" role="group" aria-labelledby="bl-meta-botoes-rot">
                {BOTOES_DO_AJUSTE.map((botao) => (
                  <button key={botao} type="button" className="mu-chip" aria-pressed={botoes[botao]} onClick={() => estado.alternarBotao(botao)}>
                    {NOME_DO_BOTAO[botao]}
                  </button>
                ))}
              </span>
            </div>
            <p className="bl-meta__erro" id="bl-meta-erro" role="alert">
              {erroDaMeta}
            </p>
          </form>

          <div className="bl-acoes">
            <button type="button" className="mu-bt mu-bt--primario" disabled={motivoDoTeste !== null || rodando !== null} onClick={() => testar()}>
              Testar {nLutas} lutas <kbd>Ctrl Enter</kbd>
            </button>
            <label className="bl-acoes__n">
              Lutas por teste
              <select className="bl-select" value={nLutas} onChange={(e) => estado.mudarNLutas(LUTAS_POR_TESTE.find((n) => String(n) === e.target.value) ?? nLutas)}>
                {LUTAS_POR_TESTE.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="mu-bt mu-bt--latao" disabled={motivoDoAchar !== null || rodando !== null} onClick={achar}>
              Achar os números
            </button>
            <p className="bl-acoes__porque" role="status">
              {rodando === null ? (motivoDoTeste ?? motivoDoAchar ?? '') : ''}
            </p>
          </div>
          {contaRapida !== null && <p className="bl-conta">{contaRapida}</p>}

          {rodando !== null && progresso !== null && (
            <div className="mu-cartao bl-progresso">
              <div className="bl-progresso__cab">
                <p className="bl-progresso__txt" role="status" aria-live="polite">
                  {rodando.tipo === 'testar' ? `Lutando: ${progresso.feitas} de ${progresso.total}` : progresso.fase}
                </p>
                <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={rodando.cancelar}>
                  Cancelar <kbd>Esc</kbd>
                </button>
              </div>
              <div className="bl-progresso__trilho" role="progressbar" aria-label="Progresso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((100 * progresso.feitas) / Math.max(1, progresso.total))}>
                <div className="bl-progresso__ench" style={{ transform: `scaleX(${Math.min(1, progresso.feitas / Math.max(1, progresso.total)).toFixed(3)})` }} />
              </div>
            </div>
          )}

          {proposta !== null && (
            <CartaoDaProposta
              guardada={proposta}
              velha={propostaVelha}
              porId={porId}
              sistema={sistema}
              onAplicar={() => void aplicar()}
              onDescartar={() => estado.guardarProposta(null)}
            />
          )}
        </div>
      </div>

      <ResultadoDoBalanco
        guardado={balanco}
        velho={balancoVelho}
        nLutas={nLutas}
        rodando={rodando !== null}
        turnosDaMeta={turnosPedidos}
        vitoriaDaMeta={vitoriaPedida}
        porId={porId}
        sistema={sistema}
        onTestar={() => testar()}
        onAchar={achar}
        podeAchar={motivoDoAchar === null}
        onOutraSemente={() => {
          estado.novaSemente()
          testar(useBalanceadorStore.getState().semente)
        }}
      />
    </div>
  )
}

interface AcervoProps {
  lutaveis: readonly Personagem[]
  personagens: readonly Personagem[]
  lados: Record<LadoDoTreino, readonly FichaNoLado[]>
  ladoDoClique: LadoDoTreino
  soltandoAqui: boolean
  onClicar: (id: string) => void
  onArrastar: (evento: DragEvent, id: string, origem: 'acervo') => void
  onFimDoArrasto: () => void
  onAceitar: (evento: DragEvent, destino: 'acervo') => void
  onSoltar: (evento: DragEvent, destino: 'acervo') => void
}

function Acervo({ lutaveis, personagens, lados, ladoDoClique, soltandoAqui, onClicar, onArrastar, onFimDoArrasto, onAceitar, onSoltar }: AcervoProps) {
  const grupos: { titulo: string; fichas: Personagem[] }[] = [
    { titulo: 'Jogadores', fichas: lutaveis.filter((personagem) => personagem.tipo === 'jogador') },
    { titulo: 'NPCs', fichas: lutaveis.filter((personagem) => personagem.tipo === 'npc' && !ehVariacao(personagem)) },
    { titulo: 'Variações', fichas: lutaveis.filter((personagem) => personagem.tipo === 'npc' && ehVariacao(personagem)) },
  ]
  const naLuta = (id: string): number => [...lados.a, ...lados.b].find((ficha) => ficha.id === id)?.n ?? 0
  return (
    <aside
      className={soltandoAqui ? 'mu-cartao bl-acervo bl-acervo--soltar' : 'mu-cartao bl-acervo'}
      aria-labelledby="bl-acervo-tit"
      onDragOver={(e) => onAceitar(e, 'acervo')}
      onDrop={(e) => onSoltar(e, 'acervo')}
    >
      <h3 className="bl-acervo__tit" id="bl-acervo-tit">
        Fichas
      </h3>
      <p className="bl-acervo__dica">
        Clique numa ficha para pôr nos <strong>{NOME_DO_LADO[ladoDoClique]}</strong>. Ou arraste para um lado. Clicar de novo põe mais uma cópia.
      </p>
      {lutaveis.length === 0 && <p className="mu-pg-nota">Nenhuma ficha de combate nesta pasta. Crie em Jogadores ou em NPCs de combate.</p>}
      {grupos.map(
        (grupo) =>
          grupo.fichas.length > 0 && (
            <div key={grupo.titulo} className="bl-acervo__grupo">
              <h4 className="bl-acervo__rot">{grupo.titulo}</h4>
              <div className="mu-chips">
                {grupo.fichas.map((personagem) => {
                  const n = naLuta(personagem.id)
                  const modelo = personagem.combate?.modeloId === undefined ? undefined : personagens.find((outro) => outro.id === personagem.combate?.modeloId)
                  return (
                    <button
                      key={personagem.id}
                      type="button"
                      className="mu-chip bl-ficha"
                      aria-pressed={n > 0}
                      draggable
                      title={modelo === undefined ? undefined : `Variação de ${modelo.nome}`}
                      onClick={() => onClicar(personagem.id)}
                      onDragStart={(e) => onArrastar(e, personagem.id, 'acervo')}
                      onDragEnd={onFimDoArrasto}
                    >
                      <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
                      {personagem.nome}
                      {n > 0 && <span className="bl-ficha__n">×{n}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ),
      )}
      <p className="bl-acervo__solta">Soltar aqui tira a ficha da luta.</p>
    </aside>
  )
}

interface LadoDaMesaProps {
  lado: LadoDoTreino
  fichas: readonly FichaNoLado[]
  porId: ReadonlyMap<string, Personagem>
  resumos: ReadonlyMap<string, ResumoDaFicha>
  soma: SomaDoLado
  marcado: boolean
  dica: string | null
  onArrastar: (evento: DragEvent, id: string, origem: LadoDoTreino) => void
  onFimDoArrasto: () => void
  onAceitar: (evento: DragEvent, destino: LadoDoTreino) => void
  onSoltar: (evento: DragEvent, destino: LadoDoTreino) => void
}

function LadoDaMesa({ lado, fichas, porId, resumos, soma, marcado, dica, onArrastar, onFimDoArrasto, onAceitar, onSoltar }: LadoDaMesaProps) {
  const loja = useBalanceadorStore.getState
  const vagas = vagasNoLado(fichas)
  const outro = lado === 'a' ? 'Inimigos' : 'Aliados'
  const titulo = `bl-lado-${lado}-tit`
  return (
    <section
      className={`mu-cartao bl-lado bl-lado--${lado}${dica !== null ? ' bl-lado--soltar' : ''}`}
      aria-labelledby={titulo}
      onDragOver={(e) => onAceitar(e, lado)}
      onDrop={(e) => onSoltar(e, lado)}
    >
      <header className="bl-lado__cab">
        <h3 className="bl-lado__tit" id={titulo}>
          {NOME_DO_LADO[lado]} <small>{vagas} de {VAGAS_POR_LADO_MAX}</small>
        </h3>
        <button type="button" className={marcado ? 'mu-bt mu-bt--p mu-bt--latao bl-lado__clique' : 'mu-bt mu-bt--p bl-lado__clique'} aria-pressed={marcado} onClick={() => loja().marcarLadoDoClique(lado)}>
          {marcado ? 'O clique põe aqui' : 'Clicar põe aqui'}
        </button>
      </header>
      {dica !== null && <p className="bl-lado__dica">{dica}</p>}
      {fichas.length === 0 ? (
        <p className="bl-lado__vazio">Arraste uma ficha para cá, ou marque este lado e clique numa ficha do acervo.</p>
      ) : (
        <ul className="bl-lado__lista">
          {fichas.map((ficha) => {
            const personagem = porId.get(ficha.id)
            const resumo = resumos.get(ficha.id)
            if (personagem === undefined || resumo === undefined) return null
            const etiqueta = personagem.tipo === 'jogador' ? 'Jogador' : ehVariacao(personagem) ? 'Variação' : 'NPC'
            return (
              <li key={ficha.id} className="bl-vaga" draggable onDragStart={(e) => onArrastar(e, ficha.id, lado)} onDragEnd={onFimDoArrasto}>
                <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
                <div className="bl-vaga__txt">
                  <span className="bl-vaga__nome">
                    {personagem.nome} <span className={personagem.tipo === 'jogador' ? 'mu-etiqueta mu-etiqueta--jogador' : 'mu-etiqueta mu-etiqueta--npc'}>{etiqueta}</span>
                  </span>
                  <span className="bl-vaga__sub">{linhaDaFicha(resumo)}</span>
                </div>
                <span className="bl-vaga__ctrl" role="group" aria-label={`Cópias de ${personagem.nome}`}>
                  <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label={`Uma cópia de ${personagem.nome} a menos`} onClick={() => loja().quantas(ficha.id, lado, ficha.n - 1)}>
                    <IconeDoMundo nome="menos" />
                  </button>
                  <span className="bl-vaga__n" aria-live="polite">
                    {ficha.n}
                  </span>
                  <button
                    type="button"
                    className="mu-bt mu-bt--ic mu-bt--p"
                    aria-label={`Uma cópia de ${personagem.nome} a mais`}
                    disabled={vagas >= VAGAS_POR_LADO_MAX}
                    onClick={() => loja().quantas(ficha.id, lado, ficha.n + 1)}
                  >
                    <IconeDoMundo nome="mais" />
                  </button>
                </span>
                <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label={`Passar ${personagem.nome} para os ${outro}`} title={`Passar para os ${outro}`} onClick={() => loja().trocarDeLado(ficha.id, lado)}>
                  <span aria-hidden="true">⇄</span>
                </button>
                <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label={`Tirar ${personagem.nome} da luta`} title="Tirar da luta" onClick={() => loja().tirar(ficha.id, lado)}>
                  <IconeDoMundo nome="x" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="bl-lado__soma">
        Vida somada <strong>{formatarNumero(soma.vida)}</strong>
        {soma.escudo > 0 && (
          <>
            {' '}
            + Escudo <strong>{formatarNumero(soma.escudo)}</strong>
          </>
        )}{' '}
        · até <strong>{formatarNumero(soma.danoPorTurno)}</strong> de dano por turno
      </p>
    </section>
  )
}
