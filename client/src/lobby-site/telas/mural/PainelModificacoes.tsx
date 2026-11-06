import { useEffect, useId, useRef } from 'react'
import type { ModificacaoDoMural } from '../../../lib/nuvem/muralDoLobby'
import type { EstadoDoMural } from '../../dados/muralDaCampanha'
import { enderecoDaRota, type Rota } from '../../dados/rotas'
import type { EstadoDaCampanha } from '../../dados/sessaoDaCampanha'
import { aoClicarNoLink, useAgora, useSite } from '../contexto'
import { horaExata, nomeDoDia, quandoRelativo, tomDe } from '../textos'
import { partesDaFrase } from './textosDoMural'

/**
 * AS MODIFICAÇÕES: o que mudou nas fichas da mesa, em frases simples ("Ana
 * mudou Vida de 30 para 24"), montadas pelo servidor SÓ com o que quem lê pode
 * ver. Filtro por ficha e por pessoa, por dia, da mais nova para a mais velha,
 * em páginas. Quando uma ficha muda com a tela aberta, as novas entram no topo.
 */

/** Uma ficha mudou: espera a rajada acabar antes de pedir de novo (o DO passa todo frame pelo ritmo). */
const ESPERA_DA_ATUALIZACAO_MS = 1_500

interface Props {
  campanha: EstadoDaCampanha
  mural: EstadoDoMural
  demo: boolean
}

