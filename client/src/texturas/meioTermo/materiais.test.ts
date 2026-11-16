import { describe, expect, it } from 'vitest'
import type { TipoMobilia } from '../../lib/mobilia/tipos'
import { TIPOS_MOBILIA } from '../../lib/mobilia/tipos'
import { ehMaterial, LUGARES_DE_MATERIAL, MATERIAIS, materialMaisPerto, oklabDoHex, type LugarDeMaterial, type OpcaoDeMaterial } from './materiais'

/**
 * MATERIAIS no lugar da cor livre (`docs/design/objetos/README.md:44-58`).
 * O painel vai gravar o hex OFICIAL do material nos campos de cor que já
 * existem; o desenho pega o material mais perto em OKLab dentro da lista do
 * lugar. Assim o mapa antigo migra no desenho, sem regravar o arquivo.
 *
 * Os 3 exemplos do plano, escritos antes do código:
 *   #8b6b47 (madeira do barril)   -> carvalho
 *   #6d3337 (cobertor da cama)    -> lã vinho
 *   #000000 (qualquer lugar)      -> o material mais escuro daquele lugar
 */

function lugar(tipo: TipoMobilia, id: string): LugarDeMaterial {
  const achado = LUGARES_DE_MATERIAL[tipo].find((l) => l.id === id)
  if (achado === undefined) throw new Error(`lugar ${tipo}.${id} sumiu`)
  return achado
}

describe('materialMaisPerto (os 3 exemplos do plano)', () => {
  it('#8b6b47 vira carvalho na madeira do barril', () => {
    expect(materialMaisPerto('#8b6b47', lugar('barril', 'madeira'))).toBe('carvalho')
  })

  it('#6d3337 vira lã vinho no cobertor da cama', () => {
    expect(materialMaisPerto('#6d3337', lugar('catre', 'cobertor'))).toBe('vinho')
  })

  it('#000000 vira o mais escuro do lugar', () => {
    expect(materialMaisPerto('#000000', lugar('barril', 'madeira'))).toBe('nogueira')
    expect(materialMaisPerto('#000000', lugar('catre', 'cobertor'))).toBe('vinho')
    expect(materialMaisPerto('#000000', lugar('fogueira', 'pedras'))).toBe('ardosia')
    expect(materialMaisPerto('#000000', lugar('barril', 'aros'))).toBe('ferro')
    expect(materialMaisPerto('#000000', lugar('fogueira', 'lenha'))).toBe('lenhaCarvalho')
  })

  it('em todo lugar de todo móvel, o preto vira a opção de menor luz (L do OKLab) entre as que a cor livre alcança', () => {
    for (const tipo of TIPOS_MOBILIA) {
      for (const l of LUGARES_DE_MATERIAL[tipo]) {
        const reais = l.opcoesDaCorLivre.filter(ehMaterial)
        const maisEscuro = reais.reduce((a, b) => (oklabDoHex(MATERIAIS[b].hex)[0] < oklabDoHex(MATERIAIS[a].hex)[0] ? b : a))
        expect(materialMaisPerto('#000000', l), `${tipo}.${l.id}`).toBe(maisEscuro)
      }
    }
  })

  it('o hex oficial de cada material volta a ele mesmo em todo lugar que o oferece', () => {
    for (const tipo of TIPOS_MOBILIA) {
      for (const l of LUGARES_DE_MATERIAL[tipo]) {
        for (const id of l.opcoes.filter(ehMaterial)) expect(materialMaisPerto(MATERIAIS[id].hex, l), `${tipo}.${l.id}.${id}`).toBe(id)
      }
    }
  })

  it('maiúscula vale igual; cor ausente ou lixo vira o padrão do lugar', () => {
    expect(materialMaisPerto('#8B6B47', lugar('barril', 'madeira'))).toBe('carvalho')
    expect(materialMaisPerto(undefined, lugar('barril', 'madeira'))).toBe('carvalho')
    expect(materialMaisPerto('', lugar('caixa', 'madeira'))).toBe('pinho')
    expect(materialMaisPerto('#abc', lugar('tapete', 'tecido'))).toBe('azul')
    expect(materialMaisPerto('vermelho', lugar('cerca', 'ligacao'))).toBe('varas')
  })

  it('opção que usa a madeira do próprio móvel (mesma, varas) não entra na conta de cor', () => {
    // O assento ganhou os tecidos do estofado em 16/11/2026, mas a cor livre de antes fica na palha, nunca na madeira.
    expect(materialMaisPerto('#000000', lugar('cadeira', 'assento'))).toBe('palha')
    expect(materialMaisPerto('#8b6b47', lugar('cerca', 'ligacao'))).toBe('corda')
  })
})

