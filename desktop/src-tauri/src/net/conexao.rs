//! Conexões HTTP da sala com prazos, corte e teto (SONS AO VIVO, F5a,
//! correções das auditorias de 23/10).
//!
//! Sem prazo, uma aba congelada (ou um jogador que anuncia janela TCP zero)
//! segurava para sempre a vaga de `/sons/{id}` e os até 15 MB do corpo. Aqui:
//! - `ComPrazoDeEscrita`: uma escrita pendente sem NENHUM byte saindo por
//!   `PRAZO_SEM_PROGRESSO` é erro; a conexão cai e o corpo (com a vaga) é solto.
//!   O relógio vence antes, no prazo total da resposta, se ele chegar primeiro.
//! - `Corte`: o lado de fora derruba a conexão (queda ou kick do dono da chave)
//!   ou marca o prazo total da resposta em curso, conferido a cada escrita.
//! - Prazo do cabeçalho: do aceite (e do fim de cada resposta) até o pedido
//!   chegar ao roteador. O `axum::serve` monta o hyper sem relógio, então o
//!   `header_read_timeout` do hyper não vale; quem mede é a leitura do socket.
//! - `ListenerDaSala`: no máximo `CONEXOES_MAX` conexões; a excedente é fechada
//!   no aceite.

use std::future::Future;
use std::io;
use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll, Waker};
use std::time::{Duration, Instant};

use axum::body::{Body, HttpBody};
use axum::extract::connect_info::Connected;
use axum::extract::{ConnectInfo, Request};
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::Response;
use axum::serve::{IncomingStream, Listener};
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use tokio::time::Sleep;

use super::server::lock;

/// Escrita pendente sem nenhum byte saindo por este tempo derruba a conexão.
pub const PRAZO_SEM_PROGRESSO: Duration = Duration::from_secs(30);
/// Do aceite (ou do fim da resposta anterior, keep-alive) até o cabeçalho do
/// pedido chegar ao roteador. Bytes gotejando não renovam.
pub const PRAZO_DO_CABECALHO: Duration = Duration::from_secs(10);
/// Conexões abertas ao mesmo tempo na sala (jogadores, TV, túnel, buscas).
pub const CONEXOES_MAX: usize = 128;

/// Os limites de toda conexão da sala; os testes encurtam os prazos.
#[derive(Debug, Clone, Copy)]
pub struct LimitesDaSala {
    pub sem_progresso: Duration,
    pub cabecalho: Duration,
    pub conexoes: usize,
}

impl Default for LimitesDaSala {
    fn default() -> Self {
        Self { sem_progresso: PRAZO_SEM_PROGRESSO, cabecalho: PRAZO_DO_CABECALHO, conexoes: CONEXOES_MAX }
    }
}

/// O que derruba UMA conexão de fora dela. Compartilhado entre o socket
/// (`ComPrazoDeEscrita`) e as rotas (`ConexaoHttp`).
#[derive(Debug, Default)]
pub struct Corte {
    cortada: AtomicBool,
    /// A tarefa da conexão, quando está esperando o socket aceitar bytes.
    acordar: Mutex<Option<Waker>>,
    /// Prazo total da resposta em curso (`None` = nenhuma resposta com prazo).
    vence_em: Mutex<Option<Instant>>,
    /// Prazo do cabeçalho de cada pedido (`None` = sem prazo, só nos testes).
    prazo_do_cabecalho: Option<Duration>,
    /// Até quando o cabeçalho do próximo pedido tem de chegar (`None` = pedido
    /// em curso, conexão que virou WebSocket ou conexão sem prazo).
    cabecalho_ate: Mutex<Option<Instant>>,
    /// A resposta saiu do roteador; ela só acaba quando o socket escoar.
    resposta_saiu: AtomicBool,
}

impl Corte {
    /// Corte de conexão da sala: o prazo do cabeçalho já corre desde o aceite.
    fn com_prazo_do_cabecalho(prazo: Duration) -> Self {
        let corte = Self { prazo_do_cabecalho: Some(prazo), ..Self::default() };
        corte.esperar_cabecalho();
        corte
    }

