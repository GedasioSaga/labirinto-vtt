import { useId, useState, type FormEvent } from 'react'
import { recursosDaCarta } from '../../../components/batalha/dadosDaFaixa'
import type { MudancaDoAjuste } from '../../../lib/batalha/combate'
import { BLOCOS_POR_RANK_MAX, BLOCOS_POR_RANK_MIN, BLOCOS_POR_RANK_PADRAO, NOME_DA_REGRA_MAX, TEXTO_DA_REGRA_MAX } from '../../../lib/batalha/regrasDoCampo'
import { cartaDaVez } from '../../../lib/batalha/turnos'
import type { PedidoDoArbitro } from '../../../lib/treino/arbitroDaLuta'
import type { LadoDaLuta } from '../../../lib/treino/mesaEmMemoria'
import type { LutaRecebida } from '../../dados/fioDaLuta'
import { useSistemaDoLobby, useSite } from '../contexto'

/**
 * O PAINEL DO ÁRBITRO (Arena multijogador F5, plano §3): o mestre que arbitra
 * não joga; daqui ele desfaz a última jogada, ajusta HP, SP e Escudo de uma
 * ficha, decide a regra do campo, passa a vez de quem sumiu, pausa e retoma,
 * e encerra (com vencedor ou empate). Cada pedido leva o `seq` do estado que
 * a tela mostra; o servidor (`arbitrarNaLuta`) confere tudo e manda a todos.
 */

type PedidoSemSeq = PedidoDoArbitro extends infer P ? (P extends { seq: number } ? Omit<P, 'seq'> : never) : never

