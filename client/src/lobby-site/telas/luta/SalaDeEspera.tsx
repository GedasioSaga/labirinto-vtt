import { useMemo, useState } from 'react'
import type { EsperaDaLuta, VagaNaEspera } from '../../../lib/treino/lutaDoLobby'
import { VAGAS_POR_LADO_MAX, type LadoDaLuta } from '../../../lib/treino/mesaEmMemoria'
import { campanhaDaRota } from '../../dados/rotas'
import type { EstadoDaCampanha } from '../../dados/sessaoDaCampanha'
import { useAgora, useDoSite, useSistemaDoLobby, useSite } from '../contexto'
import { lerAjustesDoJuiz } from '../treino/juiz/juizDoTreino'
import { fichasParaLutar, inimigosDoTreino, SeletorDeTime } from './CriarLuta'
import { EscolhaDeFichas } from './EscolhaDeFichas'
import { juntarNomes, nomeDoTime, TEXTO_DO_MODO, TEXTO_DO_PAPEL, tempoQueFalta } from './textosDaLuta'

/**
 * A SALA DE ESPERA da luta de N lados (Arena multijogador F5): quem está em
 * cada lado, quem já aceitou e com que fichas, e quanto falta para a sala
 * fechar sozinha (5 minutos). Quem foi convidado aceita com as fichas dele
 * (no time, pode trocar de time) ou recusa; quem criou começa quando 2 lados
 * ou mais têm alguém dentro, e quem não aceitou fica de fora.
 */

function nomesDasFichas(campanha: EstadoDaCampanha, ids: readonly string[]): string {
  return juntarNomes(ids.map((id) => campanha.fichas.find((ficha) => ficha.doc.id === id)?.doc.nome ?? 'uma ficha'))
}

function LinhaDaConta({ conta, campanha, eu }: { conta: VagaNaEspera; campanha: EstadoDaCampanha; eu: string }) {
  const quem = conta.contaId === eu ? `${conta.nome} (você)` : conta.nome
  return (
    <li className="lo-lu-conta" data-aceitou={conta.aceitou ? '' : undefined}>
      <span className="lo-lu-conta__marca" aria-hidden="true" />
      <span className="lo-lu-conta__nome">{quem}</span>
      <span className="lo-motivo">
        {conta.aceitou
          ? conta.papel === 'juiz'
            ? `com o Judge${conta.fichas.length > 0 ? ` e ${nomesDasFichas(campanha, conta.fichas)}` : ''}`
            : conta.fichas.length > 0
              ? `com ${nomesDasFichas(campanha, conta.fichas)}`
              : `entrou, ${TEXTO_DO_PAPEL[conta.papel]}`
          : 'ainda não respondeu'}
      </span>
    </li>
  )
}

/** Quantos lados já têm alguém dentro que luta: o "Começar" precisa de 2. */
function ladosProntos(espera: EsperaDaLuta): number {
  return new Set(espera.contas.filter((conta) => conta.aceitou && conta.lado !== null && (conta.papel === 'juiz' || conta.fichas.length > 0)).map((conta) => conta.lado)).size
}