    /// Derruba a conexão: a próxima escrita é erro, e a escrita parada acorda.
    pub fn cortar(&self) {
        self.cortada.store(true, Ordering::SeqCst);
        if let Some(acordar) = lock(&self.acordar).take() {
            acordar.wake();
        }
    }

    pub fn cortada(&self) -> bool {
        self.cortada.load(Ordering::SeqCst)
    }

    /// Prazo total da resposta em curso. HTTP/1: uma resposta por vez na conexão.
    pub fn definir_prazo(&self, vence_em: Option<Instant>) {
        *lock(&self.vence_em) = vence_em;
    }

    fn vence_em(&self) -> Option<Instant> {
        *lock(&self.vence_em)
    }

    /// O erro que a próxima escrita devolve, se a conexão tem de cair.
    pub fn erro(&self) -> Option<io::Error> {
        if self.cortada() {
            return Some(io::Error::new(io::ErrorKind::ConnectionAborted, "conexão cortada"));
        }
        self.vence_em()
            .filter(|vence| Instant::now() >= *vence)
            .map(|_| io::Error::new(io::ErrorKind::TimedOut, "prazo total da resposta"))
    }

    /// O cabeçalho do pedido chegou ao roteador: o prazo do cabeçalho sai.
    pub fn cabecalho_chegou(&self) {
        *lock(&self.cabecalho_ate) = None;
    }

    /// A resposta (que não é o 101 do WebSocket) saiu do roteador. O prazo
    /// total FICA: o hyper ainda guarda até ~400 KB dela para escrever.
    pub fn resposta_saiu(&self) {
        self.resposta_saiu.store(true, Ordering::SeqCst);
    }

    /// O socket escoou tudo (o hyper só chama o `poll_flush` do socket com o
    /// buffer dele vazio). Se a resposta já tinha saído, ela acabou de
    /// verdade: o prazo total sai e a espera do próximo cabeçalho começa.
    fn escoou(&self) {
        if self.resposta_saiu.swap(false, Ordering::SeqCst) {
            self.definir_prazo(None);
            self.esperar_cabecalho();
        }
    }

    fn esperar_cabecalho(&self) {
        if let Some(prazo) = self.prazo_do_cabecalho {
            let agora = Instant::now();
            // Prazo que não cabe no relógio vence já: o lado seguro.
            *lock(&self.cabecalho_ate) = Some(agora.checked_add(prazo).unwrap_or(agora));
        }
    }

    fn cabecalho_ate(&self) -> Option<Instant> {
        *lock(&self.cabecalho_ate)
    }

    fn vigiar(&self, cx: &Context<'_>) {
        *lock(&self.acordar) = Some(cx.waker().clone());
    }
}

/// Socket com prazos: o relógio de escrita arma na escrita que fica pendente e
/// desarma a cada byte que sai; o de leitura vale só enquanto a conexão espera
/// o cabeçalho de um pedido. Conexão sem escrita pendente e fora da espera do
/// cabeçalho não tem prazo; o WebSocket de quem só está ouvindo não cai.
pub struct ComPrazoDeEscrita<T> {
    interno: T,
    prazo: Duration,
    relogio: Option<Pin<Box<Sleep>>>,
    relogio_do_cabecalho: Option<Pin<Box<Sleep>>>,
    corte: Arc<Corte>,
    /// A vaga da sala (`CONEXOES_MAX`): volta quando a conexão cai.
    _vaga: Option<OwnedSemaphorePermit>,
}

impl<T> ComPrazoDeEscrita<T> {
    /// Só o prazo de escrita, sem prazo do cabeçalho nem vaga.
    pub fn novo(interno: T, prazo: Duration) -> Self {
        Self::montar(interno, prazo, Corte::default(), None)
    }

    /// Conexão da sala: prazo de escrita, prazo do cabeçalho desde já e a vaga.
    pub fn da_sala(interno: T, limites: LimitesDaSala, vaga: Option<OwnedSemaphorePermit>) -> Self {
        Self::montar(interno, limites.sem_progresso, Corte::com_prazo_do_cabecalho(limites.cabecalho), vaga)
    }

