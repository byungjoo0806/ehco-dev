// src/lib/user-service.ts
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { User } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  email: string;
  nickname: string;
  profilePicture?: string;
  favoriteFigure?: string;
  phoneNumber?: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  privacyPolicyAccepted: boolean;
  privacyPolicyAcceptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to mark phone as verified (for admin use or error recovery)
export async function markPhoneAsVerified(uid: string): Promise<void> {
  await updateUserProfile(uid, {
    phoneVerified: true,
    updatedAt: new Date(),
  });
}

export async function createUserProfile(
  user: User, 
  additionalData: {
    nickname: string;
    favoriteFigure?: string;
    phoneNumber?: string;
    phoneVerified?: boolean;
    emailVerified?: boolean;
    profilePicture?: string;
  }
): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const emailRef = doc(db, 'user-emails', user.email!.toLowerCase());
  
  // Build userData object with only defined values
  const userData: UserProfile = {
    uid: user.uid,
    email: user.email!,
    nickname: additionalData.nickname,
    phoneVerified: additionalData.phoneVerified ?? false,
    emailVerified: additionalData.emailVerified ?? false,
    privacyPolicyAccepted: true,
    privacyPolicyAcceptedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Only add optional fields if they exist and are not empty
  if (additionalData.profilePicture) {
    userData.profilePicture = additionalData.profilePicture;
  }
  
  if (additionalData.favoriteFigure && additionalData.favoriteFigure.trim() !== '') {
    userData.favoriteFigure = additionalData.favoriteFigure;
  }
  
  if (additionalData.phoneNumber && additionalData.phoneNumber.trim() !== '') {
    userData.phoneNumber = additionalData.phoneNumber;
  }

  // Create both documents atomically
  await setDoc(userRef, userData);
  
  // Create email-to-uid mapping for easy lookups
  await setDoc(emailRef, {
    uid: user.uid,
    email: user.email!,
    createdAt: new Date()
  });
}

// Helper function to find user by email
export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    const emailRef = doc(db, 'user-emails', email.toLowerCase());
    const emailSnap = await getDoc(emailRef);
    
    if (emailSnap.exists()) {
      const { uid } = emailSnap.data();
      return await getUserProfile(uid);
    }
    
    return null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  
  return null;
}

export async function updateUserProfile(
  uid: string, 
  updates: Partial<UserProfile>
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: new Date(),
  });
}