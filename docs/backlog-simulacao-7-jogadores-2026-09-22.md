# Backlog consolidado — 10 mesas simuladas de 7 jogadores

Base: HEAD 0e1fc70 (nenhuma mudança em client/src desde cf42909, onde as simulações rodaram). 70 itens, ordenados por prioridade (5 = mais urgente = dor x frequência x custo).

Legenda: tipo (defeito/feature/refino) · tam P (~1 h) / M (1-2 h) / G (~3 h, limite de uma peça) · jogador = muda o que o jogador recebe pela rede (exige teste de recorte/vazamento).

Fora do backlog de propósito:
- G10-G15 do PEDIDOS.md (viajar junto, pausa por cena, companheiros na tela do jogador, visão geral, diário de viagens). O achado "jogador não sabe em que andar estão os colegas" (mansão rodada) é o G13 e não virou item.
- Falhas intermitentes com 8 páginas Pixi na máquina a 100% de CPU: ambiente, não app (os próprios relatórios descartaram).

Cenários: vila = vila-casas-quartos (leitura) · vila* = vila-casas-quartos (app rodando) · mansao = mansao-dois-andares (leitura) · mansao* = mansao-dois-andares (app rodando) · porto = cidade-portuaria · capital = capital-distritos · viagem = viagem-entre-cidades · castelo = invasao-castelo · crime = investigacao-assassinato · fuga = fuga-sessao-longa.

## Ordem sugerida de ataque

1. Travas do jogador na mesa cheia: chegada-em-casa-livre, atribuir-livres-primeiro, so-a-propria-ficha-arrasta, mapa-livre-do-painel, zoom-no-celular.
2. Vazamentos: nome-publico-da-ficha, sala-secreta-nao-vaza, zona-oculta-sem-buraco.
3. Canal mestre-jogador: recado-para-um-jogador, recado-para-escolhidos, caderno-recados; porta-trancada-vira-pedido (abre a Caixa de Pedidos para pedido que não é viagem), chamar-o-mestre, acoes-no-ponto.
4. Sessão que sobrevive: reconexao-automatica, voltar-e-a-mesma-pessoa, retomar-mesa-donos, retomar-mesa-exploracao, exploracao-nao-se-perde, ctrl-z-nao-desfaz-jogador.
5. Conteúdo do cômodo: objetos-como-silhueta, sala-texto-ao-entrar, pino-so-para-escolhidos.

## Prioridade 5

### atribuir-livres-primeiro — Atribuir ficha: livres primeiro, de qualquer cena, sem tirar a de quem joga
defeito · M · jogador: não · cenários: vila*, mansao*, fuga
- Objetivo: com 7 jogadores os botões de um clique oferecem ao sétimo as fichas dos outros e escondem a livre; um clique errado derruba um jogador. Botões só com fichas sem dono, de todas as cenas, sem NPC; ficha de outro jogador só na lista, marcada, com confirmação.
- Aceite: 7 fichas em 2 cenas, editor na Cozinha. Após 6 atribuições, o card da Gina mostra 'Biblioteca · Atribuir Livro' primeiro, sem ficha com dono nem Mordomo. Um clique: celular da Gina abre na Biblioteca; editor fica na Cozinha. 'Machado — de Bruno' pede confirmação; Cancelar mantém Bruno.
- Arquivos: client/src/components/RoomPanel.tsx, client/src/App.tsx, client/src/net/hostSession.ts

### chegada-em-casa-livre — Quem passa pelo mesmo pino chega em casas vizinhas, não empilhado
defeito · P · jogador: sim · cenários: mansao, castelo, vila*, mansao*
- Objetivo: todos caem na mesma célula, sobre o pino; a ficha de baixo some e o dono não a arrasta. Chegada na casa livre mais próxima (mesma busca do Reunir), sem cruzar parede, pino tocável. Vale para pedido, livre e Mandar para.
- Aceite: dois pedem o porão, mestre 'Deixar todos': fichas lado a lado, fora do pino, cada um arrasta a sua, pino abre o cartão. 7 pela mesma escada = 7 casas. Teste de unidade com ficha já no pino.
- Arquivos: client/src/lib/pinTravel.ts, client/src/lib/gatherParty.ts, client/src/net/hostSession.ts

### zoom-no-celular — Zoom no celular: pinça e botões + e −
defeito · M · jogador: não · cenários: porto, fuga
- Objetivo: no celular não há zoom (só roda do mouse; o do navegador está bloqueado). Pinça pelo ponto médio e botões +/− no canto.
- Aceite: 360x740 com toque. Pinça abrindo aproxima sem mover a ficha nem sinalizar; fechando afasta; '+' duas vezes aproxima em degraus. Um dedo na ficha arrasta a ficha, no chão a câmera; parado sinaliza.
- Arquivos: client/src/player/PlayerView.tsx, client/src/pixi/world.ts, client/src/player/main.tsx, client/src/player/player.css

### mapa-livre-do-painel — Painel do jogador recolhe em qualquer tela e a câmera abre na própria ficha
defeito · G · jogador: não · cenários: vila*, mansao*, fuga
- Objetivo: no notebook o painel fica fixo sobre a faixa esquerda, sem fechar, escondendo ficha, portas e pinos; na chegada a câmera enquadra o mapa inteiro. Painel recolhível em qualquer largura, câmera na área livre e centrada na própria ficha ao entrar ou trocar de cena, botão 'Minha ficha' fixo, aro de dono de contraste.
- Aceite: 1280x800 com ficha e taverna na borda esquerda: arrasta e toca a porta sem mexer na câmera; 'Painel' abre e fecha. Fábio (ficha azul) entra: ficha no centro, anel branco pulsa. Arrasta o mapa, toca o alvo, volta. Mandado ao Porão, chega centrado e sem nome de cena.
- Arquivos: client/src/player/player.css, client/src/player/PlayerPanel.tsx, client/src/player/PlayerView.tsx, client/src/player/main.tsx

### objetos-como-silhueta — Móveis e objetos aparecem para o jogador como silhueta chapada
defeito · M · jogador: sim · cenários: vila, mansao, porto, capital, viagem, castelo, crime, fuga
- Objetivo: o jogador vê o cômodo vazio. Cada objeto visível vira silhueta chapada estilo minimapa, tamanho e rotação certos; oculto, sob teto fechado ou fora da visão continua fora.
- Aceite: 'Cama' no Quarto do prefeito; Ana entra e vê o retângulo no lugar. Bruno sem visão: nada. 'Oculto para jogadores': some da Ana. Teto fechado com Ana fora: nada.
- Arquivos: client/src/player/PlayerView.tsx, client/src/lib/fogFilter.ts, client/src/pixi/drawProps.ts

### recado-para-um-jogador — Recado para um jogador só, pela linha dele no Grupo
feature · P · jogador: sim · cenários: mansao, porto, capital, castelo, crime, fuga, vila*
- Objetivo: o recado vai para a cena inteira e a pista de um vaza. Cada linha do Grupo ganha 'Recado' (500 caracteres), só aquele jogador recebe, com a faixa 'Só para você'; quem está fora recebe ao voltar.
- Aceite: Grupo > Recado na Gabi, Ctrl+Enter. Linha mostra 'Recado enviado a Gabi'; celular dela abre com 'Só para você'; Elisa, na mesma sala, não recebe e o pacote dela não tem o texto.
- Arquivos: client/src/components/PartySection.tsx, client/src/net/protocol.ts, client/src/net/hostSession.ts, client/src/net/hostBridge.ts, client/src/player/PlayerNoteCard.tsx

