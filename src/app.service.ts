import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  onModuleInit() {
    console.warn('[AppService] onModuleInit called');
  }
}
