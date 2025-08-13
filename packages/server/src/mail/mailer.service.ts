import * as nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SentEmailResponse } from '@koh/common';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

export type TextEncoding = 'quoted-printable' | 'base64';

export type Headers = Record<string, string> | { key: string; value: string }[];
export interface Address {
  name: string;
  address: string;
}
export interface SendMailParams extends nodemailer.SendMailOptions {
  to?: string | Address | Array<string | Address>;
  cc?: string | Address | Array<string | Address>;
  replyTo?: string | Address;
  inReplyTo?: string | Address;
  from?: string | Address;
  subject?: string;
  text?: string | Buffer;
  html?: string | Buffer;
  sender?: string | Address;
  raw?: string | Buffer;
  textEncoding?: TextEncoding;
  references?: string | string[];
  encoding?: string;
  date?: Date | string;
  headers?: Headers;
  context?: {
    [name: string]: any;
  };
  transporterName?: string;
  template?: string;
  attachments?: {
    filename: string;
    contents?: any;
    path?: string;
    contentType?: string;
    cid?: string;
  }[];
}

@Injectable()
export class MailerService {
  private mailerInstances: Record<string, MailerInstance> = {};

  constructor(configService: ConfigService) {
    this.registerMailer({
      name: 'default',
      service: 'gmail',
      auth: {
        user: configService.get<string>('GMAIL_USER'),
        pass: configService.get<string>('GMAIL_PASSWORD'),
      },
    });
  }

  registerMailer(
    config: (SMTPTransport | SMTPTransport.Options) & { service?: string },
  ): string {
    if (!this.mailerInstances[config.name ?? config.service]) {
      this.mailerInstances[config.name ?? config.service] = new MailerInstance(
        config,
      );
    }
    return config.name ?? config.service;
  }

  async sendMail(options: SendMailParams): Promise<SentEmailResponse> {
    const name = options.transporterName ?? 'default';
    if (!this.mailerInstances[name]) {
      throw new ReferenceError(`Transporter object undefined`);
    }
    return await this.mailerInstances[name].sendMail(options);
  }
}

export class MailerInstance {
  public name: string;
  private readonly transporter: nodemailer.Transporter;
  constructor(
    transport: (SMTPTransport | SMTPTransport.Options) & { service?: string },
  ) {
    this.name = transport.service ?? transport.name;
    this.transporter = nodemailer.createTransport(transport, {
      from: {
        name: '"HelpMe Support"',
        address: transport.auth.user,
      },
    });
  }

  async sendMail(options: SendMailParams): Promise<SentEmailResponse> {
    return await this.transporter.sendMail(options);
  }
}
