import mongoose, { Document, Schema, Types } from 'mongoose'

export type CampaignStatus = 'processing' | 'ready' | 'error'

export interface ICampaign extends Document {
  userId: Types.ObjectId
  slug: string
  title: string
  description: string
  ctaText: string
  ctaUrl: string
  videoStorageId: string
  audioStorageId: string
  videoUrl: string
  thumbnailUrl: string
  qrImageUrl: string
  printPackUrl: string
  status: CampaignStatus
  errorMsg: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const CampaignSchema = new Schema<ICampaign>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slug:       { type: String, required: true, unique: true, index: true },
    title:      { type: String, required: true, trim: true },
    description:{ type: String, default: '', trim: true },
    ctaText:    { type: String, default: '', trim: true },
    ctaUrl:     { type: String, default: '' },
    videoStorageId: { type: String, default: '' },
    audioStorageId: { type: String, default: '' },
    videoUrl:       { type: String, default: '' },
    thumbnailUrl:   { type: String, default: '' },
    qrImageUrl:     { type: String, default: '' },
    printPackUrl:   { type: String, default: '' },
    status:    { type: String, enum: ['processing', 'ready', 'error'], default: 'processing' },
    errorMsg:  { type: String, default: '' },
    isActive:  { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.model<ICampaign>('Campaign', CampaignSchema)
