import { useRef, useState } from 'react'
import {
  BLOCOS_POR_RANK_MAX,
  BLOCOS_POR_RANK_MIN,
  BLOCOS_POR_RANK_PADRAO,
  NOME_DA_REGRA_MAX,
  REGRAS_MAX,
  TEXTO_DA_REGRA_MAX,
  blocosPorRankValido,
  type RegraDoCampo,
} from '../../lib/batalha/regrasDoCampo'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoNum } from '../grimorio/CampoNum'
import { CampoTexto } from '../grimorio/CampoTexto'
import { Dialogo } from '../grimorio/Dialogo'
import './batalha.css'

/**
 * A BIBLIOTECA GLOBAL de regras do campo (decisão 7), como a de sons: vale
 * para toda aventura. Criar, renomear, ajustar e apagar. A mudança vale na
 * hora (a store grava sozinha); a batalha que já começou guarda a cópia dela
 * e não muda.
 */

type MudancaNaRegra = Partial<Pick<RegraDoCampo, 'nome' | 'blocosPorRank' | 'texto'>>

export interface BibliotecaDeRegrasDialogProps {
  aberto: boolean
  regras: readonly RegraDoCampo[]
  /** Cria e devolve a regra (o id é da store); `null` = a biblioteca recusou. */
  onCriar: (rascunho: { nome: string; blocosPorRank: number; texto: string }) => RegraDoCampo | null
  onMudar: (regraId: string, mudanca: MudancaNaRegra) => void
  onApagar: (regraId: string) => void
  /** Por que a biblioteca não grava agora; presente = criar e mudar desligados, com o motivo à vista. */
  naoGuarda?: string | null
  onFechar: () => void
}

export function BibliotecaDeRegrasDialog({ aberto, regras, onCriar, onMudar, onApagar, naoGuarda, onFechar }: BibliotecaDeRegrasDialogProps) {
  const [escolhidaId, setEscolhidaId] = useState<string | null>(null)
  const [apagando, setApagando] = useState<RegraDoCampo | null>(null)
  const cancelar = useRef<HTMLButtonElement>(null)
  const escolhida = regras.find((regra) => regra.id === escolhidaId) ?? regras[0] ?? null
  const cheia = regras.length >= REGRAS_MAX
  const motivoParaNaoCriar = naoGuarda ?? (cheia ? `A biblioteca já tem ${REGRAS_MAX} regras` : null)

  const criar = () => {
    if (motivoParaNaoCriar !== null) return
    const regra = onCriar({ nome: `Regra ${regras.length + 1}`, blocosPorRank: BLOCOS_POR_RANK_PADRAO, texto: '' })
    if (regra !== null) setEscolhidaId(regra.id)
  }

  return (
    <>
      <Dialogo aberto={aberto} titulo="Biblioteca de regras do campo" descricao="Vale para todas as aventuras. A batalha que já começou guarda a cópia dela." onFechar={onFechar}>
        <div className="bt-biblioteca">
          <div>
            {regras.length === 0 ? (
              <p className="bt-biblioteca__vazia">Nenhuma regra guardada ainda.</p>
            ) : (
              <ul className="bt-biblioteca__lista" aria-label="Regras guardadas">
                {regras.map((regra) => (
                  <li key={regra.id}>
                    <button type="button" className="bt-biblioteca__item" aria-current={regra.id === escolhida?.id} onClick={() => setEscolhidaId(regra.id)}>
                      {regra.nome}
                      <small>
                        {regra.blocosPorRank} {regra.blocosPorRank === 1 ? 'bloco' : 'blocos'} por rank
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Acoes>
              <Botao tamanho="p" aria-disabled={motivoParaNaoCriar !== null} title={motivoParaNaoCriar ?? undefined} onClick={criar}>
                Nova regra
              </Botao>
            </Acoes>
            {naoGuarda && <p className="bt-texto">{naoGuarda}</p>}
          </div>
          <div data-gr-foco="">
            {escolhida === null ? (
              <p className="bt-texto">Crie uma regra para escolher ao iniciar uma batalha: o texto que vale no campo e quantos blocos cada rank de Agilidade anda.</p>
            ) : (
              <>
                <CampoTexto rotulo="Nome" valor={escolhida.nome} maxLength={NOME_DA_REGRA_MAX} onChange={(nome) => onMudar(escolhida.id, { nome })} />
                <CampoNum
                  rotulo="Blocos por rank de Agilidade"
                  valor={escolhida.blocosPorRank}
                  min={BLOCOS_POR_RANK_MIN}
                  max={BLOCOS_POR_RANK_MAX}
                  passo={1}
                  unidade="blocos"
                  onChange={(blocos) => onMudar(escolhida.id, { blocosPorRank: blocosPorRankValido(Math.round(blocos)) })}
                />
                <CampoTexto rotulo="Texto" multilinha valor={escolhida.texto} maxLength={TEXTO_DA_REGRA_MAX} onChange={(texto) => onMudar(escolhida.id, { texto })} />
                <Acoes>
                  <Botao variante="perigo" tamanho="p" onClick={() => setApagando(escolhida)}>
                    Apagar regra
                  </Botao>
                </Acoes>
              </>
            )}
          </div>
        </div>
      </Dialogo>
      <Dialogo aberto={apagando !== null} alerta pequeno titulo="Apagar regra?" focoInicial={cancelar} onFechar={() => setApagando(null)} descricao="A batalha que já usa esta regra continua com a cópia dela.">
        <Acoes>
          <Botao
            variante="perigo"
            onClick={() => {
              if (apagando !== null) onApagar(apagando.id)
              setApagando(null)
              setEscolhidaId(null)
            }}
          >
            Apagar {apagando?.nome ?? ''}
          </Botao>
          <Botao ref={cancelar} variante="fantasma" onClick={() => setApagando(null)}>
            Cancelar
          </Botao>
        </Acoes>
      </Dialogo>
    </>
  )
}
