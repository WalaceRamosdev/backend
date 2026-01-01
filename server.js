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
if (!process.env.RESEND_API_KEY) {
    console.warn('AVISO: RESEND_API_KEY não encontrada no .env');
}
if (!process.env.MP_ACCESS_TOKEN) {
    console.warn('AVISO: MP_ACCESS_TOKEN não encontrada no .env');
}

// Configuração Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// Rota de Pagamento (Mercado Pago)
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { planName, price } = req.body;

        if (!planName || !price) {
            return res.status(400).json({ error: 'Dados do plano ausentes.' });
        }

        // Converter preço (Ex: "R$ 199" -> 199.00)
        // O Mercado Pago aceita number (float)
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
                auto_return: 'approved',
                payment_methods: {
                    excluded_payment_types: [],
                    installments: 12
                }
            }
        });

        // O frontend espera { url: ... }
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

        if (!nome || !email || !mensagem) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        }

        // 1. Enviar Email para o ADMIN (Você)
        const { data, error } = await resend.emails.send({
            from: 'Alpha Code <onboarding@resend.dev>',
            to: [process.env.EMAIL_USER],
            reply_to: email,
            subject: `Novo Pedido: ${nome}`,
            html: `
                <h3>Novo Contato do Site</h3>
                <p><strong>Nome:</strong> ${nome}</p>
                <p><strong>Email do Cliente:</strong> ${email}</p>
                <br>
                <p><strong>Mensagem:</strong></p>
                <p>${mensagem.replace(/\n/g, '<br>')}</p>
            `
        });

        if (error) {
            console.error('Erro Resend (Admin):', error);
            return res.status(400).json({ error: error.message });
        }

        // 2. Enviar Email de Confirmação para o CLIENTE (Auto-Reply)
        // OBS: No plano gratuito do Resend, isso só funciona se o email do cliente for o mesmo da conta (ou se tiver domínio verificado).
        try {
            await resend.emails.send({
                from: 'Alpha Code <onboarding@resend.dev>',
                to: [email], // Envia para o email preenchido no formulário
                subject: `Recebemos seu pedido, ${nome.split(' ')[0]}! 🚀`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2>Olá, ${nome}! 👋</h2>
                        <p>Recebemos seu pedido de orçamento para o site.</p>
                        <p>Nossa equipe já está analisando suas informações e entrará em contato em breve.</p>
                        <br>
                        <h4>Resumo do que você pediu:</h4>
                        <div style="background: #f4f4f4; padding: 15px; border-radius: 8px;">
                            <p><strong>Mensagem Enviada:</strong></p>
                            <p>${mensagem.replace(/\n/g, '<br>')}</p>
                        </div>
                        <br>
                        <p>Atenciosamente,<br><strong>Equipe Alpha Code</strong></p>
                    </div>
                `
            });
            console.log('Email de confirmação enviado para o cliente.');
        } catch (clientError) {
            console.warn('Não foi possível enviar confirmação para o cliente (Provavelmente falta verificar domínio no Resend).', clientError);
            // Não retornamos erro aqui para não travar a experiência do usuário, já que o admin recebeu o aviso.
        }

        return res.status(200).json({ message: 'E-mail enviado com sucesso!', id: data.id });

    } catch (err) {
        console.error('Erro interno:', err);
        return res.status(500).json({ error: 'Erro interno ao processar envio.' });
    }
});

// Inicialização
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
