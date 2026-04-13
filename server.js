require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('--- Iniciando Servidor Alpha Code (SMTP Mode) ---');

// Configuração do Nodemailer (SMTP)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outras portas
    auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
    },
    connectionTimeout: 5000, // 5 segundos para conectar
    greetingTimeout: 5000,   // 5 segundos para o "hello" do SMTP
    socketTimeout: 10000     // 10 segundos total de socket
});

// Inicializa Resend (Email - Fallback se necessário)
let resend;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
}

// Middleware
app.use(cors());
app.use(express.json());

// --- CHECAGEM DE VARIÁVEIS DE AMBIENTE (Debug) ---
console.log('--- Iniciando Servidor Alpha Code ---');
if (process.env.MP_ACCESS_TOKEN) {
    console.log('✅ MP_ACCESS_TOKEN: Encontrada');
} else {
    console.warn('❌ AVISO: MP_ACCESS_TOKEN não configurada!');
}

if (process.env.SMTP_USER || process.env.EMAIL_USER) {
    console.log('✅ SMTP/EMAIL: Configurado para ' + (process.env.SMTP_USER || process.env.EMAIL_USER));
    // Testar conexão
    transporter.verify((error) => {
        if (error) console.warn('❌ Erro na configuração do E-mail:', error.message);
        else console.log('✅ Servidor de E-mail pronto para enviar');
    });
} else {
    console.warn('❌ AVISO: Configurações de E-mail não encontradas!');
}
// --------------------------------------------------

// Inicializa Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-0000000000000000-000000-00000000000000000000000000000000-000000000' }); // Fallback to avoid crash