### sala-texto-ao-entrar — Texto do cômodo que o jogador lê ao entrar, e nota do mestre
feature · M · jogador: sim · cenários: vila, mansao, porto, capital, viagem, castelo, crime, fuga, vila*
- Objetivo: sala sem descrição; o mestre narra o mesmo cômodo para cada um. Campos 'Ao entrar, o jogador lê' e 'Nota do mestre' (nunca sai). Na primeira entrada, só aquele jogador recebe o cartão; tocar no rótulo reabre. Sala secreta, sob teto fechado ou zona oculta não dispara.
- Aceite: Carla entra na Cozinha: cartão 'Cozinha'. Enzo no corredor: nada. Sai e volta: não repete; tocar 'Cozinha' reabre. Bruno entra depois: recebe. Teste de recorte: nota e texto fora do pacote de quem está fora.
- Arquivos: client/src/types/map.ts, client/src/lib/mapFile.ts, client/src/components/RoomControls.tsx, client/src/net/hostSession.ts, client/src/net/protocol.ts, client/src/player/PlayerNoteCard.tsx, client/src/player/main.tsx

### pino-so-para-escolhidos — Pista (pino) visível só para os jogadores escolhidos
feature · M · jogador: sim · cenários: vila, mansao, porto, capital, viagem, castelo, crime, fuga
- Objetivo: 'Oculto para jogadores' é tudo ou nada. 'Quem vê: Todos | Só estes' com bolinha por jogador; só os marcados recebem o pino (e o id); o editor mostra quem vê. Lista vive na sessão do host.
- Aceite: pino 'Faca' só para Diego: aparece para ele; Carla no mesmo quarto não vê nem toca. Bolinha do Diego no editor. Marcar Carla: aparece para ela sem recarregar. Teste de recorte.
- Arquivos: client/src/lib/fogFilter.ts, client/src/net/hostSession.ts, client/src/net/hostBridge.ts, client/src/components/PinControls.tsx, client/src/components/PlayerSecretControls.tsx, client/src/App.tsx

### porta-trancada-vira-pedido — Porta trancada: 'Pedir ao mestre' vira linha na Caixa de Pedidos
feature · M · jogador: sim · cenários: vila, mansao, porto, capital, viagem, castelo, crime, fuga, vila*, mansao*
- Objetivo: 'Trancada' só volta ao jogador; o mestre não sabe e gasta 4-5 gestos trocando de cena. O aviso ganha Bater/Forçar/Usar chave; entra na Caixa com 'Destrancar e abrir' e 'Não', com a cena em segundo plano. A porta trancada chega ao jogador como porta fechada comum. Primeiro pedido não-viagem da Caixa.
- Aceite: Ana vê as 3 portas na mesma cor. Toca a do Escritório > Forçar > 'Pedido enviado'. Mestre, noutra cena, vê 'Pedidos (1): Ana tenta forçar a porta', clica 'Destrancar e abrir': abre para quem vê, Ana lê 'O mestre abriu'. 'Não' -> 'O mestre disse não'. 5 toques não viram 5 linhas.
- Arquivos: client/src/net/protocol.ts, client/src/net/hostSession.ts, client/src/net/hostBridge.ts, client/src/components/Toast.tsx, client/src/components/caixaDeAvisos.ts, client/src/lib/fogFilter.ts, client/src/player/main.tsx, client/src/App.tsx

### reconexao-automatica — Queda de conexão volta sozinha, e o mestre vê quem caiu
defeito · G · jogador: não · cenários: fuga, capital
- Objetivo: Wi-Fi que pisca ou tela bloqueada trocam o mapa por erro e exigem Reconectar; o mestre não sabe. Reconexão automática (espera crescente até 30 s; imediata ao desbloquear ou a rede voltar), mapa esmaecido com 'Reconectando…'. No mestre, 'fora há 2 min' e aviso 'Gina caiu' (quedas juntas = um aviso).
- Aceite: desliga o Wi-Fi da Gina: mapa esmaecido; Grupo mostra 'fora há 0:10' e 'Gina caiu'. Wi-Fi volta: em até 3 s tudo igual e 'Gina voltou'. Ana bloqueia 60 s: volta sozinha. Reconectar só após 30 s.
- Arquivos: client/src/player/playerConnection.ts, client/src/player/main.tsx, client/src/net/hostBridge.ts, client/src/lib/party.ts, client/src/components/PartySection.tsx

### voltar-e-a-mesma-pessoa — Voltar por aba nova não vira 'Ana (2)', e o mestre dispensa quem foi embora
defeito · M · jogador: sim · cenários: fuga
- Objetivo: aba nova vira 'Ana (2)' sem ficha e sem explorado; 'Ana · fora' fica para sempre. Retorno lembrado no aparelho; nome igual a jogador fora vira 'Ana voltou? [É ela] [Outra pessoa]' na Caixa, e 'É ela' junta fichas, memórias e raio. Jogador fora ganha 'Dispensar' e 'Guardar ficha'.
- Aceite: Ana reabre o QR numa aba nova: entra direto com o Hall explorado. Outro celular com 'ana': 'É ela' e o explorado vem junto; uma Ana só. Fábio sai: 'Guardar ficha' tira o Escudo do mapa; 'Dispensar' tira o card.
- Arquivos: client/src/player/main.tsx, client/src/player/playerConnection.ts, client/src/net/hostSession.ts, client/src/net/hostBridge.ts, client/src/components/RoomPanel.tsx

### retomar-mesa-donos — Retomar a mesa: cada jogador reencontra a própria ficha depois de fechar o app
defeito · M · jogador: sim · cenários: mansao, porto, capital, viagem, castelo, crime, fuga
- Objetivo: fechar o app perde donos, raios e código; o mestre refaz 7 atribuições. Arquivo da mesa gravado a cada mudança (jogadores por nome, fichas, raio, cena). Abrir sala pergunta 'Retomar a mesa?', reaproveita o código quando der, mesmo nome recebe as mesmas fichas com Desfazer.
- Aceite: Lírio da Ana, salva, fecha, reabre > Abrir sala > Retomar: mesmo código. Ana entra como 'ana' e já está com Lírio; aviso 'Ana voltou: Lírio devolvida [Desfazer]'. Nome novo: 'Sem personagem'. 'Mesa nova' = hoje.
- Arquivos: client/src/net/hostSession.ts, client/src/net/hostBridge.ts, client/src/lib/mapFileIO.ts, client/src/stores/adventureStore.ts, client/src/components/RoomPanel.tsx, desktop/src-tauri/src/net/commands.rs

### caderno-recados — Caderno do jogador: recados guardados, relidos e reenviados na volta
feature · M · jogador: sim · cenários: vila, mansao, capital, crime
- Objetivo: recado some ao fechar, o novo apaga o aberto, quem reconecta perde. Host guarda até 50 recados por jogador e reenvia o último da cena a quem entra ou volta; aba 'Caderno'; ponto no Painel quando chega recado com cartão fechado.
- Aceite: Fábio fecha o recado; Caderno mostra '20:30 · Mestre: o baú tem fundo falso'; recarrega e continua. Bruno corta a rede e volta: o recado reaparece. Gabi entra na Prisão depois e recebe; Diego no Mercado, não.
- Arquivos: client/src/net/hostSession.ts, client/src/net/protocol.ts, client/src/player/PlayerPanel.tsx, client/src/player/PlayerNoteCard.tsx, client/src/player/playerConnection.ts

## Prioridade 4

