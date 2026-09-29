import { supabase } from '../config/supabase';
import { User } from '../types';
import { mapSupabaseError } from './supabaseErrors';
import { getUserProfile } from './userService';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  specialization?: string;
}

export type RegisterResult = { status: 'signed_in'; user: User } | { status: 'confirm_email' };

export const register = async (input: RegisterInput): Promise<RegisterResult> => {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        phone: input.phone?.trim() || undefined,
        specialization: input.specialization?.trim() || undefined,
      },
    },
  });
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
  // No session means the project requires email confirmation before first sign-in
  if (!data.user || !data.session) {
    return { status: 'confirm_email' };
  }
  return { status: 'signed_in', user: await getUserProfile(data.user.id) };
};

export const login = async (email: string, password: string): Promise<User> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
  return getUserProfile(data.user.id);
};

export const logout = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
};

// The signed-in user restored from the persisted session, or null
export const getSessionUser = async (): Promise<User | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    return null;
  }
  try {
    return await getUserProfile(data.session.user.id);
  } catch {
    return null;
  }
};

// Deletes the account and all of its data (required by the App Store when accounts can be created)
export const deleteAccount = async (): Promise<void> => {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    throw new Error(mapSupabaseError(error));
  }
  // The auth user no longer exists; clear the local session too
  await supabase.auth.signOut({ scope: 'local' });
};