    fn montar(interno: T, prazo: Duration, corte: Corte, vaga: Option<OwnedSemaphorePermit>) -> Self {
        Self { interno, prazo, relogio: None, relogio_do_cabecalho: None, corte: Arc::new(corte), _vaga: vaga }
    }

    pub fn corte(&self) -> Arc<Corte> {
        self.corte.clone()
    }

    fn depois_da_escrita(&mut self, cx: &mut Context<'_>, escrita: Poll<io::Result<usize>>) -> Poll<io::Result<usize>> {
        match escrita {
            Poll::Ready(Ok(escritos)) if escritos > 0 => {
                self.relogio = None;
                Poll::Ready(Ok(escritos))
            }
            Poll::Ready(outra) => Poll::Ready(outra),
            Poll::Pending => {
                self.corte.vigiar(cx);
                // Corte que chegou entre a olhada antes da escrita e o `vigiar`.
                if let Some(erro) = self.corte.erro() {
                    return Poll::Ready(Err(erro));
                }
                let prazo = self.prazo;
                // `sleep` pede o relógio do tokio: este socket só existe dentro
                // do `axum::serve` (e dos `#[tokio::test]`), com `time` ligado.
                let relogio = self.relogio.get_or_insert_with(|| Box::pin(tokio::time::sleep(prazo)));
                // O relógio vence no que chegar primeiro: o prazo sem progresso
                // ou o prazo total da resposta (sem isto, até 30 s depois dele).
                let total = self.corte.vence_em().map(tokio::time::Instant::from_std);
                if let Some(total) = total.filter(|total| *total < relogio.deadline()) {
                    relogio.as_mut().reset(total);
                }
                match relogio.as_mut().poll(cx) {
                    Poll::Ready(()) => Poll::Ready(Err(io::Error::new(io::ErrorKind::TimedOut, "escrita parada"))),
                    Poll::Pending => Poll::Pending,
                }
            }
        }
    }
}

fn erro_do_cabecalho() -> io::Error {
    io::Error::new(io::ErrorKind::TimedOut, "cabeçalho do pedido não chegou no prazo")
}

impl<T: AsyncWrite + Unpin> AsyncWrite for ComPrazoDeEscrita<T> {
    fn poll_write(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &[u8]) -> Poll<io::Result<usize>> {
        let this = self.get_mut();
        if let Some(erro) = this.corte.erro() {
            return Poll::Ready(Err(erro));
        }
        let escrita = Pin::new(&mut this.interno).poll_write(cx, buf);
        this.depois_da_escrita(cx, escrita)
    }

    fn poll_write_vectored(self: Pin<&mut Self>, cx: &mut Context<'_>, bufs: &[io::IoSlice<'_>]) -> Poll<io::Result<usize>> {
        let this = self.get_mut();
        if let Some(erro) = this.corte.erro() {
            return Poll::Ready(Err(erro));
        }
        let escrita = Pin::new(&mut this.interno).poll_write_vectored(cx, bufs);
        this.depois_da_escrita(cx, escrita)
    }

    fn is_write_vectored(&self) -> bool {
        self.interno.is_write_vectored()
    }

    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        let this = self.get_mut();
        let feito = Pin::new(&mut this.interno).poll_flush(cx);
        if matches!(feito, Poll::Ready(Ok(()))) {
            this.corte.escoou();
        }
        feito
    }

    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().interno).poll_shutdown(cx)
    }
}

impl<T: AsyncRead + Unpin> AsyncRead for ComPrazoDeEscrita<T> {
    fn poll_read(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &mut ReadBuf<'_>) -> Poll<io::Result<()>> {
        let this = self.get_mut();
        let Some(limite) = this.corte.cabecalho_ate() else {
            this.relogio_do_cabecalho = None;
            return Pin::new(&mut this.interno).poll_read(cx, buf);
        };
        if Instant::now() >= limite {
            return Poll::Ready(Err(erro_do_cabecalho()));
        }
        let leitura = Pin::new(&mut this.interno).poll_read(cx, buf);
        if leitura.is_ready() {
            return leitura;
        }
        let alvo = tokio::time::Instant::from_std(limite);
        let relogio = this.relogio_do_cabecalho.get_or_insert_with(|| Box::pin(tokio::time::sleep_until(alvo)));
        if relogio.deadline() != alvo {
            relogio.as_mut().reset(alvo);
        }
        match relogio.as_mut().poll(cx) {
            Poll::Ready(()) => Poll::Ready(Err(erro_do_cabecalho())),
            Poll::Pending => Poll::Pending,
        }
    }
}