### so-a-propria-ficha-arrasta — Só a própria ficha arrasta, o toque atravessa ficha alheia, e a recusa diz o motivo
defeito · P · jogador: não · cenários: castelo, mansao*, capital, vila*
- Objetivo: numa sala cheia o dedo pega a ficha do colega, ela anda e volta sem explicação; porta ou pino sob ficha não se tocam. Ficha alheia deixa o toque passar, as próprias ficam por cima, e a recusa do host mostra 'Parede no caminho', 'Fora do chão' ou 'Essa ficha não é sua'.
- Aceite: 7 fichas empilhadas: arrastar no bolo move sempre a do Enzo; tocar a do Bruno rola o mapa e nada vai ao host; porta e pino cobertos respondem ao toque. Arrastar através da parede: volta com 'Parede no caminho' por 2-3 s.
- Arquivos: client/src/player/PlayerView.tsx, client/src/player/playerConnection.ts, client/src/player/main.tsx

### nome-publico-da-ficha — Nome da ficha de NPC não vaza: 'Nome para os jogadores'
defeito · P · jogador: sim · cenários: porto, capital
- Objetivo: o nome de trabalho do NPC chega cru ao jogador. Opção 'O mesmo | Outro | Nenhum'; o recorte troca o nome; dono sempre vê o real; mapa antigo fica em 'O mesmo'.
- Aceite: 'Outro: Estivador' -> Duda vê 'Estivador' e 'traidor' não aparece no WS dela. 'Nenhum' -> sem rótulo. A ficha da Duda mantém o nome. Teste de recorte.
- Arquivos: client/src/types/map.ts, client/src/lib/fogFilter.ts, client/src/components/TokenNameControls.tsx, client/src/lib/mapFile.ts

### zona-oculta-sem-buraco — Zona oculta não aparece como quadrado preto em cima do segredo
defeito · M · jogador: sim · cenários: vila*
- Objetivo: a zona oculta vira um quadrado preto exatamente onde está o alçapão. Na área visível, a zona não revelada fica com a aparência do chão; preto só fora da visão.
- Aceite: Bruno no quarto com o 'Tapete' oculto vê chão contínuo e o pacote não tem o alçapão. 'Revelar para jogadores': o pino aparece no ponto.
- Arquivos: client/src/lib/fogFilter.ts, client/src/player/PlayerView.tsx, client/src/types/map.ts

### sala-secreta-nao-vaza — A visão do jogador não atravessa a porta trancada da sala secreta
defeito · M · jogador: sim · cenários: mansao*
- Objetivo: com o Quarto Secreto oculto, a porta some do recorte e a visão passa pelo vão da estante. Parede ou porta de sala secreta na borda de área visível chega como parede inteira.
- Aceite: Ana na Biblioteca vê a parede leste inteira, sem cone nem vão; tocar não faz nada. Mestre desliga oculto e trancada: a porta aparece e abre.
- Arquivos: client/src/lib/fogFilter.ts

### ctrl-z-nao-desfaz-jogador — Ctrl+Z do mestre não desfaz passo nem porta de jogador
defeito · P · jogador: sim · cenários: fuga
- Objetivo: movimento e porta dos jogadores entram no histórico: Ctrl+Z volta o passo do Bruno em todas as telas e a edição do mestre sai da pilha. O que vem da rede só marca a cena como alterada.
- Aceite: parede desenhada; Bruno anda, Carla abre porta; Ctrl+Z tira só a parede; Ctrl+Shift+Z traz de volta; Salvar grava a posição nova do Bruno.
- Arquivos: client/src/App.tsx, client/src/stores/mapStore.ts

### exploracao-nao-se-perde — O explorado não some depois de 8 cenas nem ao aumentar o mapa
defeito · M · jogador: sim · cenários: viagem, fuga
- Objetivo: só as 8 cenas mais recentes ficam na memória do jogador, e redimensionar apaga o explorado de todos. Teto de ao menos 32 cenas, nunca esquecendo a cena com ficha do jogador; redimensionar com a mesma grade copia o explorado.
- Aceite: Carla passa por 10 cenas e volta: canto explorado continua. Mina +20 quadrados: explorado no mesmo lugar, faixa nova preta. Testes de unidade dos dois casos.
- Arquivos: client/src/net/hostSession.ts, client/src/lib/exploration.ts, client/src/components/MapSettingsDialog.tsx

### aviso-ao-fechar-com-sala-aberta — Fechar a janela com jogadores na sala pede confirmação
defeito · P · jogador: não · cenários: capital
- Objetivo: com o mapa salvo e a sala aberta, o X derruba os 7 sem perguntar. Com jogadores conectados, pergunta antes.
- Aceite: X com 7 jogadores: 'Há 7 jogadores na sala…'; Cancelar mantém todos; Confirmar fecha. Sem sala e sem alteração: fecha direto.
- Arquivos: client/src/App.tsx, client/src/net/hostBridge.ts

### recado-para-escolhidos — Recado de cena com escolha de quem recebe e atalho 'quem está nesta sala'
feature · P · jogador: sim · cenários: vila, fuga, vila* · depende: recado-para-um-jogador
- Objetivo: com a vila numa cena só, narrar a taverna chega a quem está na casa do prefeito. Bolinha por jogador presente e atalho 'Quem está em <sala>'; o botão diz quantos recebem.
- Aceite: 'Quem está em: Taverna' deixa 3 marcados, 'Enviar para 3'; só os 3 recebem. 'Quem está em: Quarto do prefeito' manda só ao Bruno.
- Arquivos: client/src/components/ScenesSection.tsx, client/src/net/hostSession.ts, client/src/net/hostBridge.ts, client/src/lib/roomNesting.ts

### caderno-pistas — 'Minhas pistas': cartões lidos ficam no caderno e podem ser mostrados a um colega
feature · G · jogador: sim · cenários: crime, vila, mansao · depende: caderno-recados
- Objetivo: a pista lida num quarto com teto some ao sair. Cartões de pino abertos e textos de sala entram no Caderno (no host), sem posição nem nome de cena; 'Mostrar para…' manda a um colega da mesma cena.
- Aceite: Gabi lê o bilhete e sai; Caderno > 'Bilhete' reabre com foto; recarrega e continua. 'Mostrar para… Ana': Ana recebe 'Gabi mostrou: Bilhete'. Colega em outra cena não aparece.
- Arquivos: client/src/player/PlayerPinCard.tsx, client/src/player/PlayerPanel.tsx, client/src/player/playerConnection.ts, client/src/net/protocol.ts, client/src/net/hostSession.ts

### porta-secreta — Porta secreta: parece parede até o mestre revelar
feature · M · jogador: sim · cenários: mansao, castelo, crime, vila
- Objetivo: não dá para deixar passagem secreta pronta. Porta 'Secreta' chega ao jogador como parede comum (sem halo nem toque); mestre a vê tracejada; 'Revelar passagem' desliga o segredo da porta e da sala ligada num clique.
- Aceite: Gabi encostada vê só a linha fina e não atravessa. 'Revelar passagem': a porta aparece, ela abre e o quarto entra na visão.
- Arquivos: client/src/types/map.ts, client/src/lib/mapFile.ts, client/src/components/WallDoorControls.tsx, client/src/lib/fogFilter.ts, client/src/pixi/drawDoors.ts, client/src/net/hostSession.ts

