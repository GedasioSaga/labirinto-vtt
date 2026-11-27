import { useId } from 'react'
import { NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX } from '../../../lib/batalha/combate'
import type { DuracaoDoSelo, Efeito } from '../../../lib/batalha/mecanica/modelo'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { prazoCurto, fraseCurta } from '../../../lib/condicoes/frasesDaCondicao'
import { legadoDoSelo, seloSoComACondicao } from '../../../lib/condicoes/legado'
import { condicaoDoSeletor, duracaoDoPrazo, useCatalogoDoSeletor, type OpcaoDeCondicao } from '../editor/pecas/condicoesNoSeletor'
import { OpcoesDeCondicao } from '../editor/pecas/controlesDaPeca'
import { RegraDeAntes } from '../editor/pecas/RegraDeAntes'
import { CampoInteiro, Escolha, Texto } from './controles'

/**
 * O SELO DA PEÇA (construtor C5; rework das condições, E7, D4 e D6): quem põe escolhe QUAL condição, do
 * catálogo (as 35 de fábrica e, no app, as criadas), em quem cai e por quanto tempo. A regra é da
 * condição: a frase curta dela aparece logo abaixo. O nome livre (fora do catálogo) continua valendo, sem
 * regra, como antes.
 *
 * Os números próprios de antes (`mods`, `regra`, `porTurno`, `alcance`, `gatilho`) continuam guardados e
 * valendo por cima dos da condição (D4); a tela os mostra em "Regra própria (de antes)", sem campo para
 * mudar, com "Usar só a condição" e "Virar condição nova". Número novo se põe na condição (Livros ›
 * Condições), não aqui.
 *
 * O selo é o mesmo nas técnicas, nas armas e nos itens do editor de habilidades: o formato guardado não
 * muda.
 */

export type SeloDaPeca = Extract<Efeito, { tipo: 'selo' }>
type ComoDura = 'vezes' | 'proximoGolpe' | 'ateTirar'
type EmQuemDoSelo = 'alvo' | 'quemUsa' | 'atacante'

/** O valor do `<select>` para o nome fora do catálogo (um nome de condição nunca começa com "_"). */
const NOME_LIVRE = '__nome_livre__'

/** O selo sem o "em quem" (o padrão é o alvo). */
function semEmQuem(selo: SeloDaPeca): SeloDaPeca {
  const { em: _fora, ...resto } = selo
  return resto
}

/** A condição escolhida: o nome, a natureza pelo tipo dela e o prazo dela (D6: o padrão é o prazo da condição). */
function comACondicao(selo: SeloDaPeca, opcao: OpcaoDeCondicao): SeloDaPeca {
  return { ...selo, nome: opcao.nome, natureza: opcao.tipo === 'positiva' ? 'buff' : 'debuff', duracao: duracaoDoPrazo(opcao.condicao.montada.prazo) }
}

/** "3 vezes", "até o próximo golpe", "até tirarem": a duração do selo em palavras. */
function duracaoEmPalavras(duracao: DuracaoDoSelo): string {
  if (typeof duracao === 'number') return `${duracao} ${duracao === 1 ? 'vez' : 'vezes'}`
  return duracao === 'proximoGolpe' ? 'até o próximo golpe' : 'até tirarem'
}

interface PecasDoSeloProps {
  selo: SeloDaPeca
  /** O golpe é de ajuda (aliado ou em si): o "em quem cai" diz "em quem recebe". */
  ajuda: boolean
  /** Fase 4: em quem o selo pode cair, pelo "Quando usa" (só na reação = só em quem atacou). */
  emQuemPode: readonly EmQuemDoSelo[]
  /** Por que "em quem usa" não pode agora (já há outro selo nele); `null` = pode. */
  bloqueioEmQuemUsa: string | null
  listaId: string
  /** A ficha de quem usa (as frases da prévia); a regra da condição não depende dela. */
  ficha: FichaDaPrevia
  onChange: (selo: SeloDaPeca) => void
}

const ROTULO_DE_EM_QUEM: Readonly<Record<EmQuemDoSelo, string>> = { alvo: 'No alvo', quemUsa: 'Em quem usa', atacante: 'Em quem atacou (só quando reage)' }