/// O `TcpListener` da sala: toda conexão aceita sai com os prazos e uma vaga.
pub struct ListenerDaSala {
    interno: TcpListener,
    limites: LimitesDaSala,
    vagas: Arc<Semaphore>,
}

impl ListenerDaSala {
    pub fn novo(interno: TcpListener, limites: LimitesDaSala) -> Self {
        // `Semaphore::new` não aceita mais que `MAX_PERMITS`.
        let vagas = Arc::new(Semaphore::new(limites.conexoes.min(Semaphore::MAX_PERMITS)));
        Self { interno, limites, vagas }
    }
}

impl Listener for ListenerDaSala {
    type Io = ComPrazoDeEscrita<TcpStream>;
    type Addr = SocketAddr;

    async fn accept(&mut self) -> (Self::Io, Self::Addr) {
        loop {
            // O `accept` do axum já trata e repete os erros de aceitação.
            let (io, par) = Listener::accept(&mut self.interno).await;
            // Sala cheia: a conexão excedente cai no `drop`, sem ler nada.
            if let Ok(vaga) = self.vagas.clone().try_acquire_owned() {
                return (ComPrazoDeEscrita::da_sala(io, self.limites, Some(vaga)), par);
            }
        }
    }

    fn local_addr(&self) -> io::Result<Self::Addr> {
        Listener::local_addr(&self.interno)
    }
}

/// `ConnectInfo` das rotas da sala: o endereço do par e o corte da conexão.
#[derive(Debug, Clone)]
pub struct ConexaoHttp {
    pub par: SocketAddr,
    pub corte: Arc<Corte>,
}

impl Connected<IncomingStream<'_, ListenerDaSala>> for ConexaoHttp {
    fn connect_info(conexao: IncomingStream<'_, ListenerDaSala>) -> Self {
        Self { par: *conexao.remote_addr(), corte: conexao.io().corte() }
    }
}

/// Middleware de toda rota da sala: o pedido chegou (o prazo do cabeçalho
/// sai) e, menos no 101 do WebSocket, o fim do corpo da resposta avisa o
/// `Corte` (o prazo total sai e o do próximo cabeçalho começa quando o
/// socket escoar).
pub async fn vigiar_pedido(pedido: Request, proximo: Next) -> Response {
    let corte = pedido.extensions().get::<ConnectInfo<ConexaoHttp>>().map(|info| info.0.corte.clone());
    if let Some(corte) = &corte {
        corte.cabecalho_chegou();
    }
    let resposta = proximo.run(pedido).await;
    match corte {
        // 101: a conexão vira WebSocket e nunca volta a esperar cabeçalho.
        Some(corte) if resposta.status() != StatusCode::SWITCHING_PROTOCOLS => {
            resposta.map(|corpo| Body::new(CorpoVigiado { corpo, corte }))
        }
        _ => resposta,
    }
}

/// O corpo de uma resposta, que avisa o `Corte` quando é solto (acabou de
/// sair, o cliente desistiu ou a conexão caiu).
struct CorpoVigiado {
    corpo: Body,
    corte: Arc<Corte>,
}

impl Drop for CorpoVigiado {
    fn drop(&mut self) {
        self.corte.resposta_saiu();
    }
}

impl HttpBody for CorpoVigiado {
    type Data = <Body as HttpBody>::Data;
    type Error = <Body as HttpBody>::Error;

