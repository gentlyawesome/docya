-- Migration: Initial profiles table and storage setup
-- Created: 2026-11-08
-- Description: Creates profiles table with RLS, automatic profile creation trigger, and storage bucket with policies

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  first_name text,
  last_name text,
  email text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS on profiles table
alter table public.profiles enable row level security;

-- Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create trigger for updated_at
create or replace trigger profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- Create automatic profile creation function
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email
  );
  return new;
end;
$$;

-- Create trigger for automatic profile creation
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- RLS Policies for profiles table

-- Allow users to view all profiles (public read)
create policy "Profiles are viewable by everyone"
  on public.profiles
  for select
  using (true);

-- Allow users to insert their own profile (handled by trigger, but needed for completeness)
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check ((select auth.uid()) = id);

-- Allow users to update their own profile
create policy "Users can update their own profile"
  on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Storage setup

-- Create user-files bucket for private user files
insert into storage.buckets (id, name, public)
values ('user-files', 'user-files', false)
on conflict (id) do nothing;

-- Storage RLS policies

-- Allow users to view their own files
create policy "Users can view their own files"
  on storage.objects
  for select
  using (
    bucket_id = 'user-files' 
    and (select auth.uid()::text) = (storage.foldername(name))[1]
  );

-- Allow users to upload files to their own folder
create policy "Users can upload files to their own folder"
  on storage.objects
  for insert
  with check (
    bucket_id = 'user-files'
    and (select auth.uid()::text) = (storage.foldername(name))[1]
  );

-- Allow users to update their own files
create policy "Users can update their own files"
  on storage.objects
  for update
  using (
    bucket_id = 'user-files'
    and (select auth.uid()::text) = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'user-files'
    and (select auth.uid()::text) = (storage.foldername(name))[1]
  );

-- Allow users to delete their own files
create policy "Users can delete their own files"
  on storage.objects
  for delete
  using (
    bucket_id = 'user-files'
    and (select auth.uid()::text) = (storage.foldername(name))[1]
  );

-- Create indexes for better performance
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_created_at_idx on public.profiles(created_at);

-- Comments for documentation
comment on table public.profiles is 'User profiles linked to auth.users';
comment on column public.profiles.id is 'References auth.users.id';
comment on column public.profiles.first_name is 'User first name from signup metadata';
comment on column public.profiles.last_name is 'User last name from signup metadata';
comment on column public.profiles.email is 'User email from auth.users';
comment on function public.handle_new_user() is 'Automatically creates profile when user signs up';
comment on function public.handle_updated_at() is 'Automatically updates updated_at timestamp';