import Link from 'next/link';
import { ArrowLeft, BookOpen, Mail } from 'lucide-react';

export default function LegalPage({ eyebrow, title, description, updatedAt, children }) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link className="legal-brand" href="/" aria-label="Ir para a página inicial do Revisa">
          <span className="brand-symbol"><BookOpen size={21}/></span>
          <strong>revisa<span>.</span></strong>
        </Link>
        <Link className="legal-back" href="/"><ArrowLeft size={17}/> Voltar ao Revisa</Link>
      </header>

      <main className="legal-main">
        <section className="legal-hero">
          <span className="legal-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <small>Última atualização: {updatedAt}</small>
        </section>

        <article className="legal-card">
          {children}
        </article>
      </main>

      <footer className="legal-footer">
        <span>© 2026 Revisa</span>
        <nav aria-label="Documentos legais">
          <Link href="/privacidade">Política de Privacidade</Link>
          <Link href="/termos">Termos de Serviço</Link>
          <a href="mailto:paulovitorsilvasoares@gmail.com"><Mail size={14}/> Contato</a>
        </nav>
      </footer>
    </div>
  );
}