### comodo-lembrado — Cômodo já visto fica lembrado, e o não visto nem aparece
feature · G · jogador: sim · cenários: vila, vila*
- Objetivo: o teto esquece o cômodo ao sair e mostra a silhueta de todos ao chegar. Modo 'Cômodo': invisível até ser visto pela porta ou entrado, depois lembrado mais apagado com pinos tocáveis. Teto de prédio continua.
- Aceite: Bruno na sala não vê silhuetas dos outros cômodos; abre a porta e vê o corredor; sai e a sala fica lembrada; quarto lido fica com baú, cama e carta tocáveis, sem ficha alheia. Modo desligado = hoje.
- Arquivos: client/src/types/map.ts, client/src/lib/fogFilter.ts, client/src/lib/exploration.ts, client/src/net/hostSession.ts, client/src/components/RoomControls.tsx

### grupo-mostra-sala — Grupo diz em que cômodo está cada ficha, e avisa entrada em sala marcada
refino · M · jogador: não · cenários: vila, capital, crime
- Objetivo: com a vila numa cena só, as 7 linhas dizem o mesmo. A linha mostra 'Vila › Casa do prefeito › Quarto' (sala mais interna). Sala com 'Avisar quando alguém entrar' gera 'Duda entrou em Quarto da filha' com Ir lá, que some sozinho (máximo 3).
- Aceite: linha 'Ana — Vila de Pedravel › Quarto do prefeito'; Bruno anda às celas e a linha muda sozinha. Duda entra na sala marcada: em até 1 s o aviso com Ir lá. Jogadores não recebem nada.
- Arquivos: client/src/lib/party.ts, client/src/components/PartySection.tsx, client/src/lib/roomNesting.ts, client/src/net/hostBridge.ts, client/src/components/RoomControls.tsx

### pedido-ver-e-nao-com-motivo — Pedido de passagem com 'Ver' e 'Não, porque…'
refino · P · jogador: sim · cenários: capital
- Objetivo: o mestre não confere onde o jogador está antes de decidir, e o negado lê só 'não deixou'. 'Ver' abre a cena na ficha sem responder; 'Não' ganha texto curto opcional (80, com 3 recentes) que chega ao jogador.
- Aceite: 'Ver' no Felipe centra nele e a caixa segue com 4. 'Não' com 'o portão fecha à noite': caixa vai a 3 e Felipe lê 'O mestre não deixou: o portão fecha à noite'.
- Arquivos: client/src/net/hostBridge.ts, client/src/components/Toast.tsx, client/src/components/caixaDeAvisos.ts, client/src/net/protocol.ts, client/src/player/main.tsx, client/src/player/playerConnection.ts

### chamar-o-mestre — Chamar o mestre: mão levantada com motivo e texto curto, em fila
feature · M · jogador: não · cenários: fuga, porto, capital, mansao · depende: porta-trancada-vira-pedido, recado-para-um-jogador
- Objetivo: o jogador só grita ou faz um sinal de 3 s sem conteúdo. Botão de mão fixo com motivo (Ajuda, Quero agir, Pergunta, Vou sair, Urgente) e texto até 140; linha na Caixa em ordem de chegada com Ir lá, Visto e Responder (recado só para ele); Urgente no topo; limite por jogador.
- Aceite: Duda 'Quero agir': mão acesa 'Esperando o mestre'; mestre vê a linha e ouve bipe. Carla manda Pergunta: entra em 2º; Responder chega só a ela. Visto apaga a mão da Duda. 5 toques não empilham.
- Arquivos: client/src/net/protocol.ts, client/src/net/hostSession.ts, client/src/net/hostBridge.ts, client/src/components/Toast.tsx, client/src/player/PlayerPanel.tsx, client/src/player/main.tsx

### acoes-no-ponto — Toque longo: Procurar, Escutar, Espiar, Revistar viram pedido com o ponto
feature · M · jogador: não · cenários: vila, mansao, crime · depende: chamar-o-mestre
- Objetivo: 'procuro armadilha aqui' chega só por voz e o sinal de 3 s se perde. Após o toque longo, menu Sinalizar/Procurar/Escutar/Espiar/Revistar; as novas entram na Caixa com o ponto, Ir lá, 'Nada aqui' e Feito.
- Aceite: Fabi segura na bigorna > Procurar; mestre vê 'Fabi quer Procurar — Ferreiro', Ir lá centra e marca o ponto; 'Nada aqui' -> Fabi lê 'Você não encontrou nada'; Feito -> 'O mestre viu'. Sinal simples igual.
- Arquivos: client/src/player/PlayerView.tsx, client/src/net/protocol.ts, client/src/net/hostSession.ts, client/src/components/Toast.tsx, client/src/components/caixaDeAvisos.ts

### item-pegavel — Pegar item: pino vira item na mochila, e o mestre vê quem tem o quê
feature · G · jogador: sim · cenários: mansao, porto, capital, viagem, vila · depende: porta-trancada-vira-pedido
- Objetivo: a chave continua no mapa depois de 'pega' e o mestre anota no papel. Pino 'Item pegável' com nome; 'Pegar' vira pedido (ou direto se livre); aceito, some para todos e vai a 'Comigo' (no host, salvo). No Grupo o mestre vê, dá, tira ou devolve; jogador dá a colega encostado.
- Aceite: Diego pega 'Chave do Escudo'; mestre deixa; some para Diego e Bruno; 'Comigo: Chave do Escudo'; Grupo 'Mochila: 1'; viaja e continua; 'Dar a… Carla' passa o item.
- Arquivos: client/src/types/map.ts, client/src/lib/mapFile.ts, client/src/components/PinControls.tsx, client/src/player/PlayerPinCard.tsx, client/src/player/PlayerPanel.tsx, client/src/net/protocol.ts, client/src/net/hostSession.ts, client/src/components/PartySection.tsx

### retomar-mesa-exploracao — Retomar a mesa com o mapa explorado de cada jogador
feature · M · jogador: sim · cenários: mansao, capital, viagem, castelo, crime, fuga · depende: retomar-mesa-donos
- Objetivo: mesmo com fichas devolvidas, todos voltam com o mapa preto e o mestre revela salas nunca vistas. A mesa guarda exploração compacta e portas vistas por jogador e cena.
- Aceite: Carla explora o Porão, mestre salva e fecha; dia 2 Retomar: Carla abre no Porão todo explorado, com o raio de ontem, e nenhuma sala que não viu.
- Arquivos: client/src/net/hostSession.ts, client/src/lib/exploration.ts, client/src/lib/mapFileIO.ts

### ver-como-jogador — Ver pelos olhos de um jogador no editor
feature · M · jogador: não · cenários: vila, crime, castelo
- Objetivo: o mestre não confere o que Duda vê nem se o segredo ficou escondido. 'Ver como' escurece o que ela não vê, mostra só o que ela recebe, com faixa 'Vendo como Duda — Esc sai'; só leitura.
- Aceite: 'Ver como' na Duda: alçapão secreto some, faixa aparece, clique não seleciona; Esc volta com a mesma câmera.
- Arquivos: client/src/pixi/PixiCanvas.tsx, client/src/components/PartySection.tsx, client/src/net/hostBridge.ts, client/src/lib/fogFilter.ts, client/src/App.tsx

### visto-por — 'Visto por': o mestre sabe quais jogadores enxergam uma ficha
feature · M · jogador: não · cenários: porto, castelo
- Objetivo: o mestre pergunta em voz alta quem vê o guarda. Ficha sem dono selecionada mostra 'Visto por: Ana, Duda' ou 'Ninguém vê', atualizado no arrasto, com a mesma regra do recorte.
- Aceite: 'Ninguém vê'; arrasta para a rua: 'Visto por: Duda' e a Duda o vê; atrás da parede volta 'Ninguém vê'.
- Arquivos: client/src/components/PropertiesPanel.tsx, client/src/net/hostBridge.ts, client/src/lib/fogFilter.ts

