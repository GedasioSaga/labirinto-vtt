import { recursoDoEscudo } from '../../../../lib/batalha/leituraDaFicha'
import type { SistemaDeRpg } from '../../../../lib/sistemaDeRpg'
import { recursoDeVida } from '../../../../lib/vidaDaFicha'
import { CampoInteiro, EditorDeTecnicas } from './CamposDoTreino'
import { ajustesPadraoDoJuiz, fichaDoJuiz, juizMudou, NOME_DO_JUIZ, NUMERO_DO_JUIZ_MAX, RETRATO_DO_JUIZ, recursoDaEnergia, type AjustesDoJuiz as Ajustes } from './juizDoTreino'

/**
 * O PAINEL DO JUDGE NO TREINO (fatia J): os status (HP, SP, Escudo e cada
 * atributo) e as técnicas de treino do boneco da Arena. Cada número válido vai
 * na hora para `onMudar` (quem chama guarda no navegador, por mesa); "Voltar ao
 * padrão" apaga tudo e o Judge volta a ser o da Arena (HP 100, sem técnica).
 * Nada daqui vai ao servidor nem muda ficha de ninguém.
 */

export interface AjustesDoJuizProps {
  ajustes: Ajustes
  sistema: SistemaDeRpg
  onMudar(ajustes: Ajustes): void
  onVoltarAoPadrao(): void
  /** `false` = o navegador não deixou guardar; `null` = nada mudou nesta visita. */
  guardado: boolean | null
}

function horaCurta(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function AjustesDoJuiz({ ajustes, sistema, onMudar, onVoltarAoPadrao, guardado }: AjustesDoJuizProps) {
  const padrao = ajustesPadraoDoJuiz()
  const vida = recursoDeVida(sistema)
  const energia = recursoDaEnergia(sistema)
  const escudo = recursoDoEscudo(sistema)
  // A ficha como vai à luta: o dano das técnicas é lido com os atributos de agora.
  const ficha = fichaDoJuiz(sistema, ajustes)
  const mudou = juizMudou(ajustes)
  const mudar = (parte: Partial<Ajustes>) => onMudar({ ...ajustes, ...parte, salvoEm: Date.now() })
  const nota = (valor: number, dePadrao: number) => (valor === dePadrao ? 'igual ao padrão' : `padrão: ${dePadrao.toLocaleString('pt-BR')}`)

  function mudarAtributo(id: string, valor: number) {
    const atributos = { ...ajustes.atributos }
    if (valor === 0) delete atributos[id]
    else atributos[id] = valor
    mudar({ atributos })
  }

  return (
    <div className="lo-tr-build lo-tr-juiz">
      <div className="lo-tr-juiz__cab">
        <img className="lo-tr-juiz__retrato" src={RETRATO_DO_JUIZ} alt="" width={64} height={64} decoding="async" />
        <div className="lo-tr-juiz__texto">
          <h2 className="lo-tr-bloco__titulo">{NOME_DO_JUIZ}, o boneco de teste</h2>
          <p className="lo-tr-explica">O mesmo boneco da Arena do app. O robô do treino joga por ele. Mude os números e dê técnicas: vale só neste navegador e nunca vai ao servidor.</p>
        </div>
        <button type="button" className="lo-btn lo-btn--fantasma" disabled={!mudou} onClick={onVoltarAoPadrao}>
          Voltar ao padrão
        </button>
      </div>

      <fieldset className="lo-tr-build__grade">
        <legend>Status</legend>
        {vida !== null && <CampoInteiro rotulo={`${vida.nome} máxima`} valor={ajustes.hp} min={1} max={NUMERO_DO_JUIZ_MAX} onMudar={(hp) => mudar({ hp })} nota={nota(ajustes.hp, padrao.hp)} mudou={ajustes.hp !== padrao.hp} />}
        {energia !== null && <CampoInteiro rotulo={`${energia.nome} máxima`} valor={ajustes.sp} min={0} max={NUMERO_DO_JUIZ_MAX} onMudar={(sp) => mudar({ sp })} nota={nota(ajustes.sp, padrao.sp)} mudou={ajustes.sp !== padrao.sp} />}
        {escudo !== null && <CampoInteiro rotulo={escudo.nome} valor={ajustes.escudo} min={0} max={NUMERO_DO_JUIZ_MAX} onMudar={(valor) => mudar({ escudo: valor })} nota={nota(ajustes.escudo, padrao.escudo)} mudou={ajustes.escudo !== padrao.escudo} />}
      </fieldset>

      <fieldset className="lo-tr-build__grade">
        <legend>Atributos</legend>
        {sistema.atributos.map((atributo) => {
          const valor = ajustes.atributos[atributo.id] ?? 0
          return <CampoInteiro key={atributo.id} rotulo={atributo.nome} valor={valor} min={0} max={NUMERO_DO_JUIZ_MAX} onMudar={(novo) => mudarAtributo(atributo.id, novo)} nota={nota(valor, 0)} mudou={valor !== 0} />
        })}
      </fieldset>

      <EditorDeTecnicas titulo={`Técnicas do ${NOME_DO_JUIZ}`} tecnicas={ajustes.tecnicas} personagem={ficha} sistema={sistema} onMudar={(tecnicas) => mudar({ tecnicas })} />

      <p className="lo-motivo" role="status">
        {guardado === false
          ? 'O navegador não deixou guardar: estes ajustes somem quando a página fechar.'
          : mudou && ajustes.salvoEm > 0
            ? `Ajustes do ${NOME_DO_JUIZ} guardados neste navegador às ${horaCurta(ajustes.salvoEm)}.`
            : `O ${NOME_DO_JUIZ} está no padrão da Arena: ${padrao.hp.toLocaleString('pt-BR')} de vida, nenhuma técnica, Agilidade 0.`}
      </p>
    </div>
  )
}
