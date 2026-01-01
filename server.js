require('dotenv').config();
const express = require('express');
const cors = require('cors');


const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;
const resend = new Resend(process.env.RESEND_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Verificação de API Key
if (!process.env.RESEND_API_KEY) {
    console.error('ERRO: RESEND_API_KEY não encontrada no .env');
}

// Rota de Envio de E-mail
app.post('/send-email', async (req, res) => {
    try {
        const { nome, email, mensagem } = req.body;

        if (!nome || !email || !mensagem) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        }

        const { data, error } = await resend.emails.send({
            from: 'Alpha Code <onboarding@resend.dev>', // Email padrão do Resend (funciona sem domínio)
            to: [process.env.EMAIL_USER], // O email que receberá os pedidos (deve ser o mesmo do cadastro Resend)
            reply_to: email, // Para você responder direto ao cliente
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
            console.error('Erro Resend:', error);
            return res.status(400).json({ error: error.message });
        }

        return res.status(200).json({ message: 'E-mail enviado com sucesso via Resend!', id: data.id });

    } catch (err) {
        console.error('Erro interno:', err);
        return res.status(500).json({ error: 'Erro interno ao processar envio.' });
    }
});

// Inicialização
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