### levar-npc-para-outra-cena — Levar ficha de NPC ou monstro para outra cena
feature · P · jogador: sim · cenários: mansao, capital · depende: chegada-em-casa-livre
- Objetivo: o mestre apaga e recria o zumbi e perde nome, cor e foto. Ficha sem dono ganha 'Levar para…' (cena e chegada), fora do desfazer; aparece só para quem tem visão.
- Aceite: zumbi > Levar para Térreo, 'Alçapão': some do Porão, 'Zumbi foi para Térreo' com Ir lá; está ao lado do alçapão com mesmo nome e cor; Carla o vê aparecer; Diego não recebe nome de cena.
- Arquivos: client/src/components/PropertiesPanel.tsx, client/src/components/PartySection.tsx, client/src/stores/adventureStore.ts, client/src/App.tsx

### revelar-planta-e-grupo — Revelar planta por cena, para vários, e dar ao atrasado o que o grupo viu
refino · G · jogador: sim · cenários: capital, viagem, fuga
- Objetivo: 'Revelar planta' é por jogador e só na cena atual; quem chega depois fica sem, e o atrasado não herda nada. Cena com 'Planta conhecida por todos'; 'Revelar planta para…' mesmo em cena vazia; 'Dar o que o grupo viu' une só o explorado dos colegas naquela cena.
- Aceite: Capital com planta conhecida: Felipe chega e vê ruas e silhuetas, sem interior de teto. Abadia só para Oto: nada muda até ele chegar, aí aparece; Eva vê só o raio. Duda atrasada recebe só a metade que os três viram.
- Arquivos: client/src/net/hostSession.ts, client/src/net/hostBridge.ts, client/src/lib/exploration.ts, client/src/types/map.ts, client/src/components/ScenesSection.tsx, client/src/components/RoomPanel.tsx

### visao-por-cena — Raio de visão por cena: mapa-mundi longe, mina perto
refino · M · jogador: sim · cenários: capital, viagem
- Objetivo: o raio é por jogador e vale em toda cena. 'Visão nesta cena' em quadrados; raio = cena x fator do jogador (slider vira 'x1,0'). Sem valor = hoje.
- Aceite: Mina com 6 quadrados; Eva x1,5 tem círculo maior que Oto; no mapa-mundi os dois veem até a cidade seguinte sem o mestre mexer.
- Arquivos: client/src/types/map.ts, client/src/lib/mapFile.ts, client/src/net/hostSession.ts, client/src/components/MapSettingsDialog.tsx, client/src/components/RoomPanel.tsx

### cenas-em-pastas — Cenas em pastas: região > cidade > bairro > casa, com filtro
feature · G · jogador: não · cenários: viagem
- Objetivo: 27 cenas numa lista plana, duas 'Taverna'. Cena dentro de cena: árvore com recolher, recuo e bolinhas somadas; arrastar sobre outra põe dentro; 'Mover para…'; campo 'Filtrar cenas' com caminho em cinza. Jogador não recebe nada.
- Aceite: Mercado arrastado sobre Porto Cinza fica recuado; recolher mostra as bolinhas; 'tav' mostra as duas Tavernas com caminhos; salva e reabre igual; aventura antiga abre tudo na raiz.
- Arquivos: client/src/lib/adventure.ts, client/src/stores/adventureStore.ts, client/src/components/ScenesSection.tsx, client/src/lib/mapFileIO.ts, client/src/main.css

### duplicar-e-apagar-cena — Duplicar, apagar e reordenar cena
feature · M · jogador: não · cenários: viagem
- Objetivo: não dá para apagar cena criada por engano nem duplicar planta. Menu '…': Duplicar (ids novos, sem fichas de jogador, pinos soltos), 'Apagar cena…' (conta pinos órfãos e recusa com jogador lá), Subir/Descer.
- Aceite: Duplicar 'Casa genérica' cria a cópia abaixo; 'Cena 9' apaga após confirmação; 'PC - Cais' com o grupo mostra os nomes e Apagar desligado; Subir move uma posição.
- Arquivos: client/src/stores/adventureStore.ts, client/src/components/ScenesSection.tsx, client/src/lib/mapFileIO.ts, client/src/lib/entityClone.ts

### escada-leva-a-outro-andar — A escada desenhada leva ao outro andar
refino · M · jogador: sim · cenários: mansao, viagem, crime, vila
- Objetivo: a escada é enfeite e o mestre empilha pino por cima. 'Leva a…' na escada (pede/livre/trancada) cria e mantém um pino ligado invisível e a escada par no destino; tocar a escada abre 'Subir'/'Descer', sem nome de cena.
- Aceite: escada do Térreo 'Leva a: 1º andar', livre: nenhum pino extra e o 1º andar ganha a escada 'desce'. Bruno toca, Passar, chega ao lado da escada de cima. Arrastar a escada leva a ligação.
- Arquivos: client/src/components/StairControls.tsx, client/src/types/map.ts, client/src/lib/pinTravel.ts, client/src/stores/adventureStore.ts, client/src/player/PlayerView.tsx, client/src/lib/fogFilter.ts

## Prioridade 3

### pino-trancado-vira-pedido — Pino de viagem trancado também aceita 'Pedir ao mestre'
feature · P · jogador: sim · cenários: mansao, capital · depende: porta-trancada-vira-pedido
- Objetivo: no pino trancado o cartão não tem botão e o pedido é descartado. Mesmo 'Pedir ao mestre' da porta, com 'Liberar uma vez', 'Passar para pede' e 'Não'; opção 'aceita tentativas' (ligada) mantém passagens mudas.
- Aceite: Diego pede no laboratório; mestre 'Liberar uma vez'; Diego lê 'Você chegou'. Com a opção desligada, nada chega.
- Arquivos: client/src/player/PlayerPinCard.tsx, client/src/components/PinTravelControls.tsx, client/src/net/hostSession.ts, client/src/net/hostBridge.ts

### mostrar-pista-agora — 'Mostrar agora a…': o cartão abre direto na tela do escolhido
feature · P · jogador: sim · cenários: mansao, crime · depende: pino-so-para-escolhidos
- Objetivo: entregar a pista na hora, mesmo longe do pino. 'Mostrar agora a…' marca o jogador em 'Quem vê' e abre o cartão nele; num pedido de Revistar, 'Entregar pista…' lista os pinos secretos da sala.
- Aceite: 'Mostrar agora a Gabi': cartão abre sozinho nela; Diego, na sala, nada. 'Entregar pista… > Carta' num Revistar abre a carta na Gabi.
- Arquivos: client/src/components/PinControls.tsx, client/src/net/hostSession.ts, client/src/net/protocol.ts, client/src/player/PlayerPinCard.tsx, client/src/components/Toast.tsx

### revelar-ficha-e-zona-para-escolhidos — Revelar ficha secreta e zona oculta só para quem descobriu
feature · M · jogador: sim · cenários: castelo, porto, vila · depende: pino-so-para-escolhidos
- Objetivo: revelar a sentinela ou o alçapão mostra a todos. Ficha, escada e zona oculta ganham 'Revelar para…' com chips; sai só para os marcados (ficha ainda exige visão).
- Aceite: sentinela para Ana: aparece nela, não no Duda ao lado. Zona 'Tapete' para Ana: alçapão só nela. Desmarcar: some no próximo pacote.
- Arquivos: client/src/lib/fogFilter.ts, client/src/net/hostSession.ts, client/src/components/PlayerSecretControls.tsx, client/src/components/ConcealZoneControls.tsx, client/src/App.tsx

