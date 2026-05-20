import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
  email: string
  passwordHash: string
  name: string
  plan: 'free' | 'pro' | 'business'
  role: 'admin' | 'user'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name:         { type: String, required: true, trim: true },
    plan:         { type: String, enum: ['free', 'pro', 'business'], default: 'free' },
    role:         { type: String, enum: ['admin', 'user'], default: 'user' },
    isActive:     { type: Boolean, default: true },
  },
  { timestamps: true }
)


export default mongoose.model<IUser>('User', UserSchema)
