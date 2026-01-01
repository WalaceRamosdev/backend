require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;
const resend = new Resend(process.env.RESEND_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Log para verificar se as chaves estão carregando (não mostra a chave toda por segurança)
console.log('Iniciando servidor...');
if (process.env.MP_ACCESS_TOKEN) console.log('MP_ACCESS_TOKEN: Carregada');
else console.warn('AVISO: MP_ACCESS_TOKEN não encontrada');

if (process.env.RESEND_API_KEY) console.log('RESEND_API_KEY: Carregada');
else console.warn('AVISO: RESEND_API_KEY não encontrada');

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// Rota de Pagamento (Mercado Pago)
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { planName, price } = req.body;

        if (!planName || !price) {
            return res.status(400).json({ error: 'Dados do plano ausentes.' });
        }

        const numericPrice = parseFloat(price.replace(/[^0-9,.]/g, '').replace(',', '.'));
        
        // Detecta Origem para Redirecionamento
        const origin = req.headers.origin || req.headers.referer || 'http://127.0.0.1:5500';
        console.log('Origin detectada:', origin);

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
                // auto_return: 'approved' // Desativado temporariamente para testes locais
            }
        });

        res.json({ url: response.init_point });
    } catch (error) {
        console.error('Erro Mercado Pago:', error);
        res.status(500).json({ error: 'Erro ao criar preferência de pagamento' });
    }
});

// Rota de Envio de Email (Resend) - RESTAURADA
app.post('/send-email', async (req, res) => {
    const { nome, email, whatsapp, servico, detalhes, plano, orcamento } = req.body;

    try {
        const data = await resend.emails.send({
            from: 'Alpha Code <onboarding@resend.dev>', // Ou seu domínio verificado
            to: ['walaceramos@gmail.com'], // Seu email real
            subject: `Novo Pedido: ${nome} - ${servico || plano}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h2 style="color: #6E0F18;">Novo Pedido Recebido!</h2>
                    <p><strong>Nome:</strong> ${nome}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>WhatsApp:</strong> ${whatsapp}</p>
                    <hr>
                    <p><strong>Serviço/Objetivo:</strong> ${servico}</p>
                    <p><strong>Plano Selecionado:</strong> ${plano || 'N/A'}</p>
                    <p><strong>Orçamento/Cores:</strong> ${orcamento}</p>
                    <p><strong>Detalhes:</strong><br>${detalhes}</p>
                </div>
            `
        });

        console.log('Email enviado:', data);
        res.status(200).json({ message: 'Email enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        res.status(500).json({ error: 'Erro ao enviar email' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});