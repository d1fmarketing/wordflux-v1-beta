import { type BoardProvider } from '../board-provider'
import { TaskCafeClient } from './taskcafe-client'

export function getBoardProvider(): BoardProvider {
  // SEMPRE TASKCAFE, FODA-SE taskcafe
  return new TaskCafeClient({
    url: process.env.TASKCAFE_URL || 'http://localhost:3333',
    username: process.env.TASKCAFE_USERNAME || 'admin',
    password: process.env.TASKCAFE_PASSWORD || '',
    projectId: process.env.TASKCAFE_PROJECT_ID
  }) as unknown as BoardProvider
}