// ==========================================
// FUNÇÃO PARA GERAR PDF DO CONTRATO
// ==========================================
async function generateContractPdf(metadata, paymentData) {
    try {
        const pdfDoc = await PDFDocument.create();
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Load 3D Logo from PROJECT root
        let logoImage;
        try {
            const logoPath = path.join(__dirname, '..', 'public', 'assets', 'logo-sitesalphacode-3d.png');
            if (fs.existsSync(logoPath)) {
                const logoBytes = fs.readFileSync(logoPath);
                logoImage = await pdfDoc.embedPng(logoBytes);
            }
        } catch (e) {
            console.error("Could not load logo image for PDF:", e);
        }

        // Theme Colors
        const bgColor = rgb(1, 1, 1);
        const surfaceColor = rgb(0.97, 0.97, 0.98);
        const primaryRed = rgb(0.54, 0.11, 0.15);
        const textColor = rgb(0.1, 0.1, 0.12);
        const subTextColor = rgb(0.4, 0.4, 0.45);
        const accentRed = rgb(0.65, 0.15, 0.2);
        const borderColor = rgb(0.85, 0.85, 0.88);

        // --- PAGE 1: COVER ---
        const page1 = pdfDoc.addPage([595.28, 841.89]);
        const { width, height } = page1.getSize();

        page1.drawRectangle({ x: 0, y: 0, width, height, color: bgColor });
        page1.drawRectangle({ x: 0, y: 0, width: 20, height, color: primaryRed });

        if (logoImage) {
            const dims = logoImage.scale(0.04);
            page1.drawImage(logoImage, {
                x: (width - dims.width) / 2 + 10,
                y: height - dims.height - 50,
                width: dims.width,
                height: dims.height,
            });
        }

        page1.drawText('CONTRATO DE COMPRA', {
            x: 60, y: height - 320, size: 34, font: helveticaBold, color: textColor
        });
        page1.drawText('E PRESTAÇÃO DE SERVIÇOS', {
            x: 60, y: height - 365, size: 28, font: helveticaBold, color: primaryRed
        });

        page1.drawRectangle({ x: 60, y: height - 385, width: 100, height: 3, color: primaryRed });

        page1.drawText('DETALHAMENTO TÉCNICO E TERMOS DE ADESÃO', {
            x: 60, y: height - 425, size: 12, font: helveticaBold, color: textColor
        });

        // Client info section
        page1.drawRectangle({
            x: 60, y: 150, width: width - 120, height: 160,
            color: surfaceColor,
            borderColor: borderColor,
            borderWidth: 1
        });

        page1.drawText('CONTRATANTE / CLIENTE:', {
            x: 85, y: 285, size: 11, font: helveticaBold, color: subTextColor
        });
        page1.drawText((metadata.customer_name || 'CLIENTE').toUpperCase(), {
            x: 85, y: 255, size: 24, font: helveticaBold, color: textColor
        });
        page1.drawText(`WhatsApp: ${metadata.customer_phone || 'Não informado'}`, {
            x: 85, y: 230, size: 13, font: helvetica, color: subTextColor
        });
        page1.drawText(`Email: ${metadata.customer_email || 'Não informado'}`, {
            x: 85, y: 212, size: 13, font: helvetica, color: subTextColor
        });

        const today = new Date().toLocaleDateString('pt-BR');
        page1.drawText(`EMISSÃO: ${today}`, {
            x: 60, y: 80, size: 11, font: helvetica, color: subTextColor
        });
        page1.drawText('ALPHA CODE SOLUTIONS | © 2025 ALPHA CODE CORP', {
            x: 60, y: 65, size: 10, font: helveticaBold, color: subTextColor
        });

        // --- PAGE 2: ACQUISITION ---
        const page2 = pdfDoc.addPage([595.28, 841.89]);
        page2.drawRectangle({ x: 0, y: 0, width, height, color: bgColor });
        page2.drawRectangle({ x: 0, y: 0, width: 20, height: height, color: accentRed });

        page2.drawText('DETALHES DA AQUISIÇÃO', {
            x: 60, y: height - 85, size: 24, font: helveticaBold, color: textColor
        });

        let yPos = height - 160;
        const addRow = (label, value) => {
            page2.drawRectangle({ x: 60, y: yPos - 15, width: width - 120, height: 50, color: surfaceColor });
            page2.drawText(label, { x: 80, y: yPos + 10, size: 11, font: helveticaBold, color: primaryRed });
            page2.drawText(value.toString(), { x: 80, y: yPos - 5, size: 15, font: helvetica, color: textColor });
            yPos -= 70;
        };

        addRow('PLANO ADQUIRIDO:', metadata.plan_name || 'Personalizado');
        addRow('VALOR TOTAL:', `R$ ${paymentData.transaction_amount || '0,00'}`);
        addRow('MÉTODO DE PAGAMENTO:', (paymentData.payment_method_id || 'Digital').toUpperCase());
        addRow('STATUS:', 'APROVADO / CONFIRMADO');

        yPos -= 20;
        page2.drawText('GARANTIAS E ENTREGÁVEIS INCLUSOS:', {
            x: 60, y: yPos, size: 16, font: helveticaBold, color: textColor
        });
        yPos -= 40;

        const inclusions = [
            'Design Premium de Alta Conversão',
            'Desenvolvimento em Tecnologia Astro (Velocidade Máxima)',
            'Hospedagem de Performance Mundial (Vercel/Cloudflare)',
            'Certificado de Segurança SSL Vitalício',
            'Manual do Projeto (Página Digital de Instruções)',
            'Suporte Alpha para Dúvidas e Micro-ajustes',
            'SEO Estrutural Completo para Google'
        ];

        inclusions.forEach(item => {
            page2.drawCircle({ x: 70, y: yPos + 4, size: 3, color: primaryRed });
            page2.drawText(item, { x: 85, y: yPos, size: 13, font: helvetica, color: textColor });
            yPos -= 30;
        });

        yPos -= 40;
        page2.drawRectangle({ x: 60, y: yPos, width: width - 120, height: 1, color: borderColor });
        yPos -= 40;
        page2.drawText('SOBRE O MANUAL DO PROJETO:', {
            x: 60, y: yPos, size: 13, font: helveticaBold, color: primaryRed
        });
        yPos -= 25;
        page2.drawText('Todos os nossos planos agora incluem uma Central de Documentação Digital.', {
            x: 60, y: yPos, size: 12, font: helvetica, color: subTextColor
        });
        yPos -= 18;
        page2.drawText('Você receberá o link de acesso assim que sua estrutura estiver publicada.', {
            x: 60, y: yPos, size: 12, font: helvetica, color: subTextColor
        });

        // --- PAGE 3: TERMS & NEXT STEPS ---
        const page3 = pdfDoc.addPage([595.28, 841.89]);
        page3.drawRectangle({ x: 0, y: 0, width, height, color: bgColor });
        page3.drawRectangle({ x: 0, y: 0, width: 20, height, color: primaryRed });

        page3.drawText('PRÓXIMOS PASSOS E TERMOS', {
            x: 60, y: height - 85, size: 24, font: helveticaBold, color: textColor
        });

        const steps = [
            { t: '01. BRIEFING TÉCNICO', d: 'Nossa equipe analisará os detalhes enviados e entrará em contato.' },
            { t: '02. DESENVOLVIMENTO', d: 'O projeto entra em produção seguindo o padrão Alpha Elite.' },
            { t: '03. REVISÃO E AJUSTES', d: 'Você valida cada detalhe antes da publicação oficial.' },
            { t: '04. LANÇAMENTO', d: 'Seu canal de vendas digital entra no ar com performance total.' }
        ];

        yPos = height - 170;
        steps.forEach(s => {
            page3.drawText(s.t, { x: 60, y: yPos, size: 16, font: helveticaBold, color: primaryRed });
            yPos -= 25;
            page3.drawText(s.d, { x: 60, y: yPos, size: 13, font: helvetica, color: textColor });
            yPos -= 65;
        });

        yPos -= 10;
        page3.drawRectangle({
            x: 60, y: yPos - 120, width: width - 120, height: 150,
            color: surfaceColor,
            borderColor: borderColor,
            borderWidth: 1
        });

        page3.drawText('TERMOS DE COMPROMISSO ALPHA:', {
            x: 85, y: yPos + 10, size: 12, font: helveticaBold, color: textColor
        });

        const terms = [
            'Propriedade Intelectual integral do cliente após quitação.',
            'Compromisso com pontuação 90+ no Google PageSpeed.',
            'Hospedagem protegida pela infraestrutura Alpha Code.',
            'Suporte técnico via WhatsApp e Email de segunda a sexta.'
        ];

        let termY = yPos - 25;
        terms.forEach(term => {
            page3.drawCircle({ x: 90, y: termY + 3, size: 2, color: primaryRed });
            page3.drawText(term, { x: 105, y: termY, size: 11, font: helvetica, color: subTextColor });
            termY -= 22;
        });

        page3.drawText('Este documento serve como comprovante oficial de contratação.', {
            x: 60, y: 100, size: 10, font: helvetica, color: subTextColor
        });

        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    } catch (error) {
        console.error("ERRO GERAÇÃO PDF CONTRATO:", error);
        return null;
    }
}