/** A lista de cada lugar ANTES de 16/11/2026 (54bd8f54): sem o inox e o mármore; o assento da cadeira só com a palha. */
function opcoesDeAntes(tipo: TipoMobilia, l: LugarDeMaterial): readonly OpcaoDeMaterial[] {
  if (tipo === 'cadeira' && l.id === 'assento') return ['mesma', 'palha']
  return l.opcoes.filter((id) => id !== 'inox' && id !== 'marmore')
}

/** O material de `opcoes` mais perto da cor em OKLab, contado aqui à parte (sem `materialMaisPerto`); empate: o primeiro. */
function maisPertoEntre(cor: string, opcoes: readonly OpcaoDeMaterial[], padrao: OpcaoDeMaterial): OpcaoDeMaterial {
  const [L, a, b] = oklabDoHex(cor)
  let melhor = padrao
  let menor = Infinity
  for (const id of opcoes.filter(ehMaterial)) {
    const [Lm, am, bm] = oklabDoHex(MATERIAIS[id].hex)
    const distancia = (L - Lm) ** 2 + (a - am) ** 2 + (b - bm) ** 2
    if (distancia < menor) {
      menor = distancia
      melhor = id
    }
  }
  return melhor
}

describe('cor livre de mapa antigo não muda com as opções de 16/11/2026 (auditoria 16/11, defeito 2)', () => {
  it('os exemplos da auditoria ficam no material de antes', () => {
    expect(materialMaisPerto('#000000', lugar('cadeira', 'assento'))).toBe('palha')
    expect(materialMaisPerto('#ffffff', lugar('cadeira', 'assento'))).toBe('palha')
    expect(materialMaisPerto('#c0c0c0', lugar('armario', 'puxadores'))).toBe('latao')
    expect(materialMaisPerto('#e0e0e0', lugar('poco', 'pedras'))).toBe('arenito')
  })

  it('a cor IGUAL ao tom oficial da opção nova escolhe a opção nova (é o que o painel grava)', () => {
    expect(materialMaisPerto(MATERIAIS.inox.hex, lugar('armario', 'puxadores'))).toBe('inox')
    expect(materialMaisPerto(MATERIAIS.inox.hex.toUpperCase(), lugar('armario', 'puxadores'))).toBe('inox')
    expect(materialMaisPerto(MATERIAIS.marmore.hex, lugar('poco', 'pedras'))).toBe('marmore')
    expect(materialMaisPerto(MATERIAIS.vinho.hex, lugar('cadeira', 'assento'))).toBe('vinho')
    expect(materialMaisPerto(MATERIAIS.linho.hex, lugar('cadeira', 'assento'))).toBe('linho')
    // Um passo ao lado do tom oficial já é cor livre: volta ao material de antes.
    expect(materialMaisPerto('#9da2a6', lugar('armario', 'puxadores'))).toBe('latao')
  })

  it('varredura: nenhuma das 4.096 cores #rgb muda de material nos lugares que ganharam opção', () => {
    const canal = (n: number): string => (n * 17).toString(16).padStart(2, '0')
    const cores: string[] = []
    for (let r = 0; r < 16; r += 1) for (let g = 0; g < 16; g += 1) for (let b = 0; b < 16; b += 1) cores.push(`#${canal(r)}${canal(g)}${canal(b)}`)
    const varridos: string[] = []
    const mudaram: string[] = []
    for (const tipo of TIPOS_MOBILIA) {
      for (const l of LUGARES_DE_MATERIAL[tipo]) {
        const antes = opcoesDeAntes(tipo, l)
        if (antes.length === l.opcoes.length) continue
        varridos.push(`${tipo}.${l.id}`)
        for (const cor of cores) {
          const esperado = maisPertoEntre(cor, antes, l.padrao)
          const agora = materialMaisPerto(cor, l)
          if (agora !== esperado) mudaram.push(`${tipo}.${l.id} ${cor}: ${esperado} -> ${agora}`)
        }
      }
    }
    // A varredura passou pelos três tipos de lista que mudaram: o assento, os metais e as pedras.
    expect(varridos).toContain('cadeira.assento')
    expect(varridos).toContain('armario.puxadores')
    expect(varridos).toContain('poco.pedras')
    expect(mudaram.length, mudaram.slice(0, 10).join(' | ')).toBe(0)
  })
})