export function PainelModificacoes({ campanha, mural, demo }: Props) {
  const site = useSite()
  const fichaId = useId()
  const pessoaId = useId()
  const agora = useAgora()
  const feed = mural.modificacoes
  const filtroDaFicha = feed?.fichaId ?? null
  const filtroDaPessoa = feed?.autorContaId ?? null
  const ehMestre = campanha.eu?.papel === 'mestre'

  // Abrir a aba pede a primeira página (com o filtro que já estava, se a pessoa voltou para cá). De novo quando o
  // mural fica pronto: a mesa pode ainda estar abrindo. Pedir o mesmo filtro outra vez não sai de novo.
  useEffect(() => {
    const parte = site.mural()
    const atual = parte?.estado().modificacoes ?? null
    parte?.verModificacoes(atual?.fichaId ?? null, atual?.autorContaId ?? null)
  }, [site, mural.pronto])

  // Ficha mudou com a aba aberta: as linhas novas entram no topo, sem perder as páginas já carregadas.
  const revVista = useRef(campanha.rev)
  useEffect(() => {
    if (campanha.rev === revVista.current) return
    revVista.current = campanha.rev
    const id = setTimeout(() => site.mural()?.atualizarModificacoes(), ESPERA_DA_ATUALIZACAO_MS)
    return () => clearTimeout(id)
  }, [site, campanha.rev])

  function escolher(ficha: string | null, pessoa: string | null) {
    site.mural()?.verModificacoes(ficha, pessoa)
  }

  // O jogador não recebe linha de NPC nem de ficha fora da mesa: o filtro só oferece o que pode trazer alguma.
  const fichas = campanha.fichas.filter((ficha) => ehMestre || (ficha.visivel === 'mesa' && ficha.doc.tipo === 'jogador'))
  const visiveis = new Set(campanha.fichas.map((ficha) => ficha.doc.id))
  const lista = feed?.lista ?? []
  const carregando = feed === null || (feed.carregando && !feed.carregada)
  const filtrando = filtroDaFicha !== null || filtroDaPessoa !== null
  const grupos: { dia: string; linhas: ModificacaoDoMural[] }[] = []
  for (const linha of lista) {
    const dia = nomeDoDia(linha.quando, agora)
    const ultimo = grupos.at(-1)
    if (ultimo !== undefined && ultimo.dia === dia) ultimo.linhas.push(linha)
    else grupos.push({ dia, linhas: [linha] })
  }

  return (
    <section aria-label="Modificações nas fichas" aria-busy={carregando}>
      <div className="lo-painel__cab">
        <p className="lo-secao__nota">
          {ehMestre ? 'Tudo o que mudou nas fichas da mesa, por quem mudou.' : 'O que mudou nas fichas dos jogadores da mesa, por quem mudou.'}
        </p>
      </div>
      <div className="lo-mural-filtros">
        <div className="lo-campo">
          <label htmlFor={fichaId}>Ficha</label>
          <select id={fichaId} className="lo-escolha" value={filtroDaFicha ?? ''} onChange={(evento) => escolher(evento.target.value === '' ? null : evento.target.value, filtroDaPessoa)}>
            <option value="">Todas as fichas</option>
            {fichas.map((ficha) => (
              <option key={ficha.doc.id} value={ficha.doc.id}>
                {ficha.doc.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="lo-campo">
          <label htmlFor={pessoaId}>Pessoa</label>
          <select id={pessoaId} className="lo-escolha" value={filtroDaPessoa ?? ''} onChange={(evento) => escolher(filtroDaFicha, evento.target.value === '' ? null : evento.target.value)}>
            <option value="">Todas as pessoas</option>
            {campanha.membros.map((membro) => (
              <option key={membro.contaId} value={membro.contaId}>
                {membro.papel === 'mestre' ? `${membro.nome} (mestre)` : membro.nome}
              </option>
            ))}
          </select>
        </div>
        {filtrando && (
          <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => escolher(null, null)}>
            Limpar filtros
          </button>
        )}
      </div>

      {!mural.pronto && !mural.carregado ? (
        <p className="lo-vazio">Sem internet: as modificações aparecem quando a conexão voltar.</p>
      ) : carregando ? (
        <p className="lo-carregando" role="status">
          <span className="lo-giro" aria-hidden="true" />
          Carregando as modificações…
        </p>
      ) : lista.length === 0 ? (
        <p className="lo-vazio">{filtrando ? 'Nada mudou com esses filtros. Tente outra ficha ou outra pessoa.' : 'Ninguém mudou as fichas ainda. Cada mudança aparece aqui, com quem fez e quando.'}</p>
      ) : (
        grupos.map((grupo) => (
          <div key={grupo.dia}>
            <h3 className="lo-hist__dia">{grupo.dia}</h3>
            <ol className="lo-eventos">
              {grupo.linhas.map((linha) => {
                const { quem, resto } = partesDaFrase(linha.frase, linha.autorNome)
                const daFicha: Rota = { tela: 'ficha', campanhaId: campanha.campanhaId, fichaId: linha.fichaId, aba: 'historico' }
                return (
                  <li key={linha.rev} className="lo-ev">
                    <span className="lo-av" data-tom={tomDe(linha.autorContaId)} aria-hidden="true">
                      {linha.autorNome.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="lo-ev__corpo">
                      <p className="lo-ev__frase">
                        {quem !== '' && <b>{quem}</b>} {resto}
                      </p>
                      <p className="lo-ev__meta">
                        <time dateTime={new Date(linha.quando).toISOString()} title={horaExata(linha.quando)}>
                          {quandoRelativo(linha.quando, agora)}
                        </time>
                        {visiveis.has(linha.fichaId) ? (
                          <a className="lo-ev__ficha" href={enderecoDaRota(daFicha, demo)} onClick={aoClicarNoLink(site, daFicha)} aria-label={`Histórico de ${linha.fichaNome}`}>
                            {linha.fichaNome}
                          </a>
                        ) : (
                          <span>{linha.fichaNome}</span>
                        )}
                        {linha.desfazendo === true && <span className="lo-tag">desfez outra mudança</span>}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        ))
      )}

      {feed !== null && feed.carregada && feed.proximaAntesDeRev !== null && (
        <div className="lo-mochila__pe">
          <button type="button" className="lo-btn" disabled={!mural.pronto || feed.carregando} onClick={() => site.mural()?.carregarMaisModificacoes()}>
            {feed.carregando ? <span className="lo-giro" aria-hidden="true" /> : null}
            {feed.carregando ? 'Carregando…' : 'Ver mudanças mais antigas'}
          </button>
          {!mural.pronto && <span className="lo-motivo">Sem conexão: volta quando ela voltar.</span>}
        </div>
      )}
    </section>
  )
}
