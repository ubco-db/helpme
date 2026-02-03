import { Module } from '@nestjs/common';
import { ClientSocketService } from './client-socket.service';

@Module({
  providers: [ClientSocketService],
  exports: [ClientSocketService],
})
export class WebsocketModule {}
