import { useEffect, useMemo, useState } from 'react'
import type { CasaDaArena } from '../../../lib/arena/grade'
import type { JogadaDoDuelo } from '../../../lib/treino/duelo'
import { sementeNova } from '../../../lib/treino/sorteio'
import { dueloParaOLado } from '../../../lib/treino/vistaDoDuelo'
import { useSistemaDoLobby } from '../contexto'
import { Icone } from '../Icone'
import { ArenaDaLuta, type JogadasDaLuta } from './ArenaDaLuta'
import { comecarLutaLocal, jogarNaLuta, lutaAteOFim, passoDoInimigo, problemaDaMontagem, type LutaLocal, type MontagemDaLuta } from './lutaDeTreino'
import { nomeDaVez, oQueEsperaDeMim } from './quemJoga'
import { contar, textoDaRecusa, textoDoFim, tomDoFim } from './textosDoTreino'

/**
 * A LUTA TURNO A TURNO do treino (fatia T7, na cara da Arena desde a H): você
 * joga o seu lado pelo HUD da Arena (o menu ATACAR / HABILIDADES /
 * TRANSFORMAÇÃO / CONCENTRAR / ENCERRAR VEZ, a REAÇÃO e a grade), o robô joga
 * o inimigo com uma pausa curta para dar tempo de ler. Tudo roda no navegador
 * pela regra do duelo (`lutaDeTreino.ts`), e a vista do seu lado é a mesma que
 * o servidor monta no duelo (`dueloParaOLado`). A semente fica à vista:
 * "Repetir esta luta" volta ao começo com a mesma semente (mesmos dados; com as
 * mesmas escolhas, o mesmo fim) e "Nova semente" sorteia outra. "O robô joga
 * por mim" deixa os dois lados no robô. Andar não muda dano nem alcance (a
 * regra não usa distância): a semente vale igual andando ou não.
 */

/** A pausa do robô antes de cada jogada dele (e da sua, quando ele joga por você). */
const PAUSA_DO_ROBO_MS = 650
const PAUSA_COM_ROBO_POR_MIM_MS = 380

/** A linha de estado: quem joga agora, quando não é o menu da sua vez que diz. */
function textoDoEstado(vez: { nome: string; lado: 'a' | 'b' } | null, esperaDeMim: 'reagir' | 'agir' | null, roboPorMim: boolean): string | null {
  if (vez === null) return null
  if (roboPorMim) return `Vez de ${vez.nome}: o robô está jogando…`
  if (esperaDeMim === 'reagir') return `${vez.nome} golpeou: a defesa é sua (REAÇÃO).`
  if (esperaDeMim === 'agir') return null
  if (vez.lado === 'b') return `Vez de ${vez.nome}: o robô está jogando…`
  // A vez é sua mas não espera nada de você: o golpe espera a defesa do inimigo.
  return `${vez.nome} golpeou: o robô está defendendo…`
}

