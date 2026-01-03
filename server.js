require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa Resend (Email)
const resend = new Resend(process.env.RESEND_API_KEY);

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

if (process.env.RESEND_API_KEY) {
    console.log('✅ RESEND_API_KEY: Encontrada');
} else {
    console.warn('❌ AVISO: RESEND_API_KEY não configurada!');
}
// --------------------------------------------------

// Inicializa Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// ==========================================
// ROTA 1: CRIAR PAGAMENTO (Mercado Pago)
// ==========================================
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { planName, price } = req.body;

        if (!planName || !price) {
            return res.status(400).json({ error: 'Dados do plano ausentes.' });
        }

        // Limpa e formata o preço
        const numericPrice = parseFloat(price.replace(/[^0-9,.]/g, '').replace(',', '.'));

        // Detecta a origem (localhost ou produção) para o link de retorno
        const origin = req.headers.origin || req.headers.referer || 'http://127.0.0.1:5500';
        console.log(`💳 Iniciando Checkout. Origem: ${origin}`);

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
                    success: `${origin}/success.html`,
                    failure: `${origin}/cancel.html`,
                    pending: `${origin}/success.html`
                },
                // IMPORTANTE: 'auto_return' comentado para evitar erro no localhost.
                // Quando o site for para o domínio real (https), você pode descomentar.
                // auto_return: 'approved' 
            }
        });

        res.json({ url: response.init_point });
    } catch (error) {
        console.error('❌ Erro Mercado Pago:', error);
        res.status(500).json({ error: 'Erro ao criar preferência de pagamento' });
    }
});

// ==========================================
// ROTA 2: ENVIAR EMAIL DE LEAD (Resend)
// ==========================================
app.post('/send-email', async (req, res) => {
    const { nome, email, whatsapp, servico, detalhes, plano, orcamento, isMaintenance, isPaid } = req.body;

    // console.log('📦 Payload Recebido:', JSON.stringify(req.body, null, 2));

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

        // console.log(`🔍 Verificação: isMaintenance=${isMaintenanceBool}, plano=${plano}, isMaintenancePlan=${isMaintenancePlan}`);

        // Verifica se é manutenção (usando flag explícita ou fallback de string)
        if (isMaintenanceBool || isMaintenancePlan) {
            // console.log('✅ Selecionado Template de MANUTENÇÃO');
            // --- TEMPLATE EXCLUSIVO DE MANUTENÇÃO ---
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
                    <p><strong>Link do Site:</strong> <a href="${orcamento}" target="_blank">${orcamento}</a></p>
                    
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

                    <h3 style="color: #444;">🚀 Detalhes do Projeto</h3>
                    <p><strong>Objetivo/Serviço:</strong> ${servico}</p>
                    <p><strong>Plano Escolhido:</strong> ${plano || 'Personalizado'}</p>
                    <p><strong>Preferência de Cores:</strong> ${orcamento}</p>
                    
                    <div style="background-color: #f0f4f8; padding: 15px; border-left: 4px solid #009EE3; margin-top: 10px;">
                        <strong>Descrição do Cliente:</strong><br>
                        ${detalhes}
                    </div>
                    
                    <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #999; text-align: center;">Alpha Code - Sistema de Pedidos Automático</p>
                </div>
            `;
        }

        const data = await resend.emails.send({
            from: 'Alpha Code <onboarding@resend.dev>', // Use seu domínio verificado se tiver
            to: ['alphacodecontato@gmail.com'], // ONDE VOCÊ RECEBE OS PEDIDOS
            subject: `🔥 Novo Pedido: ${nome} - ${plano || servico}`,
            html: emailHtml
        });

        console.log('✅ Email enviado com sucesso:', data);
        res.status(200).json({ message: 'Email enviado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error);
        res.status(500).json({ error: 'Erro ao enviar email' });
    }
});

// Iniciando o servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});