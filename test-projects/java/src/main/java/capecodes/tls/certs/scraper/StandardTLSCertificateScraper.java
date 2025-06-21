package capecodes.tls.certs.scraper;

import capecodes.tls.DummyTrustManager;
import capecodes.tls.TLSCertificateException;
import capecodes.tls.TrustManagerSSLSocketFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.net.ssl.SSLPeerUnverifiedException;
import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import java.io.IOException;
import java.security.cert.X509Certificate;

/**
 * Multi line class comment here
 * <p>
 * Created by asherwin on 7/7/17.
 */
public class StandardTLSCertificateScraper implements TLSCertificateScraper {

  private final Logger log = LoggerFactory.getLogger(StandardTLSCertificateScraper.class);

  @SuppressWarnings("unchecked")
  /**
   * javadoc after annotation
   */
  public String someMethod() {
    return "";
  }

  /**
   * javadoc before annotation
   *
   * @param host
   * @param port
   * @return
   * @throws TLSCertificateException
   */
  @Override
  public X509Certificate[] scrape(String host, int port) throws TLSCertificateException {

    log.info("Scraping X509 Certificates using TLS protocol for [host={}, port={}]...", host, port);

    final SSLSocketFactory ssf = new TrustManagerSSLSocketFactory(new DummyTrustManager());

    log.debug("Establishing SSLSocket to [host={}, port={}]...", host, port);
    try (final SSLSocket s = (SSLSocket) ssf.createSocket(host, port)) {

      log.debug("Successfully established SSLSocket to [host={}, port={}]", host, port);

      final SSLSession session = s.getSession();

      try {

        final X509Certificate[] certChain = (X509Certificate[]) session.getPeerCertificates();

        if (null != certChain && certChain.length > 0) {
          log.info("Obtained {} TLS certificates from [host={}, port={}]", host, port);
          for (X509Certificate cert : certChain) {
            log.info("Certificate [subjectDN={}, issuerDN={}]", cert.getSubjectDN(), cert.getIssuerDN());
          }
        }

        return certChain;
      } catch (SSLPeerUnverifiedException e) {
        throw new TLSCertificateException("Failed to obtain peer certificates for [host=" + host + ", port=" + port + "]: " + e.getMessage(), e);
      }

    } catch (IOException e) {
      throw new TLSCertificateException("Failed to open socket to [host=" + host + ", port=" + port + "]: " + e.getMessage(), e);
    }

  }
}