export function LutaTurnoATurno({ montagem, nomeDoInimigo }: { montagem: MontagemDaLuta; nomeDoInimigo: string }) {
  const [semente, setSemente] = useState(() => sementeNova())
  const [luta, setLuta] = useState<LutaLocal | null>(null)
  /** A montagem com que a luta começou: o "Repetir" luta com ela, mesmo se a escolha mudou depois. */
  const [montagemDaLuta, setMontagemDaLuta] = useState<MontagemDaLuta | null>(null)
  const [roboPorMim, setRoboPorMim] = useState(false)
  const [aberta, setAberta] = useState(false)
  const [recusa, setRecusa] = useState<{ texto: string; n: number } | null>(null)
  // O fio e a vista do seu lado (o lado A), como o servidor monta para o duelo.
  const sistema = useSistemaDoLobby()
  const lado = useMemo(() => (luta === null ? null : dueloParaOLado(luta.duelo, 'a', sistema)), [luta, sistema])
  const problema = problemaDaMontagem(montagem, sistema)

  // O robô joga quando a vez não é sua (ou quando ele joga por você), com uma pausa para dar tempo de ler.
  useEffect(() => {
    if (luta === null || lado === null || lado.fim !== null) return
    if (!roboPorMim && oQueEsperaDeMim(lado, 'a') !== null) return
    const id = window.setTimeout(
      () => {
        const depois = passoDoInimigo(luta, roboPorMim)
        if (depois !== null) setLuta(depois)
      },
      roboPorMim ? PAUSA_COM_ROBO_POR_MIM_MS : PAUSA_DO_ROBO_MS,
    )
    return () => window.clearTimeout(id)
  }, [luta, lado, roboPorMim])

  function recusar(texto: string) {
    setRecusa((antes) => ({ texto, n: (antes?.n ?? 0) + 1 }))
  }

  function comecar(qual: MontagemDaLuta, comSemente: number) {
    const comeco = comecarLutaLocal(qual, sistema, comSemente)
    if (!comeco.ok) {
      recusar(comeco.motivo)
      return
    }
    setRecusa(null)
    setSemente(comSemente)
    setMontagemDaLuta(qual)
    setLuta(comeco.luta)
    setAberta(true)
  }

  const repetir = () => {
    if (montagemDaLuta !== null) comecar(montagemDaLuta, semente)
  }
  const novaSemente = () => {
    const nova = sementeNova()
    if (luta === null) setSemente(nova)
    else comecar(montagem, nova)
  }

  /** A jogada do seu lado pela regra do duelo; recusada, o motivo vai ao recado da Arena. */
  function jogar(jogada: JogadaDoDuelo): boolean {
    if (luta === null) return false
    const feito = jogarNaLuta(luta, jogada)
    if (!feito.ok) {
      recusar(textoDaRecusa(feito.motivo))
      return false
    }
    setRecusa(null)
    setLuta(feito.luta)
    return true
  }

  const seq = luta?.duelo.seq ?? 0
  const jogadas = useMemo<JogadasDaLuta | null>(
    () =>
      luta === null || luta.duelo.fim !== null
        ? null
        : {
            agir: (vez, pedido) => jogar({ tipo: 'agir', seq, vez, pedido }),
            reagir: (pedido) => jogar({ tipo: 'reagir', seq, pedido }),
            passarVez: (cartaId, rodada) => jogar({ tipo: 'passar', seq, vez: { cartaId, rodada } }),
            marcar: (pedido) => jogar({ tipo: 'marcar', seq, pedido }),
          },
    // `jogar` lê a luta de agora: a conexão nova a cada luta nova basta.
    [luta],
  )

  /** Andar na grade: livre no seu lado, como na Arena do app; a regra recusa a casa ocupada ou fora da grade. */
  function andar(tokenId: string, casa: CasaDaArena, contraDe: string | undefined): boolean {
    const passo: JogadaDoDuelo = { tipo: 'andar', seq, vez: null, tokenId, col: casa.col, row: casa.row }
    return jogar(contraDe === undefined ? passo : { ...passo, contraDe })
  }

  function roboEscolhe() {
    if (luta === null) return
    const depois = passoDoInimigo(luta, true)
    if (depois === null) recusar('O robô não achou jogada agora.')
    else setLuta(depois)
  }

  const fim = lado?.fim ?? null
  const esperaDeMim = lado === null ? null : oQueEsperaDeMim(lado, 'a')
  const vez = lado === null || fim !== null ? null : nomeDaVez(lado)

  return (
    <div className="lo-tr-luta">
      <div className="lo-tr-semente" role="group" aria-label="Semente da luta">
        <p className="lo-tr-semente__texto">
          Semente <span className="lo-tr-semente__numero">{semente}</span>
        </p>
        <div className="lo-tr-semente__botoes">
          {luta === null ? (
            <button type="button" className="lo-btn lo-btn--primario" disabled={problema !== null} onClick={() => comecar(montagem, semente)}>
              Começar a luta
            </button>
          ) : (
            <>
              <button type="button" className="lo-btn lo-btn--primario" onClick={() => setAberta(true)}>
                {fim === null ? `Voltar à luta (rodada ${luta.duelo.cena.turnos.rodada})` : 'Ver o fim da luta'}
              </button>
              <button type="button" className="lo-btn" disabled={montagemDaLuta === null} onClick={repetir}>
                Repetir esta luta
              </button>
            </>
          )}
          <button type="button" className="lo-btn" disabled={problema !== null} onClick={novaSemente}>
            Nova semente
          </button>
        </div>
        <label className="lo-tr-chave">
          <input type="checkbox" checked={roboPorMim} onChange={(evento) => setRoboPorMim(evento.target.checked)} />
          <span>O robô joga por mim</span>
        </label>
      </div>

      {problema !== null && luta === null && <p className="lo-motivo">{problema}</p>}
      {recusa !== null && !aberta && (
        <p className="lo-linha-aviso" role="alert">
          {recusa.texto}
        </p>
      )}
      <p className="lo-tr-explica">
        A luta abre na Arena: a grade 12 × 8, o menu da vez à esquerda e a REAÇÃO embaixo. Mesma semente, mesmos dados: com as mesmas escolhas, a luta termina igual. O dano sai da ficha, ninguém
        digita. Nada aqui muda a sua ficha.
      </p>

      {aberta && luta !== null && lado !== null && (
        <ArenaDaLuta
          titulo="Treino"
          icone="treino"
          fio={lado}
          vista={lado.vista}
          meuLado="a"
          jogadas={jogadas}
          podeAndar={(vaga, emPe) => vaga.lado === 'a' && emPe}
          onAndar={andar}
          trilhas={luta.duelo.cena.trilhas}
          detalhes={
            <>
              <span>
                Semente <span className="lo-ar-semente">{luta.semente}</span>
              </span>
              <span>contra {nomeDoInimigo}</span>
            </>
          }
          acoes={
            <>
              {fim === null && (
                <label className="lo-tr-chave">
                  <input type="checkbox" checked={roboPorMim} onChange={(evento) => setRoboPorMim(evento.target.checked)} />
                  <span>O robô joga por mim</span>
                </label>
              )}
              {fim === null && !roboPorMim && esperaDeMim !== null && (
                <button type="button" className="lo-btn lo-btn--fantasma" onClick={roboEscolhe}>
                  O robô escolhe
                </button>
              )}
              {fim === null && (
                <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => setLuta(lutaAteOFim(luta))}>
                  Ir até o fim
                </button>
              )}
              <button type="button" className="lo-btn" disabled={montagemDaLuta === null} onClick={repetir}>
                Repetir esta luta
              </button>
              <button type="button" className="lo-btn" disabled={problema !== null} onClick={novaSemente}>
                Nova semente
              </button>
              <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => setAberta(false)}>
                <Icone nome="voltar" /> Sair da luta
              </button>
            </>
          }
          estado={textoDoEstado(vez, esperaDeMim, roboPorMim)}
          recusa={recusa}
          onEsquecerRecusa={() => setRecusa(null)}
          fim={
            fim === null ? null : (
              <>
                <p className="lo-ar-fim__titulo" data-tom={tomDoFim(fim, 'a')}>
                  {textoDoFim(fim, 'a', nomeDoInimigo)}
                </p>
                <p className="lo-ar-fim__nota">
                  Rodada {lado.turnos.rodada}, {contar(lado.seq, 'jogada', 'jogadas')}, semente {luta.semente}.
                </p>
                <div className="lo-ar-fim__botoes">
                  {/* O fim chega com o foco no botão de seguir: Enter repete a mesma luta. */}
                  <button type="button" className="lo-btn lo-btn--primario" autoFocus disabled={montagemDaLuta === null} onClick={repetir}>
                    Repetir esta luta
                  </button>
                  <button type="button" className="lo-btn" disabled={problema !== null} onClick={novaSemente}>
                    Nova semente
                  </button>
                  <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => setAberta(false)}>
                    Voltar à montagem
                  </button>
                </div>
              </>
            )
          }
        />
      )}
    </div>
  )
}