export function SalaDeEspera({ espera, campanha, ocupado }: { espera: EsperaDaLuta; campanha: EstadoDaCampanha; ocupado: boolean }) {
  const site = useSite()
  const sistema = useSistemaDoLobby()
  const demo = useDoSite((estado) => estado.demo)
  const campanhaId = useDoSite((estado) => campanhaDaRota(estado.rota))
  const agora = useAgora(1_000)
  const eu = campanha.eu?.contaId ?? ''
  const minha = espera.contas.find((conta) => conta.contaId === eu)
  const souCriador = espera.criador.contaId === eu
  const minhas = useMemo(() => fichasParaLutar(campanha), [campanha])
  const inimigos = useMemo(() => inimigosDoTreino(campanha), [campanha])
  const [fichas, setFichas] = useState<string[]>(() => (minhas[0] === undefined ? [] : [minhas[0].doc.id]))
  const [lado, setLado] = useState<LadoDaLuta | null>(minha?.lado ?? null)
  const prontos = ladosProntos(espera)
  const semLado = espera.contas.filter((conta) => conta.lado === null)
  const titulo = souCriador ? 'A sua sala de espera' : `${espera.criador.nome} chamou você para lutar`

  function aceitar() {
    if (minha === undefined) return
    if (minha.papel === 'juiz') {
      const ajustes = campanhaId === null ? undefined : { ...lerAjustesDoJuiz(campanhaId, demo, sistema) }
      site.lutas()?.aceitar(espera.id, lado, fichas.filter((id) => inimigos.some((ficha) => ficha.doc.id === id)), ajustes)
      return
    }
    site.lutas()?.aceitar(espera.id, lado, minha.papel === 'jogador' ? fichas : [])
  }

  const escolheFichas = minha !== undefined && !minha.aceitou && (minha.papel === 'jogador' || minha.papel === 'juiz')
  return (
    <li className="lo-tr-convite lo-lu-sala">
      <div className="lo-lu-sala__cabeca">
        <p className="lo-lu-sala__titulo">{titulo}</p>
        <span className="lo-tag">{TEXTO_DO_MODO[espera.modo]}</span>
        <span className="lo-motivo lo-lu-sala__prazo" role="timer">
          fecha em {tempoQueFalta(espera.venceEm - agora)}
        </span>
      </div>

      <div className="lo-lu-lados">
        {espera.lados.map((cada) => {
          const contas = espera.contas.filter((conta) => conta.lado === cada)
          return (
            <section key={cada} className="lo-lu-lado" aria-label={espera.modo === 'times' ? nomeDoTime(cada) : juntarNomes(contas.map((conta) => conta.nome))}>
              <h4 className="lo-lu-lado__nome">{espera.modo === 'times' ? nomeDoTime(cada) : `Lado ${cada.toUpperCase()}`}</h4>
              <ul className="lo-lu-contas">
                {contas.map((conta) => (
                  <LinhaDaConta key={conta.contaId} conta={conta} campanha={campanha} eu={eu} />
                ))}
              </ul>
            </section>
          )
        })}
        {semLado.length > 0 && (
          <section className="lo-lu-lado lo-lu-lado--fora" aria-label="Sem lado">
            <h4 className="lo-lu-lado__nome">Sem lado</h4>
            <ul className="lo-lu-contas">
              {semLado.map((conta) => (
                <LinhaDaConta key={conta.contaId} conta={{ ...conta, nome: `${conta.nome}, ${TEXTO_DO_PAPEL[conta.papel]}` }} campanha={campanha} eu={eu} />
              ))}
            </ul>
          </section>
        )}
      </div>

      {escolheFichas && minha.papel === 'jogador' && (
        <div className="lo-campo">
          <span className="lo-tr-rotulo">Com quem você luta (até {VAGAS_POR_LADO_MAX})</span>
          {minhas.length === 0 ? <p className="lo-motivo">Você não tem personagem na mesa para aceitar.</p> : <EscolhaDeFichas fichas={minhas} escolhidas={fichas} maximo={VAGAS_POR_LADO_MAX} onMudar={setFichas} />}
          {espera.modo === 'times' && lado !== null && (
            <div className="lo-lu-quantos">
              <span className="lo-tr-rotulo">O seu time</span>
              <SeletorDeTime rotulo="O seu time" valor={lado} lados={espera.lados} onMudar={setLado} />
            </div>
          )}
        </div>
      )}
      {escolheFichas && minha.papel === 'juiz' && (
        <div className="lo-campo">
          <span className="lo-tr-rotulo">Você joga com o Judge. Inimigos do treino junto (até {VAGAS_POR_LADO_MAX - 1}, pode ficar só o Judge)</span>
          {inimigos.length > 0 && <EscolhaDeFichas fichas={inimigos} escolhidas={fichas.filter((id) => inimigos.some((ficha) => ficha.doc.id === id))} maximo={VAGAS_POR_LADO_MAX - 1} onMudar={setFichas} />}
          <p className="lo-motivo">O Judge entra como está em Treino, em “Ajustar o Judge”.</p>
        </div>
      )}

      <div className="lo-tr-vez__botoes">
        {minha !== undefined && !minha.aceitou && (
          <>
            <button type="button" className="lo-btn lo-btn--primario" disabled={ocupado || (minha.papel === 'jogador' && fichas.length === 0)} onClick={aceitar}>
              {minha.papel === 'arbitro' ? 'Aceitar e arbitrar' : 'Aceitar'}
            </button>
            <button type="button" className="lo-btn" disabled={ocupado} onClick={() => site.lutas()?.recusar(espera.id)}>
              Recusar
            </button>
          </>
        )}
        {souCriador && (
          <>
            <button type="button" className="lo-btn lo-btn--primario" disabled={ocupado || prontos < 2} onClick={() => site.lutas()?.comecar(espera.id)}>
              Começar a luta
            </button>
            <button type="button" className="lo-btn" disabled={ocupado} onClick={() => site.lutas()?.recusar(espera.id)}>
              Desistir da sala
            </button>
            <span className="lo-motivo">{prontos < 2 ? 'Esperando mais alguém aceitar: a luta precisa de 2 lados com gente.' : 'Quem não aceitou até começar fica de fora.'}</span>
          </>
        )}
        {!souCriador && minha?.aceitou === true && (
          <>
            <span className="lo-motivo" role="status">
              <span className="lo-giro" aria-hidden="true" /> Você está dentro. Esperando {espera.criador.nome} começar.
            </span>
            <button type="button" className="lo-btn" disabled={ocupado} onClick={() => site.lutas()?.recusar(espera.id)}>
              Sair da sala
            </button>
          </>
        )}
      </div>
    </li>
  )
}