### painel-de-pistas-do-mestre — Painel 'Pistas': quem recebeu e quem leu cada pista
feature · M · jogador: não · cenários: crime · depende: pino-so-para-escolhidos
- Objetivo: antes do confronto o mestre anota no papel quem leu o quê. Aba Jogo > 'Pistas': linha por pino '!'/'?', bolinha por jogador (vazia, recebeu, leu); clicar na linha centra no pino; clicar na bolinha revela ou esconde.
- Aceite: 'Pistas (7)'; 'Bilhete' cheio para Gabi e Fábio, vazio para Ana. Gabi abre a carta e a bolinha enche na hora. Clicar 'Bilhete' abre o Andar de cima no pino.
- Arquivos: client/src/components/PartySection.tsx, client/src/net/hostSession.ts, client/src/net/protocol.ts, client/src/player/PlayerPinCard.tsx, client/src/stores/adventureStore.ts

### pino-com-nome-e-lista — Pino com nome só do mestre e lista de pinos buscável
refino · M · jogador: não · cenários: crime
- Objetivo: sete '?' iguais; o mestre escreve 'FACA' na descrição que o jogador lê. 'Nome (só mestre)' ao lado do pino no editor e nunca enviado; lista 'Pinos' com busca e filtro por cena.
- Aceite: 'Faca' aparece ao lado do pino; busca 'fac' abre a cena com o pino selecionado; o cartão do Diego mostra só a descrição e o pacote não tem 'Faca'.
- Arquivos: client/src/types/map.ts, client/src/lib/mapFile.ts, client/src/components/PinControls.tsx, client/src/lib/fogFilter.ts, client/src/components/ScenesSection.tsx

### pino-marco-e-so-de-perto — Pino marco (todos veem) e pino que só se lê de perto
feature · M · jogador: sim · cenários: capital, vila
- Objetivo: ninguém acha o Templo que a cidade conhece; a carta é lida da porta. 'Marco: todos veem' (atravessa a névoa sem revelar em volta) e 'Ler só de perto: N casas' (longe, 'Chegue mais perto para ler' e texto não enviado).
- Aceite: Templo marco visível para quem nunca foi, área em volta preta. Carta a 1 casa: Ana na porta lê 'Chegue mais perto'; ao lado da mesa lê o texto; pacote anterior sem descrição.
- Arquivos: client/src/types/map.ts, client/src/lib/mapFile.ts, client/src/lib/fogFilter.ts, client/src/components/PinControls.tsx, client/src/player/PlayerPinCard.tsx

### chave-abre-porta — Chave na mochila abre a porta sem pedir ao mestre
feature · M · jogador: sim · cenários: mansao, porto, capital, crime · depende: item-pegavel
- Objetivo: quem tem a chave ainda grita e espera. Porta e pino trancados ganham 'Abre com: <item>'; quem tem vê 'Usar …', a porta destranca e abre, e o mestre é avisado. O jogador nunca vê que portas a chave abre.
- Aceite: Diego com a chave toca o Escritório: 'Usar Chave do Escudo' abre para todos e o mestre vê o aviso. Ana sem chave: 'Trancada' com 'Pedir ao mestre'.
- Arquivos: client/src/types/map.ts, client/src/lib/mapFile.ts, client/src/components/WallDoorControls.tsx, client/src/net/hostSession.ts, client/src/player/main.tsx

### copia-de-recuperacao — Cópia de recuperação enquanto a sala está aberta
refino · M · jogador: não · cenários: fuga · depende: retomar-mesa-donos
- Objetivo: em 4 h ninguém salva e o notebook desliga. A cada 5 min com sala aberta e cena alterada, cópia ao lado da aventura (nunca no principal), com a mesa; ao abrir, 'Recuperar a sessão de 22:35?'.
- Aceite: mata o processo após 5 min; reabre: 'Recuperar…?'; Recuperar = último ciclo; Descartar = último Salvar; arquivo principal intacto.
- Arquivos: client/src/App.tsx, client/src/stores/adventureStore.ts, client/src/lib/mapFileIO.ts

### aba-jogo-compacta — Aba Jogo cabe na tela com 7 jogadores
refino · M · jogador: não · cenários: crime, fuga, mansao* · depende: atribuir-livres-primeiro
- Objetivo: ~50 controles empilhados e o Grupo mostra 4 linhas. Linhas de uma altura com os controles raros em 'Mais'; quem aguarda no topo e aberto; dica uma vez.
- Aceite: 7 jogadores em 1280x800 sem rolar; 'Mais' no Bruno mostra raio, planta, Expulsar; Esc fecha; testes 'Atribuir X' seguem passando.
- Arquivos: client/src/components/RoomPanel.tsx, client/src/components/PartySection.tsx, client/src/main.css

### atencao-do-mestre — Chegadas agrupadas num aviso só e cena que espera há mais tempo
refino · M · jogador: não · cenários: mansao*, porto
- Objetivo: cinco cartões 'X entrou em Y' cobrem o mapa até serem dispensados um a um; Fábio espera 12 min sem ninguém ver. Um cartão por cena que some sozinho; 'há 12 min' na lista Cenas (âmbar após 10) e Ctrl+J abre a que espera mais.
- Aceite: 3 chegadas ao Porão = um cartão com Ir lá. 11 min nas Docas: 'Capitania há 11 min' em âmbar; Ctrl+J abre a Capitania no Fábio e zera.
- Arquivos: client/src/net/hostBridge.ts, client/src/components/Toast.tsx, client/src/stores/toastStore.ts, client/src/components/ScenesSection.tsx, client/src/App.tsx

### reunir-grupo-por-cena — 'Reunir o grupo' mostra onde cada um está e marca por cena
refino · P · jogador: não · cenários: viagem
- Objetivo: a lista abre com os 7 marcados e o mestre traz quem estava longe. Linhas agrupadas por cena com caixa por grupo; quem já está aqui por último, desmarcado.
- Aceite: 'PC - Cais (3)' e 'Sobrado (3)'; desmarca o Sobrado num clique; Reunir traz só os 3 do Cais.
- Arquivos: client/src/components/GatherControls.tsx, client/src/lib/gatherParty.ts

### montaria-viaja-junto — Montaria e familiar viajam com o dono
defeito · M · jogador: sim · cenários: viagem · depende: chegada-em-casa-livre
- Objetivo: a viagem leva só uma ficha do jogador; pônei e coruja ficam na estrada. Fichas do mesmo jogador a até 2 casas vão junto; ficha em outra cena gera 'Faísca ficou em outra cena' com Trazer.
- Aceite: lado a lado, as duas chegam; com Faísca longe, a linha do Bruno avisa e Trazer a põe ao lado dele.
- Arquivos: client/src/net/hostSession.ts, client/src/lib/party.ts, client/src/lib/gatherParty.ts, client/src/components/PartySection.tsx

### gestos-rapidos-do-editor — Porta, zona oculta e segredo em lote sem trocar de ferramenta
refino · M · jogador: não · cenários: vila, vila*, castelo
- Objetivo: destrancar custa 4-5 gestos, Selecionar pega a sala em vez da zona oculta, revelar 4 guardas é um clique por ficha. Clique direito na porta (Abrir/Fechar, Trancar/Destrancar); Selecionar prioriza a zona oculta; 'Oculto para jogadores' em lote com 3 estados e um desfazer.
- Aceite: clique direito na porta > Destrancar muda a porta; Esc não muda nada. Clique no tapete mostra 'Zona oculta'. 4 guardas selecionados > Oculto: somem; Ctrl+Z desfaz os 4.
- Arquivos: client/src/pixi/PixiCanvas.tsx, client/src/lib/selectionHitTest.ts, client/src/lib/concealZones.ts, client/src/components/SelectionControls.tsx, client/src/stores/mapStore.ts

