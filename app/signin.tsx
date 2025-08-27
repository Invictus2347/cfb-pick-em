import React, { useState } from 'react'
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [usePassword, setUsePassword] = useState(true)
  const { signIn } = useAuth()

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password')
      return
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long')
      return
    }

    setLoading(true)
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password: password
      });
      
      if (error) {
        Alert.alert('Sign Up Failed', error.message);
      } else {
        Alert.alert(
          'Account Created!', 
          'Please check your email to confirm your account before signing in.',
          [{ text: 'OK' }]
        );
        setIsSignUp(false); // Switch back to sign in
      }
    } catch (error) {
      console.error('Sign up error:', error);
      Alert.alert('Error', 'Failed to create account. Please try again.');
    }
    
    setLoading(false)
  }

  const handleSignInWithPassword = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password')
      return
    }

    setLoading(true)
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password
      });
      
      if (error) {
        Alert.alert('Sign In Failed', error.message);
      } else {
        Alert.alert('Success!', 'Signed in successfully!');
      }
    } catch (error) {
      console.error('Password auth error:', error);
      Alert.alert('Error', 'Failed to sign in. Please try again.');
    }
    
    setLoading(false)
  }

  const handleSignInWithEmail = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address')
      return
    }

    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          // Don't specify emailRedirectTo for Expo apps
        }
      })

      if (error) {
        Alert.alert('Magic Link Failed', error.message);
      } else {
        Alert.alert(
          'Check your email', 
          'We sent you a magic link to sign in! After clicking the link, return to this app and you\'ll be automatically signed in.',
          [{ text: 'OK' }]
        )
      }
    } catch (error) {
      console.error('Magic link error:', error);
      Alert.alert('Error', 'Failed to send magic link. Please try again.');
    }
    
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>CFB Pick'em</Text>
          <Text style={styles.subtitle}>
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </Text>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholderTextColor="#666"
            />
          </View>

          {usePassword && (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={isSignUp ? "new-password" : "password"}
                placeholderTextColor="#666"
              />
            </View>
          )}

          <TouchableOpacity 
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={isSignUp ? handleSignUp : (usePassword ? handleSignInWithPassword : handleSignInWithEmail)}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : 
               (isSignUp ? 'Create Account' : (usePassword ? 'Sign In' : 'Send Magic Link'))}
            </Text>
          </TouchableOpacity>

          {/* Toggle between password and magic link (only for sign in) */}
          {!isSignUp && (
            <TouchableOpacity 
              style={styles.linkButton}
              onPress={() => setUsePassword(!usePassword)}
            >
              <Text style={styles.linkText}>
                {usePassword ? 'Use magic link instead' : 'Use password instead'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Toggle between sign up and sign in */}
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => {
              setIsSignUp(!isSignUp);
              setEmail('');
              setPassword('');
            }}
          >
            <Text style={styles.linkText}>
              {isSignUp ? 'Already have an account? Sign in' : 'Don\'t have an account? Sign up'}
            </Text>
          </TouchableOpacity>

          {/* Test account hint */}
          {!isSignUp && usePassword && (
            <View style={styles.testAccountContainer}>
              <Text style={styles.testAccountTitle}>Test Account:</Text>
              <Text style={styles.testAccountText}>Email: test@example.com</Text>
              <Text style={styles.testAccountText}>Password: test123</Text>
            </View>
          )}

          <Text style={styles.helpText}>
            {isSignUp 
              ? 'Create an account to start making picks and joining leagues'
              : (usePassword 
                ? 'Enter your email and password to sign in'
                : 'We\'ll send you a secure link to sign in without a password'
              )
            }
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 48,
    color: '#666',
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
    marginBottom: 8,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  testAccountContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  testAccountTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28a745',
    marginBottom: 8,
    textAlign: 'center',
  },
  testAccountText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 2,
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
    marginTop: 16,
  },
}) 