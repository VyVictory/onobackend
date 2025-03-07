import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const testEmail = async () => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: "thanhlanh382@gmail.com", // Email nhận test
            subject: "Test Email",
            text: "This is a test email",
            html: "<b>This is a test email</b>"
        });

        console.log("Email sent successfully");
        console.log("Message ID:", info.messageId);
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

testEmail();