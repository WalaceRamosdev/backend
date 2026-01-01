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

if (!process.env.MP_ACCESS_TOKEN) console.warn('AVISO: MP_ACCESS_TOKEN não encontrada');

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

app.post('/create-checkout-session', async (req, res) => {
    try {
        const { planName, price } = req.body;

        if (!planName || !price) {
            return res.status(400).json({ error: 'Dados do plano ausentes.' });
        }

        const numericPrice = parseFloat(price.replace(/[^0-9,.]/g, '').replace(',', '.'));
        
        // --- CORREÇÃO AQUI ---
        // Tenta pegar a origem, se não conseguir, usa localhost como fallback
        const origin = req.headers.origin || req.headers.referer || 'http://127.0.0.1:5500';
        console.log('Origin detectada:', origin); // Log para debug
        // ---------------------

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
                auto_return: 'approved'
            }
        });

        res.json({ url: response.init_point });
    } catch (error) {
        console.error('Erro Mercado Pago:', error);
        res.status(500).json({ error: 'Erro ao criar preferência de pagamento' });
    }
});

// (Mantenha sua rota de email /send-email aqui embaixo como estava)
app.post('/send-email', async (req, res) => {
    // ... seu código de email ...
    res.status(200).json({ message: 'Email enviado (Simulação)' });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});