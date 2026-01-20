import { UserAccountClient } from '../interfaces/user-account-client.interface';

export class ExecutorStatusUpdatedEvent {
  constructor(public readonly isRunning: boolean) {}
}

export class BalanceUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly balance: number,
  ) {}
}

export class LoginStatusEvent {
  constructor(
    public readonly userId: string,
    public readonly status: 'success' | 'failed' | 'pending',
    public readonly reason?: string,
  ) {}
}

export class AddAccountEvent {
  constructor(public readonly userAccount: UserAccountClient) {}
}

export class RemoveAccountEvent {
  constructor(public readonly accountId: string) {}
}