export function PecasDoSelo({ selo, ajuda, emQuemPode, bloqueioEmQuemUsa, listaId, onChange }: PecasDoSeloProps) {
  const idDaCondicao = useId()
  const catalogo = useCatalogoDoSeletor()
  const naLista = catalogo.opcoes.find((opcao) => opcao.nome === selo.nome)
  // Pelo nome, como a batalha acha (D5: o apelido e o "Atordoado 2" também acham a de fábrica).
  const condicao = selo.nome.trim() === '' ? null : condicaoDoSeletor(catalogo, selo.nome.trim())
  const frase = condicao === null ? '' : fraseCurta(condicao.montada, catalogo.contexto)
  const legado = legadoDoSelo(selo)
  const como: ComoDura = typeof selo.duracao === 'number' ? 'vezes' : selo.duracao
  const em: EmQuemDoSelo = selo.em ?? 'alvo'
  const prazoDela = condicao === null ? null : duracaoDoPrazo(condicao.montada.prazo)
  return (
    <div className="lb-mec__selo">
      <datalist id={listaId}>
        {catalogo.opcoes.map((opcao) => (
          <option key={opcao.condicao.id} value={opcao.nome} />
        ))}
      </datalist>
      <div className="lb-mec__linha">
        <span className="lb-mec__texto">
          <label className="lb-mec__numero-rotulo" htmlFor={idDaCondicao}>
            Condição
          </label>
          <select
            id={idDaCondicao}
            className="lb-input"
            value={naLista === undefined ? NOME_LIVRE : naLista.nome}
            onChange={(evento) => {
              const valor = evento.target.value
              if (valor === NOME_LIVRE) {
                if (naLista !== undefined) onChange({ ...selo, nome: '' })
                return
              }
              const opcao = catalogo.opcoes.find((candidata) => candidata.nome === valor)
              if (opcao !== undefined) onChange(comACondicao(selo, opcao))
            }}
          >
            <OpcoesDeCondicao catalogo={catalogo} />
            <option value={NOME_LIVRE}>Outro nome (sem regra)</option>
          </select>
        </span>
      </div>
      {naLista === undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <Texto rotulo="Nome do selo" valor={selo.nome} maximo={NOME_DO_SELO_MAX} lista={listaId} placeholder="Ex.: Selo da Lua" onChange={(nome) => onChange({ ...selo, nome })} />
        </div>
      )}
      <p className="lb-field__hint lb-mec__regra">
        {condicao === null
          ? 'Nome fora do catálogo: o app só mostra o selo na carta (crie a condição em Livros › Condições para ela ter regra).'
          : frase === ''
            ? `${condicao.nome}: sem peça, o mestre narra.`
            : `${naLista === undefined ? `Vale como ${condicao.nome}: ` : 'O que faz: '}${frase}`}
      </p>
      {emQuemPode.length > 1 && (
        <Escolha<EmQuemDoSelo>
          legenda="Em quem cai"
          opcoes={emQuemPode.map((valor) => ({ valor, rotulo: valor === 'alvo' && ajuda ? 'Em quem recebe' : ROTULO_DE_EM_QUEM[valor], bloqueio: valor === 'quemUsa' && em !== 'quemUsa' ? bloqueioEmQuemUsa : null }))}
          valor={em}
          onChange={(novo) => onChange(novo === 'alvo' ? semEmQuem(selo) : { ...selo, em: novo })}
        />
      )}
      {legado !== null && (
        <RegraDeAntes
          legado={legado}
          nome={selo.nome}
          catalogo={catalogo}
          onUsarSoACondicao={() => onChange(seloSoComACondicao(selo))}
          onVirou={(nome) => onChange({ ...seloSoComACondicao(selo), nome })}
        />
      )}
      <div className="lb-mec__linha">
        <Escolha
          legenda="Por quanto tempo"
          opcoes={[
            { valor: 'vezes', rotulo: 'Algumas vezes' },
            { valor: 'proximoGolpe', rotulo: 'Até o próximo golpe' },
            { valor: 'ateTirar', rotulo: 'Até tirarem' },
          ]}
          valor={como}
          onChange={(novo) => onChange({ ...selo, duracao: novo === 'vezes' ? (typeof prazoDela === 'number' ? prazoDela : 1) : novo })}
        />
        {typeof selo.duracao === 'number' && <CampoInteiro rotulo="Dura" valor={selo.duracao} minimo={1} maximo={TURNOS_DO_SELO_MAX} depois={selo.duracao === 1 ? 'vez' : 'vezes'} onChange={(duracao) => onChange({ ...selo, duracao })} />}
      </div>
      {condicao !== null && prazoDela !== null && (
        <p className="lb-field__hint lb-mec__regra lb-cs-prazo">
          <span>{`O prazo de ${condicao.nome}: ${prazoCurto(condicao.montada.prazo)}.`}</span>
          {prazoDela !== selo.duracao && (
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => onChange({ ...selo, duracao: prazoDela })}>
              {`Usar o prazo dela (${duracaoEmPalavras(prazoDela)})`}
            </button>
          )}
        </p>
      )}
      <p className="lb-field__hint lb-mec__regra">
        {typeof selo.duracao === 'number'
          ? 'Conta na vez de quem tem o selo: desce 1 no fim de cada vez dele (1 = até o fim da próxima vez dele).'
          : selo.duracao === 'proximoGolpe'
            ? 'Sai quando outro golpe chegar em quem tem o selo.'
            : 'Fica até o mestre tirar na carta.'}
      </p>
    </div>
  )
}
