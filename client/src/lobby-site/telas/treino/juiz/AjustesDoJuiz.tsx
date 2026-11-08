import { useId, type ReactNode } from 'react'
import type { ReacaoDoBoneco } from '../../../../lib/arena/tipos'
import { recursoDoEscudo } from '../../../../lib/batalha/leituraDaFicha'
import type { Personagem } from '../../../../lib/personagem'
import type { SistemaDeRpg } from '../../../../lib/sistemaDeRpg'
import {
  ajusteDoNumero,
  ajustesPadraoDoJuiz,
  faixaDoNumero,
  fichaDoJuiz,
  juizMudou,
  NOME_DO_JUIZ,
  numerosDaBase,
  numerosNaLuta,
  RETRATO_DO_JUIZ,
  recursoDaEnergia,
  type AjustesDoJuiz as Ajustes,
} from '../../../../lib/treino/juiz'
import { recursoDeVida } from '../../../../lib/vidaDaFicha'
import { CampoInteiro, EditorDeTecnicas } from './CamposDoTreino'

/**
 * O PAINEL DO JUDGE NO TREINO (fatia J; F1 da Arena multijogador): quem ele é
 * (o boneco da Arena ou a cópia de uma ficha da mesa), os status (HP, SP,
 * Escudo e cada atributo), o que ele faz quando leva um golpe (o mesmo par do
 * boneco da Arena: rola o d20 ou fica parado) e as técnicas de treino. Os
 * números são os da LUTA (com o modificador e as transformações da base já
 * somados), e se guarda a diferença sobre a base: igual ao da base = sem
 * ajuste. Cada
 * número válido vai na hora para `onMudar` (quem chama guarda no navegador, por
 * mesa); "Voltar ao padrão" apaga tudo e o Judge volta a ser o boneco da Arena
 * (HP 100, sem técnica). Nada daqui vai ao servidor nem muda ficha de ninguém.
 */

/** Uma ficha da mesa que o Judge pode copiar. */
export interface OpcaoDeBase {
  fichaId: string
  nome: string
  /** "sua", "de Pedro". */
  dono: string
}

export interface AjustesDoJuizProps {
  ajustes: Ajustes
  sistema: SistemaDeRpg
  /** A ficha que `ajustes.baseFichaId` aponta, como a mesa a tem; `null` = o boneco, ou a base saiu da mesa. */
  base: Personagem | null
  opcoesDeBase: readonly OpcaoDeBase[]
  onMudar(ajustes: Ajustes): void
  onVoltarAoPadrao(): void
  /** `false` = o navegador não deixou guardar; `null` = nada mudou nesta visita. */
  guardado: boolean | null
  /** As builds salvas, embaixo do painel. */
  children?: ReactNode
}

const REACOES_DO_JUIZ: readonly { id: ReacaoDoBoneco; nome: string; explica: string }[] = [
  { id: 'd20', nome: 'Rola o d20', explica: 'Rola o d20 e fica com a melhor defesa que o dado liberar: esquiva, metade ou cheio. Nunca contra-ataca.' },
  { id: 'parado', nome: 'Fica parado', explica: 'Não reage: todo golpe entra cheio. Serve para medir o dano inteiro da sua build.' },
]

/** O valor do `<select>` quando o Judge é o boneco (id de ficha nunca é vazio). */
const SEM_BASE = ''

