import LegalPage from '../components/LegalPage';

export const metadata = {
  title: 'Política de Privacidade | Revisa',
  description: 'Saiba como o Revisa coleta, utiliza e protege seus dados pessoais.',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="PRIVACIDADE E TRANSPARÊNCIA"
      title="Política de Privacidade"
      description="Esta política explica quais dados o Revisa utiliza, por que eles são necessários e quais escolhas você possui."
      updatedAt="15 de outubro de 2026"
    >
      <section>
        <h2>1. Quem é responsável pelos dados</h2>
        <p>O Revisa é uma plataforma de organização de estudos e é responsável pelo tratamento dos dados pessoais descritos nesta política. Para dúvidas, solicitações ou exercício de direitos, entre em contato pelo e-mail <a href="mailto:paulovitorsilvasoares@gmail.com">paulovitorsilvasoares@gmail.com</a>.</p>
      </section>

      <section>
        <h2>2. Dados que coletamos</h2>
        <p>Coletamos apenas os dados necessários para oferecer e proteger o serviço:</p>
        <ul>
          <li><strong>Conta:</strong> nome, endereço de e-mail e, quando o cadastro é feito com senha, uma versão protegida da senha por hash.</li>
          <li><strong>Identidade Google:</strong> identificador da Conta Google e e-mail verificado quando você escolhe entrar com o Google.</li>
          <li><strong>Dados de estudo:</strong> disciplinas, assuntos, datas, prioridades, intervalos de revisão, resultados, progresso, provas e configurações do Pomodoro.</li>
          <li><strong>Preferências:</strong> tema, cor principal e demais ajustes feitos no Revisa.</li>
          <li><strong>Dados técnicos:</strong> cookie de sessão e registros técnicos mínimos necessários para segurança, diagnóstico e funcionamento da aplicação.</li>
        </ul>
      </section>

      <section>
        <h2>3. Como utilizamos os dados</h2>
        <p>Utilizamos os dados para criar e autenticar sua conta, organizar seu plano de estudos, calcular revisões, registrar seu progresso, manter suas preferências, sincronizar calendários quando autorizado, prevenir abusos e corrigir falhas. O Revisa não vende dados pessoais e não utiliza dados do Google para publicidade.</p>
      </section>

      <section>
        <h2>4. Google Login e Google Calendar</h2>
        <p>O login pelo Google utiliza somente as informações de identidade autorizadas por você. A integração opcional com o Google Calendar permite listar calendários, exibir eventos e criar, atualizar ou excluir eventos de revisão. Identificadores de eventos são armazenados para impedir duplicidades e manter a sincronização.</p>
        <p>Os tokens de acesso e atualização necessários à integração são armazenados de forma criptografada. Você pode desconectar o Google Calendar no perfil do Revisa ou revogar a autorização nas configurações da sua Conta Google.</p>
        <p>O uso e a transferência de informações recebidas das APIs do Google obedecem à <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Política de Dados do Usuário dos Serviços de API do Google</a>, incluindo os requisitos de Uso Limitado. Esses dados são usados somente para fornecer ou melhorar os recursos visíveis de login e calendário solicitados por você.</p>
      </section>

      <section>
        <h2>5. Cookies e sessão</h2>
        <p>Utilizamos cookies essenciais para manter sua sessão autenticada e proteger o fluxo de autorização com o Google. Esses cookies não são usados para publicidade ou rastreamento entre sites.</p>
      </section>

      <section>
        <h2>6. Compartilhamento e operadores</h2>
        <p>Os dados podem ser processados por fornecedores de infraestrutura e pelo Google quando você utiliza as integrações. O compartilhamento é limitado ao necessário para prestar o serviço, cumprir obrigações legais ou proteger usuários e a plataforma.</p>
      </section>

      <section>
        <h2>7. Segurança e retenção</h2>
        <p>Adotamos controles técnicos e organizacionais compatíveis com a natureza do serviço, incluindo conexões HTTPS, senhas protegidas por hash e tokens do Google criptografados. Nenhum sistema é totalmente imune a incidentes, mas trabalhamos para reduzir riscos e responder adequadamente.</p>
        <p>Mantemos os dados enquanto sua conta estiver ativa ou pelo período necessário para prestar o serviço e cumprir obrigações legais. Após uma solicitação válida de exclusão, os dados são removidos ou anonimizados, salvo quando a conservação for exigida por lei.</p>
      </section>

      <section>
        <h2>8. Seus direitos</h2>
        <p>Nos termos da legislação aplicável, incluindo a Lei Geral de Proteção de Dados Pessoais (LGPD), você pode solicitar confirmação de tratamento, acesso, correção, portabilidade quando aplicável, revogação de consentimento e exclusão dos dados. Envie a solicitação para <a href="mailto:paulovitorsilvasoares@gmail.com">paulovitorsilvasoares@gmail.com</a>.</p>
      </section>

      <section>
        <h2>9. Alterações desta política</h2>
        <p>Esta política poderá ser atualizada para refletir mudanças no Revisa, na legislação ou nos serviços integrados. A data da revisão mais recente ficará sempre indicada no início desta página.</p>
      </section>
    </LegalPage>
  );
}
