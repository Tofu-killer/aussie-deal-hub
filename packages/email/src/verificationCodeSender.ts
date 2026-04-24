import nodemailer from "nodemailer";

export interface VerificationCodeMessage {
  email: string;
  code: string;
  ttlMs: number;
}

export interface VerificationCodeSender {
  sendVerificationCode(message: VerificationCodeMessage): Promise<void>;
}

export interface EmailTransportMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailTransport {
  send(message: EmailTransportMessage): Promise<void>;
}

export interface SmtpEmailTransportConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

function formatTtlLabel(ttlMs: number) {
  const minutes = Math.max(1, Math.ceil(ttlMs / (1000 * 60)));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

export function buildVerificationCodeEmail(message: VerificationCodeMessage) {
  const ttlLabel = formatTtlLabel(message.ttlMs);
  const subject = "Your Aussie Deal Hub verification code";
  const text =
    `Your verification code is ${message.code}. ` +
    `It expires in ${ttlLabel}.`;
  const html = [
    "<section>",
    "<h1>Your verification code</h1>",
    `<p><strong>${message.code}</strong></p>`,
    `<p>This code expires in ${ttlLabel}.</p>`,
    "</section>",
  ].join("");

  return {
    subject,
    text,
    html,
  };
}

export function createVerificationCodeSender(
  transport: EmailTransport,
  from: string,
): VerificationCodeSender {
  return {
    async sendVerificationCode(message) {
      const email = buildVerificationCodeEmail(message);

      await transport.send({
        from,
        to: message.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    },
  };
}

export function createSmtpEmailTransport(
  config: SmtpEmailTransportConfig,
): EmailTransport {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth:
      config.user && config.pass
        ? {
            user: config.user,
            pass: config.pass,
          }
        : undefined,
  });

  return {
    async send(message) {
      await transport.sendMail(message);
    },
  };
}

export function createLoggingEmailTransport(
  logger: Pick<Console, "info"> = console,
): EmailTransport {
  return {
    async send(message) {
      logger.info(
        `[email] to=${message.to} subject=${message.subject} text=${message.text}`,
      );
    },
  };
}
