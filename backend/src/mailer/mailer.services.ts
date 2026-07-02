import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class MailerService {
  private transporter;

  constructor() {
    console.log('🚀 Initializing MailerService with Zoho SMTP...');
    console.log('📧 Using email: contact@brooklyn-store.tn');

    // Configuration for Zoho Free Account
    this.transporter = createTransport({
      host: 'smtp.zoho.com',
      port: 587, // Required for free accounts
      secure: false, // Must be false for STARTTLS
      requireTLS: true, // Enables STARTTLS
      auth: {
        user: 'contact@brooklyn-store.tn',
        pass: 'Amine@11070949',
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false, // Bypass certificate validation issues
      },
      connectionTimeout: 15000, // 15 seconds
      greetingTimeout: 15000,
      socketTimeout: 15000,
      debug: true, // Enable debug output
      logger: false, // Set to true for more logs
    });

    // Test connection on startup
    this.testConnection();
  }

  async testConnection() {
    console.log('🔄 Testing SMTP connection to Zoho...');
    try {
      await this.transporter.verify();
      console.log('✅ SMTP Connection verified successfully!');
      console.log('📤 Ready to send emails from: contact@brooklyn-store.tn');
    } catch (error) {
      console.error('❌ SMTP Connection failed!');
      console.error('📋 Error details:', {
        code: error.code,
        message: error.message,
        command: error.command,
        response: error.response,
      });

      // Provide troubleshooting tips
      this.provideTroubleshootingTips(error);
    }
  }

  provideTroubleshootingTips(error: any) {
    console.log('\n🔧 TROUBLESHOOTING TIPS:');

    if (error.code === 'EAUTH') {
      console.log('1. Authentication failed. Check:');
      console.log('   • Email and password are correct');
      console.log('   • SMTP is enabled in Zoho Mail settings');
      console.log('   • If 2FA is enabled, use App Password instead');
      console.log('   • Go to: Settings → Mail → Mail Accounts → Enable SMTP');
    } else if (error.code === 'ECONNECTION') {
      console.log('1. Connection failed. Check:');
      console.log('   • Internet connection is working');
      console.log('   • Port 587 is not blocked by firewall');
      console.log('   • Try different network (mobile hotspot)');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('1. Connection timeout. Try:');
      console.log('   • Increasing timeout values');
      console.log('   • Using port 465 with secure: true');
    }

    console.log('\n2. Verify Zoho settings:');
    console.log('   • Login to https://mail.zoho.com');
    console.log('   • Go to Settings → Mail → Mail Accounts');
    console.log('   • Click on contact@brooklyn-store.tn');
    console.log('   • Scroll to IMAP/POP/SMTP → Enable SMTP');

    console.log('\n3. For Free Zoho accounts:');
    console.log('   • Must use port 587 with secure: false');
    console.log('   • From address must match authenticated email');
    console.log('   • First-time recipients need verification via webmail');
  }

  async sendMail(to: string, subject: string, text: string, html?: string) {
    try {
      console.log(`\n📤 Attempting to send email:`);
      console.log(`   From: contact@brooklyn-store.tn`);
      console.log(`   To: ${to}`);
      console.log(`   Subject: ${subject}`);

      const mailOptions = {
        from: '"Brooklyn Store" <contact@brooklyn-store.tn>', // Important: must match auth user
        to,
        subject,
        text,
        html: html || text,
        headers: {
          'X-Mailer': 'Brooklyn Store Mailer',
          'X-Priority': '3',
          'X-MSMail-Priority': 'Normal',
        },
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log('✅ Email sent successfully!');
      console.log(`📨 Message ID: ${info.messageId}`);
      console.log(`📬 Response: ${info.response}`);

      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      console.error('❌ Email sending failed!');
      console.error('📋 Error details:', {
        code: error.code,
        message: error.message,
        command: error.command,
        response: error.response,
      });

      // Check for free account limitations
      if (error.response && error.response.includes('550 5.7.1')) {
        console.error('\n⚠️  ZOHO FREE ACCOUNT LIMITATION:');
        console.error('   Free accounts require recipient verification.');
        console.error(
          '   Login to Zoho webmail and send an email to this address first.',
        );
        console.error('   After verification, you can send via SMTP.');
      }

      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendPasswordResetEmail(
    to: string,
    resetLink: string,
    expiresIn: string = '24 heures',
  ) {
    const subject =
      'Demande de réinitialisation du mot de passe - Brooklyn Store';

    const text = `
Bonjour,

Vous avez demandé une réinitialisation du mot de passe pour votre compte Brooklyn Store.

Pour réinitialiser votre mot de passe, cliquez sur le lien suivant :
${resetLink}

Ce lien est valable pendant ${expiresIn}.

Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.

Cordialement,
L'équipe Brooklyn Store
contact@brooklyn-store.tn
    `;

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Réinitialisation de mot de passe</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .email-container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 30px;
        }
        .message {
            font-size: 16px;
            margin-bottom: 25px;
            color: #555;
        }
        .reset-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 5px;
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
            text-align: center;
            border: none;
            cursor: pointer;
        }
        .link-text {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #667eea;
            font-family: monospace;
            word-break: break-all;
            margin: 20px 0;
            font-size: 14px;
        }
        .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            font-size: 14px;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #eaeaea;
        }
        .logo {
            text-align: center;
            margin-bottom: 20px;
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 20px;
            }
            .reset-button {
                display: block;
                margin: 20px auto;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Réinitialisation de mot de passe</h1>
        </div>
        <div class="content">
            <div class="logo">Brooklyn Store</div>
            <div class="message">
                <p>Bonjour,</p>
                <p>Vous avez demandé une réinitialisation du mot de passe pour votre compte Brooklyn Store.</p>
                <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
            </div>
            
            <div style="text-align: center;">
                <a href="${resetLink}" class="reset-button">Réinitialiser mon mot de passe</a>
            </div>
            
            <p style="text-align: center; color: #666; font-size: 14px;">
                Ce lien expirera dans <strong>${expiresIn}</strong>
            </p>
            
            <div class="link-text">
                Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
                ${resetLink}
            </div>
            
            <div class="warning">
                <strong>⚠️ Important :</strong> Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email. Votre mot de passe restera inchangé.
            </div>
            
            <div class="message">
                <p>Cordialement,<br>
                <strong>L'équipe Brooklyn Store</strong></p>
            </div>
        </div>
        <div class="footer">
            <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
            <p>© ${new Date().getFullYear()} Brooklyn Store. Tous droits réservés.</p>
            <p>Contact : contact@brooklyn-store.tn</p>
        </div>
    </div>
</body>
</html>
    `;

    return await this.sendMail(to, subject, text, html);
  }

  async sendContactEmail(
    email: string,
    nom: string,
    prenom: string,
    msg: string,
    to: string = 'contact@brooklyn-store.tn', // Default to sending to yourself
  ) {
    const subject = `Nouveau message de contact de ${prenom} ${nom}`;

    const text = `
NOUVEAU MESSAGE DE CONTACT

Informations du client :
Nom : ${nom}
Prénom : ${prenom}
Email : ${email}

Message :
${msg}

---
Cet email a été envoyé depuis le formulaire de contact du site Brooklyn Store.
    `;

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nouveau message de contact</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .email-container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 30px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
        }
        .info-item {
            padding: 10px;
        }
        .info-label {
            font-weight: bold;
            color: #555;
            font-size: 14px;
            margin-bottom: 5px;
        }
        .info-value {
            color: #333;
            font-size: 16px;
        }
        .message-box {
            background: #f0f7ff;
            border-left: 4px solid #2196F3;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            font-size: 15px;
            line-height: 1.8;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #eaeaea;
        }
        .logo {
            text-align: center;
            margin-bottom: 20px;
            font-size: 24px;
            font-weight: bold;
            color: #4CAF50;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 20px;
            }
            .info-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Nouveau message de contact</h1>
        </div>
        <div class="content">
            <div class="logo">Brooklyn Store</div>
            
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 18px; color: #4CAF50; font-weight: bold;">
                    Nouveau message reçu du formulaire de contact
                </div>
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">NOM</div>
                    <div class="info-value">${nom}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">PRÉNOM</div>
                    <div class="info-value">${prenom}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">EMAIL</div>
                    <div class="info-value">${email}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">DATE</div>
                    <div class="info-value">${new Date().toLocaleString('fr-FR')}</div>
                </div>
            </div>
            
            <div style="margin: 30px 0;">
                <div style="font-weight: bold; color: #333; margin-bottom: 10px; font-size: 18px;">
                    Message :
                </div>
                <div class="message-box">
                    ${msg.replace(/\n/g, '<br>')}
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 30px; font-size: 14px; color: #666;">
                <strong>📧 Action requise :</strong> Répondre à ce client dans les 24 heures.
                <br>
                <strong>✉️ Répondre à :</strong> ${email}
            </div>
        </div>
        <div class="footer">
            <p>Cet email a été généré automatiquement par le système de contact du site Brooklyn Store.</p>
            <p>© ${new Date().getFullYear()} Brooklyn Store. Tous droits réservés.</p>
        </div>
    </div>
</body>
</html>
    `;

    return await this.sendMail(to, subject, text, html);
  }

  // Test method to verify everything works
  async sendTestEmail(to: string = 'test@gmail.com') {
    console.log('\n🧪 SENDING TEST EMAIL...');

    try {
      const result = await this.sendMail(
        to,
        'Test Email - Brooklyn Store SMTP',
        "Ceci est un email de test depuis Brooklyn Store.\n\nSi vous recevez ce message, le système d'email fonctionne correctement.",
        `
        <h1 style="color: #667eea;">Test réussi ! 🎉</h1>
        <p>Ceci est un email de test depuis <strong>Brooklyn Store</strong>.</p>
        <p>Si vous recevez ce message, le système d'email fonctionne correctement.</p>
        <p><strong>Date d'envoi :</strong> ${new Date().toLocaleString('fr-FR')}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Email envoyé automatiquement par le système Brooklyn Store</p>
        `,
      );

      console.log('✅ Test email sent successfully!');
      return result;
    } catch (error) {
      console.error('❌ Test email failed!');
      throw error;
    }
  }

  // Method to send order confirmation
  async sendOrderConfirmation(
    to: string,
    orderId: string,
    customerName: string,
    orderDetails: any,
    totalAmount: number,
  ) {
    const subject = `Confirmation de commande #${orderId} - Brooklyn Store`;

    const text = `
Confirmation de commande - Brooklyn Store

Bonjour ${customerName},

Merci pour votre commande #${orderId}.

Détails de la commande :
${orderDetails}

Montant total : ${totalAmount} DT

Votre commande est en cours de traitement. Vous recevrez une mise à jour lorsque votre commande sera expédiée.

Cordialement,
L'équipe Brooklyn Store
contact@brooklyn-store.tn
    `;

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmation de commande</title>
    <style>
        /* Add order confirmation styles here */
    </style>
</head>
<body>
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <h1 style="color: #4CAF50;">Merci pour votre commande !</h1>
        <p>Bonjour ${customerName},</p>
        <p>Votre commande #${orderId} a été reçue avec succès.</p>
        <!-- Add more order details here -->
    </div>
</body>
</html>
    `;

    return await this.sendMail(to, subject, text, html);
  }
}

export default MailerService;