describe('tabela de materiais (objetos/README.md:44-58)', () => {
  it('os tons oficiais da linha 58', () => {
    const oficiais = Object.fromEntries(Object.values(MATERIAIS).map((m) => [m.id, m.hex]))
    expect(oficiais).toMatchObject({
      carvalho: '#8b6b47', nogueira: '#5f4532', pinho: '#a3875f', velha: '#7b776e', cerejeira: '#7c4b37',
      ferro: '#4c4e51', latao: '#9c8044', linho: '#c1b59c', vinho: '#6d3337', azul: '#41526a', musgo: '#5a6344', ocre: '#977842',
      granito: '#7e7b76', arenito: '#9a8669', ardosia: '#585d61',
    })
  })

  it('cada móvel com os lugares e o padrão (em negrito na tabela)', () => {
    const padroes = Object.fromEntries(TIPOS_MOBILIA.map((tipo) => [tipo, LUGARES_DE_MATERIAL[tipo].map((l) => `${l.id}:${l.padrao}`)]))
    expect(padroes).toEqual({
      barril: ['madeira:carvalho', 'aros:ferro'],
      caixa: ['madeira:pinho'],
      bau: ['madeira:nogueira', 'ferragens:latao'],
      catre: ['madeira:carvalho', 'cobertor:vinho', 'travesseiro:linho'],
      mesa: ['madeira:carvalho'],
      cadeira: ['madeira:carvalho', 'assento:palha'],
      cerca: ['madeira:carvalho', 'ligacao:varas'],
      armario: ['madeira:pinho', 'puxadores:ferro'],
      aparador: ['madeira:nogueira', 'puxadores:latao'],
      fogueira: ['pedras:granito', 'lenha:lenhaCarvalho'],
      tapete: ['tecido:azul'],
      // MT4: as peças novas do lote 1.
      mesaQuadrada: ['madeira:carvalho'],
      mesaRedonda: ['madeira:carvalho'],
      lapide: ['pedra:granito'],
      vaso: ['vaso:barro'],
      lampiao: ['metal:ferro'],
      quadroDeAvisos: ['madeira:nogueira'],
      poco: ['pedras:granito', 'madeira:carvalho'],
      barraca: ['toldo:vinho', 'madeira:pinho'],
      carroca: ['madeira:nogueira', 'aros:ferro'],
      // Lote 2 (MT5).
      sebe: ['folhas:buxo'],
      jardineira: ['madeira:nogueira'],
      arcoDoPortao: ['madeira:nogueira', 'placa:pinho'],
      placaDeSeta: ['madeira:pinho'],
      tapeteLongo: ['tecido:vinho'],
      // Objeto Fogo (27/10/2026): sem material, como a chama da fogueira (o chão queimado tem cor própria).
      fogo: [],
      // Muro de fogo (15/11/2026): sem material, como o Fogo.
      muroDeFogo: [],
      // Móveis de casa (28/10/2026).
      fogao: ['metal:ferro', 'puxadores:latao'],
      // A geladeira de inox (15/11/2026): sem escolha, o aço é fixo.
      geladeira: [],
      pia: ['pedra:granito', 'madeira:carvalho'],
      balcao: ['madeira:nogueira', 'barra:latao'],
      pratos: [],
      privada: ['madeira:nogueira', 'ferragens:latao'],
      sofa: ['tecido:vinho', 'madeira:nogueira'],
      poltrona: ['tecido:vinho', 'madeira:nogueira'],
      // Lareira e oficina (29/10/2026).
      lareira: ['pedra:arenito', 'madeira:nogueira'],
      fornalha: ['pedra:granito', 'madeira:carvalho'],
      bigorna: ['metal:ferro', 'madeira:carvalho'],
      balde: ['madeira:pinho', 'aros:ferro'],
      // Troncos e feno (29/10/2026).
      troncos: ['lenha:lenhaCarvalho'],
      feno: [],
      // O chafariz e os objetos de vento (02/11/2026).
      chafariz: ['pedra:arenito'],
      cataVento: ['madeira:velha'],
      moinho: ['pedra:arenito', 'madeira:nogueira'],
      cataVentoBrinquedo: [],
      // A ponte (03/11/2026).
      ponte: ['madeira:carvalho', 'pedra:granito'],
      // O cemitério (07/11/2026).
      cova: [],
      caixao: ['madeira:carvalho', 'ferragens:ferro'],
      caixaoAberto: ['madeira:carvalho'],
      // Destroços, sucata e o campinho (10/11/2026).
      destrocosDeMadeira: ['madeira:carvalho'],
      sucataChapas: [],
      sucataEngrenagens: [],
      sucataTambores: [],
      campinho: [],
      // Lote 1 dos 95 objetos novos (11/11/2026).
      bonecoDeTreino: ['madeira:carvalho'],
      pilar: ['pedra:granito'],
      altar: ['pedra:granito', 'pano:vinho'],
      estanteDeLivros: ['madeira:nogueira'],
      sacosDeGrao: [],
      bancoDePraca: ['madeira:carvalho', 'ferragens:ferro'],
      escombrosDePedra: ['pedra:granito'],
      canhao: ['metal:ferro', 'madeira:carvalho'],
      // Lote 2 dos 95 objetos novos (11/11/2026).
      guardaRoupa: ['madeira:cerejeira', 'puxadores:latao'],
      caldeirao: ['metal:ferro', 'pedras:granito'],
      fornoDePao: ['pedra:granito', 'madeira:pinho'],
      prateleiraDeDeposito: ['madeira:carvalho'],
      estatua: ['pedra:granito'],
      pedrasERochas: ['pedra:granito'],
      mausoleu: ['pedra:granito', 'porta:ferro'],
      alvoDeArcoEFlecha: ['madeira:carvalho'],
      // Lote 3 dos 95 objetos novos (11/11/2026).
      bancaDeFrutas: ['madeira:carvalho'],
      toldoListrado: ['toldo:vinho', 'madeira:pinho'],
      bancadaDeFerramentas: ['madeira:carvalho'],
      pedraDeAmolar: ['pedra:granito', 'madeira:carvalho'],
      suporteDeArmas: ['madeira:nogueira'],
      espantalho: ['madeira:nogueira'],
      cocho: ['lenha:lenhaCarvalho'],
      ossos: [],
      antenaParabolica: [],
      // Lote 4 dos 95 objetos novos (11/11/2026): a cama de casal com os três lugares da de solteiro.
      escrivaninha: ['madeira:cerejeira', 'puxadores:latao'],
      criadoMudo: ['madeira:nogueira', 'puxadores:latao'],
      camaDeCasal: ['madeira:nogueira', 'cobertor:azul', 'travesseiro:linho'],
      berco: ['madeira:carvalho', 'manta:azul'],
      banqueta: ['madeira:carvalho'],
      biombo: ['madeira:nogueira', 'pano:linho'],
      piano: ['madeira:nogueira', 'assento:vinho'],
      candelabroDeChao: ['metal:ferro'],
      // Lote 5 dos 95 objetos novos (11/11/2026): a tina com os lugares do barril e do balde.
      banheira: ['metais:latao', 'toalha:vinho'],
      tinaDeMadeira: ['madeira:carvalho', 'aros:ferro'],
      lavatorioComJarro: ['madeira:nogueira', 'toalha:azul'],
      prateleiraDePotes: ['madeira:nogueira'],
      mesaDeCorte: ['madeira:pinho'],
      ganchoComCarne: ['madeira:carvalho'],
      // Lote 6 dos 95 objetos novos (11/11/2026): os barris deitados e o tonel com os lugares do barril; as
      // ânforas sem lugar, como os sacos de grão.
      pilhaDeCaixas: ['madeira:pinho', 'lona:linho'],
      barrisDeitados: ['madeira:carvalho', 'aros:ferro'],
      tonelDeAdega: ['madeira:carvalho', 'aros:ferro'],
      anforasDeBarro: [],
      cestoDeVime: ['pano:linho'],
      cofre: ['metal:ferro', 'ferragens:latao'],
      // Lote 7 dos 95 objetos novos (11/11/2026): o toco com o lugar dos troncos e do cocho.
      varalDeRoupa: ['madeira:carvalho', 'pano:vinho'],
      horta: ['madeira:carvalho'],
      canteiroDeFlores: ['pedras:granito'],
      muroBaixoDePedra: ['pedra:granito'],
      tocoDeArvore: ['lenha:lenhaCarvalho'],
      carrinhoDeMao: ['madeira:carvalho'],
      placaDeLoja: ['madeira:carvalho'],
      // Lote 8 dos 95 objetos novos (11/11/2026): a cruz, a pá e a árvore seca na madeira velha.
      cruzDeMadeira: ['madeira:velha'],
      anjoDePedra: ['pedra:granito'],
      cercaDeFerro: ['grade:ferro', 'pedra:granito'],
      paCravada: ['madeira:velha', 'metal:ferro'],
      velasEOferendas: ['pano:vinho'],
      arvoreSeca: ['madeira:velha'],
      // Lote 9 dos 95 objetos novos (11/11/2026): o barril de peixe com os lugares do barril.
      balancaDeMercador: ['madeira:nogueira', 'pano:vinho'],
      tendaDeAdivinha: ['madeira:pinho'],
      gaiolaComAves: ['madeira:carvalho'],
      rolosDeTecido: ['madeira:nogueira', 'pano:azul'],
      palcoDeBardo: ['madeira:pinho', 'cortina:vinho'],
      barrilDePeixe: ['madeira:carvalho', 'aros:ferro'],
      // Lote 10 dos 95 objetos novos (11/11/2026): o toco com machado com o lugar dos troncos e do toco de árvore;
      // a plantação sem lugar.
      fole: ['madeira:carvalho'],
      manequimComArmadura: ['madeira:nogueira'],
      pilhaDeLingotes: ['metal:ferro', 'madeira:pinho'],
      serra: ['madeira:pinho', 'lenha:lenhaCarvalho'],
      galinheiro: ['madeira:pinho'],
      colmeia: ['madeira:carvalho'],
      arado: ['madeira:carvalho'],
      tocoComMachado: ['lenha:lenhaCarvalho'],
      plantacaoEmFileiras: [],
      // Lote 11 dos 95 objetos novos (11/11/2026): a carroça quebrada e o barril quebrado com os lugares dos pais;
      // o balanço com a lenha da fogueira nos troncos; a armadura enferrujada sem lugar.
      carrocaQuebrada: ['madeira:nogueira', 'aros:ferro'],
      barrilQuebrado: ['madeira:carvalho', 'aros:ferro'],
      caixaQuebrada: ['madeira:pinho'],
      vigaCaida: ['madeira:nogueira'],
      armaduraEnferrujada: [],
      mesaDeJogo: ['madeira:carvalho'],
      ringueDeLuta: ['madeira:carvalho', 'lona:linho'],
      balanco: ['madeira:carvalho', 'lenha:lenhaCarvalho'],
      mesaDeSinuca: ['madeira:nogueira'],
      // Lote 12 dos 95 objetos novos (11/11/2026): o timão com a madeira e as ferragens; as cordas enroladas sem
      // lugar. Lote 15: a armadura despedaçada sem lugar; a armadura de pé com a pedra do pedestal.
      ancora: ['madeira:carvalho'],
      cordasEnroladas: [],
      timao: ['madeira:cerejeira', 'ferragens:latao'],
      bote: ['madeira:carvalho'],
      redeDePesca: ['madeira:pinho'],
      pier: ['madeira:velha'],
      caixoteDePeixe: ['madeira:pinho'],
      armaduraDespedacada: [],
      armadura: ['pedra:granito'],
      // Lotes 13 e 16 dos 95 objetos novos (11/11/2026): a cela com a grade e o piso, a armadilha com a pedra e os
      // espinhos; o círculo mágico e os três blocos de inscrições sem lugar.
      braseiro: ['metal:ferro'],
      celaComGrade: ['grade:ferro', 'piso:granito'],
      corrente: ['metal:ferro'],
      armadilhaDeEspinhos: ['pedra:granito', 'metal:ferro'],
      circuloMagico: [],
      blocoDeInscricoesAzul: [],
      blocoDeInscricoesVermelho: [],
      blocoDeInscricoesDourado: [],
      // Lote 14 dos objetos novos (11/11/2026): o potro e o tronco com a madeira e as ferragens, a dama de ferro
      // com o ferro e a pedra do plinto; o sangue no chão sem lugar. Os três últimos do lote 13: a estante de
      // poções com a madeira, o pedestal com a pedra; a bola de cristal sem lugar.
      potroDeTortura: ['madeira:carvalho', 'ferragens:ferro'],
      damaDeFerro: ['metal:ferro', 'pedra:granito'],
      troncoDePrisioneiro: ['madeira:carvalho', 'ferragens:ferro'],
      gaiolaSuspensa: ['madeira:carvalho'],
      cadeiraDeInterrogatorio: ['madeira:carvalho'],
      mesaDeInstrumentos: ['madeira:nogueira'],
      sangueNoChao: [],
      estanteDePocoes: ['madeira:nogueira'],
      bolaDeCristal: [],
      pedestalComLivro: ['pedra:granito'],
      // Lote 17 dos objetos novos (12/11/2026): o tesouro, a teia e o crânio sem lugar; as tochas com o ferro (a de
      // parede também com o cabo); a tenda com a lona e os mastros; as torres com a pedra ou a madeira, e a de
      // vigia com o telhado de palha.
      barraDeOuro: [],
      monteDeOuro: [],
      moedaDeOuro: [],
      monteDeMoedasDeOuro: [],
      diamante: [],
      monteDeDiamantes: [],
      joia: [],
      monteDeJoias: [],
      teiaDeAranha: [],
      tochaDeParede: ['metal:ferro', 'madeira:carvalho'],
      tochaDePe: ['metal:ferro'],
      cranio: [],
      tenda: ['lona:linho', 'madeira:nogueira'],
      torreDePedra: ['pedra:granito', 'madeira:carvalho'],
      torreDeVigia: ['madeira:carvalho', 'telhado:palha'],
      tronoReal: ['madeira:nogueira', 'almofada:vinho', 'metal:latao'],
      camaDeDossel: ['madeira:nogueira', 'cortina:vinho', 'cobertor:ocre'],
      estandarteDePe: ['pano:azul', 'metal:latao', 'madeira:nogueira'],
      tapecariaDeParede: ['pano:vinho', 'metal:latao', 'madeira:nogueira'],
      lustreDeVelas: ['metal:ferro'],
      panoplia: ['escudo:azul', 'metal:latao'],
      mesaDeBanquete: ['madeira:carvalho', 'toalha:vinho'],
      bancosDeCapela: ['madeira:nogueira', 'estofado:vinho'],
      mesaDeGuerra: ['madeira:nogueira'],
      poleiroDeFalcao: ['madeira:carvalho'],
      aljavasEFlechas: [],
      catapulta: ['madeira:carvalho'],
      balista: ['madeira:carvalho'],
      arieteComTeto: ['madeira:carvalho'],
      escadaDeCerco: ['madeira:pinho'],
      cavaloDeFrisa: ['madeira:carvalho'],
      pilhaDeBalasDeCanhao: ['madeira:carvalho'],
      tachoDeOleoQuente: ['metal:ferro', 'madeira:carvalho'],
      sacosDeAreia: ['pano:ocre'],
      caixasDeMunicao: [],
      ouricoAntitanque: [],
      arameFarpado: [],
      barreiraDeConcreto: [],
      cancelaListrada: [],
      beliche: ['estrutura:ferro', 'cobertor:musgo', 'travesseiro:linho'],
      armarioDeFerro: [],
      radioDeCampanha: ['madeira:pinho'],
      holofote: [],
      redeDeCamuflagem: ['madeira:pinho'],
      metralhadoraNoTripe: [],
      paletesDeMadeira: ['madeira:pinho'],
      gerador: [],
      mastroComBandeira: ['bandeira:vinho', 'mastro:carvalho', 'pedra:granito'],
      caracolTelefone: [],
      caracolTelefoneCamera: [],
      caracolTelefoneDourado: [],
      cartazDeProcurado: ['madeira:carvalho'],
      frutaDeEspirais: ['fruta:vinho'],
      bandeiraPirata: ['madeira:carvalho'],
      mesaDeNavegacao: ['madeira:nogueira'],
      laranjeiraEmCanteiro: ['madeira:pinho'],
      pratoDeCarne: [],
      pranchaDoNavio: ['madeira:carvalho'],
      esqueletoDePeixe: [],
      navioNaGarrafa: ['madeira:nogueira'],
      conchaMagica: [],
      lanternaDePedra: ['pedra:granito'],
      balcaoDeTaverna: ['madeira:nogueira', 'barra:latao'],
      alvoDeDardos: ['madeira:nogueira'],
      mesaDeQuedaDeBraco: ['madeira:carvalho'],
      varalDeBandeirinhas: ['madeira:pinho'],
      varalDeLanternas: ['madeira:nogueira'],
      mastroDeFitas: ['madeira:pinho'],
      caixaDeFogosDeArtificio: ['madeira:pinho'],
      barracaDeJogosDaFeira: ['toldo:vinho', 'madeira:pinho'],
      barracaDeEspetinho: ['toldo:ocre', 'madeira:carvalho'],
      churrasqueira: [],
      harpa: ['madeira:cerejeira'],
      tambores: ['madeira:nogueira'],
      redeDeDormir: ['pano:azul', 'lenha:lenhaCarvalho'],
      guardaSolComEspreguicadeira: ['pano:azul', 'madeira:pinho'],
      toalhaDePiquenique: ['pano:vinho'],
      xadrezDeJardim: ['pedra:ardosia', 'madeira:nogueira'],
      bolicheDeGrama: ['madeira:pinho', 'bola:nogueira'],
      gangorra: ['madeira:pinho', 'metal:ferro'],
      escorregador: ['madeira:pinho', 'calha:ferro'],
      aquario: ['madeira:nogueira', 'moldura:latao'],
      ofuro: ['madeira:pinho'],
      telescopio: ['madeira:nogueira', 'tubo:latao'],
      globoTerrestre: ['madeira:nogueira', 'meridiano:latao'],
      pebolim: ['madeira:carvalho'],
      arquibancadaDeTorneio: ['madeira:pinho', 'pano:vinho'],
      licaDeJusta: ['madeira:carvalho', 'pano:azul'],
      posteDeAmarrarCavalos: ['madeira:carvalho'],
      bueiro: ['pedra:granito', 'grade:ferro'],
      relogioDeSol: ['pedra:granito', 'metal:latao'],
      sinoNoSuporte: ['madeira:carvalho', 'sino:latao'],
      tearDePedal: ['madeira:carvalho', 'fio:linho', 'pano:vinho'],
      rocaDeFiar: ['madeira:carvalho', 'fio:linho'],
      lagarDeUva: ['madeira:carvalho', 'metal:ferro'],
      moDePedra: ['pedra:granito', 'madeira:pinho', 'saco:linho'],
      liteira: ['madeira:nogueira', 'pano:vinho', 'metal:latao'],
      ponteLevadica: ['madeira:carvalho', 'ferragens:ferro'],
      portaoComGradeLevadica: ['pedra:granito'],
      torreDeCerco: ['madeira:carvalho'],
      estatuaEquestre: ['pedra:granito'],
      obelisco: ['pedra:granito'],
      forcaComCadafalso: ['madeira:carvalho'],
      torreDoSino: ['pedra:granito', 'madeira:carvalho'],
      guarita: [],
      bunkerDeConcreto: [],
      conteiner: ['pintura:vinho'],
      tendaMilitar: ['lona:musgo'],
      caixaDAguaElevada: ['madeira:carvalho'],
      torreDeRadio: [],
      tanqueDeCombustivel: [],
      farol: ['pedra:granito', 'faixa:vinho', 'metal:ferro'],
      coreto: ['pedra:granito', 'madeira:pinho', 'telhado:vinho'],
      guindasteDePorto: ['madeira:carvalho', 'pedra:granito'],
      posteComRelogio: ['metal:ferro', 'pedra:granito'],
      quiosque: ['pintura:musgo', 'toldo:vinho', 'pedra:granito'],
      rodaDagua: ['madeira:carvalho', 'pedra:granito'],
      pombal: ['pedra:granito', 'telhado:barro'],
      baiaDeCavalo: ['madeira:pinho', 'telhado:nogueira'],
      siloDeGraos: ['pedra:barro', 'telhado:ferro'],
      chiqueiroCercado: ['madeira:velha'],
      carrossel: ['madeira:carvalho', 'pano:azul'],
      tendaDeCirco: ['pano:vinho', 'madeira:pinho'],
      rodaGigante: ['madeira:carvalho', 'pano:vinho'],
      casaNaArvore: ['madeira:pinho'],
      pergolaComTrepadeira: ['madeira:carvalho', 'pedra:arenito'],
      portalTorii: [],
      // O banheiro moderno (15/11/2026): a louça, o cromo, o vidro e o inox são fixos.
      vasoSanitarioModerno: [],
      bide: [],
      boxDeChuveiro: [],
      banheiraModerna: ['toalha:azul'],
      gabineteDeBanheiro: ['madeira:carvalho'],
      armarioDeBanheiro: ['madeira:carvalho', 'toalha:linho'],
      toalheiro: ['toalha:azul'],
      cestoDeRoupa: ['trama:linho', 'roupa:azul'],
      prateleiraDeFrascos: [],
      lixeiraDePedal: [],
      tapeteDeBanheiro: ['tecido:azul'],
      portaPapel: [],
      // As referências (16/11/2026): o lote L1 não troca nada; o lote L2 troca a madeira, o metal, a pedra, a pintura do
      // carro, as toalhas e o estofado.
      mesaDeAutopsia: [],
      macaComLencol: [],
      camaraFrigorifica: [],
      esterilizador: [],
      luminariaArticulada: [],
      bandejaDeInstrumentos: [],
      mesaDeLaboratorio: [],
      panelasEBacias: [],
      cadeiraGiratoria: [],
      maquinaDeEscrever: [],
      elevadorAntigo: ['madeira:nogueira', 'grade:ferro'],
      alcapao: ['madeira:velha', 'ferragens:ferro'],
      deckDeMadeira: ['madeira:pinho'],
      colunaQuebrada: ['pedra:granito'],
      altarRedondo: ['pedra:granito'],
      lajeDeSacrificio: ['pedra:granito'],
      tumuloDePedra: ['pedra:granito'],
      carroAntigo: ['pintura:vinho'],
      prateleiraDeToalhas: ['madeira:pinho', 'toalha:azul'],
      cadeiraDeEspaldarAlto: ['madeira:nogueira', 'estofado:vinho'],
      centroDeMesa: ['metal:latao'],
      lapideTorta: ['pedra:granito'],
      torreDoDragao: ['pedra:granito', 'madeira:carvalho', 'dragao:latao'],
      montanhaPequena: ['pedra:granito'],
      montanhaMedia: ['pedra:granito'],
      montanhaGrande: ['pedra:granito'],
    })
  })

  it('o inox, o mármore e o estofado (16/11/2026) entram no FIM das listas e o mapa de antes abre igual', () => {
    // Os metais, as pedras e o assento da cadeira ganham a opção nova depois das que já existiam.
    expect(lugar('barril', 'aros').opcoes).toEqual(['ferro', 'latao', 'inox'])
    expect(lugar('lapide', 'pedra').opcoes).toEqual(['granito', 'arenito', 'ardosia', 'marmore'])
    expect(lugar('cadeira', 'assento').opcoes).toEqual(['mesma', 'palha', 'linho', 'vinho', 'azul', 'musgo', 'ocre'])
    // O padrão não muda: o mapa sem cor gravada abre como antes.
    expect(materialMaisPerto(undefined, lugar('barril', 'aros'))).toBe('ferro')
    expect(materialMaisPerto(undefined, lugar('lapide', 'pedra'))).toBe('granito')
    expect(materialMaisPerto(undefined, lugar('cadeira', 'assento'))).toBe('palha')
    // A escolha gravada de antes (o tom oficial de cada material) continua voltando a ela, em todo lugar que mudou.
    for (const tipo of TIPOS_MOBILIA) {
      for (const l of LUGARES_DE_MATERIAL[tipo]) {
        const antigas = l.opcoes.filter(ehMaterial).filter((id) => id !== 'inox' && id !== 'marmore')
        for (const id of antigas) expect(materialMaisPerto(MATERIAIS[id].hex, l), `${tipo}.${l.id}.${id}`).toBe(id)
      }
    }
    expect(materialMaisPerto(MATERIAIS.palha.hex, lugar('cadeira', 'assento'))).toBe('palha')
    // O inox é o aço claro da geladeira, o mármore o branco quebrado: os dois são os mais claros da lista deles.
    expect(MATERIAIS.inox.classe).toBe('metal')
    expect(MATERIAIS.marmore.classe).toBe('pedra')
    expect(oklabDoHex(MATERIAIS.inox.hex)[0]).toBeGreaterThan(oklabDoHex(MATERIAIS.latao.hex)[0])
    expect(oklabDoHex(MATERIAIS.marmore.hex)[0]).toBeGreaterThan(oklabDoHex(MATERIAIS.arenito.hex)[0])
  })

  it('o padrão de cada lugar está entre as opções dele', () => {
    for (const tipo of TIPOS_MOBILIA) for (const l of LUGARES_DE_MATERIAL[tipo]) expect(l.opcoes, `${tipo}.${l.id}`).toContain(l.padrao)
  })

  it('os tons do Meio-Termo (meio.js, tabela TROCA): mais claros e quentes, com os acertos da revisão de design da MT2', () => {
    // carvalho x 0,91 e velha (granito) x 0,78 no móvel: com o tom do token sumiam no chão do app
    expect(MATERIAIS.carvalho.tom).toBe('#92704a')
    expect(MATERIAIS.velha.tom).toBe('#78756c')
    // tons próprios: a cerejeira deixa de ser "nogueira x 1,12" e a lã azul de ser a telha azul
    expect(MATERIAIS.cerejeira.tom).toBe('#926149')
    expect(MATERIAIS.azul.tom).toBe('#4b648e')
    expect(MATERIAIS.nogueira.tom).toBe('#775739')
    for (const m of Object.values(MATERIAIS)) expect(m.tom, m.id).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('a lã azul fica com croma 0,075 (a telha azul tinha 0,096) e a mesma luz', () => {
    const [L, a, b] = oklabDoHex(MATERIAIS.azul.tom)
    const [Lt] = oklabDoHex('#43639a')
    expect(Math.hypot(a, b)).toBeCloseTo(0.075, 2)
    expect(Math.abs(L - Lt)).toBeLessThan(0.005)
  })
})

describe('materialMaisPerto: a conta é em OKLab, não em RGB', () => {
  it('cor livre em que o mais perto em OKLab e o mais perto em RGB são madeiras DIFERENTES: vale o OKLab', () => {
    const madeiras = lugar('barril', 'madeira')
    const cor = '#2828a3'
    const reais = madeiras.opcoes.filter(ehMaterial)
    const canais = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    const emRgb = (hex: string): number => Math.hypot(...canais(hex).map((c, i) => c - canais(cor)[i]))
    const maisPertoEmRgb = reais.reduce((x, y) => (emRgb(MATERIAIS[y].hex) < emRgb(MATERIAIS[x].hex) ? y : x))
    expect(maisPertoEmRgb).toBe('velha')
    expect(materialMaisPerto(cor, madeiras)).toBe('nogueira')
  })
})

describe('oklabDoHex', () => {
  it('branco tem L 1 e o preto L 0, ambos sem cor', () => {
    const [Lb, ab, bb] = oklabDoHex('#ffffff')
    expect(Lb).toBeCloseTo(1, 3)
    expect(ab).toBeCloseTo(0, 3)
    expect(bb).toBeCloseTo(0, 3)
    expect(oklabDoHex('#000000')).toEqual([0, 0, 0])
  })
})