function horaCurta(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function AjustesDoJuiz({ ajustes, sistema, base, opcoesDeBase, onMudar, onVoltarAoPadrao, guardado, children }: AjustesDoJuizProps) {
  const reacaoId = useId()
  const baseId = useId()
  const padrao = numerosDaBase(sistema, base)
  const vida = recursoDeVida(sistema)
  const energia = recursoDaEnergia(sistema)
  const escudo = recursoDoEscudo(sistema)
  // A ficha como vai à luta: o dano das técnicas é lido com os atributos de agora, e os campos mostram os números dela.
  const ficha = fichaDoJuiz(sistema, ajustes, base)
  const naLuta = numerosNaLuta(sistema, ficha)
  const mudou = juizMudou(ajustes)
  const baseSumiu = ajustes.baseFichaId !== null && base === null
  const mudar = (parte: Partial<Ajustes>) => onMudar({ ...ajustes, ...parte, salvoEm: Date.now() })
  const deOnde = base === null ? 'padrão' : `na ficha de ${base.nome}`
  const nota = (valor: number, daBase: number) => (valor === daBase ? (base === null ? 'igual ao padrão' : `igual à ficha de ${base.nome}`) : `${deOnde}: ${daBase.toLocaleString('pt-BR')}`)

  function mudarAtributo(id: string, valor: number) {
    const atributos = { ...ajustes.atributos }
    const guardado = ajusteDoNumero(valor, padrao.atributos[id] ?? 0, padrao.soma.atributos[id] ?? 0)
    if (guardado === null) delete atributos[id]
    else atributos[id] = guardado
    mudar({ atributos })
  }

  // Trocar de base zera os números (eram a diferença sobre a outra); as técnicas e a reação ficam.
  function mudarBase(valor: string) {
    mudar({ baseFichaId: valor === SEM_BASE ? null : valor, hp: null, sp: null, escudo: null, atributos: {} })
  }

  const { hp, sp, escudo: valorDoEscudo } = naLuta
  // A faixa de cada campo é a do número guardado (`validarAjustesDoJuiz`), com a soma da base por cima.
  const faixaDoHp = faixaDoNumero(1, padrao.soma.hp)
  const faixaDoSp = faixaDoNumero(0, padrao.soma.sp)
  const faixaDoEscudo = faixaDoNumero(0, 0)

  return (
    <div className="lo-tr-build lo-tr-juiz">
      <div className="lo-tr-juiz__cab">
        <img className="lo-tr-juiz__retrato" src={RETRATO_DO_JUIZ} alt="" width={64} height={64} decoding="async" />
        <div className="lo-tr-juiz__texto">
          <h2 className="lo-tr-bloco__titulo">{base === null ? `${NOME_DO_JUIZ}, o boneco de teste` : `${NOME_DO_JUIZ}, cópia de ${base.nome}`}</h2>
          <p className="lo-tr-explica">
            {base === null
              ? 'O mesmo boneco da Arena do app. O robô do treino joga por ele. Mude os números e dê técnicas: vale só neste navegador e nunca vai ao servidor.'
              : `Luta com a ficha de ${base.nome} como ela está agora, com os seus ajustes por cima. O robô do treino joga por ele; a ficha de verdade nunca muda.`}
          </p>
        </div>
        <button type="button" className="lo-btn lo-btn--fantasma" disabled={!mudou} onClick={onVoltarAoPadrao}>
          Voltar ao padrão
        </button>
      </div>

      <div className="lo-campo lo-tr-build__ficha">
        <label htmlFor={baseId}>Quem o {NOME_DO_JUIZ} é</label>
        <select id={baseId} className="lo-tr-select" value={ajustes.baseFichaId ?? SEM_BASE} onChange={(evento) => mudarBase(evento.target.value)}>
          <option value={SEM_BASE}>O boneco da Arena</option>
          {opcoesDeBase.length > 0 && (
            <optgroup label="Cópia de uma ficha da mesa">
              {opcoesDeBase.map((opcao) => (
                <option key={opcao.fichaId} value={opcao.fichaId}>
                  {opcao.nome} ({opcao.dono})
                </option>
              ))}
            </optgroup>
          )}
          {baseSumiu && ajustes.baseFichaId !== null && (
            <option value={ajustes.baseFichaId} disabled>
              Uma ficha que saiu da mesa
            </option>
          )}
        </select>
      </div>
      {baseSumiu && <p className="lo-motivo">A ficha que o {NOME_DO_JUIZ} copiava saiu da mesa: ele luta como o boneco da Arena até você escolher outra.</p>}
      {opcoesDeBase.length === 0 && <p className="lo-motivo">Nenhuma ficha na mesa para copiar ainda: o {NOME_DO_JUIZ} fica como o boneco da Arena.</p>}

      <fieldset className="lo-tr-build__grade">
        <legend>Status</legend>
        {vida !== null && (
          <CampoInteiro
            rotulo={`${vida.nome} máxima`}
            valor={hp}
            {...faixaDoHp}
            onMudar={(valor) => mudar({ hp: ajusteDoNumero(valor, padrao.hp, padrao.soma.hp) })}
            nota={nota(hp, padrao.hp)}
            mudou={hp !== padrao.hp}
          />
        )}
        {energia !== null && (
          <CampoInteiro
            rotulo={`${energia.nome} máxima`}
            valor={sp}
            {...faixaDoSp}
            onMudar={(valor) => mudar({ sp: ajusteDoNumero(valor, padrao.sp, padrao.soma.sp) })}
            nota={nota(sp, padrao.sp)}
            mudou={sp !== padrao.sp}
          />
        )}
        {escudo !== null && (
          <CampoInteiro
            rotulo={escudo.nome}
            valor={valorDoEscudo}
            {...faixaDoEscudo}
            onMudar={(valor) => mudar({ escudo: ajusteDoNumero(valor, padrao.escudo, 0) })}
            nota={nota(valorDoEscudo, padrao.escudo)}
            mudou={valorDoEscudo !== padrao.escudo}
          />
        )}
      </fieldset>

      <fieldset className="lo-tr-juiz__reage" aria-describedby={`${reacaoId}-nota`} data-mudou={ajustes.reage !== ajustesPadraoDoJuiz().reage ? '1' : undefined}>
        <legend>Quando leva um golpe</legend>
        <div className="lo-tr-seg">
          {REACOES_DO_JUIZ.map((reacao) => (
            <label key={reacao.id} className="lo-tr-seg__op">
              <input type="radio" name={`${reacaoId}-reage`} value={reacao.id} checked={ajustes.reage === reacao.id} onChange={() => mudar({ reage: reacao.id })} />
              <span>{reacao.nome}</span>
            </label>
          ))}
        </div>
        <p className="lo-tr-juiz__nota" id={`${reacaoId}-nota`}>
          {REACOES_DO_JUIZ.find((reacao) => reacao.id === ajustes.reage)?.explica}
        </p>
      </fieldset>

      <fieldset className="lo-tr-build__grade">
        <legend>Atributos</legend>
        {sistema.atributos.map((atributo) => {
          const daBase = padrao.atributos[atributo.id] ?? 0
          const valor = naLuta.atributos[atributo.id] ?? daBase
          const faixa = faixaDoNumero(0, padrao.soma.atributos[atributo.id] ?? 0)
          return <CampoInteiro key={atributo.id} rotulo={atributo.nome} valor={valor} {...faixa} onMudar={(novo) => mudarAtributo(atributo.id, novo)} nota={nota(valor, daBase)} mudou={valor !== daBase} />
        })}
      </fieldset>

      <EditorDeTecnicas titulo={`Técnicas do ${NOME_DO_JUIZ}`} tecnicas={ajustes.tecnicas} personagem={ficha} sistema={sistema} onMudar={(tecnicas) => mudar({ tecnicas })} />

      <p className="lo-motivo" role="status">
        {guardado === false
          ? 'O navegador não deixou guardar: estes ajustes somem quando a página fechar.'
          : mudou && ajustes.salvoEm > 0
            ? `Ajustes do ${NOME_DO_JUIZ} guardados neste navegador às ${horaCurta(ajustes.salvoEm)}.`
            : `O ${NOME_DO_JUIZ} está no padrão da Arena: ${padrao.hp.toLocaleString('pt-BR')} de vida, nenhuma técnica, Agilidade 0, rola o d20 quando leva um golpe.`}
      </p>

      {children}
    </div>
  )
}
