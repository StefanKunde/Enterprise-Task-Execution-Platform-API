import { TemplateAdapter } from '@nestjs-modules/mailer';
import { readFile } from 'fs';
import { compile } from 'ejs';
import { join } from 'path';

export class EjsAdapter implements TemplateAdapter {
  constructor(private readonly templatesDir: string) {}

  compile(
    mail: any,
    callback: (err?: Error | null, body?: string) => void,
  ): void {
    const templateName = mail?.data?.template;
    if (!templateName) {
      return callback(new Error('No template name provided in mail.template'));
    }

    const templatePath = join(this.templatesDir, `${templateName}.ejs`);
    readFile(templatePath, { encoding: 'utf-8' }, (err, content) => {
      if (err) return callback(err);

      try {
        const rendered = compile(content)(mail.data.context);
        mail.data.html = rendered;
        callback(null, rendered);
      } catch (renderErr) {
        callback(renderErr);
      }
    });
  }
}
