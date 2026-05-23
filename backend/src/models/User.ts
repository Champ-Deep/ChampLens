import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
  clerkUserId: string
  email: string
  name: string
  plan: 'free' | 'pro' | 'business'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    clerkUserId: { type: String, required: true, unique: true, index: true },
    email:       { type: String, required: true, lowercase: true, trim: true },
    name:        { type: String, required: true, trim: true },
    plan:        { type: String, enum: ['free', 'pro', 'business'], default: 'free' },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.model<IUser>('User', UserSchema)
