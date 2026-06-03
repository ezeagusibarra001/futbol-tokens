import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  refreshToken: string | null;
  isSuperuser: boolean;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    refreshToken: { type: String, default: null },
    isSuperuser: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const User = model<IUser>('User', userSchema);