export function PainelDoArbitro({ luta, ocupado, nomeDoLado, onFechar }: { luta: LutaRecebida; ocupado: boolean; nomeDoLado(lado: LadoDaLuta): string; onFechar(): void }) {
  const site = useSite()
  const sistema = useSistemaDoLobby()
  const idBase = useId()
  const pausada = luta.pausada === true
  const desfazivel = luta.registro.find((linha) => linha.podeDesfazer)
  const carta = cartaDaVez(luta.turnos)
  const vagaDaVez = carta === null ? undefined : luta.lutadores.vagas.find((vaga) => vaga.tokenId === carta.tokenId)
  const nomeDe = (personagemId: string | undefined): string => luta.lutadores.personagens.find((personagem) => personagem.id === personagemId)?.nome ?? 'a ficha'
  const naLuta = luta.lutadores.vagas.filter((vaga) => vaga.fora !== true)
  const lados = [...new Set(naLuta.map((vaga) => vaga.lado))].sort()

  const [tokenDoAjuste, setTokenDoAjuste] = useState(naLuta[0]?.tokenId ?? '')
  const vagaDoAjuste = naLuta.find((vaga) => vaga.tokenId === tokenDoAjuste)
  const docDoAjuste = luta.lutadores.personagens.find((personagem) => personagem.id === vagaDoAjuste?.personagemId)
  const recursos = docDoAjuste === undefined ? [] : recursosDaCarta(docDoAjuste, sistema)
  const temEscudo = sistema.recursos.some((recurso) => recurso.id === 'escudo')
  const [valores, setValores] = useState<Readonly<Record<string, string>>>({})

  const [nomeDaRegra, setNomeDaRegra] = useState(luta.regras?.nome ?? '')
  const [textoDaRegra, setTextoDaRegra] = useState(luta.regras?.texto ?? '')
  const [blocos, setBlocos] = useState(luta.regras?.blocosPorRank ?? BLOCOS_POR_RANK_PADRAO)
  const [vencedor, setVencedor] = useState<LadoDaLuta | 'empate'>(lados[0] ?? 'empate')
  const [confirmarFim, setConfirmarFim] = useState(false)

  function pedir(pedido: PedidoSemSeq): void {
    site.lutas()?.arbitrar(luta.id, { ...pedido, seq: luta.seq } as PedidoDoArbitro)
  }

  function ajustar(evento: FormEvent) {
    evento.preventDefault()
    if (vagaDoAjuste === undefined) return
    const mudancas: MudancaDoAjuste[] = []
    for (const [recursoId, bruto] of Object.entries(valores)) {
      const valor = Number(bruto)
      if (bruto.trim() !== '' && Number.isSafeInteger(valor) && valor >= 0) mudancas.push({ tipo: 'atual', recursoId, valor })
    }
    if (mudancas.length === 0) return
    pedir({ tipo: 'ajustar', pedido: { tokenId: vagaDoAjuste.tokenId, mudancas } })
    setValores({})
  }

  function definirRegra(evento: FormEvent) {
    evento.preventDefault()
    const nome = nomeDaRegra.trim()
    if (nome === '') return
    pedir({ tipo: 'regras', regras: { origemId: null, nome, blocosPorRank: blocos, texto: textoDaRegra.trim() } })
  }

  const desligado = ocupado || luta.fim !== null
  return (
    <section
      className="lo-lu-arbitro"
      aria-labelledby={`${idBase}-titulo`}
      onKeyDown={(evento) => {
        if (evento.key !== 'Escape') return
        evento.stopPropagation()
        onFechar()
      }}
    >
      <header className="lo-lu-arbitro__cabeca">
        <h3 id={`${idBase}-titulo`} className="lo-lu-subtitulo">
          Árbitro
        </h3>
        <button type="button" className="lo-btn lo-btn--fantasma" onClick={onFechar}>
          Fechar
        </button>
      </header>

      <div className="lo-lu-arbitro__grupo">
        <button type="button" className="lo-btn lo-btn--primario" disabled={desligado} onClick={() => pedir({ tipo: pausada ? 'retomar' : 'pausar' })}>
          {pausada ? 'Retomar a luta' : 'Pausar a luta'}
        </button>
        <button type="button" className="lo-btn" disabled={desligado || desfazivel === undefined} onClick={() => pedir({ tipo: 'desfazer' })}>
          Desfazer a última jogada
        </button>
        <p className="lo-motivo">{desfazivel === undefined ? 'Nada para desfazer agora.' : `Desfaz: ${desfazivel.texto}`}</p>
        <button type="button" className="lo-btn" disabled={desligado || carta === null} onClick={() => carta !== null && pedir({ tipo: 'passarVez', vez: { cartaId: carta.id, rodada: luta.turnos.rodada } })}>
          {carta === null ? 'Passar a vez' : `Passar a vez de ${nomeDe(vagaDaVez?.personagemId)}`}
        </button>
      </div>

      <form className="lo-lu-arbitro__grupo" onSubmit={ajustar}>
        <h4 className="lo-lu-arbitro__rotulo">Ajustar uma ficha</h4>
        <select className="lo-lu-time" aria-label="Ficha a ajustar" value={tokenDoAjuste} onChange={(evento) => setTokenDoAjuste(evento.target.value)}>
          {naLuta.map((vaga) => (
            <option key={vaga.tokenId} value={vaga.tokenId}>
              {nomeDe(vaga.personagemId)} ({nomeDoLado(vaga.lado)})
            </option>
          ))}
        </select>
        <div className="lo-lu-numeros">
          {recursos.map((recurso) => (
            <label key={recurso.id} className="lo-lu-numero">
              <span>
                {recurso.rotulo} <span className="lo-motivo">agora {recurso.atual}/{recurso.maximo}</span>
              </span>
              <input type="number" inputMode="numeric" min={0} max={recurso.maximo} placeholder={String(recurso.atual)} value={valores[recurso.id] ?? ''} onChange={(evento) => setValores((antes) => ({ ...antes, [recurso.id]: evento.target.value }))} />
            </label>
          ))}
          {temEscudo && docDoAjuste !== undefined && (
            <label className="lo-lu-numero">
              <span>
                Escudo <span className="lo-motivo">agora {docDoAjuste.recursos.escudo ?? 0}</span>
              </span>
              <input type="number" inputMode="numeric" min={0} placeholder={String(docDoAjuste.recursos.escudo ?? 0)} value={valores.escudo ?? ''} onChange={(evento) => setValores((antes) => ({ ...antes, escudo: evento.target.value }))} />
            </label>
          )}
        </div>
        <button type="submit" className="lo-btn" disabled={desligado || vagaDoAjuste === undefined || Object.values(valores).every((valor) => valor.trim() === '')}>
          Aplicar o ajuste
        </button>
      </form>

      <form className="lo-lu-arbitro__grupo" onSubmit={definirRegra}>
        <h4 className="lo-lu-arbitro__rotulo">Regra do campo</h4>
        <label className="lo-lu-numero">
          <span>Nome</span>
          <input type="text" maxLength={NOME_DA_REGRA_MAX} value={nomeDaRegra} onChange={(evento) => setNomeDaRegra(evento.target.value)} />
        </label>
        <label className="lo-lu-numero">
          <span>Blocos por rank</span>
          <input type="number" min={BLOCOS_POR_RANK_MIN} max={BLOCOS_POR_RANK_MAX} value={blocos} onChange={(evento) => setBlocos(Math.min(BLOCOS_POR_RANK_MAX, Math.max(BLOCOS_POR_RANK_MIN, Math.round(Number(evento.target.value) || BLOCOS_POR_RANK_PADRAO))))} />
        </label>
        <label className="lo-lu-numero">
          <span>O que vale</span>
          <textarea rows={3} maxLength={TEXTO_DA_REGRA_MAX} value={textoDaRegra} onChange={(evento) => setTextoDaRegra(evento.target.value)} />
        </label>
        <div className="lo-tr-vez__botoes">
          <button type="submit" className="lo-btn" disabled={desligado || nomeDaRegra.trim() === ''}>
            Definir a regra
          </button>
          {luta.regras !== null && (
            <button type="button" className="lo-btn lo-btn--fantasma" disabled={desligado} onClick={() => pedir({ tipo: 'regras', regras: null })}>
              Tirar a regra
            </button>
          )}
        </div>
      </form>

      <div className="lo-lu-arbitro__grupo">
        <h4 className="lo-lu-arbitro__rotulo">Encerrar</h4>
        <select className="lo-lu-time" aria-label="Quem vence" value={vencedor} onChange={(evento) => setVencedor(evento.target.value as LadoDaLuta | 'empate')}>
          {lados.map((lado) => (
            <option key={lado} value={lado}>
              Vitória de {nomeDoLado(lado)}
            </option>
          ))}
          <option value="empate">Empate</option>
        </select>
        {confirmarFim ? (
          <div className="lo-tr-vez__botoes" role="group" aria-label="Confirmar o encerramento">
            <button type="button" className="lo-btn" disabled={desligado} onClick={() => pedir({ tipo: 'encerrar', vencedor: vencedor === 'empate' ? null : vencedor })}>
              Encerrar de vez
            </button>
            {/* O foco vai para o lado seguro: Enter sem querer não encerra a luta. */}
            <button type="button" className="lo-btn lo-btn--fantasma" autoFocus onClick={() => setConfirmarFim(false)}>
              Continuar a luta
            </button>
          </div>
        ) : (
          <button type="button" className="lo-btn" disabled={desligado} onClick={() => setConfirmarFim(true)}>
            Encerrar a luta…
          </button>
        )}
      </div>
    </section>
  )
}
