#!/usr/bin/env node

/**
 * Create Admin User in Supabase Auth
 * This script creates the admin user directly in Supabase Auth
 * using the service role key (admin privileges)
 */

/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Admin credentials
const ADMIN_EMAIL = 'jfr3sam@gmail.com';
const ADMIN_PASSWORD = 'E1s2a3m4@';
const ADMIN_NAME = 'System Administrator';

async function createAdminUser() {
  console.log('═════════════════════════════════════════════════════');
  console.log('  Creating Admin User in Supabase Auth');
  console.log('═════════════════════════════════════════════════════');
  console.log('');

  // Verify environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing environment variables');
    console.error('');
    console.error('Required variables in .env.local:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    console.error('');
    process.exit(1);
  }

  // Create Supabase admin client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('📧 Admin User Details:');
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log('');

  try {
    // Check if user already exists in Auth
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      throw listError;
    }

    const existingUser = existingUsers.users.find(u => u.email === ADMIN_EMAIL);

    if (existingUser) {
      console.log('⚠️  Admin user already exists in Supabase Auth');
      console.log(`   User ID: ${existingUser.id}`);
      console.log('');

      // Update the user in the users table to ensure it's marked as admin
      const { error: updateError } = await supabase
        .from('users')
        .upsert({
          id: existingUser.id,
          email: ADMIN_EMAIL,
          full_name: ADMIN_NAME,
          role: 'admin',
          auth_provider: 'email',
          email_verified: true,
          preferred_language: 'ar',
        }, {
          onConflict: 'id'
        });

      if (updateError) {
        console.error('❌ Error updating user profile:', updateError.message);
      } else {
        console.log('✅ User profile updated with admin role');
      }

      console.log('');
      console.log('✅ Admin user is ready to use!');
      console.log('');
      return;
    }

    // Create user in Supabase Auth
    console.log('Creating user in Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: ADMIN_NAME,
      },
    });

    if (authError) {
      throw authError;
    }

    console.log('✅ User created in Supabase Auth');
    console.log(`   User ID: ${authData.user.id}`);
    console.log('');

    // Create/update user profile in users table
    console.log('Creating user profile in database...');

    // First, check if a profile with this email already exists
    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (existingProfile) {
      // Update the existing profile with the new auth user ID
      console.log('   Updating existing profile...');
      const { error: updateError } = await supabase
        .from('users')
        .update({
          id: authData.user.id,
          full_name: ADMIN_NAME,
          role: 'admin',
          auth_provider: 'email',
          email_verified: true,
          preferred_language: 'ar',
        })
        .eq('email', ADMIN_EMAIL);

      if (updateError) {
        console.error('❌ Error updating user profile:', updateError.message);
        console.error('   The user was created in Auth but profile update failed.');
        console.error('');
        process.exit(1);
      }
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: ADMIN_EMAIL,
          full_name: ADMIN_NAME,
          role: 'admin',
          auth_provider: 'email',
          email_verified: true,
          preferred_language: 'ar',
        });

      if (insertError) {
        console.error('❌ Error creating user profile:', insertError.message);
        console.error('   The user was created in Auth but profile creation failed.');
        console.error('');
        process.exit(1);
      }
    }

    console.log('✅ User profile created in database');
    console.log('');
    console.log('═════════════════════════════════════════════════════');
    console.log('✨ Admin User Created Successfully!');
    console.log('═════════════════════════════════════════════════════');
    console.log('');
    console.log('You can now login with:');
    console.log(`  Email: ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('  1. Run: npm run dev');
    console.log('  2. Visit: http://localhost:3000/ar/auth/login');
    console.log('  3. Login with the credentials above');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');

    if (error.message?.includes('already registered')) {
      console.error('The user email is already registered.');
      console.error('Try logging in with the existing credentials.');
    } else if (error.message?.includes('service_role')) {
      console.error('Make sure you have the correct SUPABASE_SERVICE_ROLE_KEY in .env.local');
    }

    console.error('');
    process.exit(1);
  }
}

// Run the script
createAdminUser().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
