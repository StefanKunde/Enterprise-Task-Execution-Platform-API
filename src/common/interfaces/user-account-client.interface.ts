import { ExecutorCookie } from 'src/executor/dto/start-executor.dto';
import { UserProxyFormat } from './user-account-proxy-format.interface';

export interface UserAccountClient {
  id: string;
  name: string;
  cookies: ExecutorCookie[];
  isMasterUser?: boolean;
  isSuperUser?: boolean;
  proxy?: UserProxyFormat;
  proxies?: UserProxyFormat[];
  executionFilter?: any;
}
