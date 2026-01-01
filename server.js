require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Habilita CORS para todas as origens (ajuste em produção se necessário)
app.use(express.json()); // Permite receber JSON no corpo da requisição

// Configuração do Nodemailer
// O serviço 'gmail' é um atalho prático. Para outros, configure host e port.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    debug: true, // Log detalhado
    logger: true // Log detalhado
});

// Teste de Verificação das Variáveis (Sem mostrar a senha)
console.log('EMAIL_USER Configurado:', process.env.EMAIL_USER ? 'SIM (' + process.env.EMAIL_USER + ')' : 'NÃO');
console.log('EMAIL_PASS Configurado:', process.env.EMAIL_PASS ? 'SIM (****)' : 'NÃO');


// Rota de Envio de E-mail
app.post('/send-email', async (req, res) => {
    try {
        const { nome, email, mensagem } = req.body;

        // 1. Validação Básica
        if (!nome || !email || !mensagem) {
            return res.status(400).json({ error: 'Todos os campos (nome, email, mensagem) são obrigatórios.' });
        }

        // 2. Validação de formato de E-mail (Simples)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'O endereço de e-mail fornecido é inválido.' });
        }

        // 3. Configuração da Mensagem
        const mailOptions = {
            from: `"${nome}" <${process.env.EMAIL_USER}>`, // Remetente (deve ser o autenticado)
            to: process.env.EMAIL_USER, // Para onde vai o lead (você mesmo)
            replyTo: email, // Responder para o cliente
            subject: `Novo Contato do Site: ${nome}`,
            text: `
                Você recebeu uma nova mensagem pelo site.

                Nome: ${nome}
                Email: ${email}
                
                Mensagem:
                ${mensagem}
            `,
            html: `
                <h3>Novo Contato do Site</h3>
                <p><strong>Nome:</strong> ${nome}</p>
                <p><strong>Email:</strong> ${email}</p>
                <br>
                <p><strong>Mensagem:</strong></p>
                <p>${mensagem.replace(/\n/g, '<br>')}</p>
            `
        };

        // 4. Envio
        await transporter.sendMail(mailOptions);

        return res.status(200).json({ message: 'E-mail enviado com sucesso!' });

    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        return res.status(500).json({ error: 'Erro interno ao enviar o e-mail. Tente novamente mais tarde.' });
    }
});

// Inicialização
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