// ==========================================
// ROTA DE SAÚDE (KEEP ALIVE)
// ==========================================
app.get('/', (req, res) => {
    res.status(200).send('Alpha Code Backend: Online 🚀');
});

// ==========================================
// ROTA 1: CRIAR PAGAMENTO (Mercado Pago)
// ==========================================
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { planName, price, customerData } = req.body;

        if (!planName || !price) {
            return res.status(400).json({ error: 'Dados do plano ausentes.' });
        }

        // Limpa e formata o preço (ex: "1.200,00" -> 1200.00)
        let cleanPrice = price.toString().replace(/[^0-9,.-]/g, '');
        if (cleanPrice.includes(',') && cleanPrice.includes('.')) {
            // Se tem ambos, o ponto é separador de milhar
            cleanPrice = cleanPrice.replace(/\./g, '').replace(',', '.');
        } else if (cleanPrice.includes(',')) {
            // Se só tem vírgula, é o decimal
            cleanPrice = cleanPrice.replace(',', '.');
        }
        const numericPrice = parseFloat(cleanPrice);

        // Detecta a origem base (protocolo + host)
        let origin = req.headers.origin;
        if (!origin && req.headers.referer) {
            try {
                const refUrl = new URL(req.headers.referer);
                origin = `${refUrl.protocol}//${refUrl.host}`;
            } catch (e) {
                origin = 'http://localhost:4321';
            }
        }
        if (!origin) origin = 'http://localhost:4321';
        if (origin.endsWith('/')) origin = origin.slice(0, -1);
        console.log(`💳 Gerando Checkout. Base Origin: ${origin}`);

        const preference = new Preference(client);

        const response = await preference.create({
            body: {
                items: [
                    {
                        title: `Plano Alpha Code: ${planName}`,
                        quantity: 1,
                        unit_price: Number(numericPrice),
                        currency_id: 'BRL',
                    }
                ],
                back_urls: {
                    success: `${origin}/success`,
                    failure: `${origin}/cancel`,
                    pending: `${origin}/success`
                },
                notification_url: "https://backend-rp7j.onrender.com/webhook",
                metadata: {
                    customer_name: customerData?.nome || 'Não informado',
                    customer_email: customerData?.email || 'Não informado',
                    customer_phone: customerData?.whatsapp || 'Não informado',
                    plan_name: planName,
                    is_maintenance: customerData?.isMaintenance || false,
                    details: customerData?.detalhes || ''
                }
                // auto_return removido para evitar erro com localhost em tokens de produção
            }
        });

        res.json({ url: response.init_point });
    } catch (error) {
        console.error('❌ Erro Mercado Pago (Full Details):', JSON.stringify(error, null, 2));
        if (error.api_response) {
            console.error('🚨 Mercado Pago Response Body:', JSON.stringify(error.api_response.body, null, 2));
        }
        res.status(500).json({ error: 'Erro ao criar preferência de pagamento', details: error.message });
    }
});

