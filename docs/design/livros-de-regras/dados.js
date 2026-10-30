/* =========================================================================
 * Mundo do livro de regras: DADOS DE EXEMPLO e REGRAS DE LEITURA.
 *
 * Personagens FICTÍCIOS (o repositório é público): nenhuma ficha real da
 * mesa entra aqui. Os FORMATOS dos campos são os reais das fichas One Piece
 * ("-35 de SP", "Força + 45 de dano", "(Força + 20) + Dano da Arma", "3",
 * "2 Vezes por Combate", "OVERLOAD"), e os textos que o app não lê imitam os
 * casos reais ("Seguir todas as condições", "10% de Vida Atual do Alvo",
 * "ção Completa").
 *
 * Regras copiadas do app:
 *  - atributos, ranks, HP/SP: client/src/lib/sistemaOnePiece.ts:48-69 e
 *    livroOnePiece.ts (Status);
 *  - leitura de custo, ação e tempo: client/src/lib/batalha/leituraDaFicha.ts;
 *  - leitura do dano (gramática sem eval): client/src/lib/batalha/formula.ts.
 * ========================================================================= */
'use strict'

window.Livro = (function () {
  const ATRIBUTOS = [
    { id: 'forca', abrev: 'FOR', nome: 'Força', inicial: 1, limiares: [40, 90, 150, 320, 510, 765, 1725, 2200, 2700] },
    { id: 'agilidade', abrev: 'AGI', nome: 'Agilidade', inicial: 1, limiares: [33, 60, 90, 140, 210, 315, 400, 600, 950] },
    { id: 'percepcao', abrev: 'PER', nome: 'Percepção', inicial: 1, limiares: [30, 80, 130, 220, 330, 500, 750, 1125, 1500] },
    { id: 'resistencia', abrev: 'RES', nome: 'Resistência', inicial: 0, limiares: [1, 40, 140, 240, 480, 720, 1620, 2430, 5500, 8250] },
    { id: 'intuicao', abrev: 'INT', nome: 'Intuição', inicial: 1, limiares: [30, 80, 150, 240, 275, 360, 540, 810, 1215] },
    { id: 'espirito', abrev: 'ESP', nome: 'Espírito', inicial: 0, limiares: [1, 35, 75, 115, 140, 210, 315, 472, 700, 1060, 1590, 2385, 2500] },
    { id: 'carisma', abrev: 'CAR', nome: 'Carisma', inicial: 1, limiares: [20, 55, 100, 150, 200, 240, 315, 472, 700] },
    { id: 'determinacao', abrev: 'DET', nome: 'Determinação', inicial: 1, limiares: [16, 40, 80, 130, 175, 195, 295, 440, 660, 1590, 2385, 2500] },
  ]
  const ATR = Object.fromEntries(ATRIBUTOS.map((a) => [a.id, a]))
  // livroOnePiece.ts (Status): Resistência dá HP, Espírito dá SP; cada rank soma ao anterior.
  const HP_DO_RANK = [300, 300, 300, 300, 600, 895, 1495, 4480, 7465, 11940, 22375]
  const SP_DO_RANK = [20, 40, 60, 80, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190]
  /** Fator médio da reação de quem apanha (d20): 1 = ×1,5; 2-9 = ×1; 10-14 = metade; 15-20 = nada. */
  const FATOR_DA_REACAO = 0.05 * 1.5 + 0.4 * 1 + 0.25 * 0.5

  function rankDoValor(atributo, valor) {
    let rank = atributo.inicial
    for (const limiar of atributo.limiares) {
      if (valor < limiar) break
      rank += 1
    }
    return rank
  }
  const acumulado = (tabela, rank) => tabela.slice(0, Math.max(0, Math.min(rank, tabela.length - 1)) + 1).reduce((a, b) => a + b, 0)

  /* ---------------------------------------------------------------------
   * Fichas de exemplo. `cor` é o nome de um token --lb-color-*.
   * Variação de NPC só guarda o que muda (nome, força, nota): o resto herda
   * do modelo, então corrigir o modelo corrige todas as variações.
   * --------------------------------------------------------------------- */
  let seq = 0
  const tec = (nome, descricao, acao, custo, dano, tempo, extra = {}) => ({ id: 't' + ++seq, nome, descricao, acao, custo, dano, tempo, efeito: '', ...extra })
  const arma = (nome, dano, acao = 'Ação Simples', efeito = '') => ({ id: 'a' + ++seq, nome, dano, acao, efeito })

  const FICHAS = [
    {
      id: 'lia', nome: 'Lia Maré', tipo: 'jogador', jogador: 'marina', raca: 'Skypean', oficio: 'Navegador', cor: 'brass-bright', retrato: true,
      atributos: { forca: 45, agilidade: 95, percepcao: 90, resistencia: 45, intuicao: 35, espirito: 80, carisma: 30, determinacao: 20 }, escudo: 0,
      armasPorBatalha: 1, armas: [arma('Bastão de bordo', '30')], itens: [],
      pericias: ['Navegação', 'Acrobacia'], vantagens: ['Olhos de Águia'], desvantagens: ['Curioso'],
      formas: [{ nome: 'Plumagem de Tempestade', mods: { agilidade: 50, forca: 50 } }],
      tecnicas: [
        tec('Bastão de Bordo', 'Golpe seco com o bastão de navegação.', 'Ação Simples', '', 'Força + Dano da Arma', ''),
        tec('Rajada de Penas', 'Abre os braços e dispara um leque de penas duras como lâmina.', 'Ação Simples', '-45 de SP', 'Agilidade + 120 de dano', '1'),
        tec('Corrente Ascendente', 'Uma lufada joga a Lia para o alto.', 'Ação Bônus', '-20 de SP', '-', '', { efeito: '+2 blocos de deslocamento neste turno' }),
        tec('Tempestade de Plumas', 'Um ciclone de penas corta todos em volta.', 'Ação Completa | OVERLOAD', '-120 de SP', '(Agilidade + 60) x 2', 'OVERLOAD'),
        tec('Mergulho da Garça', 'Mergulha do alto com as asas fechadas.', 'Ação Simples', '-60 de SP', 'Força + Agi + 40', '2', { forma: 'Plumagem de Tempestade' }),
      ],
      nota: 'Quer descobrir quem afundou o barco do pai. Gancho para a Ilha da Névoa.',
    },
    {
      id: 'bruno', nome: 'Bruno Ferrolho', tipo: 'jogador', jogador: 'beto', raca: 'Ogro', oficio: 'Ferreiro', cor: 'ember', retrato: false,
      atributos: { forca: 160, agilidade: 60, percepcao: 35, resistencia: 150, intuicao: 20, espirito: 40, carisma: 25, determinacao: 90 }, escudo: 100,
      armasPorBatalha: 2, armas: [arma('Martelo de forja', '40'), arma('Corrente de âncora', '25')], itens: [],
      pericias: ['Forja', 'Atletismo'], vantagens: ['Corpo Vigoroso'], desvantagens: ['Coração Mole'],
      formas: [{ nome: 'Haki do Armamento: Punho Negro', mods: { forca: 60, resistencia: 100 } }],
      tecnicas: [
        tec('Martelo de Bigorna', 'Desce o martelo de forja com as duas mãos.', 'Ação Simples', '', '(Força + 20) + Dano da Arma', ''),
        tec('Golpe Rebite', 'Três marteladas no mesmo ponto.', 'Ação Simples', '-30 de SP', 'Força + 80 de dano', '2'),
        tec('Postura de Muralha', 'Finca os pés e cruza os braços.', 'Ação Bônus', '-20 de SP', '-', '', { efeito: '+150 de Escudo' }),
        tec('Grito de Forja', 'Um urro que racha a guarda do alvo.', 'Ação Bônus', '-25 de SP', 'FOR + 50 (ignora escudo)', '3', {
          sugere: { dano: ['FOR + 50', 'O “ignora escudo” vai para o Efeito, como Perfurante.', 'Perfurante: ignora o Escudo'] },
        }),
        tec('Bigorna Cadente', 'Salta e cai com o martelo inteiro.', 'Ação Completa', '-80 de SP', 'O dobro do Golpe Rebite', 'OVERLOAD', {
          sugere: { dano: ['(Força + 80) x 2', 'O dobro do Golpe Rebite, escrito como conta.'] },
        }),
        tec('Punho de Ferro Negro', 'Um soco com o braço endurecido.', 'Ação Simples', '-50 de SP', 'Força + 120 de dano', '1', { forma: 'Haki do Armamento: Punho Negro' }),
      ],
      nota: '',
    },
    {
      id: 'duda', nome: 'Duda Sal', tipo: 'jogador', jogador: 'duda.s', raca: 'Tritão', oficio: 'Médico', cor: 'online', retrato: false,
      atributos: { forca: 40, agilidade: 50, percepcao: 80, resistencia: 60, intuicao: 160, espirito: 120, carisma: 60, determinacao: 45 }, escudo: 0,
      armasPorBatalha: 1, armas: [arma('Bisturi de coral', '15')], itens: [],
      pericias: ['Medicina', 'Anatomia', 'Natação'], vantagens: ['Recuperação Espantosa'], desvantagens: [],
      formas: [],
      tecnicas: [
        tec('Palma da Maré', 'Empurra o ar como uma onda curta.', 'Ação Simples', '', 'Intuição + 10', ''),
        tec('Sutura Rápida', 'Fecha um corte no meio da luta.', 'Ação Simples', 'Seguir todas as condições', '-', '', {
          efeito: 'Cura 250 HP de um aliado',
          sugere: { custo: ['-40 de SP', 'As condições (alvo parado, ninguém em volta) vão para a Descrição.'] },
        }),
        tec('Bolha Pesada', 'Uma bolha de água do mar que bate como pedra.', 'ção Bônus', '-25 de SP', 'Espírito + 40 de dano', '2', {
          sugere: { acao: ['Ação Bônus', 'Faltava o “A” do começo.'] },
        }),
        tec('Maré Vermelha', 'Devolve a força do último golpe que levou.', 'Ação Completa', '-60 de SP', 'Espírito + 30% do dano anterior', 'OVERLOAD', {
          sugere: { dano: ['Espírito + 60', 'Um número fixo perto da média. Prefere o “dano anterior”? Deixe à mão.'] },
        }),
        tec('Água Viva', 'Água que cura um aliado ou queima um inimigo.', 'Ação Bônus', '', 'Cura ou dano, à escolha', '', {
          sugere: { dano: ['', 'Dois usos numa técnica só: deixe à mão, ou separe em duas técnicas.'] },
        }),
      ],
      nota: 'Jogadora nova. Explicar a reação de novo no começo da batalha.',
    },
    {
      id: 'rafa', nome: 'Rafa Quilha', tipo: 'jogador', jogador: 'rafa', raca: 'Mink', oficio: 'Carpinteiro', cor: 'arcane', retrato: false,
      atributos: { forca: 110, agilidade: 70, percepcao: 40, resistencia: 90, intuicao: 30, espirito: 50, carisma: 20, determinacao: 60 }, escudo: 0,
      armasPorBatalha: 1, armas: [arma('Serrote', '35')], itens: [],
      pericias: ['Carpintaria', 'Marcenaria'], vantagens: ['Atleta'], desvantagens: [],
      formas: [],
      tecnicas: [
        tec('Garra de Serrote', 'Arranha com a serra e com as unhas ao mesmo tempo.', 'Ação Simples', '-15 de SP', '2d6 + Força', '', {
          sugere: { dano: ['Força + 7 de dano', 'Média de 2d6 = 7. Prefere rolar o dado? Deixe à mão.'] },
        }),
        tec('Estaca Viva', 'Crava uma estaca de madeira molhada.', 'Ação Simples', 'Metade do SP atual', 'Força x2 se o alvo estiver molhado', 'Uma vez por dia', {
          sugere: {
            custo: ['50% do SP', 'Assim o app sugere a metade na hora e você só confirma.'],
            dano: ['Força x 2', 'A condição “se o alvo estiver molhado” vai para o Efeito.', 'Dobro só se o alvo estiver molhado'],
            tempo: ['OVERLOAD', 'OVERLOAD é o “uma vez por dia” do livro.'],
          },
        }),
        tec('Serra Circular', 'Gira a serra presa no braço.', 'Ação Completa', '-40 de SP', 'Metade da Força + Determinação', '3', {
          sugere: { dano: ['Força / 2 + Determinação', 'A mesma conta, com “/ 2” no lugar de “metade”.'] },
        }),
        tec('Pulo de Tábua', 'Usa uma tábua solta como trampolim.', 'Bonus Action', '-10 de SP', '-', '', {
          efeito: '+3 blocos de deslocamento',
          sugere: { acao: ['Ação Bônus', 'O app lê o tipo de ação em português.'] },
        }),
      ],
      nota: '',
    },
    {
      id: 'nina', nome: 'Nina Farol', tipo: 'jogador', jogador: null, raca: 'Lunariano', oficio: 'Cozinheiro', cor: 'tide', retrato: true,
      atributos: { forca: 35, agilidade: 65, percepcao: 55, resistencia: 50, intuicao: 60, espirito: 140, carisma: 70, determinacao: 40 }, escudo: 0,
      armasPorBatalha: 1, armas: [arma('Frigideira', '20')], itens: [],
      pericias: ['Culinária', 'Nutrição'], vantagens: ['Lábia'], desvantagens: [],
      formas: [],
      tecnicas: [
        tec('Chama do Farol', 'As asas acendem e queimam o alvo.', 'Ação Simples', '-35 de SP por rodada', 'Espírito + 45 de dano', '', {
          sugere: { custo: ['-35 de SP por turno', 'O app conta “por turno”; aqui rodada e turno valem o mesmo.'] },
        }),
        tec('Prato Quente', 'Uma refeição de campanha no meio da luta.', 'Ação Bônus', '-20 de SP', '-', '2 Vezes por Combate', { efeito: 'Cura 120 HP de um aliado' }),
        tec('Panela de Pressão', 'Explode a panela com o que tiver dentro.', 'Ação Simples', '-30 de SP', 'Depende do ingrediente', 'A cada 2 turnos', {
          sugere: {
            dano: ['', 'O dano muda a cada uso: deixe à mão e escreva os ingredientes no Efeito.'],
            tempo: ['2 turnos', 'A recarga escrita só com o número de turnos.'],
          },
        }),
        tec('Fogo de Asa', 'Queima todo o fôlego numa labareda.', 'Ação Completa', 'Todo o SP restante', 'Espírito x 3', 'OVERLOAD', {
          sugere: { custo: ['100% do SP', 'O app sugere todo o SP na hora e você confirma.'] },
        }),
      ],
      nota: '',
    },

    /* ---- NPCs de combate (bestiário) ---- */
    {
      id: 'recruta', nome: 'Recruta da Marinha', tipo: 'npc', modelo: true, raca: 'Humano', oficio: 'Recruta', cor: 'parchment-faint', forca: 1,
      atributos: { forca: 40, agilidade: 30, percepcao: 20, resistencia: 0, intuicao: 10, espirito: 0, carisma: 5, determinacao: 10 }, escudo: 0,
      armasPorBatalha: 1, armas: [arma('Mosquete curto', '20')], itens: [], pericias: [], vantagens: [], desvantagens: [], formas: [],
      tecnicas: [
        tec('Estocada', 'Uma estocada de manual.', 'Ação Simples', '', 'Força + 40 de dano', ''),
        tec('Investida', 'Corre de baioneta calada.', 'Ação Simples', '-10 de SP', 'Força + 60', '2'),
        tec('Grito de Alerta', 'Chama os outros recrutas.', 'Ação Bônus', '-5 de SP', '-', '', { efeito: 'Aliados ganham +1 bloco de deslocamento' }),
      ],
      nota: 'Base para qualquer soldado raso. Em grupo de 3 ou mais, vale a pena.',
    },
    { id: 'ilo', nome: 'Recruta Ilo', tipo: 'npc', modeloId: 'recruta', forca: 1, nota: '' },
    { id: 'teo', nome: 'Recruta Teo', tipo: 'npc', modeloId: 'recruta', forca: 0.75, nota: 'Mais novo. Foge se o sargento cair.' },
    {
      id: 'sargento', nome: 'Sargento da Marinha', tipo: 'npc', modelo: true, raca: 'Humano', oficio: 'Sargento', cor: 'parchment-dim', forca: 1,
      atributos: { forca: 95, agilidade: 55, percepcao: 60, resistencia: 45, intuicao: 30, espirito: 36, carisma: 20, determinacao: 40 }, escudo: 0,
      armasPorBatalha: 1, armas: [arma('Mosquete', '25')], itens: [], pericias: [], vantagens: [], desvantagens: [], formas: [],
      tecnicas: [
        tec('Rajada de Mosquete', 'Um tiro de joelho.', 'Ação Simples', '', 'Percepção + 60', ''),
        tec('Baioneta Firme', 'Avança com a baioneta calada.', 'Ação Simples', '-20 de SP', 'Força + 75 de dano', '1'),
        tec('Revide do Sargento', 'Devolve o golpe que acabou de levar.', 'Reação', '-15 de SP', 'Igual ao dano recebido no último turno', '', {
          sugere: { dano: ['', 'Depende do que aconteceu: deixe à mão e descreva no Efeito.'] },
        }),
        tec('Tiro de Cobertura', 'Atira para segurar o avanço do grupo.', 'Ação Completa', '-30 de SP', 'Força + Percepção + 1d20', '3', {
          sugere: { dano: ['Força + Percepção + 10', 'Média do d20, arredondada para 10.'] },
        }),
        tec('Coronhada', 'Bate com a coronha do mosquete.', 'Ação Simples', '', 'Força + Dano do Mosquete', '', {
          sugere: { dano: ['Força + Dano da Arma', 'O mosquete já está na aba Armas: “Dano da Arma” lê o dano dele.'] },
        }),
      ],
      nota: '',
    },
    { id: 'otavio', nome: 'Sargento Otávio Prumo', tipo: 'npc', modeloId: 'sargento', forca: 1.25, nota: 'Chefe do posto. Se cair, os recrutas recuam.' },
    {
      id: 'vera', nome: 'Capitã Vera Doca', tipo: 'npc', modelo: true, unico: true, raca: 'Humano', oficio: 'Capitã', cor: 'tide', forca: 1, retrato: true,
      atributos: { forca: 100, agilidade: 88, percepcao: 90, resistencia: 150, intuicao: 80, espirito: 80, carisma: 60, determinacao: 80 }, escudo: 150,
      armasPorBatalha: 1, armas: [arma('Sabre de serviço', '35')], itens: [], pericias: ['Navegação'], vantagens: ['Comandante Inato'], desvantagens: [], formas: [],
      tecnicas: [
        tec('Sabre de Serviço', 'Corte reto com o sabre da Marinha.', 'Ação Simples', '', '(Força + 20) + Dano da Arma', ''),
        tec('Lâmina de Névoa', 'Vira névoa e corta de dentro dela.', 'Ação Simples', '-35 de SP', 'Força + 45 de dano', '3'),
        tec('Prisão Úmida', 'Fecha a névoa em volta do alvo até ele afogar no seco.', 'Ação Completa', '-50 de SP', '10% de Vida Atual do Alvo', '2 Vezes por Combate'),
        tec('Corpo de Névoa', 'O golpe atravessa a névoa.', 'Reação', '-40 de SP', '-', 'OVERLOAD', { efeito: 'Ignora um golpe' }),
        tec('Chuva Fria', 'Uma garoa que corta.', 'Ação Completa', '-70 de SP', 'Dano em área: Espírito + 100', '2', {
          sugere: { dano: ['Espírito + 100', '“Em área” vira um Extra chamado Área; o Dano fica só com a conta.'] },
        }),
        tec('Neblina Cortante', 'Corta de longe, por dentro da névoa.', 'Ação Simples', '', 'Força + metade da Agilidade', '', {
          sugere: { dano: ['Força + Agilidade / 2', '“metade da” vira “/ 2”.'] },
        }),
      ],
      nota: 'Não morre na Ilha da Névoa: foge pela névoa quando passar de 50% do HP perdido.',
    },
    {
      id: 'bandido', nome: 'Bandido do Porto', tipo: 'npc', modelo: true, raca: 'Humano', oficio: 'Gatuno', cor: 'brass', forca: 1,
      atributos: { forca: 60, agilidade: 45, percepcao: 30, resistencia: 40, intuicao: 20, espirito: 10, carisma: 10, determinacao: 20 }, escudo: 0,
      armasPorBatalha: 1, armas: [arma('Faca', '15')], itens: [], pericias: ['Furtividade'], vantagens: [], desvantagens: [], formas: [],
      tecnicas: [
        tec('Facada Suja', 'Uma facada pelas costas.', 'Ação Simples', '', 'Força + Dano da Arma', ''),
        tec('Areia nos Olhos', 'Joga um punhado de areia.', 'Ação Bônus', '-10 de SP', '-', '', { efeito: 'O alvo tem -2 na próxima reação' }),
        tec('Golpe Baixo', 'Chuta onde dói.', 'Ação Simples', '-15 de SP', 'Força + 30 de dano', '2'),
        tec('Fuga Covarde', 'Corre gastando o fôlego que tiver.', 'Ação Bônus', 'Quanto quiser de SP', '-', '', {
          efeito: '+1 bloco a cada 10 SP gastos',
          sugere: { custo: ['-20 de SP', 'Um custo fixo. Se quiser variável, a pergunta na hora continua valendo.'] },
        }),
        tec('Garrafada', 'Quebra uma garrafa na cabeça do alvo.', 'Ação Simples', '', '1d8 x 10', '', {
          sugere: { dano: ['45 de dano', 'Média de 1d8 (4,5) vezes 10.'] },
        }),
        tec('Chute na Areia', 'Um chute qualquer.', 'Ação Simples', '', 'Força + um pouco', '', {
          sugere: { dano: ['Força + 10', '“Um pouco” vira um número.'] },
        }),
      ],
      nota: '',
    },
    { id: 'caolho', nome: 'Bandido Caolho', tipo: 'npc', modeloId: 'bandido', forca: 1.1, nota: 'Dono do barco roubado.' },
  ]

  /** NPCs que só ficam no cenário: sem ficha de batalha, fora da ordem dos turnos. */
  const CENARIO = [
    { id: 'juca', nome: 'Taberneiro Juca', oficio: 'Dono da taverna', cor: 'parchment-dim' },
    { id: 'lu', nome: 'Vendedora Lu', oficio: 'Peixe no cais', cor: 'parchment-faint' },
    { id: 'moleque', nome: 'Moleque do cais', oficio: 'Leva recados', cor: 'parchment-faint' },
  ]

  /** Nomes com que os jogadores já entraram na mesa (o nome do formulário de entrada). */
  const JOGADORES_DA_MESA = [
    { nome: 'marina', visto: 'hoje' },
    { nome: 'beto', visto: 'hoje' },
    { nome: 'duda.s', visto: 'ontem' },
    { nome: 'rafa', visto: 'há 3 dias' },
    { nome: 'kaio', visto: 'há 2 semanas' },
  ]
  const MAPAS_DA_PASTA = ['Porto de Vila Sal', 'Navio Gaivota', 'Posto G-4 da Marinha', 'Ilha da Névoa']

  /* ---- catálogo do livro (Perícias, Vantagens e Desvantagens já existem; o resto é novo) ---- */
  const CATALOGO = [
    { id: 'c1', tipo: 'arma', nome: 'Sabre de serviço', txt: 'Lâmina reta da Marinha.', campos: { Dano: '35', Ação: 'Ação Simples' } },
    { id: 'c2', tipo: 'arma', nome: 'Mosquete curto', txt: 'Um tiro por turno, alcance de 8 blocos.', campos: { Dano: '20', Ação: 'Ação Simples', Modificador: 'Percepção' } },
    { id: 'c3', tipo: 'arma', nome: 'Martelo de forja', txt: 'Pesado e lento.', campos: { Dano: '40', Ação: 'Ação Simples' } },
    { id: 'c4', tipo: 'arma', nome: 'Corrente de âncora', txt: 'Prende o alvo se acertar.', campos: { Dano: '25', Ação: 'Ação Simples', Efeito: 'Prende por 1 turno' } },
    { id: 'c5', tipo: 'arma', nome: 'Faca', txt: 'Cabe na bota.', campos: { Dano: '15', Ação: 'Ação Bônus' } },
    { id: 'c6', tipo: 'arma', nome: 'Canhão de mão', txt: 'Derruba porta e gente.', campos: { Dano: '60', Ação: 'Ação Completa' } },
    { id: 'c7', tipo: 'arma', nome: 'Frigideira', txt: 'De ferro fundido.', campos: { Dano: '20', Ação: 'Ação Simples' } },
    { id: 'c8', tipo: 'habilidade', nome: 'Estocada', txt: 'Golpe básico de quem treina com lâmina.', campos: { Ação: 'Ação Simples', Dano: 'Força + 40 de dano' } },
    { id: 'c9', tipo: 'habilidade', nome: 'Postura de Defesa', txt: 'Fecha a guarda até o próximo turno.', campos: { Ação: 'Ação Bônus', Custo: '-20 de SP', Efeito: '+100 de Escudo' } },
    { id: 'c10', tipo: 'habilidade', nome: 'Primeiros Socorros', txt: 'Estanca um ferimento.', campos: { Ação: 'Ação Simples', Custo: '-30 de SP', Efeito: 'Cura 150 HP de um aliado', Tempo: '2' } },
    { id: 'c11', tipo: 'habilidade', nome: 'Tiro Mirado', txt: 'Gasta a vez mirando.', campos: { Ação: 'Ação Completa', Custo: '-25 de SP', Dano: 'Percepção + 90 de dano', Tempo: '3' } },
    { id: 'c12', tipo: 'item', nome: 'Bandagem', txt: 'Um rolo limpo.', campos: { Efeito: 'Cura 80 HP', Ação: 'Ação Bônus' } },
    { id: 'c13', tipo: 'item', nome: 'Tônico amargo', txt: 'Devolve o fôlego.', campos: { Efeito: '+60 de SP', Ação: 'Ação Bônus' } },
    { id: 'c14', tipo: 'item', nome: 'Luneta', txt: 'Vê o navio antes de ele ver você.', campos: { Efeito: 'Vantagem em Navegação' } },
    { id: 'c15', tipo: 'item', nome: 'Corda de cânhamo', txt: '20 metros.', campos: {} },
    { id: 'c16', tipo: 'pericia', nome: 'Acrobacia', txt: 'Andar na corda bamba, cair sem se machucar e outras proezas.', campos: { Atributo: 'Agilidade' } },
    { id: 'c17', tipo: 'pericia', nome: 'Analisar Criatura', txt: 'Saber se um inimigo ou aliado é ameaça, ou se age estranho.', campos: { Atributo: 'Percepção' } },
    { id: 'c18', tipo: 'pericia', nome: 'Anatomia', txt: 'Entender o corpo, achar ferimentos e doenças.', campos: { Atributo: 'Intuição' } },
    { id: 'c19', tipo: 'pericia', nome: 'Navegação', txt: 'Ler cartas, ventos e correntes.', campos: { Atributo: 'Intuição' } },
    { id: 'c20', tipo: 'pericia', nome: 'Furtividade', txt: 'Passar sem ser visto.', campos: { Atributo: 'Agilidade' } },
    { id: 'c21', tipo: 'vantagem', nome: 'Olhos de Águia', txt: 'Enxerga longe.', campos: {} },
    { id: 'c22', tipo: 'vantagem', nome: 'Coragem', txt: 'Não recua fácil.', campos: {} },
    { id: 'c23', tipo: 'vantagem', nome: 'Recuperação Espantosa', txt: 'Volta de ferimentos rápido.', campos: {} },
    { id: 'c24', tipo: 'desvantagem', nome: 'Curioso', txt: 'Mexe no que não deve.', campos: {} },
    { id: 'c25', tipo: 'desvantagem', nome: 'Coração Mole', txt: 'Não consegue deixar ninguém para trás.', campos: {} },
  ]
  const TIPOS_DO_CATALOGO = {
    arma: { nome: 'Armas', um: 'Arma', origem: 'novo', secao: 'armas' },
    habilidade: { nome: 'Habilidades', um: 'Habilidade', origem: 'novo', secao: 'tecnicas' },
    item: { nome: 'Itens', um: 'Item', origem: 'novo', secao: 'itens' },
    pericia: { nome: 'Perícias', um: 'Perícia', origem: 'livro', secao: 'pericias' },
    vantagem: { nome: 'Vantagens', um: 'Vantagem', origem: 'livro', secao: 'vantagens' },
    desvantagem: { nome: 'Desvantagens', um: 'Desvantagem', origem: 'livro', secao: 'desvantagens' },
  }

  /** Seções do livro que a IA recebe quando a pergunta fala delas (títulos reais de livroOnePiece.ts). */
  const SECOES_DAS_REGRAS = [
    { titulo: 'Ações de combate', chaves: ['dano', 'reacao', 'turno', 'rodada', 'ataque', 'combate', 'luta', 'golpe', 'sobrevive', 'dura', 'vence', 'batalha', 'contra'] },
    { titulo: 'Status', chaves: ['hp', 'sp', 'vida', 'escudo', 'resistencia', 'espirito'] },
    { titulo: 'Mecânicas', chaves: ['rank', 'modificador', 'atributo', 'forca', 'agilidade'] },
    { titulo: 'Akuma no Mi', chaves: ['fruta', 'akuma', 'logia', 'paramecia', 'zoan', 'transformacao', 'forma'] },
    { titulo: 'Ofícios', chaves: ['oficio', 'cozinheiro', 'medico', 'ferreiro', 'navegador', 'carpinteiro'] },
    { titulo: 'Perícias', chaves: ['pericia'] },
    { titulo: 'Vantagens', chaves: ['vantagem'] },
  ]

  /* =====================================================================
   * Leitura dos campos (mesmas regras do app; puro, sem estado)
   * ===================================================================== */
  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  }
  const vazio = (normal) => normal === '' || normal === '-'

  // leituraDaFicha.ts:51-53
  const CUSTO_SIMPLES = /^-? ?(\d+) ?(?:de )?(sp|hp)? ?(\( ?por turno ?\)|por turno)?$/
  const CUSTO_EM_PORCENTAGEM = /(\d+(?:[.,]\d+)?) ?% ?(?:(?:de|da|do|dos|das) )?(hp|sp|vida)/

  function lerCusto(texto) {
    const normal = normalizar(texto)
    if (vazio(normal)) return { status: 'sem' }
    const simples = CUSTO_SIMPLES.exec(normal)
    if (simples) {
      const recurso = simples[2] === 'hp' ? 'HP' : 'SP'
      return { status: 'lido', leitura: `${simples[1]} ${recurso}${simples[3] ? ' por turno' : ''}`, valor: Number(simples[1]) }
    }
    const pct = CUSTO_EM_PORCENTAGEM.exec(normal)
    if (pct && !/[+]/.test(normal)) {
      const recurso = pct[2] === 'sp' ? 'SP' : 'HP'
      return { status: 'ajuda', leitura: `${pct[1]}% do ${recurso} atual`, motivo: 'O app sugere o valor na hora e você confirma.' }
    }
    return { status: 'nao', motivo: 'O app vai perguntar o custo toda vez que a técnica for usada.' }
  }

  // leituraDaFicha.ts lerAcao: partes separadas por | ou /
  function lerAcao(texto) {
    const normal = normalizar(texto)
    if (vazio(normal)) return { status: 'sem' }
    if (normal.startsWith('passiva')) return { status: 'lido', leitura: 'Passiva' }
    const nomes = { simples: 'Ação Simples', completa: 'Ação Completa', bonus: 'Ação Bônus', livre: 'Ação Livre' }
    const achados = []
    for (const parte of normal.split(/[|/]/)) {
      const pedaco = parte.trim().replace(/^acao /, '')
      if (pedaco === 'overload') achados.push('OVERLOAD')
      else if (pedaco === 'transformacao') achados.push('Transformação')
      else if (pedaco === 'reacao') achados.push('Reação')
      else if (nomes[pedaco]) achados.push(nomes[pedaco])
    }
    if (achados.length === 0) return { status: 'nao', motivo: 'Tipo de ação desconhecido. O app entende Simples, Bônus, Completa, Livre, Reação, OVERLOAD e Transformação.' }
    return { status: 'lido', leitura: achados.join(' + ') }
  }

  // leituraDaFicha.ts:99-100
  const TEMPO_EM_TURNOS = /^(\d+)(?: ?turnos?)?$/
  const TEMPO_EM_USOS = /^(\d+) ?vez(?:es)? ?(?:por|na|no|em|a cada) ?(?:combate|batalha|luta)$/
  function lerTempo(texto) {
    const normal = normalizar(texto)
    if (vazio(normal)) return { status: 'sem' }
    if (normal === 'overload') return { status: 'lido', leitura: 'OVERLOAD' }
    const turnos = TEMPO_EM_TURNOS.exec(normal)
    if (turnos && Number(turnos[1]) >= 1) return { status: 'lido', leitura: `recarga de ${turnos[1]} ${turnos[1] === '1' ? 'turno' : 'turnos'}` }
    const usos = TEMPO_EM_USOS.exec(normal)
    if (usos && Number(usos[1]) >= 1) return { status: 'lido', leitura: `${usos[1]} ${usos[1] === '1' ? 'vez' : 'vezes'} por combate` }
    return { status: 'nao', motivo: 'Fica como texto: o app não conta a recarga sozinho.' }
  }

  /* ---- dano: gramática pequena, descida recursiva, sem eval (formula.ts) ---- */
  const VARIAVEIS = {}
  for (const a of ATRIBUTOS) {
    VARIAVEIS[normalizar(a.nome)] = a.id
    VARIAVEIS[a.abrev.toLowerCase()] = a.id
  }
  const ENFEITES = new Set(['dano', 'base', 'pontos'])
  const PORCENTAGEM_DA_VIDA = /^(\d+(?:[.,]\d+)?) ?% ?(?:(?:de|da|do) )?(?:vida|hp)(?: (atual|maxima|maximo|max))? (?:do|da) alvo$/
  const DADO = /\b(\d+) ?d ?(\d+)\b/

  /** O pedaço do texto original a partir da palavra que travou (para a mensagem). */
  function trechoOriginal(original, palavraNormal) {
    const palavras = String(original).split(/\s+/)
    const i = palavras.findIndex((p) => normalizar(p).replace(/[^a-z]/g, '') === palavraNormal)
    if (i === -1) return palavraNormal
    const trecho = []
    for (const p of palavras.slice(i, i + 4)) {
      if (trecho.length > 0 && /^[+\-*/×\d(]/.test(p)) break
      trecho.push(p)
      if (/[:,;]$/.test(p)) break
    }
    return trecho.join(' ').replace(/[,.:;]+$/, '')
  }

  function tokenizar(normal, original) {
    const crus = []
    let resto = normal
    while (resto.length > 0) {
      let m
      if ((m = /^\s+/.exec(resto))) { resto = resto.slice(m[0].length); continue }
      if ((m = /^\d+(?:[.,]\d+)?/.exec(resto))) { crus.push({ t: 'num', v: Number(m[0].replace(',', '.')) }); resto = resto.slice(m[0].length); continue }
      if ('+-*/()×'.includes(resto[0])) { crus.push({ t: 'op', v: resto[0] === '×' ? '*' : resto[0] }); resto = resto.slice(1); continue }
      if ((m = /^\p{L}+/u.exec(resto))) { crus.push({ t: 'pal', v: m[0] }); resto = resto.slice(m[0].length); continue }
      return { erro: `O sinal “${resto[0]}” não entra na conta.` }
    }
    const lista = []
    for (let i = 0; i < crus.length; i++) {
      const k = crus[i]
      if (k.t !== 'pal') { lista.push(k); continue }
      const w = k.v
      const prox = crus[i + 1]
      const prox2 = crus[i + 2]
      if (w === 'x') { lista.push({ t: 'op', v: '*' }); continue }
      if (w === 'dano' && prox && prox.t === 'pal' && (prox.v === 'da' || prox.v === 'de') && prox2 && prox2.t === 'pal' && prox2.v === 'arma') { lista.push({ t: 'arma' }); i += 2; continue }
      if (w === 'arma') { lista.push({ t: 'arma' }); continue }
      if (VARIAVEIS[w]) { lista.push({ t: 'var', v: VARIAVEIS[w] }); continue }
      if (ENFEITES.has(w)) continue
      if (w === 'de' && prox && prox.t === 'pal' && !VARIAVEIS[prox.v]) { i += 1; continue }
      return { erro: `“${trechoOriginal(original, w)}” não é conta.` }
    }
    return { lista }
  }

  function analisar(lista, valorDe) {
    let pos = 0
    const ver = () => lista[pos]
    function primario() {
      const k = ver()
      if (!k) throw new Error('A conta termina no meio.')
      if (k.t === 'num') { pos++; return { v: k.v, c: formatar(k.v) } }
      if (k.t === 'var' || k.t === 'arma') { pos++; return valorDe(k) }
      if (k.t === 'op' && k.v === '(') {
        pos++
        const dentro = soma()
        if (!ver() || ver().v !== ')') throw new Error('Falta fechar um parêntese.')
        pos++
        return { v: dentro.v, c: `(${dentro.c})` }
      }
      throw new Error(`Sobrou “${k.v}”.`)
    }
    function unario() {
      if (ver() && ver().t === 'op' && ver().v === '-') { pos++; const u = unario(); return { v: -u.v, c: `-${u.c}` } }
      return primario()
    }
    function produto() {
      let esq = unario()
      while (ver() && ver().t === 'op' && (ver().v === '*' || ver().v === '/')) {
        const op = ver().v
        pos++
        const dir = unario()
        esq = { v: op === '*' ? esq.v * dir.v : esq.v / dir.v, c: `${esq.c} ${op === '*' ? '×' : '/'} ${dir.c}` }
      }
      return esq
    }
    function soma() {
      let esq = produto()
      while (ver() && ver().t === 'op' && (ver().v === '+' || ver().v === '-')) {
        const op = ver().v
        pos++
        const dir = produto()
        esq = { v: op === '+' ? esq.v + dir.v : esq.v - dir.v, c: `${esq.c} ${op} ${dir.c}` }
      }
      return esq
    }
    const r = soma()
    if (pos < lista.length) throw new Error('Sobrou um pedaço depois da conta.')
    return r
  }

  function formatar(n) {
    return Number.isInteger(n) ? n.toLocaleString('pt-BR') : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  }

  /**
   * Lê o campo Dano. `ficha` é a ficha completa (herança já resolvida).
   * Volta { status: 'sem'|'mao'|'lido'|'ajuda'|'nao', valor?, conta?, motivo? }.
   */
  function lerDano(texto, ficha, tecnica) {
    const normal = normalizar(texto)
    if (vazio(normal)) return tecnica && tecnica.manual ? { status: 'mao', motivo: 'À mão de propósito: na batalha você digita o número.' } : { status: 'sem' }
    if (PORCENTAGEM_DA_VIDA.test(normal)) {
      return { status: 'ajuda', leitura: '% da vida do alvo', motivo: 'Lê só quando quem usa vê a vida do alvo: o mestre vê; o jogador, contra NPC, digita o número.' }
    }
    const dado = DADO.exec(normal)
    if (dado) return { status: 'nao', motivo: `Dado (${dado[1]}d${dado[2]}) não entra na conta: o app não rola por você.` }
    const t = tokenizar(normal, texto)
    if (t.erro) return { status: 'nao', motivo: t.erro }
    const arma = ficha.armas && ficha.armas[0]
    let usouArma = false
    const valorDe = (k) => {
      if (k.t === 'arma') {
        usouArma = true
        const dano = arma ? Number(normalizar(arma.dano).replace(/[^\d]/g, '')) || 0 : 0
        return { v: dano, c: arma ? `${formatar(dano)} ${arma.nome}` : '? arma' }
      }
      const v = totalDoAtributo(ficha, k.v)
      return { v, c: `${formatar(v)} ${ATR[k.v].nome}` }
    }
    try {
      const r = analisar(t.lista, valorDe)
      const valor = Math.max(0, Math.floor(r.v))
      if (usouArma && !arma) return { status: 'ajuda', valor, conta: `${r.c} = ${formatar(valor)}`, motivo: 'Precisa de uma arma na aba Armas.' }
      return { status: 'lido', valor, conta: `${r.c} = ${formatar(valor)}` }
    } catch (erro) {
      return { status: 'nao', motivo: erro.message }
    }
  }

  /* ---- números da ficha ---- */
  function totalDoAtributo(ficha, id) { return ficha.atributos[id] || 0 }
  const rank = (ficha, id) => rankDoValor(ATR[id], totalDoAtributo(ficha, id))
  const hpBase = (ficha) => acumulado(HP_DO_RANK, rank(ficha, 'resistencia'))
  const spMax = (ficha) => acumulado(SP_DO_RANK, rank(ficha, 'espirito'))

  return {
    ATRIBUTOS, ATR, FICHAS, CENARIO, JOGADORES_DA_MESA, MAPAS_DA_PASTA, CATALOGO, TIPOS_DO_CATALOGO, SECOES_DAS_REGRAS, FATOR_DA_REACAO,
    normalizar, formatar, lerCusto, lerAcao, lerTempo, lerDano, rank, hpBase, spMax,
  }
})()
