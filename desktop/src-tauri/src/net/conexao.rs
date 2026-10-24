//! Conexões HTTP da sala com prazo de escrita e corte (SONS AO VIVO, F5a,
//! correção da auditoria de 23/10).
//!
//! Sem prazo, uma aba congelada (ou um jogador que anuncia janela TCP zero)
//! segurava para sempre a vaga de `/sons/{id}` e os até 15 MB do corpo. Aqui:
//! - `ComPrazoDeEscrita`: uma escrita pendente sem NENHUM byte saindo por
//!   `PRAZO_SEM_PROGRESSO` é erro; a conexão cai e o corpo (com a vaga) é solto.
//! - `Corte`: o lado de fora derruba a conexão (queda ou kick do dono da chave)
//!   ou marca o prazo total da resposta em curso, conferido a cada escrita.

use std::future::Future;
use std::io;
use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll, Waker};
use std::time::{Duration, Instant};

use axum::extract::connect_info::Connected;
use axum::serve::{IncomingStream, Listener};
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::Sleep;

use super::server::lock;

/// Escrita pendente sem nenhum byte saindo por este tempo derruba a conexão.
pub const PRAZO_SEM_PROGRESSO: Duration = Duration::from_secs(30);

/// O que derruba UMA conexão de fora dela. Compartilhado entre o socket
/// (`ComPrazoDeEscrita`) e as rotas (`ConexaoHttp`).
#[derive(Debug, Default)]
pub struct Corte {
    cortada: AtomicBool,
    /// A tarefa da conexão, quando está esperando o socket aceitar bytes.
    acordar: Mutex<Option<Waker>>,
    /// Prazo total da resposta em curso (`None` = nenhuma resposta com prazo).
    vence_em: Mutex<Option<Instant>>,
}

impl Corte {
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

    /// O erro que a próxima escrita devolve, se a conexão tem de cair.
    pub fn erro(&self) -> Option<io::Error> {
        if self.cortada() {
            return Some(io::Error::new(io::ErrorKind::ConnectionAborted, "conexão cortada"));
        }
        let vence_em = *lock(&self.vence_em);
        vence_em
            .filter(|vence| Instant::now() >= *vence)
            .map(|_| io::Error::new(io::ErrorKind::TimedOut, "prazo total da resposta"))
    }

    fn vigiar(&self, cx: &Context<'_>) {
        *lock(&self.acordar) = Some(cx.waker().clone());
    }
}

/// Socket com prazo de escrita: o relógio arma na escrita que fica pendente e
/// desarma a cada byte que sai. Conexão ociosa (sem escrita pendente) não tem
/// prazo; o WebSocket de quem só está ouvindo não cai.
pub struct ComPrazoDeEscrita<T> {
    interno: T,
    prazo: Duration,
    relogio: Option<Pin<Box<Sleep>>>,
    corte: Arc<Corte>,
}

impl<T> ComPrazoDeEscrita<T> {
    pub fn novo(interno: T, prazo: Duration) -> Self {
        Self { interno, prazo, relogio: None, corte: Arc::new(Corte::default()) }
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
                match relogio.as_mut().poll(cx) {
                    Poll::Ready(()) => Poll::Ready(Err(io::Error::new(io::ErrorKind::TimedOut, "escrita parada"))),
                    Poll::Pending => Poll::Pending,
                }
            }
        }
    }
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
        Pin::new(&mut self.get_mut().interno).poll_flush(cx)
    }

    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().interno).poll_shutdown(cx)
    }
}

impl<T: AsyncRead + Unpin> AsyncRead for ComPrazoDeEscrita<T> {
    fn poll_read(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &mut ReadBuf<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().interno).poll_read(cx, buf)
    }
}

/// O `TcpListener` da sala: toda conexão aceita sai com prazo de escrita.
pub struct ListenerDaSala {
    interno: TcpListener,
    prazo: Duration,
}

impl ListenerDaSala {
    pub fn novo(interno: TcpListener, prazo: Duration) -> Self {
        Self { interno, prazo }
    }
}

impl Listener for ListenerDaSala {
    type Io = ComPrazoDeEscrita<TcpStream>;
    type Addr = SocketAddr;

    async fn accept(&mut self) -> (Self::Io, Self::Addr) {
        // O `accept` do axum já trata e repete os erros de aceitação.
        let (io, par) = Listener::accept(&mut self.interno).await;
        (ComPrazoDeEscrita::novo(io, self.prazo), par)
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
}