// ==========================================
// ROTA 2: ENVIAR EMAIL DE LEAD (Resend)
// ==========================================
app.post('/send-email', async (req, res) => {
    const {
        nome,
        email,
        whatsapp,
        objetivo,
        servico,
        detalhes,
        plano,
        cores,
        orcamento,
        referencias,
        isMaintenance,
        isPaid,
        profissao
    } = req.body;

    // Fallbacks para compatibilidade caso chegue com nomes antigos
    const finalObjetivo = objetivo || servico;
    const finalCores = cores || orcamento;

    if (!transporter) {
        console.error('❌ ERRO: Servidor de email (Nodemailer/SMTP) não inicializado.');
        return res.status(500).json({ error: 'Servidor de email não configurado.' });
    }

    try {
        // Selecionar Template de Email
        let emailHtml = '';

        // Helper para Status de Pagamento
        const statusBadge = isPaid
            ? '<span style="background-color: #d4edda; color: #155724; padding: 2px 8px; border-radius: 4px; border: 1px solid #c3e6cb;">🟢 Pagamento Confirmado (Simulação)</span>'
            : '<span style="background-color: #ffeebc; padding: 2px 8px; border-radius: 4px; border: 1px solid #ffcc00;">🟡 Aguardando Pagamento</span>';

        // Normalização para verificação
        const isMaintenanceBool = isMaintenance === true || isMaintenance === 'true';
        const planoStr = String(plano || '').toLowerCase();
        const isMaintenancePlan = planoStr.includes('manuten');

        // Verifica se é manutenção (usando flag explícita ou fallback de string)
        if (isMaintenanceBool || isMaintenancePlan) {
            emailHtml = `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #6E0F18; border-bottom: 2px solid #6E0F18; padding-bottom: 10px;">Solicitação de Manutenção</h2>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p style="margin: 5px 0;"><strong>Status Atual:</strong> ${statusBadge}</p>
                    </div>

                    <h3 style="color: #444;">👤 Dados do Cliente</h3>
                    <p><strong>Nome:</strong> ${nome}</p>
                    <p><strong>WhatsApp:</strong> <a href="https://wa.me/55${whatsapp.replace(/\D/g, '')}" style="color: #25D366; font-weight: bold; text-decoration: none;">${whatsapp} 🔗</a></p>
                    <p><strong>Email:</strong> ${email}</p>

                    <h3 style="color: #444;">🚀 Detalhes do Projeto</h3>
                    
                    <p><strong>Serviço:</strong> Manutenção</p>
                    <p><strong>Sites de Referência:</strong> ${referencias || 'Nenhuma informada'}</p>
                    
                    <div style="background-color: #f0f4f8; padding: 15px; border-left: 4px solid #009EE3; margin-top: 10px;">
                        <strong>Descrição do Cliente:</strong><br>
                        ${detalhes}
                    </div>
                    
                    <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #999; text-align: center;">Alpha Code - Sistema de Manutenção</p>
                </div>
            `;
        } else {
            // --- TEMPLATE PADRÃO (OUTROS PLANOS) ---
            emailHtml = `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #6E0F18; border-bottom: 2px solid #6E0F18; padding-bottom: 10px;">Novo Pedido Iniciado!</h2>
                    
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p style="margin: 5px 0;"><strong>Status Atual:</strong> ${statusBadge}</p>
                        <p style="margin: 5px 0; font-size: 0.9em; color: #666;">(O cliente preencheu os dados e foi para a tela de pagamento)</p>
                    </div>

                    <h3 style="color: #444;">👤 Dados do Cliente</h3>
                    <p><strong>Nome:</strong> ${nome}</p>
                    <p><strong>WhatsApp:</strong> <a href="https://wa.me/55${whatsapp.replace(/\D/g, '')}" style="color: #25D366; font-weight: bold; text-decoration: none;">${whatsapp} 🔗</a></p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Profissão:</strong> ${profissao || 'Não informada'}</p>

                    <h3 style="color: #444;">🚀 Detalhes do Projeto</h3>
                    <p><strong>Objetivo/Serviço:</strong> ${finalObjetivo || 'Não informado'}</p>
                    <p><strong>Plano Escolhido:</strong> ${plano || 'Personalizado'}</p>
                    <p><strong>Preferência de Cores:</strong> ${finalCores || 'Não informado'}</p>
                    <p><strong>Sites de Referência:</strong> ${referencias || 'Nenhum informado'}</p>
                    
                    <div style="background-color: #f0f4f8; padding: 15px; border-left: 4px solid #009EE3; margin-top: 10px;">
                        <strong>Descrição do Cliente:</strong><br>
                        ${detalhes}
                    </div>
                    
                    <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #999; text-align: center;">Alpha Code - Sistema de Pedidos Automático</p>
                </div>
            `;
        }

        const mailOptions = {
            from: `"Alpha Code" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
            to: (process.env.SMTP_USER || process.env.EMAIL_USER),
            replyTo: email,
            subject: `🔥 Novo Pedido: ${nome} - ${plano || servico}`,
            html: emailHtml
        };

        try {
            // Tenta via SMTP (Gmail)
            const info = await transporter.sendMail(mailOptions);
            console.log('✅ Email enviado via SMTP:', info.messageId);
            return res.status(200).json({ message: 'Email enviado com sucesso (SMTP)!' });
        } catch (smtpError) {
            console.warn('⚠️ Falha no SMTP. Tentando fallback via Resend...', smtpError.message);
            if (resend) {
                try {
                    const { data: resendData, error: resendError } = await resend.emails.send({
                        from: 'Alpha Code <onboarding@resend.dev>',
                        to: (process.env.SMTP_USER || process.env.EMAIL_USER),
                        reply_to: email,
                        subject: `� [FALLBACK] Novo Pedido: ${nome} - ${plano || servico}`,
                        html: emailHtml
                    });
                    if (resendError) throw resendError;
                    console.log('✅ Email enviado via Resend Fallback:', resendData.id);
                    return res.status(200).json({ message: 'Email enviado via Fallback!' });
                } catch (resErr) {
                    throw new Error(`Ambos falharam: ${smtpError.message} / ${resErr.message}`);
                }
            }
            throw smtpError;
        }
    } catch (error) {
        console.error('📊 [BACKUP LOG] Lead capturado mas sem notificação:');
        console.error(`Cliente: ${nome} | WhatsApp: ${whatsapp} | Plano: ${plano}`);
        console.error('❌ Erro fatal ao enviar email:', error.message);

        res.status(200).json({
            message: 'Lead capturado, prossiga para pagamento.',
            warning: error.message
        });
    }
});

// ==========================================
// ROTA 3: WEBHOOK MERCADO PAGO
// ==========================================
app.post('/webhook', async (req, res) => {
    const { query } = req;
    console.log('🔔 Webhook recebido:', query);

    const topic = query.topic || query.type;

    try {
        if (topic === 'payment') {
            const paymentId = query.id || (req.body.data && req.body.data.id);
            console.log(`💳 Verificando pagamento ${paymentId}...`);

            let data;
            if (paymentId === 'test_payment_123') {
                // Mock para teste manual
                data = {
                    status: 'approved',
                    transaction_amount: 295.00,
                    payment_method_id: 'pix',
                    metadata: {
                        customer_name: 'Cliente Teste Alpha',
                        customer_email: 'teste@alpha.com',
                        customer_phone: '11999999999',
                        plan_name: 'Plano Bronze + Domínio'
                    }
                };
                console.log('🧪 Modo de Teste Webhook Ativado');
            } else {
                const payment = new Payment(client);
                data = await payment.get({ id: paymentId });
            }

            console.log(`📊 Status do pagamento: ${data.status}`);

            if (data.status === 'approved') {
                const { metadata } = data;
                console.log('🎉 Pagamento APROVADO! Enviando confirmação...');

                // Template de Confirmação de Pagamento
                const emailHtml = `
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #25D366; padding: 20px; border-radius: 10px;">
                        <h2 style="color: #155724; border-bottom: 2px solid #25D366; padding-bottom: 10px;">✅ PAGAMENTO CONFIRMADO!</h2>
                        
                        <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #c3e6cb;">
                            <p style="margin: 5px 0; color: #155724;"><strong>O cliente finalizou o pagamento com sucesso.</strong></p>
                        </div>

                        <h3 style="color: #444;">👤 Dados do Cliente</h3>
                        <p><strong>Nome:</strong> ${metadata.customer_name}</p>
                        <p><strong>Email:</strong> ${metadata.customer_email}</p>
                        <p><strong>WhatsApp:</strong> ${metadata.customer_phone}</p>

                        <h3 style="color: #444;">🚀 Detalhes da Compra</h3>
                        <p><strong>Plano:</strong> ${metadata.plan_name}</p>
                        <p><strong>Valor Pago:</strong> R$ ${data.transaction_amount}</p>
                        <p><strong>Método:</strong> ${data.payment_method_id.toUpperCase()}</p>
                        
                        <div style="background-color: #f0f4f8; padding: 15px; border-left: 4px solid #25D366; margin-top: 10px;">
                            <strong>Descrição do Briefing:</strong><br>
                            ${metadata.details || 'Ver email anterior'}
                        </div>
                        
                        <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: #999; text-align: center;">Alpha Code - Confirmação Automática</p>
                    </div>
                `;

                const confirmMailOptions = {
                    from: `"Alpha Code" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
                    to: (process.env.SMTP_USER || process.env.EMAIL_USER),
                    subject: `💰 PAGAMENTO CONFIRMADO: ${metadata.customer_name}`,
                    html: emailHtml
                };

                await transporter.sendMail(confirmMailOptions);
                console.log('✅ Email de confirmação enviado para a equipe!');

                // --- NOVO: ENVIO DO CONTRATO PARA O CLIENTE ---
                if (metadata.customer_email && metadata.customer_email !== 'Não informado') {
                    console.log(`✉️ Gerando contrato para o cliente: ${metadata.customer_email}`);
                    const contractBuffer = await generateContractPdf(metadata, data);

                    if (contractBuffer) {
                        const clientMailOptions = {
                            from: `"Alpha Code" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
                            to: metadata.customer_email,
                            subject: `📄 Seu Contrato: ${metadata.plan_name} - Alpha Code`,
                            html: `
                                <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 25px; border-radius: 12px;">
                                    <h2 style="color: #6E0F18;">Olá, ${metadata.customer_name}! 🎉</h2>
                                    <p>Seja bem-vindo(a) à <strong>Alpha Code</strong>. É um prazer ter você conosco!</p>
                                    <p>Seu pagamento para o <strong>${metadata.plan_name}</strong> foi confirmado com sucesso. Agora, nosso time de engenheiros iniciará o processo de produção da sua nova estrutura digital.</p>
                                    
                                    <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #6E0F18; margin: 20px 0;">
                                        <p style="margin: 0;"><strong>Anexo a este e-mail, enviamos seu Contrato de Compra e Detalhamento Técnico.</strong></p>
                                    </div>

                                    <p><strong>O que acontece agora?</strong></p>
                                    <ol>
                                        <li>Nossa equipe entrará em contato via WhatsApp nas próximas 24h úteis.</li>
                                        <li>Faremos o alinhamento do briefing e identidade visual.</li>
                                        <li>Você receberá acesso ao seu <strong>Manual do Projeto</strong> assim que iniciarmos a produção.</li>
                                    </ol>

                                    <p>Se tiver qualquer dúvida imediata, pode nos chamar no WhatsApp.</p>
                                    
                                    <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;">
                                    <p style="font-size: 12px; color: #999; text-align: center;">Alpha Code - Engenharia de Software & Design de Elite</p>
                                </div>
                            `,
                            attachments: [
                                {
                                    filename: `Contrato_AlphaCode_${metadata.customer_name.replace(/\s+/g, '_')}.pdf`,
                                    content: contractBuffer
                                }
                            ]
                        };

                        await transporter.sendMail(clientMailOptions);
                        console.log('✅ Contrato enviado com sucesso para o cliente!');
                    }
                }
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('❌ Erro no Webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Iniciando o servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});