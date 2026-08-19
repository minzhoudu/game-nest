import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { CredentialsDto } from './dto/credentials.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: CredentialsDto) {
    this.requireCredentials(body);
    return this.auth.register(body.email, body.password);
  }

  @Post('login')
  login(@Body() body: CredentialsDto) {
    this.requireCredentials(body);
    return this.auth.login(body.email, body.password);
  }

  private requireCredentials(body: CredentialsDto): void {
    if (!body?.email || !body.password) {
      throw new BadRequestException('email and password are required');
    }
  }
}
