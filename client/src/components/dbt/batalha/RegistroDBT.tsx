import { useState } from 'react'
import type { LinhaDBT, TipoDaLinhaDBT } from '../../../lib/dbt/batalha/tipos'
import type { LinhaDBTParaJogador } from '../../../lib/dbt/batalha/vista'
import { linhaParaDesfazer } from './dadosDaBatalhaDBT'

/**
 * O REGISTRO DA BATALHA DBT: a mais nova em cima; quem fez o quê em quem e
 * a conta embaixo (acerto contra CA, faixa, dano, Ki gasto), aberta na mais
 * nova e num toque nas outras. O Desfazer é LIFO: só aparece na linha que
 * pode voltar agora (quem decide é `podeDesfazerDBT`, no host).
 */

export interface LinhaNaTelaDBT {
  id: string
  rodada: number
  tipo: TipoDaLinhaDBT
  autor: string | null
  texto: string
  detalhes: readonly string[]
  desfeita: boolean
  podeDesfazer: boolean
}

function nomeDoAutor(linha: LinhaDBT): string {
  return linha.autor.tipo === 'mestre' ? 'Mestre' : linha.autor.nome
}

/** O registro do mestre, com todos os números. */
export function linhasDoMestreDBT(registro: readonly LinhaDBT[]): LinhaNaTelaDBT[] {
  const desfazivel = linhaParaDesfazer(registro)
  const saida: LinhaNaTelaDBT[] = []
  for (let i = registro.length - 1; i >= 0; i -= 1) {
    const linha = registro[i]
    saida.push({
      id: linha.id,
      rodada: linha.rodada,
      tipo: linha.tipo,
      autor: nomeDoAutor(linha),
      texto: linha.texto,
      detalhes: linha.detalhes,
      desfeita: linha.desfeita !== undefined,
      podeDesfazer: linha.id === desfazivel?.id,
    })
  }
  return saida
}

/** O registro do jogador (`VistaDBT.registro`, a mais velha primeiro): o host já decidiu o `podeDesfazer` (sem d20, autor ele). */
export function linhasDoJogadorDBT(linhas: readonly LinhaDBTParaJogador[]): LinhaNaTelaDBT[] {
  return [...linhas].reverse().map((linha) => ({
    id: linha.id,
    rodada: linha.rodada,
    tipo: linha.tipo,
    autor: linha.autor,
    texto: linha.texto,
    detalhes: linha.detalhes,
    desfeita: linha.desfeita,
    podeDesfazer: linha.podeDesfazer && !linha.desfeita,
  }))
}

export interface RegistroDBTProps {
  linhas: readonly LinhaNaTelaDBT[]
  onDesfazer?: (linhaId: string) => void
  /** O Desfazer pedido e ainda sem resposta. */
  desfazendo?: string | null
  rotulo?: string
}

export function RegistroDBT({ linhas, onDesfazer, desfazendo = null, rotulo = 'Registro da batalha' }: RegistroDBTProps) {
  const [abertas, setAbertas] = useState<ReadonlySet<string>>(new Set())
  if (linhas.length === 0) return <p className="dbb-vazio">Nada aconteceu ainda. Iniciativa, golpes, reações, dano e Ki gasto entram aqui.</p>
  const maisNova = linhas[0]?.id
  return (
    <ol className="dbb-registro" aria-label={rotulo}>
      {linhas.map((linha) => {
        const aberta = linha.id === maisNova ? !abertas.has(linha.id) : abertas.has(linha.id)
        const alternar = () => {
          const proximas = new Set(abertas)
          if (proximas.has(linha.id)) proximas.delete(linha.id)
          else proximas.add(linha.id)
          setAbertas(proximas)
        }
        return (
          <li key={linha.id} className="dbb-linha" data-tipo={linha.tipo} data-desfeita={linha.desfeita ? 'sim' : 'nao'}>
            <span className="dbb-linha__r" aria-label={`Rodada ${linha.rodada}`}>
              R{linha.rodada}
            </span>
            <span className="dbb-linha__texto">
              {linha.texto}
              {linha.autor !== null && <span className="dbb-linha__autor"> ({linha.autor})</span>}
              {linha.desfeita && <span className="dbb-linha__autor"> desfeito</span>}
              {aberta && linha.detalhes.length > 0 && (
                <ul className="dbb-linha__det">
                  {linha.detalhes.map((detalhe, indice) => (
                    <li key={`${linha.id}-${indice}`}>{detalhe}</li>
                  ))}
                </ul>
              )}
            </span>
            <span className="dbb-carta__ctl">
              {linha.detalhes.length > 0 && (
                <button type="button" className="dbf-btn dbf-btn--xs dbf-btn--ghost" aria-expanded={aberta} onClick={alternar}>
                  Conta
                </button>
              )}
              {linha.podeDesfazer && onDesfazer !== undefined && (
                <button
                  type="button"
                  className="dbf-btn dbf-btn--xs"
                  disabled={desfazendo === linha.id}
                  aria-label={desfazendo === linha.id ? `Desfazendo: ${linha.texto}` : `Desfazer: ${linha.texto}`}
                  onClick={() => onDesfazer(linha.id)}
                >
                  {desfazendo === linha.id ? 'Desfazendo…' : 'Desfazer'}
                </button>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
