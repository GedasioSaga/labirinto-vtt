import { pinosEmDia, situacaoDaFonte } from '../../lib/preparo/pinoLigado'
import { contarSituacaoDosPinosLigados, type SituacaoDoPinoLigado } from '../../stores/colocacaoDoPreludio'
import { useAdventureStore } from '../../stores/adventureStore'
import { useMapStore } from '../../stores/mapStore'
import { usePreludio } from '../estado/preludio'

/**
 * O PINO LIGADO SEGUE O PRELÚDIO (P3 do estudo de 15/11), na janela do mapa:
 * cada vez que um verbete muda (a janela do Prelúdio gravou e avisou, ou a
 * tela do Prelúdio aqui dentro editou), o `description` de todo pino ligado a
 * ele — na cena aberta e nas cenas de fundo da memória — vira a cópia em dia,
 * já limpa. O próximo envio aos jogadores leva o texto novo, por todas as
 * portas que já leem o `description` (cartão, revelação, "Mostrar agora").
 *
 * A troca entra como mudança de fora (`applyPlayerChange`): não vira passo do
 * Ctrl+Z, e desfazer outra coisa não traz o texto velho de volta. O mapa fica
 * "não salvo": a cópia de reserva nova vai ao disco no próximo salvar.
 *
 * Para ler, abre o Prelúdio desta janela, só leitura (o mesmo que o Roteiro do
 * Livro faz). Baixa só quando o mapa tem pino ligado (`vigiaDosPinosLigados.ts`).
 */

let ligado = false

function aplicar(): void {
  const preludio = usePreludio.getState()
  if (preludio.carga.t === 'fechada') {
    void preludio.carregar()
    return
  }
  if (preludio.carga.t !== 'pronta') {
    contarSituacaoDosPinosLigados(false, new Map())
    return
  }
  const { verbetes } = preludio
  const mapa = useMapStore.getState()
  if (pinosEmDia(mapa.map, verbetes) !== mapa.map) mapa.applyPlayerChange((atual) => pinosEmDia(atual, verbetes))
  // A ficha do pino (pacote principal) lê daqui se a fonte segue, virou segredo ou sumiu.
  const porPino = new Map<string, SituacaoDoPinoLigado>()
  for (const pin of useMapStore.getState().map.pins) if (pin.fonte !== undefined) porPino.set(pin.id, situacaoDaFonte(pin.fonte, verbetes).t)
  contarSituacaoDosPinosLigados(true, porPino)
  const aventura = useAdventureStore.getState()
  for (const [sceneId, slot] of Object.entries(aventura.cache)) {
    if (sceneId === aventura.activeSceneId || slot.status !== 'ok') continue
    if (pinosEmDia(slot.map, verbetes) !== slot.map) aventura.applyPlayerChangeToBackgroundScene(sceneId, (atual) => pinosEmDia(atual, verbetes))
  }
}

let agendado = false
function agendar(): void {
  if (agendado) return
  agendado = true
  queueMicrotask(() => {
    agendado = false
    aplicar()
  })
}

/** Liga uma vez por janela e vale enquanto ela viver. */
export function ligarPinosLigados(): void {
  if (ligado) return
  ligado = true
  // Só o que pode mudar o texto ou trazer pino ligado novo: verbetes e carga do Prelúdio, pinos da cena aberta, cenas de fundo.
  usePreludio.subscribe((estado, antes) => {
    if (estado.verbetes !== antes.verbetes || estado.carga !== antes.carga) agendar()
  })
  useMapStore.subscribe((estado, antes) => {
    if (estado.map.pins !== antes.map.pins) agendar()
  })
  useAdventureStore.subscribe((estado, antes) => {
    if (estado.cache !== antes.cache) agendar()
  })
  agendar()
}
