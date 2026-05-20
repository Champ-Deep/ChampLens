import mongoose, { Document, Schema, Types } from 'mongoose'

export type CardStatus = 'processing' | 'ready' | 'error'

export interface ICard extends Document {
  userId: Types.ObjectId
  slug: string
  ownerName: string
  ownerTitle: string
  company: string
  website: string
  socialLinks: { linkedin?: string; instagram?: string; twitter?: string }
  videoStorageId: string
  audioStorageId: string
  videoUrl: string
  thumbnailUrl: string
  qrImageUrl: string
  targetFileUrl: string
  printPackUrl: string
  status: CardStatus
  errorMsg: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const CardSchema = new Schema<ICard>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slug:       { type: String, required: true, unique: true, index: true },
    ownerName:  { type: String, required: true, trim: true },
    ownerTitle: { type: String, required: true, trim: true },
    company:    { type: String, default: '', trim: true },
    website:    { type: String, default: '' },
    socialLinks: {
      linkedin:  { type: String, default: '' },
      instagram: { type: String, default: '' },
      twitter:   { type: String, default: '' },
    },
    videoStorageId: { type: String, default: '' },
    audioStorageId: { type: String, default: '' },
    videoUrl:       { type: String, default: '' },
    thumbnailUrl:   { type: String, default: '' },
    qrImageUrl:     { type: String, default: '' },
    targetFileUrl:  { type: String, default: '' },
    printPackUrl:   { type: String, default: '' },
    status:    { type: String, enum: ['processing', 'ready', 'error'], default: 'processing' },
    errorMsg:  { type: String, default: '' },
    isActive:  { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.model<ICard>('Card', CardSchema)
