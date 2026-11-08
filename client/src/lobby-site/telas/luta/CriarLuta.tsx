import { useId, useMemo, useState, type FormEvent } from 'react'
import type { ModoDaLuta, PapelNaLuta } from '../../../lib/treino/luta'
import { CONTAS_POR_LUTA_MAX } from '../../../lib/treino/luta'
import type { ConvidadoDaLuta } from '../../../lib/treino/lutaDoLobby'
import { LADOS_DA_LUTA, VAGAS_POR_LADO_MAX, type LadoDaLuta } from '../../../lib/treino/mesaEmMemoria'
import { campanhaDaRota } from '../../dados/rotas'
import type { EstadoDaCampanha, FichaDoSite } from '../../dados/sessaoDaCampanha'
import { useDoSite, useSistemaDoLobby, useSite } from '../contexto'
import { lerAjustesDoJuiz } from '../treino/juiz/juizDoTreino'
import { EscolhaDeFichas } from './EscolhaDeFichas'
import { nomeDoTime } from './textosDaLuta'

/**
 * CRIAR UMA LUTA COM VÁRIOS (Arena multijogador F5, plano §2): o modo (times
 * de qualquer tamanho ou todos contra todos), quem entra e em que time, o
 * papel do mestre (Judge, que joga um lado, ou árbitro) e as fichas de quem
 * cria. Sai um `luta.criar`; o servidor confere tudo de novo e abre a sala de
 * espera (5 minutos), onde cada convidado aceita com as fichas dele.
 */

const TIMES_MIN = 2
const TIMES_MAX = 6
/** O Judge ocupa uma vaga do lado dele: os inimigos do treino vão até uma a menos. */
const INIMIGOS_DO_JUIZ_MAX = VAGAS_POR_LADO_MAX - 1

type PapelDoMestre = 'fora' | 'arbitro' | 'juiz'

/** As fichas que esta conta pode levar: dela (o dono no doc) e na mesa. */
export function fichasParaLutar(campanha: EstadoDaCampanha): FichaDoSite[] {
  const eu = campanha.eu?.contaId
  // A mesma regra do duelo: as fichas desta conta na mesa (a sem dono gravado é de quem a tem).
  return campanha.fichas.filter((ficha) => ficha.ehMinha && ficha.visivel === 'mesa' && (ficha.doc.dono === undefined || ficha.doc.dono === eu))
}

/** Os inimigos que o mestre liberou para o treino: os que o Judge leva na luta. */
export function inimigosDoTreino(campanha: EstadoDaCampanha): FichaDoSite[] {
  return campanha.fichas.filter((ficha) => ficha.visivel === 'treino')
}

export function SeletorDeTime({ rotulo, valor, lados, onMudar, desligado }: { rotulo: string; valor: LadoDaLuta; lados: readonly LadoDaLuta[]; onMudar(lado: LadoDaLuta): void; desligado?: boolean }) {
  return (
    <select className="lo-lu-time" aria-label={rotulo} value={valor} disabled={desligado} onChange={(evento) => onMudar(evento.target.value as LadoDaLuta)}>
      {lados.map((lado) => (
        <option key={lado} value={lado}>
          {nomeDoTime(lado)}
        </option>
      ))}
    </select>
  )
}