### busca-nos-seletores-de-cena — Busca e caminho nos seletores 'Mandar para…' e 'Leva a…'
refino · P · jogador: não · cenários: viagem
- Objetivo: achar a cena num select de 26 nomes. Lista com busca (foco no campo), caminho em cinza, setas e Enter; cenas com gente primeiro no 'Mandar para…'.
- Aceite: 'vell s' deixa 'Sobrado' com o caminho; Enter lista os pinos de chegada; 'tav' no 'Leva a…' mostra as duas Tavernas.
- Arquivos: client/src/components/PartySection.tsx, client/src/components/PinTravelControls.tsx, client/src/stores/adventureStore.ts

### cena-nova-pelo-leva-a — 'Leva a…' cria a cena nova ali mesmo
feature · M · jogador: não · cenários: viagem
- Objetivo: 14 casas, 6 passos cada. '+ Cena nova…' no 'Leva a…' cria a cena, o pino de chegada no centro, liga as pontas e deixa o mestre onde estava.
- Aceite: 'Casa do ferreiro' + Enter: tela continua em Porto Cinza, painel 'Leva a Casa do ferreiro', lista ganha a casa com o pino par no centro.
- Arquivos: client/src/components/PinTravelControls.tsx, client/src/stores/adventureStore.ts, client/src/App.tsx

### nome-da-cena-para-jogador — 'Onde estou': nome público da cena, se o mestre quiser
feature · M · jogador: sim · cenários: mansao
- Objetivo: corredores parecidos, o jogador não sabe o andar. 'Nome para os jogadores' opcional; preenchido, selo só com a cena onde ele está; nome interno nunca vai ao fio.
- Aceite: '1º andar' preenchido, Porão vazio: selo muda Térreo/1º andar e some no Porão; nenhum pacote traz nome interno.
- Arquivos: client/src/lib/adventure.ts, client/src/components/ScenesSection.tsx, client/src/lib/fogFilter.ts, client/src/net/hostSession.ts, client/src/player/PlayerView.tsx

### cena-escura — Cena (ou sala) escura: só se vê onde há luz
feature · M · jogador: sim · cenários: mansao, porto, capital, viagem, castelo, vila
- Objetivo: luz é enfeite; mina e porão ficam claros como o pátio. 'Escura' na cena e na sala: raio mínimo de 1 casa mais áreas de Luz acesa na linha de visão, mesmo além do raio. Estilo chapado.
- Aceite: Porão escuro: Carla vê só a casa dela; caldeira acesa vista de longe, corredor entre elas preto; atrás de parede nada. Quarto escuro: Duda vê só a soleira.
- Arquivos: client/src/types/map.ts, client/src/lib/fogFilter.ts, client/src/lib/visibility.ts, client/src/components/MapSettingsDialog.tsx, client/src/components/RoomControls.tsx, client/src/components/LightControls.tsx

### luz-na-ficha — Tocha ou lanterna presa à ficha, e 'vê no escuro'
feature · M · jogador: sim · cenários: mansao, porto, capital, viagem, castelo, vila · depende: cena-escura
- Objetivo: a tocha do clérigo não ilumina nem anda. Luz 'Presa à ficha' (anda e ilumina para quem vê) e 'Vê no escuro: N casas' na ficha.
- Aceite: 'Tocha 4' no Oto acende em volta dele na tela da Eva e segue o corredor. Gina com 'Vê no escuro: 6' vê 6 casas sem luz.
- Arquivos: client/src/types/map.ts, client/src/components/LightControls.tsx, client/src/components/PropertiesPanel.tsx, client/src/lib/fogFilter.ts, client/src/pixi/drawLights.ts

### janela-grade-e-espiar — Janela e grade deixam ver sem passar, e espiar prédio com teto
feature · G · jogador: sim · cenários: mansao, porto, viagem
- Objetivo: grade fechada tapa a visão, não há janela, e janela ou porta aberta de prédio com teto não mostra nada. Grade fechada deixa ver; parede 'Janela' (traço duplo fino); ficha junto ao vão recebe só o interior que o olhar alcança; 'Espiar' em porta fechada dá cone de 5 s só a quem espiou, com aviso ao mestre.
- Aceite: grade da adega: Carla vê e não passa. Janela do armazém: cone do interior para Ana, resto silhueta, não atravessa. 'Espiar' no escritório: cone 5 s, porta fechada para todos, mestre vê 'Ana espiou'.
- Arquivos: client/src/lib/visibility.ts, client/src/lib/collision.ts, client/src/lib/fogFilter.ts, client/src/components/WallStyleControls.tsx, client/src/pixi/drawWalls.ts, client/src/pixi/drawDoors.ts

### iniciativa-e-vez — Ordem de iniciativa na cena, e só quem está na vez move
feature · G · jogador: sim · cenários: castelo
- Objetivo: iniciativa no papel e o bárbaro anda 15 quadrados na vez do outro. Painel 'Combate': fichas da cena, iniciativa, ordenar, 'Próxima vez'; na vez de um jogador só ele move; faixa 'Sua vez' / 'Vez de <nome visível>' / 'Vez do mestre'.
- Aceite: 18/12/9 ordenados, Começar: Fábio vê 'Vez de Torvald' e o arrasto volta com 'Espere sua vez'; na vez dele, 'Sua vez' e anda; guarda escondido mostra 'Vez do mestre'.
- Arquivos: client/src/net/hostSession.ts, client/src/net/protocol.ts, client/src/lib/moveValidation.ts, client/src/player/main.tsx, client/src/components/ScenesSection.tsx, client/src/App.tsx

### porta-de-um-lado — Porta que só abre de um lado
feature · M · jogador: não · cenários: castelo
- Objetivo: a porta do posto abre por fora. 'Abre por: os dois lados | só deste lado' com seta no editor; do lado errado, 'Não abre deste lado'. Mapa antigo abre dos dois lados.
- Aceite: Fábio de fora lê 'Não abre deste lado'; Bruno de dentro abre; mapa salvo antes igual a hoje.
- Arquivos: client/src/types/map.ts, client/src/lib/mapFile.ts, client/src/net/hostSession.ts, client/src/net/protocol.ts, client/src/components/WallDoorControls.tsx, client/src/player/main.tsx

### esconder-se — Esconder-se: a ficha do jogador some para os outros jogadores
feature · M · jogador: sim · cenários: porto, viagem · depende: chamar-o-mestre
- Objetivo: só o mestre esconde ficha, e de todos. 'Esconder' no painel vira pedido; aceito, some dos outros jogadores, esmaecida para o dono, anel tracejado no mestre com 'Revelar para todos'; mover não desfaz.
- Aceite: Duda esconde, mestre deixa: some para o Enzo, esmaecida para ela; anda e segue escondida; 'Revelar para todos' a devolve ao Enzo.
- Arquivos: client/src/types/map.ts, client/src/lib/fogFilter.ts, client/src/net/protocol.ts, client/src/net/hostSession.ts, client/src/player/PlayerPanel.tsx, client/src/pixi/drawTokens.ts

