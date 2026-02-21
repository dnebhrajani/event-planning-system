import nodemailer from "nodemailer";

async function test() {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: "durga.nebhrajani@gmail.com",
            pass: "luccebxfxwgvpwsx"
        },
    });

    try {
        await transporter.verify();
        console.log("Verify Success!");

        const info = await transporter.sendMail({
            from: '"Event System" <durga.nebhrajani@gmail.com>',
            to: "durga.nebhrajani@gmail.com",
            subject: "Test Mail",
            text: "This is a test!"
        });
        console.log("Send Success:", info.messageId);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
