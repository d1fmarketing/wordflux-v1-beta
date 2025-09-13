import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

// For MVP, we'll use environment variables for users
// Format: ADMIN_EMAIL and ADMIN_PASSWORD_HASH
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@wordflux.local'
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('wordflux2025', 10)

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Check against admin user
        if (credentials.email === ADMIN_EMAIL) {
          const isValid = await bcrypt.compare(credentials.password, ADMIN_PASSWORD_HASH)
          if (isValid) {
            return {
              id: '1',
              email: ADMIN_EMAIL,
              name: 'Admin',
            }
          }
        }

        return null
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET || 'wordflux-jwt-secret-2025',
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
      }
      return session
    }
  },
  debug: process.env.NODE_ENV === 'development',
}