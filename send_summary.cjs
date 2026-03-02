const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const summaryHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 700px; border: 1px solid #eee; padding: 30px; border-radius: 15px; background: #fff; margin: auto;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6E0F18; margin: 0; font-size: 28px;">Relatório de Evolução Alpha Code</h1>
            <p style="color: #666; font-size: 14px;">Resumo das Implementações - 02 de Março, 2026</p>
        </div>

        <p>Olá, <strong>Walace</strong>! Finalizamos hoje uma das atualizações mais importantes para a escalabilidade e profissionalismo da Alpha Code. Aqui estão os destaques do que foi implementado:</p>

        <h3 style="color: #6E0F18; border-bottom: 2px solid #f0f0f0; padding-bottom: 5px;">1. Motor de Contratos Automatizado 📄</h3>
        <p>Criamos um sistema inteligente que gera contratos profissionais em PDF em tempo real.</p>
        <ul>
            <li><strong>Design Elite:</strong> Cabeçalho com logo 3D, estrutura em páginas e visual alinhado à marca.</li>
            <li><strong>Personalização Total:</strong> Captura automática de nome, e-mail, plano e valor direto do checkout.</li>
            <li><strong>Envio Instantâneo:</strong> Assim que o Mercado Pago aprova, o cliente recebe o PDF assinado digitalmente no e-mail.</li>
        </ul>

        <h3 style="color: #6E0F18; border-bottom: 2px solid #f0f0f0; padding-bottom: 5px;">2. Atualização Estratégica de Oferta 💎</h3>
        <p>Elevamos o valor percebido de todos os planos vendidos no site.</p>
        <ul>
            <li><strong>Manual do Projeto:</strong> Inclusão garantida do manual digital em todos os níveis (Bronze, Prata e Ouro).</li>
            <li><strong>Página de Planos:</strong> Atualização visual das funcionalidades para refletir o novo entregável.</li>
        </ul>

        <h3 style="color: #6E0F18; border-bottom: 2px solid #f0f0f0; padding-bottom: 5px;">3. Refinamento de UX/UI (Planos) 🖥️</h3>
        <p>A página de preços recebeu um polimento de alta fidelidade.</p>
        <ul>
            <li><strong>Simetria de Cartões:</strong> Botões agora ficam perfeitamente alinhados na base, independente do texto.</li>
            <li><strong>Glassmorphism Pro:</strong> Efeitos de transparência e blur otimizados para um visual mais focado em autoridade.</li>
            <li><strong>Correção Estrutural:</strong> Eliminamos bugs de aninhamento de código que causavam instabilidade visual.</li>
        </ul>

        <h3 style="color: #6E0F18; border-bottom: 2px solid #f0f0f0; padding-bottom: 5px;">4. Estabilidade de Infraestrutura ⚙️</h3>
        <p>Melhorias "under the hood" para garantir que nada falhe no momento da venda.</p>
        <ul>
            <li><strong>SMTP Otimizado:</strong> Migração para porta 587 para evitar bloqueios de provedores e timeouts.</li>
            <li><strong>Legibilidade PDF:</strong> Ajuste milimétrico de fontes (aumento para 13pt) para garantir leitura perfeita em celulares.</li>
        </ul>

        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 10px; margin-top: 30px; text-align: center;">
            <p style="margin: 0; font-weight: bold; color: #6E0F18;">Alpha Code: Engenharia de Software & Design de Elite</p>
            <p style="margin: 5px 0 0; font-size: 13px; color: #888;">Nenhuma venda será esquecida. Nenhum contrato será manual.</p>
        </div>
    </div>
`;

async function sendSummary() {
    try {
        await transporter.sendMail({
            from: `"Antigravity AI (Alpha Code)" <${process.env.SMTP_USER}>`,
            to: 'alphacodecontato@gmail.com',
            subject: '🚀 Resumo de Implementação: Automação de Contratos & UX Elite',
            html: summaryHtml
        });
        console.log('✅ Resumo enviado com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro enviando resumo:', err);
        process.exit(1);
    }
}

sendSummary();
