export interface User {
  _id: string
  email: string
  name: string
  plan: 'free' | 'pro' | 'business'
  role: 'admin' | 'user'
  isActive: boolean
  createdAt: string
}

export interface AdminUser {
  _id: string
  email: string
  name: string
  plan: 'free' | 'pro' | 'business'
  role: 'admin' | 'user'
  isActive: boolean
  cardCount: number
  createdAt: string
}

export type CardStatus = 'processing' | 'ready' | 'error'

export interface Card {
  _id: string
  userId: string
  slug: string
  ownerName: string
  ownerTitle: string
  company: string
  website: string
  socialLinks: {
    linkedin?: string
    instagram?: string
    twitter?: string
  }
  videoUrl: string
  thumbnailUrl: string
  qrImageUrl: string
  targetFileUrl: string
  printPackUrl: string
  status: CardStatus
  errorMsg?: string
  isActive: boolean
  scanCount?: number
  createdAt: string
  updatedAt: string
}

export interface PublicCard {
  slug: string
  ownerName: string
  ownerTitle: string
  company: string
  videoUrl: string
  thumbnailUrl: string
  targetFileUrl: string
  status: CardStatus
  isActive: boolean
}

export interface Analytics {
  totalScans: number
  uniqueScans: number
  scansByDay: { date: string; count: number }[]
  deviceBreakdown: { name: string; value: number }[]
  topCountries: { country: string; count: number }[]
}

export interface CreateCardPayload {
  ownerName: string
  ownerTitle: string
  company?: string
  website?: string
  linkedin?: string
  instagram?: string
  twitter?: string
  video: File
}
