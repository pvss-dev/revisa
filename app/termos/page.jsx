import LegalPage from '../components/LegalPage';

export const metadata = {
  title: 'Termos de Serviço | Revisa',
  description: 'Conheça as regras de uso e as responsabilidades relacionadas ao Revisa.',
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="REGRAS DE USO"
      title="Termos de Serviço"
      description="Estes termos apresentam as condições para criar uma conta e utilizar os recursos do Revisa."
      updatedAt="15 de outubro de 2026"
    >
      <section>
        <h2>1. Aceitação dos termos</h2>
        <p>Ao criar uma conta ou utilizar o Revisa, você declara que leu e concorda com estes Termos de Serviço e com a Política de Privacidade. Se você não concordar, não utilize a plataforma.</p>
      </section>

      <section>
        <h2>2. O serviço</h2>
        <p>O Revisa oferece ferramentas para organizar disciplinas e assuntos, planejar revisões, registrar resultados, acompanhar o progresso, utilizar sessões Pomodoro e sincronizar eventos com o Google Calendar. Os cronogramas são recursos de apoio e dependem das informações e configurações fornecidas pelo usuário.</p>
      </section>

      <section>
        <h2>3. Conta e acesso</h2>
        <p>Você deve fornecer informações corretas, manter suas credenciais seguras e comunicar qualquer uso indevido da conta. O acesso pode ser feito por e-mail e senha ou por uma Conta Google. Quando o mesmo e-mail verificado já está cadastrado, o login pelo Google é associado à conta existente.</p>
        <p>Pessoas legalmente incapazes devem utilizar o serviço com autorização e acompanhamento de seu responsável legal.</p>
      </section>

      <section>
        <h2>4. Uso adequado</h2>
        <p>Você concorda em utilizar o Revisa de forma lícita e a não tentar acessar contas de terceiros, contornar mecanismos de segurança, interferir na operação, introduzir códigos maliciosos, sobrecarregar deliberadamente a infraestrutura ou usar o serviço para violar direitos de outras pessoas.</p>
      </section>

      <section>
        <h2>5. Google Calendar e serviços de terceiros</h2>
        <p>A conexão com o Google Calendar é opcional e depende de autorização expressa. Ao conectá-la, você permite que o Revisa execute as operações apresentadas na tela de consentimento. A autorização pode ser revogada no perfil do Revisa ou na Conta Google.</p>
        <p>Serviços de terceiros possuem seus próprios termos, políticas e disponibilidade. Alterações ou indisponibilidades desses serviços podem afetar temporariamente os recursos integrados.</p>
      </section>

      <section>
        <h2>6. Seus dados e conteúdos</h2>
        <p>Você continua responsável pelos dados de estudo cadastrados e autoriza seu processamento na medida necessária para fornecer as funcionalidades solicitadas. O tratamento de dados pessoais segue a <a href="/privacidade">Política de Privacidade</a>.</p>
      </section>

      <section>
        <h2>7. Disponibilidade e alterações</h2>
        <p>Buscamos manter o Revisa disponível e confiável, mas podem ocorrer interrupções para manutenção, atualizações, falhas de infraestrutura ou situações fora de nosso controle. Funcionalidades podem ser corrigidas ou atualizadas para melhorar segurança, desempenho e experiência de uso.</p>
      </section>

      <section>
        <h2>8. Propriedade intelectual</h2>
        <p>A identidade visual, o código, os textos e demais elementos próprios do Revisa são protegidos pela legislação aplicável. Estes termos não transferem ao usuário direitos sobre a plataforma além da permissão pessoal de uso do serviço.</p>
      </section>

      <section>
        <h2>9. Suspensão e encerramento</h2>
        <p>O acesso poderá ser suspenso quando houver violação destes termos, risco à segurança ou obrigação legal. Você pode deixar de usar o Revisa a qualquer momento e solicitar a exclusão dos seus dados pelo e-mail de contato.</p>
      </section>

      <section>
        <h2>10. Legislação e contato</h2>
        <p>Estes termos são regidos pela legislação brasileira. Dúvidas ou solicitações podem ser enviadas para <a href="mailto:paulovitorsilvasoares@gmail.com">paulovitorsilvasoares@gmail.com</a>.</p>
      </section>
    </LegalPage>
  );
}
