import * as AppleAuthentication from 'expo-apple-authentication';
import { getSupabase } from '../../lib/supabaseClient';

const persistAppleProfileSafely = async (userId: string, displayName: string) => {
    try {
        console.log('[AUTH] Apple Sign-In: Checking idempotency for first-time user data out-of-band...');
        const supabase = getSupabase();
        
        const { data: existingProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', userId)
            .maybeSingle();

        if (fetchError) {
             console.error('[AUTH] Failed to fetch existing profile during Apple onboarding:', fetchError);
             return;
        }

        if (!existingProfile?.display_name) {
            console.log('[AUTH] No existing display_name found. Persisting Apple metadata out-of-band safely.');
            const { error: profileError } = await supabase.from('profiles').upsert({
                id: userId,
                display_name: displayName,
                updated_at: new Date().toISOString(),
            });
            
            if (profileError) {
                console.error('[AUTH] Background save for Apple user profile failed:', profileError);
            } else {
                console.log('[AUTH] Background save for Apple user profile succeeded.');
            }
        } else {
            console.log('[AUTH] Profile already exists. Safely aborting Apple metadata write to maintain idempotency.');
        }
    } catch (e) {
        console.error('[AUTH] Unexpected error saving async Apple profile persistence:', e);
    }
};

export const signInWithAppleService = async () => {
    console.log('[AUTH] Starting Apple OAuth via Service');
    try {
        const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
        });
        
        if (credential.identityToken) {
            console.log('[AUTH] Received Apple identityToken, calling Supabase');
            const { data, error } = await getSupabase().auth.signInWithIdToken({
                provider: 'apple',
                token: credential.identityToken,
            });
            
            if (error) throw error;
            
            const userId = data.session?.user?.id;
            
            // First-Time Apple User Data Handling
            if (userId && (credential.fullName || credential.email)) {
                let displayName = '';
                
                if (credential.fullName) {
                    const given = credential.fullName.givenName || '';
                    const family = credential.fullName.familyName || '';
                    displayName = `${given} ${family}`.trim();
                } else if (credential.email) {
                    // Fallback loosely if just email was provided but name wasn't
                    displayName = credential.email.split('@')[0];
                }

                if (displayName) {
                    // Fire and forget profile persistence independent of login phase
                    persistAppleProfileSafely(userId, displayName).catch((e) => {
                        console.error('[AUTH] Uncaught promise error in background profile persist:', e);
                    });
                }
            }
            
            console.log('[AUTH] Supabase session established via Apple token');
            return { data, error: null };
        } else {
            return { data: null, error: new Error('No identityToken returned from Apple') };
        }
    } catch (e: any) {
        if (e.code === 'ERR_REQUEST_CANCELED') {
            console.log('[AUTH] Apple OAuth canceled');
            return { data: null, error: new Error('User canceled') };
        }
        console.error('[AUTH] Apple OAuth exception:', e);
        return { data: null, error: e };
    }
};