### andar-ate-aqui — 'Andar até aqui' pelas ruas que o jogador conhece
refino · M · jogador: não · cenários: capital · depende: so-a-propria-ficha-arrasta, acoes-no-ponto
- Objetivo: com prédio no meio o arrasto é recusado e o jogador anda esquina a esquina. No menu do toque longo, 'Andar até aqui' calcula o caminho só com o que ele já conhece e envia em trechos validados pelo host.
- Aceite: 390x844, segura no beco > 'Andar até aqui': a ficha dobra as esquinas e para no beco, igual no mestre. Área preta: item desabilitado 'Você não conhece o caminho'.
- Arquivos: client/src/player/PlayerView.tsx, client/src/player/playerConnection.ts, client/src/lib/collision.ts

### marca-olhem-aqui — Sinal na cor da ficha e marca 'vamos para cá' que fica
feature · M · jogador: sim · cenários: capital, fuga
- Objetivo: o sinal dura 3 s e tem cor sorteada (duas iguais quase sempre com 7). Sinal na cor da ficha com o nome; uma bandeirinha de destino por jogador que fica até ele tirar, vista pelo mestre e por quem está na mesma cena e conhece o ponto; Grupo mostra 'destino marcado' com Ver.
- Aceite: Bruno (vermelho) sinaliza: ondas vermelhas com 'Bruno'. Elisa marca destino: fica após 10 s, mesma cena vê, outra não; mestre vê e 'Ver' centra; 'Tirar marca' some nas três telas.
- Arquivos: client/src/lib/signals.ts, client/src/net/protocol.ts, client/src/net/hostSession.ts, client/src/pixi/drawSignals.ts, client/src/player/PlayerView.tsx, client/src/components/PartySection.tsx

### movimento-contado — Quadrados no arrasto, passo máximo e fichas que ocupam espaço
refino · G · jogador: não · cenários: castelo, porto · depende: so-a-propria-ficha-arrasta
- Objetivo: o jogador pergunta quantos quadrados andou; alguém arrasta 30 casas; fichas param sobre o guarda. 'N quadrados' no arrasto da própria ficha; 'Passo máximo' por cena (para no último ponto válido, círculo de alcance); 'Fichas ocupam espaço' (recusa 'Lugar ocupado'). Mestre sem limite.
- Aceite: '6 quadrados' junto ao dedo, igual ao Medir. Passo 6 nas Docas: 30 casas param a 6; Mercado livre. Com ocupação: soltar sobre o guarda volta com 'Lugar ocupado'.
- Arquivos: client/src/player/PlayerView.tsx, client/src/lib/tokenDragDistance.ts, client/src/pixi/drawMeasurementIndicator.ts, client/src/lib/moveValidation.ts, client/src/net/hostSession.ts, client/src/components/MapSettingsDialog.tsx

## Prioridade 2

### objeto-com-imagem-ou-rotulo — Objeto com rótulo curto ou imagem para o jogador
feature · M · jogador: sim · cenários: vila, mansao, crime, viagem · depende: objetos-como-silhueta
- Objetivo: a silhueta não diz o que é. 'Rótulo para jogadores' e 'Mostrar imagem ao jogador' (cópia pequena com teto, como a foto da ficha).
- Aceite: 'Guarda-roupa' aparece na silhueta da Elisa; piano com imagem na posição e rotação do editor para o Diego; com teto fechado, nada.
- Arquivos: client/src/types/map.ts, client/src/lib/mapFile.ts, client/src/lib/fogFilter.ts, client/src/lib/tokenPhoto.ts, client/src/player/PlayerView.tsx, client/src/components/PropertiesPanel.tsx

### criar-andar-de-cima — Criar andar de cima ou de baixo a partir do prédio, e escada em espiral
refino · M · jogador: não · cenários: vila, castelo · depende: escada-leva-a-outro-andar
- Objetivo: torre de 3 andares = redesenhar contorno e ligar 6 pinos. 'Criar andar de cima/de baixo' copia a parede externa e liga a escada par; forma 'Espiral' na escada.
- Aceite: 'Casa do prefeito – andar de cima' com o mesmo contorno; Duda passa e chega no mesmo ponto; 'Espiral' desenha círculo com raios finos.
- Arquivos: client/src/stores/adventureStore.ts, client/src/lib/adventure.ts, client/src/lib/pinTravel.ts, client/src/components/StairControls.tsx, client/src/pixi/drawStairs.ts, client/src/types/map.ts

### estado-na-ficha — Estado visível na ficha: caído, preso, desacordado
feature · M · jogador: sim · cenários: castelo
- Objetivo: o mestre pinta o guarda de cinza como gambiarra. Estados fixos (caído, preso, desacordado, invisível) como selo de linha fina na borda, iguais para mestre e jogador.
- Aceite: 'Desacordado' no guarda: selo no editor e em quem o vê; desmarca e some nas duas telas.
- Arquivos: client/src/types/map.ts, client/src/lib/mapFile.ts, client/src/pixi/drawTokens.ts, client/src/player/PlayerView.tsx, client/src/components/PropertiesPanel.tsx

### lugares-no-painel-do-jogador — 'Lugares': pontos conhecidos e lugares onde já estive
feature · M · jogador: sim · cenários: capital, viagem
- Objetivo: o jogador não sabe para onde dá para ir nem revê a cidade que explorou. 'Lugares' lista pinos recebidos na cena (toque centra) e miniaturas das cenas visitadas só com o que ele explorou, nomeadas por ele; nenhum nome do mestre sai.
- Aceite: 'Portas do Templo' centra a câmera; pino na névoa não aparece. Eva vê 4 miniaturas, renomeia 'Lugar 2' para 'Mercado', abre grande, Fechar volta.
- Arquivos: client/src/player/PlayerPanel.tsx, client/src/player/main.tsx, client/src/net/hostSession.ts, client/src/net/protocol.ts, client/src/player/playerConnection.ts

### anotacao-pessoal — Anotação pessoal do jogador no próprio mapa
feature · M · jogador: não · cenários: vila
- Objetivo: marcar 'baú trancado aqui' sem o sinal de 3 s. 'Anotar' cria ponto com 40 caracteres, guardado só no aparelho, nunca enviado; 'Minhas notas' lista e centraliza.
- Aceite: Fabi anota ao lado do baú; Bruno não vê; recarrega e continua; toque longo apaga.
- Arquivos: client/src/player/PlayerPanel.tsx, client/src/player/PlayerView.tsx, client/src/player/main.tsx

### cartao-e-rotulo-legiveis — Cartão de pino sem imagem compacto e rótulo do cômodo legível
refino · P · jogador: não · cenários: vila*
- Objetivo: cartão sem imagem abre com um retângulo preto; o nome do cômodo fica sob o nome da ficha. Sem imagem, só glifo, texto e botões; rótulo vai para a borda superior quando há ficha no ponto.
- Aceite: pino sem imagem abre compacto com o texto na 1ª linha; com imagem igual a hoje. 'Quarto do Prefeito' e 'Ladino' legíveis com a ficha no centro.
- Arquivos: client/src/player/PlayerPinCard.tsx, client/src/player/player.css, client/src/pixi/drawRoomNames.ts

### medir-host-com-7-jogadores — Medir o custo do mestre com 7 jogadores numa máquina limpa
refino · M · jogador: não · cenários: vila*
- Objetivo: tarefas de 1-1,6 s no mestre com 7 jogadores, medidas com a CPU a 100% por outras cargas (não prova defeito). Medir com 1/4/7 numa máquina ociosa; se passar de ~100 ms, recalcular só a cena afetada e reaproveitar visão de quem não se mexeu.
- Aceite: máquina ociosa, 7 na mesma cena: nenhum movimento gera tarefa acima de 100 ms e o mestre digita sem atraso; medida registrada com comando e saída.
- Arquivos: client/src/net/hostSession.ts, client/src/lib/fogFilter.ts, client/src/net/hostBridge.ts
