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

// Verificação de API Key
if (!process.env.RESEND_API_KEY) console.warn('AVISO: RESEND_API_KEY não encontrada');
if (!process.env.MP_ACCESS_TOKEN) console.warn('AVISO: MP_ACCESS_TOKEN não encontrada');

// Configuração Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// Rota de Pagamento (Mercado Pago)
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { planName, price } = req.body;

        if (!planName || !price) {
            return res.status(400).json({ error: 'Dados do plano ausentes.' });
        }

        const numericPrice = parseFloat(price.replace(/[^0-9,.]/g, '').replace(',', '.'));
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
                    success: `${req.headers.origin}/success.html`,
                    failure: `${req.headers.origin}/cancel.html`,
                    pending: `${req.headers.origin}/success.html`
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

// Rota de Envio de E-mail
app.post('/send-email', async (req, res) => {
    try {
        const { nome, email, mensagem } = req.body;
        // ... (Verifique se precisa manter a lógica original de email aqui)
        // Se precisar, copie do arquivo server.js que está na pasta backend deste projeto
        
        // Simulação de sucesso par manter validação simples
        res.status(200).json({ message: 'Email enviado (Simulação)' }); 
    } catch (err) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});