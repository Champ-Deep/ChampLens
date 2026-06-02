import mongoose, { Document, Schema, Types } from 'mongoose'

export interface ICampaignScan extends Document {
  campaignId: Types.ObjectId
  slug: string
  timestamp: Date
  userAgent: string
  deviceType: 'mobile' | 'tablet' | 'desktop'
  country: string
  city: string
  ipHash: string
}

const CampaignScanSchema = new Schema<ICampaignScan>({
  campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
  slug:       { type: String, required: true, index: true },
  timestamp:  { type: Date, default: Date.now, index: true },
  userAgent:  { type: String, default: '' },
  deviceType: { type: String, enum: ['mobile', 'tablet', 'desktop'], default: 'mobile' },
  country:    { type: String, default: '' },
  city:       { type: String, default: '' },
  ipHash:     { type: String, default: '' },
})

export default mongoose.model<ICampaignScan>('CampaignScan', CampaignScanSchema)
