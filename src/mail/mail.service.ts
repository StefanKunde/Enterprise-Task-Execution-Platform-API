import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly config: ConfigService,
  ) {}

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verifyUrl = `${this.config.get('BASE_URL')}/auth/verify-email?token=${token}`;
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Confirm your Task Execution Platform Email',
        template: 'verify-email',
        context: {
          verifyUrl,
        },
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new Error('Mail sending failed');
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.config.get('FRONTEND_URL')}/auth/reset-password?token=${token}`;
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Reset your Task Execution Platform password',
        template: 'reset-password',
        context: { resetUrl },
      });
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error('Mail sending failed');
    }
  }
}