    fn poll_frame(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<Result<http_body::Frame<Self::Data>, Self::Error>>> {
        Pin::new(&mut self.get_mut().corpo).poll_frame(cx)
    }

    fn is_end_stream(&self) -> bool {
        self.corpo.is_end_stream()
    }

    fn size_hint(&self) -> http_body::SizeHint {
        self.corpo.size_hint()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    type Resultado = Result<(), Box<dyn std::error::Error>>;

    /// Mutação vermelha: sem o relógio, a escrita parada espera para sempre.
    #[tokio::test]
    async fn escrita_parada_cai_no_prazo() -> Resultado {
        let (servidor, _cliente) = tokio::io::duplex(64);
        let mut io = ComPrazoDeEscrita::novo(servidor, Duration::from_millis(300));
        io.write_all(&[0; 64]).await?;
        let inicio = Instant::now();
        let escrita = tokio::time::timeout(Duration::from_secs(10), io.write_all(&[1])).await?;
        assert_eq!(escrita.err().map(|erro| erro.kind()), Some(io::ErrorKind::TimedOut));
        assert!(inicio.elapsed() >= Duration::from_millis(250), "caiu antes do prazo: {:?}", inicio.elapsed());
        Ok(())
    }

    /// 25 pedaços lidos a cada 100 ms: 2,5 s escrevendo com prazo de 1 s. Só
    /// passa porque cada byte que sai desarma o relógio (mutação vermelha: não
    /// desarmar).
    #[tokio::test]
    async fn cada_byte_que_sai_renova_o_prazo() -> Resultado {
        const PEDACO: usize = 16;
        const VEZES: usize = 25;
        let (servidor, mut cliente) = tokio::io::duplex(PEDACO);
        let mut io = ComPrazoDeEscrita::novo(servidor, Duration::from_secs(1));
        let leitor = tokio::spawn(async move {
            let mut buf = [0u8; PEDACO];
            for _ in 0..VEZES {
                tokio::time::sleep(Duration::from_millis(100)).await;
                cliente.read_exact(&mut buf).await?;
            }
            Ok::<_, io::Error>(())
        });
        io.write_all(&[7u8; PEDACO * VEZES]).await?;
        leitor.await??;
        Ok(())
    }

    /// Mutação vermelha: `cortar` sem acordar a escrita parada (ela só veria o
    /// corte quando outra coisa a acordasse, aqui o `timeout` de 10 s).
    #[tokio::test]
    async fn corte_derruba_a_escrita_parada_na_hora() -> Resultado {
        let (servidor, _cliente) = tokio::io::duplex(8);
        let mut io = ComPrazoDeEscrita::novo(servidor, Duration::from_secs(60));
        let corte = io.corte();
        io.write_all(&[0; 8]).await?;
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(100)).await;
            corte.cortar();
        });
        let inicio = Instant::now();
        let escrita = tokio::time::timeout(Duration::from_secs(10), io.write_all(&[1])).await?;
        assert_eq!(escrita.err().map(|erro| erro.kind()), Some(io::ErrorKind::ConnectionAborted));
        assert!(inicio.elapsed() < Duration::from_secs(5), "o corte só valeu em {:?}", inicio.elapsed());
        Ok(())
    }

    /// O prazo total vale na escrita seguinte, mesmo com o socket livre; sem
    /// prazo (a próxima resposta da mesma conexão), volta a escrever.
    #[tokio::test]
    async fn prazo_total_vencido_recusa_a_proxima_escrita() -> Resultado {
        let (servidor, _cliente) = tokio::io::duplex(64);
        let mut io = ComPrazoDeEscrita::novo(servidor, Duration::from_secs(60));
        io.write_all(b"antes").await?;
        io.corte().definir_prazo(Some(Instant::now()));
        assert_eq!(io.write_all(b"depois").await.err().map(|erro| erro.kind()), Some(io::ErrorKind::TimedOut));
        io.corte().definir_prazo(None);
        io.write_all(b"de novo").await?;
        Ok(())
    }

    /// Escrita parada com o prazo total a 300 ms e o sem progresso a 60 s: cai
    /// no total, não 30 s depois dele (auditoria, achado 3). Mutação vermelha:
    /// o relógio só com o prazo sem progresso.
    #[tokio::test]
    async fn prazo_total_vence_a_escrita_parada_antes_do_prazo_sem_progresso() -> Resultado {
        let (servidor, _cliente) = tokio::io::duplex(64);
        let mut io = ComPrazoDeEscrita::novo(servidor, Duration::from_secs(60));
        io.write_all(&[0; 64]).await?;
        let inicio = Instant::now();
        io.corte().definir_prazo(Some(inicio + Duration::from_millis(300)));
        let escrita = tokio::time::timeout(Duration::from_secs(10), io.write_all(&[1])).await?;
        assert_eq!(escrita.err().map(|erro| erro.kind()), Some(io::ErrorKind::TimedOut));
        assert!(inicio.elapsed() >= Duration::from_millis(250), "caiu antes do prazo: {:?}", inicio.elapsed());
        assert!(inicio.elapsed() < Duration::from_secs(5), "o prazo total só valeu em {:?}", inicio.elapsed());
        Ok(())
    }

    /// A resposta saiu do roteador, mas o resto dela (até ~400 KB no buffer do
    /// hyper) ainda não saiu do socket: o prazo total continua valendo
    /// (auditoria, achado 1). Mutação vermelha: tirar o prazo quando a
    /// resposta sai, sem esperar o socket escoar.
    #[tokio::test]
    async fn resposta_que_saiu_segura_o_prazo_ate_o_socket_escoar() -> Resultado {
        let (servidor, _cliente) = tokio::io::duplex(64);
        let mut io = ComPrazoDeEscrita::novo(servidor, Duration::from_secs(60));
        let inicio = Instant::now();
        io.corte().definir_prazo(Some(inicio + Duration::from_millis(300)));
        io.corte().resposta_saiu();
        io.write_all(&[0; 64]).await?;
        let escrita = tokio::time::timeout(Duration::from_secs(10), io.write_all(&[1])).await?;
        assert_eq!(escrita.err().map(|erro| erro.kind()), Some(io::ErrorKind::TimedOut));
        assert!(inicio.elapsed() < Duration::from_secs(5), "o prazo total só valeu em {:?}", inicio.elapsed());
        Ok(())
    }

    /// Socket escoado depois da resposta: o prazo total sai (a próxima resposta
    /// keep-alive escreve) e a espera do próximo cabeçalho começa. Mutações
    /// vermelhas: `escoou` sem tirar o prazo; `escoou` sem armar o cabeçalho.
    #[tokio::test]
    async fn escoar_tira_o_prazo_total_e_arma_o_do_cabecalho() -> Resultado {
        let (servidor, _cliente) = tokio::io::duplex(1024);
        let limites = LimitesDaSala { cabecalho: Duration::from_millis(200), ..LimitesDaSala::default() };
        let mut io = ComPrazoDeEscrita::da_sala(servidor, limites, None);
        let corte = io.corte();
        corte.cabecalho_chegou();
        io.write_all(b"resposta").await?;
        corte.definir_prazo(Some(Instant::now()));
        corte.resposta_saiu();
        io.flush().await?;
        io.write_all(b"proxima resposta").await?;
        let inicio = Instant::now();
        let mut buf = [0u8; 8];
        let leitura = tokio::time::timeout(Duration::from_secs(10), io.read(&mut buf)).await?;
        assert_eq!(leitura.err().map(|erro| erro.kind()), Some(io::ErrorKind::TimedOut));
        assert!(inicio.elapsed() < Duration::from_secs(5), "o cabeçalho só venceu em {:?}", inicio.elapsed());
        Ok(())
    }

    /// Slowloris: o cliente goteja um byte a cada 50 ms e nunca fecha o
    /// cabeçalho. Cai no prazo do cabeçalho, contado do aceite (auditoria,
    /// achado 2). Mutação vermelha: leitura sem o prazo.
    #[tokio::test]
    async fn cabecalho_gotejando_cai_no_prazo() -> Resultado {
        let (servidor, mut cliente) = tokio::io::duplex(1024);
        let limites = LimitesDaSala { cabecalho: Duration::from_millis(300), ..LimitesDaSala::default() };
        let inicio = Instant::now();
        let mut io = ComPrazoDeEscrita::da_sala(servidor, limites, None);
        tokio::spawn(async move {
            for _ in 0..200 {
                tokio::time::sleep(Duration::from_millis(50)).await;
                if cliente.write_all(b"G").await.is_err() {
                    break;
                }
            }
        });
        let lido = tokio::time::timeout(Duration::from_secs(10), async {
            let mut buf = [0u8; 16];
            loop {
                match io.read(&mut buf).await {
                    Ok(0) => return Ok(()),
                    Ok(_) => continue,
                    Err(erro) => return Err(erro),
                }
            }
        })
        .await?;
        assert_eq!(lido.err().map(|erro| erro.kind()), Some(io::ErrorKind::TimedOut));
        assert!(inicio.elapsed() >= Duration::from_millis(250), "caiu antes do prazo: {:?}", inicio.elapsed());
        assert!(inicio.elapsed() < Duration::from_secs(5), "o cabeçalho só venceu em {:?}", inicio.elapsed());
        Ok(())
    }

    /// Pedido em curso (ou WebSocket): sem prazo do cabeçalho, a leitura espera.
    #[tokio::test]
    async fn cabecalho_que_chegou_nao_tem_prazo() -> Resultado {
        let (servidor, _cliente) = tokio::io::duplex(64);
        let limites = LimitesDaSala { cabecalho: Duration::from_millis(100), ..LimitesDaSala::default() };
        let mut io = ComPrazoDeEscrita::da_sala(servidor, limites, None);
        io.corte().cabecalho_chegou();
        let mut buf = [0u8; 8];
        assert!(tokio::time::timeout(Duration::from_millis(600), io.read(&mut buf)).await.is_err(), "leitura sem prazo terminou");
        Ok(())
    }

    /// Lê até o servidor fechar (fim ou erro); `false` se continuou aberta.
    async fn fechou_em(conexao: &mut TcpStream, espera: Duration) -> bool {
        let mut buf = [0u8; 16];
        matches!(tokio::time::timeout(espera, conexao.read(&mut buf)).await, Ok(Ok(0) | Err(_)))
    }

    /// Teto de conexões: com 2 vagas, a 3ª é fechada no aceite; soltar uma das
    /// aceitas devolve a vaga (auditoria, achado 2). Mutação vermelha:
    /// `accept` sem o semáforo.
    #[tokio::test]
    async fn sala_cheia_fecha_a_conexao_excedente() -> Resultado {
        let tcp = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0)).await?;
        let endereco = tcp.local_addr()?;
        let limites = LimitesDaSala { conexoes: 2, ..LimitesDaSala::default() };
        let mut sala = ListenerDaSala::novo(tcp, limites);
        let (aceitas_tx, mut aceitas_rx) = tokio::sync::mpsc::unbounded_channel();
        tokio::spawn(async move {
            loop {
                let (io, _) = Listener::accept(&mut sala).await;
                if aceitas_tx.send(io).is_err() {
                    break;
                }
            }
        });
        let mut primeira = TcpStream::connect(endereco).await?;
        let mut segunda = TcpStream::connect(endereco).await?;
        let aceita = aceitas_rx.recv().await.ok_or("a 1ª não foi aceita")?;
        let _aceita2 = aceitas_rx.recv().await.ok_or("a 2ª não foi aceita")?;
        let mut terceira = TcpStream::connect(endereco).await?;
        assert!(fechou_em(&mut terceira, Duration::from_secs(5)).await, "a conexão excedente ficou aberta");
        assert!(!fechou_em(&mut primeira, Duration::from_millis(200)).await, "a 1ª caiu");
        assert!(!fechou_em(&mut segunda, Duration::from_millis(200)).await, "a 2ª caiu");
        drop(aceita);
        let _quarta = TcpStream::connect(endereco).await?;
        let nova = tokio::time::timeout(Duration::from_secs(5), aceitas_rx.recv()).await?;
        assert!(nova.is_some(), "a vaga solta não voltou");
        Ok(())
    }
}