export function CriarLuta({ campanha, ocupado, onFechar }: { campanha: EstadoDaCampanha; ocupado: boolean; onFechar(): void }) {
  const site = useSite()
  const sistema = useSistemaDoLobby()
  const demo = useDoSite((estado) => estado.demo)
  const campanhaId = useDoSite((estado) => campanhaDaRota(estado.rota))
  const idBase = useId()
  const eu = campanha.eu
  const souMestre = eu?.papel === 'mestre'
  const minhas = useMemo(() => fichasParaLutar(campanha), [campanha])
  const inimigos = useMemo(() => inimigosDoTreino(campanha), [campanha])
  const naMesa = new Set(campanha.naMesa.map((presenca) => presenca.contaId))
  const colegas = campanha.membros.filter((membro) => membro.papel === 'jogador' && membro.contaId !== eu?.contaId)
  const mestre = campanha.membros.find((membro) => membro.papel === 'mestre')

  const [modo, setModo] = useState<ModoDaLuta>('times')
  const [times, setTimes] = useState(TIMES_MIN)
  const [meuTime, setMeuTime] = useState<LadoDaLuta>('a')
  /** Quem foi chamado e o time de cada um (no todos contra todos o time não vale: cada um é um lado). */
  const [chamados, setChamados] = useState<ReadonlyMap<string, LadoDaLuta>>(() => new Map())
  const [papelDoMestre, setPapelDoMestre] = useState<PapelDoMestre>(souMestre ? 'arbitro' : 'fora')
  const [timeDoJuiz, setTimeDoJuiz] = useState<LadoDaLuta>('b')
  const [fichas, setFichas] = useState<string[]>(() => (minhas[0] === undefined ? [] : [minhas[0].doc.id]))
  const [inimigosEscolhidos, setInimigos] = useState<string[]>([])
  const [tentou, setTentou] = useState(false)

  const ultimoTime = LADOS_DA_LUTA[times - 1] ?? 'b'
  const dentro = (lado: LadoDaLuta): LadoDaLuta => (LADOS_DA_LUTA.indexOf(lado) < times ? lado : ultimoTime)

  /** Os convidados (eu também) com papel e lado, na ordem: eu, os colegas chamados, o mestre. */
  const convidados = ((): ConvidadoDaLuta[] => {
    if (eu === null) return []
    const lista: ConvidadoDaLuta[] = []
    let proximo = 0
    const ladoNovo = (): LadoDaLuta => LADOS_DA_LUTA[Math.min(proximo++, LADOS_DA_LUTA.length - 1)] ?? 'l'
    const ladoDe = (escolhido: LadoDaLuta): LadoDaLuta => (modo === 'times' ? dentro(escolhido) : ladoNovo())
    if (souMestre) {
      const papel: PapelNaLuta = papelDoMestre === 'juiz' ? 'juiz' : 'arbitro'
      lista.push({ contaId: eu.contaId, papel, lado: papel === 'juiz' ? ladoDe(timeDoJuiz) : null })
    } else lista.push({ contaId: eu.contaId, papel: 'jogador', lado: ladoDe(meuTime) })
    for (const colega of colegas) {
      const time = chamados.get(colega.contaId)
      if (time !== undefined) lista.push({ contaId: colega.contaId, papel: 'jogador', lado: ladoDe(time) })
    }
    if (!souMestre && mestre !== undefined && papelDoMestre !== 'fora') {
      lista.push({ contaId: mestre.contaId, papel: papelDoMestre, lado: papelDoMestre === 'juiz' ? ladoDe(timeDoJuiz) : null })
    }
    return lista
  })()

  const lados = [...new Set(convidados.flatMap((convidado) => (convidado.lado === null ? [] : [convidado.lado])))].sort()
  const jogoComFichas = !souMestre
  const problemas: string[] = []
  if (lados.length < 2) problemas.push(modo === 'times' ? 'Ponha gente em pelo menos 2 times.' : 'Chame pelo menos mais uma pessoa (ou o mestre como Judge).')
  if (convidados.length > CONTAS_POR_LUTA_MAX) problemas.push(`A luta vai até ${CONTAS_POR_LUTA_MAX} pessoas, contando quem assiste.`)
  if (jogoComFichas && fichas.length === 0) problemas.push('Escolha pelo menos uma ficha sua para lutar.')
  if (souMestre && papelDoMestre === 'fora') problemas.push('Escolha o seu papel: Judge ou árbitro.')

  function chamar(contaId: string, sim: boolean) {
    setChamados((antes) => {
      const novo = new Map(antes)
      if (sim) novo.set(contaId, LADOS_DA_LUTA[(novo.size + 1) % times] ?? 'b')
      else novo.delete(contaId)
      return novo
    })
  }

  function criar(evento: FormEvent) {
    evento.preventDefault()
    setTentou(true)
    if (problemas.length > 0 || ocupado || eu === null) return
    const comoJuiz = convidados.find((convidado) => convidado.contaId === eu.contaId)?.papel === 'juiz'
    const ajustes = comoJuiz && campanhaId !== null ? { ...lerAjustesDoJuiz(campanhaId, demo, sistema) } : undefined
    const feito = site.lutas()?.criar({ modo, lados, convidados, fichas: comoJuiz ? inimigosEscolhidos : jogoComFichas ? fichas : [], ...(ajustes === undefined ? {} : { ajustes }) })
    if (feito === true) onFechar()
  }

  if (eu === null) return null
  const idDoModo = `${idBase}-modo`
  return (
    <form className="lo-lu-criar" onSubmit={criar} aria-labelledby={`${idBase}-titulo`}>
      <h3 id={`${idBase}-titulo`} className="lo-lu-subtitulo">
        Nova luta com vários
      </h3>

      <fieldset className="lo-tr-grupo" aria-describedby={idDoModo}>
        <legend>Como é a luta</legend>
        <label className="lo-tr-opcao">
          <input type="radio" name={`${idBase}-modo`} checked={modo === 'times'} onChange={() => setModo('times')} />
          <span className="lo-tr-opcao__nome">Times</span>
          <span className="lo-motivo">cada time luta junto, de qualquer tamanho</span>
        </label>
        <label className="lo-tr-opcao">
          <input type="radio" name={`${idBase}-modo`} checked={modo === 'todos'} onChange={() => setModo('todos')} />
          <span className="lo-tr-opcao__nome">Todos contra todos</span>
          <span className="lo-motivo">cada pessoa luta sozinha</span>
        </label>
        {modo === 'times' && (
          <div className="lo-lu-quantos" id={idDoModo}>
            <span className="lo-tr-rotulo">Quantos times</span>
            <button type="button" className="lo-btn lo-btn--icone" aria-label="Um time a menos" disabled={times <= TIMES_MIN} onClick={() => setTimes((antes) => Math.max(TIMES_MIN, antes - 1))}>
              −
            </button>
            <output className="lo-lu-quantos__n" aria-live="polite">
              {times}
            </output>
            <button type="button" className="lo-btn lo-btn--icone" aria-label="Um time a mais" disabled={times >= TIMES_MAX} onClick={() => setTimes((antes) => Math.min(TIMES_MAX, antes + 1))}>
              +
            </button>
          </div>
        )}
      </fieldset>

      <fieldset className="lo-tr-grupo">
        <legend>Quem entra</legend>
        {!souMestre && (
          <div className="lo-tr-opcao lo-lu-pessoa" data-eu="">
            <span className="lo-tr-opcao__nome">Você ({eu.nome})</span>
            {modo === 'times' && <SeletorDeTime rotulo="O seu time" valor={dentro(meuTime)} lados={LADOS_DA_LUTA.slice(0, times)} onMudar={setMeuTime} />}
          </div>
        )}
        {colegas.length === 0 && <p className="lo-motivo">Ainda não há outro jogador nesta mesa.</p>}
        {colegas.map((colega) => {
          const time = chamados.get(colega.contaId)
          return (
            <div key={colega.contaId} className="lo-tr-opcao lo-lu-pessoa">
              <label className="lo-lu-pessoa__chamar">
                <input type="checkbox" checked={time !== undefined} onChange={(evento) => chamar(colega.contaId, evento.target.checked)} />
                <span className="lo-tr-opcao__nome">{colega.nome}</span>
              </label>
              {naMesa.has(colega.contaId) && <span className="lo-tag lo-tag--online">na mesa agora</span>}
              {modo === 'times' && time !== undefined && (
                <SeletorDeTime rotulo={`Time de ${colega.nome}`} valor={dentro(time)} lados={LADOS_DA_LUTA.slice(0, times)} onMudar={(lado) => setChamados((antes) => new Map(antes).set(colega.contaId, lado))} />
              )}
            </div>
          )
        })}
      </fieldset>

      <fieldset className="lo-tr-grupo">
        <legend>{souMestre ? 'O seu papel (você é o mestre)' : `O mestre${mestre === undefined ? '' : ` (${mestre.nome})`}`}</legend>
        {!souMestre && (
          <label className="lo-tr-opcao">
            <input type="radio" name={`${idBase}-mestre`} checked={papelDoMestre === 'fora'} onChange={() => setPapelDoMestre('fora')} />
            <span className="lo-tr-opcao__nome">Não chamar</span>
          </label>
        )}
        <label className="lo-tr-opcao">
          <input type="radio" name={`${idBase}-mestre`} checked={papelDoMestre === 'arbitro'} disabled={!souMestre && mestre === undefined} onChange={() => setPapelDoMestre('arbitro')} />
          <span className="lo-tr-opcao__nome">Árbitro</span>
          <span className="lo-motivo">desfaz a última jogada, ajusta vida, decide regra, pausa e encerra</span>
        </label>
        <label className="lo-tr-opcao">
          <input type="radio" name={`${idBase}-mestre`} checked={papelDoMestre === 'juiz'} disabled={!souMestre && mestre === undefined} onChange={() => setPapelDoMestre('juiz')} />
          <span className="lo-tr-opcao__nome">Judge</span>
          <span className="lo-motivo">joga um lado com o Judge e os inimigos liberados para o treino</span>
        </label>
        {papelDoMestre === 'juiz' && modo === 'times' && (
          <div className="lo-lu-quantos">
            <span className="lo-tr-rotulo">O Judge fica no</span>
            <SeletorDeTime rotulo="Time do Judge" valor={dentro(timeDoJuiz)} lados={LADOS_DA_LUTA.slice(0, times)} onMudar={setTimeDoJuiz} />
          </div>
        )}
      </fieldset>

      {jogoComFichas ? (
        <div className="lo-campo">
          <span className="lo-tr-rotulo">Com quem você luta (até {VAGAS_POR_LADO_MAX})</span>
          {minhas.length === 0 ? <p className="lo-motivo">Você não tem personagem na mesa.</p> : <EscolhaDeFichas fichas={minhas} escolhidas={fichas} maximo={VAGAS_POR_LADO_MAX} onMudar={setFichas} />}
        </div>
      ) : papelDoMestre === 'juiz' ? (
        <div className="lo-campo">
          <span className="lo-tr-rotulo">Inimigos do treino com o Judge (até {INIMIGOS_DO_JUIZ_MAX}, pode ficar só o Judge)</span>
          {inimigos.length === 0 ? (
            <p className="lo-motivo">Nenhum inimigo liberado para o treino: o Judge luta sozinho.</p>
          ) : (
            <EscolhaDeFichas fichas={inimigos} escolhidas={inimigosEscolhidos} maximo={INIMIGOS_DO_JUIZ_MAX} onMudar={setInimigos} />
          )}
          <p className="lo-motivo">O Judge entra como está em Treino, em “Ajustar o Judge”.</p>
        </div>
      ) : null}

      {tentou && problemas.length > 0 && (
        <ul className="lo-lu-problemas" role="alert">
          {problemas.map((problema) => (
            <li key={problema}>{problema}</li>
          ))}
        </ul>
      )}
      <div className="lo-tr-vez__botoes">
        <button type="submit" className="lo-btn lo-btn--primario" disabled={ocupado}>
          Abrir a sala de espera
        </button>
        <button type="button" className="lo-btn lo-btn--fantasma" onClick={onFechar}>
          Cancelar
        </button>
        <span className="lo-motivo lo-lu-resumo">
          {lados.length} {lados.length === 1 ? 'lado' : 'lados'}, {convidados.length} {convidados.length === 1 ? 'pessoa' : 'pessoas'}. A sala espera 5 minutos.
        </span>
      </div>
    </form>
  )
}
