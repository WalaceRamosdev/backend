require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

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
    }
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

        // Limpa e formata o preço
        const numericPrice = parseFloat(price.replace(/[^0-9,.]/g, '').replace(',', '.'));

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
            to: (process.env.SMTP_USER || process.env.EMAIL_USER), // Envia para si mesmo por padrão
            replyTo: email, // Permite responder diretamente ao cliente
            subject: `🔥 Novo Pedido: ${nome} - ${plano || servico}`,
            html: emailHtml
        };

        const info = await transporter.sendMail(mailOptions);

        console.log('✅ Email enviado com sucesso:', info.messageId);
        res.status(200).json({ message: 'Email enviado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error);
        res.status(500).json({ error: 'Erro ao enviar email' });
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

                console.log('✅ Email de confirmação enviado!');
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