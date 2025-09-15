import { detectProvider, type BoardProvider } from '../board-provider'
import { KanboardClient } from '../kanboard-client'
import { TaskcafeClient } from './taskcafe-client'

export function getBoardProvider(): BoardProvider {
  const kind = detectProvider()
  if (kind === 'taskcafe') {
    return new TaskcafeClient()
  }
  // Default: Kanboard
  return new KanboardClient({
    url: process.env.KANBOARD_URL!,
    username: process.env.KANBOARD_USERNAME!,
    password: process.env.KANBOARD_PASSWORD!
  }) as unknown as BoardProvider
}
